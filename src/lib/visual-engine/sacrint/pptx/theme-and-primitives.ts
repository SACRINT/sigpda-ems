import type PptxGenJS from 'pptxgenjs';
import type { SacrintDeckSpec, SacrintFact } from '../types';
import { fitText } from '../text-layout';

export const W = 10;
export const IN = W / 1920;
export const DESIGN_PX_PER_PT = 1920 / (W * 72); // 1 pt = 2.6667 design px en diapositiva de 10 in
export const FONT_DISPLAY = 'Calibri';
export const FONT_BODY = 'Calibri';

export const C = {
  canvas: '05070B',
  panel: '08111D',
  panelAlt: '0B1826',
  stroke: '1E3A5B',
  strokeSoft: '244668',
  text: 'E6EEF8',
  textSoft: 'AFC1D6',
  muted: '71869D',
  white: 'FFFFFF',
  red: 'FF3131',
  emerald: '50C878',
  amber: 'F5A524',
} as const;

export function inch(px: number): number {
  return px * IN;
}

export function pt(px: number): number {
  return Math.max(10, Math.round(px * 0.5 * 10) / 10);
}

export type TextOptions = Omit<PptxGenJS.TextPropsOptions, 'x' | 'y' | 'w' | 'h'> & {
  maxLines?: number;
  lineHeightRatio?: number;
  truncate?: boolean;
};

export function addText(
  slide: PptxGenJS.Slide,
  value: string,
  x: number,
  y: number,
  width: number,
  height: number,
  options: TextOptions = {}
) {
  const cleanedValue = String(value ?? '').replace(/[ \t]+/g, ' ').trim();
  if (!cleanedValue) return;
  const {
    maxLines: explicitMaxLines,
    lineHeightRatio: explicitLineHeightRatio,
    lineSpacingMultiple,
    truncate: _truncate = false,
    ...textOptions
  } = options;
  void _truncate;
  const lineHeightRatio = explicitLineHeightRatio ?? lineSpacingMultiple ?? 1.15;
  const requestedPt = textOptions.fontSize ?? pt(20);
  const minPt = height <= 28 ? 7 : 7.5;
  const allowedLines =
    explicitMaxLines ??
    Math.max(1, Math.floor((height + 2) / (minPt * DESIGN_PX_PER_PT * lineHeightRatio)));

  let finalPt = minPt;
  for (let candidatePt = requestedPt; candidatePt >= minPt - 0.01; candidatePt -= 0.5) {
    const roundedPt = Math.round(candidatePt * 10) / 10;
    const candidatePx = roundedPt * DESIGN_PX_PER_PT;
    const fitted = fitText(cleanedValue, width, {
      family: textOptions.fontFace === FONT_DISPLAY ? 'display' : 'body',
      weight: textOptions.bold ? 'bold' : 'regular',
      maxFontSize: candidatePx,
      minFontSize: candidatePx,
      maxLines: allowedLines,
      lineHeightRatio,
      truncate: false,
    });
    const neededHeight = fitted.lines.length * (candidatePx * lineHeightRatio);
    if (!fitted.overflow && fitted.lines.length <= allowedLines && neededHeight <= height + 2) {
      finalPt = roundedPt;
      break;
    }
  }

  slide.addText(cleanedValue, {
    x: inch(x),
    y: inch(y),
    w: inch(width),
    h: inch(height),
    fontFace: FONT_BODY,
    color: C.text,
    margin: 0,
    lineSpacingMultiple: lineHeightRatio,
    ...textOptions,
    fontSize: finalPt,
    valign: textOptions.valign ?? 'top',
    fit: 'none',
    wrap: true,
  });
}

export function addLabel(
  slide: PptxGenJS.Slide,
  value: string,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string = C.muted,
  size = 10
) {
  addText(slide, value.toLocaleUpperCase('es-MX'), x, y, width, height, {
    fontSize: pt(size),
    bold: true,
    color,
  });
}

