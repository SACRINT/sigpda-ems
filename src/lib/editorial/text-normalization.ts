/**
 * text-normalization.ts — SSoT de Normalización Editorial y Notación Matemática
 * SIGPDA-EMS · Motor Editorial Compartido (PDF, DOCX, PPTX, SVG SACRINT)
 */

const LATEX_SYMBOLS: ReadonlyArray< readonly [RegExp, string] > = [
  [/\\leftrightarrow\b/g, '↔'],
  [/\\Leftrightarrow\b/g, '⇔'],
  [/\\rightarrow\b|\\to\b/g, '→'],
  [/\\leftarrow\b/g, '←'],
  [/\\Rightarrow\b/g, '⇒'],
  [/\\Leftarrow\b/g, '⇐'],
  [/\\sim\b/g, '¬'],
  [/\\land\b|\\wedge\b/g, 'y'],
  [/\\lor\b|\\vee\b/g, 'o'],
  [/\\neg\b|\\lnot\b/g, '¬'],
  [/\\forall\b/g, 'para todo'],
  [/\\exists\b/g, 'existe'],
  [/\\cdot\b/g, '·'],
  [/\\times\b/g, '×'],
  [/\\div\b/g, '÷'],
  [/\\(?:pm|mp)\b/g, '±'],
  [/\\(?:leq|le)\b/g, '≤'],
  [/\\(?:geq|ge)\b/g, '≥'],
  [/\\(?:neq|ne)\b/g, '≠'],
  [/\\approx\b/g, '≈'],
  [/\\infty\b/g, '∞'],
  [/\\pi\b/g, 'π'],
  [/\\theta\b/g, 'θ'],
  [/\\alpha\b/g, 'α'],
  [/\\beta\b/g, 'β'],
  [/\\gamma\b/g, 'γ'],
  [/\\Delta\b/g, 'Δ'],
  [/\\delta\b/g, 'δ'],
  [/\\Sigma\b/g, 'Σ'],
  [/\\sigma\b/g, 'σ'],
  [/\\lambda\b/g, 'λ'],
  [/\\mu\b/g, 'μ'],
  [/\\Omega\b/g, 'Ω'],
  [/\\omega\b/g, 'ω'],
  [/\\phi\b/g, 'φ'],
  [/\^\s*\{\s*\\wedge\s*\}|\^\s*\\wedge\b/g, '^'],
  [/\\wedge\b/g, 'y'],
  [/\\degree\b|\^\s*\{\s*\\circ\s*\}|\^\s*\\circ\b|\\circ\b/g, '°'],
  [/\\(?:sin|sen)\b/g, 'sen'],
  [/\\cos\b/g, 'cos'],
  [/\\tan\b/g, 'tan'],
  [/\\log\b/g, 'log'],
  [/\\ln\b/g, 'ln'],
  [/\\%/g, '%'],
  [/\\left\s*\./g, ''],
  [/\\right\s*\./g, ''],
  [/\\left\s*([()[\]|])/g, '$1'],
  [/\\right\s*([()[\]|])/g, '$1'],
  [/\\(?:text|mathrm|mathbf|mathit|mathsf|textbf|textit)\s*\{([^{}]*)\}/g, '$1'],
  [/\\[,;!]/g, ' '],
];

const SUPERSCRIPTS: Record<string, string> = {
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
  '+': '⁺',
  '-': '⁻',
  '=': '⁼',
  '(': '⁽',
  ')': '⁾',
  'n': 'ⁿ',
  'i': 'ⁱ',
};

const SUBSCRIPTS: Record<string, string> = {
  '0': '₀',
  '1': '₁',
  '2': '₂',
  '3': '₃',
  '4': '₄',
  '5': '₅',
  '6': '₆',
  '7': '₇',
  '8': '₈',
  '9': '₉',
  '+': '₊',
  '-': '₋',
  '=': '₌',
  '(': '₍',
  ')': '₎',
  'a': 'ₐ',
  'e': 'ₑ',
  'o': 'ₒ',
  'x': 'ₓ',
  'i': 'ᵢ',
  'n': 'ₙ',
  'v': 'ᵥ',
};

const UNICODE_TO_WINANSI_MAP: Record<string, string> = {
  'ᵥ': 'v',
  'ₘ': 'm',
  '↔': '<->',
  '⇔': '<=>',
  '→': '->',
  '←': '<-',
  '⇒': '=>',
  '⇐': '<=',
  '≤': '<=',
  '≥': '>=',
  '≠': '=/=',
  '≈': '~',
  '∞': 'infinito',
  'π': 'pi',
  'θ': 'theta',
  'α': 'alfa',
  'β': 'beta',
  'γ': 'gamma',
  'Δ': 'Delta',
  'δ': 'delta',
  'Σ': 'Sigma',
  'σ': 'sigma',
  'λ': 'lambda',
  'μ': 'u',
  'Ω': 'Ohm',
  'ω': 'omega',
  'φ': 'fi',
  '⁰': '^0',
  '¹': '^1',
  '⁴': '^4',
  '⁵': '^5',
  '⁶': '^6',
  '⁷': '^7',
  '⁸': '^8',
  '⁹': '^9',
  '⁺': '^+',
  '⁻': '^-',
  '⁼': '^=',
  '⁽': '^(',
  '⁾': '^)',
  'ⁿ': '^n',
  'ⁱ': '^i',
  '₀': '0',
  '₁': '1',
  '₂': '2',
  '₃': '3',
  '₄': '4',
  '₅': '5',
  '₆': '6',
  '₇': '7',
  '₈': '8',
  '₉': '9',
  '₊': '+',
  '₋': '-',
  '₌': '=',
  '₍': '(',
  '₎': ')',
  'ₐ': '_a',
  'ₑ': '_e',
  'ₒ': '_o',
  'ₓ': '_x',
  'ᵢ': '_i',
  'ₙ': '_n',
};

