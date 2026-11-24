/**
 * content-distiller.ts — Destilador Pedagógico SSoT para SACRINT (08_Presentaciones y 09_Infografias)
 * Módulos de normalización, 6-gramas y guardias de objetivo/actividad residen en `./text/*`.
 */

import type { MissionSection, SessionPlan } from '@/types/work-textbook';
import { parseContenidoToBloques, parseEjemploResuelto } from '@/lib/editorial/student-content-model';
import { fitPedagogicalText } from '@/lib/editorial/fitter/text-compactor';
import {
  hasDanglingEnding,
  isPublishablePedagogicalText,
  isTruncatedAgainstSource,
} from '@/lib/editorial/fitter/dangling-guards';
import { splitSpanishSentences } from '@/lib/editorial/fitter/sentence-splitter';
import { isValidRenderableFormula } from '@/lib/editorial/text-normalization';
import { resolveChalkboardTopicTitle } from '@/lib/editorial/topic-title-resolver';
import type {
  DistilledConceptHighlights,
  DistilledExample,
  DistilledLessonBundle,
  DistilledPracticeActivity,
  DistillOptions,
} from './types';
import {
  cleanSacrintText,
  cleanSacrintTextPreservingLines,
  GENERIC_CONCLUSION_RE,
  isRubricOrBoilerplateLeak,
  NUMERIC_ONLY_STEP_RE,
  ORPHAN_LIST_END_RE,
  repairSpanishSurfaceGrammar,
  sanitizePedagogicalMetaPhrases,
  stripTemplateLabels,
  TEMPLATE_PHRASE_RE,
} from './text/grammar-normalization';
import {
  enforceSixGramOverlap,
  paraphraseSixGramOverlap,
  preventSixGramTheoryOverlap,
  sixGramOverlapRatio,
} from './text/six-gram-overlap';
import {
  cleanMissionTopicLine,
  distillConciseText,
  extractBulletSentences,
  extractChalkboardTopicTitle,
  extractCleanTopicTitle,
  hasValidTaskInStatement,
  isSpanishInfinitiveVerb,
  normalizeLearningObjective,
  pickCompleteSentences,
  SECOND_PERSON_TO_INFINITIVE_MAP,
  validatePracticeActivity,
} from './text/objective-and-activity-guards';

export type {
  DistilledConceptHighlights,
  DistilledExample,
  DistilledLessonBundle,
  DistilledPracticeActivity,
  DistillOptions,
  NormalizeObjectiveContext,
  PracticeActivityValidationResult,
} from './types';

export {
  cleanSacrintText,
  GENERIC_CONCLUSION_RE,
  isRubricOrBoilerplateLeak,
  NUMERIC_ONLY_STEP_RE,
  ORPHAN_LIST_END_RE,
  repairSpanishSurfaceGrammar,
  sanitizePedagogicalMetaPhrases,
  stripTemplateLabels,
  TEMPLATE_PHRASE_RE,
  enforceSixGramOverlap,
  paraphraseSixGramOverlap,
  preventSixGramTheoryOverlap,
  sixGramOverlapRatio,
  cleanMissionTopicLine,
  distillConciseText,
  extractBulletSentences,
  extractChalkboardTopicTitle,
  extractCleanTopicTitle,
  isSpanishInfinitiveVerb,
  normalizeLearningObjective,
  SECOND_PERSON_TO_INFINITIVE_MAP,
  validatePracticeActivity,
};

const MATH_EXPR_RE =
  /(?:\b(?:sen|cos|tan)\s*(?:\([A-Za-z0-9θ°αβ\s+-]+\)|[θ°αβ]|\d+\s*°)\s*=\s*[-+0-9A-Za-zθ°αβπΔ/()*^²³⁰¹⁴⁵⁶⁷⁸⁹₀-₉ᵗⁿ√.,·×\s]{1,44}|(?<![A-Za-zÁÉÍÓÚÑáéíóúñ])(?:\([A-Za-z0-9₀-₉²³\s+*/.-]+\)(?:\s*[+*/-]\s*\([A-Za-z0-9₀-₉²³\s+*/.-]+\))+|\d*[A-Za-z]{1,2}(?:²|\^2)(?:\s*[+-]\s*\d*[A-Za-z]{1,2})*(?:\s*[+-]\s*\d+)?|\d*[A-Za-z]{1,2}(?:\s*[+-]\s*\d*[A-Za-z]{1,2})+(?:\s*[+-]\s*\d+)?|[A-Za-zΔ][0-9₀-₉]?(?:\([A-Za-z0-9,\s+-]+\))?|\d+\s*[A-Za-z²³]+(?:\s*[+-]\s*\d*\s*[A-Za-z²³]+)*|\([A-Za-z0-9₀-₉\s+-]+\))\s*=\s*[-+0-9A-Za-zθ°αβπΔ/()*^²³⁰¹⁴⁵⁶⁷⁸⁹₀-₉ᵗⁿ√.,·×\s]{1,88})/g;

const NON_MATH_PROSE_WORD_RE =
  /\b(?:(?!sen\b|cos\b|tan\b|log\b|ln\b|lim\b|max\b|min\b|mod\b|cte\b|const\b)[A-Za-záéíóúñÁÉÍÓÚÑ]{3,}|(?:en|el|la|de|un|al|se|es|si|ya|no|ni|mi|tu|su|lo|le|me|te|va|da|ha|he|del|por|con|sin|mas|más|que|como|para|pero|sino)\b|[yoaeu]\s+[A-Za-záéíóúñÁÉÍÓÚÑ]{2,})/i;

const UNIT_ONLY_LHS_RE =
  /^(?:cm|mm|km|kg|mg|ml|hr|hs|min|seg|m²|cm²|km²|m³|px|gb|mb|kb|hz|kv|kw|db|ph|pesos|a[ñn]os|horas|d[ií]as|metros|grados)$/i;

const UNIT_CONVERSION_IDENTITY_RE =
  /^(?:m|g|l|s|h)\s*=\s*\d+(?:[.,]\d+)?\s*(?:cm|mm|km|mg|kg|ml|min|seg|ms|hr|m)$/i;

function sanitizeExtractedFormula(rawCandidate: string): string {
  const eqParts = rawCandidate.split('=');
  if (eqParts.length < 2) return '';
  let lhs = eqParts[0].trim();
  let rhs = eqParts.slice(1).join('=').trim();

  // Strip numbered or variable-label equation prefixes like "1: 4x + 3y", "(2) 100x + 50y", "(x): 350x + 800", "n: [180..."
  lhs = lhs.replace(/^(?:\(\s*[A-Za-z0-9]+\s*\)\s*[:.]?\s*|[A-Za-z0-9]+\s*:\s*)+/, '').trim();

  // Reject broken leading binary operators ("/ 2 = 30 m²", "- 1200 = 150x", "* x = ...")
  if (!lhs || /^[/+*×÷^=]/.test(lhs) || /^-\s+/.test(lhs)) return '';
  // Reject standalone measurement units as LHS variable ("cm = 0.2")
  if (UNIT_ONLY_LHS_RE.test(lhs)) return '';
  // Reject unbalanced parentheses on LHS
  const lhsOpen = (lhs.match(/\(/g) || []).length;
  const lhsClose = (lhs.match(/\)/g) || []).length;
  if (lhsOpen !== lhsClose) return '';

  // Reject if LHS contains Spanish prose words
  if (NON_MATH_PROSE_WORD_RE.test(lhs)) return '';

  // Truncate RHS right before the first Spanish prose word or sentence break (e.g., ". 2. Divide")
  const proseMatch = rhs.match(NON_MATH_PROSE_WORD_RE);
  if (proseMatch && proseMatch.index !== undefined) {
    rhs = rhs.slice(0, proseMatch.index).trim();
  }
  const sentenceBreakIdx = rhs.search(/\.\s/);
  if (sentenceBreakIdx >= 0) {
    rhs = rhs.slice(0, sentenceBreakIdx).trim();
  }

  // Truncate RHS if two disconnected math fragments or separate equations collided without separator
  // (e.g. "3000 300y", "a² + b² c² = (3.6)² + (4.8)²", "(3.6)² = 12.96 (4.8)² = 23.04", "... / 300 y")
  rhs = rhs
    .replace(/(?<=[0-9a-zA-Z²³)])\s+(?:[A-Za-z][0-9₀-₉²³]?(?:\([^)]+\))?|\([^)]+\)[²³]?)\s*=[\s\S]*$/, '')
    .replace(/\s+(?:y|o|e)\s+[a-zA-Z₀-₉].*$/i, '')
    .replace(/(?<=[\d)\]a-zA-Z])\s+(?=\d+[a-zA-Z₀-₉]*(?:\s|$))[\s\S]*$/, '')
    .replace(/(?<=[\d)²³a-zA-Z])\s+(?!m[²³]?\b|cm[²³]?\b|km[²³]?\b|mm[²³]?\b|kg\b|mg\b|ml\b|g\b|l\b|s\b|h\b|u\b)[a-zA-Z][0-9₀-₉²³]*\s*$/, '')
    .trim();

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

  // Reject purely numeric identities without variables or operators ("15 = 15", "0 = 0")
  if (/^[-+]?\d+(?:[.,]\d+)?$/.test(lhs) && /^[-+]?\d+(?:[.,]\d+)?(?:\s*(?:m²?|cm|km|mm|°|%))?$/i.test(rhs)) {
    return '';
  }
  // Reject truncated function self-prefix ("P(t) = P" chopped before ₀ or (1+r)ᵗ)
  const fnSelfMatch = lhs.match(/^([A-Za-z])\([^)]+\)$/);
  if (fnSelfMatch && rhs === fnSelfMatch[1]) {
    return '';
  }

  const formula = `${lhs} = ${rhs}`;
  if (UNIT_CONVERSION_IDENTITY_RE.test(formula)) return '';
  // Require at least one digit, math operator, superscript, or explicit function/Greek symbol
  if (!/[0-9+\-*/^²³⁰¹⁴⁵⁶⁷⁸⁹₀-₉ᵗⁿ√()Δπθ°]/.test(formula)) return '';
  if (!isValidRenderableFormula(formula)) return '';
  return formula;
}

const NON_MATH_TOKEN_RE = /^(?:de|del|la|el|los|las|un|una|unos|unas|y|o|e|en|con|para|por|que|como|donde|cuando|si|se|es|son|ser|esta|este|estos|estas|total|valor|resultado|ecuacion|ecuación|expresion|expresión|formula|fórmula|problema|datos|dato|donde|entonces|porque|pero|sin|sobre|entre|desde|hasta|al|lo|su|sus|tu|tus|mi|mis|nuestro|nuestra)$/i;

function isMathToken(raw: string): boolean {
  const token = raw.replace(/^[.,;:]+|[.,;:]+$/g, '').trim();
  if (!token) return false;
  const bare = token.replace(/^[()[\]{}]+|[()[\]{}]+$/g, '').trim();
  if (!bare && /^[()[\]{}]+$/.test(token)) return true;
  if (NON_MATH_TOKEN_RE.test(bare)) return false;
  if (/^[+\-*/^=<>≤≥≠≈√πθαβγΔδΣσλμΩωφ()[\]{}|·×÷]+$/.test(token)) return true;
  if (/^[A-Za-z]$/.test(bare)) return true;
  if (/^[A-Za-z]{1,2}\d*$/.test(bare) && !UNIT_ONLY_LHS_RE.test(bare)) return true;
  if (/^\d+[A-Za-z]{1,2}$/.test(bare)) return true;
  if (/^[A-Za-z][A-Za-z0-9()+\-*/^]*(?:[₀-₉⁰¹²³⁴⁵⁶⁷⁸⁹ᵗⁿ]|\^[-+]?[A-Za-z0-9()]+)$/.test(token) && token.length <= 22) {
    return true;
  }
  if (/^[A-Za-z]\([A-Za-z0-9,+\-*/\s]{1,12}\)$/.test(token)) return true;
  if (/^(?:sen|cos|tan|log|ln|sqrt|raiz|raíz)$/i.test(bare)) return true;
  if (/^-?\d+(?:[.,]\d+)?(?:[a-zA-Z%°²³]+)?$/.test(bare)) return true;
  if (/^\d+(?:[.,]\d+)?$/.test(bare)) return true;
  if (
    token.length <= 24 &&
    /^[A-Za-z0-9()+\-*/^·×÷.,₀-₉⁰¹²³⁴⁵⁶⁷⁸⁹ᵗⁿ%°]+$/.test(token) &&
    /[0-9()+\-*/^²³₀-₉ᵗⁿ]/.test(token) &&
    !/[A-Za-z]{3,}/.test(token.replace(/\b(?:sen|cos|tan|log|ln|sqrt)\b/gi, ''))
  ) {
    return true;
  }
  return false;
}

function extractCompleteEquations(text: string): string[] {
  const out: string[] = [];
  for (let index = 0; index < text.length; index++) {
    if (text[index] !== '=') continue;
    const leftText = text.slice(Math.max(0, index - 130), index).trimEnd();
    const rightText = text.slice(index + 1, index + 130).trimStart();
    const leftTokens = leftText.split(/\s+/).filter(Boolean);
    const rightTokens = rightText.split(/\s+/).filter(Boolean);
    const leftParts: string[] = [];
    for (let i = leftTokens.length - 1; i >= 0; i--) {
      if (!isMathToken(leftTokens[i]!)) break;
      leftParts.unshift(leftTokens[i]!);
    }
    const rightParts: string[] = [];
    for (const token of rightTokens) {
      if (!isMathToken(token)) break;
      rightParts.push(token);
      if (/[.;:!?]$/.test(token)) break;
    }
    if (leftParts.length === 0 || rightParts.length === 0) continue;
    // If leftParts starts with a dangling binary operator ("/", "*", "+", "-", "×", "÷"), the real LHS was cut off.
    if (/^[/+*×÷^=-]$/.test(leftParts[0]!)) continue;
    const candidate = sanitizeExtractedFormula(`${leftParts.join(' ')} = ${rightParts.join(' ')}`);
    if (candidate.length >= 5 && candidate.length <= 96) out.push(candidate);
  }
  return out;
}

function isSimpleParameterAssignment(formula: string): boolean {
  return /^(?:[A-Za-z][0-9₀-₉]?\s*=\s*-?\d+(?:[.,]\d+)?(?:\s*(?:m²?|cm|km|mm|kg|g|l|s|h|%|°))?(?:,\s*)?)+$/i.test(
    formula.trim()
  );
}

function preferCompleteEquations(candidates: string[]): string[] {
  const unique = Array.from(new Set(candidates.filter(Boolean)));
  const nonSubsumed = unique.filter((candidate) => {
    const normalized = candidate.toLowerCase().replace(/\s+/g, ' ');
    return !unique.some((other) => {
      if (other === candidate) return false;
      const otherNorm = other.toLowerCase().replace(/\s+/g, ' ');
      return (
        otherNorm.length > normalized.length &&
        (otherNorm.endsWith(normalized) || otherNorm.startsWith(normalized))
      );
    });
  });
  const richFormulas = nonSubsumed.filter((eq) => !isSimpleParameterAssignment(eq));
  const simpleAssignments = nonSubsumed.filter((eq) => isSimpleParameterAssignment(eq));
  return [...richFormulas, ...simpleAssignments];
}

/** Extrae fórmulas o ecuaciones relevantes presentes en teoría o ejemplos sin fragmentos de prosa ni variables de plantilla. */
export function extractFormulasFromText(text: string, limit = 3): string[] {
  const clean = cleanSacrintText(text);
  if (!clean) return [];
  const found: string[] = [];
  for (const candidate of extractCompleteEquations(clean)) {
    if (!found.includes(candidate)) found.push(candidate);
  }
  for (const match of clean.matchAll(MATH_EXPR_RE)) {
    const candidate = sanitizeExtractedFormula(match[0]);
    if (candidate.length >= 5 && candidate.length <= 96 && !found.includes(candidate)) {
      found.push(candidate);
    }
  }
  return preferCompleteEquations(found).slice(0, limit);
}

