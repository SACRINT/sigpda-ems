import { describe, it, expect } from 'vitest';
import { normalizeContenidos } from '@/lib/text-utils';

describe('normalizeContenidos (hotfix crash 5.º/6.º: contenidos como string)', () => {
  it('envuelve un string en array', () => {
    expect(normalizeContenidos('Categorías: X')).toEqual(['Categorías: X']);
  });
  it('devuelve [] para null, undefined, vacío o tipos no soportados', () => {
    expect(normalizeContenidos(null)).toEqual([]);
    expect(normalizeContenidos(undefined)).toEqual([]);
    expect(normalizeContenidos('   ')).toEqual([]);
    expect(normalizeContenidos(42)).toEqual([]);
  });
  it('conserva arrays y convierte elementos a string', () => {
    expect(normalizeContenidos(['a', 'b'])).toEqual(['a', 'b']);
    expect(normalizeContenidos(['a', null])).toEqual(['a', '']);
  });
  it('el resultado siempre admite .map/.filter', () => {
    for (const v of ['x', null, ['y'], undefined]) {
      expect(() => normalizeContenidos(v).map(t => t).filter(Boolean)).not.toThrow();
    }
  });
});
