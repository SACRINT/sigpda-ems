/**
 * Block Guide Orchestrator (Orquestador Editorial de Libros de Trabajo)
 * SIGPDA-EMS · SEMS Puebla MCCEMS 2026-2027
 *
 * Coordina el pipeline completo de generación del Libro-Cuaderno de Trabajo
 * para un bloque formativo específico:
 * 1. Obtiene planeación y perfil docente desde Neon PostgreSQL.
 * 2. Ejecuta curriculum-context-agent para contextualización curricular oficial.
 * 3. Ejecuta blueprint-architect-agent para dosificación de sesiones y misiones.
 * 4. Consulta el repositorio de semillas canónicas para reutilización técnica.
 * 5. Ejecuta en paralelo los 4 redactores con Promise.allSettled().
 * 6. Ejecuta resilience-agent para la matriz formativa "¿Qué hacer si falla?".
 * 7. Ejecuta quality-validator para evaluar calidad y gestionar reintentos selectivos.
 * 8. Reintenta únicamente los redactores que no alcanzaron el estándar (máx 2 reintentos).
 * 9. Ensambla y persiste el ActiveWorkTextbook con versionamiento histórico en workbooks_json.
 * 10. Si qualityScore >= 80, promueve los procedimientos técnicos como nueva semilla canónica.
 */

import {
  getPlanningById,
  getTeacherById,
  getPlanningExtras,
  findCanonicalSeed,
  saveCanonicalSeed,
  saveBlockWorkbook,
  updateWorkbookProgress,
  updateGenerationJobProgress,
  incrementSeedUsage,
  WorkerLeaseLostError,
} from '@/lib/db';
import { logger } from '@/lib/logger';
import { resolveSchoolIdentity } from '@/lib/school-identity';
import { resolveCurricularBlocks } from '@/lib/curricular-blocks';
import { extractCurriculumContext } from './curriculum-context-agent';
import { buildBlockBlueprint } from './blueprint-architect-agent';
import {
  computeContentBudget,
  resolveWeeklyHours,
  validateSessionCoverage,
  countSessionPlanWords,
  WORDS_PER_PAGE,
} from './content-budget';
import { generateFoundationMission } from './writers/foundation-writer';
import { generateLabMission } from './writers/lab-writer';
import { generateProjectMission } from './writers/project-writer';
import { generateEvaluationSection } from './writers/evaluation-writer';
import { generateTroubleshootingMatrix } from './resilience-agent';
import { validateBlockGuideQuality } from './quality-validator';
import {
  evaluatePlanningContentAlignment,
  extractMissingTerms,
  sectionCorpus,
  corpusCoversTerm,
} from './planning-content-alignment';
import { completeSessionPlans, detectFallbackWords, type WriterInput, type WriterOutput, type PlanningActivities } from './writers/writer-contract';
import { validateBlockCrossContamination } from './cross-contamination-guard';
import type {
  ActiveWorkTextbook,
  CanonicalSeed,
  GenerationProgressState,
  ProjectSection,
  EvaluationSection,
  MissionSection,
} from '@/types/work-textbook';
import type {
  Planning,
  TeacherContext,
  CurriculumComponent,
  ExtractedPdfData,
  GeneratedPlanningContent,
  PlanningStatus,
  SecuenciaBloque,
} from '@/types/planning';

interface RawPlanningRow {
  id: string;
  teacher_id: string;
  uac_name: string;
  semester: number;
  component: CurriculumComponent;
  curriculum_name?: string | null;
  paec_context?: string | null;
  paec_project_name?: string | null;
  extracted_data: ExtractedPdfData | null;
  content_json: GeneratedPlanningContent | null;
  status: PlanningStatus;
  created_at: Date;
  updated_at: Date;
  metodologia_activa?: string | null;
  evaluation_json?: unknown | null;
  sequence_json?: Record<number, SecuenciaBloque> | null;
}

export interface OrchestratorOptions {
  customHours?: number;
  maxRetriesPerWriter?: number;
  jobId?: string;
  leaseId?: string;
  signal?: AbortSignal;
  persistWorkbook?: boolean;
  maxBudgetMs?: number;
}

/**
 * Genera el Libro-Cuaderno de Trabajo Activo completo para un bloque curricular.
 */
