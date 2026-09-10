import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType, VerticalAlign,
  PageBreak, Header, Footer, PageNumber, HeadingLevel,
} from 'docx';
import type { GeneratedPlanningContent } from '@/types/planning';

// ── Color palette (DBEPA institutional) ─────────────────────────────────────────────
const C = {
  dark:   '1A3A5C',
  mid:    '2E6DA4',
  light:  'D6E4F0',
  alt:    'EBF3FA',
  apertura: '1B6B8A',
  ejecucion:'1B6B3A',
  conclusion:'6B3A1B',
  accent: 'E8A020',
  white:  'FFFFFF',
  gray:   'F0F4F8',
  text:   '1A1A1A',
};

const PAGE_W  = 12240;
const MARGIN  = 720;
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

  return new TableCell({
    columnSpan: span,
    width: w ? { size: w, type: WidthType.DXA } : undefined,
    shading: { fill, type: ShadingType.CLEAR },
    borders: bdr(),
    margins: CELLMRG,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    verticalAlign: valign as any,
    children: [new Paragraph({
      alignment: align,
      spacing: { before: 50, after: 50 },
      children: [new TextRun({ text, bold, italics, size, color, font: 'Arial' })],
    })],
  });
}

function tcH(text: string, opts = {}) {
  return tc(text, { bold: true, fill: C.dark, color: C.white, size: 18, ...opts });
}
function tcM(text: string, opts = {}) {
  return tc(text, { bold: true, fill: C.mid, color: C.white, size: 18, ...opts });
}
function tcL(text: string, opts = {}) {
  return tc(text, { bold: true, fill: C.light, size: 17, ...opts });
}
function tcE(w: number, fill = C.white) {
  return tc('', { w, fill });
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

function pb(): Paragraph {
  return new Paragraph({ children: [new PageBreak()] });
}

function noteP(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 60, after: 80 },
    children: [new TextRun({ text: `📌 ${text}`, italics: true, size: 16, color: '555555', font: 'Arial' })],
  });
}

function multiCell(
  items: string[],
  w: number,
  span = 1,
  fill = C.white
): TableCell {
  return new TableCell({
    columnSpan: span,
    width: { size: w, type: WidthType.DXA },
    shading: { fill, type: ShadingType.CLEAR },
    borders: bdr(),
    margins: CELLMRG,
    verticalAlign: VerticalAlign.TOP,
    children: items.map(item => new Paragraph({
      spacing: { before: 28, after: 28 },
      children: [new TextRun({ text: item.startsWith('•') ? item : `• ${item}`, size: 18, font: 'Arial', color: C.text })],
    })),
  });
}

// ── SECTION BUILDERS ─────────────────────────────────────────────────────────

function buildCover(content: GeneratedPlanningContent): (Paragraph | Table)[] {
  const s1 = content.sectionI;
  const cL = Math.floor(CONTENT * 0.38), cR = CONTENT - cL;

  return [
    tbl([new TableRow({ children: [new TableCell({
      columnSpan: 1,
      width: { size: CONTENT, type: WidthType.DXA },
      shading: { fill: C.dark, type: ShadingType.CLEAR },
      borders: bdr(C.dark),
      margins: { top: 160, bottom: 160, left: 300, right: 300 },
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'SECRETARÍA DE EDUCACIÓN PÚBLICA DE PUEBLA', bold: true, size: 20, color: C.white, font: 'Arial' })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Dirección de Bachilleratos Estatales y Preparatoria Abierta (DBEPA)', size: 17, color: 'AACCEE', font: 'Arial' })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Ciclo Escolar 2026-2027', size: 17, color: 'AACCEE', font: 'Arial' })] }),
      ],
    })]})], [CONTENT]),
    sp(),
    tbl([new TableRow({ children: [new TableCell({
      columnSpan: 1,
      width: { size: CONTENT, type: WidthType.DXA },
      shading: { fill: C.mid, type: ShadingType.CLEAR },
      borders: bdr(C.mid),
      margins: { top: 220, bottom: 220, left: 300, right: 300 },
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'PLANEACIÓN DIDÁCTICA', bold: true, size: 36, color: C.white, font: 'Arial' })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'BACHILLERATO GENERAL ESTATAL · DIGITAL · EMSAD — PUEBLA', bold: true, size: 22, color: 'DDEEFC', font: 'Arial' })] }),
      ],
    })]})], [CONTENT]),
    sp(),
    tbl([
      new TableRow({ children: [tcL('Nivel Educativo:', { w: cL }), tc('Bachillerato General Estatal · Digital · EMSAD', { w: cR })] }),
      new TableRow({ children: [tcL('Componente:', { w: cL }), tc(s1.component, { w: cR, fill: C.alt })] }),
      new TableRow({ children: [tcL('UAC:', { w: cL }), tc(s1.uacName, { w: cR })] }),
      new TableRow({ children: [tcL('Semestre:', { w: cL }), tc(`${s1.semester}er / ${s1.semester}º Semestre`, { w: cR, fill: C.alt })] }),
      new TableRow({ children: [tcL('Carga Horaria:', { w: cL }), tc(`${s1.totalHours} horas`, { w: cR })] }),
      new TableRow({ children: [tcL('Subsistema:', { w: cL }), tc(s1.subsystem, { w: cR, fill: C.alt })] }),
      new TableRow({ children: [tcL('Marco de Referencia:', { w: cL }), tc('NEM · MCCEMS · Lineamientos DBEPA 2026-2027', { w: cR })] }),
    ], [cL, cR]),
    pb(),
  ];
}

