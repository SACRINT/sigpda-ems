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
  TroubleshootItem,
  EvaluationSection,
  ProjectSection,
} from '@/types/work-textbook';
import type { Planning, ImageAsset } from '@/types/planning';
import { loadAllLogos } from './pdf-logos';
import { resolveVisualForMission } from '@/lib/visual-engine/visual-asset-manager';
import { svgToPngBuffer } from '@/lib/visual-engine/svg-to-png';
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

// ── Paleta de Colores Institucionales DBEPA ──────────────────────────────────
const NAVY: [number, number, number] = [31, 56, 100];       // #1F3864
const MID_BLUE: [number, number, number] = [46, 116, 181];   // #2E74B5
const VINO_PUEBLA: [number, number, number] = [128, 0, 32];  // #800020
const GOLD: [number, number, number] = [232, 160, 32];      // #E8A020
const DARK_TEXT: [number, number, number] = [30, 41, 59];    // #1E293B
const MUTED_TEXT: [number, number, number] = [100, 116, 139];// #64748B
const LIGHT_BG: [number, number, number] = [248, 250, 252];  // #F8FAFC
const CODE_BG: [number, number, number] = [243, 244, 246];   // #F3F4F6

// Colores de acento para encabezados de sección
const SECTION_COLORS: Record<string, [number, number, number]> = {
  enganche: [31, 56, 100],      // Navy
  concepto: [31, 56, 100],      // Navy
  yoHago: [37, 99, 235],        // Azul (#2563eb)
  hacemos: [124, 58, 237],      // Púrpura (#7c3aed)
  tuHaces: [217, 119, 6],       // Ámbar (#d97706)
  resiliencia: [128, 0, 32],    // Wine
  checkpoint: [5, 150, 105],    // Esmeralda (#059669)
  evaluacion: [5, 150, 105],    // Esmeralda (#059669)
};

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
  let str = text;
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

  // ── 1. Portada Editorial Personalizada (Fase V2) ───────────────────────────
  if (options.coverBuffer) {
    doc.addImage(options.coverBuffer, 'JPEG', 0, 0, pageWidth, pageHeight);
  } else {
    const coverResult = await generateBookCover(coverOpts).catch((e) => {
      logger.warn('[pdf-workbook-renderer] Error generando portada editorial:', e);
      return null;
    });

    if (coverResult?.buffer) {
      doc.addImage(coverResult.buffer, 'JPEG', 0, 0, pageWidth, pageHeight);
    } else {
      drawCoverPage(doc, workbook, logos, pageWidth, pageHeight, margin);
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
    drawPlantelComunidadPage(doc, workbook, planning, margin, contentWidth, pageHeight);
  }

  // ── 3. Índice de Misiones (Página Reservada para TOC Real) ───────────────────
  doc.addPage();
  const tocPageNumber = doc.getNumberOfPages();
  const tocStartY = margin + 6;

  // ── 4. Misiones Didácticas ─────────────────────────────────────────────────
  const realTocEntries: RealTocEntry[] = [];
  const usedOpenverseAssets: ImageAsset[] = [];

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
      usedOpenverseAssets
    );
  }

  // ── 5. Proyecto Integrador Formativo ───────────────────────────────────────
  if (workbook.projectSection) {
    doc.addPage();
    const projectStartPage = doc.getNumberOfPages();
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
  const contraportadaData = await generateContraportadaData({ ...coverOpts, hash: bookHash }).catch((e) => {
    logger.warn('[pdf-workbook-renderer] Error generando datos de contraportada:', e);
    return null;
  });

  if (contraportadaData) {
    drawContraportadaPage(doc, contraportadaData, pageWidth, pageHeight, margin);
  }

  // ── 10. SEGUNDA PASADA: Encabezados y Pies de Página en Páginas Interiores (Fase V5) ──
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

  const shortSubject = sanitizePdfText(
    workbook.coverData.subjectName.length > 42
      ? workbook.coverData.subjectName.slice(0, 39) + '...'
      : workbook.coverData.subjectName
  );

  const rawSchool = workbook.coverData?.schoolName || 'BGE';
  const schoolSigla = sanitizePdfText(
    rawSchool
      .replace(/Bachillerato General (Estatal|Oficial)\s*/i, '')
      .replace(/Preparatoria Abierta\s*/i, '')
      .slice(0, 26)
      .trim() || 'DBEPA'
  );
  const cctClean = sanitizePdfText(workbook.coverData?.cct || '');
  const footerSchoolText = cctClean ? `${schoolSigla} (${cctClean})` : schoolSigla;

  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);

    // Exclusión estricta de portada, plantel, TOC y contraportada (sin headers ni footers)
    if (excludedPages.has(p)) {
      continue;
    }

    // Determinar color de acento según la sección de la página
    let accentColor: [number, number, number] = NAVY;
    for (let idx = realTocEntries.length - 1; idx >= 0; idx--) {
      if (p >= realTocEntries[idx].pageNumber) {
        if (realTocEntries[idx].sectionLabel.startsWith('Misión')) {
          const momentColors: [number, number, number][] = [
            SECTION_COLORS.yoHago,
            SECTION_COLORS.hacemos,
            SECTION_COLORS.tuHaces,
            SECTION_COLORS.checkpoint,
          ];
          accentColor = momentColors[idx % momentColors.length];
        } else if (realTocEntries[idx].sectionLabel.includes('PAEC')) {
          accentColor = SECTION_COLORS.resiliencia;
        } else if (realTocEntries[idx].sectionLabel.includes('Evaluación')) {
          accentColor = SECTION_COLORS.evaluacion;
        }
        break;
      }
    }

    // Banda superior con color de acento del momento
    doc.setFillColor(...accentColor);
    doc.rect(margin, 7.8, contentWidth, 0.9, 'F');

    // Texto de encabezado interior
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED_TEXT);
    doc.text(
      `${shortSubject} · ${workbook.blockName} — DBEPA Puebla`,
      margin,
      11.5
    );

    // Línea divisoria sutil inferior
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(margin, 12.8, pageWidth - margin, 12.8);

    // Footer interior con numeración continua real sobre totalPages
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED_TEXT);
    doc.text(
      `Cuaderno de Aprendizaje Activo · Pág. ${p} de ${totalPages} · ${footerSchoolText}`,
      pageWidth / 2,
      pageHeight - 7,
      { align: 'center' }
    );
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
  margin: number
) {
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // Franja superior institucional
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Insertar logos si están disponibles (detectando formato JPEG o PNG)
  if (logos.gobierno) {
    try {
      const fmt = logos.gobierno.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG';
      doc.addImage(logos.gobierno, fmt, margin, 5, 26, 11);
    } catch (e) {
      logger.warn('[pdf-workbook-renderer] Error insertando logo de gobierno:', { error: e });
    }
  }
  if (logos.sep) {
    try {
      const fmt = logos.sep.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG';
      doc.addImage(logos.sep, fmt, pageWidth / 2 - 13, 5, 26, 8.5);
    } catch (e) {
      logger.warn('[pdf-workbook-renderer] Error insertando logo de SEP:', { error: e });
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text('SECRETARÍA DE EDUCACIÓN PÚBLICA DE PUEBLA', pageWidth / 2, 22, { align: 'center' });

  y = 38;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...MID_BLUE);
  doc.text('DIRECCIÓN DE BACHILLERATOS ESTATALES Y PREPARATORIA ABIERTA (DBEPA)', pageWidth / 2, y, { align: 'center' });

  y += 7;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...DARK_TEXT);
  doc.text(workbook.coverData.schoolName || 'Bachillerato del Estado de Puebla', pageWidth / 2, y, { align: 'center' });

  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED_TEXT);
  doc.text(
    `Clave C.C.T.: ${workbook.coverData.cct || '21ECT0017T'} | Subsistema: ${(workbook.subsystem || 'BGE').toUpperCase()}`,
    pageWidth / 2,
    y,
    { align: 'center' }
  );

  y += 15;
  // Cuadro decorativo central
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 55, 3, 3, 'F');
  doc.setDrawColor(...MID_BLUE);
  doc.setLineWidth(0.6);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 55, 3, 3, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  const coverTitle = (workbook.coverData.title || workbook.blockName || workbook.coverData.subjectName || 'CUADERNO DE APRENDIZAJE ACTIVO').toUpperCase();
  const titleLines = doc.splitTextToSize(coverTitle, pageWidth - margin * 2 - 16);
  doc.text(titleLines, pageWidth / 2, y + 16, { align: 'center' });

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9.5);
  doc.setTextColor(...GOLD);
  const coverSub = workbook.coverData.subtitle || workbook.blockName || 'Bachillerato General Estatal · MCCEMS Puebla';
  const subLines = doc.splitTextToSize(coverSub, pageWidth - margin * 2 - 16);
  doc.text(subLines, pageWidth / 2, y + 30, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...DARK_TEXT);
  doc.text(
    `UAC: ${workbook.coverData.subjectName} (${workbook.coverData.semester}° Semestre)`,
    pageWidth / 2,
    y + 44,
    { align: 'center' }
  );

  y += 68;

  // Proyecto PAEC
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text('PROYECTO COMUNITARIO ESCOLAR (PAEC):', margin + 4, y);
  y += 5;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor(...DARK_TEXT);
  const paecLines = doc.splitTextToSize(
    workbook.coverData.paecProjectName || 'Vinculación de aprendizajes disciplinares con el contexto comunitario.',
    pageWidth - margin * 2 - 8
  );
  doc.text(paecLines, margin + 4, y);
  y += paecLines.length * 4.5 + 8;

  // Datos de Estudiante y Docente
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...DARK_TEXT);
  const teacherText = `Docente Titular: ${workbook.coverData.teacherName || 'Docente de Bachillerato'}`;
  const teacherLines = doc.splitTextToSize(teacherText, contentWidth - 8);
  teacherLines.forEach((tLine: string, tIdx: number) => {
    doc.text(tLine, margin + 4, y + tIdx * 4.5);
  });
  y += Math.max(10, teacherLines.length * 4.5 + 4);
  doc.setDrawColor(180, 190, 205);
  doc.setLineWidth(0.4);

  doc.text('Estudiante:', margin + 4, y);
  doc.line(margin + 24, y, pageWidth - margin - 4, y);

  y += 10;
  doc.text(`Grupo: ____________    Turno: ____________    Ciclo Escolar: ${SCHOOL_YEAR}`, margin + 4, y);
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
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text('CRÉDITOS INSTITUCIONALES Y ATRIBUCIONES LEGALES', margin + contentWidth / 2, y + 5.5, { align: 'center' });
  y += 12;

  // Subtítulo y Marco Curricular
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...DARK_TEXT);
  doc.text('MARCO CURRICULAR COMÚN DE LA EDUCACIÓN MEDIA SUPERIOR (MCCEMS 2026-2027)', margin, y);
  y += 4.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(...MUTED_TEXT);
  const introLines = doc.splitTextToSize(
    'Cuaderno de Aprendizaje Activo diseñado e impreso en estricto apego a los lineamientos pedagógicos de la Nueva Escuela Mexicana (NEM). Los recursos didácticos, esquemas formativos y materiales visuales integran licenciamientos abiertos y derechos de autor con fines exclusivamente formativos y educativos.',
    contentWidth
  );
  doc.text(introLines, margin, y);
  y += introLines.length * 3.3 + 4;

  // 2. Sección de Atribuciones Creative Commons
  doc.setFont('helvetica', 'bold');
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
    doc.setFont('helvetica', 'italic');
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
  doc.setFont('helvetica', 'bold');
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
  doc.setFont('helvetica', 'bold');
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

  doc.setFont('helvetica', 'bold');
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
  doc.setFont('helvetica', 'bold');
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
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...NAVY);
    doc.text(item.label, margin + 8, y);

    doc.setFont('helvetica', 'normal');
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
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text('FOLIO DE CONTROL CRIPTOGRÁFICO INSTITUCIONAL:', pageWidth / 2, y, { align: 'center' });

  y += 5;
  doc.setFont('courier', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...MID_BLUE);
  doc.text(data.hash.slice(0, 36) + '...', pageWidth / 2, y, { align: 'center' });

  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED_TEXT);
  doc.text(`Enlace de validación: ${data.verificationUrl}`, pageWidth / 2, y, { align: 'center' });

  // Tarjeta de aviso legal / institucional inferior
  y = 228;
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, y, contentWidth, 30, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...NAVY);
  doc.text('AVISO DE INTEGRIDAD Y DERECHOS CURRICULARES MCCEMS', margin + 6, y + 6);

  doc.setFont('helvetica', 'normal');
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
  doc.setFont('helvetica', 'normal');
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
    doc.setFont('helvetica', ann.bold ? 'bold' : 'normal');

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
  } = {}
): number {
  const {
    size = 8.5,
    fontStyle = 'normal',
    fontName = 'helvetica',
    color = DARK_TEXT,
    lineHeight = 4.2,
  } = options;

  // Sanitizar texto en una sola pasada al inicio: elimina asteriscos markdown y caracteres no-WinAnsi
  const cleanText = sanitizePdfText(stripMarkdown(text || ''));

  doc.setFont(fontName, fontStyle);
  doc.setFontSize(size);
  doc.setTextColor(...color);

  const lines = doc.splitTextToSize(cleanText, contentWidth);
  let y = startY;

  for (let i = 0; i < lines.length; i++) {
    if (y + lineHeight > pageHeight - margin - 8) {
      doc.addPage();
      y = margin + 8;
      doc.setFont(fontName, fontStyle);
      doc.setFontSize(size);
      doc.setTextColor(...color);
    }
    doc.text(lines[i], margin, y);
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
  levels: any,
  targetLevel: 'sobresaliente' | 'notable' | 'suficiente' | 'insuficiente'
): string {
  if (!levels) {
    return getOfficialNemFallback(targetLevel);
  }

  // 1. Si levels es un objeto tipo { sobresaliente: "...", notable: "..." }
  if (typeof levels === 'object' && !Array.isArray(levels)) {
    if (typeof levels[targetLevel] === 'string' && levels[targetLevel].trim().length > 3) {
      return levels[targetLevel].trim();
    }
    const aliases: Record<string, string[]> = {
      sobresaliente: ['sobresaliente', 'excelente', 'avanzado', '10-9'],
      notable: ['notable', 'bueno', 'competente', '8-7'],
      suficiente: ['suficiente', 'básico', 'en desarrollo', '6-5'],
      insuficiente: ['insuficiente', 'requiere apoyo', 'inicial', '4-1'],
    };
    const targets = aliases[targetLevel] || [];
    for (const [k, v] of Object.entries(levels)) {
      const kLower = k.toLowerCase().trim();
      if (targets.some((t) => kLower.includes(t)) && typeof v === 'string' && v.trim().length > 3) {
        return v.trim();
      }
    }
  }

  // 2. Si levels es un array tipo [ { levelName: '...', descriptor: '...' } ]
  if (Array.isArray(levels) && levels.length > 0) {
    const aliases: Record<string, string[]> = {
      sobresaliente: ['sobresaliente', 'excelente', 'avanzado', '10-9', 'expert', 'excellent', 'outstanding'],
      notable: ['notable', 'bueno', 'competente', '8-7', 'proficient', 'good', 'satisfactory'],
      suficiente: ['suficiente', 'básico', 'en desarrollo', '6-5', 'basic', 'sufficient', 'developing'],
      insuficiente: ['insuficiente', 'requiere apoyo', 'inicial', '4-1', 'needs support', 'needs improvement', 'unsatisfactory', 'inadequate'],
    };

    const targets = aliases[targetLevel] || [];
    for (const l of levels) {
      if (!l) continue;
      const nameLower = (l.levelName || '').toLowerCase().trim();
      if (targets.some((t) => nameLower.includes(t)) && l.descriptor && l.descriptor.trim().length > 3) {
        return l.descriptor.trim();
      }
    }

    const indexMap = { sobresaliente: 0, notable: 1, suficiente: 2, insuficiente: 3 };
    const idx = indexMap[targetLevel];
    if (levels[idx]?.descriptor && levels[idx].descriptor.trim().length > 5) {
      return levels[idx].descriptor.trim();
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
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...NAVY);
  doc.text('ÍNDICE GENERAL Y DOSIFICACIÓN DIDÁCTICA', margin, startY);

  doc.setFont('helvetica', 'normal');
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

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(255, 255, 255);
  doc.text('IDENTIDAD DEL PLANTEL Y VINCULACIÓN COMUNITARIA', margin + 5, y + 8);

  y += 18;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...NAVY);
  doc.text(`DIRECCIÓN DE BACHILLERATOS ESTATALES Y PREPARATORIA ABIERTA · MCCEMS ${SCHOOL_YEAR}`, margin, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
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
  const municipality = sanitizePdfText((workbook.coverData as any)?.municipality || 'Puebla, Pue.');
  const teacherName = sanitizePdfText(stripMarkdown(workbook.coverData?.teacherName || planning?.contentJson?.sectionI?.teacherName || 'Academia Docente del Plantel'));
  const subjectName = sanitizePdfText(stripMarkdown(workbook.coverData?.subjectName || workbook.blockName || planning?.uacName || 'Formación Fundamental'));

  const semRaw = workbook.coverData?.semester;
  const semClean = semRaw !== undefined
    ? String(semRaw).replace(/"/g, '').replace(/\bSEMESTRE\b(\s+SEMESTRE\b)+/gi, 'SEMESTRE').trim()
    : 'Segundo Semestre';
  const semesterStr = sanitizePdfText(/\bsemestre\b/i.test(semClean) ? semClean : `${semClean}° Semestre`);

  const paecProjectName = sanitizePdfText(stripMarkdown(workbook.coverData?.paecProjectName || workbook.projectSection?.artifactName || planning?.paecContext || 'Transformación Productiva y Social Comunitaria'));
  const paecChallenge = sanitizePdfText(stripMarkdown(workbook.projectSection?.communityUtility || (workbook.coverData as any)?.paecProblem || planning?.paecContext || 'Atención prioritaria al desarrollo comunitario y sustentabilidad local.'));

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
  doc.setFont('helvetica', 'bold');
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
  doc.setFont('helvetica', 'bold');
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
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(...DARK_TEXT);
  doc.text('Docente Titular de la UAC', margin + colW / 2, sigY + 3.5, { align: 'center' });
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6);
  doc.setTextColor(...MUTED_TEXT);
  doc.text('Firma y Fecha de Aplicación', margin + colW / 2, sigY + 6.5, { align: 'center' });

  // Línea 2: Presidente de Academia
  const col2X = margin + colW + 5;
  doc.line(col2X, sigY, col2X + colW, sigY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(...DARK_TEXT);
  doc.text('Presidente de Academia de Área', col2X + colW / 2, sigY + 3.5, { align: 'center' });
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6);
  doc.setTextColor(...MUTED_TEXT);
  doc.text('Validación Pedagógica Colegiada', col2X + colW / 2, sigY + 6.5, { align: 'center' });

  // Línea 3: Dirección del Plantel
  const col3X = col2X + colW + 5;
  doc.line(col3X, sigY, col3X + colW, sigY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(...DARK_TEXT);
  doc.text('Dirección del Plantel / Sello CCT', col3X + colW / 2, sigY + 3.5, { align: 'center' });
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6);
  doc.setTextColor(...MUTED_TEXT);
  doc.text('Autorización y Resguardo Escolar', col3X + colW / 2, sigY + 6.5, { align: 'center' });
}

function drawPdfGlossaryBox(
  doc: jsPDF,
  terms: GlossaryItem[],
  margin: number,
  contentWidth: number,
  pageHeight: number,
  startY: number
): number {
  if (!terms || terms.length === 0) return startY;

  const cleanTerms = terms.map((t) => ({
    term: sanitizePdfText(stripMarkdown(t.term)),
    definition: sanitizePdfText(stripMarkdown(t.definition)),
  }));

  let totalDefLines = 0;
  for (const item of cleanTerms) {
    const lines = doc.splitTextToSize(`${item.term}: ${item.definition}`, contentWidth - 14);
    totalDefLines += lines.length;
  }
  const boxHeight = Math.max(18, 9 + totalDefLines * 3.8);

  let y = ensureVerticalSpace(doc, startY, boxHeight + 4, margin, pageHeight);

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, y, contentWidth, boxHeight, 1.5, 1.5, 'F');

  doc.setFillColor(...VINO_PUEBLA);
  doc.roundedRect(margin, y, 3.5, boxHeight, 1.2, 1.2, 'F');

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, contentWidth, boxHeight, 1.5, 1.5, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(...VINO_PUEBLA);
  doc.text('GLOSARIO CONCEPTUAL CLAVE DE LA MISIÓN (MCCEMS):', margin + 7, y + 4.8);

  let textY = y + 8.8;
  for (const item of cleanTerms) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.6);
    doc.setTextColor(...NAVY);
    const prefix = `• ${item.term}: `;
    doc.text(prefix, margin + 7, textY);
    const prefixWidth = doc.getTextWidth(prefix);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.4);
    doc.setTextColor(...DARK_TEXT);
    const defLines = doc.splitTextToSize(item.definition, contentWidth - 14 - prefixWidth);
    doc.text(defLines, margin + 7 + prefixWidth, textY);
    textY += Math.max(4.2, defLines.length * 3.6 + 1.5);
  }

  return y + boxHeight + 4;
}

