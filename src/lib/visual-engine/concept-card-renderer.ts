/**
 * concept-card-renderer.ts — Widget de Tarjetas Conceptuales (Fase 3)
 * SIGPDA-EMS · SEMS Puebla MCCEMS 2026-2027
 *
 * Renderiza tarjetas de conceptualización y analogía con soporte de:
 * - Extractor determinista desde MissionSection (Analogía, Concepto, Criterio)
 * - Cuadrícula responsive de 2 o 3 columnas con altura uniforme por fila
 * - Paginación atómica estricta (ensureVerticalSpace por fila completa)
 * - Miniatura de material del catálogo (readMaterialPng) si existe slug
 * - Sanitización WinAnsi obligatoria en todos los textos impresos con doc.text
 * - Degradación canónica D9 (si < 2 conceptos válidos, retorna sin renderizar)
 */

import type { jsPDF } from 'jspdf';
import type { ConceptCardItem, MissionSection } from '@/types/work-textbook';
import { CONCEPT_CARDS } from './design-tokens';
import { sanitizePdfText } from './pdf-components-core';
import { readMaterialPng } from '@/lib/materials/material-figure-doc';
import { detectCatalogMaterials } from '@/lib/materials/auto-tokenize';
import { stripMarkdown } from './content-extractor';

export interface ConceptCardGridOptions {
  margin: number;
  drawWidth: number;
  y: number;
  pageHeight: number;
  ensureVerticalSpace: (doc: jsPDF, y: number, neededH: number, margin: number, pageHeight: number) => number;
}

/**
 * Limpia la descripción de una tarjeta conceptual eliminando bloques de tabla markdown
 * (<!--workbook:table...--> y filas con pipes |...|) y marcas de formato (REG-8).
 */
export function cleanConceptCardDescription(raw: string | null | undefined): string {
  if (!raw) return '';
  // 1. Eliminar etiquetas de control HTML o workbook:table (<!--...-->)
  let text = raw.replace(/<!--[\s\S]*?-->/g, '');

  // 2. Si contiene pipes de tabla markdown, eliminar líneas que sean filas de tabla o separadores
  if (text.includes('|')) {
    const lines = text.split(/\r?\n/);
    const nonTableLines = lines.filter((l) => {
      const trimmed = l.trim();
      if (!trimmed) return true;
      // Fila de tabla markdown (| Col 1 | Col 2 |) o divisor (|---|---|)
      const isTableRow =
        (trimmed.startsWith('|') && trimmed.endsWith('|')) ||
        /^\|?[\s\-:|]+\|?$/.test(trimmed) ||
        (trimmed.startsWith('|') && trimmed.includes('|'));
      return !isTableRow;
    });
    text = nonTableLines.join('\n');
  }

  // 3. stripMarkdown elimina marcas restantes (asteriscos, cursivas, negritas)
  const stripped = stripMarkdown(text);

  // 4. Eliminar cualquier pipe remanente suelto y sanitizar WinAnsi
  const withoutPipes = stripped.replace(/\|/g, '').replace(/[^\S\r\n]+/g, ' ').trim();
  return sanitizePdfText(withoutPipes);
}

/**
 * Extractor determinista de tarjetas conceptuales desde la misión formativa.
 * Si la misión ya define `conceptCards` con >= 2 tarjetas, las respeta.
 * De lo contrario, extrae:
 *   - Card 1: Analogía intuitiva (conceptZero.physicalAnalogy)
 *   - Card 2: Fundamento central (conceptZero.coreExplanation)
 *   - Card 3: Criterio de aplicación (formativeCheckpoint.criteriaChecklist[0])
 * Si el resultado tiene < 2 tarjetas, retorna [] activando degradación canónica D9.
 */
