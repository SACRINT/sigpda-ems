/**
 * laboral-generator.ts — Generador de Recursos Gráficos Vectoriales para Formación para el Trabajo y Bachillerato Tecnológico
 * SIGPDA-EMS · SEMS Puebla MCCEMS 2026-2027
 *
 * Generación determinística en SVG puro ($0.00 USD, 0 tokens) para:
 * 1. Diagrama de Procedimiento y Flujo Técnico Operativo (generateTechnicalFlow).
 * 2. Diagrama de Bloques y Arquitectura de Sistemas (generateBlockDiagram).
 * 3. Cronograma de Operaciones / Diagrama de Gantt Técnico (generateGanttChart).
 * 4. Matriz de Seguridad Industrial, EPP y Normatividad NOM-STPS (generateSafetyChecklistVisual).
 *
 * REGLA ESTRICTA DE ARQUITECTURA:
 * Los SVGs NO contienen elementos <text>. Todo el texto se dibuja en el PDF
 * mediante jsPDF usando VisualAnnotation[] para garantizar nitidez, compatibilidad
 * multiplataforma y evitar caracteres cuadrados (□□□□) en librsvg/sharp.
 */

import type { VisualAnnotation, VisualResult } from './stem-generator';

export interface TechnicalStep {
  step: string;          // Ej: "Paso 1: Diagnóstico"
  instruction: string;   // Ej: "Inspeccionar voltajes y aislamiento térmico"
  qualityCheck?: string; // Ej: "Check: Continuidad OK"
}

export interface SystemBlock {
  title: string;
  subtitle?: string;
  role: 'input' | 'process' | 'output' | 'control';
}

export interface GanttTask {
  name: string;
  startWeek: number;     // 1-indexed (ej: 1, 2, 3...)
  durationWeeks: number; // Duración en semanas (ej: 2)
  color?: string;
  responsible?: string;
}

export interface SafetyCheck {
  category: string;      // Ej: "Equipo de Protección Personal (EPP)"
  requirement: string;   // Ej: "Uso obligatorio de pulsera antiestática aterrizada"
  standard?: string;     // Ej: "NOM-017-STPS"
  level?: 'critico' | 'precaucion' | 'informativo';
}

export interface LaboralVisualOptions {
  title?: string;
  width?: number;
  height?: number;
  totalWeeks?: number;
}

// ── Paleta Institucional Técnica MCCEMS ───────────────────────────────────────
const COLOR_NAVY = '#1f3864';
const COLOR_BLUE = '#2563eb';
const COLOR_CYAN = '#0284c7';
const COLOR_AMBER = '#d97706';
const COLOR_EMERALD = '#059669';
const COLOR_CRIMSON = '#dc2626';
const COLOR_SLATE = '#475569';
const COLOR_DARK_SLATE = '#1e293b';
const COLOR_BORDER = '#cbd5e1';
const COLOR_BG = '#ffffff';

const GANTT_COLORS = ['#2563eb', '#0284c7', '#059669', '#d97706', '#7c3aed'];

// ─────────────────────────────────────────────────────────────────────────────
// 1. DIAGRAMA DE PROCEDIMIENTO Y FLUJO TÉCNICO (generateTechnicalFlow)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Genera un flujo secuencial horizontal con tarjetas técnicas operativas,
 * casillas de verificación de calidad (Quality Checks) y flechas directivas.
 */
