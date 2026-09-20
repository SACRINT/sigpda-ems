/**
 * pdf-workbook-renderer.ts — Generador PDF del Libro-Cuaderno de Trabajo Activo
 * SIGPDA-EMS · DBEPA Puebla MCCEMS 2026-2027
 *
 * Genera el documento PDF formal imprimible para el estudiante (35-80 páginas por bloque):
 * 1. Portada oficial con membrete SEP/DBEPA, datos del plantel, CCT y proyecto PAEC.
 * 2. Índice de misiones formativas.
 * 3. Misiones didácticas completas (Concepto Cero, Yo Hago, Nosotros Hacemos, Tú Haces).
 * 4. Elementos de cuaderno activo interactivos (líneas de escritura, cajas de código, tablas de registro, casillas).
 * 5. Matriz de resiliencia y depuración ("¿Qué hacer si falla?").
 * 6. Instrumentos oficiales de evaluación formativa y sumativa NEM (Rúbrica 4 niveles y Lista de Cotejo).
 * 7. Paginación continua institucional (Página X de Y).
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type {
  ActiveWorkTextbook,
  MissionSection,
  WorkbookElement,
  EvaluationSection,
  ProjectSection,
  EvaluationRubricCriterion,
} from '@/types/work-textbook';
import type { Planning, ImageAsset } from '@/types/planning';
import { loadAllLogos } from './pdf-logos';
import {
  resolveVisualForMission,
  resolveEquipmentVisualForMission,
} from '@/lib/visual-engine/visual-asset-manager';
import { svgToPngBuffer } from '@/lib/visual-engine/svg-to-png';
import { isStemSubject } from '@/lib/visual-engine/visual-dispatcher';
import { downloadAndProcessImage } from '@/lib/visual-engine/image-downloader';
import type { VisualAnnotation } from '@/lib/visual-engine/generators/stem-generator';
import { SCHOOL_YEAR } from '@/lib/config';
import { logger } from '@/lib/logger';
import {
  resolveMaterialString,
  resolveStepDetails,
  resolveExercise,
  formatRegistrationFormatText,
} from '@/types/workbook-legacy';
import { extractCalloutBox, type CalloutBoxData } from '@/lib/visual-engine/callout-box';
import { extractComparisonTable, type ComparisonTableData } from '@/lib/visual-engine/comparison-table';
import crypto from 'crypto';
import QRCode from 'qrcode';
import { getVerificationUrl } from '@/lib/digital-signature';
import { formatearBadgeMetodologia } from '@/lib/catalogo-metodologias';
import {
  extractGlossaryTerms,
  stripMarkdown,
  deduplicateMediaAssets,
  extractDiagnosticQuestions,
  extractRealLifeConnection,
  extractSafetyOrCriticalTip,
  buildMetacognitiveTrafficLight,
  type GlossaryItem,
} from '@/lib/visual-engine/content-extractor';
import {
  generateBookCover,
  generateContraportadaData,
  type ContraportadaData,
  type BookCoverOptions,
} from '@/lib/visual-engine/cover-generator';
import {
  loadEditorialFonts,
  setFontHeading,
  setFontBody,
  setFontCaption,
} from '@/lib/visual-engine/font-loader';
import {
  drawMissionBanner,
  drawSectionRibbon,
  drawSessionDivider,
  drawCalloutBox,
  drawDiagnosticSection,
  drawMetacognitiveLight,
  drawPageHeader,
  drawPageFooter,
} from '@/lib/visual-engine/pdf-components';
import {
  ColumnFlowManager,
  type PageContext,
} from '@/lib/visual-engine/column-flow-manager';
import {
  resolveMultipleDigitalToolsForMission,
  generateToolQrPng,
  type DigitalTool,
} from '@/lib/visual-engine/digital-tools-registry';
import {
  generateMissionRubric,
  drawMissionRubricTable,
} from '@/lib/visual-engine/mission-rubric-generator';
import {
  COLOR,
  type RGB,
  getMissionColor,
} from '@/lib/visual-engine/design-tokens';

// ── Paleta de Colores Institucionales DBEPA (Consumida desde Design Tokens) ──
const NAVY: RGB = COLOR.NAVY;
const MID_BLUE: RGB = COLOR.MID_BLUE;
const VINO_PUEBLA: RGB = COLOR.DARK_MAROON;
const GOLD: RGB = COLOR.GOLD;
const DARK_TEXT: RGB = COLOR.TEXT_PRIMARY;
const MUTED_TEXT: RGB = COLOR.MUTED_TEXT;
const LIGHT_BG: RGB = COLOR.LIGHT_BG;
const CODE_BG: RGB = COLOR.TABLE_ALT_ROW;


// Colores de acento para encabezados de sección
const SECTION_COLORS: Record<string, RGB> = {
  enganche: COLOR.NAVY,
  concepto: COLOR.NAVY,
  yoHago: COLOR.TEXT_ACCENT,
  hacemos: COLOR.MISSION[1],
  tuHaces: COLOR.MISSION[3],
  resiliencia: COLOR.DARK_MAROON,
  checkpoint: COLOR.MISSION[2],
  evaluacion: COLOR.MISSION[2],
  diagnostica: COLOR.DIAGNOSTIC_BORDER,
  semaforo: COLOR.MISSION[2],
  vidaReal: COLOR.REAL_LIFE_ACCENT,
};

// ── Geometría de Retícula de 2 Columnas (V6 Sidebar) ────────────────────────
// Página Carta: 215.9 mm × 279.4 mm · Márgen: 14 mm · contentWidth: 187.9 mm
// Zona Principal (68%): 127.6 mm · Sidebar (28%): 52.7 mm · Gap: 3.6 mm
const SIDEBAR_RATIO = 0.28;
const MAIN_RATIO = 0.68;
const SIDEBAR_GAP = 3.6;  // mm entre columna principal y sidebar

/**
 * GUARDIÁN ARQUITECTÓNICO DE ANCHO DE TEXTO — V7
 *
 * Garantiza que NINGÚN valor de ancho de texto exceda el límite de la zona asignada.
 * Toda función de componente DEBE pasar su drawWidth por esta función antes de
 * usarlo en splitTextToSize() o doc.text().
 *
 * Sin este guardián, un caller que pase contentWidth total en lugar de mainW
 * produce desbordamiento hacia el sidebar. Con este guardián, el peor caso
 * es que el texto use el ancho correcto aunque el caller se equivoque.
 *
 * @param drawWidth  El ancho que se pretende usar (puede venir de mainW o contentWidth)
 * @param maxAllowed Límite máximo permitido — SIEMPRE debe ser mainW o sideW según la zona
 * @param padding    Padding interno de la caja (se resta del límite)
 */
function clampTextWidth(drawWidth: number, maxAllowed: number, padding = 0): number {
  return Math.min(drawWidth, maxAllowed) - padding;
}

/** Calcula anchos de la retícula de 2 columnas dado el contentWidth completo */
function getSidebarLayout(contentWidth: number): {
  mainW: number;   // Ancho de la zona de desarrollo principal
  sideW: number;   // Ancho de la columna lateral
  sideX: number;   // X absoluta del inicio del sidebar (relativa al margen izquierdo = margin)
  sideXAbs: number; // X absoluta en el PDF (margin + sideX)
} {
  const mainW = Math.floor(contentWidth * MAIN_RATIO);
  const sideW = Math.floor(contentWidth * SIDEBAR_RATIO);
  const sideX = mainW + SIDEBAR_GAP;
  return { mainW, sideW, sideX, sideXAbs: 0 }; // sideXAbs calculated at call site with margin
}



// ── Mapa de Emojis a Texto WinAnsi Seguro ─────────────────────────────────────
const EMOJI_TO_TEXT: Record<string, string> = {
  '📊': 'DATO',
  '📅': 'FECHA',
  '💬': 'CITA',
  '💡': 'IDEA',
  '⚡': 'CLAVE',
  '★': '•',
  '☆': '•',
  '✓': '•',
  '✔': '•',
};

// Caracteres WinAnsi soportados por fuentes estándar jsPDF (Helvetica)
const WIN_ANSI_REGEX = /[^\x20-\xFF€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ¡-ÿ\n\r\t]/g;

/**
 * Elimina cualquier carácter fuera del juego WinAnsi y reemplaza emojis
 * para evitar corrupción tipográfica (como 'Ø=ÜÅ') en jsPDF Helvetica.
 */
export function sanitizePdfText(text: string | null | undefined): string {
  if (!text) return '';
  let str = text.replace(/<!--[\s\S]*?-->/g, '');
  for (const [emoji, replacement] of Object.entries(EMOJI_TO_TEXT)) {
    if (str.includes(emoji)) {
      str = str.split(emoji).join(replacement);
    }
  }
  return str.replace(WIN_ANSI_REGEX, '');
}

/**
 * Genera el archivo PDF del Libro-Cuaderno de Trabajo Activo del Bloque.
 */
export async function renderWorkbookToPdf(
  workbook: ActiveWorkTextbook,
  planning: Planning,
  options: {
    includeAnswerKey?: boolean;
    coverBuffer?: Buffer;
    forceFallbackCover?: boolean;
  } = {}
): Promise<Buffer> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter',
  });

  // V7: Inicializar fuentes editoriales oficiales (Lato Regular/Bold + Montserrat Bold)
  loadEditorialFonts(doc);

  const pageWidth = doc.internal.pageSize.getWidth();   // 215.9 mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 279.4 mm
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  // Cargar logotipos en Base64
  const logos = await loadAllLogos().catch((e) => {
    logger.warn('[pdf-workbook-renderer] No se pudieron cargar logos institucionales:', { error: e });
    return { gobierno: '', sep: '', supervision: '' };
  });

  let currentY = margin;

  // Preparar opciones unificadas de portada y contraportada (Fase V2)
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

  // Mapa de contexto por página para la segunda pasada de cabeceras y pies editoriales
  const pageContextMap = new Map<number, PageContext>();
  pageContextMap.set(1, { isSpecialPage: true, uacName: coverOpts.uacName });

  // ── 1. Portada Editorial Personalizada (Fase V2/V7 - H-027) ────────────────
  // Si se provee un buffer pre-generado de portada (e.g. subida manual), se incrusta directamente.
  if (options.coverBuffer) {
    doc.addImage(options.coverBuffer, 'JPEG', 0, 0, pageWidth, pageHeight);
  } else {
    const hasFluxKey = Boolean((process.env.FLUX_API_KEY || process.env.TOGETHER_API_KEY || '').trim());
    let coverRendered = false;

    // H-027: Si existe clave FLUX y no se fuerza fallback, intentar portada generativa Tier 1 situada
    if (hasFluxKey && !options.forceFallbackCover) {
      const coverResult = await generateBookCover(coverOpts).catch((e) => {
        logger.warn('[pdf-workbook-renderer] Error generando portada generativa con FLUX:', e);
        return null;
      });

      // Solo usar el buffer generado si es generativo real (Tier 1 FLUX), no fallback SVG con riesgo de tofu
      if (coverResult?.buffer && !coverResult.isFallback) {
        doc.addImage(coverResult.buffer, 'JPEG', 0, 0, pageWidth, pageHeight);
        coverRendered = true;
      }
    }

    const rawMet =
      (workbook as unknown as { methodology?: string }).methodology ||
      planning?.metodologiaActiva ||
      planning?.contentJson?.sectionI?.metodologiaActiva ||
      planning?.contentJson?.sectionIV?.activities?.[workbook.blockIndex]?.methodology;
    const metBadge = formatearBadgeMetodologia(rawMet);

    // Si no hay clave FLUX, falló, o es fallback determinista: dibujar portada vectorial nativa en jsPDF
    // garantizando diseño V7 dark-institutional completo y CERO glifos tofu en Linux/Vercel serverless.
    if (!coverRendered) {
      drawCoverPage(doc, workbook, logos, pageWidth, pageHeight, margin, metBadge);
    }
  }

  // ── 2. Página "Mi plantel / Mi comunidad" (Fase V4) ────────────────────────
  const hasPlantelData = Boolean(
    (workbook.coverData?.schoolName || planning?.contentJson?.sectionI?.schoolName) &&
    (workbook.coverData?.cct || planning?.contentJson?.sectionI?.cct) &&
    (workbook.coverData?.paecProjectName || workbook.projectSection?.communityUtility || planning?.paecContext || planning?.contentJson?.sectionII?.paecConnection)
  );

  let plantelPageNumber: number | null = null;
  if (hasPlantelData) {
    doc.addPage();
    plantelPageNumber = doc.getNumberOfPages();
    pageContextMap.set(plantelPageNumber, { isSpecialPage: true, uacName: coverOpts.uacName });
    drawPlantelComunidadPage(doc, workbook, planning, margin, contentWidth, pageHeight);
  }

  // ── 3. Índice de Misiones (Página Reservada para TOC Real) ───────────────────
  doc.addPage();
  const tocPageNumber = doc.getNumberOfPages();
  pageContextMap.set(tocPageNumber, { isSpecialPage: true, uacName: coverOpts.uacName });
  const tocStartY = margin + 6;

  // ── 4. Misiones Didácticas ─────────────────────────────────────────────────
  const realTocEntries: RealTocEntry[] = [];
  const usedOpenverseAssets: ImageAsset[] = [];
  const assignedAssetKeys = new Set<string>();

  for (let i = 0; i < workbook.missions.length; i++) {
    const mission = workbook.missions[i];
    doc.addPage();
    const missionStartPage = doc.getNumberOfPages();

    const cleanTitle = mission.title
      .replace(/^\[.*?\]\s*/, '')
      .replace(/^misi[oó]n\s*\d+\s*:\s*/i, '')
      .trim();

    realTocEntries.push({
      sectionLabel: `Misión ${i + 1}`,
      title: cleanTitle,
      sessionsRange: `Sesión ${mission.coveredSessions?.join(', ') || `${i * 2 + 1}-${i * 2 + 2}`}`,
      pageNumber: missionStartPage,
    });

    pageContextMap.set(missionStartPage, {
      uacName: workbook.coverData.subjectName,
      missionTitle: `Misión ${i + 1}: ${cleanTitle}`,
      missionColor: getMomentColor(i + 1),
      blockName: workbook.blockName,
      sectionLabel: `Misión ${i + 1}`,
    });

    currentY = margin + 8;
    currentY = await drawMission(
      doc,
      mission,
      i + 1,
      workbook.subsystem,
      margin,
      contentWidth,
      pageHeight,
      currentY,
      workbook.coverData.subjectName,
      planning?.id,
      workbook.blockIndex,
      usedOpenverseAssets,
      pageContextMap,
      workbook.blockName,
      assignedAssetKeys
    );
  }

  // ── 5. Proyecto Integrador Formativo ───────────────────────────────────────
  if (workbook.projectSection) {
    doc.addPage();
    const projectStartPage = doc.getNumberOfPages();
    pageContextMap.set(projectStartPage, {
      uacName: workbook.coverData.subjectName,
      missionTitle: 'Proyecto Integrador PAEC',
      missionColor: NAVY,
      blockName: workbook.blockName,
      sectionLabel: 'Proyecto PAEC',
    });
    realTocEntries.push({
      sectionLabel: 'Proyecto PAEC',
      title: workbook.projectSection.artifactName || 'Proyecto Integrador Comunitario',
      sessionsRange: 'Fases 1 y 2',
      pageNumber: projectStartPage,
    });
    currentY = margin + 8;
    currentY = drawProjectSection(doc, workbook.projectSection, margin, contentWidth, pageHeight, currentY);
  }

  // ── 6. Evaluación Formativa y Sumativa NEM (Rúbrica y Lista de Cotejo) ─────
  if (workbook.evaluationSection) {
    doc.addPage();
    const evalStartPage = doc.getNumberOfPages();
    pageContextMap.set(evalStartPage, {
      uacName: workbook.coverData.subjectName,
      missionTitle: 'Evaluación Formativa y Autovaloración',
      missionColor: NAVY,
      blockName: workbook.blockName,
      sectionLabel: 'Evaluación NEM',
    });
    realTocEntries.push({
      sectionLabel: 'Evaluación NEM',
      title: 'Evaluación Formativa y Autovaloración',
      sessionsRange: 'Sumativa',
      pageNumber: evalStartPage,
    });
    currentY = margin + 8;
    currentY = drawEvaluationSection(doc, workbook.evaluationSection, margin, contentWidth, pageHeight, currentY);
  }

  // ── 7. Renderizado Final del TOC con Números de Página Reales (Fase V4) ────
  const lastContentPage = doc.getNumberOfPages();
  doc.setPage(tocPageNumber);
  drawRealTableOfContents(doc, realTocEntries, margin, contentWidth, tocStartY);
  doc.setPage(lastContentPage);

  // ── 8. Página de Créditos Institucionales y Atribuciones Creative Commons (Fase V5) ──
  doc.addPage();
  const creditsPageNumber = doc.getNumberOfPages();
  pageContextMap.set(creditsPageNumber, {
    uacName: workbook.coverData.subjectName,
    missionTitle: 'Créditos y Atribuciones',
    missionColor: NAVY,
    blockName: workbook.blockName,
  });
  const uniqueOpenverseAssets = deduplicateMediaAssets(usedOpenverseAssets);
  const bookHash = crypto
    .createHash('sha256')
    .update(`${coverOpts.cct}|${coverOpts.uacName}|${coverOpts.cicloEscolar}|sigpda-ems-mccems-2026`)
    .digest('hex');

  drawCreditsPage(
    doc,
    uniqueOpenverseAssets,
    workbook,
    margin,
    contentWidth,
    pageHeight,
    bookHash
  );

  // ── 9. Contraportada Institucional con QR y Sello Criptográfico ───────────
  doc.addPage();
  const contraportadaPageNumber = doc.getNumberOfPages();
  pageContextMap.set(contraportadaPageNumber, { isSpecialPage: true, uacName: coverOpts.uacName });
  const contraportadaData = await generateContraportadaData({ ...coverOpts, hash: bookHash }).catch((e) => {
    logger.warn('[pdf-workbook-renderer] Error generando datos de contraportada:', e);
    return null;
  });

  if (contraportadaData) {
    drawContraportadaPage(doc, contraportadaData, pageWidth, pageHeight, margin);
  }

  // ── 10. SEGUNDA PASADA: Encabezados y Pies de Página Editoriales ───────────
  // Ajuste 2: Se ejecuta estrictamente después de renderizar todo el contenido.
  // Excluye con variables dinámicas: Portada (1), Plantel (si existe), TOC y Contraportada.
  const totalPages = doc.getNumberOfPages();
  const excludedPages = new Set<number>([1]);
  if (plantelPageNumber !== null) {
    excludedPages.add(plantelPageNumber);
  }
  if (tocPageNumber !== null) {
    excludedPages.add(tocPageNumber);
  }
  excludedPages.add(totalPages); // Contraportada

  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);

    if (excludedPages.has(p)) {
      continue;
    }

    let ctx = pageContextMap.get(p);
    if (ctx?.isSpecialPage) {
      continue;
    }

    // Si una página interna no tiene contexto explícito, heredar del anterior no especial
    if (!ctx) {
      for (let prev = p - 1; prev >= 1; prev--) {
        const prevCtx = pageContextMap.get(prev);
        if (prevCtx && !prevCtx.isSpecialPage) {
          ctx = prevCtx;
          pageContextMap.set(p, ctx);
          break;
        }
      }
    }

    const uacName = ctx?.uacName || workbook.coverData.subjectName;
    const missionTitle = ctx?.missionTitle;
    const missionColor = ctx?.missionColor || NAVY;

    // Cabecera Editorial oficial V7
    drawPageHeader(doc, {
      uacName,
      missionTitle,
      margin,
      contentWidth,
      y: 8,
      missionColor,
      isEvenPage: p % 2 === 0,
    });

    // Pie de Página Editorial oficial V7
    drawPageFooter(doc, {
      schoolName: workbook.coverData?.schoolName,
      cct: workbook.coverData?.cct,
      pageNum: p,
      totalPages,
      margin,
      contentWidth,
      pageHeight,
      blockName: ctx?.blockName || workbook.blockName,
    });
  }

  return Buffer.from(doc.output('arraybuffer'));
}

