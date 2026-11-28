/**
 * unified-editorial-docx-renderer.ts — Motor Editorial V2 DOCX (Paridad 1:1 con Typst 0.15.1 PDF)
 * SIGPDA-EMS · SEMS Puebla MCCEMS 2026-2027
 *
 * Consume el MISMO modelo canónico `StudentChapter` (`composeStudentSessionsFromWorkbooks` +
 * `enrichEditorialSessionsV2`) que compila el PDF Editorial V2 de ~132 páginas en Typst,
 * eliminando de raíz los defectos estructurales del generador Word legado (311 páginas,
 * tablas 70/30 con desbordes fuera de margen, páginas 70 % en blanco, diagramas sin texto
 * y doble espaciado `w:line="360"`).
 *
 * Garantías OOXML estrictas:
 *  1. TODA tabla usa `TableLayoutType.FIXED` + `columnWidths` cuya suma es exactamente `CONTENT_W` (10320 DXA).
 *  2. CERO tablas contenedoras 70/30 que dejan columnas vacías al cambiar de página.
 *  3. Tipografía editorial uniforme (`Calibri` 9.5 pt / `Arial` encabezados, interlineado compacto 1.08×,
 *     0 `Times New Roman`, 0 emojis tofu ni marcadores `[··]`).
 *  4. Diagramas pedagógicos enriquecidos (`embeddedDiagram`) rasterizados vía `@resvg/resvg-js`
 *     con fuentes TTF embebidas (100 % texto nítido, 0 cajas vacías).
 *  5. Espacios de cuaderno activo (`writing_lines`, `data_table`, `code_box`) dimensionados
 *     cómodamente a 100 % de ancho útil dentro de márgenes.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeightRule,
  ImageRun,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  type ISectionOptions,
} from 'docx';
import QRCode from 'qrcode';
import type { Planning } from '@/types/planning';
import type { ActiveWorkTextbook } from '@/types/work-textbook';
import { composeStudentSessionsFromWorkbooks } from './compose-student-sessions';
import { enrichEditorialSessionsV2 } from './editorial-v2-enricher';
import { resolveEditorialDisciplinaryUi } from './disciplinary-ui';
import {
  StudentChapterSchema,
  type ActiveSpaceItem,
  type ContenidoBloque,
  type StudentChapter,
  type StudentEvaluationSection,
  type StudentMissionFraming,
  type StudentProjectSection,
  type StudentSession,
} from './student-content-model';
import { normalizeEditorialText } from './text-normalization';
import {
  allocateEditorialSceneOnDisk,
  extractMissionPrimaryTopicForScene,
} from '@/lib/visual-engine/scene-allocator';
import {
  createNodeSceneDataUriReader,
  createNodeSceneFileExists,
  ensureCroppedPngDataUri,
} from '@/lib/visual-engine/scene-allocator-node';
import { svgToPngBuffer } from '@/lib/visual-engine/svg-to-png';
import { extractSvgDimensions } from '@/lib/visual-engine/svg-dimensions';
import {
  resolveSchoolIdentity,
  PLANTEL_NO_REGISTRADO,
  CCT_NO_REGISTRADO,
  type SchoolIdentitySource,
} from '@/lib/school-identity';
import { renderWorkbookToDocx } from '@/lib/docx-workbook-renderer';
import { SCHOOL_YEAR } from '@/lib/config';
import { getRuntimePlatformName } from '@/lib/platform/platform-name-shared';
import { getVerificationUrl } from '@/lib/digital-signature';
import { logger } from '@/lib/logger';

// ── Geometría Carta US Editorial (paridad exacta con workbook-template.typ) ──
const PAGE_W = 12240;     // 8.5 in (215.9 mm)
const PAGE_H = 15840;     // 11.0 in (279.4 mm)
const MARGIN_X = 960;     // ~1.69 cm por lado
const MARGIN_Y = 860;     // ~1.52 cm superior/inferior
const CONTENT_W = PAGE_W - MARGIN_X * 2; // 10320 DXA (≈ 18.2 cm ≈ 688 px @96dpi)

const BODY_FONT = 'Calibri';
const HEADING_FONT = 'Arial';
const CODE_FONT = 'Consolas';

// Ritmo editorial compacto (~130–145 páginas para 54 sesiones, paridad con Typst 132 págs)
const BODY_SPACING = { before: 0, after: 55, line: 256 } as const; // ~1.07×, 2.75pt tras párrafo
const CALLOUT_SPACING = { before: 0, after: 40, line: 248 } as const;

const COLORS = {
  secondary: '801124',   // Guinda SEP Puebla
  slateDark: '1E293B',
  slateMuted: '475569',
  bgCard: 'F8FAFC',
  border: 'CBD5E1',
  borderSoft: 'E2E8F0',
  goldBg: 'FEFCE8',
  purpleBg: 'FAF5FF',
  purpleBorder: '9333EA',
  purpleDark: '7E22CE',
  greenBg: 'F0FDF4',
  greenBorder: '16A34A',
  greenDark: '166534',
  orangeBg: 'FFF7ED',
  orangeBorder: 'EA580C',
  blueBg: 'EFF6FF',
  blueBorder: '2563EB',
  blueDark: '1D4ED8',
  amberDark: 'B45309',
  redDark: '991B1B',
  white: 'FFFFFF',
};

const docxV2SceneFileExists = createNodeSceneFileExists();
const docxV2SceneDataUriReader = createNodeSceneDataUriReader();
const docxV2CroppedSceneCache = new Map<string, Buffer>();

export interface UnifiedDocxBlockDividerSpec {
  blockNumber: number;
  blockName: string;
  startSession: number;
  missions: StudentMissionFraming[];
  coverScene?: {
    id: string;
    relativePath: string;
    alt: string;
  };
}

export interface UnifiedDocxRenderOptions {
  /** Portadillas separadoras por bloque para libros semestrales multi-bloque (Bloques I, II, III). */
  blockDividers?: UnifiedDocxBlockDividerSpec[];
  /** Nombre del docente titular para portada y créditos. */
  teacherName?: string;
  /** Proyecto PAEC principal para ficha de portada. */
  paecProjectName?: string;
  /** Subsistema educativo (BGE / BT). */
  subsystem?: string;
}

export interface UnifiedEditorialDocxCompileParams {
  planningId: string;
  planning: Planning;
  /** Si se indica (0, 1 o 2), compila solo ese bloque; omitido = compendio semestral completo. */
  blockIndex?: number;
  /** Mapa `block_N -> { current: ActiveWorkTextbook }` disponible en BD. */
  workbooksMap: Record<string, { current?: ActiveWorkTextbook } | undefined>;
  /** Libro ya armado para fallback transparente al generador clásico si no hay `sessionPlans`. */
  fallbackWorkbook: ActiveWorkTextbook;
  /** Datos escolares del perfil docente como respaldo si `sectionI` no los contiene. */
  teacherIdentity?: {
    schoolName?: string | null;
    cct?: string | null;
    schoolZone?: string | null;
  };
}

export type UnifiedDocxEngine = 'editorial_v2_docx' | 'legacy_docx_fallback';

export interface UnifiedEditorialDocxCompileResult {
  docxBuffer: Buffer;
  engine: UnifiedDocxEngine;
  sessionCount: number;
  missionCount: number;
  fallbackReason?: string;
}

// ── Helpers OOXML puros y de ancho fijo garantizado ──────────────────────────

