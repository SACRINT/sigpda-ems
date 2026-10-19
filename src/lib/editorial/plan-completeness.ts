/**
 * plan-completeness.ts — Auto-sanación de integridad editorial con IA
 * SIGPDA-EMS · Motor Editorial de Alta Gama
 *
 * Problema (bug 54/72): los writers de IA generaron planes con los campos mínimos
 * del StudentSessionSchema incompletos (12 sesiones sin recursos de ampliación y
 * 6 con 1 sola pregunta de autoevaluación) y el compose los descartaba en silencio.
 *
 * Solución en capas (garantía "el libro SIEMPRE sale 72/72"):
 *  1. Reparación dirigida con IA: UNA sola llamada por intento (lote de todas las
 *     sesiones faltantes), reintentos SOLO sobre las que sigan fallando, dentro de
 *     un presupuesto de tiempo (deadline). La IA genera recursos reales (con URLs
 *     https verificables o búsqueda de YouTube del tema) y preguntas de autoevaluación.
 *  2. Red de seguridad determinista: lo que la IA no logre dentro del deadline se
 *     completa con recursos del catálogo oficial (GeoGebra/Desmos/Polypad) y
 *     preguntas estándar — sin esto el libro podría salir incompleto otra vez.
 *  3. Persistencia en workbooks_json (saveBlockWorkbook) para que la reparación sea
 *     durable: la siguiente exportación no vuelve a pagar el costo.
 *
 * Corre DENTRO de la exportación editorial, ANTES del compose. Si no hay issues,
 * no cuesta ni una llamada de IA (camino rápido).
 */

import { logger } from '@/lib/logger';
import { generateWithRotation } from '@/lib/ai-provider';
import { saveBlockWorkbook } from '@/lib/db/workbooks';
import {
  detectPlanRepairNeeds,
  enforceEditorialSoftMinimums,
  validRecursos,
} from './session-plan-minimums';
import type { ActiveWorkTextbook, SessionPlan } from '@/types/work-textbook';

interface WorkbookBlockShape {
  version?: number;
  history?: unknown[];
  current?: {
    missions?: Array<{ title?: string; sessionPlans?: SessionPlan[] }>;
  } | null;
}

export type WorkbooksJsonShape = Record<string, WorkbookBlockShape | null>;

export interface CompletenessRepairArgs {
  workbooksJson: WorkbooksJsonShape | null | undefined;
  planningId: string;
  uacName?: string | null;
  teacherId?: string;
  /** Presupuesto total de la reparación (default 24 s, respeta maxDuration=60 s de la ruta). */
  deadlineMs?: number;
  /** Intentos máximos de IA (default 3); cada intento repara en lote lo que falte. */
  maxAttempts?: number;
}

export interface CompletenessRepairResult {
  workbooksJson: WorkbooksJsonShape;
  /** Issues blandos detectados en la entrada. */
  issuesFound: number;
  /** Llamadas de IA realmente realizadas (0 en camino rápido). */
  aiCalls: number;
  /** Sesiones cuyos campos faltantes completó la IA. */
  aiRepaired: number;
  /** Sesiones completadas con la red determinista tras agotar IA/deadline. */
  fallbackPads: number;
  /** Sesiones que siguen inválidas (catálogo roto u otro fallo extremo). */
  unresolved: number;
  /** true si el resultado se persistió en workbooks_json. */
  persisted: boolean;
  mode: 'noop' | 'ai' | 'fallback';
}

export interface CompletenessDeps {
  generateFn?: (
    systemPrompt: string,
    userPrompt: string,
    teacherId?: string,
    isPremium?: boolean,
    options?: { temperature?: number; jsonMode?: boolean; maxTokens?: number },
  ) => Promise<string>;
  saveFn?: (
    planningId: string,
    blockIndex: number,
    workbook: ActiveWorkTextbook,
  ) => Promise<{ version: number; success: boolean; error?: string }>;
}

