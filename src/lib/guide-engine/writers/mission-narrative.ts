/**
 * mission-narrative.ts — Narrativa de misión derivada de contenido REAL.
 *
 * P0: elimina los hooks/analogías/consignas hardcodeadas que se inyectaban en
 * TODOS los libros (lab/project/evaluation). La narrativa se toma, en orden, de:
 *   1. Campos generados por la IA (phenomenonHook / conceptZero / guidedPractice).
 *   2. Contenido real de los planes de sesión (motivación, autoevaluación, etc.).
 *   3. Datos reales de entrada (UAC, problema PAEC, objetivo).
 *
 * Nunca devuelve una frase fija independiente de la UAC y del PAEC.
 */

import type { SessionPlan } from '@/types/work-textbook';

export interface MissionNarrativeInput {
  uacName: string;
  paecContext: string;
  sessionPlans?: SessionPlan[];
  objective?: string;
  // Campos opcionales que la IA puede devolver (se añadieron al contrato del prompt).
  phenomenonStory?: string;
  detonatingQuestion?: string;
  physicalAnalogy?: string;
  coreExplanation?: string;
  guidedPractice?: string;
  autonomousChallenge?: string;
  checkpointQuestion?: string;
  criteriaChecklist?: string[];
}

const clean = (value: unknown): string => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '');

export function firstNonEmpty(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    const text = clean(value);
    if (text.length >= 8) return text;
  }
  return '';
}

export function firstSentence(text: string | null | undefined): string {
  const value = clean(text);
  if (!value) return '';
  const match = value.match(/^(.{12,}?[.!?])(?:\s|$)/);
  return match ? match[1] : value;
}

export function resolvePhenomenonHook(input: MissionNarrativeInput): {
  story: string;
  detonatingQuestion: string;
} {
  const plan = input.sessionPlans?.[0];
  const story = firstNonEmpty(
    input.phenomenonStory,
    plan?.motivacion,
    input.paecContext,
    plan?.aplicacion,
    input.objective,
    `Reto de ${input.uacName}`
  );
  const detonatingQuestion = firstNonEmpty(
    input.detonatingQuestion,
    plan?.autoevaluacion?.[0],
    plan?.practica?.[0]?.enunciado,
    input.objective ? `¿Cómo aplicarías ${input.objective} en tu comunidad?` : ''
  );
  return { story, detonatingQuestion };
}

export function resolveConceptZero(input: MissionNarrativeInput): {
  physicalAnalogy: string;
  coreExplanation: string;
} {
  const plan = input.sessionPlans?.[0];
  const physicalAnalogy = firstNonEmpty(
    input.physicalAnalogy,
    firstSentence(plan?.contenido),
    firstSentence(plan?.ejemploResuelto),
    input.paecContext
  );
  const coreExplanation = firstNonEmpty(
    input.coreExplanation,
    firstSentence(plan?.contenido),
    input.objective
  );
  return { physicalAnalogy, coreExplanation };
}

export function resolveGuidedPractice(input: MissionNarrativeInput): string {
  const plan = input.sessionPlans?.[0];
  return firstNonEmpty(
    input.guidedPractice,
    plan?.practica?.[0]?.enunciado,
    plan?.aplicacion,
    input.paecContext
  );
}

export function resolveAutonomousChallenge(input: MissionNarrativeInput): string {
  const plan = input.sessionPlans?.[0];
  return firstNonEmpty(
    input.autonomousChallenge,
    plan?.practica?.[1]?.enunciado,
    plan?.productoIntegrador,
    plan?.aplicacion
  );
}

export function resolveCheckpoint(
  input: MissionNarrativeInput,
  fallbackCriteria: string[] = []
): { question: string; criteriaChecklist: string[] } {
  const plan = input.sessionPlans?.[0];
  const question = firstNonEmpty(
    input.checkpointQuestion,
    plan?.autoevaluacion?.[0],
    input.detonatingQuestion,
    input.objective
  );
  const criteria = (input.criteriaChecklist ?? [])
    .map(clean)
    .filter((c) => c.length >= 8)
    .slice(0, 6);
  if (criteria.length > 0) return { question, criteriaChecklist: criteria };
  const derived = (plan?.practica ?? [])
    .map((p) => firstSentence(p?.enunciado))
    .filter((c) => c.length >= 8)
    .slice(0, 3);
  return { question, criteriaChecklist: derived.length > 0 ? derived : fallbackCriteria };
}
