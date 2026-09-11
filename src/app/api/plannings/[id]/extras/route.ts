import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  getTeacherByEmail,
  getPlanningById,
  getPlanningExtras,
  createPlanningExtra,
  deletePlanningExtra,
} from '@/lib/db';
import { generateExtraText } from '@/lib/gemini';
import { logActivity } from '@/lib/ai-provider';
import {
  SYSTEM_PROMPT_EXTRAS,
  RUBRIC_PROMPT_TEMPLATE,
  MATERIAL_PROMPT_TEMPLATE,
  LESSON_PLAN_PROMPT_TEMPLATE,
  PRACTICE_GUIDE_PROMPT_TEMPLATE,
} from '@/lib/prompts/extras-prompts';
import { obtenerMetodologiaPorId } from '@/lib/catalogo-metodologias';
import type { GeneratedPlanningContent, SecuenciaBloque } from '@/types/planning';
import { generateBlockSessions } from '@/lib/session-progression-engine';

export const runtime = 'nodejs';
export const maxDuration = 60; // Claude call could take up to 60s

// ── GET: List all extras for a planning ──────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const extras = await getPlanningExtras(id, teacher.id);
    return NextResponse.json(extras);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('GET extras error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ── POST: Generate and save a new extra ──────────────────────────────
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const teacher = await getTeacherByEmail(session.user.email);
    if (!teacher) {
      return NextResponse.json({ error: 'Docente no encontrado' }, { status: 404 });
    }

    const { id: planningId } = await params;
    const planning = await getPlanningById(planningId, teacher.id);
    if (!planning) {
      return NextResponse.json({ error: 'Planeación no encontrada' }, { status: 404 });
    }

    const body = await request.json();
    const {
      type,
      title,
      keyIndex = null,
      activityName = '',
      evidence = '',
      sessionNum = 1,
      totalSessions = 18,
      practiceNumber = 1,
      practiceTitle = '',
      sessionTopic = '',
      sessionFocus = '',
      teachingActivity = '',
      learningActivity = '',
      evaluation = '',
      phase = '',
    } = body as {
      type: 'rubric' | 'checklist' | 'material' | 'lesson_plan' | 'practice_guide';
      title: string;
      keyIndex?: number | null;
      activityName?: string;
      evidence?: string;
      sessionNum?: number;
      totalSessions?: number;
      practiceNumber?: number;
      practiceTitle?: string;
      sessionTopic?: string;
      sessionFocus?: string;
      teachingActivity?: string;
      learningActivity?: string;
      evaluation?: string;
      phase?: string;
    };

    if (!type || !title) {
      return NextResponse.json({ error: 'Faltan campos requeridos: type y title' }, { status: 400 });
    }

    const contentJson = planning.content_json as GeneratedPlanningContent | null;
    const paecProblem = planning.paec_context || 'Problemática comunitaria no especificada';

    let userPrompt = '';

    if (type === 'rubric' || type === 'checklist') {
      const instrumentType = type === 'rubric' ? 'Rúbrica analítica' : 'Lista de cotejo';
      userPrompt = RUBRIC_PROMPT_TEMPLATE(
        planning.uac_name,
        activityName || `Actividad Clave ${keyIndex !== null ? keyIndex + 1 : ''}`,
        evidence || 'Evidencia de desempeño/producto',
        instrumentType,
        planning.metodologia_activa || undefined
      );
    } else if (type === 'material') {
      const uacContext = `
UAC: ${planning.uac_name}
Propósito Formativo: ${contentJson?.sectionII?.purpose || ''}
Resultados de Aprendizaje: ${(contentJson?.sectionII?.learningOutcomes || []).join(' | ')}
      `.trim();
      userPrompt = MATERIAL_PROMPT_TEMPLATE(
        planning.uac_name,
        title,
        paecProblem,
        uacContext,
        planning.metodologia_activa || undefined
      );
    } else if (type === 'lesson_plan') {
      const studentContext = planning.extracted_data?.studentContext || 'Estudiantes de bachillerato general estatal';
      const learningOutcome =
        keyIndex !== null && contentJson?.sectionII?.learningOutcomes?.[keyIndex]
          ? contentJson.sectionII.learningOutcomes[keyIndex]
          : 'Resultado de aprendizaje general';

      // ── Recuperar datos de la secuencia didáctica y planeación con fallback automático ──
      const seqData = ((planning as any).sequence_json || (planning as any).sequenceJson) as Record<number, SecuenciaBloque> | null;
      const currentBlockSeq = keyIndex !== null && seqData ? seqData[keyIndex] : null;
      let sessionFromSeq = currentBlockSeq?.sessions?.find((s) => s.sessionNum === sessionNum);

      const currentBlockActivity = keyIndex !== null ? contentJson?.sectionIV?.activities?.[keyIndex] : null;

      // Si la secuencia aún no se ha guardado en BD con IA, usar el motor heurístico como fallback
      if (!sessionFromSeq && currentBlockActivity) {
        const isLaboral = planning.component === 'laboral';
        const fallbackSessions = generateBlockSessions(currentBlockActivity, keyIndex!, totalSessions, learningOutcome, isLaboral);
        sessionFromSeq = fallbackSessions.find((s) => s.sessionNum === sessionNum) as any;
      }

      const resolvedPhase = phase || sessionFromSeq?.phase || (sessionNum === 1 ? 'Apertura' : 'Desarrollo');
      const resolvedTopic = sessionTopic || sessionFromSeq?.title || '';
      const resolvedTeaching = teachingActivity || sessionFromSeq?.teachingActivity || '';
      const resolvedLearning = learningActivity || sessionFromSeq?.learningActivity || '';
      const resolvedEvidence = evidence || sessionFromSeq?.evidence || '';
      const resolvedEvaluation = evaluation || sessionFromSeq?.evaluation || '';

      userPrompt = LESSON_PLAN_PROMPT_TEMPLATE(
        planning.uac_name,
        activityName || `Actividad Clave ${keyIndex !== null ? keyIndex + 1 : ''}`,
        sessionNum,
        totalSessions,
        paecProblem,
        studentContext,
        learningOutcome,
        planning.metodologia_activa || undefined,
        resolvedTopic || undefined,
        sessionFocus || undefined,
        {
          phase: resolvedPhase,
          teachingActivity: resolvedTeaching,
          learningActivity: resolvedLearning,
          evidence: resolvedEvidence,
          evaluation: resolvedEvaluation,
          saberes: currentBlockActivity?.saberes || null,
          macroApertura: currentBlockActivity?.apertura?.activities,
          macroEjecucion: currentBlockActivity?.ejecucion?.activities,
          macroConclusion: currentBlockActivity?.conclusion?.activities,
        }
      );
    } else if (type === 'practice_guide') {
      // ── Guía de Práctica para el Estudiante (Fase 3) ──────────────────────
      const studentContext = planning.extracted_data?.studentContext || 'Estudiantes de bachillerato (15-18 años) en Puebla, México';
      const learningOutcome =
        keyIndex !== null && contentJson?.sectionII?.learningOutcomes?.[keyIndex]
          ? contentJson.sectionII.learningOutcomes[keyIndex]
          : 'Desarrollar competencias técnicas y socioemocionales aplicadas al contexto local';

      // Fetch methodology phases from the catalog
      let metodologiaFases: string[] | undefined;
      if (planning.metodologia_activa) {
        const metodologiaObj = obtenerMetodologiaPorId(planning.metodologia_activa);
        metodologiaFases = metodologiaObj?.fases;
      }

      const currentBlockActivity = keyIndex !== null ? contentJson?.sectionIV?.activities?.[keyIndex] : null;

      // ── Recuperar sesiones de desarrollo para alinear el procedimiento de la guía ──
      const seqData = ((planning as any).sequence_json || (planning as any).sequenceJson) as Record<number, SecuenciaBloque> | null;
      let blockSessions = keyIndex !== null && seqData ? seqData[keyIndex]?.sessions : null;

      if ((!blockSessions || blockSessions.length === 0) && currentBlockActivity) {
        const isLaboral = planning.component === 'laboral';
        blockSessions = generateBlockSessions(currentBlockActivity, keyIndex!, currentBlockActivity.hours || 12, learningOutcome, isLaboral) as any;
      }

      const devSessions = (blockSessions || []).filter((s) => s.phase === 'Desarrollo');
      const devSessionsSummary = devSessions.length > 0
        ? devSessions.map((s) => `• Sesión ${s.sessionNum}: ${s.title} — [Estudiante]: ${s.learningActivity || (s as any).description || 'Práctica guiada'} (Evidencia: ${s.evidence || 'Reporte'})`).join('\n')
        : undefined;

      const studentMaterials = contentJson?.sectionVI?.studentMaterials || [];
      const references = contentJson?.sectionVI?.references || [];

      const resolvedPracticeTitle = practiceTitle || activityName || `Práctica ${practiceNumber}: ${planning.uac_name}`;

      userPrompt = PRACTICE_GUIDE_PROMPT_TEMPLATE(
        planning.uac_name,
        activityName || `Actividad Clave ${keyIndex !== null ? keyIndex + 1 : practiceNumber}`,
        practiceNumber,
        resolvedPracticeTitle,
        paecProblem,
        learningOutcome,
        studentContext,
        planning.metodologia_activa || undefined,
        metodologiaFases,
        {
          saberes: currentBlockActivity?.saberes || null,
          plannedEjecucion: currentBlockActivity?.ejecucion?.activities,
          devSessionsSummary,
          plannedMaterials: studentMaterials,
          plannedReferences: references,
        }
      );
    } else {
      return NextResponse.json({ error: 'Tipo de recurso no válido' }, { status: 400 });
    }

    // Call AI via wrapper (generateExtraText delegates to getAIProvider())
    console.log(`Generating extra of type ${type} using AI Provider...`);
    const generatedMarkdown = await generateExtraText(SYSTEM_PROMPT_EXTRAS, userPrompt);

    // Save to Database
    const newExtra = await createPlanningExtra(
      {
        planningId,
        type,
        title,
        keyIndex,
        contentText: generatedMarkdown,
      },
      teacher.id
    );

    // Log activity
    await logActivity({
      teacherEmail: session.user.email!,
      action: `generate_extra_${type}`,
      entityType: 'planning',
      entityId: planningId,
      success: true,
    });

    return NextResponse.json({ success: true, extra: newExtra });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error al generar recurso extra';
    console.error('POST extras error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ── DELETE: Delete an extra ──────────────────────────────────────────
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const teacher = await getTeacherByEmail(session.user.email);
    if (!teacher) {
      return NextResponse.json({ error: 'Docente no encontrado' }, { status: 404 });
    }

    const url = new URL(request.url);
    const extraId = url.searchParams.get('extraId');

    if (!extraId) {
      return NextResponse.json({ error: 'Falta extraId en los parámetros' }, { status: 400 });
    }

    await deletePlanningExtra(extraId, teacher.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error al eliminar recurso extra';
    console.error('DELETE extras error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
