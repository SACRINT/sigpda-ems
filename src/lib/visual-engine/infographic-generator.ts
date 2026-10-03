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

const FONT = "Arial, Helvetica, sans-serif";

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Ajuste de línea determinista por ancho estimado; recorta con elipsis al exceder maxLines. */
export function wrapText(text: string, widthPx: number, fontSize: number, maxLines: number): string[] {
  const clean = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const maxChars = Math.max(8, Math.floor(widthPx / (fontSize * 0.54)));
  const all: string[] = [];
  let cur = '';
  for (const w of clean.split(' ')) {
    const word = w.length > maxChars ? `${w.slice(0, maxChars - 1)}…` : w;
    const next = cur ? `${cur} ${word}` : word;
    if (next.length <= maxChars) {
      cur = next;
    } else {
      all.push(cur);
      cur = word;
    }
  }
  if (cur) all.push(cur);
  if (all.length <= maxLines) return all;
  const lines = all.slice(0, maxLines);
  const last = lines[maxLines - 1];
  lines[maxLines - 1] = last.length >= maxChars ? `${last.slice(0, maxChars - 1)}…` : `${last}…`;
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

function header(deck: { title: string; sub: string }, p: SlidePalette, W: number): string {
  const titleLines = wrapText(deck.title, W - 120, 46, 2);
  return (
    `<rect x="0" y="0" width="${W}" height="210" fill="#${p.primary}"/>` +
    `<rect x="0" y="210" width="${W}" height="10" fill="#${p.accent}"/>` +
    textBlock(titleLines, 60, 90, 46, '#FFFFFF', { weight: 'bold' }) +
    textBlock(wrapText(deck.sub, W - 120, 24, 1), 60, 190, 24, `#${p.highlight}`)
  );
}

function callout(label: string, text: string, p: SlidePalette, W: number): string {
  const lines = wrapText(text, W - 160, 28, 2);
  return (
    `<rect x="40" y="240" width="${W - 80}" height="128" rx="18" fill="#${p.highlight}" stroke="#${p.accent}" stroke-width="3"/>` +
    textBlock([label.toUpperCase()], 70, 275, 18, `#${p.primary}`, { weight: 'bold' }) +
    textBlock(lines, 70, 312, 28, `#${p.text}`, { weight: '600' })
  );
}

function footer(m: MissionSection, wb: ActiveWorkTextbook, p: SlidePalette, W: number, H: number): string {
  const y0 = 1350;
  const items = [
    m.formativeCheckpoint?.question,
    ...(m.formativeCheckpoint?.criteriaChecklist ?? []).slice(0, 2).map((c) => `☐ ${c}`),
  ].filter((s): s is string => Boolean(s));
  let out = `<rect x="0" y="${y0}" width="${W}" height="${H - y0}" fill="#${p.primary}"/>`;
  out += textBlock(['VERIFICO LO APRENDIDO'], 60, y0 + 42, 20, `#${p.accent}`, { weight: 'bold' });
  let y = y0 + 80;
  for (const it of items.slice(0, 3)) {
    const ls = wrapText(it, W - 120, 24, 1);
    out += textBlock(ls, 60, y, 24, '#FFFFFF');
    y += 34;
  }
  const meta = [wb.coverData?.schoolName, wb.coverData?.paecProjectName ? `PAEC: ${wb.coverData.paecProjectName}` : '']
    .filter(Boolean).join('  ·  ');
  if (meta) out += textBlock(wrapText(meta, W - 120, 18, 1), 60, H - 24, 18, `#${p.highlight}`);
  return out;
}

function procesoBody(m: MissionSection, p: SlidePalette, W: number): string {
  let steps = (m.conceptZero?.solvedExample?.solutionSteps ?? []).filter(Boolean);
  if (steps.length === 0) steps = splitSentences(stripWorkbookTags(m.iDoSection?.stepByStepDemo ?? ''));
  steps = steps.slice(0, 5);
  if (steps.length === 0) steps = splitSentences(stripWorkbookTags(m.conceptZero?.coreExplanation ?? '')).slice(0, 5);

  const top = 392;
  const slot = 190;
  let out = '';
  steps.forEach((s, i) => {
    const y = top + i * slot;
    if (i < steps.length - 1) {
      out += `<line x1="90" y1="${y + 130}" x2="90" y2="${y + slot}" stroke="#${p.accent}" stroke-width="6" stroke-dasharray="10 8"/>`;
    }
    out += `<rect x="150" y="${y}" width="${W - 190}" height="${slot - 40}" rx="16" fill="#FFFFFF" stroke="#${p.accent}" stroke-width="3"/>`;
    out += `<circle cx="90" cy="${y + 55}" r="42" fill="#${p.accent}"/>`;
    out += textBlock([String(i + 1)], 90, y + 70, 42, '#FFFFFF', { weight: 'bold', anchor: 'middle' });
    out += textBlock(wrapText(s, W - 250, 32, 3), 180, y + 58, 32, `#${p.text}`);
  });
  return out;
}

function conceptualBody(m: MissionSection, p: SlidePalette, W: number): string {
  const contrast = m.conceptZero?.contrastTable?.[0];
  const cards: Array<{ label: string; text: string }> = [];
  if (m.conceptZero?.physicalAnalogy) cards.push({ label: 'Analogía', text: m.conceptZero.physicalAnalogy });
  if (m.conceptZero?.coreExplanation) cards.push({ label: 'Concepto clave', text: stripWorkbookTags(m.conceptZero.coreExplanation) });
  if (contrast) cards.push({ label: 'Error común', text: `${contrast.commonMisconception} → ${contrast.correctConcept}` });
  const app = m.realLifeConnection?.householdApplication || m.realLifeConnection?.context;
  if (app) cards.push({ label: 'En mi vida diaria', text: app });
  const four = cards.slice(0, 4);

  const cw = 520;
  const ch = 360;
  const pos = [
    { x: 40, y: 390 }, { x: W - 40 - cw, y: 390 },
    { x: 40, y: 940 }, { x: W - 40 - cw, y: 940 },
  ];
  const cx = W / 2;
  const cy = 845;
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
    out += textBlock(wrapText(c.text, cw - 48, 29, 7), x + 24, y + 108, 29, `#${p.text}`);
  });
  const topic = wrapText(m.sessionTopic || m.title, 150, 22, 3);
  out += `<circle cx="${cx}" cy="${cy}" r="88" fill="#${p.primary}" stroke="#FFFFFF" stroke-width="6"/>`;
  out += textBlock(topic, cx, cy - (topic.length - 1) * 13 + 6, 22, '#FFFFFF', { weight: 'bold', anchor: 'middle', lineHeight: 26 });
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

  const body = type === 'proceso' ? procesoBody(m, p, W) : conceptualBody(m, p, W);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeXml(m.title)}">` +
    `<rect width="${W}" height="${H}" fill="#${p.surface}"/>` +
    header({ title: `Misión ${n}: ${m.title}`, sub }, p, W) +
    (callText ? callout('Pregunta detonadora', callText, p, W) : '') +
    body +
    footer(m, workbook, p, W, H) +
    `</svg>`;

  return { type, title: m.title, missionIndex: n, svg, width: W, height: H };
}
