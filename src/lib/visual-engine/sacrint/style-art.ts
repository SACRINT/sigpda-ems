import { SACRINT } from './tokens';
import { singleLine } from './text-layout';
import { SACRINT_STYLES, type SacrintStyleId } from './visual-styles';

export type StyleBackdropKind = 'slide' | 'cover' | 'infographic';

function n(value: number): number {
  return Math.round(value * 10) / 10;
}

function artLine(x1: number, y1: number, x2: number, y2: number, stroke: string, width = 1, opacity = 1, dash = ''): string {
  const dashAttr = dash ? ` stroke-dasharray="${dash}"` : '';
  return `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${stroke}" stroke-width="${width}" stroke-opacity="${opacity}"${dashAttr}/>`;
}

function artCircle(cx: number, cy: number, r: number, fill: string, opacity = 1, stroke = 'none', strokeWidth = 0, dash = ''): string {
  const dashAttr = dash ? ` stroke-dasharray="${dash}"` : '';
  return `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="${fill}" fill-opacity="${opacity}" stroke="${stroke}" stroke-width="${strokeWidth}"${dashAttr}/>`;
}

function artRect(x: number, y: number, width: number, height: number, fill: string, opacity = 1, radius = 0, stroke = 'none', strokeWidth = 0): string {
  return `<rect x="${n(x)}" y="${n(y)}" width="${n(width)}" height="${n(height)}" rx="${n(radius)}" fill="${fill}" fill-opacity="${opacity}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
}

function artPath(d: string, stroke: string, width = 1, opacity = 1, fill = 'none'): string {
  return `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" stroke-opacity="${opacity}"/>`;
}

