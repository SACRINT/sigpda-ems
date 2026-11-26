/**
 * plan-operativo-postprocessor.ts — Post-procesador Determinista para PAEC (Pasos 5, 6 y 7)
 * SIGPDA-EMS · MCCEMS / COSFAC / NEM
 *
 * Garantiza en nueva generación (y tests unitarios):
 *  1. Destilación de `progression` (<= 280 chars, sin volcados crudos `[Contenidos: ...]`).
 *  2. Nomenclatura MCCEMS data-driven por ciclo escolar + semestre + componente.
 *  3. Guard de paridad de semestre (A = impares 1/3/5, B = pares 2/4/6) derivado del mapeo.
 *  4. Deduplicación de duplicados exactos y near-duplicados (>= 0.80 6-gramas) EXCLUYENDO Semana 16.
 */

import type { PlanOperativoRow } from '@/types/paec';
import { uacMatches } from '@/lib/paec-context';
import {
  normalizeQaText,
  resolveExpectedMccemsLabel,
  sixGramOverlap,
  PAEC_QA_THRESHOLDS,
  type PaecUacCatalogMeta,
} from '@/lib/qa/paec-pmc-semantic-qa';

export interface DistillProgressionOptions {
  semester?: number | null;
  component?: string;
  cicloEscolar?: string;
  maxChars?: number;
}

