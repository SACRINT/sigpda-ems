/**
 * pre-scanner.ts — Pre-escáner determinista de estructura y metas para PMC
 * SIGPDA-EMS · PMC-EXTRACT v6.4
 *
 * Analiza la geometría de la tabla antes de llamar al LLM:
 * 1. Aísla exclusivamente la columna de 'Metas' para no inflar K con numeraciones de Estrategias.
 * 2. Excluye falsos positivos de fechas (ej. '12. enero').
 * 3. Clasifica el ámbito de numeración: GLOBAL_VERIFIABLE (ej. 1..45), LOCAL_NUMBERING (1..N por docente), o UNNUMBERED.
 * 4. Resiliente a números faltantes: no apaga la alarma de meta faltante si falta una intermedia.
 */

import type { GridCell } from '../document-ingestion/parsers/docx-parser';

export interface PreScanScopeResult {
  formato: 'CANONICO_MATRIZ' | 'FICHAS_TEMATICAS' | 'NARRATIVO_FODA';
  ambito_numeracion: 'GLOBAL_VERIFIABLE' | 'LOCAL_NUMBERING' | 'UNNUMBERED';
  k_esperado: number | null;
  secuencia_indices: number[];
  metaCells: GridCell[];
}

const MONTHS_ES = 'enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre';

// Regex que captura marcadores numéricos de metas descartando meses (fechas) y decimales
export const META_MARKER_REGEX = new RegExp(
  `^\\s*(?:meta\\s*)?(\\d{1,2})\\s*[.)\\-:]\\s+(?!(?:${MONTHS_ES})\\b)(?=[A-ZÁÉÍÓÚa-záéíóú0-9])`,
  'iu'
);

/**
 * Realiza un escaneo acotado a la columna de metas a partir de las celdas normalizadas de la tabla.
 */
export function runScopePreScan(grid: GridCell[]): PreScanScopeResult {
  // 1. Filtrar exclusivamente celdas bajo encabezados que contengan "meta" (descartando "estrategia")
  const metaCells = grid.filter(
    (c) => c.headerName.includes('meta') && !c.headerName.includes('estrategia')
  );

  const indicesEncontrados: number[] = [];
  metaCells.forEach((cell) => {
    cell.items.forEach((item) => {
      if (item.index !== null) {
        indicesEncontrados.push(item.index);
      }
    });
  });

  let ambito: PreScanScopeResult['ambito_numeracion'] = 'UNNUMBERED';
  let kEsperado: number | null = null;

  if (indicesEncontrados.length >= 3) {
    const minVal = Math.min(...indicesEncontrados);
    const maxVal = Math.max(...indicesEncontrados);
    const unique = Array.from(new Set(indicesEncontrados)).sort((a, b) => a - b);

    // Heurística de GLOBAL_VERIFIABLE:
    // Inicia en 1 o 2, el máximo es significativo (>=10) y la densidad de índices únicos
    // cubre al menos el 75% del rango esperado [minVal..maxVal].
    // Si falta un número (ej. falta el 45 en una secuencia de 1 a 46), SIGUE SIENDO GLOBAL
    // para que la reconciliación matemática detecte y reporte el hueco missing = [45].
    const rangoTotal = maxVal - minVal + 1;
    const densidadSecuencia = unique.length / Math.max(1, rangoTotal);
    const esCandidatoGlobal = minVal <= 2 && maxVal >= 10 && densidadSecuencia >= 0.75;

    if (esCandidatoGlobal) {
      ambito = 'GLOBAL_VERIFIABLE';
      kEsperado = maxVal; // El universo esperado es 1..maxVal (ej. 1..45)
    } else {
      ambito = 'LOCAL_NUMBERING';
      kEsperado = unique.length;
    }
  }

  const uniqueIndices = Array.from(new Set(indicesEncontrados)).sort((a, b) => a - b);

  return {
    formato: grid.length > 10 ? 'CANONICO_MATRIZ' : 'FICHAS_TEMATICAS',
    ambito_numeracion: ambito,
    k_esperado: kEsperado,
    secuencia_indices: uniqueIndices,
    metaCells
  };
}