export function generateTechnicalFlow(
  steps: TechnicalStep[],
  options: LaboralVisualOptions = {}
): VisualResult {
  const w = options.width || 500;
  const h = options.height || 350;
  const title = options.title || 'Diagrama de Procedimiento Técnico y Control de Calidad';
  const annotations: VisualAnnotation[] = [];

  const defaultSteps: TechnicalStep[] = [
    {
      step: '1. Desconexión y EPP',
      instruction: 'Desenergizar equipo y conectar pulsera ESD a tierra física',
      qualityCheck: 'Check: Tensión 0V comprobada',
    },
    {
      step: '2. Desensamble y Aseo',
      instruction: 'Retirar cubierta y limpiar componentes con alcohol isopropílico',
      qualityCheck: 'Check: Contactos libres de polvo',
    },
    {
      step: '3. Reemplazo y Ajuste',
      instruction: 'Aplicar pasta térmica y fijar módulos con torque adecuado',
      qualityCheck: 'Check: Presión y calce firme',
    },
    {
      step: '4. Prueba de Banco',
      instruction: 'Verificar encendido y monitorizar temperaturas operativas',
      qualityCheck: 'Check: Parámetros nominales OK',
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
  const cardY = 65;
  const cardH = 195;

  const cardStyles = [
    { banner: COLOR_SLATE, bg: '#f8fafc', border: '#cbd5e1' },
    { banner: COLOR_CYAN, bg: '#f0f9ff', border: '#bae6fd' },
    { banner: COLOR_AMBER, bg: '#fffbeb', border: '#fde68a' },
    { banner: COLOR_EMERALD, bg: '#f0fdf4', border: '#a7f3d0' },
  ];

  data.forEach((item, i) => {
    const cardX = startX + i * (cardW + gap);
    const style = cardStyles[i % cardStyles.length];

    // Tarjeta técnica
    svg += `
      <!-- Tarjeta Paso ${i + 1} -->
      <rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" rx="6" fill="${style.bg}" stroke="${style.border}" stroke-width="1.5"/>
      <!-- Cabecera de paso -->
      <rect x="${cardX}" y="${cardY}" width="${cardW}" height="28" rx="6" fill="${style.banner}"/>
      <rect x="${cardX}" y="${cardY + 18}" width="${cardW}" height="10" fill="${style.banner}"/>
      <!-- Divisoria -->
      <line x1="${cardX + 8}" y1="${cardY + 125}" x2="${cardX + cardW - 8}" y2="${cardY + 125}" stroke="${style.border}" stroke-width="1"/>
      <!-- Caja de Quality Check -->
      <rect x="${cardX + 6}" y="${cardY + 135}" width="${cardW - 12}" height="48" rx="4" fill="#ffffff" stroke="${style.border}" stroke-width="1"/>
      <!-- Indicador de verificación (círculo con visto) -->
      <circle cx="${cardX + 18}" cy="${cardY + 159}" r="7" fill="${COLOR_EMERALD}"/>
      <polyline points="${cardX + 14},${cardY + 159} ${cardX + 17},${cardY + 162} ${cardX + 22},${cardY + 156}" fill="none" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    `;

    // Anotación: Cabecera Paso
    annotations.push({
      text: item.step.toUpperCase(),
      svgX: cardX + cardW / 2,
      svgY: cardY + 18,
      fontSize: 7,
      bold: true,
      color: '#ffffff',
      align: 'center',
    });

    // Anotación: Instrucción operativa (dividida en líneas si es larga)
    annotations.push({
      text: item.instruction,
      svgX: cardX + cardW / 2,
      svgY: cardY + 50,
      fontSize: 6.8,
      color: COLOR_DARK_SLATE,
      align: 'center',
    });

    // Anotación: Control de Calidad
    if (item.qualityCheck) {
      annotations.push({
        text: 'CONTROL CALIDAD',
        svgX: cardX + cardW / 2 + 6,
        svgY: cardY + 148,
        fontSize: 5.8,
        bold: true,
        color: COLOR_SLATE,
        align: 'center',
      });
      annotations.push({
        text: item.qualityCheck,
        svgX: cardX + cardW / 2 + 6,
        svgY: cardY + 163,
        fontSize: 6.2,
        bold: true,
        color: COLOR_EMERALD,
        align: 'center',
      });
    }

    // Flecha direccional hacia siguiente paso
    if (i < n - 1) {
      const arrowY = cardY + 45;
      const ax1 = cardX + cardW + 2;
      const ax2 = ax1 + gap - 4;

      svg += `
        <line x1="${ax1}" y1="${arrowY}" x2="${ax2}" y2="${arrowY}" stroke="${COLOR_CYAN}" stroke-width="2.5"/>
        <polygon points="${ax2 + 3},${arrowY} ${ax2 - 4},${arrowY - 3.5} ${ax2 - 4},${arrowY + 3.5}" fill="${COLOR_CYAN}"/>
      `;
    }
  });

  // Banner inferior de trazabilidad y norma
  const bannerY = 285;
  svg += `
    <rect x="40" y="${bannerY}" width="420" height="28" rx="4" fill="#f1f5f9" stroke="${COLOR_BORDER}" stroke-width="0.8"/>
  `;

  annotations.push({
    text: 'Norma Técnica Operativa: Inspección Visual -> Intervención Segura -> Medición -> Liberación de Equipo',
    svgX: w / 2,
    svgY: bannerY + 17,
    fontSize: 6.8,
    bold: true,
    color: COLOR_NAVY,
    align: 'center',
  });

  return { svg: svg + `</svg>`, annotations };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. DIAGRAMA DE BLOQUES Y ARQUITECTURA TÉCNICA (generateBlockDiagram)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Genera un diagrama de bloques de arquitectura de sistema:
 * Entrada (Input) ➔ Núcleo de Procesamiento / Control ➔ Salida (Output).
 */
export function generateBlockDiagram(
  blocks: SystemBlock[],
  options: LaboralVisualOptions = {}
): VisualResult {
  const w = options.width || 500;
  const h = options.height || 350;
  const title = options.title || 'Diagrama de Bloques y Arquitectura Funcional del Sistema';
  const annotations: VisualAnnotation[] = [];

  const defaultBlocks: SystemBlock[] = [
    { title: 'Entrada / Sensores', subtitle: 'Captura de señales y alimentación', role: 'input' },
    { title: 'Unidad de Proceso', subtitle: 'Controlador lógico y microprocesador', role: 'process' },
    { title: 'Módulo de Regulación', subtitle: 'Monitoreo de voltaje y realimentación', role: 'control' },
    { title: 'Salida / Actuadores', subtitle: 'Pantallas, motores e interfaces', role: 'output' },
  ];

  const data = blocks.length > 0 ? blocks : defaultBlocks;

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

  // Coordenadas de los 4 bloques principales
  // Bloque 1: Input (Izquierda)
  // Bloque 2: Process (Centro)
  // Bloque 3: Control (Arriba centro)
  // Bloque 4: Output (Derecha)

  const blockW = 105;
  const blockH = 55;

  const pInput = { x: 35, y: 145 };
  const pProcess = { x: 195, y: 145 };
  const pControl = { x: 195, y: 55 };
  const pOutput = { x: 360, y: 145 };

  // 1. Buses y flechas de conexión
  svg += `
    <!-- Bus Entrada a Proceso -->
    <line x1="${pInput.x + blockW}" y1="${pInput.y + blockH / 2}" x2="${pProcess.x}" y2="${pProcess.y + blockH / 2}" stroke="${COLOR_BLUE}" stroke-width="3"/>
    <polygon points="${pProcess.x},${pProcess.y + blockH / 2} ${pProcess.x - 7},${pProcess.y + blockH / 2 - 4} ${pProcess.x - 7},${pProcess.y + blockH / 2 + 4}" fill="${COLOR_BLUE}"/>

    <!-- Bus Proceso a Salida -->
    <line x1="${pProcess.x + blockW}" y1="${pProcess.y + blockH / 2}" x2="${pOutput.x}" y2="${pOutput.y + blockH / 2}" stroke="${COLOR_EMERALD}" stroke-width="3"/>
    <polygon points="${pOutput.x},${pOutput.y + blockH / 2} ${pOutput.x - 7},${pOutput.y + blockH / 2 - 4} ${pOutput.x - 7},${pOutput.y + blockH / 2 + 4}" fill="${COLOR_EMERALD}"/>

    <!-- Bus de Control / Retroalimentación -->
    <line x1="${pControl.x + blockW / 2}" y1="${pControl.y + blockH}" x2="${pProcess.x + blockW / 2}" y2="${pProcess.y}" stroke="${COLOR_AMBER}" stroke-width="2.5" stroke-dasharray="3,2"/>
    <polygon points="${pProcess.x + blockW / 2},${pProcess.y} ${pProcess.x + blockW / 2 - 4},${pProcess.y - 6} ${pProcess.x + blockW / 2 + 4},${pProcess.y - 6}" fill="${COLOR_AMBER}"/>

    <!-- Lazo de retorno inferior (Feedback Loop) -->
    <path d="M ${pOutput.x + blockW / 2} ${pOutput.y + blockH} L ${pOutput.x + blockW / 2} 245 L ${pProcess.x + blockW / 2} 245 L ${pProcess.x + blockW / 2} ${pProcess.y + blockH}" fill="none" stroke="#94a3b8" stroke-width="1.8" stroke-dasharray="3,2"/>
    <polygon points="${pProcess.x + blockW / 2},${pProcess.y + blockH} ${pProcess.x + blockW / 2 - 4},${pProcess.y + blockH + 6} ${pProcess.x + blockW / 2 + 4},${pProcess.y + blockH + 6}" fill="#94a3b8"/>
  `;

  // Anotación del bus de datos y feedback
  annotations.push({
    text: 'Bus de Señal',
    svgX: (pInput.x + blockW + pProcess.x) / 2,
    svgY: pInput.y + blockH / 2 - 8,
    fontSize: 6.5,
    bold: true,
    color: COLOR_BLUE,
    align: 'center',
  });
  annotations.push({
    text: 'Potencia / Salida',
    svgX: (pProcess.x + blockW + pOutput.x) / 2,
    svgY: pProcess.y + blockH / 2 - 8,
    fontSize: 6.5,
    bold: true,
    color: COLOR_EMERALD,
    align: 'center',
  });
  annotations.push({
    text: 'Lazo de Retroalimentación y Supervisión',
    svgX: (pProcess.x + blockW / 2 + pOutput.x + blockW / 2) / 2,
    svgY: 257,
    fontSize: 6.5,
    bold: true,
    color: COLOR_SLATE,
    align: 'center',
  });

  // 2. Bloques funcionales
  const blockDefs = [
    { ...data[0], pos: pInput, fill: '#f0f9ff', stroke: COLOR_BLUE, header: COLOR_BLUE },
    { ...data[1], pos: pProcess, fill: '#f8fafc', stroke: COLOR_NAVY, header: COLOR_NAVY },
    { ...data[2], pos: pControl, fill: '#fffbeb', stroke: COLOR_AMBER, header: COLOR_AMBER },
    { ...data[3], pos: pOutput, fill: '#f0fdf4', stroke: COLOR_EMERALD, header: COLOR_EMERALD },
  ];

  blockDefs.forEach((b) => {
    svg += `
      <rect x="${b.pos.x}" y="${b.pos.y}" width="${blockW}" height="${blockH}" rx="5" fill="${b.fill}" stroke="${b.stroke}" stroke-width="1.8"/>
      <rect x="${b.pos.x}" y="${b.pos.y}" width="${blockW}" height="18" rx="5" fill="${b.header}"/>
      <rect x="${b.pos.x}" y="${b.pos.y + 12}" width="${blockW}" height="6" fill="${b.header}"/>
    `;

    annotations.push({
      text: b.title.toUpperCase(),
      svgX: b.pos.x + blockW / 2,
      svgY: b.pos.y + 13,
      fontSize: 7.2,
      bold: true,
      color: '#ffffff',
      align: 'center',
    });

    if (b.subtitle) {
      annotations.push({
        text: b.subtitle,
        svgX: b.pos.x + blockW / 2,
        svgY: b.pos.y + 36,
        fontSize: 6.2,
        color: COLOR_DARK_SLATE,
        align: 'center',
      });
    }
  });

  // Panel de descripción inferior
  const panelY = 280;
  svg += `
    <rect x="35" y="${panelY}" width="430" height="38" rx="5" fill="#f8fafc" stroke="${COLOR_BORDER}" stroke-width="1"/>
  `;
  annotations.push({
    text: 'DESCRIPCIÓN DEL SISTEMA TÉCNICO',
    svgX: 50,
    svgY: panelY + 14,
    fontSize: 6.8,
    bold: true,
    color: COLOR_NAVY,
    align: 'left',
  });
  annotations.push({
    text: 'La interacción modular garantiza modularidad, mantenimiento predictivo y sustitución rápida de partes.',
    svgX: 50,
    svgY: panelY + 28,
    fontSize: 6.2,
    color: COLOR_SLATE,
    align: 'left',
  });

  return { svg: svg + `</svg>`, annotations };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. CRONOGRAMA DE OPERACIONES Y GANTT (generateGanttChart)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Genera un diagrama de Gantt técnico con tareas de taller, semanas/fases
 * de desarrollo y barras de avance proporcional.
 */
export function generateGanttChart(
  tasks: GanttTask[],
  options: LaboralVisualOptions = {}
): VisualResult {
  const w = options.width || 500;
  const h = options.height || 350;
  const totalWeeks = options.totalWeeks || 6;
  const title = options.title || 'Cronograma de Trabajo Técnico y Operaciones de Mantenimiento';
  const annotations: VisualAnnotation[] = [];

  const defaultTasks: GanttTask[] = [
    { name: '1. Diagnóstico e Inspección', startWeek: 1, durationWeeks: 2, color: '#2563eb', responsible: 'Equipo Técnico' },
    { name: '2. Cotización y Refacciones', startWeek: 2, durationWeeks: 2, color: '#0284c7', responsible: 'Almacén' },
    { name: '3. Ensamble y Mantenimiento', startWeek: 3, durationWeeks: 3, color: '#d97706', responsible: 'Taller' },
    { name: '4. Pruebas y Certificación', startWeek: 5, durationWeeks: 2, color: '#059669', responsible: 'Control Calidad' },
  ];

  const data = tasks.length > 0 ? tasks : defaultTasks;

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

  // Dimensiones de la tabla Gantt
  const labelColW = 160;
  const gridStartX = 180;
  const gridEndX = 465;
  const gridW = gridEndX - gridStartX;
  const weekColW = gridW / totalWeeks;

  const headerY = 55;
  const tableBottomY = 285;

  // Cabecera de Semanas
  svg += `
    <rect x="${gridStartX}" y="${headerY - 15}" width="${gridW}" height="20" rx="3" fill="#1f3864"/>
  `;

  for (let s = 1; s <= totalWeeks; s++) {
    const colX = gridStartX + (s - 1) * weekColW;
    // Línea de división de columna
    svg += `
      <line x1="${colX}" y1="${headerY - 15}" x2="${colX}" y2="${tableBottomY}" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="2,2"/>
    `;
    annotations.push({
      text: `Sem ${s}`,
      svgX: colX + weekColW / 2,
      svgY: headerY - 2,
      fontSize: 6.8,
      bold: true,
      color: '#ffffff',
      align: 'center',
    });
  }
  // Línea final derecha
  svg += `<line x1="${gridEndX}" y1="${headerY - 15}" x2="${gridEndX}" y2="${tableBottomY}" stroke="#cbd5e1" stroke-width="1.5"/>`;

  // Línea de separación entre etiquetas y cuadrícula
  svg += `<line x1="${gridStartX}" y1="${headerY - 15}" x2="${gridStartX}" y2="${tableBottomY}" stroke="${COLOR_SLATE}" stroke-width="1.5"/>`;

  // Tareas y barras horizontales
  const numTasks = data.length;
  const rowH = (tableBottomY - (headerY + 10)) / numTasks;
  const barH = Math.min(20, rowH * 0.55);

  data.forEach((t, i) => {
    const rowY = headerY + 10 + i * rowH;
    const barY = rowY + (rowH - barH) / 2;

    // Fondo alternado de fila
    if (i % 2 === 0) {
      svg += `<rect x="25" y="${rowY}" width="${w - 50}" height="${rowH}" fill="#f8fafc"/>`;
    }

    // Nombre de la tarea
    annotations.push({
      text: t.name,
      svgX: 35,
      svgY: barY + barH / 2 + 1,
      fontSize: 7.2,
      bold: true,
      color: COLOR_DARK_SLATE,
      align: 'left',
    });

    if (t.responsible) {
      annotations.push({
        text: `Resp: ${t.responsible}`,
        svgX: 35,
        svgY: barY + barH / 2 + 10,
        fontSize: 5.8,
        color: COLOR_SLATE,
        align: 'left',
      });
    }

    // Barra Gantt
    const clampedStart = Math.max(1, Math.min(totalWeeks, t.startWeek));
    const clampedDuration = Math.max(1, Math.min(totalWeeks - clampedStart + 1, t.durationWeeks));

    const barX = gridStartX + (clampedStart - 1) * weekColW + 2;
    const barW = clampedDuration * weekColW - 4;
    const color = t.color || GANTT_COLORS[i % GANTT_COLORS.length];

    svg += `
      <rect x="${barX}" y="${barY}" width="${barW}" height="${barH}" rx="4" fill="${color}"/>
    `;

    // Texto de duración dentro de la barra
    annotations.push({
      text: `${clampedDuration} sem`,
      svgX: barX + barW / 2,
      svgY: barY + barH / 2 + 3,
      fontSize: 6.2,
      bold: true,
      color: '#ffffff',
      align: 'center',
    });
  });

  // Pie de gráfico
  const footY = 310;
  annotations.push({
    text: 'Control de Avance Operativo: Cumplimiento de hitos por fase de mantenimiento o producción',
    svgX: w / 2,
    svgY: footY,
    fontSize: 6.5,
    bold: true,
    color: COLOR_SLATE,
    align: 'center',
  });

  return { svg: svg + `</svg>`, annotations };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. MATRIZ DE SEGURIDAD INDUSTRIAL Y NORMATIVIDAD (generateSafetyChecklistVisual)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Genera un cuadro técnico de seguridad industrial, equipo de protección
 * personal (EPP) y cumplimiento normativo NOM-STPS.
 */
export function generateSafetyChecklistVisual(
  checks: SafetyCheck[],
  options: LaboralVisualOptions = {}
): VisualResult {
  const w = options.width || 500;
  const h = options.height || 350;
  const title = options.title || 'Matriz de Seguridad Industrial y Protocolos de Taller (NOM-STPS)';
  const annotations: VisualAnnotation[] = [];

  const defaultChecks: SafetyCheck[] = [
    {
      category: 'Protección Antiestática ESD',
      requirement: 'Uso obligatorio de pulsera antiestática con resistencia de 1 MΩ conectada a tierra',
      standard: 'NOM-017-STPS',
      level: 'critico',
    },
    {
      category: 'Protección Ocular y Física',
      requirement: 'Gafas de seguridad con protección lateral y calzado con casquillo dieléctrico',
      standard: 'NOM-113-STPS',
      level: 'critico',
    },
    {
      category: 'Manejo de Sustancias Químicas',
      requirement: 'Uso de guantes de nitrilo y ventilación activa al aplicar alcohol isopropílico',
      standard: 'NOM-018-STPS',
      level: 'precaucion',
    },
    {
      category: 'Seguridad en Instalaciones Eléctricas',
      requirement: 'Comprobación de puesta a tierra física antes de energizar bancos de prueba',
      standard: 'NOM-001-SEDE',
      level: 'informativo',
    },
  ];

  const data = checks.length > 0 ? checks : defaultChecks;

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

  const count = data.length;
  const startY = 55;
  const itemH = 54;
  const gap = 8;

  const levelStyles = {
    critico: { bg: '#fef2f2', border: '#fca5a5', badge: COLOR_CRIMSON, label: 'CRÍTICO' },
    precaucion: { bg: '#fffbeb', border: '#fde68a', badge: COLOR_AMBER, label: 'PRECAUCIÓN' },
    informativo: { bg: '#f0f9ff', border: '#bae6fd', badge: COLOR_CYAN, label: 'NORMA' },
  };

  data.forEach((chk, i) => {
    const y = startY + i * (itemH + gap);
    const style = levelStyles[chk.level || 'critico'] || levelStyles.critico;

    svg += `
      <!-- Fila ${i + 1} -->
      <rect x="30" y="${y}" width="440" height="${itemH}" rx="5" fill="${style.bg}" stroke="${style.border}" stroke-width="1.2"/>
      <!-- Franja lateral de advertencia -->
      <rect x="30" y="${y}" width="8" height="${itemH}" rx="2" fill="${style.badge}"/>
      <!-- Badge de Nivel -->
      <rect x="48" y="${y + 8}" width="65" height="15" rx="3" fill="${style.badge}"/>
      <!-- Checkbox interactivo para el alumno -->
      <rect x="425" y="${y + 12}" width="28" height="28" rx="4" fill="#ffffff" stroke="${COLOR_BORDER}" stroke-width="1.5"/>
    `;

    // Anotación: Nivel
    annotations.push({
      text: style.label,
      svgX: 48 + 32,
      svgY: y + 19,
      fontSize: 6,
      bold: true,
      color: '#ffffff',
      align: 'center',
    });

    // Anotación: Categoría
    annotations.push({
      text: chk.category,
      svgX: 122,
      svgY: y + 19,
      fontSize: 7.5,
      bold: true,
      color: COLOR_DARK_SLATE,
      align: 'left',
    });

    // Anotación: Requisito
    annotations.push({
      text: chk.requirement,
      svgX: 48,
      svgY: y + 38,
      fontSize: 6.8,
      color: COLOR_SLATE,
      align: 'left',
    });

    // Anotación: Norma técnica (si existe)
    if (chk.standard) {
      svg += `
        <rect x="345" y="${y + 8}" width="68" height="15" rx="3" fill="#ffffff" stroke="${COLOR_BORDER}" stroke-width="0.8"/>
      `;
      annotations.push({
        text: chk.standard,
        svgX: 379,
        svgY: y + 19,
        fontSize: 6.2,
        bold: true,
        color: COLOR_NAVY,
        align: 'center',
      });
    }

    // Indicador visual sobre el checkbox
    annotations.push({
      text: 'Verificado',
      svgX: 439,
      svgY: y + 47,
      fontSize: 5,
      color: '#94a3b8',
      align: 'center',
    });
  });

  // Banner inferior
  const botY = startY + count * (itemH + gap) + 6;
  svg += `
    <rect x="30" y="${botY}" width="440" height="22" rx="4" fill="#f1f5f9" stroke="${COLOR_BORDER}" stroke-width="0.8"/>
  `;
  annotations.push({
    text: 'Cumplimiento Obligatorio en Talleres y Laboratorios de Educación Media Superior (STPS / MCCEMS)',
    svgX: w / 2,
    svgY: botY + 14,
    fontSize: 6.5,
    bold: true,
    color: COLOR_SLATE,
    align: 'center',
  });

  return { svg: svg + `</svg>`, annotations };
}
