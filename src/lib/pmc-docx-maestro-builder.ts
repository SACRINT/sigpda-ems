// src/lib/pmc-docx-maestro-builder.ts
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
  Header,
  Footer,
} from 'docx';
import { getCatalogoMetasPmc } from './catalogo-metas-pmc';
import type { MetaCatalogEntry } from '@/types/pmc';

// ─── PALETA CROMÁTICA INSTITUCIONAL OFICIAL ─────────────────────────────────
const BRAND = {
  guinda: '691C32',       // Primario oficial SEP/Puebla
  dorado: 'BC955C',       // Secundario institucional
  doradoClaro: 'F4EDE4',  // Fondo de acento
  grisFondo: 'F9FAFB',    // Relleno alterno de celdas
  grisBorde: 'D1D5DB',    // Bordes de tabla sutiles
  textoOscuro: '1F2937',  // Texto principal
  textoMuted: '4B5563',   // Texto secundario
  blanco: 'FFFFFF',       // Fondo blanco
};

// Medidas estándar de página (Twips: 1 pulgada = 1440 twips)
const PAGE_W = 12240;      // Carta (8.5 x 11 pulgadas)
const MARGIN = 1080;       // 0.75 pulgadas
const CONTENT_W = PAGE_W - MARGIN * 2; // 10080 twips

// ─── INTERFACES DE DATOS CANÓNICAS (information_schema.columns) ─────────────
export interface PmcMetasInstitucionalesItem {
  tema?: string;
  diagnostico_meta?: string;
  meta?: string;
  estrategia?: string;
  linea_base?: string;
  personal_designado?: string;
  entregable?: string;
  periodo_inicio?: string;
  periodo_fin?: string;
}

export interface PmcMetasPersonalesItem {
  nombre?: string;
  cargo?: string;
  categoria?: string | null;
  tema?: string | null;
  meta_individual?: string | null;
  estrategia?: string | null;
  entregable?: string | null;
  periodo?: string | null;
}

export interface MaestroRejectionResult {
  rejected: boolean;
  status?: number;
  body?: {
    error: string;
    mensaje: string;
    faltantes: {
      diagnostico: boolean;
      plan_accion: boolean;
    };
  };
}

/**
 * Valida si un proyecto PMC cuenta con los pasos obligatorios (Paso 1 y 2)
 * para emitir el Documento Maestro Oficial. De no tenerlos, genera la respuesta 422 formal.
 */
export function resolveMaestroRejection(project: {
  diagnostico_generado?: unknown;
  plan_accion?: unknown;
}): MaestroRejectionResult {
  const hasDiagnostico = Boolean(project.diagnostico_generado);
  const hasPlanAccion = Boolean(project.plan_accion);

  if (!hasDiagnostico || !hasPlanAccion) {
    return {
      rejected: true,
      status: 422,
      body: {
        error: 'PROYECTO_INCOMPLETO_BORRADOR',
        mensaje:
          'El proyecto PMC se encuentra en estado de borrador incompleto. Debe generar y guardar el Diagnóstico Integral (Paso 1) y el Plan de Acción (Paso 2) antes de exportar el Documento Maestro.',
        faltantes: {
          diagnostico: !hasDiagnostico,
          plan_accion: !hasPlanAccion,
        },
      },
    };
  }

  return { rejected: false };
}

export interface PmcDiagnosticoGenerado {
  presentacion?: string;
  contexto?: string;
  analisis_indicadores?: string;
  priorizacion?: string;
  sintesis_foda?: string;
}

export interface PmcPlanAccion {
  metas_institucionales?: PmcMetasInstitucionalesItem[];
  metas_personales?: PmcMetasPersonalesItem[];
}