function stripRubricTail(rawText: string): string {
  const match = rawText.match(
    /\s*\b(?:R[uú]brica(?:\s+anal[ií]tica)?|Criterios?\s+de\s+evaluaci[oó]n|Lista\s+de\s+cotejo)\s*:[\s\S]*$/i
  );
  if (!match || match.index === undefined) return rawText.trim();
  const prefix = rawText.slice(0, match.index).trim();
  const tail = match[0];
  const tailLooksLikeRubricMetadata =
    /ponderaci[oó]n|excelente|bueno|suficiente|insuficiente|requiere\s+apoyo|\b\d+\s*(?:pts?|puntos?|%)/i.test(
      tail
    );
  // No amputar un paso legítimo cuya acción es aplicar una rúbrica ("Aplicar rúbrica: verificar entrada, cuerpo y cierre.").
  if (!tailLooksLikeRubricMetadata && prefix.split(/\s+/).filter(Boolean).length < 4) {
    return rawText.trim();
  }
  return prefix;
}

function cleanStepLine(rawStep: string): string {
  const base = stripRubricTail(cleanSacrintText(rawStep))
    .replace(/^(?:paso\s*\d+\s*[:.\-–]|\d+[.)]\s*)/i, '')
    .trim();
  // Eliminar etiquetas de plantilla/prompt de última milla y normalizar listas numeradas inline
  // ("1. Desenergizar... 2. Limpiar...") para que splitSpanishSentences nunca corte tras "1."
  const withoutTemplate = stripTemplateLabels(base)
    .replace(/(?<=[:.;\s]|^)(\d+)\.\s+(?=[A-ZÁÉÍÓÚÑ])/g, '($1) ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (!withoutTemplate || NUMERIC_ONLY_STEP_RE.test(withoutTemplate)) {
    return '';
  }
  return withoutTemplate;
}

function shortenStepHeading(head: string): string {
  const cleanedHead = head
    .trim()
    .replace(
      /^(?:Para\s+ello|Por\s+ello|Por\s+lo\s+tanto|En\s+consecuencia|As[ií]\s+que|De\s+este\s+modo|De\s+esta\s+manera),?\s+/i,
      ''
    )
    .trim();
  const normalizedHead = cleanedHead
    ? cleanedHead.charAt(0).toUpperCase() + cleanedHead.slice(1)
    : head.trim();
  const words = normalizedHead.split(/\s+/).slice(0, 4);
  while (
    words.length > 1 &&
    /^(?:el|la|los|las|un|una|de|del|al|a|en|con|por|para|y|o|su|sus|todo|toda|todos|todas|este|esta|estos|estas|ese|esa|cada|ambos|ambas|nuestro|nuestra|que|cual|como|donde|obteniendo|resultando)$/i.test(
      words[words.length - 1]!.replace(/[,;:]+$/, '')
    )
  ) {
    words.pop();
  }
  return words.join(' ').replace(/[,;:]+$/, '').trim();
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
    const prevTok = current[current.length - 1] ?? '';
    const isPrevEquationEnd =
      /(?:[0-9)\]}]|pesos|a[ñn]os|m|cm|unidades|horas)[.;,]?$/i.test(prevTok) &&
      !/^[1-9]\)$/.test(prevTok);
    const isNewLhsStart =
      parenDepth === 0 &&
      seenEqInCurrent &&
      current.length >= 3 &&
      isPrevEquationEnd &&
      !/[=+\-*/(]$/.test(prevTok) &&
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

/**
 * Simplifica cadenas de evaluación puramente numéricas ("= expr_intermedia = valor")
 * conservando el lado izquierdo original y el resultado numérico final.
 */
function simplifyNumericEqualsChains(text: string): string {
  if ((text.match(/[=≈]/g) || []).length < 2 || text.split(/\s+/).length <= 10) {
    return text;
  }
  return text.replace(
    /=\s*((?:[+\-*/·×÷().,\d^²³\s]*\d[+\-*/·×÷().,\d^²³\s]*=\s*)+)(-?\d[\d.,]*)\b/g,
    (full, chain: string, num: string) => {
      const opens = (chain.match(/\(/g) || []).length;
      const closes = (chain.match(/\)/g) || []).length;
      if (
        opens !== closes ||
        /,\s/.test(chain) ||
        /\d[.,\d]*\s+[+\-]?\d/.test(chain) ||
        /(?:\d|\))\s+(?:\(|[a-zA-Z])/.test(chain)
      ) {
        return full;
      }
      return `= ${num}`;
    }
  );
}

function compactChalkboardMathStep(step: string, rawStep?: string): string {
  // Compactar listas de parámetros tipo "Población inicial (P₀): 4500 - Tasa...: 0.035 - ... Modelo...: P(t) = ..."
  const dashKvParts = step.split(/\s+-\s+/);
  const kvHeaderCount = dashKvParts.filter((p) => /^[A-ZÁÉÍÓÚÑ][^:=]{1,38}:/.test(p.trim())).length;
  if (dashKvParts.length >= 3 && kvHeaderCount >= 2) {
    const compactParts = dashKvParts
      .map((part) => {
        const symParen = part.match(/^[^(]{2,36}\(([^)]{1,14})\)\s*:\s*(.+)$/);
        if (symParen) {
          const valClean = symParen[2].replace(/^[^=]{6,32}=\s*/, '').replace(/\s+(?:años?|pesos|unidades)$/i, (u) => u).trim();
          return `${symParen[1].trim()} = ${valClean}`;
        }
        const modelMatch = part.match(/^Modelo[^:]{0,28}:\s*(.+)$/i);
        if (modelMatch) return modelMatch[1].trim();
        return part.trim();
      })
      .filter(Boolean);
    if (compactParts.length >= 2) {
      const joined = compactParts.join('; ').replace(/\.$/, '') + '.';
      if (joined.split(/\s+/).length < step.split(/\s+/).length) {
        step = joined;
      }
    }
  }

  const words = step.split(/\s+/);
  if (words.length <= 12) return step;

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

  // 2.5 Compactar frases de semiperímetro / despeje verbal extendido ("Si el largo es x y el ancho es y..., por lo que...")
  out = out
    .replace(/\s*-{4,}\s*/g, ' ')
    .replace(/\s*(?:=>|->)\s*/g, ' ⇒ ')
    .replace(/^Determinante\s+del\s+sistema\s*\((Δs)\)\s*:\s*/i, '$1: ')
    .replace(/^Determinante\s+de\s+([xy])\s*\((Δ[xy])\)\s*:\s*/i, '$2: ')
    .replace(/\b(?:Escribimos|Definimos)\s+el\s+sistema(?:\s+modificado)?:\s*/gi, 'Sistema: ')
    .replace(/\b(?:Multiplicamos|Multiplica)\s+la\s+(primera|segunda)\s+ecuaci[oó]n:\s*(-?\d+)\(([^)]+)\)\s*=\s*\2\(([^)]+)\)\s*⇒\s*/gi, (_m, ord: string, factor: string) => `${/primera/i.test(ord) ? 'Ec. 1' : 'Ec. 2'} × (${factor}): `)
    .replace(/\b(?:Multiplicamos|Multiplica)\s+la\s+(primera|segunda)\s+ecuaci[oó]n:\s*/gi, (_m, ord: string) => `${/primera/i.test(ord) ? 'Ec. 1' : 'Ec. 2'}: `)
    .replace(/\bSumamos\s+la\s+(?:primera|segunda)\s+ecuaci[oó]n:\s*/gi, 'Suma: ')
    .replace(/\bDecidimos\s+eliminar\s+la\s+variable:\s*/gi, 'Elimina variable: ')
    .replace(/\bResolvemos\s+la\s+ecuaci[oó]n\s+resultante:\s*/gi, 'Resolvemos: ')
    .replace(/\ben\s+la\s+primera\s+ecuaci[oó]n\s+original\b/gi, 'en Ec. 1')
    .replace(/\bMultiplicando\s+los\s+binomios:\s*/gi, 'Producto: ')
    .replace(/\bSustituir\s+la\s+expresi[oó]n\s+obtenida:\s*/gi, 'Sustituye: ')
    .replace(/\bIguala\s+ambas\s+expresiones:\s*/gi, 'Iguala: ')
    .replace(/\s+utilizando\s+la\s+calculadora\s+cient[ií]fica(?=[.:]|\s|$)/gi, '')
    .replace(/\s+y\s+calcular\s+la\s+potencia(?=[.:]|\s|$)/gi, '')
    .replace(/\bCapital\s+inicial\s*\(C\)\s*=\s*([^\s]+)\s+Tasa\s+de\s+inter[eé]s\s+anual\s*\(i\)\s*=\s*([^\s]+)\s+Tiempo\s*\(t\)\s*=\s*([^\s.]+\s*a[ñn]os?)/gi, 'C = $1; i = $2; t = $3')
    .replace(/^Si\s+el\s+largo\s+es\s+([a-z])\s+y\s+el\s+ancho\s+es\s+([a-z]),\s+el\s+semiper[ií]metro\s+es\s+/i, 'Largo $1, ancho $2: ')
    .replace(/,\s*por\s+lo\s+que\s+el\s+(?:ancho|largo|otro\s+lado)\s+se\s+puede\s+expresar\s+como\s+/i, ' ⇒ ')
    .replace(/^Factoriza\s+el\s+trinomio\s+buscando\s+dos\s+n[uú]meros\s+que\s+multiplicados\s+den\s+([^\s]+)\s+y\s+sumados\s+den\s+([^.]+)\.?$/i, 'Factoriza: producto $1, suma $2.')
    .replace(/^Desarrolla\s+y\s+ordena\s+la\s+ecuaci[oó]n\s+en\s+su\s+forma\s+completa\s+/i, 'Ordena en forma ')
    .replace(/^Construir\s+la\s+tabla\s+de\s+valores\s+asignando\s+a\s+([a-z])\s+los\s+valores\s+/i, 'Tabula para $1 = ')
    .replace(/^Obtener\s+los\s+pares\s+ordenados\s+resultantes:\s*/i, 'Pares: ')
    .replace(/,\s*obteniendo\s+la\s+expresi[oó]n\s+equivalente\s+/gi, ' ⇒ ')
    .replace(/,\s*lo\s+cual\s+genera\s+la\s+ecuaci[oó]n(?:\s+polin[oó]mica)?\s+ordenada\s+/gi, ' ⇒ ')
    .replace(/^Explicaci[oó]n\s+del\s+despeje\s+algebraico:\s*Mostramos\s+el\s+procedimiento\s+paso\s+a\s+paso\s+en\s+el\s+pizarr[oó]n:\s*/i, 'Despeje: ')
    .replace(/\s+correspondientes\s+a\s+las\s+horas\s+de\s+recreaci[oó]n\s*/gi, ' ')
    .replace(/\s+desde\s+0\s+hasta\s+(\d+)\s+con\s+una\s+escala\s+uniforme(?=\.|$)/gi, ' (0 a $1)')
    .replace(/^Primero,\s*resta\s+(\d+)\s+en\s+ambos\s+(?:miembros|lados|extremos)\s+de\s+la\s+ecuaci[oó]n\s+/i, 'Resta $1 en ambos lados: ')
    .replace(/\s+/g, ' ')
    .trim();

  // 2.52 Compactar tabulaciones numéricas ("Si x = 0, y = 10 - 0.5(0) = 10. Si x = 2, y = 10 - 0.5(2) = 9...")
  if (/tabulaci[oó]n|tabla\s+de\s+valores|evaluando/i.test(out)) {
    const tabPairs = [
      ...out.matchAll(
        /\b([a-z])\s*=\s*(-?\d+(?:[.,]\d+)?)\s*,\s*([a-z])\s*=\s*(?:[^\n=]|\.(?=\d))+?=\s*(-?\d+(?:[.,]\d+)?)\b/gi
      ),
    ];
    if (tabPairs.length >= 3) {
      const v1 = tabPairs[0][1];
      const v2 = tabPairs[0][3];
      const pts = tabPairs.map((m) => `(${m[2]},${m[4]})`).join(', ');
      return `Tabula (${v1},${v2}): ${pts}.`;
    }
  }

  // 2.55 Separar ecuaciones contiguas separadas solo por espacio (p. ej. "5y = 850 - 150 5y = 700" o "(3.6)² = 12.96 (4.8)² = 23.04")
  if ((out.match(/[=≈]/g) || []).length >= 2) {
    out = out.replace(
      /(?<=[\d)²³])\s+(?=(?:[+\-]?\d*)?[a-zA-Z][₀₁₂]?[²³]?(?:\s*[+\-*/]\s*\d*[a-zA-Z][₀₁₂]?)?\s*=|\(\d+(?:[.,]\d+)?\)[²³^]?\s*=)/g,
      (match, offset: number, src: string) => {
        const before = src.slice(0, offset);
        if (/(?:^|\s)[1-9]\)$/.test(before) || !before.includes('=')) {
          return match;
        }
        return '; ';
      }
    );
  }

  // 2.6 Simplificar evaluaciones encadenadas puramente numéricas ("= (5)² - 4(2)(-3) = 25 - (-24) = 25 + 24 = 49")
  // conservando LHS simbólico y resultado final, sin unir ecuaciones o listas separadas
  out = simplifyNumericEqualsChains(out);

  const formatSolvedTail = (middleSlice: string, finalExpr: string): string => {
    const lastVar = finalExpr.match(/^([a-zA-Z])\s*=/)?.[1]?.toLowerCase();
    const midSolved = middleSlice.match(/\b([a-zA-Z])\s*=\s*(-?\d+(?:[.,]\d+)?)\b/);
    return midSolved && midSolved[1].toLowerCase() !== lastVar
      ? `${midSolved[1]} = ${midSolved[2]}; ${finalExpr}`
      : finalExpr;
  };

  // 2.7 Compactar pasos con flecha ⇒ y secuencia intermedia hasta solución final de variable ("Sustituye: eq ⇒ ... y = 140.")
  const arrowSimple = out.match(
    /^([^:=]{4,30}:)\s*([^⇒\n]+?)\s*⇒([\s\S]{10,}?)\b([a-zA-Z])\s*=\s*(-?\d+(?:[.,]\d+)?(?:\s*(?:pesos|m|cm|a[ñn]os|horas|unidades))?)\.?$/i
  );
  if (arrowSimple && out.split(/\s+/).length > 14 && (out.match(/[=≈]/g) || []).length >= 3) {
    const tail = formatSolvedTail(arrowSimple[3], `${arrowSimple[4]} = ${arrowSimple[5].trim()}`);
    return `${arrowSimple[1].trim()} ${arrowSimple[2].trim()} ⇒ ${tail}.`;
  }

  // 2.8 Compactar cadenas con >= 3 pasos separados por flecha ⇒ ("eq1 ⇒ eq2 ⇒ eq3.")
  const arrowClauses = out.split(/\s*⇒\s*/).map((s) => s.trim()).filter(Boolean);
  if (arrowClauses.length >= 3 && out.split(/\s+/).length > 16) {
    const firstArrowClause = arrowClauses[0].replace(/\.$/, '').trim();
    const lastArrowClause = arrowClauses[arrowClauses.length - 1].replace(/\.$/, '').trim();
    if (firstArrowClause && lastArrowClause && firstArrowClause !== lastArrowClause) {
      return `${firstArrowClause} ⇒ ${formatSolvedTail(arrowClauses.slice(1, -1).join(' '), lastArrowClause)}.`;
    }
  }

  // 3. Condensar pasos explicativos con múltiples resultados intermedios ("Luego multiplicamos ... Como hablamos de personas ...: N.")
  const chainThenNote = out.match(
    /^([^:]{6,35}:)?\s*([^=≈]+(?:=|≈)[^A-ZÁÉÍÓÚÑ\n]{4,36})\s+Luego\s+[^:=]{8,60}:\s*[\s\S]{6,85}?(?:=|≈)\s*[\d.,]+\s+Como\s+[^:]{10,140}:\s*([^.]+)\.?$/i
  );
  if (chainThenNote) {
    const label = chainThenNote[1] ? `${chainThenNote[1].trim()} ` : '';
    const first = chainThenNote[2].trim();
    const finalAns = chainThenNote[3].trim();
    return `${label}${first} ⇒ ${finalAns}.`;
  }

  // 3.5 Compactar cadenas con gerundios de procedimiento ("Sustituir...: eq1 Aplicando...: eq2 Agrupando...: eq3 Despejando...: ⇒ y = 140.")
  const relOps = (out.match(/[=≈]/g) || []).length;
  if (relOps >= 3 && out.split(/\s+/).length > 13) {
    const stepClauses = out
      .split(/\s+(?=(?:Aplicando|Agrupando|Despejando|Resolviendo|Simplificando|Sustituyendo|Reduciendo|Dividiendo|Multiplicando|Calculando|Restando|Sumando)\b[^:=]{1,42}:)/)
      .map((s) => s.trim())
      .filter((s) => /[=≈]/.test(s));
    if (stepClauses.length >= 3) {
      const firstEq = stepClauses[0].replace(/\.$/, '').trim();
      const rawLast = stepClauses[stepClauses.length - 1]
        .replace(/^[A-Za-zÁÉÍÓÚÑáéíóúñ\s0-9]{4,40}:\s*(?:⇒\s*)?/, '')
        .replace(/\.$/, '')
        .trim();
      if (firstEq && rawLast && firstEq !== rawLast) {
        return `${firstEq} ⇒ ${rawLast}.`;
      }
    }
  }

  // 3.6 Compactar pares de evaluación de fórmulas independientes por oración ("x = Δx / Δ = -24 / -2 = 12. y = Δy / Δ = -16 / -2 = 8.")
  // Guard: nunca disparar si una oración declara dos variables separadas por coma o conecta raíces ("x = -6 y x = -3")
  if (relOps >= 4 && out.split(/\s+/).length > 15 && !/\b[a-z]\s*=\s*[^,.;]+,\s*[a-z]\s*=/i.test(out)) {
    const subResults = [
      ...out.matchAll(
        /(?:^|[.;:]\s*)\b([a-z])\s*=\s*(?:[^=.,;\n⇒]{1,22}=\s*)+(-?\d+(?:[.,]\d+)?)(?=\s*(?:[.;]|$))/gi
      ),
    ].map((m) => `${m[1]} = ${m[2]}`);
    if (subResults.length >= 2) {
      const headMatch = out.match(/^([^:=.]{5,34}):/);
      const prefix = headMatch ? `${shortenStepHeading(headMatch[1])}: ` : '';
      return `${prefix}${subResults.join('; ')}.`;
    }
  }

  // 3.7 Compactar cadenas largas de cálculo con múltiples '=' / '≈' hacia su resultado final ("Sustitución...: n = (...) n = ... ≈ 260.")
  if (relOps >= 3 && out.split(/\s+/).length > 16) {
    const headSep = out.match(/^([^:=]{6,48}[.:])\s*([a-zA-Z0-9₀₁₂()]+)\s*=\s*[\s\S]+?(?:=|≈)\s*(-?\d[\d,]*(?:\.\d+)?)(?:\s+(pesos|a[ñn]os|hab(?:itantes)?|j[oó]venes|estudiantes|unidades))?\.?$/i);
    if (headSep) {
      const shortHead = shortenStepHeading(headSep[1].replace(/[.:]+$/, ''));
      const lhs = headSep[2].trim();
      const numVal = headSep[3].replace(/\.+$/, '').trim();
      const unit = headSep[4] ? ` ${headSep[4]}` : '';
      return `${shortHead}: ${lhs} ≈ ${numVal}${unit}.`;
    }
  }

  // 4. Si persiste una cadena larga de >= 3 igualdades en la misma línea, dividir respetando paréntesis balanceados
  const eqCount = relOps;
  if (eqCount >= 3 && out.split(/\s+/).length > 13 && !/\by\s+[a-z]\s*=\s*-?\d/i.test(out)) {
    const firstColon = out.indexOf(':');
    const prefix = firstColon > 0 && firstColon < 36 ? `${out.slice(0, firstColon + 1)} ` : '';
    const body = firstColon > 0 && firstColon < 36 ? out.slice(firstColon + 1).trim() : out;
    const segments = splitBalancedTopLevelEquations(body);
    if (segments.length >= 3) {
      const firstEq = segments[0].replace(/\.$/, '');
      const lastEq = segments[segments.length - 1].replace(/\s*\([^)]{5,45}\)\.?$/, '').replace(/\.$/, '');
      const balancedParens = (s: string) => (s.match(/\(/g) || []).length === (s.match(/\)/g) || []).length;
      if (
        firstEq !== lastEq &&
        balancedParens(firstEq) &&
        balancedParens(lastEq) &&
        !hasDanglingEnding(firstEq) &&
        !/[-–—]$/.test(firstEq)
      ) {
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
  const clean = stripTemplateLabels(sanitizePedagogicalMetaPhrases(cleanStepLine(rawStep)));
  if (!clean || isRubricOrBoilerplateLeak(clean) || NUMERIC_ONLY_STEP_RE.test(clean) || ORPHAN_LIST_END_RE.test(clean)) {
    return '';
  }
  const hasMath = /[=]|\d/.test(clean);
  const mathSentence =
    splitSpanishSentences(clean).find((sentence) => /=/.test(sentence) && !NUMERIC_ONLY_STEP_RE.test(sentence)) ||
    splitSpanishSentences(clean).find(
      (sentence) =>
        /\d/.test(sentence) &&
        !/^Paso\s*\d+/i.test(sentence) &&
        !NUMERIC_ONLY_STEP_RE.test(sentence) &&
        !ORPHAN_LIST_END_RE.test(sentence)
    );
  const preserveMath = (candidate: string): string => {
    const safeCandidate =
      !candidate || NUMERIC_ONLY_STEP_RE.test(candidate) || ORPHAN_LIST_END_RE.test(candidate)
        ? ''
        : candidate;
    if (!safeCandidate) {
      return mathSentence && !NUMERIC_ONLY_STEP_RE.test(mathSentence) && !ORPHAN_LIST_END_RE.test(mathSentence)
        ? mathSentence
        : '';
    }
    return hasMath && !/[=]|\d/.test(safeCandidate) ? (mathSentence || safeCandidate) : safeCandidate;
  };
  if ((maxWords !== undefined && maxWords <= 12) || clean.length > maxChars) {
    const compacted = compactChalkboardMathStep(clean, rawStep);
    if (compacted.length <= maxChars && (!maxWords || compacted.split(/\s+/).length <= maxWords)) {
      return compacted;
    }
    const fitted = fitPedagogicalText(compacted, {
      maxChars,
      maxWords,
      role: 'step',
    });
    const reCompacted = compactChalkboardMathStep(fitted, rawStep);
    const preservedEquation = extractCompleteEquations(clean)[0];
    if (
      preservedEquation &&
      !reCompacted.includes(preservedEquation) &&
      mathSentence &&
      mathSentence.length <= maxChars + 28 &&
      (!maxWords || mathSentence.split(/\s+/).filter(Boolean).length <= maxWords + 8)
    ) {
      return mathSentence;
    }
    // Preservar resultado final si el paso original cerraba con igualdad numérica (= valor) que quedó truncada.
    // Si el paso enumeraba varios coeficientes/valores (ej. a = 1, b = 6 y c = -160), conservar la lista completa.
    const multiAssignList = clean.match(
      /\b[a-z][₀-₉]?\s*=\s*-?\d+(?:[.,]\d+)?(?:,\s*[a-z][₀-₉]?\s*=\s*-?\d+(?:[.,]\d+)?)+(?:\s+y\s+[a-z][₀-₉]?\s*=\s*-?\d+(?:[.,]\d+)?)?/i
    );
    if (multiAssignList && !reCompacted.includes(multiAssignList[0])) {
      const prefixClean = reCompacted
        .replace(
          /\b(?:son\s+)?[a-z][₀-₉]?\s*=\s*-?\d+(?:[.,]\d+)?(?:,\s*[a-z][₀-₉]?\s*=\s*-?\d+(?:[.,]\d+)?)*(?:\s+y\s+[a-z][₀-₉]?\s*=\s*-?\d+(?:[.,]\d+)?)?\s*\.?$/i,
          ''
        )
        .replace(/\b(?:son|con)\s*$/i, '')
        .replace(/[.,;:]+$/, '')
        .trim();
      if (prefixClean.length + multiAssignList[0].length + 4 <= maxChars + 32) {
        return `${prefixClean}: ${multiAssignList[0].trim()}.`;
      }
    }
    const trailingResultMatch = clean.match(/(?:(?<![Δδa-zA-Z0-9_/])\b[a-z][₀-₉]?\s*=\s*-?\d+(?:[.,]\d+)?(?:\s*[%₱])?|\bV\s*\([^)]+\))(?=[.,;\s]*$)/i);
    if (
      trailingResultMatch &&
      !multiAssignList &&
      !reCompacted.includes(trailingResultMatch[0].trim()) &&
      reCompacted.length + trailingResultMatch[0].length + 4 <= maxChars + 18
    ) {
      return `${reCompacted.replace(/[.,;:]+$/, '')}: ${trailingResultMatch[0].trim()}.`;
    }
    return preserveMath(reCompacted);
  }
  return preserveMath(
    fitPedagogicalText(clean, {
      maxChars,
      maxWords,
      role: 'step',
    })
  );
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
  if (clean.length > maxChars || (maxWords !== undefined && clean.split(/\s+/).length > maxWords)) {
    const preserved = distillExerciseStatement(clean, maxChars, maxWords);
    if (preserved) return preserved;
  }
  return fitPedagogicalText(clean, {
    maxChars,
    maxWords,
    role: 'problem',
  });
}

