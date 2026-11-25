/**
 * document-scanner.ts — Localización del Plan de Acción, conteo determinista y particionado Markdown.
 */

/**
 * Localiza la sección acotada del Plan de Acción en el documento,
 * excluyendo el índice inicial (TOC) y la sección final de firmas / aprobación (H-298).
 */
export function findPlanActionSection(documentText: string): { planText: string; startIndex: number; endIndex: number } {
  if (!documentText) return { planText: '', startIndex: -1, endIndex: -1 };

  // 1. Encontrar todos los candidatos que contengan PLAN DE ACCIÓN / PLAN DE ACCION (con o sin acentos/encoding)
  const regex = /PLAN\s+DE\s+ACCI[ÓO\ufffd\.\s]?N/gi;
  const matches = [...documentText.matchAll(regex)];

  let startIdx = -1;

  for (const m of matches) {
    const idx = m.index ?? -1;
    if (idx === -1) continue;

    // Verificar contexto previo (descartar si es "TUTORIAL" o si es una frase en minúsculas en medio de un párrafo)
    const prevText = documentText.slice(Math.max(0, idx - 60), idx);
    if (/TUTORIAL/i.test(prevText)) continue;
    if (/\b(?:elaborar|diseñar|aplicar|ejecutar|un|el|este)\s+$/i.test(prevText)) {
      // Es una mención en una frase como "elaborar un plan de acción", no un encabezado
      continue;
    }

    // Descartar si el candidato viene precedido por numeración de índice TOC (ej. "5) PLAN DE ACCIÓN")
    const preMatch = documentText.slice(Math.max(0, idx - 15), idx);
    if (/\b\d+[\.\)\-]/.test(preMatch)) {
      continue;
    }

    // Descartar si la línea tiene puntos suspensivos o comas de relleno de índice
    const lineEnd = documentText.indexOf('\n', idx + 1);
    const line = documentText.slice(Math.max(0, idx - 20), lineEnd !== -1 ? lineEnd : idx + 300);
    if (/[\.·…]{2,}|,{2,}/.test(line)) continue;

    // Descartar si es parte de un índice TOC seguido inmediatamente por otras secciones de índice
    const next500 = documentText.slice(idx, idx + 500);
    if (/(?:\d+[\.\)\-\s]+(?:Participantes|Aprobaci[óo\ufffd]n|PRESENTACI[ÓO\ufffd]N|DIAGN[ÓO\ufffd]STICO))/i.test(next500)) {
      continue;
    }

    // Verificar que contenga contenido real de plan (categoría, tema, meta, tabla) en los siguientes 2500 caracteres
    const next2500 = documentText.slice(idx, idx + 2500);
    if (!/(?:CATEGOR[IÍ\ufffd]A|META|TEMA|OBJETIVO|\|)/i.test(next2500)) {
      continue;
    }

    startIdx = idx;
    break;
  }

  if (startIdx === -1) {
    // Si ningún candidato cumplió los filtros estrictos, buscar la última ocurrencia como fallback
    const lastIdx = documentText.lastIndexOf('PLAN DE ACCI');
    if (lastIdx !== -1 && lastIdx > 500) {
      startIdx = lastIdx;
    }
  }

  if (startIdx === -1) {
    return { planText: documentText, startIndex: 0, endIndex: documentText.length };
  }

  const textFromPlan = documentText.slice(startIdx);

  // 2. Encontrar fin del plan: tabla de firmas / aprobación / personal participante / anexos
  const endRegex = /(?:^|\n)[*_#\s]*(?:\d+[\.\)\-]\s*)?(?:APROBACI[ÓO\ufffd\.\s]?N\s+DEL\s+PMC|PERSONAL\s+PARTICIPANTE|FIRMAS\s+DE\s+AUTORIZACI[ÓO\ufffd\.\s]?N|FIRMAS\s+DE\s+CONFORMIDAD|DIRECTORIO\s+DEL\s+PLANTEL)/i;
  const endMatch = textFromPlan.search(endRegex);

  const endIndex = endMatch !== -1 ? startIdx + endMatch : documentText.length;
  return {
    planText: documentText.slice(startIdx, endIndex),
    startIndex: startIdx,
    endIndex,
  };
}

