import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { generatePptxBuffer } from '@/lib/presentation-engine/pptx-generator';
import { getPalette } from '@/lib/presentation-engine/slide-templates';
import type { SlideDeck } from '@/lib/presentation-engine/slide-model';
import type { GeneratedPlanningContent, KeyActivityPlan } from '@/types/planning';

interface PackageMeta {
  uacName: string;
  teacherName?: string;
  schoolName?: string;
  semester?: number;
  component?: string;
  cct?: string;
}

function clean(value: unknown): string {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function activitiesOf(content: GeneratedPlanningContent): KeyActivityPlan[] {
  return Array.isArray(content.sectionIV?.activities) ? content.sectionIV.activities : [];
}

function addHeader(doc: jsPDF, title: string, subtitle: string, meta: PackageMeta): number {
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 216, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(clean(meta.uacName || 'Unidad de Aprendizaje'), 14, 11);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(
    [meta.schoolName, meta.cct ? `CCT ${meta.cct}` : '', meta.teacherName].filter(Boolean).join(' · '),
    14,
    17
  );
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(clean(title), 14, 38);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(clean(subtitle), 14, 44);
  doc.setTextColor(15, 23, 42);
  return 52;
}

function drawAnswerBox(doc: jsPDF, label: string, y: number, height = 27): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(clean(label), 14, y);
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, y + 2, 188, height, 1.5, 1.5, 'FD');
  return y + height + 10;
}

function drawFooter(doc: jsPDF, meta: PackageMeta, page: number): void {
  doc.setDrawColor(226, 232, 240);
  doc.line(14, 269, 202, 269);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `${clean(meta.uacName)} · ${meta.semester ?? ''}° Semestre · Paquete Integral de Aula`,
    14,
    274
  );
  doc.text(`Página ${page}`, 202, 274, { align: 'right' });
  doc.setTextColor(15, 23, 42);
}