async function drawMissionQrBox(
  doc: jsPDF,
  verificationUrl: string,
  missionHash: string,
  margin: number,
  contentWidth: number,
  pageHeight: number,
  startY: number
): Promise<number> {
  const boxHeight = 22;
  let y = ensureVerticalSpace(doc, startY, boxHeight + 4, margin, pageHeight);

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, y, contentWidth, boxHeight, 1.5, 1.5, 'F');

  doc.setFillColor(...NAVY);
  doc.roundedRect(margin, y, 3.5, boxHeight, 1.2, 1.2, 'F');

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, contentWidth, boxHeight, 1.5, 1.5, 'S');

  try {
    const qrBuffer = await QRCode.toBuffer(verificationUrl, {
      type: 'png',
      margin: 1,
      width: 140,
      color: { dark: '#1F3864', light: '#FFFFFF' },
    });
    doc.addImage(qrBuffer, 'PNG', margin + 6, y + 3, 16, 16);
  } catch (err) {
    logger.warn('[pdf-workbook-renderer] Error generando QR de misión:', err);
  }

  const textX = margin + 26;
  const availW = contentWidth - 30;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.8);
  doc.setTextColor(...NAVY);
  doc.text('VERIFICACIÓN Y TRAZABILIDAD CURRICULAR (MCCEMS)', textX, y + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(...DARK_TEXT);
  const legend = 'Verifica este material · Escanea el código QR para constatar la autoría docente oficial, progresión de aprendizaje y sello de acreditación institucional.';
  const legendLines = doc.splitTextToSize(legend, availW);
  doc.text(legendLines, textX, y + 9.2);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.2);
  doc.setTextColor(...MUTED_TEXT);
  doc.text(`Sello Digital: ${missionHash.slice(0, 24)}... · DBEPA Puebla · ${SCHOOL_YEAR}`, textX, y + 18.5);

  return y + boxHeight + 4;
}

