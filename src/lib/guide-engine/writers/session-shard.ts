/**
 * session-shard.ts — Generación de planes de sesión por PAQUETES (sharding)
 * SIGPDA-EMS · Motor editorial MCCEMS
 *
 * Problema que resuelve: cada writer pedía TODAS sus sesiones (hasta 8 × ~1,150 palabras) en una
 * sola llamada de ~14 000 tokens. Esa mega-llamada roza `maxTokens`, tarda minutos y, si se trunca,
 * obliga a repetir TODA la misión. Aquí las sesiones se piden en paquetes de 2-3, ortogonales entre
 * sí, ejecutables en paralelo bajo el scheduler, con validación de densidad por sesión y reparación
 * quirúrgica de la sesión deficiente (no de la misión completa).
 *
 * Todo es genérico: no depende de la asignatura; los temas salen del blueprint (DetailedSession) y
 * de la planeación (PlanningActivities).
 */

import { generateWithRotation } from '@/lib/ai-provider';
import { robustJsonParse } from '@/lib/ai-response-parser';
import { logger } from '@/lib/logger';
import type { SessionPlan } from '@/types/work-textbook';
import { countSessionPlanWords } from '../content-budget';
import { buildPlanningAlignmentPrompt } from './planning-alignment-prompt';
import { getDisciplinaryAdapter } from '@/lib/prompts/disciplinary-adapters';
import {
  buildCanonicalSessionPlanInstructions,
  buildCanonicalSessionPlanJsonExample,
  SESSION_PLAN_WORD_CONTRACT,
} from './session-prompt-contract';
import { runScheduled } from '../writer-scheduler';
import {
  completeSessionPlans,
  hasCompleteWorkedExampleClosure,
  hasExplicitPracticeTask,
  resolveRemainingBudgetMs,
  sanitizeSessionPlans,
  type FallbackPlanContext,
  type WriterInput,
  type WriterOutput,
} from './writer-contract';
import { isGenericText } from '../quality/no-generic-content';

export type SessionMissionType = 'foundation' | 'lab' | 'project' | 'evaluation';

// ─── Parámetros ─────────────────────────────────────────────────────────────

export function resolvePackSize(): number {
  const env = Number(process.env.BOOK_WRITER_PACK_SIZE);
  if (Number.isFinite(env) && env >= 1) return Math.min(4, Math.floor(env));
  return 3;
}

/** ~3 sesiones × ~1,100 palabras ≈ 5k tokens de salida: holgura amplia bajo este tope. */
export const SESSION_PACK_MAX_TOKENS = 8192;
export const SESSION_PACK_TIMEOUT_MS = 75_000;
const PACK_ATTEMPTS = 2;

/**
 * Divide las sesiones en paquetes equilibrados de tamaño ≤ packSize.
 * 8 → [3,3,2] · 4 → [2,2] · 6 → [3,3] · 5 → [3,2] · 1 → [1].
 */
export function shardSessions(sessions: number[], packSize = resolvePackSize()): number[][] {
  const list = [...sessions];
  if (list.length === 0) return [];
  const size = Math.max(1, Math.floor(packSize));
  const packs = Math.ceil(list.length / size);
  const base = Math.floor(list.length / packs);
  const extra = list.length % packs;
  const out: number[][] = [];
  let cursor = 0;
  for (let i = 0; i < packs; i++) {
    const take = base + (i < extra ? 1 : 0);
    out.push(list.slice(cursor, cursor + take));
    cursor += take;
  }
  return out;
}

// ─── Densidad por sesión ────────────────────────────────────────────────────

export interface DensityThresholds {
  minContenidoWords: number;
  minContenidoParagraphs: number;
  minEjemploWords: number;
  minEjemploSteps: number;
  minPractica: number;
  minPracticaEnunciadoWords: number;
  /** Palabras totales mínimas del plan (ver `sessionPlanWordTarget`). */
  minTotalWords: number;
  /** Exigir dígito o '=' en el cierre del ejemplo (familias cuantitativas). */
  requireNumericExample?: boolean;
  /** Exigir objeto `sintesisVisual` completo (V2) para alimentar 08_Presentaciones y 09_Infografías. */
  requireVisualSynthesis?: boolean;
}

export interface DensityReport {
  ok: boolean;
  words: number;
  deficits: string[];
}

const wordCount = (s: string | undefined): number => (s ? s.split(/\s+/).filter(Boolean).length : 0);

/**
 * Objetivo de palabras por plan derivado del presupuesto de la misión (SSoT: `SESSION_PLAN_WORD_CONTRACT`).
 * Alinea el objetivo de los writers con el contrato canónico V2 (1,120–1,250 palabras/sesión)
 * reservando ~6% para narrativa de la misión y escalando con el presupuesto si éste supera el estándar.
 */
