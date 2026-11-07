import { sql } from '@/lib/db/client';
/**
 * key-rotator.ts — Gateway Único de IA y Rotador Atómico de Claves
 * SIGPDA-EMS · MCCEMS 2026-2027
 *
 * Características clave:
 * - Selección atómica en PostgreSQL Neon mediante `FOR UPDATE SKIP LOCKED`.
 * - Exclusión efectiva en SQL de claves ya intentadas (`excludeKeyIds`).
 * - Exclusión de clave docente y clave env tras su primer fallo para evitar bucles.
 * - Cooldown diferenciado estricto:
 *     * Errores 401/403 (permanentes): incrementa error_count y desactiva tras 5 fallos.
 *     * Errores 429/503 (transitorios): actualiza last_error_at (45s de enfriamiento)
 *       y NUNCA incrementa error_count ni desactiva la clave.
 * - Reactivación de claves con parametrización SQL segura:
 *     `NOW() - (${COOLDOWN_PERMANENT_MINUTES} * INTERVAL '1 minute')`.
 * - Invariante estricto de conteo:
 *     * claimApiKey SOLO actualiza last_used_at = NOW().
 *     * usage_count se incrementa ÚNICAMENTE en recordUsage cuando la llamada HTTP devuelve 200 OK.
 * - Fast-fail tras 2 errores 503 consecutivos de Google Gemini.
 * - Timeout y deadline dinámicos reales: calcula remainingBudgetMs y clamped timeoutMs por intento.
 * - Circuito de corte estricto: máximo 2 vueltas al pool de llaves (MAX_POOL_ROUNDS = 2).
 */

import type { ApiKeyRecord } from './types';
import { logger } from '@/lib/logger';

// ── Tipos y Errores Tipados ──────────────────────────────────────────────────

export class AiServiceUnavailableError extends Error {
  readonly status = 503;
  readonly statusCode = 503;
  readonly isUpstreamAIError = true;

  constructor(
    message = 'El servicio de IA upstream no se encuentra disponible temporalmente debido a alta demanda (HTTP 503).'
  ) {
    super(message);
    this.name = 'AiServiceUnavailableError';
  }
}

export class AiCooldownExhaustedError extends AiServiceUnavailableError {
  constructor(
    message = 'Todas las claves de IA se encuentran actualmente en período de enfriamiento por cuota (HTTP 503).'
  ) {
    super(message);
    this.name = 'AiCooldownExhaustedError';
  }
}

// ── Constantes Operativas de Seguridad ────────────────────────────────────────

export const COOLDOWN_TRANSIENT_SECONDS = 45; // 45 segundos para 429 y 503
export const MAX_PERMANENT_ERRORS = 5;         // 5 errores 401/403 antes de desactivar
export const FAST_FAIL_503_THRESHOLD = 2;      // 2 errores 503 consecutivos disparan fast-fail
export const MAX_POOL_ROUNDS = 2;              // Máximo 2 vueltas completas al pool
export const COOLDOWN_PERMANENT_MINUTES = 60;  // Auto-reactivación tras 60 min de errores permanentes

export function getFastFail503Threshold(): number {
  const raw = Number(process.env.AI_FAST_FAIL_503_THRESHOLD);
  if (Number.isInteger(raw) && raw >= 1 && raw <= 10) return raw;
  return FAST_FAIL_503_THRESHOLD;
}

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

// ── DB Client Helper ─────────────────────────────────────────────────────────

function getDb() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  return sql();
}

/**
 * Lanza una excepción si el AbortSignal ya ha sido abortado.
 */
function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw (signal.reason instanceof Error
      ? signal.reason
      : new DOMException('The operation was aborted', 'AbortError'));
  }
}

/**
 * Espera `ms` milisegundos respetando cancelación inmediata por AbortSignal.
 */
