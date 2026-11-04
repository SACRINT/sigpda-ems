/**
 * technical-drawing-generator.ts — Generador de Recursos Vectoriales para Dibujo Técnico I y II
 * SIGPDA-EMS · MCCEMS 2026-2027
 *
 * Generación determinística en SVG puro ($0.00 USD, 0 tokens) para:
 * 1. Montea Triplanar / Proyecciones Ortogonales Diédricas (Vistas Normalizadas: Planta, Alzado, Perfil).
 * 2. Perspectiva Isométrica Normalizada (Ejes a 30°/30°, aristas visibles y ocultas según norma ISO/NOM).
 * 3. Acotación Técnica y Normalización (Líneas de cota, flechas normalizadas, cotas de diámetro Ø y radio R).
 * 4. Construcciones Geométricas y Tangencias (Óvalo isométrico de 4 centros, puntos de tangencia).
 *
 * IMPORTANTE: Los SVGs NO contienen etiquetas <text> directas. Todo texto se genera
 * como anotaciones en el array `annotations` para que jsPDF las pinte con tipografía
 * nativa segura (evita caracteres de error □□□□ en sharp/librsvg).
 */

import type { VisualAnnotation, VisualResult } from './stem-generator';

export interface TechnicalDrawingOptions {
  width?: number;
  height?: number;
  title?: string;
  subtitle?: string;
}

const W = 500;
const H = 350;

// Paleta técnica normalizada
const COLOR_LINE_VISIBLE = '#0f172a'; // Tinta continua gruesa (contorno)
const COLOR_LINE_HIDDEN = '#64748b';  // Tinta discontinua (aristas ocultas)
const COLOR_LINE_AXIS = '#dc2626';    // Ejes de simetría (rojo técnico / trazo y punto)
const COLOR_LINE_DIM = '#2563eb';     // Cotas y auxiliares (azul técnico)
const COLOR_PROJECTION = '#94a3b8';   // Líneas de proyección y abatimiento
const COLOR_PLANE_AXIS = '#1e293b';   // Línea de Tierra (LT) y ejes de montea
const COLOR_FACE_TOP = '#f8fafc';
const COLOR_FACE_FRONT = '#e2e8f0';
const COLOR_FACE_SIDE = '#cbd5e1';

/**
 * 1. Montea Triplanar / Vistas Diédricas Ortogonales
 * Representa Planta (Superior), Alzado (Frontal), Perfil (Lateral Izquierdo) y Cuadrante de Abatimiento a 45°.
 */
