/**
 * compose-student-sessions.ts — Composición del capítulo editorial de estudiante
 * desde plannings.workbooks_json (block_N.current.missions[].sessionPlans).
 *
 * Historia (bug 54/72): el compose original DESCARTABA en silencio los planes que
 * no validaban StudentSessionSchema (18 sesiones:12 sin recursos y 6 con 1 solo
 * punto de autoevaluación) y renumeraba 1..N, produciendo un libro de 54 sesiones
 * con numeración desplazada respecto del compendio.
 *
 * Contrato actual:
 *  1. Los recursos faltantes solo se completan con entradas REALES del catálogo.
 *     Autoevaluación, pistas y campos teóricos NO se rellenan con texto genérico.
 *  2. Si un plan falla por contenido genérico, teórico o práctico duro, se registra
 *     en `dropped` y la ruta aborta con 422 explícito — jamás se publica un libro
 *     parcial ni con relleno sintético en silencio.
 *  3. Numeración global 1..N con remapeo de referencias (offset = global − local).
 */

import { logger } from '@/lib/logger';
import {
  StudentSessionSchema,
  adaptSessionPlanToStudentSession,
  remapSessionReferencesDeep,
} from './student-content-model';
import { enforceEditorialSoftMinimums } from './session-plan-minimums';
import { findGenericContent } from '@/lib/guide-engine/quality/no-generic-content';
import type { StudentSession } from './student-content-model';
import type { SessionPlan } from '@/types/work-textbook';

export interface DroppedSession {
  blockKey: string;
  sessionNumber: number;
  issues: string[];
}

export interface ComposedStudentSessions {
  sessions: StudentSession[];
  blocksPresent: number[];
  /** Planes que fallaron por reglas DURAS (contenido corrupto) → la ruta responde 422. */
  dropped: DroppedSession[];
  /** Total de planes leídos en workbooks_json. */
  totalPlans: number;
  /** Cuántos planes recibieron un recurso REAL del catálogo (sin relleno textual). */
  padded: number;
}

/**
 * Compone las sesiones del estudiante desde los libros de bloque persistidos
 * en plannings.workbooks_json, ordenando por bloque y sessionNumber y renumerando
 * 1..N para cumplir el invariante anti-F11 (continuidad estricta).
 */
export function composeStudentSessionsFromWorkbooks(rawPlanning: {
  workbooks_json?: Record<string, { current?: { missions?: unknown[] } } | null> | null;
}): ComposedStudentSessions {
  const workbooks = rawPlanning.workbooks_json;
  if (!workbooks || typeof workbooks !== 'object') {
    return { sessions: [], blocksPresent: [], dropped: [], totalPlans: 0, padded: 0 };
  }

  const blockKeys = Object.keys(workbooks)
    .filter((key) => /^block_\d+$/.test(key))
    .sort((a, b) => Number(a.slice('block_'.length)) - Number(b.slice('block_'.length)));

  const plans: Array<{ blockKey: string; plan: SessionPlan }> = [];
  const blocksPresent: number[] = [];

  for (const key of blockKeys) {
    const missions = (workbooks[key]?.current?.missions ?? []) as Array<{
      sessionPlans?: SessionPlan[];
    }>;
    const blockPlans = missions.flatMap((mission) =>
      Array.isArray(mission?.sessionPlans) ? mission.sessionPlans : [],
    );
    if (blockPlans.length === 0) continue;

    blocksPresent.push(Number(key.slice('block_'.length)));
    // Orden por sessionNumber DENTRO de cada bloque (la numeración global se
    // reasigna después por posición: bloques 0→1→2 y, en cada uno, 1..24).
    blockPlans.sort((a, b) => (a?.sessionNumber || 0) - (b?.sessionNumber || 0));
    for (const plan of blockPlans) plans.push({ blockKey: key, plan });
  }

  const validSessions: StudentSession[] = [];
  const dropped: DroppedSession[] = [];
  let padded = 0;

  for (const { blockKey, plan } of plans) {
    // Red de seguridad de recursos: SOLO catálogo real, nunca texto genérico.
    const prepared = enforceEditorialSoftMinimums(plan);
    if (prepared !== plan) padded++;

    // Gate anti-genérico: un plan con relleno sintético es inválido DURO.
    // No se publica un libro con contenido de contingencia aunque el schema pase.
    const genericIssues = findGenericContent(prepared, `session_${plan?.sessionNumber ?? '?'}`);
    if (genericIssues.length > 0) {
      dropped.push({
        blockKey,
        sessionNumber: plan?.sessionNumber ?? -1,
        issues: genericIssues.map((issue) => `${issue.path}: ${issue.label}`),
      });
      continue;
    }

    try {
      const parsed = StudentSessionSchema.safeParse(adaptSessionPlanToStudentSession(prepared));
      if (parsed.success) {
        validSessions.push(parsed.data);
      } else {
        dropped.push({
          blockKey,
          sessionNumber: plan?.sessionNumber ?? -1,
          issues: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
        });
      }
    } catch (error) {
      dropped.push({
        blockKey,
        sessionNumber: plan?.sessionNumber ?? -1,
        issues: [
          `adaptación SessionPlan→StudentSession falló: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ],
      });
    }
  }

  if (dropped.length > 0) {
    logger.error('[editorial/compose] Sesiones con contenido DURAMENTE inválido (la exportación se abortará con 422):', {
      dropped: dropped.map((d) => `${d.blockKey} sesión local ${d.sessionNumber}`),
      issues: dropped.map((d) => ({ session: d.sessionNumber, issues: d.issues })),
    });
  }
  if (padded > 0) {
    logger.warn('[editorial/compose] Red de seguridad determinista aplicada (campos blandos reparados):', {
      padded,
      totalPlans: plans.length,
      note: 'Si el reparador IA no cubrió estas sesiones, revisar logs de plan-completeness.',
    });
  }

  // Fase C — numeración global: los sessionPlans citan sesiones con numeración LOCAL
  // por bloque (1..24). Al componer con numeración global 1..N, cada referencia en
  // prosa se desplaza por el offset real (global − local) para coherencia total.
  const sessions = validSessions.map((session, index) => {
    const globalNumber = index + 1;
    const offset = globalNumber - session.numero;
    const remapped = offset !== 0 ? remapSessionReferencesDeep(session, offset) : session;
    return {
      ...remapped,
      numero: globalNumber,
      titulo: remapped.titulo.replace(/^Sesión \d+:\s*/, `Sesión ${globalNumber}: `),
    };
  });

  return { sessions, blocksPresent, dropped, totalPlans: plans.length, padded };
}