const SUMMARY_TASK_VERBS =
  'calcula|determina|encuentra|halla|resuelve|modela|plantea|formula|indica|escribe|obt[eé]n|verifica|comprueba|justifica|identifica|estima|precisa|audita|revisa|aplica|traza|dibuja|grafica|clasifica|compara|argumenta|explica|analiza|relaciona|interpreta|distingue|localiza|señala|construye|elabora|integra|crea|redacta|prepara|consolida|organiza|demuestra|simula|examina|utiliza|genera|emplea|describe|representa|completa|ordena|usa|enfócate|asegúrate';
const SUMMARY_TASK_RE = new RegExp('\\b(?:' + SUMMARY_TASK_VERBS + ')\\b', 'i');

function summaryDataTokens(text: string): string[] {
  return [...new Set(
    text.match(
      /(?<![\d.])\$?\d[\d.,]*(?:\s+(?:m²|cm²|metros|grados|pesos|años|habitantes|libretas|unidades|estudiantes|jóvenes|minutos|horas|m|cm|km|mm|kg|g|l|ml|%))?/gi
    ) ?? []
  )]
    .filter((value) => /\d/.test(value))
    .slice(0, 8);
}

const SUMMARY_META_RE =
  /^(?:aprender[aáe]s|vas a aprender|en esta sesi[oó]n|el prop[oó]sito|al finalizar|identificar[aáe]s|comprender[aáe]s|analizar[aáe]s|se espera que|el estudiante)/i;
const SUMMARY_DANGLING_RE =
  /^(?:a|al|de|del|en|con|para|por|y|o|que|el|la|los|las|un|una|unos|unas|su|sus|tu|tus|se|lo|le|les|como|seg[uú]n)$/i;
const SUMMARY_TASK_START_RE = new RegExp('^(?:' + SUMMARY_TASK_VERBS + ')\\b', 'i');
const SUMMARY_TASK_AFTER_COMMA_RE = new RegExp('(?:,\\s*)(?:' + SUMMARY_TASK_VERBS + ')\\b', 'i');
const SUMMARY_CONNECTOR_RE = /^(?:a partir|con (?:estos|esta|la|el|los|las)|de acuerdo|utilizando|usa|considera|si|cuando|dado que)\b/i;

function isSummaryTaskSentence(sentence: string): boolean {
  if (/¿|\?$/.test(sentence)) return true;
  if (SUMMARY_TASK_START_RE.test(sentence)) return true;
  if (SUMMARY_CONNECTOR_RE.test(sentence) && SUMMARY_TASK_RE.test(sentence)) return true;
  return SUMMARY_TASK_AFTER_COMMA_RE.test(sentence);
}

function summaryTaskVerb(sentence: string): string | null {
  const matches = [...sentence.matchAll(new RegExp(SUMMARY_TASK_RE.source, 'gi'))];
  if (!matches.length) return null;
  if (SUMMARY_TASK_START_RE.test(sentence)) return matches[0][0];
  return matches[matches.length - 1][0];
}

function trimSummaryDangling(text: string): string {
  const words = text.replace(/[.;:]+$/, '').trim().split(/\s+/).filter(Boolean);
  while (words.length > 3 && SUMMARY_DANGLING_RE.test(words[words.length - 1])) words.pop();
  while (words.length > 3 && /^\d+[.,]?$/.test(words[words.length - 1])) words.pop();
  while (words.length > 3 && SUMMARY_DANGLING_RE.test(words[words.length - 1])) words.pop();
  return words.join(' ');
}

function summaryContext(sentences: string[], taskSentence: string): string {
  const candidates = sentences.filter(
    (sentence) => sentence !== taskSentence && sentence.length >= 18 && !SUMMARY_META_RE.test(sentence)
  );
  let context = candidates[0] || '';
  if (!context && taskSentence) {
    const taskVerb = summaryTaskVerb(taskSentence);
    const verbIndex = taskVerb ? taskSentence.lastIndexOf(taskVerb) : -1;
    if (verbIndex > 0) context = taskSentence.slice(0, verbIndex);
  }
  context = context
    .replace(/^(?:ejercicio|actividad|problema)\s*\d*\s*[:.\-]\s*/i, '')
    .replace(/^(?:planteamiento|enunciado|situaci[oó]n)\s*:\s*/i, '')
    .trim();
  if (SUMMARY_META_RE.test(context) || /^(?:a partir|con|de acuerdo|utilizando)\b/i.test(context)) {
    context = '';
  }
  if (context.length > 100) {
    const clauses = context.split(/,\s+|;\s+/);
    let acc = '';
    for (const clause of clauses) {
      const next = acc ? `${acc}, ${clause}` : clause;
      if (next.length > 100) break;
      acc = next;
    }
    context = acc || context.split(/\s+/).slice(0, 16).join(' ');
  }
  return trimSummaryDangling(context);
}

function summaryTaskObject(text: string, verb: string): string {
  const escaped = verb.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = text.match(new RegExp(`\\b${escaped}\\b\\s+(.{8,110}?)(?:[.;?!]|$)`, 'i'));
  const question = text.match(/¿(?:cu[aá]l|qu[eé]|cu[aá]nt[oa]s?)\s+(?:es|son)?\s*(.{8,110}?)(?:\?|$)/i);
  const raw = match?.[1] ?? question?.[1] ?? '';
  if (!raw) return 'la situación y verifica el resultado';
  const object = raw
    .replace(/\b(?:tabla de valores|tabla)\b/gi, 'tabulación')
    .replace(/\bpuntos de control\b/gi, 'puntos de referencia')
    .replace(/\buna ecuaci[oó]n de primer grado\b/gi, 'el modelo de primer grado')
    .replace(/\s+y\s+(?:cada|que|para|con)\b[\s\S]*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  const trimmed = trimSummaryDangling(object.split(/\s+/).slice(0, 14).join(' '));
  return trimmed || 'la situación y verifica el resultado';
}

function summaryConnector(verb: string, seed: string): string {
  const v = verb.toLowerCase();
  if (/^(calcula|determina|halla|resuelve|encuentra|estima|precisa|obt[eé]n)$/.test(v)) {
    return seed.length % 2 === 0 ? 'Con estos datos,' : 'A partir de los datos,';
  }
  if (/^(plantea|modela|formula|escribe|representa)$/.test(v)) {
    return seed.length % 2 === 0 ? 'A partir de la situación,' : 'Con la información del caso,';
  }
  if (/^(elabora|genera|construye|crea|prepara|organiza|consolida|integra|redacta|completa|ordena)$/.test(v)) {
    return seed.length % 2 === 0 ? 'Con la información anterior,' : 'A partir del contexto,';
  }
  return seed.length % 2 === 0 ? 'Con el procedimiento descrito,' : 'A partir del análisis,';
}

/**
 * Síntesis extractiva para diapositivas: conserva contexto, tarea, fórmulas y
 * datos reales, pero evita copiar párrafos completos del libro.
 */
export function buildPresentationSummary(raw: string, title?: string): string {
  const clean = sanitizePedagogicalMetaPhrases(cleanSacrintText(raw));
  if (!clean) return '';
  const sentences = splitSpanishSentences(clean);
  const taskSentence = sentences.find(isSummaryTaskSentence) || '';
  const verb = summaryTaskVerb(taskSentence) || (/¿/.test(clean) ? 'determina' : 'resuelve');
  const context = summaryContext(sentences, taskSentence);
  let taskObject = summaryTaskObject(taskSentence || clean, verb);
  if (context && context.toLowerCase().includes(taskObject.toLowerCase())) {
    taskObject = 'la situación y verifica el resultado';
  }
  const formulas = extractFormulasFromText(clean)
    .filter(isValidRenderableFormula)
    .filter((formula) => !context.includes(formula))
    .slice(0, 2);
  const mathExpressions = [
    ...new Set(clean.match(/\b\d+(?:[.,]\d+)?\s*[a-zA-Z]\s*[+\-]\s*\d+(?:[.,]\d+)?\s*°?/g) ?? []),
  ].slice(0, 2);
  const cleanForData = formulas
    .concat(mathExpressions)
    .reduce((acc, expression) => acc.split(expression).join(' '), clean);
  const data = summaryDataTokens(cleanForData)
    .map((token) => token.replace(/[.,;:]+$/, ''))
    .filter((token) => token && !context.includes(token))
    .slice(0, 6);
  const connector = summaryConnector(verb, clean);
  const safeTitle = title && !SUMMARY_META_RE.test(title) ? title : '';
  const lead = (context || safeTitle || 'En esta situación').replace(/[.;:]+$/, '').trim();
  const formulaPhrase = formulas.length ? ` Utiliza ${formulas.join(' y ')}.` : '';
  const dataPhrase = data.length ? ` Considera ${data.join(', ')}.` : '';
  const question = sentences.find((sentence) => /¿/.test(sentence));
  const questionText = question
    ? question.replace(/^¿([A-ZÁÉÍÓÚ])/, (_, letter: string) => `¿${letter.toLowerCase()}`)
    : '';
  let summary = questionText
    ? `${lead}.${formulaPhrase}${dataPhrase} ${questionText}`
    : `${lead}. ${connector} ${verb.toLowerCase()} ${taskObject}.${formulaPhrase}${dataPhrase}`;
  if (mathExpressions.length > 0) {
    const missing = mathExpressions.filter((expression) => !summary.includes(expression));
    if (missing.length > 0) summary += ` Datos: ${missing.join('; ')}.`;
  }
  return paraphraseSixGramOverlap(summary)
    .replace(/\s+/g, ' ')
    .trim();
}

function stripSessionLeadPrefix(value: string | null | undefined, topicLead?: string): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  let out = raw;
  let prev = '';
  while (out !== prev) {
    prev = out;
    out = out.replace(/^(?:sesi[oó]n\s*\d{1,2}\s*[:.\-–—]\s*)/i, '').trim();
  }
  if (topicLead && topicLead.length >= 10) {
    const escapedLead = topicLead.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const withoutLead = out.replace(new RegExp(`^${escapedLead}\\s*:\\s*`, 'i'), '').trim();
    if (withoutLead.length >= 16) {
      out = withoutLead;
    }
  }
  return out;
}

