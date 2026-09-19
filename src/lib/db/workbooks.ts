/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  ActiveWorkTextbook,
  CanonicalSeed,
  GenerationProgressState,
} from '@/types/work-textbook';
import { logger } from '@/lib/logger';
import { sql } from './client';

// ─── Work-Textbook & Canonical Seeds Engine ─────────────────────────────────

/**
 * Inicializa dinámicamente las tablas e índices del motor editorial si no existen
 */
export async function initWorkTextbookTables(): Promise<void> {
  const client = sql();
  await client`
    CREATE TABLE IF NOT EXISTS educational_canonical_seeds (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      uac_id TEXT NOT NULL,
      subsystem TEXT NOT NULL,
      topic TEXT NOT NULL,
      practice_type TEXT NOT NULL,
      content JSONB NOT NULL,
      source TEXT DEFAULT 'ai_generated',
      quality_score INTEGER DEFAULT 80,
      times_used INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;

  await client`
    CREATE INDEX IF NOT EXISTS idx_seeds_uac ON educational_canonical_seeds(uac_id, subsystem);
  `;
  await client`
    CREATE INDEX IF NOT EXISTS idx_seeds_quality ON educational_canonical_seeds(quality_score);
  `;
  await client`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_seeds_uac_topic_sub ON educational_canonical_seeds(uac_id, topic, subsystem);
  `;

  await client`
    ALTER TABLE plannings ADD COLUMN IF NOT EXISTS workbooks_json JSONB DEFAULT '{}'::jsonb;
  `;
  await client`
    ALTER TABLE plannings ADD COLUMN IF NOT EXISTS workbook_progress JSONB DEFAULT '{}'::jsonb;
  `;

  await client`
    CREATE TABLE IF NOT EXISTS image_assets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      planning_id UUID REFERENCES plannings(id) ON DELETE CASCADE,
      block_index INTEGER NOT NULL,
      mission_index INTEGER NOT NULL,
      source TEXT NOT NULL,
      external_id TEXT,
      title TEXT NOT NULL,
      creator TEXT,
      creator_url TEXT,
      license TEXT NOT NULL,
      license_url TEXT,
      source_url TEXT,
      image_url TEXT NOT NULL,
      thumbnail_url TEXT,
      caption TEXT NOT NULL,
      width INTEGER,
      height INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;
  await client`
    CREATE INDEX IF NOT EXISTS idx_image_assets_planning ON image_assets(planning_id, block_index);
  `;
}

/**
 * Busca una semilla canónica de alta calidad (score >= 80) para un tema específico
 */
