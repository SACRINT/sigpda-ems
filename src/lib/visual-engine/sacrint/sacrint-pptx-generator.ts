import PptxGenJS from 'pptxgenjs';
import type {
  ArgumentDiagramSpec,
  BlockDiagramSpec,
  ClinicalFlowDiagramSpec,
  ConceptDiagramSpec,
  LanguageDiagramSpec,
  LinearDiagramSpec,
  ReactionDiagramSpec,
  CreativeCycleDiagramSpec,
  SacrintChallengeSlide,
  SacrintConceptSlide,
  SacrintDemoSlide,
  SacrintEvidenceSlide,
  SacrintDeckSpec,
  SacrintDiagramNode,
  SacrintDiagramSpec,
  SacrintFact,
  SacrintHookSlide,
  SacrintPracticeSlide,
  SacrintSlide,
  RegulationFlowDiagramSpec,
  SopFlowDiagramSpec,
  SystemMapDiagramSpec,
  TimelineDiagramSpec,
  TrainingCycleDiagramSpec,
} from './spec';
import { diagramFooterLabel, diagramModelLabel } from './diagrams';
import { fitText } from './text-layout';

const W = 10;
const IN = W / 1920;
const FONT_DISPLAY = 'Space Grotesk';
const FONT_BODY = 'Inter';

