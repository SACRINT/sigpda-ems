import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail, getPlanningExtraById } from '@/lib/db';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  BorderStyle,
  WidthType,
  ShadingType,
  VerticalAlign,
  PageBreak,
  Header,
  Footer,
  PageNumber,
} from 'docx';

export const runtime = 'nodejs';

// Theme Colors matching institutional palette
const C = {
  dark: '1A1A2E',
  mid: '0F3460',
  light: 'DCE4F5',
  rowAlt: 'EEF3FB',
  accent: 'E65100',
  green: '1B5E20',
  white: 'FFFFFF',
  gray: 'F5F5F5',
  text: '1A1A1A',
  border: '999999',
};

const PW = 12240; // Letter width in dxa
const PH = 15840; // Letter height in dxa
const MG = 720;   // 0.5-inch margins
const CW = PW - MG * 2; // Content width = 10800 dxa

function bdr(color = C.border) {
  const b = { style: BorderStyle.SINGLE, size: 4, color };
  return { top: b, bottom: b, left: b, right: b };
}

const CM = { top: 80, bottom: 80, left: 140, right: 140 };

// Parse bold markdown formatting **text**
function parseTextRuns(text: string, size = 18, color = C.text, forceBold = false) {
  const parts = text.split(/\*\*([\s\S]*?)\*\*/g);
  return parts.map((part, index) => {
    const isBold = index % 2 === 1 || forceBold;
    return new TextRun({
      text: part,
      bold: isBold,
      size,
      color,
      font: 'Arial',
    });
  });
}

// Convert markdown line to paragraph
function createParagraphFromLine(line: string, size = 18, color = C.text) {
  // Check headers
  if (line.startsWith('# ')) {
    return new Paragraph({
      spacing: { before: 240, after: 100 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: C.accent, space: 1 } },
      children: parseTextRuns(line.replace('# ', ''), 24, C.dark, true),
    });
  }
  if (line.startsWith('## ')) {
    return new Paragraph({
      spacing: { before: 200, after: 80 },
      children: parseTextRuns(line.replace('## ', ''), 20, C.mid, true),
    });
  }
  if (line.startsWith('### ')) {
    return new Paragraph({
      spacing: { before: 160, after: 60 },
      children: parseTextRuns(line.replace('### ', ''), 18, C.mid, true),
    });
  }

  // Check bullet list
  if (line.startsWith('- ') || line.startsWith('* ') || line.startsWith('• ')) {
    const content = line.substring(2);
    return new Paragraph({
      spacing: { before: 40, after: 40 },
      children: [
        new TextRun({ text: '•  ', size, color, font: 'Arial' }),
        ...parseTextRuns(content, size, color),
      ],
    });
  }

  // Check numbered list
  const numMatch = line.match(/^(\d+)\.\s(.*)/);
  if (numMatch) {
    const num = numMatch[1];
    const content = numMatch[2];
    return new Paragraph({
      spacing: { before: 40, after: 40 },
      children: [
        new TextRun({ text: `${num}.  `, bold: true, size, color, font: 'Arial' }),
        ...parseTextRuns(content, size, color),
      ],
    });
  }

  // Regular paragraph
  return new Paragraph({
    spacing: { before: 60, after: 60 },
    children: parseTextRuns(line, size, color),
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ extraId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return new Response('No autorizado', { status: 401 });
    }

    const teacher = await getTeacherByEmail(session.user.email);
    if (!teacher) {
      return new Response('Docente no encontrado', { status: 404 });
    }

    const { extraId } = await params;
    const extra = await getPlanningExtraById(extraId, teacher.id);
    if (!extra) {
      return new Response('Recurso no encontrado', { status: 404 });
    }

    const title = extra.title || 'Recurso Extra';
    const typeLabel =
      extra.type === 'rubric'
        ? 'RÚBRICA DE EVALUACIÓN'
        : extra.type === 'checklist'
        ? 'LISTA DE COTEJO'
        : extra.type === 'material'
        ? 'MATERIAL DIDÁCTICO'
        : extra.type === 'practice_guide'
        ? 'GUÍA DE PRÁCTICA DEL ESTUDIANTE'
        : 'PLAN DE CLASE';

    const lines = extra.content_text.split('\n');
    const docChildren: any[] = [];

    // Header block
    docChildren.push(
      new Table({
        width: { size: CW, type: WidthType.DXA },
        columnWidths: [CW],
        rows: [
          new TableRow({
            children: [
              new TableCell({
                shading: { fill: C.dark, type: ShadingType.CLEAR },
                borders: bdr(C.dark),
                margins: { top: 160, bottom: 160, left: 300, right: 300 },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 40, after: 40 },
                    children: [
                      new TextRun({
                        text: 'DBEPA PUEBLA — SECUENCIAS DIDÁCTICAS 2026-2027',
                        bold: true,
                        size: 16,
                        color: C.white,
                        font: 'Arial',
                      }),
                    ],
                  }),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 0, after: 40 },
                    children: [
                      new TextRun({
                        text: typeLabel,
                        bold: true,
                        size: 26,
                        color: 'FFD580',
                        font: 'Arial',
                      }),
                    ],
                  }),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 0, after: 40 },
                    children: [
                      new TextRun({
                        text: title,
                        bold: true,
                        size: 20,
                        color: 'DDEEFC',
                        font: 'Arial',
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      })
    );

    docChildren.push(new Paragraph({ spacing: { before: 120, after: 120 } }));

    // Parse Markdown lines
    let inTable = false;
    let tableHeaders: string[] = [];
    let tableData: string[][] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Check if line is a table row (starts and ends with |)
      if (line.startsWith('|')) {
        // Skip separator row like |---|---|
        if (line.match(/^\|[\s:-|]*$/)) {
          continue;
        }

        const cells = line
          .split('|')
          .slice(1, -1)
          .map((c: string) => c.trim());

        if (!inTable) {
          inTable = true;
          tableHeaders = cells;
          tableData = [];
        } else {
          tableData.push(cells);
        }
      } else {
        // We exited table block or it's a blank line
        if (inTable) {
          // Compile table
          docChildren.push(createWordTable(tableHeaders, tableData));
          docChildren.push(new Paragraph({ spacing: { before: 80, after: 80 } }));
          inTable = false;
        }

        if (line !== '') {
          docChildren.push(createParagraphFromLine(line));
        }
      }
    }

    // Edge case: table at the very end of file
    if (inTable) {
      docChildren.push(createWordTable(tableHeaders, tableData));
    }

    // Assemble DOCX document
    const doc = new Document({
      styles: { default: { document: { run: { font: 'Arial', size: 18 } } } },
      sections: [
        {
          properties: {
            page: {
              size: { width: PW, height: PH },
              margin: { top: MG, right: MG, bottom: MG, left: MG },
            },
          },
          headers: {
            default: new Header({
              children: [
                new Paragraph({
                  spacing: { before: 0, after: 60 },
                  border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: C.accent, space: 1 } },
                  children: [
                    new TextRun({
                      text: `DBEPA Puebla 2026-2027 | ${typeLabel} | ${title.substring(0, 40)}`,
                      size: 14,
                      color: '777777',
                      font: 'Arial',
                    }),
                  ],
                }),
              ],
            }),
          },
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  border: { top: { style: BorderStyle.SINGLE, size: 4, color: C.accent, space: 1 } },
                  spacing: { before: 60 },
                  children: [
                    new TextRun({ text: 'Página ', size: 14, color: '777777', font: 'Arial' }),
                    new TextRun({ children: [PageNumber.CURRENT], size: 14, color: '777777', font: 'Arial' }),
                    new TextRun({ text: ' de ', size: 14, color: '777777', font: 'Arial' }),
                    new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 14, color: '777777', font: 'Arial' }),
                    new TextRun({ text: ' | DidácticaIA Puebla', size: 14, color: '777777', font: 'Arial' }),
                  ],
                }),
              ],
            }),
          },
          children: docChildren,
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);

    // Format safe filename
    const safeFilename = title
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .substring(0, 40);

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${safeFilename}.docx"`,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Export docx extra error:', msg);
    return new Response(`Error: ${msg}`, { status: 500 });
  }
}

