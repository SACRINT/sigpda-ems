/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * cartografia-pdf-generator.ts
 * Generador PDF Oficial para la Cartografía de Zona Escolar
 * SIGPDA-EMS · DBEPA Puebla MCCEMS Ciclo Escolar 2026-2027
 * 
 * Genera el documento oficial en formato Carta con membretes, tablas de planteles,
 * indicadores cuantitativos 911/F11, matriz de triangulación de 4 perspectivas,
 * 3 líneas de acción oficiales DBEPA y memoria pedagógica.
 */

import jsPDF from 'jspdf';
import autoTable, { type RowInput } from 'jspdf-autotable';
import { loadAllLogos } from './pdf-logos';
import { SCHOOL_YEAR } from '@/lib/config';
import type { CartografiaZonaProject } from '@/types/cartografia';

const NAVY: [number, number, number] = [31, 56, 100];       // #1F3864
const BLUE_MID: [number, number, number] = [46, 116, 181];   // #2E74B5
const BLUE_LIGHT: [number, number, number] = [220, 228, 245]; // #DCE4F5
const GOLD_LINE: [number, number, number] = [232, 160, 32];  // #E8A020
const GRAY_BG: [number, number, number] = [245, 247, 250];   // #F5F7FA
const TEXT_DARK: [number, number, number] = [30, 41, 59];    // #1E293B
const TEXT_MUTED: [number, number, number] = [100, 116, 139]; // #64748B

