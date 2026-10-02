/**
 * invariant-engine.ts — Motor de Invarianzas y Reconciliación de Metas PMC
 * SIGPDA-EMS · PMC-EXTRACT v6.4
 *
 * Implementa auditoría matemática determinista:
 * 1. Multiconjuntos numéricos reales con conteo de frecuencias exactas (Map<string, number>).
 * 2. Desacoplamiento de números heredados: el ciclo escolar se permite en 'inventados',
 *    pero la auditoría de 'perdidos' evalúa estrictamente el texto original.
 * 3. Reconciliación ternaria de secuencias: missing, unexpected y duplicates.
 * 4. Cuarentena granular por meta (no descarta el lote completo por un ítem anómalo).
 */

import type { PreScanScopeResult } from './pre-scanner';
import type { PmcPlanElement, PmcPreviousExtractDTO } from '@/lib/prompts/pmc-extraction';

// Captura: ciclos escolares (2026-2027), porcentajes (70%), decimales (8.5, .5) y enteros
export const NUMERIC_TOKEN_REGEX = /(?:\b\d{4}\s*-\s*\d{4}\b|(?:\b\d+(?:[.,]\d+)?|[.,]\d+)\s*%?)/g;

/**
 * Normaliza un token numérico eliminando espacios, unificando guiones y decimales.
 */
export function cleanNum(t: string): string {
  let cleaned = t
    .replace(/\s+/g, '')
    .replace(/\s*-\s*/g, '-') // Normaliza "2026 - 2027" a "2026-2027"
    .replace(',', '.') // Normaliza decimales con coma a punto
    .replace(/\.$/, ''); // Quita punto final sintáctico ("100." -> "100")
  if (cleaned.startsWith('.')) {
    cleaned = '0' + cleaned;
  }
  return cleaned;
}

/**
 * Construye una bolsa de tokens numéricos (multiconjunto con recuento de frecuencias).
 * Excluye el marcador inicial de la meta (ej. "3. ") para no contaminar las cifras objetivo.
 */
export function toTokenBag(text: string): Map<string, number> {
  const bag = new Map<string, number>();
  if (!text) return bag;

  // Remover marcador de enumeración inicial ("1. ", "Meta 5: ")
  const clean = text.replace(/^\s*(?:meta\s*)?\d{1,2}\s*[.)\-:]\s+/i, '');
  const matches = clean.match(NUMERIC_TOKEN_REGEX) || [];

  for (const m of matches) {
    const norm = cleanNum(m);
    if (norm) {
      bag.set(norm, (bag.get(norm) ?? 0) + 1);
    }
  }
  return bag;
}

/**
 * Diferencia de multiconjuntos (A - B): devuelve los elementos que están en A más veces que en B.
 */
export function multisetDiff(bagA: Map<string, number>, bagB: Map<string, number>): string[] {
  const surplus: string[] = [];
  for (const [token, countA] of bagA.entries()) {
    const countB = bagB.get(token) ?? 0;
    if (countA > countB) {
      for (let i = 0; i < countA - countB; i++) {
        surplus.push(token);
      }
    }
  }
  return surplus;
}

export interface ReconcileResult {
  status: 'PASS' | 'PASS_WITH_REVIEW' | 'QUARANTINE_REQUIRED';
  ambito: string;
  expectedCount: number;
  extractedCount: number;
  missing: number[];
  unexpected: number[];
  duplicates: number[];
  quarantinedMetas: PmcPlanElement[];
}

/**
 * Audita la extracción devuelta por el LLM y realiza reconciliación matemática contra el pre-escáner.
 */