// ── Secciones Específicas del PDF ───────────────────────────────────────────

function drawCoverPage(
  doc: jsPDF,
  workbook: ActiveWorkTextbook,
  logos: { gobierno?: string; sep?: string; supervision?: string },
  pageWidth: number,
  pageHeight: number,
  margin: number,
  metBadge: string = '[Metodología: Activa]'
) {
  const contentWidth = pageWidth - margin * 2;

  // 1. Fondo completo Dark Navy (#07101E)
  doc.setFillColor(7, 16, 30);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  // 2. Encabezado Institucional Superior (y: 0 - 24mm)
  doc.setFillColor(6, 12, 22);
  doc.rect(0, 0, pageWidth, 24, 'F');
  doc.setFillColor(232, 160, 32); // Línea dorada de acento
  doc.rect(0, 23.4, pageWidth, 0.6, 'F');

  // Logotipos oficiales en encabezado
  if (logos.gobierno) {
    try {
      const fmt = logos.gobierno.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG';
      doc.addImage(logos.gobierno, fmt, margin, 4, 25, 12);
    } catch (e) {
      logger.warn('[pdf-workbook-renderer] Error insertando logo de gobierno:', { error: e });
    }
  }
  if (logos.sep) {
    try {
      const fmt = logos.sep.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG';
      doc.addImage(logos.sep, fmt, pageWidth - margin - 25, 4.5, 25, 11);
    } catch (e) {
      logger.warn('[pdf-workbook-renderer] Error insertando logo de SEP:', { error: e });
    }
  }

  setFontHeading(doc);
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text('SECRETARÍA DE EDUCACIÓN PÚBLICA DEL ESTADO DE PUEBLA', pageWidth / 2, 8.5, { align: 'center' });

  doc.setFontSize(7.2);
  doc.setTextColor(232, 160, 32);
  doc.text('DIRECCIÓN DE BACHILLERATOS ESTATALES Y PREPARATORIA ABIERTA (DBEPA)', pageWidth / 2, 13.8, { align: 'center' });

  setFontBody(doc, 'normal');
  doc.setFontSize(6.2);
  doc.setTextColor(203, 213, 225);
  doc.text(`SUBSECRETARÍA DE EDUCACIÓN MEDIA SUPERIOR · MCCEMS ${SCHOOL_YEAR}`, pageWidth / 2, 19, { align: 'center' });

  // 3. Ficha del Plantel y Subsistema (y: 28 - 49mm)
  doc.setFillColor(11, 27, 51);
  doc.roundedRect(margin, 28, contentWidth, 21, 2.5, 2.5, 'F');
  doc.setDrawColor(46, 116, 181);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, 28, contentWidth, 21, 2.5, 2.5, 'S');

  // Barra de acento dorada lateral izquierda
  doc.setFillColor(232, 160, 32);
  doc.roundedRect(margin, 28, 2.5, 21, 1, 1, 'F');

  const schoolName = (workbook.coverData?.schoolName || 'Bachillerato General Oficial').toUpperCase();
  setFontHeading(doc);
  doc.setFontSize(9.5);
  doc.setTextColor(255, 255, 255);
  const schoolLines = doc.splitTextToSize(schoolName, contentWidth - 14);
  doc.text(schoolLines[0], margin + 6, 34);

  const cct = workbook.coverData?.cct || '21ECT0017T';
  const subsistema = (workbook.subsystem || 'BGE').toUpperCase();
  const rawSem = workbook.coverData?.semester;
  const semStr = rawSem ? (String(rawSem).toLowerCase().includes('semestre') ? String(rawSem) : `${rawSem}° Semestre`) : 'Segundo Semestre';

  setFontHeading(doc);
  doc.setFontSize(7.2);
  doc.setTextColor(232, 160, 32);
  doc.text(`CLAVE C.C.T.: ${cct}   ·   SUBSISTEMA: ${subsistema}   ·   ${semStr.toUpperCase()}`, margin + 6, 40.5);

  setFontBody(doc, 'normal');
  doc.setFontSize(6.2);
  doc.setTextColor(203, 213, 225);
  doc.text(`Ciclo Escolar Oficial ${SCHOOL_YEAR}   |   Coordinación de Desarrollo Curricular EMS Puebla`, margin + 6, 45.5);

  // 4. Núcleo Editorial Hero UAC (y: 52 - 190mm)
  doc.setFillColor(8, 20, 38);
  doc.roundedRect(margin, 52, contentWidth, 138, 3, 3, 'F');
  doc.setDrawColor(31, 56, 100);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, 52, contentWidth, 138, 3, 3, 'S');

  // Badges superiores
  doc.setFillColor(31, 56, 100);
  doc.setDrawColor(46, 116, 181);
  doc.setLineWidth(0.2);
  doc.roundedRect(margin + 6, 56, 52, 5.5, 1.2, 1.2, 'FD');
  setFontHeading(doc);
  doc.setFontSize(5.8);
  doc.setTextColor(246, 201, 14);
  doc.text('NUEVA ESCUELA MEXICANA (NEM)', margin + 32, 59.8, { align: 'center' });

  // Badge Metodología Activa Oficial
  doc.setFillColor(15, 35, 65);
  doc.setDrawColor(56, 189, 248);
  doc.setLineWidth(0.2);
  doc.roundedRect(margin + 61, 56, 68, 5.5, 1.2, 1.2, 'FD');
  setFontHeading(doc);
  doc.setFontSize(5.8);
  doc.setTextColor(56, 189, 248);
  doc.text(metBadge, margin + 61 + 34, 59.8, { align: 'center' });

  setFontHeading(doc);
  doc.setFontSize(5.8);
  doc.setTextColor(203, 213, 225);
  doc.text('RECURSO SOCIOCOGNITIVO', margin + 132, 59.8);

  // Título Principal UAC con auto-escalado
  const rawTitle = (workbook.coverData?.subjectName || workbook.blockName || 'CUADERNO DE APRENDIZAJE ACTIVO').toUpperCase();
  let titleFontSize = 18;
  const maxTitleW = contentWidth - 16;
  while (titleFontSize > 12) {
    doc.setFontSize(titleFontSize);
    const testLines = doc.splitTextToSize(rawTitle, maxTitleW);
    if (testLines.length <= 2) break;
    titleFontSize -= 0.5;
  }
  setFontHeading(doc);
  doc.setFontSize(titleFontSize);
  doc.setTextColor(255, 255, 255);
  const titleLines = doc.splitTextToSize(rawTitle, maxTitleW);
  doc.text(titleLines, margin + 8, 70);
  const yDivider = 70 + (titleLines.length - 1) * (titleFontSize * 0.42) + 5;

  // Divisor dorado
  doc.setDrawColor(232, 160, 32);
  doc.setLineWidth(0.7);
  doc.line(margin + 8, yDivider, pageWidth - margin - 8, yDivider);

  // Bloque curricular formativo
  const yBlock = yDivider + 4;
  doc.setFillColor(13, 30, 56);
  doc.setDrawColor(46, 116, 181);
  doc.setLineWidth(0.2);
  doc.roundedRect(margin + 8, yBlock, contentWidth - 16, 18, 1.8, 1.8, 'FD');

  setFontHeading(doc);
  doc.setFontSize(6.5);
  doc.setTextColor(232, 160, 32);
  doc.text(`ORGANIZACIÓN CURRICULAR POR PROGRESIONES   ·   ${metBadge}`, margin + 12, yBlock + 5);

  const blockTitle = workbook.blockName
    ? ((workbook.blockIndex !== undefined ? `BLOQUE ${workbook.blockIndex + 1}: ` : '') + workbook.blockName)
    : 'FORMACIÓN FUNDAMENTAL Y LABORAL';
  setFontHeading(doc);
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  const bLines = doc.splitTextToSize(blockTitle, contentWidth - 24);
  doc.text(bLines.slice(0, 2), margin + 12, yBlock + 11.5);

  // Proyecto PAEC (si está disponible)
  let yPillars = yBlock + 21;
  if (workbook.coverData?.paecProjectName) {
    const yPaec = yBlock + 21;
    doc.setFillColor(128, 0, 32);
    doc.setDrawColor(248, 113, 113);
    doc.setLineWidth(0.2);
    doc.roundedRect(margin + 8, yPaec, contentWidth - 16, 14, 1.8, 1.8, 'FD');

    setFontHeading(doc);
    doc.setFontSize(6.2);
    doc.setTextColor(248, 113, 113);
    doc.text('PROYECTO ESCOLAR COMUNITARIO (PAEC)', margin + 12, yPaec + 4.5);

    setFontBody(doc, 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(255, 255, 255);
    const paecLines = doc.splitTextToSize(workbook.coverData.paecProjectName, contentWidth - 24);
    doc.text(paecLines.slice(0, 1), margin + 12, yPaec + 9.5);
    yPillars = yPaec + 17;
  }

  // 4 Pilares del Aprendizaje Activo
  setFontHeading(doc);
  doc.setFontSize(6.2);
  doc.setTextColor(203, 213, 225);
  doc.text('ARQUITECTURA DE APRENDIZAJE ACTIVO:', margin + 8, yPillars + 3);

  const pillSpacing = 2.5;
  const pillW = (contentWidth - 16 - pillSpacing * 3) / 4;
  const pillars = ['1. Concepto Cero', '2. Práctica Guiada', '3. Reto Autónomo', '4. Rúbrica & Resiliencia'];
  pillars.forEach((pText, pIdx) => {
    const px = margin + 8 + pIdx * (pillW + pillSpacing);
    doc.setFillColor(31, 56, 100);
    doc.roundedRect(px, yPillars + 5, pillW, 7, 1.2, 1.2, 'F');
    setFontHeading(doc);
    doc.setFontSize(5.8);
    doc.setTextColor(255, 255, 255);
    doc.text(pText, px + pillW / 2, yPillars + 9.5, { align: 'center' });
  });

  // 5. Tarjeta Inferior de Identidad y Alumno (y: 194 - 262mm)
  doc.setFillColor(11, 25, 44);
  doc.roundedRect(margin, 194, contentWidth, 68, 2.5, 2.5, 'F');
  doc.setDrawColor(232, 160, 32);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, 194, contentWidth, 68, 2.5, 2.5, 'S');

  setFontHeading(doc);
  doc.setFontSize(12);
  doc.setTextColor(232, 160, 32);
  doc.text('CUADERNO DE APRENDIZAJE ACTIVO', margin + 8, 202);

  setFontHeading(doc);
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text('Edición Oficial para el Estudiante · Con Espacios Interactivos y Talleres de Aplicación', margin + 8, 207);

  setFontBody(doc, 'normal');
  doc.setFontSize(6.2);
  doc.setTextColor(203, 213, 225);
  doc.text('Diseñado para el desarrollo de progresiones de aprendizaje, pensamiento crítico y proyectos integradores.', margin + 8, 211.5);

  const teacherText = `Docente Titular: ${workbook.coverData?.teacherName || 'Docente de Bachillerato'}`;
  setFontBody(doc, 'bold');
  doc.setFontSize(7);
  doc.setTextColor(232, 160, 32);
  doc.text(teacherText, margin + 8, 217);

  // Casillas de datos para el alumno
  const box1W = 86;
  doc.setFillColor(19, 39, 67);
  doc.setDrawColor(46, 116, 181);
  doc.setLineWidth(0.2);
  doc.roundedRect(margin + 8, 221, box1W, 18, 1.5, 1.5, 'FD');
  setFontHeading(doc);
  doc.setFontSize(5.8);
  doc.setTextColor(226, 232, 240);
  doc.text('NOMBRE DEL ESTUDIANTE:', margin + 11, 226);
  doc.setDrawColor(71, 85, 105);
  doc.line(margin + 11, 234, margin + 83, 234);

  const box2X = margin + 98;
  const box2W = 38;
  doc.setFillColor(19, 39, 67);
  doc.setDrawColor(46, 116, 181);
  doc.setLineWidth(0.2);
  doc.roundedRect(box2X, 221, box2W, 18, 1.5, 1.5, 'FD');
  setFontHeading(doc);
  doc.setFontSize(5.8);
  doc.setTextColor(226, 232, 240);
  doc.text('GRUPO / TURNO:', box2X + 3, 226);
  doc.setDrawColor(71, 85, 105);
  doc.line(box2X + 3, 234, box2X + box2W - 3, 234);

  const box3X = margin + 140;
  const box3W = contentWidth - 148;
  doc.setFillColor(19, 39, 67);
  doc.setDrawColor(46, 116, 181);
  doc.setLineWidth(0.2);
  doc.roundedRect(box3X, 221, box3W, 18, 1.5, 1.5, 'FD');
  setFontHeading(doc);
  doc.setFontSize(5.8);
  doc.setTextColor(226, 232, 240);
  doc.text('NÚMERO DE LISTA:', box3X + 3, 226);
  doc.setDrawColor(71, 85, 105);
  doc.line(box3X + 3, 234, box3X + box3W - 3, 234);

  setFontBody(doc, 'normal');
  doc.setFontSize(6.2);
  doc.setTextColor(203, 213, 225);
  doc.text(`Subsistema Oficial: ${(workbook.subsystem || 'BGE').toUpperCase()} · Modalidad Escolarizada · Ciclo Escolar: ${SCHOOL_YEAR}`, margin + 8, 255);

  // 6. Cintillo de Pie Oficial (y: 266 - 279.4mm)
  doc.setFillColor(4, 8, 16);
  doc.rect(0, 266, pageWidth, 13.4, 'F');
  setFontBody(doc, 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(203, 213, 225);
  doc.text(`PUEBLA, MÉXICO · SECRETARÍA DE EDUCACIÓN PÚBLICA · SISTEMA SIGPDA-EMS MCCEMS ${SCHOOL_YEAR}`, pageWidth / 2, 274, { align: 'center' });
}

