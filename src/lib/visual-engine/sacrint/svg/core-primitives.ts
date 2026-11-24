import type { SacrintDiagramNode } from '../types';
import {
  FIGURE,
  resolveLightAccent,
  SACRINT,
  SACRINT_LIGHT,
  SACRINT_RADIUS,
  SACRINT_STROKE,
  type SacrintThemeMode,
} from '../tokens';
import { measureText, singleLine, textBlock, uppercaseLabel } from '../text-layout';
import { styleBackdrop, type StyleBackdropKind } from '../style-art';
import type { SacrintStyleId } from '../visual-styles';

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

export interface DiagramRenderOptions {
  accent?: string;
  accent2?: string;
  compact?: boolean;
  showTriangle?: boolean;
  theme?: SacrintThemeMode;
}

export function themeColors(theme: SacrintThemeMode = 'dark') {
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

export function adaptSchematicForLight(svg: string, accent: string, accent2: string): string {
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

export function diagramColors(options: DiagramRenderOptions): { accent: string; accent2: string } {
  return {
    accent: options.accent ?? SACRINT.gold,
    accent2: options.accent2 ?? SACRINT.blue,
  };
}

export function arrowHead(x1: number, y1: number, x2: number, y2: number, color: string, size = 8): string {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const baseX = x2 - Math.cos(angle) * size;
  const baseY = y2 - Math.sin(angle) * size;
  const wingX = Math.cos(angle + Math.PI / 2) * size * 0.52;
  const wingY = Math.sin(angle + Math.PI / 2) * size * 0.52;
  return `<polygon points="${x2},${y2} ${baseX + wingX},${baseY + wingY} ${baseX - wingX},${baseY - wingY}" fill="${color}"/>`;
}

export function diagramConnector(
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

export function nodeCard(
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
  const maxLines = options.maxLines ?? (height >= 100 ? 4 : 3);
  const detail = textBlock(node.detail, width - 24, {
    x: x + 12,
    y: detailY,
    fill: SACRINT.textSoft,
    maxFontSize: compact ? 9 : 11,
    minFontSize: 6.5,
    maxLines,
    lineHeightRatio: 1.24,
    truncate: false,
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

export function speciesCard(
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
