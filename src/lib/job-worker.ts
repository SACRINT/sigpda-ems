/**
 * Background Job Worker para Generación de Libros de Bloque
 * SIGPDA-EMS · SEMS Puebla MCCEMS 2026-2027
 *
 * Desacopla la orquestación editorial pesada de los límites de tiempo HTTP:
 * 1. Reclama el trabajo atómicamente con lease_id criptográfico (fencing token).
 * 2. Emite heartbeat periódico (<=30s) para renovar el lease y detectar pérdida de concesión.
 * 3. Temporizador preventivo estricto (270s) para abortar antes del corte forzado de Vercel.
 * 4. Persistencia única e idempotente por jobId en plannings y generation_jobs.
 * 5. Cascada de materiales protegida contra sobrescritura de workers zombies.
 */

import {
  getGenerationJobById,
  claimGenerationJob,
  renewGenerationJobLease,
  updateGenerationJobProgress,
  completeGenerationJob,
  failGenerationJob,
  saveBlockWorkbook,
  saveGenerationJobCheckpoint,
  requeueGenerationJob,
  WorkerLeaseLostError,
  JOB_LEASE_SECONDS,
  JOB_MAX_DURATION_SECONDS,
  type GenerationJob,
} from '@/lib/db';
import { generateBlockWorkTextbook } from './guide-engine/block-guide-orchestrator';
import { isTransientCapacityError } from './guide-engine/writer-scheduler';
import type { WriterOutput } from './guide-engine/writers/writer-contract';
import type { SessionPlan } from '@/types/work-textbook';
import { logger } from '@/lib/logger';

const MAX_CHECKPOINT_REQUEUES = 8;

type MissionWriterType = WriterOutput['type'];
type PartialSessionPlansMap = Partial<Record<MissionWriterType, SessionPlan[]>>;

interface JobCheckpoint {
  writerOutputs: WriterOutput[];
  partialSessionPlans?: PartialSessionPlansMap;
  attempts: number;
  updatedAt: string;
  nextRetryAt?: string;
  /** Reanudar solo con expansión dirigida, conservando los 4 redactores. */
  expandOnly?: boolean;
}

function readCheckpoint(result: unknown): JobCheckpoint | null {
  if (!result || typeof result !== 'object') return null;
  const candidate = result as Record<string, unknown>;
  if (!Array.isArray(candidate.writerOutputs)) return null;
  if (typeof candidate.attempts !== 'number') return null;
  const rawPartials = candidate.partialSessionPlans;
  const partialSessionPlans =
    rawPartials && typeof rawPartials === 'object' && !Array.isArray(rawPartials)
      ? (rawPartials as PartialSessionPlansMap)
      : undefined;
  return {
    writerOutputs: candidate.writerOutputs as WriterOutput[],
    ...(partialSessionPlans ? { partialSessionPlans } : {}),
    attempts: candidate.attempts,
    updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : new Date().toISOString(),
    ...(typeof candidate.nextRetryAt === 'string' ? { nextRetryAt: candidate.nextRetryAt } : {}),
    ...(candidate.expandOnly === true ? { expandOnly: true } : {}),
  };
}

function hasAnyPartialSessionPlans(partials?: PartialSessionPlansMap): boolean {
  if (!partials) return false;
  return Object.values(partials).some((plans) => Array.isArray(plans) && plans.length > 0);
}

function isTransientJobError(error: unknown): boolean {
  if (isTransientCapacityError(error)) return true;
  const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return /timeout|econnreset|fetch failed|network|socket|presupuesto.*cr[ií]tico|job_max_duration_seconds/i.test(
    msg
  );
}

function computeCooldownBackoffMs(errorMsg: string, isTransient: boolean): number {
  if (!isTransient) return 0;
  const match = errorMsg.match(/restan\s+(\d+)s/i);
  if (match) {
    const remainingSec = parseInt(match[1], 10);
    if (Number.isFinite(remainingSec)) {
      return Math.min(60_000, Math.max(15_000, (remainingSec + 5) * 1000));
    }
  }
  return 50_000;
}

