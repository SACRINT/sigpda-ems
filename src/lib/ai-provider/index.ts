import { sql } from '@/lib/db/client';
/**
 * AI Provider Factory — Gateway Único de IA de SIGPDA-EMS
 * MCCEMS Ciclo Escolar 2026-2027
 *
 * Puntos de entrada unificados:
 * - getAIProvider: Obtiene instancia de AIProvider con resolución atómica y envoltura de rotación
 * - generateWithRotation: Generación de texto estructurado con rotación atómica y deadlines dinámicos
 * - generateStreamWithRotation: Generación streaming con rotación atómica y pool real
 * - generateMultimodalWithRotation: Generación multimodal/visión con rotación atómica y schema JSON
 * - generateMultimodalWithMetadata: Extracción multimodal con metadatos de tokens
 *
 * Políticas estrictas de costo y resiliencia:
 * - Exclusivamente Gemini gratuito activo por defecto.
 * - Sin desvíos a APIs de pago (OpenRouter, OpenAI, Claude, Mistral) no autorizados.
 * - Si el pool gratuito de Gemini se agota o satura, se devuelve error controlado HTTP 503
 *   mediante `AiServiceUnavailableError` (reconocido por `isUpstreamAIError`).
 */

import {
  withKeyRotation,
  resolveKey,
  claimApiKey,
  recordUsage,
  recordError,
  AiServiceUnavailableError,
  AiCooldownExhaustedError,
  MAX_POOL_ROUNDS,
  getFastFail503Threshold,
  type AttemptMetadata,
} from './key-rotator';
import { GeminiProvider, sanitizeGeminiModel } from './gemini';
import { ClaudeProvider } from './claude';
import { OpenAICompatibleProvider } from './openai';
import type { AIProvider, AiTokenUsage, MultimodalResult } from './types';
import { logger } from '@/lib/logger';
import { resolveUserIsPremium } from './resolve-premium';

export type { AIProvider, AiTokenUsage, MultimodalResult };
export {
  resolveUserIsPremium,
  resolveKey,
  claimApiKey,
  recordUsage,
  recordError,
  AiServiceUnavailableError,
  AiCooldownExhaustedError,
};

// ── Default model constants ──────────────────────────────────────────────────
export const DEFAULT_STANDARD_MODEL = 'gemini-3.5-flash-lite';
export const DEFAULT_STANDARD_PROVIDER = 'gemini';
export const DEFAULT_PREMIUM_MODEL = 'gemini-3.5-flash-lite';
export const DEFAULT_PREMIUM_PROVIDER = 'gemini';

// ── Default models per provider ──────────────────────────────────────────────
export const DEFAULT_MODEL_BY_PROVIDER: Record<string, string> = {
  gemini:     'gemini-3.5-flash-lite',
  claude:     'claude-haiku-4-5',
  openai:     'gpt-4o-mini',
  nvidia:     'meta/llama-3.1-70b-instruct',
  qwen:       'qwen-turbo',
  mistral:    'mistral-small-latest',
  openrouter: process.env.OPENROUTER_FALLBACK_MODEL || 'openrouter/free',
};

// ── Read active provider config from DB ──────────────────────────────────────

interface ActiveConfig {
  provider: string;
  model: string;
}

/**
 * Returns provider + model config based on user tier.
 * @param isPremium - true for admins, supervisors, or users with is_premium=true
 */
async function getActiveConfig(isPremium = false): Promise<ActiveConfig> {
  try {
    if (!process.env.DATABASE_URL) throw new Error('no db');
    const db = sql();
    const rows = await db`
      SELECT key, value FROM platform_config
      WHERE key IN ('active_provider', 'active_model', 'admin_provider', 'admin_model')
    `;
    const map: Record<string, string> = {};
    for (const row of rows) map[row.key] = row.value;

    if (isPremium) {
      const provider = map['admin_provider'] || DEFAULT_PREMIUM_PROVIDER;
      const rawModel = map['admin_model']    || DEFAULT_PREMIUM_MODEL;
      return {
        provider,
        model: provider === 'gemini' ? sanitizeGeminiModel(rawModel) : rawModel,
      };
    }
    const provider = map['active_provider'] || DEFAULT_STANDARD_PROVIDER;
    const rawModel = map['active_model']    || DEFAULT_STANDARD_MODEL;
    return {
      provider,
      model: provider === 'gemini' ? sanitizeGeminiModel(rawModel) : rawModel,
    };
  } catch {
    // Fallback if DB is unavailable
    if (isPremium) return { provider: DEFAULT_PREMIUM_PROVIDER, model: DEFAULT_PREMIUM_MODEL };
    return { provider: DEFAULT_STANDARD_PROVIDER, model: DEFAULT_STANDARD_MODEL };
  }
}

