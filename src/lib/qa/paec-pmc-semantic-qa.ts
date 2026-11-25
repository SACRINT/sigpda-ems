/**
 * paec-pmc-semantic-qa.ts — Motor Determinista de QA Semántico para PAEC y PMC
 * SIGPDA-EMS · MCCEMS / DGB / SEMS Puebla
 *
 * Fuente única de verdad (SSoT) consumida por:
 *  - `scripts/qa-paec-pmc.ts` (`npm run qa:paec-pmc`)
 *  - Gates de exportación DOCX/PDF (HTTP 422 solo en FAIL duro; WARN se registra y avisa)
 *  - Pruebas de invariantes en Vitest (`src/__tests__/paec-pmc-semantic-invariants.test.ts`)
 *
 * Política de severidad (docs/QA_SEMANTICO_PAEC_PMC_2026-11-24.md v2):
 *  - FAIL duro: invariantes objetivos que rompen validez normativa/matemática.
 *  - WARN: heurísticas editoriales o deuda histórica controlada.
 */

import { PMC_NOMBRES_CATEGORIAS, normalizePmcCategoria } from '@/lib/constants/pmc-categorias';
import { uacMatches } from '@/lib/paec-context';
import { findForbiddenPlatformTerms } from '@/lib/qa/forbidden-terms';

