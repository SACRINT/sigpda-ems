/**
 * infographic-generator.ts — Generador determinístico de infografías pedagógicas (SVG vectorial).
 * SIGPDA-EMS · Motor Visual (H-320)
 *
 * Una infografía por misión del Libro de Bloque, en proporción Carta (1200 x 1553),
 * para imprimir o proyectar. 0 tokens de IA. Invariante B-001: solo contenido del libro.
 *
 * Tipologías:
 *  - 'proceso'    : pasos secuenciales (STEM y Formación Laboral).
 *  - 'conceptual' : nodo central con ramas (Humanidades, Sociales y General).
 */

import type { ActiveWorkTextbook, MissionSection } from '@/types/work-textbook';
import { stripWorkbookTags } from '@/lib/guide-engine/workbook-tags';
import { getPalette, type SlidePalette } from '@/lib/presentation-engine/slide-templates';
import { stripMissionPrefix } from '@/lib/presentation-engine/slide-model';

export type InfographicType = 'proceso' | 'conceptual';

export interface Infographic {
  type: InfographicType;
  title: string;
  missionIndex: number;
  svg: string;
  width: number;
  height: number;
}

export const INFOGRAPHIC_WIDTH = 1200;
export const INFOGRAPHIC_HEIGHT = 1553; // proporción Carta (11 / 8.5)

const FONT = "Montserrat, Lato, Arial, Helvetica, sans-serif";

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Ancho medio por carácter (en em) calibrado para Montserrat/Lato/Arial.
 * Con 0.54 fijo las líneas desbordaban el viewBox y se recortaban "duro" en el borde.
 * Valores conservadores: si la fuente real es más angosta, solo sobra holgura.
 */
const CHAR_WIDTH_EM: Record<string, number> = {
  normal: 0.58,
  '400': 0.58,
  '500': 0.6,
  '600': 0.62,
  '700': 0.64,
  bold: 0.64,
};

function charWidthEm(weight: string): number {
  const key = (weight ?? 'normal').toLowerCase();
  if (CHAR_WIDTH_EM[key]) return CHAR_WIDTH_EM[key];
  const n = Number(key);
  if (!Number.isNaN(n) && n >= 600) return 0.64;
  if (!Number.isNaN(n) && n >= 500) return 0.6;
  return 0.58;
}

/**
 * Ajuste de línea determinista por ancho estimado; recorta con elipsis al exceder maxLines.
 * `weight` debe coincidir con el font-weight del render (bold/600/normal) para que el
 * cálculo de caracteres por línea corresponda al ancho real de los glifos.
 */
export function wrapTextAll(
  text: string,
  widthPx: number,
  fontSize: number,
  weight: string = 'normal'
): string[] {
  const clean = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const maxChars = Math.max(8, Math.floor(widthPx / (fontSize * charWidthEm(weight))));
  const all: string[] = [];
  let cur = '';
  for (const w of clean.split(' ')) {
    if (w.length > maxChars) {
      if (cur) {
        all.push(cur);
        cur = '';
      }
      let rest = w;
      while (rest.length > maxChars) {
        all.push(rest.slice(0, maxChars));
        rest = rest.slice(maxChars);
      }
      cur = rest;
      continue;
    }
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= maxChars) {
      cur = next;
    } else {
      all.push(cur);
      cur = w;
    }
  }
  if (cur) all.push(cur);
  return all;
}

export function wrapText(
  text: string,
  widthPx: number,
  fontSize: number,
  maxLines: number,
  weight: string = 'normal'
): string[] {
  const all = wrapTextAll(text, widthPx, fontSize, weight);
  if (all.length <= maxLines) return all;
  const maxChars = Math.max(8, Math.floor(widthPx / (fontSize * charWidthEm(weight))));
  const lines = all.slice(0, maxLines);
  const last = lines[maxLines - 1];
  const space = last.lastIndexOf(' ');
  if (space > 0 && last.slice(0, space).length >= Math.floor(maxChars * 0.5)) {
    lines[maxLines - 1] = `${last.slice(0, space)}…`;
  } else {
    lines[maxLines - 1] = last.length >= maxChars ? `${last.slice(0, maxChars - 1)}…` : `${last}…`;
  }
  return lines;
}

function textBlock(
  lines: string[], x: number, y: number, fontSize: number, color: string,
  opts: { weight?: string; anchor?: string; lineHeight?: number } = {}
): string {
  const lh = opts.lineHeight ?? Math.round(fontSize * 1.28);
  return lines
    .map((l, i) =>
      `<text x="${x}" y="${y + i * lh}" font-family="${FONT}" font-size="${fontSize}" fill="${color}"` +
      ` font-weight="${opts.weight ?? 'normal'}" text-anchor="${opts.anchor ?? 'start'}">${escapeXml(l)}</text>`
    )
    .join('');
}

