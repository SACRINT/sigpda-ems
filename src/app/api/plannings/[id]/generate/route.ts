import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { 
  getTeacherByEmail, 
  getPlanningById, 
  updatePlanningContent,
  getProgramByUacAndSemester,
  getFfeContinuity,
  getAuditResultByPlanningId,
} from '@/lib/db';
import { generateStreamWithRotation, resolveUserIsPremium, logActivity } from '@/lib/ai-provider';
import { SYSTEM_PROMPT } from '@/lib/prompts/system-prompt';
import { logger } from '@/lib/logger';
import { buildUserPrompt } from '@/lib/prompts/build-prompt';
import { parseAIResponse } from '@/lib/ai-response-parser';
import { PlanningContentSchema, type PlanningContentDTO } from '@/lib/ai-schemas';
import { getUserLibraryContext } from '@/lib/context-extractor';
import { searchCurriculum } from '@/lib/rag-curricular';
import { extractIdempotencyKey, checkIdempotencyKey, createIdempotencyKey } from '@/lib/idempotency';
import { evaluatePlanningQuality } from '@/lib/planning/quality-pipeline';
import type { ExtractedPdfData, TeacherContext, GeneratedPlanningContent } from '@/types/planning';
import type { RagContext } from '@/lib/rag-curricular';

