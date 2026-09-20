/**
 * column-flow-manager.ts — Motor de Flujo de Columnas y Sidebar Rotativo V7
 * DBEPA Puebla MCCEMS 2026-2027
 *
 * Capa 5 de la Arquitectura Editorial:
 * 1. Gestiona el flujo continuo de la columna principal (68%) y el sidebar (28%).
 * 2. Mantiene una cola rotativa de widgets para el sidebar:
 *    - No repite el mismo widget en múltiples páginas.
 *    - Distribuye el glosario en lotes ordenados entre páginas.
 *    - Si una página se queda sin widgets de contenido, inyecta el Mini-Widget QR.
 *    - Garantiza: 0 páginas con sidebar vacío en las misiones.
 * 3. Registra el contexto de cada página en `pageContextMap` para la segunda pasada
 *    de cabeceras (drawPageHeader) y pies de página (drawPageFooter).
 */

import type jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  COLOR,
  SIDEBAR_GAP,
  type RGB,
} from './design-tokens';
import {
  setFontBody,
} from './font-loader';
import {
  drawGlossaryWidget,
  drawRealLifeWidget,
  drawSafetyWidget,
  drawQrMiniWidget,
  drawAnalogyWidget,
  drawStudyTipWidget,
  drawSidebarHeaderBadge,
  drawNotesWidget,
  drawChecklistWidget,
  drawEquipmentCardWidget,
  drawDigitalToolCardWidget,
  sanitizePdfText,
} from './pdf-components';
import { stripMarkdown, type GlossaryItem } from './content-extractor';
import type { DetectedObject } from './object-extractor';
import type { DigitalTool } from './digital-tools-registry';

export interface PageContext {
  isSpecialPage?: boolean;
  uacName: string;
  missionTitle?: string;
  missionColor?: RGB;
  blockName?: string;
  sectionLabel?: string;
}

export interface SidebarWidgetQueueItem {
  id: string;
  minHeight: number;
  draw: (doc: jsPDF, sideXAbs: number, sideW: number, startY: number, sideBottom: number) => number;
}

export interface ColumnFlowManagerOptions {
  doc: jsPDF;
  margin: number;
  contentWidth: number;
  pageHeight: number;
  mainW: number;
  sideW: number;
  sideXAbs: number;
  pageContextMap: Map<number, PageContext>;
  subjectName: string;
  blockName: string;
  missionNumber: number;
  cleanMissionTitle: string;
  momentColor: RGB;
  qrBuffer?: Buffer;
  verificationUrl?: string;
  missionHash?: string;
  glossaryTerms?: GlossaryItem[] | null;
  realLifeConnection?: { context?: string; householdApplication: string; localExample?: string } | null;
  safetyTip?: string | null;
  physicalAnalogy?: string | null;
  equipmentCard?: {
    detected: DetectedObject;
    imageBuffer: Buffer;
    imageFormat?: 'JPEG' | 'PNG';
  } | null;
  digitalTool?: {
    tool: DigitalTool;
    qrPngBuffer?: Buffer | Uint8Array;
  } | null;
  digitalTools?: Array<{
    tool: DigitalTool;
    qrPngBuffer?: Buffer | Uint8Array;
  }> | null;
}

export class ColumnFlowManager {
  private doc: jsPDF;
  private margin: number;
  private contentWidth: number;
  private pageHeight: number;
  public mainW: number;
  public sideW: number;
  public sideXAbs: number;
  public contentTop: number;
  public contentBottom: number;
  private pageContextMap: Map<number, PageContext>;
  private subjectName: string;
  private blockName: string;
  private missionNumber: number;
  private cleanMissionTitle: string;
  private momentColor: RGB;
  private qrBuffer?: Buffer;
  private verificationUrl?: string;
  private missionHash?: string;

  private sidebarQueue: SidebarWidgetQueueItem[] = [];
  private pagesWithSidebarRendered: Set<number> = new Set();
  private missionPageIndex: number = 0;
  private hasDrawnQr: boolean = false;

  public mainY: number;
  public sideY: number;
  public currentPage: number;