interface IssueRef {
  blockIndex: number;
  blockKey: string;
  sessionNumber: number;
  parent: SessionPlan[];
  idx: number;
  plan: SessionPlan;
  needsRecursos: boolean;
  needsAutoeval: boolean;
}

const SYSTEM_PROMPT =
  'Eres editor pedagógico senior de libros de texto de bachillerato (MCCEMS, México). ' +
  'Respondes EXCLUSIVAMENTE con JSON válido: sin markdown, sin comentarios, sin texto fuera del JSON.';

const MIN_AI_HEADROOM_MS = 9000;

function collectIssues(workbooks: WorkbooksJsonShape): IssueRef[] {
  const issues: IssueRef[] = [];
  const blockKeys = Object.keys(workbooks)
    .filter((k) => /^block_\d+$/.test(k))
    .sort((a, b) => Number(a.slice(6)) - Number(b.slice(6)));

  for (const key of blockKeys) {
    const missions = workbooks[key]?.current?.missions ?? [];
    for (const mission of missions) {
      const parent = mission?.sessionPlans;
      if (!Array.isArray(parent)) continue;
      for (let idx = 0; idx < parent.length; idx++) {
        const plan = parent[idx];
        if (!plan) continue;
        const needs = detectPlanRepairNeeds(plan);
        if (needs.needsRecursos || needs.needsAutoeval) {
          issues.push({
            blockIndex: Number(key.slice(6)),
            blockKey: key,
            sessionNumber: plan.sessionNumber,
            parent,
            idx,
            plan,
            needsRecursos: needs.needsRecursos,
            needsAutoeval: needs.needsAutoeval,
          });
        }
      }
    }
  }
  return issues;
}

function buildUserPrompt(issues: IssueRef[], uacName: string | null | undefined): string {
  const sessions = issues.map((i) => ({
    blockIndex: i.blockIndex,
    sessionNumber: i.sessionNumber,
    objetivo: (i.plan.objetivo || '').slice(0, 220),
    contenido: (i.plan.contenido || '').slice(0, 320),
    falta: [
      ...(i.needsRecursos ? ['recursos'] : []),
      ...(i.needsAutoeval ? ['autoevaluacion'] : []),
    ],
  }));

  return [
    `Libro de texto: ${uacName || 'Pensamiento Matemático'}.`,
    '',
    'Completa SOLO los campos indicados ("falta") de cada sesión:',
    '- recursos: 1-2 objetos {"titulo", "url", "tipo"} con URLs REALES https:// que conozcas (video de YouTube o página web educativa).',
    '  Si no recuerdas un enlace exacto, usa la búsqueda de YouTube del tema: https://www.youtube.com/results?search_query=<temas en minúsculas y guiones>. NUNCA inventes dominios.',
    '- tipo: "video" para YouTube, "web" para páginas, "lectura" para artículos.',
    '- autoevaluacion: 1-2 preguntas cortas en voz del estudiante (tú), que empiecen con "¿" y tengan mínimo 10 caracteres.',
    '',
    'Devuelve SOLO un arreglo JSON con objetos {"blockIndex": <n>, "sessionNumber": <n>, "recursos": [...], "autoevaluacion": [...]}',
    'repitiendo exactamente el blockIndex y sessionNumber de entrada e incluyendo SOLO los campos en "falta".',
    '',
    'SESIONES:',
    JSON.stringify(sessions),
  ].join('\n');
}