// ── Provider factory ─────────────────────────────────────────────────────────

function buildProvider(provider: string, model: string, apiKey: string): AIProvider {
  switch (provider) {
    case 'gemini':
      return new GeminiProvider(apiKey, model);
    case 'claude':
      return new ClaudeProvider(apiKey, model);
    case 'openai':
    case 'nvidia':
    case 'qwen':
    case 'mistral':
    case 'openrouter':
      return new OpenAICompatibleProvider(apiKey, provider, model);
    default:
      return new GeminiProvider(apiKey, model);
  }
}

/**
 * Returns an AIProvider instance. Calls to .generate() and .generateStream()
 * are automatically routed through the centralized rotation gateway.
 * @param isPremium - set true for admins or premium-authorized users
 */
export async function getAIProvider(isPremium = false): Promise<AIProvider> {
  const { provider, model } = await getActiveConfig(isPremium);

  return {
    providerId: provider,
    modelId: model,
    async generate(systemPrompt, userPrompt, options) {
      return generateWithRotation(systemPrompt, userPrompt, undefined, isPremium, options);
    },
    async *generateStream(systemPrompt, userPrompt, options) {
      yield* generateStreamWithRotation(systemPrompt, userPrompt, undefined, isPremium, options);
    },
  };
}

/**
 * Generates text with automatic atomic key rotation on quota / 503 errors.
 * Dynamically wires deadlines, attempt timeouts, and structured output.
 *
 * @param isPremium - set true for admins or premium-authorized users
 */
export async function generateWithRotation(
  systemPrompt: string,
  userPrompt: string,
  teacherId?: string,
  isPremium = false,
  options?: {
    temperature?: number;
    jsonMode?: boolean;
    maxTokens?: number;
    timeoutMs?: number;
    remainingBudgetMs?: number;
    signal?: AbortSignal;
    responseSchema?: object;
  }
): Promise<string> {
  const { provider, model } = await getActiveConfig(isPremium);

  return withKeyRotation(
    provider,
    async (apiKey, _keyId, round, meta: AttemptMetadata) => {
      // Si la Vuelta 1 sufrió 503/429 en Google, en Vuelta 2 probamos con gemini-3.1-flash-lite
      const effectiveModel =
        provider === 'gemini' && round === 2 && model === 'gemini-3.5-flash-lite'
          ? 'gemini-3.1-flash-lite'
          : model;
      const ai = buildProvider(provider, effectiveModel, apiKey);
      return ai.generate(systemPrompt, userPrompt, {
        ...options,
        timeoutMs: meta?.timeoutMs ?? options?.timeoutMs,
        remainingBudgetMs: meta?.remainingBudgetMs ?? options?.remainingBudgetMs,
      });
    },
    {
      teacherId,
      remainingBudgetMs: options?.remainingBudgetMs,
      timeoutPerAttemptMs: options?.timeoutMs ?? 60000,
      signal: options?.signal,
    }
  );
}

/**
 * Generates a stream with automatic atomic key rotation.
 * Respects real pool size, MAX_POOL_ROUNDS, and excludes failed keys in SQL.
 * Returns an AsyncGenerator<string>.
 *
 * @param isPremium - set true for admins or premium-authorized users
 */
