/* eslint-disable @typescript-eslint/no-explicit-any */
import autoTable from 'jspdf-autotable';
import type {
  PaecProject,
  MapeoRow,
  CronogramaRow,
  DetalleCurricularRow,
  PlanOperativoRow,
} from '@/types/paec';
import {
  NAVY,
  BLUE_MID,
  GOLD_LIGHT,
  GRAY_BG,
  TEXT_DARK,
  safeStr,
  addSectionBar,
  type PaecPdfRenderState,
} from './helpers';

export function renderPaecPdfCurriculoYPlan(state: PaecPdfRenderState): void {
  const {
    doc,
    p,
    sCtx,
    cCtx,
    communityLabel,
    margin,
    contentWidth,
  } = state;
  let { curY } = state;

  // ═════════════════════════════════════════════════════════════════════════════
  // PÁGINA 6: MACRO-FASE II: JUSTIFICACIÓN PEDAGÓGICA Y PROPÓSITOS INTEGRALES (PORTRAIT)
  // ═════════════════════════════════════════════════════════════════════════════
  doc.addPage('letter', 'portrait');
  curY = 24;
  addSectionBar(doc, 'Macro-Fase II: Justificación Pedagógica y Diseño Curricular (MCCEMS)', curY, margin, contentWidth);
  curY += 10;

  const just = (p.fase2Justificacion || {}) as Partial<NonNullable<PaecProject['fase2Justificacion']>> & Record<string, any>; // fallback tipado defensivo

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...NAVY);
  doc.text('2.1 FUNDAMENTACIÓN Y JUSTIFICACIÓN EN LA NUEVA ESCUELA MEXICANA', margin, curY);
  curY += 4.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...TEXT_DARK);
  const introJust = safeStr(just.introduction, 'El presente Proyecto Escolar Comunitario se fundamenta en las directrices de la Nueva Escuela Mexicana, articulando el conocimiento científico, humanístico y tecnológico con la solución situada de los retos presentes en el entorno escolar y comunitario.');
  const splitJust = doc.splitTextToSize(introJust, contentWidth);
  doc.text(splitJust, margin, curY);
  curY += splitJust.length * 3.4 + 5;

  // Pilares NEM
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...NAVY);
  doc.text('Pilares Fundamentales de la Nueva Escuela Mexicana Incorporados:', margin, curY);
  curY += 4.5;

  const pilares: string[] = just.pilares || [
    'Fomento de la identidad con México y sentido de pertenencia comunitaria territorial',
    'Responsabilidad ciudadana y honestidad como valores rectores de la formación',
    'Participación protagónica en la transformación social y ambiental del entorno',
    'Respeto de la dignidad humana, inclusión y fomento de la cultura de paz',
    'Cuidado y preservación ecológica de la naturaleza y gestión sustentable de los recursos',
  ];
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...TEXT_DARK);
  pilares.forEach((pil) => {
    doc.text(`• ${pil}`, margin + 3, curY);
    curY += 3.8;
  });
  curY += 4;

  // Propósitos Integrales MIFO
  const prop = (just.proposito || {}) as Record<string, any>;
  autoTable(doc, {
    startY: curY,
    head: [
      [
        {
          content: '2.2 PROPÓSITOS INTEGRALES DEL PROYECTO (MIFO / MCCEMS)',
          colSpan: 2,
          styles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        },
      ],
    ],
    body: [
      [
        { content: 'Propósito Educativo:', styles: { fontStyle: 'bold', textColor: NAVY, cellWidth: 45 } },
        { content: safeStr(prop.educativo, 'Fortalecer el pensamiento crítico, las habilidades científicas y el trabajo interdisciplinario a través del aprendizaje situado.'), styles: { textColor: TEXT_DARK } },
      ],
      [
        { content: 'Propósito Social:', styles: { fontStyle: 'bold', textColor: NAVY } },
        { content: safeStr(prop.social, 'Promover la cohesión comunitaria, la participación ciudadana y el mejoramiento directo del bienestar territorial.'), styles: { textColor: TEXT_DARK } },
      ],
      [
        { content: 'Propósito Funcional:', styles: { fontStyle: 'bold', textColor: NAVY } },
        { content: safeStr(prop.funcional, 'Desarrollar productos, soluciones técnicas e intervenciones tangibles con impacto demostrable y sostenible.'), styles: { textColor: TEXT_DARK } },
      ],
    ],
    theme: 'grid',
    styles: { fontSize: 7.2, cellPadding: 2.2, overflow: 'linebreak' },
    columnStyles: {
      0: { cellWidth: 45, fillColor: GRAY_BG },
      1: { cellWidth: contentWidth - 45 },
    },
    margin: { left: margin, right: margin },
  });
  // @ts-expect-error autoTable adds lastAutoTable to jsPDF instance
  curY = doc.lastAutoTable.finalY + 7;

  // Alcance y Población Beneficiaria
  autoTable(doc, {
    startY: curY,
    head: [
      [
        {
          content: 'ALCANCE, COBERTURA Y BENEFICIARIOS DE LA INTERVENCIÓN',
          colSpan: 2,
          styles: { fillColor: BLUE_MID, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
        },
      ],
    ],
    body: [
      [
        { content: 'Beneficiarios Directos:', styles: { fontStyle: 'bold', cellWidth: 45 } },
        { content: `${safeStr(sCtx.enrollment, '240')} estudiantes del bachillerato, ${safeStr(sCtx.teacherCount, '12')} docentes y directivos involucrados directamente en las brigadas de aprendizaje.` },
      ],
      [
        { content: 'Beneficiarios Indirectos:', styles: { fontStyle: 'bold' } },
        { content: `Familias de la comunidad de ${safeStr(communityLabel)} (${safeStr(cCtx.demographics, 'población general')}), comerciantes y productores del territorio circundante.` },
      ],
      [
        { content: 'Delimitación Territorial:', styles: { fontStyle: 'bold' } },
        { content: `Instalaciones del plantel escolar y cuadrantes prioritarios de la localidad de ${safeStr(sCtx.locality)}, Municipio de ${safeStr(sCtx.municipality)}, Puebla.` },
      ],
    ],
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak' },
    margin: { left: margin, right: margin },
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // PÁGINA 7: 2.3 MAPEO CURRICULAR INTEGRAL (PARTE 1: SEMESTRES 1°, 2° Y 3°) (PORTRAIT)
  // ═════════════════════════════════════════════════════════════════════════════
  doc.addPage('letter', 'portrait');
  curY = 24;
  addSectionBar(doc, '2.3 Mapeo Curricular Integral (Parte 1: Semestres 1°, 2° y 3°)', curY, margin, contentWidth);
  curY += 10;

  const mapeo: MapeoRow[] = p.fase2Mapeo || [];
  const mapRowsPart1 = (mapeo.length > 0
    ? mapeo.filter((r: any) => Number(r.semester || r.semestre || 1) <= 3)
    : []
  ).map((r: any) => [
    `${r.semester || r.semestre || 1}°`,
    safeStr(r.uacName || r.uac || 'UAC'),
    safeStr(r.topic || r.progresion || 'Eje temático transversal'),
    `${r.horasSemanales || 4} h`,
    safeStr(r.linking || r.vinculacion || 'Vinculación comunitaria situada'),
  ]);

  const defaultPart1 = [
    ['1°', 'Lengua y Comunicación I', 'Elaboración de diagnósticos e informes comunitarios situados', '4 h', 'Redacción de las actas de asamblea y trípticos informativos para la comunidad.'],
    ['1°', 'Pensamiento Matemático I', 'Estadística descriptiva y análisis demográfico del entorno', '4 h', 'Interpretación matemática de los datos de la encuesta comunitaria y gráficas.'],
    ['1°', 'Cultura Digital I', 'Software ofimático y hojas de cálculo colaborativas', '3 h', 'Tabulación digitalizada de la información territorial y bases de datos.'],
    ['2°', 'Lengua y Comunicación II', 'Ensayo argumentativo y textos de divulgación científica', '4 h', 'Publicación de gacetas escolares sobre la problemática territorial.'],
    ['2°', 'Pensamiento Matemático II', 'Procesos de cambio y modelación funcional', '4 h', 'Modelado matemático de consumo, ahorro y proyecciones de impacto.'],
    ['3°', 'Cultura Digital II', 'Herramientas colaborativas, diseño web y multimedia', '3 h', 'Producción de la memoria audiovisual del proyecto y catálogo digital.'],
    ['3°', 'La Materia y sus Interacciones', 'Propiedades de la materia y balance químico ambiental', '4 h', 'Análisis de laboratorio de muestras de agua, suelo o materiales locales.'],
  ];

  autoTable(doc, {
    startY: curY,
    head: [
      [
        {
          content: 'ARTICULACIÓN MULTIDISCIPLINARIA DEL MCCEMS — SEMESTRES 1°, 2° Y 3°',
          colSpan: 5,
          styles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        },
      ],
      [
        { content: 'Sem.', styles: { halign: 'center', cellWidth: 14 } },
        { content: 'Unidad de Aprendizaje (UAC)', styles: { cellWidth: 42 } },
        { content: 'Eje Temático / Progresión', styles: { cellWidth: 46 } },
        { content: 'Hrs', styles: { halign: 'center', cellWidth: 12 } },
        { content: 'Vinculación con el Proyecto Comunitario', styles: { cellWidth: contentWidth - 114 } },
      ],
    ],
    body: mapRowsPart1.length > 0 ? mapRowsPart1 : defaultPart1,
    theme: 'grid',
    styles: { fontSize: 7.2, cellPadding: 2.2, overflow: 'linebreak' },
    headStyles: { fillColor: BLUE_MID, textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      0: { halign: 'center', fontStyle: 'bold', fillColor: GRAY_BG },
      1: { fontStyle: 'bold' },
      3: { halign: 'center' },
    },
    margin: { left: margin, right: margin },
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // PÁGINA 8: 2.3 MAPEO CURRICULAR INTEGRAL (PARTE 2: SEMESTRES 4°, 5° Y 6°) (PORTRAIT)
  // ═════════════════════════════════════════════════════════════════════════════
  doc.addPage('letter', 'portrait');
  curY = 24;
  addSectionBar(doc, '2.3 Mapeo Curricular Integral (Parte 2: Semestres 4°, 5° y 6°)', curY, margin, contentWidth);
  curY += 10;

  const mapRowsPart2 = (mapeo.length > 0
    ? mapeo.filter((r: any) => Number(r.semester || r.semestre || 1) >= 4)
    : []
  ).map((r: any) => [
    `${r.semester || r.semestre || 4}°`,
    safeStr(r.uacName || r.uac || 'UAC'),
    safeStr(r.topic || r.progresion || 'Eje temático transversal'),
    `${r.horasSemanales || 4} h`,
    safeStr(r.linking || r.vinculacion || 'Vinculación comunitaria situada'),
  ]);

  const defaultPart2 = [
    ['4°', 'Ciencias Sociales II', 'Estructura social y desarrollo económico regional', '3 h', 'Estudio socioeconómico de los beneficiarios y diseño de propuestas de política local.'],
    ['4°', 'Conciencia Histórica II', 'Procesos de transformación agraria y ambiental', '3 h', 'Recuperación de la memoria oral de adultos mayores sobre los recursos locales.'],
    ['5°', 'Cultura Digital III', 'Gestión de proyectos en la nube y marketing social', '3 h', 'Campaña de difusión digital comunitaria y portal web institucional.'],
    ['5°', 'Conciencia Histórica III', 'Memoria histórica local y cambios en el territorio', '3 h', 'Rescate del patrimonio cultural y ambiental del municipio y archivo fotográfico.'],
    ['6°', 'Filosofía y Ética Comunitaria', 'Ética del cuidado y responsabilidad socioecológica', '3 h', 'Debates comunitarios sobre justicia distributiva y cuidado de los bienes comunes.'],
    ['6°', 'Formación Laboral / Tutorías', 'Emprendimiento social y proyectos sustentables', '4 h', 'Plan de negocios sociales y transferencia tecnológica a comités comunitarios.'],
  ];

  autoTable(doc, {
    startY: curY,
    head: [
      [
        {
          content: 'ARTICULACIÓN MULTIDISCIPLINARIA DEL MCCEMS — SEMESTRES 4°, 5° Y 6°',
          colSpan: 5,
          styles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        },
      ],
      [
        { content: 'Sem.', styles: { halign: 'center', cellWidth: 14 } },
        { content: 'Unidad de Aprendizaje (UAC)', styles: { cellWidth: 42 } },
        { content: 'Eje Temático / Progresión', styles: { cellWidth: 46 } },
        { content: 'Hrs', styles: { halign: 'center', cellWidth: 12 } },
        { content: 'Vinculación con el Proyecto Comunitario', styles: { cellWidth: contentWidth - 114 } },
      ],
    ],
    body: mapRowsPart2.length > 0 ? mapRowsPart2 : defaultPart2,
    theme: 'grid',
    styles: { fontSize: 7.2, cellPadding: 2.2, overflow: 'linebreak' },
    headStyles: { fillColor: BLUE_MID, textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      0: { halign: 'center', fontStyle: 'bold', fillColor: GRAY_BG },
      1: { fontStyle: 'bold' },
      3: { halign: 'center' },
    },
    margin: { left: margin, right: margin },
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // PÁGINA 9: 2.4 CRONOGRAMA BIMESTRAL MACRO DEL PROYECTO (6 FASES OFICIALES) (PORTRAIT)
  // ═════════════════════════════════════════════════════════════════════════════
  doc.addPage('letter', 'portrait');
  curY = 24;
  addSectionBar(doc, '2.4 Cronograma Bimestral Macro del Proyecto (6 Fases Oficiales)', curY, margin, contentWidth);
  curY += 10;

  const crono: CronogramaRow[] = p.fase2Cronograma || [];
  const cronoRows = crono.length > 0
    ? crono.map((r: any, idx) => {
        const rawTitle = r.phaseTitle || r.tituloTematico || '';
        const rawPhase = r.phase || r.faseBimestral || `Fase ${idx + 1}`;
        const fase = rawTitle && !rawPhase.includes(rawTitle) ? `${rawPhase}: ${rawTitle}` : rawPhase;
        const obj = r.objective || r.objetivo || 'Propósito formativo';
        const act = r.macroActivities || r.actividad || 'Actividades de la fase';
        const uacs = r.responsibleSubjects || r.uacParticipantes || 'Colegiado Docente';
        const sem = r.semesterInvolved || r.semestre || (r.semester ? `Semestre ${r.semester}` : 'Todos los semestres');

        return [safeStr(fase), safeStr(obj), safeStr(act), safeStr(uacs), safeStr(sem)];
      })
    : [
        ['Fase 1: Diagnóstico (Bimestre 1)', 'Levantar necesidades prioritarias', 'Levantamiento de campo y asamblea inicial', 'Ciencias Sociales / Humanidades', '1° y 3° Semestre'],
        ['Fase 2: Diseño (Bimestre 2)', 'Articulación pedagógica y prototipos', 'Articulación de progresiones y prototipos', 'Pensamiento Matemático / Lengua', 'Todos'],
        ['Fase 3: Gestión (Bimestre 3)', 'Vincular aliados estratégicos', 'Gestión con aliados y convenios comunitarios', 'Formación Laboral / Tutorías', 'Todos'],
        ['Fase 4: Ejecución (Bimestre 4)', 'Intervención territorial situada', 'Intervención de campo y faenas escolares', 'Colegiado Escolar', 'Todos'],
        ['Fase 5: Monitoreo (Bimestre 5)', 'Evaluación de impacto formativo', 'Medición de impacto y encuestas comunitarias', 'Metodología / Ciencias', 'Todos'],
        ['Fase 6: Cierre (Bimestre 6)', 'Rendición de cuentas e informe', 'Feria Comunitaria y entrega de custodias', 'Toda la Comunidad', 'Todos'],
      ];

  autoTable(doc, {
    startY: curY,
    head: [
      [
        {
          content: '2.4 CRONOGRAMA BIMESTRAL MACRO DEL PROYECTO (6 FASES OFICIALES)',
          colSpan: 5,
          styles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        },
      ],
      [
        { content: 'Fase Temática y Periodo', styles: { cellWidth: 42 } },
        { content: 'Propósito / Objetivo', styles: { cellWidth: 38 } },
        { content: 'Actividades Macro', styles: { cellWidth: 44 } },
        { content: 'Asignaturas Viga Maestra', styles: { cellWidth: 36 } },
        { content: 'Semestre(s)', styles: { cellWidth: contentWidth - 160 } },
      ],
    ],
    body: cronoRows,
    theme: 'grid',
    styles: { fontSize: 7.2, cellPadding: 2.2, overflow: 'linebreak' },
    headStyles: { fillColor: BLUE_MID, textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: GRAY_BG },
    },
    margin: { left: margin, right: margin },
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // PÁGINA 10: 2.5 DETALLE CURRICULAR: PROGRESIONES Y METAS — SEMESTRE A (PORTRAIT)
  // ═════════════════════════════════════════════════════════════════════════════
  doc.addPage('letter', 'portrait');
  curY = 24;
  addSectionBar(doc, '2.5 Detalle Curricular: Progresiones y Metas — Semestre A', curY, margin, contentWidth);
  curY += 10;

  const detalle: DetalleCurricularRow[] = p.fase2DetalleCurricular || [];
  const detRowsA = (detalle.length > 0
    ? detalle.filter((r: any) => [1, 3, 5].includes(Number(r.semester || r.semestre || 1)))
    : []
  ).map((r: any) => [
    `${r.semester || r.semestre || 1}°`,
    safeStr(r.uacName || r.uac || 'UAC'),
    safeStr(r.projectPhases || r.fasePec || 'Fases I-IV'),
    safeStr(r.progressionsOrPurposes || r.progresionesOPropositos || 'Progresiones del MCCEMS'),
    safeStr(r.curricularJustification || r.estrategiaEnsenanza || 'Aprendizaje basado en proyectos'),
    safeStr(r.responsables || 'Colegiado Docente'),
  ]);

  const defaultDetA = [
    ['1°', 'Lengua y Comunicación I', 'Fase I y II', 'Reconocimiento de la intención comunicativa y elaboración de mensajes formales situados.', 'Redacción reflexiva, encuestas y actas de campo.', 'Docente Titular'],
    ['1°', 'Pensamiento Matemático I', 'Fase I y III', 'Estadística básica, muestreo y representación gráfica de datos territoriales.', 'Resolución de problemas de campo y presupuestos.', 'Docente de Matemáticas'],
    ['3°', 'Cultura Digital II', 'Fase II y IV', 'Producción de contenidos multimedia y documentación en la nube para la memoria.', 'Laboratorio de medios digitales y catálogo web.', 'Docente de Informática'],
    ['3°', 'La Materia y sus Interacciones', 'Fase II y IV', 'Análisis fisicoquímico y balances ecológicos en el ecosistema territorial.', 'Prácticas de laboratorio y muestreos de agua/suelo.', 'Docente de Ciencias'],
    ['5°', 'Conciencia Histórica III', 'Fase I y IV', 'Preservación de la memoria histórica comunitaria y dinámicas de cambio territorial.', 'Indagación oral y recopilación de testimonios.', 'Docente de Sociales'],
  ];

  autoTable(doc, {
    startY: curY,
    head: [
      [
        {
          content: 'DETALLE CURRICULAR DE PROGRESIONES — SEMESTRES NONES (1°, 3° Y 5°)',
          colSpan: 6,
          styles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        },
      ],
      [
        { content: 'Sem.', styles: { halign: 'center', cellWidth: 12 } },
        { content: 'UAC / Materia', styles: { cellWidth: 34 } },
        { content: 'Fase PEC', styles: { cellWidth: 22 } },
        { content: 'Progresiones / Propósitos', styles: { cellWidth: 48 } },
        { content: 'Estrategia Didáctica', styles: { cellWidth: 44 } },
        { content: 'Responsable', styles: { cellWidth: contentWidth - 160 } },
      ],
    ],
    body: detRowsA.length > 0 ? detRowsA : defaultDetA,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 2.2, overflow: 'linebreak' },
    headStyles: { fillColor: BLUE_MID, textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      0: { halign: 'center', fontStyle: 'bold', fillColor: GRAY_BG },
      1: { fontStyle: 'bold' },
    },
    margin: { left: margin, right: margin },
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // PÁGINA 11: 2.5 DETALLE CURRICULAR: PROGRESIONES Y METAS — SEMESTRE B (PORTRAIT)
  // ═════════════════════════════════════════════════════════════════════════════
  doc.addPage('letter', 'portrait');
  curY = 24;
  addSectionBar(doc, '2.5 Detalle Curricular: Progresiones y Metas — Semestre B', curY, margin, contentWidth);
  curY += 10;

  const detRowsB = (detalle.length > 0
    ? detalle.filter((r: any) => [2, 4, 6].includes(Number(r.semester || r.semestre || 2)))
    : []
  ).map((r: any) => [
    `${r.semester || r.semestre || 2}°`,
    safeStr(r.uacName || r.uac || 'UAC'),
    safeStr(r.projectPhases || r.fasePec || 'Fases IV-VI'),
    safeStr(r.progressionsOrPurposes || r.progresionesOPropositos || 'Progresiones del MCCEMS'),
    safeStr(r.curricularJustification || r.estrategiaEnsenanza || 'Aprendizaje servicio'),
    safeStr(r.responsables || 'Colegiado Docente'),
  ]);

  const defaultDetB = [
    ['2°', 'Lengua y Comunicación II', 'Fase IV y V', 'Estructuración de textos argumentativos y discursos persuasivos de divulgación.', 'Ensayos reflexivos y presentaciones a la comunidad.', 'Docente Titular'],
    ['2°', 'Pensamiento Matemático II', 'Fase IV y VI', 'Modelación de variables cuantitativas para la optimización de recursos hídricos.', 'Resolución de problemas situados y presupuestos.', 'Docente de Matemáticas'],
    ['4°', 'Ciencias Sociales II', 'Fase IV y VI', 'Estructura social y desarrollo económico regional sustentable.', 'Evaluación del impacto socioformativo comunitario.', 'Docente de Sociales'],
    ['6°', 'Filosofía y Ética', 'Fase V y VI', 'Reflexión crítica sobre el cuidado del medio ambiente y la bioética.', 'Círculos de diálogo y asamblea de deliberación.', 'Docente de Humanidades'],
    ['6°', 'Formación Laboral', 'Fase IV y VI', 'Emprendimiento social y desarrollo de prototipos tecnológicos sustentables.', 'Feria Comunitaria y transferencia a beneficiarios.', 'Docente de Capacitación'],
  ];

  autoTable(doc, {
    startY: curY,
    head: [
      [
        {
          content: 'DETALLE CURRICULAR DE PROGRESIONES — SEMESTRES PARES (2°, 4° Y 6°)',
          colSpan: 6,
          styles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        },
      ],
      [
        { content: 'Sem.', styles: { halign: 'center', cellWidth: 12 } },
        { content: 'UAC / Materia', styles: { cellWidth: 34 } },
        { content: 'Fase PEC', styles: { cellWidth: 22 } },
        { content: 'Progresiones / Propósitos', styles: { cellWidth: 48 } },
        { content: 'Estrategia Didáctica', styles: { cellWidth: 44 } },
        { content: 'Responsable', styles: { cellWidth: contentWidth - 160 } },
      ],
    ],
    body: detRowsB.length > 0 ? detRowsB : defaultDetB,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 2.2, overflow: 'linebreak' },
    headStyles: { fillColor: BLUE_MID, textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      0: { halign: 'center', fontStyle: 'bold', fillColor: GRAY_BG },
      1: { fontStyle: 'bold' },
    },
    margin: { left: margin, right: margin },
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // MACRO-FASE III (A): PLAN OPERATIVO — SEMESTRE A (PÁGINAS 12 A 15 EN LANDSCAPE)
  // 4 PÁGINAS DEDICADAS: W1-4 (P12), W5-8 (P13), W9-12 (P14), W13-16 (P15)
  // ═════════════════════════════════════════════════════════════════════════════
  const planA: PlanOperativoRow[] = p.fase3PlanOperativoA || (p as Record<string, any>).fase2PlanSemestreA || p.fase2PlanOperativo?.semestreA || [];
  const planB: PlanOperativoRow[] = p.fase3PlanOperativoB || (p as Record<string, any>).fase2PlanSemestreB || p.fase2PlanOperativo?.semestreB || [];

  const parseWeekNum = (weekVal: unknown): number => {
    if (typeof weekVal === 'number') return weekVal;
    if (!weekVal) return 0;
    const match = String(weekVal).match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  };

  const partitionPlanRows = (rows: PlanOperativoRow[]): { rangeLabel: string; rows: PlanOperativoRow[] }[] => {
    if (rows.length === 0) {
      return [
        { rangeLabel: 'Semanas 1 a 4', rows: [] },
        { rangeLabel: 'Semanas 5 a 8', rows: [] },
        { rangeLabel: 'Semanas 9 a 12', rows: [] },
        { rangeLabel: 'Semanas 13 a 16', rows: [] },
      ];
    }

    const b1: PlanOperativoRow[] = [];
    const b2: PlanOperativoRow[] = [];
    const b3: PlanOperativoRow[] = [];
    const b4: PlanOperativoRow[] = [];
    const unassigned: PlanOperativoRow[] = [];

    rows.forEach((r) => {
      const w = parseWeekNum(r.week);
      if (w >= 1 && w <= 4) b1.push(r);
      else if (w >= 5 && w <= 8) b2.push(r);
      else if (w >= 9 && w <= 12) b3.push(r);
      else if (w >= 13 && w <= 16) b4.push(r);
      else unassigned.push(r);
    });

    if (b1.length > 0 || b2.length > 0 || b3.length > 0 || b4.length > 0) {
      unassigned.forEach((r, idx) => {
        if (idx % 4 === 0) b1.push(r);
        else if (idx % 4 === 1) b2.push(r);
        else if (idx % 4 === 2) b3.push(r);
        else b4.push(r);
      });
      return [
        { rangeLabel: 'Semanas 1 a 4', rows: b1 },
        { rangeLabel: 'Semanas 5 a 8', rows: b2 },
        { rangeLabel: 'Semanas 9 a 12', rows: b3 },
        { rangeLabel: 'Semanas 13 a 16', rows: b4 },
      ];
    }

    const chunkSize = Math.ceil(rows.length / 4);
    return [
      { rangeLabel: 'Semanas 1 a 4', rows: rows.slice(0, chunkSize) },
      { rangeLabel: 'Semanas 5 a 8', rows: rows.slice(chunkSize, chunkSize * 2) },
      { rangeLabel: 'Semanas 9 a 12', rows: rows.slice(chunkSize * 2, chunkSize * 3) },
      { rangeLabel: 'Semanas 13 a 16', rows: rows.slice(chunkSize * 3) },
    ];
  };

  const formatLandscapePlanChunk = (
    rowsChunk: PlanOperativoRow[],
    titleText: string,
    chunkRange: string,
    isFinalWeekHighlight = false
  ) => {
    if (rowsChunk.length === 0) return;

    doc.addPage('letter', 'landscape');
    const pW = doc.internal.pageSize.getWidth();   // 279.4 mm
    const cW = pW - margin * 2;                    // 251.4 mm
    curY = 24;

    addSectionBar(doc, `${titleText} — ${chunkRange}`, curY, margin, cW);
    curY += 10;

    const bodyData = rowsChunk.map((r) => {
      const isW16 = isFinalWeekHighlight && String(r.week).includes('16');
      return [
        { content: isW16 ? '★ 16' : safeStr(r.week), styles: { halign: 'center' as const, fontStyle: 'bold' as const, fillColor: isW16 ? GOLD_LIGHT : GRAY_BG } },
        { content: safeStr(r.phase), styles: { fontStyle: (isW16 ? 'bold' : 'normal') as 'bold' | 'normal', fillColor: isW16 ? GOLD_LIGHT : undefined } },
        { content: safeStr(r.uac), styles: { fontStyle: (isW16 ? 'bold' : 'normal') as 'bold' | 'normal', fillColor: isW16 ? GOLD_LIGHT : undefined } },
        { content: safeStr(r.activity), styles: { fillColor: isW16 ? GOLD_LIGHT : undefined } },
        { content: safeStr(r.progression), styles: { fillColor: isW16 ? GOLD_LIGHT : undefined } },
        { content: safeStr(r.strategy), styles: { fillColor: isW16 ? GOLD_LIGHT : undefined } },
        { content: safeStr(r.responsibles), styles: { fillColor: isW16 ? GOLD_LIGHT : undefined } },
        { content: safeStr(r.evaluationInstrument), styles: { fillColor: isW16 ? GOLD_LIGHT : undefined } },
      ];
    });

    autoTable(doc, {
      startY: curY,
      head: [
        [
          { content: 'Sem.', styles: { halign: 'center', cellWidth: 10 } },
          { content: 'Fase PEC', styles: { cellWidth: 26 } },
          { content: 'Materias / UAC', styles: { cellWidth: 32 } },
          { content: 'Actividad Situada de Campo', styles: { cellWidth: 54 } },
          { content: 'Progresión MCCEMS', styles: { cellWidth: 46 } },
          { content: 'Estrategia Didáctica', styles: { cellWidth: 30 } },
          { content: 'Responsables', styles: { cellWidth: 26 } },
          { content: 'Instrumento de Evaluación', styles: { cellWidth: cW - 224 } },
        ],
      ],
      body: bodyData,
      theme: 'grid',
      showHead: 'everyPage',
      styles: { fontSize: 7, cellPadding: 2.2, overflow: 'linebreak' },
      headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
      columnStyles: {
        0: { halign: 'center' },
      },
      margin: { left: margin, right: margin, top: 20, bottom: 20 },
    });
  };

  // Semestre A: Paginación dinámica por fases sin recortar filas
  const blocksA = partitionPlanRows(planA);
  const phaseSubtitlesA = [
    '(Fase I: Diagnóstico)',
    '(Fase II: Diseño)',
    '(Fase III: Gestión)',
    '(Fase IV: Ejecución)',
  ];
  blocksA.forEach((b, idx) => {
    if (b.rows.length > 0) {
      formatLandscapePlanChunk(
        b.rows,
        'Macro-Fase III (A): Plan Operativo Territorial — Semestre A',
        `${b.rangeLabel} ${phaseSubtitlesA[idx] || ''}`
      );
    }
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // MACRO-FASE III (B): PLAN OPERATIVO — SEMESTRE B (EN LANDSCAPE)
  // ═════════════════════════════════════════════════════════════════════════════
  const blocksB = partitionPlanRows(planB);
  const phaseSubtitlesB = [
    '(Fase IV: Intervención)',
    '(Fase V: Monitoreo)',
    '(Fase V: Evaluación)',
    '(Fase VI: Cierre y Feria Comunitaria)',
  ];
  blocksB.forEach((b, idx) => {
    if (b.rows.length > 0) {
      formatLandscapePlanChunk(
        b.rows,
        'Macro-Fase III (B): Plan Operativo Territorial — Semestre B',
        `${b.rangeLabel} ${phaseSubtitlesB[idx] || ''}`,
        idx === 3 // isFinalWeekHighlight para Feria Comunitaria en Sem 16
      );
    }
  });


  state.curY = curY;
}
