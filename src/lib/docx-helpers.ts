/**
 * docx-helpers.ts — Helpers Compartidos y Primitivas para Generación DOCX
 * SIGPDA-EMS · DBEPA Puebla MCCEMS 2026-2027
 *
 * Módulo unificado para:
 * 1. Paleta institucional homologada con el motor visual (design-tokens.ts).
 * 2. Primitivas de construcción de tablas, celdas, bordes y espaciados de Word.
 * 3. Parser de texto con negritas en línea (parseTextRuns) para Markdown -> DOCX.
 * 4. Conversor estructurado de líneas Markdown a párrafos Word (createParagraphFromLine)
 *    con detección inteligente de fases didácticas (Apertura, Desarrollo, Cierre) y escala multiancho.
 */

import {
  Table,
  TableRow,
  TableCell,
  Paragraph,
  TextRun,
  BorderStyle,
  WidthType,
  AlignmentType,
  ShadingType,
  type ITableCellBorders,
  type ISpacingProperties,
} from 'docx';
import { PHASE_COLORS_HEX } from '@/lib/visual-engine/design-tokens';

// ── Paleta de Colores Institucionales DOCX (Hexadecimal sin #) ──────────────
export const DOCX_COLORS = {
  dark: '1A1A2E',
  mid: '0F3460',
  accent: 'E65100',
  gold: 'FFD580',
  border: 'CCCCCC',
  borderLight: 'E2E8F0',
  text: '333333',
  textDark: '1A1A1A',
  textMuted: '64748B',
  lightBg: 'F4F6F9',
  altRow: 'F8FAFC',
  white: 'FFFFFF',
  phaseApertura: PHASE_COLORS_HEX.apertura, // 1B6B8A
  phaseDesarrollo: PHASE_COLORS_HEX.desarrollo, // 1B6B3A
  phaseCierre: PHASE_COLORS_HEX.cierre, // 6B3A1B
} as const;

export const C = DOCX_COLORS;

// ── Dimensiones estándar en DXA (1/20 de punto) ─────────────────────────────
export const DOCX_DIMENSIONS = {
  PAGE_WIDTH_LETTER: 12240, // 8.5"
  PAGE_HEIGHT_LETTER: 15840, // 11"
  MARGIN_EXTRA: 720, // 0.5"
  MARGIN_WORKBOOK: 1080, // 0.75"
  CONTENT_WIDTH_EXTRA: 10800, // 12240 - 720 * 2
  CONTENT_WIDTH_WORKBOOK: 10080, // 12240 - 1080 * 2
} as const;

/**
 * Crea un conjunto de bordes de celda uniformes con el color y grosor especificados.
 */
export function bdr(color: string = C.border, size = 4): ITableCellBorders {
  const b = { style: BorderStyle.SINGLE, size, color };
  return { top: b, bottom: b, left: b, right: b };
}

/**
 * Genera propiedades de espaciado vertical estándar.
 */
export function sp(before = 60, after = 60): ISpacingProperties {
  return { before, after };
}

/**
 * Parsea una cadena con formato Markdown de negritas (**texto**) y genera un array de TextRun de Word.
 */
export function parseTextRuns(
  text: string,
  size = 18,
  color: string = C.text,
  forceBold = false,
  font = 'Arial'
): TextRun[] {
  if (!text) return [];
  const parts = text.split(/\*\*([\s\S]*?)\*\*/g);
  return parts.map((part, index) => {
    const isBold = index % 2 === 1 || forceBold;
    return new TextRun({
      text: part,
      bold: isBold,
      size,
      color,
      font,
    });
  });
}

export interface TableCellOptions {
  fill?: string;
  width?: number;
  bold?: boolean;
  align?: (typeof AlignmentType)[keyof typeof AlignmentType];
  size?: number;
  color?: string;
  borders?: ITableCellBorders;
  colSpan?: number;
  margins?: { top?: number; bottom?: number; left?: number; right?: number };
}

/**
 * Construye una celda de tabla (TableCell) tipada y estilizada.
 */
