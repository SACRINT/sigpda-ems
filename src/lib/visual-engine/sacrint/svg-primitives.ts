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
} from './diagrams';
import { niceTickStep } from './diagrams';
import { FIGURE, SACRINT, SACRINT_LIGHT, resolveLightAccent, SACRINT_RADIUS, SACRINT_STROKE, type SacrintThemeMode } from './tokens';
import { escapeXml, measureText, singleLine, textBlock, uppercaseLabel } from './text-layout';
import { styleBackdrop, type StyleBackdropKind } from './style-art';
import type { SacrintStyleId } from './visual-styles';

export interface FrameOptions {
  width: number;
  height: number;
  accent?: string;
  accent2?: string;
}

export function svgDocument(
  width: number,
  height: number,
  body: string,
  accent: string = SACRINT.gold,
  accent2: string = SACRINT.blue,
  styleId?: SacrintStyleId,
  styleKind: StyleBackdropKind = 'slide',
  theme: SacrintThemeMode = 'dark'
): string {
  const isLight = theme === 'light';
  const effAccent = isLight ? resolveLightAccent(accent) : accent;
  const effAccent2 = isLight ? resolveLightAccent(accent2) : accent2;
  const minorStroke = isLight ? SACRINT_LIGHT.grid : SACRINT.grid;
  const majorStroke = isLight ? SACRINT_LIGHT.gridStrong : SACRINT.gridStrong;
  const dotFill = isLight ? effAccent2 : SACRINT.blue;
  const backdrop = styleId ? styleBackdrop(styleId, styleKind, effAccent, effAccent2, width, height) : '';
  const styledBackdrop = backdrop && isLight ? `<g opacity="0.22">${backdrop}</g>` : backdrop;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs>
<linearGradient id="sacrint-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${isLight ? '#FFFFFF' : SACRINT.canvas}"/><stop offset="0.55" stop-color="${isLight ? SACRINT_LIGHT.canvas : SACRINT.canvasDeep}"/><stop offset="1" stop-color="${isLight ? SACRINT_LIGHT.canvasDeep : '#03060C'}"/></linearGradient>
<linearGradient id="sacrint-panel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${isLight ? '#FFFFFF' : '#0B1A2A'}" stop-opacity="${isLight ? '0.98' : '0.94'}"/><stop offset="1" stop-color="${isLight ? '#F8FAFC' : '#06101B'}" stop-opacity="${isLight ? '0.96' : '0.86'}"/></linearGradient>
<linearGradient id="sacrint-panel-soft" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${isLight ? '#F8FAFC' : '#0A1624'}" stop-opacity="0.92"/><stop offset="1" stop-color="${isLight ? '#F1F5F9' : '#050C15'}" stop-opacity="${isLight ? '0.92' : '0.72'}"/></linearGradient>
<linearGradient id="sacrint-accent" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${effAccent}"/><stop offset="1" stop-color="${effAccent2}"/></linearGradient>
<linearGradient id="sacrint-rule" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${effAccent}" stop-opacity="0.95"/><stop offset="0.4" stop-color="${effAccent}" stop-opacity="0.25"/><stop offset="1" stop-color="${effAccent2}" stop-opacity="0"/></linearGradient>
<radialGradient id="sacrint-glow-gold" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${effAccent}" stop-opacity="${isLight ? '0.09' : '0.32'}"/><stop offset="0.45" stop-color="${effAccent}" stop-opacity="0.04"/><stop offset="1" stop-color="${effAccent}" stop-opacity="0"/></radialGradient>
<radialGradient id="sacrint-glow-blue" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${effAccent2}" stop-opacity="${isLight ? '0.08' : '0.3'}"/><stop offset="0.5" stop-color="${effAccent2}" stop-opacity="0.04"/><stop offset="1" stop-color="${effAccent2}" stop-opacity="0"/></radialGradient>
<radialGradient id="sacrint-vignette" cx="0.5" cy="0.46" r="0.72"><stop offset="0.45" stop-color="#000000" stop-opacity="0"/><stop offset="1" stop-color="#000000" stop-opacity="${isLight ? '0' : '0.58'}"/></radialGradient>
<pattern id="sacrint-grid-minor" width="${FIGURE.gridMinor}" height="${FIGURE.gridMinor}" patternUnits="userSpaceOnUse"><path d="M ${FIGURE.gridMinor} 0 L 0 0 0 ${FIGURE.gridMinor}" fill="none" stroke="${minorStroke}" stroke-width="1"/></pattern>
<pattern id="sacrint-grid-major" width="${FIGURE.gridMajor}" height="${FIGURE.gridMajor}" patternUnits="userSpaceOnUse"><path d="M ${FIGURE.gridMajor} 0 L 0 0 0 ${FIGURE.gridMajor}" fill="none" stroke="${majorStroke}" stroke-width="1"/></pattern>
<pattern id="sacrint-dots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="1.4" cy="1.4" r="1.1" fill="${dotFill}" fill-opacity="0.18"/></pattern>
</defs>
<rect width="${width}" height="${height}" fill="url(#sacrint-bg)"/>
<rect width="${width}" height="${height}" fill="url(#sacrint-grid-minor)"/>
<rect width="${width}" height="${height}" fill="url(#sacrint-grid-major)"/>
${styledBackdrop}
${body}
${isLight ? '' : `<rect width="${width}" height="${height}" fill="url(#sacrint-vignette)"/>`}
</svg>`;
}

export function rect(x: number, y: number, width: number, height: number, attrs: string): string {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" ${attrs}/>`;
}

export function line(x1: number, y1: number, x2: number, y2: number, stroke: string, width = 1, extra = ''): string {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${width}" ${extra}/>`;
}

export function circle(cx: number, cy: number, r: number, fill: string, extra = ''): string {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" ${extra}/>`;
}

export function path(d: string, attrs: string): string {
  return `<path d="${d}" ${attrs}/>`;
}

export function panel(
  x: number,
  y: number,
  width: number,
  height: number,
  options: { fill?: string; stroke?: string; radius?: number; opacity?: number; strokeWidth?: number } = {}
): string {
  const radius = options.radius ?? SACRINT_RADIUS.md;
  const fill = options.fill ?? 'url(#sacrint-panel)';
  const stroke = options.stroke ?? SACRINT.stroke;
  const opacity = options.opacity ?? 1;
  const strokeWidth = options.strokeWidth ?? SACRINT_STROKE.thin;
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" opacity="${opacity}"/>`;
}

export function cornerMarks(x: number, y: number, width: number, height: number, color: string, size = 18, inset = 0): string {
  const left = x + inset;
  const top = y + inset;
  const right = x + width - inset;
  const bottom = y + height - inset;
  const s = size;
  return `<path d="M ${left} ${top + s} L ${left} ${top} L ${left + s} ${top}" fill="none" stroke="${color}" stroke-width="1.6"/>
<path d="M ${right - s} ${top} L ${right} ${top} L ${right} ${top + s}" fill="none" stroke="${color}" stroke-width="1.6"/>
<path d="M ${left} ${bottom - s} L ${left} ${bottom} L ${left + s} ${bottom}" fill="none" stroke="${color}" stroke-width="1.6"/>
<path d="M ${right - s} ${bottom} L ${right} ${bottom} L ${right} ${bottom - s}" fill="none" stroke="${color}" stroke-width="1.6"/>`;
}

export function chipWidth(label: string, fontSize = 13, letterSpacing = 1.4, paddingX = 14): number {
  return Math.ceil(measureText(uppercaseLabel(label), fontSize, 'body', 'semibold', letterSpacing) + paddingX * 2);
}

