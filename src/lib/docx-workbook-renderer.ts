/**
 * docx-workbook-renderer.ts — Generador DOCX del Libro-Cuaderno de Trabajo Activo
 * SIGPDA-EMS · DBEPA Puebla MCCEMS 2026-2027
 *
 * Genera el documento Word (.docx) formal para el estudiante (35-80 páginas por bloque):
 * 1. Portada institucional con membrete, escuela, CCT, UAC, bloque y proyecto PAEC.
 * 2. Índice de misiones con estimación de páginas.
 * 3. Misiones didácticas completas con formato editorial (Concepto Cero, Yo Hago, Nosotros Hacemos, Tú Haces).
 * 4. Elementos de cuaderno activo:
 *    - lines: Renglones caligráficos punteados para escritura a mano
 *    - empty_table: Tablas de registro con filas vacías
 *    - code_box: Cajas sombreadas para código/terminal (Consolas)
 *    - checkbox_list: Listas de cotejo con casillas ☐
 *    - drawing_box: Marcos de diagramación y esquemas
 *    - data_recording: Hojas de datos experimentales
 * 5. Matriz de depuración y resiliencia ("¿Qué hacer si falla?")
 * 6. Instrumentos de evaluación formativa NEM tabulares (Rúbrica 4 niveles, Checklist, Metacognición).
 */

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
  NumberFormat,
} from 'docx';
import type {
  ActiveWorkTextbook,
  MissionSection,
  WorkbookElement,
  TroubleshootItem,
  EvaluationSection,
  ProjectSection,
} from '@/types/work-textbook';
import type { Planning } from '@/types/planning';
import { getRubricLevelDescriptor } from '@/lib/pdf-workbook-renderer';

// ── Paleta de Colores Institucionales DBEPA ──────────────────────────────────
const C = {
  navy: '1F3864',       // Primario institucional
  midBlue: '2E74B5',    // Secundario
  gold: 'E8A020',       // Acento / Dorado SEP
  darkText: '1E293B',   // Texto principal
  mutedText: '64748B',  // Texto secundario
  lightBg: 'F8FAFC',    // Fondo suave
  tableBg: 'F1F5F9',    // Fondo encabezados de tabla
  codeBg: 'F3F4F6',     // Fondo cajas de código
  codeBorder: 'CBD5E1', // Borde caja código
  border: 'E2E8F0',     // Bordes generales
  white: 'FFFFFF',
};

const PAGE_W = 12240;   // Carta en DXA (8.5in * 1440)
const MARGIN = 1000;    // Márgenes generosos
const CONTENT_W = PAGE_W - MARGIN * 2;

function thinBorder(color = C.border) {
  const b = { style: BorderStyle.SINGLE, size: 4, color };
  return { top: b, bottom: b, left: b, right: b };
}

function dottedBorder(color = C.mutedText) {
  const b = { style: BorderStyle.DOTTED, size: 6, color };
  return { top: b, bottom: b, left: b, right: b };
}

function cellPadding() {
  return { top: 120, bottom: 120, left: 160, right: 160 };
}

/**
 * Celda estándar para tablas DOCX
 */
function cell(
  text: string,
  opts: {
    w?: number;
    span?: number;
    bold?: boolean;
    fill?: string;
    color?: string;
    size?: number;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    font?: string;
  } = {}
): TableCell {
  const {
    w,
    span = 1,
    bold = false,
    fill = C.white,
    color = C.darkText,
    size = 20, // 10pt (docx usa medios puntos: 20 = 10pt)
    align = AlignmentType.LEFT,
    font = 'Calibri',
  } = opts;

  return new TableCell({
    columnSpan: span,
    width: w ? { size: w, type: WidthType.DXA } : undefined,
    shading: { fill, type: ShadingType.CLEAR },
    borders: thinBorder(),
    margins: cellPadding(),
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        alignment: align,
        spacing: { before: 40, after: 40 },
        children: [new TextRun({ text, bold, size, color, font })],
      }),
    ],
  });
}

/**
 * Genera el documento Word (.docx) para el Cuaderno de Trabajo del Bloque.
 */
