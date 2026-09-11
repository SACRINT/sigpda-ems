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
    currentY = drawMission(doc, mission, i + 1, workbook.subsystem, margin, contentWidth, pageHeight, currentY);
  }

  // ── 4. Proyecto Integrador Formativo (Solo si no está ya integrado en las misiones) ──
  const hasProjectInMissions = workbook.missions.some(
    (m) => m.missionIndex === 3 || /proyecto|artefacto/i.test(m.title)
  );
  if (workbook.projectSection && !hasProjectInMissions) {
    doc.addPage();
    currentY = margin + 8;
    currentY = drawProjectSection(doc, workbook.projectSection, margin, contentWidth, pageHeight, currentY);
  }

  // ── 5. Evaluación Formativa y Sumativa NEM (Solo si no está ya integrada en las misiones) ──
  const hasEvalInMissions = workbook.missions.some(
    (m) => m.missionIndex === 4 || /evaluaci[oó]n|demostraci[oó]n/i.test(m.title)
  );
  if (workbook.evaluationSection && !hasEvalInMissions) {
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
  doc.text(`Docente Titular: ${workbook.coverData.teacherName}`, margin + 4, y);

  y += 12;
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
    size = 8,
    fontStyle = 'normal',
    fontName = 'helvetica',
    color = DARK_TEXT,
    lineHeight = 3.8,
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
  levels: { levelName: string; descriptor: string; points?: number }[] | undefined,
  targetLevel: 'sobresaliente' | 'notable' | 'suficiente' | 'insuficiente'
): string {
  if (!levels || levels.length === 0) {
    return getOfficialNemFallback(targetLevel);
  }

  const aliases: Record<string, string[]> = {
    sobresaliente: ['sobresaliente', 'excelente', 'avanzado', '10-9', 'expert', 'excellent', 'outstanding'],
    notable: ['notable', 'bueno', 'competente', '8-7', 'proficient', 'good', 'satisfactory'],
    suficiente: ['suficiente', 'básico', 'en desarrollo', '6-5', 'basic', 'sufficient', 'developing'],
    insuficiente: ['insuficiente', 'requiere apoyo', 'inicial', '4-1', 'needs support', 'needs improvement', 'unsatisfactory', 'inadequate'],
  };

  const targets = aliases[targetLevel] || [];
  for (const l of levels) {
    const nameLower = (l.levelName || '').toLowerCase().trim();
    if (targets.some((t) => nameLower.includes(t)) && l.descriptor && l.descriptor.trim().length > 3) {
      return l.descriptor;
    }
  }

  const indexMap = { sobresaliente: 0, notable: 1, suficiente: 2, insuficiente: 3 };
  const idx = indexMap[targetLevel];
  if (levels[idx]?.descriptor && levels[idx].descriptor.trim().length > 5) {
    return levels[idx].descriptor;
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

function drawMission(
  doc: jsPDF,
  mission: MissionSection,
  missionNumber: number,
  subsystem: string,
  margin: number,
  contentWidth: number,
  pageHeight: number,
  startY: number
): number {
  let y = startY;

  // Franja de título de misión (sanitizada para evitar doble prefijo "Misión X: Misión X:")
  const cleanMissionTitle = mission.title
    .replace(/^\[.*?\]\s*/, '')
    .replace(/^misi[oó]n\s*\d+\s*:\s*/i, '')
    .trim();

  y = ensureVerticalSpace(doc, y, 22, margin, pageHeight);
  doc.setFillColor(...NAVY);
  doc.rect(margin, y, contentWidth, 10, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(255, 255, 255);
  doc.text(`MISIÓN ${missionNumber}: ${cleanMissionTitle.toUpperCase()}`, margin + 3, y + 6.8);

  y += 14;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...MID_BLUE);
  doc.text(
    `Sesiones asignadas: ${mission.coveredSessions?.join(', ') || 'N/A'} | Enfoque: ${mission.sessionFocus}`,
    margin,
    y
  );
  y += 7;

  // 1. Enganche y Desafío Situado
  y = drawSectionHeader(doc, '1. Enganche y Desafío Situado en la Comunidad', margin, y, pageHeight);
  y = printParagraph(doc, mission.phenomenonHook.story, y, margin, contentWidth, pageHeight, {
    size: 8,
    fontStyle: 'normal',
    color: DARK_TEXT,
    lineHeight: 3.8,
  });
  y += 3;

  // Pregunta Detonadora en caja
  const detText = `Pregunta Detonadora: ${mission.phenomenonHook.detonatingQuestion}`;
  const detLines = doc.splitTextToSize(detText, contentWidth - 8);
  const boxH = Math.max(12, detLines.length * 4.2 + 6);
  y = ensureVerticalSpace(doc, y, boxH + 4, margin, pageHeight);

  doc.setFillColor(254, 243, 199); // Fondo ámbar suave
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.4);
  doc.rect(margin, y, contentWidth, boxH, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...NAVY);
  doc.text(detLines, margin + 4, y + 4.8);
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
  y += 6;

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
      const count = element.config?.rows || 4;
      const neededHeight = count * 6 + 6;
      y = ensureVerticalSpace(doc, y, neededHeight, margin, pageHeight);

      doc.setDrawColor(190, 200, 215);
      doc.setLineWidth(0.3);
      for (let r = 0; r < count; r++) {
        y += 6;
        doc.line(margin + 5, y, margin + contentWidth, y);
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
          size: 7.5,
          fontStyle: 'normal',
          color: DARK_TEXT,
          lineHeight: 4.5,
        });
      }
      y += 2;
      break;
    }

    case 'empty_table':
    case 'data_recording': {
      const cols = element.config?.cols || ['Variable / Parámetro', 'Valor Esperado', 'Registro Observado', 'Notas'];
      const sampleRows = element.config?.sampleRows || 4;

      const body = [];
      for (let r = 0; r < sampleRows; r++) {
        body.push(cols.map(() => ' '));
      }

      y = ensureVerticalSpace(doc, y, 28, margin, pageHeight);

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        tableWidth: contentWidth,
        head: [cols],
        body,
        theme: 'grid',
        headStyles: { fillColor: [241, 245, 249], textColor: NAVY, fontSize: 7, fontStyle: 'bold' },
        styles: { fontSize: 7, minCellHeight: 6, overflow: 'linebreak' },
      });

      y = (doc as any).lastAutoTable.finalY + 4;
      break;
    }

    case 'code_box': {
      const initialCode = element.config?.initialCode || '// Escribe tus comandos o bloque de código:\n\n\n';
      const rawLines = initialCode.split('\n');
      const lineH = 4.2;
      const padTop = 4;
      const padBot = 4;
      const maxLinesPerPage = Math.max(10, Math.floor((pageHeight - margin * 2 - 24) / lineH));

      for (let i = 0; i < rawLines.length; i += maxLinesPerPage) {
        const linesChunk = rawLines.slice(i, i + maxLinesPerPage);
        const calculatedHeight = Math.max(20, linesChunk.length * lineH + padTop + padBot);

        y = ensureVerticalSpace(doc, y, calculatedHeight, margin, pageHeight);

        doc.setFillColor(...CODE_BG);
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.4);
        doc.rect(margin, y, contentWidth, calculatedHeight, 'FD');

        doc.setFont('courier', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(...DARK_TEXT);
        linesChunk.forEach((line, idx) => {
          doc.text(line || ' ', margin + 3, y + padTop + idx * lineH);
        });
        y += calculatedHeight + 4;
      }
      break;
    }

    case 'drawing_box': {
      y = ensureVerticalSpace(doc, y, 36, margin, pageHeight);
      doc.setFillColor(...LIGHT_BG);
      doc.setDrawColor(160, 174, 192);
      doc.setLineWidth(0.4);
      doc.rect(margin, y, contentWidth, 32, 'FD');

      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(...MUTED_TEXT);
      doc.text('[ Espacio de dibujo técnico, diagramación o boceto a mano ]', margin + contentWidth / 2, y + 16, {
        align: 'center',
      });
      y += 36;
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
    size: 9,
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

  return (doc as any).lastAutoTable.finalY + 8;
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
  doc.text('Rúbrica Analítica Oficial por Niveles de Desempeño:', margin, y);
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

  // Lista de cotejo
  if (evalSection.checklist && evalSection.checklist.length > 0) {
    y = ensureVerticalSpace(doc, y, 30, margin, pageHeight);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...NAVY);
    doc.text('Lista de Cotejo de Verificación Técnica del Entregable:', margin, y);
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

  return y;
}