export function sessionPlanWordTarget(idealWordsForMission: number, sessionCount: number): number {
  const per = idealWordsForMission / Math.max(1, sessionCount);
  return Math.max(SESSION_PLAN_WORD_CONTRACT.targetMin, Math.round(per * 0.94));
}

/**
 * Umbrales de densidad alineados con `SESSION_PLAN_WORD_CONTRACT` (sin tope artificial en 720):
 * - `minTotalWords`: ~89.5% del objetivo por sesión (≈1,002 palabras cuando target = 1,120).
 * - `minContenidoWords`: 320 (exacto al piso del contrato).
 * - `minEjemploWords`: 220 (exacto al piso del contrato).
 */
export function densityThresholdsFor(
  targetWordsPerPlan: number,
  requireNumericExample = false,
  requireVisualSynthesis = false
): DensityThresholds {
  const safeTarget = Math.max(900, Math.round(targetWordsPerPlan));
  return {
    minContenidoWords: SESSION_PLAN_WORD_CONTRACT.fields.contenido.min,
    minContenidoParagraphs: 3,
    minEjemploWords: SESSION_PLAN_WORD_CONTRACT.fields.ejemploResuelto.min,
    minEjemploSteps: 3,
    minPractica: 2,
    minPracticaEnunciadoWords: 28,
    minTotalWords: Math.max(790, Math.round(safeTarget * 0.895)),
    requireNumericExample,
    requireVisualSynthesis,
  };
}

/**
 * Valida presencia y completitud mínima de `sintesisVisual` (V2) para prevenir
 * caídas a destilación heurística sobre párrafos largos en 08_Presentaciones y 09_Infografías.
 */
export function validateVisualSynthesisDeficits(plan: SessionPlan): string[] {
  const sv = plan.sintesisVisual;
  if (!sv) {
    return ['falta el objeto sintesisVisual obligatorio (conceptoBreve, formulaOReglaClave, ejemploBreve y mapaConceptual)'];
  }
  const issues: string[] = [];
  if (wordCount(sv.conceptoBreve) < 15) {
    issues.push(`sintesisVisual.conceptoBreve es insuficiente (${wordCount(sv.conceptoBreve)} palabras; mínimo 15)`);
  }
  if (!sv.formulaOReglaClave || sv.formulaOReglaClave.trim().length < 3) {
    issues.push('sintesisVisual.formulaOReglaClave está vacío');
  }
  const ej = sv.ejemploBreve;
  const pasosValidos = (ej?.pasos || []).filter((p) => typeof p === 'string' && p.trim().length >= 8).length;
  if (!ej || wordCount(ej.planteamiento) < 10 || pasosValidos < 2 || wordCount(ej.conclusion) < 5) {
    issues.push('sintesisVisual.ejemploBreve incompleto (requiere planteamiento, ≥2 pasos y conclusión)');
  }
  const mc = sv.mapaConceptual;
  if (
    !mc ||
    wordCount(mc.definicionClave) < 6 ||
    wordCount(mc.criterioDesarrollo) < 6 ||
    wordCount(mc.errorComun) < 6 ||
    wordCount(mc.correccionBreve) < 6
  ) {
    issues.push('sintesisVisual.mapaConceptual incompleto (requiere los 4 campos con desarrollo suficiente)');
  }
  return issues;
}

