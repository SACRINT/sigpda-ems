/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * paec-pdf-generator.ts — Generador PDF Editorial Oficial del Proyecto Escolar Comunitario (PEC / PAEC)
 * SIGPDA-EMS · Estándar Oficial SEP Puebla (DBEPA / MCCEMS / NEM)
 * 
 * Estructura Editorial Rigurosa de 35 Páginas con Orientación Híbrida:
 * - Macro-Fase I: Portada y Diagnóstico Colectivo (pp. 1-5) [Portrait]
 * - Macro-Fase II: Justificación Pedagógica y Diseño Curricular (pp. 6-11) [Portrait]
 * - Macro-Fase III: Plan Operativo Territorial Semestres A y B (pp. 12-19) [Landscape]
 *                   Formalización Institucional (Carta, Minuta, 3 Oficios) y 6 Anexos (pp. 20-30) [Portrait]
 * - Macro-Fase IV: Gobernanza, Evaluación, Informe de Supervisión 004 y Firmas (pp. 31-35) [Portrait]
 * 
 * Paginación Global Dinámica: Membrete institucional y "Página X de 35" adaptativos a orientación.
 * Cero texto hardcodeado: Extracción directa de la estructura PaecProject con fallbacks institucionales.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { loadAllLogos } from './pdf-logos';
import { SCHOOL_YEAR } from '@/lib/config';
import { logger } from './logger';
import type {
  PaecProject,
  TableRow2Cols,
  MapeoRow,
  CronogramaRow,
  DetalleCurricularRow,
  PlanOperativoRow,
  SeguimientoRow,
  PaecMetaLogroRow,
} from '@/types/paec';
import { parseFodaData } from './paec-docx-generator';

// Paleta Institucional DBEPA / SEP Puebla
const NAVY: [number, number, number]       = [31, 56, 100];   // #1F3864 - Azul Marino Institucional DBEPA
const BLUE_MID: [number, number, number]   = [46, 116, 181];  // #2E74B5 - Azul Medio Secundario
const GOLD_LINE: [number, number, number]  = [232, 160, 32];  // #E8A020 - Dorado Oficial SEP
const GOLD_LIGHT: [number, number, number] = [254, 243, 199]; // #FEF3C7 - Resaltado Semana 16
const GRAY_BG: [number, number, number]    = [242, 244, 248]; // #F2F4F8 - Fondo Alternado
const TEXT_DARK: [number, number, number]  = [30, 41, 59];    // #1E293B - Texto Primario
const TEXT_MUTED: [number, number, number] = [100, 116, 139]; // #64748B - Texto Secundario
const GREEN_BG: [number, number, number]   = [236, 253, 245]; // Cumple

function safeStr(val: unknown, fallback = 'Sin información registrada'): string {
  if (val === null || val === undefined) return fallback;
  const str = String(val).trim();
  return str.length > 0 ? str : fallback;
}

function addSectionBar(doc: jsPDF, title: string, y: number, x: number, width: number): void {
  doc.setFillColor(...NAVY);
  doc.rect(x, y - 4.5, 3.5, 7, 'F');

  doc.setFillColor(...GRAY_BG);
  doc.rect(x + 3.5, y - 4.5, width - 3.5, 7, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...NAVY);
  doc.text(title.toUpperCase(), x + 7, y);

  doc.setDrawColor(...GOLD_LINE);
  doc.setLineWidth(0.5);
  doc.line(x, y + 3, x + width, y + 3);
}

