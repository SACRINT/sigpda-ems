import { describe, it, expect, vi } from 'vitest';
import jsPDF from 'jspdf';
import { drawDarkIdeCodeBlock } from '@/lib/visual-engine/pdf-components-core';
import * as pdfComponents from '@/lib/visual-engine/pdf-components';
import { renderWorkbookToPdf } from '@/lib/pdf-workbook-renderer';
import { renderWorkbookToDocx } from '@/lib/docx-workbook-renderer';
import { CODE_IDE } from '@/lib/visual-engine/design-tokens';
import type { ActiveWorkTextbook } from '@/types/work-textbook';
import type { Planning } from '@/types/planning';

describe('Widget Dark IDE — Renderizado y Prueba de Mutación Anti-F11', () => {
  it('renderiza código real con fondo oscuro #1E1E1E, gutter y tokens coloreados', () => {
    const doc = new jsPDF({ unit: 'mm', format: 'letter' });
    const fillSpy = vi.spyOn(doc, 'setFillColor');
    const textSpy = vi.spyOn(doc, 'text');

    const ensureVerticalSpaceMock = vi.fn().mockImplementation((_d, y) => y);

    const nextY = drawDarkIdeCodeBlock(doc, {
      code: 'import pandas as pd\nprint("Hola Mundo")',
      language: 'python',
      title: 'prueba_limpieza.py',
      margin: 14,
      drawWidth: 180,
      y: 20,
      pageHeight: 279,
      ensureVerticalSpace: ensureVerticalSpaceMock,
    });

    expect(nextY).toBeGreaterThan(20);
    // Debe usar el fondo oscuro para código real
    expect(fillSpy).toHaveBeenCalledWith(...CODE_IDE.editorBg);
    // Debe usar el fondo de gutter
    expect(fillSpy).toHaveBeenCalledWith(...CODE_IDE.gutterBg);
    // Debe escribir texto
    expect(textSpy).toHaveBeenCalled();
  });

  it('renderiza caja vacía con chasis técnico y fondo papel claro print-friendly (#F8FAFC)', () => {
    const doc = new jsPDF({ unit: 'mm', format: 'letter' });
    const fillSpy = vi.spyOn(doc, 'setFillColor');

    const ensureVerticalSpaceMock = vi.fn().mockImplementation((_d, y) => y);

    const nextY = drawDarkIdeCodeBlock(doc, {
      code: '',
      language: 'python',
      title: 'Ejercicio Práctico',
      margin: 14,
      drawWidth: 180,
      y: 20,
      pageHeight: 279,
      ensureVerticalSpace: ensureVerticalSpaceMock,
    });

    expect(nextY).toBeGreaterThan(20);
    // Interior de la caja vacía debe ser papel claro print-friendly
    expect(fillSpy).toHaveBeenCalledWith(...CODE_IDE.editorEmptyBg);
    // Y el gutter es el chasis oscuro
    expect(fillSpy).toHaveBeenCalledWith(...CODE_IDE.gutterBg);
  });

  it('PRUEBA DE MUTACIÓN ANTI-F11: renderWorkbookToPdf DEBE invocar drawDarkIdeCodeBlock para elementos code_box', async () => {
    const mockPlanning = {
      id: 'plan-dark-ide-1',
      title: 'Módulo de Machine Learning',
      subject: 'Programación',
      subsystem: 'bt',
      semester: 'Tercero',
      targetGrade: 3,
      school: 'CECyTE Venustiano Carranza',
      schoolId: 'cct-01',
      paecName: 'Automatización y Machine Learning',
      teacherId: 'prof-01',
      progressionSummary: 'Preprocesamiento de datos',
      unitOrBlock: 'Bloque II',
      problematicContext: 'Limpieza de datos tabulares',
      transversalTheme: 'Ciencia de Datos',
    } as unknown as Planning;

    const mockWorkbook = {
      id: 'wb-dark-ide-1',
      planningId: 'plan-dark-ide-1',
      coverData: {
        title: 'Cuaderno de Trabajo Activo',
        subtitle: 'Bachillerato Tecnológico',
        subjectName: 'Programación',
        schoolName: 'CECyTE Venustiano Carranza',
        semester: 3,
        blockNumber: 2,
        teacherName: 'Docente Titular',
        paecProjectName: 'Proyecto Machine Learning',
      },
      missions: [
        {
          missionIndex: 1,
          title: 'Práctica 4: Limpieza de Datos con Pandas',
          coveredSessions: [1, 2],
          sessionTopic: 'Pandas',
          sessionFocus: 'Preprocesamiento',
          phenomenonHook: {
            story: 'Problema de valores ausentes',
            detonatingQuestion: '¿Cómo imputar valores nulos?',
          },
          conceptZero: {
            physicalAnalogy: 'Filtro de impurezas',
            coreExplanation: 'Pandas ofrece fillna y dropna para depuración.',
          },
          iDoSection: {
            stepByStepDemo: 'Demostración de código',
          },
          weDoSection: {
            guidedPractice: 'Práctica guiada en equipo',
            workbookElements: [
              {
                id: 'code-element-1',
                type: 'code_box',
                title: 'script_limpieza.py',
                config: {
                  initialCode: 'import pandas as pd\ndf = pd.DataFrame({"edad": [16, 17, None]})\nprint(df.fillna(df.median()))',
                },
              },
            ],
          },
          youDoSection: {
            autonomousChallenge: 'Reto autónomo',
            workbookElements: [],
          },
          troubleshooting: [],
          formativeCheckpoint: {
            question: '¿Por qué imputar con mediana?',
            reflectionPrompts: ['Analiza la distribución'],
            criteriaChecklist: ['Código funcional'],
          },
          wordCount: 500,
        },
      ],
      projectSection: {
        artifactName: 'Dataset Limpio',
        communityUtility: 'Limpieza de datos comunitarios',
        learningObjectives: ['Aprender preprocesamiento'],
        requiredMaterials: [],
        phases: [],
      },
      evaluationSection: {
        rubric: [],
        checklist: [],
      },
    } as unknown as ActiveWorkTextbook;

    const ideSpy = vi.spyOn(pdfComponents, 'drawDarkIdeCodeBlock');

    // 1. PDF
    const pdfBuffer = await renderWorkbookToPdf(
      mockWorkbook,
      mockPlanning,
      { forceFallbackCover: true }
    );

    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');

    // Comprobación de mutación obligatoria:
    // Si se elimina la llamada a drawDarkIdeCodeBlock en pdf-workbook-renderer.ts, esta aserción FALLA:
    expect(ideSpy).toHaveBeenCalledTimes(1);
    expect(ideSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        code: expect.stringContaining('import pandas as pd'),
        title: 'script_limpieza.py',
        language: 'python',
      })
    );

    // 2. DOCX Paridad
    const docxBuffer = await renderWorkbookToDocx(
      mockWorkbook as ActiveWorkTextbook,
      mockPlanning as unknown as Planning
    );
    expect(docxBuffer).toBeInstanceOf(Buffer);
  });
});
