import { describe, it, expect } from 'vitest';
import jsPDF from 'jspdf';
import { ColumnFlowManager } from '@/lib/visual-engine/column-flow-manager';
import { drawMissionRubricTable } from '@/lib/visual-engine/mission-rubric-generator';
import type { EvaluationRubricCriterion } from '@/types/work-textbook';

describe('Adaptive Elastic Slack & Orphan Page Prevention (Bug 3)', () => {
  it('drawMissionRubricTable with compactMode=true generates a lower finalY than standard mode', () => {
    const docStandard = new jsPDF({ unit: 'mm', format: 'letter' });
    const docCompact = new jsPDF({ unit: 'mm', format: 'letter' });

    const mockRubric: EvaluationRubricCriterion[] = [
      {
        criterion: 'Criterio 1: Rigor Metodológico',
        weightPercent: 30,
        levels: [
          { levelName: 'Excelente', points: 10, descriptor: 'Demuestra dominio absoluto de las normas técnicas y proyecciones.' },
          { levelName: 'Bueno', points: 8, descriptor: 'Aplica adecuadamente las normas con mínimas desviaciones.' },
          { levelName: 'Suficiente', points: 6, descriptor: 'Cumple parcialmente con la representación ortogonal.' },
          { levelName: 'Requiere Apoyo', points: 4, descriptor: 'No identifica los principios de proyección diédrica.' },
        ],
      },
      {
        criterion: 'Criterio 2: Precisión en el Trazo',
        weightPercent: 30,
        levels: [
          { levelName: 'Excelente', points: 10, descriptor: 'Trazos limpios, espesor continuo normalizado y aristas ocultas a trazos.' },
          { levelName: 'Bueno', points: 8, descriptor: 'Trazo limpio con mínimas imperfecciones de paralelismo.' },
          { levelName: 'Suficiente', points: 6, descriptor: 'Empalmes irregulares y grosor de línea inconsistente.' },
          { levelName: 'Requiere Apoyo', points: 4, descriptor: 'Líneas discontinuas no normalizadas y manchas.' },
        ],
      },
    ];

    const yStandard = drawMissionRubricTable(docStandard, mockRubric, 15, 130, 50, [31, 56, 100], false);
    const yCompact = drawMissionRubricTable(docCompact, mockRubric, 15, 130, 50, [31, 56, 100], true);

    expect(yCompact).toBeLessThan(yStandard);
    expect(yStandard - yCompact).toBeGreaterThanOrEqual(4); // Compact saves at least 4-8mm
  });

  it('ColumnFlowManager absorbs an orphan single line within 4.5mm slack without creating a new page', () => {
    const doc = new jsPDF({ unit: 'mm', format: 'letter' });
    const flow = new ColumnFlowManager({
      doc,
      margin: 15,
      contentWidth: 185.9,
      pageHeight: 279.4,
      mainW: 130,
      sideW: 50,
      sideXAbs: 150.9,
      pageContextMap: new Map(),
      subjectName: 'Dibujo Técnico I',
      blockName: 'Bloque I',
      missionNumber: 1,
      cleanMissionTitle: 'Montea Triplanar',
      momentColor: [31, 56, 100],
    });

    const initialPages = doc.getNumberOfPages();
    // Position mainY so that exactly 1 line overflows contentBottom by 2mm (within the 4.5mm slack)
    // contentBottom is pageHeight - margin - 14 = 279.4 - 15 - 14 = 250.4
    const startY = flow.contentBottom - 4; // 246.4
    // Text that will create 1 line taking 6.0mm: 246.4 + 6.0 = 252.4 (2.0mm beyond contentBottom 250.4)
    flow.printMainParagraph('Esta es una sola línea final de texto que debe ajustarse al pie sin crear hoja nueva.', startY, {
      lineHeight: 6.0,
      size: 9.0,
      parseParagraphs: false,
    });

    // Should NOT have created a new page!
    expect(doc.getNumberOfPages()).toBe(initialPages);
  });
});

