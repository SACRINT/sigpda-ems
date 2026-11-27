/**
 * usage-quotas.ts — Persistencia atómica en Neon PostgreSQL para cuotas, rate limits,
 * idempotencia, locks de concurrencia con TTL, retención y telemetría de motor editorial.
 * SIGPDA-EMS · Fase 4 (PR 4.2 + PR 4.2.1 Atomicidad Real & Retención)
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

export interface AtomicQuotaConsumeParams {
  teacherId: string;
  metric: string;
  primaryWindowKey: string;
  primaryLimit: number;
  hourlyMetric: string;
  hourWindowKey: string;
  hourlyLimit: number;
  idempotencyKey?: string;
  idempotencyTtlDays?: number;
}

export interface AtomicQuotaConsumeResult {
  allowed: boolean;
  alreadyCounted: boolean;
  deniedBy?: 'primary_limit' | 'hourly_limit';
  primaryUsed: number;
  hourlyUsed: number;
}

export interface PruneQuotaArtifactsResult {
  deletedIdempotencyKeys: number;
  deletedRenderLocks: number;
  deletedTelemetryRows: number;
}

let tablesInitialized = false;

/**
 * Inicializa de forma idempotente las tablas de control de uso y concurrencia en Neon.
 */
export async function initUsageQuotaTables(): Promise<void> {
  if (tablesInitialized) return;
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
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '35 days')
    );
  `;

  await db`
    ALTER TABLE usage_idempotency_keys
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '35 days');
  `;

  await db`
    CREATE INDEX IF NOT EXISTS idx_usage_idem_teacher_created
    ON usage_idempotency_keys(teacher_id, created_at DESC);
  `;

  await db`
    CREATE INDEX IF NOT EXISTS idx_usage_idem_expires
    ON usage_idempotency_keys(expires_at);
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
    CREATE INDEX IF NOT EXISTS idx_editorial_locks_retention
    ON editorial_render_locks(expires_at);
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
 * Verifica si una `idempotency_key` vigente ya fue registrada previamente.
 */
export async function hasUsageIdempotencyKey(idempotencyKey: string): Promise<boolean> {
  await initUsageQuotaTables();
  const db = sql();
  const rows = await db`
    SELECT 1 AS hit
    FROM usage_idempotency_keys
    WHERE idempotency_key = ${idempotencyKey}
      AND (expires_at IS NULL OR expires_at > NOW())
    LIMIT 1;
  `;
  return rows.length > 0;
}

/**
 * Verifica y consume atómicamente en UNA sola transacción PostgreSQL:
 * 1) `pg_advisory_xact_lock` por docente (serializa peticiones concurrentes del mismo docente).
 * 2) Verifica idempotency_key vigente, cuota principal (`used_count < primaryLimit`) y cuota horaria (`used_count < hourlyLimit`).
 * 3) Solo si ambos cupos alcanzan, inserta `usage_idempotency_keys` (con TTL) y ejecuta UPSERT condicional
 *    `WHERE usage_counters.used_count < limit` en ambos contadores en la misma CTE/transacción.
 *
 * Elimina por completo las carreras check-then-act y los leaks de llaves huérfanas.
 */