export interface PmcProjectMasterData {
  id: string;
  teacher_id: string;
  school_name?: string;
  school_cct?: string;
  municipality?: string;
  locality?: string;
  school_zone?: string;
  director_name?: string;
  supervisor_name?: string;
  ciclo_escolar?: string;
  subsystem?: string;
  total_staff?: number | string;
  staff_data?: unknown;
  indicadores_academicos?: unknown;
  foda?: unknown;
  categorias_priorizadas?: unknown;
  diagnostico_comunidad?: unknown;
  normativa?: unknown;
  diagnostico_generado?: PmcDiagnosticoGenerado | string;
  plan_accion?: PmcPlanAccion | string;
  current_step?: number;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PmcPersonalItem {
  id: string;
  nombre: string;
  apellido_paterno: string;
  apellido_materno?: string | null;
  email?: string | null;
  cargo?: string | null;
  horas_base?: number | string | null;
  activo?: boolean;
}

export interface PmcCatalogoMetaItem {
  id: string;
  nombre: string;
  categoria: string;
  subcategoria: string;
  articulos: string[];
  vigencia?: boolean;
  aplicabilidad_nivel: 'obligatoria' | 'recomendada' | 'contextual';
  aplicabilidad_justificacion: string;
  evidencia?: string | null;
  orden_display?: number;
}

export interface PmcDocxMaestroOptions {
  catalogoMetas?: PmcCatalogoMetaItem[];
  personal?: PmcPersonalItem[];
}

// ─── HELPERS DE CONSTRUCCIÓN VISUAL DOCX ─────────────────────────────────────
const CELL_PADDING = { top: 100, bottom: 100, left: 140, right: 140 };

function bdr(color = BRAND.grisBorde) {
  const b = { style: BorderStyle.SINGLE, size: 4, color };
  return { top: b, bottom: b, left: b, right: b };
}

function bdrTopOnly(color = BRAND.dorado) {
  const b = { style: BorderStyle.SINGLE, size: 8, color };
  const none = { style: BorderStyle.NONE, size: 0, color: 'auto' };
  return { top: b, bottom: none, left: none, right: none };
}

function cell(
  content: string | Paragraph[],
  options: {
    w?: number;
    span?: number;
    bold?: boolean;
    fill?: string;
    color?: string;
    size?: number;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    italics?: boolean;
  } = {}
): TableCell {
  const {
    w = 2000,
    span = 1,
    bold = false,
    fill,
    color = BRAND.textoOscuro,
    size = 20, // 10pt
    align = AlignmentType.LEFT,
    italics = false,
  } = options;

  let children: Paragraph[];
  if (typeof content === 'string') {
    children = [
      new Paragraph({
        alignment: align,
        spacing: { before: 40, after: 40, line: 240 },
        children: [
          new TextRun({
            text: content,
            bold,
            italics,
            color,
            size,
            font: 'Arial',
          }),
        ],
      }),
    ];
  } else {
    children = content;
  }

  return new TableCell({
    width: { size: w, type: WidthType.DXA },
    columnSpan: span,
    margins: CELL_PADDING,
    borders: bdr(),
    shading: fill ? { fill, type: ShadingType.CLEAR } : undefined,
    children,
  });
}

function h1(title: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 280, after: 140 },
    children: [
      new TextRun({
        text: title,
        bold: true,
        size: 32, // 16pt
        color: BRAND.guinda,
        font: 'Arial',
      }),
    ],
  });
}

function h2(title: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 100 },
    children: [
      new TextRun({
        text: title,
        bold: true,
        size: 26, // 13pt
        color: BRAND.dorado,
        font: 'Arial',
      }),
    ],
  });
}