/**
 * Renderiza la página de créditos institucionales y atribuciones Creative Commons (Fase V5).
 * Se ubica como la última página interior antes de la contraportada.
 */
function drawCreditsPage(
  doc: jsPDF,
  uniqueAssets: ImageAsset[],
  workbook: ActiveWorkTextbook,
  margin: number,
  contentWidth: number,
  pageHeight: number,
  bookHash: string
) {
  let y = margin + 8;

  // 1. Encabezado de la Página de Créditos
  doc.setFillColor(...NAVY);
  doc.rect(margin, y, contentWidth, 8, 'F');
  setFontBody(doc, 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text('CRÉDITOS INSTITUCIONALES Y ATRIBUCIONES LEGALES', margin + contentWidth / 2, y + 5.5, { align: 'center' });
  y += 12;

  // Subtítulo y Marco Curricular
  setFontBody(doc, 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...DARK_TEXT);
  doc.text('MARCO CURRICULAR COMÚN DE LA EDUCACIÓN MEDIA SUPERIOR (MCCEMS 2026-2027)', margin, y);
  y += 4.5;

  setFontBody(doc, 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(...MUTED_TEXT);
  const introLines = doc.splitTextToSize(
    'Cuaderno de Aprendizaje Activo diseñado e impreso en estricto apego a los lineamientos pedagógicos de la Nueva Escuela Mexicana (NEM). Los recursos didácticos, esquemas formativos y materiales visuales integran licenciamientos abiertos y derechos de autor con fines exclusivamente formativos y educativos.',
    contentWidth
  );
  doc.text(introLines, margin, y);
  y += introLines.length * 3.3 + 4;

  // 2. Sección de Atribuciones Creative Commons
  setFontBody(doc, 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...MID_BLUE);
  doc.text('RECURSOS VISUALES Y ATRIBUCIONES CREATIVE COMMONS', margin, y);
  y += 4;

  if (uniqueAssets.length > 0) {
    const tableBody = uniqueAssets.map((asset, idx) => {
      const cleanTitle = sanitizePdfText(stripMarkdown(asset.title || 'Fotografía didáctica'));
      const cleanCreator = sanitizePdfText(stripMarkdown(asset.creator || 'Autor no especificado'));
      const cleanLic = sanitizePdfText(stripMarkdown(asset.license || 'CC BY-SA'));
      const rawSource = asset.sourceUrl || asset.externalId || 'Openverse API';
      const cleanSource = sanitizePdfText(stripMarkdown(rawSource));
      return [
        `Fig. ${idx + 1}`,
        cleanTitle.length > 35 ? cleanTitle.slice(0, 32) + '...' : cleanTitle,
        cleanCreator.length > 25 ? cleanCreator.slice(0, 22) + '...' : cleanCreator,
        cleanLic,
        cleanSource.length > 38 ? cleanSource.slice(0, 35) + '...' : cleanSource,
      ];
    });

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Ref.', 'Título de la Obra', 'Autor / Creador', 'Licencia CC', 'Fuente / Repositorio']],
      body: tableBody,
      theme: 'grid',
      headStyles: { fillColor: MID_BLUE, textColor: [255, 255, 255], fontSize: 7, fontStyle: 'bold' },
      styles: { fontSize: 6.8, cellPadding: 2, textColor: DARK_TEXT },
      columnStyles: {
        0: { cellWidth: 14 },
        1: { cellWidth: Math.floor(contentWidth * 0.30) },
        2: { cellWidth: Math.floor(contentWidth * 0.24) },
        3: { cellWidth: 26 },
        4: { cellWidth: 'auto' },
      },
    });

    y = doc.lastAutoTable?.finalY ?? (y + 40);
    y += 6;
  } else {
    // Si no se usaron fotos externas, documentar esquematización vectorial interna
    doc.setFillColor(...LIGHT_BG);
    doc.roundedRect(margin, y, contentWidth, 14, 2, 2, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, y, contentWidth, 14, 2, 2, 'S');
    setFontCaption(doc);
    doc.setFontSize(7);
    doc.setTextColor(...DARK_TEXT);
    const noPhotoLines = doc.splitTextToSize(
      'Iconografía Vectorial Pedagógica: Todos los organizadores gráficos, diagramas de flujo y esquemas visuales integrados en este cuaderno didáctico fueron modelados y renderizados directamente por el motor didáctico SIGPDA-EMS bajo el Marco Curricular Común de la EMS.',
      contentWidth - 6
    );
    doc.text(noPhotoLines, margin + 3, y + 5);
    y += 18;
  }

  // 3. Directorio Institucional y Equipo Editorial
  setFontBody(doc, 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...NAVY);
  doc.text('DIRECTORIO INSTITUCIONAL Y PRODUCCIÓN EDITORIAL', margin, y);
  y += 4;

  const plantelName = sanitizePdfText(workbook.coverData?.schoolName || 'Bachillerato General Oficial');
  const cct = sanitizePdfText(workbook.coverData?.cct || '21ECT0017T');
  const docente = sanitizePdfText(workbook.coverData?.teacherName || 'Academia Docente del Plantel');
  const uac = sanitizePdfText(workbook.coverData?.subjectName || workbook.blockName);

  const credRows = [
    ['Dirección General:', 'Secretaría de Educación Pública del Estado de Puebla'],
    ['Subsecretaría:', 'Subsecretaría de Educación Media Superior'],
    ['Dirección de Área:', 'Dirección de Bachilleratos Estatales y Preparatoria Abierta (DBEPA)'],
    ['Plataforma:', 'Sistema Integral de Gestión Pedagógica y Docente Activa (SIGPDA-EMS)'],
    ['Plantel Educativo:', `${plantelName} (CCT: ${cct})`],
    ['Unidad de Aprendizaje:', `${uac} · ${workbook.blockName}`],
    ['Docente Titular:', docente],
    ['Ciclo Escolar:', SCHOOL_YEAR],
  ];

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    body: credRows,
    theme: 'plain',
    styles: { fontSize: 7, cellPadding: 1.4, textColor: DARK_TEXT },
    columnStyles: {
      0: { cellWidth: 42, fontStyle: 'bold', textColor: NAVY },
      1: { cellWidth: 'auto' },
    },
  });

  y = doc.lastAutoTable?.finalY ?? (y + 35);
  y += 6;

  // 4. Folio Criptográfico Digital SHA-256
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(margin, y, contentWidth, 14, 2, 2, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, y, contentWidth, 14, 2, 2, 'S');
  setFontBody(doc, 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...NAVY);
  doc.text('FOLIO DIGITAL DE AUTENTICIDAD CRIPTOGRÁFICA (SHA-256):', margin + 3, y + 4.5);
  doc.setFont('courier', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...DARK_TEXT);
  doc.text(bookHash, margin + 3, y + 9.5);
}

/**
 * Renderiza la contraportada formal con ficha de acreditación, sello criptográfico y QR (Fase V2).
 */
function drawContraportadaPage(
  doc: jsPDF,
  data: ContraportadaData,
  pageWidth: number,
  pageHeight: number,
  margin: number
) {
  const contentWidth = pageWidth - margin * 2;

  // Fondo institucional sutil
  doc.setFillColor(...LIGHT_BG);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  // Franja superior institucional
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageWidth, 28, 'F');
  doc.setFillColor(...GOLD);
  doc.rect(0, 27, pageWidth, 1.5, 'F');

  setFontBody(doc, 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(255, 255, 255);
  doc.text(
    'SISTEMA INTEGRAL DE GESTIÓN Y PLANEACIÓN DIDÁCTICA AUTÓNOMA (SIGPDA-EMS)',
    pageWidth / 2,
    17,
    { align: 'center' }
  );

  // Tarjeta central de acreditación
  let y = 38;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.8);
  doc.roundedRect(margin, y, contentWidth, 182, 4, 4, 'FD');

  // Encabezado de la tarjeta
  doc.setFillColor(...NAVY);
  doc.rect(margin, y, contentWidth, 14, 'F');
  setFontBody(doc, 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(255, 255, 255);
  doc.text('FICHA DE ACREDITACIÓN CURRICULAR Y SELLO INSTITUCIONAL', pageWidth / 2, y + 9.5, {
    align: 'center',
  });

  y += 24;

  // Grid de datos escolares
  const dataItems = [
    { label: 'PLANTEL:', value: data.plantelNombre },
    { label: 'CLAVE C.C.T.:', value: data.cct },
    { label: 'SUBSISTEMA:', value: `${data.subsystem} · BACHILLERATO ESTATAL` },
    { label: 'ASIGNATURA (UAC):', value: data.uacName },
    { label: 'SEMESTRE / CICLO:', value: `${data.semestre} · CICLO ESCOLAR ${data.cicloEscolar}` },
    { label: 'DOCENTE TITULAR:', value: data.docente },
    { label: 'PROYECTO PAEC:', value: data.paecProjectName },
  ];

  for (const item of dataItems) {
    setFontBody(doc, 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...NAVY);
    doc.text(item.label, margin + 8, y);

    setFontBody(doc, 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...DARK_TEXT);
    doc.text(item.value, margin + 46, y);

    doc.setDrawColor(230, 235, 245);
    doc.setLineWidth(0.2);
    doc.line(margin + 8, y + 2.5, margin + contentWidth - 8, y + 2.5);

    y += 9.5;
  }

  y += 6;

  // Código QR y Sello Digital
  const qrBoxSize = 46; // 46 mm
  const qrX = pageWidth / 2 - qrBoxSize / 2;

  // Marco para el QR
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(...MID_BLUE);
  doc.setLineWidth(0.5);
  doc.roundedRect(qrX - 4, y, qrBoxSize + 8, qrBoxSize + 8, 3, 3, 'FD');

  try {
    doc.addImage(data.qrBuffer, 'PNG', qrX, y + 4, qrBoxSize, qrBoxSize);
  } catch (e) {
    logger.warn('[pdf-workbook-renderer] Error insertando QR en contraportada:', e);
  }

  y += qrBoxSize + 14;

  // Folio y Leyendas
  setFontBody(doc, 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text('FOLIO DE CONTROL CRIPTOGRÁFICO INSTITUCIONAL:', pageWidth / 2, y, { align: 'center' });

  y += 5;
  doc.setFont('courier', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...MID_BLUE);
  doc.text(data.hash.slice(0, 36) + '...', pageWidth / 2, y, { align: 'center' });

  y += 6;
  setFontBody(doc, 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED_TEXT);
  doc.text(`Enlace de validación: ${data.verificationUrl}`, pageWidth / 2, y, { align: 'center' });

  // Tarjeta de aviso legal / institucional inferior
  y = 228;
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, y, contentWidth, 30, 3, 3, 'FD');

  setFontBody(doc, 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...NAVY);
  doc.text('AVISO DE INTEGRIDAD Y DERECHOS CURRICULARES MCCEMS', margin + 6, y + 6);

  setFontBody(doc, 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(...MUTED_TEXT);
  const legalLines = [
    'Documento oficial generado bajo los lineamientos pedagógicos del MCCEMS 2026-2027 y las directrices de la Dirección de',
    'Bachilleratos Estatales y Preparatoria Abierta (DBEPA Puebla). El contenido de este cuaderno activo es para uso escolar exclusivo.',
    'Escanee el código QR institucional para verificar la vigencia de la planeación y la acreditación de la academia docente.',
  ];
  let ly = y + 12;
  for (const line of legalLines) {
    doc.text(line, margin + 6, ly);
    ly += 4.5;
  }

  // Franja inferior
  doc.setFillColor(...NAVY);
  doc.rect(0, pageHeight - 12, pageWidth, 12, 'F');
  setFontBody(doc, 'normal');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text(
    'SECRETARÍA DE EDUCACIÓN DE PUEBLA · DIRECCIÓN DE BACHILLERATOS ESTATALES Y PREPARATORIA ABIERTA (DBEPA)',
    pageWidth / 2,
    pageHeight - 5,
    { align: 'center' }
  );
}

/**
 * Garantiza espacio vertical suficiente antes de dibujar un bloque o tabla.
 * Si no cabe, añade una página y reinicia currentY.
 */
export function ensureVerticalSpace(
  doc: jsPDF,
  currentY: number,
  neededHeight: number,
  margin: number,
  pageHeight: number
): number {
  if (currentY + neededHeight > pageHeight - margin - 8) {
    doc.addPage();
    return margin + 8;
  }
  return currentY;
}

/**
 * Dibuja anotaciones de texto del Visual Engine en el PDF usando jsPDF.
 * Convierte coordenadas del viewBox SVG a coordenadas del PDF.
 *
 * @param doc Documento jsPDF
 * @param annotations Lista de anotaciones del generador visual
 * @param imgX Posición X de la imagen PNG insertada en el PDF (mm)
 * @param imgY Posición Y de la imagen PNG insertada en el PDF (mm)
 * @param imgW Ancho de la imagen PNG en el PDF (mm)
 * @param imgH Alto de la imagen PNG en el PDF (mm)
 * @param svgWidth Ancho del viewBox SVG (unidades SVG, default 500)
 * @param svgHeight Alto del viewBox SVG (unidades SVG, default 350)
 */
function drawVisualAnnotations(
  doc: jsPDF,
  annotations: VisualAnnotation[],
  imgX: number,
  imgY: number,
  imgW: number,
  imgH: number,
  svgWidth = 500,
  svgHeight = 350,
): void {
  const scaleX = imgW / svgWidth;
  const scaleY = imgH / svgHeight;

  for (const ann of annotations) {
    const pdfX = imgX + ann.svgX * scaleX;
    const pdfY = imgY + ann.svgY * scaleY;

    // Escalar tamaño de fuente proporcionalmente
    const scaledSize = Math.max(4, ann.fontSize * scaleX * 2.6);
    doc.setFontSize(scaledSize);
    setFontBody(doc, ann.bold ? 'bold' : 'normal');

    // Parsear color hex a RGB
    const hex = (ann.color || '#1e293b').replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    doc.setTextColor(r, g, b);

    const jsAlign = ann.align === 'end' ? 'right' : ann.align || 'left';
    doc.text(ann.text, pdfX, pdfY, { align: jsAlign });
  }
}

/**
 * Imprime un párrafo de texto multilínea con partición y salto de página automático.
 * Evita que el texto se corte al final del margen inferior de la página.
 */
export function printParagraph(
  doc: jsPDF,
  text: string,
  startY: number,
  margin: number,
  contentWidth: number,
  pageHeight: number,
  options: {
    size?: number;
    fontStyle?: 'normal' | 'bold' | 'italic';
    fontName?: 'helvetica' | 'courier';
    color?: [number, number, number];
    lineHeight?: number;
    justify?: boolean;
    parseParagraphs?: boolean;
    paragraphSpacing?: number;
  } = {}
): number {
  const {
    size = 9.0,
    fontStyle = 'normal',
    fontName = 'helvetica',
    color = DARK_TEXT,
    lineHeight = 4.8,
    justify = true,
    parseParagraphs = false,
    paragraphSpacing = 3.5,
  } = options;

  // Sanitizar texto en una sola pasada al inicio: elimina asteriscos markdown y caracteres no-WinAnsi
  const cleanText = sanitizePdfText(stripMarkdown(text || ''));

  doc.setFont(fontName, fontStyle);
  doc.setFontSize(size);
  doc.setTextColor(...color);

  let y = startY;

  if (parseParagraphs) {
    const stepProtected = cleanText
      .replace(/(?:^|\n|\.\s+)(Paso\s+\d+\s*[:\-])/gi, '\n\n$1')
      .replace(/(?:^|\n)(\d+[\.\)]\s+)/g, '\n\n$1')
      .replace(/(?:^|\n)([•\-\*]\s+)/g, '\n\n$1');
    const rawParagraphs = stepProtected.split(/\r?\n\r?\n/).map((p) => p.trim()).filter(Boolean);
    for (let pIdx = 0; pIdx < rawParagraphs.length; pIdx++) {
      const p = rawParagraphs[pIdx];
      const isBullet = /^[•\-\*]\s+/.test(p) || /^\d+[\.\)]\s+/.test(p);
      const leftMargin = isBullet ? margin + 3.5 : margin;
      const pWidth = isBullet ? contentWidth - 3.5 : contentWidth;
      const lines = doc.splitTextToSize(p, pWidth);

      for (let i = 0; i < lines.length; i++) {
        if (y + lineHeight > pageHeight - margin - 8) {
          doc.addPage();
          y = margin + 8;
          doc.setFont(fontName, fontStyle);
          doc.setFontSize(size);
          doc.setTextColor(...color);
        }
        const isLastLine = i === lines.length - 1;
        if (justify && !isLastLine && !isBullet) {
          doc.text(lines[i], leftMargin, y, { maxWidth: pWidth, align: 'justify' });
        } else {
          doc.text(lines[i], leftMargin, y);
        }
        y += lineHeight;
      }
      if (pIdx < rawParagraphs.length - 1) {
        y += paragraphSpacing;
      }
    }
    return y;
  }

  const lines = doc.splitTextToSize(cleanText, contentWidth);

  for (let i = 0; i < lines.length; i++) {
    if (y + lineHeight > pageHeight - margin - 8) {
      doc.addPage();
      y = margin + 8;
      doc.setFont(fontName, fontStyle);
      doc.setFontSize(size);
      doc.setTextColor(...color);
    }
    const isLastLine = i === lines.length - 1;
    if (justify && !isLastLine) {
      doc.text(lines[i], margin, y, { maxWidth: contentWidth, align: 'justify' });
    } else {
      doc.text(lines[i], margin, y);
    }
    y += lineHeight;
  }

  return y;
}

