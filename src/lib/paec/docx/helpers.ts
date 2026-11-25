/* eslint-disable @typescript-eslint/no-explicit-any */
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
} from 'docx';
import { bdr } from '@/lib/docx-helpers';
import type { PaecProject, SchoolContext, CommunityContext } from '@/types/paec';

// Paleta Institucional Oficial MCCEMS / SEP Puebla
export const C = {
  dark:        '1F3864', // Azul Marino Institucional MCCEMS
  mid:         '2E74B5', // Azul Medio Secundario
  light:       'DCE4F5', // Azul Suave para Encabezados Secundarios
  alt:         'F8FAFC', // Fondo gris claro para filas alternadas
  accent:      'E8A020', // Dorado / Ámbar Oficial SEP
  accentLight: 'FEF3C7', // Ámbar muy suave para llamado de atención Semana 16
  white:       'FFFFFF',
  text:        '1E293B', // Slate Oscuro para texto de lectura
  textMuted:   '64748B', // Gris para notas y metadatos
  border:      'CBD5E1', // Borde sutil estándar
  borderDark:  '94A3B8', // Borde reforzado
  greenBg:     'ECFDF5', // Cumple
  yellowBg:    'FFFBEB', // Regular
  redBg:       'FEF2F2', // Deficiente
};

// Medidas en Twips (DXA): 1 pulgada = 1440 DXA, 1 cm = 567 DXA
export const PORTRAIT_W = 12240; // 8.5"
export const PORTRAIT_H = 15840; // 11.0"
export const LANDSCAPE_W = 15840; // 11.0"
export const LANDSCAPE_H = 12240; // 8.5"
export const MARGIN = 720;   // 0.5" (márgenes editoriales limpios)

export const CONTENT_PORTRAIT = PORTRAIT_W - MARGIN * 2;  // 10,800 DXA
export const CONTENT_LANDSCAPE = LANDSCAPE_W - MARGIN * 2; // 14,400 DXA

export function safeStr(val: unknown, fallback = 'Sin información registrada'): string {
  if (val === null || val === undefined) return fallback;
  const str = String(val).trim();
  return str.length > 0 ? str : fallback;
}

export interface ParsedFoda {
  fortalezas: string[];
  oportunidades: string[];
  debilidades: string[];
  amenazas: string[];
  estFO: string;
  estDO: string;
  estFA: string;
  estDA: string;
}

/**
 * Normaliza y extrae datos FODA de cualquier estructura (arrays con/sin etiquetas semánticas, objetos planos o posicionales).
 * Garantiza resiliencia total y fallbacks normativos oficiales MCCEMS / SEP Puebla.
 */
