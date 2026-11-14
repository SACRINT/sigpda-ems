/**
 * content-distiller.ts — Destilador Pedagógico SSoT para SACRINT (08_Presentaciones y 09_Infografias)
 *
 * Centraliza:
 * 1. Sanitización unificada (comentarios workbook, tokens [[material:...]], encabezados y énfasis Markdown, notación LaTeX/math).
 * 2. Guardas contra fugas de rúbricas analíticas o prompts dentro de diapositivas/infografías.
 * 3. Destilación didáctica orientada a aula desde `mission.sessionPlans` (con fallback a `conceptZero` / `MissionSection`),
 *    produciendo cápsulas breves y escaneables (~<=75 palabras por lámina) con cierres sintácticos limpios.
 */

import type { MissionSection, SessionPlan } from '@/types/work-textbook';
import { stripWorkbookTags } from '@/lib/guide-engine/workbook-tags';
import { stripMaterialTokens } from '@/lib/materials/material-tokens';
import { stripInlineMarkdownEmphasis } from '@/lib/utils/inline-markdown';
import { parseContenidoToBloques, parseEjemploResuelto } from '@/lib/editorial/student-content-model';
import { fitPedagogicalText, hasDanglingEnding, repairDanglingEnding } from '@/lib/editorial/pedagogical-text-fitter';
import { resolveChalkboardTopicTitle } from '@/lib/editorial/topic-title-resolver';
import { isValidRenderableFormula } from '@/lib/editorial/text-normalization';
import { normalizeMathNotation } from './math-text';

const RUBRIC_OR_META_LEAK_RE =
  /ponderaci[oó]n\s*:\s*\d+\s*%|excelente\s*\(\s*\d+\s*(?:pts?|puntos?)\s*\)|bueno\s*\(\s*\d+\s*(?:pts?|puntos?)\s*\)|suficiente\s*\(\s*\d+\s*(?:pts?|puntos?)\s*\)|insuficiente\s*\(\s*\d+\s*(?:pts?|puntos?)\s*\)|este\s+(?:ejercicio|apartado)\s+de\s+\d+\s+palabras/i;

const BOILERPLATE_PREFIX_RE =
  /^(?:(?:misi[oó]n|bloque|sesi[oó]n)\s*\d+\s*:\s*)+(?:optimizaci[oó]n\s+y\s+consolidaci[oó]n\s+de\s+la\s+evidencia|exploraci[oó]n\s+diagn[oó]stica\s+y\s+problematizaci[oó]n\s+situada|modelado\s+metodol[oó]gico\s+y\s+procedimientos\s+clave|evaluaci[oó]n\s+(?:de\s+logros|sumativa|diagn[oó]stica)|fundamentaci[oó]n\s+e\s+intuici[oó]n)\s*[—–\-:]\s*/i;

export interface DistilledExample {
  problemStatement: string;
  steps: string[];
  interpretation: string;
}

export interface DistilledPracticeActivity {
  label: string;
  statement: string;
  hint: string;
}

export interface DistilledConceptHighlights {
  definition: string;
  formulas: string[];
  keyRules: string[];
}

export interface DistilledLessonBundle {
  sessionNumber: number | null;
  topicTitle: string;
  objective: string;
  activation: string;
  question: string;
  concepts: DistilledConceptHighlights;
  example: DistilledExample;
  activities: DistilledPracticeActivity[];
  application: string;
  artifactStep: string;
  exitChecks: string[];
}

/**
 * Limpia texto editorial para láminas e infografías preservando operadores aritméticos (`2*x`, `a * b`).
 */
export function cleanSacrintText(value: string | null | undefined): string {
  if (!value) return '';
  let text = stripWorkbookTags(value);
  text = stripMaterialTokens(text);
  // Quitar reglas horizontales y encabezados Markdown manteniendo el título textual
  text = text
    .replace(/^\s*[-*_]{3,}\s*$/gm, ' ')
    .replace(/(^|\r?\n)\s{0,3}#{1,6}\s+/g, '$1')
    .replace(/^\s*[-*•]\s+/gm, '')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '$1');
  text = stripInlineMarkdownEmphasis(text);
  text = normalizeMathNotation(text);
  return text.replace(/\s+/g, ' ').trim();
}

