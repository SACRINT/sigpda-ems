/**
 * Regresión del piso de presupuesto de expandDeficientSessionPlans.
 *
 * El orquestador permite iniciar la expansión de expandOnly con 30s restantes,
 * pero el módulo conservaba un piso interno de 45s y descartaba el lote. Estos
 * tests fijan el contrato: sin minRemainingBudgetMs se conserva el piso 45s;
 * con minRemainingBudgetMs=30s el lote se ejecuta.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { expandDeficientSessionPlans } from '@/lib/guide-engine/session-plan-expansion';
import { generateWithRotation } from '@/lib/ai-provider';
import type { WriterOutput } from '@/lib/guide-engine/writers/writer-contract';

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
