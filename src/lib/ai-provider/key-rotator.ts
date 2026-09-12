/**
 * Key rotation utility — v3 (actualizado para gemini-3.x)
 *
 * Mejoras sobre v2:
 * - Eliminados todos los defaults y referencias a modelos legados (gemini-1.5, 2.0, 2.5)
 * - Auto-desactivación: si error_count >= 5, la clave se marca is_active=false
 * - Auto-reactivación: antes de cargar claves, reactiva las que llevan > 5 min sin error
 * - Prioridad de clave de usuario: si se pasa un teacherId, se usa su clave primero
 */

import { neon } from '@neondatabase/serverless';
import type { ApiKeyRecord } from './types';

// ── Encryption / Decryption ──────────────────────────────────────────────────

function getEncKey(): Buffer {
  const key = process.env.ADMIN_ENCRYPTION_KEY;
  if (!key || key.length !== 32) throw new Error('ADMIN_ENCRYPTION_KEY must be 32 characters');
  return Buffer.from(key);
}

export function encryptKey(plain: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createCipheriv, randomBytes } = require('crypto');
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', getEncKey(), iv);
  let enc = cipher.update(plain, 'utf8', 'hex');
  enc += cipher.final('hex');
  return iv.toString('hex') + ':' + enc;
}

export function decryptKey(encrypted: string): string {
  if (!encrypted || !encrypted.includes(':')) return encrypted;
  try {
    const [ivHex, data] = encrypted.split(':');
    if (!ivHex || !data || ivHex.length !== 32) return encrypted;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createDecipheriv } = require('crypto');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = createDecipheriv('aes-256-cbc', getEncKey(), iv);
    let decrypted = decipher.update(data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return encrypted;
  }
}

// ── DB helpers ───────────────────────────────────────────────────────────────

function getDb() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  return neon(process.env.DATABASE_URL);
}

/**
 * Antes de cargar claves activas, reactiva automáticamente las que llevan
 * más de COOLDOWN_MINUTES sin recibir un error. Esto permite que una clave
 * bloqueada por límite de quota se recupere sola tras el enfriamiento.
 *
 * Nota: El límite diario de Gemini free tier (500 RPD) puede tardar hasta
 * 24h en recuperarse, pero 60 min es suficiente para la mayoría de picos.
 */
const COOLDOWN_MINUTES = 60;
const MAX_ERRORS_BEFORE_DEACTIVATE = 5;

async function reactivateCooledKeys(provider: string) {
  try {
    const sql = getDb();
    await sql`
      UPDATE api_keys
      SET is_active = true, error_count = 0
      WHERE provider   = ${provider}
        AND is_active  = false
        AND last_error_at IS NOT NULL
        AND last_error_at < NOW() - INTERVAL '${COOLDOWN_MINUTES} minutes'
    `;
  } catch {
    // Non-critical — don't fail if reactivation fails
  }
}

async function getActiveKeys(provider: string): Promise<ApiKeyRecord[]> {
  // First, try to reactivate cooled-down keys
  await reactivateCooledKeys(provider);

  const sql = getDb();
  const rows = await sql`
    SELECT id, label, provider, model_default, key_encrypted, key_preview,
           is_active, priority, usage_count, error_count, last_used_at, last_error_at
    FROM api_keys
    WHERE provider = ${provider} AND is_active = true
    ORDER BY priority ASC, error_count ASC
  `;
  return rows as ApiKeyRecord[];
}

async function recordUsage(keyId: string) {
  try {
    const sql = getDb();
    await sql`
      UPDATE api_keys
      SET usage_count = usage_count + 1, last_used_at = NOW()
      WHERE id = ${keyId}
    `;
  } catch { /* non-critical */ }
}

async function recordError(keyId: string) {
  try {
    const sql = getDb();
    // Increment error count and check if we should deactivate.
    // IMPORTANT: Only call this for PERMANENT errors (401/403 invalid credentials).
    // Do NOT call for transient errors (429 rate limit, 503 high demand).
    await sql`
      UPDATE api_keys
      SET error_count   = error_count + 1,
          last_error_at = NOW(),
          is_active     = CASE
            WHEN error_count + 1 >= ${MAX_ERRORS_BEFORE_DEACTIVATE} THEN false
            ELSE is_active
          END
      WHERE id = ${keyId}
    `;
  } catch { /* non-critical */ }
}

// ── Fallback: read from env var directly ────────────────────────────────────

function getFallbackKey(provider: string): string | null {
  if (provider === 'gemini') return process.env.GEMINI_API_KEY || null;
  if (provider === 'claude') return process.env.ANTHROPIC_API_KEY || null;
  if (provider === 'openai') return process.env.OPENAI_API_KEY || null;
  if (provider === 'nvidia') return process.env.NVIDIA_API_KEY || null;
  return null;
}

// ── Get teacher's custom API key ─────────────────────────────────────────────

async function getTeacherKey(teacherId: string, provider: string): Promise<string | null> {
  try {
    const sql = getDb();
    const rows = await sql`
      SELECT custom_api_key, custom_api_provider
      FROM teachers
      WHERE id = ${teacherId}::uuid
        AND custom_api_key IS NOT NULL
        AND custom_api_provider = ${provider}
    `;
    if (rows[0]?.custom_api_key) {
      return decryptKey(rows[0].custom_api_key as string);
    }
  } catch { /* non-critical */ }
  return null;
}

// ── Main exports ─────────────────────────────────────────────────────────────

export interface ResolvedKey {
  apiKey: string;
  keyId: string | null;    // null for env-var or user fallback
  modelOverride: string | null;
  source: 'user' | 'pool' | 'env';
}

