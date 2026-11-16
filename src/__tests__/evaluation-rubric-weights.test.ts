import { describe, expect, it } from 'vitest';
import {
  buildRubricDescription,
  ensureChecklistCoversSaberes,
  normalizeRubricWeights,
} from '@/lib/guide-engine/writers/evaluation-writer';
import type { EvaluationRubricCriterion } from '@/types/work-textbook';

function criterion(weightPercent: number): EvaluationRubricCriterion {
  return {
    criterion: `Criterio ${weightPercent}`,
    weightPercent,
    levels: [
      { levelName: 'Excelente', points: 10, descriptor: 'Dominio completo.' },
      { levelName: 'Bueno', points: 8, descriptor: 'Dominio suficiente.' },
      { levelName: 'Suficiente', points: 6, descriptor: 'Cumple lo básico.' },
      { levelName: 'Requiere Apoyo', points: 4, descriptor: 'Requiere apoyo.' },
    ],
  };
}

describe('normalizeRubricWeights', () => {
  it('convierte una rúbrica de un solo criterio a 100%', () => {
    const result = normalizeRubricWeights([criterion(25)]);
    expect(result).toHaveLength(1);
    expect(result[0]?.weightPercent).toBe(100);
  });

  it('el texto derivado de la misión usa la ponderación normalizada', () => {
    const rubric = normalizeRubricWeights([criterion(25)]);
    const description = buildRubricDescription(rubric);
    expect(description).toContain('Ponderación: 100%');
    expect(description).not.toContain('Ponderación: 25%');
  });

  it('normaliza varios criterios para que sumen exactamente 100%', () => {
    const result = normalizeRubricWeights([criterion(25), criterion(25), criterion(25), criterion(25)]);
    expect(result.reduce((acc, item) => acc + item.weightPercent, 0)).toBeCloseTo(100, 1);
  });

  it('reparte equitativamente si el generador devuelve pesos en cero', () => {
    const result = normalizeRubricWeights([criterion(0), criterion(0), criterion(0)]);
    expect(result.reduce((acc, item) => acc + item.weightPercent, 0)).toBeCloseTo(100, 1);
  });

  it('agrega a la lista de cotejo los saberes que la rúbrica no cubre', () => {
    const checklist = [{ item: 'Revisa el procedimiento.', category: 'Técnica' }];
    const rubric = [criterion(100)];
    const result = ensureChecklistCoversSaberes(checklist, rubric, {
      saberes: {
        saber: 'Comprende el concepto de igualdad algebraica',
        saberHacer: 'Resuelve ecuaciones lineales con una incógnita',
        saberSer: 'Muestra rigor metódico en la verificación',
      },
    } as never);

    expect(result.some((item) => item.category === 'Saberes')).toBe(true);
    expect(result.some((item) => item.item.includes('igualdad algebraica'))).toBe(true);
  });
});