function buildSectionI(content: GeneratedPlanningContent): (Paragraph | Table)[] {
  const s = content.sectionI;
  const c6 = Math.floor(CONTENT / 6), rem = CONTENT - c6 * 6;
  const cols = [c6, c6, c6, c6, c6, c6 + rem];

  return [
    secHeading('I. DATOS GENERALES Y ADMINISTRATIVOS'),
    tbl([
      new TableRow({ children: [tcH('DATOS GENERALES Y ADMINISTRATIVOS', { w: CONTENT, span: 6, align: AlignmentType.CENTER, size: 20 })] }),
      new TableRow({ children: [tcL('Nombre del(a) Docente', { w: cols[0]*3, span: 3 }), tcL('Asignatura / UAC', { w: cols[3]*3, span: 3 })] }),
      new TableRow({ children: [tc(s.teacherName, { w: cols[0]*3, span: 3 }), tc(s.uacName, { w: cols[3]*3, span: 3 })] }),
      new TableRow({ children: [tcL('Semestre', { w: cols[0] }), tcL('Grupo(s)', { w: cols[1] }), tcL('Ciclo Escolar', { w: cols[2] }), tcL('Periodo de Aplicación', { w: cols[3]*2, span: 2 }), tcL('No. de Sesiones', { w: cols[5] })] }),
      new TableRow({ children: [tc(`${s.semester}°`, { w: cols[0], align: AlignmentType.CENTER }), tc(s.groups, { w: cols[1], align: AlignmentType.CENTER }), tc(s.schoolYear, { w: cols[2], align: AlignmentType.CENTER }), tc(s.applicationPeriod, { w: cols[3]*2, span: 2, align: AlignmentType.CENTER }), tc(s.estimatedSessions, { w: cols[5], align: AlignmentType.CENTER })] }),
      new TableRow({ children: [tcL('Componente Curricular', { w: cols[0]*2, span: 2 }), tcL('Carga Horaria', { w: cols[2]*2, span: 2 }), tcL('Modalidad / Subsistema', { w: cols[4]*2, span: 2 })] }),
      new TableRow({ children: [tc(s.component, { w: cols[0]*2, span: 2 }), tc(`${s.totalHours} horas totales`, { w: cols[2]*2, span: 2, align: AlignmentType.CENTER }), tc(s.subsystem, { w: cols[4]*2, span: 2 })] }),
    ], cols),
    sp(),
  ];
}

