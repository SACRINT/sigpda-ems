import { describe, it, expect, vi } from 'vitest';
import JSZip from 'jszip';
import { renderWorkbookToDocx } from '@/lib/docx-workbook-renderer';
import type { ActiveWorkTextbook } from '@/types/work-textbook';
import type { Planning } from '@/types/planning';

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('F-67: DOCX Alineación Justificada en Cuerpo y Tablas', () => {
  const mockPlanning = {
    id: 'plan-docx-align-1',
    title: 'Pensamiento Matemático',
    subject: 'Pensamiento Matemático II',
    subsystem: 'bge',
    semester: 'Segundo',
    targetGrade: 2,
    school: 'Bachillerato General Emiliano Zapata',
    schoolId: 'cct-01',
    teacherId: 'prof-01',
    unitOrBlock: 'Bloque I',
  } as unknown as Planning;

  const mockWorkbook = {
    id: 'wb-docx-align-1',
    planningId: 'plan-docx-align-1',
    subsystem: 'bge',
    coverData: {
      title: 'Cuaderno de Trabajo Activo',
      subtitle: 'Bachillerato General',
      subjectName: 'Pensamiento Matemático II',
      schoolName: 'Bachillerato General Emiliano Zapata',
      semester: 2,
      blockNumber: 1,
      teacherName: 'Mtro. José Luis García',
    },
    missions: [
      {
        missionIndex: 1,
        title: 'Misión 1: Modelos Lineales',
        coveredSessions: [1, 2],
        sessionTopic: 'Ecuaciones y Sistemas',
        sessionFocus: 'Modelación de costos y balance',
        phenomenonHook: {
          story: 'En el taller de carpintería escolar se requiere balancear la producción de mesas y sillas.',
          detonatingQuestion: '¿Cómo encontrar el equilibrio sin exceder el presupuesto?',
        },
        conceptZero: {
          physicalAnalogy: 'Como dos caminos que convergen en un cruce.',
          coreExplanation: 'El sistema modela restricciones de costo y tiempo simultáneas.',
        },
        iDoSection: { stepByStepDemo: 'Demostración de resolución por sustitución.' },
        weDoSection: { guidedPractice: 'Práctica guiada en equipos.', workbookElements: [] },
        youDoSection: { autonomousChallenge: 'Reto autónomo de balance.', workbookElements: [] },
        troubleshooting: [],
        formativeCheckpoint: {
          question: '¿Por qué debe justificarse el planteamiento?',
          reflectionPrompts: ['Analiza la ecuación.'],
          criteriaChecklist: ['Comprueba la solución.'],
        },
        wordCount: 400,
      },
    ],
    projectSection: {
      artifactName: 'Proyecto de Mobiliario',
      communityUtility: 'Aulas escolares',
      learningObjectives: ['Modelación lineal'],
      requiredMaterials: [],
      phases: [],
    },
    evaluationSection: {
      rubric: [],
      checklist: [],
    },
  } as unknown as ActiveWorkTextbook;

  it('produce alineación justificada (w:jc w:val="both") en estilos de documento y celdas', async () => {
    const docxBuffer = await renderWorkbookToDocx(mockWorkbook, mockPlanning, { coverBuffer: undefined });
    expect(docxBuffer).toBeDefined();
    expect(docxBuffer.byteLength).toBeGreaterThan(5000);

    const zip = await JSZip.loadAsync(docxBuffer);
    const documentXml = await zip.file('word/document.xml')?.async('text');
    const stylesXml = await zip.file('word/styles.xml')?.async('text');

    expect(stylesXml).toBeDefined();
    expect(documentXml).toBeDefined();

    // Verificación de OpenXML: alignment justified se representa canónicamente como w:jc w:val="both"
    const hasJustifiedInStyles = stylesXml?.includes('w:jc w:val="both"');
    const hasJustifiedInDoc = documentXml?.includes('w:jc w:val="both"');

    expect(hasJustifiedInStyles || hasJustifiedInDoc).toBe(true);
  });
});
