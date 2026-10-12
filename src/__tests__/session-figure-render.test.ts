// src/__tests__/session-figure-render.test.ts
/**
 * BRECHA 3 — Figuras visuales POR SESIÓN en el scaffold del libro del estudiante.
 *
 * Verifica en render REAL (DOCX descomprimido + texto extraído del PDF) que:
 *  - Misión con ≥4 sesiones: cada sesión intermedia lleva su "Figura S<n>".
 *  - Misión con ≤3 sesiones: la sección "Nosotros Hacemos" lleva su "Figura S<n>".
 *  La figura viene de dispatchVisual (SVG determinista offline) rasterizado a PNG
 *  con alfa por sharp; resolveVisualForMission se mockea a null para probar que
 *  NO se requiere red ni BD.
 */

import { describe, it, expect, vi } from 'vitest';
import JSZip from 'jszip';
import { PDFParse } from 'pdf-parse';
import { renderWorkbookToDocx } from '@/lib/docx-workbook-renderer';
import { renderWorkbookToPdf } from '@/lib/pdf-workbook-renderer';
import * as visualAssetManager from '@/lib/visual-engine/visual-asset-manager';
import type { ActiveWorkTextbook, MissionSection } from '@/types/work-textbook';
import type { Planning } from '@/types/planning';

const mockPlanning = {
  id: 'plan-test-session-figure',
  uacName: 'Pensamiento Matemático III',
  contentJson: { sectionI: {}, sectionII: {} },
};

function baseMission(overrides: Partial<MissionSection>): MissionSection {
  return {
    missionIndex: 1,
    title: 'Sistemas de ecuaciones en la vida diaria',
    coveredSessions: [1, 2, 3, 4],
    sessionTopic: 'Sistemas de ecuaciones lineales 2x2',
    sessionFocus: 'Métodos de solución gráfico y analítico',
    phenomenonHook: { story: 'La cooperativa calcula costos.', detonatingQuestion: '¿Cómo igualar costos?' },
    conceptZero: {
      physicalAnalogy: 'Una balanza en equilibrio.',
      coreExplanation: 'Un sistema de ecuaciones lineales 2x2 tiene solución donde se cruzan las rectas.',
    },
    iDoSection: { stepByStepDemo: 'Modelado del método de sustitución con números concretos.' },
    weDoSection: { guidedPractice: 'Resuelvan en equipo un sistema 2x2 con datos de su comunidad.', workbookElements: [] },
    youDoSection: { autonomousChallenge: 'Plantea y resuelve un sistema de tu entorno.', workbookElements: [] },
    troubleshooting: [],
    formativeCheckpoint: {
      question: '¿Cómo verificas la solución de un sistema?',
      reflectionPrompts: ['¿Dónde ves sistemas en tu casa?'],
      criteriaChecklist: ['Plantea ecuaciones', 'Verifica resultado'],
    },
    wordCount: 700,
    ...overrides,
  } as MissionSection;
}

const mockWorkbook = {
  blockIndex: 0,
  blockName: 'Bloque 1: Modelación Lineal',
  coverData: {
    title: 'Cuaderno de Trabajo Activo',
    subtitle: 'Bachillerato General Estatal',
    subjectName: 'Pensamiento Matemático III',
    schoolName: 'Plantel de Prueba',
    semester: 2,
    blockNumber: 1,
    teacherName: 'Docente Titular',
    paecProjectName: 'Cooperativa de Prueba',
  },
  missions: [
    baseMission({ missionIndex: 1, coveredSessions: [1, 2, 3, 4] }),
    baseMission({ missionIndex: 2, coveredSessions: [5, 6], title: 'Proyecto de medición comunitaria' }),
  ],
} as unknown as ActiveWorkTextbook;

async function extractPdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const textResult = await parser.getText();
    return textResult.text;
  } finally {
    await parser.destroy();
  }
}

describe('Brecha 3: figuras por sesión en el libro del estudiante', () => {
  it('DOCX: cada sesión intermedia y la sección ≤3 imprimen su Figura S<n>', async () => {
    const resolveSpy = vi.spyOn(visualAssetManager, 'resolveVisualForMission').mockResolvedValue(null);
    const docxBuffer = await renderWorkbookToDocx(mockWorkbook, mockPlanning as unknown as Planning);
    resolveSpy.mockRestore();

    expect(docxBuffer).toBeInstanceOf(Buffer);
    const zip = await JSZip.loadAsync(docxBuffer);
    const docXml = (await zip.file('word/document.xml')?.async('text')) || '';
    expect(docXml.length).toBeGreaterThan(1000);

    // Misión 1 (4 sesiones): sesión intermedia 3 (slice(2, 3)) → Figura S3
    expect(docXml).toContain('Figura S3');
    // Misión 2 (2 sesiones → rama ≤3): usa coveredSessions[1] = 6 → Figura S6
    expect(docXml).toContain('Figura S6');
    // Las figuras de sesión NO confunden sus pies con el hero de misión
    expect(docXml).toContain('Figura S3 - ');
    expect(docXml).toContain('Figura S6 - ');
  }, 60000);

  it('PDF: las figuras por sesión aparecen en el texto extraído', async () => {
    const resolveSpy = vi.spyOn(visualAssetManager, 'resolveVisualForMission').mockResolvedValue(null);
    const pdfBuffer = await renderWorkbookToPdf(mockWorkbook, mockPlanning as unknown as Planning, {
      forceFallbackCover: true,
    });
    resolveSpy.mockRestore();

    expect(pdfBuffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    const pdfText = await extractPdfText(pdfBuffer);
    expect(pdfText).toContain('Figura S3');
    expect(pdfText).toContain('Figura S6');
  }, 60000);
});