function hexClean(hex: string | undefined, fallback: string): string {
  const cleaned = (hex || '').replace(/^#/, '').trim().toUpperCase();
  return /^[0-9A-F]{6}$/.test(cleaned) ? cleaned : fallback;
}

function cleanText(raw?: string | null): string {
  if (!raw) return '';
  return normalizeEditorialText(String(raw))
    // Eliminar emojis/símbolos que producen glifos rotos o `[··]` en Word
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatZonaEscolar(raw?: string | null): string {
  const v = (raw ?? '').trim();
  if (!v) return 'Zona Escolar EMS Puebla';
  if (/^zona\b/i.test(v)) return v;
  if (/^\d{2,4}$/.test(v)) return `Zona ${v}`;
  return v;
}

function romanNumeral(n: number): string {
  if (n === 1) return 'I';
  if (n === 2) return 'II';
  if (n === 3) return 'III';
  if (n === 4) return 'IV';
  return String(n);
}

function borderSpec(color: string, size = 4, style: (typeof BorderStyle)[keyof typeof BorderStyle] = BorderStyle.SINGLE) {
  return { style, size, color };
}

function noBorders() {
  const none = { style: BorderStyle.NONE, size: 0, color: 'auto' };
  return { top: none, bottom: none, left: none, right: none };
}

function uniformBorders(color = COLORS.border, size = 4) {
  const b = borderSpec(color, size);
  return { top: b, bottom: b, left: b, right: b };
}

function normalizeColumnWidths(widths: number[], targetTotal = CONTENT_W): number[] {
  if (widths.length === 0) return [targetTotal];
  const sum = widths.reduce((a, b) => a + b, 0);
  if (sum === targetTotal) return widths;
  const scaled = widths.map((w) => Math.max(400, Math.floor((w / sum) * targetTotal)));
  const diff = targetTotal - scaled.reduce((a, b) => a + b, 0);
  scaled[scaled.length - 1] += diff;
  return scaled;
}

function fixedTable(
  columnWidths: number[],
  rows: TableRow[],
  options: {
    totalWidth?: number;
    borders?: {
      top?: ReturnType<typeof borderSpec>;
      bottom?: ReturnType<typeof borderSpec>;
      left?: ReturnType<typeof borderSpec>;
      right?: ReturnType<typeof borderSpec>;
      insideHorizontal?: ReturnType<typeof borderSpec>;
      insideVertical?: ReturnType<typeof borderSpec>;
    };
  } = {},
): Table {
  const totalWidth = options.totalWidth ?? CONTENT_W;
  const cols = normalizeColumnWidths(columnWidths, totalWidth);
  return new Table({
    layout: TableLayoutType.FIXED,
    width: { size: totalWidth, type: WidthType.DXA },
    columnWidths: cols,
    borders: options.borders ?? {
      top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
      bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
      left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
      right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'auto' },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    },
    rows,
  });
}

function spacer(afterDxa = 70): Paragraph {
  return new Paragraph({
    spacing: { before: 0, after: afterDxa, line: 240 },
    children: [],
  });
}

function buildCalloutBox(params: {
  title?: string;
  bgColor: string;
  borderColor: string;
  titleColor?: string;
  bodyParagraphs: Paragraph[];
  widthDxa?: number;
  cantSplit?: boolean;
}): Table {
  const w = params.widthDxa ?? CONTENT_W;
  const children: Paragraph[] = [];
  if (params.title) {
    children.push(
      new Paragraph({
        spacing: { before: 0, after: 40, line: 240 },
        keepNext: true,
        children: [
          new TextRun({
            text: cleanText(params.title),
            bold: true,
            size: 19, // 9.5 pt
            color: params.titleColor ?? params.borderColor,
            font: HEADING_FONT,
          }),
        ],
      }),
    );
  }
  children.push(...params.bodyParagraphs);

  return fixedTable(
    [w],
    [
      new TableRow({
        cantSplit: params.cantSplit ?? false,
        children: [
          new TableCell({
            width: { size: w, type: WidthType.DXA },
            shading: { fill: params.bgColor, type: ShadingType.CLEAR },
            borders: {
              top: borderSpec(COLORS.borderSoft, 4),
              bottom: borderSpec(COLORS.borderSoft, 4),
              right: borderSpec(COLORS.borderSoft, 4),
              left: borderSpec(params.borderColor, 24), // Barra izquierda 3 pt
            },
            margins: { top: 80, bottom: 80, left: 140, right: 120 },
            children,
          }),
        ],
      }),
    ],
    { totalWidth: w },
  );
}

function simpleBodyParagraph(
  text: string,
  opts: {
    bold?: boolean;
    italics?: boolean;
    color?: string;
    size?: number;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    after?: number;
    before?: number;
    font?: string;
    keepNext?: boolean;
  } = {},
): Paragraph {
  return new Paragraph({
    alignment: opts.align ?? AlignmentType.JUSTIFIED,
    keepNext: opts.keepNext,
    spacing: {
      before: opts.before ?? 0,
      after: opts.after ?? BODY_SPACING.after,
      line: BODY_SPACING.line,
    },
    children: [
      new TextRun({
        text: cleanText(text),
        bold: opts.bold,
        italics: opts.italics,
        color: opts.color ?? COLORS.slateDark,
        size: opts.size ?? 19, // 9.5 pt
        font: opts.font ?? BODY_FONT,
      }),
    ],
  });
}

async function loadCroppedScenePng(
  relativePath: string | undefined,
  widthPx: number,
  heightPx: number,
): Promise<Buffer | null> {
  if (!relativePath) return null;
  try {
    const cacheKey = `${relativePath}|${widthPx}x${heightPx}`;
    const cached = docxV2CroppedSceneCache.get(cacheKey);
    if (cached) return cached;

    if (!docxV2SceneFileExists(relativePath)) return null;
    const dataUri = docxV2SceneDataUriReader(relativePath);
    if (!dataUri) return null;

    const pngUri = await ensureCroppedPngDataUri(dataUri, widthPx, heightPx);
    const match = /^data:image\/png;base64,(.+)$/i.exec(pngUri);
    if (!match?.[1]) return null;
    const buf = Buffer.from(match[1], 'base64');
    docxV2CroppedSceneCache.set(cacheKey, buf);
    return buf;
  } catch (err) {
    logger.warn('[unified-editorial-docx] No se pudo cargar escena recortada:', { relativePath, err });
    return null;
  }
}

function readMaterialImageFromPublic(filename: string): Buffer | null {
  try {
    const safeName = path.basename(filename);
    const absPath = path.join(process.cwd(), 'public', 'images', 'materiales', safeName);
    if (!fs.existsSync(absPath)) return null;
    return fs.readFileSync(absPath);
  } catch {
    return null;
  }
}

// ── Constructores de bloques editoriales (paridad 1:1 con workbook-template.typ) ──

async function buildV2CoverSection(
  chapter: StudentChapter,
  palette: { primary: string; accent: string; teal: string; tealBg: string },
  options: UnifiedDocxRenderOptions,
): Promise<(Paragraph | Table)[]> {
  const elements: (Paragraph | Table)[] = [];
  const coverPng = await loadCroppedScenePng(chapter.coverScene?.relativePath, 1080, 540);

  // Franja institucional superior (2 columnas fijas: 7720 + 2600 = 10320)
  elements.push(
    fixedTable(
      [7720, 2600],
      [
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              width: { size: 7720, type: WidthType.DXA },
              borders: noBorders(),
              margins: { top: 20, bottom: 20, left: 0, right: 80 },
              children: [
                new Paragraph({
                  spacing: { before: 0, after: 20 },
                  children: [
                    new TextRun({
                      text: 'GOBIERNO DEL ESTADO DE PUEBLA · SECRETARÍA DE EDUCACIÓN PÚBLICA',
                      bold: true,
                      size: 17,
                      color: COLORS.secondary,
                      font: HEADING_FONT,
                    }),
                  ],
                }),
                new Paragraph({
                  spacing: { before: 0, after: 20 },
                  children: [
                    new TextRun({
                      text: 'SUBSECRETARÍA DE EDUCACIÓN MEDIA SUPERIOR · DIRECCIÓN DE BACHILLERATOS ESTATALES',
                      size: 15,
                      color: COLORS.slateMuted,
                      font: HEADING_FONT,
                    }),
                  ],
                }),
                new Paragraph({
                  spacing: { before: 0, after: 0 },
                  children: [
                    new TextRun({
                      text: cleanText(chapter.zonaEscolar),
                      bold: true,
                      size: 15,
                      color: palette.primary,
                      font: HEADING_FONT,
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 2600, type: WidthType.DXA },
              borders: noBorders(),
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 40, bottom: 40, left: 80, right: 80 },
              shading: { fill: COLORS.secondary, type: ShadingType.CLEAR },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 0, after: 0 },
                  children: [
                    new TextRun({
                      text: `MCCEMS ${chapter.cicloEscolar || SCHOOL_YEAR}`,
                      bold: true,
                      size: 17,
                      color: COLORS.white,
                      font: HEADING_FONT,
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    ),
    spacer(140),
  );

  // Barra decorativa tricolor (5160 + 3440 + 1720 = 10320)
  elements.push(
    fixedTable(
      [5160, 3440, 1720],
      [
        new TableRow({
          height: { value: 90, rule: HeightRule.EXACT },
          children: [
            new TableCell({
              width: { size: 5160, type: WidthType.DXA },
              shading: { fill: palette.primary, type: ShadingType.CLEAR },
              borders: noBorders(),
              children: [new Paragraph({ spacing: { before: 0, after: 0 }, children: [] })],
            }),
            new TableCell({
              width: { size: 3440, type: WidthType.DXA },
              shading: { fill: COLORS.secondary, type: ShadingType.CLEAR },
              borders: noBorders(),
              children: [new Paragraph({ spacing: { before: 0, after: 0 }, children: [] })],
            }),
            new TableCell({
              width: { size: 1720, type: WidthType.DXA },
              shading: { fill: palette.accent, type: ShadingType.CLEAR },
              borders: noBorders(),
              children: [new Paragraph({ spacing: { before: 0, after: 0 }, children: [] })],
            }),
          ],
        }),
      ],
    ),
    spacer(180),
  );

  // Título editorial principal
  elements.push(
    new Paragraph({
      spacing: { before: 0, after: 60 },
      children: [
        new TextRun({
          text: 'LIBRO DE TEXTO PARA EL ESTUDIANTE · CUADERNO DE APRENDIZAJE AUTÓNOMO',
          bold: true,
          size: 20,
          color: palette.accent,
          font: HEADING_FONT,
        }),
      ],
    }),
    new Paragraph({
      spacing: { before: 0, after: 80, line: 276 },
      children: [
        new TextRun({
          text: cleanText(chapter.uac),
          bold: true,
          size: 44, // 22 pt
          color: palette.primary,
          font: HEADING_FONT,
        }),
      ],
    }),
    new Paragraph({
      spacing: { before: 0, after: 60 },
      children: [
        new TextRun({
          text: cleanText(
            chapter.editorialSubtitle || 'Alineado al MCCEMS y Proyectos Aula Escuela Comunidad (PAEC)',
          ),
          size: 23,
          color: COLORS.secondary,
          font: BODY_FONT,
        }),
      ],
    }),
    new Paragraph({
      spacing: { before: 0, after: 160 },
      children: [
        new TextRun({
          text: cleanText(chapter.bloque),
          bold: true,
          size: 24,
          color: COLORS.slateDark,
          font: HEADING_FONT,
        }),
      ],
    }),
  );

  // Escena Editorial V2 de Portada (1080×540 → 620×310 px, 100 % dentro de 10320 DXA = 688 px)
  if (coverPng && chapter.coverScene) {
    elements.push(
      fixedTable(
        [CONTENT_W],
        [
          new TableRow({
            cantSplit: true,
            children: [
              new TableCell({
                width: { size: CONTENT_W, type: WidthType.DXA },
                shading: { fill: COLORS.white, type: ShadingType.CLEAR },
                borders: {
                  top: borderSpec(palette.accent, 8),
                  bottom: borderSpec(palette.accent, 8),
                  left: borderSpec(COLORS.border, 4),
                  right: borderSpec(COLORS.border, 4),
                },
                margins: { top: 80, bottom: 70, left: 80, right: 80 },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 0, after: 40 },
                    children: [
                      new ImageRun({
                        data: coverPng,
                        transformation: { width: 620, height: 310 },
                        type: 'png',
                      }),
                    ],
                  }),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 0, after: 0 },
                    children: [
                      new TextRun({
                        text: cleanText(chapter.coverScene.alt),
                        italics: true,
                        size: 16,
                        color: COLORS.slateMuted,
                        font: BODY_FONT,
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      ),
      spacer(180),
    );
  }

  // Ficha Técnica Escolar (2 columnas fijas: 5620 + 4700 = 10320)
  elements.push(
    fixedTable(
      [5620, 4700],
      [
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              width: { size: 5620, type: WidthType.DXA },
              shading: { fill: 'F1F5F9', type: ShadingType.CLEAR },
              borders: {
                top: borderSpec(COLORS.borderSoft, 4),
                bottom: borderSpec(COLORS.borderSoft, 4),
                left: borderSpec(palette.primary, 24),
                right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
              },
              margins: { top: 110, bottom: 110, left: 160, right: 100 },
              children: [
                new Paragraph({
                  spacing: { before: 0, after: 20 },
                  children: [new TextRun({ text: 'Plantel Educativo:', size: 16, color: COLORS.slateMuted, font: BODY_FONT })],
                }),
                new Paragraph({
                  spacing: { before: 0, after: 60 },
                  children: [new TextRun({ text: cleanText(chapter.plantel), bold: true, size: 20, color: palette.primary, font: HEADING_FONT })],
                }),
                new Paragraph({
                  spacing: { before: 0, after: 20 },
                  children: [new TextRun({ text: 'Clave de Centro de Trabajo (CCT):', size: 16, color: COLORS.slateMuted, font: BODY_FONT })],
                }),
                new Paragraph({
                  spacing: { before: 0, after: 0 },
                  children: [new TextRun({ text: cleanText(chapter.cct), bold: true, size: 18, color: COLORS.slateDark, font: BODY_FONT })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 4700, type: WidthType.DXA },
              shading: { fill: 'F1F5F9', type: ShadingType.CLEAR },
              borders: {
                top: borderSpec(COLORS.borderSoft, 4),
                bottom: borderSpec(COLORS.borderSoft, 4),
                left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                right: borderSpec(COLORS.borderSoft, 4),
              },
              margins: { top: 110, bottom: 110, left: 100, right: 140 },
              children: [
                new Paragraph({
                  spacing: { before: 0, after: 20 },
                  children: [new TextRun({ text: 'Semestre y Ciclo Escolar:', size: 16, color: COLORS.slateMuted, font: BODY_FONT })],
                }),
                new Paragraph({
                  spacing: { before: 0, after: 60 },
                  children: [
                    new TextRun({
                      text: `Semestre ${cleanText(String(chapter.semestre))} · ${cleanText(chapter.cicloEscolar)}`,
                      bold: true,
                      size: 20,
                      color: palette.primary,
                      font: HEADING_FONT,
                    }),
                  ],
                }),
                new Paragraph({
                  spacing: { before: 0, after: 20 },
                  children: [new TextRun({ text: 'Docente Titular:', size: 16, color: COLORS.slateMuted, font: BODY_FONT })],
                }),
                new Paragraph({
                  spacing: { before: 0, after: 0 },
                  children: [
                    new TextRun({
                      text: cleanText(options.teacherName || 'Academia Docente EMS'),
                      bold: true,
                      size: 18,
                      color: COLORS.slateDark,
                      font: BODY_FONT,
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    ),
    spacer(120),
  );

  // Recuadro de identificación del estudiante
  const studentRows: Paragraph[] = [
    new Paragraph({
      spacing: { before: 0, after: 50 },
      children: [
        new TextRun({ text: 'Estudiante: ', bold: true, size: 18, color: palette.primary, font: BODY_FONT }),
        new TextRun({ text: '________________________________________________________', size: 18, color: COLORS.slateMuted, font: BODY_FONT }),
      ],
    }),
    new Paragraph({
      spacing: { before: 0, after: 0 },
      children: [
        new TextRun({ text: 'Grupo: ', bold: true, size: 18, color: palette.primary, font: BODY_FONT }),
        new TextRun({ text: '____________   ', size: 18, color: COLORS.slateMuted, font: BODY_FONT }),
        new TextRun({ text: 'Turno: ', bold: true, size: 18, color: palette.primary, font: BODY_FONT }),
        new TextRun({ text: '____________   ', size: 18, color: COLORS.slateMuted, font: BODY_FONT }),
        ...(options.paecProjectName
          ? [
              new TextRun({ text: 'PAEC: ', bold: true, size: 17, color: palette.primary, font: BODY_FONT }),
              new TextRun({ text: cleanText(options.paecProjectName).slice(0, 60), italics: true, size: 17, color: COLORS.slateDark, font: BODY_FONT }),
            ]
          : []),
      ],
    }),
  ];
  elements.push(
    buildCalloutBox({
      bgColor: COLORS.white,
      borderColor: palette.accent,
      bodyParagraphs: studentRows,
      cantSplit: true,
    }),
    spacer(120),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      border: { top: borderSpec(COLORS.border, 4) },
      spacing: { before: 80, after: 0 },
      children: [
        new TextRun({
          text: `Edición Editorial Escolar · ${getRuntimePlatformName()} Motor Editorial V2 · PROHIBIDA SU REPRODUCCIÓN CON FINES DE LUCRO`,
          size: 15,
          color: COLORS.slateMuted,
          font: BODY_FONT,
        }),
      ],
    }),
  );

  return elements;
}

function buildV2PreliminarySection(
  chapter: StudentChapter,
  palette: { primary: string; accent: string; teal: string; tealBg: string },
): (Paragraph | Table)[] {
  const labels = chapter.disciplinaUi?.labels;
  const elements: (Paragraph | Table)[] = [
    new Paragraph({
      spacing: { before: 40, after: 40 },
      keepNext: true,
      children: [
        new TextRun({
          text: 'Contenido del Libro y Metodología Autodidacta',
          bold: true,
          size: 30, // 15 pt
          color: palette.primary,
          font: HEADING_FONT,
        }),
      ],
    }),
    new Paragraph({
      spacing: { before: 0, after: 100 },
      border: { bottom: borderSpec(palette.accent, 10) },
      children: [
        new TextRun({
          text: `${cleanText(chapter.uac)} · ${cleanText(chapter.bloque)}`,
          size: 19,
          color: COLORS.secondary,
          font: BODY_FONT,
        }),
      ],
    }),
    spacer(80),
  ];

  const bulletItem = (label: string, desc: string): Paragraph =>
    new Paragraph({
      spacing: { before: 0, after: 35, line: 248 },
      children: [
        new TextRun({ text: '• ', bold: true, size: 18, color: COLORS.blueDark, font: BODY_FONT }),
        new TextRun({ text: `${label}: `, bold: true, size: 18, color: COLORS.slateDark, font: BODY_FONT }),
        new TextRun({ text: cleanText(desc), size: 18, color: COLORS.slateDark, font: BODY_FONT }),
      ],
    });

  elements.push(
    buildCalloutBox({
      title: '¿Cómo aprender con este libro de texto?',
      bgColor: COLORS.blueBg,
      borderColor: COLORS.blueBorder,
      titleColor: COLORS.blueDark,
      cantSplit: true,
      bodyParagraphs: [
        simpleBodyParagraph(
          'Este cuaderno de aprendizaje activo está estructurado para que construyas tu conocimiento paso a paso. Cada sesión incluye:',
          { size: 18, after: 45 },
        ),
        bulletItem('Objetivo y Saberes Previos', 'La meta concreta de aprendizaje que alcanzarás y tus puntos de partida.'),
        bulletItem('Punto de Partida (PAEC)', 'Un reto real de tu comunidad escolar en Puebla para conectar teoría y entorno.'),
        bulletItem(
          'Desarrollo Conceptual',
          labels?.methodologyTheoryBullet || 'Conceptos clave, definiciones rigurosas, diagramas y explicaciones claras.',
        ),
        bulletItem(
          'Ejemplo Resuelto Paso a Paso',
          labels?.methodologyExampleBullet || 'Casos y procedimientos aplicados paso a paso para observar el criterio en contexto.',
        ),
        bulletItem('Ponte a Prueba y Espacios Activos', 'Ejercicios con pistas estratégicas y cuadros diseñados para trabajar directo en tu libro.'),
        bulletItem('Conexión Comunitaria y Autoverificación', 'Avance de tu producto integrador y lista de cotejo personal.'),
      ],
    }),
    spacer(140),
    new Paragraph({
      spacing: { before: 0, after: 70 },
      keepNext: true,
      children: [
        new TextRun({
          text: `Mapa de Sesiones de Aprendizaje (${chapter.sesiones.length} sesiones)`,
          bold: true,
          size: 22,
          color: palette.primary,
          font: HEADING_FONT,
        }),
      ],
    }),
  );

  // Tabla fija compacta del Mapa de Sesiones (920 + 9400 = 10320 DXA)
  const tocRows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      cantSplit: true,
      children: [
        new TableCell({
          width: { size: 920, type: WidthType.DXA },
          shading: { fill: palette.primary, type: ShadingType.CLEAR },
          borders: uniformBorders(palette.primary, 4),
          margins: { top: 55, bottom: 55, left: 70, right: 70 },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 0, after: 0 },
              children: [new TextRun({ text: 'Sesión', bold: true, size: 16, color: COLORS.white, font: HEADING_FONT })],
            }),
          ],
        }),
        new TableCell({
          width: { size: 9400, type: WidthType.DXA },
          shading: { fill: palette.primary, type: ShadingType.CLEAR },
          borders: uniformBorders(palette.primary, 4),
          margins: { top: 55, bottom: 55, left: 100, right: 100 },
          children: [
            new Paragraph({
              spacing: { before: 0, after: 0 },
              children: [new TextRun({ text: 'Tema y Meta de Aprendizaje', bold: true, size: 16, color: COLORS.white, font: HEADING_FONT })],
            }),
          ],
        }),
      ],
    }),
    ...chapter.sesiones.map((s, idx) => {
      const rowFill = idx % 2 === 0 ? COLORS.white : COLORS.bgCard;
      return new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: 920, type: WidthType.DXA },
            shading: { fill: rowFill, type: ShadingType.CLEAR },
            borders: uniformBorders(COLORS.borderSoft, 4),
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 40, bottom: 40, left: 60, right: 60 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 0 },
                children: [new TextRun({ text: `S-${s.numero}`, bold: true, size: 16, color: palette.primary, font: HEADING_FONT })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 9400, type: WidthType.DXA },
            shading: { fill: rowFill, type: ShadingType.CLEAR },
            borders: uniformBorders(COLORS.borderSoft, 4),
            margins: { top: 40, bottom: 40, left: 100, right: 100 },
            children: [
              new Paragraph({
                spacing: { before: 0, after: 15, line: 240 },
                children: [new TextRun({ text: cleanText(s.titulo), bold: true, size: 17, color: COLORS.slateDark, font: BODY_FONT })],
              }),
              new Paragraph({
                spacing: { before: 0, after: 0, line: 236 },
                children: [new TextRun({ text: cleanText(s.objetivo), size: 15, color: COLORS.slateMuted, font: BODY_FONT })],
              }),
            ],
          }),
        ],
      });
    }),
  ];

  elements.push(fixedTable([920, 9400], tocRows));
  return elements;
}

async function buildV2BlockDividerPage(
  spec: UnifiedDocxBlockDividerSpec,
  uacName: string,
  palette: { primary: string; accent: string; teal: string; tealBg: string },
): Promise<(Paragraph | Table)[]> {
  const roman = romanNumeral(spec.blockNumber);
  const coverPng = await loadCroppedScenePng(spec.coverScene?.relativePath, 1080, 540);
  const elements: (Paragraph | Table)[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 180, after: 60 },
      children: [
        new TextRun({
          text: `${cleanText(uacName).toUpperCase()} · MCCEMS PUEBLA`,
          bold: true,
          size: 17,
          color: palette.teal,
          font: HEADING_FONT,
        }),
      ],
    }),
    fixedTable(
      [CONTENT_W],
      [
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              width: { size: CONTENT_W, type: WidthType.DXA },
              shading: { fill: palette.primary, type: ShadingType.CLEAR },
              borders: {
                top: borderSpec(palette.primary, 8),
                bottom: borderSpec(palette.accent, 24),
                left: borderSpec(palette.primary, 8),
                right: borderSpec(palette.primary, 8),
              },
              margins: { top: 180, bottom: 180, left: 200, right: 200 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 0, after: 50 },
                  children: [
                    new TextRun({
                      text: `BLOQUE FORMATIVO ${roman}`,
                      bold: true,
                      size: 36,
                      color: COLORS.white,
                      font: HEADING_FONT,
                    }),
                  ],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 0, after: 0 },
                  children: [
                    new TextRun({
                      text: cleanText(spec.blockName),
                      size: 22,
                      color: 'F1F5F9',
                      font: BODY_FONT,
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    ),
    spacer(160),
  ];

  if (coverPng && spec.coverScene) {
    elements.push(
      fixedTable(
        [CONTENT_W],
        [
          new TableRow({
            cantSplit: true,
            children: [
              new TableCell({
                width: { size: CONTENT_W, type: WidthType.DXA },
                shading: { fill: COLORS.white, type: ShadingType.CLEAR },
                borders: {
                  top: borderSpec(palette.accent, 8),
                  bottom: borderSpec(palette.accent, 8),
                  left: borderSpec(COLORS.border, 4),
                  right: borderSpec(COLORS.border, 4),
                },
                margins: { top: 80, bottom: 70, left: 80, right: 80 },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 0, after: 40 },
                    children: [
                      new ImageRun({
                        data: coverPng,
                        transformation: { width: 620, height: 310 },
                        type: 'png',
                      }),
                    ],
                  }),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 0, after: 0 },
                    children: [
                      new TextRun({
                        text: `Portadilla Bloque ${roman} · ${cleanText(spec.coverScene.alt)}`,
                        italics: true,
                        size: 16,
                        color: COLORS.slateMuted,
                        font: BODY_FONT,
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      ),
      spacer(160),
    );
  }

  if (spec.missions.length > 0) {
    const missionParas = spec.missions.map(
      (m) =>
        new Paragraph({
          spacing: { before: 0, after: 55, line: 252 },
          children: [
            new TextRun({
              text: `Misión ${m.missionIndex} (Sesiones ${m.startSession}–${m.endSession}): `,
              bold: true,
              size: 18,
              color: palette.primary,
              font: BODY_FONT,
            }),
            new TextRun({
              text: cleanText(m.title),
              size: 18,
              color: COLORS.slateDark,
              font: BODY_FONT,
            }),
          ],
        }),
    );

    elements.push(
      buildCalloutBox({
        title: `Ruta de Misiones del Bloque ${roman}`,
        bgColor: palette.tealBg,
        borderColor: palette.teal,
        titleColor: palette.primary,
        bodyParagraphs: missionParas,
        cantSplit: true,
      }),
    );
  }

  return elements;
}

async function buildV2MissionBanner(
  mission: StudentMissionFraming,
  palette: { primary: string; accent: string; teal: string; tealBg: string },
): Promise<(Paragraph | Table)[]> {
  const scenePng = await loadCroppedScenePng(mission.scene?.relativePath, 1080, 304);
  const hasScene = Boolean(scenePng && mission.scene);

  const leftParas: Paragraph[] = [
    new Paragraph({
      spacing: { before: 0, after: 35 },
      children: [
        new TextRun({
          text: `BLOQUE ${mission.blockNumber} · MISIÓN ${mission.missionIndex} · ${cleanText(mission.stageLabel).toUpperCase()}`,
          bold: true,
          size: 15,
          color: palette.accent,
          font: HEADING_FONT,
        }),
        new TextRun({
          text: `   |   Sesiones ${mission.startSession} a ${mission.endSession}`,
          size: 15,
          color: COLORS.slateMuted,
          font: BODY_FONT,
        }),
      ],
    }),
    new Paragraph({
      spacing: { before: 0, after: 35, line: 252 },
      children: [
        new TextRun({
          text: cleanText(mission.title),
          bold: true,
          size: 21, // 10.5 pt
          color: palette.primary,
          font: HEADING_FONT,
        }),
      ],
    }),
  ];

  if (mission.realLifeContext) {
    leftParas.push(
      new Paragraph({
        spacing: { before: 0, after: 0, line: 244 },
        children: [
          new TextRun({ text: 'Conexión con tu entorno: ', bold: true, size: 17, color: COLORS.slateDark, font: BODY_FONT }),
          new TextRun({ text: cleanText(mission.realLifeContext), size: 17, color: COLORS.slateDark, font: BODY_FONT }),
        ],
      }),
    );
  }

  if (hasScene && scenePng && mission.scene) {
    // 1080×304 banner completo arriba o lateral fijo: con banda panorámica 620×174 arriba
    // coincide con el SHA-1 1080×304 y evita comprimir la escena en una celda estrecha.
    return [
      fixedTable(
        [CONTENT_W],
        [
          new TableRow({
            cantSplit: true,
            children: [
              new TableCell({
                width: { size: CONTENT_W, type: WidthType.DXA },
                shading: { fill: palette.tealBg, type: ShadingType.CLEAR },
                borders: {
                  top: borderSpec(COLORS.border, 4),
                  bottom: borderSpec(palette.teal, 6),
                  right: borderSpec(COLORS.border, 4),
                  left: borderSpec(palette.accent, 24),
                },
                margins: { top: 80, bottom: 80, left: 130, right: 120 },
                children: [
                  ...leftParas,
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 70, after: 25 },
                    children: [
                      new ImageRun({
                        data: scenePng,
                        transformation: { width: 620, height: 174 },
                        type: 'png',
                      }),
                    ],
                  }),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 0, after: 0 },
                    children: [
                      new TextRun({
                        text: `Escena de apertura · ${cleanText(mission.scene.alt)}`,
                        italics: true,
                        size: 14,
                        color: COLORS.slateMuted,
                        font: BODY_FONT,
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      ),
      spacer(80),
    ];
  }

  return [
    buildCalloutBox({
      bgColor: palette.tealBg,
      borderColor: palette.accent,
      bodyParagraphs: leftParas,
      cantSplit: true,
    }),
    spacer(80),
  ];
}

function buildActiveSpaceBlock(
  sp: ActiveSpaceItem,
  palette: { primary: string; accent: string; teal: string; tealBg: string },
): (Paragraph | Table)[] {
  if (sp.kind === 'data_table') {
    const headers = sp.headers && sp.headers.length >= 2 ? sp.headers : ['Elemento / Variable', 'Observación / Dato', 'Interpretación'];
    const rowCount = Math.max(2, Math.min(sp.rows ?? 3, 7));
    const colW = Math.floor(CONTENT_W / headers.length);
    const colWidths = headers.map((_, idx) =>
      idx === headers.length - 1 ? CONTENT_W - colW * (headers.length - 1) : colW,
    );

    const headerRow = new TableRow({
      tableHeader: true,
      cantSplit: true,
      children: headers.map((h, idx) =>
        new TableCell({
          width: { size: colWidths[idx]!, type: WidthType.DXA },
          shading: { fill: 'E2E8F0', type: ShadingType.CLEAR },
          borders: uniformBorders(COLORS.border, 4),
          margins: { top: 60, bottom: 60, left: 90, right: 90 },
          children: [
            new Paragraph({
              spacing: { before: 0, after: 0 },
              children: [
                new TextRun({
                  text: cleanText(h),
                  bold: true,
                  size: 17,
                  color: palette.primary,
                  font: HEADING_FONT,
                }),
              ],
            }),
          ],
        }),
      ),
    });

    const emptyRows = Array.from({ length: rowCount }, () =>
      new TableRow({
        cantSplit: true,
        height: { value: 380, rule: HeightRule.ATLEAST },
        children: colWidths.map((w) =>
          new TableCell({
            width: { size: w, type: WidthType.DXA },
            shading: { fill: COLORS.white, type: ShadingType.CLEAR },
            borders: uniformBorders(COLORS.border, 4),
            margins: { top: 60, bottom: 60, left: 80, right: 80 },
            children: [new Paragraph({ spacing: { before: 0, after: 0 }, children: [] })],
          }),
        ),
      }),
    );

    return [
      new Paragraph({
        spacing: { before: 50, after: 35 },
        keepNext: true,
        children: [
          new TextRun({
            text: cleanText(sp.title),
            bold: true,
            size: 18,
            color: palette.primary,
            font: HEADING_FONT,
          }),
        ],
      }),
      fixedTable(colWidths, [headerRow, ...emptyRows]),
      spacer(70),
    ];
  }

  if (sp.kind === 'code_box') {
    const langLabel = (sp.language || 'pseudocodigo').toUpperCase();
    const lineRows = Array.from({ length: 4 }, (_, idx) =>
      new TableRow({
        cantSplit: true,
        height: { value: 340, rule: HeightRule.ATLEAST },
        children: [
          new TableCell({
            width: { size: CONTENT_W, type: WidthType.DXA },
            shading: { fill: COLORS.bgCard, type: ShadingType.CLEAR },
            borders: {
              top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
              bottom: idx === 3 ? borderSpec(COLORS.border, 6) : borderSpec(COLORS.border, 4, BorderStyle.DASHED),
              left: borderSpec(palette.teal, 20),
              right: borderSpec(COLORS.border, 4),
            },
            margins: { top: 40, bottom: 40, left: 130, right: 120 },
            children: [new Paragraph({ spacing: { before: 0, after: 0 }, children: [] })],
          }),
        ],
      }),
    );

    const headerChildren: Paragraph[] = [
      new Paragraph({
        spacing: { before: 0, after: sp.starterCode ? 40 : 0 },
        children: [
          new TextRun({ text: cleanText(sp.title), bold: true, size: 18, color: palette.teal, font: HEADING_FONT }),
          new TextRun({ text: `   [${langLabel}]`, bold: true, size: 15, color: COLORS.slateMuted, font: CODE_FONT }),
        ],
      }),
    ];
    if (sp.starterCode?.trim()) {
      headerChildren.push(
        new Paragraph({
          spacing: { before: 20, after: 0, line: 240 },
          children: [
            new TextRun({
              text: sp.starterCode.trim(),
              size: 16,
              color: COLORS.slateDark,
              font: CODE_FONT,
            }),
          ],
        }),
      );
    }

    return [
      fixedTable(
        [CONTENT_W],
        [
          new TableRow({
            cantSplit: true,
            children: [
              new TableCell({
                width: { size: CONTENT_W, type: WidthType.DXA },
                shading: { fill: 'F1F5F9', type: ShadingType.CLEAR },
                borders: {
                  top: borderSpec(COLORS.border, 6),
                  bottom: borderSpec(COLORS.border, 4),
                  left: borderSpec(palette.teal, 20),
                  right: borderSpec(COLORS.border, 4),
                },
                margins: { top: 70, bottom: 70, left: 130, right: 120 },
                children: headerChildren,
              }),
            ],
          }),
          ...lineRows,
        ],
      ),
      spacer(70),
    ];
  }

  // Default: `writing_lines` — cuadro de escritura activo bien dimensionado (4–6 renglones holgados)
  const lineCount = Math.max(3, Math.min(sp.lines ?? 4, 7));
  const titleRow = new TableRow({
    cantSplit: true,
    children: [
      new TableCell({
        width: { size: CONTENT_W, type: WidthType.DXA },
        shading: { fill: COLORS.bgCard, type: ShadingType.CLEAR },
        borders: {
          top: borderSpec(COLORS.border, 6),
          bottom: borderSpec(COLORS.borderSoft, 4),
          left: borderSpec(palette.primary, 16),
          right: borderSpec(COLORS.border, 6),
        },
        margins: { top: 65, bottom: 65, left: 130, right: 120 },
        children: [
          new Paragraph({
            spacing: { before: 0, after: 0 },
            children: [
              new TextRun({
                text: cleanText(sp.title || 'Espacio de Trabajo del Estudiante'),
                bold: true,
                size: 18,
                color: palette.primary,
                font: HEADING_FONT,
              }),
            ],
          }),
        ],
      }),
    ],
  });

  const writingRows = Array.from({ length: lineCount }, (_, idx) =>
    new TableRow({
      cantSplit: true,
      height: { value: 360, rule: HeightRule.ATLEAST }, // ~6.4 mm por renglón para escritura cómoda a mano
      children: [
        new TableCell({
          width: { size: CONTENT_W, type: WidthType.DXA },
          shading: { fill: COLORS.white, type: ShadingType.CLEAR },
          borders: {
            top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
            bottom:
              idx === lineCount - 1
                ? borderSpec(COLORS.border, 6)
                : borderSpec(COLORS.border, 4, BorderStyle.DOTTED),
            left: borderSpec(palette.primary, 16),
            right: borderSpec(COLORS.border, 6),
          },
          margins: { top: 40, bottom: 40, left: 130, right: 120 },
          children: [new Paragraph({ spacing: { before: 0, after: 0 }, children: [] })],
        }),
      ],
    }),
  );

  return [fixedTable([CONTENT_W], [titleRow, ...writingRows]), spacer(70)];
}

async function buildV2SessionSection(
  s: StudentSession,
  chapter: StudentChapter,
  palette: { primary: string; accent: string; teal: string; tealBg: string },
): Promise<(Paragraph | Table)[]> {
  const labels = chapter.disciplinaUi?.labels;
  const conceptHeading = labels?.conceptHeading || 'Conceptos Fundamentales y Desarrollo Teórico';
  const exampleHeading = labels?.exampleHeading || 'Ejemplo Resuelto Paso a Paso';
  const sidenoteTitle = labels?.sidenoteTitle || 'Glosario Clave';

  const elements: (Paragraph | Table)[] = [];

  // 1. Encabezado de Sesión (Full Width fijo: 1420 + 8900 = 10320 DXA)
  elements.push(
    fixedTable(
      [1420, 8900],
      [
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              width: { size: 1420, type: WidthType.DXA },
              shading: { fill: palette.accent, type: ShadingType.CLEAR },
              borders: uniformBorders(palette.primary, 4),
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 65, bottom: 65, left: 70, right: 70 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 0, after: 0 },
                  keepNext: true,
                  children: [
                    new TextRun({
                      text: `SESIÓN ${s.numero}`,
                      bold: true,
                      size: 19,
                      color: palette.primary,
                      font: HEADING_FONT,
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 8900, type: WidthType.DXA },
              shading: { fill: palette.primary, type: ShadingType.CLEAR },
              borders: uniformBorders(palette.primary, 4),
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 65, bottom: 65, left: 120, right: 110 },
              children: [
                new Paragraph({
                  spacing: { before: 0, after: 0, line: 248 },
                  keepNext: true,
                  children: [
                    new TextRun({
                      text: cleanText(s.titulo),
                      bold: true,
                      size: 21, // 10.5 pt
                      color: COLORS.white,
                      font: HEADING_FONT,
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    ),
    spacer(65),
  );

  // 2. Objetivo y Saberes Previos (fila compacta fija: 5920 + 4400 = 10320 DXA, cantSplit)
  elements.push(
    fixedTable(
      [5920, 4400],
      [
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              width: { size: 5920, type: WidthType.DXA },
              shading: { fill: COLORS.greenBg, type: ShadingType.CLEAR },
              borders: {
                top: borderSpec(COLORS.borderSoft, 4),
                bottom: borderSpec(COLORS.borderSoft, 4),
                right: borderSpec(COLORS.white, 16),
                left: borderSpec(COLORS.greenBorder, 24),
              },
              margins: { top: 65, bottom: 65, left: 120, right: 110 },
              children: [
                new Paragraph({
                  spacing: { before: 0, after: 25 },
                  children: [
                    new TextRun({
                      text: 'Lo que vas a aprender hoy (Objetivo)',
                      bold: true,
                      size: 18,
                      color: COLORS.greenDark,
                      font: HEADING_FONT,
                    }),
                  ],
                }),
                new Paragraph({
                  alignment: AlignmentType.JUSTIFIED,
                  spacing: CALLOUT_SPACING,
                  children: [new TextRun({ text: cleanText(s.objetivo), size: 18, color: COLORS.slateDark, font: BODY_FONT })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 4400, type: WidthType.DXA },
              shading: { fill: COLORS.bgCard, type: ShadingType.CLEAR },
              borders: {
                top: borderSpec(COLORS.borderSoft, 4),
                bottom: borderSpec(COLORS.borderSoft, 4),
                right: borderSpec(COLORS.borderSoft, 4),
                left: borderSpec(COLORS.slateMuted, 24),
              },
              margins: { top: 65, bottom: 65, left: 120, right: 100 },
              children: [
                new Paragraph({
                  spacing: { before: 0, after: 25 },
                  children: [
                    new TextRun({
                      text: 'Saberes que ya tienes',
                      bold: true,
                      size: 18,
                      color: COLORS.slateMuted,
                      font: HEADING_FONT,
                    }),
                  ],
                }),
                new Paragraph({
                  alignment: AlignmentType.JUSTIFIED,
                  spacing: CALLOUT_SPACING,
                  children: [new TextRun({ text: cleanText(s.saberesPrevios), size: 18, color: COLORS.slateDark, font: BODY_FONT })],
                }),
              ],
            }),
          ],
        }),
      ],
    ),
    spacer(65),
  );

  // 3. Punto de Partida (Motivación PAEC)
  elements.push(
    buildCalloutBox({
      title: 'Punto de Partida: ¿Por qué importa esto en tu comunidad?',
      bgColor: COLORS.goldBg,
      borderColor: palette.accent,
      titleColor: COLORS.amberDark,
      cantSplit: true,
      bodyParagraphs: [simpleBodyParagraph(s.motivacion, { size: 18, after: 0 })],
    }),
    spacer(75),
  );

  // 4. Desarrollo Conceptual (100 % ancho útil — CERO columnas rotas ni páginas 70% blancas)
  elements.push(
    new Paragraph({
      spacing: { before: 20, after: 45 },
      keepNext: true,
      children: [
        new TextRun({
          text: cleanText(conceptHeading),
          bold: true,
          size: 20,
          color: palette.primary,
          font: HEADING_FONT,
        }),
      ],
    }),
  );

  const renderContentBlock = (bloque: ContenidoBloque): (Paragraph | Table)[] => {
    if (bloque.tipo === 'formula' && bloque.texto) {
      return [
        fixedTable(
          [CONTENT_W],
          [
            new TableRow({
              cantSplit: true,
              children: [
                new TableCell({
                  width: { size: CONTENT_W, type: WidthType.DXA },
                  shading: { fill: 'F1F5F9', type: ShadingType.CLEAR },
                  borders: uniformBorders(COLORS.border, 4),
                  margins: { top: 60, bottom: 60, left: 120, right: 120 },
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      spacing: { before: 0, after: 0 },
                      children: [
                        ...(bloque.titulo
                          ? [new TextRun({ text: `${cleanText(bloque.titulo)}: `, bold: true, size: 19, color: palette.primary, font: HEADING_FONT })]
                          : []),
                        new TextRun({ text: cleanText(bloque.texto), bold: true, size: 19, color: palette.primary, font: BODY_FONT }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
          ],
        ),
        spacer(50),
      ];
    }

    if (bloque.tipo === 'definicion' && bloque.texto) {
      return [
        buildCalloutBox({
          title: bloque.titulo || 'Definición Formal',
          bgColor: COLORS.bgCard,
          borderColor: palette.teal,
          titleColor: palette.teal,
          cantSplit: true,
          bodyParagraphs: [simpleBodyParagraph(bloque.texto, { size: 18, after: 0 })],
        }),
        spacer(50),
      ];
    }

    if (bloque.tipo === 'tabla' && bloque.columnas?.length && bloque.filas?.length) {
      const colCount = bloque.columnas.length;
      const baseW = Math.floor(CONTENT_W / colCount);
      const colWidths = bloque.columnas.map((_, i) =>
        i === colCount - 1 ? CONTENT_W - baseW * (colCount - 1) : baseW,
      );
      const rows: TableRow[] = [
        new TableRow({
          tableHeader: true,
          cantSplit: true,
          children: bloque.columnas.map((c, idx) =>
            new TableCell({
              width: { size: colWidths[idx]!, type: WidthType.DXA },
              shading: { fill: 'E2E8F0', type: ShadingType.CLEAR },
              borders: uniformBorders(COLORS.border, 4),
              margins: { top: 55, bottom: 55, left: 80, right: 80 },
              children: [
                new Paragraph({
                  spacing: { before: 0, after: 0 },
                  children: [new TextRun({ text: cleanText(c), bold: true, size: 17, color: palette.primary, font: HEADING_FONT })],
                }),
              ],
            }),
          ),
        }),
        ...bloque.filas.map((fila, rIdx) =>
          new TableRow({
            cantSplit: true,
            children: colWidths.map((w, cIdx) =>
              new TableCell({
                width: { size: w, type: WidthType.DXA },
                shading: { fill: rIdx % 2 === 0 ? COLORS.white : COLORS.bgCard, type: ShadingType.CLEAR },
                borders: uniformBorders(COLORS.borderSoft, 4),
                margins: { top: 50, bottom: 50, left: 80, right: 80 },
                children: [
                  new Paragraph({
                    spacing: { before: 0, after: 0, line: 244 },
                    children: [new TextRun({ text: cleanText(fila[cIdx] ?? '—'), size: 17, color: COLORS.slateDark, font: BODY_FONT })],
                  }),
                ],
              }),
            ),
          }),
        ),
      ];
      return [fixedTable(colWidths, rows), spacer(55)];
    }

    if (bloque.texto) {
      return [simpleBodyParagraph(bloque.texto, { size: 19, after: 55 })];
    }
    return [];
  };

  for (const bloque of s.contenido) {
    elements.push(...renderContentBlock(bloque));
  }

  // 5. Franja Complementaria horizontal (Glosario / Sidenote + Material Spot + QR Digital)
  if (s.sidenote && s.sidenote.trim()) {
    elements.push(
      buildCalloutBox({
        title: sidenoteTitle,
        bgColor: COLORS.bgCard,
        borderColor: palette.accent,
        titleColor: COLORS.amberDark,
        cantSplit: true,
        bodyParagraphs: [simpleBodyParagraph(s.sidenote, { size: 17, after: 0 })],
      }),
      spacer(60),
    );
  }

  if (s.materialSpot) {
    const matBuf = readMaterialImageFromPublic(s.materialSpot.archivo);
    if (matBuf) {
      elements.push(
        fixedTable(
          [1720, 8600],
          [
            new TableRow({
              cantSplit: true,
              children: [
                new TableCell({
                  width: { size: 1720, type: WidthType.DXA },
                  shading: { fill: COLORS.white, type: ShadingType.CLEAR },
                  borders: {
                    top: borderSpec(COLORS.border, 4),
                    bottom: borderSpec(COLORS.border, 4),
                    left: borderSpec(palette.primary, 16),
                    right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                  },
                  verticalAlign: VerticalAlign.CENTER,
                  margins: { top: 60, bottom: 60, left: 80, right: 60 },
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      spacing: { before: 0, after: 0 },
                      children: [
                        new ImageRun({
                          data: matBuf,
                          transformation: { width: 88, height: 88 },
                          type: 'png',
                        }),
                      ],
                    }),
                  ],
                }),
                new TableCell({
                  width: { size: 8600, type: WidthType.DXA },
                  shading: { fill: COLORS.bgCard, type: ShadingType.CLEAR },
                  borders: {
                    top: borderSpec(COLORS.border, 4),
                    bottom: borderSpec(COLORS.border, 4),
                    left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                    right: borderSpec(COLORS.border, 4),
                  },
                  verticalAlign: VerticalAlign.CENTER,
                  margins: { top: 60, bottom: 60, left: 100, right: 110 },
                  children: [
                    new Paragraph({
                      spacing: { before: 0, after: 25 },
                      children: [
                        new TextRun({
                          text: `Recurso de Taller · ${cleanText(s.materialSpot.nombre)}`,
                          bold: true,
                          size: 18,
                          color: palette.primary,
                          font: HEADING_FONT,
                        }),
                      ],
                    }),
                    new Paragraph({
                      spacing: { before: 0, after: 0, line: 244 },
                      children: [
                        new TextRun({
                          text: cleanText(s.materialSpot.pie || s.materialSpot.nombre),
                          size: 17,
                          color: COLORS.slateMuted,
                          font: BODY_FONT,
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
          ],
        ),
        spacer(60),
      );
    }
  }

  // 6. Diagrama Pedagógico Enriquecido (`embeddedDiagram` — MISMO SVG del PDF V2 rasterizado con Resvg + Inter TTF)
  if (s.embeddedDiagram?.svg) {
    const rendered = await svgToPngBuffer(s.embeddedDiagram.svg, 216);
    if (rendered?.buffer) {
      const dims = extractSvgDimensions(s.embeddedDiagram.svg);
      const maxW = 600;
      const maxH = 285;
      const aspect = dims.width > 0 && dims.height > 0 ? dims.width / dims.height : 16 / 9;
      let targetW = maxW;
      let targetH = Math.round(targetW / aspect);
      if (targetH > maxH) {
        targetH = maxH;
        targetW = Math.round(targetH * aspect);
      }

      const diagChildren: Paragraph[] = [
        new Paragraph({
          spacing: { before: 0, after: 45 },
          children: [
            new TextRun({
              text: cleanText(s.embeddedDiagram.title),
              bold: true,
              size: 18,
              color: palette.primary,
              font: HEADING_FONT,
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: s.embeddedDiagram.caption ? 40 : 0 },
          children: [
            new ImageRun({
              data: rendered.buffer,
              transformation: { width: targetW, height: targetH },
              type: 'png',
            }),
          ],
        }),
      ];
      if (s.embeddedDiagram.caption) {
        diagChildren.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 0 },
            children: [
              new TextRun({
                text: cleanText(s.embeddedDiagram.caption),
                italics: true,
                size: 16,
                color: COLORS.slateMuted,
                font: BODY_FONT,
              }),
            ],
          }),
        );
      }

      elements.push(
        fixedTable(
          [CONTENT_W],
          [
            new TableRow({
              cantSplit: true,
              children: [
                new TableCell({
                  width: { size: CONTENT_W, type: WidthType.DXA },
                  shading: { fill: COLORS.white, type: ShadingType.CLEAR },
                  borders: uniformBorders(COLORS.border, 6),
                  margins: { top: 80, bottom: 75, left: 110, right: 110 },
                  children: diagChildren,
                }),
              ],
            }),
          ],
        ),
        spacer(70),
      );
    }
  }

  // 7. Ejemplo Resuelto Paso a Paso
  const exampleParagraphs: Paragraph[] = [
    simpleBodyParagraph(s.ejemploResuelto.enunciado, { bold: true, size: 18, after: 45 }),
    ...s.ejemploResuelto.pasos.map(
      (paso, idx) =>
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { before: 0, after: idx === s.ejemploResuelto.pasos.length - 1 ? 0 : 35, line: 248 },
          indent: { left: 220, hanging: 180 },
          children: [
            new TextRun({ text: '•  ', bold: true, size: 18, color: palette.teal, font: BODY_FONT }),
            new TextRun({ text: cleanText(paso), size: 18, color: COLORS.slateDark, font: BODY_FONT }),
          ],
        }),
    ),
  ];

  elements.push(
    buildCalloutBox({
      title: exampleHeading,
      bgColor: palette.tealBg,
      borderColor: palette.teal,
      titleColor: palette.teal,
      bodyParagraphs: exampleParagraphs,
    }),
    spacer(70),
  );

  // 8. Práctica Autónoma Guiada (Ponte a Prueba)
  const practiceParagraphs: Paragraph[] = [];
  s.practica.forEach((item, idx) => {
    practiceParagraphs.push(
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { before: idx === 0 ? 0 : 50, after: 20, line: 248 },
        children: [
          new TextRun({ text: `Ejercicio ${idx + 1}: `, bold: true, size: 18, color: COLORS.purpleDark, font: HEADING_FONT }),
          new TextRun({ text: cleanText(item.enunciado), size: 18, color: COLORS.slateDark, font: BODY_FONT }),
        ],
      }),
    );
    if (item.pista?.trim()) {
      practiceParagraphs.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { before: 0, after: idx === s.practica.length - 1 ? 0 : 35, line: 240 },
          indent: { left: 200 },
          children: [
            new TextRun({ text: 'Pista para comenzar: ', bold: true, italics: true, size: 16, color: COLORS.purpleDark, font: BODY_FONT }),
            new TextRun({ text: cleanText(item.pista), italics: true, size: 16, color: COLORS.slateMuted, font: BODY_FONT }),
          ],
        }),
      );
    }
  });

  elements.push(
    buildCalloutBox({
      title: 'Ponte a Prueba: Actividad Individual de Práctica',
      bgColor: COLORS.purpleBg,
      borderColor: COLORS.purpleBorder,
      titleColor: COLORS.purpleDark,
      bodyParagraphs: practiceParagraphs,
    }),
    spacer(65),
  );

  // 9. Espacios Activos de Cuaderno (`activeSpaces` o espacio de trabajo predeterminado de 4 renglones)
  const spaces: ActiveSpaceItem[] =
    s.activeSpaces && s.activeSpaces.length > 0
      ? s.activeSpaces
      : [
          {
            kind: 'writing_lines',
            title: 'Espacio de Trabajo y Respuesta del Estudiante',
            lines: 4,
          },
        ];
  for (const sp of spaces) {
    elements.push(...buildActiveSpaceBlock(sp, palette));
  }

  // 10. Conexión Comunitaria (PAEC) + Lista de Autoverificación (fila fija 5260 + 5060 = 10320 DXA)
  const paecChildren: Paragraph[] = [
    new Paragraph({
      spacing: { before: 0, after: 30 },
      children: [
        new TextRun({
          text: 'Conexión con tu Comunidad (PAEC)',
          bold: true,
          size: 18,
          color: COLORS.orangeBorder,
          font: HEADING_FONT,
        }),
      ],
    }),
    simpleBodyParagraph(s.aplicacion, { size: 17, after: s.productoIntegrador ? 40 : 0 }),
  ];
  if (s.productoIntegrador?.trim()) {
    paecChildren.push(
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { before: 0, after: 0, line: 240 },
        children: [
          new TextRun({ text: 'Avance del Producto Integrador: ', bold: true, size: 17, color: COLORS.greenDark, font: BODY_FONT }),
          new TextRun({ text: cleanText(s.productoIntegrador), size: 17, color: COLORS.slateDark, font: BODY_FONT }),
        ],
      }),
    );
  }

  const checkChildren: Paragraph[] = [
    new Paragraph({
      spacing: { before: 0, after: 30 },
      children: [
        new TextRun({
          text: 'Lista de Autoverificación',
          bold: true,
          size: 18,
          color: '0284C7',
          font: HEADING_FONT,
        }),
      ],
    }),
    ...s.autoevaluacion.map(
      (check, idx) =>
        new Paragraph({
          spacing: { before: 0, after: idx === s.autoevaluacion.length - 1 ? 0 : 30, line: 240 },
          children: [
            new TextRun({ text: '☐  ', bold: true, size: 18, color: '0284C7', font: BODY_FONT }),
            new TextRun({ text: cleanText(check), size: 17, color: COLORS.slateDark, font: BODY_FONT }),
          ],
        }),
    ),
  ];

  elements.push(
    fixedTable(
      [5260, 5060],
      [
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              width: { size: 5260, type: WidthType.DXA },
              shading: { fill: COLORS.orangeBg, type: ShadingType.CLEAR },
              borders: {
                top: borderSpec(COLORS.borderSoft, 4),
                bottom: borderSpec(COLORS.borderSoft, 4),
                right: borderSpec(COLORS.white, 16),
                left: borderSpec(COLORS.orangeBorder, 24),
              },
              margins: { top: 65, bottom: 65, left: 120, right: 100 },
              children: paecChildren,
            }),
            new TableCell({
              width: { size: 5060, type: WidthType.DXA },
              shading: { fill: COLORS.bgCard, type: ShadingType.CLEAR },
              borders: {
                top: borderSpec(COLORS.borderSoft, 4),
                bottom: borderSpec(COLORS.borderSoft, 4),
                right: borderSpec(COLORS.borderSoft, 4),
                left: borderSpec('0284C7', 24),
              },
              margins: { top: 65, bottom: 65, left: 120, right: 100 },
              children: checkChildren,
            }),
          ],
        }),
      ],
    ),
  );

  // Enlaces de Ampliación + QR Digital (franja compacta horizontal)
  if ((s.recursos && s.recursos.length > 0) || s.digitalToolQr) {
    elements.push(spacer(55));
    const qrPng = s.digitalToolQr?.svg ? await svgToPngBuffer(s.digitalToolQr.svg, 180) : null;
    const resParas: Paragraph[] = [
      new Paragraph({
        spacing: { before: 0, after: 25 },
        children: [
          new TextRun({
            text: 'Enlaces de Ampliación y Herramientas Digitales',
            bold: true,
            size: 17,
            color: COLORS.blueDark,
            font: HEADING_FONT,
          }),
        ],
      }),
      ...(s.recursos || []).map(
        (r) =>
          new Paragraph({
            spacing: { before: 0, after: 20, line: 236 },
            children: [
              new TextRun({ text: `${cleanText(r.titulo)} (${r.tipo}): `, bold: true, size: 16, color: COLORS.slateDark, font: BODY_FONT }),
              new TextRun({ text: r.url, size: 15, color: COLORS.blueBorder, font: BODY_FONT }),
            ],
          }),
      ),
    ];

    if (s.digitalToolQr && qrPng?.buffer) {
      resParas.push(
        new Paragraph({
          spacing: { before: 20, after: 0, line: 236 },
          children: [
            new TextRun({ text: `Herramienta sugerida: ${cleanText(s.digitalToolQr.name)} — `, bold: true, size: 16, color: palette.primary, font: BODY_FONT }),
            new TextRun({ text: `${cleanText(s.digitalToolQr.description)} (${s.digitalToolQr.url})`, size: 15, color: COLORS.slateMuted, font: BODY_FONT }),
          ],
        }),
      );
      elements.push(
        fixedTable(
          [8720, 1600],
          [
            new TableRow({
              cantSplit: true,
              children: [
                new TableCell({
                  width: { size: 8720, type: WidthType.DXA },
                  shading: { fill: COLORS.blueBg, type: ShadingType.CLEAR },
                  borders: {
                    top: borderSpec(COLORS.blueBorder, 8),
                    bottom: borderSpec(COLORS.borderSoft, 4),
                    left: borderSpec(COLORS.borderSoft, 4),
                    right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                  },
                  margins: { top: 60, bottom: 60, left: 110, right: 80 },
                  children: resParas,
                }),
                new TableCell({
                  width: { size: 1600, type: WidthType.DXA },
                  shading: { fill: COLORS.white, type: ShadingType.CLEAR },
                  borders: {
                    top: borderSpec(COLORS.blueBorder, 8),
                    bottom: borderSpec(COLORS.borderSoft, 4),
                    left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                    right: borderSpec(COLORS.borderSoft, 4),
                  },
                  verticalAlign: VerticalAlign.CENTER,
                  margins: { top: 50, bottom: 50, left: 50, right: 50 },
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      spacing: { before: 0, after: 0 },
                      children: [
                        new ImageRun({
                          data: qrPng.buffer,
                          transformation: { width: 72, height: 72 },
                          type: 'png',
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
          ],
        ),
      );
    } else if (s.recursos && s.recursos.length > 0) {
      elements.push(
        buildCalloutBox({
          bgColor: COLORS.blueBg,
          borderColor: COLORS.blueBorder,
          bodyParagraphs: resParas,
          cantSplit: true,
        }),
      );
    }
  }

  return elements;
}

function buildV2ProjectSection(
  proj: StudentProjectSection,
  palette: { primary: string; accent: string; teal: string; tealBg: string },
): (Paragraph | Table)[] {
  const elements: (Paragraph | Table)[] = [
    fixedTable(
      [CONTENT_W],
      [
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              width: { size: CONTENT_W, type: WidthType.DXA },
              shading: { fill: palette.primary, type: ShadingType.CLEAR },
              borders: {
                top: borderSpec(palette.primary, 4),
                bottom: borderSpec(palette.accent, 18),
                left: borderSpec(palette.primary, 4),
                right: borderSpec(palette.primary, 4),
              },
              margins: { top: 90, bottom: 90, left: 140, right: 140 },
              children: [
                new Paragraph({
                  spacing: { before: 0, after: 25 },
                  children: [
                    new TextRun({
                      text: `CIERRE DE BLOQUE ${proj.blockNumber} · PROYECTO INTEGRADOR COMUNITARIO (PAEC)`,
                      bold: true,
                      size: 16,
                      color: 'FDE68A',
                      font: HEADING_FONT,
                    }),
                  ],
                }),
                new Paragraph({
                  spacing: { before: 0, after: 0 },
                  children: [
                    new TextRun({
                      text: cleanText(proj.artifactName),
                      bold: true,
                      size: 24,
                      color: COLORS.white,
                      font: HEADING_FONT,
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    ),
    spacer(80),
    buildCalloutBox({
      title: 'Utilidad Comunitaria y Propósito del Producto',
      bgColor: COLORS.goldBg,
      borderColor: palette.accent,
      titleColor: COLORS.amberDark,
      cantSplit: true,
      bodyParagraphs: [simpleBodyParagraph(proj.communityUtility, { size: 18, after: 0 })],
    }),
    spacer(70),
  ];

  if (proj.requiredMaterials.length > 0) {
    elements.push(
      buildCalloutBox({
        title: 'Materiales e Insumos Requeridos',
        bgColor: COLORS.bgCard,
        borderColor: palette.primary,
        cantSplit: true,
        bodyParagraphs: [simpleBodyParagraph(proj.requiredMaterials.join(' · '), { size: 17, after: 0 })],
      }),
      spacer(70),
    );
  }

  if (proj.phases.length > 0) {
    // Tabla fija de fases: 920 + 2200 + 4400 + 2800 = 10320 DXA
    const phaseCols = [920, 2200, 4400, 2800];
    const phaseRows: TableRow[] = [
      new TableRow({
        tableHeader: true,
        cantSplit: true,
        children: ['Fase', 'Etapa y Tiempo', 'Instrucciones para el Equipo', 'Entregables'].map((h, i) =>
          new TableCell({
            width: { size: phaseCols[i]!, type: WidthType.DXA },
            shading: { fill: 'E2E8F0', type: ShadingType.CLEAR },
            borders: uniformBorders(COLORS.border, 4),
            margins: { top: 60, bottom: 60, left: 80, right: 80 },
            children: [
              new Paragraph({
                spacing: { before: 0, after: 0 },
                children: [new TextRun({ text: h, bold: true, size: 16, color: palette.primary, font: HEADING_FONT })],
              }),
            ],
          }),
        ),
      }),
      ...proj.phases.map((ph, idx) =>
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              width: { size: phaseCols[0]!, type: WidthType.DXA },
              shading: { fill: idx % 2 === 0 ? COLORS.white : COLORS.bgCard, type: ShadingType.CLEAR },
              borders: uniformBorders(COLORS.borderSoft, 4),
              margins: { top: 55, bottom: 55, left: 70, right: 70 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 0, after: 0 },
                  children: [new TextRun({ text: `F-${ph.phaseNum}`, bold: true, size: 16, color: palette.primary, font: HEADING_FONT })],
                }),
              ],
            }),
            new TableCell({
              width: { size: phaseCols[1]!, type: WidthType.DXA },
              shading: { fill: idx % 2 === 0 ? COLORS.white : COLORS.bgCard, type: ShadingType.CLEAR },
              borders: uniformBorders(COLORS.borderSoft, 4),
              margins: { top: 55, bottom: 55, left: 80, right: 80 },
              children: [
                new Paragraph({
                  spacing: { before: 0, after: 0, line: 240 },
                  children: [
                    new TextRun({ text: cleanText(ph.title), bold: true, size: 16, color: COLORS.slateDark, font: BODY_FONT }),
                    new TextRun({ text: ` (${ph.allocatedHours} h)`, size: 15, color: COLORS.slateMuted, font: BODY_FONT }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: phaseCols[2]!, type: WidthType.DXA },
              shading: { fill: idx % 2 === 0 ? COLORS.white : COLORS.bgCard, type: ShadingType.CLEAR },
              borders: uniformBorders(COLORS.borderSoft, 4),
              margins: { top: 55, bottom: 55, left: 80, right: 80 },
              children: [simpleBodyParagraph(ph.instructions, { size: 16, after: 0 })],
            }),
            new TableCell({
              width: { size: phaseCols[3]!, type: WidthType.DXA },
              shading: { fill: idx % 2 === 0 ? COLORS.white : COLORS.bgCard, type: ShadingType.CLEAR },
              borders: uniformBorders(COLORS.borderSoft, 4),
              margins: { top: 55, bottom: 55, left: 80, right: 80 },
              children: [simpleBodyParagraph(ph.deliverables.join('; ') || 'Registro en bitácora', { size: 16, after: 0, color: COLORS.slateMuted })],
            }),
          ],
        }),
      ),
    ];
    elements.push(
      new Paragraph({
        spacing: { before: 20, after: 35 },
        keepNext: true,
        children: [new TextRun({ text: 'Fases de Ejecución del Proyecto', bold: true, size: 19, color: palette.primary, font: HEADING_FONT })],
      }),
      fixedTable(phaseCols, phaseRows),
      spacer(75),
    );
  }

  if (proj.technicalSpecs.length > 0 || proj.acceptanceCriteria.length > 0) {
    elements.push(
      fixedTable(
        [5160, 5160],
        [
          new TableRow({
            cantSplit: true,
            children: [
              new TableCell({
                width: { size: 5160, type: WidthType.DXA },
                shading: { fill: COLORS.bgCard, type: ShadingType.CLEAR },
                borders: {
                  top: borderSpec(COLORS.border, 4),
                  bottom: borderSpec(COLORS.border, 4),
                  left: borderSpec(COLORS.border, 4),
                  right: borderSpec(COLORS.white, 16),
                },
                margins: { top: 70, bottom: 70, left: 100, right: 100 },
                children: [
                  new Paragraph({
                    spacing: { before: 0, after: 30 },
                    children: [new TextRun({ text: 'Especificaciones de Calidad', bold: true, size: 17, color: palette.primary, font: HEADING_FONT })],
                  }),
                  ...proj.technicalSpecs.map((sp) => simpleBodyParagraph(`• ${sp}`, { size: 16, after: 25 })),
                ],
              }),
              new TableCell({
                width: { size: 5160, type: WidthType.DXA },
                shading: { fill: COLORS.greenBg, type: ShadingType.CLEAR },
                borders: uniformBorders('BBF7D0', 4),
                margins: { top: 70, bottom: 70, left: 100, right: 100 },
                children: [
                  new Paragraph({
                    spacing: { before: 0, after: 30 },
                    children: [new TextRun({ text: 'Criterios de Aceptación', bold: true, size: 17, color: COLORS.greenDark, font: HEADING_FONT })],
                  }),
                  ...proj.acceptanceCriteria.map((ac) => simpleBodyParagraph(`• ${ac}`, { size: 16, after: 25 })),
                ],
              }),
            ],
          }),
        ],
      ),
      spacer(75),
    );
  }

  // Bitácora de Avance del Estudiante (tabla fija 1420 + 4400 + 3100 + 1400 = 10320)
  const logCols = [1420, 4400, 3100, 1400];
  const logRows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      cantSplit: true,
      children: ['Fecha', 'Actividad Realizada / Evidencia', 'Observación / Ajuste', 'Vo.Bo.'].map((h, i) =>
        new TableCell({
          width: { size: logCols[i]!, type: WidthType.DXA },
          shading: { fill: 'E2E8F0', type: ShadingType.CLEAR },
          borders: uniformBorders(COLORS.border, 4),
          margins: { top: 55, bottom: 55, left: 75, right: 75 },
          children: [
            new Paragraph({
              spacing: { before: 0, after: 0 },
              children: [new TextRun({ text: h, bold: true, size: 16, color: palette.primary, font: HEADING_FONT })],
            }),
          ],
        }),
      ),
    }),
    ...Array.from({ length: 3 }, () =>
      new TableRow({
        cantSplit: true,
        height: { value: 380, rule: HeightRule.ATLEAST },
        children: logCols.map((w) =>
          new TableCell({
            width: { size: w, type: WidthType.DXA },
            shading: { fill: COLORS.white, type: ShadingType.CLEAR },
            borders: uniformBorders(COLORS.border, 4),
            margins: { top: 50, bottom: 50, left: 70, right: 70 },
            children: [new Paragraph({ spacing: { before: 0, after: 0 }, children: [] })],
          }),
        ),
      }),
    ),
  ];

  elements.push(
    new Paragraph({
      spacing: { before: 20, after: 35 },
      keepNext: true,
      children: [new TextRun({ text: 'Bitácora de Avance del Estudiante', bold: true, size: 18, color: palette.primary, font: HEADING_FONT })],
    }),
    fixedTable(logCols, logRows),
  );

  return elements;
}

function buildV2EvaluationSection(
  ev: StudentEvaluationSection,
  palette: { primary: string; accent: string; teal: string; tealBg: string },
): (Paragraph | Table)[] {
  const elements: (Paragraph | Table)[] = [
    fixedTable(
      [CONTENT_W],
      [
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              width: { size: CONTENT_W, type: WidthType.DXA },
              shading: { fill: palette.teal, type: ShadingType.CLEAR },
              borders: {
                top: borderSpec(palette.teal, 4),
                bottom: borderSpec(palette.accent, 18),
                left: borderSpec(palette.teal, 4),
                right: borderSpec(palette.teal, 4),
              },
              margins: { top: 90, bottom: 90, left: 140, right: 140 },
              children: [
                new Paragraph({
                  spacing: { before: 0, after: 25 },
                  children: [
                    new TextRun({
                      text: `EVALUACIÓN FORMATIVA INTEGRAL NEM · BLOQUE ${ev.blockNumber}`,
                      bold: true,
                      size: 16,
                      color: 'E2E8F0',
                      font: HEADING_FONT,
                    }),
                  ],
                }),
                new Paragraph({
                  spacing: { before: 0, after: 0 },
                  children: [
                    new TextRun({
                      text: 'Rúbrica Analítica, Lista de Cotejo y Reflexión Metacognitiva',
                      bold: true,
                      size: 23,
                      color: COLORS.white,
                      font: HEADING_FONT,
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    ),
    spacer(80),
  ];

  // 1. Rúbrica Analítica 4 Niveles (ancho fijo exacto: 2120 + 2050×4 = 10320 DXA — 0 desborde)
  if (ev.rubric.length > 0) {
    const rubCols = [2120, 2050, 2050, 2050, 2050];
    const headerDefs: Array<[string, string]> = [
      ['Criterio (Peso)', palette.primary],
      ['Excelente', COLORS.greenDark],
      ['Bueno', COLORS.blueDark],
      ['Suficiente', COLORS.amberDark],
      ['Requiere Apoyo', COLORS.redDark],
    ];
    const rubricRows: TableRow[] = [
      new TableRow({
        tableHeader: true,
        cantSplit: true,
        children: headerDefs.map(([label, col], idx) =>
          new TableCell({
            width: { size: rubCols[idx]!, type: WidthType.DXA },
            shading: { fill: 'E2E8F0', type: ShadingType.CLEAR },
            borders: uniformBorders(COLORS.border, 4),
            margins: { top: 55, bottom: 55, left: 65, right: 65 },
            children: [
              new Paragraph({
                spacing: { before: 0, after: 0 },
                children: [new TextRun({ text: label, bold: true, size: 15, color: col, font: HEADING_FONT })],
              }),
            ],
          }),
        ),
      }),
      ...ev.rubric.map((c, rIdx) => {
        const getDesc = (name: string) =>
          c.levels.find((l) => l.levelName.toLowerCase() === name.toLowerCase())?.descriptor || '—';
        const fill = rIdx % 2 === 0 ? COLORS.white : COLORS.bgCard;
        const cellsText = [
          `${cleanText(c.criterion)} (${c.weightPercent}%)`,
          getDesc('Excelente'),
          getDesc('Bueno'),
          getDesc('Suficiente'),
          getDesc('Requiere Apoyo'),
        ];
        return new TableRow({
          cantSplit: true,
          children: cellsText.map((txt, cIdx) =>
            new TableCell({
              width: { size: rubCols[cIdx]!, type: WidthType.DXA },
              shading: { fill, type: ShadingType.CLEAR },
              borders: uniformBorders(COLORS.borderSoft, 4),
              margins: { top: 50, bottom: 50, left: 65, right: 65 },
              children: [
                new Paragraph({
                  spacing: { before: 0, after: 0, line: 232 },
                  children: [
                    new TextRun({
                      text: cleanText(txt),
                      bold: cIdx === 0,
                      size: 15, // 7.5 pt para que 5 columnas quepan nítidas sin cortar palabras
                      color: cIdx === 0 ? palette.primary : COLORS.slateDark,
                      font: BODY_FONT,
                    }),
                  ],
                }),
              ],
            }),
          ),
        });
      }),
    ];

    elements.push(
      new Paragraph({
        spacing: { before: 10, after: 35 },
        keepNext: true,
        children: [new TextRun({ text: '1. Rúbrica Analítica de Desempeño (4 Niveles)', bold: true, size: 19, color: palette.primary, font: HEADING_FONT })],
      }),
      fixedTable(rubCols, rubricRows),
      spacer(75),
    );
  }

  // 2. Lista de Cotejo (6120 + 2400 + 900 + 900 = 10320 DXA)
  if (ev.checklist.length > 0) {
    const chkCols = [6120, 2400, 900, 900];
    const chkRows: TableRow[] = [
      new TableRow({
        tableHeader: true,
        cantSplit: true,
        children: ['Indicador Verificable', 'Categoría', 'Sí', 'No'].map((h, i) =>
          new TableCell({
            width: { size: chkCols[i]!, type: WidthType.DXA },
            shading: { fill: 'E2E8F0', type: ShadingType.CLEAR },
            borders: uniformBorders(COLORS.border, 4),
            margins: { top: 55, bottom: 55, left: 75, right: 75 },
            children: [
              new Paragraph({
                alignment: i >= 2 ? AlignmentType.CENTER : AlignmentType.LEFT,
                spacing: { before: 0, after: 0 },
                children: [new TextRun({ text: h, bold: true, size: 16, color: palette.primary, font: HEADING_FONT })],
              }),
            ],
          }),
        ),
      }),
      ...ev.checklist.map((item, idx) => {
        const fill = idx % 2 === 0 ? COLORS.white : COLORS.bgCard;
        return new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              width: { size: chkCols[0]!, type: WidthType.DXA },
              shading: { fill, type: ShadingType.CLEAR },
              borders: uniformBorders(COLORS.borderSoft, 4),
              margins: { top: 45, bottom: 45, left: 75, right: 75 },
              children: [simpleBodyParagraph(item.item, { size: 16, after: 0 })],
            }),
            new TableCell({
              width: { size: chkCols[1]!, type: WidthType.DXA },
              shading: { fill, type: ShadingType.CLEAR },
              borders: uniformBorders(COLORS.borderSoft, 4),
              margins: { top: 45, bottom: 45, left: 75, right: 75 },
              children: [simpleBodyParagraph(item.category, { size: 15, color: COLORS.slateMuted, after: 0, align: AlignmentType.LEFT })],
            }),
            new TableCell({
              width: { size: chkCols[2]!, type: WidthType.DXA },
              shading: { fill, type: ShadingType.CLEAR },
              borders: uniformBorders(COLORS.borderSoft, 4),
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 40, bottom: 40, left: 40, right: 40 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 0, after: 0 },
                  children: [new TextRun({ text: '☐', size: 20, color: COLORS.slateMuted, font: BODY_FONT })],
                }),
              ],
            }),
            new TableCell({
              width: { size: chkCols[3]!, type: WidthType.DXA },
              shading: { fill, type: ShadingType.CLEAR },
              borders: uniformBorders(COLORS.borderSoft, 4),
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 40, bottom: 40, left: 40, right: 40 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 0, after: 0 },
                  children: [new TextRun({ text: '☐', size: 20, color: COLORS.slateMuted, font: BODY_FONT })],
                }),
              ],
            }),
          ],
        });
      }),
    ];

    elements.push(
      new Paragraph({
        spacing: { before: 10, after: 35 },
        keepNext: true,
        children: [new TextRun({ text: '2. Lista de Cotejo de Evidencias', bold: true, size: 19, color: palette.primary, font: HEADING_FONT })],
      }),
      fixedTable(chkCols, chkRows),
      spacer(75),
    );
  }

  // 3. Reactivos de Pensamiento Crítico (estrictamente sin clave docente)
  if (ev.quizQuestions.length > 0) {
    elements.push(
      new Paragraph({
        spacing: { before: 10, after: 40 },
        keepNext: true,
        children: [new TextRun({ text: '3. Reactivos de Pensamiento Crítico (Para el Estudiante)', bold: true, size: 19, color: palette.primary, font: HEADING_FONT })],
      }),
    );

    for (const q of ev.quizQuestions) {
      const qParas: Paragraph[] = [
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { before: 0, after: 30, line: 244 },
          children: [
            new TextRun({ text: `Pregunta ${q.questionNumber}: `, bold: true, size: 17, color: palette.primary, font: HEADING_FONT }),
            new TextRun({ text: cleanText(q.scenario), size: 17, color: COLORS.slateMuted, font: BODY_FONT }),
          ],
        }),
        simpleBodyParagraph(q.question, { bold: true, size: 17, after: q.options?.length ? 30 : 0 }),
        ...(q.options || []).map((opt) => simpleBodyParagraph(`○  ${opt}`, { size: 16, after: 20, align: AlignmentType.LEFT })),
      ];
      elements.push(
        buildCalloutBox({
          bgColor: COLORS.bgCard,
          borderColor: palette.primary,
          bodyParagraphs: qParas,
          cantSplit: true,
        }),
        spacer(45),
      );
    }
  }

  // 4. Reflexión Metacognitiva con renglones punteados
  if (ev.reflectionPrompts.length > 0) {
    const reflRows: TableRow[] = [
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: CONTENT_W, type: WidthType.DXA },
            shading: { fill: COLORS.purpleBg, type: ShadingType.CLEAR },
            borders: {
              top: borderSpec('E9D5FF', 4),
              bottom: borderSpec('E9D5FF', 4),
              left: borderSpec(palette.accent, 24),
              right: borderSpec('E9D5FF', 4),
            },
            margins: { top: 65, bottom: 65, left: 120, right: 110 },
            children: [
              new Paragraph({
                spacing: { before: 0, after: 0 },
                children: [
                  new TextRun({
                    text: '4. Semáforo y Reflexión Metacognitiva',
                    bold: true,
                    size: 18,
                    color: palette.primary,
                    font: HEADING_FONT,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ];

    for (const prompt of ev.reflectionPrompts) {
      reflRows.push(
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              width: { size: CONTENT_W, type: WidthType.DXA },
              shading: { fill: COLORS.white, type: ShadingType.CLEAR },
              borders: {
                top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                bottom: borderSpec(COLORS.border, 4, BorderStyle.DOTTED),
                left: borderSpec(palette.accent, 24),
                right: borderSpec('E9D5FF', 4),
              },
              margins: { top: 60, bottom: 260, left: 120, right: 110 },
              children: [simpleBodyParagraph(`• ${prompt}`, { size: 17, after: 0 })],
            }),
          ],
        }),
      );
    }

    elements.push(fixedTable([CONTENT_W], reflRows));
  }

  return elements;
}

async function buildV2CreditsAndBackcover(
  chapter: StudentChapter,
  palette: { primary: string; accent: string; teal: string; tealBg: string },
  options: UnifiedDocxRenderOptions,
): Promise<(Paragraph | Table)[]> {
  const bookHash = crypto
    .createHash('sha256')
    .update(`${chapter.cct}|${chapter.uac}|${chapter.cicloEscolar}|sigpda-ems-v2-docx`)
    .digest('hex');

  let qrBuffer: Buffer | null = null;
  try {
    const verifyUrl = getVerificationUrl(bookHash.slice(0, 16));
    qrBuffer = await QRCode.toBuffer(verifyUrl, { width: 180, margin: 1 });
  } catch {
    qrBuffer = null;
  }

  const credRows: Array<[string, string]> = [
    ['Dirección General:', 'Secretaría de Educación Pública del Estado de Puebla'],
    ['Subsecretaría:', 'Subsecretaría de Educación Media Superior'],
    ['Plataforma Editorial:', `${getRuntimePlatformName()} · Motor Editorial Unificado V2`],
    ['Plantel Educativo:', `${cleanText(chapter.plantel)} (CCT: ${cleanText(chapter.cct)})`],
    ['Unidad de Aprendizaje:', `${cleanText(chapter.uac)} · ${cleanText(chapter.bloque)}`],
    ['Docente Titular:', cleanText(options.teacherName || 'Academia Docente EMS')],
    ['Ciclo Escolar:', cleanText(chapter.cicloEscolar || SCHOOL_YEAR)],
  ];

  const elements: (Paragraph | Table)[] = [
    new Paragraph({
      spacing: { before: 80, after: 80 },
      border: { bottom: borderSpec(palette.accent, 10) },
      children: [
        new TextRun({
          text: 'Créditos Institucionales y Registro de Autenticidad',
          bold: true,
          size: 26,
          color: palette.primary,
          font: HEADING_FONT,
        }),
      ],
    }),
    simpleBodyParagraph(
      `Cuaderno de Aprendizaje Activo diseñado y maquetado en estricto apego al Marco Curricular Común de la Educación Media Superior (MCCEMS ${chapter.cicloEscolar || SCHOOL_YEAR}) y la Nueva Escuela Mexicana (NEM). Todos los organizadores gráficos, diagramas pedagógicos y esquemas visuales han sido generados por ${getRuntimePlatformName()} en paridad editorial directa con la edición impresa.`,
      { size: 18, after: 110 },
    ),
    fixedTable(
      [3120, 7200],
      credRows.map(([k, v], idx) =>
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              width: { size: 3120, type: WidthType.DXA },
              shading: { fill: idx % 2 === 0 ? COLORS.bgCard : COLORS.white, type: ShadingType.CLEAR },
              borders: uniformBorders(COLORS.borderSoft, 4),
              margins: { top: 55, bottom: 55, left: 100, right: 80 },
              children: [new Paragraph({ spacing: { before: 0, after: 0 }, children: [new TextRun({ text: k, bold: true, size: 17, color: palette.primary, font: HEADING_FONT })] })],
            }),
            new TableCell({
              width: { size: 7200, type: WidthType.DXA },
              shading: { fill: idx % 2 === 0 ? COLORS.bgCard : COLORS.white, type: ShadingType.CLEAR },
              borders: uniformBorders(COLORS.borderSoft, 4),
              margins: { top: 55, bottom: 55, left: 100, right: 100 },
              children: [new Paragraph({ spacing: { before: 0, after: 0 }, children: [new TextRun({ text: v, size: 17, color: COLORS.slateDark, font: BODY_FONT })] })],
            }),
          ],
        }),
      ),
    ),
    spacer(140),
  ];

  // Bloque de sello digital SHA-256 + QR (8520 + 1800 = 10320)
  elements.push(
    fixedTable(
      [8520, 1800],
      [
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              width: { size: 8520, type: WidthType.DXA },
              shading: { fill: COLORS.bgCard, type: ShadingType.CLEAR },
              borders: {
                top: borderSpec(palette.primary, 8),
                bottom: borderSpec(palette.primary, 8),
                left: borderSpec(palette.primary, 20),
                right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
              },
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 90, bottom: 90, left: 140, right: 100 },
              children: [
                new Paragraph({
                  spacing: { before: 0, after: 35 },
                  children: [
                    new TextRun({
                      text: 'FOLIO DIGITAL DE AUTENTICIDAD CRIPTOGRÁFICA (SHA-256)',
                      bold: true,
                      size: 16,
                      color: palette.primary,
                      font: HEADING_FONT,
                    }),
                  ],
                }),
                new Paragraph({
                  spacing: { before: 0, after: 40 },
                  children: [new TextRun({ text: bookHash, size: 14, color: COLORS.slateMuted, font: CODE_FONT })],
                }),
                new Paragraph({
                  spacing: { before: 0, after: 0 },
                  children: [
                    new TextRun({
                      text: `Distribución educativa gratuita · ${cleanText(chapter.plantel)} · ${cleanText(chapter.zonaEscolar)}`,
                      italics: true,
                      size: 15,
                      color: COLORS.slateMuted,
                      font: BODY_FONT,
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 1800, type: WidthType.DXA },
              shading: { fill: COLORS.white, type: ShadingType.CLEAR },
              borders: {
                top: borderSpec(palette.primary, 8),
                bottom: borderSpec(palette.primary, 8),
                left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                right: borderSpec(palette.primary, 8),
              },
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 60, bottom: 60, left: 60, right: 60 },
              children: qrBuffer
                ? [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      spacing: { before: 0, after: 0 },
                      children: [
                        new ImageRun({
                          data: qrBuffer,
                          transformation: { width: 88, height: 88 },
                          type: 'png',
                        }),
                      ],
                    }),
                  ]
                : [new Paragraph({ spacing: { before: 0, after: 0 }, children: [] })],
            }),
          ],
        }),
      ],
    ),
  );

  return elements;
}

// ── API Pública: Renderizado Directo de StudentChapter → DOCX Editorial V2 ──

export async function renderStudentChapterToDocx(
  chapter: StudentChapter,
  options: UnifiedDocxRenderOptions = {},
): Promise<Buffer> {
  const ui = chapter.disciplinaUi ?? resolveEditorialDisciplinaryUi(chapter.uac);
  const palette = {
    primary: hexClean(ui.palette.primary, '0F294A'),
    accent: hexClean(ui.palette.accent, 'C98A2C'),
    teal: hexClean(ui.palette.teal, '0D766E'),
    tealBg: hexClean(ui.palette.tealBg, 'F0FDFA'),
  };

  const coverChildren = await buildV2CoverSection(chapter, palette, options);
  const prelimChildren = buildV2PreliminarySection(chapter, palette);

  const bodyChildren: (Paragraph | Table)[] = [];
  const missions = chapter.missions ?? [];
  const projects = chapter.projectSections ?? [];
  const evaluations = chapter.evaluationSections ?? [];
  const dividersByStartSession = new Map<number, UnifiedDocxBlockDividerSpec>();
  for (const div of options.blockDividers ?? []) {
    dividersByStartSession.set(div.startSession, div);
  }

  for (let idx = 0; idx < chapter.sesiones.length; idx++) {
    const s = chapter.sesiones[idx]!;
    const divider = dividersByStartSession.get(s.numero);
    if (divider) {
      bodyChildren.push(
        ...(await buildV2BlockDividerPage(divider, chapter.uac, palette)),
        new Paragraph({ spacing: { before: 0, after: 0 }, children: [new PageBreak()] }),
      );
    }

    for (const m of missions) {
      if (m.startSession === s.numero) {
        bodyChildren.push(...(await buildV2MissionBanner(m, palette)));
      }
    }

    bodyChildren.push(...(await buildV2SessionSection(s, chapter, palette)));

    for (const proj of projects) {
      if (proj.afterSession === s.numero) {
        bodyChildren.push(
          new Paragraph({ spacing: { before: 0, after: 0 }, children: [new PageBreak()] }),
          ...buildV2ProjectSection(proj, palette),
        );
      }
    }

    for (const ev of evaluations) {
      if (ev.afterSession === s.numero) {
        bodyChildren.push(
          new Paragraph({ spacing: { before: 0, after: 0 }, children: [new PageBreak()] }),
          ...buildV2EvaluationSection(ev, palette),
        );
      }
    }

    if (idx < chapter.sesiones.length - 1) {
      bodyChildren.push(new Paragraph({ spacing: { before: 0, after: 0 }, children: [new PageBreak()] }));
    }
  }

  for (const proj of projects) {
    if (!proj.afterSession) {
      bodyChildren.push(
        new Paragraph({ spacing: { before: 0, after: 0 }, children: [new PageBreak()] }),
        ...buildV2ProjectSection(proj, palette),
      );
    }
  }
  for (const ev of evaluations) {
    if (!ev.afterSession) {
      bodyChildren.push(
        new Paragraph({ spacing: { before: 0, after: 0 }, children: [new PageBreak()] }),
        ...buildV2EvaluationSection(ev, palette),
      );
    }
  }

  const creditsChildren = await buildV2CreditsAndBackcover(chapter, palette, options);

  const shortUac =
    cleanText(chapter.uac).length > 52 ? `${cleanText(chapter.uac).slice(0, 49)}...` : cleanText(chapter.uac);
  const pageProps = {
    page: {
      size: { width: PAGE_W, height: PAGE_H },
      margin: { top: MARGIN_Y, bottom: MARGIN_Y, left: MARGIN_X, right: MARGIN_X },
    },
  };

  const sections: ISectionOptions[] = [
    // Sección 1: Portada (sin header ni footer)
    {
      properties: pageProps,
      headers: {},
      footers: {},
      children: coverChildren,
    },
    // Sección 2: Preliminares (Metodología + Mapa de Sesiones)
    {
      properties: pageProps,
      headers: {},
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              border: { top: borderSpec(COLORS.border, 4) },
              spacing: { before: 40, after: 0 },
              children: [
                new TextRun({
                  text: `Secretaría de Educación Pública de Puebla · DBEPA · Modelo MCCEMS · ${cleanText(chapter.cct)}`,
                  size: 15,
                  color: COLORS.slateMuted,
                  font: BODY_FONT,
                }),
              ],
            }),
          ],
        }),
      },
      children: prelimChildren,
    },
    // Sección 3: Contenido Editorial (Portadillas + Misiones + 54 Sesiones + Proyectos + Evaluaciones)
    {
      properties: pageProps,
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              border: { bottom: borderSpec(palette.primary, 6) },
              spacing: { before: 0, after: 40 },
              children: [
                new TextRun({ text: shortUac, bold: true, size: 16, color: palette.primary, font: HEADING_FONT }),
                new TextRun({ text: ` · ${cleanText(chapter.bloque)}   |   `, size: 16, color: COLORS.slateMuted, font: BODY_FONT }),
                new TextRun({ text: getRuntimePlatformName(), bold: true, size: 16, color: COLORS.secondary, font: HEADING_FONT }),
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
              border: { top: borderSpec(COLORS.border, 4) },
              spacing: { before: 40, after: 0 },
              children: [
                new TextRun({
                  text: 'Secretaría de Educación Pública de Puebla · DBEPA · Modelo MCCEMS   |   Página ',
                  size: 15,
                  color: COLORS.slateMuted,
                  font: BODY_FONT,
                }),
                new TextRun({ children: [PageNumber.CURRENT], bold: true, size: 15, color: palette.primary, font: HEADING_FONT }),
                new TextRun({ text: ' de ', size: 15, color: COLORS.slateMuted, font: BODY_FONT }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 15, color: COLORS.slateMuted, font: BODY_FONT }),
              ],
            }),
          ],
        }),
      },
      children: bodyChildren,
    },
    // Sección 4: Créditos y Contraportada
    {
      properties: pageProps,
      headers: {},
      footers: {},
      children: creditsChildren,
    },
  ];

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: BODY_FONT, size: 19, color: COLORS.slateDark },
          paragraph: { alignment: AlignmentType.JUSTIFIED, spacing: BODY_SPACING },
        },
      },
      paragraphStyles: [
        {
          id: 'Normal',
          name: 'Normal',
          quickFormat: true,
          run: { font: BODY_FONT, size: 19, color: COLORS.slateDark },
          paragraph: { alignment: AlignmentType.JUSTIFIED, spacing: BODY_SPACING },
        },
      ],
    },
    sections,
  });

  return Buffer.from(await Packer.toBuffer(doc));
}

