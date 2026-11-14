/**
 * inline-markdown.ts — Tokenizador y sanitizador seguro de énfasis Markdown (**bold**, *italic*, ***both***)
 *
 * Distingue cursivas Markdown reales (*Foco instruccional:*) de operadores aritméticos (* en ecuaciones: 3 * x, 2*x + 3*y).
 */

export interface InlineMarkdownSegment {
  text: string;
  bold: boolean;
  italic: boolean;
}

/**
 * Coincide únicamente con cursivas *texto* delimitadas por inicio de cadena, espacio o signos de apertura
 * y cerradas por fin de cadena, espacio o signos de puntuación; evita falsos positivos en `2*x + 3*y` o `3 * x`.
 */
const SAFE_ITALIC_RE =
  /(?<=^|[\s(\["'¿¡])\*(?!\s)([^*\n]+?)(?<!\s)\*(?=$|[\s.,;:!?)\]"'])/g;

function splitSafeItalics(
  text: string,
  bold: boolean
): InlineMarkdownSegment[] {
  if (!text || !text.includes('*')) {
    return text ? [{ text, bold, italic: false }] : [];
  }

  const out: InlineMarkdownSegment[] = [];
  const regex = new RegExp(SAFE_ITALIC_RE.source, SAFE_ITALIC_RE.flags);
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      out.push({
        text: text.slice(lastIndex, match.index),
        bold,
        italic: false,
      });
    }
    if (match[1]) {
      out.push({
        text: match[1],
        bold,
        italic: true,
      });
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    out.push({
      text: text.slice(lastIndex),
      bold,
      italic: false,
    });
  }

  return out;
}

/**
 * Descompone un fragmento Markdown en segmentos tipográficos preservando negritas,
 * cursivas seguras y texto aritmético literal.
 */
export function parseInlineMarkdownSegments(raw: string): InlineMarkdownSegment[] {
  if (!raw) return [];

  const boldOrBothRe = /(\*\*\*[\s\S]*?\*\*\*|\*\*[\s\S]*?\*\*)/g;
  const segments: InlineMarkdownSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = boldOrBothRe.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      segments.push(...splitSafeItalics(raw.slice(lastIndex, match.index), false));
    }

    const token = match[0];
    if (token.startsWith('***') && token.endsWith('***') && token.length > 6) {
      segments.push({ text: token.slice(3, -3), bold: true, italic: true });
    } else if (token.startsWith('**') && token.endsWith('**') && token.length > 4) {
      segments.push(...splitSafeItalics(token.slice(2, -2), true));
    } else {
      segments.push({ text: token, bold: false, italic: false });
    }

    lastIndex = boldOrBothRe.lastIndex;
  }

  if (lastIndex < raw.length) {
    segments.push(...splitSafeItalics(raw.slice(lastIndex), false));
  }

  return segments;
}

/**
 * Remueve marcadores de énfasis Markdown (`**bold**`, `*italic*`, `***both***`) para celdas o texto plano
 * conservando asteriscos aritméticos como `3 * x` o `2*x + 3*y`.
 */
export function stripInlineMarkdownEmphasis(raw: string): string {
  if (!raw) return '';
  return parseInlineMarkdownSegments(raw)
    .map((seg) => seg.text)
    .join('');
}