function deriveRepeatedTopicLead(session?: SessionPlan): string {
  if (!session) return '';
  const candidates = [session.objetivo, session.ejemploResuelto, session.practica?.[0]?.enunciado]
    .map((v) => stripSessionLeadPrefix(v))
    .filter(Boolean);
  const prefixes = new Map<string, number>();
  for (const cand of candidates) {
    const m = cand.match(/^([^:]{12,92}):\s+(.{18,})$/);
    if (!m) continue;
    const prefix = m[1].trim();
    if (/=/.test(prefix)) continue;
    if (/^(?:planteamiento|problema|enunciado|situaci[oó]n|paso\s*\d+|caso(?:\s+pr[aá]ctico)?|ejemplo|datos?|trabajo\s+colaborativo)/i.test(prefix)) {
      continue;
    }
    const key = prefix.toLowerCase();
    prefixes.set(key, (prefixes.get(key) ?? 0) + 1);
    if (prefixes.get(key)! >= 2) {
      return prefix;
    }
  }
  return '';
}

const SYNTHETIC_PARSER_STEP_RE =
  /^(?:identificar los (?:elementos, relaciones o datos clave|datos, conceptos o criterios iniciales) del planteamiento|desarrollar el procedimiento (?:correspondiente y comprobar la conclusi[oó]n|paso a paso y validar la conclusi[oó]n)|verificar la coherencia del resultado con el contexto planteado)\.?$/i;

