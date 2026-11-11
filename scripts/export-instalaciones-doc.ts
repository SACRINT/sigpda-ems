import fs from 'node:fs';
import path from 'node:path';
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  LineRuleType,
  PageBreak,
  PageNumber,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type Block =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'quote'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'code'; lang: string; lines: string[] }
  | { type: 'hr' };

const C = {
  navy: '1A1A2E',
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
} as const;

const PDF = {
  navy: [26, 26, 46] as [number, number, number],
  mid: [15, 52, 96] as [number, number, number],
  accent: [230, 81, 0] as [number, number, number],
  gold: [255, 213, 128] as [number, number, number],
  text: [51, 51, 51] as [number, number, number],
  textDark: [26, 26, 26] as [number, number, number],
  muted: [100, 116, 139] as [number, number, number],
  lightBg: [244, 246, 249] as [number, number, number],
  border: [226, 232, 240] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
} as const;

const DOC_TITLE = 'Malla Curricular y Trayectoria de Instalaciones Residenciales 2024';
const DOC_SUBTITLE = 'Formación Laboral Básico — Bachillerato General Estatal (BGE)';
const DOC_META = 'Generación 2023–2026 · Acuerdo 09/08/23 · SEP Puebla · MCCEMS';

function cleanInline(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function pdfSafe(text: string): string {
  return cleanInline(text)
    .replace(/→/g, '->')
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/—/g, '-')
    .replace(/–/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/•/g, '-')
    .replace(/\u00a0/g, ' ');
}

function parseMarkdown(md: string): Block[] {
  const lines = md.split(/\r?\n/);
  const blocks: Block[] = [];
  let i = 0;

  const isTableSeparator = (line: string): boolean =>
    /^\|?[\s:|-]+\|?$/.test(line) && line.includes('---');

  const splitRow = (line: string): string[] => {
    const trimmed = line.trim();
    const inner = trimmed.startsWith('|') ? trimmed.slice(1) : trimmed;
    const withoutEnd = inner.endsWith('|') ? inner.slice(0, -1) : inner;
    return withoutEnd.split('|').map((cell) => cleanInline(cell));
  };

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trimEnd();

    if (!line.trim()) {
      i += 1;
      continue;
    }

    if (/^```/.test(line)) {
      const lang = line.replace(/^```/, '').trim().toLowerCase();
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i])) {
        codeLines.push(lines[i]);
        i += 1;
      }
      i += 1;
      blocks.push({ type: 'code', lang, lines: codeLines });
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      blocks.push({
        type: 'heading',
        level: heading[1].length as 1 | 2 | 3,
        text: cleanInline(heading[2]),
      });
      i += 1;
      continue;
    }

    if (line.trim() === '---') {
      blocks.push({ type: 'hr' });
      i += 1;
      continue;
    }

    if (line.trim().startsWith('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const headers = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(splitRow(lines[i]));
        i += 1;
      }
      blocks.push({ type: 'table', headers, rows });
      continue;
    }

    if (/^[-*]\s+/.test(line.trim())) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(cleanInline(lines[i].trim().replace(/^[-*]\s+/, '')));
        i += 1;
      }
      blocks.push({ type: 'list', ordered: false, items });
      continue;
    }

    if (/^\d+\.\s+/.test(line.trim())) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(cleanInline(lines[i].trim().replace(/^\d+\.\s+/, '')));
        i += 1;
      }
      blocks.push({ type: 'list', ordered: true, items });
      continue;
    }

    if (line.trim().startsWith('>')) {
      const parts: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        parts.push(cleanInline(lines[i].trim().replace(/^>\s?/, '')));
        i += 1;
      }
      blocks.push({ type: 'quote', text: parts.join(' ') });
      continue;
    }

    blocks.push({ type: 'paragraph', text: cleanInline(line) });
    i += 1;
  }

  return blocks;
}

function parseMermaidEdges(lines: string[]): Array<{ from: string; to: string }> {
  const edges: Array<{ from: string; to: string }> = [];
  const seen = new Set<string>();
  for (const line of lines) {
    const match = line.match(/^\s*(\w+)(?:\[[^\]]*\])?\s*-->\s*(\w+)/);
    if (!match) continue;
    const from = match[1].replace(/^IR(\d)(\d)$/, 'IR-$1.$2');
    const to = match[2].replace(/^IR(\d)(\d)$/, 'IR-$1.$2');
    const key = `${from}->${to}`;
    if (!seen.has(key)) {
      seen.add(key);
      edges.push({ from, to });
    }
  }
  return edges;
}