function splitSentences(text: string): string[] {
  return (text ?? '')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function header(deck: { title: string; sub: string }, p: SlidePalette, W: number): { svg: string; height: number } {
  let titleFont = 40;
  let titleLines = wrapTextAll(deck.title, W - 120, titleFont, 'bold');
  while (titleLines.length > 3 && titleFont > 30) {
    titleFont -= 2;
    titleLines = wrapTextAll(deck.title, W - 120, titleFont, 'bold');
  }
  const titleLineHeight = Math.round(titleFont * 1.15);
  const subFont = 22;
  const subLines = wrapTextAll(deck.sub, W - 120, subFont);
  const titleStart = 70;
  const subStart = titleStart + Math.max(0, titleLines.length - 1) * titleLineHeight + 34;
  const height = Math.max(
    210,
    subStart + Math.max(0, subLines.length - 1) * 28 + 34
  );
  const svg =
    `<rect x="0" y="0" width="${W}" height="${height}" fill="#${p.primary}"/>` +
    `<rect x="0" y="${height}" width="${W}" height="10" fill="#${p.accent}"/>` +
    textBlock(titleLines, 60, titleStart, titleFont, '#FFFFFF', {
      weight: 'bold',
      lineHeight: titleLineHeight,
    }) +
    textBlock(subLines, 60, subStart, subFont, `#${p.highlight}`, { lineHeight: 28 });
  return { svg, height };
}

function callout(
  label: string,
  text: string,
  p: SlidePalette,
  W: number,
  top: number
): { svg: string; height: number } {
  let font = 26;
  let lines = wrapTextAll(text, W - 160, font, '600');
  while (lines.length > 6 && font > 20) {
    font -= 2;
    lines = wrapTextAll(text, W - 160, font, '600');
  }
  const lineHeight = Math.round(font * 1.2);
  const height = Math.max(140, 64 + lines.length * lineHeight + 18);
  const svg =
    `<rect x="40" y="${top}" width="${W - 80}" height="${height}" rx="18" fill="#${p.highlight}" stroke="#${p.accent}" stroke-width="3"/>` +
    textBlock([label.toUpperCase()], 70, top + 32, 18, `#${p.primary}`, { weight: 'bold' }) +
    textBlock(lines, 70, top + 66, font, `#${p.text}`, { weight: '600', lineHeight });
  return { svg, height };
}

function footer(
  m: MissionSection,
  wb: ActiveWorkTextbook,
  p: SlidePalette,
  W: number,
  H: number
): { svg: string; top: number } {
  const font = 21;
  const LH = 26;
  const items = [
    m.formativeCheckpoint?.question,
    ...(m.formativeCheckpoint?.criteriaChecklist ?? []).map((c) => `☐ ${c}`),
  ].filter((s): s is string => Boolean(s));

  const rendered = items.map((it) => {
    const isCheck = it.startsWith('\u2610 ');
    const raw = isCheck ? it.slice(2) : it;
    return {
      isCheck,
      lines: wrapTextAll(raw, isCheck ? W - 160 : W - 120, font),
    };
  });

  const meta = [wb.coverData?.schoolName, wb.coverData?.paecProjectName ? `PAEC: ${wb.coverData.paecProjectName}` : '']
    .filter(Boolean).join('  ·  ');
  const metaLines = meta ? wrapTextAll(meta, W - 120, 18) : [];
  const metaHeight = metaLines.length * 20;

  const contentHeight = rendered.reduce((sum, item) => sum + Math.max(1, item.lines.length) * LH + 8, 0);
  const computedHeight = 74 + contentHeight + metaHeight + 24;
  const height = Math.max(233, computedHeight);
  const y0 = H - height;

  let out = `<rect x="0" y="${y0}" width="${W}" height="${height}" fill="#${p.primary}"/>`;
  out += textBlock(['VERIFICO LO APRENDIDO'], 60, y0 + 42, 20, `#${p.accent}`, { weight: 'bold' });

  let y = y0 + 78;
  for (const item of rendered) {
    if (item.isCheck) {
      out += `<rect x="60" y="${y - 16}" width="18" height="18" rx="3" fill="none" stroke="#${p.accent}" stroke-width="2.5"/>`;
      out += textBlock(item.lines, 90, y, font, '#FFFFFF', { lineHeight: LH });
    } else {
      out += textBlock(item.lines, 60, y, font, '#FFFFFF', { lineHeight: LH });
    }
    y += Math.max(1, item.lines.length) * LH + 8;
  }

  if (metaLines.length > 0) {
    const metaY = H - 20 - (metaLines.length - 1) * 20;
    out += textBlock(metaLines, 60, metaY, 18, `#${p.highlight}`, { lineHeight: 20 });
  }

  return { svg: out, top: y0 };
}

function procesoBody(m: MissionSection, p: SlidePalette, W: number, top: number, bottom: number): string {
  let steps = (m.conceptZero?.solvedExample?.solutionSteps ?? []).filter(Boolean);
  if (steps.length === 0) steps = splitSentences(stripWorkbookTags(m.iDoSection?.stepByStepDemo ?? ''));
  steps = steps.slice(0, 5);
  if (steps.length === 0) steps = splitSentences(stripWorkbookTags(m.conceptZero?.coreExplanation ?? '')).slice(0, 5);
  if (steps.length === 0) return '';

  const available = Math.max(120, bottom - top);
  const fonts = [26, 24, 22, 20, 18, 16, 14, 12, 11, 10];
  let font = fonts[fonts.length - 1];
  let lineHeight = Math.round(font * 1.24);
  let gap = 8;
  let layouts: Array<{ lines: string[]; height: number }> = [];
  let total = 0;

  for (const candidate of fonts) {
    const candidateLh = Math.round(candidate * 1.24);
    const candidateGap = Math.max(8, Math.round(candidate * 0.45));
    const candidateLayouts = steps.map((step) => {
      const lines = wrapTextAll(step, W - 250, candidate);
      return {
        lines,
        height: Math.max(84, lines.length * candidateLh + 28),
      };
    });
    const candidateTotal =
      candidateLayouts.reduce((sum, item) => sum + item.height, 0) +
      candidateGap * (steps.length - 1);
    if (candidateTotal <= available || candidate === fonts[fonts.length - 1]) {
      font = candidate;
      lineHeight = candidateLh;
      gap = candidateGap;
      layouts = candidateLayouts;
      total = candidateTotal;
      break;
    }
  }

  let y = top + Math.max(0, (available - total) / 2);
  let out = '';
  layouts.forEach((layout, i) => {
    if (i < layouts.length - 1) {
      out += `<line x1="90" y1="${y + 55}" x2="90" y2="${y + layout.height + gap}" stroke="#${p.accent}" stroke-width="6" stroke-dasharray="10 8"/>`;
    }
    out += `<rect x="150" y="${y}" width="${W - 190}" height="${layout.height}" rx="16" fill="#FFFFFF" stroke="#${p.accent}" stroke-width="3"/>`;
    out += `<circle cx="90" cy="${y + 55}" r="42" fill="#${p.accent}"/>`;
    out += textBlock([String(i + 1)], 90, y + 70, 42, '#FFFFFF', { weight: 'bold', anchor: 'middle' });
    const textHeight = layout.lines.length * lineHeight;
    const textY = y + Math.max(34, (layout.height - textHeight) / 2 + font);
    out += textBlock(layout.lines, 180, textY, font, `#${p.text}`, { lineHeight });
    y += layout.height + gap;
  });
  return out;
}

function conceptualBody(m: MissionSection, p: SlidePalette, W: number, top: number, bottom: number): string {
  const contrast = m.conceptZero?.contrastTable?.[0];
  const cards: Array<{ label: string; text: string }> = [];
  if (m.conceptZero?.physicalAnalogy) cards.push({ label: 'Analogía', text: m.conceptZero.physicalAnalogy });
  if (m.conceptZero?.coreExplanation) cards.push({ label: 'Concepto clave', text: stripWorkbookTags(m.conceptZero.coreExplanation) });
  if (contrast) cards.push({ label: 'Error común', text: `${contrast.commonMisconception} → ${contrast.correctConcept}` });
  const app = m.realLifeConnection?.householdApplication || m.realLifeConnection?.context;
  if (app) cards.push({ label: 'En mi vida diaria', text: app });
  const four = cards.slice(0, 4);
  if (four.length === 0) return '';

  const cw = 520;
  const gap = 32;
  const available = Math.max(320, bottom - top);
  const ch = Math.max(260, Math.floor((available - gap) / 2));
  const pos = [
    { x: 40, y: top }, { x: W - 40 - cw, y: top },
    { x: 40, y: top + ch + gap }, { x: W - 40 - cw, y: top + ch + gap },
  ];
  const cx = W / 2;
  const cy = top + ch + gap / 2;
  let out = '';

  four.forEach((c, i) => {
    const { x, y } = pos[i];
    const tx = x < cx ? x + cw : x;
    const ty = y < cy ? y + ch : y;
    out += `<line x1="${cx}" y1="${cy}" x2="${tx}" y2="${ty}" stroke="#${p.accent}" stroke-width="5"/>`;
  });

  four.forEach((c, i) => {
    const { x, y } = pos[i];
    out += `<rect x="${x}" y="${y}" width="${cw}" height="${ch}" rx="20" fill="#FFFFFF" stroke="#${p.accent}" stroke-width="3"/>`;
    out += `<rect x="${x}" y="${y}" width="${cw}" height="56" rx="20" fill="#${p.accent}"/>`;
    out += `<rect x="${x}" y="${y + 30}" width="${cw}" height="26" fill="#${p.accent}"/>`;
    out += textBlock([c.label], x + 24, y + 38, 26, '#FFFFFF', { weight: 'bold' });

    const textTop = y + 82;
    const textSpace = ch - 100;
    const fonts = [26, 24, 22, 20, 18, 16, 14, 12, 10];
    let font = fonts[fonts.length - 1];
    let lines = wrapTextAll(c.text, cw - 48, font);
    for (const candidate of fonts) {
      const candidateLines = wrapTextAll(c.text, cw - 48, candidate);
      if (candidateLines.length * Math.round(candidate * 1.22) <= textSpace) {
        font = candidate;
        lines = candidateLines;
        break;
      }
    }
    out += textBlock(lines, x + 24, textTop, font, `#${p.text}`, {
      lineHeight: Math.round(font * 1.22),
    });
  });

  let topicFont = 20;
  let topic = wrapTextAll(m.sessionTopic || m.title, 150, topicFont, 'bold');
  while (topic.length > 6 && topicFont > 13) {
    topicFont -= 1;
    topic = wrapTextAll(m.sessionTopic || m.title, 150, topicFont, 'bold');
  }
  const topicLh = Math.round(topicFont * 1.18);
  out += `<circle cx="${cx}" cy="${cy}" r="88" fill="#${p.primary}" stroke="#FFFFFF" stroke-width="6"/>`;
  out += textBlock(topic, cx, cy - ((topic.length - 1) * topicLh) / 2 + topicFont / 3, topicFont, '#FFFFFF', {
    weight: 'bold',
    anchor: 'middle',
    lineHeight: topicLh,
  });
  return out;
}

/**
 * Genera la infografía de una misión (índice 0-based dentro de workbook.missions).
 * Devuelve null si la misión no existe.
 */
export function buildInfographic(
  workbook: ActiveWorkTextbook,
  missionPos: number,
  opts: { component?: string } = {}
): Infographic | null {
  const m = workbook.missions?.[missionPos];
  if (!m) return null;
  const W = INFOGRAPHIC_WIDTH;
  const H = INFOGRAPHIC_HEIGHT;
  const cover = workbook.coverData;
  const p = getPalette(cover?.subjectName ?? '', opts.component);
  const type: InfographicType = p.area === 'stem' || p.area === 'laboral' ? 'proceso' : 'conceptual';
  const n = m.missionIndex || missionPos + 1;

  const sub = [cover?.subjectName, cover?.semester ? `Semestre ${cover.semester}` : '', `Bloque ${cover?.blockNumber ?? workbook.blockIndex + 1}`]
    .filter(Boolean).join(' · ');
  const callText = m.phenomenonHook?.detonatingQuestion || m.sessionFocus || '';

  const headerLayout = header({ title: `Misión ${n}: ${stripMissionPrefix(m.title)}`, sub }, p, W);
  const footerLayout = footer(m, workbook, p, W, H);
  let bodyTop = headerLayout.height + 26;
  let calloutSvg = '';

  if (callText) {
    const calloutLayout = callout('Pregunta detonadora', callText, p, W, bodyTop);
    calloutSvg = calloutLayout.svg;
    bodyTop += calloutLayout.height + 24;
  }

  const bodyBottom = Math.max(bodyTop + 120, footerLayout.top - 20);
  const body = type === 'proceso'
    ? procesoBody(m, p, W, bodyTop, bodyBottom)
    : conceptualBody(m, p, W, bodyTop, bodyBottom);

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeXml(m.title)}">` +
    `<rect width="${W}" height="${H}" fill="#${p.surface}"/>` +
    headerLayout.svg +
    calloutSvg +
    body +
    footerLayout.svg +
    `</svg>`;

  return { type, title: m.title, missionIndex: n, svg, width: W, height: H };
}