export function tc(
  content: string | Paragraph | Paragraph[],
  opts: TableCellOptions = {}
): TableCell {
  const {
    fill,
    width,
    bold = false,
    align = AlignmentType.LEFT,
    size = 17,
    color = C.text,
    borders = bdr(C.borderLight),
    colSpan,
    margins = { top: 80, bottom: 80, left: 140, right: 140 },
  } = opts;

  let children: Paragraph[];
  if (Array.isArray(content)) {
    children = content;
  } else if (content instanceof Paragraph) {
    children = [content];
  } else {
    children = [
      new Paragraph({
        alignment: align,
        spacing: { before: 20, after: 20 },
        children: parseTextRuns(content, size, color, bold),
      }),
    ];
  }

  return new TableCell({
    width: width ? { size: width, type: WidthType.DXA } : undefined,
    columnSpan: colSpan,
    shading: fill ? { fill, type: ShadingType.CLEAR } : undefined,
    borders,
    margins,
    children,
  });
}

/**
 * Construye una celda de encabezado de tabla con estilo institucional oscuro.
 */
export function tcH(text: string, width?: number, opts: TableCellOptions = {}): TableCell {
  return tc(text, {
    fill: opts.fill || C.dark,
    color: opts.color || C.white,
    bold: true,
    size: opts.size || 18,
    width,
    borders: opts.borders || bdr(C.dark),
    ...opts,
  });
}

export interface ParagraphLineOptions {
  size?: number;
  color?: string;
  scale?: number;
  contentWidth?: number;
}

/**
 * Convierte una línea de Markdown en un párrafo estructurado de Word,
 * reconociendo encabezados de nivel 1, 2, 3, listas con viñetas, listas numeradas
 * y aplicando colores institucionales de fase didáctica.
 */
