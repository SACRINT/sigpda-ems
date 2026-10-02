import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail, sql } from '@/lib/db';
import { generateWithRotation, resolveUserIsPremium, logActivity } from '@/lib/ai-provider';
import { logger } from '@/lib/logger';
import { parseAIResponse } from '@/lib/ai-response-parser';
import { PmcNormalizedGoalResponseSchema } from '@/lib/ai-schemas';
import { assertNoForbiddenTerms } from '@/lib/pmc-quality-gate';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 60;

type RouteContext = { params: Promise<{ id: string }> };

const NormalizeMetaInputSchema = z.object({
  meta_en_bruto: z.string().min(5, 'La descripción de la meta debe tener al menos 5 caracteres'),
  docente_nombre: z.string().min(2, 'El nombre del docente es requerido'),
  docente_cargo: z.string().optional().default('Docente'),
  horas_base: z.union([z.number(), z.string()]).optional().nullable(),
  tipo_meta: z.enum(['ambas', 'individual', 'institucional']).optional().default('ambas'),
  ambito_sugerido: z.string().optional(),
});

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const teacher = await getTeacherByEmail(session.user.email);
    if (!teacher) {
      return NextResponse.json({ error: 'Docente no encontrado' }, { status: 404 });
    }

    const { id } = await params;
    const db = sql();

    // 1. Obtener y validar propiedad del proyecto PMC
    const [project] = await db`
      SELECT id, school_name, school_cct, municipality, locality, ciclo_escolar,
             subsystem, director_name, diagnostico_comunidad, foda,
             indicadores_academicos, categorias_priorizadas, current_step
      FROM pmc_projects
      WHERE id = ${id}::uuid
        AND teacher_id = ${teacher.id}::uuid
    `;

    if (!project) {
      return NextResponse.json({ error: 'Proyecto PMC no encontrado' }, { status: 404 });
    }

    const rawBody = await request.json();
    const parseBody = NormalizeMetaInputSchema.safeParse(rawBody);
    if (!parseBody.success) {
      return NextResponse.json(
        { error: 'Datos de entrada inválidos', details: parseBody.error.flatten() },
        { status: 400 }
      );
    }

    const { meta_en_bruto, docente_nombre, docente_cargo, tipo_meta, ambito_sugerido } = parseBody.data;

    // 2. Resolver estatus de suscripción para prioridad en IA
    const isPremium = await resolveUserIsPremium(teacher.id);

    const schoolName = project.school_name || 'Plantel de Educación Media Superior';
    const cct = project.school_cct || 'CCT Oficial';
    const ciclo = project.ciclo_escolar || '2025-2026';
    const subsistema = project.subsystem || 'Bachillerato General Estatal';

    // 3. Elaborar Prompts Estructurados según lineamientos oficiales DGB / MCCEMS / NEM
    const systemPrompt = `Eres el Especialista Asesor en Planeación Educativa de la DGB / SEMS para el Marco Curricular Común de la Educación Media Superior (MCCEMS) y la Nueva Escuela Mexicana (NEM).
Tu función es NORMALIZAR con precisión técnica y quirúrgica una o varias metas pedagógicas o institucionales expresadas en lenguaje coloquial o en bruto por un docente, convirtiéndolas en redacciones oficiales alineadas a los formatos oficiales del Programa de Mejora Continua (PMC 2025-2026).

DIRECTRICES OFICIALES:
1. DETECCIÓN DE UNA O MÚLTIPLES METAS:
   - Si el texto en bruto contiene 1 sola meta, genera 1 elemento en el arreglo "metas".
   - Si el texto en bruto contiene 2 o más metas distintas (por ejemplo numeradas '1.', '2.', con viñetas, separadas por párrafos o temas diferentes como cursos de capacitación COSFAC y actividades de Vive Saludable/PAEC), DEBES SEPARAR Y NORMALIZAR CADA UNA DE FORMA INDEPENDIENTE dentro del arreglo "metas".
2. METAS SMART: Deben iniciar con verbo en infinitivo medible, establecer una cuantificación o estándar de logro porcentual (e.g. 100%, 90%), especificar el objeto de mejora pedagógica y el ciclo escolar.
3. CATEGORÍAS DEL FORMATO 5.1 (Áreas Obligatorias y Adicionales):
   - "aprovechamiento": 1. Aprovechamiento académico y asistencia educativa (indicadores de reprobación, abandono, rezago, aprendizaje).
   - "practica_docente": 2. Práctica docente y formación continua (actualización docente, cursos COSFAC, desempeño en el aula, planeación didáctica, acompañamiento pedagógico, academias).
   - "infraestructura": 3. Infraestructura y equipamiento escolar (equipamiento, laboratorios, biblioteca, vinculación con el entorno para recursos).
   - "convivencia_paec": 4. Convivencia escolar y Proyecto Escolar Comunitario (cultura de paz, programas de vida saludable y feliz, prevención de la violencia, inclusión, PAEC).
   - "adicional": 5. Ámbito Institucional Adicional (cualquier otro tema prioritario para el plantel).
4. PARIDAD DOCUMENTAL ESTRICTA:
   - Cada meta debe alimentar la Matriz 4.1 del Plan de Acción.
   - Las Tablas Obligatorias 5.1 o Adicionales.
   - Las Fichas Técnicas Descriptivas por Meta Institucional (Formato 3.1).
   - Las Metas Individuales del Personal (Sección 7: compromiso del docente con entregable y estrategia en aula).
   - Los Mecanismos de Seguimiento y Monitoreo Trimestral (Sección 8: cortes de seguimiento y responsables).
5. PROHIBICIÓN ESTRICTA: JAMÁS incluyas nombres de software, sistemas privados (como SIGPDA, etc.) ni fórmulas genéricas como [Insertar aquí]. Todo debe sonar totalmente institucional, redactado como documento oficial de SEP/DGB. En nombres de personas usa únicamente el nombre proporcionado (${docente_nombre}).

Genera ÚNICAMENTE un objeto JSON válido con la siguiente estructura:
{
  "metas": [
    {
      ${tipo_meta !== 'institucional' ? `"meta_individual": {
        "nombre": "${docente_nombre}",
        "cargo": "${docente_cargo}",
        "categoria": "Ámbito de intervención",
        "tema": "Tema o subcategoría pedagógica",
        "meta_individual": "Redacción SMART rigurosa de la meta individual (Verbo infinitivo + Qué + Cuánto/Cómo + Para qué)",
        "estrategia": "Estrategia didáctica e instrumentación secuencial en aula y CTE",
        "entregable": "Producto tangible verificable (e.g., Constancias de acreditación, portafolio de evidencias, planeaciones con rúbricas)",
        "periodo": "Ciclo Escolar ${ciclo}"
      },` : ''}
      ${tipo_meta !== 'individual' ? `"meta_institucional": {
        "categoria": "aprovechamiento" | "practica_docente" | "infraestructura" | "convivencia_paec" | "adicional",
        "nombre_categoria": "Nombre oficial completo de la categoría",
        "tema": "Tema concreto de intervención",
        "meta": "Redacción formal SMART de la meta institucional con porcentaje medible",
        "estrategia": "Estrategia institucional y colegiada para el cumplimiento de la meta (Formato 4.1)",
        "linea_base": "Situación de partida diagnóstica fundamentada",
        "personal_designado": "${docente_nombre} y Academia Docente",
        "entregable": "Producto o evidencia institucional verificable (Formato 5.1)",
        "periodo_inicio": "Septiembre",
        "periodo_fin": "Julio",
        "diagnostico_meta": "Diagnóstico justificativo de la meta en el contexto escolar",
        "accion_especifica": "Acción operativa y calendarizada en el plantel (Formato 3.1)",
        "finalidad": "Propósito formativo o institucional de la meta (Formato 3.1)",
        "necesidad": "Necesidad institucional detectada en el plantel que motiva la meta",
        "proceso_evaluacion": "Mecanismos e instrumentos de evaluación formativa y sumativa (Formato 3.1)",
        "subcategorias_vinculadas": ["Subcategoría principal", "Subcategoría complementaria"],
        "estrategias_seguimiento": "Cortes bimestrales en Consejo Técnico Escolar y colegiados",
        "observaciones": "Observaciones de instrumentación conforme a normatividad vigente"
      }` : ''}
    }
  ]
}`;

    const userPrompt = `Plantel: ${schoolName} (${cct})
Subsistema: ${subsistema}
Ciclo Escolar: ${ciclo}
Docente solicitante: ${docente_nombre}
Cargo: ${docente_cargo}
${ambito_sugerido ? `Ámbito sugerido por el usuario: ${ambito_sugerido}` : ''}
Tipo de meta solicitada: ${tipo_meta}

TEXTO EN BRUTO PROPORCIONADO POR EL DOCENTE (SIN NORMALIZAR):
"""
${meta_en_bruto}
"""

Por favor normaliza este contenido bajo los más altos estándares técnicos del MCCEMS. Si contiene 2 o más metas separadas, devuelve cada una como un elemento en el arreglo "metas". Formula todos los apartados requeridos para integrarse de forma quirúrgica en el PMC oficial.`;

    // 4. Llamada a IA con rotación inteligente y modo JSON
    const rawAiResponse = await generateWithRotation(
      systemPrompt,
      userPrompt,
      teacher.id,
      isPremium,
      { jsonMode: true, temperature: 0.3 }
    );

    // 5. Parseo seguro y validación con Zod
    const parseResult = parseAIResponse(rawAiResponse, PmcNormalizedGoalResponseSchema, {
      contextName: 'pmc_normalize_meta',
    });

    if (!parseResult.success) {
      logger.error('[normalize-meta] Error parsing AI response:', parseResult.error);
      return NextResponse.json(
        { error: 'Error al procesar la normalización de la meta', details: parseResult.error },
        { status: 502 }
      );
    }

    const normalizedData = parseResult.data;

    // 6. Auditoría de calidad: asegurar que no haya términos prohibidos
    const violation = assertNoForbiddenTerms(normalizedData, 'normalización quirúrgica de meta');
    if (violation) {
      logger.warn('[normalize-meta] Término prohibido detectado en respuesta:', violation.body);
      return NextResponse.json(violation.body, { status: violation.status });
    }

    // 7. Asegurar que el nombre y cargo del docente coincidan en todas las metas generadas
    normalizedData.metas.forEach((item) => {
      if (item.meta_individual) {
        item.meta_individual.nombre = docente_nombre;
        item.meta_individual.cargo = docente_cargo || 'Docente';
        if (!item.meta_individual.periodo) {
          item.meta_individual.periodo = `Ciclo Escolar ${ciclo}`;
        }
      }

      if (item.meta_institucional) {
        if (!item.meta_institucional.personal_designado) {
          item.meta_institucional.personal_designado = `${docente_nombre} y Academia Docente`;
        }
        if (!item.meta_institucional.periodo_inicio) {
          item.meta_institucional.periodo_inicio = 'Septiembre';
        }
        if (!item.meta_institucional.periodo_fin) {
          item.meta_institucional.periodo_fin = 'Julio';
        }
      }
    });

    // Mantener retrocompatibilidad en campos raíz
    if (normalizedData.metas.length > 0) {
      normalizedData.meta_individual = normalizedData.metas[0].meta_individual;
      normalizedData.meta_institucional = normalizedData.metas[0].meta_institucional;
    }

    // Log de actividad para auditoría
    await logActivity({
      teacherEmail: session.user.email,
      action: 'pmc_surgical_meta_normalization',
      entityType: 'pmc_projects',
      entityId: id,
      success: true,
    });

    return NextResponse.json({
      success: true,
      tipo_meta,
      normalized: normalizedData,
    });
  } catch (error) {
    logger.error('[normalize-meta] Unexpected error:', error);
    return NextResponse.json(
      { error: (error as Error).message || 'Error interno del servidor al normalizar la meta' },
      { status: 500 }
    );
  }
}
