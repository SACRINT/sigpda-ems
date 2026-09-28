/**
 * src/lib/document-ingestion/parsers/pdf-table-reconstructor.ts
 *
 * Reconstrucción espacial de rejillas y tablas en PDFs digitales (H-183).
 * Detecta columnas mediante clustering de coordenadas X (tx) y preserva celdas multi-fila
 * concatenadas sin fragmentar el texto en párrafos inconexos.
 */

import { removeHyphens } from '@/lib/text-utils';

export interface TextItemWithLayout {
  str: string;
  tx: number;
  ty: number;
  scaleY: number;
  hasEOL: boolean;
}

export interface ReconstructedPageLayout {
  pageMarkdown: string;
  pageRawText: string;
}

interface PhysicalLine {
  ty: number;
  items: TextItemWithLayout[];
  scaleY: number;
  text: string;
}

interface ColumnCluster {
  startX: number;
  lineCount: number;
}

/**
 * Clusteriza coordenadas tx para determinar los límites de columnas en la página.
 * Umbral de separación inicial: 18 unidades espaciales de PDF.
 */
function detectColumnClusters(
  physicalLines: PhysicalLine[],
  clusterGapThreshold: number = 18
): ColumnCluster[] {
  // Recolectar todos los tx de inicio de items no vacíos
  const rawXList: { tx: number; lineIndex: number }[] = [];
  physicalLines.forEach((line, lineIdx) => {
    line.items.forEach(item => {
      if (item.str.trim().length > 0) {
        rawXList.push({ tx: Math.round(item.tx), lineIndex: lineIdx });
      }
    });
  });

  if (rawXList.length === 0) return [];

  // Ordenar por tx
  rawXList.sort((a, b) => a.tx - b.tx);

  // Agrupar en clusters por brechas
  const clusters: { minX: number; maxX: number; lineIndices: Set<number> }[] = [];
  let currentCluster = {
    minX: rawXList[0].tx,
    maxX: rawXList[0].tx,
    lineIndices: new Set<number>([rawXList[0].lineIndex]),
  };

  for (let i = 1; i < rawXList.length; i++) {
    const item = rawXList[i];
    if (item.tx - currentCluster.maxX <= clusterGapThreshold) {
      currentCluster.maxX = item.tx;
      currentCluster.lineIndices.add(item.lineIndex);
    } else {
      clusters.push(currentCluster);
      currentCluster = {
        minX: item.tx,
        maxX: item.tx,
        lineIndices: new Set<number>([item.lineIndex]),
      };
    }
  }
  clusters.push(currentCluster);

  // Filtrar clusters significativos que aparecen en al menos 3 líneas distintas
  const validClusters = clusters
    .filter(c => c.lineIndices.size >= 3)
    .map(c => ({
      startX: c.minX,
      lineCount: c.lineIndices.size,
    }));

  validClusters.sort((a, b) => a.startX - b.startX);
  return validClusters;
}

/**
 * Asigna un item a una de las columnas detectadas.
 */
function assignToColumn(tx: number, columns: ColumnCluster[]): number {
  if (columns.length === 0) return 0;
  if (tx < columns[0].startX - 10) return 0;

  for (let i = 0; i < columns.length; i++) {
    const nextStart = i < columns.length - 1 ? columns[i + 1].startX : Infinity;
    // Si cae antes del inicio de la siguiente columna
    if (tx < nextStart - 10) {
      return i;
    }
  }
  return columns.length - 1;
}

/**
 * Reconstruye el layout de una página de PDF combinando texto plano y tablas Markdown.
 */