function docxRuns(
  text: string,
  opts: { size?: number; color?: string; bold?: boolean; font?: string } = {}
): TextRun[] {
  const size = opts.size ?? 21;
  const color = opts.color ?? C.text;
  const font = opts.font ?? 'Arial';
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  if (parts.length === 0) return [new TextRun({ text: '', size, color, font })];
  return parts.map((part) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return new TextRun({
        text: part.slice(2, -2),
        bold: true,
        size,
        color,
        font,
      });
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return new TextRun({
        text: part.slice(1, -1),
        size: size - 1,
        color,
        font: 'Courier New',
      });
    }
    return new TextRun({ text: part, bold: opts.bold, size, color, font });
  });
}

function docxCell(
  text: string,
  opts: {
    width?: number;
    fill?: string;
    color?: string;
    bold?: boolean;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    size?: number;
    header?: boolean;
  } = {}
): TableCell {
  const border = { style: BorderStyle.SINGLE, size: 4, color: C.borderLight };
  return new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.DXA } : undefined,
    shading: opts.fill ? { fill: opts.fill, type: ShadingType.CLEAR } : undefined,
    borders: { top: border, bottom: border, left: border, right: border },
    margins: { top: 70, bottom: 70, left: 110, right: 110 },
    children: [
      new Paragraph({
        alignment: opts.align ?? AlignmentType.LEFT,
        spacing: { before: 10, after: 10, line: 240, lineRule: LineRuleType.AUTO },
        children: docxRuns(text, {
          size: opts.size ?? (opts.header ? 16 : 16),
          color: opts.color ?? (opts.header ? C.white : C.text),
          bold: opts.bold ?? opts.header ?? false,
        }),
      }),
    ],
  });
}

function tableWidths(headers: string[], contentWidth = 10800): number[] {
  const joined = headers.join(' ').toLowerCase();
  let pct: number[];
  if (headers.length === 2) {
    pct = [30, 70];
  } else if (joined.includes('prerrequisitos') && headers.length === 5) {
    pct = [10, 37, 8, 12, 33];
  } else if (joined.includes('sinco') && headers.length === 3) {
    pct = [13, 49, 38];
  } else if (joined.includes('actividad clave') && headers.length === 4) {
    pct = [6, 30, 34, 30];
  } else if (joined.includes('evidencia') && headers.length === 5) {
    pct = [10, 21, 14, 25, 30];
  } else if (joined.includes('aporte') && headers.length === 3) {
    pct = [14, 46, 40];
  } else {
    pct = Array.from({ length: headers.length }, () => 100 / headers.length);
  }
  const widths = pct.map((p) => Math.floor((contentWidth * p) / 100));
  widths[widths.length - 1] = contentWidth - widths.slice(0, -1).reduce((a, b) => a + b, 0);
  return widths;
}

function buildDocxTable(headers: string[], rows: string[][]): Table {
  const widths = tableWidths(headers);
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, idx) =>
      docxCell(h, {
        width: widths[idx],
        fill: C.mid,
        header: true,
        align: AlignmentType.CENTER,
      })
    ),
  });
  const dataRows = rows.map((row, rIdx) =>
    new TableRow({
      children: row.map((cell, cIdx) =>
        docxCell(cell, {
          width: widths[cIdx],
          fill: rIdx % 2 === 1 ? C.altRow : C.white,
          align:
            cIdx === 0 && (cell.match(/^\d+$/) || cell.match(/^IR-/))
              ? AlignmentType.CENTER
              : AlignmentType.LEFT,
        })
      ),
    })
  );
  return new Table({
    width: { size: 10800, type: WidthType.DXA },
    columnWidths: widths,
    rows: [headerRow, ...dataRows],
  });
}

