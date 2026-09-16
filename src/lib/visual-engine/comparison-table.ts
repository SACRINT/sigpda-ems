/**
 * comparison-table.ts — Extractor y constructor de tablas comparativas sintéticas
 * SIGPDA-EMS · Sistema de Diseño Editorial Escolar
 *
 * Detecta pares comparativos en el contenido de la misión (término: definición,
 * versus, markdown tables o pares de contraste) para construir tablas
 * de doble columna pedagógicas de alta densidad visual.
 */

export interface ComparisonTableData {
  title?: string;
  headers: [string, string];
  rows: [string, string][];
  caption?: string;
}

/**
 * Limpia y recorta una celda de texto para evitar overflow en tablas.
 */
function cleanCell(text: string, maxLen: number = 180): string {
  if (!text) return '';
  let cleaned = text.trim().replace(/^[-*•\s]+/, '').replace(/\s+/g, ' ');
  if (cleaned.length > maxLen) {
    cleaned = cleaned.slice(0, maxLen - 3) + '...';
  }
  return cleaned;
}

export interface ExtractComparisonTableOptions {
  allowSynthetic?: boolean;
}

/**
 * Extrae una tabla comparativa de doble columna a partir de pares reales detectados en el texto.
 * Retorna `null` si no se detectan tablas markdown (|), términos-definición (:) ni contrastes (vs)
 * para evitar plantillas sintéticas genéricas repetidas.
 */
export function extractComparisonTable(
  missionText: string,
  missionTitle: string = 'Misión Formativa',
  subjectName: string = 'la disciplina',
  options?: ExtractComparisonTableOptions
): ComparisonTableData | null {
  const text = (missionText || '').trim();
  if (!text) {
    return options?.allowSynthetic ? getSyntheticFallbackTable(missionTitle) : null;
  }

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  // 1. Detección de tablas Markdown con tuberías (| col 1 | col 2 |)
  const pipeLines = lines.filter((l) => l.startsWith('|') && l.endsWith('|') && l.includes('|'));
  if (pipeLines.length >= 3) {
    const parsedRows = pipeLines
      .filter((l) => !/^[|\s:-]+$/.test(l)) // Excluir separadores |---|---|
      .map((l) =>
        l
          .split('|')
          .slice(1, -1)
          .map((c) => cleanCell(c))
      )
      .filter((cols) => cols.length >= 2);

    if (parsedRows.length >= 2) {
      const headers: [string, string] = [
        parsedRows[0][0] || 'Elemento / Concepto',
        parsedRows[0][1] || 'Descripción / Aplicación',
      ];
      const rows: [string, string][] = parsedRows.slice(1, 6).map((r) => [
        r[0] || '',
        r[1] || '',
      ]);
      if (rows.length > 0) {
        return {
          title: `Cuadro Comparativo: ${cleanCell(missionTitle, 60)}`,
          headers,
          rows,
          caption: `Fuente: Análisis curricular contextualizado de ${subjectName}.`,
        };
      }
    }
  }

  // 2. Detección de patrones "término : definición" o listas con dos puntos
  const colonPairs: [string, string][] = [];
  const colonRegex = /^[-*•\d.)\s]*([A-ZÁÉÍÓÚÑa-záéíóúñ0-9\s()\/]{3,45})\s*:\s*(.+)$/;

  for (const line of lines) {
    const match = line.match(colonRegex);
    if (match) {
      const term = cleanCell(match[1], 45);
      const def = cleanCell(match[2], 160);
      if (term.length >= 3 && def.length >= 10) {
        colonPairs.push([term, def]);
      }
    }
    if (colonPairs.length >= 4) break;
  }

  if (colonPairs.length >= 2) {
    return {
      title: `Matriz Conceptual: ${cleanCell(missionTitle, 60)}`,
      headers: ['Concepto / Componente', 'Definición y Aplicación Práctica'],
      rows: colonPairs,
      caption: `Tabla 1. Relación de fundamentos operativos de ${subjectName}.`,
    };
  }

  // 3. Detección de patrones "vs" o "frente a"
  const vsPairs: [string, string][] = [];
  const vsRegex = /^[-*•\d.)\s]*(.+?)\s+(?:vs\.?|versus|frente\s+a|contra)\s+(.+)$/i;

  for (const line of lines) {
    const match = line.match(vsRegex);
    if (match) {
      const left = cleanCell(match[1], 50);
      const right = cleanCell(match[2], 120);
      if (left.length >= 3 && right.length >= 5) {
        vsPairs.push([left, right]);
      }
    }
    if (vsPairs.length >= 4) break;
  }

  if (vsPairs.length >= 2) {
    return {
      title: `Contraste Operativo: ${cleanCell(missionTitle, 60)}`,
      headers: ['Criterio / Alternativa A', 'Criterio / Alternativa B'],
      rows: vsPairs,
      caption: `Tabla 1. Contraste de escenarios para la toma de decisiones.`,
    };
  }

  // 4. Fallback sintético únicamente si allowSynthetic está explícitamente activo
  if (options?.allowSynthetic) {
    return getSyntheticFallbackTable(missionTitle);
  }

  return null;
}

function getSyntheticFallbackTable(missionTitle: string): ComparisonTableData {
  return {
    title: `Matriz de Transferencia de Aprendizajes: ${cleanCell(missionTitle, 60)}`,
    headers: ['Fase del Aprendizaje', 'Criterio de Desempeño Esperado'],
    rows: [
      ['Comprensión Conceptual', 'Asimilación del fundamento y analogía cotidiana'],
      ['Modelado Guiado (Yo Hago)', 'Reproducción paso a paso del protocolo técnico'],
      ['Práctica en Equipo (Hacemos)', 'Discusión colaborativa y registro en cuaderno'],
      ['Reto Autónomo (Tú Haces)', 'Transferencia del conocimiento a problemas de la comunidad'],
    ],
    caption: `Tabla 1. Estructura de progresión y evidencias formativas.`,
  };
}
