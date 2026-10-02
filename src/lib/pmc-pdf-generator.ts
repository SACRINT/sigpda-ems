/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * pmc-pdf-generator.ts — Generador PDF Oficial del Plan de Mejora Continua (PMC)
 * SIGPDA-EMS · Estándar Oficial SEP Puebla (SEMS / MCCEMS)
 * Formato Carta (215.9mm x 279.4mm) con membrete oficial, sellos, FODA, metas y firmas.
 */

import jsPDF from 'jspdf';
import autoTable, { type RowInput } from 'jspdf-autotable';
import { loadAllLogos } from './pdf-logos';
import { SCHOOL_YEAR } from '@/lib/config';
import { logger } from './logger';
import { calculatePmcIndicatorRows } from './pmc-indicator-calculator';
import { AREAS_OBLIGATORIAS_51, resolveAreaObligatoria51, PENDIENTE_DEFINICION_51 } from './pmc-docx-generator';
import type { PmcProject, PmcStatisticalContext, PmcStaffMember, PmcMetaInstitucional } from '@/types/pmc';
import {
  PMC_TITULOS_SECCIONES,
  PMC_SUBSECCIONES_DIAGNOSTICO,
  PMC_SECCIONES_CANONICAS,
  PMC_FICHAS_TECNICAS_HEADING,
  PMC_FICHAS_TECNICAS_PAGE_BREAK_BEFORE,
  shouldSectionPageBreak,
  clasificarNormativaJerarquica,
  getObjetivoPmcText,
  getTextoInfraestructura,
  getTextoBeneficiosComunitarios,
  normalizePmcPeriodo,
} from './pmc-document-structure';
import { cleanPmcPlaceholders } from './pmc/plan-element-normalizer';
import { isValidStaffName, isCollectiveOrNonHumanEntity } from './pmc/staff-reconciler';
import { enrichMetaWithCatalogBase } from '@/lib/constants/pmc-catalogo-criterios';

const NAVY: [number, number, number] = [31, 56, 100];       // #1F3864 - Azul Institucional MCCEMS
const BLUE_MID: [number, number, number] = [46, 116, 181];   // #2E74B5 - Azul Secundario
const BLUE_LIGHT: [number, number, number] = [220, 228, 245]; // #DCE4F5 - Fondo Encabezados Suaves
const GOLD_LINE: [number, number, number] = [232, 160, 32];  // #E8A020 - Dorado Oficial SEP
const GRAY_BG: [number, number, number] = [242, 244, 248];   // #F2F4F8 - Fondo Alternado
const TEXT_DARK: [number, number, number] = [30, 41, 59];    // #1E293B - Texto Primario
const TEXT_MUTED: [number, number, number] = [100, 116, 139]; // #64748B - Texto Secundario

function safeStr(val: unknown, fallback = 'N/D'): string {
  if (val === null || val === undefined) return fallback;
  const str = String(val).trim();
  return str.length > 0 ? str : fallback;
}

function parseJson<T = any>(val: unknown): T {
  if (!val) return {} as T;
  if (typeof val === 'object') return val as T;
  try {
    return JSON.parse(String(val)) as T;
  } catch {
    return {} as T;
  }
}

function drawJustifiedParagraph(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  gapAfter = 0
): number {
  const clean = String(text ?? '').trim();
  if (!clean) return y;
  const lines = doc.splitTextToSize(clean, maxWidth);
  doc.text(lines, x, y, { align: 'justify', maxWidth });
  return y + lines.length * lineHeight + gapAfter;
}

