/**
 * pdf-extra-renderer.ts — Motor de Renderizado Visual Unificado para Extras Didácticos
 * SIGPDA-EMS · MCCEMS Puebla 2026-2027
 *
 * Orquestador visual de alta fidelidad que:
 * 1. Integra los componentes de diseño editorial (pdf-components-core.ts y design-tokens.ts).
 * 2. Implementa renderFormattedBlock() con tokenización a nivel de palabra para negritas inline
 *    y ajuste de renglón (word-wrap) libre de desbordamientos horizontales.
 * 3. Renderiza encabezados con drawSectionRibbon() diferenciando las fases didácticas
 *    (Apertura, Desarrollo, Cierre) y aplicando paletas institucionales.
 * 4. Transforma citas Markdown (>) en cajas pedagógicas estructuradas con drawCalloutBox().
 * 5. Gestiona tablas Markdown con jspdf-autotable (Landscape para rúbricas, Portrait para listas).
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  COLORS,
  resolveLevel4FillRgb,
  resolveLevel4TextRgb,
  type RGB,
} from '@/lib/visual-engine/design-tokens';
import {
  drawSectionRibbon,
  drawCalloutBox,
  sanitizePdfText,
} from '@/lib/visual-engine/pdf-components-core';
import {
  loadEditorialFonts,
  areEditorialFontsLoaded,
} from '@/lib/visual-engine/font-loader';
import type { CalloutBoxData } from '@/lib/visual-engine/callout-box';
import {
  resolveHeaderBranding,
  resolveFooterBranding,
  INSTITUTIONAL_DEFAULTS,
  type BrandingContext,
} from '@/lib/document-branding';
import { getExtraContentForRender } from '@/lib/materials/material-tokens';
export { getExtraContentForRender };

// ── Paleta institucional MCCEMS ─────────────────────────────────────────────
const NAVY: RGB     = [26, 26, 46];
const MID: RGB      = [15, 52, 96];
const ACCENT: RGB   = [230, 81, 0];
const GOLD: RGB     = [255, 213, 128];
const GRAY_BG: RGB  = [238, 243, 251];
const TEXT: RGB     = [26, 26, 26];
const WHITE: RGB    = [255, 255, 255];

const { PHASE_APERTURA, PHASE_DESARROLLO, PHASE_CIERRE } = COLORS;

export interface ExtraInput {
  id: string;
  title: string;
  type: string;
  content_text: string;
  keyIndex?: number | null;
}

/**
 * Niveles de densidad tipográfica del motor.
 * - `normal`   : métrica editorial estándar.
 * - `compact`  : el plan de clase (29-30 renglones) debe caber en una sola hoja.
 * - `ultra`    : último recurso cuando `compact` todavía desborda de una hoja.
 */
export type ExtraDensity = 'normal' | 'compact' | 'ultra';

export interface FormattedBlockOptions {
  x: number;
  y: number;
  maxWidth: number;
  pageHeight: number;
  lineHeight?: number;
  fontSize?: number;
  textColor?: RGB;
  /** Reserva inferior sobre la línea de pie antes de romper página (default 16 mm). */
  bottomReserve?: number;
  addNewPage: () => void;
}

/**
 * Renderiza texto con negritas en línea (**bold**) y ajuste automático de renglón palabra por palabra.
 * Previene desbordamientos horizontales fuera de la página y gestiona saltos de página verticales.
 */
