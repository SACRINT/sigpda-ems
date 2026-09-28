/**
 * Normalizador y validador de elementos del Plan de Acción del PMC (H-178, H-181, H-182, H-183).
 *
 * Aplica el principio B-001 (Cero fabricación): nunca inventar cifras, fechas ni datos.
 * Verifica que toda normalización sintáctica conserve de forma estricta los valores numéricos y porcentajes.
 */

import type { PmcPlanElement, PmcPreviousExtractDTO } from '@/lib/prompts/pmc-extraction';

export interface NumericValidationResult {
  ok: boolean;
  faltantes: string[];
}

export interface PmcCoverageDetails {
  metas: {
    detectados: number | null;
    extraidos: number;
    parcial: boolean;
    indeterminada?: boolean;
  };
  actividades: {
    detectados: number | null;
    extraidos: number;
    parcial: boolean;
    indeterminada?: boolean;
  };
}

export interface PmcExtractionCoverage {
  detectados: number | null;
  extraidos: number;
  parcial: boolean;
  indeterminada?: boolean;
  detalles?: PmcCoverageDetails;
}

const NUMERIC_TOKEN_REGEX = /\d+(?:[.,]\d+)?\s?%?/g;

/**
 * Normaliza un token numérico eliminando espacios interiores y unificando comas decimales a puntos.
 */
function cleanNumericToken(tok: string): string {
  return tok.replace(/\s+/g, '').replace(',', '.');
}

/**
 * Extrae y normaliza los tokens numéricos y de porcentaje de un texto.
 */
export function extractNumericTokens(text: string): string[] {
  if (!text) return [];
  const matches = text.match(NUMERIC_TOKEN_REGEX);
  if (!matches) return [];
  return matches.map(cleanNumericToken);
}

/**
 * Calcula la proporción de solapamiento de palabras significativas entre dos textos (H-196).
 */
export function calculateWordOverlap(textA: string, textB: string): number {
  const getWords = (t: string) =>
    new Set(
      t
        .toLowerCase()
        .replace(/[^\w\sáéíóúüñ]/gi, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 3)
    );

  const wordsA = getWords(textA);
  const wordsB = getWords(textB);
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let common = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) common++;
  }
  const minSize = Math.min(wordsA.size, wordsB.size);
  return common / minSize;
}

/**
 * Invariante numérico: valida que todos los números y porcentajes del texto original
 * estén presentes en el texto normalizado.
 *
 * @param original Texto literal extraído del documento
 * @param normalizado Texto procesado o corregido
 * @returns Resultado con bandera booleana y lista de tokens faltantes
 */
export function validateNormalizedText(original: string, normalizado: string): NumericValidationResult {
  if (!original) {
    return { ok: true, faltantes: [] };
  }

  const originalTokens = extractNumericTokens(original);
  if (originalTokens.length === 0) {
    return { ok: true, faltantes: [] };
  }

  if (!normalizado) {
    return { ok: false, faltantes: originalTokens };
  }

  const normalizedTokens = extractNumericTokens(normalizado);
  const normCounts = new Map<string, number>();

  for (const tok of normalizedTokens) {
    normCounts.set(tok, (normCounts.get(tok) || 0) + 1);
  }

  const faltantes: string[] = [];
  for (const tok of originalTokens) {
    const current = normCounts.get(tok) || 0;
    if (current <= 0) {
      faltantes.push(tok);
    } else {
      normCounts.set(tok, current - 1);
    }
  }

  return {
    ok: faltantes.length === 0,
    faltantes,
  };
}

export interface PmcMetaPreviaInput {
  categoria?: string | null;
  tema?: string | null;
  meta?: string | null;
  linea_base?: string | null;
  estrategia?: string | null;
  responsable?: string | null;
  entregable?: string | null;
  periodo?: string | null;
  texto_original?: string | null;
}

/**
 * Deriva metas_institucionales_previas a partir de elementos_plan para preservar retrocompatibilidad.
 * Si elementos_plan no contiene metas, preserva las metas_institucionales_previas existentes.
 */
