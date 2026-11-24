import type {
  ExponentialDiagramSpec,
  GeometryDiagramSpec,
  LinearDiagramSpec,
  QuadraticDiagramSpec,
  System2x2DiagramSpec,
} from '../types';
import { niceTickStep } from '../diagrams/shared';
import { resolveLightAccent, SACRINT, SACRINT_LIGHT } from '../tokens';
import { escapeXml, measureText, singleLine, textBlock, uppercaseLabel } from '../text-layout';
import {
  circle,
  line,
  panel,
  path,
  rect,
  themeColors,
  type DiagramRenderOptions,
} from './core-primitives';

function formatTickValue(value: number): string {
  const cleanVal = Math.abs(value) < 1e-9 ? 0 : Number(value.toFixed(1));
  if (Math.abs(cleanVal) >= 10000) return `${Number((cleanVal / 1000).toFixed(1))}k`;
  return String(cleanVal);
}

export function linearGraph(
  diagram: LinearDiagramSpec,
  x: number,
  y: number,
  width: number,
  height: number,
  options: DiagramRenderOptions = {}
): string {
  const theme = options.theme ?? 'dark';
  const tc = themeColors(theme);
  const accent = options.accent ?? (theme === 'light' ? resolveLightAccent(SACRINT.gold) : SACRINT.gold);
  const accent2 = options.accent2 ?? (theme === 'light' ? resolveLightAccent(SACRINT.blue) : SACRINT.blue);
  const compact = options.compact ?? false;
  const padLeft = compact ? 50 : 64;
  const padBottom = compact ? 42 : 52;
  const padTop = compact ? 16 : 24;
  const padRight = 18;
  const plotX = x + padLeft;
  const plotY = y + padTop;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;
  const xMax = Math.max(1, diagram.domainMax);
  const yMax = Math.max(1, diagram.rangeMax);
  const sx = (value: number) => plotX + (value / xMax) * plotW;
  const sy = (value: number) => plotY + plotH - (value / yMax) * plotH;
  const parts: string[] = [];

  parts.push(rect(plotX, plotY, plotW, plotH, `fill="${tc.plotFill}" fill-opacity="${tc.plotOpacity}" rx="6"`));

  const xStep = xMax <= 10 ? 2 : niceTickStep(xMax, 5);
  const yStep = yMax <= 10 ? 2 : niceTickStep(yMax, 5);
  for (let value = 0; value <= xMax + xStep * 0.01; value += xStep) {
    const xv = Math.min(xMax, Number(value.toFixed(2)));
    parts.push(line(sx(xv), plotY, sx(xv), plotY + plotH, tc.pal.strokeSoft, 1, 'stroke-opacity="0.4"'));
    parts.push(singleLine(formatTickValue(xv), sx(xv), plotY + plotH + 20, { fill: tc.pal.muted, fontSize: compact ? 10 : 11, anchor: 'middle' }));
  }
  for (let value = 0; value <= yMax + yStep * 0.01; value += yStep) {
    const yv = Math.min(yMax, Number(value.toFixed(2)));
    parts.push(line(plotX, sy(yv), plotX + plotW, sy(yv), tc.pal.strokeSoft, 1, 'stroke-opacity="0.4"'));
    parts.push(singleLine(formatTickValue(yv), plotX - 10, sy(yv) + 4, { fill: tc.pal.muted, fontSize: compact ? 10 : 11, anchor: 'end' }));
  }

  parts.push(line(plotX, plotY, plotX, plotY + plotH, tc.pal.textSoft, 1.5, 'stroke-opacity="0.85"'));
  parts.push(line(plotX, plotY + plotH, plotX + plotW, plotY + plotH, tc.pal.textSoft, 1.5, 'stroke-opacity="0.85"'));

  if (diagram.available) {
    const rawStartY = diagram.intercept;
    const rawEndY = diagram.slope * xMax + diagram.intercept;
    const startY = sy(Math.max(0, Math.min(yMax, rawStartY)));
    const endY = sy(Math.max(0, Math.min(yMax, rawEndY)));
    parts.push(line(sx(0), startY, sx(xMax), endY, 'url(#sacrint-accent)', compact ? 3 : 4));
    parts.push(circle(sx(0), startY, compact ? 4 : 5, accent, `stroke="${tc.dotStroke}" stroke-width="2"`));

    if (diagram.targetY != null && diagram.targetY > 0 && diagram.targetY <= yMax) {
      const ty = sy(diagram.targetY);
      parts.push(line(plotX, ty, plotX + plotW, ty, accent2, 1.4, 'stroke-dasharray="6 5" stroke-opacity="0.7"'));
      parts.push(singleLine(`Meta = ${formatTickValue(diagram.targetY)}`, plotX + plotW - 8, ty - 7, { fill: accent2, fontSize: compact ? 9 : 11, weight: 'semibold', anchor: 'end' }));
    }

    for (const point of diagram.points) {
      if (point.x < 0 || point.x > xMax || point.y < 0 || point.y > yMax) continue;
      const px = sx(point.x);
      const py = sy(point.y);
      parts.push(circle(px, py, compact ? 4 : 5.5, accent2, `stroke="${tc.dotStroke}" stroke-width="2"`));
      const atLeft = point.x <= xMax * 0.08;
      const atRight = point.x >= xMax * 0.85;
      const labelX = atLeft ? px + 12 : atRight ? px - 12 : px + 10;
      const labelY = py < plotY + 26 ? py + 20 : atLeft ? py + 20 : py - 10;
      const anchor = atRight ? 'end' : 'start';
      const labelText = `(${point.x}, ${point.y})`;
      const labelSize = compact ? 10 : 12;
      const labelWidth = measureText(labelText, labelSize, 'body', 'medium') + 10;
      const labelRectX = anchor === 'end' ? labelX - labelWidth + 4 : labelX - 5;
      parts.push(rect(labelRectX, labelY - labelSize, labelWidth, labelSize + 6, `rx="3" fill="${tc.labelBg}" fill-opacity="0.88"`));
      parts.push(singleLine(labelText, labelX, labelY, { fill: tc.pal.textSoft, fontSize: labelSize, weight: 'medium', anchor }));
    }

    if (options.showTriangle !== false) {
      const x1 = diagram.points.find((point) => point.x === 4) ?? diagram.points[1] ?? diagram.points[0];
      const x0 = diagram.points[0];
      if (x0 && x1 && x1.x !== x0.x && x1.y <= yMax) {
        parts.push(line(sx(x0.x), sy(x1.y), sx(x1.x), sy(x1.y), accent, 1, 'stroke-dasharray="6 6" stroke-opacity="0.75"'));
        parts.push(line(sx(x1.x), sy(x0.y), sx(x1.x), sy(x1.y), accent2, 1, 'stroke-dasharray="6 6" stroke-opacity="0.75"'));
        parts.push(singleLine(`Δx = ${x1.x - x0.x}`, sx((x0.x + x1.x) / 2), sy(x1.y) - 10, { fill: accent, fontSize: compact ? 10 : 12, weight: 'semibold', anchor: 'middle' }));
        parts.push(singleLine(`Δy = ${Number((x1.y - x0.y).toFixed(2))}`, sx(x1.x) + 10, sy((x0.y + x1.y) / 2), { fill: accent2, fontSize: compact ? 10 : 12, weight: 'semibold' }));
      }
    }
  } else {
    parts.push(line(plotX + plotW * 0.2, plotY + plotH * 0.48, plotX + plotW * 0.8, plotY + plotH * 0.48, tc.pal.strokeSoft, 1, 'stroke-dasharray="8 8" stroke-opacity="0.6"'));
  }

  parts.push(singleLine(uppercaseLabel(diagram.xLabel), plotX + plotW / 2, y + height - 6, { fill: tc.pal.muted, fontSize: compact ? 10 : 11, weight: 'semibold', letterSpacing: 1.4, anchor: 'middle' }));
  const rotateX = x + 14;
  const rotateY = plotY + plotH / 2;
  parts.push(`<text x="${rotateX}" y="${rotateY}" font-family="Inter, sans-serif" font-size="${compact ? 10 : 11}" font-weight="600" letter-spacing="1.4" fill="${tc.pal.muted}" text-anchor="middle" transform="rotate(-90 ${rotateX} ${rotateY})">${escapeXml(uppercaseLabel(diagram.yLabel))}</text>`);

  return parts.join('');
}