export function chip(
  x: number,
  y: number,
  label: string,
  color: string,
  options: { fontSize?: number; letterSpacing?: number; paddingX?: number; height?: number; fill?: string; width?: number } = {}
): string {
  const text = uppercaseLabel(label);
  const fontSize = options.fontSize ?? 13;
  const letterSpacing = options.letterSpacing ?? 1.4;
  const paddingX = options.paddingX ?? 14;
  const height = options.height ?? 32;
  const width = options.width ?? chipWidth(text, fontSize, letterSpacing, paddingX);
  return `<g><rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${height / 2}" fill="${options.fill ?? 'rgba(5,12,20,0.72)'}" stroke="${color}" stroke-opacity="0.72" stroke-width="1"/>
<circle cx="${x + paddingX - 4}" cy="${y + height / 2}" r="2.4" fill="${color}"/>
${singleLine(text, x + paddingX + 4, y + height / 2 + fontSize * 0.36, { fill: color, fontSize, weight: 'semibold', letterSpacing })}</g>`;
}

export function sectionLabel(
  x: number,
  y: number,
  width: number,
  label: string,
  color: string,
  index?: string,
  mutedColor: string = SACRINT.muted
): string {
  const text = uppercaseLabel(label);
  return `<g>${singleLine(text, x, y, { fill: color, fontSize: 13, weight: 'semibold', letterSpacing: 2.2 })}
${index ? singleLine(index, x + width, y, { fill: mutedColor, fontSize: 12, weight: 'medium', letterSpacing: 1.6, anchor: 'end' }) : ''}
${line(x, y + 13, x + width, y + 13, color, 1, 'stroke-opacity="0.32"')}</g>`;
}

export function rule(x: number, y: number, width: number, color: string, opacity = 0.8): string {
  return line(x, y, x + width, y, color, 1.5, `stroke-opacity="${opacity}"`);
}

export function divider(x: number, y: number, width: number, color: string = SACRINT.strokeSoft): string {
  return line(x, y, x + width, y, color, 1, 'stroke-opacity="0.6"');
}

export function dotGrid(x: number, y: number, width: number, height: number, opacity = 0.16): string {
  return rect(x, y, width, height, `fill="url(#sacrint-dots)" opacity="${opacity}"`);
}

export function progressRail(
  x: number,
  y: number,
  width: number,
  activeIndex: number,
  count: number,
  color: string,
  styleId: SacrintStyleId = 'general'
): string {
  const gap = 8;
  const step = (width - gap * (count - 1)) / count;
  const parts: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const active = index === activeIndex;
    const start = x + index * (step + gap);
    if (styleId === 'naturales') {
      parts.push(circle(start + step / 2, y + 2, active ? 4.4 : 2.8, active ? color : SACRINT.strokeSoft, `fill-opacity="${active ? 1 : 0.6}"`));
      continue;
    }
    if (styleId === 'humanidades') {
      parts.push(rect(start, y + 1, step, active ? 2 : 1, `fill="${active ? color : SACRINT.strokeSoft}" fill-opacity="${active ? 1 : 0.5}"`));
      if (active) {
        parts.push(`<rect x="${start + step / 2 - 4}" y="${y - 2}" width="8" height="8" transform="rotate(45 ${start + step / 2} ${y + 2})" fill="${color}"/>`);
      }
      continue;
    }
    if (styleId === 'socioemocional') {
      parts.push(rect(start, y, step, active ? 6 : 3, `rx="3" fill="${active ? color : SACRINT.strokeSoft}" fill-opacity="${active ? 1 : 0.5}"`));
      continue;
    }
    if (styleId === 'tecnica') {
      const skew = 5;
      const height = active ? 7 : 4;
      parts.push(
        `<polygon points="${start + skew},${y} ${start + step},${y} ${start + step - skew},${y + height} ${start},${y + height}" fill="${active ? color : SACRINT.strokeSoft}" fill-opacity="${active ? 1 : 0.5}"/>`
      );
      continue;
    }
    parts.push(rect(start, y, step, active ? 4 : 2, `rx="2" fill="${active ? color : SACRINT.strokeSoft}" fill-opacity="${active ? 1 : 0.55}"`));
  }
  return parts.join('');
}

export function topHud(
  width: number,
  label: string,
  code: string,
  accent: string,
  theme: SacrintThemeMode = 'dark'
): string {
  const isLight = theme === 'light';
  const pal = isLight ? SACRINT_LIGHT : SACRINT;
  const effAccent = isLight ? resolveLightAccent(accent) : accent;
  return `<g>${chip(80, 48, label, effAccent, { fontSize: 12, fill: isLight ? '#FFFFFF' : undefined })}
${singleLine(uppercaseLabel(code), width - 80, 70, { fill: pal.muted, fontSize: 12, weight: 'semibold', letterSpacing: 2, anchor: 'end' })}
${line(80, 96, width - 80, 96, pal.strokeSoft, 1, isLight ? 'stroke-opacity="0.9"' : 'stroke-opacity="0.55"')}</g>`;
}

export function footer(
  width: number,
  height: number,
  left: string,
  right: string,
  accent: string,
  theme: SacrintThemeMode = 'dark'
): string {
  const isLight = theme === 'light';
  const pal = isLight ? SACRINT_LIGHT : SACRINT;
  const effAccent = isLight ? resolveLightAccent(accent) : accent;
  return `<g>${line(80, height - 54, width - 80, height - 54, pal.strokeSoft, 1, isLight ? 'stroke-opacity="0.9"' : 'stroke-opacity="0.5"')}
${singleLine(left, 80, height - 26, { fill: pal.muted, fontSize: 12, weight: 'medium', letterSpacing: 1.4 })}
${singleLine(uppercaseLabel(right), width - 80, height - 26, { fill: effAccent, fontSize: 12, weight: 'semibold', letterSpacing: 1.4, anchor: 'end' })}</g>`;
}

export function metricTile(
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  value: string,
  detail: string,
  accent: string,
  index: number
): string {
  return `<g>${panel(x, y, width, height, { fill: 'url(#sacrint-panel-soft)' })}
${rect(x, y, 3, height, `rx="1.5" fill="${accent}"`)}
${singleLine(String(index).padStart(2, '0'), x + 20, y + 28, { fill: accent, fontSize: 12, weight: 'semibold', letterSpacing: 1.8 })}
${singleLine(uppercaseLabel(label), x + 20, y + 56, { fill: SACRINT.muted, fontSize: 11, weight: 'semibold', letterSpacing: 1.5 })}
${singleLine(value, x + 20, y + 96, { fill: SACRINT.white, fontSize: 38, family: 'display', weight: 'bold' })}
${line(x + 20, y + 112, x + width - 20, y + 112, accent, 1, 'stroke-opacity="0.35"')}
${singleLine(detail, x + 20, y + 136, { fill: SACRINT.textSoft, fontSize: 13, weight: 'regular' })}</g>`;
}

export function bullet(x: number, y: number, width: number, index: number, text: string, accent: string, fontSize = 17): string {
  const marker = String(index).padStart(2, '0');
  return `<g>${singleLine(marker, x, y, { fill: accent, fontSize: 12, weight: 'semibold', letterSpacing: 1.2 })}
${singleLine(text, x + 34, y, { fill: SACRINT.text, fontSize, weight: 'regular' })}</g>`;
}

export function toneColor(tone: 'gold' | 'blue' | 'emerald' | 'red' | 'amber'): string {
  switch (tone) {
    case 'blue':
      return SACRINT.blue;
    case 'emerald':
      return SACRINT.emerald;
    case 'red':
      return SACRINT.red;
    case 'amber':
      return SACRINT.amber;
    default:
      return SACRINT.gold;
  }
}

interface DiagramRenderOptions {
  accent?: string;
  accent2?: string;
  compact?: boolean;
  showTriangle?: boolean;
  theme?: SacrintThemeMode;
}