function convertUnicodeScript(raw: string, map: Record<string, string>, fallbackPrefix: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  let mapped = '';
  for (const ch of trimmed) {
    if (!(ch in map)) {
      return `${fallbackPrefix}(${trimmed})`;
    }
    mapped += map[ch];
  }
  return mapped;
}

function wrapFractionPart(part: string): string {
  const trimmed = part.trim();
  if (/^[A-Za-z0-9πθΔαβγ√²³¹⁰-⁹₀-₉._-]+$/.test(trimmed)) {
    return trimmed;
  }
  return `(${trimmed})`;
}

function convertLatexFractionsAndRoots(value: string): string {
  let text = value;
  for (let pass = 0; pass < 4; pass++) {
    const next = text
      .replace(/\\(?:d|t)?frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, (_m, num: string, den: string) => {
        return `${wrapFractionPart(num)}/${wrapFractionPart(den)}`;
      })
      .replace(/\\sqrt(?:\[([^\]]+)\])?\s*\{([^{}]+)\}/g, (_m, nth: string | undefined, inner: string) => {
        const clean = inner.trim();
        if (nth) {
          return `${nth.trim()}√(${clean})`;
        }
        return /^[A-Za-z0-9πθ]+$/.test(clean) ? `√${clean}` : `√(${clean})`;
      });
    if (next === text) break;
    text = next;
  }
  return text;
}

/**
 * Unidades físicas, geométricas y tasas que NUNCA son moneda aunque sigan a un número dentro de `$...$`.
 */
const MEASUREMENT_OR_MATH_SPAN_RE =
  /^\d+(?:[.,]\d+)*\s*(?:%|°|m²|m³|cm²|cm³|km²|mm²|metros?\b|cent[ií]metros?\b|mil[ií]metros?\b|kil[oó]metros?\b|m\b|cm\b|mm\b|km\b|g\b|kg\b|mg\b|l\b|ml\b|s\b|seg\b|segundos?\b|min\b|minutos?\b|h\b|hr\b|hrs\b|horas?\b|d[ií]as?\b|a[ñn]os?\b|grados?\b|rad\b|radianes\b|u\b|unidades?\b|hab(?:itantes)?\b|j[oó]venes\b|estudiantes\b|personas\b)/i;

/**
 * Desenvuelve bloques LaTeX `$...$` y `$$...$$` preservando únicamente montos monetarios reales:
 * - Conserva: `$400`, `$1,200`, `$100 a $200`, `$500 + $200`, `$500 MXN`, `$500 pesos`
 * - Desenvuelve: `$40 metros$` -> `40 metros`, `$300 m²$` -> `300 m²`, `$2.4 m$` -> `2.4 m`,
 *   `$4 cm$` -> `4 cm`, `$3.5\%$` -> `3.5%`, `$F_i$` -> `Fᵢ`, `$50^\circ$` -> `50°`, `$4500$` -> `4500`.
 */