/**
 * Cuenta filas de datos reales de tablas markdown dentro de la sección acotada del 'PLAN DE ACCIÓN' (H-293, H-298).
 * Identifica líneas iniciadas y terminadas por '|', excluyendo separadores (|---|) y filas de encabezado.
 */
export function countPlanTableRows(documentText: string): number {
  if (!documentText) return 0;

  const { planText } = findPlanActionSection(documentText);
  const textToScan = planText && planText.length > 100 ? planText : documentText;

  const lines = textToScan.split(/\r?\n/);
  let dataRowCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith('|') || !line.endsWith('|')) continue;

    // Separadores markdown tipo |---|---|---|
    if (/^\|[\s\-:|]+\|$/.test(line)) continue;

    // Fila de encabezado: si la línea siguiente es un separador de tabla, es encabezado
    const nextLine = (lines[i + 1] || '').trim();
    if (/^\|[\s\-:|]+\|$/.test(nextLine)) continue;

    // Descartar filas vacías de tabla | | | |
    const cells = line.split('|').slice(1, -1).map((c) => c.trim()).filter(Boolean);
    if (cells.length === 0) continue;

    dataRowCount++;
  }

  return dataRowCount;
}

/**
 * Conteo determinista de actividades/metas esperadas a partir del texto del documento.
 * No depende de totales_detectados de la IA.
 * En documentos con tablas markdown del plan de acción cuenta filas reales; si no, aplica heurístico acotado (H-293, H-298).
 */
