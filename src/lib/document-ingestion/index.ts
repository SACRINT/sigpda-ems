/**
 * index.ts
 * Entrada principal del DocumentIngestionEngine (SIGPDA-EMS).
 * Orquesta la detección del formato, gestión de caché SHA-256 (M5-CP3-B)
 * y delegación en el parser correspondiente.
 */

import { createHash } from 'crypto';
import { sql } from '@/lib/db/client';
import { parseDigitalPdf } from './parsers/pdf-digital';
import { parseScannedPdfWithGemini } from './parsers/pdf-scanned';
import { parseDocxDocument } from './parsers/docx-parser';
import { parsePlainTextDocument } from './parsers/text-parser';
import { parseImageDocumentWithGemini } from './parsers/image-parser';
import type { IngestedDocument, IngestOptions } from './types';
import { logger } from '@/lib/logger';

export * from './types';
export { parseDigitalPdf } from './parsers/pdf-digital';
export { parseScannedPdfWithGemini } from './parsers/pdf-scanned';
export { parseDocxDocument } from './parsers/docx-parser';
export { parsePlainTextDocument } from './parsers/text-parser';
export { parseImageDocumentWithGemini } from './parsers/image-parser';

/**
 * Versión del motor de parsing e ingesta documental.
 * Al incrementar esta versión, se invalidan deterministamente todas las entradas de caché obsoletas
 * garantizando que mejoras en reconstructores de tablas (GridCell/Markdown) o parsers se apliquen
 * de inmediato sin servir análisis viejos.
 */
export const DOCUMENT_INGESTION_PARSER_VERSION = 'v8.2-docx-grid-dedup';

/**
 * Calcula el hash SHA-256 de los bytes del documento más el límite de páginas de la petición
 * y la versión del parser para indexación en caché (evita servir un PDF truncado o parseos desactualizados).
 */
export function computeDocumentHash(buffer: Buffer, options?: { maxPages?: number }): string {
  return createHash('sha256')
    .update(buffer)
    .update(` parserVersion=${DOCUMENT_INGESTION_PARSER_VERSION}`)
    .update(' maxPages=' + (options?.maxPages ?? 'auto'))
    .digest('hex');
}

/**
 * Valida que el documento parseado tenga integridad estructural mínima antes de almacenarse o recuperarse de caché.
 */
function isValidIngestedDoc(doc: unknown): doc is IngestedDocument {
  if (!doc || typeof doc !== 'object') return false;
  const d = doc as Partial<IngestedDocument>;
  return (
    typeof d.markdown === 'string' &&
    d.markdown.trim().length > 0 &&
    typeof d.totalPages === 'number' &&
    d.totalPages > 0 &&
    Boolean(d.metadata && typeof d.metadata.format === 'string')
  );
}

/**
 * Recupera el resultado de ingesta desde Neon DB si existe y fue procesado en los últimos 7 días.
 */
export async function getCachedIngest(hash: string): Promise<IngestedDocument | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    const db = sql();
    const rows = await db`
      SELECT result FROM document_ingest_cache
      WHERE hash = ${hash} AND created_at >= NOW() - INTERVAL '7 days'
      LIMIT 1
    `;
    if (!rows || rows.length === 0) return null;
    const raw = rows[0].result;
    const doc = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (isValidIngestedDoc(doc)) {
      return doc;
    }
    return null;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn('[DocumentIngestion] Error al consultar caché de ingesta:', { hash, error: msg });
    return null;
  }
}

/**
 * Persiste el resultado de ingesta estructurado en Neon DB con política ON CONFLICT para refrescar timestamp.
 */
export async function setCachedIngest(hash: string, doc: IngestedDocument): Promise<void> {
  if (!isValidIngestedDoc(doc)) return;
  if (!process.env.DATABASE_URL) return;
  try {
    const db = sql();
    await db`
      INSERT INTO document_ingest_cache (hash, result, created_at)
      VALUES (${hash}, ${JSON.stringify(doc)}::jsonb, NOW())
      ON CONFLICT (hash) DO UPDATE SET result = EXCLUDED.result, created_at = NOW()
    `;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn('[DocumentIngestion] Error al guardar en caché de ingesta:', { hash, error: msg });
  }
}

export async function pruneExpiredIngestCache(): Promise<number> {
  if (!process.env.DATABASE_URL) return 0;
  try {
    const db = sql();
    const rows = await db`
      DELETE FROM document_ingest_cache
      WHERE created_at < NOW() - INTERVAL '7 days'
      RETURNING hash
    `;
    const deleted = rows.length;
    if (deleted > 0) {
      logger.info('[DocumentIngestion] Entradas de caché vencidas eliminadas:', { deleted });
    }
    return deleted;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn('[DocumentIngestion] Error al podar la caché de ingesta:', { error: msg });
    return 0;
  }
}

