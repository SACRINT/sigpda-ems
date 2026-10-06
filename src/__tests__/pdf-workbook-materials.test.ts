// src/__tests__/pdf-workbook-materials.test.ts
import { describe, it, expect } from 'vitest';
import { renderWorkbookToPdf } from '@/lib/pdf-workbook-renderer';
import type { ActiveWorkTextbook } from '@/types/work-textbook';

describe('T-IMG-05: Renderizado de Figuras de Materiales en Libro PDF', () => {
  const mockWorkbook: Partial<ActiveWorkTextbook> = {
    blockIndex: 0,
    blockName: 'Bloque 1: Electricidad y Medición',
    coverData: {
      title: 'Cuaderno de Trabajo Activo',
      subtitle: 'Bachillerato General Estatal',
      subjectName: 'Física y Circuitos',
      schoolName: 'Plantel Ejemplo 01',
      semester: 1,
      blockNumber: 1,
      teacherName: 'Docente Titular',
      paecProjectName: 'Instalaciones Seguras',
    },
    missions: [
      {
        missionIndex: 1,
        title: 'Práctica Inicial de Laboratorio',
        coveredSessions: [1],
        sessionTopic: 'Magnitudes Eléctricas',
        sessionFocus: 'Uso del instrumental de medición',
        phenomenonHook: { story: 'Caso eléctrico', detonatingQuestion: '¿Cómo medir?' },
        conceptZero: { physicalAnalogy: 'Analogía', coreExplanation: 'Explicación' },
        iDoSection: { stepByStepDemo: 'Demo docente' },
        weDoSection: { guidedPractice: 'Práctica guiada', workbookElements: [] },
        youDoSection: { autonomousChallenge: 'Reto autónomo', workbookElements: [] },
        troubleshooting: [],
        formativeCheckpoint: {
          question: '¿Qué se midió?',
          reflectionPrompts: [],
          criteriaChecklist: [],
        },
        wordCount: 400,
      },
    ],
    projectSection: {
      artifactName: 'Tablero de Medición Eléctrica',
      communityUtility: 'Verificación de instalaciones en hogares comunitarios',
      learningObjectives: ['Aprender uso de multímetro y osciloscopio'],
      requiredMaterials: [
        '[[material:multimetro|Multímetro digital de alta precisión]]',
        '[[material:osciloscopio]]',
        'Cinta aislante (sin token)',
      ],
      executionSteps: ['Paso 1: Medición de voltaje'],
      technicalSpecs: ['Rango 0-250V'],
      acceptanceCriteria: ['Lectura correcta'],
    },
  };

  it('renderiza exitosamente a PDF un libro con tokens de materiales en projectSection', async () => {
    const pdfBuffer = await renderWorkbookToPdf(mockWorkbook as ActiveWorkTextbook);

    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(1000);
    // Cabecera estándar PDF
    expect(pdfBuffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });
});