export function generateMonteaTriplanar(options?: TechnicalDrawingOptions): VisualResult {
  const title = options?.title || 'Montea Triplanar: Sistema Diédrico Ortogonal';
  const annotations: VisualAnnotation[] = [];

  // Título superior
  annotations.push({
    text: title,
    svgX: W / 2,
    svgY: 22,
    fontSize: 10,
    bold: true,
    color: '#0f172a',
    align: 'center',
  });

  // Centro de la montea
  const cx = 250;
  const cy = 185;

  // Ejes cartesianos / Línea de Tierra
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;
  svg += `<rect width="${W}" height="${H}" fill="#ffffff"/>`;

  // Retícula técnica tenue de fondo
  svg += `<g stroke="#f1f5f9" stroke-width="1">`;
  for (let x = 30; x <= W - 30; x += 20) {
    svg += `<line x1="${x}" y1="35" x2="${x}" y2="${H - 20}"/>`;
  }
  for (let y = 35; y <= H - 20; y += 20) {
    svg += `<line x1="30" y1="${y}" x2="${W - 30}" y2="${y}"/>`;
  }
  svg += `</g>`;

  // Ejes de la montea (Línea de Tierra LT horizontal y eje de planos vertical)
  svg += `<line x1="40" y1="${cy}" x2="${W - 40}" y2="${cy}" stroke="${COLOR_PLANE_AXIS}" stroke-width="2"/>`;
  svg += `<line x1="${cx}" y1="40" x2="${cx}" y2="${H - 30}" stroke="${COLOR_PLANE_AXIS}" stroke-width="2"/>`;

  // Marcas de Línea de Tierra en los extremos
  svg += `<line x1="45" y1="${cy + 4}" x2="55" y2="${cy + 4}" stroke="${COLOR_PLANE_AXIS}" stroke-width="1.5"/>`;
  svg += `<line x1="${W - 55}" y1="${cy + 4}" x2="${W - 45}" y2="${cy + 4}" stroke="${COLOR_PLANE_AXIS}" stroke-width="1.5"/>`;

  // Línea de abatimiento a 45° en cuadrante inferior derecho
  svg += `<line x1="${cx}" y1="${cy}" x2="${cx + 120}" y2="${cy + 120}" stroke="${COLOR_PROJECTION}" stroke-width="1.2" stroke-dasharray="4,3"/>`;

  // --- 1. ALZADO (Frontal) en cuadrante superior izquierdo (x: 100..200, y: 70..150)
  // Pieza en L (escalón técnico)
  svg += `<polygon points="90,70 190,70 190,150 90,150" fill="${COLOR_FACE_FRONT}" stroke="${COLOR_LINE_VISIBLE}" stroke-width="2"/>`;
  svg += `<line x1="140" y1="70" x2="140" y2="110" stroke="${COLOR_LINE_VISIBLE}" stroke-width="1.5"/>`;
  svg += `<line x1="90" y1="110" x2="140" y2="110" stroke="${COLOR_LINE_VISIBLE}" stroke-width="1.5"/>`;

  // --- 2. PLANTA (Superior) en cuadrante inferior izquierdo (x: 90..190, y: 220..300)
  svg += `<polygon points="90,220 190,220 190,300 90,300" fill="${COLOR_FACE_TOP}" stroke="${COLOR_LINE_VISIBLE}" stroke-width="2"/>`;
  svg += `<line x1="140" y1="220" x2="140" y2="300" stroke="${COLOR_LINE_VISIBLE}" stroke-width="1.5"/>`;

  // --- 3. PERFIL (Lateral Izquierdo) en cuadrante superior derecho (x: 310..390, y: 70..150)
  svg += `<polygon points="310,70 390,70 390,150 310,150" fill="${COLOR_FACE_SIDE}" stroke="${COLOR_LINE_VISIBLE}" stroke-width="2"/>`;
  svg += `<line x1="310" y1="110" x2="390" y2="110" stroke="${COLOR_LINE_VISIBLE}" stroke-width="1.5"/>`;

  // Líneas de proyección (proyección continua fina ortogonal)
  svg += `<g stroke="${COLOR_PROJECTION}" stroke-width="1" stroke-dasharray="3,3">`;
  // Proyecciones horizontales Alzado -> Perfil
  svg += `<line x1="190" y1="70" x2="310" y2="70"/>`;
  svg += `<line x1="140" y1="110" x2="310" y2="110"/>`;
  svg += `<line x1="190" y1="150" x2="310" y2="150"/>`;

  // Proyecciones verticales Alzado -> Planta
  svg += `<line x1="90" y1="150" x2="90" y2="220"/>`;
  svg += `<line x1="140" y1="150" x2="140" y2="220"/>`;
  svg += `<line x1="190" y1="150" x2="190" y2="220"/>`;

  // Proyecciones Planta -> Abatimiento -> Perfil
  svg += `<line x1="190" y1="220" x2="${cx + 35}" y2="220"/>`;
  svg += `<line x1="${cx + 35}" y1="220" x2="${cx + 35}" y2="${cy + 35}"/>`;
  svg += `<line x1="${cx + 35}" y1="${cy + 35}" x2="${cx + 60}" y2="${cy + 35}"/>`;
  svg += `<line x1="190" y1="300" x2="${cx + 115}" y2="300"/>`;
  svg += `<line x1="${cx + 115}" y1="300" x2="${cx + 115}" y2="${cy + 115}"/>`;
  svg += `<line x1="${cx + 60}" y1="${cy + 60}" x2="${cx + 60}" y2="150"/>`;
  svg += `<line x1="${cx + 115}" y1="${cy + 115}" x2="${cx + 115}" y2="150"/>`;
  svg += `</g>`;

  svg += `</svg>`;

  // Anotaciones textuales
  annotations.push({
    text: 'ALZADO (VISTA FRONTAL)',
    svgX: 140,
    svgY: 55,
    fontSize: 8,
    bold: true,
    color: '#1f3864',
    align: 'center',
  });
  annotations.push({
    text: 'PERFIL IZQUIERDO',
    svgX: 350,
    svgY: 55,
    fontSize: 8,
    bold: true,
    color: '#1f3864',
    align: 'center',
  });
  annotations.push({
    text: 'PLANTA (VISTA SUPERIOR)',
    svgX: 140,
    svgY: 318,
    fontSize: 8,
    bold: true,
    color: '#1f3864',
    align: 'center',
  });
  annotations.push({
    text: 'LÍNEA DE TIERRA (LT)',
    svgX: 65,
    svgY: cy - 6,
    fontSize: 7.5,
    bold: true,
    color: '#334155',
    align: 'left',
  });
  annotations.push({
    text: 'PLANO VERTICAL (PV)',
    svgX: 235,
    svgY: 48,
    fontSize: 7,
    bold: false,
    color: '#64748b',
    align: 'end',
  });
  annotations.push({
    text: 'PLANO HORIZONTAL (PH)',
    svgX: 235,
    svgY: cy + 18,
    fontSize: 7,
    bold: false,
    color: '#64748b',
    align: 'end',
  });
  annotations.push({
    text: 'ABATIMIENTO (45°)',
    svgX: cx + 55,
    svgY: cy + 130,
    fontSize: 7,
    bold: false,
    color: '#64748b',
    align: 'center',
  });

  return {
    svg,
    annotations,
    metadata: {
      type: 'technical_drawing_montea',
      realItemCount: 4,
      isFallback: false,
    },
  };
}

