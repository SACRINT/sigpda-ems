import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType, VerticalAlign,
  PageBreak, Header, Footer, PageNumber, HeadingLevel,
} from 'docx';
import type { PaecProject } from '@/types/paec';

// DBEPA Institutional Color Palette
const C = {
  dark:   '1A3A5C',  // Dark Navy
  mid:    '2E6DA4',  // Blue
  light:  'D6E4F0',  // Light Blue
  alt:    'EBF3FA',  // Alternate row light blue
  accent: 'E8A020',  // Amber
  white:  'FFFFFF',
  gray:   'F0F4F8',
  text:   '1A1A1A',
  textMuted: '555555',
};

const PAGE_W = 12240;
const MARGIN = 720;
const CONTENT = PAGE_W - MARGIN * 2;

function bdr(color = 'AAAAAA') {
  const b = { style: BorderStyle.SINGLE, size: 4, color };
  return { top: b, bottom: b, left: b, right: b };
}

const CELLMRG = { top: 80, bottom: 80, left: 140, right: 140 };

function tc(
  text: string,
  opts: {
    w?: number; span?: number; bold?: boolean; fill?: string;
    color?: string; size?: number; align?: typeof AlignmentType[keyof typeof AlignmentType];
    valign?: typeof VerticalAlign[keyof typeof VerticalAlign]; italics?: boolean;
  } = {}
): TableCell {
  const { w, span = 1, bold = false, fill = C.white, color = C.text,
    size = 18, align = AlignmentType.LEFT, valign = VerticalAlign.CENTER,
    italics = false } = opts;

  const rawLines = (text || '').split('\n');
  const paragraphs = rawLines.map((line) => new Paragraph({
    alignment: align,
    spacing: { before: 30, after: 30 },
    children: [new TextRun({ text: line, bold, italics, size, color, font: 'Arial' })],
  }));

  return new TableCell({
    columnSpan: span,
    width: w ? { size: w, type: WidthType.DXA } : undefined,
    shading: { fill, type: ShadingType.CLEAR },
    borders: bdr(),
    margins: CELLMRG,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    verticalAlign: valign as any,
    children: paragraphs.length > 0 ? paragraphs : [new Paragraph({ children: [new TextRun('')] })],
  });
}

function tcH(text: string, opts = {}) {
  return tc(text, { bold: true, fill: C.dark, color: C.white, size: 18, ...opts });
}

function tbl(rows: TableRow[], widths: number[]): Table {
  return new Table({
    width: { size: CONTENT, type: WidthType.DXA },
    columnWidths: widths,
    rows,
  });
}

function secHeading(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 300, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: C.accent, space: 1 } },
    children: [new TextRun({ text, bold: true, size: 26, color: C.dark, font: 'Arial' })],
  });
}

function subH(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 200, after: 80 },
    children: [new TextRun({ text, bold: true, size: 22, color: C.mid, font: 'Arial' })],
  });
}

function sp(): Paragraph {
  return new Paragraph({ spacing: { before: 80, after: 80 }, children: [new TextRun('')] });
}