// ── Compilador Unificado DOCX V2 (con fallback transparente al DOCX clásico) ──

export async function compileUnifiedEditorialDocx(
  params: UnifiedEditorialDocxCompileParams,
): Promise<UnifiedEditorialDocxCompileResult> {
  try {
    const isSingleBlock = typeof params.blockIndex === 'number' && Number.isInteger(params.blockIndex);
    const scopedWorkbooks: Record<string, { current?: ActiveWorkTextbook }> = {};

    if (isSingleBlock) {
      const key = `block_${params.blockIndex}`;
      const existing = params.workbooksMap[key]?.current ?? params.fallbackWorkbook;
      scopedWorkbooks[key] = { current: existing };
    } else {
      for (const [k, v] of Object.entries(params.workbooksMap)) {
        if (/^block_\d+$/.test(k) && v?.current) {
          scopedWorkbooks[k] = { current: v.current };
        }
      }
    }

    const sceneFileExists = createNodeSceneFileExists();
    const composed = composeStudentSessionsFromWorkbooks(
      {
        uac_name: params.planning.uacName,
        workbooks_json: scopedWorkbooks,
      },
      { sceneFileExists },
    );

    if (composed.sessions.length === 0 || composed.dropped.length > 0) {
      const reason =
        composed.sessions.length === 0
          ? 'no_student_sessions'
          : `dropped_sessions:${composed.dropped.length}`;
      logger.warn('[unified-editorial-docx] Fallback a DOCX legado tras composición:', {
        planningId: params.planningId,
        blockIndex: params.blockIndex,
        reason,
      });
      const docxBuffer = await renderWorkbookToDocx(params.fallbackWorkbook, params.planning);
      return {
        docxBuffer,
        engine: 'legacy_docx_fallback',
        sessionCount: 0,
        missionCount: params.fallbackWorkbook.missions.length,
        fallbackReason: reason,
      };
    }

    const sectionI = (params.planning.contentJson?.sectionI ?? undefined) as
      | SchoolIdentitySource
      | undefined;
    const schoolIdentity = resolveSchoolIdentity({
      sectionI,
      teacher: {
        schoolName: params.teacherIdentity?.schoolName ?? params.fallbackWorkbook.coverData?.schoolName,
        cct: params.teacherIdentity?.cct ?? params.fallbackWorkbook.coverData?.cct,
        schoolZone: params.teacherIdentity?.schoolZone,
      },
    });
    const plantel =
      schoolIdentity.schoolName !== PLANTEL_NO_REGISTRADO
        ? schoolIdentity.schoolName
        : 'Educación Media Superior Puebla';
    const cct =
      schoolIdentity.cct !== CCT_NO_REGISTRADO ? schoolIdentity.cct : '21EBH0001X';

    const firstBlock = isSingleBlock ? params.blockIndex! : (composed.blocksPresent[0] ?? 0);
    const bloqueEtiqueta = isSingleBlock
      ? `Bloque ${firstBlock + 1}`
      : composed.blocksPresent.length > 1
        ? `Compendio Semestral (Bloques ${composed.blocksPresent.map((n) => romanNumeral(n + 1)).join(', ')})`
        : `Bloque ${firstBlock + 1}`;

    const resolvedUacName = params.planning.uacName || params.fallbackWorkbook.coverData?.subjectName || 'Unidad de Aprendizaje Curricular';
    const coverTopicHint = composed.missions
      .filter((m) => !isSingleBlock || m.blockNumber === firstBlock + 1)
      .map((m) => extractMissionPrimaryTopicForScene({ title: m.title }))
      .filter(Boolean)
      .join(' ');
    const coverScene = allocateEditorialSceneOnDisk({
      uacName: resolvedUacName,
      blockNumber: firstBlock + 1,
      role: 'block_cover',
      topicText: coverTopicHint || bloqueEtiqueta,
      preferPortadaV2: true,
      fileExists: sceneFileExists,
    });

    // Portadillas separadoras con portadas V2 distintas por bloque en compendios multi-bloque
    const blockDividers: UnifiedDocxBlockDividerSpec[] = [];
    if (!isSingleBlock && composed.blocksPresent.length > 1) {
      const usedCoverIds: string[] = coverScene?.id ? [coverScene.id] : [];
      for (const bIdx of composed.blocksPresent) {
        const blockNumber = bIdx + 1;
        const blockMissions = composed.missions.filter((m) => m.blockNumber === blockNumber);
        if (blockMissions.length === 0) continue;
        const startSession = Math.min(...blockMissions.map((m) => m.startSession));
        const rawBlock = scopedWorkbooks[`block_${bIdx}`]?.current;
        const blockName = rawBlock?.blockName || `Bloque ${romanNumeral(blockNumber)}`;
        const blockTopicHint = blockMissions
          .map((m) => extractMissionPrimaryTopicForScene({ title: m.title }))
          .filter(Boolean)
          .join(' ');
        const firstMissionSceneId = blockNumber > 1 ? blockMissions[0]?.scene?.id : undefined;
        const avoidForDivider = [
          ...usedCoverIds,
          ...(firstMissionSceneId ? [firstMissionSceneId] : []),
        ];
        const divScene = allocateEditorialSceneOnDisk({
          uacName: resolvedUacName,
          blockNumber,
          role: 'block_cover',
          topicText: blockTopicHint || blockName,
          avoidSceneIds: avoidForDivider.length > 0 ? avoidForDivider : undefined,
          preferPortadaV2: true,
          fileExists: sceneFileExists,
        });
        if (divScene?.id) usedCoverIds.push(divScene.id);

        blockDividers.push({
          blockNumber,
          blockName,
          startSession,
          missions: blockMissions,
          ...(divScene
            ? {
                coverScene: {
                  id: divScene.id,
                  relativePath: divScene.relativePath,
                  alt: divScene.alt,
                },
              }
            : {}),
        });
      }
    }

    const enrichedSessions = await enrichEditorialSessionsV2({
      uacName: resolvedUacName,
      sessions: composed.sessions,
      missions: composed.missions,
    });

    const chapter = StudentChapterSchema.parse({
      uac: resolvedUacName,
      bloque: bloqueEtiqueta,
      editorialSubtitle: 'Alineado al MCCEMS y Proyectos Aula Escuela Comunidad (PAEC)',
      semestre: String(params.planning.semester || params.fallbackWorkbook.coverData?.semester || '1'),
      cicloEscolar: SCHOOL_YEAR,
      plantel,
      cct,
      zonaEscolar: formatZonaEscolar(schoolIdentity.schoolZone),
      disciplinaUi: resolveEditorialDisciplinaryUi(resolvedUacName),
      ...(coverScene ? { coverScene } : {}),
      ...(composed.missions.length > 0 ? { missions: composed.missions } : {}),
      ...(composed.projectSections.length > 0 ? { projectSections: composed.projectSections } : {}),
      ...(composed.evaluationSections.length > 0 ? { evaluationSections: composed.evaluationSections } : {}),
      sesiones: enrichedSessions,
    });

    const docxBuffer = await renderStudentChapterToDocx(chapter, {
      blockDividers,
      teacherName: params.fallbackWorkbook.coverData?.teacherName,
      paecProjectName: params.fallbackWorkbook.coverData?.paecProjectName,
      subsystem: params.fallbackWorkbook.subsystem,
    });

    return {
      docxBuffer,
      engine: 'editorial_v2_docx',
      sessionCount: chapter.sesiones.length,
      missionCount: chapter.missions?.length ?? 0,
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    logger.warn('[unified-editorial-docx] Error en Motor DOCX V2; activando fallback a DOCX legado:', {
      planningId: params.planningId,
      blockIndex: params.blockIndex,
      reason,
    });
    const docxBuffer = await renderWorkbookToDocx(params.fallbackWorkbook, params.planning);
    return {
      docxBuffer,
      engine: 'legacy_docx_fallback',
      sessionCount: 0,
      missionCount: params.fallbackWorkbook.missions.length,
      fallbackReason: reason,
    };
  }
}
