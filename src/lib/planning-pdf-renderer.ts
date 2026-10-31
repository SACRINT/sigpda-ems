/**
 * planning-pdf-renderer.ts — Generador PDF de Planeación Didáctica Oficial (SEP Puebla - MCCEMS)
 * SIGPDA-EMS · Formato Oficial Carta (215.9mm x 279.4mm) con Membrete y Logotipos Oficiales
 */

import jsPDF from 'jspdf';
import autoTable, { RowInput } from 'jspdf-autotable';
import type { GeneratedPlanningContent, Planning, SecuenciaBloque } from '@/types/planning';
import type { ActiveWorkTextbook } from '@/types/work-textbook';
import { loadAllLogos } from './pdf-logos';
import { SCHOOL_YEAR } from '@/lib/config';
import { logger } from './logger';
import { COLORS } from './visual-engine/design-tokens';
import {
  loadEditorialFonts,
  setFontHeading,
  setFontBody,
  setFontCaption,
} from './visual-engine/font-loader';
import { normalizeEvaluationPercentages, sanitizePlanningContent } from '@/lib/planning/quality-pipeline';
import { DEFAULT_UAC_WEEKLY_HOURS, normalizeUacKey } from '@/lib/planning/uac-hours-catalog';
import { buildFullSequenceFromWorkbooks } from '@/lib/planning/workbook-sequence-sync';
import { stripMaterialTokens } from '@/lib/materials/material-tokens';
import { resolveSchoolIdentity, resolverIdentidadEscolar, CCT_NO_REGISTRADO } from '@/lib/school-identity';

const NAVY: [number, number, number] = [31, 56, 100];       // #1F3864 - Azul Institucional
const BLUE_MID: [number, number, number] = [46, 116, 181];   // #2E74B5 - Azul Secundario
const GOLD_LINE: [number, number, number] = [232, 160, 32];  // #E8A020 - Dorado Oficial SEP
const GRAY_BG: [number, number, number] = [242, 244, 248];   // #F2F4F8 - Fondo Filas
const TEXT_DARK: [number, number, number] = [30, 41, 59];    // #1E293B - Texto

// Colores institucionales de fases didácticas (homologados MCCEMS vía design-tokens)
const { PHASE_APERTURA, PHASE_DESARROLLO, PHASE_CIERRE } = COLORS;

function resolveCanonicalHours(
  uacName: string,
  s1TotalHours?: number,
  s1WeeklyHours?: number
): { totalHours: number; weeklyHours: number } {
  const norm = normalizeUacKey(uacName);
  let catalogWeekly = 0;
  for (const [key, hrs] of Object.entries(DEFAULT_UAC_WEEKLY_HOURS)) {
    if (norm.includes(key)) {
      catalogWeekly = hrs;
      break;
    }
  }
  const totalHours =
    s1TotalHours && s1TotalHours > 0
      ? s1TotalHours
      : catalogWeekly > 0
        ? catalogWeekly * 18
        : 72;
  const weeklyHours =
    s1WeeklyHours && s1WeeklyHours > 0
      ? s1WeeklyHours
      : catalogWeekly > 0
        ? catalogWeekly
        : Math.round(totalHours / 18);
  return { totalHours, weeklyHours };
}