function parseMarkdownToParagraphs(text: string): Paragraph[] {
  if (!text) return [];
  const lines = text.split('\n');
  const paragraphs: Paragraph[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check if it's a bullet point
    if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
      const bulletText = trimmed.replace(/^[-*]\s*/, '');
      paragraphs.push(new Paragraph({
        bullet: { level: 0 },
        children: [new TextRun({ text: bulletText, size: 20, font: 'Arial' })],
        spacing: { before: 60, after: 60 },
      }));
    } else if (trimmed.startsWith('#')) {
      // Heading
      const hText = trimmed.replace(/^#+\s*/, '');
      const level = trimmed.match(/^#+/)?.[0].length || 1;
      const size = level === 1 ? 24 : level === 2 ? 20 : 18;
      const color = level === 1 ? C.dark : C.mid;
      paragraphs.push(new Paragraph({
        spacing: { before: 180, after: 80 },
        children: [new TextRun({ text: hText, bold: true, size, color, font: 'Arial' })],
      }));
    } else {
      // Normal paragraph
      paragraphs.push(new Paragraph({
        spacing: { before: 80, after: 80 },
        children: [new TextRun({ text: trimmed, size: 20, font: 'Arial' })],
      }));
    }
  }
  return paragraphs;
}

export async function generatePaecDocx(p: PaecProject, teacherName: string): Promise<Buffer> {
  const sections: any[] = [];

  // --- 1. TITLE PAGE / HEADER ---
  sections.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 400, after: 200 },
      children: [
        new TextRun({
          text: 'DOCUMENTO OFICIAL DEL PROYECTO ESCOLAR COMUNITARIO (PEC)',
          bold: true,
          size: 28,
          color: C.dark,
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 100, after: 300 },
      children: [
        new TextRun({
          text: 'Programa Aula, Escuela y Comunidad (PAEC) — Ciclo Escolar 2026-2027',
          bold: true,
          size: 20,
          color: C.accent,
          font: 'Arial',
        }),
      ],
    }),
    sp()
  );

  // --- 2. SECTION I: DATOS GENERALES ---
  sections.push(secHeading('I. DATOS GENERALES Y ADMINISTRATIVOS'));
  
  const cycleLabel = p.cycleType === 'A' ? 'Semestre A (Grupos de 1°, 3° y 5° Semestre)' : 
                     p.cycleType === 'B' ? 'Semestre B (Grupos de 2°, 4° y 6° Semestre)' :
                     'Ciclo Completo Anual (1° a 6° Semestre)';

  const genRows = [
    new TableRow({
      children: [
        tcH('Proyecto Escolar Comunitario:', { w: 3000 }),
        tc(p.projectName, { bold: true, w: 7800, span: 3 }),
      ],
    }),
    new TableRow({
      children: [
        tcH('Problemática Abordada:', { w: 3000 }),
        tc(p.problemStatement, { w: 7800, span: 3 }),
      ],
    }),
    new TableRow({
      children: [
        tcH('Docente Coordinador:', { w: 3000 }),
        tc(teacherName, { w: 3000 }),
        tcH('Ciclo Semestral / Relevo:', { w: 2400 }),
        tc(cycleLabel, { w: 2400 }),
      ],
    }),
    new TableRow({
      children: [
        tcH('Plantel Escolar:', { w: 3000 }),
        tc((p.schoolContext as any)?.facilities || 'BGE', { w: 3000 }),
        tcH('Ubicación / Comunidad:', { w: 2400 }),
        tc((p.communityContext as any)?.location || 'Puebla', { w: 2400 }),
      ],
    }),
  ];
  sections.push(tbl(genRows, [3000, 3000, 2400, 2400]));
  sections.push(sp());

  // --- 3. SECTION II: DIAGNÓSTICO COLECTIVO ---
  if (p.fase1Diagnostico) {
    sections.push(secHeading('II. FASE I: DIAGNÓSTICO COLECTIVO'));
    
    // Tabla 1: Comunidad
    sections.push(subH('Características de la comunidad (Contexto Externo)'));
    const t1Data = p.fase1Diagnostico.tabla1 || (p.fase1Diagnostico as any).tabla1_caracteristicas || [];
    const t1Rows = [
      new TableRow({ children: [tcH('Aspecto de la Localidad', { w: 3000 }), tcH('Descripción y Diagnóstico', { w: 7800 })] }),
      ...t1Data.map((r: any, i: number) => new TableRow({
        children: [
          tc(r.col1 || r.aspecto || '', { bold: true, w: 3000, fill: i % 2 === 0 ? C.gray : C.white }),
          tc(r.col2 || r.descripcion || '', { w: 7800, fill: i % 2 === 0 ? C.gray : C.white })
        ]
      }))
    ];
    sections.push(tbl(t1Rows, [3000, 7800]));
    sections.push(sp());

    // Tabla 2: Educación
    sections.push(subH('Características de la educación e institución (Contexto Interno)'));
    const t2Data = p.fase1Diagnostico.tabla2 || (p.fase1Diagnostico as any).tabla2_recursos || [];
    const t2Rows = [
      new TableRow({ children: [tcH('Aspecto Escolar/Educativo', { w: 3000 }), tcH('Descripción e Indicadores', { w: 7800 })] }),
      ...t2Data.map((r: any, i: number) => new TableRow({
        children: [
          tc(r.col1 || r.aspecto || r.tipo || '', { bold: true, w: 3000, fill: i % 2 === 0 ? C.gray : C.white }),
          tc(r.col2 || r.descripcion || r.detalle || '', { w: 7800, fill: i % 2 === 0 ? C.gray : C.white })
        ]
      }))
    ];
    sections.push(tbl(t2Rows, [3000, 7800]));
    sections.push(sp());

    // Tabla 3: FODA
    sections.push(subH('Análisis FODA y Estrategia Maestra del PEC'));
    const t3Data = p.fase1Diagnostico.tabla3 || (p.fase1Diagnostico as any).tabla3_foda || [];
    const t3Rows = [
      new TableRow({ children: [tcH('Aspecto FODA', { w: 3000 }), tcH('Análisis Estratégico', { w: 7800 })] }),
      ...t3Data.map((r: any, i: number) => new TableRow({
        children: [
          tc(r.aspect || r.aspecto || '', { bold: true, w: 3000, fill: i % 2 === 0 ? C.gray : C.white }),
          tc(r.analysis || r.analisis || r.descripcion || '', { w: 7800, fill: i % 2 === 0 ? C.gray : C.white })
        ]
      }))
    ];
    sections.push(tbl(t3Rows, [3000, 7800]));
    sections.push(sp());

    // Tabla 4: Justificación del Problema
    sections.push(subH('Justificación Metodológica de la problematica seleccionada'));
    const t4Data = p.fase1Diagnostico.tabla4 || (p.fase1Diagnostico as any).tabla4_seleccion || [];
    const t4Rows = [
      new TableRow({ children: [tcH('Etapa del Proceso', { w: 3000 }), tcH('Descripción Metodológica', { w: 7800 })] }),
      ...t4Data.map((r: any, i: number) => new TableRow({
        children: [
          tc(r.col1 || r.etapa || '', { bold: true, w: 3000, fill: i % 2 === 0 ? C.gray : C.white }),
          tc(r.col2 || r.descripcion || r.detalle || '', { w: 7800, fill: i % 2 === 0 ? C.gray : C.white })
        ]
      }))
    ];
    sections.push(tbl(t4Rows, [3000, 7800]));
    sections.push(new PageBreak());
  }

  // --- 4. SECTION III: JUSTIFICACIÓN, PILARES Y PROPÓSITOS ---
  if (p.fase2Justificacion) {
    sections.push(secHeading('III. FASE II: DISEÑO DEL PROYECTO (JUSTIFICACIÓN Y PROPÓSITO)'));
    
    if (p.fase2Justificacion.introduction) {
      sections.push(subH('Introducción y Sustento Académico'));
      sections.push(...parseMarkdownToParagraphs(p.fase2Justificacion.introduction));
      sections.push(sp());
    }

    if (p.fase2Justificacion.pilares && p.fase2Justificacion.pilares.length > 0) {
      sections.push(subH('Pilares Estratégicos de Viabilidad'));
      p.fase2Justificacion.pilares.forEach((pilar) => {
        const match = pilar.match(/^([^:]+):(.*)$/);
        if (match) {
          sections.push(new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: match[1] + ':', bold: true, size: 20, font: 'Arial', color: C.dark }),
              new TextRun({ text: match[2], size: 20, font: 'Arial' }),
            ],
            spacing: { before: 60, after: 60 },
          }));
        } else {
          sections.push(new Paragraph({
            bullet: { level: 0 },
            children: [new TextRun({ text: pilar, size: 20, font: 'Arial' })],
            spacing: { before: 60, after: 60 },
          }));
        }
      });
      sections.push(sp());
    }

    if (p.fase2Justificacion.proposito) {
      sections.push(subH('Propósitos Integrales del Proyecto'));
      const propRows = [
        new TableRow({ children: [tcH('Propósito', { w: 3000 }), tcH('Detalle Operativo', { w: 7800 })] }),
        new TableRow({ children: [tc('Educativo', { bold: true, w: 3000 }), tc(p.fase2Justificacion.proposito.educativo || '', { w: 7800 })] }),
        new TableRow({ children: [tc('Social/Ambiental', { bold: true, w: 3000, fill: C.gray }), tc(p.fase2Justificacion.proposito.social || '', { w: 7800, fill: C.gray })] }),
        new TableRow({ children: [tc('Funcional', { bold: true, w: 3000 }), tc(p.fase2Justificacion.proposito.funcional || '', { w: 7800 })] }),
      ];
      sections.push(tbl(propRows, [3000, 7800]));
      sections.push(sp());
    }

    if (p.fase2Justificacion.alcance) {
      sections.push(subH('Alcance, Metas y Recursos Requeridos'));
      if (p.fase2Justificacion.alcance.metas && p.fase2Justificacion.alcance.metas.length > 0) {
        sections.push(new Paragraph({ children: [new TextRun({ text: 'Metas Cuantitativas del Proyecto:', bold: true, size: 20, font: 'Arial', color: C.dark })] }));
        p.fase2Justificacion.alcance.metas.forEach((meta) => {
          sections.push(new Paragraph({
            bullet: { level: 0 },
            children: [new TextRun({ text: meta, size: 20, font: 'Arial' })],
            spacing: { before: 40, after: 40 },
          }));
        });
        sections.push(sp());
      }

      if (p.fase2Justificacion.alcance.participantes && p.fase2Justificacion.alcance.participantes.length > 0) {
        sections.push(new Paragraph({ children: [new TextRun({ text: 'Participantes Clave:', bold: true, size: 20, font: 'Arial', color: C.dark })] }));
        p.fase2Justificacion.alcance.participantes.forEach((part) => {
          sections.push(new Paragraph({
            bullet: { level: 0 },
            children: [new TextRun({ text: part, size: 20, font: 'Arial' })],
            spacing: { before: 40, after: 40 },
          }));
        });
        sections.push(sp());
      }

      if (p.fase2Justificacion.alcance.recursos && p.fase2Justificacion.alcance.recursos.length > 0) {
        sections.push(new Paragraph({ children: [new TextRun({ text: 'Recursos Requeridos:', bold: true, size: 20, font: 'Arial', color: C.dark })] }));
        p.fase2Justificacion.alcance.recursos.forEach((r) => {
          sections.push(new Paragraph({
            bullet: { level: 0 },
            children: [new TextRun({ text: r, size: 20, font: 'Arial' })],
            spacing: { before: 40, after: 40 },
          }));
        });
      }
    }

    sections.push(new PageBreak());
  }

  // --- 5. SECTION IV: MAPEO CURRICULAR TRANSVERSAL ---
  if (p.fase2Mapeo) {
    sections.push(secHeading('IV. VINCUACIÓN MULTIDISCIPLINARIA (MAPEO DE UACs)'));
    sections.push(
      new Paragraph({
        spacing: { before: 100, after: 200 },
        children: [
          new TextRun({
            text: 'La siguiente matriz detalla de forma exhaustiva cómo cada Unidad de Aprendizaje Curricular (UAC) activa dentro de los semestres del bloque actual se asocia directamente a la resolución de la problemática común y al desarrollo del PEC.',
            size: 20,
            font: 'Arial',
          }),
        ],
      })
    );

    const mapRows = [
      new TableRow({
        children: [
          tcH('Semestre', { w: 1200, align: AlignmentType.CENTER }),
          tcH('Unidad de Aprendizaje Curricular (UAC)', { w: 2800 }),
          tcH('Tema / Actividad Específica', { w: 3000 }),
          tcH('Vinculación y Progresión Curricular con el PEC', { w: 3800 }),
        ],
      }),
      ...p.fase2Mapeo.map((r, i) => new TableRow({
        children: [
          tc(`${r.semester}°`, { w: 1200, align: AlignmentType.CENTER, bold: true, fill: i % 2 === 0 ? C.gray : C.white }),
          tc(r.uacName, { w: 2800, bold: true, fill: i % 2 === 0 ? C.gray : C.white }),
          tc(r.topic, { w: 3000, fill: i % 2 === 0 ? C.gray : C.white }),
          tc(r.linking, { w: 3800, fill: i % 2 === 0 ? C.gray : C.white }),
        ],
      })),
    ];
    sections.push(tbl(mapRows, [1200, 2800, 3000, 3800]));
    sections.push(new PageBreak());
  }

  // --- 6. SECTION V: CRONOGRAMA MACRO (5 COLUMNAS) ---
  if (p.fase2Cronograma) {
    sections.push(secHeading('V. DISEÑO GENERAL (CRONOGRAMA MACRO POR FASES)'));
    
    const cronRows = [
      new TableRow({
        children: [
          tcH('Fase Bimestral', { w: 2000 }),
          tcH('Objetivo Bimestral', { w: 2400 }),
          tcH('Macro-Actividades del Proyecto', { w: 2800 }),
          tcH('Asignaturas Responsables y Justificación Pedagógica', { w: 2200 }),
          tcH('Semestre Involucrado', { w: 1400, align: AlignmentType.CENTER }),
        ],
      }),
      ...p.fase2Cronograma.map((r, i) => new TableRow({
        children: [
          tc(r.phase, { w: 2000, bold: true, fill: i % 2 === 0 ? C.gray : C.white }),
          tc(r.objective, { w: 2400, fill: i % 2 === 0 ? C.gray : C.white }),
          tc(r.macroActivities, { w: 2800, fill: i % 2 === 0 ? C.gray : C.white }),
          tc(r.responsibleSubjects || 'Colegiado Docente Multidisciplinario', { w: 2200, fill: i % 2 === 0 ? C.gray : C.white }),
          tc(r.semesterInvolved, { w: 1400, align: AlignmentType.CENTER, bold: true, fill: i % 2 === 0 ? C.gray : C.white }),
        ],
      })),
    ];
    sections.push(tbl(cronRows, [2000, 2400, 2800, 2200, 1400]));
    sections.push(new PageBreak());
  }

  // --- 7. SECTION VI: DETALLE CURRICULAR POR SEMESTRE (NUEVA) ---
  if (p.fase2DetalleCurricular && p.fase2DetalleCurricular.length > 0) {
    sections.push(secHeading('VI. DETALLE CURRICULAR Y ARTICULACIÓN POR SEMESTRE'));
    sections.push(
      new Paragraph({
        spacing: { before: 100, after: 180 },
        children: [
          new TextRun({
            text: 'La siguiente matriz desglosa la vinculación curricular específica para cada semestre escolar activo, detallando los propósitos formativos o progresiones de aprendizaje, la(s) fase(s) del proyecto en que interviene cada UAC y la fundamentación pedagógica que sustenta su participación en el PEC.',
            size: 20,
            font: 'Arial',
          }),
        ],
      })
    );

    const semestersPresent = Array.from(
      new Set(p.fase2DetalleCurricular.map((r) => Number(r.semester)))
    ).sort((a, b) => a - b);

    const widthsDetalle = [1000, 2600, 2600, 1800, 2800];

    for (const sem of semestersPresent) {
      sections.push(subH(`Matriz Curricular — ${sem}° Semestre de Bachillerato`));
      const rowsForSem = p.fase2DetalleCurricular.filter((r) => Number(r.semester) === sem);

      const tableRows = [
        new TableRow({
          children: [
            tcH('Sem.', { w: 1000, align: AlignmentType.CENTER }),
            tcH('Unidad de Aprendizaje Curricular (UAC)', { w: 2600 }),
            tcH('Progresiones / Propósitos', { w: 2600 }),
            tcH('Fase(s) del Proyecto', { w: 1800, align: AlignmentType.CENTER }),
            tcH('Justificación Curricular', { w: 2800 }),
          ],
        }),
        ...rowsForSem.map((r, i) =>
          new TableRow({
            children: [
              tc(`${r.semester}°`, { w: 1000, align: AlignmentType.CENTER, bold: true, fill: i % 2 === 0 ? C.gray : C.white }),
              tc(r.uacName, { w: 2600, bold: true, fill: i % 2 === 0 ? C.gray : C.white }),
              tc(r.progressionsOrPurposes, { w: 2600, fill: i % 2 === 0 ? C.gray : C.white }),
              tc(r.projectPhases, { w: 1800, align: AlignmentType.CENTER, fill: i % 2 === 0 ? C.gray : C.white }),
              tc(r.curricularJustification, { w: 2800, fill: i % 2 === 0 ? C.gray : C.white }),
            ],
          })
        ),
      ];

      sections.push(tbl(tableRows, widthsDetalle));
      sections.push(sp());
    }

    sections.push(new PageBreak());
  }

  // --- 8. SECTION VII: PLAN OPERATIVO DETALLADO (8 COLUMNAS) ---
  if (p.fase2PlanOperativo) {
    sections.push(secHeading('VII. PLAN OPERATIVO DETALLADO DE TRABAJO'));

    const renderPlanTable = (rows: any[], title: string) => {
      sections.push(subH(title));
      const planTableRows = [
        new TableRow({
          children: [
            tcH('Fase', { w: 1100 }),
            tcH('Actividad Semanal', { w: 2100 }),
            tcH('UAC Involucrada', { w: 1600 }),
            tcH('Progresión / Propósito', { w: 1100, align: AlignmentType.CENTER }),
            tcH('Estrategia Activa', { w: 1400 }),
            tcH('Semana', { w: 900, align: AlignmentType.CENTER }),
            tcH('Responsables', { w: 1200 }),
            tcH('Instrumento de Evaluación', { w: 1400 }),
          ],
        }),
        ...rows.map((r, i) => new TableRow({
          children: [
            tc(r.phase, { w: 1100, fill: i % 2 === 0 ? C.gray : C.white }),
            tc(r.activity, { w: 2100, fill: i % 2 === 0 ? C.gray : C.white }),
            tc(r.uac, { w: 1600, bold: true, fill: i % 2 === 0 ? C.gray : C.white }),
            tc(r.progression, { w: 1100, align: AlignmentType.CENTER, fill: i % 2 === 0 ? C.gray : C.white }),
            tc(r.strategy, { w: 1400, fill: i % 2 === 0 ? C.gray : C.white }),
            tc(r.week, { w: 900, align: AlignmentType.CENTER, bold: true, fill: i % 2 === 0 ? C.gray : C.white }),
            tc(r.responsibles, { w: 1200, fill: i % 2 === 0 ? C.gray : C.white }),
            tc(r.evaluationInstrument || 'Rúbrica de Desempeño', { w: 1400, fill: i % 2 === 0 ? C.gray : C.white }),
          ],
        })),
      ];
      sections.push(tbl(planTableRows, [1100, 2100, 1600, 1100, 1400, 900, 1200, 1400]));
      sections.push(sp());
    };

    if (p.fase2PlanOperativo.semestreA && p.fase2PlanOperativo.semestreA.length > 0) {
      renderPlanTable(p.fase2PlanOperativo.semestreA, 'Plan Operativo: Semestre A (1°, 3° y 5° Semestre - Bloque de Relevo A)');
    }
    if (p.fase2PlanOperativo.semestreB && p.fase2PlanOperativo.semestreB.length > 0) {
      renderPlanTable(p.fase2PlanOperativo.semestreB, 'Plan Operativo: Semestre B (2°, 4° y 6° Semestre - Bloque de Relevo B)');
    }

    sections.push(new PageBreak());
  }

  // --- 9. SECTION VIII: ANEXOS TÉCNICOS (6 TABLAS WORD CON FALLBACK) ---
  if (p.fase2Anexos) {
    sections.push(secHeading('VIII. ANEXOS TÉCNICOS Y SISTEMA DE INSTRUMENTACIÓN'));

    // Anexo 1: Minuta
    sections.push(subH('Anexo 1: Minuta de Instalación del Comité Escolar Comunitario y Formalización de Acuerdos'));
    if (p.fase2Anexos.anexo1Minuta) {
      const min = p.fase2Anexos.anexo1Minuta;
      const minMetaRows = [
        new TableRow({
          children: [
            tcH('C.C.T. del Plantel:', { w: 3200 }),
            tc(min.cct || 'Plantel Oficial DBEPA', { w: 7600, bold: true }),
          ],
        }),
        new TableRow({
          children: [
            tcH('Fecha de Celebración:', { w: 3200 }),
            tc(min.fecha || '', { w: 7600 }),
          ],
        }),
        new TableRow({
          children: [
            tcH('Tipo de Reunión / Propósito:', { w: 3200 }),
            tc(min.tipoReunion || '', { w: 7600 }),
          ],
        }),
      ];
      sections.push(tbl(minMetaRows, [3200, 7600]));
      sections.push(sp());

      if (min.acuerdos && min.acuerdos.length > 0) {
        sections.push(new Paragraph({
          spacing: { before: 80, after: 60 },
          children: [new TextRun({ text: 'Acuerdos Aprobados por el Comité:', bold: true, size: 20, color: C.dark, font: 'Arial' })],
        }));

        const acuerdosRows = [
          new TableRow({
            children: [
              tcH('No.', { w: 800, align: AlignmentType.CENTER }),
              tcH('Acuerdo Establecido', { w: 4400 }),
              tcH('Responsable', { w: 2200 }),
              tcH('Fecha Límite', { w: 1800, align: AlignmentType.CENTER }),
              tcH('Estatus', { w: 1600, align: AlignmentType.CENTER }),
            ],
          }),
          ...min.acuerdos.map((ac, i) =>
            new TableRow({
              children: [
                tc(String(ac.no ?? i + 1), { w: 800, align: AlignmentType.CENTER, bold: true, fill: i % 2 === 0 ? C.gray : C.white }),
                tc(ac.acuerdo, { w: 4400, fill: i % 2 === 0 ? C.gray : C.white }),
                tc(ac.responsable, { w: 2200, fill: i % 2 === 0 ? C.gray : C.white }),
                tc(ac.fechaLimite, { w: 1800, align: AlignmentType.CENTER, fill: i % 2 === 0 ? C.gray : C.white }),
                tc(ac.estatus, { w: 1600, align: AlignmentType.CENTER, bold: true, fill: i % 2 === 0 ? C.gray : C.white }),
              ],
            })
          ),
        ];
        sections.push(tbl(acuerdosRows, [800, 4400, 2200, 1800, 1600]));
        sections.push(sp());
      }

      if (min.firmas && min.firmas.length > 0) {
        sections.push(new Paragraph({
          spacing: { before: 100, after: 80 },
          children: [new TextRun({ text: 'Formalización y Firmas Colegiadas:', bold: true, size: 20, color: C.dark, font: 'Arial' })],
        }));

        const firmaRows: TableRow[] = [];
        for (let i = 0; i < min.firmas.length; i += 2) {
          const f1 = min.firmas[i];
          const f2 = min.firmas[i + 1];
          firmaRows.push(
            new TableRow({
              children: [
                tc(`\n\n______________________________________\n${f1.nombre}\n${f1.cargo}`, {
                  w: 5400,
                  align: AlignmentType.CENTER,
                  bold: true,
                }),
                f2
                  ? tc(`\n\n______________________________________\n${f2.nombre}\n${f2.cargo}`, {
                      w: 5400,
                      align: AlignmentType.CENTER,
                      bold: true,
                    })
                  : tc('', { w: 5400 }),
              ],
            })
          );
        }
        sections.push(tbl(firmaRows, [5400, 5400]));
      }
    } else if (p.fase2Anexos.anexo1) {
      sections.push(...parseMarkdownToParagraphs(p.fase2Anexos.anexo1));
    }
    sections.push(sp());

    // Anexo 2: Seguimiento Semanal
    sections.push(subH('Anexo 2: Cuadro de Seguimiento Operativo Semanal (16 Semanas de Ejecución)'));
    if (p.fase2Anexos.anexo2Seguimiento && Array.isArray(p.fase2Anexos.anexo2Seguimiento)) {
      const segRows = [
        new TableRow({
          children: [
            tcH('Semana', { w: 1100, align: AlignmentType.CENTER }),
            tcH('Fase', { w: 1200, align: AlignmentType.CENTER }),
            tcH('UAC', { w: 1800 }),
            tcH('Meta Operativa', { w: 2600 }),
            tcH('Evidencia Verificable', { w: 2000 }),
            tcH('% Avance', { w: 1000, align: AlignmentType.CENTER }),
            tcH('Semáforo', { w: 1100, align: AlignmentType.CENTER }),
          ],
        }),
        ...p.fase2Anexos.anexo2Seguimiento.map((s, i) => {
          const semLower = String(s.semaforo || '').toLowerCase();
          const semFill = semLower === 'verde' ? 'D4EDDA' : semLower === 'amarillo' ? 'FFF3CD' : 'F8D7DA';
          const semColor = semLower === 'verde' ? '155724' : semLower === 'amarillo' ? '856404' : '721C24';
          const semText = semLower === 'verde' ? 'VERDE' : semLower === 'amarillo' ? 'AMARILLO' : 'ROJO';

          return new TableRow({
            children: [
              tc(s.semana, { w: 1100, align: AlignmentType.CENTER, bold: true, fill: i % 2 === 0 ? C.gray : C.white }),
              tc(s.fase, { w: 1200, align: AlignmentType.CENTER, fill: i % 2 === 0 ? C.gray : C.white }),
              tc(s.uac, { w: 1800, bold: true, fill: i % 2 === 0 ? C.gray : C.white }),
              tc(s.metaOperativa, { w: 2600, fill: i % 2 === 0 ? C.gray : C.white }),
              tc(s.evidencia, { w: 2000, fill: i % 2 === 0 ? C.gray : C.white }),
              tc(`${s.avancePorcentaje}%`, { w: 1000, align: AlignmentType.CENTER, bold: true, fill: i % 2 === 0 ? C.gray : C.white }),
              tc(semText, { w: 1100, align: AlignmentType.CENTER, bold: true, fill: semFill, color: semColor }),
            ],
          });
        }),
      ];
      sections.push(tbl(segRows, [1100, 1200, 1800, 2600, 2000, 1000, 1100]));
    } else if (p.fase2Anexos.anexo2) {
      sections.push(...parseMarkdownToParagraphs(p.fase2Anexos.anexo2));
    }
    sections.push(sp());

    // Anexo 3: Reporte Mensual
    sections.push(subH('Anexo 3: Reporte Mensual de Avances, Dificultades y Ajustes de la Coordinación'));
    if (p.fase2Anexos.anexo3ReporteMensual) {
      const rep = p.fase2Anexos.anexo3ReporteMensual;
      const repRows = [
        new TableRow({
          children: [
            tcH('Período Reportado:', { w: 3000 }),
            tc(rep.periodo || 'Mensual', { w: 7800, bold: true }),
          ],
        }),
        new TableRow({
          children: [
            tcH('Resumen Ejecutivo del Avance:', { w: 3000 }),
            tc(rep.resumenEjecutivo || 'Despliegue conforme a planeación colegiada.', { w: 7800 }),
          ],
        }),
        new TableRow({
          children: [
            tcH('Logros Significativos Alcanzados:', { w: 3000 }),
            tc(rep.logros && rep.logros.length > 0 ? rep.logros.map((l) => '• ' + l).join('\n') : '• Actividades en tiempo según cronograma.', { w: 7800 }),
          ],
        }),
        new TableRow({
          children: [
            tcH('Dificultades / Retos Detectados:', { w: 3000 }),
            tc(rep.dificultades && rep.dificultades.length > 0 ? rep.dificultades.map((d) => '• ' + d).join('\n') : '• Sin incidencias operativas mayores.', { w: 7800 }),
          ],
        }),
        new TableRow({
          children: [
            tcH('Acciones de Ajuste / Mejora Continua:', { w: 3000 }),
            tc(rep.accionesAjuste && rep.accionesAjuste.length > 0 ? rep.accionesAjuste.map((a) => '• ' + a).join('\n') : '• Continuidad de acuerdos del colegiado.', { w: 7800 }),
          ],
        }),
      ];
      sections.push(tbl(repRows, [3000, 7800]));
    } else if (p.fase2Anexos.anexo3) {
      sections.push(...parseMarkdownToParagraphs(p.fase2Anexos.anexo3));
    }
    sections.push(sp());

    // Anexo 4: Impacto Comunidad
    if (p.fase2Anexos.anexo4ImpactoComunidad) {
      const a4 = p.fase2Anexos.anexo4ImpactoComunidad;
      sections.push(subH(`Anexo 4: ${a4.titulo || 'Cuestionario de Medición de Impacto y Transformación Comunitaria'}`));
      sections.push(new Paragraph({
        spacing: { before: 40, after: 100 },
        children: [
          new TextRun({
            text: `Tipo de Aplicación: ${a4.tipoAplicacion || 'PRE / POST'} | Escala Likert de Medición del Impacto Social`,
            italics: true,
            size: 18,
            color: C.textMuted,
            font: 'Arial',
          }),
        ],
      }));

      const a4Rows = [
        new TableRow({
          children: [
            tcH('No.', { w: 700, align: AlignmentType.CENTER }),
            tcH('Dimensión', { w: 2300 }),
            tcH('Reactivo / Planteamiento de Impacto Comunitario', { w: 4800 }),
            tcH('1', { w: 600, align: AlignmentType.CENTER }),
            tcH('2', { w: 600, align: AlignmentType.CENTER }),
            tcH('3', { w: 600, align: AlignmentType.CENTER }),
            tcH('4', { w: 600, align: AlignmentType.CENTER }),
            tcH('5', { w: 600, align: AlignmentType.CENTER }),
          ],
        }),
        ...(a4.reactivos || []).map((r, i) =>
          new TableRow({
            children: [
              tc(String(i + 1), { w: 700, align: AlignmentType.CENTER, bold: true, fill: i % 2 === 0 ? C.gray : C.white }),
              tc(r.dimension, { w: 2300, fill: i % 2 === 0 ? C.gray : C.white }),
              tc(r.reactivo, { w: 4800, fill: i % 2 === 0 ? C.gray : C.white }),
              tc('[  ]', { w: 600, align: AlignmentType.CENTER, fill: i % 2 === 0 ? C.gray : C.white }),
              tc('[  ]', { w: 600, align: AlignmentType.CENTER, fill: i % 2 === 0 ? C.gray : C.white }),
              tc('[  ]', { w: 600, align: AlignmentType.CENTER, fill: i % 2 === 0 ? C.gray : C.white }),
              tc('[  ]', { w: 600, align: AlignmentType.CENTER, fill: i % 2 === 0 ? C.gray : C.white }),
              tc('[  ]', { w: 600, align: AlignmentType.CENTER, fill: i % 2 === 0 ? C.gray : C.white }),
            ],
          })
        ),
      ];
      sections.push(tbl(a4Rows, [700, 2300, 4800, 600, 600, 600, 600, 600]));
      sections.push(new Paragraph({
        spacing: { before: 60, after: 60 },
        children: [
          new TextRun({
            text: 'Escala de Valoración: 1 = Totalmente en desacuerdo | 2 = En desacuerdo | 3 = Neutral / Indiferente | 4 = De acuerdo | 5 = Totalmente de acuerdo',
            size: 16,
            italics: true,
            color: C.textMuted,
            font: 'Arial',
          }),
        ],
      }));
    } else if (p.fase2Anexos.anexo4) {
      sections.push(subH('Anexo 4: Cuestionario de Hábitos y Percepciones de la Comunidad (Impacto Social)'));
      sections.push(...parseMarkdownToParagraphs(p.fase2Anexos.anexo4));
    }
    sections.push(sp());

    // Anexo 5: Autoevaluación Estudiantil
    if (p.fase2Anexos.anexo5AutoevaluacionEstudiantes) {
      const a5 = p.fase2Anexos.anexo5AutoevaluacionEstudiantes;
      sections.push(subH(`Anexo 5: ${a5.titulo || 'Rúbrica de Autoevaluación y Coevaluación de Habilidades Blandas'}`));
      sections.push(new Paragraph({
        spacing: { before: 40, after: 100 },
        children: [
          new TextRun({
            text: `Tipo de Aplicación: ${a5.tipoAplicacion || 'FINAL'} | Evaluación de Habilidades Blandas, Autonomía y Compromiso Social`,
            italics: true,
            size: 18,
            color: C.textMuted,
            font: 'Arial',
          }),
        ],
      }));

      const a5Rows = [
        new TableRow({
          children: [
            tcH('No.', { w: 700, align: AlignmentType.CENTER }),
            tcH('Dimensión Formativa', { w: 2300 }),
            tcH('Criterio de Desempeño / Aprendizaje Situado', { w: 4800 }),
            tcH('1', { w: 600, align: AlignmentType.CENTER }),
            tcH('2', { w: 600, align: AlignmentType.CENTER }),
            tcH('3', { w: 600, align: AlignmentType.CENTER }),
            tcH('4', { w: 600, align: AlignmentType.CENTER }),
            tcH('5', { w: 600, align: AlignmentType.CENTER }),
          ],
        }),
        ...(a5.reactivos || []).map((r, i) =>
          new TableRow({
            children: [
              tc(String(i + 1), { w: 700, align: AlignmentType.CENTER, bold: true, fill: i % 2 === 0 ? C.gray : C.white }),
              tc(r.dimension, { w: 2300, fill: i % 2 === 0 ? C.gray : C.white }),
              tc(r.reactivo, { w: 4800, fill: i % 2 === 0 ? C.gray : C.white }),
              tc('[  ]', { w: 600, align: AlignmentType.CENTER, fill: i % 2 === 0 ? C.gray : C.white }),
              tc('[  ]', { w: 600, align: AlignmentType.CENTER, fill: i % 2 === 0 ? C.gray : C.white }),
              tc('[  ]', { w: 600, align: AlignmentType.CENTER, fill: i % 2 === 0 ? C.gray : C.white }),
              tc('[  ]', { w: 600, align: AlignmentType.CENTER, fill: i % 2 === 0 ? C.gray : C.white }),
              tc('[  ]', { w: 600, align: AlignmentType.CENTER, fill: i % 2 === 0 ? C.gray : C.white }),
            ],
          })
        ),
      ];
      sections.push(tbl(a5Rows, [700, 2300, 4800, 600, 600, 600, 600, 600]));
      sections.push(new Paragraph({
        spacing: { before: 60, after: 60 },
        children: [
          new TextRun({
            text: 'Escala de Desempeño: 1 = Inicial | 2 = Básico | 3 = Satisfactorio | 4 = Avanzado | 5 = Sobresaliente / Liderazgo',
            size: 16,
            italics: true,
            color: C.textMuted,
            font: 'Arial',
          }),
        ],
      }));
    } else if (p.fase2Anexos.anexo5) {
      sections.push(subH('Anexo 5: Cuestionario de Autoevaluación de Habilidades y Competencias para Estudiantes'));
      sections.push(...parseMarkdownToParagraphs(p.fase2Anexos.anexo5));
    }
    sections.push(sp());

    // Anexo 6: Evaluación Colegiado
    if (p.fase2Anexos.anexo6EvaluacionColegiado) {
      const a6 = p.fase2Anexos.anexo6EvaluacionColegiado;
      sections.push(subH(`Anexo 6: ${a6.titulo || 'Cuestionario de Evaluación para Docentes y Trabajo Colegiado'}`));
      sections.push(new Paragraph({
        spacing: { before: 40, after: 100 },
        children: [
          new TextRun({
            text: `Tipo de Aplicación: ${a6.tipoAplicacion || 'FINAL'} | Evaluación Colegiada de la Transversalidad y Acompañamiento Institucional`,
            italics: true,
            size: 18,
            color: C.textMuted,
            font: 'Arial',
          }),
        ],
      }));

      const a6Rows = [
        new TableRow({
          children: [
            tcH('No.', { w: 700, align: AlignmentType.CENTER }),
            tcH('Dimensión Colegiada', { w: 2300 }),
            tcH('Criterio de Valoración Docente', { w: 4800 }),
            tcH('1', { w: 600, align: AlignmentType.CENTER }),
            tcH('2', { w: 600, align: AlignmentType.CENTER }),
            tcH('3', { w: 600, align: AlignmentType.CENTER }),
            tcH('4', { w: 600, align: AlignmentType.CENTER }),
            tcH('5', { w: 600, align: AlignmentType.CENTER }),
          ],
        }),
        ...(a6.reactivos || []).map((r, i) =>
          new TableRow({
            children: [
              tc(String(i + 1), { w: 700, align: AlignmentType.CENTER, bold: true, fill: i % 2 === 0 ? C.gray : C.white }),
              tc(r.dimension, { w: 2300, fill: i % 2 === 0 ? C.gray : C.white }),
              tc(r.reactivo, { w: 4800, fill: i % 2 === 0 ? C.gray : C.white }),
              tc('[  ]', { w: 600, align: AlignmentType.CENTER, fill: i % 2 === 0 ? C.gray : C.white }),
              tc('[  ]', { w: 600, align: AlignmentType.CENTER, fill: i % 2 === 0 ? C.gray : C.white }),
              tc('[  ]', { w: 600, align: AlignmentType.CENTER, fill: i % 2 === 0 ? C.gray : C.white }),
              tc('[  ]', { w: 600, align: AlignmentType.CENTER, fill: i % 2 === 0 ? C.gray : C.white }),
              tc('[  ]', { w: 600, align: AlignmentType.CENTER, fill: i % 2 === 0 ? C.gray : C.white }),
            ],
          })
        ),
      ];
      sections.push(tbl(a6Rows, [700, 2300, 4800, 600, 600, 600, 600, 600]));
      sections.push(new Paragraph({
        spacing: { before: 60, after: 60 },
        children: [
          new TextRun({
            text: 'Escala de Valoración: 1 = Totalmente en desacuerdo | 2 = En desacuerdo | 3 = Neutral | 4 = De acuerdo | 5 = Totalmente de acuerdo',
            size: 16,
            italics: true,
            color: C.textMuted,
            font: 'Arial',
          }),
        ],
      }));
    } else if (p.fase2Anexos.anexo6) {
      sections.push(subH('Anexo 6: Estructura del Informe Final y Socialización de Resultados'));
      sections.push(...parseMarkdownToParagraphs(p.fase2Anexos.anexo6));
    }

    sections.push(new PageBreak());
  }

  // --- 10. SECTION IX: GOBERNANZA, SISTEMA DE EVALUACIÓN E INFORME FINAL (NUEVA) ---
  sections.push(secHeading('IX. GOBERNANZA, SISTEMA DE EVALUACIÓN E INFORME FINAL'));

  sections.push(subH('1. Calendario de Seguimiento Institucional y Puntos de Control'));
  const govItems1 = [
    'Sesiones Ordinarias de Trabajo Colegiado: Celebradas al inicio de cada bimestre para alinear progresiones y ajustar actividades situadas.',
    'Relevo Operativo Intersemestral: Sesión formal en enero (Ciclo A a B) para la entrega-recepción de expedientes técnicos, bitácoras y comités estudiantiles.',
    'Puntos de Control Semanal: Registro continuo de metas operativas y semaforización mediante el Anexo 2 por parte de cada docente titular de UAC.',
    'Asambleas Comunitarias de Enlace: Dos reuniones anuales con autoridades locales, padres de familia y comités vecinales para la toma participativa de decisiones.',
  ];
  govItems1.forEach((item) => {
    const splitIdx = item.indexOf(':');
    if (splitIdx !== -1) {
      sections.push(new Paragraph({
        bullet: { level: 0 },
        spacing: { before: 50, after: 50 },
        children: [
          new TextRun({ text: item.slice(0, splitIdx + 1), bold: true, size: 20, color: C.dark, font: 'Arial' }),
          new TextRun({ text: item.slice(splitIdx + 1), size: 20, font: 'Arial' }),
        ],
      }));
    } else {
      sections.push(new Paragraph({
        bullet: { level: 0 },
        spacing: { before: 50, after: 50 },
        children: [new TextRun({ text: item, size: 20, font: 'Arial' })],
      }));
    }
  });
  sections.push(sp());

  sections.push(subH('2. Metodología de Evaluación Formativa y Social'));
  const govItems2 = [
    'Evaluación Formativa Transversal: Cada UAC evalúa procesualmente el desempeño de los alumnos mediante rúbricas analíticas situadas y portafolios de evidencias.',
    'Autoevaluación y Coevaluación del Estudiantado: Aplicación del Anexo 5 al cierre de cada semestre para ponderar el desarrollo de habilidades socioemocionales y trabajo en equipo.',
    'Medición del Impacto Comunitario (Pre vs. Post): Levantamiento del Anexo 4 en dos momentos clave para contrastar la percepción vecinal y cuantificar la transformación social lograda.',
    'Valoración del Trabajo Colegiado Docente: Evaluación de la gestión curricular y articulación interdisciplinaria mediante el Anexo 6 al concluir el ciclo escolar.',
  ];
  govItems2.forEach((item) => {
    const splitIdx = item.indexOf(':');
    if (splitIdx !== -1) {
      sections.push(new Paragraph({
        bullet: { level: 0 },
        spacing: { before: 50, after: 50 },
        children: [
          new TextRun({ text: item.slice(0, splitIdx + 1), bold: true, size: 20, color: C.dark, font: 'Arial' }),
          new TextRun({ text: item.slice(splitIdx + 1), size: 20, font: 'Arial' }),
        ],
      }));
    } else {
      sections.push(new Paragraph({
        bullet: { level: 0 },
        spacing: { before: 50, after: 50 },
        children: [new TextRun({ text: item, size: 20, font: 'Arial' })],
      }));
    }
  });
  sections.push(sp());

  sections.push(subH('3. Estructura del Informe Final para Supervisión Escolar y Autoridades (DBEPA / COSFAC)'));
  const finalReportStructure = [
    'Sección I: Ficha Técnica Institucional y Resumen Ejecutivo de Impacto.',
    'Sección II: Balance Cuantitativo de Metas y Evidencias de Aprendizaje Significativo.',
    'Sección III: Memoria Fotográfica y Sistematización de la Articulación Curricular Multidisciplinaria.',
    'Sección IV: Informe Comparativo de Impacto Social en la Localidad (Análisis Estadístico Pre vs. Post).',
    'Sección V: Carpeta Completa de Anexos Técnicos Oficiales (Minutas, Cuadros de Seguimiento y Encuestas Validadas).',
    'Sección VI: Dictamen de Sostenibilidad, Vinculación Continua y Recomendaciones para el Ciclo Escolar Siguiente.',
  ];
  finalReportStructure.forEach((item) => {
    sections.push(new Paragraph({
      bullet: { level: 0 },
      spacing: { before: 40, after: 40 },
      children: [new TextRun({ text: item, size: 20, font: 'Arial' })],
    }));
  });

  // Combine into single Document
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: MARGIN,
              bottom: MARGIN,
              left: MARGIN,
              right: MARGIN,
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: `Proyecto Escolar Comunitario: ${p.projectName} — DBEPA Puebla`,
                    size: 14,
                    color: C.textMuted,
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
                children: [
                  new TextRun({
                    text: 'Página ',
                    size: 16,
                    color: C.textMuted,
                    font: 'Arial',
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 16,
                    color: C.textMuted,
                    font: 'Arial',
                  }),
                  new TextRun({
                    text: ' de ',
                    size: 16,
                    color: C.textMuted,
                    font: 'Arial',
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    size: 16,
                    color: C.textMuted,
                    font: 'Arial',
                  }),
                ],
              }),
            ],
          }),
        },
        children: sections,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
