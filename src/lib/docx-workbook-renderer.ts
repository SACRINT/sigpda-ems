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
  ImageRun,
  type ISectionOptions,
} from 'docx';
import { resolveVisualForMission } from '@/lib/visual-engine/visual-asset-manager';
import { svgToPngBuffer } from '@/lib/visual-engine/svg-to-png';
import { downloadAndProcessImage } from '@/lib/visual-engine/image-downloader';
import { SCHOOL_YEAR } from '@/lib/config';
import type {
  ActiveWorkTextbook,
  MissionSection,
  WorkbookElement,
  TroubleshootItem,
  EvaluationSection,
  ProjectSection,
} from '@/types/work-textbook';
import type { Planning, ImageAsset } from '@/types/planning';
import { getRubricLevelDescriptor } from '@/lib/pdf-workbook-renderer';
import {
  resolveMaterialString,
  resolveStepDetails,
  resolveExercise,
  formatRegistrationFormatText,
} from '@/types/workbook-legacy';
import { extractCalloutBox, type CalloutBoxData } from '@/lib/visual-engine/callout-box';
import crypto from 'crypto';
import QRCode from 'qrcode';
import { getVerificationUrl } from '@/lib/digital-signature';
import { extractComparisonTable, type ComparisonTableData } from '@/lib/visual-engine/comparison-table';
import {
  extractGlossaryTerms,
  stripMarkdown,
  deduplicateMediaAssets,
  type GlossaryItem,
} from '@/lib/visual-engine/content-extractor';
import {
  generateBookCover,
  generateContraportadaData,
  type ContraportadaData,
  type BookCoverOptions,
} from '@/lib/visual-engine/cover-generator';
import { logger } from '@/lib/logger';

// ── Paleta de Colores Institucionales DBEPA ──────────────────────────────────
const C = {
  navy: '1F3864',       // Primario institucional
  midBlue: '2E74B5',    // Secundario
  vino: '800020',       // Vino oficial Puebla
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

// Colores temáticos de sección (coincidentes con PDF)
const SECTION_HEX = {
  enganche: '1F3864',
  concepto: '1F3864',
  yoHago: '2563EB',     // Azul (#2563eb)
  hacemos: '7C3AED',    // Púrpura (#7c3aed)
  tuHaces: 'D97706',    // Ámbar (#d97706)
  resiliencia: '800020',// Guinda
  checkpoint: '059669', // Esmeralda (#059669)
  evaluacion: '059669', // Esmeralda (#059669)
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
  options: {
    includeAnswerKey?: boolean;
    coverBuffer?: Buffer;
    forceFallbackCover?: boolean;
  } = {}
): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [];

  const coverOpts: BookCoverOptions = {
    plantelNombre: workbook.coverData?.schoolName || 'Bachillerato General Oficial',
    cct: workbook.coverData?.cct || '21ECT0017T',
    uacName: workbook.coverData?.subjectName || workbook.blockName,
    semestre: (() => {
      const raw = workbook.coverData?.semester;
      if (raw === undefined || raw === null) return 'Segundo Semestre';
      const clean = String(raw).replace(/"/g, '').replace(/\bSEMESTRE\b(\s+SEMESTRE\b)+/gi, 'SEMESTRE').trim();
      return /\bsemestre\b/i.test(clean) ? clean : `${clean}° Semestre`;
    })(),
    cicloEscolar: SCHOOL_YEAR,
    blockName: workbook.blockName,
    blockIndex: workbook.blockIndex,
    subsystem: workbook.subsystem || 'BGE',
    paecProjectName: workbook.coverData?.paecProjectName,
    docente: workbook.coverData?.teacherName,
    forceFallback: options.forceFallbackCover,
  };

  const usedOpenverseAssets: ImageAsset[] = [];

  // ── 1. Portada Editorial Personalizada (Fase V2 & V5) ───────────────────────────
  let coverBuffer = options.coverBuffer;
  if (!coverBuffer) {
    const coverRes = await generateBookCover(coverOpts).catch((e) => {
      logger.warn('[docx-workbook-renderer] Error generando portada editorial:', { error: e, planningId: planning?.id });
      return null;
    });
    if (coverRes?.buffer) {
      coverBuffer = coverRes.buffer;
    }
  }

  const coverSectionChildren: (Paragraph | Table)[] = [];
  if (coverBuffer) {
    // Ajuste 1: fit-inside de 1200x1600 (ratio 0.75) dentro de carta 816x1056 -> 792x1056 px (0% deformación)
    coverSectionChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 0 },
        children: [
          new ImageRun({
            data: coverBuffer,
            transformation: { width: 792, height: 1056 },
            type: 'jpg',
          }),
        ],
      })
    );
  } else {
    coverSectionChildren.push(...buildCoverSection(workbook, planning));
  }

  // ── 2. Páginas Preliminares (Mi Plantel + TOC) (Fase V4 & V5) ─────────────
  const preliminaryChildren: (Paragraph | Table)[] = [];
  const hasPlantelData = Boolean(
    (workbook.coverData?.schoolName || planning?.contentJson?.sectionI?.schoolName) &&
    (workbook.coverData?.cct || planning?.contentJson?.sectionI?.cct) &&
    (workbook.coverData?.paecProjectName || workbook.projectSection?.communityUtility || planning?.paecContext || planning?.contentJson?.sectionII?.paecConnection)
  );

  if (hasPlantelData) {
    preliminaryChildren.push(...buildDocxPlantelComunidadSection(workbook, planning));
    preliminaryChildren.push(new Paragraph({ children: [new PageBreak()] }));
  }

  preliminaryChildren.push(...buildTableOfContents(workbook));

  // ── 3. Páginas Interiores de Contenido Didáctico (Fase V5) ─────────────────
  const bodyChildren: (Paragraph | Table)[] = [];

  for (let i = 0; i < workbook.missions.length; i++) {
    const mission = workbook.missions[i];
    const missionElements = await buildMissionContent(
      mission,
      i + 1,
      workbook.subsystem,
      workbook.coverData?.subjectName,
      planning?.id,
      workbook.blockIndex,
      usedOpenverseAssets
    );
    bodyChildren.push(...missionElements);
    bodyChildren.push(new Paragraph({ children: [new PageBreak()] }));
  }

  // Proyecto Formativo Comunitario
  if (workbook.projectSection) {
    bodyChildren.push(...buildProjectSection(workbook.projectSection, workbook.coverData));
    bodyChildren.push(new Paragraph({ children: [new PageBreak()] }));
  }

  // Evaluación Formativa y Sumativa NEM
  if (workbook.evaluationSection) {
    bodyChildren.push(...buildEvaluationSection(workbook.evaluationSection, workbook.coverData));
    bodyChildren.push(new Paragraph({ children: [new PageBreak()] }));
  }

  // Sello digital y folio SHA-256
  const bookHash = crypto
    .createHash('sha256')
    .update(`${coverOpts.cct}|${coverOpts.uacName}|${coverOpts.cicloEscolar}|sigpda-ems-mccems-2026`)
    .digest('hex');

  // Página de Créditos Institucionales y Atribuciones Creative Commons (Fase V5)
  const uniqueOpenverseAssets = deduplicateMediaAssets(usedOpenverseAssets);
  bodyChildren.push(...buildDocxCreditsSection(uniqueOpenverseAssets, coverOpts, bookHash));

  // ── 4. Contraportada Institucional (Fase V2) ──────────────────────────────
  const contraportadaChildren: (Paragraph | Table)[] = [];
  const contraportadaData = await generateContraportadaData({ ...coverOpts, hash: bookHash }).catch((e) => {
    logger.warn('[docx-workbook-renderer] Error generando contraportada:', { error: e, planningId: planning?.id });
    return null;
  });
  if (contraportadaData) {
    contraportadaChildren.push(...buildDocxContraportada(contraportadaData));
  }

  // ── 5. Ensamblaje Multisección con Aislamiento Estricto de Encabezados (Fase V5) ──
  const shortSubject = (workbook.coverData?.subjectName || workbook.blockName).length > 42
    ? (workbook.coverData?.subjectName || workbook.blockName).slice(0, 39) + '...'
    : (workbook.coverData?.subjectName || workbook.blockName);

  const rawSchool = workbook.coverData?.schoolName || 'BGE';
  const schoolSigla = rawSchool
    .replace(/Bachillerato General (Estatal|Oficial)\s*/i, '')
    .replace(/Preparatoria Abierta\s*/i, '')
    .slice(0, 26)
    .trim() || 'DBEPA';
  const cctClean = workbook.coverData?.cct || '';
  const footerSchoolText = cctClean ? `${schoolSigla} (${cctClean})` : schoolSigla;

  const docSections: ISectionOptions[] = [];

  // Sección 1: Portada (Márgenes en 0, sin encabezado, sin pie)
  docSections.push({
    properties: {
      page: {
        margin: coverBuffer
          ? { top: 0, bottom: 0, left: 0, right: 0 }
          : { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
      },
    },
    headers: {},
    footers: {},
    children: coverSectionChildren,
  });

  // Sección 2: Preliminares (Plantel + TOC) — sin headers
  if (preliminaryChildren.length > 0) {
    docSections.push({
      properties: {
        page: {
          margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
        },
      },
      headers: {},
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: `Cuaderno de Aprendizaje Activo · DBEPA Puebla · ${footerSchoolText}`,
                  size: 16,
                  color: C.mutedText,
                  font: 'Calibri',
                }),
              ],
            }),
          ],
        }),
      },
      children: preliminaryChildren,
    });
  }

  // Sección 3: Contenido Interior (Misiones, Proyecto, Evaluación, Créditos) — Header y Footer institucionales
  docSections.push({
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
                text: `${shortSubject} · ${workbook.blockName} (DBEPA Puebla)`,
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
              new TextRun({
                text: ` · ${footerSchoolText}`,
                size: 16,
                color: C.mutedText,
                font: 'Calibri',
              }),
            ],
          }),
        ],
      }),
    },
    children: bodyChildren,
  });

  // Sección 4: Contraportada (sin headers ni footers)
  if (contraportadaChildren.length > 0) {
    docSections.push({
      properties: {
        page: {
          margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
        },
      },
      headers: {},
      footers: {},
      children: contraportadaChildren,
    });
  }

  const doc = new Document({
    sections: docSections,
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
          text: (cover.title || workbook.blockName || 'CUADERNO DE APRENDIZAJE ACTIVO').toUpperCase(),
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
          text: cover.subtitle || `Bloque Formativo: ${workbook.blockName || ''}`,
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
          text: `Grupo: _________   Turno: _________   Ciclo Escolar: ${SCHOOL_YEAR}`,
          size: 20,
          color: C.mutedText,
          font: 'Calibri',
        }),
      ],
    }),
  ];
}