export function renderFormattedBlock(
  doc: jsPDF,
  rawMarkdownLine: string,
  opts: FormattedBlockOptions
): number {
  const { x, maxWidth, pageHeight, addNewPage } = opts;
  const lineHeight = opts.lineHeight || 4.6;
  const fontSize = opts.fontSize || 8.0;
  const textColor = opts.textColor || TEXT;
  const bottomReserve = opts.bottomReserve ?? 16;

  doc.setFontSize(fontSize);
  doc.setTextColor(...textColor);

  // Descomponer en segmentos alternados normal / bold
  const rawSegments = rawMarkdownLine.split(/\*\*([\s\S]*?)\*\*/g);
  interface Token {
    word: string;
    bold: boolean;
    isSpace: boolean;
  }

  const tokens: Token[] = [];
  rawSegments.forEach((seg, idx) => {
    if (!seg) return;
    const isBold = idx % 2 === 1;
    const parts = seg.split(/(\s+)/);
    for (const p of parts) {
      if (p.length > 0) {
        tokens.push({
          word: p,
          bold: isBold,
          isSpace: /^\s+$/.test(p),
        });
      }
    }
  });

  let currentX = x;
  let currentY = opts.y;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    doc.setFont('helvetica', token.bold ? 'bold' : 'normal');

    if (token.isSpace && currentX === x) {
      continue; // Ignorar espacios al inicio de un nuevo renglón
    }

    const wordW = doc.getTextWidth(token.word);

    // Si la palabra excede el ancho disponible en la línea actual
    if (!token.isSpace && currentX + wordW > x + maxWidth && currentX > x) {
      currentY += lineHeight;
      currentX = x;

      if (currentY > pageHeight - bottomReserve) {
        addNewPage();
        currentY = 22;
        doc.setFontSize(fontSize);
        doc.setTextColor(...textColor);
      }
    }

    doc.text(token.word, currentX, currentY);
    currentX += wordW;
  }

  return currentY + lineHeight;
}

/**
 * Cajas de color H4 (####): delimitan los bloques de sesión del solucionario
 * (A–E por misión). Se dibujan como barra sólida con letra destacada en píldora,
 * a diferencia de los ribbons claros de H2/H3.
 */
const LEVEL4_FONT_SIZE = 8.0;
const LEVEL4_LINE_H = 4.4;
const LEVEL4_MIN_H = 6.6;
const LEVEL4_PAD = 5;

interface Level4BoxMetrics {
  badge: string;
  lines: string[];
  height: number;
}

function resolveLevel4Color(title: string, fallback: RGB): RGB {
  return resolveLevel4FillRgb(title, fallback);
}

function prepareLevel4Box(doc: jsPDF, title: string, drawWidth: number): Level4BoxMetrics {
  const badgeMatch = title.match(/^([A-Za-z]\d?)\.\s+/);
  const badge = badgeMatch ? `${badgeMatch[1].toUpperCase()}.` : '';
  const label = badgeMatch ? title.slice(badgeMatch[0].length).trim() : title;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(LEVEL4_FONT_SIZE);
  const badgeW = badge ? doc.getTextWidth(badge) + 6 : 0;
  const clean = sanitizePdfText(label);
  const lines =
    (doc.splitTextToSize(clean, Math.max(30, drawWidth - LEVEL4_PAD * 2 - badgeW)) as string[]) || [];
  if (lines.length === 0) lines.push(clean);

  const height = Math.max(LEVEL4_MIN_H, LEVEL4_MIN_H + (lines.length - 1) * LEVEL4_LINE_H);
  return { badge, lines, height };
}

function drawLevel4Box(
  doc: jsPDF,
  box: Level4BoxMetrics,
  opts: { margin: number; drawWidth: number; y: number; themeColor: RGB; textColor: RGB }
): number {
  const { margin, drawWidth, themeColor, textColor } = opts;
  const y = opts.y;
  const { badge, lines, height } = box;

  doc.setFillColor(...themeColor);
  doc.roundedRect(margin, y, drawWidth, height, 1.2, 1.2, 'F');

  if (badge) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.6);
    const badgeW = doc.getTextWidth(badge) + 5;
    const badgeX = margin + drawWidth - badgeW - 3;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(badgeX, y + 1.2, badgeW, height - 2.4, 0.9, 0.9, 'F');
    doc.setTextColor(...themeColor);
    doc.text(badge, badgeX + badgeW / 2, y + height / 2 + 0.8, { align: 'center' });
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(LEVEL4_FONT_SIZE);
  doc.setTextColor(...textColor);
  const blockH = lines.length * LEVEL4_LINE_H;
  const startY = y + Math.max(0, (height - blockH) / 2) + 2.9;
  lines.forEach((text, i) => {
    doc.text(text, margin + LEVEL4_PAD, startY + i * LEVEL4_LINE_H);
  });

  return y + height;
}

/**
 * Renderiza el documento completo de un recurso didáctico (Extra) en jsPDF.
 */
