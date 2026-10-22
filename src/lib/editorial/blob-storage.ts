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

const LOCAL_BLOB_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 horas de TTL

const LOCAL_BLOB_DIR = path.join(os.tmpdir(), 'sigpda_editorial_blobs');

/**
 * Indica si un `pdf_storage_path` persistido puede servirse realmente desde ESTE entorno.
 *
 * - `https://` (Vercel Blob) es durable y accesible desde cualquier instancia.
 * - `local://` solo existe en el filesystem de la instancia que lo escribió: el `/tmp` de
 *   Vercel Serverless es efímero y el directorio local se poda a las 24 h. Además la BD
 *   (Neon) es compartida entre desarrollo local y producción, de modo que un registro
 *   `local://` escrito en local NO es descargable en Vercel.
 *
 * Se usa para no tratar como caché/enlace válido un PDF que no puede leerse.
 */
export async function isEditorialPdfStorageAvailable(
  storagePath: string | null | undefined,
): Promise<boolean> {
  if (!storagePath) return false;

  if (storagePath.startsWith('http://') || storagePath.startsWith('https://')) {
    return true;
  }

  if (storagePath.startsWith('local://')) {
    const localFile = path.join(LOCAL_BLOB_DIR, path.basename(storagePath));
    try {
      await fs.promises.access(localFile, fs.constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Limpia archivos huérfanos del directorio local de blobs con antigüedad superior al TTL.
 * Exclusivo de entornos de desarrollo local y runners de CI (AUD-02 / AUD-R1).
 */
async function pruneExpiredLocalBlobs(dir: string, maxAgeMs = LOCAL_BLOB_MAX_AGE_MS): Promise<void> {
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
 * En runtime serverless (Vercel) el fallback local está PROHIBIDO y lanza error, porque
 * registrar un `local://` en la BD compartida produce libros no descargables en producción.
 */
export async function uploadEditorialPdfToBlob(
  pdfBuffer: Buffer,
  filename: string,
): Promise<UploadPdfResult> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const cleanFilename = filename.replace(/^[\/\\]+/, '');
  const pathname = `editorial-books/${cleanFilename}`;

  // En Vercel Serverless el filesystem es efímero: un fallback local quedaría registrado
  // en la BD compartida apuntando a un archivo que nadie podrá leer después (descarga 404).
  const isServerlessRuntime = process.env.VERCEL === '1';

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
      if (isServerlessRuntime) {
        // Falla ruidosa en lugar de persistir un `local://` no descargable (Cero Stubs Silenciosos).
        throw new Error(
          `No se pudo persistir el PDF editorial en Vercel Blob: ${
            uploadErr instanceof Error ? uploadErr.message : String(uploadErr)
          }`,
        );
      }
      logger.warn('[blob-storage] Error subiendo a Vercel Blob, recurriendo a persistencia local:', {
        error: uploadErr instanceof Error ? uploadErr.message : String(uploadErr),
      });
    }
  } else if (isServerlessRuntime) {
    throw new Error(
      'BLOB_READ_WRITE_TOKEN no está configurado: no se puede persistir el PDF editorial en Vercel.',
    );
  }

  // 2. Persistencia local para desarrollo y tests (exclusivo dev/CI con poda automática)
  await fs.promises.mkdir(LOCAL_BLOB_DIR, { recursive: true });
  pruneExpiredLocalBlobs(LOCAL_BLOB_DIR).catch(() => {});

  const localFilePath = path.join(LOCAL_BLOB_DIR, path.basename(pathname));
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
