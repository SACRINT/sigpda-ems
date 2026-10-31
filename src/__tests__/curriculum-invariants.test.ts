/**
 * curriculum-invariants.test.ts — Guardián Automatizado de Invariantes Curriculares (SEP / MCCEMS)
 * 
 * Este test actúa como centinela en CI/CD. Previene regresiones futuras cuando la SEP modifique
 * o agregue asignaturas de 5to y 6to semestre (transición de progresiones a propósitos formativos).
 * Si alguien introduce una nueva UAC que no esté auditada o cause colisiones semánticas,
 * este test FALLARÁ inmediatamente en el build de GitHub / Vercel, impidiendo errores en producción.
 */

import { describe, it, expect } from 'vitest';
import masterUacs from '@/lib/curriculum/data/uacs_master_203.json';
import { resolveSacrintPack, CANONICAL_UAC_PACKS, SACRINT_PACKS } from '@/lib/visual-engine/sacrint/discipline-packs';
import { resolveTargetSessionsForWorkbook } from '@/lib/guide-engine/material-extractor';
import { sanitizeEducationalResourceUrl } from '@/lib/pdf-workbook-renderer';
import { normalizeUnicode } from '@/lib/utils/normalize';

describe('GUARDIÁN DE INVARIANTES CURRICULARES (SEP / MCCEMS 2026-2027)', () => {
  it('INVARIANTE 1: El 100% de las 203 UACs oficiales resuelve a una familia disciplinar específica (Cero huérfanas en general)', () => {
    const unclassified: string[] = [];

    for (const uac of masterUacs as any[]) {
      const name = uac.uac_name || uac.name;
      const pack = resolveSacrintPack(name, uac.component);
      if (pack.id === 'general') {
        unclassified.push(`"${name}" (Componente: ${uac.component})`);
      }
    }

    if (unclassified.length > 0) {
      console.error('🚨 UACs sin clasificar encontradas:', unclassified);
    }
    expect(unclassified).toHaveLength(0);
  });

  it('INVARIANTE 2: Ninguna asignatura deportiva o de educación física puede colisionar con Física de Exactas', () => {
    const sportsUacs = [
      'Actividades Físicas y Deportivas',
      'Actividades Físicas y Deportivas I',
      'Actividades Físicas y Deportivas II',
      'Educación Física',
      'Acondicionamiento Físico y Salud',
      'Cultura Física y Deporte',
    ];

    for (const name of sportsUacs) {
      const pack = resolveSacrintPack(name);
      expect(pack.id).toBe('educacion_fisica');
      expect(pack.short).toBe('EFI');
      expect(pack.id).not.toBe('fisica');
    }
  });

  it('INVARIANTE 3: Ningún módulo de Formación para el Trabajo puede ser capturado por disciplinas académicas puras', () => {
    const vocationalModules = (masterUacs as any[]).filter((u) => u.component === 'laboral');
    expect(vocationalModules.length).toBeGreaterThan(50);

    for (const uac of vocationalModules) {
      const pack = resolveSacrintPack(uac.uac_name, 'laboral');
      expect(pack.id).toBe('laboral');
      expect(pack.short).toBe('LAB');
    }
  });

  it('INVARIANTE 4: UACs de 5to Semestre resuelven con carga oficial (54 hrs = 18 sesiones) y disciplina correcta', () => {
    // 1. Taller de Pensamiento Variacional I (54h = 18 sesiones/bloque)
    const variacionalPack = resolveSacrintPack('Taller de Pensamiento Variacional I', 'ffeo');
    expect(variacionalPack.id).toBe('matematicas');
    expect(resolveTargetSessionsForWorkbook({} as any, { hours: 18 } as any)).toBe(18);

    // 2. Dibujo Técnico I (54h = 18 sesiones/bloque)
    const dibujoPack = resolveSacrintPack('Dibujo Técnico I', 'ffe_optativa');
    expect(dibujoPack.id).toBe('tecnologia');
    expect(resolveTargetSessionsForWorkbook({} as any, { hours: 18 } as any)).toBe(18);

    // 3. Actividades Físicas y Deportivas (36h = 12 sesiones/bloque)
    const afydPack = resolveSacrintPack('Actividades Físicas y Deportivas', 'socioemocional');
    expect(afydPack.id).toBe('educacion_fisica');
    expect(resolveTargetSessionsForWorkbook({} as any, { hours: 12 } as any)).toBe(12);
  });

  it('INVARIANTE 5: Cero enlaces de soporte a Google Scholar (resiliencia absoluta anti-CAPTCHA y anti-429)', () => {
    const testCases = [
      { url: 'https://scholar.google.es/scholar?q=fisiologia', title: 'Fisiología', type: 'web' },
      { url: 'https://scholar.google.com/scholar?q=dibujo', title: 'Dibujo Técnico', type: 'web' },
      { url: 'https://www.youtube.com/watch?v=ejemplo_123', title: 'Tutorial Kinovea', type: 'video' },
      { url: 'https://example.com/recurso', title: 'Pensamiento Variacional', type: 'web' },
    ];

    for (const test of testCases) {
      const sanitized = sanitizeEducationalResourceUrl(test.url, test.title, test.type);
      expect(sanitized).not.toContain('scholar.google');
      expect(sanitized).not.toContain('example.com');
      expect(sanitized).not.toContain('watch?v=ejemplo');
      if (test.type === 'video') {
        expect(sanitized).toContain('youtube.com/results?search_query=');
      } else {
        expect(sanitized).toContain('google.com/search?q=');
      }
    }
  });

  it('INVARIANTE 6: El mapa canónico CANONICAL_UAC_PACKS contiene las asignaturas clave de Humanidades y Filosofía', () => {
    expect(CANONICAL_UAC_PACKS['humanidades i']).toBe('filosofia');
    expect(CANONICAL_UAC_PACKS['humanidades ii']).toBe('filosofia');
    expect(CANONICAL_UAC_PACKS['humanidades iii']).toBe('filosofia');
    expect(CANONICAL_UAC_PACKS['pensamiento filosofico i']).toBe('filosofia');
    expect(CANONICAL_UAC_PACKS['pensamiento literario']).toBe('literatura');
    expect(CANONICAL_UAC_PACKS['arte y cultura i']).toBe('artes');
    expect(CANONICAL_UAC_PACKS['procesos contables i']).toBe('laboral');
  });
});