function buildSectionII(content: GeneratedPlanningContent): (Paragraph | Table)[] {
  const s = content.sectionII;
  const cL = Math.floor(CONTENT * 0.27), cR = CONTENT - cL;
  const cA0 = Math.floor(CONTENT * 0.45), cA1 = Math.floor(CONTENT * 0.15), cA2 = Math.floor(CONTENT * 0.15), cA3 = CONTENT - cA0 - cA1 - cA2;

  const isLaboral = content.sectionI.component?.toLowerCase().includes('laboral') || false;
  const activityLabel = isLaboral ? 'Actividades Clave' : 'Propósitos y Contenidos formativos';
  const tableHeader = isLaboral ? 'Actividad Clave / Contenido' : 'Propósito o Contenido formativo';

  return [
    secHeading('II. PROPÓSITO FORMATIVO DE LA CLASE'),
    tbl([
      new TableRow({ children: [tcH('INTENCIONALIDAD CURRICULAR', { w: CONTENT, span: 2, align: AlignmentType.CENTER, size: 20 })] }),
      new TableRow({ children: [tcL('Propósito General de la UAC', { w: cL }), tc(s.purpose, { w: cR })] }),
      new TableRow({ children: [
        tcL('Aprendizajes Esperados\n(Resultados de Aprendizaje)', { w: cL }),
        multiCell(s.learningOutcomes, cR),
      ] }),
      new TableRow({ children: [
        tcL('Vinculación con el PAEC\n(Apartado Obligatorio)', { w: cL }),
        tc(s.paecConnection, { w: cR, fill: C.gray }),
      ] }),
    ], [cL, cR]),
    sp(),
    subH(`${activityLabel} y Distribución Horaria`),
    tbl([
      new TableRow({ children: [
        tcM(tableHeader, { w: cA0 }),
        tcM('Corte Semestral', { w: cA1, align: AlignmentType.CENTER }),
        tcM('Horas Asignadas', { w: cA2, align: AlignmentType.CENTER }),
        tcM('% de la UAC', { w: cA3, align: AlignmentType.CENTER })
      ] }),
      ...s.activities.map((a, i) => new TableRow({ children: [
        tc(a.name, { w: cA0, fill: i % 2 === 0 ? C.white : C.alt }),
        tc(a.corte || 'N/A', { w: cA1, align: AlignmentType.CENTER, fill: i % 2 === 0 ? C.white : C.alt }),
        tc(`${a.hours} hrs.`, { w: cA2, align: AlignmentType.CENTER, fill: i % 2 === 0 ? C.white : C.alt }),
        tc(`${Math.round((a.hours / s.activities.reduce((sum, ac) => sum + ac.hours, 0)) * 100)}%`, { w: cA3, align: AlignmentType.CENTER, fill: i % 2 === 0 ? C.white : C.alt }),
      ]})),
      new TableRow({ children: [
        tcL('TOTAL', { w: cA0, align: AlignmentType.RIGHT }),
        tcL('-', { w: cA1, align: AlignmentType.CENTER }),
        tcL(`${s.activities.reduce((sum, a) => sum + a.hours, 0)} hrs.`, { w: cA2, align: AlignmentType.CENTER }),
        tcL('100%', { w: cA3, align: AlignmentType.CENTER })
      ] }),
    ], [cA0, cA1, cA2, cA3]),
    sp(),
  ];
}

function buildSectionIII(content: GeneratedPlanningContent): (Paragraph | Table)[] {
  const s = content.sectionIII;
  const c = [Math.floor(CONTENT * 0.28), Math.floor(CONTENT * 0.36), CONTENT - Math.floor(CONTENT * 0.28) - Math.floor(CONTENT * 0.36)];

  const rows: TableRow[] = [
    new TableRow({ children: [tcH('TABLA DE TRANSVERSALIDAD CURRICULAR', { w: CONTENT, span: 3, align: AlignmentType.CENTER, size: 20 })] }),
    new TableRow({ children: [tcM('Componente', { w: c[0] }), tcM('\u00c1rea / Elemento', { w: c[1] }), tcM('Descripción del Vínculo con la UAC', { w: c[2] })] }),
    new TableRow({ children: [tcL('CURRÍCULUM FUNDAMENTAL\n(Recursos Sociocognitivos y Áreas de Conocimiento)', { w: c[0] }), tcL('(Área)', { w: c[1] }), tcL('(Descripción del vínculo)', { w: c[2] })] }),
    ...s.fundamentalCurriculum.map((item, i) => new TableRow({ children: [
      tcE(c[0], i % 2 === 0 ? C.white : C.alt),
      tc(item.area, { w: c[1], fill: i % 2 === 0 ? C.white : C.alt }),
      tc(item.description, { w: c[2], fill: i % 2 === 0 ? C.white : C.alt }),
    ]})),
    new TableRow({ children: [tcL('CURRÍCULUM AMPLIADO', { w: c[0] }), tcL('(Área)', { w: c[1] }), tcL('(Descripción del vínculo)', { w: c[2] })] }),
    ...s.expandedCurriculum.map((item, i) => new TableRow({ children: [
      tcE(c[0], i % 2 === 0 ? C.alt : C.white),
      tc(item.area, { w: c[1], fill: i % 2 === 0 ? C.alt : C.white }),
      tc(item.description, { w: c[2], fill: i % 2 === 0 ? C.alt : C.white }),
    ]})),
  ];

  return [secHeading('III. TRANSVERSALIDAD'), tbl(rows, c), sp()];
}

