/* eslint-disable @typescript-eslint/no-explicit-any */
import autoTable from 'jspdf-autotable';
import { SCHOOL_YEAR } from '@/lib/config';
import { logger } from '@/lib/logger';
import type { TableRow2Cols } from '@/types/paec';
import { parseFodaData } from '@/lib/paec/docx/helpers';
import {
  NAVY,
  BLUE_MID,
  GOLD_LINE,
  GRAY_BG,
  TEXT_DARK,
  TEXT_MUTED,
  GREEN_BG,
  safeStr,
  addSectionBar,
  type PaecPdfRenderState,
} from './helpers';

export function renderPaecPdfFase1(state: PaecPdfRenderState): void {
  const {
    doc,
    p,
    sCtx,
    cCtx,
    teacherName,
    logos,
    zonaTexto,
    margin,
    pageWidth,
    pageHeight,
    contentWidth,
    communityLabel,
    cycleLabel,
  } = state;

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
        { content: `${zonaTexto} | ${safeStr(sCtx.municipality, 'Zacatlán')}, Puebla`, styles: {} },
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
        { content: `${zonaTexto} | Municipio: ${safeStr(sCtx.municipality)} | Localidad: ${safeStr(sCtx.locality)}`, styles: { textColor: TEXT_DARK } },
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
  // PÁGINA 3: MACRO-FASE I: DIAGNÓSTICO TERRITORIAL INTEGRAL (TABLAS 1 Y 2 MCCEMS)
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

  // Procesar datos FODA con normalización y fallbacks pedagógicos oficiales MCCEMS
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


  state.curY = curY;
}
