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

  // Filtrar clusters significativos que aparecen en al menos 2 líneas distintas (H-195: tablas de 2 filas)
  const validClusters = clusters
    .filter(c => c.lineIndices.size >= 2)
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

  const fontSizes = physicalLines.map(l => l.scaleY).sort((a, b) => a - b);
  const medianFontSize = fontSizes.length > 0
    ? fontSizes[Math.floor(fontSizes.length / 2)]
    : avgFontSize;
  // H-193/H-194: Umbral proporcional sin piso rígido de 13pt
  const headingThreshold = Math.max(medianFontSize * 1.15, avgFontSize * 1.15);

  // Si hay menos de 2 columnas válidas, emitir texto lineal tradicional
  if (columns.length < 2) {
    const pageMdLines: string[] = [`\n## [Página ${pageNum}]`];
    for (const line of physicalLines) {
      // H-194: Unificar regla de heading con la misma lógica en ambas ramas
      const isHeading =
        line.scaleY >= headingThreshold &&
        line.text.length < 90 &&
        !line.text.includes('|');
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
  const lineColData = physicalLines.map((line) => {
    const cols: string[] = Array(columns.length).fill('');
    for (const item of line.items) {
      const s = item.str.trim();
      if (!s) continue;
      const colIdx = assignToColumn(item.tx, columns);
      cols[colIdx] = cols[colIdx] ? `${cols[colIdx]} ${s}` : s;
    }
    const populatedColsCount = cols.filter(c => c.length > 0).length;

    // H-188: Una línea con >= 2 columnas NUNCA es un encabezado de sección.
    // Solo líneas mono-columna con tipografía destacada y longitud corta califican como heading.
    const isHeading =
      populatedColsCount < 2 &&
      line.scaleY >= headingThreshold &&
      line.text.length < 90 &&
      !line.text.includes('|');

    // H-193: Divisores de sección / banners de categorías que deben separar tablas contiguas
    const isSectionDivider = /^(?:Categor[íi]a\s*:|CICLO\s+ESCOLAR|Tema\s*:|Ámbito\s*:|Subcategor[íi]a\s*:|PLAN\s+DE\s+ACCI[ÓO]N)/i.test(line.text.trim());

    // H-189/H-193: Identificar pie de página (coordenadas ty bajas en el margen inferior)
    const isFooter = line.ty < 80 && (
      /^(?:p[áa]g(?:ina)?\.?\s*\d+|\d{1,3}|tel[eé]fono|cct|bachillerato)/i.test(line.text.trim()) ||
      /\d{7,}/.test(line.text)
    );

    // H-189: Prosa narrativa de ancho completo (párrafos normales fuera de tabla)
    const isFullWidthProse =
      populatedColsCount === 1 &&
      line.text.length > 70 &&
      (line.items[0]?.tx ?? 0) < 100;

    return {
      line,
      isHeading,
      isSectionDivider,
      isFooter,
      isFullWidthProse,
      cols,
      populatedColsCount,
    };
  });

  // 4. Identificar bloques de tablas continuos (H-184, H-188, H-189, H-190, H-193, H-195)
  const isTableLine: boolean[] = Array(lineColData.length).fill(false);
  let inTableRegion = false;

  for (let i = 0; i < lineColData.length; i++) {
    const d = lineColData[i];

    // H-193: Divisor de sección, encabezado explícito, pie de página o línea vacía cierran inmediatamente la región de tabla
    if (d.isSectionDivider || d.isHeading || d.isFooter || d.line.text.length === 0) {
      inTableRegion = false;
      continue;
    }

    if (!inTableRegion) {
      // H-189 / H-195: Apertura con multicolumna sostenida o cabecera tabular reconocida
      if (d.populatedColsCount >= 2) {
        const prevHasMulti = i > 0 && lineColData[i - 1].populatedColsCount >= 2;
        const next1HasMulti = i + 1 < lineColData.length && lineColData[i + 1].populatedColsCount >= 2;
        const next2HasMulti = i + 2 < lineColData.length && lineColData[i + 2].populatedColsCount >= 2;

        // H-195: Reconocer cabecera tabular típica para no bloquear checklists o tablas de 2 filas
        const isTabularHeader = /\b(?:docente|meta|responsable|evidencia|concluido|estatus|situaci[oó]n|no\.|actividad|estrategia|per[ií]odo|cronograma)\b/i.test(d.line.text);
        const next1HasContent = i + 1 < lineColData.length && lineColData[i + 1].populatedColsCount >= 1;

        if (prevHasMulti || next1HasMulti || next2HasMulti || (isTabularHeader && next1HasContent)) {
          inTableRegion = true;
          isTableLine[i] = true;
        }
      }
    } else {
      // Región de tabla ya abierta
      if (d.populatedColsCount >= 2) {
        isTableLine[i] = true;
      } else if (d.populatedColsCount === 1) {
        // H-189: Si la línea es prosa narrativa de párrafo completo, cerrar inmediatamente la región
        if (d.isFullWidthProse) {
          inTableRegion = false;
        } else {
          // H-190: Celda multirrenglón legítima dentro de la tabla (sin corte artificial en 8)
          isTableLine[i] = true;
        }
      } else {
        inTableRegion = false;
      }
    }
  }

  // Helper para determinar si una línea física dentro de la tabla continúa la fila lógica actual (H-184)
  function isRowContinuation(
    currentRow: string[],
    lineCols: string[],
    populatedColsCount: number
  ): boolean {
    if (populatedColsCount === 0) return true;
    // Si solo hay una columna poblada en la línea física, es continuación de celda mono-columna
    if (populatedColsCount === 1) return true;

    // Si hay 2 o más columnas pobladas:
    const col0Text = lineCols[0]?.trim() || '';
    const col1Text = lineCols[1]?.trim() || '';

    // Condición 1: Comienza en minúscula en col 0 (ej. "tercer semestre del ciclo escolar...")
    if (/^[a-záéíóúüñ]/.test(col0Text)) return true;

    // Condición 2: Comienza en minúscula en col 1 (ej. "primer y tercer semestre...")
    if (/^[a-záéíóúüñ]/.test(col1Text)) return true;

    // Condición 3: Columna 0 o 1 de la fila previa termina con conector evidente o guión
    const currentCol0 = currentRow[0]?.trim() || '';
    const endsWithDanglingConnector = /(?:[-–—(]|(?:\b(?:y|e|o|u|de|del|en|para|con|por|el|la|los|las|un|una)\s*))$/i.test(currentCol0);
    const currentCol1 = currentRow[1]?.trim() || '';
    const col1EndsWithDanglingConnector = /(?:[-–—(]|(?:\b(?:y|e|o|u|de|del|en|para|con|por|el|la|los|las|un|una)\s*))$/i.test(currentCol1);

    if (endsWithDanglingConnector || (col1EndsWithDanglingConnector && /^\d+/.test(col1Text))) {
      return true;
    }

    return false;
  }

  // 5. Agrupar en regiones
  const markdownOutput: string[] = [`\n## [Página ${pageNum}]`];
  const rawTextOutput: string[] = [];

  let idx = 0;
  while (idx < lineColData.length) {
    if (!isTableLine[idx]) {
      // Línea de texto normal fuera de tabla
      const d = lineColData[idx];
      if (d.isHeading) {
        markdownOutput.push(`\n### ${d.line.text}\n`);
      } else {
        markdownOutput.push(d.line.text);
      }
      rawTextOutput.push(d.line.text);
      idx++;
      continue;
    }

    // Inicio de bloque de tabla potencial
    let tableEnd = idx;
    while (tableEnd < lineColData.length && isTableLine[tableEnd]) {
      tableEnd++;
    }

    const tableLineCount = tableEnd - idx;
    const hasMultiCol = lineColData.slice(idx, tableEnd).some(d => d.populatedColsCount >= 2);

    // H-195: Admitir tablas de 2 filas (ej. checklist de Benito P12)
    if (tableLineCount < 2 || !hasMultiCol) {
      // Bloque muy corto o sin multicolumna: tratar como texto normal
      for (let j = idx; j < tableEnd; j++) {
        const d = lineColData[j];
        if (d.isHeading) {
          markdownOutput.push(`\n### ${d.line.text}\n`);
        } else {
          markdownOutput.push(d.line.text);
        }
        rawTextOutput.push(d.line.text);
      }
      idx = tableEnd;
      continue;
    }

    // Ensamblar tabla con concatenación de celdas multi-fila
    const logicalRows: string[][] = [];
    let currentRow: string[] | null = null;
    let isHeaderRow = true;

    for (let j = idx; j < tableEnd; j++) {
      const cols = lineColData[j].cols;
      const popCount = lineColData[j].populatedColsCount;

      if (!currentRow) {
        // Primera fila de la tabla (encabezado)
        currentRow = [...cols];
        continue;
      }

      if (isHeaderRow) {
        // La primera fila fue el encabezado; la siguiente inicia la primera fila de datos
        logicalRows.push(currentRow);
        currentRow = [...cols];
        isHeaderRow = false;
        continue;
      }

      // Evaluar si esta línea física continúa currentRow o inicia nueva fila lógica
      if (isRowContinuation(currentRow, cols, popCount)) {
        // Continuación de celdas multi-fila en la fila actual
        cols.forEach((content, cIdx) => {
          if (content.length > 0 && currentRow) {
            currentRow[cIdx] = currentRow[cIdx]
              ? `${currentRow[cIdx]} ${content}`
              : content;
          }
        });
      } else {
        // Nueva fila lógica
        logicalRows.push(currentRow);
        currentRow = [...cols];
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
      // H-186: Incluir fila de cabecera en rawTextOutput
      rawTextOutput.push(headerRow.filter(c => c.trim().length > 0 && c !== '—').join(' | '));

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
