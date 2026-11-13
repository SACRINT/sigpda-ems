import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import type { SessionPlan } from '@/types/work-textbook';
import { AiCooldownExhaustedError } from '@/lib/ai-provider/key-rotator';

const mockAfter = vi.fn();
const mockAuth = vi.fn();
const mockGetTeacherByEmail = vi.fn();
const mockGetPlanningById = vi.fn();
const mockGetGenerationJobById = vi.fn();
const mockGetLatestGenerationJob = vi.fn();
const mockClaimGenerationJob = vi.fn();
const mockRenewGenerationJobLease = vi.fn();
const mockUpdateGenerationJobProgress = vi.fn();
const mockCompleteGenerationJob = vi.fn();
const mockFailGenerationJob = vi.fn();
const mockSaveBlockWorkbook = vi.fn();
const mockSaveGenerationJobCheckpoint = vi.fn();
const mockRequeueGenerationJob = vi.fn();
const mockGenerateBlockWorkTextbook = vi.fn();
const mockGenerateWithRotation = vi.fn();

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return {
    ...actual,
    after: (fn: unknown) => mockAfter(fn),
  };
});

vi.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}));

vi.mock('@/lib/db', () => ({
  getTeacherByEmail: (...args: unknown[]) => mockGetTeacherByEmail(...args),
  getPlanningById: (...args: unknown[]) => mockGetPlanningById(...args),
  getGenerationJobById: (...args: unknown[]) => mockGetGenerationJobById(...args),
  getLatestGenerationJob: (...args: unknown[]) => mockGetLatestGenerationJob(...args),
  claimGenerationJob: (...args: unknown[]) => mockClaimGenerationJob(...args),
  renewGenerationJobLease: (...args: unknown[]) => mockRenewGenerationJobLease(...args),
  updateGenerationJobProgress: (...args: unknown[]) => mockUpdateGenerationJobProgress(...args),
  completeGenerationJob: (...args: unknown[]) => mockCompleteGenerationJob(...args),
  failGenerationJob: (...args: unknown[]) => mockFailGenerationJob(...args),
  saveBlockWorkbook: (...args: unknown[]) => mockSaveBlockWorkbook(...args),
  saveGenerationJobCheckpoint: (...args: unknown[]) => mockSaveGenerationJobCheckpoint(...args),
  requeueGenerationJob: (...args: unknown[]) => mockRequeueGenerationJob(...args),
  WorkerLeaseLostError: class WorkerLeaseLostError extends Error {},
  JOB_LEASE_SECONDS: 90,
  JOB_MAX_DURATION_SECONDS: 270,
}));

vi.mock('@/lib/guide-engine/block-guide-orchestrator', () => ({
  generateBlockWorkTextbook: (...args: unknown[]) => mockGenerateBlockWorkTextbook(...args),
}));

