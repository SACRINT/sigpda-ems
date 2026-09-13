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
import type { Planning } from '@/types/planning';
import { loadAllLogos } from './pdf-logos';
import { dispatchVisual } from '@/lib/visual-engine/visual-dispatcher';
import { svgToPngBuffer } from '@/lib/visual-engine/svg-to-png';
import type { VisualAnnotation } from '@/lib/visual-engine/generators/stem-generator';

// ── Paleta de Colores Institucionales DBEPA ──────────────────────────────────
const NAVY: [number, number, number] = [31, 56, 100];       // #1F3864
const MID_BLUE: [number, number, number] = [46, 116, 181];   // #2E74B5
const GOLD: [number, number, number] = [232, 160, 32];      // #E8A020
const DARK_TEXT: [number, number, number] = [30, 41, 59];    // #1E293B
const MUTED_TEXT: [number, number, number] = [100, 116, 139];// #64748B
const LIGHT_BG: [number, number, number] = [248, 250, 252];  // #F8FAFC
const CODE_BG: [number, number, number] = [243, 244, 246];   // #F3F4F6

/**
 * Genera el archivo PDF del Libro-Cuaderno de Trabajo Activo del Bloque.
 */
export async function renderWorkbookToPdf(
  workbook: ActiveWorkTextbook,
  planning: Planning,
  options: { includeAnswerKey?: boolean } = {}
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
  const logos = await loadAllLogos().catch(() => ({ gobierno: '', sep: '', supervision: '' }));

  let currentY = margin;

  // ── 1. Portada Institucional ───────────────────────────────────────────────
  drawCoverPage(doc, workbook, logos, pageWidth, pageHeight, margin);

  // ── 2. Índice de Misiones ──────────────────────────────────────────────────
  doc.addPage();
  currentY = margin + 6;
  drawTableOfContents(doc, workbook, margin, contentWidth, currentY);
  currentY = (doc as any).lastAutoTable.finalY + 12;

  // ── 3. Misiones Didácticas ─────────────────────────────────────────────────
  for (let i = 0; i < workbook.missions.length; i++) {
    const mission = workbook.missions[i];
    doc.addPage();
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
      workbook.coverData.subjectName
    );
  }

  // ── 4. Proyecto Integrador Formativo ───────────────────────────────────────
  if (workbook.projectSection) {
    doc.addPage();
    currentY = margin + 8;
    currentY = drawProjectSection(doc, workbook.projectSection, margin, contentWidth, pageHeight, currentY);
  }

  // ── 5. Evaluación Formativa y Sumativa NEM (Rúbrica y Lista de Cotejo) ─────
  if (workbook.evaluationSection) {
    doc.addPage();
    currentY = margin + 8;
    currentY = drawEvaluationSection(doc, workbook.evaluationSection, margin, contentWidth, pageHeight, currentY);
  }

  // ── 6. Encabezado Sutil y Pie de Página en Todas las Páginas ───────────────
  const totalPages = (doc as any).internal.getNumberOfPages();

  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);

    if (p > 1) {
      // Header sutil interior
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...MUTED_TEXT);
      doc.text(
        `${workbook.coverData.subjectName} · ${workbook.blockName} — DBEPA Puebla`,
        margin,
        9
      );
      doc.setDrawColor(220, 225, 235);
      doc.setLineWidth(0.3);
      doc.line(margin, 10.5, pageWidth - margin, 10.5);
    }

    // Footer
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED_TEXT);
    doc.text(
      `Cuaderno de Aprendizaje Activo · Página ${p} de ${totalPages}`,
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

  // Insertar logos si están disponibles
  if (logos.gobierno) {
    try {
      doc.addImage(logos.gobierno, 'PNG', margin, 5, 26, 11);
    } catch {}
  }
  if (logos.sep) {
    try {
      doc.addImage(logos.sep, 'PNG', pageWidth / 2 - 13, 5, 26, 8.5);
    } catch {}
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
  doc.setTextColor(...NAVY);
  const titleLines = doc.splitTextToSize(workbook.coverData.title.toUpperCase(), pageWidth - margin * 2 - 16);
  doc.text(titleLines, pageWidth / 2, y + 16, { align: 'center' });

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9.5);
  doc.setTextColor(...GOLD);
  const subLines = doc.splitTextToSize(workbook.coverData.subtitle, pageWidth - margin * 2 - 16);
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
  doc.text('Grupo: ____________    Turno: ____________    Ciclo Escolar: 2026-2027', margin + 4, y);
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

  doc.setFont(fontName, fontStyle);
  doc.setFontSize(size);
  doc.setTextColor(...color);

  const lines = doc.splitTextToSize(text || '', contentWidth);
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

function drawTableOfContents(
  doc: jsPDF,
  workbook: ActiveWorkTextbook,
  margin: number,
  contentWidth: number,
  startY: number
) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...NAVY);
  doc.text('ÍNDICE DE MISIONES FORMATIVAS', margin, startY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...DARK_TEXT);
  doc.text(
    'Dosificación de misiones pedagógicas sesión por sesión vinculadas al plan de clase:',
    margin,
    startY + 5
  );

  const tableBody = workbook.tableOfContents.map((m) => {
    const cleanTitle = m.title
      .replace(/^\[.*?\]\s*/, '')
      .replace(/^misi[oó]n\s*\d+\s*:\s*/i, '')
      .trim();
    return [
      m.missionIndex > 0 ? `Misión ${m.missionIndex}` : 'Bloque',
      cleanTitle,
      m.sessionsRange,
      `${m.pageEstimate} págs.`,
    ];
  });

  autoTable(doc, {
    startY: startY + 8,
    margin: { left: margin, right: margin },
    head: [['Misión', 'Título de la Misión', 'Sesiones Cubiertas', 'Páginas Est.']],
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
      0: { cellWidth: 20, fontStyle: 'bold' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 42 },
      3: { cellWidth: 25, halign: 'center' },
    },
  });
}

