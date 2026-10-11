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

describe('F-70: Paridad Visual DOCX ≈ PDF - Widgets y Cajas de Colores', () => {
  it('renderiza cajas de colores para IDEA FUERZA, ESTUDIO ACTIVO y MISIÓN SÍNTESIS en DOCX', async () => {
    const mockWorkbook = {
      coverData: {
        title: 'Cuaderno de Trabajo Integral',
        subtitle: 'Bachillerato General',
        subjectName: 'Pensamiento Matemático II',
        schoolName: 'Plantel CCT-01',
        semester: 2,
        blockNumber: 1,
        teacherName: 'Profesor Titular',
      },
      missions: [
        {
          missionIndex: 1,
          title: 'Misión 1: Leyes de Modelado',
          coveredSessions: [1, 2],
          sessionTopic: 'Variables y modelos',
          sessionFocus: 'Ecuaciones y métodos',
          phenomenonHook: {
            story: 'Un contexto real en Puebla.',
            detonatingQuestion: '¿Cómo modelar el fenómeno?',
          },
          conceptZero: {
            physicalAnalogy: 'Como engranajes coordinados en un molino artesanal.',
            coreExplanation: 'Sistemas de relaciones matemáticas lineales.',
          },
          iDoSection: { stepByStepDemo: 'Demostración paso a paso del docente.' },
          weDoSection: {
            guidedPractice: '1. Tarea de práctica colaborativa.',
            workbookElements: [],
          },
          youDoSection: {
            autonomousChallenge: 'Reto autónomo para el alumno.',
            workbookElements: [],
          },
          troubleshooting: [],
          formativeCheckpoint: {
            question: '¿Qué aprendiste hoy?',
            reflectionPrompts: ['Explica tus pasos.'],
            criteriaChecklist: ['Criterio 1.'],
          },
          wordCount: 400,
        },
      ],
      projectSection: undefined,
      evaluationSection: undefined,
    } as unknown as ActiveWorkTextbook;

    const mockPlanning = {
      id: 'plan-test-f70',
      title: 'Pensamiento Matemático II',
      subject: 'Pensamiento Matemático II',
      subsystem: 'bge',
      semester: 'Segundo',
      targetGrade: 2,
      school: 'Plantel CCT-01',
      schoolId: 'cct-01',
      teacherId: 'prof-01',
      unitOrBlock: 'Bloque I',
    } as unknown as Planning;

    const docxBuffer = await renderWorkbookToDocx(mockWorkbook, mockPlanning, { coverBuffer: undefined });
    expect(docxBuffer).toBeDefined();

    const zip = await JSZip.loadAsync(docxBuffer);
    const docXml = (await zip.file('word/document.xml')?.async('text')) || '';

    // 1. Widget IDEA FUERZA
    expect(docXml).toContain('IDEA FUERZA: ANALOG\u00cdA F\u00cdSICA COTIDIANA');
    expect(docXml).toContain('engranajes coordinados en un molino artesanal');

    // 2. Widget ESTUDIO ACTIVO
    expect(docXml).toContain('ESTUDIO ACTIVO: CONSEJO METACOGNITIVO');

    // 3. Widget MISIÓN SÍNTESIS
    expect(docXml).toContain('MISI\u00d3N 1 \u00b7 S\u00cdNTESIS Y CONSOLIDACI\u00d3N');
  });
});