const C = {
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

function inch(px: number): number {
  return px * IN;
}

function pt(px: number): number {
  return Math.max(6, Math.round(px * 0.375 * 10) / 10);
}

type TextOptions = Omit<PptxGenJS.TextPropsOptions, 'x' | 'y' | 'w' | 'h'> & {
  maxLines?: number;
  lineHeightRatio?: number;
};

function addText(
  slide: PptxGenJS.Slide,
  value: string,
  x: number,
  y: number,
  width: number,
  height: number,
  options: TextOptions = {}
) {
  const {
    maxLines: explicitMaxLines,
    lineHeightRatio: explicitLineHeightRatio,
    lineSpacingMultiple,
    ...textOptions
  } = options;
  const pxSize = Math.max(6, (textOptions.fontSize ?? pt(16)) / 0.375);
  const lineHeightRatio = explicitLineHeightRatio ?? lineSpacingMultiple ?? 1.2;
  const maxLines = explicitMaxLines ?? Math.max(1, Math.floor(height / (pxSize * lineHeightRatio)));
  const fitted = fitText(value, width, {
    family: textOptions.fontFace === FONT_DISPLAY ? 'display' : 'body',
    weight: textOptions.bold ? 'bold' : 'regular',
    maxFontSize: Math.round(pxSize),
    minFontSize: Math.max(6, Math.round(pxSize * 0.85)),
    maxLines,
    lineHeightRatio,
    truncate: true,
  });
  if (fitted.lines.length === 0) return;

  const blockHeight = fitted.lines.length * fitted.lineHeight;
  const verticalOffset = textOptions.valign === 'middle'
    ? Math.max(0, (height - blockHeight) / 2)
    : textOptions.valign === 'bottom'
      ? Math.max(0, height - blockHeight)
      : 0;

  fitted.lines.forEach((line, index) => {
    slide.addText(line, {
      x: inch(x),
      y: inch(y + verticalOffset + index * fitted.lineHeight),
      w: inch(width),
      h: inch(fitted.lineHeight + 2),
      fontFace: FONT_BODY,
      fontSize: pt(fitted.fontSize),
      color: C.text,
      margin: 0,
      ...textOptions,
      valign: 'top',
      fit: 'none',
      wrap: false,
    });
  });
}

function addLabel(
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

function addPanel(
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

function addLine(
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
    flipV: y2 < y1,
    line: { color, width, dashType: dash, endArrowType: arrow ? 'triangle' : 'none' },
  });
}

function addEllipse(
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

function addHud(slide: PptxGenJS.Slide, left: string, right: string, active: number, accent: string) {
  slide.addShape('roundRect', {
    x: inch(70),
    y: inch(46),
    w: inch(300),
    h: inch(38),
    fill: { color: C.panel, transparency: 20 },
    line: { color: accent, width: 0.75, transparency: 30 },
    rectRadius: 0.18,
  });
  addText(slide, left.toLocaleUpperCase('es-MX'), 88, 56, 270, 20, {
    fontSize: pt(10),
    bold: true,
    color: accent,
  });
  addText(slide, right.toLocaleUpperCase('es-MX'), 1440, 58, 400, 20, {
    fontSize: pt(9),
    color: C.muted,
    align: 'right',
  });
  for (let index = 0; index < 8; index += 1) {
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

function addFooter(slide: PptxGenJS.Slide, deck: SacrintDeckSpec, right: string, accent: string) {
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

function addFactStrip(
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

function coverArt(slide: PptxGenJS.Slide, deck: SacrintDeckSpec, accent: string, accent2: string) {
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

function addStyleBackdrop(slide: PptxGenJS.Slide, deck: SacrintDeckSpec) {
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

function addGraph(slide: PptxGenJS.Slide, diagram: LinearDiagramSpec, accent: string, accent2: string) {
  const plotX = 884;
  const plotY = 346;
  const plotW = 900;
  const plotH = 350;
  const xToPx = (value: number) => plotX + (value / diagram.domainMax) * plotW;
  const yToPx = (value: number) => plotY + plotH - (value / diagram.rangeMax) * plotH;

  addLine(slide, plotX, plotY, plotX, plotY + plotH, C.strokeSoft, 1);
  addLine(slide, plotX, plotY + plotH, plotX + plotW, plotY + plotH, C.strokeSoft, 1);
  for (let value = 2; value <= diagram.rangeMax; value += 2) {
    addLine(slide, plotX, yToPx(value), plotX + plotW, yToPx(value), C.stroke, 0.5, 'dash');
    addText(slide, String(value), plotX - 24, yToPx(value) - 8, 18, 16, { fontSize: pt(8), color: C.muted, align: 'right' });
  }
  for (let value = 0; value <= diagram.domainMax; value += 2) {
    addLine(slide, xToPx(value), plotY, xToPx(value), plotY + plotH, C.stroke, 0.5, 'dash');
    addText(slide, String(value), xToPx(value) - 10, plotY + plotH + 8, 20, 16, { fontSize: pt(8), color: C.muted, align: 'center' });
  }

  addText(slide, diagram.xLabel.toLocaleUpperCase('es-MX'), plotX + plotW / 2 - 220, plotY + plotH + 34, 440, 18, {
    fontSize: pt(9),
    color: C.muted,
    align: 'center',
  });
  addText(slide, diagram.yLabel.toLocaleUpperCase('es-MX'), plotX - 198, plotY + 160, 330, 18, {
    fontSize: pt(9),
    color: C.muted,
    align: 'center',
    valign: 'middle',
    rotate: 270,
  });

  if (!diagram.available) {
    addText(slide, 'MODELO POR CONSTRUIR', plotX + plotW / 2 - 220, plotY + plotH / 2 - 14, 440, 28, {
      fontSize: pt(18),
      bold: true,
      color: C.muted,
      align: 'center',
    });
    return;
  }

  const startX = xToPx(0);
  const startY = yToPx(diagram.intercept);
  const endX = xToPx(diagram.domainMax);
  const endY = yToPx(diagram.slope * diagram.domainMax + diagram.intercept);
  addLine(slide, startX, startY, endX, endY, accent, 2.2);

  for (const point of diagram.points) {
    const px = xToPx(point.x);
    const py = yToPx(point.y);
    addEllipse(slide, px - 4, py - 4, 8, 8, { fill: accent2, stroke: accent, strokeWidth: 1 });
    slide.addShape('roundRect', {
      x: inch(px + 8),
      y: inch(py - 22),
      w: inch(72),
      h: inch(18),
      fill: { color: C.canvas, transparency: 5 },
      line: { color: C.stroke, width: 0.5, transparency: 30 },
      rectRadius: 0.03,
    });
    addText(slide, `(${point.x}, ${point.y.toFixed(1)})`, px + 12, py - 21, 66, 16, {
      fontSize: pt(8),
      color: C.text,
    });
  }
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
  addText(slide, node.detail, x + 12, y + 28, width - 24, height - 34, {
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
    diagram.available ? 'Transformación' : 'Relación por construir',
    arrowStart,
    arrowY + 12,
    arrowEnd - arrowStart,
    16,
    C.muted,
    7
  );
  if (!diagram.available) {
    addLabel(slide, 'Por construir', area.x + area.w / 2 - 70, area.y + 4, 140, 16, C.amber, 8);
  }
  addText(slide, diagram.note, area.x + pad, area.y + area.h - 30, area.w - pad * 2, 24, {
    fontSize: pt(8),
    color: C.muted,
    align: 'center',
  });
}

function addArgumentDiagram(slide: PptxGenJS.Slide, diagram: ArgumentDiagramSpec, accent: string, accent2: string) {
  const area = { x: 840, y: 318, w: 984, h: 420 };
  const pad = 12;
  const gap = 14;
  const thesisH = 76;
  const premiseH = 88;
  const bottomH = 86;
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

  addNodeCard(slide, diagram.thesis, thesisX, thesisY, thesisW, thesisH, accent, accent2, {
    border: accent,
    compact: true,
  });
  addNodeCard(slide, diagram.premises[0] ?? { label: 'PREMISA 1', detail: 'Sin registro.' }, leftPremiseX, premiseY, premiseW, premiseH, accent, accent2, {
    compact: true,
  });
  addNodeCard(slide, diagram.premises[1] ?? { label: 'PREMISA 2', detail: 'Sin registro.' }, rightPremiseX, premiseY, premiseW, premiseH, accent, accent2, {
    compact: true,
  });
  addNodeCard(slide, diagram.objection, objectionX, bottomY, bottomW, bottomH, accent, accent2, {
    border: C.red,
    compact: true,
  });
  addNodeCard(slide, diagram.conclusion, conclusionX, bottomY, bottomW, bottomH, accent, accent2, {
    border: accent,
    compact: true,
  });

  addLine(slide, thesisX + thesisW * 0.32, thesisY + thesisH, leftPremiseX + premiseW / 2, premiseY, accent2, 1, 'solid', true);
  addLine(slide, thesisX + thesisW * 0.68, thesisY + thesisH, rightPremiseX + premiseW / 2, premiseY, accent2, 1, 'solid', true);
  addLine(slide, leftPremiseX + premiseW / 2, premiseY + premiseH, objectionX + bottomW / 2, bottomY, C.red, 1, 'dash', true);
  addLine(slide, rightPremiseX + premiseW / 2, premiseY + premiseH, conclusionX + bottomW / 2, bottomY, accent, 1, 'solid', true);
  if (!diagram.available) addLabel(slide, 'Por construir', area.x + area.w - 140, area.y, 130, 16, C.amber, 8);
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
  if (!diagram.available) addLabel(slide, 'Por construir', area.x + area.w - 140, area.y, 130, 16, C.amber, 8);
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
  if (!diagram.available) addLabel(slide, 'Por construir', area.x + area.w - 140, area.y, 130, 16, C.amber, 8);
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
  if (!diagram.available) addLabel(slide, 'Por construir', area.x + area.w - 140, area.y, 130, 16, C.amber, 8);
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
  if (!diagram.available) addLabel(slide, 'Por construir', area.x + area.w - 140, area.y, 130, 16, C.amber, 8);
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
  if (!diagram.available) addLabel(slide, 'Por construir', area.x + area.w - 140, area.y, 130, 16, C.amber, 8);
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
  if (!diagram.available) addLabel(slide, 'Por construir', area.x + area.w - 140, area.y, 130, 16, C.amber, 8);
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
  if (!diagram.available) addLabel(slide, 'Por construir', area.x + area.w - 140, area.y, 130, 16, C.amber, 8);
}

function addCreativeCycleDiagram(slide: PptxGenJS.Slide, diagram: CreativeCycleDiagramSpec, accent: string, accent2: string) {
  const area = { x: 840, y: 330, w: 984, h: 400 };
  const pad = 14;
  const gap = 10;
  const phases = diagram.phases.slice(0, 4);
  const count = Math.max(1, phases.length);
  const stripH = 50;
  const cardW = (area.w - pad * 2 - gap * (count - 1)) / count;
  const cardH = area.h - pad * 2 - stripH - 16;
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
  addPanel(slide, area.x + pad, stripY, area.w - pad * 2, stripH, { fill: C.panel, transparency: 10, stroke: accent, strokeWidth: 1 });
  addText(slide, diagram.statement.toLocaleUpperCase('es-MX'), area.x + pad + 16, stripY + 6, area.w - pad * 2 - 32, stripH - 12, {
    fontSize: pt(9),
    bold: true,
    color: C.textSoft,
    align: 'center',
    maxLines: 2,
  });
  if (!diagram.available) addLabel(slide, 'Por construir', area.x + area.w - 140, area.y, 130, 16, C.amber, 8);
}

function addTrainingCycleDiagram(slide: PptxGenJS.Slide, diagram: TrainingCycleDiagramSpec, accent: string, accent2: string) {
  const area = { x: 840, y: 330, w: 984, h: 400 };
  const pad = 14;
  const gap = 10;
  const phases = diagram.phases.slice(0, 4);
  const count = Math.max(1, phases.length);
  const stripH = 48;
  const returnGap = 18;
  const cardW = (area.w - pad * 2 - gap * (count - 1)) / count;
  const cardH = area.h - pad * 2 - stripH - returnGap - 12;
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

  addPanel(slide, area.x + pad, stripY, area.w - pad * 2, stripH, { fill: C.panel, transparency: 10, stroke: accent, strokeWidth: 1 });
  addText(slide, diagram.principle.toLocaleUpperCase('es-MX'), area.x + pad + 16, stripY + 5, area.w - pad * 2 - 32, stripH - 10, {
    fontSize: pt(9),
    bold: true,
    color: C.textSoft,
    align: 'center',
    maxLines: 2,
  });
  if (!diagram.available) addLabel(slide, 'Por construir', area.x + area.w - 140, area.y, 130, 16, C.amber, 8);
}

function addRegulationFlowDiagram(slide: PptxGenJS.Slide, diagram: RegulationFlowDiagramSpec, accent: string, accent2: string) {
  const area = { x: 840, y: 330, w: 984, h: 400 };
  const pad = 14;
  const gap = 10;
  const anchorH = 48;
  const gridH = area.h - pad * 2 - anchorH - 14;
  const cardW = (area.w - pad * 2 - gap) / 2;
  const cardH = (gridH - gap) / 2;
  const gridX = area.x + pad;
  const gridY = area.y + pad;
  const anchorY = area.y + area.h - pad - anchorH;
  const stages = diagram.stages.slice(0, 4);
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

  addPanel(slide, area.x + pad, anchorY, area.w - pad * 2, anchorH, { fill: C.panel, transparency: 10, stroke: accent, strokeWidth: 1 });
  addText(slide, diagram.anchor.toLocaleUpperCase('es-MX'), area.x + pad + 16, anchorY + 5, area.w - pad * 2 - 32, anchorH - 10, {
    fontSize: pt(9),
    bold: true,
    color: C.textSoft,
    align: 'center',
    maxLines: 2,
  });
  if (!diagram.available) addLabel(slide, 'Por construir', area.x + area.w - 140, area.y, 130, 16, C.amber, 8);
}

function addDiagram(slide: PptxGenJS.Slide, diagram: SacrintDiagramSpec, accent: string, accent2: string) {
  switch (diagram.kind) {
    case 'linear':
      addGraph(slide, diagram, accent, accent2);
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

function renderCover(slide: PptxGenJS.Slide, deck: SacrintDeckSpec, spec: Extract<SacrintSlide, { kind: 'cover' }>) {
  const accent = deck.pack.accent;
  const accent2 = deck.pack.accent2;
  addHud(slide, `${deck.pack.short} / SACRINT`, `MISIÓN ${String(deck.meta.missionNumber).padStart(2, '0')} · BLOQUE ${String(deck.meta.blockNumber).padStart(2, '0')}`, 0, accent);
  addLabel(slide, spec.eyebrow, 80, 212, 500, 20, accent, 10);
  addLine(slide, 80, 242, 420, 242, accent, 1.5);
  addText(slide, spec.title, 80, 300, 940, 346, {
    fontFace: FONT_DISPLAY,
    fontSize: pt(72),
    bold: true,
    color: C.white,
    valign: 'middle',
    maxLines: 4,
  });
  addText(slide, spec.subtitle ?? '', 80, 660, 900, 52, {
    fontSize: pt(24),
    color: C.textSoft,
  });
  addLabel(slide, spec.metaLine, 80, 748, 700, 20, C.muted, 9);
  addPanel(slide, 80, 820, 940, 54, { fill: C.panel, transparency: 22 });
  addText(slide, spec.footerNote, 102, 828, 890, 38, { fontSize: pt(spec.footerNote.length > 90 ? 13 : 16), color: C.textSoft, maxLines: 2 });
  addFactStrip(slide, spec.facts, 80, 880, 940, 84);
  coverArt(slide, deck, accent, accent2);
  addFooter(slide, deck, 'SACRINT · EMS', accent);
}

function renderHook(slide: PptxGenJS.Slide, deck: SacrintDeckSpec, spec: Extract<SacrintHookSlide, { kind: 'hook' }>) {
  addStyleBackdrop(slide, deck);
  const accent = deck.pack.accent;
  const accent2 = deck.pack.accent2;
  addHud(slide, 'Fenómeno situado', `MISIÓN ${String(deck.meta.missionNumber).padStart(2, '0')} // CONTEXTO`, 1, accent);
  addText(slide, spec.title, 80, 214, 980, 136, {
    fontFace: FONT_DISPLAY,
    fontSize: pt(54),
    bold: true,
    color: C.white,
  });
  addLabel(slide, spec.subtitle ?? '', 80, 360, 600, 20, accent, 10);
  addText(slide, '“', 82, 400, 80, 72, { fontFace: FONT_DISPLAY, fontSize: pt(72), bold: true, color: accent });
  addText(slide, spec.story, 146, 420, 860, 360, {
    fontSize: pt(spec.story.length > 520 ? 16 : spec.story.length > 360 ? 19 : 22),
    color: C.text,
    lineSpacingMultiple: 1.06,
    maxLines: 14,
  });
  addLine(slide, 146, 792, 1020, 792, accent, 0.75);

  addPanel(slide, 1120, 166, 720, 276, { fill: C.panel, transparency: 10 });
  slide.addShape('rect', { x: inch(1120), y: inch(166), w: inch(4), h: inch(276), fill: { color: accent }, line: { color: accent, transparency: 100 } });
  addLabel(slide, 'Pregunta detonadora', 1148, 194, 400, 18, accent, 9);
  addText(slide, spec.question, 1148, 270, 664, 176, {
    fontFace: FONT_DISPLAY,
    fontSize: pt(24),
    color: C.white,
    maxLines: 4,
    lineHeightRatio: 1.34,
  });

  spec.nodes.slice(0, 3).forEach((node, index) => {
    const y = 486 + index * 132;
    addPanel(slide, 1120, y, 720, 118, { fill: C.panel, transparency: 20, stroke: C.strokeSoft });
    addText(slide, String(index + 1).padStart(2, '0'), 1142, y + 22, 30, 20, { fontSize: pt(11), bold: true, color: accent2 });
    addLabel(slide, node.label, 1180, y + 22, 240, 18, accent, 9);
    addText(slide, node.detail, 1180, y + 54, 620, 48, { fontSize: pt(18), color: C.textSoft });
  });

  addFactStrip(slide, spec.facts, 80, 854, 980, 84);
  addFooter(slide, deck, 'observar · modelar · decidir', accent);
}

function renderConcept(slide: PptxGenJS.Slide, deck: SacrintDeckSpec, spec: Extract<SacrintConceptSlide, { kind: 'concept' }>) {
  addStyleBackdrop(slide, deck);
  const accent = deck.pack.accent;
  const accent2 = deck.pack.accent2;
  addHud(slide, 'Núcleo técnico', `MISIÓN ${String(deck.meta.missionNumber).padStart(2, '0')} // CONCEPTO CERO`, 2, accent);
  addText(slide, spec.title, 80, 210, 700, 120, {
    fontFace: FONT_DISPLAY,
    fontSize: pt(42),
    bold: true,
    color: C.white,
  });
  addLabel(slide, spec.subtitle ?? '', 80, 336, 520, 18, accent, 9);

  addPanel(slide, 80, 354, 700, 232, { fill: C.panel, transparency: 12 });
  addLabel(slide, 'Analogía física', 104, 382, 300, 18, accent, 9);
  addText(slide, spec.analogy, 104, 420, 652, 146, {
    fontSize: pt(21),
    color: C.text,
    lineSpacingMultiple: 1.06,
  });

  addPanel(slide, 80, 606, 700, 182, { fill: '1E080C', transparency: 35, stroke: C.red });
  addLabel(slide, 'Error común', 104, 634, 300, 18, C.red, 9);
  addText(slide, spec.misconception, 104, 672, 652, 100, {
    fontSize: pt(18),
    color: C.textSoft,
    lineSpacingMultiple: 1.06,
  });

  addPanel(slide, 824, 174, 1016, 574, { fill: C.canvas, transparency: 8 });
  addLabel(slide, diagramModelLabel(spec.diagram), 852, 206, 400, 18, accent2, 9);
  addText(slide, 'FIG. 01', 1710, 206, 100, 18, { fontSize: pt(9), color: C.muted, align: 'right' });
  const formulaW = Math.min(960, Math.max(320, spec.formula.length * 18 + 56));
  slide.addShape('roundRect', {
    x: inch(852),
    y: inch(236),
    w: inch(formulaW),
    h: inch(54),
    fill: { color: C.canvas },
    line: { color: accent, width: 1.2, transparency: 30 },
    rectRadius: 0.05,
  });
  addText(slide, spec.formula, 880, 248, formulaW - 56, 30, {
    fontFace: FONT_DISPLAY,
    fontSize: pt(24),
    bold: true,
    color: accent,
  });
  addDiagram(slide, spec.diagram, accent, accent2);

  const gap = 12;
  const tileW = (1760 - gap * 3) / 4;
  spec.variables.forEach((variable, index) => {
    const x = 80 + index * (tileW + gap);
    const color = index % 2 === 0 ? accent : accent2;
    addPanel(slide, x, 802, tileW, 132, { fill: C.panel, transparency: 16, stroke: C.strokeSoft });
    addText(slide, variable.symbol, x + 18, 826, 44, 40, { fontFace: FONT_DISPLAY, fontSize: pt(30), bold: true, color });
    addLabel(slide, variable.label, x + 62, 820, tileW - 78, 18, C.muted, 7);
    addText(slide, variable.meaning, x + 62, 846, tileW - 78, 68, { fontSize: pt(18), color: C.textSoft });
  });

  addFooter(slide, deck, diagramFooterLabel(spec.diagram), accent);
}

function renderClosing(slide: PptxGenJS.Slide, deck: SacrintDeckSpec, spec: Extract<SacrintSlide, { kind: 'closing' }>) {
  addStyleBackdrop(slide, deck);
  const accent = deck.pack.accent;
  const accent2 = deck.pack.accent2;
  addHud(slide, 'Cierre formativo', `MISIÓN ${String(deck.meta.missionNumber).padStart(2, '0')} // METACOGNICIÓN`, 3, accent);
  addText(slide, spec.title, 80, 214, 1000, 74, {
    fontFace: FONT_DISPLAY,
    fontSize: pt(48),
    bold: true,
    color: C.white,
  });
  addLabel(slide, spec.eyebrow, 80, 300, 600, 18, accent, 9);

  addPanel(slide, 80, 344, 1000, 232, { fill: C.panel, transparency: 12 });
  addLabel(slide, 'Ticket de salida', 104, 370, 260, 18, accent, 9);
  addText(slide, spec.checkpoint, 104, 416, 952, 120, {
    fontFace: FONT_DISPLAY,
    fontSize: pt(22),
    color: C.white,
  });

  addLabel(slide, 'Criterios de logro', 80, 612, 500, 18, accent2, 9);
  addText(slide, String(spec.criteria.length), 1000, 612, 80, 18, { fontSize: pt(9), color: C.muted, align: 'right' });
  spec.criteria.slice(0, 4).forEach((criterion, index) => {
    const y = 650 + index * 62;
    addPanel(slide, 80, y, 1000, 50, { fill: C.panel, transparency: 22, stroke: C.strokeSoft });
    addEllipse(slide, 103, y + 20, 10, 10, { fill: index === 0 ? accent : accent2, stroke: C.canvas, strokeWidth: 1 });
    addText(slide, criterion, 126, y + 11, 930, 32, { fontSize: pt(18), color: C.textSoft });
  });

  addPanel(slide, 1136, 166, 704, 570, { fill: C.panel, transparency: 14 });
  addLabel(slide, 'Semáforo metacognitivo', 1162, 194, 400, 18, accent, 9);
  const lights = [
    { color: C.emerald, label: 'VERDE', text: spec.trafficLight.green },
    { color: C.amber, label: 'ÁMBAR', text: spec.trafficLight.yellow },
    { color: C.red, label: 'ROJO', text: spec.trafficLight.red },
  ];
  lights.forEach((light, index) => {
    const y = 232 + index * 148;
    addPanel(slide, 1162, y, 652, 130, { fill: C.canvas, transparency: 18, stroke: C.strokeSoft });
    addEllipse(slide, 1180, y + 18, 34, 34, { fill: light.color, transparency: 80, stroke: light.color, strokeWidth: 1 });
    addEllipse(slide, 1190, y + 28, 14, 14, { fill: light.color, stroke: light.color });
    addLabel(slide, light.label, 1228, y + 18, 180, 18, light.color, 8);
    addText(slide, light.text, 1228, y + 44, 550, 70, { fontSize: pt(18), color: C.textSoft });
  });

  addLabel(slide, 'Registro de la misión', 1162, 758, 280, 18, accent2, 8);
  addFactStrip(slide, spec.facts, 1162, 780, 652, 76);

  addPanel(slide, 80, 902, 1760, 76, { fill: C.panel, transparency: 20, stroke: C.strokeSoft });
  addLabel(slide, 'Reflexión', 102, 924, 160, 18, accent, 8);
  addText(slide, spec.reflection, 212, 918, 1580, 46, { fontSize: pt(18), color: C.textSoft });

  addFooter(slide, deck, 'evidencia · autonomía · mejora', accent);
}

function renderDemo(slide: PptxGenJS.Slide, deck: SacrintDeckSpec, spec: Extract<SacrintDemoSlide, { kind: 'demo' }>) {
  addStyleBackdrop(slide, deck);
  const accent = deck.pack.accent;
  const accent2 = deck.pack.accent2;
  addHud(slide, 'Yo hago', `MISIÓN ${String(deck.meta.missionNumber).padStart(2, '0')} // DEMOSTRACIÓN`, 4, accent);
  addText(slide, spec.title, 80, 214, 860, 110, { fontFace: FONT_DISPLAY, fontSize: pt(38), bold: true, color: C.white });
  addLabel(slide, spec.eyebrow, 80, 326, 600, 18, accent, 9);

  addPanel(slide, 80, 344, 860, 268, { fill: C.panel, transparency: 12 });
  addLabel(slide, 'Demostración guiada', 104, 372, 320, 18, accent, 9);
  addText(slide, spec.demoText, 104, 410, 812, 180, { fontSize: pt(20), color: C.text, lineSpacingMultiple: 1.06, maxLines: 8 });

  if (spec.problemStatement) {
    addPanel(slide, 80, 632, 860, 128, { fill: C.panel, transparency: 20, stroke: C.strokeSoft });
    addLabel(slide, 'Problema resuelto', 104, 658, 300, 18, accent2, 8);
    addText(slide, spec.problemStatement, 104, 692, 812, 56, { fontSize: pt(16), color: C.textSoft, maxLines: 2 });
  }

  if (spec.interpretation) {
    addPanel(slide, 80, 778, 860, 100, { fill: '061410', transparency: 30, stroke: C.emerald });
    addLabel(slide, 'Interpretación', 104, 800, 260, 18, C.emerald, 8);
    addText(slide, spec.interpretation, 104, 828, 812, 40, { fontSize: pt(15), color: C.textSoft, maxLines: 2 });
  }

  addLabel(slide, 'Pasos del procedimiento', 992, 190, 400, 18, accent2, 9);
  addText(slide, String(spec.steps.length), 1740, 190, 100, 18, { fontSize: pt(9), color: C.muted, align: 'right' });
  spec.steps.slice(0, 5).forEach((step, index) => {
    const y = 226 + index * 118;
    addPanel(slide, 992, y, 848, 104, { fill: C.panel, transparency: 20, stroke: C.strokeSoft });
    addText(slide, String(index + 1).padStart(2, '0'), 1014, y + 24, 30, 20, { fontSize: pt(11), bold: true, color: accent2 });
    addText(slide, step, 1054, y + 22, 766, 68, { fontSize: pt(17), color: C.textSoft, maxLines: 3 });
  });

  addFooter(slide, deck, 'modelar · explicar · verificar', accent);
}

function renderPractice(slide: PptxGenJS.Slide, deck: SacrintDeckSpec, spec: Extract<SacrintPracticeSlide, { kind: 'practice' }>) {
  addStyleBackdrop(slide, deck);
  const accent = deck.pack.accent;
  const accent2 = deck.pack.accent2;
  addHud(slide, 'Hacemos', `MISIÓN ${String(deck.meta.missionNumber).padStart(2, '0')} // PRÁCTICA GUIADA`, 5, accent);
  addText(slide, spec.title, 80, 214, 900, 110, { fontFace: FONT_DISPLAY, fontSize: pt(38), bold: true, color: C.white });
  addLabel(slide, spec.eyebrow, 80, 326, 600, 18, accent, 9);

  addPanel(slide, 80, 344, 900, 330, { fill: C.panel, transparency: 12 });
  addLabel(slide, 'Práctica colaborativa', 104, 372, 320, 18, accent, 9);
  addText(slide, spec.practiceText, 104, 410, 852, 240, { fontSize: pt(20), color: C.text, lineSpacingMultiple: 1.06, maxLines: 10 });

  if (spec.hint) {
    addPanel(slide, 80, 696, 900, 140, { fill: '1E1808', transparency: 30, stroke: C.amber });
    addLabel(slide, 'Pista · Prevención de errores', 104, 722, 380, 18, C.amber, 8);
    addText(slide, spec.hint, 104, 756, 852, 64, { fontSize: pt(16), color: C.textSoft, maxLines: 3 });
  }

  addLabel(slide, 'Andamiaje de la práctica', 1032, 190, 400, 18, accent2, 9);
  spec.checkpoints.slice(0, 4).forEach((checkpoint, index) => {
    const y = 226 + index * 142;
    addPanel(slide, 1032, y, 808, 124, { fill: C.panel, transparency: 20, stroke: C.strokeSoft });
    addEllipse(slide, 1056, y + 24, 22, 22, { fill: C.canvas, stroke: accent2, strokeWidth: 1.5 });
    addText(slide, String(index + 1).padStart(2, '0'), 1060, y + 28, 16, 14, { fontSize: pt(8), bold: true, color: accent2 });
    addText(slide, checkpoint, 1094, y + 24, 726, 84, { fontSize: pt(16), color: C.textSoft, maxLines: 4 });
  });

  addFooter(slide, deck, 'practicar · comparar · ajustar', accent);
}

function renderChallenge(slide: PptxGenJS.Slide, deck: SacrintDeckSpec, spec: Extract<SacrintChallengeSlide, { kind: 'challenge' }>) {
  addStyleBackdrop(slide, deck);
  const accent = deck.pack.accent;
  const accent2 = deck.pack.accent2;
  addHud(slide, 'Tú haces', `MISIÓN ${String(deck.meta.missionNumber).padStart(2, '0')} // RETO Y PROYECTO`, 6, accent);
  addText(slide, spec.title, 80, 214, 940, 110, { fontFace: FONT_DISPLAY, fontSize: pt(38), bold: true, color: C.white });
  addLabel(slide, spec.eyebrow, 80, 326, 600, 18, accent, 9);

  addPanel(slide, 80, 344, 940, 288, { fill: C.panel, transparency: 12 });
  addLabel(slide, 'Reto autónomo', 104, 372, 300, 18, accent, 9);
  addText(slide, spec.challengeText, 104, 410, 892, 200, { fontSize: pt(20), color: C.text, lineSpacingMultiple: 1.06, maxLines: 9 });

  addPanel(slide, 80, 654, 940, 158, { fill: C.panel, transparency: 20, stroke: C.strokeSoft });
  addLabel(slide, 'Producto integrador', 104, 680, 300, 18, accent2, 9);
  addText(slide, spec.artifactName, 104, 710, 892, 58, { fontFace: FONT_DISPLAY, fontSize: pt(22), bold: true, color: C.white, maxLines: 2, lineHeightRatio: 1.12 });
  addText(slide, spec.communityUtility, 104, 774, 892, 34, { fontSize: pt(13), color: C.textSoft, maxLines: 2 });

  if (spec.phases.length > 0) {
    addLabel(slide, 'Fases del proyecto', 1072, 190, 360, 18, accent2, 9);
    spec.phases.slice(0, 3).forEach((phase, index) => {
      const y = 226 + index * 118;
      addPanel(slide, 1072, y, 768, 102, { fill: C.panel, transparency: 20, stroke: C.strokeSoft });
      addText(slide, `FASE ${String(index + 1).padStart(2, '0')}`, 1094, y + 22, 160, 18, { fontSize: pt(10), bold: true, color: accent2 });
      addText(slide, `${phase.hours} h`, 1730, y + 22, 90, 18, { fontSize: pt(10), bold: true, color: accent, align: 'right' });
      addText(slide, phase.title, 1094, y + 50, 720, 40, { fontSize: pt(16), color: C.textSoft, maxLines: 2 });
    });
  }

  addPanel(slide, 1072, 654, 768, 158, { fill: '061410', transparency: 30, stroke: C.emerald });
  addLabel(slide, 'Entrega comunitaria', 1096, 682, 300, 18, C.emerald, 8);
  addText(slide, 'Integra el reto al producto del proyecto y regístralo en tu bitácora de avance.', 1096, 716, 720, 76, { fontSize: pt(15), color: C.textSoft, maxLines: 3 });

  addFooter(slide, deck, 'aplicar · integrar · entregar', accent);
}

function renderEvidence(slide: PptxGenJS.Slide, deck: SacrintDeckSpec, spec: Extract<SacrintEvidenceSlide, { kind: 'evidence' }>) {
  addStyleBackdrop(slide, deck);
  const accent = deck.pack.accent;
  const accent2 = deck.pack.accent2;
  addHud(slide, 'Evidencia', `MISIÓN ${String(deck.meta.missionNumber).padStart(2, '0')} // RÚBRICA Y CRITERIOS`, 7, accent);
  addText(slide, spec.title, 80, 214, 1020, 74, { fontFace: FONT_DISPLAY, fontSize: pt(46), bold: true, color: C.white });
  addLabel(slide, spec.eyebrow, 80, 300, 600, 18, accent, 9);

  addPanel(slide, 80, 320, 1020, 138, { fill: C.panel, transparency: 12 });
  addLabel(slide, 'Pregunta guía', 104, 346, 260, 18, accent, 9);
  addText(slide, spec.checkpoint, 104, 392, 972, 50, { fontFace: FONT_DISPLAY, fontSize: pt(22), color: C.white, maxLines: 2 });

  addLabel(slide, 'Rúbrica de evaluación', 80, 480, 400, 18, accent2, 9);
  addText(slide, String(spec.rubric.length), 1020, 480, 80, 18, { fontSize: pt(9), color: C.muted, align: 'right' });
  spec.rubric.slice(0, 4).forEach((item, index) => {
    const y = 516 + index * 84;
    addPanel(slide, 80, y, 1020, 70, { fill: C.panel, transparency: 22, stroke: C.strokeSoft });
    addEllipse(slide, 103, y + 30, 10, 10, { fill: index % 2 === 0 ? accent : accent2, stroke: C.canvas, strokeWidth: 1 });
    addText(slide, item.label, 126, y + 16, 820, 44, { fontSize: pt(16), color: C.textSoft, maxLines: 2 });
    if (item.weight != null) {
      addText(slide, `${item.weight}%`, 960, y + 20, 110, 30, { fontFace: FONT_DISPLAY, fontSize: pt(18), bold: true, color: accent, align: 'right' });
    }
  });

  const validChecklist = spec.checklist.map((c) => c.trim()).filter(Boolean).slice(0, 5);
  const slotCount = Math.max(1, validChecklist.length);
  const slotStep = Math.floor(540 / slotCount);
  const slotHeight = Math.min(108, slotStep - 14);
  addPanel(slide, 1152, 166, 688, 646, { fill: C.panel, transparency: 14 });
  addLabel(slide, 'Checklist de verificación', 1178, 194, 380, 18, accent, 9);
  validChecklist.forEach((item, index) => {
    const y = 248 + index * slotStep;
    addPanel(slide, 1178, y, 636, slotHeight, { fill: C.canvas, transparency: 18, stroke: C.strokeSoft });
    slide.addShape('roundRect', { x: inch(1198), y: inch(y + Math.floor((slotHeight - 16) / 2)), w: inch(16), h: inch(16), fill: { color: C.canvas, transparency: 100 }, line: { color: accent2, width: 1.2 }, rectRadius: 0.03 });
    addText(slide, item, 1230, y + 18, 566, slotHeight - 28, { fontSize: pt(14), color: C.textSoft, maxLines: 3 });
  });

  addPanel(slide, 1152, 832, 688, 76, { fill: C.panel, transparency: 20, stroke: C.strokeSoft });
  addLabel(slide, 'Reflexión', 1174, 854, 140, 18, accent, 8);
  addText(slide, spec.reflection, 1284, 848, 540, 46, { fontSize: pt(13), color: C.textSoft, maxLines: 2 });

  addFooter(slide, deck, 'criterios · rúbrica · verificación', accent);
}

export async function generateSacrintPptx(deck: SacrintDeckSpec): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  pptx.title = deck.meta.missionTitle;
  pptx.subject = deck.meta.subjectName;
  pptx.company = deck.meta.schoolName || 'SIGPDA-EMS';
  pptx.author = deck.meta.teacherName || 'SIGPDA-EMS';

  for (const spec of deck.slides) {
    const slide = pptx.addSlide();
    slide.background = { color: C.canvas };
    if (spec.kind === 'cover') renderCover(slide, deck, spec);
    else if (spec.kind === 'hook') renderHook(slide, deck, spec);
    else if (spec.kind === 'concept') renderConcept(slide, deck, spec);
    else if (spec.kind === 'demo') renderDemo(slide, deck, spec);
    else if (spec.kind === 'practice') renderPractice(slide, deck, spec);
    else if (spec.kind === 'challenge') renderChallenge(slide, deck, spec);
    else if (spec.kind === 'evidence') renderEvidence(slide, deck, spec);
    else renderClosing(slide, deck, spec);
  }

  const out = await pptx.write({ outputType: 'nodebuffer' });
  return Buffer.from(out as Uint8Array);
}
