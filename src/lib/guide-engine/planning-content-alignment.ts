/**
 * planning-content-alignment.ts — Alineación DURA planeación ↔ libro del estudiante
 * SIGPDA-EMS — SEMS Puebla MCCEMS 2026-2027
 *
 * Verificación DETERMINISTA (0 tokens de IA) de que el contenido generado por los
 * writers efectivamente cubre lo planificado en la planeación didáctica:
 *
 *  1. CONTENIDO FORMATIVO (Sección IV, bloque actual) → corpus completo del libro.
 *  2. SABERES (Teórico/Procedimental/Actitudinal) → corpus de EVALUACIÓN del libro
 *     (rúbrica, cuestionario, checklist, checkpoints, autoevaluación de sesiones).
 *  3. MATERIALES de las 3 momentos → corpus completo del libro.
 *
 * Cada ítem se evalúa por frase exacta (normalizada) o por cobertura de palabras
 * distintivas (≥70%). El reporte permite al orquestador inyectar términos faltantes
 * en UN reintento dirigido y, si persiste el hueco, marcar `qualityWarning`.
 */

import type {
  ActiveWorkTextbook,
  MissionSection,
  ProjectSection,
  EvaluationSection,
} from '@/types/work-textbook';
import type { PlanningActivities } from './writers/writer-contract';

export interface AlignmentCorpusSource {
  missions?: MissionSection[] | null;
  evaluationSection?: EvaluationSection | null;
  projectSection?: ProjectSection | null;
}

export interface AlignmentCheck {
  id: 'contenido' | 'saberes' | 'materiales';
  label: string;
  total: number;
  covered: number;
  /** 0..1 — 1 cuando el check está vacío (sin nada que verificar). */
  coverage: number;
  skipped: boolean;
  /** Redacción ORIGINAL de los ítems sin cubrir (para el reintento dirigido). */
  missing: string[];
}

export interface PlanningContentAlignmentReport {
  /** 0..100 ponderado (contenido 50%, saberes 30%, materiales 20%). */
  score: number;
  pass: boolean;
  threshold: number;
  checks: AlignmentCheck[];
  summary: string;
}

const DEFAULT_THRESHOLD = 60;
const COVERAGE_RATIO = 0.7;
const WEIGHTS: Record<AlignmentCheck['id'], number> = {
  contenido: 0.5,
  saberes: 0.3,
  materiales: 0.2,
};

const STOPWORDS = new Set([
  'para', 'como', 'pero', 'este', 'esta', 'estos', 'estas', 'mas', 'del', 'con',
  'una', 'uno', 'unos', 'unas', 'los', 'las', 'por', 'que', 'segun', 'entre',
  'sobre', 'desde', 'hacia', 'todo', 'todos', 'cada', 'dos', 'tres', 'sus',
  'mismo', 'misma', 'aquel', 'aquella', 'cuando', 'donde', 'cual', 'cuales',
  'debe', 'deben', 'puede', 'pueden', 'sera', 'sea', 'haya', 'muy',
]);

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function distinctiveWords(s: string): string[] {
  return normalize(s)
    .split(' ')
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
}

/** Divide listas de la planeación en ítems individuales. */
function splitItems(raw: string | null | undefined, opts: { minLen: number; forceComma?: boolean }): string[] {
  if (!raw) return [];
  let parts = raw.split(/[;\n•]+/).map((s) => s.trim()).filter(Boolean);
  if ((parts.length === 1 && raw.length > 160) || opts.forceComma) {
    parts = parts.flatMap((p) => p.split(/,/g)).map((s) => s.trim()).filter(Boolean);
  }
  return parts.filter((p) => p.length >= opts.minLen);
}

/** Recolecta todo string del árbol, excluyendo `solucion` (no se imprime al estudiante). */
function walkStrings(value: unknown, out: string[], skipKeys: Set<string>): void {
  if (typeof value === 'string') {
    if (value.trim()) out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const v of value) walkStrings(v, out, skipKeys);
    return;
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (skipKeys.has(k)) continue;
      walkStrings(v, out, skipKeys);
    }
  }
}

const STUDENT_SKIP_KEYS = new Set(['solucion']);

function buildFullCorpus(source: AlignmentCorpusSource): string {
  const parts: string[] = [];
  walkStrings(source.missions ?? [], parts, STUDENT_SKIP_KEYS);
  walkStrings(source.evaluationSection ?? null, parts, STUDENT_SKIP_KEYS);
  walkStrings(source.projectSection ?? null, parts, STUDENT_SKIP_KEYS);
  return normalize(parts.join(' \n '));
}

function buildEvaluationCorpus(source: AlignmentCorpusSource): string {
  const parts: string[] = [];
  walkStrings(source.evaluationSection ?? null, parts, STUDENT_SKIP_KEYS);
  for (const m of source.missions ?? []) {
    walkStrings(m.formativeCheckpoint ?? null, parts, STUDENT_SKIP_KEYS);
    for (const p of m.sessionPlans ?? []) walkStrings(p.autoevaluacion ?? [], parts, STUDENT_SKIP_KEYS);
  }
  return normalize(parts.join(' \n '));
}