export const PLACEHOLDER_RE =
  /\b(sin registro|lorem|ipsum|tbd|n\/a|pendiente de definir|por definir)\b|\[POR DEFINIR/i;

export const CLOSURE_RE =
  /cierre|feria|entrega|evaluaci[oó]n|difusi[oó]n|clausura|exposici[oó]n|socializaci[oó]n|transferencia/i;

/**
 * Léxico de acción operativa PAEC: acepta verbos conjugados/infinitivos
 * Y nominalizaciones operativas estándar en tablas del Plan Operativo.
 */
export const PAEC_ACTION_RE =
  /\b(dise[nñ](?:a|ar|o|os)?|aplica(?:r|ci[oó]n)?|recolecta(?:r)?|recolecci[oó]n|elabora(?:r|ci[oó]n)?|mide|medir|medici[oó]n|analiza(?:r)?|an[aá]lisis|construye|construir|construcci[oó]n|integra(?:r|ci[oó]n)?|gestiona(?:r)?|gesti[oó]n|organiza(?:r|ci[oó]n)?|redacta(?:r)?|redacci[oó]n|traduce|traducir|traducci[oó]n|realiza(?:r|ci[oó]n)?|ejecuta(?:r)?|ejecuci[oó]n|implementa(?:r|ci[oó]n)?|eval[uú]a(?:r)?|evaluaci[oó]n|simula(?:r|ci[oó]n)?|digitaliza(?:r|ci[oó]n)?|calcula(?:r)?|c[aá]lculo|diagnostica(?:r)?|diagn[oó]stico|instala(?:r|ci[oó]n)?|monitorea(?:r)?|monitoreo|modela(?:r|do|je)?|registra(?:r)?|registro|investiga(?:r|ci[oó]n)?|presenta(?:r|ci[oó]n)?|crea(?:r|ci[oó]n)?|produce|producir|producci[oó]n|desarrolla(?:r|o)?|documenta(?:r|ci[oó]n)?|compara(?:r|ci[oó]n)?|identifica(?:r|ci[oó]n)?|propone(?:r)?|propuesta|selecciona(?:r)?|selecci[oó]n|prepara(?:r|ci[oó]n)?|expone(?:r)?|exposici[oó]n|difunde|difundir|difusi[oó]n|mapea(?:r|o)?|encuesta(?:r|s)?|entrevista(?:r|s)?|formula(?:r|ci[oó]n)?|resuelve|resolver|resoluci[oó]n|grafica(?:r|ci[oó]n)?|interpreta(?:r|ci[oó]n)?|argumenta(?:r|ci[oó]n)?|debate|debatir|clasifica(?:r|ci[oó]n)?|verifica(?:r|ci[oó]n)?|comprueba|comprobar|comprobaci[oó]n|configura(?:r|ci[oó]n)?|programa(?:r|ci[oó]n)?|edita(?:r)?|edici[oó]n|publica(?:r|ci[oó]n)?|coordina(?:r|ci[oó]n)?|supervisa(?:r)?|supervisi[oó]n|facilita(?:r|ci[oó]n)?|procesa(?:r|miento)?|despliegue|habilitaci[oó]n|lectura|muestreo|levantamiento|campa[nñ]a|taller|jornada|feria|sistematizaci[oó]n|prototipado|capacitaci[oó]n|socializaci[oó]n|sensibilizaci[oó]n|promoci[oó]n|validaci[oó]n|revisi[oó]n|rehabilitaci[oó]n|saneamiento|reforestaci[oó]n|limpieza|acondicionamiento)\b/i;

export const PAEC_QA_THRESHOLDS = {
  weeksMin: 16,
  colsMinRatio: 0.95,
  actMinWords: 6,
  actMaxWords: 45,
  actAvgMaxWords: 30,
  nearDupOverlap: 0.8,
  progCopyOverlap: 0.7,
  progWarnChars: 400,
  progStrictMaxChars: 280,
} as const;

export const PMC_QA_THRESHOLDS = {
  diagMinChars: 200,
  fodaMinBullets: 3,
  creaaMinRatio: 0.85,
  planMaxChars: 150000,
  dimensionalTolerancePct: 0.6,
} as const;

export interface SemanticQaResult {
  passed: boolean;
  fails: string[];
  warns: string[];
  metrics: Record<string, number | string | boolean>;
}

export interface PaecUacCatalogMeta {
  uacName: string;
  semester: number;
  component: string;
}

export interface PaecPlanRowLike {
  phase?: unknown;
  activity?: unknown;
  uac?: unknown;
  progression?: unknown;
  strategy?: unknown;
  week?: unknown;
  responsibles?: unknown;
  evaluationInstrument?: unknown;
  semester?: unknown;
}

export interface AuditPaecPlanOptions {
  /** 1 = Semestre A (impares: 1, 3, 5), 0 = Semestre B (pares: 2, 4, 6) */
  parity: 1 | 0;
  cicloEscolar?: string;
  label?: string;
  /** En modo estricto (nueva generación), progression >280 y nomenclatura MCCEMS suben a FAIL */
  strict?: boolean;
}

export function normalizeQaText(s = ''): string {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function countQaWords(s = ''): number {
  const trimmed = String(s ?? '').trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

export function textNgrams(s: string, n = 6): Set<string> {
  const w = normalizeQaText(s).split(' ').filter(Boolean);
  const set = new Set<string>();
  for (let i = 0; i + n <= w.length; i++) {
    set.add(w.slice(i, i + n).join(' '));
  }
  return set;
}

export function sixGramOverlap(a: string, b: string, n = 6): number {
  const A = textNgrams(a, n);
  const B = textNgrams(b, n);
  if (!A.size) return 0;
  let shared = 0;
  for (const g of A) {
    if (B.has(g)) shared++;
  }
  return shared / A.size;
}

export function isLaboralComponent(component = '', uacName = ''): boolean {
  if (/laboral|competencias_laborales|capacitaci[oó]n|t[eé]cnic/i.test(component)) return true;
  if (!component && uacName) {
    return /^(?:Elabora|Emplea|Establece|Opera|Aplica|Instala|Configura|Dise[nñ]a|Produce|Prepara|Administra|Gestiona|Desarrolla|Mantiene|Diagnostica|Construye|Maneja|Controla|Realiza|Ejecuta|Programa|Repara|Supervisa|Utiliza|Verifica|Integra)\s+[a-záéíóúñ]/u.test(
      uacName.trim()
    );
  }
  return false;
}

/**
 * Resuelve la etiqueta curricular oficial MCCEMS de forma data-driven
 * según componente, semestre y ciclo escolar:
 *  - Formación Laboral (sem 2–6): "Actividad Clave"
 *  - Fundamental ciclo >= 2027-2028: "Propósito Formativo" (todos los semestres)
 *  - Fundamental ciclo < 2027-2028: 1–4 = "Propósito Formativo", 5–6 = "Progresión"
 */
export function resolveExpectedMccemsLabel(
  semester: number,
  component = '',
  cicloEscolar = '',
  uacName = ''
): 'Actividad Clave' | 'Propósito Formativo' | 'Progresión' {
  if (isLaboralComponent(component, uacName)) return 'Actividad Clave';
  const startYearMatch = String(cicloEscolar || '').match(/(20\d{2})/);
  const startYear = startYearMatch ? Number(startYearMatch[1]) : 2026;
  if (startYear >= 2027) return 'Propósito Formativo';
  return semester >= 5 ? 'Progresión' : 'Propósito Formativo';
}

/**
 * Infiere el semestre desde el numeral romano final del nombre de la UAC
 * solo como respaldo defensivo si no vino explícito en el mapeo.
 */
export function inferSemesterFromUacName(uacName: string): number | null {
  const clean = String(uacName || '').trim();
  const m = clean.match(/\b(VI|IV|V|III|II|I)\b(?:\s*[:.\-–].*)?$/);
  if (!m) return null;
  const romanMap: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6 };
  return romanMap[m[1]] ?? null;
}

/**
 * Fórmula exacta F11 para meta de reprobación:
 * En F11, aprobados + reprobados + bajas = totalAlumnos (mismo denominador).
 * Por tanto:
 *   reprobacion_meta = min(reprobacion_ant, max(0, 100 - aprobacion_meta - bajas_pct))
 * Caso borde: si reprobacion_ant === 0 -> 0 (jamás proponer subir la reprobación).
 */
export function computeRecommendedReprobacionMeta(params: {
  aprobacionMeta?: number | null;
  reprobacionAnt?: number | null;
  bajasPct?: number | null;
}): number | undefined {
  const { aprobacionMeta, reprobacionAnt, bajasPct } = params;
  const hasRepAnt = typeof reprobacionAnt === 'number' && Number.isFinite(reprobacionAnt);
  const hasApMeta = typeof aprobacionMeta === 'number' && Number.isFinite(aprobacionMeta);
  const hasBajas = typeof bajasPct === 'number' && Number.isFinite(bajasPct) && bajasPct >= 0;

  if (hasRepAnt && reprobacionAnt <= 0) {
    return 0;
  }

  let candidate: number | undefined;
  if (hasApMeta) {
    const raw = hasBajas ? 100 - aprobacionMeta - bajasPct : 100 - aprobacionMeta;
    candidate = Math.max(0, raw);
  } else if (hasRepAnt) {
    candidate = Math.max(0, reprobacionAnt - 5);
  }

  if (candidate === undefined) return undefined;
  if (hasRepAnt) {
    candidate = Math.min(reprobacionAnt, candidate);
  }
  return Math.max(0, Math.round(candidate * 10) / 10);
}

function extractRomanNumeralToken(name: string): string | null {
  const m = String(name || '').match(/\b(VI|IV|V|III|II|I)\b(?:\s*[:.\-–].*)?$/i);
  return m ? m[1].toUpperCase() : null;
}

function uacMatchesRespectingRoman(a: string, b: string): boolean {
  const rA = extractRomanNumeralToken(a);
  const rB = extractRomanNumeralToken(b);
  if (rA && rB && rA !== rB) return false;
  return uacMatches(a, b);
}

function findUacMeta(
  uacList: PaecUacCatalogMeta[],
  name: string,
  expectedParity?: 1 | 0
): PaecUacCatalogMeta | undefined {
  const n = normalizeQaText(name);
  if (!n) return undefined;
  // 1. Coincidencia exacta priorizando paridad esperada
  const exactMatches = uacList.filter((u) => normalizeQaText(u.uacName) === n);
  if (exactMatches.length === 1) return exactMatches[0];
  if (exactMatches.length > 1 && expectedParity !== undefined) {
    const parityMatch = exactMatches.find((u) => u.semester % 2 === expectedParity);
    if (parityMatch) return parityMatch;
  }
  if (exactMatches.length > 0) return exactMatches[0];

  // 2. Coincidencia con uacMatches respetando numeral romano (evita que II matchee con I)
  const fuzzy = uacList.filter((u) => uacMatchesRespectingRoman(u.uacName, name));
  if (fuzzy.length === 1) return fuzzy[0];
  if (fuzzy.length > 1 && expectedParity !== undefined) {
    const parityMatch = fuzzy.find((u) => u.semester % 2 === expectedParity);
    if (parityMatch) return parityMatch;
  }
  return fuzzy[0];
}

function isWeek16(week: unknown): boolean {
  const s = String(week ?? '');
  return /\bsemana\s*16\b/i.test(s) || /^\s*16\s*$/.test(s);
}

export function auditPaecPlan(
  rows: PaecPlanRowLike[],
  uacCatalog: PaecUacCatalogMeta[],
  options: AuditPaecPlanOptions
): SemanticQaResult {
  const { parity, cicloEscolar = '2026-2027', strict = false } = options;
  const fails: string[] = [];
  const warns: string[] = [];

  if (!rows.length) {
    fails.push('Plan operativo vacío (0 filas)');
    return { passed: false, fails, warns, metrics: { rows: 0, weeks: 0, avgWords: 0 } };
  }

  // 1. Cobertura semanal (semanas 1..16)
  const weeks = new Set<string>();
  for (const r of rows) {
    const m = String(r.week ?? '').match(/\d+/);
    if (m?.[0]) weeks.add(m[0]);
  }
  const missingWeeks: number[] = [];
  for (let w = 1; w <= PAEC_QA_THRESHOLDS.weeksMin; w++) {
    if (!weeks.has(String(w))) missingWeeks.push(w);
  }
  if (missingWeeks.length > 0) {
    fails.push(`semanas sin actividad: ${missingWeeks.join(', ')}`);
  }

  // 2. 8 columnas normativas
  const reqCols: Array<keyof PaecPlanRowLike> = [
    'phase',
    'activity',
    'uac',
    'progression',
    'strategy',
    'week',
    'responsibles',
    'evaluationInstrument',
  ];
  let filledCells = 0;
  const totalCells = rows.length * reqCols.length;
  const emptyColIssues: string[] = [];
  rows.forEach((r, idx) => {
    for (const c of reqCols) {
      if (String(r[c] ?? '').trim().length > 0) {
        filledCells++;
      } else {
        emptyColIssues.push(`fila ${idx + 1}: columna ${c} vacía`);
      }
    }
  });
  const colFillRatio = totalCells > 0 ? filledCells / totalCells : 0;
  if (colFillRatio < PAEC_QA_THRESHOLDS.colsMinRatio) {
    fails.push(`completitud de 8 columnas ${(colFillRatio * 100).toFixed(1)}% < 95%`);
  }
  for (const issue of emptyColIssues) {
    fails.push(issue);
  }

  // 3. Análisis por fila
  let totalWords = 0;
  let noActionCount = 0;
  let rawProgCount = 0;

  rows.forEach((r, idx) => {
    const rowNum = idx + 1;
    const act = String(r.activity ?? '').trim();
    const prog = String(r.progression ?? '').trim();
    const uac = String(r.uac ?? '').trim();
    const w = countQaWords(act);
    totalWords += w;

    if (PLACEHOLDER_RE.test(act) || PLACEHOLDER_RE.test(prog)) {
      fails.push(`fila ${rowNum}: contiene placeholder o texto genérico prohibido`);
    }
    const forbidden = findForbiddenPlatformTerms(r);
    if (forbidden.length > 0) {
      fails.push(`fila ${rowNum}: mención prohibida de plataforma (${forbidden.join(', ')})`);
    }
    if (w < PAEC_QA_THRESHOLDS.actMinWords) {
      fails.push(`fila ${rowNum}: activity muy corta (${w}w < ${PAEC_QA_THRESHOLDS.actMinWords}w)`);
    } else if (w > PAEC_QA_THRESHOLDS.actMaxWords) {
      warns.push(`fila ${rowNum}: activity larga (${w}w > ${PAEC_QA_THRESHOLDS.actMaxWords}w)`);
    }
    if (!PAEC_ACTION_RE.test(act)) {
      noActionCount++;
      warns.push(`fila ${rowNum}: sin verbo o nominalización operativa reconocible ("${act.slice(0, 45)}…")`);
    }
    if (prog && sixGramOverlap(act, prog) >= PAEC_QA_THRESHOLDS.progCopyOverlap) {
      warns.push(`fila ${rowNum}: activity copia ≥70% de progression`);
    }
    const hasRawContenidos = /\[?\bContenidos(?:\s+formativos)?\s*:/i.test(prog);
    if (prog.length > PAEC_QA_THRESHOLDS.progWarnChars || hasRawContenidos) {
      rawProgCount++;
      const msg = `fila ${rowNum}: progression cruda (${prog.length} chars${hasRawContenidos ? ', contiene "Contenidos:"' : ''})`;
      if (strict && (prog.length > PAEC_QA_THRESHOLDS.progStrictMaxChars || hasRawContenidos)) {
        fails.push(msg);
      } else {
        warns.push(msg);
      }
    } else if (strict && prog.length > PAEC_QA_THRESHOLDS.progStrictMaxChars) {
      fails.push(`fila ${rowNum}: progression no destilada (${prog.length} > ${PAEC_QA_THRESHOLDS.progStrictMaxChars} chars)`);
    }

    // Paridad de semestre y nomenclatura MCCEMS (estrictamente data-driven desde mapeo/catálogo o semestre explícito;
    // nunca adivinar semestre desde el numeral romano porque p.ej. Conciencia Histórica II es 5.º semestre)
    const meta = findUacMeta(uacCatalog, uac, parity);
    const explicitSem = Number(r.semester);
    const resolvedSem =
      Number.isFinite(explicitSem) && explicitSem >= 1 && explicitSem <= 6
        ? explicitSem
        : meta?.semester && meta.semester >= 1 && meta.semester <= 6
          ? meta.semester
          : null;

    if (!meta && uacCatalog.length > 0) {
      warns.push(`fila ${rowNum}: UAC sin coincidencia en mapeo (${uac.slice(0, 48)})`);
    }
    if (resolvedSem !== null && resolvedSem % 2 !== parity) {
      fails.push(
        `fila ${rowNum}: paridad rota — "${uac}" es semestre ${resolvedSem} en Semestre ${parity === 1 ? 'A (impares 1/3/5)' : 'B (pares 2/4/6)'}`
      );
    }

    if (resolvedSem !== null && prog) {
      const expected = resolveExpectedMccemsLabel(resolvedSem, meta?.component ?? '', cicloEscolar, uac);
      const progLower = prog.toLowerCase();
      const matchesExpected =
        expected === 'Actividad Clave'
          ? /actividad\s+clave|saber(?:es)?/i.test(prog)
          : expected === 'Propósito Formativo'
            ? /prop[oó]sito\s+formativo/i.test(prog) && !/\bprogresi[oó]n(?:es)?\b/i.test(prog)
            : /progresi[oó]n/i.test(prog);

      const hasForbiddenProgInProp =
        expected === 'Propósito Formativo' && /\bprogresi[oó]n(?:es)?\b/i.test(progLower);

      if (!matchesExpected) {
        const msg = `fila ${rowNum} (${uac}, sem ${resolvedSem}): se esperaba "${expected}" en progression`;
        if (strict && hasForbiddenProgInProp) {
          fails.push(msg);
        } else {
          warns.push(msg);
        }
      }
    }
  });

  const avgWords = totalWords / rows.length;
  if (avgWords > PAEC_QA_THRESHOLDS.actAvgMaxWords) {
    warns.push(`promedio de actividad ${avgWords.toFixed(1)}w > ${PAEC_QA_THRESHOLDS.actAvgMaxWords}w`);
  }

  // 4. Duplicados exactos y near-duplicados (excluyendo Semana 16 — cierre compartido legítimo)
  const dupMap = new Map<string, number[]>();
  const nonWeek16Acts: Array<{ rowNum: number; text: string }> = [];
  rows.forEach((r, idx) => {
    if (isWeek16(r.week)) return;
    const text = String(r.activity ?? '');
    const key = normalizeQaText(text);
    if (!key) return;
    const arr = dupMap.get(key) ?? [];
    arr.push(idx + 1);
    dupMap.set(key, arr);
    nonWeek16Acts.push({ rowNum: idx + 1, text });
  });
  for (const [k, indices] of dupMap) {
    if (indices.length > 1) {
      fails.push(`duplicado exacto x${indices.length} (filas ${indices.join(',')}): "${k.slice(0, 55)}"`);
    }
  }
  let nearDupCount = 0;
  for (let i = 0; i < nonWeek16Acts.length; i++) {
    for (let j = i + 1; j < nonWeek16Acts.length; j++) {
      if (nonWeek16Acts[i].text === nonWeek16Acts[j].text) continue;
      if (sixGramOverlap(nonWeek16Acts[i].text, nonWeek16Acts[j].text) >= PAEC_QA_THRESHOLDS.nearDupOverlap) {
        nearDupCount++;
        warns.push(
          `near-dup filas ${nonWeek16Acts[i].rowNum}↔${nonWeek16Acts[j].rowNum}: "${nonWeek16Acts[i].text.slice(0, 34)}…" ~ "${nonWeek16Acts[j].text.slice(0, 34)}…"`
        );
      }
    }
  }

  // 5. Cobertura de UACs del mapeo filtradas por la paridad del semestre
  const parityCatalog = uacCatalog.filter((u) => u.semester >= 1 && u.semester % 2 === parity);
  const planUacNames = rows.map((r) => String(r.uac ?? '').trim()).filter(Boolean);
  for (const mapped of parityCatalog) {
    const covered = planUacNames.some((u) => uacMatches(u, mapped.uacName));
    if (!covered) {
      warns.push(`UAC mapeada (sem ${mapped.semester}) sin actividad en Semestre ${parity === 1 ? 'A' : 'B'}: ${mapped.uacName}`);
    }
  }

  // 6. Hito de cierre en Semana 16
  const w16Text = rows
    .filter((r) => isWeek16(r.week))
    .map((r) => `${String(r.activity ?? '')} ${String(r.strategy ?? '')}`)
    .join(' ');
  if (w16Text && !CLOSURE_RE.test(w16Text)) {
    warns.push('Semana 16 sin hito explícito de cierre/feria/transferencia');
  }

  return {
    passed: fails.length === 0,
    fails,
    warns,
    metrics: {
      rows: rows.length,
      weeks: weeks.size,
      avgWords: Number(avgWords.toFixed(1)),
      colFillPct: Number((colFillRatio * 100).toFixed(1)),
      noActionCount,
      rawProgCount,
      nearDupCount,
    },
  };
}

// ---------------------------------------------------------------------------
// PMC Semantic QA
// ---------------------------------------------------------------------------

export interface PmcProjectLike {
  school_name?: unknown;
  school_cct?: unknown;
  indicadores_academicos?: Record<string, unknown> | null;
  foda?: Record<string, unknown> | null;
  foda_cruzado?: Record<string, unknown> | null;
  diagnostico_generado?: Record<string, unknown> | null;
  plan_accion?: Record<string, unknown> | null;
}

export interface AuditPmcOptions {
  /** En modo estricto (nueva generación), CREAA <85% y FODA cruzado ausente son FAIL */
  strict?: boolean;
}

function pickIndicatorNumber(ind: Record<string, unknown>, key: string): number | undefined {
  const direct = ind[key];
  if (typeof direct === 'number' && Number.isFinite(direct)) return direct;
  if (typeof direct === 'string' && direct.trim() !== '' && Number.isFinite(Number(direct))) {
    return Number(direct);
  }
  const calc = (ind._calc as Record<string, { valor?: unknown }> | undefined)?.[key];
  if (calc && typeof calc.valor === 'number' && Number.isFinite(calc.valor)) {
    return calc.valor;
  }
  return undefined;
}

/**
 * Extrae el porcentaje real de bajas/sin calificación del F11 (nunca confunde conteo de alumnos con %).
 */
export function resolveBajasPercentage(ind: Record<string, unknown>): number | undefined {
  const pcts = ind.porcentajes as Record<string, unknown> | undefined;
  if (pcts && typeof pcts.bajas === 'number' && Number.isFinite(pcts.bajas)) {
    return pcts.bajas;
  }
  const bajasCount = pickIndicatorNumber(ind, 'bajas');
  const totalF11 = pickIndicatorNumber(ind, 'totalAlumnosF11');
  if (bajasCount !== undefined && totalF11 !== undefined && totalF11 > 0 && bajasCount <= totalF11) {
    return Number(((bajasCount / totalF11) * 100).toFixed(1));
  }
  const apAnt = pickIndicatorNumber(ind, 'aprobacion_ant');
  const repAnt = pickIndicatorNumber(ind, 'reprobacion_ant');
  if (apAnt !== undefined && repAnt !== undefined && apAnt + repAnt <= 100) {
    return Number(Math.max(0, 100 - apAnt - repAnt).toFixed(1));
  }
  return undefined;
}

function countFodaBullets(val: unknown): number {
  if (Array.isArray(val)) return val.filter((v) => String(v ?? '').trim().length >= 8).length;
  const s = String(val ?? '').trim();
  if (!s) return 0;
  const byMarker = (s.match(/(?:^|\n)\s*(?:•|-|\*|\d+[.)])\s+\S/g) || []).length;
  if (byMarker > 0) return byMarker;
  return s
    .split(/\r?\n|;\s*/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 12).length;
}

const CREAA_VERB_RE =
  /^(aumentar|incrementar|reducir|disminuir|elevar|consolidar|fortalecer|mejorar|lograr|garantizar|promover|atender|desarrollar|implementar|mantener|establecer|alcanzar|asegurar|impulsar|optimizar|sistematizar|fomentar|realizar|dise[nñ]ar|organizar|capacitar|aplicar|firmar|ejecutar|gestionar|construir|elaborar|operar|coordinar|brindar|integrar|vincular|habilitar|equipar|rehabilitar|supervisar|evaluar|actualizar|certificar|formalizar|impartir|ofrecer|generar|fomentar|crear|dar\s+seguimiento)\b/i;
const CREAA_NUM_RE = /\d+(?:[.,]\d+)?\s*%|\b\d+\b/;
const CREAA_POP_RE =
  /(alumnos?|estudiantes?|aprendientes?|j[oó]venes|comunidad|docentes?|plantel|plantilla|grupos?|egresados?|padres|familias|personal|matr[ií]cula|bachillerato|secundarias?|instituciones?|colectivo|tutores?|escuela)/i;
const CREAA_STRAT_RE =
  /(mediante|a trav[eé]s de|implementando|desarrollando|articulando|con base en|con apoyo|por medio de|v[ií]a|con\s+(?:r[uú]bricas|talleres|tutor[ií]as|convenios|acuerdos|observaciones|visitas|cursos|protocolos))/i;
const CREAA_PERIOD_RE = /(ciclo|202\d|semestre|escolar|t[eé]rmino|anual|bimestr|corte|junio|julio|enero|finalizar)/i;

export function isMetaCreaaCompliant(meta: Record<string, unknown>): boolean {
  const text = String(meta.meta ?? '').trim();
  if (!text) return false;
  const hasVerb = CREAA_VERB_RE.test(text);
  const hasNum = CREAA_NUM_RE.test(text);
  const hasPop = CREAA_POP_RE.test(text);
  const hasStrat = CREAA_STRAT_RE.test(text) || String(meta.estrategia ?? '').trim().length >= 20;
  const hasPeriod =
    CREAA_PERIOD_RE.test(text) ||
    String(meta.periodo_fin ?? '').trim().length >= 3 ||
    String(meta.periodo_inicio ?? '').trim().length >= 3;
  return hasVerb && hasNum && hasPop && hasStrat && hasPeriod;
}

export function detectCrossFodaPresence(
  project: PmcProjectLike
): { fo: boolean; do: boolean; fa: boolean; da: boolean } {
  const foda = (project.foda ?? {}) as Record<string, unknown>;
  const crossObj = (project.foda_cruzado ?? foda.cruzado ?? {}) as Record<string, unknown>;
  const narrative = String((project.diagnostico_generado as Record<string, unknown> | null)?.sintesis_foda ?? '');

  const hasKey = (key: 'fo' | 'do' | 'fa' | 'da', regex: RegExp): boolean => {
    const val = crossObj[key] ?? crossObj[key.toUpperCase()];
    if (typeof val === 'string' && val.trim().length >= 20) return true;
    if (Array.isArray(val) && val.some((x) => String(x ?? '').trim().length >= 15)) return true;
    return regex.test(narrative);
  };

  return {
    fo: hasKey('fo', /\bFO\b|\bF-?O\b|Fortalezas\s*[-–+x×y]\s*Oportunidades/i),
    do: hasKey('do', /\bDO\b|\bD-?O\b|Debilidades\s*[-–+x×y]\s*Oportunidades/i),
    fa: hasKey('fa', /\bFA\b|\bF-?A\b|Fortalezas\s*[-–+x×y]\s*Amenazas/i),
    da: hasKey('da', /\bDA\b|\bD-?A\b|Debilidades\s*[-–+x×y]\s*Amenazas/i),
  };
}

export function auditPmcProject(
  p: PmcProjectLike,
  options: AuditPmcOptions = {}
): SemanticQaResult {
  const { strict = false } = options;
  const fails: string[] = [];
  const warns: string[] = [];

  if (!String(p.school_name ?? '').trim() || !String(p.school_cct ?? '').trim()) {
    fails.push('falta school_name o school_cct');
  }

  // Términos prohibidos de plataforma privada
  const forbidden = findForbiddenPlatformTerms([
    p.foda,
    p.diagnostico_generado,
    p.plan_accion,
  ]);
  if (forbidden.length > 0) {
    fails.push(`términos prohibidos de plataforma en contenido oficial: ${Array.from(new Set(forbidden)).join(', ')}`);
  }

  // 1. Indicadores (_calc opcional; campos canónicos siempre validados)
  const ind = (p.indicadores_academicos ?? {}) as Record<string, unknown>;
  const canonicalKeys = ['aprobacion_ant', 'reprobacion_ant', 'abandono_ant', 'et_ant', 'matricula'];
  const presentKeys = canonicalKeys.filter((k) => pickIndicatorNumber(ind, k) !== undefined);
  if (presentKeys.length === 0) {
    fails.push('sin indicadores académicos registrados');
  } else if (presentKeys.length < canonicalKeys.length) {
    warns.push(
      `indicadores canónicos faltantes: ${canonicalKeys.filter((k) => !presentKeys.includes(k)).join(', ')}`
    );
  }

  const calc = (ind._calc ?? {}) as Record<string, { valor?: unknown; formula?: unknown; fuentes?: unknown }>;
  for (const [k, v] of Object.entries(calc)) {
    if (!v || v.valor === null || v.valor === undefined) {
      fails.push(`_calc.${k} sin valor`);
    }
    if (!v?.formula) warns.push(`_calc.${k} sin fórmula`);
    if (!Array.isArray(v?.fuentes) || v.fuentes.length === 0) warns.push(`_calc.${k} sin fuentes`);
  }

  // 2. Invariantes direccionales (FAIL duro)
  const apA = pickIndicatorNumber(ind, 'aprobacion_ant');
  const apM = pickIndicatorNumber(ind, 'aprobacion_meta');
  const rpA = pickIndicatorNumber(ind, 'reprobacion_ant');
  const rpM = pickIndicatorNumber(ind, 'reprobacion_meta');
  const abA = pickIndicatorNumber(ind, 'abandono_ant');
  const abM = pickIndicatorNumber(ind, 'abandono_meta');
  const etA = pickIndicatorNumber(ind, 'et_ant');
  const etM = pickIndicatorNumber(ind, 'et_meta');

  if (apA !== undefined && apM !== undefined && apM < apA) {
    fails.push(`inversión matemática: aprobacion_meta (${apM}%) < aprobacion_ant (${apA}%)`);
  }
  if (rpA !== undefined && rpM !== undefined && rpM > rpA) {
    fails.push(`inversión matemática: reprobacion_meta (${rpM}%) > reprobacion_ant (${rpA}%)`);
  }
  if (abA !== undefined && abM !== undefined && abM > abA) {
    fails.push(`inversión matemática: abandono_meta (${abM}%) > abandono_ant (${abA}%)`);
  }
  if (etA !== undefined && etM !== undefined && etM < etA) {
    fails.push(`inversión matemática: et_meta (${etM}%) < et_ant (${etA}%)`);
  }

  // Coherencia dimensional F11 (usando bajas_pct real, no conteo)
  const bajasPct = resolveBajasPercentage(ind);
  if (apM !== undefined && rpM !== undefined && bajasPct !== undefined && (rpA === undefined || rpA > 0)) {
    const expectedRep = computeRecommendedReprobacionMeta({
      aprobacionMeta: apM,
      reprobacionAnt: rpA,
      bajasPct,
    });
    if (
      expectedRep !== undefined &&
      Math.abs(rpM - expectedRep) > PMC_QA_THRESHOLDS.dimensionalTolerancePct
    ) {
      warns.push(
        `coherencia F11: reprobacion_meta=${rpM}% difiere del recomendado ${expectedRep}% (aprob_meta=${apM}%, bajas=${bajasPct}%)`
      );
    }
  }

  // 3. Diagnóstico narrativo
  const diag = (p.diagnostico_generado ?? {}) as Record<string, unknown>;
  for (const k of ['presentacion', 'contexto', 'priorizacion', 'analisis_indicadores', 'sintesis_foda']) {
    const t = String(diag[k] ?? '');
    if (t.length < PMC_QA_THRESHOLDS.diagMinChars) {
      warns.push(`diagnóstico.${k} ausente o corto (${t.length} < ${PMC_QA_THRESHOLDS.diagMinChars} chars)`);
    }
    if (PLACEHOLDER_RE.test(t)) {
      fails.push(`placeholder en diagnostico_generado.${k}`);
    }
  }

  // 4. FODA + FODA cruzado
  const foda = (p.foda ?? {}) as Record<string, unknown>;
  for (const k of ['fortalezas', 'debilidades', 'oportunidades', 'amenazas']) {
    const bullets = countFodaBullets(foda[k]);
    if (bullets < PMC_QA_THRESHOLDS.fodaMinBullets) {
      warns.push(`FODA.${k} con ${bullets} viñetas (< ${PMC_QA_THRESHOLDS.fodaMinBullets})`);
    }
  }
  const cross = detectCrossFodaPresence(p);
  for (const k of ['fo', 'do', 'fa', 'da'] as const) {
    if (!cross[k]) {
      const msg = `FODA cruzado sin cruce ${k.toUpperCase()}`;
      if (strict) fails.push(msg);
      else warns.push(msg);
    }
  }

  // 5. Plan de acción (metas institucionales + personales)
  const pa = (p.plan_accion ?? {}) as Record<string, unknown>;
  const mi = Array.isArray(pa.metas_institucionales)
    ? (pa.metas_institucionales as Record<string, unknown>[])
    : [];
  const mp = Array.isArray(pa.metas_personales)
    ? (pa.metas_personales as Record<string, unknown>[])
    : [];

  if (mi.length === 0) fails.push('sin metas_institucionales');
  if (mp.length === 0) warns.push('sin metas_personales');

  let creaaOk = 0;
  let nonCanonicalCats = 0;
  mi.forEach((m, idx) => {
    const text = String(m.meta ?? '');
    if (!/\d/.test(text)) warns.push(`meta inst. #${idx + 1} no cuantificada: "${text.slice(0, 40)}"`);
    if (!String(m.entregable ?? '').trim()) warns.push(`meta inst. #${idx + 1} sin entregable`);
    if (!String(m.periodo_fin ?? '').trim() && !String(m.periodo_inicio ?? '').trim()) {
      warns.push(`meta inst. #${idx + 1} sin periodo`);
    }
    if (PLACEHOLDER_RE.test(text)) fails.push(`placeholder en meta inst. #${idx + 1}`);

    const rawCat = String(m.categoria ?? '').trim();
    if (!PMC_NOMBRES_CATEGORIAS.includes(rawCat)) {
      nonCanonicalCats++;
      fails.push(
        `meta inst. #${idx + 1}: categoría no canónica "${rawCat}" (sugerida: "${normalizePmcCategoria(rawCat)}")`
      );
    }

    if (isMetaCreaaCompliant(m)) creaaOk++;
  });

  const creaaRatio = mi.length > 0 ? creaaOk / mi.length : 0;
  if (mi.length > 0 && creaaRatio < PMC_QA_THRESHOLDS.creaaMinRatio) {
    const msg = `cumplimiento CREAA ${(creaaRatio * 100).toFixed(1)}% < ${(PMC_QA_THRESHOLDS.creaaMinRatio * 100).toFixed(0)}% (${creaaOk}/${mi.length})`;
    if (strict) fails.push(msg);
    else warns.push(msg);
  }

  mp.forEach((m, idx) => {
    const text = String(m.meta_individual ?? '');
    if (!/\d/.test(text)) warns.push(`meta personal #${idx + 1} no cuantificada: "${text.slice(0, 40)}"`);
    if (!String(m.entregable ?? '').trim()) warns.push(`meta personal #${idx + 1} sin entregable`);
    if (!String(m.nombre ?? '').trim() || !String(m.cargo ?? '').trim()) {
      warns.push(`meta personal #${idx + 1} sin nombre o cargo`);
    }
    if (PLACEHOLDER_RE.test(text)) fails.push(`placeholder en meta personal #${idx + 1}`);
  });

  const miDup = mi.length - new Set(mi.map((m) => normalizeQaText(String(m.meta ?? '')))).size;
  if (miDup > 0) warns.push(`${miDup} metas institucionales duplicadas`);

  const mpDup = mp.length - new Set(mp.map((m) => normalizeQaText(String(m.meta_individual ?? '')))).size;
  if (mpDup > 0) fails.push(`${mpDup} metas personales duplicadas`);

  const planSize = pa ? JSON.stringify(pa).length : 0;
  if (planSize > PMC_QA_THRESHOLDS.planMaxChars) {
    warns.push(`plan_accion grande (${planSize} chars > ${PMC_QA_THRESHOLDS.planMaxChars})`);
  }

  return {
    passed: fails.length === 0,
    fails,
    warns,
    metrics: {
      indicatorsPresent: presentKeys.length,
      metasInstitucionales: mi.length,
      metasPersonales: mp.length,
      creaaPct: Number((creaaRatio * 100).toFixed(1)),
      nonCanonicalCats,
      planSize,
    },
  };
}