/**
 * Construye la sección de créditos institucionales y atribuciones Creative Commons en DOCX (Fase V5).
 */
function buildDocxCreditsSection(
  uniqueAssets: ImageAsset[],
  coverOpts: BookCoverOptions,
  bookHash: string
): (Paragraph | Table)[] {
  const elements: (Paragraph | Table)[] = [];

  // Título
  elements.push(
    new Paragraph({
      spacing: { before: 240, after: 120 },
      children: [
        new TextRun({
          text: 'Créditos Institucionales y Atribuciones de Propiedad Intelectual',
          bold: true,
          size: 24, // 12pt
          color: C.navy,
          font: 'Calibri',
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 160 },
      children: [
        new TextRun({
          text: 'Cuaderno de Aprendizaje Activo diseñado e impreso en estricto apego a los principios del Marco Curricular Común de la Educación Media Superior (MCCEMS 2026-2027) y la Nueva Escuela Mexicana (NEM). Los recursos didácticos, esquemas formativos y materiales de apoyo integran derechos de autor y licenciamientos abiertos con fines exclusivamente educativos.',
          size: 18,
          color: C.darkText,
          font: 'Calibri',
        }),
      ],
    })
  );

  // Atribuciones Openverse
  elements.push(
    new Paragraph({
      spacing: { before: 160, after: 80 },
      children: [
        new TextRun({
          text: 'Recursos Visuales y Atribuciones Creative Commons',
          bold: true,
          size: 20,
          color: C.midBlue,
          font: 'Calibri',
        }),
      ],
    })
  );

  if (uniqueAssets.length > 0) {
    const headerRow = new TableRow({
      tableHeader: true,
      children: [
        cell('Ref.', { w: 1000, bold: true, fill: C.navy, color: C.white, size: 16 }),
        cell('Título de la Obra', { w: 3200, bold: true, fill: C.navy, color: C.white, size: 16 }),
        cell('Autor / Creador', { w: 2600, bold: true, fill: C.navy, color: C.white, size: 16 }),
        cell('Licencia CC', { w: 1800, bold: true, fill: C.navy, color: C.white, size: 16 }),
        cell('Fuente / Repositorio', { w: 1640, bold: true, fill: C.navy, color: C.white, size: 16 }),
      ],
    });

    const bodyRows = uniqueAssets.map((asset, idx) => {
      const cleanTitle = stripMarkdown(asset.title || 'Fotografía didáctica');
      const cleanCreator = stripMarkdown(asset.creator || 'Autor no especificado');
      const cleanLic = stripMarkdown(asset.license || 'CC BY-SA');
      const rawSource = asset.sourceUrl || asset.externalId || 'Openverse';
      const cleanSource = stripMarkdown(rawSource);
      return new TableRow({
        children: [
          cell(`Fig. ${idx + 1}`, { w: 1000, bold: true, size: 16 }),
          cell(cleanTitle, { w: 3200, size: 16 }),
          cell(cleanCreator, { w: 2600, size: 16 }),
          cell(cleanLic, { w: 1800, size: 16 }),
          cell(cleanSource, { w: 1640, size: 16 }),
        ],
      });
    });

    elements.push(
      new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        borders: thinBorder(),
        rows: [headerRow, ...bodyRows],
      })
    );
  } else {
    elements.push(
      new Paragraph({
        spacing: { after: 140 },
        children: [
          new TextRun({
            text: 'Iconografía Vectorial Pedagógica: Todos los organizadores gráficos, diagramas de flujo y esquemas visuales integrados en este cuaderno didáctico fueron modelados y renderizados directamente por el motor didáctico SIGPDA-EMS bajo el Marco Curricular Común de la EMS.',
            italics: true,
            size: 18,
            color: C.mutedText,
            font: 'Calibri',
          }),
        ],
      })
    );
  }

  // Directorio Institucional
  elements.push(
    new Paragraph({
      spacing: { before: 200, after: 80 },
      children: [
        new TextRun({
          text: 'Directorio Institucional y Producción Editorial',
          bold: true,
          size: 20,
          color: C.navy,
          font: 'Calibri',
        }),
      ],
    })
  );

  const credRows = [
    ['Dirección General:', 'Secretaría de Educación Pública del Estado de Puebla'],
    ['Subsecretaría:', 'Subsecretaría de Educación Media Superior'],
    ['Dirección de Área:', 'Dirección de Bachilleratos Estatales y Preparatoria Abierta (DBEPA)'],
    ['Plataforma:', 'Sistema Integral de Gestión Pedagógica y Docente Activa (SIGPDA-EMS)'],
    ['Plantel Educativo:', `${coverOpts.plantelNombre} (CCT: ${coverOpts.cct})`],
    ['Unidad de Aprendizaje:', `${coverOpts.uacName} · Bloque ${coverOpts.blockIndex ?? 1}`],
    ['Docente Titular:', coverOpts.docente || 'Academia Docente'],
    ['Ciclo Escolar:', coverOpts.cicloEscolar || SCHOOL_YEAR],
  ];

  elements.push(
    new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      borders: {
        top: { style: BorderStyle.NONE },
        bottom: { style: BorderStyle.NONE },
        left: { style: BorderStyle.NONE },
        right: { style: BorderStyle.NONE },
      },
      rows: credRows.map(([label, val]) =>
        new TableRow({
          children: [
            cell(label, { w: 3200, bold: true, color: C.navy, size: 16 }),
            cell(val, { w: CONTENT_W - 3200, size: 16 }),
          ],
        })
      ),
    })
  );

  // Sello SHA-256
  elements.push(
    new Paragraph({
      spacing: { before: 200, after: 40 },
      children: [
        new TextRun({
          text: 'Folio Digital de Autenticidad Criptográfica (SHA-256):',
          bold: true,
          size: 16,
          color: C.navy,
          font: 'Calibri',
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: bookHash,
          size: 14,
          color: C.mutedText,
          font: 'Courier New',
        }),
      ],
    })
  );

  return elements;
}