export async function generateCartografiaPDF(
  project: CartografiaZonaProject,
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

  function printHeaderFooter(pageNum: number, totalPages: number) {
    // Franja institucional superior
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, pageWidth, 7, 'F');
    doc.setFillColor(...GOLD_LINE);
    doc.rect(0, 7, pageWidth, 1.5, 'F');

    // Logos
    let logoX = margin;
    if (logos.gobierno) {
      try {
        doc.addImage(logos.gobierno, 'PNG', logoX, 10, 30, 11);
        logoX += 34;
      } catch {}
    }
    if (logos.sep) {
      try {
        doc.addImage(logos.sep, 'PNG', logoX, 10, 30, 11);
      } catch {}
    }
    if (logos.supervision) {
      try {
        doc.addImage(logos.supervision, 'PNG', pageWidth - margin - 22, 9, 22, 12);
      } catch {}
    }

    // Texto de encabezado
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...NAVY);
    doc.text('DIRECCIÓN DE BACHILLERATOS ESTATALES Y PREPARATORIA ABIERTA', pageWidth / 2, 13, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(`CARTOGRAFÍA EDUCATIVA DE ZONA ESCOLAR — CICLO ${project.cicloEscolar || SCHOOL_YEAR}`, pageWidth / 2, 17, { align: 'center' });

    doc.setDrawColor(200, 210, 225);
    doc.setLineWidth(0.3);
    doc.line(margin, 23, pageWidth - margin, 23);

    // Footer
    doc.setDrawColor(200, 210, 225);
    doc.line(margin, pageHeight - 11, pageWidth - margin, pageHeight - 11);
    doc.setFillColor(...GOLD_LINE);
    doc.rect(0, pageHeight - 3.5, pageWidth, 1, 'F');
    doc.setFillColor(...NAVY);
    doc.rect(0, pageHeight - 2.5, pageWidth, 2.5, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(`Zona Escolar ${project.zonaNumero} (${project.zonaClave}) · Supervisión Escolar de Educación Media Superior`, margin, pageHeight - 7);
    doc.text(`Página ${pageNum} de ${totalPages}`, pageWidth - margin, pageHeight - 7, { align: 'right' });
  }

  function addSectionHeader(yPos: number, title: string, subtitle?: string): number {
    if (yPos > pageHeight - 35) {
      doc.addPage();
      yPos = 30;
    }
    doc.setFillColor(...NAVY);
    doc.rect(margin, yPos, contentWidth, 7, 'F');
    doc.setFillColor(...GOLD_LINE);
    doc.rect(margin, yPos + 7, contentWidth, 0.8, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(255, 255, 255);
    doc.text(title.toUpperCase(), margin + 3, yPos + 5);

    yPos += 11;
    if (subtitle) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(...TEXT_MUTED);
      doc.text(subtitle, margin + 1, yPos);
      yPos += 5;
    }
    return yPos;
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // PÁGINA 1: PORTADA INSTITUCIONAL
  // ═════════════════════════════════════════════════════════════════════════════
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageWidth, 18, 'F');
  doc.setFillColor(...GOLD_LINE);
  doc.rect(0, 18, pageWidth, 2.5, 'F');

  let p1LogoX = margin;
  if (logos.gobierno) {
    try { doc.addImage(logos.gobierno, 'PNG', p1LogoX, 24, 40, 14); p1LogoX += 45; } catch {}
  }
  if (logos.sep) {
    try { doc.addImage(logos.sep, 'PNG', p1LogoX, 24, 40, 14); } catch {}
  }
  if (logos.supervision) {
    try { doc.addImage(logos.supervision, 'PNG', pageWidth - margin - 28, 23, 28, 16); } catch {}
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...NAVY);
  doc.text('GOBIERNO DEL ESTADO DE PUEBLA · SECRETARÍA DE EDUCACIÓN', pageWidth / 2, 45, { align: 'center' });
  doc.setFontSize(9.5);
  doc.setTextColor(...BLUE_MID);
  doc.text('DIRECCIÓN DE BACHILLERATOS ESTATALES Y PREPARATORIA ABIERTA', pageWidth / 2, 51, { align: 'center' });

  // Cuadro Titular
  doc.setFillColor(...GRAY_BG);
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.8);
  doc.roundedRect(margin, 58, contentWidth, 34, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...NAVY);
  doc.text('CARTOGRAFÍA EDUCATIVA DE ZONA ESCOLAR', pageWidth / 2, 69, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...BLUE_MID);
  doc.text(`ZONA ESCOLAR ${project.zonaNumero} · ${project.subsistema.toUpperCase()}`, pageWidth / 2, 76, { align: 'center' });

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(...GOLD_LINE);
  doc.text('«Antes de construir el mapa, aprendemos a mirar el territorio»', pageWidth / 2, 84, { align: 'center' });

  // Ficha de Datos Institucionales de la Zona
  const infoData: RowInput[] = [
    ['Clave de Zona Escolar:', project.zonaClave, 'Ciclo Escolar:', project.cicloEscolar || SCHOOL_YEAR],
    ['Supervisor(a) Escolar:', project.supervisorName, 'Municipio Sede:', project.municipioSede],
    ['Municipios de Cobertura:', project.municipiosAtiende, 'Planteles Integrantes:', String(project.momento1Conocer?.planteles?.length || 0)],
    ['Matrícula Total Atendida:', `${project.momento1Conocer?.matriculaTotalZona || 0} estudiantes`, 'Asesores Técnicos (ATP):', project.atps?.join(', ') || 'N/D'],
  ];

  autoTable(doc, {
    startY: 97,
    body: infoData,
    margin: { left: margin, right: margin },
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2, textColor: TEXT_DARK },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: BLUE_LIGHT, cellWidth: 42 },
      1: { cellWidth: 50 },
      2: { fontStyle: 'bold', fillColor: BLUE_LIGHT, cellWidth: 42 },
      3: { cellWidth: 53.9 },
    },
  });

  // Introducción Metodológica (Del PIPS a la Cartografía)
  let y = (doc as any).lastAutoTable.finalY + 8;
  y = addSectionHeader(y, 'Fundamentación: Del PIPS a la Cartografía Territorial', 'Evolución institucional bajo el Modelo Educativo 2025 y la política CREAA');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_DARK);
  const fundText = [
    'En el marco del Modelo Educativo 2025 y el Marco Curricular Común de la Educación Media Superior (MCCEMS), el Plan de Intervención Pedagógica de Supervisión (PIPS) ha concluido su ciclo tras haber operado como un recopilador estático de datos cuantitativos. La Subsecretaría de Educación Media Superior evoluciona hacia una herramienta viva de navegación pedagógica: la Cartografía de Zona Escolar.',
    'La Cartografía de Zona no constituye un nuevo trámite burocrático; es una metodología situada que rescata la descripción territorial, permitiendo al supervisor y a los colectivos escolares mirar la zona como un territorio integral y no como una suma de escuelas aisladas. A través de cinco momentos metodológicos (Conocer, Organizar, Ubicar, Analizar y Decidir), cruza la evidencia cuantitativa del Formato 911 y F11C con la realidad cualitativa de los proyectos PAEC y la memoria pedagógica colegiada.',
  ];
  const splitFund = doc.splitTextToSize(fundText.join('\n\n'), contentWidth);
  doc.text(splitFund, margin, y);

  // ═════════════════════════════════════════════════════════════════════════════
  // MOMENTO 1: CONOCER (Padrón de Planteles)
  // ═════════════════════════════════════════════════════════════════════════════
  doc.addPage();
  y = 30;
  y = addSectionHeader(y, 'Momento 1: Conocer — Identificación de Planteles y Territorio', 'Padrón oficial de instituciones educativas de la zona escolar');

  const plantelesRows: RowInput[] = (project.momento1Conocer?.planteles || []).map((p) => [
    p.no,
    p.cct,
    p.nombre,
    p.municipio,
    p.turno,
    p.matricula,
    `${p.eficienciaTerminal}%`,
    `${p.abandono}%`,
    p.promedioGeneral.toFixed(2),
  ]);

  autoTable(doc, {
    startY: y,
    head: [['No.', 'CCT', 'Plantel Escolar', 'Municipio', 'Turno', 'Matr.', 'E.T. %', 'Aband. %', 'Prom. F11']],
    body: plantelesRows,
    margin: { left: margin, right: margin },
    theme: 'striped',
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontSize: 7.5, halign: 'center' },
    styles: { fontSize: 7, cellPadding: 1.8, textColor: TEXT_DARK },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { halign: 'center', cellWidth: 20 },
      2: { cellWidth: 60 },
      3: { cellWidth: 30 },
      4: { halign: 'center', cellWidth: 15 },
      5: { halign: 'right', cellWidth: 13 },
      6: { halign: 'right', cellWidth: 14 },
      7: { halign: 'right', cellWidth: 14 },
      8: { halign: 'right', cellWidth: 13.9 },
    },
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // MOMENTO 2: ORGANIZAR (Capa Cuantitativa + Capa Cualitativa)
  // ═════════════════════════════════════════════════════════════════════════════
  y = (doc as any).lastAutoTable.finalY + 7;
  y = addSectionHeader(y, 'Momento 2: Organizar — Evidencias Multidimensionales', 'Capa Cuantitativa 911/F11 y Capa Cualitativa Contextual');

  const cCuant = project.momento2Organizar?.capaCuantitativa;
  const cCual = project.momento2Organizar?.capaCualitativa;

  const benchRows: RowInput[] = [
    ['Matrícula Total Zona', `${cCuant?.matriculaTotal || 0} alumnos`, 'Promedio Eficiencia Terminal (911.7G)', `${cCuant?.promedioEficienciaZona || 0}%`],
    ['Promedio Abandono Escolar (911)', `${cCuant?.promedioAbandonoZona || 0}%`, 'Promedio Calificaciones (F11C)', `${cCuant?.promedioAprovechamientoZona || 0}`],
    ['Tasa de Reprobación Media', `${cCuant?.promedioReprobacionZona || 0}%`, 'Planteles en Prioridad Alta', `${cCuant?.plantelesAtencionPrioritaria?.length || 0} planteles`],
  ];

  autoTable(doc, {
    startY: y,
    body: benchRows,
    margin: { left: margin, right: margin },
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 2, textColor: TEXT_DARK },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: BLUE_LIGHT, cellWidth: 50 },
      1: { cellWidth: 43 },
      2: { fontStyle: 'bold', fillColor: BLUE_LIGHT, cellWidth: 52 },
      3: { cellWidth: 42.9 },
    },
  });

  y = (doc as any).lastAutoTable.finalY + 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...NAVY);
  doc.text('Problemáticas Territoriales Compartidas (Capa Cualitativa / PAEC):', margin, y);
  y += 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...TEXT_DARK);
  const probList = cCual?.problematicasComunes?.map((pr) => `• ${pr}`).join('\n') || '• No se registraron problemáticas cualitativas específicas.';
  const splitProb = doc.splitTextToSize(probList, contentWidth);
  doc.text(splitProb, margin, y);
  y += splitProb.length * 3.5 + 4;

  // ═════════════════════════════════════════════════════════════════════════════
  // MOMENTO 3: UBICAR (Mapeo y Recursos Comunitarios)
  // ═════════════════════════════════════════════════════════════════════════════
  if (y > pageHeight - 60) { doc.addPage(); y = 30; }
  y = addSectionHeader(y, 'Momento 3: Ubicar — Mapeo Escuela-Territorio y Aliados', 'Rutas de movilidad, conectividad e infraestructura comunitaria');

  const m3 = project.momento3Ubicar;
  const aliRows: RowInput[] = (m3?.recursosAliados || []).map((al) => [
    al.nombre,
    al.tipo.toUpperCase(),
    al.ubicacion,
    al.vinculacionPedagogica,
  ]);

  if (aliRows.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Aliado / Recurso Comunitario', 'Tipo', 'Ubicación', 'Vinculación con Proyectos PAEC']],
      body: aliRows,
      margin: { left: margin, right: margin },
      theme: 'grid',
      headStyles: { fillColor: BLUE_MID, textColor: [255, 255, 255], fontSize: 7.5, halign: 'center' },
      styles: { fontSize: 7, cellPadding: 2, textColor: TEXT_DARK },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 45 },
        1: { halign: 'center', cellWidth: 25 },
        2: { cellWidth: 35 },
        3: { cellWidth: 82.9 },
      },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // MOMENTO 4: ANALIZAR (Triangulación de Perspectivas)
  // ═════════════════════════════════════════════════════════════════════════════
  doc.addPage();
  y = 30;
  y = addSectionHeader(y, 'Momento 4: Analizar — Triangulación de 4 Perspectivas', 'Cruce metodológico de visiones: Directivos, Docentes, Familias y Supervisión');

  const tri = project.momento4Analizar?.triangulacion;
  const triRows: RowInput[] = [
    ['1. Directivos de Plantel', tri?.directivos || 'Sin registro'],
    ['2. Colectivos Docentes', tri?.docentes || 'Sin registro'],
    ['3. Alumnos y Familias', tri?.alumnosFamilias || 'Sin registro'],
    ['4. Supervisión Escolar / ATP', tri?.supervisionAtp || 'Sin registro'],
  ];

  autoTable(doc, {
    startY: y,
    head: [['Perspectiva Territorial', 'Lectura de la Realidad y Desafíos Pedagógicos']],
    body: triRows,
    margin: { left: margin, right: margin },
    theme: 'grid',
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontSize: 8, halign: 'center' },
    styles: { fontSize: 7.5, cellPadding: 2.5, textColor: TEXT_DARK },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: BLUE_LIGHT, cellWidth: 45 },
      1: { cellWidth: 142.9 },
    },
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // MOMENTO 5: DECIDIR (Metas CREAA y 3 Líneas de Acción)
  // ═════════════════════════════════════════════════════════════════════════════
  y = (doc as any).lastAutoTable.finalY + 8;
  y = addSectionHeader(y, 'Momento 5: Decidir — Meta General de Zona y Líneas de Acción', 'Acuerdos estratégicos y líneas de acción oficiales');

  // Meta General CREAA
  doc.setFillColor(...GRAY_BG);
  doc.setDrawColor(...GOLD_LINE);
  doc.setLineWidth(0.6);
  doc.roundedRect(margin, y, contentWidth, 18, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...NAVY);
  doc.text('META GENERAL DE LA ZONA ESCOLAR (FÓRMULA OFICIAL CREAA):', margin + 3, y + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...TEXT_DARK);
  const metaSplit = doc.splitTextToSize(project.momento5Decidir?.metaGeneralZona || 'Meta general de zona en proceso de formulación.', contentWidth - 6);
  doc.text(metaSplit, margin + 3, y + 10);
  y += 22;

  // 3 Líneas de Acción Oficiales
  const lineas = project.momento5Decidir?.lineasAccion || [];
  const lineasRows: RowInput[] = lineas.map((l) => [
    `Línea ${l.numero}:\n${l.titulo.replace(/^Línea de Acción \d+:\s*/, '')}`,
    l.accionesEspecificas.map((ac, i) => `${i + 1}. ${ac}`).join('\n'),
    l.responsables,
    l.entregables,
    l.periodoEjecucion,
  ]);

  autoTable(doc, {
    startY: y,
    head: [['Línea de Acción Oficial', 'Acciones Específicas', 'Responsables', 'Entregables Técnicos', 'Periodo']],
    body: lineasRows,
    margin: { left: margin, right: margin },
    theme: 'grid',
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontSize: 7.5, halign: 'center' },
    styles: { fontSize: 7, cellPadding: 2, textColor: TEXT_DARK },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: BLUE_LIGHT, cellWidth: 40 },
      1: { cellWidth: 62 },
      2: { cellWidth: 30 },
      3: { cellWidth: 35 },
      4: { halign: 'center', cellWidth: 20.9 },
    },
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // MEMORIA PEDAGÓGICA Y FIRMAS
  // ═════════════════════════════════════════════════════════════════════════════
  doc.addPage();
  y = 30;
  y = addSectionHeader(y, 'Memoria Pedagógica y Sistematización de la Autonomía', 'Construcción viva: ¿Qué logramos?, ¿Cómo lo logramos?, ¿Qué aprendimos?');

  const mem = project.memoriaPedagogica;
  const memRows: RowInput[] = [
    ['¿Qué logramos?', mem?.queLogramos || 'Resultados del acompañamiento pedagógico en proceso.'],
    ['¿Cómo lo logramos?', mem?.comoLoLogramos || 'Estrategias de autonomía y diálogo colegiado.'],
    ['¿Qué aprendimos?', mem?.queAprendimos || 'Lecciones aprendidas y áreas de oportunidad detectadas.'],
  ];

  autoTable(doc, {
    startY: y,
    head: [['Interrogante Rectora', 'Sistematización de la Práctica y Trascendencia Educativa']],
    body: memRows,
    margin: { left: margin, right: margin },
    theme: 'grid',
    headStyles: { fillColor: BLUE_MID, textColor: [255, 255, 255], fontSize: 8, halign: 'center' },
    styles: { fontSize: 7.5, cellPadding: 3, textColor: TEXT_DARK },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: BLUE_LIGHT, cellWidth: 40 },
      1: { cellWidth: 147.9 },
    },
  });

  // Firmas Institucionales de Supervisión
  y = (doc as any).lastAutoTable.finalY + 25;
  if (y > pageHeight - 45) { doc.addPage(); y = 40; }

  const colWidth = (contentWidth - 10) / 2;
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.5);

  // Firma Supervisor
  doc.line(margin + 10, y, margin + colWidth - 10, y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...NAVY);
  doc.text(project.supervisorName.toUpperCase(), margin + colWidth / 2, y + 4, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...TEXT_MUTED);
  doc.text(`Supervisor(a) Escolar · Zona ${project.zonaNumero}`, margin + colWidth / 2, y + 8, { align: 'center' });
  doc.text('Sello y Firma de Supervisión', margin + colWidth / 2, y + 12, { align: 'center' });

  // Firma ATP / Representante
  doc.line(margin + colWidth + 10, y, pageWidth - margin - 10, y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...NAVY);
  const atpPrincipal = project.atps?.[0] || 'Asesor Técnico Pedagógico';
  doc.text(atpPrincipal.toUpperCase(), margin + colWidth + colWidth / 2, y + 4, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...TEXT_MUTED);
  doc.text('Equipo de Asesoría Técnica Pedagógica (ATP)', margin + colWidth + colWidth / 2, y + 8, { align: 'center' });
  doc.text('Revisión y Acompañamiento Técnico', margin + colWidth + colWidth / 2, y + 12, { align: 'center' });

  // Imprimir encabezados y pies de página
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    printHeaderFooter(i, totalPages);
  }

  return Buffer.from(doc.output('arraybuffer'));
}
