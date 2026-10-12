/**
 * P2 auditoría: cobertura de la Fase 8.5 del block-guide-orchestrator
 * (alineación DURA planeación ↔ libro + único reintento dirigido).
 *
 * generateBlockWorkTextbook no tenía NINGÚN test: el reintento de alineación era
 * código no probado. Estos tests son load-bearing contra la mutación
 * "if (false && planningActivities)" (retry deshabilitado):
 *  - A: reintento repara → planningAlignment.pass = true (fallaría con retry off).
 *  - B: reintento no repara → qualityWarning = true + pass = false (OR en ensamblado).
 *  - C: contenido ya alineado → NO se reintenta (1 llamada por writer).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MockedFunction } from 'vitest';
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
import { generateFoundationMission } from '@/lib/guide-engine/writers/foundation-writer';
import { generateLabMission } from '@/lib/guide-engine/writers/lab-writer';
import { generateProjectMission } from '@/lib/guide-engine/writers/project-writer';
import { generateEvaluationSection } from '@/lib/guide-engine/writers/evaluation-writer';
import { generateTroubleshootingMatrix } from '@/lib/guide-engine/resilience-agent';
import { validateBlockGuideQuality } from '@/lib/guide-engine/quality-validator';
import type { QualityValidatorOutput } from '@/lib/guide-engine/quality-validator';
import type { WriterInput, WriterOutput } from '@/lib/guide-engine/writers/writer-contract';
import type { MissionSection } from '@/types/work-textbook';

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

const CONTENIDO = 'Estudio profundo de la fotónica cuántica aplicada a interferometría';
const SABER = 'El estudiante explica la fotónica cuántica con vocabulario técnico preciso';
const SABER_HACER = 'El estudiante manipula el equipo láser y lente con seguridad industrial';
const SABER_SER = 'El estudiante valora la seguridad al trabajar con equipos ópticos';
const MATERIAL_LASER = 'láser';
const MATERIAL_LENTE = 'lente';

const STRONG = [CONTENIDO, SABER, SABER_HACER, SABER_SER, 'Uso de láser y lente en el laboratorio.'].join(' ');
const GENERIC = 'Actividades generales del bloque formativo enfocadas en el trabajo colaborativo del grupo.';

const planningRow = {
  id: 'pl-1',
  teacher_id: 't-1',
  uac_name: 'Pensamiento Matemático III',
  semester: 1,
  component: 'fundamental',
  curriculum_name: 'Plan Demo 2026',
  paec_context: 'Problemática comunitaria de prueba',
  paec_project_name: 'Proyecto Demo',
  extracted_data: null,
  content_json: {
    sectionI: { teacherName: 'Mtra. Prueba', paecProjectName: 'Proyecto Demo' },
    sectionIV: {
      note: '',
      activities: [
        {
          name: 'Bloque 1: Fotónica aplicada',
          hours: 6,
          methodology: 'Aprendizaje basado en problemas',
          apertura: { activities: 'Lluvia de ideas inicial', processes: 'Discusión guiada', materials: 'láser, lente' },
          ejecucion: { activities: 'Práctica de laboratorio', processes: 'Experimentación por equipos', materials: '' },
          conclusion: { activities: 'Cierre y reflexión', processes: 'Síntesis grupal', materials: '' },
          contenidoFormativo: CONTENIDO,
          saberes: { saber: SABER, saberHacer: SABER_HACER, saberSer: SABER_SER },
        },
      ],
    },
  },
  status: 'generated',
  created_at: new Date('2026-10-01T00:00:00.000Z'),
  updated_at: new Date('2026-10-01T00:00:00.000Z'),
  metodologia_activa: null,
  evaluation_json: null,
  sequence_json: null,
};

const validationOk: QualityValidatorOutput = {
  accepted: true,
  qualityScore: 79,
  qualityWarning: false,
  failedWriters: [],
  retryableWriters: [],
  totalWordCount: 4500,
  warnings: [],
};

function makeSection(content: string): MissionSection {
  return {
    missionIndex: 1,
    title: 'Misión Formativa: Fotónica aplicada',
    coveredSessions: [1, 2],
    sessionTopic: 'Tema Demo',
    sessionFocus: content,
    phenomenonHook: { story: content, detonatingQuestion: '¿Cómo aplicar lo aprendido?' },
    conceptZero: { physicalAnalogy: 'Analogía de trabajo', coreExplanation: content },
    iDoSection: { stepByStepDemo: content },
    weDoSection: { guidedPractice: content, workbookElements: [] },
    youDoSection: { autonomousChallenge: content, workbookElements: [] },
    troubleshooting: [],
    formativeCheckpoint: { question: content, reflectionPrompts: [], criteriaChecklist: [] },
    wordCount: 1200,
  };
}

function makeOutput(type: WriterOutput['type'], content: string): WriterOutput {
  return {
    type,
    section: makeSection(content),
    wordCount: 1200,
    tokensUsed: 0,
    qualityScore: 85,
    warnings: [],
  };
}

function enqueue(fn: MockedFunction<(input: WriterInput) => Promise<WriterOutput>>, outputs: WriterOutput[]): void {
  fn.mockImplementation(async () => {
    const next = outputs.shift();
    if (!next) throw new Error('writer invocado más veces de lo encolado');
    return next;
  });
}

function stubBasePipeline(): void {
  vi.mocked(getPlanningById).mockResolvedValue(planningRow as never);
  vi.mocked(getTeacherById).mockResolvedValue({
    subsystem: 'Bachillerato General',
    name: 'Mtra. Prueba',
    school_name: 'Plantel Demo',
    municipality: 'Puebla',
    cct: '21ECT0017T',
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
    paecConnection: { communityProblem: 'Problemática comunitaria de prueba', projectName: 'Proyecto Demo' },
    studentProfile: { contextDescription: 'Estudiantes de prueba' },
    applicableNorms: [],
  } as never);
  vi.mocked(buildBlockBlueprint).mockReturnValue({
    sessions: [],
    missions: [{ sessionTopic: 'Tema Demo' }],
  } as never);
  vi.mocked(generateTroubleshootingMatrix).mockResolvedValue([] as never);
  vi.mocked(validateBlockGuideQuality).mockReturnValue(validationOk);
}

describe('block-guide-orchestrator — Fase 8.5: alineación dura + reintento dirigido', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubBasePipeline();
  });

  it('A: reintenta a los 4 writers con alignmentDirective y repara la alineación', async () => {
    enqueue(vi.mocked(generateFoundationMission), [makeOutput('foundation', GENERIC), makeOutput('foundation', STRONG)]);
    enqueue(vi.mocked(generateLabMission), [makeOutput('lab', GENERIC), makeOutput('lab', STRONG)]);
    enqueue(vi.mocked(generateProjectMission), [makeOutput('project', GENERIC), makeOutput('project', STRONG)]);
    enqueue(vi.mocked(generateEvaluationSection), [makeOutput('evaluation', GENERIC), makeOutput('evaluation', STRONG)]);

    const wb = await generateBlockWorkTextbook('pl-1', 0);

    expect(generateFoundationMission).toHaveBeenCalledTimes(2);
    expect(generateLabMission).toHaveBeenCalledTimes(2);
    expect(generateProjectMission).toHaveBeenCalledTimes(2);
    expect(generateEvaluationSection).toHaveBeenCalledTimes(2);

    const first = vi.mocked(generateFoundationMission).mock.calls[0][0] as WriterInput;
    const second = vi.mocked(generateFoundationMission).mock.calls[1][0] as WriterInput;
    expect(first.alignmentDirective).toBeUndefined();
    expect(second.alignmentDirective).toBeTypeOf('string');
    expect(second.alignmentDirective).toContain('fotónica cuántica aplicada');
    expect(second.alignmentDirective).toContain(MATERIAL_LASER);
    expect(second.alignmentDirective).toContain(MATERIAL_LENTE);

    expect(wb.planningAlignment?.pass).toBe(true);
    expect(wb.planningAlignment?.score).toBeGreaterThanOrEqual(90);
    expect(wb.qualityWarning).toBe(false);

    expect(updateWorkbookProgress).toHaveBeenCalledWith(
      'pl-1',
      0,
      expect.objectContaining({ percent: 92 })
    );
    expect(saveBlockWorkbook).toHaveBeenCalledTimes(1);
    expect(saveBlockWorkbook).toHaveBeenCalledWith(
      'pl-1',
      0,
      expect.objectContaining({
        planningAlignment: expect.objectContaining({ pass: true }),
      })
    );
    expect(saveCanonicalSeed).not.toHaveBeenCalled();
  }, 30000);

  it('B: si el reintento no repara, expone pass=false y qualityWarning=true', async () => {
    enqueue(vi.mocked(generateFoundationMission), [makeOutput('foundation', GENERIC), makeOutput('foundation', GENERIC)]);
    enqueue(vi.mocked(generateLabMission), [makeOutput('lab', GENERIC), makeOutput('lab', GENERIC)]);
    enqueue(vi.mocked(generateProjectMission), [makeOutput('project', GENERIC), makeOutput('project', GENERIC)]);
    enqueue(vi.mocked(generateEvaluationSection), [makeOutput('evaluation', GENERIC), makeOutput('evaluation', GENERIC)]);

    const wb = await generateBlockWorkTextbook('pl-1', 0);

    expect(generateFoundationMission).toHaveBeenCalledTimes(2);
    expect(generateEvaluationSection).toHaveBeenCalledTimes(2);

    expect(wb.planningAlignment?.pass).toBe(false);
    expect(wb.planningAlignment?.score).toBeLessThan(60);
    expect(wb.qualityWarning).toBe(true);
    expect(saveBlockWorkbook).toHaveBeenCalledTimes(1);
  }, 30000);

  it('C: sin huecos de alineación NO reintenta (1 llamada por writer)', async () => {
    enqueue(vi.mocked(generateFoundationMission), [makeOutput('foundation', STRONG)]);
    enqueue(vi.mocked(generateLabMission), [makeOutput('lab', STRONG)]);
    enqueue(vi.mocked(generateProjectMission), [makeOutput('project', STRONG)]);
    enqueue(vi.mocked(generateEvaluationSection), [makeOutput('evaluation', STRONG)]);

    const wb = await generateBlockWorkTextbook('pl-1', 0);

    expect(generateFoundationMission).toHaveBeenCalledTimes(1);
    expect(generateLabMission).toHaveBeenCalledTimes(1);
    expect(generateProjectMission).toHaveBeenCalledTimes(1);
    expect(generateEvaluationSection).toHaveBeenCalledTimes(1);

    expect(wb.planningAlignment?.pass).toBe(true);
    expect(wb.qualityWarning).toBe(false);
  }, 30000);
});
