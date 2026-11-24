/**
 * Phase 6B: RAG Curricular — Motor de Búsqueda Semántica
 * Retrieves relevant curriculum content from pgvector for prompt enhancement.
 */
import { sql } from '@/lib/db';
import { API_CONFIG } from './config';
import { logger } from '@/lib/logger';

// ── Gemini embedding model ────────────────────────────────────────────────
// text-embedding-004 fue retirado del endpoint v1beta (HTTP 404). El modelo
// vigente es gemini-embedding-001; se fuerza 768 dims para conservar el
// contrato de la columna pgvector existente.
const EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001';
export const EMBEDDING_DIM = 768;

export interface CurriculumChunk {
  id: string;
  program_id: string;
  uac_name: string;
  semester: number;
  component: string;
  chunk_text: string;
  similarity: number;
}

export interface RagContext {
  chunks: CurriculumChunk[];
  query: string;
  programId?: string;
}

/**
 * Generate embedding vector for a text using Gemini
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  // Rotar atómicamente sobre el pool de claves Gemini (tabla api_keys → env)
  // para que una clave inválida/revocada (401/403) se registre y salte de inmediato
  // a la siguiente clave activa sin romper la búsqueda semántica.
  const { withKeyRotation } = await import('./ai-provider/key-rotator');

  return withKeyRotation(
    'gemini',
    async (apiKey, _keyId, _round, meta) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), Math.min(meta.timeoutMs || 2200, 2500));
      try {
        const res = await fetch(
          `${API_CONFIG.gemini}/${EMBEDDING_MODEL}:embedContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: `models/${EMBEDDING_MODEL}`,
              content: { parts: [{ text }] },
              taskType: 'RETRIEVAL_DOCUMENT',
              outputDimensionality: EMBEDDING_DIM,
            }),
            signal: controller.signal,
          }
        );

        if (!res.ok) {
          const errText = await res.text();
          const httpErr = new Error(`Embedding API error: ${res.status} - ${errText}`) as Error & {
            status?: number;
            statusCode?: number;
          };
          httpErr.status = res.status;
          httpErr.statusCode = res.status;
          throw httpErr;
        }

        const data = await res.json();
        return data.embedding.values as number[];
      } finally {
        clearTimeout(timer);
      }
    },
    { remainingBudgetMs: 2800, timeoutPerAttemptMs: 2200 }
  );
}

/**
 * Search curriculum chunks by semantic similarity
 */
export async function searchCurriculum(
  query: string,
  options: {
    semester?: number;
    component?: string;
    subsystem?: string;
    matchCount?: number;
  } = {}
): Promise<RagContext> {
  const { semester, component, subsystem, matchCount = 5 } = options;

  try {
    const queryEmbedding = await generateEmbedding(query);

    // Try vector search via pgvector function
    const results = await sql()`
      SELECT * FROM search_curriculum(
        ${JSON.stringify(queryEmbedding)}::vector,
        ${matchCount},
        ${semester || null},
        ${component || null},
        ${subsystem || null}
      )
    ` as CurriculumChunk[];

    return { chunks: results, query };
  } catch (err) {
    // Fallback: text-based search if pgvector is not available
    logger.warn('Vector search failed, falling back to text search:', (err as Error).message);
    return fallbackTextSearch(query, options);
  }
}

/**
 * Fallback text search using ILIKE
 */
async function fallbackTextSearch(
  query: string,
  options: {
    semester?: number;
    component?: string;
    subsystem?: string;
    matchCount?: number;
  }
): Promise<RagContext> {
  const { semester, component, subsystem, matchCount = 5 } = options;

  try {
    const searchTerms = query.split(/\s+/).filter(t => t.length > 3).slice(0, 5);
    const patterns = searchTerms.length > 0 ? searchTerms.map(t => `%${t}%`) : ['%'];

    const results = await sql()`
      SELECT id, program_id, uac_name, semester, component, chunk_text, 0.5 as similarity
      FROM curriculum_embeddings
      WHERE (
        ${patterns.length === 0} = true
        OR chunk_text ILIKE ANY(${patterns})
      )
      AND (${semester || null}::int IS NULL OR semester = ${semester || null}::int)
      AND (${component || null}::text IS NULL OR component = ${component || null}::text)
      AND (${subsystem || null}::text IS NULL OR subsystem = ${subsystem || null}::text)
      LIMIT ${matchCount}
    ` as CurriculumChunk[];

    return { chunks: results, query };
  } catch (err) {
    logger.error('Fallback text search also failed:', err);
    return { chunks: [], query };
  }
}

/**
 * Build RAG context block for prompt injection
 */
export function buildRagContextBlock(
  context: RagContext,
  options?: { targetDoc?: string }
): string {
  if (!context.chunks || context.chunks.length === 0) {
    return '';
  }

  const target = options?.targetDoc || 'la planeación';

  const blocks = context.chunks.map(chunk =>
    `[FUENTE OFICIAL: ${chunk.uac_name} | Sem ${chunk.semester} | ${chunk.component} | Similitud: ${(chunk.similarity * 100).toFixed(0)}%]\n${chunk.chunk_text}`
  );

  return `\n══════════ CONTEXTO CURRICULAR RECUPERADO POR RAG (Fuente Oficial SEP) ═══════════
El siguiente contenido ha sido recuperado semánticamente del catálogo oficial de 449 programas SEP.
ÚSALO como fuente de verdad para generar el contenido de ${target}:

${blocks.join('\n\n---\n\n')}

FIN DEL CONTEXTO RAG
`;
}

/**
 * Check if RAG table has data
 */
export async function isRagPopulated(): Promise<boolean> {
  try {
    const result = await sql()`SELECT COUNT(*) as count FROM curriculum_embeddings` as Array<{ count: string | number }>;
    return Number(result[0]?.count) > 0;
  } catch {
    return false;
  }
}
