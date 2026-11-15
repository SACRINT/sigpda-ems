/**
 * stem-generator.ts — Generador de Recursos Gráficos Vectoriales STEM (Capa 0)
 * SIGPDA-EMS · SEMS Puebla MCCEMS 2026-2027
 *
 * Generación determinística en SVG puro ($0.00 USD, 0 tokens) para:
 * 1. Plano Cartesiano graduado con cuadrícula milimétrica.
 * 2. Gráfica de Función Lineal y = mx + b (solo con datos auténticos extraídos).
 * 3. Gráfica de Función Cuadrática (Parábola) con vértice y raíces (solo con datos auténticos).
 * 4. Sistema de Ecuaciones Lineales 2x2 con punto de intersección (solo con datos auténticos).
 * 5. Triángulo con cotas geométricas reales o simbólicas (a, b, c) sin inventar lados.
 * 6. Esquema de Clasificación y Medición de Ángulos (sin inventar triángulos 3-4-5).
 * 7. Rectángulo con cotas reales o simbólicas (b, h) de área/perímetro.
 *
 * IMPORTANTE: Los SVGs NO contienen <text>. El texto se dibuja
 * directamente en el PDF con jsPDF para evitar problemas de fuentes
 * en sharp/librsvg (renderiza como □□□□ si la fuente no está disponible).
 * Cada función retorna un objeto VisualResult con SVG + anotaciones.
 */

export interface StemVisualOptions {
  width?: number;
  height?: number;
  xMin?: number;
  xMax?: number;
  yMin?: number;
  yMax?: number;
  title?: string;
  subtitle?: string;
  isFallback?: boolean;
}

/** Anotación de texto que se dibujará en el PDF con jsPDF. */
export interface VisualAnnotation {
  text: string;
  svgX: number;
  svgY: number;
  fontSize: number;
  bold?: boolean;
  color?: string;
  align?: 'left' | 'center' | 'end';
}

/** Resultado de un generador visual: SVG (solo formas) + anotaciones de texto. */
export interface VisualResult {
  svg: string;
  annotations: VisualAnnotation[];
  metadata?: {
    type: string;
    realItemCount: number;
    isFallback: boolean;
  };
}

// Colores Institucionales
const COLOR_NAVY = '#1f3864';
const COLOR_BLUE = '#2563eb';
const COLOR_AMBER = '#d97706';
const COLOR_RED = '#dc2626';
const COLOR_GRID = '#e2e8f0';
const COLOR_BG = '#ffffff';

/**
 * Mapeador de coordenadas cartesianas matemáticas a píxeles del viewBox SVG.
 */
class CoordinateMapper {
  width: number;
  height: number;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  padding: number;

  constructor(opts: StemVisualOptions) {
    this.width = opts.width || 500;
    this.height = opts.height || 350;
    this.xMin = opts.xMin ?? -6;
    this.xMax = opts.xMax ?? 6;
    this.yMin = opts.yMin ?? -5;
    this.yMax = opts.yMax ?? 7;
    this.padding = 35;
  }

  toSvgX(x: number): number {
    const usableW = this.width - this.padding * 2;
    return this.padding + ((x - this.xMin) / (this.xMax - this.xMin)) * usableW;
  }

  toSvgY(y: number): number {
    const usableH = this.height - this.padding * 2;
    return this.height - this.padding - ((y - this.yMin) / (this.yMax - this.yMin)) * usableH;
  }
}

function niceStemStep(span: number, targetTicks = 6): number {
  const safeSpan = Math.max(1e-3, Math.abs(span));
  const raw = safeSpan / Math.max(2, targetTicks);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  if (norm <= 1.2) return Math.max(1, mag);
  if (norm <= 2.4) return Math.max(1, 2 * mag);
  if (norm <= 5.5) return Math.max(1, 5 * mag);
  return Math.max(1, 10 * mag);
}

/**
 * Base interna para dibujar el plano cartesiano (sin cerrar </svg>, sin texto).
 * Retorna SVG sin texto + anotaciones para dibujar en PDF.
 */
