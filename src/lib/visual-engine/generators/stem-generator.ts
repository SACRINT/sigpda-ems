/**
 * stem-generator.ts — Generador de Recursos Gráficos Vectoriales STEM (Capa 0)
 * SIGPDA-EMS · DBEPA Puebla MCCEMS 2026-2027
 *
 * Generación determinística en SVG puro ($0.00 USD, 0 tokens) para:
 * 1. Plano Cartesiano graduado con cuadrícula milimétrica.
 * 2. Gráfica de Función Lineal y = mx + b.
 * 3. Gráfica de Función Cuadrática (Parábola) con vértice y raíces.
 * 4. Sistema de Ecuaciones Lineales 2x2 con punto de intersección.
 * 5. Triángulo con cotas geométricas y teorema de Pitágoras.
 * 6. Rectángulo con cotas y fórmulas de área/perímetro.
 */

export interface StemVisualOptions {
  width?: number;       // Ancho del viewBox en px (default: 500)
  height?: number;      // Alto del viewBox en px (default: 350)
  xMin?: number;        // Rango eje X mínimo (default: -6)
  xMax?: number;        // Rango eje X máximo (default: 6)
  yMin?: number;        // Rango eje Y mínimo (default: -5)
  yMax?: number;        // Rango eje Y máximo (default: 7)
  title?: string;       // Título superior opcional
}

// Colores Institucionales
const COLOR_NAVY = '#1f3864';      // Ejes y rótulos formales
const COLOR_BLUE = '#2563eb';      // Línea principal
const COLOR_AMBER = '#d97706';     // Parábolas
const COLOR_RED = '#dc2626';       // Segunda recta de sistema
const COLOR_GRID = '#e2e8f0';      // Cuadrícula
const COLOR_BG = '#ffffff';        // Fondo
const COLOR_TEXT = '#1e293b';      // Texto
const COLOR_MUTED = '#64748b';     // Texto secundario

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
    this.padding = 35; // Margen para números y títulos
  }

  toSvgX(x: number): number {
    const usableW = this.width - this.padding * 2;
    return this.padding + ((x - this.xMin) / (this.xMax - this.xMin)) * usableW;
  }

  toSvgY(y: number): number {
    const usableH = this.height - this.padding * 2;
    // En SVG el eje Y crece hacia abajo
    return this.height - this.padding - ((y - this.yMin) / (this.yMax - this.yMin)) * usableH;
  }
}

/**
 * Base interna para dibujar el plano cartesiano (sin cerrar </svg>).
 */