function cleanSacrintTextPreservingLines(value: string | null | undefined): string {
  if (!value) return '';
  let text = stripWorkbookTags(value);
  text = stripMaterialTokens(text);
  text = text
    .replace(/^\s*[-*_]{3,}\s*$/gm, ' ')
    .replace(/(^|\r?\n)\s{0,3}#{1,6}\s+/g, '$1')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '$1');
  text = stripInlineMarkdownEmphasis(text);
  text = normalizeMathNotation(text);
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

export function sanitizePedagogicalMetaPhrases(value: string | null | undefined): string {
  if (!value) return '';
  let out = value
    .replace(
      /(?:(?:la|una|tu|su)\s+)?versi[oó]n\s+depurada(?:\s+y\s+validada)?\s+(?:de\s+(?:tu\s+|la\s+|su\s+)?)?/gi,
      ''
    )
    .replace(/\bversi[oó]n\s+depurada(?:\s+y\s+validada)?\b/gi, 'síntesis final')
    .replace(/\b(?:tu|la|su|una)\s+evidencia\s+formativa\b/gi, 'el producto de aprendizaje')
    .replace(/\bevidencia\s+formativa\b/gi, 'producto de aprendizaje')
    .replace(
      /\b(?:mediante|con(?:\s+base\s+en)?|seg[uú]n|usando|a\s+trav[eé]s\s+de)\s+(?:una\s+)?(?:escala\s+estimativa|lista\s+de\s+cotejo|r[uú]brica\s+anal[ií]tica)(?:\s*(?:y|,)\s*(?:una\s+)?(?:escala\s+estimativa|lista\s+de\s+cotejo|r[uú]brica\s+anal[ií]tica))?\b/gi,
      'con criterios de clase'
    )
    .replace(/\b(?:escala\s+estimativa|lista\s+de\s+cotejo|r[uú]brica\s+anal[ií]tica)\b/gi, 'pauta de logro')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[.,;:\s]+/, '')
    .trim();
  if (out) {
    out = out.charAt(0).toUpperCase() + out.slice(1);
  }
  return out;
}

/** Detecta fragmentos de rúbricas de evaluación o instrucciones de prompt filtradas en campos de contenido. */
export function isRubricOrBoilerplateLeak(value: string | null | undefined): boolean {
  const cleaned = cleanSacrintText(value);
  if (!cleaned) return false;
  if (RUBRIC_OR_META_LEAK_RE.test(cleaned)) return true;
  if (/^r[úu]brica\s+anal[íi]tica\s*[:\-–]?$/i.test(cleaned)) return true;
  if (
    /r[úu]brica\s+anal[íi]tica/i.test(cleaned) &&
    /criterio\s*:|ponderaci[oó]n|excelente|insuficiente|requiere\s+apoyo|niveles?\s+de\s+desempe[ñn]o|\b\d+\s*(?:pts?|puntos?|%)/i.test(
      cleaned
    )
  ) {
    return true;
  }
  if (/^fases?\s+del\s+proyecto\s+formativo\s*:?\s*$/i.test(cleaned)) return true;
  if (/^criterio\s*:\s*/i.test(cleaned) && /ponderaci[oó]n|excelente|requiere\s+apoyo/i.test(cleaned)) return true;
  return false;
}

/**
 * Extrae el nombre curricular real de una misión o sesión sin prefijos burocráticos repetidos.
 */
export function extractCleanTopicTitle(
  rawTitle: string | null | undefined,
  fallbackTopic?: string | null
): string {
  const raw = cleanSacrintText(rawTitle);
  const withoutBoilerplate = raw.replace(BOILERPLATE_PREFIX_RE, '').trim();
  const candidate = withoutBoilerplate || cleanSacrintText(fallbackTopic);
  if (!candidate) return 'Concepto central de la clase';
  return candidate.charAt(0).toUpperCase() + candidate.slice(1);
}

/**
 * Sintetiza un objetivo extenso ("Vas a identificar el concepto de ecuación...") en un
 * título conciso de pizarrón para el docente ("Concepto de ecuación para modelar situaciones").
 */
export function extractChalkboardTopicTitle(
  rawObjectiveOrTitle: string | null | undefined,
  fallbackTopic?: string | null,
  extraContext?: string | null
): string {
  return resolveChalkboardTopicTitle({
    conceptosClave: extraContext ?? null,
    sessionObjective: rawObjectiveOrTitle,
    missionSessionTopic: fallbackTopic,
    missionTitle: fallbackTopic,
  });
}

/**
 * Limpia subtítulos de portada o síntesis de misión que contengan listas "Sesión 1: ... · Sesión 2: ..."
 * o cortes de presupuesto como "... y activarás tus".
 */
export function cleanMissionTopicLine(
  rawTopic: string | null | undefined,
  fallbackTitle?: string | null,
  maxChars = 175,
  maxWords = 28
): string {
  const clean = cleanSacrintText(rawTopic)
    .replace(/\s+y\s+activar[aá]s\s+tus(?:\s+[a-záéíóúñ]+)?(?=[\s·.,;:]|$)/gi, '')
    .replace(/\s+(?:de|del|en|con|por|para|mediante|utilizando|como|y|o|el|la|los|las|un|una|tus|sus)\s*(?=·|$)/gi, '')
    .trim();
  if (!clean) return cleanSacrintText(fallbackTitle) || 'Síntesis curricular de la misión';

  if (/sesi[oó]n\s*\d+\s*:/i.test(clean)) {
    const parts = clean
      .split(/\s*·\s*/)
      .map((part) => {
        const m = part.match(/^(sesi[oó]n\s*\d+)\s*:\s*(.+)$/i);
        if (!m) return extractChalkboardTopicTitle(part);
        return `${m[1]}: ${extractChalkboardTopicTitle(m[2])}`;
      })
      .filter(Boolean);
    if (parts.length > 0) {
      const joined = parts.slice(0, 4).join(' · ');
      return fitPedagogicalText(joined, { maxChars, maxWords, role: 'concept', ensurePeriod: false }) || joined;
    }
  }

  return distillConciseText(clean, maxChars, maxWords) || clean;
}

/**
 * Sintetiza texto denso a un límite legible en proyector o tarjeta manteniendo oraciones completas
 * y sin cortes abruptos a mitad de frase o ecuación.
 */
export function distillConciseText(
  value: string | null | undefined,
  maxChars: number,
  maxWords?: number
): string {
  const clean = sanitizePedagogicalMetaPhrases(cleanSacrintText(value));
  if (!clean || isRubricOrBoilerplateLeak(clean)) return '';

  const fitted = fitPedagogicalText(clean, {
    maxChars,
    maxWords,
    role: 'general',
  });
  return fitted || clean;
}

/** Divide un párrafo largo en puntos clave breves para proyección en aula. */
export function extractBulletSentences(
  value: string | null | undefined,
  maxItems = 3,
  maxCharsPerItem = 140
): string[] {
  const clean = cleanSacrintText(value);
  if (!clean || isRubricOrBoilerplateLeak(clean)) return [];

  const sentences = clean
    .split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ0-9(¿¡])/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 12 && !isRubricOrBoilerplateLeak(s));

  const out: string[] = [];
  for (const sentence of sentences) {
    if (out.length >= maxItems) break;
    const distilled = distillConciseText(sentence, maxCharsPerItem);
    if (distilled && !out.includes(distilled)) {
      out.push(distilled);
    }
  }
  if (out.length === 0 && clean) {
    out.push(distillConciseText(clean, maxCharsPerItem));
  }
  return out.filter(Boolean);
}

const MATH_EXPR_RE =
  /(?:\b(?:sen|cos|tan)\s*(?:\([A-Za-z0-9θ°αβ\s+-]+\)|[θ°αβ]|\d+\s*°)\s*=\s*[-+0-9A-Za-z/()*^²³√.,\s]{1,32}|(?:[A-Za-zΔ][0-9₀₁₂]?(?:\([A-Za-z0-9,\s+-]+\))?|\d+\s*[A-Za-z²³]+(?:\s*[+-]\s*\d*\s*[A-Za-z²³]+)*|\d*\s*[A-Za-z]²(?:\s*[+-]\s*\d*\s*[A-Za-z])?(?:\s*[+-]\s*\d+)?|\([A-Za-z0-9\s+-]+\))\s*=\s*[-+0-9A-Za-zθ°αβπΔ/()*^²³√.,\s]{1,44})/g;

const NON_MATH_PROSE_WORD_RE =
  /\b(?:(?!sen\b|cos\b|tan\b|log\b|ln\b|lim\b|max\b|min\b|mod\b|cte\b|const\b)[A-Za-záéíóúñÁÉÍÓÚÑ]{3,}|(?:en|el|la|de|un|al|se|es|si|ya|no|ni|mi|tu|su|lo|le|me|te|va|da|ha|he|del|por|con|sin|mas|más|que|como|para|pero|sino)\b|[yoaeu]\s+[A-Za-záéíóúñÁÉÍÓÚÑ]{2,})/i;