export function deriveMetasPreviasFromElementos(
  elementos: PmcPlanElement[] = [],
  existingMetas?: PmcMetaPreviaInput[]
): NonNullable<PmcPreviousExtractDTO['metas_institucionales_previas']> {
  const metaElements = (elementos || []).filter((e) => e.tipo === 'meta');
  if (metaElements.length === 0) {
    return (existingMetas || []).map((m) => ({
      categoria: m.categoria || '',
      tema: m.tema || '',
      meta: m.meta || '',
      linea_base: m.linea_base || '',
      estrategia: m.estrategia || '',
      responsable: m.responsable || '',
      entregable: m.entregable || '',
      periodo: m.periodo || '',
    }));
  }

  // Agrupar actividades y estrategias por categoría y tema para asociarlas a la meta correspondiente
  const actMap = new Map<string, string[]>();
  for (const e of elementos) {
    if (e.tipo === 'actividad' || e.tipo === 'estrategia') {
      const catKey = e.categoria?.trim().toLowerCase() || '';
      const temaKey = e.tema?.trim().toLowerCase() || '';
      const key = `${catKey}::${temaKey}`;
      if (!actMap.has(key)) actMap.set(key, []);
      const text = e.texto_normalizado?.trim() || e.texto_original?.trim();
      if (text) {
        actMap.get(key)!.push(text);
      }
    }
  }

  // H-192: Emparejamiento 1-a-1 sin colisión de subcadenas ni duplicación
  const availableExisting = (existingMetas || []).map((em, index) => ({
    em,
    index,
    metaNorm: em.meta?.trim().toLowerCase() || '',
    origNorm: em.texto_original?.trim().toLowerCase() || '',
    catNorm: em.categoria?.trim().toLowerCase() || '',
    temaNorm: em.tema?.trim().toLowerCase() || '',
  }));
  const usedExistingIndices = new Set<number>();

  return metaElements.map((m, idx) => {
    const catKey = m.categoria?.trim().toLowerCase() || '';
    const temaKey = m.tema?.trim().toLowerCase() || '';
    const key = `${catKey}::${temaKey}`;
    const relatedActs = actMap.get(key) || [];

    const mNorm = m.texto_normalizado?.trim().toLowerCase() || '';
    const mOrig = m.texto_original?.trim().toLowerCase() || '';

    // Paso 1: Coincidencia exacta de texto (por texto_normalizado o texto_original)
    let matchedItem = availableExisting.find(
      (item) =>
        !usedExistingIndices.has(item.index) &&
        ((item.metaNorm.length > 0 && (item.metaNorm === mNorm || item.metaNorm === mOrig)) ||
         (item.origNorm.length > 0 && (item.origNorm === mOrig || item.origNorm === mNorm)))
    );

    // Paso 2: Coincidencia por categoría + tema + identidad de cifras numéricas clave
    if (!matchedItem && catKey && temaKey) {
      const mNums = extractNumericTokens(m.texto_original || m.texto_normalizado || '');
      matchedItem = availableExisting.find((item) => {
        if (usedExistingIndices.has(item.index)) return false;
        if (item.catNorm !== catKey || item.temaNorm !== temaKey) return false;
        const itemNums = extractNumericTokens(item.em.meta || item.em.texto_original || '');
        if (mNums.length > 0 && itemNums.length > 0) {
          return mNums.every((n) => itemNums.includes(n));
        }
        // H-196: Si uno o ambos lados carecen de cifras, no degradar ciegamente a categoría+tema;
        // exigir solapamiento significativo de vocabulario (overlap >= 0.5) entre las descripciones
        const textM = (m.texto_normalizado || m.texto_original || '').trim();
        const textItem = (item.em.meta || item.em.texto_original || '').trim();
        return calculateWordOverlap(textM, textItem) >= 0.5;
      });
    }

    // Paso 3: Fallback posicional estricto solo si longitudes coinciden y la posición no ha sido usada
    if (!matchedItem && availableExisting.length === metaElements.length && !usedExistingIndices.has(idx)) {
      matchedItem = availableExisting[idx];
    }

    if (matchedItem) {
      usedExistingIndices.add(matchedItem.index);
    }

    const matchedExisting = matchedItem?.em;
    const mergedLineaBase = matchedExisting?.linea_base?.trim() || '';
    const mergedEntregable = matchedExisting?.entregable?.trim() || '';
    const mergedEstrategia =
      matchedExisting?.estrategia?.trim() ||
      (relatedActs.length > 0 ? relatedActs.join('; ') : '');

    return {
      categoria: m.categoria || matchedExisting?.categoria || '',
      tema: m.tema || matchedExisting?.tema || '',
      meta: m.texto_normalizado || m.texto_original,
      linea_base: mergedLineaBase,
      estrategia: mergedEstrategia,
      responsable: m.responsable || matchedExisting?.responsable || '',
      entregable: mergedEntregable,
      periodo: m.periodo || matchedExisting?.periodo || '',
    };
  });
}

/**
 * Genera elementos_plan a partir de metas_institucionales_previas como fallback
 * para payloads legacy donde elementos_plan esté vacío.
 */
export function deriveElementosFromMetasPrevias(
  metas?: PmcMetaPreviaInput[]
): PmcPlanElement[] {
  if (!metas || metas.length === 0) return [];
  return metas.map((m) => ({
    tipo: 'meta' as const,
    texto_original: m.texto_original || m.meta || '',
    texto_normalizado: m.meta || '',
    categoria: m.categoria || '',
    tema: m.tema || '',
    responsable: m.responsable || '',
    periodo: m.periodo || '',
    ubicacion: {},
    requiere_revision: false,
  }));
}

/**
 * Calcula la cobertura de extracción de metas y actividades (H-178, H-182, H-187, H-191).
 */
export function calculatePmcCoverage(
  totalesDetectados: { metas?: number | null; actividades?: number | null } | null | undefined,
  metasExtraidasCount: number,
  actividadesExtraidasCount: number
): PmcExtractionCoverage {
  const detectadosMetas = typeof totalesDetectados?.metas === 'number'
    ? totalesDetectados.metas
    : null;
  const parcialMetas = detectadosMetas !== null && detectadosMetas > metasExtraidasCount;

  const detectadosActividades = typeof totalesDetectados?.actividades === 'number'
    ? totalesDetectados.actividades
    : null;
  const parcialActividades = detectadosActividades !== null && detectadosActividades > actividadesExtraidasCount;

  const parcial = parcialMetas || parcialActividades;
  const indeterminadaMetas = detectadosMetas === null;
  const indeterminadaActividades = detectadosActividades === null;
  // H-191: Se considera indeterminada si no se puede verificar cobertura ni de metas ni de actividades
  const indeterminada = indeterminadaMetas || indeterminadaActividades;

  return {
    detectados: detectadosMetas,
    extraidos: metasExtraidasCount,
    parcial,
    indeterminada,
    detalles: {
      metas: {
        detectados: detectadosMetas,
        extraidos: metasExtraidasCount,
        parcial: parcialMetas,
        indeterminada: indeterminadaMetas,
      },
      actividades: {
        detectados: detectadosActividades,
        extraidos: actividadesExtraidasCount,
        parcial: parcialActividades,
        indeterminada: indeterminadaActividades,
      },
    },
  };
}
