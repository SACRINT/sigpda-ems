import { describe, it, expect } from 'vitest';
import { toRealNumber, isRealNumeric } from '@/lib/numeric-guard';

describe('A-04: numeric-guard — Helper canónico de números reales', () => {
  it('conserva el 0 legítimo tanto numérico como en string', () => {
    expect(toRealNumber(0)).toBe(0);
    expect(toRealNumber('0')).toBe(0);
    expect(isRealNumeric(0)).toBe(true);
    expect(isRealNumeric('0')).toBe(true);
  });

  it('retorna undefined para null y undefined', () => {
    expect(toRealNumber(null)).toBeUndefined();
    expect(toRealNumber(undefined)).toBeUndefined();
    expect(isRealNumeric(null)).toBe(false);
    expect(isRealNumeric(undefined)).toBe(false);
  });

  it('retorna undefined para cadenas vacías o compuestas por espacios', () => {
    expect(toRealNumber('')).toBeUndefined();
    expect(toRealNumber('   ')).toBeUndefined();
    expect(isRealNumeric('')).toBe(false);
    expect(isRealNumeric('   ')).toBe(false);
  });

  it('retorna undefined para strings no numéricos (NaN)', () => {
    expect(toRealNumber('abc')).toBeUndefined();
    expect(toRealNumber('N/D')).toBeUndefined();
    expect(isRealNumeric('abc')).toBe(false);
    expect(isRealNumeric('N/D')).toBe(false);
  });

  it('convierte cadenas numéricas decimales o enteras a números reales', () => {
    expect(toRealNumber('88.4')).toBe(88.4);
    expect(toRealNumber(88.4)).toBe(88.4);
    expect(toRealNumber('100')).toBe(100);
    expect(isRealNumeric('88.4')).toBe(true);
  });

  it('descarta booleanos, objetos y arreglos', () => {
    expect(toRealNumber(true)).toBeUndefined();
    expect(toRealNumber(false)).toBeUndefined();
    expect(toRealNumber({})).toBeUndefined();
    expect(toRealNumber([])).toBeUndefined();
    expect(isRealNumeric(true)).toBe(false);
    expect(isRealNumeric(false)).toBe(false);
  });
});
