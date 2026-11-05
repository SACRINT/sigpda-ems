/**
 * content-budget.test.ts
 *
 * Pruebas unitarias de la fórmula única de presupuesto editorial por sesiones (Fase P3).
 * Valida la tabla de 1 a 5 horas/semana, proporciones por misión y validación de cobertura.
 */

import { describe, it, expect } from 'vitest';
import {
  computeContentBudget,
  resolveWeeklyHours,
  countSessionPlanWords,
  validateSessionCoverage,
  WORDS_PER_PAGE,
} from '@/lib/guide-engine/content-budget';

describe('P3 — content-budget.ts (Fórmula única de presupuesto editorial)', () => {
  describe('1. Tabla canónica de calibración por horas semanales', () => {
    it('1 h/semana -> 6 sesiones, 15-17 páginas, 6,750-7,500 palabras', () => {
      const budget = computeContentBudget(1);

      expect(budget.weeklyHours).toBe(1);
      expect(budget.sessionsPerBlock).toBe(6);

      expect(budget.targetPages.min).toBe(15); // 6 * 2.5
      expect(budget.targetPages.max).toBe(17); // Math.round(6 * (50/18)) = 17
      expect(budget.targetPages.ideal).toBe(16);

      expect(budget.targetWords.min).toBe(6750); // 6 * 1125
      expect(budget.targetWords.max).toBe(7500); // 6 * 1250
      expect(budget.targetWords.ideal).toBe(7125);
    });

    it('2 h/semana -> 12 sesiones, 30-33 páginas, 13,500-15,000 palabras', () => {
      const budget = computeContentBudget(2);

      expect(budget.weeklyHours).toBe(2);
      expect(budget.sessionsPerBlock).toBe(12);

      expect(budget.targetPages.min).toBe(30); // 12 * 2.5
      expect(budget.targetPages.max).toBe(33); // Math.round(12 * (50/18)) = 33
      expect(budget.targetPages.ideal).toBe(32);

      expect(budget.targetWords.min).toBe(13500);
      expect(budget.targetWords.max).toBe(15000);
    });

    it('3 h/semana (Estándar Canónico) -> 18 sesiones, 45-50 páginas, 20,250-22,500 palabras', () => {
      const budget = computeContentBudget(3);

      expect(budget.weeklyHours).toBe(3);
      expect(budget.sessionsPerBlock).toBe(18);

      expect(budget.targetPages.min).toBe(45); // 18 * 2.5
      expect(budget.targetPages.max).toBe(50); // 18 * (50/18) = 50
      expect(budget.targetPages.ideal).toBe(48);

      expect(budget.targetWords.min).toBe(20250); // 18 * 1125
      expect(budget.targetWords.max).toBe(22500); // 18 * 1250
      expect(budget.targetWords.ideal).toBe(21375);
    });

    it('4 h/semana -> 24 sesiones, 60-67 páginas, 27,000-30,000 palabras', () => {
      const budget = computeContentBudget(4);

      expect(budget.weeklyHours).toBe(4);
      expect(budget.sessionsPerBlock).toBe(24);

      expect(budget.targetPages.min).toBe(60);
      expect(budget.targetPages.max).toBe(67);

      expect(budget.targetWords.min).toBe(27000);
      expect(budget.targetWords.max).toBe(30000);
    });

    it('5 h/semana -> 30 sesiones, 75-83 páginas, 33,750-37,500 palabras', () => {
      const budget = computeContentBudget(5);

      expect(budget.weeklyHours).toBe(5);
      expect(budget.sessionsPerBlock).toBe(30);

      expect(budget.targetPages.min).toBe(75);
      expect(budget.targetPages.max).toBe(83);

      expect(budget.targetWords.min).toBe(33750);
      expect(budget.targetWords.max).toBe(37500);
    });

    it('Valores por defecto ante entrada indefinida o vacía -> default a 3 h/semana', () => {
      const budgetDefault = computeContentBudget(undefined);
      expect(budgetDefault.weeklyHours).toBe(3);
      expect(budgetDefault.sessionsPerBlock).toBe(18);
    });
  });

  describe('2. Distribución y suma de presupuestos por misión', () => {
    it('la suma de los presupuestos ideales de misión coincide aproximadamente con el total ideal', () => {
      const budget = computeContentBudget(3);
      const { foundation, lab, project, evaluation } = budget.missionBudgets;

      const sumIdeal = foundation.targetWords.ideal + lab.targetWords.ideal + project.targetWords.ideal + evaluation.targetWords.ideal;
      // La suma de 30% + 30% + 25% + 15% = 100%
      expect(Math.abs(sumIdeal - budget.targetWords.ideal)).toBeLessThanOrEqual(2);
    });

    it('asigna páginas proporcionales por misión a 450 palabras/página', () => {
      const budget = computeContentBudget(3);
      for (const key of ['foundation', 'lab', 'project', 'evaluation'] as const) {
        const mb = budget.missionBudgets[key];
        expect(mb.targetPages.ideal).toBe(Math.round(mb.targetWords.ideal / WORDS_PER_PAGE));
      }
    });
  });

  describe('3. resolveWeeklyHours: jerarquía de fallbacks', () => {
    it('prioriza totalHoursWeekly de sectionI', () => {
      const planning = {
        contentJson: {
          sectionI: {
            totalHoursWeekly: 4,
            totalHours: 72,
          },
        },
      };
      expect(resolveWeeklyHours(planning, 5)).toBe(4);
    });

    it('usa totalHours de sectionI si totalHoursWeekly no está pero totalHours <= 10', () => {
      const planning = {
        contentJson: {
          sectionI: {
            totalHours: 2,
          },
        },
      };
      expect(resolveWeeklyHours(planning, 5)).toBe(2);
    });

    it('usa customHours como segundo fallback si sectionI no tiene horas válidas', () => {
      const planning = {
        contentJson: {
          sectionI: {},
        },
      };
      expect(resolveWeeklyHours(planning, 5)).toBe(5);
    });

    it('usa 3 h/semana como default final seguro si no hay datos', () => {
      expect(resolveWeeklyHours(null)).toBe(3);
      expect(resolveWeeklyHours(undefined)).toBe(3);
    });
  });

  describe('4. countSessionPlanWords y validateSessionCoverage', () => {
    it('cuenta fielmente todas las partes de un SessionPlan', () => {
      const mockPlan = {
        objetivo: 'Aprender leyes de Newton en dos frases completas.', // 8 palabras
        motivacion: 'Una historia interesante en el taller mecánico de Puebla.', // 9 palabras
        saberesPrevios: 'Fuerza y masa conocidas de física elemental básica.', // 8 palabras
        contenido: 'La segunda ley establece que la aceleración es proporcional a la fuerza e inversamente a la masa.', // 16 palabras
        ejemploResuelto: 'Para m = 5 kg y F = 20 N, calculamos a = F/m = 4 m/s2.', // 14 palabras
        practica: [
          { enunciado: 'Calcula la fuerza para 10 kg y 2 m/s2.', pista: 'Multiplica masa por aceleración.' }, // 12 palabras
        ],
        aplicacion: 'Frenado de un vehículo en carretera.', // 6 palabras
        autoevaluacion: ['¿Puedo despejar la masa?', '¿Comprendo la unidad Newton?'], // 9 palabras
        recursos: [{ titulo: 'Video de física aplicada' }], // 4 palabras
        productoIntegrador: 'Ficha de cálculo para el prototipo escolar.', // 7 palabras
      };

      const wordCount = countSessionPlanWords(mockPlan);
      expect(wordCount).toBeGreaterThanOrEqual(80);
    });

    it('validateSessionCoverage detecta cuando faltan sesiones y calcula deltas', () => {
      const budget = computeContentBudget(3); // 18 sesiones, 48 págs, 21375 palabras
      const sessions = Array.from({ length: 18 }, (_, i) => ({ sessionNumber: i + 1 }));

      const report = validateSessionCoverage({
        sessions,
        expectedSessionsCount: 18,
        totalWords: 21500,
        budget,
      });

      expect(report.allSessionsPresent).toBe(true);
      expect(report.sessionsCovered).toBe(18);
      expect(report.withinTargetRange).toBe(true);
      expect(report.totalPages).toBe(Math.round(21500 / 450)); // 48
      expect(report.pagesDelta).toBe(0);
      expect(report.wordsDelta).toBe(125); // 21500 - 21375
    });

    it('validateSessionCoverage marca allSessionsPresent false si faltan sesiones', () => {
      const budget = computeContentBudget(3);
      const incompleteSessions = [{ sessionNumber: 1 }, { sessionNumber: 2 }];

      const report = validateSessionCoverage({
        sessions: incompleteSessions,
        expectedSessionsCount: 18,
        totalWords: 5000,
        budget,
      });

      expect(report.allSessionsPresent).toBe(false);
      expect(report.sessionsCovered).toBe(2);
      expect(report.withinTargetRange).toBe(false);
    });
  });
});