export function evaluateSessionPlanDensity(plan: SessionPlan, t: DensityThresholds): DensityReport {
  const deficits: string[] = [];
  const contenidoWords = wordCount(plan.contenido);
  const explicitParagraphs = (plan.contenido || '')
    .split(/\n\s*\n/)
    .filter((p) => wordCount(p) >= 40).length;
  // sanitizeSessionPlans normaliza espacios múltiples (\s{2,} → ' '), por lo que también contamos
  // bloques discursivos sustanciales separados por punto o etiqueta "Párrafo N".
  const discourseBlocks = (plan.contenido || '')
    .split(/(?:\n\s*\n|\.\s+|(?=Párrafo\s*\d+\s*:))/i)
    .filter((p) => wordCount(p) >= 40).length;
  const paragraphs = Math.max(explicitParagraphs, discourseBlocks);
  if (contenidoWords < t.minContenidoWords) {
    deficits.push(`contenido tiene ${contenidoWords} palabras (mínimo ${t.minContenidoWords})`);
  }
  if (paragraphs < t.minContenidoParagraphs) {
    deficits.push(`contenido tiene ${paragraphs} párrafos sustanciales (mínimo ${t.minContenidoParagraphs})`);
  }
  const ejemploWords = wordCount(plan.ejemploResuelto);
  const steps = (plan.ejemploResuelto || '').match(/Paso\s*\d+/gi)?.length ?? 0;
  if (ejemploWords < t.minEjemploWords) {
    deficits.push(`ejemploResuelto tiene ${ejemploWords} palabras (mínimo ${t.minEjemploWords})`);
  }
  if (steps < t.minEjemploSteps) {
    deficits.push(`ejemploResuelto tiene ${steps} pasos numerados (mínimo ${t.minEjemploSteps})`);
  }
  if (!hasCompleteWorkedExampleClosure(plan.ejemploResuelto || '', { requireNumeric: t.requireNumericExample })) {
    deficits.push('ejemploResuelto no cierra con resultado, ecuación o conclusión verificable');
  }
  const practica = plan.practica || [];
  const goodPractica = practica.filter(
    (p) =>
      wordCount(p.enunciado) >= t.minPracticaEnunciadoWords &&
      hasExplicitPracticeTask(p.enunciado) &&
      p.pista &&
      !isGenericText(p.pista)
  ).length;
  if (goodPractica < t.minPractica) {
    deficits.push(`solo ${goodPractica} ejercicios completos con enunciado y pista propia (mínimo ${t.minPractica})`);
  }
  if (t.requireVisualSynthesis) {
    deficits.push(...validateVisualSynthesisDeficits(plan));
  }
  const words = countSessionPlanWords(plan);
  if (words < t.minTotalWords) {
    deficits.push(`el plan suma ${words} palabras (mínimo ${t.minTotalWords})`);
  }
  return { ok: deficits.length === 0, words, deficits };
}

// ─── Prompts ────────────────────────────────────────────────────────────────

const MISSION_LABEL: Record<SessionMissionType, string> = {
  foundation: 'fundamentación e intuición (Concepto Cero)',
  lab: 'práctica y taller',
  project: 'proyecto integrador',
  evaluation: 'evaluación formativa y cierre',
};

export interface SessionShardContext {
  input: WriterInput;
  missionType: SessionMissionType;
  missionTitle: string;
  /** TODAS las sesiones de la misión (se reparten en paquetes). */
  coveredSessions: number[];
  /** Nombre visible de la disciplina (adapter.displayName). */
  disciplineName: string;
  fallbackContext: FallbackPlanContext;
  /** Objetivo de palabras por plan (ver sessionPlanWordTarget). */
  targetWordsPerPlan: number;
  /** Reglas adicionales propias del writer (p. ej. guardrails terminológicos). */
  extraGuardrails?: string;
  /** Términos de la planeación asignados a este redactor (se reparten entre sus paquetes). */
  requiredTerms?: string[];
  /** Exigir `sintesisVisual` completo al validar densidad de planes (por defecto true en V2). */
  requireVisualSynthesis?: boolean;
}

function sessionLine(input: WriterInput, sessionNumber: number): string {
  const s = input.sessions.find((x) => x.sessionNum === sessionNumber);
  if (!s) return `Sesión ${sessionNumber}`;
  const parts = [`Sesión ${sessionNumber} (${s.phase})`, s.title && `tema: ${s.title}`, s.focus && `enfoque: ${s.focus}`];
  if (s.evidence) parts.push(`evidencia: ${s.evidence}`);
  return parts.filter(Boolean).join(' — ');
}

/** Reparte los términos requeridos entre paquetes (round-robin) para que cada término aparezca en ≥1 paquete. */
export function distributeTermsAcrossPacks(terms: string[], packCount: number): string[][] {
  const out: string[][] = Array.from({ length: Math.max(1, packCount) }, () => []);
  terms.forEach((t, i) => out[i % out.length].push(t));
  return out;
}

