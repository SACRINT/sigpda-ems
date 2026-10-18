/**
 * Fase A — Cobertura de sesiones en el workbook ensamblado (anti "36 vs 72").
 *
 * El ensamblado del ActiveWorkTextbook toma mission.sessionPlans tal cual de cada
 * writer. Si un writer falla por completo (contingencia crítica), el emergency
 * fallback históricamente fijaba coveredSessions: [1, 2] (duplicando la misión 1)
 * y NO emitía sessionPlans: esas sesiones desaparecían del libro editorial.
 *
 * Este test es load-bearing contra la mutación "coveredSessions: [1, 2] hardcodeado"
 * en createEmergencyFallbackOutput: dado un blueprint de 24 sesiones en 4 misiones,
 * el workbook resultante debe cubrir 1..24 con sesiones ÚNICAS y con un plan por
 * cada sesión aunque el writer de proyecto falle.
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
  incrementSeedUsage,
} from '@/lib/db';
import { extractCurriculumContext } from '@/lib/guide-engine/curriculum-context-agent';
import { buildBlockBlueprint } from '@/lib/guide-engine/blueprint-architect-agent';
import type { MissionBlueprint } from '@/lib/guide-engine/blueprint-architect-agent';
import { generateFoundationMission } from '@/lib/guide-engine/writers/foundation-writer';
import { generateLabMission } from '@/lib/guide-engine/writers/lab-writer';
import { generateProjectMission } from '@/lib/guide-engine/writers/project-writer';
import { generateEvaluationSection } from '@/lib/guide-engine/writers/evaluation-writer';
import { generateTroubleshootingMatrix } from '@/lib/guide-engine/resilience-agent';
import { validateBlockGuideQuality } from '@/lib/guide-engine/quality-validator';
import type { QualityValidatorOutput } from '@/lib/guide-engine/quality-validator';
import type { WriterOutput } from '@/lib/guide-engine/writers/writer-contract';
import type { MissionSection, SessionPlan } from '@/types/work-textbook';

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
vi.mock('@/lib/guide-engine/curriculum-context-agent', () => ({
  extractCurriculumContext: vi.fn(),
}));
vi.mock('@/lib/guide-engine/blueprint-architect-agent', () => ({
  buildBlockBlueprint: vi.fn(),
}));
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
vi.mock('@/lib/guide-engine/resilience-agent', () => ({
  generateTroubleshootingMatrix: vi.fn(),
}));
vi.mock('@/lib/guide-engine/quality-validator', () => ({
  validateBlockGuideQuality: vi.fn(),
}));

// Planeación SIN sectionIV → planningActivities undefined → sin reintento Fase 8.5
// (las llamadas a cada writer son exactamente 1 y el camino de contingencia es estable).
const planningRow = {
  id: 'pl-1',
  teacher_id: 't-1',
  uac_name: 'Pensamiento Matemático III',
  semester: 3,
  component: 'fundamental',
  curriculum_name: 'Plan Demo 2026',
  paec_context: 'Falta de espacios de esparcimiento en Venustiano Carranza',
  paec_project_name: 'Huerto Comunitario',
  extracted_data: null,
  content_json: {
    sectionI: { teacherName: 'Mtra. Prueba', paecProjectName: 'Huerto Comunitario' },
    sectionIV: { note: '', activities: [] },
  },
  status: 'generated',
  created_at: new Date('2026-10-01T00:00:00.000Z'),
  updated_at: new Date('2026-10-01T00:00:00.000Z'),
  metodologia_activa: null,
  evaluation_json: null,
  sequence_json: null,
};

const MISSIONS: MissionBlueprint[] = [
  { missionIndex: 1, title: 'Misión 1: Fundamentación — Apertura', sessionNumbers: [1, 2, 3], sessionTopic: 'Ecuaciones lineales', focus: 'Concepto Cero', missionType: 'foundation', targetPages: 9, targetWords: 9000 },
  { missionIndex: 2, title: 'Misión 2: Laboratorio — Desarrollo', sessionNumbers: [4, 5, 6, 7, 8, 9, 10, 11, 12], sessionTopic: 'Resolución', focus: 'Práctica', missionType: 'lab', targetPages: 9, targetWords: 9000 },
  { missionIndex: 3, title: 'Misión 3: Artefacto Real — Desarrollo', sessionNumbers: [13, 14, 15, 16, 17, 18, 19, 20, 21], sessionTopic: 'Modelación', focus: 'Proyecto', missionType: 'project', targetPages: 9, targetWords: 9000 },
  { missionIndex: 4, title: 'Misión 4: Evaluación — Cierre', sessionNumbers: [22, 23, 24], sessionTopic: 'Evaluación', focus: 'Cierre', missionType: 'evaluation', targetPages: 6, targetWords: 6000 },
];

const validationOk: QualityValidatorOutput = {
  accepted: true,
  qualityScore: 79,
  qualityWarning: false,
  failedWriters: [],
  retryableWriters: [],
  totalWordCount: 4500,
  warnings: [],
};

function makePlan(n: number): SessionPlan {
  return {
    sessionNumber: n,
    objetivo: `Lo que vas a aprender en la sesión ${n}: modelar situaciones reales con ecuaciones lineales.`,
    motivacion: `Historia real de la comunidad durante la sesión ${n} con presupuesto y datos verificables.`,
    saberesPrevios: 'Ya resolviste ecuaciones simples de primer grado en sesiones previas.',
    contenido: `Contenido teórico de la sesión ${n}: definiciones, fórmulas y procedimiento paso a paso para aprender solo.`,
    ejemploResuelto: `Ejemplo con números de la sesión ${n}: 12x + 60 = 180 da x = 10 tras despejar paso a paso.`,
    practica: [
      {
        enunciado: `Ejercicio concreto de la sesión ${n} con datos de la comunidad.`,
        pista: 'Agrupa los términos semejantes antes de despejar.',
        solucion: ['Paso 1: restar 60 en ambos miembros', 'Respuesta final: x = 10'],
      },
    ],
    aplicacion: 'Aplica lo aprendido a una situación real de tu vida diaria.',
    autoevaluacion: [
      `¿Puedo explicar el concepto central de la sesión ${n}?`,
      '¿Logré resolver la práctica sin mirar el ejemplo?',
    ],
    recursos: [
      { titulo: 'Video: ecuaciones lineales', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', tipo: 'video' },
    ],
    productoIntegrador: `Agrega el avance de la sesión ${n} a tu producto integrador.`,
  };
}

function makeSection(
  content: string,
  missionIndex: number,
  coveredSessions: number[],
  planSessions: number[]
): MissionSection {
  return {
    missionIndex,
    title: `Misión ${missionIndex}: Contenido de prueba`,
    coveredSessions,
    sessionTopic: 'Tema Demo',
    sessionFocus: content,
    phenomenonHook: { story: content, detonatingQuestion: '¿Cómo aplicar lo aprendido?' },
    conceptZero: { physicalAnalogy: 'Analogía de trabajo', coreExplanation: content },
    iDoSection: { stepByStepDemo: content },
    weDoSection: { guidedPractice: content, workbookElements: [] },
    youDoSection: { autonomousChallenge: content, workbookElements: [] },
    troubleshooting: [],
    formativeCheckpoint: { question: content, reflectionPrompts: [], criteriaChecklist: [] },
    sessionPlans: planSessions.map(makePlan),
    wordCount: 1200,
  };
}

function makeOutput(
  type: WriterOutput['type'],
  content: string,
  missionIndex: number,
  coveredSessions: number[],
  planSessions: number[]
): WriterOutput {
  return {
    type,
    section: makeSection(content, missionIndex, coveredSessions, planSessions),
    wordCount: 1200,
    tokensUsed: 0,
    qualityScore: 85,
    warnings: [],
  };
}

function stubBasePipeline(): void {
  vi.mocked(getPlanningById).mockResolvedValue(planningRow as never);
  vi.mocked(getTeacherById).mockResolvedValue({
    subsystem: 'Bachillerato General',
    name: 'Mtra. Prueba',
    school_name: 'Plantel Demo',
    municipality: 'Venustiano Carranza',
    cct: '21EBH0200X',
  } as never);
  vi.mocked(getPlanningExtras).mockResolvedValue([] as never);
  vi.mocked(findCanonicalSeed).mockResolvedValue(null as never);
  vi.mocked(saveCanonicalSeed).mockResolvedValue(undefined as never);
  vi.mocked(saveBlockWorkbook).mockResolvedValue(undefined as never);
  vi.mocked(updateWorkbookProgress).mockResolvedValue(undefined as never);
  vi.mocked(updateGenerationJobProgress).mockResolvedValue(undefined as never);
  vi.mocked(incrementSeedUsage).mockResolvedValue(undefined as never);
  vi.mocked(extractCurriculumContext).mockReturnValue({
    uacName: 'Pensamiento Matemático III',
    subsystem: 'bge',
    targetWords: { min: 17500, max: 25000 },
    paecConnection: { communityProblem: 'Falta de espacios de esparcimiento en Venustiano Carranza', projectName: 'Huerto Comunitario' },
    studentProfile: { contextDescription: 'Estudiantes de prueba' },
    applicableNorms: [],
  } as never);
  vi.mocked(buildBlockBlueprint).mockReturnValue({
    sessions: [],
    missions: MISSIONS,
  } as never);
  vi.mocked(generateTroubleshootingMatrix).mockResolvedValue([] as never);
  vi.mocked(validateBlockGuideQuality).mockReturnValue(validationOk);
}

describe('block-guide-orchestrator — workbook cubre 24/24 sesiones (Fase A)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubBasePipeline();
  });

  it('si el writer de proyecto falla por completo, la contingencia cubre 13-21 y el total sigue en 24', async () => {
    vi.mocked(generateFoundationMission).mockResolvedValue(
      makeOutput('foundation', 'Contenido de fundamentación', 1, [1, 2, 3], [1, 2, 3])
    );
    vi.mocked(generateLabMission).mockResolvedValue(
      makeOutput('lab', 'Contenido de laboratorio', 2, [4, 5, 6, 7, 8, 9, 10, 11, 12], [4, 5, 6, 7, 8, 9, 10, 11, 12])
    );
    vi.mocked(generateProjectMission).mockRejectedValue(new Error('IA upstream 503'));
    vi.mocked(generateEvaluationSection).mockResolvedValue(
      makeOutput('evaluation', 'Contenido de evaluación', 4, [22, 23, 24], [22, 23, 24])
    );

    const wb = await generateBlockWorkTextbook('pl-1', 0);

    expect(generateProjectMission).toHaveBeenCalledTimes(1);
    expect(wb.missions).toHaveLength(4);

    // 1. Sesiones ÚNICAS 1..24: la contingencia NO reutiliza el rango [1, 2].
    const covered = wb.missions.flatMap((m) => m.coveredSessions ?? []);
    expect(new Set(covered).size).toBe(24);
    expect([...covered].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 24 }, (_, i) => i + 1)
    );

    // 2. La misión de proyecto emergente usa las sesiones reales (13-21).
    const projectMission = wb.missions[2];
    expect(projectMission.coveredSessions).toEqual([13, 14, 15, 16, 17, 18, 19, 20, 21]);

    // 3. Un plan de sesión por cada una de las 24 sesiones del bloque.
    const planNumbers = wb.missions
      .flatMap((m) => m.sessionPlans ?? [])
      .map((p) => p.sessionNumber);
    expect(new Set(planNumbers).size).toBe(24);
    expect([...planNumbers].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 24 }, (_, i) => i + 1)
    );

    // 4. Los planes emergentes son material de estudiante (no vacíos).
    for (const plan of projectMission.sessionPlans ?? []) {
      expect(plan.contenido.length).toBeGreaterThan(20);
      expect(plan.practica.length).toBeGreaterThan(0);
    }

    expect(saveBlockWorkbook).toHaveBeenCalledTimes(1);
  }, 30000);
});