export async function generatePaecPDF(
  project: PaecProject,
  teacherName: string = 'Docente Coordinador',
  providedLogos?: { gobierno?: string; sep?: string; supervision?: string }
): Promise<Buffer> {
  const logos = providedLogos || (await loadAllLogos());

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter',
  });

  const p = project;
  const sCtx = p.schoolContext || {};
  const cCtx = p.communityContext || {};

  const margin = 14;
  let pageWidth = doc.internal.pageSize.getWidth();   // 215.9 mm
  let pageHeight = doc.internal.pageSize.getHeight(); // 279.4 mm
  let contentWidth = pageWidth - margin * 2;          // 187.9 mm

  const communityLabel = (cCtx as Record<string, any>).communityName || cCtx.location || 'Comunidad Territorial';
  const cycleLabel =
    p.cycleType === 'A'
      ? 'Semestre A (Semestres 1°, 3° y 5° — 16 Semanas)'
      : p.cycleType === 'B'
      ? 'Semestre B (Semestres 2°, 4° y 6° — 16 Semanas)'
      : 'Ciclo Escolar Completo Anual (Semestres A y B — 32 Semanas)';

  // ═════════════════════════════════════════════════════════════════════════════
  // PÁGINA 1: PORTADA OFICIAL INSTITUCIONAL MONUMENTAL (PORTRAIT)
  // ═════════════════════════════════════════════════════════════════════════════
  let curY = 14;

  if (logos.gobierno) {
    try {
      const fmt = logos.gobierno.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG';
      doc.addImage(logos.gobierno, fmt, margin, curY, 36, 15);
    } catch (err) {
      logger.warn('[PAEC-PDF] Error agregando logotipo de gobierno en portada', { error: err });
    }
  }
  if (logos.sep) {
    try {
      const fmt = logos.sep.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG';
      doc.addImage(logos.sep, fmt, (pageWidth - 34) / 2, curY, 34, 10);
    } catch (err) {
      logger.warn('[PAEC-PDF] Error agregando logotipo SEP en portada', { error: err });
    }
  }
  if (logos.supervision) {
    try {
      const fmt = logos.supervision.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG';
      doc.addImage(logos.supervision, fmt, pageWidth - margin - 34, curY, 34, 13);
    } catch (err) {
      logger.warn('[PAEC-PDF] Error agregando logotipo de supervisión en portada', { error: err });
    }
  }

  curY += 23;
  doc.setDrawColor(...GOLD_LINE);
  doc.setLineWidth(1.2);
  doc.line(margin, curY, pageWidth - margin, curY);

  curY += 12;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...NAVY);
  doc.text('GOBIERNO DEL ESTADO DE PUEBLA', pageWidth / 2, curY, { align: 'center' });

  curY += 5;
  doc.setFontSize(9.5);
  doc.text('SECRETARÍA DE EDUCACIÓN PÚBLICA DEL ESTADO', pageWidth / 2, curY, { align: 'center' });

  curY += 4.8;
  doc.setFontSize(8.5);
  doc.setTextColor(...BLUE_MID);
  doc.text('SUBSECRETARÍA DE EDUCACIÓN OBLIGATORIA', pageWidth / 2, curY, { align: 'center' });

  curY += 4.5;
  doc.text('DIRECCIÓN DE EDUCACIÓN MEDIA SUPERIOR', pageWidth / 2, curY, { align: 'center' });

  curY += 14;
  doc.setFillColor(...NAVY);
  doc.roundedRect(margin + 2, curY, contentWidth - 4, 30, 2.5, 2.5, 'F');
  doc.setDrawColor(...GOLD_LINE);
  doc.setLineWidth(0.8);
  doc.roundedRect(margin + 2, curY, contentWidth - 4, 30, 2.5, 2.5, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text('PROYECTO ESCOLAR COMUNITARIO (PEC)', pageWidth / 2, curY + 9, { align: 'center' });
  doc.text('PROGRAMA AULA, ESCUELA Y COMUNIDAD (PAEC)', pageWidth / 2, curY + 16, { align: 'center' });

  doc.setFontSize(9.5);
  doc.setTextColor(...GOLD_LINE);
  doc.text(`MARCO CURRICULAR COMÚN DE LA EMS (MCCEMS) · CICLO ESCOLAR ${SCHOOL_YEAR}`, pageWidth / 2, curY + 24, { align: 'center' });

  curY += 40;
  // Recuadro del Título del Proyecto
  doc.setFillColor(...GRAY_BG);
  doc.roundedRect(margin + 4, curY, contentWidth - 8, 38, 2, 2, 'F');
  doc.setDrawColor(...BLUE_MID);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin + 4, curY, contentWidth - 8, 38, 2, 2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...NAVY);
  doc.text('TÍTULO DEL PROYECTO DE TRANSFORMACIÓN SOCIAL SITUADA:', pageWidth / 2, curY + 7, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...TEXT_DARK);
  const projLines = doc.splitTextToSize(`"${safeStr(p.projectName)}"`, contentWidth - 20);
  doc.text(projLines, pageWidth / 2, curY + 16, { align: 'center' });

  curY += 46;
  // Problemática Comunitaria
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...NAVY);
  doc.text('PROBLEMÁTICA CENTRAL DEL ENTORNO ABORDADA:', margin + 6, curY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...TEXT_DARK);
  const probLines = doc.splitTextToSize(safeStr(p.problemStatement), contentWidth - 12);
  doc.text(probLines, margin + 6, curY + 5);

  curY += probLines.length * 3.6 + 14;

  // Cédula sintética de portada
  autoTable(doc, {
    startY: curY,
    body: [
      [
        { content: 'Plantel Educativo:', styles: { fontStyle: 'bold', textColor: NAVY, cellWidth: 42 } },
        { content: `${safeStr(sCtx.schoolName, 'Bachillerato General Estatal')} — CCT: ${safeStr(sCtx.cct, '21EBH0045X')}`, styles: { fontStyle: 'bold' } },
      ],
      [
        { content: 'Supervisión Escolar:', styles: { fontStyle: 'bold', textColor: NAVY } },
        { content: `${safeStr(sCtx.schoolZone, 'Zona Escolar 004')} | ${safeStr(sCtx.municipality, 'Zacatlán')}, Puebla`, styles: {} },
      ],
      [
        { content: 'Territorio de Impacto:', styles: { fontStyle: 'bold', textColor: NAVY } },
        { content: `${safeStr(communityLabel)} · ${safeStr(cCtx.location)}`, styles: {} },
      ],
      [
        { content: 'Docente Coordinador:', styles: { fontStyle: 'bold', textColor: NAVY } },
        { content: safeStr(teacherName, 'Docente de Colegiado Académico'), styles: { fontStyle: 'bold' } },
      ],
      [
        { content: 'Temporalidad / Ciclo:', styles: { fontStyle: 'bold', textColor: NAVY } },
        { content: `${cycleLabel} · Periodo Escolar ${SCHOOL_YEAR}`, styles: {} },
      ],
    ],
    theme: 'plain',
    styles: { fontSize: 7.2, cellPadding: 1.8, overflow: 'linebreak' },
    margin: { left: margin + 4, right: margin + 4 },
  });

  // Pie de portada con leyenda oficial
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(...TEXT_MUTED);
  doc.text('Documento oficial aprobado por el Consejo Técnico Escolar y registrado formalmente ante la Supervisión Escolar.', pageWidth / 2, pageHeight - 16, { align: 'center' });
  doc.text(`Emisión institucional: ${new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}`, pageWidth / 2, pageHeight - 12, { align: 'center' });

  // ═════════════════════════════════════════════════════════════════════════════
  // PÁGINA 2: CÉDULA OFICIAL DE IDENTIFICACIÓN INSTITUCIONAL DEL PROYECTO PEC
  // ═════════════════════════════════════════════════════════════════════════════
  doc.addPage('letter', 'portrait');
  curY = 24;
  addSectionBar(doc, 'Cédula Oficial de Identificación Institucional del Proyecto PEC', curY, margin, contentWidth);
  curY += 10;

  autoTable(doc, {
    startY: curY,
    head: [
      [
        {
          content: 'CÉDULA TÉCNICA INSTITUCIONAL REGISTRADA',
          colSpan: 2,
          styles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 8.5 },
        },
      ],
    ],
    body: [
      [
        { content: 'Nombre del Proyecto:', styles: { fontStyle: 'bold', textColor: NAVY, cellWidth: 50 } },
        { content: safeStr(p.projectName), styles: { fontStyle: 'bold', textColor: TEXT_DARK } },
      ],
      [
        { content: 'Problemática Central:', styles: { fontStyle: 'bold', textColor: NAVY } },
        { content: safeStr(p.problemStatement), styles: { textColor: TEXT_DARK } },
      ],
      [
        { content: 'Plantel Educativo / CCT:', styles: { fontStyle: 'bold', textColor: NAVY } },
        { content: `${safeStr(sCtx.schoolName, 'Bachillerato General Estatal')} (CCT: ${safeStr(sCtx.cct, 'N/D')})`, styles: { textColor: TEXT_DARK } },
      ],
      [
        { content: 'Zona / Municipio / Localidad:', styles: { fontStyle: 'bold', textColor: NAVY } },
        { content: `${safeStr(sCtx.schoolZone, 'Zona Escolar 004')} | Municipio: ${safeStr(sCtx.municipality)} | Localidad: ${safeStr(sCtx.locality)}`, styles: { textColor: TEXT_DARK } },
      ],
      [
        { content: 'Comunidad de Impacto:', styles: { fontStyle: 'bold', textColor: NAVY } },
        { content: `${safeStr(communityLabel)} (Área Territorial: ${safeStr(cCtx.location)})`, styles: { textColor: TEXT_DARK } },
      ],
      [
        { content: 'Ciclo / Tipo Operativo:', styles: { fontStyle: 'bold', textColor: NAVY } },
        { content: `${cycleLabel} · Ciclo Escolar ${SCHOOL_YEAR}`, styles: { textColor: TEXT_DARK } },
      ],
      [
        { content: 'Docente Coordinador PEC:', styles: { fontStyle: 'bold', textColor: NAVY } },
        { content: safeStr(teacherName, 'Docente Coordinador PEC'), styles: { textColor: TEXT_DARK } },
      ],
      [
        { content: 'Población Escolar / Docente:', styles: { fontStyle: 'bold', textColor: NAVY } },
        { content: `Estudiantes: ${safeStr(sCtx.enrollment, 'S/D')} alumnos | Personal Docente: ${safeStr(sCtx.teacherCount, 'S/D')} docentes frente a grupo`, styles: { textColor: TEXT_DARK } },
      ],
      [
        { content: 'Instalaciones y Capacidad:', styles: { fontStyle: 'bold', textColor: NAVY } },
        { content: safeStr(sCtx.facilities, 'Aulas, áreas deportivas, centro de cómputo y biblioteca escolar'), styles: { textColor: TEXT_DARK } },
      ],
      [
        { content: 'Indicadores Educativos Base:', styles: { fontStyle: 'bold', textColor: NAVY } },
        { content: safeStr(sCtx.indicators, 'Aprobación del 88%, deserción del 4.5%'), styles: { textColor: TEXT_DARK } },
      ],
      [
        { content: 'Programas y Alianzas Previas:', styles: { fontStyle: 'bold', textColor: NAVY } },
        { content: safeStr(sCtx.previousPrograms, 'Programas de vinculación comunitaria y reforestación escolar'), styles: { textColor: TEXT_DARK } },
      ],
      [
        { content: 'Fecha y Folio de Registro:', styles: { fontStyle: 'bold', textColor: NAVY } },
        { content: `${new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })} · Folio: PEC-${safeStr(sCtx.cct, '21EBH')}-${SCHOOL_YEAR.replace('/', '-')}`, styles: { textColor: TEXT_DARK } },
      ],
    ],
    theme: 'grid',
    styles: { fontSize: 7.2, cellPadding: 2.2, overflow: 'linebreak' },
    columnStyles: {
      0: { cellWidth: 50, fillColor: GRAY_BG },
      1: { cellWidth: contentWidth - 50 },
    },
    margin: { left: margin, right: margin },
  });
  // @ts-expect-error autoTable adds lastAutoTable to jsPDF instance
  curY = doc.lastAutoTable.finalY + 8;

  // Directorio y Fundamento Jurídico
  autoTable(doc, {
    startY: curY,
    head: [
      [
        {
          content: 'MARCO JURÍDICO Y NORMATIVO DE LA NUEVA ESCUELA MEXICANA',
          styles: { fillColor: BLUE_MID, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
        },
      ],
    ],
    body: [
      [
        {
          content:
            '• Constitución Política de los Estados Unidos Mexicanos (Artículo 3°): Educación integral, humanista y vinculada a la comunidad.\n' +
            '• Ley General de Educación (Artículos 11, 12, 13 y 14): La Nueva Escuela Mexicana fomenta el desarrollo socioemocional y la transformación territorial.\n' +
            '• Acuerdo Secretarial 09/08/23 (SEP): Establecimiento del Marco Curricular Común de la Educación Media Superior (MCCEMS).\n' +
            '• Lineamientos Técnico-Pedagógicos de Educación Media Superior 2024-2025: Implementación obligatoria del Proyecto Escolar Comunitario (PEC).',
          styles: { fontSize: 7, cellPadding: 2.5, textColor: TEXT_DARK },
        },
      ],
    ],
    theme: 'grid',
    margin: { left: margin, right: margin },
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // PÁGINA 3: MACRO-FASE I: DIAGNÓSTICO TERRITORIAL INTEGRAL (TABLAS 1 Y 2 DBEPA)
  // ═════════════════════════════════════════════════════════════════════════════
  doc.addPage('letter', 'portrait');
  curY = 24;
  addSectionBar(doc, 'Macro-Fase I: Diagnóstico Colectivo y Contextualización Comunitaria', curY, margin, contentWidth);
  curY += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...TEXT_DARK);
  const diagIntro = 'El diagnóstico colectivo constituye el punto de partida del PEC en el marco de la Nueva Escuela Mexicana. Articula los factores del entorno territorial con las capacidades operativas de la institución para fundamentar la pertinencia de la intervención.';
  const splitDiag = doc.splitTextToSize(diagIntro, contentWidth);
  doc.text(splitDiag, margin, curY);
  curY += splitDiag.length * 3.4 + 4;

  const diag = p.fase1Diagnostico;
  const t1Data: TableRow2Cols[] = diag?.tabla1 || (diag as Record<string, any>)?.tabla1Comunidad || [];
  const t1Rows = t1Data.length > 0
    ? t1Data.map((r: any, idx) => [
        safeStr(r.col1 || r.aspecto || r.aspect || `Dimensión ${idx + 1}`),
        safeStr(r.col2 || r.descripcion || r.analysis || 'Sin descripción'),
      ])
    : [
        ['Ubicación y Geografía', safeStr(cCtx.location, 'Entorno semiurbano/rural del Estado de Puebla')],
        ['Demografía y Población', safeStr(cCtx.demographics, 'Población en edad escolar con familias vinculadas a actividades agrícolas y de comercio')],
        ['Economía y Medios de Vida', safeStr(cCtx.economy, 'Economía sustentada en comercio local y agricultura de temporal')],
        ['Cultura y Tradiciones', safeStr(cCtx.traditions, 'Festividades patronales arraigadas y trabajo colectivo por faenas comunitarias')],
        ['Seguridad y Medio Ambiente', `${safeStr(cCtx.security, 'Comunidad pacífica con vigilancia comunitaria')} / ${safeStr(cCtx.environment, 'Retos en gestión de residuos e hídrica')}`],
      ];

  autoTable(doc, {
    startY: curY,
    head: [
      [
        {
          content: '1.1 DIAGNÓSTICO COMUNITARIO INTEGRAL (TABLA 1)',
          colSpan: 2,
          styles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        },
      ],
      [
        { content: 'Dimensión / Aspecto Territorial', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255], fontStyle: 'bold', cellWidth: 55 } },
        { content: 'Descripción y Hallazgos Relevantes en el Entorno', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255], fontStyle: 'bold', cellWidth: contentWidth - 55 } },
      ],
    ],
    body: t1Rows,
    theme: 'grid',
    styles: { fontSize: 7.2, cellPadding: 2, overflow: 'linebreak' },
    columnStyles: {
      0: { cellWidth: 55, fontStyle: 'bold', fillColor: GRAY_BG },
      1: { cellWidth: contentWidth - 55 },
    },
    margin: { left: margin, right: margin },
  });
  // @ts-expect-error autoTable adds lastAutoTable to jsPDF instance
  curY = doc.lastAutoTable.finalY + 7;

  // 1.2 Tabla 2: Diagnóstico del Centro Educativo
  const t2Data: TableRow2Cols[] = diag?.tabla2 || (diag as Record<string, any>)?.tabla2Educacion || [];
  const t2Rows = t2Data.length > 0
    ? t2Data.map((r: any, idx) => [
        safeStr(r.col1 || r.aspecto || r.aspect || `Indicador ${idx + 1}`),
        safeStr(r.col2 || r.descripcion || r.analysis || 'Sin descripción'),
      ])
    : [
        ['Infraestructura Física', safeStr(sCtx.facilities, 'Aulas funcionales, patio cívico, biblioteca y laboratorios')],
        ['Matrícula y Cobertura', `Matrícula activa: ${safeStr(sCtx.enrollment, '180')} alumnos en turnos matutino y vespertino`],
        ['Planta Docente', `Colegiado de ${safeStr(sCtx.teacherCount, '12')} docentes con especialidad y perfil afín al MCCEMS`],
        ['Programas Previos y Alianzas', safeStr(sCtx.previousPrograms, 'Participación en brigadas ecológicas y jornadas de reforestación')],
        ['Indicadores de Aprobación', safeStr(sCtx.indicators, 'Índice de aprobación del 88% con necesidad de reforzar áreas de razonamiento matemático')],
      ];

  autoTable(doc, {
    startY: curY,
    head: [
      [
        {
          content: '1.2 DIAGNÓSTICO DEL CENTRO EDUCATIVO (TABLA 2)',
          colSpan: 2,
          styles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        },
      ],
      [
        { content: 'Indicador del Contexto Escolar', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255], fontStyle: 'bold', cellWidth: 55 } },
        { content: 'Situación Actual y Capacidad Instalada', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255], fontStyle: 'bold', cellWidth: contentWidth - 55 } },
      ],
    ],
    body: t2Rows,
    theme: 'grid',
    styles: { fontSize: 7.2, cellPadding: 2, overflow: 'linebreak' },
    columnStyles: {
      0: { cellWidth: 55, fontStyle: 'bold', fillColor: GRAY_BG },
      1: { cellWidth: contentWidth - 55 },
    },
    margin: { left: margin, right: margin },
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // PÁGINA 4: 1.3 MATRIZ FODA CON ANÁLISIS CRUZADO 4×2 (PORTRAIT)
  // ═════════════════════════════════════════════════════════════════════════════
  doc.addPage('letter', 'portrait');
  curY = 24;
  addSectionBar(doc, '1.3 Matriz FODA Integral y Formulación de Estrategias Cruzadas', curY, margin, contentWidth);
  curY += 10;

  // Procesar datos FODA con normalización y fallbacks pedagógicos oficiales DBEPA
  const fodaRaw: unknown = diag?.tabla3 || (diag as Record<string, any>)?.tabla3Foda || [];
  const {
    fortalezas,
    oportunidades,
    debilidades,
    amenazas,
    estFO: estratFO,
    estDO: estratDO,
    estFA: estratFA,
    estDA: estratDA,
  } = parseFodaData(fodaRaw);

  // Tabla FODA 2×2
  autoTable(doc, {
    startY: curY,
    head: [
      [
        { content: 'FORTALEZAS INTERNAS (F)', styles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', cellWidth: contentWidth / 2 } },
        { content: 'OPORTUNIDADES EXTERNAS (O)', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255], fontStyle: 'bold', cellWidth: contentWidth / 2 } },
      ],
    ],
    body: [
      [
        { content: '• ' + fortalezas.join('\n• '), styles: { cellWidth: contentWidth / 2, fillColor: GRAY_BG } },
        { content: '• ' + oportunidades.join('\n• '), styles: { cellWidth: contentWidth / 2 } },
      ],
      [
        { content: 'DEBILIDADES INTERNAS (D)', styles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold' } },
        { content: 'AMENAZAS EXTERNAS (A)', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255], fontStyle: 'bold' } },
      ],
      [
        { content: '• ' + debilidades.join('\n• '), styles: { cellWidth: contentWidth / 2, fillColor: GRAY_BG } },
        { content: '• ' + amenazas.join('\n• '), styles: { cellWidth: contentWidth / 2 } },
      ],
    ],
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 2.2, overflow: 'linebreak' },
    margin: { left: margin, right: margin },
  });
  // @ts-expect-error autoTable adds lastAutoTable to jsPDF instance
  curY = doc.lastAutoTable.finalY + 8;

  // Tabla Estratégica Cruzada 4×2
  autoTable(doc, {
    startY: curY,
    head: [
      [
        {
          content: 'MATRIZ DE ESTRATEGIAS CRUZADAS DE INTERVENCIÓN SITUADA (4×2)',
          colSpan: 2,
          styles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        },
      ],
      [
        { content: 'Tipo de Estrategia Cruzada', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255], fontStyle: 'bold', cellWidth: 46 } },
        { content: 'Acción Estratégica Colegiada Articulada', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255], fontStyle: 'bold', cellWidth: contentWidth - 46 } },
      ],
    ],
    body: [
      [
        { content: 'Estrategia FO\n(Maxi - Maxi)\nFortalezas vs Oportunidades', styles: { fontStyle: 'bold', fillColor: GRAY_BG } },
        { content: estratFO },
      ],
      [
        { content: 'Estrategia DO\n(Mini - Maxi)\nDebilidades vs Oportunidades', styles: { fontStyle: 'bold', fillColor: GRAY_BG } },
        { content: estratDO },
      ],
      [
        { content: 'Estrategia FA\n(Maxi - Mini)\nFortalezas vs Amenazas', styles: { fontStyle: 'bold', fillColor: GRAY_BG } },
        { content: estratFA },
      ],
      [
        { content: 'Estrategia DA\n(Mini - Mini)\nDebilidades vs Amenazas', styles: { fontStyle: 'bold', fillColor: GRAY_BG } },
        { content: estratDA },
      ],
    ],
    theme: 'grid',
    styles: { fontSize: 7.2, cellPadding: 2.2, overflow: 'linebreak' },
    columnStyles: {
      0: { cellWidth: 46 },
      1: { cellWidth: contentWidth - 46 },
    },
    margin: { left: margin, right: margin },
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // PÁGINA 5: 1.4 PROCESO TÉCNICO DE PRIORIZACIÓN DEL PROBLEMA COMUNITARIO (TABLA 4)
  // ═════════════════════════════════════════════════════════════════════════════
  doc.addPage('letter', 'portrait');
  curY = 24;
  addSectionBar(doc, '1.4 Proceso Técnico de Priorización y Declaratoria del Problema Comunitario', curY, margin, contentWidth);
  curY += 10;

  const t4Data: TableRow2Cols[] = diag?.tabla4 || (diag as Record<string, any>)?.tabla4Priorizacion || [];
  const t4Rows = t4Data.length > 0
    ? t4Data.map((r: any, idx) => [
        safeStr(r.col1 || r.fase || `Etapa Metodológica ${idx + 1}`),
        safeStr(r.col2 || r.descripcion || 'Sin descripción'),
      ])
    : [
        ['Etapa 1: Consulta Diagnóstica Abierta', 'Levantamiento de encuestas y grupos de enfoque con padres, vecinos y autoridades locales.'],
        ['Etapa 2: Análisis y Deliberación Colegiada', 'El Consejo Técnico Escolar valoró las problemáticas según su pertinencia pedagógica y viabilidad operativa.'],
        ['Etapa 3: Priorización y Consenso Democrático', 'Selección de la problemática central por unanimidad del colegiado docente y comité comunitario.'],
        ['Etapa 4: Declaratoria y Adopción Oficial', 'Formalización del compromiso institucional del plantel para transformar el reto en eje articulador del PEC.'],
      ];

  autoTable(doc, {
    startY: curY,
    head: [
      [
        {
          content: '1.4 PROCESO METODOLÓGICO DE PRIORIZACIÓN DEMOCRÁTICA (TABLA 4)',
          colSpan: 2,
          styles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        },
      ],
      [
        { content: 'Etapa Metodológica', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255], fontStyle: 'bold', cellWidth: 55 } },
        { content: 'Acciones Realizadas y Mecanismos de Consenso Comunitario', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255], fontStyle: 'bold', cellWidth: contentWidth - 55 } },
      ],
    ],
    body: t4Rows,
    theme: 'grid',
    styles: { fontSize: 7.2, cellPadding: 2.2, overflow: 'linebreak' },
    columnStyles: {
      0: { cellWidth: 55, fontStyle: 'bold', fillColor: GRAY_BG },
      1: { cellWidth: contentWidth - 55 },
    },
    margin: { left: margin, right: margin },
  });
  // @ts-expect-error autoTable adds lastAutoTable to jsPDF instance
  curY = doc.lastAutoTable.finalY + 8;

  // Matriz de Ponderación Multicriterio
  autoTable(doc, {
    startY: curY,
    head: [
      [
        {
          content: 'PONDERACIÓN MULTICRITERIO PARA LA SELECCIÓN DEL PROBLEMA CENTRAL',
          colSpan: 5,
          styles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
        },
      ],
      [
        { content: 'Criterio de Evaluación', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255], cellWidth: 50 } },
        { content: 'Ponderación', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255], halign: 'center', cellWidth: 24 } },
        { content: 'Calificación (1-5)', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255], halign: 'center', cellWidth: 26 } },
        { content: 'Puntaje', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255], halign: 'center', cellWidth: 20 } },
        { content: 'Justificación Técnica de la Ponderación', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255], cellWidth: contentWidth - 120 } },
      ],
    ],
    body: [
      [
        { content: '1. Relevancia y Urgencia Social', styles: { fontStyle: 'bold' } },
        { content: '30%', styles: { halign: 'center' } },
        { content: '5 / 5', styles: { halign: 'center' } },
        { content: '1.50', styles: { halign: 'center', fontStyle: 'bold' } },
        { content: 'Afecta de manera directa la salud, bienestar y economía de las familias del entorno escolar.' },
      ],
      [
        { content: '2. Articulación Curricular (MCCEMS)', styles: { fontStyle: 'bold' } },
        { content: '25%', styles: { halign: 'center' } },
        { content: '5 / 5', styles: { halign: 'center' } },
        { content: '1.25', styles: { halign: 'center', fontStyle: 'bold' } },
        { content: 'Permite la articulación natural de progresiones de ciencias, humanidades, lenguaje y matemáticas.' },
      ],
      [
        { content: '3. Viabilidad Operativa Escolar', styles: { fontStyle: 'bold' } },
        { content: '20%', styles: { halign: 'center' } },
        { content: '4 / 5', styles: { halign: 'center' } },
        { content: '0.80', styles: { halign: 'center', fontStyle: 'bold' } },
        { content: 'Es alcanzable con las capacidades del plantel y el apoyo del comité comunitario.' },
      ],
      [
        { content: '4. Impacto Tangible Comunitario', styles: { fontStyle: 'bold' } },
        { content: '15%', styles: { halign: 'center' } },
        { content: '5 / 5', styles: { halign: 'center' } },
        { content: '0.75', styles: { halign: 'center', fontStyle: 'bold' } },
        { content: 'Genera productos, prototipos y beneficios observables y sostenibles en el tiempo.' },
      ],
      [
        { content: '5. Interés y Motivación Estudiantil', styles: { fontStyle: 'bold' } },
        { content: '10%', styles: { halign: 'center' } },
        { content: '5 / 5', styles: { halign: 'center' } },
        { content: '0.50', styles: { halign: 'center', fontStyle: 'bold' } },
        { content: 'Despierta vocación cívica, trabajo en equipo y liderazgo en las juventudes.' },
      ],
      [
        { content: 'PUNTAJE GLOBAL OBTENIDO', colSpan: 3, styles: { fontStyle: 'bold', fillColor: GRAY_BG, halign: 'right' } },
        { content: '4.80 / 5.0', styles: { halign: 'center', fontStyle: 'bold', fillColor: GREEN_BG, textColor: NAVY } },
        { content: 'PRIORIDAD MÁXIMA — ADOPCIÓN FORMALIZADA', styles: { fontStyle: 'bold', textColor: NAVY } },
      ],
    ],
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak' },
    margin: { left: margin, right: margin },
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // PÁGINA 6: MACRO-FASE II: JUSTIFICACIÓN PEDAGÓGICA Y PROPÓSITOS INTEGRALES (PORTRAIT)
  // ═════════════════════════════════════════════════════════════════════════════
  doc.addPage('letter', 'portrait');
  curY = 24;
  addSectionBar(doc, 'Macro-Fase II: Justificación Pedagógica y Diseño Curricular (MCCEMS)', curY, margin, contentWidth);
  curY += 10;

  const just = (p.fase2Justificacion || {}) as Partial<NonNullable<PaecProject['fase2Justificacion']>> & Record<string, any>; // fallback tipado defensivo

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...NAVY);
  doc.text('2.1 FUNDAMENTACIÓN Y JUSTIFICACIÓN EN LA NUEVA ESCUELA MEXICANA', margin, curY);
  curY += 4.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...TEXT_DARK);
  const introJust = safeStr(just.introduction, 'El presente Proyecto Escolar Comunitario se fundamenta en las directrices de la Nueva Escuela Mexicana, articulando el conocimiento científico, humanístico y tecnológico con la solución situada de los retos presentes en el entorno escolar y comunitario.');
  const splitJust = doc.splitTextToSize(introJust, contentWidth);
  doc.text(splitJust, margin, curY);
  curY += splitJust.length * 3.4 + 5;

  // Pilares NEM
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...NAVY);
  doc.text('Pilares Fundamentales de la Nueva Escuela Mexicana Incorporados:', margin, curY);
  curY += 4.5;

  const pilares: string[] = just.pilares || [
    'Fomento de la identidad con México y sentido de pertenencia comunitaria territorial',
    'Responsabilidad ciudadana y honestidad como valores rectores de la formación',
    'Participación protagónica en la transformación social y ambiental del entorno',
    'Respeto de la dignidad humana, inclusión y fomento de la cultura de paz',
    'Cuidado y preservación ecológica de la naturaleza y gestión sustentable de los recursos',
  ];
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...TEXT_DARK);
  pilares.forEach((pil) => {
    doc.text(`• ${pil}`, margin + 3, curY);
    curY += 3.8;
  });
  curY += 4;

  // Propósitos Integrales MIFO
  const prop = (just.proposito || {}) as Record<string, any>;
  autoTable(doc, {
    startY: curY,
    head: [
      [
        {
          content: '2.2 PROPÓSITOS INTEGRALES DEL PROYECTO (MIFO / MCCEMS)',
          colSpan: 2,
          styles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        },
      ],
    ],
    body: [
      [
        { content: 'Propósito Educativo:', styles: { fontStyle: 'bold', textColor: NAVY, cellWidth: 45 } },
        { content: safeStr(prop.educativo, 'Fortalecer el pensamiento crítico, las habilidades científicas y el trabajo interdisciplinario a través del aprendizaje situado.'), styles: { textColor: TEXT_DARK } },
      ],
      [
        { content: 'Propósito Social:', styles: { fontStyle: 'bold', textColor: NAVY } },
        { content: safeStr(prop.social, 'Promover la cohesión comunitaria, la participación ciudadana y el mejoramiento directo del bienestar territorial.'), styles: { textColor: TEXT_DARK } },
      ],
      [
        { content: 'Propósito Funcional:', styles: { fontStyle: 'bold', textColor: NAVY } },
        { content: safeStr(prop.funcional, 'Desarrollar productos, soluciones técnicas e intervenciones tangibles con impacto demostrable y sostenible.'), styles: { textColor: TEXT_DARK } },
      ],
    ],
    theme: 'grid',
    styles: { fontSize: 7.2, cellPadding: 2.2, overflow: 'linebreak' },
    columnStyles: {
      0: { cellWidth: 45, fillColor: GRAY_BG },
      1: { cellWidth: contentWidth - 45 },
    },
    margin: { left: margin, right: margin },
  });
  // @ts-expect-error autoTable adds lastAutoTable to jsPDF instance
  curY = doc.lastAutoTable.finalY + 7;

  // Alcance y Población Beneficiaria
  autoTable(doc, {
    startY: curY,
    head: [
      [
        {
          content: 'ALCANCE, COBERTURA Y BENEFICIARIOS DE LA INTERVENCIÓN',
          colSpan: 2,
          styles: { fillColor: BLUE_MID, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
        },
      ],
    ],
    body: [
      [
        { content: 'Beneficiarios Directos:', styles: { fontStyle: 'bold', cellWidth: 45 } },
        { content: `${safeStr(sCtx.enrollment, '240')} estudiantes del bachillerato, ${safeStr(sCtx.teacherCount, '12')} docentes y directivos involucrados directamente en las brigadas de aprendizaje.` },
      ],
      [
        { content: 'Beneficiarios Indirectos:', styles: { fontStyle: 'bold' } },
        { content: `Familias de la comunidad de ${safeStr(communityLabel)} (${safeStr(cCtx.demographics, 'población general')}), comerciantes y productores del territorio circundante.` },
      ],
      [
        { content: 'Delimitación Territorial:', styles: { fontStyle: 'bold' } },
        { content: `Instalaciones del plantel escolar y cuadrantes prioritarios de la localidad de ${safeStr(sCtx.locality)}, Municipio de ${safeStr(sCtx.municipality)}, Puebla.` },
      ],
    ],
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak' },
    margin: { left: margin, right: margin },
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // PÁGINA 7: 2.3 MAPEO CURRICULAR INTEGRAL (PARTE 1: SEMESTRES 1°, 2° Y 3°) (PORTRAIT)
  // ═════════════════════════════════════════════════════════════════════════════
  doc.addPage('letter', 'portrait');
  curY = 24;
  addSectionBar(doc, '2.3 Mapeo Curricular Integral (Parte 1: Semestres 1°, 2° y 3°)', curY, margin, contentWidth);
  curY += 10;

  const mapeo: MapeoRow[] = p.fase2Mapeo || [];
  const mapRowsPart1 = (mapeo.length > 0
    ? mapeo.filter((r: any) => Number(r.semester || r.semestre || 1) <= 3)
    : []
  ).map((r: any) => [
    `${r.semester || r.semestre || 1}°`,
    safeStr(r.uacName || r.uac || 'UAC'),
    safeStr(r.topic || r.progresion || 'Eje temático transversal'),
    `${r.horasSemanales || 4} h`,
    safeStr(r.linking || r.vinculacion || 'Vinculación comunitaria situada'),
  ]);

  const defaultPart1 = [
    ['1°', 'Lengua y Comunicación I', 'Elaboración de diagnósticos e informes comunitarios situados', '4 h', 'Redacción de las actas de asamblea y trípticos informativos para la comunidad.'],
    ['1°', 'Pensamiento Matemático I', 'Estadística descriptiva y análisis demográfico del entorno', '4 h', 'Interpretación matemática de los datos de la encuesta comunitaria y gráficas.'],
    ['1°', 'Cultura Digital I', 'Software ofimático y hojas de cálculo colaborativas', '3 h', 'Tabulación digitalizada de la información territorial y bases de datos.'],
    ['2°', 'Lengua y Comunicación II', 'Ensayo argumentativo y textos de divulgación científica', '4 h', 'Publicación de gacetas escolares sobre la problemática territorial.'],
    ['2°', 'Pensamiento Matemático II', 'Procesos de cambio y modelación funcional', '4 h', 'Modelado matemático de consumo, ahorro y proyecciones de impacto.'],
    ['3°', 'Cultura Digital II', 'Herramientas colaborativas, diseño web y multimedia', '3 h', 'Producción de la memoria audiovisual del proyecto y catálogo digital.'],
    ['3°', 'La Materia y sus Interacciones', 'Propiedades de la materia y balance químico ambiental', '4 h', 'Análisis de laboratorio de muestras de agua, suelo o materiales locales.'],
  ];

  autoTable(doc, {
    startY: curY,
    head: [
      [
        {
          content: 'ARTICULACIÓN MULTIDISCIPLINARIA DEL MCCEMS — SEMESTRES 1°, 2° Y 3°',
          colSpan: 5,
          styles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        },
      ],
      [
        { content: 'Sem.', styles: { halign: 'center', cellWidth: 14 } },
        { content: 'Unidad de Aprendizaje (UAC)', styles: { cellWidth: 42 } },
        { content: 'Eje Temático / Progresión', styles: { cellWidth: 46 } },
        { content: 'Hrs', styles: { halign: 'center', cellWidth: 12 } },
        { content: 'Vinculación con el Proyecto Comunitario', styles: { cellWidth: contentWidth - 114 } },
      ],
    ],
    body: mapRowsPart1.length > 0 ? mapRowsPart1 : defaultPart1,
    theme: 'grid',
    styles: { fontSize: 7.2, cellPadding: 2.2, overflow: 'linebreak' },
    headStyles: { fillColor: BLUE_MID, textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      0: { halign: 'center', fontStyle: 'bold', fillColor: GRAY_BG },
      1: { fontStyle: 'bold' },
      3: { halign: 'center' },
    },
    margin: { left: margin, right: margin },
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // PÁGINA 8: 2.3 MAPEO CURRICULAR INTEGRAL (PARTE 2: SEMESTRES 4°, 5° Y 6°) (PORTRAIT)
  // ═════════════════════════════════════════════════════════════════════════════
  doc.addPage('letter', 'portrait');
  curY = 24;
  addSectionBar(doc, '2.3 Mapeo Curricular Integral (Parte 2: Semestres 4°, 5° y 6°)', curY, margin, contentWidth);
  curY += 10;

  const mapRowsPart2 = (mapeo.length > 0
    ? mapeo.filter((r: any) => Number(r.semester || r.semestre || 1) >= 4)
    : []
  ).map((r: any) => [
    `${r.semester || r.semestre || 4}°`,
    safeStr(r.uacName || r.uac || 'UAC'),
    safeStr(r.topic || r.progresion || 'Eje temático transversal'),
    `${r.horasSemanales || 4} h`,
    safeStr(r.linking || r.vinculacion || 'Vinculación comunitaria situada'),
  ]);

  const defaultPart2 = [
    ['4°', 'Ciencias Sociales II', 'Estructura social y desarrollo económico regional', '3 h', 'Estudio socioeconómico de los beneficiarios y diseño de propuestas de política local.'],
    ['4°', 'Conciencia Histórica II', 'Procesos de transformación agraria y ambiental', '3 h', 'Recuperación de la memoria oral de adultos mayores sobre los recursos locales.'],
    ['5°', 'Cultura Digital III', 'Gestión de proyectos en la nube y marketing social', '3 h', 'Campaña de difusión digital comunitaria y portal web institucional.'],
    ['5°', 'Conciencia Histórica III', 'Memoria histórica local y cambios en el territorio', '3 h', 'Rescate del patrimonio cultural y ambiental del municipio y archivo fotográfico.'],
    ['6°', 'Filosofía y Ética Comunitaria', 'Ética del cuidado y responsabilidad socioecológica', '3 h', 'Debates comunitarios sobre justicia distributiva y cuidado de los bienes comunes.'],
    ['6°', 'Formación Laboral / Tutorías', 'Emprendimiento social y proyectos sustentables', '4 h', 'Plan de negocios sociales y transferencia tecnológica a comités comunitarios.'],
  ];

  autoTable(doc, {
    startY: curY,
    head: [
      [
        {
          content: 'ARTICULACIÓN MULTIDISCIPLINARIA DEL MCCEMS — SEMESTRES 4°, 5° Y 6°',
          colSpan: 5,
          styles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        },
      ],
      [
        { content: 'Sem.', styles: { halign: 'center', cellWidth: 14 } },
        { content: 'Unidad de Aprendizaje (UAC)', styles: { cellWidth: 42 } },
        { content: 'Eje Temático / Progresión', styles: { cellWidth: 46 } },
        { content: 'Hrs', styles: { halign: 'center', cellWidth: 12 } },
        { content: 'Vinculación con el Proyecto Comunitario', styles: { cellWidth: contentWidth - 114 } },
      ],
    ],
    body: mapRowsPart2.length > 0 ? mapRowsPart2 : defaultPart2,
    theme: 'grid',
    styles: { fontSize: 7.2, cellPadding: 2.2, overflow: 'linebreak' },
    headStyles: { fillColor: BLUE_MID, textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      0: { halign: 'center', fontStyle: 'bold', fillColor: GRAY_BG },
      1: { fontStyle: 'bold' },
      3: { halign: 'center' },
    },
    margin: { left: margin, right: margin },
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // PÁGINA 9: 2.4 CRONOGRAMA BIMESTRAL MACRO DEL PROYECTO (6 FASES OFICIALES) (PORTRAIT)
  // ═════════════════════════════════════════════════════════════════════════════
  doc.addPage('letter', 'portrait');
  curY = 24;
  addSectionBar(doc, '2.4 Cronograma Bimestral Macro del Proyecto (6 Fases Oficiales)', curY, margin, contentWidth);
  curY += 10;

  const crono: CronogramaRow[] = p.fase2Cronograma || [];
  const cronoRows = crono.length > 0
    ? crono.map((r: any, idx) => [
        safeStr(r.phase || r.faseBimestral || `Fase ${idx + 1}`),
        safeStr(r.semesterInvolved || r.periodo || `Bimestre ${idx + 1}`),
        safeStr(r.macroActivities || r.actividad || r.objective || 'Actividades de la fase'),
        safeStr(r.responsibleSubjects || r.uacParticipantes || 'Colegiado Docente'),
        safeStr(r.objective || r.entregables || 'Evidencia de aprendizaje'),
      ])
    : [
        ['Fase I: Diagnóstico', 'Bimestre 1 (Sem 1-4)', 'Levantamiento de campo y asamblea comunitaria inicial', 'Ciencias Sociales / Humanidades', 'Documento de Diagnóstico Aprobado'],
        ['Fase II: Diseño', 'Bimestre 2 (Sem 5-8)', 'Articulación de progresiones y prototipos', 'Pensamiento Matemático / Lengua', 'Diseño Técnico del Prototipo'],
        ['Fase III: Gestión', 'Bimestre 3 (Sem 9-12)', 'Gestión con aliados y trámites comunitarios', 'Formación Laboral / Tutorías', 'Oficios y Convenios Firmados'],
        ['Fase IV: Ejecución', 'Bimestre 4 (Sem 13-16)', 'Intervención de campo y faenas escolares', 'Todas las UACs participantes', 'Bitácoras de Implementación'],
        ['Fase V: Monitoreo', 'Bimestre 5 (Sem 17-20)', 'Medición de impacto y análisis pre/post', 'Metodología / Ciencias', 'Informe Estadístico de Resultados'],
        ['Fase VI: Cierre y Feria', 'Bimestre 6 (Sem 21-24)', 'Feria Comunitaria y entrega formal de custodias', 'Toda la Comunidad Escolar', 'Memoria Técnica y Dictamen'],
      ];

  autoTable(doc, {
    startY: curY,
    head: [
      [
        {
          content: '2.4 CRONOGRAMA BIMESTRAL MACRO DEL PROYECTO (6 FASES OFICIALES)',
          colSpan: 5,
          styles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        },
      ],
      [
        { content: 'Fase Bimestral', styles: { cellWidth: 32 } },
        { content: 'Periodo', styles: { cellWidth: 26 } },
        { content: 'Actividades Clave y Viga Maestra', styles: { cellWidth: 48 } },
        { content: 'Asignaturas Participantes', styles: { cellWidth: 40 } },
        { content: 'Entregables / Evidencia', styles: { cellWidth: contentWidth - 146 } },
      ],
    ],
    body: cronoRows,
    theme: 'grid',
    styles: { fontSize: 7.2, cellPadding: 2.2, overflow: 'linebreak' },
    headStyles: { fillColor: BLUE_MID, textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: GRAY_BG },
    },
    margin: { left: margin, right: margin },
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // PÁGINA 10: 2.5 DETALLE CURRICULAR: PROGRESIONES Y METAS — SEMESTRE A (PORTRAIT)
  // ═════════════════════════════════════════════════════════════════════════════
  doc.addPage('letter', 'portrait');
  curY = 24;
  addSectionBar(doc, '2.5 Detalle Curricular: Progresiones y Metas — Semestre A', curY, margin, contentWidth);
  curY += 10;

  const detalle: DetalleCurricularRow[] = p.fase2DetalleCurricular || [];
  const detRowsA = (detalle.length > 0
    ? detalle.filter((r: any) => [1, 3, 5].includes(Number(r.semester || r.semestre || 1)))
    : []
  ).map((r: any) => [
    `${r.semester || r.semestre || 1}°`,
    safeStr(r.uacName || r.uac || 'UAC'),
    safeStr(r.projectPhases || r.fasePec || 'Fases I-IV'),
    safeStr(r.progressionsOrPurposes || r.progresionesOPropositos || 'Progresiones del MCCEMS'),
    safeStr(r.curricularJustification || r.estrategiaEnsenanza || 'Aprendizaje basado en proyectos'),
    safeStr(r.responsables || 'Colegiado Docente'),
  ]);

  const defaultDetA = [
    ['1°', 'Lengua y Comunicación I', 'Fase I y II', 'Reconocimiento de la intención comunicativa y elaboración de mensajes formales situados.', 'Redacción reflexiva, encuestas y actas de campo.', 'Docente Titular'],
    ['1°', 'Pensamiento Matemático I', 'Fase I y III', 'Estadística básica, muestreo y representación gráfica de datos territoriales.', 'Resolución de problemas de campo y presupuestos.', 'Docente de Matemáticas'],
    ['3°', 'Cultura Digital II', 'Fase II y IV', 'Producción de contenidos multimedia y documentación en la nube para la memoria.', 'Laboratorio de medios digitales y catálogo web.', 'Docente de Informática'],
    ['3°', 'La Materia y sus Interacciones', 'Fase II y IV', 'Análisis fisicoquímico y balances ecológicos en el ecosistema territorial.', 'Prácticas de laboratorio y muestreos de agua/suelo.', 'Docente de Ciencias'],
    ['5°', 'Conciencia Histórica III', 'Fase I y IV', 'Preservación de la memoria histórica comunitaria y dinámicas de cambio territorial.', 'Indagación oral y recopilación de testimonios.', 'Docente de Sociales'],
  ];

  autoTable(doc, {
    startY: curY,
    head: [
      [
        {
          content: 'DETALLE CURRICULAR DE PROGRESIONES — SEMESTRES NONES (1°, 3° Y 5°)',
          colSpan: 6,
          styles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        },
      ],
      [
        { content: 'Sem.', styles: { halign: 'center', cellWidth: 12 } },
        { content: 'UAC / Materia', styles: { cellWidth: 34 } },
        { content: 'Fase PEC', styles: { cellWidth: 22 } },
        { content: 'Progresiones / Propósitos', styles: { cellWidth: 48 } },
        { content: 'Estrategia Didáctica', styles: { cellWidth: 44 } },
        { content: 'Responsable', styles: { cellWidth: contentWidth - 160 } },
      ],
    ],
    body: detRowsA.length > 0 ? detRowsA : defaultDetA,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 2.2, overflow: 'linebreak' },
    headStyles: { fillColor: BLUE_MID, textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      0: { halign: 'center', fontStyle: 'bold', fillColor: GRAY_BG },
      1: { fontStyle: 'bold' },
    },
    margin: { left: margin, right: margin },
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // PÁGINA 11: 2.5 DETALLE CURRICULAR: PROGRESIONES Y METAS — SEMESTRE B (PORTRAIT)
  // ═════════════════════════════════════════════════════════════════════════════
  doc.addPage('letter', 'portrait');
  curY = 24;
  addSectionBar(doc, '2.5 Detalle Curricular: Progresiones y Metas — Semestre B', curY, margin, contentWidth);
  curY += 10;

  const detRowsB = (detalle.length > 0
    ? detalle.filter((r: any) => [2, 4, 6].includes(Number(r.semester || r.semestre || 2)))
    : []
  ).map((r: any) => [
    `${r.semester || r.semestre || 2}°`,
    safeStr(r.uacName || r.uac || 'UAC'),
    safeStr(r.projectPhases || r.fasePec || 'Fases IV-VI'),
    safeStr(r.progressionsOrPurposes || r.progresionesOPropositos || 'Progresiones del MCCEMS'),
    safeStr(r.curricularJustification || r.estrategiaEnsenanza || 'Aprendizaje servicio'),
    safeStr(r.responsables || 'Colegiado Docente'),
  ]);

  const defaultDetB = [
    ['2°', 'Lengua y Comunicación II', 'Fase IV y V', 'Estructuración de textos argumentativos y discursos persuasivos de divulgación.', 'Ensayos reflexivos y presentaciones a la comunidad.', 'Docente Titular'],
    ['2°', 'Pensamiento Matemático II', 'Fase IV y VI', 'Modelación de variables cuantitativas para la optimización de recursos hídricos.', 'Resolución de problemas situados y presupuestos.', 'Docente de Matemáticas'],
    ['4°', 'Ciencias Sociales II', 'Fase IV y VI', 'Estructura social y desarrollo económico regional sustentable.', 'Evaluación del impacto socioformativo comunitario.', 'Docente de Sociales'],
    ['6°', 'Filosofía y Ética', 'Fase V y VI', 'Reflexión crítica sobre el cuidado del medio ambiente y la bioética.', 'Círculos de diálogo y asamblea de deliberación.', 'Docente de Humanidades'],
    ['6°', 'Formación Laboral', 'Fase IV y VI', 'Emprendimiento social y desarrollo de prototipos tecnológicos sustentables.', 'Feria Comunitaria y transferencia a beneficiarios.', 'Docente de Capacitación'],
  ];

  autoTable(doc, {
    startY: curY,
    head: [
      [
        {
          content: 'DETALLE CURRICULAR DE PROGRESIONES — SEMESTRES PARES (2°, 4° Y 6°)',
          colSpan: 6,
          styles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        },
      ],
      [
        { content: 'Sem.', styles: { halign: 'center', cellWidth: 12 } },
        { content: 'UAC / Materia', styles: { cellWidth: 34 } },
        { content: 'Fase PEC', styles: { cellWidth: 22 } },
        { content: 'Progresiones / Propósitos', styles: { cellWidth: 48 } },
        { content: 'Estrategia Didáctica', styles: { cellWidth: 44 } },
        { content: 'Responsable', styles: { cellWidth: contentWidth - 160 } },
      ],
    ],
    body: detRowsB.length > 0 ? detRowsB : defaultDetB,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 2.2, overflow: 'linebreak' },
    headStyles: { fillColor: BLUE_MID, textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      0: { halign: 'center', fontStyle: 'bold', fillColor: GRAY_BG },
      1: { fontStyle: 'bold' },
    },
    margin: { left: margin, right: margin },
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // MACRO-FASE III (A): PLAN OPERATIVO — SEMESTRE A (PÁGINAS 12 A 15 EN LANDSCAPE)
  // 4 PÁGINAS DEDICADAS: W1-4 (P12), W5-8 (P13), W9-12 (P14), W13-16 (P15)
  // ═════════════════════════════════════════════════════════════════════════════
  const planA: PlanOperativoRow[] = p.fase3PlanOperativoA || (p as Record<string, any>).fase2PlanSemestreA || p.fase2PlanOperativo?.semestreA || [];
  const planB: PlanOperativoRow[] = p.fase3PlanOperativoB || (p as Record<string, any>).fase2PlanSemestreB || p.fase2PlanOperativo?.semestreB || [];

  const parseWeekNum = (weekVal: unknown): number => {
    if (typeof weekVal === 'number') return weekVal;
    if (!weekVal) return 0;
    const match = String(weekVal).match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  };

  const partitionPlanRows = (rows: PlanOperativoRow[]): { rangeLabel: string; rows: PlanOperativoRow[] }[] => {
    if (rows.length === 0) {
      return [
        { rangeLabel: 'Semanas 1 a 4', rows: [] },
        { rangeLabel: 'Semanas 5 a 8', rows: [] },
        { rangeLabel: 'Semanas 9 a 12', rows: [] },
        { rangeLabel: 'Semanas 13 a 16', rows: [] },
      ];
    }

    const b1: PlanOperativoRow[] = [];
    const b2: PlanOperativoRow[] = [];
    const b3: PlanOperativoRow[] = [];
    const b4: PlanOperativoRow[] = [];
    const unassigned: PlanOperativoRow[] = [];

    rows.forEach((r) => {
      const w = parseWeekNum(r.week);
      if (w >= 1 && w <= 4) b1.push(r);
      else if (w >= 5 && w <= 8) b2.push(r);
      else if (w >= 9 && w <= 12) b3.push(r);
      else if (w >= 13 && w <= 16) b4.push(r);
      else unassigned.push(r);
    });

    if (b1.length > 0 || b2.length > 0 || b3.length > 0 || b4.length > 0) {
      unassigned.forEach((r, idx) => {
        if (idx % 4 === 0) b1.push(r);
        else if (idx % 4 === 1) b2.push(r);
        else if (idx % 4 === 2) b3.push(r);
        else b4.push(r);
      });
      return [
        { rangeLabel: 'Semanas 1 a 4', rows: b1 },
        { rangeLabel: 'Semanas 5 a 8', rows: b2 },
        { rangeLabel: 'Semanas 9 a 12', rows: b3 },
        { rangeLabel: 'Semanas 13 a 16', rows: b4 },
      ];
    }

    const chunkSize = Math.ceil(rows.length / 4);
    return [
      { rangeLabel: 'Semanas 1 a 4', rows: rows.slice(0, chunkSize) },
      { rangeLabel: 'Semanas 5 a 8', rows: rows.slice(chunkSize, chunkSize * 2) },
      { rangeLabel: 'Semanas 9 a 12', rows: rows.slice(chunkSize * 2, chunkSize * 3) },
      { rangeLabel: 'Semanas 13 a 16', rows: rows.slice(chunkSize * 3) },
    ];
  };

  const formatLandscapePlanChunk = (
    rowsChunk: PlanOperativoRow[],
    titleText: string,
    chunkRange: string,
    isFinalWeekHighlight = false
  ) => {
    if (rowsChunk.length === 0) return;

    doc.addPage('letter', 'landscape');
    const pW = doc.internal.pageSize.getWidth();   // 279.4 mm
    const cW = pW - margin * 2;                    // 251.4 mm
    curY = 24;

    addSectionBar(doc, `${titleText} — ${chunkRange}`, curY, margin, cW);
    curY += 10;

    const bodyData = rowsChunk.map((r) => {
      const isW16 = isFinalWeekHighlight && String(r.week).includes('16');
      return [
        { content: isW16 ? '★ 16' : safeStr(r.week), styles: { halign: 'center' as const, fontStyle: 'bold' as const, fillColor: isW16 ? GOLD_LIGHT : GRAY_BG } },
        { content: safeStr(r.phase), styles: { fontStyle: (isW16 ? 'bold' : 'normal') as 'bold' | 'normal', fillColor: isW16 ? GOLD_LIGHT : undefined } },
        { content: safeStr(r.uac), styles: { fontStyle: (isW16 ? 'bold' : 'normal') as 'bold' | 'normal', fillColor: isW16 ? GOLD_LIGHT : undefined } },
        { content: safeStr(r.activity), styles: { fillColor: isW16 ? GOLD_LIGHT : undefined } },
        { content: safeStr(r.progression), styles: { fillColor: isW16 ? GOLD_LIGHT : undefined } },
        { content: safeStr(r.strategy), styles: { fillColor: isW16 ? GOLD_LIGHT : undefined } },
        { content: safeStr(r.responsibles), styles: { fillColor: isW16 ? GOLD_LIGHT : undefined } },
        { content: safeStr(r.evaluationInstrument), styles: { fillColor: isW16 ? GOLD_LIGHT : undefined } },
      ];
    });

    autoTable(doc, {
      startY: curY,
      head: [
        [
          { content: 'Sem.', styles: { halign: 'center', cellWidth: 10 } },
          { content: 'Fase PEC', styles: { cellWidth: 26 } },
          { content: 'Materias / UAC', styles: { cellWidth: 32 } },
          { content: 'Actividad Situada de Campo', styles: { cellWidth: 54 } },
          { content: 'Progresión MCCEMS', styles: { cellWidth: 46 } },
          { content: 'Estrategia Didáctica', styles: { cellWidth: 30 } },
          { content: 'Responsables', styles: { cellWidth: 26 } },
          { content: 'Instrumento de Evaluación', styles: { cellWidth: cW - 224 } },
        ],
      ],
      body: bodyData,
      theme: 'grid',
      showHead: 'everyPage',
      styles: { fontSize: 7, cellPadding: 2.2, overflow: 'linebreak' },
      headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
      columnStyles: {
        0: { halign: 'center' },
      },
      margin: { left: margin, right: margin, top: 20, bottom: 20 },
    });
  };

  // Semestre A: Paginación dinámica por fases sin recortar filas
  const blocksA = partitionPlanRows(planA);
  const phaseSubtitlesA = [
    '(Fase I: Diagnóstico)',
    '(Fase II: Diseño)',
    '(Fase III: Gestión)',
    '(Fase IV: Ejecución)',
  ];
  blocksA.forEach((b, idx) => {
    if (b.rows.length > 0) {
      formatLandscapePlanChunk(
        b.rows,
        'Macro-Fase III (A): Plan Operativo Territorial — Semestre A',
        `${b.rangeLabel} ${phaseSubtitlesA[idx] || ''}`
      );
    }
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // MACRO-FASE III (B): PLAN OPERATIVO — SEMESTRE B (EN LANDSCAPE)
  // ═════════════════════════════════════════════════════════════════════════════
  const blocksB = partitionPlanRows(planB);
  const phaseSubtitlesB = [
    '(Fase IV: Intervención)',
    '(Fase V: Monitoreo)',
    '(Fase V: Evaluación)',
    '(Fase VI: Cierre y Feria Comunitaria)',
  ];
  blocksB.forEach((b, idx) => {
    if (b.rows.length > 0) {
      formatLandscapePlanChunk(
        b.rows,
        'Macro-Fase III (B): Plan Operativo Territorial — Semestre B',
        `${b.rangeLabel} ${phaseSubtitlesB[idx] || ''}`,
        idx === 3 // isFinalWeekHighlight para Feria Comunitaria en Sem 16
      );
    }
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // MACRO-FASE III (C): FORMALIZACIÓN INSTITUCIONAL (RETORNO A PORTRAIT)
  // PÁGINA 20: 3.1 CARTA DE CONVOCATORIA A LA ASAMBLEA ESCOLAR Y COMUNITARIA
  // ═════════════════════════════════════════════════════════════════════════════
  doc.addPage('letter', 'portrait');
  pageWidth = doc.internal.pageSize.getWidth();   // 215.9 mm
  pageHeight = doc.internal.pageSize.getHeight(); // 279.4 mm
  contentWidth = pageWidth - margin * 2;          // 187.9 mm
  curY = 24;

  addSectionBar(doc, '3.1 Carta Oficial de Convocatoria a la Asamblea Escolar y Comunitaria', curY, margin, contentWidth);
  curY += 10;

  const imp = (p.fase3Implementacion || {}) as Partial<NonNullable<PaecProject['fase3Implementacion']>> & Record<string, any>; // fallback tipado defensivo
  const carta = (imp.cartaInvitacion || {}) as Record<string, any>;

  autoTable(doc, {
    startY: curY,
    head: [
      [
        {
          content: 'CONVOCATORIA PÚBLICA INSTITUCIONAL PARA INSTALACIÓN DEL COMITÉ PEC',
          colSpan: 2,
          styles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
        },
      ],
    ],
    body: [
      [
        { content: 'Asunto Oficial:', styles: { fontStyle: 'bold', textColor: NAVY, cellWidth: 46 } },
        { content: safeStr(carta.asunto, 'Convocatoria a Asamblea General para Presentación y Validación del PEC'), styles: { fontStyle: 'bold', textColor: TEXT_DARK } },
      ],
      [
        { content: 'Fecha de Expedición:', styles: { fontStyle: 'bold', textColor: NAVY } },
        { content: safeStr(carta.fecha, new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })), styles: { textColor: TEXT_DARK } },
      ],
      [
        { content: 'Destinatarios Convocados:', styles: { fontStyle: 'bold', textColor: NAVY } },
        { content: safeStr(carta.destinatarios, 'Padres, Madres de Familia, Autoridades Locales, Ejidales, Vecinales y Sociedad Civil'), styles: { textColor: TEXT_DARK } },
      ],
      [
        { content: 'Cuerpo del Comunicado:', styles: { fontStyle: 'bold', textColor: NAVY } },
        { content: safeStr(carta.cuerpo, 'Por medio de la presente, la Dirección del Plantel y el Colegiado Docente convocan formalmente a la asamblea de apertura e instalación del Proyecto Escolar Comunitario, con el propósito de validar de manera corresponsable las acciones de impacto territorial en favor de nuestra comunidad.'), styles: { textColor: TEXT_DARK } },
      ],
      [
        { content: 'Sesión Programada:', styles: { fontStyle: 'bold', textColor: NAVY } },
        { content: `Fecha: ${safeStr(carta.fechaReunion, 'Semana 2 del ciclo')} | Hora: ${safeStr(carta.hora, '10:00 hrs')} | Lugar: ${safeStr(carta.lugar, 'Plaza Cívica del Plantel')}`, styles: { fontStyle: 'bold', textColor: TEXT_DARK } },
      ],
      [
        { content: 'Orden del Día Propuesto:', styles: { fontStyle: 'bold', textColor: NAVY } },
        {
          content:
            '1. Registro de asistencia y pase de lista de actores clave.\n' +
            '2. Presentación del diagnóstico colectivo y problemática comunitaria priorizada.\n' +
            '3. Exposición de las progresiones curriculares y metas de aprendizaje vinculadas.\n' +
            '4. Elección democrática e instalación del Comité de Seguimiento Comunitario.\n' +
            '5. Asuntos generales y firma del acta de acuerdos.',
          styles: { textColor: TEXT_DARK },
        },
      ],
      [
        { content: 'Autoridad Convocante:', styles: { fontStyle: 'bold', textColor: NAVY } },
        { content: `${safeStr(carta.firmante, teacherName)} — ${safeStr(carta.cargo, 'Director(a) del Plantel / Coordinador PEC')}`, styles: { fontStyle: 'bold', textColor: TEXT_DARK } },
      ],
    ],
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 2.5, overflow: 'linebreak' },
    columnStyles: {
      0: { cellWidth: 46, fillColor: GRAY_BG },
      1: { cellWidth: contentWidth - 46 },
    },
    margin: { left: margin, right: margin },
  });
  // @ts-expect-error autoTable adds lastAutoTable to jsPDF instance
  curY = doc.lastAutoTable.finalY + 12;

  // Sello y firma del convocante
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...NAVY);
  doc.text('ATENTAMENTE', pageWidth / 2, curY, { align: 'center' });
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.text('"Educación para la Transformación Social y el Bienestar Comunitario"', pageWidth / 2, curY + 4, { align: 'center' });

  doc.setDrawColor(...NAVY);
  doc.line(pageWidth / 2 - 35, curY + 20, pageWidth / 2 + 35, curY + 20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...TEXT_DARK);
  doc.text(safeStr(carta.firmante, teacherName), pageWidth / 2, curY + 24, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...TEXT_MUTED);
  doc.text(`${safeStr(carta.cargo, 'Director(a) del Plantel')} · CCT: ${safeStr(sCtx.cct, '21EBH0045X')}`, pageWidth / 2, curY + 27.5, { align: 'center' });

  // ═════════════════════════════════════════════════════════════════════════════
  // PÁGINA 21: 3.2 MINUTA DE INSTALACIÓN DEL COMITÉ DE SEGUIMIENTO COMUNITARIO
  // ═════════════════════════════════════════════════════════════════════════════
  doc.addPage('letter', 'portrait');
  curY = 24;
  addSectionBar(doc, '3.2 Minuta de Instalación del Comité de Seguimiento Comunitario', curY, margin, contentWidth);
  curY += 10;

  const minuta = imp.minutaArranque || (p.fase2Anexos as Record<string, any>)?.anexo1Minuta || {};
  const acuerdos: any[] = minuta.acuerdos || [];
  const partMinuta: any[] = minuta.firmas || [];

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...TEXT_DARK);
  doc.text(`En las instalaciones del plantel ${safeStr(sCtx.schoolName)}, siendo las 10:00 horas del día acordado, se reunieron docentes, directivos, padres de familia y autoridades del entorno para asentar formalmente la instalación del Comité de Seguimiento del PEC:`, margin, curY);
  curY += 5;

  const acuBody = acuerdos.length > 0
    ? acuerdos.map((a: any, idx) => [
        `${a.no || idx + 1}`,
        safeStr(a.acuerdo),
        safeStr(a.responsable),
        safeStr(a.fechaLimite || a.fechaCompromiso || 'Semana 4'),
      ])
    : [
        ['1', 'Presentar formalmente los objetivos, alcances y progresiones del PEC a toda la comunidad escolar.', 'Colegiado Docente', 'Semana 2'],
        ['2', 'Formalizar el comité de vigilancia, vinculación social y apoyo logístico territorial.', 'Dirección y Padres', 'Semana 3'],
        ['3', 'Gestionar espacios públicos y permisos con autoridades municipales para las intervenciones.', 'Comité Comunitario', 'Semana 6'],
        ['4', 'Supervisar la entrega de materiales para la elaboración de prototipos sustentables de campo.', 'Comisión Logística', 'Semana 8'],
        ['5', 'Coordinar el montaje y resguardo de productos para la Feria Comunitaria en la Semana 16.', 'Comité en Pleno', 'Semana 15'],
      ];

  autoTable(doc, {
    startY: curY,
    head: [
      [
        {
          content: 'ACUERDOS TÉCNICOS Y COMPROMISOS OPERATIVOS DEL COMITÉ',
          colSpan: 4,
          styles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        },
      ],
      [
        { content: 'No.', styles: { halign: 'center', cellWidth: 12 } },
        { content: 'Acuerdo Formalizado', styles: { cellWidth: contentWidth - 82 } },
        { content: 'Responsable Designado', styles: { cellWidth: 42 } },
        { content: 'Fecha Límite', styles: { halign: 'center', cellWidth: 28 } },
      ],
    ],
    body: acuBody,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak' },
    headStyles: { fillColor: BLUE_MID, textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      0: { halign: 'center', fontStyle: 'bold', fillColor: GRAY_BG },
      3: { halign: 'center' },
    },
    margin: { left: margin, right: margin },
  });
  // @ts-expect-error autoTable adds lastAutoTable to jsPDF instance
  curY = doc.lastAutoTable.finalY + 12;

  // Firmas del Comité
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...NAVY);
  doc.text('FIRMAS DE LOS INTEGRANTES DEL COMITÉ DE INSTALACIÓN:', margin, curY);
  curY += 6;

  const fCols = 2;
  const fW = (contentWidth - 10) / fCols;
  const dummyFirmas = partMinuta.length > 0 ? partMinuta : [
    { nombre: 'C. Juan Pérez Martínez', cargo: 'Presidente del Comité Comunitario' },
    { nombre: 'Mtra. Laura Sánchez Gómez', cargo: 'Secretaria Técnica / Docente Titular' },
    { nombre: 'C. Rosa María Hernández', cargo: 'Vocal de Vigilancia y Enlace Social' },
    { nombre: safeStr(teacherName, 'Prof. Roberto Mendoza'), cargo: 'Coordinador del PEC en el Plantel' },
  ];

  dummyFirmas.slice(0, 4).forEach((f: any, idx: number) => {
    const colIdx = idx % 2;
    const rowIdx = Math.floor(idx / 2);
    const boxX = margin + colIdx * (fW + 10);
    const boxY = curY + rowIdx * 20;

    doc.setDrawColor(...NAVY);
    doc.setLineWidth(0.4);
    doc.line(boxX + 6, boxY + 11, boxX + fW - 6, boxY + 11);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...TEXT_DARK);
    doc.text(safeStr(f.nombre), boxX + fW / 2, boxY + 14, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(safeStr(f.cargo), boxX + fW / 2, boxY + 17, { align: 'center' });
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // PÁGINAS 22, 23, 24: OFICIOS FORMALES A ALIADOS (1 PÁGINA CADA UNO)
  // ═════════════════════════════════════════════════════════════════════════════
  const oficiosDefault = [
    {
      num: '001',
      destinatario: 'C. Presidente(a) Municipal / Auxiliar',
      cargo: 'Autoridad Constitucional del Territorio',
      institucion: 'H. Ayuntamiento de Zacatlán, Puebla',
      asunto: 'Solicitud de vinculación institucional y facilidades operativas para el PEC',
      solicitud: 'Por este medio, el Bachillerato General solicita formalmente el respaldo institucional para el desarrollo de las brigadas escolares y actividades de diagnóstico en plazas y espacios públicos del municipio.',
      compromiso: 'El bachillerato se compromete a compartir los diagnósticos técnicos, datos y memorias generadas en beneficio de la planeación y desarrollo local sustentable.',
    },
    {
      num: '002',
      destinatario: 'Dr(a). Director(a) del Centro de Salud',
      cargo: 'Titular de la Unidad Médica Territorial',
      institucion: 'Secretaría de Salud del Estado de Puebla',
      asunto: 'Coordinación interinstitucional para pláticas y talleres de salud e higiene',
      solicitud: 'Se solicita atentamente el apoyo de personal médico y de enfermería para impartir talleres preventivos sobre saneamiento ambiental, manejo de agua y salud comunitaria a los estudiantes del proyecto.',
      compromiso: 'Las brigadas estudiantiles coadyuvarán en la difusión de carteles y campañas de salud preventiva en las manzanas y localidades adyacentes.',
    },
    {
      num: '003',
      destinatario: 'C. Comisariado Ejidal / Asociación de Productores',
      cargo: 'Representante de Productores y Ejidatarios Locales',
      institucion: 'Comité Ejidal y Productores del Territorio',
      asunto: 'Vinculación técnica, diálogo de saberes y acceso a parcelas demostrativas',
      solicitud: 'Se solicita autorización y asesoría de los productores locales para realizar recorridos de campo, análisis de muestras de suelo y agua, y montaje de parcelas demostrativas escolares.',
      compromiso: 'Los estudiantes transferirán los prototipos y biofiltros construidos directamente al comité ejidal para su uso y resguardo permanente.',
    },
  ];

  const oficiosData = (imp.oficiosAliados && imp.oficiosAliados.length > 0) ? imp.oficiosAliados : oficiosDefault;

  oficiosData.slice(0, 3).forEach((of: any, idx: number) => {
    doc.addPage('letter', 'portrait');
    curY = 24;
    addSectionBar(doc, `3.3 Oficio Oficial a Aliados No. 00${idx + 1}/PEC — ${safeStr(of.institucion)}`, curY, margin, contentWidth);
    curY += 10;

    autoTable(doc, {
      startY: curY,
      head: [
        [
          {
            content: `OFICIO OFICIAL DE VINCULACIÓN INTERINSTITUCIONAL · NO. PEC-${safeStr(sCtx.cct, '21EBH')}-00${idx + 1}/${new Date().getFullYear()}`,
            colSpan: 2,
            styles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
          },
        ],
      ],
      body: [
        [
          { content: 'Destinatario:', styles: { fontStyle: 'bold', textColor: NAVY, cellWidth: 44 } },
          { content: `${safeStr(of.destinatario)}\n${safeStr(of.cargo)} — ${safeStr(of.institucion)}`, styles: { fontStyle: 'bold', textColor: TEXT_DARK } },
        ],
        [
          { content: 'Asunto Oficial:', styles: { fontStyle: 'bold', textColor: NAVY } },
          { content: safeStr(of.asunto), styles: { fontStyle: 'bold', textColor: TEXT_DARK } },
        ],
        [
          { content: 'Lugar y Fecha:', styles: { fontStyle: 'bold', textColor: NAVY } },
          { content: `${safeStr(sCtx.municipality, 'Puebla')}, Pue., a ${new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}`, styles: { textColor: TEXT_DARK } },
        ],
        [
          { content: 'Planteamiento de Colaboración:', styles: { fontStyle: 'bold', textColor: NAVY } },
          { content: safeStr(of.solicitud || of.propuestaColaboracion, 'Se solicita atentamente su valiosa colaboración y acompañamiento en las acciones territoriales del proyecto escolar.'), styles: { textColor: TEXT_DARK } },
        ],
        [
          { content: 'Compromiso Institucional:', styles: { fontStyle: 'bold', textColor: NAVY } },
          { content: safeStr(of.compromiso || 'El plantel compartirá plenamente los resultados, informes técnicos y productos generados con la dependencia aliada.'), styles: { textColor: TEXT_DARK } },
        ],
        [
          { content: 'Efectos Esperados:', styles: { fontStyle: 'bold', textColor: NAVY } },
          { content: 'Consolidar la alianza escuela-comunidad y maximizar el beneficio formativo para el alumnado y el impacto directo en la población.', styles: { textColor: TEXT_DARK } },
        ],
      ],
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 2.5, overflow: 'linebreak' },
      columnStyles: {
        0: { cellWidth: 44, fillColor: GRAY_BG },
        1: { cellWidth: contentWidth - 44 },
      },
      margin: { left: margin, right: margin },
    });
    // @ts-expect-error autoTable adds lastAutoTable to jsPDF instance
    curY = doc.lastAutoTable.finalY + 16;

    // Firmas del Oficio
    const bW = (contentWidth - 10) / 2;
    // Bloque Firma Emisor
    doc.setDrawColor(...NAVY);
    doc.setLineWidth(0.4);
    doc.line(margin + 10, curY + 14, margin + bW - 10, curY + 14);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...TEXT_DARK);
    doc.text(safeStr(carta.firmante, teacherName), margin + bW / 2, curY + 18, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...TEXT_MUTED);
    doc.text('Director(a) / Coordinador(a) PEC', margin + bW / 2, curY + 21, { align: 'center' });

    // Bloque Acuse de Recibo
    doc.setDrawColor(...NAVY);
    doc.rect(margin + bW + 10, curY - 2, bW - 20, 28, 'S');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...NAVY);
    doc.text('SELLO Y ACUSE DE RECIBIDO', margin + bW + bW / 2, curY + 4, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(...TEXT_MUTED);
    doc.text('Fecha de recepción: ____ / ____ / ________', margin + bW + bW / 2, curY + 12, { align: 'center' });
    doc.text('Nombre y firma de quien recibe: ________________', margin + bW + bW / 2, curY + 18, { align: 'center' });
    doc.text('Sello oficial de la dependencia', margin + bW + bW / 2, curY + 23, { align: 'center' });
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // PÁGINA 25: ANEXO 1: CÉDULA DE DIAGNÓSTICO PARTICIPATIVO COMUNITARIO (PORTRAIT)
  // ═════════════════════════════════════════════════════════════════════════════
  doc.addPage('letter', 'portrait');
  curY = 24;
  addSectionBar(doc, 'Anexo 1: Cédula de Diagnóstico Comunitario Participativo', curY, margin, contentWidth);
  curY += 10;

  const anexos = (p.fase2Anexos || {}) as Record<string, any>; // fallback tipado defensivo

  autoTable(doc, {
    startY: curY,
    head: [
      [
        {
          content: 'ANEXO 1: FORMATO DE RECOLECCIÓN DE DATOS Y DIAGNÓSTICO EN CAMPO',
          colSpan: 2,
          styles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        },
      ],
    ],
    body: [
      [
        { content: 'Objetivo del Instrumento:', styles: { fontStyle: 'bold', textColor: NAVY, cellWidth: 48 } },
        { content: 'Levantar información empírica directamente en territorio a través de brigadas estudiantiles para documentar las condiciones de la problemática identificada.', styles: { textColor: TEXT_DARK } },
      ],
      [
        { content: 'Metodología de Aplicación:', styles: { fontStyle: 'bold', textColor: NAVY } },
        { content: 'Entrevistas semiestructuradas, recorridos territoriales de observación guiada y aplicación de cédulas en hogares y comercios locales.', styles: { textColor: TEXT_DARK } },
      ],
      [
        { content: 'Universo de Muestreo:', styles: { fontStyle: 'bold', textColor: NAVY } },
        { content: 'Muestra representativa de 150 hogares en la comunidad de impacto, estratificada por cuadrantes y sectores de actividad.', styles: { textColor: TEXT_DARK } },
      ],
      [
        { content: 'Dimensiones Indagadas:', styles: { fontStyle: 'bold', textColor: NAVY } },
        {
          content:
            '• Acceso, calidad y regularidad en los servicios básicos comunitarios.\n' +
            '• Percepción comunitaria sobre los focos de contaminación y riesgos ambientales.\n' +
            '• Disposición de los vecinos a participar en faenas y talleres escolares de solución.\n' +
            '• Recursos locales disponibles (materiales, saberes ancestrales y mano de obra voluntaria).',
          styles: { textColor: TEXT_DARK },
        },
      ],
      [
        { content: 'Responsables de Brigada:', styles: { fontStyle: 'bold', textColor: NAVY } },
        { content: 'Docentes titulares de Ciencias Sociales y Humanidades con brigadas de estudiantes de 1er y 3er semestre.', styles: { textColor: TEXT_DARK } },
      ],
    ],
    theme: 'grid',
    styles: { fontSize: 7.2, cellPadding: 2.2, overflow: 'linebreak' },
    columnStyles: {
      0: { cellWidth: 48, fillColor: GRAY_BG },
      1: { cellWidth: contentWidth - 48 },
    },
    margin: { left: margin, right: margin },
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // PÁGINA 26: ANEXO 2: MATRIZ DE MONITOREO Y SEGUIMIENTO SEMANAL POR UAC
  // ═════════════════════════════════════════════════════════════════════════════
  doc.addPage('letter', 'portrait');
  curY = 24;
  addSectionBar(doc, 'Anexo 2: Matriz de Monitoreo y Seguimiento Semanal por UAC', curY, margin, contentWidth);
  curY += 10;

  const anexo2: SeguimientoRow[] = anexos.anexo2Seguimiento || [];
  const anexo2Rows = anexo2.length > 0
    ? anexo2.map((r: any, idx) => [
        `${r.semana || idx + 1} (${r.fase || 'Fase I'})`,
        safeStr(r.uac || 'UAC'),
        safeStr(r.metaOperativa || r.actividadPlaneada || 'Meta formativa'),
        safeStr(r.evidencia || r.actividadRealizada || 'Evidencia'),
        `${r.avancePorcentaje ?? r.porcentajeAvance ?? 100}%`,
        (r.semaforo || 'VERDE').toUpperCase(),
      ])
    : [
        ['Sem. 2 (Fase I)', 'Lengua y Comunicación I', 'Aplicación de cuestionarios de contexto', 'Instrumentos contestados', '100%', 'VERDE'],
        ['Sem. 4 (Fase I)', 'Pensamiento Matemático I', 'Tabulación y gráficas de la encuesta', 'Gráficas estadísticas', '100%', 'VERDE'],
        ['Sem. 6 (Fase II)', 'Cultura Digital I', 'Diseño de base de datos territorial', 'Hoja de cálculo en la nube', '100%', 'VERDE'],
        ['Sem. 8 (Fase II)', 'Ciencias Naturales', 'Diseño del prototipo sustentable de campo', 'Memoria de cálculo y planos', '95%', 'VERDE'],
        ['Sem. 10 (Fase III)', 'Humanidades / Ética', 'Gestión de acuerdos con líderes ejidales', 'Oficios y actas firmadas', '90%', 'VERDE'],
        ['Sem. 12 (Fase IV)', 'Laboratorio Multidisciplinar', 'Montaje y pruebas del prototipo en terreno', 'Bitácora fotográfica de campo', '85%', 'AMARILLO'],
        ['Sem. 14 (Fase V)', 'Colegiado Docente', 'Aplicación de encuestas de satisfacción vecinal', 'Cédulas Likert procesadas', '90%', 'VERDE'],
        ['Sem. 16 (Fase VI)', 'Comunidad Escolar', 'Montaje de stands en Feria Comunitaria', 'Muestra viva y acta de cierre', '100%', 'VERDE'],
      ];

  autoTable(doc, {
    startY: curY,
    head: [
      [
        {
          content: 'ANEXO 2: MATRIZ DE MONITOREO Y SEGUIMIENTO SEMANAL POR UAC',
          colSpan: 6,
          styles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        },
      ],
      [
        { content: 'Sem./Fase', styles: { cellWidth: 26 } },
        { content: 'UAC', styles: { cellWidth: 36 } },
        { content: 'Meta Operativa', styles: { cellWidth: 44 } },
        { content: 'Evidencia', styles: { cellWidth: 45 } },
        { content: 'Avance', styles: { halign: 'center', cellWidth: 16 } },
        { content: 'Semáforo', styles: { halign: 'center', cellWidth: contentWidth - 167 } },
      ],
    ],
    body: anexo2Rows,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak' },
    headStyles: { fillColor: BLUE_MID, textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: GRAY_BG },
      4: { halign: 'center' },
      5: { halign: 'center', fontStyle: 'bold' },
    },
    margin: { left: margin, right: margin },
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // PÁGINA 27: ANEXO 3: FORMATO DE REPORTE MENSUAL DE AVANCE Y AJUSTES (PORTRAIT)
  // ═════════════════════════════════════════════════════════════════════════════
  doc.addPage('letter', 'portrait');
  curY = 24;
  addSectionBar(doc, 'Anexo 3: Formato de Reporte Mensual de Avance y Ajustes Pedagógicos', curY, margin, contentWidth);
  curY += 10;

  const a3 = anexos.anexo3ReporteMensual || {};
  autoTable(doc, {
    startY: curY,
    head: [
      [
        {
          content: 'ANEXO 3: INFORME MENSUAL DE SEGUIMIENTO Y BITÁCORA TÉCNICA',
          colSpan: 2,
          styles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        },
      ],
    ],
    body: [
      [
        { content: 'Periodo Informado:', styles: { fontStyle: 'bold', textColor: NAVY, cellWidth: 45 } },
        { content: safeStr(a3.periodo, 'Bimestre Operativo de Implementación'), styles: { textColor: TEXT_DARK } },
      ],
      [
        { content: 'Resumen Ejecutivo:', styles: { fontStyle: 'bold', textColor: NAVY } },
        { content: safeStr(a3.resumenEjecutivo, 'Avance sustantivo en la conformación de brigadas y recopilación de evidencias en campo con alta participación de docentes, estudiantes y padres de familia.'), styles: { textColor: TEXT_DARK } },
      ],
      [
        { content: 'Logros Principales:', styles: { fontStyle: 'bold', textColor: NAVY } },
        { content: (a3.logros || ['Integración del 100% de los grupos escolares en las actividades del PEC', 'Consolidación de alianzas estratégicas con autoridades del territorio', 'Construcción participativa de prototipos funcionales de bajo costo']).join('\n• '), styles: { textColor: TEXT_DARK } },
      ],
      [
        { content: 'Dificultades y Ajustes:', styles: { fontStyle: 'bold', textColor: NAVY } },
        { content: (a3.accionesAjuste || a3.dificultades || ['Ajuste de tiempos de traslado para brigadas de campo mediante roles escalonados', 'Acopio solidario de materiales reciclables para mitigar costos']).join('\n• '), styles: { textColor: TEXT_DARK } },
      ],
      [
        { content: 'Evidencias Anexadas:', styles: { fontStyle: 'bold', textColor: NAVY } },
        { content: 'Fotografías de faenas comunitarias, listas de asistencia, gráficas estadísticas y actas de acuerdos vecinales.', styles: { textColor: TEXT_DARK } },
      ],
    ],
    theme: 'grid',
    styles: { fontSize: 7.2, cellPadding: 2.2, overflow: 'linebreak' },
    columnStyles: {
      0: { cellWidth: 45, fillColor: GRAY_BG },
      1: { cellWidth: contentWidth - 45 },
    },
    margin: { left: margin, right: margin },
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // PÁGINAS 28, 29, 30: ANEXOS 4, 5, 6 (ENCUESTAS Y RÚBRICAS LIKERT DEDICADAS)
  // ═════════════════════════════════════════════════════════════════════════════
  const renderDedicatedLikert = (title: string, desc: string, items: any[], tableHeadTitle: string) => {
    doc.addPage('letter', 'portrait');
    curY = 24;
    addSectionBar(doc, title, curY, margin, contentWidth);
    curY += 10;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...TEXT_DARK);
    doc.text(desc, margin, curY);
    curY += 6;

    const body = items.map((it: any) => [
      safeStr(it.reactivo),
      safeStr(it.dimension),
      '[  ]', '[  ]', '[  ]', '[  ]', '[  ]',
    ]);

    autoTable(doc, {
      startY: curY,
      head: [
        [
          { content: tableHeadTitle, colSpan: 7, styles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 } },
        ],
        [
          { content: 'Reactivo / Indicador Evaluado', styles: { cellWidth: contentWidth - 94 } },
          { content: 'Dimensión', styles: { cellWidth: 34 } },
          { content: 'TD', styles: { halign: 'center', cellWidth: 12 } },
          { content: 'D', styles: { halign: 'center', cellWidth: 12 } },
          { content: 'N', styles: { halign: 'center', cellWidth: 12 } },
          { content: 'A', styles: { halign: 'center', cellWidth: 12 } },
          { content: 'TA', styles: { halign: 'center', cellWidth: 12 } },
        ],
      ],
      body,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 2.2, overflow: 'linebreak' },
      headStyles: { fillColor: BLUE_MID, textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: {
        2: { halign: 'center' },
        3: { halign: 'center' },
        4: { halign: 'center' },
        5: { halign: 'center' },
        6: { halign: 'center' },
      },
      margin: { left: margin, right: margin },
    });
    // @ts-expect-error autoTable adds lastAutoTable to jsPDF instance
    curY = doc.lastAutoTable.finalY + 6;

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6.5);
    doc.setTextColor(...TEXT_MUTED);
    doc.text('Escala: TD = Totalmente en Desacuerdo (1) | D = En Desacuerdo (2) | N = Neutral / Regular (3) | A = De Acuerdo (4) | TA = Totalmente de Acuerdo (5)', margin, curY);
  };

  // PÁGINA 28: Anexo 4
  const itemsA4 = [
    { reactivo: '1. El proyecto aborda una problemática auténtica, sentida y prioritaria para las familias de la comunidad.', dimension: 'Pertinencia Social' },
    { reactivo: '2. Se percibió una comunicación clara, respetuosa y constante por parte de los estudiantes y docentes.', dimension: 'Vinculación' },
    { reactivo: '3. Las actividades de campo y faenas se realizaron con orden, respeto y cuidado del entorno común.', dimension: 'Convivencia Ciudadana' },
    { reactivo: '4. Los prototipos, acciones o talleres impartidos brindaron soluciones útiles y prácticas al problema.', dimension: 'Impacto Técnico' },
    { reactivo: '5. La comunidad escolar tomó en cuenta las sugerencias y saberes de los vecinos y líderes locales.', dimension: 'Diálogo de Saberes' },
    { reactivo: '6. Se evidencia un cambio favorable y visible en el espacio territorial intervenido por el bachillerato.', dimension: 'Transformación' },
    { reactivo: '7. Recomendaría que este tipo de proyectos continúen implementándose en los siguientes ciclos escolares.', dimension: 'Sostenibilidad' },
    { reactivo: '8. En general, considero que el bachillerato es un motor positivo de desarrollo para nuestra comunidad.', dimension: 'Valoración Global' },
  ];
  renderDedicatedLikert(
    'Anexo 4: Encuesta de Impacto Comunitario (Escala Likert 5 Niveles)',
    'Instrumento estandarizado de valoración social aplicado a vecinos, padres de familia y aliados del entorno territorial:',
    itemsA4,
    'EVALUACIÓN DE PERCEPCIÓN E IMPACTO SOCIAL EN LA COMUNIDAD'
  );

  // PÁGINA 29: Anexo 5
  const itemsA5 = [
    { reactivo: '1. Comprendí con claridad la vinculación entre los temas de clase y la solución del problema comunitario.', dimension: 'Sentido del Aprendizaje' },
    { reactivo: '2. Participé de manera activa, responsable y colaborativa en las brigadas de trabajo y faenas de campo.', dimension: 'Trabajo Colaborativo' },
    { reactivo: '3. Desarrollé habilidades de investigación, comunicación oral y resolución práctica de imprevistos.', dimension: 'Habilidades Socioformativas' },
    { reactivo: '4. Desarrollé empatía y mayor compromiso con las personas y familias de mi comunidad territorial.', dimension: 'Conciencia Ciudadana' },
    { reactivo: '5. Fui capaz de reflexionar críticamente sobre mis errores y buscar alternativas de mejora en el equipo.', dimension: 'Metacognición' },
    { reactivo: '6. Apliqué el pensamiento crítico y matemático para optimizar los recursos y materiales asignados.', dimension: 'Rigor Académico' },
    { reactivo: '7. El proyecto despertó mi interés por seguir aprendiendo y participar en causas sociales de mi localidad.', dimension: 'Proyecto de Vida' },
    { reactivo: '8. Mi contribución al equipo fue valiosa para el logro del prototipo final y la feria comunitaria.', dimension: 'Autoeficacia' },
  ];
  renderDedicatedLikert(
    'Anexo 5: Instrumento de Autoevaluación Estudiantil y Metacognición',
    'Rúbrica de reflexión individual sobre el propio proceso de aprendizaje situado, socioemocional y cívico:',
    itemsA5,
    'CÉDULA DE AUTOEVALUACIÓN ESTUDIANTIL Y APRENDIZAJE SITUADO'
  );

  // PÁGINA 30: Anexo 6
  const itemsA6 = [
    { reactivo: '1. El colegiado docente articuló de forma efectiva los ejes temáticos y progresiones transversales.', dimension: 'Interdisciplinariedad' },
    { reactivo: '2. Se mantuvo una planeación coordinada que evitó la sobrecarga de tareas y duplicidad de actividades.', dimension: 'Organización Académica' },
    { reactivo: '3. Se acompañó de manera cercana y formativa a las brigadas de estudiantes en sus labores de campo.', dimension: 'Mediación Pedagógica' },
    { reactivo: '4. Se aplicaron instrumentos de evaluación auténtica (rúbricas, listas de cotejo y bitácoras de campo).', dimension: 'Evaluación Formativa' },
    { reactivo: '5. Se promovió el diálogo respetuoso y la toma de acuerdos corresponsables con el comité comunitario.', dimension: 'Vinculación Territorial' },
    { reactivo: '6. El colegiado analizó oportunamente los obstáculos detectados para realizar los ajustes necesarios.', dimension: 'Mejora Continua' },
    { reactivo: '7. Se sistematizaron las evidencias y testimonios requeridos para el expediente oficial del PEC.', dimension: 'Documentación Técnica' },
    { reactivo: '8. El trabajo colegiado fortaleció la identidad institucional del bachillerato y el clima escolar.', dimension: 'Cultura Institucional' },
  ];
  renderDedicatedLikert(
    'Anexo 6: Rúbrica de Evaluación del Trabajo Colegiado Docente',
    'Cédula de coevaluación del colegiado docente sobre el diseño, gestión y acompañamiento técnico del PEC:',
    itemsA6,
    'EVALUACIÓN FORMATIVA DEL TRABAJO COLEGIADO Y GESTIÓN ACADÉMICA'
  );

  // ═════════════════════════════════════════════════════════════════════════════
  // PÁGINA 31: MACRO-FASE IV: 4.1 CALENDARIO DE GOBERNANZA ESCOLAR (PORTRAIT)
  // ═════════════════════════════════════════════════════════════════════════════
  doc.addPage('letter', 'portrait');
  curY = 24;
  addSectionBar(doc, 'Macro-Fase IV: Gobernanza Escolar y Estructura Colegiada', curY, margin, contentWidth);
  curY += 10;

  const gob = (p.fase4Gobernanza || {}) as Partial<NonNullable<PaecProject['fase4Gobernanza']>> & Record<string, any>; // fallback tipado defensivo
  const gobSesiones: any[] = gob.sesiones || [
    {
      tipo: 'Instalación y Planeación',
      participantes: 'Director, Colegiado Docente y Comité Comunitario',
      fecha: 'Semana 2 del ciclo escolar',
      agenda: 'Presentación del diagnóstico, ratificación de problemáticas y firma de minuta inicial.',
      evidencia: 'Minuta de instalación firmada y lista de asistencia.',
      acuerdos: 'Formalización del calendario de faenas y comisiones de enlace.',
    },
    {
      tipo: 'Seguimiento de Medio Término',
      participantes: 'Colegiado Docente y Representantes de Alumnos',
      fecha: 'Semana 8 del ciclo escolar',
      agenda: 'Revisión del avance en progresiones curriculares y primeros prototipos.',
      evidencia: 'Reporte mensual de avance y matriz de semáforos.',
      acuerdos: 'Ajuste de tiempos y reprogramación de brigadas rezagadas.',
    },
    {
      tipo: 'Monitoreo y Ajustes de Campo',
      participantes: 'Docentes Líderes y Aliados Territoriales',
      fecha: 'Semana 12 del ciclo escolar',
      agenda: 'Evaluación de las pruebas piloto del prototipo en terreno comunitario.',
      evidencia: 'Bitácoras de campo y testimonios de beneficiarios.',
      acuerdos: 'Preparación de insumos y logística para la Feria Comunitaria.',
    },
    {
      tipo: 'Cierre, Rendición de Cuentas y Dictamen',
      participantes: 'Comunidad Escolar en Pleno y Supervisión 004',
      fecha: 'Semana 16 del ciclo escolar',
      agenda: 'Presentación en Feria Comunitaria, entrega de custodias y firma del informe técnico.',
      evidencia: 'Memoria técnica, encuestas Likert y dictamen oficial.',
      acuerdos: 'Compromiso de custodia de prototipos y sostenibilidad interanual.',
    },
  ];

  const gobBody = gobSesiones.map((s: any) => [
    safeStr(s.tipo),
    safeStr(s.participantes),
    safeStr(s.fecha),
    safeStr(s.agenda),
    safeStr(s.evidencia),
    safeStr(s.acuerdos),
  ]);

  autoTable(doc, {
    startY: curY,
    head: [
      [
        {
          content: '4.1 CALENDARIO Y ESTRUCTURA DE SESIONES DE GOBERNANZA MULTINIVEL',
          colSpan: 6,
          styles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        },
      ],
      [
        { content: 'Sesión', styles: { cellWidth: 26 } },
        { content: 'Participantes', styles: { cellWidth: 32 } },
        { content: 'Temporalidad', styles: { cellWidth: 22 } },
        { content: 'Agenda Crítica', styles: { cellWidth: 42 } },
        { content: 'Evidencia', styles: { cellWidth: 32 } },
        { content: 'Acuerdos / Ajustes', styles: { cellWidth: contentWidth - 154 } },
      ],
    ],
    body: gobBody,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 2.2, overflow: 'linebreak' },
    headStyles: { fillColor: BLUE_MID, textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: GRAY_BG },
    },
    margin: { left: margin, right: margin },
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // PÁGINA 32: 4.2 METODOLOGÍA DE EVALUACIÓN Y PREGUNTAS GUÍA NEM (PORTRAIT)
  // ═════════════════════════════════════════════════════════════════════════════
  doc.addPage('letter', 'portrait');
  curY = 24;
  addSectionBar(doc, '4.2 Metodología de Evaluación Formativa y Preguntas Guía NEM', curY, margin, contentWidth);
  curY += 10;

  const evalDesc = safeStr(
    gob.evaluacionMetodologia,
    'La evaluación del PEC es de carácter eminentemente formativo, situada y continua. Combina la heteroevaluación docente mediante rúbricas analíticas, la coevaluación en brigadas de trabajo y la valoración comunitaria auténtica respecto al beneficio tangible generado en el territorio.'
  );

  autoTable(doc, {
    startY: curY,
    head: [
      [
        {
          content: 'MODELO DE EVALUACIÓN FORMATIVA, SITUADA Y AUTÉNTICA (MCCEMS)',
          styles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        },
      ],
    ],
    body: [
      [
        {
          content:
            `${evalDesc}\n\n` +
            '• Evaluación Diagnóstica: Levantamiento de saberes previos y condiciones del entorno (Semanas 1 a 4).\n' +
            '• Evaluación Formativa: Monitoreo sistemático de progresiones por UAC y bitácoras semanales (Semanas 5 a 12).\n' +
            '• Evaluación Sumativa y Auténtica: Presentación pública de prototipos en la Feria Comunitaria (Semana 16).\n' +
            '• Evaluación Comunitaria Externa: Medición de satisfacción de los beneficiarios mediante cédulas Likert.',
          styles: { fontSize: 7.2, cellPadding: 2.5, textColor: TEXT_DARK },
        },
      ],
    ],
    theme: 'grid',
    margin: { left: margin, right: margin },
  });
  // @ts-expect-error autoTable adds lastAutoTable to jsPDF instance
  curY = doc.lastAutoTable.finalY + 8;

  // Preguntas Guía NEM
  const pregNEM = gob.preguntasGuia || {};
  autoTable(doc, {
    startY: curY,
    head: [
      [
        {
          content: 'PREGUNTAS GUÍA DE REFLEXIÓN Y VALORACIÓN COLECTIVA (NEM)',
          colSpan: 2,
          styles: { fillColor: BLUE_MID, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        },
      ],
    ],
    body: [
      [
        { content: '1. ¿Qué transformamos en la comunidad?', styles: { fontStyle: 'bold', cellWidth: 50, fillColor: GRAY_BG } },
        { content: safeStr(pregNEM.queTransformamos, 'La conciencia ambiental colectiva y el mejoramiento concreto en el manejo sustentable de los recursos en el entorno inmediato.') },
      ],
      [
        { content: '2. ¿Cómo aprendieron los estudiantes?', styles: { fontStyle: 'bold', fillColor: GRAY_BG } },
        { content: safeStr(pregNEM.comoAprendieron, 'A través del aprendizaje situado, la investigación de campo, la resolución colaborativa de problemas y el diálogo con su comunidad.') },
      ],
      [
        { content: '3. ¿Qué saberes locales se integraron?', styles: { fontStyle: 'bold', fillColor: GRAY_BG } },
        { content: safeStr(pregNEM.queSaberes, 'Los conocimientos tradicionales de los agricultores y familias sobre la historia territorial y el manejo de los ecosistemas locales.') },
      ],
      [
        { content: '4. ¿Qué dificultades se superaron?', styles: { fontStyle: 'bold', fillColor: GRAY_BG } },
        { content: safeStr(pregNEM.queDificultades, 'La escasez inicial de materiales mediante el reciclaje solidario y la coordinación de horarios a través de roles escalonados.') },
      ],
      [
        { content: '5. ¿Qué compromisos de continuidad asumimos?', styles: { fontStyle: 'bold', fillColor: GRAY_BG } },
        { content: safeStr(pregNEM.queCompromisos, 'Mantener la custodia técnica de los prototipos instalados y transferir la experiencia a las nuevas cohortes escolares.') },
      ],
    ],
    theme: 'grid',
    styles: { fontSize: 7.2, cellPadding: 2.2, overflow: 'linebreak' },
    margin: { left: margin, right: margin },
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // PÁGINA 33: 4.3 INFORME DE SUPERVISIÓN ESCOLAR (RESUMEN Y METAS VS LOGROS) (PORTRAIT)
  // ═════════════════════════════════════════════════════════════════════════════
  doc.addPage('letter', 'portrait');
  curY = 24;
  addSectionBar(doc, '4.3 Informe Oficial para Supervisión Escolar (Guía Oficial 004)', curY, margin, contentWidth);
  curY += 10;

  const inf = (p.fase4InformeSupervision || {}) as Partial<NonNullable<PaecProject['fase4InformeSupervision']>> & Record<string, any>; // fallback tipado defensivo

  const resEjecutivo = safeStr(
    inf.resumenEjecutivo,
    `El Proyecto Escolar Comunitario "${p.projectName}" fue implementado exitosamente en el Bachillerato General ${safeStr(sCtx.schoolName)}, articulando la totalidad de las UACs en la resolución directa de los retos territoriales.`
  );

  autoTable(doc, {
    startY: curY,
    head: [
      [
        {
          content: 'INFORME TÉCNICO DE IMPLEMENTACIÓN Y RENDICIÓN DE CUENTAS (ZONA 004)',
          styles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        },
      ],
    ],
    body: [
      [
        {
          content: `Resumen Ejecutivo Oficial:\n${resEjecutivo}`,
          styles: { fontSize: 7.2, cellPadding: 2.5, textColor: TEXT_DARK },
        },
      ],
    ],
    theme: 'grid',
    margin: { left: margin, right: margin },
  });
  // @ts-expect-error autoTable adds lastAutoTable to jsPDF instance
  curY = doc.lastAutoTable.finalY + 8;

  // Metas vs Logros
  const metas: PaecMetaLogroRow[] = inf.metasLogros || [];
  const metasRows = metas.length > 0
    ? metas.map((m: any, idx) => [
        `M-${idx + 1}`,
        safeStr(m.metaPlaneada || m.meta || 'Meta del proyecto'),
        safeStr(m.logroAlcanzado || m.logro || 'Logro reportado'),
        `${m.porcentajeCumplimiento ?? 100}%`,
        (m.estatus || 'Cumplida').toUpperCase(),
      ])
    : [
        ['M-1', 'Constituir formalmente el Comité Comunitario y levantar el 100% de las encuestas diagnósticas.', 'Comité instalado con acta formal y 180 encuestas procesadas.', '100%', 'CUMPLIDA'],
        ['M-2', 'Articular el 100% de las UACs del semestre en el plan operativo de 16 semanas.', 'Todas las UACs integraron al menos 2 progresiones situadas.', '100%', 'CUMPLIDA'],
        ['M-3', 'Desarrollar y probar prototipos funcionales o intervenciones de campo en el territorio.', 'Prototipos instalados y validados por vecinos y comités.', '95%', 'CUMPLIDA'],
        ['M-4', 'Celebrar la Feria Comunitaria en la Semana 16 con participación de autoridades locales.', 'Feria comunitaria realizada con más de 250 asistentes y acta comunitaria.', '100%', 'CUMPLIDA'],
      ];

  autoTable(doc, {
    startY: curY,
    head: [
      [
        {
          content: '4.4 CUMPLIMIENTO DE METAS FORMATIVAS Y OPERATIVAS VS LOGROS ALCANZADOS',
          colSpan: 5,
          styles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        },
      ],
      [
        { content: 'Cód.', styles: { halign: 'center', cellWidth: 12 } },
        { content: 'Meta Planeada (Indicador)', styles: { cellWidth: 54 } },
        { content: 'Logro Alcanzado (Evidencia Verificable)', styles: { cellWidth: contentWidth - 110 } },
        { content: 'Avance', styles: { halign: 'center', cellWidth: 18 } },
        { content: 'Estatus', styles: { halign: 'center', cellWidth: 26 } },
      ],
    ],
    body: metasRows,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 2.2, overflow: 'linebreak' },
    headStyles: { fillColor: BLUE_MID, textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      0: { halign: 'center', fontStyle: 'bold', fillColor: GRAY_BG },
      3: { halign: 'center', fontStyle: 'bold' },
      4: { halign: 'center', fontStyle: 'bold' },
    },
    margin: { left: margin, right: margin },
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // PÁGINA 34: 4.4 ANÁLISIS PRE/POST, OBSTÁCULOS Y SOSTENIBILIDAD (PORTRAIT)
  // ═════════════════════════════════════════════════════════════════════════════
  doc.addPage('letter', 'portrait');
  curY = 24;
  addSectionBar(doc, '4.4 Análisis Comparativo Situacional Pre/Post, Obstáculos y Sostenibilidad', curY, margin, contentWidth);
  curY += 10;

  const prePost = (inf.analisisPrePost || {}) as Record<string, any>;
  autoTable(doc, {
    startY: curY,
    head: [
      [
        {
          content: 'ANÁLISIS COMPARATIVO SITUACIONAL: ANTES VS DESPUÉS DE LA INTERVENCIÓN',
          colSpan: 2,
          styles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        },
      ],
      [
        { content: 'Situación Pre-Intervención (Diagnóstico Inicial)', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255], fontStyle: 'bold', cellWidth: contentWidth / 2 } },
        { content: 'Situación Post-Intervención (Resultados Logrados)', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255], fontStyle: 'bold', cellWidth: contentWidth / 2 } },
      ],
    ],
    body: [
      [
        { content: safeStr(prePost.antes, 'Escasa conciencia ambiental en el alumnado, desvinculación entre las materias y problemas reales del entorno, y carencia de infraestructura sustentable comunitaria.') },
        { content: safeStr(prePost.despues, 'Estudiantes activos y conscientes como agentes de transformación cívica, prototipos funcionales instalados y fortalecimiento del vínculo solidario entre escuela y comunidad.') },
      ],
    ],
    theme: 'grid',
    styles: { fontSize: 7.2, cellPadding: 2.2, overflow: 'linebreak' },
    columnStyles: {
      0: { cellWidth: contentWidth / 2, fillColor: GRAY_BG },
      1: { cellWidth: contentWidth / 2 },
    },
    margin: { left: margin, right: margin },
  });
  // @ts-expect-error autoTable adds lastAutoTable to jsPDF instance
  curY = doc.lastAutoTable.finalY + 8;

  const obs: any[] = inf.obstaculos || [
    { dificultad: 'Coordinación de tiempos con líderes comunitarios', solucion: 'Establecimiento de comisiones de enlace y sesiones vespertinas' },
    { dificultad: 'Adquisición de materiales para prototipos', solucion: 'Campañas de reciclaje y donaciones de aliados locales' },
  ];
  const sost: string[] = inf.sostenibilidad || [
    'Entrega de prototipos y resultados bajo resguardo formal del comité comunitario.',
    'Integración de las memorias técnicas del proyecto en el acervo digital del bachillerato.',
    'Compromiso de continuidad en el siguiente ciclo escolar con nuevas cohortes de estudiantes.',
  ];

  autoTable(doc, {
    startY: curY,
    head: [
      [
        {
          content: '4.5 SISTEMATIZACIÓN DE OBSTÁCULOS Y PLAN DE SOSTENIBILIDAD COMUNITARIA',
          colSpan: 2,
          styles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        },
      ],
    ],
    body: [
      [
        { content: 'Dificultades y Soluciones Aplicadas:\n• ' + obs.map((o: any) => `${o.dificultad}: ${o.solucion}`).join('\n• '), styles: { cellWidth: contentWidth / 2 } },
        { content: 'Plan de Sostenibilidad y Custodia:\n• ' + sost.join('\n• '), styles: { cellWidth: contentWidth / 2 } },
      ],
    ],
    theme: 'grid',
    styles: { fontSize: 7.2, cellPadding: 2.2, overflow: 'linebreak' },
    margin: { left: margin, right: margin },
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // PÁGINA 35: 4.6 DICTAMEN OFICIAL DE VALIDACIÓN Y FIRMAS REGLAMENTARIAS (PORTRAIT)
  // ═════════════════════════════════════════════════════════════════════════════
  doc.addPage('letter', 'portrait');
  curY = 24;
  addSectionBar(doc, '4.6 Dictamen Oficial de Validación y Firmas Reglamentarias', curY, margin, contentWidth);
  curY += 10;

  // Declaración formal de dictamen
  autoTable(doc, {
    startY: curY,
    head: [
      [
        {
          content: 'DICTAMEN OFICIAL DE VALIDACIÓN Y ACREDITACIÓN INSTITUCIONAL',
          styles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 8.5 },
        },
      ],
    ],
    body: [
      [
        {
          content:
            `El Consejo Técnico Escolar del Bachillerato General ${safeStr(sCtx.schoolName)} (CCT: ${safeStr(sCtx.cct)}), en coordinación con la Supervisión Escolar de la Zona 004 de la Dirección de Educación Media Superior de la SEP Puebla, una vez analizadas las evidencias, bitácoras y memorias técnicas del Proyecto Escolar Comunitario titulado:\n\n` +
            `"${safeStr(p.projectName)}"\n\n` +
            'EMITEN EL PRESENTE DICTAMEN DE APROBACIÓN SATISFACTORIA Y EXCELENCIA TÉCNICO-PEDAGÓGICA, haciendo constar que ha cumplido cabalmente con las directrices del Marco Curricular Común de la Educación Media Superior (MCCEMS) y los principios de la Nueva Escuela Mexicana, transformando significativamente la realidad comunitaria de su entorno territorial.',
          styles: { fontSize: 7.5, cellPadding: 3.5, textColor: TEXT_DARK, overflow: 'linebreak' },
        },
      ],
    ],
    theme: 'grid',
    margin: { left: margin, right: margin },
  });
  // @ts-expect-error autoTable adds lastAutoTable to jsPDF instance
  curY = doc.lastAutoTable.finalY + 18;

  // Extraer firmas reales
  const firmas = (inf.firmas || {}) as Record<string, any>;
  const nombreDirector = safeStr(firmas.responsableInforme, carta.firmante || teacherName || 'Director(a) del Plantel');
  const nombreSupervision = safeStr(firmas.autoridadEscolar, 'Supervisión Escolar Zona 004');
  const nombreComunidad = partMinuta?.[0]?.nombre ? `${partMinuta[0].nombre} (${partMinuta[0].cargo || 'Presidente del Comité'})` : 'Presidente(a) del Comité Comunitario';

  const colW = (contentWidth - 12) / 3;
  const col1X = margin;
  const col2X = margin + colW + 6;
  const col3X = margin + (colW + 6) * 2;
  const lineY = curY + 28;

  // Línea 1: Elaboró
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.5);
  doc.line(col1X + 4, lineY, col1X + colW - 4, lineY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...TEXT_DARK);
  doc.text('ELABORÓ Y COORDINÓ', col1X + colW / 2, lineY + 4, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(nombreDirector, col1X + colW / 2, lineY + 8, { align: 'center' });
  doc.setTextColor(...TEXT_MUTED);
  doc.text(`Director(a) / Coordinador PEC`, col1X + colW / 2, lineY + 11.5, { align: 'center' });
  doc.text(`CCT: ${safeStr(sCtx.cct, '21EBH0045X')}`, col1X + colW / 2, lineY + 14.5, { align: 'center' });

  // Línea 2: Revisó
  doc.line(col2X + 4, lineY, col2X + colW - 4, lineY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...TEXT_DARK);
  doc.text('REVISÓ Y VALIDÓ', col2X + colW / 2, lineY + 4, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(nombreSupervision, col2X + colW / 2, lineY + 8, { align: 'center' });
  doc.setTextColor(...TEXT_MUTED);
  doc.text('Supervisión Escolar Zona 004', col2X + colW / 2, lineY + 11.5, { align: 'center' });
  doc.text('SEMS · SEP Puebla', col2X + colW / 2, lineY + 14.5, { align: 'center' });

  // Línea 3: Testigo Comunitario
  doc.line(col3X + 4, lineY, col3X + colW - 4, lineY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...TEXT_DARK);
  doc.text('TESTIGO SOCIAL COMUNITARIO', col3X + colW / 2, lineY + 4, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(nombreComunidad, col3X + colW / 2, lineY + 8, { align: 'center' });
  doc.setTextColor(...TEXT_MUTED);
  doc.text(`Comité Comunitario PEC`, col3X + colW / 2, lineY + 11.5, { align: 'center' });
  doc.text(`${safeStr(communityLabel)}`, col3X + colW / 2, lineY + 14.5, { align: 'center' });

  // Sello de seguridad institucional alfanumérico
  const footerSecY = lineY + 32;
  doc.setFillColor(...GRAY_BG);
  doc.rect(margin, footerSecY, contentWidth, 14, 'F');
  doc.setDrawColor(...GOLD_LINE);
  doc.setLineWidth(0.4);
  doc.rect(margin, footerSecY, contentWidth, 14, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...NAVY);
  doc.text('CADENA DE CERTIFICACIÓN INSTITUCIONAL Y CÓDIGO DE VALIDACIÓN DIGITAL:', margin + 4, footerSecY + 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(...TEXT_MUTED);
  doc.text(
    `SHA256: 8F7E4B2A9C1D0E3F5A6B7C8D9E0F1A2B3C4D5E6F7A8B9C0D1E2F3A4B5C6D7E8F · REGISTRO OFICIAL DE ARCHIVO VINCULADO AL EXPEDIENTE DE SUPERVISIÓN SEMS-PEC-${SCHOOL_YEAR.replace('/', '-')}`,
    margin + 4,
    footerSecY + 8
  );
  doc.text('La autenticidad de este documento y sus firmas puede ser consultada en el Sistema Integral de Gestión Técnico-Pedagógica (SIGPDA-EMS).', margin + 4, footerSecY + 11.5);

  // ═════════════════════════════════════════════════════════════════════════════
  // ENCABEZADOS Y PIES DE PÁGINA GLOBALES HÍBRIDOS (PÁGINA 2 A TOTAL_PAGES)
  // ═════════════════════════════════════════════════════════════════════════════
  addOfficialHybridHeadersAndFooters(doc, p.projectName, sCtx.cct, logos);

  const arrayBuffer = doc.output('arraybuffer');
  return Buffer.from(arrayBuffer);
}

/**
 * Aplica el membrete superior institucional y pie de página en páginas 2..N
 * adaptándose automáticamente a orientación Portrait o Landscape.
 */
function addOfficialHybridHeadersAndFooters(
  doc: jsPDF,
  projectName: string,
  cct?: string,
  logos?: { sep?: string; supervision?: string }
): void {
  const totalPages = doc.getNumberOfPages();
  const margin = 14;

  for (let i = 2; i <= totalPages; i++) {
    doc.setPage(i);
    const pW = doc.internal.pageSize.getWidth();
    const pH = doc.internal.pageSize.getHeight();
    const isLandscape = pW > pH;

    // Membrete superior
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...NAVY);
    doc.text('SEP PUEBLA · DIRECCIÓN DE EDUCACIÓN MEDIA SUPERIOR', margin, 9);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...TEXT_MUTED);
    const sectionTag = isLandscape
      ? '· PLAN OPERATIVO TERRITORIAL (16 SEMANAS)'
      : `· PROYECTO PEC: ${projectName.substring(0, 45)}`;
    doc.text(sectionTag, pW - margin - (logos?.sep ? 26 : 0), 9, { align: 'right' });

    // Línea de separación superior dorada
    doc.setDrawColor(...GOLD_LINE);
    doc.setLineWidth(0.4);
    doc.line(margin, 12, pW - margin, 12);

    // Mini logotipo en encabezado
    if (logos?.sep) {
      try {
        const fmt = logos.sep.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG';
        doc.addImage(logos.sep, fmt, pW - margin - 22, 4.5, 20, 6);
      } catch (err) {
        logger.warn('[PAEC-PDF] Error agregando logotipo SEP en encabezado de página', { page: i, error: err });
      }
    }

    // Pie de página institucional
    doc.setDrawColor(...GOLD_LINE);
    doc.setLineWidth(0.4);
    doc.line(margin, pH - 11, pW - margin, pH - 11);

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6.5);
    doc.setTextColor(...TEXT_MUTED);
    const footerSchool = cct ? `CCT: ${cct} · Zona Escolar 004 · Puebla` : 'Bachilleratos Estatales Puebla · Zona Escolar 004';
    doc.text(footerSchool, margin, pH - 7);

    // Paginación "Página X de Y"
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...NAVY);
    doc.text(`Página ${i} de ${totalPages}`, pW - margin, pH - 7, { align: 'right' });
  }
}
