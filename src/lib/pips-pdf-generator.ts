/**
 * pips-pdf-generator.ts — Generador PDF Oficial del PIPS para Supervisores de Zona
 * Plan de Intervención y Acompañamiento Pedagógico de Supervisión (PIPS)
 * SIGPDA-EMS · Estándar Oficial SEP Puebla (DBEPA)
 * Formato Carta (215.9mm x 279.4mm) con membrete oficial, sellos, matrícula concentrada y firmas.
 */

import jsPDF from 'jspdf';
import autoTable, { type RowInput } from 'jspdf-autotable';
import { loadAllLogos } from './pdf-logos';
import { SCHOOL_YEAR } from '@/lib/config';
import { logger } from './logger';
import type { PipsPlantele, PipsObjetivo, PipsCronogramaActividad } from '@/types/pips';

const NAVY: [number, number, number] = [31, 56, 100];       // #1F3864 - Azul Institucional DBEPA
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

export async function generatePipsPDF(
  row: Record<string, unknown>,
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

  const planteles: PipsPlantele[] = Array.isArray(row.planteles_json) ? row.planteles_json as PipsPlantele[] : [];
  const problematicas = Array.isArray(row.problematicas_json) ? row.problematicas_json as { titulo: string; descripcion: string; prioridad: string }[] : [];
  const objetivos: PipsObjetivo[] = Array.isArray(row.objetivos_especificos_json) ? row.objetivos_especificos_json as PipsObjetivo[] : [];
  const cronograma: PipsCronogramaActividad[] = Array.isArray(row.cronograma_json) ? row.cronograma_json as PipsCronogramaActividad[] : [];
  const evaluacion = Array.isArray(row.evaluacion_json) ? row.evaluacion_json as { indicador: string; meta: string; instrumento: string }[] : [];

  const totalT = planteles.reduce((s, pl) => s + (Number(pl.total) || 0), 0);
  const totalH = planteles.reduce((s, pl) => s + (Number(pl.hombres) || 0), 0);
  const totalM = planteles.reduce((s, pl) => s + (Number(pl.mujeres) || 0), 0);

  const cicloTexto = safeStr(row.ciclo_escolar, SCHOOL_YEAR);
  const zonaNombre = safeStr(row.zona_nombre, 'Zona Escolar');
  const zonaClave = safeStr(row.zona_clave, 'Clave N/D');
  const supervisor = safeStr(row.supervisor_name, 'Supervisor(a) Escolar');

  // ═════════════════════════════════════════════════════════════════════════════
  // PÁGINA 1: PORTADA OFICIAL DE SUPERVISIÓN
  // ═════════════════════════════════════════════════════════════════════════════

  let curY = 12;

  // Logotipos oficiales
  if (logos.gobierno) {
    try {
      const fmt = logos.gobierno.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG';
      doc.addImage(logos.gobierno, fmt, margin, curY, 36, 15);
    } catch (err) {
      logger.warn('[PIPS-PDF] Error agregando logotipo de gobierno en portada', { error: err });
    }
  }
  if (logos.sep) {
    try {
      const fmt = logos.sep.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG';
      doc.addImage(logos.sep, fmt, (pageWidth - 32) / 2, curY, 32, 9);
    } catch (err) {
      logger.warn('[PIPS-PDF] Error agregando logotipo SEP en portada', { error: err });
    }
  }
  if (logos.supervision) {
    try {
      const fmt = logos.supervision.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG';
      doc.addImage(logos.supervision, fmt, pageWidth - margin - 32, curY, 32, 12);
    } catch (err) {
      logger.warn('[PIPS-PDF] Error agregando logotipo de supervisión en portada', { error: err });
    }
  }

  curY += 22;

  // Franja dorada oficial
  doc.setDrawColor(...GOLD_LINE);
  doc.setLineWidth(1.2);
  doc.line(margin, curY, pageWidth - margin, curY);

  curY += 10;

  // Encabezados jerárquicos
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
  doc.text('SUBSECRETARÍA DE EDUCACIÓN MEDIA SUPERIOR', pageWidth / 2, curY, { align: 'center' });

  curY += 4.5;
  doc.text('DIRECCIÓN DE BACHILLERATOS ESTATALES Y PREPARATORIA ABIERTA (DBEPA)', pageWidth / 2, curY, { align: 'center' });

  curY += 13;

  // Título Monumental de Supervisión
  doc.setFillColor(...NAVY);
  doc.roundedRect(margin + 6, curY, contentWidth - 12, 25, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text('PLAN DE INTERVENCIÓN Y ACOMPAÑAMIENTO', pageWidth / 2, curY + 8, { align: 'center' });
  doc.text('PEDAGÓGICO DE SUPERVISIÓN (PIPS)', pageWidth / 2, curY + 14, { align: 'center' });

  doc.setFontSize(9.5);
  doc.setTextColor(...GOLD_LINE);
  doc.text(`CARTOGRAFÍA Y ESTRATEGIA ZONAL · CICLO ESCOLAR ${cicloTexto.toUpperCase()}`, pageWidth / 2, curY + 20, { align: 'center' });

  curY += 34;

  // Tabla Cédula de Identificación de Zona
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
          content: 'CÉDULA TÉCNICA DE IDENTIFICACIÓN DE LA SUPERVISIÓN ESCOLAR',
          colSpan: 2,
          styles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 8.5 },
        },
      ],
    ],
    body: [
      [{ content: 'Zona Escolar:', styles: { fontStyle: 'bold', cellWidth: 50, fillColor: GRAY_BG } }, `${zonaNombre} (Clave: ${zonaClave})`],
      [{ content: 'Supervisor(a) Escolar:', styles: { fontStyle: 'bold', fillColor: GRAY_BG } }, supervisor],
      [{ content: 'Municipio Sede:', styles: { fontStyle: 'bold', fillColor: GRAY_BG } }, safeStr(row.municipio_sede)],
      [{ content: 'Municipios que Atiende:', styles: { fontStyle: 'bold', fillColor: GRAY_BG } }, safeStr(row.municipios_atiende)],
      [{ content: 'Cobertura Institucional:', styles: { fontStyle: 'bold', fillColor: GRAY_BG } }, `${Number(row.num_planteles) || planteles.length} planteles adscritos`],
      [{ content: 'Matrícula Concentrada:', styles: { fontStyle: 'bold', fillColor: GRAY_BG } }, totalT > 0 ? `${totalT.toLocaleString()} estudiantes (${totalH} Hombres / ${totalM} Mujeres)` : 'En proceso de captura'],
      [{ content: 'Subsistema / Modalidad:', styles: { fontStyle: 'bold', fillColor: GRAY_BG } }, `${safeStr(row.subsistema, 'BGE')} — ${safeStr(row.modalidad, 'Escolarizada')}`],
      [{ content: 'Personal ATP Asignado:', styles: { fontStyle: 'bold', fillColor: GRAY_BG } }, safeStr(row.atps, 'Sin ATP asignado')],
      [{ content: 'Fecha de Expedición:', styles: { fontStyle: 'bold', fillColor: GRAY_BG } }, `Puebla, Pue., a ${todayStr}`],
    ],
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2.3, textColor: TEXT_DARK, lineColor: [200, 210, 225] },
    margin: { left: margin + 5, right: margin + 5 },
  });

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(...TEXT_MUTED);
  doc.text(
    'Instrumento técnico-pedagógico para la asesoría, acompañamiento y aseguramiento de la excelencia académica en zona.',
    pageWidth / 2,
    pageHeight - 14,
    { align: 'center' }
  );

  // ═════════════════════════════════════════════════════════════════════════════
  // PÁGINA 2 EN ADELANTE: CONTENIDO TÉCNICO ZONAL
  // ═════════════════════════════════════════════════════════════════════════════
  doc.addPage();
  curY = 18;

  const drawHeaderOnNewPage = () => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...NAVY);
    doc.text(`SECRETARÍA DE EDUCACIÓN PÚBLICA DE PUEBLA · DIRECCIÓN DE BACHILLERATOS ESTATALES (DBEPA)`, margin, 10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...TEXT_MUTED);
    doc.text(`PIPS ${cicloTexto} · ${zonaNombre} (${zonaClave})`, pageWidth - margin, 10, { align: 'right' });

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

  // ── SECCIÓN 1: PRESENTACIÓN DEL SUPERVISOR ──────────────────────────────────
  addSectionHeader('1. PRESENTACIÓN Y VISIÓN PEDAGÓGICA DEL SUPERVISOR');

  const presSupervisor = safeStr(
    row.presentacion_supervisor,
    'La supervisión escolar ejerce un liderazgo pedagógico y técnico orientado a la mejora continua, el acompañamiento en aula y el fortalecimiento de los colectivos docentes.'
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...TEXT_DARK);
  const splitPres = doc.splitTextToSize(presSupervisor, contentWidth);
  doc.text(splitPres, margin, curY);
  curY += splitPres.length * 3.5 + 6;

  // ── SECCIÓN 2: EVALUACIÓN Y REFLEXIÓN DEL CICLO ANTERIOR ────────────────────
  addSectionHeader('2. EVALUACIÓN Y REFLEXIÓN DEL PIPS ANTERIOR');

  const hizoAnterior = !!row.pips_anterior_realizado;
  if (hizoAnterior) {
    const reflexion = safeStr(row.reflexion_pips_anterior, 'Se implementaron visitas de acompañamiento con impacto positivo.');
    const fortalezas = safeStr(row.fortalezas_anterior, 'Participación docente en CAPEMS, cumplimiento normativo.');
    const areasOportunidad = safeStr(row.areas_oportunidad_anterior, 'Monitoreo de planeaciones en tiempo y forma, integración comunitaria PAEC.');

    autoTable(doc, {
      startY: curY,
      head: [[
        { content: 'Elemento de Reflexión', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255], cellWidth: 40 } },
        { content: 'Hallazgos y Balance del Ciclo Anterior', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
      ]],
      body: [
        [{ content: 'Balance General:', styles: { fontStyle: 'bold', fillColor: GRAY_BG } }, reflexion],
        [{ content: 'Fortalezas Consolidadas:', styles: { fontStyle: 'bold', fillColor: [220, 252, 231] } }, fortalezas],
        [{ content: 'Áreas de Oportunidad:', styles: { fontStyle: 'bold', fillColor: [254, 243, 199] } }, areasOportunidad],
      ],
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 2.2, textColor: TEXT_DARK, lineColor: [210, 220, 235] },
      margin: { left: margin, right: margin },
    });
    curY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 8 : curY + 30;
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(...TEXT_MUTED);
    doc.text('La supervisión inicia este ciclo con levantamiento de diagnóstico basal para la estructuración de la cartografía zonal.', margin, curY);
    curY += 8;
  }

  // ── SECCIÓN 3: DIAGNÓSTICO TERRITORIAL Y MATRÍCULA DE PLANTELES ─────────────
  addSectionHeader('3. DIAGNÓSTICO TERRITORIAL Y MATRÍCULA POR PLANTEL');

  if (planteles.length > 0) {
    const plantelRows: RowInput[] = planteles.map((pl, i) => [
      { content: `${pl.no || i + 1}`, styles: { halign: 'center' as const, fontStyle: 'bold' as const, fillColor: GRAY_BG } },
      safeStr(pl.cct),
      safeStr(pl.nombre),
      safeStr(pl.localidad),
      safeStr(pl.municipio),
      { content: `${Number(pl.hombres) || 0}`, styles: { halign: 'center' as const } },
      { content: `${Number(pl.mujeres) || 0}`, styles: { halign: 'center' as const } },
      { content: `${Number(pl.total) || 0}`, styles: { halign: 'center' as const, fontStyle: 'bold' as const } },
    ]);

    // Fila totalizadora
    plantelRows.push([
      { content: '', styles: { fillColor: NAVY } },
      { content: 'TOTALES ZONA', colSpan: 4, styles: { fontStyle: 'bold' as const, halign: 'right' as const, fillColor: NAVY, textColor: [255, 255, 255] } },
      { content: `${totalH}`, styles: { fontStyle: 'bold' as const, halign: 'center' as const, fillColor: NAVY, textColor: [255, 255, 255] } },
      { content: `${totalM}`, styles: { fontStyle: 'bold' as const, halign: 'center' as const, fillColor: NAVY, textColor: [255, 255, 255] } },
      { content: `${totalT}`, styles: { fontStyle: 'bold' as const, halign: 'center' as const, fillColor: NAVY, textColor: [...GOLD_LINE] } },
    ]);

    autoTable(doc, {
      startY: curY,
      head: [[
        { content: 'No.', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255], halign: 'center' } },
        { content: 'CCT', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
        { content: 'Nombre del Plantel', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
        { content: 'Localidad', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
        { content: 'Municipio', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
        { content: 'H', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255], halign: 'center' } },
        { content: 'M', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255], halign: 'center' } },
        { content: 'Total', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255], halign: 'center' } },
      ]],
      body: plantelRows,
      theme: 'grid',
      styles: { fontSize: 6.5, cellPadding: 1.8, textColor: TEXT_DARK, lineColor: [210, 220, 235] },
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 24 },
        2: { cellWidth: 52 },
        3: { cellWidth: 32 },
        4: { cellWidth: 32 },
        5: { cellWidth: 12 },
        6: { cellWidth: 12 },
        7: { cellWidth: 16 },
      },
      margin: { left: margin, right: margin },
    });
    curY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 8 : curY + 40;
  }

  // Contexto socioeducativo y problemáticas
  if (row.diagnostico_contexto) {
    if (curY > pageHeight - 35) {
      doc.addPage();
      curY = 18;
      drawHeaderOnNewPage();
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...BLUE_MID);
    doc.text('3.1 Contexto Socioeducativo de la Zona:', margin, curY);
    curY += 4;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...TEXT_DARK);
    const splitCtx = doc.splitTextToSize(String(row.diagnostico_contexto), contentWidth);
    doc.text(splitCtx, margin, curY);
    curY += splitCtx.length * 3.5 + 6;
  }

  // Problemáticas pedagógicas detectadas
  if (problematicas.length > 0) {
    if (curY > pageHeight - 40) {
      doc.addPage();
      curY = 18;
      drawHeaderOnNewPage();
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...BLUE_MID);
    doc.text('3.2 Problemáticas Pedagógicas Prioritarias:', margin, curY);
    curY += 4;

    const probRows = problematicas.map((pr, idx) => [
      { content: `${idx + 1}`, styles: { halign: 'center' as const, fontStyle: 'bold' as const, fillColor: GRAY_BG } },
      safeStr(pr.titulo),
      safeStr(pr.descripcion),
      { content: safeStr(pr.prioridad, 'Alta').toUpperCase(), styles: { halign: 'center' as const, fontStyle: 'bold' as const } },
    ]);

    autoTable(doc, {
      startY: curY,
      head: [[
        { content: '#', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255], halign: 'center' } },
        { content: 'Problemática Zonal', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
        { content: 'Descripción y Causa Raíz', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
        { content: 'Prioridad', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255], halign: 'center' } },
      ]],
      body: probRows,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 2, textColor: TEXT_DARK, lineColor: [210, 220, 235] },
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 48 },
        2: { cellWidth: 106 },
        3: { cellWidth: 26 },
      },
      margin: { left: margin, right: margin },
    });
    curY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 8 : curY + 30;
  }

  // ── SECCIÓN 4: OBJETIVOS Y METAS DE SUPERVISIÓN ─────────────────────────────
  addSectionHeader('4. OBJETIVOS Y METAS DE ACOMPAÑAMIENTO PEDAGÓGICO');

  if (row.objetivo_general) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...BLUE_MID);
    doc.text('4.1 Objetivo General de la Supervisión:', margin, curY);
    curY += 4;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...TEXT_DARK);
    const splitObj = doc.splitTextToSize(String(row.objetivo_general), contentWidth);
    doc.text(splitObj, margin, curY);
    curY += splitObj.length * 3.5 + 6;
  }

  if (objetivos.length > 0) {
    const objRows: any[] = [];
    for (const obj of objetivos) {
      if (Array.isArray(obj.metas) && obj.metas.length > 0) {
        for (const m of obj.metas) {
          objRows.push([
            { content: `Obj. ${obj.numero || 1}`, styles: { halign: 'center' as const, fontStyle: 'bold' as const, fillColor: GRAY_BG } },
            safeStr(obj.descripcion),
            safeStr(m.meta),
            safeStr(m.indicador),
            safeStr(m.responsable),
            safeStr(m.fecha),
          ]);
        }
      } else {
        objRows.push([
          { content: `Obj. ${obj.numero || 1}`, styles: { halign: 'center' as const, fontStyle: 'bold' as const, fillColor: GRAY_BG } },
          safeStr(obj.descripcion),
          'Meta en desarrollo',
          'Indicador general',
          supervisor,
          'Todo el ciclo',
        ]);
      }
    }

    autoTable(doc, {
      startY: curY,
      head: [[
        { content: 'No.', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255], halign: 'center' } },
        { content: 'Objetivo Específico', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
        { content: 'Meta Cuantitativa', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
        { content: 'Indicador', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
        { content: 'Responsable', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
        { content: 'Periodo', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
      ]],
      body: objRows,
      theme: 'grid',
      styles: { fontSize: 6.5, cellPadding: 1.8, textColor: TEXT_DARK, lineColor: [210, 220, 235] },
      columnStyles: {
        0: { cellWidth: 14 },
        1: { cellWidth: 44 },
        2: { cellWidth: 44 },
        3: { cellWidth: 36 },
        4: { cellWidth: 26 },
        5: { cellWidth: 24 },
      },
      margin: { left: margin, right: margin },
    });
    curY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 8 : curY + 30;
  }

  // ── SECCIÓN 5: CRONOGRAMA DE INTERVENCIÓN Y VISITAS ─────────────────────────
  addSectionHeader('5. CRONOGRAMA DE INTERVENCIÓN Y VISITAS DE SUPERVISIÓN');

  if (cronograma.length > 0) {
    const cronRows = cronograma.map((c, idx) => [
      { content: `${idx + 1}`, styles: { halign: 'center' as const, fontStyle: 'bold' as const, fillColor: GRAY_BG } },
      safeStr(c.actividad),
      safeStr(c.objetivo),
      safeStr(c.responsable),
      safeStr(c.mes),
      safeStr(c.recursos),
      safeStr(c.indicador),
    ]);

    autoTable(doc, {
      startY: curY,
      head: [[
        { content: '#', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255], halign: 'center' } },
        { content: 'Actividad de Intervención', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
        { content: 'Objetivo', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
        { content: 'Responsable', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
        { content: 'Mes', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
        { content: 'Recursos', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
        { content: 'Indicador de Logro', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
      ]],
      body: cronRows,
      theme: 'grid',
      styles: { fontSize: 6.5, cellPadding: 1.8, textColor: TEXT_DARK, lineColor: [210, 220, 235] },
      columnStyles: {
        0: { cellWidth: 7 },
        1: { cellWidth: 42 },
        2: { cellWidth: 34 },
        3: { cellWidth: 26 },
        4: { cellWidth: 18 },
        5: { cellWidth: 28 },
        6: { cellWidth: 33 },
      },
      margin: { left: margin, right: margin },
    });
    curY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 8 : curY + 30;
  }

  // ── SECCIÓN 6: VALIDACIÓN Y FIRMAS OFICIALES ────────────────────────────────
  if (curY > pageHeight - 55) {
    doc.addPage();
    curY = 20;
    drawHeaderOnNewPage();
  }

  addSectionHeader('6. VALIDACIÓN INSTITUCIONAL Y FIRMAS DE CONFORMIDAD');

  autoTable(doc, {
    startY: curY,
    head: [[
      {
        content: 'CONSTANCIA FORMAL DE EXPEDICIÓN Y REGISTRO DEL PIPS',
        colSpan: 3,
        styles: { fillColor: NAVY, textColor: [255, 255, 255], halign: 'center', fontStyle: 'bold', fontSize: 8 },
      },
    ]],
    body: [
      [
        {
          content: `\n\n\n\n_____________________________________________\nELABORÓ\n\n${safeStr(row.atps, 'EQUIPO TÉCNICO ATP').toUpperCase()}\nASESORÍA TÉCNICA PEDAGÓGICA\nZona Escolar`,
          styles: { halign: 'center', cellWidth: contentWidth / 3 },
        },
        {
          content: `\n\n\n\n_____________________________________________\nREVISÓ Y VALIDÓ\n\n${supervisor.toUpperCase()}\nSUPERVISOR(A) DE ZONA ESCOLAR\nFirma y Sello de Zona`,
          styles: { halign: 'center', cellWidth: contentWidth / 3 },
        },
        {
          content: `\n\n\n\n_____________________________________________\nAUTORIZÓ\n\nDIRECCIÓN DE BACHILLERATOS ESTATALES\nY PREPARATORIA ABIERTA (DBEPA)\nVo. Bo. y Sello Institucional`,
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
        `SIGPDA-EMS · Plan de Intervención y Acompañamiento Pedagógico de Supervisión (PIPS) — Página ${p} de ${totalPages}`,
        pageWidth / 2,
        pageHeight - 7,
        { align: 'center' }
      );
    }
  }

  return Buffer.from(doc.output('arraybuffer'));
}