export async function generateBlockWorkTextbook(
  planningId: string,
  blockIndex: number,
  options: OrchestratorOptions = {}
): Promise<ActiveWorkTextbook> {
  const maxRetries = options.maxRetriesPerWriter ?? 1;
  const jobId = options.jobId;
  const leaseId = options.leaseId;
  const signal = options.signal;
  const startTime = Date.now();
  const MAX_ORCHESTRATOR_BUDGET_MS =
    options.maxBudgetMs ??
    (process.env.JOB_MAX_DURATION_SECONDS
      ? Number(process.env.JOB_MAX_DURATION_SECONDS) * 1000 - 30_000
      : 240_000);

  const writerOutputs: WriterOutput[] = [];

  const checkAbort = () => {
    if (signal?.aborted) {
      throw signal.reason instanceof Error
        ? signal.reason
        : new DOMException('Generation aborted', 'AbortError');
    }
  };

  checkAbort();

  const notifyProgress = async (params: {
    phase: GenerationProgressState['phase'];
    currentStep: string;
    percent: number;
    qualityScore?: number;
    wordCount?: number;
    totalWords?: number;
    error?: string;
  }) => {
    if (signal?.aborted) {
      // Si la señal se abortó pero los 4 redactores ya están completos, no lanzar excepción;
      // permitir avanzar al ensamblado degradado para persistir el mejor borrador.
      if (writerOutputs.length === 4) {
        logger.warn(`[orchestrator] Signal abortada durante fase '${params.phase}', pero redactores ya completados. Continuando ensamblado.`);
        return;
      }
      checkAbort();
    }
    await reportProgress(planningId, blockIndex, params, jobId, leaseId);
  };

  // ── Fase 1: Análisis y Recuperación de Datos ─────────────────────────────
  await notifyProgress({
    phase: 'analyzing',
    currentStep: 'Recuperando planeación docente y contexto curricular...',
    percent: 10,
  });

  const rawPlanning = (await getPlanningById(planningId)) as unknown as RawPlanningRow | null;
  if (!rawPlanning) {
    throw new Error(`[block-guide-orchestrator] Planeación no encontrada: ${planningId}`);
  }

  const teacher = await getTeacherById(rawPlanning.teacher_id);
  const teacherSubsystemRaw = teacher?.subsystem || '';
  const isTeacherBt = teacherSubsystemRaw.toLowerCase().includes('bt') ||
                      teacherSubsystemRaw.toLowerCase().includes('tecnol') ||
                      teacherSubsystemRaw.toLowerCase().includes('cecyte') ||
                      teacherSubsystemRaw.toLowerCase().includes('cbtis');
  const normalizedSubsystem: 'bge' | 'bt' = isTeacherBt ? 'bt' : 'bge';

  const identidadEscolar = resolveSchoolIdentity({
    sectionI: rawPlanning.content_json?.sectionI,
    teacher: {
      schoolName: teacher?.school_name,
      cct: teacher?.cct,
      municipality: teacher?.municipality,
    },
  });

  const teacherContext: TeacherContext = {
    teacherName: rawPlanning.content_json?.sectionI?.teacherName || teacher?.name || 'Docente Titular',
    schoolName: identidadEscolar.schoolName,
    municipality: identidadEscolar.municipality,
    state: 'Puebla',
    region: 'Puebla',
    subsystem: normalizedSubsystem,
    groupInfo: rawPlanning.semester ? `${rawPlanning.semester}° Semestre` : 'Grupo A',
    paecProjectName:
      rawPlanning.paec_project_name ||
      (rawPlanning.content_json?.sectionI as { paecProjectName?: string } | undefined)?.paecProjectName ||
      (rawPlanning.extracted_data as { paecProjectName?: string } | null | undefined)?.paecProjectName ||
      rawPlanning.paec_context ||
      'Proyecto Escolar Comunitario PAEC',
    paecProblem: rawPlanning.paec_context || 'Mejora del entorno escolar y convivencia comunitaria',
    studentContext: 'Estudiantes de educación media superior de Puebla con diversos estilos de aprendizaje.',
  };

  const planning: Planning = {
    id: rawPlanning.id,
    teacherId: rawPlanning.teacher_id || (rawPlanning as any).teacherId || 'teacher-default',
    uacName: rawPlanning.uac_name || (rawPlanning as any).uacName || 'Unidad de Aprendizaje Curricular',
    semester: rawPlanning.semester || 1,
    component: rawPlanning.component || (rawPlanning as any).component || 'fundamental',
    curriculumName: rawPlanning.curriculum_name || (rawPlanning as any).curriculumName || '',
    paecContext: rawPlanning.paec_context || (rawPlanning as any).paecContext || '',
    extractedData: rawPlanning.extracted_data || (rawPlanning as any).extractedData,
    contentJson: rawPlanning.content_json || (rawPlanning as any).contentJson,
    status: rawPlanning.status || 'draft',
    createdAt: rawPlanning.created_at || (rawPlanning as any).createdAt || new Date(),
    updatedAt: rawPlanning.updated_at || (rawPlanning as any).updatedAt || new Date(),
    metodologiaActiva: rawPlanning.metodologia_activa || (rawPlanning as any).metodologiaActiva || undefined,
    evaluationJson: rawPlanning.evaluation_json || (rawPlanning as any).evaluationJson || null,
    sequenceJson: rawPlanning.sequence_json || (rawPlanning as any).sequenceJson || null,
  };

  const curricularBlocks = resolveCurricularBlocks(planning.contentJson);
  const targetBlock = curricularBlocks[blockIndex];
  const currentBlockActivity = targetBlock?.activities[0] || planning.contentJson?.sectionIV?.activities?.[blockIndex];
  const blockName = targetBlock?.title || currentBlockActivity?.name || `Bloque ${blockIndex + 1}`;

  // ── Construcción de PlanningActivities para alineación guía ↔ planeación ──
  const planningActivities: PlanningActivities | undefined = targetBlock
    ? {
        apertura: {
          description: targetBlock.activities.map(a => a.apertura?.activities).filter(Boolean).join(' · '),
          processes: targetBlock.activities.map(a => a.apertura?.processes).filter(Boolean).join(' · '),
          materials: targetBlock.activities.map(a => a.apertura?.materials).filter(Boolean).join(' · '),
        },
        ejecucion: {
          description: targetBlock.activities.map(a => a.ejecucion?.activities).filter(Boolean).join(' · '),
          processes: targetBlock.activities.map(a => a.ejecucion?.processes).filter(Boolean).join(' · '),
          materials: targetBlock.activities.map(a => a.ejecucion?.materials).filter(Boolean).join(' · '),
        },
        conclusion: {
          description: targetBlock.activities.map(a => a.conclusion?.activities).filter(Boolean).join(' · '),
          processes: targetBlock.activities.map(a => a.conclusion?.processes).filter(Boolean).join(' · '),
          materials: targetBlock.activities.map(a => a.conclusion?.materials).filter(Boolean).join(' · '),
        },
        saberes: targetBlock.saberes || currentBlockActivity?.saberes,
        contenidoFormativo: targetBlock.contenidoFormativo || currentBlockActivity?.contenidoFormativo,
        methodology: targetBlock.methodology || currentBlockActivity?.methodology,
      }
    : undefined;

  // ── Fase 2: Extracción de Contexto Curricular Oficial ───────────────────
  await notifyProgress({
    phase: 'blueprint',
    currentStep: 'Estructurando contexto normativo y aprendizajes de trayectoria...',
    percent: 20,
  });

  const weeklyHours = resolveWeeklyHours(rawPlanning || planning, options.customHours);
  const budget = computeContentBudget(weeklyHours);

  const curriculumContext = extractCurriculumContext({
    uacName: planning.uacName,
    semester: planning.semester,
    subsystem: teacherContext.subsystem,
    component: planning.component,
    teacherContext,
    weeklyHours,
  });

  // ── Fase 3: Blueprint de Dosificación y Clustering de Misiones ─────────
  await notifyProgress({
    phase: 'blueprint',
    currentStep: 'Diseñando misiones pedagógicas sesión por sesión...',
    percent: 30,
  });

  const extrasRows = await getPlanningExtras(planningId, planning.teacherId).catch((err: unknown) => {
    logger.warn('[orchestrator] Error obteniendo extras:', { error: err instanceof Error ? err.message : String(err) });
    return [];
  });
  const existingExtras: Record<string, unknown> = {};
  for (const extra of extrasRows) {
    existingExtras[extra.type] = extra.content_text || extra;
  }

  const blueprint = buildBlockBlueprint({
    blockIndex,
    blockName,
    planning,
    curriculum: curriculumContext,
    hasExistingExtras: Object.keys(existingExtras).length > 0,
  });

  // ── Fase 4: Búsqueda de Semilla Canónica Reutilizable ───────────────────
  let canonicalSeed: CanonicalSeed | null = null;
  try {
    const seedTopic =
      blueprint.missions[0]?.sessionTopic ||
      blueprint.missions[blueprint.missions.length - 1]?.sessionTopic ||
      blockName;
    canonicalSeed = await findCanonicalSeed(
      curriculumContext.uacName,
      seedTopic,
      curriculumContext.subsystem
    );
    if (canonicalSeed && canonicalSeed.id) {
      await incrementSeedUsage(canonicalSeed.id);
    }
  } catch (seedErr) {
    logger.warn('[orchestrator] Error al buscar semilla canónica:', { error: String(seedErr) });
  }

  // ── Fase 5: Preparación de Inputs para los 4 Redactores ────────────────
  const baseWriterInput: WriterInput = {
    planning,
    blockIndex,
    blockName,
    sessions: blueprint.sessions,
    missions: blueprint.missions,
    canonicalSeed: canonicalSeed || undefined,
    existingExtras,
    paecContext: curriculumContext.paecConnection.communityProblem || planning.paecContext || 'Problema comunitario escolar',
    studentProfile: curriculumContext.studentProfile.contextDescription,
    subsystem: curriculumContext.subsystem,
    uacName: planning.uacName,
    targetWords: budget.missionBudgets.foundation.targetWords,
    planningActivities,
    signal: options.signal,
  };

  // ── Fase 6: Redacción Concurrente Suavizada con Micro-desfase ──────────
  await notifyProgress({
    phase: 'writing',
    currentStep: 'Redactando concurrentemente las 4 dimensiones del libro...',
    percent: 50,
  });

  // Micro-desfase suave (3500ms) entre el lanzamiento de cada redactor para evitar
  // ráfagas masivas simultáneas que saturen la concurrencia de Google AI Studio (503).
  // En entorno de tests Vitest (NODE_ENV=test) el delay es 0ms para ejecución instantánea.
  const STAGGER_DELAY_MS = process.env.NODE_ENV === 'test' ? 0 : 4500;
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const writerTasks = [
    {
      type: 'foundation' as const,
      fn: () =>
        generateFoundationMission({
          ...baseWriterInput,
          targetWords: budget.missionBudgets.foundation.targetWords,
        }),
    },
    {
      type: 'lab' as const,
      fn: () =>
        generateLabMission({
          ...baseWriterInput,
          targetWords: budget.missionBudgets.lab.targetWords,
        }),
    },
    {
      type: 'project' as const,
      fn: () =>
        generateProjectMission({
          ...baseWriterInput,
          targetWords: budget.missionBudgets.project.targetWords,
        }),
    },
    {
      type: 'evaluation' as const,
      fn: () =>
        generateEvaluationSection({
          ...baseWriterInput,
          targetWords: budget.missionBudgets.evaluation.targetWords,
        }),
    },
  ];

  // Ejecución secuencial de los 4 redactores con notificación de progreso:
  // Evita ráfagas masivas simultáneas en el milisegundo 0 que saturen la cuota de concurrencia
  // de Google AI Studio (503 / Fast-fail).
  for (let i = 0; i < writerTasks.length; i++) {
    if (i > 0 && STAGGER_DELAY_MS > 0) {
      await sleep(STAGGER_DELAY_MS);
    }
    const task = writerTasks[i];
    if (options.signal?.aborted) {
      throw new Error('Operación cancelada por signal.');
    }
    const remainingTimeMs = MAX_ORCHESTRATOR_BUDGET_MS - (Date.now() - startTime);
    if (remainingTimeMs < 30_000) {
      logger.warn(`[orchestrator] Presupuesto crítico antes de iniciar ${task.type} (${Math.round(remainingTimeMs / 1000)}s restantes). Aplicando fallback de emergencia para preservar entrega.`);
      writerOutputs.push(createEmergencyFallbackOutput(task.type, baseWriterInput, 'Presupuesto de tiempo agotado'));
      continue;
    }
    await notifyProgress({
      phase: 'writing',
      currentStep: `Redactando dimensión ${i + 1}/4 (${task.type}) con rigor editorial...`,
      percent: 50 + i * 5,
    });
    try {
      const out = await runWriterSafely(task.type, task.fn);
      writerOutputs.push(out);
    } catch (err) {
      logger.error(`[Orchestrator] Redactor ${task.type} falló; aplicando fallback de emergencia:`, err);
      writerOutputs.push(createEmergencyFallbackOutput(task.type, baseWriterInput, String(err)));
    }
  }

  // ── Fase 7: Zona de Depuración y Resiliencia ────────────────────────────
  await notifyProgress({
    phase: 'troubleshooting',
    currentStep: 'Generando matriz formativa "¿Qué hacer si falla?"...',
    percent: 70,
  });

  const allWarnings = writerOutputs.flatMap((w) => w.warnings);
  const sampleTopics = blueprint.missions.map((m) => m.sessionTopic);

  const troubleshootMatrix = await generateTroubleshootingMatrix({
    uacName: planning.uacName,
    subsystem: curriculumContext.subsystem,
    blockName,
    teacherId: planning.teacherId,
    canonicalSeed: canonicalSeed || undefined,
    writerWarnings: allWarnings,
    sampleTopics,
  });

  // ── Fase 8: Validación de Calidad y Reintentos Dirigidos ────────────────
  await notifyProgress({
    phase: 'validating',
    currentStep: 'Auditando estándares pedagógicos y volumen de palabras...',
    percent: 85,
  });

  let validation = validateBlockGuideQuality({
    writerOutputs,
    subsystem: curriculumContext.subsystem,
    targetWords: budget.targetWords,
  });

  // Si hay redactores reintentables, ejecutar reintentos específicos (máx 1 por redactor)
  if (validation.retryableWriters.length > 0) {
    for (const writerType of validation.retryableWriters) {
      const remainingBudget = MAX_ORCHESTRATOR_BUDGET_MS - (Date.now() - startTime);
      if (remainingBudget < 45_000 || signal?.aborted) {
        logger.warn(
          `[orchestrator] Presupuesto de tiempo agotado para reintentos (${Math.round(remainingBudget / 1000)}s restantes < 45s). Ensamblando libro con contenido existente para evitar timeout de Vercel.`
        );
        break;
      }

      const current = writerOutputs.find((w) => w.type === writerType);
      const currentWords = current?.wordCount || 0;
      const targetMin = budget.missionBudgets[writerType].targetWords.min;
      if (currentWords >= targetMin) {
        logger.info(`[orchestrator] Redactor ${writerType} ya cumple con el mínimo (${currentWords} >= ${targetMin}); omitiendo reintento.`);
        continue;
      }

      let attempts = 0;
      let improved = false;

      while (attempts < maxRetries && !improved) {
        const remainingForAttempt = MAX_ORCHESTRATOR_BUDGET_MS - (Date.now() - startTime);
        if (remainingForAttempt < 45_000 || signal?.aborted) {
          logger.warn(
            `[orchestrator] Presupuesto insuficiente para intento ${attempts + 1} de ${writerType} (${Math.round(remainingForAttempt / 1000)}s < 45s). Omitiendo.`
          );
          break;
        }

        attempts++;
        logger.info(
          `[orchestrator] Reintentando ${writerType} (Intento ${attempts}/${maxRetries}, actual: ${currentWords}, meta mínima: ${targetMin})...`
        );

        try {
          const deficit = Math.max(0, targetMin - currentWords);
          const expansionDirective = deficit > 0
            ? `[REQUISITO CRÍTICO DE EXPANSIÓN EDITORIAL]: El borrador previo tuvo ${currentWords} palabras y fue insuficiente para el presupuesto formal (faltan al menos ${deficit} palabras para el mínimo de ${targetMin}). Redacta CADA sesión con al menos 950 a 1,050 palabras: expande 'contenido' a 3 párrafos conceptuales extensos de al menos 160 palabras cada uno y 'ejemploResuelto' con 4 pasos detallados de desarrollo sin omitir operaciones ni fórmulas.`
            : undefined;

          const writerSpecificInput: WriterInput = {
            ...baseWriterInput,
            targetWords: budget.missionBudgets[writerType].targetWords,
            alignmentDirective: expansionDirective,
          };

          let reRunOutput: WriterOutput;
          if (writerType === 'foundation') reRunOutput = await generateFoundationMission(writerSpecificInput);
          else if (writerType === 'lab') reRunOutput = await generateLabMission(writerSpecificInput);
          else if (writerType === 'project') reRunOutput = await generateProjectMission(writerSpecificInput);
          else reRunOutput = await generateEvaluationSection(writerSpecificInput);

          const idx = writerOutputs.findIndex((w) => w.type === writerType);
          if (idx !== -1) {
            const current = writerOutputs[idx];
            const wordsImproved = reRunOutput.wordCount > current.wordCount;
            if (wordsImproved && reRunOutput.qualityScore >= 70) {
              writerOutputs[idx] = reRunOutput;
              improved = true;
              logger.info(`[orchestrator] Reintento de ${writerType} EXITOSO: ${current.wordCount} -> ${reRunOutput.wordCount} palabras.`);
            } else {
              logger.info(`[orchestrator] Reintento de ${writerType} descartado: no mejoró el volumen (${reRunOutput.wordCount} <= ${current.wordCount}) o calidad insuficiente (${reRunOutput.qualityScore} < 70).`);
            }
          }
        } catch (retryErr) {
          logger.warn(`[orchestrator] Falló reintento de ${writerType}:`, { error: String(retryErr) });
        }
      }
    }

    // Re-validar después de los reintentos
    validation = validateBlockGuideQuality({
      writerOutputs,
      subsystem: curriculumContext.subsystem,
      targetWords: budget.targetWords,
    });
  }

  // ── Fase 8.5: Alineación DURA planeación ↔ libro (verificación + 1 reintento) ──
  await notifyProgress({
    phase: 'validating',
    currentStep: 'Verificando alineación dura planeación ↔ contenido del libro...',
    percent: 92,
  });

  const alignmentSource = () => ({
    missions: writerOutputs.map((w) => w.section).filter(Boolean),
    evaluationSection: writerOutputs.find((w) => w.type === 'evaluation')?.evaluationSection ?? null,
    projectSection: writerOutputs.find((w) => w.type === 'project')?.projectSection ?? null,
  });

  let alignmentReport = evaluatePlanningContentAlignment(alignmentSource(), planningActivities);

  if (!alignmentReport.pass && planningActivities) {
    const missingTerms = extractMissingTerms(alignmentReport);
    if (missingTerms.length > 0) {
      const remainingForAlign = MAX_ORCHESTRATOR_BUDGET_MS - (Date.now() - startTime);
      if (remainingForAlign < 45_000 || signal?.aborted) {
        logger.warn(`[orchestrator] Presupuesto de tiempo agotado para reintento de alineación (${Math.round(remainingForAlign / 1000)}s restantes < 45s). Continuando con ensamblado.`);
      } else {
        const alignmentDirective =
          'TERMINOS OBLIGATORIOS DE LA PLANEACION (reproduce su redaccion original en tu seccion): ' +
          missingTerms.join(' | ');

        for (const writerType of ['foundation', 'lab', 'project', 'evaluation'] as const) {
          const remainingInLoop = MAX_ORCHESTRATOR_BUDGET_MS - (Date.now() - startTime);
          if (remainingInLoop < 45_000 || signal?.aborted) {
            logger.warn('[orchestrator] Presupuesto de tiempo agotado en bucle de alineación. Continuando con ensamblado.');
            break;
          }
          const idx = writerOutputs.findIndex((w) => w.type === writerType);
          if (idx === -1) continue;
          const own = writerOutputs[idx];
          const ownCorpus =
            sectionCorpus(own.section) +
            ' ' +
            sectionCorpus(own.evaluationSection ?? own.projectSection ?? null);
          const lacking = missingTerms.filter((t) => !corpusCoversTerm(ownCorpus, t));
          if (lacking.length === 0) continue;

          logger.info(`[orchestrator] Reintento de alineación para ${writerType} (faltan ${lacking.length} términos)...`);
          try {
            const alignInput: WriterInput = {
              ...baseWriterInput,
              targetWords: budget.missionBudgets[writerType].targetWords,
              alignmentDirective,
            };
            let reRun: WriterOutput;
            if (writerType === 'foundation') reRun = await generateFoundationMission(alignInput);
            else if (writerType === 'lab') reRun = await generateLabMission(alignInput);
            else if (writerType === 'project') reRun = await generateProjectMission(alignInput);
            else reRun = await generateEvaluationSection(alignInput);
            if (reRun.qualityScore >= own.qualityScore) writerOutputs[idx] = reRun;
          } catch (alignErr) {
            logger.warn(`[orchestrator] Falló reintento de alineación de ${writerType}:`, { error: String(alignErr) });
          }
        }

        // Re-validar volumen/calidad y re-medir alineación tras el reintento
        validation = validateBlockGuideQuality({
          writerOutputs,
          subsystem: curriculumContext.subsystem,
          targetWords: budget.targetWords,
        });
        alignmentReport = evaluatePlanningContentAlignment(alignmentSource(), planningActivities);
      }
    }
  }

  if (!alignmentReport.pass) {
    logger.warn(`[Orchestrator] Alineación planeación↔libro bajo umbral: ${alignmentReport.summary}`);
  }

  // ── Fase 9: Ensamblado del ActiveWorkTextbook ───────────────────────────
  await reportProgress(planningId, blockIndex, {
    phase: 'assembling',
    currentStep: 'Compilando libro de trabajo activo y tabla de contenido...',
    percent: 95,
  });

  const foundationOut = writerOutputs.find((w) => w.type === 'foundation')!;
  const labOut = writerOutputs.find((w) => w.type === 'lab')!;
  const projectOut = writerOutputs.find((w) => w.type === 'project')!;
  const evalOut = writerOutputs.find((w) => w.type === 'evaluation')!;

  // Inyectar matriz de resiliencia en la misión de laboratorio
  if (labOut.section) {
    labOut.section.troubleshooting = troubleshootMatrix;
  }

  const missions: MissionSection[] = [
    foundationOut.section,
    labOut.section,
    projectOut.section,
    evalOut.section,
  ].filter(Boolean);

  const defaultProjectSection: ProjectSection = {
    artifactName: `Artefacto Demostrativo para ${planning.uacName}`,
    communityUtility: `Solución técnica comunitaria orientada a ${curriculumContext.paecConnection.communityProblem}`,
    phases: [
      { phaseNum: 1, title: 'Fase 1: Diagnóstico', allocatedHours: 2, deliverables: ['Boceto'], instructions: 'Definir especificaciones.' },
      { phaseNum: 2, title: 'Fase 2: Construcción', allocatedHours: 4, deliverables: ['Prototipo'], instructions: 'Montaje de la solución.' },
      { phaseNum: 3, title: 'Fase 3: Pruebas y Entrega', allocatedHours: 2, deliverables: ['Bitácora'], instructions: 'Validación en campo.' },
    ],
    technicalSpecs: ['Estándares de calidad formal'],
    acceptanceCriteria: ['El artefacto opera según los requerimientos'],
  };

  const defaultEvaluationSection: EvaluationSection = {
    source: 'generated_fresh',
    rubric: [
      {
        criterion: 'Calidad Técnica y Procedimental',
        weightPercent: 50,
        levels: [
          { levelName: 'Excelente', points: 10, descriptor: 'Demuestra dominio pleno de los estándares.' },
          { levelName: 'Bueno', points: 8, descriptor: 'Aplica los conceptos correctamente con mínimas omisiones.' },
          { levelName: 'Suficiente', points: 6, descriptor: 'Cumple los requisitos indispensables de forma básica.' },
          { levelName: 'Requiere Apoyo', points: 4, descriptor: 'Requiere acompañamiento permanente.' },
        ],
      },
      {
        criterion: 'Impacto en la Comunidad PAEC',
        weightPercent: 50,
        levels: [
          { levelName: 'Excelente', points: 10, descriptor: 'Aporte de alto valor a la problemática escolar.' },
          { levelName: 'Bueno', points: 8, descriptor: 'Aporte claro y medible al entorno escolar.' },
          { levelName: 'Suficiente', points: 6, descriptor: 'Aporte modesto o indirecto.' },
          { levelName: 'Requiere Apoyo', points: 4, descriptor: 'Sin vinculación demostrable.' },
        ],
      },
    ],
    checklist: [
      { item: 'Entrega del producto en tiempo y forma', category: 'Cumplimiento' },
      { item: 'Funcionamiento comprobable del artefacto', category: 'Técnico' },
    ],
    criticalThinkingQuiz: [
      {
        questionNumber: 1,
        question: `¿Cómo mitiga tu proyecto la problemática de ${curriculumContext.paecConnection.communityProblem}?`,
        scenario: 'Demostración de resultados ante la comunidad escolar.',
        answerExplanation: 'El estudiante debe justificar el impacto social de su artefacto.',
      },
    ],
    metacognitiveReflection: {
      prompts: ['¿Qué aprendiste al construir este proyecto que puedas aplicar en tu vida diaria?'],
    },
  };

  const projectSection: ProjectSection = projectOut.projectSection || defaultProjectSection;
  const evaluationSection: EvaluationSection = evalOut.evaluationSection || defaultEvaluationSection;

  const totalWords = validation.totalWordCount;
  // Estimación transparente y real basada en densidad editorial de texto y espacios de trabajo:
  const totalPages = Math.max(1, Math.round(totalWords / WORDS_PER_PAGE));

  const tableOfContents = missions.map((m, idx) => ({
    missionIndex: idx + 1,
    title: m.title,
    sessionsRange: `Sesiones ${m.coveredSessions?.join(', ') || 'N/A'}`,
    pageEstimate: Math.max(4, Math.round(m.wordCount / WORDS_PER_PAGE)),
  }));

  // Extraer todas las sesiones cubiertas y planes de sesión para validar cobertura
  const coveredSessionNumbers = Array.from(
    new Set(
      missions.flatMap((m) => [
        ...(m.coveredSessions || []),
        ...((m.sessionPlans || []).map((sp) => sp.sessionNumber)),
      ])
    )
  ).sort((a, b) => a - b);

  const allSessionPlans = missions.flatMap((m) => m.sessionPlans || []);
  const fallbackWords = detectFallbackWords(allSessionPlans, planning.uacName);
  const aiWords = Math.max(0, totalWords - fallbackWords);

  const coverageReport = validateSessionCoverage({
    sessions: coveredSessionNumbers.map((sessionNumber) => {
      const sp = allSessionPlans.find((p) => p.sessionNumber === sessionNumber);
      return { sessionNumber, isFallback: sp?.isFallback };
    }),
    expectedSessionsCount: budget.sessionsPerBlock,
    totalWords,
    fallbackWords,
    budget,
  });

  const crossContaminationReport = validateBlockCrossContamination(missions, planning.uacName);
  if (!crossContaminationReport.clean) {
    logger.warn(`[Orchestrator] Contaminación cruzada detectada en bloque ${blockIndex}: ${crossContaminationReport.summary}`, {
      issues: crossContaminationReport.issues,
    });
    validation.accepted = false;
  }

  const activeWorkTextbook: ActiveWorkTextbook = {
    id: `wtb-${planningId}-b${blockIndex}`,
    planningId,
    blockIndex,
    blockName,
    version: 1, // saveBlockWorkbook se encargará de asignar la versión correlativa
    subsystem: curriculumContext.subsystem,
    targetPages: budget.targetPages.ideal,
    totalPages,
    totalWords,
    aiWords,
    fallbackWords,
    sessionsPerBlock: budget.sessionsPerBlock,
    targetWords: budget.targetWords.ideal,
    pagesDelta: coverageReport.pagesDelta,
    wordsDelta: coverageReport.wordsDelta,
    coverageReport: {
      sessionsCovered: coverageReport.sessionsCovered,
      sessionsExpected: coverageReport.sessionsExpected,
      allSessionsPresent: coverageReport.allSessionsPresent,
      averageWordsPerSession: coverageReport.averageWordsPerSession,
      withinTargetRange: coverageReport.withinTargetRange,
      aiWords,
      fallbackWords,
    },
    generatedAt: new Date().toISOString(),
    qualityScore: validation.qualityScore,
    qualityWarning:
      validation.qualityWarning ||
      !alignmentReport.pass ||
      !coverageReport.allSessionsPresent ||
      !coverageReport.withinTargetRange ||
      fallbackWords > 0 ||
      !crossContaminationReport.clean ||
      Boolean(signal?.aborted),
    coverData: {
      title: `Cuaderno de Aprendizaje Activo: ${blockName}`,
      subtitle: `Misiones Didácticas Orientadas al Proyecto PAEC Comunitario`,
      subjectName: planning.uacName,
      semester: planning.semester,
      blockNumber: blockIndex + 1,
      teacherName: rawPlanning.content_json?.sectionI?.teacherName || teacher?.name || 'Docente Titular',
      schoolName: identidadEscolar.schoolName,
      cct: identidadEscolar.cct,
      paecProjectName: curriculumContext.paecConnection.projectName || planning.paecContext,
    },
    tableOfContents,
    missions,
    projectSection,
    evaluationSection,
  };

  activeWorkTextbook.planningAlignment = {
    score: alignmentReport.score,
    pass: alignmentReport.pass,
    summary: alignmentReport.summary,
  };

  // ── Fase 10: Persistencia en DB con Versionamiento ─────────────────────
  // Si persistWorkbook es false (ej. ejecutado por el worker con persistencia única), el worker guardará al completar.
  const shouldPersist = options.persistWorkbook ?? (!options.jobId);
  if (shouldPersist) {
    if (!validation.accepted) {
      logger.warn(
        `[Orchestrator] Block ${blockIndex} NOT accepted: qualityScore=${validation.qualityScore}, words=${validation.totalWordCount}. Guardando con advertencia activa.`
      );
      activeWorkTextbook.qualityWarning = true;
    }
    if (jobId) {
      await saveBlockWorkbook(planningId, blockIndex, activeWorkTextbook, jobId, leaseId);
    } else {
      await saveBlockWorkbook(planningId, blockIndex, activeWorkTextbook);
    }
  } else {
    if (!validation.accepted) {
      logger.warn(
        `[Orchestrator] Block ${blockIndex} NOT accepted: qualityScore=${validation.qualityScore}, words=${validation.totalWordCount}. Marcando advertencia activa.`
      );
      activeWorkTextbook.qualityWarning = true;
    }
  }

  // Si alcanzó estándar alto (qualityScore >= 80) y no existía semilla previa, guardarla
  if (validation.qualityScore >= 80 && !canonicalSeed && labOut.section) {
    const seedCandidate: CanonicalSeed = {
      uacId: curriculumContext.uacName,
      subsystem: curriculumContext.subsystem,
      topic: labOut.section.sessionTopic || blockName,
      practiceType: curriculumContext.subsystem === 'bt' ? 'workshop' : 'lab',
      content: {
        title: labOut.section.title,
        procedures: [labOut.section.iDoSection.stepByStepDemo],
        dataTableSchema: {
          columns: ['Parámetro', 'Valor Esperado', 'Medición 1', 'Medición 2', 'Unidad'],
          sampleRows: 6,
        },
        commonErrors: troubleshootMatrix,
        materials: ['Materiales de práctica escolar'],
        nomNorms: curriculumContext.applicableNorms,
      },
      source: 'ai_generated',
      qualityScore: validation.qualityScore,
    };
    await Promise.resolve(saveCanonicalSeed(seedCandidate)).catch((e) =>
      logger.warn('[orchestrator] Error al guardar semilla canónica:', { error: String(e) })
    );
  }

  // ── Fase 11: Finalización ──────────────────────────────────────────────
  await notifyProgress({
    phase: 'completed',
    currentStep: 'Libro-Cuaderno de Trabajo Activo completado y listo para descarga.',
    percent: 100,
    qualityScore: validation.qualityScore,
    wordCount: validation.totalWordCount,
    totalWords: validation.totalWordCount,
  });

  return activeWorkTextbook;
}