// Helper to create styled Table from parsed markdown rows
function createWordTable(headers: string[], dataRows: string[][]) {
  const colCount = headers.length;
  const colWidths: number[] = [];

  // Table columns layouts heuristics
  if (colCount === 5) {
    // Rubric (Criterio, Excelente, Satisfactorio, Suficiente, Insuficiente)
    colWidths.push(
      Math.floor(CW * 0.22),
      Math.floor(CW * 0.22),
      Math.floor(CW * 0.22),
      Math.floor(CW * 0.17),
      CW - Math.floor(CW * 0.22) * 3 - Math.floor(CW * 0.17)
    );
  } else if (colCount === 4) {
    // Checklist (Criterio, Sí, No, Observaciones)
    colWidths.push(
      Math.floor(CW * 0.5),
      Math.floor(CW * 0.12),
      Math.floor(CW * 0.12),
      CW - Math.floor(CW * 0.5) - Math.floor(CW * 0.12) * 2
    );
  } else {
    // Equal distribution
    const equalWidth = Math.floor(CW / colCount);
    for (let i = 0; i < colCount - 1; i++) {
      colWidths.push(equalWidth);
    }
    colWidths.push(CW - equalWidth * (colCount - 1));
  }

  const tableRows: TableRow[] = [];

  // Header row
  tableRows.push(
    new TableRow({
      children: headers.map(
        (headerText, index) =>
          new TableCell({
            width: { size: colWidths[index], type: WidthType.DXA },
            shading: { fill: C.mid, type: ShadingType.CLEAR },
            borders: bdr(C.mid),
            margins: CM,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: parseTextRuns(headerText, 17, C.white, true),
              }),
            ],
          })
      ),
    })
  );

  // Data rows
  dataRows.forEach((rowCells, rowIndex) => {
    const isAlt = rowIndex % 2 === 1;
    const rowFill = isAlt ? C.rowAlt : C.white;

    tableRows.push(
      new TableRow({
        height: { value: 450, rule: 'atLeast' },
        children: rowCells.map((cellText, cellIndex) => {
          const colWidth = colWidths[cellIndex] || Math.floor(CW / colCount);
          const isNumOrCheck = cellText === 'Sí' || cellText === 'No' || cellText.match(/^\d+%/);

          return new TableCell({
            width: { size: colWidth, type: WidthType.DXA },
            shading: { fill: rowFill, type: ShadingType.CLEAR },
            borders: bdr(),
            margins: CM,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: isNumOrCheck ? AlignmentType.CENTER : AlignmentType.LEFT,
                children: parseTextRuns(cellText, 16, C.text),
              }),
            ],
          });
        }),
      })
    );
  });

  return new Table({
    width: { size: CW, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: tableRows,
  });
}
