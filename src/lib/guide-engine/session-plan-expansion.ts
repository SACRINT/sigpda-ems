import { generateWithRotation } from '@/lib/ai-provider';
import { robustJsonParse } from '@/lib/ai-response-parser';
import { logger } from '@/lib/logger';
import type { SessionPlan } from '@/types/work-textbook';
import { countSessionPlanWords, type MissionBudget } from './content-budget';
import { evaluateQuality, type WriterOutput } from './writers/writer-contract';

const BATCH_SIZE = 8;
const DEFICIT_RATIO = 0.9;
const CONTENT_MIN_WORDS = 460;
const EXAMPLE_MIN_WORDS = 320;
const BATCH_DELAY_MS = 3000;
const DEFAULT_MIN_REMAINING_BUDGET_MS = 45_000;

type WriterType = WriterOutput['type'];

interface ExpansionParams {
  writerOutputs: WriterOutput[];
  missionBudgets: Record<WriterType, MissionBudget>;
  blockTargetWords: { min: number; max: number };
  uacName: string;
  blockName: string;
  subsystem: 'bge' | 'bt';
  teacherId?: string;
  signal?: AbortSignal;
  remainingBudgetMs: number;
  /**
   * Piso mínimo de tiempo para iniciar o continuar lotes de expansión.
   * El orquestador lo alinea con su presupuesto: 30s en expandOnly y 60s
   * en la pasada editorial normal. Si se omite, conserva el piso histórico 45s.
   */
  minRemainingBudgetMs?: number;
}

interface OutputSnapshot {
  output: WriterOutput;
  originalPlansBySession: Map<number, SessionPlan>;
  sectionWords: number;
  addedWords: number;
  expandedPlans: number;
}

interface BatchExpansion {
  contenido?: string;
  ejemploResuelto?: string;
  sessionNumber?: number;
}

function planTargetWords(budget: MissionBudget, planCount: number, sectionWords: number): number {
  const count = Math.max(1, planCount);
  const requiredPlansWords = Math.max(0, budget.targetWords.min - sectionWords);
  const withSafetyMargin = Math.ceil((requiredPlansWords * 1.1) / count);
  return Math.min(1250, Math.max(900, withSafetyMargin));
}

function isDeficient(plan: SessionPlan, targetWords: number): boolean {
  return countSessionPlanWords(plan) < targetWords * DEFICIT_RATIO;
}

function plansWordCount(plans: SessionPlan[]): number {
  return plans.reduce((acc, plan) => acc + countSessionPlanWords(plan), 0);
}

function applyPlansToOutput(
  output: WriterOutput,
  plans: SessionPlan[],
  sectionWords: number,
  budget: MissionBudget,
  subsystem: 'bge' | 'bt'
): number {
  const newWordCount = sectionWords + plansWordCount(plans);
  output.section.sessionPlans = plans;
  output.section.wordCount = newWordCount;
  output.wordCount = newWordCount;
  const quality = evaluateQuality({
    wordCount: newWordCount,
    targetWords: budget.targetWords,
    content: JSON.stringify(output.section),
    subsystem,
    workbookElementsCount: 2,
  });
  output.qualityScore = quality.qualityScore;
  output.warnings = quality.warnings;
  return newWordCount;
}

