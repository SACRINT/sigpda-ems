const LATEX_SYMBOLS: Array<[RegExp, string]> = [
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
  [/\\pm\b/g, '±'],
  [/\\leq\b|\\le\b/g, '≤'],
  [/\\geq\b|\\ge\b/g, '≥'],
  [/\\neq\b|\\ne\b/g, '≠'],
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
  [/\\degree\b|\^\{\\circ\}|\^\\circ/g, '°'],
  [/\\(?:sin|sen)\b/g, 'sen'],
  [/\\cos\b/g, 'cos'],
  [/\\tan\b/g, 'tan'],
  [/\\log\b/g, 'log'],
  [/\\ln\b/g, 'ln'],
  [/\\left\s*\./g, ''],
  [/\\right\s*\./g, ''],
  [/\\left\s*([()[\]|])/g, '$1'],
  [/\\right\s*([()[\]|])/g, '$1'],
  [/\\text\{([^{}]*)\}/g, '$1'],
  [/\\mathrm\{([^{}]*)\}/g, '$1'],
  [/\\[,;!]/g, ' '],
];

const SUPERSCRIPTS: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾', 'n': 'ⁿ', 'i': 'ⁱ',
};

const SUBSCRIPTS: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎', 'a': 'ₐ', 'e': 'ₑ', 'o': 'ₒ', 'x': 'ₓ', 'i': 'ᵢ', 'n': 'ₙ',
};

function convertUnicodeScript(raw: string, map: Record<string, string>, fallbackPrefix: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  let mapped = '';
  for (const ch of trimmed) {
    if (!(ch in map)) {
      return `${fallbackPrefix}${trimmed}`;
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

const MATH_SYMBOLS = '→←↔⇒⇐⇔¬·×÷±≤≥≠≈∞πθαβγΔδΣσλμΩωφ√²³¹⁰⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉°';

function shouldUnwrapInlineMath(inner: string): boolean {
  if (!inner) return false;
  // Evitar atrapar montos monetarios seguidos de texto ("$500 y ahorro $200") u operadores ("$500 + $200")
  if (/[+\-*/]\s*$/.test(inner)) return false;
  if (/^\d[\d,]*(?:\.\d+)?$/.test(inner.trim())) return false;
  if (/[a-záéíóúñ]{3,}\s+[a-záéíóúñ]{3,}/i.test(inner)) return false;
  const trimmed = inner.trim();
  if (new RegExp(`[=<>^_/+*\\-()\\[\\]{}${MATH_SYMBOLS}]`).test(trimmed)) {
    return true;
  }
  return /^(?:\d*[A-Za-z][A-Za-z0-9]{0,2}|[A-Za-z]\([^)]*\))$/.test(trimmed);
}

export function normalizeMathNotation(value: string): string {
  let text = convertLatexFractionsAndRoots(value);
  for (const [pattern, replacement] of LATEX_SYMBOLS) {
    text = text.replace(pattern, replacement);
  }
  text = text
    .replace(/\^\{([^{}]+)\}/g, (_m, exp: string) => convertUnicodeScript(exp, SUPERSCRIPTS, '^'))
    .replace(/_\{([^{}]+)\}/g, (_m, sub: string) => convertUnicodeScript(sub, SUBSCRIPTS, '_'))
    .replace(/([A-Za-z0-9)\]])\^([0-9n])/g, (_m, base: string, ch: string) => `${base}${SUPERSCRIPTS[ch] || `^${ch}`}`)
    .replace(/([A-Za-z0-9)\]])_([0-9in])/g, (_m, base: string, ch: string) => `${base}${SUBSCRIPTS[ch] || `_${ch}`}`);

  // Bloque display $$...$$
  text = text.replace(/\$\$([^$]+)\$\$/g, (_m, inner: string) => inner.trim());

  // Inline math $...$ preservando precios ($500, $1,200)
  return text.replace(/\$([^$\n]{1,96})\$/g, (full, inner: string) =>
    shouldUnwrapInlineMath(inner) ? inner.trim() : full
  );
}
