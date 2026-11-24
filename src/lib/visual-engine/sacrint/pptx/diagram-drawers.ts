import type PptxGenJS from 'pptxgenjs';
import type {
  ArgumentDiagramSpec,
  BlockDiagramSpec,
  ClinicalFlowDiagramSpec,
  ConceptDiagramSpec,
  CreativeCycleDiagramSpec,
  ExponentialDiagramSpec,
  GeometryDiagramSpec,
  LanguageDiagramSpec,
  LinearDiagramSpec,
  QuadraticDiagramSpec,
  ReactionDiagramSpec,
  RegulationFlowDiagramSpec,
  SacrintDiagramNode,
  SacrintDiagramSpec,
  SopFlowDiagramSpec,
  System2x2DiagramSpec,
  SystemMapDiagramSpec,
  TimelineDiagramSpec,
  TrainingCycleDiagramSpec,
} from '../types';
import { niceTickStep } from '../diagrams/shared';
import {
  addEllipse,
  addLabel,
  addLine,
  addPanel,
  addText,
  C,
  FONT_DISPLAY,
  inch,
  pt,
} from './theme-and-primitives';

function formatTickLabel(value: number): string {
  if (Math.abs(value) >= 1000) {
    const k = Math.round((value / 1000) * 10) / 10;
    return Number.isInteger(k) ? `${k}k` : `${k.toFixed(1)}k`;
  }
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function drawCartesianFrame(
  slide: PptxGenJS.Slide,
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number,
  xLabel: string,
  yLabel: string
) {
  const plotX = 944;
  const plotY = 334;
  const plotW = 844;
  const plotH = 342;
  const xSpan = Math.max(1e-6, xMax - xMin);
  const ySpan = Math.max(1e-6, yMax - yMin);
  const xToPx = (value: number) => plotX + ((value - xMin) / xSpan) * plotW;
  const yToPx = (value: number) => plotY + plotH - ((value - yMin) / ySpan) * plotH;

  addLine(slide, plotX, plotY, plotX, plotY + plotH, C.strokeSoft, 1);
  addLine(slide, plotX, plotY + plotH, plotX + plotW, plotY + plotH, C.strokeSoft, 1);

  const stepY = niceTickStep(ySpan, 5);
  const firstY = Math.ceil(yMin / stepY) * stepY;
  for (let v = firstY, count = 0; v <= yMax + stepY * 0.001 && count < 5; v += stepY, count += 1) {
    const py = yToPx(v);
    addLine(slide, plotX, py, plotX + plotW, py, C.stroke, 0.5, 'dash');
    addText(slide, formatTickLabel(v), plotX - 70, py - 9, 62, 18, { fontSize: pt(14), color: C.muted, align: 'right', maxLines: 1 });
  }

  const stepX = niceTickStep(xSpan, 5);
  const firstX = Math.ceil(xMin / stepX) * stepX;
  for (let v = firstX, count = 0; v <= xMax + stepX * 0.001 && count < 5; v += stepX, count += 1) {
    const px = xToPx(v);
    addLine(slide, px, plotY, px, plotY + plotH, C.stroke, 0.5, 'dash');
    addText(slide, formatTickLabel(v), px - 28, plotY + plotH + 8, 56, 18, { fontSize: pt(14), color: C.muted, align: 'center', maxLines: 1 });
  }

  if (yMin < 0 && yMax > 0) {
    addLine(slide, plotX, yToPx(0), plotX + plotW, yToPx(0), C.strokeSoft, 1);
  }
  if (xMin < 0 && xMax > 0) {
    addLine(slide, xToPx(0), plotY, xToPx(0), plotY + plotH, C.strokeSoft, 1);
  }

  addText(slide, xLabel.toLocaleUpperCase('es-MX'), plotX + plotW / 2 - 220, plotY + plotH + 30, 440, 20, {
    fontSize: pt(15),
    color: C.muted,
    align: 'center',
    maxLines: 1,
  });
  addText(slide, yLabel.toLocaleUpperCase('es-MX'), 718, plotY + plotH / 2 - 10, 280, 20, {
    fontSize: pt(15),
    color: C.muted,
    align: 'center',
    valign: 'middle',
    maxLines: 1,
    rotate: 270,
  });

  return { plotX, plotY, plotW, plotH, xToPx, yToPx };
}

type MarkerPlacement = 'right' | 'left' | 'below' | 'above-left';
interface MarkerRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Calcula la caja de la etiqueta de un marcador según la colocación solicitada. */
function markerRect(px: number, py: number, label: string, width: number, placement: MarkerPlacement): MarkerRect {
  const pillW = Math.max(width, Math.min(186, Math.round(label.length * 10 + 22)));
  let pillX = Math.min(1816 - pillW, px + 8);
  let pillY = Math.max(336, py - 26);
  if (placement === 'left') {
    pillX = Math.max(16, px - pillW - 8);
  } else if (placement === 'below') {
    pillY = Math.min(1040, py + 10);
  } else if (placement === 'above-left') {
    pillX = Math.max(16, px - pillW - 8);
    pillY = Math.max(336, py - 34);
  }
  return { x: pillX, y: pillY, w: pillW, h: 24 };
}

function rectsOverlap(a: MarkerRect, b: MarkerRect, pad = 4): boolean {
  return a.x < b.x + b.w + pad && a.x + a.w + pad > b.x && a.y < b.y + b.h + pad && a.y + a.h + pad > b.y;
}

function addPointMarker(
  slide: PptxGenJS.Slide,
  px: number,
  py: number,
  label: string,
  accent: string,
  accent2: string,
  width = 88,
  placement: MarkerPlacement = 'right'
): MarkerRect {
  const rect = markerRect(px, py, label, width, placement);
  const pillW = rect.w;
  const pillX = rect.x;
  const pillY = rect.y;
  addEllipse(slide, px - 5, py - 5, 10, 10, { fill: accent2, stroke: accent, strokeWidth: 1.2 });
  slide.addShape('roundRect', {
    x: inch(pillX),
    y: inch(pillY),
    w: inch(pillW),
    h: inch(24),
    fill: { color: C.canvas, transparency: 5 },
    line: { color: accent, width: 0.6, transparency: 30 },
    rectRadius: 0.03,
  });
  addText(slide, label, pillX + 6, pillY + 2, pillW - 12, 20, {
    fontSize: pt(13),
    color: C.text,
    maxLines: 1,
    valign: 'middle',
  });
  return rect;
}

function addGraph(slide: PptxGenJS.Slide, diagram: LinearDiagramSpec, accent: string, accent2: string) {
  const endYRaw = diagram.slope * diagram.domainMax + diagram.intercept;
  const rawMinY = Math.min(0, diagram.intercept, endYRaw);
  const yMin = rawMinY < 0 ? Math.floor(rawMinY / 5) * 5 : 0;
  const { plotX, plotY, plotW, plotH, xToPx, yToPx } = drawCartesianFrame(
    slide,
    0,
    diagram.domainMax,
    yMin,
    diagram.rangeMax,
    diagram.xLabel,
    diagram.yLabel
  );

  if (!diagram.available) {
    addLine(slide, plotX + plotW * 0.2, plotY + plotH * 0.5, plotX + plotW * 0.8, plotY + plotH * 0.5, C.strokeSoft, 1, 'dash');
    return;
  }

  const renderedPoints = diagram.points.slice(0, 4).map((point) => ({
    point,
    px: Math.max(plotX, Math.min(plotX + plotW - 92, xToPx(point.x))),
    py: Math.max(plotY + 8, Math.min(plotY + plotH - 8, yToPx(point.y))),
  }));

  const usedLabelRects: MarkerRect[] = [];
  if (typeof diagram.targetY === 'number' && diagram.targetY > yMin && diagram.targetY <= diagram.rangeMax) {
    const ty = yToPx(diagram.targetY);
    addLine(slide, plotX, ty, plotX + plotW, ty, C.amber, 1, 'dash');
    const rightBusy = renderedPoints.some((rp) => rp.px >= plotX + plotW - 220 && Math.abs(rp.py - ty) <= 44);
    const metaX = rightBusy ? plotX + 10 : plotX + plotW - 156;
    const preferBelow = ty - 22 < plotY + 6 || renderedPoints.some((rp) => Math.abs(rp.px - metaX) < 160 && rp.py >= ty - 34 && rp.py <= ty + 8);
    const metaY = preferBelow ? Math.min(plotY + plotH - 22, ty + 6) : Math.max(plotY + 6, ty - 22);
    addText(slide, `Meta: ${formatTickLabel(diagram.targetY)}`, metaX, metaY, 148, 18, {
      fontSize: pt(12),
      bold: true,
      color: C.amber,
      align: rightBusy ? 'left' : 'right',
    });
    usedLabelRects.push({ x: metaX, y: metaY, w: 148, h: 18 });
  }

  const startX = xToPx(0);
  const startY = yToPx(Math.max(yMin, Math.min(diagram.rangeMax, diagram.intercept)));
  const endX = xToPx(diagram.domainMax);
  const endY = yToPx(Math.max(yMin, Math.min(diagram.rangeMax, endYRaw)));
  addLine(slide, startX, startY, endX, endY, accent, 2.2);

  const drawnDots: Array<{ px: number; py: number }> = [];
  const placements: MarkerPlacement[] = ['right', 'above-left', 'below', 'left'];
  for (let idx = 0; idx < renderedPoints.length; idx += 1) {
    const { point, px, py } = renderedPoints[idx]!;
    const tooClose = drawnDots.some((d) => Math.hypot(d.px - px, d.py - py) < 14);
    if (tooClose) continue;
    drawnDots.push({ px, py });

    const label = point.label || `(${formatTickLabel(point.x)}, ${formatTickLabel(point.y)})`;
    const freePlacement = placements.find((pl) => {
      const candidate = markerRect(px, py, label, 88, pl);
      const inBounds =
        candidate.x >= plotX - 4 &&
        candidate.x + candidate.w <= plotX + plotW + 12 &&
        candidate.y >= plotY - 4 &&
        candidate.y + candidate.h <= plotY + plotH + 8;
      return inBounds && !usedLabelRects.some((r) => rectsOverlap(candidate, r));
    });

    if (freePlacement) {
      usedLabelRects.push(addPointMarker(slide, px, py, label, accent, accent2, 88, freePlacement));
    } else if (idx === 0 || idx === renderedPoints.length - 1) {
      const anyNoOverlap = placements.find(
        (pl) => !usedLabelRects.some((r) => rectsOverlap(markerRect(px, py, label, 88, pl), r))
      );
      if (anyNoOverlap) {
        usedLabelRects.push(addPointMarker(slide, px, py, label, accent, accent2, 88, anyNoOverlap));
      } else {
        addEllipse(slide, px - 5, py - 5, 10, 10, { fill: accent2, stroke: accent, strokeWidth: 1.2 });
      }
    } else {
      addEllipse(slide, px - 5, py - 5, 10, 10, { fill: accent2, stroke: accent, strokeWidth: 1.2 });
    }
  }
}

function addQuadraticDiagram(slide: PptxGenJS.Slide, diagram: QuadraticDiagramSpec, accent: string, accent2: string) {
  const { plotX, plotY, plotW, plotH, xToPx, yToPx } = drawCartesianFrame(
    slide,
    diagram.xMin,
    diagram.xMax,
    diagram.yMin,
    diagram.yMax,
    diagram.xLabel,
    diagram.yLabel
  );

  if (!diagram.available || diagram.samples.length < 2) {
    addLine(slide, plotX + plotW * 0.2, plotY + plotH * 0.5, plotX + plotW * 0.8, plotY + plotH * 0.5, C.strokeSoft, 1, 'dash');
    return;
  }

  for (let i = 1; i < diagram.samples.length; i += 1) {
    const prev = diagram.samples[i - 1]!;
    const curr = diagram.samples[i]!;
    addLine(slide, xToPx(prev.x), yToPx(prev.y), xToPx(curr.x), yToPx(curr.y), accent, 2.2);
  }

  const vx = Math.max(plotX + 8, Math.min(plotX + plotW - 110, xToPx(diagram.vertexX)));
  const vy = Math.max(plotY + 12, Math.min(plotY + plotH - 12, yToPx(diagram.vertexY)));
  const tangentRoot =
    Math.abs(diagram.vertexY) <= 1e-6
      ? diagram.roots.find((root) => Math.abs(root - diagram.vertexX) <= 1e-6)
      : undefined;
  const vertexLabel =
    tangentRoot !== undefined
      ? `V(${formatTickLabel(diagram.vertexX)}, ${formatTickLabel(diagram.vertexY)})=x₁`
      : `V(${formatTickLabel(diagram.vertexX)}, ${formatTickLabel(diagram.vertexY)})`;
  const usedLabelRects: MarkerRect[] = [addPointMarker(slide, vx, vy, vertexLabel, accent2, accent, 114)];

  diagram.roots.slice(0, 2).forEach((root, idx) => {
    // En parábolas tangentes al eje X, la etiqueta del vértice ya contiene x₁.
    // Evita dibujar x1=... exactamente encima de V(...).
    if (tangentRoot !== undefined && Math.abs(root - tangentRoot) <= 1e-6) return;
    const rx = Math.max(plotX + 8, Math.min(plotX + plotW - 96, xToPx(root)));
    const ry = yToPx(0);
    const label = `x${idx + 1}=${formatTickLabel(root)}`;
    // Elegir la primera colocación cuya caja no choque con etiquetas ya dibujadas
    // (vértice u otra raíz), incluso cuando la parábola no es tangente.
    const placements: MarkerPlacement[] = ['right', 'left', 'below', 'above-left'];
    const placement =
      placements.find((pl) => !usedLabelRects.some((r) => rectsOverlap(markerRect(rx, ry, label, 92, pl), r))) ?? 'below';
    usedLabelRects.push(addPointMarker(slide, rx, ry, label, accent, accent2, 92, placement));
  });
}

function addSystem2x2Diagram(slide: PptxGenJS.Slide, diagram: System2x2DiagramSpec, accent: string, accent2: string) {
  const { plotX, plotY, plotW, plotH, xToPx, yToPx } = drawCartesianFrame(
    slide,
    diagram.xMin,
    diagram.xMax,
    diagram.yMin,
    diagram.yMax,
    diagram.xLabel,
    diagram.yLabel
  );

  if (!diagram.available) {
    addLine(slide, plotX + plotW * 0.2, plotY + plotH * 0.5, plotX + plotW * 0.8, plotY + plotH * 0.5, C.strokeSoft, 1, 'dash');
    return;
  }

  const clipSegment = (a: number, b: number, c: number, color: string) => {
    const pts: Array<{ x: number; y: number }> = [];
    if (Math.abs(b) > 1e-6) {
      for (const x of [diagram.xMin, diagram.xMax]) {
        const y = (c - a * x) / b;
        if (y >= diagram.yMin - 1e-3 && y <= diagram.yMax + 1e-3) pts.push({ x, y });
      }
    }
    if (Math.abs(a) > 1e-6) {
      for (const y of [diagram.yMin, diagram.yMax]) {
        const x = (c - b * y) / a;
        if (x > diagram.xMin && x < diagram.xMax) pts.push({ x, y });
      }
    }
    if (pts.length >= 2) {
      addLine(slide, xToPx(pts[0]!.x), yToPx(pts[0]!.y), xToPx(pts[1]!.x), yToPx(pts[1]!.y), color, 2.1);
    }
  };

  clipSegment(diagram.a1, diagram.b1, diagram.c1, accent);
  clipSegment(diagram.a2, diagram.b2, diagram.c2, accent2);

  addText(slide, `L1: ${diagram.equation1}`, plotX + 12, plotY + 6, 360, 18, { fontSize: pt(13), bold: true, color: accent });
  addText(slide, `L2: ${diagram.equation2}`, plotX + 380, plotY + 6, 360, 18, { fontSize: pt(13), bold: true, color: accent2, align: 'right' });

  if (diagram.intersection) {
    const px = Math.max(plotX + 8, Math.min(plotX + plotW - 120, xToPx(diagram.intersection.x)));
    const py = Math.max(plotY + 26, Math.min(plotY + plotH - 12, yToPx(diagram.intersection.y)));
    addPointMarker(
      slide,
      px,
      py,
      `(${formatTickLabel(diagram.intersection.x)}, ${formatTickLabel(diagram.intersection.y)})`,
      C.emerald,
      accent,
      116
    );
  }
}

function addExponentialDiagram(slide: PptxGenJS.Slide, diagram: ExponentialDiagramSpec, accent: string, accent2: string) {
  const { plotX, plotY, plotW, plotH, xToPx, yToPx } = drawCartesianFrame(
    slide,
    0,
    Math.max(1, diagram.periods),
    0,
    diagram.yMax,
    diagram.xLabel,
    diagram.yLabel
  );

  if (!diagram.available || diagram.compoundSeries.length < 2) {
    addLine(slide, plotX + plotW * 0.2, plotY + plotH * 0.5, plotX + plotW * 0.8, plotY + plotH * 0.5, C.strokeSoft, 1, 'dash');
    return;
  }

  for (let i = 1; i < diagram.simpleSeries.length; i += 1) {
    const p1 = diagram.simpleSeries[i - 1]!;
    const p2 = diagram.simpleSeries[i]!;
    addLine(slide, xToPx(p1.t), yToPx(p1.value), xToPx(p2.t), yToPx(p2.value), accent2, 1.5, 'dash');
  }
  for (let i = 1; i < diagram.compoundSeries.length; i += 1) {
    const p1 = diagram.compoundSeries[i - 1]!;
    const p2 = diagram.compoundSeries[i]!;
    addLine(slide, xToPx(p1.t), yToPx(p1.value), xToPx(p2.t), yToPx(p2.value), accent, 2.3);
  }

  const isPopulation =
    diagram.context === 'population' || /P\(t\)|Poblaci[oó]n/i.test(`${diagram.equation} ${diagram.yLabel}`);
  addText(slide, isPopulation ? 'Crecimiento exponencial' : 'Interés compuesto', plotX + 12, plotY + 6, 220, 18, { fontSize: pt(13), bold: true, color: accent });
  addText(slide, isPopulation ? 'Proyección lineal' : 'Referencia lineal', plotX + 240, plotY + 6, 220, 18, { fontSize: pt(13), bold: true, color: accent2 });

  const last = diagram.compoundSeries[diagram.compoundSeries.length - 1];
  if (last) {
    const px = Math.min(plotX + plotW - 110, xToPx(last.t));
    const py = Math.max(plotY + 28, yToPx(last.value));
    addPointMarker(slide, px, py, `t=${last.t}: ${formatTickLabel(last.value)}`, accent, accent2, 112);
  }
}

function addGeometryDiagram(slide: PptxGenJS.Slide, diagram: GeometryDiagramSpec, accent: string, accent2: string) {
  const area = { x: 856, y: 318, w: 952, h: 404 };
  const figX = area.x + 28;
  const figY = area.y + 34;

  if (diagram.variant === 'right-triangle') {
    const ax = figX + 40;
    const ay = figY + 250;
    const bx = figX + 340;
    const by = figY + 250;
    const cx = figX + 40;
    const cy = figY + 36;
    addLine(slide, ax, ay, bx, by, accent, 2.4);
    addLine(slide, ax, ay, cx, cy, accent, 2.4);
    addLine(slide, bx, by, cx, cy, accent2, 2.4);
    addText(slide, diagram.primaryLabel, figX + 130, figY + 262, 180, 20, { fontSize: pt(14), color: accent, bold: true });
    addText(slide, diagram.secondaryLabel, figX + 190, figY + 110, 180, 20, { fontSize: pt(14), color: accent2, bold: true });
  } else if (diagram.variant === 'angles') {
    addPanel(slide, figX + 12, figY + 14, 344, 256, { fill: C.panelAlt, stroke: accent, strokeWidth: 2 });
    const vx = figX + 184;
    const vy = figY + 168;
    addLine(slide, figX + 42, vy, figX + 326, vy, accent, 2.4);
    addLine(slide, vx, vy, vx + 86, vy - 106, accent2, 2.4);
    addText(slide, 'α + β = 180°', figX + 42, figY + 24, 284, 24, { fontSize: pt(14), bold: true, color: accent2, align: 'center' });
    addText(slide, diagram.primaryLabel, figX + 26, figY + 190, 316, 32, { fontSize: pt(14), bold: true, color: accent, align: 'center', maxLines: 2 });
    addText(slide, diagram.secondaryLabel, figX + 26, figY + 224, 316, 34, { fontSize: pt(12), color: C.textSoft, align: 'center', maxLines: 2 });
  } else {
    addPanel(slide, figX + 12, figY + 14, 344, 256, { fill: C.panelAlt, stroke: accent, strokeWidth: 2 });
    // Triángulo 1 (ABC)
    addLine(slide, figX + 34, figY + 150, figX + 154, figY + 150, accent, 2.2);
    addLine(slide, figX + 34, figY + 150, figX + 86, figY + 52, accent, 2.2);
    addLine(slide, figX + 86, figY + 52, figX + 154, figY + 150, accent, 2.2);
    // Triángulo 2 (A'B'C')
    addLine(slide, figX + 206, figY + 150, figX + 326, figY + 150, accent2, 2.2);
    addLine(slide, figX + 206, figY + 150, figX + 258, figY + 52, accent2, 2.2);
    addLine(slide, figX + 258, figY + 52, figX + 326, figY + 150, accent2, 2.2);
    addText(slide, '≅ / ~', figX + 154, figY + 90, 52, 24, { fontSize: pt(16), bold: true, color: C.emerald, align: 'center' });
    addText(slide, diagram.primaryLabel, figX + 26, figY + 168, 316, 40, { fontSize: pt(15), bold: true, color: accent, align: 'center', maxLines: 2 });
    addText(slide, diagram.secondaryLabel, figX + 26, figY + 212, 316, 44, { fontSize: pt(12.5), color: accent2, align: 'center', maxLines: 2 });
  }

  diagram.highlights.slice(0, 3).forEach((node, index) => {
    addNodeCard(slide, node, area.x + 412, area.y + 18 + index * 124, 512, 108, accent, index === 0 ? accent : accent2);
  });
}

function addNodeCard(
  slide: PptxGenJS.Slide,
  node: SacrintDiagramNode,
  x: number,
  y: number,
  width: number,
  height: number,
  accent: string,
  accent2: string,
  options: { border?: string; fill?: string; compact?: boolean } = {}
) {
  addPanel(slide, x, y, width, height, {
    fill: options.fill ?? C.panel,
    transparency: 20,
    stroke: options.border ?? C.strokeSoft,
    strokeWidth: options.border ? 1 : 0.75,
  });
  addLabel(slide, node.label, x + 12, y + 8, width - 24, 16, accent2, options.compact ? 7 : 8);
  addText(slide, node.detail, x + 12, y + 28, width - 24, Math.max(20, height - 38), {
    fontSize: pt(options.compact ? 9 : 11),
    color: C.textSoft,
    lineSpacingMultiple: 1.02,
  });
}

function addSpeciesCard(
  slide: PptxGenJS.Slide,
  node: SacrintDiagramNode,
  x: number,
  y: number,
  width: number,
  height: number,
  accent: string,
  compact: boolean
) {
  addPanel(slide, x, y, width, height, { fill: C.panelAlt, transparency: 18, stroke: accent, strokeWidth: 1 });
  addText(slide, node.label, x + 10, y + 8, width - 20, height - 34, {
    fontFace: FONT_DISPLAY,
    fontSize: pt(compact ? 16 : 21),
    bold: true,
    color: accent,
    valign: 'middle',
  });
  addLabel(slide, node.detail, x + 10, y + height - 20, width - 20, 14, C.muted, 7);
}

function addRightArrow(slide: PptxGenJS.Slide, x: number, y: number, width: number, color: string, dashed = false) {
  if (dashed) {
    addLine(slide, x, y, x + width, y, color, 1.2, 'dash');
    return;
  }
  slide.addShape('rightArrow', {
    x: inch(x),
    y: inch(y - 5),
    w: inch(Math.max(0.08, width)),
    h: inch(10),
    fill: { color },
    line: { color, transparency: 100 },
  });
}

function addReactionDiagram(slide: PptxGenJS.Slide, diagram: ReactionDiagramSpec, accent: string, accent2: string) {
  const area = { x: 840, y: 330, w: 984, h: 400 };
  const pad = 12;
  const gap = 10;
  const cardW = 230;
  const cardH = 82;
  const leftX = area.x + pad;
  const rightX = area.x + area.w - pad - cardW;
  const arrowStart = leftX + cardW + 20;
  const arrowEnd = rightX - 20;
  const arrowY = area.y + area.h * 0.45;

  slide.addShape('ellipse', {
    x: inch(area.x + area.w / 2 - 180),
    y: inch(area.y + area.h / 2 - 180),
    w: inch(360),
    h: inch(360),
    fill: { color: C.canvas, transparency: 100 },
    line: { color: accent2, width: 0.75, transparency: 82 },
  });

  const stack = (nodes: SacrintDiagramNode[], startX: number, color: string) => {
    const total = nodes.length * cardH + Math.max(0, nodes.length - 1) * gap;
    const startY = area.y + (area.h - total) / 2;
    nodes.slice(0, 2).forEach((node, index) => {
      addSpeciesCard(slide, node, startX, startY + index * (cardH + gap), cardW, cardH, color, false);
    });
  };

  stack(diagram.reactants, leftX, accent);
  stack(diagram.products, rightX, accent2);

  addText(slide, diagram.condition, arrowStart + 8, arrowY - 42, arrowEnd - arrowStart - 16, 36, {
    fontSize: pt(10),
    color: C.textSoft,
    align: 'center',
  });
  addRightArrow(slide, arrowStart, arrowY, arrowEnd - arrowStart, diagram.available ? accent : C.muted, !diagram.available);
  addLabel(
    slide,
    diagram.available ? 'Transformación' : 'Relación conceptual',
    arrowStart,
    arrowY + 12,
    arrowEnd - arrowStart,
    16,
    C.muted,
    7
  );
  addText(slide, diagram.note, area.x + pad, area.y + area.h - 30, area.w - pad * 2, 24, {
    fontSize: pt(8),
    color: C.muted,
    align: 'center',
  });
}

function addArgumentDiagram(slide: PptxGenJS.Slide, diagram: ArgumentDiagramSpec, accent: string, accent2: string) {
  const area = { x: 840, y: 314, w: 984, h: 424 };
  const pad = 12;
  const gap = 18;
  const thesisH = 82;
  const premiseH = 104;
  const bottomH = 98;
  const thesisW = area.w * 0.64;
  const thesisX = area.x + (area.w - thesisW) / 2;
  const contentH = thesisH + premiseH + bottomH + gap * 2;
  const thesisY = area.y + Math.max(pad, (area.h - contentH) / 2);
  const premiseW = (area.w - pad * 2 - gap) / 2;
  const premiseY = thesisY + thesisH + gap;
  const bottomY = premiseY + premiseH + gap;
  const bottomW = (area.w - pad * 2 - gap) / 2;
  const leftPremiseX = area.x + pad;
  const rightPremiseX = leftPremiseX + premiseW + gap;
  const objectionX = area.x + pad;
  const conclusionX = objectionX + bottomW + gap;
  const fullRowW = area.w - pad * 2;
  const validPremises = diagram.premises.filter((p) => Boolean(p?.detail?.trim())).slice(0, 2);
  const hasObjection = Boolean(diagram.objection?.detail?.trim());

  addNodeCard(slide, diagram.thesis, thesisX, thesisY, thesisW, thesisH, accent, accent2, {
    border: accent,
    compact: true,
  });
  if (validPremises.length === 2) {
    addNodeCard(slide, validPremises[0]!, leftPremiseX, premiseY, premiseW, premiseH, accent, accent2, {
      compact: true,
    });
    addNodeCard(slide, validPremises[1]!, rightPremiseX, premiseY, premiseW, premiseH, accent, accent2, {
      compact: true,
    });
  } else if (validPremises.length === 1) {
    addNodeCard(slide, validPremises[0]!, leftPremiseX, premiseY, fullRowW, premiseH, accent, accent2, {
      compact: true,
    });
  }
  if (hasObjection) {
    addNodeCard(slide, diagram.objection, objectionX, bottomY, bottomW, bottomH, accent, accent2, {
      border: C.red,
      compact: true,
    });
    addNodeCard(slide, diagram.conclusion, conclusionX, bottomY, bottomW, bottomH, accent, accent2, {
      border: accent,
      compact: true,
    });
  } else {
    addNodeCard(slide, diagram.conclusion, objectionX, bottomY, fullRowW, bottomH, accent, accent2, {
      border: accent,
      compact: true,
    });
  }

  if (validPremises.length === 2) {
    addLine(slide, thesisX + thesisW * 0.32, thesisY + thesisH, leftPremiseX + premiseW / 2, premiseY, accent2, 1, 'solid', true);
    addLine(slide, thesisX + thesisW * 0.68, thesisY + thesisH, rightPremiseX + premiseW / 2, premiseY, accent2, 1, 'solid', true);
    if (hasObjection) {
      addLine(slide, leftPremiseX + premiseW / 2, premiseY + premiseH, objectionX + bottomW / 2, bottomY, C.red, 1, 'dash', true);
      addLine(slide, rightPremiseX + premiseW / 2, premiseY + premiseH, conclusionX + bottomW / 2, bottomY, accent, 1, 'solid', true);
    } else {
      addLine(slide, area.x + area.w / 2, premiseY + premiseH, area.x + area.w / 2, bottomY, accent, 1, 'solid', true);
    }
  } else if (validPremises.length === 1) {
    addLine(slide, area.x + area.w / 2, thesisY + thesisH, area.x + area.w / 2, premiseY, accent2, 1, 'solid', true);
    if (hasObjection) {
      addLine(slide, area.x + area.w * 0.35, premiseY + premiseH, objectionX + bottomW / 2, bottomY, C.red, 1, 'dash', true);
      addLine(slide, area.x + area.w * 0.65, premiseY + premiseH, conclusionX + bottomW / 2, bottomY, accent, 1, 'solid', true);
    } else {
      addLine(slide, area.x + area.w / 2, premiseY + premiseH, area.x + area.w / 2, bottomY, accent, 1, 'solid', true);
    }
  }
}

function addLanguageDiagram(slide: PptxGenJS.Slide, diagram: LanguageDiagramSpec, accent: string, accent2: string) {
  const area = { x: 840, y: 330, w: 984, h: 400 };
  const pad = 12;
  const gap = 22;
  const cardW = (area.w - pad * 2 - gap * 2) / 3;
  const cardH = 144;
  const contextH = 88;
  const contentH = cardH + contextH + gap;
  const topY = area.y + Math.max(pad, (area.h - contentH) / 2);
  const contextY = topY + cardH + gap;
  const inputX = area.x + pad;
  const ruleX = inputX + cardW + gap;
  const outputX = ruleX + cardW + gap;

  addNodeCard(slide, diagram.input, inputX, topY, cardW, cardH, accent, accent2, { border: accent2, compact: true });
  addNodeCard(slide, diagram.rule, ruleX, topY, cardW, cardH, accent, accent2, { border: accent, compact: true });
  addNodeCard(slide, diagram.output, outputX, topY, cardW, cardH, accent, accent2, { border: accent2, compact: true });
  addNodeCard(slide, diagram.context, area.x + pad, contextY, area.w - pad * 2, contextH, accent, accent2, { compact: true });

  addLine(slide, inputX + cardW, topY + cardH / 2, ruleX - 2, topY + cardH / 2, accent, 1.2, 'solid', true);
  addLine(slide, ruleX + cardW, topY + cardH / 2, outputX - 2, topY + cardH / 2, accent2, 1.2, 'solid', true);
  addLine(slide, area.x + area.w / 2, topY + cardH + 2, area.x + area.w / 2, contextY - 4, accent, 1, 'dash');
}

function addConceptDiagram(slide: PptxGenJS.Slide, diagram: ConceptDiagramSpec, accent: string, accent2: string) {
  const area = { x: 840, y: 330, w: 984, h: 400 };
  const pad = 10;
  const nodeW = area.w * 0.31;
  const nodeH = 84;
  const centerW = area.w * 0.3;
  const centerH = 94;
  const centerX = area.x + (area.w - centerW) / 2;
  const centerY = area.y + (area.h - centerH) / 2;
  const positions = [
    { x: area.x + pad, y: area.y + pad },
    { x: area.x + area.w - pad - nodeW, y: area.y + pad },
    { x: area.x + pad, y: area.y + area.h - pad - nodeH },
    { x: area.x + area.w - pad - nodeW, y: area.y + area.h - pad - nodeH },
  ];

  slide.addShape('ellipse', {
    x: inch(area.x + area.w / 2 - 150),
    y: inch(area.y + area.h / 2 - 150),
    w: inch(300),
    h: inch(300),
    fill: { color: C.canvas, transparency: 100 },
    line: { color: accent, width: 0.75, transparency: 80 },
  });

  positions.forEach((position) => {
    addLine(slide, centerX + centerW / 2, centerY + centerH / 2, position.x + nodeW / 2, position.y + nodeH / 2, accent2, 1, 'dash');
  });
  addNodeCard(slide, diagram.center, centerX, centerY, centerW, centerH, accent, accent2, {
    border: accent,
    fill: C.panelAlt,
    compact: true,
  });
  diagram.nodes.slice(0, 4).forEach((node, index) => {
    const position = positions[index];
    if (!position) return;
    addNodeCard(slide, node, position.x, position.y, nodeW, nodeH, accent, accent2, { compact: true });
  });
}

function addTimelineDiagram(slide: PptxGenJS.Slide, diagram: TimelineDiagramSpec, accent: string, accent2: string) {
  const area = { x: 840, y: 330, w: 984, h: 400 };
  const pad = 12;
  const events = diagram.events.slice(0, 4);
  const count = Math.max(1, events.length);
  const slot = (area.w - pad * 2) / count;
  const railY = area.y + area.h * 0.52;
  const cardW = Math.min(220, slot - 14);
  const cardH = 92;
  const stemGap = 20;

  addLine(slide, area.x + pad, railY, area.x + area.w - pad, railY, accent, 1.6);
  events.forEach((event, index) => {
    const cx = area.x + pad + slot * (index + 0.5);
    const above = index % 2 === 0;
    const cardY = above ? railY - stemGap - cardH : railY + stemGap;
    const cardX = Math.max(area.x + pad, Math.min(cx - cardW / 2, area.x + area.w - pad - cardW));
    addLine(slide, cx, railY, cx, above ? cardY + cardH : cardY, above ? accent : accent2, 1);
    addEllipse(slide, cx - 5, railY - 5, 10, 10, { fill: above ? accent : accent2, stroke: C.canvas, strokeWidth: 1.5 });
    addNodeCard(slide, event, cardX, cardY, cardW, cardH, accent, accent2, { compact: true });
    if (index < events.length - 1) {
      const nextCx = area.x + pad + slot * (index + 1.5);
      addLine(slide, cx + 10, railY, nextCx - 12, railY, accent2, 1, 'solid', true);
    }
  });

  const spanW = Math.min(area.w * 0.52, 320);
  addPanel(slide, area.x + area.w / 2 - spanW / 2, area.y + pad, spanW, 28, { fill: C.canvas, transparency: 8, stroke: accent });
  addText(slide, diagram.span.toLocaleUpperCase('es-MX'), area.x + area.w / 2 - spanW / 2 + 12, area.y + pad + 6, spanW - 24, 18, {
    fontSize: pt(9),
    bold: true,
    color: accent,
    align: 'center',
  });
}

function addSystemMapDiagram(slide: PptxGenJS.Slide, diagram: SystemMapDiagramSpec, accent: string, accent2: string) {
  const area = { x: 840, y: 330, w: 984, h: 400 };
  const pad = 12;
  const gap = 10;
  const centerW = Math.min(area.w * 0.55, 440);
  const centerH = 78;
  const centerX = area.x + (area.w - centerW) / 2;
  const centerY = area.y + pad;
  const compW = (area.w - pad * 2 - gap * 3) / 4;
  const compH = 104;
  const compY = centerY + centerH + 22;
  const envH = 58;
  const envY = area.y + area.h - pad - envH;

  diagram.components.slice(0, 4).forEach((component, index) => {
    const compX = area.x + pad + index * (compW + gap);
    addLine(slide, centerX + centerW / 2, centerY + centerH, compX + compW / 2, compY, accent2, 1, 'dash');
    addNodeCard(slide, component, compX, compY, compW, compH, accent, accent2, { compact: true });
  });
  addNodeCard(slide, diagram.center, centerX, centerY, centerW, centerH, accent, accent2, { border: accent, fill: C.panelAlt, compact: true });
  addLine(slide, area.x + area.w / 2, compY + compH, area.x + area.w / 2, envY - 4, accent, 1.2, 'solid', true);
  addNodeCard(slide, diagram.environment, area.x + pad, envY, area.w - pad * 2, envH, accent, accent2, { compact: true });
}

function addClinicalFlowDiagram(slide: PptxGenJS.Slide, diagram: ClinicalFlowDiagramSpec, accent: string, accent2: string) {
  const area = { x: 840, y: 330, w: 984, h: 400 };
  const pad = 14;
  const gap = 10;
  const stages = diagram.stages.slice(0, 4);
  const count = Math.max(1, stages.length);
  const cardW = (area.w - pad * 2 - gap * (count - 1)) / count;
  const cardH = area.h - pad * 2 - 46;
  const cardY = area.y + pad;

  slide.addShape('rect', {
    x: inch(area.x + pad),
    y: inch(cardY),
    w: inch(area.w - pad * 2),
    h: inch(cardH),
    fill: { color: C.canvas, transparency: 60 },
    line: { color: C.stroke, width: 0.5, transparency: 60 },
  });
  stages.forEach((stage, index) => {
    const cardX = area.x + pad + index * (cardW + gap);
    const stageColor = index % 2 === 0 ? accent : accent2;
    addNodeCard(slide, stage, cardX, cardY + 10, cardW, cardH - 20, accent, accent2, { border: stageColor, compact: true });
    if (index < stages.length - 1) {
      addLine(slide, cardX + cardW + 1, cardY + cardH / 2, cardX + cardW + gap - 2, cardY + cardH / 2, accent, 1.4, 'solid', true);
    }
  });
  addText(slide, diagram.note, area.x + pad, area.y + area.h - pad - 26, area.w - pad * 2, 24, {
    fontSize: pt(8),
    color: C.muted,
    align: 'center',
  });
}

function addBlockDiagramPptx(slide: PptxGenJS.Slide, diagram: BlockDiagramSpec, accent: string, accent2: string) {
  const area = { x: 840, y: 330, w: 984, h: 400 };
  const pad = 14;
  const gap = 16;
  const cardW = (area.w - pad * 2 - gap * 2) / 3;
  const feedbackH = 64;
  const loopGap = 26;
  const cardH = area.h - pad * 2 - feedbackH - loopGap;
  const topY = area.y + pad;
  const feedbackW = Math.min(area.w * 0.52, cardW * 1.6);
  const feedbackX = area.x + (area.w - feedbackW) / 2;
  const feedbackY = topY + cardH + loopGap;
  const inputX = area.x + pad;
  const processX = inputX + cardW + gap;
  const outputX = processX + cardW + gap;
  const arrowY = topY + cardH / 2;

  addNodeCard(slide, diagram.input, inputX, topY, cardW, cardH, accent, accent2, { border: accent2, compact: true });
  addNodeCard(slide, diagram.process, processX, topY, cardW, cardH, accent, accent2, { border: accent, compact: true });
  addNodeCard(slide, diagram.output, outputX, topY, cardW, cardH, accent, accent2, { border: accent2, compact: true });
  addLine(slide, inputX + cardW, arrowY, processX - 2, arrowY, accent, 1.3, 'solid', true);
  addLine(slide, processX + cardW, arrowY, outputX - 2, arrowY, accent2, 1.3, 'solid', true);
  addNodeCard(slide, diagram.feedback, feedbackX, feedbackY, feedbackW, feedbackH, accent, accent2, { compact: true });
  addLine(slide, outputX + cardW / 2, topY + cardH + 4, feedbackX + feedbackW - 20, feedbackY + feedbackH / 2, accent2, 1, 'dash', true);
  addLine(slide, feedbackX + 20, feedbackY + feedbackH / 2, inputX + cardW / 2, topY + cardH + 4, accent, 1, 'dash', true);
}

function addSopFlowDiagram(slide: PptxGenJS.Slide, diagram: SopFlowDiagramSpec, accent: string, accent2: string) {
  const area = { x: 840, y: 330, w: 984, h: 400 };
  const pad = 14;
  const gap = 10;
  const steps = diagram.steps.slice(0, 4);
  const count = Math.max(1, steps.length);
  const standardH = 50;
  const cardW = (area.w - pad * 2 - gap * (count - 1)) / count;
  const cardH = area.h - pad * 2 - standardH - 16;
  const cardY = area.y + pad;
  const standardY = area.y + area.h - pad - standardH;

  steps.forEach((step, index) => {
    const cardX = area.x + pad + index * (cardW + gap);
    const stepColor = index % 2 === 0 ? accent : accent2;
    addNodeCard(slide, step, cardX, cardY + 8, cardW, cardH - 8, accent, accent2, { border: stepColor, compact: true });
    addEllipse(slide, cardX + cardW - 32, cardY + 2, 22, 22, { fill: stepColor, stroke: C.canvas, strokeWidth: 1.5 });
    addText(slide, String(index + 1).padStart(2, '0'), cardX + cardW - 32, cardY + 6, 22, 16, {
      fontFace: FONT_DISPLAY,
      fontSize: pt(9),
      bold: true,
      color: C.canvas,
      align: 'center',
    });
    if (index < steps.length - 1) {
      addLine(slide, cardX + cardW + 1, cardY + cardH / 2, cardX + cardW + gap - 2, cardY + cardH / 2, accent, 1.4, 'solid', true);
    }
  });
  addPanel(slide, area.x + pad, standardY, area.w - pad * 2, standardH, { fill: C.panel, transparency: 10, stroke: accent, strokeWidth: 1 });
  addText(slide, diagram.standard.toLocaleUpperCase('es-MX'), area.x + pad + 16, standardY + 12, area.w - pad * 2 - 32, 26, {
    fontSize: pt(9),
    bold: true,
    color: C.textSoft,
    align: 'center',
  });
}

function addCreativeCycleDiagram(slide: PptxGenJS.Slide, diagram: CreativeCycleDiagramSpec, accent: string, accent2: string) {
  const area = { x: 840, y: 330, w: 984, h: 400 };
  const pad = 14;
  const gap = 10;
  const phases = diagram.phases.filter((p) => Boolean(p?.detail?.trim())).slice(0, 4);
  const count = Math.max(1, phases.length);
  const statementText = (diagram.statement || '').trim();
  const hasStrip = Boolean(statementText);
  const stripH = hasStrip ? 50 : 0;
  const cardW = (area.w - pad * 2 - gap * (count - 1)) / count;
  const cardH = area.h - pad * 2 - stripH - (hasStrip ? 16 : 8);
  const cardY = area.y + pad;
  const stripY = area.y + area.h - pad - stripH;

  phases.forEach((phase, index) => {
    const cardX = area.x + pad + index * (cardW + gap);
    const phaseColor = index % 2 === 0 ? accent : accent2;
    addNodeCard(slide, phase, cardX, cardY + 8, cardW, cardH - 8, accent, accent2, { border: phaseColor, compact: true });
    addEllipse(slide, cardX + cardW - 32, cardY + 2, 22, 22, { fill: phaseColor, stroke: C.canvas, strokeWidth: 1.5 });
    addText(slide, String(index + 1).padStart(2, '0'), cardX + cardW - 32, cardY + 6, 22, 16, {
      fontFace: FONT_DISPLAY,
      fontSize: pt(9),
      bold: true,
      color: C.canvas,
      align: 'center',
    });
    if (index < phases.length - 1) {
      addLine(slide, cardX + cardW + 1, cardY + cardH / 2, cardX + cardW + gap - 2, cardY + cardH / 2, accent, 1.4, 'solid', true);
    }
  });
  if (hasStrip) {
    addPanel(slide, area.x + pad, stripY, area.w - pad * 2, stripH, { fill: C.panel, transparency: 10, stroke: accent, strokeWidth: 1 });
    addText(slide, statementText, area.x + pad + 16, stripY + 6, area.w - pad * 2 - 32, stripH - 12, {
      fontSize: pt(9),
      bold: true,
      color: C.textSoft,
      align: 'center',
      maxLines: 2,
    });
  }
}

function addTrainingCycleDiagram(slide: PptxGenJS.Slide, diagram: TrainingCycleDiagramSpec, accent: string, accent2: string) {
  const area = { x: 840, y: 330, w: 984, h: 400 };
  const pad = 14;
  const gap = 10;
  const phases = diagram.phases.filter((p) => Boolean(p?.detail?.trim())).slice(0, 4);
  const count = Math.max(1, phases.length);
  const principleText = (diagram.principle || '').trim();
  const hasStrip = Boolean(principleText);
  const stripH = hasStrip ? 48 : 0;
  const returnGap = 18;
  const cardW = (area.w - pad * 2 - gap * (count - 1)) / count;
  const cardH = area.h - pad * 2 - stripH - returnGap - (hasStrip ? 12 : 4);
  const cardY = area.y + pad;
  const returnY = cardY + cardH + returnGap / 2;
  const stripY = area.y + area.h - pad - stripH;

  addPanel(slide, area.x + pad, cardY, area.w - pad * 2, cardH + 8, { fill: C.canvas, transparency: 60, stroke: C.stroke });

  phases.forEach((phase, index) => {
    const cardX = area.x + pad + index * (cardW + gap);
    const phaseColor = index % 2 === 0 ? accent : accent2;
    slide.addShape('rect', {
      x: inch(cardX + 10),
      y: inch(cardY + cardH - 6),
      w: inch(cardW - 20),
      h: inch(4),
      fill: { color: phaseColor, transparency: Math.max(20, 70 - index * 15) },
      line: { color: phaseColor, transparency: 100 },
    });
    addNodeCard(slide, phase, cardX, cardY + 10, cardW, cardH - 18, accent, accent2, { border: phaseColor, compact: true });
    if (index < phases.length - 1) {
      addLine(slide, cardX + cardW + 1, cardY + cardH / 2, cardX + cardW + gap - 2, cardY + cardH / 2, accent, 1.4, 'solid', true);
    }
  });

  if (phases.length > 1) {
    const firstX = area.x + pad + cardW / 2;
    const lastX = area.x + pad + (phases.length - 1) * (cardW + gap) + cardW / 2;
    const bottomY = cardY + cardH + 4;
    addLine(slide, lastX, bottomY, lastX, returnY, accent2, 1.2, 'dash');
    addLine(slide, lastX, returnY, firstX, returnY, accent2, 1.2, 'dash');
    addLine(slide, firstX, returnY, firstX, bottomY, accent2, 1.2, 'dash', true);
  }

  if (hasStrip) {
    addPanel(slide, area.x + pad, stripY, area.w - pad * 2, stripH, { fill: C.panel, transparency: 10, stroke: accent, strokeWidth: 1 });
    addText(slide, principleText, area.x + pad + 16, stripY + 5, area.w - pad * 2 - 32, stripH - 10, {
      fontSize: pt(9),
      bold: true,
      color: C.textSoft,
      align: 'center',
      maxLines: 2,
    });
  }
}

function addRegulationFlowDiagram(slide: PptxGenJS.Slide, diagram: RegulationFlowDiagramSpec, accent: string, accent2: string) {
  const area = { x: 840, y: 330, w: 984, h: 400 };
  const pad = 14;
  const gap = 10;
  const anchorText = (diagram.anchor || '').trim();
  const hasAnchor = Boolean(anchorText);
  const anchorH = hasAnchor ? 48 : 0;
  const gridH = area.h - pad * 2 - anchorH - (hasAnchor ? 14 : 0);
  const cardW = (area.w - pad * 2 - gap) / 2;
  const cardH = (gridH - gap) / 2;
  const gridX = area.x + pad;
  const gridY = area.y + pad;
  const anchorY = area.y + area.h - pad - anchorH;
  const stages = diagram.stages.filter((s) => Boolean(s?.detail?.trim())).slice(0, 4);
  const positions = [
    { cardX: gridX, cardY: gridY },
    { cardX: gridX + cardW + gap, cardY: gridY },
    { cardX: gridX + cardW + gap, cardY: gridY + cardH + gap },
    { cardX: gridX, cardY: gridY + cardH + gap },
  ];

  stages.forEach((stage, index) => {
    const position = positions[index];
    if (!position) return;
    const stageColor = index % 2 === 0 ? accent : accent2;
    addNodeCard(slide, stage, position.cardX, position.cardY, cardW, cardH, accent, accent2, { border: stageColor, compact: true });
  });

  if (stages.length > 1) addLine(slide, gridX + cardW + 2, gridY + cardH / 2, gridX + cardW + gap - 2, gridY + cardH / 2, accent, 1.3, 'solid', true);
  if (stages.length > 2) addLine(slide, gridX + cardW + gap + cardW / 2, gridY + cardH + 2, gridX + cardW + gap + cardW / 2, gridY + cardH + gap - 2, accent2, 1.3, 'solid', true);
  if (stages.length > 3) addLine(slide, gridX + cardW + gap - 2, gridY + cardH + gap + cardH / 2, gridX + cardW + 2, gridY + cardH + gap + cardH / 2, accent, 1.3, 'solid', true);
  if (stages.length > 3) addLine(slide, gridX + cardW / 2, gridY + cardH + gap - 2, gridX + cardW / 2, gridY + cardH + 2, accent2, 1.3, 'dash', true);

  if (hasAnchor) {
    addPanel(slide, area.x + pad, anchorY, area.w - pad * 2, anchorH, { fill: C.panel, transparency: 10, stroke: accent, strokeWidth: 1 });
    addText(slide, anchorText, area.x + pad + 16, anchorY + 5, area.w - pad * 2 - 32, anchorH - 10, {
      fontSize: pt(9),
      bold: true,
      color: C.textSoft,
      align: 'center',
      maxLines: 2,
    });
  }
}

export function addDiagram(slide: PptxGenJS.Slide, diagram: SacrintDiagramSpec, accent: string, accent2: string) {
  switch (diagram.kind) {
    case 'linear':
      addGraph(slide, diagram, accent, accent2);
      return;
    case 'quadratic':
      addQuadraticDiagram(slide, diagram, accent, accent2);
      return;
    case 'system-2x2':
      addSystem2x2Diagram(slide, diagram, accent, accent2);
      return;
    case 'exponential':
      addExponentialDiagram(slide, diagram, accent, accent2);
      return;
    case 'geometry':
      addGeometryDiagram(slide, diagram, accent, accent2);
      return;
    case 'reaction':
      addReactionDiagram(slide, diagram, accent, accent2);
      return;
    case 'argument':
      addArgumentDiagram(slide, diagram, accent, accent2);
      return;
    case 'language':
      addLanguageDiagram(slide, diagram, accent, accent2);
      return;
    case 'concept':
      addConceptDiagram(slide, diagram, accent, accent2);
      return;
    case 'timeline':
      addTimelineDiagram(slide, diagram, accent, accent2);
      return;
    case 'system-map':
      addSystemMapDiagram(slide, diagram, accent, accent2);
      return;
    case 'clinical-flow':
      addClinicalFlowDiagram(slide, diagram, accent, accent2);
      return;
    case 'block-diagram':
      addBlockDiagramPptx(slide, diagram, accent, accent2);
      return;
    case 'sop-flow':
      addSopFlowDiagram(slide, diagram, accent, accent2);
      return;
    case 'creative-cycle':
      addCreativeCycleDiagram(slide, diagram, accent, accent2);
      return;
    case 'training-cycle':
      addTrainingCycleDiagram(slide, diagram, accent, accent2);
      return;
    case 'regulation-flow':
      addRegulationFlowDiagram(slide, diagram, accent, accent2);
  }
}