export function buildSessionPackPrompts(
  ctx: SessionShardContext,
  packSessions: number[],
  opts: { packTerms?: string[]; directive?: string } = {}
): { system: string; user: string } {
  const { input, missionType } = ctx;
  const alignment = buildPlanningAlignmentPrompt(
    input.planningActivities,
    missionType,
    input.uacName,
    input.component,
    input.curriculumName,
    input.careerOrProgramName
  );
  const termsBlock =
    opts.packTerms && opts.packTerms.length > 0
      ? `\nCONCEPTOS, SABERES Y MATERIALES DE LA PLANEACIÓN QUE ESTAS SESIONES DEBEN CUBRIR (intégralos de forma natural en sustantivo o presente dentro de la explicación, ejemplos y prácticas; si algún término viene conjugado en futuro como 'Identificarás...', conviértelo a forma conceptual o presente): ${opts.packTerms.join(' | ')}`
      : '';
  const directiveBlock = opts.directive ? `\n[REQUISITO CRÍTICO DE REPARACIÓN]: ${opts.directive}` : '';
  const firstSession = packSessions[0];
  const adapter = getDisciplinaryAdapter(
    input.uacName,
    input.component,
    input.curriculumName || input.careerOrProgramName
  );
  const canonicalSessionContract = buildCanonicalSessionPlanInstructions(adapter, missionType, {
    firstSession,
  });
  const canonicalSessionJson = buildCanonicalSessionPlanJsonExample(adapter, firstSession);

  const system = `Eres AUTOR DE LIBRO DE TEXTO para estudiantes de Bachillerato en Puebla (MCCEMS), especialista en ${ctx.disciplineName}.
Redactas los PLANES DE SESIÓN de la misión de ${MISSION_LABEL[missionType]} ("${ctx.missionTitle}") de un LIBRO PARA EL ESTUDIANTE, NO una guía para el docente: el estudiante debe poder aprender SOLO, leyendo el libro, sin que el maestro esté presente.
UAC: "${input.uacName}" (${input.subsystem.toUpperCase()}).
${alignment}${termsBlock}${ctx.extraGuardrails ? `\n${ctx.extraGuardrails}` : ''}${input.institutionalContext ? `\n\n${input.institutionalContext}` : ''}

REGLAS DE VOZ (CRÍTICO — el libro es del ESTUDIANTE):
- Escribe SIEMPRE en segunda persona dirigida al estudiante ("tú", "vas a aprender", "tu cuaderno", "observa", "resuelve").
- PROHIBIDO usar etiquetas "Docente:" o "Estudiante:", y verbos de instrucción al maestro ("activar el interés", "exponer y problematizar", "verificar comprensión", "orientar el avance", "plantear la situación", "retomar el desafío"). Eso va en el plan de clase, NO en el libro.
- El contenido debe ser REAL y AUTODIDACTA: definiciones, explicaciones, ejemplos resueltos con datos concretos y ejercicios con datos concretos. Un estudiante que lee el libro aprende el tema.


Devuelve EXCLUSIVAMENTE un objeto JSON válido con el Contrato Canónico V2 de abajo:

${canonicalSessionContract}

EJEMPLO JSON CANÓNICO DE REFERENCIA:
${canonicalSessionJson}

PRECEDENCIA: este Contrato Canónico V2 sustituye cualquier cuota, estructura o ejemplo de sessionPlans indicado antes en este prompt.`;

  const siblings = ctx.coveredSessions.filter((n) => !packSessions.includes(n));
  const siblingLines = siblings.map((n) => `- ${sessionLine(input, n)}`).join('\n');
  const user = `UAC: ${input.uacName}
Subsistema: ${input.subsystem.toUpperCase()}
Semestre: ${input.planning.semester}
Bloque: ${input.blockName}
Misión: ${ctx.missionTitle} (sesiones de la misión: ${ctx.coveredSessions.join(', ')})
Perfil de estudiantes: ${input.studentProfile}
Problemática PAEC: ${input.paecContext}

SESIONES QUE DEBES REDACTAR AHORA (exactamente ${packSessions.length}: ${packSessions.join(', ')}):
${packSessions.map((n) => `- ${sessionLine(input, n)}`).join('\n')}
${siblingLines ? `\nOTRAS SESIONES DE LA MISIÓN (las redactan otros autores; NO repitas su enfoque, solo mantén coherencia progresiva):\n${siblingLines}\n` : ''}${directiveBlock}
Redacta los ${packSessions.length} planes de sesión completos con máxima profundidad y rigor, cada uno con su "sessionNumber" correcto:`;

  return { system, user };
}

// ─── Generación ─────────────────────────────────────────────────────────────

function sessionNumberOf(plan: unknown): number | null {
  if (!plan || typeof plan !== 'object') return null;
  const v = (plan as Record<string, unknown>).sessionNumber;
  return typeof v === 'number' ? v : null;
}

function extractPlans(raw: string, allowed: Set<number>): unknown[] {
  const parsed = robustJsonParse(raw);
  const candidate = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as Record<string, unknown>).sessionPlans)
      ? ((parsed as Record<string, unknown>).sessionPlans as unknown[])
      : [];
  return candidate.filter((p) => {
    const n = sessionNumberOf(p);
    return n !== null && allowed.has(n);
  });
}

function isPoolExhaustedOrServiceError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { name?: string; message?: string };
  if (e.name === 'AiCooldownExhaustedError' || e.name === 'AiServiceUnavailableError') {
    return true;
  }
  const msg = typeof e.message === 'string' ? e.message.toLowerCase() : '';
  return /enfriamiento por cuota|fast-fail|alta demanda|cortando por deadline/i.test(msg);
}