export function extractConceptCardsFromMission(mission: Partial<MissionSection>): ConceptCardItem[] {
  if (!mission) return [];

  // 1. Respetar tarjetas preexistentes si ya están definidas y completas
  const preExisting = mission.conceptZero?.conceptCards || (mission as unknown as { contextualizationSection?: { conceptCards?: ConceptCardItem[] } })?.contextualizationSection?.conceptCards;
  if (Array.isArray(preExisting) && preExisting.length >= 2) {
    return preExisting.filter(c => c && typeof c.title === 'string' && typeof c.description === 'string' && c.description.trim().length > 0);
  }

  const cards: ConceptCardItem[] = [];

  // Card 1: Analogía física intuitiva
  const analogyText = mission.conceptZero?.physicalAnalogy?.trim();
  if (analogyText && analogyText.length > 5) {
    const detected = detectCatalogMaterials(analogyText);
    cards.push({
      title: 'Analogía Intuitiva',
      badge: 'ANALOGÍA',
      description: analogyText,
      materialSlug: detected[0]?.slug,
    });
  }

  // Card 2: Fundamento conceptual formal (limpiando tablas markdown si existen, REG-8)
  const coreClean = cleanConceptCardDescription(mission.conceptZero?.coreExplanation);
  if (coreClean && coreClean.length > 5) {
    const detected = detectCatalogMaterials(coreClean);
    cards.push({
      title: 'Fundamento Central',
      badge: 'CONCEPTO',
      description: coreClean,
      materialSlug: detected[0]?.slug,
    });
  }

  // Card 3: Criterio clave de aplicación práctica
  const criteriaText = mission.formativeCheckpoint?.criteriaChecklist?.[0]?.trim();
  if (criteriaText && criteriaText.length > 5) {
    const detected = detectCatalogMaterials(criteriaText);
    cards.push({
      title: 'Criterio de Aplicación',
      badge: 'APLICACIÓN',
      description: criteriaText,
      materialSlug: detected[0]?.slug,
    });
  }

  // Degradación D9: si hay menos de 2 conceptos válidos, devolver vacío para fallback
  if (cards.length < 2) {
    return [];
  }

  return cards;
}

interface MeasuredConceptCard {
  card: ConceptCardItem;
  pngBuffer: Buffer | null;
  badgeText: string;
  titleLines: string[];
  descLines: string[];
  exampleLines: string[];
  cardH: number;
}

/** Umbral de palabras por tarjeta a partir del cual se abandona la cuadrícula de columnas (H-7). */
export const CONCEPT_CARD_LONG_TEXT_WORDS = 200;

function countCardWords(card: ConceptCardItem): number {
  const text = `${card.description || ''} ${card.example || ''}`.trim();
  return text.length === 0 ? 0 : text.split(/\s+/).length;
}

/**
 * Recorta líneas ya medidas para que quepan en `maxLines`, añadiendo "…" a la última línea visible.
 * Si caben todas, las devuelve intactas.
 */
export function clampLinesWithEllipsis(lines: string[], maxLines: number): string[] {
  if (lines.length <= maxLines) return lines;
  const keep = Math.max(1, maxLines);
  const clipped = lines.slice(0, keep);
  const last = clipped[keep - 1].replace(/[\s.,;:]+$/, '');
  clipped[keep - 1] = `${last}...`;
  return clipped;
}

