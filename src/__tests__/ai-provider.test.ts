/**
 * ai-provider.test.ts
 * Unit tests for src/lib/ai-provider/index.ts
 *
 * Hoisting rules:
 *  - vi.hoisted() runs FIRST (before vi.mock factories)
 *  - vi.mock() factories reference variables returned from vi.hoisted()
 *  - Provider mocks use `function` keyword (not arrow) to be constructable via `new`
 */

import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest';

// ── 1. Hoist shared mock references (must be before vi.mock calls) ─────────────

const { mockGenerate, mockNeonFn } = vi.hoisted(() => ({
  mockGenerate: vi.fn().mockResolvedValue('respuesta-mock-ia'),
  mockNeonFn:   vi.fn().mockResolvedValue([]),
}));

// ── 2. Mocks ──────────────────────────────────────────────────────────────────

vi.mock('@neondatabase/serverless', () => ({
  neon: vi.fn(() => mockNeonFn),
}));

vi.mock('@/lib/ai-provider/key-rotator', () => ({
  resolveKey: vi.fn().mockResolvedValue({
    apiKey: 'test-api-key-123',
    keyId:  'key-uuid-001',
    modelOverride: null,
    source: 'pool',
  }),
  // withKeyRotation: receives (provider, fn, teacherId?) — calls fn immediately
  withKeyRotation: vi.fn(async (
    _provider: string,
    fn: (key: string) => Promise<string>,
  ) => fn('test-api-key-123')),
  encryptKey: vi.fn((s: string) => `enc:${s}`),
  decryptKey: vi.fn((s: string) => s.replace(/^enc:/, '')),
}));

// Providers mocked as proper constructor functions (arrow fns are NOT constructable)
vi.mock('@/lib/ai-provider/gemini', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  GeminiProvider: vi.fn(function (this: any, _apiKey: string, model: string) {
    this.providerId = 'gemini';
    this.modelId    = model;
    this.generate   = mockGenerate;
    this.generateStream = vi.fn();
  }),
  sanitizeGeminiModel: vi.fn((m: string) => m),
}));

vi.mock('@/lib/ai-provider/claude', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ClaudeProvider: vi.fn(function (this: any, _apiKey: string, model: string) {
    this.providerId = 'claude';
    this.modelId    = model;
    this.generate   = mockGenerate;
    this.generateStream = vi.fn();
  }),
}));

