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
import { extractDeterministicMccemsProgram } from '@/lib/pdf-parser';
import { enforceOfficialProgresiones } from '@/lib/planning/progresiones-enforcer';

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

  it('INVARIANTE 7: Progresiones íntegras sin truncamiento para FFE de 5.° y 6.° semestre (8 en Variacional I)', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const canonicalList = require('../../scripts/data/curriculum_canonical_203.json');

    // 1. Taller de Pensamiento Variacional I (Sem 5)
    const var1 = canonicalList.find((u: any) => u.semester === 5 && u.uac_name.includes('Variacional'));
    expect(var1).toBeDefined();
    expect(var1.activities).toHaveLength(8);
    const var1Orders = var1.activities.map((a: any) => a.order);
    expect(var1Orders).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    for (const act of var1.activities) {
      expect(act.name.length).toBeGreaterThan(60);
      expect(act.hours).toBeGreaterThan(0);
    }
    const var1HoursSum = var1.activities.reduce((s: number, a: any) => s + a.hours, 0);
    expect(var1HoursSum).toBe(54);

    // 2. Dibujo Técnico I (Sem 5)
    const dib1 = canonicalList.find((u: any) => u.semester === 5 && u.uac_name.includes('Dibujo') && u.uac_name.includes('I'));
    expect(dib1).toBeDefined();
    expect(dib1.activities).toHaveLength(7);
    const dib1Orders = dib1.activities.map((a: any) => a.order);
    expect(dib1Orders).toEqual([1, 2, 3, 4, 5, 6, 7]);
    for (const act of dib1.activities) {
      expect(act.name.length).toBeGreaterThan(60);
    }

    // 3. Dibujo Técnico II (Sem 6)
    const dib2 = canonicalList.find((u: any) => u.semester === 6 && u.uac_name.includes('Dibujo') && u.uac_name.includes('II'));
    expect(dib2).toBeDefined();
    expect(dib2.activities).toHaveLength(8);
    const dib2Orders = dib2.activities.map((a: any) => a.order);
    expect(dib2Orders).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);

    // 4. Taller de Pensamiento Variacional II (Sem 6)
    const var2 = canonicalList.find((u: any) => u.semester === 6 && u.uac_name.includes('Variacional'));
    expect(var2).toBeDefined();
    expect(var2.activities).toHaveLength(7);

    // 5. Verificar Categorías, Subcategorías y Metas reales en las 4 UACs auditadas
    for (const uacItem of [var1, var2, dib1, dib2]) {
      expect(Array.isArray(uacItem.contenidos_formativos)).toBe(true);
      expect(uacItem.contenidos_formativos).toHaveLength(uacItem.activities.length);
      for (const act of uacItem.activities) {
        expect(Array.isArray(act.categorias)).toBe(true);
        expect(act.categorias.length).toBeGreaterThan(0);
        expect(Array.isArray(act.subcategorias)).toBe(true);
        expect(act.subcategorias.length).toBeGreaterThan(0);
        expect(Array.isArray(act.metas)).toBe(true);
        expect(act.metas.length).toBeGreaterThan(0);
      }
    }
  });

  it('INVARIANTE 8: Extractor determinista multilínea recupera "Progresión\\n6:" partida en líneas y Aprendizajes de trayectoria reales', () => {
    const samplePdfMarkdown = `
II. Aprendizajes de trayectoria
El Taller de Pensamiento Variacional, al formar parte del Recurso sociocognitivo de Pensamiento Matemático, considera los mismos aprendizajes de trayectoria, los cuales se explicitan en el acuerdo secretarial 09/08/23 y se presentan a continuación:
● Valora la aplicación de procedimientos automáticos y algorítmicos, así como la interpretación de sus resultados para anticipar, encontrar y validar soluciones a problemas matemáticos.
● Modela y propone soluciones a problemas tanto teóricos como de su entorno, empleando lenguaje y técnicas matemáticas.
III. Progresiones y metas de aprendizaje
Progresiones de Aprendizaje
Taller de Pensamiento Variacional I
Progresión 1: Aplica técnicas aritméticas, algebraicas y operaciones funcionales a través del planteamiento de problemáticas de las ciencias.
Metas | Categorías | Subcategorías
C1M1. Ejecuta cálculos y algoritmos. | C1. Procedural | S1. Elementos aritmético-algebraicos
Progresión 2: Analiza de manera formal el concepto de límite, profundizando en el cálculo de límites de funciones mediante sus teoremas.
Metas | Categorías | Subcategorías
C1M1. Ejecuta cálculos. | C1. Procedural | S3. Elementos variacionales
Progresión
6:
Aplica procedimientos algorítmicos para derivar funciones implícitas y de orden superior, así como el uso de estas últimas para resolver límites indeterminados utilizando la regla de L’Hopital.
Metas | Categorías | Subcategorías
C1M2. Analiza los resultados obtenidos. | C1. Procedural | S3. Elementos variacionales
IV. Transversalidad
`;
    const extracted = extractDeterministicMccemsProgram(samplePdfMarkdown, 5);
    expect(extracted).not.toBeNull();
    expect(extracted!.learningOutcome).toContain('Valora la aplicación de procedimientos automáticos');
    expect(extracted!.learningOutcome).not.toContain('se presentan a continuación');
    const prog6 = extracted!.activities.find((a) => a.order === 6);
    expect(prog6).toBeDefined();
    expect(prog6!.name).toContain('regla de L’Hopital');
    expect(prog6!.categorias).toContain('C1. Procedural');
  });

  it('INVARIANTE 9: enforceOfficialProgresiones erradica rangos ("Progresión 3 a 7") e impone 1 bloque verbatim por Progresión oficial', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const canonicalList = require('../../scripts/data/curriculum_canonical_203.json');
    const var1 = canonicalList.find((u: any) => u.semester === 5 && u.uac_name.includes('Variacional'));

    const collapsedAiContent: Record<string, unknown> = {
      sectionI: { uacName: 'Taller de Pensamiento Variacional I', semester: 5 },
      sectionII: {
        learningOutcome: 'El Taller de Pensamiento Variacional, al formar parte del Recurso sociocognitivo...',
        activities: [{ name: 'Progresión 1 truncada', hours: 18 }],
      },
      sectionIV: {
        activities: [
          { name: 'Progresión 1', hours: 18, corte: 'Corte 1', apertura: ['Paso A1'], ejecucion: ['Paso D1'], conclusion: ['Paso C1'] },
          { name: 'Progresión 2', hours: 18, corte: 'Corte 2', apertura: ['Paso A2'], ejecucion: ['Paso D2'], conclusion: ['Paso C2'] },
          { name: 'Progresión 3 a 7', hours: 18, corte: 'Corte 3', apertura: ['Paso A3'], ejecucion: ['Paso D3'], conclusion: ['Paso C3'] },
        ],
      },
    };

    const enforced = enforceOfficialProgresiones(collapsedAiContent, var1, null, 5, 'ext_optativo');
    const s4Acts = (enforced.sectionIV as any).activities;
    expect(s4Acts).toHaveLength(8);
    for (let i = 0; i < 8; i++) {
      expect(s4Acts[i].name).toMatch(new RegExp(`^Progresión ${i + 1}:`));
      expect(s4Acts[i].name).not.toContain('a 7');
      expect(s4Acts[i].contenidoFormativo).toContain('Categorías:');
      expect(s4Acts[i].contenidoFormativo).toContain('Subcategorías:');
    }
    const totalHours = s4Acts.reduce((acc: number, a: any) => acc + a.hours, 0);
    expect(totalHours).toBe(54);
  });
});