/**
 * Fallback pedagógico oficial de la Nueva Escuela Mexicana (NEM - DBEPA Puebla).
 */
export function getOfficialNemFallback(level: 'sobresaliente' | 'notable' | 'suficiente' | 'insuficiente'): string {
  switch (level) {
    case 'sobresaliente':
      return 'Demuestra dominio integral y autónomo de los aprendizajes, aplicando los saberes en contextos reales con rigor y creatividad.';
    case 'notable':
      return 'Cumple satisfactoriamente con los criterios formativos esenciales, demostrando comprensión sólida con mínimas áreas de oportunidad.';
    case 'suficiente':
      return 'Alcanza el nivel básico de desempeño requerido para el aprendizaje; requiere guía puntual para consolidar la aplicación práctica.';
    case 'insuficiente':
      return 'Demuestra dificultades significativas en la comprensión o ejecución del criterio; requiere acompañamiento y retroalimentación formativa inmediata.';
  }
}

/**
 * Obtiene el descriptor en español oficial NEM para un nivel de rúbrica.
 * Normaliza nombres en inglés ('needs support', etc.) y provee descripción pedagógica completa.
 */
export function getRubricLevelDescriptor(
  levels: unknown,
  targetLevel: 'sobresaliente' | 'notable' | 'suficiente' | 'insuficiente'
): string {
  if (!levels) {
    return getOfficialNemFallback(targetLevel);
  }

  // 1. Si levels es un objeto tipo { sobresaliente: "...", notable: "..." }
  if (typeof levels === 'object' && !Array.isArray(levels)) {
    const lvlObj = levels as Record<string, unknown>;
    const directVal = lvlObj[targetLevel];
    if (typeof directVal === 'string' && directVal.trim().length > 3) {
      return directVal.trim();
    }
    const aliases: Record<string, string[]> = {
      sobresaliente: ['sobresaliente', 'excelente', 'avanzado', '10-9'],
      notable: ['notable', 'bueno', 'competente', '8-7'],
      suficiente: ['suficiente', 'básico', 'en desarrollo', '6-5'],
      insuficiente: ['insuficiente', 'requiere apoyo', 'inicial', '4-1'],
    };
    const targets = aliases[targetLevel] || [];
    for (const [k, v] of Object.entries(lvlObj)) {
      const kLower = k.toLowerCase().trim();
      if (targets.some((t) => kLower.includes(t)) && typeof v === 'string' && v.trim().length > 3) {
        return v.trim();
      }
    }
  }

  // 2. Si levels es un array tipo [ { levelName: '...', descriptor: '...' } ]
  if (Array.isArray(levels) && levels.length > 0) {
    const lvlArr = levels as Array<{ levelName?: string; descriptor?: string } | null | undefined>;
    const aliases: Record<string, string[]> = {
      sobresaliente: ['sobresaliente', 'excelente', 'avanzado', '10-9', 'expert', 'excellent', 'outstanding'],
      notable: ['notable', 'bueno', 'competente', '8-7', 'proficient', 'good', 'satisfactory'],
      suficiente: ['suficiente', 'básico', 'en desarrollo', '6-5', 'basic', 'sufficient', 'developing'],
      insuficiente: ['insuficiente', 'requiere apoyo', 'inicial', '4-1', 'needs support', 'needs improvement', 'unsatisfactory', 'inadequate'],
    };

    const targets = aliases[targetLevel] || [];
    for (const l of lvlArr) {
      if (!l) continue;
      const nameLower = (l.levelName || '').toLowerCase().trim();
      if (targets.some((t) => nameLower.includes(t)) && l.descriptor && l.descriptor.trim().length > 3) {
        return l.descriptor.trim();
      }
    }

    const indexMap = { sobresaliente: 0, notable: 1, suficiente: 2, insuficiente: 3 };
    const idx = indexMap[targetLevel];
    const candidate = lvlArr[idx];
    if (candidate && candidate.descriptor && candidate.descriptor.trim().length > 5) {
      return candidate.descriptor.trim();
    }
  }

  return getOfficialNemFallback(targetLevel);
}

export interface RealTocEntry {
  sectionLabel: string;
  title: string;
  sessionsRange: string;
  pageNumber: number;
}

function drawRealTableOfContents(
  doc: jsPDF,
  entries: RealTocEntry[],
  margin: number,
  contentWidth: number,
  startY: number
) {
  setFontBody(doc, 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...NAVY);
  doc.text('ÍNDICE GENERAL Y DOSIFICACIÓN DIDÁCTICA', margin, startY);

  setFontBody(doc, 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...DARK_TEXT);
  doc.text(
    'Estructura de misiones pedagógicas, proyectos comunitarios y evaluaciones con su paginación oficial:',
    margin,
    startY + 5
  );

  const tableBody = entries.map((e) => [
    sanitizePdfText(stripMarkdown(e.sectionLabel)),
    sanitizePdfText(stripMarkdown(e.title)),
    sanitizePdfText(stripMarkdown(e.sessionsRange)),
    `Pág. ${e.pageNumber}`,
  ]);

  autoTable(doc, {
    startY: startY + 8,
    margin: { left: margin, right: margin },
    head: [['Misión / Sección', 'Título y Desafío Didáctico', 'Sesiones Cubiertas', 'Página']],
    body: tableBody,
    theme: 'grid',
    headStyles: {
      fillColor: NAVY,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 2.2,
      textColor: DARK_TEXT,
    },
    columnStyles: {
      0: { cellWidth: 26, fontStyle: 'bold' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 38 },
      3: { cellWidth: 20, halign: 'center', fontStyle: 'bold', textColor: NAVY },
    },
  });
}