export function addPanel(
  slide: PptxGenJS.Slide,
  x: number,
  y: number,
  width: number,
  height: number,
  options: { fill?: string; transparency?: number; stroke?: string; strokeWidth?: number } = {}
) {
  slide.addShape('roundRect', {
    x: inch(x),
    y: inch(y),
    w: inch(width),
    h: inch(height),
    fill: { color: options.fill ?? C.panel, transparency: options.transparency ?? 14 },
    line: { color: options.stroke ?? C.stroke, width: options.strokeWidth ?? 0.75, transparency: 35 },
    rectRadius: 0.04,
  });
}

export function addLine(
  slide: PptxGenJS.Slide,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  width = 1,
  dash: 'solid' | 'dash' = 'solid',
  arrow = false
) {
  const left = Math.min(x1, x2);
  const top = Math.min(y1, y2);
  slide.addShape('line', {
    x: inch(left),
    y: inch(top),
    w: Math.max(0.001, inch(Math.abs(x2 - x1))),
    h: Math.max(0.001, inch(Math.abs(y2 - y1))),
    flipH: x2 < x1,
    flipV: y2 < y1,
    line: { color, width, dashType: dash, endArrowType: arrow ? 'triangle' : 'none' },
  });
}

export function addEllipse(
  slide: PptxGenJS.Slide,
  x: number,
  y: number,
  width: number,
  height: number,
  options: { fill?: string; transparency?: number; stroke?: string; strokeWidth?: number } = {}
) {
  slide.addShape('ellipse', {
    x: inch(x),
    y: inch(y),
    w: inch(width),
    h: inch(height),
    fill: { color: options.fill ?? C.panel, transparency: options.transparency ?? 0 },
    line: { color: options.stroke ?? options.fill ?? C.stroke, width: options.strokeWidth ?? 1, transparency: options.stroke ? 0 : 100 },
  });
}

export function addHud(slide: PptxGenJS.Slide, left: string, right: string, active: number, accent: string, totalSteps = 8) {
  const pillW = Math.min(720, Math.max(360, Math.round(left.length * 14.5 + 56)));
  const rightX = Math.max(1220, 70 + pillW + 24);
  slide.addShape('roundRect', {
    x: inch(70),
    y: inch(46),
    w: inch(pillW),
    h: inch(38),
    fill: { color: C.panel, transparency: 20 },
    line: { color: accent, width: 0.75, transparency: 30 },
    rectRadius: 0.18,
  });
  addText(slide, left.toLocaleUpperCase('es-MX'), 88, 53, pillW - 36, 24, {
    fontSize: pt(18),
    bold: true,
    color: accent,
    valign: 'middle',
    maxLines: 1,
  });
  addText(slide, right.toLocaleUpperCase('es-MX'), rightX, 55, 1840 - rightX, 22, {
    fontSize: pt(17),
    color: C.muted,
    align: 'right',
    valign: 'middle',
    maxLines: 1,
  });
  for (let index = 0; index < totalSteps; index += 1) {
    slide.addShape('rect', {
      x: inch(80 + index * 54),
      y: inch(112),
      w: inch(50),
      h: inch(index === active ? 4 : 2),
      fill: { color: index === active ? accent : C.strokeSoft, transparency: index === active ? 0 : 45 },
      line: { color: index === active ? accent : C.strokeSoft, transparency: index === active ? 0 : 100 },
    });
  }
}

export function addFooter(slide: PptxGenJS.Slide, deck: SacrintDeckSpec, right: string, accent: string) {
  addLine(slide, 80, 1012, 1840, 1012, C.strokeSoft, 0.75);
  addText(slide, `${deck.meta.schoolName} · ${deck.meta.teacherName}`, 80, 1026, 980, 18, {
    fontSize: pt(10),
    color: C.muted,
  });
  addText(slide, right.toLocaleUpperCase('es-MX'), 1240, 1026, 600, 18, {
    fontSize: pt(10),
    color: accent,
    align: 'right',
  });
}

