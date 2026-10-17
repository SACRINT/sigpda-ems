/**
 * blob-storage.ts — Persistencia de Artefactos PDF en Vercel Blob Storage
 * SIGPDA-EMS · Motor Editorial de Alta Gama (Fase 2)
 *
 * Sube y versiona los archivos PDF compilados en Vercel Blob (@vercel/blob ^2.4.1),
 * garantizando persistencia durable fuera del filesystem efímero serverless.
 */

import { put } from '@vercel/blob';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { logger } from '@/lib/logger';

export interface UploadPdfResult {
  url: string;
  pathname: string;
  sizeBytes: number;
  provider: 'vercel_blob' | 'local_fallback';
}

export const LOCAL_BLOB_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 horas de TTL

/**
 * Limpia archivos huérfanos del directorio local de blobs con antigüedad superior al TTL.
 * Exclusivo de entornos de desarrollo local y runners de CI (AUD-02 / AUD-R1).
 */
export async function pruneExpiredLocalBlobs(dir: string, maxAgeMs = LOCAL_BLOB_MAX_AGE_MS): Promise<void> {
  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    const now = Date.now();
    for (const entry of entries) {
      if (entry.isFile()) {
        const fullPath = path.join(dir, entry.name);
        try {
          const stats = await fs.promises.stat(fullPath);
          if (now - stats.mtimeMs > maxAgeMs) {
            await fs.promises.unlink(fullPath).catch(() => {});
          }
        } catch {
          // Continuar sin interrumpir la poda
        }
      }
    }
  } catch {
    // Si la lectura del directorio falla, no bloquear la persistencia
  }
}

/**
 * Persiste un buffer PDF editorial en Vercel Blob Storage.
 * Si BLOB_READ_WRITE_TOKEN no está configurado (ej. desarrollo local o tests sin red),
 * persiste en directorio scratch local y retorna una URL identificadora determinista.
 */
export async function uploadEditorialPdfToBlob(
  pdfBuffer: Buffer,
  filename: string,
): Promise<UploadPdfResult> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const cleanFilename = filename.replace(/^[\/\\]+/, '');
  const pathname = `editorial-books/${cleanFilename}`;

  // 1. Vercel Blob Storage en Producción / Staging
  if (token && token.trim().length > 0) {
    try {
      logger.info(`[blob-storage] Subiendo PDF a Vercel Blob: ${pathname} (${pdfBuffer.length} bytes)...`);
      const blob = await put(pathname, pdfBuffer, {
        access: 'public',
        contentType: 'application/pdf',
        token,
      });

      logger.info(`[blob-storage] PDF persistido exitosamente en Vercel Blob: ${blob.url}`);
      return {
        url: blob.url,
        pathname: blob.pathname,
        sizeBytes: pdfBuffer.length,
        provider: 'vercel_blob',
      };
    } catch (uploadErr) {
      logger.warn('[blob-storage] Error subiendo a Vercel Blob, recurriendo a persistencia local:', {
        error: uploadErr instanceof Error ? uploadErr.message : String(uploadErr),
      });
    }
  }

  // 2. Persistencia local para desarrollo y tests (exclusivo dev/CI con poda automática)
  const localDir = path.join(os.tmpdir(), 'sigpda_editorial_blobs');
  await fs.promises.mkdir(localDir, { recursive: true });
  pruneExpiredLocalBlobs(localDir).catch(() => {});

  const localFilePath = path.join(localDir, path.basename(pathname));
  await fs.promises.writeFile(localFilePath, pdfBuffer);

  const fallbackUrl = `local://${path.basename(pathname)}`;
  logger.info(`[blob-storage] PDF almacenado en fallback local: ${localFilePath}`);

  return {
    url: fallbackUrl,
    pathname,
    sizeBytes: pdfBuffer.length,
    provider: 'local_fallback',
  };
}
