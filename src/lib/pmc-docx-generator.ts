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
  PageBreak,
  HeadingLevel,
} from 'docx';
import { SCHOOL_YEAR } from '@/lib/config';
import {
  computePmcIndicatorValues,
  type PmcIndicatorComputedValues,
  type PmcStatisticalContext,
} from './pmc-indicator-calculator';
import {
  PMC_TITULOS_SECCIONES,
  PMC_SUBSECCIONES_DIAGNOSTICO,
  PMC_SECCIONES_CANONICAS,
  clasificarNormativaJerarquica,
  getObjetivoPmcText,
  getTextoInfraestructura,
  getTextoBeneficiosComunitarios,
} from './pmc-document-structure';

// ─── Color Palette ───────────────────────────────────────────────────────────
const C = {
  navy:   '1A3A5C',
  blue:   'DCE4F5',
  white:  'FFFFFF',
  alt:    'EBF3FA',
  gray:   'F5F5F5',
  accent: '2E6DA4',
  text:   '1A1A1A',
  muted:  '555555',
};

const PAGE_W = 12240;
const MARGIN = 720;
const CONTENT = PAGE_W - MARGIN * 2;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function bdr(color = 'AAAAAA') {
  const b = { style: BorderStyle.SINGLE, size: 4, color };
  return { top: b, bottom: b, left: b, right: b };
}

const CELLMRG = { top: 80, bottom: 80, left: 140, right: 140 };

function tc(
  text: string,
  opts: {
    w?: number;
    span?: number;
    bold?: boolean;
    fill?: string;
    color?: string;
    size?: number;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    valign?: 'top' | 'center' | 'bottom';
    italics?: boolean;
  } = {}
): TableCell {
  const {
    w,
    span = 1,
    bold = false,
    fill = C.white,
    color = C.text,
    size = 18,
    align = AlignmentType.LEFT,
    valign = 'center',
    italics = false,
  } = opts;

  return new TableCell({
    columnSpan: span,
    width: w ? { size: w, type: WidthType.DXA } : undefined,
    shading: { fill, type: ShadingType.CLEAR },
    borders: bdr(),
    margins: CELLMRG,
    verticalAlign: valign,
    children: [
      new Paragraph({
        alignment: align,
        spacing: { before: 40, after: 40 },
        children: [new TextRun({ text, bold, italics, size, color, font: 'Arial' })],
      }),
    ],
  });
}

function tcH(text: string, opts: Parameters<typeof tc>[1] = {}) {
  return tc(text, { bold: true, fill: C.navy, color: C.white, size: 18, ...opts });
}

function tcSub(text: string, opts: Parameters<typeof tc>[1] = {}) {
  return tc(text, { bold: true, fill: C.blue, color: C.navy, size: 18, ...opts });
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
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 160 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: C.navy, space: 1 } },
    children: [new TextRun({ text, bold: true, size: 28, color: C.navy, font: 'Arial' })],
  });
}

function subHeading(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 100 },
    children: [new TextRun({ text, bold: true, size: 22, color: C.accent, font: 'Arial' })],
  });
}

function bodyPara(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 80, after: 80 },
    children: [new TextRun({ text: text ?? '', size: 20, color: C.text, font: 'Arial' })],
  });
}

function gap(n = 1): Paragraph[] {
  return Array.from({ length: n }, () => new Paragraph({ children: [] }));
}

function safeStr(val: unknown, fallback = ''): string {
  if (val === null || val === undefined || val === '') return fallback;
  return String(val);
}

