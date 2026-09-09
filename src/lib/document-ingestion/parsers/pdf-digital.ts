/**
 * pdf-digital.ts
 * Parser para PDFs digitales nativos con texto seleccionable.
 * Encapsula de forma estricta los polyfills requeridos por pdfjs-dist en Node.js.
 */

import path from 'path';
import type { DocumentPage, IngestedDocument } from '../types';

// ── Polyfills estrictamente aislados para pdfjs-dist bajo Node.js / Vercel ────
if (typeof (globalThis as any).DOMMatrix === 'undefined') {
  (globalThis as any).DOMMatrix = class DOMMatrix {} as any;
}
if (typeof (globalThis as any).Path2D === 'undefined') {
  (globalThis as any).Path2D = class Path2D {} as any;
}

interface TextItemWithLayout {
  str: string;
  tx: number;
  ty: number;
  scaleY: number;
  hasEOL: boolean;
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
  } as any).promise;

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

    for (const rawItem of textContent.items as any[]) {
      if (!rawItem || typeof rawItem.str !== 'string') continue;
      const str = rawItem.str.trim();
      if (!str) continue;

      const transform = rawItem.transform || [1, 0, 0, 1, 0, 0];
      const scaleY = Math.abs(transform[3]) || 12;
      const tx = transform[4] || 0;
      const ty = transform[5] || 0;

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

    // Agrupación espacial por coordenadas Y (líneas de texto)
    // En PDF, ty decrece conforme se baja en la página
    items.sort((a, b) => {
      const yDiff = b.ty - a.ty;
      if (Math.abs(yDiff) > 3) {
        return yDiff; // Línea diferente
      }
      return a.tx - b.tx; // Misma línea, de izquierda a derecha
    });

    const lines: { text: string; isHeading: boolean }[] = [];
    let currentLineItems: TextItemWithLayout[] = [];
    let currentY = items.length > 0 ? items[0].ty : 0;

    for (const item of items) {
      if (Math.abs(item.ty - currentY) > 3) {
        // Nueva línea detectada
        if (currentLineItems.length > 0) {
          const lineStr = currentLineItems.map(i => i.str).join(' ').trim();
          const maxLineFont = Math.max(...currentLineItems.map(i => i.scaleY));
          const isHeading = maxLineFont >= avgFontSize * 1.25 && lineStr.length < 120;
          if (lineStr.length > 0) {
            lines.push({ text: lineStr, isHeading });
          }
        }
        currentLineItems = [item];
        currentY = item.ty;
      } else {
        currentLineItems.push(item);
      }
    }

    // Procesar la última línea
    if (currentLineItems.length > 0) {
      const lineStr = currentLineItems.map(i => i.str).join(' ').trim();
      const maxLineFont = Math.max(...currentLineItems.map(i => i.scaleY));
      const isHeading = maxLineFont >= avgFontSize * 1.25 && lineStr.length < 120;
      if (lineStr.length > 0) {
        lines.push({ text: lineStr, isHeading });
      }
    }

    // Ensamblar Markdown de la página
    const pageMarkdownLines: string[] = [];
    pageMarkdownLines.push(`\n## [Página ${pageNum}]`);

    for (const l of lines) {
      if (l.isHeading) {
        pageMarkdownLines.push(`\n### ${l.text}\n`);
      } else {
        pageMarkdownLines.push(l.text);
      }
    }

    const pageMarkdown = pageMarkdownLines.join('\n');
    const pageRawText = lines.map(l => l.text).join('\n');

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
