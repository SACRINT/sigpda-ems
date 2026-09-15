import { sql } from '@/lib/db';
import { logger } from '@/lib/logger';
import { NextRequest } from 'next/server';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Extracts the idempotency key from request headers if present.
 */
export function extractIdempotencyKey(request: NextRequest): string | null {
  const key =
    request.headers.get('idempotency-key') ||
    request.headers.get('Idempotency-Key') ||
    request.headers.get('x-idempotency-key') ||
    null;

  if (!key) return null;
  const trimmed = key.trim();
  if (!UUID_REGEX.test(trimmed)) {
    logger.warn('[Idempotency] Provided key is not a valid UUID, skipping deduplication', { key: trimmed });
    return null;
  }
  return trimmed;
}

/**
 * Checks whether a valid and unexpired idempotency key exists.
 * Returns cached result_json if found, or null if missing or expired.
 */
export async function checkIdempotencyKey(
  key: string | null,
  teacherId: string,
  endpoint: string
): Promise<any | null> {
  if (!key || !UUID_REGEX.test(key)) return null;

  try {
    const db = sql();
    const rows = await db`
      SELECT result_json
      FROM idempotency_keys
      WHERE key = ${key}::uuid
        AND teacher_id = ${teacherId}::uuid
        AND endpoint = ${endpoint}
        AND expires_at > NOW()
      LIMIT 1
    `;

    if (rows && rows.length > 0) {
      logger.info('[Idempotency] Cache hit for key', { key, endpoint, teacherId });
      return rows[0].result_json;
    }
    return null;
  } catch (error) {
    logger.warn('[Idempotency] Failed to query idempotency key, continuing without cache', { error, key, endpoint });
    return null;
  }
}

/**
 * Persists generation result for an idempotency key with an expiration window (default 24h).
 */
export async function createIdempotencyKey(
  key: string | null,
  teacherId: string,
  endpoint: string,
  resultJson: any,
  ttlHours = 24
): Promise<boolean> {
  if (!key || !UUID_REGEX.test(key)) return false;

  try {
    const db = sql();
    await db`
      INSERT INTO idempotency_keys (key, teacher_id, endpoint, result_json, created_at, expires_at)
      VALUES (
        ${key}::uuid,
        ${teacherId}::uuid,
        ${endpoint},
        ${JSON.stringify(resultJson)}::jsonb,
        NOW(),
        NOW() + (${ttlHours} || ' hours')::interval
      )
      ON CONFLICT (key) DO UPDATE
      SET result_json = EXCLUDED.result_json,
          expires_at = EXCLUDED.expires_at;
    `;
    logger.info('[Idempotency] Key saved successfully', { key, endpoint, teacherId, ttlHours });
    return true;
  } catch (error) {
    logger.error('[Idempotency] Failed to store idempotency key', { error, key, endpoint });
    return false;
  }
}

/**
 * Removes expired idempotency keys (>24h).
 */
export async function cleanupExpiredKeys(): Promise<number> {
  try {
    const db = sql();
    const rows = await db`
      DELETE FROM idempotency_keys
      WHERE expires_at <= NOW()
      RETURNING key
    `;
    const deletedCount = rows.length;
    if (deletedCount > 0) {
      logger.info(`[Idempotency] Cleaned up ${deletedCount} expired idempotency keys.`);
    }
    return deletedCount;
  } catch (error) {
    logger.error('[Idempotency] Failed to cleanup expired idempotency keys', { error });
    return 0;
  }
}
