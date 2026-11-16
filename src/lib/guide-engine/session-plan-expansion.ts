import { generateWithRotation } from '@/lib/ai-provider';
import { robustJsonParse } from '@/lib/ai-response-parser';
import { logger } from '@/lib/logger';
import type { SessionPlan } from '@/types/work-textbook';
import { countSessionPlanWords, type MissionBudget } from './content-budget';
import { evaluateQuality, type WriterOutput } from './writers/writer-contract';
import {
  fitPedagogicalText,
  hasDanglingEnding,
  repairDanglingEnding,
  splitSpanishSentences,
  type PedagogicalTextRole,
} from '@/lib/editorial/pedagogical-text-fitter';

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

interface PlanTextField {
  label: string;
  get: () => string;
  set: (value: string) => void;
  role: PedagogicalTextRole;
  floorWords: number;
  reducible: boolean;
}

function countWords(raw: string | undefined | null): number {
  return String(raw || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function hardTrimToWords(raw: string, maxWords: number): string {
  if (maxWords <= 0) return '';
  const words = raw.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return raw;
  return repairDanglingEnding(words.slice(0, maxWords).join(' '), true);
}

function fitTextToWordBudget(
  raw: string,
  targetWords: number,
  role: PedagogicalTextRole
): string {
  const fitted = fitPedagogicalText(raw, {
    maxWords: targetWords,
    maxChars: Math.max(120, targetWords * 20),
    role,
    ensurePeriod: true,
  });
  if (!fitted) return '';
  return countWords(fitted) > targetWords ? hardTrimToWords(fitted, targetWords) : fitted;
}

function sentenceScore(sentence: string, index: number, total: number): number {
  let score = 0;
  if (index === 0) score += 3;
  if (index === total - 1) score += 5;
  if (/\d|[=<>]/.test(sentence)) score += 4;
  if (
    /\b(?:calcula|determina|encuentra|plantea|resuelve|halla|comprueba|verifica|modela|identifica|explica|analiza|construye|grafica|tabula|contrasta|redacta|elabora|integra|autoeval(?:u|\u00fa)a|organiza|revisa)\b/i.test(
      sentence
    )
  ) {
    score += 2;
  }
  if (sentence.length < 24) score -= 1;
  return score;
}

/**
 * Reduce un texto pedagógico a un presupuesto de palabras conservando la
 * apertura, el cierre y las oraciones con datos/ecuaciones. Si la selección
 * por oraciones no alcanza el presupuesto, delega en el fitter editorial.
 */
function compactTextToWordBudget(
  raw: string,
  targetWords: number,
  role: PedagogicalTextRole
): string {
  const clean = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  const currentWords = countWords(clean);
  if (currentWords <= targetWords) return clean;
  if (targetWords <= 0) return '';

  const sentences = splitSpanishSentences(clean);
  if (sentences.length <= 1) return fitTextToWordBudget(clean, targetWords, role);

  const scored = sentences.map((sentence, index) => ({
    sentence,
    index,
    words: countWords(sentence),
    score: sentenceScore(sentence, index, sentences.length),
  }));
  const selected = new Set<number>();
  const add = (index: number) => selected.add(index);
  add(0);
  add(sentences.length - 1);

  let selectedWords = Array.from(selected).reduce(
    (acc, index) => acc + (scored[index]?.words ?? 0),
    0
  );
  if (selectedWords > targetWords) {
    return fitTextToWordBudget(clean, targetWords, role);
  }

  const candidates = [...scored].sort(
    (a, b) => b.score - a.score || b.words - a.words || a.index - b.index
  );
  for (const candidate of candidates) {
    if (selected.has(candidate.index)) continue;
    if (selectedWords + candidate.words <= targetWords) {
      add(candidate.index);
      selectedWords += candidate.words;
    }
  }

  if (selectedWords < targetWords * 0.8) {
    return fitTextToWordBudget(clean, targetWords, role);
  }

  const selectedText = sentences
    .filter((_, index) => selected.has(index))
    .join(' ')
    .trim();
  const repaired = repairDanglingEnding(selectedText, true);
  if (!repaired || hasDanglingEnding(repaired)) {
    return fitTextToWordBudget(clean, targetWords, role);
  }
  return repaired;
}

function collectPlanTextFields(plan: SessionPlan): PlanTextField[] {
  const fields: PlanTextField[] = [
    {
      label: 'objetivo',
      get: () => plan.objetivo,
      set: (value) => {
        plan.objetivo = value;
      },
      role: 'concept',
      floorWords: 6,
      reducible: false,
    },
    {
      label: 'motivacion',
      get: () => plan.motivacion,
      set: (value) => {
        plan.motivacion = value;
      },
      role: 'application',
      floorWords: 20,
      reducible: false,
    },
    {
      label: 'saberesPrevios',
      get: () => plan.saberesPrevios,
      set: (value) => {
        plan.saberesPrevios = value;
      },
      role: 'concept',
      floorWords: 15,
      reducible: false,
    },
    {
      label: 'contenido',
      get: () => plan.contenido,
      set: (value) => {
        plan.contenido = value;
      },
      role: 'concept',
      floorWords: 120,
      reducible: true,
    },
    {
      label: 'ejemploResuelto',
      get: () => plan.ejemploResuelto,
      set: (value) => {
        plan.ejemploResuelto = value;
      },
      role: 'conclusion',
      floorWords: 100,
      reducible: true,
    },
    {
      label: 'aplicacion',
      get: () => plan.aplicacion,
      set: (value) => {
        plan.aplicacion = value;
      },
      role: 'application',
      floorWords: 15,
      reducible: false,
    },
    {
      label: 'productoIntegrador',
      get: () => plan.productoIntegrador,
      set: (value) => {
        plan.productoIntegrador = value;
      },
      role: 'concept',
      floorWords: 10,
      reducible: false,
    },
  ];

  (plan.practica || []).forEach((item, index) => {
    fields.push({
      label: `practica[${index}].enunciado`,
      get: () => item.enunciado,
      set: (value) => {
        item.enunciado = value;
      },
      role: 'problem',
      floorWords: 8,
      reducible: false,
    });
    fields.push({
      label: `practica[${index}].pista`,
      get: () => item.pista,
      set: (value) => {
        item.pista = value;
      },
      role: 'hint',
      floorWords: 5,
      reducible: false,
    });
  });

  (plan.autoevaluacion || []).forEach((item, index) => {
    fields.push({
      label: `autoevaluacion[${index}]`,
      get: () => item,
      set: (value) => {
        plan.autoevaluacion[index] = value;
      },
      role: 'concept',
      floorWords: countWords(item),
      reducible: false,
    });
  });

  (plan.recursos || []).forEach((item, index) => {
    fields.push({
      label: `recursos[${index}].titulo`,
      get: () => item.titulo,
      set: (value) => {
        plan.recursos[index].titulo = value;
      },
      role: 'concept',
      floorWords: countWords(item.titulo),
      reducible: false,
    });
  });

  return fields;
}

function compactPlanToWordTarget(plan: SessionPlan, targetWords: number): boolean {
  const fields = collectPlanTextFields(plan);
  const currentByField = fields.map((field) => countWords(field.get()));
  const currentTotal = currentByField.reduce((acc, words) => acc + words, 0);
  if (currentTotal <= targetWords) return false;

  const ratio = Math.max(0, targetWords / currentTotal);
  const targets = fields.map((field, index) => {
    const current = currentByField[index] ?? 0;
    const floor = field.reducible
      ? Math.min(current, Math.max(field.floorWords, Math.floor(current * 0.35)))
      : current;
    return {
      field,
      current,
      target: Math.max(floor, Math.floor(current * ratio)),
    };
  });

  let overflow = targets.reduce((acc, item) => acc + item.target, 0) - targetWords;
  if (overflow > 0) {
    const reducible = [...targets]
      .filter((item) => item.field.reducible)
      .sort((a, b) => b.current - b.target - (a.current - a.target));
    for (const item of reducible) {
      if (overflow <= 0) break;
      const slack = item.current - item.target;
      const cut = Math.min(slack, overflow);
      item.target -= cut;
      overflow -= cut;
    }
  }

  let changed = false;
  for (const item of targets) {
    if (!item.field.reducible || item.target >= item.current) continue;
    const compacted = compactTextToWordBudget(
      item.field.get(),
      item.target,
      item.field.role
    );
    if (compacted && compacted !== item.field.get()) {
      item.field.set(compacted);
      changed = true;
    }
  }

  return changed;
}

/**
 * Compactación determinista previa al gate: si el bloque excede el máximo
 * formal, recorta texto de los planes de sesión sin llamar a la IA. Se detiene
 * antes de cruzar el mínimo formal para no convertir un exceso en un déficit.
 */
export function compactOversizedSessionPlans(params: {
  writerOutputs: WriterOutput[];
  missionBudgets: Record<WriterType, MissionBudget>;
  blockTargetWords: { min: number; max: number };
  subsystem: 'bge' | 'bt';
  /**
   * Umbral que dispara la compactación. Por defecto es el máximo formal;
   * el orquestador usa el máximo con tolerancia editorial para no tocar
   * bloques que el gate aceptaría con una variación leve.
   */
  triggerWords?: number;
}): { compactedPlans: number; removedWords: number } {
  const totalWords = () =>
    params.writerOutputs.reduce((acc, output) => acc + (output.wordCount || 0), 0);

  const triggerWords = params.triggerWords ?? params.blockTargetWords.max;
  if (totalWords() <= triggerWords) {
    return { compactedPlans: 0, removedWords: 0 };
  }

  const initialTotal = totalWords();
  const sectionWordsByOutput = new Map<WriterOutput, number>();
  for (const output of params.writerOutputs) {
    const plansWords = plansWordCount(output.section?.sessionPlans || []);
    sectionWordsByOutput.set(output, Math.max(0, output.wordCount - plansWords));
  }

  // output.wordCount solo se recalcula al final; durante el recorte hay que
  // medir los planes mutados para no seguir compactando a ciegas.
  const currentTotalWords = () =>
    params.writerOutputs.reduce((acc, output) => {
      const sectionWords = sectionWordsByOutput.get(output) ?? 0;
      return acc + sectionWords + plansWordCount(output.section?.sessionPlans || []);
    }, 0);

  const planEntries = params.writerOutputs
    .flatMap((output) =>
      (output.section?.sessionPlans || []).map((plan) => ({ output, plan }))
    )
    .map((entry) => ({ ...entry, words: countSessionPlanWords(entry.plan) }))
    .sort((a, b) => b.words - a.words);

  let compactedPlans = 0;
  let guard = 0;

  while (currentTotalWords() > params.blockTargetWords.max && guard < planEntries.length * 20) {
    guard++;
    let changedInPass = false;
    let remainingPlans = planEntries.length;

    for (const entry of planEntries) {
      if (currentTotalWords() <= params.blockTargetWords.max) break;
      const currentPlanWords = countSessionPlanWords(entry.plan);
      if (currentPlanWords <= 0) continue;

      const excessNow = currentTotalWords() - params.blockTargetWords.max;
      const maxReduction = Math.max(
        20,
        Math.ceil(excessNow / Math.max(1, remainingPlans))
      );
      remainingPlans--;
      const targetPlanWords = Math.max(
        480,
        currentPlanWords - Math.min(maxReduction, Math.floor(currentPlanWords * 0.25))
      );
      if (targetPlanWords >= currentPlanWords) continue;

      const snapshot = JSON.stringify(entry.plan);
      const changed = compactPlanToWordTarget(entry.plan, targetPlanWords);
      if (!changed) continue;

      if (currentTotalWords() < params.blockTargetWords.min) {
        const restored = JSON.parse(snapshot) as SessionPlan;
        Object.assign(entry.plan, restored);
        changedInPass = false;
        break;
      }

      compactedPlans++;
      changedInPass = true;
      entry.words = countSessionPlanWords(entry.plan);
    }

    if (!changedInPass) break;
  }

  if (compactedPlans > 0) {
    for (const output of params.writerOutputs) {
      const plans = output.section?.sessionPlans || [];
      if (plans.length === 0) continue;
      applyPlansToOutput(
        output,
        plans,
        sectionWordsByOutput.get(output) ?? 0,
        params.missionBudgets[output.type],
        params.subsystem
      );
    }
  }

  const removedWords = Math.max(0, initialTotal - currentTotalWords());
  return { compactedPlans, removedWords };
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
  const initialBlockWords = params.writerOutputs.reduce(
    (acc, output) => acc + (output.wordCount || 0),
    0
  );
  if (initialBlockWords >= params.blockTargetWords.max) {
    logger.warn(
      `[SessionPlanExpansion] El bloque ya alcanzó el máximo (${initialBlockWords} >= ${params.blockTargetWords.max}); ` +
        'se omite la expansión para no agravar el exceso.'
    );
    return { expandedPlans: 0, addedWords: 0 };
  }

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