/**
 * 2. Perspectiva Isométrica Normalizada
 * Prisma axonométrico normalizado a 30°/30° con aristas visibles y aristas ocultas a trazos (ISO/NOM).
 */
export function generateIsometricPrism(options?: TechnicalDrawingOptions): VisualResult {
  const title = options?.title || 'Perspectiva Isométrica Normalizada (Ejes a 30° / 30°)';
  const annotations: VisualAnnotation[] = [];

  annotations.push({
    text: title,
    svgX: W / 2,
    svgY: 22,
    fontSize: 10,
    bold: true,
    color: '#0f172a',
    align: 'center',
  });

  // Vértice central inferior de referencia
  const ox = 250;
  const oy = 250;

  // Vectores isométricos a 30° respecto a horizontal
  // cos(30°) = 0.866, sin(30°) = 0.5
  const cos30 = 0.866025;
  const sin30 = 0.5;

  const L = 140; // Longitud eje X (derecha-arriba en proyección isométrica)
  const Wd = 100; // Ancho eje Y (izquierda-arriba)
  const Ht = 110; // Altura eje Z (vertical hacia arriba)

  // Vértices del prisma base:
  // V0: origen inferior frontal (ox, oy)
  // V1: extremo eje X (ox + L*cos30, oy - L*sin30)
  // V2: extremo superior eje X (V1.x, V1.y - Ht)
  // V3: extremo eje Y (ox - Wd*cos30, oy - Wd*sin30)
  // V4: extremo superior eje Y (V3.x, V3.y - Ht)
  // V5: vértice superior frontal (ox, oy - Ht)
  // V6: vértice posterior superior (ox + L*cos30 - Wd*cos30, oy - L*sin30 - Wd*sin30 - Ht)
  // V7: vértice posterior inferior (oculto) (ox + L*cos30 - Wd*cos30, oy - L*sin30 - Wd*sin30)

  const v0 = { x: ox, y: oy };
  const v1 = { x: ox + L * cos30, y: oy - L * sin30 };
  const v2 = { x: v1.x, y: v1.y - Ht };
  const v3 = { x: ox - Wd * cos30, y: oy - Wd * sin30 };
  const v4 = { x: v3.x, y: v3.y - Ht };
  const v5 = { x: ox, y: oy - Ht };
  const v6 = { x: ox + (L - Wd) * cos30, y: oy - (L + Wd) * sin30 - Ht };
  const v7 = { x: ox + (L - Wd) * cos30, y: oy - (L + Wd) * sin30 };

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;
  svg += `<rect width="${W}" height="${H}" fill="#ffffff"/>`;

  // Ejes isométricos de guía
  svg += `<g stroke="${COLOR_LINE_DIM}" stroke-width="1.2" stroke-dasharray="5,4">`;
  // Eje vertical Z
  svg += `<line x1="${ox}" y1="${oy}" x2="${ox}" y2="${oy - Ht - 45}"/>`;
  // Eje X a 30°
  svg += `<line x1="${ox}" y1="${oy}" x2="${ox + (L + 40) * cos30}" y2="${oy - (L + 40) * sin30}"/>`;
  // Eje Y a 30°
  svg += `<line x1="${ox}" y1="${oy}" x2="${ox - (Wd + 40) * cos30}" y2="${oy - (Wd + 40) * sin30}"/>`;
  // Línea horizontal de referencia para ver el ángulo de 30°
  svg += `<line x1="${ox - 60}" y1="${oy}" x2="${ox + 60}" y2="${oy}" stroke="#94a3b8" stroke-dasharray="2,2"/>`;
  svg += `</g>`;

  // Arcos de 30°
  svg += `<path d="M ${ox + 45} ${oy} A 45 45 0 0 0 ${ox + 45 * cos30} ${oy - 45 * sin30}" fill="none" stroke="${COLOR_LINE_DIM}" stroke-width="1"/>`;
  svg += `<path d="M ${ox - 45 * cos30} ${oy - 45 * sin30} A 45 45 0 0 0 ${ox - 45} ${oy}" fill="none" stroke="${COLOR_LINE_DIM}" stroke-width="1"/>`;

  // Aristas ocultas (desde vértice v7 oculto a v3, v1 y v6)
  svg += `<g stroke="${COLOR_LINE_HIDDEN}" stroke-width="1.5" stroke-dasharray="4,3">`;
  svg += `<line x1="${v7.x}" y1="${v7.y}" x2="${v3.x}" y2="${v3.y}"/>`;
  svg += `<line x1="${v7.x}" y1="${v7.y}" x2="${v1.x}" y2="${v1.y}"/>`;
  svg += `<line x1="${v7.x}" y1="${v7.y}" x2="${v6.x}" y2="${v6.y}"/>`;
  svg += `</g>`;

  // Caras del prisma con colores volumétricos técnicos
  // Cara lateral izquierda (Y-Z)
  svg += `<polygon points="${v0.x},${v0.y} ${v3.x},${v3.y} ${v4.x},${v4.y} ${v5.x},${v5.y}" fill="${COLOR_FACE_SIDE}" fill-opacity="0.85"/>`;
  // Cara lateral derecha (X-Z)
  svg += `<polygon points="${v0.x},${v0.y} ${v1.x},${v1.y} ${v2.x},${v2.y} ${v5.x},${v5.y}" fill="${COLOR_FACE_FRONT}" fill-opacity="0.85"/>`;
  // Cara superior (X-Y)
  svg += `<polygon points="${v5.x},${v5.y} ${v4.x},${v4.y} ${v6.x},${v6.y} ${v2.x},${v2.y}" fill="${COLOR_FACE_TOP}" fill-opacity="0.95"/>`;

  // Aristas visibles continuas (trazo grueso normalizado)
  svg += `<g stroke="${COLOR_LINE_VISIBLE}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">`;
  svg += `<line x1="${v0.x}" y1="${v0.y}" x2="${v5.x}" y2="${v5.y}"/>`;
  svg += `<line x1="${v0.x}" y1="${v0.y}" x2="${v1.x}" y2="${v1.y}"/>`;
  svg += `<line x1="${v0.x}" y1="${v0.y}" x2="${v3.x}" y2="${v3.y}"/>`;
  svg += `<line x1="${v5.x}" y1="${v5.y}" x2="${v2.x}" y2="${v2.y}"/>`;
  svg += `<line x1="${v5.x}" y1="${v5.y}" x2="${v4.x}" y2="${v4.y}"/>`;
  svg += `<line x1="${v1.x}" y1="${v1.y}" x2="${v2.x}" y2="${v2.y}"/>`;
  svg += `<line x1="${v3.x}" y1="${v3.y}" x2="${v4.x}" y2="${v4.y}"/>`;
  svg += `<line x1="${v2.x}" y1="${v2.y}" x2="${v6.x}" y2="${v6.y}"/>`;
  svg += `<line x1="${v4.x}" y1="${v4.y}" x2="${v6.x}" y2="${v6.y}"/>`;
  svg += `</g>`;

  svg += `</svg>`;

  // Anotaciones
  annotations.push({
    text: 'EJE Z (ALTURA)',
    svgX: ox + 8,
    svgY: oy - Ht - 30,
    fontSize: 7.5,
    bold: true,
    color: '#2563eb',
    align: 'left',
  });
  annotations.push({
    text: 'EJE X (30°)',
    svgX: ox + (L + 25) * cos30,
    svgY: oy - (L + 25) * sin30 - 6,
    fontSize: 7.5,
    bold: true,
    color: '#2563eb',
    align: 'center',
  });
  annotations.push({
    text: 'EJE Y (30°)',
    svgX: ox - (Wd + 25) * cos30,
    svgY: oy - (Wd + 25) * sin30 - 6,
    fontSize: 7.5,
    bold: true,
    color: '#2563eb',
    align: 'center',
  });
  annotations.push({
    text: '30°',
    svgX: ox + 48,
    svgY: oy - 10,
    fontSize: 7,
    bold: true,
    color: '#1d4ed8',
    align: 'left',
  });
  annotations.push({
    text: '30°',
    svgX: ox - 48,
    svgY: oy - 10,
    fontSize: 7,
    bold: true,
    color: '#1d4ed8',
    align: 'end',
  });
  annotations.push({
    text: 'ARISTAS OCULTAS (LÍNEA DE TRAZOS)',
    svgX: v7.x - 10,
    svgY: v7.y + 16,
    fontSize: 7,
    bold: false,
    color: '#64748b',
    align: 'center',
  });

  return {
    svg,
    annotations,
    metadata: {
      type: 'technical_drawing_isometric',
      realItemCount: 3,
      isFallback: false,
    },
  };
}

