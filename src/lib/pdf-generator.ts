/**
 * pdf-generator.ts — Generador PDF de Planeación Didáctica Oficial (SEP Puebla - DBEPA)
 * SIGPDA-EMS · Formato Oficial Carta (215.9mm x 279.4mm) con Membrete y Logotipos Oficiales
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { GeneratedPlanningContent, Planning } from '@/types/planning';
import { loadAllLogos } from './pdf-logos';

const NAVY: [number, number, number] = [31, 56, 100];       // #1F3864 - Azul Institucional
const BLUE_MID: [number, number, number] = [46, 116, 181];   // #2E74B5 - Azul Secundario
const GOLD_LINE: [number, number, number] = [232, 160, 32];  // #E8A020 - Dorado Oficial SEP
const GRAY_BG: [number, number, number] = [242, 244, 248];   // #F2F4F8 - Fondo Filas
const TEXT_DARK: [number, number, number] = [30, 41, 59];    // #1E293B - Texto

export async function generatePlanningPDF(
  planning: Planning,
  providedLogos?: { gobierno?: string; sep?: string; supervision?: string }
): Promise<jsPDF> {
  const content = planning.contentJson as GeneratedPlanningContent | null;
  const s1 = content?.sectionI;
  const s2 = content?.sectionII;
  const s3 = content?.sectionIII;
  const s4 = content?.sectionIV;
  const s5 = content?.sectionV;

  // Cargar logotipos en Base64 si no fueron suministrados
  const logos = providedLogos || (await loadAllLogos());

  // Formato Carta exacto: 215.9mm x 279.4mm (Letter)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter',
  });

  const pageWidth = doc.internal.pageSize.getWidth();   // 215.9 mm (Carta)
  const pageHeight = doc.internal.pageSize.getHeight(); // 279.4 mm (Carta)
  const margin = 12;

  let currentY = 8;

  // ─── Header Oficial SEP Puebla con 3 Logos ───────────────────────────────
  const drawOfficialHeader = () => {
    // 1. Logos en Fila Superior
    // Logo Izquierdo: Gobierno de Puebla (w: 34mm, h: 14.6mm, aspect ~2.32)
    if (logos.gobierno) {
      try {
        doc.addImage(logos.gobierno, 'PNG', margin, currentY, 34, 14.6);
      } catch (err) {
        console.warn('Error insertando logo Gobierno en PDF:', err);
      }
    }

    // Logo Centro: SEP Puebla (w: 30mm, h: 8.6mm, aspect ~3.48)
    if (logos.sep) {
      try {
        doc.addImage(logos.sep, 'PNG', (pageWidth - 30) / 2, currentY - 1, 30, 8.6);
      } catch (err) {
        console.warn('Error insertando logo SEP en PDF:', err);
      }
    }

    // Logo Derecho: Supervisión 004 (w: 30mm, h: 11.6mm, aspect ~2.57)
    if (logos.supervision) {
      try {
        doc.addImage(logos.supervision, 'PNG', pageWidth - margin - 30, currentY, 30, 11.6);
      } catch (err) {
        console.warn('Error insertando logo Supervisión en PDF:', err);
      }
    }

    // 2. Jerarquía Institucional de Texto Oficial Centrado
    currentY += 9;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...NAVY);
    doc.text('SECRETARÍA DE EDUCACIÓN', pageWidth / 2, currentY, { align: 'center' });
    currentY += 3.8;

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...TEXT_DARK);
    doc.text('SUBSECRETARÍA DE EDUCACIÓN OBLIGATORIA', pageWidth / 2, currentY, { align: 'center' });
    currentY += 3.4;

    doc.setFontSize(7);
    doc.text('DIRECCIÓN GENERAL DE EDUCACIÓN BÁSICA SEGUNDO NIVEL', pageWidth / 2, currentY, { align: 'center' });
    currentY += 3.4;

    doc.text('DIRECCIÓN DE BACHILLERATOS ESTATALES Y PREPARATORIA ABIERTA', pageWidth / 2, currentY, { align: 'center' });
    currentY += 3.8;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...NAVY);
    doc.text('SUPERVISIÓN DE BACHILLERATOS 004', pageWidth / 2, currentY, { align: 'center' });
    currentY += 3.4;

    const cctPlantel = s1?.cct || s1?.schoolName || '21EBH0000X';
    doc.setFontSize(7.5);
    doc.setTextColor(...BLUE_MID);
    doc.text(`CCT: ${cctPlantel}`, pageWidth / 2, currentY, { align: 'center' });

    currentY += 3.8;

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...NAVY);
    doc.text('INSTRUMENTO DE PLANEACIÓN DIDÁCTICA OFICIAL (MCCEMS NEM)', pageWidth / 2, currentY, { align: 'center' });
    currentY += 3.5;

    // 3. Línea divisora dorada (#E8A020)
    doc.setDrawColor(...GOLD_LINE);
    doc.setLineWidth(1.0);
    doc.line(margin, currentY, pageWidth - margin, currentY);
    currentY += 3.5;
  };

  drawOfficialHeader();

  // ─── Sección I: Datos Generales ──────────────────────────────────────────
  autoTable(doc, {
    startY: currentY,
    head: [[{ content: 'I. DATOS DE IDENTIFICACIÓN INSTITUCIONAL Y CURRICULAR', colSpan: 4, styles: { fillColor: NAVY, fontStyle: 'bold', halign: 'left', textColor: [255, 255, 255] } }]],
    body: [
      [
        { content: 'Plantel / Escuela:', styles: { fontStyle: 'bold', fillColor: GRAY_BG, cellWidth: 35 } },
        { content: s1?.schoolName || 'Bachillerato General Oficial', styles: { cellWidth: 58 } },
        { content: 'Clave C.C.T.:', styles: { fontStyle: 'bold', fillColor: GRAY_BG, cellWidth: 25 } },
        { content: s1?.cct || '21EBH0000X', styles: { cellWidth: 68 } },
      ],
      [
        { content: 'Docente Titular:', styles: { fontStyle: 'bold', fillColor: GRAY_BG } },
        { content: s1?.teacherName || 'Docente Responsable' },
        { content: 'Semestre / Grupo:', styles: { fontStyle: 'bold', fillColor: GRAY_BG } },
        { content: `${planning.semester}° Semestre · ${s1?.groups || 'Grupos Únicos'}` },
      ],
      [
        { content: 'Unidad de Aprendizaje (UAC):', styles: { fontStyle: 'bold', fillColor: GRAY_BG } },
        { content: planning.uacName, styles: { fontStyle: 'bold', textColor: NAVY } },
        { content: 'Componente:', styles: { fontStyle: 'bold', fillColor: GRAY_BG } },
        { content: planning.component === 'laboral' ? 'Formación Laboral' : 'Fundamental / Ampliado' },
      ],
      [
        { content: 'Horas Semanales / Totales:', styles: { fontStyle: 'bold', fillColor: GRAY_BG } },
        { content: `${s1?.totalHoursWeekly || 4} hrs/sem · ${s1?.totalHours || 64} hrs/semestre` },
        { content: 'Periodo de Aplicación:', styles: { fontStyle: 'bold', fillColor: GRAY_BG } },
        { content: s1?.applicationPeriod || s1?.period || 'Semestre 2026-2027' },
      ],
    ],
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 1.8, textColor: TEXT_DARK },
    margin: { left: margin, right: margin },
  });

  currentY = (doc as any).lastAutoTable.finalY + 3.5;

  // ─── Sección II: Propósito y Metas Formativas ─────────────────────────────
  autoTable(doc, {
    startY: currentY,
    head: [[{ content: 'II. PROPÓSITO FORMATIVO Y METAS DE APRENDIZAJE', colSpan: 2, styles: { fillColor: NAVY, fontStyle: 'bold', textColor: [255, 255, 255] } }]],
    body: [
      [
        { content: 'Propósito General de la Asignatura:', styles: { fontStyle: 'bold', fillColor: GRAY_BG, cellWidth: 42 } },
        { content: s2?.purpose || 'Desarrollar competencias integrales mediante metodologías activas y pensamiento crítico.' },
      ],
      [
        { content: 'Metas de Aprendizaje:', styles: { fontStyle: 'bold', fillColor: GRAY_BG } },
        { content: s2?.learningOutcomes?.join('; ') || 'Alcanzar los aprendizajes de trayectoria establecidos en el MCCEMS.' },
      ],
      [
        { content: 'Problemática Central / Contexto:', styles: { fontStyle: 'bold', fillColor: GRAY_BG } },
        { content: s2?.paecConnection || planning.paecContext || 'Contextualización a las necesidades socioformativas de la comunidad.' },
      ],
    ],
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 1.8, textColor: TEXT_DARK },
    margin: { left: margin, right: margin },
  });

  currentY = (doc as any).lastAutoTable.finalY + 3.5;

  // ─── Sección III: Transversalidad y PAEC ──────────────────────────────────
  const transItems = [
    ...(s3?.fundamentalCurriculum || []).map((t) => `${t.area}: ${t.description}`),
    ...(s3?.expandedCurriculum || []).map((t) => `${t.area}: ${t.description}`),
  ];

  autoTable(doc, {
    startY: currentY,
    head: [[{ content: 'III. TRANSVERSALIDAD Y VINCULACIÓN COMUNITARIA (PAEC)', colSpan: 2, styles: { fillColor: NAVY, fontStyle: 'bold', textColor: [255, 255, 255] } }]],
    body: [
      [
        { content: 'Proyecto Comunitario (PAEC):', styles: { fontStyle: 'bold', fillColor: GRAY_BG, cellWidth: 42 } },
        { content: s2?.paecConnection || planning.paecContext || 'Articulación con el Programa de Trabajo Comunitario del Plantel.' },
      ],
      [
        { content: 'Transversalidad Interdisciplinar:', styles: { fontStyle: 'bold', fillColor: GRAY_BG } },
        { content: transItems.length > 0 ? transItems.join('\n') : 'Cultura Digital, Lengua y Comunicación, Conciencia Histórica, Pensamiento Matemático.' },
      ],
    ],
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 1.8, textColor: TEXT_DARK },
    margin: { left: margin, right: margin },
  });

  currentY = (doc as any).lastAutoTable.finalY + 3.5;

  // ─── Sección IV: Secuencia Didáctica por Momentos ─────────────────────────
  const activities = s4?.activities || [];
  const activityRows: any[] = [];

  activities.forEach((act, idx) => {
    activityRows.push([
      {
        content: `Bloque / Actividad ${idx + 1}: ${act.name} (${act.hours || 18} Horas) — Metodología: ${act.methodology || 'ABP'}`,
        colSpan: 4,
        styles: { fillColor: BLUE_MID, textColor: [255, 255, 255], fontStyle: 'bold' },
      },
    ]);

    // Apertura
    activityRows.push([
      { content: 'Apertura (Exploración):', styles: { fontStyle: 'bold', fillColor: GRAY_BG, cellWidth: 38 } },
      { content: `${act.apertura?.activities || 'Recuperación de conocimientos previos.'}\nMateriales: ${act.apertura?.materials || 'Cuaderno, pizarrón.'}`, colSpan: 3 },
    ]);

    // Desarrollo
    activityRows.push([
      { content: 'Desarrollo (Construcción):', styles: { fontStyle: 'bold', fillColor: GRAY_BG } },
      { content: `${act.ejecucion?.activities || 'Investigación, análisis y aplicación.'}\nMateriales: ${act.ejecucion?.materials || 'Guías, dispositivos.'}`, colSpan: 3 },
    ]);

    // Cierre
    activityRows.push([
      { content: 'Cierre (Metacognición):', styles: { fontStyle: 'bold', fillColor: GRAY_BG } },
      { content: `${act.conclusion?.activities || 'Socialización de evidencias y síntesis.'}\nMateriales: ${act.conclusion?.materials || 'Instrumentos de evaluación.'}`, colSpan: 3 },
    ]);
  });

  if (activityRows.length > 0) {
    autoTable(doc, {
      startY: currentY,
      head: [[{ content: 'IV. SECUENCIA DIDÁCTICA DETALLADA POR MOMENTOS FORMATIVOS', colSpan: 4, styles: { fillColor: NAVY, fontStyle: 'bold', textColor: [255, 255, 255] } }]],
      body: activityRows,
      theme: 'grid',
      styles: { fontSize: 6.8, cellPadding: 1.8, textColor: TEXT_DARK },
      margin: { left: margin, right: margin },
      pageBreak: 'auto',
    });

    currentY = (doc as any).lastAutoTable.finalY + 3.5;
  }

  // ─── Sección V: Evaluación y Ponderaciones ────────────────────────────────
  const evalRows = (s5?.evaluations || []).map((ev) => [
    { content: ev.moment || 'Formativa' },
    { content: ev.type || 'Heteroevaluación' },
    { content: ev.evidence || 'Producto de aprendizaje' },
    { content: ev.instrument || 'Rúbrica analítica' },
    { content: `${ev.percentage || 20}%` },
  ]);

  if (evalRows.length > 0) {
    autoTable(doc, {
      startY: currentY,
      head: [
        [{ content: 'V. CRITERIOS E INSTRUMENTOS DE EVALUACIÓN FORMATIVA', colSpan: 5, styles: { fillColor: NAVY, fontStyle: 'bold', textColor: [255, 255, 255] } }],
        ['Momento', 'Tipo / Agente', 'Evidencia / Producto', 'Instrumento', 'Pond.'].map((h) => ({ content: h, styles: { fillColor: BLUE_MID, textColor: [255, 255, 255], fontStyle: 'bold' } })),
      ],
      body: evalRows,
      theme: 'grid',
      styles: { fontSize: 6.8, cellPadding: 1.8, textColor: TEXT_DARK },
      margin: { left: margin, right: margin },
      pageBreak: 'avoid',
    });

    currentY = (doc as any).lastAutoTable.finalY + 3.5;
  }

  // ─── Firmas Oficiales Tripartitas (Docente / Director / Supervisión) ─────
  autoTable(doc, {
    startY: currentY,
    head: [[{ content: 'VALIDACIÓN Y AUTORIZACIÓN OFICIAL DE LA PLANEACIÓN', colSpan: 3, styles: { fillColor: NAVY, fontStyle: 'bold', halign: 'center', textColor: [255, 255, 255] } }]],
    body: [
      [
        {
          content: `\n\n\n___________________________________\nDOCENTE TITULAR\n${s1?.teacherName || 'Nombre y Firma del Docente'}`,
          styles: { halign: 'center', cellWidth: 62 },
        },
        {
          content: '\n\n\n___________________________________\nDIRECTOR(A) DEL PLANTEL\nNombre, Firma y Sello Oficial',
          styles: { halign: 'center', cellWidth: 62 },
        },
        {
          content: '\n\n\n___________________________________\nSUPERVISIÓN ESCOLAR 004\nVo. Bo. / Sello de Zona',
          styles: { halign: 'center', cellWidth: 62 },
        },
      ],
    ],
    theme: 'plain',
    styles: { fontSize: 7, cellPadding: 1.8, textColor: TEXT_DARK },
    margin: { left: margin, right: margin },
    pageBreak: 'avoid',
  });

  // ─── Pie de Página en Todas las Hojas ─────────────────────────────────────
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `SIGPDA-EMS · ${planning.uacName} (${planning.semester}° Semestre) — Página ${i} de ${totalPages}`,
      pageWidth / 2,
      pageHeight - 6,
      { align: 'center' }
    );
  }

  return doc;
}

// Alias camelCase para compatibilidad
export const generatePlanningPdf = generatePlanningPDF;
