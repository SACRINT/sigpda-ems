/**
 * pdf-digital.ts
 * Parser para PDFs digitales nativos con texto seleccionable.
 * Encapsula de forma estricta los polyfills requeridos por pdfjs-dist en Node.js.
 */

import path from 'path';
import type { DocumentPage, IngestedDocument } from '../types';
import { reconstructPageLayout, type TextItemWithLayout } from './pdf-table-reconstructor';

// ── Polyfills estrictamente aislados para pdfjs-dist bajo Node.js / Vercel ────
interface GlobalWithPolyfills {
  DOMMatrix?: unknown;
  Path2D?: unknown;
}
const g = globalThis as unknown as GlobalWithPolyfills;
if (typeof g.DOMMatrix === 'undefined') {
  g.DOMMatrix = class DOMMatrix {};
}
if (typeof g.Path2D === 'undefined') {
  g.Path2D = class Path2D {};
}

export interface PdfDigitalParseResult {
  isScanned: boolean;
  document: IngestedDocument | null;
}

/**
 * Extrae y formatea a Markdown estructurado un PDF digital con texto seleccionable.
 * Si el documento contiene un promedio de texto ínfimo (< 35 caracteres por página),
 * devuelve `isScanned: true` para que el orquestador active el fallback OCR.
 */
export async function parseDigitalPdf(
  buffer: Buffer,
  maxPages: number = 60
): Promise<PdfDigitalParseResult> {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

  // Configurar worker oficial con esquema file:// para Node.js ESM
  const workerPath = path.resolve('node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs');
  const normalizedPath = workerPath.replace(/\\/g, '/');
  const workerUrl = 'file://' + (normalizedPath.startsWith('/') ? normalizedPath : '/' + normalizedPath);
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

  const uint8Array = new Uint8Array(buffer);

  const doc = await pdfjsLib.getDocument({
    data: uint8Array,
    password: '',
    useSystemFonts: false,
    disableFontFace: true,
    verbosity: 0,
  } as unknown as Parameters<typeof pdfjsLib.getDocument>[0]).promise;

  const totalPagesInDoc = doc.numPages;
  const pagesToProcess = Math.min(totalPagesInDoc, maxPages);
  const pages: DocumentPage[] = [];

  let totalCharsExtracted = 0;
  let rawTextAccumulator = '';
  const markdownPages: string[] = [];

  for (let pageNum = 1; pageNum <= pagesToProcess; pageNum++) {
    const page = await doc.getPage(pageNum);
    const textContent = await page.getTextContent();

    const items: TextItemWithLayout[] = [];
    let pageRawChars = 0;
    let sumFontHeights = 0;

    for (const rawItem of textContent.items as Array<Record<string, unknown>>) {
      if (!rawItem || typeof rawItem.str !== 'string') continue;
      const str = rawItem.str.trim();
      if (!str) continue;

      const transform = Array.isArray(rawItem.transform) ? (rawItem.transform as number[]) : [1, 0, 0, 1, 0, 0];
      const scaleY = typeof transform[3] === 'number' ? Math.abs(transform[3]) : 12;
      const tx = typeof transform[4] === 'number' ? transform[4] : 0;
      const ty = typeof transform[5] === 'number' ? transform[5] : 0;

      items.push({
        str: rawItem.str,
        tx,
        ty,
        scaleY,
        hasEOL: Boolean(rawItem.hasEOL),
      });

      pageRawChars += rawItem.str.length;
      sumFontHeights += scaleY;
    }

    totalCharsExtracted += pageRawChars;
    const avgFontSize = items.length > 0 ? sumFontHeights / items.length : 12;

    // Reconstrucción espacial con clustering de coordenadas X para preservar tablas y celdas multi-fila (H-183)
    const { pageMarkdown, pageRawText } = reconstructPageLayout(items, avgFontSize, pageNum);

    pages.push({
      pageNumber: pageNum,
      rawText: pageRawText,
      markdown: pageMarkdown,
    });

    rawTextAccumulator += pageRawText + '\n\n';
    markdownPages.push(pageMarkdown);
  }

  // Verificar si es un documento escaneado (imagen sin texto real)
  const avgCharsPerPage = totalCharsExtracted / Math.max(1, pagesToProcess);
  if (totalCharsExtracted < 80 || avgCharsPerPage < 35) {
    return {
      isScanned: true,
      document: null,
    };
  }

  const fullMarkdown = markdownPages.join('\n\n');

  return {
    isScanned: false,
    document: {
      markdown: fullMarkdown,
      fullText: rawTextAccumulator.trim(),
      totalPages: pagesToProcess,
      pages,
      metadata: {
        format: 'pdf-digital',
        wordCount: fullMarkdown.split(/\s+/).filter(Boolean).length,
        charCount: fullMarkdown.length,
        ocrApplied: false,
      },
    },
  };
}