function themeColors(theme: SacrintThemeMode = 'dark') {
  return theme === 'light'
    ? {
        pal: SACRINT_LIGHT,
        plotFill: '#FFFFFF',
        plotOpacity: '0.96',
        labelBg: '#FFFFFF',
        dotStroke: '#FFFFFF',
        cardBg: '#FFFFFF',
      }
    : {
        pal: SACRINT,
        plotFill: '#050C15',
        plotOpacity: '0.7',
        labelBg: '#050C15',
        dotStroke: '#050C15',
        cardBg: 'rgba(4,10,18,0.62)',
      };
}

function adaptSchematicForLight(svg: string, accent: string, accent2: string): string {
  return svg
    .replaceAll(SACRINT.textSoft, SACRINT_LIGHT.textSoft)
    .replaceAll(SACRINT.muted, SACRINT_LIGHT.muted)
    .replaceAll(SACRINT.strokeSoft, SACRINT_LIGHT.stroke)
    .replaceAll('rgba(4,10,18,0.62)', '#FFFFFF')
    .replaceAll('rgba(5,14,22,0.72)', '#F8FAFC')
    .replaceAll('rgba(5,12,20,0.8)', '#FFFFFF')
    .replaceAll('rgba(5,12,20,0.35)', '#F8FAFC')
    .replaceAll('fill="#050C15"', 'fill="#FFFFFF"')
    .replaceAll('stroke="#050C15"', 'stroke="#FFFFFF"')
    .replaceAll(accent, resolveLightAccent(accent))
    .replaceAll(accent2, resolveLightAccent(accent2));
}

function diagramColors(options: DiagramRenderOptions): { accent: string; accent2: string } {
  return {
    accent: options.accent ?? SACRINT.gold,
    accent2: options.accent2 ?? SACRINT.blue,
  };
}

function arrowHead(x1: number, y1: number, x2: number, y2: number, color: string, size = 8): string {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const baseX = x2 - Math.cos(angle) * size;
  const baseY = y2 - Math.sin(angle) * size;
  const wingX = Math.cos(angle + Math.PI / 2) * size * 0.52;
  const wingY = Math.sin(angle + Math.PI / 2) * size * 0.52;
  return `<polygon points="${x2},${y2} ${baseX + wingX},${baseY + wingY} ${baseX - wingX},${baseY - wingY}" fill="${color}"/>`;
}

function diagramConnector(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  options: { width?: number; dash?: string; head?: boolean } = {}
): string {
  const width = options.width ?? 1.2;
  const dash = options.dash ? ` stroke-dasharray="${options.dash}"` : '';
  const body = line(x1, y1, x2, y2, color, width, `stroke-opacity="0.8"${dash}`);
  return options.head === false ? body : `${body}${arrowHead(x1, y1, x2, y2, color, 8)}`;
}

function nodeCard(
  node: SacrintDiagramNode,
  x: number,
  y: number,
  width: number,
  height: number,
  options: { accent: string; accent2: string; compact?: boolean; border?: string; fill?: string; maxLines?: number }
): string {
  const compact = options.compact ?? false;
  const labelSize = compact ? 8 : 9;
  const labelY = y + (compact ? 18 : 24);
  const detailY = y + (compact ? 34 : 44);
  const maxLines = options.maxLines ?? (height >= 100 ? 3 : 2);
  const detail = textBlock(node.detail, width - 24, {
    x: x + 12,
    y: detailY,
    fill: SACRINT.textSoft,
    maxFontSize: compact ? 9 : 11,
    minFontSize: 7,
    maxLines,
    lineHeightRatio: 1.26,
    truncate: true,
  });
  return `<g>${panel(x, y, width, height, {
    fill: options.fill ?? 'rgba(4,10,18,0.62)',
    radius: compact ? 8 : 10,
    stroke: options.border ?? SACRINT.strokeSoft,
  })}
${singleLine(uppercaseLabel(node.label), x + 12, labelY, {
    fill: options.accent2,
    fontSize: labelSize,
    weight: 'semibold',
    letterSpacing: 1.2,
  })}
${detail.svg}</g>`;
}

function speciesCard(
  node: SacrintDiagramNode,
  x: number,
  y: number,
  width: number,
  height: number,
  accent: string,
  compact: boolean
): string {
  const formula = textBlock(node.label, width - 20, {
    x: x + 10,
    y: y + (compact ? 30 : 42),
    fill: accent,
    family: 'display',
    weight: 'bold',
    maxFontSize: compact ? 16 : 22,
    minFontSize: 9,
    maxLines: 1,
    lineHeightRatio: 1.1,
    truncate: true,
  });
  return `<g>${panel(x, y, width, height, { fill: 'rgba(5,14,22,0.72)', radius: compact ? 8 : 10, stroke: accent, strokeWidth: 1 })}
${formula.svg}
${singleLine(uppercaseLabel(node.detail), x + 10, y + height - 10, {
    fill: SACRINT.muted,
    fontSize: compact ? 7 : 8,
    weight: 'semibold',
    letterSpacing: 1.1,
  })}</g>`;
}

function unavailableBadge(x: number, y: number): string {
  return singleLine('POR CONSTRUIR', x, y, {
    fill: SACRINT.amber,
    fontSize: 9,
    weight: 'semibold',
    letterSpacing: 1.8,
    anchor: 'middle',
  });
}

export function reactionScheme(
  diagram: ReactionDiagramSpec,
  x: number,
  y: number,
  width: number,
  height: number,
  options: DiagramRenderOptions = {}
): string {
  const compact = options.compact ?? height < 460;
  const { accent, accent2 } = diagramColors(options);
  const pad = compact ? 12 : 18;
  const gap = compact ? 8 : 12;
  const cardW = Math.min(compact ? 190 : 260, width * 0.29);
  const cardH = compact ? 62 : 94;
  const leftX = x + pad;
  const rightX = x + width - pad - cardW;
  const arrowStart = leftX + cardW + 18;
  const arrowEnd = rightX - 18;
  const arrowY = y + height * 0.47;
  const parts: string[] = [];

  parts.push(circle(x + width * 0.5, y + height * 0.5, Math.min(width, height) * 0.3, 'none', `stroke="${accent2}" stroke-opacity="0.08" stroke-width="18"`));
  parts.push(circle(x + width * 0.5, y + height * 0.5, Math.min(width, height) * 0.2, 'none', `stroke="${accent}" stroke-opacity="0.12" stroke-width="1" stroke-dasharray="4 8"`));

  const stack = (nodes: SacrintDiagramNode[], startX: number, side: 'reactant' | 'product') => {
    const total = nodes.length * cardH + Math.max(0, nodes.length - 1) * gap;
    const startY = y + (height - total) / 2;
    return nodes
      .map((node, index) => speciesCard(node, startX, startY + index * (cardH + gap), cardW, cardH, side === 'reactant' ? accent : accent2, compact))
      .join('');
  };

  parts.push(stack(diagram.reactants.slice(0, 2), leftX, 'reactant'));
  parts.push(stack(diagram.products.slice(0, 2), rightX, 'product'));

  const conditionW = Math.max(80, arrowEnd - arrowStart - 16);
  const condition = textBlock(diagram.condition, conditionW, {
    x: arrowStart + 8,
    y: arrowY - 34,
    fill: SACRINT.textSoft,
    maxFontSize: compact ? 9 : 12,
    minFontSize: 7,
    maxLines: 2,
    lineHeightRatio: 1.25,
    truncate: true,
    anchor: 'middle',
  });
  parts.push(condition.svg);
  parts.push(diagramConnector(arrowStart, arrowY, arrowEnd, arrowY, diagram.available ? accent : SACRINT.muted, {
    width: compact ? 1.4 : 2,
    dash: diagram.available ? undefined : '6 6',
  }));
  parts.push(singleLine(diagram.available ? 'TRANSFORMACIÓN' : 'RELACIÓN POR CONSTRUIR', (arrowStart + arrowEnd) / 2, arrowY + 24, {
    fill: diagram.available ? accent2 : SACRINT.muted,
    fontSize: compact ? 7 : 8,
    weight: 'semibold',
    letterSpacing: 1.4,
    anchor: 'middle',
  }));

  if (!diagram.available) parts.push(unavailableBadge(x + width / 2, y + 16));
  if (height > 250) {
    const note = textBlock(diagram.note, width - pad * 2, {
      x: x + pad,
      y: y + height - (compact ? 28 : 34),
      fill: SACRINT.muted,
      maxFontSize: compact ? 8 : 9,
      minFontSize: 7,
      maxLines: 2,
      lineHeightRatio: 1.2,
      truncate: true,
      anchor: 'middle',
    });
    parts.push(note.svg);
  }

  return parts.join('');
}

