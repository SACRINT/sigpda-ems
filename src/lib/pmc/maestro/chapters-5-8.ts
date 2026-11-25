import {
  Paragraph,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  BorderStyle,
  WidthType,
  PageBreak,
} from 'docx';
import { cleanPmcPlaceholders } from '@/lib/pmc/plan-element-normalizer';
import {
  BRAND,
  CONTENT_W,
  CELL_PADDING,
  bdr,
  bdrTopOnly,
  cell,
  h1,
  h2,
  p,
  type PmcMaestroContext,
} from './helpers';

export function buildMaestroChapters5To8(ctx: PmcMaestroContext): (Paragraph | Table)[] {
  const {
    options,
    metasInst,
    metasPers,
    schoolName,
    cct,
    zona,
    localidad,
    director,
    supervisor,
  } = ctx;

  // Capítulo 5 — Plan de Acción y Metas Anuales Institucionales
  const tablaPlanAccionRows = [
    new TableRow({
      children: [
        cell('Ámbito / Tema', { w: 2200, bold: true, fill: BRAND.guinda, color: BRAND.blanco }),
        cell('Meta Programada y Entregable', { w: 4280, bold: true, fill: BRAND.guinda, color: BRAND.blanco }),
        cell('Periodo de Ejecución', { w: 1800, bold: true, fill: BRAND.guinda, color: BRAND.blanco, align: AlignmentType.CENTER }),
        cell('Personal Designado', { w: 1800, bold: true, fill: BRAND.guinda, color: BRAND.blanco }),
      ],
    }),
  ];

  if (metasInst.length === 0) {
    tablaPlanAccionRows.push(
      new TableRow({
        children: [
          cell('Contenido pendiente de captura en el wizard.', { w: CONTENT_W, span: 4, italics: true }),
        ],
      })
    );
  } else {
    metasInst.forEach((m, idx) => {
      const bg = idx % 2 === 0 ? BRAND.blanco : BRAND.grisFondo;
      const cleanMeta = cleanPmcPlaceholders(m.meta) || 'Meta no especificada.';
      const cleanEntregable = cleanPmcPlaceholders(m.entregable) || 'Evidencia documental';
      tablaPlanAccionRows.push(
        new TableRow({
          children: [
            cell(m.tema || 'Ámbito General', { w: 2200, fill: bg, bold: true, size: 18 }),
            cell(`${cleanMeta}\n\nEntregable: ${cleanEntregable}`, {
              w: 4280,
              fill: bg,
              size: 18,
            }),
            cell(`${m.periodo_inicio || 'Inicio'} — ${m.periodo_fin || 'Término'}`, {
              w: 1800,
              fill: bg,
              align: AlignmentType.CENTER,
              size: 18,
            }),
            cell(m.personal_designado || 'Colegiado Docente', { w: 1800, fill: bg, size: 18 }),
          ],
        })
      );
    });
  }

  const cap5 = [
    h1('Capítulo V. Plan de Acción y Metas Anuales Institucionales'),
    p(
      'La matriz del Plan de Acción consolida los compromisos anuales del plantel, asignando responsabilidades operativas, ventanas temporales y evidencias verificables para cada meta priorizada.'
    ),
    new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      borders: bdr(),
      rows: tablaPlanAccionRows,
    }),
  ];

  if (metasPers.length > 0) {
    cap5.push(h2('5.2 Metas y Compromisos Personales Docentes'));
    cap5.push(
      p(
        'Compromisos individuales asumidos por el personal docente y directivo para coadyuvar al logro de las metas institucionales del PMC:'
      )
    );

    const tablaMetasPersonalesRows = [
      new TableRow({
        children: [
          cell('Nombre', { w: 2000, bold: true, fill: BRAND.guinda, color: BRAND.blanco }),
          cell('Cargo', { w: 1800, bold: true, fill: BRAND.guinda, color: BRAND.blanco }),
          cell('Meta Individual', { w: 3280, bold: true, fill: BRAND.guinda, color: BRAND.blanco }),
          cell('Entregable', { w: 1800, bold: true, fill: BRAND.guinda, color: BRAND.blanco }),
          cell('Período', { w: 1200, bold: true, fill: BRAND.guinda, color: BRAND.blanco, align: AlignmentType.CENTER }),
        ],
      }),
    ];

    metasPers.forEach((mp, idx) => {
      const bg = idx % 2 === 0 ? BRAND.blanco : BRAND.grisFondo;
      const cleanMetaInd = cleanPmcPlaceholders(mp.meta_individual);
      const metaText = mp.categoria
        ? `[${mp.categoria}${mp.tema ? ` - ${mp.tema}` : ''}] ${cleanMetaInd || ''}`
        : cleanMetaInd || 'Meta individual formativa';

      tablaMetasPersonalesRows.push(
        new TableRow({
          children: [
            cell(mp.nombre || 'Personal Docente', { w: 2000, fill: bg, bold: true, size: 18 }),
            cell(mp.cargo || 'Docente frente a grupo', { w: 1800, fill: bg, size: 18 }),
            cell(metaText, { w: 3280, fill: bg, size: 18 }),
            cell(cleanPmcPlaceholders(mp.entregable) || 'Evidencia pedagógica', { w: 1800, fill: bg, size: 18 }),
            cell(mp.periodo || 'Ciclo Escolar', { w: 1200, fill: bg, align: AlignmentType.CENTER, size: 18 }),
          ],
        })
      );
    });

    cap5.push(
      new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        borders: bdr(),
        rows: tablaMetasPersonalesRows,
      })
    );
  }
  cap5.push(new Paragraph({ children: [new PageBreak()] }));

  // Capítulo 6 — Mecanismos de Seguimiento y Monitoreo Trimestral
  const tablaSeguimientoRows = [
    new TableRow({
      children: [
        cell('Periodo / Trimestre', { w: 2400, bold: true, fill: BRAND.guinda, color: BRAND.blanco }),
        cell('Hito / Meta Asociada', { w: 4480, bold: true, fill: BRAND.guinda, color: BRAND.blanco }),
        cell('Responsable del Seguimiento', { w: 3200, bold: true, fill: BRAND.guinda, color: BRAND.blanco }),
      ],
    }),
  ];

  if (metasInst.length === 0) {
    tablaSeguimientoRows.push(
      new TableRow({
        children: [
          cell('Contenido pendiente de captura en el wizard.', { w: CONTENT_W, span: 3, italics: true }),
        ],
      })
    );
  } else {
    metasInst.forEach((m, idx) => {
      const bg = idx % 2 === 0 ? BRAND.blanco : BRAND.grisFondo;
      tablaSeguimientoRows.push(
        new TableRow({
          children: [
            cell(`${m.periodo_inicio || 'Corte 1'} a ${m.periodo_fin || 'Corte 2'}`, { w: 2400, fill: bg, size: 18 }),
            cell(cleanPmcPlaceholders(m.meta) || 'Meta institucional', { w: 4480, fill: bg, size: 18 }),
            cell(m.personal_designado || 'Dirección / Colegiado', { w: 3200, fill: bg, size: 18 }),
          ],
        })
      );
    });
  }

  const cap6 = [
    h1('Capítulo VI. Mecanismos de Seguimiento y Monitoreo Trimestral'),
    p(
      'El seguimiento sistemático garantiza la pertinencia de las actividades y permite realizar ajustes oportunos en los colegiados de docentes y directivos. A continuación se presentan los cortes temporales y responsables designados derivados de las metas institucionales capturadas:'
    ),
    new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      borders: bdr(),
      rows: tablaSeguimientoRows,
    }),
    p(
      'Nota técnica: Contenido pendiente de captura en el wizard — Las cifras porcentuales de avance trimestral y las bitácoras de observación en aula se incorporan en los periodos de corte programados en el calendario escolar oficial.',
      { italics: true, size: 18, color: BRAND.textoMuted }
    ),
    new Paragraph({ children: [new PageBreak()] }),
  ];

  // Capítulo 7 — Recursos, Vinculación y Plantilla del Plantel
  const personalItems = options.personal || [];
  const tablaPersonalRows = [
    new TableRow({
      children: [
        cell('No.', { w: 600, bold: true, fill: BRAND.guinda, color: BRAND.blanco, align: AlignmentType.CENTER }),
        cell('Nombre Completo del Personal', { w: 3880, bold: true, fill: BRAND.guinda, color: BRAND.blanco }),
        cell('Cargo / Función', { w: 2600, bold: true, fill: BRAND.guinda, color: BRAND.blanco }),
        cell('Horas Base', { w: 1200, bold: true, fill: BRAND.guinda, color: BRAND.blanco, align: AlignmentType.CENTER }),
        cell('Correo Electrónico', { w: 1800, bold: true, fill: BRAND.guinda, color: BRAND.blanco }),
      ],
    }),
  ];

  if (personalItems.length === 0) {
    tablaPersonalRows.push(
      new TableRow({
        children: [
          cell('Contenido pendiente de captura en el wizard — Plantilla docente no sincronizada en el módulo de personal.', {
            w: CONTENT_W,
            span: 5,
            italics: true,
          }),
        ],
      })
    );
  } else {
    personalItems.forEach((pItem, idx) => {
      const bg = idx % 2 === 0 ? BRAND.blanco : BRAND.grisFondo;
      const nombreCompleto = [pItem.apellido_paterno, pItem.apellido_materno, pItem.nombre].filter(Boolean).join(' ');
      tablaPersonalRows.push(
        new TableRow({
          children: [
            cell(String(idx + 1), { w: 600, fill: bg, align: AlignmentType.CENTER, size: 18 }),
            cell(nombreCompleto, { w: 3880, fill: bg, bold: true, size: 18 }),
            cell(pItem.cargo || 'Docente frente a grupo', { w: 2600, fill: bg, size: 18 }),
            cell(String(pItem.horas_base || '-'), { w: 1200, fill: bg, align: AlignmentType.CENTER, size: 18 }),
            cell(pItem.email || '-', { w: 1800, fill: bg, size: 16 }),
          ],
        })
      );
    });
  }

  const cap7 = [
    h1('Capítulo VII. Recursos, Vinculación y Plantilla del Plantel'),
    p(
      `El capital humano de ${schoolName} constituye el eje rector para el logro de las metas del PMC. Con base en la plantilla registrada en el wizard o el módulo de personal, la plantilla activa se estructura de la siguiente manera:`
    ),
    new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      borders: bdr(),
      rows: tablaPersonalRows,
    }),
    new Paragraph({ children: [new PageBreak()] }),
  ];

  // Capítulo 8 — Evaluación, Rendición de Cuentas y Firmas Colegiadas
  const tablaEvaluacionRows = [
    new TableRow({
      children: [
        cell('Meta Institucional', { w: 3880, bold: true, fill: BRAND.guinda, color: BRAND.blanco }),
        cell('Línea Base Inicial', { w: 2000, bold: true, fill: BRAND.guinda, color: BRAND.blanco }),
        cell('Meta Final Proyectada', { w: 2200, bold: true, fill: BRAND.guinda, color: BRAND.blanco }),
        cell('Entregable Verificador', { w: 2000, bold: true, fill: BRAND.guinda, color: BRAND.blanco }),
      ],
    }),
  ];

  if (metasInst.length === 0) {
    tablaEvaluacionRows.push(
      new TableRow({
        children: [
          cell('Contenido pendiente de captura en el wizard.', { w: CONTENT_W, span: 4, italics: true }),
        ],
      })
    );
  } else {
    metasInst.forEach((m, idx) => {
      const bg = idx % 2 === 0 ? BRAND.blanco : BRAND.grisFondo;
      const cleanMeta = cleanPmcPlaceholders(m.meta) || 'Meta institucional';
      tablaEvaluacionRows.push(
        new TableRow({
          children: [
            cell(cleanMeta, { w: 3880, fill: bg, size: 18 }),
            cell(cleanPmcPlaceholders(m.linea_base) || 'Sin línea base capturada', { w: 2000, fill: bg, size: 18 }),
            cell(cleanMeta || '100% de cumplimiento', { w: 2200, fill: bg, size: 18 }),
            cell(cleanPmcPlaceholders(m.entregable) || 'Evidencia documental', { w: 2000, fill: bg, size: 18 }),
          ],
        })
      );
    });
  }

  // Tabla formal de Firmas Institucionales
  const tablaFirmas = new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
      bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
      left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
      right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 3100, type: WidthType.DXA },
            borders: bdrTopOnly(BRAND.dorado),
            margins: CELL_PADDING,
            children: [
              p(director, { bold: true, align: AlignmentType.CENTER, size: 20 }),
              p('Dirección del Plantel', { italics: true, align: AlignmentType.CENTER, size: 18 }),
              p(schoolName, { color: BRAND.textoMuted, align: AlignmentType.CENTER, size: 16 }),
            ],
          }),
          new TableCell({
            width: { size: 680, type: WidthType.DXA },
            borders: {
              top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
              bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
              left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
              right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
            },
            children: [new Paragraph({})],
          }),
          new TableCell({
            width: { size: 3100, type: WidthType.DXA },
            borders: bdrTopOnly(BRAND.dorado),
            margins: CELL_PADDING,
            children: [
              p('Comité Colegiado de Planeación', { bold: true, align: AlignmentType.CENTER, size: 20 }),
              p('Representación Docente del Plantel', { italics: true, align: AlignmentType.CENTER, size: 18 }),
              p(`CCT: ${cct}`, { color: BRAND.textoMuted, align: AlignmentType.CENTER, size: 16 }),
            ],
          }),
          new TableCell({
            width: { size: 680, type: WidthType.DXA },
            borders: {
              top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
              bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
              left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
              right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
            },
            children: [new Paragraph({})],
          }),
          new TableCell({
            width: { size: 3100, type: WidthType.DXA },
            borders: bdrTopOnly(BRAND.dorado),
            margins: CELL_PADDING,
            children: [
              p(supervisor, { bold: true, align: AlignmentType.CENTER, size: 20 }),
              p('Supervisión Escolar', { italics: true, align: AlignmentType.CENTER, size: 18 }),
              p(zona, { color: BRAND.textoMuted, align: AlignmentType.CENTER, size: 16 }),
            ],
          }),
        ],
      }),
    ],
  });

  const cap8 = [
    h1('Capítulo VIII. Evaluación, Rendición de Cuentas y Firmas Colegiadas'),
    p(
      'La evaluación final del PMC representa el acto de rendición de cuentas académico y administrativo ante la comunidad escolar y las autoridades educativas. Con base en las metas proyectadas en el plan de acción, se establece la siguiente matriz comparativa:'
    ),
    new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      borders: bdr(),
      rows: tablaEvaluacionRows,
    }),
    p(
      'Nota técnica: Contenido pendiente de captura en el wizard — La evaluación cualitativa de impacto final y los porcentajes definitivos de logro se asientan formalmente al término del ciclo escolar.',
      { italics: true, size: 18, color: BRAND.textoMuted }
    ),
    new Paragraph({ spacing: { before: 400, after: 200 } }),
    p('VALIDACIÓN INSTITUCIONAL Y FORMALIZACIÓN COLEGIADA', {
      bold: true,
      align: AlignmentType.CENTER,
      color: BRAND.guinda,
      size: 24,
    }),
    p(
      `En cumplimiento a los Lineamientos Oficiales DBEPA 2025-2026, se firma el presente Programa de Mejora Continua ${localidad !== 'No capturado' ? `en ${localidad}, Puebla, ` : ''}a los acuerdos formalizados por las partes suscritas:`,
      { align: AlignmentType.CENTER, italics: true, size: 18, color: BRAND.textoMuted }
    ),
    new Paragraph({ spacing: { before: 600, after: 300 } }),
    tablaFirmas,
  ];


  return [...cap5, ...cap6, ...cap7, ...cap8];
}