function itemCovered(item: string, corpusNorm: string, corpusWords: Set<string>): boolean {
  const normItem = normalize(item);
  if (normItem.length >= 4 && corpusNorm.includes(normItem)) return true;
  const words = distinctiveWords(item);
  if (words.length === 0) return corpusNorm.includes(normItem);
  const hit = words.filter((w) => corpusWords.has(w)).length;
  return hit / words.length >= COVERAGE_RATIO;
}

function wordsOf(corpusNorm: string): Set<string> {
  const set = new Set<string>();
  for (const w of corpusNorm.split(' ')) if (w.length >= 4) set.add(w);
  return set;
}

function runCheck(
  id: AlignmentCheck['id'],
  label: string,
  items: string[],
  corpusNorm: string
): AlignmentCheck {
  const corpusWords = wordsOf(corpusNorm);
  const missing = items.filter((it) => !itemCovered(it, corpusNorm, corpusWords));
  const total = items.length;
  const covered = total - missing.length;
  return {
    id,
    label,
    total,
    covered,
    coverage: total === 0 ? 1 : covered / total,
    skipped: total === 0,
    missing,
  };
}

/**
 * Evalúa la alineación dura entre las actividades de la planeación (Sección IV del
 * bloque) y el contenido efectivamente generado en el libro.
 */
export function evaluatePlanningContentAlignment(
  source: AlignmentCorpusSource,
  activities: PlanningActivities | undefined | null,
  threshold = DEFAULT_THRESHOLD
): PlanningContentAlignmentReport {
  if (!activities) {
    return {
      score: 100,
      pass: true,
      threshold,
      checks: [],
      summary: 'Sin actividades de planeación para este bloque — nada que verificar.',
    };
  }

  const fullCorpus = buildFullCorpus(source);
  const evalCorpus = buildEvaluationCorpus(source);

  const contenidoItems = splitItems(activities.contenidoFormativo, { minLen: 15 });
  const saberesItems = [
    ...splitItems(activities.saberes?.saber, { minLen: 15 }),
    ...splitItems(activities.saberes?.saberHacer, { minLen: 15 }),
    ...splitItems(activities.saberes?.saberSer, { minLen: 15 }),
  ];
  const materialesItems = [
    ...splitItems(activities.apertura?.materials, { minLen: 4, forceComma: true }),
    ...splitItems(activities.ejecucion?.materials, { minLen: 4, forceComma: true }),
    ...splitItems(activities.conclusion?.materials, { minLen: 4, forceComma: true }),
  ];

  const checks: AlignmentCheck[] = [
    runCheck('contenido', 'Contenido formativo → texto del libro', contenidoItems, fullCorpus),
    runCheck('saberes', 'Saberes planeados → sección de evaluación del libro', saberesItems, evalCorpus),
    runCheck('materiales', 'Materiales planeados → texto del libro', materialesItems, fullCorpus),
  ];

  // Ponderación dinámica: los checks sin ítems redistribuyen su peso.
  const active = checks.filter((c) => !c.skipped);
  const weightSum = active.reduce((acc, c) => acc + WEIGHTS[c.id], 0);
  const score =
    weightSum === 0
      ? 100
      : Math.round(
          active.reduce((acc, c) => acc + c.coverage * WEIGHTS[c.id], 0) * (100 / weightSum)
        );

  const missingCount = checks.reduce((acc, c) => acc + (c.skipped ? 0 : c.total - c.covered), 0);
  const pass = score >= threshold;
  const summary = pass
    ? `Alineación planeación↔libro ${score}/100 (umbral ${threshold}). Ítems sin cubrir: ${missingCount}.`
    : `Alineación planeación↔libro ${score}/100 < umbral ${threshold}. Ítems sin cubrir: ${missingCount}: ` +
      checks.flatMap((c) => c.missing).slice(0, 8).join(' | ');

  return { score, pass, threshold, checks, summary };
}

/** Términos faltantes (redacción original, acotada) para inyectar en el reintento. */
export function extractMissingTerms(report: PlanningContentAlignmentReport, maxTerms = 12): string[] {
  return report.checks
    .flatMap((c) => c.missing)
    .map((m) => (m.length > 180 ? `${m.slice(0, 177)}...` : m))
    .slice(0, maxTerms);
}

/** Construye un fuente de corpus mínimo a partir de las secciones de un writer. */
export function sourceFromSections(
  missions: MissionSection[],
  evaluationSection?: EvaluationSection | null,
  projectSection?: ProjectSection | null
): AlignmentCorpusSource {
  return { missions, evaluationSection: evaluationSection ?? null, projectSection: projectSection ?? null };
}

/** Texto normalizado de una sola sección (para decidir qué writer re-ejecutar). */
export function sectionCorpus(section: unknown): string {
  const parts: string[] = [];
  walkStrings(section, parts, STUDENT_SKIP_KEYS);
  return normalize(parts.join(' \n '));
}

/** ¿El corpus (ya normalizado) cubre el término dado? Frase exacta o ≥70% de palabras. */
export function corpusCoversTerm(corpusNorm: string, term: string): boolean {
  return itemCovered(term, corpusNorm, wordsOf(corpusNorm));
}

