/**
 * docx-parser.ts
 * Parser nativo para documentos de Microsoft Word (.docx) usando mammoth.js y cheerio.
 * 100% JavaScript puro, cero dependencias binarias, compatible con Vercel Serverless.
 *
 * Características avanzadas (PMC-EXTRACT v6.4):
 * - Reconstruye tablas bidimensionales respetando rowspan y colspan.
 * - Soporta listas automáticas de Word (<ol start="x"><li>) preservando su índice real.
 * - Evita duplicación de celdas fusionadas usando Set<Element>.
 * - Exporta rejilla de celdas (GridCell[]) y Markdown enriquecido con anclas ⟦T·R·C⟧.
 */

import mammoth from 'mammoth';
import * as cheerio from 'cheerio';
import type { IngestedDocument } from '../types';

export interface GridCell {
  tableIndex: number;
  originRow: number;
  originCol: number;
  rowSpan: number;
  colSpan: number;
  headerName: string;
  rawText: string;
  items: { index: number | null; text: string }[];
}

/**
 * Parsea el HTML generado por Mammoth a una cuadrícula normalizada de celdas.
 */
export function parseHtmlToNormalizedGrid(rawHtml: string): { grid: GridCell[]; structuredMarkdown: string } {
  const $ = cheerio.load(rawHtml);
  const grid: GridCell[] = [];
  const markdownBlocks: string[] = [];

  $('table').each((tIdx, table) => {
    const tableNum = tIdx + 1;
    const matrix: (any | null)[][] = [];
    const headers: string[] = [];
    const processedCells = new Set<any>();

    // 1. Mapeo matricial bidimensional con inicialización defensiva
    $(table).find('tr').each((rIdx, tr) => {
      if (!matrix[rIdx]) matrix[rIdx] = [];
      let cPointer = 0;

      $(tr).find('th, td').each((_, cell) => {
        while (matrix[rIdx][cPointer]) cPointer++;

        const rowspan = parseInt($(cell).attr('rowspan') || '1', 10);
        const colspan = parseInt($(cell).attr('colspan') || '1', 10);

        for (let r = 0; r < rowspan; r++) {
          const targetRow = rIdx + r;
          if (!matrix[targetRow]) matrix[targetRow] = [];
          for (let c = 0; c < colspan; c++) {
            matrix[targetRow][cPointer + c] = cell;
          }
        }
        cPointer += colspan;
      });
    });

    // 2. Extraer nombres de encabezados de la fila 0
    if (matrix.length > 0) {
      matrix[0].forEach((cell) => {
        if (cell) {
          headers.push(
            $(cell)
              .text()
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .trim()
          );
        } else {
          headers.push('');
        }
      });
    }

    // 3. Extraer celdas únicas con ítems normalizados
    for (let r = 1; r < matrix.length; r++) {
      for (let c = 0; c < (matrix[r]?.length || 0); c++) {
        const cell = matrix[r][c];
        if (!cell || processedCells.has(cell)) continue;
        processedCells.add(cell);

        const cellEl = $(cell);
        const cellItems: { index: number | null; text: string }[] = [];
        const rowspan = parseInt(cellEl.attr('rowspan') || '1', 10);
        const colspan = parseInt(cellEl.attr('colspan') || '1', 10);

        // Listas automáticas de Word <ol> con atributo start
        if (cellEl.find('ol, ul').length > 0) {
          cellEl.find('ol, ul').each((_, list) => {
            const isOl = list.tagName.toLowerCase() === 'ol';
            const startVal = isOl ? parseInt($(list).attr('start') || '1', 10) : 1;

            $(list).find('> li').each((liIdx, li) => {
              const itemText = $(li).text().trim();
              if (itemText) {
                cellItems.push({
                  index: isOl ? startVal + liIdx : null,
                  text: itemText
                });
              }
            });
          });
        } else {
          // Párrafos y saltos
          const rawLines = cellEl.html()?.split(/<\/p>|<br\s*\/?>/i) || [cellEl.text()];
          rawLines.forEach((line) => {
            const text = $('<div>').html(line).text().trim();
            if (text) {
              const markerMatch = text.match(/^\s*(?:meta\s*)?(\d{1,2})[.)\-:]\s+(.*)/i);
              if (markerMatch) {
                cellItems.push({ index: parseInt(markerMatch[1], 10), text: markerMatch[2].trim() });
              } else {
                cellItems.push({ index: null, text });
              }
            }
          });
        }

        grid.push({
          tableIndex: tableNum,
          originRow: r,
          originCol: c,
          rowSpan: rowspan,
          colSpan: colspan,
          headerName: headers[c] || '',
          rawText: cellEl.text().trim(),
          items: cellItems
        });
      }
    }

    // 4. Construir representación de tabla Markdown estructurada con anclas de celda
    const headerRow = `| ${headers.map((h) => h || 'Columna').join(' | ')} |`;
    const separatorRow = `| ${headers.map(() => '---').join(' | ')} |`;
    const dataRows: string[] = [];

    for (let r = 1; r < matrix.length; r++) {
      const rowCols: string[] = [];
      const colLimit = matrix[0]?.length || matrix[r]?.length || 0;
      for (let c = 0; c < colLimit; c++) {
        const cell = matrix[r]?.[c];
        if (!cell) {
          rowCols.push('');
          continue;
        }
        const cellEl = $(cell);
        const cellText = cellEl
          .text()
          .replace(/\s+/g, ' ')
          .replace(/\|/g, '\\|')
          .trim();
        const anchor = `⟦T${String(tableNum).padStart(2, '0')}·R${String(r).padStart(2, '0')}·C${String(c).padStart(2, '0')}⟧`;
        rowCols.push(`${anchor} ${cellText}`);
      }
      dataRows.push(`| ${rowCols.join(' | ')} |`);
    }

    if (dataRows.length > 0) {
      markdownBlocks.push(`\n### Tabla ${tableNum}\n${headerRow}\n${separatorRow}\n${dataRows.join('\n')}\n`);
    }
  });

  return { grid, structuredMarkdown: markdownBlocks.join('\n\n') };
}