export async function findCanonicalSeed(
  uacId: string,
  topic: string,
  subsystem?: string
): Promise<CanonicalSeed | null> {
  const client = sql();
  try {
    const cleanTopic = topic.trim().toLowerCase();
    const rows = await client`
      SELECT id, uac_id, subsystem, topic, practice_type, content,
             source, quality_score, times_used, created_at, updated_at
      FROM educational_canonical_seeds
      WHERE uac_id = ${uacId}
        AND (${subsystem || null}::text IS NULL OR subsystem = ${subsystem})
        AND LOWER(topic) = ${cleanTopic}
        AND quality_score >= 80
      ORDER BY quality_score DESC, times_used DESC
      LIMIT 1
    `;

    if (!rows || rows.length === 0) return null;

    const r = rows[0];
    return {
      id: r.id,
      uacId: r.uac_id,
      subsystem: r.subsystem,
      topic: r.topic,
      practiceType: r.practice_type,
      content: r.content,
      source: r.source,
      qualityScore: r.quality_score,
      timesUsed: r.times_used,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  } catch (err) {
    logger.warn('[findCanonicalSeed] Warning:', err);
    return null;
  }
}

/**
 * Almacena o actualiza una semilla canónica de forma atómica con ON CONFLICT (quality_score >= 80)
 * y no sobreescribe semillas con mejor calidad existente.
 */
export async function saveCanonicalSeed(seed: CanonicalSeed): Promise<CanonicalSeed | null> {
  if (seed.qualityScore < 80) {
    return null; // Quality gate: no almacenar contenido de baja calidad
  }

  const client = sql();
  try {
    const cleanTopic = seed.topic.trim();
    const contentJson = JSON.stringify(seed.content);

    // Operación atómica con ON CONFLICT para evitar race conditions concurrentes
    const rows = await client`
      INSERT INTO educational_canonical_seeds (
        uac_id, subsystem, topic, practice_type, content,
        source, quality_score, times_used
      ) VALUES (
        ${seed.uacId},
        ${seed.subsystem},
        ${cleanTopic},
        ${seed.practiceType},
        ${contentJson}::jsonb,
        ${seed.source || 'ai_generated'},
        ${seed.qualityScore},
        0
      )
      ON CONFLICT (uac_id, topic, subsystem)
      DO UPDATE SET
        content = EXCLUDED.content,
        quality_score = EXCLUDED.quality_score,
        practice_type = EXCLUDED.practice_type,
        source = EXCLUDED.source,
        updated_at = NOW()
      WHERE EXCLUDED.quality_score > educational_canonical_seeds.quality_score
      RETURNING *
    `;

    if (rows && rows.length > 0) {
      const r = rows[0];
      return {
        id: r.id,
        uacId: r.uac_id,
        subsystem: r.subsystem,
        topic: r.topic,
        practiceType: r.practice_type,
        content: r.content,
        source: r.source,
        qualityScore: r.quality_score,
        timesUsed: r.times_used,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      };
    }

    // Si no retornó fila modificada, la semilla existente tiene mejor o igual calidad
    return await findCanonicalSeed(seed.uacId, cleanTopic, seed.subsystem);
  } catch (err) {
    logger.error('[saveCanonicalSeed] Error:', err);
    return null;
  }
}

/**
 * Incrementa el contador de uso de una semilla reutilizada
 */
export async function incrementSeedUsage(seedId: string): Promise<void> {
  const client = sql();
  try {
    await client`
      UPDATE educational_canonical_seeds
      SET times_used = times_used + 1,
          updated_at = NOW()
      WHERE id = ${seedId}::uuid
    `;
  } catch (err) {
    logger.warn('[incrementSeedUsage] Error:', err);
  }
}

/**
 * Guarda o actualiza el Libro de Trabajo de un bloque en la columna workbooks_json de plannings
 * Maneja historial de versiones (version: 1, 2, ...) y valida que la planeación exista.
 */
export async function saveBlockWorkbook(
  planningId: string,
  blockIndex: number,
  workbook: ActiveWorkTextbook
): Promise<{ version: number; success: boolean; error?: string }> {
  if (isNaN(blockIndex) || blockIndex < 0) {
    return { version: 0, success: false, error: 'blockIndex inválido (NaN o negativo)' };
  }

  const client = sql();
  const blockKey = `block_${blockIndex}`;

  for (let attempt = 0; attempt < 3; attempt++) {
    // 1. Obtener los workbooks actuales de la planeación verificando existencia
    const rows = await client`
      SELECT id, workbooks_json
      FROM plannings
      WHERE id = ${planningId}::uuid
      LIMIT 1
    `;

    if (!rows || rows.length === 0) {
      return { version: 0, success: false, error: 'Planning not found' };
    }

    const currentWorkbooks = (rows[0]?.workbooks_json || {}) as Record<string, any>;
    const existingBlockData = currentWorkbooks[blockKey] || { version: 0, history: [] };
    const expectedVersion = existingBlockData.version || 0;
    const newVersion = expectedVersion + 1;
    workbook.version = newVersion;

    const historyItem = existingBlockData.current
      ? {
          version: existingBlockData.version,
          generatedAt: existingBlockData.current.generatedAt,
          totalPages: existingBlockData.current.totalPages,
          totalWords: existingBlockData.current.totalWords,
          qualityScore: existingBlockData.current.qualityScore,
          qualityWarning: existingBlockData.current.qualityWarning,
        }
      : null;

    const updatedHistory = [...(existingBlockData.history || [])];
    if (historyItem) {
      updatedHistory.push(historyItem);
    }

    const blockEntry = {
      version: newVersion,
      current: workbook,
      history: updatedHistory,
    };

    const updateResult = await client`
      UPDATE plannings
      SET workbooks_json = jsonb_set(
        COALESCE(workbooks_json, '{}'::jsonb),
        ARRAY[${blockKey}],
        ${JSON.stringify(blockEntry)}::jsonb,
        true
      ),
      updated_at = NOW()
      WHERE id = ${planningId}::uuid
        AND (
          workbooks_json IS NULL 
          OR workbooks_json->${blockKey} IS NULL 
          OR COALESCE((workbooks_json->${blockKey}->>'version')::int, 0) = ${expectedVersion}
        )
      RETURNING id
    `;

    if (updateResult && updateResult.length > 0) {
      return { version: newVersion, success: true };
    }
  }

  return { version: 0, success: false, error: 'Conflicto de concurrencia al guardar workbook' };
}

/**
 * Obtiene el Libro de Trabajo actual de un bloque específico
 */
export async function getBlockWorkbook(
  planningId: string,
  blockIndex: number
): Promise<ActiveWorkTextbook | null> {
  const client = sql();
  const blockKey = `block_${blockIndex}`;

  const rows = await client`
    SELECT workbooks_json
    FROM plannings
    WHERE id = ${planningId}::uuid
    LIMIT 1
  `;

  if (!rows || rows.length === 0) return null;
  const workbooks = rows[0].workbooks_json || {};
  return workbooks[blockKey]?.current || null;
}

/**
 * Obtiene todos los libros generados para una planeación (para compilación semestral)
 */
export async function getAllBlockWorkbooks(
  planningId: string
): Promise<Record<string, { version: number; current: ActiveWorkTextbook; history: any[] }>> {
  const client = sql();
  const rows = await client`
    SELECT workbooks_json
    FROM plannings
    WHERE id = ${planningId}::uuid
    LIMIT 1
  `;

  if (!rows || rows.length === 0) return {};
  return rows[0].workbooks_json || {};
}

/**
 * Actualiza el progreso en vivo de la generación del libro
 */
export async function updateWorkbookProgress(
  planningId: string,
  blockIndex: number,
  progress: GenerationProgressState
): Promise<void> {
  const client = sql();
  const blockKey = `block_${blockIndex}`;
  const patchObj = JSON.stringify({ [blockKey]: progress });

  await client`
    UPDATE plannings
    SET workbook_progress = COALESCE(workbook_progress, '{}'::jsonb) || ${patchObj}::jsonb
    WHERE id = ${planningId}::uuid
  `;
}

/**
 * Obtiene el estado de progreso en vivo de la generación de un bloque
 */
export async function getWorkbookProgress(
  planningId: string,
  blockIndex: number
): Promise<GenerationProgressState | null> {
  const client = sql();
  const blockKey = `block_${blockIndex}`;

  const rows = await client`
    SELECT workbook_progress
    FROM plannings
    WHERE id = ${planningId}::uuid
    LIMIT 1
  `;

  if (!rows || rows.length === 0) return null;
  const progressMap = rows[0].workbook_progress || {};
  return progressMap[blockKey] || null;
}
