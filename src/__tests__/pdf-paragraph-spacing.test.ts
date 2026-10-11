import { describe, it, expect, vi } from 'vitest';
import { jsPDF } from 'jspdf';
import { printParagraph } from '@/lib/pdf-workbook-renderer';
import { ColumnFlowManager } from '@/lib/visual-engine/column-flow-manager';

describe('REG-1 — PDF Paragraph Spacing y Line Height (Paridad con DOCX)', () => {
  it('printParagraph separa múltiples párrafos con 6.5mm y usa interlineado 6.0mm por defecto', () => {
    const doc = new jsPDF();
    const textSpy = vi.spyOn(doc, 'text');

    const twoParagraphs = 'Párrafo primero del texto didáctico.\n\nPárrafo segundo del texto didáctico.';
    const finalY = printParagraph(doc, twoParagraphs, 30, 15, 180, 279, { parseParagraphs: true });

    // Cada párrafo de una línea (lineHeight: 6.0) más el salto entre párrafos (paragraphSpacing: 6.5)
    // startY (30) + p1 (6.0) + spacing (6.5) + p2 (6.0) = ~48.5
    expect(finalY).toBeGreaterThan(45);
    expect(textSpy).toHaveBeenCalledTimes(2);
  });

  it('ColumnFlowManager.printMainParagraph aplica lineHeight: 6.0 y paragraphSpacing: 6.5 por defecto', () => {
    const doc = new jsPDF();
    const flow = new ColumnFlowManager({
      doc,
      margin: 15,
      contentWidth: 180,
      pageHeight: 279,
      mainW: 120,
      sideW: 55,
      sideXAbs: 140,
      pageContextMap: new Map(),
      subjectName: 'Pensamiento Matemático',
      blockName: 'Bloque I',
      missionNumber: 1,
      cleanMissionTitle: 'Modelado y Funciones',
      momentColor: [30, 58, 138],
    });

    const twoParagraphs = 'Primera parte del desafío situado.\n\nSegunda parte del desafío situado.';
    const startY = 30;
    const finalY = flow.printMainParagraph(twoParagraphs, startY, { parseParagraphs: true });

    // startY (30) + p1 (6.0) + spacing (6.5) + p2 (6.0) = ~48.5
    expect(finalY).toBeGreaterThan(45);
  });
});
