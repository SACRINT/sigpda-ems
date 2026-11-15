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
};

const UNICODE_TO_WINANSI_MAP: Record<string, string> = {
  '↔': '<->',
  '⇔': '<=>',
  '→': '->',
  '←': '<-',
  '⇒': '=>',
  '⇐': '<=',
  '≤': '<=',
  '≥': '>=',
  '≠': '!=',
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
  '√': 'raiz',
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
  // 1. Bloques display $$...$$
  let text = input.replace(/\$\$([\s\S]+?)\$\$/g, (_m, inner: string) => inner.trim());

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
    .replace(/\s+(?=\bPaso\s*\d+\s*[:.\-–])/gi, '\n\n')
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
    .replace(/\s+(?=(?:Conclusi[oó]n|Resultado\s+final|Interpretaci[oó]n)\s*:)/gi, '\n\n');
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

  // 5. Mapa único de símbolos LaTeX
  for (const [pattern, replacement] of LATEX_SYMBOLS) {
    text = text.replace(pattern, replacement);
  }

  // 6. Superíndices y subíndices (incluyendo grados tipo 50^\circ ya cubiertos y exponentes numéricos/literales)
  text = text
    .replace(/\^\s*\{\s*\\?circ\s*\}|\^\s*\\?circ\b/g, '°')
    .replace(/\^\{([^{}]+)\}/g, (_m, exp: string) => convertUnicodeScript(exp, SUPERSCRIPTS, '^'))
    .replace(/_\{([^{}]+)\}/g, (_m, sub: string) => convertUnicodeScript(sub, SUBSCRIPTS, '_'))
    .replace(/([A-Za-z0-9)\]])\^([0-9ni])/g, (_m, base: string, ch: string) => `${base}${SUPERSCRIPTS[ch] || `^${ch}`}`)
    .replace(/([A-Za-z0-9)\]])_([0-9ainex])/g, (_m, base: string, ch: string) => `${base}${SUBSCRIPTS[ch] || `_${ch}`}`);

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
  if (/([(\[{,;:=+\-*/])\s*$/.test(trimmed)) return false;
  const openParens = (trimmed.match(/\(/g) || []).length;
  const closeParens = (trimmed.match(/\)/g) || []).length;
  if (openParens !== closeParens) return false;
  return true;
}
