import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { 
  getTeacherByEmail, 
  getPlanningById, 
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
import { getInstitutionalContext } from '@/lib/institutional-context';
import { searchCurriculum } from '@/lib/rag-curricular';
import { extractIdempotencyKey, checkIdempotencyKey, createIdempotencyKey } from '@/lib/idempotency';
import { evaluatePlanningQuality } from '@/lib/planning/quality-pipeline';
import { validateAndPersistPlanningContent } from '@/lib/planning/planning-persistence';
import {
  repairExtractedDataWithCatalog,
  enforceOfficialProgresiones,
} from '@/lib/planning/progresiones-enforcer';
import { resolverIdentidadEscolar } from '@/lib/school-identity';
import { resolveFechasCortes } from '@/lib/fechas-cortes';
import { diversificarInstrumentosEvaluacion } from '@/lib/catalogo-instrumentos';
import { resolveSemesterWeeks, resolveWeeklyHours } from '@/lib/guide-engine/content-budget';
import { ensureRetoSituadoCalidad } from '@/lib/planning-evaluator';
import {
  normalizeEvaluationPercentages,
  sanitizePlanningContent,
} from '@/lib/planning/quality-pipeline';
import { isUpstreamAIError, AI_OUTAGE_USER_MESSAGE } from '@/lib/ai-resilience';
import type { ExtractedPdfData, TeacherContext, GeneratedPlanningContent, FechasCortes } from '@/types/planning';
import type { RagContext } from '@/lib/rag-curricular';

export const runtime = 'nodejs';
export const maxDuration = 300;

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

    const effectiveExtractedData = repairExtractedDataWithCatalog(
      extractedData,
      officialProgram,
      planning.semester as number,
      planning.component as string
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
      effectiveExtractedData,
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
    // La Capa de Conocimiento SEP aporta únicamente dominios metodológico/curricular.
    const rawUacName = planning.uac_name || extractedData.uacName || '';
    const uacSlug = rawUacName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const knowledgeContext = await getInstitutionalContext('planeacion', {
      maxTokens: 850,
      domainBudgets: { metodologico: 350, curricular: 450 },
      uacSlug,
      uacName: rawUacName,
      semester: planning.semester as number,
      contextId: String(planning.id),
    });

    let fullUserPrompt = userPrompt;
    if (knowledgeContext.block) {
      fullUserPrompt += `\n\n${knowledgeContext.block}`;
    }
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
          const textGenerator = generateStreamWithRotation(SYSTEM_PROMPT, fullUserPrompt, teacher.id, isPremium, { jsonMode: true, maxTokens: 32768, timeoutMs: 270000, remainingBudgetMs: 280000 });
          
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

            // Fechas oficiales de cortes: persistencia determinista (no dependen de la IA)
            const fechasCortesPersistidas = context.fechasCortes
              ? resolveFechasCortes(context.fechasCortes)
              : (existingSectionI?.fechasCortes as FechasCortes | undefined);
            if (fechasCortesPersistidas) {
              parsedContent.sectionI.fechasCortes = fechasCortesPersistidas;
            }
            if (!parsedContent.sectionI.teacherName) {
              if (context.teacherName) {
                parsedContent.sectionI.teacherName = context.teacherName;
              } else if (typeof existingSectionI?.teacherName === 'string') {
                parsedContent.sectionI.teacherName = existingSectionI.teacherName;
              }
            }

            // Firmas institucionales: persistencia determinista desde el Paso 3
            const directorName = context.directorName?.trim()
              || (typeof existingSectionI?.directorName === 'string' ? existingSectionI.directorName : '');
            if (directorName) {
              parsedContent.sectionI.directorName = directorName;
            }

            const supervisorName = context.supervisorName?.trim()
              || (typeof existingSectionI?.supervisorName === 'string' ? existingSectionI.supervisorName : '');
            if (supervisorName) {
              parsedContent.sectionI.supervisorName = supervisorName;
            }

            const identidad = resolverIdentidadEscolar({
              schoolName: context.schoolName || existingSectionI?.schoolName || teacher.school_name,
              cct: context.cct || existingSectionI?.cct || teacher.cct,
              municipality:
                context.municipality || existingSectionI?.municipality || teacher.municipality,
              schoolZone: context.schoolZone || existingSectionI?.schoolZone,
            });
            if (identidad.schoolName) parsedContent.sectionI.schoolName = identidad.schoolName;
            if (identidad.cct) parsedContent.sectionI.cct = identidad.cct;
            if (identidad.municipality) parsedContent.sectionI.municipality = identidad.municipality;
            if (identidad.schoolZone) parsedContent.sectionI.schoolZone = identidad.schoolZone;

            // Hidratación determinista de metadatos oficiales Sección I (evita fallos fail-closed por omisiones del LLM)
            const resolvedSubsystem =
              (typeof parsedContent.sectionI.subsystem === 'string' && parsedContent.sectionI.subsystem.trim()) ||
              context.subsystem ||
              officialProgram?.subsystem ||
              (typeof existingSectionI?.subsystem === 'string' && existingSectionI.subsystem.trim()) ||
              'Bachillerato General Estatal (BGE)';
            const resolvedUacName =
              (typeof parsedContent.sectionI.uacName === 'string' && parsedContent.sectionI.uacName.trim()) ||
              planning.uac_name ||
              effectiveExtractedData.uacName ||
              officialProgram?.uac_name ||
              '';
            const resolvedSemester =
              Number(planning.semester || existingSectionI?.semester || parsedContent.sectionI.semester) || 1;
            const resolvedComponent =
              (typeof parsedContent.sectionI.component === 'string' && parsedContent.sectionI.component.trim()) ||
              (planning.component as string) ||
              'fundamental';
            const resolvedTotalHoursRaw =
              Number(
                officialProgram?.total_hours ||
                  effectiveExtractedData.totalHours ||
                  existingSectionI?.totalHours ||
                  parsedContent.sectionI.totalHours ||
                  0
              ) || 0;
            const extractedWeekly = (effectiveExtractedData as unknown as { totalHoursWeekly?: number }).totalHoursWeekly;
            const resolvedWeeklyHours = resolveWeeklyHours({
              uacName: resolvedUacName,
              subsystem: resolvedSubsystem,
              totalHours: resolvedTotalHoursRaw > 0 ? resolvedTotalHoursRaw : undefined,
              totalHoursWeekly:
                typeof parsedContent.sectionI.totalHoursWeekly === 'number' && parsedContent.sectionI.totalHoursWeekly > 0
                  ? parsedContent.sectionI.totalHoursWeekly
                  : typeof extractedWeekly === 'number' && extractedWeekly > 0
                    ? extractedWeekly
                    : undefined,
              extractedData: effectiveExtractedData as unknown as Record<string, unknown>,
            });
            const resolvedTotalHours =
              resolvedTotalHoursRaw > 0
                ? resolvedTotalHoursRaw
                : resolvedWeeklyHours * resolveSemesterWeeks(resolvedSubsystem);

            parsedContent.sectionI.uacName = resolvedUacName;
            if (!parsedContent.sectionI.subjectName) {
              parsedContent.sectionI.subjectName = resolvedUacName;
            }
            parsedContent.sectionI.semester = resolvedSemester;
            parsedContent.sectionI.component = resolvedComponent;
            parsedContent.sectionI.subsystem = resolvedSubsystem;
            parsedContent.sectionI.totalHours = resolvedTotalHours;
            parsedContent.sectionI.totalHoursWeekly = resolvedWeeklyHours;
            if (!parsedContent.sectionI.teacherName) {
              parsedContent.sectionI.teacherName =
                session.user?.name || (typeof (teacher as { name?: string }).name === 'string' ? (teacher as { name?: string }).name : '') || 'Docente Titular';
            }
            if (!parsedContent.sectionI.schoolName) {
              parsedContent.sectionI.schoolName = 'Plantel EMS';
            }
            if (!parsedContent.sectionI.groups) {
              parsedContent.sectionI.groups =
                (context.groupInfo && context.groupInfo.trim()) ||
                (typeof existingSectionI?.groups === 'string' && existingSectionI.groups.trim()) ||
                'Grupo Único';
            }
            if (!parsedContent.sectionI.applicationPeriod) {
              parsedContent.sectionI.applicationPeriod =
                (context.applicationPeriod && context.applicationPeriod.trim()) ||
                (typeof existingSectionI?.applicationPeriod === 'string' && existingSectionI.applicationPeriod.trim()) ||
                'Semestre 2026-2027';
            }
            if (!parsedContent.sectionI.schoolYear) {
              parsedContent.sectionI.schoolYear = '2026-2027';
            }
            if (!parsedContent.sectionI.metodologiaActiva && (planning.metodologia_activa || context.metodologiaActiva)) {
              parsedContent.sectionI.metodologiaActiva = planning.metodologia_activa || context.metodologiaActiva;
            }

            // Garantizar Reto Situado 4/4 antes de la validación Anexo 12
            if (parsedContent.sectionII && typeof parsedContent.sectionII === 'object') {
              parsedContent.sectionII.retoSituado = ensureRetoSituadoCalidad(
                parsedContent.sectionII.retoSituado,
                {
                  municipality: context.municipality || (parsedContent.sectionI.municipality as string | undefined),
                  locality: context.locality,
                  region: context.region,
                  schoolName: parsedContent.sectionI.schoolName as string | undefined,
                  uacName: resolvedUacName,
                  paecProblem: context.paecProblem || planning.paec_context || undefined,
                }
              );
            }

            // Post-procesamiento determinista para garantizar 1 bloque por Progresión oficial (verbatim) en 5.º/6.º semestre
            enforceOfficialProgresiones(
              parsedContent as unknown as Record<string, unknown>,
              officialProgram,
              effectiveExtractedData,
              planning.semester as number,
              planning.component as string
            );

            // Normalización y diversificación determinista de evaluación (Sección V) + Bitácora 50-20-30
            if (!parsedContent.sectionV || typeof parsedContent.sectionV !== 'object') {
              parsedContent.sectionV = {};
            }
            parsedContent.sectionV.evaluations = normalizeEvaluationPercentages(
              Array.isArray(parsedContent.sectionV.evaluations) ? parsedContent.sectionV.evaluations : undefined
            ).map((ev) => ({
              ...ev,
              agent: (typeof ev.agent === 'string' && ev.agent.trim().length >= 3 ? ev.agent : 'Heteroevaluación docente'),
              evidence: (typeof ev.evidence === 'string' && ev.evidence.trim().length >= 5 ? ev.evidence : `Evidencia de ${resolvedUacName}`),
              instrument: (typeof ev.instrument === 'string' && ev.instrument.trim().length >= 3 ? ev.instrument : 'Rúbrica analítica'),
            }));
            parsedContent.sectionV.evaluations = diversificarInstrumentosEvaluacion(
              parsedContent.sectionV.evaluations,
              {
                uacName: resolvedUacName,
                componente: resolvedComponent,
                metodologia: planning.metodologia_activa || context.metodologiaActiva,
                activities: parsedContent.sectionIV?.activities?.map((a: { name?: string; contenidoFormativo?: string }) => ({
                  name: a.name,
                  contenidoFormativo: a.contenidoFormativo,
                })),
              }
            );
            const rawBitacora = (parsedContent.sectionV.bitacora502030 && typeof parsedContent.sectionV.bitacora502030 === 'object')
              ? (parsedContent.sectionV.bitacora502030 as Record<string, unknown>)
              : {};
            parsedContent.sectionV.bitacora502030 = {
              ...rawBitacora,
              criterioProceso50:
                typeof rawBitacora.criterioProceso50 === 'string' && rawBitacora.criterioProceso50.trim().length >= 10
                  ? rawBitacora.criterioProceso50
                  : `Seguimiento formativo continuo en actividades de ${resolvedUacName} (50%)`,
              evidenciaColectiva20:
                typeof rawBitacora.evidenciaColectiva20 === 'string' && rawBitacora.evidenciaColectiva20.trim().length >= 5
                  ? rawBitacora.evidenciaColectiva20
                  : 'Producto colaborativo de corte PAEC (20%)',
              evidenciaIndividual30:
                typeof rawBitacora.evidenciaIndividual30 === 'string' && rawBitacora.evidenciaIndividual30.trim().length >= 5
                  ? rawBitacora.evidenciaIndividual30
                  : 'Resolución individual contextualizada (30%)',
              ticketSalidaPregunta:
                typeof rawBitacora.ticketSalidaPregunta === 'string' && rawBitacora.ticketSalidaPregunta.trim().length >= 5
                  ? rawBitacora.ticketSalidaPregunta
                  : `¿Qué concepto de ${resolvedUacName} aplicaste hoy en tu contexto?`,
            };

            const sanitizedContent = sanitizePlanningContent(parsedContent, {
              fallbackCct: typeof parsedContent.sectionI.cct === 'string' ? parsedContent.sectionI.cct : undefined,
            });

            // Gate Pedagógico Dual determinista (Anexo 12 USICAMM + DBEPA Quality Gate)
            const persistResult = await validateAndPersistPlanningContent(
              id,
              teacher.id,
              sanitizedContent as unknown as GeneratedPlanningContent,
              {
                isNewOrStrictMode: true,
                context: {
                  uacName: resolvedUacName || undefined,
                  semester: resolvedSemester,
                  component: resolvedComponent,
                  subsystem: resolvedSubsystem,
                  weeklyHours: resolvedWeeklyHours,
                  totalHours: resolvedTotalHours,
                },
              }
            );

            if (!persistResult.success) {
              const failureDetails = (persistResult.criticalFailures || [])
                .map((c) => `${c.id}: ${c.label}`)
                .join('; ');
              logger.error(
                `[Anexo12] Persistencia bloqueada para planeación ${id}: ${persistResult.error || 'Fallo crítico'} [${failureDetails}]`
              );
              await logActivity({
                teacherEmail,
                action: 'generate_planning',
                entityType: 'planning',
                entityId: id,
                success: false,
              }).catch(() => {});
              const suffix = failureDetails ? ` Detalle: ${failureDetails.slice(0, 220)}` : '';
              controller.enqueue(
                encoder.encode(
                  `\n__ERROR__:${persistResult.error || 'La planeación generada no superó la validación normativa Anexo 12 y no se guardó.'}${suffix}`
                )
              );
              controller.close();
              return;
            }

            if (persistResult.anexo12Report.ok) {
              logger.info(
                `[Anexo12] Planeación ${id} conforme — score ${persistResult.anexo12Report.score}/100 (${persistResult.anexo12Report.passed}/${persistResult.anexo12Report.total}).`
              );
            } else {
              logger.warn(
                `[Anexo12] Planeación ${id} advertencias — ${persistResult.anexo12Report.criticalFailures} fallo(s) crítico(s), score ${persistResult.anexo12Report.score}/100.`
              );
            }

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
            // No cerrar en silencio: el cliente debe saber que NO se guardó la planeación
            const dbMsg = dbErr instanceof Error ? dbErr.message : 'Error desconocido';
            controller.enqueue(
              encoder.encode(`\n__ERROR__:No se pudo validar o guardar la planeación generada (${dbMsg.slice(0, 160)}). Intenta de nuevo.`)
            );
          }


          controller.close();
        } catch (streamErr) {
          const errMsg = streamErr instanceof Error ? streamErr.message : 'Error desconocido al generar';
          const userMsg = isUpstreamAIError(streamErr) ? AI_OUTAGE_USER_MESSAGE : errMsg;
          logger.error('Stream generation error:', errMsg);
          // Send the error as a readable marker through the stream so the frontend can show it
          controller.enqueue(encoder.encode(`__ERROR__:${userMsg}`));
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
