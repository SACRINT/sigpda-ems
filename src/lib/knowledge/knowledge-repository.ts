/**
 * knowledge-repository.ts — Lectura de la Capa de Conocimiento SEP desde Postgres.
 *
 * Solo devuelve páginas publicadas (`publicado = TRUE`). Caché en memoria con
 * TTL de 10 minutos, mismo patrón que `catalog-cache.ts`.
 */

import { sql } from '@/lib/db/client';
import type { KnowledgeApplicable, KnowledgeDomain } from './knowledge-types';

export interface KnowledgePageRow {
  slug: string;
  dominio: KnowledgeDomain;
  titulo: string;
  contenido: string;
  applicable_a: KnowledgeApplicable[];
  token_count: number;
  priority?: number;
  compilado_con: string | null;
  prompt_version: string | null;
  uac_slugs?: string[];
  updated_at: string;
}

interface CacheEntry {
  data: KnowledgePageRow[];
  timestamp: number;
}

let knowledgeCache: CacheEntry | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000;

export async function getPublishedKnowledgePages(): Promise<KnowledgePageRow[]> {
  const now = Date.now();
  if (knowledgeCache && now - knowledgeCache.timestamp < CACHE_TTL_MS) {
    return knowledgeCache.data;
  }

  const client = sql();
  const rows = (await client`
    SELECT slug, dominio, titulo, contenido, applicable_a, token_count,
           COALESCE(priority, 0) as priority, compilado_con, prompt_version,
           COALESCE(uac_slugs, '{}') as uac_slugs, updated_at
    FROM knowledge_pages
    WHERE publicado = TRUE
    ORDER BY dominio ASC, priority DESC, slug ASC
  `) as unknown as KnowledgePageRow[];

  knowledgeCache = { data: rows, timestamp: now };
  return knowledgeCache.data;
}

export function invalidateKnowledgeCache(): void {
  knowledgeCache = null;
}
