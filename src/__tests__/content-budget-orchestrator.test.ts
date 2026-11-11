/**
 * content-budget-orchestrator.test.ts
 * SIGPDA-EMS · SEMS Puebla MCCEMS 2026-2027
 *
 * Suite de pruebas unitarias e integración de la Fase P3 / P3.1:
 * - Calibración editorial por sesiones de aprendizaje
 * - Conexión de horas reales semanales con presupuesto de páginas y palabras
 * - Validación de cobertura de sesiones y reporte en ActiveWorkTextbook
 * - Contabilidad completa de palabras incluyendo sessionPlans estudiantiles
 * - Validación E2E del compilador PDF para libro calibrado de 18 sesiones (45-50 páginas)
 */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PDFParse } from 'pdf-parse';
import { generateBlockWorkTextbook } from '@/lib/guide-engine/block-guide-orchestrator';
import { renderWorkbookToPdf } from '@/lib/pdf-workbook-renderer';
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
  getImageAssetByMission: vi.fn().mockResolvedValue(null),
  saveImageAsset: vi.fn().mockResolvedValue({ id: 'mock-saved-asset-id' }),
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

import { buildRichFallbackPlan } from '@/lib/guide-engine/writers/writer-contract';

function makeMockSessionPlan(sessionNumber: number, wordsPerPlan = 880): SessionPlan {
  const wordsPerField = Math.max(10, Math.floor((wordsPerPlan - 30) / 7));
  const dummyText = 'término conceptual explicativo del tema curricular '.repeat(Math.ceil(wordsPerField / 7)).trim().split(/\s+/).slice(0, wordsPerField).join(' ');
  return {
    sessionNumber,
    objetivo: `Objetivo de aprendizaje sesión ${sessionNumber}: ${dummyText}`,
    motivacion: `Motivación cotidiana situada: ${dummyText}`,
    saberesPrevios: `Saberes previos: ${dummyText}`,
    contenido: `Fundamentación teórica paso a paso: ${dummyText}`,
    ejemploResuelto: `Ejemplo resuelto numérico: ${dummyText}`,
    practica: [
      { enunciado: `Ejercicio 1 con datos: ${dummyText}`, pista: 'Pista guiada para resolver' },
      { enunciado: `Ejercicio 2 con datos: ${dummyText}`, pista: 'Pista guiada para resolver' },
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
  const { type, sessions, baseWords = 1200, wordsPerPlan } = params;
  const sessionPlans = sessions.map((s) => makeMockSessionPlan(s, wordsPerPlan));
  const plansWords = sessionPlans.reduce((acc, p) => acc + countSessionPlanWords(p), 0);
  const totalWords = baseWords + plansWords;

  const pTheory1 =
    'El análisis de los procesos formativos requiere integrar conceptos, procedimientos y evidencias situadas en el entorno comunitario. Mediante el estudio sistemático de cada tema, los estudiantes identifican relaciones, criterios de calidad y aplicaciones en problemáticas reales del Estado de Puebla, vinculando la teoría con la toma de decisiones informada y transformadora.';
  const pTheory2 =
    'Para caracterizar cada proceso con rigor, se definen los conceptos centrales, se revisan los procedimientos propios de la disciplina y se contrastan los resultados con los criterios acordados. Esta relación permite describir el estado actual de una situación, proyectar mejoras y estimar riesgos en los proyectos comunitarios escolares.';

  const section: MissionSection = {
    missionIndex: type === 'foundation' ? 1 : type === 'lab' ? 2 : type === 'project' ? 3 : 4,
    title: `Misión ${type.toUpperCase()}`,
    coveredSessions: sessions,
    sessionTopic: `Tópico Curricular de ${type}`,
    sessionFocus: `Enfoque Pedagógico Situado de ${type}`,
    phenomenonHook: {
      story: `Caso situado en una comunidad escolar del Estado de Puebla para contextualizar el aprendizaje formativo en ${type}. ${pTheory1}`,
      detonatingQuestion: '¿Cómo podemos intervenir positivamente ante este reto comunitario desde nuestra disciplina?',
    },
    conceptZero: {
      physicalAnalogy: 'Analogía física cotidiana que ilustra el fenómeno con elementos del entorno del estudiante y recursos locales comprobables.',
      coreExplanation: `${pTheory1}\n\n${pTheory2}`,
    },
    iDoSection: { stepByStepDemo: `Demostración paso a paso modelada por el docente con variables claras y procedimiento cuantitativo.\n\n${pTheory1}` },
    weDoSection: { guidedPractice: `Práctica guiada en equipos de trabajo colaborativo para resolución situada en el aula escolar.\n\n${pTheory2}`, workbookElements: [] },
    youDoSection: { autonomousChallenge: `Reto autónomo individual en el cuaderno activo con 5 pasos numerados para consolidar el aprendizaje significativo.\n\n${pTheory1}`, workbookElements: [] },
    troubleshooting: [
      { id: 'tb-mock-1', symptom: 'Desviación en el resultado del procedimiento', rootCause: 'Omisión de un paso o criterio de revisión', solutionSteps: ['Verificar los datos iniciales y finales', 'Recalcular el resultado'], preventionTip: 'Registrar explícitamente los criterios y pasos del procedimiento' },
    ],
    formativeCheckpoint: {
      question: '¿Qué aprendiste?',
      reflectionPrompts: ['Reflexiona sobre tu avance en la sesión'],
      criteriaChecklist: ['Criterio 1: Rigor', 'Criterio 2: Procedimiento'],
    },
    sessionPlans,
    wordCount: totalWords,
  };

  return {
    type,
    section,
    projectSection:
      type === 'project'
        ? {
            artifactName: 'Producto integrador del bloque formativo',
            communityUtility: `Solución concreta para ${pTheory1.slice(0, 80)}`,
            phases: [
              {
                phaseNum: 1,
                title: 'Fase 1: Diagnóstico y diseño',
                allocatedHours: 2,
                deliverables: ['Propuesta técnica'],
                instructions: 'Delimitar el problema y los criterios de aceptación.',
              },
            ],
            technicalSpecs: ['Evidencia verificable y trazable'],
            acceptanceCriteria: ['El producto atiende el problema comunitario definido'],
          }
        : undefined,
    evaluationSection:
      type === 'evaluation'
        ? {
            source: 'generated_fresh',
            rubric: [
              {
                criterion: 'Dominio conceptual y procedimental',
                weightPercent: 100,
                levels: [
                  { levelName: 'Excelente', points: 10, descriptor: pTheory1 },
                  { levelName: 'Bueno', points: 8, descriptor: pTheory2 },
                  { levelName: 'Suficiente', points: 6, descriptor: 'Cumple los criterios mínimos del bloque.' },
                  { levelName: 'Requiere Apoyo', points: 4, descriptor: 'No evidencia el proceso solicitado.' },
                ],
              },
            ],
            checklist: [{ item: 'Entrega la evidencia con criterios explícitos', category: 'Cumplimiento' }],
            criticalThinkingQuiz: [
              {
                questionNumber: 1,
                question: '¿Cómo se relaciona el procedimiento con el resultado obtenido?',
                scenario: 'Resolución de un caso del entorno escolar.',
                answerExplanation: 'Se espera justificar la relación causa-efecto.',
              },
            ],
            metacognitiveReflection: {
              prompts: ['¿Qué estrategia te permitió resolver el reto?'],
            },
          }
        : undefined,
    wordCount: totalWords,
    tokensUsed: Math.round(totalWords * 1.3),
    qualityScore: 90,
    warnings: [],
  };
}

describe('Phase P3 / P3.1: Content Budget and Editorial Orchestration', () => {
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

  it('calibra correctamente una asignatura de 3 h/semana (18 sesiones estándar: 45-50 páginas)', async () => {
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

    // 18 sesiones divididas en 4 misiones con distribución pedagógica real:
    // Apertura: [1, 2, 3] (3 sesiones -> ~3,420 palabras)
    // Lab: [4, 5, 6, 7, 8, 9] (6 sesiones -> ~6,840 palabras)
    // Proyecto: [10, 11, 12, 13, 14, 15] (6 sesiones -> ~6,840 palabras)
    // Evaluación: [16, 17, 18] (3 sesiones -> ~3,420 palabras)
    vi.mocked(generateFoundationMission).mockResolvedValue(
      makeMockWriterOutput({ type: 'foundation', sessions: [1, 2, 3], baseWords: 900 })
    );
    vi.mocked(generateLabMission).mockResolvedValue(
      makeMockWriterOutput({ type: 'lab', sessions: [4, 5, 6, 7, 8, 9], baseWords: 1800 })
    );
    vi.mocked(generateProjectMission).mockResolvedValue(
      makeMockWriterOutput({ type: 'project', sessions: [10, 11, 12, 13, 14, 15], baseWords: 1800 })
    );
    vi.mocked(generateEvaluationSection).mockResolvedValue(
      makeMockWriterOutput({ type: 'evaluation', sessions: [16, 17, 18], baseWords: 900 })
    );

    const workbook = await generateBlockWorkTextbook('plan-3h', 0);

    expect(workbook.sessionsPerBlock).toBe(18);
    expect(workbook.targetPages).toBe(48); // ideal de 45-50
    expect(workbook.targetWords).toBe(21375); // ideal de 20,250 a 22,500
    expect(workbook.totalPages).toBeGreaterThanOrEqual(45);
    expect(workbook.totalPages).toBeLessThanOrEqual(50);
    expect(workbook.totalWords).toBeGreaterThanOrEqual(20250);
    expect(workbook.totalWords).toBeLessThanOrEqual(22500);

    expect(workbook.coverageReport).toBeDefined();
    expect(workbook.coverageReport?.sessionsExpected).toBe(18);
    expect(workbook.coverageReport?.sessionsCovered).toBe(18);
    expect(workbook.coverageReport?.allSessionsPresent).toBe(true);
    expect(workbook.coverageReport?.withinTargetRange).toBe(true);
    expect(workbook.qualityWarning).toBe(false);
  });

  it('tolera variaciones naturales leves de la IA (22,611 palabras, +111 palabras sobre el máximo) sin bloquear por BlockIntegrity', async () => {
    vi.mocked(getPlanningById).mockResolvedValue({
      id: 'plan-overshoot-mild',
      teacher_id: 'teacher-1',
      teacherId: 'teacher-1',
      uac_name: 'Taller de Pensamiento Variacional I',
      uacName: 'Taller de Pensamiento Variacional I',
      semester: 3,
      content_json: {
        sectionI: { totalHoursWeekly: 3 },
      },
      contentJson: {
        sectionI: { totalHoursWeekly: 3 },
      },
    } as any);

    // 4 redactores que suman exactamente 22,611 palabras (caso real del incidente de Taller de Pensamiento Variacional I)
    vi.mocked(generateFoundationMission).mockResolvedValue(
      makeMockWriterOutput({ type: 'foundation', sessions: [1, 2, 3], baseWords: 4501 - 3 * 1044, wordsPerPlan: 1044 })
    );
    vi.mocked(generateLabMission).mockResolvedValue(
      makeMockWriterOutput({ type: 'lab', sessions: [4, 5, 6, 7, 8, 9], baseWords: 7065 - 6 * 931, wordsPerPlan: 931 })
    );
    vi.mocked(generateProjectMission).mockResolvedValue(
      makeMockWriterOutput({ type: 'project', sessions: [10, 11, 12, 13, 14, 15], baseWords: 6506 - 6 * 850, wordsPerPlan: 850 })
    );
    vi.mocked(generateEvaluationSection).mockResolvedValue(
      makeMockWriterOutput({ type: 'evaluation', sessions: [16, 17, 18], baseWords: 4539 - 3 * 1100, wordsPerPlan: 1100 })
    );

    const workbook = await generateBlockWorkTextbook('plan-overshoot-mild', 0, { expandDeficientSessions: false });

    expect(workbook).toBeDefined();
    expect(workbook.totalWords).toBeGreaterThan(22500);
    expect(workbook.totalWords).toBeLessThanOrEqual(23287);
    expect(saveBlockWorkbook).toHaveBeenCalled();
  });

  it('calibra correctamente una asignatura de 1 h/semana (6 sesiones cortas: 15-17 páginas)', async () => {
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

    // 6 sesiones divididas: [1], [2, 3], [4, 5], [6]
    vi.mocked(generateFoundationMission).mockResolvedValue(
      makeMockWriterOutput({ type: 'foundation', sessions: [1], baseWords: 580, wordsPerPlan: 590 })
    );
    vi.mocked(generateLabMission).mockResolvedValue(
      makeMockWriterOutput({ type: 'lab', sessions: [2, 3], baseWords: 1170, wordsPerPlan: 590 })
    );
    vi.mocked(generateProjectMission).mockResolvedValue(
      makeMockWriterOutput({ type: 'project', sessions: [4, 5], baseWords: 1170, wordsPerPlan: 590 })
    );
    vi.mocked(generateEvaluationSection).mockResolvedValue(
      makeMockWriterOutput({ type: 'evaluation', sessions: [6], baseWords: 580, wordsPerPlan: 590 })
    );

    const workbook = await generateBlockWorkTextbook('plan-1h', 0);

    expect(workbook.sessionsPerBlock).toBe(6);
    expect(workbook.targetPages).toBe(16); // ideal de 15 a 17 págs
    expect(workbook.targetWords).toBe(7125); // ideal de 6,750 a 7,500
    expect(workbook.totalPages).toBeGreaterThanOrEqual(15);
    expect(workbook.totalPages).toBeLessThanOrEqual(17);
    expect(workbook.totalWords).toBeGreaterThanOrEqual(6750);
    expect(workbook.totalWords).toBeLessThanOrEqual(7500);

    expect(workbook.coverageReport?.sessionsExpected).toBe(6);
    expect(workbook.coverageReport?.sessionsCovered).toBe(6);
    expect(workbook.coverageReport?.allSessionsPresent).toBe(true);
    expect(workbook.coverageReport?.withinTargetRange).toBe(true);
    expect(workbook.qualityWarning).toBe(false);
  });

  it('rechaza sesiones incompletas sin persistir el bloque', async () => {
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

    await expect(generateBlockWorkTextbook('plan-incomplete', 0)).rejects.toThrow(/BlockIntegrity/);
    expect(saveBlockWorkbook).not.toHaveBeenCalled();
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
      makeMockWriterOutput({ type: 'foundation', sessions: [1, 2, 3, 4], baseWords: 2330, wordsPerPlan: 590 })
    );
    vi.mocked(generateLabMission).mockResolvedValue(
      makeMockWriterOutput({ type: 'lab', sessions: [5, 6, 7, 8, 9, 10, 11, 12], baseWords: 4670, wordsPerPlan: 590 })
    );
    vi.mocked(generateProjectMission).mockResolvedValue(
      makeMockWriterOutput({ type: 'project', sessions: [13, 14, 15, 16, 17, 18, 19, 20], baseWords: 4670, wordsPerPlan: 590 })
    );
    vi.mocked(generateEvaluationSection).mockResolvedValue(
      makeMockWriterOutput({ type: 'evaluation', sessions: [21, 22, 23, 24], baseWords: 2330, wordsPerPlan: 590 })
    );

    const workbook = await generateBlockWorkTextbook('plan-custom-hours', 0, { customHours: 4 });

    expect(workbook.sessionsPerBlock).toBe(24);
    expect(workbook.targetPages).toBe(64); // ideal para 24 sesiones (60-67 págs)
    expect(workbook.targetWords).toBe(28500); // ideal para 24 sesiones (27,000-30,000)
    expect(workbook.coverageReport?.sessionsExpected).toBe(24);
    expect(workbook.coverageReport?.sessionsCovered).toBe(24);
    expect(workbook.coverageReport?.allSessionsPresent).toBe(true);
    expect(workbook.coverageReport?.withinTargetRange).toBe(true);
    expect(workbook.qualityWarning).toBe(false);
  });

  it('E2E Real: Renderiza el libro de 18 sesiones en PDF formal completo verificando 45-50 páginas y cobertura total', async () => {
    const planningMock = {
      id: 'plan-3h-pdf',
      teacher_id: 'teacher-1',
      teacherId: 'teacher-1',
      uac_name: 'Pensamiento Matemático I',
      uacName: 'Pensamiento Matemático I',
      semester: 1,
      component: 'fundamental',
      paec_context: 'Cuidado del agua en la comunidad escolar de Puebla',
      paecContext: 'Cuidado del agua en la comunidad escolar de Puebla',
      content_json: {
        sectionI: { totalHoursWeekly: 3, teacherName: 'Mtro. Juan Pérez' },
      },
      contentJson: {
        sectionI: { totalHoursWeekly: 3, teacherName: 'Mtro. Juan Pérez' },
      },
    } as any;

    vi.mocked(getPlanningById).mockResolvedValue(planningMock);

    vi.mocked(generateFoundationMission).mockResolvedValue(
      makeMockWriterOutput({ type: 'foundation', sessions: [1, 2, 3], baseWords: 900 })
    );
    vi.mocked(generateLabMission).mockResolvedValue(
      makeMockWriterOutput({ type: 'lab', sessions: [4, 5, 6, 7, 8, 9], baseWords: 1800 })
    );
    vi.mocked(generateProjectMission).mockResolvedValue(
      makeMockWriterOutput({ type: 'project', sessions: [10, 11, 12, 13, 14, 15], baseWords: 1800 })
    );
    vi.mocked(generateEvaluationSection).mockResolvedValue(
      makeMockWriterOutput({ type: 'evaluation', sessions: [16, 17, 18], baseWords: 900 })
    );

    const workbook = await generateBlockWorkTextbook('plan-3h-pdf', 0);
    expect(workbook.qualityWarning).toBe(false);
    expect(workbook.coverageReport?.allSessionsPresent).toBe(true);
    expect(workbook.coverageReport?.withinTargetRange).toBe(true);
    expect(workbook.totalWords).toBeGreaterThanOrEqual(20250);
    expect(workbook.totalWords).toBeLessThanOrEqual(22500);

    const pdfBuffer = await renderWorkbookToPdf(workbook, planningMock, { forceFallbackCover: true });
    expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
    expect(pdfBuffer.length).toBeGreaterThan(50000);

    const parser = new PDFParse({ data: pdfBuffer });
    const pdfData = await parser.getText();
    await parser.destroy();

    // Verificación de volumen formal de páginas (calibración estricta 45-50 páginas)
    console.log(`[E2E Test 5] Total palabras: ${workbook.totalWords}, Páginas PDF: ${pdfData.total}`);
    expect(pdfData.total).toBeGreaterThanOrEqual(45);
    expect(pdfData.total).toBeLessThanOrEqual(50);

    // Verificación de cobertura textual de todas las 18 sesiones (badge o texto descriptivo)
    const lowerText = pdfData.text.toLowerCase();
    for (let s = 1; s <= 18; s++) {
      const found = lowerText.includes(`sesion ${s}`) || lowerText.includes(`sesión ${s}`) || lowerText.includes(`sesiones ${s}`);
      expect(found).toBe(true);
    }

    // Verificación de datos de identidad y contexto
    expect(pdfData.text).toContain('Pensamiento Matemático I');
    expect(pdfData.text).toContain('Cuidado del agua');
  }, 30000);

  it('fail-closed: rechaza y no persiste un bloque con contaminación cruzada', async () => {
    vi.mocked(getPlanningById).mockResolvedValue({
      id: 'plan-contaminated',
      teacher_id: 'teacher-1',
      teacherId: 'teacher-1',
      uac_name: 'Tutoría y Orientación Educativa',
      uacName: 'Tutoría y Orientación Educativa',
      semester: 1,
      component: 'fundamental',
      content_json: { sectionI: { totalHoursWeekly: 1 } },
      contentJson: { sectionI: { totalHoursWeekly: 1 } },
    } as any);

    const contaminatedFoundation = makeMockWriterOutput({
      type: 'foundation',
      sessions: [1],
      baseWords: 580,
      wordsPerPlan: 590,
    });
    contaminatedFoundation.section.conceptZero.coreExplanation =
      'En esta sesión se realiza el ensamblaje físico del prototipo de riego y la prueba de estanqueidad de tuberías.';

    vi.mocked(generateFoundationMission).mockResolvedValue(contaminatedFoundation);
    vi.mocked(generateLabMission).mockResolvedValue(
      makeMockWriterOutput({ type: 'lab', sessions: [2, 3], baseWords: 1170, wordsPerPlan: 590 })
    );
    vi.mocked(generateProjectMission).mockResolvedValue(
      makeMockWriterOutput({ type: 'project', sessions: [4, 5], baseWords: 1170, wordsPerPlan: 590 })
    );
    vi.mocked(generateEvaluationSection).mockResolvedValue(
      makeMockWriterOutput({ type: 'evaluation', sessions: [6], baseWords: 580, wordsPerPlan: 590 })
    );

    await expect(generateBlockWorkTextbook('plan-contaminated', 0)).rejects.toThrow(/CrossContamination/);
    expect(saveBlockWorkbook).not.toHaveBeenCalled();
  });
});
