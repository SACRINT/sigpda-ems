/**
 * content-budget-orchestrator.test.ts
 * SIGPDA-EMS · SEMS Puebla MCCEMS 2026-2027
 *
 * Suite de pruebas unitarias e integración de la Fase P3:
 * - Calibración editorial por sesiones de aprendizaje
 * - Conexión de horas reales semanales con presupuesto de páginas y palabras
 * - Validación de cobertura de sesiones y reporte en ActiveWorkTextbook
 * - Contabilidad completa de palabras incluyendo sessionPlans estudiantiles
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateBlockWorkTextbook } from '@/lib/guide-engine/block-guide-orchestrator';
import {
  getPlanningById,
  getTeacherById,
  getPlanningExtras,
  findCanonicalSeed,
  saveCanonicalSeed,
  saveBlockWorkbook,
  updateWorkbookProgress,
  updateGenerationJobProgress,
} from '@/lib/db';
import {
  computeContentBudget,
  countSessionPlanWords,
  validateSessionCoverage,
  WORDS_PER_PAGE,
} from '@/lib/guide-engine/content-budget';
import type { SessionPlan, MissionSection } from '@/types/work-textbook';
import type { WriterOutput } from '@/lib/guide-engine/writers/writer-contract';

// Mock DB
vi.mock('@/lib/db', () => ({
  getPlanningById: vi.fn(),
  getTeacherById: vi.fn(),
  getPlanningExtras: vi.fn(),
  findCanonicalSeed: vi.fn(),
  saveCanonicalSeed: vi.fn(),
  saveBlockWorkbook: vi.fn(),
  updateWorkbookProgress: vi.fn(),
  updateGenerationJobProgress: vi.fn(),
  incrementSeedUsage: vi.fn(),
}));

// Mock Resilience Agent
vi.mock('@/lib/guide-engine/resilience-agent', () => ({
  generateTroubleshootingMatrix: vi.fn().mockResolvedValue([]),
}));

// Mock 4 writers
vi.mock('@/lib/guide-engine/writers/foundation-writer', () => ({
  generateFoundationMission: vi.fn(),
}));
vi.mock('@/lib/guide-engine/writers/lab-writer', () => ({
  generateLabMission: vi.fn(),
}));
vi.mock('@/lib/guide-engine/writers/project-writer', () => ({
  generateProjectMission: vi.fn(),
}));
vi.mock('@/lib/guide-engine/writers/evaluation-writer', () => ({
  generateEvaluationSection: vi.fn(),
}));

import { generateFoundationMission } from '@/lib/guide-engine/writers/foundation-writer';
import { generateLabMission } from '@/lib/guide-engine/writers/lab-writer';
import { generateProjectMission } from '@/lib/guide-engine/writers/project-writer';
import { generateEvaluationSection } from '@/lib/guide-engine/writers/evaluation-writer';

function makeMockSessionPlan(sessionNumber: number, wordsPerPlan = 250): SessionPlan {
  const chunkWords = Math.max(5, Math.floor(wordsPerPlan / 8));
  const dummyText = 'palabra '.repeat(chunkWords).trim();
  return {
    sessionNumber,
    objetivo: `Objetivo de aprendizaje sesión ${sessionNumber}: ${dummyText}`,
    motivacion: `Motivación cotidiana situada: ${dummyText}`,
    saberesPrevios: `Saberes previos: ${dummyText}`,
    contenido: `Fundamentación teórica paso a paso: ${dummyText} ${dummyText}`,
    ejemploResuelto: `Ejemplo resuelto numérico: ${dummyText}`,
    practica: [
      { enunciado: `Ejercicio 1 con datos: ${dummyText}`, pista: 'Pista guiada para resolver' },
    ],
    aplicacion: `Aplicación en el entorno real o comunidad: ${dummyText}`,
    autoevaluacion: ['¿Comprendo el concepto principal?', '¿Puedo resolver el ejercicio solo?'],
    recursos: [{ titulo: 'Video explicativo', url: 'https://youtube.com/watch?v=demo', tipo: 'video' }],
    productoIntegrador: `Avance del artefacto en sesión ${sessionNumber}`,
  };
}

function makeMockWriterOutput(params: {
  type: 'foundation' | 'lab' | 'project' | 'evaluation';
  sessions: number[];
  baseWords?: number;
  wordsPerPlan?: number;
}): WriterOutput {
  const { type, sessions, baseWords = 400, wordsPerPlan = 250 } = params;
  const sessionPlans = sessions.map((s) => makeMockSessionPlan(s, wordsPerPlan));
  const plansWords = sessionPlans.reduce((acc, p) => acc + countSessionPlanWords(p), 0);
  const totalWords = baseWords + plansWords;

  const section: MissionSection = {
    missionIndex: type === 'foundation' ? 1 : type === 'lab' ? 2 : type === 'project' ? 3 : 4,
    title: `Misión ${type.toUpperCase()}`,
    coveredSessions: sessions,
    sessionTopic: `Tópico de ${type}`,
    sessionFocus: `Enfoque pedagógico ${type}`,
    phenomenonHook: {
      story: 'Caso situado en Puebla',
      detonatingQuestion: '¿Cómo modelamos este fenómeno?',
    },
    conceptZero: {
      physicalAnalogy: 'Analogía intuitiva del entorno',
      coreExplanation: 'Explicación técnica rigurosa',
    },
    iDoSection: { stepByStepDemo: 'Demostración paso a paso' },
    weDoSection: { guidedPractice: 'Práctica guiada en equipo', workbookElements: [] },
    youDoSection: { autonomousChallenge: 'Reto autónomo en cuaderno', workbookElements: [] },
    troubleshooting: [],
    formativeCheckpoint: {
      question: '¿Qué aprendiste?',
      reflectionPrompts: ['Reflexiona sobre tu avance'],
      criteriaChecklist: ['Criterio 1'],
    },
    sessionPlans,
    wordCount: totalWords,
  };

  return {
    type,
    section,
    wordCount: totalWords,
    tokensUsed: Math.round(totalWords * 1.3),
    qualityScore: 90,
    warnings: [],
  };
}

describe('Phase P3: Content Budget and Editorial Orchestration', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(getTeacherById).mockResolvedValue({
      id: 'teacher-1',
      name: 'Mtro. Juan Pérez',
      email: 'juan@sems.puebla.gob.mx',
    } as any);

    vi.mocked(getPlanningExtras).mockResolvedValue([]);
    vi.mocked(findCanonicalSeed).mockResolvedValue(null);
    vi.mocked(saveCanonicalSeed).mockResolvedValue({} as any);
    vi.mocked(saveBlockWorkbook).mockResolvedValue({} as any);
    vi.mocked(updateWorkbookProgress).mockResolvedValue();
    vi.mocked(updateGenerationJobProgress).mockResolvedValue(true);
  });

  it('calibra correctamente una asignatura de 3 h/semana (18 sesiones estándar)', async () => {
    vi.mocked(getPlanningById).mockResolvedValue({
      id: 'plan-3h',
      teacher_id: 'teacher-1',
      teacherId: 'teacher-1',
      uac_name: 'Pensamiento Matemático I',
      uacName: 'Pensamiento Matemático I',
      semester: 1,
      component: 'fundamental',
      paec_context: 'Cuidado del agua en la comunidad',
      paecContext: 'Cuidado del agua en la comunidad',
      content_json: {
        sectionI: {
          totalHoursWeekly: 3,
        },
      },
      contentJson: {
        sectionI: {
          totalHoursWeekly: 3,
        },
      },
    } as any);

    // 18 sesiones divididas en 4 misiones: [1-5], [6-10], [11-15], [16-18]
    vi.mocked(generateFoundationMission).mockResolvedValue(
      makeMockWriterOutput({ type: 'foundation', sessions: [1, 2, 3, 4, 5], baseWords: 400, wordsPerPlan: 1050 })
    );
    vi.mocked(generateLabMission).mockResolvedValue(
      makeMockWriterOutput({ type: 'lab', sessions: [6, 7, 8, 9, 10], baseWords: 400, wordsPerPlan: 1050 })
    );
    vi.mocked(generateProjectMission).mockResolvedValue(
      makeMockWriterOutput({ type: 'project', sessions: [11, 12, 13, 14, 15], baseWords: 400, wordsPerPlan: 1050 })
    );
    vi.mocked(generateEvaluationSection).mockResolvedValue(
      makeMockWriterOutput({ type: 'evaluation', sessions: [16, 17, 18], baseWords: 400, wordsPerPlan: 1050 })
    );

    const workbook = await generateBlockWorkTextbook('plan-3h', 0);

    expect(workbook.sessionsPerBlock).toBe(18);
    expect(workbook.targetPages).toBe(48); // ideal de 45-50
    expect(workbook.targetWords).toBe(21375); // ideal de 20,250 a 22,500
    expect(workbook.totalPages).toBeGreaterThanOrEqual(40);
    expect(workbook.totalPages).toBeLessThanOrEqual(55);

    expect(workbook.coverageReport).toBeDefined();
    expect(workbook.coverageReport?.sessionsExpected).toBe(18);
    expect(workbook.coverageReport?.sessionsCovered).toBe(18);
    expect(workbook.coverageReport?.allSessionsPresent).toBe(true);
    expect(workbook.coverageReport?.withinTargetRange).toBe(true);
    expect(workbook.qualityWarning).toBe(false);
  });

  it('calibra correctamente una asignatura de 1 h/semana (6 sesiones cortas)', async () => {
    vi.mocked(getPlanningById).mockResolvedValue({
      id: 'plan-1h',
      teacher_id: 'teacher-1',
      teacherId: 'teacher-1',
      uac_name: 'Tutoría y Orientación Educativa',
      uacName: 'Tutoría y Orientación Educativa',
      semester: 1,
      component: 'fundamental',
      content_json: {
        sectionI: {
          totalHoursWeekly: 1,
        },
      },
      contentJson: {
        sectionI: {
          totalHoursWeekly: 1,
        },
      },
    } as any);

    // 6 sesiones divididas: [1, 2], [3, 4], [5], [6]
    vi.mocked(generateFoundationMission).mockResolvedValue(
      makeMockWriterOutput({ type: 'foundation', sessions: [1, 2], baseWords: 250, wordsPerPlan: 1000 })
    );
    vi.mocked(generateLabMission).mockResolvedValue(
      makeMockWriterOutput({ type: 'lab', sessions: [3, 4], baseWords: 250, wordsPerPlan: 1000 })
    );
    vi.mocked(generateProjectMission).mockResolvedValue(
      makeMockWriterOutput({ type: 'project', sessions: [5], baseWords: 250, wordsPerPlan: 1000 })
    );
    vi.mocked(generateEvaluationSection).mockResolvedValue(
      makeMockWriterOutput({ type: 'evaluation', sessions: [6], baseWords: 250, wordsPerPlan: 1000 })
    );

    const workbook = await generateBlockWorkTextbook('plan-1h', 0);

    expect(workbook.sessionsPerBlock).toBe(6);
    expect(workbook.targetPages).toBe(16); // ideal de 15 a 17 págs
    expect(workbook.targetWords).toBe(7125); // ideal de 6,750 a 7,500
    expect(workbook.totalPages).toBeGreaterThanOrEqual(14);
    expect(workbook.totalPages).toBeLessThanOrEqual(20);

    expect(workbook.coverageReport?.sessionsExpected).toBe(6);
    expect(workbook.coverageReport?.sessionsCovered).toBe(6);
    expect(workbook.coverageReport?.allSessionsPresent).toBe(true);
  });

  it('detecta sesiones incompletas y enciende qualityWarning en el libro', async () => {
    vi.mocked(getPlanningById).mockResolvedValue({
      id: 'plan-incomplete',
      teacher_id: 'teacher-1',
      teacherId: 'teacher-1',
      uac_name: 'Química I',
      uacName: 'Química I',
      semester: 1,
      content_json: {
        sectionI: {
          totalHoursWeekly: 3, // Espera 18 sesiones
        },
      },
      contentJson: {
        sectionI: {
          totalHoursWeekly: 3, // Espera 18 sesiones
        },
      },
    } as any);

    // Solo se entregan 12 sesiones de las 18 requeridas
    vi.mocked(generateFoundationMission).mockResolvedValue(
      makeMockWriterOutput({ type: 'foundation', sessions: [1, 2, 3], baseWords: 500, wordsPerPlan: 500 })
    );
    vi.mocked(generateLabMission).mockResolvedValue(
      makeMockWriterOutput({ type: 'lab', sessions: [4, 5, 6], baseWords: 500, wordsPerPlan: 500 })
    );
    vi.mocked(generateProjectMission).mockResolvedValue(
      makeMockWriterOutput({ type: 'project', sessions: [7, 8, 9], baseWords: 500, wordsPerPlan: 500 })
    );
    vi.mocked(generateEvaluationSection).mockResolvedValue(
      makeMockWriterOutput({ type: 'evaluation', sessions: [10, 11, 12], baseWords: 500, wordsPerPlan: 500 })
    );

    const workbook = await generateBlockWorkTextbook('plan-incomplete', 0);

    expect(workbook.sessionsPerBlock).toBe(18);
    expect(workbook.coverageReport?.sessionsExpected).toBe(18);
    expect(workbook.coverageReport?.sessionsCovered).toBe(12);
    expect(workbook.coverageReport?.allSessionsPresent).toBe(false);
    expect(workbook.qualityWarning).toBe(true);
  });

  it('respeta customHours provisto en options sobreescribiendo el valor por defecto', async () => {
    vi.mocked(getPlanningById).mockResolvedValue({
      id: 'plan-custom-hours',
      teacher_id: 'teacher-1',
      teacherId: 'teacher-1',
      uac_name: 'Electrónica y Microcontroladores',
      uacName: 'Electrónica y Microcontroladores',
      semester: 3,
      content_json: null,
      contentJson: null,
    } as any);

    // Con customHours = 4, se esperan 24 sesiones (6 semanas * 4 h)
    vi.mocked(generateFoundationMission).mockResolvedValue(
      makeMockWriterOutput({ type: 'foundation', sessions: [1, 2, 3, 4, 5, 6], baseWords: 600, wordsPerPlan: 1100 })
    );
    vi.mocked(generateLabMission).mockResolvedValue(
      makeMockWriterOutput({ type: 'lab', sessions: [7, 8, 9, 10, 11, 12], baseWords: 600, wordsPerPlan: 1100 })
    );
    vi.mocked(generateProjectMission).mockResolvedValue(
      makeMockWriterOutput({ type: 'project', sessions: [13, 14, 15, 16, 17, 18], baseWords: 600, wordsPerPlan: 1100 })
    );
    vi.mocked(generateEvaluationSection).mockResolvedValue(
      makeMockWriterOutput({ type: 'evaluation', sessions: [19, 20, 21, 22, 23, 24], baseWords: 600, wordsPerPlan: 1100 })
    );

    const workbook = await generateBlockWorkTextbook('plan-custom-hours', 0, { customHours: 4 });

    expect(workbook.sessionsPerBlock).toBe(24);
    expect(workbook.targetPages).toBe(64); // ideal para 24 sesiones
    expect(workbook.targetWords).toBe(28500); // ideal para 24 sesiones
    expect(workbook.coverageReport?.sessionsExpected).toBe(24);
    expect(workbook.coverageReport?.sessionsCovered).toBe(24);
    expect(workbook.coverageReport?.allSessionsPresent).toBe(true);
  });
});