export function countDeterministicExpectedActivities(documentText: string): number {
  if (!documentText) return 0;

  // Acotar la sección del Plan de Acción excluyendo TOC y firmas finales (H-298)
  const { planText } = findPlanActionSection(documentText);
  const textToScan = planText && planText.length > 200 ? planText : documentText;

  // H-293: Conteo de filas reales de tablas markdown en el Plan de Acción
  const planTableRows = countPlanTableRows(documentText);
  if (planTableRows > 0) {
    return planTableRows;
  }

  // 1. Conteo determinista por bloques temáticos y ámbitos del plan
  const matchAmbitos = (
    textToScan.match(
      /(?:Ámbito\s*\/\s*Categoría|Tema:|__\*Reprobación|\*Reprobación|REPROBACIÓN|FORMACIÓN Y ACTUALIZACIÓN|Otras [Aa]ctividades)/gi
    ) || []
  ).length;

  const matchMetaKeywords = (
    textToScan.match(/(?:^|\n)[*_#\s]*(?:Meta\(s\)|Meta:?)/gi) || []
  ).length;

  const matchColon = (
    textToScan.match(/(?:^|\n)[*_#\s]*(?:\d+[\.\-]\s*)?Actividad(?:es)?\s*[:\(\-]/gi) || []
  ).length;

  const matchResponsables = (
    textToScan.match(/(?:ING\\?\.?|LIC\\?\.?|MTRO\\?\.?|MTRA\\?\.?|PROFR\\?\.?|PROFRA\\?\.?)\s+[A-ZÁÉÍÓÚÑ]/gi) || []
  ).length;

  const heuristico = Math.max(matchAmbitos, matchMetaKeywords + matchColon, matchResponsables);
  return heuristico > 0 ? heuristico : 1;
}

/**
 * Verifica si una respuesta textual de la IA llegó truncada (no cerró su bloque JSON).
 */
export function checkRawIsTruncated(rawText: string): boolean {
  if (!rawText || !rawText.trim()) return false;
  const trimmed = rawText.trim();
  // Quitar cercas markdown al final si existen
  const stripped = trimmed.replace(/```\s*$/i, '').trim();
  // Un JSON válido de objeto o arreglo debe terminar en } o ]
  return !stripped.endsWith('}') && !stripped.endsWith(']');
}

/**
 * Particiona el documento Markdown respetando fronteras estructurales
 * (sección de plan de acción, categorías, firmas, encabezados, docentes, actividades).
 */
export function partitionMarkdownDocument(
  markdown: string,
  minChunkSize = 8000,
  maxChunkSize = 16000
): string[] {
  if (!markdown || markdown.length <= maxChunkSize) {
    return [markdown];
  }

  const chunks: string[] = [];
  let remaining = markdown;

  while (remaining.length > 0) {
    if (remaining.length <= maxChunkSize) {
      chunks.push(remaining);
      break;
    }

    const windowStart = Math.min(minChunkSize, remaining.length - 1);
    const windowEnd = Math.min(maxChunkSize, remaining.length);
    const searchWindow = remaining.slice(windowStart, windowEnd);

    // Patrones de corte en orden jerárquico de prioridad estructural (H-298)
    const structuralPatterns = [
      /\n(?=[*_#\s]*(?:(?:6\.\s*)?PLAN\s+DE\s+ACCI[ÓO\ufffd\.\s]?N\b|Categor[íi\ufffd]a\s*\d+:))/gi,
      /\n(?=[*_#\s]*(?:APROBACI[ÓO\ufffd\.\s]?N\s+DEL\s+PMC|PERSONAL\s+PARTICIPANTE|FIRMAS\s+DE\s+AUTORIZACI[ÓO\ufffd\.\s]?N))/gi,
      /\n(?=#+\s)/g,
      /\n(?=__\*(?:Reprobaci[oó\ufffd]n|Actividades|ACCIÓN))/gi,
      /\n(?=(?:__)?(?:\d+[\.\-]\s*)?Actividad(?:es)?:?)/gi,
      /\n(?=(?:ING\\?\.?|LIC\\?\.?|MTRO\\?\.?|MTRA\\?\.?|PROFR\\?\.?|PROFRA\\?\.?|DOCENTE|DIRECTOR)\s+[A-ZÁÉÍÓÚÑ])/gi,
      /\n(?=\|[^\n]+\|\n\|[\s\-:|]+\|)/g,
      /\n(?=\|)/g,
      /\n\n/g,
      /\n/g,
    ];

    let bestSplitIndex = -1;
    for (const pattern of structuralPatterns) {
      const matches = [...searchWindow.matchAll(pattern)];
      if (matches.length > 0) {
        const lastMatch = matches[matches.length - 1];
        bestSplitIndex = windowStart + lastMatch.index!;
        break;
      }
    }

    if (bestSplitIndex === -1) {
      bestSplitIndex = Math.min(maxChunkSize, remaining.length);
    }

    const chunk = remaining.slice(0, bestSplitIndex).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }
    remaining = remaining.slice(bestSplitIndex).trim();
  }

  // H-301: Propagación de cabeceras de tabla markdown a todos los subfragmentos derivados
  // Garantiza que escuelas masivas (15-15-15 o 20-20-20) mantengan columnas legibles en cada lote
  const tableHeaderMatch = markdown.match(/^([^\n]*\|[^\n]*\r?\n\|[\s\-:|]+\|\r?\n)/m);
  const tableHeader = tableHeaderMatch ? tableHeaderMatch[1] : '';

  if (tableHeader && chunks.length > 1) {
    for (let i = 1; i < chunks.length; i++) {
      if (!chunks[i].includes('---')) {
        chunks[i] = `${tableHeader}${chunks[i]}`;
      }
    }
  }

  return chunks.length > 0 ? chunks : [markdown];
}

/**
 * Deduplica elementos del plan de acción basándose en texto normalizado idéntico o solapamiento estricto bidireccional.
 * H-294: No fusiona elementos si sus responsables son distintos (evita colapso de actividades idénticas entre docentes).
 */