export function renderExtraDocument(
  doc: jsPDF,
  extra: ExtraInput,
  context?: BrandingContext,
  densityOverride?: ExtraDensity
): jsPDF {
  // H-056 / H-058: Asegurar fuentes editoriales si no fueron inicializadas por el llamador
  if (!areEditorialFontsLoaded(doc)) {
    loadEditorialFonts(doc);
  }

  const branding = resolveHeaderBranding(extra.type, context);
  const typeColor = branding.color || NAVY;
  const typeLabel = branding.typeLabel;
  const hasTopSup = Boolean(branding.topSup);

  const isRubric = extra.type === 'rubric';
  // Ajuste inteligente de densidad: el plan de clase (29-30 renglones) debe caber en
  // una sola hoja sin sacrificar legibilidad; el resto de extras conserva su métrica normal.
  const density: ExtraDensity =
    densityOverride ?? (extra.type === 'lesson_plan' ? 'compact' : 'normal');
  const isUltra = density === 'ultra';
  const isNormal = density === 'normal';
  const compact = !isNormal;
  const bodyFontSize = isUltra ? 7.1 : compact ? 7.6 : 8.0;
  const smallFontSize = isUltra ? 6.9 : compact ? 7.4 : 7.8;
  const bodyLineHeight = isUltra ? 3.65 : compact ? 4.1 : 4.6;
  const gapEmpty = isUltra ? 0.4 : compact ? 0.6 : 1.5;
  const gapDivider = isUltra ? 1.8 : compact ? 2.5 : 4.5;
  const gapH1 = isUltra ? 4.6 : compact ? 5.0 : 7.0;
  const bottomReserve = isUltra ? 12 : compact ? 15 : 16;
  // Listas de cotejo y materiales son tablas largas: se densifican para que la
  // última fila no quede huérfana en una página casi vacía al final del documento.
  const denseTable = extra.type === 'checklist' || extra.type === 'material';

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 13;
  const contentW = pageWidth - margin * 2;
  let y = margin;

  // La métrica del título se calcula YA con el tamaño con el que se dibuja (9 pt):
  // con el tamaño previo de la pila jsPDF (16 pt) se sobreestimaba el alto de cabecera.
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  const titleLines = doc.splitTextToSize(extra.title, contentW - 10) as string[];
  const titleLineHeight = isUltra ? 3.9 : compact ? 4.0 : 4.5;
  const titleStartY = hasTopSup
    ? (isUltra ? 24.5 : compact ? 24.5 : 25.5)
    : (isUltra ? 17.5 : 18.5);
  const minHeader = isUltra ? 26 : compact ? 28 : 36;
  const headerHeight = Math.max(
    minHeader,
    titleStartY + Math.max(0, titleLines.length - 1) * titleLineHeight + 1.4
  );

  // ── Páginas con contenido de cuerpo (para descartar páginas finales vacías) ──
  const contentPages = new Set<number>();
  const markContent = () => contentPages.add(doc.getCurrentPageInfo().pageNumber);
  contentPages.add(1); // la cabecera institucional siempre ocupa la página 1

  // ── Cabecera institucional (Página 1) ──────────────────────────────────────
  doc.setFillColor(...typeColor);
  doc.rect(0, 0, pageWidth, headerHeight, 'F');

  if (hasTopSup) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...GRAY_BG);
    doc.text(branding.topSup, pageWidth / 2, 10, { align: 'center' });
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...GOLD);
  doc.text(typeLabel, pageWidth / 2, hasTopSup ? 19 : 13, { align: 'center' });

  doc.setFontSize(9);
  doc.setTextColor(...WHITE);
  let titleY = titleStartY;
  titleLines.forEach((line) => {
    doc.text(line, pageWidth / 2, titleY, { align: 'center' });
    titleY += titleLineHeight;
  });

  y = headerHeight + (compact ? 2 : 3);
  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageWidth - margin, y);
  y += compact ? 4.6 : 6;

  const addNewPage = () => {
    doc.addPage();
    doc.setFillColor(...typeColor);
    doc.rect(0, 0, pageWidth, 12, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...WHITE);
    doc.text(`${INSTITUTIONAL_DEFAULTS.ORGANISMO} · ${branding.shortLabel} · ${extra.title.substring(0, 85)}`, margin, 8);
    doc.setTextColor(...GOLD);
    doc.text(branding.cycle, pageWidth - margin, 8, { align: 'right' });
    y = margin + 6;
  };

  // ── Parsing de líneas y componentes ───────────────────────────────────────
  const contentToParse = getExtraContentForRender(extra);
  const lines = contentToParse.split('\n');
  let inTable = false;
  let tableHeaders: string[] = [];
  let tableData: string[][] = [];

  const flushTable = () => {
    if (!inTable || tableHeaders.length === 0) return;

    // Filtrar columnas vacías (todas las celdas son "", "-", "—" o "N/A")
    const colCount0 = tableHeaders.length;
    const keepIdx: number[] = [];
    for (let c = 0; c < colCount0; c++) {
      const hasContent = tableData.some(
        (row) => {
          const cell = (row[c] ?? '').trim();
          return cell !== '' && cell !== '-' && cell !== '—' && cell.toLowerCase() !== 'n/a';
        }
      );
      if (hasContent) keepIdx.push(c);
    }
    // Si todo queda vacío, conservar original
    const effectiveKeep = keepIdx.length > 0 ? keepIdx : tableHeaders.map((_, i) => i);
    const filteredHeaders = effectiveKeep.map((i) => tableHeaders[i]);
    const filteredData = tableData.map((row) => effectiveKeep.map((i) => row[i] ?? ''));

    const colCount = filteredHeaders.length;
    let colWidths: number[];
    if (colCount === 5 && isRubric) {
      // Rúbrica landscape: criterio ancho + 4 niveles iguales
      const c1 = Math.round(contentW * 0.24);
      const rest = Math.round((contentW - c1) / 4);
      colWidths = [c1, rest, rest, rest, contentW - c1 - rest * 3];
    } else if (colCount > 2) {
      // Distribución proporcional al contenido máximo de cada columna
      const maxLens = filteredHeaders.map((h, c) =>
        Math.max(h.length, ...filteredData.map((row) => (row[c] ?? '').length), 1)
      );
      const totalLen = maxLens.reduce((a, b) => a + b, 0);
      const minW = 14;
      const usable = contentW - minW * colCount;
      colWidths = maxLens.map((l) => minW + Math.round((usable * l) / totalLen));
      const diff = contentW - colWidths.reduce((a, b) => a + b, 0);
      colWidths[colWidths.length - 1] += diff;
    } else {
      const eq = Math.floor(contentW / colCount);
      colWidths = Array(colCount - 1).fill(eq);
      colWidths.push(contentW - eq * (colCount - 1));
    }

    autoTable(doc, {
      startY: y,
      head: [
        filteredHeaders.map((h) => ({
          content: h,
          styles: { fillColor: MID, textColor: WHITE, fontStyle: 'bold', halign: 'center' },
        })),
      ],
      body: filteredData.map((row) =>
        row.map((cell, cellIdx) => {
          const isCheck = cell === 'Sí' || cell === 'No' || /^\d+%$/.test(cell);
          const cellLower = cell.toLowerCase();
          const isApertura = cellIdx === 0 && cellLower.includes('apertura');
          const isDesarrollo =
            cellIdx === 0 &&
            (cellLower.includes('desarrollo') ||
              cellLower.includes('ejecución') ||
              cellLower.includes('ejecucion'));
          const isCierre =
            cellIdx === 0 &&
            (cellLower.includes('cierre') ||
              cellLower.includes('conclusión') ||
              cellLower.includes('conclusion'));

          let cellFill: RGB = WHITE;
          let cellText: RGB = TEXT;
          if (isApertura)   { cellFill = [240, 249, 255]; cellText = PHASE_APERTURA; }
          if (isDesarrollo) { cellFill = [240, 253, 244]; cellText = PHASE_DESARROLLO; }
          if (isCierre)     { cellFill = [255, 247, 237]; cellText = PHASE_CIERRE; }

          return {
            content: cell,
            styles: {
              fillColor: cellFill,
              textColor: cellText,
              halign: isCheck ? 'center' : 'left',
              fontStyle: isCheck ? 'bold' : 'normal',
            },
          };
        })
      ),
      styles: {
        fontSize: isRubric ? 6.5 : denseTable ? 6.9 : 7.2,
        cellPadding: isRubric ? 1.8 : denseTable ? 2.1 : 2.8,
        lineColor: [200, 210, 225],
        lineWidth: 0.25,
        font: 'helvetica',
      },
      headStyles: {
        fillColor: MID,
        textColor: WHITE,
        fontStyle: 'bold',
        fontSize: isRubric ? 7.0 : denseTable ? 7.2 : 7.5,
      },
      columnStyles: colWidths.reduce<Record<number, { cellWidth: number }>>((acc, w, i) => {
        acc[i] = { cellWidth: w };
        return acc;
      }, {}),
      margin: { top: 16, left: margin, right: margin, bottom: isRubric || denseTable ? 12 : 14 },
      theme: 'grid',
      pageBreak: 'auto',
      // Rúbricas: nunca partir una fila de criterio entre dos hojas (dejaba en la
      // última página solo la última línea de cada celda, aparentando página en blanco).
      rowPageBreak: isRubric ? 'avoid' : 'auto',
      didDrawPage: (data) => {
        markContent();
        if (data.pageNumber > 1) {
          doc.setFillColor(...typeColor);
          doc.rect(0, 0, pageWidth, 12, 'F');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.5);
          doc.setTextColor(...WHITE);
          doc.text(`${INSTITUTIONAL_DEFAULTS.ORGANISMO} · ${branding.shortLabel} · ${extra.title.substring(0, 55)}`, margin, 8);
          doc.setTextColor(...GOLD);
          doc.text(branding.cycle, pageWidth - margin, 8, { align: 'right' });
        }
      },
    });

    y = (doc.lastAutoTable?.finalY ?? y) + 4;
    inTable = false;
    tableHeaders = [];
    tableData = [];
  };

  // ── Ítems cortos (materiales / insumos / casillas) en 2 columnas ──────────
  // Las listas largas de materiales salían 1 ítem por renglón a ancho completo;
  // los ítems cortos consecutivos se reparten ahora en 2 columnas (pares a la
  // izquierda). Los ítems largos (p.ej. "Rol del Docente: …") conservan 1 columna.
  const TWO_COL_MAX_ITEM_CHARS = 110;
  const TWO_COL_MIN_ITEMS = 3;
  const TWO_COL_GAP = 8;

  const detectItemKind = (text: string): 'bullet' | 'check' | null => {
    if (/^(\[[ xX]\]|\(\s*\))\s*\S/.test(text)) return 'check';
    if (/^[-*•]\s+\S/.test(text)) return 'bullet';
    return null;
  };

  const itemTextOf = (text: string, kind: 'bullet' | 'check'): string =>
    kind === 'check'
      ? text.replace(/^(\[[ xX]\]|\(\s*\))\s*/, '')
      : text.replace(/^[-*•]\s+/, '');

  const collectItemRun = (
    start: number
  ): { items: string[]; kind: 'bullet' | 'check'; next: number } | null => {
    const kind = detectItemKind(lines[start]);
    if (!kind) return null;
    const items: string[] = [];
    let idx = start;
    while (idx < lines.length) {
      const raw = lines[idx].trim();
      if (detectItemKind(raw) !== kind) break;
      const text = itemTextOf(raw, kind);
      if (text.length > TWO_COL_MAX_ITEM_CHARS) break;
      items.push(text);
      idx++;
    }
    if (items.length < TWO_COL_MIN_ITEMS) return null;
    return { items, kind, next: idx };
  };

  const countItemLines = (text: string, width: number): number => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(smallFontSize);
    const clean = text.replace(/\*\*/g, '');
    const wrapped = doc.splitTextToSize(clean, Math.max(20, width * 0.96)) as string[];
    return Math.max(1, wrapped.length);
  };

  const drawItemInColumn = (
    text: string,
    kind: 'bullet' | 'check',
    colX: number,
    colY: number,
    colW: number
  ): void => {
    if (kind === 'check') {
      doc.setDrawColor(...typeColor);
      doc.setFillColor(...WHITE);
      doc.setLineWidth(0.4);
      doc.roundedRect(colX + 1, colY - 2.8, 3.2, 3.2, 0.5, 0.5, 'S');
      renderFormattedBlock(doc, text, {
        x: colX + 6,
        y: colY,
        maxWidth: colW - 7,
        pageHeight,
        lineHeight: bodyLineHeight,
        bottomReserve,
        addNewPage,
        fontSize: smallFontSize,
      });
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.0);
      doc.setTextColor(...ACCENT);
      doc.text('•', colX + 1, colY);
      renderFormattedBlock(doc, text, {
        x: colX + 5,
        y: colY,
        maxWidth: colW - 6,
        pageHeight,
        lineHeight: bodyLineHeight,
        bottomReserve,
        addNewPage,
        fontSize: smallFontSize,
      });
    }
  };

  const renderTwoColumnItems = (items: string[], kind: 'bullet' | 'check'): number => {
    const colW = (contentW - TWO_COL_GAP) / 2;
    const textW = colW - 6;
    let idx = 0;
    let yCur = y;
    while (idx < items.length) {
      const left = items[idx];
      const right = items[idx + 1];
      const rows = Math.max(
        countItemLines(left, textW),
        right ? countItemLines(right, textW) : 1
      );
      const rowH = rows * bodyLineHeight + 1.4;
      if (yCur + rowH > pageHeight - bottomReserve) {
        if (yCur <= 24) break; // sin espacio efectivo: no buclear
        addNewPage();
        yCur = 22;
      }
      drawItemInColumn(left, kind, margin, yCur, colW);
      if (right) drawItemInColumn(right, kind, margin + colW + TWO_COL_GAP, yCur, colW);
      yCur += rowH;
      idx += 2;
    }
    markContent();
    return yCur;
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();

    if (line.startsWith('|')) {
      if (/^\|[\s:-|]+$/.test(line)) continue; // Separador |---|---|
      const cells = line.split('|').slice(1, -1).map((c) => c.trim());
      if (!inTable) {
        inTable = true;
        tableHeaders = cells;
        tableData = [];
      } else {
        tableData.push(cells);
      }
      continue;
    }

    if (inTable) flushTable();

    if (line.trim() === '<!-- pagebreak -->' || line.trim() === '[[pagebreak]]') {
      if (y > margin + 10) addNewPage();
      continue;
    }

    if (line === '') {
      y += gapEmpty;
      continue;
    }

    // Encabezado H1 (# ...)
    if (line.startsWith('# ')) {
      const text = line.replace(/^#\s+/, '');
      if (y > pageHeight - 24) { addNewPage(); }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(...MID);
      doc.text(text, margin, y);
      doc.setDrawColor(...ACCENT);
      doc.setLineWidth(0.6);
      doc.line(margin, y + 2.0, margin + Math.min(doc.getTextWidth(text), contentW), y + 2.0);
      y += gapH1;
      markContent();
      continue;
    }

    // Encabezado H2 (## ...) con drawSectionRibbon
    if (line.startsWith('## ')) {
      const text = line.replace(/^##\s+/, '');
      const lower = text.toLowerCase();
      let themeColor: RGB = typeColor;
      let badge: string | undefined;

      if (lower.includes('apertura') || lower.includes('activación') || lower.includes('inicio')) {
        themeColor = PHASE_APERTURA;
        badge = 'APERTURA';
      } else if (lower.includes('desarrollo') || lower.includes('ejecución') || lower.includes('ejecucion')) {
        themeColor = PHASE_DESARROLLO;
        badge = 'DESARROLLO';
      } else if (lower.includes('cierre') || lower.includes('conclusión') || lower.includes('conclusion')) {
        themeColor = PHASE_CIERRE;
        badge = 'CIERRE';
      }

      if (y > pageHeight - 20) { addNewPage(); }
      y = drawSectionRibbon(doc, {
        title: text,
        margin,
        drawWidth: contentW,
        y,
        themeColor,
        ribbonHeight: isUltra ? 6.8 : compact ? 7.0 : 8.0,
        badge,
      });
      y += isUltra ? 1.4 : compact ? 1.6 : 2.5;
      markContent();
      continue;
    }

    // Encabezado H3 (### ...) con drawSectionRibbon compacto
    if (line.startsWith('### ')) {
      const text = line.replace(/^###\s+/, '');
      const lower = text.toLowerCase();
      let themeColor: RGB = typeColor;
      let badge: string | undefined;

      if (lower.includes('apertura')) {
        themeColor = PHASE_APERTURA;
        badge = 'FASE I';
      } else if (lower.includes('desarrollo') || lower.includes('ejecucion') || lower.includes('ejecución')) {
        themeColor = PHASE_DESARROLLO;
        badge = 'FASE II';
      } else if (lower.includes('cierre') || lower.includes('conclusion') || lower.includes('conclusión')) {
        themeColor = PHASE_CIERRE;
        badge = 'FASE III';
      }

      if (y > pageHeight - bottomReserve) { addNewPage(); }
      y = drawSectionRibbon(doc, {
        title: text,
        margin,
        drawWidth: contentW,
        y,
        themeColor,
        ribbonHeight: compact ? 6.6 : 6.8,
        badge,
      });
      y += isUltra ? 1.0 : compact ? 1.2 : 2.0;
      markContent();
      continue;
    }

    // Cajas de color H4 (####) — bloques de sesión del solucionario (A–E)
    if (line.startsWith('#### ')) {
      const text = line.replace(/^####\s+/, '');
      const themeColor = resolveLevel4Color(text, typeColor);
      const box = prepareLevel4Box(doc, text, contentW);
      if (y + box.height > pageHeight - 15) { addNewPage(); }
      y = drawLevel4Box(doc, box, {
        margin,
        drawWidth: contentW,
        y,
        themeColor,
        textColor: resolveLevel4TextRgb(text),
      });
      y += 2.2;
      markContent();
      continue;
    }

    // Citas pedagógicas (> ...) con drawCalloutBox
    if (line.startsWith('> ')) {
      const calloutText = line.replace(/^>\s*/, '');
      const lower = calloutText.toLowerCase();
      const isAlert = lower.includes('importante') || lower.includes('seguridad') || lower.includes('peligro') || lower.includes('precaución');
      const isNote = lower.includes('nota') || lower.includes('didáctica') || lower.includes('docente') || lower.includes('confidencial');

      if (y > pageHeight - 25) { addNewPage(); }
      const callout: CalloutBoxData = {
        title: isAlert ? 'ATENCIÓN Y SEGURIDAD' : isNote ? 'ORIENTACIÓN PEDAGÓGICA' : 'PUNTO CLAVE',
        body: calloutText,
        content: calloutText,
        accent: isAlert ? '#e65100' : isNote ? '#1b6b8a' : '#2563eb',
        accentRgb: isAlert ? [230, 81, 0] : isNote ? [27, 107, 138] : [37, 99, 235],
        bgHex: isAlert ? '#fff7ed' : isNote ? '#f0f9ff' : '#eff6ff',
        bgRgb: isAlert ? [255, 247, 237] : isNote ? [240, 249, 255] : [239, 246, 255],
        type: isAlert ? 'alerta' : 'orientacion',
        badge: isAlert ? 'SEGURIDAD' : isNote ? 'DOCENTE' : 'MCCEMS',
        icon: isAlert ? '⚠️' : isNote ? '💡' : '📌',
      };

      y = drawCalloutBox(doc, callout, margin, contentW, y);
      y += 2.0;
      markContent();
      continue;
    }

    // Divisores horizontales (--- o ***)
    if (/^[-*_]{3,}$/.test(line)) {
      if (y > pageHeight - 15) { addNewPage(); }
      doc.setDrawColor(...ACCENT);
      doc.setLineWidth(0.4);
      doc.line(margin, y, pageWidth - margin, y);
      y += gapDivider;
      markContent();
      continue;
    }

    // Casillas de verificación ([ ] / [x] / ( ))
    const checkMatch = line.match(/^(\[[ xX]\]|\(\s*\))\s*(.*)/);
    if (checkMatch) {
      const checkRun = collectItemRun(i);
      if (checkRun && checkRun.kind === 'check') {
        y = renderTwoColumnItems(checkRun.items, checkRun.kind);
        i = checkRun.next - 1;
        continue;
      }
      const isChecked = checkMatch[1].toLowerCase().includes('x');
      const checkText = checkMatch[2];
      if (y > pageHeight - bottomReserve) { addNewPage(); }

      doc.setDrawColor(...typeColor);
      doc.setFillColor(...(isChecked ? typeColor : WHITE));
      doc.setLineWidth(0.4);
      doc.roundedRect(margin + 2, y - 2.8, 3.4, 3.4, 0.5, 0.5, isChecked ? 'FD' : 'S');
      if (isChecked) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.0);
        doc.setTextColor(...WHITE);
        doc.text('•', margin + 2.8, y - 0.4);
      }

      y = renderFormattedBlock(doc, checkText, {
        x: margin + 8,
        y,
        maxWidth: contentW - 10,
        pageHeight,
        lineHeight: bodyLineHeight,
        bottomReserve,
        addNewPage,
        fontSize: smallFontSize,
      });
      markContent();
      continue;
    }

    // Listas con viñetas (- / * / •)
    if (line.startsWith('- ') || line.startsWith('* ') || line.startsWith('• ')) {
      const bulletRun = collectItemRun(i);
      if (bulletRun && bulletRun.kind === 'bullet') {
        y = renderTwoColumnItems(bulletRun.items, bulletRun.kind);
        i = bulletRun.next - 1;
        continue;
      }
      const content = line.replace(/^[-*•]\s+/, '');
      if (y > pageHeight - bottomReserve) { addNewPage(); }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.0);
      doc.setTextColor(...ACCENT);
      doc.text('•', margin + 2, y);

      y = renderFormattedBlock(doc, content, {
        x: margin + 6,
        y,
        maxWidth: contentW - 8,
        pageHeight,
        lineHeight: bodyLineHeight,
        bottomReserve,
        addNewPage,
        fontSize: smallFontSize,
      });
      markContent();
      continue;
    }

    // Listas numeradas (1. / 2. / etc.)
    const numMatch = line.match(/^(\d+)\.\s*(.*)/);
    if (numMatch) {
      const num = numMatch[1];
      const content = numMatch[2];
      if (y > pageHeight - bottomReserve) { addNewPage(); }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.8);
      doc.setTextColor(...MID);
      doc.text(`${num}.`, margin + 2, y);
      const numWidth = doc.getTextWidth(`${num}. `);

      y = renderFormattedBlock(doc, content, {
        x: margin + 2 + numWidth,
        y,
        maxWidth: contentW - (4 + numWidth),
        pageHeight,
        lineHeight: bodyLineHeight,
        bottomReserve,
        addNewPage,
        fontSize: smallFontSize,
      });
      markContent();
      continue;
    }

    // Párrafo regular de texto con soporte de negritas en línea
    if (y > pageHeight - bottomReserve) { addNewPage(); }
    y = renderFormattedBlock(doc, line, {
      x: margin,
      y,
      maxWidth: contentW,
      pageHeight,
      lineHeight: bodyLineHeight,
      bottomReserve,
      addNewPage,
      fontSize: bodyFontSize,
    });
    markContent();
  }

  if (inTable) flushTable();

  // ── Páginas finales sin contenido de cuerpo (solo cabecera/pie) ─────────────
  // El bucle de paginación puede crear una hoja nueva al romper página aunque solo
  // sobre una última línea; si en esa hoja no llegó a dibujarse nada de cuerpo, el
  // usuario la ve como "página sin información". Se eliminan de atrás hacia adelante.
  let lastPage = doc.getNumberOfPages();
  while (lastPage > 1 && !contentPages.has(lastPage)) {
    doc.deletePage(lastPage);
    lastPage--;
  }

  // ── Pie de página uniforme en todas las páginas compiladas ───────────────────
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    const footer = resolveFooterBranding(extra.type, extra.title, context, p, totalPages, extra.keyIndex);

    doc.setDrawColor(...footer.dividerColor);
    doc.setLineWidth(0.5);
    doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...footer.textColor);
    doc.text(
      `${footer.leftText}  —  ${footer.rightText}`,
      pageWidth / 2,
      pageHeight - 5.5,
      { align: 'center' }
    );
  }

  return doc;
}

