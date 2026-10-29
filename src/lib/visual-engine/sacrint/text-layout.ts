import { SACRINT_FONT } from './tokens';

export type TextFamily = 'display' | 'body';
export type TextWeight = 'regular' | 'medium' | 'semibold' | 'bold';

export interface FitTextOptions {
  family?: TextFamily;
  weight?: TextWeight;
  maxFontSize: number;
  minFontSize?: number;
  maxLines: number;
  lineHeightRatio?: number;
  letterSpacing?: number;
  truncate?: boolean;
}

export interface FittedText {
  lines: string[];
  fontSize: number;
  lineHeight: number;
  width: number;
  height: number;
}

const FAMILY_FACTOR: Record<TextFamily, number> = {
  display: 1.015,
  body: 1,
};

const WEIGHT_FACTOR: Record<TextWeight, number> = {
  regular: 1,
  medium: 1.02,
  semibold: 1.045,
  bold: 1.075,
};

function charEm(char: string, family: TextFamily, weight: TextWeight): number {
  let base: number;
  if (char === ' ') base = 0.28;
  else if (/[A-ZÁÉÍÓÚÜÑ]/.test(char)) base = 0.62;
  else if (/[0-9]/.test(char)) base = 0.56;
  else if (/[.,:;!|'`´]/.test(char)) base = 0.27;
  else if (/[()\[\]{}]/.test(char)) base = 0.34;
  else if (/[—–-]/.test(char)) base = 0.36;
  else if (/[%°]/.test(char)) base = 0.58;
  else base = 0.52;
  return base * FAMILY_FACTOR[family] * WEIGHT_FACTOR[weight];
}

export function measureText(
  text: string,
  fontSize: number,
  family: TextFamily = 'body',
  weight: TextWeight = 'regular',
  letterSpacing = 0
): number {
  if (!text) return 0;
  let em = 0;
  for (const char of text) em += charEm(char, family, weight);
  return em * fontSize + Math.max(0, text.length - 1) * letterSpacing;
}

function breakLongWord(word: string, maxChars: number): string[] {
  if (word.length <= maxChars) return [word];
  const parts: string[] = [];
  let rest = word;
  while (rest.length > maxChars) {
    parts.push(rest.slice(0, maxChars));
    rest = rest.slice(maxChars);
  }
  if (rest) parts.push(rest);
  return parts;
}

export function wrapText(
  text: string,
  maxWidth: number,
  fontSize: number,
  family: TextFamily = 'body',
  weight: TextWeight = 'regular',
  letterSpacing = 0
): string[] {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];

  const maxChars = Math.max(4, Math.floor(maxWidth / (fontSize * charEm('x', family, weight))));
  const words: string[] = [];
  for (const word of clean.split(' ')) {
    words.push(...breakLongWord(word, maxChars));
  }

  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (measureText(next, fontSize, family, weight, letterSpacing) <= maxWidth) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function ellipsize(line: string, maxWidth: number, fontSize: number, family: TextFamily, weight: TextWeight, letterSpacing: number): string {
  const ellipsis = '…';
  let text = line;
  while (text.length > 0 && measureText(`${text}${ellipsis}`, fontSize, family, weight, letterSpacing) > maxWidth) {
    text = text.slice(0, -1).trimEnd();
  }
  return `${text}${ellipsis}`;
}

export function fitText(text: string, maxWidth: number, options: FitTextOptions): FittedText {
  const family = options.family ?? 'body';
  const weight = options.weight ?? 'regular';
  const letterSpacing = options.letterSpacing ?? 0;
  const lineHeightRatio = options.lineHeightRatio ?? 1.22;
  const minFontSize = options.minFontSize ?? 12;
  let best: FittedText = { lines: [], fontSize: minFontSize, lineHeight: Math.round(minFontSize * lineHeightRatio), width: 0, height: 0 };

  for (let fontSize = Math.round(options.maxFontSize); fontSize >= minFontSize; fontSize -= 1) {
    const lines = wrapText(text, maxWidth, fontSize, family, weight, letterSpacing);
    const width = Math.max(0, ...lines.map((line) => measureText(line, fontSize, family, weight, letterSpacing)));
    if (lines.length <= options.maxLines) {
      return {
        lines,
        fontSize,
        lineHeight: Math.round(fontSize * lineHeightRatio),
        width,
        height: lines.length * Math.round(fontSize * lineHeightRatio),
      };
    }
    best = {
      lines,
      fontSize,
      lineHeight: Math.round(fontSize * lineHeightRatio),
      width,
      height: lines.length * Math.round(fontSize * lineHeightRatio),
    };
  }

  const lines = best.lines.slice(0, options.maxLines);
  if (options.truncate !== false && lines.length > 0) {
    lines[lines.length - 1] = ellipsize(lines[lines.length - 1], maxWidth, best.fontSize, family, weight, letterSpacing);
  }
  return {
    ...best,
    lines,
    width: Math.max(0, ...lines.map((line) => measureText(line, best.fontSize, family, weight, letterSpacing))),
    height: lines.length * best.lineHeight,
  };
}

export function escapeXml(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function fontFamily(family: TextFamily): string {
  return family === 'display'
    ? `${SACRINT_FONT.display}, ${SACRINT_FONT.body}, ${SACRINT_FONT.fallback}`
    : `${SACRINT_FONT.body}, ${SACRINT_FONT.display}, ${SACRINT_FONT.fallback}`;
}

export function fontWeight(weight: TextWeight): number {
  switch (weight) {
    case 'medium':
      return 500;
    case 'semibold':
      return 600;
    case 'bold':
      return 700;
    default:
      return 400;
  }
}

export interface TextBlockOptions extends FitTextOptions {
  x: number;
  y: number;
  fill: string;
  anchor?: 'start' | 'middle' | 'end';
  opacity?: number;
  className?: string;
}

export function textBlock(text: string, width: number, options: TextBlockOptions): { svg: string; fitted: FittedText } {
  const fitted = fitText(text, width, options);
  if (fitted.lines.length === 0) return { svg: '', fitted };
  const anchor = options.anchor ?? 'start';
  const anchorAttr = anchor === 'start' ? '' : ` text-anchor="${anchor}"`;
  const x = anchor === 'middle' ? options.x + width / 2 : anchor === 'end' ? options.x + width : options.x;
  const family = options.family ?? 'body';
  const weight = options.weight ?? 'regular';
  const letterSpacing = options.letterSpacing ?? 0;
  const opacity = options.opacity != null ? ` opacity="${options.opacity}"` : '';
  const className = options.className ? ` class="${escapeXml(options.className)}"` : '';

  const lines = fitted.lines
    .map((line, index) => {
      const y = options.y + index * fitted.lineHeight;
      return `<text x="${x}" y="${y}" font-family="${fontFamily(family)}" font-size="${fitted.fontSize}" font-weight="${fontWeight(weight)}" fill="${options.fill}"${letterSpacing ? ` letter-spacing="${letterSpacing}"` : ''}${anchorAttr}${opacity}${className}>${escapeXml(line)}</text>`;
    })
    .join('');

  return { svg: lines, fitted };
}

export function singleLine(
  text: string,
  x: number,
  y: number,
  options: {
    fill: string;
    fontSize: number;
    family?: TextFamily;
    weight?: TextWeight;
    letterSpacing?: number;
    anchor?: 'start' | 'middle' | 'end';
    opacity?: number;
  }
): string {
  const family = options.family ?? 'body';
  const weight = options.weight ?? 'regular';
  const anchor = options.anchor ?? 'start';
  const anchorAttr = anchor === 'start' ? '' : ` text-anchor="${anchor}"`;
  const spacing = options.letterSpacing ? ` letter-spacing="${options.letterSpacing}"` : '';
  const opacity = options.opacity != null ? ` opacity="${options.opacity}"` : '';
  return `<text x="${x}" y="${y}" font-family="${fontFamily(family)}" font-size="${options.fontSize}" font-weight="${fontWeight(weight)}" fill="${options.fill}"${spacing}${anchorAttr}${opacity}>${escapeXml(text)}</text>`;
}

export function uppercaseLabel(text: string): string {
  return (text || '').toLocaleUpperCase('es-MX');
}
