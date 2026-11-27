/**
 * usage-quotas.ts — Persistencia atómica en Neon PostgreSQL para cuotas, rate limits,
 * idempotencia, locks de concurrencia con TTL y telemetría de motor editorial.
 * SIGPDA-EMS · Fase 4 (PR 4.2)
 */

import { sql } from './client';
import { logger } from '@/lib/logger';

export type EditorialEngineTelemetryKind =
  | 'typst'
  | 'typst_cached'
  | 'jspdf_fallback'
  | 'jspdf_legacy'
  | 'ai_gemini'
  | 'docx_bulk';

let tablesInitialized = false;

/**
 * Inicializa de forma idempotente las tablas de control de uso y concurrencia en Neon.
 */
export async function initUsageQuotaTables(): Promise<void> {
  if (tablesInitialized) return;
  try {
    const db = sql();
    await db`
      CREATE TABLE IF NOT EXISTS usage_counters (
        teacher_id UUID NOT NULL,
        metric TEXT NOT NULL,
        window_key TEXT NOT NULL,
        used_count INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (teacher_id, metric, window_key)
      );
    `;

    await db`
      CREATE TABLE IF NOT EXISTS usage_idempotency_keys (
        idempotency_key TEXT PRIMARY KEY,
        teacher_id UUID NOT NULL,
        metric TEXT NOT NULL,
        window_key TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `;

    await db`
      CREATE INDEX IF NOT EXISTS idx_usage_idem_teacher_created
      ON usage_idempotency_keys(teacher_id, created_at DESC);
    `;

    await db`
      CREATE TABLE IF NOT EXISTS editorial_render_locks (
        lock_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        teacher_id UUID NOT NULL,
        scope TEXT NOT NULL,
        resource_id TEXT NOT NULL,
        engine TEXT,
        acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL,
        released_at TIMESTAMPTZ
      );
    `;

    await db`
      CREATE INDEX IF NOT EXISTS idx_editorial_locks_active
      ON editorial_render_locks(teacher_id, scope, released_at, expires_at);
    `;

    await db`
      CREATE TABLE IF NOT EXISTS editorial_engine_telemetry (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        teacher_id UUID,
        planning_id TEXT,
        scope TEXT NOT NULL,
        engine TEXT NOT NULL,
        cached BOOLEAN NOT NULL DEFAULT false,
        duration_ms INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `;

    await db`
      CREATE INDEX IF NOT EXISTS idx_editorial_telemetry_created
      ON editorial_engine_telemetry(created_at DESC);
    `;

    tablesInitialized = true;
  } catch (err) {
    logger.warn('[usage-quotas] Error inicializando tablas de cuotas/locks:', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export function resetUsageQuotaInitCache(): void {
  tablesInitialized = false;
}

/**
 * Lee el contador actual para (teacher_id, metric, window_key).
 */
export async function getUsageCounter(
  teacherId: string,
  metric: string,
  windowKey: string,
): Promise<number> {
  await initUsageQuotaTables();
  const db = sql();
  const rows = await db`
    SELECT used_count
    FROM usage_counters
    WHERE teacher_id = ${teacherId}::uuid
      AND metric = ${metric}
      AND window_key = ${windowKey}
    LIMIT 1;
  `;
  return Number(rows[0]?.used_count ?? 0);
}

/**
 * Verifica si una `idempotency_key` ya fue registrada previamente.
 */
export async function hasUsageIdempotencyKey(idempotencyKey: string): Promise<boolean> {
  await initUsageQuotaTables();
  const db = sql();
  const rows = await db`
    SELECT 1 AS hit
    FROM usage_idempotency_keys
    WHERE idempotency_key = ${idempotencyKey}
    LIMIT 1;
  `;
  return rows.length > 0;
}

/**
 * Incrementa atómicamente `usage_counters` mediante `INSERT ... ON CONFLICT DO UPDATE`.
 * Si `idempotencyKey` ya existía, NO vuelve a sumar (protege contra reintentos/doble clic).
 */
export async function incrementUsageCounterAtomic(params: {
  teacherId: string;
  metric: string;
  windowKey: string;
  idempotencyKey?: string;
}): Promise<{ usedCount: number; alreadyCounted: boolean }> {
  await initUsageQuotaTables();
  const db = sql();

  if (params.idempotencyKey) {
    const inserted = await db`
      INSERT INTO usage_idempotency_keys (idempotency_key, teacher_id, metric, window_key)
      VALUES (${params.idempotencyKey}, ${params.teacherId}::uuid, ${params.metric}, ${params.windowKey})
      ON CONFLICT (idempotency_key) DO NOTHING
      RETURNING idempotency_key;
    `;
    if (inserted.length === 0) {
      const current = await getUsageCounter(params.teacherId, params.metric, params.windowKey);
      return { usedCount: current, alreadyCounted: true };
    }
  }

  const rows = await db`
    INSERT INTO usage_counters (teacher_id, metric, window_key, used_count, updated_at)
    VALUES (${params.teacherId}::uuid, ${params.metric}, ${params.windowKey}, 1, NOW())
    ON CONFLICT (teacher_id, metric, window_key)
    DO UPDATE SET
      used_count = usage_counters.used_count + 1,
      updated_at = NOW()
    RETURNING used_count;
  `;

  return {
    usedCount: Number(rows[0]?.used_count ?? 1),
    alreadyCounted: false,
  };
}

/**
 * Intenta adquirir un lock de concurrencia con TTL para operaciones pesadas (PDF / ZIP / IA).
 * Limpia automáticamente locks vencidos (`expires_at < NOW()`) para evitar bloqueos huérfanos.
 */
export async function tryAcquireRenderLockDb(params: {
  teacherId: string;
  scope: string;
  resourceId: string;
  maxConcurrency: number;
  ttlSeconds: number;
}): Promise<{ acquired: boolean; lockId?: string; activeCount: number }> {
  await initUsageQuotaTables();
  const db = sql();

  // Purgar locks vencidos de este docente para auto-recuperación ante caídas de función
  await db`
    UPDATE editorial_render_locks
    SET released_at = NOW()
    WHERE teacher_id = ${params.teacherId}::uuid
      AND released_at IS NULL
      AND expires_at < NOW();
  `;

  const activeRows = await db`
    SELECT COUNT(*)::int AS active_count
    FROM editorial_render_locks
    WHERE teacher_id = ${params.teacherId}::uuid
      AND released_at IS NULL
      AND expires_at >= NOW();
  `;
  const activeCount = Number(activeRows[0]?.active_count ?? 0);

  if (activeCount >= params.maxConcurrency) {
    return { acquired: false, activeCount };
  }

  const rows = await db`
    INSERT INTO editorial_render_locks (teacher_id, scope, resource_id, expires_at)
    VALUES (
      ${params.teacherId}::uuid,
      ${params.scope},
      ${params.resourceId},
      NOW() + make_interval(secs => ${Math.max(30, Math.floor(params.ttlSeconds))})
    )
    RETURNING lock_id;
  `;

  return {
    acquired: true,
    lockId: String(rows[0]?.lock_id || ''),
    activeCount: activeCount + 1,
  };
}

/**
 * Libera un lock de concurrencia registrando el motor final utilizado (`engine`).
 */
export async function releaseRenderLockDb(
  lockId: string,
  engine?: EditorialEngineTelemetryKind,
): Promise<void> {
  if (!lockId) return;
  try {
    await initUsageQuotaTables();
    const db = sql();
    await db`
      UPDATE editorial_render_locks
      SET released_at = NOW(),
          engine = COALESCE(${engine ?? null}, engine)
      WHERE lock_id = ${lockId}::uuid;
    `;
  } catch (err) {
    logger.warn('[usage-quotas] Error liberando editorial_render_locks:', {
      lockId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Registra telemetría ligera de motor (`typst | typst_cached | jspdf_fallback | jspdf_legacy`)
 * para monitorear ratio de caché y salud de Render en producción.
 */
export async function recordEditorialEngineTelemetry(params: {
  teacherId?: string | null;
  planningId?: string | null;
  scope: string;
  engine: EditorialEngineTelemetryKind;
  cached?: boolean;
  durationMs?: number;
}): Promise<void> {
  try {
    await initUsageQuotaTables();
    const db = sql();
    await db`
      INSERT INTO editorial_engine_telemetry (
        teacher_id,
        planning_id,
        scope,
        engine,
        cached,
        duration_ms
      ) VALUES (
        ${params.teacherId ? params.teacherId : null}::uuid,
        ${params.planningId ?? null},
        ${params.scope},
        ${params.engine},
        ${Boolean(params.cached)},
        ${typeof params.durationMs === 'number' ? Math.round(params.durationMs) : null}
      );
    `;
  } catch (err) {
    logger.warn('[usage-quotas] Error registrando telemetría editorial (no bloqueante):', {
      scope: params.scope,
      engine: params.engine,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