/**
 * Reporta el avance de la generación a la base de datos para el progreso en tiempo real.
 * Aplica fencing estricto: primero valida y actualiza generation_jobs con leaseId;
 * si el lease fue revocado o expiró, aborta inmediatamente sin mutar plannings.workbook_progress.
 */
async function reportProgress(
  planningId: string,
  blockIndex: number,
  params: {
    phase: GenerationProgressState['phase'];
    currentStep: string;
    percent: number;
    qualityScore?: number;
    wordCount?: number;
    totalWords?: number;
    error?: string;
  },
  jobId?: string,
  leaseId?: string
): Promise<void> {
  // 1. Primero actualizar generation_jobs con fencing si corre bajo un worker
  if (jobId) {
    try {
      await updateGenerationJobProgress(
        jobId,
        {
          progress: params.percent,
          current_phase: params.phase,
          current_step: params.currentStep,
        },
        leaseId
      );
    } catch (err: unknown) {
      if (err instanceof WorkerLeaseLostError) {
        logger.error(`[Orchestrator] Fencing: lease ${leaseId} revocado/expirado en job ${jobId}. Abortando orquestador.`);
        throw err;
      }
      logger.warn('[Orchestrator] Job progress update failed:', { error: err instanceof Error ? err.message : String(err) });
    }
  }

  // 2. Solo tras validar generation_jobs, actualizar plannings.workbook_progress con fencing
  const state: GenerationProgressState = {
    planningId,
    blockIndex,
    phase: params.phase,
    currentStep: params.currentStep,
    percent: params.percent,
    qualityScore: params.qualityScore,
    wordCount: params.wordCount,
    totalWords: params.totalWords,
    error: params.error,
    updatedAt: new Date().toISOString(),
  };

  try {
    if (jobId) {
      await updateWorkbookProgress(planningId, blockIndex, state, jobId, leaseId);
    } else {
      await updateWorkbookProgress(planningId, blockIndex, state);
    }
  } catch (err: unknown) {
    if (err instanceof WorkerLeaseLostError) {
      logger.error(`[Orchestrator] Fencing: lease ${leaseId} revocado en updateWorkbookProgress. Abortando.`);
      throw err;
    }
    logger.warn('[Orchestrator] Progress update failed:', { error: err instanceof Error ? err.message : String(err) });
  }
}