function p(text: string, opts: { bold?: boolean; italics?: boolean; color?: string; size?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {}): Paragraph {
  return new Paragraph({
    alignment: opts.align || AlignmentType.BOTH,
    spacing: { before: 60, after: 80, line: 276 },
    children: [
      new TextRun({
        text,
        bold: opts.bold || false,
        italics: opts.italics || false,
        color: opts.color || BRAND.textoOscuro,
        size: opts.size || 22, // 11pt
        font: 'Arial',
      }),
    ],
  });
}

function parseJsonField<T>(field: unknown, fallback: T): T {
  if (!field) return fallback;
  if (typeof field === 'object') return field as T;
  if (typeof field === 'string') {
    try {
      return JSON.parse(field) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

// ─── ENSAMBLADOR MAESTRO PMC (8 CAPÍTULOS DETERMINISTAS) ─────────────────────
export async function generatePmcDocxMaestro(
  project: PmcProjectMasterData,
  options: PmcDocxMaestroOptions = {}
): Promise<Buffer> {
  const diag = parseJsonField<PmcDiagnosticoGenerado>(project.diagnostico_generado, {});
  const plan = parseJsonField<PmcPlanAccion>(project.plan_accion, {});
  const metasInst = plan.metas_institucionales || [];
  const metasPers = plan.metas_personales || [];

  // Mapeo seguro de columnas reales (information_schema.columns)
  const schoolName = project.school_name || 'Plantel Educativo';
  const cct = project.school_cct || 'CCT Pendiente';
  const municipio = project.municipality || 'No capturado';
  const localidad = project.locality || 'No capturado';
  const zona = project.school_zone || 'No capturado';
  const ciclo = project.ciclo_escolar || '2025-2026';
  const subsistema = project.subsystem || 'No capturado';
  const director = project.director_name || 'No capturado';
  const supervisor = project.supervisor_name || 'No capturado';

  // 1. Portada e Identificación Institucional
  const portadaItems: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 600, after: 120 },
      children: [
        new TextRun({
          text: 'GOBIERNO DEL ESTADO DE PUEBLA',
          bold: true,
          size: 26,
          color: BRAND.dorado,
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 240 },
      children: [
        new TextRun({
          text: 'SECRETARÍA DE EDUCACIÓN PÚBLICA — SUBSECRETARÍA DE EDUCACIÓN MEDIA SUPERIOR',
          bold: true,
          size: 20,
          color: BRAND.textoMuted,
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 400, after: 160 },
      children: [
        new TextRun({
          text: 'PROGRAMA DE MEJORA CONTINUA (PMC)',
          bold: true,
          size: 38,
          color: BRAND.guinda,
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 480 },
      children: [
        new TextRun({
          text: `DOCUMENTO MAESTRO INSTITUCIONAL — CICLO ESCOLAR ${ciclo}`,
          bold: true,
          size: 24,
          color: BRAND.dorado,
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 100, after: 300 },
      children: [
        new TextRun({
          text: 'Conforme a los Lineamientos Oficiales DBEPA Formato 5.2 y la Ley General de Educación',
          italics: true,
          size: 20,
          color: BRAND.textoMuted,
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({ spacing: { before: 200, after: 200 } }),
  ];

  // Tabla de Identificación del Plantel en Portada
  const tablaIdentificacion = new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    borders: bdr(BRAND.dorado),
    rows: [
      new TableRow({
        children: [
          cell('FICHA DE IDENTIFICACIÓN INSTITUCIONAL', {
            w: CONTENT_W,
            span: 2,
            bold: true,
            fill: BRAND.guinda,
            color: BRAND.blanco,
            size: 22,
            align: AlignmentType.CENTER,
          }),
        ],
      }),
      new TableRow({
        children: [
          cell('Nombre de la Escuela / Plantel:', { w: 3200, bold: true, fill: BRAND.doradoClaro }),
          cell(schoolName, { w: CONTENT_W - 3200, bold: true }),
        ],
      }),
      new TableRow({
        children: [
          cell('Clave de Centro de Trabajo (CCT):', { w: 3200, bold: true, fill: BRAND.doradoClaro }),
          cell(cct, { w: CONTENT_W - 3200 }),
        ],
      }),
      new TableRow({
        children: [
          cell('Subsistema Educativo:', { w: 3200, bold: true, fill: BRAND.doradoClaro }),
          cell(subsistema, { w: CONTENT_W - 3200 }),
        ],
      }),
      new TableRow({
        children: [
          cell('Zona Escolar de Adscripción:', { w: 3200, bold: true, fill: BRAND.doradoClaro }),
          cell(zona, { w: CONTENT_W - 3200 }),
        ],
      }),
      new TableRow({
        children: [
          cell('Municipio y Localidad:', { w: 3200, bold: true, fill: BRAND.doradoClaro }),
          cell(
            localidad !== 'No capturado' && municipio !== 'No capturado'
              ? `${localidad}, ${municipio}, Puebla`
              : municipio !== 'No capturado'
              ? `${municipio}, Puebla`
              : 'No capturado',
            { w: CONTENT_W - 3200 }
          ),
        ],
      }),
      new TableRow({
        children: [
          cell('Titular de la Dirección:', { w: 3200, bold: true, fill: BRAND.doradoClaro }),
          cell(director, { w: CONTENT_W - 3200 }),
        ],
      }),
      new TableRow({
        children: [
          cell('Titular de la Supervisión:', { w: 3200, bold: true, fill: BRAND.doradoClaro }),
          cell(supervisor, { w: CONTENT_W - 3200 }),
        ],
      }),
    ],
  });

  // Capítulo 1 Título formal
  const ubicacionTexto =
    localidad !== 'No capturado' && municipio !== 'No capturado'
      ? `ubicada en ${localidad}, Municipio de ${municipio}, Puebla`
      : municipio !== 'No capturado'
      ? `ubicada en el Municipio de ${municipio}, Puebla`
      : 'con ubicación territorial en proceso de registro';

  const zonaTexto = zona !== 'No capturado' ? `perteneciente a la ${zona}` : 'con zona escolar en asignación';
  const subsistemaTexto = subsistema !== 'No capturado' ? `del subsistema ${subsistema}` : 'del subsistema de Educación Media Superior';

  const cap1 = [
    h1('Capítulo I. Identificación Institucional'),
    p(
      `El presente Programa de Mejora Continua (PMC) ha sido formulado por la comunidad académica y directiva de ${schoolName} (CCT: ${cct}), ${ubicacionTexto}, ${zonaTexto} ${subsistemaTexto}, como instrumento rector de planeación participativa para el ciclo escolar ${ciclo}.`
    ),
    p(
      'Este documento orienta los esfuerzos colectivos hacia la excelencia formativa, el abatimiento del rezago y abandono escolar, el fortalecimiento de la práctica pedagógica docente y la vinculación proactiva con la comunidad circundante.'
    ),
    new Paragraph({ children: [new PageBreak()] }),
  ];

  // Capítulo 2 — Marco Normativo y Catálogo de Metas
  let isFallbackCatalogo = false;
  let metasRows = options.catalogoMetas || [];
  if (metasRows.length === 0) {
    isFallbackCatalogo = true;
    const canonic = getCatalogoMetasPmc();
    metasRows = canonic.map((m: MetaCatalogEntry) => ({
      id: m.id,
      nombre: m.nombre,
      categoria: m.categoria,
      subcategoria: m.subcategoria,
      articulos: m.articulos,
      aplicabilidad_nivel: m.aplicabilidad_pmc.nivel,
      aplicabilidad_justificacion: m.aplicabilidad_pmc.justificacion,
      evidencia: m.evidencia,
      orden_display: m.orden_display,
    }));
  }

  const tablaMetasRows = [
    new TableRow({
      children: [
        cell('No.', { w: 600, bold: true, fill: BRAND.guinda, color: BRAND.blanco, align: AlignmentType.CENTER }),
        cell('Subcategoría 5.2 Oficial', { w: 2600, bold: true, fill: BRAND.guinda, color: BRAND.blanco }),
        cell('Meta Institucional Canónica', { w: 3880, bold: true, fill: BRAND.guinda, color: BRAND.blanco }),
        cell('Nivel / Normativa Aplicable', { w: 3000, bold: true, fill: BRAND.guinda, color: BRAND.blanco }),
      ],
    }),
  ];

  metasRows.forEach((m, idx) => {
    const bg = idx % 2 === 0 ? BRAND.blanco : BRAND.grisFondo;
    tablaMetasRows.push(
      new TableRow({
        children: [
          cell(String(idx + 1), { w: 600, fill: bg, align: AlignmentType.CENTER }),
          cell(m.subcategoria, { w: 2600, fill: bg, bold: true, size: 18 }),
          cell(m.nombre, { w: 3880, fill: bg, size: 18 }),
          cell(`${m.aplicabilidad_nivel.toUpperCase()}\n${(m.articulos || []).join(', ')}`, { w: 3000, fill: bg, size: 16 }),
        ],
      })
    );
  });

  const cap2 = [
    h1('Capítulo II. Marco Normativo y Catálogo de Metas Institucionales'),
    p(
      'El sustento jurídico del PMC emana del Artículo 3° de la Constitución Política de los Estados Unidos Mexicanos, la Ley General de Educación (2019), la Ley General del Sistema para la Carrera de las Maestras y los Maestros (LGSCMM), el Marco Curricular Común de la Educación Media Superior (Acuerdo 14/08/22) y los Lineamientos para la Planeación de la Mejora Continua 2025-2026 de la Dirección de Bachilleratos Estatales y Preparatoria Abierta (DBEPA) de Puebla.'
    ),
    new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      borders: bdr(),
      rows: tablaMetasRows,
    }),
    p(
      isFallbackCatalogo
        ? 'Fuente: Catálogo Canónico Institucional SIGPDA-EMS (Respaldo Local).'
        : 'Fuente: Catálogo de Metas Institucionales persistido en Base de Datos Normativa Neon DB.',
      { italics: true, size: 18, color: BRAND.textoMuted }
    ),
    new Paragraph({ children: [new PageBreak()] }),
  ];

  // Capítulo 3 — Diagnóstico Integral del Plantel
  const cap3 = [
    h1('Capítulo III. Diagnóstico Integral del Plantel'),
    h2('3.1 Presentación y Justificación Diagnóstica'),
    p(diag.presentacion || 'Contenido pendiente de captura en el wizard.'),
    h2('3.2 Contexto Escolar, Sociocultural y Comunitario'),
    p(diag.contexto || 'Contenido pendiente de captura en el wizard.'),
    h2('3.3 Análisis de Indicadores Académicos y Eficiencia Educativa'),
    p(diag.analisis_indicadores || 'Contenido pendiente de captura en el wizard.'),
    h2('3.4 Síntesis del Análisis FODA Institucional'),
    p(diag.sintesis_foda || 'Contenido pendiente de captura en el wizard.'),
    h2('3.5 Priorización de Problemáticas y Ámbitos de Mejora'),
    p(diag.priorizacion || 'Contenido pendiente de captura en el wizard.'),
    new Paragraph({ children: [new PageBreak()] }),
  ];

  // Capítulo 4 — Objetivos Generales y Estrategias del PMC
  const cap4Items: Paragraph[] = [
    h1('Capítulo IV. Objetivos Generales y Estrategias del PMC'),
    p(
      `Con base en el diagnóstico situacional y las ${metasInst.length} metas institucionales registradas, se articulan las siguientes líneas de acción estratégica y objetivos institucionales:`
    ),
  ];

  if (metasInst.length === 0) {
    cap4Items.push(p('Contenido pendiente de captura en el wizard.'));
  } else {
    metasInst.forEach((m, i) => {
      cap4Items.push(h2(`4.${i + 1} ${m.tema || 'Ámbito de Mejora Institucional'}`));
      if (m.diagnostico_meta) {
        cap4Items.push(p(`Diagnóstico situacional: ${m.diagnostico_meta}`, { italics: true }));
      }
      cap4Items.push(p(`Objetivo / Meta: ${m.meta || 'Meta no especificada.'}`, { bold: true }));
      if (m.estrategia) {
        cap4Items.push(p(`Estrategia pedagógica/operativa: ${m.estrategia}`));
      }
      if (m.linea_base) {
        cap4Items.push(p(`Línea base de partida: ${m.linea_base}`, { color: BRAND.textoMuted, size: 20 }));
      }
    });
  }
  cap4Items.push(new Paragraph({ children: [new PageBreak()] }));

  // Capítulo 5 — Plan de Acción y Metas Anuales Institucionales
  const tablaPlanAccionRows = [
    new TableRow({
      children: [
        cell('Ámbito / Tema', { w: 2200, bold: true, fill: BRAND.guinda, color: BRAND.blanco }),
        cell('Meta Programada y Entregable', { w: 4280, bold: true, fill: BRAND.guinda, color: BRAND.blanco }),
        cell('Periodo de Ejecución', { w: 1800, bold: true, fill: BRAND.guinda, color: BRAND.blanco, align: AlignmentType.CENTER }),
        cell('Personal Designado', { w: 1800, bold: true, fill: BRAND.guinda, color: BRAND.blanco }),
      ],
    }),
  ];

  if (metasInst.length === 0) {
    tablaPlanAccionRows.push(
      new TableRow({
        children: [
          cell('Contenido pendiente de captura en el wizard.', { w: CONTENT_W, span: 4, italics: true }),
        ],
      })
    );
  } else {
    metasInst.forEach((m, idx) => {
      const bg = idx % 2 === 0 ? BRAND.blanco : BRAND.grisFondo;
      tablaPlanAccionRows.push(
        new TableRow({
          children: [
            cell(m.tema || 'Ámbito General', { w: 2200, fill: bg, bold: true, size: 18 }),
            cell(`${m.meta || 'Meta no especificada.'}\n\nEntregable: ${m.entregable || 'Evidencia documental'}`, {
              w: 4280,
              fill: bg,
              size: 18,
            }),
            cell(`${m.periodo_inicio || 'Inicio'} — ${m.periodo_fin || 'Término'}`, {
              w: 1800,
              fill: bg,
              align: AlignmentType.CENTER,
              size: 18,
            }),
            cell(m.personal_designado || 'Colegiado Docente', { w: 1800, fill: bg, size: 18 }),
          ],
        })
      );
    });
  }

  const cap5 = [
    h1('Capítulo V. Plan de Acción y Metas Anuales Institucionales'),
    p(
      'La matriz del Plan de Acción consolida los compromisos anuales del plantel, asignando responsabilidades operativas, ventanas temporales y evidencias verificables para cada meta priorizada.'
    ),
    new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      borders: bdr(),
      rows: tablaPlanAccionRows,
    }),
  ];

  if (metasPers.length > 0) {
    cap5.push(h2('5.2 Metas y Compromisos Personales Docentes'));
    cap5.push(
      p(
        'Compromisos individuales asumidos por el personal docente y directivo para coadyuvar al logro de las metas institucionales del PMC:'
      )
    );

    const tablaMetasPersonalesRows = [
      new TableRow({
        children: [
          cell('Nombre', { w: 2000, bold: true, fill: BRAND.guinda, color: BRAND.blanco }),
          cell('Cargo', { w: 1800, bold: true, fill: BRAND.guinda, color: BRAND.blanco }),
          cell('Meta Individual', { w: 3280, bold: true, fill: BRAND.guinda, color: BRAND.blanco }),
          cell('Entregable', { w: 1800, bold: true, fill: BRAND.guinda, color: BRAND.blanco }),
          cell('Período', { w: 1200, bold: true, fill: BRAND.guinda, color: BRAND.blanco, align: AlignmentType.CENTER }),
        ],
      }),
    ];

    metasPers.forEach((mp, idx) => {
      const bg = idx % 2 === 0 ? BRAND.blanco : BRAND.grisFondo;
      const metaText = mp.categoria
        ? `[${mp.categoria}${mp.tema ? ` - ${mp.tema}` : ''}] ${mp.meta_individual || ''}`
        : mp.meta_individual || 'Meta individual formativa';

      tablaMetasPersonalesRows.push(
        new TableRow({
          children: [
            cell(mp.nombre || 'Personal Docente', { w: 2000, fill: bg, bold: true, size: 18 }),
            cell(mp.cargo || 'Docente frente a grupo', { w: 1800, fill: bg, size: 18 }),
            cell(metaText, { w: 3280, fill: bg, size: 18 }),
            cell(mp.entregable || 'Evidencia pedagógica', { w: 1800, fill: bg, size: 18 }),
            cell(mp.periodo || 'Ciclo Escolar', { w: 1200, fill: bg, align: AlignmentType.CENTER, size: 18 }),
          ],
        })
      );
    });

    cap5.push(
      new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        borders: bdr(),
        rows: tablaMetasPersonalesRows,
      })
    );
  }
  cap5.push(new Paragraph({ children: [new PageBreak()] }));

  // Capítulo 6 — Mecanismos de Seguimiento y Monitoreo Trimestral
  const tablaSeguimientoRows = [
    new TableRow({
      children: [
        cell('Periodo / Trimestre', { w: 2400, bold: true, fill: BRAND.guinda, color: BRAND.blanco }),
        cell('Hito / Meta Asociada', { w: 4480, bold: true, fill: BRAND.guinda, color: BRAND.blanco }),
        cell('Responsable del Seguimiento', { w: 3200, bold: true, fill: BRAND.guinda, color: BRAND.blanco }),
      ],
    }),
  ];

  if (metasInst.length === 0) {
    tablaSeguimientoRows.push(
      new TableRow({
        children: [
          cell('Contenido pendiente de captura en el wizard.', { w: CONTENT_W, span: 3, italics: true }),
        ],
      })
    );
  } else {
    metasInst.forEach((m, idx) => {
      const bg = idx % 2 === 0 ? BRAND.blanco : BRAND.grisFondo;
      tablaSeguimientoRows.push(
        new TableRow({
          children: [
            cell(`${m.periodo_inicio || 'Corte 1'} a ${m.periodo_fin || 'Corte 2'}`, { w: 2400, fill: bg, size: 18 }),
            cell(m.meta || 'Meta institucional', { w: 4480, fill: bg, size: 18 }),
            cell(m.personal_designado || 'Dirección / Colegiado', { w: 3200, fill: bg, size: 18 }),
          ],
        })
      );
    });
  }

  const cap6 = [
    h1('Capítulo VI. Mecanismos de Seguimiento y Monitoreo Trimestral'),
    p(
      'El seguimiento sistemático garantiza la pertinencia de las actividades y permite realizar ajustes oportunos en los colegiados de docentes y directivos. A continuación se presentan los cortes temporales y responsables designados derivados de las metas institucionales capturadas:'
    ),
    new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      borders: bdr(),
      rows: tablaSeguimientoRows,
    }),
    p(
      'Nota técnica: Contenido pendiente de captura en el wizard — Las cifras porcentuales de avance trimestral y las bitácoras de observación en aula se incorporan en los periodos de corte programados en el calendario escolar oficial.',
      { italics: true, size: 18, color: BRAND.textoMuted }
    ),
    new Paragraph({ children: [new PageBreak()] }),
  ];

  // Capítulo 7 — Recursos, Vinculación y Plantilla del Plantel
  const personalItems = options.personal || [];
  const tablaPersonalRows = [
    new TableRow({
      children: [
        cell('No.', { w: 600, bold: true, fill: BRAND.guinda, color: BRAND.blanco, align: AlignmentType.CENTER }),
        cell('Nombre Completo del Personal', { w: 3880, bold: true, fill: BRAND.guinda, color: BRAND.blanco }),
        cell('Cargo / Función', { w: 2600, bold: true, fill: BRAND.guinda, color: BRAND.blanco }),
        cell('Horas Base', { w: 1200, bold: true, fill: BRAND.guinda, color: BRAND.blanco, align: AlignmentType.CENTER }),
        cell('Correo Electrónico', { w: 1800, bold: true, fill: BRAND.guinda, color: BRAND.blanco }),
      ],
    }),
  ];

  if (personalItems.length === 0) {
    tablaPersonalRows.push(
      new TableRow({
        children: [
          cell('Contenido pendiente de captura en el wizard — Plantilla docente no sincronizada en el módulo de personal.', {
            w: CONTENT_W,
            span: 5,
            italics: true,
          }),
        ],
      })
    );
  } else {
    personalItems.forEach((pItem, idx) => {
      const bg = idx % 2 === 0 ? BRAND.blanco : BRAND.grisFondo;
      const nombreCompleto = [pItem.apellido_paterno, pItem.apellido_materno, pItem.nombre].filter(Boolean).join(' ');
      tablaPersonalRows.push(
        new TableRow({
          children: [
            cell(String(idx + 1), { w: 600, fill: bg, align: AlignmentType.CENTER, size: 18 }),
            cell(nombreCompleto, { w: 3880, fill: bg, bold: true, size: 18 }),
            cell(pItem.cargo || 'Docente frente a grupo', { w: 2600, fill: bg, size: 18 }),
            cell(String(pItem.horas_base || '-'), { w: 1200, fill: bg, align: AlignmentType.CENTER, size: 18 }),
            cell(pItem.email || '-', { w: 1800, fill: bg, size: 16 }),
          ],
        })
      );
    });
  }

  const cap7 = [
    h1('Capítulo VII. Recursos, Vinculación y Plantilla del Plantel'),
    p(
      `El capital humano de ${schoolName} constituye el eje rector para el logro de las metas del PMC. Con base en los registros oficiales sincronizados en la tabla escuela_personal, la plantilla activa se estructura de la siguiente manera:`
    ),
    new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      borders: bdr(),
      rows: tablaPersonalRows,
    }),
    new Paragraph({ children: [new PageBreak()] }),
  ];

  // Capítulo 8 — Evaluación, Rendición de Cuentas y Firmas Colegiadas
  const tablaEvaluacionRows = [
    new TableRow({
      children: [
        cell('Meta Institucional', { w: 3880, bold: true, fill: BRAND.guinda, color: BRAND.blanco }),
        cell('Línea Base Inicial', { w: 2000, bold: true, fill: BRAND.guinda, color: BRAND.blanco }),
        cell('Meta Final Proyectada', { w: 2200, bold: true, fill: BRAND.guinda, color: BRAND.blanco }),
        cell('Entregable Verificador', { w: 2000, bold: true, fill: BRAND.guinda, color: BRAND.blanco }),
      ],
    }),
  ];

  if (metasInst.length === 0) {
    tablaEvaluacionRows.push(
      new TableRow({
        children: [
          cell('Contenido pendiente de captura en el wizard.', { w: CONTENT_W, span: 4, italics: true }),
        ],
      })
    );
  } else {
    metasInst.forEach((m, idx) => {
      const bg = idx % 2 === 0 ? BRAND.blanco : BRAND.grisFondo;
      tablaEvaluacionRows.push(
        new TableRow({
          children: [
            cell(m.meta || 'Meta institucional', { w: 3880, fill: bg, size: 18 }),
            cell(m.linea_base || 'Sin línea base capturada', { w: 2000, fill: bg, size: 18 }),
            cell(m.meta || '100% de cumplimiento', { w: 2200, fill: bg, size: 18 }),
            cell(m.entregable || 'Evidencia documental', { w: 2000, fill: bg, size: 18 }),
          ],
        })
      );
    });
  }

  // Tabla formal de Firmas Institucionales
  const tablaFirmas = new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
      bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
      left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
      right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 3100, type: WidthType.DXA },
            borders: bdrTopOnly(BRAND.dorado),
            margins: CELL_PADDING,
            children: [
              p(director, { bold: true, align: AlignmentType.CENTER, size: 20 }),
              p('Dirección del Plantel', { italics: true, align: AlignmentType.CENTER, size: 18 }),
              p(schoolName, { color: BRAND.textoMuted, align: AlignmentType.CENTER, size: 16 }),
            ],
          }),
          new TableCell({
            width: { size: 680, type: WidthType.DXA },
            borders: {
              top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
              bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
              left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
              right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
            },
            children: [new Paragraph({})],
          }),
          new TableCell({
            width: { size: 3100, type: WidthType.DXA },
            borders: bdrTopOnly(BRAND.dorado),
            margins: CELL_PADDING,
            children: [
              p('Comité Colegiado de Planeación', { bold: true, align: AlignmentType.CENTER, size: 20 }),
              p('Representación Docente del Plantel', { italics: true, align: AlignmentType.CENTER, size: 18 }),
              p(`CCT: ${cct}`, { color: BRAND.textoMuted, align: AlignmentType.CENTER, size: 16 }),
            ],
          }),
          new TableCell({
            width: { size: 680, type: WidthType.DXA },
            borders: {
              top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
              bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
              left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
              right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
            },
            children: [new Paragraph({})],
          }),
          new TableCell({
            width: { size: 3100, type: WidthType.DXA },
            borders: bdrTopOnly(BRAND.dorado),
            margins: CELL_PADDING,
            children: [
              p(supervisor, { bold: true, align: AlignmentType.CENTER, size: 20 }),
              p('Supervisión Escolar', { italics: true, align: AlignmentType.CENTER, size: 18 }),
              p(zona, { color: BRAND.textoMuted, align: AlignmentType.CENTER, size: 16 }),
            ],
          }),
        ],
      }),
    ],
  });

  const cap8 = [
    h1('Capítulo VIII. Evaluación, Rendición de Cuentas y Firmas Colegiadas'),
    p(
      'La evaluación final del PMC representa el acto de rendición de cuentas académico y administrativo ante la comunidad escolar y las autoridades educativas. Con base en las metas proyectadas en el plan de acción, se establece la siguiente matriz comparativa:'
    ),
    new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      borders: bdr(),
      rows: tablaEvaluacionRows,
    }),
    p(
      'Nota técnica: Contenido pendiente de captura en el wizard — La evaluación cualitativa de impacto final y los porcentajes definitivos de logro se asientan formalmente al término del ciclo escolar.',
      { italics: true, size: 18, color: BRAND.textoMuted }
    ),
    new Paragraph({ spacing: { before: 400, after: 200 } }),
    p('VALIDACIÓN INSTITUCIONAL Y FORMALIZACIÓN COLEGIADA', {
      bold: true,
      align: AlignmentType.CENTER,
      color: BRAND.guinda,
      size: 24,
    }),
    p(
      `En cumplimiento a los Lineamientos Oficiales DBEPA 2025-2026, se firma el presente Programa de Mejora Continua ${localidad !== 'No capturado' ? `en ${localidad}, Puebla, ` : ''}a los acuerdos formalizados por las partes suscritas:`,
      { align: AlignmentType.CENTER, italics: true, size: 18, color: BRAND.textoMuted }
    ),
    new Paragraph({ spacing: { before: 600, after: 300 } }),
    tablaFirmas,
  ];

  // Construcción del documento docx final
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
                    text: `SIGPDA-EMS | ${schoolName} — PMC ${ciclo}`,
                    size: 16,
                    color: BRAND.textoMuted,
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
                    text: 'Documento Maestro Oficial PMC 5.2 — DBEPA Puebla',
                    size: 16,
                    color: BRAND.textoMuted,
                    font: 'Arial',
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          ...portadaItems,
          tablaIdentificacion,
          new Paragraph({ children: [new PageBreak()] }),
          ...cap1,
          ...cap2,
          ...cap3,
          ...cap4Items,
          ...cap5,
          ...cap6,
          ...cap7,
          ...cap8,
        ],
      },
    ],
  });

  return await Packer.toBuffer(doc);
}
