/**
 * key-rotator-balancing.test.ts
 *
 * Pruebas unitarias para el balanceador inteligente de API keys:
 * - Round-Robin in-memory scatterer para peticiones concurrentes
 * - Prioridad LRU / Least-Used (NULLS FIRST, usage_count ASC)
 * - Rotación exhaustiva ante errores 503/429 (sin aborto prematuro a los 2 fallos)
 * - Circuito de seguridad estricto anti-bucle: MÁXIMO 2 VUELTAS al pool y corte definitivo
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

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
  resolveKeyAttempts,
  resolveKey,
  withKeyRotation,
  resetKeyRotationIndexForTesting,
  encryptKey,
  MAX_POOL_ROUNDS,
} from '@/lib/ai-provider/key-rotator';

describe('Balanceador Inteligente de API Keys (key-rotator.ts)', () => {
  beforeAll(() => {
    vi.stubEnv('DATABASE_URL', 'postgresql://mock:mock@localhost/db');
    vi.stubEnv('ADMIN_ENCRYPTION_KEY', '12345678901234567890123456789012'); // 32 chars
  });

  beforeEach(() => {
    vi.clearAllMocks();
    resetKeyRotationIndexForTesting();
  });

  it('dispersa llamadas mediante Round-Robin in-memory para evitar saturación en una sola clave', async () => {
    const encKeyA = encryptKey('gemini-key-account-A');
    const encKeyB = encryptKey('gemini-key-account-B');
    const encKeyC = encryptKey('gemini-key-account-C');

    // DB retorna 3 llaves ordenadas por LRU
    mockSqlFn.mockResolvedValue([
      { id: 'uuid-a', label: 'Cuenta A', key_encrypted: encKeyA, is_active: true, priority: 1 },
      { id: 'uuid-b', label: 'Cuenta B', key_encrypted: encKeyB, is_active: true, priority: 2 },
      { id: 'uuid-c', label: 'Cuenta C', key_encrypted: encKeyC, is_active: true, priority: 3 },
    ]);

    // Llamada 1 (ej. Foundation)
    const attempts1 = await resolveKeyAttempts('gemini');
    expect(attempts1[0].apiKey).toBe('gemini-key-account-A');

    // Llamada 2 (ej. Project) -> debe empezar en Cuenta B
    const attempts2 = await resolveKeyAttempts('gemini');
    expect(attempts2[0].apiKey).toBe('gemini-key-account-B');

    // Llamada 3 (ej. Lab) -> debe empezar en Cuenta C
    const attempts3 = await resolveKeyAttempts('gemini');
    expect(attempts3[0].apiKey).toBe('gemini-key-account-C');

    // Llamada 4 (ej. Assessment) -> da la vuelta completa y empieza en Cuenta A
    const attempts4 = await resolveKeyAttempts('gemini');
    expect(attempts4[0].apiKey).toBe('gemini-key-account-A');
  });

  it('no aborta prematuramente ante 2 errores 503 consecutivos y rota por todo el pool hasta tener éxito', async () => {
    const encKeyA = encryptKey('gemini-key-account-A');
    const encKeyB = encryptKey('gemini-key-account-B');
    const encKeyC = encryptKey('gemini-key-account-C');

    mockSqlFn.mockResolvedValue([
      { id: 'uuid-a', label: 'Cuenta A (saturada)', key_encrypted: encKeyA, is_active: true, priority: 1 },
      { id: 'uuid-b', label: 'Cuenta B (saturada)', key_encrypted: encKeyB, is_active: true, priority: 2 },
      { id: 'uuid-c', label: 'Cuenta C (disponible)', key_encrypted: encKeyC, is_active: true, priority: 3 },
    ]);

    const calledKeys: string[] = [];

    const fn = vi.fn().mockImplementation(async (apiKey: string) => {
      calledKeys.push(apiKey);
      if (apiKey === 'gemini-key-account-A') {
        const err: any = new Error('This model is currently experiencing high demand. Spikes in demand are usually temporary.');
        err.status = 503;
        throw err;
      }
      if (apiKey === 'gemini-key-account-B') {
        const err: any = new Error('HTTP 503: Service Unavailable');
        err.status = 503;
        throw err;
      }
      // Cuenta C responde con éxito
      return 'Libro generado exitosamente por Cuenta C';
    });

    const result = await withKeyRotation('gemini', fn);

    expect(result).toBe('Libro generado exitosamente por Cuenta C');
    expect(calledKeys).toEqual([
      'gemini-key-account-A',
      'gemini-key-account-B',
      'gemini-key-account-C',
    ]);
  });

  it('permite una segunda vuelta si todas fallaron en la vuelta 1 y tiene éxito en la vuelta 2', async () => {
    const encKeyA = encryptKey('gemini-key-account-A');
    const encKeyB = encryptKey('gemini-key-account-B');

    mockSqlFn.mockResolvedValue([
      { id: 'uuid-a', label: 'Cuenta A', key_encrypted: encKeyA, is_active: true, priority: 1 },
      { id: 'uuid-b', label: 'Cuenta B', key_encrypted: encKeyB, is_active: true, priority: 2 },
    ]);

    let callCount = 0;
    const fn = vi.fn().mockImplementation(async () => {
      callCount++;
      // Falla en intento 1 (Cuenta A, Vuelta 1)
      // Falla en intento 2 (Cuenta B, Vuelta 1)
      // Tiene éxito en intento 3 (Cuenta A, Vuelta 2)
      if (callCount < 3) {
        const err: any = new Error('Rate limit 429');
        err.status = 429;
        throw err;
      }
      return 'Éxito en vuelta 2';
    });

    const result = await withKeyRotation('gemini', fn);
    expect(result).toBe('Éxito en vuelta 2');
    expect(callCount).toBe(3);
  });

  it('CIRCUITO DE CORTE: detiene terminantemente la rotación tras exactamente 2 vueltas al pool y NUNCA itera indefinidamente', async () => {
    expect(MAX_POOL_ROUNDS).toBe(2);

    const encKeyA = encryptKey('gemini-key-account-A');
    const encKeyB = encryptKey('gemini-key-account-B');
    const encKeyC = encryptKey('gemini-key-account-C');

    // 3 llaves en el pool -> máximo 3 * 2 = 6 intentos
    mockSqlFn.mockResolvedValue([
      { id: 'uuid-a', label: 'Cuenta A', key_encrypted: encKeyA, is_active: true, priority: 1 },
      { id: 'uuid-b', label: 'Cuenta B', key_encrypted: encKeyB, is_active: true, priority: 2 },
      { id: 'uuid-c', label: 'Cuenta C', key_encrypted: encKeyC, is_active: true, priority: 3 },
    ]);

    let totalAttempts = 0;
    const fn = vi.fn().mockImplementation(async () => {
      totalAttempts++;
      const err: any = new Error('503 Service Unavailable');
      err.status = 503;
      throw err;
    });

    // Debe fallar y lanzar el error tras exactamente 6 intentos (2 vueltas)
    await expect(withKeyRotation('gemini', fn)).rejects.toThrow();

    // Verificación estricta: exactamente 6 intentos, NINGUNO más
    expect(totalAttempts).toBe(6);
  });

  it('ignora en la vuelta 2 las llaves que fallaron por credencial inválida (401/403) en la vuelta 1', async () => {
    const encKeyA = encryptKey('gemini-key-account-A');
    const encKeyB = encryptKey('gemini-key-account-B');

    mockSqlFn.mockResolvedValue([
      { id: 'uuid-a', label: 'Cuenta A (inválida 401)', key_encrypted: encKeyA, is_active: true, priority: 1 },
      { id: 'uuid-b', label: 'Cuenta B (válida con demora)', key_encrypted: encKeyB, is_active: true, priority: 2 },
    ]);

    const attemptedKeys: string[] = [];

    const fn = vi.fn().mockImplementation(async (apiKey: string) => {
      attemptedKeys.push(apiKey);
      if (apiKey === 'gemini-key-account-A') {
        const err: any = new Error('401 Unauthorized: Invalid API key');
        err.status = 401;
        throw err;
      }
      if (apiKey === 'gemini-key-account-B' && attemptedKeys.filter(k => k === apiKey).length === 1) {
        // En vuelta 1, Cuenta B da 503 temporal
        const err: any = new Error('503 Service Unavailable');
        err.status = 503;
        throw err;
      }
      // En vuelta 2, Cuenta B triunfa
      return 'Cuenta B exitosa';
    });

    const result = await withKeyRotation('gemini', fn);
    expect(result).toBe('Cuenta B exitosa');

    // Cuenta A solo se intentó UNA vez (en Vuelta 1); en Vuelta 2 se saltó porque era 401
    expect(attemptedKeys).toEqual([
      'gemini-key-account-A', // Vuelta 1
      'gemini-key-account-B', // Vuelta 1
      'gemini-key-account-B', // Vuelta 2 (Cuenta A se omitió de forma segura)
    ]);
  });

  it('resolveKey selecciona llaves distribuidas equitativamente', async () => {
    const encKeyA = encryptKey('gemini-key-account-A');
    const encKeyB = encryptKey('gemini-key-account-B');

    mockSqlFn.mockResolvedValue([
      { id: 'uuid-a', label: 'Cuenta A', key_encrypted: encKeyA, is_active: true, priority: 1 },
      { id: 'uuid-b', label: 'Cuenta B', key_encrypted: encKeyB, is_active: true, priority: 2 },
    ]);

    const k1 = await resolveKey('gemini');
    expect(k1.apiKey).toBe('gemini-key-account-A');

    const k2 = await resolveKey('gemini');
    expect(k2.apiKey).toBe('gemini-key-account-B');
  });
});
