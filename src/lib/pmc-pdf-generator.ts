/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * pmc-pdf-generator.ts — Generador PDF Oficial del Plan de Mejora Continua (PMC)
 * SIGPDA-EMS · Estándar Oficial SEP Puebla (SEMS / MCCEMS)
 * Formato Carta (215.9mm x 279.4mm) con membrete oficial, sellos, FODA, metas y firmas.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { loadAllLogos } from './pdf-logos';
import { SCHOOL_YEAR } from '@/lib/config';
import { logger } from './logger';
import type { PmcProject, PmcStatisticalContext } from '@/types/pmc';

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

  // ── SECCIÓN 1: MARCO NORMATIVO ──────────────────────────────────────────────
  addSectionHeader('I. FUNDAMENTACIÓN NORMATIVA Y POLÍTICA EDUCATIVA');

  const normativa = parseJson(project.normativa);
  const normDocs: Array<{ titulo?: string; articulos?: string[] }> = (Array.isArray(normativa.documentos) && normativa.documentos.length > 0)
    ? normativa.documentos
    : [
        {
          titulo: 'Constitución Política de los Estados Unidos Mexicanos (Art. 3°)',
          articulos: ['Garantiza el derecho a la educación integral, inclusiva, universal, pública, gratuita, laica y de excelencia orientada al desarrollo humano.'],
        },
        {
          titulo: 'Ley General de Educación (Arts. 107, 108 y 109)',
          articulos: ['Establece la obligatoriedad del Programa de Mejora Continua en Educación Media Superior como instrumento estructurado de planeación participativa.'],
        },
        {
          titulo: 'Ley de Educación del Estado de Puebla (Arts. 80, 81 y 83)',
          articulos: ['Dispone la conformación participativa del PMC en los Consejos Técnicos Escolares y la vinculación corresponsable con la comunidad.'],
        },
        {
          titulo: 'Marco Curricular Común de la Educación Media Superior (MCCEMS - Acuerdo 09/08/23)',
          articulos: ['Fundamenta la formación socioemocional, recursos sociocognitivos, áreas del conocimiento y el vínculo pedagógico aula-escuela-comunidad.'],
        },
        {
          titulo: 'Lineamientos Oficiales del PMC para Educación Media Superior (SEMS / SEP Puebla)',
          articulos: ['Norma la priorización de categorías, diagnóstico escolar, formulación de metas CREAA y corresponsabilidad del colectivo docente.'],
        },
      ];

  const normRows = normDocs.map((nd, i) => [
    { content: `${i + 1}`, styles: { fontStyle: 'bold' as const, halign: 'center' as const, cellWidth: 8, fillColor: GRAY_BG } },
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

  curY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 8 : curY + 40;

  // ── SECCIÓN 2: DIAGNÓSTICO INTEGRAL ─────────────────────────────────────────
  addSectionHeader('II. DIAGNÓSTICO INTEGRAL Y CONTEXTO DEL PLANTEL');

  const diag = parseJson(project.diagnostico_generado);
  const indAcad = parseJson(project.indicadores_academicos);

  // 2.1 Texto de Presentación / Contexto Comunitario
  const diagTexto = safeStr(diag.presentacion || diag.contexto || project.diagnostico_comunidad, 'Diagnóstico contextual en proceso.');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...BLUE_MID);
  doc.text('2.1 Contexto Institucional, Social y Comunitario:', margin, curY);
  curY += 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...TEXT_DARK);
  const splitDiag = doc.splitTextToSize(diagTexto, contentWidth);
  doc.text(splitDiag, margin, curY);
  curY += splitDiag.length * 3.5 + 6;

  // 2.2 Tabla de Indicadores Académicos (Línea Base vs Metas)
  if (curY > pageHeight - 45) {
    doc.addPage();
    curY = 18;
    drawHeaderOnNewPage();
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...BLUE_MID);
  doc.text('2.2 Indicadores Educativos (Línea Base vs Meta Institucional):', margin, curY);
  curY += 4;

  const statsCtx: PmcStatisticalContext | undefined = project.statistical_context || (indAcad as any)?.statistical_context;
  const pStats = statsCtx?.plantel;
  const zStats = statsCtx?.zona;

  const matAnt = pStats?.matricula ?? indAcad.matricula;
  const apAnt = pStats?.aprobadosPorcentaje ?? indAcad.aprobacion_ant;
  const repAnt = pStats?.reprobacion ?? indAcad.reprobacion_ant;
  const abAnt = pStats?.abandono ?? indAcad.abandono_ant;
  const etAnt = pStats?.eficienciaTerminal ?? indAcad.et_ant;
  const promF11 = pStats?.promedioGeneral ?? pStats?.promedioCalificaciones;

  const apMeta = indAcad.aprobacion_meta ?? (apAnt !== undefined && apAnt !== null && !isNaN(Number(apAnt)) ? (Number(apAnt) + 5) : undefined);
  const abMeta = indAcad.abandono_meta ?? (abAnt !== undefined && abAnt !== null && !isNaN(Number(abAnt)) ? Math.max(0, Number(abAnt) - 2.5) : undefined);
  const etMeta = indAcad.et_meta ?? (etAnt !== undefined && etAnt !== null && !isNaN(Number(etAnt)) ? (Number(etAnt) + 6) : undefined);

  const indicRows: any[][] = [
    ['Tasa de Aprobación Escolar (F11C)', apAnt !== undefined ? `${apAnt}%` : 'N/D', apMeta !== undefined ? `${apMeta}%` : 'N/D', (apMeta !== undefined && apAnt !== undefined) ? `+${(Number(apMeta) - Number(apAnt)).toFixed(1)}% Mejora` : 'N/D'],
    ['Índice de Reprobación Escolar (F11C)', repAnt !== undefined ? `${repAnt}%` : 'N/D', apMeta !== undefined ? `${Math.max(0, 100 - Number(apMeta)).toFixed(1)}%` : 'N/D', apMeta !== undefined ? 'Reducción Progresiva' : 'N/D'],
    ['Abandono Escolar / Deserción (911.7)', abAnt !== undefined ? `${abAnt}%` : 'N/D', abMeta !== undefined ? `${abMeta}%` : 'N/D', (abMeta !== undefined && abAnt !== undefined) ? `${(Number(abMeta) - Number(abAnt)).toFixed(1)}% Retención` : 'N/D'],
    ['Eficiencia Terminal / Egreso (911.7G)', etAnt !== undefined ? `${etAnt}%` : 'N/D', etMeta !== undefined ? `${etMeta}%` : 'N/D', (etMeta !== undefined && etAnt !== undefined) ? `+${(Number(etMeta) - Number(etAnt)).toFixed(1)}% Graduación` : 'N/D'],
    ['Matrícula Escolar Oficial (911.7G)', matAnt !== undefined ? `${matAnt} estudiantes` : 'N/D', matAnt !== undefined ? `${matAnt} estudiantes` : 'N/D', 'Sostenimiento'],
  ];

  if (promF11 !== undefined) {
    indicRows.push(['Promedio General de Calificaciones (F11C)', `${promF11}`, `${(Number(promF11) + 0.5).toFixed(2)}`, '+0.50 Aprovechamiento']);
  }

  if (zStats) {
    indicRows.push([
      { content: `Comparativo de Zona Escolar (${zStats.zonaNumero || 'Regional'}): Media Abandono ${zStats.promedioAbandono}%, Media Eficiencia ${zStats.promedioEficiencia}% (Prioridad: ${zStats.brechasDiagnostico.prioridadIntervencion.toUpperCase()})`, colSpan: 4, styles: { fontStyle: 'italic' as const, fillColor: BLUE_LIGHT, textColor: NAVY } }
    ]);
  }

  autoTable(doc, {
    startY: curY,
    head: [[
      { content: 'Indicador Oficial (Fuente: 911 / F11)', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
      { content: 'Ciclo Anterior (Línea Base)', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255], halign: 'center' } },
      { content: `Meta Proyectada (${cicloTexto})`, styles: { fillColor: BLUE_MID, textColor: [255, 255, 255], halign: 'center' } },
      { content: 'Variación Esperada', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255], halign: 'center' } },
    ]],
    body: indicRows,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 2, textColor: TEXT_DARK, lineColor: [210, 220, 235] },
    margin: { left: margin, right: margin },
  });

  curY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 8 : curY + 40;

  // 2.3 Matriz FODA Cuadrante Oficial
  if (curY > pageHeight - 50) {
    doc.addPage();
    curY = 18;
    drawHeaderOnNewPage();
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...BLUE_MID);
  doc.text('2.3 Matriz de Análisis Estratégico FODA:', margin, curY);
  curY += 4;

  const foda = parseJson(project.foda);

  autoTable(doc, {
    startY: curY,
    head: [[
      { content: 'FACTORES INTERNOS', colSpan: 2, styles: { fillColor: NAVY, textColor: [255, 255, 255], halign: 'center', fontStyle: 'bold' } },
    ]],
    body: [
      [
        { content: 'FORTALEZAS (F):', styles: { fontStyle: 'bold', fillColor: BLUE_LIGHT, cellWidth: 32 } },
        safeStr(foda.fortalezas, 'Compromiso docente, clima institucional participativo.'),
      ],
      [
        { content: 'DEBILIDADES (D):', styles: { fontStyle: 'bold', fillColor: [254, 226, 226], cellWidth: 32 } },
        safeStr(foda.debilidades, 'Rezago en áreas sociocognitivas, recursos tecnológicos limitados.'),
      ],
      [
        { content: 'OPORTUNIDADES (O):', styles: { fontStyle: 'bold', fillColor: [220, 252, 231], cellWidth: 32 } },
        safeStr(foda.oportunidades, 'Vinculación con el sector productivo y proyectos comunitarios PAEC.'),
      ],
      [
        { content: 'AMENAZAS (A):', styles: { fontStyle: 'bold', fillColor: [254, 243, 199], cellWidth: 32 } },
        safeStr(foda.amenazas, 'Condiciones socioeconómicas vulnerables y migración juvenil.'),
      ],
    ],
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 2.2, textColor: TEXT_DARK, lineColor: [200, 210, 225] },
    margin: { left: margin, right: margin },
  });

  curY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 8 : curY + 40;

  // ── SECCIÓN 3: METAS INSTITUCIONALES ────────────────────────────────────────
  addSectionHeader('III. METAS INSTITUCIONALES POR ÁMBITO DE ACCIÓN');

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
  }

  // ── SECCIÓN 4: METAS INDIVIDUALES DEL PERSONAL ──────────────────────────────
  addSectionHeader('IV. METAS INDIVIDUALES Y COMPROMISOS DEL PERSONAL');

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

  // ── SECCIÓN 5: VALIDACIÓN INSTITUCIONAL Y FIRMAS REGLAMENTARIAS ─────────────
  if (curY > pageHeight - 55) {
    doc.addPage();
    curY = 20;
    drawHeaderOnNewPage();
  }

  addSectionHeader('V. VALIDACIÓN INSTITUCIONAL Y FIRMAS OFICIALES');

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
