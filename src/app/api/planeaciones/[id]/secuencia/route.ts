import { sql } from '@/lib/db/client';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isAdmin } from '@/lib/admin-unified';
import { generateWithRetry } from '@/lib/ai-retry-manager';
import { SecuenciaResponseSchema, SecuenciaGenerateInputSchema, SecuenciaUpdateInputSchema } from '@/lib/ai-schemas';
import { logger } from '@/lib/logger';
import { obtenerMetodologiaPorId, CATALOGO_METODOLOGIAS_ACTIVAS } from '@/lib/catalogo-metodologias';
import { ensureRetoSituadoCalidad, validateRetoSituado } from '@/lib/planning-evaluator';
import type { SecuenciaBloque, SecuenciaSesion, RetoSituado } from '@/types/planning';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * @openapi
 * /api/planeaciones/{id}/secuencia:
 *   get:
 *     summary: Obtener la secuencia didáctica micro de una planeación
 *     description: Retorna el mapa completo de secuencias didácticas micro por bloque (sequence_json) asociadas a la planeación.
 *     tags:
 *       - Secuencia Didáctica
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: UUID único de la planeación docente
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Secuencia didáctica obtenida exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sequence:
 *                   type: object
 *                   description: Diccionario indexado por número de bloque con sus sesiones didácticas
 *       401:
 *         description: No autorizado (sesión no válida)
 *       404:
 *         description: Planeación no encontrada
 *       500:
 *         description: Error interno al obtener secuencia
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const db = sql();
    const userEmail = session.user.email;
    const isUserAdmin = await isAdmin(userEmail);

    const rows = await db`
      SELECT p.sequence_json, p.teacher_id, t.email as teacher_email
      FROM plannings p
      LEFT JOIN teachers t ON p.teacher_id = t.id
      WHERE p.id = ${id}::uuid
      LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Planeación no encontrada' }, { status: 404 });
    }

    const plan = rows[0];
    if (!isUserAdmin && plan.teacher_email !== userEmail) {
      return NextResponse.json({ error: 'Acceso denegado a esta planeación' }, { status: 403 });
    }

    return NextResponse.json({ sequence: plan.sequence_json || {} });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al obtener secuencia';
    logger.error('GET secuencia error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * @openapi
 * /api/planeaciones/{id}/secuencia:
 *   post:
 *     summary: Generar con IA la secuencia didáctica micro para un bloque
 *     description: Desglosa operativamente un bloque curricular en sesiones de clase de 50 minutos siguiendo la metodología activa seleccionada y los momentos pedagógicos (Apertura, Desarrollo, Cierre).
 *     tags:
 *       - Secuencia Didáctica
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: UUID único de la planeación docente
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - blockIndex
 *             properties:
 *               blockIndex:
 *                 type: integer
 *                 description: Índice base 0 del bloque/actividad en la planeación
 *               totalHours:
 *                 type: integer
 *                 description: Número opcional de horas pedagógicas a generar (1 hora = 1 sesión de 50 min)
 *     responses:
 *       200:
 *         description: Secuencia micro generada exitosamente y persistida en BD
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 blockIndex:
 *                   type: integer
 *                 sequence:
 *                   type: object
 *                 fullSequence:
 *                   type: object
 *                 attempts:
 *                   type: integer
 *                 warnings:
 *                   type: array
 *                   items:
 *                     type: string
 *       400:
 *         description: Parámetros inválidos (ej. blockIndex faltante)
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Planeación o bloque no encontrado
 *       500:
 *         description: Error en generación o validación con IA
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Cuerpo de solicitud JSON inválido' }, { status: 400 });
    }

    const parseResult = SecuenciaGenerateInputSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'blockIndex es requerido y debe ser un número entero >= 0', details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const { blockIndex, totalHours: customHours } = parseResult.data;

    const db = sql();
    const userEmail = session.user.email;
    const isUserAdmin = await isAdmin(userEmail);

    const rows = await db`
      SELECT p.id, p.teacher_id, p.uac_name, p.semester, p.component, p.content_json, p.paec_context, p.sequence_json, p.metodologia_activa,
             t.email as teacher_email
      FROM plannings p
      LEFT JOIN teachers t ON p.teacher_id = t.id
      WHERE p.id = ${id}::uuid
      LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Planeación no encontrada' }, { status: 404 });
    }

    const plan = rows[0];
    if (!isUserAdmin && plan.teacher_email !== userEmail) {
      return NextResponse.json({ error: 'Acceso denegado a esta planeación' }, { status: 403 });
    }
    const content = plan.content_json || {};
    const activities = content.sectionIV?.activities || [];
    const blockActivity = activities[blockIndex];

    if (!blockActivity) {
      return NextResponse.json({ error: `Bloque ${blockIndex} no encontrado en la planeación` }, { status: 404 });
    }

    const hours = customHours || blockActivity.hours || (plan.component === 'laboral' ? 18 : 12);
    const sessionsCount = hours; // 1 hora curricular = 1 sesión de 50 minutos
    const learningOutcome = content.sectionII?.learningOutcomes?.[blockIndex] || '';
    const saberes = blockActivity.saberes || null;
    const paecContext = plan.paec_context || '';
    // Resolución defensiva de metodología activa:
    // Soporta slugs nuevos (ej: 'abp') y nombres completos legacy almacenados
    // en registros de planeaciones anteriores (ej: 'Aprendizaje Basado en Proyectos (ABP)').
    const rawMet = blockActivity.methodology || plan.metodologia_activa || 'abp';
    const metObj = obtenerMetodologiaPorId(rawMet) ||
      CATALOGO_METODOLOGIAS_ACTIVAS.find(m => m.nombre === rawMet);
    const methodology = metObj?.nombre || rawMet || 'Aprendizaje Basado en Proyectos (ABP)';
    const methodologyFases = metObj?.fases
      ? metObj.fases.map((f, i) => `  ${i + 1}. ${f}`).join('\n')
      : '';

    // Calcular distribución pedagógica de sesiones por fase
    let aperturaCount = 1;
    let cierreCount = 1;
    if (sessionsCount >= 16) {
      aperturaCount = 3;
      cierreCount = 3;
    } else if (sessionsCount >= 10) {
      aperturaCount = 2;
      cierreCount = 2;
    }
    const desarrolloCount = sessionsCount - aperturaCount - cierreCount;

    const aperturaText = blockActivity.apertura?.activities || '';
    const aperturaProcesses = blockActivity.apertura?.processes || '';
    const aperturaMaterials = blockActivity.apertura?.materials || '';

    const ejecucionText = blockActivity.ejecucion?.activities || '';
    const ejecucionProcesses = blockActivity.ejecucion?.processes || '';
    const ejecucionMaterials = blockActivity.ejecucion?.materials || '';

    const conclusionText = blockActivity.conclusion?.activities || '';
    const conclusionProcesses = blockActivity.conclusion?.processes || '';
    const conclusionMaterials = blockActivity.conclusion?.materials || '';

    const systemPrompt = `Eres un Diseñador Curricular Senior y Especialista en Didáctica del Bachillerato General Estatal (DBEPA Puebla / MCCEMS).
Tu tarea es generar la SECUENCIA DIDÁCTICA MICRO detallada para cada una de las ${sessionsCount} sesiones de 50 minutos del Bloque/Actividad ${blockIndex + 1}.

DIRECTRIZ DE ALINEACIÓN PEDAGÓGICA FUNDAMENTAL:
La IA DEBE desglosar y enriquecer las actividades planificadas por el docente para este bloque, manteniendo estrictamente su intención formativa. Puede agregar detalles, ejemplos contextualizados, dinámicas participativas y pasos operativos, pero NO puede inventar temas nuevos o propósitos ajenos a la actividad planificada.

REQUISITOS PEDAGÓGICOS:
1. Debes generar exactamente ${sessionsCount} sesiones numeradas del 1 al ${sessionsCount}.
2. Distribución y congruencia de momentos pedagógicos:
   - Sesiones 1 a ${aperturaCount} (Fase de "Apertura"): Desglosan operativamente la APERTURA PLANIFICADA (encuadre, exploración de saberes previos, problematización PAEC y normas de seguridad).
   - Sesiones ${aperturaCount + 1} a ${aperturaCount + desarrolloCount} (Fase de "Desarrollo"): Desglosan operativamente el DESARROLLO/EJECUCIÓN PLANIFICADO (análisis conceptual, fundamentación, prácticas guiadas en taller/aula, resolución de problemas y elaboración de evidencias intermedias).
   - Sesiones ${aperturaCount + desarrolloCount + 1} a ${sessionsCount} (Fase de "Cierre"): Desglosan operativamente la CONCLUSIÓN/CIERRE PLANIFICADO (integración del producto final, coevaluación con rúbricas/listas de cotejo, evaluación sumativa y metacognición).
3. Cada sesión debe tener un título pedagógico situado y concreto, actividades claras y diferenciadas para el rol del docente y rol del estudiante, y la evidencia o producto tangible generado en esos 50 minutos.
4. Incorpora los Tres Saberes (Saber, Saber Hacer, Saber Ser) de manera secuencial y progresiva en las sesiones de desarrollo.

DEBES RESPONDER EXCLUSIVAMENTE EN FORMATO JSON VÁLIDO con la siguiente estructura:
{
  "sessions": [
    {
      "sessionNum": 1,
      "phase": "Apertura",
      "title": "Título situado de la sesión",
      "teachingActivity": "Explicación de la consigna y mediación del docente (2 oraciones concretas)",
      "learningActivity": "Actividad activa individual o colaborativa que realizan los alumnos en los 50 min",
      "evidence": "Producto, apunte, diagrama, bitácora o ejercicio entregable de la sesión",
      "evaluation": "Instrumento o criterio formativo (ej: Lista de cotejo, Heteroevaluación, Rúbrica formativa)"
    }
  ]
}`;

    const userPrompt = `INFORMACIÓN DE LA MATERIA / UAC:
- Asignatura: ${plan.uac_name} (${plan.semester}° Semestre, Componente: ${plan.component})
- Bloque ${blockIndex + 1}: ${blockActivity.name}
- Carga horaria del bloque: ${hours} Horas (${sessionsCount} Sesiones de clase de 50 minutos)
- Metodología Activa: ${methodology}
${methodologyFases ? `- Fases Estructurales de la Metodología (distribúyelas armónicamente entre las sesiones del bloque, NO en una sola sesión):
${methodologyFases}` : ''}
- Propósito Formativo / Resultado de Aprendizaje: ${learningOutcome}
${saberes ? `- Taxonomía de Saberes:
  • Saber (Teórico): ${saberes.saber}
  • Saber Hacer (Práctico): ${saberes.saberHacer}
  • Saber Ser (Actitudinal): ${saberes.saberSer}` : ''}
${blockActivity.contenidoFormativo ? `- Contenido Formativo Clave: ${blockActivity.contenidoFormativo}` : ''}
- Contexto Comunitario PAEC: ${paecContext || 'Problematización comunitaria local.'}

ACTIVIDADES PLANIFICADAS EN LA PLANEACIÓN DIDÁCTICA (SECCIÓN IV) — FUENTE OBLIGATORIA:
• FASE DE APERTURA:
  - Actividades docentes y de alumnos: ${aperturaText || 'Recuperación de saberes previos y diagnóstico situacional'}
  ${aperturaProcesses ? `- Procesos cognitivos: ${aperturaProcesses}` : ''}
  ${aperturaMaterials ? `- Materiales requeridos: ${aperturaMaterials}` : ''}

• FASE DE DESARROLLO (EJECUCIÓN):
  - Actividades docentes y de alumnos: ${ejecucionText || 'Desarrollo conceptual, prácticas guiadas y resolución de retos'}
  ${ejecucionProcesses ? `- Procesos cognitivos: ${ejecucionProcesses}` : ''}
  ${ejecucionMaterials ? `- Materiales requeridos: ${ejecucionMaterials}` : ''}

• FASE DE CIERRE (CONCLUSIÓN):
  - Actividades docentes y de alumnos: ${conclusionText || 'Síntesis de aprendizajes, evaluación formativa y reflexión metacognitiva'}
  ${conclusionProcesses ? `- Procesos cognitivos: ${conclusionProcesses}` : ''}
  ${conclusionMaterials ? `- Materiales requeridos: ${conclusionMaterials}` : ''}

Genera la secuencia didáctica completa de exactamente ${sessionsCount} sesiones estructurada en JSON, desglosando fielmente estas actividades planificadas.`;

    const { data: parsedResponse, attempts, warnings } = await generateWithRetry(
      systemPrompt,
      userPrompt,
      SecuenciaResponseSchema,
      {
        route: 'planeaciones/secuencia',
        baseTemperature: 0.2,
        maxRetries: 3,
      }
    );

    const rawSessions = parsedResponse.sessions;

    const formattedSessions: SecuenciaSesion[] = rawSessions.slice(0, sessionsCount).map((s, idx) => {
      const sNum = idx + 1;
      let phase: 'Apertura' | 'Desarrollo' | 'Cierre' = 'Desarrollo';
      if (sNum <= aperturaCount) phase = 'Apertura';
      else if (sNum > sessionsCount - cierreCount) phase = 'Cierre';

      return {
        sessionNum: sNum,
        totalSessions: sessionsCount,
        phase: s.phase === 'Apertura' || s.phase === 'Desarrollo' || s.phase === 'Cierre' ? s.phase : phase,
        title: s.title,
        teachingActivity: s.teachingActivity,
        learningActivity: s.learningActivity,
        evidence: s.evidence,
        evaluation: s.evaluation,
      };
    });

    // Si la IA generó menos sesiones que las requeridas por el bloque, completar con la progresión temática
    while (formattedSessions.length < sessionsCount) {
      const sNum = formattedSessions.length + 1;
      let phase: 'Apertura' | 'Desarrollo' | 'Cierre' = 'Desarrollo';
      if (sNum <= aperturaCount) phase = 'Apertura';
      else if (sNum > sessionsCount - cierreCount) phase = 'Cierre';

      formattedSessions.push({
        sessionNum: sNum,
        totalSessions: sessionsCount,
        phase,
        title: `Sesión ${sNum}: ${phase === 'Cierre' ? 'Evaluación formativa y síntesis' : 'Práctica guiada y consolidación de saberes'}`,
        teachingActivity: phase === 'Cierre'
          ? 'Coordinación de la plenaria de evaluación formativa y retroalimentación grupal.'
          : 'Acompañamiento en el aula, aclaración de dudas y supervisión de la práctica.',
        learningActivity: phase === 'Cierre'
          ? 'Coevaluación con rúbrica, autoevaluación reflexiva y consolidación del producto formativo.'
          : 'Resolución colaborativa de ejercicios y avance en la evidencia del bloque.',
        evidence: phase === 'Cierre' ? 'Rúbrica/Lista de cotejo completada y producto final del bloque.' : 'Bitácora de trabajo y resolución de ejercicios.',
        evaluation: phase === 'Cierre' ? 'Heteroevaluación formativa y sumativa.' : 'Evaluación formativa continua.',
      });
    }

    const currentSequence: Record<number, SecuenciaBloque> = plan.sequence_json || {};
    const newBlockData: SecuenciaBloque = {
      blockIndex,
      blockName: blockActivity.name,
      hours,
      sessions: formattedSessions,
      updatedAt: new Date().toISOString(),
    };

    currentSequence[blockIndex] = newBlockData;

    // Enforce Reto Situado 4/4 auto-repair antes de persistir
    const retoContext = {
      municipality: content.sectionI?.schoolMunicipality || content.sectionI?.municipality,
      schoolName: content.sectionI?.schoolName,
      uacName: plan.uac_name,
      paecProblem: plan.paec_context || content.sectionII?.paecConnection,
    };
    const ensuredReto = ensureRetoSituadoCalidad(content.sectionII?.retoSituado, retoContext);
    const updatedContent = {
      ...content,
      sectionII: {
        ...(content.sectionII || {}),
        retoSituado: ensuredReto,
      },
    };

    // Guardar en la columna sequence_json y content_json de Neon DB
    await db`
      UPDATE plannings
      SET sequence_json = ${JSON.stringify(currentSequence)}::jsonb,
          content_json = ${JSON.stringify(updatedContent)}::jsonb,
          updated_at = NOW()
      WHERE id = ${id}::uuid
    `;

    return NextResponse.json({
      success: true,
      blockIndex,
      sequence: newBlockData,
      fullSequence: currentSequence,
      retoSituado: ensuredReto,
      attempts,
      warnings,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al generar secuencia didáctica';
    logger.error('POST /api/planeaciones/[id]/secuencia error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * @openapi
 * /api/planeaciones/{id}/secuencia:
 *   put:
 *     summary: Guardar edición manual de sesiones de un bloque en la secuencia
 *     description: Permite al docente persistir modificaciones directas a las sesiones didácticas de un bloque curricular previamente generado.
 *     tags:
 *       - Secuencia Didáctica
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: UUID único de la planeación docente
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - blockIndex
 *               - sessions
 *             properties:
 *               blockIndex:
 *                 type: integer
 *                 description: Índice base 0 del bloque editado
 *               sessions:
 *                 type: array
 *                 description: Lista actualizada de sesiones didácticas del bloque
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Cambios persistidos exitosamente en la columna sequence_json
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 blockIndex:
 *                   type: integer
 *                 sequence:
 *                   type: object
 *                 fullSequence:
 *                   type: object
 *       400:
 *         description: Parámetros inválidos (blockIndex o sessions faltantes/no array)
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Planeación no encontrada
 *       500:
 *         description: Error al guardar cambios en BD
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Cuerpo de solicitud JSON inválido' }, { status: 400 });
    }

    const parseResult = SecuenciaUpdateInputSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Parámetros inválidos (blockIndex entero >= 0 y array sessions con al menos 1 sesión requeridos)', details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const { blockIndex, sessions, retoSituado } = parseResult.data;

    const db = sql();
    const userEmail = session.user.email;
    const isUserAdmin = await isAdmin(userEmail);

    const rows = await db`
      SELECT p.id, p.teacher_id, p.uac_name, p.paec_context, p.content_json, p.sequence_json,
             t.email as teacher_email
      FROM plannings p
      LEFT JOIN teachers t ON p.teacher_id = t.id
      WHERE p.id = ${id}::uuid
      LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Planeación no encontrada' }, { status: 404 });
    }

    const plan = rows[0];
    if (!isUserAdmin && plan.teacher_email !== userEmail) {
      return NextResponse.json({ error: 'Acceso denegado a esta planeación' }, { status: 403 });
    }
    const content = plan.content_json || {};
    const activities = content.sectionIV?.activities || [];
    const blockActivity = activities[blockIndex];

    const retoContext = {
      municipality: content.sectionI?.schoolMunicipality || content.sectionI?.municipality,
      schoolName: content.sectionI?.schoolName,
      uacName: plan.uac_name || content.sectionI?.uacName,
      paecProblem: plan.paec_context || content.sectionII?.paecConnection,
    };

    // Validación estricta 4/4 del Reto Situado en guardado manual
    const candidateReto = retoSituado !== undefined ? retoSituado : content.sectionII?.retoSituado;
    if (candidateReto) {
      const validation = validateRetoSituado(candidateReto as RetoSituado | string, retoContext);
      if (!validation.isApproved) {
        return NextResponse.json(
          {
            error: 'El Reto Situado no cumple con los 4 criterios de calidad pedagógica DBEPA',
            score: validation.score,
            feedback: validation.feedback,
          },
          { status: 400 }
        );
      }
    }

    let updatedContent = content;
    if (retoSituado) {
      const retoObj: RetoSituado = typeof retoSituado === 'string'
        ? {
            titulo: 'Reto Situado de Aprendizaje',
            retoCompleto: retoSituado,
            verboInfinitivo: '',
            contextoLocal: '',
            problematicaReal: '',
            propositoCurricular: '',
          }
        : (retoSituado as unknown as RetoSituado);
      updatedContent = {
        ...content,
        sectionII: {
          ...(content.sectionII || {}),
          retoSituado: retoObj,
        },
      };
    }

    const sanitizedSessions: SecuenciaSesion[] = sessions.map((s, idx) => ({
      sessionNum: s.sessionNum ?? (idx + 1),
      totalSessions: s.totalSessions ?? sessions.length,
      phase: s.phase,
      title: s.title,
      teachingActivity: s.teachingActivity,
      learningActivity: s.learningActivity,
      evidence: s.evidence,
      evaluation: s.evaluation,
      procesoPensamiento: s.procesoPensamiento,
      utilidadReal: s.utilidadReal,
      garantiaDualOffline: s.garantiaDualOffline,
    }));

    const currentSequence: Record<number, SecuenciaBloque> = plan.sequence_json || {};
    currentSequence[blockIndex] = {
      blockIndex,
      blockName: blockActivity?.name || `Bloque ${blockIndex + 1}`,
      hours: sanitizedSessions.length,
      sessions: sanitizedSessions,
      updatedAt: new Date().toISOString(),
    };

    await db`
      UPDATE plannings
      SET sequence_json = ${JSON.stringify(currentSequence)}::jsonb,
          content_json = ${JSON.stringify(updatedContent)}::jsonb,
          updated_at = NOW()
      WHERE id = ${id}::uuid
    `;

    return NextResponse.json({
      success: true,
      blockIndex,
      sequence: currentSequence[blockIndex],
      fullSequence: currentSequence,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al guardar cambios de la secuencia';
    logger.error('PUT /api/planeaciones/[id]/secuencia error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