export async function generatePmcPDF(
  project: PmcProject,
  providedLogos?: { gobierno?: string; sep?: string; supervision?: string }
): Promise<Buffer> {
  const logos = providedLogos || (await loadAllLogos());

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter',
  });

  const pageWidth = doc.internal.pageSize.getWidth();   // 215.9 mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 279.4 mm
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  // ═════════════════════════════════════════════════════════════════════════════
  // PÁGINA 1: PORTADA OFICIAL INSTITUCIONAL
  // ═════════════════════════════════════════════════════════════════════════════

  let curY = 12;

  // Logotipos oficiales en fila superior
  if (logos.gobierno) {
    try {
      const fmt = logos.gobierno.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG';
      doc.addImage(logos.gobierno, fmt, margin, curY, 36, 15);
    } catch (err) {
      logger.warn('[PMC-PDF] Error agregando logotipo de gobierno en portada', { error: err });
    }
  }
  if (logos.sep) {
    try {
      const fmt = logos.sep.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG';
      doc.addImage(logos.sep, fmt, (pageWidth - 32) / 2, curY, 32, 9);
    } catch (err) {
      logger.warn('[PMC-PDF] Error agregando logotipo SEP en portada', { error: err });
    }
  }
  if (logos.supervision) {
    try {
      const fmt = logos.supervision.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG';
      doc.addImage(logos.supervision, fmt, pageWidth - margin - 32, curY, 32, 12);
    } catch (err) {
      logger.warn('[PMC-PDF] Error agregando logotipo de supervisión en portada', { error: err });
    }
  }

  curY += 22;

  // Franja dorada de acento
  doc.setDrawColor(...GOLD_LINE);
  doc.setLineWidth(1.2);
  doc.line(margin, curY, pageWidth - margin, curY);

  curY += 10;

  // Encabezados jerárquicos oficiales
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...NAVY);
  doc.text('GOBIERNO DEL ESTADO DE PUEBLA', pageWidth / 2, curY, { align: 'center' });

  curY += 5;
  doc.setFontSize(9);
  doc.text('SECRETARÍA DE EDUCACIÓN PÚBLICA DEL ESTADO', pageWidth / 2, curY, { align: 'center' });

  curY += 5;
  doc.setFontSize(8.5);
  doc.setTextColor(...BLUE_MID);
  doc.text('SUBSECRETARÍA DE EDUCACIÓN OBLIGATORIA', pageWidth / 2, curY, { align: 'center' });

  curY += 4.5;
  doc.text('DIRECCIÓN DE EDUCACIÓN MEDIA SUPERIOR', pageWidth / 2, curY, { align: 'center' });

  curY += 14;

  // Título Monumental Enmarcado
  doc.setFillColor(...NAVY);
  doc.roundedRect(margin + 10, curY, contentWidth - 20, 22, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.text('PLAN DE MEJORA CONTINUA (PMC)', pageWidth / 2, curY + 9, { align: 'center' });

  doc.setFontSize(10);
  doc.setTextColor(...GOLD_LINE);
  const cicloTexto = safeStr(project.ciclo_escolar, SCHOOL_YEAR);
  doc.text(`CICLO ESCOLAR ${cicloTexto.toUpperCase()}`, pageWidth / 2, curY + 16, { align: 'center' });

  curY += 32;

  // Tabla Ficha Técnica de la Escuela (Portada)
  const todayStr = new Date().toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  autoTable(doc, {
    startY: curY,
    head: [
      [
        {
          content: 'CÉDULA INSTITUCIONAL DE IDENTIFICACIÓN DEL PLANTEL',
          colSpan: 2,
          styles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 9 },
        },
      ],
    ],
    body: [
      [{ content: 'Nombre de la Escuela:', styles: { fontStyle: 'bold', cellWidth: 50, fillColor: GRAY_BG } }, safeStr(project.school_name)],
      [{ content: 'Clave de Centro de Trabajo (CCT):', styles: { fontStyle: 'bold', fillColor: GRAY_BG } }, safeStr(project.school_cct)],
      [{ content: 'Zona Escolar:', styles: { fontStyle: 'bold', fillColor: GRAY_BG } }, safeStr(project.school_zone)],
      [{ content: 'Subsistema y Modalidad:', styles: { fontStyle: 'bold', fillColor: GRAY_BG } }, `${safeStr(project.subsystem, 'BGE')} — Escolarizada`],
      [{ content: 'Municipio / Localidad:', styles: { fontStyle: 'bold', fillColor: GRAY_BG } }, `${safeStr(project.municipality)} / ${safeStr(project.locality)}`],
      [{ content: 'Director(a) del Plantel:', styles: { fontStyle: 'bold', fillColor: GRAY_BG } }, safeStr(project.director_name)],
      [{ content: 'Supervisor(a) Escolar:', styles: { fontStyle: 'bold', fillColor: GRAY_BG } }, safeStr(project.supervisor_name)],
      [{ content: 'Plantilla de Personal:', styles: { fontStyle: 'bold', fillColor: GRAY_BG } }, `${Number(project.total_staff) || 0} integrantes registrados`],
      [{ content: 'Fecha de Publicación:', styles: { fontStyle: 'bold', fillColor: GRAY_BG } }, `Puebla, Pue., a ${todayStr}`],
    ],
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2.5, textColor: TEXT_DARK, lineColor: [200, 210, 225] },
    margin: { left: margin + 5, right: margin + 5 },
  });

  // Lema institucional inferior
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(...TEXT_MUTED);
  doc.text(
    'Documento oficial rector de planeación institucional y gestión participativa para la transformación educativa.',
    pageWidth / 2,
    pageHeight - 14,
    { align: 'center' }
  );

  // ═════════════════════════════════════════════════════════════════════════════
  // PÁGINA 2 EN ADELANTE: CUERPO Y CONTENIDO TÉCNICO
  // ═════════════════════════════════════════════════════════════════════════════
  doc.addPage();
  curY = 18;

  const drawHeaderOnNewPage = () => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...NAVY);
    doc.text(`SECRETARÍA DE EDUCACIÓN PÚBLICA DE PUEBLA · DIRECCIÓN DE EDUCACIÓN MEDIA SUPERIOR`, margin, 10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...TEXT_MUTED);
    doc.text(`PMC ${cicloTexto} · ${safeStr(project.school_name)} (CCT: ${safeStr(project.school_cct)})`, pageWidth - margin, 10, { align: 'right' });

    doc.setDrawColor(...GOLD_LINE);
    doc.setLineWidth(0.5);
    doc.line(margin, 12, pageWidth - margin, 12);
  };

  const sectionPageMap = new Map<string, number>();
  const tocEntries: Array<{ key: string; isSection: boolean }> = [];
  const pageCellCoords: Array<{ x: number; y: number; width: number; height: number; key: string; isSection: boolean }> = [];

  const addSectionHeader = (titulo: string) => {
    const shouldBreak = shouldSectionPageBreak(titulo) || (curY > pageHeight - 35);
    if (shouldBreak && curY > 20) {
      doc.addPage();
      curY = 18;
    }
    drawHeaderOnNewPage();

    sectionPageMap.set(titulo, doc.getNumberOfPages());

    doc.setFillColor(...NAVY);
    doc.rect(margin, curY, contentWidth, 6.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text(titulo, margin + 4, curY + 4.5);

    curY += 9;
  };

  // ── ÍNDICE GENERAL ──────────────────────────────────────────────────────────
  addSectionHeader('ÍNDICE GENERAL');

  const tocRows: Array<Array<{ content: string; styles?: Record<string, unknown> }>> = [];
  for (const sec of PMC_SECCIONES_CANONICAS) {
    tocEntries.push({ key: sec.titulo, isSection: true });
    tocRows.push([
      { content: String(sec.numero), styles: { fontStyle: 'bold' as const, halign: 'center' as const, fillColor: GRAY_BG } },
      { content: sec.titulo, styles: { fontStyle: 'bold' as const, fillColor: GRAY_BG } },
      { content: '', styles: { fontStyle: 'bold' as const, halign: 'center' as const, fillColor: GRAY_BG } },
    ]);
    if (sec.subsecciones) {
      for (const sub of sec.subsecciones) {
        const subRotulo = `${sub.numero} ${sub.titulo}`;
        tocEntries.push({ key: subRotulo, isSection: false });
        tocRows.push([
          { content: sub.numero, styles: { halign: 'center' as const, textColor: TEXT_MUTED } },
          { content: `   ${sub.titulo}`, styles: { fontStyle: 'italic' as const, textColor: TEXT_MUTED } },
          { content: '', styles: { halign: 'center' as const, textColor: TEXT_MUTED } },
        ]);
      }
    }
  }

  autoTable(doc, {
    startY: curY,
    head: [[
      { content: 'N°', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255], halign: 'center', cellWidth: 12 } },
      { content: 'Contenido Temático / Capítulo Oficial', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
      { content: 'Pág.', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255], halign: 'center', cellWidth: 14 } },
    ]],
    body: tocRows as unknown as RowInput[],
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 2, textColor: TEXT_DARK, lineColor: [210, 220, 235] },
    margin: { left: margin, right: margin },
    didDrawCell: (data) => {
      if (data.section === 'body' && data.column.index === 2 && data.row.index < tocEntries.length) {
        const entry = tocEntries[data.row.index];
        pageCellCoords.push({
          x: data.cell.x,
          y: data.cell.y,
          width: data.cell.width,
          height: data.cell.height,
          key: entry.key,
          isSection: entry.isSection,
        });
      }
    },
  });
  curY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 8 : curY + 40;

  // ── SECCIÓN 1: PRESENTACIÓN ─────────────────────────────────────────────────
  doc.addPage();
  curY = 18;
  drawHeaderOnNewPage();
  addSectionHeader(PMC_TITULOS_SECCIONES.PRESENTACION);

  const diag = parseJson(project.diagnostico_generado);
  const indAcad = parseJson(project.indicadores_academicos);

  const textoPresentacion = safeStr(diag.presentacion) ||
    `El ${safeStr(project.school_name, 'plantel escolar')}, con CCT ${safeStr(project.school_cct, 'N/D')} y ubicado en la localidad de ${safeStr(project.locality, 'N/D')}, municipio de ${safeStr(project.municipality, 'N/D')}, Puebla, presenta su Programa de Mejora Continua (PMC) para el ciclo escolar ${safeStr(project.ciclo_escolar, SCHOOL_YEAR)}. Este instrumento de planeación directiva se fundamenta en el artículo 3° de la Constitución Política de los Estados Unidos Mexicanos, garantizando el derecho humano a la educación con un enfoque de equidad, excelencia y mejora continua, alineado con el Modelo Educativo de la Nueva Escuela Mexicana (NEM), el Marco Curricular Común de la Educación Media Superior (MCCEMS) y los ejes rectores de la política educativa estatal CREAA.`;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_DARK);
  curY = drawJustifiedParagraph(doc, textoPresentacion, margin, curY, contentWidth, 4, 8);

  // ── SECCIÓN 2: OBJETIVO DEL PMC ─────────────────────────────────────────────
  addSectionHeader(PMC_TITULOS_SECCIONES.OBJETIVO);

  const textoObjGeneral = getObjetivoPmcText(project.school_name, project.ciclo_escolar);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...BLUE_MID);
  doc.text('Objetivo General:', margin, curY);
  curY += 4.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...TEXT_DARK);
  curY = drawJustifiedParagraph(doc, textoObjGeneral, margin, curY, contentWidth, 3.8, 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...BLUE_MID);
  doc.text('Objetivos Específicos y Metas Estratégicas:', margin, curY);
  curY += 4.5;

  const objEspecificos = [
    '• Consolidar los aprendizajes fundamentales en Recursos Sociocognitivos (Pensamiento Matemático, Lengua y Comunicación, Conciencia Histórica y Cultura Digital).',
    '• Mitigar el abandono y reprobación escolar implementando sistemas de alerta temprana y acompañamiento tutorial permanente.',
    '• Fortalecer la gobernanza escolar mediante la vinculación efectiva con la comunidad mediante el Proyecto Escolar Comunitario (PAEC-PEC).',
  ];
  for (const oe of objEspecificos) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...TEXT_DARK);
    curY = drawJustifiedParagraph(doc, oe, margin, curY, contentWidth, 3.6, 2);
  }
  curY += 6;

  // ── SECCIÓN 3: NORMATIVIDAD APLICABLE ───────────────────────────────────────
  addSectionHeader(PMC_TITULOS_SECCIONES.NORMATIVIDAD);

  const normativa = parseJson(project.normativa);
  const normDocs: Array<{ orden?: number; titulo?: string; articulos?: string[] }> = (Array.isArray(normativa.documentos) && normativa.documentos.length > 0)
    ? normativa.documentos
    : [
        {
          orden: 1,
          titulo: 'Constitución Política de los Estados Unidos Mexicanos (Art. 3°)',
          articulos: ['Garantiza el derecho a la educación integral, inclusiva, universal, pública, gratuita, laica y de excelencia orientada al desarrollo humano.'],
        },
        {
          orden: 2,
          titulo: 'Ley General de Educación (Arts. 107, 108 y 109)',
          articulos: ['Establece la obligatoriedad del Programa de Mejora Continua en Educación Media Superior como instrumento estructurado de planeación participativa.'],
        },
        {
          orden: 3,
          titulo: 'Ley de Educación del Estado de Puebla (Arts. 80, 81 y 83)',
          articulos: ['Dispone la conformación participativa del PMC en los Consejos Técnicos Escolares y la vinculación corresponsable con la comunidad.'],
        },
        {
          orden: 4,
          titulo: 'Marco Curricular Común de la Educación Media Superior (MCCEMS - Acuerdo 09/08/23)',
          articulos: ['Fundamenta la formación socioemocional, recursos sociocognitivos, áreas del conocimiento y el vínculo pedagógico aula-escuela-comunidad.'],
        },
        {
          orden: 5,
          titulo: 'Lineamientos Oficiales del PMC para Educación Media Superior (SEMS / SEP Puebla)',
          articulos: ['Norma la priorización de categorías, diagnóstico escolar, formulación de metas CREAA y corresponsabilidad del colectivo docente.'],
        },
      ];

  const gruposNorm = clasificarNormativaJerarquica(normDocs);

  for (const grp of gruposNorm) {
    if (curY > pageHeight - 40) {
      doc.addPage();
      curY = 18;
      drawHeaderOnNewPage();
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...BLUE_MID);
    doc.text(grp.categoria, margin, curY);
    curY += 4;

    const normRows = grp.documentos.map((nd, i) => [
      { content: `${nd.orden ?? i + 1}` },
      { content: safeStr(nd.titulo) },
      { content: Array.isArray(nd.articulos) && nd.articulos.length > 0 ? nd.articulos.join('\n• ') : 'Disposición general' },
      { content: safeStr(nd.justificacion, 'Sustenta la planeación estratégica y metas formativas del plantel.') },
    ]);

    autoTable(doc, {
      startY: curY,
      head: [[
        { content: '#', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255], halign: 'center' } },
        { content: 'Disposición Legal / Normativa', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
        { content: 'Artículos Aplicables', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
        { content: 'Justificación de Inclusión en el PMC', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
      ]],
      body: normRows,
      theme: 'grid',
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' as const, fontStyle: 'bold' as const, fillColor: GRAY_BG },
        1: { cellWidth: 52, fontStyle: 'bold' as const },
        2: { cellWidth: 42 },
        3: { cellWidth: 84 },
      },
      styles: { fontSize: 6.8, cellPadding: 2, textColor: TEXT_DARK, lineColor: [210, 220, 235] },
      margin: { left: margin, right: margin },
    });

    curY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 6 : curY + 30;
  }

  // ── SECCIÓN 4: DIAGNÓSTICO ───────────────────────────────────────────────────
  addSectionHeader(PMC_TITULOS_SECCIONES.DIAGNOSTICO);

  // 4.1 Texto de Contexto Socioeducativo y Territorial
  const diagTexto = safeStr(diag.contexto || project.diagnostico_comunidad, 'El plantel se sitúa en un entorno con retos situados específicos de movilidad, acceso y desarrollo social, requiriendo un acompañamiento pedagógico permanente.');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...BLUE_MID);
  sectionPageMap.set(PMC_SUBSECCIONES_DIAGNOSTICO.CONTEXTO, doc.getNumberOfPages());
  doc.text(PMC_SUBSECCIONES_DIAGNOSTICO.CONTEXTO, margin, curY);
  curY += 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...TEXT_DARK);
  curY = drawJustifiedParagraph(doc, diagTexto, margin, curY, contentWidth, 3.5, 6);

  // 4.2 Tabla de Indicadores Académicos (Línea Base vs Metas)
  if (curY > pageHeight - 45) {
    doc.addPage();
    curY = 18;
    drawHeaderOnNewPage();
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...BLUE_MID);
  sectionPageMap.set(PMC_SUBSECCIONES_DIAGNOSTICO.INDICADORES, doc.getNumberOfPages());
  doc.text(PMC_SUBSECCIONES_DIAGNOSTICO.INDICADORES, margin, curY);
  curY += 4;

  const statsCtx: PmcStatisticalContext | undefined = project.statistical_context || (indAcad as { statistical_context?: PmcStatisticalContext })?.statistical_context;
  const indicRows = calculatePmcIndicatorRows(indAcad, statsCtx, cicloTexto);

  autoTable(doc, {
    startY: curY,
    head: [[
      { content: 'Indicador Oficial (Fuente: 911 / F11)', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
      { content: 'Ciclo Anterior (Línea Base)', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255], halign: 'center' } },
      { content: `Meta Proyectada (${cicloTexto})`, styles: { fillColor: BLUE_MID, textColor: [255, 255, 255], halign: 'center' } },
      { content: 'Variación Esperada', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255], halign: 'center' } },
    ]],
    body: indicRows as unknown as RowInput[],
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 2, textColor: TEXT_DARK, lineColor: [210, 220, 235] },
    margin: { left: margin, right: margin },
  });

  curY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 6 : curY + 40;

  if (diag.analisis_indicadores) {
    if (curY > pageHeight - 35) {
      doc.addPage();
      curY = 18;
      drawHeaderOnNewPage();
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...BLUE_MID);
    doc.text('Análisis e Interpretación de Indicadores Educativos:', margin, curY);
    curY += 4;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...TEXT_DARK);
    curY = drawJustifiedParagraph(doc, String(diag.analisis_indicadores), margin, curY, contentWidth, 3.5, 6);
  }

  // 4.3 Infraestructura y Equipamiento Escolar
  if (curY > pageHeight - 35) {
    doc.addPage();
    curY = 18;
    drawHeaderOnNewPage();
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...BLUE_MID);
  sectionPageMap.set(PMC_SUBSECCIONES_DIAGNOSTICO.INFRAESTRUCTURA, doc.getNumberOfPages());
  doc.text(PMC_SUBSECCIONES_DIAGNOSTICO.INFRAESTRUCTURA, margin, curY);
  curY += 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...TEXT_DARK);
  const infraText = getTextoInfraestructura(project);
  curY = drawJustifiedParagraph(doc, infraText, margin, curY, contentWidth, 3.5, 6);

  // 4.4 Beneficios y Vinculación Comunitaria
  if (curY > pageHeight - 35) {
    doc.addPage();
    curY = 18;
    drawHeaderOnNewPage();
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...BLUE_MID);
  sectionPageMap.set(PMC_SUBSECCIONES_DIAGNOSTICO.BENEFICIOS, doc.getNumberOfPages());
  doc.text(PMC_SUBSECCIONES_DIAGNOSTICO.BENEFICIOS, margin, curY);
  curY += 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...TEXT_DARK);
  const benefText = getTextoBeneficiosComunitarios(project);
  curY = drawJustifiedParagraph(doc, benefText, margin, curY, contentWidth, 3.5, 6);

  // 4.5 Matriz FODA Cuadrante Oficial
  if (curY > pageHeight - 50) {
    doc.addPage();
    curY = 18;
    drawHeaderOnNewPage();
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...BLUE_MID);
  sectionPageMap.set(PMC_SUBSECCIONES_DIAGNOSTICO.FODA, doc.getNumberOfPages());
  doc.text(PMC_SUBSECCIONES_DIAGNOSTICO.FODA, margin, curY);
  curY += 4;

  const foda = parseJson(project.foda);

  autoTable(doc, {
    startY: curY,
    head: [[
      { content: 'FACTORES INTERNOS Y EXTERNOS', colSpan: 2, styles: { fillColor: NAVY, textColor: [255, 255, 255], halign: 'center', fontStyle: 'bold' } },
    ]],
    body: [
      [
        { content: 'FORTALEZAS (F):', styles: { fontStyle: 'bold', fillColor: BLUE_LIGHT, cellWidth: 32 } },
        safeStr(foda.fortalezas, 'Compromiso docente, trabajo colegiado y procesos estandarizados.'),
      ],
      [
        { content: 'DEBILIDADES (D):', styles: { fontStyle: 'bold', fillColor: [254, 226, 226], cellWidth: 32 } },
        safeStr(foda.debilidades, 'Rezago académico de ingreso y recursos tecnológicos limitados.'),
      ],
      [
        { content: 'OPORTUNIDADES (O):', styles: { fontStyle: 'bold', fillColor: [220, 252, 231], cellWidth: 32 } },
        safeStr(foda.oportunidades, 'Vinculación con Telesecundarias y proyectos comunitarios PAEC.'),
      ],
      [
        { content: 'AMENAZAS (A):', styles: { fontStyle: 'bold', fillColor: [254, 243, 199], cellWidth: 32 } },
        safeStr(foda.amenazas, 'Condiciones geográficas complejas y limitaciones de transporte público.'),
      ],
    ],
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 2.2, textColor: TEXT_DARK, lineColor: [200, 210, 225] },
    margin: { left: margin, right: margin },
  });

  curY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 6 : curY + 40;

  if (diag.sintesis_foda) {
    if (curY > pageHeight - 35) {
      doc.addPage();
      curY = 18;
      drawHeaderOnNewPage();
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...BLUE_MID);
    doc.text('Síntesis y Conclusiones del Diagnóstico FODA:', margin, curY);
    curY += 4;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...TEXT_DARK);
    curY = drawJustifiedParagraph(doc, String(diag.sintesis_foda), margin, curY, contentWidth, 3.5, 6);
  }

  // ── SECCIÓN 5: PRIORIZACIÓN DE CATEGORÍAS ───────────────────────────────────
  const categorias = parseJson(project.categorias_priorizadas);
  addSectionHeader(PMC_TITULOS_SECCIONES.PRIORIZACION);

  if (diag.priorizacion) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...TEXT_DARK);
    curY = drawJustifiedParagraph(doc, String(diag.priorizacion), margin, curY, contentWidth, 3.5, 6);
  }

  if (Array.isArray(categorias) && categorias.length > 0) {
    const catRows = categorias.map((c: { id?: string; nombre?: string; temas?: string[] }, i: number) => [
      { content: `${i + 1}`, styles: { halign: 'center' as const, fontStyle: 'bold' as const, fillColor: GRAY_BG } },
      safeStr(c.nombre || c.id, `Categoría ${i + 1}`),
      Array.isArray(c.temas) && c.temas.length > 0 ? c.temas.join('; ') : 'Todos los ámbitos prioritarios aplicables',
    ]);

    autoTable(doc, {
      startY: curY,
      head: [[
        { content: 'N°', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255], halign: 'center' } },
        { content: 'Categoría Priorizada (Política CREAA)', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
        { content: 'Temas / Ámbitos de Intervención', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
      ]],
      body: catRows,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 2, textColor: TEXT_DARK, lineColor: [210, 220, 235] },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 65 },
        2: { cellWidth: contentWidth - 75 },
      },
      margin: { left: margin, right: margin },
    });
    curY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 8 : curY + 30;
  }

  // ── SECCIÓN 6: PLAN DE ACCIÓN ───────────────────────────────────────────────
  addSectionHeader(PMC_TITULOS_SECCIONES.PLAN_ACCION);

  const planAccion = parseJson(project.plan_accion);
  const metasRaw: PmcMetaInstitucional[] = Array.isArray(planAccion.metas_institucionales) ? planAccion.metas_institucionales : [];
  // Enriquecer con catálogo canónico para eliminar fallbacks genéricos
  const metasInst: PmcMetaInstitucional[] = metasRaw.map((m) => enrichMetaWithCatalogBase(m, project));

  if (metasInst.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(...TEXT_MUTED);
    doc.text('No se han registrado metas institucionales específicas en el proyecto.', margin, curY);
    curY += 8;
  } else {
    const metaRows = metasInst.map((m) => {
      const subcat = m.tema || (Array.isArray(m.subcategorias_vinculadas) && m.subcategorias_vinculadas.length > 0
        ? m.subcategorias_vinculadas.join(', ')
        : 'General');
      const accion = m.accion_especifica || m.estrategia || 'Acción institucional';
      const estrategiaSeg = m.estrategias_seguimiento || 'Cortes en CTE';
      const fInicio = m.periodo_inicio || '08/2026';
      const fTermino = m.periodo_fin || '06/2027';
      const obs = m.observaciones || 'Sin observaciones adicionales';

      return [
        safeStr(m.nombre_categoria || m.categoria, 'Ámbito General'),
        safeStr(subcat),
        safeStr(m.meta, 'Meta institucional'),
        safeStr(accion),
        safeStr(m.personal_designado, 'Colectivo Escolar'),
        safeStr(m.entregable, 'Reporte'),
        safeStr(estrategiaSeg),
        safeStr(fInicio),
        safeStr(fTermino),
        safeStr(obs),
      ];
    });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...BLUE_MID);
    doc.text('Matriz General de Metas Institucionales y Plan de Acción (Formato 4.1):', margin, curY);
    curY += 4;

    autoTable(doc, {
      startY: curY,
      head: [[
        { content: 'Categoría', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
        { content: 'Subcategoría', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
        { content: 'Metas', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
        { content: 'Acciones Específicas a Realizar', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
        { content: 'Responsables', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
        { content: 'Productos', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
        { content: 'Estrategias de Seguimiento', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
        { content: 'Fecha Inicio', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
        { content: 'Fecha Término', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
        { content: 'Observaciones', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
      ]],
      body: metaRows,
      theme: 'grid',
      styles: { fontSize: 5.5, cellPadding: 1.2, textColor: TEXT_DARK, lineColor: [210, 220, 235] },
      columnStyles: {
        0: { cellWidth: 18 },
        1: { cellWidth: 16 },
        2: { cellWidth: 28 },
        3: { cellWidth: 26 },
        4: { cellWidth: 20 },
        5: { cellWidth: 18 },
        6: { cellWidth: 18 },
        7: { cellWidth: 12 },
        8: { cellWidth: 12 },
        9: { cellWidth: 18 },
      },
      margin: { left: margin, right: margin },
    });

    curY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 8 : curY + 40;

    // H-198 / H-204: Tablas Obligatorias del Plan de Acción (Formato 5.1 PMC 2025-2026)
    if (curY > pageHeight - 50) {
      doc.addPage();
      curY = 18;
      drawHeaderOnNewPage();
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...BLUE_MID);
    doc.text('Tablas Obligatorias del Plan de Acción (Formato 5.1 PMC 2025-2026):', margin, curY);
    curY += 4;

    const coveredMetaIndicesPdf = new Set<number>();

    for (let aIdx = 0; aIdx < AREAS_OBLIGATORIAS_51.length; aIdx++) {
      const area = AREAS_OBLIGATORIAS_51[aIdx];
      const {
        metaEstablecida,
        estrategiaImp,
        personalDes,
        productoComp,
        subcatVinc,
        situacionActual,
        matchingMeta,
      } = resolveAreaObligatoria51(area, metasInst, coveredMetaIndicesPdf);

      if (matchingMeta) {
        const foundIdx = metasInst.indexOf(matchingMeta as (typeof metasInst)[number]);
        if (foundIdx !== -1) coveredMetaIndicesPdf.add(foundIdx);
      }

      if (curY > pageHeight - 55) {
        doc.addPage();
        curY = 18;
        drawHeaderOnNewPage();
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...NAVY);
      doc.text(area.titulo, margin, curY);
      curY += 3.5;

      autoTable(doc, {
        startY: curY,
        head: [[
          { content: 'Apartado Formato 5.1', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
          { content: 'Contenido Oficial Institucional', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
        ]],
        body: [
          [{ content: 'Meta establecida', styles: { fontStyle: 'bold', fillColor: GRAY_BG } }, metaEstablecida],
          [{ content: 'Estrategia de implementación para cumplir la meta', styles: { fontStyle: 'bold', fillColor: GRAY_BG } }, estrategiaImp],
          [{ content: 'Personal designado para la instrumentación y el seguimiento de la meta', styles: { fontStyle: 'bold', fillColor: GRAY_BG } }, personalDes],
          [{ content: 'Producto que comprobará el cumplimiento de la meta', styles: { fontStyle: 'bold', fillColor: GRAY_BG } }, productoComp],
          [{ content: 'Subcategorías que vincularán  para cumplir la meta establecida', styles: { fontStyle: 'bold', fillColor: GRAY_BG } }, subcatVinc],
          [{ content: 'Situación actual en el plantel que justifica el establecimiento de la meta', styles: { fontStyle: 'bold', fillColor: GRAY_BG } }, situacionActual],
        ],
        theme: 'grid',
        styles: { fontSize: 6.8, cellPadding: 2, textColor: TEXT_DARK, lineColor: [210, 220, 235] },
        columnStyles: {
          0: { cellWidth: 50 },
        },
        margin: { left: margin, right: margin },
      });

      curY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 6 : curY + 45;
    }

    // Tablas para categorías y temas adicionales seleccionados por el plantel en PDF
    const additionalMetasPdf = metasInst.filter((_, idx) => !coveredMetaIndicesPdf.has(idx));
    if (additionalMetasPdf.length > 0) {
      if (curY > pageHeight - 50) {
        doc.addPage();
        curY = 18;
        drawHeaderOnNewPage();
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...BLUE_MID);
      doc.text('Tablas de Categorías y Temas Adicionales Seleccionados por el Plantel:', margin, curY);
      curY += 4;

      for (let mIdx = 0; mIdx < additionalMetasPdf.length; mIdx++) {
        const extraMetaRaw = additionalMetasPdf[mIdx];
        const extraMeta: any = enrichMetaWithCatalogBase(extraMetaRaw, project);
        const tituloExtra = extraMeta.nombre_categoria
          ? `${extraMeta.nombre_categoria}${extraMeta.tema ? ` — ${extraMeta.tema}` : ''}`
          : (extraMeta.tema || `Categoría Adicional ${mIdx + 1}`);

        const situacionPartsExtra = [extraMeta.necesidad, extraMeta.diagnostico_meta].filter(Boolean);
        const situacionActualExtra = situacionPartsExtra.length > 0
          ? situacionPartsExtra.join(' — ')
          : (extraMeta.linea_base ? safeStr(extraMeta.linea_base) : PENDIENTE_DEFINICION_51);

        const subcatExtra = (Array.isArray(extraMeta.subcategorias_vinculadas) && extraMeta.subcategorias_vinculadas.length > 0)
          ? extraMeta.subcategorias_vinculadas.join(', ')
          : (extraMeta.tema || extraMeta.nombre_categoria || PENDIENTE_DEFINICION_51);

        if (curY > pageHeight - 55) {
          doc.addPage();
          curY = 18;
          drawHeaderOnNewPage();
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(...NAVY);
        doc.text(tituloExtra, margin, curY);
        curY += 3.5;

        autoTable(doc, {
          startY: curY,
          head: [[
            { content: 'Apartado Formato 5.1', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
            { content: 'Contenido Oficial Institucional', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
          ]],
          body: [
            [{ content: 'Meta establecida', styles: { fontStyle: 'bold', fillColor: GRAY_BG } }, safeStr(cleanPmcPlaceholders(extraMeta.meta), PENDIENTE_DEFINICION_51)],
            [{ content: 'Estrategia de implementación para cumplir la meta', styles: { fontStyle: 'bold', fillColor: GRAY_BG } }, safeStr(cleanPmcPlaceholders(extraMeta.estrategia), PENDIENTE_DEFINICION_51)],
            [{ content: 'Personal designado para la instrumentación y el seguimiento de la meta', styles: { fontStyle: 'bold', fillColor: GRAY_BG } }, safeStr(extraMeta.personal_designado, PENDIENTE_DEFINICION_51)],
            [{ content: 'Producto que comprobará el cumplimiento de la meta', styles: { fontStyle: 'bold', fillColor: GRAY_BG } }, safeStr(cleanPmcPlaceholders(extraMeta.entregable), PENDIENTE_DEFINICION_51)],
            [{ content: 'Subcategorías que vincularán  para cumplir la meta establecida', styles: { fontStyle: 'bold', fillColor: GRAY_BG } }, subcatExtra],
            [{ content: 'Situación actual en el plantel que justifica el establecimiento de la meta', styles: { fontStyle: 'bold', fillColor: GRAY_BG } }, situacionActualExtra],
          ],
          theme: 'grid',
          styles: { fontSize: 6.8, cellPadding: 2, textColor: TEXT_DARK, lineColor: [210, 220, 235] },
          columnStyles: {
            0: { cellWidth: 50 },
          },
          margin: { left: margin, right: margin },
        });

        curY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 6 : curY + 45;
      }
    }

    // Fichas Técnicas por Meta Institucional (Paridad Oficial con DOCX)
    if (metasInst.length > 0) {
      if ((PMC_FICHAS_TECNICAS_PAGE_BREAK_BEFORE || curY > pageHeight - 45) && curY > 20) {
        doc.addPage();
        curY = 18;
        drawHeaderOnNewPage();
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...BLUE_MID);
      doc.text(PMC_FICHAS_TECNICAS_HEADING, margin, curY);
      curY += 4;

      for (let i = 0; i < metasInst.length; i++) {
        const m = metasInst[i];
        if (curY > pageHeight - 65) {
          doc.addPage();
          curY = 18;
          drawHeaderOnNewPage();
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(...NAVY);
        doc.text(`Ficha Técnica ${i + 1}: ${safeStr(m.nombre_categoria || m.categoria, 'Ámbito Institucional')}`, margin, curY);
        curY += 3.5;

        const situacionPartsFicha = [m.necesidad, m.diagnostico_meta].filter(Boolean);
        const situacionFicha = situacionPartsFicha.length > 0
          ? situacionPartsFicha.join(' — ')
          : safeStr(m.linea_base, 'Situación académica diagnosticada en el plantel.');

        const subcatVal = (Array.isArray(m.subcategorias_vinculadas) && m.subcategorias_vinculadas.length > 0)
          ? m.subcategorias_vinculadas.join(', ')
          : safeStr(m.tema || m.nombre_categoria, 'Ámbito General');

        const fichaBody: RowInput[] = [
          [{ content: 'Campo Descriptivo', styles: { fontStyle: 'bold', fillColor: BLUE_MID, textColor: [255, 255, 255] } }, { content: 'Especificación de la Meta Institucional', styles: { fontStyle: 'bold', fillColor: BLUE_MID, textColor: [255, 255, 255] } }],
          [{ content: 'Tema Específico:', styles: { fontStyle: 'bold', fillColor: GRAY_BG } }, safeStr(m.tema)],
          [{ content: 'Meta establecida:', styles: { fontStyle: 'bold', fillColor: GRAY_BG } }, safeStr(cleanPmcPlaceholders(m.meta))],
          [{ content: 'Estrategia de implementación para cumplir la meta:', styles: { fontStyle: 'bold', fillColor: GRAY_BG } }, safeStr(cleanPmcPlaceholders(m.estrategia))],
          [{ content: 'Línea Base Documentada:', styles: { fontStyle: 'bold', fillColor: GRAY_BG } }, safeStr(cleanPmcPlaceholders(m.linea_base), 'Situación inicial documentada')],
          [{ content: 'Personal designado para la instrumentación y el seguimiento de la meta:', styles: { fontStyle: 'bold', fillColor: GRAY_BG } }, safeStr(m.personal_designado, 'Colectivo Escolar')],
          [{ content: 'Producto que comprobará el cumplimiento de la meta:', styles: { fontStyle: 'bold', fillColor: GRAY_BG } }, safeStr(cleanPmcPlaceholders(m.entregable))],
          [{ content: 'Subcategorías que vincularán  para cumplir la meta establecida:', styles: { fontStyle: 'bold', fillColor: GRAY_BG } }, subcatVal],
          [{ content: 'Situación actual en el plantel que justifica el establecimiento de la meta:', styles: { fontStyle: 'bold', fillColor: GRAY_BG } }, situacionFicha],
          [
            { content: 'Período de Ejecución:', styles: { fontStyle: 'bold', fillColor: GRAY_BG } },
            (m.periodo_inicio || m.periodo_fin)
              ? `${safeStr(m.periodo_inicio, 'N/D')} — ${safeStr(m.periodo_fin, 'N/D')}`
              : 'N/D'
          ],
        ];

        if (m.accion_especifica) {
          fichaBody.push([{ content: 'Acción Específica (Formato 3.1):', styles: { fontStyle: 'bold', fillColor: GRAY_BG } }, safeStr(cleanPmcPlaceholders(m.accion_especifica))]);
        }
        if (m.finalidad) {
          fichaBody.push([{ content: 'Finalidad de la Meta (Formato 3.1):', styles: { fontStyle: 'bold', fillColor: GRAY_BG } }, safeStr(cleanPmcPlaceholders(m.finalidad))]);
        }
        if (m.proceso_evaluacion) {
          fichaBody.push([{ content: 'Proceso de Evaluación (Formato 3.1):', styles: { fontStyle: 'bold', fillColor: GRAY_BG } }, safeStr(cleanPmcPlaceholders(m.proceso_evaluacion))]);
        }
        if (m.estrategias_seguimiento) {
          fichaBody.push([{ content: 'Estrategias de Seguimiento (Formato 4.1):', styles: { fontStyle: 'bold', fillColor: GRAY_BG } }, safeStr(cleanPmcPlaceholders(m.estrategias_seguimiento))]);
        }
        if (m.observaciones) {
          fichaBody.push([{ content: 'Observaciones Generales (Formato 4.1):', styles: { fontStyle: 'bold', fillColor: GRAY_BG } }, safeStr(cleanPmcPlaceholders(m.observaciones))]);
        }

        autoTable(doc, {
          startY: curY,
          body: fichaBody,
          theme: 'grid',
          styles: { fontSize: 6.8, cellPadding: 2, textColor: TEXT_DARK, lineColor: [210, 220, 235] },
          columnStyles: {
            0: { cellWidth: 42 },
          },
          margin: { left: margin, right: margin },
        });

        curY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 6 : curY + 45;
      }
    }
  }

  // ── SECCIÓN 7: METAS INDIVIDUALES DEL PERSONAL ──────────────────────────────
  addSectionHeader(PMC_TITULOS_SECCIONES.METAS_INDIVIDUALES);

  const metasPers: any[] = Array.isArray(planAccion.metas_personales) ? planAccion.metas_personales : [];

  if (metasPers.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(...TEXT_MUTED);
    doc.text('No se han registrado metas individuales de la plantilla en este reporte.', margin, curY);
    curY += 8;
  } else {
    const personalRows = metasPers.map((p, i) => {
      const periodoStr = normalizePmcPeriodo(p.periodo);
      const cleanMetaInd = cleanPmcPlaceholders(p.meta_individual);
      const metaStr = safeStr(
        p.categoria
          ? `[${p.categoria}${p.tema ? ` — ${p.tema}` : ''}] ${cleanMetaInd || ''}`
          : cleanMetaInd,
        'Compromiso de mejora'
      );
      return [
        { content: `${i + 1}`, styles: { halign: 'center' as const, fontStyle: 'bold' as const, fillColor: GRAY_BG } },
        safeStr(p.nombre, 'Personal'),
        safeStr(p.cargo, 'Docente'),
        metaStr,
        safeStr(cleanPmcPlaceholders(p.estrategia), 'Seguimiento en aula'),
        safeStr(cleanPmcPlaceholders(p.entregable), 'Planeación y Portafolio'),
        { content: periodoStr, styles: { halign: 'center' as const } },
      ];
    });

    autoTable(doc, {
      startY: curY,
      head: [[
        { content: 'N°', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255], halign: 'center' } },
        { content: 'Nombre del Integrante', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
        { content: 'Cargo / Función', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
        { content: 'Meta y Compromiso Individual', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
        { content: 'Estrategia Individual', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
        { content: 'Entregable Comprobable', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
        { content: 'Período', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255], halign: 'center' } },
      ]],
      body: personalRows,
      theme: 'grid',
      styles: { fontSize: 6.5, cellPadding: 1.8, textColor: TEXT_DARK, lineColor: [210, 220, 235] },
      columnStyles: {
        0: { cellWidth: 7 },
        1: { cellWidth: 32 },
        2: { cellWidth: 24 },
        3: { cellWidth: 42 },
        4: { cellWidth: 32 },
        5: { cellWidth: 25 },
        6: { cellWidth: 20 },
      },
      margin: { left: margin, right: margin },
    });

    curY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 8 : curY + 40;
  }

  // ── SECCIÓN 8: PARTICIPANTES, CONTROL DE REVISIONES Y APROBACIÓN ────────────
  addSectionHeader(PMC_TITULOS_SECCIONES.PARTICIPANTES_CONTROL);

  // Mecanismos de Seguimiento y Monitoreo Trimestral (Paridad con DOCX y Rescate Cap. VI)
  if (metasInst.length > 0) {
    if (curY > pageHeight - 55) {
      doc.addPage();
      curY = 18;
      drawHeaderOnNewPage();
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...BLUE_MID);
    doc.text('Mecanismos de Seguimiento y Monitoreo Trimestral:', margin, curY);
    curY += 4;

    const segRows = metasInst.map((m) => [
      (m.periodo_inicio || m.periodo_fin)
        ? `${safeStr(m.periodo_inicio, 'Corte 1')} a ${safeStr(m.periodo_fin, 'Corte 2')}`
        : 'Período ordinario',
      safeStr(cleanPmcPlaceholders(m.meta), 'Meta institucional programada'),
      safeStr(m.personal_designado, 'Dirección / Colectivo Escolar'),
    ]);

    autoTable(doc, {
      startY: curY,
      head: [[
        { content: 'Período / Corte de Seguimiento', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
        { content: 'Meta Institucional Asociada', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
        { content: 'Responsable del Seguimiento', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
      ]],
      body: segRows,
      theme: 'grid',
      styles: { fontSize: 6.5, cellPadding: 2, textColor: TEXT_DARK, lineColor: [210, 220, 235] },
      columnStyles: {
        0: { cellWidth: 40 },
        1: { cellWidth: contentWidth - 90 },
        2: { cellWidth: 50 },
      },
      margin: { left: margin, right: margin },
    });
    curY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 8 : curY + 30;
  }

  // Tabla de Personal y Colectivo Escolar Participante (Paridad con DOCX)
  const staffDataRaw = parseJson<PmcStaffMember[]>(project.staff_data);
  const personalParticipante = Array.isArray(staffDataRaw) && staffDataRaw.length > 0
    ? staffDataRaw
        .filter((s) => isValidStaffName(s?.nombre) && !isCollectiveOrNonHumanEntity(s?.nombre))
        .map((s) => ({
          nombre: safeStr(s.nombre, 'Integrante del Colectivo Escolar'),
          cargo: safeStr(s.cargo, 'Docente'),
          horas_base: s.horas_base != null && String(s.horas_base).trim() !== ''
            ? `${s.horas_base} hrs`
            : '—',
        }))
    : (project.director_name ? [{
        nombre: project.director_name,
        cargo: 'Director(a)',
        horas_base: '—',
      }] : []);

  if (personalParticipante.length > 0) {
    if (curY > pageHeight - 55) {
      doc.addPage();
      curY = 18;
      drawHeaderOnNewPage();
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...BLUE_MID);
    doc.text('Personal y Colectivo Escolar Participante:', margin, curY);
    curY += 4;

    const partRows = personalParticipante.map((p, idx) => [
      { content: `${idx + 1}`, styles: { halign: 'center' as const, fontStyle: 'bold' as const, fillColor: GRAY_BG } },
      p.nombre,
      p.cargo,
      { content: p.horas_base, styles: { halign: 'center' as const } },
      '_____________________',
    ]);

    autoTable(doc, {
      startY: curY,
      head: [[
        { content: 'N°', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255], halign: 'center' } },
        { content: 'Nombre Completo del Personal', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
        { content: 'Cargo / Función en el CTE', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
        { content: 'Horas Base', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255], halign: 'center' } },
        { content: 'Firma de Conformidad', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255], halign: 'center' } },
      ]],
      body: partRows,
      theme: 'grid',
      styles: { fontSize: 6.5, cellPadding: 2, textColor: TEXT_DARK, lineColor: [210, 220, 235] },
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 62 },
        2: { cellWidth: 45 },
        3: { cellWidth: 20, halign: 'center' },
        4: { cellWidth: contentWidth - 135, halign: 'center' },
      },
      margin: { left: margin, right: margin },
    });
    curY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 8 : curY + 35;
  }

  if (curY > pageHeight - 55) {
    doc.addPage();
    curY = 20;
    drawHeaderOnNewPage();
  }

  const dirName = safeStr(project.director_name, 'Director(a) del Plantel');
  const supName = safeStr(project.supervisor_name, 'Supervisor(a) de Zona');

  autoTable(doc, {
    startY: curY,
    head: [[
      {
        content: 'CONSTANCIA DE APROBACIÓN Y VALIDACIÓN DEL PLAN DE MEJORA CONTINUA',
        colSpan: 3,
        styles: { fillColor: NAVY, textColor: [255, 255, 255], halign: 'center', fontStyle: 'bold', fontSize: 8 },
      },
    ]],
    body: [
      [
        {
          content: `\n\n\n\n_____________________________________________\nELABORÓ\n\n${dirName.toUpperCase()}\nDIRECTOR(A) DEL PLANTEL\nFirma y Sello del Plantel`,
          styles: { halign: 'center', cellWidth: contentWidth / 3 },
        },
        {
          content: `\n\n\n\n_____________________________________________\nREVISÓ\n\nREPRESENTANTE DEL CTE\nCOLECTIVO DOCENTE DEL PLANTEL\nFirma y Rúbrica`,
          styles: { halign: 'center', cellWidth: contentWidth / 3 },
        },
        {
          content: `\n\n\n\n_____________________________________________\nVALIDÓ\n\n${supName.toUpperCase()}\nSUPERVISOR(A) DE ZONA ESCOLAR\nVo. Bo. y Sello de Zona`,
          styles: { halign: 'center', cellWidth: contentWidth / 3 },
        },
      ],
    ],
    theme: 'plain',
    styles: { fontSize: 7, cellPadding: 2, textColor: TEXT_DARK },
    margin: { left: margin, right: margin },
    pageBreak: 'avoid',
  });

  // ── SEGUNDA PASADA: RELLENAR FOLIOS EN LA TABLA DEL ÍNDICE (PÁGINA 2) ───────
  doc.setPage(2);
  for (const cell of pageCellCoords) {
    const pageNum = sectionPageMap.get(cell.key) ?? '—';
    doc.setFont('helvetica', cell.isSection ? 'bold' : 'normal');
    doc.setFontSize(7);
    if (cell.isSection) {
      doc.setTextColor(...NAVY);
    } else {
      doc.setTextColor(...TEXT_MUTED);
    }
    doc.text(String(pageNum), cell.x + cell.width / 2, cell.y + cell.height / 2 + 1, { align: 'center' });
  }

  // ── PIE DE PÁGINA FORMAL CON FOLIADO ────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    if (p > 1) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...TEXT_MUTED);
      doc.text(
        `Plan de Mejora Continua (PMC) — Página ${p} de ${totalPages}`,
        pageWidth / 2,
        pageHeight - 7,
        { align: 'center' }
      );
    }
  }

  return Buffer.from(doc.output('arraybuffer'));
}