function buildCartesianPlaneBase(options: StemVisualOptions = {}): { svg: string; mapper: CoordinateMapper } {
  const mapper = new CoordinateMapper(options);
  const w = mapper.width;
  const h = mapper.height;
  const originX = mapper.toSvgX(0);
  const originY = mapper.toSvgY(0);

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" height="100%">
    <rect width="${w}" height="${h}" fill="${COLOR_BG}" rx="6" stroke="#cbd5e1" stroke-width="1"/>
  `;

  if (options.title) {
    svg += `<text x="${w / 2}" y="20" font-family="Helvetica, Arial, sans-serif" font-size="12" font-weight="bold" fill="${COLOR_NAVY}" text-anchor="middle">${options.title}</text>`;
  }

  // 1. Cuadrícula (Grid)
  svg += `<g stroke="${COLOR_GRID}" stroke-width="1" stroke-dasharray="2,2">`;
  for (let x = Math.ceil(mapper.xMin); x <= Math.floor(mapper.xMax); x++) {
    if (x === 0) continue;
    const sx = mapper.toSvgX(x);
    svg += `<line x1="${sx}" y1="${mapper.padding}" x2="${sx}" y2="${h - mapper.padding}" />`;
  }
  for (let y = Math.ceil(mapper.yMin); y <= Math.floor(mapper.yMax); y++) {
    if (y === 0) continue;
    const sy = mapper.toSvgY(y);
    svg += `<line x1="${mapper.padding}" y1="${sy}" x2="${w - mapper.padding}" y2="${sy}" />`;
  }
  svg += `</g>`;

  // 2. Ejes principales X e Y
  svg += `<g stroke="${COLOR_NAVY}" stroke-width="1.8">
    <line x1="${mapper.padding - 10}" y1="${originY}" x2="${w - mapper.padding + 10}" y2="${originY}" />
    <line x1="${originX}" y1="${h - mapper.padding + 10}" x2="${originX}" y2="${mapper.padding - 10}" />
  </g>`;

  // Flechas directrices de los ejes
  svg += `<polygon points="${w - mapper.padding + 14},${originY} ${w - mapper.padding + 6},${originY - 3.5} ${w - mapper.padding + 6},${originY + 3.5}" fill="${COLOR_NAVY}"/>`;
  svg += `<polygon points="${originX},${mapper.padding - 14} ${originX - 3.5},${mapper.padding - 6} ${originX + 3.5},${mapper.padding - 6}" fill="${COLOR_NAVY}"/>`;

  // Rótulos de los ejes
  svg += `<text x="${w - mapper.padding + 20}" y="${originY + 4}" font-family="Helvetica, Arial, sans-serif" font-size="11" font-weight="bold" fill="${COLOR_NAVY}">x</text>`;
  svg += `<text x="${originX - 4}" y="${mapper.padding - 18}" font-family="Helvetica, Arial, sans-serif" font-size="11" font-weight="bold" fill="${COLOR_NAVY}" text-anchor="middle">y</text>`;

  // 3. Ticks numéricos y etiquetas
  svg += `<g font-family="Helvetica, Arial, sans-serif" font-size="8.5" fill="${COLOR_MUTED}" text-anchor="middle">`;
  for (let x = Math.ceil(mapper.xMin); x <= Math.floor(mapper.xMax); x++) {
    if (x === 0) continue;
    const sx = mapper.toSvgX(x);
    svg += `<line x1="${sx}" y1="${originY - 3}" x2="${sx}" y2="${originY + 3}" stroke="${COLOR_NAVY}" stroke-width="1.2"/>`;
    svg += `<text x="${sx}" y="${originY + 12}">${x}</text>`;
  }
  for (let y = Math.ceil(mapper.yMin); y <= Math.floor(mapper.yMax); y++) {
    if (y === 0) continue;
    const sy = mapper.toSvgY(y);
    svg += `<line x1="${originX - 3}" y1="${sy}" x2="${originX + 3}" stroke="${COLOR_NAVY}" stroke-width="1.2"/>`;
    svg += `<text x="${originX - 10}" y="${sy + 3}" text-anchor="end">${y}</text>`;
  }
  svg += `<text x="${originX - 7}" y="${originY + 11}" font-size="8" fill="${COLOR_MUTED}">0</text>`;
  svg += `</g>`;

  return { svg, mapper };
}

/**
 * A. Plano Cartesiano Graduado con Cuadrícula
 */
export function generateCartesianPlane(options: StemVisualOptions = {}): string {
  const { svg } = buildCartesianPlaneBase(options);
  return svg + `</svg>`;
}

/**
 * B. Gráfica de Función Lineal y = mx + b
 */
export function generateLinearGraph(m = 1.5, b = 1, options: StemVisualOptions = {}): string {
  const { svg: baseSvg, mapper } = buildCartesianPlaneBase({
    ...options,
    title: options.title || `Función Lineal: f(x) = ${m}x ${b >= 0 ? '+ ' + b : '- ' + Math.abs(b)}`,
  });
  let svg = baseSvg;

  // Calcular puntos de intersección con los límites del visor
  const x1 = mapper.xMin;
  const y1 = m * x1 + b;
  const x2 = mapper.xMax;
  const y2 = m * x2 + b;

  const sx1 = mapper.toSvgX(x1);
  const sy1 = mapper.toSvgY(y1);
  const sx2 = mapper.toSvgX(x2);
  const sy2 = mapper.toSvgY(y2);

  // Línea de la función
  svg += `<line x1="${sx1}" y1="${sy1}" x2="${sx2}" y2="${sy2}" stroke="${COLOR_BLUE}" stroke-width="2.5" stroke-linecap="round"/>`;

  // Punto de corte con eje Y: (0, b)
  const interceptY_sx = mapper.toSvgX(0);
  const interceptY_sy = mapper.toSvgY(b);
  svg += `<circle cx="${interceptY_sx}" cy="${interceptY_sy}" r="4" fill="${COLOR_BLUE}" stroke="#ffffff" stroke-width="1.5"/>`;
  svg += `<text x="${interceptY_sx + 8}" y="${interceptY_sy - 5}" font-family="Helvetica, Arial, sans-serif" font-size="9" font-weight="bold" fill="${COLOR_BLUE}">Corte Y (0, ${b})</text>`;

  // Caja de ecuación y pendiente
  svg += `
    <rect x="${mapper.padding + 10}" y="${mapper.padding + 8}" width="140" height="34" fill="#eff6ff" rx="4" stroke="${COLOR_BLUE}" stroke-width="1"/>
    <text x="${mapper.padding + 18}" y="${mapper.padding + 22}" font-family="Helvetica, Arial, sans-serif" font-size="9.5" font-weight="bold" fill="${COLOR_NAVY}">y = ${m}x ${b >= 0 ? '+' : '-'} ${Math.abs(b)}</text>
    <text x="${mapper.padding + 18}" y="${mapper.padding + 34}" font-family="Helvetica, Arial, sans-serif" font-size="8" fill="${COLOR_MUTED}">Pendiente m = ${m}</text>
  `;

  svg += `</svg>`;
  return svg;
}

/**
 * C. Gráfica de Función Cuadrática (Parábola) y = ax² + bx + c
 */
export function generateQuadraticGraph(a = 1, b = 0, c = -4, options: StemVisualOptions = {}): string {
  const eqSignB = b >= 0 ? `+ ${b}x` : `- ${Math.abs(b)}x`;
  const eqSignC = c >= 0 ? `+ ${c}` : `- ${Math.abs(c)}`;
  const eqStr = `f(x) = ${a === 1 ? '' : a === -1 ? '-' : a}x² ${b !== 0 ? eqSignB : ''} ${c !== 0 ? eqSignC : ''}`;

  const { svg: baseSvg, mapper } = buildCartesianPlaneBase({
    ...options,
    title: options.title || `Función Cuadrática: ${eqStr}`,
  });
  let svg = baseSvg;

  // 1. Muestreo de puntos de la parábola
  const step = 0.1;
  const points: { x: number; y: number }[] = [];
  for (let x = mapper.xMin; x <= mapper.xMax; x += step) {
    const y = a * x * x + b * x + c;
    points.push({ x, y });
  }

  // Convertir a path SVG
  let pathD = '';
  let inBounds = false;
  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    const sx = mapper.toSvgX(pt.x);
    const sy = mapper.toSvgY(pt.y);

    // Evitar trazos que se disparen fuera de la vista
    if (pt.y >= mapper.yMin - 3 && pt.y <= mapper.yMax + 3) {
      if (!inBounds) {
        pathD += `M ${sx.toFixed(1)} ${sy.toFixed(1)} `;
        inBounds = true;
      } else {
        pathD += `L ${sx.toFixed(1)} ${sy.toFixed(1)} `;
      }
    } else {
      inBounds = false;
    }
  }

  svg += `<path d="${pathD}" fill="none" stroke="${COLOR_AMBER}" stroke-width="2.5" stroke-linecap="round"/>`;

  // 2. Vértice: h = -b / (2a), k = f(h)
  const h = -b / (2 * a);
  const k = a * h * h + b * h + c;
  if (h >= mapper.xMin && h <= mapper.xMax && k >= mapper.yMin && k <= mapper.yMax) {
    const vSx = mapper.toSvgX(h);
    const vSy = mapper.toSvgY(k);
    svg += `<circle cx="${vSx}" cy="${vSy}" r="4.5" fill="${COLOR_AMBER}" stroke="#ffffff" stroke-width="1.5"/>`;
    const labelYOffset = a > 0 ? 14 : -8;
    svg += `<text x="${vSx}" y="${vSy + labelYOffset}" font-family="Helvetica, Arial, sans-serif" font-size="9" font-weight="bold" fill="${COLOR_AMBER}" text-anchor="middle">Vértice (${h.toFixed(1)}, ${k.toFixed(1)})</text>`;
  }

  // 3. Raíces o ceros (si el discriminante >= 0)
  const disc = b * b - 4 * a * c;
  if (disc >= 0) {
    const r1 = (-b - Math.sqrt(disc)) / (2 * a);
    const r2 = (-b + Math.sqrt(disc)) / (2 * a);

    [r1, r2].forEach((r, idx) => {
      if (r >= mapper.xMin && r <= mapper.xMax) {
        const rSx = mapper.toSvgX(r);
        const rSy = mapper.toSvgY(0);
        svg += `<circle cx="${rSx}" cy="${rSy}" r="4" fill="#059669" stroke="#ffffff" stroke-width="1.5"/>`;
        svg += `<text x="${rSx}" y="${rSy - 6}" font-family="Helvetica, Arial, sans-serif" font-size="8.5" font-weight="bold" fill="#059669" text-anchor="middle">x${idx + 1}=${r.toFixed(1)}</text>`;
      }
    });
  }

  // Caja informativa
  svg += `
    <rect x="${mapper.padding + 10}" y="${mapper.padding + 8}" width="150" height="38" fill="#fffbeb" rx="4" stroke="${COLOR_AMBER}" stroke-width="1"/>
    <text x="${mapper.padding + 18}" y="${mapper.padding + 22}" font-family="Helvetica, Arial, sans-serif" font-size="9" font-weight="bold" fill="${COLOR_NAVY}">${eqStr}</text>
    <text x="${mapper.padding + 18}" y="${mapper.padding + 35}" font-family="Helvetica, Arial, sans-serif" font-size="7.5" fill="${COLOR_MUTED}">Vértice: (${h.toFixed(1)}, ${k.toFixed(1)}) | V. Min/Max</text>
  `;

  svg += `</svg>`;
  return svg;
}

/**
 * D. Sistema de Ecuaciones Lineales 2x2 con Punto de Intersección
 */
export function generateLinearSystemGraph(
  m1 = 1, b1 = -1,
  m2 = -0.5, b2 = 3.5,
  options: StemVisualOptions = {}
): string {
  const { svg: baseSvg, mapper } = buildCartesianPlaneBase({
    ...options,
    title: options.title || `Sistema de Ecuaciones: Intersección de Rectas`,
  });
  let svg = baseSvg;

  // Recta 1 (Azul)
  const r1_sx1 = mapper.toSvgX(mapper.xMin);
  const r1_sy1 = mapper.toSvgY(m1 * mapper.xMin + b1);
  const r1_sx2 = mapper.toSvgX(mapper.xMax);
  const r1_sy2 = mapper.toSvgY(m1 * mapper.xMax + b1);
  svg += `<line x1="${r1_sx1}" y1="${r1_sy1}" x2="${r1_sx2}" y2="${r1_sy2}" stroke="${COLOR_BLUE}" stroke-width="2.2" stroke-linecap="round"/>`;

  // Recta 2 (Rojo)
  const r2_sx1 = mapper.toSvgX(mapper.xMin);
  const r2_sy1 = mapper.toSvgY(m2 * mapper.xMin + b2);
  const r2_sx2 = mapper.toSvgX(mapper.xMax);
  const r2_sy2 = mapper.toSvgY(m2 * mapper.xMax + b2);
  svg += `<line x1="${r2_sx1}" y1="${r2_sy1}" x2="${r2_sx2}" y2="${r2_sy2}" stroke="${COLOR_RED}" stroke-width="2.2" stroke-linecap="round"/>`;

  // Punto de intersección: m1*x + b1 = m2*x + b2 => x = (b2 - b1) / (m1 - m2)
  if (m1 !== m2) {
    const interX = (b2 - b1) / (m1 - m2);
    const interY = m1 * interX + b1;

    if (interX >= mapper.xMin && interX <= mapper.xMax && interY >= mapper.yMin && interY <= mapper.yMax) {
      const iSx = mapper.toSvgX(interX);
      const iSy = mapper.toSvgY(interY);
      const originX = mapper.toSvgX(0);
      const originY = mapper.toSvgY(0);

      // Líneas de proyección punteadas a los ejes
      svg += `
        <line x1="${iSx}" y1="${iSy}" x2="${iSx}" y2="${originY}" stroke="${COLOR_NAVY}" stroke-width="1" stroke-dasharray="3,2"/>
        <line x1="${iSx}" y1="${iSy}" x2="${originX}" y2="${iSy}" stroke="${COLOR_NAVY}" stroke-width="1" stroke-dasharray="3,2"/>
        <circle cx="${iSx}" cy="${iSy}" r="5" fill="#7c3aed" stroke="#ffffff" stroke-width="1.8"/>
        <text x="${iSx + 8}" y="${iSy - 6}" font-family="Helvetica, Arial, sans-serif" font-size="9" font-weight="bold" fill="#7c3aed">Solución (${interX.toFixed(1)}, ${interY.toFixed(1)})</text>
      `;
    }
  }

  // Caja de leyenda
  svg += `
    <rect x="${mapper.padding + 10}" y="${mapper.padding + 8}" width="160" height="42" fill="#faf5ff" rx="4" stroke="#c084fc" stroke-width="1"/>
    <text x="${mapper.padding + 16}" y="${mapper.padding + 21}" font-family="Helvetica, Arial, sans-serif" font-size="8.5" font-weight="bold" fill="${COLOR_BLUE}">L₁: y = ${m1}x ${b1 >= 0 ? '+' : '-'} ${Math.abs(b1)}</text>
    <text x="${mapper.padding + 16}" y="${mapper.padding + 34}" font-family="Helvetica, Arial, sans-serif" font-size="8.5" font-weight="bold" fill="${COLOR_RED}">L₂: y = ${m2}x ${b2 >= 0 ? '+' : '-'} ${Math.abs(b2)}</text>
  `;

  svg += `</svg>`;
  return svg;
}

/**
 * E. Triángulo Geométrico con Cotas y Teorema de Pitágoras
 */
export function generateTriangle(catA = 4, catB = 3, hipC = 5, options: { width?: number; height?: number; title?: string } = {}): string {
  const w = options.width || 460;
  const h = options.height || 260;
  const title = options.title || 'Triángulo Rectángulo — Teorema de Pitágoras';

  // Coordenadas del triángulo
  const ox = 70;
  const oy = h - 60;
  const basePx = 220;
  const altPx = 130;

  const pA = { x: ox, y: oy };                   // Vértice ángulo recto
  const pB = { x: ox + basePx, y: oy };          // Vértice base
  const pC = { x: ox, y: oy - altPx };          // Vértice superior

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" height="100%">
    <rect width="${w}" height="${h}" fill="${COLOR_BG}" rx="6" stroke="#cbd5e1" stroke-width="1"/>
    <text x="${w / 2}" y="24" font-family="Helvetica, Arial, sans-serif" font-size="11.5" font-weight="bold" fill="${COLOR_NAVY}" text-anchor="middle">${title}</text>
  `;

  // Símbolo de ángulo recto en pA
  const sq = 14;
  svg += `<polyline points="${pA.x},${pA.y - sq} ${pA.x + sq},${pA.y - sq} ${pA.x + sq},${pA.y}" fill="none" stroke="${COLOR_NAVY}" stroke-width="1.2"/>`;

  // Triángulo
  svg += `<polygon points="${pA.x},${pA.y} ${pB.x},${pB.y} ${pC.x},${pC.y}" fill="#f0fdf4" stroke="${COLOR_NAVY}" stroke-width="2.2" stroke-linejoin="round"/>`;

  // Cotas y rótulos
  // Cateto Base (a)
  svg += `<text x="${ox + basePx / 2}" y="${oy + 18}" font-family="Helvetica, Arial, sans-serif" font-size="9.5" font-weight="bold" fill="${COLOR_BLUE}" text-anchor="middle">Cateto b = ${catB} u</text>`;
  // Cateto Altura (b)
  svg += `<text x="${ox - 14}" y="${oy - altPx / 2}" font-family="Helvetica, Arial, sans-serif" font-size="9.5" font-weight="bold" fill="${COLOR_BLUE}" text-anchor="end">Cateto a = ${catA} u</text>`;
  // Hipotenusa (c)
  const hipMidX = ox + basePx / 2 + 16;
  const hipMidY = oy - altPx / 2 - 10;
  svg += `<text x="${hipMidX}" y="${hipMidY}" font-family="Helvetica, Arial, sans-serif" font-size="9.5" font-weight="bold" fill="${COLOR_AMBER}">Hipotenusa c = ${hipC} u</text>`;

  // Caja de trabajo para el alumno
  svg += `
    <rect x="${w - 150}" y="45" width="135" height="140" fill="#f8fafc" rx="4" stroke="#94a3b8" stroke-width="1" stroke-dasharray="2,2"/>
    <text x="${w - 82}" y="62" font-family="Helvetica, Arial, sans-serif" font-size="8.5" font-weight="bold" fill="${COLOR_NAVY}" text-anchor="middle">ESPACIO DE CÁLCULO</text>
    <text x="${w - 140}" y="80" font-family="Helvetica, Arial, sans-serif" font-size="8" fill="${COLOR_MUTED}">Fórmula:</text>
    <text x="${w - 140}" y="95" font-family="Helvetica, Arial, sans-serif" font-size="8.5" font-weight="bold" fill="${COLOR_NAVY}">c² = a² + b²</text>
    <line x1="${w - 140}" y1="120" x2="${w - 25}" y2="120" stroke="#cbd5e1" stroke-width="0.8"/>
    <line x1="${w - 140}" y1="140" x2="${w - 25}" y2="140" stroke="#cbd5e1" stroke-width="0.8"/>
    <line x1="${w - 140}" y1="160" x2="${w - 25}" y2="160" stroke="#cbd5e1" stroke-width="0.8"/>
  `;

  svg += `</svg>`;
  return svg;
}

