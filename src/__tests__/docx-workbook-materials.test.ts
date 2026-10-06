// src/__tests__/docx-workbook-materials.test.ts
import { describe, it, expect } from 'vitest';
import { renderWorkbookToDocx } from '@/lib/docx-workbook-renderer';
import type { ActiveWorkTextbook } from '@/types/work-textbook';

describe('T-IMG-06: Renderizado de Figuras de Materiales en Libro DOCX', () => {
  const mockWorkbook: Partial<ActiveWorkTextbook> = {
    blockIndex: 0,
    blockName: 'Bloque 1: Instrumentación',
    coverData: {
      title: 'Cuaderno de Trabajo Activo',
      subtitle: 'Bachillerato General Estatal',
      subjectName: 'Electrónica y Mediciones',
      schoolName: 'Plantel Experimental',
      semester: 1,
      blockNumber: 1,
      teacherName: 'Prof. Titular',
      paecProjectName: 'Proyecto Comunitario de Mantenimiento',
    },
    missions: [
      {
        missionIndex: 1,
        title: 'Misión de Laboratorio 1',
        coveredSessions: [1],
        sessionTopic: 'Medición Básica',
        sessionFocus: 'Identificación de equipo',
        phenomenonHook: { story: 'Caso', detonatingQuestion: '¿Cómo funciona?' },
        conceptZero: { physicalAnalogy: 'Analogía', coreExplanation: 'Explicación' },
        iDoSection: { stepByStepDemo: 'Demo' },
        weDoSection: { guidedPractice: 'Práctica', workbookElements: [] },
        youDoSection: { autonomousChallenge: 'Reto', workbookElements: [] },
        troubleshooting: [],
        formativeCheckpoint: {
          question: '¿Qué mide?',
          reflectionPrompts: [],
          criteriaChecklist: [],
        },
        wordCount: 400,
      },
    ],
    projectSection: {
      artifactName: 'Prototipo de Mediciones',
      communityUtility: 'Soporte a la comunidad escolar',
      learningObjectives: ['Dominio del multímetro y osciloscopio'],
      requiredMaterials: [
        '[[material:multimetro|Multímetro digital calibrado]]',
        '[[material:osciloscopio]]',
        'Guantes de protección',
      ],
      executionSteps: ['Paso 1: Medición'],
      technicalSpecs: ['Norma NOM-001'],
      acceptanceCriteria: ['Precisión certificada'],
    },
  };

  it('renderiza exitosamente a DOCX un libro con tokens de materiales incrustando ImageRun', async () => {
    const docxBuffer = await renderWorkbookToDocx(mockWorkbook as ActiveWorkTextbook);

    expect(docxBuffer).toBeInstanceOf(Buffer);
    expect(docxBuffer.length).toBeGreaterThan(2000);
    // Verificación de cabecera ZIP de archivo .docx (PK\x03\x04)
    expect(docxBuffer[0]).toBe(0x50);
    expect(docxBuffer[1]).toBe(0x4b);
    expect(docxBuffer[2]).toBe(0x03);
    expect(docxBuffer[3]).toBe(0x04);
  }, 30000);
});
