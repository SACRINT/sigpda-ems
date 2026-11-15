import fs from 'fs/promises';
import path from 'path';
import { Resvg } from '@resvg/resvg-js';
import { jsPDF } from 'jspdf';
import type { SacrintDeckSpec, SacrintDiagramSpec, SacrintInfographicSpec } from './spec';
import { renderDeckSvgs } from './slide-renderer';
import { infographicFilename, renderInfographicSvg } from './infographic-renderer';
import { ensureSacrintFontsRegistered, getSacrintFontFiles } from './sacrint-font-bootstrap';
import { loadEditorialFonts } from '@/lib/visual-engine/font-loader';
import { INFOGRAPHIC, SLIDE } from './tokens';
import {
  finalizeVisibleText,
  fitPedagogicalText,
  hasDanglingEnding,
  repairDanglingEnding,
} from '@/lib/editorial/pedagogical-text-fitter';
import { isValidRenderableFormula, normalizeEditorialText, toWinAnsiMathSafe } from '@/lib/editorial/text-normalization';
import { diagramFormula, diagramModelLabel } from './diagrams';

export interface RenderedPng {
  filename: string;
  buffer: Buffer;
}

export async function renderSvgToPng(svg: string, width: number, height: number, scale = 1): Promise<Buffer> {
  ensureSacrintFontsRegistered();
  const targetWidth = Math.round(width * scale);
  const targetHeight = Math.round(height * scale);
  const raster = new Resvg(svg, {
    font: {
      fontFiles: getSacrintFontFiles(),
      loadSystemFonts: false,
      defaultFontFamily: 'Inter',
      sansSerifFamily: 'Inter',
      defaultFontSize: 16,
    },
    fitTo: scale === 1 ? { mode: 'original' } : { mode: 'zoom', value: scale },
    background: 'rgba(0,0,0,0)',
    logLevel: 'error',
  });
  const rendered = raster.render();
  if (rendered.width !== targetWidth || rendered.height !== targetHeight) {
    throw new Error(
      `SACRINT render size mismatch: expected ${targetWidth}x${targetHeight}, got ${rendered.width}x${rendered.height}`
    );
  }
  return rendered.asPng();
}

export async function renderDeckPngs(deck: SacrintDeckSpec): Promise<RenderedPng[]> {
  const svgs = renderDeckSvgs(deck);
  const out: RenderedPng[] = [];
  for (const item of svgs) {
    out.push({
      filename: item.filename.replace(/\.svg$/, '.png'),
      buffer: await renderSvgToPng(item.svg, SLIDE.width, SLIDE.height),
    });
  }
  return out;
}

export async function renderInfographicPng(spec: SacrintInfographicSpec, scale = 1): Promise<RenderedPng> {
  const size = spec.format === 'wide' ? INFOGRAPHIC.wide : INFOGRAPHIC.letter;
  return {
    filename: infographicFilename(spec).replace(/\.svg$/, '.png'),
    buffer: await renderSvgToPng(renderInfographicSvg(spec), size.width, size.height, scale),
  };
}

export async function writeRenderedPngs(items: RenderedPng[], outDir: string): Promise<string[]> {
  await fs.mkdir(outDir, { recursive: true });
  const paths: string[] = [];
  for (const item of items) {
    const target = path.join(outDir, item.filename);
    await fs.writeFile(target, item.buffer);
    paths.push(target);
  }
  return paths;
}

type RGB = [number, number, number];

function hexToRgb(hex: string | undefined, fallback: RGB): RGB {
  if (!hex) return fallback;
  const cleaned = hex.replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) return fallback;
  return [
    parseInt(cleaned.slice(0, 2), 16),
    parseInt(cleaned.slice(2, 4), 16),
    parseInt(cleaned.slice(4, 6), 16),
  ];
}

function darkenForPrint(rgb: RGB, factor = 0.68): RGB {
  const lum = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
  if (lum <= 0.45) return rgb;
  return [
    Math.max(15, Math.round(rgb[0] * factor)),
    Math.max(25, Math.round(rgb[1] * factor)),
    Math.max(45, Math.round(rgb[2] * factor)),
  ];
}

let vectorHasUtfFonts = false;

function vecText(value: string | null | undefined): string {
  const raw = String(value ?? '')
    .replace(/[•▪▸]/g, '-')
    .replace(/[✓✔]/g, '');
  const normalized = finalizeVisibleText(
    normalizeEditorialText(raw, { target: 'unicode' }),
    { ensurePeriod: false }
  );
  if (vectorHasUtfFonts) {
    // Lato-Regular / Lato-Bold soportan ′, ≈, ≠, ≤, ≥, √, °, ², ³, ×, Δ, θ, α, β y tildes UTF-8
    return normalized
      .replace(/≅/g, '~=')
      .replace(/[✗✘✕]/g, '×')
      .replace(/\s+/g, ' ')
      .trim();
  }
  const winSafe = toWinAnsiMathSafe(
    normalized
      .replace(/[—–]/g, '-')
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/…/g, '...')
      .replace(/→/g, '->')
      .replace(/←/g, '<-')
  );
  return winSafe
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function drawVectorCheckBadge(doc: jsPDF, cx: number, cy: number): void {
  doc.setFillColor(16, 185, 129);
  doc.circle(cx, cy, 1.45, 'F');
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.45);
  doc.line(cx - 0.65, cy + 0.05, cx - 0.15, cy + 0.6);
  doc.line(cx - 0.15, cy + 0.6, cx + 0.75, cy - 0.55);
}

