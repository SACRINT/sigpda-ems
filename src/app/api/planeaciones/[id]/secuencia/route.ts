import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { neon } from '@neondatabase/serverless';
import { getAIProvider } from '@/lib/ai-provider';
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

    const systemPrompt = `Eres un Diseñador Curricular Senior y Especialista en Didáctica del Bachillerato General Estatal (DBEPA Puebla / MCCEMS).
Tu tarea es generar la SECUENCIA DIDÁCTICA MICRO detallada para cada una de las ${sessionsCount} sesiones de 50 minutos del Bloque/Actividad ${blockIndex + 1}.

REQUISITOS PEDAGÓGICOS ESTRICTOS:
1. Debes generar exactamente ${sessionsCount} sesiones numeradas del 1 al ${sessionsCount}.
2. Distribución de momentos pedagógicos:
   - Sesiones 1 a ${aperturaCount}: Fase de "Apertura" (encuadre, saberes previos, problematización y normas de seguridad).
   - Sesiones ${aperturaCount + 1} a ${aperturaCount + desarrolloCount}: Fase de "Desarrollo" (análisis conceptual, fundamentación, prácticas guiadas en taller/aula, resolución de problemas y elaboración de evidencias intermedias).
   - Sesiones ${aperturaCount + desarrolloCount + 1} a ${sessionsCount}: Fase de "Cierre" (integración del producto final, coevaluación con rúbricas/listas de cotejo, evaluación sumativa y metacognición).
3. Cada sesión debe tener un título pedagógico situado y concreto, actividades claras para el rol del docente y rol del estudiante, y la evidencia o producto tangible generado en esos 50 minutos.
4. Si se especifican los Tres Saberes (Saber, Saber Hacer, Saber Ser), debes incorporarlos de manera secuencial a lo largo del desarrollo.

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

Genera la secuencia didáctica completa de exactamente ${sessionsCount} sesiones estructurada en JSON.`;

    const ai = await getAIProvider();
    const responseText = await ai.generate(systemPrompt, userPrompt, { temperature: 0.2 });

    let parsed: any;
    try {
      const cleanJson = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleanJson);
    } catch (err) {
      console.error('Error parseando JSON de secuencia didáctica:', responseText);
      throw new Error('La IA devolvió un formato inválido para la secuencia didáctica.');
    }

    const rawSessions: any[] = Array.isArray(parsed.sessions) ? parsed.sessions : [];
    if (rawSessions.length === 0) {
      throw new Error('La IA no generó las sesiones requeridas.');
    }

    const formattedSessions: SecuenciaSesion[] = rawSessions.map((s, idx) => {
      const sNum = idx + 1;
      let phase: 'Apertura' | 'Desarrollo' | 'Cierre' = 'Desarrollo';
      if (sNum <= aperturaCount) phase = 'Apertura';
      else if (sNum > sessionsCount - cierreCount) phase = 'Cierre';

      return {
        sessionNum: sNum,
        totalSessions: sessionsCount,
        phase: s.phase === 'Apertura' || s.phase === 'Desarrollo' || s.phase === 'Cierre' ? s.phase : phase,
        title: s.title || `Sesión ${sNum}: Construcción de aprendizajes`,
        teachingActivity: s.teachingActivity || 'Mediación pedagógica y acompañamiento continuo.',
        learningActivity: s.learningActivity || 'Participación activa y desarrollo de actividades formativas.',
        evidence: s.evidence || 'Evidencia de trabajo en libreta o bitácora de taller.',
        evaluation: s.evaluation || 'Evaluación formativa continua.',
      };
    });

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
