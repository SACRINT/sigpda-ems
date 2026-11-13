/**
 * key-rotator-balancing.test.ts
 *
 * Pruebas unitarias para el Gateway Único y Rotador Atómico de API Keys:
 * - Selección atómica en PostgreSQL con FOR UPDATE SKIP LOCKED y excludeKeyIds en SQL
 * - Exclusión de teacherKey y env tras fallo (cero bucles infinitos)
 * - Cero doble incremento de usage_count (solo tras HTTP 200)
 * - Cooldown diferenciado: 429/503 solo actualiza last_error_at; 401/403 desactiva
 * - Reactivación segura parametrizada (NOW() - (${min} * INTERVAL '1 minute'))
 * - Fast-fail estricto tras 2 errores 503 consecutivos (HTTP 503 mapeado con isUpstreamAIError)
 * - Timeouts dinámicos clampeados por remainingBudgetMs
 * - Integración con getAIProvider y generación multimodal estructurada
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { isUpstreamAIError } from '@/lib/ai-resilience';

// ── Mock DB client ────────────────────────────────────────────────────────────
const mockSqlFn = vi.fn();

vi.mock('@/lib/db/client', () => ({
  sql: () => mockSqlFn,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  claimApiKey,
  withKeyRotation,
  reactivateCooledKeys,
  encryptKey,
  AiServiceUnavailableError,
  FAST_FAIL_503_THRESHOLD,
} from '@/lib/ai-provider/key-rotator';
import {
  getAIProvider,
  generateMultimodalWithRotation,
  generateStreamWithRotation,
} from '@/lib/ai-provider';
import { GeminiProvider } from '@/lib/ai-provider/gemini';

describe('Gateway Único y Rotador Atómico de API Keys (P1 - Blindaje Integral)', () => {
  beforeAll(() => {
    vi.stubEnv('DATABASE_URL', 'postgresql://mock:mock@localhost/db');
    vi.stubEnv('ADMIN_ENCRYPTION_KEY', '12345678901234567890123456789012'); // 32 chars
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Reclama atómicamente claves distintas sin colisión y actualiza last_used_at sin tocar usage_count', async () => {
    const keysInDb = [
      { id: 'key-1', label: 'Cuenta 1', key_encrypted: encryptKey('gemini-key-1'), is_active: true, priority: 1, usage_count: 10 },
      { id: 'key-2', label: 'Cuenta 2', key_encrypted: encryptKey('gemini-key-2'), is_active: true, priority: 2, usage_count: 10 },
      { id: 'key-3', label: 'Cuenta 3', key_encrypted: encryptKey('gemini-key-3'), is_active: true, priority: 3, usage_count: 10 },
      { id: 'key-4', label: 'Cuenta 4', key_encrypted: encryptKey('gemini-key-4'), is_active: true, priority: 4, usage_count: 10 },
      { id: 'key-5', label: 'Cuenta 5', key_encrypted: encryptKey('gemini-key-5'), is_active: true, priority: 5, usage_count: 10 },
      { id: 'key-6', label: 'Cuenta 6', key_encrypted: encryptKey('gemini-key-6'), is_active: true, priority: 6, usage_count: 10 },
    ];

    let claimIndex = 0;
    mockSqlFn.mockImplementation(async (strings: TemplateStringsArray) => {
      const queryStr = strings.join('');
      if (queryStr.includes('FOR UPDATE SKIP LOCKED')) {
        const key = keysInDb[claimIndex++ % keysInDb.length];
        return [key];
      }
      return [];
    });

    const claims = await Promise.all([
      claimApiKey('gemini'),
      claimApiKey('gemini'),
      claimApiKey('gemini'),
      claimApiKey('gemini'),
      claimApiKey('gemini'),
      claimApiKey('gemini'),
    ]);

    // Las 6 llamadas reclaman las 6 llaves distintas
    const claimedKeys = claims.map((c) => c?.apiKey);
    expect(new Set(claimedKeys).size).toBe(6);
    expect(claimedKeys).toContain('gemini-key-1');
    expect(claimedKeys).toContain('gemini-key-6');

    // Cero incremento de usage_count durante el claim:
    const recordedUsages = mockSqlFn.mock.calls.filter((call) =>
      call[0].join('').includes('usage_count = usage_count + 1')
    );
    expect(recordedUsages.length).toBe(0);
  });

  it('2. Aplica excludeKeyIds estrictamente en la consulta SQL', async () => {
    let capturedQuery = '';
    mockSqlFn.mockImplementation(async (strings: TemplateStringsArray) => {
      capturedQuery = strings.join('?');
      if (strings.join('').includes('FOR UPDATE SKIP LOCKED')) {
        return [{ id: 'key-3', label: 'Cuenta 3', key_encrypted: encryptKey('gemini-key-3'), is_active: true }];
      }
      return [];
    });

    const excludeSet = new Set(['key-1', 'key-2']);
    await claimApiKey('gemini', { excludeKeyIds: excludeSet });

    // Verifica que la consulta SQL contiene el filtro de exclusión ANY
    expect(capturedQuery).toContain('NOT (id = ANY');
  });

  it('3. Excluye clave de docente o clave de entorno tras un primer fallo (no reintenta en bucle)', async () => {
    // 1er intento devuelve clave docente, 2do intento debe pasar al pool de BD
    mockSqlFn.mockImplementation(async (strings: TemplateStringsArray) => {
      const q = strings.join('');
      if (q.includes('FROM teachers')) {
        return [{ custom_api_key: encryptKey('teacher-custom-key'), custom_api_provider: 'gemini' }];
      }
      if (q.includes('FOR UPDATE SKIP LOCKED')) {
        return [{ id: 'pool-key-1', label: 'Pool 1', key_encrypted: encryptKey('pool-key-1'), is_active: true }];
      }
      if (q.includes('COUNT(*)')) {
        return [{ cnt: 1 }];
      }
      return [];
    });

    const attemptedKeys: string[] = [];
    const fn = vi.fn().mockImplementation(async (apiKey: string) => {
      attemptedKeys.push(apiKey);
      if (apiKey === 'teacher-custom-key') {
        const err = new Error('429 Quota exhausted on teacher key') as Error & { status?: number };
        err.status = 429;
        throw err;
      }
      return 'Éxito con pool key';
    });

    const result = await withKeyRotation('gemini', fn, { teacherId: '550e8400-e29b-41d4-a716-446655440000' });
    expect(result).toBe('Éxito con pool key');

    // La clave docente falló en intento 1 y fue excluida; el intento 2 usó la clave del pool
    expect(attemptedKeys).toEqual(['teacher-custom-key', 'pool-key-1']);
  });

  it('4. Reactivación de claves utiliza parametrización SQL segura sin interpolar texto crudo', async () => {
    let reactivationSql = '';
    mockSqlFn.mockImplementation(async (strings: TemplateStringsArray) => {
      reactivationSql = strings.join('?');
      return [];
    });

    await reactivateCooledKeys('gemini');

    // Valida que la consulta usa INTERVAL '1 minute' multiplicado de forma segura
    expect(reactivationSql).toContain("INTERVAL '1 minute'");
    expect(reactivationSql).not.toContain("INTERVAL '${COOLDOWN_PERMANENT_MINUTES} minutes'");
  });

  it('5. FAST-FAIL: corta de inmediato tras 2 errores 503 consecutivos y mapea a isUpstreamAIError = true', async () => {
    const encKey1 = encryptKey('gemini-key-1');
    const encKey2 = encryptKey('gemini-key-2');

    let pickIndex = 0;
    mockSqlFn.mockImplementation(async (strings: TemplateStringsArray) => {
      const q = strings.join('');
      if (q.includes('FOR UPDATE SKIP LOCKED')) {
        const pool = [
          { id: 'key-1', label: 'Key 1', key_encrypted: encKey1, is_active: true },
          { id: 'key-2', label: 'Key 2', key_encrypted: encKey2, is_active: true },
        ];
        return [pool[pickIndex++ % pool.length]];
      }
      if (q.includes('COUNT(*)')) {
        return [{ cnt: 2 }];
      }
      return [];
    });

    let attemptsExecuted = 0;
    const fn503 = vi.fn().mockImplementation(async () => {
      attemptsExecuted++;
      const err = new Error('HTTP 503: The model is overloaded. High demand.') as Error & { status?: number; statusCode?: number };
      err.status = 503;
      err.statusCode = 503;
      throw err;
    });

    await expect(withKeyRotation('gemini', fn503)).rejects.toThrowError(AiServiceUnavailableError);

    // FAST_FAIL_503_THRESHOLD es 2: se corta terminantemente tras 2 intentos
    expect(FAST_FAIL_503_THRESHOLD).toBe(2);
    expect(attemptsExecuted).toBe(2);

    // Un 503 es caída upstream, no agotamiento de la llave: no debe escribir cooldown en DB.
    const cooldownQueries = mockSqlFn.mock.calls.filter((call) =>
      call[0].join('').includes('last_error_at = NOW()')
    );
    expect(cooldownQueries.length).toBe(0);

    const errorInstance = new AiServiceUnavailableError('Saturación en Google');
    expect(isUpstreamAIError(errorInstance)).toBe(true);
    expect(errorInstance.status).toBe(503);
  });

  it('6. Cooldown Diferenciado: 429/503 solo actualiza last_error_at y NUNCA desactiva la clave', async () => {
    const encKey1 = encryptKey('gemini-key-1');
    const encKey2 = encryptKey('gemini-key-2');

    let pick = 0;
    mockSqlFn.mockImplementation(async (strings: TemplateStringsArray) => {
      const q = strings.join('');
      if (q.includes('FOR UPDATE SKIP LOCKED')) {
        const pool = [
          { id: 'key-1', label: 'Key 1', key_encrypted: encKey1, is_active: true },
          { id: 'key-2', label: 'Key 2', key_encrypted: encKey2, is_active: true },
        ];
        return [pool[pick++ % pool.length]];
      }
      if (q.includes('COUNT(*)')) {
        return [{ cnt: 2 }];
      }
      return [];
    });

    const fn429ThenSuccess = vi.fn().mockImplementation(async (key: string) => {
      if (key === 'gemini-key-1') {
        const err = new Error('Rate limit exceeded: 429 Resource Exhausted') as Error & { status?: number };
        err.status = 429;
        throw err;
      }
      return 'Key 2 tuvo éxito';
    });

    const res = await withKeyRotation('gemini', fn429ThenSuccess);
    expect(res).toBe('Key 2 tuvo éxito');

    // Valida que para el 429 NUNCA se llamó a UPDATE con is_active = CASE
    const deactivationQueries = mockSqlFn.mock.calls.filter((call) =>
      call[0].join('').includes('is_active = CASE')
    );
    expect(deactivationQueries.length).toBe(0);

    // Valida que sí se actualizó last_error_at = NOW()
    const cooldownQueries = mockSqlFn.mock.calls.filter((call) =>
      call[0].join('').includes('last_error_at = NOW()')
    );
    expect(cooldownQueries.length).toBeGreaterThanOrEqual(1);
  });

  it('7. Cablea timeout dinámico y deadline entre intentos, clampeando a >= 1ms', async () => {
    mockSqlFn.mockImplementation(async (strings: TemplateStringsArray) => {
      const q = strings.join('');
      if (q.includes('FOR UPDATE SKIP LOCKED')) {
        return [{ id: 'key-1', label: 'Key 1', key_encrypted: encryptKey('gemini-key-1'), is_active: true }];
      }
      if (q.includes('COUNT(*)')) {
        return [{ cnt: 1 }];
      }
      return [];
    });

    let receivedTimeout = 0;
    const fnCheckTimeout = vi.fn().mockImplementation(async (_k, _id, _r, meta) => {
      receivedTimeout = meta.timeoutMs;
      return 'OK';
    });

    // Se pasa un presupuesto restante de 2500ms y un timeout por intento de 10000ms
    // Debe clampear a min(10000, 2500) = ~2500ms
    await withKeyRotation('gemini', fnCheckTimeout, {
      remainingBudgetMs: 2500,
      timeoutPerAttemptMs: 10000,
    });

    expect(receivedTimeout).toBeGreaterThan(0);
    expect(receivedTimeout).toBeLessThanOrEqual(2500);
  });

  it('8. getAIProvider envuelve las llamadas para que pasen por el gateway centralizado', async () => {
    mockSqlFn.mockImplementation(async (strings: TemplateStringsArray) => {
      const q = strings.join('');
      if (q.includes('platform_config')) {
        return [{ key: 'active_provider', value: 'gemini' }, { key: 'active_model', value: 'gemini-3.5-flash-lite' }];
      }
      if (q.includes('FOR UPDATE SKIP LOCKED')) {
        return [{ id: 'key-wrapped', label: 'Wrapped', key_encrypted: encryptKey('key-wrapped'), is_active: true }];
      }
      if (q.includes('COUNT(*)')) {
        return [{ cnt: 1 }];
      }
      return [];
    });

    // Mock global fetch para llamadas de IA
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'Respuesta generada vía provider envuelto' }] } }],
      }),
    } as unknown as Response);

    try {
      const ai = await getAIProvider(false);
      const output = await ai.generate('system prompt', 'user prompt');
      expect(output).toBe('Respuesta generada vía provider envuelto');

      // Verifica que recordUsage fue llamado (lo que prueba que pasó por withKeyRotation)
      const usageQueries = mockSqlFn.mock.calls.filter((call) =>
        call[0].join('').includes('usage_count = usage_count + 1')
      );
      expect(usageQueries.length).toBe(1);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('9. Recalcula el presupuesto después del claim para evitar que esperas de cooldown sobrepasen el deadline', async () => {
    mockSqlFn.mockImplementation(async (strings: TemplateStringsArray) => {
      const q = strings.join('');
      if (q.includes('FOR UPDATE SKIP LOCKED')) {
        return [{ id: 'key-1', label: 'Key 1', key_encrypted: encryptKey('gemini-key-1'), is_active: true }];
      }
      if (q.includes('COUNT(*)')) {
        return [{ cnt: 1 }];
      }
      return [];
    });

    let postClaimBudget = 0;
    const fnMeasure = vi.fn().mockImplementation(async (_k, _id, _r, meta) => {
      postClaimBudget = meta.remainingBudgetMs;
      return 'OK';
    });

    await withKeyRotation('gemini', fnMeasure, {
      remainingBudgetMs: 5000,
    });

    expect(postClaimBudget).toBeGreaterThan(0);
    expect(postClaimBudget).toBeLessThanOrEqual(5000);
  });

  it('10. generateStreamWithRotation permite segunda vuelta al reiniciar triedKeyIds por ronda ante error transitorio de red', async () => {
    const mockDbKeys = [
      { id: 'stream-key-1', label: 'Stream Key 1', key_encrypted: encryptKey('stream-key-1'), is_active: true, last_error_at: null as Date | null },
    ];

    let capturedExclusions: string[] = [];
    mockSqlFn.mockImplementation(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const q = strings.join('');
      if (q.includes('platform_config')) {
        return [{ key: 'active_provider', value: 'gemini' }, { key: 'active_model', value: 'gemini-3.5-flash-lite' }];
      }
      if (q.includes('COUNT(*)')) {
        return [{ cnt: 1 }]; // 1 llave -> maxAttempts = 2 (2 vueltas)
      }
      if (q.includes('UPDATE api_keys') && q.includes('last_error_at = NOW()')) {
        mockDbKeys[0].last_error_at = new Date();
        return [];
      }
      if (q.includes('FOR UPDATE SKIP LOCKED')) {
        // Captura las exclusiones reales pasadas a la consulta SQL
        const excludedParam = values.find((v) => Array.isArray(v)) as string[] | undefined;
        capturedExclusions = excludedParam || [];
        if (capturedExclusions.includes('stream-key-1')) {
          return [];
        }
        return [mockDbKeys[0]];
      }
      return [];
    });

    const originalFetch = global.fetch;
    let attemptCount = 0;
    global.fetch = vi.fn().mockImplementation(async () => {
      attemptCount++;
      if (attemptCount === 1) {
        // Intento 1 (Vuelta 1): Error transitorio de red / timeout de socket
        throw new Error('fetch failed: ECONNRESET socket closed by peer');
      }
      // Intento 2 (Vuelta 2): Exitoso tras reset de triedKeyIdsInRound
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: {"candidates":[{"content":{"parts":[{"text":"Chunk stream vuelta 2"}]}}]}\n\n'));
          controller.close();
        },
      });
      return {
        ok: true,
        body: stream,
      } as unknown as Response;
    });

    try {
      const chunks: string[] = [];
      for await (const chunk of generateStreamWithRotation('sys', 'user')) {
        chunks.push(chunk);
      }
      expect(chunks).toEqual(['Chunk stream vuelta 2']);
      expect(attemptCount).toBe(2);

      // Certifica que errores transitorios de red NO penalizan la llave con cooldown en BD
      expect(mockDbKeys[0].last_error_at).toBeNull();
      // Certifica que al inicio de la vuelta 2 la clave NO quedó excluida permanentemente
      expect(capturedExclusions).not.toContain('stream-key-1');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('11. generateMultimodalWithRotation ejecuta con éxito preservando el timeout multimodal de 90s', async () => {
    mockSqlFn.mockImplementation(async (strings: TemplateStringsArray) => {
      const q = strings.join('');
      if (q.includes('platform_config')) {
        return [{ key: 'active_provider', value: 'gemini' }, { key: 'active_model', value: 'gemini-3.5-flash-lite' }];
      }
      if (q.includes('COUNT(*)')) {
        return [{ cnt: 1 }];
      }
      if (q.includes('FOR UPDATE SKIP LOCKED')) {
        return [{ id: 'mm-key-1', label: 'MM Key 1', key_encrypted: encryptKey('mm-key-1'), is_active: true }];
      }
      return [];
    });

    const multimodalSpy = vi.spyOn(GeminiProvider.prototype, 'generateMultimodalWithUsage').mockResolvedValue({
      text: 'Respuesta multimodal OK',
      usage: { promptTokenCount: 10, candidatesTokenCount: 20, totalTokenCount: 30 },
    });

    try {
      const res = await generateMultimodalWithRotation('sys', 'user', {
        mimeType: 'application/pdf',
        data: 'JVBERi0xLjQK...',
      });
      expect(res).toBe('Respuesta multimodal OK');

      // Verifica de forma irrefutable que el timeout transmitido por defecto a generateMultimodal es exactamente 90,000 ms
      expect(multimodalSpy).toHaveBeenCalledWith(
        'sys',
        'user',
        expect.objectContaining({ mimeType: 'application/pdf' }),
        expect.objectContaining({ timeoutMs: 90000 })
      );
    } finally {
      multimodalSpy.mockRestore();
    }
  });

  it('12. withKeyRotation respeta AbortSignal: corta de inmediato sin reclamar llaves si ya está abortado', async () => {
    const controller = new AbortController();
    controller.abort(new DOMException('User cancelled generation', 'AbortError'));

    const fn = vi.fn();
    await expect(
      withKeyRotation('gemini', fn, { signal: controller.signal })
    ).rejects.toThrow('User cancelled generation');

    expect(fn).not.toHaveBeenCalled();
    const claimCalls = mockSqlFn.mock.calls.filter((c) =>
      c[0].join('').includes('FOR UPDATE SKIP LOCKED')
    );
    expect(claimCalls.length).toBe(0);
  });

  it('13. withKeyRotation corta inmediatamente tras AbortError en ejecución sin rotar ni ensuciar balanceo', async () => {
    mockSqlFn.mockImplementation(async (strings: TemplateStringsArray) => {
      const q = strings.join('');
      if (q.includes('FOR UPDATE SKIP LOCKED')) {
        return [{ id: 'key-abort-1', label: 'Key 1', key_encrypted: encryptKey('key-1'), is_active: true }];
      }
      if (q.includes('COUNT(*)')) {
        return [{ cnt: 3 }];
      }
      return [];
    });

    const controller = new AbortController();
    let calls = 0;
    const fnAbort = vi.fn().mockImplementation(async () => {
      calls++;
      controller.abort();
      const abortErr = new DOMException('The operation was aborted', 'AbortError');
      throw abortErr;
    });

    await expect(
      withKeyRotation('gemini', fnAbort, { signal: controller.signal })
    ).rejects.toThrow('The operation was aborted');

    // Cortó inmediatamente en el intento 1 sin seguir rotando por las otras 2 claves
    expect(calls).toBe(1);

    // No debe haber registrado error en DB porque la clave no falló
    const errorQueries = mockSqlFn.mock.calls.filter((c) =>
      c[0].join('').includes('last_error_at = NOW()')
    );
    expect(errorQueries.length).toBe(0);
  });
});