export function argumentMap(
  diagram: ArgumentDiagramSpec,
  x: number,
  y: number,
  width: number,
  height: number,
  options: DiagramRenderOptions = {}
): string {
  const compact = options.compact ?? height < 470;
  const { accent, accent2 } = diagramColors(options);
  const pad = compact ? 12 : 18;
  const gap = compact ? 10 : 18;
  const thesisH = compact ? 54 : 76;
  const premiseH = compact ? 66 : 92;
  const bottomH = compact ? 64 : 90;
  const thesisW = width * 0.64;
  const thesisX = x + (width - thesisW) / 2;
  const contentH = thesisH + premiseH + bottomH + gap * 2;
  const thesisY = y + Math.max(pad, (height - contentH) / 2);
  const premiseW = (width - pad * 2 - gap) / 2;
  const premiseY = thesisY + thesisH + gap;
  const bottomY = premiseY + premiseH + gap;
  const bottomW = (width - pad * 2 - gap) / 2;
  const leftPremiseX = x + pad;
  const rightPremiseX = leftPremiseX + premiseW + gap;
  const objectionX = x + pad;
  const conclusionX = objectionX + bottomW + gap;
  const parts: string[] = [];

  parts.push(circle(x + width * 0.5, y + height * 0.46, Math.min(width, height) * 0.3, 'none', `stroke="${accent}" stroke-opacity="0.1" stroke-width="1" stroke-dasharray="3 8"`));

  parts.push(nodeCard(diagram.thesis, thesisX, thesisY, thesisW, thesisH, {
    accent,
    accent2,
    compact,
    border: accent,
    maxLines: 2,
  }));
  parts.push(nodeCard(diagram.premises[0] ?? { label: 'PREMISA 1', detail: 'Sin registro.' }, leftPremiseX, premiseY, premiseW, premiseH, {
    accent,
    accent2,
    compact,
    maxLines: 2,
  }));
  parts.push(nodeCard(diagram.premises[1] ?? { label: 'PREMISA 2', detail: 'Sin registro.' }, rightPremiseX, premiseY, premiseW, premiseH, {
    accent,
    accent2,
    compact,
    maxLines: 2,
  }));
  parts.push(nodeCard(diagram.objection, objectionX, bottomY, bottomW, bottomH, {
    accent,
    accent2,
    compact,
    border: 'rgba(255,49,49,0.58)',
    maxLines: 2,
  }));
  parts.push(nodeCard(diagram.conclusion, conclusionX, bottomY, bottomW, bottomH, {
    accent,
    accent2,
    compact,
    border: accent,
    maxLines: 2,
  }));

  const thesisBottom = thesisY + thesisH;
  parts.push(diagramConnector(thesisX + thesisW * 0.32, thesisBottom, leftPremiseX + premiseW / 2, premiseY, accent2, { width: 1 }));
  parts.push(diagramConnector(thesisX + thesisW * 0.68, thesisBottom, rightPremiseX + premiseW / 2, premiseY, accent2, { width: 1 }));
  parts.push(diagramConnector(leftPremiseX + premiseW / 2, premiseY + premiseH, objectionX + bottomW / 2, bottomY, SACRINT.red, { width: 1, dash: '4 4' }));
  parts.push(diagramConnector(rightPremiseX + premiseW / 2, premiseY + premiseH, conclusionX + bottomW / 2, bottomY, accent, { width: 1 }));

  if (!diagram.available) parts.push(unavailableBadge(x + width - 48, y + 14));
  return parts.join('');
}

export function languageMap(
  diagram: LanguageDiagramSpec,
  x: number,
  y: number,
  width: number,
  height: number,
  options: DiagramRenderOptions = {}
): string {
  const compact = options.compact ?? height < 460;
  const { accent, accent2 } = diagramColors(options);
  const pad = compact ? 12 : 18;
  const gap = compact ? 14 : 24;
  const cardW = (width - pad * 2 - gap * 2) / 3;
  const cardH = compact ? 94 : 148;
  const contextH = compact ? 66 : 96;
  const contentH = cardH + contextH + gap;
  const topY = y + Math.max(pad, (height - contentH) / 2);
  const contextY = topY + cardH + gap;
  const inputX = x + pad;
  const ruleX = inputX + cardW + gap;
  const outputX = ruleX + cardW + gap;
  const parts: string[] = [];

  parts.push(circle(x + width * 0.5, y + height * 0.42, Math.min(width, height) * 0.3, 'none', `stroke="${accent2}" stroke-opacity="0.09" stroke-width="16"`));
  parts.push(nodeCard(diagram.input, inputX, topY, cardW, cardH, { accent, accent2, compact, border: accent2, maxLines: 3 }));
  parts.push(nodeCard(diagram.rule, ruleX, topY, cardW, cardH, { accent, accent2, compact, border: accent, maxLines: 3 }));
  parts.push(nodeCard(diagram.output, outputX, topY, cardW, cardH, { accent, accent2, compact, border: accent2, maxLines: 3 }));
  parts.push(nodeCard(diagram.context, x + pad, contextY, width - pad * 2, contextH, { accent, accent2, compact, maxLines: 2 }));

  const arrowY = topY + cardH / 2;
  parts.push(diagramConnector(inputX + cardW, arrowY, ruleX - 2, arrowY, accent, { width: 1.2 }));
  parts.push(diagramConnector(ruleX + cardW, arrowY, outputX - 2, arrowY, accent2, { width: 1.2 }));
  parts.push(diagramConnector(x + width / 2, topY + cardH + 2, x + width / 2, contextY - 6, accent, { width: 1, dash: '4 4' }));

  if (!diagram.available) parts.push(unavailableBadge(x + width - 48, y + 14));
  return parts.join('');
}