function drawSectionHeader(
  doc: jsPDF,
  title: string,
  margin: number,
  contentWidth: number,
  y: number,
  pageHeight: number,
  themeColor: [number, number, number] = NAVY
): number {
  const ribbonHeight = 7.5;
  y = ensureVerticalSpace(doc, y, ribbonHeight + 8, margin, pageHeight);

  // Fondo sutil de tarjeta
  doc.setFillColor(241, 245, 249); // slate-100 suave
  doc.roundedRect(margin, y, contentWidth, ribbonHeight, 1.2, 1.2, 'F');

  // Franja o píldora lateral con el color temático
  doc.setFillColor(...themeColor);
  doc.roundedRect(margin, y, 4, ribbonHeight, 1.2, 1.2, 'F');

  // Borde inferior sutil
  doc.setDrawColor(...themeColor);
  doc.setLineWidth(0.3);
  doc.line(margin + 4, y + ribbonHeight, margin + contentWidth, y + ribbonHeight);

  // Título en negrita estilizado
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...themeColor);
  doc.text(sanitizePdfText(stripMarkdown(title)).toUpperCase(), margin + 7, y + 5.1);

  return y + ribbonHeight + 4.5;
}

function drawPdfCallout(
  doc: jsPDF,
  callout: CalloutBoxData,
  margin: number,
  contentWidth: number,
  pageHeight: number,
  y: number
): number {
  const barColor = callout.accentRgb || [37, 99, 235];
  const bgColor = callout.bgRgb || [239, 246, 255];

  // Sanitizar título y construir badge 100% WinAnsi / ASCII
  const rawIcon = callout.icon || '';
  const iconText = EMOJI_TO_TEXT[rawIcon] || (rawIcon ? sanitizePdfText(rawIcon) : '') || '•';
  const cleanTitle = sanitizePdfText(stripMarkdown(callout.title)).toUpperCase();
  const badgeLabel = `[ ${iconText} · ${cleanTitle} ]`;

  const cleanContent = sanitizePdfText(stripMarkdown(callout.content || callout.body || ''));
  const cleanTakeaway = callout.keyTakeaway ? sanitizePdfText(stripMarkdown(callout.keyTakeaway)) : '';

  const availableTextWidth = contentWidth - 12;
  const contentLines = doc.splitTextToSize(cleanContent, availableTextWidth);
  const takeawayLines = cleanTakeaway
    ? doc.splitTextToSize(`• Clave: ${cleanTakeaway}`, availableTextWidth)
    : [];

  const textLinesCount = contentLines.length + takeawayLines.length;
  const boxHeight = Math.max(18, 9 + textLinesCount * 3.8);

  y = ensureVerticalSpace(doc, y, boxHeight + 4, margin, pageHeight);

  // Fondo suave
  doc.setFillColor(...bgColor);
  doc.roundedRect(margin, y, contentWidth, boxHeight, 1.5, 1.5, 'F');

  // Barra de acento izquierda
  doc.setFillColor(...barColor);
  doc.roundedRect(margin, y, 3.5, boxHeight, 1.2, 1.2, 'F');

  // Borde exterior suave
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, contentWidth, boxHeight, 1.5, 1.5, 'S');

  // Badge / Título
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...barColor);
  doc.text(badgeLabel, margin + 7, y + 4.8);

  // Contenido
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(...DARK_TEXT);
  let textY = y + 8.5;
  for (const line of contentLines) {
    doc.text(line, margin + 7, textY);
    textY += 3.7;
  }

  // Clave / Takeaway opcional
  if (takeawayLines.length > 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(...barColor);
    for (const line of takeawayLines) {
      doc.text(line, margin + 7, textY);
      textY += 3.5;
    }
  }

  return y + boxHeight + 4;
}