/**
 * Un déficit de volumen es recuperable con expansión dirigida: no debe destruir
 * los 4 redactores del checkpoint. Solo se considera volumen puro si el gate
 * no reporta además placeholders, contenido genérico, fallback, sesiones
 * incompletas, desalineación o calidad insuficiente.
 */
export function isVolumeOnlyBlockIntegrity(errorMsg: string): boolean {
  const lower = errorMsg.toLowerCase();
  if (!lower.includes('blockintegrity') || !lower.includes('palabras_ai=')) {
    return false;
  }
  if (
    /contenido_genérico=|fallbackwords=|sesiones=|alineacion_planeacion=|placeholder|solo \d+ de 4/i.test(
      errorMsg
    )
  ) {
    return false;
  }
  return true;
}

/**
 * Resuelve el redactor propietario a partir de las sesiones realmente cubiertas
 * por cada writer. Sin rangos hardcodeados: un bloque de 24 sesiones no puede
 * asumir que las sesiones 16-24 pertenecen a evaluación.
 */
export function resolvePostRedactionEvictionTarget(
  errorMsgLower: string,
  writers: WriterOutput[]
): MissionWriterType | null {
  const affectedSessions = Array.from(
    errorMsgLower.matchAll(/sesi[oó]n(?:es)?(?:\s+afectadas?)?[:\s]+([\d,\sy]+)/gi)
  ).flatMap((match) =>
    (match[1].match(/\d+/g) ?? []).map((n) => parseInt(n, 10)).filter(Number.isFinite)
  );

  if (affectedSessions.length > 0) {
    let bestOwner: { type: MissionWriterType; matches: number } | null = null;
    for (const writer of writers) {
      const covered = writer.section?.coveredSessions ?? [];
      const matches = affectedSessions.filter((session) => covered.includes(session)).length;
      if (matches > 0 && (!bestOwner || matches > bestOwner.matches)) {
        bestOwner = { type: writer.type, matches };
      }
    }
    if (bestOwner) return bestOwner.type;
  }

  if (errorMsgLower.includes('evaluation') || errorMsgLower.includes('rúbrica') || errorMsgLower.includes('rubric')) {
    return 'evaluation';
  }
  if (errorMsgLower.includes('project') || errorMsgLower.includes('proyecto')) {
    return 'project';
  }
  return null;
}

