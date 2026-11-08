/**
 * planning-extras-for-block.ts — Selección determinista de extras por bloque curricular.
 * SIGPDA-EMS · Base de la descarga unificada "N en 1" por bloque.
 *
 * Funciones puras (sin BD) para poder probarlas de forma aislada.
 *
 * Esquemas de `key_index` soportados (nunca se mezclan, para no contaminar bloques):
 *  - CANÓNICO: key_index ∈ {0,1,2,null} → es el índice de bloque. Coincidencia exacta.
 *  - HEREDADO: aparece algún key_index > 2 → es el índice de actividad/progresión;
 *    se asigna al bloque cuyo `activityIndices` lo contiene.
 */

import { resolveCurricularBlocks } from '@/lib/curricular-blocks';
import type { GeneratedPlanningContent } from '@/types/planning';

export interface BlockExtraLike {
  id: string;
  type: string;
  title: string;
  key_index: number | null;
  content_text: string;
  created_at?: Date | string | null;
}

/** Extrae el número de sesión ("Sesión 12") del título o del inicio del contenido. */
export function extractSessionNumber(extra: Pick<BlockExtraLike, 'title' | 'content_text'>): number | null {
  const re = /Sesi[oó]n\s+(\d+)/i;
  const fromTitle = re.exec(extra.title || '');
  if (fromTitle) return parseInt(fromTitle[1], 10);
  const fromBody = re.exec((extra.content_text || '').slice(0, 600));
  return fromBody ? parseInt(fromBody[1], 10) : null;
}

function createdAtMs(extra: BlockExtraLike): number {
  const t = extra.created_at ? new Date(extra.created_at).getTime() : 0;
  return Number.isFinite(t) ? t : 0;
}

/**
 * Devuelve los extras que pertenecen al bloque indicado, sin duplicados.
 * Para `lesson_plan`: una sola entrada por número de sesión (la más reciente)
 * y orden estrictamente numérico (Sesión 1 → N); sin número, al final por fecha/id.
 */
export function selectExtrasForBlock<T extends BlockExtraLike>(
  allExtras: T[],
  contentJson: GeneratedPlanningContent | null | undefined,
  blockIndex: number,
  type: string
): T[] {
  const ofType = allExtras.filter((e) => e.type === type);
  const blocks = resolveCurricularBlocks(contentJson);
  const block = blocks.find((b) => b.blockIndex === blockIndex);

  const hasLegacyKeys = ofType.some((e) => e.key_index !== null && e.key_index > 2);

  let belonging: T[];
  if (hasLegacyKeys && block) {
    const activityIndices = new Set(block.activityIndices);
    belonging = ofType.filter((e) => e.key_index !== null && activityIndices.has(e.key_index));
  } else {
    belonging = ofType.filter((e) => e.key_index === blockIndex);
  }

  // Deduplicar por id
  const byId = new Map<string, T>();
  for (const e of belonging) if (!byId.has(e.id)) byId.set(e.id, e);
  let unique = Array.from(byId.values());

  if (type !== 'lesson_plan') {
    return unique.sort((a, b) => createdAtMs(a) - createdAtMs(b) || a.id.localeCompare(b.id));
  }

  // lesson_plan: una por sesión (la más reciente), orden numérico
  const bySession = new Map<number, T>();
  const unnumbered: T[] = [];
  for (const e of unique) {
    const n = extractSessionNumber(e);
    if (n === null) {
      unnumbered.push(e);
      continue;
    }
    const prev = bySession.get(n);
    if (!prev || createdAtMs(e) >= createdAtMs(prev)) bySession.set(n, e);
  }
  const numbered = Array.from(bySession.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, e]) => e);
  unnumbered.sort((a, b) => createdAtMs(a) - createdAtMs(b) || a.id.localeCompare(b.id));
  unique = [...numbered, ...unnumbered];
  return unique;
}

