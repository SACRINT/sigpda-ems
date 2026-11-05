/**
 * content-budget.ts
 * SIGPDA-EMS · SEMS Puebla MCCEMS 2026-2027
 *
 * Motor de calibración de presupuesto editorial por sesiones de aprendizaje.
 * Reemplaza metas arbitrarias o fijas por un modelo pedagógico proporcional:
 * - sessionsPerBlock = weeklyHours × 6 (semanas por bloque curricular)
 * - targetPagesPerSession = 2.5 a 2.78 páginas (~45–50 págs / 18 sesiones)
 * - targetWordsPerSession = 1,125 a 1,250 palabras (a razón de 450 palabras/página)
 */

import { logger } from '@/lib/logger';

export const WEEKS_PER_BLOCK = 6;
export const WORDS_PER_PAGE = 450;

export const MIN_PAGES_PER_SESSION = 2.5;
export const MAX_PAGES_PER_SESSION = 50 / 18; // ~2.7777778 (18 sesiones = 50 páginas)

export const MIN_WORDS_PER_SESSION = 1125; // 2.5 * 450
export const MAX_WORDS_PER_SESSION = 1250; // (50 / 18) * 450 = 1250

export interface MissionBudget {
  targetWords: {
    min: number;
    ideal: number;
    max: number;
  };
  targetPages: {
    min: number;
    ideal: number;
    max: number;
  };
  sessionsCount: number;
}

export interface ContentBudget {
  weeklyHours: number;
  sessionsPerBlock: number;
  targetPages: {
    min: number;
    ideal: number;
    max: number;
  };
  targetWords: {
    min: number;
    ideal: number;
    max: number;
  };
  pagesPerSession: {
    min: number;
    ideal: number;
    max: number;
  };
  wordsPerSession: {
    min: number;
    ideal: number;
    max: number;
  };
  /** Distribución proporcional entre las 4 dimensiones pedagógicas del libro */
  missionBudgets: {
    foundation: MissionBudget;
    lab: MissionBudget;
    project: MissionBudget;
    evaluation: MissionBudget;
  };
}

/**
 * Resuelve las horas semanales asignadas a la planeación didáctica:
 * 1. Prioridad: planning.contentJson.sectionI.totalHoursWeekly (o totalHours si < 10)
 * 2. Fallback: customHours explícito del orquestador
 * 3. Default canónico MCCEMS: 3 horas/semana
 */
export function resolveWeeklyHours(
  planning?: {
    contentJson?: {
      sectionI?: {
        totalHoursWeekly?: number;
        totalHours?: number;
      };
    } | null;
    content_json?: {
      sectionI?: {
        totalHoursWeekly?: number;
        totalHours?: number;
      };
    } | null;
  } | null,
  customHours?: number
): number {
  const content = planning?.contentJson || planning?.content_json;
  if (
    typeof content?.sectionI?.totalHoursWeekly === 'number' &&
    content.sectionI.totalHoursWeekly > 0
  ) {
    return Math.round(content.sectionI.totalHoursWeekly);
  }

  if (
    typeof content?.sectionI?.totalHours === 'number' &&
    content.sectionI.totalHours > 0 &&
    content.sectionI.totalHours <= 10
  ) {
    return Math.round(content.sectionI.totalHours);
  }

  if (typeof customHours === 'number' && customHours > 0) {
    return Math.round(customHours);
  }

  return 3; // Estándar canónico de calibración (3 h/semana = 18 sesiones = 45–50 págs)
}

/**
 * Calcula el presupuesto formal de páginas y palabras para un bloque de 6 semanas
 * a partir de las horas semanales de la asignatura.
 */