vi.mock('@/lib/guide-engine/cascade-block-materials', () => ({
  cascadeBlockMaterials: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('@/lib/ai-provider', () => ({
  generateWithRotation: (...args: unknown[]) => mockGenerateWithRotation(...args),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { GET } from '@/app/api/planeaciones/[id]/libro-bloque/status/route';
import { processGenerationJob } from '@/lib/job-worker';
import {
  generateShardedSessionPlans,
  type SessionShardContext,
} from '@/lib/guide-engine/writers/session-shard';
import {
  computeContentBudget,
  resolveMissionBudgetsForBlueprint,
} from '@/lib/guide-engine/content-budget';
import type { WriterInput, WriterOutput } from '@/lib/guide-engine/writers/writer-contract';

function makeDensePlan(sessionNumber: number): SessionPlan {
  const longP = Array.from({ length: 190 }, (_, i) => `termino${i}`).join(' ');
  const exText = Array.from({ length: 90 }, (_, i) => `dato${i}`).join(' ');
  return {
    sessionNumber,
    objetivo: `Objetivo sesión ${sessionNumber} sobre modelación algebraica aplicada en Puebla.`,
    motivacion: `En Puebla estudiamos cómo resolver la situación real de la sesión ${sessionNumber} con herramientas de Pensamiento Matemático III y análisis cuantitativo comunitario concreto para transformar nuestro entorno escolar.`,
    saberesPrevios: `Recuperas conocimientos previos de variables, razones, proporciones y funciones lineales para abordar la sesión ${sessionNumber}.`,
    contenido: `Párrafo 1: ${longP}\n\nPárrafo 2: ${longP}\n\nPárrafo 3: ${longP}`,
    ejemploResuelto: `Planteamiento: Caso numérico de sesión ${sessionNumber}.\nPaso 1: Datos ${exText}.\nPaso 2: Ecuación ${exText}.\nPaso 3: Desarrollo ${exText}.\nPaso 4: Conclusión final verificada ${exText}.`,
    practica: [
      {
        enunciado: `Resuelve el problema contextualizado A para la sesión ${sessionNumber} en tu comunidad de Puebla determinando la tasa de cambio lineal, elaborando la tabla comparativa de valores experimentales medidos en campo y justificando cada etapa operacional paso a paso con sus unidades de medida.`,
        pista: 'Organiza primero las variables independientes y dependientes en una tabla antes de despejar.',
        solucion: ['Paso 1: Ordenar datos', 'Paso 2: Sustituir', 'Paso 3: Verificar unidades'],
      },
      {
        enunciado: `Analiza la gráfica experimental B correspondiente a la sesión ${sessionNumber}, interpreta el significado físico y comunitario de la pendiente entre dos intervalos consecutivos de recolección de datos y valida la coherencia algebraica y dimensional del resultado final obtenido.`,
        pista: 'Compara el cociente incremental entre dos puntos consecutivos de la tabla.',
        solucion: ['Paso 1: Calcular diferencia', 'Paso 2: Dividir incremento', 'Paso 3: Concluir'],
      },
    ],
    aplicacion: `En tu plantel de Puebla aplicas lo aprendido en sesión ${sessionNumber} al proyecto comunitario escolar con mediciones verificables y análisis sistemático.`,
    autoevaluacion: [`¿Puedo explicar el modelo de la sesión ${sessionNumber}?`],
    recursos: [
      { titulo: 'Khan Academy Álgebra', url: 'https://www.khanacademy.org/', tipo: 'video' },
    ],
    productoIntegrador: `Agrega la evidencia validada de sesión ${sessionNumber} al portafolio del bloque.`,
  };
}

function makeWriterOutput(
  type: WriterOutput['type'],
  coveredSessions: number[]
): WriterOutput {
  return {
    type,
    section: {
      missionIndex: 1,
      title: `Misión ${type}`,
      coveredSessions,
      sessionTopic: 'Tema',
      sessionFocus: 'Enfoque',
      sessionPlans: coveredSessions.map(makeDensePlan),
    } as unknown as WriterOutput['section'],
    qualityScore: 95,
    wordCount: coveredSessions.length * 1150,
    tokensUsed: 1200,
    warnings: [],
  };
}

describe('Resiliencia Integral: Status Backoff, Job Worker 24 Sesiones, Sharding Parcial y Presupuesto', () => {
  const teacherId = '11111111-1111-1111-1111-111111111111';
  const planningId = '22222222-2222-2222-2222-222222222222';
  const jobId = '33333333-3333-3333-3333-333333333333';
  const leaseId = '44444444-4444-4444-4444-444444444444';

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { email: 'docente@sems.puebla.gob.mx' } });
    mockGetTeacherByEmail.mockResolvedValue({ id: teacherId, email: 'docente@sems.puebla.gob.mx' });
    mockGetPlanningById.mockResolvedValue({ id: planningId, teacher_id: teacherId });
    mockRenewGenerationJobLease.mockResolvedValue(true);
    mockUpdateGenerationJobProgress.mockResolvedValue(true);
    mockSaveGenerationJobCheckpoint.mockResolvedValue(true);
    mockRequeueGenerationJob.mockResolvedValue(true);
    mockFailGenerationJob.mockResolvedValue(true);
  });

  it('status/route.ts respeta nextRetryAt en backoff y solo dispara el worker cuando vence el cooldown', async () => {
    const now = Date.now();
    // Caso A: en ventana de enfriamiento (nextRetryAt = +40s, aunque updated_at fue hace 15s)
    mockGetGenerationJobById.mockResolvedValueOnce({
      id: jobId,
      planning_id: planningId,
      block_index: 0,
      status: 'pending',
      progress: 45,
      current_phase: 'queued',
      current_step: 'Esperando enfriamiento de APIs IA (~45s)...',
      error: null,
      result: { nextRetryAt: new Date(now + 40_000).toISOString() },
      lease_until: null,
      updated_at: new Date(now - 15_000).toISOString(),
      created_at: new Date(now - 60_000).toISOString(),
    });

    const reqCooldown = new NextRequest(
      `http://localhost/api/planeaciones/${planningId}/libro-bloque/status?jobId=${jobId}`
    );
    const resCooldown = await GET(reqCooldown, { params: Promise.resolve({ id: planningId }) });
    expect(resCooldown.status).toBe(200);
    expect(mockClaimGenerationJob).not.toHaveBeenCalled();
    expect(mockAfter).not.toHaveBeenCalled();

    // Caso B: backoff expirado (nextRetryAt = -2s) -> sí reclama y agenda worker
    mockGetGenerationJobById.mockResolvedValueOnce({
      id: jobId,
      planning_id: planningId,
      block_index: 0,
      status: 'pending',
      progress: 45,
      current_phase: 'queued',
      current_step: 'Reanudando...',
      error: null,
      result: { nextRetryAt: new Date(now - 2_000).toISOString() },
      lease_until: null,
      updated_at: new Date(now - 15_000).toISOString(),
      created_at: new Date(now - 60_000).toISOString(),
    });
    mockClaimGenerationJob.mockResolvedValueOnce({ id: jobId, lease_id: leaseId });

    const reqReady = new NextRequest(
      `http://localhost/api/planeaciones/${planningId}/libro-bloque/status?jobId=${jobId}`
    );
    const resReady = await GET(reqReady, { params: Promise.resolve({ id: planningId }) });
    expect(resReady.status).toBe(200);
    expect(mockClaimGenerationJob).toHaveBeenCalledWith(jobId);
    expect(mockAfter).toHaveBeenCalledTimes(1);
  });

  it('job-worker reencola con backoff aunque haya 0 redactores completos si hay cooldown y preserva partialSessionPlans', async () => {
    const partialPlans = [makeDensePlan(16), makeDensePlan(17), makeDensePlan(18)];
    mockGetGenerationJobById
      .mockResolvedValueOnce({
        id: jobId,
        planning_id: planningId,
        teacher_id: teacherId,
        block_index: 0,
        status: 'running',
        result: { writerOutputs: [], attempts: 0, updatedAt: new Date().toISOString() },
      })
      .mockResolvedValueOnce({
        id: jobId,
        planning_id: planningId,
        teacher_id: teacherId,
        block_index: 0,
        status: 'pending',
      });

    mockGenerateBlockWorkTextbook.mockImplementationOnce(
      async (
        _planningId: string,
        _blockIndex: number,
        opts: {
          onPartialSessionPlansCheckpoint?: (
            t: WriterOutput['type'],
            plans: SessionPlan[]
          ) => Promise<void>;
        }
      ) => {
        await opts.onPartialSessionPlansCheckpoint?.('project', partialPlans);
        throw new AiCooldownExhaustedError(
          'Todas las claves de "gemini" están en enfriamiento por cuota (restan 38s). Cortando por deadline.'
        );
      }
    );

    const jobAfter = await processGenerationJob(jobId, leaseId);
    expect(jobAfter?.status).toBe('pending');
    expect(mockFailGenerationJob).not.toHaveBeenCalled();
    expect(mockRequeueGenerationJob).toHaveBeenCalledTimes(1);

    const [, requeuedCheckpoint, , resumeProgress, currentStep] =
      mockRequeueGenerationJob.mock.calls[0];
    expect(resumeProgress).toBe(30); // 25 + 5 por sesiones parciales
    expect(String(currentStep)).toContain('43s');
    expect(requeuedCheckpoint.partialSessionPlans.project).toHaveLength(3);
    expect(Date.parse(requeuedCheckpoint.nextRetryAt)).toBeGreaterThan(Date.now() + 35_000);
  });

  it('job-worker evicta dinámicamente por coveredSessions reales en bloque de 24 sesiones (sesión 11 -> lab)', async () => {
    const writers24: WriterOutput[] = [
      makeWriterOutput('foundation', [1, 2, 3]),
      makeWriterOutput('lab', [4, 5, 6, 7, 8, 9, 10, 11, 12]),
      makeWriterOutput('project', [13, 14, 15, 16, 17, 18, 19, 20, 21]),
      makeWriterOutput('evaluation', [22, 23, 24]),
    ];

    mockGetGenerationJobById
      .mockResolvedValueOnce({
        id: jobId,
        planning_id: planningId,
        teacher_id: teacherId,
        block_index: 0,
        status: 'running',
        result: { writerOutputs: writers24, attempts: 1, updatedAt: new Date().toISOString() },
      })
      .mockResolvedValueOnce({ id: jobId, status: 'pending' });

    mockGenerateBlockWorkTextbook.mockRejectedValueOnce(
      new Error('[BlockIntegrity] Contenido incompleto en Sesión afectada: 11')
    );

    await processGenerationJob(jobId, leaseId);
    expect(mockRequeueGenerationJob).toHaveBeenCalledTimes(1);
    const [, nextCheckpoint] = mockRequeueGenerationJob.mock.calls[0];
    const keptTypes = (nextCheckpoint.writerOutputs as WriterOutput[]).map((w) => w.type);
    expect(keptTypes).toEqual(['foundation', 'project', 'evaluation']);
  });

  it('session-shard corta de inmediato en AiCooldownExhaustedError sin rescate redundante y reanuda desde cachedSessionPlans', async () => {
    const savedSnapshots: SessionPlan[][] = [];
    const baseCtx: SessionShardContext = {
      input: {
        planning: { id: planningId, teacherId, uacName: 'PM III', semester: 3 } as WriterInput['planning'],
        blockIndex: 0,
        blockName: 'Bloque 1',
        sessions: Array.from({ length: 24 }, (_, idx) => ({
          sessionNumber: idx + 1,
          title: `Sesión ${idx + 1}`,
          phase: idx < 3 ? 'apertura' : idx < 21 ? 'desarrollo' : 'cierre',
        })) as unknown as WriterInput['sessions'],
        missions: [],
        paecContext: 'PAEC Escolar',
        studentProfile: 'BGE',
        subsystem: 'bge',
        uacName: 'Pensamiento Matemático III',
        targetWords: { min: 10125, ideal: 10688, max: 11250 },
        budgetDeadlineMs: Date.now() + 200_000,
        onPartialSessionPlans: (plans) => {
          savedSnapshots.push(plans);
        },
      },
      missionType: 'project',
      missionTitle: 'Misión 3',
      coveredSessions: [13, 14, 15, 16, 17, 18, 19, 20, 21],
      disciplineName: 'Pensamiento Matemático',
      fallbackContext: {
        uacName: 'Pensamiento Matemático III',
        blockName: 'Bloque 1',
        sessionTopic: 'Modelación',
        sessionFocus: 'Proyecto',
        paecContext: 'PAEC Escolar',
        subsystem: 'bge',
      },
      targetWordsPerPlan: 926,
    };

    // Pass 1: [16-18] triunfa, [13-15] y [19-21] caen en cooldown -> solo 1 llamada por paquete, cero rescate
    mockGenerateWithRotation.mockImplementation(async (_sys: string, userPrompt: string) => {
      const assignedMatch = userPrompt.match(/SESIONES QUE DEBES REDACTAR AHORA \([^:]+:\s*([^)]+)\)/);
      const assigned = assignedMatch?.[1] ?? '';
      if (assigned.includes('16, 17, 18')) {
        return JSON.stringify({
          sessionPlans: [makeDensePlan(16), makeDensePlan(17), makeDensePlan(18)],
        });
      }
      throw new AiCooldownExhaustedError(
        'Todas las claves de "gemini" están en enfriamiento por cuota (restan 30s). Cortando por deadline.'
      );
    });

    await expect(generateShardedSessionPlans(baseCtx)).rejects.toThrow(AiCooldownExhaustedError);
    // 3 packs exactamente (ni reintentos #2 ni paquetes -rescate)
    expect(mockGenerateWithRotation).toHaveBeenCalledTimes(3);
    expect(savedSnapshots).toHaveLength(1);
    expect(savedSnapshots[0].map((p) => p.sessionNumber)).toEqual([16, 17, 18]);

    // Pass 2: Reanudar con cachedSessionPlans=[16,17,18] -> solo pide [13-15] y [19-21]
    mockGenerateWithRotation.mockClear();
    mockGenerateWithRotation.mockImplementation(async (_sys: string, userPrompt: string) => {
      const assignedMatch = userPrompt.match(/SESIONES QUE DEBES REDACTAR AHORA \([^:]+:\s*([^)]+)\)/);
      const assigned = assignedMatch?.[1] ?? '';
      if (assigned.includes('13')) {
        return JSON.stringify({
          sessionPlans: [makeDensePlan(13), makeDensePlan(14), makeDensePlan(15)],
        });
      }
      return JSON.stringify({
        sessionPlans: [makeDensePlan(19), makeDensePlan(20), makeDensePlan(21)],
      });
    });

    const resumed = await generateShardedSessionPlans({
      ...baseCtx,
      input: {
        ...baseCtx.input,
        cachedSessionPlans: savedSnapshots[0],
      },
    });

    expect(mockGenerateWithRotation).toHaveBeenCalledTimes(2);
    expect(resumed.plans.map((p) => p.sessionNumber)).toEqual([
      13, 14, 15, 16, 17, 18, 19, 20, 21,
    ]);
  });

  it('resolveMissionBudgetsForBlueprint alinea el presupuesto de 24 sesiones al reparto real [3, 9, 9, 3]', () => {
    const budget24 = computeContentBudget(4);
    expect(budget24.sessionsPerBlock).toBe(24);

    const aligned = resolveMissionBudgetsForBlueprint(budget24, [
      { missionType: 'foundation', sessionNumbers: [1, 2, 3] },
      { missionType: 'lab', sessionNumbers: [4, 5, 6, 7, 8, 9, 10, 11, 12] },
      { missionType: 'project', sessionNumbers: [13, 14, 15, 16, 17, 18, 19, 20, 21] },
      { missionType: 'evaluation', sessionNumbers: [22, 23, 24] },
    ]);

    expect(aligned.foundation.sessionsCount).toBe(3);
    expect(aligned.foundation.targetWords.min).toBe(3375);
    expect(aligned.lab.sessionsCount).toBe(9);
    expect(aligned.lab.targetWords.min).toBe(10125);
    expect(aligned.project.sessionsCount).toBe(9);
    expect(aligned.project.targetWords.min).toBe(10125);
    expect(aligned.evaluation.sessionsCount).toBe(3);
    expect(aligned.evaluation.targetWords.min).toBe(3375);
  });
});