function artPolygon(points: Array<[number, number]>, fill: string, opacity = 1, stroke = 'none', strokeWidth = 0): string {
  const value = points.map(([x, y]) => `${n(x)},${n(y)}`).join(' ');
  return `<polygon points="${value}" fill="${fill}" fill-opacity="${opacity}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
}

function polar(cx: number, cy: number, radius: number, angle: number): [number, number] {
  return [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius];
}

function ruler(x: number, y: number, length: number, count: number, color: string, opacity: number, vertical = false): string {
  const parts: string[] = [];
  parts.push(vertical ? artLine(x, y, x, y + length, color, 1, opacity) : artLine(x, y, x + length, y, color, 1, opacity));
  for (let index = 0; index <= count; index += 1) {
    const offset = (length / count) * index;
    const tall = index % 3 === 0;
    if (vertical) {
      parts.push(artLine(x, y + offset, x + (tall ? 10 : 6), y + offset, color, 1, opacity));
    } else {
      parts.push(artLine(x + offset, y, x + offset, y + (tall ? 10 : 6), color, 1, opacity));
    }
  }
  return parts.join('');
}

function crosshair(cx: number, cy: number, size: number, color: string, opacity: number): string {
  return `<g>${artLine(cx - size, cy, cx + size, cy, color, 1, opacity)}${artLine(cx, cy - size, cx, cy + size, color, 1, opacity)}
${artCircle(cx, cy, size * 0.42, 'none', 1, color, 1)}${artCircle(cx, cy, 2.4, color, opacity)}</g>`;
}

function chevron(cx: number, cy: number, size: number, color: string, opacity: number, width = 2): string {
  return artPath(`M ${n(cx - size * 0.45)} ${n(cy - size)} L ${n(cx + size * 0.25)} ${n(cy)} L ${n(cx - size * 0.45)} ${n(cy + size)}`, color, width, opacity);
}

export function styleBackdrop(
  styleId: SacrintStyleId,
  kind: StyleBackdropKind,
  accent: string,
  accent2: string,
  width = 1920,
  height = 1080
): string {
  if (kind === 'cover') return '';
  const scale = Math.max(0.8, Math.min(1.6, width / 1920));
  switch (styleId) {
    case 'exactas': {
      return `<g data-style="exactas" pointer-events="none">
${ruler(width - 80 - 470 * scale, 34, 470 * scale, 12, accent, 0.22)}
${ruler(42, height * 0.52, height * 0.37, 10, accent2, 0.16, true)}
${crosshair(width - 76, height * 0.16, 30 * scale, accent2, 0.24)}</g>`;
    }
    case 'naturales': {
      const cx = width - 104;
      const cy = height * 0.66;
      const nodes: Array<[number, number, number]> = [
        [cx, cy, 11],
        [cx - 104 * scale, cy - 82 * scale, 7],
        [cx - 186 * scale, cy + 22 * scale, 9],
        [cx - 82 * scale, cy + 112 * scale, 6],
        [cx - 238 * scale, cy + 142 * scale, 5],
      ];
      const network = nodes
        .slice(1)
        .map(([nx, ny, nr]) => `${artLine(cx, cy, nx, ny, accent2, 1, 0.2)}${artCircle(nx, ny, nr, accent2, 0.3)}`)
        .join('');
      const py = height - 118;
      return `<g data-style="naturales" pointer-events="none">
${artCircle(cx, cy, 176 * scale, 'none', 1, accent, 1, '6 10')}
${network}
${artCircle(cx, cy, 11, accent, 0.32)}
${artPath(`M 80 ${n(py)} L 340 ${n(py)} L 372 ${n(py - 30)} L 404 ${n(py + 26)} L 436 ${n(py)} L 640 ${n(py)}`, accent2, 1.4, 0.22)}</g>`;
    }
    case 'humanidades': {
      return `<g data-style="humanidades" pointer-events="none">
${artLine(30, height * 0.15, 30, height * 0.91, accent, 1, 0.2)}
${artLine(41, height * 0.15, 41, height * 0.91, accent, 1, 0.12)}
${artLine(width - 41, height * 0.15, width - 41, height * 0.91, accent2, 1, 0.14)}
${singleLine('“', width - 268, height * 0.97, { fill: accent, fontSize: 260 * scale, family: 'display', opacity: 0.07 })}</g>`;
    }
    case 'socioemocional': {
      const waves = [0, 1, 2]
        .map((index) => {
          const y = height - 150 + index * 26;
          return artPath(
            `M -40 ${n(y)} C 240 ${n(y - 46 - index * 8)}, 420 ${n(y + 46 + index * 8)}, 700 ${n(y)} S 1140 ${n(y - 40)}, 1420 ${n(y)} S ${n(width - 140)} ${n(y + 42)}, ${n(width + 40)} ${n(y)}`,
            index === 1 ? accent2 : accent,
            1.3,
            0.16 - index * 0.03
          );
        })
        .join('');
      return `<g data-style="socioemocional" pointer-events="none">
${artCircle(width - 12, 36, 300, 'none', 1, accent2, 1.2)}
${artCircle(width - 12, 36, 214, 'none', 1, accent2, 1)}
${artCircle(width - 12, 36, 138, 'none', 1, accent2, 0.8)}
${waves}</g>`;
    }
    case 'tecnica': {
      const stripes = [0, 1, 2, 3]
        .map((index) => artLine(width - 156 + index * 30, 46, width - 74 + index * 30, 128, accent, 2, 0.2))
        .join('');
      return `<g data-style="tecnica" pointer-events="none">
${stripes}
${chevron(74, height - 118, 22, accent2, 0.24)}
${chevron(118, height - 118, 22, accent2, 0.16)}</g>`;
    }
    case 'general':
    default:
      return `<g data-style="general" pointer-events="none">${crosshair(width - 76, height * 0.16, 26, SACRINT.strokeSoft, 0.6)}</g>`;
  }
}

function coverFrame(x: number, y: number, width: number, height: number, accent: string, accent2: string): string {
  return `${artRect(x, y, width, height, '#050C15', 0.72, 26, SACRINT.strokeSoft, 1)}
${artRect(x, y, width, height, 'url(#sacrint-dots)', 0.5, 26)}
${artCircle(x + width * 0.72, y + height * 0.28, 300, 'url(#sacrint-glow-gold)', 1)}
${artCircle(x + width * 0.24, y + height * 0.76, 280, 'url(#sacrint-glow-blue)', 1)}
${artLine(x + 28, y + 28, x + 118, y + 28, accent, 2, 0.8)}
${artLine(x + 28, y + 28, x + 28, y + 118, accent, 2, 0.8)}
${artLine(x + width - 118, y + height - 28, x + width - 28, y + height - 28, accent2, 2, 0.8)}
${artLine(x + width - 28, y + height - 118, x + width - 28, y + height - 28, accent2, 2, 0.8)}`;
}

function exactasArt(cx: number, cy: number, radius: number, accent: string, accent2: string): string {
  const parts: string[] = [];
  [1.16, 0.84, 0.52].forEach((factor, index) => {
    parts.push(artCircle(cx, cy, radius * factor, 'none', 1, index === 0 ? accent : accent2, 1, index === 1 ? '7 9' : ''));
  });
  const hex = Array.from({ length: 6 }, (_, index) => polar(cx, cy, radius * 0.64, (Math.PI * 2 * index) / 6 - Math.PI / 2));
  parts.push(artPolygon(hex, 'rgba(8,17,29,0.55)', 0.8, accent, 1.4));
  for (let index = 0; index < 24; index += 1) {
    const angle = (Math.PI * 2 * index) / 24;
    const [x1, y1] = polar(cx, cy, radius * 1.24, angle);
    const [x2, y2] = polar(cx, cy, radius * 1.1, angle);
    parts.push(artLine(x1, y1, x2, y2, accent, 1, index % 3 === 0 ? 0.5 : 0.24));
  }
  for (let index = 0; index < 8; index += 1) {
    const angle = (Math.PI * 2 * index) / 8 - Math.PI / 2;
    const [px, py] = polar(cx, cy, radius * 1.16, angle);
    parts.push(artCircle(px, py, 4.5, index % 2 === 0 ? accent : accent2, 0.9));
  }
  parts.push(artLine(cx - radius * 1.3, cy, cx + radius * 1.3, cy, accent2, 0.8, 0.22));
  parts.push(artLine(cx, cy - radius * 1.3, cx, cy + radius * 1.3, accent, 0.8, 0.22));
  parts.push(artCircle(cx, cy, 8, accent, 1));
  return parts.join('');
}

function naturalesArt(cx: number, cy: number, radius: number, accent: string, accent2: string): string {
  const parts: string[] = [];
  parts.push(artCircle(cx, cy, radius * 1.18, 'none', 1, accent, 1, '6 10'));
  parts.push(artCircle(cx, cy, radius * 0.78, 'none', 1, accent2, 1, '3 8'));
  const nodes: Array<[number, number, number]> = [
    [0, 0, 13],
    [0.92, -0.3, 8],
    [0.58, 0.82, 7],
    [-0.72, 0.58, 9],
    [-0.98, -0.36, 6],
    [-0.36, -0.96, 7],
    [0.34, -1.02, 5],
    [1.02, 0.48, 6],
  ];
  const points = nodes.map(([dx, dy, r]) => ({ x: cx + dx * radius, y: cy + dy * radius, r }));
  points.slice(1).forEach((point, index) => {
    parts.push(artLine(cx, cy, point.x, point.y, accent2, 1.2, 0.4));
    const next = points[((index + 1) % (points.length - 1)) + 1];
    parts.push(artLine(point.x, point.y, next.x, next.y, SACRINT.textSoft, 0.8, 0.16));
  });
  points.forEach((point, index) => {
    parts.push(artCircle(point.x, point.y, point.r, index === 0 ? accent : accent2, index === 0 ? 1 : 0.82));
  });
  points.slice(1).forEach((point) => parts.push(artCircle(point.x, point.y, point.r + 5, 'none', 1, accent2, 0.8)));
  const pulseY = cy + radius * 1.42;
  parts.push(
    artPath(
      `M ${n(cx - radius * 1.32)} ${n(pulseY)} L ${n(cx - radius * 0.72)} ${n(pulseY)} L ${n(cx - radius * 0.5)} ${n(pulseY - 34)} L ${n(cx - radius * 0.3)} ${n(pulseY + 30)} L ${n(cx - radius * 0.12)} ${n(pulseY)} L ${n(cx + radius * 1.32)} ${n(pulseY)}`,
      accent2,
      1.5,
      0.55
    )
  );
  return parts.join('');
}

function humanidadesArt(cx: number, cy: number, radius: number, accent: string, accent2: string): string {
  const parts: string[] = [];
  const pageWidth = radius * 0.94;
  const pageHeight = radius * 1.18;
  const spine = 12;
  parts.push(artCircle(cx, cy, radius * 1.22, 'none', 1, accent2, 1, '2 9'));
  parts.push(
    artPolygon(
      [
        [cx - spine, cy - pageHeight / 2],
        [cx - spine - pageWidth, cy - pageHeight / 2 - 16],
        [cx - spine - pageWidth, cy + pageHeight / 2 + 16],
        [cx - spine, cy + pageHeight / 2],
      ],
      'rgba(8,17,29,0.86)',
      0.9,
      accent,
      1.5
    )
  );
  parts.push(
    artPolygon(
      [
        [cx + spine, cy - pageHeight / 2],
        [cx + spine + pageWidth, cy - pageHeight / 2 - 16],
        [cx + spine + pageWidth, cy + pageHeight / 2 + 16],
        [cx + spine, cy + pageHeight / 2],
      ],
      'rgba(11,24,38,0.86)',
      0.9,
      accent,
      1.5
    )
  );
  parts.push(artLine(cx, cy - pageHeight / 2 - 4, cx, cy + pageHeight / 2 + 4, accent2, 1.2, 0.7));
  for (let index = 0; index < 5; index += 1) {
    const offset = -pageHeight / 2 + 44 + index * 36;
    const width = pageWidth * (index === 4 ? 0.55 : 0.78);
    parts.push(artLine(cx - spine - 24, cy + offset, cx - spine - 24 - width, cy + offset - 3, SACRINT.textSoft, 1.4, 0.34));
    parts.push(artLine(cx + spine + 24, cy + offset, cx + spine + 24 + width, cy + offset - 3, SACRINT.textSoft, 1.4, 0.26));
  }
  parts.push(singleLine('“', cx - radius * 1.38, cy - radius * 0.92, { fill: accent, fontSize: radius * 0.86, family: 'display', opacity: 0.16 }));
  parts.push(artLine(cx - radius * 1.34, cy + radius * 0.9, cx + radius * 1.34, cy + radius * 0.9, accent, 1, 0.3));
  return parts.join('');
}

function socioemocionalArt(cx: number, cy: number, radius: number, accent: string, accent2: string): string {
  const parts: string[] = [];
  const blobs: Array<[number, number, number, string, number]> = [
    [-0.42, -0.32, 0.62, accent, 0.12],
    [0.38, 0.22, 0.58, accent2, 0.13],
    [0.1, -0.55, 0.44, accent, 0.1],
  ];
  blobs.forEach(([dx, dy, size, color, opacity]) => {
    parts.push(artCircle(cx + dx * radius, cy + dy * radius, radius * size, color, opacity));
  });
  [0.42, 0.64, 0.86, 1.08].forEach((factor, index) => {
    parts.push(artCircle(cx, cy, radius * factor, 'none', 1, index % 2 === 0 ? accent : accent2, 1.2, index > 1 ? '5 10' : ''));
  });
  for (let index = 0; index < 3; index += 1) {
    const y = cy + radius * 0.1 + index * 44;
    parts.push(
      artPath(
        `M ${n(cx - radius * 1.3)} ${n(y)} C ${n(cx - radius * 0.7)} ${n(y - 42)}, ${n(cx - radius * 0.2)} ${n(y + 42)}, ${n(cx + radius * 0.4)} ${n(y)} S ${n(cx + radius * 1)}, ${n(y - 36)}, ${n(cx + radius * 1.3)} ${n(y)}`,
        index === 1 ? accent : accent2,
        1.4,
        0.4 - index * 0.08
      )
    );
  }
  parts.push(artCircle(cx, cy, 9, accent, 1));
  parts.push(artCircle(cx, cy, 22, 'none', 1, accent2, 1.2));
  return parts.join('');
}

function tecnicaArt(cx: number, cy: number, radius: number, accent: string, accent2: string): string {
  const parts: string[] = [];
  for (let index = 0; index < 3; index += 1) {
    parts.push(chevron(cx - radius * 0.55 + index * radius * 0.42, cy - radius * 0.1, radius * 0.52, index === 1 ? accent : accent2, 0.9 - index * 0.18, 3));
  }
  const barWidth = radius * 0.16;
  const heights = [0.62, 1.02, 0.78, 1.24];
  heights.forEach((factor, index) => {
    const height = radius * factor;
    parts.push(artRect(cx + radius * 0.48 + index * (barWidth + 12), cy + radius * 0.86 - height, barWidth, height, index === 1 ? accent : accent2, index === 1 ? 0.9 : 0.5, 4));
  });
  for (let index = 0; index < 4; index += 1) {
    parts.push(artLine(cx - radius * 1.24, cy - radius * 0.92 + index * 16, cx - radius * 1.24 + 96 + index * 24, cy - radius * 0.92 + index * 16, accent, 2, 0.26));
  }
  parts.push(artLine(cx - radius * 1.3, cy + radius * 1.16, cx + radius * 1.3, cy + radius * 1.16, accent2, 1, 0.35));
  return parts.join('');
}

function generalArt(cx: number, cy: number, radius: number, accent: string, accent2: string): string {
  return `${artCircle(cx, cy, radius * 1.14, 'none', 1, accent, 1, '7 11')}
${artCircle(cx, cy, radius * 0.72, 'none', 1, accent2, 1)}
${crosshair(cx, cy, radius * 1.28, accent2, 0.3)}
${artCircle(cx, cy, 8, accent, 1)}`;
}

export function styleCoverArt(styleId: SacrintStyleId, x: number, y: number, width: number, height: number, accent: string, accent2: string): string {
  const style = SACRINT_STYLES[styleId];
  const cx = x + width / 2;
  const cy = y + height * 0.43;
  const radius = Math.min(width, height) * 0.295;
  const art =
    styleId === 'exactas'
      ? exactasArt(cx, cy, radius, accent, accent2)
      : styleId === 'naturales'
        ? naturalesArt(cx, cy, radius, accent, accent2)
        : styleId === 'humanidades'
          ? humanidadesArt(cx, cy, radius, accent, accent2)
          : styleId === 'socioemocional'
            ? socioemocionalArt(cx, cy, radius, accent, accent2)
            : styleId === 'tecnica'
              ? tecnicaArt(cx, cy, radius, accent, accent2)
              : generalArt(cx, cy, radius, accent, accent2);
  return `<g data-style="${styleId}">${coverFrame(x, y, width, height, accent, accent2)}${art}
${singleLine(style.coverCaption, x + 34, y + height - 64, { fill: accent, fontSize: 8, weight: 'semibold', letterSpacing: 2.4 })}
${singleLine(`SISTEMA VISUAL · ${style.label.toLocaleUpperCase('es-MX')}`, x + 34, y + height - 42, { fill: SACRINT.muted, fontSize: 8, weight: 'medium', letterSpacing: 1.8 })}</g>`;
}
