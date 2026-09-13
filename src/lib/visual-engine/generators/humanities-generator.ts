/**
 * humanities-generator.ts — Generador de Recursos Gráficos Vectoriales para Humanidades y Ciencias Sociales
 * SIGPDA-EMS · DBEPA Puebla MCCEMS 2026-2027
 *
 * Generación determinística en SVG puro ($0.00 USD, 0 tokens) para:
 * 1. Línea de Tiempo Histórica (generateTimeline) con alternancia arriba/abajo.
 * 2. Mapa Conceptual Jerárquico (generateConceptMap) con niveles de nodos y enlaces.
 * 3. Diagrama de Flujo Histórico Causal (generateHistoricalFlow): Antecedentes → Detonante → Consecuencias → Conclusión.
 * 4. Gráfica Estadística Social / Demográfica (generateSocialStatsChart) con barras horizontales.
 *
 * REGLA ESTRICTA DE ARQUITECTURA:
 * Los SVGs NO contienen elementos <text>. El texto se dibuja en el PDF
 * mediante jsPDF usando las VisualAnnotation para garantizar nitidez, compatibilidad
 * multiplataforma y evitar caracteres cuadrados (□□□□) en librsvg/sharp.
 */

import type { VisualAnnotation, VisualResult } from './stem-generator';

export interface TimelineEvent {
  year: string;
  title: string;
  description: string;
}

export interface ConceptNode {
  label: string;
  level: number; // 0 = Raíz/Central, 1 = Categoría, 2 = Subconcepto/Elemento
}

export interface ConceptEdge {
  from: number; // Índice del nodo origen
  to: number;   // Índice del nodo destino
  label?: string;
}

export interface HistoricalStep {
  phase: string;
  title: string;
  detail?: string;
}

export interface SocialStatItem {
  label: string;
  value: number;
  color?: string;
}

export interface HumanitiesVisualOptions {
  title?: string;
  width?: number;
  height?: number;
  unit?: string;
}

// ── Paleta Institucional DBEPA Humanidades y Ciencias Sociales ────────────────
const COLOR_NAVY = '#1f3864';
const COLOR_MID_BLUE = '#2563eb';
const COLOR_AMBER = '#d97706';
const COLOR_EMERALD = '#059669';
const COLOR_CRIMSON = '#dc2626';
const COLOR_PURPLE = '#7c3aed';
const COLOR_SLATE = '#475569';
const COLOR_BORDER = '#cbd5e1';
const COLOR_BG = '#ffffff';

const DEFAULT_STAT_COLORS = [
  '#2563eb', // Azul
  '#d97706', // Ámbar
  '#059669', // Esmeralda
  '#7c3aed', // Púrpura
  '#dc2626', // Carmesí
  '#0891b2', // Cian
];

// ─────────────────────────────────────────────────────────────────────────────
// 1. LÍNEA DE TIEMPO HISTÓRICA (generateTimeline)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Genera una línea de tiempo horizontal con hitos circulares y postes verticales.
 * Los eventos alternan arriba y abajo del eje central para maximizar legibilidad y evitar colisiones.
 */