export function parseFodaData(rawT3: any): ParsedFoda {
  let fortalezas: string[] = [];
  let oportunidades: string[] = [];
  let debilidades: string[] = [];
  let amenazas: string[] = [];
  let estFO = '';
  let estDO = '';
  let estFA = '';
  let estDA = '';

  const norm = (s: string) =>
    String(s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

  if (Array.isArray(rawT3)) {
    let matchedAny = false;
    rawT3.forEach((r: any) => {
      const asp = norm(r.aspect || r.aspecto || r.categoria || r.category || r.tipo || r.eje || r.col1 || '');
      const txt = safeStr(r.analysis || r.analisis || r.descripcion || r.description || r.col2 || r.texto || r.contenido || (typeof r === 'string' ? r : ''));

      if (asp.includes('fortalez') || asp.includes('strength') || asp === 'f') {
        fortalezas.push(txt);
        matchedAny = true;
      } else if (asp.includes('oportun') || asp.includes('opportun') || asp === 'o') {
        oportunidades.push(txt);
        matchedAny = true;
      } else if (asp.includes('debilid') || asp.includes('weak') || asp === 'd') {
        debilidades.push(txt);
        matchedAny = true;
      } else if (asp.includes('amenaz') || asp.includes('threat') || asp === 'a') {
        amenazas.push(txt);
        matchedAny = true;
      } else if (asp.includes('fo') || asp.includes('maxi-maxi') || asp.includes('f-o')) {
        estFO = txt;
        matchedAny = true;
      } else if (asp.includes('do') || asp.includes('mini-maxi') || asp.includes('d-o')) {
        estDO = txt;
        matchedAny = true;
      } else if (asp.includes('fa') || asp.includes('maxi-mini') || asp.includes('f-a')) {
        estFA = txt;
        matchedAny = true;
      } else if (asp.includes('da') || asp.includes('mini-mini') || asp.includes('d-a')) {
        estDA = txt;
        matchedAny = true;
      }
    });

    // Fallback posicional si no coincidió ninguna etiqueta semántica
    if (!matchedAny && rawT3.length >= 4) {
      const getTxt = (item: any) => safeStr(item?.analysis || item?.analisis || item?.col2 || item?.col1 || (typeof item === 'string' ? item : ''));
      if (rawT3[0]) fortalezas.push(getTxt(rawT3[0]));
      if (rawT3[1]) oportunidades.push(getTxt(rawT3[1]));
      if (rawT3[2]) debilidades.push(getTxt(rawT3[2]));
      if (rawT3[3]) amenazas.push(getTxt(rawT3[3]));
      if (rawT3.length >= 8) {
        if (rawT3[4]) estFO = getTxt(rawT3[4]);
        if (rawT3[5]) estDO = getTxt(rawT3[5]);
        if (rawT3[6]) estFA = getTxt(rawT3[6]);
        if (rawT3[7]) estDA = getTxt(rawT3[7]);
      }
    }
  } else if (rawT3 && typeof rawT3 === 'object') {
    const extractArray = (keys: string[]) => {
      for (const k of keys) {
        if (Array.isArray(rawT3[k])) {
          return rawT3[k].map((x: any) => safeStr(typeof x === 'string' ? x : x?.analisis || x?.analysis || x?.texto || x?.col2));
        }
      }
      return [];
    };

    fortalezas = extractArray(['fortalezas', 'strengths', 'F', 'fortaleza']);
    oportunidades = extractArray(['oportunidades', 'opportunities', 'O', 'oportunidad']);
    debilidades = extractArray(['debilidades', 'weaknesses', 'D', 'debilidad']);
    amenazas = extractArray(['amenazas', 'threats', 'A', 'amenaza']);

    const cruz = rawT3.fodaCruzado || rawT3.estrategiasCruzadas || rawT3.cruzado || rawT3.estrategias || {};
    estFO = safeStr(cruz.estrategiaFO || cruz.fo || cruz.maxiMaxi || rawT3.estFO || rawT3.fo || '');
    estDO = safeStr(cruz.estrategiaDO || cruz.do || cruz.miniMaxi || rawT3.estDO || rawT3.do || '');
    estFA = safeStr(cruz.estrategiaFA || cruz.fa || cruz.maxiMini || rawT3.estFA || rawT3.fa || '');
    estDA = safeStr(cruz.estrategiaDA || cruz.da || cruz.miniMini || rawT3.estDA || rawT3.da || '');
  }

  // Fallbacks pedagógicos oficiales MCCEMS si no están definidos
  if (fortalezas.length === 0) {
    fortalezas = [
      'Colegiado docente comprometido y con experiencia en proyectos formativos interdisciplinarios.',
      'Estudiantes con alto sentido de pertenencia comunitaria, creatividad y disposición participativa.',
      'Respaldo de las autoridades del plantel y apertura de la asamblea comunitaria de padres de familia.',
    ];
  }
  if (oportunidades.length === 0) {
    oportunidades = [
      'Disponibilidad de aliados estratégicos comunitarios, ejidales e institucionales en el territorio.',
      'Convocatorias y programas estatales y federales para el impulso a la vinculación y servicio social.',
      'Espacios públicos, predios ejidales y áreas verdes disponibles para intervención directa y faenas.',
    ];
  }
  if (debilidades.length === 0) {
    debilidades = [
      'Recursos materiales e insumos técnicos de laboratorio, campo y cómputo limitados en el plantel.',
      'Tiempos restringidos para la coordinación y planeación transversal del colegiado entre turnos.',
      'Carencia de herramientas tecnológicas de punta para levantamiento digital georreferenciado en campo.',
    ];
  }
  if (amenazas.length === 0) {
    amenazas = [
      'Condiciones climáticas adversas o temporadas de lluvias intensas que retrasan actividades de campo.',
      'Desafíos socioeconómicos y de movilidad en el entorno familiar del estudiantado.',
      'Trámites burocráticos para permisos de intervención territorial con autoridades auxiliares.',
    ];
  }

  if (!estFO || estFO === 'Sin información registrada') {
    estFO = 'Aprovechar el liderazgo del colegiado docente y el compromiso estudiantil para consolidar brigadas comunitarias permanentes con los aliados estratégicos locales.';
  }
  if (!estDO || estDO === 'Sin información registrada') {
    estDO = 'Subsanar las carencias materiales gestionando donaciones de insumos con los aliados estratégicos y aplicando reciclaje técnico formativo.';
  }
  if (!estFA || estFA === 'Sin información registrada') {
    estFA = 'Utilizar la cohesión pedagógica y el sentido de identidad escolar para blindar al estudiantado frente a riesgos del entorno social y contingencias climáticas.';
  }
  if (!estDA || estDA === 'Sin información registrada') {
    estDA = 'Minimizar debilidades operativas mediante protocolos preventivos de trabajo colaborativo que reduzcan el impacto de contingencias externas y limitaciones presupuestales.';
  }

  return { fortalezas, oportunidades, debilidades, amenazas, estFO, estDO, estFA, estDA };
}

const CELLMRG = { top: 90, bottom: 90, left: 130, right: 130 };
const CELLMRG_COMPACT = { top: 60, bottom: 60, left: 90, right: 90 };

// Creador de celda base
export function tc(
  text: string | Paragraph[],
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
    compact?: boolean;
    borderColor?: string;
  } = {}
): TableCell {
  const {
    w,
    span = 1,
    bold = false,
    fill = C.white,
    color = C.text,
    size = 18, // 9pt
    align = AlignmentType.LEFT,
    valign = 'center',
    italics = false,
    compact = false,
    borderColor = C.border,
  } = opts;

  let children: Paragraph[] = [];
  if (typeof text === 'string') {
    const rawLines = (text || '').split('\n');
    children = rawLines.map(
      (line) =>
        new Paragraph({
          alignment: align,
          spacing: { before: compact ? 15 : 30, after: compact ? 15 : 30 },
          children: [new TextRun({ text: line, bold, italics, size, color, font: 'Arial' })],
        })
    );
    if (children.length === 0) {
      children = [new Paragraph({ children: [new TextRun('')] })];
    }
  } else {
    children = text;
  }

  return new TableCell({
    columnSpan: span,
    width: w ? { size: w, type: WidthType.DXA } : undefined,
    shading: { fill, type: ShadingType.CLEAR },
    borders: bdr(borderColor),
    margins: compact ? CELLMRG_COMPACT : CELLMRG,
    verticalAlign: valign,
    children,
  });
}

