import { describe, it, expect, vi } from 'vitest';
import { renderWorkbookToPdf } from '@/lib/pdf-workbook-renderer';
import { renderWorkbookToDocx } from '@/lib/docx-workbook-renderer';
import * as materialFigureDoc from '@/lib/materials/material-figure-doc';
import * as visualDispatcher from '@/lib/visual-engine/visual-dispatcher';
import * as svgToPngModule from '@/lib/visual-engine/svg-to-png';
import * as visualAssetManager from '@/lib/visual-engine/visual-asset-manager';
import type { ActiveWorkTextbook } from '@/types/work-textbook';
import type { Planning } from '@/types/planning';
import { createRequire } from 'module';
import path from 'path';

const require_ = createRequire(path.join(process.cwd(), 'package.json'));
const JSZip = require_('jszip');

describe('visual-material-png-render — Renderizado de figura de misión con material_png en PDF y DOCX', () => {
  const mockWorkbook: Partial<ActiveWorkTextbook> = {
    blockIndex: 0,
    blockName: 'Bloque 1: Mediciones Eléctricas',
    coverData: {
      title: 'Cuaderno de Trabajo Activo',
      subtitle: 'Bachillerato General Estatal',
      subjectName: 'Taller de Instrumentación',
      schoolName: 'Plantel Puebla 01',
      semester: 1,
      blockNumber: 1,
      teacherName: 'Docente Titular',
      paecProjectName: 'Proyecto de Electricidad',
    },
    missions: [
      {
        missionIndex: 1,
        title: 'Misión 1: Práctica con Multímetro Digital',
        coveredSessions: [1],
        sessionTopic: 'Magnitudes Eléctricas',
        sessionFocus: 'Uso y calibración del multímetro digital en banco',
        phenomenonHook: { story: 'Medición de tensión', detonatingQuestion: '¿Cómo calibrar?' },
        conceptZero: {
          physicalAnalogy: 'El flujo de agua en tuberías',
          coreExplanation: 'En esta misión utilizaremos un multímetro digital autorango para medir diferencias de potencial.',
        },
        iDoSection: { stepByStepDemo: 'Demostración de conexión en serie y paralelo' },
        weDoSection: { guidedPractice: 'Práctica guiada en equipos', workbookElements: [] },
        youDoSection: { autonomousChallenge: 'Reto de medición de resistencia', workbookElements: [] },
        troubleshooting: [],
        formativeCheckpoint: {
          question: '¿Qué magnitud fue registrada?',
          reflectionPrompts: [],
          criteriaChecklist: [],
        },
        wordCount: 400,
      },
    ],
    projectSection: {
      artifactName: 'Medidor de Carga',
      communityUtility: 'Verificación comunitaria',
      learningObjectives: ['Aprender medición eléctrica'],
      requiredMaterials: [
        '[[material:multimetro|Multímetro digital autorango]]',
      ],
      executionSteps: ['Paso 1: Medición'],
      technicalSpecs: ['NOM-001'],
      acceptanceCriteria: ['Lectura correcta'],
      phases: [
        {
          phaseNum: 1,
          title: 'Fase 1',
          allocatedHours: 2,
          deliverables: ['Reporte'],
          instructions: 'Instrucciones',
        },
      ],
    },
  };

  const mockPlanning = {
    id: 'plan-visual-png-test',
    uacName: 'Taller de Instrumentación',
    contentJson: { sectionI: {}, sectionII: {} },
  };

  it('PDF renderiza la misión con material_png correctamente', async () => {
    const pdfBuffer = await renderWorkbookToPdf(
      mockWorkbook as ActiveWorkTextbook,
      mockPlanning as unknown as Planning,
      { forceFallbackCover: true }
    );

    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    const pdfString = pdfBuffer.toString('latin1');
    const imageCount = (pdfString.match(/\/Subtype\s*\/Image/g) || []).length;
    expect(imageCount).toBeGreaterThanOrEqual(1);
  }, 30000);

  it('DOCX renderiza la misión con material_png en word/media/', async () => {
    const docxBuffer = await renderWorkbookToDocx(
      mockWorkbook as ActiveWorkTextbook,
      mockPlanning as unknown as Planning
    );

    expect(docxBuffer).toBeInstanceOf(Buffer);
    const zip = await JSZip.loadAsync(Buffer.from(docxBuffer));
    const mediaFiles = Object.keys(zip.files).filter((f) => f.startsWith('word/media/'));
    expect(mediaFiles.length).toBeGreaterThanOrEqual(1);
  }, 30000);

  it('T-03: no fabrica fallback vacío sin datos y renderiza Capa 0 vectorial en PDF y DOCX cuando hay modelo real y readMaterialPng devuelve null', async () => {
    const visualSpy = vi.spyOn(visualAssetManager, 'resolveVisualForMission').mockResolvedValue({
      type: 'material_png',
      caption: 'Multímetro Digital',
      materialSlug: 'multimetro',
      materialAltText: 'Multímetro digital autorango',
      materialPngPath: '/images/materials/multimetro.png',
    });
    const pngSpy = vi.spyOn(materialFigureDoc, 'readMaterialPng').mockReturnValue(null);
    const dispatchSpy = vi.spyOn(visualDispatcher, 'dispatchVisual');
    const svgSpy = vi.spyOn(svgToPngModule, 'svgToPngBuffer');
    try {
      // 1. Sin modelo cuantitativo ni datos técnicos reales, no debe inventar figuras sintéticas
      const emptyPdf = await renderWorkbookToPdf(
        mockWorkbook as ActiveWorkTextbook,
        mockPlanning as unknown as Planning,
        { forceFallbackCover: true }
      );
      expect(emptyPdf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
      expect(dispatchSpy).toHaveBeenCalled();
      expect(svgSpy).not.toHaveBeenCalled();

      // 2. Con ecuación real en el contenido, PDF y DOCX deben invocar svgToPngBuffer al fallar readMaterialPng
      dispatchSpy.mockClear();
      svgSpy.mockClear();
      const stemWb: Partial<ActiveWorkTextbook> = {
        ...mockWorkbook,
        coverData: {
          ...mockWorkbook.coverData!,
          subjectName: 'Física y Circuitos',
        },
        missions: [
          {
            ...mockWorkbook.missions![0]!,
            sessionTopic: 'Modelación cuadrática de potencia',
            iDoSection: {
              stepByStepDemo: 'Analiza la función f(x) = x² + 2x - 3 para estimar máximos en el circuito.',
            },
          },
        ],
      };
      const stemPlanning = { ...mockPlanning, uacName: 'Física y Circuitos' };

      const pdfBuffer = await renderWorkbookToPdf(
        stemWb as ActiveWorkTextbook,
        stemPlanning as unknown as Planning,
        { forceFallbackCover: true }
      );
      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
      expect(svgSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
      const pdfCalls = svgSpy.mock.calls.length;

      const docxBuffer = await renderWorkbookToDocx(
        stemWb as ActiveWorkTextbook,
        stemPlanning as unknown as Planning
      );
      expect(docxBuffer).toBeInstanceOf(Buffer);
      expect(svgSpy.mock.calls.length).toBeGreaterThan(pdfCalls);

      const zip = await JSZip.loadAsync(Buffer.from(docxBuffer));
      const mediaFiles = Object.keys(zip.files).filter((f) => f.startsWith('word/media/'));
      expect(mediaFiles.length).toBeGreaterThanOrEqual(1);
    } finally {
      visualSpy.mockRestore();
      pngSpy.mockRestore();
      dispatchSpy.mockRestore();
      svgSpy.mockRestore();
    }
  }, 30000);
});