/**
 * Ingesta y normaliza un documento subido (PDF, Word .docx, Texto plano o Imágenes JPG/PNG/WEBP)
 * convirtiéndolo a Markdown estructurado completo para consumo de los motores de IA.
 * Utiliza caché determinista SHA-256 con TTL de 7 días (M5-CP3-B) para eliminar latencia y consumo de tokens en reingestas.
 */
export async function ingestDocument(
  buffer: Buffer,
  options: IngestOptions = {}
): Promise<IngestedDocument> {
  const docHash = computeDocumentHash(buffer, { maxPages: options.maxPages });

  if (!options.bypassCache) {
    const cached = await getCachedIngest(docHash);
    if (cached) {
      logger.info('[DocumentIngestion] Documento recuperado de caché SHA256:', {
        hash: docHash,
        filename: options.filename,
        format: cached.metadata?.format,
      });
      return cached;
    }
  }

  const filenameLower = (options.filename || '').toLowerCase();
  const mimeLower = (options.mimeType || '').toLowerCase();

  let result: IngestedDocument;

  // 1. Detección de Word (.docx)
  if (
    filenameLower.endsWith('.docx') ||
    mimeLower.includes('wordprocessingml') ||
    mimeLower.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  ) {
    result = await parseDocxDocument(buffer);
    await setCachedIngest(docHash, result);
    return result;
  }

  // 2. Detección de Archivos de Texto (.txt, .md)
  const isPlainText =
    filenameLower.endsWith('.txt') ||
    filenameLower.endsWith('.md') ||
    mimeLower.startsWith('text/plain') ||
    mimeLower.startsWith('text/markdown');

  if (isPlainText) {
    result = parsePlainTextDocument(buffer);
    await setCachedIngest(docHash, result);
    return result;
  }

  // 3. Detección de Imágenes Documentales (.jpg, .jpeg, .png, .webp)
  const isImage =
    mimeLower.startsWith('image/') ||
    filenameLower.endsWith('.jpg') ||
    filenameLower.endsWith('.jpeg') ||
    filenameLower.endsWith('.png') ||
    filenameLower.endsWith('.webp');

  if (isImage) {
    const imgMime = mimeLower.startsWith('image/')
      ? (mimeLower === 'image/jpg' ? 'image/jpeg' : mimeLower)
      : (filenameLower.endsWith('.png') ? 'image/png' : filenameLower.endsWith('.webp') ? 'image/webp' : 'image/jpeg');

    logger.info('[DocumentIngestion] Imagen documental detectada. Extrayendo mediante Gemini Multimodal Vision...', {
      filename: options.filename,
      mime: imgMime,
    });
    result = await parseImageDocumentWithGemini(buffer, imgMime, options.teacherId);
    await setCachedIngest(docHash, result);
    return result;
  }

  // 4. Documentos PDF (Digital o Escaneado con OCR)
  const enableOcr = options.enableOcr !== false; // Default: true

  try {
    const digitalResult = await parseDigitalPdf(buffer, options.maxPages || 60);

    // Si tiene texto digital suficiente, retornar inmediatamente
    if (!digitalResult.isScanned && digitalResult.document) {
      result = digitalResult.document;
      await setCachedIngest(docHash, result);
      return result;
    }

    // Si es un documento escaneado (imagen sin texto digital) y OCR está activo
    if (enableOcr) {
      logger.info('[DocumentIngestion] PDF digital sin texto seleccionable detectado. Activando OCR Multimodal con Gemini Flash Lite...');
      result = await parseScannedPdfWithGemini(buffer, options.teacherId, options.teacherEmail, options.filename);
      await setCachedIngest(docHash, result);
      return result;
    }

    throw new Error('El PDF no contiene texto seleccionable y el OCR no está habilitado.');
  } catch (err: unknown) {
    // Si la extracción digital arrojó un error irrecuperable y OCR está habilitado, intentar OCR como salvaguarda
    if (enableOcr) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.warn('[DocumentIngestion] Falló extracción digital con pdfjs, intentando OCR como salvaguarda:', { message: errMsg });
      try {
        result = await parseScannedPdfWithGemini(buffer, options.teacherId, options.teacherEmail, options.filename);
        await setCachedIngest(docHash, result);
        return result;
      } catch (ocrErr: unknown) {
        const ocrMsg = ocrErr instanceof Error ? ocrErr.message : String(ocrErr);
        throw new Error(`No se pudo procesar el PDF ni con extracción digital ni con OCR: ${ocrMsg}`);
      }
    }
    throw err;
  }
}