async function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  throwIfAborted(signal);
  if (ms <= 0) return;

  return new Promise((resolve, reject) => {
    let timer: NodeJS.Timeout | null = null;
    const onAbort = () => {
      if (timer) clearTimeout(timer);
      reject(
        signal?.reason instanceof Error
          ? signal.reason
          : new DOMException('The operation was aborted', 'AbortError')
      );
    };

    timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Auto-reactiva claves desactivadas por errores permanentes tras el período de cooldown.
 * Utiliza parametrización SQL segura sin interpolar texto en strings SQL.
 */
export async function reactivateCooledKeys(provider: string): Promise<number> {
  const db = getDb();
  const rows = await db`
    UPDATE api_keys
    SET is_active = true, error_count = 0
    WHERE provider   = ${provider}
      AND is_active  = false
      AND last_error_at IS NOT NULL
      AND last_error_at < NOW() - (${COOLDOWN_PERMANENT_MINUTES} * INTERVAL '1 minute')
    RETURNING id;
  `;
  return rows ? rows.length : 0;
}

/**
 * Fallback a variable de entorno cuando el pool en base de datos está vacío.
 */
function getFallbackKey(provider: string): string | null {
  if (provider === 'gemini') return process.env.GEMINI_API_KEY || null;
  if (provider === 'claude') return process.env.ANTHROPIC_API_KEY || null;
  if (provider === 'openai') return process.env.OPENAI_API_KEY || null;
  if (provider === 'nvidia') return process.env.NVIDIA_API_KEY || null;
  return null;
}

/**
 * Obtiene la clave personalizada del docente si está configurada.
 */
async function getTeacherKey(teacherId: string, provider: string): Promise<string | null> {
  try {
    const db = getDb();
    const rows = await db`
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

export interface ResolvedKey {
  apiKey: string;
  keyId: string | null;    // null para clave de usuario o variable de entorno
  modelOverride: string | null;
  source: 'user' | 'pool' | 'env';
}

export interface ClaimOptions {
  teacherId?: string;
  excludeKeyIds?: Set<string>;
  excludeTeacherKey?: boolean;
  excludeEnv?: boolean;
  maxWaitMs?: number;
  signal?: AbortSignal;
  requirePool?: boolean;
}

/**
 * Reclama de forma atómica la mejor clave disponible mediante `FOR UPDATE SKIP LOCKED`.
 * - Invariante 1: actualiza last_used_at = NOW() de forma atómica en DB.
 * - Invariante 2: NO incrementa usage_count.
 * - Aplica excludeKeyIds estrictamente en la consulta SQL.
 * - Permite excluir la clave docente o env tras fallar una vez para no reintentar la misma clave en bucle.
 * - Respeta cancelación por AbortSignal.
 */
export async function claimApiKey(
  provider: string,
  options?: ClaimOptions
): Promise<ResolvedKey | null> {
  throwIfAborted(options?.signal);

  // 1. Clave personalizada del docente (prioridad absoluta salvo que haya fallado)
  if (options?.teacherId && !options?.excludeTeacherKey) {
    const teacherKey = await getTeacherKey(options.teacherId, provider);
    if (teacherKey) {
      return { apiKey: teacherKey, keyId: null, modelOverride: null, source: 'user' };
    }
  }

  // 2. Selección atómica en PostgreSQL (Neon) con exclusión efectiva en SQL
  try {
    const db = getDb();
    try {
      await reactivateCooledKeys(provider);
    } catch (reactivateErr) {
      logger.debug('[key-rotator] Error reactivando claves enfriadas:', reactivateErr);
    }

    throwIfAborted(options?.signal);

    const excludedList = options?.excludeKeyIds && options.excludeKeyIds.size > 0
      ? Array.from(options.excludeKeyIds)
      : [];

    const rows = await db`
      WITH candidate AS (
        SELECT id
        FROM api_keys
        WHERE provider = ${provider}
          AND is_active = true
          AND (last_error_at IS NULL OR last_error_at < NOW() - INTERVAL '45 seconds')
          AND (
            ${excludedList.length === 0}::boolean
            OR NOT (id = ANY(${excludedList}::uuid[]))
          )
        ORDER BY last_used_at ASC NULLS FIRST, usage_count ASC, priority ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE api_keys
      SET last_used_at = NOW()
      FROM candidate
      WHERE api_keys.id = candidate.id
      RETURNING api_keys.id, api_keys.label, api_keys.provider, api_keys.model_default,
                api_keys.key_encrypted, api_keys.key_preview, api_keys.is_active,
                api_keys.priority, api_keys.usage_count, api_keys.error_count,
                api_keys.last_used_at, api_keys.last_error_at;
    `;

    if (rows && rows.length > 0) {
      const record = rows[0] as ApiKeyRecord;
      return {
        apiKey: decryptKey(record.key_encrypted),
        keyId: record.id,
        modelOverride: record.model_default || null,
        source: 'pool',
      };
    }

    // Comprobar si todas las claves activas no excluidas están en cooldown
    const cooldownKeys = await db`
      SELECT id, last_error_at
      FROM api_keys
      WHERE provider = ${provider}
        AND is_active = true
        AND (
          ${excludedList.length === 0}::boolean
          OR NOT (id = ANY(${excludedList}::uuid[]))
        )
      ORDER BY last_error_at ASC
      LIMIT 1;
    `;

    if (cooldownKeys && cooldownKeys.length > 0 && cooldownKeys[0].last_error_at) {
      const earliestError = new Date(cooldownKeys[0].last_error_at).getTime();
      const cooldownEnds = earliestError + COOLDOWN_TRANSIENT_SECONDS * 1000;
      const remainingMs = cooldownEnds - Date.now();
      const maxWait = options?.maxWaitMs ?? 5000;

      // Esperar solo si cabe de forma segura dentro del presupuesto de tiempo restante
      if (remainingMs > 0 && remainingMs <= maxWait) {
        throwIfAborted(options?.signal);
        logger.info(
          `[key-rotator] Todas las claves de "${provider}" en cooldown transitorio. Esperando ${remainingMs}ms para recuperación...`
        );
        await abortableSleep(remainingMs + 100, options?.signal);
        return claimApiKey(provider, { ...options, maxWaitMs: 0 });
      } else if (remainingMs > 0) {
        throw new AiCooldownExhaustedError(
          `Todas las claves de "${provider}" están en enfriamiento por cuota (restan ${Math.ceil(remainingMs / 1000)}s). Cortando por deadline.`
        );
      }
    }
  } catch (err) {
    if (err instanceof Error && (err.name === 'AbortError' || err.message.toLowerCase().includes('aborted'))) {
      throw err;
    }
    if (err instanceof AiServiceUnavailableError || err instanceof AiCooldownExhaustedError) throw err;
    logger.warn('[key-rotator] Error durante claim atómico en Neon DB:', err);
    if (options?.requirePool) {
      throw err;
    }
  }

  // 3. Fallback a variable de entorno (solo si no fue excluida tras fallo)
  if (!options?.excludeEnv) {
    const envKey = getFallbackKey(provider);
    if (envKey) {
      return { apiKey: envKey, keyId: null, modelOverride: null, source: 'env' };
    }
  }

  return null;
}

/**
 * Incrementa el conteo de uso (usage_count) de una clave del pool.
 * REGLA ESTRICTA: SOLO debe invocarse cuando la llamada HTTP devolvió 200 OK.
 * NO actualiza last_used_at para evitar doble conteo/actualización redundante.
 */
export async function recordUsage(keyId: string): Promise<void> {
  try {
    const db = getDb();
    await db`
      UPDATE api_keys
      SET usage_count = usage_count + 1
      WHERE id = ${keyId}
    `;
  } catch {
    // Non-critical
  }
}

/**
 * Registra un error sobre una clave del pool con política diferenciada:
 * - 'permanent' (401/403): incrementa error_count y desactiva si alcanza MAX_PERMANENT_ERRORS (5).
 * - 'transient' (429/503): actualiza last_error_at = NOW() (iniciando enfriamiento de 45s).
 *    NUNCA incrementa error_count ni desactiva la clave.
 */
export async function recordError(
  keyId: string,
  errorType: 'permanent' | 'transient'
): Promise<void> {
  try {
    const db = getDb();
    if (errorType === 'permanent') {
      await db`
        UPDATE api_keys
        SET error_count   = error_count + 1,
            last_error_at = NOW(),
            is_active     = CASE
              WHEN error_count + 1 >= ${MAX_PERMANENT_ERRORS} THEN false
              ELSE is_active
            END
        WHERE id = ${keyId}
      `;
    } else {
      await db`
        UPDATE api_keys
        SET last_error_at = NOW()
        WHERE id = ${keyId}
      `;
    }
  } catch {
    // Non-critical
  }
}

/**
 * Devuelve la lista de claves activas ordenada por LRU en DB (para compatibilidad de inspección).
 */
export async function getActiveKeys(provider: string): Promise<ApiKeyRecord[]> {
  await reactivateCooledKeys(provider);
  const db = getDb();
  const rows = await db`
    SELECT id, label, provider, model_default, key_encrypted, key_preview,
           is_active, priority, usage_count, error_count, last_used_at, last_error_at
    FROM api_keys
    WHERE provider = ${provider} AND is_active = true
    ORDER BY last_used_at ASC NULLS FIRST, usage_count ASC, priority ASC
  `;
  return rows as ApiKeyRecord[];
}

export interface KeyAttempt {
  apiKey: string;
  keyId: string | null;
  source: 'user' | 'pool' | 'env';
  modelOverride: string | null;
}

/**
 * Devuelve la lista ordenada de claves para streaming o inspección.
 */
export async function resolveKeyAttempts(
  provider: string,
  teacherId?: string
): Promise<KeyAttempt[]> {
  const attempts: KeyAttempt[] = [];

  if (teacherId) {
    const teacherKey = await getTeacherKey(teacherId, provider);
    if (teacherKey) {
      attempts.push({ apiKey: teacherKey, keyId: null, source: 'user', modelOverride: null });
    }
  }

  let poolKeys: ApiKeyRecord[] = [];
  try {
    poolKeys = await getActiveKeys(provider);
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

  const fallback = getFallbackKey(provider);
  if (fallback && poolKeys.length === 0 && attempts.filter(a => a.source !== 'user').length === 0) {
    attempts.push({ apiKey: fallback, keyId: null, source: 'env', modelOverride: null });
  }

  return attempts;
}

/**
 * Resuelve una clave de API válida reclamándola atómicamente.
 */
export async function resolveKey(
  provider: string,
  teacherId?: string
): Promise<ResolvedKey> {
  const claimed = await claimApiKey(provider, { teacherId });
  if (claimed) return claimed;

  throw new AiServiceUnavailableError(
    `No hay API Key disponible para el proveedor "${provider}". Agrega una en el Panel de Administración.`
  );
}

export function resetKeyRotationIndexForTesting(): void {
  // Mantenido como no-op para compatibilidad de suite de tests
}

export interface AttemptMetadata {
  timeoutMs: number;
  remainingBudgetMs?: number;
  round: number;
}

/**
 * Ejecuta una llamada de IA con rotación atómica de claves sobre Neon DB.
 *
 * Garantías:
 * 1. Fast-fail tras 2 errores 503 consecutivos de Google Gemini (corta inmediatamente).
 * 2. Cero doble incremento de usage_count (solo tras HTTP 200).
 * 3. Cooldown diferenciado: 429/503 solo actualiza last_error_at.
 * 4. Exclusión de teacherKey y env tras fallo para evitar bucles de reintento.
 * 5. Timeouts dinámicos clampeados: calcula remainingBudget y timeout por intento.
 * 6. Máximo 2 vueltas al pool (MAX_POOL_ROUNDS = 2).
 */
export async function withKeyRotation<T>(
  provider: string,
  fn: (apiKey: string, keyId: string | null, round: number, meta: AttemptMetadata) => Promise<T>,
  options?: {
    teacherId?: string;
    remainingBudgetMs?: number;
    timeoutPerAttemptMs?: number;
    signal?: AbortSignal;
  } | string
): Promise<T> {
  const teacherId = typeof options === 'string' ? options : options?.teacherId;
  const remainingBudgetMs = typeof options === 'object' ? options?.remainingBudgetMs : undefined;
  const timeoutPerAttemptMs = typeof options === 'object' ? options?.timeoutPerAttemptMs : undefined;
  const signal = typeof options === 'object' ? options?.signal : undefined;

  throwIfAborted(signal);

  let poolSize = 6;
  try {
    const db = getDb();
    const rows = await db`SELECT COUNT(*)::int as cnt FROM api_keys WHERE provider = ${provider} AND is_active = true`;
    if (rows && rows[0]?.cnt) poolSize = Math.max(1, Number(rows[0].cnt));
  } catch { /* fallback to 6 */ }

  const maxAttempts = poolSize * MAX_POOL_ROUNDS;
  let lastError: Error | null = null;
  let consecutive503Count = 0;
  let excludeTeacherKey = false;
  let excludeEnv = false;
  const permanentlyFailedKeyIds = new Set<string>();
  const triedKeyIdsInRound = new Set<string>();

  const startTime = Date.now();
  const deadline = remainingBudgetMs ? startTime + remainingBudgetMs : null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    throwIfAborted(signal);

    const round = Math.floor(attempt / poolSize) + 1;

    // Al cambiar de vuelta, se reinicia la lista de llaves intentadas en la ronda
    if (attempt % poolSize === 0) {
      triedKeyIdsInRound.clear();
    }

    // Comprobar deadline global antes de reclamar
    const preClaimNow = Date.now();
    const preClaimRemaining = deadline ? Math.max(0, deadline - preClaimNow) : undefined;
    if (preClaimRemaining !== undefined && preClaimRemaining <= 1) {
      throw new AiServiceUnavailableError(
        'El presupuesto de tiempo de ejecución de la solicitud se agotó antes del siguiente intento.'
      );
    }

    let claimed: ResolvedKey | null = null;
    try {
      claimed = await claimApiKey(provider, {
        teacherId: excludeTeacherKey ? undefined : teacherId,
        excludeKeyIds: new Set([...permanentlyFailedKeyIds, ...triedKeyIdsInRound]),
        excludeTeacherKey,
        excludeEnv,
        maxWaitMs: preClaimRemaining ? Math.min(5000, preClaimRemaining / 2) : 5000,
        signal,
      });
    } catch (claimErr) {
      if (claimErr instanceof Error && (claimErr.name === 'AbortError' || claimErr.message.toLowerCase().includes('aborted'))) {
        throw claimErr;
      }
      if (claimErr instanceof AiServiceUnavailableError || claimErr instanceof AiCooldownExhaustedError) throw claimErr;
      logger.warn('[key-rotator] Error reclamando clave:', claimErr);
    }

    if (!claimed) {
      throw new AiServiceUnavailableError(
        `No hay claves de API disponibles para "${provider}". Verifica el estado en el Panel de Administración.`
      );
    }

    throwIfAborted(signal);

    // Recalcular deadline y presupuesto restante DESPUÉS del claim (por si hubo espera de cooldown)
    const postClaimNow = Date.now();
    const currentRemaining = deadline ? Math.max(0, deadline - postClaimNow) : undefined;
    if (currentRemaining !== undefined && currentRemaining <= 1) {
      throw new AiServiceUnavailableError(
        'El presupuesto de tiempo de ejecución de la solicitud se agotó durante el reclamo de la clave de IA.'
      );
    }

    const defaultAttemptTimeout = timeoutPerAttemptMs ?? 60000;
    const attemptTimeout = currentRemaining !== undefined
      ? Math.max(1, Math.min(defaultAttemptTimeout, currentRemaining))
      : defaultAttemptTimeout;

    const { apiKey, keyId, source } = claimed;

    if (keyId && permanentlyFailedKeyIds.has(keyId)) {
      continue;
    }

    try {
      const result = await fn(apiKey, keyId, round, {
        timeoutMs: attemptTimeout,
        remainingBudgetMs: currentRemaining,
        round,
      });

      // Éxito HTTP 200: incrementar conteo de uso una sola vez
      if (keyId && source === 'pool') {
        await recordUsage(keyId);
      }
      return result;
    } catch (err: unknown) {
      const errStr = String((err as { message?: string })?.message || err || '');
      const isTimeout =
        (err instanceof Error && err.name === 'TimeoutError') ||
        errStr.toLowerCase().includes('timeout') ||
        errStr.toLowerCase().includes('timed out');

      const isAbort =
        !isTimeout &&
        (Boolean(signal?.aborted) ||
          (err instanceof Error && err.name === 'AbortError'));

      if (isAbort) {
        // Cancelación solicitada por el cliente: NO registrar error a la clave,
        // NO rotar a otras llaves, cortar de inmediato sin ensuciar balanceo.
        throw (err instanceof Error
          ? err
          : (signal?.reason instanceof Error
              ? signal.reason
              : new DOMException('The operation was aborted', 'AbortError')));
      }

      lastError = err instanceof Error ? err : new Error(String(err));
      const errorObj = err as { status?: number; statusCode?: number; message?: string } | null;
      if (errorObj?.message) {
        // Enriquecer errStr si viene en el objeto estructurado
        // errStr ya contiene err.message
      }

      const is503 =
        errorObj?.status === 503 ||
        errorObj?.statusCode === 503 ||
        errStr.includes('503') ||
        errStr.toLowerCase().includes('high demand') ||
        errStr.toLowerCase().includes('service unavailable') ||
        errStr.toLowerCase().includes('overloaded');

      const is429 =
        !is503 &&
        (errorObj?.status === 429 ||
         errorObj?.statusCode === 429 ||
         errStr.includes('429') ||
         errStr.toLowerCase().includes('quota') ||
         errStr.toLowerCase().includes('resource_exhausted') ||
         errStr.toLowerCase().includes('rate limit') ||
         errStr.toLowerCase().includes('too many requests'));

      const isPermanent =
        errorObj?.status === 401 ||
        errorObj?.status === 403 ||
        errStr.includes('401') ||
        errStr.includes('403') ||
        errStr.toLowerCase().includes('invalid api key') ||
        errStr.toLowerCase().includes('unauthorized') ||
        errStr.toLowerCase().includes('permission denied');

      // Marcar para exclusión en siguientes intentos según origen
      if (source === 'user') {
        excludeTeacherKey = true;
      } else if (source === 'env') {
        excludeEnv = true;
      } else if (keyId && source === 'pool') {
        triedKeyIdsInRound.add(keyId);
        if (isPermanent) {
          permanentlyFailedKeyIds.add(keyId);
          await recordError(keyId, 'permanent');
        } else if (is503 || is429 || isTimeout) {
          await recordError(keyId, 'transient');
        }
      }

      if (isPermanent && (source !== 'pool' || poolSize <= 1)) {
        throw err;
      }

      // Regla Fast-Fail estricta: 2 errores 503 consecutivos
      if (is503) {
        const fastFailThreshold = getFastFail503Threshold();
        consecutive503Count++;
        if (consecutive503Count >= fastFailThreshold) {
          logger.warn(
            `[key-rotator] 🛑 FAST-FAIL: ${fastFailThreshold} errores 503 consecutivos en "${provider}". Cortando inmediatamente para proteger las cuentas.`
          );
          throw new AiServiceUnavailableError(
            `Google Gemini está experimentando alta demanda (HTTP 503). Fast-fail activado tras ${fastFailThreshold} errores consecutivos.`
          );
        }
        if (attempt < maxAttempts - 1) {
          const wait503Ms = process.env.NODE_ENV === 'test' ? 100 : 4000;
          await new Promise((r) => setTimeout(r, wait503Ms));
        }
      } else {
        consecutive503Count = 0;
      }

      if (attempt < maxAttempts - 1) {
        logger.warn(
          `[key-rotator] Intento ${attempt + 1}/${maxAttempts} (Vuelta ${round}) falló (${
            isPermanent
              ? 'credencial inválida'
              : is503
              ? '503 alta demanda'
              : is429
              ? 'cuota 429'
              : isTimeout
              ? 'timeout de intento'
              : 'error transitorio'
          }). Rotando a siguiente clave...`
        );
        continue;
      }
    }
  }

  throw (
    lastError ||
    new AiServiceUnavailableError(`Pool de "${provider}" agotado tras ${MAX_POOL_ROUNDS} vueltas máximas.`)
  );
}