function rebalanceOvershoot(
  snapshots: OutputSnapshot[],
  params: ExpansionParams
): { expandedPlans: number; addedWords: number } {
  const totalWords = () => params.writerOutputs.reduce((acc, output) => acc + output.wordCount, 0);
  if (totalWords() <= params.blockTargetWords.max) {
    return {
      expandedPlans: snapshots.reduce((acc, snapshot) => acc + snapshot.expandedPlans, 0),
      addedWords: snapshots.reduce((acc, snapshot) => acc + snapshot.addedWords, 0),
    };
  }

  logger.warn(
    `[SessionPlanExpansion] El bloque supera el máximo (${totalWords()} > ${params.blockTargetWords.max}). Revirtiendo expansiones de mayor impacto para volver al rango.`
  );

  const ordered = [...snapshots]
    .filter((snapshot) => snapshot.addedWords > 0)
    .sort((a, b) => b.addedWords - a.addedWords);

  for (const snapshot of ordered) {
    if (totalWords() <= params.blockTargetWords.max) break;
    const currentPlans = [...(snapshot.output.section.sessionPlans || [])];
    const candidates = currentPlans
      .map((plan) => {
        const original = snapshot.originalPlansBySession.get(plan.sessionNumber);
        if (!original) return null;
        const gain = countSessionPlanWords(plan) - countSessionPlanWords(original);
        return gain > 0 ? { sessionNumber: plan.sessionNumber, original, gain } : null;
      })
      .filter((candidate): candidate is { sessionNumber: number; original: SessionPlan; gain: number } => candidate !== null)
      .sort((a, b) => b.gain - a.gain);

    for (const candidate of candidates) {
      if (totalWords() <= params.blockTargetWords.max) break;
      const index = currentPlans.findIndex((plan) => plan.sessionNumber === candidate.sessionNumber);
      if (index === -1) continue;
      const previous = currentPlans[index];
      currentPlans[index] = candidate.original;
      const projectedTotal = totalWords() - candidate.gain;
      if (projectedTotal < params.blockTargetWords.min) {
        currentPlans[index] = previous;
        continue;
      }
      applyPlansToOutput(
        snapshot.output,
        currentPlans,
        snapshot.sectionWords,
        params.missionBudgets[snapshot.output.type],
        params.subsystem
      );
      snapshot.addedWords -= candidate.gain;
      snapshot.expandedPlans -= 1;
    }
  }

  return {
    expandedPlans: snapshots.reduce((acc, snapshot) => acc + snapshot.expandedPlans, 0),
    addedWords: snapshots.reduce((acc, snapshot) => acc + snapshot.addedWords, 0),
  };
}

function buildSystemInstruction(
  uacName: string,
  blockName: string,
  subsystem: 'bge' | 'bt',
  targetPlanWords: number
): string {
  return `Eres editor pedagógico senior de libros de texto para Educación Media Superior (MCCEMS Puebla).
UAC: ${uacName}. Bloque: ${blockName}. Subsistema: ${subsystem.toUpperCase()}.

Recibirás un arreglo JSON de planes de sesión. Debes reescribir CADA plan expandiendo únicamente dos campos:
1. "contenido": entre ${CONTENT_MIN_WORDS} y 540 palabras, organizado en 3 párrafos de al menos 150 palabras cada uno. Debe ser teoría real y específica de la disciplina, con definiciones, fórmulas o marcos conceptuales.
2. "ejemploResuelto": entre ${EXAMPLE_MIN_WORDS} y 380 palabras, con un planteamiento contextualizado, 4 pasos numerados de 60 a 80 palabras cada uno, operaciones o decisiones explícitas y una interpretación final.

Cada plan expandido debe alcanzar al menos ${targetPlanWords} palabras totales y ser claramente más extenso que el original; no resumas ni abrevies. Conserva EXACTAMENTE el "sessionNumber" y todos los demás campos del plan sin modificarlos. No uses marcadores, corchetes ni puntos suspensivos. Escribe en voz de estudiante (tú), en español formal.
Devuelve EXCLUSIVAMENTE un objeto JSON válido con la forma {"sessionPlans": [ ... ]} que contenga todos los planes recibidos.`;
}

async function expandBatch(
  plans: SessionPlan[],
  params: ExpansionParams,
  deadline: number,
  targetPlanWords: number
): Promise<Map<number, BatchExpansion>> {
  const remaining = deadline - Date.now();
  const minRemainingBudgetMs = params.minRemainingBudgetMs ?? DEFAULT_MIN_REMAINING_BUDGET_MS;
  if (remaining < minRemainingBudgetMs) return new Map();

  const diagnostics = plans
    .map((plan) => {
      const contenidoWords = String(plan.contenido || '').split(/\s+/).filter(Boolean).length;
      const ejemploWords = String(plan.ejemploResuelto || '').split(/\s+/).filter(Boolean).length;
      return `- Sesión ${plan.sessionNumber}: ${countSessionPlanWords(plan)} palabras totales (contenido=${contenidoWords}, ejemploResuelto=${ejemploWords}). Debe alcanzar al menos ${targetPlanWords} palabras totales.`;
    })
    .join('\n');
  const userPrompt = `Planes de sesión a expandir (${plans.length}):\n${diagnostics}\n\nJSON original:\n${JSON.stringify(plans)}`;
  const systemInstruction = buildSystemInstruction(
    params.uacName,
    params.blockName,
    params.subsystem,
    targetPlanWords
  );

  try {
    const raw = await generateWithRotation(
      systemInstruction,
      userPrompt,
      params.teacherId,
      false,
      {
        jsonMode: true,
        maxTokens: 16384,
        timeoutMs: Math.min(90000, Math.max(30_000, remaining - 5_000)),
        remainingBudgetMs: remaining,
        signal: params.signal,
      }
    );
    const parsed = robustJsonParse(raw);
    const expandedPlans = Array.isArray(parsed.sessionPlans) ? parsed.sessionPlans : [];
    const result = new Map<number, BatchExpansion>();
    for (const plan of expandedPlans as BatchExpansion[]) {
      if (typeof plan.sessionNumber === 'number') result.set(plan.sessionNumber, plan);
    }
    return result;
  } catch (error) {
    logger.warn('[SessionPlanExpansion] Falló la expansión de un lote; se conservan los planes originales.', {
      error: String(error),
    });
    return new Map();
  }
}