export function extractConceptHighlights(
  mission: MissionSection,
  session?: SessionPlan,
  options: DistillOptions = {}
): DistilledConceptHighlights {
  const allowMission = options.allowMissionFallback ?? true;
  const visual = session?.sintesisVisual;
  const hasConjugatedPredicate = (value: string): boolean =>
    /\b(?:es|son|fue|fueron|constituye[ns]?|permite[ns]?|posibilita[ns]?|consiste[ns]?|facilita[ns]?|modela[ns]?|representa[ns]?|transforma[ns]?|integra[ns]?|garantiza[ns]?|utiliza[ns]?|emplea[ns]?|requiere[ns]?|exige[ns]?|describe[ns]?|calcula[ns]?|mide[ns]?|demuestra[ns]?|relaciona[ns]?|vincula[ns]?|organiza[ns]?|resuelve[ns]?|simplifica[ns]?|elimina[ns]?|despeja[ns]?|contrasta[ns]?|traduce[ns]?|proyecta[ns]?|consolida[ns]?|comunica[ns]?|muestra[ns]?|expresa[ns]?|determina[ns]?|establece[ns]?|identifica[ns]?|explica[ns]?|analiza[ns]?|eval[úu]a[ns]?|valida[ns]?|compara[ns]?|ayuda[ns]?|sirve[ns]?|ofrece[ns]?|aplica[ns]?|estudia[ns]?|define[ns]?|sustenta[ns]?|defiende[ns]?|articula[ns]?|formula[ns]?|construye[ns]?|propone[ns]?|argumenta[ns]?|combina[ns]?|distingue[ns]?|promueve[ns]?|fomenta[ns]?|genera[ns]?|produce[ns]?|respalda[ns]?|justifica[ns]?|contextualiza[ns]?|conecta[ns]?|clasifica[ns]?|ordena[ns]?|dise[ñn]a[ns]?|crea[ns]?|procesa[ns]?|estructura[ns]?|depura[ns]?|regula[ns]?|coordina[ns]?|interpreta[ns]?|opera[ns]?|act[úu]a[ns]?|funciona[ns]?|cambia[ns]?|var[ií]a[ns]?|tiene[ns]?|posee[ns]?|parte[ns]?|nace[ns]?|surge[ns]?|busca[ns]?|logra[ns]?|alcanza[ns]?|implica[ns]?|involucra[ns]?|abarca[ns]?|contiene[ns]?|incluye[ns]?|evita[ns]?|previene[ns]?|reduce[ns]?|aumenta[ns]?|eleva[ns]?|mejora[ns]?|fortalece[ns]?|asegura[ns]?|comprueba[ns]?|verifica[ns]?|sustituye[ns]?|se\s+[a-záéíóúñ]{3,})\b/i.test(
      value
    );
  let preservedVisualFormulas: string[] = [];
  if (visual) {
    const rawDefinition = sanitizePedagogicalMetaPhrases(cleanSacrintText(visual.conceptoBreve));
    const mapDef = sanitizePedagogicalMetaPhrases(cleanSacrintText(visual.mapaConceptual?.definicionClave));
    const definition =
      rawDefinition.length >= 30 && !hasDanglingEnding(rawDefinition) && hasConjugatedPredicate(rawDefinition)
        ? rawDefinition
        : mapDef.length >= 30 && !hasDanglingEnding(mapDef) && hasConjugatedPredicate(mapDef)
          ? mapDef
          : '';
    const formula = sanitizePedagogicalMetaPhrases(cleanSacrintText(visual.formulaOReglaClave));
    const map = visual.mapaConceptual;
    const visualFormulas = [
      ...(isValidRenderableFormula(formula) ? [formula] : []),
      ...extractFormulasFromText(visual.ejemploBreve?.planteamiento || '', 2),
    ].filter((item) => isValidRenderableFormula(item));
    preservedVisualFormulas = Array.from(new Set(visualFormulas)).slice(0, 3);
    const visualRules = [
      map?.criterioDesarrollo,
      map?.definicionClave,
      map?.correccionBreve,
    ]
      .map((item) => sanitizePedagogicalMetaPhrases(cleanSacrintText(item)))
      .filter(
        (item, index, arr) =>
          Boolean(item) &&
          item.length >= 24 &&
          !isRubricOrBoilerplateLeak(item) &&
          !hasDanglingEnding(item) &&
          arr.indexOf(item) === index
      )
      .slice(0, 3);
    if (definition.length >= 30) {
      return {
        definition,
        formulas: preservedVisualFormulas,
        keyRules: visualRules,
      };
    }
  }
  const topicLead = deriveRepeatedTopicLead(session);
  const coreExplanationRaw = cleanSacrintText(mission.conceptZero?.coreExplanation);
  const isCorePaecWrapper =
    /^(?:el\s+proyecto\b|la\s+elaboraci[oó]n\s+del\s+dossier\b|durante\s+esta\s+misi[oó]n\s+de\s+cierre)/i.test(coreExplanationRaw) &&
    extractFormulasFromText(coreExplanationRaw, 1).length === 0;
  const richMissionSession =
    !session && allowMission
      ? (mission.sessionPlans ?? []).find((s) => s.contenido && (extractFormulasFromText(s.contenido, 1).length > 0 || extractFormulasFromText(s.ejemploResuelto || '', 1).length > 0)) ||
        (mission.sessionPlans ?? [])[0]
      : undefined;
  const rawTheory =
    stripSessionLeadPrefix(session?.contenido, topicLead) ||
    (allowMission ? (!isCorePaecWrapper ? mission.conceptZero?.coreExplanation : richMissionSession?.contenido || mission.conceptZero?.coreExplanation) : '') ||
    '';
  const blocks = parseContenidoToBloques(rawTheory);
  const formulas: string[] = [...preservedVisualFormulas];
  const candidateTexts: string[] = [];

  for (const block of blocks) {
    const cleaned = sanitizePedagogicalMetaPhrases(stripSessionLeadPrefix(cleanSacrintText(block.texto), topicLead));
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
    session?.ejemploResuelto ||
    (allowMission
      ? [
          mission.conceptZero?.solvedExample?.problemStatement,
          ...(mission.conceptZero?.solvedExample?.solutionSteps ?? []),
          richMissionSession?.ejemploResuelto,
        ]
          .filter(Boolean)
          .join(' ')
      : '') ||
    '';
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
  const definition = allowMission
    ? conceptualDefSentence || distillConciseText(definitionSource, 200, 34)
    : pickCompleteSentences(definitionSource, 220, 1) ||
      conceptualDefSentence ||
      distillConciseText(definitionSource, 180, 26);

  const defNorm = definition.toLowerCase().replace(/[^a-záéíóúñ0-9]+/gi, ' ').trim();
  const defPrefix = defNorm.slice(0, 26);

  const rulePoolText = [
    ...candidateTexts,
    allowMission ? cleanSacrintText(mission.conceptZero?.coreExplanation) : '',
    analogyClean,
    !allowMission ? sanitizePedagogicalMetaPhrases(cleanSacrintText(stripSessionLeadPrefix(session?.saberesPrevios || session?.motivacion, topicLead))) : '',
  ]
    .filter(Boolean)
    .join(' ');
  const allCandidateRules = extractBulletSentences(rulePoolText, 6, 155).filter((r) => {
    const rNorm = r.toLowerCase().replace(/[^a-záéíóúñ0-9]+/gi, ' ').trim();
    if (
      r === definition ||
      r.length < 35 ||
      /^(?:en el contexto|de acuerdo con|por otro lado|asimismo)\b/i.test(r) ||
      isRubricOrBoilerplateLeak(r)
    ) {
      return false;
    }
    if (defPrefix && (rNorm.startsWith(defPrefix) || defNorm.includes(rNorm.slice(0, 26)))) return false;
    if (hasDanglingEnding(r)) return false;
    return (
      !/\by\s+experiencias\s+emp[ií]ricas\s+del\s+entorno\b/i.test(r) &&
      !/^(?:imagina\s+que|sup[oó]n\s+que|recuerda\s+cuando)\b/i.test(r)
    );
  });
  const keyRules = allCandidateRules.slice(0, 3);

  if (keyRules.length === 0 && analogyClean) {
    const analogyPoint = distillConciseText(analogyClean, 145, 25);
    if (analogyPoint && analogyPoint !== definition) keyRules.push(analogyPoint);
  }
  if (allowMission && keyRules.length === 0 && session?.objetivo) {
    const objRule = distillConciseText(session.objetivo, 110, 18);
    if (objRule) keyRules.push(objRule);
  }

  const fallbackDefinition = allowMission
    ? distillConciseText(mission.sessionFocus, 180, 30)
    : distillConciseText(session?.objetivo, 180, 30) || '';

  return {
    definition: definition || fallbackDefinition,
    formulas: formulas.filter(isValidRenderableFormula).slice(0, 3),
    keyRules: keyRules.slice(0, 3),
  };
}

const CONCLUSION_HEADING_PREFIX_RE =
  /^(?:(?:verificaci[oó]n|comprobaci[oó]n|interpretaci[oó]n|conclusi[oó]n|validaci[oó]n|cierre|evaluaci[oó]n|an[aá]lisis)[^.?!:=0-9]{0,65}[.:]\s*|(?:conclusi[oó]n(?:\s+y\s+verificaci[oó]n)?|verificaci[oó]n(?:\s+y\s+conclusi[oó]n)?|comprobaci[oó]n|respuesta\s+final)\s+(?=[A-ZÁÉÍÓÚÑ]))/i;

const META_CONCLUSION_INSTRUCTION_RE =
  /^(?:redacta|escribe|elabora|anota|presenta|prepara|entrega|documenta|incluye|comunica|revisa|verifica\s+en\s+tu)\s+(?:la\s+|una\s+|tu\s+|el\s+)?(?:conclusi[oó]n|respuesta|justificaci[oó]n|reporte|argumento|evidencia)\b/i;

const PROCEDURAL_CONCLUSION_FILLER_RE =
  /^(?:analizar|evaluar|revisar|comprobar|verificar|comparar|interpretar|discutir|reflexionar)\s+(?:la\s+coherencia|el\s+resultado|la\s+validez|los\s+datos|si\s+el\s+resultado|paso\s+a\s+paso)\b/i;

function isSubstantiveStep(candidate: string): boolean {
  const value = candidate.trim();
  if (value.length < 12) return false;
  if (NUMERIC_ONLY_STEP_RE.test(value)) return false;
  if (ORPHAN_LIST_END_RE.test(value)) return false;
  if (TEMPLATE_PHRASE_RE.test(value)) return false;
  // Exigir contenido lingüístico/pedagógico real (al menos 1 palabra alfabética si incluye cálculo/unidades, o >= 3 palabras en prosa)
  const alphaWords = value.match(/[A-Za-zÁÉÍÓÚÑáéíóúñ]{2,}/g) ?? [];
  if (/[=≈%]|\d/.test(value) ? alphaWords.length < 1 : alphaWords.length < 3) return false;
  if (
    /^(?:de acuerdo con el enunciado|analizar el significado|construir la ecuaci[oó]n|aplicar (?:la|las) propiedade?s?|realizar la operaci[oó]n|identificar (?:las )?variables)\b/i.test(
      value
    ) &&
    !/[=0-9]/.test(value)
  ) {
    return false;
  }
  return /[=0-9]/.test(value) || value.length >= 35;
}

function isSubstantiveConclusion(candidate: string): boolean {
  const trimmed = candidate.trim();
  if (trimmed.length < 16) return false;
  if (NUMERIC_ONLY_STEP_RE.test(trimmed)) return false;
  if (GENERIC_CONCLUSION_RE.test(trimmed)) return false;
  if (TEMPLATE_PHRASE_RE.test(trimmed)) return false;
  if (META_CONCLUSION_INSTRUCTION_RE.test(trimmed)) return false;
  if (PROCEDURAL_CONCLUSION_FILLER_RE.test(trimmed)) return false;
  if (/^\b(?:calcula|determina|encuentra|comprueba)\s+el\s+resultado\b/i.test(trimmed)) return false;
  if (/\bno\s+solo\b/i.test(trimmed) && !/\bsino\b/i.test(trimmed)) return false;
  return !hasDanglingEnding(trimmed);
}

function pickBestConclusionSentence(
  rawBlock: string,
  fitConclusion: (candidate: string) => string
): string {
  const withoutHeading = sanitizePedagogicalMetaPhrases(cleanStepLine(rawBlock))
    .replace(CONCLUSION_HEADING_PREFIX_RE, '')
    .trim();
  const sents = splitSpanishSentences(withoutHeading).filter(
    (s) => !META_CONCLUSION_INSTRUCTION_RE.test(s) && !PROCEDURAL_CONCLUSION_FILLER_RE.test(s)
  );
  if (sents.length === 0) return '';
  const prioritized =
    sents.find((s) => /\b(?:concluyendo|equivale|cuesta|puede|sobra|significa|m[áa]ximo|m[ií]nimo|intercep|listo|soluci[oó]n)\b|\d/i.test(s)) ||
    sents[0]!;
  const fitted = fitConclusion(prioritized);
  return isSubstantiveConclusion(fitted) ? fitted : '';
}

function extractExampleConclusion(
  rawExample: string,
  steps: string[],
  rawLastStep?: string,
  maxChars = 115,
  maxWords?: number
): string {
  const fitConclusion = (candidate: string) =>
    fitPedagogicalText(
      simplifyNumericEqualsChains(candidate.replace(CONCLUSION_HEADING_PREFIX_RE, '').trim()),
      { maxChars, maxWords, role: 'conclusion' }
    );

  const clean = sanitizePedagogicalMetaPhrases(stripRubricTail(cleanSacrintText(rawExample)));

  // 1. Buscar etiqueta explícita con resultado o conclusión real ("Respuesta final:", "Resultado final:", "Resultado verificable:", "Conclusión:" o "Conclusión.")
  const explicitMatch = clean.match(
    /(?:respuesta\s+final|resultado\s+(?:final|verificable|obtenido)|conclusi[oó]n(?:\s+final|\s+pedag[oó]gica)?|interpretaci[oó]n(?:\s+del\s+resultado)?)\s*[:.]\s*([^.?!]+(?:\.\d+[^.?!]*)*[.?!]?)/i
  );
  if (explicitMatch && explicitMatch[1]) {
    const candidate = fitConclusion(explicitMatch[1]);
    if (isSubstantiveConclusion(candidate)) return candidate;
  }

  // 2. Buscar oraciones completas con marcadores conclusivos claros en el ejemplo
  const allExampleSentences = splitSpanishSentences(clean)
    .map((s) =>
      cleanStepLine(s)
        .replace(CONCLUSION_HEADING_PREFIX_RE, '')
        .replace(/^(?:Graficar|Verificar|Comprobar|Interpretar|Analizar|Evaluar)\s*[.:]\s*/i, '')
        .trim()
    )
    .filter((s) => s.length >= 20 && !META_CONCLUSION_INSTRUCTION_RE.test(s) && !PROCEDURAL_CONCLUSION_FILLER_RE.test(s));

  const conclusiveSentence = [...allExampleSentences]
    .reverse()
    .find((s) =>
      /\b(?:concluimos\s+que|concluyes\s+que|se\s+concluye\s+que|por\s+lo\s+tanto|en\s+conclusi[oó]n|mostrando\s+que|validando\s+que|confirmando\s+(?:visualmente|anal[ií]ticamente|la)|esto\s+(?:demuestra|confirma|indica|muestra)|son\s+t[eé]cnicamente\s+viables|el\s+[aá]rea\s+m[aá]xima|el\s+ancho\s+v[aá]lido|ambos\s+[aá]ngulos\s+miden|estableciendo\s+el\s+nodo|permite\s+calcular\s+el\s+[aá]rea)\b/i.test(
        s
      )
    );
  if (conclusiveSentence) {
    const cleanedConcl = conclusiveSentence
      .replace(/^(?:Por\s+lo\s+tanto|En\s+conclusi[oó]n)\s*,?\s*/i, '')
      .replace(/^(?:Concluimos\s+que|Concluyes\s+que|Se\s+concluye\s+que)\s+/i, '');
    const normalizedConcl = cleanedConcl.charAt(0).toUpperCase() + cleanedConcl.slice(1);
    const candidate = fitConclusion(normalizedConcl);
    if (isSubstantiveConclusion(candidate)) return candidate;
  }

  // 3. Si existe un último paso crudo sustantivo con resultado concreto, extraer su oración conclusiva
  if (rawLastStep) {
    const picked = pickBestConclusionSentence(rawLastStep, fitConclusion);
    if (picked) return picked;
  }

  // 4. Si el texto incluye una cita de reflexión verificable entre comillas ("Aprendí que...")
  const quotedReflection = clean.match(/['"«](Aprend[ií]\s+que[^'"»]{18,160})['"»]/i);
  if (quotedReflection && quotedReflection[1]) {
    const stripped = quotedReflection[1].replace(/^Aprend[ií]\s+que\s+/i, '').trim();
    const capitalized = stripped.charAt(0).toUpperCase() + stripped.slice(1);
    const candidate = fitConclusion(capitalized);
    if (isSubstantiveConclusion(candidate)) return candidate;
  }

  // 5. Última oración sustantiva del ejemplo crudo (evitando repetir pasos o instrucciones meta)
  for (let i = allExampleSentences.length - 1; i >= Math.max(0, allExampleSentences.length - 3); i--) {
    const candidate = fitConclusion(allExampleSentences[i]!);
    if (isSubstantiveConclusion(candidate)) return candidate;
  }

  if (steps.length >= 2) {
    for (let idx = steps.length - 1; idx >= 0; idx--) {
      const picked = pickBestConclusionSentence(steps[idx]!, fitConclusion);
      if (picked) return picked;
    }
  }
  return '';
}

/**
 * Un paso matemático es completo si no termina colgado y contiene operación/igualdad real.
 * Rechaza pasos sintácticamente cerrados pero semánticamente cortados ("...que multiplicados.").
 */
export function isCompleteMathStep(step: string): boolean {
  const clean = (step || '').replace(/\s+/g, ' ').trim();
  if (!clean) return false;
  if (hasDanglingEnding(clean)) return false;
  const body = clean.replace(/[.;:]+$/, '').trim();

  // Un encabezado corto sin datos ni ecuación no es un paso resuelto.
  if (!/[=]|\d/.test(body) && body.length < 50) return false;

  if (
    /\b(?:multiplicad[oa]s|sumad[oa]s|obtenemos|obtenido|obtiene|resolver|sustituir|aplicamos|calculamos|despejamos|factorizamos|igualamos|completamos|resulta|queda|vale)\s*$/i.test(
      body
    )
  ) {
    return false;
  }
  if (/\by\s+[xyab]\s*$/.test(body)) return false;

  return (
    /=|[+\-*/^√]/.test(body) ||
    /\b(?:suma|resta|multiplica|divide|factoriza|sustituye|convierte|eval[uú]a|despeja|completa|traza|representa|grafica|clasifica|compara|argumenta|justifica|identifica|explica|analiza|relaciona|interpreta|distingue|localiza|señala|construye|dibuja|calcula|determina)\b/i.test(
      body
    )
  );
}

/** Conclusión completa: contiene un resultado numérico o afirmación conclusiva cerrada, sin variables colgadas. */
export function isCompleteConclusion(value: string): boolean {
  const clean = (value || '').replace(/\s+/g, ' ').trim();
  if (!clean || clean.length < 14) return false;
  if (hasDanglingEnding(clean)) return false;
  const body = clean.replace(/[.;:]+$/, '').trim();
  if (/^resultados?\s+obtenidos/i.test(body)) return false;
  if (/\by\s+[xy]\s*[₀₁₂₃₄₅₆₇₈₉\d]*\s*$/i.test(body)) return false;
  if (/=\s*$/.test(body)) return false;
  if (/\d/.test(body)) {
    return (
      /=\s*-?\d+(?:[.,]\d+)?/.test(body) ||
      /\b\d+(?:[.,]\d+)?\s*(?:m²|cm²|m|cm|mm|km|u|unidades|pesos|\$|°|grados|a[ñn]os|horas|sillas|personas|kits|m[oó]dulos|paquetes|equipos|j[oó]venes|familias|estudiantes|%)/i.test(body) ||
      /\$\s*\d/.test(body) ||
      /\b(?:es|son|equivale|satisface|obtiene|resulta|alcanza|confirma|demuestra|permite|representa|vale)\b/i.test(body)
    );
  }
  return (
    clean.length >= 24 &&
    !META_CONCLUSION_INSTRUCTION_RE.test(clean) &&
    /\b(?:es|son|demuestra|confirma|indica|muestra|valida|permite|concluye|significa|representa|cumple|evita|garantiza|refleja|revela|satisface|equivale|corresponde)\b/i.test(
      body
    )
  );
}

/** Enunciado de ejemplo completo: datos + unidad/contexto + consigna o pregunta. */
export function isCompleteProblemStatement(value: string): boolean {
  const clean = (value || '').replace(/\s+/g, ' ').trim();
  if (clean.length < 20) return false;
  if (hasDanglingEnding(clean)) return false;

  const hasTask =
    /\?/.test(clean) ||
    /\b(?:calcula|determina|encuentra|halla|resuelve|modela|plantea|formula|indica|escribe|delimita(?:r)?|diseña|traza|clasifica|compara|argumenta|justifica|identifica|explica|analiza|relaciona|interpreta|distingue|localiza|señala(?:r)?|completa|obt[eé]n|verifica|demuestra|eval[uú]a|convierte|sustituye|suma|resta|multiplica|divide|despeja|representa|grafica|mide|analizar|identificar|relacionar|explicar|justificar|comparar|argumentar|interpretar|clasificar|describir|leer|señalar|sustentar)\b/i.test(
      clean
    );
  const hasDeclarativeSetup =
    /[=:]/.test(clean) &&
    (/\d/.test(clean) ||
      /\b(?:an[aá]lisis|balance|proceso|caso|situaci[oó]n|planteamiento|modelo|fen[oó]meno|art[ií]culo|fuente|texto)\b/i.test(
        clean
      ));
  if (!hasTask && !hasDeclarativeSetup && !(/\d/.test(clean) && clean.length >= 60)) return false;

  const hasNumericData =
    /\d/.test(clean) &&
    /(?:[=+*/^$\u00B0\u00B2]|\b(?:m|cm|mm|km|kg|g|l|ml|pesos|unidades|horas|años|personas|sillas)\b)/i.test(
      clean
    );
  const hasDisciplinaryContext =
    /\b(?:figura|triángulo|angulo|ángulo|tabla|gráfica|grafica|texto|caso|situación|problema|proceso|diagrama|mapa|experimento|fuente|concepto|ejemplo|modelo|conjunto|función|funcion|ecuación|ecuacion|artículo|articulo|balance|fenómeno|fenomeno|planteamiento)\b/i.test(
      clean
    );

  return hasNumericData || hasDisciplinaryContext || (/\d/.test(clean) && clean.length >= 60);
}

/** Un error común genérico no explica ningún error conceptual real. */
export function isGenericMisconception(value: string): boolean {
  const clean = (value || '').trim();
  if (clean.length < 25) return true;
  return /^(?:resultados?\s+obtenidos|error\s+com[uú]n|revisar|analizar|evaluar|comprobar|verificar)\b/i.test(clean);
}

interface ExampleBudgets {
  stmtBudget: number;
  stmtWords?: number;
  stepBudget: number;
  stepWords?: number;
  interpBudget: number;
  interpWords?: number;
}

/**
 * Construye un ejemplo resuelto desde la práctica de la sesión cuando el ejemplo original
 * está incompleto. Prefiere ejercicios que no se muestran como actividad (índice >= 2) para
 * no duplicar la consigna. Solo devuelve un ejemplo con enunciado completo, >= 2 pasos
 * matemáticos completos y conclusión con resultado; si no, null.
 */
function buildExampleFromPractice(
  session: SessionPlan | undefined,
  topicLead: string,
  b: ExampleBudgets
): DistilledExample | null {
  const items = session?.practica ?? [];
  if (items.length === 0) return null;
  const order = [...items.keys()].sort((a, c) => {
    const aShown = a < 2 ? 1 : 0;
    const cShown = c < 2 ? 1 : 0;
    return aShown - cShown || a - c;
  });
  for (const idx of order) {
    const item = items[idx]!;
    const solution = (item.solucion ?? []).map(cleanStepLine).filter((l) => l.length >= 8);
    if (solution.length < 2) continue;
    const statement = distillExerciseStatement(stripSessionLeadPrefix(item.enunciado, topicLead), b.stmtBudget, b.stmtWords);
    if (!isCompleteProblemStatement(statement)) continue;
    const mathSteps = solution
      .map((l) => distillStepPreservingMath(l, b.stepBudget, b.stepWords))
      .filter(Boolean)
      .filter((l) => isSubstantiveStep(l) && isCompleteMathStep(l));
    if (mathSteps.length < 2) continue;
    const conclusionRaw = [...solution]
      .reverse()
      .map((l) =>
        fitPedagogicalText(simplifyNumericEqualsChains(l.replace(CONCLUSION_HEADING_PREFIX_RE, '').trim()), {
          maxChars: b.interpBudget,
          maxWords: b.interpWords,
          role: 'conclusion',
        })
      )
      .find((c) => isSubstantiveConclusion(c) && isCompleteConclusion(c));
    if (!conclusionRaw) continue;
    return {
      problemStatement: statement,
      steps: mathSteps.slice(0, 3),
      interpretation: conclusionRaw,
    };
  }
  return null;
}

function buildCompleteSlideProblemStatement(
  raw: string | null | undefined,
  topicLead: string,
  stmtBudget: number,
  stmtWords?: number
): string {
  const clean = stripSessionLeadPrefix(cleanSacrintText(raw), topicLead);
  if (!clean) return '';
  const hasData = /\d|\$|pesos|m\b|cm\b/i.test(clean);
  const finalize = (candidate: string): string =>
    candidate && (!hasData || /\d|\$|pesos|m\b|cm\b/i.test(candidate))
      ? candidate
      : clean;
  const sentences = splitSpanishSentences(clean).filter((sentence) => sentence.trim().length >= 18);
  const isTask = (sentence: string) =>
    /\?/.test(sentence) ||
    /\b(?:calcula|determina|encuentra|halla|resuelve|modela|plantea|formula|indica|escribe|obt[eé]n|verifica|comprueba|justifica|identifica)\b/i.test(
      sentence
    );
  const taskSentence = sentences.find((sentence) => isTask(sentence) && /\d|\$|pesos|m\b|cm\b/i.test(sentence));
  if (taskSentence) {
    return finalize(distillProblemOrExerciseText(taskSentence, stmtBudget, stmtWords));
  }

  const dataSentence = [...sentences]
    .reverse()
    .find((sentence) => /\d|\$|pesos|m\b|cm\b/i.test(sentence) && sentence !== taskSentence);
  const taskWithoutData = sentences.find(isTask);
  if (taskWithoutData && dataSentence) {
    return finalize(
      distillProblemOrExerciseText(`${dataSentence} ${taskWithoutData}`, stmtBudget, stmtWords)
    );
  }

  return finalize(distillProblemOrExerciseText(clean, stmtBudget, stmtWords));
}

/**
 * Extrae el ejemplo resuelto con pasos reales evitando fugas de rúbrica y mensajes vacíos.
 */
function deriveInlineExampleSteps(raw: string): string[] {
  const clauses = raw
    .replace(/^(?:ejemplo|planteamiento|problema|soluci[oó]n)\s*:\s*/i, '')
    .split(
      /(?<=[.;:])\s+|,\s+(?=(?:resta|suma|multiplica|divide|despeja|sustituye|obt[eé]n|calcula|iguala|factoriza|aplica|usa|convierte|eleva)\b)|\s+y\s+(?=(?:obt[eé]n|divide|multiplica|suma|resta|despeja|sustituye)\b)/i
    )
    .map((clause) => cleanStepLine(clause))
    .filter((clause) => clause.length >= 8 && /=/.test(clause) && isCompleteMathStep(clause));
  return clauses.slice(0, 3);
}

export function extractWorkedExample(
  mission: MissionSection,
  session?: SessionPlan,
  options: DistillOptions = {}
): DistilledExample {
  const allowMission = options.allowMissionFallback ?? true;
  const visualExample = session?.sintesisVisual?.ejemploBreve;
  if (visualExample) {
    const problemStatement = stripTemplateLabels(
      sanitizePedagogicalMetaPhrases(cleanSacrintText(visualExample.planteamiento))
    );
    const steps = (visualExample.pasos ?? [])
      .map((step) => stripTemplateLabels(sanitizePedagogicalMetaPhrases(cleanSacrintText(step))))
      .filter(
        (step) =>
          step.length >= 12 &&
          !NUMERIC_ONLY_STEP_RE.test(step) &&
          !ORPHAN_LIST_END_RE.test(step) &&
          !isRubricOrBoilerplateLeak(step) &&
          !hasDanglingEnding(step)
      )
      .slice(0, 3);
    const interpretation = stripTemplateLabels(
      sanitizePedagogicalMetaPhrases(cleanSacrintText(visualExample.conclusion))
    );
    // Eliminar etiquetas estructurales ("Paso 1", "Sesión 2", "Nivel 3") antes de juzgar
    // si el ejemplo de la sesión es realmente cuantitativo; de lo contrario, toda sesión
    // humanística/social/inglés parecería matemática solo por contener "Paso 1".
    const exampleWithoutStepLabels = (session?.ejemploResuelto || '').replace(
      /\b(?:paso|sesi[oó]n|nivel|etapa|fase|criterio|bloque|corte|p[aá]rrafo|art[ií]culo)\s*\d+\b/gi,
      ''
    );
    // Distinguir cálculos matemáticos/ecuaciones reales de menciones incidentales de hardware o tiempo
    // ("16GB", "5 minutos", "0.5 gramos"), para no descartar sintesisVisual.ejemploBreve en sesiones técnicas.
    const hasSessionQuantitativeExample = Boolean(
      exampleWithoutStepLabels &&
        /(?:[=±≈]\s*-?\d)|(?:\d+(?:[.,]\d+)?\s*[=±≈×÷*/+-]\s*\d)|√/.test(exampleWithoutStepLabels)
    );
    const visualStepsHaveMath =
      steps.some((step) => /[=≤≥]|\d/.test(step)) ||
      /[=≤≥]|\d/.test(`${problemStatement} ${interpretation} ${session?.sintesisVisual?.formulaOReglaClave ?? ''}`);
    const visualHasEquation = /=/.test(`${problemStatement} ${steps.join(' ')}`);
    const extractSigNums = (text: string): string[] =>
      [...new Set((text.match(/\d[\d.,]*/g) ?? []).map((n) => n.replace(/,/g, '')).filter((n) => n !== '1' && n !== '2' && n !== '3'))];
    const visualNums = extractSigNums(`${problemStatement} ${steps.join(' ')} ${interpretation}`);
    const sessionNums = new Set(extractSigNums(exampleWithoutStepLabels));
    const sharedNumericCount = visualNums.filter((n) => sessionNums.has(n)).length;
    const visualSharesSameProblemNumbers =
      visualNums.length === 0 ||
      sharedNumericCount >= Math.min(2, visualNums.length);
    const extractedSrcEq = exampleWithoutStepLabels
      ? extractCompleteEquations(exampleWithoutStepLabels)[0]?.trim()
      : undefined;
    const isTrivialSingleVarAssignment = Boolean(
      extractedSrcEq &&
        /^[A-Za-zÁÉÍÓÚÑáéíóúñ]{1,4}\s*=\s*-?\d+(?:[.,]\d+)?\s*(?:mm|cm|m|km|g|kg|mg|ml|l|s|min|h|°|%)?$/i.test(
          extractedSrcEq
        )
    );
    const eqSigNums = extractedSrcEq ? extractSigNums(extractedSrcEq) : [];
    const eqNumbersMatchVisual =
      eqSigNums.length === 0 ||
      (visualNums.length > 0 && eqSigNums.every((n) => visualNums.includes(n)));
    const sessionHasEquation = Boolean(extractedSrcEq && !isTrivialSingleVarAssignment && eqNumbersMatchVisual);
    if (
      !visualHasEquation &&
      visualSharesSameProblemNumbers &&
      !isTrivialSingleVarAssignment &&
      eqNumbersMatchVisual &&
      steps.length > 0 &&
      extractedSrcEq
    ) {
      const openCount = (extractedSrcEq.match(/\(/g) || []).length;
      const closeCount = (extractedSrcEq.match(/\)/g) || []).length;
      if (
        extractedSrcEq.length >= 5 &&
        extractedSrcEq.length <= 42 &&
        openCount === closeCount &&
        !hasDanglingEnding(extractedSrcEq)
      ) {
        const targetIdx = Math.min(1, steps.length - 1);
        steps[targetIdx] = `${steps[targetIdx]!.replace(/[.]+$/, '')} (${extractedSrcEq}).`;
      }
    }
    if (steps.length === 2) {
      const rawStep3 =
        visualSharesSameProblemNumbers && session?.ejemploResuelto
          ? cleanStepLine(
              parseEjemploResuelto(cleanSacrintTextPreservingLines(session.ejemploResuelto)).pasos[2] ?? ''
            )
          : '';
      const candidate3 =
        rawStep3 && rawStep3.length >= 12 && !hasDanglingEnding(rawStep3)
          ? distillStepPreservingMath(rawStep3, 105, 15)
          : `Verifica el resultado en el contexto: ${interpretation.replace(/[.]+$/, '')}.`;
      if (candidate3 && candidate3.length >= 12 && !hasDanglingEnding(candidate3)) {
        steps.push(candidate3);
      }
    }
    const hasAdequateContext =
      problemStatement.length >= 24 &&
      !hasDanglingEnding(problemStatement) &&
      problemStatement.split(/\s+/).filter(Boolean).length >= 5;
    const hasAdequateConclusion =
      interpretation.length >= 14 && !hasDanglingEnding(interpretation);
    if (
      hasAdequateContext &&
      steps.length >= 2 &&
      hasAdequateConclusion &&
      (!hasSessionQuantitativeExample || visualStepsHaveMath || sessionHasEquation)
    ) {
      return {
        problemStatement,
        steps,
        interpretation,
      };
    }
  }
  const topicLead = deriveRepeatedTopicLead(session);
  const solved = allowMission ? mission.conceptZero?.solvedExample : undefined;
  const rawSessionExample = stripSessionLeadPrefix(session?.ejemploResuelto, topicLead);
  const stmtBudget = allowMission ? 245 : 400;
  const stmtWords = allowMission ? undefined : 80;
  const stepBudget = allowMission ? 180 : 110;
  const stepWords = allowMission ? undefined : 16;
  const interpBudget = 165;
  const interpWords = allowMission ? undefined : 24;

  if (rawSessionExample && !isRubricOrBoilerplateLeak(rawSessionExample)) {
    const preservedSessionExample = cleanSacrintTextPreservingLines(rawSessionExample);
    const cleanedSessionExample = cleanSacrintText(rawSessionExample);
    const parsed = parseEjemploResuelto(preservedSessionExample);
    const parsedStatement = parsed.enunciado.trim();
    const rawBeforeFirstStep = /\bPaso\s*1\s*[:.\-]/i.test(preservedSessionExample)
      ? preservedSessionExample
          .replace(/^(?:planteamiento|problema|enunciado|situaci[oó]n)\s*:\s*/i, '')
          .split(/\bPaso\s*1\s*[:.\-]/i)[0]
          .trim()
      : parsedStatement;
    const statementSource =
      hasDanglingEnding(parsedStatement) || rawBeforeFirstStep.length > parsedStatement.length + 20
        ? rawBeforeFirstStep
        : parsedStatement;
    const rawStatement = allowMission
      ? distillProblemOrExerciseText(stripSessionLeadPrefix(statementSource, topicLead), stmtBudget, stmtWords)
      : buildCompleteSlideProblemStatement(statementSource, topicLead, stmtBudget, stmtWords);
    const statement = rawStatement;
    const cleanedRawSteps = parsed.pasos
      .map(cleanStepLine)
      .filter((step) => step.length >= 8 && !SYNTHETIC_PARSER_STEP_RE.test(step) && !isRubricOrBoilerplateLeak(step));

    const stepCandidates =
      !allowMission && cleanedRawSteps.length >= 4 ? cleanedRawSteps.slice(0, -1) : cleanedRawSteps;
    const eqAfterFirst = stepCandidates.slice(1).filter((step) => /=/.test(step)).slice(0, 2);
    const selectedRawSteps =
      !allowMission && stepCandidates.length >= 4 && eqAfterFirst.length >= 2
        ? [stepCandidates[0]!, ...eqAfterFirst]
        : stepCandidates.slice(0, 3);
    const steps = selectedRawSteps
      .map((step) => distillStepPreservingMath(step, stepBudget, stepWords))
      .filter(Boolean)
      .filter(isSubstantiveStep)
      .filter((step) => allowMission || isCompleteMathStep(step))
      .slice(0, allowMission ? 4 : 3);
    if (!allowMission && cleanedRawSteps.length >= 4) {
      const solutionRe = /\b[a-z]\s*=\s*-?\d+(?:[.,]\d+)?(?!\s*[/\\])/i;
      if (!steps.some((step) => solutionRe.test(step))) {
        const lastRaw = cleanedRawSteps[cleanedRawSteps.length - 1]!;
        const solutionSentence = [...splitSpanishSentences(lastRaw)]
          .reverse()
          .find((sentence) => solutionRe.test(sentence));
        if (solutionSentence) {
          const solutionStep = distillStepPreservingMath(cleanStepLine(solutionSentence), stepBudget, stepWords);
          if (solutionStep && !steps.includes(solutionStep)) steps.push(solutionStep);
        }
      }
    }
    // Nunca sustituir un ejemplo resuelto completo por un ejercicio de práctica:
    // eso cambia el planteamiento y rompe la coherencia ejemplo↔pasos.
    const mappedRawSteps = selectedRawSteps
      .map((step) => distillStepPreservingMath(step, stepBudget, stepWords))
      .filter(Boolean);
    const validatedRawSteps = mappedRawSteps
      .filter(isSubstantiveStep)
      .filter(isCompleteMathStep)
      .slice(0, allowMission ? 4 : 3);
    const rawFallbackSteps =
      validatedRawSteps.length >= 2
        ? validatedRawSteps
        : mappedRawSteps.slice(0, allowMission ? 4 : 3);
    const effectiveSteps = steps.length >= 2 ? steps : rawFallbackSteps;
    const mathSteps = effectiveSteps.filter((step) => /[=]|\d/.test(step));
    const parsedSteps = mathSteps.length >= 2 ? mathSteps : effectiveSteps;
    const inlineSteps =
      !allowMission && parsedSteps.length < 2 ? deriveInlineExampleSteps(preservedSessionExample) : [];
    const preferredSteps = parsedSteps.length >= 2 ? parsedSteps : inlineSteps;

    // Gu��a de sesi��n: un ejemplo con menos de 2 pasos completos o sin enunciado completo
    // no se renderiza (el writer debe repararlo en origen; no se maquilla en la diapositiva).
    if (!allowMission && (preferredSteps.length < 2 || statement.trim().length < 12)) {
      const fromPractice = buildExampleFromPractice(session, topicLead, {
        stmtBudget,
        stmtWords,
        stepBudget,
        stepWords,
        interpBudget,
        interpWords,
      });
      if (fromPractice) return fromPractice;
      return { problemStatement: '', steps: [], interpretation: '' };
    }

    if (preferredSteps.length > 0) {
      const fourthRawStep = cleanedRawSteps.length >= 4 ? cleanedRawSteps[cleanedRawSteps.length - 1] : undefined;
      const derivedConclusion = extractExampleConclusion(rawSessionExample, preferredSteps, fourthRawStep, interpBudget, interpWords);
      const lastStepNorm = (preferredSteps[preferredSteps.length - 1] ?? '').toLowerCase().replace(/[^a-z0-9áéíóúñ]+/gi, ' ').trim();
      const conclNorm = (derivedConclusion ?? '').toLowerCase().replace(/[^a-z0-9áéíóúñ]+/gi, ' ').trim();
      const isDuplicateConclusion =
        !allowMission
          ? Boolean(conclNorm && lastStepNorm && conclNorm === lastStepNorm)
          : Boolean(conclNorm && lastStepNorm && (conclNorm === lastStepNorm || lastStepNorm.includes(conclNorm)));
      const fallbackSubstantive = [...cleanedRawSteps]
        .reverse()
        .map((s) =>
          fitPedagogicalText(simplifyNumericEqualsChains(s.replace(CONCLUSION_HEADING_PREFIX_RE, '').trim()), {
            maxChars: interpBudget,
            maxWords: interpWords,
            role: 'conclusion',
          })
        )
        .find((c) => isSubstantiveConclusion(c));
      const cleanInterpretation =
        !isDuplicateConclusion && derivedConclusion && isSubstantiveConclusion(derivedConclusion)
          ? derivedConclusion
          : fallbackSubstantive && (!lastStepNorm || fallbackSubstantive.toLowerCase().replace(/[^a-z0-9áéíóúñ]+/gi, ' ').trim() !== lastStepNorm)
            ? fallbackSubstantive
            : '';
      const explicitConclusion = rawSessionExample.match(
        /(?:conclusi[oó]n|respuesta\s+final|resultado(?:\s+final)?)\s*:\s*\n?\s*([^.?!]+(?:\.\d+[^.?!]*)*[.?!]?)/i
      )?.[1];
      const fittedExplicitConclusion = explicitConclusion
        ? fitPedagogicalText(stripTemplateLabels(explicitConclusion.trim()), {
            maxChars: interpBudget,
            maxWords: interpWords,
            role: 'conclusion',
          })
        : '';
      const solvedResultToken = [...preferredSteps]
        .reverse()
        .map((step) => step.match(/\b(?:[A-Za-z][₀-₉0-9]?)\s*[=≈]\s*[-+]?\d+(?:[.,]\d+)?(?:\s*(?:m²?|cm|km|%|°|pesos|metros|horas|años|unidades))?/i)?.[0])
        .find(Boolean);
      // Nunca usar conclusiones genéricas ("El procedimiento confirma la relación planteada...").
      // Si no hay conclusión sustantiva real, devolver vacío para que el caller valide/falle.
      const resultGroundedFallback = solvedResultToken
        ? `El resultado obtenido (${solvedResultToken.trim()}) responde al planteamiento inicial.`
        : '';
      return {
        problemStatement:
          statement ||
          (allowMission ? distillProblemOrExerciseText(solved?.problemStatement, stmtBudget, stmtWords) : '') ||
          distillConciseText(stripSessionLeadPrefix(session?.objetivo, topicLead), 82, 13) ||
          '',
        steps: preferredSteps
          .map((s) => stripTemplateLabels(s))
          .filter(
            (s) =>
              s.length >= 12 &&
              !NUMERIC_ONLY_STEP_RE.test(s) &&
              !ORPHAN_LIST_END_RE.test(s) &&
              !TEMPLATE_PHRASE_RE.test(s)
          ),
        interpretation:
          (allowMission || isCompleteConclusion(cleanInterpretation) ? cleanInterpretation : '') ||
          (fittedExplicitConclusion && isSubstantiveConclusion(fittedExplicitConclusion)
            ? fittedExplicitConclusion
            : '') ||
          (allowMission ? distillConciseText(solved?.interpretation, interpBudget, interpWords ?? 26) : '') ||
          resultGroundedFallback,
      };
    }

    if (!allowMission && cleanedSessionExample) {
      const bulletSteps = extractBulletSentences(cleanedSessionExample, 2, stepBudget)
        .filter((b) => b.toLowerCase() !== statement.toLowerCase() && !statement.toLowerCase().includes(b.toLowerCase()))
        .map((bullet) =>
          fitPedagogicalText(bullet, {
            maxChars: stepBudget,
            maxWords: stepWords,
            role: 'step',
          })
        )
        .filter(Boolean);
      const clauseFocus = cleanedSessionExample.match(/,\s*((?:identificando|aplicando|analizando|comparando|evaluando|justificando|distinguiendo|calculando|construyendo)[^.?!]{10,})$/i);
      const derivedActionStep =
        clauseFocus?.[1]
          ? fitPedagogicalText(
              clauseFocus[1].charAt(0).toUpperCase() + clauseFocus[1].slice(1).replace(/ando\b/i, 'a').replace(/endo\b/i, 'e'),
              { maxChars: stepBudget, maxWords: stepWords, role: 'step' }
            )
          : '';
      const effectiveSteps =
        bulletSteps.length >= 1
          ? bulletSteps
          : derivedActionStep
            ? [derivedActionStep]
            : [];
      const explicitConclusion = extractExampleConclusion(rawSessionExample, effectiveSteps, undefined, interpBudget, interpWords);
      const conclNorm = (explicitConclusion ?? '').toLowerCase().replace(/[^a-z0-9áéíóúñ]+/gi, ' ').trim();
      const lastNorm = (effectiveSteps[effectiveSteps.length - 1] ?? '').toLowerCase().replace(/[^a-z0-9áéíóúñ]+/gi, ' ').trim();
      const cleanConclusion = conclNorm && conclNorm !== lastNorm ? explicitConclusion : '';
      return {
        problemStatement:
          statement ||
          distillProblemOrExerciseText(cleanedSessionExample, stmtBudget, stmtWords) ||
          distillConciseText(stripSessionLeadPrefix(session?.objetivo, topicLead), 72, 11),
        steps: effectiveSteps,
        interpretation: cleanConclusion,
      };
    }
  }

  if (!allowMission) {
    const derivedTopicFocus = distillConciseText(
      stripSessionLeadPrefix(session?.contenido || session?.objetivo),
      stmtBudget,
      stmtWords
    );
    return {
      problemStatement: derivedTopicFocus || '',
      steps: [],
      interpretation: '',
    };
  }

  const rawMissionSteps = (solved?.solutionSteps ?? [])
    .map(cleanStepLine)
    .filter((s) => s.length >= 6 && !isRubricOrBoilerplateLeak(s));
  const missionSteps = rawMissionSteps
    .map((s) => distillStepPreservingMath(s, 185))
    .filter(Boolean)
    .filter(isSubstantiveStep)
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
      .filter(isSubstantiveStep)
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
  const solvedInterpretation = distillConciseText(solved?.interpretation, 165, 28);

  return {
    problemStatement: cleanStatement,
    steps: derivedSteps,
    interpretation:
      (solvedInterpretation && isSubstantiveConclusion(solvedInterpretation)
        ? solvedInterpretation
        : '') ||
      extractExampleConclusion(demoRaw, derivedSteps, fourthMissionStep) ||
      'Comunica la conclusión con evidencia y contrástala con el contexto real de la situación.',
  };
}

/**
 * Sintetiza el enunciado de un ejercicio preservando los datos numéricos, ecuaciones y la pregunta/consigna.
 */
export function distillExerciseStatement(rawEnunciado: string | null | undefined, maxChars = 220, maxWords?: number): string {
  const rawSourceClean = sanitizePedagogicalMetaPhrases(
    cleanSacrintText(rawEnunciado)
      .replace(/^(?:planteamiento|problema|enunciado|situaci[oó]n|ejercicio|actividad)\s*\d*\s*[:.\-–]\s*/i, '')
      .trim()
  );
  const impMap: Record<string, string> = {
    determinar: 'Determina',
    calcular: 'Calcula',
    hallar: 'Halla',
    averiguar: 'Calcula',
    encontrar: 'Encuentra',
  };
  let clean = sanitizePedagogicalMetaPhrases(
    cleanSacrintText(rawEnunciado)
      .replace(/^(?:planteamiento|problema|enunciado|situaci[oó]n|ejercicio|actividad)\s*\d*\s*[:.\-–]\s*/i, '')
      .replace(/\b(\d[\d.,]*)\s+pesos\b/gi, (_m, n: string, offset: number, whole: string) => {
        const before = whole.slice(0, offset).replace(/\s+$/, '');
        return before.endsWith('$') ? _m : `$${n}`;
      })
      .replace(/\bmetros\s+cuadrados\b/gi, 'm²')
      .replace(/\b(\d+(?:[.,]\d+)?)\s+metros\b/gi, '$1 m')
      .replace(/\b(\d+(?:[.,]\d+)?)\s+grados\b/gi, '$1°')
      .replace(/\b(\d+(?:[.,]\d+)?)\s+gramos\b/gi, '$1 g')
      .replace(/\b(\d+(?:[.,]\d+)?)\s+mililitros\b/gi, '$1 mL')
      .replace(/\b(\d+(?:[.,]\d+)?)\s+litros\b/gi, '$1 L')
      .replace(/,?\s*(?:apoy[aá]ndote\s+en|con\s+ayuda\s+de)\s+tu\s+(?:\[\[?material:[^\]\s]+\]?\]?|calculadora\s+cient[ií]fica|regla\s+graduada|juego\s+de\s+geometr[ií]a)[^.,;?]*\s*/gi, ' ')
      .replace(/\bque\s+representa\s+el\s+comportamiento\s+de\s+un\s+indicador\s+de\s+bienestar\s+comunitario\s+en\s+funci[oó]n\s+de\s+una\s+variable\s+de\s+escala\s+[a-z]\b/gi, '')
      .replace(/\basociada\s+al\s+dise[ñn]o\s+de\s+una\s+estructura\s+recreativa\b/gi, '')
      .replace(/\bderivada\s+del\s+dise[ñn]o\s+de\s+una\s+zona\s+verde\s+comunitaria\b/gi, '')
      .replace(/\bpara\s+un\s+centro\s+recreativo\s+juvenil(?:\s+en\s+Puebla)?\b/gi, '')
      .replace(/\butilizando\s+el\s+concepto\s+de\s+ecuaci[oó]n\s+cuadr[aá]tica\b/gi, '')
      .replace(/\ba\s+su\s+forma\s+polin[oó]mica\s+est[aá]ndar\s+con\s+coeficientes\s+enteros\b/gi, 'a ax² + bx + c = 0 entera')
      .replace(/,?\s*y\s+determina\s+los\s+valores\s+num[eé]ricos\s+exactos\s+de\s+sus\s+coeficientes\s+a,\s*b\s+y\s+c\b/gi, ' e indica a, b y c')
      .replace(/\by\s+especifica\s+los\s+valores\s+de\s+a,\s*b\s+y\s+c\b/gi, 'e indica a, b y c')
      .replace(/\bTransforma\s+la\s+siguiente\s+ecuaci[oó]n\s+algebraica\s+polin[oó]mica\s+a\s+su\s+forma\s+(?:general|completa)\s+([^:]+):/gi, 'Transforma a forma general $1:')
      .replace(/\bTransforma\s+esta\s+ecuaci[oó]n\s+a\s+ax²/gi, 'Convierte a ax²')
      .replace(/\b(?:plantea\s+y\s+resuelve|construye)\s+una\s+ecuaci[oó]n\s+(?:de\s+primer\s+grado|lineal|cuadr[aá]tica)\s+para\s+(determinar|calcular|hallar|averiguar|encontrar)\b/gi, (_m, v: string) => {
        const key = v.toLowerCase();
        return (Object.hasOwn(impMap, key) ? impMap[key] : v).toLowerCase();
      })
      .replace(/\b(?:Utiliza|Aplica)\s+el\s+m[eé]todo\s+de\s+([a-záéíóúñ]+)\s+para\s+(?:determinar|calcular)\s+el\s+costo\s+(?:unitario\s+exacto\s+)?de\s+cada\s+([^.\n]+?)\s+y\s+de\s+cada\s+([^.\n?]+)\.?/gi, 'Por $1, calcula costo de $2 y $3.')
      .replace(/\bSi\s+el\s+presupuesto\s+destinado\s+para\s+el\s+evento\s+es\s+de\s+/gi, 'Con presupuesto de ')
      .replace(/\bSi\s+se\s+sabe\s+que\s+el\s+largo(?:\s+del\s+jard[ií]n)?\s+debe\s+ser\s+(\d+)\s*m\s+mayor\s+que\s+su\s+ancho\b/gi, 'Si el largo supera en $1 m al ancho')
      .replace(/\bSi\s+el\s+dise[ñn]o\s+exige\s+que\s+el\s+largo\s+sea\s+el\s+cu[aá]druple\s+del\s+ancho\b/gi, 'Si el largo es 4 veces el ancho')
      .replace(/\by\s+el\s+gasto\s+total\s+ascendi[oó]\s+a\s+/gi, 'y gasto total de ')
      .replace(/\bdetermina\s+las\s+dimensiones\s+exactas(?:\s+del\s+jard[ií]n)?\b/gi, 'halla las dimensiones')
      .replace(/\bcalcula\s+las\s+dimensiones\s+de\s+la\s+zona\s+para\s+que\s+el\s+[aá]rea\s+sea\s+exactamente\s+la\s+requerida\b/gi, 'calcula dimensiones')
      .replace(/\bpara\s+completar\s+el\s+costo\s+total(?=\s*\?)/gi, '')
      .replace(/\b(?:en\s+la\s+compra|en\s+total)(?=[.?]|$)/gi, '')
      .replace(/\bdeben\s+unirse\s+al\s+equipo\s*\?/gi, 'faltan?')
      .replace(/\bAlguien\s+despej[oó]\s+[^.?]+?,\s*obtuvo\s+([^.?]+)\./gi, 'Se obtuvo $1.')
      .replace(/\bLuego,\s*dibuja\s+las\s+rectas\s+en\s+papel\s+milimetrado\s+para\s+verificar\s+el\s+punto\s+de\s+intersecci[oó]n\.?/gi, 'Verifica graficando la intersección.')
      .replace(/\bCalcula\s+anal[ií]ticamente\s+las\s+coordenadas\s+del\s+v[eé]rtice,\s*las\s+intersecciones\s+con\s+los\s+ejes\s+coordenados,\s*elabora\s+una\s+tabulaci[oó]n\s+de\s+(\d+)\s+puntos\s+y\s+describe\s+la\s+forma\s+de\s+su\s+l[aá]mina\s+gr[aá]fica\.?/gi, 'Calcula vértice, cortes y tabula $1 puntos.')
      .replace(/\bpara\s+hallar\s+las\s+dimensiones\s+del\s+terreno\.?/gi, 'y halla las dimensiones.')
      .replace(/\butilizando\s+la\s+f[oó]rmula\s+general\b/gi, 'por fórmula general')
      .replace(/\s+/g, ' ')
      .trim()
  );
  if (!clean || isRubricOrBoilerplateLeak(clean)) return '';

  // No se fabrican consignas genéricas. Si el enunciado de origen no trae
  // datos + tarea explícita, se conserva tal cual y el gate de calidad lo
  // reporta para que el writer lo corrija en origen.
  // NOTA: "modela" en 3.ª persona descriptiva ("se modela mediante...", "club modela el costo...")
  // NO es una consigna para el estudiante; solo cuenta en modo imperativo ("Modela...", "y modela...").
  const hasExplicitStudentTask = (text: string): boolean => hasValidTaskInStatement(text).ok;
  const capitalizeSentenceStart = (text: string): string => {
    const trimmed = text.trim();
    if (!trimmed) return '';
    if (/^[a-z](?:[0-9₀-₉²³]|\([^)]+\))?\s*(?:[=<>≤≥≠≈+\-*/·×^]|²|³)/.test(trimmed)) return trimmed;
    return /^[a-záéíóúñ]/.test(trimmed) ? trimmed.charAt(0).toUpperCase() + trimmed.slice(1) : trimmed;
  };
  const ensureActivityTask = (text: string): string => {
    const value = capitalizeSentenceStart(text);
    if (!value) return '';
    const words = value.replace(/[.!?]+$/, '').split(/\s+/);
    const last = words[words.length - 1] ?? '';
    // Nunca terminar en una letra suelta sin contexto de variable ("señala c").
    if (words.length > 3 && hasDanglingEnding(value) && /^[A-Za-z]$/.test(last)) {
      const trimmed = words.slice(0, -1).join(' ').replace(/[,;:\s]+$/, '').trim();
      return trimmed ? `${trimmed}.` : '';
    }

    const originalSentences = splitSpanishSentences(clean);
    const originalTask = originalSentences.find(
      (sentence) => sentence.trim().length >= 18 && hasExplicitStudentTask(sentence)
    );
    let result = value;

    // Si la compresión perdió la oración que contiene la consigna/pregunta,
    // se recupera completa desde el enunciado original sin duplicar la cláusula condicional previa.
    if (!hasExplicitStudentTask(result) && originalTask) {
      let baseResult = result.replace(/[.!?]+$/, '').trim();
      const resultSentences = splitSpanishSentences(baseResult);
      const lastResSentence = resultSentences[resultSentences.length - 1] ?? '';
      const lastResNorm = lastResSentence.replace(/[.!?]+$/, '').trim().toLowerCase();
      const origTaskNorm = originalTask.trim().toLowerCase();
      if (lastResNorm.length >= 14 && origTaskNorm.startsWith(lastResNorm)) {
        baseResult = resultSentences.slice(0, -1).join(' ').replace(/[.!?]+$/, '').trim();
      }
      const combined = baseResult ? `${baseResult}. ${originalTask}` : originalTask;
      result = combined.length <= maxChars + 120 ? combined : originalTask;
    }

    if (!hasExplicitStudentTask(result) && !originalTask && clean.length <= maxChars + 80) {
      result = clean;
    }

    // Si perdió la ecuación o el contexto numérico del enunciado original, se recupera la oración de datos.
    const lostEquation = /=/.test(clean) && !/=/.test(result);
    const hasData = /\d|\$|pesos|m\b|cm\b/i.test(result);
    if (lostEquation || !hasData) {
      const originalData =
        (lostEquation
          ? originalSentences.find((sentence) => sentence !== originalTask && /=/.test(sentence))
          : undefined) ||
        originalSentences.find(
          (sentence) =>
            sentence !== originalTask &&
            sentence.trim().length >= 18 &&
            /\d|\$|pesos|m\b|cm\b/i.test(sentence)
        );
      if (originalData) {
        const compactData = originalData;
        const dataLead = compactData.toLowerCase().slice(0, Math.min(28, compactData.length));
        const alreadyIncluded = Boolean(dataLead && result.toLowerCase().includes(dataLead));
        if (!alreadyIncluded) {
          const combined = `${compactData.replace(/[.!?]+$/, '')}. ${result}`;
          if (combined.length <= maxChars + 140 || lostEquation) {
            result = combined;
          }
        }
      } else if (lostEquation) {
        const eq = extractFormulasFromText(clean, 1)[0];
        if (eq) {
          result = `Con ${eq}: ${result.charAt(0).toLowerCase()}${result.slice(1)}`;
        }
      }
    }
    if (
      rawSourceClean &&
      (!isPublishablePedagogicalText(result, 'activity', rawSourceClean) ||
        isTruncatedAgainstSource(result, rawSourceClean))
    ) {
      if (isPublishablePedagogicalText(clean, 'activity', clean)) return clean;
      if (isPublishablePedagogicalText(rawSourceClean, 'activity', rawSourceClean)) return rawSourceClean;
    }
    return result;
  };

  // Quitar primera oración solo si es puramente introductoria sin datos numéricos,
  // sin consigna explícita y sin abrir una cita textual que cierre en oraciones posteriores.
  let sentences = clean
    .split(/(?<=[.?!])\s+(?=[A-ZÁÉÍÓÚÑ¿])/)
    .map((s) => s.trim())
    .filter(Boolean);
  const firstSentence = sentences[0] ?? '';
  const firstSingleQuotes = (
    firstSentence
      .replace(/(?<=[A-Za-zÁÉÍÓÚÜÑáéíóúüñ])'(?=[A-Za-zÁÉÍÓÚÜÑáéíóúüñ(])/g, '')
      .replace(/(?<![A-Za-zÁÉÍÓÚÜÑáéíóúüñ'])[A-Za-z]'(?=\s|[=.,;:)]|$)/g, '')
      .match(/'/g) || []
  ).length;
  const firstOpensQuote =
    firstSingleQuotes % 2 === 1 ||
    (firstSentence.match(/"/g) || []).length % 2 === 1 ||
    (firstSentence.match(/«/g) || []).length !== (firstSentence.match(/»/g) || []).length ||
    (firstSentence.match(/“/g) || []).length !== (firstSentence.match(/”/g) || []).length ||
    /:\s*['"«“‘]/.test(firstSentence);
  const secondSentence = sentences[1] ?? '';
  const secondDependsOnFirst = /\b(?:este\s+t[eé]rmino|est[ea]s?\s+[a-záéíóúñ]+|dich[oa]s?|lo\s+anterior|amb[oa]s|su\s+[a-záéíóúñ]+)\b/i.test(
    secondSentence
  );
  if (
    sentences.length >= 2 &&
    !firstOpensQuote &&
    !secondDependsOnFirst &&
    !hasExplicitStudentTask(firstSentence) &&
    !/\d|=|\?|calcula|resuelve|determina|halla|plantea|verifica|encuentra|revisa|explica|traza|dibuja|grafica|analiza|convierte|transforma|lee|corrige|identifica|reescribe|completa|subraya|traduce|ordena|elige|redacta|escribe|busca|investiga|consulta|define/i.test(
      firstSentence
    )
  ) {
    const rest = sentences.slice(1).join(' ');
    if (rest.length >= 45) {
      clean = rest;
      sentences = sentences.slice(1);
    }
  }

  if (clean.length <= maxChars && (!maxWords || clean.split(/\s+/).length <= maxWords)) {
    return ensureActivityTask(fitPedagogicalText(clean, { maxChars, maxWords, role: 'activity' }));
  }

  // Preservar pregunta explícita (? o consigna final) + TODAS las oraciones con datos numéricos o ecuaciones
  const questionSentence = [...sentences].reverse().find((s) => hasExplicitStudentTask(s));
  const dataSentences = sentences.filter((s) => s !== questionSentence && /\d|=|\$/.test(s));

  if (questionSentence && questionSentence.length <= maxChars + 80) {
    const compactTask = questionSentence
      .replace(/\by\s+(?:redacta|prepara|documenta|elabora)\s+(?:la\s+|el\s+)?(?:justificaci[oó]n|reporte|evidencia|argumento)[^?]*([?.!])?$/i, '$1')
      .replace(/\s+y\s+(?:verifica|comprueba|confirma)\s+que\b[^?.]*/gi, '')
      .replace(/^Si\s+el\s+comit[eé]\s+dispone\s+de\s+un\s+presupuesto\s+total\s+de\s+/i, 'Con presupuesto de ')
      .replace(/\s+y\s+decide\s+comprar\s+exactamente\s+/i, ' y ')
      .trim();
    const numericContext = dataSentences
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/[.!?]+$/, '');
    const contextPrefix =
      numericContext ||
      (compactTask.length < 60 && sentences[0] && sentences[0] !== questionSentence
        ? sentences[0].replace(/[.!?]+$/, '').trim()
        : '');
    const fullCombined = contextPrefix ? `${contextPrefix}. ${compactTask}` : compactTask;
    if (fullCombined.length <= maxChars + 90) {
      return ensureActivityTask(fullCombined);
    }
    // Si el contexto completo no cabe, compactar cada oración de datos numéricos o ecuaciones
    // en lugar de descartarla (descartar una oración de datos vuelve irresoluble el problema).
    const remaining = Math.max(85, maxChars + 40 - compactTask.length - 2);
    const perSentenceBudget = Math.max(85, Math.floor(remaining / Math.max(1, dataSentences.length)));
    const extractNumericSet = (s: string) =>
      new Set((s.match(/\$?\d[\d.,]*/g) ?? []).map((n) => n.replace(/[$,]/g, '')));
    const selected: string[] = [];
    for (const sentence of dataSentences) {
      const strippedLead = capitalizeSentenceStart(
        sentence
          .replace(/^(?:En|Para|Durante|Tras|Al|Con|Seg[uú]n)\b[^,:\d=()]{8,80},\s+(?=[A-ZÁÉÍÓÚÑa-záéíóúñ\d])/u, '')
          .trim()
      );
      const baseData = strippedLead.length >= 24 ? strippedLead : sentence;
      let candidate = baseData;
      if (baseData.length > perSentenceBudget) {
        const fitted = fitPedagogicalText(baseData, {
          maxChars: perSentenceBudget,
          maxWords: Math.max(15, Math.round(perSentenceBudget / 5.5)),
          role: 'problem',
        });
        const origNums = extractNumericSet(baseData);
        const fitNums = extractNumericSet(fitted);
        const keptAllNums = [...origNums].every((n) => fitNums.has(n));
        if (fitted && keptAllNums && !hasDanglingEnding(fitted)) {
          candidate = fitted;
        }
      }
      if (candidate) {
        selected.push(capitalizeSentenceStart(candidate));
      }
    }
    if (selected.length > 0) {
      return ensureActivityTask(`${selected.join(' ').replace(/[.!?]+$/, '')}. ${compactTask}`);
    }
    if (compactTask.length <= maxChars + 40) {
      return ensureActivityTask(compactTask);
    }
    const fittedFinal = fitPedagogicalText(compactTask, { maxChars: maxChars + 40, maxWords, role: 'activity' });
    return ensureActivityTask(
      isPublishablePedagogicalText(fittedFinal, 'activity', compactTask) ? fittedFinal : compactTask
    );
  }

  const fittedClean = fitPedagogicalText(clean, {
    maxChars,
    maxWords,
    role: 'activity',
  });
  return ensureActivityTask(
    isPublishablePedagogicalText(fittedClean, 'activity', clean) ? fittedClean : clean
  );
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
    const topicLead = deriveRepeatedTopicLead(session);
    const theorySources = (options.extraTheorySources ?? []).filter(
      (source): source is string => typeof source === 'string' && source.trim().length > 0
    );
    const stmtMax = allowMission ? 235 : 360;
    const stmtWords = allowMission ? undefined : 70;
    const hintMax = allowMission ? 135 : 108;
    const hintWords = allowMission ? undefined : 18;
    const maxItems = allowMission ? 3 : 2;
    const seenHints = new Set<string>();
    const fromSession = (session?.practica ?? [])
      .filter((item) => cleanSacrintText(stripSessionLeadPrefix(item.enunciado, topicLead)).length >= 10 && !isRubricOrBoilerplateLeak(item.enunciado))
      .slice(0, maxItems)
      .map((item, idx) => {
        const cleanStmt = distillExerciseStatement(stripSessionLeadPrefix(item.enunciado, topicLead), stmtMax, stmtWords);
        // El enunciado ya fue destilado preservando datos + consigna. No se
        // vuelve a recortar por 6-gramas: eso eliminaba la oración de datos.
        const presentationStmt = cleanStmt;
      const rawHint = cleanSacrintText(stripSessionLeadPrefix(item.pista, topicLead));
      const isPureQuestionTitle = /^¿[^?.!]{3,58}\?$/i.test(rawHint) && rawHint.split(/\s+/).length <= 8;
      const isSameAsLead = Boolean(topicLead && rawHint.toLowerCase().replace(/[.:]+$/, '') === topicLead.toLowerCase().replace(/[.:]+$/, ''));
      let fittedHint =
        !rawHint || isPureQuestionTitle || isSameAsLead
          ? ''
          : fitPedagogicalText(sanitizePedagogicalMetaPhrases(rawHint), {
              maxChars: hintMax,
              maxWords: hintWords,
              role: 'hint',
            });
      const isWeakHint = Boolean(
        !fittedHint ||
          /^(?:luego,\s*)?(?:plantea|resuelve|calcula|aplica|usa|utiliza)\s+(?:una\s+)?(?:ecuaci[oó]n|f[oó]rmula|procedimiento|m[eé]todo)\.?$/i.test(
            fittedHint
          )
      );
      const normHint = fittedHint.toLowerCase().replace(/[^a-záéíóúñ0-9]+/gi, ' ').trim();
      const isDuplicateHint = Boolean(normHint && [...seenHints].some((prev) => prev === normHint || prev.startsWith(normHint.slice(0, 32)) || normHint.startsWith(prev.slice(0, 32))));
      if (isDuplicateHint || isWeakHint) {
        const firstStep = cleanStepLine(item.solucion?.[0] || '')
          .replace(/\b=\s*[-+0-9.,]+(?:\s*(?:m|cm|km|%|pesos|años|horas|sillas|grados|°))?/gi, '')
          .trim();
        const altHint = firstStep && firstStep.length >= 18 && !/\brespuesta\b/i.test(firstStep)
          ? fitPedagogicalText(`Inicia por: ${firstStep}`, { maxChars: hintMax, maxWords: hintWords, role: 'hint' })
          : '';
        fittedHint = altHint && altHint.toLowerCase() !== fittedHint.toLowerCase() ? altHint : '';
      }
      if (fittedHint) {
        seenHints.add(fittedHint.toLowerCase().replace(/[^a-záéíóúñ0-9]+/gi, ' ').trim());
      }
        const validation = validatePracticeActivity(presentationStmt, fittedHint, {
          sessionNumber: session?.sessionNumber ?? null,
          field: `activities[${idx}]`,
          strict: false,
        });
        const finalStmt = validation.rescuedStatement ?? presentationStmt;
        const finalHint =
          validation.updatedHint !== undefined
            ? validation.updatedHint
            : fittedHint || 'Apóyate en el ejemplo trabajado en clase.';
        return {
          label: `Actividad ${idx + 1}`,
          statement: finalStmt,
          hint: finalHint,
        };
    });

  if (fromSession.length > 0) return fromSession;

  if (!allowMission) {
    return [];
  }

  const guided = cleanSacrintText(mission.weDoSection?.guidedPractice);
  if (guided && !isRubricOrBoilerplateLeak(guided)) {
    const points = extractBulletSentences(guided, 3, 185);
      return points.map((pt, idx) => ({
        label: `Actividad ${idx + 1}`,
        statement: enforceSixGramOverlap(pt, theorySources, 0.12, 'problem') || pt,
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
        enforceSixGramOverlap(
          distillConciseText(autonomous, 195, 34) ||
            'Realiza en tu cuaderno una actividad de aplicación del tema vinculada con tu entorno.',
          theorySources,
          0.12,
          'problem'
        ) || 'Realiza una actividad de aplicación vinculada con tu entorno.',
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
  const topicLead = deriveRepeatedTopicLead(session);
  const appMax = allowMission ? 200 : 124;
  const appWords = allowMission ? undefined : 20;
  const artMax = allowMission ? 165 : 108;
  const artWords = allowMission ? undefined : 16;
  const checkMax = allowMission ? 125 : 88;
  const checkWords = allowMission ? undefined : 14;

  const rawApp = (allowMission
    ? stripSessionLeadPrefix(session?.aplicacion, topicLead) ||
      mission.realLifeConnection?.householdApplication ||
      mission.realLifeConnection?.communityImpact ||
      mission.realLifeConnection?.context ||
      mission.sessionFocus
    : stripSessionLeadPrefix(session?.aplicacion, topicLead)
  )
    ?.replace(/\bUtiliza\s+tu\s+(?:\[\[?material:[^\]\s]+\]?\]?|matriz\s+de\s+comprobaci[oó]n|regla\s+(?:escolar\s+de\s+30\s*cm|graduada))\s+para\s+/gi, '')
    .replace(/\ben\s+la\s+rehabilitaci[oó]n\s+de\s+un\s+espacio\s+p[uú]blico\s+en\s+tu\s+localidad\s+de\s+Puebla,\s*asegurando\s+que\s+los\s+c[aá]lculos\s+de\s+costos\s+de\s+([^.]+)\s+sean\s+impecables\.?/gi, '($1) en tu localidad.')
    .replace(/,\s*verificando\s+mediante\s+factorizaci[oó]n\s+que\s+las\s+medidas\s+calculadas\s+correspondan[^.]*\.?/gi, '.')
    .replace(/^([a-záéíóúñ])/, (m) => m.toUpperCase());
  const cleanRawApp = sanitizePedagogicalMetaPhrases(cleanSacrintText(rawApp));
  let application =
    fitPedagogicalText(cleanRawApp, {
      maxChars: appMax,
      maxWords: appWords,
      role: 'application',
    }) ||
    (allowMission
      ? 'Vincula el aprendizaje con situaciones reales y decisiones cotidianas de tu comunidad.'
      : '');
  if (application && application.length < 44 && cleanRawApp.length >= 48) {
    const expandedApp = fitPedagogicalText(cleanRawApp, {
      maxChars: Math.max(appMax + 26, 150),
      maxWords: appWords ? appWords + 5 : 25,
      role: 'application',
    });
    if (expandedApp && expandedApp.length >= 44 && !hasDanglingEnding(expandedApp)) {
      application = expandedApp;
    }
  }
  if (application && application.length < 36) {
    application =
      fitPedagogicalText(
        `${application.replace(/[.!?]+$/, '')} y contrasta el resultado con una situación de tu entorno.`,
        { maxChars: appMax, maxWords: appWords, role: 'application' }
      ) || application;
  }

  const rawArtifact = allowMission
    ? stripSessionLeadPrefix(session?.productoIntegrador, topicLead) ||
      mission.youDoSection?.autonomousChallenge ||
      mission.formativeCheckpoint?.question
    : stripSessionLeadPrefix(session?.productoIntegrador, topicLead);
  const artifactStep =
    fitPedagogicalText(sanitizePedagogicalMetaPhrases(cleanSacrintText(rawArtifact)), {
      maxChars: artMax,
      maxWords: artWords,
      role: 'application',
    }) ||
    (allowMission
      ? 'Integra el procedimiento desarrollado y su conclusión con evidencia en la bitácora del bloque.'
      : '');

  const checksFromSession = (session?.autoevaluacion ?? [])
    .map((item) => sanitizePedagogicalMetaPhrases(cleanSacrintText(stripSessionLeadPrefix(item))))
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

  const topicLead = deriveRepeatedTopicLead(session);
  const rawObjectiveSource =
    !allowMission && session?.objetivo
      ? cleanSacrintText(stripSessionLeadPrefix(session.objetivo, topicLead))
      : stripSessionLeadPrefix(session?.objetivo, topicLead) || (allowMission ? topicSource : '');
  const normalizedObjective = normalizeLearningObjective(rawObjectiveSource, {
    title: topicTitle,
    maxWords: allowMission ? 24 : 15,
    sessionNumber,
    field: 'objective',
    strict: false,
  });
  const objectiveRaw = normalizedObjective || '';

  const actBudget = allowMission ? 185 : 88;
  const actWords = allowMission ? 32 : 13;
  const activationRaw =
    stripSessionLeadPrefix(session?.saberesPrevios, topicLead) ||
    stripSessionLeadPrefix(session?.motivacion, topicLead) ||
    (allowMission ? mission.phenomenonHook?.story : '');
  const activationBase =
    (allowMission
      ? ''
      : pickCompleteSentences(activationRaw, 140, 1) || distillConciseText(activationRaw, 140, 22)) ||
    distillConciseText(activationRaw, actBudget, actWords) ||
    (allowMission ? distillConciseText(mission.sessionFocus, 175, 30) : '');

  const sessionQuestion = extractQuestionFromSession(session);
  const rawQuestionBase =
    sessionQuestion ||
    (allowMission ? distillConciseText(mission.phenomenonHook?.detonatingQuestion, 150, 24) : '') ||
    `¿Cómo aplicar ${topicTitle.toLowerCase()} en esta sesión?`;
  const questionBase = allowMission
    ? rawQuestionBase
    : distillConciseText(rawQuestionBase, 115, 18) || rawQuestionBase;

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
    const coreTheorySources = [
      session?.contenido,
      mission.conceptZero?.coreExplanation,
      mission.conceptZero?.narrativeExplanation,
    ].filter((source): source is string => Boolean(source));
    const cleanField = (text: string) =>
      preventSixGramTheoryOverlap(sanitizePedagogicalMetaPhrases(text), theorySources);
    const cleanApplication = (text: string) =>
      preventSixGramTheoryOverlap(sanitizePedagogicalMetaPhrases(text), coreTheorySources);
    const cleanPresentationField = (
      text: string,
      role: 'problem' | 'concept' | 'general' = 'concept'
    ) => enforceSixGramOverlap(text, theorySources, 0.12, role);
    return {
      sessionNumber,
      topicTitle: cleanField(topicTitle),
      objective: cleanField(objectiveRaw),
      activation: cleanField(activationBase),
      question: cleanField(questionBase),
      concepts: {
        definition: cleanPresentationField(concepts.definition, 'concept'),
        formulas: concepts.formulas,
        keyRules: concepts.keyRules.map(cleanField),
      },
      example: {
        // El enunciado ya viene destilado y con datos completos; no se vuelve
        // a recortar aquí para no perder contexto ni la pregunta.
        problemStatement: example.problemStatement,
        steps: example.steps.map((step) => sanitizePedagogicalMetaPhrases(step)),
        interpretation: cleanField(example.interpretation),
      },
      activities: activities.map((act) => ({
        ...act,
        // Las actividades ya pasaron por de-overlap seguro; se conserva la
        // consigna completa con sus datos.
        statement: act.statement,
        hint: cleanField(act.hint),
      })),
      application: cleanApplication(application),
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


// ─── 7.1 — Six-gram overlap ratio (for infographic de-overlap check) ─────────
// El costo real estaba en re-tokenizar las mismas fuentes del libro para cada
// campo de cada lámina. Se cachea por cadena fuente individual y la unión por
