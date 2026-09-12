import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { neon } from '@neondatabase/serverless';
import { generateWithRetry } from '@/lib/ai-retry-manager';
import { SecuenciaResponseSchema } from '@/lib/ai-schemas';
import type { SecuenciaBloque, SecuenciaSesion } from '@/types/planning';

export const runtime = 'nodejs';
export const maxDuration = 60;

// ── GET: Obtener secuencia didáctica de la planeación ────────────────────────
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
    const db = neon(process.env.DATABASE_URL!);

    const rows = await db`
      SELECT sequence_json FROM plannings
      WHERE id = ${id}::uuid
      LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Planeación no encontrada' }, { status: 404 });
    }

    return NextResponse.json({ sequence: rows[0].sequence_json || {} });
  } catch (error: any) {
    console.error('GET secuencia error:', error);
    return NextResponse.json({ error: error.message || 'Error al obtener secuencia' }, { status: 500 });
  }
}

// ── POST: Generar secuencia didáctica para un bloque con IA ───────────────────
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
    const body = await request.json();
    const { blockIndex, totalHours: customHours } = body;

    if (blockIndex === undefined || blockIndex === null) {
      return NextResponse.json({ error: 'blockIndex es requerido' }, { status: 400 });
    }

    const db = neon(process.env.DATABASE_URL!);

    const rows = await db`
      SELECT p.id, p.uac_name, p.semester, p.component, p.content_json, p.paec_context, p.sequence_json, p.metodologia_activa
      FROM plannings p
      WHERE p.id = ${id}::uuid
      LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Planeación no encontrada' }, { status: 404 });
    }

    const plan = rows[0];
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
    const methodology = blockActivity.methodology || plan.metodologia_activa || 'Aprendizaje Basado en Proyectos (ABP)';

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

    // Guardar en la columna sequence_json de Neon DB
    await db`
      UPDATE plannings
      SET sequence_json = ${JSON.stringify(currentSequence)}::jsonb,
          updated_at = NOW()
      WHERE id = ${id}::uuid
    `;

    return NextResponse.json({
      success: true,
      blockIndex,
      sequence: newBlockData,
      fullSequence: currentSequence,
      attempts,
      warnings,
    });
  } catch (error: any) {
    console.error('POST /api/planeaciones/[id]/secuencia error:', error);
    return NextResponse.json({ error: error.message || 'Error al generar secuencia didáctica' }, { status: 500 });
  }
}

// ── PUT: Guardar edición manual de sesiones de un bloque ──────────────────────
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
    const body = await request.json();
    const { blockIndex, sessions } = body;

    if (blockIndex === undefined || !Array.isArray(sessions)) {
      return NextResponse.json({ error: 'Parámetros inválidos (blockIndex y sessions requeridos)' }, { status: 400 });
    }

    const db = neon(process.env.DATABASE_URL!);

    const rows = await db`
      SELECT p.id, p.content_json, p.sequence_json
      FROM plannings p
      WHERE p.id = ${id}::uuid
      LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Planeación no encontrada' }, { status: 404 });
    }

    const plan = rows[0];
    const activities = plan.content_json?.sectionIV?.activities || [];
    const blockActivity = activities[blockIndex];

    const currentSequence: Record<number, SecuenciaBloque> = plan.sequence_json || {};
    currentSequence[blockIndex] = {
      blockIndex,
      blockName: blockActivity?.name || `Bloque ${blockIndex + 1}`,
      hours: sessions.length,
      sessions,
      updatedAt: new Date().toISOString(),
    };

    await db`
      UPDATE plannings
      SET sequence_json = ${JSON.stringify(currentSequence)}::jsonb,
          updated_at = NOW()
      WHERE id = ${id}::uuid
    `;

    return NextResponse.json({
      success: true,
      blockIndex,
      sequence: currentSequence[blockIndex],
      fullSequence: currentSequence,
    });
  } catch (error: any) {
    console.error('PUT /api/planeaciones/[id]/secuencia error:', error);
    return NextResponse.json({ error: error.message || 'Error al guardar cambios de la secuencia' }, { status: 500 });
  }
}
