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
  };
  actividades: {
    detectados: number | null;
    extraidos: number;
    parcial: boolean;
  };
}

export interface PmcExtractionCoverage {
  detectados: number | null;
  extraidos: number;
  parcial: boolean;
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

/**
 * Deriva metas_institucionales_previas a partir de elementos_plan para preservar retrocompatibilidad.
 * Si elementos_plan no contiene metas, preserva las metas_institucionales_previas existentes.
 */
export function deriveMetasPreviasFromElementos(
  elementos: PmcPlanElement[] = [],
  existingMetas: PmcPreviousExtractDTO['metas_institucionales_previas'] = []
): NonNullable<PmcPreviousExtractDTO['metas_institucionales_previas']> {
  const metaElements = (elementos || []).filter((e) => e.tipo === 'meta');
  if (metaElements.length === 0) {
    return existingMetas || [];
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

  return metaElements.map((m) => {
    const catKey = m.categoria?.trim().toLowerCase() || '';
    const temaKey = m.tema?.trim().toLowerCase() || '';
    const key = `${catKey}::${temaKey}`;
    const relatedActs = actMap.get(key) || [];

    return {
      categoria: m.categoria || '',
      tema: m.tema || '',
      meta: m.texto_normalizado || m.texto_original,
      linea_base: '',
      estrategia: relatedActs.length > 0 ? relatedActs.join('; ') : '',
      responsable: m.responsable || '',
      entregable: '',
      periodo: m.periodo || '',
    };
  });
}

/**
 * Genera elementos_plan a partir de metas_institucionales_previas como fallback
 * para payloads legacy donde elementos_plan esté vacío.
 */
export function deriveElementosFromMetasPrevias(
  metas: PmcPreviousExtractDTO['metas_institucionales_previas'] = []
): PmcPlanElement[] {
  if (!metas || metas.length === 0) return [];
  return metas.map((m) => ({
    tipo: 'meta' as const,
    texto_original: m.meta || '',
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
 * Calcula la cobertura de extracción de metas y actividades (H-178, H-182).
 */
export function calculatePmcCoverage(
  totalesDetectados: PmcPreviousExtractDTO['totales_detectados'],
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

  return {
    detectados: detectadosMetas,
    extraidos: metasExtraidasCount,
    parcial,
    detalles: {
      metas: {
        detectados: detectadosMetas,
        extraidos: metasExtraidasCount,
        parcial: parcialMetas,
      },
      actividades: {
        detectados: detectadosActividades,
        extraidos: actividadesExtraidasCount,
        parcial: parcialActividades,
      },
    },
  };
}
