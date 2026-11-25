import autoTable, { type RowInput } from 'jspdf-autotable';
import { SCHOOL_YEAR } from '@/lib/config';
import { logger } from '@/lib/logger';
import { calculatePmcIndicatorRows } from '@/lib/pmc-indicator-calculator';
import type { PmcStatisticalContext } from '@/types/pmc';
import {
  PMC_TITULOS_SECCIONES,
  PMC_SUBSECCIONES_DIAGNOSTICO,
  PMC_SECCIONES_CANONICAS,
  shouldSectionPageBreak,
  clasificarNormativaJerarquica,
  getObjetivoPmcText,
  getTextoInfraestructura,
  getTextoBeneficiosComunitarios,
} from '@/lib/pmc-document-structure';
import {
  NAVY,
  BLUE_MID,
  BLUE_LIGHT,
  GOLD_LINE,
  GRAY_BG,
  TEXT_DARK,
  TEXT_MUTED,
  safeStr,
  parseJson,
  drawJustifiedParagraph,
  type PmcPdfRenderState,
} from './helpers';

export function renderPmcPdfPortadaYDiagnostico(state: PmcPdfRenderState): void {
  const { doc, project, logos, pageWidth, pageHeight, margin, contentWidth } = state;
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

  const addSectionHeader = (titulo: string, currentY: number): number => {
    let y = currentY;
    const shouldBreak = shouldSectionPageBreak(titulo) || (y > pageHeight - 35);
    if (shouldBreak && y > 20) {
      doc.addPage();
      y = 18;
    }
    drawHeaderOnNewPage();

    sectionPageMap.set(titulo, doc.getNumberOfPages());

    doc.setFillColor(...NAVY);
    doc.rect(margin, y, contentWidth, 6.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text(titulo, margin + 4, y + 4.5);

    y += 9;
    return y;
  };

  // ── ÍNDICE GENERAL ──────────────────────────────────────────────────────────
  curY = addSectionHeader('ÍNDICE GENERAL', curY);

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
  curY = addSectionHeader(PMC_TITULOS_SECCIONES.PRESENTACION, curY);

  const diag = parseJson(project.diagnostico_generado);
  const indAcad = parseJson(project.indicadores_academicos);

  const textoPresentacion = safeStr(diag.presentacion) ||
    `El ${safeStr(project.school_name, 'plantel escolar')}, con CCT ${safeStr(project.school_cct, 'N/D')} y ubicado en la localidad de ${safeStr(project.locality, 'N/D')}, municipio de ${safeStr(project.municipality, 'N/D')}, Puebla, presenta su Programa de Mejora Continua (PMC) para el ciclo escolar ${safeStr(project.ciclo_escolar, SCHOOL_YEAR)}. Este instrumento de planeación directiva se fundamenta en el artículo 3° de la Constitución Política de los Estados Unidos Mexicanos, garantizando el derecho humano a la educación con un enfoque de equidad, excelencia y mejora continua, alineado con el Modelo Educativo de la Nueva Escuela Mexicana (NEM), el Marco Curricular Común de la Educación Media Superior (MCCEMS) y los ejes rectores de la política educativa estatal CREAA.`;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_DARK);
  curY = drawJustifiedParagraph(doc, textoPresentacion, margin, curY, contentWidth, 4, 8);

  // ── SECCIÓN 2: OBJETIVO DEL PMC ─────────────────────────────────────────────
  curY = addSectionHeader(PMC_TITULOS_SECCIONES.OBJETIVO, curY);

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
  curY = addSectionHeader(PMC_TITULOS_SECCIONES.NORMATIVIDAD, curY);

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
  curY = addSectionHeader(PMC_TITULOS_SECCIONES.DIAGNOSTICO, curY);

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


  state.curY = curY;
  state.cicloTexto = cicloTexto;
  state.diag = diag;
  state.sectionPageMap = sectionPageMap;
  state.tocEntries = tocEntries;
  state.pageCellCoords = pageCellCoords;
  state.drawHeaderOnNewPage = drawHeaderOnNewPage;
  state.addSectionHeader = addSectionHeader;
}
