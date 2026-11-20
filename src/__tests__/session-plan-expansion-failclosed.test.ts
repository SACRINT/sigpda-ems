import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  expandDeficientSessionPlans,
  SessionPlanExpansionError,
} from '@/lib/guide-engine/session-plan-expansion';
import {
  finalizeSessionPlans,
  SessionFinalizationDeficitError,
} from '@/lib/guide-engine/session-plan-finalizer';
import { generateMissingSessionPlans } from '@/lib/guide-engine/writers/session-plan-completion';
import {
  generateWithRotation,
  AiCooldownExhaustedError,
  AiServiceUnavailableError,
} from '@/lib/ai-provider';
import type { WriterOutput } from '@/lib/guide-engine/writers/writer-contract';
import type { SessionPlan } from '@/types/work-textbook';

vi.mock('@/lib/ai-provider', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ai-provider')>();
  return {
    ...actual,
    generateWithRotation: vi.fn(),
  };
});

const missionBudget = {
  targetWords: { min: 1125, ideal: 1188, max: 1250 },
  targetPages: { min: 3, ideal: 3, max: 3 },
  sessionsCount: 1,
};

function makeShortPlan(sessionNumber = 1, over: Partial<SessionPlan> = {}): SessionPlan {
  return {
    sessionNumber,
    objetivo: 'Analizar un proceso comunitario de forma autónoma y reflexiva.',
    motivacion: 'Motivación contextual breve.',
    saberesPrevios: 'Saberes previos breves.',
    contenido: 'Contenido demasiado breve para cubrir el mínimo editorial requerido.',
    ejemploResuelto: 'Ejemplo breve.',
    practica: [],
    aplicacion: 'Aplica este análisis al caso práctico de tu localidad con evidencia verificable.',
    autoevaluacion: [],
    recursos: [],
    productoIntegrador: 'Producto breve.',
    ...over,
  };
}

function makeOutput(type: WriterOutput['type'], wordCount = 120, plan?: SessionPlan): WriterOutput {
  const sessionPlan = plan ?? makeShortPlan(1);
  return {
    type,
    section: {
      sessionPlans: [sessionPlan],
      wordCount,
    },
    wordCount,
    tokensUsed: 0,
    qualityScore: 0,
    warnings: [],
  } as unknown as WriterOutput;
}

function baseExpansionParams(overrides: Record<string, unknown> = {}) {
  return {
    writerOutputs: [makeOutput('foundation', 120)],
    missionBudgets: {
      foundation: missionBudget,
      lab: missionBudget,
      project: missionBudget,
      evaluation: missionBudget,
    },
    blockTargetWords: { min: 1125, max: 1250 },
    uacName: 'Humanidades I',
    blockName: 'Bloque 1',
    subsystem: 'bge' as const,
    remainingBudgetMs: 90_000,
    ...overrides,
  };
}