export async function generatePlanningPDF(
  planning: Planning,
  providedLogos?: { gobierno?: string; sep?: string; supervision?: string }
): Promise<jsPDF> {
  const rawPlan = planning as unknown as Record<string, unknown>;
  const rawContent = (planning.contentJson || rawPlan.content_json) as GeneratedPlanningContent | null;
  const rawSequenceData = (planning.sequenceJson || rawPlan.sequence_json) as Record<number, SecuenciaBloque> | null | undefined;
  const rawWorkbooks = (rawPlan.workbooks_json || rawPlan.workbooksJson) as
    | Record<string, { current?: ActiveWorkTextbook } | ActiveWorkTextbook | undefined>
    | null
    | undefined;
  const identidadPrevia = resolverIdentidadEscolar({
    schoolName: rawContent?.sectionI?.schoolName,
    cct: rawContent?.sectionI?.cct,
    schoolZone: rawContent?.sectionI?.schoolZone,
  });
  const content = rawContent
    ? sanitizePlanningContent(rawContent, { fallbackCct: identidadPrevia.cct || CCT_NO_REGISTRADO })
    : null;
  const s1 = content?.sectionI;
  const s2 = content?.sectionII;
  const s3 = content?.sectionIII;
  const s4 = content?.sectionIV;
  const s5 = content?.sectionV;
  const sequenceData = rawWorkbooks
    ? buildFullSequenceFromWorkbooks(rawWorkbooks, s4?.activities, rawSequenceData)
    : rawSequenceData;
  const identidad = resolveSchoolIdentity({ sectionI: s1 });

  const rawUacName = String(
    planning.uacName || rawPlan.uac_name || s1?.uacName || 'Asignatura no especificada'
  );
  const semesterVal = Number(planning.semester ?? rawPlan.semester ?? s1?.semester ?? 1) || 1;
  const isUac = semesterVal >= 5;
  const subjectLabel = isUac ? 'Unidad de Aprendizaje (UAC):' : 'Asignatura:';
  const rawComponent = String(planning.component || rawPlan.component || s1?.component || '');

  // Cargar logotipos en Base64 si no fueron suministrados
  const logos = providedLogos || (await loadAllLogos());

  // Formato Carta exacto: 215.9mm x 279.4mm (Letter)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter',
  });

  // Inicializar fuentes editoriales oficiales (Lato Regular/Bold + Montserrat Bold)
  loadEditorialFonts(doc);

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
        const fmt = logos.gobierno.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG';
        doc.addImage(logos.gobierno, fmt, margin, currentY, 34, 14.6);
      } catch (err) {
        logger.warn('[PDF-Gen] Error insertando logo Gobierno en PDF:', { error: err });
      }
    }

    // Logo Centro: SEP Puebla (w: 30mm, h: 8.6mm, aspect ~3.48)
    if (logos.sep) {
      try {
        const fmt = logos.sep.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG';
        doc.addImage(logos.sep, fmt, (pageWidth - 30) / 2, currentY - 1, 30, 8.6);
      } catch (err) {
        logger.warn('[PDF-Gen] Error insertando logo SEP en PDF:', { error: err });
      }
    }

    // Logo Derecho: Supervisión Escolar (logo institucional genérico; w: 30mm, h: 11.6mm, aspect ~2.57)
    if (logos.supervision) {
      try {
        const fmt = logos.supervision.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG';
        doc.addImage(logos.supervision, fmt, pageWidth - margin - 30, currentY, 30, 11.6);
      } catch (err) {
        logger.warn('[PDF-Gen] Error insertando logo Supervisión en PDF:', { error: err });
      }
    }

    // 2. Jerarquía Institucional de Texto Oficial Centrado
    currentY += 9;
    setFontHeading(doc);
    doc.setFontSize(8.5);
    doc.setTextColor(...NAVY);
    doc.text('SECRETARÍA DE EDUCACIÓN', pageWidth / 2, currentY, { align: 'center' });
    currentY += 3.4;

    doc.setFontSize(7.5);
    setFontBody(doc, 'normal');
    doc.setTextColor(...TEXT_DARK);
    doc.text('SUBSECRETARÍA DE EDUCACIÓN OBLIGATORIA', pageWidth / 2, currentY, { align: 'center' });
    currentY += 3.1;

    doc.setFontSize(7);
    doc.text('DIRECCIÓN GENERAL DE EDUCACIÓN BÁSICA SEGUNDO NIVEL', pageWidth / 2, currentY, { align: 'center' });
    currentY += 3.1;

    doc.text('DIRECCIÓN DE BACHILLERATOS ESTATALES Y PREPARATORIA ABIERTA', pageWidth / 2, currentY, { align: 'center' });
    currentY += 3.4;

    setFontHeading(doc);
    doc.setFontSize(8);
    doc.setTextColor(...NAVY);
    doc.text(identidad.supervision, pageWidth / 2, currentY, { align: 'center' });
    currentY += 3.1;

    const cctPlantel = identidad.cct;
    setFontCaption(doc, 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...BLUE_MID);
    doc.text(`CCT: ${cctPlantel}`, pageWidth / 2, currentY, { align: 'center' });

    currentY += 3.4;

    setFontHeading(doc);
    doc.setFontSize(8.5);
    doc.setTextColor(...NAVY);
    doc.text('INSTRUMENTO DE PLANEACIÓN DIDÁCTICA OFICIAL (MCCEMS NEM)', pageWidth / 2, currentY, { align: 'center' });
    currentY += 3.2;

    // 3. Línea divisora dorada (#E8A020)
    doc.setDrawColor(...GOLD_LINE);
    doc.setLineWidth(1.0);
    doc.line(margin, currentY, pageWidth - margin, currentY);
    currentY += 3.0;
  };

  drawOfficialHeader();

  // ─── Sección I: Datos Generales ──────────────────────────────────────────
  const { totalHours: totalHoursVal, weeklyHours: weeklyHoursVal } = resolveCanonicalHours(
    rawUacName,
    s1?.totalHours,
    s1?.totalHoursWeekly
  );
  autoTable(doc, {
    startY: currentY,
    head: [[{ content: 'I. DATOS DE IDENTIFICACIÓN INSTITUCIONAL Y CURRICULAR', colSpan: 4, styles: { fillColor: NAVY, fontStyle: 'bold', halign: 'left', textColor: [255, 255, 255] } }]],
    body: [
      [
        { content: 'Plantel / Escuela:', styles: { fontStyle: 'bold', fillColor: GRAY_BG, cellWidth: 35 } },
        { content: identidad.schoolName, styles: { cellWidth: 58 } },
        { content: 'Clave C.C.T.:', styles: { fontStyle: 'bold', fillColor: GRAY_BG, cellWidth: 25 } },
        { content: identidad.cct, styles: { cellWidth: 68 } },
      ],
      [
        { content: 'Docente Titular:', styles: { fontStyle: 'bold', fillColor: GRAY_BG } },
        { content: s1?.teacherName || 'Docente Responsable' },
        { content: 'Semestre / Grupo:', styles: { fontStyle: 'bold', fillColor: GRAY_BG } },
        { content: `${semesterVal}° Semestre · ${s1?.groups || 'Grupos Únicos'}` },
      ],
      [
        { content: subjectLabel, styles: { fontStyle: 'bold', fillColor: GRAY_BG } },
        { content: rawUacName, styles: { fontStyle: 'bold', textColor: NAVY } },
        { content: 'Componente:', styles: { fontStyle: 'bold', fillColor: GRAY_BG } },
        { content: rawComponent.toLowerCase().includes('laboral') ? 'Formación Laboral' : 'Fundamental / Ampliado' },
      ],
      [
        { content: 'Horas Semanales / Totales:', styles: { fontStyle: 'bold', fillColor: GRAY_BG } },
        { content: `${weeklyHoursVal > 0 ? weeklyHoursVal : '—'} hrs/sem · ${totalHoursVal > 0 ? totalHoursVal : '—'} hrs/semestre` },
        { content: 'Periodo de Aplicación:', styles: { fontStyle: 'bold', fillColor: GRAY_BG } },
        { content: s1?.applicationPeriod || s1?.period || `Semestre ${SCHOOL_YEAR}` },
      ],
    ],
    theme: 'grid',
    styles: { fontSize: 6.5, cellPadding: 1.4, textColor: TEXT_DARK },
    margin: { left: margin, right: margin },
  });

  currentY = doc.lastAutoTable!.finalY + 2.5;

  // ─── Sección II: Meta educativa, propósitos y contenidos formativos ───────
  const activities = s4?.activities || [];
  const propositosFormativos = (s2?.learningOutcomes ?? [])
    .map((p, index) => `${index + 1}. ${p}`)
    .join('\n');
  const contenidosFormativos = activities
    .map((act, index) => `${index + 1}. ${act.name || `Bloque ${index + 1}`}: ${act.contenidoFormativo || 'No especificado'}`)
    .join('\n');
  const rawPaecContext = String(planning.paecContext || rawPlan.paec_context || '');

  autoTable(doc, {
    startY: currentY,
    head: [[{ content: 'II. META EDUCATIVA, PROPÓSITOS FORMATIVOS Y CONTENIDOS FORMATIVOS', colSpan: 2, styles: { fillColor: NAVY, fontStyle: 'bold', textColor: [255, 255, 255] } }]],
    body: [
      [
        { content: 'Meta educativa:', styles: { fontStyle: 'bold', fillColor: GRAY_BG, cellWidth: 42 } },
        { content: s2?.purpose || 'Desarrollar competencias integrales mediante metodologías activas y pensamiento crítico.' },
      ],
      [
        { content: 'Propósitos Formativos:', styles: { fontStyle: 'bold', fillColor: GRAY_BG } },
        { content: propositosFormativos || 'Alcanzar los propósitos formativos establecidos en el MCCEMS.' },
      ],
      [
        { content: 'Contenidos Formativos:', styles: { fontStyle: 'bold', fillColor: GRAY_BG } },
        { content: contenidosFormativos || 'Contenidos formativos establecidos en el programa de estudio.' },
      ],
      [
        { content: 'Problemática Central / Contexto:', styles: { fontStyle: 'bold', fillColor: GRAY_BG } },
        { content: s2?.paecConnection || rawPaecContext || 'Contextualización a las necesidades socioformativas de la comunidad.' },
      ],
    ],
    theme: 'grid',
    styles: { fontSize: 6.5, cellPadding: 1.4, textColor: TEXT_DARK },
    margin: { left: margin, right: margin },
  });

  currentY = doc.lastAutoTable!.finalY + 2.5;

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
        { content: s2?.paecConnection || rawPaecContext || 'Articulación con el Programa de Trabajo Comunitario del Plantel.' },
      ],
      [
        { content: 'Transversalidad Interdisciplinar:', styles: { fontStyle: 'bold', fillColor: GRAY_BG } },
        { content: transItems.length > 0 ? transItems.join('\n') : 'Cultura Digital, Lengua y Comunicación, Conciencia Histórica, Pensamiento Matemático.' },
      ],
    ],
    theme: 'grid',
    styles: { fontSize: 6.5, cellPadding: 1.4, textColor: TEXT_DARK },
    margin: { left: margin, right: margin },
  });

  currentY = doc.lastAutoTable!.finalY + 2.5;

  // ─── Sección IV: Secuencia Didáctica por Momentos ─────────────────────────
  activities.forEach((act, idx) => {
    const macroRows: RowInput[] = [];

    macroRows.push([
      { content: 'Contenido Formativo:', styles: { fontStyle: 'bold', fillColor: [241, 245, 249], cellWidth: 38 } },
      { content: act.contenidoFormativo || 'No especificado' },
    ]);

    // Saberes curriculares vinculados al contenido formativo
    if (act.saberes && (act.saberes.saber || act.saberes.saberHacer || act.saberes.saberSer)) {
      macroRows.push([
        { content: 'Saber (Teórico):', styles: { fontStyle: 'bold', fillColor: [241, 245, 249], cellWidth: 38 } },
        { content: act.saberes.saber || 'No especificado' },
      ]);
      macroRows.push([
        { content: 'Saber Hacer (Práctico):', styles: { fontStyle: 'bold', fillColor: [241, 245, 249], cellWidth: 38 } },
        { content: act.saberes.saberHacer || 'No especificado' },
      ]);
      macroRows.push([
        { content: 'Saber Ser (Actitudinal):', styles: { fontStyle: 'bold', fillColor: [241, 245, 249], cellWidth: 38 } },
        { content: act.saberes.saberSer || 'No especificado' },
      ]);
    }

    // Apertura
    macroRows.push([
      { content: 'Apertura (Exploración):', styles: { fontStyle: 'bold', fillColor: GRAY_BG, cellWidth: 38 } },
      { content: `${act.apertura?.activities || 'Recuperación de conocimientos previos.'}\nMateriales: ${stripMaterialTokens(act.apertura?.materials || 'Cuaderno, pizarrón.')}` },
    ]);

    // Desarrollo
    macroRows.push([
      { content: 'Desarrollo (Construcción):', styles: { fontStyle: 'bold', fillColor: GRAY_BG, cellWidth: 38 } },
      { content: `${act.ejecucion?.activities || 'Investigación, análisis y aplicación.'}\nMateriales: ${stripMaterialTokens(act.ejecucion?.materials || 'Guías, dispositivos.')}` },
    ]);

    // Cierre
    macroRows.push([
      { content: 'Cierre (Metacognición):', styles: { fontStyle: 'bold', fillColor: GRAY_BG, cellWidth: 38 } },
      { content: `${act.conclusion?.activities || 'Socialización de evidencias y síntesis.'}\nMateriales: ${stripMaterialTokens(act.conclusion?.materials || 'Instrumentos de evaluación.')}` },
    ]);

    const macroHead: RowInput[] = [];
    if (idx === 0) {
      macroHead.push([
        {
          content: 'IV. SECUENCIA DIDÁCTICA DETALLADA POR MOMENTOS FORMATIVOS',
          colSpan: 2,
          styles: { fillColor: NAVY, fontStyle: 'bold', textColor: [255, 255, 255] },
        },
      ]);
    }
    macroHead.push([
      {
        content: `Bloque / Actividad ${idx + 1}: ${act.name} (${act.hours || 18} Horas) — Metodología: ${act.methodology || 'ABP'}`,
        colSpan: 2,
        styles: { fillColor: BLUE_MID, textColor: [255, 255, 255], fontStyle: 'bold' },
      },
    ]);

    autoTable(doc, {
      startY: currentY,
      head: macroHead,
      body: macroRows,
      theme: 'grid',
      styles: { fontSize: 6.3, cellPadding: 1.4, textColor: TEXT_DARK },
      margin: { left: margin, right: margin },
      pageBreak: 'auto',
      rowPageBreak: 'avoid',
    });

    currentY = doc.lastAutoTable!.finalY;

    // Micro-Sesiones de 50 min (Tabla independiente de 4 columnas con sus propios títulos)
    const blockSeq = sequenceData?.[idx];
    if (blockSeq && blockSeq.sessions && blockSeq.sessions.length > 0) {
      const sessionRows: RowInput[] = blockSeq.sessions.map((s) => {
        const isAp = s.phase === 'Apertura';
        const isDes = s.phase === 'Desarrollo';
        const phaseName = isAp ? 'Apertura' : isDes ? 'Desarrollo' : 'Cierre';
        const phaseColor = isAp ? PHASE_APERTURA : isDes ? PHASE_DESARROLLO : PHASE_CIERRE;
        const total = s.totalSessions ?? blockSeq.sessions.length;
        return [
          { content: `S${s.sessionNum}/${total}\n[${phaseName}]`, styles: { fontStyle: 'bold', cellWidth: 22, fontSize: 5.8, textColor: phaseColor, halign: 'center' } },
          { content: s.title, styles: { fontStyle: 'bold', fontSize: 6, cellWidth: 42 } },
          { content: s.teachingActivity, styles: { fontSize: 5.8 } },
          { content: `${s.learningActivity}${s.evidence ? `\nEvidencia: ${s.evidence}` : ''}`, styles: { fontSize: 5.8 } },
        ];
      });

      autoTable(doc, {
        startY: currentY,
        head: [
          [
            {
              content: `Sesiones de 50 minutos — ${blockSeq.sessions.length} sesiones totales`,
              colSpan: 4,
              styles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontStyle: 'bold', fontSize: 6.5 },
            },
          ],
          [
            { content: 'Sesión / Fase', styles: { fontStyle: 'bold', fillColor: [226, 232, 240], textColor: NAVY, fontSize: 6, cellWidth: 22, halign: 'center' } },
            { content: 'Título / Tema Situado', styles: { fontStyle: 'bold', fillColor: [226, 232, 240], textColor: NAVY, fontSize: 6, cellWidth: 42 } },
            { content: 'Actividades del Docente (Enseñanza)', styles: { fontStyle: 'bold', fillColor: [226, 232, 240], textColor: NAVY, fontSize: 6 } },
            { content: 'Actividades del Estudiante y Evidencia Formativa', styles: { fontStyle: 'bold', fillColor: [226, 232, 240], textColor: NAVY, fontSize: 6 } },
          ],
        ],
        body: sessionRows,
        theme: 'grid',
        styles: { fontSize: 6.3, cellPadding: 1.4, textColor: TEXT_DARK },
        margin: { left: margin, right: margin },
        pageBreak: 'auto',
        rowPageBreak: 'avoid',
      });

      currentY = doc.lastAutoTable!.finalY + 2.5;
    } else {
      currentY += 2.5;
    }
  });

  // ─── Sección V: Evaluación y Ponderaciones (Normalización Determinista 100%) ───
  const normalizedEvaluations = normalizeEvaluationPercentages(s5?.evaluations);
  const evalRows = normalizedEvaluations.map((ev) => [
    { content: (ev.moment || 'Formativa').replace(/\bUAC\b/g, isUac ? 'UAC' : 'Asignatura') },
    { content: `${ev.type || 'Formativa'} / ${ev.agent || 'Heteroevaluación'}` },
    { content: ev.evidence || 'Producto de aprendizaje' },
    { content: ev.instrument || 'Rúbrica analítica' },
    { content: `${ev.percentage}%` },
  ]);
  const heteroSummary = normalizedEvaluations
    .filter((ev) => /hetero/i.test(ev.agent ?? ''))
    .map((ev) => `${ev.type} ${ev.percentage}% (${ev.instrument})`)
    .join('; ');
  const autoCoSummary = normalizedEvaluations
    .filter((ev) => /(auto|co)evaluaci/i.test(ev.agent ?? ''))
    .map((ev) => `${ev.type} ${ev.percentage}% (${ev.instrument})`)
    .join('; ');
  const ponderacionSummary = normalizedEvaluations
    .map((ev) => `${ev.type} ${ev.percentage}%`)
    .join(' · ');

  if (evalRows.length > 0) {
    autoTable(doc, {
      startY: currentY,
      head: [
        [{ content: 'V. EVALUACIÓN FORMATIVA, HETEROEVALUACIÓN Y PONDERACIÓN', colSpan: 5, styles: { fillColor: NAVY, fontStyle: 'bold', textColor: [255, 255, 255] } }],
        ['Momento', 'Tipo / Agente', 'Evidencia / Producto', 'Instrumento', 'Pond.'].map((h) => ({ content: h, styles: { fillColor: BLUE_MID, textColor: [255, 255, 255], fontStyle: 'bold' } })),
      ],
      body: evalRows,
      theme: 'grid',
      styles: { fontSize: 6.3, cellPadding: 1.4, textColor: TEXT_DARK },
      margin: { left: margin, right: margin },
      pageBreak: 'avoid',
    });

    currentY = doc.lastAutoTable!.finalY + 2.5;
  }

  autoTable(doc, {
    startY: currentY,
    head: [[{ content: 'V.1 AGENTES, HETEROEVALUACIÓN Y PONDERACIÓN', colSpan: 2, styles: { fillColor: NAVY, fontStyle: 'bold', textColor: [255, 255, 255] } }]],
    body: [
      [
        { content: 'Heteroevaluación:', styles: { fontStyle: 'bold', fillColor: GRAY_BG, cellWidth: 42 } },
        { content: heteroSummary || 'No especificada' },
      ],
      [
        { content: 'Autoevaluación / Coevaluación:', styles: { fontStyle: 'bold', fillColor: GRAY_BG } },
        { content: autoCoSummary || 'No especificada' },
      ],
      [
        { content: 'Ponderación:', styles: { fontStyle: 'bold', fillColor: GRAY_BG } },
        { content: ponderacionSummary || 'No especificada' },
      ],
    ],
    theme: 'grid',
    styles: { fontSize: 6.5, cellPadding: 1.4, textColor: TEXT_DARK },
    margin: { left: margin, right: margin },
    pageBreak: 'avoid',
  });

  currentY = doc.lastAutoTable!.finalY + 2.5;

  // ─── Firmas Oficiales Tripartitas (Docente / Director / Supervisión) ─────
  autoTable(doc, {
    startY: currentY,
    head: [[{ content: 'VALIDACIÓN Y AUTORIZACIÓN OFICIAL DE LA PLANEACIÓN', colSpan: 3, styles: { fillColor: NAVY, fontStyle: 'bold', halign: 'center', textColor: [255, 255, 255] } }]],
    body: [
      [
        {
          content: `\n\n___________________________________\nDOCENTE TITULAR\n${s1?.teacherName || 'Nombre y Firma del Docente'}`,
          styles: { halign: 'center', cellWidth: 62 },
        },
        {
          content: '\n\n___________________________________\nDIRECTOR(A) DEL PLANTEL\nNombre, Firma y Sello Oficial',
          styles: { halign: 'center', cellWidth: 62 },
        },
        {
          content: `\n\n___________________________________\n${identidad.supervision}\nVo. Bo. / Sello de Zona`,
          styles: { halign: 'center', cellWidth: 62 },
        },
      ],
    ],
    theme: 'plain',
    styles: { fontSize: 7, cellPadding: 1.4, textColor: TEXT_DARK },
    margin: { left: margin, right: margin },
    pageBreak: 'avoid',
  });

  // ─── Pie de Página en Todas las Hojas ─────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    setFontCaption(doc, 'normal');
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `SIGPDA-EMS · ${rawUacName} (${semesterVal}° Semestre) — Página ${i} de ${totalPages}`,
      pageWidth / 2,
      pageHeight - 6,
      { align: 'center' }
    );
  }

  return doc;
}

