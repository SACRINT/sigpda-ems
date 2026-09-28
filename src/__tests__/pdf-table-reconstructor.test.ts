/**
 * src/__tests__/pdf-table-reconstructor.test.ts
 *
 * Pruebas unitarias para la reconstrucción de tablas y rejillas espaciales en PDF digital (H-183).
 * Valida la concatenación de celdas multi-fila y la preservación de texto en páginas sin tabla.
 */

import { describe, it, expect } from 'vitest';
import {
  reconstructPageLayout,
  type TextItemWithLayout,
} from '@/lib/document-ingestion/parsers/pdf-table-reconstructor';

describe('pdf-table-reconstructor (H-183)', () => {
  it('1. Reconstruye una tabla de 2 columnas y concatena celdas multi-fila en una sola fila Markdown', () => {
    // Fixture sintético de tabla con 2 columnas (tx ~50 y tx ~200) y celda multi-fila
    const items: TextItemWithLayout[] = [
      // Fila de encabezado (ty: 700)
      { str: 'No.', tx: 50, ty: 700, scaleY: 12, hasEOL: false },
      { str: 'Meta Institucional', tx: 200, ty: 700, scaleY: 12, hasEOL: true },

      // Fila 1 - Renglón 1 (ty: 670)
      { str: '1', tx: 50, ty: 670, scaleY: 10, hasEOL: false },
      { str: 'Lograr que mínimo el', tx: 200, ty: 670, scaleY: 10, hasEOL: true },

      // Fila 1 - Renglón 2 (ty: 655) -> continuación de la celda de la columna 2
      { str: '70% de los alumnos de primer semestre aprueben', tx: 200, ty: 655, scaleY: 10, hasEOL: true },

      // Fila 2 - Renglón 1 (ty: 620)
      { str: '2', tx: 50, ty: 620, scaleY: 10, hasEOL: false },
      { str: 'Capacitar al 100% de la plantilla docente', tx: 200, ty: 620, scaleY: 10, hasEOL: true },
    ];

    const { pageMarkdown, pageRawText } = reconstructPageLayout(items, 11, 1);

    // Debe contener estructura de tabla Markdown con tuberías
    expect(pageMarkdown).toContain('| No. | Meta Institucional |');
    expect(pageMarkdown).toContain('| --- | --- |');

    // La meta multi-fila debe estar unificada en una sola celda, NO fragmentada
    expect(pageMarkdown).toContain('Lograr que mínimo el 70% de los alumnos de primer semestre aprueben');
    expect(pageRawText).toContain('Lograr que mínimo el 70% de los alumnos de primer semestre aprueben');

    // La segunda meta también debe existir íntegra
    expect(pageMarkdown).toContain('Capacitar al 100% de la plantilla docente');
  });

  it('2. Preserva páginas de párrafos normales sin forzar tablas espurias (Tecomate / Vicente Suárez)', () => {
    // Fixture de texto continuo (margen izquierdo uniforme tx ~50)
    const items: TextItemWithLayout[] = [
      { str: 'DIAGNÓSTICO INSTITUCIONAL', tx: 50, ty: 700, scaleY: 16, hasEOL: true },
      { str: 'El plantel cuenta con una matrícula activa de 150 estudiantes.', tx: 50, ty: 670, scaleY: 11, hasEOL: true },
      { str: 'Durante el último ciclo escolar se observó una mejora en aprobación.', tx: 50, ty: 650, scaleY: 11, hasEOL: true },
    ];

    const { pageMarkdown } = reconstructPageLayout(items, 11, 1);

    // No debe contener formato de tabla Markdown
    expect(pageMarkdown).not.toContain('| --- |');
    expect(pageMarkdown).toContain('DIAGNÓSTICO INSTITUCIONAL');
    expect(pageMarkdown).toContain('El plantel cuenta con una matrícula activa de 150 estudiantes.');
  });

  it('3. Maneja página vacía defensivamente', () => {
    const { pageMarkdown, pageRawText } = reconstructPageLayout([], 12, 1);
    expect(pageMarkdown).toContain('[Página 1]');
    expect(pageRawText).toBe('');
  });
});
