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
  [/\\text\{([^{}]*)\}/g, '$1'],
  [/\\mathrm\{([^{}]*)\}/g, '$1'],
  [/\\[,;!]/g, ' '],
];

const MATH_SYMBOLS = '→←↔⇒⇐⇔¬·×÷±≤≥≠≈∞π';

export function normalizeMathNotation(value: string): string {
  let text = value;
  for (const [pattern, replacement] of LATEX_SYMBOLS) {
    text = text.replace(pattern, replacement);
  }
  return text
    .replace(new RegExp(`\\$([^$]*[${MATH_SYMBOLS}][^$]*)\\$`, 'g'), '$1')
    .replace(/\$([A-Za-z0-9]{1,3}(?:\s*[+\-*/=<>^_]\s*[A-Za-z0-9]{1,3})*)\$/g, '$1');
}