export function auditAndReconcileEnterprise(
  extractedData: Partial<PmcPreviousExtractDTO> & {
    elementos_plan?: PmcPlanElement[];
    totales_detectados?: { metas: number | null; actividades: number | null };
  },
  preScan: PreScanScopeResult
): ReconcileResult {
  const elementos: PmcPlanElement[] = extractedData.elementos_plan || [];
  const metas = elementos.filter((e): e is PmcPlanElement => (e.tipo || '').toLowerCase() === 'meta');
  const extractedIndices = metas
    .map((m) => m.numero_origen)
    .filter((n): n is number => typeof n === 'number' && !isNaN(n));

  // 1. Detección de duplicados en la extracción
  const counts = new Map<number, number>();
  extractedIndices.forEach((n: number) => counts.set(n, (counts.get(n) ?? 0) + 1));
  const duplicates = Array.from(counts.entries())
    .filter(([, c]) => c > 1)
    .map(([n]) => n)
    .sort((a, b) => a - b);

  // 2. Reconciliación de secuencia (solo si el ámbito es GLOBAL_VERIFIABLE)
  let missing: number[] = [];
  let unexpected: number[] = [];

  if (preScan.ambito_numeracion === 'GLOBAL_VERIFIABLE' && preScan.k_esperado !== null) {
    const expectedUniverse = Array.from({ length: preScan.k_esperado }, (_, i) => i + 1);
    missing = expectedUniverse.filter((n: number) => !extractedIndices.includes(n));
    unexpected = extractedIndices.filter((n: number) => !expectedUniverse.includes(n));
  }

  // 3. Auditoría de Invarianza Numérica Bidireccional
  const quarantined: PmcPlanElement[] = [];
  const cicloToken = extractedData.cicloEscolar ? cleanNum(extractedData.cicloEscolar) : null;

  for (const meta of metas) {
    if (!meta.motivos_revision) meta.motivos_revision = [];

    const origBag = toTokenBag(meta.texto_original || '');
    const normBag = toTokenBag(meta.texto_normalizado || '');

    // Números permitidos en texto normalizado = Números originales + Ciclo Escolar heredado
    const allowedBag = new Map(origBag);
    if (cicloToken) {
      allowedBag.set(cicloToken, (allowedBag.get(cicloToken) ?? 0) + 1);
    }

    const inventados = multisetDiff(normBag, allowedBag);
    const perdidos = multisetDiff(origBag, normBag);

    // Cifras inventadas o alucinadas: mandan a cuarentena y resguardan texto original
    if (inventados.length > 0) {
      meta.requiere_revision = true;
      meta.motivos_revision.push(`NUMERO_INVENTADO_${inventados.join('_')}`);
      meta.texto_normalizado = meta.texto_original; // Fallback seguro
      quarantined.push(meta);
    }

    // Cifras perdidas del documento original
    if (perdidos.length > 0) {
      meta.requiere_revision = true;
      meta.motivos_revision.push(`NUMERO_OMITIDO_${perdidos.join('_')}`);
      if (!quarantined.includes(meta)) quarantined.push(meta);
    }

    // Marcadores [POR DEFINIR: ...] por carencia de datos
    if (meta.texto_normalizado && meta.texto_normalizado.includes('[POR DEFINIR:')) {
      meta.requiere_revision = true;
      meta.motivos_revision.push('CREAA_INCOMPLETO');
    }
  }

  // 4. Decisión del Estado de la Transacción
  const hasSequenceAnomaly = missing.length > 0 || unexpected.length > 0 || duplicates.length > 0;

  let status: ReconcileResult['status'] = 'PASS';
  if (hasSequenceAnomaly) {
    status = 'QUARANTINE_REQUIRED';
  } else if (quarantined.length > 0 || metas.some((m) => m.requiere_revision)) {
    status = 'PASS_WITH_REVIEW';
  }

  // 5. Autoridad de totales delegada al Backend
  extractedData.totales_detectados = {
    metas: metas.length,
    actividades: elementos.filter((e) => (e.tipo || '').toLowerCase() === 'actividad').length
  };

  return {
    status,
    ambito: preScan.ambito_numeracion,
    expectedCount: preScan.k_esperado ?? metas.length,
    extractedCount: metas.length,
    missing,
    unexpected,
    duplicates,
    quarantinedMetas: quarantined
  };
}
