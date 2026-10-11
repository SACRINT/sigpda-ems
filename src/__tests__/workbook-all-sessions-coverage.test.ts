import { describe, it, expect, vi } from 'vitest';
import { PDFParse } from 'pdf-parse';
import JSZip from 'jszip';
import { renderWorkbookToPdf } from '@/lib/pdf-workbook-renderer';
import { renderWorkbookToDocx } from '@/lib/docx-workbook-renderer';
import type { ActiveWorkTextbook } from '@/types/work-textbook';
import type { Planning, SecuenciaBloque } from '@/types/planning';

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('F-69: Cobertura Integral de Sesiones y Paridad de Divisores Editoriales', () => {
  const sequenceJson24: Record<number, SecuenciaBloque> = {
    0: {
      blockIndex: 0,
      blockName: 'Pensamiento Matemático II - Bloque I',
      hours: 24,
      sessions: Array.from({ length: 24 }, (_, i) => {
        const sNum = i + 1;
        const phase = sNum <= 3 ? 'Apertura' : sNum <= 21 ? 'Desarrollo' : 'Cierre';
        return {
          sessionNum: sNum,
          totalSessions: 24,
          phase: phase as 'Apertura' | 'Desarrollo' | 'Cierre',
          title: `Tema específico y desafíos matemáticos de la Sesión ${sNum}`,
          teachingActivity: `Mediación pedagógica del docente en la sesión ${sNum}`,
          learningActivity: `Resolución situada y trabajo colaborativo del estudiante en la sesión ${sNum}`,
          evidence: `Evidencia de desempeño ${sNum}`,
        };
      }),
    },
  };

  const mockPlanning24 = {
    id: 'plan-pm3-24',
    title: 'Pensamiento Matemático II',
    subject: 'Pensamiento Matemático II',
    subsystem: 'bge',
    semester: 'Segundo',
    targetGrade: 2,
    school: 'Bachillerato General Emiliano Zapata',
    schoolId: 'cct-pm3-01',
    teacherId: 'prof-pm3-01',
    unitOrBlock: 'Bloque I',
    sequenceJson: sequenceJson24,
  } as unknown as Planning;

  function buildSingleMission(mIdx: number, sessions: number[]) {
    return {
      missionIndex: mIdx,
      title: `Misión ${mIdx}: Ecosistema Matemático y Funciones`,
      coveredSessions: sessions,
      sessionTopic: 'Modelación algebraica',
      sessionFocus: 'Resolución de sistemas complejos',
      phenomenonHook: {
        story: 'Análisis de costos y distribución en la cooperativa comunitaria.',
        detonatingQuestion: '¿Cómo optimizar los recursos sin generar déficit?',
      },
      conceptZero: {
        physicalAnalogy: 'Como engranajes coordinados en un molino artesanal.',
        coreExplanation: 'Las relaciones lineales sincronizan tasas de cambio simultáneas.',
      },
      iDoSection: { stepByStepDemo: 'Demostración paso a paso del método algebraico.' },
      weDoSection: {
        guidedPractice: `
1. Tarea 1: Plantear la matriz de coeficientes.
2. Tarea 2: Calcular determinantes.
3. Tarea 3: Comprobar el vector solución.
4. Tarea 4: Contrastar con el balance contable.
        `.trim(),
        workbookElements: [],
      },
      youDoSection: {
        autonomousChallenge: 'Reto autónomo de balance presupuestal.',
        workbookElements: [],
      },
      troubleshooting: [],
      formativeCheckpoint: {
        question: '¿Por qué la solución debe satisfacer todas las restricciones?',
        reflectionPrompts: ['Analiza la consistencia.'],
        criteriaChecklist: ['Comprueba cada variable.'],
      },
      wordCount: 500,
    };
  }

  it('misión con 9 sesiones (4 a 12) produce los 9 divisores de sesión completos en PDF y DOCX', async () => {
    const nineSessions = [4, 5, 6, 7, 8, 9, 10, 11, 12];
    const workbookNine = {
      id: 'wb-pm3-9ses',
      planningId: 'plan-pm3-24',
      subsystem: 'bge',
      coverData: {
        title: 'Cuaderno PM2',
        subtitle: 'Bachillerato General',
        subjectName: 'Pensamiento Matemático II',
        schoolName: 'Bachillerato General Emiliano Zapata',
        semester: 2,
        blockNumber: 1,
        teacherName: 'Mtro. José Luis',
      },
      missions: [buildSingleMission(2, nineSessions)],
      projectSection: {
        artifactName: 'Proyecto',
        communityUtility: 'Comunidad',
        learningObjectives: ['Matemáticas'],
        requiredMaterials: [],
        phases: [],
      },
      evaluationSection: { rubric: [], checklist: [] },
    } as unknown as ActiveWorkTextbook;

    // 1. PDF
    const pdfBuffer = await renderWorkbookToPdf(workbookNine, mockPlanning24, { forceFallbackCover: true });
    expect(pdfBuffer).toBeDefined();

    const parser = new PDFParse({ data: new Uint8Array(pdfBuffer) });
    const parsed = await parser.getText();
    await parser.destroy();
    const pdfText = parsed.text;

    for (const s of nineSessions) {
      expect(pdfText).toContain(`SESION ${s}`);
    }

    // 2. DOCX
    const docxBuffer = await renderWorkbookToDocx(workbookNine, mockPlanning24, { coverBuffer: undefined });
    expect(docxBuffer).toBeDefined();

    const zip = await JSZip.loadAsync(docxBuffer);
    const docXml = (await zip.file('word/document.xml')?.async('text')) || '';

    for (const s of nineSessions) {
      expect(docXml).toContain(`SESIÓN ${s}`);
    }
  });

  it('libro completo de 24 sesiones (PM3) emite las 24 sesiones consecutivas sin saltos (1 a 24)', async () => {
    const workbookFull24 = {
      id: 'wb-pm3-full24',
      planningId: 'plan-pm3-24',
      subsystem: 'bge',
      coverData: {
        title: 'Cuaderno Integral PM2',
        subtitle: 'Bachillerato General',
        subjectName: 'Pensamiento Matemático II',
        schoolName: 'Bachillerato General Emiliano Zapata',
        semester: 2,
        blockNumber: 1,
        teacherName: 'Mtro. José Luis',
      },
      missions: [
        buildSingleMission(1, [1, 2, 3]),
        buildSingleMission(2, [4, 5, 6, 7, 8, 9, 10, 11, 12]),
        buildSingleMission(3, [13, 14, 15, 16, 17, 18, 19, 20, 21]),
        buildSingleMission(4, [22, 23, 24]),
      ],
      projectSection: {
        artifactName: 'Proyecto Comunitario',
        communityUtility: 'Comunidad',
        learningObjectives: ['Matemáticas'],
        requiredMaterials: [],
        phases: [],
      },
      evaluationSection: { rubric: [], checklist: [] },
    } as unknown as ActiveWorkTextbook;

    const pdfBuffer = await renderWorkbookToPdf(workbookFull24, mockPlanning24, { forceFallbackCover: true });
    expect(pdfBuffer).toBeDefined();

    const parser = new PDFParse({ data: new Uint8Array(pdfBuffer) });
    const parsed = await parser.getText();
    await parser.destroy();
    const pdfText = parsed.text;

    // Verificar las 24 sesiones sin saltos (incluyendo 7-12 y 16-21 que antes faltaban)
    for (let s = 1; s <= 24; s++) {
      expect(pdfText).toContain(`SESION ${s}`);
    }
  });
});