export async function consumeUsageQuotaAtomicDb(
  params: AtomicQuotaConsumeParams,
): Promise<AtomicQuotaConsumeResult> {
  await initUsageQuotaTables();
  const db = sql();
  const idemKey = params.idempotencyKey ?? null;
  const ttlDays = Math.max(1, Math.floor(params.idempotencyTtlDays ?? 35));
  const safePrimaryLimit = Math.max(0, Math.floor(params.primaryLimit));
  const safeHourlyLimit = Math.max(0, Math.floor(params.hourlyLimit));

  const buildCteQuery = (q: typeof db) => q`
    WITH
      idem_hit AS (
        SELECT 1 AS hit
        FROM usage_idempotency_keys
        WHERE ${idemKey}::text IS NOT NULL
          AND idempotency_key = ${idemKey}::text
          AND (expires_at IS NULL OR expires_at > NOW())
        LIMIT 1
      ),
      cur_primary AS (
        SELECT COALESCE(
          (
            SELECT used_count
            FROM usage_counters
            WHERE teacher_id = ${params.teacherId}::uuid
              AND metric = ${params.metric}
              AND window_key = ${params.primaryWindowKey}
          ),
          0
        )::int AS cnt
      ),
      cur_hourly AS (
        SELECT COALESCE(
          (
            SELECT used_count
            FROM usage_counters
            WHERE teacher_id = ${params.teacherId}::uuid
              AND metric = ${params.hourlyMetric}
              AND window_key = ${params.hourWindowKey}
          ),
          0
        )::int AS cnt
      ),
      decision AS (
        SELECT
          EXISTS(SELECT 1 FROM idem_hit) AS already_counted,
          (SELECT cnt FROM cur_primary) AS primary_before,
          (SELECT cnt FROM cur_hourly) AS hourly_before,
          (
            NOT EXISTS(SELECT 1 FROM idem_hit)
            AND (SELECT cnt FROM cur_primary) < ${safePrimaryLimit}::int
            AND (SELECT cnt FROM cur_hourly) < ${safeHourlyLimit}::int
          ) AS can_consume
      ),
      ins_idem AS (
        INSERT INTO usage_idempotency_keys (idempotency_key, teacher_id, metric, window_key, expires_at)
        SELECT
          ${idemKey}::text,
          ${params.teacherId}::uuid,
          ${params.metric},
          ${params.primaryWindowKey},
          NOW() + make_interval(days => ${ttlDays}::int)
        FROM decision
        WHERE decision.can_consume AND ${idemKey}::text IS NOT NULL
        ON CONFLICT (idempotency_key) DO UPDATE SET
          expires_at = EXCLUDED.expires_at
        WHERE usage_idempotency_keys.expires_at <= NOW()
        RETURNING idempotency_key
      ),
      inc_primary AS (
        INSERT INTO usage_counters (teacher_id, metric, window_key, used_count, updated_at)
        SELECT ${params.teacherId}::uuid, ${params.metric}, ${params.primaryWindowKey}, 1, NOW()
        FROM decision
        WHERE decision.can_consume
          AND (${idemKey}::text IS NULL OR EXISTS(SELECT 1 FROM ins_idem))
        ON CONFLICT (teacher_id, metric, window_key)
        DO UPDATE SET
          used_count = usage_counters.used_count + 1,
          updated_at = NOW()
        WHERE usage_counters.used_count < ${safePrimaryLimit}::int
        RETURNING used_count
      ),
      inc_hourly AS (
        INSERT INTO usage_counters (teacher_id, metric, window_key, used_count, updated_at)
        SELECT ${params.teacherId}::uuid, ${params.hourlyMetric}, ${params.hourWindowKey}, 1, NOW()
        FROM decision
        WHERE decision.can_consume
          AND (${idemKey}::text IS NULL OR EXISTS(SELECT 1 FROM ins_idem))
        ON CONFLICT (teacher_id, metric, window_key)
        DO UPDATE SET
          used_count = usage_counters.used_count + 1,
          updated_at = NOW()
        WHERE usage_counters.used_count < ${safeHourlyLimit}::int
        RETURNING used_count
      )
    SELECT
      d.already_counted,
      d.can_consume,
      d.primary_before,
      d.hourly_before,
      (SELECT used_count FROM inc_primary) AS primary_after,
      (SELECT used_count FROM inc_hourly) AS hourly_after
    FROM decision d;
  `;

  let row: Record<string, unknown> | undefined;
  if (typeof db.transaction === 'function') {
    const results = await db.transaction((tx) => [
      tx`SELECT pg_advisory_xact_lock(hashtext('sigpda_quota:' || ${params.teacherId}::text));`,
      buildCteQuery(tx as unknown as typeof db),
    ]);
    const cteRows = results[1] as Array<Record<string, unknown>> | undefined;
    row = cteRows?.[0];
  } else {
    const cteRows = (await buildCteQuery(db)) as Array<Record<string, unknown>>;
    row = cteRows[0];
  }

  const alreadyCounted = Boolean(row?.already_counted);
  const primaryBefore = Number(row?.primary_before ?? 0);
  const hourlyBefore = Number(row?.hourly_before ?? 0);

  if (alreadyCounted) {
    return {
      allowed: true,
      alreadyCounted: true,
      primaryUsed: primaryBefore,
      hourlyUsed: hourlyBefore,
    };
  }

  const primaryAfter = row?.primary_after != null ? Number(row.primary_after) : null;
  const hourlyAfter = row?.hourly_after != null ? Number(row.hourly_after) : null;

  if (row?.can_consume && primaryAfter !== null) {
    return {
      allowed: true,
      alreadyCounted: false,
      primaryUsed: primaryAfter,
      hourlyUsed: hourlyAfter ?? hourlyBefore + 1,
    };
  }

  const deniedBy: 'primary_limit' | 'hourly_limit' =
    primaryBefore >= safePrimaryLimit ? 'primary_limit' : 'hourly_limit';

  return {
    allowed: false,
    alreadyCounted: false,
    deniedBy,
    primaryUsed: primaryBefore,
    hourlyUsed: hourlyBefore,
  };
}