function unwrapLatexMathDelimiters(input: string): string {
  const looksLikeCurrencyProse = (inner: string): boolean =>
    /\b(?:pesos?|mxn|usd|d[oó]lares?|centavos?|cuesta|vale|pago|pagar|precio|ganancia|ahorro|presupuesto|compr[oó]|vende)\b/i.test(
      inner
    ) &&
    !/[=<>^\\]/.test(inner) &&
    !/\d\s*[+\-*/]\s*\d/.test(inner);

  // 1. Bloques display $$...$$
  let text = input.replace(/\$\$([\s\S]+?)\$\$/g, (_m, inner: string) => inner.trim());

  // 1.2. Monomios/expresiones algebraicas cortas con delimitadores `$...$`
  // (ej. `$2x$`, `$4a$`, `$7x^2$`). No son moneda y deben desenvolverse antes
  // de que la protección monetaria interprete el `$` inicial como importe.
  text = text.replace(
    /\$([+-]?\d+(?:[.,]\d+)?[a-zA-Zα-ωΑ-Ω²³₀-₉]+(?:\^[a-zA-Z0-9{}]+)?)\$(?!\d)/g,
    '$1'
  );

  // 1.5. Desenvolver números puros encerrados entre delimitadores LaTeX (`$4$`, `$0.025$`, `$6348$`, `$3.5%$`)
  // antes de proteger montos monetarios, evitando que el `$` de cierre quede huérfano y desfase el resto del texto.
  text = text.replace(/\$([+-]?\d+(?:[.,]\d+)*%?)\$(?!\d)/g, (_full, numInner: string, offset: number, whole: string) => {
    const after = whole.slice(offset + _full.length);
    if (/^\s*(?:pesos?\b|mxn\b|usd\b|d[oó]lares?\b|centavos?\b)/i.test(after)) {
      return `$${numInner}`;
    }
    return numInner;
  });

  // 2. Proteger temporalmente signos `$` de moneda explícita (ej. "$500", "$15,000\nTasa", "$100 + $200", "$1,200 MXN")
  // Un `$` que inicia en dígito SOLO es LaTeX si cierra un tramo matemático/unidad en la misma línea sin prosa extensa ni otro `$` en medio.
  const CURRENCY_PLACEHOLDER = '\uE004';
  const LATEX_NUM_SPAN_RE = /^\$\d[\d,]*(?:\.\d+)?[^$\n]{0,180}\$(?!\d)/;

  text = text.replace(/\$(\d[\d,]*(?:\.\d+)?)/g, (full, numPart: string, offset: number, whole: string) => {
    const rest = whole.slice(offset);
    const spanMatch = rest.match(LATEX_NUM_SPAN_RE);
    if (spanMatch) {
      const inner = spanMatch[0].slice(1, -1).replace(/\s+/g, ' ').trim();
      const isUnitWordOnly = MEASUREMENT_OR_MATH_SPAN_RE.test(inner);
      const hasMathOp = /[=+\-*/^²³¹⁰⁴⁵⁶⁷⁸⁹₀-₉√·×÷<>°%\\]/.test(inner);
      const hasCurrencyCue = /\b(?:pesos?|mxn|usd|cuesta|vale|pago|pagar|precio|ganancia|ahorro|presupuesto)\b/i.test(inner);
      const proseWords = inner.match(/[a-záéíóúñ]{4,}/gi) || [];
      if (isUnitWordOnly || (hasMathOp && !hasCurrencyCue && proseWords.length <= 2)) {
        return full;
      }
    }
    return `${CURRENCY_PLACEHOLDER}${numPart}`;
  });

  // 3. Desenvolver pares `$...$` de LaTeX (incluyendo saltos de línea accidentales dentro de unidades cortas como "$3.0\nm$")
  text = text.replace(/\$([^$]{1,220}?)\$/g, (full, rawInner: string, offset: number, whole: string) => {
    const nextChar = whole[offset + full.length] || '';
    // Si el segundo `$` va seguido inmediatamente de un dígito (ej. "$100 a $200"), ambos `$` son signos de moneda
    if (/\d/.test(nextChar)) {
      return full;
    }
    if (rawInner.includes('\n') && rawInner.length > 45) {
      return full;
    }

    const inner = rawInner.replace(/\s+/g, ' ').trim();
    if (!inner) return full;

    // Pares de moneda con prosa ("$1,500 pesos ... de $300") no son fórmulas LaTeX
    if (looksLikeCurrencyProse(inner)) return full;

    // Unidades físicas, medidas y tasas ("40 metros", "300 m²", "2.4 m", "3.5%", "7 metros") -> siempre desenvolver
    if (MEASUREMENT_OR_MATH_SPAN_RE.test(inner)) {
      return inner;
    }

    // Número puro encerrado entre `$4500$` o `$0.035$` -> siempre desenvolver
    if (/^[+-]?\d+(?:[.,]\d+)*%?$/.test(inner)) {
      return inner;
    }

    // Si parece monto monetario con espacio accidental ("$ 500 pesos"), conservar moneda sin segundo `$`
    if (/^\s*\d/.test(rawInner) && /\b(?:pesos?|mxn|usd|d[oó]lares?)\b/i.test(inner) && !/[=<>^\\]/.test(inner)) {
      return full;
    }

    return inner;
  });

  // 4. Limpiar cualquier `$` huérfano antes de exponentes o superíndices (ej. "($1.645² = ...)" -> "(1.645² = ...)")
  return text
    .split(CURRENCY_PLACEHOLDER)
    .join('$')
    .replace(/\$(\d+(?:[.,]\d+)?(?:\^\d+|[²³¹⁰⁴⁵⁶⁷⁸⁹ⁿ]))/g, '$1');
}