export function reconstructPageLayout(
  items: TextItemWithLayout[],
  avgFontSize: number,
  pageNum: number
): ReconstructedPageLayout {
  if (items.length === 0) {
    return {
      pageMarkdown: `\n## [Página ${pageNum}]\n`,
      pageRawText: '',
    };
  }

  // 1. Agrupar espacialmente por coordenadas Y (líneas de texto)
  // En PDF, ty decrece conforme se desciende en la página
  const sortedItems = [...items].sort((a, b) => {
    const yDiff = b.ty - a.ty;
    if (Math.abs(yDiff) > 3) return yDiff;
    return a.tx - b.tx;
  });

  const physicalLines: PhysicalLine[] = [];
  let currentLineItems: TextItemWithLayout[] = [];
  let currentY = sortedItems[0].ty;

  for (const item of sortedItems) {
    if (Math.abs(item.ty - currentY) > 3) {
      if (currentLineItems.length > 0) {
        const text = removeHyphens(currentLineItems.map(i => i.str).join(' ').trim());
        const maxFont = Math.max(...currentLineItems.map(i => i.scaleY));
        if (text.length > 0) {
          physicalLines.push({
            ty: currentY,
            items: currentLineItems,
            scaleY: maxFont,
            text,
          });
        }
      }
      currentLineItems = [item];
      currentY = item.ty;
    } else {
      currentLineItems.push(item);
    }
  }

  if (currentLineItems.length > 0) {
    const text = removeHyphens(currentLineItems.map(i => i.str).join(' ').trim());
    const maxFont = Math.max(...currentLineItems.map(i => i.scaleY));
    if (text.length > 0) {
      physicalLines.push({
        ty: currentY,
        items: currentLineItems,
        scaleY: maxFont,
        text,
      });
    }
  }

  // 2. Detectar clusters de columnas en la página
  const columns = detectColumnClusters(physicalLines);

  // Si hay menos de 2 columnas válidas, emitir texto lineal tradicional
  if (columns.length < 2) {
    const pageMdLines: string[] = [`\n## [Página ${pageNum}]`];
    for (const line of physicalLines) {
      const isHeading = line.scaleY >= avgFontSize * 1.25 && line.text.length < 120;
      if (isHeading) {
        pageMdLines.push(`\n### ${line.text}\n`);
      } else {
        pageMdLines.push(line.text);
      }
    }
    const md = removeHyphens(pageMdLines.join('\n'));
    const raw = removeHyphens(physicalLines.map(l => l.text).join('\n'));
    return { pageMarkdown: md, pageRawText: raw };
  }

  // 3. Mapear cada línea a sus columnas ocupadas
  const lineColData = physicalLines.map(line => {
    const cols: string[] = Array(columns.length).fill('');
    for (const item of line.items) {
      const s = item.str.trim();
      if (!s) continue;
      const colIdx = assignToColumn(item.tx, columns);
      cols[colIdx] = cols[colIdx] ? `${cols[colIdx]} ${s}` : s;
    }
    const populatedColsCount = cols.filter(c => c.length > 0).length;
    return {
      line,
      cols,
      populatedColsCount,
    };
  });

  // 4. Identificar bloques de tablas continuos (>= 3 líneas consecutivas donde al menos haya distribución multicolumna)
  const isTableLine = lineColData.map((d, idx) => {
    if (d.populatedColsCount >= 2) return true;
    // Si tiene 1 sola columna pero la línea anterior y posterior son parte de tabla y no es col 0 (continuación de celda)
    if (d.populatedColsCount === 1) {
      const prevIsTable = idx > 0 && lineColData[idx - 1].populatedColsCount >= 2;
      const nextIsTable = idx < lineColData.length - 1 && lineColData[idx + 1].populatedColsCount >= 2;
      if (prevIsTable || nextIsTable) {
        return true;
      }
    }
    return false;
  });

  // 5. Agrupar en regiones
  const markdownOutput: string[] = [`\n## [Página ${pageNum}]`];
  const rawTextOutput: string[] = [];

  let idx = 0;
  while (idx < lineColData.length) {
    if (!isTableLine[idx]) {
      // Línea de texto normal fuera de tabla
      const l = lineColData[idx].line;
      const isHeading = l.scaleY >= avgFontSize * 1.25 && l.text.length < 120;
      if (isHeading) {
        markdownOutput.push(`\n### ${l.text}\n`);
      } else {
        markdownOutput.push(l.text);
      }
      rawTextOutput.push(l.text);
      idx++;
      continue;
    }

    // Inicio de bloque de tabla potencial
    let tableEnd = idx;
    while (tableEnd < lineColData.length && isTableLine[tableEnd]) {
      tableEnd++;
    }

    const tableLineCount = tableEnd - idx;
    if (tableLineCount < 3) {
      // Bloque muy corto: tratar como texto normal
      for (let j = idx; j < tableEnd; j++) {
        const l = lineColData[j].line;
        markdownOutput.push(l.text);
        rawTextOutput.push(l.text);
      }
      idx = tableEnd;
      continue;
    }

    // Ensamblar tabla con concatenación de celdas multi-fila
    const logicalRows: string[][] = [];
    let currentRow: string[] | null = null;

    for (let j = idx; j < tableEnd; j++) {
      const cols = lineColData[j].cols;
      const col0HasContent = cols[0].length > 0;
      const multipleCols = lineColData[j].populatedColsCount >= 2;

      if (!currentRow) {
        // Primera fila de la tabla
        currentRow = [...cols];
      } else if (col0HasContent || (multipleCols && !currentRow.every(c => c.length > 0))) {
        // Nueva fila lógica
        logicalRows.push(currentRow);
        currentRow = [...cols];
      } else {
        // Continuación de celdas multi-fila en la fila actual
        cols.forEach((content, cIdx) => {
          if (content.length > 0 && currentRow) {
            currentRow[cIdx] = currentRow[cIdx]
              ? `${currentRow[cIdx]} ${content}`
              : content;
          }
        });
      }
    }
    if (currentRow) {
      logicalRows.push(currentRow);
    }

    // Convertir logicalRows a Markdown
    if (logicalRows.length > 0) {
      markdownOutput.push('');
      // Encabezados
      const headerRow = logicalRows[0].map(c => c.replace(/\|/g, '\\|') || '—');
      markdownOutput.push(`| ${headerRow.join(' | ')} |`);
      markdownOutput.push(`| ${headerRow.map(() => '---').join(' | ')} |`);

      // Filas de datos
      for (let r = 1; r < logicalRows.length; r++) {
        const dataRow = logicalRows[r].map(c => c.replace(/\|/g, '\\|') || ' ');
        markdownOutput.push(`| ${dataRow.join(' | ')} |`);
        // En rawText acumulamos también la fila concatenada
        rawTextOutput.push(dataRow.filter(c => c.trim().length > 0).join(' | '));
      }
      markdownOutput.push('');
    }

    idx = tableEnd;
  }

  const pageMarkdown = removeHyphens(markdownOutput.join('\n'));
  const pageRawText = removeHyphens(rawTextOutput.join('\n'));

  return { pageMarkdown, pageRawText };
}
