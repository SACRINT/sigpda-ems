/**
 * extra-layout-columns.test.ts — Maquetación de listas de ítems y interlineado
 * SIGPDA-EMS · MCCEMS Puebla 2026-2027
 *
 * Sesión 2 (layout):
 * 1. Ítems cortos consecutivos (materiales, insumos, casillas) → 2 columnas en el
 *    PDF de extras y tabla invisible de 2 columnas en el DOCX.
 * 2. Ítems largos (p.ej. "Rol del Docente: …") → conservan 1 columna a ancho completo.
 * 3. Interlineado del cuerpo DOCX = 1.15 (w:line=276, auto) en viñetas, numeradas,
 *    citas y párrafos.
 */

import { describe, it, expect } from 'vitest';
import jsPDF from 'jspdf';
import { PDFParse } from 'pdf-parse';
import type { Paragraph, Table } from 'docx';
import { renderExtraDocument } from '@/lib/pdf-extra-renderer';
import type { ExtraInput } from '@/lib/pdf-extra-generator';
import {
  BODY_LINE_SPACING,
  createParagraphFromLine,
  createTwoColumnItemList,
} from '@/lib/docx-helpers';

const shortItems = Array.from(
  { length: 12 },
  (_, i) => `- Material didáctico ${i + 1} para la sesión de laboratorio`
);

const longItems = Array.from(
  { length: 6 },
  (_, i) =>
    `- **Rol del Docente ${i + 1}:** Explicación dialogada de principios disciplinares y modelado de relaciones entre variables en el pizarrón con material concreto y verificación de comprensión.`
);

async function extractPageLines(extra: ExtraInput): Promise<{ pages: number; lines: string[] }> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  renderExtraDocument(doc, extra, undefined, 'normal');
  const parser = new PDFParse({ data: Buffer.from(doc.output('arraybuffer')) });
  try {
    const result = await parser.getText();
    return {
      pages: result.total,
      lines: result.pages[0].text
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean),
    };
  } finally {
    await parser.destroy();
  }
}

describe('Listas de materiales/ítems en 2 columnas', () => {
  it('el PDF reparte ítems cortos consecutivos en 2 columnas', async () => {
    const extra: ExtraInput = {
      id: 'test-twocol-pdf',
      title: 'Materiales Didácticos e Insumos · Bloque 1',
      type: 'material',
      content_text: ['# INVENTARIO DE MATERIALES', '', ...shortItems, '', '*SIGPDA-EMS*'].join('\n'),
    };

    const { pages, lines } = await extractPageLines(extra);
    expect(pages).toBe(1);

    // En 2 columnas, cada renglón extraído contiene DOS ítems (misma coordenada Y).
    const paired = lines.filter((l) => /Material didáctico \d+ .*Material didáctico \d+/.test(l));
    expect(paired.length).toBe(6);

    // Ninguna información perdida.
    for (let i = 1; i <= 12; i++) {
      expect(lines.join('\n')).toContain(`Material didáctico ${i} para la sesión`);
    }
  });

  it('el PDF conserva 1 columna para ítems largos (no parte frases)', async () => {
    const extra: ExtraInput = {
      id: 'test-onecol-pdf',
      title: 'Plan de Clase · Bloque 1',
      type: 'lesson_plan',
      content_text: ['# PLAN DE CLASE', '', ...longItems].join('\n'),
    };

    const { pages, lines } = await extractPageLines(extra);
    expect(pages).toBe(1);

    // Un solo "Rol del Docente" por renglón extraído.
    const paired = lines.filter((l) => (l.match(/Rol del Docente \d+/g) || []).length > 1);
    expect(paired).toHaveLength(0);
    for (let i = 1; i <= 6; i++) {
      expect(lines.join('\n')).toContain(`Rol del Docente ${i}:`);
    }
  });

  it('el DOCX construye una tabla invisible de 2 columnas para la lista', () => {
    const table = createTwoColumnItemList(shortItems.slice(0, 5), 'bullet', 9000);
    const json = JSON.stringify(table as Table);

    // 5 ítems → 3 filas (3ª con celda derecha vacía) y 2 columnas de igual ancho.
    expect(json.split('"rootKey":"w:tr"').length - 1).toBe(3);
    expect(json.split('"rootKey":"w:gridCol"').length - 1).toBe(2);

    // Cada ítem de la lista está presente (docx serializa cada nodo 2 veces).
    for (let i = 1; i <= 5; i++) {
      expect(json).toContain(`Material didáctico ${i} `);
    }
  });

  it('el DOCX usa casilla ☐ en las columnas de tipo check', () => {
    const table = createTwoColumnItemList(['Revisa la consigna', 'Registra la evidencia'], 'check', 9000);
    const json = JSON.stringify(table as Table);
    expect(json).toContain('☐');
  });
});

describe('Interlineado del cuerpo DOCX (1.15)', () => {
  it('viñetas, numeradas, citas y párrafos aplican w:line=276 / auto', () => {
    const lines = [
      '- Viñeta de materiales para la sesión',
      '1. Paso numerado del procedimiento',
      '> Cita pedagógica de apertura',
      'Párrafo normal de cuerpo del documento.',
    ];
    for (const line of lines) {
      const p = createParagraphFromLine(line);
      const json = JSON.stringify(p as Paragraph);
      expect(json).toContain(`"value":${BODY_LINE_SPACING.line}`);
      expect(json).toContain('"key":"w:lineRule","value":"auto"');
    }
  });
});