/**
 * 3. Acotación y Normalización Técnica (ISO / NOM)
 * Pieza técnica con líneas de cota, flechas normalizadas de 15°, líneas auxiliares y símbolos Ø y R.
 */
export function generateTechnicalDimensioning(options?: TechnicalDrawingOptions): VisualResult {
  const title = options?.title || 'Normas de Acotación Técnica y Líneas de Cota (NOM-Z-25 / ISO)';
  const annotations: VisualAnnotation[] = [];

  annotations.push({
    text: title,
    svgX: W / 2,
    svgY: 22,
    fontSize: 10,
    bold: true,
    color: '#0f172a',
    align: 'center',
  });

  const px = 120;
  const py = 90;
  const pw = 240;
  const ph = 140;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;
  svg += `<rect width="${W}" height="${H}" fill="#ffffff"/>`;

  // Pieza con chaflán y ranura escalonada
  svg += `<polygon points="${px},${py} ${px + pw - 40},${py} ${px + pw},${py + 40} ${px + pw},${py + ph} ${px},${py + ph}" fill="#f8fafc" stroke="${COLOR_LINE_VISIBLE}" stroke-width="2.2"/>`;

  // Taladro circular central
  const holeX = px + 100;
  const holeY = py + 70;
  const holeR = 25;
  svg += `<circle cx="${holeX}" cy="${holeY}" r="${holeR}" fill="#ffffff" stroke="${COLOR_LINE_VISIBLE}" stroke-width="2"/>`;

  // Ejes de simetría del taladro (trazo largo, punto, trazo largo)
  svg += `<g stroke="${COLOR_LINE_AXIS}" stroke-width="1.2">`;
  svg += `<line x1="${holeX - 40}" y1="${holeY}" x2="${holeX + 40}" y2="${holeY}" stroke-dasharray="12,3,2,3"/>`;
  svg += `<line x1="${holeX}" y1="${holeY - 40}" x2="${holeX}" y2="${holeY + 40}" stroke-dasharray="12,3,2,3"/>`;
  svg += `</g>`;

  // 1. COTA HORIZONTAL TOTAL (Inferior: L = 240)
  const dimY = py + ph + 35;
  // Líneas auxiliares de cota
  svg += `<g stroke="${COLOR_LINE_DIM}" stroke-width="1">`;
  svg += `<line x1="${px}" y1="${py + ph + 4}" x2="${px}" y2="${dimY + 8}"/>`;
  svg += `<line x1="${px + pw}" y1="${py + ph + 4}" x2="${px + pw}" y2="${dimY + 8}"/>`;
  // Línea de cota horizontal
  svg += `<line x1="${px}" y1="${dimY}" x2="${px + pw}" y2="${dimY}"/>`;
  svg += `</g>`;
  // Flechas en extremos (15° rellenas)
  svg += `<polygon points="${px},${dimY} ${px + 10},${dimY - 3} ${px + 10},${dimY + 3}" fill="${COLOR_LINE_DIM}"/>`;
  svg += `<polygon points="${px + pw},${dimY} ${px + pw - 10},${dimY - 3} ${px + pw - 10},${dimY + 3}" fill="${COLOR_LINE_DIM}"/>`;

  // 2. COTA VERTICAL TOTAL (Izquierda: H = 140)
  const dimX = px - 35;
  svg += `<g stroke="${COLOR_LINE_DIM}" stroke-width="1">`;
  svg += `<line x1="${px - 4}" y1="${py}" x2="${dimX - 8}" y2="${py}"/>`;
  svg += `<line x1="${px - 4}" y1="${py + ph}" x2="${dimX - 8}" y2="${py + ph}"/>`;
  svg += `<line x1="${dimX}" y1="${py}" x2="${dimX}" y2="${py + ph}"/>`;
  svg += `</g>`;
  svg += `<polygon points="${dimX},${py} ${dimX - 3},${py + 10} ${dimX + 3},${py + 10}" fill="${COLOR_LINE_DIM}"/>`;
  svg += `<polygon points="${dimX},${py + ph} ${dimX - 3},${py + ph - 10} ${dimX + 3},${py + ph - 10}" fill="${COLOR_LINE_DIM}"/>`;

  // 3. COTA DE DIÁMETRO TALADRO (Inclinada a 45°)
  const radAngle = Math.PI / 4;
  const dX1 = holeX - holeR * Math.cos(radAngle);
  const dY1 = holeY + holeR * Math.sin(radAngle);
  const dX2 = holeX + holeR * Math.cos(radAngle);
  const dY2 = holeY - holeR * Math.sin(radAngle);
  const dX3 = dX2 + 35;
  const dY3 = dY2 - 20;

  svg += `<g stroke="${COLOR_LINE_DIM}" stroke-width="1">`;
  svg += `<line x1="${dX1}" y1="${dY1}" x2="${dX2}" y2="${dY2}"/>`;
  svg += `<line x1="${dX2}" y1="${dY2}" x2="${dX3}" y2="${dY3}"/>`;
  svg += `<line x1="${dX3}" y1="${dY3}" x2="${dX3 + 30}" y2="${dY3}"/>`;
  svg += `</g>`;
  svg += `<polygon points="${dX1},${dY1} ${dX1 + 8},${dY1 - 2} ${dX1 + 6},${dY1 + 6}" fill="${COLOR_LINE_DIM}"/>`;
  svg += `<polygon points="${dX2},${dY2} ${dX2 - 8},${dY2 + 2} ${dX2 - 6},${dY2 - 6}" fill="${COLOR_LINE_DIM}"/>`;

  svg += `</svg>`;

  // Anotaciones textuales
  annotations.push({
    text: '240 mm (COTA TOTAL)',
    svgX: px + pw / 2,
    svgY: dimY - 6,
    fontSize: 8,
    bold: true,
    color: '#2563eb',
    align: 'center',
  });
  annotations.push({
    text: '140 mm',
    svgX: dimX - 8,
    svgY: py + ph / 2,
    fontSize: 8,
    bold: true,
    color: '#2563eb',
    align: 'end',
  });
  annotations.push({
    text: 'Ø 50 mm',
    svgX: dX3 + 15,
    svgY: dY3 - 5,
    fontSize: 8,
    bold: true,
    color: '#2563eb',
    align: 'center',
  });
  annotations.push({
    text: 'LÍNEA AUXILIAR DE COTA',
    svgX: px - 8,
    svgY: py + ph + 22,
    fontSize: 6.5,
    bold: false,
    color: '#64748b',
    align: 'end',
  });
  annotations.push({
    text: 'EJE DE SIMETRÍA',
    svgX: holeX,
    svgY: holeY + 48,
    fontSize: 6.5,
    bold: false,
    color: '#dc2626',
    align: 'center',
  });
  annotations.push({
    text: 'CHAFLÁN 45°',
    svgX: px + pw - 15,
    svgY: py + 15,
    fontSize: 6.5,
    bold: false,
    color: '#64748b',
    align: 'left',
  });

  return {
    svg,
    annotations,
    metadata: {
      type: 'technical_drawing_dimensioning',
      realItemCount: 4,
      isFallback: false,
    },
  };
}