function drawFittedVectorText(
  doc: jsPDF,
  value: string,
  x: number,
  y: number,
  maxW: number,
  maxH: number,
  options: {
    fontSize?: number;
    minFontSize?: number;
    bold?: boolean;
    color?: RGB;
    lineFactor?: number;
    align?: 'left' | 'center' | 'right';
  } = {}
): number {
  const text = vecText(value);
  if (!text) return y;
  const maxFont = options.fontSize ?? 9;
  const minFont = options.minFontSize ?? 6.5;
  const floorFont = Math.max(4.8, minFont - 1.2);
  const factor = options.lineFactor ?? 1.28;
  const mmPerPt = 0.352778;
  const boxW = Math.max(8, maxW);

  doc.setFont('helvetica', options.bold ? 'bold' : 'normal');
  let chosenFont = minFont;
  let chosenFactor = factor;
  let chosenLines: string[] = [];

  for (let size = maxFont; size >= floorFont - 0.01; size -= 0.35) {
    const activeFactor = size < minFont ? Math.min(factor, 1.15) : factor;
    doc.setFontSize(size);
    const wrapped = doc.splitTextToSize(text, boxW) as string[];
    const neededH = wrapped.length * size * mmPerPt * activeFactor;
    chosenLines = wrapped;
    chosenFont = size;
    chosenFactor = activeFactor;
    if (neededH <= maxH + 0.5) break;
  }

  doc.setFontSize(chosenFont);
  if (options.color) doc.setTextColor(options.color[0], options.color[1], options.color[2]);
  const lineH = chosenFont * mmPerPt * chosenFactor;
  const maxLines = Math.max(1, Math.floor((maxH + 0.5) / lineH));
  let linesToDraw = chosenLines;

  if (chosenLines.length > maxLines) {
    const ensureDot = /[.?!)]$/.test(text);
    const visibleRaw = chosenLines.slice(0, maxLines).join(' ').trim();
    const visibleWords = visibleRaw.split(/\s+/).length;
    let fittedLines = chosenLines.slice(0, maxLines);
    let fittedSuccess = false;

    for (let targetWords = visibleWords; targetWords >= Math.max(3, visibleWords - 6); targetWords -= 1) {
      const candidate = fitPedagogicalText(text, {
        maxChars: Math.max(20, visibleRaw.length - (visibleWords - targetWords) * 4),
        maxWords: targetWords,
        ensurePeriod: ensureDot,
      });
      if (!candidate || hasDanglingEnding(candidate)) continue;
      const rewrapped = doc.splitTextToSize(vecText(candidate), boxW) as string[];
      if (rewrapped.length <= maxLines) {
        fittedLines = rewrapped;
        fittedSuccess = true;
        break;
      }
    }

    if (!fittedSuccess) {
      const repaired = vecText(repairDanglingEnding(visibleRaw, ensureDot));
      const rewrapped = doc.splitTextToSize(repaired || visibleRaw, boxW) as string[];
      fittedLines = rewrapped.slice(0, maxLines);
    }
    linesToDraw = fittedLines;
  }

  linesToDraw.forEach((line, idx) => {
    const ty = y + idx * lineH;
    const tx = options.align === 'center' ? x + maxW / 2 : options.align === 'right' ? x + maxW : x;
    doc.text(line, tx, ty, { align: options.align ?? 'left' });
  });
  return y + linesToDraw.length * lineH;
}

function drawCard(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: RGB = [255, 255, 255],
  stroke: RGB = [203, 213, 225],
  radius = 2.5
) {
  doc.setFillColor(fill[0], fill[1], fill[2]);
  doc.setDrawColor(stroke[0], stroke[1], stroke[2]);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, w, h, radius, radius, 'FD');
}

function drawVectorArrow(doc: jsPDF, x1: number, y1: number, x2: number, y2: number, color: RGB) {
  doc.setDrawColor(color[0], color[1], color[2]);
  doc.setLineWidth(0.45);
  doc.line(x1, y1, x2, y2);
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const head = 1.6;
  doc.line(
    x2,
    y2,
    x2 - head * Math.cos(angle - Math.PI / 6),
    y2 - head * Math.sin(angle - Math.PI / 6)
  );
  doc.line(
    x2,
    y2,
    x2 - head * Math.cos(angle + Math.PI / 6),
    y2 - head * Math.sin(angle + Math.PI / 6)
  );
}