async function callPack(
  ctx: SessionShardContext,
  sessions: number[],
  opts: { packTerms?: string[]; directive?: string },
  label: string
): Promise<unknown[]> {
  const { system, user } = buildSessionPackPrompts(ctx, sessions, opts);
  const remainingBudgetMs = resolveRemainingBudgetMs(ctx.input.budgetDeadlineMs);
  const raw = await runScheduled(ctx.input.scheduler, label, () =>
    generateWithRotation(system, user, ctx.input.planning.teacherId, false, {
      jsonMode: true,
      maxTokens: SESSION_PACK_MAX_TOKENS,
      timeoutMs: SESSION_PACK_TIMEOUT_MS,
      remainingBudgetMs,
      signal: ctx.input.signal,
    })
  );
  return extractPlans(raw, new Set(sessions));
}

/** Genera un paquete; si faltan sesiones reintenta SOLO las faltantes (máx. PACK_ATTEMPTS intentos). */
async function generatePack(
  ctx: SessionShardContext,
  pack: number[],
  opts: { packTerms?: string[]; directive?: string },
  packLabel: string
): Promise<unknown[]> {
  const collected: unknown[] = [];
  let remaining = [...pack];
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= PACK_ATTEMPTS && remaining.length > 0; attempt++) {
    if (ctx.input.signal?.aborted) break;
    try {
      const plans = await callPack(ctx, remaining, opts, `${packLabel}#${attempt}`);
      collected.push(...plans);
      const present = new Set(collected.map(sessionNumberOf).filter((n): n is number => n !== null));
      remaining = remaining.filter((n) => !present.has(n));
      if (remaining.length > 0) {
        logger.warn(`[SessionShard] ${packLabel} incompleto (intento ${attempt}): faltan sesiones ${remaining.join(', ')}.`);
      }
    } catch (err) {
      lastError = err;
      if (ctx.input.signal?.aborted) throw err;
      logger.warn(`[SessionShard] ${packLabel} falló (intento ${attempt}):`, { error: String(err) });
      if (isPoolExhaustedOrServiceError(err)) {
        break;
      }
    }
  }
  if (collected.length === 0 && lastError) throw lastError;
  return collected;
}

export interface ShardDiagnostics {
  packs: number[][];
  repairedSessions: number[];
  /**
   * Siempre vacío en un retorno exitoso: si tras reparar queda alguna sesión deficiente,
   * `generateShardedSessionPlans` lanza `SessionDensityDeficiencyError` (fail-closed real).
   */
  stillDeficient: Array<{ session: number; deficits: string[] }>;
}

/**
 * Fail-closed de densidad: tras agotar la reparación quirúrgica queda al menos una sesión por
 * debajo de los umbrales de densidad (palabras, estructura o `sintesisVisual` incompleto).
 * Nunca se rellena con texto sintético ni se bajan umbrales: el writer falla y el job se reintenta.
 *
 * El mensaje incluye "Sesiones afectadas: N, M" para que `resolvePostRedactionEvictionTarget`
 * (job-worker) descarte únicamente el redactor propietario de esas sesiones al reintentar.
 */
export class SessionDensityDeficiencyError extends Error {
  readonly missionType: SessionMissionType;
  readonly uacName: string;
  readonly sessions: number[];
  readonly deficits: Array<{ session: number; deficits: string[] }>;
  readonly repairedSessions: number[];
  readonly attemptedRepairs: number[];

  constructor(params: {
    missionType: SessionMissionType;
    uacName: string;
    deficits: Array<{ session: number; deficits: string[] }>;
    repairedSessions: number[];
    attemptedRepairs: number[];
  }) {
    const sessions = params.deficits.map((d) => d.session);
    const detail = params.deficits
      .map((d) => `S${d.session}: ${d.deficits.join(' / ')}`)
      .join(' | ');
    super(
      `[SessionDensity] ${params.missionType} de "${params.uacName}" quedó por debajo del umbral de densidad tras reparar. ` +
        `Sesiones afectadas: ${sessions.join(', ')}. Reparadas con mejora parcial: ${params.repairedSessions.join(', ') || 'ninguna'}. ` +
        `Detalle: ${detail}. No se persiste; reintente la misión.`
    );
    this.name = 'SessionDensityDeficiencyError';
    this.missionType = params.missionType;
    this.uacName = params.uacName;
    this.sessions = sessions;
    this.deficits = params.deficits;
    this.repairedSessions = params.repairedSessions;
    this.attemptedRepairs = params.attemptedRepairs;
  }
}