function buildDocxCodeBlock(lines: string[]): Table {
  const border = { style: BorderStyle.SINGLE, size: 4, color: C.borderLight };
  return new Table({
    width: { size: 10800, type: WidthType.DXA },
    columnWidths: [10800],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 10800, type: WidthType.DXA },
            shading: { fill: C.lightBg, type: ShadingType.CLEAR },
            borders: { top: border, bottom: border, left: border, right: border },
            margins: { top: 100, bottom: 100, left: 160, right: 160 },
            children: lines.map(
              (line) =>
                new Paragraph({
                  spacing: { before: 0, after: 0, line: 220, lineRule: LineRuleType.AUTO },
                  children: [
                    new TextRun({
                      text: line || ' ',
                      font: 'Courier New',
                      size: 16,
                      color: C.textDark,
                    }),
                  ],
                })
            ),
          }),
        ],
      }),
    ],
  });
}

function buildDocxCover(): Array<Paragraph | Table> {
  const band = new Table({
    width: { size: 10800, type: WidthType.DXA },
    columnWidths: [10800],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 10800, type: WidthType.DXA },
            shading: { fill: C.navy, type: ShadingType.CLEAR },
            borders: {
              top: { style: BorderStyle.NONE, size: 0, color: C.navy },
              bottom: { style: BorderStyle.NONE, size: 0, color: C.navy },
              left: { style: BorderStyle.NONE, size: 0, color: C.navy },
              right: { style: BorderStyle.NONE, size: 0, color: C.navy },
            },
            margins: { top: 260, bottom: 260, left: 300, right: 300 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 60 },
                children: [
                  new TextRun({
                    text: 'SIGPDA-EMS',
                    bold: true,
                    size: 30,
                    color: C.white,
                    font: 'Arial',
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 0 },
                children: [
                  new TextRun({
                    text: 'SEP Puebla · MCCEMS · Formación Laboral Básico',
                    size: 17,
                    color: C.gold,
                    font: 'Arial',
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  return [
    band,
    new Paragraph({ spacing: { before: 900 } }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [
        new TextRun({
          text: DOC_TITLE,
          bold: true,
          size: 44,
          color: C.navy,
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: DOC_SUBTITLE,
          size: 23,
          color: C.mid,
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 320 },
      children: [
        new TextRun({
          text: DOC_META,
          size: 18,
          color: C.textMuted,
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 360 },
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 18, color: C.accent, space: 8 },
      },
      children: [],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 240, after: 100 },
      children: [
        new TextRun({
          text: '8 UAC · 24 actividades clave · 432 horas · 4 hitos',
          bold: true,
          size: 21,
          color: C.textDark,
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 0 },
      children: [
        new TextRun({
          text: 'Documento de trabajo para revisión de la Academia Estatal de Formación Laboral y TIC',
          italics: true,
          size: 17,
          color: C.textMuted,
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

function buildDocxBody(blocks: Block[]): Array<Paragraph | Table> {
  const out: Array<Paragraph | Table> = [];
  const firstH2 = blocks.findIndex((b) => b.type === 'heading' && b.level === 2);
  const body = firstH2 >= 0 ? blocks.slice(firstH2) : blocks;
  const toc = body
    .filter((b): b is Extract<Block, { type: 'heading' }> => b.type === 'heading' && b.level === 2)
    .map((b) => b.text);

  out.push(
    new Paragraph({
      spacing: { before: 0, after: 160 },
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 8, color: C.mid, space: 6 },
      },
      children: [
        new TextRun({
          text: 'Contenido',
          bold: true,
          size: 32,
          color: C.navy,
          font: 'Arial',
        }),
      ],
    })
  );
  toc.forEach((title) => {
    out.push(
      new Paragraph({
        spacing: { before: 40, after: 40 },
        children: [
          new TextRun({
            text: title,
            size: 20,
            color: C.mid,
            font: 'Arial',
          }),
        ],
      })
    );
  });
  out.push(new Paragraph({ children: [new PageBreak()] }));

  for (const block of body) {
    switch (block.type) {
      case 'heading': {
        if (block.level === 2) {
          const pageBreakBefore = /^[68]\./.test(block.text);
          out.push(
            new Paragraph({
              heading: HeadingLevel.HEADING_2,
              pageBreakBefore,
              keepNext: true,
              spacing: { before: 260, after: 100 },
              border: {
                bottom: { style: BorderStyle.SINGLE, size: 6, color: C.borderLight, space: 4 },
              },
              children: [
                new TextRun({
                  text: block.text,
                  bold: true,
                  size: 30,
                  color: C.navy,
                  font: 'Arial',
                }),
              ],
            })
          );
        } else {
          out.push(
            new Paragraph({
              heading: HeadingLevel.HEADING_3,
              keepNext: true,
              spacing: { before: 220, after: 80 },
              children: [
                new TextRun({
                  text: block.text,
                  bold: true,
                  size: 24,
                  color: C.mid,
                  font: 'Arial',
                }),
              ],
            })
          );
        }
        break;
      }
      case 'paragraph': {
        const isFinal = /^Fin del documento\.?$/i.test(block.text);
        out.push(
          new Paragraph({
            alignment: isFinal ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
            spacing: { before: 40, after: 110, line: 276, lineRule: LineRuleType.AUTO },
            children: docxRuns(block.text, {
              size: isFinal ? 17 : 21,
              color: isFinal ? C.textMuted : C.text,
            }),
          })
        );
        break;
      }
      case 'quote': {
        out.push(
          new Paragraph({
            shading: { fill: C.lightBg, type: ShadingType.CLEAR },
            border: {
              left: { style: BorderStyle.SINGLE, size: 18, color: C.accent, space: 8 },
            },
            indent: { left: 240, right: 240 },
            spacing: { before: 100, after: 120, line: 260, lineRule: LineRuleType.AUTO },
            children: docxRuns(block.text, { size: 19, color: C.textDark }),
          })
        );
        break;
      }
      case 'list': {
        block.items.forEach((item, idx) => {
          out.push(
            new Paragraph({
              indent: { left: 360, hanging: 180 },
              spacing: { before: 20, after: 30, line: 260, lineRule: LineRuleType.AUTO },
              children: docxRuns(`${block.ordered ? `${idx + 1}. ` : '• '}${item}`, {
                size: 21,
                color: C.text,
              }),
            })
          );
        });
        break;
      }
      case 'table': {
        out.push(buildDocxTable(block.headers, block.rows));
        out.push(new Paragraph({ spacing: { after: 80 } }));
        break;
      }
      case 'code': {
        if (block.lang === 'mermaid') {
          const edges = parseMermaidEdges(block.lines);
          out.push(
            new Paragraph({
              spacing: { before: 80, after: 80 },
              children: docxRuns(
                'El diagrama DAG interactivo se conserva en la versión Markdown. En esta edición imprimible se presenta la matriz de aristas del grafo.',
                { size: 19, color: C.textMuted }
              ),
            })
          );
          out.push(buildDocxTable(['Desde', 'Hacia'], edges.map((e) => [e.from, e.to])));
          out.push(new Paragraph({ spacing: { after: 80 } }));
        } else {
          out.push(buildDocxCodeBlock(block.lines));
          out.push(new Paragraph({ spacing: { after: 80 } }));
        }
        break;
      }
      case 'hr': {
        out.push(
          new Paragraph({
            spacing: { before: 120, after: 120 },
            border: {
              bottom: { style: BorderStyle.SINGLE, size: 4, color: C.borderLight, space: 1 },
            },
            children: [],
          })
        );
        break;
      }
    }
  }

  return out;
}

function buildDocx(md: string): Document {
  const blocks = parseMarkdown(md);
  const body = buildDocxBody(blocks);
  const header = new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { after: 40 },
        border: {
          bottom: { style: BorderStyle.SINGLE, size: 4, color: C.borderLight, space: 2 },
        },
        children: [
          new TextRun({
            text: 'SIGPDA-EMS · Instalaciones Residenciales 2024',
            size: 15,
            color: C.textMuted,
            font: 'Arial',
          }),
        ],
      }),
    ],
  });
  const footer = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        border: {
          top: { style: BorderStyle.SINGLE, size: 4, color: C.borderLight, space: 2 },
        },
        children: [
          new TextRun({
            children: ['Página ', PageNumber.CURRENT, ' de ', PageNumber.TOTAL_PAGES],
            size: 15,
            color: C.textMuted,
            font: 'Arial',
          }),
        ],
      }),
    ],
  });

  return new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Arial', size: 21, color: C.text },
          paragraph: { spacing: { after: 100, line: 276, lineRule: LineRuleType.AUTO } },
        },
      },
    },
    sections: [
      {
        properties: {
          titlePage: true,
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 720, right: 720, bottom: 720, left: 720 },
          },
        },
        headers: {
          first: new Header({ children: [] }),
          default: header,
        },
        footers: {
          first: new Footer({ children: [] }),
          default: footer,
        },
        children: [...buildDocxCover(), ...body],
      },
    ],
  });
}