export async function processGenerationJob(
  jobId: string,
  providedLeaseId?: string
): Promise<GenerationJob | null> {
  let job = await getGenerationJobById(jobId);
  if (!job) {
    logger.error(`[job-worker] Job ${jobId} no encontrado`);
    return null;
  }

  // Si ya terminó satisfactoriamente, retornar de inmediato (idempotencia)
  if (job.status === 'completed') {
    return job;
  }

  let leaseId = providedLeaseId;

  // Si no se proporcionó leaseId o el job sigue pending/stale, adquirir el lease atómicamente
  if (!leaseId) {
    const claimed = await claimGenerationJob(jobId, JOB_LEASE_SECONDS);
    if (!claimed || !claimed.lease_id) {
      logger.warn(`[job-worker] No se pudo reclamar el job ${jobId} (ya reclamado con lease activo).`);
      return job;
    }
    job = claimed;
    leaseId = claimed.lease_id;
  }

  const checkpoint = readCheckpoint(job.result);
  let checkpointState: JobCheckpoint = checkpoint ?? {
    writerOutputs: [],
    attempts: 0,
    updatedAt: new Date().toISOString(),
  };
  const previousWriterOutputs = checkpointState.writerOutputs;

  if (checkpointState.attempts >= MAX_CHECKPOINT_REQUEUES) {
    const errorMsg = `Se agotaron los reintentos de reanudación (${MAX_CHECKPOINT_REQUEUES}) para el job ${jobId}.`;
    await failGenerationJob(jobId, errorMsg, leaseId).catch((failErr) =>
      logger.error(`[job-worker] No se pudo marcar job como fallido:`, failErr)
    );
    throw new Error(errorMsg);
  }

  logger.info(`[job-worker] Iniciando procesamiento de job ${jobId} (lease: ${leaseId}, Planeación: ${job.planning_id}, Bloque: ${job.block_index}, redactores recuperados: ${previousWriterOutputs.length})...`);

  // Marcar en running si estaba en pending
  if (job.status === 'pending') {
    await updateGenerationJobProgress(
      jobId,
      {
        status: 'running',
        progress: 5,
        current_phase: 'analyzing',
        current_step: 'Iniciando pipeline de agentes curriculares...',
      },
      leaseId
    );
  }

  const abortController = new AbortController();
  let leaseLost = false;

  // 1. Heartbeat en segundo plano (cada 25 s) para renovar el lease y detectar fencing sin solapamiento
  let isRenewing = false;
  const heartbeatInterval = setInterval(async () => {
    if (isRenewing || leaseLost || abortController.signal.aborted) return;
    isRenewing = true;
    try {
      const renewed = await renewGenerationJobLease(jobId, leaseId!, JOB_LEASE_SECONDS);
      if (!renewed) {
        leaseLost = true;
        logger.warn(`[job-worker] Heartbeat falló para job ${jobId}: lease revocado o expirado.`);
        abortController.abort(new WorkerLeaseLostError(`Lease revocado para job ${jobId}`));
        clearInterval(heartbeatInterval);
      }
    } catch (hbErr) {
      logger.warn(`[job-worker] Error renovando lease de job ${jobId}:`, hbErr);
    } finally {
      isRenewing = false;
    }
  }, 25_000);

  // 2. Timeout real preventivo (270 segundos) para abortar antes del corte de 300s de Vercel
  const maxDurationTimeout = setTimeout(() => {
    logger.warn(`[job-worker] Límite de ${JOB_MAX_DURATION_SECONDS}s alcanzado para job ${jobId}. Abortando pipeline...`);
    abortController.abort(new Error(`JOB_MAX_DURATION_SECONDS (${JOB_MAX_DURATION_SECONDS}s) alcanzado`));
  }, JOB_MAX_DURATION_SECONDS * 1000);

  // Presupuesto máximo del orquestador (240s = 270s - 30s) para ensamblar y persistir antes del corte
  const maxBudgetMs = (JOB_MAX_DURATION_SECONDS - 30) * 1000;

  let checkpointQueue = Promise.resolve();
  const persistCheckpoint = (incomingOutputs: WriterOutput[]): Promise<void> => {
    const snapshot = [...incomingOutputs];
    checkpointQueue = checkpointQueue
      .catch(() => undefined)
      .then(async () => {
        if (leaseLost) return;
        const mergedByType = new Map<MissionWriterType, WriterOutput>();
        for (const w of checkpointState.writerOutputs) {
          if (w?.type) mergedByType.set(w.type, w);
        }
        const nextPartials: PartialSessionPlansMap = {
          ...(checkpointState.partialSessionPlans ?? {}),
        };
        for (const w of snapshot) {
          if (w?.type) {
            mergedByType.set(w.type, w);
            delete nextPartials[w.type];
          }
        }
        checkpointState = {
          writerOutputs: Array.from(mergedByType.values()),
          ...(Object.keys(nextPartials).length > 0 ? { partialSessionPlans: nextPartials } : {}),
          attempts: checkpointState.attempts,
          updatedAt: new Date().toISOString(),
          ...(checkpointState.expandOnly ? { expandOnly: true } : {}),
        };
        await saveGenerationJobCheckpoint(
          jobId,
          checkpointState as unknown as Record<string, unknown>,
          leaseId
        );
      });
    return checkpointQueue;
  };

  const persistPartialSessionPlans = (
    writerType: MissionWriterType,
    plans: SessionPlan[]
  ): Promise<void> => {
    const snapshot = [...plans];
    checkpointQueue = checkpointQueue
      .catch(() => undefined)
      .then(async () => {
        if (leaseLost) return;
        if (checkpointState.writerOutputs.some((w) => w.type === writerType)) return;
        const nextPartials: PartialSessionPlansMap = {
          ...(checkpointState.partialSessionPlans ?? {}),
          [writerType]: snapshot,
        };
        checkpointState = {
          writerOutputs: checkpointState.writerOutputs,
          partialSessionPlans: nextPartials,
          attempts: checkpointState.attempts,
          updatedAt: new Date().toISOString(),
          ...(checkpointState.expandOnly ? { expandOnly: true } : {}),
        };
        await saveGenerationJobCheckpoint(
          jobId,
          checkpointState as unknown as Record<string, unknown>,
          leaseId
        );
      });
    return checkpointQueue;
  };

  try {
    // Ejecutar el orquestador editorial completo (con persistWorkbook: false para persistencia única)
    const workbook = await generateBlockWorkTextbook(
      job.planning_id,
      job.block_index,
      {
        jobId,
        leaseId,
        signal: abortController.signal,
        persistWorkbook: false,
        maxBudgetMs,
        // Misma ruta editorial que la regeneración offline: expande sesiones
        // deficientes solo si queda presupuesto suficiente (ver orquestador).
        expandDeficientSessions: true,
        expandOnly: checkpointState.expandOnly === true,
        previousWriterOutputs,
        previousPartialSessionPlans: checkpointState.partialSessionPlans,
        onCheckpoint: persistCheckpoint,
        onPartialSessionPlansCheckpoint: persistPartialSessionPlans,
      }
    );

    const jobStartedAtMs = job.started_at ? new Date(job.started_at).getTime() : NaN;
    workbook.generationStartedAt =
      workbook.generationStartedAt ||
      (Number.isFinite(jobStartedAtMs)
        ? new Date(jobStartedAtMs).toISOString()
        : new Date().toISOString());
    workbook.generationDurationMs =
      workbook.generationDurationMs ??
      (Number.isFinite(jobStartedAtMs) ? Math.max(0, Date.now() - jobStartedAtMs) : undefined);
    workbook.generationAttempts =
      workbook.generationAttempts ?? checkpointState.attempts + 1;

    // 1. Persistir el workbook en la planeación (idempotente por jobId y protegido por leaseId)
    const saveResult = await saveBlockWorkbook(job.planning_id, job.block_index, workbook, jobId, leaseId);
    if (!saveResult.success) {
      throw new Error(`Fallo al persistir workbook: ${saveResult.error || 'error de concurrencia'}`);
    }

    // 2. Cascada automática de materiales derivados a planning_extras (verificando lease)
    const { cascadeBlockMaterials } = await import('@/lib/guide-engine/cascade-block-materials');
    const cascadeResult = await cascadeBlockMaterials(job.planning_id, job.block_index, workbook, job.teacher_id, {
      jobId,
      leaseId,
      uacName: workbook.coverData?.subjectName || '',
    });
    if (
      !cascadeResult.success ||
      (cascadeResult.omitted && cascadeResult.omitted.length > 0) ||
      (cascadeResult.review && !cascadeResult.review.ok)
    ) {
      const errorCodes = (cascadeResult.review?.errors ?? []).map((e) => e.code).join(', ');
      logger.error(
        `[job-worker] Revisión R1 detectó inconsistencias en materiales del bloque ${job.block_index} (job ${jobId}): ` +
          `omitidos=[${(cascadeResult.omitted ?? []).join(', ')}], errores=[${errorCodes || cascadeResult.error || 'desconocido'}].`
      );
    }

    // 3. Marcar el job como completado con fencing de leaseId
    await completeGenerationJob(jobId, workbook, leaseId);

    logger.info(`[job-worker] Job ${jobId} completado exitosamente con ${workbook.totalWords} palabras (versión v${workbook.version}).`);

    return await getGenerationJobById(jobId);
  } catch (error: unknown) {
    if (leaseLost) {
      logger.warn(`[job-worker] Worker descartó finalización de job ${jobId} porque perdió el lease ante otro worker.`);
      return null;
    }

    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(`[job-worker] Falló job ${jobId}:`, error);

    await checkpointQueue.catch(() => undefined);

    const transientError = isTransientJobError(error);
    const hasProgress =
      checkpointState.writerOutputs.length > 0 ||
      hasAnyPartialSessionPlans(checkpointState.partialSessionPlans);
    const canResume =
      (hasProgress || transientError) &&
      checkpointState.attempts + 1 < MAX_CHECKPOINT_REQUEUES;

    if (canResume) {
      let writersToKeep = [...checkpointState.writerOutputs];
      const nextPartials = checkpointState.partialSessionPlans
        ? { ...checkpointState.partialSessionPlans }
        : undefined;
      const volumeOnly = isVolumeOnlyBlockIntegrity(errorMsg);

      // Un déficit de volumen dentro de la política editorial se corrige con
      // expansión dirigida, conservando los 4 redactores. Solo se evicta el
      // writer propietario cuando el fallo es determinista y no recuperable
      // por volumen (placeholders, contaminación, sesiones incompletas, etc.).
      if (writersToKeep.length >= 4 && !transientError && !volumeOnly) {
        const errorMsgLower = errorMsg.toLowerCase();
        const evictedType = resolvePostRedactionEvictionTarget(errorMsgLower, writersToKeep);
        if (evictedType) {
          writersToKeep = writersToKeep.filter((w) => w.type !== evictedType);
          if (nextPartials) {
            delete nextPartials[evictedType];
          }
          logger.warn(
            `[job-worker] Error post-redacción detectado en job ${jobId}; descartando redactor '${evictedType}' del checkpoint para forzar regeneración fresca en el reintento.`
          );
        } else {
          logger.warn(
            `[job-worker] Error post-redacción sin propietario identificable en job ${jobId}; se conservan los 4 redactores para evitar evicción arbitraria.`
          );
        }
      } else if (volumeOnly && writersToKeep.length >= 4) {
        logger.warn(
          `[job-worker] Déficit de volumen en job ${jobId}; se conservan los 4 redactores y se reintentará solo con expansión dirigida.`
        );
      }

      const backoffMs = computeCooldownBackoffMs(errorMsg, transientError);
      const nextRetryAt =
        backoffMs > 0 ? new Date(Date.now() + backoffMs).toISOString() : undefined;
      const resumeStep =
        backoffMs > 0
          ? `Esperando enfriamiento de APIs IA (~${Math.ceil(backoffMs / 1000)}s) antes de reanudar desde checkpoint...`
          : undefined;

      const nextExpandOnly =
        volumeOnly || (transientError && checkpointState.expandOnly === true);
      const nextCheckpoint: JobCheckpoint = {
        writerOutputs: writersToKeep,
        ...(nextPartials && Object.keys(nextPartials).length > 0
          ? { partialSessionPlans: nextPartials }
          : {}),
        attempts: checkpointState.attempts + 1,
        updatedAt: new Date().toISOString(),
        ...(nextRetryAt ? { nextRetryAt } : {}),
        ...(nextExpandOnly ? { expandOnly: true } : {}),
      };
      try {
        const partialCount = nextPartials
          ? Object.values(nextPartials).reduce((acc, list) => acc + (list?.length ?? 0), 0)
          : 0;
        const resumeProgress = Math.min(
          65,
          25 + nextCheckpoint.writerOutputs.length * 10 + (partialCount > 0 ? 5 : 0)
        );
        const requeued = await requeueGenerationJob(
          jobId,
          nextCheckpoint as unknown as Record<string, unknown>,
          leaseId,
          resumeProgress,
          resumeStep
        );
        if (requeued) {
          logger.warn(
            `[job-worker] Job ${jobId} reencolado con ${nextCheckpoint.writerOutputs.length} redactores y ${partialCount} sesiones parciales (reintento ${nextCheckpoint.attempts}/${MAX_CHECKPOINT_REQUEUES}${backoffMs > 0 ? `, backoff ${Math.ceil(backoffMs / 1000)}s` : ''}).`
          );
          return await getGenerationJobById(jobId);
        }
      } catch (requeueErr) {
        logger.error(`[job-worker] No se pudo reencolar job ${jobId}:`, requeueErr);
      }
    }

    await failGenerationJob(jobId, errorMsg, leaseId).catch((failErr) =>
      logger.error(`[job-worker] No se pudo marcar job como fallido:`, failErr)
    );

    throw error;
  } finally {
    clearInterval(heartbeatInterval);
    clearTimeout(maxDurationTimeout);
  }
}