// Creador de celda encabezado
export function tcH(text: string, opts: { w?: number; span?: number; size?: number; fill?: string } = {}) {
  return tc(text, {
    bold: true,
    fill: opts.fill || C.dark,
    color: C.white,
    size: opts.size || 18,
    align: AlignmentType.CENTER,
    ...opts,
  });
}

// Tabla para sección Portrait
export function tblP(rows: TableRow[], widths: number[]): Table {
  return new Table({
    width: { size: CONTENT_PORTRAIT, type: WidthType.DXA },
    columnWidths: widths,
    rows,
  });
}

// Tabla para sección Landscape
export function tblL(rows: TableRow[], widths: number[]): Table {
  return new Table({
    width: { size: CONTENT_LANDSCAPE, type: WidthType.DXA },
    columnWidths: widths,
    rows,
  });
}

// Encabezado de Macro-Fase (Título Mayor con pleca)
export function macroH(title: string, sub?: string): Paragraph[] {
  const pList: Paragraph[] = [
    new Paragraph({
      spacing: { before: 360, after: 60 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: C.accent, space: 4 } },
      children: [
        new TextRun({
          text: title.toUpperCase(),
          bold: true,
          size: 26, // 13pt
          color: C.dark,
          font: 'Arial',
        }),
      ],
    }),
  ];
  if (sub) {
    pList.push(
      new Paragraph({
        spacing: { before: 40, after: 140 },
        children: [
          new TextRun({
            text: sub,
            italics: true,
            size: 19, // 9.5pt
            color: C.textMuted,
            font: 'Arial',
          }),
        ],
      })
    );
  }
  return pList;
}

// Encabezado de subsección o tabla
export function secH(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 240, after: 80 },
    children: [
      new TextRun({
        text,
        bold: true,
        size: 22, // 11pt
        color: C.mid,
        font: 'Arial',
      }),
    ],
  });
}

// Párrafo de texto formal
export function para(text: string, opts: { bold?: boolean; italics?: boolean; size?: number; color?: string; align?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {}): Paragraph {
  return new Paragraph({
    alignment: opts.align || AlignmentType.JUSTIFIED,
    spacing: { before: 60, after: 60 },
    children: [
      new TextRun({
        text,
        bold: opts.bold || false,
        italics: opts.italics || false,
        size: opts.size || 20, // 10pt
        color: opts.color || C.text,
        font: 'Arial',
      }),
    ],
  });
}

// Separador vertical
export function sp(): Paragraph {
  return new Paragraph({ spacing: { before: 80, after: 80 }, children: [new TextRun('')] });
}


export interface PaecDocxContext {
  p: PaecProject;
  sCtx: SchoolContext;
  cCtx: CommunityContext;
  teacherName: string;
  zonaTexto: string;
  zonaNum: string | null;
  supervisionFirma: string;
  zonaFirmaTexto: string;
}
