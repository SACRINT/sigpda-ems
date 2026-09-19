import type { ActiveWorkTextbook } from '@/types/work-textbook';
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
}

/**
 * Crea un nuevo trabajo en la cola de generación o retorna uno ya en ejecución si existe
 */
export async function createGenerationJob(
  planningId: string,
  teacherId: string,
  blockIndex: number
): Promise<GenerationJob> {
  const client = sql();

  // Verificar si ya hay un job activo reciente (< 10 min) para evitar trabajo duplicado
  const activeRows = await client`
    SELECT id, planning_id, teacher_id, block_index, status, progress,
           current_phase, current_step, result, error, started_at, completed_at,
           created_at, updated_at
    FROM generation_jobs
    WHERE planning_id = ${planningId}::uuid
      AND block_index = ${blockIndex}
      AND status IN ('pending', 'running')
      AND updated_at > NOW() - INTERVAL '10 minutes'
    ORDER BY created_at DESC
    LIMIT 1
  `;

  if (activeRows && activeRows.length > 0) {
    return activeRows[0] as unknown as GenerationJob;
  }

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
              created_at, updated_at
  `;

  return rows[0] as unknown as GenerationJob;
}

/**
 * Obtiene un trabajo por su UUID
 */
export async function getGenerationJobById(jobId: string): Promise<GenerationJob | null> {
  const client = sql();
  const rows = await client`
    SELECT id, planning_id, teacher_id, block_index, status, progress,
           current_phase, current_step, result, error, started_at, completed_at,
           created_at, updated_at
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
           created_at, updated_at
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
 * Actualiza el progreso y fase de un trabajo en ejecución
 */
export async function updateGenerationJobProgress(
  jobId: string,
  updates: {
    progress?: number;
    current_phase?: string;
    current_step?: string;
    status?: GenerationJobStatus;
  }
): Promise<void> {
  const client = sql();
  const progress = updates.progress !== undefined ? updates.progress : null;
  const phase = updates.current_phase || null;
  const step = updates.current_step || null;
  const status = updates.status || null;

  await client`
    UPDATE generation_jobs
    SET progress = COALESCE(${progress}, progress),
        current_phase = COALESCE(${phase}, current_phase),
        current_step = COALESCE(${step}, current_step),
        status = COALESCE(${status}, status),
        updated_at = NOW()
    WHERE id = ${jobId}::uuid
  `;
}

/**
 * Marca un trabajo como completado y persiste el resultado
 */
export async function completeGenerationJob(
  jobId: string,
  result: ActiveWorkTextbook
): Promise<void> {
  const client = sql();
  await client`
    UPDATE generation_jobs
    SET status = 'completed',
        progress = 100,
        current_phase = 'completed',
        current_step = 'Libro generado exitosamente',
        result = ${JSON.stringify(result)}::jsonb,
        completed_at = NOW(),
        updated_at = NOW()
    WHERE id = ${jobId}::uuid
  `;
}

/**
 * Marca un trabajo como fallido registrando el error
 */
export async function failGenerationJob(
  jobId: string,
  errorMessage: string
): Promise<void> {
  const client = sql();
  await client`
    UPDATE generation_jobs
    SET status = 'failed',
        error = ${errorMessage},
        current_step = 'Error durante la generación',
        completed_at = NOW(),
        updated_at = NOW()
    WHERE id = ${jobId}::uuid
  `;
}

/**
 * Reclama atómicamente el siguiente trabajo pendiente o stale para procesarlo
 */
export async function claimNextPendingJob(): Promise<GenerationJob | null> {
  const client = sql();

  // Busca el job más antiguo pendiente, o uno en 'running' estancado por más de 10 minutos
  const rows = await client`
    UPDATE generation_jobs
    SET status = 'running',
        started_at = COALESCE(started_at, NOW()),
        updated_at = NOW()
    WHERE id = (
      SELECT id FROM generation_jobs
      WHERE status = 'pending'
         OR (status = 'running' AND updated_at < NOW() - INTERVAL '10 minutes')
      ORDER BY created_at ASC
      LIMIT 1
    )
    RETURNING id, planning_id, teacher_id, block_index, status, progress,
              current_phase, current_step, result, error, started_at, completed_at,
              created_at, updated_at
  `;

  if (!rows || rows.length === 0) return null;
  return rows[0] as unknown as GenerationJob;
}