export function conceptMap(
  diagram: ConceptDiagramSpec,
  x: number,
  y: number,
  width: number,
  height: number,
  options: DiagramRenderOptions = {}
): string {
  const compact = options.compact ?? height < 470;
  const { accent, accent2 } = diagramColors(options);
  const pad = compact ? 12 : 18;
  const nodeW = width * 0.32;
  const nodeH = compact ? 66 : 98;
  const centerW = width * 0.3;
  const centerH = compact ? 70 : 104;
  const centerX = x + (width - centerW) / 2;
  const centerY = y + (height - centerH) / 2;
  const positions = [
    { x: x + pad, y: y + pad },
    { x: x + width - pad - nodeW, y: y + pad },
    { x: x + pad, y: y + height - pad - nodeH },
    { x: x + width - pad - nodeW, y: y + height - pad - nodeH },
  ];
  const parts: string[] = [];

  parts.push(circle(x + width / 2, y + height / 2, Math.min(width, height) * 0.32, 'none', `stroke="${accent}" stroke-opacity="0.14" stroke-width="1" stroke-dasharray="3 8"`));
  const midX = centerX + centerW / 2;
  const midY = centerY + centerH / 2;
  for (const position of positions) {
    const targetX = position.x + nodeW / 2;
    const targetY = position.y + nodeH / 2;
    parts.push(`<path d="M ${midX} ${midY} L ${targetX} ${midY} L ${targetX} ${targetY}" fill="none" stroke="${accent2}" stroke-opacity="0.72" stroke-width="1.2" stroke-dasharray="4 4"/>`);
    parts.push(circle(targetX, targetY, 3.2, accent2));
  }

  parts.push(nodeCard(diagram.center, centerX, centerY, centerW, centerH, {
    accent,
    accent2,
    compact,
    border: accent,
    fill: 'rgba(8,18,30,0.92)',
    maxLines: 2,
  }));
  diagram.nodes.slice(0, 4).forEach((node, index) => {
    const position = positions[index];
    if (!position) return;
    parts.push(nodeCard(node, position.x, position.y, nodeW, nodeH, {
      accent,
      accent2,
      compact,
      border: index % 2 === 0 ? accent2 : SACRINT.strokeSoft,
      maxLines: 2,
    }));
  });

  if (!diagram.available) parts.push(unavailableBadge(x + width - 48, y + 14));
  return parts.join('');
}

export function timelineDiagram(
  diagram: TimelineDiagramSpec,
  x: number,
  y: number,
  width: number,
  height: number,
  options: DiagramRenderOptions = {}
): string {
  const compact = options.compact ?? height < 400;
  const { accent, accent2 } = diagramColors(options);
  const pad = compact ? 12 : 18;
  const events = diagram.events.slice(0, 4);
  const count = Math.max(1, events.length);
  const railY = y + height * 0.52;
  const slot = (width - pad * 2) / count;
  const cardW = Math.min(compact ? 200 : 244, slot - 14);
  const cardH = compact ? 84 : 108;
  const stemGap = compact ? 16 : 24;
  const parts: string[] = [];

  parts.push(circle(x + width * 0.5, y + height * 0.5, Math.min(width, height) * 0.3, 'none', `stroke="${accent}" stroke-opacity="0.08" stroke-width="16"`));
  parts.push(line(x + pad, railY, x + width - pad, railY, accent, compact ? 1.4 : 1.8, 'stroke-opacity="0.85"'));

  events.forEach((event, index) => {
    const cx = x + pad + slot * (index + 0.5);
    const above = index % 2 === 0;
    const cardY = above ? railY - stemGap - cardH : railY + stemGap;
    const cardX = Math.max(x + pad, Math.min(cx - cardW / 2, x + width - pad - cardW));
    parts.push(line(cx, railY, cx, above ? cardY + cardH : cardY, above ? accent : accent2, 1, 'stroke-opacity="0.55"'));
    parts.push(circle(cx, railY, compact ? 5 : 6.5, above ? accent : accent2, 'stroke="#050C15" stroke-width="2"'));
    parts.push(nodeCard(event, cardX, cardY, cardW, cardH, { accent, accent2, compact, maxLines: 2 }));
    if (index < events.length - 1) {
      const nextCx = x + pad + slot * (index + 1.5);
      parts.push(diagramConnector(cx + 10, railY, nextCx - 12, railY, accent2, { width: 1 }));
    }
  });

  const spanW = Math.min(width * 0.52, 320);
  parts.push(rect(x + width / 2 - spanW / 2, y + pad, spanW, compact ? 26 : 32, `rx="13" fill="#050C15" fill-opacity="0.82" stroke="${accent}" stroke-opacity="0.5" stroke-width="1"`));
  parts.push(singleLine(uppercaseLabel(diagram.span), x + width / 2, y + pad + (compact ? 18 : 22), {
    fill: accent,
    fontSize: compact ? 9 : 10,
    weight: 'semibold',
    letterSpacing: 1.6,
    anchor: 'middle',
  }));

  if (!diagram.available) parts.push(unavailableBadge(x + width - 48, y + 14));
  return parts.join('');
}

export function systemMapDiagram(
  diagram: SystemMapDiagramSpec,
  x: number,
  y: number,
  width: number,
  height: number,
  options: DiagramRenderOptions = {}
): string {
  const compact = options.compact ?? height < 400;
  const { accent, accent2 } = diagramColors(options);
  const pad = compact ? 12 : 18;
  const gap = compact ? 8 : 12;
  const centerW = Math.min(width * 0.55, compact ? 380 : 460);
  const centerH = compact ? 64 : 90;
  const centerX = x + (width - centerW) / 2;
  const centerY = y + pad;
  const compW = (width - pad * 2 - gap * 3) / 4;
  const compH = compact ? 88 : 118;
  const compY = centerY + centerH + (compact ? 18 : 24);
  const envH = compact ? 52 : 66;
  const envY = y + height - pad - envH;
  const parts: string[] = [];

  parts.push(circle(x + width / 2, centerY + centerH / 2, Math.min(width, height) * 0.26, 'none', `stroke="${accent2}" stroke-opacity="0.09" stroke-width="14"`));

  diagram.components.slice(0, 4).forEach((component, index) => {
    const compX = x + pad + index * (compW + gap);
    parts.push(diagramConnector(centerX + centerW / 2, centerY + centerH, compX + compW / 2, compY, accent2, { width: 1, dash: '4 4', head: false }));
    parts.push(nodeCard(component, compX, compY, compW, compH, { accent, accent2, compact, maxLines: 3 }));
  });

  parts.push(nodeCard(diagram.center, centerX, centerY, centerW, centerH, {
    accent,
    accent2,
    compact,
    border: accent,
    fill: 'rgba(8,18,30,0.9)',
    maxLines: 2,
  }));
  parts.push(diagramConnector(x + width / 2, compY + compH, x + width / 2, envY - 4, accent, { width: 1.2 }));
  parts.push(nodeCard(diagram.environment, x + pad, envY, width - pad * 2, envH, { accent, accent2, compact, maxLines: 2 }));

  if (!diagram.available) parts.push(unavailableBadge(x + width - 48, y + 14));
  return parts.join('');
}

export function clinicalFlowDiagram(
  diagram: ClinicalFlowDiagramSpec,
  x: number,
  y: number,
  width: number,
  height: number,
  options: DiagramRenderOptions = {}
): string {
  const compact = options.compact ?? height < 400;
  const { accent, accent2 } = diagramColors(options);
  const pad = compact ? 12 : 16;
  const gap = compact ? 8 : 12;
  const stages = diagram.stages.slice(0, 4);
  const count = Math.max(1, stages.length);
  const cardW = (width - pad * 2 - gap * (count - 1)) / count;
  const noteH = height > 240 ? (compact ? 34 : 40) : 0;
  const cardH = height - pad * 2 - noteH - (noteH ? 14 : 0);
  const cardY = y + pad;
  const parts: string[] = [];

  parts.push(rect(x + pad, cardY, width - pad * 2, cardH, `fill="#050C15" fill-opacity="0.35" rx="12"`));

  stages.forEach((stage, index) => {
    const cardX = x + pad + index * (cardW + gap);
    const stageColor = index % 2 === 0 ? accent : accent2;
    parts.push(nodeCard(stage, cardX, cardY + 10, cardW, cardH - 20, { accent, accent2, compact, border: stageColor, maxLines: compact ? 3 : 4 }));
    if (index < stages.length - 1) {
      parts.push(diagramConnector(cardX + cardW + 1, cardY + cardH / 2, cardX + cardW + gap - 2, cardY + cardH / 2, accent, { width: 1.4 }));
    }
  });

  if (noteH > 0) {
    const note = textBlock(diagram.note, width - pad * 2, {
      x: x + pad,
      y: y + height - pad - noteH + 12,
      fill: SACRINT.muted,
      maxFontSize: compact ? 8 : 9,
      minFontSize: 7,
      maxLines: 2,
      lineHeightRatio: 1.2,
      truncate: true,
      anchor: 'middle',
    });
    parts.push(note.svg);
  }

  if (!diagram.available) parts.push(unavailableBadge(x + width - 48, y + 14));
  return parts.join('');
}

