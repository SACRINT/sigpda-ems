/**
 * content-budget.test.ts
 *
 * Pruebas unitarias de la fórmula única de presupuesto editorial por sesiones (Fase P3.1).
 * Valida la tabla de 1 a 5 horas/semana, proporciones por misión y validación de cobertura.
 * Verifica rigurosamente el soporte dual de contentJson y content_json (DB Neon real).
 */

import { describe, it, expect } from 'vitest';
import {
  computeContentBudget,
  computeMissionBudget,
  resolveWeeklyHours,
  resolveSessionsPerBlock,
  countSessionPlanWords,
  validateSessionCoverage,
  WORDS_PER_PAGE,
  SESSIONS_PER_BLOCK_BY_WEEKLY_HOURS,
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

  describe('2. computeMissionBudget y distribución por sesiones reales', () => {
    it('calcula presupuesto exacto por sesión individual', () => {
      const mb3 = computeMissionBudget(3);
      expect(mb3.sessionsCount).toBe(3);
      expect(mb3.targetWords.min).toBe(3 * 1125); // 3375
      expect(mb3.targetWords.max).toBe(3 * 1250); // 3750
      expect(mb3.targetWords.ideal).toBe(3563);

      const mb6 = computeMissionBudget(6);
      expect(mb6.sessionsCount).toBe(6);
      expect(mb6.targetWords.min).toBe(6 * 1125); // 6750
      expect(mb6.targetWords.max).toBe(6 * 1250); // 7500
      expect(mb6.targetWords.ideal).toBe(7125);
    });

    it('la suma de los presupuestos ideales de misión coincide exactamente con el total del libro', () => {
      const budget = computeContentBudget(3);
      const { foundation, lab, project, evaluation } = budget.missionBudgets;
      const sumIdeal = foundation.targetWords.ideal + lab.targetWords.ideal + project.targetWords.ideal + evaluation.targetWords.ideal;
      // 3 + 6 + 6 + 3 = 18 sesiones exactas
      expect(foundation.sessionsCount + lab.sessionsCount + project.sessionsCount + evaluation.sessionsCount).toBe(18);
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

  describe('3. resolveWeeklyHours: jerarquía de fallbacks y compatibilidad contentJson vs content_json', () => {
    it('prioriza totalHoursWeekly de contentJson', () => {
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

    it('prioriza totalHoursWeekly de content_json (DB Neon real sin camelCase)', () => {
      const planning = {
        content_json: {
          sectionI: {
            totalHoursWeekly: 5,
            totalHours: 90,
          },
        },
      };
      expect(resolveWeeklyHours(planning, 2)).toBe(5);
    });

    it('usa totalHours de content_json si totalHoursWeekly no está pero totalHours <= 10', () => {
      const planning = {
        content_json: {
          sectionI: {
            totalHours: 2,
          },
        },
      };
      expect(resolveWeeklyHours(planning, 5)).toBe(2);
    });

    it('usa totalHours de contentJson si totalHoursWeekly no está pero totalHours <= 10', () => {
      const planning = {
        contentJson: {
          sectionI: {
            totalHours: 2,
          },
        },
      };
      expect(resolveWeeklyHours(planning, 5)).toBe(2);
    });

    it('usa customHours como segundo fallback si ni contentJson ni content_json tienen horas válidas', () => {
      const planning = {
        content_json: {
          sectionI: {},
        },
      };
      expect(resolveWeeklyHours(planning, 5)).toBe(5);
    });

    it('usa 3 h/semana como default final seguro si el objeto de planeación es null o undefined', () => {
      expect(resolveWeeklyHours(null)).toBe(3);
      expect(resolveWeeklyHours(undefined)).toBe(3);
    });

    it('deriva horas semanales desde totalHours de semestre: 54 h → 3 h/semana', () => {
      const planning = { content_json: { sectionI: { totalHours: 54 } } };
      expect(resolveWeeklyHours(planning)).toBe(3);
      expect(computeContentBudget(resolveWeeklyHours(planning)).sessionsPerBlock).toBe(18);
    });

    it('deriva horas semanales desde totalHours de semestre: 72 h → 4 h/semana', () => {
      const planning = { content_json: { sectionI: { totalHours: 72 } } };
      expect(resolveWeeklyHours(planning)).toBe(4);
      expect(computeContentBudget(resolveWeeklyHours(planning)).sessionsPerBlock).toBe(24);
    });
  });

  describe('3.1 Política persistida de sesiones por horas semanales', () => {
    it('mapea 1-5 h/semana a 6, 12, 18, 24 y 30 sesiones por bloque', () => {
      expect(SESSIONS_PER_BLOCK_BY_WEEKLY_HOURS).toEqual({ 1: 6, 2: 12, 3: 18, 4: 24, 5: 30 });
      for (const [hours, sessions] of Object.entries(SESSIONS_PER_BLOCK_BY_WEEKLY_HOURS)) {
        expect(resolveSessionsPerBlock(Number(hours))).toBe(sessions);
      }
    });

    it('no normaliza 4 h/semana a 18: conserva 24 sesiones por bloque', () => {
      expect(resolveSessionsPerBlock(4)).toBe(24);
      expect(computeContentBudget(4).sessionsPerBlock).toBe(24);
      expect(computeContentBudget(4).targetWords.min).toBe(27_000);
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

    it('validateSessionCoverage detecta cuando todas las sesiones están presentes y dentro del rango', () => {
      const budget = computeContentBudget(3); // 18 sesiones, 48 págs, 21375 palabras (rango 20250 - 22500)
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

    it('validateSessionCoverage marca withinTargetRange false si se desvía del presupuesto estricto [20250, 22500]', () => {
      const budget = computeContentBudget(3); // 20,250 a 22,500 palabras
      const sessions = Array.from({ length: 18 }, (_, i) => ({ sessionNumber: i + 1 }));

      // Fronteras exactas aceptadas
      expect(validateSessionCoverage({ sessions, expectedSessionsCount: 18, totalWords: 20250, budget }).withinTargetRange).toBe(true);
      expect(validateSessionCoverage({ sessions, expectedSessionsCount: 18, totalWords: 22500, budget }).withinTargetRange).toBe(true);

      // Fuera de la frontera estricta
      expect(validateSessionCoverage({ sessions, expectedSessionsCount: 18, totalWords: 20240, budget }).withinTargetRange).toBe(false);
      expect(validateSessionCoverage({ sessions, expectedSessionsCount: 18, totalWords: 22510, budget }).withinTargetRange).toBe(false);

      // Desvíos mayores
      expect(validateSessionCoverage({ sessions, expectedSessionsCount: 18, totalWords: 15000, budget }).withinTargetRange).toBe(false);
      expect(validateSessionCoverage({ sessions, expectedSessionsCount: 18, totalWords: 28000, budget }).withinTargetRange).toBe(false);
    });
  });
});