function buildCartesianPlaneBase(options: StemVisualOptions = {}): { svg: string; mapper: CoordinateMapper; annotations: VisualAnnotation[] } {
  const mapper = new CoordinateMapper(options);
  const w = mapper.width;
  const h = mapper.height;
  const originX = mapper.toSvgX(0);
  const originY = mapper.toSvgY(0);
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const axisX = clamp(originX, mapper.padding, w - mapper.padding);
  const axisY = clamp(originY, mapper.padding, h - mapper.padding);
  const xStep = niceStemStep(mapper.xMax - mapper.xMin, 6);
  const yStep = niceStemStep(mapper.yMax - mapper.yMin, 6);
  const xTickStart = Math.ceil(mapper.xMin / xStep) * xStep;
  const yTickStart = Math.ceil(mapper.yMin / yStep) * yStep;
  const annotations: VisualAnnotation[] = [];

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" height="100%">
    <rect width="${w}" height="${h}" fill="${COLOR_BG}" rx="6" stroke="#cbd5e1" stroke-width="1"/>
  `;

  if (options.title) {
    annotations.push({
      text: options.title,
      svgX: w / 2, svgY: 15,
      fontSize: 11.5, bold: true, color: COLOR_NAVY, align: 'center',
    });
  }

  // 1. Cuadrícula (Grid) — escalada proporcionalmente al rango real
  svg += `<g stroke="${COLOR_GRID}" stroke-width="1" stroke-dasharray="2,2">`;
  for (let x = xTickStart; x <= mapper.xMax + 1e-6; x += xStep) {
    if (Math.abs(x) < 1e-6) continue;
    const sx = mapper.toSvgX(x);
    svg += `<line x1="${sx}" y1="${mapper.padding}" x2="${sx}" y2="${h - mapper.padding}" />`;
  }
  for (let y = yTickStart; y <= mapper.yMax + 1e-6; y += yStep) {
    if (Math.abs(y) < 1e-6) continue;
    const sy = mapper.toSvgY(y);
    svg += `<line x1="${mapper.padding}" y1="${sy}" x2="${w - mapper.padding}" y2="${sy}" />`;
  }
  svg += `</g>`;

  // 2. Ejes principales X e Y
  svg += `<g stroke="${COLOR_NAVY}" stroke-width="1.8">
    <line x1="${mapper.padding - 10}" y1="${axisY}" x2="${w - mapper.padding + 10}" y2="${axisY}" />
    <line x1="${axisX}" y1="${h - mapper.padding + 10}" x2="${axisX}" y2="${mapper.padding - 10}" />
  </g>`;

  // Flechas directrices de los ejes
  svg += `<polygon points="${w - mapper.padding + 14},${axisY} ${w - mapper.padding + 6},${axisY - 3.5} ${w - mapper.padding + 6},${axisY + 3.5}" fill="${COLOR_NAVY}"/>`;
  svg += `<polygon points="${axisX},${mapper.padding - 14} ${axisX - 3.5},${mapper.padding - 6} ${axisX + 3.5},${mapper.padding - 6}" fill="${COLOR_NAVY}"/>`;

  // Rótulos de los ejes — como anotaciones para el PDF
  annotations.push({ text: 'x', svgX: w - mapper.padding + 20, svgY: axisY + 4, fontSize: 11, bold: true, color: COLOR_NAVY });
  annotations.push({ text: 'y', svgX: axisX - 4, svgY: mapper.padding - 18, fontSize: 11, bold: true, color: COLOR_NAVY, align: 'center' });

  // 3. Ticks numéricos — líneas en SVG, números como anotaciones
  const fmtTick = (val: number) => (Math.abs(val) >= 1000 ? `${Math.round(val)}` : Number(val.toFixed(1)).toString());
  for (let x = xTickStart; x <= mapper.xMax + 1e-6; x += xStep) {
    if (Math.abs(x) < 1e-6) continue;
    const sx = mapper.toSvgX(x);
    svg += `<line x1="${sx}" y1="${axisY - 3}" x2="${sx}" y2="${axisY + 3}" stroke="${COLOR_NAVY}" stroke-width="1.2"/>`;
    annotations.push({ text: fmtTick(x), svgX: sx, svgY: axisY + 12, fontSize: 8, color: '#64748b', align: 'center' });
  }
  for (let y = yTickStart; y <= mapper.yMax + 1e-6; y += yStep) {
    if (Math.abs(y) < 1e-6) continue;
    const sy = mapper.toSvgY(y);
    svg += `<line x1="${axisX - 3}" y1="${sy}" x2="${axisX + 3}" y2="${sy}" stroke="${COLOR_NAVY}" stroke-width="1.2"/>`;
    annotations.push({ text: fmtTick(y), svgX: axisX - 8, svgY: sy + 3, fontSize: 8, color: '#64748b', align: 'end' });
  }
  annotations.push({ text: '0', svgX: axisX - 7, svgY: axisY + 11, fontSize: 8, color: '#64748b' });

  return { svg, mapper, annotations };
}

/**
 * A. Plano Cartesiano Graduado con Cuadrícula (para tabulación o modelo por construir)
 */
export function generateCartesianPlane(options: StemVisualOptions = {}): VisualResult {
  const { svg: baseSvg, mapper, annotations } = buildCartesianPlaneBase(options);
  let svg = baseSvg;
  if (options.subtitle) {
    svg += `<rect x="${mapper.padding + 8}" y="${mapper.padding + 6}" width="215" height="24" fill="#f8fafc" rx="4" stroke="#94a3b8" stroke-width="1" stroke-dasharray="2,2"/>`;
    annotations.push({
      text: options.subtitle,
      svgX: mapper.padding + 14,
      svgY: mapper.padding + 21,
      fontSize: 8,
      bold: true,
      color: '#475569',
    });
  }
  return {
    svg: svg + `</svg>`,
    annotations,
    metadata: {
      type: 'stem-cartesian-plane',
      realItemCount: 0,
      isFallback: options.isFallback ?? true,
    },
  };
}

/**
 * B. Gráfica de Función Lineal y = mx + b (con datos extraídos)
 */
export function generateLinearGraph(m = 1.5, b = 1, options: StemVisualOptions = {}): VisualResult {
  const { svg: baseSvg, mapper, annotations } = buildCartesianPlaneBase({
    ...options,
    title: options.title || `Función Lineal: f(x) = ${m}x ${b >= 0 ? '+ ' + b : '- ' + Math.abs(b)}`,
  });
  let svg = baseSvg;

  const x1 = mapper.xMin;
  const y1 = m * x1 + b;
  const x2 = mapper.xMax;
  const y2 = m * x2 + b;

  svg += `<line x1="${mapper.toSvgX(x1)}" y1="${mapper.toSvgY(y1)}" x2="${mapper.toSvgX(x2)}" y2="${mapper.toSvgY(y2)}" stroke="${COLOR_BLUE}" stroke-width="2.5" stroke-linecap="round"/>`;

  // Punto de corte con eje Y: (0, b)
  const interceptSx = mapper.toSvgX(0);
  const interceptSy = mapper.toSvgY(b);
  svg += `<circle cx="${interceptSx}" cy="${interceptSy}" r="4" fill="${COLOR_BLUE}" stroke="#ffffff" stroke-width="1.5"/>`;
  annotations.push({ text: `Corte Y (0, ${b})`, svgX: interceptSx + 8, svgY: interceptSy - 5, fontSize: 9, bold: true, color: COLOR_BLUE });

  // Caja de ecuación y pendiente
  svg += `<rect x="${mapper.padding + 10}" y="${mapper.padding + 8}" width="140" height="34" fill="#eff6ff" rx="4" stroke="${COLOR_BLUE}" stroke-width="1"/>`;
  annotations.push({ text: `y = ${m}x ${b >= 0 ? '+' : '-'} ${Math.abs(b)}`, svgX: mapper.padding + 18, svgY: mapper.padding + 22, fontSize: 9.5, bold: true, color: COLOR_NAVY });
  annotations.push({ text: `Pendiente m = ${m}`, svgX: mapper.padding + 18, svgY: mapper.padding + 34, fontSize: 8, color: '#64748b' });

  return {
    svg: svg + `</svg>`,
    annotations,
    metadata: {
      type: 'stem-linear-graph',
      realItemCount: 2,
      isFallback: false,
    },
  };
}

/**
 * C. Gráfica de Función Cuadrática (Parábola) y = ax² + bx + c
 */
export function generateQuadraticGraph(a = 1, b = 0, c = -4, options: StemVisualOptions = {}): VisualResult {
  const eqParts = [`f(x) = ${a === 1 ? '' : a === -1 ? '-' : a}x²`];
  if (b !== 0) eqParts.push(b > 0 ? `+ ${b}x` : `- ${Math.abs(b)}x`);
  if (c !== 0) eqParts.push(c > 0 ? `+ ${c}` : `- ${Math.abs(c)}`);
  const eqStr = eqParts.join(' ');

  const vh = -b / (2 * a);
  const vk = a * vh * vh + b * vh + c;
  const disc = b * b - 4 * a * c;
  const roots =
    disc >= 0
      ? [(-b - Math.sqrt(disc)) / (2 * a), (-b + Math.sqrt(disc)) / (2 * a)].sort((p, q) => p - q)
      : [];
  const halfSpanX = roots.length === 2 ? Math.max(5, Math.abs(roots[1]! - roots[0]!) * 0.72) : 6;
  const xMinAuto = Math.floor(Math.min(vh - halfSpanX, roots[0] ?? vh - 4, -2));
  const xMaxAuto = Math.ceil(Math.max(vh + halfSpanX, roots[roots.length - 1] ?? vh + 4, 2));
  const endY1 = a * xMinAuto * xMinAuto + b * xMinAuto + c;
  const endY2 = a * xMaxAuto * xMaxAuto + b * xMaxAuto + c;
  const yCandidates = [0, vk, c, endY1, endY2];
  const yRawMin = Math.min(...yCandidates);
  const yRawMax = Math.max(...yCandidates);
  const yPad = Math.max(3, (yRawMax - yRawMin) * 0.14);

  const { svg: baseSvg, mapper, annotations } = buildCartesianPlaneBase({
    xMin: options.xMin ?? xMinAuto,
    xMax: options.xMax ?? xMaxAuto,
    yMin: options.yMin ?? Math.floor(yRawMin - yPad),
    yMax: options.yMax ?? Math.ceil(yRawMax + yPad),
    ...options,
    title: options.title || `Función Cuadrática: ${eqStr}`,
  });
  let svg = baseSvg;

  // 1. Muestreo de puntos de la parábola (120 muestras adaptativas al dominio real)
  const step = Math.max(0.05, (mapper.xMax - mapper.xMin) / 120);
  const points: { x: number; y: number }[] = [];
  for (let x = mapper.xMin; x <= mapper.xMax + step * 0.1; x += step) {
    const y = a * x * x + b * x + c;
    points.push({ x, y });
  }

  let pathD = '';
  let inBounds = false;
  const ySpan = Math.max(1, mapper.yMax - mapper.yMin);
  for (const pt of points) {
    const sx = mapper.toSvgX(pt.x);
    const sy = mapper.toSvgY(pt.y);
    if (pt.y >= mapper.yMin - ySpan * 0.08 && pt.y <= mapper.yMax + ySpan * 0.08) {
      if (!inBounds) { pathD += `M ${sx.toFixed(1)} ${sy.toFixed(1)} `; inBounds = true; }
      else { pathD += `L ${sx.toFixed(1)} ${sy.toFixed(1)} `; }
    } else { inBounds = false; }
  }
  svg += `<path d="${pathD}" fill="none" stroke="${COLOR_AMBER}" stroke-width="2.5" stroke-linecap="round"/>`;

  // 2. Vértice
  if (vh >= mapper.xMin && vh <= mapper.xMax && vk >= mapper.yMin && vk <= mapper.yMax) {
    const vSx = mapper.toSvgX(vh);
    const vSy = mapper.toSvgY(vk);
    svg += `<circle cx="${vSx}" cy="${vSy}" r="4.5" fill="${COLOR_AMBER}" stroke="#ffffff" stroke-width="1.5"/>`;
    const labelYOff = a > 0 ? 14 : -8;
    annotations.push({ text: `Vértice (${vh.toFixed(1)}, ${vk.toFixed(1)})`, svgX: vSx, svgY: vSy + labelYOff, fontSize: 9, bold: true, color: COLOR_AMBER, align: 'center' });
  }

  // 3. Raíces
  if (roots.length > 0) {
    roots.forEach((r, idx) => {
      if (r >= mapper.xMin && r <= mapper.xMax) {
        const rSx = mapper.toSvgX(r);
        const rSy = mapper.toSvgY(0);
        svg += `<circle cx="${rSx}" cy="${rSy}" r="4" fill="#059669" stroke="#ffffff" stroke-width="1.5"/>`;
        annotations.push({ text: `x${idx + 1}=${r.toFixed(1)}`, svgX: rSx, svgY: rSy - 6, fontSize: 8.5, bold: true, color: '#059669', align: 'center' });
      }
    });
  }

  // Caja informativa
  svg += `<rect x="${mapper.padding + 10}" y="${mapper.padding + 8}" width="175" height="38" fill="#fffbeb" rx="4" stroke="${COLOR_AMBER}" stroke-width="1"/>`;
  annotations.push({ text: eqStr, svgX: mapper.padding + 18, svgY: mapper.padding + 22, fontSize: 8.5, bold: true, color: COLOR_NAVY });
  annotations.push({ text: `Vértice: (${vh.toFixed(1)}, ${vk.toFixed(1)})`, svgX: mapper.padding + 18, svgY: mapper.padding + 35, fontSize: 7.5, color: '#64748b' });

  return {
    svg: svg + `</svg>`,
    annotations,
    metadata: {
      type: 'stem-quadratic-graph',
      realItemCount: 3,
      isFallback: false,
    },
  };
}

/**
 * D. Sistema de Ecuaciones Lineales 2x2 con Punto de Intersección
 */
export function generateLinearSystemGraph(
  m1 = 1, b1 = -1,
  m2 = -0.5, b2 = 3.5,
  options: StemVisualOptions = {}
): VisualResult {
  const hasInter = Math.abs(m1 - m2) > 1e-6;
  const interX = hasInter ? (b2 - b1) / (m1 - m2) : 0;
  const interY = hasInter ? m1 * interX + b1 : 0;
  const xMinAuto = Math.floor(Math.min(-2, interX - 4));
  const xMaxAuto = Math.ceil(Math.max(6, interX + 4));
  const yPts = [0, b1, b2, interY, m1 * xMinAuto + b1, m1 * xMaxAuto + b1, m2 * xMinAuto + b2, m2 * xMaxAuto + b2].filter(Number.isFinite);
  const yMinAuto = Math.floor(Math.min(-2, Math.min(...yPts) - 1));
  const yMaxAuto = Math.ceil(Math.max(8, Math.max(...yPts) + 1));

  const { svg: baseSvg, mapper, annotations } = buildCartesianPlaneBase({
    xMin: options.xMin ?? xMinAuto,
    xMax: options.xMax ?? xMaxAuto,
    yMin: options.yMin ?? yMinAuto,
    yMax: options.yMax ?? yMaxAuto,
    ...options,
    title: options.title || `Sistema de Ecuaciones: Intersección de Rectas`,
  });
  let svg = baseSvg;

  // Recta 1 (Azul)
  svg += `<line x1="${mapper.toSvgX(mapper.xMin)}" y1="${mapper.toSvgY(m1 * mapper.xMin + b1)}" x2="${mapper.toSvgX(mapper.xMax)}" y2="${mapper.toSvgY(m1 * mapper.xMax + b1)}" stroke="${COLOR_BLUE}" stroke-width="2.2" stroke-linecap="round"/>`;

  // Recta 2 (Rojo)
  svg += `<line x1="${mapper.toSvgX(mapper.xMin)}" y1="${mapper.toSvgY(m2 * mapper.xMin + b2)}" x2="${mapper.toSvgX(mapper.xMax)}" y2="${mapper.toSvgY(m2 * mapper.xMax + b2)}" stroke="${COLOR_RED}" stroke-width="2.2" stroke-linecap="round"/>`;

  // Punto de intersección
  if (m1 !== m2) {
    const interX = (b2 - b1) / (m1 - m2);
    const interY = m1 * interX + b1;
    if (interX >= mapper.xMin && interX <= mapper.xMax && interY >= mapper.yMin && interY <= mapper.yMax) {
      const iSx = mapper.toSvgX(interX);
      const iSy = mapper.toSvgY(interY);
      const ox = mapper.toSvgX(0);
      const oy = mapper.toSvgY(0);
      svg += `
        <line x1="${iSx}" y1="${iSy}" x2="${iSx}" y2="${oy}" stroke="${COLOR_NAVY}" stroke-width="1" stroke-dasharray="3,2"/>
        <line x1="${iSx}" y1="${iSy}" x2="${ox}" y2="${iSy}" stroke="${COLOR_NAVY}" stroke-width="1" stroke-dasharray="3,2"/>
        <circle cx="${iSx}" cy="${iSy}" r="5" fill="#7c3aed" stroke="#ffffff" stroke-width="1.8"/>`;
      annotations.push({ text: `Solución (${interX.toFixed(1)}, ${interY.toFixed(1)})`, svgX: iSx + 8, svgY: iSy - 6, fontSize: 9, bold: true, color: '#7c3aed' });
    }
  }

  // Caja de leyenda
  svg += `<rect x="${mapper.padding + 10}" y="${mapper.padding + 8}" width="160" height="42" fill="#faf5ff" rx="4" stroke="#c084fc" stroke-width="1"/>`;
  annotations.push({ text: `L₁: y = ${m1}x ${b1 >= 0 ? '+' : '-'} ${Math.abs(b1)}`, svgX: mapper.padding + 16, svgY: mapper.padding + 21, fontSize: 8.5, bold: true, color: COLOR_BLUE });
  annotations.push({ text: `L₂: y = ${m2}x ${b2 >= 0 ? '+' : '-'} ${Math.abs(b2)}`, svgX: mapper.padding + 16, svgY: mapper.padding + 34, fontSize: 8.5, bold: true, color: COLOR_RED });

  return {
    svg: svg + `</svg>`,
    annotations,
    metadata: {
      type: 'stem-linear-system-graph',
      realItemCount: 4,
      isFallback: false,
    },
  };
}

/**
 * D2. Teorema de Napoleón y Congruencia de Triángulos (triángulos equiláteros externos + triángulo interior de baricentros)
 */
export function generateNapoleonTriangleVisual(
  options: { width?: number; height?: number; title?: string; isNapoleon?: boolean } = {}
): VisualResult {
  const w = options.width || 500;
  const h = options.height || 310;
  const annotations: VisualAnnotation[] = [
    {
      text: options.title || (options.isNapoleon ? 'Teorema de Napoleón: Equiláteros sobre lados' : 'Criterios de Congruencia (LLL · LAL · ALA)'),
      svgX: w / 2,
      svgY: 16,
      fontSize: 11.5,
      bold: true,
      color: COLOR_NAVY,
      align: 'center',
    },
  ];

  // Triángulo base ABC centrado y 3 triángulos equiláteros exteriores aproximados + baricentros
  const ax = 195; const ay = 195;
  const bx = 305; const by = 205;
  const cx = 240; const cy = 115;

  const outwardApex = (x1: number, y1: number, x2: number, y2: number, sign: number) => {
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const k = (Math.sqrt(3) / 2) * sign;
    return { x: mx - dy * k, y: my + dx * k };
  };

  const pAB = outwardApex(ax, ay, bx, by, 1);
  const pBC = outwardApex(bx, by, cx, cy, 1);
  const pCA = outwardApex(cx, cy, ax, ay, 1);

  const cAB = { x: (ax + bx + pAB.x) / 3, y: (ay + by + pAB.y) / 3 };
  const cBC = { x: (bx + cx + pBC.x) / 3, y: (by + cy + pBC.y) / 3 };
  const cCA = { x: (cx + ax + pCA.x) / 3, y: (cy + ay + pCA.y) / 3 };

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" height="100%">
    <rect width="${w}" height="${h}" fill="${COLOR_BG}" rx="6" stroke="#cbd5e1" stroke-width="1"/>
    <polygon points="${ax},${ay} ${bx},${by} ${pAB.x.toFixed(1)},${pAB.y.toFixed(1)}" fill="#fef3c7" fill-opacity="0.65" stroke="${COLOR_AMBER}" stroke-width="1.5"/>
    <polygon points="${bx},${by} ${cx},${cy} ${pBC.x.toFixed(1)},${pBC.y.toFixed(1)}" fill="#dbeafe" fill-opacity="0.65" stroke="${COLOR_BLUE}" stroke-width="1.5"/>
    <polygon points="${cx},${cy} ${ax},${ay} ${pCA.x.toFixed(1)},${pCA.y.toFixed(1)}" fill="#dcfce7" fill-opacity="0.65" stroke="#059669" stroke-width="1.5"/>
    <polygon points="${ax},${ay} ${bx},${by} ${cx},${cy}" fill="#ffffff" stroke="${COLOR_NAVY}" stroke-width="2.2"/>
    <polygon points="${cAB.x.toFixed(1)},${cAB.y.toFixed(1)} ${cBC.x.toFixed(1)},${cBC.y.toFixed(1)} ${cCA.x.toFixed(1)},${cCA.y.toFixed(1)}" fill="none" stroke="${COLOR_RED}" stroke-width="2" stroke-dasharray="5,3"/>
    <circle cx="${cAB.x.toFixed(1)}" cy="${cAB.y.toFixed(1)}" r="4" fill="${COLOR_RED}"/>
    <circle cx="${cBC.x.toFixed(1)}" cy="${cBC.y.toFixed(1)}" r="4" fill="${COLOR_RED}"/>
    <circle cx="${cCA.x.toFixed(1)}" cy="${cCA.y.toFixed(1)}" r="4" fill="${COLOR_RED}"/>
  </svg>`;

  annotations.push(
    { text: 'A', svgX: ax - 10, svgY: ay + 4, fontSize: 9, bold: true, color: COLOR_NAVY },
    { text: 'B', svgX: bx + 6, svgY: by + 4, fontSize: 9, bold: true, color: COLOR_NAVY },
    { text: 'C', svgX: cx, svgY: cy - 8, fontSize: 9, bold: true, color: COLOR_NAVY, align: 'center' },
    { text: 'Triángulo de Napoleón (equilátero entre baricentros)', svgX: w / 2, svgY: h - 14, fontSize: 8.5, bold: true, color: COLOR_RED, align: 'center' }
  );

  return {
    svg,
    annotations,
    metadata: {
      type: 'stem-napoleon-geometry',
      realItemCount: 3,
      isFallback: false,
    },
  };
}

