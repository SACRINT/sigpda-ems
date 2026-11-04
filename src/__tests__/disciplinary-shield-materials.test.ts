import { describe, it, expect } from 'vitest';
import { getMaterial } from '@/lib/materials/materials-catalog';
import { autoTokenizeMaterials, detectCatalogMaterials } from '@/lib/materials/auto-tokenize';
import { parseMaterialTokensWithFallback } from '@/lib/materials/material-tokens';

describe('Disciplinary Shield for Materials & Tokenization (Bug 1)', () => {
  it('correctly categorizes kitchen equipment as alimentos in materialsCatalog', () => {
    expect(getMaterial('tabla-cortar')?.category).toBe('alimentos');
    expect(getMaterial('batidora')?.category).toBe('alimentos');
    expect(getMaterial('horno-reposteria')?.category).toBe('alimentos');
  });

  it('suppresses kitchen items (tabla de picar) in Dibujo Técnico I via parseMaterialTokensWithFallback', () => {
    const textWithKitchenAnalogy = 'Prepara la tabla de picar y ajusta el escalímetro con la regla T';
    const tokensDT = parseMaterialTokensWithFallback(textWithKitchenAnalogy, {
      uacName: 'Dibujo Técnico I',
    });

    const slugs = tokensDT.map((t) => t.slug);
    expect(slugs).not.toContain('tabla-cortar');
    expect(slugs).toContain('regla-t');
  });

  it('permits kitchen items (tabla de picar) in Gastronomía / Alimentos via parseMaterialTokensWithFallback', () => {
    const textInGastro = 'Coloca los insumos sobre la tabla de picar y utiliza el cuchillo';
    const tokensGastro = parseMaterialTokensWithFallback(textInGastro, {
      uacName: 'Gastronomía y Servicios de Hospedaje',
    });

    const slugs = tokensGastro.map((t) => t.slug);
    expect(slugs).toContain('tabla-cortar');
  });

  it('filters out alimentos category in detectCatalogMaterials for technical drawing subjects', () => {
    const text = 'Usa una tabla de picar o superficie de corte junto con la escuadra y el compás';
    const detected = detectCatalogMaterials(text, {
      uacName: 'Dibujo Técnico II',
    });

    const slugs = detected.map((d) => d.slug);
    expect(slugs).not.toContain('tabla-cortar');
    expect(slugs).toContain('escuadras');
    expect(slugs).toContain('compas');
  });

  it('autoTokenizeMaterials will not inject kitchen material tokens into technical drawing text', () => {
    const text = 'Como un chef que prepara su receta en la cocina con batidora, traza la elipse con compás';
    const tokenized = autoTokenizeMaterials(text, {
      uacName: 'Dibujo Arquitectónico',
    });

    expect(tokenized).not.toContain('[[material:batidora');
    expect(tokenized).toContain('[[material:compas');
  });
});