export function blockDiagram(
  diagram: BlockDiagramSpec,
  x: number,
  y: number,
  width: number,
  height: number,
  options: DiagramRenderOptions = {}
): string {
  const compact = options.compact ?? height < 400;
  const { accent, accent2 } = diagramColors(options);
  const pad = compact ? 12 : 18;
  const gap = compact ? 12 : 18;
  const cardW = (width - pad * 2 - gap * 2) / 3;
  const feedbackH = compact ? 56 : 72;
  const loopGap = compact ? 20 : 30;
  const cardH = height - pad * 2 - feedbackH - loopGap;
  const topY = y + pad;
  const feedbackW = Math.min(width * 0.52, cardW * 1.6);
  const feedbackX = x + (width - feedbackW) / 2;
  const feedbackY = topY + cardH + loopGap;
  const inputX = x + pad;
  const processX = inputX + cardW + gap;
  const outputX = processX + cardW + gap;
  const arrowY = topY + cardH / 2;
  const parts: string[] = [];

  parts.push(circle(x + width / 2, topY + cardH / 2, Math.min(width, height) * 0.28, 'none', `stroke="${accent2}" stroke-opacity="0.08" stroke-width="14"`));

  parts.push(nodeCard(diagram.input, inputX, topY, cardW, cardH, { accent, accent2, compact, border: accent2, maxLines: 3 }));
  parts.push(nodeCard(diagram.process, processX, topY, cardW, cardH, { accent, accent2, compact, border: accent, maxLines: 3 }));
  parts.push(nodeCard(diagram.output, outputX, topY, cardW, cardH, { accent, accent2, compact, border: accent2, maxLines: 3 }));
  parts.push(diagramConnector(inputX + cardW, arrowY, processX - 2, arrowY, accent, { width: 1.3 }));
  parts.push(diagramConnector(processX + cardW, arrowY, outputX - 2, arrowY, accent2, { width: 1.3 }));

  parts.push(nodeCard(diagram.feedback, feedbackX, feedbackY, feedbackW, feedbackH, { accent, accent2, compact, maxLines: 2 }));
  parts.push(diagramConnector(outputX + cardW / 2, topY + cardH + 4, feedbackX + feedbackW - 20, feedbackY + feedbackH / 2, accent2, { width: 1, dash: '4 4' }));
  parts.push(diagramConnector(feedbackX + 20, feedbackY + feedbackH / 2, inputX + cardW / 2, topY + cardH + 4, accent, { width: 1, dash: '4 4' }));

  if (!diagram.available) parts.push(unavailableBadge(x + width - 48, y + 14));
  return parts.join('');
}

export function sopFlowDiagram(
  diagram: SopFlowDiagramSpec,
  x: number,
  y: number,
  width: number,
  height: number,
  options: DiagramRenderOptions = {}
): string {
  const compact = options.compact ?? height < 400;
  const { accent, accent2 } = diagramColors(options);
  const pad = compact ? 12 : 16;
  const gap = compact ? 8 : 12;
  const steps = diagram.steps.slice(0, 4);
  const count = Math.max(1, steps.length);
  const standardH = compact ? 46 : 58;
  const cardW = (width - pad * 2 - gap * (count - 1)) / count;
  const cardH = height - pad * 2 - standardH - 16;
  const cardY = y + pad;
  const standardY = y + height - pad - standardH;
  const parts: string[] = [];

  steps.forEach((step, index) => {
    const cardX = x + pad + index * (cardW + gap);
    const stepColor = index % 2 === 0 ? accent : accent2;
    parts.push(nodeCard(step, cardX, cardY + 8, cardW, cardH - 8, { accent, accent2, compact, border: stepColor, maxLines: compact ? 3 : 4 }));
    parts.push(circle(cardX + 18, cardY + 8, compact ? 11 : 13, stepColor, 'stroke="#050C15" stroke-width="2"'));
    parts.push(singleLine(String(index + 1).padStart(2, '0'), cardX + 18, cardY + (compact ? 12 : 14), {
      fill: '#050C15',
      fontSize: compact ? 9 : 11,
      family: 'display',
      weight: 'bold',
      anchor: 'middle',
    }));
    if (index < steps.length - 1) {
      parts.push(diagramConnector(cardX + cardW + 1, cardY + cardH / 2, cardX + cardW + gap - 2, cardY + cardH / 2, accent, { width: 1.4 }));
    }
  });

  parts.push(panel(x + pad, standardY, width - pad * 2, standardH, { fill: 'rgba(5,12,20,0.8)', radius: 10, stroke: accent, strokeWidth: 1 }));
  parts.push(singleLine(uppercaseLabel(diagram.standard), x + width / 2, standardY + standardH / 2 + (compact ? 3 : 4), {
    fill: SACRINT.textSoft,
    fontSize: compact ? 9 : 10,
    weight: 'semibold',
    letterSpacing: 1,
    anchor: 'middle',
  }));

  if (!diagram.available) parts.push(unavailableBadge(x + width - 48, y + 14));
  return parts.join('');
}

export function creativeCycleDiagram(
  diagram: CreativeCycleDiagramSpec,
  x: number,
  y: number,
  width: number,
  height: number,
  options: DiagramRenderOptions = {}
): string {
  const compact = options.compact ?? height < 400;
  const { accent, accent2 } = diagramColors(options);
  const pad = compact ? 12 : 16;
  const gap = compact ? 8 : 12;
  const phases = diagram.phases.slice(0, 4);
  const count = Math.max(1, phases.length);
  const stripH = compact ? 44 : 56;
  const cardW = (width - pad * 2 - gap * (count - 1)) / count;
  const cardH = height - pad * 2 - stripH - 16;
  const cardY = y + pad;
  const stripY = y + height - pad - stripH;
  const parts: string[] = [];

  phases.forEach((phase, index) => {
    const cardX = x + pad + index * (cardW + gap);
    const phaseColor = index % 2 === 0 ? accent : accent2;
    parts.push(nodeCard(phase, cardX, cardY + 8, cardW, cardH - 8, { accent, accent2, compact, border: phaseColor, maxLines: compact ? 3 : 4 }));
    parts.push(circle(cardX + cardW - 16, cardY + 8, compact ? 10 : 12, phaseColor, 'stroke="#050C15" stroke-width="2"'));
    parts.push(singleLine(String(index + 1).padStart(2, '0'), cardX + cardW - 16, cardY + (compact ? 11 : 13), {
      fill: '#050C15',
      fontSize: compact ? 8 : 10,
      family: 'display',
      weight: 'bold',
      anchor: 'middle',
    }));
    if (index < phases.length - 1) {
      parts.push(diagramConnector(cardX + cardW + 1, cardY + cardH / 2, cardX + cardW + gap - 2, cardY + cardH / 2, accent, { width: 1.4 }));
    }
  });

  parts.push(panel(x + pad, stripY, width - pad * 2, stripH, { fill: 'rgba(5,12,20,0.8)', radius: 10, stroke: accent, strokeWidth: 1 }));
  parts.push(singleLine(uppercaseLabel(diagram.statement), x + width / 2, stripY + stripH / 2 + (compact ? 3 : 4), {
    fill: SACRINT.textSoft,
    fontSize: compact ? 8 : 9,
    weight: 'semibold',
    letterSpacing: 1,
    anchor: 'middle',
  }));

  if (!diagram.available) parts.push(unavailableBadge(x + width - 48, y + 14));
  return parts.join('');
}