export function createParagraphFromLine(
  line: string,
  opts: ParagraphLineOptions = {}
): Paragraph {
  const baseSize = opts.size || 18;
  const textColor = opts.color || C.text;
  const scale = opts.scale || 1.0;

  // H1 (# Titulo)
  if (line.startsWith('# ')) {
    const text = line.replace(/^#\s+/, '');
    return new Paragraph({
      spacing: { before: Math.round(240 * scale), after: Math.round(100 * scale) },
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 8, color: C.accent, space: 1 },
      },
      children: parseTextRuns(text, Math.round(24 * scale), C.dark, true),
    });
  }

  // H2 (## Seccion / Momento)
  if (line.startsWith('## ')) {
    const text = line.replace(/^##\s+/, '');
    const lower = text.toLowerCase();
    let headingColor: string = C.mid;
    if (lower.includes('apertura') || lower.includes('activacion')) {
      headingColor = C.phaseApertura;
    } else if (lower.includes('desarrollo') || lower.includes('ejecucion') || lower.includes('ejecución')) {
      headingColor = C.phaseDesarrollo;
    } else if (lower.includes('cierre') || lower.includes('conclusion') || lower.includes('conclusión')) {
      headingColor = C.phaseCierre;
    }

    return new Paragraph({
      spacing: { before: Math.round(200 * scale), after: Math.round(80 * scale) },
      children: parseTextRuns(text, Math.round(20 * scale), headingColor, true),
    });
  }

  // H3 (### Subseccion / Fase)
  if (line.startsWith('### ')) {
    const text = line.replace(/^###\s+/, '');
    const lower = text.toLowerCase();
    let headingColor: string = C.mid;
    if (lower.includes('apertura')) {
      headingColor = C.phaseApertura;
    } else if (lower.includes('desarrollo') || lower.includes('ejecucion')) {
      headingColor = C.phaseDesarrollo;
    } else if (lower.includes('cierre') || lower.includes('conclusion')) {
      headingColor = C.phaseCierre;
    }

    return new Paragraph({
      spacing: { before: Math.round(160 * scale), after: Math.round(60 * scale) },
      children: parseTextRuns(text, Math.round(18 * scale), headingColor, true),
    });
  }

  // Viñetas (- / * / •)
  if (line.startsWith('- ') || line.startsWith('* ') || line.startsWith('• ')) {
    const content = line.replace(/^[-*•]\s+/, '');
    return new Paragraph({
      spacing: { before: Math.round(40 * scale), after: Math.round(40 * scale) },
      children: [
        new TextRun({ text: '•  ', size: baseSize, color: C.mid, font: 'Arial', bold: true }),
        ...parseTextRuns(content, baseSize, textColor),
      ],
    });
  }

  // Listas numeradas (1. / 2. / etc.)
  const numMatch = line.match(/^(\d+)\.\s(.*)/);
  if (numMatch) {
    const num = numMatch[1];
    const content = numMatch[2];
    return new Paragraph({
      spacing: { before: Math.round(40 * scale), after: Math.round(40 * scale) },
      children: [
        new TextRun({ text: `${num}.  `, bold: true, size: baseSize, color: C.mid, font: 'Arial' }),
        ...parseTextRuns(content, baseSize, textColor),
      ],
    });
  }

  // Citas pedagógicas (> Cita / Nota)
  if (line.startsWith('> ')) {
    const quoteContent = line.replace(/^>\s*/, '');
    return new Paragraph({
      spacing: { before: Math.round(80 * scale), after: Math.round(80 * scale) },
      border: {
        left: { style: BorderStyle.SINGLE, size: 16, color: C.accent, space: 6 },
      },
      children: parseTextRuns(quoteContent, baseSize, C.textDark, false),
    });
  }

  // Párrafo normal de cuerpo
  return new Paragraph({
    spacing: { before: Math.round(60 * scale), after: Math.round(60 * scale) },
    children: parseTextRuns(line, baseSize, textColor),
  });
}

/**
 * Convierte encabezados y filas Markdown en una tabla Word estilizada con distribución
 * inteligente de columnas para rúbricas (5 cols) y listas de cotejo (4 cols).
 */
export function createMarkdownTable(
  headers: string[],
  rows: string[][],
  contentWidth: number = DOCX_DIMENSIONS.CONTENT_WIDTH_EXTRA
): Table {
  const colCount = Math.max(headers.length, 1);
  const colWidths: number[] = [];

  if (colCount === 5) {
    // Rúbrica analítica: Criterio amplio (24%) + 4 niveles de desempeño equilibrados (19% c/u)
    const c1 = Math.floor(contentWidth * 0.24);
    const rest = Math.floor((contentWidth - c1) / 4);
    colWidths.push(c1, rest, rest, rest, contentWidth - c1 - rest * 3);
  } else if (colCount === 4) {
    // Lista de cotejo: Indicador (50%) + Sí (12%) + No (12%) + Observaciones (26%)
    const c1 = Math.floor(contentWidth * 0.5);
    const c2 = Math.floor(contentWidth * 0.12);
    colWidths.push(c1, c2, c2, contentWidth - c1 - c2 * 2);
  } else {
    // Distribución equitativa
    const equalWidth = Math.floor(contentWidth / colCount);
    for (let i = 0; i < colCount - 1; i++) {
      colWidths.push(equalWidth);
    }
    colWidths.push(contentWidth - equalWidth * (colCount - 1));
  }

  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) =>
      tcH(h, colWidths[i] || Math.floor(contentWidth / colCount), {
        fill: C.mid,
        color: C.white,
        align: AlignmentType.CENTER,
      })
    ),
  });

  const dataRows = rows.map((row, rIdx) => {
    const isAlt = rIdx % 2 === 1;
    return new TableRow({
      height: { value: 450, rule: 'atLeast' },
      children: row.map((cellText, cIdx) => {
        const isNumOrCheck = cellText === 'Sí' || cellText === 'No' || cellText.match(/^\d+%/);
        return tc(cellText, {
          width: colWidths[cIdx] || Math.floor(contentWidth / colCount),
          fill: isAlt ? C.altRow : C.white,
          align: isNumOrCheck ? AlignmentType.CENTER : AlignmentType.LEFT,
          borders: bdr(C.borderLight),
        });
      }),
    });
  });

  return new Table({
    width: { size: contentWidth, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [headerRow, ...dataRows],
  });
}

export const createWordTable = createMarkdownTable;

