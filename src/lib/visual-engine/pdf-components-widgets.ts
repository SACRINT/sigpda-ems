/**
 * pdf-components-widgets.ts — Widgets Pedagógicos y de Sidebar V7
 * DBEPA Puebla MCCEMS 2026-2027
 *
 * Capa 4B de la Arquitectura Editorial:
 * - Evaluación diagnóstica de saberes previos situada
 * - Semáforo de aprendizaje metacognitivo (3 columnas horizontales)
 * - Widgets dinámicos de sidebar:
 *   - Glosario clave
 *   - Conexión con vida diaria
 *   - Pista de seguridad de taller / NOMs
 *   - Badges de encabezado de fase
 *   - Idea fuerza / analogía
 *   - Estudio activo
 *   - QR de validación y recursos digitales
 *   - Bitácora de taller / notas con líneas pautadas
 *   - Lista de cotejo / checklist de criterios de logro
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
import { stripMarkdown, type GlossaryItem } from './content-extractor';
import { sanitizePdfText } from './pdf-components-core';
import type { DetectedObject } from './object-extractor';

// ── 1. SECCIÓN DE EVALUACIÓN DIAGNÓSTICA ───────────────────────────────────────

export interface DiagnosticData {
  context?: string;
  questions: string[];
}

export function drawDiagnosticSection(
  doc: jsPDF,
  diagnostic: DiagnosticData,
  margin: number,
  drawWidth: number,
  y: number
): number {
  const diagContext = sanitizePdfText(stripMarkdown(diagnostic.context || ''));
  const diagQs = diagnostic.questions.slice(0, 3);

  setFontBody(doc, 'normal');
  doc.setFontSize(7.0);
  const diagContextLines = doc.splitTextToSize(diagContext, drawWidth - 14);

  setFontBody(doc, 'bold');
  doc.setFontSize(7.2);
  const diagQLines = diagQs.map((q) =>
    doc.splitTextToSize(sanitizePdfText(stripMarkdown(q)), drawWidth - 16)
  );

  const diagTotalLines = diagContextLines.length + diagQLines.reduce((a, ls) => a + ls.length, 0);
  const diagBoxH = Math.max(28, 10 + diagTotalLines * 3.8 + diagQs.length * 6);

  // Fondo azul muy suave con borde izquierdo
  doc.setFillColor(...COLOR.DIAGNOSTIC_BG);
  doc.roundedRect(margin, y, drawWidth, diagBoxH, RADIUS.MD, RADIUS.MD, 'F');
  doc.setFillColor(...COLOR.DIAGNOSTIC_BORDER);
  doc.roundedRect(margin, y, 3.5, diagBoxH, RADIUS.SM, RADIUS.SM, 'F');
  doc.setDrawColor(...COLOR.DIVIDER);
  doc.setLineWidth(STROKE.THIN);
  doc.roundedRect(margin, y, drawWidth, diagBoxH, RADIUS.MD, RADIUS.MD, 'S');

  // Encabezado de diagnóstica en Montserrat Bold
  setFontHeading(doc);
  doc.setFontSize(TYPE.SIDEBAR_TITLE);
  doc.setTextColor(...COLOR.DIAGNOSTIC_BORDER);
  doc.text('EVALUACIÓN DIAGNÓSTICA: SABERES PREVIOS SITUADOS', margin + 6, y + 5);

  // Contexto en Lato Regular
  setFontBody(doc, 'normal');
  doc.setFontSize(7.0);
  doc.setTextColor(...COLOR.TEXT_PRIMARY);
  let dy = y + 8.5;
  diagContextLines.forEach((cl: string) => {
    if (dy + 3.5 < y + diagBoxH - 2) {
      doc.text(cl, margin + 6, dy);
      dy += 3.5;
    }
  });
  dy += 2;

  // Preguntas numeradas con líneas de respuesta
  diagQs.forEach((q, qi) => {
    const qLines = diagQLines[qi];
    if (dy + 3.5 * qLines.length + 8 > y + diagBoxH - 2) return;

    setFontBody(doc, 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(...COLOR.NAVY);
    doc.text(`${qi + 1}.`, margin + 6, dy + 3);

    setFontBody(doc, 'normal');
    doc.setTextColor(...COLOR.TEXT_PRIMARY);
    qLines.forEach((ql: string, qli: number) => {
      doc.text(ql, margin + 11, dy + 3 + qli * 3.5);
    });
    dy += qLines.length * 3.5 + 2;

    // Línea punteada de respuesta
    doc.setDrawColor(...COLOR.DIVIDER);
    doc.setLineDashPattern([1, 1.5], 0);
    doc.line(margin + 11, dy + 2.5, margin + drawWidth - 6, dy + 2.5);
    doc.setLineDashPattern([], 0);
    dy += 5;
  });

  return y + diagBoxH + SPACING.AFTER_SECTION;
}

// ── 2. SEMÁFORO METACOGNITIVO (3 COLUMNAS HORIZONTALES) ─────────────────────────

export interface MetacognitiveTrafficLightData {
  green: string;
  yellow: string;
  red: string;
}

export function drawMetacognitiveLight(
  doc: jsPDF,
  trafficLight: MetacognitiveTrafficLightData,
  margin: number,
  drawWidth: number,
  y: number
): number {
  const semBoxH = 34;
  const colW3 = Math.floor((drawWidth - 6) / 3);

  // Contenedor principal suave
  doc.setFillColor(...COLOR.TABLE_ALT_ROW);
  doc.roundedRect(margin, y, drawWidth, semBoxH, RADIUS.MD, RADIUS.MD, 'F');
  doc.setFillColor(...COLOR.MISSION[2]); // Esmeralda / Metacognición
  doc.roundedRect(margin, y, 3.5, semBoxH, RADIUS.SM, RADIUS.SM, 'F');
  doc.setDrawColor(...COLOR.DIVIDER);
  doc.setLineWidth(STROKE.THIN);
  doc.roundedRect(margin, y, drawWidth, semBoxH, RADIUS.MD, RADIUS.MD, 'S');

  // Encabezado
  setFontHeading(doc);
  doc.setFontSize(TYPE.SIDEBAR_TITLE);
  doc.setTextColor(...COLOR.MISSION[2]);
  doc.text('SEMÁFORO DE APRENDIZAJE: AUTOEVALUACIÓN METACOGNITIVA', margin + 6, y + 4.8);

  const colTop = y + 7.5;
  const colH = semBoxH - 9.5;

  setFontBody(doc, 'normal');
  doc.setFontSize(6.5);
  const greenLines = doc.splitTextToSize(sanitizePdfText(stripMarkdown(trafficLight.green)), colW3 - 4);
  const yellowLines = doc.splitTextToSize(sanitizePdfText(stripMarkdown(trafficLight.yellow)), colW3 - 4);
  const redLines = doc.splitTextToSize(sanitizePdfText(stripMarkdown(trafficLight.red)), colW3 - 4);

  // Configuración de las 3 columnas
  const cols = [
    {
      x: margin + 2,
      bg: COLOR.SEM_GREEN_BG,
      acc: COLOR.SEM_GREEN_ACC,
      label: 'LO LOGRÉ',
      lines: greenLines,
    },
    {
      x: margin + 2 + colW3 + 1,
      bg: COLOR.SEM_YELLOW_BG,
      acc: COLOR.SEM_YELLOW_ACC,
      label: 'EN PROCESO',
      lines: yellowLines,
    },
    {
      x: margin + 2 + (colW3 + 1) * 2,
      bg: COLOR.SEM_RED_BG,
      acc: COLOR.SEM_RED_ACC,
      label: 'NECESITO APOYO',
      lines: redLines,
    },
  ];

  cols.forEach((col) => {
    // Fondo de tarjeta redondeada
    doc.setFillColor(...col.bg);
    doc.roundedRect(col.x, colTop, colW3, colH, RADIUS.SM, RADIUS.SM, 'F');

    // Círculo del semáforo
    doc.setFillColor(...col.acc);
    doc.circle(col.x + colW3 / 2, colTop + 3.8, 2.2, 'F');

    // Etiqueta del nivel en Montserrat Bold
    setFontHeading(doc);
    doc.setFontSize(6.5);
    doc.setTextColor(...col.acc);
    doc.text(col.label, col.x + colW3 / 2, colTop + 8.5, { align: 'center' });

    // Descripción del criterio en Lato Regular
    setFontBody(doc, 'normal');
    doc.setFontSize(5.8);
    doc.setTextColor(...COLOR.TEXT_PRIMARY);
    let ly = colTop + 12;
    col.lines.slice(0, 3).forEach((line: string) => {
      doc.text(line, col.x + colW3 / 2, ly, { align: 'center' });
      ly += 3.0;
    });

    // Casilla de verificación de autoevaluación
    doc.setDrawColor(...col.acc);
    doc.setLineWidth(STROKE.THIN);
    doc.rect(col.x + colW3 / 2 - 3.5, colTop + colH - 4.2, 7, 3, 'S');
  });

  return y + semBoxH + SPACING.AFTER_SECTION;
}

// ── 3. WIDGETS DE SIDEBAR (GLOSARIO, VIDA REAL, SEGURIDAD) ────────────────────

export function drawGlossaryWidget(
  doc: jsPDF,
  terms: GlossaryItem[],
  sideXAbs: number,
  sideW: number,
  startY: number,
  sideBottom: number
): number {
  let sy = startY;
  if (!terms || terms.length === 0 || sy + 20 >= sideBottom) return sy;

  // Mini banner de glosario
  doc.setFillColor(...COLOR.TABLE_ALT_ROW);
  doc.roundedRect(sideXAbs, sy, sideW, 5.5, RADIUS.SM, RADIUS.SM, 'F');
  doc.setFillColor(...COLOR.GLOSSARY_ACCENT);
  doc.roundedRect(sideXAbs, sy, 2.5, 5.5, RADIUS.SM, RADIUS.SM, 'F');

  setFontHeading(doc);
  doc.setFontSize(TYPE.SIDEBAR_BODY);
  doc.setTextColor(...COLOR.GLOSSARY_ACCENT);
  doc.text('GLOSARIO CLAVE', sideXAbs + 4.5, sy + 3.8);
  sy += 7;

  const termsToShow = terms.slice(0, 4);
  for (const t of termsToShow) {
    if (sy + 10 > sideBottom) break;
    const cleanTerm = sanitizePdfText(stripMarkdown(t.term));
    const cleanDef = sanitizePdfText(stripMarkdown(t.definition));

    setFontBody(doc, 'normal');
    doc.setFontSize(5.8);
    const defLines = doc.splitTextToSize(cleanDef, sideW - 4);
    const entryH = Math.max(8, 4.5 + defLines.length * 3.2);
    if (sy + entryH > sideBottom) break;

    setFontBody(doc, 'bold');
    doc.setFontSize(6.2);
    doc.setTextColor(...COLOR.NAVY);
    doc.text(`• ${cleanTerm}`, sideXAbs + 2, sy + 3.2);
    sy += 3.8;

    setFontBody(doc, 'normal');
    doc.setFontSize(5.8);
    doc.setTextColor(...COLOR.TEXT_PRIMARY);
    defLines.slice(0, 3).forEach((dl: string, i: number) => {
      if (sy + 3.2 < sideBottom) {
        doc.text(dl, sideXAbs + 3, sy + i * 3.2);
      }
    });
    sy += Math.min(3, defLines.length) * 3.2 + 2;
  }

  return sy + 3;
}

export function drawRealLifeWidget(
  doc: jsPDF,
  connection: { conceptName?: string; householdApplication: string; localExample?: string },
  sideXAbs: number,
  sideW: number,
  startY: number,
  sideBottom: number
): number {
  let sy = startY;
  if (!connection || sy + 22 >= sideBottom) return sy;

  const bodyText = sanitizePdfText(stripMarkdown(connection.householdApplication));
  setFontBody(doc, 'normal');
  doc.setFontSize(5.8);
  const bodyLines = doc.splitTextToSize(bodyText, sideW - 4);
  const headerH = 5.5;
  const cardH = headerH + Math.min(4, bodyLines.length) * 3.2 + 8;

  if (sy + cardH < sideBottom) {
    doc.setFillColor(...COLOR.GOLD_LIGHT);
    doc.roundedRect(sideXAbs, sy, sideW, cardH, RADIUS.SM, RADIUS.SM, 'F');
    doc.setFillColor(...COLOR.REAL_LIFE_ACCENT);
    doc.roundedRect(sideXAbs, sy, 2.5, cardH, RADIUS.SM, RADIUS.SM, 'F');
    doc.setDrawColor(...COLOR.GOLD);
    doc.setLineWidth(STROKE.HAIRLINE);
    doc.roundedRect(sideXAbs, sy, sideW, cardH, RADIUS.SM, RADIUS.SM, 'S');

    setFontHeading(doc);
    doc.setFontSize(6);
    doc.setTextColor(...COLOR.REAL_LIFE_ACCENT);
    doc.text('CONEXIÓN CON TU VIDA DIARIA', sideXAbs + 4, sy + 4);
    sy += headerH + 2;

    setFontBody(doc, 'normal');
    doc.setFontSize(5.8);
    doc.setTextColor(...COLOR.TEXT_PRIMARY);
    bodyLines.slice(0, 4).forEach((bl: string, i: number) => {
      if (sy + 3.2 < sideBottom) doc.text(bl, sideXAbs + 4, sy + i * 3.2);
    });
    sy += Math.min(4, bodyLines.length) * 3.2 + 3;
  }

  return sy;
}

export function drawSafetyWidget(
  doc: jsPDF,
  tip: string,
  sideXAbs: number,
  sideW: number,
  startY: number,
  sideBottom: number
): number {
  let sy = startY;
  if (!tip || sy + 18 >= sideBottom) return sy;

  const tipText = sanitizePdfText(stripMarkdown(tip));
  setFontBody(doc, 'normal');
  doc.setFontSize(5.8);
  const tipLines = doc.splitTextToSize(tipText, sideW - 4);
  const tipCardH = 5.5 + Math.min(4, tipLines.length) * 3.2 + 5;

  if (sy + tipCardH < sideBottom) {
    doc.setFillColor(...COLOR.SAFETY_BG);
    doc.roundedRect(sideXAbs, sy, sideW, tipCardH, RADIUS.SM, RADIUS.SM, 'F');
    doc.setFillColor(...COLOR.SAFETY_ACCENT);
    doc.roundedRect(sideXAbs, sy, 2.5, tipCardH, RADIUS.SM, RADIUS.SM, 'F');

    setFontHeading(doc);
    doc.setFontSize(6);
    doc.setTextColor(...COLOR.SAFETY_ACCENT);
    doc.text('PISTA DE SEGURIDAD', sideXAbs + 4, sy + 4);
    sy += 6.5;

    setFontBody(doc, 'normal');
    doc.setFontSize(5.8);
    doc.setTextColor(...COLOR.TEXT_PRIMARY);
    tipLines.slice(0, 4).forEach((tl: string, i: number) => {
      if (sy + 3.2 < sideBottom) doc.text(tl, sideXAbs + 4, sy + i * 3.2);
    });
    sy += Math.min(4, tipLines.length) * 3.2 + 3;
  }

  return sy;
}

export function drawSidebarHeaderBadge(
  doc: jsPDF,
  opts: {
    title: string;
    subtitle?: string;
    color: RGB;
    sideXAbs: number;
    sideW: number;
    y: number;
  }
): number {
  const { title, subtitle, color, sideXAbs, sideW, y } = opts;
  const h = subtitle ? 9.5 : 6.0;

  doc.setFillColor(...color);
  doc.roundedRect(sideXAbs, y, sideW, h, RADIUS.SM, RADIUS.SM, 'F');

  setFontHeading(doc);
  doc.setFontSize(5.8);
  doc.setTextColor(255, 255, 255);
  doc.text(sanitizePdfText(title).toUpperCase(), sideXAbs + 3, y + 3.8);

  if (subtitle) {
    setFontBody(doc, 'normal');
    doc.setFontSize(5.0);
    doc.setTextColor(255, 255, 255);
    doc.setGState(new (doc as any).GState({ opacity: 0.85 }));
    doc.text(sanitizePdfText(subtitle), sideXAbs + 3, y + 7.5);
    doc.setGState(new (doc as any).GState({ opacity: 1 }));
  }

  return y + h + 3;
}

export function drawAnalogyWidget(
  doc: jsPDF,
  opts: {
    analogy: string;
    sideXAbs: number;
    sideW: number;
    startY: number;
    sideBottom: number;
  }
): number {
  const { analogy, sideXAbs, sideW, startY, sideBottom } = opts;
  if (!analogy || startY + 20 >= sideBottom) return startY;

  const cleanAnalogy = sanitizePdfText(stripMarkdown(analogy));
  setFontBody(doc, 'normal');
  doc.setFontSize(5.8);
  const lines = doc.splitTextToSize(cleanAnalogy, sideW - 6);
  const cardH = 5.5 + Math.min(4, lines.length) * 3.2 + 6;

  if (startY + cardH < sideBottom) {
    doc.setFillColor(...COLOR.GOLD_LIGHT);
    doc.roundedRect(sideXAbs, startY, sideW, cardH, RADIUS.SM, RADIUS.SM, 'F');
    doc.setFillColor(...COLOR.GOLD);
    doc.roundedRect(sideXAbs, startY, 2.5, cardH, RADIUS.SM, RADIUS.SM, 'F');
    doc.setDrawColor(...COLOR.GOLD);
    doc.setLineWidth(STROKE.HAIRLINE);
    doc.roundedRect(sideXAbs, startY, sideW, cardH, RADIUS.SM, RADIUS.SM, 'S');

    setFontHeading(doc);
    doc.setFontSize(6.0);
    doc.setTextColor(...COLOR.GOLD);
    doc.text('IDEA FUERZA', sideXAbs + 4.5, startY + 4.0);

    setFontBody(doc, 'normal');
    doc.setFontSize(5.8);
    doc.setTextColor(...COLOR.TEXT_PRIMARY);
    lines.slice(0, 4).forEach((l: string, i: number) => {
      doc.text(l, sideXAbs + 4.5, startY + 7.5 + i * 3.2);
    });

    return startY + cardH + 3;
  }
  return startY;
}

export function drawStudyTipWidget(
  doc: jsPDF,
  opts: {
    tip: string;
    sideXAbs: number;
    sideW: number;
    startY: number;
    sideBottom: number;
  }
): number {
  const { tip, sideXAbs, sideW, startY, sideBottom } = opts;
  if (!tip || startY + 20 >= sideBottom) return startY;

  const cleanTip = sanitizePdfText(stripMarkdown(tip));
  setFontBody(doc, 'normal');
  doc.setFontSize(5.8);
  const lines = doc.splitTextToSize(cleanTip, sideW - 6);
  const cardH = 5.5 + Math.min(4, lines.length) * 3.2 + 6;

  if (startY + cardH < sideBottom) {
    doc.setFillColor(...COLOR.CALLOUT_IDEA_BG);
    doc.roundedRect(sideXAbs, startY, sideW, cardH, RADIUS.SM, RADIUS.SM, 'F');
    doc.setFillColor(...COLOR.CALLOUT_IDEA_ACC);
    doc.roundedRect(sideXAbs, startY, 2.5, cardH, RADIUS.SM, RADIUS.SM, 'F');
    doc.setDrawColor(...COLOR.BORDER);
    doc.setLineWidth(STROKE.HAIRLINE);
    doc.roundedRect(sideXAbs, startY, sideW, cardH, RADIUS.SM, RADIUS.SM, 'S');

    setFontHeading(doc);
    doc.setFontSize(6.0);
    doc.setTextColor(...COLOR.CALLOUT_IDEA_ACC);
    doc.text('ESTUDIO ACTIVO', sideXAbs + 4.5, startY + 4.0);

    setFontBody(doc, 'normal');
    doc.setFontSize(5.8);
    doc.setTextColor(...COLOR.TEXT_PRIMARY);
    lines.slice(0, 4).forEach((l: string, i: number) => {
      doc.text(l, sideXAbs + 4.5, startY + 7.5 + i * 3.2);
    });

    return startY + cardH + 3;
  }
  return startY;
}

export function drawQrMiniWidget(
  doc: jsPDF,
  opts: {
    sideXAbs: number;
    sideW: number;
    startY: number;
    sideBottom: number;
    qrBuffer?: Buffer;
    verificationUrl?: string;
    missionHash?: string;
  }
): number {
  const { sideXAbs, sideW, startY, sideBottom, qrBuffer, verificationUrl, missionHash } = opts;
  const availH = sideBottom - startY;
  if (availH < 22) return startY;

  const cardH = Math.min(availH - 2, 44);
  const sy = startY;

  // Fondo de tarjeta con esquinas redondeadas
  doc.setFillColor(...COLOR.DIAGNOSTIC_BG);
  doc.roundedRect(sideXAbs, sy, sideW, cardH, RADIUS.SM, RADIUS.SM, 'F');
  doc.setFillColor(...COLOR.NAVY);
  doc.roundedRect(sideXAbs, sy, 2.5, cardH, RADIUS.SM, RADIUS.SM, 'F');
  doc.setDrawColor(...COLOR.BORDER);
  doc.setLineWidth(STROKE.HAIRLINE);
  doc.roundedRect(sideXAbs, sy, sideW, cardH, RADIUS.SM, RADIUS.SM, 'S');

  // Encabezado
  setFontHeading(doc);
  doc.setFontSize(6.0);
  doc.setTextColor(...COLOR.NAVY);
  doc.text('VERIFICACIÓN & RECURSOS', sideXAbs + 4.5, sy + 4.2);

  let curY = sy + 6.2;

  // Imagen QR si hay buffer y suficiente altura
  if (qrBuffer && cardH >= 32) {
    const qrSize = Math.min(sideW - 12, 20);
    const qrX = sideXAbs + (sideW - qrSize) / 2;
    try {
      doc.addImage(qrBuffer, 'PNG', qrX, curY, qrSize, qrSize);
      curY += qrSize + 2.5;

      setFontBody(doc, 'normal');
      doc.setFontSize(4.8);
      doc.setTextColor(...COLOR.MUTED_TEXT);
      const hashShort = (missionHash || '').slice(0, 12) + '...';
      doc.text(`Hash: ${hashShort}`, sideXAbs + sideW / 2, curY, { align: 'center' });
      curY += 2.8;
      doc.text('Escanea para validar autenticidad', sideXAbs + sideW / 2, curY, { align: 'center' });
    } catch {
      // Fallback a texto si la imagen falla
      setFontBody(doc, 'normal');
      doc.setFontSize(5.2);
      doc.setTextColor(...COLOR.TEXT_PRIMARY);
      const urlLines = doc.splitTextToSize(verificationUrl || 'sigpda.sep.gob.mx', sideW - 6);
      urlLines.slice(0, 2).forEach((l: string, i: number) => {
        doc.text(l, sideXAbs + 4.5, curY + i * 3);
      });
    }
  } else {
    setFontBody(doc, 'normal');
    doc.setFontSize(5.2);
    doc.setTextColor(...COLOR.TEXT_PRIMARY);
    doc.text('Recurso digital validado', sideXAbs + 4.5, curY);
    curY += 3.2;
    if (missionHash) {
      setFontBody(doc, 'bold');
      doc.setFontSize(4.8);
      doc.setTextColor(...COLOR.MUTED_TEXT);
      doc.text(`ID: ${missionHash.slice(0, 14)}...`, sideXAbs + 4.5, curY);
    }
  }

  return sy + cardH + 3;
}

export function drawNotesWidget(
  doc: jsPDF,
  opts: {
    sideXAbs: number;
    sideW: number;
    startY: number;
    sideBottom: number;
    title?: string;
    subtitle?: string;
  }
): number {
  const {
    sideXAbs,
    sideW,
    startY,
    sideBottom,
    title = 'BITÁCORA DE TALLER',
    subtitle = 'Notas y observaciones personales',
  } = opts;

  const availH = sideBottom - startY;
  if (availH < 18) return startY;

  const cardH = availH - 2;
  const sy = startY;

  // Fondo sutil
  doc.setFillColor(...COLOR.TABLE_ALT_ROW);
  doc.roundedRect(sideXAbs, sy, sideW, cardH, RADIUS.SM, RADIUS.SM, 'F');
  doc.setFillColor(...COLOR.BORDER);
  doc.roundedRect(sideXAbs, sy, 2.5, cardH, RADIUS.SM, RADIUS.SM, 'F');
  doc.setDrawColor(...COLOR.BORDER);
  doc.setLineWidth(STROKE.HAIRLINE);
  doc.roundedRect(sideXAbs, sy, sideW, cardH, RADIUS.SM, RADIUS.SM, 'S');

  // Encabezado
  setFontHeading(doc);
  doc.setFontSize(6.0);
  doc.setTextColor(...COLOR.TEXT_PRIMARY);
  doc.text(sanitizePdfText(title), sideXAbs + 4.5, sy + 4.2);

  setFontBody(doc, 'normal');
  doc.setFontSize(4.8);
  doc.setTextColor(...COLOR.TEXT_MUTED);
  doc.text(sanitizePdfText(subtitle), sideXAbs + 4.5, sy + 7.5);

  // Líneas de pauta para escritura
  const lineStartY = sy + 12;
  const lineSpacing = 5.2;
  const lineCount = Math.floor((cardH - 14) / lineSpacing);

  doc.setDrawColor(...COLOR.DIVIDER);
  doc.setLineWidth(0.2);
  if (typeof (doc as any).setLineDashPattern === 'function') {
    (doc as any).setLineDashPattern([0.8, 1.5], 0);
  }

  for (let i = 0; i < lineCount; i++) {
    const ly = lineStartY + i * lineSpacing;
    if (ly < sy + cardH - 3) {
      doc.line(sideXAbs + 4.5, ly, sideXAbs + sideW - 4.5, ly);
    }
  }

  if (typeof (doc as any).setLineDashPattern === 'function') {
    (doc as any).setLineDashPattern([], 0);
  }

  return sy + cardH + 2;
}

export function drawChecklistWidget(
  doc: jsPDF,
  opts: {
    sideXAbs: number;
    sideW: number;
    startY: number;
    sideBottom: number;
    title?: string;
    items?: string[];
  }
): number {
  const {
    sideXAbs,
    sideW,
    startY,
    sideBottom,
    title = 'CRITERIOS DE LOGRO',
    items = [
      'Identifico el problema y variables',
      'Sigo medidas de seguridad en taller',
      'Registro evidencia en mi cuaderno',
      'Contrasto hipotesis con resultados',
    ],
  } = opts;

  const cardH = 9.0 + items.length * 6.5;
  if (startY + cardH >= sideBottom) return startY;

  const sy = startY;

  // Fondo sutil
  doc.setFillColor(...COLOR.DIAGNOSTIC_BG);
  doc.roundedRect(sideXAbs, sy, sideW, cardH, RADIUS.SM, RADIUS.SM, 'F');
  doc.setFillColor(...COLOR.MID_BLUE);
  doc.roundedRect(sideXAbs, sy, 2.5, cardH, RADIUS.SM, RADIUS.SM, 'F');
  doc.setDrawColor(...COLOR.BORDER);
  doc.setLineWidth(STROKE.HAIRLINE);
  doc.roundedRect(sideXAbs, sy, sideW, cardH, RADIUS.SM, RADIUS.SM, 'S');

  // Encabezado
  setFontHeading(doc);
  doc.setFontSize(6.0);
  doc.setTextColor(...COLOR.MID_BLUE);
  doc.text(sanitizePdfText(title), sideXAbs + 4.5, sy + 4.2);

  // Casillas de verificación
  items.forEach((item, i) => {
    const itemY = sy + 8.5 + i * 6.5;
    // Cuadrito de checkbox
    doc.setDrawColor(...COLOR.MID_BLUE);
    doc.setFillColor(255, 255, 255);
    doc.rect(sideXAbs + 4.5, itemY - 2.8, 2.8, 2.8, 'FD');

    setFontBody(doc, 'normal');
    doc.setFontSize(5.2);
    doc.setTextColor(...COLOR.TEXT_PRIMARY);
    const itemLines = doc.splitTextToSize(sanitizePdfText(item), sideW - 12);
    doc.text(itemLines[0], sideXAbs + 9.0, itemY - 0.5);
  });

  return sy + cardH + 3;
}

// ── 4. FICHA TÉCNICA DE INSTRUMENTAL Y EQUIPO EN SIDEBAR ──────────────────────

export function drawEquipmentCardWidget(
  doc: jsPDF,
  opts: {
    detected: DetectedObject;
    imageBuffer: Buffer;
    imageFormat?: 'JPEG' | 'PNG';
    sideXAbs: number;
    sideW: number;
    startY: number;
    sideBottom: number;
  }
): number {
  const { detected, imageBuffer, imageFormat = 'JPEG', sideXAbs, sideW, startY, sideBottom } = opts;
  const availH = sideBottom - startY;
  if (availH < 38) return startY;

  const cardH = Math.min(availH - 2, 54);
  const sy = startY;

  // Fondo de tarjeta con esquinas redondeadas
  doc.setFillColor(...COLOR.TABLE_ALT_ROW);
  doc.roundedRect(sideXAbs, sy, sideW, cardH, RADIUS.SM, RADIUS.SM, 'F');
  doc.setFillColor(...COLOR.MID_BLUE);
  doc.roundedRect(sideXAbs, sy, 2.5, cardH, RADIUS.SM, RADIUS.SM, 'F');
  doc.setDrawColor(...COLOR.BORDER);
  doc.setLineWidth(STROKE.HAIRLINE);
  doc.roundedRect(sideXAbs, sy, sideW, cardH, RADIUS.SM, RADIUS.SM, 'S');

  // Encabezado tipo píldora
  const badgeLabel = detected.category === 'seguridad_epp'
    ? 'SEGURIDAD & EPP'
    : detected.category === 'instrumento_medicion'
    ? 'INSTRUMENTO DE MEDICIÓN'
    : 'EQUIPO DE PRÁCTICA';

  setFontHeading(doc);
  doc.setFontSize(5.5);
  doc.setTextColor(...COLOR.MID_BLUE);
  doc.text(badgeLabel, sideXAbs + 4.5, sy + 4.0);

  let curY = sy + 6.0;

  // Imagen centrada en el sidebar
  const imgW = Math.min(sideW - 8, 38);
  const imgH = 24;
  const imgX = sideXAbs + (sideW - imgW) / 2;

  try {
    doc.addImage(imageBuffer, imageFormat, imgX, curY, imgW, imgH);
    curY += imgH + 2.5;
  } catch {
    curY += 2;
  }

  // Nombre del equipo en negrita
  setFontBody(doc, 'bold');
  doc.setFontSize(6.2);
  doc.setTextColor(...COLOR.NAVY);
  const nameLines = doc.splitTextToSize(sanitizePdfText(detected.name), sideW - 6);
  doc.text(nameLines[0], sideXAbs + 4.5, curY + 1.5);
  curY += 4.5;

  // Función o norma en cuerpo pequeño
  setFontBody(doc, 'normal');
  doc.setFontSize(5.0);
  doc.setTextColor(...COLOR.TEXT_PRIMARY);
  const descText = detected.safetyRule || detected.technicalRole;
  const descLines = doc.splitTextToSize(sanitizePdfText(descText), sideW - 6);
  descLines.slice(0, 2).forEach((l: string, i: number) => {
    if (curY + i * 2.8 < sy + cardH - 1.5) {
      doc.text(l, sideXAbs + 4.5, curY + i * 2.8);
    }
  });

  return sy + cardH + 3;
}