/**
 * Construye la sección de contraportada institucional en DOCX con QR y sello (Fase V2).
 */
function buildDocxContraportada(data: ContraportadaData): (Paragraph | Table)[] {
  const elements: (Paragraph | Table)[] = [];

  elements.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 240, after: 80 },
      children: [
        new TextRun({
          text: 'SISTEMA INTEGRAL DE GESTIÓN Y PLANEACIÓN DIDÁCTICA AUTÓNOMA (SIGPDA-EMS)',
          bold: true,
          size: 20,
          color: C.navy,
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [
        new TextRun({
          text: 'FICHA DE ACREDITACIÓN CURRICULAR Y VALIDACIÓN INSTITUCIONAL',
          bold: true,
          size: 17,
          color: C.gold,
          font: 'Arial',
        }),
      ],
    })
  );

  const tableRows: TableRow[] = [
    new TableRow({
      children: [
        new TableCell({
          width: { size: 3000, type: WidthType.DXA },
          shading: { fill: C.navy, type: ShadingType.CLEAR },
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: 'PLANTEL', bold: true, size: 16, color: C.white, font: 'Arial' }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: 6500, type: WidthType.DXA },
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: data.plantelNombre, bold: true, size: 16, color: C.darkText, font: 'Calibri' }),
              ],
            }),
          ],
        }),
      ],
    }),
    new TableRow({
      children: [
        new TableCell({
          width: { size: 3000, type: WidthType.DXA },
          shading: { fill: C.lightBg, type: ShadingType.CLEAR },
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: 'CLAVE C.C.T.', bold: true, size: 16, color: C.navy, font: 'Arial' }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: 6500, type: WidthType.DXA },
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: data.cct, size: 16, color: C.darkText, font: 'Calibri' }),
              ],
            }),
          ],
        }),
      ],
    }),
    new TableRow({
      children: [
        new TableCell({
          width: { size: 3000, type: WidthType.DXA },
          shading: { fill: C.lightBg, type: ShadingType.CLEAR },
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: 'SUBSISTEMA', bold: true, size: 16, color: C.navy, font: 'Arial' }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: 6500, type: WidthType.DXA },
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: `${data.subsystem} · BACHILLERATO ESTATAL PUEBLA`, size: 16, color: C.darkText, font: 'Calibri' }),
              ],
            }),
          ],
        }),
      ],
    }),
    new TableRow({
      children: [
        new TableCell({
          width: { size: 3000, type: WidthType.DXA },
          shading: { fill: C.lightBg, type: ShadingType.CLEAR },
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: 'ASIGNATURA (UAC)', bold: true, size: 16, color: C.navy, font: 'Arial' }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: 6500, type: WidthType.DXA },
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: data.uacName, bold: true, size: 16, color: C.darkText, font: 'Calibri' }),
              ],
            }),
          ],
        }),
      ],
    }),
    new TableRow({
      children: [
        new TableCell({
          width: { size: 3000, type: WidthType.DXA },
          shading: { fill: C.lightBg, type: ShadingType.CLEAR },
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: 'SEMESTRE / CICLO', bold: true, size: 16, color: C.navy, font: 'Arial' }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: 6500, type: WidthType.DXA },
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: `${data.semestre} · CICLO ESCOLAR ${data.cicloEscolar}`, size: 16, color: C.darkText, font: 'Calibri' }),
              ],
            }),
          ],
        }),
      ],
    }),
    new TableRow({
      children: [
        new TableCell({
          width: { size: 3000, type: WidthType.DXA },
          shading: { fill: C.lightBg, type: ShadingType.CLEAR },
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: 'DOCENTE TITULAR', bold: true, size: 16, color: C.navy, font: 'Arial' }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: 6500, type: WidthType.DXA },
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: data.docente, size: 16, color: C.darkText, font: 'Calibri' }),
              ],
            }),
          ],
        }),
      ],
    }),
    new TableRow({
      children: [
        new TableCell({
          width: { size: 3000, type: WidthType.DXA },
          shading: { fill: C.lightBg, type: ShadingType.CLEAR },
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: 'PROYECTO PAEC', bold: true, size: 16, color: C.navy, font: 'Arial' }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: 6500, type: WidthType.DXA },
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: data.paecProjectName, size: 16, color: C.darkText, font: 'Calibri' }),
              ],
            }),
          ],
        }),
      ],
    }),
  ];

  elements.push(
    new Table({
      rows: tableRows,
      width: { size: 9500, type: WidthType.DXA },
      alignment: AlignmentType.CENTER,
      margins: { top: 100, bottom: 100, left: 140, right: 140 },
    })
  );

  // QR Code Image
  elements.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 260, after: 100 },
      children: [
        new ImageRun({
          data: data.qrBuffer,
          transformation: { width: 140, height: 140 },
          type: 'png',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: 'FOLIO DE CONTROL CRIPTOGRÁFICO INSTITUCIONAL:',
          bold: true,
          size: 16,
          color: C.navy,
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: data.hash.slice(0, 36) + '...',
          size: 15,
          color: C.midBlue,
          font: 'Consolas',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: `Enlace de validación: ${data.verificationUrl}`,
          italics: true,
          size: 14,
          color: C.mutedText,
          font: 'Calibri',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 100 },
      children: [
        new TextRun({
          text: 'Documento generado conforme a los lineamientos del MCCEMS 2026-2027 · DBEPA Puebla.',
          size: 14,
          color: C.mutedText,
          font: 'Calibri',
        }),
      ],
    })
  );

  return elements;
}