function drawPlantelComunidadPage(
  doc: jsPDF,
  workbook: ActiveWorkTextbook,
  planning: Planning | null | undefined,
  margin: number,
  contentWidth: number,
  pageHeight: number
) {
  let y = margin + 6;

  // Franja superior institucional
  doc.setFillColor(...NAVY);
  doc.rect(margin, y, contentWidth, 12, 'F');
  doc.setFillColor(...GOLD);
  doc.rect(margin, y + 11.2, contentWidth, 0.8, 'F');

  setFontBody(doc, 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(255, 255, 255);
  doc.text('IDENTIDAD DEL PLANTEL Y VINCULACIÓN COMUNITARIA', margin + 5, y + 8);

  y += 18;

  setFontBody(doc, 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...NAVY);
  doc.text(`DIRECCIÓN DE BACHILLERATOS ESTATALES Y PREPARATORIA ABIERTA · MCCEMS ${SCHOOL_YEAR}`, margin, y);
  y += 5;

  setFontBody(doc, 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(...DARK_TEXT);
  doc.text(
    'Ficha técnica institucional de contexto escolar y contextualización del Proyecto de Aula, Escuela y Comunidad (PAEC):',
    margin,
    y
  );
  y += 6;

  const rawSchoolName = workbook.coverData?.schoolName || planning?.contentJson?.sectionI?.schoolName || 'Bachillerato General Oficial';
  const schoolName = sanitizePdfText(stripMarkdown(rawSchoolName));
  const cct = sanitizePdfText(workbook.coverData?.cct || planning?.contentJson?.sectionI?.cct || '21ECT0017T');
  const subsystem = sanitizePdfText((workbook.subsystem || planning?.contentJson?.sectionI?.subsystem || 'BGE').toUpperCase());
  const coverExtra = workbook.coverData as Record<string, unknown> | undefined;
  const municipality = sanitizePdfText(typeof coverExtra?.municipality === 'string' ? coverExtra.municipality : 'Puebla, Pue.');
  const teacherName = sanitizePdfText(stripMarkdown(workbook.coverData?.teacherName || planning?.contentJson?.sectionI?.teacherName || 'Academia Docente del Plantel'));
  const subjectName = sanitizePdfText(stripMarkdown(workbook.coverData?.subjectName || workbook.blockName || planning?.uacName || 'Formación Fundamental'));

  const semRaw = workbook.coverData?.semester;
  const semClean = semRaw !== undefined
    ? String(semRaw).replace(/"/g, '').replace(/\bSEMESTRE\b(\s+SEMESTRE\b)+/gi, 'SEMESTRE').trim()
    : 'Segundo Semestre';
  const semesterStr = sanitizePdfText(/\bsemestre\b/i.test(semClean) ? semClean : `${semClean}° Semestre`);

  const paecProjectName = sanitizePdfText(stripMarkdown(workbook.coverData?.paecProjectName || workbook.projectSection?.artifactName || planning?.paecContext || 'Transformación Productiva y Social Comunitaria'));
  const paecProblem = typeof coverExtra?.paecProblem === 'string' ? coverExtra.paecProblem : undefined;
  const paecChallenge = sanitizePdfText(stripMarkdown(workbook.projectSection?.communityUtility || paecProblem || planning?.paecContext || 'Atención prioritaria al desarrollo comunitario y sustentabilidad local.'));

  const rawMet =
    (workbook as unknown as { methodology?: string }).methodology ||
    planning?.metodologiaActiva ||
    planning?.contentJson?.sectionI?.metodologiaActiva ||
    planning?.contentJson?.sectionIV?.activities?.[workbook.blockIndex]?.methodology;
  const metBadge = formatearBadgeMetodologia(rawMet);

  // Tabla 1: Ficha Institucional
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Dato Institucional', 'Información Oficial Registrada']],
    body: [
      ['Plantel Educativo:', schoolName],
      ['Clave de Centro de Trabajo (CCT):', cct],
      ['Subsistema de Educación Media Superior:', subsystem],
      ['Municipio / Región Territorial:', municipality],
      ['Unidad de Aprendizaje Curricular (UAC):', subjectName],
      ['Semestre y Ciclo Escolar:', `${semesterStr} · Ciclo Escolar ${SCHOOL_YEAR}`],
      ['Docente Titular / Responsable de Asignatura:', teacherName],
      ['Metodología Activa:', metBadge],
    ],
    theme: 'grid',
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    styles: { fontSize: 7.5, cellPadding: 2.2, textColor: DARK_TEXT },
    columnStyles: {
      0: { cellWidth: 60, fontStyle: 'bold', textColor: NAVY },
      1: { cellWidth: 'auto' },
    },
  });

  y = doc.lastAutoTable!.finalY + 8;

  // Bloque PAEC
  setFontBody(doc, 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...NAVY);
  doc.text('Proyecto de Aula, Escuela y Comunidad (PAEC) — Eje Articulador Territorial:', margin, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Eje del Proyecto Comunitario', 'Diagnóstico y Desafío Situado']],
    body: [
      ['Denominación del Proyecto PAEC:', paecProjectName],
      ['Problemática / Reto Comunitario:', paecChallenge],
      [
        'Articulación con el Libro de Trabajo:',
        'Las misiones didácticas integradas en este libro proporcionan el andamiaje teórico, experimental y técnico para que los estudiantes generen artefactos útiles orientados a transformar positivamente su entorno comunitario.',
      ],
    ],
    theme: 'grid',
    headStyles: { fillColor: VINO_PUEBLA, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    styles: { fontSize: 7.5, cellPadding: 2.2, textColor: DARK_TEXT },
    columnStyles: {
      0: { cellWidth: 60, fontStyle: 'bold', textColor: VINO_PUEBLA },
      1: { cellWidth: 'auto' },
    },
  });

  y = doc.lastAutoTable!.finalY + 12;

  // Cuadro de Compromisos y Acreditación de Firmas
  y = ensureVerticalSpace(doc, y, 32, margin, pageHeight);
  setFontBody(doc, 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...NAVY);
  doc.text('Validación Colegiada y Autorización Escolar:', margin, y);
  y += 5;

  const colW = (contentWidth - 10) / 3;
  const sigY = y + 14;

  // Línea 1: Docente Titular
  doc.setDrawColor(180, 190, 205);
  doc.setLineWidth(0.4);
  doc.line(margin, sigY, margin + colW, sigY);
  setFontBody(doc, 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(...DARK_TEXT);
  doc.text('Docente Titular de la UAC', margin + colW / 2, sigY + 3.5, { align: 'center' });
  setFontCaption(doc);
  doc.setFontSize(6);
  doc.setTextColor(...MUTED_TEXT);
  doc.text('Firma y Fecha de Aplicación', margin + colW / 2, sigY + 6.5, { align: 'center' });

  // Línea 2: Presidente de Academia
  const col2X = margin + colW + 5;
  doc.line(col2X, sigY, col2X + colW, sigY);
  setFontBody(doc, 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(...DARK_TEXT);
  doc.text('Presidente de Academia de Área', col2X + colW / 2, sigY + 3.5, { align: 'center' });
  setFontCaption(doc);
  doc.setFontSize(6);
  doc.setTextColor(...MUTED_TEXT);
  doc.text('Validación Pedagógica Colegiada', col2X + colW / 2, sigY + 6.5, { align: 'center' });

  // Línea 3: Dirección del Plantel
  const col3X = col2X + colW + 5;
  doc.line(col3X, sigY, col3X + colW, sigY);
  setFontBody(doc, 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(...DARK_TEXT);
  doc.text('Dirección del Plantel / Sello CCT', col3X + colW / 2, sigY + 3.5, { align: 'center' });
  setFontCaption(doc);
  doc.setFontSize(6);
  doc.setTextColor(...MUTED_TEXT);
  doc.text('Autorización y Resguardo Escolar', col3X + colW / 2, sigY + 6.5, { align: 'center' });
}

function drawPdfGlossaryBox(
  doc: jsPDF,
  terms: GlossaryItem[],
  margin: number,
  drawWidth: number,   // CONTRATO: debe ser mainW cuando se llama desde drawMission
  pageHeight: number,
  startY: number
): number {
  if (!terms || terms.length === 0) return startY;

  const cleanTerms = terms.map((t) => ({
    term: sanitizePdfText(stripMarkdown(t.term)),
    definition: sanitizePdfText(stripMarkdown(t.definition)),
  }));

  // GUARDIÁN: ancho de texto clampeado
  const safeTermW = clampTextWidth(drawWidth, drawWidth, 14);

  let totalDefLines = 0;
  for (const item of cleanTerms) {
    const lines = doc.splitTextToSize(`${item.term}: ${item.definition}`, safeTermW);
    totalDefLines += lines.length;
  }
  const boxHeight = Math.max(18, 9 + totalDefLines * 3.8);

  const y = ensureVerticalSpace(doc, startY, boxHeight + 4, margin, pageHeight);

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, y, drawWidth, boxHeight, 1.5, 1.5, 'F');

  doc.setFillColor(...VINO_PUEBLA);
  doc.roundedRect(margin, y, 3.5, boxHeight, 1.2, 1.2, 'F');

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, drawWidth, boxHeight, 1.5, 1.5, 'S');

  setFontBody(doc, 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(...VINO_PUEBLA);
  doc.text('GLOSARIO CONCEPTUAL CLAVE DE LA MISION (MCCEMS):', margin + 7, y + 4.8);

  let textY = y + 8.8;
  for (const item of cleanTerms) {
    setFontBody(doc, 'bold');
    doc.setFontSize(7.6);
    doc.setTextColor(...NAVY);
    const prefix = `• ${item.term}: `;
    doc.text(prefix, margin + 7, textY);
    const prefixWidth = doc.getTextWidth(prefix);

    setFontBody(doc, 'normal');
    doc.setFontSize(7.4);
    doc.setTextColor(...DARK_TEXT);
    // GUARDIÁN: la definición nunca supera safeTermW - prefixWidth
    const safeDefW = clampTextWidth(drawWidth, drawWidth, 14 + prefixWidth);
    const defLines = doc.splitTextToSize(item.definition, safeDefW);
    doc.text(defLines, margin + 7 + prefixWidth, textY);
    textY += Math.max(4.2, defLines.length * 3.6 + 1.5);
  }

  return y + boxHeight + 4;
}

/**
 * Retorna el color de acento editorial para una misión según su número.
 * Obtiene el color funcional desde el token system central (COLOR.MISSION).
 */
function getMomentColor(missionNumber: number): RGB {
  return getMissionColor(missionNumber);
}

function drawSectionHeader(
  doc: jsPDF,
  title: string,
  margin: number,
  contentWidth: number,
  y: number,
  pageHeight: number,
  themeColor: [number, number, number] = NAVY,
  ensureSpaceFn?: (y: number, neededH: number) => number,
  badge?: string
): number {
  const ribbonHeight = 7.5;
  const checkSpace = ensureSpaceFn || ((cy: number, nh: number) => ensureVerticalSpace(doc, cy, nh, margin, pageHeight));
  y = checkSpace(y, ribbonHeight + 12);

  // Separador visual fino entre secciones
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.setLineWidth(0.2);
  doc.setLineDashPattern([2, 3], 0);
  doc.line(margin, y - 2, margin + contentWidth, y - 2);
  doc.setLineDashPattern([], 0);

  return drawSectionRibbon(doc, {
    title,
    margin,
    drawWidth: contentWidth,
    y,
    themeColor,
    ribbonHeight,
    badge,
  });
}

function drawPdfCallout(
  doc: jsPDF,
  callout: CalloutBoxData,
  margin: number,
  drawWidth: number,   // CONTRATO: debe ser mainW cuando se llama desde drawMission
  pageHeight: number,
  y: number,
  ensureSpaceFn?: (y: number, neededH: number) => number
): number {
  const checkSpace = ensureSpaceFn || ((cy: number, nh: number) => ensureVerticalSpace(doc, cy, nh, margin, pageHeight));
  y = checkSpace(y, 22);
  return drawCalloutBox(doc, callout, margin, drawWidth, y);
}

function drawPdfComparisonTable(
  doc: jsPDF,
  tableData: ComparisonTableData,
  margin: number,
  contentWidth: number,
  pageHeight: number,
  y: number,
  ensureSpaceFn?: (y: number, neededH: number) => number
): number {
  if (!tableData.rows || tableData.rows.length === 0) return y;

  const cleanTitle = tableData.title ? sanitizePdfText(stripMarkdown(tableData.title)) : '';
  const headerHeight = cleanTitle ? 10 : 4;
  const checkSpace = ensureSpaceFn || ((cy: number, nh: number) => ensureVerticalSpace(doc, cy, nh, margin, pageHeight));
  y = checkSpace(y, 32 + headerHeight);

  if (cleanTitle) {
    setFontBody(doc, 'bold');
    doc.setFontSize(8.2);
    doc.setTextColor(...NAVY);
    doc.text(cleanTitle, margin, y);
    y += 4.5;
  }

  const cleanHeaders = [
    sanitizePdfText(stripMarkdown(tableData.headers[0] || 'Criterio')),
    sanitizePdfText(stripMarkdown(tableData.headers[1] || 'Descripción')),
  ];
  const cleanRows = tableData.rows.map((r) => [
    sanitizePdfText(stripMarkdown(r[0])),
    sanitizePdfText(stripMarkdown(r[1])),
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    head: [cleanHeaders],
    body: cleanRows,
    theme: 'grid',
    headStyles: {
      fillColor: MID_BLUE,
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold',
      cellPadding: 2.5,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    styles: {
      fontSize: 7.2,
      cellPadding: 2.2,
      textColor: DARK_TEXT,
      lineColor: [226, 232, 240],
      lineWidth: 0.25,
      overflow: 'linebreak',
    },
    columnStyles: {
      0: { cellWidth: Math.floor(contentWidth * 0.42), fontStyle: 'bold' },
      1: { cellWidth: 'auto' },
    },
  });

  y = doc.lastAutoTable?.finalY ?? (y + 25);

  if (tableData.caption) {
    setFontCaption(doc);
    doc.setFontSize(6.8);
    doc.setTextColor(...MUTED_TEXT);
    doc.text(tableData.caption, margin, y + 3.5);
    y += 5.5;
  }

  return y + 2;
}

function drawPracticeTasksWithDottedLines(
  doc: jsPDF,
  rawText: string,
  margin: number,
  drawWidth: number,   // CONTRATO: debe ser mainW cuando se llama desde drawMission
  pageHeight: number,
  y: number,
  defaultTaskCount: number = 3,
  ensureSpaceFn?: (y: number, neededH: number) => number
): number {
  if (!rawText) return y;

  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.includes('<!--') && !l.includes('-->'));
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

  const validTasks = tasks
    .map((t) => sanitizePdfText(stripMarkdown(t)).trim())
    .filter((t) => t.length > 5);

  const selectedTasks = validTasks.slice(0, 4);
  if (selectedTasks.length === 0) {
    const cleanRaw = sanitizePdfText(stripMarkdown(rawText)).trim();
    if (!cleanRaw) return y;
    return printParagraph(doc, cleanRaw, y, margin, drawWidth, pageHeight, {
      size: 8,
      fontStyle: 'normal',
      color: DARK_TEXT,
      lineHeight: 3.8,
    });
  }

  const checkSpace = ensureSpaceFn || ((cy: number, nh: number) => ensureVerticalSpace(doc, cy, nh, margin, pageHeight));

  for (let idx = 0; idx < selectedTasks.length; idx++) {
    const cleanTaskText = selectedTasks[idx];
    // GUARDIÁN: texto de tarea nunca excede drawWidth
    const taskLines = doc.splitTextToSize(`[  ] Tarea ${idx + 1}: ${cleanTaskText}`, clampTextWidth(drawWidth, drawWidth, 4));
    const neededH = taskLines.length * 4 + 18;
    y = checkSpace(y, neededH);

    setFontBody(doc, 'bold');
    doc.setFontSize(7.8);
    doc.setTextColor(...DARK_TEXT);
    taskLines.forEach((tl: string, i: number) => {
      doc.text(tl, margin + 2, y + i * 4);
    });
    y += taskLines.length * 4 + 2.5;

    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.setLineDashPattern([1, 1.5], 0);

    y += 4.5;
    doc.line(margin + 6, y, margin + drawWidth, y);
    y += 4.5;
    doc.line(margin + 6, y, margin + drawWidth, y);

    doc.setLineDashPattern([], 0);
    y += 3.5;
  }

  return y + 2;
}

async function drawMission(
  doc: jsPDF,
  mission: MissionSection,
  missionNumber: number,
  subsystem: string,
  margin: number,
  contentWidth: number,
  pageHeight: number,
  startY: number,
  subjectName?: string,
  planningId?: string,
  blockIndex?: number,
  openverseCollector?: ImageAsset[],
  pageContextMap?: Map<number, PageContext>,
  blockName?: string,
  assignedAssetKeys?: Set<string>
): Promise<number> {
  let y = startY;

  // ── V7: Pre-calcular geometría de dos columnas ───────────────────────────────
  const { mainW, sideW } = getSidebarLayout(contentWidth);
  const sideXAbs = margin + mainW + SIDEBAR_GAP;

  // Sanitizar título de misión
  const cleanMissionTitle = sanitizePdfText(stripMarkdown(
    mission.title
      .replace(/^\[.*?\]\s*/, '')
      .replace(/^misi[oó]n\s*\d+\s*:\s*/i, '')
      .trim()
  ));

  // Glosario para sidebar (extraído del coreExplanation)
  const sidebarGlossary = extractGlossaryTerms(mission.conceptZero?.coreExplanation || '');

  // Conexión con vida real: provista en el tipo o extraída determinísticamente
  const realLifeConn = mission.realLifeConnection ||
    extractRealLifeConnection(
      `${mission.phenomenonHook?.story || ''} ${mission.conceptZero?.coreExplanation || ''} ${mission.youDoSection?.autonomousChallenge || ''}`,
      subjectName || 'la asignatura'
    );

  // Tip de seguridad: provisto o extraído
  const safetyTip = mission.safetyOrWorkshopTip ||
    extractSafetyOrCriticalTip(
      `${mission.iDoSection?.stepByStepDemo || ''} ${mission.conceptZero?.coreExplanation || ''}`,
      subsystem
    );

  // Hash QR de la misión (para sidebar)
  const hashMission = crypto
    .createHash('sha256')
    .update(`${planningId || 'sigpda'}|${blockIndex ?? 0}|${missionNumber}`)
    .digest('hex');
  const missionVerificationUrl = getVerificationUrl(hashMission);

  let qrBuf: Buffer | undefined;
  try {
    qrBuf = await QRCode.toBuffer(missionVerificationUrl, {
      type: 'png',
      margin: 1,
      width: 120,
      color: { dark: '#1F3864', light: '#FFFFFF' },
    });
  } catch {
    /* QR opcional */
  }

  const momentColor = getMomentColor(missionNumber);

  // ── V7 Nivel 1: Resolución de Imagen Contextual por Contenido (Equipo Técnico) ──
  const equipmentVisual = await resolveEquipmentVisualForMission(mission, subjectName, {
    preferSidebar: true,
  });

  if (equipmentVisual?.mediaAsset && openverseCollector) {
    openverseCollector.push(equipmentVisual.mediaAsset);
  }

  // ── V8: Herramienta(s) Digital(es) MCCEMS y QR Raster (14x14mm) ────────────
  const digitalToolsPayload: Array<{ tool: DigitalTool; qrPngBuffer?: Buffer }> = [];
  const resolvedDigitalTools = resolveMultipleDigitalToolsForMission(
    subjectName || '',
    mission.title || '',
    `${mission.sessionTopic || ''} ${mission.sessionFocus || ''}`,
    2
  );
  for (const tool of resolvedDigitalTools) {
    try {
      const toolQrBuf = await generateToolQrPng(tool.url);
      digitalToolsPayload.push({
        tool,
        qrPngBuffer: toolQrBuf,
      });
    } catch {
      digitalToolsPayload.push({ tool });
    }
  }

  // ── Capa 5: Motor de Flujo de Columnas y Sidebar Rotativo V7 ───────────────
  const flow = new ColumnFlowManager({
    doc,
    margin,
    contentWidth,
    pageHeight,
    mainW,
    sideW,
    sideXAbs,
    pageContextMap: pageContextMap || new Map(),
    subjectName: subjectName || 'UAC',
    blockName: blockName || 'Bloque',
    missionNumber,
    cleanMissionTitle,
    momentColor,
    qrBuffer: qrBuf,
    verificationUrl: missionVerificationUrl,
    missionHash: hashMission,
    glossaryTerms: sidebarGlossary,
    realLifeConnection: realLifeConn,
    safetyTip,
    physicalAnalogy: mission.conceptZero?.physicalAnalogy,
    equipmentCard: equipmentVisual && !equipmentVisual.isHero ? {
      detected: equipmentVisual.detected,
      imageBuffer: equipmentVisual.buffer,
      imageFormat: equipmentVisual.format,
    } : null,
    digitalTool: digitalToolsPayload[0] || null,
    digitalTools: digitalToolsPayload,
  });

  const checkSpace = (cy: number, nh: number) => flow.ensureVerticalSpace(cy, nh);

  // ── V7: Banner Editorial de Misión ────────
  const bannerH = 22;
  y = checkSpace(y, bannerH + 4);

  y = drawMissionBanner(doc, {
    missionNumber,
    title: cleanMissionTitle,
    sessionFocus: mission.sessionFocus,
    uacLabel: subjectName || 'UAC',
    sessionsStr: mission.coveredSessions?.join(', ') || `${missionNumber * 2 - 1}-${missionNumber * 2}`,
    momentColor,
    margin,
    mainW,
    contentWidth,
    y,
    bannerH,
  });

  // Inicializar primera página del sidebar rotativo
  flow.initFirstPage(y);

  // ── V7.1: Determinación de Sesiones Asignadas y Divisores Editoriales ─────────
  const coveredSessions = (mission.coveredSessions && mission.coveredSessions.length > 0)
    ? mission.coveredSessions
    : [missionNumber * 2 - 1, missionNumber * 2];

  // ── Sesión 1: Apertura y Modelado ───────────────────────────────────────────
  const s1 = coveredSessions[0];
  const s1Phase = coveredSessions.length === 1
    ? 'APERTURA, MODELADO Y PRACTICA'
    : 'APERTURA Y MODELADO CONCEPTUAL';
  y = checkSpace(y, 14);
  y = drawSessionDivider(doc, {
    sessionNumber: s1,
    durationMin: 50,
    phaseLabel: s1Phase,
    themeColor: COLOR.PHASE_APERTURA,
    margin,
    drawWidth: mainW,
    y,
  });

  // ── V7: Evaluación Diagnóstica (al inicio de la misión) ─────────────────────
  const diagEval = mission.diagnosticEvaluation ||
    extractDiagnosticQuestions(
      `${mission.phenomenonHook?.story || ''} ${mission.conceptZero?.coreExplanation || ''}`,
      subjectName || 'la asignatura'
    );

  if (diagEval && diagEval.questions && diagEval.questions.length > 0) {
    const diagQs = diagEval.questions.slice(0, 3);
    const estDiagH = Math.max(28, 12 + diagQs.length * 9);
    y = checkSpace(y, estDiagH + 4);

    y = drawDiagnosticSection(
      doc,
      { context: diagEval.context, questions: diagQs },
      margin,
      mainW,
      y
    );
  }

  // 1. Enganche y Desafío Situado
  y = drawSectionHeader(doc, '1. Enganche y Desafio Situado en la Comunidad', margin, mainW, y, pageHeight, SECTION_COLORS.enganche, checkSpace, '[ SITUACION REAL ]');
  y = flow.printMainParagraph(mission.phenomenonHook.story, y, { size: 8, color: DARK_TEXT, lineHeight: 4.0, parseParagraphs: true });
  y += 3;

  // Pregunta Detonadora en caja destacada
  const detText = sanitizePdfText(stripMarkdown(`Pregunta Detonadora: ${mission.phenomenonHook.detonatingQuestion}`));
  setFontBody(doc, 'bold');
  doc.setFontSize(8.5);
  const detLines = doc.splitTextToSize(detText, mainW - 12);
  const detBoxH = Math.max(18, detLines.length * 4.2 + 8);
  y = checkSpace(y, detBoxH + 4);

  doc.setFillColor(254, 243, 199);
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, y, mainW, detBoxH, 1.5, 1.5, 'FD');
  setFontBody(doc, 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...NAVY);
  doc.text(detLines, margin + 5, y + 5.5);
  y += detBoxH + 6;

  // 2. Concepto Cero
  y = drawSectionHeader(doc, '2. Concepto Cero: Analogia Intuitiva y Fundamento', margin, mainW, y, pageHeight, SECTION_COLORS.concepto, checkSpace, '[ LEO Y COMPRENDO ]');
  y = flow.printMainParagraph(`Analogia Fisica Cotidiana: ${mission.conceptZero.physicalAnalogy}`, y, { size: 8, fontStyle: 'italic', color: DARK_TEXT, lineHeight: 4.0 });
  y += 2;
  y = flow.printMainParagraph(mission.conceptZero.coreExplanation, y, { size: 8, color: DARK_TEXT, lineHeight: 4.0, parseParagraphs: true });
  y += 3;

  if (mission.conceptZero.narrativeExplanation) {
    y = flow.printMainParagraph(mission.conceptZero.narrativeExplanation, y, { size: 8, color: DARK_TEXT, lineHeight: 4.0, parseParagraphs: true });
    y += 4;
  }

  // Tarjeta de Idea Clave destacada (Callout)
  const conceptFullText = `${mission.conceptZero.physicalAnalogy || ''}\n${mission.conceptZero.coreExplanation || ''}\n${mission.conceptZero.narrativeExplanation || ''}`;
  const conceptCallout = extractCalloutBox(conceptFullText, {
    missionNumber,
    defaultType: 'idea_clave',
    defaultTitle: 'Idea Clave de la Mision',
    defaultSubjectName: subjectName,
  });
  if (conceptCallout) {
    y = drawPdfCallout(doc, conceptCallout, margin, mainW, pageHeight, y, checkSpace);
  }

  // Ejemplo Resuelto Paso a Paso (CPA / NEM)
  if (mission.conceptZero.solvedExample) {
    const ex = mission.conceptZero.solvedExample;
    y = checkSpace(y, 32);
    setFontBody(doc, 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...NAVY);
    doc.text('Ejemplo Modelo Resuelto Paso a Paso:', margin, y);
    y += 4.5;

    y = flow.printMainParagraph(`Problema: ${ex.problemStatement}`, y, { size: 8, fontStyle: 'bold', color: DARK_TEXT });
    y += 2;

    for (let sIdx = 0; sIdx < (ex.solutionSteps || []).length; sIdx++) {
      const step = ex.solutionSteps[sIdx];
      y = flow.printMainParagraph(`Paso ${sIdx + 1}: ${step}`, y, { size: 7.8, color: DARK_TEXT, lineHeight: 3.8 });
    }
    y += 2;

    if (ex.interpretation) {
      y = flow.printMainParagraph(`Conclusion pedagogica: ${ex.interpretation}`, y, { size: 7.8, fontStyle: 'italic', color: MID_BLUE, lineHeight: 3.8 });
      y += 4;
    }
  }

  // Tabla de Contraste (Concepto vs. Error Común)
  if (mission.conceptZero.contrastTable && mission.conceptZero.contrastTable.length > 0) {
    y = checkSpace(y, 30);
    setFontBody(doc, 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...NAVY);
    doc.text('Matriz de Contrastacion Conceptual y Prevencion de Errores:', margin, y);
    y += 4.5;

    const contrastBody = mission.conceptZero.contrastTable.map((row) => [
      sanitizePdfText(stripMarkdown(row.correctConcept)),
      sanitizePdfText(stripMarkdown(row.commonMisconception)),
      sanitizePdfText(stripMarkdown(row.reasoning)),
    ]);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      tableWidth: mainW,
      head: [['Concepto Valido', 'Error Frecuente', 'Fundamentacion']],
      body: contrastBody,
      theme: 'grid',
      headStyles: { fillColor: MID_BLUE, textColor: [255, 255, 255], fontSize: 7.5, fontStyle: 'bold' },
      styles: { fontSize: 7.2, cellPadding: 2, textColor: DARK_TEXT },
      columnStyles: {
        0: { cellWidth: Math.floor(mainW * 0.35) },
        1: { cellWidth: Math.floor(mainW * 0.35) },
        2: { cellWidth: 'auto' },
      },
      didDrawPage: (data) => flow.onAutoTablePage(data.pageNumber),
    });

    y = doc.lastAutoTable?.finalY ?? (y + 30);
    y += 6;
  } else {
    const compTable = extractComparisonTable(conceptFullText, cleanMissionTitle, subjectName);
    if (compTable) {
      y = drawPdfComparisonTable(doc, compTable, margin, mainW, pageHeight, y, checkSpace);
    }
  }

  y += 4;

  // ── 2.05 Glosario en zona principal (complementa el sidebar) ───────────────
  const glossaryTerms = extractGlossaryTerms(mission.conceptZero?.coreExplanation || '');
  if (glossaryTerms && glossaryTerms.length >= 3) {
    y = checkSpace(y, 28);
    y = drawPdfGlossaryBox(doc, glossaryTerms, margin, mainW, pageHeight, y);
  }

  // ── 2.1 Gráfico Conceptual STEM o Fotografía Situacional ─────────────────
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

    const subjectIsStem = isStemSubject(subjectName);

    if (subjectIsStem) {
      // ── RAMA STEM: Siempre gráfica vectorial matemática/científica ──────────
      // El equipmentVisual va al sidebar (equipmentCard en ColumnFlowManager).
      // NO bloqueamos la gráfica conceptual con el blueprint de equipo.
      const resolvedVisual = await resolveVisualForMission({
        planningId,
        uacName: subjectName,
        blockIndex: blockIndex ?? 0,
        missionIndex: missionNumber,
        missionTitle: mission.title,
        contextText,
        preferOpenverseMedia: false, // Forzar vector SVG para STEM — fotos son irrelevantes en Matemáticas
        usedAssetIds: assignedAssetKeys,
      });
      if (resolvedVisual?.type === 'vector_svg' && resolvedVisual.svg) {
        const imgResult = await svgToPngBuffer(resolvedVisual.svg);
        if (imgResult) {
          const imgW = Math.min(mainW * 0.92, 124);
          const imgH = imgW * 0.68;
          y = checkSpace(y, imgH + 18);
          const imgX = margin + (mainW - imgW) / 2;
          doc.addImage(imgResult.buffer, imgResult.format, imgX, y, imgW, imgH);
          if (resolvedVisual.annotations && resolvedVisual.annotations.length > 0) {
            drawVisualAnnotations(doc, resolvedVisual.annotations, imgX, y, imgW, imgH);
          }
          y += imgH + 3.5;
          setFontCaption(doc);
          doc.setFontSize(7.5);
          doc.setTextColor(...MUTED_TEXT);
          const captionLines = doc.splitTextToSize(resolvedVisual.caption, mainW * 0.88);
          doc.text(captionLines, margin + mainW / 2, y, { align: 'center' });
          y += (captionLines.length * 3.2) + 4;
        }
      }
    } else if (equipmentVisual && equipmentVisual.isHero) {
      // ── RAMA NO-STEM (hero): Imagen contextual de equipo/herramienta ────────
      const imgW = Math.min(105, mainW * 0.85);
      const imgH = 55;
      y = checkSpace(y, imgH + 16);
      const imgX = margin + (mainW - imgW) / 2;
      doc.addImage(equipmentVisual.buffer, equipmentVisual.format, imgX, y, imgW, imgH);
      y += imgH + 3.5;
      setFontCaption(doc);
      doc.setFontSize(7.5);
      doc.setTextColor(...MUTED_TEXT);
      const captionLines = doc.splitTextToSize(equipmentVisual.caption, mainW * 0.88);
      doc.text(captionLines, margin + mainW / 2, y, { align: 'center' });
      y += (captionLines.length * 3.2) + 4;
    } else {
      // ── RAMA NO-STEM (fallback): Openverse o vector genérico ────────────────
      const resolvedVisual = await resolveVisualForMission({
        planningId,
        uacName: subjectName,
        blockIndex: blockIndex ?? 0,
        missionIndex: missionNumber,
        missionTitle: mission.title,
        contextText,
        preferOpenverseMedia: true,
        usedAssetIds: assignedAssetKeys,
      });
      if (resolvedVisual) {
        if (resolvedVisual.type === 'vector_svg' && resolvedVisual.svg) {
          const imgResult = await svgToPngBuffer(resolvedVisual.svg);
          if (imgResult) {
            const imgW = Math.min(120, mainW * 0.88);
            const imgH = imgW * 0.65;
            y = checkSpace(y, imgH + 16);
            const imgX = margin + (mainW - imgW) / 2;
            doc.addImage(imgResult.buffer, imgResult.format, imgX, y, imgW, imgH);
            if (resolvedVisual.annotations && resolvedVisual.annotations.length > 0) {
              drawVisualAnnotations(doc, resolvedVisual.annotations, imgX, y, imgW, imgH);
            }
            y += imgH + 3.5;
            setFontCaption(doc);
            doc.setFontSize(7.5);
            doc.setTextColor(...MUTED_TEXT);
            const captionLines = doc.splitTextToSize(resolvedVisual.caption, mainW * 0.88);
            doc.text(captionLines, margin + mainW / 2, y, { align: 'center' });
            y += (captionLines.length * 3.2) + 3.5;
          }
        } else if (resolvedVisual.type === 'openverse_media' && resolvedVisual.mediaAsset) {
          const imgUrl = resolvedVisual.mediaAsset.thumbnailUrl || resolvedVisual.mediaAsset.imageUrl;
          const imgResult = await downloadAndProcessImage(imgUrl);
          if (imgResult) {
            if (openverseCollector) {
              openverseCollector.push(resolvedVisual.mediaAsset);
            }
            const imgW = Math.min(120, mainW * 0.88);
            const ratio = imgResult.height / imgResult.width;
            const imgH = Math.min(80, Math.max(50, imgW * (ratio || 0.65)));
            y = checkSpace(y, imgH + 18);
            const imgX = margin + (mainW - imgW) / 2;
            doc.addImage(imgResult.buffer, imgResult.format, imgX, y, imgW, imgH);
            y += imgH + 3.5;
            setFontCaption(doc);
            doc.setFontSize(7.5);
            doc.setTextColor(...MUTED_TEXT);
            const captionLines = doc.splitTextToSize(resolvedVisual.caption, mainW * 0.88);
            doc.text(captionLines, margin + mainW / 2, y, { align: 'center' });
            y += (captionLines.length * 3.2) + 4;
          }
        }
      }
    }
  }

  // Si la misión abarca 3 o más sesiones, la Sesión 2 inicia en el Modelado Docente
  if (coveredSessions.length >= 3) {
    y = checkSpace(y, 14);
    y = drawSessionDivider(doc, {
      sessionNumber: coveredSessions[1],
      durationMin: 50,
      phaseLabel: 'MODELADO Y PRACTICA GUIADA',
      themeColor: COLOR.PHASE_EJECUCION,
      margin,
      drawWidth: mainW,
      y,
    });
  }

  // 3. Yo Hago (Demostración) — zona principal
  y = drawSectionHeader(doc, '3. Yo Hago: Demostracion y Protocolo Guiado por el Docente', margin, mainW, y, pageHeight, SECTION_COLORS.yoHago, checkSpace, '[ MODELO DOCENTE ]');
  y = drawPracticeTasksWithDottedLines(doc, mission.iDoSection.stepByStepDemo, margin, mainW, pageHeight, y, 3, checkSpace);
  y += 3;

  const demoCallout = extractCalloutBox(mission.iDoSection.stepByStepDemo || '', {
    missionNumber,
    defaultType: 'tip_taller',
    defaultTitle: 'Tip de Taller y Seguridad Operativa',
    defaultSubjectName: subjectName,
  });
  if (demoCallout) {
    y = drawPdfCallout(doc, demoCallout, margin, mainW, pageHeight, y, checkSpace);
  }

  // Si la misión abarca exactamente 2 sesiones (caso estándar), la Sesión 2 inicia en la Práctica Guiada
  if (coveredSessions.length === 2) {
    y = checkSpace(y, 14);
    y = drawSessionDivider(doc, {
      sessionNumber: coveredSessions[1],
      durationMin: 50,
      phaseLabel: 'PRACTICA GUIADA, RETO Y CIERRE',
      themeColor: COLOR.PHASE_EJECUCION,
      margin,
      drawWidth: mainW,
      y,
    });
  }

  // 4. Nosotros Hacemos (Práctica Colaborativa)
  y = drawSectionHeader(doc, '4. Nosotros Hacemos: Practica Guiada en Equipo', margin, mainW, y, pageHeight, SECTION_COLORS.hacemos, checkSpace, '[ TRABAJO EN EQUIPO ]');
  y = drawPracticeTasksWithDottedLines(doc, mission.weDoSection.guidedPractice, margin, mainW, pageHeight, y, 3, checkSpace);
  y += 4;

  if (mission.weDoSection.workbookElements) {
    for (const el of mission.weDoSection.workbookElements) {
      y = drawPdfWorkbookElement(doc, el, margin, mainW, pageHeight, y, checkSpace);
    }
  }

  // Si la misión abarca 3 o más sesiones, la Sesión 3 inicia en el Reto Autónomo y Cierre
  if (coveredSessions.length >= 3) {
    y = checkSpace(y, 14);
    y = drawSessionDivider(doc, {
      sessionNumber: coveredSessions[2],
      durationMin: 50,
      phaseLabel: 'RETO AUTONOMO Y CIERRE FORMATIVO',
      themeColor: COLOR.PHASE_CONCLUSION,
      margin,
      drawWidth: mainW,
      y,
    });
  }

  // 5. Tú Haces (Reto Autónomo)
  y = drawSectionHeader(doc, '5. Tu Haces: Reto Autonomo con Evidencia Cotidiana', margin, mainW, y, pageHeight, SECTION_COLORS.tuHaces, checkSpace, '[ HAGO Y RESUELVO ]');
  y = drawPracticeTasksWithDottedLines(doc, mission.youDoSection.autonomousChallenge, margin, mainW, pageHeight, y, 3, checkSpace);
  y += 4;

  if (mission.youDoSection.workbookElements) {
    for (const el of mission.youDoSection.workbookElements) {
      y = drawPdfWorkbookElement(doc, el, margin, mainW, pageHeight, y, checkSpace);
    }
  }

  // 6. Matriz de Resiliencia / Troubleshooting
  if (mission.troubleshooting && mission.troubleshooting.length > 0) {
    y = drawSectionHeader(doc, '6. Matriz de Resiliencia: Que hacer si falla?', margin, mainW, y, pageHeight, SECTION_COLORS.resiliencia, checkSpace, '[ ERROR COMUN ]');
    y = checkSpace(y, 30);

    const troubleBody = mission.troubleshooting.map((t) => [
      sanitizePdfText(stripMarkdown(t.symptom)),
      sanitizePdfText(stripMarkdown(t.rootCause || t.cause || 'Desajuste')),
      Array.isArray(t.solutionSteps)
        ? t.solutionSteps.map((s) => sanitizePdfText(stripMarkdown(s))).join('\n')
        : sanitizePdfText(stripMarkdown(String(t.solutionSteps || t.solution || ''))),
      sanitizePdfText(stripMarkdown(t.preventionTip || t.prevention || 'Revisar manual')),
    ]);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin + contentWidth - mainW },
      head: [['Sintoma / Falla', 'Causa Raiz', 'Solucion Metodica', 'Prevencion']],
      body: troubleBody,
      theme: 'grid',
      headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontSize: 7, fontStyle: 'bold' },
      styles: { fontSize: 6.8, cellPadding: 2, textColor: DARK_TEXT },
      columnStyles: {
        0: { cellWidth: 36, fontStyle: 'bold', textColor: MID_BLUE },
        1: { cellWidth: 36 },
        2: { cellWidth: 'auto' },
        3: { cellWidth: 28 },
      },
      didDrawPage: (data) => flow.onAutoTablePage(data.pageNumber),
    });

    y = doc.lastAutoTable?.finalY ?? (y + 30);
    y += 6;
  }

  // 7. Checkpoint Formativo
  if (mission.formativeCheckpoint) {
    y = drawSectionHeader(doc, '7. Punto de Control Formativo (Metacognicion)', margin, mainW, y, pageHeight, SECTION_COLORS.checkpoint, checkSpace, '[ MI ENTREGA ]');
    y = flow.printMainParagraph(`Pregunta formativa: ${mission.formativeCheckpoint.question}`, y, { size: 8, fontStyle: 'bold', color: MID_BLUE, lineHeight: 4 });
    y += 2;

    if (mission.formativeCheckpoint.reflectionPrompts) {
      for (const rp of mission.formativeCheckpoint.reflectionPrompts) {
        y = flow.printMainParagraph(`${rp}`, y, { size: 7.5, color: DARK_TEXT, lineHeight: 3.8 });
      }
    }

    if (mission.formativeCheckpoint.criteriaChecklist) {
      y = checkSpace(y, 16);
      setFontBody(doc, 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...DARK_TEXT);
      doc.text('Criterios de Verificacion:', margin, y);
      y += 4;

      for (const crit of mission.formativeCheckpoint.criteriaChecklist) {
        y = flow.printMainParagraph(`[  ]  ${crit}`, y, { size: 7.5, color: DARK_TEXT, lineHeight: 3.8 });
      }
    }
  }

  // ── V7: Semáforo de Aprendizaje Metacognitivo (cierre de misión) ─────────────
  const trafficLight = mission.metacognitiveTrafficLight ||
    buildMetacognitiveTrafficLight(mission.title, subjectName || 'la asignatura');

  if (trafficLight) {
    const semBoxH = 36;
    y = checkSpace(y, semBoxH + 4);

    y = drawMetacognitiveLight(
      doc,
      {
        green: trafficLight.green,
        yellow: trafficLight.yellow,
        red: trafficLight.red,
      },
      margin,
      mainW,
      y
    );
  }

  // ── V7: Rúbrica Analítica Formativa de la Misión (MCCEMS) ───────────────────
  const missionExtra = mission as unknown as Record<string, unknown>;
  const missionRubric: EvaluationRubricCriterion[] =
    (Array.isArray(missionExtra.missionRubric) ? (missionExtra.missionRubric as EvaluationRubricCriterion[]) : undefined) ||
    generateMissionRubric(mission, subjectName, blockName);

  if (missionRubric && missionRubric.length > 0) {
    y = checkSpace(y, 44);
    y = drawMissionRubricTable(
      doc,
      missionRubric,
      margin,
      mainW,
      y,
      momentColor
    );
    y += 2;
  }

  // ── Cierre de Misión: Sello Curricular MCCEMS al pie si quedó espacio ────────
  {
    const sealText = `SELLO CURRICULAR MCCEMS · Hash: ${hashMission.slice(0, 20)}... · DBEPA Puebla · ${SCHOOL_YEAR}`;
    y = checkSpace(y, 10);
    setFontBody(doc, 'normal');
    doc.setFontSize(6.2);
    doc.setTextColor(...MUTED_TEXT);
    const sealLines = doc.splitTextToSize(sanitizePdfText(sealText), mainW);
    doc.text(sealLines, margin, y);
    y += sealLines.length * 3.2 + 4;
  }

  flow.finalize();
  return y;
}

