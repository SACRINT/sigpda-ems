/**
 * pdf-extra-pagination.test.ts — Paginación de los PDF de recursos didácticos
 * SIGPDA-EMS · MCCEMS Puebla 2026-2027
 *
 * Regresión del reporte de usuario: "el plan de clase se descarga en PDF con
 * páginas en blanco y sin la información que debería".
 *
 * 1. Plan de clase (caso peor: ≥ 5 000 caracteres, ~30 líneas) → UNA sola hoja y
 *    sin página casi vacía; el contenido completo sigue presente en el texto extraído.
 * 2. Rúbrica con criterios largos → ninguna hoja queda con solo la cabecera/cola
 *    de una fila partida (rowPageBreak: 'avoid').
 * 3. Cajas H4 (####) → el literal `####` nunca llega al PDF ni a Word.
 * 4. Paleta H4 compartida (PDF / DOCX / vista previa HTML) sin drift.
 */

import { describe, it, expect } from 'vitest';
import jsPDF from 'jspdf';
import { PDFParse } from 'pdf-parse';
import { Paragraph } from 'docx';
import { generateExtraPDF, type ExtraInput } from '@/lib/pdf-extra-generator';
import {
  generateExtraPdfDocument,
  renderExtraDocument,
  resolveExtraDensity,
} from '@/lib/pdf-extra-renderer';
import { createParagraphFromLine } from '@/lib/docx-helpers';
import {
  COLORS,
  LEVEL4_HEX,
  LEVEL4_RGB,
  resolveLevel4Key,
} from '@/lib/visual-engine/design-tokens';
import {
  LESSON_PLAN_FIXTURE_LINES,
  LESSON_PLAN_FIXTURE_MD,
} from '@/__tests__/fixtures/lesson-plan-paginacion';

// ── Helper de extracción por página con PDFParse v2 ───────────────────────────
async function extractPages(
  doc: jsPDF
): Promise<{ n: number; pages: string[]; fullText: string }> {
  const buffer = Buffer.from(doc.output('arraybuffer'));
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return {
      n: result.total,
      pages: result.pages.map((p) => p.text),
      fullText: result.text,
    };
  } finally {
    await parser.destroy();
  }
}

const chars = (text: string): number => text.replace(/\s/g, '').length;

/** `w:fill` del shading de un párrafo (árbol interno de docx 9.x). */
function shadingFill(paragraph: Paragraph): string | undefined {
  const props = (paragraph as unknown as { properties?: unknown }).properties;
  const walk = (node: unknown): string | undefined => {
    if (!node || typeof node !== 'object') return undefined;
    if (Array.isArray(node)) {
      for (const item of node) {
        const found = walk(item);
        if (found) return found;
      }
      return undefined;
    }
    const obj = node as { rootKey?: string; root?: unknown };
    if (obj.rootKey === 'w:shd' && Array.isArray(obj.root)) {
      for (const child of obj.root) {
        const attr = child as {
          rootKey?: string;
          root?: { fill?: { value?: string } };
        };
        if (attr.rootKey === '_attr' && attr.root?.fill?.value) {
          return attr.root.fill.value;
        }
      }
    }
    return walk(obj.root);
  };
  return walk(props);
}

const lessonPlanExtra: ExtraInput = {
  id: 'test-lesson-plan-paginacion',
  title:
    'Plan de Clase: Sesión 1 - Exploración Diagnóstica y Problematización Situada · Ecuaciones lineales y situaciones de interés',
  type: 'lesson_plan',
  content_text: LESSON_PLAN_FIXTURE_MD,
};

