/**
 * Fase D — Cableado de sessionPlans en TODAS las secciones de sesión de los
 * libros de bloque (PDF y DOCX).
 *
 * Antes de Fase D, el flujo completo del estudiante (objetivo, motivación,
 * saberes, teoría, ejemplo, práctica con enunciados, aplicación, producto,
 * autoevaluación, recursos) solo se imprimía en las sesiones INTERMEDIAS de
 * misiones de >= 4 sesiones (midSessions). Las sesiones primera, segunda y
 * última de CADA misión (incluidas las misiones de 3 sesiones: 1-3 y 22-24)
 * quedaban sin su sessionPlan → desalineación libro ↔ solucionario.
 *
 * Cada plan lleva un marker único `MarkerSnn` en objetivo, práctica y
 * autoevaluación. Si renderStudentPlanFlow deja de invocarse en los call
 * sites s1 / s2 (>=3 y ===2) / última, estos tests FALLAN.
 */
import { describe, it, expect, vi } from 'vitest';
import { PDFParse } from 'pdf-parse';
import JSZip from 'jszip';
import { renderWorkbookToPdf } from '@/lib/pdf-workbook-renderer';
import { renderWorkbookToDocx } from '@/lib/docx-workbook-renderer';
import type { ActiveWorkTextbook, SessionPlan } from '@/types/work-textbook';
import type { Planning, SecuenciaBloque } from '@/types/planning';

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { logger } from '@/lib/logger';

const marker = (n: number) => `MarkerS${String(n).padStart(2, '0')}`;
const taskMarker = (n: number) => `EjercicioUnico${String(n).padStart(2, '0')}`;
const pistaMarker = (n: number) => `PistaUnico${String(n).padStart(2, '0')}`;

function makePlan(n: number): SessionPlan {
  return {
    sessionNumber: n,
    // Único campo con el marker de sesión → permite asertar "exactamente una vez".
    objetivo: `Objetivo ${marker(n)} de la sesion.`,
    motivacion: 'Motivacion con caso real de la comunidad.',
    saberesPrevios: 'Saberes previos que ya traes a esta sesion.',
    contenido: 'Contenido teorico con definiciones y formulas.',
    ejemploResuelto: 'Ejemplo resuelto paso a paso con numeros concretos.',
    practica: [{ enunciado: `${taskMarker(n)} con datos.`, pista: `${pistaMarker(n)}.` }],
    aplicacion: 'Aplicacion en tu vida diaria.',
    autoevaluacion: ['Autoevaluacion final de la sesion.'],
    recursos: [{ titulo: 'Recurso de ampliacion', url: 'https://example.com/video', tipo: 'video' }],
    productoIntegrador: 'Producto integrador del dia.',
  };
}

const sequenceJson24: Record<number, SecuenciaBloque> = {
  0: {
    blockIndex: 0,
    blockName: 'Pensamiento Matemático III - Bloque I',
    hours: 24,
    sessions: Array.from({ length: 24 }, (_, i) => {
      const sNum = i + 1;
      const phase = sNum <= 3 ? 'Apertura' : sNum <= 21 ? 'Desarrollo' : 'Cierre';
      return {
        sessionNum: sNum,
        totalSessions: 24,
        phase: phase as 'Apertura' | 'Desarrollo' | 'Cierre',
        title: `Tema de la Sesión ${sNum}`,
        teachingActivity: `Mediación ${sNum}`,
        learningActivity: `Práctica ${sNum}`,
        evidence: `Evidencia ${sNum}`,
      };
    }),
  },
};

const mockPlanning = {
  id: 'plan-pm3-wiring',
  title: 'Pensamiento Matemático III',
  subject: 'Pensamiento Matemático III',
  subsystem: 'bge',
  semester: 'Tercero',
  targetGrade: 3,
  school: 'Escuela Secundaria General',
  schoolId: 'cct-pm3-w1',
  teacherId: 'prof-pm3-w1',
  unitOrBlock: 'Bloque I',
  sequenceJson: sequenceJson24,
} as unknown as Planning;

function buildMission(mIdx: number, sessions: number[], withPlans: boolean) {
  return {
    missionIndex: mIdx,
    title: `Misión ${mIdx}: Tema Integrador`,
    coveredSessions: sessions,
    sessionTopic: 'Modelación matemática',
    sessionFocus: 'Resolución de problemas',
    phenomenonHook: {
      story: 'Historia situada de la comunidad.',
      detonatingQuestion: '¿Cómo se modela este fenómeno?',
    },
    conceptZero: {
      physicalAnalogy: 'Analogía cotidiana del concepto.',
      coreExplanation: 'Explicación conceptual central de la misión.',
      narrativeExplanation: 'Narración del concepto para los estudiantes.',
    },
    iDoSection: { stepByStepDemo: 'Demostración paso a paso del procedimiento.' },
    weDoSection: {
      guidedPractice: `
1. Tarea 1: plantear la ecuación.
2. Tarea 2: sustituir los datos.
3. Tarea 3: verificar el resultado.
      `.trim(),
      workbookElements: [],
    },
    youDoSection: {
      autonomousChallenge: 'Reto autónomo con evidencia cotidiana.',
      workbookElements: [],
    },
    troubleshooting: [],
    formativeCheckpoint: {
      question: '¿Por qué funciona este método?',
      reflectionPrompts: ['Reflexiona sobre el procedimiento.'],
      criteriaChecklist: ['Revisa cada paso del cálculo.'],
    },
    realLifeConnection: { householdApplication: 'Aplicación doméstica del tema.' },
    wordCount: 600,
    sessionPlans: withPlans
      ? Array.from({ length: sessions.length }, (_, i) => makePlan(sessions[i]))
      : undefined,
  };
}

