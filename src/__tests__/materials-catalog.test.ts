// src/__tests__/materials-catalog.test.ts
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  MATERIALES_CATALOG,
  getMaterial,
  getMaterialImagePaths,
} from '@/lib/materials/materials-catalog';
import { readMaterialPng } from '@/lib/materials/material-figure-doc';

describe('T-IMG-08: Test de Integridad Cruzada del Catálogo de Materiales', () => {
  it('contiene los 48 slugs prioritarios P1 del Modelo Educativo 2025 / MCCEMS', () => {
    const p1Items = MATERIALES_CATALOG.filter((item) => item.priority === 'P1');
    expect(p1Items.length).toBeGreaterThanOrEqual(48);
  });

  it('todos los slugs son únicos y cumplen con formato kebab-case estricto', () => {
    const slugs = MATERIALES_CATALOG.map((item) => item.slug);
    const uniqueSlugs = new Set(slugs);

    expect(uniqueSlugs.size).toBe(slugs.length);

    for (const slug of slugs) {
      expect(slug).toMatch(/^[a-z0-9-]+$/);
      expect(slug).not.toContain(' ');
      expect(slug).not.toContain('_');
    }
  });

  it('todo ítem tiene altText obligatorio, descriptivo y no vacío para accesibilidad y PDF', () => {
    for (const item of MATERIALES_CATALOG) {
      expect(item.altText).toBeDefined();
      expect(typeof item.altText).toBe('string');
      expect(item.altText.trim().length).toBeGreaterThanOrEqual(10);
    }
  });

  it('no existen colisiones de aliases entre materiales distintos', () => {
    const aliasMap = new Map<string, string>();

    for (const item of MATERIALES_CATALOG) {
      if (item.aliases) {
        for (const rawAlias of item.aliases) {
          const alias = rawAlias.toLowerCase();
          const existingOwner = aliasMap.get(alias);
          if (existingOwner) {
            expect(existingOwner).toBe(item.slug);
          } else {
            aliasMap.set(alias, item.slug);
          }
        }
      }
    }
  });

  it('todo equivalente virtual definido utiliza exclusivamente URL con protocolo seguro https://', () => {
    for (const item of MATERIALES_CATALOG) {
      if (item.equivalenteVirtual) {
        expect(item.equivalenteVirtual.nombre).toBeTruthy();
        expect(item.equivalenteVirtual.url).toMatch(/^https:\/\//);
        expect(typeof item.equivalenteVirtual.offline).toBe('boolean');
      }
    }
  });

  it('getMaterial resuelve por slug canónico y por aliases (incluso con y sin tildes)', () => {
    const multimetroDirect = getMaterial('multimetro');
    expect(multimetroDirect?.slug).toBe('multimetro');

    const multimetroAliasTilde = getMaterial('multímetro');
    expect(multimetroAliasTilde?.slug).toBe('multimetro');

    const multimetroAliasSinTilde = getMaterial('polimetro');
    expect(multimetroAliasSinTilde?.slug).toBe('multimetro');

    const inexistente = getMaterial('aparato-inexistente-123');
    expect(inexistente).toBeUndefined();
  });

  it('getMaterialImagePaths deriva rutas locales esperadas bajo /images/materiales/', () => {
    const paths = getMaterialImagePaths('osciloscopio');
    expect(paths.png).toBe('/images/materiales/osciloscopio.png');
    expect(paths.placeholder).toBe('/images/materiales/_placeholder.png');
  });

  it('readMaterialPng devuelve buffer de _placeholder.png ante asset aún no provisto físicamente', () => {
    const buffer = readMaterialPng('multimetro');
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer!.length).toBeGreaterThan(1000);
  });

  it('el archivo _placeholder.png existe en el filesystem y cumple con límite de peso <= 60 KB (D10)', () => {
    const placeholderPath = path.join(
      process.cwd(),
      'public',
      'images',
      'materiales',
      '_placeholder.png'
    );
    expect(fs.existsSync(placeholderPath)).toBe(true);
    const stats = fs.statSync(placeholderPath);
    // <= 60 KB = 61440 bytes
    expect(stats.size).toBeLessThanOrEqual(61440);
  });
});