/**
 * 4. Trazados Geométricos Fundamentales (Óvalo Isométrico de Cuatro Centros y Tangencias)
 */
export function generateGeometricConstructions(options?: TechnicalDrawingOptions): VisualResult {
  const title = options?.title || 'Trazado Geométrico: Óvalo Isométrico por Cuatro Centros';
  const annotations: VisualAnnotation[] = [];

  annotations.push({
    text: title,
    svgX: W / 2,
    svgY: 22,
    fontSize: 10,
    bold: true,
    color: '#0f172a',
    align: 'center',
  });

  const cx = 250;
  const cy = 185;
  const r = 90;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;
  svg += `<rect width="${W}" height="${H}" fill="#ffffff"/>`;

  // Rombo isométrico de construcción
  const pA = { x: cx, y: cy - r * 0.58 };
  const pB = { x: cx + r, y: cy };
  const pC = { x: cx, y: cy + r * 0.58 };
  const pD = { x: cx - r, y: cy };

  svg += `<polygon points="${pA.x},${pA.y} ${pB.x},${pB.y} ${pC.x},${pC.y} ${pD.x},${pD.y}" fill="#f8fafc" stroke="#94a3b8" stroke-width="1.2" stroke-dasharray="3,3"/>`;

  // Líneas de centros (desde los vértices obtusos A y C a los puntos medios)
  const mAB = { x: (pA.x + pB.x) / 2, y: (pA.y + pB.y) / 2 };
  const mBC = { x: (pB.x + pC.x) / 2, y: (pB.y + pC.y) / 2 };
  const mCD = { x: (pC.x + pD.x) / 2, y: (pC.y + pD.y) / 2 };
  const mDA = { x: (pD.x + pA.x) / 2, y: (pD.y + pA.y) / 2 };

  svg += `<g stroke="${COLOR_LINE_DIM}" stroke-width="1">`;
  svg += `<line x1="${pC.x}" y1="${pC.y}" x2="${mAB.x}" y2="${mAB.y}"/>`;
  svg += `<line x1="${pC.x}" y1="${pC.y}" x2="${mDA.x}" y2="${mDA.y}"/>`;
  svg += `<line x1="${pA.x}" y1="${pA.y}" x2="${mBC.x}" y2="${mBC.y}"/>`;
  svg += `<line x1="${pA.x}" y1="${pA.y}" x2="${mCD.x}" y2="${mCD.y}"/>`;
  svg += `</g>`;

  // Curva de la elipse / óvalo (trazada continua gruesa técnica)
  svg += `<ellipse cx="${cx}" cy="${cy}" rx="${r * 0.88}" ry="${r * 0.52}" fill="none" stroke="${COLOR_LINE_VISIBLE}" stroke-width="2.5"/>`;

  // Puntos de tangencia marcados
  const tPts = [mAB, mBC, mCD, mDA];
  for (const pt of tPts) {
    svg += `<circle cx="${pt.x}" cy="${pt.y}" r="3.5" fill="${COLOR_LINE_AXIS}"/>`;
  }

  svg += `</svg>`;

  annotations.push({
    text: 'ÓVALO TÉCNICO (APROXIMACIÓN ISOMÉTRICA)',
    svgX: cx,
    svgY: cy - 4,
    fontSize: 7.5,
    bold: true,
    color: '#0f172a',
    align: 'center',
  });
  annotations.push({
    text: 'TANGENCIA T₁',
    svgX: mAB.x + 8,
    svgY: mAB.y - 4,
    fontSize: 6.5,
    bold: true,
    color: '#dc2626',
    align: 'left',
  });
  annotations.push({
    text: 'TANGENCIA T₂',
    svgX: mBC.x + 8,
    svgY: mBC.y + 8,
    fontSize: 6.5,
    bold: true,
    color: '#dc2626',
    align: 'left',
  });
  annotations.push({
    text: 'CENTRO C₁ (VÉRTICE OBTUSO)',
    svgX: pC.x,
    svgY: pC.y + 14,
    fontSize: 7,
    bold: false,
    color: '#2563eb',
    align: 'center',
  });

  return {
    svg,
    annotations,
    metadata: {
      type: 'technical_drawing_geometry',
      realItemCount: 4,
      isFallback: false,
    },
  };
}