function buildWorkbook(withPlans: boolean, sessionsPerMission: number[][]) {
  return {
    id: 'wb-wiring',
    planningId: 'plan-pm3-wiring',
    subsystem: 'bge',
    coverData: {
      title: 'Cuaderno PM3',
      subtitle: 'Bachillerato',
      subjectName: 'Pensamiento Matemático III',
      schoolName: 'Escuela Secundaria General',
      semester: 3,
      blockNumber: 1,
      teacherName: 'Mtro. Ejemplo',
    },
    missions: sessionsPerMission.map((sessions, i) => buildMission(i + 1, sessions, withPlans)),
    projectSection: {
      artifactName: 'Proyecto',
      communityUtility: 'Comunidad',
      learningObjectives: ['Matemáticas'],
      requiredMaterials: [],
      phases: [],
    },
    evaluationSection: { rubric: [], checklist: [] },
  } as unknown as ActiveWorkTextbook;
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const parsed = await parser.getText();
  await parser.destroy();
  return parsed.text;
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  return (await zip.file('word/document.xml')?.async('text')) || '';
}

describe('Fase D — Cableado de sessionPlans en s1/s2/intermedias/última (PDF y DOCX)', () => {
  it('PDF: los 24 sessionPlans aparecen en TODAS las sesiones (s1, s2, intermedias y última)', async () => {
    const workbook = buildWorkbook(true, [
      [1, 2, 3],
      [4, 5, 6, 7, 8, 9, 10, 11, 12],
      [13, 14, 15, 16, 17, 18, 19, 20, 21],
      [22, 23, 24],
    ]);

    const pdfBuffer = await renderWorkbookToPdf(workbook, mockPlanning, { forceFallbackCover: true });
    expect(pdfBuffer).toBeDefined();
    const pdfText = await extractPdfText(pdfBuffer);

    // Cobertura completa: cada marker debe existir exactamente una vez.
    for (let s = 1; s <= 24; s++) {
      const m = marker(s);
      expect(pdfText, `marker de la sesión ${s} ausente en PDF`).toContain(m);
      expect(
        pdfText.split(m).length - 1,
        `marker de la sesión ${s} impreso más de una vez en PDF (duplicado)`
      ).toBe(1);
    }

    // Los ejercicios con pista también se imprimen (paridad con solucionario).
    for (let s = 1; s <= 24; s++) {
      const t = taskMarker(s);
      expect(pdfText, `ejercicio de la sesión ${s} ausente en PDF`).toContain(`${t} con datos.`);
      expect(pdfText.split(t).length - 1, `ejercicio de la sesión ${s} duplicado en PDF`).toBe(1);
    }
    expect(pdfText).toContain(`${pistaMarker(1)}.`);
    expect(pdfText).toContain(`${pistaMarker(24)}.`);
  }, 120000);

  it('DOCX: los 24 sessionPlans aparecen en TODAS las sesiones (s1, s2, intermedias y última)', async () => {
    const workbook = buildWorkbook(true, [
      [1, 2, 3],
      [4, 5, 6, 7, 8, 9, 10, 11, 12],
      [13, 14, 15, 16, 17, 18, 19, 20, 21],
      [22, 23, 24],
    ]);

    const docxBuffer = await renderWorkbookToDocx(workbook, mockPlanning, { coverBuffer: undefined });
    expect(docxBuffer).toBeDefined();
    const docxText = await extractDocxText(docxBuffer);

    for (let s = 1; s <= 24; s++) {
      const m = marker(s);
      expect(docxText, `marker de la sesión ${s} ausente en DOCX`).toContain(m);
      expect(
        docxText.split(m).length - 1,
        `marker de la sesión ${s} impreso más de una vez en DOCX (duplicado)`
      ).toBe(1);
    }

    for (let s = 1; s <= 24; s++) {
      expect(docxText, `ejercicio de la sesión ${s} ausente en DOCX`).toContain(`${taskMarker(s)} con datos.`);
    }
    expect(docxText).toContain(`${pistaMarker(1)}.`);
    expect(docxText).toContain(`${pistaMarker(24)}.`);
  }, 120000);

  it('misión de 2 sesiones: s1 y s2 (rama ===2) imprimen su sessionPlan en PDF', async () => {
    const workbook = buildWorkbook(true, [[1, 2]]);

    const pdfBuffer = await renderWorkbookToPdf(workbook, mockPlanning, { forceFallbackCover: true });
    const pdfText = await extractPdfText(pdfBuffer);

    expect(pdfText).toContain('MarkerS01');
    expect(pdfText).toContain('MarkerS02');
    expect(pdfText.split('MarkerS01').length - 1).toBe(1);
    expect(pdfText.split('MarkerS02').length - 1).toBe(1);
  }, 120000);

  it('sin sessionPlans: no se imprime ningún marker y se emiten warns con la sección afectada', async () => {
    vi.mocked(logger.warn).mockClear();
    const workbook = buildWorkbook(false, [[1, 2]]);

    const pdfBuffer = await renderWorkbookToPdf(workbook, mockPlanning, { forceFallbackCover: true });
    const pdfText = await extractPdfText(pdfBuffer);

    expect(pdfText).not.toContain('MarkerS01');
    expect(pdfText).not.toContain('MarkerS02');

    const fallbackWarns = vi
      .mocked(logger.warn)
      .mock.calls.filter(
        (c) => typeof c[0] === 'string' && c[0].includes('Fallback determinista de sesión')
      );
    const sections = fallbackWarns.map((c) => (c[1] as { section?: string } | undefined)?.section);
    expect(sections).toContain('apertura');
    expect(sections).toContain('practica-guiada');
  }, 120000);
});