function drawVectorDiagram(
  doc: jsPDF,
  diagram: SacrintDiagramSpec,
  x: number,
  y: number,
  w: number,
  h: number,
  accent: RGB,
  accent2: RGB
) {
  if (!diagram.available) return;
  drawCard(doc, x, y, w, h, [248, 250, 252], [203, 213, 225], 2);

  if (
    diagram.kind === 'linear' ||
    diagram.kind === 'quadratic' ||
    diagram.kind === 'system-2x2' ||
    diagram.kind === 'exponential'
  ) {
    const padL = 13;
    const padR = 5;
    const padT = 5;
    const padB = 11.5;
    const px = x + padL;
    const py = y + padT;
    const pw = Math.max(20, w - padL - padR);
    const ph = Math.max(16, h - padT - padB);

    const xMin = diagram.kind === 'linear' || diagram.kind === 'exponential' ? 0 : diagram.xMin;
    const xMax =
      diagram.kind === 'linear'
        ? Math.max(1, diagram.domainMax)
        : diagram.kind === 'exponential'
          ? Math.max(1, diagram.periods)
          : diagram.xMax;
    const yMin =
      diagram.kind === 'linear'
        ? Math.min(0, Math.floor(Math.min(diagram.intercept, diagram.slope * diagram.domainMax + diagram.intercept) / 5) * 5)
        : diagram.kind === 'exponential'
          ? 0
          : diagram.yMin;
    const yMax =
      diagram.kind === 'linear'
        ? Math.max(10, diagram.rangeMax)
        : diagram.kind === 'exponential'
          ? Math.max(100, diagram.yMax)
          : diagram.yMax;
    const xSpan = Math.max(1e-6, xMax - xMin);
    const ySpan = Math.max(1e-6, yMax - yMin);
    const sx = (val: number) => px + ((val - xMin) / xSpan) * pw;
    const sy = (val: number) => py + ph - ((val - yMin) / ySpan) * ph;

    // Grid & ticks
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(100, 116, 139);
    for (let i = 0; i <= 4; i++) {
      const gx = px + (pw * i) / 4;
      const gy = py + (ph * i) / 4;
      doc.line(gx, py, gx, py + ph);
      doc.line(px, gy, px + pw, gy);
      const xv = Number((xMin + (xSpan * i) / 4).toFixed(1));
      const yv = Number((yMax - (ySpan * i) / 4).toFixed(1));
      doc.text(String(xv), gx, py + ph + 3.4, { align: 'center' });
      doc.text(String(yv), px - 1.5, gy + 1, { align: 'right' });
    }

    // Axes
    doc.setDrawColor(100, 116, 139);
    doc.setLineWidth(0.4);
    doc.line(px, py, px, py + ph);
    doc.line(px, py + ph, px + pw, py + ph);
    if (yMin < 0 && yMax > 0) doc.line(px, sy(0), px + pw, sy(0));
    if (xMin < 0 && xMax > 0) doc.line(sx(0), py, sx(0), py + ph);

    if (diagram.kind === 'linear' && diagram.points.length >= 2) {
      doc.setDrawColor(accent[0], accent[1], accent[2]);
      doc.setLineWidth(0.8);
      for (let i = 1; i < diagram.points.length; i++) {
        const p1 = diagram.points[i - 1]!;
        const p2 = diagram.points[i]!;
        doc.line(sx(p1.x), sy(p1.y), sx(p2.x), sy(p2.y));
      }
      doc.setFillColor(accent2[0], accent2[1], accent2[2]);
      diagram.points.slice(0, 5).forEach((pt) => doc.circle(sx(pt.x), sy(pt.y), 0.9, 'F'));
    } else if (diagram.kind === 'quadratic' && diagram.samples.length >= 2) {
      doc.setDrawColor(accent[0], accent[1], accent[2]);
      doc.setLineWidth(0.8);
      for (let i = 1; i < diagram.samples.length; i++) {
        const p1 = diagram.samples[i - 1]!;
        const p2 = diagram.samples[i]!;
        if (
          p1.y >= yMin - ySpan * 0.1 &&
          p1.y <= yMax + ySpan * 0.1 &&
          p2.y >= yMin - ySpan * 0.1 &&
          p2.y <= yMax + ySpan * 0.1
        ) {
          doc.line(sx(p1.x), sy(p1.y), sx(p2.x), sy(p2.y));
        }
      }
      doc.setFillColor(accent2[0], accent2[1], accent2[2]);
      doc.circle(sx(diagram.vertexX), sy(diagram.vertexY), 1.1, 'F');
      doc.setFontSize(6.2);
      doc.text(
        `V(${Number(diagram.vertexX.toFixed(1))}, ${Number(diagram.vertexY.toFixed(1))})`,
        Math.min(px + pw - 16, Math.max(px + 2, sx(diagram.vertexX) + 1.5)),
        Math.max(py + 4, sy(diagram.vertexY) - 1.5)
      );
    } else if (diagram.kind === 'system-2x2') {
      const drawLineEq = (a: number, b: number, c: number, color: RGB) => {
        if (Math.abs(b) < 1e-6) return;
        const y1 = Math.max(yMin, Math.min(yMax, (c - a * xMin) / b));
        const y2 = Math.max(yMin, Math.min(yMax, (c - a * xMax) / b));
        doc.setDrawColor(color[0], color[1], color[2]);
        doc.setLineWidth(0.75);
        doc.line(sx(xMin), sy(y1), sx(xMax), sy(y2));
      };
      drawLineEq(diagram.a1, diagram.b1, diagram.c1, accent);
      drawLineEq(diagram.a2, diagram.b2, diagram.c2, accent2);
      if (diagram.intersection) {
        doc.setFillColor(16, 185, 129);
        doc.circle(sx(diagram.intersection.x), sy(diagram.intersection.y), 1.2, 'F');
        doc.setFontSize(6.2);
        doc.setTextColor(6, 95, 70);
        doc.text(
          `Sol(${diagram.intersection.x}, ${diagram.intersection.y})`,
          Math.min(px + pw - 18, sx(diagram.intersection.x) + 2),
          Math.max(py + 4, sy(diagram.intersection.y) - 1.5)
        );
      }
    } else if (diagram.kind === 'exponential') {
      doc.setDrawColor(accent2[0], accent2[1], accent2[2]);
      doc.setLineWidth(0.5);
      for (let i = 1; i < diagram.simpleSeries.length; i++) {
        const p1 = diagram.simpleSeries[i - 1]!;
        const p2 = diagram.simpleSeries[i]!;
        doc.line(sx(p1.t), sy(p1.value), sx(p2.t), sy(p2.value));
      }
      doc.setDrawColor(accent[0], accent[1], accent[2]);
      doc.setLineWidth(0.85);
      for (let i = 1; i < diagram.compoundSeries.length; i++) {
        const p1 = diagram.compoundSeries[i - 1]!;
        const p2 = diagram.compoundSeries[i]!;
        doc.line(sx(p1.t), sy(p1.value), sx(p2.t), sy(p2.value));
      }
    }

    drawFittedVectorText(doc, diagram.xLabel, px, py + ph + 7.2, pw, 3.8, {
      fontSize: 6.2,
      minFontSize: 5.5,
      color: [71, 85, 105],
      align: 'center',
    });
    return;
  }

  if (diagram.kind === 'geometry') {
    const drawHalfW = w * 0.48;
    const figX = x + 3;
    const figY = y + 3;
    const figW = drawHalfW - 4;
    const figH = h - 6;
    drawCard(doc, figX, figY, figW, figH, [255, 255, 255], accent, 1.5);

    if (diagram.variant === 'angles') {
      const vy = figY + figH * 0.68;
      const vx = figX + figW * 0.48;
      doc.setDrawColor(accent[0], accent[1], accent[2]);
      doc.setLineWidth(0.75);
      doc.line(figX + 5, vy, figX + figW - 5, vy);
      doc.setDrawColor(accent2[0], accent2[1], accent2[2]);
      doc.line(vx, vy, vx + figW * 0.28, figY + figH * 0.22);
      doc.setDrawColor(100, 116, 139);
      doc.setLineWidth(0.35);
      doc.circle(vx, vy, 5.5, 'S');
      drawFittedVectorText(doc, 'α + β = 180°', figX + 3, figY + 6.5, figW - 6, 4.5, {
        fontSize: 7.2,
        bold: true,
        color: accent2,
        align: 'center',
      });
      drawFittedVectorText(doc, diagram.secondaryLabel, figX + 3, figY + figH - 7, figW - 6, 5.5, {
        fontSize: 6.2,
        color: [71, 85, 105],
        align: 'center',
      });
    } else if (diagram.variant === 'right-triangle') {
      const ax = figX + 8;
      const ay = figY + figH - 9;
      const bx = figX + figW - 9;
      const by = ay;
      const cx = ax;
      const cy = figY + 9;
      doc.setDrawColor(accent[0], accent[1], accent[2]);
      doc.setLineWidth(0.75);
      doc.line(ax, ay, bx, by);
      doc.line(ax, ay, cx, cy);
      doc.setDrawColor(accent2[0], accent2[1], accent2[2]);
      doc.line(bx, by, cx, cy);
      doc.setDrawColor(100, 116, 139);
      doc.setLineWidth(0.35);
      doc.rect(ax, ay - 3.5, 3.5, 3.5);
      drawFittedVectorText(doc, 'c² = a² + b²', figX + 12, figY + 7, figW - 16, 4.5, {
        fontSize: 7.2,
        bold: true,
        color: accent2,
        align: 'right',
      });
      drawFittedVectorText(doc, diagram.primaryLabel, figX + 3, figY + figH - 5.5, figW - 6, 4.5, {
        fontSize: 6.2,
        color: accent,
        align: 'center',
      });
    } else {
      // Triángulos congruentes (LLL / LAL / ALA) o Teorema de Napoleón
      const t1x1 = figX + 4;
      const t1x2 = figX + figW * 0.42;
      const t1xm = figX + figW * 0.21;
      const tyB = figY + figH * 0.68;
      const tyT = figY + figH * 0.24;
      doc.setDrawColor(accent[0], accent[1], accent[2]);
      doc.setLineWidth(0.7);
      doc.triangle(t1x1, tyB, t1x2, tyB, t1xm, tyT, 'S');
      const t2x1 = figX + figW * 0.56;
      const t2x2 = figX + figW - 4;
      const t2xm = figX + figW * 0.77;
      doc.setDrawColor(accent2[0], accent2[1], accent2[2]);
      doc.triangle(t2x1, tyB, t2x2, tyB, t2xm, tyT, 'S');
      drawFittedVectorText(doc, 'ΔABC ~= ΔA′B′C′', figX + 3, figY + 6.5, figW - 6, 4.5, {
        fontSize: 7,
        bold: true,
        color: accent,
        align: 'center',
      });
      drawFittedVectorText(doc, diagram.equation || 'a/a′ = b/b′ = c/c′ = k', figX + 3, figY + figH - 7, figW - 6, 5.5, {
        fontSize: 6.4,
        bold: true,
        color: accent2,
        align: 'center',
      });
    }

    const infoX = x + drawHalfW + 3;
    const infoW = w - drawHalfW - 6;
    const cards = [
      { title: diagram.primaryLabel, detail: diagram.equation || diagram.secondaryLabel },
      ...diagram.highlights
        .filter((m) => {
          const label = (m.label || '').trim();
          // Evita que letras sueltas de un diagrama geométrico (R, A, B) se
          // interpreten como KPIs/tarjetas métricas del manual.
          return label.length > 1 && !/^[A-ZÁÉÍÓÚÑ]$/i.test(label);
        })
        .slice(0, 2)
        .map((m) => ({ title: m.label, detail: m.detail })),
    ];
    const ch = (h - 6 - (cards.length - 1) * 2.5) / cards.length;
    cards.forEach((c, idx) => {
      const cy = y + 3 + idx * (ch + 2.5);
      drawCard(doc, infoX, cy, infoW, ch, [255, 255, 255], idx === 0 ? accent : accent2, 1.4);
      drawFittedVectorText(doc, c.title, infoX + 2.5, cy + 4.5, infoW - 5, 4, {
        fontSize: 6.8,
        bold: true,
        color: idx === 0 ? accent : accent2,
      });
      drawFittedVectorText(doc, c.detail, infoX + 2.5, cy + 9.2, infoW - 5, Math.max(4, ch - 10), {
        fontSize: 6.4,
        minFontSize: 5.5,
        color: [51, 65, 85],
      });
    });
    return;
  }

  // Diagrama relacional / conceptual en vector puro para tipos no cartesianos
  let nodes: Array<{ title: string; detail: string }> = [];
  if (diagram.kind === 'concept') {
    nodes = [diagram.center, ...diagram.nodes.slice(0, 2)].map((n) => ({ title: n.label, detail: n.detail }));
  } else if (diagram.kind === 'argument') {
    nodes = [
      { title: diagram.thesis.label, detail: diagram.thesis.detail },
      { title: diagram.premises[0]?.label || 'Evidencia', detail: diagram.premises[0]?.detail || '' },
      ...(diagram.objection.detail.trim()
        ? [{ title: diagram.objection.label, detail: diagram.objection.detail }]
        : []),
      { title: diagram.conclusion.label, detail: diagram.conclusion.detail },
    ]
      .filter((n) => n.detail.trim().length > 0)
      .slice(0, 3);
  } else if (diagram.kind === 'language') {
    nodes = [diagram.input, diagram.rule, diagram.output].map((n) => ({ title: n.label, detail: n.detail }));
  } else if (diagram.kind === 'timeline') {
    nodes = diagram.events.slice(0, 3).map((e) => ({ title: e.label, detail: e.detail }));
  } else if (diagram.kind === 'reaction') {
    nodes = [...diagram.reactants.slice(0, 1), ...diagram.products.slice(0, 2)].map((n) => ({
      title: n.label,
      detail: n.detail,
    }));
  } else if (diagram.kind === 'system-map') {
    nodes = [diagram.center, ...diagram.components.slice(0, 2)].map((n) => ({ title: n.label, detail: n.detail }));
  } else if (diagram.kind === 'block-diagram') {
    nodes = [diagram.input, diagram.process, diagram.output].map((n) => ({ title: n.label, detail: n.detail }));
  } else if (diagram.kind === 'sop-flow') {
    nodes = diagram.steps.slice(0, 3).map((n) => ({ title: n.label, detail: n.detail }));
  } else if (diagram.kind === 'creative-cycle' || diagram.kind === 'training-cycle') {
    nodes = diagram.phases.slice(0, 3).map((n) => ({ title: n.label, detail: n.detail }));
  } else if (diagram.kind === 'clinical-flow' || diagram.kind === 'regulation-flow') {
    nodes = diagram.stages.slice(0, 3).map((n) => ({ title: n.label, detail: n.detail }));
  } else {
    nodes = [{ title: diagramModelLabel(diagram), detail: diagramFormula(diagram) || 'Relación conceptual.' }];
  }

  const count = Math.max(1, Math.min(3, nodes.length));
  const gap = 4;
  const nW = (w - 8 - gap * (count - 1)) / count;
  nodes.slice(0, count).forEach((node, idx) => {
    const nx = x + 4 + idx * (nW + gap);
    const ny = y + 6;
    const nh = h - 12;
    drawCard(doc, nx, ny, nW, nh, [255, 255, 255], idx === 0 ? accent : accent2, 1.8);
    drawFittedVectorText(doc, node.title, nx + 2.5, ny + 5.5, nW - 5, 8, {
      fontSize: 7.5,
      minFontSize: 6,
      bold: true,
      color: idx === 0 ? accent : accent2,
    });
    drawFittedVectorText(doc, node.detail, nx + 2.5, ny + 14.5, nW - 5, nh - 17, {
      fontSize: 7,
      minFontSize: 5.8,
      color: [51, 65, 85],
    });
    if (idx < count - 1) {
      drawVectorArrow(doc, nx + nW + 0.5, ny + nh / 2, nx + nW + gap - 0.5, ny + nh / 2, accent2);
    }
  });
}