export function trainingCycleDiagram(
  diagram: TrainingCycleDiagramSpec,
  x: number,
  y: number,
  width: number,
  height: number,
  options: DiagramRenderOptions = {}
): string {
  const compact = options.compact ?? height < 400;
  const { accent, accent2 } = diagramColors(options);
  const pad = compact ? 12 : 16;
  const gap = compact ? 8 : 12;
  const phases = diagram.phases.slice(0, 4);
  const count = Math.max(1, phases.length);
  const stripH = compact ? 42 : 52;
  const returnGap = compact ? 16 : 22;
  const cardW = (width - pad * 2 - gap * (count - 1)) / count;
  const cardH = height - pad * 2 - stripH - returnGap - 12;
  const cardY = y + pad;
  const returnY = cardY + cardH + returnGap / 2;
  const stripY = y + height - pad - stripH;
  const parts: string[] = [];

  parts.push(panel(x + pad, cardY, width - pad * 2, cardH + 8, { fill: 'rgba(5,12,20,0.35)', radius: 12, stroke: SACRINT.strokeSoft }));

  phases.forEach((phase, index) => {
    const cardX = x + pad + index * (cardW + gap);
    const phaseColor = index % 2 === 0 ? accent : accent2;
    const intensity = 0.32 + index * 0.16;
    parts.push(rect(cardX + 10, cardY + cardH - 6, cardW - 20, 4, `fill="${phaseColor}" fill-opacity="${intensity.toFixed(2)}" rx="2"`));
    parts.push(nodeCard(phase, cardX, cardY + 10, cardW, cardH - 18, { accent, accent2, compact, border: phaseColor, maxLines: compact ? 3 : 4 }));
    if (index < phases.length - 1) {
      parts.push(diagramConnector(cardX + cardW + 1, cardY + cardH / 2, cardX + cardW + gap - 2, cardY + cardH / 2, accent, { width: 1.4 }));
    }
  });

  if (phases.length > 1) {
    const firstX = x + pad + cardW / 2;
    const lastX = x + pad + (phases.length - 1) * (cardW + gap) + cardW / 2;
    const bottomY = cardY + cardH + 4;
    parts.push(path(`M ${lastX} ${bottomY} L ${lastX} ${returnY} L ${firstX} ${returnY} L ${firstX} ${bottomY}`, `fill="none" stroke="${accent2}" stroke-opacity="0.75" stroke-width="1.2" stroke-dasharray="4 4"`));
    parts.push(arrowHead(firstX, returnY, firstX, bottomY, accent2, 8));
  }

  parts.push(panel(x + pad, stripY, width - pad * 2, stripH, { fill: 'rgba(5,12,20,0.8)', radius: 10, stroke: accent, strokeWidth: 1 }));
  parts.push(singleLine(uppercaseLabel(diagram.principle), x + width / 2, stripY + stripH / 2 + (compact ? 3 : 4), {
    fill: SACRINT.textSoft,
    fontSize: compact ? 8 : 9,
    weight: 'semibold',
    letterSpacing: 1,
    anchor: 'middle',
  }));

  if (!diagram.available) parts.push(unavailableBadge(x + width - 48, y + 14));
  return parts.join('');
}

export function regulationFlowDiagram(
  diagram: RegulationFlowDiagramSpec,
  x: number,
  y: number,
  width: number,
  height: number,
  options: DiagramRenderOptions = {}
): string {
  const compact = options.compact ?? height < 400;
  const { accent, accent2 } = diagramColors(options);
  const pad = compact ? 12 : 16;
  const gap = compact ? 8 : 12;
  const anchorH = compact ? 42 : 52;
  const gridH = height - pad * 2 - anchorH - 14;
  const cardW = (width - pad * 2 - gap) / 2;
  const cardH = (gridH - gap) / 2;
  const gridX = x + pad;
  const gridY = y + pad;
  const anchorY = y + height - pad - anchorH;
  const stages = diagram.stages.slice(0, 4);
  const positions = [
    { cardX: gridX, cardY: gridY },
    { cardX: gridX + cardW + gap, cardY: gridY },
    { cardX: gridX + cardW + gap, cardY: gridY + cardH + gap },
    { cardX: gridX, cardY: gridY + cardH + gap },
  ];
  const parts: string[] = [];

  stages.forEach((stage, index) => {
    const position = positions[index];
    if (!position) return;
    const stageColor = index % 2 === 0 ? accent : accent2;
    parts.push(nodeCard(stage, position.cardX, position.cardY, cardW, cardH, { accent, accent2, compact, border: stageColor, maxLines: compact ? 2 : 3 }));
  });

  if (stages.length > 1) parts.push(diagramConnector(gridX + cardW + 2, gridY + cardH / 2, gridX + cardW + gap - 2, gridY + cardH / 2, accent, { width: 1.3 }));
  if (stages.length > 2) parts.push(diagramConnector(gridX + cardW + gap + cardW / 2, gridY + cardH + 2, gridX + cardW + gap + cardW / 2, gridY + cardH + gap - 2, accent2, { width: 1.3 }));
  if (stages.length > 3) parts.push(diagramConnector(gridX + cardW + gap - 2, gridY + cardH + gap + cardH / 2, gridX + cardW + 2, gridY + cardH + gap + cardH / 2, accent, { width: 1.3 }));
  if (stages.length > 3) parts.push(diagramConnector(gridX + cardW / 2, gridY + cardH + gap - 2, gridX + cardW / 2, gridY + cardH + 2, accent2, { width: 1.3, dash: '4 4' }));

  parts.push(panel(x + pad, anchorY, width - pad * 2, anchorH, { fill: 'rgba(5,12,20,0.8)', radius: 10, stroke: accent, strokeWidth: 1 }));
  parts.push(singleLine(uppercaseLabel(diagram.anchor), x + width / 2, anchorY + anchorH / 2 + (compact ? 3 : 4), {
    fill: SACRINT.textSoft,
    fontSize: compact ? 8 : 9,
    weight: 'semibold',
    letterSpacing: 1,
    anchor: 'middle',
  }));

  if (!diagram.available) parts.push(unavailableBadge(x + width - 48, y + 14));
  return parts.join('');
}