  constructor(opts: ColumnFlowManagerOptions) {
    this.doc = opts.doc;
    this.margin = opts.margin;
    this.contentWidth = opts.contentWidth;
    this.pageHeight = opts.pageHeight;
    this.mainW = opts.mainW;
    this.sideW = opts.sideW;
    this.sideXAbs = opts.sideXAbs;
    this.pageContextMap = opts.pageContextMap;
    this.subjectName = opts.subjectName;
    this.blockName = opts.blockName;
    this.missionNumber = opts.missionNumber;
    this.cleanMissionTitle = opts.cleanMissionTitle;
    this.momentColor = opts.momentColor;
    this.qrBuffer = opts.qrBuffer;
    this.verificationUrl = opts.verificationUrl;
    this.missionHash = opts.missionHash;

    // Límites de contenido vertical para páginas con cabecera y pie editorial
    this.contentTop = opts.margin + 12; // Deja 12mm de margen superior para drawPageHeader
    this.contentBottom = opts.pageHeight - opts.margin - 14; // Deja 14mm para drawPageFooter

    this.mainY = this.contentTop;
    this.sideY = this.contentTop;
    this.currentPage = this.doc.getNumberOfPages();

    this.sidebarQueue = this.buildSidebarQueue(opts);
  }

  /**
   * Construye la cola inicial de widgets didácticos para el sidebar de la misión.
   */
  private buildSidebarQueue(opts: ColumnFlowManagerOptions): SidebarWidgetQueueItem[] {
    const queue: SidebarWidgetQueueItem[] = [];
    const {
      glossaryTerms = [],
      realLifeConnection,
      safetyTip,
      physicalAnalogy,
    } = opts;

    // 0. Ficha Técnica de Instrumental y Equipamiento (si existe)
    if (opts.equipmentCard) {
      const eq = opts.equipmentCard;
      queue.push({
        id: 'equipment_card',
        minHeight: 44,
        draw: (doc, sideXAbs, sideW, startY, sideBottom) => {
          return drawEquipmentCardWidget(doc, {
            detected: eq.detected,
            imageBuffer: eq.imageBuffer,
            imageFormat: eq.imageFormat || 'JPEG',
            sideXAbs,
            sideW,
            startY,
            sideBottom,
          });
        },
      });
    }

    // 0.5 Herramienta(s) Digital(es) MCCEMS con QR interactivo (si existen)
    const dTools = opts.digitalTools?.length
      ? opts.digitalTools
      : (opts.digitalTool ? [opts.digitalTool] : []);

    dTools.forEach((dt, idx) => {
      const isCompact = !!opts.equipmentCard || idx > 0;
      queue.push({
        id: `digital_tool_card_${idx + 1}`,
        minHeight: isCompact ? 32 : 42,
        draw: (doc, sideXAbs, sideW, startY, sideBottom) => {
          return drawDigitalToolCardWidget(doc, {
            tool: dt.tool,
            qrPngBuffer: dt.qrPngBuffer,
            sideXAbs,
            sideW,
            startY,
            sideBottom,
            compact: isCompact,
          });
        },
      });
    });

    // 1. Glosario Lote 1 (primeros 2 términos si existen)
    if (glossaryTerms && glossaryTerms.length > 0) {
      const batch1 = glossaryTerms.slice(0, 2);
      queue.push({
        id: 'glossary_batch_1',
        minHeight: 25,
        draw: (doc, sideXAbs, sideW, startY, sideBottom) => {
          return drawGlossaryWidget(doc, batch1, sideXAbs, sideW, startY, sideBottom);
        },
      });
    }

    // 2. Conexión con Vida Real
    if (realLifeConnection && realLifeConnection.householdApplication) {
      queue.push({
        id: 'real_life',
        minHeight: 28,
        draw: (doc, sideXAbs, sideW, startY, sideBottom) => {
          return drawRealLifeWidget(doc, realLifeConnection, sideXAbs, sideW, startY, sideBottom);
        },
      });
    }

    // 3. Pista de Seguridad / Taller
    if (safetyTip) {
      queue.push({
        id: 'safety_tip',
        minHeight: 24,
        draw: (doc, sideXAbs, sideW, startY, sideBottom) => {
          return drawSafetyWidget(doc, safetyTip, sideXAbs, sideW, startY, sideBottom);
        },
      });
    }

    // 4. Analogía física cotidiana (si existe)
    if (physicalAnalogy) {
      queue.push({
        id: 'analogy',
        minHeight: 22,
        draw: (doc, sideXAbs, sideW, startY, sideBottom) => {
          return drawAnalogyWidget(doc, {
            analogy: physicalAnalogy,
            sideXAbs,
            sideW,
            startY,
            sideBottom,
          });
        },
      });
    }

    // 5. Glosario Lote 2 (términos 2 a 5 si existen)
    if (glossaryTerms && glossaryTerms.length > 2) {
      const batch2 = glossaryTerms.slice(2, 5);
      queue.push({
        id: 'glossary_batch_2',
        minHeight: 25,
        draw: (doc, sideXAbs, sideW, startY, sideBottom) => {
          return drawGlossaryWidget(doc, batch2, sideXAbs, sideW, startY, sideBottom);
        },
      });
    }

    // 6. Consejo de estudio activo / metacognición
    queue.push({
      id: 'study_tip',
      minHeight: 22,
      draw: (doc, sideXAbs, sideW, startY, sideBottom) => {
        return drawStudyTipWidget(doc, {
          tip: 'Registra tus observaciones de inmediato y contrasta los datos empíricos con la teoría antes de emitir conclusiones.',
          sideXAbs,
          sideW,
          startY,
          sideBottom,
        });
      },
    });

    // 7. Criterios de Logro / Autogestión
    queue.push({
      id: 'checklist',
      minHeight: 32,
      draw: (doc, sideXAbs, sideW, startY, sideBottom) => {
        return drawChecklistWidget(doc, {
          sideXAbs,
          sideW,
          startY,
          sideBottom,
        });
      },
    });

    return queue;
  }