export function computeContentBudget(weeklyHoursInput?: number): ContentBudget {
  const weeklyHours = Math.max(1, Math.min(8, Math.round(weeklyHoursInput ?? 3)));
  const sessionsPerBlock = weeklyHours * WEEKS_PER_BLOCK;

  const minPages = Math.round(sessionsPerBlock * MIN_PAGES_PER_SESSION);
  const maxPages = Math.round(sessionsPerBlock * MAX_PAGES_PER_SESSION);
  const idealPages = Math.round((minPages + maxPages) / 2);

  const minWords = sessionsPerBlock * MIN_WORDS_PER_SESSION;
  const maxWords = sessionsPerBlock * MAX_WORDS_PER_SESSION;
  const idealWords = Math.round((minWords + maxWords) / 2);

  // Proporción por dimensión: Fundamentación 30%, Laboratorio 30%, Proyecto 25%, Evaluación 15%
  const splits = {
    foundation: 0.30,
    lab: 0.30,
    project: 0.25,
    evaluation: 0.15,
  };

  const createMissionBudget = (split: number, defaultSessions: number): MissionBudget => {
    const mMinWords = Math.round(minWords * split);
    const mMaxWords = Math.round(maxWords * split);
    const mIdealWords = Math.round(idealWords * split);

    return {
      targetWords: {
        min: mMinWords,
        ideal: mIdealWords,
        max: mMaxWords,
      },
      targetPages: {
        min: Math.max(2, Math.round(mMinWords / WORDS_PER_PAGE)),
        ideal: Math.max(3, Math.round(mIdealWords / WORDS_PER_PAGE)),
        max: Math.max(4, Math.round(mMaxWords / WORDS_PER_PAGE)),
      },
      sessionsCount: defaultSessions,
    };
  };

  // Estimación de sesiones por misión
  const sFoundation = Math.round(sessionsPerBlock * splits.foundation);
  const sLab = Math.round(sessionsPerBlock * splits.lab);
  const sProject = Math.round(sessionsPerBlock * splits.project);
  const sEval = Math.max(1, sessionsPerBlock - (sFoundation + sLab + sProject));

  const budget: ContentBudget = {
    weeklyHours,
    sessionsPerBlock,
    targetPages: {
      min: minPages,
      ideal: idealPages,
      max: maxPages,
    },
    targetWords: {
      min: minWords,
      ideal: idealWords,
      max: maxWords,
    },
    pagesPerSession: {
      min: MIN_PAGES_PER_SESSION,
      ideal: Math.round(((MIN_PAGES_PER_SESSION + MAX_PAGES_PER_SESSION) / 2) * 100) / 100,
      max: Math.round(MAX_PAGES_PER_SESSION * 100) / 100,
    },
    wordsPerSession: {
      min: MIN_WORDS_PER_SESSION,
      ideal: Math.round(((MIN_WORDS_PER_SESSION + MAX_WORDS_PER_SESSION) / 2)),
      max: MAX_WORDS_PER_SESSION,
    },
    missionBudgets: {
      foundation: createMissionBudget(splits.foundation, sFoundation),
      lab: createMissionBudget(splits.lab, sLab),
      project: createMissionBudget(splits.project, sProject),
      evaluation: createMissionBudget(splits.evaluation, sEval),
    },
  };

  return budget;
}

/**
 * Suma y audita el conteo de palabras real de un plan de sesión individual (SessionPlan).
 */
export function countSessionPlanWords(plan: {
  objetivo?: string;
  motivacion?: string;
  saberesPrevios?: string;
  contenido?: string;
  ejemploResuelto?: string;
  practica?: Array<{ enunciado?: string; pista?: string }>;
  aplicacion?: string;
  autoevaluacion?: string[];
  recursos?: Array<{ titulo?: string }>;
  productoIntegrador?: string;
}): number {
  if (!plan) return 0;

  const parts: string[] = [
    plan.objetivo || '',
    plan.motivacion || '',
    plan.saberesPrevios || '',
    plan.contenido || '',
    plan.ejemploResuelto || '',
    ...(plan.practica || []).map((p) => `${p.enunciado || ''} ${p.pista || ''}`),
    plan.aplicacion || '',
    ...(plan.autoevaluacion || []),
    ...(plan.recursos || []).map((r) => r.titulo || ''),
    plan.productoIntegrador || '',
  ];

  return parts
    .join(' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

/**
 * Valida la cobertura de sesiones y consistencia de páginas/palabras frente al presupuesto.
 */
export function validateSessionCoverage(params: {
  sessions: Array<{ sessionNumber: number }>;
  expectedSessionsCount: number;
  totalWords: number;
  budget: ContentBudget;
}): {
  allSessionsPresent: boolean;
  sessionsCovered: number;
  sessionsExpected: number;
  averageWordsPerSession: number;
  withinTargetRange: boolean;
  totalPages: number;
  pagesDelta: number;
  wordsDelta: number;
} {
  const { sessions, expectedSessionsCount, totalWords, budget } = params;

  const presentNumbers = new Set(sessions.map((s) => s.sessionNumber));
  const sessionsCovered = presentNumbers.size;
  const allSessionsPresent = sessionsCovered >= expectedSessionsCount;

  const averageWordsPerSession = sessionsCovered > 0 ? Math.round(totalWords / sessionsCovered) : 0;
  const totalPages = Math.max(1, Math.round(totalWords / WORDS_PER_PAGE));

  // Tolerancia editorial de ±10% sobre el rango presupuestal
  const minAllowedWords = Math.round(budget.targetWords.min * 0.90);
  const maxAllowedWords = Math.round(budget.targetWords.max * 1.15);
  const withinTargetRange = totalWords >= minAllowedWords && totalWords <= maxAllowedWords;

  const pagesDelta = totalPages - budget.targetPages.ideal;
  const wordsDelta = totalWords - budget.targetWords.ideal;

  if (!allSessionsPresent) {
    logger.warn(
      `[validateSessionCoverage] Sesiones incompletas: ${sessionsCovered}/${expectedSessionsCount} presentes.`
    );
  }

  return {
    allSessionsPresent,
    sessionsCovered,
    sessionsExpected: expectedSessionsCount,
    averageWordsPerSession,
    withinTargetRange,
    totalPages,
    pagesDelta,
    wordsDelta,
  };
}