/**
 * F. Rectángulo Geométrico con Cotas de Perímetro y Área
 */
export function generateRectangle(largo = 8, ancho = 5, options: { width?: number; height?: number; title?: string } = {}): string {
  const w = options.width || 460;
  const h = options.height || 240;
  const title = options.title || 'Geometría Plana: Perímetro y Área de Cuadriláteros';

  const rx = 65;
  const ry = 60;
  const rw = 210;
  const rh = 110;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" height="100%">
    <rect width="${w}" height="${h}" fill="${COLOR_BG}" rx="6" stroke="#cbd5e1" stroke-width="1"/>
    <text x="${w / 2}" y="24" font-family="Helvetica, Arial, sans-serif" font-size="11.5" font-weight="bold" fill="${COLOR_NAVY}" text-anchor="middle">${title}</text>
  `;

  // Rectángulo principal
  svg += `<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" fill="#eff6ff" stroke="${COLOR_NAVY}" stroke-width="2" rx="2"/>`;

  // Líneas y flechas de cota superior (Largo)
  svg += `
    <line x1="${rx}" y1="${ry - 12}" x2="${rx + rw}" y2="${ry - 12}" stroke="${COLOR_BLUE}" stroke-width="1.2"/>
    <line x1="${rx}" y1="${ry - 18}" x2="${rx}" y2="${ry - 6}" stroke="${COLOR_BLUE}" stroke-width="1.2"/>
    <line x1="${rx + rw}" y1="${ry - 18}" x2="${rx + rw}" y2="${ry - 6}" stroke="${COLOR_BLUE}" stroke-width="1.2"/>
    <text x="${rx + rw / 2}" y="${ry - 16}" font-family="Helvetica, Arial, sans-serif" font-size="9" font-weight="bold" fill="${COLOR_BLUE}" text-anchor="middle">Largo (Base) = ${largo} u</text>
  `;

  // Líneas y flechas de cota lateral (Ancho)
  svg += `
    <line x1="${rx - 12}" y1="${ry}" x2="${rx - 12}" y2="${ry + rh}" stroke="${COLOR_BLUE}" stroke-width="1.2"/>
    <line x1="${rx - 18}" y1="${ry}" x2="${rx - 6}" y2="${ry}" stroke="${COLOR_BLUE}" stroke-width="1.2"/>
    <line x1="${rx - 18}" y1="${ry + rh}" x2="${rx - 6}" y2="${ry + rh}" stroke="${COLOR_BLUE}" stroke-width="1.2"/>
    <text x="${rx - 16}" y="${ry + rh / 2}" font-family="Helvetica, Arial, sans-serif" font-size="9" font-weight="bold" fill="${COLOR_BLUE}" text-anchor="end">Ancho = ${ancho} u</text>
  `;

  // Fórmulas y espacio de trabajo
  svg += `
    <rect x="${w - 150}" y="45" width="135" height="130" fill="#f8fafc" rx="4" stroke="#94a3b8" stroke-width="1" stroke-dasharray="2,2"/>
    <text x="${w - 82}" y="62" font-family="Helvetica, Arial, sans-serif" font-size="8.5" font-weight="bold" fill="${COLOR_NAVY}" text-anchor="middle">CÁLCULO DEL ALUMNO</text>
    <text x="${w - 140}" y="80" font-family="Helvetica, Arial, sans-serif" font-size="8" fill="${COLOR_MUTED}">Área (A = b · h):</text>
    <text x="${w - 140}" y="94" font-family="Helvetica, Arial, sans-serif" font-size="8.5" font-weight="bold" fill="${COLOR_NAVY}">A = (${largo}) · (${ancho}) = _____ u²</text>
    <text x="${w - 140}" y="118" font-family="Helvetica, Arial, sans-serif" font-size="8" fill="${COLOR_MUTED}">Perímetro (P = 2b + 2h):</text>
    <text x="${w - 140}" y="132" font-family="Helvetica, Arial, sans-serif" font-size="8.5" font-weight="bold" fill="${COLOR_NAVY}">P = 2(${largo}) + 2(${ancho}) = _____ u</text>
  `;

  svg += `</svg>`;
  return svg;
}