export async function renderWorkbookToDocx(
  workbook: ActiveWorkTextbook,
  planning: Planning,
  options: { includeAnswerKey?: boolean } = {}
): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [];

  // ── 1. Portada Institucional ───────────────────────────────────────────────
  children.push(...buildCoverSection(workbook, planning));
  children.push(new Paragraph({ children: [new PageBreak()] }));

  // ── 2. Índice de Misiones y Estructura ──────────────────────────────────────
  children.push(...buildTableOfContents(workbook));
  children.push(new Paragraph({ children: [new PageBreak()] }));

  // ── 3. Misiones Didácticas (Foundation, Lab, Project, Evaluation) ───────────
  for (let i = 0; i < workbook.missions.length; i++) {
    const mission = workbook.missions[i];
    children.push(...buildMissionContent(mission, i + 1, workbook.subsystem));
    children.push(new Paragraph({ children: [new PageBreak()] }));
  }

  // ── 4. Sección de Proyecto Formativo Comunitario (Solo si no está ya integrada en las misiones) ──
  const hasProjectInMissions = workbook.missions.some(
    (m) => m.missionIndex === 3 || /proyecto|artefacto/i.test(m.title)
  );
  if (workbook.projectSection && !hasProjectInMissions) {
    children.push(...buildProjectSection(workbook.projectSection, workbook.coverData));
    children.push(new Paragraph({ children: [new PageBreak()] }));
  }

  // ── 5. Sección de Evaluación Formativa y Sumativa NEM (Solo si no está ya integrada en las misiones) ──
  const hasEvalInMissions = workbook.missions.some(
    (m) => m.missionIndex === 4 || /evaluaci[oó]n|demostraci[oó]n/i.test(m.title)
  );
  if (workbook.evaluationSection && !hasEvalInMissions) {
    children.push(...buildEvaluationSection(workbook.evaluationSection, workbook.coverData));
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: `${workbook.coverData.subjectName} · ${workbook.blockName} (DBEPA Puebla)`,
                    size: 16,
                    color: C.mutedText,
                    font: 'Calibri',
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
                children: [
                  new TextRun({
                    text: 'Cuaderno de Aprendizaje Activo · Página ',
                    size: 16,
                    color: C.mutedText,
                    font: 'Calibri',
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 16,
                    color: C.mutedText,
                    font: 'Calibri',
                    bold: true,
                  }),
                  new TextRun({
                    text: ' de ',
                    size: 16,
                    color: C.mutedText,
                    font: 'Calibri',
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    size: 16,
                    color: C.mutedText,
                    font: 'Calibri',
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}

// ── Constructores de Secciones DOCX ──────────────────────────────────────────

function buildCoverSection(workbook: ActiveWorkTextbook, planning: Planning): Paragraph[] {
  const cover = workbook.coverData;
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 300, after: 100 },
      children: [
        new TextRun({
          text: 'SECRETARÍA DE EDUCACIÓN PÚBLICA DE PUEBLA',
          bold: true,
          size: 26,
          color: C.navy,
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
      children: [
        new TextRun({
          text: 'DIRECCIÓN DE BACHILLERATOS ESTATALES Y PREPARATORIA ABIERTA (DBEPA)',
          bold: true,
          size: 20,
          color: C.midBlue,
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 100 },
      children: [
        new TextRun({
          text: cover.schoolName || 'Bachillerato del Estado de Puebla',
          size: 22,
          bold: true,
          color: C.darkText,
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [
        new TextRun({
          text: `Clave C.C.T.: ${cover.cct || '21ECT0017T'} | Subsistema: ${(workbook.subsystem || 'BGE').toUpperCase()}`,
          size: 18,
          color: C.mutedText,
          font: 'Calibri',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 400, after: 150 },
      children: [
        new TextRun({
          text: cover.title.toUpperCase(),
          bold: true,
          size: 36, // 18pt
          color: C.navy,
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
      children: [
        new TextRun({
          text: cover.subtitle,
          italics: true,
          size: 24, // 12pt
          color: C.gold,
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 300, after: 100 },
      children: [
        new TextRun({
          text: `Unidad de Aprendizaje Curricular (UAC): ${cover.subjectName}`,
          bold: true,
          size: 24,
          color: C.darkText,
          font: 'Calibri',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
      children: [
        new TextRun({
          text: `Semestre: ${cover.semester}° Semestre | Bloque de Aprendizaje: ${cover.blockNumber}`,
          size: 22,
          color: C.darkText,
          font: 'Calibri',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 300, after: 100 },
      children: [
        new TextRun({
          text: `Proyecto Comunitario PAEC:`,
          bold: true,
          size: 20,
          color: C.navy,
          font: 'Calibri',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [
        new TextRun({
          text: cover.paecProjectName || 'Impacto social y productivo en la comunidad escolar',
          italics: true,
          size: 20,
          color: C.darkText,
          font: 'Calibri',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 400, after: 100 },
      children: [
        new TextRun({
          text: `Docente Titular: ${cover.teacherName}`,
          bold: true,
          size: 22,
          color: C.darkText,
          font: 'Calibri',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 300, after: 200 },
      children: [
        new TextRun({
          text: 'Nombre del Estudiante: ____________________________________________________',
          bold: true,
          size: 20,
          color: C.navy,
          font: 'Calibri',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: 'Grupo: _________   Turno: _________   Ciclo Escolar: 2026-2027',
          size: 20,
          color: C.mutedText,
          font: 'Calibri',
        }),
      ],
    }),
  ];
}

function buildTableOfContents(workbook: ActiveWorkTextbook): (Paragraph | Table)[] {
  const items: (Paragraph | Table)[] = [
    new Paragraph({
      spacing: { before: 200, after: 200 },
      children: [
        new TextRun({
          text: 'ÍNDICE DE MISIONES FORMATIVAS',
          bold: true,
          size: 32, // 16pt
          color: C.navy,
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 300 },
      children: [
        new TextRun({
          text: 'El presente libro de trabajo activo está estructurado en misiones didácticas progresivas diseñadas para acompañar cada sesión en el aula y taller.',
          size: 22,
          color: C.darkText,
          font: 'Calibri',
        }),
      ],
    }),
  ];

  const rows: TableRow[] = [
    new TableRow({
      children: [
        cell('Misión', { w: 1500, bold: true, fill: C.navy, color: C.white }),
        cell('Título y Desafío Didáctico', { w: 5500, bold: true, fill: C.navy, color: C.white }),
        cell('Sesiones Cubiertas', { w: 2200, bold: true, fill: C.navy, color: C.white }),
        cell('Páginas Est.', { w: 1500, bold: true, fill: C.navy, color: C.white, align: AlignmentType.CENTER }),
      ],
    }),
  ];

  workbook.tableOfContents.forEach((item) => {
    const cleanTitle = item.title
      .replace(/^\[.*?\]\s*/, '')
      .replace(/^misi[oó]n\s*\d+\s*:\s*/i, '')
      .trim();
    rows.push(
      new TableRow({
        children: [
          cell(item.missionIndex > 0 ? `Misión ${item.missionIndex}` : 'Bloque', {
            bold: true,
            color: item.missionIndex > 0 ? C.midBlue : C.navy,
          }),
          cell(cleanTitle),
          cell(item.sessionsRange),
          cell(`${item.pageEstimate} págs.`, { align: AlignmentType.CENTER }),
        ],
      })
    );
  });

  items.push(
    new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      rows,
    })
  );

  return items;
}

function buildMissionContent(
  mission: MissionSection,
  missionNumber: number,
  subsystem: string
): (Paragraph | Table)[] {
  const elements: (Paragraph | Table)[] = [];

  const cleanMissionTitle = mission.title
    .replace(/^\[.*?\]\s*/, '')
    .replace(/^misi[oó]n\s*\d+\s*:\s*/i, '')
    .trim();

  // Encabezado de la Misión
  elements.push(
    new Paragraph({
      spacing: { before: 200, after: 100 },
      children: [
        new TextRun({
          text: `MISIÓN ${missionNumber}: ${cleanMissionTitle.toUpperCase()}`,
          bold: true,
          size: 32, // 16pt
          color: C.navy,
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 300 },
      children: [
        new TextRun({
          text: `Sesiones asignadas: ${mission.coveredSessions?.join(', ') || 'N/A'} | Enfoque: ${mission.sessionFocus}`,
          bold: true,
          size: 20,
          color: C.midBlue,
          font: 'Calibri',
        }),
      ],
    })
  );

  // 1. Enganche Situado
  elements.push(
    new Paragraph({
      spacing: { before: 200, after: 100 },
      children: [
        new TextRun({
          text: '1. Enganche y Desafío Situado en la Comunidad',
          bold: true,
          size: 26, // 13pt
          color: C.navy,
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 150, line: 360 }, // 1.5 line spacing
      children: [
        new TextRun({
          text: mission.phenomenonHook.story,
          size: 22,
          color: C.darkText,
          font: 'Calibri',
        }),
      ],
    }),
    new Paragraph({
      spacing: { before: 100, after: 250 },
      children: [
        new TextRun({
          text: 'Pregunta Detonadora: ',
          bold: true,
          size: 22,
          color: C.gold,
          font: 'Calibri',
        }),
        new TextRun({
          text: mission.phenomenonHook.detonatingQuestion,
          italics: true,
          bold: true,
          size: 22,
          color: C.navy,
          font: 'Calibri',
        }),
      ],
    })
  );

  // 2. Concepto Cero
  elements.push(
    new Paragraph({
      spacing: { before: 200, after: 100 },
      children: [
        new TextRun({
          text: '2. Concepto Cero: Analogía Intuitiva y Fundamento',
          bold: true,
          size: 26,
          color: C.navy,
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 150, line: 360 },
      children: [
        new TextRun({
          text: `Analogía Cotidiana: ${mission.conceptZero.physicalAnalogy}`,
          italics: true,
          size: 22,
          color: C.darkText,
          font: 'Calibri',
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 250, line: 360 },
      children: [
        new TextRun({
          text: mission.conceptZero.coreExplanation,
          size: 22,
          color: C.darkText,
          font: 'Calibri',
        }),
      ],
    })
  );

  // 3. Yo Hago (Demostración)
  elements.push(
    new Paragraph({
      spacing: { before: 200, after: 100 },
      children: [
        new TextRun({
          text: '3. Yo Hago: Demostración y Protocolo Guiado por el Docente',
          bold: true,
          size: 26,
          color: C.navy,
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 250, line: 360 },
      children: [
        new TextRun({
          text: mission.iDoSection.stepByStepDemo,
          size: 22,
          color: C.darkText,
          font: 'Calibri',
        }),
      ],
    })
  );

  // 4. Nosotros Hacemos (Práctica Colaborativa)
  elements.push(
    new Paragraph({
      spacing: { before: 200, after: 100 },
      children: [
        new TextRun({
          text: '4. Nosotros Hacemos: Práctica Guiada y Cuaderno Activo',
          bold: true,
          size: 26,
          color: C.navy,
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 150, line: 360 },
      children: [
        new TextRun({
          text: mission.weDoSection.guidedPractice,
          size: 22,
          color: C.darkText,
          font: 'Calibri',
        }),
      ],
    })
  );

  if (mission.weDoSection.workbookElements) {
    for (const el of mission.weDoSection.workbookElements) {
      elements.push(...renderWorkbookElement(el));
    }
  }

  // 5. Tú Haces (Reto Autónomo)
  elements.push(
    new Paragraph({
      spacing: { before: 200, after: 100 },
      children: [
        new TextRun({
          text: '5. Tú Haces: Reto Autónomo de Aplicación Real',
          bold: true,
          size: 26,
          color: C.navy,
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 150, line: 360 },
      children: [
        new TextRun({
          text: mission.youDoSection.autonomousChallenge,
          size: 22,
          color: C.darkText,
          font: 'Calibri',
        }),
      ],
    })
  );

  if (mission.youDoSection.workbookElements) {
    for (const el of mission.youDoSection.workbookElements) {
      elements.push(...renderWorkbookElement(el));
    }
  }

  // 6. Troubleshooting (Zona de Depuración)
  if (mission.troubleshooting && mission.troubleshooting.length > 0) {
    elements.push(
      new Paragraph({
        spacing: { before: 250, after: 100 },
        children: [
          new TextRun({
            text: '6. Matriz de Resiliencia y Depuración: "¿Qué hacer si falla?"',
            bold: true,
            size: 26,
            color: C.navy,
            font: 'Arial',
          }),
        ],
      }),
      buildTroubleshootTable(mission.troubleshooting)
    );
  }

  // 7. Checkpoint Formativo
  if (mission.formativeCheckpoint) {
    elements.push(
      new Paragraph({
        spacing: { before: 250, after: 100 },
        children: [
          new TextRun({
            text: '7. Punto de Control Formativo (Metacognición y Criterios)',
            bold: true,
            size: 26,
            color: C.navy,
            font: 'Arial',
          }),
        ],
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [
          new TextRun({
            text: `Pregunta de autoevaluación: ${mission.formativeCheckpoint.question}`,
            bold: true,
            size: 22,
            color: C.midBlue,
            font: 'Calibri',
          }),
        ],
      })
    );

    if (mission.formativeCheckpoint.reflectionPrompts) {
      mission.formativeCheckpoint.reflectionPrompts.forEach((prompt, idx) => {
        elements.push(
          new Paragraph({
            spacing: { after: 80 },
            children: [
              new TextRun({ text: `• ${prompt}`, size: 20, font: 'Calibri' }),
            ],
          })
        );
      });
    }

    if (mission.formativeCheckpoint.criteriaChecklist) {
      elements.push(
        new Paragraph({
          spacing: { before: 100, after: 60 },
          children: [
            new TextRun({ text: 'Criterios de Verificación:', bold: true, size: 20, font: 'Calibri' }),
          ],
        })
      );
      mission.formativeCheckpoint.criteriaChecklist.forEach((crit) => {
        elements.push(
          new Paragraph({
            spacing: { after: 60 },
            children: [
              new TextRun({ text: `☐ ${crit}`, size: 20, font: 'Calibri' }),
            ],
          })
        );
      });
    }
  }

  return elements;
}

function renderWorkbookElement(element: WorkbookElement): (Paragraph | Table)[] {
  const items: (Paragraph | Table)[] = [];

  if (element.title) {
    items.push(
      new Paragraph({
        spacing: { before: 150, after: 60 },
        children: [
          new TextRun({
            text: `[Actividad] ${element.title}`,
            bold: true,
            size: 22,
            color: C.navy,
            font: 'Calibri',
          }),
        ],
      })
    );
  }

  if (element.instruction) {
    items.push(
      new Paragraph({
        spacing: { after: 120 },
        children: [
          new TextRun({
            text: `Instrucción: ${element.instruction}`,
            italics: true,
            size: 20,
            color: C.mutedText,
            font: 'Calibri',
          }),
        ],
      })
    );
  }

  switch (element.type) {
    case 'lines': {
      const rowCount = element.config?.rows || 4;
      for (let i = 0; i < rowCount; i++) {
        items.push(
          new Paragraph({
            spacing: { before: 60, after: 60 },
            children: [
              new TextRun({
                text: `${i + 1}. .....................................................................................................................................................................`,
                color: C.mutedText,
                size: 18,
                font: 'Consolas',
              }),
            ],
          })
        );
      }
      break;
    }

    case 'checkbox_list': {
      const cbs = element.config?.checkboxes || [
        'He verificado los requerimientos antes de iniciar.',
        'Los resultados coinciden con los parámetros especificados.',
        'El espacio de trabajo quedó limpio y ordenado.',
      ];
      cbs.forEach((cb) => {
        items.push(
          new Paragraph({
            spacing: { before: 40, after: 40 },
            children: [
              new TextRun({ text: `☐  ${cb}`, size: 20, font: 'Calibri' }),
            ],
          })
        );
      });
      break;
    }

    case 'empty_table':
    case 'data_recording': {
      const cols = element.config?.cols || ['Aspecto / Variable', 'Descripción / Parámetro', 'Observación / Registro'];
      const sampleRows = element.config?.sampleRows || 4;
      const colWidth = Math.floor(CONTENT_W / cols.length);

      const tableRows: TableRow[] = [
        new TableRow({
          children: cols.map((col) =>
            cell(col, { w: colWidth, bold: true, fill: C.tableBg, color: C.navy })
          ),
        }),
      ];

      for (let r = 0; r < sampleRows; r++) {
        tableRows.push(
          new TableRow({
            children: cols.map(() => cell(' ', { w: colWidth, fill: C.white })),
          })
        );
      }

      items.push(
        new Table({
          width: { size: CONTENT_W, type: WidthType.DXA },
          rows: tableRows,
        })
      );
      break;
    }

    case 'code_box': {
      const initialCode = element.config?.initialCode || '// Escribe aquí tus instrucciones o código:\n\n\n\n';
      items.push(
        new Table({
          width: { size: CONTENT_W, type: WidthType.DXA },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  width: { size: CONTENT_W, type: WidthType.DXA },
                  shading: { fill: C.codeBg, type: ShadingType.CLEAR },
                  borders: thinBorder(C.codeBorder),
                  margins: cellPadding(),
                  children: initialCode.split('\n').map(
                    (line) =>
                      new Paragraph({
                        spacing: { before: 20, after: 20 },
                        children: [
                          new TextRun({
                            text: line || ' ',
                            font: 'Consolas',
                            size: 18, // 9pt
                            color: C.darkText,
                          }),
                        ],
                      })
                  ),
                }),
              ],
            }),
          ],
        })
      );
      break;
    }

    case 'drawing_box': {
      items.push(
        new Table({
          width: { size: CONTENT_W, type: WidthType.DXA },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  width: { size: CONTENT_W, type: WidthType.DXA },
                  shading: { fill: C.lightBg, type: ShadingType.CLEAR },
                  borders: dottedBorder(),
                  margins: { top: 600, bottom: 600, left: 200, right: 200 },
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [
                        new TextRun({
                          text: '[ Espacio reservado para esquema, diagrama o boceto a mano ]',
                          italics: true,
                          size: 20,
                          color: C.mutedText,
                          font: 'Calibri',
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
      break;
    }
  }

  return items;
}

function buildTroubleshootTable(items: TroubleshootItem[]): Table {
  const colW1 = Math.floor(CONTENT_W * 0.25);
  const colW2 = Math.floor(CONTENT_W * 0.25);
  const colW3 = Math.floor(CONTENT_W * 0.30);
  const colW4 = Math.floor(CONTENT_W * 0.20);

  const rows: TableRow[] = [
    new TableRow({
      children: [
        cell('Síntoma / Falla Observable', { w: colW1, bold: true, fill: C.navy, color: C.white }),
        cell('Causa Técnica Subyacente', { w: colW2, bold: true, fill: C.navy, color: C.white }),
        cell('Pasos de Solución Metódica', { w: colW3, bold: true, fill: C.navy, color: C.white }),
        cell('Tip de Prevención Futura', { w: colW4, bold: true, fill: C.navy, color: C.white }),
      ],
    }),
  ];

  items.forEach((t) => {
    const steps = Array.isArray(t.solutionSteps) ? t.solutionSteps.join('; ') : String(t.solutionSteps || t.solution || '');
    rows.push(
      new TableRow({
        children: [
          cell(t.symptom, { bold: true, color: C.midBlue }),
          cell(t.rootCause || t.cause || 'Desajuste de parámetros'),
          cell(steps),
          cell(t.preventionTip || t.prevention || 'Revisar manual antes de operar'),
        ],
      })
    );
  });

  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    rows,
  });
}

function buildProjectSection(project: ProjectSection, cover: ActiveWorkTextbook['coverData']): (Paragraph | Table)[] {
  const elements: (Paragraph | Table)[] = [
    new Paragraph({
      spacing: { before: 200, after: 100 },
      children: [
        new TextRun({
          text: 'PROYECTO FORMATIVO INTEGRADOR: ARTEFACTO COMUNITARIO',
          bold: true,
          size: 32,
          color: C.navy,
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 150 },
      children: [
        new TextRun({
          text: `Artefacto o Producto Central: ${project.artifactName}`,
          bold: true,
          size: 24,
          color: C.midBlue,
          font: 'Calibri',
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 250, line: 360 },
      children: [
        new TextRun({
          text: `Impacto y Utilidad Comunitaria (PAEC): ${project.communityUtility}`,
          size: 22,
          font: 'Calibri',
        }),
      ],
    }),
    new Paragraph({
      spacing: { before: 150, after: 100 },
      children: [
        new TextRun({
          text: 'Cronograma de Fases de Construcción y Entregables:',
          bold: true,
          size: 24,
          color: C.navy,
          font: 'Calibri',
        }),
      ],
    }),
  ];

  const colW1 = Math.floor(CONTENT_W * 0.15);
  const colW2 = Math.floor(CONTENT_W * 0.30);
  const colW3 = Math.floor(CONTENT_W * 0.15);
  const colW4 = Math.floor(CONTENT_W * 0.40);

  const phaseRows: TableRow[] = [
    new TableRow({
      children: [
        cell('Fase', { w: colW1, bold: true, fill: C.navy, color: C.white }),
        cell('Título de la Etapa', { w: colW2, bold: true, fill: C.navy, color: C.white }),
        cell('Horas', { w: colW3, bold: true, fill: C.navy, color: C.white, align: AlignmentType.CENTER }),
        cell('Entregables y Criterios', { w: colW4, bold: true, fill: C.navy, color: C.white }),
      ],
    }),
  ];

  project.phases.forEach((p) => {
    phaseRows.push(
      new TableRow({
        children: [
          cell(`Fase ${p.phaseNum}`, { bold: true, color: C.midBlue }),
          cell(p.title),
          cell(`${p.allocatedHours} hrs`, { align: AlignmentType.CENTER }),
          cell(`${(p.deliverables || []).join(', ')} — ${p.instructions}`),
        ],
      })
    );
  });

  elements.push(
    new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      rows: phaseRows,
    })
  );

  return elements;
}

function buildEvaluationSection(evalSection: EvaluationSection, cover: ActiveWorkTextbook['coverData']): (Paragraph | Table)[] {
  const elements: (Paragraph | Table)[] = [
    new Paragraph({
      spacing: { before: 200, after: 100 },
      children: [
        new TextRun({
          text: 'INSTRUMENTOS OFICIALES DE EVALUACIÓN FORMATIVA Y SUMATIVA (NEM)',
          bold: true,
          size: 32,
          color: C.navy,
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: 'Rúbrica Analítica por Niveles de Desempeño Oficiales (DBEPA Puebla):',
          bold: true,
          size: 24,
          color: C.midBlue,
          font: 'Calibri',
        }),
      ],
    }),
  ];

  // Rúbrica
  const rubricCols = [
    { title: 'Criterio y Ponderación', w: Math.floor(CONTENT_W * 0.24) },
    { title: 'Sobresaliente (10-9)', w: Math.floor(CONTENT_W * 0.19) },
    { title: 'Notable (8-7)', w: Math.floor(CONTENT_W * 0.19) },
    { title: 'Suficiente (6-5)', w: Math.floor(CONTENT_W * 0.19) },
    { title: 'Insuficiente (4-1)', w: Math.floor(CONTENT_W * 0.19) },
  ];

  const rubricRows: TableRow[] = [
    new TableRow({
      children: rubricCols.map((col) =>
        cell(col.title, { w: col.w, bold: true, fill: C.navy, color: C.white })
      ),
    }),
  ];

  evalSection.rubric.forEach((crit) => {
    rubricRows.push(
      new TableRow({
        children: [
          cell(`${crit.criterion}\n(Ponderación: ${crit.weightPercent}%)`, { bold: true }),
          cell(getRubricLevelDescriptor(crit.levels, 'sobresaliente')),
          cell(getRubricLevelDescriptor(crit.levels, 'notable')),
          cell(getRubricLevelDescriptor(crit.levels, 'suficiente')),
          cell(getRubricLevelDescriptor(crit.levels, 'insuficiente')),
        ],
      })
    );
  });

  elements.push(
    new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      rows: rubricRows,
    })
  );

  // Lista de Cotejo
  if (evalSection.checklist && evalSection.checklist.length > 0) {
    elements.push(
      new Paragraph({
        spacing: { before: 300, after: 150 },
        children: [
          new TextRun({
            text: 'Lista de Verificación Técnica del Entregable:',
            bold: true,
            size: 24,
            color: C.navy,
            font: 'Calibri',
          }),
        ],
      })
    );

    const chkCols = [
      { title: 'Reactivo Observable', w: Math.floor(CONTENT_W * 0.60) },
      { title: 'Categoría', w: Math.floor(CONTENT_W * 0.20) },
      { title: 'Cumple (Sí / No)', w: Math.floor(CONTENT_W * 0.20) },
    ];

    const chkRows: TableRow[] = [
      new TableRow({
        children: chkCols.map((c) =>
          cell(c.title, { w: c.w, bold: true, fill: C.midBlue, color: C.white })
        ),
      }),
    ];

    evalSection.checklist.forEach((item) => {
      chkRows.push(
        new TableRow({
          children: [
            cell(item.item),
            cell(item.category || 'General'),
            cell('[  ] Sí   [  ] No', { align: AlignmentType.CENTER }),
          ],
        })
      );
    });

    elements.push(
      new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        rows: chkRows,
      })
    );
  }

  return elements;
}