/**
 * Genera TODOS los planes de sesión de una misión por paquetes paralelos, valida densidad por sesión
 * y repara quirúrgicamente solo las sesiones deficientes. Fail-closed:
 *  - si falta alguna sesión lanza `IncompleteSessionPlansError` (vía completeSessionPlans);
 *  - si tras reparar queda alguna sesión por debajo del umbral de densidad (incluido `sintesisVisual`
 *    incompleto) lanza `SessionDensityDeficiencyError`.
 * NUNCA rellena con contenido sintético ni baja umbrales.
 */
export async function generateShardedSessionPlans(
  ctx: SessionShardContext
): Promise<{ plans: SessionPlan[]; diagnostics: ShardDiagnostics }> {
  const preCached = ctx.input.cachedSessionPlans?.length
    ? (sanitizeSessionPlans(ctx.input.cachedSessionPlans, ctx.coveredSessions, ctx.fallbackContext) ?? [])
    : [];
  const raw: unknown[] = [...preCached];
  const cachedNums = new Set(preCached.map((p) => p.sessionNumber));
  const pendingSessions = ctx.coveredSessions.filter((n) => !cachedNums.has(n));
  const packs = shardSessions(pendingSessions);
  const termShares = distributeTermsAcrossPacks(ctx.requiredTerms ?? [], packs.length);
  const label = `${ctx.missionType}:sessions`;

  const notifyPartialCheckpoint = async () => {
    if (!ctx.input.onPartialSessionPlans) return;
    const partialSanitized = sanitizeSessionPlans(raw, ctx.coveredSessions, ctx.fallbackContext) ?? [];
    if (partialSanitized.length === 0) return;
    try {
      await ctx.input.onPartialSessionPlans(partialSanitized);
    } catch {
      /* checkpoint incremental best-effort */
    }
  };

  const settled = await Promise.allSettled(
    packs.map(async (pack, i) => {
      const result = await generatePack(
        ctx,
        pack,
        { packTerms: termShares[i] },
        `${label}[${pack.join('-')}]`
      );
      if (result.length > 0) {
        raw.push(...result);
        await notifyPartialCheckpoint();
      }
      return result;
    })
  );

  const rejected: unknown[] = [];
  for (const r of settled) {
    if (r.status === 'rejected') rejected.push(r.reason);
  }
  const capacityRejection = rejected.find(isPoolExhaustedOrServiceError);
  if (ctx.input.signal?.aborted && rejected.length > 0) throw rejected[0];
  if (raw.length === 0 && rejected.length > 0) throw capacityRejection ?? rejected[0];

  // Una pasada final solo para las sesiones que aún falten (paquetes caídos), antes de fallar cerrado
  const presentAfter = new Set(raw.map(sessionNumberOf).filter((n): n is number => n !== null));
  const missing = ctx.coveredSessions.filter((n) => !presentAfter.has(n));
  if (missing.length > 0 && capacityRejection) {
    throw capacityRejection;
  }

  let rescueCapacityRejection: unknown = null;
  if (missing.length > 0 && !ctx.input.signal?.aborted) {
    const rescue = await Promise.allSettled(
      shardSessions(missing).map(async (pack) => {
        const result = await generatePack(
          ctx,
          pack,
          {
            packTerms: [],
            directive:
              `Estas sesiones no se generaron en el intento anterior: ${pack.join(', ')}. ` +
              'Genera cada una COMPLETA con contenido de 3 párrafos, ejemploResuelto con datos + ecuación/procedimiento + resultado/conclusión, y 2 prácticas con datos + consigna explícita. No repitas el error de dejar solo datos sin tarea.',
          },
          `${label}-rescate[${pack.join('-')}]`
        );
        if (result.length > 0) {
          raw.push(...result);
          await notifyPartialCheckpoint();
        }
        return result;
      })
    );
    for (const r of rescue) {
      if (r.status === 'rejected' && !rescueCapacityRejection && isPoolExhaustedOrServiceError(r.reason)) {
        rescueCapacityRejection = r.reason;
      }
    }
  }

  const presentPostRescue = new Set(raw.map(sessionNumberOf).filter((n): n is number => n !== null));
  const missingPostRescue = ctx.coveredSessions.filter((n) => !presentPostRescue.has(n));
  if (missingPostRescue.length > 0 && rescueCapacityRejection) {
    throw rescueCapacityRejection;
  }

  // Valida densidad por sesión sobre planes ya sanitizados
  const adapter = getDisciplinaryAdapter(
    ctx.input.uacName,
    ctx.input.component,
    ctx.input.curriculumName || ctx.input.careerOrProgramName
  );
  const thresholds = densityThresholdsFor(
    ctx.targetWordsPerPlan,
    adapter.family === 'cuantitativa_experimental',
    ctx.requireVisualSynthesis ?? true
  );
  let sanitized = sanitizeSessionPlans(raw, ctx.coveredSessions, ctx.fallbackContext) ?? [];
  const deficient = sanitized
    .map((plan) => ({ plan, report: evaluateSessionPlanDensity(plan, thresholds) }))
    .filter((x) => !x.report.ok);

  const repaired: number[] = [];
  const attemptedRepairs: number[] = [];
  // Tope de COSTO (no de calidad): se intentan reparar como máximo ~80% de las sesiones cubiertas
  // (mínimo 2). Toda sesión que quede sin reparar —por este tope, por presupuesto bajo, por error de
  // IA o porque la reparación no mejoró— sigue deficiente y provoca `SessionDensityDeficiencyError`
  // al final: el residual NUNCA produce un retorno exitoso silencioso.
  const maxRepairs = Math.max(2, Math.min(deficient.length, Math.ceil(ctx.coveredSessions.length * 0.8)));
  if (deficient.length > 0 && !ctx.input.signal?.aborted) {
    const targets = deficient.slice(0, maxRepairs);
    for (const { plan, report } of targets) {
      if (ctx.input.signal?.aborted) break;
      const remainingBudget = resolveRemainingBudgetMs(ctx.input.budgetDeadlineMs);
      if (remainingBudget !== undefined && remainingBudget < 45_000) {
        logger.info(
          `[SessionShard] Omitiendo reparación de densidad de sesión ${plan.sessionNumber}: presupuesto bajo (${Math.round(remainingBudget / 1000)}s). La sesión quedará deficiente y la misión fallará cerrada.`
        );
        break;
      }
      attemptedRepairs.push(plan.sessionNumber);
      try {
        const res = await callPack(
          ctx,
          [plan.sessionNumber],
          {
            directive:
              `Tu borrador previo de la sesión ${plan.sessionNumber} fue insuficiente: ${report.deficits.join('; ')}. ` +
              `No repitas el mismo error. Ejemplo previo (recortado): "${(plan.ejemploResuelto || '').slice(0, 420)}". ` +
              `Práctica previa (recortada): "${(plan.practica || []).map((p) => p.enunciado).join(' | ').slice(0, 360)}". ` +
              'Redáctala de nuevo COMPLETA cumpliendo exactamente el Contrato Canónico V2: contenido en 3 párrafos sustanciales separados por doble salto de línea (\\n\\n, 320 a 440 palabras en total), ejemploResuelto de 220 a 300 palabras con Planteamiento y 4 pasos numerados (Paso 1..Paso 4) que cierre con resultado o conclusión verificable, 2 ejercicios con datos concretos y consigna explícita (pregunta o verbo de tarea), pista propia y solución, y el objeto sintesisVisual completo (conceptoBreve, formulaOReglaClave, ejemploBreve y mapaConceptual).',
          },
          `${label}-reparacion[${plan.sessionNumber}]`
        );
        const candidate = sanitizeSessionPlans(res, [plan.sessionNumber], ctx.fallbackContext)?.[0];
        if (!candidate) continue;
        const after = evaluateSessionPlanDensity(candidate, thresholds);
        const better =
          after.deficits.length < report.deficits.length ||
          (after.deficits.length === report.deficits.length && after.words > report.words);
        if (better) {
          sanitized = sanitized.map((p) => (p.sessionNumber === candidate.sessionNumber ? candidate : p));
          repaired.push(candidate.sessionNumber);
        }
      } catch (repairErr) {
        if (ctx.input.signal?.aborted) throw repairErr;
        if (isPoolExhaustedOrServiceError(repairErr)) {
          logger.warn(
            `[SessionShard] Deteniendo reparaciones de densidad de ${ctx.missionType} por agotamiento de cuota/servicio:`,
            { error: String(repairErr) }
          );
          break;
        }
        logger.warn(
          `[SessionShard] Falló la reparación de densidad de la sesión ${plan.sessionNumber}; seguirá deficiente (la misión fallará cerrada si persiste):`,
          { error: String(repairErr) }
        );
      }
    }
    if (repaired.length > 0 && ctx.input.onPartialSessionPlans) {
      try {
        await ctx.input.onPartialSessionPlans(sanitized);
      } catch {
        /* checkpoint incremental best-effort */
      }
    }
  }

  // Fail-closed: lanza IncompleteSessionPlansError si falta alguna sesión
  const plans = completeSessionPlans(sanitized, ctx.coveredSessions, ctx.fallbackContext);

  // Una cancelación no debe enmascararse como déficit de densidad.
  if (ctx.input.signal?.aborted) {
    throw ctx.input.signal.reason instanceof Error
      ? ctx.input.signal.reason
      : new DOMException('Generation aborted', 'AbortError');
  }

  const stillDeficient = plans
    .map((p) => ({ session: p.sessionNumber, report: evaluateSessionPlanDensity(p, thresholds) }))
    .filter((x) => !x.report.ok)
    .map((x) => ({ session: x.session, deficits: x.report.deficits }));
  if (stillDeficient.length > 0) {
    logger.error(
      `[SessionShard] ${ctx.missionType}: ${stillDeficient.length} sesión(es) siguen por debajo del umbral tras reparar (${stillDeficient.map((d) => d.session).join(', ')}). Fallo cerrado.`
    );
    throw new SessionDensityDeficiencyError({
      missionType: ctx.missionType,
      uacName: ctx.input.uacName,
      deficits: stillDeficient,
      repairedSessions: repaired,
      attemptedRepairs,
    });
  }

  return { plans, diagnostics: { packs, repairedSessions: repaired, stillDeficient: [] } };
}