export async function parseDocxDocument(buffer: Buffer): Promise<IngestedDocument> {
  // 1. Extraer a HTML limpio con mammoth
  const htmlResult = await mammoth.convertToHtml(
    { buffer },
    {
      convertImage: mammoth.images?.inline
        ? mammoth.images.inline(() => Promise.resolve({ src: '' }))
        : undefined,
    }
  );
  const rawHtml = htmlResult.value || '';

  // 2. Extraer texto plano continuo
  const textResult = await mammoth.extractRawText({ buffer });
  const fullText = textResult.value.trim();

  if (!fullText || fullText.length < 20) {
    throw new Error('El archivo Word (.docx) no contiene texto legible o está vacío.');
  }

  // 3. Procesar cuadrícula bidimensional de tablas
  const { structuredMarkdown } = parseHtmlToNormalizedGrid(rawHtml);

  // 4. Extraer Markdown complementario de texto narrativo fuera de tablas
  const mdResult = await mammoth.convertToMarkdown({ buffer });
  const narrativeMarkdown = mdResult.value
    .replace(/!\[.*?\]\([^\)]*\)/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Desglosar por secciones a partir del markdown canónico
  const sectionChunks = narrativeMarkdown.split(/\n(?=#+\s)/g);
  const pages = sectionChunks.map((chunk: string, idx: number) => ({
    pageNumber: idx + 1,
    rawText: chunk.replace(/[#*`|_\-]/g, ' ').replace(/\s+/g, ' ').trim(),
    markdown: chunk.trim(),
    hasTables: chunk.includes('|'),
  }));

  return {
    markdown: narrativeMarkdown,
    fullText,
    totalPages: Math.max(1, pages.length),
    pages,
    metadata: {
      format: 'docx',
      wordCount: fullText.split(/\s+/).filter(Boolean).length,
      charCount: fullText.length,
      ocrApplied: false,
    },
  };
}
