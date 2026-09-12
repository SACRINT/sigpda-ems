/**
 * AI Provider Factory — main entry point.
 *
 * Usage in any API route:
 *   import { getAIProvider } from '@/lib/ai-provider';
 *   const ai = await getAIProvider();
 *   const result = await ai.generate(systemPrompt, userPrompt);
 *
 * The factory reads the active provider + model from platform_config in DB.
 * Supports two tiers:
 *   - Standard (docentes): active_provider / active_model  → gemini-3.5-flash-lite by default
 *   - Premium  (admins / authorized users): admin_provider / admin_model → configurable
 *
 * Multi-provider fallback (v2):
 *   If the primary provider pool is exhausted, the orchestrator automatically
 *   tries alternative providers that have keys configured in the DB.
 *   Fallback order: openrouter → mistral → openai → claude → gemini (excluding primary)
 */

import { neon } from '@neondatabase/serverless';
import { withKeyRotation } from './key-rotator';
import { GeminiProvider, sanitizeGeminiModel } from './gemini';
import { ClaudeProvider } from './claude';
import { OpenAICompatibleProvider } from './openai';
import type { AIProvider } from './types';

export type { AIProvider };

// ── Default model constants ──────────────────────────────────────────────────
export const DEFAULT_STANDARD_MODEL = 'gemini-3.5-flash-lite';
export const DEFAULT_STANDARD_PROVIDER = 'gemini';
export const DEFAULT_PREMIUM_MODEL = 'gemini-3.5-flash-lite';
export const DEFAULT_PREMIUM_PROVIDER = 'gemini';

// ── Fallback provider order (excludes primary, tried in sequence) ────────────
// Prioritizes free-tier / low-cost providers first
const FALLBACK_PROVIDER_ORDER = ['openrouter', 'mistral', 'openai', 'claude', 'gemini'];