/**
 * E. Triángulo Geométrico con Cotas Reales o Simbólicas (Teorema de Pitágoras)
 * Si no se proporcionan lados reales (catA === null), muestra esquema simbólico (a, b, c) sin inventar 3-4-5.
 */
export function generateTriangle(
  catA: number | null = null,
  catB: number | null = null,
  hipC: number | null = null,
  options: { width?: number; height?: number; title?: string } = {}
): VisualResult {
  const w = options.width || 460;
  const h = options.height || 260;
  const hasRealSides = catA !== null && catB !== null && Number.isFinite(catA) && Number.isFinite(catB);
  const computedHip =
    hasRealSides
      ? hipC !== null && Number.isFinite(hipC)
        ? hipC
        : Number(Math.hypot(catA!, catB!).toFixed(2))
      : null;

  const title = options.title || 'Triángulo Rectángulo — Teorema de Pitágoras';
  const annotations: VisualAnnotation[] = [];

  const ox = 70;
  const oy = h - 60;
  const basePx = 220;
  const altPx = 130;

  const pA = { x: ox, y: oy };
  const pB = { x: ox + basePx, y: oy };
  const pC = { x: ox, y: oy - altPx };

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" height="100%">
    <rect width="${w}" height="${h}" fill="${COLOR_BG}" rx="6" stroke="#cbd5e1" stroke-width="1"/>
  `;

  annotations.push({ text: title, svgX: w / 2, svgY: 18, fontSize: 11.5, bold: true, color: COLOR_NAVY, align: 'center' });

  // Símbolo de ángulo recto
  const sq = 14;
  svg += `<polyline points="${pA.x},${pA.y - sq} ${pA.x + sq},${pA.y - sq} ${pA.x + sq},${pA.y}" fill="none" stroke="${COLOR_NAVY}" stroke-width="1.2"/>`;

  // Triángulo
  svg += `<polygon points="${pA.x},${pA.y} ${pB.x},${pB.y} ${pC.x},${pC.y}" fill="#f0fdf4" stroke="${COLOR_NAVY}" stroke-width="2.2" stroke-linejoin="round"/>`;

  // Cotas reales o simbólicas
  const labelB = hasRealSides ? `Cateto b = ${catB} u` : 'Cateto b (base)';
  const labelA = hasRealSides ? `Cateto a = ${catA} u` : 'Cateto a (altura)';
  const labelC = hasRealSides ? `Hipotenusa c = ${computedHip} u` : 'Hipotenusa c';

  annotations.push({ text: labelB, svgX: ox + basePx / 2, svgY: oy + 18, fontSize: 9.5, bold: true, color: COLOR_BLUE, align: 'center' });
  annotations.push({ text: labelA, svgX: ox - 10, svgY: oy - altPx / 2, fontSize: 9.5, bold: true, color: COLOR_BLUE, align: 'end' });
  annotations.push({ text: labelC, svgX: ox + basePx / 2 + 16, svgY: oy - altPx / 2 - 10, fontSize: 9.5, bold: true, color: COLOR_AMBER });

  // Caja de trabajo
  svg += `<rect x="${w - 150}" y="45" width="135" height="140" fill="#f8fafc" rx="4" stroke="#94a3b8" stroke-width="1" stroke-dasharray="2,2"/>`;
  svg += `<line x1="${w - 140}" y1="120" x2="${w - 25}" y2="120" stroke="#cbd5e1" stroke-width="0.8"/>`;
  svg += `<line x1="${w - 140}" y1="140" x2="${w - 25}" y2="140" stroke="#cbd5e1" stroke-width="0.8"/>`;
  svg += `<line x1="${w - 140}" y1="160" x2="${w - 25}" y2="160" stroke="#cbd5e1" stroke-width="0.8"/>`;
  annotations.push({ text: 'ESPACIO DE CÁLCULO', svgX: w - 82, svgY: 62, fontSize: 8.5, bold: true, color: COLOR_NAVY, align: 'center' });
  annotations.push({ text: hasRealSides ? 'Relación Pitagórica:' : 'Relación geométrica:', svgX: w - 140, svgY: 80, fontSize: 8, color: '#64748b' });
  annotations.push({ text: 'c² = a² + b²', svgX: w - 140, svgY: 95, fontSize: 8.5, bold: true, color: COLOR_NAVY });

  return {
    svg: svg + `</svg>`,
    annotations,
    metadata: {
      type: 'stem-triangle',
      realItemCount: hasRealSides ? 3 : 0,
      isFallback: !hasRealSides,
    },
  };
}

/**
 * F. Esquema de Clasificación y Medición de Ángulos (sin inventar lados de triángulos)
 */
export function generateAngleClassificationVisual(
  options: { width?: number; height?: number; title?: string; angleDeg?: number | null } = {}
): VisualResult {
  const w = options.width || 460;
  const h = options.height || 250;
  const title = options.title || 'Geometría Plana: Vértice, Abertura Angular y Clasificación';
  const hasRealAngle = options.angleDeg != null && Number.isFinite(options.angleDeg);
  const deg = hasRealAngle ? Math.max(15, Math.min(165, Number(options.angleDeg))) : 55;
  const rad = (deg * Math.PI) / 180;

  const ox = 110;
  const oy = h - 55;
  const rayLen = 155;
  const rayX = Number((ox + rayLen * Math.cos(rad)).toFixed(1));
  const rayY = Number((oy - rayLen * Math.sin(rad)).toFixed(1));
  const arcR = 44;
  const arcX = Number((ox + arcR * Math.cos(rad)).toFixed(1));
  const arcY = Number((oy - arcR * Math.sin(rad)).toFixed(1));

  const annotations: VisualAnnotation[] = [];
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" height="100%">
    <rect width="${w}" height="${h}" fill="${COLOR_BG}" rx="6" stroke="#cbd5e1" stroke-width="1"/>
  `;

  annotations.push({ text: title, svgX: w / 2, svgY: 18, fontSize: 11.5, bold: true, color: COLOR_NAVY, align: 'center' });

  // Semirrecta horizontal de referencia (0° y 180°) y vertical (90°)
  svg += `<line x1="${ox - 70}" y1="${oy}" x2="${ox + rayLen + 15}" y2="${oy}" stroke="#cbd5e1" stroke-width="1.4" stroke-dasharray="4,3"/>`;
  svg += `<line x1="${ox}" y1="${oy}" x2="${ox}" y2="${oy - rayLen}" stroke="#cbd5e1" stroke-width="1.4" stroke-dasharray="4,3"/>`;

  // Lados del ángulo OA y OB
  svg += `<line x1="${ox}" y1="${oy}" x2="${ox + rayLen}" y2="${oy}" stroke="${COLOR_NAVY}" stroke-width="2.4" stroke-linecap="round"/>`;
  svg += `<line x1="${ox}" y1="${oy}" x2="${rayX}" y2="${rayY}" stroke="${COLOR_BLUE}" stroke-width="2.4" stroke-linecap="round"/>`;

  // Arco angular y vértice O
  svg += `<path d="M ${ox + arcR} ${oy} A ${arcR} ${arcR} 0 0 0 ${arcX} ${arcY}" fill="none" stroke="${COLOR_AMBER}" stroke-width="2"/>`;
  svg += `<circle cx="${ox}" cy="${oy}" r="4.5" fill="${COLOR_NAVY}"/>`;

  annotations.push({ text: 'Vértice O', svgX: ox, svgY: oy + 18, fontSize: 9, bold: true, color: COLOR_NAVY, align: 'center' });
  annotations.push({ text: '90° (Recto)', svgX: ox + 6, svgY: oy - rayLen + 8, fontSize: 8, color: '#64748b' });
  annotations.push({ text: '0°', svgX: ox + rayLen + 8, svgY: oy - 4, fontSize: 8, color: '#64748b' });
  annotations.push({ text: '180° (Llano)', svgX: ox - 68, svgY: oy - 6, fontSize: 8, color: '#64748b' });
  annotations.push({
    text: hasRealAngle ? `θ = ${options.angleDeg}°` : 'Abertura θ (°)',
    svgX: ox + arcR + 10,
    svgY: oy - 16,
    fontSize: 9.5,
    bold: true,
    color: COLOR_AMBER,
  });

  // Caja de referencia de relaciones angulares
  svg += `<rect x="${w - 165}" y="42" width="148" height="150" fill="#f8fafc" rx="4" stroke="#94a3b8" stroke-width="1" stroke-dasharray="2,2"/>`;
  annotations.push({ text: 'RELACIONES ANGULARES', svgX: w - 91, svgY: 58, fontSize: 8.5, bold: true, color: COLOR_NAVY, align: 'center' });
  annotations.push({ text: 'Agudo: 0° < θ < 90°', svgX: w - 155, svgY: 78, fontSize: 8, color: '#475569' });
  annotations.push({ text: 'Recto: θ = 90°', svgX: w - 155, svgY: 94, fontSize: 8, color: '#475569' });
  annotations.push({ text: 'Obtuso: 90° < θ < 180°', svgX: w - 155, svgY: 110, fontSize: 8, color: '#475569' });
  annotations.push({ text: 'Complementarios: α + β = 90°', svgX: w - 155, svgY: 132, fontSize: 8, bold: true, color: COLOR_BLUE });
  annotations.push({ text: 'Suplementarios: α + β = 180°', svgX: w - 155, svgY: 148, fontSize: 8, bold: true, color: COLOR_NAVY });

  return {
    svg: svg + `</svg>`,
    annotations,
    metadata: {
      type: 'stem-angle-classification',
      realItemCount: hasRealAngle ? 1 : 0,
      isFallback: !hasRealAngle,
    },
  };
}