function drawPdfWorkbookElement(
  doc: jsPDF,
  element: WorkbookElement,
  margin: number,
  contentWidth: number,
  pageHeight: number,
  startY: number,
  ensureSpaceFn?: (y: number, neededH: number) => number
): number {
  let y = startY;
  const checkSpace = ensureSpaceFn || ((cy: number, nh: number) => ensureVerticalSpace(doc, cy, nh, margin, pageHeight));

  if (element.title) {
    y = printParagraph(doc, `[Actividad] ${element.title}`, y, margin, contentWidth, pageHeight, {
      size: 8,
      fontStyle: 'bold',
      color: NAVY,
      lineHeight: 4,
    });
  }

  if (element.instruction) {
    y = printParagraph(doc, `Instrucción: ${element.instruction}`, y, margin, contentWidth, pageHeight, {
      size: 7.5,
      fontStyle: 'italic',
      color: MUTED_TEXT,
      lineHeight: 3.6,
    });
    y += 2;
  }

  switch (element.type) {
    case 'lines': {
      const count = Math.min(6, Math.max(3, element.config?.rows || 4));
      const lineSpacing = 5.0;
      const neededHeight = count * lineSpacing + 6;
      y = checkSpace(y, neededHeight);

      doc.setDrawColor(190, 200, 215);
      doc.setLineWidth(0.35);
      for (let r = 0; r < count; r++) {
        y += lineSpacing;
        doc.line(margin + 4, y, margin + contentWidth, y);
      }
      y += 4;
      break;
    }

    case 'checkbox_list': {
      const cbs = element.config?.checkboxes || [
        'Instrumentos verificados y listos',
        'Protocolo de seguridad seguido al 100%',
        'Registro de evidencias concluido',
      ];
      for (const cb of cbs) {
        y = printParagraph(doc, `[  ]  ${cb}`, y, margin + 2, contentWidth - 2, pageHeight, {
          size: 8,
          fontStyle: 'normal',
          color: DARK_TEXT,
          lineHeight: 4.8,
        });
      }
      y += 3;
      break;
    }

    case 'empty_table':
    case 'data_recording': {
      const cols = element.config?.cols || ['Variable / Parámetro', 'Valor Esperado', 'Registro Observado', 'Notas'];
      const sampleRows = Math.max(element.config?.sampleRows || 6, 6);

      const body = [];
      for (let r = 0; r < sampleRows; r++) {
        body.push(cols.map(() => ' '));
      }

      y = checkSpace(y, 36);

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        tableWidth: contentWidth,
        head: [cols],
        body,
        theme: 'grid',
        headStyles: { fillColor: [241, 245, 249], textColor: NAVY, fontSize: 7.5, fontStyle: 'bold' },
        styles: { fontSize: 7.5, minCellHeight: 7.5, overflow: 'linebreak' },
      });

      y = doc.lastAutoTable!.finalY + 6;
      break;
    }

    case 'code_box': {
      const initialCode = element.config?.initialCode || '// Escribe tus comandos, desarrollo analítico o bloque de código:\n\n\n\n\n';
      const rawLines = initialCode.split('\n');
      const lineH = 4.4;
      const padTop = 5;
      const padBot = 5;
      const maxLinesPerPage = Math.max(10, Math.floor((pageHeight - margin * 2 - 24) / lineH));

      for (let i = 0; i < rawLines.length; i += maxLinesPerPage) {
        const linesChunk = rawLines.slice(i, i + maxLinesPerPage);
        const calculatedHeight = Math.max(45, linesChunk.length * lineH + padTop + padBot);

        y = ensureVerticalSpace(doc, y, calculatedHeight, margin, pageHeight);

        doc.setFillColor(...CODE_BG);
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.4);
        doc.rect(margin, y, contentWidth, calculatedHeight, 'FD');

        doc.setFont('courier', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...DARK_TEXT);
        linesChunk.forEach((line, idx) => {
          doc.text(line || ' ', margin + 4, y + padTop + idx * lineH);
        });
        y += calculatedHeight + 6;
      }
      break;
    }

    case 'drawing_box': {
      y = ensureVerticalSpace(doc, y, 52, margin, pageHeight);
      doc.setFillColor(...LIGHT_BG);
      doc.setDrawColor(160, 174, 192);
      doc.setLineWidth(0.4);
      doc.rect(margin, y, contentWidth, 45, 'FD');

      setFontCaption(doc);
      doc.setFontSize(8);
      doc.setTextColor(...MUTED_TEXT);
      doc.text('[ Espacio de dibujo técnico, diagramación, gráfica o boceto a mano ]', margin + contentWidth / 2, y + 22.5, {
        align: 'center',
      });
      y += 50;
      break;
    }
  }

  return y;
}