export async function expandDeficientSessionPlans(params: ExpansionParams): Promise<{
  expandedPlans: number;
  addedWords: number;
}> {
  const deadline = Date.now() + params.remainingBudgetMs;
  const snapshots: OutputSnapshot[] = [];

  for (const output of params.writerOutputs) {
    if (!output.section) continue;
    const budget = params.missionBudgets[output.type];
    const initialPlans = output.section.sessionPlans || [];
    const originalPlansBySession = new Map(initialPlans.map((plan) => [plan.sessionNumber, plan]));
    const initialSectionWords = Math.max(0, output.wordCount - plansWordCount(initialPlans));
    let outputAddedWords = 0;
    let outputExpandedPlans = 0;

    for (let pass = 0; pass < 3; pass++) {
      const plans = output.section?.sessionPlans || [];
      if (plans.length === 0) break;
      if (output.wordCount >= budget.targetWords.min) break;

      const beforePlansWords = plans.reduce((acc, plan) => acc + countSessionPlanWords(plan), 0);
      const sectionWords = Math.max(0, output.wordCount - beforePlansWords);
      const targetWords = planTargetWords(budget, plans.length, sectionWords);
      const deficient = plans.filter((plan) => isDeficient(plan, targetWords));
      if (deficient.length === 0) break;

      const mergedBySession = new Map(plans.map((plan) => [plan.sessionNumber, plan]));

      const minRemainingBudgetMs =
        params.minRemainingBudgetMs ?? DEFAULT_MIN_REMAINING_BUDGET_MS;
      for (let index = 0; index < deficient.length; index += BATCH_SIZE) {
        if (deadline - Date.now() < minRemainingBudgetMs) break;
        if (index > 0) {
          await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
        }
        const batch = deficient.slice(index, index + BATCH_SIZE);
        const expansions = await expandBatch(batch, params, deadline, targetWords);
        for (const original of batch) {
          const expansion = expansions.get(original.sessionNumber);
          if (!expansion) continue;
          const contenido = typeof expansion.contenido === 'string' ? expansion.contenido.trim() : '';
          const ejemplo = typeof expansion.ejemploResuelto === 'string' ? expansion.ejemploResuelto.trim() : '';
          if (contenido.length === 0 && ejemplo.length === 0) continue;

          const candidate: SessionPlan = {
            ...original,
            contenido: contenido.length > 0 ? contenido : original.contenido,
            ejemploResuelto: ejemplo.length > 0 ? ejemplo : original.ejemploResuelto,
          };
          if (countSessionPlanWords(candidate) <= countSessionPlanWords(original)) continue;
          mergedBySession.set(original.sessionNumber, candidate);
          outputExpandedPlans++;
        }
      }

      const mergedPlans = Array.from(mergedBySession.values()).sort(
        (a, b) => a.sessionNumber - b.sessionNumber
      );
      const mergedPlansWords = mergedPlans.reduce((acc, plan) => acc + countSessionPlanWords(plan), 0);
      if (mergedPlansWords <= beforePlansWords) break;

      const newWordCount = sectionWords + mergedPlansWords;
      output.section.sessionPlans = mergedPlans;
      output.section.wordCount = newWordCount;
      output.wordCount = newWordCount;

      const quality = evaluateQuality({
        wordCount: newWordCount,
        targetWords: budget.targetWords,
        content: JSON.stringify(output.section),
        subsystem: params.subsystem,
        workbookElementsCount: 2,
      });
      output.qualityScore = quality.qualityScore;
      output.warnings = quality.warnings;

      outputAddedWords += mergedPlansWords - beforePlansWords;
    }

    snapshots.push({
      output,
      originalPlansBySession,
      sectionWords: initialSectionWords,
      addedWords: outputAddedWords,
      expandedPlans: outputExpandedPlans,
    });
  }

  return rebalanceOvershoot(snapshots, params);
}
