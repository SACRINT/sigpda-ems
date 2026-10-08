import { describe, it, expect, vi } from 'vitest';
import {
  buildMaterialSlugIndex,
  getMaterialCategoriesForContext,
  MATERIAL_INDEX_MAX_CHARS,
} from '@/lib/materials/slug-index';
import { MATERIALES_CATALOG } from '@/lib/materials/materials-catalog';
import { logger } from '@/lib/logger';

describe('slug-index — helper de índices para prompts', () => {
  it('buildMaterialSlugIndex() sin args devuelve 244 líneas y cada una empieza por "- "', () => {
    const index = buildMaterialSlugIndex();
    const lines = index.split('\n');
    expect(lines).toHaveLength(244);
    for (const line of lines) {
      expect(line.startsWith('- ')).toBe(true);
      expect(line).toMatch(/^- [a-z0-9-]+ — .+/);
    }
  });

  it('con ["matematicas"] incluye solo slugs de esa categoría', () => {
    const index = buildMaterialSlugIndex(['matematicas']);
    const lines = index.split('\n');
    const mathCatalog = MATERIALES_CATALOG.filter((m) => m.category === 'matematicas');

    expect(lines).toHaveLength(mathCatalog.length);
    for (const item of mathCatalog) {
      expect(index).toContain(`- ${item.slug} — ${item.name}`);
    }

    // No debe contener items de otras categorías (ej. multímetro de medición)
    expect(index).not.toContain('multimetro');
  });

  it('orden estable y determinista (dos llamadas producen exactamente el mismo string)', () => {
    const a = buildMaterialSlugIndex();
    const b = buildMaterialSlugIndex();
    expect(a).toBe(b);
  });

  it('getMaterialCategoriesForContext("Pensamiento Matemático III") incluye "matematicas"', () => {
    const cats = getMaterialCategoriesForContext('Pensamiento Matemático III');
    expect(cats).toContain('matematicas');
  });

  it('getMaterialCategoriesForContext("") devuelve []', () => {
    const cats = getMaterialCategoriesForContext('');
    expect(cats).toEqual([]);
  });

  it('getMaterialCategoriesForContext con contexto laboral incluye categorías laborales', () => {
    const cats = getMaterialCategoriesForContext('Mantenimiento', 'laboral');
    expect(cats).toContain('industrial');
    expect(cats).toContain('energia');
    expect(cats).toContain('ofimatica');
  });

  it('guarda maxChars trunca por categorías completas y registra warn', () => {
    const warnSpy = vi.spyOn(logger, 'warn');
    const limited = buildMaterialSlugIndex(undefined, MATERIAL_INDEX_MAX_CHARS);

    expect(limited.length).toBeLessThanOrEqual(MATERIAL_INDEX_MAX_CHARS);
    expect(warnSpy).toHaveBeenCalled();
    const lines = limited.split('\n');
    expect(lines.length).toBeGreaterThan(0);
    // Cada línea es completa
    for (const line of lines) {
      expect(line.startsWith('- ')).toBe(true);
    }
    warnSpy.mockRestore();
  });

  it('longitud del índice filtrado para UACs comunes es muy inferior a 9000 caracteres', () => {
    const mathIndex = buildMaterialSlugIndex(getMaterialCategoriesForContext('Pensamiento Matemático III'));
    expect(mathIndex.length).toBeLessThanOrEqual(MATERIAL_INDEX_MAX_CHARS);
    expect(mathIndex.length).toBeLessThan(4000);

    const fisIndex = buildMaterialSlugIndex(getMaterialCategoriesForContext('Física I'));
    expect(fisIndex.length).toBeLessThanOrEqual(MATERIAL_INDEX_MAX_CHARS);
    expect(fisIndex.length).toBeLessThan(4000);
  });
});