function drawProjectSection(
  doc: jsPDF,
  project: ProjectSection,
  margin: number,
  contentWidth: number,
  pageHeight: number,
  startY: number
): number {
  let y = startY;

  y = ensureVerticalSpace(doc, y, 22, margin, pageHeight);
  doc.setFillColor(...NAVY);
  doc.rect(margin, y, contentWidth, 10, 'F');
  setFontBody(doc, 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text('PROYECTO FORMATIVO INTEGRADOR: ARTEFACTO COMUNITARIO', margin + 3, y + 6.8);

  y += 15;
  y = printParagraph(doc, `Artefacto Central: ${project.artifactName}`, y, margin, contentWidth, pageHeight, {
    size: 9.5,
    fontStyle: 'bold',
    color: MID_BLUE,
    lineHeight: 4.5,
  });
  y += 2;
  y = printParagraph(doc, `Utilidad Comunitaria (PAEC): ${project.communityUtility}`, y, margin, contentWidth, pageHeight, {
    size: 8,
    fontStyle: 'normal',
    color: DARK_TEXT,
    lineHeight: 3.8,
  });
  y += 4;

  // Objetivos de Aprendizaje del Proyecto
  if (project.learningObjectives && project.learningObjectives.length > 0) {
    y = ensureVerticalSpace(doc, y, 18, margin, pageHeight);
    setFontBody(doc, 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...NAVY);
    doc.text('Objetivos Formativos y de Aprendizaje del Proyecto:', margin, y);
    y += 4.5;

    for (const obj of project.learningObjectives) {
      y = printParagraph(doc, `[✓]  ${obj}`, y, margin + 3, contentWidth - 3, pageHeight, {
        size: 7.8,
        fontStyle: 'normal',
        color: DARK_TEXT,
        lineHeight: 3.8,
      });
    }
    y += 3;
  }

  // Materiales e Insumos Requeridos
  if (project.requiredMaterials && project.requiredMaterials.length > 0) {
    y = ensureVerticalSpace(doc, y, 18, margin, pageHeight);
    setFontBody(doc, 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...NAVY);
    doc.text('Materiales, Herramientas e Insumos Requeridos:', margin, y);
    y += 4.5;

    for (const mat of project.requiredMaterials) {
      const matStr = resolveMaterialString(mat);
      y = printParagraph(doc, `[  ]  ${matStr}`, y, margin + 3, contentWidth - 3, pageHeight, {
        size: 7.8,
        fontStyle: 'normal',
        color: DARK_TEXT,
        lineHeight: 3.8,
      });
    }
    y += 3;
  }

  // Pasos Estructurados de Ejecución Procedimental
  if (project.executionSteps && project.executionSteps.length > 0) {
    y = ensureVerticalSpace(doc, y, 18, margin, pageHeight);
    setFontBody(doc, 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...NAVY);
    doc.text('Secuencia Procedimental de Construcción:', margin, y);
    y += 4.5;

    for (const step of project.executionSteps) {
      const { stepText } = resolveStepDetails(step);
      y = printParagraph(doc, stepText, y, margin + 3, contentWidth - 3, pageHeight, {
        size: 7.8,
        fontStyle: 'normal',
        color: DARK_TEXT,
        lineHeight: 3.8,
      });
    }
    y += 3;
  }

  // Cronograma por Fases
  y = ensureVerticalSpace(doc, y, 16, margin, pageHeight);
  setFontBody(doc, 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...NAVY);
  doc.text('Cronograma y Entregables por Fases de Desarrollo:', margin, y);
  y += 4.5;

  const phaseBody = project.phases.map((p) => [
    `Fase ${p.phaseNum}`,
    p.title,
    `${p.allocatedHours} hrs`,
    `${Array.isArray(p.deliverables) ? p.deliverables.join(', ') : (p.deliverables || '')} — ${p.instructions || ''}`,
  ]);

  y = ensureVerticalSpace(doc, y, 35, margin, pageHeight);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Fase', 'Etapa', 'Horas', 'Entregables y Criterios']],
    body: phaseBody,
    theme: 'grid',
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontSize: 7.5, fontStyle: 'bold' },
    styles: { fontSize: 7.2, cellPadding: 2.2, textColor: DARK_TEXT },
    columnStyles: {
      0: { cellWidth: 20, fontStyle: 'bold', textColor: MID_BLUE },
      1: { cellWidth: 45 },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 'auto' },
    },
  });

  y = doc.lastAutoTable!.finalY + 6;

  // Criterios de Entrega y Aceptación
  const criteriaList = [
    ...(project.acceptanceCriteria || []).map((c) => `[Criterio de Aceptación] ${c}`),
    ...(project.deliveryCriteria || []).map((d) => `[Condición de Entrega] ${d}`),
  ];

  if (criteriaList.length > 0) {
    y = ensureVerticalSpace(doc, y, 20, margin, pageHeight);
    setFontBody(doc, 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...NAVY);
    doc.text('Criterios de Aceptación y Condiciones de Entrega Final:', margin, y);
    y += 4.5;

    for (const crit of criteriaList) {
      y = printParagraph(doc, `• ${crit}`, y, margin + 3, contentWidth - 3, pageHeight, {
        size: 7.6,
        fontStyle: 'normal',
        color: DARK_TEXT,
        lineHeight: 3.6,
      });
    }
    y += 3;
  }

  // Formato de Bitácora y Registro de Avance
  if (project.registrationFormat) {
    y = ensureVerticalSpace(doc, y, 38, margin, pageHeight);
    setFontBody(doc, 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...NAVY);
    doc.text('Bitácora Técnica de Campo y Registro de Avances en Portafolio:', margin, y);
    y += 4.5;

    doc.setFillColor(...LIGHT_BG);
    doc.setDrawColor(180, 195, 215);
    doc.setLineWidth(0.4);
    const boxHeight = 28;
    doc.roundedRect(margin, y, contentWidth, boxHeight, 2, 2, 'FD');

    doc.setFont('courier', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...DARK_TEXT);

    const regFormatText = formatRegistrationFormatText(project.registrationFormat, 'pdf');

    const logLines = doc.splitTextToSize(regFormatText, contentWidth - 6);
    logLines.slice(0, 5).forEach((line: string, idx: number) => {
      doc.text(line, margin + 3, y + 5 + idx * 4.5);
    });
    y += boxHeight + 6;

    // Tabla de registro de bitácora y firmas de asesoría docente
    y = ensureVerticalSpace(doc, y, 46, margin, pageHeight);
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Sesión / Fecha', 'Actividad Procedimental Desarrollada', 'Evidencia Obtenida', 'Firma y Sello Docente']],
      body: [
        ['Sesión 1: ___/___/2026', ' ', ' ', ' '],
        ['Sesión 2: ___/___/2026', ' ', ' ', ' '],
        ['Sesión 3: ___/___/2026', ' ', ' ', ' '],
        ['Sesión 4: ___/___/2026', ' ', ' ', ' '],
        ['Sesión 5: ___/___/2026', ' ', ' ', ' '],
      ],
      theme: 'grid',
      headStyles: { fillColor: MID_BLUE, textColor: [255, 255, 255], fontSize: 7, fontStyle: 'bold' },
      styles: { fontSize: 7, minCellHeight: 8, textColor: DARK_TEXT },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 45 },
        3: { cellWidth: 35, halign: 'center' },
      },
    });
    y = doc.lastAutoTable!.finalY + 6;
  }

  return y;
}

