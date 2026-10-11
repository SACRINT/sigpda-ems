import { describe, it, expect, vi } from 'vitest';
import { PDFParse } from 'pdf-parse';
import JSZip from 'jszip';
import { renderWorkbookToPdf } from '@/lib/pdf-workbook-renderer';
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

describe('F-74: Bitácora de Firmas y Asesoría con Cobertura para Todas las Sesiones', () => {
  it('renderiza filas de bitácora para todas las sesiones cubiertas en el libro (ej. 24 sesiones) en PDF y DOCX', async () => {
    const totalSessions = 24;
    const allSessions = Array.from({ length: totalSessions }, (_, i) => i + 1);

    function buildTestMission(mIdx: number, sessions: number[]) {
      return {
        missionIndex: mIdx,
        title: `Misión ${mIdx}: Ecosistema y Modelado`,
        coveredSessions: sessions,
        sessionTopic: 'Variables y modelos',
        sessionFocus: 'Ecuaciones y métodos',
        phenomenonHook: {
          story: 'Contexto de aplicación en comunidad.',
          detonatingQuestion: '¿Cómo medimos la eficiencia?',
        },
        conceptZero: {
          physicalAnalogy: 'Engranajes coordinados.',
          coreExplanation: 'Sistemas de relaciones matemáticas.',
        },
        iDoSection: { stepByStepDemo: 'Demostración guiada.' },
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
      };
    }

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
        buildTestMission(1, allSessions.slice(0, 8)),
        buildTestMission(2, allSessions.slice(8, 16)),
        buildTestMission(3, allSessions.slice(16, 24)),
      ],
      projectSection: {
        artifactName: 'Prototipo de Medición Solar',
        communityUtility: 'Medición de radiación para la comunidad',
        learningObjectives: ['Aprender modelación'],
        requiredMaterials: [],
        executionSteps: [],
        phases: [],
        registrationFormat: 'Formato estándar de campo con registro de fechas y firmas',
      },
      evaluationSection: { rubric: [], checklist: [] },
    } as unknown as ActiveWorkTextbook;

    const mockPlanning = {
      id: 'plan-test-24',
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

    // 1. Verificación PDF
    const pdfBuffer = await renderWorkbookToPdf(mockWorkbook, mockPlanning, { forceFallbackCover: true });
    expect(pdfBuffer).toBeDefined();

    const parser = new PDFParse({ data: new Uint8Array(pdfBuffer) });
    const parsed = await parser.getText();
    await parser.destroy();
    const pdfText = parsed.text;

    // Todas las 24 sesiones deben figurar en la bitácora
    for (let s = 1; s <= 24; s++) {
      expect(pdfText).toContain(`Sesión ${s}: ___/___/2026`);
    }

    // 2. Verificación DOCX
    const docxBuffer = await renderWorkbookToDocx(mockWorkbook, mockPlanning, { coverBuffer: undefined });
    expect(docxBuffer).toBeDefined();

    const zip = await JSZip.loadAsync(docxBuffer);
    const docXml = (await zip.file('word/document.xml')?.async('text')) || '';

    for (let s = 1; s <= 24; s++) {
      expect(docXml).toContain(`Sesión ${s}: ___/___/2026`);
    }
  });
});
