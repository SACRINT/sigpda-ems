/**
 * step-card-renderer.ts — Renderizador Visual de Tarjetas de Paso de Laboratorio
 * SIGPDA-EMS · SEMS Puebla MCCEMS 2026-2027
 *
 * Implementa el Widget 2 (Fase 2): Cuadrícula de 2 columnas de tarjetas de paso
 * estructuradas con badge circular azul, caja monoespaciada oscura de comando/código,
 * caja verde de validación de salida y paginación atómica estricta (prohibido partir
 * tarjetas entre páginas).
 *
 * Cero dependencias externas y ejecución 100% offline.
 */

import type { jsPDF } from 'jspdf';
import type { LabStepCard } from '@/types/work-textbook';
import { CODE_IDE, STEP_CARDS, SPACING } from './design-tokens';
import { sanitizePdfText } from './pdf-components-core';
import { drawIcon } from './icon-renderer';

export interface StepCardGridOptions {
  margin: number;
  drawWidth: number;
  y: number;
  pageHeight: number;
  ensureVerticalSpace: (doc: jsPDF, y: number, neededH: number, margin: number, pageHeight: number) => number;
}

interface CardDimensions {
  cardH: number;
  titleLines: string[];
  titleH: number;
  descLines: string[];
  descH: number;
  codeLines: string[];
  codeH: number;
  outputLines: string[];
  outputH: number;
  tipLines: string[];
  tipH: number;
}

/**
 * Calcula las dimensiones y wrapping de texto de una tarjeta individual.
 */
function measureStepCard(
  doc: jsPDF,
  card: LabStepCard,
  colW: number
): CardDimensions {
  const innerW = colW - 8; // 4mm margen interior a cada lado
  const titleAvailableW = Math.max(20, innerW - 8); // Reserva para el badge circular

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  const titleLines = doc.splitTextToSize(sanitizePdfText(card.title || `Paso ${card.stepNumber}`), titleAvailableW);
  const titleH = Math.max(5.5, titleLines.length * 3.4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.6);
  const descLines = doc.splitTextToSize(sanitizePdfText(card.actionDescription || ''), innerW);
  const descH = descLines.length * 3.1;

  let codeLines: string[] = [];
  let codeH = 0;
  if (card.codeSnippet && card.codeSnippet.trim().length > 0) {
    codeLines = card.codeSnippet.trim().split(/\r?\n/).slice(0, 8); // Máximo 8 líneas representativas
    codeH = codeLines.length * 2.9 + 4.5;
  }

  let outputLines: string[] = [];
  let outputH = 0;
  if (card.expectedOutput && card.expectedOutput.trim().length > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.0);
    outputLines = doc.splitTextToSize(sanitizePdfText(card.expectedOutput.trim()), innerW - 4);
    outputH = outputLines.length * 2.8 + 6.0;
  }

  let tipLines: string[] = [];
  let tipH = 0;
  if (card.tipOrNote && card.tipOrNote.trim().length > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.8);
    tipLines = doc.splitTextToSize(sanitizePdfText(card.tipOrNote.trim()), innerW - 4);
    tipH = tipLines.length * 2.6 + 5.5;
  }

  const cardH = 4 + titleH + 1.5 + descH + (codeH ? codeH + 2.5 : 0) + (outputH ? outputH + 2.5 : 0) + (tipH ? tipH + 2.5 : 0) + 4;

  return {
    cardH,
    titleLines,
    titleH,
    descLines,
    descH,
    codeLines,
    codeH,
    outputLines,
    outputH,
    tipLines,
    tipH,
  };
}

/**
 * Renderiza la cuadrícula de tarjetas de paso de laboratorio con paginación atómica.
 */
export function drawStepCardGrid(
  doc: jsPDF,
  cards: LabStepCard[],
  opts: StepCardGridOptions
): number {
  if (!cards || cards.length === 0) {
    return opts.y;
  }

  const { margin, drawWidth, pageHeight, ensureVerticalSpace } = opts;
  let y = opts.y;

  const colGap = 5;
  const colW = (drawWidth - colGap) / 2;

  // Procesar las tarjetas en pares (filas de 2 columnas)
  for (let idx = 0; idx < cards.length; idx += 2) {
    const cardLeft = cards[idx];
    const cardRight = cards[idx + 1] as LabStepCard | undefined;

    const dimLeft = measureStepCard(doc, cardLeft, colW);
    const dimRight = cardRight ? measureStepCard(doc, cardRight, colW) : null;

    // Altura simétrica para la fila completa
    const rowH = Math.max(dimLeft.cardH, dimRight ? dimRight.cardH : 0);

    // PAGINACIÓN ATÓMICA: La fila completa se evalúa antes de trazar
    y = ensureVerticalSpace(doc, y, rowH + 4, margin, pageHeight);

    // ── 1. Pintar Tarjeta Izquierda ──
    const xLeft = margin;
    renderSingleStepCard(doc, cardLeft, xLeft, y, colW, rowH, dimLeft);

    // ── 2. Pintar Tarjeta Derecha (si existe) ──
    if (cardRight && dimRight) {
      const xRight = margin + colW + colGap;
      renderSingleStepCard(doc, cardRight, xRight, y, colW, rowH, dimRight);
    }

    y += rowH + 4; // Espacio inter-filas
  }

  return y + SPACING.AFTER_SECTION;
}

