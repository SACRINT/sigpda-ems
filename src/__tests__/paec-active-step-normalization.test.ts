import { describe, it, expect } from 'vitest';
import { getVisibleSteps, normalizeActiveStep, getRelativeStepNumber, canNavigateStep } from '@/lib/paec-steps';
import type { CycleType } from '@/types/paec';

describe('F-R8-04: Normalización de activeStep y límites de navegación por ciclo', () => {
  describe('normalizeActiveStep', () => {
    it('en Ciclo B, si el proyecto tiene current_step=8, abre en el paso 9 (siguiente paso visible)', () => {
      const step = normalizeActiveStep(8, 'B');
      expect(step).toBe(9);
      const visibleB = getVisibleSteps('B');
      expect(visibleB.some((s) => s.num === step)).toBe(true);
    });

    it('en Ciclo B, si el proyecto tiene current_step=6, abre en el paso 7', () => {
      const step = normalizeActiveStep(6, 'B');
      expect(step).toBe(7);
      const visibleB = getVisibleSteps('B');
      expect(visibleB.some((s) => s.num === step)).toBe(true);
    });

    it('en Ciclo A, si el proyecto tiene current_step=7, abre en el paso 8', () => {
      const step = normalizeActiveStep(7, 'A');
      expect(step).toBe(8);
      const visibleA = getVisibleSteps('A');
      expect(visibleA.some((s) => s.num === step)).toBe(true);
    });

    it('en Ciclo A, si el proyecto tiene current_step=9, se acota al último paso visible (paso 8)', () => {
      const step = normalizeActiveStep(9, 'A');
      expect(step).toBe(8);
      const visibleA = getVisibleSteps('A');
      expect(visibleA.some((s) => s.num === step)).toBe(true);
    });

    it('en Ciclo Annual, preserva fielmente todos los pasos del 1 al 9', () => {
      for (let s = 1; s <= 9; s++) {
        expect(normalizeActiveStep(s, 'annual')).toBe(s);
      }
    });

    it('maneja valores indefinidos, nulos o cero devolviendo el paso inicial 1', () => {
      expect(normalizeActiveStep(undefined, 'A')).toBe(1);
      expect(normalizeActiveStep(null, 'B')).toBe(1);
      expect(normalizeActiveStep(0, 'annual')).toBe(1);
    });
  });

  describe('Invariantes de Stepper y Badge Relativo', () => {
    const cycles: CycleType[] = ['A', 'B', 'annual'];

    it('para cualquier step 1..9 en cualquier ciclo, normalizeActiveStep siempre devuelve un paso visible', () => {
      cycles.forEach((cycle) => {
        const visible = getVisibleSteps(cycle);
        for (let s = 1; s <= 9; s++) {
          const normalized = normalizeActiveStep(s, cycle);
          const found = visible.find((v) => v.num === normalized);
          expect(found).toBeDefined();

          const idx = visible.findIndex((v) => v.num === normalized);
          expect(idx).toBeGreaterThanOrEqual(0);
          expect(idx).toBeLessThan(visible.length);

          // Invariante del badge: el índice visible relativo jamás supera el total de pasos visibles
          const displayStep = getRelativeStepNumber(visible, normalized);
          expect(displayStep).toBeLessThanOrEqual(visible.length);
          expect(displayStep).toBeGreaterThanOrEqual(1);
        }
      });
    });

    it('resuelve correctamente la navegación hacia pasos con saltos de ciclo (5->7 en B y 6->8 en A)', () => {
      // Ciclo B: después de generar paso 5, el paso 7 debe tener como paso previo visible el 5
      const visibleB = getVisibleSteps('B');
      const idxStep7 = visibleB.findIndex((s) => s.num === 7);
      expect(idxStep7).toBeGreaterThan(0);
      const prevStep7 = visibleB[idxStep7 - 1];
      expect(prevStep7.num).toBe(5);

      // Ciclo A: después de generar paso 6, el paso 8 debe tener como paso previo visible el 6
      const visibleA = getVisibleSteps('A');
      const idxStep8 = visibleA.findIndex((s) => s.num === 8);
      expect(idxStep8).toBeGreaterThan(0);
      const prevStep8 = visibleA[idxStep8 - 1];
      expect(prevStep8.num).toBe(6);
    });
  });

  describe('F-R9-02: Función pura canNavigateStep y lógica de navegación de pasos', () => {
    it('paso 1 siempre está libre independientemente de pasos generados o currentStep', () => {
      const visibleA = getVisibleSteps('A');
      const visibleB = getVisibleSteps('B');
      const visibleAnnual = getVisibleSteps('annual');
      const noStepsGen = () => false;

      expect(canNavigateStep(visibleA, 0, noStepsGen, null)).toBe(true);
      expect(canNavigateStep(visibleB, 0, noStepsGen, undefined)).toBe(true);
      expect(canNavigateStep(visibleAnnual, 0, noStepsGen, 1)).toBe(true);
    });

    it('Ciclo B: salto (5->7) se desbloquea tras generar el paso 5', () => {
      const visibleB = getVisibleSteps('B');
      const idxStep7 = visibleB.findIndex((s) => s.num === 7);
      expect(idxStep7).toBeGreaterThan(0);

      // Paso 5 generado -> paso 7 desbloqueado
      const isStep5Generated = (n: number) => n === 5;
      expect(canNavigateStep(visibleB, idxStep7, isStep5Generated, 1)).toBe(true);

      // Paso 5 NO generado y currentStep=1 -> paso 7 bloqueado
      const isStep5NotGenerated = (n: number) => n < 5;
      expect(canNavigateStep(visibleB, idxStep7, isStep5NotGenerated, 1)).toBe(false);
    });

    it('Ciclo B: salto (7->9) queda bloqueado sin generar el paso 7 y se desbloquea tras generarlo', () => {
      const visibleB = getVisibleSteps('B');
      const idxStep9 = visibleB.findIndex((s) => s.num === 9);
      expect(idxStep9).toBeGreaterThan(0);

      // Paso 7 NO generado (solo generados hasta 5) y currentStep=1 -> paso 9 bloqueado
      const onlyUpToStep5Generated = (n: number) => n <= 5;
      expect(canNavigateStep(visibleB, idxStep9, onlyUpToStep5Generated, 1)).toBe(false);

      // Paso 7 generado -> paso 9 desbloqueado
      const step7Generated = (n: number) => n === 7;
      expect(canNavigateStep(visibleB, idxStep9, step7Generated, 1)).toBe(true);
    });

    it('Ciclo A: salto (6->8) se desbloquea tras generar el paso 6 y queda bloqueado sin él', () => {
      const visibleA = getVisibleSteps('A');
      const idxStep8 = visibleA.findIndex((s) => s.num === 8);
      expect(idxStep8).toBeGreaterThan(0);

      // Paso 6 generado -> paso 8 desbloqueado
      const isStep6Generated = (n: number) => n === 6;
      expect(canNavigateStep(visibleA, idxStep8, isStep6Generated, 1)).toBe(true);

      // Paso 6 NO generado y currentStep=1 -> paso 8 bloqueado
      const isStep6NotGenerated = (n: number) => n < 6;
      expect(canNavigateStep(visibleA, idxStep8, isStep6NotGenerated, 1)).toBe(false);
    });

    it('desbloquea navegación hacia cualquier paso ya generado (isDone) o menor o igual a currentStep', () => {
      const visibleAnnual = getVisibleSteps('annual');
      const idxStep4 = visibleAnnual.findIndex((s) => s.num === 4);

      // Paso 4 marcado como generado -> navegable
      expect(canNavigateStep(visibleAnnual, idxStep4, (n) => n === 4, 1)).toBe(true);

      // Paso 4 con currentStep=5 -> navegable aun sin estar marcado como generado
      expect(canNavigateStep(visibleAnnual, idxStep4, () => false, 5)).toBe(true);
    });

    it('retorna false si el índice solicitado no existe en visibleSteps', () => {
      const visibleA = getVisibleSteps('A');
      expect(canNavigateStep(visibleA, -1, () => true, 9)).toBe(false);
      expect(canNavigateStep(visibleA, 999, () => true, 9)).toBe(false);
    });
  });
});