/**
 * Resolves the best available API key for a given provider.
 * Priority: teacher's own key → pool → env fallback.
 */
export async function resolveKey(
  provider: string,
  teacherId?: string
): Promise<ResolvedKey> {
  // 1. Teacher's own key takes absolute priority
  if (teacherId) {
    const teacherKey = await getTeacherKey(teacherId, provider);
    if (teacherKey) {
      return { apiKey: teacherKey, keyId: null, modelOverride: null, source: 'user' };
    }
  }

  // 2. Pool from DB
  try {
    const keys = await getActiveKeys(provider);
    if (keys.length > 0) {
      const key = keys[0];
      return {
        apiKey: decryptKey(key.key_encrypted),
        keyId: key.id,
        modelOverride: key.model_default || null,
        source: 'pool',
      };
    }
  } catch (err) {
    console.warn('[key-rotator] DB lookup failed, using env fallback:', err);
  }

  // 3. Env var fallback
  const fallback = getFallbackKey(provider);
  if (fallback) {
    return { apiKey: fallback, keyId: null, modelOverride: null, source: 'env' };
  }

  throw new Error(
    `No API key available for provider "${provider}". ` +
    `Add one from the Admin Panel or set the environment variable.`
  );
}

/**
 * Wraps an AI API call with automatic key rotation on 429 errors.
 * Tries each active key in priority order until one succeeds.
 *
 * BUG FIX v2: tracks position by index (not object reference) to properly rotate.
 *
 * @param provider  AI provider name ('gemini', 'claude', etc.)
 * @param fn        Function that receives (apiKey, keyId) and calls the AI API
 * @param teacherId Optional teacher ID — if set, their own key is tried first
 */
export async function withKeyRotation<T>(
  provider: string,
  fn: (apiKey: string, keyId: string | null) => Promise<T>,
  teacherId?: string
): Promise<T> {
  // ── Build the ordered list of keys to try ────────────────────────────────
  const attempts: Array<{ apiKey: string; keyId: string | null; source: string }> = [];

  // 1. Teacher's own key (highest priority)
  if (teacherId) {
    const teacherKey = await getTeacherKey(teacherId, provider);
    if (teacherKey) {
      attempts.push({ apiKey: teacherKey, keyId: null, source: 'user' });
    }
  }

  // 2. Pool keys from DB (already sorted by priority ASC, error_count ASC)
  let poolKeys: ApiKeyRecord[] = [];
  try {
    poolKeys = await getActiveKeys(provider);
    for (const k of poolKeys) {
      try {
        attempts.push({ apiKey: decryptKey(k.key_encrypted), keyId: k.id, source: 'pool' });
      } catch { /* skip unreadable */ }
    }
  } catch { /* DB unavailable */ }

  // 3. Env var as last resort (only if pool is empty)
  const fallback = getFallbackKey(provider);
  if (fallback && poolKeys.length === 0 && attempts.filter(a => a.source !== 'user').length === 0) {
    attempts.push({ apiKey: fallback, keyId: null, source: 'env' });
  }

  if (attempts.length === 0) {
    throw new Error(
      `No API key configured for provider "${provider}". ` +
      `Add one from the Admin Panel or set the environment variable.`
    );
  }

  // ── Try each key in order ─────────────────────────────────────────────────
  let lastError: Error | null = null;

  for (let i = 0; i < attempts.length; i++) {
    const { apiKey, keyId, source } = attempts[i];
    try {
      const result = await fn(apiKey, keyId);
      // On success: record usage and reset errors for pool keys
      if (keyId && source === 'pool') {
        await recordUsage(keyId);
      }
      return result;
    } catch (err: any) {
      lastError = err;
      const errStr = String(err?.message || '');

      // Detect transient rate-limit / demand errors — do NOT penalize the key
      const isRateLimit =
        err?.status === 429 ||
        err?.statusCode === 429 ||
        errStr.includes('429') ||
        errStr.toLowerCase().includes('quota') ||
        errStr.toLowerCase().includes('resource_exhausted') ||
        errStr.toLowerCase().includes('rate limit') ||
        errStr.toLowerCase().includes('high demand') ||
        errStr.toLowerCase().includes('too many requests');

      // Detect permanent credential errors — penalize key
      const isPermanentError =
        err?.status === 401 || err?.status === 403 ||
        errStr.includes('401') || errStr.includes('403') ||
        errStr.toLowerCase().includes('invalid') ||
        errStr.toLowerCase().includes('unauthorized') ||
        errStr.toLowerCase().includes('permission denied');

      if (keyId && source === 'pool') {
        if (isPermanentError) {
          // Bad credential: increment error count (may lead to deactivation)
          console.warn(`[key-rotator] Permanent credential error on key ${keyId}. Recording error.`);
          await recordError(keyId);
        } else if (isRateLimit) {
          // Transient quota: just update last_error_at without penalizing
          console.warn(`[key-rotator] Rate-limit on key ${keyId}. NOT penalizing — will rotate.`);
          try {
            const sql = getDb();
            await sql`UPDATE api_keys SET last_error_at = NOW() WHERE id = ${keyId}`;
          } catch { /* non-critical */ }
        }
        // Other errors (network, etc.): no DB update
      }

      if ((isRateLimit || !isPermanentError) && i < attempts.length - 1) {
        // Rotate to next key transparently for rate-limits and transient errors
        console.warn(
          `[key-rotator] Key #${i + 1} (${source}:${keyId ?? 'env'}) failed (${
            isRateLimit ? 'rate-limit' : 'transient'
          }). Rotating to key #${i + 2}/${attempts.length}...`
        );
        continue;
      }

      // Permanent error or no more keys — throw immediately
      throw err;
    }
  }

  throw lastError || new Error('All API keys exhausted');
}