export function generateExitTicketsPdf(
  content: GeneratedPlanningContent,
  meta: PackageMeta
): Buffer {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const acts = activitiesOf(content);
  const tickets = acts.length > 0
    ? acts
    : [{ name: 'Cierre de la experiencia', hours: 0 } as KeyActivityPlan];

  tickets.forEach((activity, index) => {
    if (index > 0) doc.addPage();
    const y = addHeader(
      doc,
      'TICKET DE SALIDA · 5 MINUTOS',
      `Actividad: ${clean(activity.name)}${activity.hours ? ` · ${activity.hours} h` : ''}`,
      meta
    );

    doc.setFillColor(238, 242, 255);
    doc.roundedRect(14, y, 188, 12, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(67, 56, 202);
    doc.text('Instrucción: responde de forma individual y entrega al docente antes de salir.', 18, y + 7.5);
    doc.setTextColor(15, 23, 42);

    let cursor = y + 20;
    cursor = drawAnswerBox(doc, '1. ¿Qué aprendizaje clave me llevo de esta sesión?', cursor);
    cursor = drawAnswerBox(doc, '2. ¿Qué duda o dificultad me queda para la próxima clase?', cursor);
    cursor = drawAnswerBox(doc, '3. ¿Cómo puedo aplicar lo aprendido en mi comunidad o vida diaria?', cursor);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Autoevaluación:', 14, cursor);
    doc.setFont('helvetica', 'normal');
    doc.text('VERDE: lo domino   ·   AMARILLO: necesito repasar   ·   ROJO: requiero apoyo', 43, cursor);
    cursor += 9;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Nombre del estudiante: ______________________________________', 14, cursor);
    doc.text('Grupo: ______________', 132, cursor);
    doc.text('Fecha: ____ / ____ / ______', 14, cursor + 8);
    doc.text('Firma del docente: ______________________________', 90, cursor + 8);

    drawFooter(doc, meta, index + 1);
  });

  return Buffer.from(doc.output('arraybuffer'));
}

export function generateWorksheetsPdf(
  content: GeneratedPlanningContent,
  meta: PackageMeta
): Buffer {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const acts = activitiesOf(content);
  const worksheets = acts.length > 0
    ? acts
    : [{ name: 'Ficha de trabajo de la experiencia', hours: 0 } as KeyActivityPlan];

  worksheets.forEach((activity, index) => {
    if (index > 0) doc.addPage();
    const y = addHeader(
      doc,
      'FICHA DE TRABAJO DEL ESTUDIANTE',
      `Actividad: ${clean(activity.name)} · ${activity.hours || 0} h · ${clean(activity.methodology || 'Metodología activa')}`,
      meta
    );

    let cursor = y;
    const saberes = activity.saberes;
    if (saberes) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('Saberes que movilizo', 14, cursor);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      const saberesText = [
        `Saber: ${clean(saberes.saber)}`,
        `Saber hacer: ${clean(saberes.saberHacer)}`,
        `Saber ser: ${clean(saberes.saberSer)}`,
      ].join('\n');
      doc.text(doc.splitTextToSize(saberesText, 186), 14, cursor + 5);
      cursor += 22;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Explora y activa tus saberes previos', 14, cursor);
    cursor = drawAnswerBox(doc, '¿Qué sé o he vivido sobre este tema?', cursor + 4, 20);
    cursor = drawAnswerBox(doc, 'Practica el procedimiento o concepto central', cursor, 38);
    cursor = drawAnswerBox(doc, 'Aplica lo aprendido a un problema de tu comunidad', cursor, 32);
    cursor = drawAnswerBox(doc, '¿Qué evidencia entregaré y cómo sé que está bien hecha?', cursor, 22);

    if (activity.conclusion?.activities) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(
        doc.splitTextToSize(`Cierre esperado: ${clean(activity.conclusion.activities)}`, 186),
        14,
        cursor
      );
    }

    drawFooter(doc, meta, index + 1);
  });

  return Buffer.from(doc.output('arraybuffer'));
}

export function generateFallbackRubricsPdf(
  content: GeneratedPlanningContent,
  meta: PackageMeta
): Buffer {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
  const acts = activitiesOf(content);
  const rubrics = acts.length > 0
    ? acts
    : [{ name: 'Evaluación de la experiencia', hours: 0 } as KeyActivityPlan];

  rubrics.forEach((activity, index) => {
    if (index > 0) doc.addPage();
    const y = addHeader(
      doc,
      'RÚBRICA ANALÍTICA DE EVALUACIÓN',
      `Actividad: ${clean(activity.name)} · ${activity.hours || 0} h`,
      meta
    );

    autoTable(doc, {
      startY: y,
      head: [['Criterio', 'Excelente (4)', 'Satisfactorio (3)', 'Suficiente (2)', 'Insuficiente (1)', 'Ponderación']],
      body: [
        [
          'Comprensión conceptual',
          'Explica con precisión el concepto y lo relaciona con el reto.',
          'Explica el concepto con claridad y algún ejemplo.',
          'Identifica ideas aisladas sin relación clara.',
          'No demuestra comprensión del concepto.',
          '25%',
        ],
        [
          'Aplicación procedimental',
          'Resuelve el problema con pasos completos, ordenados y verificables.',
          'Resuelve el problema con pasos correctos y un descuido menor.',
          'Resuelve parcialmente con apoyo del docente.',
          'No logra aplicar el procedimiento.',
          '35%',
        ],
        [
          'Colaboración y actitud',
          'Participa, escucha, argumenta y apoya a sus compañeros.',
          'Participa y colabora de forma constante.',
          'Participa de forma irregular.',
          'No participa ni colabora.',
          '20%',
        ],
        [
          'Comunicación de resultados',
          'Presenta la evidencia con claridad, orden y lenguaje disciplinar.',
          'Presenta la evidencia con claridad suficiente.',
          'Presenta la evidencia con omisiones importantes.',
          'No presenta evidencia o es incomprensible.',
          '20%',
        ],
      ],
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2, valign: 'top' },
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 35 }, 5: { cellWidth: 20, halign: 'center' } },
    });

    const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || y;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Puntaje total: ______ / 100     Calificación: ______', 14, finalY + 10);
    doc.text('Retroalimentación del docente: ____________________________________________________________', 14, finalY + 18);
    drawFooter(doc, meta, index + 1);
  });

  return Buffer.from(doc.output('arraybuffer'));
}

