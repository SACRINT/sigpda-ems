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
import type { WriterOutput } from './guide-engine/writers/writer-contract';
import { logger } from '@/lib/logger';

const MAX_CHECKPOINT_REQUEUES = 8;

interface JobCheckpoint {
  writerOutputs: WriterOutput[];
  attempts: number;
  updatedAt: string;
}

function readCheckpoint(result: unknown): JobCheckpoint | null {
  if (!result || typeof result !== 'object') return null;
  const candidate = result as Record<string, unknown>;
  if (!Array.isArray(candidate.writerOutputs)) return null;
  if (typeof candidate.attempts !== 'number') return null;
  return {
    writerOutputs: candidate.writerOutputs as WriterOutput[],
    attempts: candidate.attempts,
    updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : new Date().toISOString(),
  };
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
    checkpointQueue = checkpointQueue.then(async () => {
      const mergedByType = new Map<WriterOutput['type'], WriterOutput>();
      for (const w of checkpointState.writerOutputs) {
        if (w?.type) mergedByType.set(w.type, w);
      }
      for (const w of snapshot) {
        if (w?.type) mergedByType.set(w.type, w);
      }
      checkpointState = {
        writerOutputs: Array.from(mergedByType.values()),
        attempts: checkpointState.attempts,
        updatedAt: new Date().toISOString(),
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
        previousWriterOutputs,
        onCheckpoint: persistCheckpoint,
      }
    );

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

    const canResume =
      checkpointState.writerOutputs.length > 0 &&
      checkpointState.attempts < MAX_CHECKPOINT_REQUEUES;

    if (canResume) {
      const nextCheckpoint: JobCheckpoint = {
        writerOutputs: checkpointState.writerOutputs,
        attempts: checkpointState.attempts + 1,
        updatedAt: new Date().toISOString(),
      };
      try {
        const resumeProgress = Math.min(65, 25 + nextCheckpoint.writerOutputs.length * 10);
        const requeued = await requeueGenerationJob(
          jobId,
          nextCheckpoint as unknown as Record<string, unknown>,
          leaseId,
          resumeProgress
        );
        if (requeued) {
          logger.warn(
            `[job-worker] Job ${jobId} reencolado con ${nextCheckpoint.writerOutputs.length} redactores (reintento ${nextCheckpoint.attempts}/${MAX_CHECKPOINT_REQUEUES}).`
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