/**
 * Pinta una sola tarjeta con bordes, badge, código y cajas auxiliares.
 */
function renderSingleStepCard(
  doc: jsPDF,
  card: LabStepCard,
  cardX: number,
  y: number,
  colW: number,
  cardH: number,
  dim: CardDimensions
): void {
  const innerW = colW - 8;

  // 1. Chasis exterior con esquinas suaves
  doc.setFillColor(...STEP_CARDS.bg);
  doc.setDrawColor(...STEP_CARDS.border);
  doc.setLineWidth(0.35);
  doc.roundedRect(cardX, y, colW, cardH, 2, 2, 'FD');

  // 2. Badge circular azul con número de paso
  const badgeCenterX = cardX + 5.5;
  const badgeCenterY = y + 5.5;
  doc.setFillColor(...STEP_CARDS.badgeBg);
  doc.circle(badgeCenterX, badgeCenterY, 2.75, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(...STEP_CARDS.badgeText);
  doc.text(String(card.stepNumber), badgeCenterX, badgeCenterY + 1.0, { align: 'center' });

  // 3. Título del paso
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(...STEP_CARDS.titleText);
  doc.text(dim.titleLines, cardX + 10, y + 4.8);

  // 4. Descripción de la acción técnica
  let curY = y + 5 + dim.titleH + 1.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.6);
  doc.setTextColor(...STEP_CARDS.descText);
  doc.text(dim.descLines, cardX + 4, curY);
  curY += dim.descH + 2.5;

  // 5. Caja de comando / código monoespaciada estilo IDE
  if (dim.codeLines.length > 0) {
    doc.setFillColor(...CODE_IDE.gutterBg); // [37, 37, 38]
    doc.setDrawColor(...CODE_IDE.border);   // [60, 60, 60]
    doc.setLineWidth(0.25);
    doc.roundedRect(cardX + 4, curY, innerW, dim.codeH, 1, 1, 'FD');

    doc.setFont('courier', 'normal');
    doc.setFontSize(6.0);
    doc.setTextColor(...CODE_IDE.baseText);
    for (let cIdx = 0; cIdx < dim.codeLines.length; cIdx++) {
      const cleanLine = sanitizePdfText(dim.codeLines[cIdx]);
      doc.text(cleanLine, cardX + 6, curY + 3.2 + cIdx * 2.9);
    }
    curY += dim.codeH + 2.5;
  }

  // 6. Caja verde de resultado esperado / salida (icono vectorial con fallback D9)
  if (dim.outputLines.length > 0) {
    doc.setFillColor(...STEP_CARDS.outputBg);
    doc.setDrawColor(...STEP_CARDS.outputBorder);
    doc.setLineWidth(0.25);
    doc.roundedRect(cardX + 4, curY, innerW, dim.outputH, 1, 1, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.0);
    doc.setTextColor(...STEP_CARDS.outputLabel);
    const iconDrawn = drawIcon(doc, 'check', cardX + 6, curY + 1.1, 2.2, STEP_CARDS.outputLabel);
    if (iconDrawn) {
      doc.text(sanitizePdfText('Salida esperada:'), cardX + 9.2, curY + 3.0);
    } else {
      doc.text(sanitizePdfText('[OK] Salida esperada:'), cardX + 6, curY + 3.0);
    }

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...STEP_CARDS.outputText);
    doc.text(dim.outputLines, cardX + 6, curY + 5.8);
    curY += dim.outputH + 2.5;
  }

  // 7. Caja de observación o tip de taller (icono vectorial con fallback D9)
  if (dim.tipLines.length > 0) {
    doc.setFillColor(...STEP_CARDS.tipBg);
    doc.setDrawColor(...STEP_CARDS.tipBorder);
    doc.setLineWidth(0.25);
    doc.roundedRect(cardX + 4, curY, innerW, dim.tipH, 1, 1, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.8);
    doc.setTextColor(...STEP_CARDS.tipLabel);
    const iconDrawn = drawIcon(doc, 'bombilla', cardX + 6, curY + 1.0, 2.2, STEP_CARDS.tipLabel);
    if (iconDrawn) {
      doc.text(sanitizePdfText('Tip / Pista técnica:'), cardX + 9.2, curY + 2.8);
    } else {
      doc.text(sanitizePdfText('[IDEA] Tip / Pista técnica:'), cardX + 6, curY + 2.8);
    }

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...STEP_CARDS.tipText);
    doc.text(dim.tipLines, cardX + 6, curY + 5.4);
  }
}