function renderVectorWidePage(doc: jsPDF, spec: SacrintInfographicSpec) {
  const pageW = 279.4;
  const pageH = 157.16;
  const margin = 9;
  const contentW = pageW - margin * 2;
  const accent = darkenForPrint(hexToRgb(spec.pack.accent, [180, 120, 20]));
  const accent2 = darkenForPrint(hexToRgb(spec.pack.accent2, [37, 99, 235]));
  const slateDark: RGB = [15, 23, 42];
  const slateSoft: RGB = [51, 65, 85];
  const slateMuted: RGB = [100, 116, 139];

  // Clean light canvas
  doc.setFillColor(248, 250, 252);
  doc.rect(0, 0, pageW, pageH, 'F');
  doc.setFillColor(accent[0], accent[1], accent[2]);
  doc.rect(0, 0, pageW, 2.2, 'F');

  // Header
  drawFittedVectorText(
    doc,
    `${spec.pack.short} | MANUAL DE CONCEPTOS | MISIÓN ${String(spec.meta.missionNumber).padStart(2, '0')}`,
    margin,
    8.5,
    contentW * 0.65,
    4.5,
    { fontSize: 7.5, minFontSize: 6.5, bold: true, color: accent2 }
  );
  drawFittedVectorText(doc, spec.meta.blockName, margin + contentW * 0.65, 8.5, contentW * 0.35, 4.5, {
    fontSize: 7.2,
    minFontSize: 6.2,
    color: slateMuted,
    align: 'right',
  });
  const afterTitle = drawFittedVectorText(doc, spec.title, margin, 15, contentW, 11, {
    fontSize: 13.5,
    minFontSize: 9.5,
    bold: true,
    color: slateDark,
    lineFactor: 1.16,
  });
  drawFittedVectorText(doc, spec.claim, margin, Math.min(26.5, afterTitle + 1.5), contentW, 8.5, {
    fontSize: 8.2,
    minFontSize: 6.8,
    color: slateSoft,
    lineFactor: 1.2,
  });

  const topY = 36.5;
  const bodyH = pageH - topY - 10;
  const leftW = 127;
  const gap = 5.4;
  const rightX = margin + leftW + gap;
  const rightW = contentW - leftW - gap;

  // Left Column Card
  drawCard(doc, margin, topY, leftW, bodyH, [255, 255, 255], [203, 213, 225], 2.5);
  const validFormulas = (spec.formulasList ?? []).filter((f) => isValidRenderableFormula(f));
  const primaryFormula = isValidRenderableFormula(spec.formula) ? spec.formula : validFormulas[0] ?? '';

  let ly = topY + 4.5;
  if (primaryFormula) {
    drawCard(doc, margin + 3.5, ly, leftW - 7, 13.5, [241, 245, 249], accent, 1.5);
    drawFittedVectorText(doc, 'MODELO Y FORMULA CENTRAL', margin + 6, ly + 4, leftW - 12, 3.8, {
      fontSize: 6.8,
      bold: true,
      color: accent2,
    });
    drawFittedVectorText(doc, primaryFormula, margin + 6, ly + 9.8, leftW - 12, 6, {
      fontSize: 9.5,
      minFontSize: 7.2,
      bold: true,
      color: accent,
    });
    ly += 15.5;
  } else {
    const def0 = spec.conceptManual?.definitions[0];
    drawCard(doc, margin + 3.5, ly, leftW - 7, 15.5, [241, 245, 249], accent, 1.5);
    drawFittedVectorText(doc, def0?.term || 'CONCEPTO CENTRAL', margin + 6, ly + 4, leftW - 12, 3.8, {
      fontSize: 7,
      bold: true,
      color: accent2,
    });
    drawFittedVectorText(doc, def0?.definition || spec.claim, margin + 6, ly + 9, leftW - 12, 8.5, {
      fontSize: 7.8,
      minFontSize: 6.5,
      color: slateDark,
    });
    ly += 17.5;
  }

  // Key Concepts row
  const keyRules = (spec.keyConcepts ?? []).slice(0, 2);
  if (keyRules.length > 0) {
    const kW = (leftW - 7 - (keyRules.length - 1) * 3) / keyRules.length;
    keyRules.forEach((rule, idx) => {
      const kx = margin + 3.5 + idx * (kW + 3);
      drawCard(doc, kx, ly, kW, 15, [248, 250, 252], [226, 232, 240], 1.5);
      drawFittedVectorText(doc, `- ${rule}`, kx + 2.5, ly + 4.5, kW - 5, 11.5, {
        fontSize: 7.4,
        minFontSize: 6.2,
        color: slateDark,
      });
    });
    ly += 17;
  }

  const remainingLeftH = topY + bodyH - ly - 3;
  if (spec.diagram.available) {
    const varsH = spec.variables.length > 0 ? 15 : 0;
    const diagH = Math.max(30, remainingLeftH - varsH - 2);
    drawVectorDiagram(doc, spec.diagram, margin + 3.5, ly, leftW - 7, diagH, accent, accent2);
    if (varsH > 0) {
      const vY = ly + diagH + 2;
      const vars = spec.variables.slice(0, 4);
      const vW = (leftW - 7 - (vars.length - 1) * 2.5) / vars.length;
      vars.forEach((v, idx) => {
        const vx = margin + 3.5 + idx * (vW + 2.5);
        drawCard(doc, vx, vY, vW, varsH, [248, 250, 252], [226, 232, 240], 1.2);
        drawFittedVectorText(doc, v.symbol, vx + 2, vY + 4.8, vW - 4, 4.5, {
          fontSize: 8.5,
          minFontSize: 7,
          bold: true,
          color: idx % 2 === 0 ? accent : accent2,
        });
        drawFittedVectorText(doc, v.meaning, vx + 2, vY + 9.5, vW - 4, 6.5, {
          fontSize: 6.5,
          minFontSize: 5.5,
          color: slateSoft,
        });
      });
    }
  } else {
    // Concept Map + Worked Mini-Example (when no mathematical plot applies)
    const mapNodes = (spec.conceptManual?.conceptMap ?? []).slice(0, 3);
    const mapH = mapNodes.length > 0 ? 27 : 0;
    if (mapNodes.length > 0) {
      const nGap = 3.5;
      const nW = (leftW - 7 - nGap * (mapNodes.length - 1)) / mapNodes.length;
      mapNodes.forEach((node, idx) => {
        const nx = margin + 3.5 + idx * (nW + nGap);
        drawCard(doc, nx, ly, nW, mapH, [248, 250, 252], idx === 0 ? accent : [203, 213, 225], 1.5);
        drawFittedVectorText(doc, node.relation, nx + 2.2, ly + 4.2, nW - 4.4, 3.8, {
          fontSize: 6.4,
          bold: true,
          color: accent2,
        });
        drawFittedVectorText(doc, node.concept, nx + 2.2, ly + 8.5, nW - 4.4, 6, {
          fontSize: 7.4,
          minFontSize: 6.2,
          bold: true,
          color: slateDark,
        });
        drawFittedVectorText(doc, node.detail, nx + 2.2, ly + 15.5, nW - 4.4, 11, {
          fontSize: 6.6,
          minFontSize: 5.8,
          color: slateSoft,
        });
        if (idx < mapNodes.length - 1) {
          drawVectorArrow(doc, nx + nW + 0.4, ly + mapH / 2, nx + nW + nGap - 0.4, ly + mapH / 2, accent2);
        }
      });
      ly += mapH + 2.5;
    }

    const exH = Math.max(24, topY + bodyH - ly - 3);
    const ex = spec.quickExample;
    drawCard(doc, margin + 3.5, ly, leftW - 7, exH, [248, 250, 252], [203, 213, 225], 1.5);
    drawFittedVectorText(doc, 'MINI-EJEMPLO RESUELTO', margin + 6, ly + 4.5, leftW - 12, 4, {
      fontSize: 7,
      bold: true,
      color: accent,
    });
    const exText = [
      ex?.problemStatement || spec.claim,
      ...(ex?.steps ?? []).slice(0, 3).map((s, i) => `${i + 1}. ${s}`),
      ex?.interpretation ? `Resultado: ${ex.interpretation}` : '',
    ]
      .filter(Boolean)
      .join(' | ');
    drawFittedVectorText(doc, exText, margin + 6, ly + 9.5, leftW - 12, exH - 12, {
      fontSize: 7.4,
      minFontSize: 6.2,
      color: slateDark,
      lineFactor: 1.24,
    });
  }

  // Right Column Top: Procedimiento clave (4 claves, 2x2)
  const procH = 52;
  drawCard(doc, rightX, topY, rightW, procH, [255, 255, 255], [203, 213, 225], 2.5);
  drawFittedVectorText(doc, 'PROCEDIMIENTO CLAVE DE ESTUDIO', rightX + 4, topY + 5, rightW - 8, 4.5, {
    fontSize: 7.5,
    bold: true,
    color: accent,
  });
  const sGap = 3.2;
  const sW = (rightW - 8 - sGap) / 2;
  const sH = (procH - 12 - sGap) / 2;
  spec.steps.slice(0, 4).forEach((step, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const sx = rightX + 4 + col * (sW + sGap);
    const sy = topY + 9 + row * (sH + sGap);
    drawCard(doc, sx, sy, sW, sH, [248, 250, 252], [226, 232, 240], 1.5);
    drawFittedVectorText(doc, `${String(step.number).padStart(2, '0')} ${step.title}`, sx + 2.5, sy + 4.2, sW - 5, 4, {
      fontSize: 7.1,
      minFontSize: 6,
      bold: true,
      color: accent2,
    });
    drawFittedVectorText(doc, step.body, sx + 2.5, sy + 8.8, sW - 5, sH - 10, {
      fontSize: 6.9,
      minFontSize: 5.8,
      color: slateSoft,
      lineFactor: 1.2,
    });
  });

  // Right Column Bottom Split: Errores & Aplicacion (left) | Verificacion & PAEC mini (right)
  const botY = topY + procH + 4;
  const botH = topY + bodyH - botY;
  const errW = rightW * 0.54;
  const chkX = rightX + errW + 3.5;
  const chkW = rightW - errW - 3.5;

  drawCard(doc, rightX, botY, errW, botH, [254, 242, 242], [252, 165, 165], 2);
  drawFittedVectorText(doc, 'ERROR COMÚN Y PREVENCIÓN', rightX + 3.5, botY + 5, errW - 7, 4, {
    fontSize: 7.2,
    bold: true,
    color: [185, 28, 28],
  });
  const errText = spec.misconceptionFix?.error || spec.misconception;
  const corrText = spec.misconceptionFix?.correction || '';
  const afterErr = drawFittedVectorText(doc, errText, rightX + 3.5, botY + 10, errW - 7, 15, {
    fontSize: 7.2,
    minFontSize: 6,
    color: slateDark,
  });
  if (corrText) {
    drawFittedVectorText(doc, `Corrección: ${corrText}`, rightX + 3.5, Math.min(botY + 26, afterErr + 1.5), errW - 7, 13, {
      fontSize: 7,
      minFontSize: 6,
      color: slateSoft,
    });
  }
  if (spec.applicationSummary) {
    drawCard(doc, rightX + 2.5, botY + botH - 15, errW - 5, 13, [236, 253, 245], [110, 231, 183], 1.2);
    drawFittedVectorText(doc, `Cuándo se aplica: ${spec.applicationSummary}`, rightX + 4.5, botY + botH - 10.5, errW - 9, 10, {
      fontSize: 6.7,
      minFontSize: 5.8,
      color: [6, 95, 70],
    });
  }

  drawCard(doc, chkX, botY, chkW, botH, [255, 255, 255], [203, 213, 225], 2);
  drawFittedVectorText(doc, 'LISTA DE VERIFICACIÓN', chkX + 3.5, botY + 5, chkW - 7, 4, {
    fontSize: 7.2,
    bold: true,
    color: accent2,
  });
  const checklist = (spec.conceptManual?.masteryChecklist ?? spec.criteria).slice(0, 3);
  let cy = botY + 10.5;
  checklist.forEach((item) => {
    drawVectorCheckBadge(doc, chkX + 5.2, cy - 1);
    cy = drawFittedVectorText(doc, item, chkX + 8.2, cy, chkW - 11.5, 10, {
      fontSize: 6.8,
      minFontSize: 5.8,
      color: slateDark,
    }) + 1.2;
  });

  drawCard(doc, chkX + 2.5, botY + botH - 13, chkW - 5, 11, [241, 245, 249], [203, 213, 225], 1.2);
  drawFittedVectorText(
    doc,
    `PAEC: ${spec.project.artifactName}`,
    chkX + 4.5,
    botY + botH - 8.5,
    chkW - 9,
    7,
    { fontSize: 6.5, minFontSize: 5.6, bold: true, color: accent }
  );

  // Footer
  drawFittedVectorText(doc, `${spec.meta.schoolName} | ${spec.meta.teacherName}`, margin, pageH - 4, contentW * 0.65, 4, {
    fontSize: 6.8,
    color: slateMuted,
  });
  drawFittedVectorText(doc, 'SACRINT | MANUAL DE CONCEPTOS', margin + contentW * 0.65, pageH - 4, contentW * 0.35, 4, {
    fontSize: 6.8,
    color: accent,
    align: 'right',
  });
}