export function generateTimeline(
  events: TimelineEvent[],
  options: HumanitiesVisualOptions = {}
): VisualResult {
  const w = options.width || 500;
  const h = options.height || 350;
  const title = options.title || 'Línea de Tiempo Histórica: Cronología y Evolución';
  const annotations: VisualAnnotation[] = [];

  // Datos predeterminados si la lista viene vacía
  const data: TimelineEvent[] = events.length > 0 ? events : [
    { year: '1810', title: 'Inicio de la Lucha', description: 'Grito de Dolores y alzamiento insurgente' },
    { year: '1814', title: 'Constitución Apatzingán', description: 'Primer ideario republicano de Morelos' },
    { year: '1821', title: 'Consumación', description: 'Plan de Iguala y entrada del Ejército Trigarante' },
    { year: '1824', title: 'Primera República', description: 'Promulgación de la Constitución Federal' },
  ];

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" height="100%">
    <rect width="${w}" height="${h}" fill="${COLOR_BG}" rx="6" stroke="${COLOR_BORDER}" stroke-width="1"/>
  `;

  // Título del gráfico
  annotations.push({
    text: title,
    svgX: w / 2,
    svgY: 20,
    fontSize: 11,
    bold: true,
    color: COLOR_NAVY,
    align: 'center',
  });

  const axisY = 175;
  const startX = 60;
  const endX = 440;

  // Eje cronológico central
  svg += `
    <!-- Eje central -->
    <line x1="${startX - 20}" y1="${axisY}" x2="${endX + 25}" y2="${axisY}" stroke="${COLOR_NAVY}" stroke-width="3" stroke-linecap="round"/>
    <!-- Flecha cronológica -->
    <polygon points="${endX + 35},${axisY} ${endX + 23},${axisY - 6} ${endX + 23},${axisY + 6}" fill="${COLOR_NAVY}"/>
  `;

  // Anotación del eje
  annotations.push({
    text: 'Eje Cronológico ->',
    svgX: endX + 35,
    svgY: axisY + 18,
    fontSize: 6.5,
    bold: true,
    color: COLOR_SLATE,
    align: 'end',
  });

  const count = data.length;
  const stepX = count > 1 ? (endX - startX) / (count - 1) : 0;
  const cardW = Math.min(88, Math.max(70, (endX - startX) / count));
  const cardH = 68;

  data.forEach((evt, i) => {
    const cx = count === 1 ? w / 2 : startX + i * stepX;
    const isUp = i % 2 === 0;

    // Nodo en el eje
    const nodeColor = isUp ? COLOR_MID_BLUE : COLOR_AMBER;
    svg += `
      <circle cx="${cx}" cy="${axisY}" r="7" fill="${nodeColor}" stroke="#ffffff" stroke-width="2"/>
      <circle cx="${cx}" cy="${axisY}" r="3" fill="#ffffff"/>
    `;

    // Posición de la tarjeta
    const cardX = Math.max(8, Math.min(w - cardW - 8, cx - cardW / 2));

    if (isUp) {
      // Hacia ARRIBA
      const cardY = 42;
      const stemStartY = axisY - 7;
      const stemEndY = cardY + cardH;

      svg += `
        <!-- Poste vertical hacia arriba -->
        <line x1="${cx}" y1="${stemStartY}" x2="${cx}" y2="${stemEndY}" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="2,2"/>
        <circle cx="${cx}" cy="${stemEndY}" r="2.5" fill="${COLOR_MID_BLUE}"/>
        <!-- Tarjeta de evento -->
        <rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" rx="5" fill="#f8fafc" stroke="${COLOR_BORDER}" stroke-width="1"/>
        <rect x="${cardX}" y="${cardY}" width="${cardW}" height="18" rx="5" fill="${COLOR_NAVY}"/>
      `;

      // Anotaciones ARRIBA
      annotations.push({
        text: evt.year,
        svgX: cardX + cardW / 2,
        svgY: cardY + 13,
        fontSize: 8.5,
        bold: true,
        color: '#ffffff',
        align: 'center',
      });
      annotations.push({
        text: evt.title,
        svgX: cardX + cardW / 2,
        svgY: cardY + 32,
        fontSize: 7.5,
        bold: true,
        color: '#1e293b',
        align: 'center',
      });
      annotations.push({
        text: evt.description,
        svgX: cardX + cardW / 2,
        svgY: cardY + 48,
        fontSize: 6.2,
        color: '#475569',
        align: 'center',
      });
    } else {
      // Hacia ABAJO
      const cardY = 238;
      const stemStartY = axisY + 7;
      const stemEndY = cardY;

      svg += `
        <!-- Poste vertical hacia abajo -->
        <line x1="${cx}" y1="${stemStartY}" x2="${cx}" y2="${stemEndY}" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="2,2"/>
        <circle cx="${cx}" cy="${stemEndY}" r="2.5" fill="${COLOR_AMBER}"/>
        <!-- Tarjeta de evento -->
        <rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" rx="5" fill="#fffbeb" stroke="#fcd34d" stroke-width="1"/>
        <rect x="${cardX}" y="${cardY}" width="${cardW}" height="18" rx="5" fill="${COLOR_AMBER}"/>
      `;

      // Anotaciones ABAJO
      annotations.push({
        text: evt.year,
        svgX: cardX + cardW / 2,
        svgY: cardY + 13,
        fontSize: 8.5,
        bold: true,
        color: '#ffffff',
        align: 'center',
      });
      annotations.push({
        text: evt.title,
        svgX: cardX + cardW / 2,
        svgY: cardY + 32,
        fontSize: 7.5,
        bold: true,
        color: '#1e293b',
        align: 'center',
      });
      annotations.push({
        text: evt.description,
        svgX: cardX + cardW / 2,
        svgY: cardY + 48,
        fontSize: 6.2,
        color: '#475569',
        align: 'center',
      });
    }
  });

  return { svg: svg + `</svg>`, annotations };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. MAPA CONCEPTUAL JERÁRQUICO (generateConceptMap)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Genera un mapa conceptual con nodos organizados por niveles jerárquicos verticales
 * y aristas/conectores con etiquetas explicativas intermedias.
 */
export function generateConceptMap(
  nodes: ConceptNode[],
  edges: ConceptEdge[],
  options: HumanitiesVisualOptions = {}
): VisualResult {
  const w = options.width || 500;
  const h = options.height || 350;
  const title = options.title || 'Mapa Conceptual y Red de Relaciones Semánticas';
  const annotations: VisualAnnotation[] = [];

  // Nodos y aristas predeterminados si vienen vacíos
  const defaultNodes: ConceptNode[] = [
    { label: 'Estructura Social', level: 0 },
    { label: 'Instituciones', level: 1 },
    { label: 'Actores Sociales', level: 1 },
    { label: 'Normas y Leyes', level: 2 },
    { label: 'Identidad Colectiva', level: 2 },
  ];

  const defaultEdges: ConceptEdge[] = [
    { from: 0, to: 1, label: 'regula' },
    { from: 0, to: 2, label: 'integra' },
    { from: 1, to: 3, label: 'promulga' },
    { from: 2, to: 4, label: 'construye' },
  ];

  const inputNodes = nodes.length > 0 ? nodes : defaultNodes;
  const inputEdges = edges.length > 0 ? edges : defaultEdges;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" height="100%">
    <rect width="${w}" height="${h}" fill="${COLOR_BG}" rx="6" stroke="${COLOR_BORDER}" stroke-width="1"/>
  `;

  // Título
  annotations.push({
    text: title,
    svgX: w / 2,
    svgY: 20,
    fontSize: 11,
    bold: true,
    color: COLOR_NAVY,
    align: 'center',
  });

  // Agrupar nodos por nivel jerárquico
  const levelsSet = Array.from(new Set(inputNodes.map((n) => n.level))).sort((a, b) => a - b);
  const numLevels = levelsSet.length;

  // Calcular posiciones (X, Y) de cada nodo
  const nodePositions: { x: number; y: number; level: number; w: number; h: number }[] = [];

  levelsSet.forEach((lvl, lvlIdx) => {
    const lvlY = numLevels === 1 ? 175 : 65 + (lvlIdx / (numLevels - 1)) * 215;
    const nodesAtLevel = inputNodes
      .map((node, originalIndex) => ({ ...node, originalIndex }))
      .filter((n) => n.level === lvl);

    const k = nodesAtLevel.length;
    const slotW = (w - 60) / (k + 1);

    nodesAtLevel.forEach((item, colIdx) => {
      const nodeX = 30 + (colIdx + 1) * slotW;
      const nodeW = lvl === 0 ? 112 : lvl === 1 ? 96 : 86;
      const nodeH = lvl === 0 ? 36 : lvl === 1 ? 32 : 28;

      nodePositions[item.originalIndex] = {
        x: nodeX,
        y: lvlY,
        level: lvl,
        w: nodeW,
        h: nodeH,
      };
    });
  });

  // 1. Dibujar conectores/aristas (detrás de los nodos)
  svg += `<g stroke="#64748b" stroke-width="1.6" stroke-linecap="round">`;
  inputEdges.forEach((edge) => {
    const p1 = nodePositions[edge.from];
    const p2 = nodePositions[edge.to];
    if (!p1 || !p2) return;

    svg += `<line x1="${p1.x}" y1="${p1.y + p1.h / 2}" x2="${p2.x}" y2="${p2.y - p2.h / 2}" />`;

    // Etiqueta de la relación (píldora con texto)
    if (edge.label) {
      const mx = (p1.x + p2.x) / 2;
      const my = (p1.y + p1.h / 2 + p2.y - p2.h / 2) / 2;
      const pillW = Math.max(34, edge.label.length * 5.2);

      svg += `
        <rect x="${mx - pillW / 2}" y="${my - 7}" width="${pillW}" height="14" rx="4" fill="#ffffff" stroke="${COLOR_BORDER}" stroke-width="0.8"/>
      `;
      annotations.push({
        text: edge.label,
        svgX: mx,
        svgY: my + 3,
        fontSize: 6.2,
        bold: true,
        color: COLOR_SLATE,
        align: 'center',
      });
    }
  });
  svg += `</g>`;

  // 2. Dibujar nodos según su nivel
  inputNodes.forEach((node, idx) => {
    const pos = nodePositions[idx];
    if (!pos) return;

    const rx = pos.x - pos.w / 2;
    const ry = pos.y - pos.h / 2;

    if (pos.level === 0) {
      // Nivel 0: Concepto Raíz
      svg += `
        <rect x="${rx}" y="${ry}" width="${pos.w}" height="${pos.h}" rx="${pos.h / 2}" fill="${COLOR_NAVY}" stroke="#0f172a" stroke-width="2"/>
      `;
      annotations.push({
        text: node.label,
        svgX: pos.x,
        svgY: pos.y + 4,
        fontSize: 8.5,
        bold: true,
        color: '#ffffff',
        align: 'center',
      });
    } else if (pos.level === 1) {
      // Nivel 1: Categorías intermedias
      svg += `
        <rect x="${rx}" y="${ry}" width="${pos.w}" height="${pos.h}" rx="6" fill="${COLOR_MID_BLUE}" stroke="#1d4ed8" stroke-width="1.5"/>
      `;
      annotations.push({
        text: node.label,
        svgX: pos.x,
        svgY: pos.y + 4,
        fontSize: 7.5,
        bold: true,
        color: '#ffffff',
        align: 'center',
      });
    } else {
      // Nivel 2+: Subconceptos
      svg += `
        <rect x="${rx}" y="${ry}" width="${pos.w}" height="${pos.h}" rx="5" fill="#f1f5f9" stroke="${COLOR_BORDER}" stroke-width="1.5"/>
      `;
      annotations.push({
        text: node.label,
        svgX: pos.x,
        svgY: pos.y + 3.5,
        fontSize: 7,
        bold: true,
        color: '#1e293b',
        align: 'center',
      });
    }
  });

  return { svg: svg + `</svg>`, annotations };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. DIAGRAMA DE FLUJO HISTÓRICO CAUSAL (generateHistoricalFlow)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Genera un diagrama de flujo horizontal con flechas direccionales:
 * Antecedentes ➔ Detonante ➔ Consecuencias ➔ Conclusión.
 */
export function generateHistoricalFlow(
  steps: HistoricalStep[],
  options: HumanitiesVisualOptions = {}
): VisualResult {
  const w = options.width || 500;
  const h = options.height || 350;
  const title = options.title || 'Diagrama Causal de Proceso Histórico y Social';
  const annotations: VisualAnnotation[] = [];

  const defaultSteps: HistoricalStep[] = [
    {
      phase: 'Antecedentes',
      title: 'Causas Estructurales',
      detail: 'Condiciones socioeconómicas, desigualdad y tensiones institucionales acumuladas',
    },
    {
      phase: 'Detonante',
      title: 'Crisis de Ruptura',
      detail: 'Acontecimiento coyuntural que quiebra el orden y desata la movilización colectiva',
    },
    {
      phase: 'Consecuencias',
      title: 'Transformaciones',
      detail: 'Cambio de régimen, promulgación de nuevas leyes y redistribución del poder',
    },
    {
      phase: 'Conclusión',
      title: 'Legado Histórico',
      detail: 'Impacto en la memoria colectiva, derechos ciudadanos y vigencia contemporánea',
    },
  ];

  const data = steps.length > 0 ? steps : defaultSteps;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" height="100%">
    <rect width="${w}" height="${h}" fill="${COLOR_BG}" rx="6" stroke="${COLOR_BORDER}" stroke-width="1"/>
  `;

  // Título
  annotations.push({
    text: title,
    svgX: w / 2,
    svgY: 22,
    fontSize: 11,
    bold: true,
    color: COLOR_NAVY,
    align: 'center',
  });

  const n = data.length;
  const gap = 16;
  const totalW = 450;
  const cardW = Math.max(76, (totalW - (n - 1) * gap) / n);
  const startX = (w - (n * cardW + (n - 1) * gap)) / 2;
  const cardY = 70;
  const cardH = 175;

  // Estilos temáticos por fase
  const phaseStyles = [
    { header: COLOR_SLATE, bg: '#f8fafc', border: '#cbd5e1', dot: '#334155' },
    { header: COLOR_CRIMSON, bg: '#fef2f2', border: '#fca5a5', dot: '#b91c1c' },
    { header: COLOR_AMBER, bg: '#fffbeb', border: '#fcd34d', dot: '#b45309' },
    { header: COLOR_EMERALD, bg: '#f0fdf4', border: '#86efac', dot: '#047857' },
  ];

  data.forEach((step, i) => {
    const cardX = startX + i * (cardW + gap);
    const style = phaseStyles[i % phaseStyles.length];

    // Tarjeta
    svg += `
      <!-- Tarjeta ${i + 1} -->
      <rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" rx="6" fill="${style.bg}" stroke="${style.border}" stroke-width="1.5"/>
      <!-- Cabecera de fase -->
      <rect x="${cardX}" y="${cardY}" width="${cardW}" height="28" rx="6" fill="${style.header}"/>
      <rect x="${cardX}" y="${cardY + 18}" width="${cardW}" height="10" fill="${style.header}"/>
      <!-- Línea divisoria de contenido -->
      <line x1="${cardX + 8}" y1="${cardY + 68}" x2="${cardX + cardW - 8}" y2="${cardY + 68}" stroke="${style.border}" stroke-width="1"/>
      <!-- Círculo de remate inferior -->
      <circle cx="${cardX + cardW / 2}" cy="${cardY + cardH - 14}" r="5" fill="${style.dot}"/>
    `;

    // Anotación: Fase
    annotations.push({
      text: `${i + 1}. ${step.phase}`.toUpperCase(),
      svgX: cardX + cardW / 2,
      svgY: cardY + 18,
      fontSize: 7.2,
      bold: true,
      color: '#ffffff',
      align: 'center',
    });

    // Anotación: Título
    annotations.push({
      text: step.title,
      svgX: cardX + cardW / 2,
      svgY: cardY + 48,
      fontSize: 7.8,
      bold: true,
      color: '#1e293b',
      align: 'center',
    });

    // Anotación: Detalle / Descripción
    if (step.detail) {
      annotations.push({
        text: step.detail,
        svgX: cardX + cardW / 2,
        svgY: cardY + 84,
        fontSize: 6.2,
        color: '#475569',
        align: 'center',
      });
    }

    // Flecha conectora hacia la siguiente tarjeta
    if (i < n - 1) {
      const arrowY = cardY + 46;
      const ax1 = cardX + cardW + 2;
      const ax2 = ax1 + gap - 4;

      svg += `
        <line x1="${ax1}" y1="${arrowY}" x2="${ax2}" y2="${arrowY}" stroke="${COLOR_MID_BLUE}" stroke-width="2"/>
        <polygon points="${ax2 + 2},${arrowY} ${ax2 - 4},${arrowY - 3.5} ${ax2 - 4},${arrowY + 3.5}" fill="${COLOR_MID_BLUE}"/>
      `;
    }
  });

  // Caja de resumen causal inferior
  const bannerY = 275;
  svg += `
    <rect x="50" y="${bannerY}" width="400" height="28" rx="5" fill="#f1f5f9" stroke="${COLOR_BORDER}" stroke-width="0.8"/>
  `;

  annotations.push({
    text: 'Secuencia Causal: Causa Estructural -> Crisis / Detonante -> Impacto -> Trascendencia',
    svgX: w / 2,
    svgY: bannerY + 17,
    fontSize: 7.2,
    bold: true,
    color: COLOR_NAVY,
    align: 'center',
  });

  return { svg: svg + `</svg>`, annotations };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. GRÁFICA ESTADÍSTICA SOCIAL (generateSocialStatsChart)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Genera una gráfica de barras horizontales con etiquetas y valores porcentuales o absolutos.
 * Diseñada para demografía, sociología, geografía y economía moral.
 */
export function generateSocialStatsChart(
  data: SocialStatItem[],
  options: HumanitiesVisualOptions = {}
): VisualResult {
  const w = options.width || 500;
  const h = options.height || 350;
  const title = options.title || 'Indicadores Estadísticos y Variables Sociodemográficas';
  const unit = options.unit || '%';
  const annotations: VisualAnnotation[] = [];

  const defaultData: SocialStatItem[] = [
    { label: 'Población Urbana', value: 78.8, color: '#2563eb' },
    { label: 'Población Rural', value: 21.2, color: '#059669' },
    { label: 'Acceso a Servicios Básicos', value: 68.4, color: '#d97706' },
    { label: 'Población Económicamente Activa', value: 59.3, color: '#7c3aed' },
    { label: 'Cobertura Educativa EMS', value: 84.5, color: '#dc2626' },
  ];

  const items = data.length > 0 ? data : defaultData;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" height="100%">
    <rect width="${w}" height="${h}" fill="${COLOR_BG}" rx="6" stroke="${COLOR_BORDER}" stroke-width="1"/>
  `;

  // Título
  annotations.push({
    text: title,
    svgX: w / 2,
    svgY: 22,
    fontSize: 11,
    bold: true,
    color: COLOR_NAVY,
    align: 'center',
  });

  // Unidad de medida
  annotations.push({
    text: `Unidad: ${unit}`,
    svgX: 465,
    svgY: 42,
    fontSize: 7,
    bold: true,
    color: COLOR_SLATE,
    align: 'end',
  });

  // Dimensiones del área de trazado
  const originX = 150; // Margen izquierdo amplio para nombres de variables
  const chartEndX = 450;
  const chartW = chartEndX - originX;
  const chartTopY = 55;
  const chartBottomY = 285;

  // Calcular valor máximo para escalar
  const maxRaw = Math.max(...items.map((it) => it.value), 1);
  const maxVal = maxRaw <= 50 ? 50 : maxRaw <= 100 ? 100 : Math.ceil(maxRaw / 50) * 50;

  // Cuadrícula y graduaciones verticales
  const ticks = [0, maxVal * 0.25, maxVal * 0.5, maxVal * 0.75, maxVal];

  svg += `<g stroke="#e2e8f0" stroke-width="1" stroke-dasharray="2,2">`;
  ticks.forEach((t) => {
    const tx = originX + (t / maxVal) * chartW;
    svg += `<line x1="${tx}" y1="${chartTopY}" x2="${tx}" y2="${chartBottomY}" />`;
    annotations.push({
      text: String(Math.round(t)),
      svgX: tx,
      svgY: chartBottomY + 14,
      fontSize: 6.8,
      color: '#94a3b8',
      align: 'center',
    });
  });
  svg += `</g>`;

  // Ejes cartesianos principales
  svg += `
    <!-- Eje vertical Y -->
    <line x1="${originX}" y1="${chartTopY}" x2="${originX}" y2="${chartBottomY}" stroke="${COLOR_SLATE}" stroke-width="1.5"/>
    <!-- Eje horizontal X -->
    <line x1="${originX}" y1="${chartBottomY}" x2="${chartEndX}" y2="${chartBottomY}" stroke="${COLOR_SLATE}" stroke-width="1.5"/>
  `;

  // Dibujar barras horizontales
  const count = items.length;
  const slotH = (chartBottomY - chartTopY) / count;
  const barH = Math.min(22, slotH * 0.65);

  items.forEach((item, idx) => {
    const barY = chartTopY + idx * slotH + (slotH - barH) / 2;
    const barW = Math.max(3, (item.value / maxVal) * chartW);
    const color = item.color || DEFAULT_STAT_COLORS[idx % DEFAULT_STAT_COLORS.length];

    svg += `
      <rect x="${originX}" y="${barY}" width="${barW}" height="${barH}" rx="3" fill="${color}"/>
    `;

    // Etiqueta a la izquierda
    annotations.push({
      text: item.label,
      svgX: originX - 8,
      svgY: barY + barH / 2 + 3,
      fontSize: 7.5,
      bold: true,
      color: '#1e293b',
      align: 'end',
    });

    // Valor a la derecha de la barra
    const valText = `${item.value}${unit === '%' ? '%' : ' ' + unit}`;
    annotations.push({
      text: valText,
      svgX: originX + barW + 6,
      svgY: barY + barH / 2 + 3,
      fontSize: 7.2,
      bold: true,
      color: '#1e293b',
      align: 'left',
    });
  });

  // Pie de gráfico
  annotations.push({
    text: 'Fuente: Indicadores de contexto sociodemográfico y diagnóstico comunitario DBEPA-MCCEMS',
    svgX: w / 2,
    svgY: 330,
    fontSize: 6.5,
    color: '#94a3b8',
    align: 'center',
  });

  return { svg: svg + `</svg>`, annotations };
}