export function addFactStrip(
  slide: PptxGenJS.Slide,
  facts: SacrintFact[],
  x: number,
  y: number,
  width: number,
  height: number
) {
  const gap = 12;
  const tileW = (width - gap * (facts.length - 1)) / facts.length;
  facts.forEach((fact, index) => {
    const tx = x + index * (tileW + gap);
    addPanel(slide, tx, y, tileW, height, { fill: C.panel, transparency: 18 });
    addLabel(slide, fact.label, tx + 16, y + 14, tileW - 32, 18, C.muted, 7);
    addText(slide, fact.value, tx + 16, y + 38, tileW - 32, 34, {
      fontFace: FONT_DISPLAY,
      fontSize: pt(27),
      bold: true,
      color: C.white,
    });
  });
}

export function coverArt(slide: PptxGenJS.Slide, deck: SacrintDeckSpec, accent: string, accent2: string) {
  addPanel(slide, 1140, 150, 700, 760, { fill: C.panel, transparency: 8, stroke: C.strokeSoft });
  const cx = 1490;
  const cy = 470;
  const styleId = deck.style.id;

  if (styleId === 'naturales') {
    addEllipse(slide, cx - 235, cy - 235, 470, 470, { fill: C.canvas, transparency: 100, stroke: accent, strokeWidth: 0.9 });
    addEllipse(slide, cx - 170, cy - 170, 340, 340, { fill: C.canvas, transparency: 100, stroke: accent2, strokeWidth: 0.8 });
    const radius = 190;
    const nodes: Array<[number, number, number]> = [
      [0, 0, 14],
      [0.9, -0.35, 9],
      [0.55, 0.8, 8],
      [-0.72, 0.55, 10],
      [-0.95, -0.4, 7],
      [-0.35, -0.95, 8],
      [0.4, -1.0, 6],
      [1.0, 0.45, 7],
    ];
    nodes.slice(1).forEach(([dx, dy, r]) => {
      const nx = cx + dx * radius;
      const ny = cy + dy * radius;
      addLine(slide, cx, cy, nx, ny, accent2, 0.75);
      addEllipse(slide, nx - r, ny - r, r * 2, r * 2, { fill: accent2, transparency: 15 });
      addEllipse(slide, nx - r - 4, ny - r - 4, r * 2 + 8, r * 2 + 8, { fill: C.canvas, transparency: 100, stroke: accent2, strokeWidth: 0.7 });
    });
    addEllipse(slide, cx - 14, cy - 14, 28, 28, { fill: accent, stroke: C.canvas, strokeWidth: 1.5 });
    const pulseY = 790;
    const pulse = [1200, 1340, 1380, 1420, 1460, 1780];
    addLine(slide, pulse[0], pulseY, pulse[1], pulseY, accent2, 1.4);
    addLine(slide, pulse[1], pulseY, pulse[2], pulseY - 42, accent2, 1.4);
    addLine(slide, pulse[2], pulseY - 42, pulse[3], pulseY + 34, accent2, 1.4);
    addLine(slide, pulse[3], pulseY + 34, pulse[4], pulseY, accent2, 1.4);
    addLine(slide, pulse[4], pulseY, pulse[5], pulseY, accent2, 1.4);
  } else if (styleId === 'humanidades') {
    addEllipse(slide, cx - 235, cy - 235, 470, 470, { fill: C.canvas, transparency: 100, stroke: accent2, strokeWidth: 0.8 });
    slide.addShape('rect', {
      x: inch(cx - 216),
      y: inch(cy - 190),
      w: inch(200),
      h: inch(380),
      rotate: -5,
      fill: { color: C.panel, transparency: 8 },
      line: { color: accent, width: 1.2 },
    });
    slide.addShape('rect', {
      x: inch(cx + 16),
      y: inch(cy - 190),
      w: inch(200),
      h: inch(380),
      rotate: 5,
      fill: { color: C.panelAlt, transparency: 8 },
      line: { color: accent, width: 1.2 },
    });
    addLine(slide, cx, cy - 196, cx, cy + 196, accent2, 1.2);
    for (let index = 0; index < 5; index += 1) {
      const offset = cy - 150 + index * 62;
      addLine(slide, cx - 196, offset, cx - 44, offset, C.textSoft, 1);
      addLine(slide, cx + 44, offset, cx + 196, offset, C.textSoft, 1);
    }
    addText(slide, '“', cx - 250, cy - 260, 220, 220, { fontSize: pt(170), color: C.stroke, align: 'left' });
  } else if (styleId === 'socioemocional') {
    addEllipse(slide, cx - 190, cy - 150, 320, 320, { fill: accent, transparency: 88 });
    addEllipse(slide, cx + 10, cy - 20, 250, 250, { fill: accent2, transparency: 86 });
    addEllipse(slide, cx - 120, cy - 230, 190, 190, { fill: accent, transparency: 91 });
    [0.44, 0.66, 0.88, 1.06].forEach((factor, index) => {
      const r = 190 * factor;
      addEllipse(slide, cx - r, cy - r, r * 2, r * 2, {
        fill: C.canvas,
        transparency: 100,
        stroke: index % 2 === 0 ? accent : accent2,
        strokeWidth: 1,
      });
    });
    for (let index = 0; index < 3; index += 1) {
      const y = 700 + index * 34;
      addLine(slide, cx - 250, y, cx + 250, y, index === 1 ? accent : accent2, 1.2, 'dash');
    }
    addEllipse(slide, cx - 10, cy - 10, 20, 20, { fill: accent, stroke: C.canvas, strokeWidth: 1.5 });
  } else if (styleId === 'tecnica') {
    for (let index = 0; index < 3; index += 1) {
      slide.addShape('chevron', {
        x: inch(1290 + index * 76),
        y: inch(cy - 120 + index * 12),
        w: inch(112),
        h: inch(240 - index * 24),
        fill: { color: C.canvas, transparency: 100 },
        line: { color: index === 1 ? accent : accent2, width: 2 },
      });
    }
    const heights = [150, 240, 180, 280];
    heights.forEach((height, index) => {
      slide.addShape('rect', {
        x: inch(1580 + index * 48),
        y: inch(800 - height),
        w: inch(32),
        h: inch(height),
        fill: { color: index === 1 ? accent : accent2, transparency: index === 1 ? 8 : 45 },
        line: { color: C.canvas, width: 0 },
      });
    });
    for (let index = 0; index < 4; index += 1) {
      addLine(slide, 1180, 250 + index * 22, 1310 + index * 24, 250 + index * 22, accent, 2);
    }
    addLine(slide, 1180, 815, 1800, 815, accent2, 1.2);
  } else {
    addEllipse(slide, cx - 250, cy - 250, 500, 500, { fill: C.canvas, transparency: 100, stroke: accent, strokeWidth: 0.8 });
    addEllipse(slide, cx - 180, cy - 180, 360, 360, { fill: C.canvas, transparency: 100, stroke: accent2, strokeWidth: 0.8 });
    addEllipse(slide, cx - 110, cy - 110, 220, 220, { fill: C.canvas, transparency: 100, stroke: C.strokeSoft, strokeWidth: 0.8 });
    if (styleId === 'exactas') {
      slide.addShape('hexagon', {
        x: inch(cx - 120),
        y: inch(cy - 140),
        w: inch(240),
        h: inch(280),
        fill: { color: C.canvas, transparency: 100 },
        line: { color: accent, width: 1.2 },
      });
      for (let index = 0; index < 8; index += 1) {
        const angle = (Math.PI * 2 * index) / 8 - Math.PI / 2;
        const px = cx + Math.cos(angle) * 250;
        const py = cy + Math.sin(angle) * 250;
        addEllipse(slide, px - 4, py - 4, 8, 8, { fill: index % 2 === 0 ? accent : accent2, stroke: C.canvas, strokeWidth: 1 });
      }
      addLine(slide, 1180, 780, 1800, 250, accent2, 0.75);
      addLine(slide, 1180, 250, 1800, 780, accent, 0.75);
    } else {
      addLine(slide, cx - 250, cy, cx + 250, cy, accent2, 0.8);
      addLine(slide, cx, cy - 250, cx, cy + 250, accent, 0.8);
      addEllipse(slide, cx - 42, cy - 42, 84, 84, { fill: C.canvas, transparency: 100, stroke: accent2, strokeWidth: 1 });
    }
    addEllipse(slide, cx - 7, cy - 7, 14, 14, { fill: accent, stroke: C.canvas, strokeWidth: 2 });
  }

  addLabel(slide, deck.style.coverCaption, 1170, 824, 460, 18, accent, 8);
  addText(slide, `SISTEMA VISUAL · ${deck.style.label.toLocaleUpperCase('es-MX')}`, 1170, 846, 460, 18, {
    fontSize: pt(9),
    color: C.muted,
  });
}

