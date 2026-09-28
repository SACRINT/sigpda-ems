/**
 * src/__tests__/pmc-previous-meta-matcher.test.ts
 *
 * Pruebas unitarias para la vinculación estructural de metas previas adaptadas (H-052).
 * Verifica que editar el texto de una meta adaptada en el Paso 4 no rompa el enlace
 * estructural ni reactive el botón "Adaptar" (evita duplicados).
 */

import { describe, it, expect } from 'vitest';
import { isPreviousMetaAdapted } from '@/app/[locale]/pmc/nuevo/PmcWizardClient';

describe('isPreviousMetaAdapted (H-052)', () => {
  const previousMeta = {
    categoria: 'Aprovechamiento académico',
    meta: 'Lograr que el 85% de los alumnos de primer semestre aprueben Matemáticas',
    tema: 'Aprobación escolar',
  };

  it('detecta meta recién adaptada con prefijo [Continuidad 2026-2027]', () => {
    const metasInstitucionales = [
      {
        meta: '[Continuidad 2026-2027] Lograr que el 85% de los alumnos de primer semestre aprueben Matemáticas',
        continuidad_de: 'Lograr que el 85% de los alumnos de primer semestre aprueben Matemáticas',
      },
    ];

    expect(isPreviousMetaAdapted(previousMeta, metasInstitucionales, 0)).toBe(true);
  });

  it('edge (a): mantiene vínculo estructural activo cuando el director edita o borra el prefijo del texto', () => {
    // El director edita el texto en el Paso 4 y cambia la redacción por completo sin el prefijo
    const metasInstitucionales = [
      {
        meta: 'Meta personalizada: Alcanzar 90% en competencias matemáticas para grupos 1A y 1B',
        continuidad_de: 'Lograr que el 85% de los alumnos de primer semestre aprueben Matemáticas',
      },
    ];

    // Gracias al campo estructural continuidad_de, se detecta que ya fue adaptada
    expect(isPreviousMetaAdapted(previousMeta, metasInstitucionales, 0)).toBe(true);
  });

  it('devuelve false cuando la meta previa no ha sido adaptada', () => {
    const otherPreviousMeta = {
      categoria: 'Infraestructura',
      meta: 'Equipar el aula de cómputo con 15 computadoras nuevas',
      tema: 'Equipamiento',
    };

    const metasInstitucionales = [
      {
        meta: 'Meta personalizada: Alcanzar 90% en competencias matemáticas',
        continuidad_de: 'Lograr que el 85% de los alumnos de primer semestre aprueben Matemáticas',
      },
    ];

    expect(isPreviousMetaAdapted(otherPreviousMeta, metasInstitucionales, 1)).toBe(false);
  });

  it('devuelve false si el arreglo de metas institucionales está vacío o undefined', () => {
    expect(isPreviousMetaAdapted(previousMeta, [], 0)).toBe(false);
    expect(isPreviousMetaAdapted(previousMeta, undefined, 0)).toBe(false);
  });

  it('vincula por texto_original cuando la meta institucional adaptada usa texto_normalizado (C3 / H-052)', () => {
    const previousMetaWithOriginal = {
      meta: 'Aprobar al 85% de los alumnos de primer semestre en Puebla mediante tutorías',
      texto_original: 'Lograr que el 85% de los alumnos de primer semestre aprueben Matemáticas',
      categoria: 'Aprovechamiento académico',
      tema: 'Aprobación escolar',
    };

    const metasInstitucionales = [
      {
        meta: '[Continuidad 2026-2027] Aprobar al 85% de los alumnos de primer semestre en Puebla mediante tutorías',
        continuidad_de: 'Lograr que el 85% de los alumnos de primer semestre aprueben Matemáticas',
      },
    ];

    expect(isPreviousMetaAdapted(previousMetaWithOriginal, metasInstitucionales, 0)).toBe(true);
  });
});