function buildDocxPlantelComunidadSection(
  workbook: ActiveWorkTextbook,
  planning: Planning | null | undefined
): (Paragraph | Table)[] {
  const elements: (Paragraph | Table)[] = [];

  elements.push(
    new Paragraph({
      spacing: { before: 180, after: 120 },
      children: [
        new TextRun({
          text: 'IDENTIDAD DEL PLANTEL Y VINCULACIÓN COMUNITARIA',
          bold: true,
          size: 28, // 14pt
          color: C.navy,
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: `DIRECCIÓN DE BACHILLERATOS ESTATALES Y PREPARATORIA ABIERTA · MCCEMS ${SCHOOL_YEAR}`,
          bold: true,
          size: 18,
          color: C.gold,
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 240 },
      children: [
        new TextRun({
          text: 'Ficha técnica de contextualización escolar y articulación didáctica del Proyecto de Aula, Escuela y Comunidad (PAEC):',
          size: 20,
          color: C.darkText,
          font: 'Calibri',
        }),
      ],
    })
  );

  const schoolName = workbook.coverData?.schoolName || planning?.contentJson?.sectionI?.schoolName || 'Bachillerato General Oficial';
  const cct = workbook.coverData?.cct || planning?.contentJson?.sectionI?.cct || '21ECT0017T';
  const subsystem = (workbook.subsystem || planning?.contentJson?.sectionI?.subsystem || 'BGE').toUpperCase();
  const municipality = (workbook.coverData as any)?.municipality || 'Puebla, Pue.';
  const teacherName = workbook.coverData?.teacherName || planning?.contentJson?.sectionI?.teacherName || 'Academia Docente del Plantel';
  const subjectName = workbook.coverData?.subjectName || workbook.blockName || planning?.uacName || 'Formación Fundamental';
  const semesterStr = workbook.coverData?.semester !== undefined ? `${workbook.coverData.semester}° Semestre` : 'Segundo Semestre';
  const paecProjectName = workbook.coverData?.paecProjectName || workbook.projectSection?.artifactName || planning?.paecContext || 'Transformación Productiva y Social Comunitaria';
  const paecChallenge = workbook.projectSection?.communityUtility || (workbook.coverData as any)?.paecProblem || planning?.paecContext || 'Atención prioritaria al desarrollo comunitario y sustentabilidad local.';

  // Tabla 1: Ficha Institucional
  elements.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            cell('Dato Institucional', { w: 3200, bold: true, fill: C.navy, color: C.white }),
            cell('Información Oficial Registrada', { w: 6400, bold: true, fill: C.navy, color: C.white }),
          ],
        }),
        new TableRow({ children: [cell('Plantel Educativo:', { bold: true, color: C.navy }), cell(schoolName)] }),
        new TableRow({ children: [cell('Clave CCT:', { bold: true, color: C.navy }), cell(cct)] }),
        new TableRow({ children: [cell('Subsistema:', { bold: true, color: C.navy }), cell(subsystem)] }),
        new TableRow({ children: [cell('Municipio / Región:', { bold: true, color: C.navy }), cell(municipality)] }),
        new TableRow({ children: [cell('Asignatura (UAC):', { bold: true, color: C.navy }), cell(subjectName)] }),
        new TableRow({ children: [cell('Semestre y Ciclo:', { bold: true, color: C.navy }), cell(`${semesterStr} · ${SCHOOL_YEAR}`)] }),
        new TableRow({ children: [cell('Docente Titular:', { bold: true, color: C.navy }), cell(teacherName)] }),
      ],
    }),
    new Paragraph({ spacing: { before: 240, after: 120 } })
  );

  // Tabla 2: Proyecto PAEC
  elements.push(
    new Paragraph({
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: 'Proyecto de Aula, Escuela y Comunidad (PAEC) — Eje Articulador Territorial:',
          bold: true,
          size: 20,
          color: C.navy,
          font: 'Arial',
        }),
      ],
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            cell('Eje del Proyecto Comunitario', { w: 3200, bold: true, fill: C.vino, color: C.white }),
            cell('Diagnóstico y Desafío Situado', { w: 6400, bold: true, fill: C.vino, color: C.white }),
          ],
        }),
        new TableRow({ children: [cell('Denominación del Proyecto:', { bold: true, color: C.vino }), cell(paecProjectName)] }),
        new TableRow({ children: [cell('Problemática / Desafío:', { bold: true, color: C.vino }), cell(paecChallenge)] }),
        new TableRow({
          children: [
            cell('Articulación Formativa:', { bold: true, color: C.vino }),
            cell('Las misiones didácticas de este libro activo proveen el andamiaje experimental y técnico para transformar positivamente la comunidad.'),
          ],
        }),
      ],
    }),
    new Paragraph({ spacing: { before: 280, after: 160 } })
  );

  // Bloque de Firmas
  elements.push(
    new Paragraph({
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: 'Validación Colegiada y Autorización Escolar:',
          bold: true,
          size: 18,
          color: C.navy,
          font: 'Arial',
        }),
      ],
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            cell('Docente Titular de la UAC\n\n_______________________\nFirma y Fecha de Aplicación', { w: 3200, align: AlignmentType.CENTER }),
            cell('Presidente de Academia\n\n_______________________\nValidación Pedagógica Colegiada', { w: 3200, align: AlignmentType.CENTER }),
            cell('Dirección del Plantel\n\n_______________________\nSello Oficial CCT y Resguardo', { w: 3200, align: AlignmentType.CENTER }),
          ],
        }),
      ],
    })
  );

  return elements;
}

function buildDocxGlossaryTable(terms: GlossaryItem[]): (Paragraph | Table)[] {
  const elements: (Paragraph | Table)[] = [];

  elements.push(
    new Paragraph({
      spacing: { before: 200, after: 100 },
      children: [
        new TextRun({
          text: 'GLOSARIO CONCEPTUAL CLAVE DE LA MISIÓN (MCCEMS)',
          bold: true,
          size: 19,
          color: C.vino,
          font: 'Arial',
        }),
      ],
    })
  );

  const rows: TableRow[] = [
    new TableRow({
      children: [
        cell('Término Clave', { w: 2800, bold: true, fill: C.vino, color: C.white }),
        cell('Definición y Contexto Operativo', { w: 6800, bold: true, fill: C.vino, color: C.white }),
      ],
    }),
  ];

  for (const item of terms) {
    rows.push(
      new TableRow({
        children: [
          cell(item.term, { bold: true, color: C.navy }),
          cell(item.definition),
        ],
      })
    );
  }

  elements.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows,
    }),
    new Paragraph({ spacing: { after: 160 } })
  );

  return elements;
}