export const runtime = 'nodejs';
export const maxDuration = 120;

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

    const { id } = await params;
    const planning = await getPlanningById(id, teacher.id);
    if (!planning) {
      return NextResponse.json({ error: 'Planeación no encontrada' }, { status: 404 });
    }

    // Mejora #24: Verificación de Idempotencia y Deduplicación
    const idempotencyKey = extractIdempotencyKey(request);
    const cachedResult = await checkIdempotencyKey(idempotencyKey, teacher.id, `/api/plannings/${id}/generate`);
    if (cachedResult) {
      if (typeof cachedResult === 'string') {
        return new Response(cachedResult, {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'X-Idempotency-Hit': 'true',
          },
        });
      }
      return NextResponse.json(cachedResult, {
        headers: { 'X-Idempotency-Hit': 'true' },
      });
    }

    const body = await request.json();
    const { extractedData, context } = body as {
      extractedData: ExtractedPdfData;
      context: TeacherContext;
    };

    if (!extractedData || !context) {
      return NextResponse.json(
        { error: 'Faltan datos requeridos: extractedData y context' },
        { status: 400 }
      );
    }

    // Hydrate paecOperationalActivity from DB if missing in context payload
    const existingContent = planning.content_json as Record<string, unknown> | null;
    const existingSectionI = existingContent?.sectionI as Record<string, unknown> | undefined;
    if (!context.paecOperationalActivity && existingSectionI?.paecOperationalActivity) {
      context.paecOperationalActivity = existingSectionI.paecOperationalActivity as TeacherContext['paecOperationalActivity'];
      if (context.usePaecActivity === undefined) {
        context.usePaecActivity = true;
      }
    }

    // 1. Consultar programa auténtico oficial de programs_catalog
    const officialProgram = await getProgramByUacAndSemester(
      planning.uac_name || extractedData.uacName,
      planning.semester,
      planning.component,
      context.subsystem
    );

    // 2. Si es FFE optativa o semestre 5/6, consultar continuidad
    let continuityInfo = null;
    if (planning.component === 'ext_optativo' || planning.semester === 5 || planning.semester === 6) {
      continuityInfo = await getFfeContinuity(planning.uac_name || extractedData.uacName);
    }

    // 3. Consultar si hay retroalimentación de auditoría pedagógica previa
    const previousAudit = await getAuditResultByPlanningId(id);
    const auditFeedback = previousAudit ? {
      overall_score: previousAudit.overall_score,
      compliance_level: previousAudit.compliance_level,
      findings: previousAudit.findings,
      recommendations: previousAudit.recommendations,
    } : null;

    // 4. RAG Curricular: recuperar chunks semánticos relevantes (fail-safe, 3s timeout)
    let ragContext: RagContext | null = null;
    try {
      const uacQuery = planning.uac_name || extractedData.uacName || '';
      const ragPromise = searchCurriculum(uacQuery, {
        semester: planning.semester as number,
        component: planning.component as string,
        subsystem: context.subsystem,
        matchCount: 4,
      });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('RAG timeout')), 3000)
      );
      ragContext = await Promise.race([ragPromise, timeoutPromise]);
      const chunkCount = ragContext?.chunks?.length ?? 0;
      logger.info(`[RAG] Found ${chunkCount} curriculum chunks for "${uacQuery}"`);
    } catch (ragErr) {
      logger.warn('[RAG] Skipped (fail-safe):', { message: (ragErr as Error).message });
      ragContext = null;
    }

    // 5. Construir prompt con catálogo auténtico, RAG y feedback de auditoría
    const userPrompt = buildUserPrompt(
      extractedData,
      context,
      planning.semester as number,
      planning.component as string,
      officialProgram,
      auditFeedback,
      continuityInfo,
      ragContext
    );

    const libraryContext = await getUserLibraryContext(session.user.email!);

    // NOTA: La normativa oficial NO se inyecta en planeaciones didácticas de aula.
    // Decisión de diseño institucional: solo PMC y PIPS llevan fundamentación jurídica.

    let fullUserPrompt = userPrompt;
    if (libraryContext) {
      fullUserPrompt += `\n\n${libraryContext}`;
    }

    const teacherEmail = session.user.email!;
    const encoder = new TextEncoder();

    // ReadableStream: feed AI chunks to the frontend
    const stream = new ReadableStream({
      async start(controller) {
        let accumulatedText = '';
        try {
          const isPremium = await resolveUserIsPremium(teacher.id);
          const textGenerator = generateStreamWithRotation(SYSTEM_PROMPT, fullUserPrompt, teacher.id, isPremium);
          
          for await (const chunk of textGenerator) {
            accumulatedText += chunk;
            controller.enqueue(encoder.encode(chunk));
          }

          // Once generation is finished, parse and save to database
          try {
            const parseResult = parseAIResponse<PlanningContentDTO>(accumulatedText, PlanningContentSchema, {
              contextName: 'plannings-generate-stream',
            });

            if (!parseResult.success) {
              throw new Error(parseResult.error);
            }

            const parsedContent = parseResult.data;
            
            // Persistir la actividad operativa del PAEC en sectionI del content_json
            if (!parsedContent.sectionI) {
              parsedContent.sectionI = {};
            }
            if (context.paecOperationalActivity && context.usePaecActivity !== false) {
              parsedContent.sectionI.paecOperationalActivity = context.paecOperationalActivity;
            } else if (existingSectionI?.paecOperationalActivity) {
              parsedContent.sectionI.paecOperationalActivity = existingSectionI.paecOperationalActivity;
            }

            await updatePlanningContent(id, teacher.id, parsedContent);

            // Evaluación automática mediante el pipeline determinista de calidad MCCEMS
            try {
              const qualityReport = evaluatePlanningQuality({
                uacName: planning.uac_name || extractedData.uacName,
                metodologiaActiva: planning.metodologia_activa || context.metodologiaActiva,
                contentJson: parsedContent as unknown as GeneratedPlanningContent,
                sequenceJson: planning.sequence_json,
              });
              logger.info(`[Quality Pipeline] Evaluated planning ${id}: score=${qualityReport.score}, status=${qualityReport.status}`);
            } catch (qErr) {
              logger.warn('[Quality Pipeline] Could not evaluate planning quality:', qErr);
            }

            // Send Realtime / In-App Notification (Phase 8A.1)
            try {
              const { sendNotification } = await import('@/lib/notifications');
              await sendNotification({
                userId: teacher.id,
                type: 'planeacion_ready',
                title: 'Planeación Generada con Éxito',
                message: `Tu planeación para ${planning.uac_name || 'tu asignatura'} (${planning.semester}° Semestre) está lista para revisión.`,
                link: `/planeacion/${id}`,
                severity: 'success',
                channels: ['in_app'],
                metadata: {
                  planningId: id,
                  uacName: planning.uac_name,
                  semester: planning.semester,
                  component: planning.component,
                  email: teacherEmail,
                },
              });
            } catch (notifErr) {
              logger.warn('Could not dispatch planeacion_ready notification:', { error: notifErr });
            }

            // Log successful generation
            await logActivity({
              teacherEmail,
              action: 'generate_planning',
              entityType: 'planning',
              entityId: id,
              success: true,
            });

            // Mejora #24: Guardar resultado en key de idempotencia
            if (idempotencyKey) {
              await createIdempotencyKey(
                idempotencyKey,
                teacher.id,
                `/api/plannings/${id}/generate`,
                accumulatedText
              );
            }
          } catch (dbErr) {
            logger.error('Failed to parse or save accumulated JSON stream to database:', dbErr);
          }


          controller.close();
        } catch (streamErr) {
          const errMsg = streamErr instanceof Error ? streamErr.message : 'Error desconocido al generar';
          logger.error('Stream generation error:', errMsg);
          // Send the error as a readable marker through the stream so the frontend can show it
          controller.enqueue(encoder.encode(`__ERROR__:${errMsg}`));
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    logger.error('Generate planning error:', error);
    return NextResponse.json(
      { error: message || 'Error al generar la planeación' },
      { status: 500 }
    );
  }
}