function renderVectorLetterPage(doc: jsPDF, spec: SacrintInfographicSpec) {
  const pageW = 215.9;
  const pageH = 279.4;
  const margin = 12;
  const contentW = pageW - margin * 2;
  const accent = darkenForPrint(hexToRgb(spec.pack.accent, [180, 120, 20]));
  const accent2 = darkenForPrint(hexToRgb(spec.pack.accent2, [37, 99, 235]));
  const slateDark: RGB = [15, 23, 42];
  const slateSoft: RGB = [51, 65, 85];
  const slateMuted: RGB = [100, 116, 139];

  doc.setFillColor(248, 250, 252);
  doc.rect(0, 0, pageW, pageH, 'F');
  doc.setFillColor(accent[0], accent[1], accent[2]);
  doc.rect(0, 0, pageW, 2.5, 'F');

  drawFittedVectorText(
    doc,
    `${spec.pack.short} | MANUAL DE CONCEPTOS | MISION ${String(spec.meta.missionNumber).padStart(2, '0')}`,
    margin,
    10,
    contentW,
    5,
    { fontSize: 8, bold: true, color: accent2 }
  );
  const afterTitle = drawFittedVectorText(doc, spec.title, margin, 17, contentW, 14, {
    fontSize: 15,
    minFontSize: 10.5,
    bold: true,
    color: slateDark,
  });
  drawFittedVectorText(doc, spec.claim, margin, Math.min(32, afterTitle + 1.5), contentW, 10, {
    fontSize: 8.6,
    minFontSize: 7,
    color: slateSoft,
  });

  let y = 44;
  const validFormulas = (spec.formulasList ?? []).filter((f) => isValidRenderableFormula(f));
  const primaryFormula = isValidRenderableFormula(spec.formula) ? spec.formula : validFormulas[0] ?? '';
  const band1H = 22;
  const fW = contentW * 0.52;
  drawCard(doc, margin, y, fW, band1H, [255, 255, 255], accent, 2);
  drawFittedVectorText(doc, primaryFormula ? 'MODELO Y FORMULA' : 'DEFINICION CENTRAL', margin + 3, y + 5, fW - 6, 4, {
    fontSize: 7.2,
    bold: true,
    color: accent2,
  });
  drawFittedVectorText(
    doc,
    primaryFormula || spec.conceptManual?.definitions[0]?.definition || spec.claim,
    margin + 3,
    y + 10.5,
    fW - 6,
    10,
    { fontSize: primaryFormula ? 9.5 : 7.8, minFontSize: 6.5, bold: Boolean(primaryFormula), color: primaryFormula ? accent : slateDark }
  );

  const kX = margin + fW + 4;
  const kW = contentW - fW - 4;
  drawCard(doc, kX, y, kW, band1H, [255, 255, 255], [203, 213, 225], 2);
  drawFittedVectorText(doc, 'IDEAS Y REGLAS CLAVE', kX + 3, y + 5, kW - 6, 4, { fontSize: 7.2, bold: true, color: accent2 });
  drawFittedVectorText(doc, (spec.keyConcepts ?? [spec.claim]).slice(0, 2).map((c) => `- ${c}`).join(' | '), kX + 3, y + 10.5, kW - 6, 10, {
    fontSize: 7.4,
    minFontSize: 6.2,
    color: slateSoft,
  });
  y += band1H + 4;

  if (spec.diagram.available) {
    const diagH = 58;
    drawVectorDiagram(doc, spec.diagram, margin, y, contentW, diagH, accent, accent2);
    y += diagH + 3;
    if (spec.variables.length > 0) {
      const vars = spec.variables.slice(0, 4);
      const vW = (contentW - (vars.length - 1) * 3) / vars.length;
      vars.forEach((v, idx) => {
        const vx = margin + idx * (vW + 3);
        drawCard(doc, vx, y, vW, 16, [255, 255, 255], [203, 213, 225], 1.5);
        drawFittedVectorText(doc, v.symbol, vx + 2.5, y + 5, vW - 5, 4.5, { fontSize: 9, bold: true, color: idx % 2 === 0 ? accent : accent2 });
        drawFittedVectorText(doc, v.meaning, vx + 2.5, y + 10, vW - 5, 6, { fontSize: 6.5, minFontSize: 5.5, color: slateSoft });
      });
      y += 20;
    }
  } else {
    const mapNodes = (spec.conceptManual?.conceptMap ?? []).slice(0, 3);
    const mapH = 34;
    if (mapNodes.length > 0) {
      const nGap = 4;
      const nW = (contentW - nGap * (mapNodes.length - 1)) / mapNodes.length;
      mapNodes.forEach((node, idx) => {
        const nx = margin + idx * (nW + nGap);
        drawCard(doc, nx, y, nW, mapH, [255, 255, 255], idx === 0 ? accent : [203, 213, 225], 1.8);
        drawFittedVectorText(doc, node.relation, nx + 2.5, y + 5, nW - 5, 4, { fontSize: 6.8, bold: true, color: accent2 });
        drawFittedVectorText(doc, node.concept, nx + 2.5, y + 10, nW - 5, 6, { fontSize: 8, minFontSize: 6.5, bold: true, color: slateDark });
        drawFittedVectorText(doc, node.detail, nx + 2.5, y + 17.5, nW - 5, 14, { fontSize: 7, minFontSize: 6, color: slateSoft });
        if (idx < mapNodes.length - 1) drawVectorArrow(doc, nx + nW + 0.5, y + mapH / 2, nx + nW + nGap - 0.5, y + mapH / 2, accent2);
      });
      y += mapH + 4;
    }
    const ex = spec.quickExample;
    const exH = 38;
    drawCard(doc, margin, y, contentW, exH, [255, 255, 255], [203, 213, 225], 2);
    drawFittedVectorText(doc, 'MINI-EJEMPLO RESUELTO', margin + 3.5, y + 5.5, contentW - 7, 4.5, { fontSize: 7.5, bold: true, color: accent });
    const exBody = [
      ex?.problemStatement || spec.claim,
      ...(ex?.steps ?? []).slice(0, 3).map((s, i) => `${i + 1}. ${s}`),
      ex?.interpretation ? `Resultado: ${ex.interpretation}` : '',
    ]
      .filter(Boolean)
      .join(' | ');
    drawFittedVectorText(doc, exBody, margin + 3.5, y + 11.5, contentW - 7, exH - 13, { fontSize: 7.6, minFontSize: 6.4, color: slateDark });
    y += exH + 4;
  }

  const procH = 54;
  drawCard(doc, margin, y, contentW, procH, [255, 255, 255], [203, 213, 225], 2);
  drawFittedVectorText(doc, 'PROCEDIMIENTO CLAVE DE ESTUDIO', margin + 3.5, y + 5.5, contentW - 7, 4.5, { fontSize: 7.5, bold: true, color: accent });
  const sGap = 3.5;
  const sW = (contentW - 7 - sGap) / 2;
  const sH = (procH - 13 - sGap) / 2;
  spec.steps.slice(0, 4).forEach((step, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const sx = margin + 3.5 + col * (sW + sGap);
    const sy = y + 10 + row * (sH + sGap);
    drawCard(doc, sx, sy, sW, sH, [248, 250, 252], [226, 232, 240], 1.5);
    drawFittedVectorText(doc, `${String(step.number).padStart(2, '0')} ${step.title}`, sx + 2.5, sy + 4.5, sW - 5, 4, { fontSize: 7.2, bold: true, color: accent2 });
    drawFittedVectorText(doc, step.body, sx + 2.5, sy + 9.2, sW - 5, sH - 10, { fontSize: 7, minFontSize: 6, color: slateSoft });
  });
  y += procH + 4;

  const botH = Math.max(44, pageH - y - 14);
  const errW = contentW * 0.51;
  const chkX = margin + errW + 4;
  const chkW = contentW - errW - 4;
  drawCard(doc, margin, y, errW, botH, [254, 242, 242], [252, 165, 165], 2);
  drawFittedVectorText(doc, 'ERROR COMÚN Y CÓMO EVITARLO', margin + 3, y + 5, errW - 6, 4, { fontSize: 7.2, bold: true, color: [185, 28, 28] });
  const errAfter = drawFittedVectorText(doc, spec.misconceptionFix?.error || spec.misconception, margin + 3, y + 10, errW - 6, 15, { fontSize: 7.4, minFontSize: 6.2, color: slateDark });
  if (spec.misconceptionFix?.correction) {
    drawFittedVectorText(doc, `Corrección: ${spec.misconceptionFix.correction}`, margin + 3, Math.min(y + 26, errAfter + 1.5), errW - 6, 12, { fontSize: 7.1, minFontSize: 6, color: slateSoft });
  }
  if (spec.applicationSummary) {
    drawCard(doc, margin + 2.5, y + botH - 15, errW - 5, 12.5, [236, 253, 245], [110, 231, 183], 1.2);
    drawFittedVectorText(doc, `Aplicación: ${spec.applicationSummary}`, margin + 4.5, y + botH - 10.5, errW - 9, 9.5, { fontSize: 6.8, minFontSize: 5.8, color: [6, 95, 70] });
  }

  drawCard(doc, chkX, y, chkW, botH, [255, 255, 255], [203, 213, 225], 2);
  drawFittedVectorText(doc, 'LISTA DE VERIFICACIÓN', chkX + 3, y + 5, chkW - 6, 4, { fontSize: 7.2, bold: true, color: accent2 });
  const checklist = (spec.conceptManual?.masteryChecklist ?? spec.criteria).slice(0, 3);
  let cy = y + 10.5;
  checklist.forEach((item) => {
    drawVectorCheckBadge(doc, chkX + 4.8, cy - 1);
    cy = drawFittedVectorText(doc, item, chkX + 7.8, cy, chkW - 10.5, 11, { fontSize: 7, minFontSize: 6, color: slateDark }) + 1.5;
  });
  drawCard(doc, chkX + 2.5, y + botH - 13, chkW - 5, 10.5, [241, 245, 249], [203, 213, 225], 1.2);
  drawFittedVectorText(doc, `PAEC: ${spec.project.artifactName}`, chkX + 4.5, y + botH - 8.5, chkW - 9, 7, { fontSize: 6.6, minFontSize: 5.8, bold: true, color: accent });

  drawFittedVectorText(doc, `${spec.meta.schoolName} | ${spec.meta.teacherName}`, margin, pageH - 6, contentW * 0.65, 4, { fontSize: 7, color: slateMuted });
  drawFittedVectorText(doc, 'SACRINT | MANUAL DE CONCEPTOS', margin + contentW * 0.65, pageH - 6, contentW * 0.35, 4, { fontSize: 7, color: accent, align: 'right' });
}