  /**
   * Inicializa la primera página de la misión (normalmente después de dibujar el banner de misión).
   */
  public initFirstPage(startY: number): void {
    const pageNum = this.doc.getNumberOfPages();
    this.currentPage = pageNum;
    this.mainY = startY;
    this.populateSidebarForCurrentPage(startY);
  }

  /**
   * Rellena el sidebar para la página actual si aún no se ha dibujado.
   * Drena los widgets disponibles de la cola y, si queda espacio, inyecta el QR mini-widget
   * y rellena cualquier remanente con la Bitácora de Taller, eliminando todo espacio vacío.
   */
  public populateSidebarForCurrentPage(startY: number): void {
    const pageNum = this.doc.getNumberOfPages();
    if (this.pagesWithSidebarRendered.has(pageNum)) {
      return;
    }
    this.pagesWithSidebarRendered.add(pageNum);
    this.missionPageIndex++;

    // Registrar en pageContextMap para segunda pasada
    this.pageContextMap.set(pageNum, {
      uacName: this.subjectName,
      missionTitle: `Misión ${this.missionNumber}: ${this.cleanMissionTitle}`,
      missionColor: this.momentColor,
      blockName: this.blockName,
      sectionLabel: `Misión ${this.missionNumber}`,
    });

    let sy = startY;
    const sideBottom = this.contentBottom;

    // 1. Línea divisoria vertical sutil entre columna principal y sidebar
    const dividerX = this.sideXAbs - SIDEBAR_GAP / 2;
    this.doc.setDrawColor(226, 232, 240);
    this.doc.setLineWidth(0.3);
    this.doc.line(dividerX, startY, dividerX, sideBottom);

    // 2. Badge de fase de la misión para esta página
    let badgeTitle = `MISIÓN ${this.missionNumber} · APERTURA`;
    let badgeSubtitle = 'Marco Curricular Común EMS';
    if (this.missionPageIndex === 2) {
      badgeTitle = `MISIÓN ${this.missionNumber} · DESARROLLO`;
      badgeSubtitle = 'Protocolo de Taller y Práctica';
    } else if (this.missionPageIndex === 3) {
      badgeTitle = `MISIÓN ${this.missionNumber} · SÍNTESIS`;
      badgeSubtitle = 'Consolidación de Evidencias';
    } else if (this.missionPageIndex >= 4) {
      badgeTitle = `MISIÓN ${this.missionNumber} · EVALUACIÓN`;
      badgeSubtitle = 'Reflexión y Metacognición';
    }

    sy = drawSidebarHeaderBadge(this.doc, {
      title: badgeTitle,
      subtitle: badgeSubtitle,
      color: this.momentColor,
      sideXAbs: this.sideXAbs,
      sideW: this.sideW,
      y: sy,
    });

    // 3. Extraer y dibujar widgets de la cola
    // Distribuir equitativamente (máximo 2 por página para mantener variedad continua)
    const maxWidgetsThisPage = 2;
    let widgetsDrawn = 0;

    while (this.sidebarQueue.length > 0 && widgetsDrawn < maxWidgetsThisPage) {
      const nextWidget = this.sidebarQueue[0];
      if (sy + nextWidget.minHeight <= sideBottom - 20) {
        this.sidebarQueue.shift();
        sy = nextWidget.draw(this.doc, this.sideXAbs, this.sideW, sy, sideBottom);
        widgetsDrawn++;
      } else {
        break;
      }
    }

    // 4. Inyectar Mini-Widget QR si la cola se agotó o si estamos en página de consolidación (>= 3)
    if (!this.hasDrawnQr && (this.sidebarQueue.length === 0 || this.missionPageIndex >= 3) && sideBottom - sy >= 32) {
      sy = drawQrMiniWidget(this.doc, {
        sideXAbs: this.sideXAbs,
        sideW: this.sideW,
        startY: sy,
        sideBottom,
        qrBuffer: this.qrBuffer,
        verificationUrl: this.verificationUrl,
        missionHash: this.missionHash,
      });
      this.hasDrawnQr = true;
    }

    // 5. Regla Editorial de Oro: NUNCA sidebar en blanco ni con espacios vacíos
    // Rellenar cualquier espacio restante con la Bitácora / Notas del estudiante
    if (sideBottom - sy >= 18) {
      let notesTitle = 'BITÁCORA DE APERTURA';
      let notesSubtitle = 'Preguntas y notas clave';
      if (this.missionPageIndex === 2) {
        notesTitle = 'NOTAS DE TALLER';
        notesSubtitle = 'Cálculos y mediciones en aula';
      } else if (this.missionPageIndex >= 3) {
        notesTitle = 'REGISTRO DE EVIDENCIA';
        notesSubtitle = 'Conclusiones y compromisos';
      }

      sy = drawNotesWidget(this.doc, {
        sideXAbs: this.sideXAbs,
        sideW: this.sideW,
        startY: sy,
        sideBottom,
        title: notesTitle,
        subtitle: notesSubtitle,
      });
    }

    this.sideY = sy;
  }

