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
  type RGB,
} from '@/lib/visual-engine/design-tokens';
import {
  drawSectionRibbon,
  drawCalloutBox,
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
}

export interface FormattedBlockOptions {
  x: number;
  y: number;
  maxWidth: number;
  pageHeight: number;
  lineHeight?: number;
  fontSize?: number;
  textColor?: RGB;
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

      if (currentY > pageHeight - 16) {
        addNewPage();
        currentY = 22;
      }
    }

    doc.text(token.word, currentX, currentY);
    currentX += wordW;
  }

  return currentY + lineHeight;
}

/**
 * Renderiza el documento completo de un recurso didáctico (Extra) en jsPDF.
 */
export function renderExtraDocument(
  doc: jsPDF,
  extra: ExtraInput,
  context?: BrandingContext
): jsPDF {
  // H-056 / H-058: Asegurar fuentes editoriales si no fueron inicializadas por el llamador
  if (!areEditorialFontsLoaded(doc)) {
    loadEditorialFonts(doc);
  }

  const branding = resolveHeaderBranding(extra.type, context);
  const typeColor = branding.color || NAVY;
  const typeLabel = branding.typeLabel;

  const isRubric = extra.type === 'rubric';
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 13;
  const contentW = pageWidth - margin * 2;
  let y = margin;

  const titleLines = doc.splitTextToSize(extra.title, contentW - 10) as string[];
  const titleLineHeight = 4.5;
  const headerHeight = Math.max(36, 23 + titleLines.length * titleLineHeight + 4);

  // ── Cabecera institucional (Página 1) ──────────────────────────────────────
  doc.setFillColor(...typeColor);
  doc.rect(0, 0, pageWidth, headerHeight, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...GRAY_BG);
  doc.text(branding.topSup, pageWidth / 2, 10, { align: 'center' });

  doc.setFontSize(13);
  doc.setTextColor(...GOLD);
  doc.text(typeLabel, pageWidth / 2, 19, { align: 'center' });

  doc.setFontSize(9);
  doc.setTextColor(...WHITE);
  let titleY = 25.5;
  titleLines.forEach((line) => {
    doc.text(line, pageWidth / 2, titleY, { align: 'center' });
    titleY += titleLineHeight;
  });

  y = headerHeight + 3;
  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

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
  const lines = (extra.content_text || '').split('\n');
  let inTable = false;
  let tableHeaders: string[] = [];
  let tableData: string[][] = [];

  const flushTable = () => {
    if (!inTable || tableHeaders.length === 0) return;

    const colCount = tableHeaders.length;
    let colWidths: number[];
    if (colCount === 5) {
      const c1 = Math.round(contentW * 0.24);
      const rest = Math.round((contentW - c1) / 4);
      colWidths = [c1, rest, rest, rest, contentW - c1 - rest * 3];
    } else if (colCount === 4) {
      const c1 = Math.round(contentW * 0.5);
      const c2 = Math.round(contentW * 0.1);
      colWidths = [c1, c2, c2, contentW - c1 - c2 * 2];
    } else {
      const eq = Math.floor(contentW / colCount);
      colWidths = Array(colCount - 1).fill(eq);
      colWidths.push(contentW - eq * (colCount - 1));
    }

    autoTable(doc, {
      startY: y,
      head: [
        tableHeaders.map((h) => ({
          content: h,
          styles: { fillColor: MID, textColor: WHITE, fontStyle: 'bold', halign: 'center' },
        })),
      ],
      body: tableData.map((row) =>
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
        fontSize: isRubric ? 6.5 : 7.2,
        cellPadding: isRubric ? 2.2 : 2.8,
        lineColor: [200, 210, 225],
        lineWidth: 0.25,
        font: 'helvetica',
      },
      headStyles: {
        fillColor: MID,
        textColor: WHITE,
        fontStyle: 'bold',
        fontSize: isRubric ? 7.0 : 7.5,
      },
      columnStyles: colWidths.reduce<Record<number, { cellWidth: number }>>((acc, w, i) => {
        acc[i] = { cellWidth: w };
        return acc;
      }, {}),
      margin: { top: 16, left: margin, right: margin, bottom: 14 },
      theme: 'grid',
      pageBreak: 'auto',
      didDrawPage: (data) => {
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

    if (line === '') {
      y += 1.5;
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
      doc.line(margin, y + 1.2, margin + Math.min(doc.getTextWidth(text), contentW), y + 1.2);
      y += 7.0;
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
        ribbonHeight: 8.0,
        badge,
      });
      y += 2.5;
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

      if (y > pageHeight - 16) { addNewPage(); }
      y = drawSectionRibbon(doc, {
        title: text,
        margin,
        drawWidth: contentW,
        y,
        themeColor,
        ribbonHeight: 6.8,
        badge,
      });
      y += 2.0;
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
      continue;
    }

    // Divisores horizontales (--- o ***)
    if (/^[-*_]{3,}$/.test(line)) {
      if (y > pageHeight - 15) { addNewPage(); }
      doc.setDrawColor(...ACCENT);
      doc.setLineWidth(0.4);
      doc.line(margin, y, pageWidth - margin, y);
      y += 4.5;
      continue;
    }

    // Casillas de verificación ([ ] / [x] / ( ))
    const checkMatch = line.match(/^(\[[ xX]\]|\(\s*\))\s*(.*)/);
    if (checkMatch) {
      const isChecked = checkMatch[1].toLowerCase().includes('x');
      const checkText = checkMatch[2];
      if (y > pageHeight - 16) { addNewPage(); }

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
        addNewPage,
        fontSize: 7.8,
      });
      continue;
    }

    // Listas con viñetas (- / * / •)
    if (line.startsWith('- ') || line.startsWith('* ') || line.startsWith('• ')) {
      const content = line.replace(/^[-*•]\s+/, '');
      if (y > pageHeight - 16) { addNewPage(); }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.0);
      doc.setTextColor(...ACCENT);
      doc.text('•', margin + 2, y);

      y = renderFormattedBlock(doc, content, {
        x: margin + 6,
        y,
        maxWidth: contentW - 8,
        pageHeight,
        addNewPage,
        fontSize: 7.8,
      });
      continue;
    }

    // Listas numeradas (1. / 2. / etc.)
    const numMatch = line.match(/^(\d+)\.\s*(.*)/);
    if (numMatch) {
      const num = numMatch[1];
      const content = numMatch[2];
      if (y > pageHeight - 16) { addNewPage(); }

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
        addNewPage,
        fontSize: 7.8,
      });
      continue;
    }

    // Párrafo regular de texto con soporte de negritas en línea
    if (y > pageHeight - 16) { addNewPage(); }
    y = renderFormattedBlock(doc, line, {
      x: margin,
      y,
      maxWidth: contentW,
      pageHeight,
      addNewPage,
      fontSize: 8.0,
    });
  }

  if (inTable) flushTable();

  // ── Pie de página uniforme en todas las páginas compiladas ───────────────────
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    const footer = resolveFooterBranding(extra.type, extra.title, context, p, totalPages);

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
  return renderExtraDocument(doc, extra, context);
}