function sanitizeExtractedFormula(rawCandidate: string): string {
  const eqParts = rawCandidate.split('=');
  if (eqParts.length < 2) return '';
  const lhs = eqParts[0].trim();
  let rhs = eqParts.slice(1).join('=').trim();

  // Reject if LHS contains Spanish prose words
  if (NON_MATH_PROSE_WORD_RE.test(lhs)) return '';

  // Truncate RHS right before the first Spanish prose word
  const proseMatch = rhs.match(NON_MATH_PROSE_WORD_RE);
  if (proseMatch && proseMatch.index !== undefined) {
    rhs = rhs.slice(0, proseMatch.index).trim();
  }

  // Strip trailing operators, dangling opening delimiters, or unbalanced punctuation
  rhs = rhs.replace(/[+\-*/^.,;:(\[{\s]+$/, '').trim();
  let openParens = (rhs.match(/\(/g) || []).length;
  let closeParens = (rhs.match(/\)/g) || []).length;
  while (closeParens > openParens && /\)$/.test(rhs)) {
    rhs = rhs.replace(/\)+$/, '').trim();
    openParens = (rhs.match(/\(/g) || []).length;
    closeParens = (rhs.match(/\)/g) || []).length;
  }
  while (openParens > closeParens) {
    const lastOpen = rhs.lastIndexOf('(');
    if (lastOpen < 0) break;
    rhs = rhs.slice(0, lastOpen).replace(/[+\-*/^.,;:(\[{\s]+$/, '').trim();
    openParens = (rhs.match(/\(/g) || []).length;
    closeParens = (rhs.match(/\)/g) || []).length;
  }
  if (!lhs || !rhs) return '';

  const formula = `${lhs} = ${rhs}`;
  // Require at least one digit, math operator, superscript, or explicit function/Greek symbol
  if (!/[0-9+\-*/^²³√()Δπθ°]/.test(formula)) return '';
  if (!isValidRenderableFormula(formula)) return '';
  return formula;
}

/** Extrae fórmulas o ecuaciones relevantes presentes en teoría o ejemplos sin fragmentos de prosa ni variables de plantilla. */
export function extractFormulasFromText(text: string, limit = 3): string[] {
  const clean = cleanSacrintText(text);
  if (!clean) return [];
  const found: string[] = [];
  for (const match of clean.matchAll(MATH_EXPR_RE)) {
    const candidate = sanitizeExtractedFormula(match[0]);
    if (candidate.length >= 5 && candidate.length <= 48 && !found.includes(candidate)) {
      found.push(candidate);
    }
    if (found.length >= limit) break;
  }
  return found;
}

function cleanStepLine(rawStep: string): string {
  return cleanSacrintText(rawStep)
    .replace(/^(?:paso\s*\d+\s*[:.\-–]|\d+[.)]\s*)/i, '')
    .trim();
}

function shortenStepHeading(head: string): string {
  const words = head.trim().split(/\s+/).slice(0, 4);
  while (
    words.length > 1 &&
    /^(?:el|la|los|las|un|una|de|del|al|a|en|con|por|para|y|o|su|sus)$/i.test(words[words.length - 1])
  ) {
    words.pop();
  }
  return words.join(' ');
}

function splitBalancedTopLevelEquations(body: string): string[] {
  const tokens = body.trim().split(/\s+/);
  const equations: string[] = [];
  let current: string[] = [];
  let parenDepth = 0;
  let seenEqInCurrent = false;

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    const nextTok = tokens[i + 1] ?? '';
    const isNewLhsStart =
      parenDepth === 0 &&
      seenEqInCurrent &&
      current.length >= 3 &&
      !/[=+\-*/(]$/.test(current[current.length - 1]) &&
      (/^[A-Za-z0-9(]/.test(tok) && (tok.includes('=') || nextTok === '=' || /^-\d+[A-Za-z]/.test(tok) || /^\d+\(/.test(tok)));

    if (isNewLhsStart && (tok.includes('=') || nextTok === '=' || tokens.slice(i, i + 4).some((t) => t === '=' || t.endsWith('=')))) {
      const candidate = current.join(' ').trim();
      if (candidate.includes('=')) {
        equations.push(candidate);
        current = [];
        seenEqInCurrent = false;
      }
    }

    current.push(tok);
    for (const ch of tok) {
      if (ch === '(') parenDepth += 1;
      else if (ch === ')' && parenDepth > 0) parenDepth -= 1;
    }
    if (tok.includes('=')) seenEqInCurrent = true;
  }

  const tail = current.join(' ').trim();
  if (tail) equations.push(tail);
  return equations;
}

function compactChalkboardMathStep(step: string, rawStep?: string): string {
  const words = step.split(/\s+/);
  if (words.length <= 18) return step;

  // 0. Si el paso crudo viene separado por líneas con múltiples ecuaciones, tomar cabecera + primera ecuación + resultado final
  if (rawStep && rawStep.includes('\n')) {
    const rawLines = rawStep
      .split(/\r?\n/)
      .map((ln) => sanitizePedagogicalMetaPhrases(cleanStepLine(ln)))
      .filter((ln) => ln.length > 0 && !isRubricOrBoilerplateLeak(ln));
    const eqLines = rawLines.filter((ln) => ln.includes('='));
    if (eqLines.length >= 4 && rawLines[0] && !rawLines[0].includes('=')) {
      const head = shortenStepHeading(rawLines[0].replace(/[:.]+$/, ''));
      const firstEq = eqLines[0].replace(/\.$/, '').trim();
      // Preferir el último resultado limpio antes de subtítulos largos secundarios ("Sustituye 'y'...") o el último '=' final
      const primaryBreakIdx = rawLines.findIndex(
        (ln, idx) => idx > 1 && !ln.includes('=') && /^[A-ZÁÉÍÓÚÑ]/.test(ln) && ln.endsWith(':')
      );
      const targetPool =
        primaryBreakIdx > 2
          ? rawLines.slice(1, primaryBreakIdx).filter((ln) => ln.includes('='))
          : eqLines;
      const rawLast = (targetPool[targetPool.length - 1] ?? eqLines[eqLines.length - 1]).trim();
      const shortLast = rawLast
        .replace(/\s*\([^)]{5,45}\)\.?$/i, '')
        .replace(/^(?:.+?=\s*)+(?=[^=]{1,22}$)/, (m) => {
          const lhsMatch = m.match(/^([a-zA-Z0-9₀₁₂()]+)\s*=/);
          return lhsMatch ? `${lhsMatch[1]} = ` : '';
        })
        .replace(/\.$/, '')
        .trim();
      if (firstEq && shortLast && firstEq !== shortLast) {
        return `${head}: ${firstEq} ⇒ ${shortLast}.`;
      }
    }
  }

  let out = step;

  // 1. Compactar sistemas de ecuaciones paralelos "Ecuación 1: ... Ecuación 2: ..."
  const sysMatch = out.match(
    /^(?:[^:=]{12,}:\s*)?(?:De\s+la\s+)?Ecuaci[oó]n\s*1\s*:\s*([^]+?)\s+(?:De\s+la\s+)?Ecuaci[oó]n\s*2\s*:\s*([^]+)$/i
  );
  if (sysMatch) {
    const cond = (part: string) => {
      const arrows = part.split(/\s*(?:=>|⇒|->)\s*/);
      return arrows.length > 1 ? arrows[arrows.length - 1].trim() : part.trim();
    };
    const e1 = cond(sysMatch[1]).replace(/\.$/, '');
    const e2 = cond(sysMatch[2]).replace(/\.$/, '');
    const isDespeje = /despej|=>|⇒|->/i.test(out);
    return isDespeje ? `Despeje: Ec. 1 ⇒ ${e1}; Ec. 2 ⇒ ${e2}.` : `Sistema: Ec. 1: ${e1}; Ec. 2: ${e2}.`;
  }

  // 2. Acortar preámbulo verbal largo (>26 chars sin '=') antes de ecuaciones después de ':' sin cortar artículos colgantes
  const colonIdx = out.indexOf(':');
  if (colonIdx >= 26) {
    const head = out.slice(0, colonIdx).trim();
    const tail = out.slice(colonIdx + 1).trim();
    if (!head.includes('=') && tail.includes('=')) {
      out = `${shortenStepHeading(head)}: ${tail}`;
    }
  }

  // 3. Condensar pasos explicativos con múltiples resultados intermedios ("Luego multiplicamos ... Como hablamos de personas ...: N.")
  const chainThenNote = out.match(
    /^([^:]{6,35}:)?\s*([^=≈]+(?:=|≈)[^A-ZÁÉÍÓÚÑ\n]{4,28})\s+Luego\s+[^:=]{8,55}:\s*([^≈=]+(?:=|≈)\s*[\d.,]+)\s+Como\s+[^:]{10,120}:\s*([^.]+)\.?$/i
  );
  if (chainThenNote) {
    const label = chainThenNote[1] ? `${chainThenNote[1].trim()} ` : '';
    const first = chainThenNote[2].trim();
    const finalAns = chainThenNote[4].trim();
    return `${label}${first} ⇒ ${finalAns}.`;
  }

  // 4. Si persiste una cadena larga de >= 4 igualdades en la misma línea, dividir respetando paréntesis balanceados
  const eqCount = (out.match(/=/g) || []).length;
  if (eqCount >= 4 && out.split(/\s+/).length > 18) {
    const firstColon = out.indexOf(':');
    const prefix = firstColon > 0 && firstColon < 36 ? `${out.slice(0, firstColon + 1)} ` : '';
    const body = firstColon > 0 && firstColon < 36 ? out.slice(firstColon + 1).trim() : out;
    const segments = splitBalancedTopLevelEquations(body);
    if (segments.length >= 3) {
      const firstEq = segments[0].replace(/\.$/, '');
      const lastEq = segments[segments.length - 1].replace(/\s*\([^)]{5,45}\)\.?$/, '').replace(/\.$/, '');
      const balancedParens = (s: string) => (s.match(/\(/g) || []).length === (s.match(/\)/g) || []).length;
      if (firstEq !== lastEq && balancedParens(firstEq) && balancedParens(lastEq)) {
        return `${prefix}${firstEq} ⇒ ${lastEq}.`;
      }
    }
  }

  return out;
}

/**
 * Sintetiza un paso de resolución asegurando que NUNCA se pierdan las ecuaciones,
 * operaciones o datos numéricos ni se corte una igualdad a mitad (`x +`, `30 - 8 =`, `x = 50 +`).
 */
export function distillStepPreservingMath(rawStep: string, maxChars = 185, maxWords?: number): string {
  const clean = sanitizePedagogicalMetaPhrases(cleanStepLine(rawStep));
  if (!clean || isRubricOrBoilerplateLeak(clean)) return '';
  const fitted = fitPedagogicalText(clean, {
    maxChars,
    maxWords,
    role: 'step',
  });
  if (maxWords !== undefined && maxWords <= 12) {
    return compactChalkboardMathStep(fitted, rawStep);
  }
  return fitted;
}

/**
 * Sintetiza un problema o ejercicio preservando íntegros los números, ecuaciones y la pregunta final.
 * Evita cualquier corte a mitad de frase o con conectores/operadores colgantes.
 */
export function distillProblemOrExerciseText(
  rawText: string | null | undefined,
  maxChars = 265,
  maxWords?: number
): string {
  const clean = sanitizePedagogicalMetaPhrases(
    cleanSacrintText(rawText)
      .replace(/^(?:planteamiento|problema|enunciado|situaci[oó]n)\s*[:.\-–]\s*/i, '')
      .trim()
  );
  if (!clean || isRubricOrBoilerplateLeak(clean)) return '';
  return fitPedagogicalText(clean, {
    maxChars,
    maxWords,
    role: 'problem',
  });
}

/**
 * Garantiza que un texto de lámina expositiva (`08`) no contenga ninguna secuencia de 6 palabras
 * consecutivas idéntica a la teoría del libro (`Nuevos conceptos`).
 */
export function preventSixGramTheoryOverlap(
  text: string,
  theorySources: Array<string | null | undefined>
): string {
  if (!text) return '';
  const toAsciiLower = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  const normalizeWord = (w: string) =>
    toAsciiLower(w).replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '');

  const theorySixGrams = new Set<string>();
  for (const src of theorySources) {
    const cleanSrc = cleanSacrintText(src);
    if (!cleanSrc) continue;
    const words = cleanSrc.split(/\s+/).map(normalizeWord).filter(Boolean);
    for (let i = 0; i <= words.length - 6; i++) {
      theorySixGrams.add(words.slice(i, i + 6).join(' '));
    }
    const subWords = toAsciiLower(cleanSrc).split(/[^a-z0-9]+/).filter(Boolean);
    for (let i = 0; i <= subWords.length - 6; i++) {
      theorySixGrams.add(subWords.slice(i, i + 6).join(' '));
    }
  }
  if (theorySixGrams.size === 0) return text;

  const TIER_1_SYNONYMS: Record<string, string> = {
    identificar: 'distinguir',
    comprender: 'asimilar',
    analizar: 'examinar',
    resolver: 'solucionar',
    calcular: 'estimar',
    determinar: 'precisar',
    aplicar: 'emplear',
    utilizar: 'usar',
    utilizando: 'usando',
    mediante: 'con ayuda de',
    permite: 'facilita',
    permiten: 'facilitan',
    representa: 'expresa',
    situacion: 'circunstancia',
    situaciones: 'circunstancias',
    informacion: 'referencia',
    comunidad: 'localidad',
    comunitario: 'local',
    comunitaria: 'local',
    escolar: 'del plantel',
    cotidiana: 'diaria',
    cotidianas: 'diarias',
    cotidiano: 'diario',
    diferentes: 'diversos',
    distintos: 'variados',
    relaciones: 'nexos',
    relacion: 'nexo',
    cantidades: 'magnitudes',
    cantidad: 'magnitud',
    valores: 'cifras',
    valor: 'cifra',
    resultado: 'desenlace',
    resultados: 'desenlaces',
    procedimiento: 'metodo',
    procedimientos: 'metodos',
    ambos: 'los dos',
    lados: 'extremos',
    miembros: 'costados',
    aislar: 'separar',
    despejar: 'aislar',
    termino: 'componente',
    terminos: 'componentes',
    graficar: 'trazar',
    papel: 'pliego',
    milimetrico: 'cuadriculado',
    puntos: 'pares',
    coordenadas: 'ubicaciones',
    presupuesto: 'capital',
    cumpliendo: 'atendiendo',
    estandares: 'criterios',
    rigor: 'exactitud',
    viabilidad: 'factibilidad',
    espacios: 'areas',
    recreativos: 'de esparcimiento',
    jovenes: 'estudiantes',
    poligono: 'sector',
    academico: 'educativo',
    entorno: 'contexto',
    disponible: 'libre',
    unitario: 'individual',
    costo: 'importe',
    costos: 'importes',
    gasto: 'desembolso',
    ingreso: 'entrada',
    ahorro: 'reserva',
    boletos: 'entradas',
    integrantes: 'participantes',
    equipo: 'grupo',
    evento: 'jornada',
    proyecto: 'iniciativa',
    saberes: 'conocimientos',
    previos: 'anteriores',
    diagnostico: 'inicial',
    cuestionario: 'guia',
    construye: 'arma',
    plantea: 'formula',
    calcula: 'estima',
    determina: 'precisa',
    resuelve: 'soluciona',
    explica: 'expone',
    analiza: 'examina',
    verifica: 'comprueba',
    identifica: 'distingue',
    asignar: 'distribuir',
    asignacion: 'distribucion',
    optimizar: 'mejorar',
    consolidar: 'afianzar',
    depurar: 'afinar',
    integrar: 'unir',
    visualizar: 'observar',
    considerando: 'tomando en cuenta',
    herramienta: 'recurso',
    actividad: 'dinamica',
    actividades: 'dinamicas',
    evidencia: 'producto',
    criterios: 'pautas',
    estrategia: 'ruta',
    cambio: 'variacion',
    crecimiento: 'incremento',
    analisis: 'estudio',
    afecta: 'impacta',
    afectan: 'impactan',
    bienestar: 'desarrollo',
    psicosocial: 'socioemocional',
    rendimiento: 'aprovechamiento',
    educativo: 'formativo',
    educativa: 'formativa',
    educativos: 'formativos',
    educativas: 'formativas',
    juveniles: 'estudiantiles',
    juvenil: 'estudiantil',
    reporte: 'informe',
    tecnico: 'metodológico',
    tecnica: 'metodológica',
    companero: 'par',
    companeros: 'pares',
    companera: 'colega',
    companeras: 'colegas',
    contextualizacion: 'ambientación',
    estandar: 'canónica',
    cartesiano: 'coordenado',
    cartesiana: 'coordenada',
    grafica: 'visualización',
    tabulacion: 'tabla',
    expresion: 'fórmula',
    cuya: 'donde su',
    cuyo: 'donde su',
    suma: 'adición',
    total: 'global',
    propiedad: 'característica',
    obtenida: 'hallada',
    obtenido: 'hallado',
    constante: 'invariable',
    constantes: 'invariables',
    ruta: 'guía',
    trabajo: 'labor',
    bitacora: 'libreta',
    personal: 'propia',
    reflexion: 'análisis',
    metacognitiva: 'crítica',
    decisiones: 'elecciones',
    informadas: 'fundadas',
    diseno: 'trazo',
    resolucion: 'solución',
    comunitarios: 'locales',
    coevaluacion: 'revisión mutua',
    registro: 'control',
    cumple: 'aplica',
    cumplen: 'aplican',
    juego: 'estuche',
    compas: 'trazador',
    equipar: 'habilitar',
    centro: 'núcleo',
    problematica: 'dificultad',
  };

  const TIER_2_SYNONYMS: Record<string, string> = {
    problema: 'caso',
    problemas: 'casos',
    ecuacion: 'igualdad',
    ecuaciones: 'igualdades',
    igualdad: 'equivalencia',
    variable: 'incognita',
    variables: 'incognitas',
    incognita: 'desconocida',
    incognitas: 'desconocidas',
    modelo: 'esquema',
    modelos: 'esquemas',
    elementos: 'partes',
    elemento: 'parte',
    tasa: 'razon',
    poblacion: 'demografia',
    algebraico: 'simbolico',
    algebraica: 'simbolica',
    sobre: 'acerca de',
    para: 'a fin de',
    formula: 'regla',
    formulas: 'reglas',
    general: 'completa',
    coeficiente: 'factor',
    coeficientes: 'factores',
    miembro: 'lado',
    lado: 'costado',
    compuesto: 'capitalizable',
    compuestos: 'capitalizables',
    interes: 'rédito',
    intereses: 'réditos',
    simple: 'lineal',
    simples: 'lineales',
    calculo: 'cómputo',
    congruencia: 'correspondencia exacta',
    triangulo: 'figura de tres lados',
    triangulos: 'figuras de tres lados',
    teorema: 'propiedad',
    recta: 'línea',
    rectas: 'líneas',
    interseccion: 'cruce',
    eje: 'trazo',
    forma: 'estructura',
    modela: 'describe',
    area: 'superficie',
    terreno: 'predio',
  };

  const TIER_3_SYNONYMS: Record<string, string> = {
    en: 'dentro de',
    es: 'equivale a',
    del: 'de dicho',
  };

  let tokens = text.split(/\s+/);
  const replacedWords = new Set<string>();
  for (let pass = 0; pass < 24; pass++) {
    let changed = false;
    const normTokens = tokens.map(normalizeWord);

    const tryReplaceWindow = (candidateIndices: number[]): boolean => {
      for (const dictionary of [TIER_1_SYNONYMS, TIER_2_SYNONYMS, TIER_3_SYNONYMS]) {
        for (const k of candidateIndices) {
          const nw = normTokens[k];
          if (nw && dictionary[nw] && !replacedWords.has(`${k}:${dictionary[nw]}`)) {
            const orig = tokens[k];
            const punctMatch = orig.match(/([,.;:?!)]+)$/);
            const suffix = punctMatch ? punctMatch[1] : '';
            const rep = dictionary[nw];
            const repWords = rep.split(/\s+/);
            const firstRepNorm = normalizeWord(repWords[0]);
            const lastRepNorm = normalizeWord(repWords[repWords.length - 1]);
            if (nw === 'grafica' && k > 0 && normTokens[k - 1] === 'representacion') {
              continue;
            }
            if (
              (k > 0 && normTokens[k - 1] === firstRepNorm) ||
              (k + 1 < normTokens.length && normTokens[k + 1] === lastRepNorm)
            ) {
              continue;
            }
            const firstFormatted = /^[A-ZÁÉÍÓÚÑ]/.test(orig)
              ? repWords[0].charAt(0).toUpperCase() + repWords[0].slice(1)
              : repWords[0];
            repWords[0] = firstFormatted;
            repWords[repWords.length - 1] = repWords[repWords.length - 1] + suffix;
            tokens.splice(k, 1, ...repWords);
            replacedWords.add(`${k}:${repWords[0].toLowerCase()}`);
            return true;
          }
        }
      }
      return false;
    };

    for (let i = 0; i <= tokens.length - 6; i++) {
      const windowNorm = normTokens.slice(i, i + 6).filter(Boolean);
      if (windowNorm.length < 6) continue;
      if (theorySixGrams.has(windowNorm.join(' '))) {
        if (tryReplaceWindow([i + 2, i + 3, i + 1, i + 4, i, i + 5])) {
          changed = true;
          break;
        }
      }
    }

    if (!changed) {
      const subEntries: Array<{ sub: string; tokenIdx: number }> = [];
      tokens.forEach((tok, idx) => {
        const subs = toAsciiLower(tok).split(/[^a-z0-9]+/).filter(Boolean);
        for (const sub of subs) subEntries.push({ sub, tokenIdx: idx });
      });
      for (let i = 0; i <= subEntries.length - 6; i++) {
        const key = subEntries
          .slice(i, i + 6)
          .map((e) => e.sub)
          .join(' ');
        if (theorySixGrams.has(key)) {
          const rawIndices = [
            subEntries[i + 2].tokenIdx,
            subEntries[i + 3].tokenIdx,
            subEntries[i + 1].tokenIdx,
            subEntries[i + 4].tokenIdx,
            subEntries[i].tokenIdx,
            subEntries[i + 5].tokenIdx,
          ];
          const uniqueIndices = Array.from(new Set(rawIndices));
          if (tryReplaceWindow(uniqueIndices)) {
            changed = true;
            break;
          }
        }
      }
    }

    if (!changed) break;
    tokens = tokens.join(' ').split(/\s+/);
  }

  const out = tokens.join(' ').trim();
  return hasDanglingEnding(out) ? repairDanglingEnding(out, /[.?!]$/.test(out)) : out;
}

export interface DistillOptions {
  /**
   * Cuando es `false` (ej. modo `lesson-guide`), extrae únicamente desde `session`
   * sin caer a campos de `mission`, evitando duplicar el mismo contenido entre sesiones.
   * Por defecto `true` (para mazos `full`/`classroom` e infografías misionales).
   */
  allowMissionFallback?: boolean;
  /** Fuentes teóricas adicionales del bloque/libro para prevenir traslape de 6-gramas en `lesson-guide`. */
  extraTheorySources?: Array<string | null | undefined>;
}

/**
 * Extrae definiciones breves, fórmulas clave y 2–3 reglas accionables desde `session.contenido` o `conceptZero`.
 */
export function extractConceptHighlights(
  mission: MissionSection,
  session?: SessionPlan,
  options: DistillOptions = {}
): DistilledConceptHighlights {
  const allowMission = options.allowMissionFallback ?? true;
  const rawTheory = session?.contenido || (allowMission ? mission.conceptZero?.coreExplanation : '') || '';
  const blocks = parseContenidoToBloques(rawTheory);
  const formulas: string[] = [];
  const candidateTexts: string[] = [];

  for (const block of blocks) {
    const cleaned = cleanSacrintText(block.texto);
    if (!cleaned || isRubricOrBoilerplateLeak(cleaned)) continue;
    if (block.tipo === 'formula') {
      if (isValidRenderableFormula(cleaned) && !formulas.includes(cleaned)) formulas.push(cleaned);
      continue;
    }
    if (block.tipo === 'definicion' && candidateTexts.length === 0) {
      candidateTexts.unshift(cleaned);
    } else {
      candidateTexts.push(cleaned);
    }
    for (const eq of extractFormulasFromText(cleaned, 3)) {
      if (isValidRenderableFormula(eq) && !formulas.includes(eq)) formulas.push(eq);
    }
  }

  const rawExampleSource =
    session?.ejemploResuelto || (allowMission ? mission.conceptZero?.solvedExample?.problemStatement : '') || '';
  for (const eq of extractFormulasFromText(rawExampleSource, 2)) {
    if (isValidRenderableFormula(eq) && !formulas.includes(eq)) formulas.push(eq);
  }

  const analogyClean = allowMission ? cleanSacrintText(mission.conceptZero?.physicalAnalogy) : '';
  const definitionSource =
    candidateTexts[0] ||
    (allowMission ? cleanSacrintText(mission.conceptZero?.coreExplanation) : '') ||
    cleanSacrintText(session?.objetivo) ||
    analogyClean;

  const definitionSentences = extractBulletSentences(definitionSource, 3, 185);
  const conceptualDefSentence =
    definitionSentences.find(
      (s) =>
        !/^(?:imagina|piensa|observa|recuerda|en\s+esta\s+sesi[oó]n|hoy\s+vas)/i.test(s) &&
        s.length >= 24
    ) || definitionSentences[0];
  const definition = conceptualDefSentence || distillConciseText(definitionSource, 200, 34);

  const rulePoolText = [
    ...candidateTexts,
    allowMission ? cleanSacrintText(mission.conceptZero?.coreExplanation) : '',
    analogyClean,
    !allowMission ? cleanSacrintText(session?.saberesPrevios || session?.motivacion) : '',
  ]
    .filter(Boolean)
    .join(' ');
  const allCandidateRules = extractBulletSentences(rulePoolText, 6, 155).filter(
    (r) =>
      r !== definition &&
      r.length >= 25 &&
      !/^(?:imagina\s+que|sup[oó]n\s+que|recuerda\s+cuando)\b/i.test(r)
  );
  const keyRules = allCandidateRules.slice(0, 3);

  if (keyRules.length === 0 && analogyClean) {
    const analogyPoint = distillConciseText(analogyClean, 145, 25);
    if (analogyPoint && analogyPoint !== definition) keyRules.push(analogyPoint);
  }
  if (!allowMission && keyRules.length === 0) {
    keyRules.push(
      `Por completar en el libro: conceptos clave${session?.sessionNumber ? ` de la sesión ${session.sessionNumber}` : ''}.`
    );
  }

  const fallbackDefinition = allowMission
    ? distillConciseText(mission.sessionFocus, 180, 30)
    : distillConciseText(session?.objetivo, 180, 30) ||
      `Por completar en el libro: fundamento conceptual${session?.sessionNumber ? ` de la sesión ${session.sessionNumber}` : ''}.`;

  return {
    definition: definition || fallbackDefinition,
    formulas: formulas.filter(isValidRenderableFormula).slice(0, 3),
    keyRules: keyRules.slice(0, 3),
  };
}

const CONCLUSION_HEADING_PREFIX_RE =
  /^(?:(?:verificaci[oó]n|comprobaci[oó]n|interpretaci[oó]n|conclusi[oó]n|validaci[oó]n|cierre)[^.?!:=0-9]{0,55}[.:]\s*)/i;

function extractExampleConclusion(
  rawExample: string,
  steps: string[],
  rawLastStep?: string,
  maxChars = 155,
  maxWords?: number
): string {
  // 1. Si existe un 4to paso crudo ("Paso 4: Verificación e interpretación..."), extraer su conclusión real
  if (rawLastStep) {
    const cleanedLast = sanitizePedagogicalMetaPhrases(cleanStepLine(rawLastStep).replace(CONCLUSION_HEADING_PREFIX_RE, '').trim());
    if (cleanedLast.length >= 18) {
      const distilled = fitPedagogicalText(cleanedLast, { maxChars, maxWords, role: 'conclusion' });
      if (distilled.length >= 15) return distilled;
    }
  }

  const clean = sanitizePedagogicalMetaPhrases(cleanSacrintText(rawExample));
  // 2. Buscar etiqueta explícita con dos puntos obligatorios ("Conclusión:", "Resultado final:", "Respuesta:")
  const explicitMatch = clean.match(
    /(?:conclusi[oó]n(?:\s+final|\s+pedag[oó]gica)?|interpretaci[oó]n(?:\s+del\s+resultado)?|resultado\s+final|respuesta\s+final)\s*:\s*([^.?!]+(?:\.\d+[^.?!]*)?[.?!]?)/i
  );
  if (explicitMatch && explicitMatch[1]) {
    const candidate = fitPedagogicalText(explicitMatch[1].replace(CONCLUSION_HEADING_PREFIX_RE, ''), {
      maxChars,
      maxWords,
      role: 'conclusion',
    });
    if (candidate.length >= 16) return candidate;
  }

  // 3. Buscar oración con "Por lo tanto," o "En conclusión,"
  const connectorMatch = clean.match(
    /\b(?:por\s+lo\s+tanto|en\s+conclusi[oó]n)\s*,\s*([^.?!]+(?:\.\d+[^.?!]*)?[.?!]?)/i
  );
  if (connectorMatch && connectorMatch[1]) {
    const candidate = fitPedagogicalText(connectorMatch[1], {
      maxChars,
      maxWords,
      role: 'conclusion',
    });
    if (candidate.length >= 16) return candidate;
  }

  if (steps.length >= 2) {
    const lastStep = steps[steps.length - 1]
      .replace(CONCLUSION_HEADING_PREFIX_RE, '')
      .trim();
    if (lastStep && lastStep.length >= 16) {
      return fitPedagogicalText(lastStep, { maxChars, maxWords, role: 'conclusion' });
    }
  }
  return '';
}

/**
 * Extrae el ejemplo resuelto con pasos reales evitando fugas de rúbrica y mensajes vacíos.
 */
export function extractWorkedExample(
  mission: MissionSection,
  session?: SessionPlan,
  options: DistillOptions = {}
): DistilledExample {
  const allowMission = options.allowMissionFallback ?? true;
  const solved = allowMission ? mission.conceptZero?.solvedExample : undefined;
  const rawSessionExample = session?.ejemploResuelto?.trim();
  const stmtBudget = allowMission ? 245 : 78;
  const stmtWords = allowMission ? undefined : 12;
  const stepBudget = allowMission ? 180 : 62;
  const stepWords = allowMission ? undefined : 9;
  const interpBudget = allowMission ? 155 : 60;
  const interpWords = allowMission ? undefined : 9;

  if (rawSessionExample && !isRubricOrBoilerplateLeak(rawSessionExample)) {
    const preservedSessionExample = cleanSacrintTextPreservingLines(rawSessionExample);
    const cleanedSessionExample = cleanSacrintText(rawSessionExample);
    const parsed = parseEjemploResuelto(preservedSessionExample);
    const statement = distillProblemOrExerciseText(parsed.enunciado, stmtBudget, stmtWords);
    const cleanedRawSteps = parsed.pasos
      .map(cleanStepLine)
      .filter((step) => step.length >= 8 && !isRubricOrBoilerplateLeak(step));
    const steps = cleanedRawSteps
      .map((step) => distillStepPreservingMath(step, stepBudget, stepWords))
      .filter(Boolean)
      .slice(0, allowMission ? 4 : 3);

    if (steps.length > 0) {
      const fourthRawStep = cleanedRawSteps.length >= 4 ? cleanedRawSteps[cleanedRawSteps.length - 1] : undefined;
      const derivedConclusion = extractExampleConclusion(rawSessionExample, steps, fourthRawStep, interpBudget, interpWords);
      return {
        problemStatement:
          statement ||
          (allowMission ? distillProblemOrExerciseText(solved?.problemStatement, stmtBudget, stmtWords) : '') ||
          distillConciseText(session?.objetivo, 90, 14) ||
          'Por completar en el libro: planteamiento del ejemplo.',
        steps,
        interpretation:
          derivedConclusion ||
          (allowMission ? distillConciseText(solved?.interpretation, interpBudget, interpWords ?? 26) : '') ||
          'Verifica que el resultado obtenido responda al planteamiento.',
      };
    }

    if (!allowMission && cleanedSessionExample) {
      const bulletSteps = extractBulletSentences(cleanedSessionExample, 3, stepBudget)
        .map((bullet) =>
          fitPedagogicalText(bullet, {
            maxChars: stepBudget,
            maxWords: stepWords,
            role: 'step',
          })
        )
        .filter(Boolean);
      const effectiveSteps =
        bulletSteps.length >= 2
          ? bulletSteps
          : [
              distillStepPreservingMath(cleanedSessionExample, stepBudget, stepWords),
              'Desarrolla el procedimiento o criterio conforme a la consigna.',
              'Comunica la conclusión con respaldo y coherencia.',
            ].filter(Boolean);
      return {
        problemStatement:
          statement ||
          distillProblemOrExerciseText(cleanedSessionExample, stmtBudget, stmtWords) ||
          distillConciseText(session?.objetivo, 72, 11),
        steps: effectiveSteps,
        interpretation:
          extractExampleConclusion(rawSessionExample, effectiveSteps, undefined, interpBudget, interpWords) ||
          'Verifica que el resultado responda con coherencia al planteamiento.',
      };
    }
  }

  if (!allowMission) {
    const sessionLabel = session?.sessionNumber ? ` de la sesión ${session.sessionNumber}` : '';
    return {
      problemStatement: `Por completar en el libro: ejemplo guiado${sessionLabel}.`,
      steps: [
        `Por completar en el libro: identifica la información relevante${sessionLabel}.`,
        'Aplica el procedimiento o criterio del tema trabajado en la sesión.',
        'Revisa la consigna y comunica la conclusión con evidencia.',
      ],
      interpretation: `Por completar en el libro: interpretación y cierre del ejemplo${sessionLabel}.`,
    };
  }

  const rawMissionSteps = (solved?.solutionSteps ?? [])
    .map(cleanStepLine)
    .filter((s) => s.length >= 6 && !isRubricOrBoilerplateLeak(s));
  const missionSteps = rawMissionSteps
    .map((s) => distillStepPreservingMath(s, 185))
    .filter(Boolean)
    .slice(0, 4);

  const demoRaw = cleanSacrintText(mission.iDoSection?.stepByStepDemo);
  const demoIsClean = Boolean(demoRaw) && !isRubricOrBoilerplateLeak(demoRaw);

  let derivedSteps = missionSteps;
  if (derivedSteps.length === 0 && demoIsClean) {
    derivedSteps = extractBulletSentences(demoRaw, 4, 175);
  }
  if (derivedSteps.length === 0 && mission.troubleshooting?.length) {
    derivedSteps = mission.troubleshooting
      .map((t) => cleanSacrintText(t.solution || t.solutionSteps?.[0] || t.rootCause || t.symptom))
      .filter((s) => s.length >= 8 && !isRubricOrBoilerplateLeak(s))
      .map((s) => distillStepPreservingMath(s, 175))
      .slice(0, 4);
  }
  if (derivedSteps.length === 0) {
    const fallbackTopic = extractCleanTopicTitle(mission.sessionTopic || mission.title);
    derivedSteps = [
      `Identifica la información relevante en el planteamiento sobre ${fallbackTopic}.`,
      'Aplica el procedimiento o criterio del tema correspondiente a la situación.',
      'Desarrolla cada fase en orden revisando la coherencia de los argumentos y evidencias.',
      'Comunica la conclusión con evidencia y comprueba que responda a la situación inicial.',
    ];
  }

  const cleanStatement =
    distillProblemOrExerciseText(solved?.problemStatement, 260) ||
    (demoIsClean ? distillProblemOrExerciseText(demoRaw, 240) : '') ||
    distillConciseText(mission.sessionFocus, 200, 34);

  const fourthMissionStep =
    rawMissionSteps.length >= 4 ? rawMissionSteps[rawMissionSteps.length - 1] : undefined;

  return {
    problemStatement: cleanStatement,
    steps: derivedSteps,
    interpretation:
      distillConciseText(solved?.interpretation, 165, 28) ||
      extractExampleConclusion(demoRaw, derivedSteps, fourthMissionStep) ||
      'Comunica la conclusión con evidencia y contrástala con el contexto real de la situación.',
  };
}

/**
 * Sintetiza el enunciado de un ejercicio preservando los datos numéricos, ecuaciones y la pregunta/consigna.
 */
function distillExerciseStatement(rawEnunciado: string | null | undefined, maxChars = 220, maxWords?: number): string {
  const clean = sanitizePedagogicalMetaPhrases(
    cleanSacrintText(rawEnunciado)
      .replace(/^(?:planteamiento|problema|enunciado|situaci[oó]n)\s*[:.\-–]\s*/i, '')
      .trim()
  );
  if (!clean || isRubricOrBoilerplateLeak(clean)) return '';
  return fitPedagogicalText(clean, {
    maxChars,
    maxWords,
    role: 'activity',
  });
}

/**
 * Extrae las actividades prácticas del libro (enunciado + pista pedagógica) sin exponer `solucion`.
 */
export function extractPracticeActivities(
  mission: MissionSection,
  session?: SessionPlan,
  options: DistillOptions = {}
): DistilledPracticeActivity[] {
  const allowMission = options.allowMissionFallback ?? true;
  const stmtMax = allowMission ? 225 : 84;
  const stmtWords = allowMission ? undefined : 13;
  const hintMax = allowMission ? 135 : 52;
  const hintWords = allowMission ? undefined : 8;
  const maxItems = allowMission ? 3 : 2;
  const fromSession = (session?.practica ?? [])
    .filter((item) => cleanSacrintText(item.enunciado).length >= 10 && !isRubricOrBoilerplateLeak(item.enunciado))
    .slice(0, maxItems)
    .map((item, idx) => ({
      label: `Actividad ${idx + 1}`,
      statement: distillExerciseStatement(item.enunciado, stmtMax, stmtWords),
      hint:
        fitPedagogicalText(sanitizePedagogicalMetaPhrases(cleanSacrintText(item.pista)), {
          maxChars: hintMax,
          maxWords: hintWords,
          role: 'hint',
        }) || 'Apóyate en el ejemplo trabajado en clase.',
    }));

  if (fromSession.length > 0) return fromSession;

  if (!allowMission) {
    const sessionLabel = session?.sessionNumber ? ` de la sesión ${session.sessionNumber}` : '';
    return [
      {
        label: 'Actividad 1',
        statement: `Por completar en el libro: actividad práctica${sessionLabel}.`,
        hint: 'Revisa la consigna en tu libro de trabajo.',
      },
    ];
  }

  const guided = cleanSacrintText(mission.weDoSection?.guidedPractice);
  if (guided && !isRubricOrBoilerplateLeak(guided)) {
    const points = extractBulletSentences(guided, 3, 185);
    return points.map((pt, idx) => ({
      label: `Actividad ${idx + 1}`,
      statement: pt,
      hint:
        distillConciseText(mission.conceptZero?.contrastTable?.[0]?.reasoning, 140, 24) ||
        'Contrasta el procedimiento con el ejemplo modelado antes de concluir.',
    }));
  }

  const autonomous = cleanSacrintText(mission.youDoSection?.autonomousChallenge);
  return [
    {
      label: 'Actividad 1',
      statement:
        distillConciseText(autonomous, 195, 34) ||
        'Realiza en tu cuaderno una actividad de aplicación del tema vinculada con tu entorno.',
      hint: 'Identifica la información relevante de la consigna antes de desarrollar el procedimiento.',
    },
  ];
}

/**
 * Extrae aplicación en la vida real, avance de producto e ítems de cierre/autoevaluación.
 */
export function extractApplicationAndExit(
  mission: MissionSection,
  session?: SessionPlan,
  options: DistillOptions = {}
): { application: string; artifactStep: string; exitChecks: string[] } {
  const allowMission = options.allowMissionFallback ?? true;
  const sessionLabel = session?.sessionNumber ? ` de la sesión ${session.sessionNumber}` : '';
  const appMax = allowMission ? 200 : 68;
  const appWords = allowMission ? undefined : 10;
  const artMax = allowMission ? 165 : 58;
  const artWords = allowMission ? undefined : 9;
  const checkMax = allowMission ? 125 : 52;
  const checkWords = allowMission ? undefined : 8;

  const rawApp = allowMission
    ? session?.aplicacion ||
      mission.realLifeConnection?.householdApplication ||
      mission.realLifeConnection?.communityImpact ||
      mission.realLifeConnection?.context ||
      mission.sessionFocus
    : session?.aplicacion;
  const application =
    fitPedagogicalText(sanitizePedagogicalMetaPhrases(cleanSacrintText(rawApp)), {
      maxChars: appMax,
      maxWords: appWords,
      role: 'application',
    }) ||
    (allowMission
      ? 'Vincula el aprendizaje con situaciones reales y decisiones cotidianas de tu comunidad.'
      : `Por completar en el libro: aplicación situada${sessionLabel}.`);

  const rawArtifact = allowMission
    ? session?.productoIntegrador ||
      mission.youDoSection?.autonomousChallenge ||
      mission.formativeCheckpoint?.question
    : session?.productoIntegrador;
  const artifactStep =
    fitPedagogicalText(sanitizePedagogicalMetaPhrases(cleanSacrintText(rawArtifact)), {
      maxChars: artMax,
      maxWords: artWords,
      role: 'application',
    }) ||
    (allowMission
      ? 'Integra el procedimiento desarrollado y su conclusión con evidencia en la bitácora del bloque.'
      : `Por completar en el libro: avance del producto${sessionLabel}.`);

  const checksFromSession = (session?.autoevaluacion ?? [])
    .map((item) => sanitizePedagogicalMetaPhrases(cleanSacrintText(item)))
    .filter((item) => item.length >= 8 && !isRubricOrBoilerplateLeak(item))
    .map((item) => distillConciseText(item, checkMax, checkWords ?? 18));

  const checksFromMission = allowMission
    ? [
        ...(mission.formativeCheckpoint?.criteriaChecklist ?? []),
        ...(mission.formativeCheckpoint?.reflectionPrompts ?? []),
      ]
        .map((item) => sanitizePedagogicalMetaPhrases(cleanSacrintText(item)))
        .filter((item) => item.length >= 8 && !isRubricOrBoilerplateLeak(item))
        .map((item) => distillConciseText(item, checkMax, checkWords ?? 18))
    : [];

  const exitChecks = (checksFromSession.length > 0 ? checksFromSession : checksFromMission).slice(
    0,
    allowMission ? 3 : 2
  );
  if (exitChecks.length === 0) {
    exitChecks.push(
      'Explico el concepto central y cuándo aplicarlo.',
      'Identifico datos clave de la consigna y valido la conclusión.'
    );
  }

  return { application, artifactStep, exitChecks };
}

function extractQuestionFromSession(session?: SessionPlan): string {
  const candidates = [session?.motivacion, session?.saberesPrevios, session?.objetivo]
    .map(cleanSacrintText)
    .filter(Boolean);
  for (const text of candidates) {
    const match = text.match(/¿[^?]{8,140}\?/);
    if (match) return distillConciseText(match[0], 96, 15);
  }
  return '';
}

/** Construye el paquete destilado completo de una clase/sesión específica dentro de una misión. */
export function distillLessonBundle(
  mission: MissionSection,
  session?: SessionPlan,
  options: DistillOptions = {}
): DistilledLessonBundle {
  const allowMission = options.allowMissionFallback ?? true;
  const sessionNumber = session?.sessionNumber ?? null;
  const fallbackSessionTitle = sessionNumber ? `Sesión ${sessionNumber}` : extractCleanTopicTitle(mission.title);
  const topicSource =
    session?.objetivo ||
    (allowMission ? mission.sessionTopic || mission.title : session?.contenido || fallbackSessionTitle);
  const topicTitle = session
    ? resolveChalkboardTopicTitle({
        conceptosClave: session.contenido,
        sessionObjective: session.objetivo,
        missionSessionTopic: allowMission ? mission.sessionTopic : null,
        missionFocus: allowMission ? mission.sessionFocus : null,
        missionTitle: allowMission ? mission.title : fallbackSessionTitle,
        maxChars: allowMission ? 68 : 52,
      })
    : extractCleanTopicTitle(
        mission.sessionTopic || mission.title,
        allowMission ? mission.sessionTopic || mission.title : fallbackSessionTitle
      );

  const rawObjectiveSource =
    !allowMission && session?.objetivo
      ? cleanSacrintText(session.objetivo)
          .replace(/^(?:en\s+esta\s+sesi[oó]n\s+|hoy\s+)?(?:vas\s+a\s+|lograr[aá]s\s+)/i, '')
          .trim()
      : session?.objetivo || (allowMission ? topicSource : '');
  const formattedObjSource =
    rawObjectiveSource && /^[a-z]/.test(rawObjectiveSource)
      ? rawObjectiveSource.charAt(0).toUpperCase() + rawObjectiveSource.slice(1)
      : rawObjectiveSource;
  const objBudget = allowMission ? 165 : 50;
  const objWords = allowMission ? 28 : 8;
  const objectiveRaw =
    distillConciseText(formattedObjSource, objBudget, objWords) ||
    (allowMission
      ? extractCleanTopicTitle(mission.title)
      : `Por completar en el libro: propósito de la sesión ${sessionNumber ?? 1}.`);

  const actBudget = allowMission ? 185 : 54;
  const actWords = allowMission ? 32 : 8;
  const activationRaw =
    session?.saberesPrevios || session?.motivacion || (allowMission ? mission.phenomenonHook?.story : '');
  const activationBase =
    distillConciseText(activationRaw, actBudget, actWords) ||
    (allowMission
      ? distillConciseText(mission.sessionFocus, 175, 30)
      : `Por completar en el libro: activación de la sesión ${sessionNumber ?? 1}.`);

  const sessionQuestion = extractQuestionFromSession(session);
  const rawQuestionBase =
    sessionQuestion ||
    (allowMission ? distillConciseText(mission.phenomenonHook?.detonatingQuestion, 150, 24) : '') ||
    `¿Cómo aplicar ${topicTitle.toLowerCase()} en esta sesión?`;
  const questionBase = allowMission
    ? rawQuestionBase
    : distillConciseText(rawQuestionBase, 66, 10) || rawQuestionBase;

  const concepts = extractConceptHighlights(mission, session, options);
  const example = extractWorkedExample(mission, session, options);
  const activities = extractPracticeActivities(mission, session, options);
  const { application, artifactStep, exitChecks } = extractApplicationAndExit(mission, session, options);

  if (!allowMission) {
    const theorySources = [
      session?.contenido,
      mission.conceptZero?.coreExplanation,
      mission.conceptZero?.narrativeExplanation,
      ...(options.extraTheorySources ?? []),
    ];
    const cleanField = (text: string) =>
      preventSixGramTheoryOverlap(sanitizePedagogicalMetaPhrases(text), theorySources);
    return {
      sessionNumber,
      topicTitle: cleanField(topicTitle),
      objective: cleanField(objectiveRaw),
      activation: cleanField(activationBase),
      question: cleanField(questionBase),
      concepts: {
        definition: cleanField(concepts.definition),
        formulas: concepts.formulas,
        keyRules: concepts.keyRules.map(cleanField),
      },
      example: {
        problemStatement: cleanField(example.problemStatement),
        steps: example.steps.map(cleanField),
        interpretation: cleanField(example.interpretation),
      },
      activities: activities.map((act) => ({
        ...act,
        statement: cleanField(act.statement),
        hint: cleanField(act.hint),
      })),
      application: cleanField(application),
      artifactStep: cleanField(artifactStep),
      exitChecks: exitChecks.map(cleanField),
    };
  }

  return {
    sessionNumber,
    topicTitle: sanitizePedagogicalMetaPhrases(topicTitle),
    objective: sanitizePedagogicalMetaPhrases(objectiveRaw),
    activation: sanitizePedagogicalMetaPhrases(activationBase),
    question: sanitizePedagogicalMetaPhrases(questionBase),
    concepts,
    example,
    activities,
    application: sanitizePedagogicalMetaPhrases(application),
    artifactStep: sanitizePedagogicalMetaPhrases(artifactStep),
    exitChecks: exitChecks.map((c) => sanitizePedagogicalMetaPhrases(c)),
  };
}