export function addStyleBackdrop(slide: PptxGenJS.Slide, deck: SacrintDeckSpec) {
  const { accent, accent2 } = deck.pack;
  switch (deck.style.id) {
    case 'exactas':
      addLine(slide, 1200, 34, 1840, 34, accent, 0.75);
      for (let index = 0; index <= 12; index += 1) {
        addLine(slide, 1200 + index * 53, 34, 1200 + index * 53, index % 3 === 0 ? 46 : 40, accent, 0.6);
      }
      addLine(slide, 42, 560, 42, 960, accent2, 0.6);
      for (let index = 0; index <= 10; index += 1) {
        addLine(slide, 42, 560 + index * 40, 54, 560 + index * 40, accent2, 0.5);
      }
      addEllipse(slide, 1814, 146, 60, 60, { fill: C.canvas, transparency: 100, stroke: accent2, strokeWidth: 0.8 });
      break;
    case 'naturales':
      addEllipse(slide, 1744, 700, 16, 16, { fill: accent2, transparency: 20 });
      addEllipse(slide, 1650, 640, 12, 12, { fill: accent2, transparency: 30 });
      addEllipse(slide, 1680, 780, 14, 14, { fill: accent2, transparency: 30 });
      addLine(slide, 1752, 708, 1656, 646, accent2, 0.6);
      addLine(slide, 1752, 708, 1687, 787, accent2, 0.6);
      addLine(slide, 80, 962, 340, 962, accent2, 1);
      addLine(slide, 340, 962, 372, 932, accent2, 1);
      addLine(slide, 372, 932, 404, 988, accent2, 1);
      addLine(slide, 404, 988, 436, 962, accent2, 1);
      addLine(slide, 436, 962, 640, 962, accent2, 1);
      break;
    case 'humanidades':
      addLine(slide, 30, 160, 30, 980, accent, 0.7);
      addLine(slide, 41, 160, 41, 980, accent, 0.5);
      addLine(slide, 1879, 160, 1879, 980, accent2, 0.5);
      break;
    case 'socioemocional':
      addEllipse(slide, 1520, -220, 560, 560, { fill: accent2, transparency: 93 });
      addEllipse(slide, -220, 820, 560, 560, { fill: accent, transparency: 94 });
      for (let index = 0; index < 3; index += 1) {
        addLine(slide, 80, 930 + index * 26, 700, 930 + index * 26, index === 1 ? accent2 : accent, 0.9, 'dash');
      }
      break;
    case 'tecnica':
      for (let index = 0; index < 4; index += 1) {
        addLine(slide, 1764 + index * 30, 46, 1846 + index * 30, 128, accent, 1.6);
      }
      slide.addShape('chevron', {
        x: inch(56),
        y: inch(930),
        w: inch(44),
        h: inch(64),
        fill: { color: C.canvas, transparency: 100 },
        line: { color: accent2, width: 1.4 },
      });
      break;
    default:
      addEllipse(slide, 1818, 146, 52, 52, { fill: C.canvas, transparency: 100, stroke: C.strokeSoft, strokeWidth: 0.8 });
      break;
  }
}