function drawPdfComparisonTable(
  doc: jsPDF,
  tableData: ComparisonTableData,
  margin: number,
  contentWidth: number,
  pageHeight: number,
  y: number
): number {
  if (!tableData.rows || tableData.rows.length === 0) return y;

  const cleanTitle = tableData.title ? sanitizePdfText(stripMarkdown(tableData.title)) : '';
  const headerHeight = cleanTitle ? 10 : 4;
  y = ensureVerticalSpace(doc, y, 32 + headerHeight, margin, pageHeight);

  if (cleanTitle) {
    doc.setFont('helvetica', 'bold');
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
    doc.setFont('helvetica', 'italic');
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
  contentWidth: number,
  pageHeight: number,
  y: number,
  defaultTaskCount: number = 3
): number {
  if (!rawText) return y;

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
    return printParagraph(doc, rawText, y, margin, contentWidth, pageHeight, {
      size: 8,
      fontStyle: 'normal',
      color: DARK_TEXT,
      lineHeight: 3.8,
    });
  }

  for (let idx = 0; idx < selectedTasks.length; idx++) {
    const cleanTaskText = sanitizePdfText(stripMarkdown(selectedTasks[idx]));
    const taskLines = doc.splitTextToSize(`[  ] Tarea ${idx + 1}: ${cleanTaskText}`, contentWidth - 4);
    const neededH = taskLines.length * 4 + 18;
    y = ensureVerticalSpace(doc, y, neededH, margin, pageHeight);

    doc.setFont('helvetica', 'bold');
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
    doc.line(margin + 6, y, margin + contentWidth, y);
    y += 4.5;
    doc.line(margin + 6, y, margin + contentWidth, y);

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
  openverseCollector?: ImageAsset[]
): Promise<number> {
  let y = startY;

  // Franja de título de misión (sanitizada para evitar doble prefijo "Misión X: Misión X:")
  const cleanMissionTitle = sanitizePdfText(stripMarkdown(
    mission.title
      .replace(/^\[.*?\]\s*/, '')
      .replace(/^misi[oó]n\s*\d+\s*:\s*/i, '')
      .trim()
  ));

  const titleText = `MISIÓN ${missionNumber}: ${cleanMissionTitle.toUpperCase()}`;
  const titleLines = doc.splitTextToSize(titleText, contentWidth - 8);
  const titleBoxH = Math.max(10, titleLines.length * 5 + 4);
  y = ensureVerticalSpace(doc, y, titleBoxH + 4, margin, pageHeight);
  doc.setFillColor(...NAVY);
  doc.rect(margin, y, contentWidth, titleBoxH, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  titleLines.forEach((line: string, idx: number) => {
    doc.text(line, margin + 3, y + 5 + idx * 5);
  });
  y += titleBoxH + 4;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...MID_BLUE);
  const subtitleText = sanitizePdfText(stripMarkdown(`Sesiones asignadas: ${mission.coveredSessions?.join(', ') || 'N/A'} | Enfoque: ${mission.sessionFocus}`));
  const subtitleLines = doc.splitTextToSize(subtitleText, contentWidth);
  y = ensureVerticalSpace(doc, y, subtitleLines.length * 4 + 2, margin, pageHeight);
  subtitleLines.forEach((line: string, idx: number) => {
    doc.text(line, margin, y + idx * 4);
  });
  y += subtitleLines.length * 4 + 4;

  // 1. Enganche y Desafío Situado
  y = drawSectionHeader(doc, '1. Enganche y Desafío Situado en la Comunidad', margin, contentWidth, y, pageHeight, SECTION_COLORS.enganche);
  y = printParagraph(doc, mission.phenomenonHook.story, y, margin, contentWidth, pageHeight, {
    size: 8,
    fontStyle: 'normal',
    color: DARK_TEXT,
    lineHeight: 3.8,
  });
  y += 3;

  // Pregunta Detonadora en caja destacada
  const detText = sanitizePdfText(stripMarkdown(`Pregunta Detonadora: ${mission.phenomenonHook.detonatingQuestion}`));
  const detLines = doc.splitTextToSize(detText, contentWidth - 8);
  const boxH = Math.max(22, detLines.length * 4.2 + 8);
  y = ensureVerticalSpace(doc, y, boxH + 4, margin, pageHeight);

  doc.setFillColor(254, 243, 199); // Fondo ámbar suave
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.4);
  doc.rect(margin, y, contentWidth, boxH, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...NAVY);
  doc.text(detLines, margin + 4, y + 5.5);
  y += boxH + 6;

  // 2. Concepto Cero
  y = drawSectionHeader(doc, '2. Concepto Cero: Analogía Intuitiva y Fundamento', margin, contentWidth, y, pageHeight, SECTION_COLORS.concepto);
  y = printParagraph(doc, `Analogía Física Cotidiana: ${mission.conceptZero.physicalAnalogy}`, y, margin, contentWidth, pageHeight, {
    size: 8,
    fontStyle: 'italic',
    color: DARK_TEXT,
    lineHeight: 3.8,
  });
  y += 2;
  y = printParagraph(doc, mission.conceptZero.coreExplanation, y, margin, contentWidth, pageHeight, {
    size: 8,
    fontStyle: 'normal',
    color: DARK_TEXT,
    lineHeight: 3.8,
  });
  y += 3;

  if (mission.conceptZero.narrativeExplanation) {
    y = printParagraph(doc, mission.conceptZero.narrativeExplanation, y, margin, contentWidth, pageHeight, {
      size: 8,
      fontStyle: 'normal',
      color: DARK_TEXT,
      lineHeight: 3.8,
    });
    y += 4;
  }

  // Tarjeta de Idea Clave destacada (Callout)
  const conceptFullText = `${mission.conceptZero.physicalAnalogy || ''}\n${mission.conceptZero.coreExplanation || ''}\n${mission.conceptZero.narrativeExplanation || ''}`;
  const conceptCallout = extractCalloutBox(conceptFullText, {
    missionNumber,
    defaultType: 'idea_clave',
    defaultTitle: 'Idea Clave de la Misión',
    defaultSubjectName: subjectName,
  });
  if (conceptCallout) {
    y = drawPdfCallout(doc, conceptCallout, margin, contentWidth, pageHeight, y);
  }

  // Ejemplo Resuelto Paso a Paso (CPA / NEM)
  if (mission.conceptZero.solvedExample) {
    const ex = mission.conceptZero.solvedExample;
    y = ensureVerticalSpace(doc, y, 32, margin, pageHeight);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...NAVY);
    doc.text('Ejemplo Modelo Resuelto Paso a Paso:', margin, y);
    y += 4.5;

    // Enunciado
    y = printParagraph(doc, `Problema: ${ex.problemStatement}`, y, margin + 3, contentWidth - 3, pageHeight, {
      size: 8,
      fontStyle: 'bold',
      color: DARK_TEXT,
      lineHeight: 3.8,
    });
    y += 2;

    // Pasos
    for (let sIdx = 0; sIdx < (ex.solutionSteps || []).length; sIdx++) {
      const step = ex.solutionSteps[sIdx];
      y = printParagraph(doc, `• Paso ${sIdx + 1}: ${step}`, y, margin + 5, contentWidth - 5, pageHeight, {
        size: 7.8,
        fontStyle: 'normal',
        color: DARK_TEXT,
        lineHeight: 3.6,
      });
    }
    y += 2;

    // Interpretación
    if (ex.interpretation) {
      y = printParagraph(doc, `Conclusión pedagógica: ${ex.interpretation}`, y, margin + 3, contentWidth - 3, pageHeight, {
        size: 7.8,
        fontStyle: 'italic',
        color: MID_BLUE,
        lineHeight: 3.6,
      });
      y += 4;
    }
  }

  // Tabla de Contraste (Concepto vs. Error Común) o Matriz Comparativa Sintetizada
  if (mission.conceptZero.contrastTable && mission.conceptZero.contrastTable.length > 0) {
    y = ensureVerticalSpace(doc, y, 30, margin, pageHeight);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...NAVY);
    doc.text('Matriz de Contrastación Conceptual y Prevención de Errores:', margin, y);
    y += 4.5;

    const contrastBody = mission.conceptZero.contrastTable.map((row) => [
      sanitizePdfText(stripMarkdown(row.correctConcept)),
      sanitizePdfText(stripMarkdown(row.commonMisconception)),
      sanitizePdfText(stripMarkdown(row.reasoning)),
    ]);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Concepto Técnico Válido', 'Error Frecuente / Concepto Erróneo', 'Fundamentación']],
      body: contrastBody,
      theme: 'grid',
      headStyles: { fillColor: MID_BLUE, textColor: [255, 255, 255], fontSize: 7.5, fontStyle: 'bold' },
      styles: { fontSize: 7.2, cellPadding: 2, textColor: DARK_TEXT },
      columnStyles: {
        0: { cellWidth: Math.floor(contentWidth * 0.35) },
        1: { cellWidth: Math.floor(contentWidth * 0.35) },
        2: { cellWidth: 'auto' },
      },
    });

    y = doc.lastAutoTable?.finalY ?? (y + 30);
    y += 6;
  } else {
    // Si no cuenta con contrastTable explícita de IA, generar matriz de contraste comparativa visual si detecta pares reales
    const compTable = extractComparisonTable(conceptFullText, cleanMissionTitle, subjectName);
    if (compTable) {
      y = drawPdfComparisonTable(doc, compTable, margin, contentWidth, pageHeight, y);
    }
  }

  y += 4;

  // ── 2.05 Glosario Conceptual Clave de la Misión (Fase V4) ───────────────────
  const glossaryTerms = extractGlossaryTerms(mission.conceptZero?.coreExplanation || '');
  if (glossaryTerms && glossaryTerms.length >= 2) {
    y = drawPdfGlossaryBox(doc, glossaryTerms, margin, contentWidth, pageHeight, y);
  }

  // ── 2.1 Gráfico Conceptual / Fotografía Situacional Activa ─────────────────
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
          const imgW = Math.min(135, contentWidth * 0.76);
          const imgH = imgW * 0.65;
          y = ensureVerticalSpace(doc, y, imgH + 16, margin, pageHeight);
          const imgX = margin + (contentWidth - imgW) / 2;
          doc.addImage(imgResult.buffer, imgResult.format, imgX, y, imgW, imgH);

          // Dibujar anotaciones de texto encima de la imagen
          if (resolvedVisual.annotations && resolvedVisual.annotations.length > 0) {
            drawVisualAnnotations(doc, resolvedVisual.annotations, imgX, y, imgW, imgH);
          }

          y += imgH + 3.5;

          // Pie de figura institucional
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(7.5);
          doc.setTextColor(...MUTED_TEXT);
          const captionLines = doc.splitTextToSize(resolvedVisual.caption, contentWidth * 0.88);
          doc.text(captionLines, margin + contentWidth / 2, y, { align: 'center' });
          y += (captionLines.length * 3.2) + 3.5;
        }
      } else if (resolvedVisual.type === 'openverse_media' && resolvedVisual.mediaAsset) {
        const imgUrl = resolvedVisual.mediaAsset.thumbnailUrl || resolvedVisual.mediaAsset.imageUrl;
        const imgResult = await downloadAndProcessImage(imgUrl);
        if (imgResult) {
          if (openverseCollector) {
            openverseCollector.push(resolvedVisual.mediaAsset);
          }
          const imgW = Math.min(140, contentWidth * 0.8);
          const ratio = imgResult.height / imgResult.width;
          const imgH = Math.min(92, Math.max(50, imgW * (ratio || 0.65)));
          y = ensureVerticalSpace(doc, y, imgH + 18, margin, pageHeight);
          const imgX = margin + (contentWidth - imgW) / 2;
          doc.addImage(imgResult.buffer, imgResult.format, imgX, y, imgW, imgH);

          y += imgH + 3.5;

          // Pie de figura y atribución legal CC
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(7.5);
          doc.setTextColor(...MUTED_TEXT);
          const captionLines = doc.splitTextToSize(resolvedVisual.caption, contentWidth * 0.88);
          doc.text(captionLines, margin + contentWidth / 2, y, { align: 'center' });
          y += (captionLines.length * 3.2) + 4;
        }
      }
    }
  }

  // 3. Yo Hago (Demostración)
  y = drawSectionHeader(doc, '3. Yo Hago: Demostración y Protocolo Guiado por el Docente', margin, contentWidth, y, pageHeight, SECTION_COLORS.yoHago);
  y = printParagraph(doc, mission.iDoSection.stepByStepDemo, y, margin, contentWidth, pageHeight, {
    size: 8,
    fontStyle: 'normal',
    color: DARK_TEXT,
    lineHeight: 3.8,
  });
  y += 3;

  // Tip de Taller / Seguridad Operativa destacado
  const demoCallout = extractCalloutBox(mission.iDoSection.stepByStepDemo || '', {
    missionNumber,
    defaultType: 'tip_taller',
    defaultTitle: 'Tip de Taller y Seguridad Operativa',
    defaultSubjectName: subjectName,
  });
  if (demoCallout) {
    y = drawPdfCallout(doc, demoCallout, margin, contentWidth, pageHeight, y);
  }

  // 4. Nosotros Hacemos (Práctica Colaborativa)
  y = drawSectionHeader(doc, '4. Nosotros Hacemos: Práctica Guiada en Equipo', margin, contentWidth, y, pageHeight, SECTION_COLORS.hacemos);
  y = drawPracticeTasksWithDottedLines(doc, mission.weDoSection.guidedPractice, margin, contentWidth, pageHeight, y);
  y += 4;

  if (mission.weDoSection.workbookElements) {
    for (const el of mission.weDoSection.workbookElements) {
      y = drawPdfWorkbookElement(doc, el, margin, contentWidth, pageHeight, y);
    }
  }

  // 5. Tú Haces (Reto Autónomo)
  y = drawSectionHeader(doc, '5. Tú Haces: Reto Autónomo de Aplicación', margin, contentWidth, y, pageHeight, SECTION_COLORS.tuHaces);
  y = drawPracticeTasksWithDottedLines(doc, mission.youDoSection.autonomousChallenge, margin, contentWidth, pageHeight, y);
  y += 4;

  if (mission.youDoSection.workbookElements) {
    for (const el of mission.youDoSection.workbookElements) {
      y = drawPdfWorkbookElement(doc, el, margin, contentWidth, pageHeight, y);
    }
  }

  // 6. Matriz de Resiliencia / Troubleshooting
  if (mission.troubleshooting && mission.troubleshooting.length > 0) {
    y = drawSectionHeader(doc, '6. Matriz de Resiliencia: "¿Qué hacer si falla?"', margin, contentWidth, y, pageHeight, SECTION_COLORS.resiliencia);
    y = ensureVerticalSpace(doc, y, 30, margin, pageHeight);

    const troubleBody = mission.troubleshooting.map((t) => [
      sanitizePdfText(stripMarkdown(t.symptom)),
      sanitizePdfText(stripMarkdown(t.rootCause || t.cause || 'Desajuste')),
      Array.isArray(t.solutionSteps)
        ? t.solutionSteps.map((s) => sanitizePdfText(stripMarkdown(s))).join('\n• ')
        : sanitizePdfText(stripMarkdown(String(t.solutionSteps || t.solution || ''))),
      sanitizePdfText(stripMarkdown(t.preventionTip || t.prevention || 'Revisar manual')),
    ]);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Síntoma / Falla', 'Causa Raíz', 'Solución Metódica', 'Prevención']],
      body: troubleBody,
      theme: 'grid',
      headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontSize: 7, fontStyle: 'bold' },
      styles: { fontSize: 6.8, cellPadding: 2, textColor: DARK_TEXT },
      columnStyles: {
        0: { cellWidth: 42, fontStyle: 'bold', textColor: MID_BLUE },
        1: { cellWidth: 42 },
        2: { cellWidth: 'auto' },
        3: { cellWidth: 38 },
      },
    });

    y = doc.lastAutoTable?.finalY ?? (y + 30);
    y += 6;
  }

  // 7. Checkpoint Formativo
  if (mission.formativeCheckpoint) {
    y = drawSectionHeader(doc, '7. Punto de Control Formativo (Metacognición)', margin, contentWidth, y, pageHeight, SECTION_COLORS.checkpoint);
    y = printParagraph(doc, `Pregunta formativa: ${mission.formativeCheckpoint.question}`, y, margin, contentWidth, pageHeight, {
      size: 8,
      fontStyle: 'bold',
      color: MID_BLUE,
      lineHeight: 4,
    });
    y += 2;

    if (mission.formativeCheckpoint.reflectionPrompts) {
      for (const p of mission.formativeCheckpoint.reflectionPrompts) {
        y = printParagraph(doc, `• ${p}`, y, margin + 2, contentWidth - 2, pageHeight, {
          size: 7.5,
          fontStyle: 'normal',
          color: DARK_TEXT,
          lineHeight: 3.8,
        });
      }
    }

    if (mission.formativeCheckpoint.criteriaChecklist) {
      y = ensureVerticalSpace(doc, y, 16, margin, pageHeight);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...DARK_TEXT);
      doc.text('Criterios de Verificación:', margin, y);
      y += 4;

      for (const crit of mission.formativeCheckpoint.criteriaChecklist) {
        y = printParagraph(doc, `[  ]  ${crit}`, y, margin + 2, contentWidth - 2, pageHeight, {
          size: 7.5,
          fontStyle: 'normal',
          color: DARK_TEXT,
          lineHeight: 3.8,
        });
      }
    }
  }

  // ── Cierre de Misión: QR Institucional de Validación y Sello Curricular (Fase V4) ──
  const hashMission = crypto
    .createHash('sha256')
    .update(`${planningId || 'sigpda'}|${blockIndex ?? 0}|${missionNumber}`)
    .digest('hex');
  const missionVerificationUrl = getVerificationUrl(hashMission);
  y = await drawMissionQrBox(
    doc,
    missionVerificationUrl,
    hashMission,
    margin,
    contentWidth,
    pageHeight,
    y
  );

  return y;
}