/**
 * Ejecuta un writer con captura segura de excepciones
 */
async function runWriterSafely(
  type: 'foundation' | 'lab' | 'project' | 'evaluation',
  fn: () => Promise<WriterOutput>
): Promise<WriterOutput> {
  try {
    return await fn();
  } catch (err: unknown) {
    logger.error(`[runWriterSafely] Falló el redactor ${type}:`, err);
    throw err;
  }
}

/**
 * Construye una salida de emergencia con contenido mínimo en caso de fallo crítico
 */
function createEmergencyFallbackOutput(
  type: 'foundation' | 'lab' | 'project' | 'evaluation',
  input: WriterInput,
  errorMsg: string
): WriterOutput {
  // Usa las sesiones REALES de la misión correspondiente (nunca un rango fijo):
  // el workbook resultante debe seguir cubriendo el 100% de las sesiones del bloque.
  const emergencyMission = input.missions.find((m) => m.missionType === type) || input.missions[0];
  const coveredSessions =
    Array.isArray(emergencyMission?.sessionNumbers) && emergencyMission.sessionNumbers.length > 0
      ? emergencyMission.sessionNumbers
      : [1, 2];
  const fallbackPlans = completeSessionPlans([], coveredSessions, {
    uacName: input.uacName,
    blockName: input.blockName,
    sessionTopic: emergencyMission?.sessionTopic || input.uacName,
    sessionFocus: emergencyMission?.focus || 'Desarrollo de competencias esenciales',
    paecContext: input.paecContext,
    subsystem: input.subsystem,
  });
  const fallbackPlansWords = fallbackPlans.reduce((acc, sp) => acc + countSessionPlanWords(sp), 0);
  const totalEmergencyWords = 500 + fallbackPlansWords;

  const fallbackSection: MissionSection = {
    missionIndex: emergencyMission?.missionIndex || 1,
    title: `Misión Formativa: ${input.blockName}`,
    coveredSessions,
    sessionTopic: input.uacName,
    sessionFocus: 'Desarrollo de competencias esenciales',
    phenomenonHook: {
      story: `Abordamos los fundamentos esenciales de ${input.uacName} para atender ${input.paecContext}.`,
      detonatingQuestion: '¿De qué forma este conocimiento transforma nuestro entorno escolar?',
    },
    conceptZero: {
      physicalAnalogy: 'Cada concepto es un eslabón indispensable en la cadena de soluciones técnicas.',
      coreExplanation: `Fundamentos de ${input.uacName} para el Bachillerato.`,
    },
    iDoSection: { stepByStepDemo: 'Demostración inicial de los protocolos de trabajo.' },
    weDoSection: {
      guidedPractice: 'Actividad en equipos de trabajo en el aula.',
      workbookElements: [
        { id: 'em-1', type: 'lines', title: 'Registro inicial', config: { rows: 4 } },
      ],
    },
    youDoSection: {
      autonomousChallenge: 'Resolución autónoma de los ejercicios en el cuaderno.',
      workbookElements: [
        { id: 'em-2', type: 'lines', title: 'Conclusiones', config: { rows: 4 } },
      ],
    },
    troubleshooting: [],
    formativeCheckpoint: {
      question: '¿Qué aprendizaje clave consolidas en esta misión?',
      reflectionPrompts: ['Revisa los pasos realizados.'],
      criteriaChecklist: ['Identifico los conceptos centrales.'],
    },
    sessionPlans: fallbackPlans,
    wordCount: totalEmergencyWords,
  };

  return {
    type,
    section: fallbackSection,
    wordCount: totalEmergencyWords,
    tokensUsed: 0,
    qualityScore: 60,
    warnings: [`Generado mediante contingencia crítica de redactor (${type}): ${errorMsg}`],
  };
}
