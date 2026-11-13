import type { ActiveWorkTextbook } from '@/types/work-textbook';
import crypto from 'crypto';
import { sql } from './client';

// ─── Generation Jobs Queue Operations ───────────────────────────────────────

export type GenerationJobStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface GenerationJob {
  id: string;
  planning_id: string;
  teacher_id: string;
  block_index: number;
  status: GenerationJobStatus;
  progress: number;
  current_phase?: string | null;
  current_step?: string | null;
  result?: ActiveWorkTextbook | null;
  error?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
  lease_id?: string | null;
  heartbeat_at?: string | null;
  lease_until?: string | null;
}

export class WorkerLeaseLostError extends Error {
  constructor(message = 'El lease del worker expiró o fue reclamado por otro proceso') {
    super(message);
    this.name = 'WorkerLeaseLostError';
  }
}

export const JOB_LEASE_SECONDS = 120;
export const JOB_MAX_DURATION_SECONDS = 270;

/**
 * Crea un nuevo trabajo en la cola de generación o retorna uno ya en ejecución si existe.
 * Maneja concurrencia atómica capturando unique_violation (código 23505) del índice parcial.
 */
export async function createGenerationJob(
  planningId: string,
  teacherId: string,
  blockIndex: number
): Promise<GenerationJob> {
  const client = sql();

  try {
    const rows = await client`
      INSERT INTO generation_jobs (
        planning_id, teacher_id, block_index, status, progress, current_phase, current_step
      ) VALUES (
        ${planningId}::uuid,
        ${teacherId}::uuid,
        ${blockIndex},
        'pending',
        0,
        'analyzing',
        'Trabajo encolado, esperando asignación de worker...'
      )
      RETURNING id, planning_id, teacher_id, block_index, status, progress,
                current_phase, current_step, result, error, started_at, completed_at,
                created_at, updated_at, lease_id, heartbeat_at, lease_until
    `;

    return rows[0] as unknown as GenerationJob;
  } catch (err: unknown) {
    const errorObj = err as { code?: string; message?: string } | null;
    // Si ya existe un job activo para (planning_id, block_index), recuperar el existente
    if (errorObj?.code === '23505' || String(errorObj?.message).includes('idx_active_generation_job')) {
      const activeRows = await client`
        SELECT id, planning_id, teacher_id, block_index, status, progress,
               current_phase, current_step, result, error, started_at, completed_at,
               created_at, updated_at, lease_id, heartbeat_at, lease_until
        FROM generation_jobs
        WHERE planning_id = ${planningId}::uuid
          AND block_index = ${blockIndex}
          AND status IN ('pending', 'running')
        ORDER BY created_at DESC
        LIMIT 1
      `;

      if (activeRows && activeRows.length > 0) {
        return activeRows[0] as unknown as GenerationJob;
      }
    }
    throw err;
  }
}

/**
 * Obtiene un trabajo por su UUID
 */
export async function getGenerationJobById(jobId: string): Promise<GenerationJob | null> {
  const client = sql();
  const rows = await client`
    SELECT id, planning_id, teacher_id, block_index, status, progress,
           current_phase, current_step, result, error, started_at, completed_at,
           created_at, updated_at, lease_id, heartbeat_at, lease_until
    FROM generation_jobs
    WHERE id = ${jobId}::uuid
    LIMIT 1
  `;

  if (!rows || rows.length === 0) return null;
  return rows[0] as unknown as GenerationJob;
}

/**
 * Obtiene el último trabajo registrado para una planeación y bloque
 */
export async function getLatestGenerationJob(
  planningId: string,
  blockIndex: number
): Promise<GenerationJob | null> {
  const client = sql();
  const rows = await client`
    SELECT id, planning_id, teacher_id, block_index, status, progress,
           current_phase, current_step, result, error, started_at, completed_at,
           created_at, updated_at, lease_id, heartbeat_at, lease_until
    FROM generation_jobs
    WHERE planning_id = ${planningId}::uuid
      AND block_index = ${blockIndex}
    ORDER BY created_at DESC
    LIMIT 1
  `;

  if (!rows || rows.length === 0) return null;
  return rows[0] as unknown as GenerationJob;
}

/**
 * Reclama atómicamente un trabajo concreto para procesarlo.
 * Genera un lease_id criptográfico nuevo para fencing de escrituras.
 * Se considera reclamable si está 'pending' o si está 'running' con lease_until expirado.
 */