export async function* generateStreamWithRotation(
  systemPrompt: string,
  userPrompt: string,
  teacherId?: string,
  isPremium = false,
  options?: {
    timeoutMs?: number;
    remainingBudgetMs?: number;
    signal?: AbortSignal;
    jsonMode?: boolean;
    maxTokens?: number;
    responseSchema?: object;
  }
): AsyncGenerator<string> {
  const { provider, model } = await getActiveConfig(isPremium);

  let poolSize = 6;
  try {
    const db = sql();
    const rows = await db`SELECT COUNT(*)::int as cnt FROM api_keys WHERE provider = ${provider} AND is_active = true`;
    if (rows && rows[0]?.cnt) poolSize = Math.max(1, Number(rows[0].cnt));
  } catch { /* fallback */ }

  const maxAttempts = poolSize * MAX_POOL_ROUNDS;
  let emittedAnyChunk = false;
  let lastError: unknown = null;
  const permanentlyFailedKeyIds = new Set<string>();
  const triedKeyIdsInRound = new Set<string>();
  let consecutive503Count = 0;
  let excludeTeacherKey = false;
  let excludeEnv = false;

  const startTime = Date.now();
  const deadline = options?.remainingBudgetMs ? startTime + options.remainingBudgetMs : null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (options?.signal?.aborted) {
      throw (options.signal.reason instanceof Error
        ? options.signal.reason
        : new DOMException('The operation was aborted', 'AbortError'));
    }

    // Reiniciar llaves transitorias intentadas al cambiar de vuelta
    if (attempt % poolSize === 0) {
      triedKeyIdsInRound.clear();
    }

    const now = Date.now();
    const currentRemaining = deadline ? Math.max(0, deadline - now) : undefined;
    if (currentRemaining !== undefined && currentRemaining <= 1) {
      throw new AiServiceUnavailableError(
        'El presupuesto de tiempo de ejecución de la solicitud se agotó antes del siguiente intento de streaming.'
      );
    }

    const claimed = await claimApiKey(provider, {
      teacherId: excludeTeacherKey ? undefined : teacherId,
      excludeKeyIds: new Set([...permanentlyFailedKeyIds, ...triedKeyIdsInRound]),
      excludeTeacherKey,
      excludeEnv,
      maxWaitMs: currentRemaining ? Math.min(5000, currentRemaining / 2) : 5000,
      signal: options?.signal,
    });

    if (!claimed) {
      throw new AiServiceUnavailableError(
        `No hay claves de API disponibles para streaming en "${provider}".`
      );
    }

    const { apiKey, keyId, source, modelOverride } = claimed;

    const ai = buildProvider(provider, modelOverride || model, apiKey);

    try {
      const streamOptions = {
        timeoutMs: currentRemaining ? Math.max(1, Math.min(options?.timeoutMs ?? 110000, currentRemaining)) : options?.timeoutMs,
        remainingBudgetMs: currentRemaining,
        signal: options?.signal,
        jsonMode: options?.jsonMode,
        maxTokens: options?.maxTokens,
        responseSchema: options?.responseSchema,
      };

      for await (const chunk of (ai as GeminiProvider).generateStream(systemPrompt, userPrompt, streamOptions)) {
        emittedAnyChunk = true;
        yield chunk;
      }
      if (keyId && source === 'pool') {
        await recordUsage(keyId);
      }
      return;
    } catch (err: unknown) {
      const isAbort =
        options?.signal?.aborted ||
        (err instanceof Error && (err.name === 'AbortError' || err.message.toLowerCase().includes('aborted')));
      if (isAbort) {
        throw (err instanceof Error ? err : new DOMException('The operation was aborted', 'AbortError'));
      }

      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isPermanent = /401|403|unauthorized|permission denied/i.test(msg);
      const is503 = !isPermanent && /503|UNAVAILABLE|high demand|service unavailable|overloaded/i.test(msg);
      const isQuota429 = !isPermanent && !is503 && /429|RESOURCE_EXHAUSTED|rate.?limit/i.test(msg);
      const isNetworkOrTimeout = !isPermanent && !is503 && !isQuota429 && /timeout|econnreset|fetch failed|network|socket/i.test(msg);
      const isTransient = is503 || isQuota429 || isNetworkOrTimeout;

      if (source === 'user') {
        excludeTeacherKey = true;
      } else if (source === 'env') {
        excludeEnv = true;
      } else if (keyId && source === 'pool') {
        triedKeyIdsInRound.add(keyId);
        if (isPermanent) {
          permanentlyFailedKeyIds.add(keyId);
          await recordError(keyId, 'permanent');
        } else if (is503 || isQuota429) {
          // Solo 429 y 503 imponen cooldown en Neon DB a la llave
          await recordError(keyId, 'transient');
        }
        // Errores de red o timeout rotan la clave en la ronda actual sin penalizarla con cooldown en DB
      }

      // Si ya se emitió contenido no se puede reiniciar el stream sin duplicar texto
      if (emittedAnyChunk || !isTransient) {
        throw err;
      }

      if (is503) {
        consecutive503Count++;
        if (consecutive503Count >= getFastFail503Threshold()) {
          throw new AiServiceUnavailableError(
            'Google Gemini está experimentando alta demanda (503). Streaming cortado para proteger cuentas.'
          );
        }
      } else {
        consecutive503Count = 0;
      }

      logger.warn(
        `[ai-provider] Stream falló transitoriamente (${msg.slice(0, 100)}). Rotando clave...`
      );
    }
  }

  throw (
    lastError instanceof Error
      ? lastError
      : new AiServiceUnavailableError('Streaming agotó los intentos disponibles.')
  );
}