function parseAiArray(text: string): unknown[] | null {
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const start = t.indexOf('[');
  const end = t.lastIndexOf(']');
  if (start < 0 || end <= start) return null;
  try {
    const value = JSON.parse(t.slice(start, end + 1));
    return Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

function validAiRecursos(raw: unknown): Array<{ titulo: string; url: string; tipo: 'video' | 'web' | 'lectura' }> {
  if (!Array.isArray(raw)) return [];
  const out: Array<{ titulo: string; url: string; tipo: 'video' | 'web' | 'lectura' }> = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const rr = r as Record<string, unknown>;
    const titulo = typeof rr.titulo === 'string' ? rr.titulo.trim() : '';
    const url = typeof rr.url === 'string' ? rr.url.trim() : '';
    if (titulo.length < 4 || !/^https?:\/\/\S+$/i.test(url)) continue;
    try {
      new URL(url);
    } catch {
      continue;
    }
    const tipo = rr.tipo === 'video' || rr.tipo === 'lectura' ? rr.tipo : 'web';
    out.push({ titulo, url, tipo });
  }
  return out.slice(0, 3);
}

function validAiAutoeval(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s): s is string => typeof s === 'string' && s.trim().length >= 10)
    .map((s) => s.trim())
    .slice(0, 3);
}

/**
 * Repara la integridad mínima de los sessionPlans de un bloque de trabajo.
 * Ver docstring del módulo para la estrategia en capas.
 */