function replaceLiteralSqrtFunctions(text: string): string {
  let out = '';
  let index = 0;
  while (index < text.length) {
    const match = text.slice(index).match(/^(?:raiz|sqrt)\s*\(/i);
    if (!match) {
      out += text[index];
      index += 1;
      continue;
    }
    const openIndex = index + match[0].length - 1;
    let depth = 0;
    let closeIndex = -1;
    for (let i = openIndex; i < text.length; i++) {
      if (text[i] === '(') depth++;
      else if (text[i] === ')') {
        depth--;
        if (depth === 0) {
          closeIndex = i;
          break;
        }
      }
    }
    if (closeIndex < 0) {
      out += text.slice(index);
      break;
    }
    out += `√(${text.slice(openIndex + 1, closeIndex).trim()})`;
    index = closeIndex + 1;
  }
  return out;
}

function repairTabTimesCorruption(text: string): string {
  return text
    // Reparar "\t + imes" originado por literales "\times" sin doble barra invertida
    .replace(/[\t]+\s*imes(?=\s|[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ(\[+\-=×/.,;:]|$)/gi, ' \\times ')
    // Reparar " imes " huérfano tras pérdida previa del tabulador en expresiones matemáticas (sin tocar "estimes"/"times")
    .replace(/(?<=[0-9A-Za-zÁÉÍÓÚÜÑáéíóúüñ)\]=×])\s+imes(?=\s+[0-9A-Za-zÁÉÍÓÚÜÑáéíóúüñ(\[]|\s*$)/g, ' \\times ');
}

function normalizeEditorialPunctuation(text: string): string {
  const savedUrls: string[] = [];
  const withUrlTokens = text.replace(/https?:\/\/[^\s)>"']+/gi, (url) => {
    const token = `__SACRINT_URL_${savedUrls.length}__`;
    savedUrls.push(url);
    return token;
  });

  let out = withUrlTokens
    // Limpiar flechas ASCII tipo "Esto => revisar" heredadas en prosa pedagógica
    .replace(/\bEsto\s*(?:⇒|=>|→|->)\s*revisar\b/g, 'Esto implica revisar')
    // Corregir artículo capitalizado tras preposición ("de La difusión" -> "de la difusión") sin tocar nombres propios
    .replace(/\b(de|en|sobre|entre|para|con|hacia|desde|ante)\s+(La|Las|Los)\s+(?=[a-záéíóúñ]{3,})/g, (_m, prep: string, art: string) => `${prep} ${art.toLowerCase()} `)
    .replace(/\bde\s+El\s+(?=[a-záéíóúñ]{3,})/g, 'del ')
    // Limpiar corte truncado clásico "y activarás tus" cuando queda colgante sin sustantivo siguiente
    .replace(/\s+y\s+activar[aá]s\s+tus(?=\s*(?:$|["'”».,;:!?()[\]—–-]))/gi, '')
    // Reparar comas huérfanas seguidas de punto y coma o dos puntos (", ;" -> ";", ", :" -> ":")
    .replace(/,\s*;/g, ';')
    .replace(/,\s*:/g, ':')
    // Colapsar ".." erróneos preservando elipsis "..." y separadores decimales
    .replace(/(?<!\.)\.\.(?!\.)/g, '.')
    // Quitar espacios horizontales antes de coma, punto y coma, admiración o cierre interrogativo
    .replace(/([A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ)%°"»\]])[ \t]+([,;!?])(?=\s|$|[A-Za-z0-9"»)])/g, '$1$2')
    // Quitar espacios antes de punto final, cuidando no romper números ".5" tras operador
    .replace(/(?<=[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ)%°"»\]])[ \t]+\.(?!\d)/g, '.')
    // Quitar espacios antes de ":" cuando actúa como puntuación editorial
    .replace(/([A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9)%°"»\]])[ \t]+:(?=\s|$)/g, '$1:')
    // Colapsar múltiples espacios horizontales conservando saltos de línea
    .replace(/[ \t]{2,}/g, ' ');

  savedUrls.forEach((url, idx) => {
    out = out.replace(`__SACRINT_URL_${idx}__`, url);
  });

  return out;
}

/**
 * Normaliza saltos de línea en ejemplos resueltos para evitar pasos o ecuaciones pegadas
 * en una sola línea (ej. "1) x + y = 10 2) x - y = 4 Paso 2: ...").
 */
export function formatSolvedExampleBlocks(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw
    // Rejoin broken LaTeX split across numbered lines (e.g. "($\n 4. \triangle ABC ...)")
    .replace(/\(\$\s*\n\s*\d+\.\s*([^\n)]+\$)\s*\)/g, '($1)')
    // Collapse double-numbered list items ("1. 1. Traza..." -> "1. Traza...")
    .replace(/(^|\n)([ \t]*\d+\.)\s+\d+\.\s+/g, '$1$2 ')
    // Strip redundant leading numbering before explicit Paso N: / Respuesta final: labels
    .replace(/^\s*\d+\.\s*(?=(?:\*\*)?\bPaso\s*\d+\s*[:.\-–])/gim, '')
    .replace(/(\n[ \t]*)\d+\.\s*(?=(?:\*\*)?(?:Respuesta|Conclusi[oó]n|Interpretaci[oó]n|Resultado)(?:\s+final)?\s*:)/gi, '$1')
    .replace(/(?<![=+\-*/^])[ \t]+(\d{1,2})\.\s*(?=\bPaso\s*\d+\s*[:.\-–])/gi, (match, itemNumber: string) => {
      const value = Number(itemNumber);
      return value >= 1 && value <= 25 ? '\n\n' : match;
    })
    .replace(/[ \t]+(?=\bPaso\s*\d+\s*[:.\-–])/gi, (match, offset: number, full: string) => {
      const before = full.slice(Math.max(0, offset - 20), offset).toLowerCase();
      if (/\b(?:el|del|al|en|de|un|este|ese|siguiente|primer|segundo|tercer|cuarto)\s*$/.test(before)) {
        return match;
      }
      return '\n\n';
    })
    .replace(/\s+(?=(\d+)\)\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9(])/g, (match, numStr: string, offset: number, full: string) => {
      const itemNum = Number(numStr);
      if (!Number.isFinite(itemNum) || itemNum < 1 || itemNum > 25) return match;
      const sliceBefore = full.slice(0, offset);
      const lastNewline = sliceBefore.lastIndexOf('\n');
      const currentLine = sliceBefore.slice(lastNewline + 1);
      const prevNonSpace = currentLine.trimEnd().slice(-1);
      if (!prevNonSpace || /[=+\-*/×÷^<(,\[]/.test(prevNonSpace)) return match;
      const openParens = (currentLine.match(/\(/g) || []).length;
      const closeParens = (currentLine.match(/\)/g) || []).length;
      if (openParens > closeParens) return match;
      return '\n';
    })
    .replace(/[ \t]+(?=(?:Conclusi[oó]n|Resultado\s+final|Interpretaci[oó]n)\s*:)/gi, '\n\n');
}

/**
 * Expande y despega pasos de un ejemplo resuelto que llegan fusionados en una
 * sola cadena ("... = 4): -2y = ... Paso 2: ..."). Devuelve pasos atómicos sin
 * numeración para que cada renderer vuelva a numerarlos una sola vez.
 */
export function normalizeSolvedExampleSteps(rawSteps: string[] | null | undefined): string[] {
  if (!Array.isArray(rawSteps)) return [];
  const out: string[] = [];
  for (const rawStep of rawSteps) {
    const formatted = formatSolvedExampleBlocks(String(rawStep ?? ''));
    for (const block of formatted.split(/\n{2,}/)) {
      const clean = block
        .replace(/^\s*(?:Paso\s*\d+\s*[:.\-–]|\d+[.)])\s*/i, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (clean.length >= 3 && !out.includes(clean)) out.push(clean);
    }
  }
  return out;
}

export interface EditorialTextNormalizationOptions {
  /**
   * 'unicode' (por defecto): conserva símbolos matemáticos Unicode (`⇒`, `√`, `≤`, `≥`, `Fᵢ`, `°`, `²`).
   * 'winansi': traslada símbolos fuera de WinAnsi a equivalentes ASCII/Latin1 seguros para fuentes jsPDF estándar.
   */
  target?: 'unicode' | 'winansi';
}

/**
 * Normalizador único SSoT para texto editorial y notación matemática en PDF, DOCX, PPTX e Infografías.
 */
export function normalizeEditorialText(
  value: string | null | undefined,
  options?: EditorialTextNormalizationOptions
): string {
  if (!value) return '';
  let text = repairTabTimesCorruption(String(value));

  // Reparar montos con `$` insertado tras la coma de miles: "$1,$200" -> "$1,200"
  text = text.replace(/\$(\d{1,3}),\$(\d{3})(?!\d)/g, '$$$1,$2');

  // 1. Títulos de bloque repetidos: "Bloque 1 (Corte 1): Bloque 1 (Corte 1)" o "Bloque 1: Bloque 1 (Corte 1)" -> "Bloque 1 (Corte 1)"
  text = text.replace(
    /\b(Bloque\s+(\d+))(\s*\(\s*Corte\s+\d+\s*\))?\s*[:\-–—]\s*Bloque\s+\2(\s*\(\s*Corte\s+\d+\s*\))?(?:\s*([:\-–—])\s*)?/gi,
    (_m, blockPrefix: string, _num: string, firstCorte?: string, secondCorte?: string, trailingSep?: string) => {
      const resolved = `${blockPrefix}${firstCorte ?? secondCorte ?? ''}`.replace(/\s+/g, ' ').trim();
      if (!trailingSep) return resolved;
      return trailingSep === ':' ? `${resolved}: ` : `${resolved} ${trailingSep} `;
    }
  );

  // 2. Prefijos de ejercicio y sesión duplicados: "Ejercicio 1. Ejercicio 1:" -> "Ejercicio 1:", "Sesión 2: Sesión 2:" -> "Sesión 2:"
  text = text.replace(
    /(\*{0,2}Ejercicio\s+(\d+)\.?(\*{0,2}))\s*Ejercicio\s+\2\s*[:.]\s*/gi,
    '$1: '
  );
  text = text.replace(/\bEjercicio\s+(\d+)\s*\.\s*:\s*/gi, 'Ejercicio $1: ');
  text = text.replace(
    /\b(Sesi[oó]n\s+(\d{1,2}))\s*[:.\-–—]*\s*Sesi[oó]n\s+\2(?:\s*[:.\-–—]\s*|\s+)/gi,
    (_m, head: string) => `${head}: `
  );
  text = text.replace(/\b(Sesi[oó]n\s+\d{1,2})\s*\.\s*:\s*/gi, '$1: ');

  // 3. Etiquetas [[...]] residuales que no sean [[material:...]]
  text = text.replace(/\[\[\s*(?!material\s*:)([^\]]+?)\s*\]\]/gi, (_m, inner: string) => {
    const parts = inner.split('|');
    return (parts[1] || parts[0] || '').trim();
  });

  // 4. Fracciones y raíces LaTeX
  text = convertLatexFractionsAndRoots(text);

  // 5. Mapa único de símbolos LaTeX y operadores ASCII crudos (!=)
  for (const [pattern, replacement] of LATEX_SYMBOLS) {
    text = text.replace(pattern, replacement);
  }
  text = text.replace(/(?<![!<>])!=(?!=)/g, '≠');

  // 6. Superíndices y subíndices (incluyendo grados tipo 50^\circ ya cubiertos y exponentes numéricos/literales)
  text = text
    .replace(/\^\s*\{\s*\\?circ\s*\}|\^\s*\\?circ\b/g, '°')
    .replace(/\^\{([^{}]+)\}/g, (_m, exp: string) => convertUnicodeScript(exp, SUPERSCRIPTS, '^'))
    .replace(/_\{([^{}]+)\}/g, (_m, sub: string) => convertUnicodeScript(sub, SUBSCRIPTS, '_'))
    .replace(/([A-Za-z0-9)\]])\^([0-9ni])/g, (_m, base: string, ch: string) => `${base}${SUPERSCRIPTS[ch] || `^${ch}`}`)
    .replace(/([A-Za-z0-9)\]])_([0-9ainexv])/g, (_m, base: string, ch: string) => `${base}${SUBSCRIPTS[ch] || `_${ch}`}`);

  // 6.9. Normalizar notación ASCII de raíz, subíndices crudos y superíndices partidos.
  // Las fuentes editoriales soportan el glifo √, por lo que se conserva Unicode.
  text = replaceLiteralSqrtFunctions(text)
    .replace(/\bM_\((simple|compuesto)\)/gi, (_m, sub: string) => `M ${sub}`)
    .replace(/¹2\b/g, '¹²')
    .replace(/²2\b/g, '²²')
    .replace(/³2\b/g, '³²');

  // 7. Desenvolver delimitadores LaTeX `$...$` / `$$...$$`
  text = unwrapLatexMathDelimiters(text);

  // 7.05 Normalizar "approx" sin barra invertida entre expresiones numéricas/matemáticas
  text = text.replace(/(?<=[0-9)\]⁰¹²³⁴⁵⁶⁷⁸⁹])\s*\bapprox\b\s*(?=[+\-0-9([√])/gi, ' ≈ ');

  // 7.1 Higiene de puntuación y espacios sin romper decimales, versiones, ... ni URLs
  text = normalizeEditorialPunctuation(text);

  // 8. Si el destino requiere WinAnsi estricto, trasladar caracteres Unicode fuera de Latin-1
  if (options?.target === 'winansi') {
    text = toWinAnsiMathSafe(text);
  }

  return text;
}

/**
 * Convierte símbolos matemáticos Unicode > \xFF a equivalentes seguros en WinAnsi (sin perder significado).
 */
export function toWinAnsiMathSafe(text: string): string {
  let out = text;
  for (const [uni, win] of Object.entries(UNICODE_TO_WINANSI_MAP)) {
    if (out.includes(uni)) {
      out = out.split(uni).join(win);
    }
  }
  return out;
}

/**
 * Alias de compatibilidad para consumidores de `math-text.ts` y `pdf-components-core.ts`.
 */
export function normalizeMathNotation(value: string): string {
  return normalizeEditorialText(value, { target: 'unicode' });
}

export function normalizePdfEditorialText(value: string | null | undefined): string {
  return normalizeEditorialText(value, { target: 'unicode' });
}

/**
 * Valida que una fórmula o expresión no contenga variables de plantilla sin instanciar (c1, a2, b2, y = c1 y a2*x + b2*y, etc.).
 */
export function isValidRenderableFormula(formula: string | null | undefined): boolean {
  if (!formula) return false;
  const trimmed = formula.trim();
  if (trimmed.length < 3) return false;
  if (/\b(?:a1|b1|c1|a2|b2|c2)\b/i.test(trimmed)) return false;
  if (/\by\s*=\s*c[₁1]\b/i.test(trimmed)) return false;
  if (/\ba[₁₂12]\s*\*\s*x\b|\bb[₁₂12]\s*\*\s*y\b/i.test(trimmed)) return false;
  if (/\bundefined\b|\bNaN\b|\$\{/i.test(trimmed)) return false;
  if (/^\([A-Za-z]\)\s*=/.test(trimmed)) return false;
  if (/([(\[{,;:=+\-*/])\s*$/.test(trimmed)) return false;
  const openParens = (trimmed.match(/\(/g) || []).length;
  const closeParens = (trimmed.match(/\)/g) || []).length;
  if (openParens !== closeParens) return false;
  return true;
}

const SECOND_PERSON_FUTURE_VERB_MAP: Record<string, string> = {
  identificaras: 'identificar',
  construiras: 'construir',
  comprenderas: 'comprender',
  aplicaras: 'aplicar',
  visualizaras: 'visualizar',
  resolveras: 'resolver',
  representaras: 'representar',
  dominaras: 'dominar',
  evaluaras: 'evaluar',
  realizaras: 'realizar',
  clasificaras: 'clasificar',
  mediras: 'medir',
  calcularas: 'calcular',
  analizaras: 'analizar',
  recuperaras: 'recuperar',
  contrastaras: 'contrastar',
  integraras: 'integrar',
  optimizaras: 'optimizar',
  socializaras: 'socializar',
  defenderas: 'defender',
  tabularas: 'tabular',
  exploraras: 'explorar',
  elaboraras: 'elaborar',
  modelaras: 'modelar',
  presentaras: 'presentar',
  delimitaras: 'delimitar',
  validaras: 'validar',
  consolidaras: 'consolidar',
  justificaras: 'justificar',
  argumentaras: 'argumentar',
  disenaras: 'diseñar',
  interpretaras: 'interpretar',
  explicaras: 'explicar',
  verificaras: 'verificar',
  comprobaras: 'comprobar',
  propondras: 'proponer',
  proponeras: 'proponer',
  redactaras: 'redactar',
  relacionaras: 'relacionar',
  compararas: 'comparar',
  determinaras: 'determinar',
  expondras: 'exponer',
  sintetizaras: 'sintetizar',
  graficaras: 'graficar',
  formularas: 'formular',
  organizaras: 'organizar',
  estructuraras: 'estructurar',
  reflexionaras: 'reflexionar',
};

const SECOND_PERSON_FUTURE_VERB_RE =
  /\b(?:Identificar|Construir|Comprender|Aplicar|Visualizar|Resolver|Representar|Dominar|Evaluar|Realizar|Clasificar|Medir|Calcular|Analizar|Recuperar|Contrastar|Integrar|Optimizar|Socializar|Defender|Tabular|Explorar|Elaborar|Modelar|Presentar|Delimitar|Validar|Consolidar|Justificar|Argumentar|Dise[ñn]ar|Interpretar|Explicar|Verificar|Comprobar|Propondr|Proponer|Redactar|Relacionar|Comparar|Determinar|Expondr|Sintetizar|Graficar|Formular|Organizar|Estructurar|Reflexionar)[áa]s\b/gi;

/**
 * Convierte encabezados o descriptores redactados en segunda persona del futuro
 * ("Aprenderás a...", "Identificarás...", "Dominarás...") en enunciados curriculares limpios.
 */
export function normalizeSessionDescriptorTense(raw: string | null | undefined): string {
  let out = (raw || '').trim();
  if (!out) return '';
  out = out
    .replace(/^(?:En\s+esta\s+sesi[oó]n\s+|Hoy\s+)?(?:Aprender[áa]s\s+a|Vas\s+a)\s+/i, '')
    .replace(/\b(?:aprender[áa]s\s+a|vas\s+a)\s+([a-záéíóúüñ]+r)\b/gi, '$1')
    .replace(/^Recuperar\s+(?:tus\s+|los\s+)?saberes\s+previos\s+(?:sobre|de)\s+/i, 'Saberes previos: ')
    .replace(/\btus\s+(conocimientos|saberes|aprendizajes|hallazgos|procedimientos|habilidades|competencias|resultados|productos|datos|c[aá]lculos|reportes|argumentos|an[aá]lisis)\b/gi, 'los $1')
    .replace(/\btu\s+(evidencia(?:\s+formativa)?|investigaci[oó]n|matriz|propuesta|bit[aá]cora|tabla|gr[aá]fica|soluci[oó]n|comprensi[oó]n)\b/gi, 'la $1')
    .replace(/\btu\s+(proyecto(?:\s+\w+)?|reporte(?:\s+\w+)?|prototipo(?:\s+\w+)?|modelo(?:\s+\w+)?|aprendizaje|entorno|contexto)\b/gi, 'el $1')
    .replace(/\bde\s+el\s+/gi, 'del ')
    .replace(/\ba\s+el\s+/gi, 'al ');
  out = out.replace(SECOND_PERSON_FUTURE_VERB_RE, (matched, offset: number) => {
    const asciiKey = matched
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ñ/g, 'n');
    const inf = SECOND_PERSON_FUTURE_VERB_MAP[asciiKey];
    if (!inf) return matched;
    return offset === 0 ? inf.charAt(0).toUpperCase() + inf.slice(1) : inf;
  });
  out = out
    .replace(/^Recuperar\s+(?:los\s+)?saberes\s+previos\s*(?::|sobre|de)\s*/i, 'Saberes previos: ')
    .replace(/\bde\s+el\s+/gi, 'del ')
    .replace(/\ba\s+el\s+/gi, 'al ');
  if (/^[a-záéíóúüñ]/.test(out)) {
    out = out.charAt(0).toUpperCase() + out.slice(1);
  }
  return out;
}

const LESSON_OPENING_TEMPLATES: readonly ((topic: string) => string)[] = [
  (t) => `Revisar las notas de la sesión previa sobre ${t}, reunir libreta e instrumentos de trazo y formular una hipótesis inicial en parejas.`,
  (t) => `Preparar los datos base y bosquejar un esquema inicial de ${t} en la bitácora antes de integrar los equipos de trabajo.`,
  (t) => `Contrastar en binas un ejemplo breve vinculado a ${t}, identificar las variables conocidas y organizar los materiales de práctica.`,
  (t) => `Recuperar el procedimiento clave visto previamente para ${t}, verificar los materiales necesarios y plantear una duda concreta al grupo.`,
  (t) => `Ordenar el espacio de trabajo, analizar los datos iniciales del reto sobre ${t} y registrar en libreta la estrategia de abordaje.`,
  (t) => `Activar conocimientos previos mediante diálogo rápido sobre ${t}, preparar calculadora o juego geométrico y acordar roles de equipo.`,
];

/**
 * Genera una actividad de apertura estudiantil variada por sesión y tema,
 * evitando la repetición literal de "Recuperar insumos previos y organizar mesa de trabajo colaborativa.".
 */
export function diversifyLessonOpeningActivity(sessionNum: number, topicSummary: string): string {
  const cleanTopic = topicSummary
    .replace(/^Sesi[oó]n\s*\d+\s*[:.\-–—·]\s*/i, '')
    .replace(/["“”]/g, '')
    .replace(/[.]+$/, '')
    .trim();
  const compact = cleanTopic.length > 90
    ? `${cleanTopic.slice(0, 88).replace(/\s+[^\s]*$/, '').trim()}`
    : cleanTopic;
  const label = compact ? `"${compact}"` : 'el tema de la sesión';
  const idx = Math.abs((sessionNum || 1) - 1) % LESSON_OPENING_TEMPLATES.length;
  return LESSON_OPENING_TEMPLATES[idx](label);
}

/**
 * Normaliza un título de documento extra (`lesson_plan`, `practice_guide`, etc.)
 * removiendo futuro en segunda persona y encabezados de sesión redundantes.
 */
export function normalizeExtraTitle(rawTitle: string): string {
  const match = /^((?:Plan de Clase|Ficha de Trabajo)\s*[:·]\s*Sesi[oó]n\s*\d+\s*[:·\-–—]\s*)(.+)$/i.exec(rawTitle.trim());
  if (!match) return rawTitle;
  return `${match[1]}${normalizeSessionDescriptorTense(match[2])}`;
}

/**
 * Corrige artefactos editoriales, contaminación cruzada entre sesiones, ejercicios sin cálculo
 * y etiquetas mal formadas presentes tanto en `workbooks_json` como en `planning_extras` almacenados.
 */
export function repairExtraPedagogicalArtifacts(
  rawText: string,
  opts?: { type?: string; title?: string }
): string {
  if (!rawText) return '';
  let out = rawText
    // Normalizar doble numeración de ejercicios (**Ejercicio 1.** Ejercicio 1: -> **Ejercicio 1:** )
    .replace(/(\*\*Ejercicio\s+(\d+))\.\*\*\s*Ejercicio\s+\2\s*[:.]\s*/gi, '$1:** ')
    .replace(/(^|\n)[ \t]*\d+\.\s*\*\*Ejercicio\s+(\d+)\s*:\s*/gi, '$1**Ejercicio $2:** ')
    .replace(/\bEjercicio\s+(\d+)\.\s*:/gi, 'Ejercicio $1:')
    .replace(/(\b\d+\.)\s*Ejercicio\s+\d+\s*[:.]\s*/gi, (_m, n: string) => `${n} `)
    // Bloque 2 · Ejercicio 5 del solucionario: incluir cálculo explícito A(12.5) = 312.5 m²
    .replace(
      /(Funci[oó]n\s+A\(x\)\s*=\s*-2x(?:\^2|²)\s*\+\s*50x\s*;\s*[ÁA]rea\s+m[áa]xima\s+con\s+v[ée]rtice\s+en\s+x\s*=\s*12\.5\s*metros\.?)(?!\s*Evaluando|\s*[ÁA]rea\s+m[áa]xima\s*=)/gi,
      'Función A(x) = -2x² + 50x; vértice en x = 12.5 metros. Evaluando: A(12.5) = -2(12.5)² + 50(12.5) = 312.5 m² (área máxima = 312.5 m²).'
    )
    // Bloque 2 · Ejercicio 6 del solucionario: reemplazar "Reporte técnico..." genérico por criterio algebraico Δ < 0
    .replace(
      /Reporte\s+t[ée]cnico\s+justificando\s+que\s+el\s+terreno\s+propuesto\s+es\s+geom[ée]tricamente\s+imposible\s+con\s+los\s+datos\s+dados\s+y\s+propuesta\s+de\s+ajuste\s+de\s+par[áa]metros\.?/gi,
      'Cálculo del discriminante: en la ecuación cuadrática ax² + bx + c = 0 (modelo 2x² - Px + 2A = 0 para perímetro P y área A), evaluar Δ = b² - 4ac < 0 demuestra ausencia de raíces reales porque A_propuesta > P²/16 (el máximo rectángulo posible es el cuadrado de área (P/4)²). Criterio de corrección: calcular Δ numérico, verificar A_propuesta > (P/4)² y proponer un ajuste con Δ ≥ 0 (reducir A ≤ P²/16 o aumentar P).'
    );

  // Normalizar títulos de sección con futuro ("SESIÓN 16: Aprenderás a...", "SESIÓN 14 · Recuperar...")
  out = out.replace(
    /(^|\n)(#{1,4}\s+(?:FICHA DE TRABAJO\s*·\s*)?(?:SESI[ÓO]N|Sesi[oó]n)\s*\d+\s*[:·\-–—]\s*)([^\n]+)/gi,
    (_m, lead: string, prefix: string, desc: string) => `${lead}${prefix}${normalizeSessionDescriptorTense(desc)}`
  );
  out = out.replace(
    /(^|\n)(-\s*\*\*(?:Prop[oó]sito(?:\s*(?:u Objetivo|de Aprendizaje))?|T[ií]tulo(?:\s+de\s+la\s+Sesi[oó]n)?):\*\*\s*|^\*\*(?:Prop[oó]sito|T[ií]tulo(?:\s+de\s+la\s+Sesi[oó]n)?):\*\*\s*)([^\n]+)/gim,
    (_m, lead: string, prefix: string, desc: string) => `${lead}${prefix}${normalizeSessionDescriptorTense(desc)}`
  );

  // En planes de clase: eliminar citas cruzadas ("Sesión 4: ...") en sesiones != 4 y diversificar apertura repetida
  if (opts?.type === 'lesson_plan') {
    const titleSessionMatch = /Sesi[oó]n\s*(\d+)\s*[:·\-–—]\s*([^\n]+)/i.exec(opts.title || out);
    const ownSessionNum = titleSessionMatch ? Number(titleSessionMatch[1]) : null;
    const rawTopic = titleSessionMatch
      ? normalizeSessionDescriptorTense(titleSessionMatch[2])
      : 'el tema de la sesión';
    const cleanOwnTopic = rawTopic.replace(/\s*\(Bloque.*$/i, '').trim() || 'el tema de la sesión';

    if (ownSessionNum !== null) {
      // Corregir contaminación de "Sesión X: Modelado Metodológico..." cuando X !== ownSessionNum
      out = out.replace(
        /"Sesi[oó]n\s*(\d+)\s*[:\-–—]\s*[^"\n]+"/gi,
        (full, citedNumStr: string) =>
          Number(citedNumStr) === ownSessionNum
            ? full
            : `"Sesión ${ownSessionNum}: ${cleanOwnTopic}"`
      );
      out = out.replace(
        /(·\s*)Sesi[oó]n\s*(\d+)\s*[:\-–—]\s*[^\n·]+(?=\s*(?:·|$|\n))/gi,
        (full, sep: string, citedNumStr: string) =>
          Number(citedNumStr) === ownSessionNum
            ? full
            : `${sep}Sesión ${ownSessionNum}: ${cleanOwnTopic}`
      );
      out = out.replace(
        /Recuperar insumos previos y organizar mesa de trabajo colaborativa\.?/gi,
        () => diversifyLessonOpeningActivity(ownSessionNum, cleanOwnTopic)
      );
    }
  }

  return out;
}