/**
 * Genera texto a partir de datos multimodales con rotación atómica y soporte structured output.
 */
export interface MultimodalCallResult extends MultimodalResult {
  provider: string;
  model: string;
}

export async function generateMultimodalWithMetadata(
  systemPrompt: string,
  userPrompt: string,
  inlineData: { mimeType: string; data: string },
  teacherId?: string,
  isPremium = false,
  options?: {
    timeoutMs?: number;
    remainingBudgetMs?: number;
    signal?: AbortSignal;
    responseSchema?: object;
    jsonMode?: boolean;
  }
): Promise<MultimodalCallResult> {
  const { provider, model } = await getActiveConfig(isPremium);
  const resolvedModel = provider === 'gemini' ? sanitizeGeminiModel(model) : model;

  try {
    return await withKeyRotation(
      provider,
      async (apiKey, _keyId, _round, meta: AttemptMetadata) => {
        const geminiProvider = new GeminiProvider(apiKey, resolvedModel);
        const result = await geminiProvider.generateMultimodalWithUsage(
          systemPrompt,
          userPrompt,
          inlineData,
          {
            ...options,
            timeoutMs: meta?.timeoutMs ?? options?.timeoutMs,
            remainingBudgetMs: meta?.remainingBudgetMs ?? options?.remainingBudgetMs,
          }
        );
        return {
          text: result.text,
          usage: result.usage,
          provider: geminiProvider.providerId,
          model: geminiProvider.modelId,
        };
      },
      {
        teacherId,
        remainingBudgetMs: options?.remainingBudgetMs,
        timeoutPerAttemptMs: options?.timeoutMs ?? 90000,
        signal: options?.signal,
      }
    );
  } catch (err) {
    const failure = err instanceof Error ? err : new Error(String(err));
    throw Object.assign(failure, {
      provider,
      model: resolvedModel,
    });
  }
}

export async function generateMultimodalWithRotation(
  systemPrompt: string,
  userPrompt: string,
  inlineData: { mimeType: string; data: string },
  teacherId?: string,
  isPremium = false,
  options?: {
    timeoutMs?: number;
    remainingBudgetMs?: number;
    signal?: AbortSignal;
    responseSchema?: object;
    jsonMode?: boolean;
  }
): Promise<string> {
  const result = await generateMultimodalWithMetadata(
    systemPrompt,
    userPrompt,
    inlineData,
    teacherId,
    isPremium,
    options
  );
  return result.text;
}

// ── Activity logging helper ─────────────────────────────────────────────────

export async function logActivity(data: {
  teacherEmail: string;
  action: string;
  entityType?: string;
  entityId?: string;
  providerUsed?: string;
  modelUsed?: string;
  tokensApprox?: number;
  success?: boolean;
  errorMsg?: string;
}) {
  try {
    if (!process.env.DATABASE_URL) return;
    const db = sql();
    await db`
      INSERT INTO activity_log
        (teacher_email, action, entity_type, entity_id, provider_used, model_used, tokens_approx, success, error_msg)
      VALUES
        (${data.teacherEmail}, ${data.action}, ${data.entityType || null},
         ${data.entityId || null}, ${data.providerUsed || null}, ${data.modelUsed || null},
         ${data.tokensApprox || null}, ${data.success ?? true}, ${data.errorMsg || null})
    `;
  } catch { /* Don't fail the request if logging fails */ }
}