describe('Tarea 2 — Cierre de éxitos silenciosos en expansión, finalizador y completion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('expandBatch falla con error no transitorio -> lanza SessionPlanExpansionError con telemetría (no retorna éxito vacío)', async () => {
    vi.mocked(generateWithRotation).mockRejectedValue(new Error('JSON truncado del modelo'));

    let caught: unknown;
    try {
      await expandDeficientSessionPlans(baseExpansionParams());
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(SessionPlanExpansionError);
    const err = caught as SessionPlanExpansionError;
    expect(err.failedBatches).toBe(1);
    expect(err.finalWords).toBe(120);
    expect(err.targetMinWords).toBe(1125);
    expect(err.shortfallWords).toBe(1005);
    expect(err.deficientMissions).toContain('foundation');
  });

  it('expandBatch propaga errores de capacidad/cuota (429/503/AiCooldownExhaustedError) sin tragarlos', async () => {
    vi.mocked(generateWithRotation).mockRejectedValueOnce(
      new AiCooldownExhaustedError('Todas las llaves en enfriamiento por cuota')
    );

    await expect(expandDeficientSessionPlans(baseExpansionParams())).rejects.toBeInstanceOf(
      AiCooldownExhaustedError
    );

    vi.mocked(generateWithRotation).mockRejectedValueOnce(
      new AiServiceUnavailableError('503 Service Unavailable')
    );

    await expect(expandDeficientSessionPlans(baseExpansionParams())).rejects.toBeInstanceOf(
      AiServiceUnavailableError
    );
  });

  it('expandDeficientSessionPlans con failOnDeficit: true lanza SessionPlanExpansionError aunque no haya fallos de lote si sigue < min', async () => {
    await expect(
      expandDeficientSessionPlans(
        baseExpansionParams({
          remainingBudgetMs: 10_000,
          failOnDeficit: true,
        })
      )
    ).rejects.toBeInstanceOf(SessionPlanExpansionError);
  });

  it('finalizeSessionPlans genera pista disciplinar neutral y reporta telemetría bloqueante cuando hay déficit', () => {
    const plan = makeShortPlan(1, { practica: [] });
    const output = makeOutput('lab', 980, plan);

    const telemetry = finalizeSessionPlans({
      writerOutputs: [output],
      missionBudgets: {
        foundation: missionBudget,
        lab: missionBudget,
        project: missionBudget,
        evaluation: missionBudget,
      },
      subsystem: 'bge',
      blockTargetMinWords: 1125,
    });

    expect(telemetry.addedPractices).toBe(1);
    expect(plan.practica[0].pista).not.toMatch(/incógnita|plantea la igualdad/i);
    expect(telemetry.withinTargetMin).toBe(false);
    expect(telemetry.totalWords).toBeLessThan(1125);
    expect(telemetry.underTargetMissions).toContain('lab');

    expect(() =>
      finalizeSessionPlans({
        writerOutputs: [makeOutput('lab', 1050, makeShortPlan(2, { aplicacion: 'Corta', objetivo: 'Corto', productoIntegrador: 'Corto', practica: [] }))],
        missionBudgets: {
          foundation: missionBudget,
          lab: missionBudget,
          project: missionBudget,
          evaluation: missionBudget,
        },
        subsystem: 'bge',
        blockTargetMinWords: 1125,
        failOnDeficit: true,
      })
    ).toThrow(SessionFinalizationDeficitError);
  });

  it('finalizeSessionPlans con failOnDeficit falla incluso en la franja histórica 90%-99% (< targetMinWords)', () => {
    const plan = makeShortPlan(1, {
      contenido: 'palabra '.repeat(550).trim(),
      ejemploResuelto: 'paso '.repeat(400).trim(),
    });
    // 1050 palabras está dentro del antiguo rango [0.90*1125=1013, 1124]
    const output = makeOutput('foundation', 1050, plan);

    expect(() =>
      finalizeSessionPlans({
        writerOutputs: [output],
        missionBudgets: {
          foundation: missionBudget,
          lab: missionBudget,
          project: missionBudget,
          evaluation: missionBudget,
        },
        subsystem: 'bge',
        blockTargetMinWords: 1125,
        failOnDeficit: true,
      })
    ).toThrow(/\[BlockIntegrity\]\[SessionPlanFinalizer\]/);
  });

  it('generateMissingSessionPlans propaga errores de capacidad en vez de devolver planes incompletos', async () => {
    vi.mocked(generateWithRotation).mockRejectedValueOnce(
      new AiCooldownExhaustedError('Cuota agotada en completion')
    );

    await expect(
      generateMissingSessionPlans({
        missionType: 'lab',
        uacName: 'Lenguaje y Comunicación I',
        blockName: 'Bloque 1',
        subsystem: 'bge',
        coveredSessions: [7],
        missingSessions: [7],
        existingPlans: [],
      })
    ).rejects.toBeInstanceOf(AiCooldownExhaustedError);
  });
});
