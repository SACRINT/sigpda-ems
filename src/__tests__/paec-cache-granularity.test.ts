/**
 * paec-cache-granularity.test.ts
 *
 * Tests unitarios para la invalidación granular por bloque en caché local (Item B4).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getCachedPaecStep,
  setCachedPaecStep,
  getCachedPaecBlock,
  setCachedPaecBlock,
  invalidatePaecStepCache,
} from '@/app/[locale]/paec/nuevo/PaecWizardClient';

describe('B4: Granular Block Cache & Invalidation in PAEC Wizard', () => {
  const pId = 'proj-uuid-123';
  let storage: Record<string, string> = {};

  beforeEach(() => {
    storage = {};
    // Mock window and localStorage
    const mockLocalStorage = {
      getItem: vi.fn((key: string) => storage[key] ?? null),
      setItem: vi.fn((key: string, val: string) => { storage[key] = val; }),
      removeItem: vi.fn((key: string) => { delete storage[key]; }),
      clear: vi.fn(() => { storage = {}; }),
      get length() { return Object.keys(storage).length; },
      key: vi.fn((idx: number) => Object.keys(storage)[idx] ?? null),
    };

    vi.stubGlobal('window', { localStorage: mockLocalStorage });
  });

  it('1. Guarda y recupera bloques granulares con la clave normalizada paec_cache_${pId}_step${step}_block${blockId}', () => {
    const block1Data = { cartaInvitacion: { asunto: 'Convocatoria' } };
    setCachedPaecBlock(pId, 8, 1, block1Data);

    const retrieved = getCachedPaecBlock(pId, 8, 1);
    expect(retrieved).toEqual(block1Data);
    expect(storage[`paec_cache_${pId}_step8_block1`]).toBe(JSON.stringify(block1Data));
  });

  it('2. Invalidar un bloque específico NO borra los bloques vecinos del mismo paso (Granularidad)', () => {
    const block1Data = { carta: 'Carta inicial' };
    const block2Data = { anexos: 'Anexos 1-3' };
    const block3Data = { encuestas: 'Anexos 4-6' };

    setCachedPaecBlock(pId, 8, 1, block1Data);
    setCachedPaecBlock(pId, 8, 2, block2Data);
    setCachedPaecBlock(pId, 8, 3, block3Data);

    // Invalidar únicamente el Bloque 1
    invalidatePaecStepCache(pId, { targetStep: 8, targetBlock: 1 });

    // Bloque 1 debe haber sido eliminado
    expect(getCachedPaecBlock(pId, 8, 1)).toBeNull();
    expect(storage[`paec_cache_${pId}_step8_block1`]).toBeUndefined();

    // Bloques 2 y 3 permanecen intactos
    expect(getCachedPaecBlock(pId, 8, 2)).toEqual(block2Data);
    expect(getCachedPaecBlock(pId, 8, 3)).toEqual(block3Data);
  });

  it('3. Invalidar un paso completo mediante targetStep elimina el paso y todos sus sub-bloques', () => {
    setCachedPaecStep(pId, 8, { fullStep: true });
    setCachedPaecBlock(pId, 8, 1, { b1: true });
    setCachedPaecBlock(pId, 8, 2, { b2: true });
    setCachedPaecBlock(pId, 9, 1, { step9b1: true });

    invalidatePaecStepCache(pId, { targetStep: 8 });

    expect(getCachedPaecStep(pId, 8)).toBeNull();
    expect(getCachedPaecBlock(pId, 8, 1)).toBeNull();
    expect(getCachedPaecBlock(pId, 8, 2)).toBeNull();

    // Paso 9 permanece intacto
    expect(getCachedPaecBlock(pId, 9, 1)).toEqual({ step9b1: true });
  });

  it('4. Invalidar en cascada con startingFromStep elimina pasos y bloques posteriores', () => {
    setCachedPaecStep(pId, 4, { cronograma: true });
    setCachedPaecStep(pId, 5, { detalle: true });
    setCachedPaecBlock(pId, 8, 1, { b1: true });

    invalidatePaecStepCache(pId, { startingFromStep: 5 });

    // Paso 4 queda preservado
    expect(getCachedPaecStep(pId, 4)).toEqual({ cronograma: true });

    // Pasos 5 en adelante y bloques quedan invalidados
    expect(getCachedPaecStep(pId, 5)).toBeNull();
    expect(getCachedPaecBlock(pId, 8, 1)).toBeNull();
  });

  it('5. Soporte backward compatible cuando se pasa un número en lugar de un objeto', () => {
    setCachedPaecStep(pId, 4, { cronograma: true });
    setCachedPaecStep(pId, 5, { detalle: true });

    invalidatePaecStepCache(pId, 4);

    expect(getCachedPaecStep(pId, 4)).toBeNull();
    expect(getCachedPaecStep(pId, 5)).toBeNull();
  });
});
