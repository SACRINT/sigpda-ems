import { describe, it, expect } from 'vitest';
import { getVisibleSteps, normalizeActiveStep } from '@/app/[locale]/paec/nuevo/PaecWizardClient';
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
          const displayStep = idx >= 0 ? idx + 1 : 1;
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
});