const RAW_CONTENIDOS_SPLIT_RE = /\s*(?:\[?\bContenidos(?:\s+(?:formativos|clave|tem[aá]ticos))?\s*:|\bSaberes\s+asociados\s*:)/i;

/**
 * Detecta UACs de Formación Laboral incluso cuando `fase2_mapeo` no persistió `component`,
 * reconociendo competencias laborales expresadas en 3.ª persona singular operativa.
 */
export function isLikelyLaboralUac(uacName: string, component = ''): boolean {
  if (/laboral|competencias_laborales|capacitaci[oó]n|t[eé]cnic/i.test(component)) return true;
  return /^(?:Elabora|Emplea|Establece|Opera|Aplica|Instala|Configura|Dise[nñ]a|Produce|Prepara|Administra|Gestiona|Desarrolla|Mantiene|Diagnostica|Construye|Maneja|Controla|Realiza|Ejecuta|Programa|Repara|Supervisa|Utiliza|Verifica|Integra)\s+[a-záéíóúñ]/u.test(
    uacName.trim()
  );
}

/**
 * Destila el campo `progression` para el Plan Operativo y Detalle Curricular:
 *  - Elimina volcados crudos `[Contenidos: ...]`
 *  - Alinea la etiqueta inicial según MCCEMS (ciclo + semestre + componente)
 *  - Compacta limpiamente a <= maxChars (default 280) sin truncar palabras ni dejar conectores colgados.
 */
export function distillPaecProgression(
  raw: string | null | undefined,
  options: DistillProgressionOptions = {}
): string {
  const maxChars = options.maxChars ?? PAEC_QA_THRESHOLDS.progStrictMaxChars;
  let text = String(raw ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return '';

  // 1. Remover volcado crudo de "Contenidos: ..." / "[Contenidos formativos: ...]"
  const splitIdx = text.search(RAW_CONTENIDOS_SPLIT_RE);
  if (splitIdx > 24) {
    text = text.slice(0, splitIdx).replace(/[\s,;:\-–—]+$/, '').trim();
    if (text && !/[.!?]$/.test(text)) text += '.';
  }

  // 2. Alinear nomenclatura MCCEMS data-driven cuando conocemos el semestre
  if (typeof options.semester === 'number' && options.semester >= 1 && options.semester <= 6) {
    const expected = resolveExpectedMccemsLabel(
      options.semester,
      options.component ?? '',
      options.cicloEscolar ?? '2026-2027'
    );
    if (expected === 'Propósito Formativo') {
      text = text.replace(
        /^Progresi[oó]n(?:es)?(?:\s+de\s+Aprendizaje)?\s*(\d+)?\s*[:.\-–]?\s*/i,
        (_, num) => (num ? `Propósito Formativo ${num}: ` : 'Propósito Formativo: ')
      );
      // Limpiar menciones residuales internas de "Progresión" en fundamental 1-4 / 2027+
      text = text.replace(/\bProgresiones?\s+de\s+Aprendizaje\b/gi, 'Propósitos Formativos');
      text = text.replace(/\bProgresi[oó]n\s+(\d+)\b/gi, 'Propósito Formativo $1');
    } else if (expected === 'Progresión') {
      text = text.replace(
        /^Prop[oó]sito(?:s)?\s+Formativo(?:s)?\s*(\d+)?\s*[:.\-–]?\s*/i,
        (_, num) => (num ? `Progresión ${num}: ` : 'Progresión: ')
      );
      text = text.replace(/\bProp[oó]sitos\s+Formativos\b/gi, 'Progresiones de Aprendizaje');
      text = text.replace(/\bProp[oó]sito\s+Formativo\s+(\d+)\b/gi, 'Progresión $1');
    } else if (expected === 'Actividad Clave') {
      text = text.replace(
        /^(?:Prop[oó]sito\s+Formativo|Progresi[oó]n(?:\s+de\s+Aprendizaje)?)\s*(\d+)?\s*[:.\-–]?\s*/i,
        (_, num) => (num ? `Actividad Clave ${num}: ` : 'Actividad Clave: ')
      );
    }
  }

  // 3. Compactar a <= maxChars respetando límites de oración o palabra limpia
  if (text.length <= maxChars) return text;

  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [];
  let acc = '';
  for (const s of sentences) {
    const next = acc ? `${acc} ${s.trim()}` : s.trim();
    if (next.length <= maxChars) {
      acc = next;
    } else {
      break;
    }
  }
  if (acc.length >= 60) return acc;

  const cut = text.slice(0, maxChars - 1);
  const lastSpace = cut.lastIndexOf(' ');
  const trimmed = (lastSpace > 40 ? cut.slice(0, lastSpace) : cut)
    .replace(/[\s,;:\-–—]+$/, '')
    .replace(/\b(?:de|del|la|el|los|las|y|o|e|en|con|para|por|que|como|su|sus|un|una|al|a)$/i, '')
    .trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function isWeek16(week: string | undefined): boolean {
  const s = String(week ?? '');
  return /\bsemana\s*16\b/i.test(s) || /^\s*16\s*$/.test(s);
}

export interface SanitizePaecPlanResult {
  rows: PlanOperativoRow[];
  droppedParityCount: number;
  droppedDuplicateCount: number;
  distilledProgressionCount: number;
}

/**
 * Post-procesa el Plan Operativo de un semestre (A o B):
 *  - Filtra fugas de paridad derivadas del catálogo/mapeo
 *  - Elimina duplicados exactos y near-duplicados (>= 0.80) fuera de Semana 16
 *  - Destila `progression` (<= 280 chars, nomenclatura MCCEMS por ciclo)
 */
export function sanitizePaecOperationalPlan(
  rows: PlanOperativoRow[],
  uacCatalog: PaecUacCatalogMeta[],
  options: {
    parity: 1 | 0;
    cicloEscolar?: string;
    maxProgressionChars?: number;
  }
): SanitizePaecPlanResult {
  const { parity, cicloEscolar = '2026-2027', maxProgressionChars = PAEC_QA_THRESHOLDS.progStrictMaxChars } = options;
  const output: PlanOperativoRow[] = [];
  const seenNon16Normalized = new Set<string>();
  const keptNon16Texts: string[] = [];

  let droppedParityCount = 0;
  let droppedDuplicateCount = 0;
  let distilledProgressionCount = 0;

  for (const row of rows) {
    const uacName = String(row.uac ?? '').trim();
    const meta = uacCatalog.find((u) => uacMatches(u.uacName, uacName));
    const resolvedSem = meta?.semester && meta.semester >= 1 && meta.semester <= 6 ? meta.semester : null;

    // 1. Guard de paridad (solo si conocemos el semestre en el catálogo/mapeo)
    if (resolvedSem !== null && resolvedSem % 2 !== parity) {
      droppedParityCount++;
      continue;
    }

    // 2. Deduplicación (exacta y near-dup >= 0.80) EXCLUYENDO Semana 16 (cierre compartido legítimo)
    const activity = String(row.activity ?? '').trim();
    if (!isWeek16(row.week) && activity) {
      const normAct = normalizeQaText(activity);
      if (seenNon16Normalized.has(normAct)) {
        droppedDuplicateCount++;
        continue;
      }
      const isNearDup = keptNon16Texts.some(
        (prev) => sixGramOverlap(activity, prev) >= PAEC_QA_THRESHOLDS.nearDupOverlap
      );
      if (isNearDup) {
        droppedDuplicateCount++;
        continue;
      }
      seenNon16Normalized.add(normAct);
      keptNon16Texts.push(activity);
    }

    // 3. Destilación de progression + nomenclatura MCCEMS
    const component = isLikelyLaboralUac(uacName, meta?.component ?? '')
      ? 'competencias_laborales'
      : meta?.component ?? 'fundamental';
    const rawProg = String(row.progression ?? '');
    const distilled = distillPaecProgression(rawProg, {
      semester: resolvedSem,
      component,
      cicloEscolar,
      maxChars: maxProgressionChars,
    });
    if (distilled !== rawProg) distilledProgressionCount++;

    output.push({
      ...row,
      progression: distilled || rawProg,
    });
  }

  return {
    rows: output,
    droppedParityCount,
    droppedDuplicateCount,
    distilledProgressionCount,
  };
}
