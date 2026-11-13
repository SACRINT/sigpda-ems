import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockDb = vi.fn();
const geminiInstances: Array<{ apiKey: string; model: string }> = [];
const mockGeminiGenerate = vi.fn();

vi.mock('@/lib/db/client', () => ({
  sql: () => mockDb,
}));

vi.mock('@/lib/ai-provider/gemini', () => ({
  sanitizeGeminiModel: (m: string) => m,
  GeminiProvider: class MockGeminiProvider {
    apiKey: string;
    model: string;
    constructor(apiKey: string, model: string) {
      this.apiKey = apiKey;
      this.model = model;
      geminiInstances.push({ apiKey, model });
    }
    generate(...args: unknown[]) {
      return mockGeminiGenerate(this.apiKey, this.model, ...args);
    }
  },
}));

vi.mock('@/lib/ai-provider/claude', () => ({
  ClaudeProvider: class {},
}));

vi.mock('@/lib/ai-provider/openai', () => ({
  OpenAICompatibleProvider: class {},
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { generateWithRotation, __resetPrimary503CircuitForTests } from '@/lib/ai-provider';
import { AiCooldownExhaustedError } from '@/lib/ai-provider/key-rotator';

interface PoolKeyRow {
  id: string;
  label: string;
  provider: string;
  model_default: string | null;
  key_encrypted: string;
  key_preview: string;
  is_active: boolean;
  priority: number;
  usage_count: number;
  error_count: number;
  last_used_at: string | null;
  last_error_at: string | null;
}

describe('Resiliencia de Gemini 503 Fast-Fail y Espera de Cooldown por Presupuesto', () => {
  let poolKeys: PoolKeyRow[] = [];
  const originalDbUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    vi.clearAllMocks();
    __resetPrimary503CircuitForTests();
    geminiInstances.length = 0;
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/sigpda_test';

    poolKeys = Array.from({ length: 8 }, (_, idx) => ({
      id: `key-uuid-${idx + 1}`,
      label: `Key ${idx + 1}`,
      provider: 'gemini',
      model_default: null,
      key_encrypted: `AIzaFakeKey${idx + 1}`,
      key_preview: `...Key${idx + 1}`,
      is_active: true,
      priority: idx + 1,
      usage_count: idx,
      error_count: 0,
      last_used_at: null,
      last_error_at: null,
    }));

    mockDb.mockImplementation((strings: TemplateStringsArray, ...values: unknown[]) => {
      const query = strings.join(' ').replace(/\s+/g, ' ').trim();

      if (query.includes('FROM platform_config')) {
        return Promise.resolve([]);
      }

      if (query.includes('COUNT(*)::int as cnt FROM api_keys')) {
        return Promise.resolve([{ cnt: poolKeys.filter((k) => k.is_active).length }]);
      }

      if (query.includes('WITH candidate AS')) {
        const excludedIds = new Set<string>(
          Array.isArray(values[2]) ? (values[2] as string[]) : []
        );
        const nowMs = Date.now();
        const available = poolKeys
          .filter((k) => {
            if (!k.is_active || excludedIds.has(k.id)) return false;
            if (!k.last_error_at) return true;
            return nowMs - new Date(k.last_error_at).getTime() >= 45_000;
          })
          .sort((a, b) => {
            const aUsed = a.last_used_at ? new Date(a.last_used_at).getTime() : 0;
            const bUsed = b.last_used_at ? new Date(b.last_used_at).getTime() : 0;
            if (aUsed !== bUsed) return aUsed - bUsed;
            return a.usage_count - b.usage_count;
          });

        if (available.length === 0) return Promise.resolve([]);
        const chosen = available[0];
        chosen.last_used_at = new Date(nowMs).toISOString();
        return Promise.resolve([chosen]);
      }

      if (query.includes('SELECT id, last_error_at FROM api_keys')) {
        const excludedIds = new Set<string>(
          Array.isArray(values[2]) ? (values[2] as string[]) : []
        );
        const cooled = poolKeys
          .filter((k) => k.is_active && !excludedIds.has(k.id) && k.last_error_at)
          .sort(
            (a, b) =>
              new Date(a.last_error_at!).getTime() - new Date(b.last_error_at!).getTime()
          );
        return Promise.resolve(cooled.slice(0, 1));
      }

      if (query.includes('SET usage_count = usage_count + 1')) {
        const keyId = values[0] as string;
        const row = poolKeys.find((k) => k.id === keyId);
        if (row) {
          row.usage_count += 1;
          row.last_error_at = null;
        }
        return Promise.resolve([]);
      }

      if (query.includes('SET error_count = error_count + 1')) {
        const keyId = values[0] as string;
        const row = poolKeys.find((k) => k.id === keyId);
        if (row) {
          row.error_count += 1;
          row.last_error_at = new Date().toISOString();
        }
        return Promise.resolve([]);
      }

      return Promise.resolve([]);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    if (originalDbUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDbUrl;
    }
  });

  it('tras fast-fail HTTP 503 en gemini-3.5-flash-lite (2 llaves), hace fallback automático a gemini-3.1-flash-lite con el resto del pool', async () => {
    mockGeminiGenerate.mockImplementation(async (_apiKey: string, model: string) => {
      if (model === 'gemini-3.5-flash-lite') {
        throw new Error('503 Service Unavailable: This model is currently experiencing high demand.');
      }
      return '{"ok":true,"fallback":true}';
    });

    const res = await generateWithRotation('SYS', 'USER', undefined, false, {
      remainingBudgetMs: 180_000,
    });

    expect(res).toBe('{"ok":true,"fallback":true}');
    const modelsCalled = geminiInstances.map((g) => g.model);
    expect(modelsCalled).toEqual([
      'gemini-3.5-flash-lite',
      'gemini-3.5-flash-lite',
      'gemini-3.1-flash-lite',
    ]);
    // Key 3 (intacta) atiende el fallback de inmediato sin esperar enfriamiento
    expect(geminiInstances[2].apiKey).toBe('AIzaFakeKey3');
  });

  it('corta en frío para presupuestos cortos (<30s) pero espera cooldown >5s cuando el job tiene presupuesto largo (240s)', async () => {
    vi.useFakeTimers();
    const baseNow = new Date('2026-11-12T23:00:00.000Z').getTime();
    vi.setSystemTime(baseNow);

    // Todas las llaves con error hace 39s → restan 6s (> 5s estándar, pero cabe en 240s)
    const cooledAt = new Date(baseNow - 39_000).toISOString();
    for (const k of poolKeys) {
      k.last_error_at = cooledAt;
    }

    // 1. Presupuesto corto (12s) mantiene límite de 5s y corta inmediato
    await expect(
      generateWithRotation('SYS', 'USER', undefined, false, {
        remainingBudgetMs: 12_000,
      })
    ).rejects.toThrow(AiCooldownExhaustedError);

    // 2. Presupuesto largo de job (240s) absorbe los 6s de cooldown y reclama la llave recuperada
    mockGeminiGenerate.mockResolvedValueOnce('{"ok":true,"recovered":true}');
    const longPromise = generateWithRotation('SYS', 'USER', undefined, false, {
      remainingBudgetMs: 240_000,
    });

    await vi.advanceTimersByTimeAsync(7_000);
    const result = await longPromise;

    expect(result).toBe('{"ok":true,"recovered":true}');
    expect(geminiInstances).toHaveLength(1);
  });
});