/**
 * Reembolsa atómicamente una cuota previamente consumida cuando la operación externa falla
 * (ej. caída/timeout de Render después de descontar `pdf_compile`), decrementando ambos contadores
 * sin bajar de 0 y liberando la `idempotency_key` asociada en una sola transacción.
 */
export async function refundUsageQuotaAtomicDb(params: {
  teacherId: string;
  metric: string;
  primaryWindowKey: string;
  hourlyMetric?: string;
  hourWindowKey?: string;
  idempotencyKey?: string;
}): Promise<boolean> {
  try {
    await initUsageQuotaTables();
    const db = sql();
    const idemKey = params.idempotencyKey ?? null;
    const hourlyMetric = params.hourlyMetric ?? null;
    const hourWindowKey = params.hourWindowKey ?? null;

    const buildRefundCte = (q: typeof db) => q`
      WITH
        del_idem AS (
          DELETE FROM usage_idempotency_keys
          WHERE ${idemKey}::text IS NOT NULL
            AND idempotency_key = ${idemKey}::text
            AND teacher_id = ${params.teacherId}::uuid
          RETURNING idempotency_key
        ),
        dec_primary AS (
          UPDATE usage_counters
          SET used_count = GREATEST(0, used_count - 1),
              updated_at = NOW()
          WHERE teacher_id = ${params.teacherId}::uuid
            AND metric = ${params.metric}
            AND window_key = ${params.primaryWindowKey}
            AND used_count > 0
          RETURNING used_count
        ),
        dec_hourly AS (
          UPDATE usage_counters
          SET used_count = GREATEST(0, used_count - 1),
              updated_at = NOW()
          WHERE ${hourlyMetric}::text IS NOT NULL
            AND ${hourWindowKey}::text IS NOT NULL
            AND teacher_id = ${params.teacherId}::uuid
            AND metric = ${hourlyMetric}::text
            AND window_key = ${hourWindowKey}::text
            AND used_count > 0
          RETURNING used_count
        )
      SELECT
        EXISTS(SELECT 1 FROM dec_primary) AS refunded_primary,
        EXISTS(SELECT 1 FROM del_idem) AS deleted_idem;
    `;

    if (typeof db.transaction === 'function') {
      const res = await db.transaction((tx) => [
        tx`SELECT pg_advisory_xact_lock(hashtext('sigpda_quota:' || ${params.teacherId}::text));`,
        buildRefundCte(tx as unknown as typeof db),
      ]);
      const rows = res[1] as Array<Record<string, unknown>> | undefined;
      return Boolean(rows?.[0]?.refunded_primary);
    }
    const rows = (await buildRefundCte(db)) as Array<Record<string, unknown>>;
    return Boolean(rows[0]?.refunded_primary);
  } catch (err) {
    logger.warn('[usage-quotas] Error reembolsando cuota tras fallo de worker (no bloqueante):', {
      teacherId: params.teacherId,
      metric: params.metric,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

/**
 * Incremento directo en una sola transacción/CTE (preservado para compatibilidad interna).
 */
export async function incrementUsageCounterAtomic(params: {
  teacherId: string;
  metric: string;
  windowKey: string;
  idempotencyKey?: string;
  limit?: number;
}): Promise<{ usedCount: number; alreadyCounted: boolean }> {
  const res = await consumeUsageQuotaAtomicDb({
    teacherId: params.teacherId,
    metric: params.metric,
    primaryWindowKey: params.windowKey,
    primaryLimit: params.limit ?? 1_000_000,
    hourlyMetric: `${params.metric}_direct_noop`,
    hourWindowKey: params.windowKey,
    hourlyLimit: 1_000_000,
    idempotencyKey: params.idempotencyKey,
  });
  return {
    usedCount: res.primaryUsed,
    alreadyCounted: res.alreadyCounted,
  };
}

/**
 * Adquiere atómicamente un lock de concurrencia con TTL dentro de una sola transacción PostgreSQL:
 * 1) `pg_advisory_xact_lock` por docente (impide carrera count+insert entre dos pestañas).
 * 2) Expira locks vencidos (`expires_at < NOW()`).
 * 3) Cuenta activos e inserta en una sola CTE condicional `WHERE active.cnt < maxConcurrency`.
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
  const safeTtl = Math.max(30, Math.floor(params.ttlSeconds));
  const safeMax = Math.max(1, Math.floor(params.maxConcurrency));

  const buildAcquireCte = (q: typeof db) => q`
    WITH
      active AS (
        SELECT COUNT(*)::int AS cnt
        FROM editorial_render_locks
        WHERE teacher_id = ${params.teacherId}::uuid
          AND released_at IS NULL
          AND expires_at >= NOW()
      ),
      ins AS (
        INSERT INTO editorial_render_locks (teacher_id, scope, resource_id, expires_at)
        SELECT
          ${params.teacherId}::uuid,
          ${params.scope},
          ${params.resourceId},
          NOW() + make_interval(secs => ${safeTtl}::int)
        FROM active
        WHERE active.cnt < ${safeMax}::int
        RETURNING lock_id
      )
    SELECT
      (SELECT lock_id FROM ins) AS lock_id,
      (SELECT cnt FROM active) AS active_count;
  `;

  let row: Record<string, unknown> | undefined;
  if (typeof db.transaction === 'function') {
    const results = await db.transaction((tx) => [
      tx`SELECT pg_advisory_xact_lock(hashtext('sigpda_lock:' || ${params.teacherId}::text));`,
      tx`
        UPDATE editorial_render_locks
        SET released_at = NOW()
        WHERE teacher_id = ${params.teacherId}::uuid
          AND released_at IS NULL
          AND expires_at < NOW();
      `,
      buildAcquireCte(tx as unknown as typeof db),
    ]);
    const cteRows = results[2] as Array<Record<string, unknown>> | undefined;
    row = cteRows?.[0];
  } else {
    await db`
      UPDATE editorial_render_locks
      SET released_at = NOW()
      WHERE teacher_id = ${params.teacherId}::uuid
        AND released_at IS NULL
        AND expires_at < NOW();
    `;
    const cteRows = (await buildAcquireCte(db)) as Array<Record<string, unknown>>;
    row = cteRows[0];
  }

  const activeCount = Number(row?.active_count ?? 0);
  const lockId = row?.lock_id ? String(row.lock_id) : '';
  if (!lockId) {
    return { acquired: false, activeCount };
  }

  return {
    acquired: true,
    lockId,
    activeCount: activeCount + 1,
  };
}

/**
 * Libera un lock de concurrencia registrando opcionalmente el motor final utilizado (`engine`).
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

/**
 * Retención/TTL programada (invocada por `/api/cron/cleanup-idempotency`):
 * purga llaves de idempotencia expiradas, locks históricos (> 7 días) y telemetría antigua (> 90 días).
 */
export async function pruneExpiredUsageQuotaDataDb(options?: {
  idempotencyFallbackDays?: number;
  lockRetentionDays?: number;
  telemetryRetentionDays?: number;
}): Promise<PruneQuotaArtifactsResult> {
  await initUsageQuotaTables();
  const db = sql();
  const idemDays = Math.max(1, Math.floor(options?.idempotencyFallbackDays ?? 35));
  const lockDays = Math.max(1, Math.floor(options?.lockRetentionDays ?? 7));
  const telemetryDays = Math.max(7, Math.floor(options?.telemetryRetentionDays ?? 90));

  const idemDeleted = await db`
    DELETE FROM usage_idempotency_keys
    WHERE expires_at < NOW()
       OR created_at < NOW() - make_interval(days => ${idemDays}::int)
    RETURNING idempotency_key;
  `;

  const locksDeleted = await db`
    DELETE FROM editorial_render_locks
    WHERE COALESCE(released_at, expires_at) < NOW() - make_interval(days => ${lockDays}::int)
    RETURNING lock_id;
  `;

  const telemetryDeleted = await db`
    DELETE FROM editorial_engine_telemetry
    WHERE created_at < NOW() - make_interval(days => ${telemetryDays}::int)
    RETURNING id;
  `;

  return {
    deletedIdempotencyKeys: idemDeleted.length,
    deletedRenderLocks: locksDeleted.length,
    deletedTelemetryRows: telemetryDeleted.length,
  };
}
