import { fitPedagogicalText } from '@/lib/editorial/fitter/text-compactor';
import {
  hasDanglingEnding,
  isPublishablePedagogicalText,
  isTruncatedAgainstSource,
} from '@/lib/editorial/fitter/dangling-guards';
import { splitSpanishSentences } from '@/lib/editorial/fitter/sentence-splitter';
import { isValidRenderableFormula } from '@/lib/editorial/text-normalization';
import {
  cleanSacrintText,
  isRubricOrBoilerplateLeak,
  NUMERIC_ONLY_STEP_RE,
  ORPHAN_LIST_END_RE,
  sanitizePedagogicalMetaPhrases,
  stripTemplateLabels,
} from '../text/grammar-normalization';
import { hasValidTaskInStatement } from '../text/objective-and-activity-guards';

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

export function extractCompleteEquations(text: string): string[] {
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

export function stripRubricTail(rawText: string): string {
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

export function cleanStepLine(rawStep: string): string {
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
export function simplifyNumericEqualsChains(text: string): string {
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
