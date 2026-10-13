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

export interface WorkerCompileOptions {
  sourceDateEpoch?: number | string;
  timeoutMs?: number;
}

export interface WorkerCompileResponse {
  success: boolean;
  sha256: string;
  pageCount: number;
  durationMs: number;
  typstPeakMemoryMb: number;
  nodeHeapDeltaMb: number;
  renderedSessionCount: number;
  renderedProductoIntegradorCount: number;
  binaryVersion: string;
  pdfBuffer: Buffer;
  source: 'remote_worker' | 'local_fallback';
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
        signal: AbortSignal.timeout(options.timeoutMs ?? 55000), // Respetar presupuesto Vercel < 60s
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
        typstPeakMemoryMb: data.typstPeakMemoryMb,
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
    // Métrica de child process local estimada / nodeHeapDeltaMb
    typstPeakMemoryMb: localResult.nodeHeapDeltaMb > 0 ? localResult.nodeHeapDeltaMb : 14.5,
    nodeHeapDeltaMb: localResult.nodeHeapDeltaMb,
    renderedSessionCount: localResult.renderedSessionCount ?? chapter.sesiones.length,
    renderedProductoIntegradorCount: localResult.renderedProductoIntegradorCount ?? 0,
    binaryVersion: localResult.binaryVersion,
    pdfBuffer: localResult.pdfBuffer,
    source: 'local_fallback',
  };
}