export async function claimGenerationJob(
  jobId: string,
  leaseDurationSeconds = JOB_LEASE_SECONDS
): Promise<GenerationJob | null> {
  const client = sql();
  const leaseId = crypto.randomUUID();

  const rows = await client`
    UPDATE generation_jobs
    SET status = 'running',
        lease_id = ${leaseId}::uuid,
        started_at = COALESCE(started_at, NOW()),
        heartbeat_at = NOW(),
        lease_until = NOW() + (${leaseDurationSeconds}::int * INTERVAL '1 second'),
        updated_at = NOW()
    WHERE id = ${jobId}::uuid
      AND (
        status = 'pending'
        OR (status = 'running' AND (lease_until IS NULL OR lease_until < NOW()))
      )
      AND (
        status <> 'pending'
        OR result IS NULL
        OR CASE
             WHEN (result->>'nextRetryAt') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}'
             THEN (result->>'nextRetryAt')::timestamptz <= NOW()
             ELSE TRUE
           END
      )
    RETURNING id, planning_id, teacher_id, block_index, status, progress,
              current_phase, current_step, result, error, started_at, completed_at,
              created_at, updated_at, lease_id, heartbeat_at, lease_until
  `;

  if (!rows || rows.length === 0) return null;
  return rows[0] as unknown as GenerationJob;
}

/**
 * Reclama atómicamente el siguiente trabajo pendiente o con lease vencido para procesarlo.
 * Emplea FOR UPDATE SKIP LOCKED sobre la subconsulta para concurrencia perfecta entre workers.
 */
export async function claimNextPendingJob(
  leaseDurationSeconds = JOB_LEASE_SECONDS
): Promise<GenerationJob | null> {
  const client = sql();
  const leaseId = crypto.randomUUID();

  const rows = await client`
    WITH candidate AS (
      SELECT id
      FROM generation_jobs
      WHERE (
        status = 'pending'
        AND (
          result IS NULL
          OR CASE
               WHEN (result->>'nextRetryAt') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}'
               THEN (result->>'nextRetryAt')::timestamptz <= NOW()
               ELSE TRUE
             END
        )
      )
         OR (status = 'running' AND (lease_until IS NULL OR lease_until < NOW()))
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    UPDATE generation_jobs
    SET status = 'running',
        lease_id = ${leaseId}::uuid,
        started_at = COALESCE(started_at, NOW()),
        heartbeat_at = NOW(),
        lease_until = NOW() + (${leaseDurationSeconds}::int * INTERVAL '1 second'),
        updated_at = NOW()
    FROM candidate
    WHERE generation_jobs.id = candidate.id
    RETURNING generation_jobs.id, generation_jobs.planning_id, generation_jobs.teacher_id,
              generation_jobs.block_index, generation_jobs.status, generation_jobs.progress,
              generation_jobs.current_phase, generation_jobs.current_step, generation_jobs.result,
              generation_jobs.error, generation_jobs.started_at, generation_jobs.completed_at,
              generation_jobs.created_at, generation_jobs.updated_at, generation_jobs.lease_id,
              generation_jobs.heartbeat_at, generation_jobs.lease_until
  `;

  if (!rows || rows.length === 0) return null;
  return rows[0] as unknown as GenerationJob;
}

/**
 * Renueva el lease activo (Heartbeat periódico del worker).
 * Retorna true si el lease sigue vigente, false si fue revocado o expiró.
 */
export async function renewGenerationJobLease(
  jobId: string,
  leaseId: string,
  extendSeconds = JOB_LEASE_SECONDS
): Promise<boolean> {
  const client = sql();
  const rows = await client`
    UPDATE generation_jobs
    SET heartbeat_at = NOW(),
        lease_until = NOW() + (${extendSeconds}::int * INTERVAL '1 second'),
        updated_at = NOW()
    WHERE id = ${jobId}::uuid
      AND lease_id = ${leaseId}::uuid
      AND status = 'running'
      AND (lease_until IS NULL OR lease_until > NOW())
    RETURNING id
  `;
  return Boolean(rows && rows.length > 0);
}

/**
 * Actualiza el progreso y fase de un trabajo en ejecución condicionado al lease_id vigente.
 */
export async function updateGenerationJobProgress(
  jobId: string,
  updates: {
    progress?: number;
    current_phase?: string;
    current_step?: string;
    status?: GenerationJobStatus;
  },
  leaseId?: string
): Promise<boolean> {
  const client = sql();
  const progress = updates.progress !== undefined ? updates.progress : null;
  const phase = updates.current_phase || null;
  const step = updates.current_step || null;
  const status = updates.status || null;

  const rows = await client`
    UPDATE generation_jobs
    SET progress = CASE
          WHEN ${progress}::int IS NULL THEN progress
          ELSE GREATEST(COALESCE(progress, 0), ${progress}::int)
        END,
        current_phase = COALESCE(${phase}, current_phase),
        current_step = COALESCE(${step}, current_step),
        status = COALESCE(${status}, status),
        updated_at = NOW()
    WHERE id = ${jobId}::uuid
      AND (${leaseId || null}::uuid IS NULL OR lease_id = ${leaseId}::uuid)
    RETURNING id
  `;

  const updated = Boolean(rows && rows.length > 0);
  if (!updated && leaseId) {
    throw new WorkerLeaseLostError(`No se pudo actualizar el progreso del job ${jobId}: lease ${leaseId} revocado o inválido.`);
  }
  return updated;
}