function drawEvaluationSection(
  doc: jsPDF,
  evalSection: EvaluationSection,
  margin: number,
  contentWidth: number,
  pageHeight: number,
  startY: number
): number {
  let y = startY;

  y = ensureVerticalSpace(doc, y, 22, margin, pageHeight);
  doc.setFillColor(...NAVY);
  doc.rect(margin, y, contentWidth, 10, 'F');
  setFontBody(doc, 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text('INSTRUMENTOS OFICIALES DE EVALUACIÓN NEM (DBEPA PUEBLA)', margin + 3, y + 6.8);

  y += 14;
  setFontBody(doc, 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text('1. Rúbrica Analítica Oficial por Niveles de Desempeño:', margin, y);
  y += 4;

  if (evalSection.rubric && evalSection.rubric.length > 0) {
    const rubricBody = evalSection.rubric.map((crit) => [
      `${crit.criterion}\n(${crit.weightPercent}%)`,
      getRubricLevelDescriptor(crit.levels, 'sobresaliente'),
      getRubricLevelDescriptor(crit.levels, 'notable'),
      getRubricLevelDescriptor(crit.levels, 'suficiente'),
      getRubricLevelDescriptor(crit.levels, 'insuficiente'),
    ]);

    y = ensureVerticalSpace(doc, y, 40, margin, pageHeight);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Criterio y Ponderación', 'Sobresaliente (10-9)', 'Notable (8-7)', 'Suficiente (6-5)', 'Insuficiente (4-1)']],
      body: rubricBody,
      theme: 'grid',
      headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontSize: 7, fontStyle: 'bold' },
      styles: { fontSize: 6.5, cellPadding: 1.8, textColor: DARK_TEXT },
      columnStyles: {
        0: { cellWidth: 45, fontStyle: 'bold' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 'auto' },
        3: { cellWidth: 'auto' },
        4: { cellWidth: 'auto' },
      },
    });

    y = doc.lastAutoTable!.finalY + 6;
  }

  // 2. Lista de cotejo
  if (evalSection.checklist && evalSection.checklist.length > 0) {
    y = ensureVerticalSpace(doc, y, 30, margin, pageHeight);
    setFontBody(doc, 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...NAVY);
    doc.text('2. Lista de Cotejo de Verificación Técnica del Entregable:', margin, y);
    y += 4;

    const chkBody = evalSection.checklist.map((item) => [
      item.item,
      item.category || 'General',
      '[  ] Sí   [  ] No',
    ]);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Reactivo Observable', 'Categoría', 'Cumplimiento']],
      body: chkBody,
      theme: 'grid',
      headStyles: { fillColor: MID_BLUE, textColor: [255, 255, 255], fontSize: 7, fontStyle: 'bold' },
      styles: { fontSize: 6.8, cellPadding: 2, textColor: DARK_TEXT },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 38 },
        2: { cellWidth: 28, halign: 'center' },
      },
    });

    y = doc.lastAutoTable!.finalY + 6;
  }

  // 3. Evaluación Formativa Escalonada por Niveles de Dominio (Tiered Exercises)
  if (evalSection.tieredExercises && evalSection.tieredExercises.length > 0) {
    y = ensureVerticalSpace(doc, y, 24, margin, pageHeight);
    setFontBody(doc, 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...NAVY);
    doc.text('3. Evaluación Formativa Escalonada por Niveles de Dominio Cognitivo:', margin, y);
    y += 5;

    for (const tier of evalSection.tieredExercises) {
      y = ensureVerticalSpace(doc, y, 16, margin, pageHeight);
      setFontBody(doc, 'bold');
      doc.setFontSize(8.5);
      const isBasico = tier.level === 'basico' || (tier.level as string) === 'básico';
      const isIntermedio = tier.level === 'intermedio';
      const tierColor: [number, number, number] =
        isBasico ? MID_BLUE : isIntermedio ? GOLD : NAVY;
      doc.setTextColor(...tierColor);
      const lvlLabel = (tier.levelName || (tier.level ? `Nivel ${tier.level}` : 'Nivel')).toUpperCase();
      doc.text(`▸ ${lvlLabel}`, margin + 2, y);
      y += 4;

      if (tier.description) {
        y = printParagraph(doc, tier.description, y, margin + 4, contentWidth - 4, pageHeight, {
          size: 7.5,
          fontStyle: 'italic',
          color: MUTED_TEXT,
          lineHeight: 3.5,
        });
        y += 2;
      }

      for (let i = 0; i < (tier.exercises || []).length; i++) {
        y = ensureVerticalSpace(doc, y, 36, margin, pageHeight);

        const normEx = resolveExercise(tier.exercises[i], i + 1);

        // Enunciado
        y = printParagraph(doc, `Ejercicio ${normEx.number}: ${normEx.statement}`, y, margin + 4, contentWidth - 4, pageHeight, {
          size: 8,
          fontStyle: 'bold',
          color: DARK_TEXT,
          lineHeight: 3.8,
        });

        // Contexto o datos
        if (normEx.contextOrData) {
          y = printParagraph(doc, `Datos: ${normEx.contextOrData}`, y, margin + 6, contentWidth - 6, pageHeight, {
            size: 7.5,
            fontStyle: 'normal',
            color: MUTED_TEXT,
            lineHeight: 3.5,
          });
        }

        // Pista de andamiaje
        if (normEx.hint) {
          y = printParagraph(doc, `Pista: ${normEx.hint}`, y, margin + 6, contentWidth - 6, pageHeight, {
            size: 7.2,
            fontStyle: 'italic',
            color: MID_BLUE,
            lineHeight: 3.4,
          });
        }

        // Criterio de validación
        if (normEx.expectedOutputOrCriteria) {
          y = printParagraph(doc, `Criterio esperado: ${normEx.expectedOutputOrCriteria}`, y, margin + 6, contentWidth - 6, pageHeight, {
            size: 7.2,
            fontStyle: 'normal',
            color: MUTED_TEXT,
            lineHeight: 3.4,
          });
        }
        y += 1;

        // Renglones caligráficos para resolución del estudiante
        const lineCount = 4;
        const lineSpacing = 5.5;
        y = ensureVerticalSpace(doc, y, lineCount * lineSpacing + 4, margin, pageHeight);
        doc.setDrawColor(200, 212, 228);
        doc.setLineWidth(0.3);
        for (let l = 0; l < lineCount; l++) {
          y += lineSpacing;
          doc.line(margin + 6, y, margin + contentWidth, y);
        }
        y += 4;
      }
      y += 3;
    }
  }

  // 4. Cuestionario de Juicio Crítico Situado
  if (evalSection.criticalThinkingQuiz && evalSection.criticalThinkingQuiz.length > 0) {
    y = ensureVerticalSpace(doc, y, 22, margin, pageHeight);
    setFontBody(doc, 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...NAVY);
    doc.text('4. Cuestionario Formativo de Juicio Crítico y Transferencia:', margin, y);
    y += 4.5;

    for (const q of evalSection.criticalThinkingQuiz) {
      y = ensureVerticalSpace(doc, y, 28, margin, pageHeight);
      y = printParagraph(doc, `Pregunta ${q.questionNumber}: ${q.question}`, y, margin + 3, contentWidth - 3, pageHeight, {
        size: 8,
        fontStyle: 'bold',
        color: DARK_TEXT,
        lineHeight: 3.8,
      });

      if (q.scenario) {
        y = printParagraph(doc, `Escenario: ${q.scenario}`, y, margin + 5, contentWidth - 5, pageHeight, {
          size: 7.5,
          fontStyle: 'italic',
          color: MUTED_TEXT,
          lineHeight: 3.5,
        });
      }

      // 3 renglones de respuesta
      const lineSpacing = 5.5;
      y = ensureVerticalSpace(doc, y, 3 * lineSpacing + 3, margin, pageHeight);
      doc.setDrawColor(200, 212, 228);
      doc.setLineWidth(0.3);
      for (let l = 0; l < 3; l++) {
        y += lineSpacing;
        doc.line(margin + 5, y, margin + contentWidth, y);
      }
      y += 4;
    }
  }

  // 5. Reflexión Metacognitiva y Autoevaluación Formativa
  if (evalSection.metacognitiveReflection) {
    const meta = evalSection.metacognitiveReflection;
    const hasPrompts = meta.prompts && meta.prompts.length > 0;
    const hasScale = meta.selfAssessmentScale && meta.selfAssessmentScale.length > 0;

    if (hasPrompts || hasScale) {
      y = ensureVerticalSpace(doc, y, 24, margin, pageHeight);
      setFontBody(doc, 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...NAVY);
      doc.text('5. Reflexión Metacognitiva y Autoevaluación del Aprendiz:', margin, y);
      y += 4.5;

      if (hasPrompts) {
        for (const prompt of meta.prompts) {
          y = ensureVerticalSpace(doc, y, 24, margin, pageHeight);
          y = printParagraph(doc, `• ${prompt}`, y, margin + 3, contentWidth - 3, pageHeight, {
            size: 7.8,
            fontStyle: 'normal',
            color: DARK_TEXT,
            lineHeight: 3.8,
          });

          // 3 renglones de respuesta
          const lineSpacing = 5.5;
          y = ensureVerticalSpace(doc, y, 3 * lineSpacing + 2, margin, pageHeight);
          doc.setDrawColor(200, 212, 228);
          doc.setLineWidth(0.3);
          for (let l = 0; l < 3; l++) {
            y += lineSpacing;
            doc.line(margin + 5, y, margin + contentWidth, y);
          }
          y += 3;
        }
      }

      if (hasScale) {
        y = ensureVerticalSpace(doc, y, 28, margin, pageHeight);
        setFontBody(doc, 'bold');
        doc.setFontSize(8);
        doc.setTextColor(...NAVY);
        doc.text('Escala de Autovaloración Formativa (1: En desarrollo, 5: Dominio consolidado):', margin + 3, y);
        y += 4;

        const scaleBody = meta.selfAssessmentScale!.map((s) => [
          s.dimension,
          s.description,
          '[ 1 ]  [ 2 ]  [ 3 ]  [ 4 ]  [ 5 ]',
        ]);

        autoTable(doc, {
          startY: y,
          margin: { left: margin, right: margin },
          head: [['Dimensión del Aprendizaje', 'Criterio de Desempeño Autoevaluado', 'Escala']],
          body: scaleBody,
          theme: 'grid',
          headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontSize: 7, fontStyle: 'bold' },
          styles: { fontSize: 6.8, cellPadding: 2, textColor: DARK_TEXT },
          columnStyles: {
            0: { cellWidth: 42, fontStyle: 'bold' },
            1: { cellWidth: 'auto' },
            2: { cellWidth: 38, halign: 'center' },
          },
        });

        y = doc.lastAutoTable!.finalY + 6;
      }
    }
  }

  // 6. SECCIÓN V-B: BITÁCORA FORMATIVA Y REGULADORA (50-20-30) DBEPA PUEBLA
  y = drawBitacora502030Section(doc, margin, contentWidth, pageHeight, y);

  return y;
}

function drawBitacora502030Section(
  doc: jsPDF,
  margin: number,
  contentWidth: number,
  pageHeight: number,
  startY: number
): number {
  let y = startY;
  y = ensureVerticalSpace(doc, y, 60, margin, pageHeight);

  // Banner Sección V-B
  doc.setFillColor(...NAVY);
  doc.rect(margin, y, contentWidth, 10, 'F');
  setFontBody(doc, 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(255, 255, 255);
  doc.text('SECCIÓN V-B: BITÁCORA FORMATIVA Y REGULADORA (50-20-30) · DBEPA PUEBLA', margin + 3, y + 6.8);
  y += 14;

  // Subtítulo explicativo
  setFontBody(doc, 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...NAVY);
  doc.text('Instrumento Oficial de Seguimiento Continuo (50% Proceso | 20% Colectivo | 30% Individual):', margin, y);
  y += 4;

  // Tabla explicativa de ponderaciones
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Componente (50-20-30)', 'Tipo de Evidencia e Instrumento', 'Ponderación', 'Criterios Observables']],
    body: [
      ['Nivel de Proceso (50%)', 'Observación continua en aula y diálogo reflexivo', '50%', 'Participativo (1), Dialogante (2), Cuestionador (3), Apoyo mutuo (4)'],
      ['Evidencia Colectiva (20%)', 'Prototipo técnico, maqueta, friso o reporte grupal', '20%', 'Colaboración, rigor técnico, aplicación comunitaria'],
      ['Evidencia Individual (30%)', 'Bitácora reflexiva del estudiante + Ticket de Salida', '30%', 'Metacognición, apropiación conceptual, transferencia'],
    ],
    theme: 'grid',
    headStyles: { fillColor: MID_BLUE, textColor: [255, 255, 255], fontSize: 7, fontStyle: 'bold' },
    styles: { fontSize: 6.5, cellPadding: 1.8, textColor: DARK_TEXT },
    columnStyles: {
      0: { cellWidth: 40, fontStyle: 'bold' },
      1: { cellWidth: 50 },
      2: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
      3: { cellWidth: 'auto' },
    },
  });

  y = doc.lastAutoTable!.finalY + 6;

  // Tabla de Registro de Alumnos para el Docente (Hoja de Campo)
  y = ensureVerticalSpace(doc, y, 45, margin, pageHeight);
  setFontBody(doc, 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...NAVY);
  doc.text('Registro Diario de Proceso y Evaluación Formativa (Hoja de Campo):', margin, y);
  y += 4;

  const rowsEjemplo = [
    ['01', 'Morales Soto, Alan', '[X]    [X]    [ ]    [X]', '9.5', '8.5', 'Demuestra gran iniciativa técnica y apoyo a pares'],
    ['02', 'García Hernández, Sofia', '[X]    [X]    [X]    [X]', '10.0', '9.0', 'Excelente pensamiento crítico y argumentación'],
    ['03', 'López Martínez, Carlos', '[ ]    [X]    [ ]    [X]', '8.0', '7.5', 'Requiere andamiaje en formulación de preguntas'],
    ['04', 'Sánchez Pérez, Valeria', '[X]    [X]    [X]    [X]', '9.5', '9.5', 'Liderazgo en medición de laboratorio y reporte'],
    ['05', 'Ramírez Castro, Diego', '[X]    [ ]    [X]    [ ]', '7.5', '8.0', 'Fortalecer escucha activa en trabajo colaborativo'],
  ];

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['No', 'Nombre del Estudiante', '50% Proceso (1-2-3-4)', '20% Colect.', '30% Indiv.', 'Notas de Acompañamiento Cualitativo']],
    body: rowsEjemplo,
    theme: 'grid',
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontSize: 7, fontStyle: 'bold' },
    styles: { fontSize: 6.5, cellPadding: 2, textColor: DARK_TEXT },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 45, fontStyle: 'bold' },
      2: { cellWidth: 35, halign: 'center' },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 20, halign: 'center' },
      5: { cellWidth: 'auto' },
    },
  });

  y = doc.lastAutoTable!.finalY + 6;

  // Cuadro del Ticket de Salida
  y = ensureVerticalSpace(doc, y, 32, margin, pageHeight);
  doc.setFillColor(245, 248, 253);
  doc.setDrawColor(...MID_BLUE);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, y, contentWidth, 26, 2, 2, 'FD');

  setFontBody(doc, 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...NAVY);
  doc.text('TICKET DE SALIDA (Evaluación Reguladora al Cierre de Sesión):', margin + 4, y + 6);

  setFontBody(doc, 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...DARK_TEXT);
  doc.text('Pregunta detonadora: ¿Cuál fue el fenómeno central analizado hoy, qué error detectaste y cómo lo aplicas en tu vida diaria?', margin + 4, y + 11);

  // 2 líneas para escribir
  doc.setDrawColor(190, 205, 225);
  doc.setLineWidth(0.3);
  doc.line(margin + 4, y + 17, margin + contentWidth - 4, y + 17);
  doc.line(margin + 4, y + 22, margin + contentWidth - 4, y + 22);

  y += 30;
  return y;
}