vi.mock('@/lib/ai-provider/openai', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  OpenAICompatibleProvider: vi.fn(function (this: any, _apiKey: string, provider: string, model: string) {
    this.providerId = provider;
    this.modelId    = model;
    this.generate   = mockGenerate;
    this.generateStream = vi.fn();
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── 3. Module under test (after all mocks) ────────────────────────────────────

import {
  getAIProvider,
  generateWithRotation,
  resolveUserIsPremium,
  DEFAULT_STANDARD_MODEL,
  DEFAULT_STANDARD_PROVIDER,
  DEFAULT_PREMIUM_MODEL,
  DEFAULT_PREMIUM_PROVIDER,
  DEFAULT_MODEL_BY_PROVIDER,
} from '@/lib/ai-provider';

// ─────────────────────────────────────────────────────────────────────────────

describe('ai-provider/index.ts — Factory and Generation', () => {
  beforeAll(() => {
    vi.stubEnv('DATABASE_URL', 'postgresql://test:test@localhost/sigpda_test');
    vi.stubEnv('GEMINI_API_KEY', 'env-gemini-key');
  });

  beforeEach(() => {
    mockNeonFn.mockReset();
    mockNeonFn.mockResolvedValue([]);
    mockGenerate.mockResolvedValue('respuesta-mock-ia');
  });

  // ── Default constants ──────────────────────────────────────────────────────

  it('DEFAULT_STANDARD_PROVIDER y DEFAULT_PREMIUM_PROVIDER son gemini', () => {
    expect(DEFAULT_STANDARD_PROVIDER).toBe('gemini');
    expect(DEFAULT_PREMIUM_PROVIDER).toBe('gemini');
  });

  it('DEFAULT_STANDARD_MODEL y DEFAULT_PREMIUM_MODEL están definidos', () => {
    expect(DEFAULT_STANDARD_MODEL).toBeTruthy();
    expect(DEFAULT_PREMIUM_MODEL).toBeTruthy();
  });

  // ── getAIProvider ──────────────────────────────────────────────────────────

  it('getAIProvider — retorna provider gemini cuando DB está vacía (default)', async () => {
    mockNeonFn.mockResolvedValueOnce([]); // platform_config vacía → defaults

    const provider = await getAIProvider(false);
    expect(provider.providerId).toBe('gemini');
    expect(typeof provider.modelId).toBe('string');
    expect(provider.modelId.length).toBeGreaterThan(0);
  });

  it('getAIProvider — respeta active_provider=claude desde platform_config', async () => {
    mockNeonFn.mockResolvedValueOnce([
      { key: 'active_provider', value: 'claude' },
      { key: 'active_model',    value: 'claude-haiku-4-5' },
    ]);

    const provider = await getAIProvider(false);
    expect(provider.providerId).toBe('claude');
    expect(provider.modelId).toBe('claude-haiku-4-5');
  });

  // ── generateWithRotation ───────────────────────────────────────────────────

  it('generateWithRotation — retorna el texto generado por el provider activo', async () => {
    mockNeonFn.mockResolvedValue([]);

    const result = await generateWithRotation(
      'Eres un asistente pedagógico experto.',
      'Genera un objetivo de aprendizaje.',
    );

    expect(typeof result).toBe('string');
    expect(result).toBe('respuesta-mock-ia');
  });

  it('generateWithRotation — isPremium=true resuelve config de admin', async () => {
    mockNeonFn.mockResolvedValueOnce([
      { key: 'admin_provider', value: 'gemini' },
      { key: 'admin_model',    value: DEFAULT_PREMIUM_MODEL },
    ]);

    const result = await generateWithRotation(
      'Prompt sistema',
      'Prompt usuario',
      undefined,
      true,
    );

    expect(result).toBe('respuesta-mock-ia');
  });

  // ── resolveUserIsPremium ───────────────────────────────────────────────────

  it('resolveUserIsPremium — retorna false sin teacherId', async () => {
    const result = await resolveUserIsPremium(undefined);
    expect(result).toBe(false);
  });

  it('resolveUserIsPremium — retorna true para rol administrador', async () => {
    mockNeonFn.mockResolvedValueOnce([{ role: 'administrador', is_premium: false }]);
    const result = await resolveUserIsPremium('uuid-teacher-admin');
    expect(result).toBe(true);
  });

  it('resolveUserIsPremium — retorna true cuando is_premium=true', async () => {
    mockNeonFn.mockResolvedValueOnce([{ role: 'docente', is_premium: true }]);
    const result = await resolveUserIsPremium('uuid-teacher-premium');
    expect(result).toBe(true);
  });

  it('resolveUserIsPremium — retorna false cuando teacher no existe en DB', async () => {
    mockNeonFn.mockResolvedValueOnce([]);
    const result = await resolveUserIsPremium('uuid-no-existe');
    expect(result).toBe(false);
  });

  // ── Fallback provider models ───────────────────────────────────────────────

  it('DEFAULT_MODEL_BY_PROVIDER — openrouter utiliza el slug vigente openrouter/free', () => {
    expect(DEFAULT_MODEL_BY_PROVIDER.openrouter).toBeDefined();
    expect(typeof DEFAULT_MODEL_BY_PROVIDER.openrouter).toBe('string');
    expect(DEFAULT_MODEL_BY_PROVIDER.openrouter.length).toBeGreaterThan(0);
    expect(DEFAULT_MODEL_BY_PROVIDER.openrouter).toBe('openrouter/free');
    // Prevenir regresión al modelo obsoleto discontinuado
    expect(DEFAULT_MODEL_BY_PROVIDER.openrouter).not.toBe('meta-llama/llama-3.1-8b-instruct:free');
  });
});