export function diagramSvg(
  diagram: SacrintDiagramSpec,
  x: number,
  y: number,
  width: number,
  height: number,
  options: DiagramRenderOptions = {}
): string {
  const theme = options.theme ?? 'dark';
  const rawAccent = options.accent ?? SACRINT.gold;
  const rawAccent2 = options.accent2 ?? SACRINT.blue;
  const resolvedOpts: DiagramRenderOptions =
    theme === 'light'
      ? {
          ...options,
          accent: resolveLightAccent(rawAccent),
          accent2: resolveLightAccent(rawAccent2),
          theme: 'light',
        }
      : options;

  let svg: string;
  switch (diagram.kind) {
    case 'linear':
      return linearGraph(diagram, x, y, width, height, resolvedOpts);
    case 'quadratic':
      return quadraticGraph(diagram, x, y, width, height, resolvedOpts);
    case 'system-2x2':
      return system2x2Graph(diagram, x, y, width, height, resolvedOpts);
    case 'exponential':
      return exponentialGraph(diagram, x, y, width, height, resolvedOpts);
    case 'geometry':
      return geometryDiagram(diagram, x, y, width, height, resolvedOpts);
    case 'reaction':
      svg = reactionScheme(diagram, x, y, width, height, resolvedOpts);
      break;
    case 'argument':
      svg = argumentMap(diagram, x, y, width, height, resolvedOpts);
      break;
    case 'language':
      svg = languageMap(diagram, x, y, width, height, resolvedOpts);
      break;
    case 'concept':
      svg = conceptMap(diagram, x, y, width, height, resolvedOpts);
      break;
    case 'timeline':
      svg = timelineDiagram(diagram, x, y, width, height, resolvedOpts);
      break;
    case 'system-map':
      svg = systemMapDiagram(diagram, x, y, width, height, resolvedOpts);
      break;
    case 'clinical-flow':
      svg = clinicalFlowDiagram(diagram, x, y, width, height, resolvedOpts);
      break;
    case 'block-diagram':
      svg = blockDiagram(diagram, x, y, width, height, resolvedOpts);
      break;
    case 'sop-flow':
      svg = sopFlowDiagram(diagram, x, y, width, height, resolvedOpts);
      break;
    case 'creative-cycle':
      svg = creativeCycleDiagram(diagram, x, y, width, height, resolvedOpts);
      break;
    case 'training-cycle':
      svg = trainingCycleDiagram(diagram, x, y, width, height, resolvedOpts);
      break;
    case 'regulation-flow':
      svg = regulationFlowDiagram(diagram, x, y, width, height, resolvedOpts);
      break;
  }
  return theme === 'light' ? adaptSchematicForLight(svg, rawAccent, rawAccent2) : svg;
}

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
    parts.push(singleLine('MODELO POR CONSTRUIR', plotX + plotW / 2, plotY + plotH / 2, { fill: tc.pal.muted, fontSize: compact ? 14 : 18, weight: 'semibold', letterSpacing: 2, anchor: 'middle' }));
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
    parts.push(singleLine('MODELO POR CONSTRUIR', plotX + plotW / 2, plotY + plotH / 2, { fill: tc.pal.muted, fontSize: compact ? 14 : 18, weight: 'semibold', letterSpacing: 2, anchor: 'middle' }));
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
    parts.push(singleLine('MODELO POR CONSTRUIR', plotX + plotW / 2, plotY + plotH / 2, { fill: tc.pal.muted, fontSize: compact ? 14 : 18, weight: 'semibold', letterSpacing: 2, anchor: 'middle' }));
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

  const yStep = niceTickStep(yMax, 5);
  for (let t = 0; t <= xMax; t++) {
    parts.push(line(sx(t), plotY, sx(t), plotY + plotH, tc.pal.strokeSoft, 1, 'stroke-opacity="0.35"'));
    parts.push(singleLine(`t=${t}`, sx(t), plotY + plotH + 20, { fill: tc.pal.muted, fontSize: compact ? 10 : 11, anchor: 'middle' }));
  }
  for (let val = 0; val <= yMax + 1e-6; val += yStep) {
    parts.push(line(plotX, sy(val), plotX + plotW, sy(val), tc.pal.strokeSoft, 1, 'stroke-opacity="0.35"'));
    parts.push(singleLine(`$${formatTickValue(val)}`, plotX - 10, sy(val) + 4, { fill: tc.pal.muted, fontSize: compact ? 9 : 10, anchor: 'end' }));
  }

  parts.push(line(plotX, plotY, plotX, plotY + plotH, tc.pal.textSoft, 1.5));
  parts.push(line(plotX, plotY + plotH, plotX + plotW, plotY + plotH, tc.pal.textSoft, 1.5));

  if (!diagram.available || diagram.compoundSeries.length < 2) {
    parts.push(line(plotX + plotW * 0.2, plotY + plotH * 0.48, plotX + plotW * 0.8, plotY + plotH * 0.48, tc.pal.strokeSoft, 1, 'stroke-dasharray="8 8" stroke-opacity="0.6"'));
    parts.push(singleLine('MODELO POR CONSTRUIR', plotX + plotW / 2, plotY + plotH / 2, { fill: tc.pal.muted, fontSize: compact ? 14 : 18, weight: 'semibold', letterSpacing: 2, anchor: 'middle' }));
    parts.push(singleLine(uppercaseLabel(diagram.xLabel), plotX + plotW / 2, y + height - 6, { fill: tc.pal.muted, fontSize: compact ? 10 : 11, weight: 'semibold', letterSpacing: 1.4, anchor: 'middle' }));
    return parts.join('');
  }

  // Serie Interés Simple (recta)
  const simpleD = diagram.simpleSeries.map((p, i) => `${i === 0 ? 'M' : 'L'} ${sx(p.t).toFixed(1)} ${sy(p.value).toFixed(1)}`).join(' ');
  parts.push(path(simpleD, `fill="none" stroke="${accent2}" stroke-width="2.5" stroke-dasharray="6 4"`));
  // Serie Interés Compuesto (curva exponencial)
  const compD = diagram.compoundSeries.map((p, i) => `${i === 0 ? 'M' : 'L'} ${sx(p.t).toFixed(1)} ${sy(p.value).toFixed(1)}`).join(' ');
  parts.push(path(compD, `fill="none" stroke="${accent}" stroke-width="${compact ? 3 : 3.8}" stroke-linecap="round"`));

  diagram.compoundSeries.forEach((p, idx) => {
    const px = sx(p.t);
    const py = sy(p.value);
    parts.push(circle(px, py, compact ? 3.5 : 4.5, accent, `stroke="${tc.dotStroke}" stroke-width="1.5"`));
    if (idx === 0 || idx === diagram.compoundSeries.length - 1) {
      const anchor = idx === 0 ? 'start' : 'end';
      const lx = idx === 0 ? px + 8 : px - 8;
      parts.push(singleLine(`$${p.value.toLocaleString('en-US')}`, lx, Math.max(plotY + 26, py - 10), { fill: accent, fontSize: compact ? 10 : 11, weight: 'bold', anchor }));
    }
  });

  parts.push(singleLine('― Interés compuesto (exponencial)', plotX + 10, plotY + 18, { fill: accent, fontSize: compact ? 9 : 11, weight: 'semibold' }));
  parts.push(singleLine('- - Interés simple (lineal)', plotX + plotW - 10, plotY + 18, { fill: accent2, fontSize: compact ? 9 : 11, weight: 'semibold', anchor: 'end' }));
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
  const cards = diagram.highlights.slice(0, 3);
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

export function radialGauge(cx: number, cy: number, radius: number, value: number, color: string, label: string): string {
  const clamped = Math.max(0, Math.min(1, value));
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * clamped;
  return `<g><circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="${SACRINT.strokeSoft}" stroke-width="6" stroke-opacity="0.55"/>
<circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${dash} ${circumference - dash}" transform="rotate(-90 ${cx} ${cy})"/>
${singleLine(`${Math.round(clamped * 100)}%`, cx, cy + 7, { fill: SACRINT.white, fontSize: radius * 0.52, family: 'display', weight: 'bold', anchor: 'middle' })}
${singleLine(uppercaseLabel(label), cx, cy + radius + 22, { fill: SACRINT.muted, fontSize: 10, weight: 'semibold', letterSpacing: 1.2, anchor: 'middle' })}</g>`;
}

export function tinyBars(x: number, y: number, width: number, height: number, values: number[], color: string): string {
  const max = Math.max(1, ...values);
  const gap = 4;
  const barWidth = (width - gap * (values.length - 1)) / values.length;
  return values
    .map((value, index) => {
      const barHeight = Math.max(3, (value / max) * height);
      return rect(x + index * (barWidth + gap), y + height - barHeight, barWidth, barHeight, `rx="2" fill="${color}" fill-opacity="${0.35 + (index / Math.max(1, values.length - 1)) * 0.65}"`);
    })
    .join('');
}
