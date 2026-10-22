/**
 * worker-client.ts — Cliente de Comunicación con Editorial Publisher Worker
 * SIGPDA-EMS · Motor Editorial de Alta Gama (Fase 2)
 *
 * Despacha solicitudes de compilación pesada al worker container en Fly Machines.
 * Incluye fallback transparente a ejecución local mediante typst-compiler para
 * desarrollo y pruebas automatizadas offline.
 */

import { StudentChapter } from './student-content-model';
import { compileStudentChapter } from './typst-compiler';
import { logger } from '@/lib/logger';

export const EDITORIAL_WORKER_DEFAULT_TIMEOUT_MS = 50000;
export const EDITORIAL_WORKER_MAX_BUDGET_MS = 55000;

export interface WorkerCompileOptions {
  sourceDateEpoch?: number | string;
  timeoutMs?: number;
}

export interface WorkerCompileResponse {
  success: boolean;
  sha256: string;
  pageCount: number;
  durationMs: number;
  typstPeakMemoryMb: number | null;
  nodeHeapDeltaMb: number;
  renderedSessionCount: number;
  renderedProductoIntegradorCount: number;
  binaryVersion: string;
  pdfBuffer: Buffer;
  source: 'remote_worker' | 'local_fallback';
}

/**
 * Obtiene la versión de plantilla Typst (templateVersion, sha256) que el worker
 * remotamente está ejecutando, vía GET /health. Devuelve null si no hay worker
 * configurado o si /health no responde (timeout 5s).
 *
 * Se usa para anclar el content_hash del PDF a la plantilla que el worker REALMENTE
 * usará al compilar (no a la copia local de Vercel). Si Vercel y el worker divergen
 * durante una carrera de despliegues, la caché queda etiquetada con lo que el worker
 * compiló, evitando envenenarla con PDFs de diseño viejo.
 */
export async function fetchEditorialWorkerTemplateVersion(): Promise<string | null> {
  const workerUrl = process.env.EDITORIAL_WORKER_URL;
  if (!workerUrl || workerUrl.trim().length === 0) {
    return null;
  }
  try {
    const healthUrl = `${workerUrl.replace(/\/+$/, '')}/health`;
    const response = await fetch(healthUrl, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as { templateVersion?: unknown };
    return typeof data.templateVersion === 'string' && data.templateVersion.length > 0
      ? data.templateVersion
      : null;
  } catch {
    return null;
  }
}

/**
 * Despacha la compilación de un capítulo escolar al worker de Typst o al motor local.
 */
export async function dispatchToEditorialWorker(
  chapter: StudentChapter,
  options: WorkerCompileOptions = {},
): Promise<WorkerCompileResponse> {
  const workerUrl = process.env.EDITORIAL_WORKER_URL;
  const workerSecret = process.env.EDITORIAL_WORKER_SECRET || '';

  // 1. Ruta remota: Worker Container en Fly Machines
  if (workerUrl && workerUrl.trim().length > 0) {
    try {
      const endpoint = `${workerUrl.replace(/\/+$/, '')}/compile`;
      logger.info(`[worker-client] Despachando compilación a worker remoto: ${endpoint}`);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (workerSecret) {
        headers['x-worker-secret'] = workerSecret;
        headers['Authorization'] = `Bearer ${workerSecret}`;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          chapter,
          options: {
            sourceDateEpoch: options.sourceDateEpoch ?? 0,
          },
        }),
        signal: AbortSignal.timeout(options.timeoutMs ?? EDITORIAL_WORKER_DEFAULT_TIMEOUT_MS), // Respetar presupuesto Vercel < 60s
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Worker retornó status ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      if (!data.success || !data.pdfBase64) {
        throw new Error(data.error || 'Respuesta del worker incompleta (sin pdfBase64)');
      }

      const pdfBuffer = Buffer.from(data.pdfBase64, 'base64');

      return {
        success: true,
        sha256: data.sha256,
        pageCount: data.pageCount,
        durationMs: data.durationMs,
        typstPeakMemoryMb: typeof data.typstPeakMemoryMb === 'number' ? data.typstPeakMemoryMb : null,
        nodeHeapDeltaMb: data.nodeHeapDeltaMb,
        renderedSessionCount: data.renderedSessionCount,
        renderedProductoIntegradorCount: data.renderedProductoIntegradorCount,
        binaryVersion: data.binaryVersion,
        pdfBuffer,
        source: 'remote_worker',
      };
    } catch (workerErr) {
      logger.warn('[worker-client] Falló worker remoto, recurriendo a motor local:', {
        error: workerErr instanceof Error ? workerErr.message : String(workerErr),
      });
      // Fallback a ejecución local si el worker remoto no está disponible o falla en runtime
    }
  }

  // 2. Ruta local / Fallback para desarrollo, testing offline y CI
  logger.info('[worker-client] Ejecutando compilación editorial con typst-compiler local');
  const localResult = await compileStudentChapter(chapter, {
    sourceDateEpoch: options.sourceDateEpoch ?? 0,
  });

  return {
    success: localResult.success,
    sha256: localResult.sha256,
    pageCount: localResult.pageCount,
    durationMs: localResult.durationMs,
    // En fallback local sin /proc (desarrollo/CI), null honesto (P2-1: cero stubs silenciosos)
    typstPeakMemoryMb: null,
    nodeHeapDeltaMb: localResult.nodeHeapDeltaMb,
    renderedSessionCount: localResult.renderedSessionCount ?? chapter.sesiones.length,
    renderedProductoIntegradorCount: localResult.renderedProductoIntegradorCount ?? 0,
    binaryVersion: localResult.binaryVersion,
    pdfBuffer: localResult.pdfBuffer,
    source: 'local_fallback',
  };
}