function measureSingleCard(
  doc: jsPDF,
  card: ConceptCardItem,
  colW: number,
  maxCardH: number = Number.POSITIVE_INFINITY
): MeasuredConceptCard {
  const innerW = colW - 8;
  const pngBuffer = card.materialSlug ? readMaterialPng(card.materialSlug) : null;
  const hasImage = pngBuffer !== null;

  // Ancho para título: si hay miniatura lateral, reservar 18mm
  const titleAvailableW = hasImage ? Math.max(innerW - 18, 20) : innerW;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  const cleanTitle = sanitizePdfText(card.title || 'Concepto');
  const titleLines = doc.splitTextToSize(cleanTitle, titleAvailableW);
  const titleH = titleLines.length * 3.4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  const cleanDesc = cleanConceptCardDescription(card.description);
  let descLines: string[] = doc.splitTextToSize(cleanDesc, innerW);

  let exampleH = 0;
  let exampleLines: string[] = [];
  if (card.example && card.example.trim().length > 0) {
    doc.setFontSize(6.2);
    const cleanExample = sanitizePdfText(card.example.trim());
    exampleLines = doc.splitTextToSize(cleanExample, innerW - 4);
  }

  const topAreaH = hasImage ? Math.max(titleH + 7, 18) : titleH + 6;

  // Truncamiento por altura (H-7): ninguna tarjeta puede exceder la altura útil de una página.
  // Primero se limita el ejemplo (máx. 4 líneas) y luego la descripción, con "..." al final.
  if (Number.isFinite(maxCardH)) {
    const fixedH = 5 + topAreaH + 5;
    const exampleOverhead = exampleLines.length > 0 ? 5.0 + 2 : 0;
    if (exampleLines.length > 4) {
      exampleLines = clampLinesWithEllipsis(exampleLines, 4);
    }
    const exampleBlockH = exampleLines.length > 0 ? exampleOverhead + exampleLines.length * 2.8 : 0;
    const maxDescLines = Math.max(3, Math.floor((maxCardH - fixedH - exampleBlockH) / 3.1));
    descLines = clampLinesWithEllipsis(descLines, maxDescLines);
  }

  const descH = descLines.length * 3.1;
  if (exampleLines.length > 0) {
    exampleH = 5.0 + exampleLines.length * 2.8;
  }
  const totalH = 5 + topAreaH + descH + (exampleH > 0 ? exampleH + 2 : 0) + 5;

  return {
    card,
    pngBuffer,
    badgeText: sanitizePdfText(card.badge || 'IDEA'),
    titleLines,
    descLines,
    exampleLines,
    cardH: Math.max(totalH, 32),
  };
}

function getBadgeColor(badge: string): readonly [number, number, number] {
  const upper = badge.toUpperCase();
  if (upper.includes('ANALOG')) return CONCEPT_CARDS.badgeAnalogy;
  if (upper.includes('CONCEP')) return CONCEPT_CARDS.badgeConcept;
  if (upper.includes('APLIC') || upper.includes('CRITER')) return CONCEPT_CARDS.badgeApply;
  return CONCEPT_CARDS.badgeDefault;
}