function drawSectionHeader(
  doc: jsPDF,
  title: string,
  margin: number,
  y: number,
  pageHeight: number
): number {
  y = ensureVerticalSpace(doc, y, 16, margin, pageHeight);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text(title, margin, y);
  return y + 4.5;
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
  subjectName?: string
): Promise<number> {
  let y = startY;

  // Franja de título de misión (sanitizada para evitar doble prefijo "Misión X: Misión X:")
  const cleanMissionTitle = mission.title
    .replace(/^\[.*?\]\s*/, '')
    .replace(/^misi[oó]n\s*\d+\s*:\s*/i, '')
    .trim();

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
  const subtitleText = `Sesiones asignadas: ${mission.coveredSessions?.join(', ') || 'N/A'} | Enfoque: ${mission.sessionFocus}`;
  const subtitleLines = doc.splitTextToSize(subtitleText, contentWidth);
  y = ensureVerticalSpace(doc, y, subtitleLines.length * 4 + 2, margin, pageHeight);
  subtitleLines.forEach((line: string, idx: number) => {
    doc.text(line, margin, y + idx * 4);
  });
  y += subtitleLines.length * 4 + 4;

  // 1. Enganche y Desafío Situado
  y = drawSectionHeader(doc, '1. Enganche y Desafío Situado en la Comunidad', margin, y, pageHeight);
  y = printParagraph(doc, mission.phenomenonHook.story, y, margin, contentWidth, pageHeight, {
    size: 8,
    fontStyle: 'normal',
    color: DARK_TEXT,
    lineHeight: 3.8,
  });
  y += 3;

  // Pregunta Detonadora en caja destacada
  const detText = `Pregunta Detonadora: ${mission.phenomenonHook.detonatingQuestion}`;
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
  y = drawSectionHeader(doc, '2. Concepto Cero: Analogía Intuitiva y Fundamento', margin, y, pageHeight);
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

  // Tabla de Contraste (Concepto vs. Error Común)
  if (mission.conceptZero.contrastTable && mission.conceptZero.contrastTable.length > 0) {
    y = ensureVerticalSpace(doc, y, 30, margin, pageHeight);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...NAVY);
    doc.text('Matriz de Contrastación Conceptual y Prevención de Errores:', margin, y);
    y += 4.5;

    const contrastBody = mission.conceptZero.contrastTable.map((row) => [
      row.correctConcept,
      row.commonMisconception,
      row.reasoning,
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

    y = (doc as any).lastAutoTable.finalY + 6;
  }

  y += 4;

  // ── 2.1 Gráfico STEM Conceptual / Espacio de Tabulación Activo ─────────────
  if (subjectName) {
    const contextText = `${mission.conceptZero.physicalAnalogy || ''} ${mission.conceptZero.coreExplanation || ''}`;
    const svgVisual = dispatchVisual(subjectName, mission.title, contextText);
    if (svgVisual) {
      const pngBuffer = await svgToPngBuffer(svgVisual.svg);
      if (pngBuffer) {
        const imgW = Math.min(135, contentWidth * 0.76);
        const imgH = imgW * 0.65;
        y = ensureVerticalSpace(doc, y, imgH + 16, margin, pageHeight);
        const imgX = margin + (contentWidth - imgW) / 2;
        doc.addImage(pngBuffer, 'PNG', imgX, y, imgW, imgH);

        // Dibujar anotaciones de texto encima de la imagen
        if (svgVisual.annotations.length > 0) {
          drawVisualAnnotations(doc, svgVisual.annotations, imgX, y, imgW, imgH);
        }

        y += imgH + 3.5;

        // Pie de figura institucional
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7.5);
        doc.setTextColor(...MUTED_TEXT);
        doc.text(
          `Figura M${missionNumber}.1 — Representación gráfica conceptual y espacio de tabulación guiada`,
          margin + contentWidth / 2,
          y,
          { align: 'center' }
        );
        y += 6.5;
      }
    }
  }

  // 3. Yo Hago (Demostración)
  y = drawSectionHeader(doc, '3. Yo Hago: Demostración y Protocolo Guiado por el Docente', margin, y, pageHeight);
  y = printParagraph(doc, mission.iDoSection.stepByStepDemo, y, margin, contentWidth, pageHeight, {
    size: 8,
    fontStyle: 'normal',
    color: DARK_TEXT,
    lineHeight: 3.8,
  });
  y += 6;

  // 4. Nosotros Hacemos (Práctica Colaborativa)
  y = drawSectionHeader(doc, '4. Nosotros Hacemos: Práctica Guiada en Equipo', margin, y, pageHeight);
  y = printParagraph(doc, mission.weDoSection.guidedPractice, y, margin, contentWidth, pageHeight, {
    size: 8,
    fontStyle: 'normal',
    color: DARK_TEXT,
    lineHeight: 3.8,
  });
  y += 4;

  if (mission.weDoSection.workbookElements) {
    for (const el of mission.weDoSection.workbookElements) {
      y = drawPdfWorkbookElement(doc, el, margin, contentWidth, pageHeight, y);
    }
  }

  // 5. Tú Haces (Reto Autónomo)
  y = drawSectionHeader(doc, '5. Tú Haces: Reto Autónomo de Aplicación', margin, y, pageHeight);
  y = printParagraph(doc, mission.youDoSection.autonomousChallenge, y, margin, contentWidth, pageHeight, {
    size: 8,
    fontStyle: 'normal',
    color: DARK_TEXT,
    lineHeight: 3.8,
  });
  y += 4;

  if (mission.youDoSection.workbookElements) {
    for (const el of mission.youDoSection.workbookElements) {
      y = drawPdfWorkbookElement(doc, el, margin, contentWidth, pageHeight, y);
    }
  }

  // 6. Matriz de Resiliencia / Troubleshooting
  if (mission.troubleshooting && mission.troubleshooting.length > 0) {
    y = drawSectionHeader(doc, '6. Matriz de Resiliencia: "¿Qué hacer si falla?"', margin, y, pageHeight);
    y = ensureVerticalSpace(doc, y, 30, margin, pageHeight);

    const troubleBody = mission.troubleshooting.map((t) => [
      t.symptom,
      t.rootCause || t.cause || 'Desajuste',
      Array.isArray(t.solutionSteps) ? t.solutionSteps.join('\n• ') : String(t.solutionSteps || t.solution || ''),
      t.preventionTip || t.prevention || 'Revisar manual',
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

    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // 7. Checkpoint Formativo
  if (mission.formativeCheckpoint) {
    y = drawSectionHeader(doc, '7. Punto de Control Formativo (Metacognición)', margin, y, pageHeight);
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

      y = (doc as any).lastAutoTable.finalY + 6;
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
      const matStr = typeof mat === 'string'
        ? mat
        : mat && typeof mat === 'object'
        ? `${(mat as any).item || ''} ${(mat as any).quantity ? `[${(mat as any).quantity}]` : ''} ${(mat as any).notes ? `— ${(mat as any).notes}` : ''}`.trim()
        : String(mat);
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
      let stepStr = '';
      if (typeof step === 'string') {
        stepStr = step;
      } else if (step && typeof step === 'object') {
        const s = step as any;
        const num = s.stepNumber ? `Paso ${s.stepNumber}: ` : '';
        const title = s.title ? `${s.title}. ` : '';
        const desc = s.description || '';
        const hrs = s.estimatedHours ? ` (${s.estimatedHours} hrs)` : '';
        const deliv = s.deliverable ? ` [Entregable: ${s.deliverable}]` : '';
        stepStr = `${num}${title}${desc}${hrs}${deliv}`.trim();
      } else {
        stepStr = String(step);
      }
      y = printParagraph(doc, stepStr, y, margin + 3, contentWidth - 3, pageHeight, {
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
    `${(p.deliverables || []).join(', ')} — ${p.instructions}`,
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

  y = (doc as any).lastAutoTable.finalY + 6;

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

    let regFormatText = '';
    if (typeof project.registrationFormat === 'string') {
      regFormatText = project.registrationFormat;
    } else if (typeof project.registrationFormat === 'object') {
      const rf = project.registrationFormat as any;
      const parts: string[] = [];
      if (rf.sections && Array.isArray(rf.sections)) {
        parts.push(`Secciones: ${rf.sections.join(' | ')}`);
      }
      if (rf.suggestedFields && Array.isArray(rf.suggestedFields)) {
        parts.push(`Campos: ${rf.suggestedFields.join(' | ')}`);
      }
      regFormatText = parts.join('\n') || JSON.stringify(rf);
    } else {
      regFormatText = String(project.registrationFormat);
    }

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
    y = (doc as any).lastAutoTable.finalY + 6;
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

  y = (doc as any).lastAutoTable.finalY + 6;

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

    y = (doc as any).lastAutoTable.finalY + 6;
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

      for (const ex of tier.exercises || []) {
        y = ensureVerticalSpace(doc, y, 36, margin, pageHeight);

        const exNum = ex.number || (ex as any).exerciseNumber || 1;
        const exStmt = ex.statement || (ex as any).problemStatement || '';
        const exContext = ex.contextOrData || (ex as any).contexto || '';
        const exHint = ex.hint || (ex as any).pista || '';
        const exCriteria = ex.expectedOutputOrCriteria || (ex as any).evaluationCriteria || '';

        // Enunciado
        y = printParagraph(doc, `Ejercicio ${exNum}: ${exStmt}`, y, margin + 4, contentWidth - 4, pageHeight, {
          size: 8,
          fontStyle: 'bold',
          color: DARK_TEXT,
          lineHeight: 3.8,
        });

        // Contexto o datos
        if (exContext) {
          y = printParagraph(doc, `Datos: ${exContext}`, y, margin + 6, contentWidth - 6, pageHeight, {
            size: 7.5,
            fontStyle: 'normal',
            color: MUTED_TEXT,
            lineHeight: 3.5,
          });
        }

        // Pista de andamiaje
        if (exHint) {
          y = printParagraph(doc, `Pista: ${exHint}`, y, margin + 6, contentWidth - 6, pageHeight, {
            size: 7.2,
            fontStyle: 'italic',
            color: MID_BLUE,
            lineHeight: 3.4,
          });
        }

        // Criterio de validación
        if (exCriteria) {
          y = printParagraph(doc, `Criterio esperado: ${exCriteria}`, y, margin + 6, contentWidth - 6, pageHeight, {
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

        y = (doc as any).lastAutoTable.finalY + 6;
      }
    }
  }

  return y;
}

