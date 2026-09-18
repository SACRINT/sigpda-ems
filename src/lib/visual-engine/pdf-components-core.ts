/**
 * pdf-components-core.ts — Componentes Estructurales y de Maquetación V7
 * DBEPA Puebla MCCEMS 2026-2027
 *
 * Capa 4A de la Arquitectura Editorial:
 * - Sanitización y guardianes de ancho de texto
 * - Banners principales de misión
 * - Ribbons de encabezado de sección
 * - Cajas pedagógicas estructuradas (callouts)
 * - Tablas comparativas redondeadas
 * - Líneas de respuesta punteadas para escritura
 * - Cabeceras y pies de página editoriales
 */

import type jsPDF from 'jspdf';
import {
  COLOR,
  RADIUS,
  STROKE,
  SPACING,
  TYPE,
  type RGB,
} from './design-tokens';
import {
  setFontHeading,
  setFontBody,
} from './font-loader';
import { stripMarkdown } from './content-extractor';
import type { CalloutBoxData } from './callout-box';
import type { ComparisonTableData } from './comparison-table';

// Mapa de emojis a etiquetas ASCII / WinAnsi seguras
export const EMOJI_TO_TEXT: Record<string, string> = {
  '⚡': '[RELAMPAGO]',
  '💡': '[IDEA]',
  '🔬': '[LAB]',
  '⚠️': '[ALERTA]',
  '✅': '[OK]',
  '❌': '[X]',
  '🎯': '[META]',
  '📌': '[NOTA]',
  '🛡️': '[SEGURIDAD]',
  '🛡': '[SEGURIDAD]',
  '🔧': '[HERRAMIENTA]',
  '⚙️': '[AJUSTE]',
  '⚙': '[AJUSTE]',
  '🏠': '[VIDA REAL]',
  '🌱': '[ECOLOGIA]',
  '📊': '[TABLA]',
  '📋': '[REGISTRO]',
  '🔍': '[DETALLE]',
  '❓': '[PREGUNTA]',
  '❗': '[IMPORTANTE]',
};

/**
 * Sanitiza texto para PDF eliminando caracteres fuera de WinAnsi / ASCII
 */
