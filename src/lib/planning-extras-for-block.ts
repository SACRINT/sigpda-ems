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

/**
 * Devuelve todos los extras de un tipo para todos los bloques curriculares combinados,
 * organizados en orden canónico estricto:
 * 1. Bloque a bloque (Bloque 0, Bloque 1, Bloque 2...).
 * 2. Dentro de cada bloque:
 *    - Para `lesson_plan`: una sola entrada por número de sesión (la más reciente)
 *      y orden numérico estrictamente ascendente (Sesión 1 -> N).
 *    - Para otros tipos: orden determinista por fecha de creación e id.
 * 3. Cualquier extra adicional no capturado por los bloques curriculares se anexa al final
 *    (sin duplicar sesiones ya existentes en el caso de planes de clase).
 */
export function selectAllExtrasCombined<T extends BlockExtraLike>(
  allExtras: T[],
  contentJson: GeneratedPlanningContent | null | undefined,
  type: string
): T[] {
  const ofType = allExtras.filter((e) => e.type === type);
  if (ofType.length === 0) return [];

  const blocks = resolveCurricularBlocks(contentJson);
  const result: T[] = [];
  const seenIds = new Set<string>();
  const processedBlockExtraIds = new Set<string>();

  if (blocks && blocks.length > 0) {
    for (const block of blocks) {
      const hasLegacyKeys = ofType.some((e) => e.key_index !== null && e.key_index > 2);
      let belonging: T[];
      if (hasLegacyKeys) {
        const activityIndices = new Set(block.activityIndices);
        belonging = ofType.filter((e) => e.key_index !== null && activityIndices.has(e.key_index));
      } else {
        belonging = ofType.filter((e) => e.key_index === block.blockIndex);
      }
      for (const b of belonging) {
        processedBlockExtraIds.add(b.id);
      }

      const blockExtras = selectExtrasForBlock(ofType, contentJson, block.blockIndex, type);
      for (const extra of blockExtras) {
        if (!seenIds.has(extra.id)) {
          seenIds.add(extra.id);
          result.push(extra);
        }
      }
    }
  }

  // Si no hay bloques curriculares o quedaron extras sin asignar a ningún bloque (huérfanos)
  const remaining = ofType.filter((e) => !processedBlockExtraIds.has(e.id) && !seenIds.has(e.id));
  if (remaining.length > 0) {
    if (type === 'lesson_plan') {
      // Para planes de clase huérfanos/residuales: deduplicar por número de sesión evitando
      // reincorporar versiones viejas de sesiones ya cubiertas
      const existingSessions = new Set<number>();
      for (const item of result) {
        const sNum = extractSessionNumber(item);
        if (sNum !== null) existingSessions.add(sNum);
      }

      // Agrupar por key_index (si existe) y luego ordenar por sesión
      const byKeyIndex = new Map<number | null, T[]>();
      for (const e of remaining) {
        const k = e.key_index ?? null;
        const list = byKeyIndex.get(k) || [];
        list.push(e);
        byKeyIndex.set(k, list);
      }

      const sortedKeys = Array.from(byKeyIndex.keys()).sort((a, b) => {
        if (a === null) return 1;
        if (b === null) return -1;
        return a - b;
      });

      for (const k of sortedKeys) {
        const group = byKeyIndex.get(k) || [];
        const bySession = new Map<number, T>();
        const unnumbered: T[] = [];
        for (const e of group) {
          const n = extractSessionNumber(e);
          if (n === null) {
            unnumbered.push(e);
            continue;
          }
          if (existingSessions.has(n) && k === null) continue;
          const prev = bySession.get(n);
          if (!prev || createdAtMs(e) >= createdAtMs(prev)) {
            bySession.set(n, e);
          }
        }
        const numbered = Array.from(bySession.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([, e]) => e);
        unnumbered.sort((a, b) => createdAtMs(a) - createdAtMs(b) || a.id.localeCompare(b.id));

        for (const extra of [...numbered, ...unnumbered]) {
          if (!seenIds.has(extra.id)) {
            seenIds.add(extra.id);
            result.push(extra);
            const n = extractSessionNumber(extra);
            if (n !== null) existingSessions.add(n);
          }
        }
      }
    } else {
      // Para otros recursos: ordenar por key_index (0..2..null) y luego por fecha
      remaining.sort((a, b) => {
        const ka = a.key_index ?? 999;
        const kb = b.key_index ?? 999;
        if (ka !== kb) return ka - kb;
        return createdAtMs(a) - createdAtMs(b) || a.id.localeCompare(b.id);
      });
      for (const extra of remaining) {
        if (!seenIds.has(extra.id)) {
          seenIds.add(extra.id);
          result.push(extra);
        }
      }
    }
  }

  return result;
}