/**
 * Regenera SOLO las sesiones indicadas (reparación quirúrgica de alineación) y las fusiona con las
 * existentes. Devuelve los planes completos de la misión; conserva el plan previo si la
 * regeneración falla o no mejora la cobertura (el gate downstream decide).
 */
export async function regenerateSessionsWithTerms(
  ctx: SessionShardContext,
  existing: SessionPlan[],
  termsBySession: Map<number, string[]>
): Promise<SessionPlan[]> {
  const entries = Array.from(termsBySession.entries()).filter(([n]) => ctx.coveredSessions.includes(n));
  if (entries.length === 0) return existing;
  const adapter = getDisciplinaryAdapter(
    ctx.input.uacName,
    ctx.input.component,
    ctx.input.curriculumName || ctx.input.careerOrProgramName
  );
  const thresholds = densityThresholdsFor(
    ctx.targetWordsPerPlan,
    adapter.family === 'cuantitativa_experimental',
    ctx.requireVisualSynthesis ?? true
  );
  const results = await Promise.allSettled(
    entries.map(([session, terms]) =>
      callPack(
        ctx,
        [session],
        {
          packTerms: terms,
          directive:
            'Esta sesión debe incorporar de forma natural los conceptos/saberes/materiales indicados arriba, conservando toda la profundidad y estructura exigidas.',
        },
        `${ctx.missionType}:sessions-alineacion[${session}]`
      )
    )
  );
  let merged = [...existing];
  results.forEach((res, idx) => {
    if (res.status !== 'fulfilled') return;
    const session = entries[idx][0];
    const candidate = sanitizeSessionPlans(res.value, [session], ctx.fallbackContext)?.[0];
    if (!candidate) return;
    const prev = merged.find((p) => p.sessionNumber === session);
    const candReport = evaluateSessionPlanDensity(candidate, thresholds);
    const prevReport = prev ? evaluateSessionPlanDensity(prev, thresholds) : null;
    // Se acepta si no empeora la densidad (la cobertura de términos es el motivo de la reparación)
    if (!prevReport || candReport.deficits.length <= prevReport.deficits.length) {
      merged = merged.map((p) => (p.sessionNumber === session ? candidate : p));
    }
  });
  return merged.sort((a, b) => a.sessionNumber - b.sessionNumber);
}