/**
 * Selecciona la menor densidad con la que el plan de clase cabe en UNA sola hoja.
 * Se sondea con renderizados reales (sin IA ni BD): `compact` primero y `ultra` como
 * último recurso. Si ni `ultra` alcanza, se conserva `compact` para no degradar la
 * legibilidad de un documento que igualmente necesita dos hojas de contenido pleno.
 */
export function resolveExtraDensity(
  extra: ExtraInput,
  context?: BrandingContext
): ExtraDensity {
  if (extra.type !== 'lesson_plan') return 'normal';

  const fitsOnePage = (density: ExtraDensity): boolean => {
    const probe = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
    renderExtraDocument(probe, extra, context, density);
    return probe.getNumberOfPages() === 1;
  };

  if (fitsOnePage('compact')) return 'compact';
  return fitsOnePage('ultra') ? 'ultra' : 'compact';
}

/**
 * Inicializa e instancia un documento jsPDF con la orientación adecuada
 * y renderiza el recurso extra didáctico institucionalmente.
 */
export function generateExtraPdfDocument(
  extra: ExtraInput,
  context?: BrandingContext
): jsPDF {
  const isRubric = extra.type === 'rubric';
  const orientation = isRubric ? 'landscape' : 'portrait';
  const doc = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'letter',
  });
  return renderExtraDocument(doc, extra, context, resolveExtraDensity(extra, context));
}

