/**
 * index.ts
 * Entrada principal del DocumentIngestionEngine (SIGPDA-EMS).
 * Orquesta la detección del formato y delega en el parser correspondiente.
 */

import { parseDigitalPdf } from './parsers/pdf-digital';
import { parseScannedPdfWithGemini } from './parsers/pdf-scanned';
import { parseDocxDocument } from './parsers/docx-parser';
import { parsePlainTextDocument } from './parsers/text-parser';
import type { IngestedDocument, IngestOptions } from './types';
import { logger } from '@/lib/logger';

export * from './types';
export { parseDigitalPdf } from './parsers/pdf-digital';
export { parseScannedPdfWithGemini } from './parsers/pdf-scanned';
export { parseDocxDocument } from './parsers/docx-parser';
export { parsePlainTextDocument } from './parsers/text-parser';

/**
 * Ingesta y normaliza un documento subido (PDF, Word .docx o Texto plano)
 * convirtiéndolo a Markdown estructurado completo para consumo de los motores de IA.
 */
export async function ingestDocument(
  buffer: Buffer,
  options: IngestOptions = {}
): Promise<IngestedDocument> {
  const filenameLower = (options.filename || '').toLowerCase();
  const mimeLower = (options.mimeType || '').toLowerCase();

  // 1. Detección de Word (.docx)
  if (
    filenameLower.endsWith('.docx') ||
    mimeLower.includes('wordprocessingml') ||
    mimeLower.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  ) {
    return parseDocxDocument(buffer);
  }

  // 2. Detección de Archivos de Texto (.txt, .md)
  const isPlainText =
    filenameLower.endsWith('.txt') ||
    filenameLower.endsWith('.md') ||
    mimeLower.startsWith('text/plain') ||
    mimeLower.startsWith('text/markdown');

  if (isPlainText) {
    return parsePlainTextDocument(buffer);
  }

  // 3. Documentos PDF (Digital o Escaneado con OCR)
  const enableOcr = options.enableOcr !== false; // Default: true

  try {
    const digitalResult = await parseDigitalPdf(buffer, options.maxPages || 60);

    // Si tiene texto digital suficiente, retornar inmediatamente
    if (!digitalResult.isScanned && digitalResult.document) {
      return digitalResult.document;
    }

    // Si es un documento escaneado (imagen sin texto digital) y OCR está activo
    if (enableOcr) {
      logger.info('[DocumentIngestion] PDF digital sin texto seleccionable detectado. Activando OCR Multimodal con Gemini Flash Lite...');
      return await parseScannedPdfWithGemini(buffer, options.teacherId);
    }

    throw new Error('El PDF no contiene texto seleccionable y el OCR no está habilitado.');
  } catch (err: any) {
    // Si la extracción digital arrojó un error irrecuperable y OCR está habilitado, intentar OCR como salvaguarda
    if (enableOcr) {
      logger.warn('[DocumentIngestion] Falló extracción digital con pdfjs, intentando OCR como salvaguarda:', { message: err.message });
      try {
        return await parseScannedPdfWithGemini(buffer, options.teacherId);
      } catch (ocrErr: any) {
        throw new Error(`No se pudo procesar el PDF ni con extracción digital ni con OCR: ${ocrErr.message}`);
      }
    }
    throw err;
  }
}
