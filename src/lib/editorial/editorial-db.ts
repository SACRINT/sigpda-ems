/**
 * editorial-db.ts — Repositorio y Modelo de Persistencia para Editorial Publisher Engine
 * SIGPDA-EMS · Motor Editorial de Alta Gama (Fase 2)
 *
 * Administra el ciclo de vida de los libros editoriales en la tabla `editorial_books`.
 * REGLA DE ARQUITECTURA CRÍTICA (§4 Q3):
 * Prohibido contaminar `ActiveWorkTextbook` o la tabla `plannings.workbooks_json`.
 * Toda metadata editorial, cálculo de lomo y ruta en Vercel Blob reside de forma aislada
 * en la tabla dedicada `editorial_books`.
 */

import { sql } from '@/lib/db/client';
import { logger } from '@/lib/logger';

export type EditorialBookStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface EditorialBookRecord {
  id: string;
  planning_id: string;
  workbook_id: string;
  content_hash: string;
  metadata: Record<string, unknown>;
  pdf_storage_path: string | null;
  page_count: number | null;
  spine_width_mm: number | null;
  status: EditorialBookStatus;
  job_id: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Inicializa la tabla `editorial_books` e índices asociados en Neon PostgreSQL.
 * Operación idempotente.
 */
export async function initEditorialBooksTable(): Promise<void> {
  try {
    const client = sql();
    await client`
      CREATE TABLE IF NOT EXISTS editorial_books (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        planning_id UUID NOT NULL REFERENCES plannings(id) ON DELETE CASCADE,
        workbook_id TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        pdf_storage_path TEXT,
        page_count INTEGER,
        spine_width_mm NUMERIC(5,2),
        status TEXT NOT NULL DEFAULT 'pending',
        job_id UUID,
        error_message TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    await client`
      CREATE INDEX IF NOT EXISTS idx_editorial_books_planning_hash
      ON editorial_books(planning_id, content_hash);
    `;

    await client`
      CREATE INDEX IF NOT EXISTS idx_editorial_books_status
      ON editorial_books(status);
    `;
  } catch (err) {
    logger.warn('[editorial-db] Error o advertencia inicializando editorial_books:', { error: err });
  }
}

/**
 * Crea o inicializa un registro de libro editorial en estado 'pending'.
 */
export async function createEditorialBook(params: {
  planningId: string;
  workbookId: string;
  contentHash: string;
  metadata?: Record<string, unknown>;
  jobId?: string | null;
}): Promise<EditorialBookRecord> {
  await initEditorialBooksTable();
  const client = sql();
  const metaJson = JSON.stringify(params.metadata || {});

  const rows = await client`
    INSERT INTO editorial_books (
      planning_id,
      workbook_id,
      content_hash,
      metadata,
      job_id,
      status
    ) VALUES (
      ${params.planningId}::uuid,
      ${params.workbookId},
      ${params.contentHash},
      ${metaJson}::jsonb,
      ${params.jobId ? params.jobId : null}::uuid,
      'pending'
    )
    RETURNING *;
  `;

  return rows[0] as unknown as EditorialBookRecord;
}

/**
 * Busca un libro editorial existente por planningId y contentHash para deduplicación / caché a costo 0.
 *
 * Con el mismo `content_hash` el contenido es idéntico, así que se prioriza la copia
 * servible: los registros `local://` solo son legibles en la instancia que los escribió
 * (BD Neon compartida entre local y Vercel), por lo que no deben eclipsar a su gemelo
 * remoto en Vercel Blob.
 */
export async function getEditorialBookByPlanningAndHash(
  planningId: string,
  contentHash: string,
): Promise<EditorialBookRecord | null> {
  await initEditorialBooksTable();
  const client = sql();

  const rows = await client`
    SELECT * FROM editorial_books
    WHERE planning_id = ${planningId}::uuid
      AND content_hash = ${contentHash}
    ORDER BY
      CASE WHEN pdf_storage_path LIKE 'local://%' THEN 1 ELSE 0 END,
      created_at DESC
    LIMIT 1;
  `;

  return (rows[0] as unknown as EditorialBookRecord) || null;
}

/**
 * Obtiene un libro editorial por su identificador UUID.
 */
export async function getEditorialBookById(id: string): Promise<EditorialBookRecord | null> {
  await initEditorialBooksTable();
  const client = sql();

  const rows = await client`
    SELECT * FROM editorial_books
    WHERE id = ${id}::uuid
    LIMIT 1;
  `;

  return (rows[0] as unknown as EditorialBookRecord) || null;
}

/**
 * Obtiene el registro editorial más reciente asociado a una planeación.
 */
export async function getLatestEditorialBookForPlanning(planningId: string): Promise<EditorialBookRecord | null> {
  await initEditorialBooksTable();
  const client = sql();

  const rows = await client`
    SELECT * FROM editorial_books
    WHERE planning_id = ${planningId}::uuid
    ORDER BY created_at DESC
    LIMIT 1;
  `;

  return (rows[0] as unknown as EditorialBookRecord) || null;
}

/**
 * Devuelve la copia DESCARGABLE del contenido vigente de una planeación.
 *
 * "Contenido vigente" = el `content_hash` del registro más reciente (aunque esté pendiente
 * o haya fallado): así nunca se sirve un libro obsoleto. Entre las copias completadas de
 * ese hash se prioriza Vercel Blob sobre `local://`, que solo es legible en la instancia
 * que lo escribió. Devuelve `null` si el contenido vigente no tiene PDF servible.
 *
 * Usa `getLatestEditorialBookForPlanning` para el ciclo de vida (polling) y esta función
 * para exponer enlaces de descarga.
 */
export async function getDownloadableEditorialBookForPlanning(
  planningId: string,
): Promise<EditorialBookRecord | null> {
  await initEditorialBooksTable();
  const client = sql();

  const rows = await client`
    WITH current_content AS (
      SELECT content_hash
      FROM editorial_books
      WHERE planning_id = ${planningId}::uuid
      ORDER BY created_at DESC
      LIMIT 1
    )
    SELECT e.*
    FROM editorial_books e
    JOIN current_content c ON c.content_hash = e.content_hash
    WHERE e.planning_id = ${planningId}::uuid
      AND e.status = 'completed'
      AND e.pdf_storage_path IS NOT NULL
    ORDER BY
      CASE WHEN e.pdf_storage_path LIKE 'local://%' THEN 1 ELSE 0 END,
      e.created_at DESC
    LIMIT 1;
  `;

  return (rows[0] as unknown as EditorialBookRecord) || null;
}

/**
 * Actualiza el estado y metadatos de un libro editorial tras el procesamiento del worker.
 */
export async function updateEditorialBookStatus(
  id: string,
  status: EditorialBookStatus,
  updates?: {
    pdfStoragePath?: string;
    pageCount?: number;
    spineWidthMm?: number;
    errorMessage?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<EditorialBookRecord | null> {
  const client = sql();

  const existing = await getEditorialBookById(id);
  if (!existing) {
    return null;
  }

  const pdfPath = updates?.pdfStoragePath ?? existing.pdf_storage_path;
  const pageCount = updates?.pageCount ?? existing.page_count;
  const spineWidth = updates?.spineWidthMm ?? existing.spine_width_mm;
  const errMsg = updates?.errorMessage ?? existing.error_message;
  const mergedMeta = updates?.metadata
    ? JSON.stringify({ ...existing.metadata, ...updates.metadata })
    : JSON.stringify(existing.metadata);

  const rows = await client`
    UPDATE editorial_books
    SET
      status = ${status},
      pdf_storage_path = ${pdfPath},
      page_count = ${pageCount},
      spine_width_mm = ${spineWidth},
      error_message = ${errMsg},
      metadata = ${mergedMeta}::jsonb,
      updated_at = NOW()
    WHERE id = ${id}::uuid
    RETURNING *;
  `;

  return (rows[0] as unknown as EditorialBookRecord) || null;
}