/** Conveniencia: fuente directa desde un ActiveWorkTextbook completo. */
export function sourceFromWorkbook(workbook: ActiveWorkTextbook): AlignmentCorpusSource {
  return {
    missions: workbook.missions ?? [],
    evaluationSection: workbook.evaluationSection ?? null,
    projectSection: workbook.projectSection ?? null,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Alineación PREVENTIVA: términos requeridos desde la primera pasada
// ───────────────────────────────────────────────────────────────────────────

export type WriterRole = 'foundation' | 'lab' | 'project' | 'evaluation';

export interface RequiredCurricularTerms {
  /** Contenido formativo del bloque (se verifica contra el corpus completo del libro). */
  contenido: string[];
  /** Saberes (se verifican contra el corpus de EVALUACIÓN del libro). */
  saberes: string[];
  /** Materiales planeados (se verifican contra el corpus completo del libro). */
  materiales: string[];
}

function dedupeKeepOrder(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const it of items) {
    const key = normalize(it);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

function clipTerm(term: string, max = 180): string {
  return term.length > max ? `${term.slice(0, max - 3)}...` : term;
}

/**
 * Extrae, con la MISMA segmentación que usa el gate de alineación (evaluatePlanningContentAlignment),
 * los ítems de la planeación que el libro deberá cubrir. Determinista y agnóstico a la asignatura.
 */
export function extractRequiredCurricularTerms(
  activities: PlanningActivities | undefined | null
): RequiredCurricularTerms {
  if (!activities) return { contenido: [], saberes: [], materiales: [] };
  const contenido = dedupeKeepOrder(splitItems(activities.contenidoFormativo, { minLen: 15 })).map((t) => clipTerm(t));
  const saberes = dedupeKeepOrder([
    ...splitItems(activities.saberes?.saber, { minLen: 15 }),
    ...splitItems(activities.saberes?.saberHacer, { minLen: 15 }),
    ...splitItems(activities.saberes?.saberSer, { minLen: 15 }),
  ]).map((t) => clipTerm(t));
  const materiales = dedupeKeepOrder([
    ...splitItems(activities.apertura?.materials, { minLen: 4, forceComma: true }),
    ...splitItems(activities.ejecucion?.materials, { minLen: 4, forceComma: true }),
    ...splitItems(activities.conclusion?.materials, { minLen: 4, forceComma: true }),
  ]).map((t) => clipTerm(t, 120));
  return { contenido, saberes, materiales };
}

/**
 * Reparte los términos entre los redactores de forma determinista (round-robin), de modo que
 * CADA término tenga al menos un redactor responsable sin que todos repitan toda la lista:
 *  - saberes → evaluación (el gate los verifica en el corpus de evaluación);
 *  - contenido → los redactores que existan, en round-robin;
 *  - materiales → redactores no evaluadores (foundation/lab/project), en round-robin.
 */
export function partitionRequiredTerms(
  terms: RequiredCurricularTerms,
  roles: WriterRole[] = ['foundation', 'lab', 'project', 'evaluation']
): Record<WriterRole, string[]> {
  const out: Record<WriterRole, string[]> = { foundation: [], lab: [], project: [], evaluation: [] };
  const active = roles.filter((r) => roles.includes(r));
  if (active.length === 0) return out;

  const evaluators = active.filter((r) => r === 'evaluation');
  const nonEval = active.filter((r) => r !== 'evaluation');
  const saberOwners = evaluators.length > 0 ? evaluators : active;
  terms.saberes.forEach((t, i) => out[saberOwners[i % saberOwners.length]].push(t));
  terms.contenido.forEach((t, i) => out[active[i % active.length]].push(t));
  const matOwners = nonEval.length > 0 ? nonEval : active;
  terms.materiales.forEach((t, i) => out[matOwners[i % matOwners.length]].push(t));

  for (const r of active) out[r] = dedupeKeepOrder(out[r]);
  return out;
}

/** Redacta la directiva preventiva (misma convención que el reintento dirigido). */
export function formatRequiredTermsDirective(terms: string[]): string {
  if (terms.length === 0) return '';
  return (
    'CONCEPTOS, SABERES Y MATERIALES DE LA PLANEACION ASIGNADOS A TU SECCION (intégralos de forma orgánica y ' +
    'contextualizada, reproduciendo su redaccion original al menos una vez; no los enumeres como lista ni los repitas ' +
    'mecánicamente): ' +
    terms.join(' | ')
  );
}

/**
 * Asigna términos faltantes a sesiones concretas de una misión (round-robin) para repararlas de forma
 * quirúrgica. Devuelve únicamente las sesiones que recibieron al menos un término.
 */
export function assignTermsToSessions(terms: string[], sessionNumbers: number[]): Map<number, string[]> {
  const map = new Map<number, string[]>();
  if (terms.length === 0 || sessionNumbers.length === 0) return map;
  terms.forEach((t, i) => {
    const session = sessionNumbers[i % sessionNumbers.length];
    map.set(session, [...(map.get(session) ?? []), t]);
  });
  return map;
}