function renderSingleCard(
  doc: jsPDF,
  measured: MeasuredConceptCard,
  cardX: number,
  cardY: number,
  colW: number,
  uniformH: number
): void {
  const innerW = colW - 8;

  // 1. Chasis exterior redondeado
  doc.setFillColor(...CONCEPT_CARDS.bg);
  doc.setDrawColor(...CONCEPT_CARDS.border);
  doc.setLineWidth(0.35);
  doc.roundedRect(cardX, cardY, colW, uniformH, 2, 2, 'FD');

  // 2. Badge superior izquierdo tipo cápsula
  const badgeColor = getBadgeColor(measured.card.badge || '');
  doc.setFillColor(...badgeColor);
  const badgeW = Math.min(Math.max(measured.badgeText.length * 2.2 + 4, 18), 32);
  doc.roundedRect(cardX + 4, cardY + 3.5, badgeW, 4.2, 1, 1, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.5);
  doc.setTextColor(...CONCEPT_CARDS.badgeText);
  doc.text(measured.badgeText, cardX + 4 + badgeW / 2, cardY + 6.4, { align: 'center' });

  // 3. Miniatura de material si existe
  const hasImage = measured.pngBuffer !== null;
  const imgSize = 14;
  if (hasImage && measured.pngBuffer) {
    const imgX = cardX + colW - 4 - imgSize;
    const imgY = cardY + 3.5;
    try {
      doc.addImage(measured.pngBuffer, 'PNG', imgX, imgY, imgSize, imgSize);
    } catch {
      // Degradación silenciosa si el buffer es inválido
    }
  }

  // 4. Título del concepto
  let curY = cardY + 11.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...CONCEPT_CARDS.titleText);
  doc.text(measured.titleLines, cardX + 4, curY);
  curY += measured.titleLines.length * 3.4 + 1.5;

  // Si había imagen, asegurar que curY baje al menos de la altura de la imagen
  if (hasImage) {
    curY = Math.max(curY, cardY + 3.5 + imgSize + 2);
  }

  // 5. Descripción explicativa
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(...CONCEPT_CARDS.descText);
  doc.text(measured.descLines, cardX + 4, curY);
  curY += measured.descLines.length * 3.1 + 2.0;

  // 6. Caja de ejemplo práctico si existe
  if (measured.exampleLines.length > 0) {
    const exBoxH = 4.5 + measured.exampleLines.length * 2.8;
    doc.setFillColor(...CONCEPT_CARDS.exampleBg);
    doc.setDrawColor(...CONCEPT_CARDS.exampleBorder);
    doc.setLineWidth(0.25);
    doc.roundedRect(cardX + 4, curY, innerW, exBoxH, 1, 1, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.8);
    doc.setTextColor(...CONCEPT_CARDS.exampleLabel);
    doc.text(sanitizePdfText('[EJEMPLO]:'), cardX + 6, curY + 2.8);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...CONCEPT_CARDS.exampleText);
    doc.text(measured.exampleLines, cardX + 6, curY + 5.4);
  }
}

/**
 * Dibuja la cuadrícula de tarjetas conceptuales con paginación atómica y degradación D9.
 * Si `cards` tiene < 2 elementos, retorna `options.y` intacto sin dibujar.
 */
export function drawConceptCardsGrid(
  doc: jsPDF,
  cards: ConceptCardItem[],
  options: ConceptCardGridOptions
): number {
  if (!cards || cards.length < 2) {
    return options.y;
  }

  const { margin, drawWidth, pageHeight, ensureVerticalSpace } = options;
  let curY = options.y;

  // Disposición de columnas: 3 columnas si exactamente 3 tarjetas; 2 columnas si 2 o >= 4 tarjetas.
  // H-7: si cualquier tarjeta supera ~200 palabras, se abandona la cuadrícula y cada tarjeta ocupa
  // el ancho completo (título como subheader + párrafo) para que el texto no quede en columnas estrechas.
  const hasLongCard = cards.some((c) => countCardWords(c) > CONCEPT_CARD_LONG_TEXT_WORDS);
  const numCols = hasLongCard ? 1 : cards.length === 3 ? 3 : 2;
  const gap = 3.5;
  const colW = (drawWidth - gap * (numCols - 1)) / numCols;

  // Altura máxima permitida por tarjeta: una página útil (descontando márgenes y banda de cabecera/pie)
  const maxCardH = Math.max(40, pageHeight - margin * 2 - 24);

  // Pre-medir todas las tarjetas
  const measuredCards = cards.map(c => measureSingleCard(doc, c, colW, maxCardH));

  // Agrupar en filas
  const rows: MeasuredConceptCard[][] = [];
  for (let i = 0; i < measuredCards.length; i += numCols) {
    rows.push(measuredCards.slice(i, i + numCols));
  }

  // Renderizar fila por fila con paginación atómica
  for (const row of rows) {
    const maxRowH = Math.max(...row.map(c => c.cardH));

    // Paginación atómica: fila completa salta junta si no cabe en la página
    curY = ensureVerticalSpace(doc, curY, maxRowH + 4, margin, pageHeight);

    row.forEach((mCard, colIdx) => {
      const cardX = margin + colIdx * (colW + gap);
      renderSingleCard(doc, mCard, cardX, curY, colW, maxRowH);
    });

    curY += maxRowH + 3.5;
  }

  return curY;
}