async function buildDocxMissionQrBox(verificationUrl: string, hashMission: string): Promise<Table> {
  let qrBuffer: Buffer | null = null;
  try {
    qrBuffer = await QRCode.toBuffer(verificationUrl, {
      type: 'png',
      margin: 1,
      width: 140,
      color: { dark: '#1F3864', light: '#FFFFFF' },
    });
  } catch (err) {
    logger.warn('[docx-workbook-renderer] Error generando QR de misión:', err);
  }

  const qrCellChildren: Paragraph[] = [];
  if (qrBuffer) {
    qrCellChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new ImageRun({
            data: qrBuffer,
            transformation: { width: 75, height: 75 },
            type: 'png',
          }),
        ],
      })
    );
  } else {
    qrCellChildren.push(new Paragraph({ text: '[QR]' }));
  }

  const textCellChildren: Paragraph[] = [
    new Paragraph({
      spacing: { before: 40, after: 40 },
      children: [
        new TextRun({
          text: 'VERIFICACIÓN Y TRAZABILIDAD CURRICULAR (MCCEMS)',
          bold: true,
          size: 17,
          color: C.navy,
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 40 },
      children: [
        new TextRun({
          text: 'Verifica este material didáctico · Escanea el código QR para constatar la autoría oficial docente y trazabilidad formativa según los lineamientos de la Nueva Escuela Mexicana.',
          size: 15,
          color: C.darkText,
          font: 'Calibri',
        }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Sello Digital: ${hashMission.slice(0, 24)}... · DBEPA Puebla · ${SCHOOL_YEAR}`,
          italics: true,
          size: 13,
          color: C.mutedText,
          font: 'Consolas',
        }),
      ],
    }),
  ];

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 1800, type: WidthType.DXA },
            verticalAlign: VerticalAlign.CENTER,
            shading: { fill: C.lightBg, type: ShadingType.CLEAR, color: 'auto' },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 4, color: C.border },
              bottom: { style: BorderStyle.SINGLE, size: 4, color: C.border },
              left: { style: BorderStyle.SINGLE, size: 16, color: C.navy },
              right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
            },
            children: qrCellChildren,
          }),
          new TableCell({
            width: { size: 7800, type: WidthType.DXA },
            verticalAlign: VerticalAlign.CENTER,
            shading: { fill: C.lightBg, type: ShadingType.CLEAR, color: 'auto' },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 4, color: C.border },
              bottom: { style: BorderStyle.SINGLE, size: 4, color: C.border },
              left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
              right: { style: BorderStyle.SINGLE, size: 4, color: C.border },
            },
            children: textCellChildren,
          }),
        ],
      }),
    ],
  });
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

  const tocItems =
    workbook.tableOfContents ||
    workbook.missions.map((m, i) => ({
      missionIndex: i + 1,
      title: m.title,
      sessionsRange: 'Sesiones 1 a 4',
      pageEstimate: 6,
    }));

  tocItems.forEach((item) => {
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

/**
 * 1. Tabla Comparativa DOCX: renderiza pares comparativos o cuadros de contraste
 */
function buildDocxComparisonTable(compTable: ComparisonTableData): (Paragraph | Table)[] {
  const rows: TableRow[] = [
    new TableRow({
      children: [
        cell(compTable.headers[0], { w: Math.floor(CONTENT_W * 0.42), bold: true, fill: C.midBlue, color: C.white }),
        cell(compTable.headers[1], { w: Math.floor(CONTENT_W * 0.58), bold: true, fill: C.midBlue, color: C.white }),
      ],
    }),
  ];

  compTable.rows.forEach((r, idx) => {
    const rowBg = idx % 2 === 1 ? C.lightBg : C.white;
    rows.push(
      new TableRow({
        children: [
          cell(r[0], { w: Math.floor(CONTENT_W * 0.42), bold: true, fill: rowBg }),
          cell(r[1], { w: Math.floor(CONTENT_W * 0.58), fill: rowBg }),
        ],
      })
    );
  });

  const result: (Paragraph | Table)[] = [];
  if (compTable.title) {
    result.push(
      new Paragraph({
        spacing: { before: 180, after: 80 },
        children: [
          new TextRun({
            text: compTable.title,
            bold: true,
            size: 22,
            color: C.navy,
            font: 'Arial',
          }),
        ],
      })
    );
  }

  result.push(
    new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      rows,
    })
  );

  if (compTable.caption) {
    result.push(
      new Paragraph({
        spacing: { before: 60, after: 120 },
        children: [
          new TextRun({
            text: compTable.caption,
            italics: true,
            size: 16,
            color: C.mutedText,
            font: 'Calibri',
          }),
        ],
      })
    );
  }

  return result;
}

/**
 * 2. Cajas de Llamado (Callout Box) DOCX: tarjeta con fondo suave y cinta lateral
 */
function buildDocxCalloutBox(callout: CalloutBoxData): Table {
  const accentHex = (callout.accent || '#2563eb').replace('#', '');
  const bgHex = (callout.bgHex || 'EFF6FF').replace('#', '');

  const cleanTitle = stripMarkdown(callout.title).toUpperCase();
  const cleanBody = stripMarkdown(callout.body || callout.content);
  const cleanTakeaway = callout.keyTakeaway ? stripMarkdown(callout.keyTakeaway) : '';

  const childrenParagraphs: Paragraph[] = [
    new Paragraph({
      spacing: { before: 60, after: 60 },
      children: [
        new TextRun({
          text: `[ ${callout.icon || '•'} ${cleanTitle} ]`,
          bold: true,
          size: 18,
          color: accentHex,
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: cleanTakeaway ? 60 : 60, line: 320 },
      children: [
        new TextRun({
          text: cleanBody,
          size: 20,
          color: C.darkText,
          font: 'Calibri',
        }),
      ],
    }),
  ];

  if (cleanTakeaway) {
    childrenParagraphs.push(
      new Paragraph({
        spacing: { after: 60 },
        children: [
          new TextRun({
            text: `• Clave: ${cleanTakeaway}`,
            bold: true,
            italics: true,
            size: 18,
            color: accentHex,
            font: 'Calibri',
          }),
        ],
      })
    );
  }

  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: CONTENT_W, type: WidthType.DXA },
            shading: { fill: bgHex, type: ShadingType.CLEAR },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' },
              bottom: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' },
              left: { style: BorderStyle.SINGLE, size: 24, color: accentHex },
              right: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' },
            },
            margins: { top: 120, bottom: 120, left: 180, right: 180 },
            children: childrenParagraphs,
          }),
        ],
      }),
    ],
  });
}

/**
 * 3. Cintas de Encabezado de Sección DOCX: celda sombreada con borde temático
 */
function buildDocxSectionHeader(title: string, colorHex: string = C.navy): Table {
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: CONTENT_W, type: WidthType.DXA },
            shading: { fill: 'F1F5F9', type: ShadingType.CLEAR },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.SINGLE, size: 6, color: colorHex },
              left: { style: BorderStyle.SINGLE, size: 24, color: colorHex },
              right: { style: BorderStyle.NONE },
            },
            margins: { top: 100, bottom: 100, left: 180, right: 180 },
            children: [
              new Paragraph({
                spacing: { before: 40, after: 40 },
                children: [
                  new TextRun({
                    text: title.toUpperCase(),
                    bold: true,
                    size: 22,
                    color: colorHex,
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
}

/**
 * 4. Tareas con Casillas [  ] y Renglones Punteados para Respuesta Escrita
 */
function buildDocxPracticeTasks(rawText: string, defaultTaskCount: number = 3): (Paragraph | Table)[] {
  if (!rawText) return [];

  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const tasks: string[] = [];

  for (const line of lines) {
    const taskMatch = line.match(/^(\d+[\.\)]|[-*•])\s*(.+)$/);
    if (taskMatch && taskMatch[2].length > 10) {
      tasks.push(taskMatch[2]);
    }
  }

  if (tasks.length === 0) {
    for (const line of lines) {
      if (line.length > 25 && !line.startsWith('#')) {
        tasks.push(line);
      }
      if (tasks.length >= defaultTaskCount) break;
    }
  }

  const selectedTasks = tasks.slice(0, 4);
  if (selectedTasks.length === 0) {
    return [
      new Paragraph({
        spacing: { after: 150, line: 360 },
        children: [new TextRun({ text: rawText, size: 22, color: C.darkText, font: 'Calibri' })],
      }),
    ];
  }

  const elements: (Paragraph | Table)[] = [];
  const dotLine = '· · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·';

  for (let idx = 0; idx < selectedTasks.length; idx++) {
    const taskText = selectedTasks[idx];
    elements.push(
      new Paragraph({
        spacing: { before: 120, after: 60 },
        children: [
          new TextRun({ text: `[  ] Tarea ${idx + 1}: `, bold: true, size: 21, color: C.darkText, font: 'Calibri' }),
          new TextRun({ text: taskText, size: 21, color: C.darkText, font: 'Calibri' }),
        ],
      }),
      new Paragraph({
        spacing: { after: 40 },
        children: [new TextRun({ text: dotLine, size: 18, color: '94A3B8', font: 'Consolas' })],
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun({ text: dotLine, size: 18, color: '94A3B8', font: 'Consolas' })],
      })
    );
  }

  return elements;
}

async function buildMissionContent(
  mission: MissionSection,
  missionNumber: number,
  subsystem: string,
  subjectName?: string,
  planningId?: string,
  blockIndex?: number,
  openverseCollector?: ImageAsset[]
): Promise<(Paragraph | Table)[]> {
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
    buildDocxSectionHeader('1. Enganche y Desafío Situado en la Comunidad', SECTION_HEX.enganche),
    new Paragraph({
      spacing: { before: 100, after: 150, line: 360 }, // 1.5 line spacing
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

  const conceptFullText = `${mission.conceptZero.physicalAnalogy || ''}\n${mission.conceptZero.coreExplanation || ''}\n${mission.conceptZero.narrativeExplanation || ''}`;

  // 2. Concepto Cero
  elements.push(
    buildDocxSectionHeader('2. Concepto Cero: Analogía Intuitiva y Fundamento', SECTION_HEX.concepto),
    new Paragraph({
      spacing: { before: 100, after: 150, line: 360 },
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

  if (mission.conceptZero.narrativeExplanation) {
    elements.push(
      new Paragraph({
        spacing: { after: 200, line: 360 },
        children: [
          new TextRun({
            text: mission.conceptZero.narrativeExplanation,
            size: 22,
            color: C.darkText,
            font: 'Calibri',
          }),
        ],
      })
    );
  }

  if (mission.conceptZero.solvedExample) {
    const ex = mission.conceptZero.solvedExample;
    elements.push(
      new Paragraph({
        spacing: { before: 180, after: 80 },
        children: [
          new TextRun({
            text: 'Ejemplo Modelo Resuelto Paso a Paso (CPA / NEM):',
            bold: true,
            size: 24,
            color: C.navy,
            font: 'Arial',
          }),
        ],
      }),
      new Paragraph({
        spacing: { after: 80, line: 340 },
        children: [
          new TextRun({ text: 'Problema: ', bold: true, size: 21, color: C.darkText, font: 'Calibri' }),
          new TextRun({ text: ex.problemStatement, size: 21, color: C.darkText, font: 'Calibri' }),
        ],
      })
    );

    for (let sIdx = 0; sIdx < (ex.solutionSteps || []).length; sIdx++) {
      elements.push(
        new Paragraph({
          spacing: { after: 50, line: 320 },
          children: [
            new TextRun({ text: `• Paso ${sIdx + 1}: `, bold: true, size: 20, color: C.midBlue, font: 'Calibri' }),
            new TextRun({ text: ex.solutionSteps[sIdx], size: 20, color: C.darkText, font: 'Calibri' }),
          ],
        })
      );
    }

    if (ex.interpretation) {
      elements.push(
        new Paragraph({
          spacing: { before: 80, after: 150, line: 320 },
          children: [
            new TextRun({ text: 'Conclusión pedagógica: ', bold: true, italics: true, size: 20, color: C.navy, font: 'Calibri' }),
            new TextRun({ text: ex.interpretation, italics: true, size: 20, color: C.darkText, font: 'Calibri' }),
          ],
        })
      );
    }
  }

  if (mission.conceptZero.contrastTable && mission.conceptZero.contrastTable.length > 0) {
    elements.push(
      new Paragraph({
        spacing: { before: 180, after: 80 },
        children: [
          new TextRun({
            text: 'Matriz de Contrastación Conceptual y Prevención de Errores:',
            bold: true,
            size: 24,
            color: C.navy,
            font: 'Arial',
          }),
        ],
      })
    );

    const ctCols = [
      { title: 'Concepto Técnico Válido', w: Math.floor(CONTENT_W * 0.35) },
      { title: 'Error Frecuente / Concepto Erróneo', w: Math.floor(CONTENT_W * 0.35) },
      { title: 'Fundamentación', w: Math.floor(CONTENT_W * 0.30) },
    ];

    const ctRows: TableRow[] = [
      new TableRow({
        children: ctCols.map((c) => cell(c.title, { w: c.w, bold: true, fill: C.midBlue, color: C.white })),
      }),
    ];

    mission.conceptZero.contrastTable.forEach((row) => {
      ctRows.push(
        new TableRow({
          children: [
            cell(row.correctConcept, { bold: true }),
            cell(row.commonMisconception, { color: 'C0392B' }),
            cell(row.reasoning),
          ],
        })
      );
    });

    elements.push(
      new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        rows: ctRows,
      })
    );
  } else {
    // Si no cuenta con contrastTable explícita de IA, generar matriz de contraste comparativa si detecta pares reales
    const compTable = extractComparisonTable(conceptFullText, cleanMissionTitle, subjectName);
    if (compTable) {
      elements.push(...buildDocxComparisonTable(compTable));
    }
  }

  // ── 2.05 Glosario Conceptual Clave de la Misión (Fase V4) ───────────────────
  const glossaryTerms = extractGlossaryTerms(mission.conceptZero?.coreExplanation || '');
  if (glossaryTerms && glossaryTerms.length >= 2) {
    elements.push(...buildDocxGlossaryTable(glossaryTerms));
  }

  // ── 2.1 Gráfico Determinístico / Fotografía Situacional Activa ────────────
  if (subjectName) {
    const contextText = [
      mission.phenomenonHook?.story,
      mission.phenomenonHook?.detonatingQuestion,
      mission.conceptZero?.physicalAnalogy,
      mission.conceptZero?.coreExplanation,
      mission.conceptZero?.narrativeExplanation,
      mission.iDoSection?.stepByStepDemo,
      mission.weDoSection?.guidedPractice,
      mission.youDoSection?.autonomousChallenge,
    ].filter(Boolean).join('\n\n');
    const resolvedVisual = await resolveVisualForMission({
      planningId,
      uacName: subjectName,
      blockIndex: blockIndex ?? 0,
      missionIndex: missionNumber,
      missionTitle: mission.title,
      contextText,
      preferOpenverseMedia: true,
    });
    if (resolvedVisual) {
      if (resolvedVisual.type === 'vector_svg' && resolvedVisual.svg) {
        const imgResult = await svgToPngBuffer(resolvedVisual.svg);
        if (imgResult) {
          elements.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 200, after: 80 },
              children: [
                new ImageRun({
                  data: imgResult.buffer,
                  transformation: { width: 500, height: 325 },
                  type: 'jpg',
                }),
              ],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 180 },
              children: [
                new TextRun({
                  text: resolvedVisual.caption,
                  italics: true,
                  size: 16, // 8pt
                  color: C.mutedText,
                  font: 'Calibri',
                }),
              ],
            })
          );
        }
      } else if (resolvedVisual.type === 'openverse_media' && resolvedVisual.mediaAsset) {
        const imgUrl = resolvedVisual.mediaAsset.thumbnailUrl || resolvedVisual.mediaAsset.imageUrl;
        const imgResult = await downloadAndProcessImage(imgUrl);
        if (imgResult) {
          if (openverseCollector) {
            openverseCollector.push(resolvedVisual.mediaAsset);
          }
          const ratio = imgResult.height / imgResult.width;
          const targetWidth = 500;
          const targetHeight = Math.round(Math.min(380, Math.max(200, targetWidth * (ratio || 0.65))));

          elements.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 200, after: 80 },
              children: [
                new ImageRun({
                  data: imgResult.buffer,
                  transformation: { width: targetWidth, height: targetHeight },
                  type: 'jpg',
                }),
              ],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 180 },
              children: [
                new TextRun({
                  text: resolvedVisual.caption,
                  italics: true,
                  size: 16, // 8pt
                  color: C.mutedText,
                  font: 'Calibri',
                }),
              ],
            })
          );
        }
      }
    }
  }

  // Tarjeta de Idea Clave destacada (Callout Box) posterior al recurso visual
  const conceptCallout = extractCalloutBox(conceptFullText, {
    missionNumber,
    defaultType: 'idea_clave',
    defaultTitle: 'Idea Clave de la Misión',
    defaultSubjectName: subjectName,
  });
  if (conceptCallout) {
    elements.push(buildDocxCalloutBox(conceptCallout));
  }

  // 3. Yo Hago (Demostración)
  elements.push(
    buildDocxSectionHeader('3. Yo Hago: Demostración y Protocolo Guiado por el Docente', SECTION_HEX.yoHago),
    new Paragraph({
      spacing: { before: 100, after: 200, line: 360 },
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

  // Tip de Taller / Seguridad Operativa destacado
  const demoCallout = extractCalloutBox(mission.iDoSection.stepByStepDemo || '', {
    missionNumber,
    defaultType: 'tip_taller',
    defaultTitle: 'Tip de Taller y Seguridad Operativa',
    defaultSubjectName: subjectName,
  });
  if (demoCallout) {
    elements.push(buildDocxCalloutBox(demoCallout));
  }

  // 4. Nosotros Hacemos (Práctica Colaborativa)
  elements.push(
    buildDocxSectionHeader('4. Nosotros Hacemos: Práctica Guiada y Cuaderno Activo', SECTION_HEX.hacemos),
    ...buildDocxPracticeTasks(mission.weDoSection.guidedPractice)
  );

  if (mission.weDoSection.workbookElements) {
    for (const el of mission.weDoSection.workbookElements) {
      elements.push(...renderWorkbookElement(el));
    }
  }

  // 5. Tú Haces (Reto Autónomo)
  elements.push(
    buildDocxSectionHeader('5. Tú Haces: Reto Autónomo de Aplicación Real', SECTION_HEX.tuHaces),
    ...buildDocxPracticeTasks(mission.youDoSection.autonomousChallenge)
  );

  if (mission.youDoSection.workbookElements) {
    for (const el of mission.youDoSection.workbookElements) {
      elements.push(...renderWorkbookElement(el));
    }
  }

  // 6. Troubleshooting (Zona de Depuración)
  if (mission.troubleshooting && mission.troubleshooting.length > 0) {
    elements.push(
      buildDocxSectionHeader('6. Matriz de Resiliencia y Depuración: "¿Qué hacer si falla?"', SECTION_HEX.resiliencia),
      buildTroubleshootTable(mission.troubleshooting)
    );
  }

  // 7. Checkpoint Formativo
  if (mission.formativeCheckpoint) {
    elements.push(
      buildDocxSectionHeader('7. Punto de Control Formativo (Metacognición y Criterios)', SECTION_HEX.checkpoint),
      new Paragraph({
        spacing: { before: 100, after: 100 },
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

  // ── Cierre de Misión: QR Institucional de Validación y Sello Curricular (Fase V4) ──
  const hashMission = crypto
    .createHash('sha256')
    .update(`${planningId || 'sigpda'}|${blockIndex ?? 0}|${missionNumber}`)
    .digest('hex');
  const missionVerificationUrl = getVerificationUrl(hashMission);
  elements.push(await buildDocxMissionQrBox(missionVerificationUrl, hashMission));

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
  ];

  // Objetivos de Aprendizaje
  if (project.learningObjectives && project.learningObjectives.length > 0) {
    elements.push(
      new Paragraph({
        spacing: { before: 150, after: 80 },
        children: [
          new TextRun({
            text: 'Objetivos Formativos y de Aprendizaje del Proyecto:',
            bold: true,
            size: 22,
            color: C.navy,
            font: 'Calibri',
          }),
        ],
      })
    );
    for (const obj of project.learningObjectives) {
      elements.push(
        new Paragraph({
          spacing: { after: 50 },
          children: [
            new TextRun({ text: `[✓]  ${obj}`, size: 20, font: 'Calibri' }),
          ],
        })
      );
    }
  }

  // Materiales e Insumos
  if (project.requiredMaterials && project.requiredMaterials.length > 0) {
    elements.push(
      new Paragraph({
        spacing: { before: 150, after: 80 },
        children: [
          new TextRun({
            text: 'Materiales, Herramientas e Insumos Requeridos:',
            bold: true,
            size: 22,
            color: C.navy,
            font: 'Calibri',
          }),
        ],
      })
    );
    for (const mat of project.requiredMaterials) {
      const matStr = resolveMaterialString(mat);
      elements.push(
        new Paragraph({
          spacing: { after: 50 },
          children: [
            new TextRun({ text: `☐  ${matStr}`, size: 20, font: 'Calibri' }),
          ],
        })
      );
    }
  }

  // Pasos de Ejecución Procedimental
  if (project.executionSteps && project.executionSteps.length > 0) {
    elements.push(
      new Paragraph({
        spacing: { before: 150, after: 80 },
        children: [
          new TextRun({
            text: 'Secuencia Procedimental de Construcción:',
            bold: true,
            size: 22,
            color: C.navy,
            font: 'Calibri',
          }),
        ],
      })
    );
    for (const step of project.executionSteps) {
      const { stepText } = resolveStepDetails(step);
      elements.push(
        new Paragraph({
          spacing: { after: 50 },
          children: [
            new TextRun({ text: stepText, size: 20, font: 'Calibri' }),
          ],
        })
      );
    }
  }

  // Cronograma de Fases
  elements.push(
    new Paragraph({
      spacing: { before: 180, after: 100 },
      children: [
        new TextRun({
          text: 'Cronograma de Fases de Construcción y Entregables:',
          bold: true,
          size: 22,
          color: C.navy,
          font: 'Calibri',
        }),
      ],
    })
  );

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

  // Criterios de Entrega y Aceptación
  const criteriaList = [
    ...(project.acceptanceCriteria || []).map((c) => `[Criterio de Aceptación] ${c}`),
    ...(project.deliveryCriteria || []).map((d) => `[Condición de Entrega] ${d}`),
  ];
  if (criteriaList.length > 0) {
    elements.push(
      new Paragraph({
        spacing: { before: 180, after: 80 },
        children: [
          new TextRun({
            text: 'Criterios de Aceptación y Condiciones de Entrega Final:',
            bold: true,
            size: 22,
            color: C.navy,
            font: 'Calibri',
          }),
        ],
      })
    );
    for (const crit of criteriaList) {
      elements.push(
        new Paragraph({
          spacing: { after: 50 },
          children: [
            new TextRun({ text: `• ${crit}`, size: 20, font: 'Calibri' }),
          ],
        })
      );
    }
  }

  // Bitácora de Campo
  if (project.registrationFormat) {
    elements.push(
      new Paragraph({
        spacing: { before: 180, after: 80 },
        children: [
          new TextRun({
            text: 'Bitácora Técnica de Campo y Registro de Avances en Portafolio:',
            bold: true,
            size: 22,
            color: C.navy,
            font: 'Calibri',
          }),
        ],
      })
    );
    const regFormatText = formatRegistrationFormatText(project.registrationFormat, 'docx');

    elements.push(
      new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        rows: [
          new TableRow({
            children: [
              cell(regFormatText, {
                fill: C.lightBg,
                size: 18,
                font: 'Consolas',
              }),
            ],
          }),
        ],
      })
    );

    // Tabla de registro de bitácora y firmas de asesoría docente
    const logColW1 = Math.floor(CONTENT_W * 0.22);
    const logColW2 = Math.floor(CONTENT_W * 0.40);
    const logColW3 = Math.floor(CONTENT_W * 0.20);
    const logColW4 = Math.floor(CONTENT_W * 0.18);

    const logRows: TableRow[] = [
      new TableRow({
        children: [
          cell('Sesión / Fecha', { w: logColW1, bold: true, fill: C.midBlue, color: C.white }),
          cell('Actividad Procedimental Desarrollada', { w: logColW2, bold: true, fill: C.midBlue, color: C.white }),
          cell('Evidencia Obtenida', { w: logColW3, bold: true, fill: C.midBlue, color: C.white }),
          cell('Firma y Sello Docente', { w: logColW4, bold: true, fill: C.midBlue, color: C.white, align: AlignmentType.CENTER }),
        ],
      }),
    ];

    for (let s = 1; s <= 5; s++) {
      logRows.push(
        new TableRow({
          children: [
            cell(`Sesión ${s}: ___/___/2026`, { w: logColW1 }),
            cell(' ', { w: logColW2 }),
            cell(' ', { w: logColW3 }),
            cell(' ', { w: logColW4 }),
          ],
        })
      );
    }

    elements.push(
      new Paragraph({ spacing: { before: 100 } }),
      new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        rows: logRows,
      })
    );
  }

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
          text: '1. Rúbrica Analítica por Niveles de Desempeño Oficiales (DBEPA Puebla):',
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
            text: '2. Lista de Verificación Técnica del Entregable:',
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

  // 3. Evaluación Formativa Escalonada por Niveles de Dominio (Tiered Exercises)
  if (evalSection.tieredExercises && evalSection.tieredExercises.length > 0) {
    elements.push(
      new Paragraph({
        spacing: { before: 300, after: 120 },
        children: [
          new TextRun({
            text: '3. Evaluación Formativa Escalonada por Niveles de Dominio Cognitivo:',
            bold: true,
            size: 26,
            color: C.navy,
            font: 'Arial',
          }),
        ],
      })
    );

    for (const tier of evalSection.tieredExercises || []) {
      const isBasico = tier.level === 'basico' || (tier.level as string) === 'básico';
      const isIntermedio = tier.level === 'intermedio';
      const tierColor =
        isBasico ? C.midBlue : isIntermedio ? C.gold : C.navy;
      const lvlLabel = (tier.levelName || (tier.level ? `Nivel ${tier.level}` : 'Nivel')).toUpperCase();

      elements.push(
        new Paragraph({
          spacing: { before: 180, after: 60 },
          children: [
            new TextRun({
              text: `▸ ${lvlLabel}`,
              bold: true,
              size: 22,
              color: tierColor,
              font: 'Calibri',
            }),
          ],
        })
      );

      if (tier.description) {
        elements.push(
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({
                text: tier.description,
                italics: true,
                size: 20,
                color: C.mutedText,
                font: 'Calibri',
              }),
            ],
          })
        );
      }

      for (let i = 0; i < (tier.exercises || []).length; i++) {
        const normEx = resolveExercise(tier.exercises[i], i + 1);

        elements.push(
          new Paragraph({
            spacing: { before: 100, after: 40 },
            children: [
              new TextRun({
                text: `Ejercicio ${normEx.number}: `,
                bold: true,
                size: 20,
                color: C.navy,
                font: 'Calibri',
              }),
              new TextRun({
                text: normEx.statement,
                size: 20,
                font: 'Calibri',
              }),
            ],
          })
        );

        if (normEx.contextOrData) {
          elements.push(
            new Paragraph({
              spacing: { after: 40 },
              children: [
                new TextRun({ text: 'Datos/Contexto: ', bold: true, size: 18, color: C.mutedText, font: 'Calibri' }),
                new TextRun({ text: normEx.contextOrData, size: 18, color: C.mutedText, font: 'Calibri' }),
              ],
            })
          );
        }

        if (normEx.hint) {
          elements.push(
            new Paragraph({
              spacing: { after: 40 },
              children: [
                new TextRun({ text: 'Pista: ', italics: true, bold: true, size: 18, color: C.midBlue, font: 'Calibri' }),
                new TextRun({ text: normEx.hint, italics: true, size: 18, color: C.midBlue, font: 'Calibri' }),
              ],
            })
          );
        }

        if (normEx.expectedOutputOrCriteria) {
          elements.push(
            new Paragraph({
              spacing: { after: 60 },
              children: [
                new TextRun({ text: 'Criterio esperado: ', bold: true, size: 18, color: C.darkText, font: 'Calibri' }),
                new TextRun({ text: normEx.expectedOutputOrCriteria, size: 18, color: C.darkText, font: 'Calibri' }),
              ],
            })
          );
        }

        // Renglones caligráficos para resolución
        const lineRows: TableRow[] = [];
        for (let l = 0; l < 3; l++) {
          lineRows.push(
            new TableRow({
              children: [
                new TableCell({
                  width: { size: CONTENT_W, type: WidthType.DXA },
                  borders: dottedBorder(),
                  margins: cellPadding(),
                  children: [new Paragraph({ spacing: { before: 80, after: 80 }, children: [] })],
                }),
              ],
            })
          );
        }
        elements.push(
          new Table({
            width: { size: CONTENT_W, type: WidthType.DXA },
            rows: lineRows,
          })
        );
      }
    }
  }

  // 4. Cuestionario de Juicio Crítico
  if (evalSection.criticalThinkingQuiz && evalSection.criticalThinkingQuiz.length > 0) {
    elements.push(
      new Paragraph({
        spacing: { before: 250, after: 100 },
        children: [
          new TextRun({
            text: '4. Cuestionario Formativo de Juicio Crítico y Transferencia:',
            bold: true,
            size: 24,
            color: C.navy,
            font: 'Arial',
          }),
        ],
      })
    );

    for (const q of evalSection.criticalThinkingQuiz) {
      elements.push(
        new Paragraph({
          spacing: { before: 100, after: 40 },
          children: [
            new TextRun({
              text: `Pregunta ${q.questionNumber}: `,
              bold: true,
              size: 20,
              color: C.navy,
              font: 'Calibri',
            }),
            new TextRun({
              text: q.question,
              size: 20,
              font: 'Calibri',
            }),
          ],
        })
      );

      if (q.scenario) {
        elements.push(
          new Paragraph({
            spacing: { after: 60 },
            children: [
              new TextRun({ text: 'Escenario: ', italics: true, bold: true, size: 18, color: C.mutedText, font: 'Calibri' }),
              new TextRun({ text: q.scenario, italics: true, size: 18, color: C.mutedText, font: 'Calibri' }),
            ],
          })
        );
      }

      // Renglones de respuesta
      const ansRows: TableRow[] = [];
      for (let l = 0; l < 3; l++) {
        ansRows.push(
          new TableRow({
            children: [
              new TableCell({
                width: { size: CONTENT_W, type: WidthType.DXA },
                borders: dottedBorder(),
                margins: cellPadding(),
                children: [new Paragraph({ spacing: { before: 80, after: 80 }, children: [] })],
              }),
            ],
          })
        );
      }
      elements.push(
        new Table({
          width: { size: CONTENT_W, type: WidthType.DXA },
          rows: ansRows,
        })
      );
    }
  }

  // 5. Reflexión Metacognitiva y Autoevaluación Formativa
  if (evalSection.metacognitiveReflection) {
    const meta = evalSection.metacognitiveReflection;
    const hasPrompts = meta.prompts && meta.prompts.length > 0;
    const hasScale = meta.selfAssessmentScale && meta.selfAssessmentScale.length > 0;

    if (hasPrompts || hasScale) {
      elements.push(
        new Paragraph({
          spacing: { before: 250, after: 100 },
          children: [
            new TextRun({
              text: '5. Reflexión Metacognitiva y Autoevaluación del Aprendiz:',
              bold: true,
              size: 24,
              color: C.navy,
              font: 'Arial',
            }),
          ],
        })
      );

      if (hasPrompts) {
        for (const prompt of meta.prompts) {
          elements.push(
            new Paragraph({
              spacing: { before: 100, after: 40 },
              children: [
                new TextRun({
                  text: `• ${prompt}`,
                  size: 20,
                  color: C.darkText,
                  font: 'Calibri',
                }),
              ],
            })
          );

          // 3 renglones de respuesta
          const metaRows: TableRow[] = [];
          for (let l = 0; l < 3; l++) {
            metaRows.push(
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: CONTENT_W, type: WidthType.DXA },
                    borders: dottedBorder(),
                    margins: cellPadding(),
                    children: [new Paragraph({ spacing: { before: 80, after: 80 }, children: [] })],
                  }),
                ],
              })
            );
          }
          elements.push(
            new Table({
              width: { size: CONTENT_W, type: WidthType.DXA },
              rows: metaRows,
            })
          );
        }
      }

      if (hasScale) {
        elements.push(
          new Paragraph({
            spacing: { before: 150, after: 80 },
            children: [
              new TextRun({
                text: 'Escala de Autovaloración Formativa (1: En desarrollo, 5: Dominio consolidado):',
                bold: true,
                size: 20,
                color: C.navy,
                font: 'Calibri',
              }),
            ],
          })
        );

        const scaleCols = [
          { title: 'Dimensión del Aprendizaje', w: Math.floor(CONTENT_W * 0.35) },
          { title: 'Criterio de Desempeño Autoevaluado', w: Math.floor(CONTENT_W * 0.45) },
          { title: 'Autovaloración', w: Math.floor(CONTENT_W * 0.20) },
        ];

        const scaleRows: TableRow[] = [
          new TableRow({
            children: scaleCols.map((col) =>
              cell(col.title, { w: col.w, bold: true, fill: C.navy, color: C.white })
            ),
          }),
        ];

        meta.selfAssessmentScale!.forEach((item) => {
          scaleRows.push(
            new TableRow({
              children: [
                cell(item.dimension, { bold: true }),
                cell(item.description),
                cell('[ 1 ]  [ 2 ]  [ 3 ]  [ 4 ]  [ 5 ]', { align: AlignmentType.CENTER }),
              ],
            })
          );
        });

        elements.push(
          new Table({
            width: { size: CONTENT_W, type: WidthType.DXA },
            rows: scaleRows,
          })
        );
      }
    }
  }

  return elements;
}