  /**
   * Añade una nueva página al documento y configura inmediatamente su columna y sidebar.
   */
  public advancePage(): number {
    this.doc.addPage();
    this.currentPage = this.doc.getNumberOfPages();
    this.mainY = this.contentTop;
    this.populateSidebarForCurrentPage(this.contentTop);
    return this.mainY;
  }

  /**
   * Garantiza que haya espacio vertical en la columna principal.
   * Si no cabe, avanza automáticamente a una nueva página.
   */
  public ensureVerticalSpace(currentY: number, neededHeight: number): number {
    this.mainY = currentY;
    if (this.mainY + neededHeight > this.contentBottom) {
      return this.advancePage();
    }
    return this.mainY;
  }

  /**
   * Hook para tablas autoTable que rompen página internamente.
   */
  public onAutoTablePage(pageNum: number): void {
    if (!this.pagesWithSidebarRendered.has(pageNum)) {
      this.populateSidebarForCurrentPage(this.contentTop);
    }
  }

  /**
   * Wrapper interno para parseMarkdownTable en la instancia del manager.
   */
  private tryExtractMarkdownTable(text: string): { headers: string[]; rows: string[][] } | null {
    return parseMarkdownTable(text);
  }

  /**
   * Imprime un párrafo en la columna principal con justificación completa (excepto última línea)
   * y avanza de página con columna y sidebar sincronizados cuando es necesario.
   */
  public printMainParagraph(
    text: string,
    startPY: number,
    opts: {
      size?: number;
      fontStyle?: 'normal' | 'bold' | 'italic';
      color?: RGB;
      lineHeight?: number;
      justify?: boolean;
      parseParagraphs?: boolean;
      paragraphSpacing?: number;
    } = {}
  ): number {
    const {
      size = 9.0,
      fontStyle = 'normal',
      color = COLOR.TEXT_PRIMARY,
      lineHeight = 4.8,
      justify = true,
      parseParagraphs = false,
      paragraphSpacing = 3.5,
    } = opts;

    const clean = sanitizePdfText(stripMarkdown(text || ''));
    const bodyWeight = fontStyle === 'bold' ? 'bold' : 'normal';
    setFontBody(this.doc, bodyWeight);
    this.doc.setFontSize(size);
    this.doc.setTextColor(...color);

    let py = startPY;

    if (parseParagraphs) {
      // Pre-proceso: forzar separación de párrafo (\n\n) antes de pasos numerados, listas y viñetas
      const stepProtected = clean
        .replace(/(?:^|\n|\.\s+)(Paso\s+\d+\s*[:\-])/gi, '\n\n$1')
        .replace(/(?:^|\n)(\d+[\.\)]\s+)/g, '\n\n$1')
        .replace(/(?:^|\n)([•\-\*]\s+)/g, '\n\n$1');

      // Normalizar saltos simples \n a espacio (el texto de IA rara vez usa \n\n)
      // pero preservar los \n\n reales y forzados como separadores de párrafo.
      const normalized = stepProtected
        .replace(/\r?\n\r?\n+/g, '\u0000')  // Proteger dobles saltos
        .replace(/\r?\n/g, ' ')           // Colapsar saltos simples a espacio
        .replace(/\u0000/g, '\n\n')        // Restaurar dobles saltos
        .replace(/  +/g, ' ');            // Normalizar espacios múltiples

      let rawParagraphs = normalized.split(/\n\n/).map((p) => p.trim()).filter(Boolean);

      // Si solo hay 1 párrafo grande (muro de texto), auto-chunking por oraciones (máx 3 por párrafo)
      if (rawParagraphs.length <= 1 && (rawParagraphs[0] || '').length > 280) {
        const sentenceRegex = /[^.!?:]+(?:[.!?](?!\s*\d)|[:][^.!?:]{0,30}(?=[A-Z]|$))+/g;
        const sentences = normalized.match(sentenceRegex) || [normalized];
        const chunks: string[] = [];
        for (let si = 0; si < sentences.length; si += 3) {
          const chunk = sentences.slice(si, si + 3).join(' ').trim();
          if (chunk) chunks.push(chunk);
        }
        rawParagraphs = chunks.length > 1 ? chunks : [normalized];
      }

      for (let pIdx = 0; pIdx < rawParagraphs.length; pIdx++) {
        const p = rawParagraphs[pIdx];
        const isBullet = /^[•\-\*]\s+/.test(p) || /^\d+[\.\)]\s+/.test(p);
        const leftMargin = isBullet ? this.margin + 3.5 : this.margin;
        const pWidth = isBullet ? this.mainW - 3.5 : this.mainW;

        const mdTable = this.tryExtractMarkdownTable(p);
        if (mdTable) {
          if (py + 25 > this.contentBottom) {
            py = this.advancePage();
          }
          autoTable(this.doc, {
            startY: py,
            margin: { left: leftMargin, right: this.doc.internal.pageSize.getWidth() - (leftMargin + pWidth) },
            tableWidth: pWidth,
            head: [mdTable.headers],
            body: mdTable.rows,
            theme: 'grid',
            headStyles: { fillColor: COLOR.TABLE_HEADER_BG, textColor: [255, 255, 255], fontSize: 7, fontStyle: 'bold' },
            styles: { fontSize: 6.8, cellPadding: 2, textColor: COLOR.TEXT_PRIMARY },
            didDrawPage: (data) => this.onAutoTablePage(data.pageNumber),
          });
          py = (this.doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? (py + 20);
          py += paragraphSpacing;
          continue;
        }

        const lines = this.doc.splitTextToSize(p, pWidth);

        for (let li = 0; li < lines.length; li++) {
          if (py + lineHeight > this.contentBottom) {
            py = this.advancePage();
            setFontBody(this.doc, bodyWeight);
            this.doc.setFontSize(size);
            this.doc.setTextColor(...color);
          }
          const isLastLine = li === lines.length - 1;
          if (justify && !isLastLine && !isBullet) {
            this.doc.text(lines[li], leftMargin, py, { maxWidth: pWidth, align: 'justify' });
          } else {
            this.doc.text(lines[li], leftMargin, py);
          }
          py += lineHeight;
        }
        if (pIdx < rawParagraphs.length - 1) {
          py += paragraphSpacing;
        }
      }
      this.mainY = py;
      return py;
    }


