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
  WorkerLeaseLostError,
  JOB_LEASE_SECONDS,
  JOB_MAX_DURATION_SECONDS,
  type GenerationJob,
} from '@/lib/db';
import { generateBlockWorkTextbook } from './guide-engine/block-guide-orchestrator';
import { logger } from '@/lib/logger';

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

  logger.info(`[job-worker] Iniciando procesamiento de job ${jobId} (lease: ${leaseId}, Planeación: ${job.planning_id}, Bloque: ${job.block_index})...`);

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

  // 1. Heartbeat en segundo plano (cada 25 s) para renovar el lease y detectar fencing
  const heartbeatInterval = setInterval(async () => {
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
    }
  }, 25_000);

  // 2. Timeout real preventivo (270 segundos) para abortar antes del corte de 300s de Vercel
  const maxDurationTimeout = setTimeout(() => {
    logger.warn(`[job-worker] Límite de ${JOB_MAX_DURATION_SECONDS}s alcanzado para job ${jobId}. Abortando pipeline...`);
    abortController.abort(new Error(`JOB_MAX_DURATION_SECONDS (${JOB_MAX_DURATION_SECONDS}s) alcanzado`));
  }, JOB_MAX_DURATION_SECONDS * 1000);

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
      }
    );

    // 1. Persistir el workbook en la planeación (idempotente por jobId)
    const saveResult = await saveBlockWorkbook(job.planning_id, job.block_index, workbook, jobId);
    if (!saveResult.success) {
      throw new Error(`Fallo al persistir workbook: ${saveResult.error || 'error de concurrencia'}`);
    }

    // 2. Cascada automática de materiales derivados a planning_extras (verificando lease)
    const { cascadeBlockMaterials } = await import('@/lib/guide-engine/cascade-block-materials');
    await cascadeBlockMaterials(job.planning_id, job.block_index, workbook, job.teacher_id, {
      jobId,
      leaseId,
    });

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

    await failGenerationJob(jobId, errorMsg, leaseId).catch((failErr) =>
      logger.error(`[job-worker] No se pudo marcar job como fallido:`, failErr)
    );

    throw error;
  } finally {
    clearInterval(heartbeatInterval);
    clearTimeout(maxDurationTimeout);
  }
}