describe('Paginación de PDF de extras — sin páginas en blanco', () => {
  it('el plan de clase de caso extremo cabe en UNA hoja y conserva todo su contenido', async () => {
    // El fixture debe ser realmente del tamaño/estructura de los planes reales
    // (~4.9k caracteres en ~30 líneas no vacías: el peor caso de la BD).
    expect(lessonPlanExtra.content_text.length).toBeGreaterThan(4500);
    expect(LESSON_PLAN_FIXTURE_LINES.length).toBeGreaterThanOrEqual(25);
    expect(LESSON_PLAN_FIXTURE_LINES.length).toBeLessThanOrEqual(36);

    const doc = generateExtraPDF(lessonPlanExtra);
    expect(doc.getNumberOfPages()).toBe(1);

    const { n, pages, fullText } = await extractPages(doc);
    expect(n).toBe(1);
    // Antes del fix la última línea caía a una hoja 2 con ~250 caracteres.
    expect(chars(pages[0])).toBeGreaterThan(1500);

    // Nada de información perdida: secciones clave presentes en el texto extraído.
    expect(fullText).toContain('SECUENCIA DIDÁCTICA DE LA SESIÓN');
    // El motor convierte las fases en cintas en mayúsculas.
    expect(fullText).toContain('FASE DE APERTURA');
    expect(fullText).toContain('FASE DE DESARROLLO');
    expect(fullText).toContain('FASE DE CIERRE');
    expect(fullText).toContain('EVALUACIÓN Y PRODUCTO ESPERADO');
    expect(fullText).toContain('Contenido Formativo');
    expect(fullText).toContain('Heteroevaluación');
    expect(fullText).toContain('Ponderación');
    expect(fullText).toContain('x - 180 = 820');
    expect(fullText).not.toContain('####');
  });

  it('resolveExtraDensity elige una densidad que efectivamente reduce el plan a 1 hoja', () => {
    const density = resolveExtraDensity(lessonPlanExtra);
    expect(['compact', 'ultra']).toContain(density);

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
    renderExtraDocument(doc, lessonPlanExtra, undefined, density);
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it('los extras que no son plan de clase conservan la densidad normal', () => {
    const other: ExtraInput = {
      id: 'test-normal-density',
      title: 'Lista de Cotejo Formativa · Bloque 1',
      type: 'checklist',
      content_text: '| Criterio | Sí/No |\n| --- | --- |\n| Revisa la consigna | Sí |',
    };
    expect(resolveExtraDensity(other)).toBe('normal');
  });

  it('la rúbrica con criterios largos no deja ninguna hoja casi vacía', async () => {
    const criterio = (n: number): string =>
      `**Criterio ${n} de desempeño disciplinar** (25%) | Sobresaliente (10-9): aplica con precisión impecable los procedimientos en situaciones auténticas de la comunidad. | Notable (8-7): aplica los procedimientos en la mayoría de los casos con errores menores. | Suficiente (6-5): demuestra comprensión básica pero requiere supervisión constante. | Insuficiente (4-1): presenta deficiencias graves y necesita asesoría remedial inmediata.`;

    const rubric: ExtraInput = {
      id: 'test-rubric-paginacion',
      title: 'Rúbrica Analítica de Evaluación · Bloque 1',
      type: 'rubric',
      content_text: [
        '# RÚBRICA ANALÍTICA DE EVALUACIÓN · BLOQUE 1',
        '**Asignatura:** Pensamiento Matemático III | **Plantel:** CCT no registrado',
        '',
        '## RÚBRICA ANALÍTICA DE DESEMPEÑO (4 NIVELES NEM)',
        '',
        '| Criterio de Evaluación y Ponderación | Sobresaliente / Excelente (10 pts) | Notable / Bueno (8 pts) | Suficiente / Básico (6 pts) | Insuficiente / Requiere Apoyo (4 pts) |',
        '|---|---|---|---|---|',
        criterio(1),
        criterio(2),
        criterio(3),
        criterio(4),
      ].join('\n'),
    };

    const doc = generateExtraPDF(rubric);
    const { pages } = await extractPages(doc);
    for (const page of pages) {
      expect(chars(page)).toBeGreaterThanOrEqual(600);
    }
  });

  it('el colofón final no genera una hoja nueva con solo cabecera y pie', () => {
    // Contenido mínimo que termina justo después de una partición de página:
    // el motor no debe emitir páginas sin cuerpo.
    const extra: ExtraInput = {
      id: 'test-tail',
      title: 'Guía de Práctica · Bloque 1',
      type: 'practice_guide',
      content_text: ['# GUÍA DE PRÁCTICA', '', 'Instrucción inicial de la guía.', '', '*SIGPDA-EMS · Colofón*'].join('\n'),
    };
    const doc = generateExtraPdfDocument(extra);
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it('respeta el marcador <!-- pagebreak --> entre fichas y no lo imprime', async () => {
    const extra: ExtraInput = {
      id: 'test-pagebreak',
      title: 'Fichas de Trabajo Imprimibles · Bloque 1',
      type: 'practice_guide',
      content_text: [
        '# FICHA DE TRABAJO · SESIÓN 1',
        'Contenido de la ficha 1.',
        '<!-- pagebreak -->',
        '# FICHA DE TRABAJO · SESIÓN 2',
        'Contenido de la ficha 2.',
      ].join('\n'),
    };

    const doc = generateExtraPdfDocument(extra);
    expect(doc.getNumberOfPages()).toBe(2);

    const { fullText, pages } = await extractPages(doc);
    expect(fullText).not.toContain('<!-- pagebreak -->');
    expect(pages[0]).toContain('FICHA DE TRABAJO');
    expect(pages[1]).toContain('FICHA DE TRABAJO');
    expect(pages[1]).toContain('SESIÓN 2');
  });
});

describe('Cajas H4 (####) — paridad PDF / DOCX / vista previa', () => {
  it('el PDF no imprime el literal #### y sí la etiqueta del bloque', async () => {
    const extra: ExtraInput = {
      id: 'test-h4-pdf',
      title: 'Solucionario y Guía Pedagógica del Docente · Bloque 1',
      type: 'teacher_guide',
      content_text: [
        '# SOLUCIONARIO DOCENTE',
        '#### A. Mediación de Saberes Previos (Apertura)',
        'Ejercicio resuelto con procedimiento completo.',
        '#### E. Checkpoint Formativo y Metacognición (Cierre)',
        'Retroalimentación final del equipo.',
      ].join('\n'),
    };

    const doc = generateExtraPdfDocument(extra);
    const { fullText } = await extractPages(doc);
    expect(fullText).not.toContain('####');
    expect(fullText).toContain('Mediación de Saberes Previos');
    expect(fullText).toContain('Checkpoint Formativo');
  });

  it('createParagraphFromLine aplica el shading de la letra de la caja H4', () => {
    const pa = createParagraphFromLine('#### A. Mediación de Saberes Previos (Apertura)');
    const pb = createParagraphFromLine('#### B. Clave de Resolución del Ejemplo Modelo (Yo Hago)');
    const pe = createParagraphFromLine('#### E. Checkpoint Formativo y Metacognición (Cierre)');

    expect(shadingFill(pa)).toBe(LEVEL4_HEX.A);
    expect(shadingFill(pb)).toBe(LEVEL4_HEX.B);
    expect(shadingFill(pe)).toBe(LEVEL4_HEX.E);

    // El literal Markdown no debe sobrevivir dentro del párrafo de Word.
    const serialized = JSON.stringify(pa);
    expect(serialized).toContain('Mediación de Saberes Previos');
    expect(serialized).not.toContain('####');
  });

  it('la paleta H4 es única: sin drift entre RGB (PDF), HEX (DOCX/HTML) y los tokens de fase', () => {
    expect(LEVEL4_RGB.A).toEqual(COLORS.PHASE_APERTURA);
    expect(LEVEL4_RGB.B).toEqual(COLORS.PHASE_DESARROLLO);
    expect(LEVEL4_RGB.E).toEqual(COLORS.PHASE_CIERRE);

    const toHex = (rgb: readonly number[]): string =>
      rgb.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();

    (Object.keys(LEVEL4_HEX) as (keyof typeof LEVEL4_HEX)[]).forEach((key) => {
      expect(toHex(LEVEL4_RGB[key])).toBe(LEVEL4_HEX[key]);
    });
  });

  it('resolveLevel4Key resuelve letra inicial y palabras clave de fase', () => {
    expect(resolveLevel4Key('A. Apertura del bloque')).toBe('A');
    expect(resolveLevel4Key('C2. Criterios de acreditación')).toBe('C');
    expect(resolveLevel4Key('Fase de Apertura (10 min)')).toBe('A');
    expect(resolveLevel4Key('Desarrollo guiado')).toBe('B');
    expect(resolveLevel4Key('Cierre y socialización')).toBe('E');
    expect(resolveLevel4Key('Bloque transversal sin letra')).toBeNull();
  });
});
