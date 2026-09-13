/**
 * paec-pdf-generator.ts — Generador PDF Oficial del Proyecto Escolar Comunitario (PEC / PAEC)
 * SIGPDA-EMS · Estándar Oficial SEP Puebla (DBEPA / MCCEMS)
 * Formato Carta (215.9mm x 279.4mm) con membrete oficial, sellos, fases curriculares,
 * plan operativo semestral, anexos técnicos y firmas colegiadas reglamentarias.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { loadAllLogos } from './pdf-logos';
import { SCHOOL_YEAR } from '@/lib/config';
import type {
  PaecProject,
  MapeoRow,
  CronogramaRow,
  DetalleCurricularRow,
  PlanOperativoRow,
} from '@/types/paec';

// Paleta Institucional DBEPA / SEP Puebla
const NAVY: [number, number, number] = [31, 56, 100];        // #1F3864 - Azul Institucional DBEPA
const BLUE_MID: [number, number, number] = [46, 116, 181];    // #2E74B5 - Azul Secundario
const BLUE_LIGHT: [number, number, number] = [220, 228, 245];  // #DCE4F5 - Encabezados Suaves
const GOLD_LINE: [number, number, number] = [232, 160, 32];   // #E8A020 - Dorado Oficial SEP
const GRAY_BG: [number, number, number] = [242, 244, 248];    // #F2F4F8 - Fondo Alternado
const TEXT_DARK: [number, number, number] = [30, 41, 59];     // #1E293B - Texto Primario
const TEXT_MUTED: [number, number, number] = [100, 116, 139];  // #64748B - Texto Secundario

function safeStr(val: unknown, fallback = 'N/D'): string {
  if (val === null || val === undefined) return fallback;
  const str = String(val).trim();
  return str.length > 0 ? str : fallback;
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

  const pageWidth = doc.internal.pageSize.getWidth();   // 215.9 mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 279.4 mm
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  // ═════════════════════════════════════════════════════════════════════════════
  // PÁGINA 1: PORTADA OFICIAL INSTITUCIONAL
  // ═════════════════════════════════════════════════════════════════════════════

  let curY = 12;

  // Logotipos superiores
  if (logos.gobierno) {
    try {
      const fmt = logos.gobierno.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG';
      doc.addImage(logos.gobierno, fmt, margin, curY, 36, 15);
    } catch {}
  }
  if (logos.sep) {
    try {
      const fmt = logos.sep.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG';
      doc.addImage(logos.sep, fmt, (pageWidth - 32) / 2, curY, 32, 9);
    } catch {}
  }
  if (logos.supervision) {
    try {
      const fmt = logos.supervision.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG';
      doc.addImage(logos.supervision, fmt, pageWidth - margin - 32, curY, 32, 12);
    } catch {}
  }

  curY += 22;

  // Franja dorada de separación
  doc.setDrawColor(...GOLD_LINE);
  doc.setLineWidth(1.2);
  doc.line(margin, curY, pageWidth - margin, curY);

  curY += 10;

  // Encabezados gubernamentales
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
  doc.text('DIRECCIÓN DE BACHILLERATOS ESTATALES Y PREPARATORIA ABIERTA (DBEPA)', pageWidth / 2, curY, { align: 'center' });

  curY += 13;

  // Título Monumental Enmarcado
  doc.setFillColor(...NAVY);
  doc.roundedRect(margin + 4, curY, contentWidth - 8, 25, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.5);
  doc.setTextColor(255, 255, 255);
  doc.text('PROYECTO ESCOLAR COMUNITARIO (PEC)', pageWidth / 2, curY + 8, { align: 'center' });
  doc.text('PROGRAMA AULA, ESCUELA Y COMUNIDAD (PAEC)', pageWidth / 2, curY + 14, { align: 'center' });

  doc.setFontSize(9.5);
  doc.setTextColor(...GOLD_LINE);
  doc.text(`MARCO CURRICULAR COMÚN (MCCEMS) · CICLO ESCOLAR ${SCHOOL_YEAR}`, pageWidth / 2, curY + 20, { align: 'center' });

  curY += 33;

  // Cédula de Identificación del Proyecto
  const cycleLabel =
    project.cycleType === 'A'
      ? 'Semestre A (1°, 3° y 5° Semestres)'
      : project.cycleType === 'B'
      ? 'Semestre B (2°, 4° y 6° Semestres)'
      : 'Ciclo Escolar Completo Anual';

  const sCtx = project.schoolContext || {};
  const cCtx = project.communityContext || {};

  autoTable(doc, {
    startY: curY,
    head: [
      [
        {
          content: 'CÉDULA TÉCNICA DE IDENTIFICACIÓN DEL PROYECTO PEC',
          colSpan: 2,
          styles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 8.5 },
        },
      ],
    ],
    body: [
      [
        { content: 'Nombre del Proyecto:', styles: { fontStyle: 'bold', textColor: NAVY, cellWidth: 50 } },
        { content: safeStr(project.projectName), styles: { fontStyle: 'bold', textColor: TEXT_DARK } },
      ],
      [
        { content: 'Problemática Central:', styles: { fontStyle: 'bold', textColor: NAVY } },
        { content: safeStr(project.problemStatement), styles: { textColor: TEXT_DARK } },
      ],
      [
        { content: 'Docente Coordinador:', styles: { fontStyle: 'bold', textColor: NAVY } },
        { content: safeStr(teacherName), styles: { textColor: TEXT_DARK } },
      ],
      [
        { content: 'Ciclo / Modalidad:', styles: { fontStyle: 'bold', textColor: NAVY } },
        { content: `${cycleLabel} · ${SCHOOL_YEAR}`, styles: { textColor: TEXT_DARK } },
      ],
      [
        { content: 'Plantel Educativo / CCT:', styles: { fontStyle: 'bold', textColor: NAVY } },
        { content: safeStr(sCtx.facilities || 'Bachillerato General Estatal', 'BGE Puebla'), styles: { textColor: TEXT_DARK } },
      ],
      [
        { content: 'Comunidad / Ubicación:', styles: { fontStyle: 'bold', textColor: NAVY } },
        { content: safeStr(cCtx.location || 'Estado de Puebla', 'Puebla, Pue.'), styles: { textColor: TEXT_DARK } },
      ],
      [
        { content: 'Matrícula y Docentes:', styles: { fontStyle: 'bold', textColor: NAVY } },
        { content: `Estudiantes: ${safeStr(sCtx.enrollment, 'N/R')} | Docentes participantes: ${safeStr(sCtx.teacherCount, 'N/R')}`, styles: { textColor: TEXT_DARK } },
      ],
    ],
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2.5, overflow: 'linebreak' },
    columnStyles: {
      0: { cellWidth: 50, fillColor: GRAY_BG },
      1: { cellWidth: contentWidth - 50 },
    },
    margin: { left: margin, right: margin },
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // PÁGINA 2: FASE 1 — DIAGNÓSTICO COLECTIVO
  // ═════════════════════════════════════════════════════════════════════════════

  doc.addPage();
  curY = 24;

  addSectionHeader(doc, 'I. FASE 1: DIAGNÓSTICO COLECTIVO Y COMUNITARIO', curY, margin, contentWidth);
  curY += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_MUTED);
  const diagIntro = 'El diagnóstico colegiado identifica las características multidimensionales del entorno social, familiar y escolar para fundamentar la intervención pedagógica comunitaria según las directrices del MCCEMS.';
  const splitDiag = doc.splitTextToSize(diagIntro, contentWidth);
  doc.text(splitDiag, margin, curY);
  curY += splitDiag.length * 3.5 + 3;

  // Tabla 1: Contexto Comunitario
  const diag = project.fase1Diagnostico;
  const t1Data = diag?.tabla1 || (diag as any)?.tabla1_caracteristicas || [];
  const t1Rows = t1Data.map((r: any) => [
    safeStr(r.col1 || r.aspecto || 'Aspecto Comunitario'),
    safeStr(r.col2 || r.descripcion || 'Sin descripción'),
  ]);

  if (t1Rows.length > 0) {
    autoTable(doc, {
      startY: curY,
      head: [
        [
          {
            content: '1.1 CARACTERÍSTICAS DE LA COMUNIDAD (CONTEXTO EXTERNO)',
            colSpan: 2,
            styles: { fillColor: BLUE_MID, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
          },
        ],
        [
          { content: 'Dimensión / Aspecto', styles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold' } },
          { content: 'Descripción y Diagnóstico Situacional', styles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold' } },
        ],
      ],
      body: t1Rows,
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 2, overflow: 'linebreak' },
      columnStyles: {
        0: { cellWidth: 50, fontStyle: 'bold', fillColor: GRAY_BG },
        1: { cellWidth: contentWidth - 50 },
      },
      margin: { left: margin, right: margin },
    });
    // @ts-expect-error autoTable adds lastAutoTable to jsPDF instance
    curY = doc.lastAutoTable.finalY + 6;
  }

  // Tabla 2: Contexto Escolar
  const t2Data = diag?.tabla2 || (diag as any)?.tabla2_recursos || [];
  const t2Rows = t2Data.map((r: any) => [
    safeStr(r.col1 || r.aspecto || r.tipo || 'Recurso / Dimensión Escolar'),
    safeStr(r.col2 || r.descripcion || r.detalle || 'Sin descripción'),
  ]);

  if (t2Rows.length > 0) {
    if (curY > pageHeight - 50) {
      doc.addPage();
      curY = 24;
    }
    autoTable(doc, {
      startY: curY,
      head: [
        [
          {
            content: '1.2 CARACTERÍSTICAS DE LA INSTITUCIÓN EDUCATIVA (CONTEXTO INTERNO)',
            colSpan: 2,
            styles: { fillColor: BLUE_MID, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
          },
        ],
        [
          { content: 'Elemento Institucional', styles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold' } },
          { content: 'Descripción y Estado Operativo', styles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold' } },
        ],
      ],
      body: t2Rows,
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 2, overflow: 'linebreak' },
      columnStyles: {
        0: { cellWidth: 50, fontStyle: 'bold', fillColor: GRAY_BG },
        1: { cellWidth: contentWidth - 50 },
      },
      margin: { left: margin, right: margin },
    });
    // @ts-expect-error autoTable adds lastAutoTable to jsPDF instance
    curY = doc.lastAutoTable.finalY + 6;
  }

  // Tabla 3: FODA
  const t3Data = diag?.tabla3 || (diag as any)?.tabla3_foda || [];
  const t3Rows = t3Data.map((r: any) => [
    safeStr(r.aspect || r.aspecto || 'Aspecto FODA'),
    safeStr(r.analysis || r.analisis || r.descripcion || 'Sin análisis'),
  ]);

  if (t3Rows.length > 0) {
    if (curY > pageHeight - 50) {
      doc.addPage();
      curY = 24;
    }
    autoTable(doc, {
      startY: curY,
      head: [
        [
          {
            content: '1.3 ANÁLISIS ESTRATÉGICO FODA DEL COLECTIVO DOCENTE',
            colSpan: 2,
            styles: { fillColor: BLUE_MID, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
          },
        ],
        [
          { content: 'Componente FODA', styles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold' } },
          { content: 'Análisis Estratégico y Potencial de Vinculación', styles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold' } },
        ],
      ],
      body: t3Rows,
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 2, overflow: 'linebreak' },
      columnStyles: {
        0: { cellWidth: 45, fontStyle: 'bold', fillColor: GRAY_BG },
        1: { cellWidth: contentWidth - 45 },
      },
      margin: { left: margin, right: margin },
    });
    // @ts-expect-error autoTable adds lastAutoTable to jsPDF instance
    curY = doc.lastAutoTable.finalY + 6;
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // PÁGINA: FASE 2 — FUNDAMENTACIÓN, PROPÓSITOS Y METAS
  // ═════════════════════════════════════════════════════════════════════════════

  const just = project.fase2Justificacion;
  if (just) {
    doc.addPage();
    curY = 24;

    addSectionHeader(doc, 'II. FASE 2: DISEÑO Y FUNDAMENTACIÓN DEL PROYECTO', curY, margin, contentWidth);
    curY += 10;

    if (just.introduction) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...NAVY);
      doc.text('2.1 INTRODUCCIÓN Y SUSTENTO METODOLÓGICO', margin, curY);
      curY += 4.5;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...TEXT_DARK);
      const cleanIntro = just.introduction.replace(/#+\s*/g, '').trim();
      const splitIntro = doc.splitTextToSize(cleanIntro, contentWidth);
      doc.text(splitIntro, margin, curY);
      curY += splitIntro.length * 3.3 + 5;
    }

    // Propósitos Integrales
    if (just.proposito) {
      if (curY > pageHeight - 55) {
        doc.addPage();
        curY = 24;
      }
      autoTable(doc, {
        startY: curY,
        head: [
          [
            {
              content: '2.2 PROPÓSITOS INTEGRALES DEL PROYECTO ESCOLAR COMUNITARIO',
              colSpan: 2,
              styles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
            },
          ],
        ],
        body: [
          [
            { content: 'Propósito Educativo:', styles: { fontStyle: 'bold', textColor: NAVY, cellWidth: 45, fillColor: GRAY_BG } },
            { content: safeStr(just.proposito.educativo) },
          ],
          [
            { content: 'Propósito Social / Comunitario:', styles: { fontStyle: 'bold', textColor: NAVY, cellWidth: 45, fillColor: GRAY_BG } },
            { content: safeStr(just.proposito.social) },
          ],
          [
            { content: 'Propósito Funcional / Práctico:', styles: { fontStyle: 'bold', textColor: NAVY, cellWidth: 45, fillColor: GRAY_BG } },
            { content: safeStr(just.proposito.funcional) },
          ],
        ],
        theme: 'grid',
        styles: { fontSize: 7.5, cellPadding: 2.5, overflow: 'linebreak' },
        columnStyles: {
          0: { cellWidth: 45 },
          1: { cellWidth: contentWidth - 45 },
        },
        margin: { left: margin, right: margin },
      });
      // @ts-expect-error autoTable adds lastAutoTable to jsPDF instance
      curY = doc.lastAutoTable.finalY + 6;
    }

    // Metas y Alcance
    if (just.alcance?.metas && just.alcance.metas.length > 0) {
      if (curY > pageHeight - 50) {
        doc.addPage();
        curY = 24;
      }
      const metaRows = just.alcance.metas.map((m, idx) => [
        `Meta ${idx + 1}`,
        safeStr(m),
      ]);

      autoTable(doc, {
        startY: curY,
        head: [
          [
            {
              content: '2.3 METAS CUANTITATIVAS E IMPACTO ESPERADO',
              colSpan: 2,
              styles: { fillColor: BLUE_MID, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
            },
          ],
        ],
        body: metaRows,
        theme: 'grid',
        styles: { fontSize: 7.5, cellPadding: 2, overflow: 'linebreak' },
        columnStyles: {
          0: { cellWidth: 30, fontStyle: 'bold', fillColor: GRAY_BG },
          1: { cellWidth: contentWidth - 30 },
        },
        margin: { left: margin, right: margin },
      });
      // @ts-expect-error autoTable adds lastAutoTable to jsPDF instance
      curY = doc.lastAutoTable.finalY + 6;
    }
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // PÁGINA: MAPEO CURRICULAR MULTIDISCIPLINARIO
  // ═════════════════════════════════════════════════════════════════════════════

  const mapeo = project.fase2Mapeo;
  if (mapeo && mapeo.length > 0) {
    doc.addPage();
    curY = 24;

    addSectionHeader(doc, 'III. MAPEO DE UNIDADES DE APRENDIZAJE CURRICULAR (UAC)', curY, margin, contentWidth);
    curY += 10;

    const mapRows = mapeo.map((m: MapeoRow) => [
      `${m.semester}° Sem`,
      safeStr(m.uacName),
      safeStr(m.topic),
      safeStr(m.linking),
    ]);

    autoTable(doc, {
      startY: curY,
      head: [
        [
          { content: 'Sem', styles: { halign: 'center', cellWidth: 16 } },
          { content: 'UAC Participante', styles: { cellWidth: 42 } },
          { content: 'Tema / Aprendizaje Esencial', styles: { cellWidth: 50 } },
          { content: 'Vinculación con el PEC', styles: { cellWidth: contentWidth - 108 } },
        ],
      ],
      body: mapRows,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak' },
      headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: {
        0: { halign: 'center', fontStyle: 'bold', fillColor: GRAY_BG },
        1: { fontStyle: 'bold' },
      },
      margin: { left: margin, right: margin },
    });
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // PÁGINA: CRONOGRAMA DE ETAPAS MACRO
  // ═════════════════════════════════════════════════════════════════════════════

  const crono = project.fase2Cronograma;
  if (crono && crono.length > 0) {
    doc.addPage();
    curY = 24;

    addSectionHeader(doc, 'IV. CRONOGRAMA GENERAL Y ETAPAS DEL PEC', curY, margin, contentWidth);
    curY += 10;

    const cronoRows = crono.map((c: CronogramaRow) => [
      safeStr(c.phase),
      safeStr(c.objective),
      safeStr(c.macroActivities),
      safeStr(c.responsibleSubjects),
      safeStr(c.semesterInvolved),
    ]);

    autoTable(doc, {
      startY: curY,
      head: [
        [
          { content: 'Fase / Etapa', styles: { cellWidth: 32 } },
          { content: 'Objetivo Operativo', styles: { cellWidth: 42 } },
          { content: 'Macroactividades', styles: { cellWidth: 46 } },
          { content: 'Responsables', styles: { cellWidth: 38 } },
          { content: 'Semestres', styles: { halign: 'center', cellWidth: contentWidth - 158 } },
        ],
      ],
      body: cronoRows,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak' },
      headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: {
        0: { fontStyle: 'bold', fillColor: GRAY_BG },
        4: { halign: 'center' },
      },
      margin: { left: margin, right: margin },
    });
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // PÁGINA: PLAN OPERATIVO POR UAC (CRONOGRAMA DE AULA)
  // ═════════════════════════════════════════════════════════════════════════════

  const planOp = project.fase2PlanOperativo;
  const rowsSemA = planOp?.semestreA || [];
  const rowsSemB = planOp?.semestreB || [];

  if (rowsSemA.length > 0 || rowsSemB.length > 0) {
    doc.addPage();
    curY = 24;

    addSectionHeader(doc, 'V. PLAN OPERATIVO Y CRONOGRAMA DE AULA', curY, margin, contentWidth);
    curY += 10;

    if (rowsSemA.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...NAVY);
      doc.text('5.1 ACTIVIDADES Y PROGRESIONES — SEMESTRE A (1°, 3° y 5° SEMESTRES)', margin, curY);
      curY += 4;

      const bodyA = rowsSemA.map((r: PlanOperativoRow) => [
        safeStr(r.uac),
        safeStr(r.progression),
        safeStr(r.activity),
        safeStr(r.week),
        safeStr(r.responsibles),
        safeStr(r.evaluationInstrument),
      ]);

      autoTable(doc, {
        startY: curY,
        head: [
          [
            { content: 'UAC', styles: { cellWidth: 32 } },
            { content: 'Progresión MCCEMS', styles: { cellWidth: 36 } },
            { content: 'Actividad Específica', styles: { cellWidth: 44 } },
            { content: 'Semana', styles: { halign: 'center', cellWidth: 16 } },
            { content: 'Docente / Resp.', styles: { cellWidth: 30 } },
            { content: 'Instrumento', styles: { cellWidth: contentWidth - 158 } },
          ],
        ],
        body: bodyA,
        theme: 'grid',
        styles: { fontSize: 6.5, cellPadding: 1.8, overflow: 'linebreak' },
        headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold' },
        columnStyles: {
          0: { fontStyle: 'bold', fillColor: GRAY_BG },
          3: { halign: 'center' },
        },
        margin: { left: margin, right: margin },
      });
      // @ts-expect-error autoTable adds lastAutoTable to jsPDF instance
      curY = doc.lastAutoTable.finalY + 6;
    }

    if (rowsSemB.length > 0) {
      if (curY > pageHeight - 60) {
        doc.addPage();
        curY = 24;
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...NAVY);
      doc.text('5.2 ACTIVIDADES Y PROGRESIONES — SEMESTRE B (2°, 4° y 6° SEMESTRES)', margin, curY);
      curY += 4;

      const bodyB = rowsSemB.map((r: PlanOperativoRow) => [
        safeStr(r.uac),
        safeStr(r.progression),
        safeStr(r.activity),
        safeStr(r.week),
        safeStr(r.responsibles),
        safeStr(r.evaluationInstrument),
      ]);

      autoTable(doc, {
        startY: curY,
        head: [
          [
            { content: 'UAC', styles: { cellWidth: 32 } },
            { content: 'Progresión MCCEMS', styles: { cellWidth: 36 } },
            { content: 'Actividad Específica', styles: { cellWidth: 44 } },
            { content: 'Semana', styles: { halign: 'center', cellWidth: 16 } },
            { content: 'Docente / Resp.', styles: { cellWidth: 30 } },
            { content: 'Instrumento', styles: { cellWidth: contentWidth - 158 } },
          ],
        ],
        body: bodyB,
        theme: 'grid',
        styles: { fontSize: 6.5, cellPadding: 1.8, overflow: 'linebreak' },
        headStyles: { fillColor: BLUE_MID, textColor: [255, 255, 255], fontStyle: 'bold' },
        columnStyles: {
          0: { fontStyle: 'bold', fillColor: GRAY_BG },
          3: { halign: 'center' },
        },
        margin: { left: margin, right: margin },
      });
    }
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // PÁGINA FINAL: ANEXOS TÉCNICOS Y FIRMAS OFICIALES REGLAMENTARIAS
  // ═════════════════════════════════════════════════════════════════════════════

  doc.addPage();
  curY = 24;

  addSectionHeader(doc, 'VI. PROTOCOLO DE EVALUACIÓN Y VALIDACIÓN OFICIAL', curY, margin, contentWidth);
  curY += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_DARK);
  const protoText = 'El presente Proyecto Escolar Comunitario ha sido diseñado colegiadamente por el personal docente y directivo del plantel escolar, en concordancia con los planes de estudio del Marco Curricular Común de la Educación Media Superior (MCCEMS) y los lineamientos operativos de la Dirección de Bachilleratos Estatales y Preparatoria Abierta de la SEP del Estado de Puebla.';
  const splitProto = doc.splitTextToSize(protoText, contentWidth);
  doc.text(splitProto, margin, curY);
  curY += splitProto.length * 3.6 + 6;

  // Cuadro Síntesis de Anexos
  autoTable(doc, {
    startY: curY,
    head: [
      [
        {
          content: 'CARPETA DE ANEXOS E INSTRUMENTOS TÉCNICOS DEL PAEC',
          colSpan: 3,
          styles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        },
      ],
      [
        { content: 'Instrumento', styles: { cellWidth: 35 } },
        { content: 'Propósito Evaluativo', styles: { cellWidth: 90 } },
        { content: 'Estatus', styles: { halign: 'center', cellWidth: contentWidth - 125 } },
      ],
    ],
    body: [
      ['Anexo 1: Minuta de Acuerdos', 'Registro formal de acuerdos tomados en sesión colegiada del CTE.', 'Integrado en Expediente'],
      ['Anexo 2: Matriz de Seguimiento', 'Semáforo semanal de avance de actividades por UAC participante.', 'Operativo'],
      ['Anexo 3: Reporte Mensual', 'Resumen ejecutivo de logros, dificultades y ajustes curriculares.', 'Programado'],
      ['Anexo 4: Encuesta Comunitaria', 'Instrumento Likert para medir el impacto social directo en la localidad.', 'Diseñado'],
      ['Anexo 5: Autoevaluación Alumnos', 'Rúbrica reflexiva para valorar aprendizajes significativos en estudiantes.', 'Diseñado'],
      ['Anexo 6: Evaluación Colectivo', 'Valoración interna del trabajo docente y articulación multidisciplinaria.', 'Diseñado'],
    ],
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak' },
    headStyles: { fillColor: BLUE_MID, textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: GRAY_BG },
      2: { halign: 'center', fontStyle: 'italic' },
    },
    margin: { left: margin, right: margin },
  });

  // @ts-expect-error autoTable adds lastAutoTable to jsPDF instance
  curY = doc.lastAutoTable.finalY + 16;

  // Bloque Oficial de Firmas Tripartitas (Puebla DBEPA)
  if (curY > pageHeight - 65) {
    doc.addPage();
    curY = 35;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...NAVY);
  doc.text('ACREDITACIÓN Y FORMALIZACIÓN INSTITUCIONAL', pageWidth / 2, curY, { align: 'center' });
  curY += 8;

  const colW = (contentWidth - 12) / 3;
  const col1X = margin;
  const col2X = margin + colW + 6;
  const col3X = margin + (colW + 6) * 2;
  const lineY = curY + 22;

  // Línea 1: Elaboró
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.5);
  doc.line(col1X + 4, lineY, col1X + colW - 4, lineY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...TEXT_DARK);
  doc.text('ELABORÓ', col1X + colW / 2, lineY + 4, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(safeStr(teacherName, 'Docente Coordinador'), col1X + colW / 2, lineY + 8, { align: 'center' });
  doc.setTextColor(...TEXT_MUTED);
  doc.text('Coordinador del Proyecto PAEC', col1X + colW / 2, lineY + 11.5, { align: 'center' });

  // Línea 2: Revisó
  doc.line(col2X + 4, lineY, col2X + colW - 4, lineY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...TEXT_DARK);
  doc.text('REVISÓ', col2X + colW / 2, lineY + 4, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('COLECTIVO DOCENTE', col2X + colW / 2, lineY + 8, { align: 'center' });
  doc.setTextColor(...TEXT_MUTED);
  doc.text('Consejo Técnico Escolar (CTE)', col2X + colW / 2, lineY + 11.5, { align: 'center' });

  // Línea 3: Validó
  doc.line(col3X + 4, lineY, col3X + colW - 4, lineY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...TEXT_DARK);
  doc.text('VALIDÓ Y AUTORIZÓ', col3X + colW / 2, lineY + 4, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('DIRECCIÓN DEL PLANTEL', col3X + colW / 2, lineY + 8, { align: 'center' });
  doc.setTextColor(...TEXT_MUTED);
  doc.text('Supervisión de Zona Escolar 004', col3X + colW / 2, lineY + 11.5, { align: 'center' });

  // ═════════════════════════════════════════════════════════════════════════════
  // ENCABEZADOS Y PIES DE PÁGINA GLOBALES (EXCEPTO PORTADA)
  // ═════════════════════════════════════════════════════════════════════════════

  addOfficialLetterheadAndFooter(doc, project.projectName, logos);

  const arrayBuffer = doc.output('arraybuffer');
  return Buffer.from(arrayBuffer);
}

/**
 * Añade la barra de título de sección estilizada
 */
function addSectionHeader(
  doc: jsPDF,
  title: string,
  y: number,
  x: number,
  width: number
): void {
  doc.setFillColor(...NAVY);
  doc.rect(x, y - 4.5, 3.5, 7, 'F');

  doc.setFillColor(...GRAY_BG);
  doc.rect(x + 3.5, y - 4.5, width - 3.5, 7, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text(title, x + 7, y);

  doc.setDrawColor(...GOLD_LINE);
  doc.setLineWidth(0.5);
  doc.line(x, y + 3, x + width, y + 3);
}

/**
 * Aplica el membrete superior institucional y pie de página en páginas 2..N
 */
function addOfficialLetterheadAndFooter(
  doc: jsPDF,
  projectName: string,
  logos: { sep?: string; supervision?: string }
): void {
  const totalPages = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  for (let i = 2; i <= totalPages; i++) {
    doc.setPage(i);

    // Membrete superior
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...NAVY);
    doc.text('SEP · GOBIERNO DEL ESTADO DE PUEBLA · DIRECCIÓN DE BACHILLERATOS ESTATALES (DBEPA)', margin, 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...TEXT_MUTED);
    const projLabel = `PAEC: ${projectName}`;
    const truncatedProj = projLabel.length > 70 ? projLabel.substring(0, 67) + '...' : projLabel;
    doc.text(truncatedProj, margin, 13.5);

    // Línea de separación superior dorada
    doc.setDrawColor(...GOLD_LINE);
    doc.setLineWidth(0.4);
    doc.line(margin, 15, pageWidth - margin, 15);

    // Mini logotipos en encabezado
    if (logos.sep) {
      try {
        const fmt = logos.sep.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG';
        doc.addImage(logos.sep, fmt, pageWidth - margin - 22, 6.5, 20, 5.5);
      } catch {}
    }

    // Pie de página
    doc.setDrawColor(220, 224, 230);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(
      `Proyecto Escolar Comunitario (PEC) — Programa Aula, Escuela y Comunidad · Ciclo Escolar ${SCHOOL_YEAR}`,
      margin,
      pageHeight - 8
    );

    const pageStr = `Página ${i} de ${totalPages}`;
    doc.text(pageStr, pageWidth - margin, pageHeight - 8, { align: 'right' });
  }
}