/**
 * G. Rectángulo Geométrico con Cotas Reales o Simbólicas de Perímetro y Área
 */
export function generateRectangle(
  largo: number | null = null,
  ancho: number | null = null,
  options: { width?: number; height?: number; title?: string } = {}
): VisualResult {
  const w = options.width || 460;
  const h = options.height || 240;
  const hasRealDims = largo !== null && ancho !== null && Number.isFinite(largo) && Number.isFinite(ancho);
  const title = options.title || 'Geometría Plana: Perímetro y Área de Cuadriláteros';
  const annotations: VisualAnnotation[] = [];

  const rx = 65;
  const ry = 60;
  const rw = 210;
  const rh = 110;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" height="100%">
    <rect width="${w}" height="${h}" fill="${COLOR_BG}" rx="6" stroke="#cbd5e1" stroke-width="1"/>
  `;

  annotations.push({ text: title, svgX: w / 2, svgY: 18, fontSize: 11.5, bold: true, color: COLOR_NAVY, align: 'center' });

  // Rectángulo principal
  svg += `<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" fill="#eff6ff" stroke="${COLOR_NAVY}" stroke-width="2" rx="2"/>`;

  // Cota superior (Largo)
  svg += `<line x1="${rx}" y1="${ry - 12}" x2="${rx + rw}" y2="${ry - 12}" stroke="${COLOR_BLUE}" stroke-width="1.2"/>`;
  svg += `<line x1="${rx}" y1="${ry - 18}" x2="${rx}" y2="${ry - 6}" stroke="${COLOR_BLUE}" stroke-width="1.2"/>`;
  svg += `<line x1="${rx + rw}" y1="${ry - 18}" x2="${rx + rw}" y2="${ry - 6}" stroke="${COLOR_BLUE}" stroke-width="1.2"/>`;
  annotations.push({
    text: hasRealDims ? `Largo (Base) = ${largo} u` : 'Base (b)',
    svgX: rx + rw / 2,
    svgY: ry - 16,
    fontSize: 9,
    bold: true,
    color: COLOR_BLUE,
    align: 'center',
  });

  // Cota lateral (Ancho)
  svg += `<line x1="${rx - 12}" y1="${ry}" x2="${rx - 12}" y2="${ry + rh}" stroke="${COLOR_BLUE}" stroke-width="1.2"/>`;
  svg += `<line x1="${rx - 18}" y1="${ry}" x2="${rx - 6}" y2="${ry}" stroke="${COLOR_BLUE}" stroke-width="1.2"/>`;
  svg += `<line x1="${rx - 18}" y1="${ry + rh}" x2="${rx - 6}" y2="${ry + rh}" stroke="${COLOR_BLUE}" stroke-width="1.2"/>`;
  annotations.push({
    text: hasRealDims ? `Ancho = ${ancho} u` : 'Altura (h)',
    svgX: rx - 16,
    svgY: ry + rh / 2,
    fontSize: 9,
    bold: true,
    color: COLOR_BLUE,
    align: 'end',
  });

  // Caja de trabajo
  svg += `<rect x="${w - 150}" y="45" width="135" height="130" fill="#f8fafc" rx="4" stroke="#94a3b8" stroke-width="1" stroke-dasharray="2,2"/>`;
  annotations.push({ text: 'CÁLCULO DEL ALUMNO', svgX: w - 82, svgY: 62, fontSize: 8.5, bold: true, color: COLOR_NAVY, align: 'center' });
  annotations.push({ text: 'Área (A = b · h):', svgX: w - 140, svgY: 80, fontSize: 8, color: '#64748b' });
  annotations.push({
    text: hasRealDims ? `A = (${largo}) · (${ancho}) = _____ u²` : 'A = b · h = _____ u²',
    svgX: w - 140,
    svgY: 94,
    fontSize: 8.5,
    bold: true,
    color: COLOR_NAVY,
  });
  annotations.push({ text: 'Perímetro (P = 2b + 2h):', svgX: w - 140, svgY: 118, fontSize: 8, color: '#64748b' });
  annotations.push({
    text: hasRealDims ? `P = 2(${largo}) + 2(${ancho}) = _____ u` : 'P = 2b + 2h = _____ u',
    svgX: w - 140,
    svgY: 132,
    fontSize: 8.5,
    bold: true,
    color: COLOR_NAVY,
  });

  return {
    svg: svg + `</svg>`,
    annotations,
    metadata: {
      type: 'stem-rectangle',
      realItemCount: hasRealDims ? 2 : 0,
      isFallback: !hasRealDims,
    },
  };
}