export async function generateFallbackPptx(
  content: GeneratedPlanningContent,
  meta: PackageMeta
): Promise<Buffer> {
  const palette = getPalette(meta.uacName || '', meta.component);
  const acts = activitiesOf(content);
  const evaluations = content.sectionV?.evaluations || [];
  const slides: SlideDeck['slides'] = [
    {
      kind: 'cover',
      title: clean(meta.uacName || content.sectionI?.uacName || 'Unidad de Aprendizaje'),
      subtitle: clean(`${meta.semester ?? content.sectionI?.semester ?? ''}° Semestre · ${meta.teacherName || content.sectionI?.teacherName || ''}`),
      notes: 'Presentación generada a partir de la planeación didáctica.',
    },
    {
      kind: 'agenda',
      title: 'Ruta de aprendizaje',
      subtitle: 'Propósito y resultados esperados',
      bullets: [
        clean(content.sectionII?.purpose),
        ...(content.sectionII?.learningOutcomes || []).map((item) => clean(item)),
      ].filter(Boolean).slice(0, 5),
      notes: 'Comparta el propósito y los resultados de aprendizaje con el grupo.',
    },
  ];

  acts.forEach((activity, index) => {
    const bullets = [
      activity.apertura?.activities ? `Apertura: ${clean(activity.apertura.activities)}` : '',
      activity.ejecucion?.activities ? `Desarrollo: ${clean(activity.ejecucion.activities)}` : '',
      activity.conclusion?.activities ? `Cierre: ${clean(activity.conclusion.activities)}` : '',
      activity.saberes?.saber ? `Saber: ${clean(activity.saberes.saber)}` : '',
      activity.saberes?.saberHacer ? `Saber hacer: ${clean(activity.saberes.saberHacer)}` : '',
    ].filter(Boolean);

    slides.push({
      kind: 'practice',
      title: clean(`Actividad ${index + 1}: ${activity.name || 'Experiencia de aprendizaje'}`),
      subtitle: clean(`${activity.hours || 0} h · ${activity.methodology || 'Metodología activa'}`),
      bullets: bullets.slice(0, 5),
      callout: activity.saberes?.saberSer
        ? { label: 'Saber ser', text: clean(activity.saberes.saberSer) }
        : undefined,
      notes: 'Desarrolle la actividad con los momentos de apertura, desarrollo y cierre.',
    });
  });

  slides.push({
    kind: 'closing',
    title: 'Cierre y evaluación',
    subtitle: '¿Qué evidencia demuestra el aprendizaje?',
    bullets: evaluations.slice(0, 5).map((evaluation) =>
      clean(`${evaluation.type}: ${evaluation.evidence} (${evaluation.percentage}%)`)
    ),
    notes: 'Recuerde aplicar el ticket de salida y registrar la retroalimentación.',
  });

  return generatePptxBuffer({
    meta: {
      title: `Presentación de clase · ${clean(meta.uacName)}`,
      subjectName: clean(meta.uacName),
      schoolName: clean(meta.schoolName || content.sectionI?.schoolName || ''),
      teacherName: clean(meta.teacherName || content.sectionI?.teacherName || ''),
      semester: Number(meta.semester || content.sectionI?.semester || 1),
      blockNumber: 1,
      blockName: 'Semestre',
    },
    palette,
    slides,
  });
}