    const lines = this.doc.splitTextToSize(clean, this.mainW);

    for (let li = 0; li < lines.length; li++) {
      if (py + lineHeight > this.contentBottom) {
        py = this.advancePage();
        setFontBody(this.doc, bodyWeight);
        this.doc.setFontSize(size);
        this.doc.setTextColor(...color);
      }
      const isLastLine = li === lines.length - 1;
      if (justify && !isLastLine) {
        this.doc.text(lines[li], this.margin, py, { maxWidth: this.mainW, align: 'justify' });
      } else {
        this.doc.text(lines[li], this.margin, py);
      }
      py += lineHeight;
    }
    this.mainY = py;
    return py;
  }

  /**
   * Cierre de la misión: verifica que la última página tenga su sidebar completo.
   */
  public finalize(): void {
    const pageNum = this.doc.getNumberOfPages();
    if (!this.pagesWithSidebarRendered.has(pageNum)) {
      this.populateSidebarForCurrentPage(this.contentTop);
    } else {
      if (!this.hasDrawnQr && this.contentBottom - this.sideY >= 32) {
        this.sideY = drawQrMiniWidget(this.doc, {
          sideXAbs: this.sideXAbs,
          sideW: this.sideW,
          startY: this.sideY,
          sideBottom: this.contentBottom,
          qrBuffer: this.qrBuffer,
          verificationUrl: this.verificationUrl,
          missionHash: this.missionHash,
        });
        this.hasDrawnQr = true;
      }
      if (this.contentBottom - this.sideY >= 18) {
        this.sideY = drawNotesWidget(this.doc, {
          sideXAbs: this.sideXAbs,
          sideW: this.sideW,
          startY: this.sideY,
          sideBottom: this.contentBottom,
          title: 'CIERRE Y AUTOEVALUACIÓN',
          subtitle: 'Reflexión metacognitiva final',
        });
      }
    }
  }
}

/**
 * Detecta y extrae una tabla Markdown (| Col 1 | Col 2 |) si el bloque de texto la contiene.
 */
export function parseMarkdownTable(text: string): { headers: string[]; rows: string[][] } | null {
  if (!text || !text.includes('|')) return null;
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const tableLines = lines.filter((l) => l.startsWith('|') && l.endsWith('|'));
  if (tableLines.length >= 2) {
    const dividerIdx = tableLines.findIndex((l) => /^\|[\s\-:|]+\|$/.test(l));
    if (dividerIdx > 0) {
      const headers = tableLines[0]
        .split('|')
        .slice(1, -1)
        .map((c) => sanitizePdfText(c.trim()));
      const rows = tableLines
        .slice(dividerIdx + 1)
        .map((r) => r.split('|').slice(1, -1).map((c) => sanitizePdfText(c.trim())));
      if (headers.length > 0 && rows.length > 0) {
        return { headers, rows };
      }
    }
  }
  return null;
}