// Alias camelCase para compatibilidad
export const generatePlanningPdf = generatePlanningPDF;

/**
 * Generador PDF Oficial para la Secuencia Didáctica (Eslabón Micro)
 * Diseñado para entrega académica ante la Supervisión Escolar / Dirección
 */
export async function generateSecuenciaPDF(
  planning: Planning,
  providedLogos?: { gobierno?: string; sep?: string; supervision?: string }
): Promise<jsPDF> {
  const rawPlan = planning as unknown as Record<string, unknown>;
  const rawContent = (planning.contentJson || rawPlan.content_json) as GeneratedPlanningContent | null;
  const sequenceData = (planning.sequenceJson || rawPlan.sequence_json) as Record<number, SecuenciaBloque> | null | undefined;
  const identidadPrevia = resolverIdentidadEscolar({
    schoolName: rawContent?.sectionI?.schoolName,
    cct: rawContent?.sectionI?.cct,
    schoolZone: rawContent?.sectionI?.schoolZone,
  });
  const content = rawContent
    ? sanitizePlanningContent(rawContent, { fallbackCct: identidadPrevia.cct || CCT_NO_REGISTRADO })
    : null;
  const s1 = content?.sectionI;
  const s2 = content?.sectionII;
  const s4 = content?.sectionIV;
  const s5 = content?.sectionV;
  const identidad = resolveSchoolIdentity({ sectionI: s1 });

  const rawUacName = String(
    planning.uacName || rawPlan.uac_name || s1?.uacName || 'Asignatura no especificada'
  );
  const semesterVal = Number(planning.semester ?? rawPlan.semester ?? s1?.semester ?? 1) || 1;
  const isUac = semesterVal >= 5;
  const { totalHours: totalHoursVal, weeklyHours: weeklyHoursVal } = resolveCanonicalHours(
    rawUacName,
    s1?.totalHours,
    s1?.totalHoursWeekly
  );

  const logos = providedLogos || (await loadAllLogos());

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter',
  });

  // Inicializar fuentes editoriales oficiales (Lato Regular/Bold + Montserrat Bold)
  loadEditorialFonts(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  let currentY = 8;

  // Logos oficiales
  if (logos.gobierno) {
    const fmt = logos.gobierno.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG';
    try {
      doc.addImage(logos.gobierno, fmt, margin, currentY, 34, 14.6);
    } catch (e) {
      logger.warn('[PDF-Gen] Error insertando logo Gobierno en portada:', { error: e });
    }
  }
  if (logos.sep) {
    const fmt = logos.sep.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG';
    try {
      doc.addImage(logos.sep, fmt, (pageWidth - 30) / 2, currentY - 1, 30, 8.6);
    } catch (e) {
      logger.warn('[PDF-Gen] Error insertando logo SEP en portada:', { error: e });
    }
  }
  if (logos.supervision) {
    const fmt = logos.supervision.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG';
    try {
      doc.addImage(logos.supervision, fmt, pageWidth - margin - 30, currentY, 30, 11.6);
    } catch (e) {
      logger.warn('[PDF-Gen] Error insertando logo Supervisión en portada:', { error: e });
    }
  }

  currentY += 9;
  setFontHeading(doc);
  doc.setFontSize(8.5);
  doc.setTextColor(...NAVY);
  doc.text('SECRETARÍA DE EDUCACIÓN PÚBLICA DEL ESTADO DE PUEBLA', pageWidth / 2, currentY, { align: 'center' });
  currentY += 3.8;

  doc.setFontSize(7.5);
  setFontBody(doc, 'normal');
  doc.setTextColor(...TEXT_DARK);
  doc.text('SUBSECRETARÍA DE EDUCACIÓN MEDIA SUPERIOR · DIRECCIÓN DE BACHILLERATOS ESTATALES', pageWidth / 2, currentY, { align: 'center' });
  currentY += 3.4;

  setFontHeading(doc);
  doc.setFontSize(8);
  doc.setTextColor(...NAVY);
  doc.text(identidad.supervision, pageWidth / 2, currentY, { align: 'center' });
  currentY += 3.4;

  const cctPlantel = identidad.cct;
  setFontCaption(doc, 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...BLUE_MID);
  doc.text(`CCT: ${cctPlantel}`, pageWidth / 2, currentY, { align: 'center' });
  currentY += 3.8;

  doc.setFontSize(9);
  setFontHeading(doc);
  doc.setTextColor(...NAVY);
  doc.text('FORMATO OFICIAL DE SECUENCIA DIDÁCTICA (ESLABÓN MICRO)', pageWidth / 2, currentY, { align: 'center' });
  currentY += 3.4;

  doc.setFontSize(7.5);
  setFontBody(doc, 'normal');
  doc.setTextColor(...TEXT_DARK);
  doc.text(`DESGLOSE DETALLADO DE SESIONES DE 50 MINUTOS · CICLO ESCOLAR ${SCHOOL_YEAR}`, pageWidth / 2, currentY, { align: 'center' });
  currentY += 3.5;

  doc.setDrawColor(...GOLD_LINE);
  doc.setLineWidth(1.0);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 3.5;

  // Datos Generales
  autoTable(doc, {
    startY: currentY,
    head: [[{ content: isUac ? 'DATOS DE IDENTIFICACIÓN DE LA UNIDAD DE APRENDIZAJE CURRICULAR' : 'DATOS DE IDENTIFICACIÓN DE LA ASIGNATURA', colSpan: 4, styles: { fillColor: NAVY, fontStyle: 'bold', halign: 'left', textColor: [255, 255, 255] } }]],
    body: [
      [
        { content: 'Plantel:', styles: { fontStyle: 'bold', fillColor: GRAY_BG, cellWidth: 30 } },
        { content: identidad.schoolName, styles: { cellWidth: 63 } },
        { content: isUac ? 'UAC:' : 'Asignatura:', styles: { fontStyle: 'bold', fillColor: GRAY_BG, cellWidth: 35 } },
        { content: rawUacName, styles: { cellWidth: 63 } },
      ],
      [
        { content: 'Docente:', styles: { fontStyle: 'bold', fillColor: GRAY_BG } },
        { content: s1?.teacherName || 'Docente Titular' },
        { content: 'Semestre / Horas:', styles: { fontStyle: 'bold', fillColor: GRAY_BG } },
        { content: `${semesterVal}° Semestre · ${weeklyHoursVal} hrs/sem · ${totalHoursVal} Horas Totales` },
      ],
      [
        { content: 'Componente:', styles: { fontStyle: 'bold', fillColor: GRAY_BG } },
        { content: s1?.component || 'Formación Fundamental' },
        { content: 'Ciclo Escolar:', styles: { fontStyle: 'bold', fillColor: GRAY_BG } },
        { content: s1?.schoolYear || SCHOOL_YEAR },
      ],
    ],
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 1.6, textColor: TEXT_DARK },
    margin: { left: margin, right: margin },
  });

  currentY = doc.lastAutoTable!.finalY + 4;

  const activities = s4?.activities || [];
  const propositosFormativos = (s2?.learningOutcomes ?? [])
    .map((p, index) => `${index + 1}. ${p}`)
    .join('\n');
  const contenidosFormativos = activities
    .map((act, index) => `${index + 1}. ${act.name || `Bloque ${index + 1}`}: ${act.contenidoFormativo || 'No especificado'}`)
    .join('\n');

  autoTable(doc, {
    startY: currentY,
    head: [[{ content: 'II. META EDUCATIVA, PROPÓSITOS FORMATIVOS Y CONTENIDOS FORMATIVOS', colSpan: 2, styles: { fillColor: NAVY, fontStyle: 'bold', textColor: [255, 255, 255] } }]],
    body: [
      [
        { content: 'Meta educativa:', styles: { fontStyle: 'bold', fillColor: GRAY_BG, cellWidth: 42 } },
        { content: s2?.purpose || 'Desarrollar competencias integrales mediante metodologías activas y pensamiento crítico.' },
      ],
      [
        { content: 'Propósitos Formativos:', styles: { fontStyle: 'bold', fillColor: GRAY_BG } },
        { content: propositosFormativos || 'Alcanzar los propósitos formativos establecidos en el MCCEMS.' },
      ],
      [
        { content: 'Contenidos Formativos:', styles: { fontStyle: 'bold', fillColor: GRAY_BG } },
        { content: contenidosFormativos || 'Contenidos formativos establecidos en el programa de estudio.' },
      ],
    ],
    theme: 'grid',
    styles: { fontSize: 6.8, cellPadding: 1.5, textColor: TEXT_DARK },
    margin: { left: margin, right: margin },
  });

  currentY = doc.lastAutoTable!.finalY + 4;

  // Bloques y Sesiones
  activities.forEach((act, idx) => {
    const blockSeq = sequenceData?.[idx];
    const sessions = blockSeq?.sessions || [];

    const rows: RowInput[] = [];

    rows.push([
      { content: 'Contenido Formativo:', styles: { fontStyle: 'bold', fontSize: 6.5, fillColor: GRAY_BG, cellWidth: 38 } },
      { content: act.contenidoFormativo || 'No especificado', colSpan: 3, styles: { fontSize: 6.5 } },
    ]);

    // Saberes curriculares vinculados al contenido formativo
    if (act.saberes && (act.saberes.saber || act.saberes.saberHacer || act.saberes.saberSer)) {
      rows.push([
        {
          content: 'Saberes curriculares vinculados al contenido formativo',
          colSpan: 4,
          styles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontStyle: 'bold', fontSize: 7 },
        },
      ]);
      rows.push([
        { content: 'Saber (Teórico):', styles: { fontStyle: 'bold', fontSize: 6.5, fillColor: GRAY_BG, cellWidth: 38 } },
        { content: act.saberes.saber || 'N/A', colSpan: 3, styles: { fontSize: 6.5 } },
      ]);
      rows.push([
        { content: 'Saber Hacer (Práctico):', styles: { fontStyle: 'bold', fontSize: 6.5, fillColor: GRAY_BG } },
        { content: act.saberes.saberHacer || 'N/A', colSpan: 3, styles: { fontSize: 6.5 } },
      ]);
      rows.push([
        { content: 'Saber Ser (Actitudinal):', styles: { fontStyle: 'bold', fontSize: 6.5, fillColor: GRAY_BG } },
        { content: act.saberes.saberSer || 'N/A', colSpan: 3, styles: { fontSize: 6.5 } },
      ]);
    }

    if (sessions.length > 0) {
      rows.push([
        {
          content: `Sesiones Programadas (${sessions.length} sesiones de 50 minutos) — Enfoque por Momentos Formativos`,
          colSpan: 4,
          styles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontStyle: 'bold', fontSize: 7 },
        },
      ]);
      rows.push([
        { content: 'Sesión / Fase', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 6.5, cellWidth: 24, halign: 'center' } },
        { content: 'Título / Tema Situado', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 6.5, cellWidth: 42 } },
        { content: 'Actividades del Docente (Enseñanza)', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 6.5, cellWidth: 60 } },
        { content: 'Actividades del Estudiante y Evidencia Formativa', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 6.5 } },
      ]);

      sessions.forEach((s) => {
        const isAp = s.phase === 'Apertura';
        const isDes = s.phase === 'Desarrollo';
        const phaseColor = isAp ? PHASE_APERTURA : isDes ? PHASE_DESARROLLO : PHASE_CIERRE;
        rows.push([
          {
            content: `S${s.sessionNum}/${s.totalSessions ?? sessions.length}\n[${s.phase}]`,
            styles: { fontStyle: 'bold', fontSize: 6.5, halign: 'center', textColor: phaseColor },
          },
          { content: s.title, styles: { fontStyle: 'bold', fontSize: 6.5 } },
          { content: s.teachingActivity, styles: { fontSize: 6.2 } },
          { content: `${s.learningActivity}${s.evidence ? `\n\n📌 Evidencia: ${s.evidence}` : ''}`, styles: { fontSize: 6.2 } },
        ]);
      });
    } else {
      // Fallback a momentos macro si no se generó secuencia micro
      rows.push([
        { content: 'Apertura (Exploración):', styles: { fontStyle: 'bold', fillColor: GRAY_BG, cellWidth: 38, textColor: PHASE_APERTURA } },
        { content: act.apertura?.activities || 'Recuperación de conocimientos previos.', colSpan: 3 },
      ]);
      rows.push([
        { content: 'Desarrollo (Construcción):', styles: { fontStyle: 'bold', fillColor: GRAY_BG, textColor: PHASE_DESARROLLO } },
        { content: act.ejecucion?.activities || 'Construcción y análisis.', colSpan: 3 },
      ]);
      rows.push([
        { content: 'Cierre (Metacognición):', styles: { fontStyle: 'bold', fillColor: GRAY_BG, textColor: PHASE_CIERRE } },
        { content: act.conclusion?.activities || 'Síntesis y evaluación.', colSpan: 3 },
      ]);
    }

    autoTable(doc, {
      startY: currentY,
      head: [[
        {
          content: `BLOQUE / UNIDAD ${idx + 1}: ${act.name} (${act.hours || 12} HORAS) — Metodología: ${act.methodology || 'ABP'}`,
          colSpan: 4,
          styles: { fillColor: NAVY, fontStyle: 'bold', textColor: [255, 255, 255], fontSize: 7.5 },
        },
      ]],
      body: rows,
      theme: 'grid',
      styles: { fontSize: 6.5, cellPadding: 1.4, textColor: TEXT_DARK },
      margin: { left: margin, right: margin },
      pageBreak: 'auto',
      rowPageBreak: 'avoid',
    });

    currentY = doc.lastAutoTable!.finalY + 4;
  });

  // Evaluación, heteroevaluación y ponderación
  const normalizedEvaluations = normalizeEvaluationPercentages(s5?.evaluations);
  if (normalizedEvaluations.length > 0) {
    const evalRows = normalizedEvaluations.map((ev) => [
      { content: (ev.moment || 'Formativa').replace(/\bUAC\b/g, isUac ? 'UAC' : 'Asignatura') },
      { content: `${ev.type || 'Formativa'} / ${ev.agent || 'Heteroevaluación'}` },
      { content: ev.evidence || 'Producto de aprendizaje' },
      { content: ev.instrument || 'Rúbrica analítica' },
      { content: `${ev.percentage}%` },
    ]);
    const heteroSummary = normalizedEvaluations
      .filter((ev) => /hetero/i.test(ev.agent ?? ''))
      .map((ev) => `${ev.type} ${ev.percentage}% (${ev.instrument})`)
      .join('; ');
    const autoCoSummary = normalizedEvaluations
      .filter((ev) => /(auto|co)evaluaci/i.test(ev.agent ?? ''))
      .map((ev) => `${ev.type} ${ev.percentage}% (${ev.instrument})`)
      .join('; ');
    const ponderacionSummary = normalizedEvaluations
      .map((ev) => `${ev.type} ${ev.percentage}%`)
      .join(' · ');

    autoTable(doc, {
      startY: currentY,
      head: [
        [{ content: 'V. EVALUACIÓN FORMATIVA, HETEROEVALUACIÓN Y PONDERACIÓN', colSpan: 5, styles: { fillColor: NAVY, fontStyle: 'bold', textColor: [255, 255, 255] } }],
        ['Momento', 'Tipo / Agente', 'Evidencia / Producto', 'Instrumento', 'Pond.'].map((h) => ({ content: h, styles: { fillColor: BLUE_MID, textColor: [255, 255, 255], fontStyle: 'bold' } })),
      ],
      body: evalRows,
      theme: 'grid',
      styles: { fontSize: 6.5, cellPadding: 1.5, textColor: TEXT_DARK },
      margin: { left: margin, right: margin },
      pageBreak: 'avoid',
    });

    currentY = doc.lastAutoTable!.finalY + 4;

    autoTable(doc, {
      startY: currentY,
      head: [[{ content: 'AGENTES Y PONDERACIÓN', colSpan: 2, styles: { fillColor: NAVY, fontStyle: 'bold', textColor: [255, 255, 255] } }]],
      body: [
        [
          { content: 'Heteroevaluación:', styles: { fontStyle: 'bold', fillColor: GRAY_BG, cellWidth: 42 } },
          { content: heteroSummary || 'No especificada' },
        ],
        [
          { content: 'Autoevaluación / Coevaluación:', styles: { fontStyle: 'bold', fillColor: GRAY_BG } },
          { content: autoCoSummary || 'No especificada' },
        ],
        [
          { content: 'Ponderación:', styles: { fontStyle: 'bold', fillColor: GRAY_BG } },
          { content: ponderacionSummary || 'No especificada' },
        ],
      ],
      theme: 'grid',
      styles: { fontSize: 6.5, cellPadding: 1.5, textColor: TEXT_DARK },
      margin: { left: margin, right: margin },
      pageBreak: 'avoid',
    });

    currentY = doc.lastAutoTable!.finalY + 4;
  }

  if (s5?.evaluationAgreement) {
    autoTable(doc, {
      startY: currentY,
      head: [[{ content: 'ACUERDO DE EVALUACIÓN', colSpan: 2, styles: { fillColor: NAVY, fontStyle: 'bold', textColor: [255, 255, 255] } }]],
      body: [[{ content: s5.evaluationAgreement, colSpan: 2 }]],
      theme: 'grid',
      styles: { fontSize: 6.5, cellPadding: 1.5, textColor: TEXT_DARK },
      margin: { left: margin, right: margin },
      pageBreak: 'avoid',
    });

    currentY = doc.lastAutoTable!.finalY + 4;
  }

  // Firmas oficiales
  autoTable(doc, {
    startY: currentY,
    head: [[{ content: 'VALIDACIÓN INSTITUCIONAL DE LA SECUENCIA DIDÁCTICA', colSpan: 3, styles: { fillColor: NAVY, fontStyle: 'bold', halign: 'center', textColor: [255, 255, 255] } }]],
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
          content: `\n\n\n___________________________________\n${identidad.supervision}\nVo. Bo. / Sello de Zona`,
          styles: { halign: 'center', cellWidth: 62 },
        },
      ],
    ],
    theme: 'plain',
    styles: { fontSize: 7, cellPadding: 1.4, textColor: TEXT_DARK },
    margin: { left: margin, right: margin },
    pageBreak: 'avoid',
  });

  // Paginación en pie de página
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    setFontCaption(doc, 'normal');
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `SIGPDA-EMS · Secuencia Didáctica Micro · ${rawUacName} (${semesterVal}° Semestre) — Página ${i} de ${totalPages}`,
      pageWidth / 2,
      pageHeight - 6,
      { align: 'center' }
    );
  }

  return doc;
}