type PdfTableStyles = {
  headers: string[];
  rows: string[][];
};

function pdfColumnStyles(headers: string[], contentWidth: number): Record<number, { cellWidth: number }> {
  const widths = tableWidths(headers, contentWidth);
  const styles: Record<number, { cellWidth: number }> = {};
  widths.forEach((w, idx) => {
    styles[idx] = { cellWidth: w };
  });
  return styles;
}

function buildPdf(md: string): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 18;
  const marginTop = 18;
  const marginBottom = 20;
  const contentWidth = pageW - marginX * 2;
  let y = marginTop;

  const ensureSpace = (height: number): void => {
    if (y + height > pageH - marginBottom) {
      doc.addPage();
      y = marginTop;
    }
  };

  const setText = (size: number, color: [number, number, number], style: 'normal' | 'bold' = 'normal') => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
  };

  const drawWrapped = (
    text: string,
    opts: {
      size?: number;
      color?: [number, number, number];
      bold?: boolean;
      x?: number;
      width?: number;
      lineHeight?: number;
      after?: number;
    } = {}
  ): void => {
    const size = opts.size ?? 9.5;
    const x = opts.x ?? marginX;
    const width = opts.width ?? contentWidth;
    const lineHeight = opts.lineHeight ?? size * 0.48;
    setText(size, opts.color ?? PDF.text, opts.bold ? 'bold' : 'normal');
    const lines = doc.splitTextToSize(pdfSafe(text), width) as string[];
    ensureSpace(lines.length * lineHeight + (opts.after ?? 0));
    lines.forEach((line) => {
      doc.text(line, x, y, { baseline: 'top' });
      y += lineHeight;
    });
    y += opts.after ?? 0;
  };

  const drawSectionRule = (color: [number, number, number] = PDF.border): void => {
    doc.setDrawColor(color[0], color[1], color[2]);
    doc.setLineWidth(0.35);
    doc.line(marginX, y, pageW - marginX, y);
    y += 2.5;
  };

  const drawTable = ({ headers, rows }: PdfTableStyles): void => {
    ensureSpace(22);
    autoTable(doc, {
      head: [headers.map(pdfSafe)],
      body: rows.map((row) => row.map(pdfSafe)),
      startY: y,
      margin: { left: marginX, right: marginX, bottom: marginBottom },
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 7.3,
        cellPadding: 1.8,
        lineColor: PDF.border,
        lineWidth: 0.2,
        textColor: PDF.text,
        overflow: 'linebreak',
        valign: 'top',
      },
      headStyles: {
        fillColor: PDF.mid,
        textColor: PDF.white,
        fontStyle: 'bold',
        fontSize: 7.5,
        halign: 'center',
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: pdfColumnStyles(headers, contentWidth),
      didDrawPage: () => {
        y = marginTop;
      },
    });
    const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY;
    y = (finalY ?? y) + 4;
  };

  const drawQuote = (text: string): void => {
    const size = 9;
    const lineHeight = size * 0.48;
    const lines = doc.splitTextToSize(pdfSafe(text), contentWidth - 8) as string[];
    const boxHeight = lines.length * lineHeight + 6;
    ensureSpace(boxHeight + 4);
    doc.setFillColor(PDF.lightBg[0], PDF.lightBg[1], PDF.lightBg[2]);
    doc.rect(marginX, y, contentWidth, boxHeight, 'F');
    doc.setFillColor(PDF.accent[0], PDF.accent[1], PDF.accent[2]);
    doc.rect(marginX, y, 1.6, boxHeight, 'F');
    setText(size, PDF.textDark);
    let ty = y + 3;
    lines.forEach((line) => {
      doc.text(line, marginX + 4.5, ty, { baseline: 'top' });
      ty += lineHeight;
    });
    y += boxHeight + 4;
  };

  const drawCode = (lines: string[]): void => {
    const size = 7.8;
    const lineHeight = size * 0.46;
    const boxHeight = lines.length * lineHeight + 5;
    ensureSpace(boxHeight + 4);
    doc.setFillColor(PDF.lightBg[0], PDF.lightBg[1], PDF.lightBg[2]);
    doc.setDrawColor(PDF.border[0], PDF.border[1], PDF.border[2]);
    doc.setLineWidth(0.2);
    doc.rect(marginX, y, contentWidth, boxHeight, 'FD');
    setText(size, PDF.textDark);
    doc.setFont('courier', 'normal');
    let ty = y + 2.5;
    lines.forEach((line) => {
      const safe = pdfSafe(line);
      doc.text(safe, marginX + 3, ty, { baseline: 'top' });
      ty += lineHeight;
    });
    y += boxHeight + 4;
  };

  const cover = (): void => {
    doc.setFillColor(PDF.navy[0], PDF.navy[1], PDF.navy[2]);
    doc.rect(0, 0, pageW, 40, 'F');
    setText(16, PDF.white, 'bold');
    doc.text('SIGPDA-EMS', pageW / 2, 14, { align: 'center', baseline: 'top' });
    setText(8.5, PDF.gold);
    doc.text('SEP Puebla · MCCEMS · Formación Laboral Básico', pageW / 2, 24, {
      align: 'center',
      baseline: 'top',
    });

    setText(24, PDF.navy, 'bold');
    const titleLines = doc.splitTextToSize(DOC_TITLE, contentWidth - 10) as string[];
    let ty = 62;
    titleLines.forEach((line) => {
      doc.text(line, pageW / 2, ty, { align: 'center', baseline: 'top' });
      ty += 10;
    });
    setText(11, PDF.mid);
    doc.text(DOC_SUBTITLE, pageW / 2, ty + 6, { align: 'center', baseline: 'top' });
    setText(8.5, PDF.muted);
    doc.text(DOC_META, pageW / 2, ty + 16, { align: 'center', baseline: 'top' });

    doc.setDrawColor(PDF.accent[0], PDF.accent[1], PDF.accent[2]);
    doc.setLineWidth(1.4);
    doc.line(marginX + 30, ty + 28, pageW - marginX - 30, ty + 28);

    setText(10.5, PDF.textDark, 'bold');
    doc.text('8 UAC · 24 actividades clave · 432 horas · 4 hitos', pageW / 2, ty + 42, {
      align: 'center',
      baseline: 'top',
    });
    setText(8, PDF.muted);
    const note = doc.splitTextToSize(
      'Documento de trabajo para revisión de la Academia Estatal de Formación Laboral y TIC',
      contentWidth - 20
    ) as string[];
    note.forEach((line, idx) => {
      doc.text(line, pageW / 2, ty + 54 + idx * 4, { align: 'center', baseline: 'top' });
    });

    setText(7.5, PDF.muted);
    doc.text('Generado a partir del repositorio SIGPDA-EMS · main', marginX, pageH - 12, {
      baseline: 'top',
    });
    doc.addPage();
    y = marginTop;
  };

  cover();

  const blocks = parseMarkdown(md);
  const firstH2 = blocks.findIndex((b) => b.type === 'heading' && b.level === 2);
  const body = firstH2 >= 0 ? blocks.slice(firstH2) : blocks;
  const toc = body
    .filter((b): b is Extract<Block, { type: 'heading' }> => b.type === 'heading' && b.level === 2)
    .map((b) => b.text);

  setText(16, PDF.navy, 'bold');
  doc.text('Contenido', marginX, y, { baseline: 'top' });
  y += 8;
  drawSectionRule(PDF.mid);
  y += 2;
  setText(9.5, PDF.mid);
  toc.forEach((title) => {
    const lines = doc.splitTextToSize(pdfSafe(title), contentWidth - 4) as string[];
    ensureSpace(lines.length * 4.6 + 2);
    lines.forEach((line) => {
      doc.text(line, marginX + 2, y, { baseline: 'top' });
      y += 4.6;
    });
    y += 1.2;
  });
  doc.addPage();
  y = marginTop;

  for (const block of body) {
    switch (block.type) {
      case 'heading': {
        if (block.level === 2) {
          if (/^[68]\./.test(block.text)) {
            doc.addPage();
            y = marginTop;
          }
          ensureSpace(16);
          y += 2;
          setText(13, PDF.navy, 'bold');
          const lines = doc.splitTextToSize(pdfSafe(block.text), contentWidth) as string[];
          lines.forEach((line) => {
            doc.text(line, marginX, y, { baseline: 'top' });
            y += 5.6;
          });
          y += 1.2;
          drawSectionRule(PDF.borderLight);
          y += 1.5;
        } else {
          ensureSpace(12);
          y += 1.5;
          setText(10.5, PDF.mid, 'bold');
          const lines = doc.splitTextToSize(pdfSafe(block.text), contentWidth) as string[];
          lines.forEach((line) => {
            doc.text(line, marginX, y, { baseline: 'top' });
            y += 4.8;
          });
          y += 1.8;
        }
        break;
      }
      case 'paragraph': {
        const isFinal = /^Fin del documento\.?$/i.test(block.text);
        if (isFinal) {
          y += 4;
          setText(8, PDF.muted);
          doc.text(pdfSafe(block.text), pageW / 2, y, { align: 'center', baseline: 'top' });
          y += 6;
        } else {
          drawWrapped(block.text, { size: 9.3, color: PDF.text, after: 2.2 });
        }
        break;
      }
      case 'quote': {
        drawQuote(block.text);
        break;
      }
      case 'list': {
        block.items.forEach((item, idx) => {
          drawWrapped(`${block.ordered ? `${idx + 1}.` : '•'} ${item}`, {
            size: 9.1,
            x: marginX + 3,
            width: contentWidth - 3,
            after: 0.8,
          });
        });
        y += 1.5;
        break;
      }
      case 'table': {
        drawTable(block);
        break;
      }
      case 'code': {
        if (block.lang === 'mermaid') {
          const edges = parseMermaidEdges(block.lines);
          drawWrapped(
            'El diagrama DAG interactivo se conserva en la versión Markdown. En esta edición imprimible se presenta la matriz de aristas del grafo.',
            { size: 8.5, color: PDF.muted, after: 2 }
          );
          drawTable({ headers: ['Desde', 'Hacia'], rows: edges.map((e) => [e.from, e.to]) });
        } else {
          drawCode(block.lines);
        }
        break;
      }
      case 'hr': {
        ensureSpace(6);
        y += 2;
        drawSectionRule(PDF.borderLight);
        y += 2;
        break;
      }
    }
  }

  const total = doc.getNumberOfPages();
  for (let page = 2; page <= total; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(PDF.border[0], PDF.border[1], PDF.border[2]);
    doc.setLineWidth(0.2);
    doc.line(marginX, pageH - 13, pageW - marginX, pageH - 13);
    setText(7.2, PDF.muted);
    doc.text('SIGPDA-EMS · Instalaciones Residenciales 2024', marginX, pageH - 10, {
      baseline: 'top',
    });
    doc.text(`Página ${page} de ${total}`, pageW - marginX, pageH - 10, {
      align: 'right',
      baseline: 'top',
    });
  }

  return doc;
}

async function main(): Promise<void> {
  const root = process.cwd();
  const sourcePath = path.join(
    root,
    'docs',
    'MALLA_CURRICULAR_Y_TRAYECTORIA_INSTALACIONES_RESIDENCIALES_2024.md'
  );
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`No existe el documento fuente: ${sourcePath}`);
  }

  const md = fs.readFileSync(sourcePath, 'utf8');
  const baseName = 'MALLA_CURRICULAR_Y_TRAYECTORIA_INSTALACIONES_RESIDENCIALES_2024';
  const docxPath = path.join(root, 'docs', `${baseName}.docx`);
  const pdfPath = path.join(root, 'docs', `${baseName}.pdf`);

  const docx = buildDocx(md);
  const docxBuffer = await Packer.toBuffer(docx);
  fs.writeFileSync(docxPath, docxBuffer);

  const pdf = buildPdf(md);
  const pdfBuffer = Buffer.from(pdf.output('arraybuffer'));
  fs.writeFileSync(pdfPath, pdfBuffer);

  console.log(`DOCX generado: ${docxPath} (${(docxBuffer.length / 1024).toFixed(1)} KB)`);
  console.log(`PDF generado:  ${pdfPath} (${(pdfBuffer.length / 1024).toFixed(1)} KB)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
