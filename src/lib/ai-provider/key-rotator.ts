import { sql } from '@/lib/db/client';
/**
 * Key rotation utility — v3 (actualizado para gemini-3.x)
 *
 * Mejoras sobre v2:
 * - Eliminados todos los defaults y referencias a modelos legados (gemini-1.5, 2.0, 2.5)
 * - Auto-desactivación: si error_count >= 5, la clave se marca is_active=false
 * - Auto-reactivación: antes de cargar claves, reactiva las que llevan > 5 min sin error
 * - Prioridad de clave de usuario: si se pasa un teacherId, se usa su clave primero
 */

import type { ApiKeyRecord } from './types';
import { logger } from '@/lib/logger';

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
  return sql();
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
  // Balanceador inteligente: Prioriza llaves nunca usadas (NULLS FIRST),
  // luego las menos recientemente usadas (LRU), luego menor conteo de uso y finalmente prioridad
  const rows = await sql`
    SELECT id, label, provider, model_default, key_encrypted, key_preview,
           is_active, priority, usage_count, error_count, last_used_at, last_error_at
    FROM api_keys
    WHERE provider = ${provider} AND is_active = true
    ORDER BY last_used_at ASC NULLS FIRST, usage_count ASC, priority ASC
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

// ── Round-Robin In-Memory Scatterer ──────────────────────────────────────────
// Distribuye equitativamente las peticiones concurrentes entre las distintas llaves del pool
let globalKeyRoundRobinIndex = 0;

export function resetKeyRotationIndexForTesting(): void {
  globalKeyRoundRobinIndex = 0;
}

export interface KeyAttempt {
  apiKey: string;
  keyId: string | null;
  source: 'user' | 'pool' | 'env';
  modelOverride: string | null;
}

/**
 * Devuelve la lista ordenada de claves a intentar para un proveedor:
 * clave del docente → pool de BD (balanceado LRU + Round Robin) → variable de entorno.
 * Se expone para que los flujos de streaming también puedan rotar.
 */
export async function resolveKeyAttempts(
  provider: string,
  teacherId?: string
): Promise<KeyAttempt[]> {
  const attempts: KeyAttempt[] = [];

  // 1. Teacher's own key (highest priority)
  if (teacherId) {
    const teacherKey = await getTeacherKey(teacherId, provider);
    if (teacherKey) {
      attempts.push({ apiKey: teacherKey, keyId: null, source: 'user', modelOverride: null });
    }
  }

  // 2. Pool keys from DB (already sorted by LRU / lowest usage via getActiveKeys)
  let poolKeys: ApiKeyRecord[] = [];
  try {
    poolKeys = await getActiveKeys(provider);
    if (poolKeys.length > 1) {
      // In-memory round-robin offset para dispersar llamadas concurrentes simultáneas
      const offset = (globalKeyRoundRobinIndex++) % poolKeys.length;
      poolKeys = [...poolKeys.slice(offset), ...poolKeys.slice(0, offset)];
    }
    for (const k of poolKeys) {
      try {
        attempts.push({
          apiKey: decryptKey(k.key_encrypted),
          keyId: k.id,
          source: 'pool',
          modelOverride: k.model_default || null,
        });
      } catch { /* skip unreadable */ }
    }
  } catch { /* DB unavailable */ }

  // 3. Env var as last resort (only if pool is empty)
  const fallback = getFallbackKey(provider);
  if (fallback && poolKeys.length === 0 && attempts.filter(a => a.source !== 'user').length === 0) {
    attempts.push({ apiKey: fallback, keyId: null, source: 'env', modelOverride: null });
  }

  return attempts;
}

/**
 * Resolves the best available API key for a given provider.
 * Priority: teacher's own key → pool (LRU + Round-Robin) → env fallback.
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

  // 2. Pool from DB (usando la dispersión balanceada de resolveKeyAttempts)
  try {
    const attempts = await resolveKeyAttempts(provider);
    const poolAttempt = attempts.find(a => a.source === 'pool');
    if (poolAttempt) {
      return {
        apiKey: poolAttempt.apiKey,
        keyId: poolAttempt.keyId,
        modelOverride: poolAttempt.modelOverride,
        source: 'pool',
      };
    }
  } catch (err) {
    logger.warn('[key-rotator] DB lookup failed, using env fallback:', err);
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
 * Límite máximo de vueltas al pool de llaves ante fallas transitorias (429/503).
 * Evita ciclos infinitos o miles de llamadas que puedan provocar bloqueo de cuentas por Google.
 */
export const MAX_POOL_ROUNDS = 2;

/**
 * Wraps an AI API call with automatic key rotation on 429/503 errors.
 * Tries keys up to MAX_POOL_ROUNDS (máximo 2 vueltas completas al pool).
 * Si tras 2 vueltas no hay éxito, el circuito de corte se activa y se detiene inmediatamente.
 *
 * @param provider  AI provider name ('gemini', 'claude', etc.)
 * @param fn        Function that receives (apiKey, keyId) and calls the AI API
 * @param teacherId Optional teacher ID — if set, their own key is tried first
 */
export async function withKeyRotation<T>(
  provider: string,
  fn: (apiKey: string, keyId: string | null, round: number) => Promise<T>,
  teacherId?: string
): Promise<T> {
  // ── Build the ordered list of keys to try ────────────────────────────────
  const attempts = await resolveKeyAttempts(provider, teacherId);

  if (attempts.length === 0) {
    throw new Error(
      `No API key configured for provider "${provider}". ` +
      `Add one from the Admin Panel or set the environment variable.`
    );
  }

  // Límite estricto: máximo 2 vueltas al pool (ej. si hay 6 llaves, máximo 12 intentos totales)
  const maxAttempts = attempts.length * MAX_POOL_ROUNDS;
  let lastError: Error | null = null;
  const permanentlyFailedKeyIds = new Set<string>();

  for (let attemptIndex = 0; attemptIndex < maxAttempts; attemptIndex++) {
    const round = Math.floor(attemptIndex / attempts.length) + 1; // Vuelta 1 o Vuelta 2
    const keyIndex = attemptIndex % attempts.length;
    const { apiKey, keyId, source } = attempts[keyIndex];

    // Si la llave falló por credenciales inválidas (401/403) en la vuelta 1, se ignora en la vuelta 2
    if (keyId && permanentlyFailedKeyIds.has(keyId)) {
      continue;
    }

    try {
      const result = await fn(apiKey, keyId, round);
      // On success: record usage and reset errors for pool keys
      if (keyId && source === 'pool') {
        await recordUsage(keyId);
      }
      return result;
    } catch (err: unknown) {
      const errorObj = err as { status?: number; statusCode?: number; message?: string } | null;
      lastError = err instanceof Error ? err : new Error(String(err));
      const errStr = String(errorObj?.message || err || '');

      // Detect service unavailable / high demand global outages (503)
      const isServiceOutage =
        errorObj?.status === 503 ||
        errorObj?.statusCode === 503 ||
        errStr.includes('503') ||
        errStr.toLowerCase().includes('high demand') ||
        errStr.toLowerCase().includes('service unavailable') ||
        errStr.toLowerCase().includes('overloaded');

      // Detect transient rate-limit / demand errors — do NOT penalize the key
      const isRateLimit =
        isServiceOutage ||
        errorObj?.status === 429 ||
        errorObj?.statusCode === 429 ||
        errStr.includes('429') ||
        errStr.toLowerCase().includes('quota') ||
        errStr.toLowerCase().includes('resource_exhausted') ||
        errStr.toLowerCase().includes('rate limit') ||
        errStr.toLowerCase().includes('too many requests') ||
        errStr.toLowerCase().includes('timeout');

      // Detect permanent credential errors — penalize key
      const isPermanentError =
        errorObj?.status === 401 || errorObj?.status === 403 ||
        errStr.includes('401') || errStr.includes('403') ||
        errStr.toLowerCase().includes('invalid') ||
        errStr.toLowerCase().includes('unauthorized') ||
        errStr.toLowerCase().includes('permission denied');

      if (keyId && source === 'pool') {
        if (isPermanentError) {
          permanentlyFailedKeyIds.add(keyId);
          logger.warn(`[key-rotator] Error permanente de credenciales en llave ${keyId}. Registrando error.`);
          await recordError(keyId);
        } else if (isRateLimit) {
          // Transient quota / high demand: update last_error_at without penalizing error_count
          logger.warn(`[key-rotator] Rate-limit/high-demand en llave ${keyId}. Actualizando timestamp sin penalizar.`);
          try {
            const sql = getDb();
            await sql`UPDATE api_keys SET last_error_at = NOW() WHERE id = ${keyId}`;
          } catch { /* non-critical */ }
        }
        // Other errors (network, etc.): no DB update
      }

      // Si es un error permanente de credencial (401/403) y NO es del pool (ej. llave fija del docente) o no hay más llaves, abortar de inmediato
      if (isPermanentError && (source !== 'pool' || attempts.length === 1)) {
        throw err;
      }

      // Si aún restan intentos dentro de las 2 vueltas máximas permitidas:
      if (attemptIndex < maxAttempts - 1) {
        const nextAttempt = attemptIndex + 1;
        const nextRound = Math.floor(nextAttempt / attempts.length) + 1;
        const nextKeyIdx = nextAttempt % attempts.length;

        logger.warn(
          `[key-rotator] Intento ${attemptIndex + 1}/${maxAttempts} (Llave #${keyIndex + 1}, Vuelta ${round}/${MAX_POOL_ROUNDS}) falló (${
            isPermanentError ? 'credencial inválida' : isRateLimit ? 'cuota/503' : 'transitorio'
          }). Rotando a llave #${nextKeyIdx + 1} (Vuelta ${nextRound})...`
        );

        // Si fue credencial inválida, rotamos de inmediato sin esperar backoff
        // Si fue cuota/503, aplicamos backoff: si cambiamos de vuelta (Round 1 -> Round 2),
        // damos una pausa de enfriamiento de 3000ms para que Google disipe el pico de demanda (503).
        if (!isPermanentError) {
          const isTransitioningRound = nextRound > round;
          const backoffMs = isTransitioningRound
            ? (process.env.NODE_ENV === 'test' ? 10 : 3000)
            : Math.min(1500, 250 * Math.pow(1.5, keyIndex));
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
        }
        continue;
      }

      // Se completaron las 2 vueltas máximas o es un error no recuperable -> CORTAR TERMINANTEMENTE
      logger.error(
        `[key-rotator] 🛑 LÍMITE DE SEGURIDAD ALCANZADO: Se completaron ${MAX_POOL_ROUNDS} vueltas completas (${maxAttempts} intentos) al pool de "${provider}" sin éxito. Deteniendo rotación inmediatamente para proteger las llaves de bloqueo por Google.`
      );
      throw lastError;
    }
  }

  throw lastError || new Error(`[key-rotator] Pool agotado tras ${MAX_POOL_ROUNDS} vueltas máximas de seguridad.`);
}