// ── Default models per provider for fallback calls ───────────────────────────
const DEFAULT_MODEL_BY_PROVIDER: Record<string, string> = {
  gemini:     'gemini-3.5-flash-lite',
  claude:     'claude-haiku-4-5',
  openai:     'gpt-4o-mini',
  nvidia:     'meta/llama-3.1-70b-instruct',
  qwen:       'qwen-turbo',
  mistral:    'mistral-small-latest',
  openrouter: 'mistralai/mistral-7b-instruct:free',
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
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`
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

/**
 * Returns providers (other than the given primary) that have active keys in DB.
 * Used for multi-provider fallback orchestration.
 */
async function getAlternativeProviders(primaryProvider: string): Promise<string[]> {
  try {
    if (!process.env.DATABASE_URL) return [];
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`
      SELECT DISTINCT provider FROM api_keys
      WHERE is_active = true AND provider != ${primaryProvider}
    `;
    const availableProviders = new Set(rows.map((r: any) => r.provider as string));
    // Return in fallback order, only those with active keys
    return FALLBACK_PROVIDER_ORDER.filter(p => p !== primaryProvider && availableProviders.has(p));
  } catch {
    return [];
  }
}

/**
 * Checks whether a teacher has is_premium=true OR an elevated role.
 */
export async function resolveUserIsPremium(teacherId?: string): Promise<boolean> {
  if (!teacherId || !process.env.DATABASE_URL) return false;
  try {
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`
      SELECT role, COALESCE(is_premium, false) AS is_premium
      FROM teachers
      WHERE id = ${teacherId}::uuid
      LIMIT 1
    `;
    if (!rows[0]) return false;
    const { role, is_premium } = rows[0];
    return is_premium === true || role === 'administrador' || role === 'supervisor';
  } catch {
    return false;
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
 * Returns an AIProvider instance configured with the active provider, model
 * and the best available API key (from DB with rotation, falling back to env vars).
 * @param isPremium - set true for admins or premium-authorized users
 */
export async function getAIProvider(isPremium = false): Promise<AIProvider> {
  const { provider, model } = await getActiveConfig(isPremium);

  // Resolve the API key with fallback to env var
  const { resolveKey } = await import('./key-rotator');
  const resolved = await resolveKey(provider);
  const finalModel = resolved.modelOverride || model;

  return buildProvider(provider, finalModel, resolved.apiKey);
}

/**
 * Generates text with automatic key rotation on quota errors.
 * If the primary provider pool is exhausted, falls back to alternative providers
 * that have keys configured in the DB (multi-provider orchestration).
 *
 * Priority: teacher's own key → primary pool → alternative providers
 * @param isPremium - set true for admins or premium-authorized users
 */
export async function generateWithRotation(
  systemPrompt: string,
  userPrompt: string,
  teacherId?: string,
  isPremium = false,
  options?: { temperature?: number; jsonMode?: boolean; maxTokens?: number }
): Promise<string> {
  const { provider, model } = await getActiveConfig(isPremium);

  // Try primary provider first (with full key rotation)
  try {
    return await withKeyRotation(provider, async (apiKey) => {
      const ai = buildProvider(provider, model, apiKey);
      return ai.generate(systemPrompt, userPrompt, options);
    }, teacherId);
  } catch (primaryErr: any) {
    console.warn(
      `[ai-provider] Primary provider "${provider}" pool exhausted. ` +
      `Trying alternative providers...`
    );

    // Try alternative providers in fallback order
    const alternatives = await getAlternativeProviders(provider);
    for (const altProvider of alternatives) {
      const altModel = DEFAULT_MODEL_BY_PROVIDER[altProvider] || 'gpt-4o-mini';
      try {
        const result = await withKeyRotation(altProvider, async (apiKey) => {
          const ai = buildProvider(altProvider, altModel, apiKey);
          return ai.generate(systemPrompt, userPrompt, options);
        });
        console.log(`[ai-provider] ✅ Fallback provider "${altProvider}" (${altModel}) succeeded.`);
        return result;
      } catch (altErr: any) {
        console.warn(
          `[ai-provider] Fallback provider "${altProvider}" also failed: ${altErr.message}`
        );
      }
    }

    // All providers exhausted — throw descriptive error
    throw new Error(
      `[ai-provider] All AI providers exhausted. Primary: ${provider}. ` +
      `Alternatives tried: ${alternatives.join(', ') || 'none available'}. ` +
      `Original error: ${primaryErr.message}`
    );
  }
}

/**
 * Generates a stream with automatic key rotation on quota errors.
 * Returns an AsyncGenerator<string>.
 *
 * NOTE: Multi-provider fallback is not supported for streams because a stream
 * must stay connected to a single provider connection. The key-rotator will
 * still rotate through all keys of the primary provider.
 *
 * @param isPremium - set true for admins or premium-authorized users
 */
export async function* generateStreamWithRotation(
  systemPrompt: string,
  userPrompt: string,
  teacherId?: string,
  isPremium = false
): AsyncGenerator<string> {
  const { provider, model } = await getActiveConfig(isPremium);
  const { resolveKey } = await import('./key-rotator');
  const resolved = await resolveKey(provider, teacherId);
  const finalModel = resolved.modelOverride || model;
  const ai = buildProvider(provider, finalModel, resolved.apiKey);
  yield* ai.generateStream(systemPrompt, userPrompt);
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
    const sql = neon(process.env.DATABASE_URL);
    await sql`
      INSERT INTO activity_log
        (teacher_email, action, entity_type, entity_id, provider_used, model_used, tokens_approx, success, error_msg)
      VALUES
        (${data.teacherEmail}, ${data.action}, ${data.entityType || null},
         ${data.entityId || null}, ${data.providerUsed || null}, ${data.modelUsed || null},
         ${data.tokensApprox || null}, ${data.success ?? true}, ${data.errorMsg || null})
    `;
  } catch { /* Don't fail the request if logging fails */ }
}