export function sanitizePdfText(text: string | null | undefined): string {
  if (!text) return '';
  let str = text;
  for (const [emoji, replacement] of Object.entries(EMOJI_TO_TEXT)) {
    if (str.includes(emoji)) {
      str = str.split(emoji).join(replacement);
    }
  }
  return str
    .replace(/[^\x20-\x7E\xA0-\xFF\n\r\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Guardián de límites: restringe el ancho disponible restando padding de seguridad
 */
export function clampTextWidth(drawWidth: number, maxAllowed: number, padding = 0): number {
  return Math.max(10, Math.min(drawWidth, maxAllowed) - padding);
}

// ── 1. BANNER PRINCIPAL DE MISIÓN ─────────────────────────────────────────────

export interface MissionBannerOptions {
  missionNumber: number;
  title: string;
  sessionFocus?: string;
  uacLabel?: string;
  sessionsStr?: string;
  momentColor: RGB;
  margin: number;
  mainW: number;
  contentWidth: number;
  y: number;
  bannerH?: number;
}

export function drawMissionBanner(doc: jsPDF, opts: MissionBannerOptions): number {
  const {
    missionNumber,
    title,
    sessionFocus = '',
    uacLabel = 'UAC',
    sessionsStr = `${missionNumber * 2 - 1}-${missionNumber * 2}`,
    momentColor,
    margin,
    mainW,
    contentWidth,
    bannerH = 22,
  } = opts;
  const y = opts.y;

  // Título de misión en Montserrat Bold (con límite estricto dentro de mainW)
  const cleanTitle = sanitizePdfText(stripMarkdown(title)).toUpperCase();
  const bannerTitleStr = `MISIÓN ${missionNumber}: ${cleanTitle}`;
  setFontHeading(doc);
  doc.setFontSize(10.0);
  const titleLines = doc.splitTextToSize(bannerTitleStr, mainW - 28);
  const isMultiLine = titleLines.length > 1;
  const actualBannerH = isMultiLine && sessionFocus ? Math.max(bannerH, 25) : bannerH;

  // Fondo decorativo full-width
  doc.setFillColor(...momentColor);
  doc.rect(margin, y, contentWidth, actualBannerH, 'F');

  // Franja dorada de acento inferior
  doc.setFillColor(...COLOR.GOLD);
  doc.rect(margin, y + actualBannerH - 1.5, contentWidth, 1.5, 'F');

  // Número grande decorativo con opacidad
  const numStr = String(missionNumber).padStart(2, '0');
  setFontHeading(doc);
  doc.setFontSize(26);
  doc.setTextColor(255, 255, 255);
  doc.setGState(new (doc as any).GState({ opacity: 0.18 }));
  doc.text(numStr, margin + 3, y + actualBannerH - 3);
  doc.setGState(new (doc as any).GState({ opacity: 1 }));

  // Etiqueta UAC / Sesiones en píldora o texto superior
  setFontHeading(doc);
  doc.setFontSize(6.5);
  doc.setTextColor(255, 255, 255);
  doc.setGState(new (doc as any).GState({ opacity: 0.85 }));
  const cleanUac = sanitizePdfText(uacLabel.slice(0, 38));
  doc.text(`${cleanUac} · SES. ${sessionsStr}`, margin + 22, y + 6.0);
  doc.setGState(new (doc as any).GState({ opacity: 1 }));

  // Título de misión en Montserrat Bold
  setFontHeading(doc);
  doc.setFontSize(10.0);
  doc.setTextColor(255, 255, 255);
  if (isMultiLine) {
    doc.text(titleLines[0], margin + 22, y + 11.2);
    doc.text(titleLines[1], margin + 22, y + 15.8);
  } else {
    doc.text(titleLines[0], margin + 22, y + 12.8);
  }

  // Enfoque pedagógico en la base si cabe
  if (sessionFocus) {
    const focusStr = sanitizePdfText(stripMarkdown(sessionFocus)).slice(0, 65);
    setFontBody(doc, 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(255, 255, 255);
    doc.setGState(new (doc as any).GState({ opacity: 0.85 }));
    const focusY = isMultiLine ? y + 20.6 : y + actualBannerH - 3.2;
    doc.text(focusStr, margin + 22, focusY);
    doc.setGState(new (doc as any).GState({ opacity: 1 }));
  }

  return y + actualBannerH + SPACING.AFTER_SECTION;
}

// ── 2. ENCABEZADO DE SECCIÓN / RIBBON ──────────────────────────────────────────

export interface SectionRibbonOptions {
  title: string;
  margin: number;
  drawWidth: number;
  y: number;
  themeColor?: RGB;
  ribbonHeight?: number;
}

export function drawSectionRibbon(doc: jsPDF, opts: SectionRibbonOptions): number {
  const {
    title,
    margin,
    drawWidth,
    themeColor = COLOR.NAVY,
    ribbonHeight = 7.5,
  } = opts;
  const y = opts.y;

  // Fondo sutil de tarjeta con radio suave
  doc.setFillColor(...COLOR.TABLE_ALT_ROW);
  doc.roundedRect(margin, y, drawWidth, ribbonHeight, RADIUS.SM, RADIUS.SM, 'F');

  // Píldora lateral con el color temático
  doc.setFillColor(...themeColor);
  doc.roundedRect(margin, y, 4, ribbonHeight, RADIUS.SM, RADIUS.SM, 'F');

  // Borde inferior sutil
  doc.setDrawColor(...themeColor);
  doc.setLineWidth(STROKE.THIN);
  doc.line(margin + 4, y + ribbonHeight, margin + drawWidth, y + ribbonHeight);

  // Título en Montserrat Bold estilizado
  setFontHeading(doc);
  doc.setFontSize(TYPE.H3);
  doc.setTextColor(...themeColor);
  doc.text(sanitizePdfText(stripMarkdown(title)).toUpperCase(), margin + 7, y + 5.1);

  return y + ribbonHeight + SPACING.AFTER_SECTION;
}

// ── 3. CAJA PEDAGÓGICA (CALLOUT) CON BADGE TIPO PÍLDORA ───────────────────────

export function drawCalloutBox(
  doc: jsPDF,
  callout: CalloutBoxData,
  margin: number,
  drawWidth: number,
  y: number
): number {
  const barColor = (callout.accentRgb as RGB) || COLOR.TEXT_ACCENT;
  const bgColor = (callout.bgRgb as RGB) || COLOR.DIAGNOSTIC_BG;

  const rawIcon = callout.icon || '';
  const iconText = EMOJI_TO_TEXT[rawIcon] || (rawIcon ? sanitizePdfText(rawIcon) : '') || '•';
  const cleanTitle = sanitizePdfText(stripMarkdown(callout.title)).toUpperCase();
  const badgeLabel = `[ ${iconText} · ${cleanTitle} ]`;

  const cleanContent = sanitizePdfText(stripMarkdown(callout.content || callout.body || ''));
  const cleanTakeaway = callout.keyTakeaway ? sanitizePdfText(stripMarkdown(callout.keyTakeaway)) : '';

  // Guardián de texto estricto
  const safeTextWidth = clampTextWidth(drawWidth, drawWidth, 14);

  setFontBody(doc, 'normal');
  doc.setFontSize(TYPE.BODY_SM);
  const contentLines = doc.splitTextToSize(cleanContent, safeTextWidth);

  setFontBody(doc, 'normal');
  doc.setFontSize(TYPE.CAPTION);
  const takeawayLines = cleanTakeaway
    ? doc.splitTextToSize(`• Clave: ${cleanTakeaway}`, safeTextWidth)
    : [];

  const textLinesCount = contentLines.length + takeawayLines.length;
  const boxHeight = Math.max(18, 9 + textLinesCount * 3.8);

  // Fondo suave con esquinas redondeadas
  doc.setFillColor(...bgColor);
  doc.roundedRect(margin, y, drawWidth, boxHeight, RADIUS.MD, RADIUS.MD, 'F');

  // Barra de acento izquierda
  doc.setFillColor(...barColor);
  doc.roundedRect(margin, y, 3.5, boxHeight, RADIUS.SM, RADIUS.SM, 'F');

  // Borde exterior sutil
  doc.setDrawColor(...COLOR.DIVIDER);
  doc.setLineWidth(STROKE.THIN);
  doc.roundedRect(margin, y, drawWidth, boxHeight, RADIUS.MD, RADIUS.MD, 'S');

  // Badge / Título en Lato Bold
  setFontBody(doc, 'bold');
  doc.setFontSize(TYPE.BODY_SM);
  doc.setTextColor(...barColor);
  doc.text(badgeLabel, margin + 7, y + 4.8);

  // Contenido en Lato Regular
  setFontBody(doc, 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(...COLOR.TEXT_PRIMARY);
  let textY = y + 8.5;
  for (const line of contentLines) {
    doc.text(line, margin + 7, textY);
    textY += 3.7;
  }

  // Clave pedagógica complementaria
  if (takeawayLines.length > 0) {
    setFontBody(doc, 'normal');
    doc.setFontSize(TYPE.CAPTION);
    doc.setTextColor(...barColor);
    for (const line of takeawayLines) {
      doc.text(line, margin + 7, textY);
      textY += 3.5;
    }
  }

  return y + boxHeight + SPACING.PARAGRAPH;
}

// ── 4. TABLA COMPARATIVA CON FILAS ALTERNAS Y BORDES REDONDEADOS ──────────────

export function drawComparisonTable(
  doc: jsPDF,
  table: ComparisonTableData,
  margin: number,
  drawWidth: number,
  y: number
): number {
  const headers = table.headers || ['Concepto', 'Característica', 'Aplicación'];
  const rows = table.rows || [];
  const colCount = Math.max(1, headers.length);
  const colW = drawWidth / colCount;

  const headerH = 7.0;
  const rowH = 6.2;
  const totalH = headerH + rows.length * rowH;

  // Fondo de cabecera con esquinas redondeadas
  doc.setFillColor(...COLOR.TABLE_HEADER_BG);
  doc.roundedRect(margin, y, drawWidth, totalH, RADIUS.SM, RADIUS.SM, 'F');

  // Fondo blanco para cuerpo de la tabla
  doc.setFillColor(...COLOR.PAGE_BG);
  doc.roundedRect(margin, y + headerH, drawWidth, totalH - headerH, RADIUS.SM, RADIUS.SM, 'F');

  // Imprimir cabeceras
  setFontHeading(doc);
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  headers.forEach((h, ci) => {
    const cleanH = sanitizePdfText(stripMarkdown(h)).toUpperCase();
    doc.text(cleanH, margin + ci * colW + 3, y + 4.8, { maxWidth: colW - 5 });
  });

  // Filas alternas y contenido
  let ry = y + headerH;
  rows.forEach((row, ri) => {
    if (ri % 2 === 1) {
      doc.setFillColor(...COLOR.TABLE_ALT_ROW);
      doc.rect(margin, ry, drawWidth, rowH, 'F');
    }

    setFontBody(doc, 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(...COLOR.TEXT_PRIMARY);

    row.forEach((cell, ci) => {
      const cleanCell = sanitizePdfText(stripMarkdown(cell));
      doc.text(cleanCell, margin + ci * colW + 3, ry + 4.2, { maxWidth: colW - 5 });
    });

    // Línea separadora horizontal sutil
    doc.setDrawColor(...COLOR.TABLE_BORDER);
    doc.setLineWidth(STROKE.HAIRLINE);
    doc.line(margin, ry + rowH, margin + drawWidth, ry + rowH);
    ry += rowH;
  });

  // Borde perimetral exterior
  doc.setDrawColor(...COLOR.TABLE_BORDER);
  doc.setLineWidth(STROKE.THIN);
  doc.roundedRect(margin, y, drawWidth, totalH, RADIUS.SM, RADIUS.SM, 'S');

  return y + totalH + SPACING.PARAGRAPH;
}

// ── 5. LÍNEAS PUNTEADAS PARA ESCRITURA DEL ESTUDIANTE ─────────────────────────

export function drawDottedAnswerLines(
  doc: jsPDF,
  x: number,
  startY: number,
  width: number,
  count = 2,
  lineGap = 4.5
): number {
  let y = startY;
  doc.setDrawColor(...COLOR.DIVIDER);
  doc.setLineWidth(STROKE.THIN);
  doc.setLineDashPattern([1, 1.8], 0);

  for (let i = 0; i < count; i++) {
    y += lineGap;
    doc.line(x, y, x + width, y);
  }

  doc.setLineDashPattern([], 0); // Restaurar patrón sólido
  return y + 2;
}

// ── 6. CABECERA Y PIE DE PÁGINA EDITORIAL ──────────────────────────────────────

export function drawPageHeader(
  doc: jsPDF,
  opts: {
    uacName: string;
    missionTitle?: string;
    margin: number;
    contentWidth: number;
    y?: number;
    missionColor?: RGB;
    isEvenPage?: boolean;
  }
): number {
  const {
    uacName,
    missionTitle = '',
    margin,
    contentWidth,
    y = 8,
    missionColor = COLOR.NAVY,
  } = opts;

  setFontBody(doc, 'normal');
  doc.setFontSize(7.0);
  doc.setTextColor(...COLOR.TEXT_SECONDARY);

  // UAC a la izquierda
  const cleanUac = sanitizePdfText(uacName);
  const maxUacW = contentWidth * 0.45;
  let displayUac = cleanUac;
  if (doc.getTextWidth(displayUac) > maxUacW) {
    while (doc.getTextWidth(displayUac + '...') > maxUacW && displayUac.length > 5) {
      displayUac = displayUac.slice(0, -1).trim();
    }
    displayUac += '...';
  }
  doc.text(displayUac, margin, y);

  // Título de misión a la derecha si existe (con recorte de seguridad para evitar solapamiento)
  if (missionTitle) {
    const maxTitleW = contentWidth * 0.50;
    let cleanTitle = sanitizePdfText(stripMarkdown(missionTitle));
    if (doc.getTextWidth(cleanTitle) > maxTitleW) {
      while (doc.getTextWidth(cleanTitle + '...') > maxTitleW && cleanTitle.length > 5) {
        cleanTitle = cleanTitle.slice(0, -1).trim();
      }
      cleanTitle += '...';
    }
    doc.text(cleanTitle, margin + contentWidth, y, { align: 'right' });
  }

  // Línea separadora sutil
  doc.setDrawColor(...missionColor);
  doc.setLineWidth(STROKE.THIN);
  doc.line(margin, y + 2.5, margin + contentWidth, y + 2.5);

  return y + 4.5;
}

export function drawPageFooter(
  doc: jsPDF,
  opts: {
    blockName?: string;
    schoolName?: string;
    cct?: string;
    pageNum: number;
    totalPages?: number;
    margin: number;
    contentWidth: number;
    pageHeight: number;
  }
): number {
  const {
    schoolName = '',
    cct = '',
    pageNum,
    totalPages,
    margin,
    contentWidth,
    pageHeight,
  } = opts;

  const y = pageHeight - 8;

  // Línea separadora sutil superior en gris
  doc.setDrawColor(...COLOR.BORDER);
  doc.setLineWidth(STROKE.HAIRLINE);
  doc.line(margin, y - 3, margin + contentWidth, y - 3);

  setFontBody(doc, 'normal');
  doc.setFontSize(7.0);
  doc.setTextColor(...COLOR.FOOTER_TEXT);

  const pageStr = totalPages
    ? `Pág. ${pageNum} de ${totalPages}`
    : `Página ${pageNum}`;

  const schoolLabel = schoolName ? ` · ${sanitizePdfText(schoolName)}` : '';
  const cctLabel = cct ? ` (${sanitizePdfText(cct)})` : '';
  const footerText = `Cuaderno de Aprendizaje Activo · ${pageStr}${schoolLabel}${cctLabel}`;

  doc.text(footerText, margin + contentWidth / 2, y, { align: 'center' });

  return y;
}