/**
 * Aplica reparación quirúrgica de sesiones sobre un `WriterOutput` previo (Fase 8.5):
 * regenera únicamente las sesiones indicadas en `termsBySession` y conserva intacta la
 * narrativa de la misión y el resto de sesiones. Si ninguna sesión de esta misión
 * requiere reparación, devuelve `previous` sin realizar llamadas de IA.
 */
export async function applySurgicalSessionRepair(
  ctx: SessionShardContext,
  previous: WriterOutput,
  termsBySession: Map<number, string[]>
): Promise<WriterOutput> {
  const existingPlans = previous.section.sessionPlans ?? [];
  const updatedPlans = await regenerateSessionsWithTerms(ctx, existingPlans, termsBySession);
  if (updatedPlans === existingPlans) return previous;
  const oldPlansWords = existingPlans.reduce((acc, p) => acc + countSessionPlanWords(p), 0);
  const newPlansWords = updatedPlans.reduce((acc, p) => acc + countSessionPlanWords(p), 0);
  const narrativeWords = Math.max(0, previous.wordCount - oldPlansWords);
  const totalWords = narrativeWords + newPlansWords;
  return {
    ...previous,
    wordCount: totalWords,
    tokensUsed: Math.round(totalWords * 1.3),
    section: {
      ...previous.section,
      sessionPlans: updatedPlans,
      wordCount: totalWords,
    },
  };
}


