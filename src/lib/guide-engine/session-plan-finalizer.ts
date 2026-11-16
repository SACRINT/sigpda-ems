import {
  fitPedagogicalText,
  hasDanglingEnding,
  repairDanglingEnding,
} from '@/lib/editorial/pedagogical-text-fitter';
import { countSessionPlanWords, type MissionBudget } from './content-budget';
import { evaluateQuality, type WriterOutput } from './writers/writer-contract';
import type { SessionPlan } from '@/types/work-textbook';

type WriterType = WriterOutput['type'];

function repairText(value: string | undefined | null): { value: string; repaired: boolean } {
  const text = String(value || '').trim();
  if (!text || !hasDanglingEnding(text)) return { value: text, repaired: false };
  const repaired = repairDanglingEnding(text, true).trim();
  return repaired && !hasDanglingEnding(repaired)
    ? { value: repaired, repaired: true }
    : { value: text, repaired: false };
}

function ensurePractice(plan: SessionPlan): boolean {
  if (Array.isArray(plan.practica) && plan.practica.length > 0) return false;
  const base = plan.aplicacion || plan.objetivo || plan.productoIntegrador;
  if (!base || base.trim().length < 24) return false;

  const compactBase =
    fitPedagogicalText(base, { maxChars: 220, maxWords: 34, role: 'problem', ensurePeriod: false }) ||
    base;
  const enunciado = `Resuelve una situación de tu entorno: ${compactBase.replace(/[.!?]+$/, '')}.`;
  plan.practica = [
    {
      enunciado,
      pista:
        'Define la incógnita, separa los datos fijos de los variables y plantea la igualdad que modela la situación.',
    },
  ];
  return true;
}

function finalizePlanText(plan: SessionPlan): number {
  let repaired = 0;
  const repairField = (value: string | undefined, set: (next: string) => void) => {
    const result = repairText(value);
    if (result.repaired) {
      set(result.value);
      repaired++;
    }
  };

  repairField(plan.objetivo, (next) => {
    plan.objetivo = next;
  });
  repairField(plan.motivacion, (next) => {
    plan.motivacion = next;
  });
  repairField(plan.saberesPrevios, (next) => {
    plan.saberesPrevios = next;
  });
  repairField(plan.contenido, (next) => {
    plan.contenido = next;
  });
  repairField(plan.ejemploResuelto, (next) => {
    plan.ejemploResuelto = next;
  });
  repairField(plan.aplicacion, (next) => {
    plan.aplicacion = next;
  });
  repairField(plan.productoIntegrador, (next) => {
    plan.productoIntegrador = next;
  });

  for (const item of plan.practica ?? []) {
    repairField(item.enunciado, (next) => {
      item.enunciado = next;
    });
    repairField(item.pista, (next) => {
      item.pista = next;
    });
  }

  plan.autoevaluacion = (plan.autoevaluacion ?? []).map((item) => repairText(item).value);
  for (const item of plan.recursos ?? []) {
    repairField(item.titulo, (next) => {
      item.titulo = next;
    });
  }

  return repaired;
}

function recalculateOutput(
  output: WriterOutput,
  originalPlansWords: number,
  budget: MissionBudget,
  subsystem: 'bge' | 'bt'
): void {
  const plans = output.section?.sessionPlans ?? [];
  const plansWords = plans.reduce((acc, plan) => acc + countSessionPlanWords(plan), 0);
  const sectionWords = Math.max(0, output.wordCount - originalPlansWords);
  const nextWords = sectionWords + plansWords;
  output.section.wordCount = nextWords;
  output.wordCount = nextWords;
  const quality = evaluateQuality({
    wordCount: nextWords,
    targetWords: budget.targetWords,
    content: JSON.stringify(output.section),
    subsystem,
    workbookElementsCount: 2,
  });
  output.qualityScore = quality.qualityScore;
  output.warnings = quality.warnings;
}

/**
 * SSoT de cierre editorial: repara colas truncadas y garantiza que toda sesión
 * tenga práctica antes del gate. No genera contenido nuevo ni usa IA.
 */
export function finalizeSessionPlans(params: {
  writerOutputs: WriterOutput[];
  missionBudgets: Record<WriterType, MissionBudget>;
  subsystem: 'bge' | 'bt';
}): { repairedFields: number; addedPractices: number } {
  let repairedFields = 0;
  let addedPractices = 0;

  for (const output of params.writerOutputs) {
    const plans = output.section?.sessionPlans ?? [];
    if (plans.length === 0) continue;
    const originalPlansWords = plans.reduce((acc, plan) => acc + countSessionPlanWords(plan), 0);
    let outputChanged = false;

    for (const plan of plans) {
      const beforeWords = countSessionPlanWords(plan);
      const repaired = finalizePlanText(plan);
      const added = ensurePractice(plan);
      if (repaired > 0 || added) {
        repairedFields += repaired;
        addedPractices += added ? 1 : 0;
        outputChanged = true;
      }
      if (countSessionPlanWords(plan) !== beforeWords) outputChanged = true;
    }

    if (outputChanged) {
      recalculateOutput(
        output,
        originalPlansWords,
        params.missionBudgets[output.type],
        params.subsystem
      );
    }
  }

  return { repairedFields, addedPractices };
}