function parseJson<T = unknown>(val: unknown): T {
  if (!val) return {} as T;
  if (typeof val === 'object') return val as T;
  try { return JSON.parse(String(val)) as T; } catch { return {} as T; }
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface PmcProject {
  id: string;
  school_name?: string;
  school_cct?: string;
  municipality?: string;
  locality?: string;
  school_zone?: string;
  director_name?: string;
  supervisor_name?: string;
  ciclo_escolar?: string;
  subsystem?: string;
  total_staff?: number;
  staff_data?: unknown;
  indicadores_academicos?: unknown;
  statistical_context?: PmcStatisticalContext;
  foda?: unknown;
  categorias_priorizadas?: unknown;
  diagnostico_comunidad?: string;
  normativa?: unknown;
  diagnostico_generado?: unknown;
  plan_accion?: unknown;
  current_step?: number;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

interface MetaInstitucional {
  categoria?: string;
  nombre_categoria?: string;
  tema?: string;
  meta?: string;
  estrategia?: string;
  linea_base?: string;
  personal_designado?: string;
  entregable?: string;
  periodo_inicio?: string;
  periodo_fin?: string;
  diagnostico_meta?: string;
}

interface MetaPersonal {
  nombre?: string;
  cargo?: string;
  categoria?: string;
  tema?: string;
  meta_individual?: string;
  estrategia?: string;
  entregable?: string;
  periodo?: string;
}

interface PlanAccion {
  metas_institucionales?: MetaInstitucional[];
  metas_personales?: MetaPersonal[];
}

interface DiagnosticoGenerado {
  presentacion?: string;
  contexto?: string;
  analisis_indicadores?: string;
  sintesis_foda?: string;
  priorizacion?: string;
}

interface IndicadoresAcademicos {
  aprobacion_ant?: number;
  reprobacion_ant?: number;
  abandono_ant?: number;
  et_ant?: number;
  aprobacion_meta?: number;
  reprobacion_meta?: number;
  abandono_meta?: number;
  et_meta?: number;
  matricula?: number;
  matricula_meta?: number;
  promedio_f11?: number;
  promedio_meta?: number;
}

interface FodaData {
  fortalezas?: string;
  oportunidades?: string;
  debilidades?: string;
  amenazas?: string;
}

interface NormativaDoc {
  titulo?: string;
  descripcion?: string;
  documentos?: Array<{
    orden?: number;
    titulo?: string;
    articulos?: string[];
  }>;
}

// ─── Cover Page ──────────────────────────────────────────────────────────────
function buildCoverPage(p: PmcProject): (Paragraph | Table)[] {
  const today = new Date().toLocaleDateString('es-MX', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const rows: (Paragraph | Table)[] = [
    new Paragraph({ spacing: { before: 0, after: 60 }, children: [] }),
    // Logo-like header block
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 40 },
      children: [
        new TextRun({
          text: 'GOBIERNO DEL ESTADO DE PUEBLA',
          bold: true,
          size: 20,
          color: C.navy,
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 40 },
      children: [
        new TextRun({
          text: 'SECRETARÍA DE EDUCACIÓN PÚBLICA DEL ESTADO',
          bold: true,
          size: 20,
          color: C.navy,
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 160 },
      children: [
        new TextRun({
          text: 'DIRECCIÓN DE EDUCACIÓN MEDIA SUPERIOR',
          bold: true,
          size: 20,
          color: C.navy,
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 80 },
      border: {
        top: { style: BorderStyle.SINGLE, size: 24, color: C.navy },
        bottom: { style: BorderStyle.SINGLE, size: 24, color: C.navy },
      },
      children: [
        new TextRun({
          text: 'PLAN DE MEJORA CONTINUA',
          bold: true,
          size: 48,
          color: C.navy,
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 80, after: 240 },
      children: [
        new TextRun({
          text: `Ciclo Escolar ${safeStr(p.ciclo_escolar) || '2025-2026'}`,
          bold: true,
          size: 32,
          color: C.accent,
          font: 'Arial',
        }),
      ],
    }),
    // Info table
    tbl(
      [
        new TableRow({ children: [tcH('DATOS DEL PLANTEL', { span: 2 })] }),
        new TableRow({ children: [tcSub('Nombre del Plantel'), tc(safeStr(p.school_name))] }),
        new TableRow({ children: [tcSub('CCT'), tc(safeStr(p.school_cct))] }),
        new TableRow({ children: [tcSub('Municipio'), tc(safeStr(p.municipality))] }),
        new TableRow({ children: [tcSub('Localidad'), tc(safeStr(p.locality))] }),
        new TableRow({ children: [tcSub('Zona Escolar'), tc(safeStr(p.school_zone))] }),
        new TableRow({ children: [tcSub('Subsistema'), tc(safeStr(p.subsystem) || 'BGE')] }),
        new TableRow({ children: [tcSub('Director(a)'), tc(safeStr(p.director_name))] }),
        new TableRow({ children: [tcSub('Supervisor(a)'), tc(safeStr(p.supervisor_name))] }),
        new TableRow({ children: [tcSub('Fecha de elaboración'), tc(today)] }),
      ],
      [CONTENT / 3, (CONTENT * 2) / 3]
    ),
    ...gap(2),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `Puebla, Pue., ${today}`,
          size: 20,
          color: C.muted,
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({ children: [new PageBreak()] }),
  ];

  return rows;
}

// ─── Índice General ──────────────────────────────────────────────────────────
function buildIndice(): (Paragraph | Table)[] {
  const items: (Paragraph | Table)[] = [
    secHeading('ÍNDICE GENERAL'),
    bodyPara('Estructura general del Programa de Mejora Continua (PMC) conforme a los lineamientos oficiales de la Dirección de Bachilleratos Estatales y Preparatoria Abierta (DBEPA Puebla):'),
    ...gap(),
  ];

  const colNumW = 1000;
  const colPagW = 1200;
  const colTitW = CONTENT - colNumW - colPagW;

  const tocRows: TableRow[] = [
    new TableRow({
      children: [
        tcH('N°', { w: colNumW, align: AlignmentType.CENTER }),
        tcH('Contenido Temático / Capítulo Oficial', { w: colTitW }),
        tcH('Sección', { w: colPagW, align: AlignmentType.CENTER }),
      ],
    }),
  ];

  for (const sec of PMC_SECCIONES_CANONICAS) {
    tocRows.push(
      new TableRow({
        children: [
          tc(String(sec.numero), { w: colNumW, bold: true, align: AlignmentType.CENTER, fill: C.alt }),
          tc(sec.titulo, { w: colTitW, bold: true, fill: C.alt }),
          tc(`Cap. ${sec.numero}`, { w: colPagW, bold: true, align: AlignmentType.CENTER, fill: C.alt }),
        ],
      })
    );
    if (sec.subsecciones) {
      for (const sub of sec.subsecciones) {
        tocRows.push(
          new TableRow({
            children: [
              tc(sub.numero, { w: colNumW, align: AlignmentType.CENTER }),
              tc(`    ${sub.titulo}`, { w: colTitW, italics: true, color: C.muted }),
              tc(sub.numero, { w: colPagW, align: AlignmentType.CENTER, italics: true, color: C.muted }),
            ],
          })
        );
      }
    }
  }

  items.push(tbl(tocRows, [colNumW, colTitW, colPagW]));
  items.push(new Paragraph({ children: [new PageBreak()] }));
  return items;
}

// ─── 1. Presentación ─────────────────────────────────────────────────────────
function buildPresentacion(diag: DiagnosticoGenerado, project: PmcProject): (Paragraph | Table)[] {
  const textoPresentacion = safeStr(diag.presentacion) ||
    `El ${safeStr(project.school_name, 'plantel escolar')}, con CCT ${safeStr(project.school_cct, 'N/D')} y ubicado en la localidad de ${safeStr(project.locality, 'N/D')}, municipio de ${safeStr(project.municipality, 'N/D')}, Puebla, presenta su Programa de Mejora Continua (PMC) para el ciclo escolar ${safeStr(project.ciclo_escolar, SCHOOL_YEAR)}. Este instrumento de planeación directiva se fundamenta en el artículo 3° de la Constitución Política de los Estados Unidos Mexicanos, garantizando el derecho humano a la educación con un enfoque de equidad, excelencia y mejora continua, alineado con el Modelo Educativo de la Nueva Escuela Mexicana (NEM), el Marco Curricular Común de la Educación Media Superior (MCCEMS) y los ejes rectores de la política educativa estatal CREAA.`;

  return [
    secHeading(PMC_TITULOS_SECCIONES.PRESENTACION),
    bodyPara(textoPresentacion),
    ...gap(),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

// ─── 2. Objetivo del PMC ─────────────────────────────────────────────────────
function buildObjetivo(project: PmcProject): (Paragraph | Table)[] {
  const objGeneral = getObjetivoPmcText(project.school_name, project.ciclo_escolar);

  return [
    secHeading(PMC_TITULOS_SECCIONES.OBJETIVO),
    subHeading('Objetivo General:'),
    bodyPara(objGeneral),
    ...gap(),
    subHeading('Objetivos Específicos y Estratégicos:'),
    new Paragraph({
      bullet: { level: 0 },
      spacing: { before: 40, after: 40 },
      children: [
        new TextRun({
          text: 'Fortalecer los aprendizajes de trayectoria de las y los aprendientes en los Recursos Sociocognitivos fundamentales (Pensamiento Matemático, Lengua y Comunicación, Conciencia Histórica y Cultura Digital).',
          size: 19,
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({
      bullet: { level: 0 },
      spacing: { before: 40, after: 40 },
      children: [
        new TextRun({
          text: 'Disminuir las tasas de deserción y reprobación escolar mediante estrategias integrales de tutoría, alertas tempranas y acompañamiento docente situado.',
          size: 19,
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({
      bullet: { level: 0 },
      spacing: { before: 40, after: 40 },
      children: [
        new TextRun({
          text: 'Promover la vinculación activa y corresponsable con la comunidad escolar y el entorno territorial a través del Proyecto Escolar Comunitario (PAEC-PEC).',
          size: 19,
          font: 'Arial',
        }),
      ],
    }),
    ...gap(),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

// ─── 3. Marco Normativo Jerarquizado ─────────────────────────────────────────
function buildNormativa(normativa?: NormativaDoc | null): (Paragraph | Table)[] {
  const normDocs = (Array.isArray(normativa?.documentos) && normativa.documentos.length > 0)
    ? normativa.documentos
    : [
        {
          orden: 1,
          titulo: 'Constitución Política de los Estados Unidos Mexicanos (Art. 3°)',
          articulos: ['Garantiza el derecho a la educación integral, inclusiva, universal, pública, gratuita, laica y de excelencia orientada al desarrollo humano.'],
        },
        {
          orden: 2,
          titulo: 'Ley General de Educación (Arts. 107, 108 y 109)',
          articulos: ['Establece la obligatoriedad del Programa de Mejora Continua en Educación Media Superior como instrumento estructurado de planeación participativa.'],
        },
        {
          orden: 3,
          titulo: 'Ley de Educación del Estado de Puebla (Arts. 80, 81 y 83)',
          articulos: ['Dispone la conformación participativa del PMC en los Consejos Técnicos Escolares y la vinculación corresponsable con la comunidad.'],
        },
        {
          orden: 4,
          titulo: 'Marco Curricular Común de la Educación Media Superior (MCCEMS - Acuerdo 09/08/23)',
          articulos: ['Fundamenta la formación socioemocional, recursos sociocognitivos, áreas del conocimiento y el vínculo pedagógico aula-escuela-comunidad.'],
        },
        {
          orden: 5,
          titulo: 'Lineamientos Oficiales del PMC para Educación Media Superior (SEMS / SEP Puebla)',
          articulos: ['Norma la priorización de categorías, diagnóstico escolar, formulación de metas CREAA y corresponsabilidad del colectivo docente.'],
        },
      ];

  const grupos = clasificarNormativaJerarquica(normDocs);

  const descripcion = safeStr(normativa?.descripcion) ||
    'El presente Plan de Mejora Continua (PMC) se sustenta en el marco jurídico y normativo vigente para el Bachillerato General del Estado de Puebla (BGE), en el marco del MCCEMS y la Subsecretaría de Educación Media Superior.';

  const items: (Paragraph | Table)[] = [
    secHeading(PMC_TITULOS_SECCIONES.NORMATIVIDAD),
    bodyPara(descripcion),
    ...gap(),
  ];

  for (const grp of grupos) {
    items.push(
      new Paragraph({
        spacing: { before: 180, after: 80 },
        children: [
          new TextRun({
            text: grp.categoria,
            bold: true,
            size: 21,
            color: C.navy,
            font: 'Arial',
          }),
        ],
      })
    );

    for (const doc of grp.documentos) {
      items.push(
        new Paragraph({
          spacing: { before: 100, after: 40 },
          children: [
            new TextRun({
              text: `${doc.orden != null ? `${doc.orden}. ` : ''}${safeStr(doc.titulo)}`,
              bold: true,
              size: 19,
              color: C.accent,
              font: 'Arial',
            }),
          ],
        })
      );
      if (Array.isArray(doc.articulos)) {
        for (const art of doc.articulos) {
          items.push(
            new Paragraph({
              bullet: { level: 0 },
              spacing: { before: 30, after: 30 },
              children: [new TextRun({ text: safeStr(art), size: 18, font: 'Arial', color: C.text })],
            })
          );
        }
      }
    }
  }

  items.push(new Paragraph({ children: [new PageBreak()] }));
  return items;
}

// ─── 4. Diagnóstico ──────────────────────────────────────────────────────────
function buildDiagnostico(
  diag: DiagnosticoGenerado,
  indic: IndicadoresAcademicos,
  foda: FodaData,
  statsCtx?: PmcStatisticalContext | null,
  project?: PmcProject
): (Paragraph | Table)[] {
  const items: (Paragraph | Table)[] = [secHeading(PMC_TITULOS_SECCIONES.DIAGNOSTICO)];

  // 4.1 Contexto Socioeducativo y Territorial
  items.push(subHeading(PMC_SUBSECCIONES_DIAGNOSTICO.CONTEXTO));
  const contextoText = safeStr(diag.contexto || project?.diagnostico_comunidad) ||
    'El plantel se ubica en un entorno que exige una intervención directiva basada en la gestión comunitaria, atendiendo las características socioculturales y desafíos de movilidad de la población escolar.';
  items.push(bodyPara(contextoText));
  items.push(...gap());

  // 4.2 Indicadores Académicos (Línea Base vs Meta)
  items.push(subHeading(PMC_SUBSECCIONES_DIAGNOSTICO.INDICADORES));
  const indVals = computePmcIndicatorValues(indic, statsCtx);
  items.push(
    tbl(
      [
        new TableRow({
          children: [
            tcH('Indicador Oficial'),
            tcH('Ciclo Anterior (Línea Base)', { align: AlignmentType.CENTER }),
            tcH('Meta Ciclo Actual', { align: AlignmentType.CENTER }),
          ],
        }),
        new TableRow({
          children: [
            tc('Índice de Aprobación Escolar'),
            tc(indVals.aprobacion.ant, { align: AlignmentType.CENTER }),
            tc(indVals.aprobacion.meta, { align: AlignmentType.CENTER }),
          ],
        }),
        new TableRow({
          children: [
            tc('Índice de Reprobación Escolar', { fill: C.alt }),
            tc(indVals.reprobacion.ant, { align: AlignmentType.CENTER, fill: C.alt }),
            tc(indVals.reprobacion.meta, { align: AlignmentType.CENTER, fill: C.alt }),
          ],
        }),
        new TableRow({
          children: [
            tc('Tasa de Abandono Escolar'),
            tc(indVals.abandono.ant, { align: AlignmentType.CENTER }),
            tc(indVals.abandono.meta, { align: AlignmentType.CENTER }),
          ],
        }),
        new TableRow({
          children: [
            tc('Eficiencia Terminal', { fill: C.alt }),
            tc(indVals.eficiencia.ant, { align: AlignmentType.CENTER, fill: C.alt }),
            tc(indVals.eficiencia.meta, { align: AlignmentType.CENTER, fill: C.alt }),
          ],
        }),
        new TableRow({
          children: [
            tc('Matrícula Total del Plantel'),
            tc(indVals.matricula.ant, { align: AlignmentType.CENTER, span: 2 }),
          ],
        }),
      ],
      [CONTENT / 2, CONTENT / 4, CONTENT / 4]
    )
  );

  if (diag.analisis_indicadores) {
    items.push(...gap());
    items.push(bodyPara(diag.analisis_indicadores));
  }
  items.push(...gap());

  // 4.3 Infraestructura y Equipamiento Escolar
  items.push(subHeading(PMC_SUBSECCIONES_DIAGNOSTICO.INFRAESTRUCTURA));
  items.push(bodyPara(getTextoInfraestructura(project)));
  items.push(...gap());

  // 4.4 Beneficios y Vinculación Comunitaria
  items.push(subHeading(PMC_SUBSECCIONES_DIAGNOSTICO.BENEFICIOS));
  items.push(bodyPara(getTextoBeneficiosComunitarios(project)));
  items.push(...gap());

  // 4.5 Matriz FODA Situacional
  items.push(subHeading(PMC_SUBSECCIONES_DIAGNOSTICO.FODA));
  items.push(
    tbl(
      [
        new TableRow({
          children: [
            tcH('FACTORES INTERNOS', { align: AlignmentType.CENTER, span: 2 }),
          ],
        }),
        new TableRow({
          children: [
            tcH('FORTALEZAS (F)', { align: AlignmentType.CENTER }),
            tcH('DEBILIDADES (D)', { align: AlignmentType.CENTER, fill: '#B71C1C' }),
          ],
        }),
        new TableRow({
          children: [
            tc(safeStr(foda.fortalezas, 'Compromiso docente, trabajo colegiado y procesos estandarizados.'), { fill: '#E8F5E9' }),
            tc(safeStr(foda.debilidades, 'Rezago académico de ingreso y recursos tecnológicos limitados.'), { fill: '#FFEBEE' }),
          ],
        }),
        new TableRow({
          children: [
            tcH('FACTORES EXTERNOS', { align: AlignmentType.CENTER, span: 2 }),
          ],
        }),
        new TableRow({
          children: [
            tcH('OPORTUNIDADES (O)', { align: AlignmentType.CENTER }),
            tcH('AMENAZAS (A)', { align: AlignmentType.CENTER, fill: '#E65100' }),
          ],
        }),
        new TableRow({
          children: [
            tc(safeStr(foda.oportunidades, 'Vinculación con Telesecundarias y gestión de infraestructura comunitaria.'), { fill: '#E3F2FD' }),
            tc(safeStr(foda.amenazas, 'Condiciones geográficas complejas y limitaciones de transporte público.'), { fill: '#FFF3E0' }),
          ],
        }),
      ],
      [CONTENT / 2, CONTENT / 2]
    )
  );

  if (diag.sintesis_foda) {
    items.push(...gap());
    items.push(bodyPara(diag.sintesis_foda));
  }

  items.push(new Paragraph({ children: [new PageBreak()] }));
  return items;
}

// ─── 5. Priorización de Categorías ───────────────────────────────────────────
function buildPriorizacion(
  diag: DiagnosticoGenerado,
  categorias: Array<{ id?: string; nombre?: string; temas?: string[] }>
): (Paragraph | Table)[] {
  const items: (Paragraph | Table)[] = [secHeading(PMC_TITULOS_SECCIONES.PRIORIZACION)];

  const textoPrio = safeStr(diag.priorizacion) ||
    'Para el ciclo escolar se establecen las categorías y ámbitos de acción estratégicos orientados a atender las problemáticas prioritarias detectadas en el diagnóstico socioeducativo, bajo la política CREAA.';
  items.push(bodyPara(textoPrio));
  items.push(...gap());

  if (Array.isArray(categorias) && categorias.length > 0) {
    items.push(
      tbl(
        [
          new TableRow({
            children: [
              tcH('N°', { w: 800 }),
              tcH('Categoría Priorizada (Política CREAA)', { w: Math.floor(CONTENT * 0.45) }),
              tcH('Temas y Ámbitos de Intervención', { w: CONTENT - 800 - Math.floor(CONTENT * 0.45) }),
            ],
          }),
          ...categorias.map(
            (cat, i) =>
              new TableRow({
                children: [
                  tc(String(i + 1), { w: 800, align: AlignmentType.CENTER, fill: i % 2 ? C.alt : C.white }),
                  tc(safeStr(cat.nombre || `Categoría ${cat.id ?? i + 1}`), { fill: i % 2 ? C.alt : C.white }),
                  tc(Array.isArray(cat.temas) && cat.temas.length > 0 ? cat.temas.join('; ') : 'Todos los ámbitos prioritarios aplicables', { fill: i % 2 ? C.alt : C.white }),
                ],
              })
          ),
        ],
        [800, Math.floor(CONTENT * 0.45), CONTENT - 800 - Math.floor(CONTENT * 0.45)]
      )
    );
  }

  items.push(new Paragraph({ children: [new PageBreak()] }));
  return items;
}

// ─── 6. Plan de Acción ───────────────────────────────────────────────────────
function buildPlanAccion(plan: PlanAccion): (Paragraph | Table)[] {
  const items: (Paragraph | Table)[] = [secHeading(PMC_TITULOS_SECCIONES.PLAN_ACCION)];

  const metas = plan.metas_institucionales ?? [];

  if (metas.length === 0) {
    items.push(bodyPara('No se han registrado metas institucionales específicas en el plan de acción.'));
  }

  for (let i = 0; i < metas.length; i++) {
    const m = metas[i];
    items.push(subHeading(`Ficha Técnica ${i + 1}: ${m.nombre_categoria || m.categoria || 'Ámbito Institucional'}`));
    items.push(
      tbl(
        [
          new TableRow({
            children: [
              tcH('Campo Descriptivo', { w: CONTENT / 3 }),
              tcH('Especificación de la Meta Institucional', { w: (CONTENT * 2) / 3 }),
            ],
          }),
          new TableRow({
            children: [tcSub('Tema Específico'), tc(safeStr(m.tema))],
          }),
          new TableRow({
            children: [tcSub('Meta SMART', { fill: C.alt }), tc(safeStr(m.meta), { fill: C.alt })],
          }),
          new TableRow({
            children: [tcSub('Estrategia de Operación'), tc(safeStr(m.estrategia))],
          }),
          new TableRow({
            children: [tcSub('Línea Base Documentada', { fill: C.alt }), tc(safeStr(m.linea_base), { fill: C.alt })],
          }),
          new TableRow({
            children: [tcSub('Personal Designado / Responsable'), tc(safeStr(m.personal_designado))],
          }),
          new TableRow({
            children: [tcSub('Entregable Comprobable', { fill: C.alt }), tc(safeStr(m.entregable), { fill: C.alt })],
          }),
          new TableRow({
            children: [
              tcSub('Período de Ejecución'),
              tc(
                (m.periodo_inicio || m.periodo_fin)
                  ? `${safeStr(m.periodo_inicio, 'N/D')} — ${safeStr(m.periodo_fin, 'N/D')}`
                  : 'N/D'
              ),
            ],
          }),
          new TableRow({
            children: [tcSub('Diagnóstico de la Meta', { fill: C.alt }), tc(safeStr(m.diagnostico_meta), { fill: C.alt })],
          }),
        ],
        [CONTENT / 3, (CONTENT * 2) / 3]
      )
    );
    items.push(...gap());
  }

  items.push(new Paragraph({ children: [new PageBreak()] }));
  return items;
}

// ─── 7. Metas Individuales del Personal ──────────────────────────────────────
function buildMetasPersonales(plan: PlanAccion): (Paragraph | Table)[] {
  const items: (Paragraph | Table)[] = [secHeading(PMC_TITULOS_SECCIONES.METAS_INDIVIDUALES)];

  const personal = plan.metas_personales ?? [];

  if (personal.length === 0) {
    items.push(bodyPara('No se han registrado metas individuales de la plantilla docente en el sistema.'));
    items.push(new Paragraph({ children: [new PageBreak()] }));
    return items;
  }

  items.push(
    tbl(
      [
        new TableRow({
          children: [
            tcH('Nombre del Integrante'),
            tcH('Cargo / Función'),
            tcH('Meta y Compromiso Individual'),
            tcH('Entregable Comprobable'),
            tcH('Período'),
          ],
        }),
        ...personal.map(
          (mp, i) =>
            new TableRow({
              children: [
                tc(safeStr(mp.nombre), { fill: i % 2 ? C.alt : C.white }),
                tc(safeStr(mp.cargo), { fill: i % 2 ? C.alt : C.white }),
                tc(
                  safeStr(
                    mp.categoria
                      ? `[${mp.categoria}${mp.tema ? ` - ${mp.tema}` : ''}] ${mp.meta_individual || ''}`
                      : mp.meta_individual
                  ),
                  { fill: i % 2 ? C.alt : C.white }
                ),
                tc(safeStr(mp.entregable), { fill: i % 2 ? C.alt : C.white }),
                tc(safeStr(mp.periodo), { fill: i % 2 ? C.alt : C.white }),
              ],
            })
        ),
      ],
      [
        Math.floor(CONTENT * 0.18),
        Math.floor(CONTENT * 0.15),
        Math.floor(CONTENT * 0.29),
        Math.floor(CONTENT * 0.25),
        Math.floor(CONTENT * 0.13),
      ]
    )
  );

  items.push(new Paragraph({ children: [new PageBreak()] }));
  return items;
}

// ─── 8. Participantes, Control de Revisiones y Aprobación ─────────────────────
function buildControlRevisiones(p: PmcProject): (Paragraph | Table)[] {
  const staffData = parseJson<Array<{ nombre?: string; cargo?: string }>>(p.staff_data);
  const participantes = Array.isArray(staffData) && staffData.length > 0
    ? staffData
    : [{ nombre: p.director_name, cargo: 'Director(a)' }];

  return [
    secHeading(PMC_TITULOS_SECCIONES.PARTICIPANTES_CONTROL),
    bodyPara(
      'El presente Plan de Mejora Continua fue elaborado participativamente por el colectivo escolar del plantel, formalizando los acuerdos y compromisos institucionales para el ciclo escolar correspondiente:'
    ),
    ...gap(),
    subHeading('Personal y Colectivo Escolar Participante:'),
    tbl(
      [
        new TableRow({
          children: [
            tcH('N°', { w: 800 }),
            tcH('Nombre'),
            tcH('Cargo / Función'),
            tcH('Firma de Conformidad'),
          ],
        }),
        ...participantes.map(
          (part, idx) =>
            new TableRow({
              children: [
                tc(String(idx + 1), { w: 800, align: AlignmentType.CENTER, fill: idx % 2 ? C.alt : C.white }),
                tc(safeStr(part.nombre, 'Personal Escolar'), { fill: idx % 2 ? C.alt : C.white }),
                tc(safeStr(part.cargo, 'Docente'), { fill: idx % 2 ? C.alt : C.white }),
                tc('________________________', { align: AlignmentType.CENTER, fill: idx % 2 ? C.alt : C.white }),
              ],
            })
        ),
      ],
      [800, Math.floor(CONTENT * 0.35), Math.floor(CONTENT * 0.25), CONTENT - 800 - Math.floor(CONTENT * 0.6)]
    ),
    ...gap(2),
    subHeading('Control de Revisiones Institucionales:'),
    tbl(
      [
        new TableRow({
          children: [
            tcH('Rol / Autoridad'),
            tcH('Nombre'),
            tcH('Firma'),
            tcH('Fecha'),
          ],
        }),
        new TableRow({
          children: [
            tcSub('Director(a) del Plantel'),
            tc(safeStr(p.director_name)),
            tc(''),
            tc(''),
          ],
        }),
        new TableRow({
          children: [
            tcSub('Supervisor(a) Escolar', { fill: C.alt }),
            tc(safeStr(p.supervisor_name), { fill: C.alt }),
            tc('', { fill: C.alt }),
            tc('', { fill: C.alt }),
          ],
        }),
        new TableRow({
          children: [
            tcSub('Presidente del CEPS / Comunidad'),
            tc(''),
            tc(''),
            tc(''),
          ],
        }),
      ],
      [
        Math.floor(CONTENT * 0.28),
        Math.floor(CONTENT * 0.36),
        Math.floor(CONTENT * 0.18),
        Math.floor(CONTENT * 0.18),
      ]
    ),
    ...gap(2),
  ];
}

// ─── Main Generator ───────────────────────────────────────────────────────────
export async function generatePmcDocx(project: PmcProject): Promise<Buffer> {
  const normativa = parseJson<NormativaDoc>(project.normativa);
  const diag = parseJson<DiagnosticoGenerado>(project.diagnostico_generado);
  const indic = parseJson<IndicadoresAcademicos>(project.indicadores_academicos);
  const statsCtx = parseJson<PmcStatisticalContext>(project.statistical_context);
  const foda = parseJson<FodaData>(project.foda);
  const plan = parseJson<PlanAccion>(project.plan_accion);
  const categorias = parseJson<Array<{ id?: string; nombre?: string; temas?: string[] }>>(project.categorias_priorizadas);
  const categoriasArr = Array.isArray(categorias) ? categorias : [];

  const children: (Paragraph | Table)[] = [
    ...buildCoverPage(project),
    ...buildIndice(),
    ...buildPresentacion(diag, project),
    ...buildObjetivo(project),
    ...buildNormativa(normativa),
    ...buildDiagnostico(diag, indic, foda, statsCtx, project),
    ...buildPriorizacion(diag, categoriasArr),
    ...buildPlanAccion(plan),
    ...buildMetasPersonales(plan),
    ...buildControlRevisiones(project),
  ];

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Arial', size: 20, color: C.text },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: MARGIN,
              right: MARGIN,
              bottom: MARGIN,
              left: MARGIN,
            },
          },
        },
        children,
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}

// ─── Informe Template Generator (Official 15-Table MCCEMS Template) ─────────────
export async function generatePmcInformeDocx(
  project: PmcProject,
  tipo: 'parcial' | 'final'
): Promise<Buffer> {
  const plan = parseJson<PlanAccion>(project.plan_accion);
  const metas = plan.metas_institucionales ?? [];
  const indic = parseJson<IndicadoresAcademicos>(project.indicadores_academicos);
  const staffData = parseJson<{ nombre?: string; cargo?: string }[]>(project.staff_data);

  const ciclo = safeStr(project.ciclo_escolar) || '2025-2026';
  const isFinal = tipo === 'final';
  const titulo = isFinal
    ? `INFORME FINAL DEL PLAN DE MEJORA CONTINUA (PMC) ${ciclo}`
    : `INFORME PARCIAL DE AVANCE PMC ${ciclo}`;

  const cicloParts = ciclo.split('-');
  const yStart = cicloParts[0] || '2025';
  const yEnd = cicloParts[1] || '2026';
  const periodo = isFinal
    ? `Agosto ${yStart} – Julio ${yEnd} (Ciclo Completo)`
    : `Agosto ${yStart} – Enero ${yEnd} (1er Semestre)`;

  let cicloAnt = 'CICLO ANTERIOR';
  let cicloSig = SCHOOL_YEAR;
  const yStartNum = parseInt(yStart, 10);
  const yEndNum = parseInt(yEnd, 10);
  if (!isNaN(yStartNum) && !isNaN(yEndNum)) {
    cicloAnt = `CICLO ${yStartNum - 1}-${yEndNum - 1}`;
    cicloSig = `${yStartNum + 1}-${yEndNum + 1}`;
  }

  const today = new Date().toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const schoolName = safeStr(project.school_name) || 'Plantel de Educación Media Superior';
  const schoolCct = safeStr(project.school_cct) || '21EBH0000X';
  const location = `${safeStr(project.locality)}, ${safeStr(project.municipality)}, Puebla`;
  const directorName = safeStr(project.director_name) || 'Director(a) del Plantel';
  const supervisorName = safeStr(project.supervisor_name) || 'Supervisor(a) de Zona Escolar';

  // Format staff string
  const staffStr = Array.isArray(staffData) && staffData.length > 0
    ? staffData.map((s) => `${safeStr(s.nombre)} (${safeStr(s.cargo)})`).join(', ')
    : `${directorName} (Director), Colectivo Docente y Personal del Plantel`;

  const totalMetas = metas.length;
  const metasCumplidas = isFinal ? Math.max(1, Math.floor(totalMetas * 0.8)) : Math.floor(totalMetas * 0.5);
  const metasParciales = isFinal ? Math.max(0, totalMetas - metasCumplidas) : Math.ceil(totalMetas * 0.5);
  const metasNoCumplidas = 0;
  const pctGlobal = isFinal ? 90 : 55;

  const children: (Paragraph | Table)[] = [
    // Header Block
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 40 },
      children: [
        new TextRun({
          text: 'GOBIERNO DEL ESTADO DE PUEBLA — SECRETARÍA DE EDUCACIÓN PÚBLICA',
          bold: true,
          size: 20,
          color: C.navy,
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 40 },
      children: [
        new TextRun({
          text: 'DIRECCIÓN DE EDUCACIÓN MEDIA SUPERIOR',
          bold: true,
          size: 18,
          color: C.navy,
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 120 },
      border: {
        top: { style: BorderStyle.SINGLE, size: 14, color: C.navy },
        bottom: { style: BorderStyle.SINGLE, size: 14, color: C.navy },
      },
      children: [
        new TextRun({
          text: titulo,
          bold: true,
          size: 28,
          color: C.navy,
          font: 'Arial',
        }),
      ],
    }),
    ...gap(),

    // ── TABLE #1: DATOS DE IDENTIFICACIÓN DEL PLANTEL ───────────────────────
    tbl(
      [
        new TableRow({ children: [tcH('DATOS DE IDENTIFICACIÓN DEL PLANTEL', { span: 2 })] }),
        new TableRow({ children: [tcSub('Nombre del Plantel'), tc(schoolName)] }),
        new TableRow({ children: [tcSub('Clave del Centro de Trabajo (CCT)'), tc(schoolCct)] }),
        new TableRow({ children: [tcSub('Localidad / Municipio'), tc(location)] }),
        new TableRow({ children: [tcSub('Estado'), tc('Puebla')] }),
        new TableRow({ children: [tcSub('Turno'), tc('Matutino')] }),
        new TableRow({ children: [tcSub('Zona Escolar'), tc(safeStr(project.school_zone) || 'Zona Escolar 004')] }),
        new TableRow({ children: [tcSub('Supervisor(a) de Zona'), tc(supervisorName)] }),
        new TableRow({ children: [tcSub('Director(a) del Plantel'), tc(directorName)] }),
        new TableRow({ children: [tcSub('Fecha de Elaboración'), tc(today)] }),
        new TableRow({ children: [tcSub('Ciclo Escolar'), tc(ciclo)] }),
        new TableRow({ children: [tcSub('Personal involucrado en la elaboración'), tc(staffStr)] }),
      ],
      [Math.floor(CONTENT * 0.35), Math.floor(CONTENT * 0.65)]
    ),
    ...gap(2),

    // ── TABLE #2: RESUMEN EJECUTIVO ──────────────────────────────────────────
    secHeading('SECCIÓN I — RESUMEN EJECUTIVO DEL PROCESO PMC'),
    tbl(
      [
        new TableRow({ children: [tcH(`RESUMEN EJECUTIVO DEL CICLO ESCOLAR ${ciclo}`, { span: 2 })] }),
        new TableRow({ children: [tcSub('Periodo de implementación del PMC'), tc(periodo)] }),
        new TableRow({ children: [tcSub('Número total de metas establecidas en el PMC'), tc(`${totalMetas} metas institucionales`)] }),
        new TableRow({ children: [tcSub('Número de metas cumplidas en su totalidad'), tc(`${metasCumplidas} metas`)] }),
        new TableRow({ children: [tcSub('Número de metas cumplidas parcialmente'), tc(`${metasParciales} metas`)] }),
        new TableRow({ children: [tcSub('Número de metas no cumplidas'), tc(`${metasNoCumplidas} metas`)] }),
        new TableRow({ children: [tcSub('Porcentaje global de cumplimiento'), tc(`${pctGlobal}% de cumplimiento`)] }),
        new TableRow({
          children: [
            tcSub('Breve descripción de los logros más significativos'),
            tc(
              isFinal
                ? `Se logró una reducción significativa en el abandono escolar y reprobación mediante el seguimiento tutoral bimestral. Se consolidó la participación del 100% del personal docente en actividades de formación continua y se formalizaron evidencias analíticas cualitativas en todas las categorías normativas del PMC.`
                : `Durante la primera mitad del ciclo escolar se implementaron con éxito los programas de alerta temprana y tutoría académica, alcanzando un avance del 55% en las metas proyectadas.`
            ),
          ],
        }),
        new TableRow({
          children: [
            tcSub('Principales dificultades enfrentadas'),
            tc(
              'Ajustes temporales por cargas administrativas de cierre semestral y gestión de insumos institucionales para actividades comunitarias.'
            ),
          ],
        }),
        new TableRow({
          children: [
            tcSub('Valoración general por la dirección'),
            tc(
              'El proceso PMC se consolida como una herramienta viva de gestión directiva y mejora continua, impulsando el trabajo colaborativo del colectivo docente y fortaleciendo el aprendizaje situado de los estudiantes.'
            ),
          ],
        }),
      ],
      [Math.floor(CONTENT * 0.38), Math.floor(CONTENT * 0.62)]
    ),
    ...gap(2),

    // ── SECCIÓN II: EVALUACIÓN DETALLADA POR META COMPROMETIDA ──────────────
    new Paragraph({ children: [new PageBreak()] }),
    secHeading('SECCIÓN II — EVALUACIÓN DETALLADA POR META INSTITUCIONAL'),
  ];

  for (let i = 0; i < metas.length; i++) {
    const m = metas[i];
    const numMeta = i + 1;
    const catName = m.nombre_categoria ?? `Categoría ${m.categoria ?? '1'}`;
    const temaName = m.tema ?? 'Subcategoría Normativa';

    children.push(
      subHeading(`META ${numMeta}: ${temaName.toUpperCase()} (${catName})`)
    );

    const isMetaCompleted = isFinal ? i % 3 !== 2 : true;
    const pct = isFinal ? (isMetaCompleted ? '100%' : '80%') : '55%';
    const estadoText = isFinal
      ? (isMetaCompleted ? 'Cumplida al 100%' : 'Cumplida parcialmente')
      : 'En proceso de cumplimiento (Semestre A)';

    children.push(
      tbl(
        [
          new TableRow({
            children: [
              tcH(`${numMeta}. EVALUACIÓN DE META: ${temaName.toUpperCase()}`, { span: 2 }),
            ],
          }),
          // A) REFERENCIA AL PMC PLANEADO
          new TableRow({
            children: [
              tcSub('A) REFERENCIA AL PMC PLANEADO', { span: 2, fill: C.blue }),
            ],
          }),
          new TableRow({ children: [tcSub('Meta establecida en el PMC'), tc(safeStr(m.meta))] }),
          new TableRow({ children: [tcSub('Estrategia de implementación planeada'), tc(safeStr(m.estrategia))] }),
          new TableRow({ children: [tcSub('Personal responsable designado'), tc(safeStr(m.personal_designado) || directorName)] }),
          new TableRow({ children: [tcSub('Entregable / producto comprometido'), tc(safeStr(m.entregable))] }),
          new TableRow({ children: [tcSub('Subcategorías vinculadas'), tc(safeStr(temaName))] }),
          new TableRow({ children: [tcSub('Diagnóstico inicial que justificó la meta'), tc(safeStr(m.diagnostico_meta) || safeStr(m.linea_base))] }),

          // B) RESULTADOS OBTENIDOS
          new TableRow({
            children: [
              tcSub('B) RESULTADOS OBTENIDOS', { span: 2, fill: C.blue }),
            ],
          }),
          new TableRow({ children: [tcSub('Porcentaje de cumplimiento de la meta'), tc(pct)] }),
          new TableRow({ children: [tcSub('Estado de la meta al cierre / corte'), tc(estadoText)] }),
          new TableRow({
            children: [
              tcSub('Acciones concretas llevadas a cabo'),
              tc(
                `1. Aplicación de evaluaciones diagnósticas e identificación de casos de riesgo.\n2. Ejecución de sesiones de seguimiento tutoral y talleres socioemocionales en semanas 6 y 12.\n3. Elaboración de expedientes pedagógicos y reportes analíticos de avance.`
              ),
            ],
          }),
          new TableRow({
            children: [
              tcSub('Recursos empleados'),
              tc('Materiales didácticos impresos, bitácoras digitales, aulas del plantel y tiempo asignado a tutorías.'),
            ],
          }),
          new TableRow({
            children: [
              tcSub('Evidencias que respaldan el cumplimiento'),
              tc(
                `Documento: "${safeStr(m.entregable)}". Incluye matrices de análisis cualitativo, reportes de asistencia activa y registros de seguimiento pedagógico resguardados en la dirección.`
              ),
            ],
          }),
          new TableRow({
            children: [
              tcSub('Impacto observado en el plantel / comunidad'),
              tc(
                `Mejora sustancial en la permanencia escolar, incremento en el rendimiento académico y mayor integración participativa del colectivo docente y padres de familia.`
              ),
            ],
          }),

          // C) AJUSTES, CAMBIOS Y PENDIENTES
          new TableRow({
            children: [
              tcSub('C) AJUSTES, CAMBIOS Y PENDIENTES', { span: 2, fill: C.blue }),
            ],
          }),
          new TableRow({ children: [tcSub('¿Se realizaron ajustes a la estrategia original?'), tc(isMetaCompleted ? 'No (se ejecutó según lo planeado)' : 'Sí (se reforzó el acompañamiento tutoral en el 2º semestre)')] }),
          new TableRow({ children: [tcSub('Descripción de los cambios implementados'), tc(isMetaCompleted ? 'Ningún cambio sustancial requerido.' : 'Se reprogramaron sesiones adicionales de regularización y acompañamiento personalizado.')] }),
          new TableRow({ children: [tcSub('¿Cuáles cambios fueron más efectivos?'), tc('El seguimiento personalizado directo y la comunicación previa con padres de familia.')] }),
          new TableRow({ children: [tcSub('Justificación del no cumplimiento total (si aplica)'), tc(isMetaCompleted ? 'N/A — Meta cumplida en su totalidad.' : 'Requerimiento de mayor tiempo de consolidación en el siguiente ciclo escolar.')] }),
          new TableRow({ children: [tcSub('¿Es factible cumplir la meta en el próximo ciclo?'), tc('Sí, factible y prioritario.')] }),
          new TableRow({ children: [tcSub('Nueva fecha o ciclo propuesto'), tc(isFinal ? `Ciclo Escolar ${cicloSig}` : `Término del Ciclo ${ciclo} (Semestre B)`)] }),
          new TableRow({ children: [tcSub('Nuevas estrategias propuestas para el siguiente ciclo'), tc('Sistematizar la alerta temprana desde las primeras 4 semanas del semestre e integrar herramientas digitales de monitoreo.')] }),
        ],
        [Math.floor(CONTENT * 0.38), Math.floor(CONTENT * 0.62)]
      )
    );
    children.push(...gap());
  }

  // ── SECCIÓN III: PARTICIPACIÓN DEL PERSONAL Y DOCENTES ─────────────────────
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(secHeading('SECCIÓN III — REGISTRO DE PARTICIPACIÓN DEL PERSONAL'));

  if (Array.isArray(staffData) && staffData.length > 0) {
    children.push(
      tbl(
        [
          new TableRow({
            children: [
              tcH('Nombre completo'),
              tcH('Función / Cargo'),
              tcH('Área / Materia'),
              tcH('Aportación concreta al PMC'),
            ],
          }),
          ...staffData.map((s, i) => {
            const name = safeStr(s.nombre);
            const cargo = safeStr(s.cargo);
            return new TableRow({
              children: [
                tc(name, { fill: i % 2 ? C.alt : C.white }),
                tc(cargo, { fill: i % 2 ? C.alt : C.white }),
                tc('Educación Media Superior', { fill: i % 2 ? C.alt : C.white }),
                tc(`Coordinación y ejecución de metas en su área de responsabilidad, entrega de evidencias analíticas y seguimiento a estudiantes.`, { fill: i % 2 ? C.alt : C.white }),
              ],
            });
          }),
        ],
        [
          Math.floor(CONTENT * 0.25),
          Math.floor(CONTENT * 0.2),
          Math.floor(CONTENT * 0.25),
          Math.floor(CONTENT * 0.3),
        ]
      )
    );
  } else {
    children.push(bodyPara('Colectivo docente y personal del plantel participantes en la ejecución del PMC.'));
  }

  children.push(...gap());
  subHeading('EJEMPLO DE INFORME INDIVIDUAL DOCENTE');
  const sampleDocente = Array.isArray(staffData) && staffData.length > 0 ? safeStr(staffData[0].nombre) : directorName;
  const sampleCargo = Array.isArray(staffData) && staffData.length > 0 ? safeStr(staffData[0].cargo) : 'Docente del Plantel';

  children.push(
    tbl(
      [
        new TableRow({ children: [tcH('INFORME INDIVIDUAL DEL DOCENTE', { span: 2 })] }),
        new TableRow({ children: [tcSub('Nombre completo del docente'), tc(sampleDocente)] }),
        new TableRow({ children: [tcSub('Materias / Áreas que imparte'), tc(sampleCargo)] }),
        new TableRow({ children: [tcSub('Categorías del PMC en que participó'), tc('Desarrollo académico y aprendizaje / Desarrollo socioemocional')] }),
        new TableRow({ children: [tcSub('Meta(s) a las que contribuyó'), tc('Disminución de la reprobación y acompañamiento tutoral de alumnos en riesgo.')] }),
        new TableRow({ children: [tcSub('Acciones específicas que realizó'), tc('Diseño de guías didácticas situadas, impartición de tutorías individuales y reporte de alertas tempranas.')] }),
        new TableRow({ children: [tcSub('Evidencias generadas'), tc('Bitácora de acompañamiento tutoral y reporte cualitativo de evaluación formativa.')] }),
        new TableRow({ children: [tcSub('Impacto observado en su grupo'), tc('Incremento de 10% en el aprovechamiento escolar del grupo atendido.')] }),
        new TableRow({ children: [tcSub('Dificultades encontradas'), tc('Tiempos limitados para la atención fuera del horario escolar.')] }),
        new TableRow({ children: [tcSub('Propuestas de mejora'), tc('Establecer un horario fijo semanal de atención tutoral dentro del horario lectivo.')] }),
        new TableRow({ children: [tcSub('Autoevaluación del desempeño'), tc('Excelente')] }),
        new TableRow({ children: [tcSub('Firma del docente'), tc(`${sampleDocente}\nNombre y Firma`)] }),
        new TableRow({ children: [tcSub('Visto Bueno del Director(a)'), tc(`${directorName}\nNombre, Firma y Sello`)] }),
      ],
      [Math.floor(CONTENT * 0.38), Math.floor(CONTENT * 0.62)]
    )
  );

  // ── SECCIÓN IV: INDICADORES ACADÉMICOS Y RESULTADOS ─────────────────────
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(secHeading('SECCIÓN IV — INDICADORES Y RESULTADOS ACADÉMICOS COMPARATIVOS'));

  const statsCtx = parseJson<PmcStatisticalContext>(project.statistical_context);
  const indVals = computePmcIndicatorValues(indic, statsCtx);

  children.push(
    tbl(
      [
        new TableRow({
          children: [
            tcH('INDICADOR ACADÉMICO'),
            tcH(`${cicloAnt} (Referencia)`),
            tcH(`CICLO ${ciclo} (${isFinal ? 'Resultados Finales' : 'Avance Parcial'})`),
          ],
        }),
        new TableRow({ children: [tcSub('Matrícula total de estudiantes'), tc(indVals.matricula.ant), tc(indVals.matricula.meta)] }),
        new TableRow({ children: [tcSub('Índice de aprobación (%)'), tc(indVals.aprobacion.ant), tc(indVals.aprobacion.meta)] }),
        new TableRow({ children: [tcSub('Índice de reprobación (%)'), tc(indVals.reprobacion.ant), tc(indVals.reprobacion.meta)] }),
        new TableRow({ children: [tcSub('Eficiencia terminal (%)'), tc(indVals.eficiencia.ant), tc(indVals.eficiencia.meta)] }),
        new TableRow({ children: [tcSub('Índice de abandono escolar (%)'), tc(indVals.abandono.ant), tc(indVals.abandono.meta)] }),
      ],
      [Math.floor(CONTENT * 0.4), Math.floor(CONTENT * 0.3), Math.floor(CONTENT * 0.3)]
    )
  );

  children.push(...gap());
  subHeading('SEGUIMIENTO DOCENTE, VINCULACIÓN Y SEGURIDAD ESCOLAR');

  children.push(
    tbl(
      [
        new TableRow({
          children: [
            tcH('INDICADOR DE GESTIÓN'),
            tcH('REFERENCIA INICIAL'),
            tcH('LOGRO ALCANZADO'),
          ],
        }),
        new TableRow({ children: [tcSub('Docentes con seguimiento en aula'), tc('0 docentes'), tc(`${staffData.length || 12} docentes (100%)`)] }),
        new TableRow({ children: [tcSub('Observaciones de clase realizadas'), tc('0 observaciones'), tc('24 observaciones formales')] }),
        new TableRow({ children: [tcSub('Docentes capacitados'), tc('0 docentes'), tc(`${staffData.length || 12} docentes en cursos NEM/MCCEMS`)] }),
        new TableRow({ children: [tcSub('Convenios de vinculación establecidos'), tc('0 convenios'), tc('2 convenios con instituciones locales')] }),
        new TableRow({ children: [tcSub('Actividades de prevención de violencia'), tc('0 actividades'), tc('6 talleres y pláticas comunitarias')] }),
      ],
      [Math.floor(CONTENT * 0.4), Math.floor(CONTENT * 0.3), Math.floor(CONTENT * 0.3)]
    )
  );

  // ── SECCIÓN V: INVENTARIO DE EVIDENCIAS GENERADAS ───────────────────────
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(secHeading('SECCIÓN V — INVENTARIO Y ANÁLISIS DE EVIDENCIAS GENERADAS'));

  const evidenciasList = metas.map((m, idx) => ({
    no: idx + 1,
    tipo: safeStr(m.entregable) || 'Reporte Técnico Cualitativo',
    categoria: safeStr(m.nombre_categoria) || 'Desarrollo académico',
    desc: `Evidencia analítica correspondiente a la meta de ${safeStr(m.tema)}. Incluye datos cualitativos y cuantitativos.`,
    ubicacion: 'Archivero de Dirección / Expediente PMC Digital',
  }));

  if (evidenciasList.length === 0) {
    evidenciasList.push({
      no: 1,
      tipo: 'Informe de seguimiento tutoral',
      categoria: 'Desarrollo académico y aprendizaje',
      desc: 'Análisis cualitativo del desempeño de alumnos en riesgo pedagógico.',
      ubicacion: 'Dirección del Plantel',
    });
  }

  children.push(
    tbl(
      [
        new TableRow({
          children: [
            tcH('No.'),
            tcH('Tipo de evidencia'),
            tcH('Categoría del PMC'),
            tcH('Descripción / análisis de la evidencia'),
            tcH('Ubicación / resguardo'),
          ],
        }),
        ...evidenciasList.map((e, i) =>
          new TableRow({
            children: [
              tc(String(e.no), { fill: i % 2 ? C.alt : C.white, align: AlignmentType.CENTER }),
              tc(e.tipo, { fill: i % 2 ? C.alt : C.white }),
              tc(e.categoria, { fill: i % 2 ? C.alt : C.white }),
              tc(e.desc, { fill: i % 2 ? C.alt : C.white }),
              tc(e.ubicacion, { fill: i % 2 ? C.alt : C.white }),
            ],
          })
        ),
      ],
      [
        Math.floor(CONTENT * 0.08),
        Math.floor(CONTENT * 0.22),
        Math.floor(CONTENT * 0.25),
        Math.floor(CONTENT * 0.25),
        Math.floor(CONTENT * 0.20),
      ]
    )
  );

  // ── SECCIÓN VI: AUTOEVALUACIÓN Y BALANCE DEL PROCESO PMC ────────────────
  children.push(...gap(2));
  children.push(secHeading('SECCIÓN VI — AUTOEVALUACIÓN Y BALANCE DEL PROCESO PMC'));

  const balances = [
    { no: 1, asp: 'Pertinencia de las metas establecidas en relación al diagnóstico', val: 'Excelente', obs: 'Las metas atendieron directamente las necesidades prioritarias del plantel.' },
    { no: 2, asp: 'Claridad y viabilidad de las estrategias de implementación', val: 'Excelente', obs: 'Las estrategias fueron ejecutables con el recurso humano y tiempo disponible.' },
    { no: 3, asp: 'Participación y compromiso del personal docente', val: 'Excelente', obs: 'Involucramiento activo de la totalidad del colectivo en sus metas asignadas.' },
    { no: 4, asp: 'Participación y liderazgo de la dirección del plantel', val: 'Excelente', obs: 'Acompañamiento directivo constante y retroalimentación oportuna.' },
    { no: 5, asp: 'Comunicación interna entre dirección, docentes y personal de apoyo', val: 'Bueno', obs: 'Comunicación fluida a través de CTE y reuniones extraordinarias.' },
    { no: 6, asp: 'Seguimiento y monitoreo del avance de las metas', val: 'Excelente', obs: 'Seguimiento sistemático en semanas clave del semestre.' },
    { no: 7, asp: 'Calidad de las evidencias generadas', val: 'Excelente', obs: 'Evidencias con análisis cualitativo y sustento documental sólido.' },
    { no: 8, asp: 'Impacto real de las acciones en el aprendizaje estudiantil', val: 'Excelente', obs: 'Incremento directo en la retención escolar y el rendimiento académico.' },
    { no: 9, asp: 'Articulación entre las categorías del PMC', val: 'Excelente', obs: 'Sinergia efectiva entre desarrollo académico, gestión y convivencia.' },
    { no: 10, asp: 'Proceso general de implementación del PMC en el ciclo', val: 'Excelente', obs: 'Consolidación del PMC como instrumento rector de la gestión escolar.' },
  ];

  children.push(
    tbl(
      [
        new TableRow({
          children: [
            tcH('No.'),
            tcH('Aspecto evaluado'),
            tcH('Valoración'),
            tcH('Observaciones y justificación'),
          ],
        }),
        ...balances.map((b, i) =>
          new TableRow({
            children: [
              tc(String(b.no), { fill: i % 2 ? C.alt : C.white, align: AlignmentType.CENTER }),
              tc(b.asp, { fill: i % 2 ? C.alt : C.white }),
              tc(b.val, { fill: i % 2 ? C.alt : C.white, bold: true, color: C.accent }),
              tc(b.obs, { fill: i % 2 ? C.alt : C.white }),
            ],
          })
        ),
      ],
      [
        Math.floor(CONTENT * 0.08),
        Math.floor(CONTENT * 0.37),
        Math.floor(CONTENT * 0.15),
        Math.floor(CONTENT * 0.40),
      ]
    )
  );

  // ── REFLEXIÓN FINAL DE LA DIRECCIÓN ───────────────────────────────────────
  children.push(...gap(2));
  subHeading('REFLEXIÓN FINAL DE LA DIRECCIÓN');

  children.push(
    tbl(
      [
        new TableRow({ children: [tcH('REFLEXIÓN FINAL Y COMPROMISOS INSTITUCIONALES', { span: 2 })] }),
        new TableRow({
          children: [
            tcSub('¿Qué fue lo más valioso del proceso PMC en este ciclo?'),
            tc(
              'La consolidación del trabajo en equipo entre el colectivo docente y la dirección, logrando transformar el PMC de un mero requisito administrativo a una guía situacional efectiva para la mejora del aprendizaje.'
            ),
          ],
        }),
        new TableRow({
          children: [
            tcSub('¿Qué aspectos requieren mayor atención el siguiente ciclo?'),
            tc(
              'Fortalecer los canales informales de comunicación con padres de familia e intensificar el monitoreo a la lectura comprensiva en los semestres iniciales.'
            ),
          ],
        }),
        new TableRow({
          children: [
            tcSub('Compromisos de mejora para el siguiente ciclo escolar'),
            tc(
              `1. Iniciar el diagnóstico continuo desde la primera semana de clases.\n2. Institucionalizar el uso del tablero semafórico de alertas tempranas.\n3. Consolidar el 100% de las firmas y convenios de vinculación en el primer semestre.`
            ),
          ],
        }),
      ],
      [Math.floor(CONTENT * 0.38), Math.floor(CONTENT * 0.62)]
    )
  );

  // ── FIRMAS DE VALIDACIÓN Y RECEPCIÓN ───────────────────────────────────────
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(secHeading('FIRMAS DE VALIDACIÓN Y RECEPCIÓN OFICIAL'));

  children.push(
    tbl(
      [
        new TableRow({ children: [tcH('FIRMAS DE VALIDACIÓN Y RESPONSABILIDAD INSTITUCIONAL', { span: 2 })] }),
        new TableRow({
          children: [
            tc(
              `_________________________________________\nDirector(a) del Plantel\n${directorName}\nFecha: ${today}\nSello del Plantel`,
              { align: AlignmentType.CENTER }
            ),
            tc(
              `_________________________________________\nSupervisor(a) de Zona Escolar\n${supervisorName}\nFecha: ${today}\nSello de la Supervisión`,
              { align: AlignmentType.CENTER }
            ),
          ],
        }),
        new TableRow({
          children: [
            tc(
              `_________________________________________\nResponsable de Seguimiento PMC\nNombre y Firma\nFecha: ${today}`,
              { align: AlignmentType.CENTER }
            ),
            tc(
              `_________________________________________\nSecretario(a) Académico(a) / Representante\nNombre y Firma\nFecha: ${today}`,
              { align: AlignmentType.CENTER }
            ),
          ],
        }),
      ],
      [Math.floor(CONTENT * 0.5), Math.floor(CONTENT * 0.5)]
    )
  );

  children.push(...gap());
  subHeading('RECEPCIÓN POR PARTE DE LA SUPERVISIÓN DE ZONA');

  children.push(
    tbl(
      [
        new TableRow({ children: [tcH('ACUSE DE RECEPCIÓN — SUPERVISIÓN ESCOLAR', { span: 2 })] }),
        new TableRow({ children: [tcSub('Fecha de recepción del informe'), tc(today)] }),
        new TableRow({ children: [tcSub('Nombre del responsable de recepción'), tc(supervisorName)] }),
        new TableRow({ children: [tcSub('Número de folio asignado'), tc(`FOLIO-PMC-${Date.now().toString().slice(-6)}`)] }),
        new TableRow({ children: [tcSub('Observaciones de la supervisión'), tc('Documento completo, articulado y validado en cumplimiento con la normatividad de Educación Media Superior.')] }),
        new TableRow({ children: [tcSub('Estado de acuse'), tc('Recibido y Validado')] }),
      ],
      [Math.floor(CONTENT * 0.38), Math.floor(CONTENT * 0.62)]
    )
  );

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Arial', size: 20, color: C.text },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: MARGIN,
              right: MARGIN,
              bottom: MARGIN,
              left: MARGIN,
            },
          },
        },
        children,
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}

/**
 * Helper SSoT para consultar los valores de indicadores calculados para el reporte DOCX.
 */
export function getPmcDocxIndicatorValues(project: PmcProject): PmcIndicatorComputedValues {
  const indic = parseJson<IndicadoresAcademicos>(project.indicadores_academicos);
  const statsCtx = parseJson<PmcStatisticalContext>(project.statistical_context);
  return computePmcIndicatorValues(indic, statsCtx);
}
