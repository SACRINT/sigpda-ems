import { describe, it, expect } from 'vitest';
import { normalizeEvaluationPercentages } from '@/lib/planning/quality-pipeline';

describe('normalizeEvaluationPercentages — Normalizador Determinista 100%', () => {
  it('Caso 1: Normaliza el exceso canónico del 120% (Diagnóstica 20%, Formativa 50%, Sumativa 50%) a exactamente 100%', () => {
    const input = [
      { type: 'Diagnóstica', percentage: 20, evidence: 'Cuestionario' },
      { type: 'Formativa', percentage: 50, evidence: 'Bitácora' },
      { type: 'Sumativa', percentage: 50, evidence: 'Proyecto' },
    ];

    const result = normalizeEvaluationPercentages(input);
    const sum = result.reduce((acc, curr) => acc + curr.percentage, 0);

    expect(sum).toBe(100);
    // Diagnóstica debe haber sido reducida a su cota NEM de 5%
    const diag = result.find(e => e.type === 'Diagnóstica');
    expect(diag?.percentage).toBe(5);
    // Formativa y Sumativa se reparten el 95% restante
    const formativa = result.find(e => e.type === 'Formativa');
    const sumativa = result.find(e => e.type === 'Sumativa');
    expect(formativa!.percentage + sumativa!.percentage).toBe(95);
  });

  it('Caso 2: Normaliza el déficit del 80% (Diagnóstica 5%, Formativa 40%, Sumativa 35%) a exactamente 100%', () => {
    const input = [
      { type: 'Diagnóstica', percentage: 5 },
      { type: 'Formativa', percentage: 40 },
      { type: 'Sumativa', percentage: 35 },
    ];

    const result = normalizeEvaluationPercentages(input);
    const sum = result.reduce((acc, curr) => acc + curr.percentage, 0);

    expect(sum).toBe(100);
    const diag = result.find(e => e.type === 'Diagnóstica');
    expect(diag?.percentage).toBe(5);
  });

  it('Caso 3: Preserva una distribución válida que ya suma 100% con diagnóstica moderada', () => {
    const input = [
      { type: 'Diagnóstica', percentage: 5 },
      { type: 'Formativa', percentage: 55 },
      { type: 'Sumativa', percentage: 40 },
    ];

    const result = normalizeEvaluationPercentages(input);
    const sum = result.reduce((acc, curr) => acc + curr.percentage, 0);

    expect(sum).toBe(100);
    expect(result[0].percentage).toBe(5);
    expect(result[1].percentage).toBe(55);
    expect(result[2].percentage).toBe(40);
  });

  it('Caso 4: Maneja arreglos vacíos o nulos retornando la escala canónica oficial DBEPA', () => {
    const fromNull = normalizeEvaluationPercentages(null);
    expect(fromNull.reduce((acc, curr) => acc + curr.percentage, 0)).toBe(100);
    expect(fromNull).toHaveLength(3);
    expect(fromNull[0].type).toBe('Diagnóstica');
    expect(fromNull[0].percentage).toBe(5);

    const fromEmpty = normalizeEvaluationPercentages<{ percentage: number; type?: string }>([]);
    expect(fromEmpty.reduce((acc, curr) => acc + curr.percentage, 0)).toBe(100);
  });

  it('Caso 5: Sanitiza valores atípicos con NaN o números negativos asegurando suma = 100%', () => {
    const input = [
      { type: 'Diagnóstica', percentage: -10 },
      { type: 'Formativa', percentage: NaN as unknown as number },
      { type: 'Sumativa', percentage: 30 },
    ];

    const result = normalizeEvaluationPercentages(input);
    const sum = result.reduce((acc, curr) => acc + curr.percentage, 0);

    expect(sum).toBe(100);
    for (const item of result) {
      expect(item.percentage).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(item.percentage)).toBe(true);
    }
  });

  it('Caso 6: Ajusta un solo elemento incompleto a 100%', () => {
    const input = [{ type: 'Formativa', percentage: 70 }];
    const result = normalizeEvaluationPercentages(input);
    expect(result[0].percentage).toBe(100);
  });

  it('Caso 7: Si la diagnóstica excede el 10% aunque la suma sea 100%, la reequilibra hacia formativa/sumativa', () => {
    const input = [
      { type: 'Diagnóstica', percentage: 25 },
      { type: 'Formativa', percentage: 40 },
      { type: 'Sumativa', percentage: 35 },
    ];

    const result = normalizeEvaluationPercentages(input);
    const sum = result.reduce((acc, curr) => acc + curr.percentage, 0);

    expect(sum).toBe(100);
    const diag = result.find(e => e.type === 'Diagnóstica');
    expect(diag!.percentage).toBeLessThanOrEqual(5);
  });
});