export function quadraticGraph(
  diagram: QuadraticDiagramSpec,
  x: number,
  y: number,
  width: number,
  height: number,
  options: DiagramRenderOptions = {}
): string {
  const theme = options.theme ?? 'dark';
  const tc = themeColors(theme);
  const accent = options.accent ?? (theme === 'light' ? resolveLightAccent(SACRINT.gold) : SACRINT.gold);
  const accent2 = options.accent2 ?? (theme === 'light' ? resolveLightAccent(SACRINT.blue) : SACRINT.blue);
  const compact = options.compact ?? false;
  const padLeft = compact ? 50 : 62;
  const padBottom = compact ? 42 : 52;
  const padTop = compact ? 18 : 24;
  const padRight = 20;
  const plotX = x + padLeft;
  const plotY = y + padTop;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;
  const xSpan = Math.max(1, diagram.xMax - diagram.xMin);
  const ySpan = Math.max(1, diagram.yMax - diagram.yMin);
  const sx = (val: number) => plotX + ((val - diagram.xMin) / xSpan) * plotW;
  const sy = (val: number) => plotY + plotH - ((val - diagram.yMin) / ySpan) * plotH;
  const parts: string[] = [];

  parts.push(rect(plotX, plotY, plotW, plotH, `fill="${tc.plotFill}" fill-opacity="${tc.plotOpacity}" rx="6"`));

  const xStep = niceTickStep(xSpan, 5);
  const yStep = niceTickStep(ySpan, 5);
  const xStart = Math.ceil(diagram.xMin / xStep) * xStep;
  for (let val = xStart; val <= diagram.xMax + 1e-6; val += xStep) {
    parts.push(line(sx(val), plotY, sx(val), plotY + plotH, tc.pal.strokeSoft, 1, 'stroke-opacity="0.35"'));
    parts.push(singleLine(formatTickValue(val), sx(val), plotY + plotH + 20, { fill: tc.pal.muted, fontSize: compact ? 10 : 11, anchor: 'middle' }));
  }
  const yStart = Math.ceil(diagram.yMin / yStep) * yStep;
  for (let val = yStart; val <= diagram.yMax + 1e-6; val += yStep) {
    parts.push(line(plotX, sy(val), plotX + plotW, sy(val), tc.pal.strokeSoft, 1, 'stroke-opacity="0.35"'));
    parts.push(singleLine(formatTickValue(val), plotX - 10, sy(val) + 4, { fill: tc.pal.muted, fontSize: compact ? 10 : 11, anchor: 'end' }));
  }

  if (diagram.yMin <= 0 && diagram.yMax >= 0) {
    parts.push(line(plotX, sy(0), plotX + plotW, sy(0), tc.pal.textSoft, 1.5, 'stroke-opacity="0.85"'));
  }
  if (diagram.xMin <= 0 && diagram.xMax >= 0) {
    parts.push(line(sx(0), plotY, sx(0), plotY + plotH, tc.pal.textSoft, 1.5, 'stroke-opacity="0.85"'));
  }

  if (!diagram.available || diagram.samples.length < 2) {
    parts.push(line(plotX + plotW * 0.2, plotY + plotH * 0.48, plotX + plotW * 0.8, plotY + plotH * 0.48, tc.pal.strokeSoft, 1, 'stroke-dasharray="8 8" stroke-opacity="0.6"'));
    parts.push(singleLine(uppercaseLabel(diagram.xLabel), plotX + plotW / 2, y + height - 6, { fill: tc.pal.muted, fontSize: compact ? 10 : 11, weight: 'semibold', letterSpacing: 1.4, anchor: 'middle' }));
    return parts.join('');
  }

  // Eje de simetría en x = vertexX
  const vxPx = sx(diagram.vertexX);
  const vyPx = sy(diagram.vertexY);
  parts.push(line(vxPx, plotY, vxPx, plotY + plotH, accent, 1.2, 'stroke-dasharray="5 5" stroke-opacity="0.6"'));

  if (diagram.samples.length >= 2) {
    const d = diagram.samples
      .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${sx(pt.x).toFixed(1)} ${sy(pt.y).toFixed(1)}`)
      .join(' ');
    parts.push(path(d, `fill="none" stroke="url(#sacrint-accent)" stroke-width="${compact ? 3 : 4}" stroke-linecap="round"`));
  }

  // Vértice
  parts.push(circle(vxPx, vyPx, compact ? 5 : 6, accent, `stroke="${tc.dotStroke}" stroke-width="2"`));
  const vLabel = `V(${diagram.vertexX}, ${diagram.vertexY})`;
  const vLabelY = diagram.a >= 0 ? Math.min(plotY + plotH - 10, vyPx + 22) : Math.max(plotY + 20, vyPx - 12);
  parts.push(singleLine(vLabel, vxPx, vLabelY, { fill: accent, fontSize: compact ? 10 : 11, weight: 'bold', anchor: 'middle' }));

  // Raíces sobre y = 0
  if (diagram.yMin <= 0 && diagram.yMax >= 0) {
    diagram.roots.forEach((root, idx) => {
      if (root < diagram.xMin || root > diagram.xMax) return;
      const rx = sx(root);
      const ry = sy(0);
      parts.push(circle(rx, ry, compact ? 4.5 : 5.5, accent2, `stroke="${tc.dotStroke}" stroke-width="2"`));
      parts.push(singleLine(`x${idx + 1}=${root}`, rx, ry - 12, { fill: accent2, fontSize: compact ? 10 : 11, weight: 'semibold', anchor: 'middle' }));
    });
  }

  parts.push(singleLine(uppercaseLabel(diagram.xLabel), plotX + plotW / 2, y + height - 6, { fill: tc.pal.muted, fontSize: compact ? 10 : 11, weight: 'semibold', letterSpacing: 1.4, anchor: 'middle' }));
  return parts.join('');
}

export function system2x2Graph(
  diagram: System2x2DiagramSpec,
  x: number,
  y: number,
  width: number,
  height: number,
  options: DiagramRenderOptions = {}
): string {
  const theme = options.theme ?? 'dark';
  const tc = themeColors(theme);
  const accent = options.accent ?? (theme === 'light' ? resolveLightAccent(SACRINT.gold) : SACRINT.gold);
  const accent2 = options.accent2 ?? (theme === 'light' ? resolveLightAccent(SACRINT.blue) : SACRINT.blue);
  const emerald = theme === 'light' ? SACRINT_LIGHT.emerald : SACRINT.emerald;
  const compact = options.compact ?? false;
  const padLeft = compact ? 46 : 56;
  const padBottom = compact ? 42 : 52;
  const padTop = compact ? 22 : 28;
  const padRight = 20;
  const plotX = x + padLeft;
  const plotY = y + padTop;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;
  const xSpan = Math.max(1, diagram.xMax - diagram.xMin);
  const ySpan = Math.max(1, diagram.yMax - diagram.yMin);
  const sx = (val: number) => plotX + ((val - diagram.xMin) / xSpan) * plotW;
  const sy = (val: number) => plotY + plotH - ((val - diagram.yMin) / ySpan) * plotH;
  const clampY = (val: number) => Math.max(diagram.yMin, Math.min(diagram.yMax, val));
  const parts: string[] = [];

  parts.push(rect(plotX, plotY, plotW, plotH, `fill="${tc.plotFill}" fill-opacity="${tc.plotOpacity}" rx="6"`));

  const xStep = niceTickStep(xSpan, 5);
  const yStep = niceTickStep(ySpan, 5);
  for (let val = Math.ceil(diagram.xMin / xStep) * xStep; val <= diagram.xMax + 1e-6; val += xStep) {
    parts.push(line(sx(val), plotY, sx(val), plotY + plotH, tc.pal.strokeSoft, 1, 'stroke-opacity="0.35"'));
    parts.push(singleLine(formatTickValue(val), sx(val), plotY + plotH + 20, { fill: tc.pal.muted, fontSize: compact ? 10 : 11, anchor: 'middle' }));
  }
  for (let val = Math.ceil(diagram.yMin / yStep) * yStep; val <= diagram.yMax + 1e-6; val += yStep) {
    parts.push(line(plotX, sy(val), plotX + plotW, sy(val), tc.pal.strokeSoft, 1, 'stroke-opacity="0.35"'));
    parts.push(singleLine(formatTickValue(val), plotX - 10, sy(val) + 4, { fill: tc.pal.muted, fontSize: compact ? 10 : 11, anchor: 'end' }));
  }

  if (diagram.yMin <= 0 && diagram.yMax >= 0) parts.push(line(plotX, sy(0), plotX + plotW, sy(0), tc.pal.textSoft, 1.3));
  if (diagram.xMin <= 0 && diagram.xMax >= 0) parts.push(line(sx(0), plotY, sx(0), plotY + plotH, tc.pal.textSoft, 1.3));

  if (!diagram.available) {
    parts.push(line(plotX + plotW * 0.2, plotY + plotH * 0.48, plotX + plotW * 0.8, plotY + plotH * 0.48, tc.pal.strokeSoft, 1, 'stroke-dasharray="8 8" stroke-opacity="0.6"'));
    parts.push(singleLine(uppercaseLabel(diagram.xLabel), plotX + plotW / 2, y + height - 6, { fill: tc.pal.muted, fontSize: compact ? 10 : 11, weight: 'semibold', letterSpacing: 1.4, anchor: 'middle' }));
    return parts.join('');
  }

  const y1A = clampY((diagram.c1 - diagram.a1 * diagram.xMin) / diagram.b1);
  const y1B = clampY((diagram.c1 - diagram.a1 * diagram.xMax) / diagram.b1);
  parts.push(line(sx(diagram.xMin), sy(y1A), sx(diagram.xMax), sy(y1B), accent, compact ? 2.6 : 3.2));

  const y2A = clampY((diagram.c2 - diagram.a2 * diagram.xMin) / diagram.b2);
  const y2B = clampY((diagram.c2 - diagram.a2 * diagram.xMax) / diagram.b2);
  parts.push(line(sx(diagram.xMin), sy(y2A), sx(diagram.xMax), sy(y2B), accent2, compact ? 2.6 : 3.2));

  if (diagram.intersection) {
    const ix = sx(diagram.intersection.x);
    const iy = sy(diagram.intersection.y);
    parts.push(line(ix, iy, ix, plotY + plotH, emerald, 1, 'stroke-dasharray="4 4" stroke-opacity="0.7"'));
    parts.push(line(plotX, iy, ix, iy, emerald, 1, 'stroke-dasharray="4 4" stroke-opacity="0.7"'));
    parts.push(circle(ix, iy, compact ? 5.5 : 7, emerald, `stroke="${tc.dotStroke}" stroke-width="2"`));
    const solLabel = `Solución (${diagram.intersection.x}, ${diagram.intersection.y})`;
    const lblW = measureText(solLabel, 11, 'body', 'semibold') + 14;
    const lblX = Math.min(plotX + plotW - lblW - 4, Math.max(plotX + 6, ix + 10));
    const lblY = Math.max(plotY + 24, iy - 12);
    parts.push(rect(lblX, lblY - 14, lblW, 20, `rx="4" fill="${tc.labelBg}" fill-opacity="0.92" stroke="${emerald}" stroke-width="1"`));
    parts.push(singleLine(solLabel, lblX + 7, lblY, { fill: emerald, fontSize: 11, weight: 'semibold' }));
  }

  // Leyenda superior
  parts.push(singleLine(`■ L₁: ${diagram.equation1}`, plotX + 10, plotY + 18, { fill: accent, fontSize: compact ? 9 : 11, weight: 'semibold' }));
  parts.push(singleLine(`■ L₂: ${diagram.equation2}`, plotX + plotW - 10, plotY + 18, { fill: accent2, fontSize: compact ? 9 : 11, weight: 'semibold', anchor: 'end' }));
  parts.push(singleLine(uppercaseLabel(diagram.xLabel), plotX + plotW / 2, y + height - 6, { fill: tc.pal.muted, fontSize: compact ? 10 : 11, weight: 'semibold', letterSpacing: 1.4, anchor: 'middle' }));

  return parts.join('');
}

export function exponentialGraph(
  diagram: ExponentialDiagramSpec,
  x: number,
  y: number,
  width: number,
  height: number,
  options: DiagramRenderOptions = {}
): string {
  const theme = options.theme ?? 'dark';
  const tc = themeColors(theme);
  const accent = options.accent ?? (theme === 'light' ? resolveLightAccent(SACRINT.gold) : SACRINT.gold);
  const accent2 = options.accent2 ?? (theme === 'light' ? resolveLightAccent(SACRINT.blue) : SACRINT.blue);
  const compact = options.compact ?? false;
  const padLeft = compact ? 54 : 68;
  const padBottom = compact ? 42 : 52;
  const padTop = compact ? 22 : 28;
  const padRight = 24;
  const plotX = x + padLeft;
  const plotY = y + padTop;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;
  const xMax = Math.max(1, diagram.periods);
  const yMax = Math.max(100, diagram.yMax);
  const sx = (val: number) => plotX + (val / xMax) * plotW;
  const sy = (val: number) => plotY + plotH - (val / yMax) * plotH;
  const parts: string[] = [];

  parts.push(rect(plotX, plotY, plotW, plotH, `fill="${tc.plotFill}" fill-opacity="${tc.plotOpacity}" rx="6"`));

  const isPopulation =
    diagram.context === 'population' || /P\(t\)|Poblaci[oó]n/i.test(`${diagram.equation} ${diagram.yLabel}`);
  const valPrefix = isPopulation ? '' : '$';
  const yStep = niceTickStep(yMax, 5);
  for (let t = 0; t <= xMax; t++) {
    parts.push(line(sx(t), plotY, sx(t), plotY + plotH, tc.pal.strokeSoft, 1, 'stroke-opacity="0.35"'));
    parts.push(singleLine(`t=${t}`, sx(t), plotY + plotH + 20, { fill: tc.pal.muted, fontSize: compact ? 10 : 11, anchor: 'middle' }));
  }
  for (let val = 0; val <= yMax + 1e-6; val += yStep) {
    parts.push(line(plotX, sy(val), plotX + plotW, sy(val), tc.pal.strokeSoft, 1, 'stroke-opacity="0.35"'));
    parts.push(singleLine(`${valPrefix}${formatTickValue(val)}`, plotX - 10, sy(val) + 4, { fill: tc.pal.muted, fontSize: compact ? 9 : 10, anchor: 'end' }));
  }

  parts.push(line(plotX, plotY, plotX, plotY + plotH, tc.pal.textSoft, 1.5));
  parts.push(line(plotX, plotY + plotH, plotX + plotW, plotY + plotH, tc.pal.textSoft, 1.5));

  if (!diagram.available || diagram.compoundSeries.length < 2) {
    parts.push(line(plotX + plotW * 0.2, plotY + plotH * 0.48, plotX + plotW * 0.8, plotY + plotH * 0.48, tc.pal.strokeSoft, 1, 'stroke-dasharray="8 8" stroke-opacity="0.6"'));
    parts.push(singleLine(uppercaseLabel(diagram.xLabel), plotX + plotW / 2, y + height - 6, { fill: tc.pal.muted, fontSize: compact ? 10 : 11, weight: 'semibold', letterSpacing: 1.4, anchor: 'middle' }));
    return parts.join('');
  }

  // Serie Lineal (recta)
  const simpleD = diagram.simpleSeries.map((p, i) => `${i === 0 ? 'M' : 'L'} ${sx(p.t).toFixed(1)} ${sy(p.value).toFixed(1)}`).join(' ');
  parts.push(path(simpleD, `fill="none" stroke="${accent2}" stroke-width="2.5" stroke-dasharray="6 4"`));
  // Serie Exponencial (curva)
  const compD = diagram.compoundSeries.map((p, i) => `${i === 0 ? 'M' : 'L'} ${sx(p.t).toFixed(1)} ${sy(p.value).toFixed(1)}`).join(' ');
  parts.push(path(compD, `fill="none" stroke="${accent}" stroke-width="${compact ? 3 : 3.8}" stroke-linecap="round"`));

  diagram.compoundSeries.forEach((p, idx) => {
    const px = sx(p.t);
    const py = sy(p.value);
    parts.push(circle(px, py, compact ? 3.5 : 4.5, accent, `stroke="${tc.dotStroke}" stroke-width="1.5"`));
    if (idx === 0 || idx === diagram.compoundSeries.length - 1) {
      const anchor = idx === 0 ? 'start' : 'end';
      const lx = idx === 0 ? px + 8 : px - 8;
      parts.push(singleLine(`${valPrefix}${p.value.toLocaleString('en-US')}`, lx, Math.max(plotY + 26, py - 10), { fill: accent, fontSize: compact ? 10 : 11, weight: 'bold', anchor }));
    }
  });

  parts.push(singleLine(isPopulation ? '― Crecimiento exponencial' : '― Interés compuesto (exponencial)', plotX + 10, plotY + 18, { fill: accent, fontSize: compact ? 9 : 11, weight: 'semibold' }));
  parts.push(singleLine(isPopulation ? '- - Proyección lineal' : '- - Interés simple (lineal)', plotX + plotW - 10, plotY + 18, { fill: accent2, fontSize: compact ? 9 : 11, weight: 'semibold', anchor: 'end' }));
  parts.push(singleLine(uppercaseLabel(diagram.xLabel), plotX + plotW / 2, y + height - 6, { fill: tc.pal.muted, fontSize: compact ? 10 : 11, weight: 'semibold', letterSpacing: 1.4, anchor: 'middle' }));
  return parts.join('');
}

export function geometryDiagram(
  diagram: GeometryDiagramSpec,
  x: number,
  y: number,
  width: number,
  height: number,
  options: DiagramRenderOptions = {}
): string {
  const theme = options.theme ?? 'dark';
  const tc = themeColors(theme);
  const accent = options.accent ?? (theme === 'light' ? resolveLightAccent(SACRINT.gold) : SACRINT.gold);
  const accent2 = options.accent2 ?? (theme === 'light' ? resolveLightAccent(SACRINT.blue) : SACRINT.blue);
  const compact = options.compact ?? false;
  const parts: string[] = [];

  const figW = width;
  const figH = Math.round(height * 0.58);
  parts.push(rect(x, y, figW, figH, `rx="12" fill="${tc.plotFill}" fill-opacity="${tc.plotOpacity}" stroke="${tc.pal.strokeSoft}" stroke-width="1"`));

  if (diagram.variant === 'angles') {
    const colW = figW / 3;
    const specs = [
      { title: 'AGUDO (< 90°)', deg: '45°', angleRad: Math.PI / 4, color: accent },
      { title: 'RECTO (= 90°)', deg: '90°', angleRad: Math.PI / 2, color: accent2 },
      { title: 'OBTUSO (> 90°)', deg: '130°', angleRad: (130 * Math.PI) / 180, color: accent },
    ];
    specs.forEach((item, idx) => {
      const vx = x + colW * idx + colW * 0.42;
      const vy = y + figH * 0.72;
      const rayLen = Math.min(colW * 0.42, figH * 0.46);
      const x2 = vx + Math.cos(item.angleRad) * rayLen;
      const y2 = vy - Math.sin(item.angleRad) * rayLen;
      parts.push(line(vx, vy, vx + rayLen, vy, tc.pal.textSoft, 2.5));
      parts.push(line(vx, vy, x2, y2, item.color, 2.8));
      parts.push(circle(vx, vy, 4, item.color));
      if (item.deg === '90°') {
        parts.push(rect(vx, vy - 16, 16, 16, `fill="none" stroke="${item.color}" stroke-width="1.8"`));
      } else {
        const arcR = 26;
        const ax = vx + Math.cos(item.angleRad) * arcR;
        const ay = vy - Math.sin(item.angleRad) * arcR;
        parts.push(path(`M ${vx + arcR} ${vy} A ${arcR} ${arcR} 0 0 0 ${ax.toFixed(1)} ${ay.toFixed(1)}`, `fill="none" stroke="${item.color}" stroke-width="2"`));
      }
      parts.push(singleLine(item.deg, vx + 26, vy - 26, { fill: item.color, fontSize: compact ? 12 : 14, family: 'display', weight: 'bold' }));
      parts.push(singleLine(item.title, x + colW * (idx + 0.5), y + figH - 14, { fill: tc.pal.muted, fontSize: compact ? 9 : 11, weight: 'semibold', anchor: 'middle' }));
    });
  } else if (diagram.variant === 'right-triangle') {
    const bx = x + figW * 0.28;
    const by = y + figH * 0.78;
    const w = figW * 0.44;
    const h = figH * 0.52;
    parts.push(`<polygon points="${bx},${by} ${bx + w},${by} ${bx},${by - h}" fill="${accent2}" fill-opacity="0.1" stroke="${accent}" stroke-width="2.8" stroke-linejoin="round"/>`);
    parts.push(rect(bx, by - 18, 18, 18, `fill="none" stroke="${accent2}" stroke-width="2"`));
    parts.push(singleLine('a (cateto)', bx - 14, by - h / 2, { fill: tc.pal.text, fontSize: 12, weight: 'semibold', anchor: 'end' }));
    parts.push(singleLine('b (cateto)', bx + w / 2, by + 20, { fill: tc.pal.text, fontSize: 12, weight: 'semibold', anchor: 'middle' }));
    parts.push(singleLine('c = √(a² + b²)', bx + w * 0.55, by - h * 0.52, { fill: accent, fontSize: 13, family: 'display', weight: 'bold' }));
    parts.push(singleLine('90°', bx + 26, by - 8, { fill: accent2, fontSize: 11, weight: 'bold' }));
  } else {
    const rx = x + figW * 0.24;
    const ry = y + figH * 0.22;
    const rw = figW * 0.52;
    const rh = figH * 0.54;
    parts.push(rect(rx, ry, rw, rh, `rx="4" fill="${accent2}" fill-opacity="0.12" stroke="${accent}" stroke-width="2.5"`));
    parts.push(singleLine('A = b · h', rx + rw / 2, ry + rh / 2 + 6, { fill: accent, fontSize: compact ? 16 : 20, family: 'display', weight: 'bold', anchor: 'middle' }));
    parts.push(singleLine('Base (b)', rx + rw / 2, ry + rh + 22, { fill: tc.pal.textSoft, fontSize: 12, weight: 'semibold', anchor: 'middle' }));
    parts.push(singleLine('Altura (h)', rx - 12, ry + rh / 2, { fill: tc.pal.textSoft, fontSize: 12, weight: 'semibold', anchor: 'end' }));
  }

  // Tres tarjetas conceptuales debajo de la figura
  const cardsY = y + figH + 12;
  const cardH = Math.max(58, height - figH - 14);
  const gap = 10;
  const cards = diagram.highlights
    .filter((node) => {
      const label = (node.label || '').trim();
      return label.length > 1 && !/^[A-ZÁÉÍÓÚÑ]$/i.test(label);
    })
    .slice(0, 3);
  const cardW = (width - gap * Math.max(0, cards.length - 1)) / Math.max(1, cards.length);
  cards.forEach((node, idx) => {
    const cx = x + idx * (cardW + gap);
    parts.push(panel(cx, cardsY, cardW, cardH, { fill: tc.cardBg, radius: 10, stroke: tc.pal.strokeSoft }));
    parts.push(singleLine(uppercaseLabel(node.label), cx + 12, cardsY + 22, { fill: idx % 2 === 0 ? accent : accent2, fontSize: 10, weight: 'bold', letterSpacing: 1.2 }));
    const body = textBlock(node.detail, cardW - 24, {
      x: cx + 12,
      y: cardsY + 42,
      fill: tc.pal.textSoft,
      maxFontSize: compact ? 10 : 12,
      minFontSize: 8,
      maxLines: 3,
      lineHeightRatio: 1.25,
      truncate: false,
    });
    parts.push(body.svg);
  });

  return parts.join('');
}
