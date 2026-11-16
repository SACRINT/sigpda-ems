/**
 * Regresión del piso de presupuesto de expandDeficientSessionPlans.
 *
 * El orquestador permite iniciar la expansión de expandOnly con 30s restantes,
 * pero el módulo conservaba un piso interno de 45s y descartaba el lote. Estos
 * tests fijan el contrato: sin minRemainingBudgetMs se conserva el piso 45s;
 * con minRemainingBudgetMs=30s el lote se ejecuta.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  compactOversizedSessionPlans,
  expandDeficientSessionPlans,
} from '@/lib/guide-engine/session-plan-expansion';
import { generateWithRotation } from '@/lib/ai-provider';
import { countSessionPlanWords } from '@/lib/guide-engine/content-budget';
import type { WriterOutput } from '@/lib/guide-engine/writers/writer-contract';
import type { SessionPlan } from '@/types/work-textbook';

vi.mock('@/lib/ai-provider', () => ({
  generateWithRotation: vi.fn(),
}));

const missionBudget = {
  targetWords: { min: 1125, ideal: 1188, max: 1250 },
  targetPages: { min: 3, ideal: 3, max: 3 },
  sessionsCount: 1,
};

function makeDeficientOutput(): WriterOutput {
  return {
    type: 'foundation',
    section: {
      sessionPlans: [
        {
          sessionNumber: 1,
          objetivo: 'Objetivo breve',
          motivacion: 'Motivación breve',
          saberesPrevios: 'Saberes previos breves',
          contenido: 'Contenido breve',
          ejemploResuelto: 'Ejemplo breve',
          practica: [],
          aplicacion: 'Aplicación breve',
          autoevaluacion: [],
          recursos: [],
          productoIntegrador: 'Producto breve',
        },
      ],
      wordCount: 20,
    },
    wordCount: 20,
    tokensUsed: 0,
    qualityScore: 0,
    warnings: [],
  } as unknown as WriterOutput;
}

function buildParams(overrides: Record<string, unknown> = {}) {
  return {
    writerOutputs: [makeDeficientOutput()],
    missionBudgets: {
      foundation: missionBudget,
      lab: missionBudget,
      project: missionBudget,
      evaluation: missionBudget,
    },
    blockTargetWords: { min: 1125, max: 1250 },
    uacName: 'Pensamiento Matemático III',
    blockName: 'Bloque 1',
    subsystem: 'bge' as const,
    remainingBudgetMs: 40_000,
    ...overrides,
  };
}

const expandedResponse = JSON.stringify({
  sessionPlans: [
    {
      sessionNumber: 1,
      contenido: 'palabra '.repeat(800).trim(),
      ejemploResuelto: 'paso '.repeat(500).trim(),
    },
  ],
});

describe('expandDeficientSessionPlans — piso de presupuesto', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(generateWithRotation).mockResolvedValue(expandedResponse);
  });

  it('conserva el piso histórico de 45s si no se recibe minRemainingBudgetMs', async () => {
    const result = await expandDeficientSessionPlans(buildParams());

    expect(generateWithRotation).not.toHaveBeenCalled();
    expect(result).toEqual({ expandedPlans: 0, addedWords: 0 });
  });

  it('ejecuta la expansión con 40s restantes cuando expandOnly fija el piso en 30s', async () => {
    const result = await expandDeficientSessionPlans(
      buildParams({ minRemainingBudgetMs: 30_000 })
    );

    expect(generateWithRotation).toHaveBeenCalledTimes(1);
    expect(result.expandedPlans).toBeGreaterThan(0);
    expect(result.addedWords).toBeGreaterThan(0);
  });
});

function sentence(prefix: string, index: number, words: number): string {
  const body = Array.from({ length: Math.max(1, words - 1) }, (_, i) => `${prefix}${index}${i}`).join(' ');
  return `${body} con datos ${index}.`;
}

function makeSessionPlan(sessionNumber: number): SessionPlan {
  return {
    sessionNumber,
    objetivo: sentence('objetivo', sessionNumber, 12),
    motivacion: sentence('motivacion', sessionNumber, 60),
    saberesPrevios: sentence('saberes', sessionNumber, 40),
    contenido: Array.from({ length: 20 }, (_, i) => sentence('contenido', sessionNumber * 100 + i, 15)).join(' '),
    ejemploResuelto: Array.from({ length: 10 }, (_, i) => sentence('ejemplo', sessionNumber * 100 + i, 20)).join(' '),
    practica: [
      {
        enunciado: sentence('practica', sessionNumber, 30),
        pista: sentence('pista', sessionNumber, 20),
      },
    ],
    aplicacion: sentence('aplicacion', sessionNumber, 30),
    autoevaluacion: [sentence('autoevaluacion', sessionNumber, 12)],
    recursos: [{ titulo: 'Recurso de ampliación', url: 'https://example.com', tipo: 'web' }],
    productoIntegrador: sentence('producto', sessionNumber, 20),
  };
}

function makeOversizedOutput(): WriterOutput {
  const plans = [makeSessionPlan(1), makeSessionPlan(2)];
  const wordCount = plans.reduce((acc, plan) => acc + countSessionPlanWords(plan), 0);
  return {
    type: 'foundation',
    section: { sessionPlans: plans, wordCount },
    wordCount,
    tokensUsed: 0,
    qualityScore: 80,
    warnings: [],
  } as unknown as WriterOutput;
}

describe('compactOversizedSessionPlans', () => {
  const missionBudget = {
    targetWords: { min: 400, ideal: 450, max: 500 },
    targetPages: { min: 1, ideal: 1, max: 1 },
    sessionsCount: 1,
  };

  it('recorta un bloque excedido sin cruzar el mínimo ni romper los planes', () => {
    const output = makeOversizedOutput();
    const before = output.wordCount;

    const result = compactOversizedSessionPlans({
      writerOutputs: [output],
      missionBudgets: {
        foundation: missionBudget,
        lab: missionBudget,
        project: missionBudget,
        evaluation: missionBudget,
      },
      blockTargetWords: { min: 800, max: 1000 },
      subsystem: 'bge',
    });

    expect(result.removedWords).toBeGreaterThan(0);
    expect(output.wordCount).toBeLessThan(before);
    expect(output.wordCount).toBeLessThanOrEqual(1000);
    expect(output.wordCount).toBeGreaterThanOrEqual(800);
    expect(output.wordCount).toBe(output.section.wordCount);
    expect(output.section.sessionPlans?.map((plan) => plan.sessionNumber)).toEqual([1, 2]);
    for (const plan of output.section.sessionPlans || []) {
      expect(plan.contenido.trim().length).toBeGreaterThan(0);
      expect(plan.ejemploResuelto.trim().length).toBeGreaterThan(0);
    }
  });

  it('no modifica un bloque dentro del máximo formal', () => {
    const output = makeOversizedOutput();
    output.wordCount = 700;
    output.section.wordCount = 700;
    const before = JSON.stringify(output);

    const result = compactOversizedSessionPlans({
      writerOutputs: [output],
      missionBudgets: {
        foundation: missionBudget,
        lab: missionBudget,
        project: missionBudget,
        evaluation: missionBudget,
      },
      blockTargetWords: { min: 600, max: 1000 },
      subsystem: 'bge',
    });

    expect(result).toEqual({ compactedPlans: 0, removedWords: 0 });
    expect(JSON.stringify(output)).toBe(before);
  });

  it('respeta la tolerancia editorial si el exceso no supera el umbral de disparo', () => {
    const output = makeOversizedOutput();
    const before = JSON.stringify(output);

    const result = compactOversizedSessionPlans({
      writerOutputs: [output],
      missionBudgets: {
        foundation: missionBudget,
        lab: missionBudget,
        project: missionBudget,
        evaluation: missionBudget,
      },
      blockTargetWords: { min: 800, max: 1000 },
      triggerWords: 2000,
      subsystem: 'bge',
    });

    expect(result).toEqual({ compactedPlans: 0, removedWords: 0 });
    expect(JSON.stringify(output)).toBe(before);
  });
});
