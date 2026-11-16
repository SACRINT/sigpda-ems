import { describe, expect, it } from 'vitest';
import { finalizeSessionPlans } from '@/lib/guide-engine/session-plan-finalizer';
import { countSessionPlanWords } from '@/lib/guide-engine/content-budget';
import { hasDanglingEnding } from '@/lib/editorial/pedagogical-text-fitter';
import type { WriterOutput } from '@/lib/guide-engine/writers/writer-contract';
import type { SessionPlan } from '@/types/work-textbook';

function makePlan(): SessionPlan {
  return {
    sessionNumber: 13,
    objetivo: 'Analizar costos fijos y variables de un espacio recreativo de la comunidad.',
    motivacion: 'En tu comunidad existen costos que no cambian y otros que dependen del uso.',
    saberesPrevios: 'Reconoces la diferencia entre una cantidad fija y una cantidad variable.',
    contenido:
      'Una igualdad algebraica permite modelar el costo total de un servicio cuando existe un cargo fijo y un cargo variable por unidad utilizada. El planteamiento correcto separa ambos componentes antes de despejar la incógnita.',
    ejemploResuelto:
      'Un comité paga 500 pesos de envío y 1200 pesos por cada juego de barras. Si el presupuesto es de 12500 pesos, la ecuación es 1200x + 500 = 12500. Al despejar se obtiene x = 10. La respuesta se verifica sustituyendo el valor en la ecuación original.',
    practica: [],
    aplicacion:
      'Identifica un costo fijo y un costo variable en un espacio deportivo cercano y modela el gasto total.',
    autoevaluacion: ['¿Distingo un costo fijo de un costo variable?'],
    recursos: [{ titulo: 'Calculadora', url: 'https://example.com', tipo: 'web' }],
    productoIntegrador: 'Agrega el modelo de costos a tu bitácora del proyecto.',
  };
}

function makeOutput(plan: SessionPlan): WriterOutput {
  const words = countSessionPlanWords(plan);
  return {
    type: 'foundation',
    section: { sessionPlans: [plan], wordCount: words },
    wordCount: words,
    tokensUsed: 0,
    qualityScore: 80,
    warnings: [],
  } as unknown as WriterOutput;
}

describe('finalizeSessionPlans', () => {
  it('repara colas truncadas y completa la práctica faltante sin IA', () => {
    const plan = makePlan();
    plan.contenido = 'La explicación termina en una preposición de';
    plan.aplicacion = 'Aplica el modelo en tu comunidad con';
    const output = makeOutput(plan);
    const before = output.wordCount;

    const result = finalizeSessionPlans({
      writerOutputs: [output],
      missionBudgets: {
        foundation: {
          targetWords: { min: 100, ideal: 120, max: 140 },
          targetPages: { min: 1, ideal: 1, max: 1 },
          sessionsCount: 1,
        },
        lab: {
          targetWords: { min: 100, ideal: 120, max: 140 },
          targetPages: { min: 1, ideal: 1, max: 1 },
          sessionsCount: 1,
        },
        project: {
          targetWords: { min: 100, ideal: 120, max: 140 },
          targetPages: { min: 1, ideal: 1, max: 1 },
          sessionsCount: 1,
        },
        evaluation: {
          targetWords: { min: 100, ideal: 120, max: 140 },
          targetPages: { min: 1, ideal: 1, max: 1 },
          sessionsCount: 1,
        },
      },
      subsystem: 'bge',
    });

    expect(result.repairedFields).toBeGreaterThan(0);
    expect(result.addedPractices).toBe(1);
    expect(plan.practica).toHaveLength(1);
    expect(plan.practica[0]?.enunciado.length).toBeGreaterThan(40);
    expect(hasDanglingEnding(plan.contenido)).toBe(false);
    expect(hasDanglingEnding(plan.aplicacion)).toBe(false);
    expect(output.wordCount).toBe(countSessionPlanWords(plan));
    expect(output.wordCount).toBeLessThanOrEqual(before + 80);
  });
});