function buildActivityTable(activity: GeneratedPlanningContent['sectionIV']['activities'][0], isLaboral: boolean): Table {
  const cols = [Math.floor(CONTENT * 0.09), Math.floor(CONTENT * 0.38), Math.floor(CONTENT * 0.28), CONTENT - Math.floor(CONTENT * 0.09) - Math.floor(CONTENT * 0.38) - Math.floor(CONTENT * 0.28)];

  function phaseRow(name: string, color: string, phase: { activities: string; processes: string; materials: string }) {
    return new TableRow({
      children: [
        new TableCell({ columnSpan: 1, width: { size: cols[0], type: WidthType.DXA }, shading: { fill: color, type: ShadingType.CLEAR }, borders: bdr(), margins: { top: 80, bottom: 80, left: 80, right: 80 }, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: name, bold: true, size: 17, color: C.white, font: 'Arial' })] })] }),
        new TableCell({ columnSpan: 1, width: { size: cols[1], type: WidthType.DXA }, shading: { fill: C.white, type: ShadingType.CLEAR }, borders: bdr(), margins: CELLMRG, verticalAlign: VerticalAlign.TOP, children: phase.activities.split('\n').map(line => new Paragraph({ spacing: { before: 28, after: 28 }, children: [new TextRun({ text: line, size: 18, font: 'Arial', color: C.text })] })) }),
        new TableCell({ columnSpan: 1, width: { size: cols[2], type: WidthType.DXA }, shading: { fill: C.white, type: ShadingType.CLEAR }, borders: bdr(), margins: CELLMRG, verticalAlign: VerticalAlign.TOP, children: phase.processes.split('\n').map(line => new Paragraph({ spacing: { before: 28, after: 28 }, children: [new TextRun({ text: line ? `• ${line}` : '', size: 18, font: 'Arial', color: C.text })] })) }),
        new TableCell({ columnSpan: 1, width: { size: cols[3], type: WidthType.DXA }, shading: { fill: C.white, type: ShadingType.CLEAR }, borders: bdr(), margins: CELLMRG, verticalAlign: VerticalAlign.TOP, children: phase.materials.split('\n').map(line => new Paragraph({ spacing: { before: 28, after: 28 }, children: [new TextRun({ text: line ? `• ${line}` : '', size: 18, font: 'Arial', color: C.text })] })) }),
      ],
    });
  }

  const label = isLaboral ? 'ACTIVIDAD CLAVE' : 'PROPÓSITO FORMATIVO';
  const rows: TableRow[] = [
    new TableRow({ children: [tcH(`${label}: ${activity.name} (${activity.hours} horas)`, { w: CONTENT, span: 4, align: AlignmentType.CENTER, size: 19 })] }),
  ];

  // If it's not laboral and has a defined Contenido Formativo, add a row for it
  const actAny = activity as any;
  if (!isLaboral && actAny.contenidoFormativo) {
    rows.push(new TableRow({
      children: [
        new TableCell({ columnSpan: 1, shading: { fill: C.mid, type: ShadingType.CLEAR }, borders: bdr(), margins: { top: 60, bottom: 60, left: 80, right: 80 }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Tema / Contenido:', bold: true, size: 17, color: C.white, font: 'Arial' })] })] }),
        new TableCell({ columnSpan: 3, shading: { fill: C.alt, type: ShadingType.CLEAR }, borders: bdr(), margins: CELLMRG, children: [new Paragraph({ children: [new TextRun({ text: actAny.contenidoFormativo, bold: true, size: 18, font: 'Arial', color: C.dark })] })] })
      ]
    }));
  }

  rows.push(
    new TableRow({ children: [new TableCell({ columnSpan: 1, shading: { fill: C.mid, type: ShadingType.CLEAR }, borders: bdr(), margins: { top: 60, bottom: 60, left: 80, right: 80 }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Metodología:', bold: true, size: 17, color: C.white, font: 'Arial' })] })] }), new TableCell({ columnSpan: 3, shading: { fill: C.alt, type: ShadingType.CLEAR }, borders: bdr(), margins: CELLMRG, children: [new Paragraph({ children: [new TextRun({ text: activity.methodology, bold: true, size: 18, font: 'Arial', color: C.dark })] })] })] }),
    new TableRow({ children: [tcM('Fase /\nMomento', { w: cols[0], align: AlignmentType.CENTER }), tcM('Actividades del Estudiante\n(Metodologías Activas)', { w: cols[1] }), tcM('Procesos de Pensamiento /\nConstrucción o Resignificación', { w: cols[2] }), tcM('Materiales /\nRecursos Didácticos', { w: cols[3] })] }),
    phaseRow('APER-\nTURA', C.apertura, activity.apertura),
    phaseRow('DESA-\nRROLLO', C.ejecucion, activity.ejecucion),
    phaseRow('CIERRE', C.conclusion, activity.conclusion)
  );

  return new Table({
    width: { size: CONTENT, type: WidthType.DXA },
    columnWidths: cols,
    rows: rows,
  });
}

function buildSectionIV(content: GeneratedPlanningContent, sequenceJson?: Record<number, { blockIndex: number; blockName: string; hours: number; sessions: { sessionNum: number; totalSessions: number; phase: string; title: string; teachingActivity: string; learningActivity: string; evidence: string; evaluation?: string }[] }> | null): (Paragraph | Table)[] {
  const isLaboral = content.sectionI.component?.toLowerCase().includes('laboral') || false;
  const label = isLaboral ? 'ACTIVIDAD CLAVE' : 'PROPÓSITO FORMATIVO';

  const elements: (Paragraph | Table)[] = [
    secHeading('IV. DISEÑO DE ESCENARIOS DE APRENDIZAJE (SECUENCIA DE ACTIVIDADES DIDÁCTICAS)'),
    noteP(content.sectionIV.note || 'El diseño de actividades emplea exclusivamente metodologías activas (ABP, Simulación, Método de Casos, Visita de campo).'),
    sp(),
  ];
  content.sectionIV.activities.forEach((activity, i) => {
    elements.push(subH(`▶ ${label} ${i + 1}: ${activity.name} (${activity.hours} horas)`));
    elements.push(buildActivityTable(activity, isLaboral));
    elements.push(sp());

    // Micro-Sesiones de 50 min
    const blockSeq = sequenceJson?.[i];
    if (blockSeq && blockSeq.sessions && blockSeq.sessions.length > 0) {
      const sc = [Math.floor(CONTENT * 0.08), Math.floor(CONTENT * 0.22), Math.floor(CONTENT * 0.35), CONTENT - Math.floor(CONTENT * 0.08) - Math.floor(CONTENT * 0.22) - Math.floor(CONTENT * 0.35)];
      const phaseColor: Record<string, string> = { Apertura: '0369a1', Desarrollo: '15803d', Cierre: '7e22ce' };
      const sessRows: TableRow[] = [
        new TableRow({ children: [tcH(`Sesiones de 50 minutos — ${blockSeq.sessions.length} sesiones totales`, { w: CONTENT, span: 4, align: AlignmentType.CENTER, size: 17 })] }),
        new TableRow({ children: [tcM('Sesión', { w: sc[0], align: AlignmentType.CENTER }), tcM('Título / Tema', { w: sc[1] }), tcM('Actividad del Docente', { w: sc[2] }), tcM('Actividad del Estudiante / Evidencia', { w: sc[3] })] }),
        ...blockSeq.sessions.map((s, si) => new TableRow({ children: [
          new TableCell({ width: { size: sc[0], type: WidthType.DXA }, shading: { fill: si % 2 === 0 ? C.white : C.alt, type: ShadingType.CLEAR }, borders: bdr(), margins: CELLMRG, verticalAlign: VerticalAlign.CENTER, children: [
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${s.phase.charAt(0)} ${s.sessionNum}/${s.totalSessions}`, bold: true, size: 14, font: 'Arial', color: phaseColor[s.phase] || '15803d' })] }),
          ] }),
          new TableCell({ width: { size: sc[1], type: WidthType.DXA }, shading: { fill: si % 2 === 0 ? C.white : C.alt, type: ShadingType.CLEAR }, borders: bdr(), margins: CELLMRG, children: [new Paragraph({ children: [new TextRun({ text: s.title, bold: true, size: 15, font: 'Arial', color: C.text })] })] }),
          new TableCell({ width: { size: sc[2], type: WidthType.DXA }, shading: { fill: si % 2 === 0 ? C.white : C.alt, type: ShadingType.CLEAR }, borders: bdr(), margins: CELLMRG, children: [new Paragraph({ children: [new TextRun({ text: s.teachingActivity, size: 14, font: 'Arial', color: C.text })] })] }),
          new TableCell({ width: { size: sc[3], type: WidthType.DXA }, shading: { fill: si % 2 === 0 ? C.white : C.alt, type: ShadingType.CLEAR }, borders: bdr(), margins: CELLMRG, children: [
            new Paragraph({ children: [new TextRun({ text: s.learningActivity, size: 14, font: 'Arial', color: C.text })] }),
            ...(s.evidence ? [new Paragraph({ spacing: { before: 40 }, children: [new TextRun({ text: `Evidencia: ${s.evidence}`, italics: true, size: 13, font: 'Arial', color: '64748b' })] })] : []),
          ] }),
        ] })),
      ];
      elements.push(new Table({ width: { size: CONTENT, type: WidthType.DXA }, columnWidths: sc, rows: sessRows }));
      elements.push(sp());
    }

    if (i < content.sectionIV.activities.length - 1) elements.push(pb());
  });
  return elements;
}

function buildSectionV(content: GeneratedPlanningContent): (Paragraph | Table)[] {
  const s = content.sectionV;
  const evals = s.evaluations;
  const c = [Math.floor(CONTENT*0.13), Math.floor(CONTENT*0.13), Math.floor(CONTENT*0.13), Math.floor(CONTENT*0.28), Math.floor(CONTENT*0.19), CONTENT - Math.floor(CONTENT*0.13)*3 - Math.floor(CONTENT*0.28) - Math.floor(CONTENT*0.19)];

  const rows: TableRow[] = [
    new TableRow({ children: [tcH('ESTRATEGIA DE EVALUACIÓN FORMATIVA', { w: CONTENT, span: 6, align: AlignmentType.CENTER, size: 20 })] }),
    new TableRow({ children: [tcM('Tipo de\nEvaluación', { w: c[0], align: AlignmentType.CENTER }), tcM('Agente\nEvaluador', { w: c[1], align: AlignmentType.CENTER }), tcM('Momento /\nAct. Clave', { w: c[2], align: AlignmentType.CENTER }), tcM('Evidencia de Desempeño\no Producto', { w: c[3] }), tcM('Instrumento de\nEvaluación', { w: c[4] }), tcM('Ponderación\n(%)', { w: c[5], align: AlignmentType.CENTER })] }),
    ...evals.map((ev, i) => new TableRow({ children: [
      tc(ev.type, { w: c[0], fill: i % 2 === 0 ? C.white : C.alt }),
      tc(ev.agent, { w: c[1], fill: i % 2 === 0 ? C.white : C.alt }),
      tc(ev.moment, { w: c[2], fill: i % 2 === 0 ? C.white : C.alt }),
      tc(ev.evidence, { w: c[3], fill: i % 2 === 0 ? C.white : C.alt }),
      tc(ev.instrument, { w: c[4], fill: i % 2 === 0 ? C.white : C.alt }),
      tc(`${ev.percentage}%`, { w: c[5], align: AlignmentType.CENTER, fill: i % 2 === 0 ? C.white : C.alt }),
    ]})),
    new TableRow({ children: [tcL('PONDERACIÓN TOTAL', { w: CONTENT-c[5], span: 5 }), tcL('100%', { w: c[5], align: AlignmentType.CENTER })] }),
  ];

  const elements: (Paragraph | Table)[] = [
    secHeading('V. ESTRATEGIA DE EVALUACIÓN FORMATIVA'),
  ];

  if (s.evaluationAgreement) {
    elements.push(subH('Acuerdo de Acreditación / Evaluación'));
    elements.push(new Paragraph({
      spacing: { before: 60, after: 120 },
      children: [new TextRun({ text: s.evaluationAgreement, size: 18, font: 'Arial', italics: true })],
    }));
    elements.push(sp());
  }

  elements.push(tbl(rows, c));
  elements.push(sp());

  return elements;
}

function buildSectionVI(content: GeneratedPlanningContent): (Paragraph | Table)[] {
  const s = content.sectionVI;
  const cL = Math.floor(CONTENT * 0.26), cR = CONTENT - cL;

  const cats = [
    ['Materiales aportados por los estudiantes', s.studentMaterials],
    ['Materiales elaborados por el docente', s.teacherMaterials],
    ['TICCAD / Recursos Digitales', s.digital],
    ['Espacios de aprendizaje', s.spaces],
    ['Fuentes de consulta', s.references],
  ] as [string, string[]][];

  return [
    secHeading('VI. RECURSOS, MATERIALES Y ESPACIOS DIDÁCTICOS'),
    tbl([
      new TableRow({ children: [tcH('RECURSOS, MATERIALES Y ESPACIOS DIDÁCTICOS', { w: CONTENT, span: 2, align: AlignmentType.CENTER, size: 20 })] }),
      new TableRow({ children: [tcM('Categoría', { w: cL }), tcM('Detalle', { w: cR })] }),
      ...cats.map(([cat, items], i) => new TableRow({ children: [
        tcL(cat, { w: cL }),
        multiCell(items, cR, 1, i % 2 === 0 ? C.white : C.alt),
      ]})),
    ], [cL, cR]),
    sp(),
  ];
}

function buildSectionVII(): (Paragraph | Table)[] {
  const c3 = Math.floor(CONTENT / 3), rem = CONTENT - c3 * 3;
  return [
    secHeading('VII. VALIDACIÓN Y FIRMAS'),
    tbl([
      new TableRow({ children: [tcM('Elaboró', { w: c3, align: AlignmentType.CENTER }), tcM('Revisó\n(Coordinador/a Académico/a)', { w: c3, align: AlignmentType.CENTER }), tcM('Autorizó\n(Director/a del Plantel)', { w: c3+rem, align: AlignmentType.CENTER })] }),
      new TableRow({ height: { value: 1200, rule: 'atLeast' }, children: [new TableCell({ width: { size: c3, type: WidthType.DXA }, shading: { fill: C.white, type: ShadingType.CLEAR }, borders: bdr(), margins: CELLMRG, children: [new Paragraph('')] }), new TableCell({ width: { size: c3, type: WidthType.DXA }, shading: { fill: C.alt, type: ShadingType.CLEAR }, borders: bdr(), margins: CELLMRG, children: [new Paragraph('')] }), new TableCell({ width: { size: c3+rem, type: WidthType.DXA }, shading: { fill: C.white, type: ShadingType.CLEAR }, borders: bdr(), margins: CELLMRG, children: [new Paragraph('')] })] }),
      new TableRow({ children: [tcL('Nombre y Firma', { w: c3, align: AlignmentType.CENTER }), tcL('Nombre y Firma', { w: c3, align: AlignmentType.CENTER }), tcL('Nombre y Firma', { w: c3+rem, align: AlignmentType.CENTER })] }),
      new TableRow({ children: [tc('Fecha: ___/___/______', { w: c3 }), tc('Fecha: ___/___/______', { w: c3, fill: C.alt }), tc('Fecha: ___/___/______', { w: c3+rem })] }),
    ], [c3, c3, c3+rem]),
    sp(),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200 }, children: [new TextRun({ text: 'DBEPA Puebla 2026-2027 | departamento.academico.dbepa@seppue.gob.mx', size: 16, color: '777777', font: 'Arial' })] }),
  ];
}

// ── MAIN EXPORT ───────────────────────────────────────────────────────────────

export async function generateDocx(
  content: GeneratedPlanningContent,
  sequenceJson?: Record<number, { blockIndex: number; blockName: string; hours: number; sessions: { sessionNum: number; totalSessions: number; phase: string; title: string; teachingActivity: string; learningActivity: string; evidence: string; evaluation?: string }[] }> | null
): Promise<Buffer> {
  const doc = new Document({
    styles: { default: { document: { run: { font: 'Arial', size: 20 } } } },
    sections: [{
      properties: {
        page: {
          size: { width: PAGE_W, height: 15840 },
          margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            spacing: { before: 0, after: 60 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: C.accent, space: 1 } },
            children: [new TextRun({ text: `DBEPA Puebla 2026-2027 | ${content.sectionI.uacName} | ${content.sectionI.semester}° Semestre`, size: 14, color: '777777', font: 'Arial' })],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            border: { top: { style: BorderStyle.SINGLE, size: 4, color: C.accent, space: 1 } },
            spacing: { before: 60 },
            children: [
              new TextRun({ text: 'Página ', size: 14, color: '777777', font: 'Arial' }),
              new TextRun({ children: [PageNumber.CURRENT], size: 14, color: '777777', font: 'Arial' }),
              new TextRun({ text: ' de ', size: 14, color: '777777', font: 'Arial' }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 14, color: '777777', font: 'Arial' }),
              new TextRun({ text: ' | NEM · MCCEMS · Lineamientos DBEPA 2026-2027', size: 14, color: '777777', font: 'Arial' }),
            ],
          })],
        }),
      },
      children: [
        ...buildCover(content),
        ...buildSectionI(content),
        ...buildSectionII(content),
        pb(),
        ...buildSectionIII(content),
        pb(),
        ...buildSectionIV(content, sequenceJson),
        ...buildSectionV(content),
        pb(),
        ...buildSectionVI(content),
        ...buildSectionVII(),
      ],
    }],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}

/**
 * Genera el documento Word (.docx) independiente para la Secuencia Didáctica Oficial
 */
export async function generateSecuenciaDocx(
  content: GeneratedPlanningContent,
  sequenceJson?: Record<number, { blockIndex: number; blockName: string; hours: number; sessions: { sessionNum: number; totalSessions: number; phase: string; title: string; teachingActivity: string; learningActivity: string; evidence: string; evaluation?: string }[] }> | null
): Promise<Buffer> {
  const doc = new Document({
    styles: { default: { document: { run: { font: 'Arial', size: 20 } } } },
    sections: [{
      properties: {
        page: {
          size: { width: PAGE_W, height: 15840 },
          margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({
              text: 'SEP PUEBLA · SUBSECRETARÍA DE EDUCACIÓN MEDIA SUPERIOR · DBEPA 2026-2027',
              size: 14, color: '666666', font: 'Arial',
            })],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            border: { top: { style: BorderStyle.SINGLE, size: 4, color: C.accent, space: 1 } },
            spacing: { before: 60 },
            children: [
              new TextRun({ text: 'Página ', size: 14, color: '777777', font: 'Arial' }),
              new TextRun({ children: [PageNumber.CURRENT], size: 14, color: '777777', font: 'Arial' }),
              new TextRun({ text: ' de ', size: 14, color: '777777', font: 'Arial' }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 14, color: '777777', font: 'Arial' }),
              new TextRun({ text: ' | Secuencia Didáctica Micro (Sesiones 50 min) · DBEPA', size: 14, color: '777777', font: 'Arial' }),
            ],
          })],
        }),
      },
      children: [
        secHeading('SECUENCIA DIDÁCTICA OFICIAL (ESLABÓN MICRO)'),
        noteP('Desglose de sesiones de 50 minutos con momentos pedagógicos (Apertura, Desarrollo y Cierre) conforme al Marco Curricular Común de la EMS (MCCEMS NEM).'),
        sp(),
        ...buildSectionI(content),
        sp(),
        ...buildSectionIV(content, sequenceJson),
        sp(),
        ...buildSectionVII(),
      ],
    }],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
