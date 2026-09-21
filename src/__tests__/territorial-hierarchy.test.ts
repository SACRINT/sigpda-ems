import { describe, it, expect } from 'vitest';
import {
  normalizeTerritory,
  TERRITORIAL_HIERARCHY,
  TERMINOS_LOCALES_VALIDOS,
  validateRetoSituado
} from '@/lib/planning-evaluator';

describe('Territorial Hierarchy & Planning Evaluator — Anclaje Puebla', () => {
  it('1. Resuelve correctamente la jerarquía para Coronel Tito Hernández', () => {
    const res = normalizeTerritory('Coronel Tito Hernández');
    expect(res).not.toBeNull();
    expect(res?.localidad).toBe('Coronel Tito Hernández');
    expect(res?.municipio).toBe('Venustiano Carranza');
    expect(res?.regionCorde).toBe('CORDE 01 Huauchinango');
  });

  it('2. Resuelve correctamente por municipio de Venustiano Carranza', () => {
    const res = normalizeTerritory('Venustiano Carranza');
    expect(res).not.toBeNull();
    expect(res?.municipio).toBe('Venustiano Carranza');
    expect(res?.regionCorde).toBe('CORDE 01 Huauchinango');
  });

  it('3. Resuelve la cabecera distrital de Huauchinango como municipio propio', () => {
    const res = normalizeTerritory('Huauchinango');
    expect(res).not.toBeNull();
    expect(res?.municipio).toBe('Huauchinango');
    expect(res?.regionCorde).toBe('CORDE 01 Huauchinango');
  });

  it('4. Resuelve municipios de diversas CORDEs en el Estado de Puebla', () => {
    expect(normalizeTerritory('Teziutlán')?.regionCorde).toBe('CORDE 03 Teziutlán');
    expect(normalizeTerritory('Zacatlán')?.regionCorde).toBe('CORDE 02 Chignahuapan');
    expect(normalizeTerritory('San Pedro Cholula')?.regionCorde).toBe('CORDE 05 Cholula');
    expect(normalizeTerritory('Tehuacán')?.regionCorde).toBe('CORDE 10 Tehuacán');
    expect(normalizeTerritory('Puebla')?.regionCorde).toBe('CORDE Puebla Norte / Sur');
  });

  it('5. Tolera entradas con mayúsculas/minúsculas y espacios en blanco', () => {
    const res = normalizeTerritory('   coronel tito hernández   ');
    expect(res?.municipio).toBe('Venustiano Carranza');
  });

  it('6. Retorna null para entradas no reconocidas o vacías', () => {
    expect(TERRITORIAL_HIERARCHY.length).toBeGreaterThan(0);
    expect(normalizeTerritory('')).toBeNull();
    expect(normalizeTerritory(null)).toBeNull();
    expect(normalizeTerritory('Ciudad de Madrid')).toBeNull();
  });

  it('7. TERMINOS_LOCALES_VALIDOS incluye los municipios, localidades y CORDEs de la jerarquía', () => {
    expect(TERMINOS_LOCALES_VALIDOS).toContain('venustiano carranza');
    expect(TERMINOS_LOCALES_VALIDOS).toContain('coronel tito hernández');
    expect(TERMINOS_LOCALES_VALIDOS).toContain('corde 01 huauchinango');
  });

  it('8. validateRetoSituado alerta si el plantel es de Venustiano Carranza y el reto confunde el municipio con Huauchinango', () => {
    const val = validateRetoSituado(
      'Diseñar un modelo de optimización para el municipio de Huauchinango resolviendo el costo del agua.',
      { municipality: 'Venustiano Carranza' }
    );
    expect(val.feedback.some(f => f.includes('Inconsistencia territorial'))).toBe(true);
  });
});