function drawPdfWorkbookElement(
  doc: jsPDF,
  element: WorkbookElement,
  margin: number,
  contentWidth: number,
  pageHeight: number,
  startY: number
): number {
  let y = startY;

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
      const count = Math.max(element.config?.rows || 8, 8);
      const lineSpacing = 6.5;
      const neededHeight = count * lineSpacing + 8;
      y = ensureVerticalSpace(doc, y, neededHeight, margin, pageHeight);

      doc.setDrawColor(190, 200, 215);
      doc.setLineWidth(0.35);
      for (let r = 0; r < count; r++) {
        y += lineSpacing;
        doc.line(margin + 4, y, margin + contentWidth, y);
      }
      y += 6;
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

      y = ensureVerticalSpace(doc, y, 36, margin, pageHeight);

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

      doc.setFont('helvetica', 'italic');
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
  doc.setFont('helvetica', 'bold');
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
    doc.setFont('helvetica', 'bold');
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
    doc.setFont('helvetica', 'bold');
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
    doc.setFont('helvetica', 'bold');
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
  doc.setFont('helvetica', 'bold');
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
    doc.setFont('helvetica', 'bold');
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
    doc.setFont('helvetica', 'bold');
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
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text('INSTRUMENTOS OFICIALES DE EVALUACIÓN NEM (DBEPA PUEBLA)', margin + 3, y + 6.8);

  y += 14;
  doc.setFont('helvetica', 'bold');
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
    doc.setFont('helvetica', 'bold');
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
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...NAVY);
    doc.text('3. Evaluación Formativa Escalonada por Niveles de Dominio Cognitivo:', margin, y);
    y += 5;

    for (const tier of evalSection.tieredExercises) {
      y = ensureVerticalSpace(doc, y, 16, margin, pageHeight);
      doc.setFont('helvetica', 'bold');
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
    doc.setFont('helvetica', 'bold');
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
      doc.setFont('helvetica', 'bold');
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
        doc.setFont('helvetica', 'bold');
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

  return y;
}

