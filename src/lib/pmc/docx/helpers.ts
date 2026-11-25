import {
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  BorderStyle,
  WidthType,
  ShadingType,
  HeadingLevel,
} from 'docx';
import type { PmcStatisticalContext } from '@/lib/pmc-indicator-calculator';

// ─── Color Palette ───────────────────────────────────────────────────────────
export const C = {
  navy:   '1A3A5C',
  blue:   'DCE4F5',
  white:  'FFFFFF',
  alt:    'EBF3FA',
  gray:   'F5F5F5',
  accent: '2E6DA4',
  text:   '1A1A1A',
  muted:  '555555',
};

export const PAGE_W = 12240;
export const MARGIN = 720;
export const CONTENT = PAGE_W - MARGIN * 2;

// ─── Helpers ─────────────────────────────────────────────────────────────────
export function bdr(color = 'AAAAAA') {
  const b = { style: BorderStyle.SINGLE, size: 4, color };
  return { top: b, bottom: b, left: b, right: b };
}

export const CELLMRG = { top: 80, bottom: 80, left: 140, right: 140 };

export function tc(
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

  const rawLines = (text || '').split('\n').filter((l) => l.trim().length > 0);
  const children = rawLines.length > 0
    ? rawLines.map((line) =>
        new Paragraph({
          alignment: align,
          spacing: { before: 25, after: 25 },
          children: [new TextRun({ text: line, bold, italics, size, color, font: 'Arial' })],
        })
      )
    : [
        new Paragraph({
          alignment: align,
          spacing: { before: 40, after: 40 },
          children: [new TextRun({ text: '', bold, italics, size, color, font: 'Arial' })],
        }),
      ];

  return new TableCell({
    columnSpan: span,
    width: w ? { size: w, type: WidthType.DXA } : undefined,
    shading: { fill, type: ShadingType.CLEAR },
    borders: bdr(),
    margins: CELLMRG,
    verticalAlign: valign,
    children,
  });
}

export function tcH(text: string, opts: Parameters<typeof tc>[1] = {}) {
  return tc(text, { bold: true, fill: C.navy, color: C.white, size: 18, ...opts });
}

export function tcSub(text: string, opts: Parameters<typeof tc>[1] = {}) {
  return tc(text, { bold: true, fill: C.blue, color: C.navy, size: 18, ...opts });
}

export function tbl(rows: TableRow[], widths: number[]): Table {
  return new Table({
    width: { size: CONTENT, type: WidthType.DXA },
    columnWidths: widths,
    rows,
  });
}

export function secHeading(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 160 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: C.navy, space: 1 } },
    children: [new TextRun({ text, bold: true, size: 28, color: C.navy, font: 'Arial' })],
  });
}

export function subHeading(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 100 },
    children: [new TextRun({ text, bold: true, size: 22, color: C.accent, font: 'Arial' })],
  });
}

export function bodyPara(text: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { before: 80, after: 80 },
    children: [new TextRun({ text: text ?? '', size: 20, color: C.text, font: 'Arial' })],
  });
}

export function gap(n = 1): Paragraph[] {
  return Array.from({ length: n }, () => new Paragraph({ children: [] }));
}

export function safeStr(val: unknown, fallback = ''): string {
  if (val === null || val === undefined || val === '') return fallback;
  return String(val);
}

export function parseJson<T = unknown>(val: unknown): T {
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

export interface MetaInstitucional {
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
  accion_especifica?: string;
  finalidad?: string;
  necesidad?: string;
  proceso_evaluacion?: string;
  subcategorias_vinculadas?: string[];
  estrategias_seguimiento?: string;
  observaciones?: string;
}

export interface MetaPersonal {
  nombre?: string;
  cargo?: string;
  categoria?: string;
  tema?: string;
  meta_individual?: string;
  estrategia?: string;
  entregable?: string;
  periodo?: string;
}

export interface PlanAccion {
  metas_institucionales?: MetaInstitucional[];
  metas_personales?: MetaPersonal[];
}

export interface DiagnosticoGenerado {
  presentacion?: string;
  contexto?: string;
  analisis_indicadores?: string;
  sintesis_foda?: string;
  priorizacion?: string;
}

export interface IndicadoresAcademicos {
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

export interface FodaData {
  fortalezas?: string;
  oportunidades?: string;
  debilidades?: string;
  amenazas?: string;
}

export interface NormativaDoc {
  titulo?: string;
  descripcion?: string;
  documentos?: Array<{
    orden?: number;
    titulo?: string;
    articulos?: string[];
  }>;
}