/**
 * Marca un trabajo como completado y persiste el resultado condicionado al lease_id.
 */
export async function completeGenerationJob(
  jobId: string,
  result: ActiveWorkTextbook,
  leaseId?: string
): Promise<boolean> {
  const client = sql();
  const rows = await client`
    UPDATE generation_jobs
    SET status = 'completed',
        progress = 100,
        current_phase = 'completed',
        current_step = 'Libro generado exitosamente',
        result = ${JSON.stringify(result)}::jsonb,
        completed_at = NOW(),
        updated_at = NOW()
    WHERE id = ${jobId}::uuid
      AND (${leaseId || null}::uuid IS NULL OR lease_id = ${leaseId}::uuid)
    RETURNING id
  `;

  const updated = Boolean(rows && rows.length > 0);
  if (!updated && leaseId) {
    throw new WorkerLeaseLostError(`No se pudo completar el job ${jobId}: lease ${leaseId} revocado o inválido.`);
  }
  return updated;
}

/**
 * Marca un trabajo como fallido registrando el error condicionado al lease_id.
 */
export async function failGenerationJob(
  jobId: string,
  errorMessage: string,
  leaseId?: string
): Promise<boolean> {
  const client = sql();
  const rows = await client`
    UPDATE generation_jobs
    SET status = 'failed',
        error = ${errorMessage},
        current_step = 'Error durante la generación',
        completed_at = NOW(),
        updated_at = NOW()
    WHERE id = ${jobId}::uuid
      AND (${leaseId || null}::uuid IS NULL OR lease_id = ${leaseId}::uuid)
    RETURNING id
  `;

  const updated = Boolean(rows && rows.length > 0);
  if (!updated && leaseId) {
    throw new WorkerLeaseLostError(`No se pudo marcar como fallido el job ${jobId}: lease ${leaseId} revocado o inválido.`);
  }
  return updated;
}

export async function saveGenerationJobCheckpoint(
  jobId: string,
  checkpoint: Record<string, unknown>,
  leaseId?: string
): Promise<boolean> {
  const client = sql();
  const rows = await client`
    UPDATE generation_jobs
    SET result = ${JSON.stringify(checkpoint)}::jsonb,
        updated_at = NOW()
    WHERE id = ${jobId}::uuid
      AND status = 'running'
      AND (${leaseId || null}::uuid IS NULL OR lease_id = ${leaseId}::uuid)
    RETURNING id
  `;

  const updated = Boolean(rows && rows.length > 0);
  if (!updated && leaseId) {
    throw new WorkerLeaseLostError(`No se pudo guardar el checkpoint del job ${jobId}: lease ${leaseId} revocado o inválido.`);
  }
  return updated;
}

export async function requeueGenerationJob(
  jobId: string,
  checkpoint: Record<string, unknown>,
  leaseId?: string,
  progress = 0,
  currentStep?: string
): Promise<boolean> {
  const client = sql();
  const resolvedStep = currentStep || 'Reanudando generación desde el último checkpoint...';
  // Monotonía: el reencolado NUNCA reduce el progreso ya alcanzado (solo lo eleva al piso indicado).
  const rows = await client`
    UPDATE generation_jobs
    SET status = 'pending',
        progress = GREATEST(COALESCE(progress, 0), ${progress}::int),
        current_phase = 'queued',
        current_step = ${resolvedStep},
        result = ${JSON.stringify(checkpoint)}::jsonb,
        error = NULL,
        lease_id = NULL,
        heartbeat_at = NULL,
        lease_until = NULL,
        updated_at = NOW()
    WHERE id = ${jobId}::uuid
      AND status = 'running'
      AND (${leaseId || null}::uuid IS NULL OR lease_id = ${leaseId}::uuid)
    RETURNING id
  `;

  const updated = Boolean(rows && rows.length > 0);
  if (!updated && leaseId) {
    throw new WorkerLeaseLostError(`No se pudo reencolar el job ${jobId}: lease ${leaseId} revocado o inválido.`);
  }
  return updated;
}