export async function ensureEditorialPlanCompleteness(
  args: CompletenessRepairArgs,
  deps: CompletenessDeps = {},
): Promise<CompletenessRepairResult> {
  const generateFn = deps.generateFn ?? generateWithRotation;
  const saveFn = deps.saveFn ?? saveBlockWorkbook;
  const deadlineMs = args.deadlineMs ?? 24_000;
  const maxAttempts = args.maxAttempts ?? 3;
  const empty: WorkbooksJsonShape = {};

  const source = args.workbooksJson;
  if (!source || typeof source !== 'object' || Object.keys(source).length === 0) {
    return { workbooksJson: empty, issuesFound: 0, aiCalls: 0, aiRepaired: 0, fallbackPads: 0, unresolved: 0, persisted: false, mode: 'noop' };
  }

  const initialIssues = collectIssues(source);
  if (initialIssues.length === 0) {
    return {
      workbooksJson: source,
      issuesFound: 0,
      aiCalls: 0,
      aiRepaired: 0,
      fallbackPads: 0,
      unresolved: 0,
      persisted: false,
      mode: 'noop',
    };
  }

  // Trabajamos SIEMPRE sobre una copia: nunca se muta el objeto original.
  const clone = structuredClone(source) as WorkbooksJsonShape;
  const touchedBlocks = new Set<number>();
  const aiRepairedKeys = new Set<string>();
  const deadlineAt = Date.now() + deadlineMs;
  let aiCalls = 0;

  let issues = collectIssues(clone);

  // ── Capa 1: reparación con IA en lote + reintentos solo sobre pendientes ──
  for (let attempt = 1; attempt <= maxAttempts && issues.length > 0; attempt++) {
    if (Date.now() > deadlineAt - MIN_AI_HEADROOM_MS) {
      logger.warn('[plan-completeness] Deadline alcanzado antes de un intento de IA; se usa red determinista.', {
        attempt,
        pending: issues.length,
        deadlineMs,
      });
      break;
    }

    try {
      aiCalls++; // cuenta el intento aunque el proveedor falle (métrica de esfuerzo)
      const raw = await generateFn(
        SYSTEM_PROMPT,
        buildUserPrompt(issues, args.uacName),
        args.teacherId,
        true,
        { jsonMode: true, temperature: 0.4, maxTokens: 3000 },
      );
      const items = parseAiArray(raw ?? '');
      if (!items) {
        logger.warn('[plan-completeness] La IA no devolvió JSON de arreglo válido; se reintenta.', { attempt });
        continue;
      }

      for (const item of items) {
        if (!item || typeof item !== 'object') continue;
        const it = item as Record<string, unknown>;
        const blockIndex = Number(it.blockIndex);
        const sessionNumber = Number(it.sessionNumber);
        const issue = issues.find(
          (i) => i.blockIndex === blockIndex && i.sessionNumber === sessionNumber,
        );
        if (!issue) continue;

        let changed = false;
        if (issue.needsRecursos) {
          const aiRecursos = validAiRecursos(it.recursos);
          if (aiRecursos.length > 0) {
            issue.plan.recursos = [...validRecursos(issue.plan), ...aiRecursos].slice(0, 3);
            issue.needsRecursos = false;
            changed = true;
          }
        }
        if (issue.needsAutoeval) {
          const aiAuto = validAiAutoeval(it.autoevaluacion);
          const existing = (Array.isArray(issue.plan.autoevaluacion) ? issue.plan.autoevaluacion : []).filter(
            (s): s is string => typeof s === 'string',
          );
          if (existing.length + aiAuto.length >= 2) {
            issue.plan.autoevaluacion = [...existing, ...aiAuto].slice(0, 2);
            issue.needsAutoeval = false;
            changed = true;
          }
        }
        if (changed) {
          aiRepairedKeys.add(`${issue.blockIndex}#${issue.sessionNumber}`);
          touchedBlocks.add(issue.blockIndex);
        }
      }
    } catch (error) {
      logger.warn('[plan-completeness] Fallo de IA durante la reparación; se continúa con redeterminista/reintento.', {
        attempt,
        error: error instanceof Error ? error.message : String(error),
      });
      break; // Caída de proveedor: no reintentar IA ciegamente; la red de seguridad cubre.
    }

    issues = collectIssues(clone);
  }

  // ── Capa 2: red de seguridad determinista (catálogo + defaults) ──
  let fallbackPads = 0;
  issues = collectIssues(clone);
  for (const issue of issues) {
    const enforced = enforceEditorialSoftMinimums(issue.plan);
    if (enforced !== issue.plan) {
      issue.parent[issue.idx] = enforced;
      fallbackPads++;
      touchedBlocks.add(issue.blockIndex);
    }
  }

  const unresolvedIssues = collectIssues(clone);
  if (unresolvedIssues.length > 0) {
    logger.error('[plan-completeness] Sesiones que siguen inválidas tras la reparación (la exportación devolverá 422):', {
      sessions: unresolvedIssues.map((i) => `${i.blockKey}#${i.sessionNumber}`),
    });
  }

  // ── Capa 3: persistencia durable en workbooks_json ──
  let persisted = false;
  if (touchedBlocks.size > 0) {
    let allOk = true;
    for (const blockIndex of touchedBlocks) {
      const current = clone[`block_${blockIndex}`]?.current;
      if (!current) continue;
      try {
        const res = await saveFn(args.planningId, blockIndex, current as unknown as ActiveWorkTextbook);
        if (!res.success) {
          allOk = false;
          logger.warn('[plan-completeness] saveBlockWorkbook reportó fallo (la reparación seguirá en memoria para esta exportación).', {
            blockIndex,
            error: res.error,
          });
        }
      } catch (error) {
        allOk = false;
        logger.warn('[plan-completeness] Excepción al persistir reparación (sigue en memoria para esta exportación).', {
          blockIndex,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    persisted = allOk;
  }

  const mode: CompletenessRepairResult['mode'] = aiRepairedKeys.size > 0 ? 'ai' : fallbackPads > 0 ? 'fallback' : 'noop';
  const result: CompletenessRepairResult = {
    workbooksJson: clone,
    issuesFound: initialIssues.length,
    aiCalls,
    aiRepaired: aiRepairedKeys.size,
    fallbackPads,
    unresolved: unresolvedIssues.length,
    persisted,
    mode,
  };

  logger.info('[plan-completeness] Reparación de integridad editorial completada:', {
    planningId: args.planningId,
    issuesFound: result.issuesFound,
    aiCalls: result.aiCalls,
    aiRepaired: result.aiRepaired,
    fallbackPads: result.fallbackPads,
    unresolved: result.unresolved,
    persisted: result.persisted,
    mode: result.mode,
  });

  return result;
}
