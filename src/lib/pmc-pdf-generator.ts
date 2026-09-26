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
import type { PmcProject, PmcStatisticalContext, PmcStaffMember } from '@/types/pmc';
import {
  PMC_TITULOS_SECCIONES,
  PMC_SUBSECCIONES_DIAGNOSTICO,
  PMC_SECCIONES_CANONICAS,
  clasificarNormativaJerarquica,
  getObjetivoPmcText,
} from './pmc-document-structure';

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

  const addSectionHeader = (titulo: string) => {
    if (curY > pageHeight - 35) {
      doc.addPage();
      curY = 18;
    }
    drawHeaderOnNewPage();

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

  const tocRows = [];
  for (const sec of PMC_SECCIONES_CANONICAS) {
    tocRows.push([
      { content: String(sec.numero), styles: { fontStyle: 'bold' as const, halign: 'center' as const, fillColor: GRAY_BG } },
      { content: sec.titulo, styles: { fontStyle: 'bold' as const, fillColor: GRAY_BG } },
    ]);
    if (sec.subsecciones) {
      for (const sub of sec.subsecciones) {
        tocRows.push([
          { content: sub.numero, styles: { halign: 'center' as const, textColor: TEXT_MUTED } },
          { content: `   ${sub.titulo}`, styles: { fontStyle: 'italic' as const, textColor: TEXT_MUTED } },
        ]);
      }
    }
  }

  autoTable(doc, {
    startY: curY,
    head: [[
      { content: 'N°', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255], halign: 'center', cellWidth: 15 } },
      { content: 'Contenido Temático / Capítulo Oficial', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
    ]],
    body: tocRows,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 2, textColor: TEXT_DARK, lineColor: [210, 220, 235] },
    margin: { left: margin, right: margin },
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
    `El ${safeStr(project.school_name, 'plantel escolar')}, con CCT ${safeStr(project.school_cct, 'N/D')} y ubicado en la localidad de ${safeStr(project.locality, 'N/D')}, municipio de ${safeStr(project.municipality, 'N/D')}, Puebla, presenta su Programa de Mejora Continua (PMC) para el ciclo escolar ${safeStr(project.ciclo_escolar, '2026-2027')}. Este instrumento de planeación directiva se fundamenta en el artículo 3° de la Constitución Política de los Estados Unidos Mexicanos, garantizando el derecho humano a la educación con un enfoque de equidad, excelencia y mejora continua, alineado con el Modelo Educativo de la Nueva Escuela Mexicana (NEM), el Marco Curricular Común de la Educación Media Superior (MCCEMS) y los ejes rectores de la política educativa estatal CREAA.`;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_DARK);
  const splitPres = doc.splitTextToSize(textoPresentacion, contentWidth);
  doc.text(splitPres, margin, curY);
  curY += splitPres.length * 4 + 8;

  // ── SECCIÓN 2: OBJETIVO DEL PMC ─────────────────────────────────────────────
  if (curY > pageHeight - 55) {
    doc.addPage();
    curY = 18;
    drawHeaderOnNewPage();
  }
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
  const splitObj = doc.splitTextToSize(textoObjGeneral, contentWidth);
  doc.text(splitObj, margin, curY);
  curY += splitObj.length * 3.8 + 6;

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
    const splitOe = doc.splitTextToSize(oe, contentWidth);
    doc.text(splitOe, margin, curY);
    curY += splitOe.length * 3.6 + 2;
  }
  curY += 6;

  // ── SECCIÓN 3: NORMATIVIDAD APLICABLE ───────────────────────────────────────
  if (curY > pageHeight - 55) {
    doc.addPage();
    curY = 18;
    drawHeaderOnNewPage();
  }
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
      { content: `${nd.orden ?? i + 1}`, styles: { fontStyle: 'bold' as const, halign: 'center' as const, cellWidth: 8, fillColor: GRAY_BG } },
      { content: safeStr(nd.titulo), styles: { fontStyle: 'bold' as const, cellWidth: 60 } },
      { content: Array.isArray(nd.articulos) ? nd.articulos.join('\n• ') : safeStr(nd.articulos) },
    ]);

    autoTable(doc, {
      startY: curY,
      head: [[
        { content: '#', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255], halign: 'center' } },
        { content: 'Disposición Legal / Normativa', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
        { content: 'Artículos y Vinculación con el PMC', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
      ]],
      body: normRows,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 2, textColor: TEXT_DARK, lineColor: [210, 220, 235] },
      margin: { left: margin, right: margin },
    });

    curY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 6 : curY + 30;
  }

  // ── SECCIÓN 4: DIAGNÓSTICO ───────────────────────────────────────────────────
  if (curY > pageHeight - 45) {
    doc.addPage();
    curY = 18;
    drawHeaderOnNewPage();
  }
  addSectionHeader(PMC_TITULOS_SECCIONES.DIAGNOSTICO);

  // 4.1 Texto de Contexto Socioeducativo y Territorial
  const diagTexto = safeStr(diag.contexto || project.diagnostico_comunidad, 'El plantel se sitúa en un entorno con retos situados específicos de movilidad, acceso y desarrollo social, requiriendo un acompañamiento pedagógico permanente.');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...BLUE_MID);
  doc.text(PMC_SUBSECCIONES_DIAGNOSTICO.CONTEXTO, margin, curY);
  curY += 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...TEXT_DARK);
  const splitDiag = doc.splitTextToSize(diagTexto, contentWidth);
  doc.text(splitDiag, margin, curY);
  curY += splitDiag.length * 3.5 + 6;

  // 4.2 Tabla de Indicadores Académicos (Línea Base vs Metas)
  if (curY > pageHeight - 45) {
    doc.addPage();
    curY = 18;
    drawHeaderOnNewPage();
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...BLUE_MID);
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
    const splitAnalisis = doc.splitTextToSize(String(diag.analisis_indicadores).trim(), contentWidth);
    doc.text(splitAnalisis, margin, curY);
    curY += splitAnalisis.length * 3.5 + 6;
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
  doc.text(PMC_SUBSECCIONES_DIAGNOSTICO.INFRAESTRUCTURA, margin, curY);
  curY += 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...TEXT_DARK);
  const infraText = 'Las instalaciones físicas, aulas y recursos didácticos del plantel se gestionan de forma continua para asegurar condiciones dignas y seguras que favorezcan los procesos de enseñanza y aprendizaje, promoviendo la inclusión y la equidad formativa.';
  const splitInfra = doc.splitTextToSize(infraText, contentWidth);
  doc.text(splitInfra, margin, curY);
  curY += splitInfra.length * 3.5 + 6;

  // 4.4 Beneficios y Vinculación Comunitaria
  if (curY > pageHeight - 35) {
    doc.addPage();
    curY = 18;
    drawHeaderOnNewPage();
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...BLUE_MID);
  doc.text(PMC_SUBSECCIONES_DIAGNOSTICO.BENEFICIOS, margin, curY);
  curY += 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...TEXT_DARK);
  const benefText = 'La relación corresponsable con las familias, autoridades locales y comunidades aledañas permite consolidar redes de apoyo que impulsan la retención escolar, la captación de matrícula y la solución colectiva de problemáticas territoriales.';
  const splitBenef = doc.splitTextToSize(benefText, contentWidth);
  doc.text(splitBenef, margin, curY);
  curY += splitBenef.length * 3.5 + 6;

  // 4.5 Matriz FODA Cuadrante Oficial
  if (curY > pageHeight - 50) {
    doc.addPage();
    curY = 18;
    drawHeaderOnNewPage();
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...BLUE_MID);
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
    const splitSintesis = doc.splitTextToSize(String(diag.sintesis_foda).trim(), contentWidth);
    doc.text(splitSintesis, margin, curY);
    curY += splitSintesis.length * 3.5 + 6;
  }

  // ── SECCIÓN 5: PRIORIZACIÓN DE CATEGORÍAS ───────────────────────────────────
  const categorias = parseJson(project.categorias_priorizadas);
  if (curY > pageHeight - 45) {
    doc.addPage();
    curY = 18;
    drawHeaderOnNewPage();
  }
  addSectionHeader(PMC_TITULOS_SECCIONES.PRIORIZACION);

  if (diag.priorizacion) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...TEXT_DARK);
    const splitPrio = doc.splitTextToSize(String(diag.priorizacion).trim(), contentWidth);
    doc.text(splitPrio, margin, curY);
    curY += splitPrio.length * 3.5 + 6;
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
  const metasInst: any[] = Array.isArray(planAccion.metas_institucionales) ? planAccion.metas_institucionales : [];

  if (metasInst.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(...TEXT_MUTED);
    doc.text('No se han registrado metas institucionales específicas en el proyecto.', margin, curY);
    curY += 8;
  } else {
    const metaRows = metasInst.map((m, i) => [
      { content: `${i + 1}`, styles: { halign: 'center' as const, fontStyle: 'bold' as const, fillColor: GRAY_BG } },
      safeStr(m.nombre_categoria || m.categoria, 'Ámbito General'),
      safeStr(m.meta, 'Meta en proceso'),
      safeStr(m.estrategia, 'Estrategia pedagógica'),
      safeStr(m.personal_designado, 'Colectivo Escolar'),
      safeStr(m.entregable, 'Evidencias y Actas CTE'),
      `${safeStr(m.periodo_inicio, 'Ago')} - ${safeStr(m.periodo_fin, 'Jul')}`,
    ]);

    autoTable(doc, {
      startY: curY,
      head: [[
        { content: '#', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255], halign: 'center' } },
        { content: 'Ámbito / Categoría', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
        { content: 'Meta SMART', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
        { content: 'Estrategia de Operación', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
        { content: 'Responsable', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
        { content: 'Evidencia / Entregable', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
        { content: 'Periodo', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
      ]],
      body: metaRows,
      theme: 'grid',
      styles: { fontSize: 6.5, cellPadding: 1.8, textColor: TEXT_DARK, lineColor: [210, 220, 235] },
      columnStyles: {
        0: { cellWidth: 7 },
        1: { cellWidth: 26 },
        2: { cellWidth: 42 },
        3: { cellWidth: 38 },
        4: { cellWidth: 25 },
        5: { cellWidth: 28 },
        6: { cellWidth: 18 },
      },
      margin: { left: margin, right: margin },
    });

    curY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 8 : curY + 40;

    // Fichas Técnicas por Meta Institucional (Paridad Oficial con DOCX)
    if (metasInst.length > 0) {
      if (curY > pageHeight - 45) {
        doc.addPage();
        curY = 18;
        drawHeaderOnNewPage();
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...BLUE_MID);
      doc.text('Fichas Técnicas Descriptivas por Meta Institucional:', margin, curY);
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

        autoTable(doc, {
          startY: curY,
          body: [
            [{ content: 'Ámbito / Categoría:', styles: { fontStyle: 'bold', fillColor: GRAY_BG, cellWidth: 38 } }, safeStr(m.nombre_categoria || m.categoria)],
            [{ content: 'Tema Específico:', styles: { fontStyle: 'bold', fillColor: GRAY_BG } }, safeStr(m.tema)],
            [{ content: 'Meta SMART:', styles: { fontStyle: 'bold', fillColor: GRAY_BG } }, safeStr(m.meta)],
            [{ content: 'Línea Base:', styles: { fontStyle: 'bold', fillColor: GRAY_BG } }, safeStr(m.linea_base, 'Situación inicial documentada')],
            [{ content: 'Estrategia de Operación:', styles: { fontStyle: 'bold', fillColor: GRAY_BG } }, safeStr(m.estrategia)],
            [{ content: 'Personal Designado:', styles: { fontStyle: 'bold', fillColor: GRAY_BG } }, safeStr(m.personal_designado, 'Colectivo Escolar')],
            [{ content: 'Evidencia / Entregable:', styles: { fontStyle: 'bold', fillColor: GRAY_BG } }, safeStr(m.entregable)],
            [{ content: 'Período de Ejecución:', styles: { fontStyle: 'bold', fillColor: GRAY_BG } }, `${safeStr(m.periodo_inicio, 'Agosto')} — ${safeStr(m.periodo_fin, 'Julio')}`],
            [{ content: 'Diagnóstico de la Meta:', styles: { fontStyle: 'bold', fillColor: GRAY_BG } }, safeStr(m.diagnostico_meta, 'Justificación diagnóstica de la meta')],
          ],
          theme: 'grid',
          styles: { fontSize: 6.8, cellPadding: 2, textColor: TEXT_DARK, lineColor: [210, 220, 235] },
          columnStyles: {
            0: { cellWidth: 38 },
            1: { cellWidth: contentWidth - 38 },
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
    const personalRows = metasPers.map((p, i) => [
      { content: `${i + 1}`, styles: { halign: 'center' as const, fontStyle: 'bold' as const, fillColor: GRAY_BG } },
      safeStr(p.nombre, 'Personal'),
      safeStr(p.cargo, 'Docente'),
      safeStr(p.meta_individual, 'Compromiso de mejora'),
      safeStr(p.estrategia, 'Seguimiento en aula'),
      safeStr(p.entregable, 'Planeación y Portafolio'),
    ]);

    autoTable(doc, {
      startY: curY,
      head: [[
        { content: '#', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255], halign: 'center' } },
        { content: 'Nombre del Integrante', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
        { content: 'Cargo / Función', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
        { content: 'Meta y Compromiso Individual', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
        { content: 'Estrategia Individual', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
        { content: 'Entregable Comprobable', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
      ]],
      body: personalRows,
      theme: 'grid',
      styles: { fontSize: 6.5, cellPadding: 1.8, textColor: TEXT_DARK, lineColor: [210, 220, 235] },
      columnStyles: {
        0: { cellWidth: 7 },
        1: { cellWidth: 35 },
        2: { cellWidth: 26 },
        3: { cellWidth: 48 },
        4: { cellWidth: 40 },
        5: { cellWidth: 28 },
      },
      margin: { left: margin, right: margin },
    });

    curY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 8 : curY + 40;
  }

  // ── SECCIÓN 8: PARTICIPANTES, CONTROL DE REVISIONES Y APROBACIÓN ────────────
  if (curY > pageHeight - 55) {
    doc.addPage();
    curY = 20;
    drawHeaderOnNewPage();
  }

  addSectionHeader(PMC_TITULOS_SECCIONES.PARTICIPANTES_CONTROL);

  // Tabla de Personal y Colectivo Escolar Participante (Paridad con DOCX)
  const staffDataRaw = parseJson<PmcStaffMember[]>(project.staff_data);
  const personalParticipante = Array.isArray(staffDataRaw) && staffDataRaw.length > 0
    ? staffDataRaw.map((s) => ({
        nombre: safeStr(s.nombre, 'Integrante del Colectivo Escolar'),
        cargo: safeStr(s.cargo, 'Docente'),
      }))
    : [];

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
      '_____________________',
    ]);

    autoTable(doc, {
      startY: curY,
      head: [[
        { content: 'N°', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255], halign: 'center' } },
        { content: 'Nombre Completo', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
        { content: 'Cargo / Función en el CTE', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
        { content: 'Firma / Rúbrica', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255], halign: 'center' } },
      ]],
      body: partRows,
      theme: 'grid',
      styles: { fontSize: 6.5, cellPadding: 2, textColor: TEXT_DARK, lineColor: [210, 220, 235] },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 70 },
        2: { cellWidth: 55 },
        3: { cellWidth: contentWidth - 135, halign: 'center' },
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

  // ── PIE DE PÁGINA FORMAL CON FOLIADO ────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    if (p > 1) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...TEXT_MUTED);
      doc.text(
        `SIGPDA-EMS · Plan de Mejora Continua (PMC) — Página ${p} de ${totalPages}`,
        pageWidth / 2,
        pageHeight - 7,
        { align: 'center' }
      );
    }
  }

  return Buffer.from(doc.output('arraybuffer'));
}