export function renderSacrintInfographicsVectorPdf(
  specs: SacrintInfographicSpec[],
  layout: 'letter' | 'wide' = 'wide'
): Buffer {
  if (!Array.isArray(specs) || specs.length === 0) {
    throw new Error('No se proporcionaron infografías para generar el PDF vectorial.');
  }
  const isWide = layout === 'wide';
  const doc = new jsPDF({
    orientation: isWide ? 'landscape' : 'portrait',
    unit: 'mm',
    format: isWide ? [279.4, 157.16] : 'letter',
    compress: true,
  });
  vectorHasUtfFonts = loadEditorialFonts(doc);

  doc.setProperties({
    title: vecText(specs[0]?.title || 'Manual de Conceptos SACRINT'),
    subject: 'Manual de conceptos didácticos SACRINT',
  });

  specs.forEach((rawSpec, index) => {
    const spec: SacrintInfographicSpec = { ...rawSpec, format: layout, theme: 'light' };
    if (index > 0) {
      doc.addPage(isWide ? [279.4, 157.16] : 'letter', isWide ? 'landscape' : 'portrait');
    }
    if (isWide) {
      renderVectorWidePage(doc, spec);
    } else {
      renderVectorLetterPage(doc, spec);
    }
  });

  return Buffer.from(doc.output('arraybuffer'));
}

export async function renderCombinedSacrintInfographicsPdf(
  specs: SacrintInfographicSpec[],
  layout: 'letter' | 'wide' = 'wide'
): Promise<Buffer> {
  return renderSacrintInfographicsVectorPdf(specs, layout);
}
