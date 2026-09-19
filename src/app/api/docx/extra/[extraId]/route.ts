import { NextRequest } from 'next/server';
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
  WidthType,
  ShadingType,
  BorderStyle,
  Header,
  Footer,
  PageNumber,
} from 'docx';
import {
  C,
  DOCX_DIMENSIONS,
  bdr,
  createParagraphFromLine,
  createWordTable,
} from '@/lib/docx-helpers';
import {
  resolveHeaderBranding,
  sanitizeDocFilename,
} from '@/lib/document-branding';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

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
    const branding = resolveHeaderBranding(extra.type);

    const isRubric = extra.type === 'rubric';
    const pageW = isRubric
      ? DOCX_DIMENSIONS.PAGE_HEIGHT_LETTER
      : DOCX_DIMENSIONS.PAGE_WIDTH_LETTER;
    const pageH = isRubric
      ? DOCX_DIMENSIONS.PAGE_WIDTH_LETTER
      : DOCX_DIMENSIONS.PAGE_HEIGHT_LETTER;
    const contentW = pageW - DOCX_DIMENSIONS.MARGIN_EXTRA * 2;

    const lines = (extra.content_text || '').split('\n');
    const docChildren: (Table | Paragraph)[] = [];

    // Header block institucional
    docChildren.push(
      new Table({
        width: { size: contentW, type: WidthType.DXA },
        columnWidths: [contentW],
        rows: [
          new TableRow({
            children: [
              new TableCell({
                shading: { fill: branding.hex || C.dark, type: ShadingType.CLEAR },
                borders: bdr(branding.hex || C.dark),
                margins: { top: 160, bottom: 160, left: 300, right: 300 },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 40, after: 40 },
                    children: [
                      new TextRun({
                        text: branding.topSup,
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
                        text: branding.typeLabel,
                        bold: true,
                        size: 26,
                        color: C.gold,
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

    // Parse Markdown lines y tablas
    let inTable = false;
    let tableHeaders: string[] = [];
    let tableData: string[][] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.startsWith('|')) {
        if (line.match(/^\|[\s:-|]*$/)) {
          continue; // Separador |---|---|
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
        if (inTable) {
          docChildren.push(createWordTable(tableHeaders, tableData, contentW));
          docChildren.push(new Paragraph({ spacing: { before: 80, after: 80 } }));
          inTable = false;
        }

        if (line !== '') {
          docChildren.push(createParagraphFromLine(line, { contentWidth: contentW }));
        }
      }
    }

    if (inTable) {
      docChildren.push(createWordTable(tableHeaders, tableData, contentW));
    }

    // Ensamblado final del documento DOCX
    const doc = new Document({
      styles: { default: { document: { run: { font: 'Arial', size: 18 } } } },
      sections: [
        {
          properties: {
            page: {
              size: { width: pageW, height: pageH },
              margin: {
                top: DOCX_DIMENSIONS.MARGIN_EXTRA,
                right: DOCX_DIMENSIONS.MARGIN_EXTRA,
                bottom: DOCX_DIMENSIONS.MARGIN_EXTRA,
                left: DOCX_DIMENSIONS.MARGIN_EXTRA,
              },
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
                      text: `${branding.topSup} | ${branding.shortLabel} | ${title.substring(0, 45)}`,
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
                    new TextRun({ text: ' | SIGPDA-EMS DBEPA Puebla', size: 14, color: '777777', font: 'Arial' }),
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
    const safeFilename = sanitizeDocFilename(title, 60);

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${safeFilename}.docx"`,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    logger.error('Export docx extra error:', msg);
    return new Response(`Error: ${msg}`, { status: 500 });
  }
}
