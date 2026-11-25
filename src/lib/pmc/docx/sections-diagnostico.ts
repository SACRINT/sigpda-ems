import {
  Paragraph,
  TextRun,
  Table,
  TableRow,
  AlignmentType,
  BorderStyle,
  PageBreak,
} from 'docx';
import { SCHOOL_YEAR } from '@/lib/config';
import type { PmcMetaInstitucional } from '@/types/pmc';
import {
  computePmcIndicatorValues,
  type PmcStatisticalContext,
} from '@/lib/pmc-indicator-calculator';
import {
  PMC_TITULOS_SECCIONES,
  PMC_SUBSECCIONES_DIAGNOSTICO,
  PMC_SECCIONES_CANONICAS,
  shouldSectionPageBreak,
  clasificarNormativaJerarquica,
  getObjetivoPmcText,
  getTextoInfraestructura,
  getTextoBeneficiosComunitarios,
  getPmcCategoryTheme,
  PMC_CUADRO_2_CATEGORIAS,
} from '@/lib/pmc-document-structure';
import {
  C,
  CONTENT,
  tc,
  tcH,
  tcSub,
  tbl,
  secHeading,
  subHeading,
  bodyPara,
  gap,
  safeStr,
  type PmcProject,
  type DiagnosticoGenerado,
  type IndicadoresAcademicos,
  type FodaData,
  type NormativaDoc,
  type MetaInstitucional,
} from './helpers';

// ─── Cover Page ──────────────────────────────────────────────────────────────
export function buildCoverPage(p: PmcProject): (Paragraph | Table)[] {
  const today = new Date().toLocaleDateString('es-MX', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const rows: (Paragraph | Table)[] = [
    new Paragraph({ spacing: { before: 0, after: 60 }, children: [] }),
    // Logo-like header block
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 40 },
      children: [
        new TextRun({
          text: 'GOBIERNO DEL ESTADO DE PUEBLA',
          bold: true,
          size: 20,
          color: C.navy,
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 40 },
      children: [
        new TextRun({
          text: 'SECRETARÍA DE EDUCACIÓN PÚBLICA DEL ESTADO',
          bold: true,
          size: 20,
          color: C.navy,
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 160 },
      children: [
        new TextRun({
          text: 'DIRECCIÓN DE EDUCACIÓN MEDIA SUPERIOR',
          bold: true,
          size: 20,
          color: C.navy,
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 80 },
      border: {
        top: { style: BorderStyle.SINGLE, size: 24, color: C.navy },
        bottom: { style: BorderStyle.SINGLE, size: 24, color: C.navy },
      },
      children: [
        new TextRun({
          text: 'PLAN DE MEJORA CONTINUA',
          bold: true,
          size: 48,
          color: C.navy,
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 80, after: 240 },
      children: [
        new TextRun({
          text: `Ciclo Escolar ${safeStr(p.ciclo_escolar) || '2025-2026'}`,
          bold: true,
          size: 32,
          color: C.accent,
          font: 'Arial',
        }),
      ],
    }),
    // Info table
    tbl(
      [
        new TableRow({ children: [tcH('DATOS DEL PLANTEL', { span: 2 })] }),
        new TableRow({ children: [tcSub('Nombre del Plantel'), tc(safeStr(p.school_name))] }),
        new TableRow({ children: [tcSub('CCT'), tc(safeStr(p.school_cct))] }),
        new TableRow({ children: [tcSub('Municipio'), tc(safeStr(p.municipality))] }),
        new TableRow({ children: [tcSub('Localidad'), tc(safeStr(p.locality))] }),
        new TableRow({ children: [tcSub('Zona Escolar'), tc(safeStr(p.school_zone))] }),
        new TableRow({ children: [tcSub('Subsistema'), tc(safeStr(p.subsystem) || 'BGE')] }),
        new TableRow({ children: [tcSub('Director(a)'), tc(safeStr(p.director_name))] }),
        new TableRow({ children: [tcSub('Supervisor(a)'), tc(safeStr(p.supervisor_name))] }),
        new TableRow({ children: [tcSub('Fecha de elaboración'), tc(today)] }),
      ],
      [CONTENT / 3, (CONTENT * 2) / 3]
    ),
    ...gap(2),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `Puebla, Pue., ${today}`,
          size: 20,
          color: C.muted,
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({ children: [new PageBreak()] }),
  ];

  return rows;
}

// ─── Índice General ──────────────────────────────────────────────────────────
export function buildIndice(): (Paragraph | Table)[] {
  const items: (Paragraph | Table)[] = [
    secHeading('ÍNDICE GENERAL'),
    bodyPara('Estructura general del Programa de Mejora Continua (PMC) conforme a los lineamientos oficiales de la Dirección de Bachilleratos Estatales y Preparatoria Abierta (DBEPA Puebla):'),
    ...gap(),
  ];

  const colNumW = 1000;
  const colPagW = 1200;
  const colTitW = CONTENT - colNumW - colPagW;

  const tocRows: TableRow[] = [
    new TableRow({
      children: [
        tcH('N°', { w: colNumW, align: AlignmentType.CENTER }),
        tcH('Contenido Temático / Capítulo Oficial', { w: colTitW }),
        tcH('Sección', { w: colPagW, align: AlignmentType.CENTER }),
      ],
    }),
  ];

  for (const sec of PMC_SECCIONES_CANONICAS) {
    tocRows.push(
      new TableRow({
        children: [
          tc(String(sec.numero), { w: colNumW, bold: true, align: AlignmentType.CENTER, fill: C.alt }),
          tc(sec.titulo, { w: colTitW, bold: true, fill: C.alt }),
          tc(`Cap. ${sec.numero}`, { w: colPagW, bold: true, align: AlignmentType.CENTER, fill: C.alt }),
        ],
      })
    );
    if (sec.subsecciones) {
      for (const sub of sec.subsecciones) {
        tocRows.push(
          new TableRow({
            children: [
              tc(sub.numero, { w: colNumW, align: AlignmentType.CENTER }),
              tc(`    ${sub.titulo}`, { w: colTitW, italics: true, color: C.muted }),
              tc(sub.numero, { w: colPagW, align: AlignmentType.CENTER, italics: true, color: C.muted }),
            ],
          })
        );
      }
    }
  }

  items.push(tbl(tocRows, [colNumW, colTitW, colPagW]));
  if (shouldSectionPageBreak(PMC_TITULOS_SECCIONES.PRESENTACION)) {
    items.push(new Paragraph({ children: [new PageBreak()] }));
  }
  return items;
}

// ─── 1. Presentación ─────────────────────────────────────────────────────────
export function buildPresentacion(diag: DiagnosticoGenerado, project: PmcProject): (Paragraph | Table)[] {
  const textoPresentacion = safeStr(diag.presentacion) ||
    `El ${safeStr(project.school_name, 'plantel escolar')}, con CCT ${safeStr(project.school_cct, 'N/D')} y ubicado en la localidad de ${safeStr(project.locality, 'N/D')}, municipio de ${safeStr(project.municipality, 'N/D')}, Puebla, presenta su Programa de Mejora Continua (PMC) para el ciclo escolar ${safeStr(project.ciclo_escolar, SCHOOL_YEAR)}. Este instrumento de planeación directiva se fundamenta en el artículo 3° de la Constitución Política de los Estados Unidos Mexicanos, garantizando el derecho humano a la educación con un enfoque de equidad, excelencia y mejora continua, alineado con el Modelo Educativo de la Nueva Escuela Mexicana (NEM), el Marco Curricular Común de la Educación Media Superior (MCCEMS) y los ejes rectores de la política educativa estatal CREAA.`;

  return [
    secHeading(PMC_TITULOS_SECCIONES.PRESENTACION),
    bodyPara(textoPresentacion),
    ...gap(),
    ...(shouldSectionPageBreak(PMC_TITULOS_SECCIONES.OBJETIVO)
      ? [new Paragraph({ children: [new PageBreak()] })]
      : []),
  ];
}

// ─── 2. Objetivo del PMC ─────────────────────────────────────────────────────
export function buildObjetivo(project: PmcProject): (Paragraph | Table)[] {
  const objGeneral = getObjetivoPmcText(project.school_name, project.ciclo_escolar);

  return [
    secHeading(PMC_TITULOS_SECCIONES.OBJETIVO),
    subHeading('Objetivo General:'),
    bodyPara(objGeneral),
    ...gap(),
    subHeading('Objetivos Específicos y Estratégicos:'),
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      bullet: { level: 0 },
      spacing: { before: 40, after: 40 },
      children: [
        new TextRun({
          text: 'Fortalecer los aprendizajes de trayectoria de las y los aprendientes en los Recursos Sociocognitivos fundamentales (Pensamiento Matemático, Lengua y Comunicación, Conciencia Histórica y Cultura Digital).',
          size: 19,
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      bullet: { level: 0 },
      spacing: { before: 40, after: 40 },
      children: [
        new TextRun({
          text: 'Disminuir las tasas de deserción y reprobación escolar mediante estrategias integrales de tutoría, alertas tempranas y acompañamiento docente situado.',
          size: 19,
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      bullet: { level: 0 },
      spacing: { before: 40, after: 40 },
      children: [
        new TextRun({
          text: 'Promover la vinculación activa y corresponsable con la comunidad escolar y el entorno territorial a través del Proyecto Escolar Comunitario (PAEC-PEC).',
          size: 19,
          font: 'Arial',
        }),
      ],
    }),
    ...gap(),
    ...(shouldSectionPageBreak(PMC_TITULOS_SECCIONES.NORMATIVIDAD)
      ? [new Paragraph({ children: [new PageBreak()] })]
      : []),
  ];
}

// ─── 3. Marco Normativo Jerarquizado ─────────────────────────────────────────
export function buildNormativa(normativa?: NormativaDoc | null): (Paragraph | Table)[] {
  const normDocs = (Array.isArray(normativa?.documentos) && normativa.documentos.length > 0)
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

  const grupos = clasificarNormativaJerarquica(normDocs);

  const rawDesc = safeStr(normativa?.descripcion);
  const descripcion = (rawDesc ? rawDesc.replace(/14\/08\/22/g, '09/08/23') : '') ||
    'El presente Plan de Mejora Continua (PMC) se sustenta en el marco jurídico y normativo vigente para el Bachillerato General del Estado de Puebla (BGE), en el marco del MCCEMS y la Subsecretaría de Educación Media Superior.';

  const items: (Paragraph | Table)[] = [
    secHeading(PMC_TITULOS_SECCIONES.NORMATIVIDAD),
    bodyPara(descripcion),
    ...gap(),
  ];

  for (const grp of grupos) {
    items.push(
      new Paragraph({
        spacing: { before: 200, after: 100 },
        children: [
          new TextRun({
            text: grp.categoria,
            bold: true,
            size: 21,
            color: C.navy,
            font: 'Arial',
          }),
        ],
      })
    );

    const headerRow = new TableRow({
      tableHeader: true,
      children: [
        tcH('#', { w: 600, align: AlignmentType.CENTER }),
        tcH('Disposición Legal / Normativa', { w: 3100 }),
        tcH('Artículos Aplicables', { w: 2800 }),
        tcH('Justificación de Inclusión en el PMC', { w: 4300 }),
      ],
    });

    const rows: TableRow[] = [headerRow];
    grp.documentos.forEach((doc, idx) => {
      const fill = idx % 2 === 0 ? C.white : C.alt;
      const articulosTexto = Array.isArray(doc.articulos) && doc.articulos.length > 0
        ? doc.articulos.join(', ')
        : 'Disposición general';
      const justificacionTexto = safeStr(
        doc.justificacion,
        'Sustenta la planeación estratégica y metas formativas del plantel.'
      );

      rows.push(
        new TableRow({
          children: [
            tc(String(doc.orden ?? idx + 1), { w: 600, fill, bold: true, align: AlignmentType.CENTER }),
            tc(safeStr(doc.titulo), { w: 3100, fill, bold: true }),
            tc(articulosTexto, { w: 2800, fill }),
            tc(justificacionTexto, { w: 4300, fill }),
          ],
        })
      );
    });

    items.push(
      tbl(rows, [600, 3100, 2800, 4300]),
      ...gap(1)
    );
  }

  if (shouldSectionPageBreak(PMC_TITULOS_SECCIONES.DIAGNOSTICO)) {
    items.push(new Paragraph({ children: [new PageBreak()] }));
  }
  return items;
}

// ─── 4. Diagnóstico ──────────────────────────────────────────────────────────
export function buildDiagnostico(
  diag: DiagnosticoGenerado,
  indic: IndicadoresAcademicos,
  foda: FodaData,
  statsCtx?: PmcStatisticalContext | null,
  project?: PmcProject
): (Paragraph | Table)[] {
  const items: (Paragraph | Table)[] = [secHeading(PMC_TITULOS_SECCIONES.DIAGNOSTICO)];

  // 4.1 Contexto Socioeducativo y Territorial
  items.push(subHeading(PMC_SUBSECCIONES_DIAGNOSTICO.CONTEXTO));
  const contextoText = safeStr(diag.contexto || project?.diagnostico_comunidad) ||
    'El plantel se ubica en un entorno que exige una intervención directiva basada en la gestión comunitaria, atendiendo las características socioculturales y desafíos de movilidad de la población escolar.';
  items.push(bodyPara(contextoText));
  items.push(...gap());

  // 4.2 Indicadores Académicos (Línea Base vs Meta)
  items.push(subHeading(PMC_SUBSECCIONES_DIAGNOSTICO.INDICADORES));
  const indVals = computePmcIndicatorValues(indic, statsCtx);
  items.push(
    tbl(
      [
        new TableRow({
          children: [
            tcH('Indicador Oficial'),
            tcH('Ciclo Anterior (Línea Base)', { align: AlignmentType.CENTER }),
            tcH('Meta Ciclo Actual', { align: AlignmentType.CENTER }),
          ],
        }),
        new TableRow({
          children: [
            tc('Índice de Aprobación Escolar'),
            tc(indVals.aprobacion.ant, { align: AlignmentType.CENTER }),
            tc(indVals.aprobacion.meta, { align: AlignmentType.CENTER }),
          ],
        }),
        new TableRow({
          children: [
            tc('Índice de Reprobación Escolar', { fill: C.alt }),
            tc(indVals.reprobacion.ant, { align: AlignmentType.CENTER, fill: C.alt }),
            tc(indVals.reprobacion.meta, { align: AlignmentType.CENTER, fill: C.alt }),
          ],
        }),
        new TableRow({
          children: [
            tc('Tasa de Abandono Escolar'),
            tc(indVals.abandono.ant, { align: AlignmentType.CENTER }),
            tc(indVals.abandono.meta, { align: AlignmentType.CENTER }),
          ],
        }),
        new TableRow({
          children: [
            tc('Eficiencia Terminal', { fill: C.alt }),
            tc(indVals.eficiencia.ant, { align: AlignmentType.CENTER, fill: C.alt }),
            tc(indVals.eficiencia.meta, { align: AlignmentType.CENTER, fill: C.alt }),
          ],
        }),
        new TableRow({
          children: [
            tc('Matrícula Escolar Oficial (911)'),
            tc(indVals.matricula.ant, { align: AlignmentType.CENTER }),
            tc(indVals.matricula.meta, { align: AlignmentType.CENTER }),
          ],
        }),
      ],
      [CONTENT / 2, CONTENT / 4, CONTENT / 4]
    )
  );

  if (diag.analisis_indicadores) {
    items.push(...gap());
    items.push(bodyPara(diag.analisis_indicadores));
  }
  items.push(...gap());

  // 4.3 Infraestructura y Equipamiento Escolar
  items.push(subHeading(PMC_SUBSECCIONES_DIAGNOSTICO.INFRAESTRUCTURA));
  items.push(bodyPara(getTextoInfraestructura(project)));
  items.push(...gap());

  // 4.4 Beneficios y Vinculación Comunitaria
  items.push(subHeading(PMC_SUBSECCIONES_DIAGNOSTICO.BENEFICIOS));
  items.push(bodyPara(getTextoBeneficiosComunitarios(project)));
  items.push(...gap());

  // 4.5 Matriz FODA Situacional
  items.push(subHeading(PMC_SUBSECCIONES_DIAGNOSTICO.FODA));
  items.push(
    tbl(
      [
        new TableRow({
          children: [
            tcH('FACTORES INTERNOS', { align: AlignmentType.CENTER, span: 2 }),
          ],
        }),
        new TableRow({
          children: [
            tcH('FORTALEZAS (F)', { align: AlignmentType.CENTER }),
            tcH('DEBILIDADES (D)', { align: AlignmentType.CENTER, fill: '#B71C1C' }),
          ],
        }),
        new TableRow({
          children: [
            tc(safeStr(foda.fortalezas, 'Compromiso docente, trabajo colegiado y procesos estandarizados.'), { fill: '#E8F5E9' }),
            tc(safeStr(foda.debilidades, 'Rezago académico de ingreso y recursos tecnológicos limitados.'), { fill: '#FFEBEE' }),
          ],
        }),
        new TableRow({
          children: [
            tcH('FACTORES EXTERNOS', { align: AlignmentType.CENTER, span: 2 }),
          ],
        }),
        new TableRow({
          children: [
            tcH('OPORTUNIDADES (O)', { align: AlignmentType.CENTER }),
            tcH('AMENAZAS (A)', { align: AlignmentType.CENTER, fill: '#E65100' }),
          ],
        }),
        new TableRow({
          children: [
            tc(safeStr(foda.oportunidades, 'Vinculación con Telesecundarias y gestión de infraestructura comunitaria.'), { fill: '#E3F2FD' }),
            tc(safeStr(foda.amenazas, 'Condiciones geográficas complejas y limitaciones de transporte público.'), { fill: '#FFF3E0' }),
          ],
        }),
      ],
      [CONTENT / 2, CONTENT / 2]
    )
  );

  if (diag.sintesis_foda) {
    items.push(...gap());
    items.push(bodyPara(diag.sintesis_foda));
  }

  if (shouldSectionPageBreak(PMC_TITULOS_SECCIONES.PRIORIZACION)) {
    items.push(new Paragraph({ children: [new PageBreak()] }));
  }
  return items;
}

// ─── 5. Priorización de Categorías ───────────────────────────────────────────
export function buildPriorizacion(
  diag: DiagnosticoGenerado,
  categorias: Array<{ id?: string; nombre?: string; temas?: string[] }>
): (Paragraph | Table)[] {
  const items: (Paragraph | Table)[] = [secHeading(PMC_TITULOS_SECCIONES.PRIORIZACION)];

  const textoPrio = safeStr(diag.priorizacion) ||
    'Para el ciclo escolar se establecen las categorías y ámbitos de acción estratégicos orientados a atender las problemáticas prioritarias detectadas en el diagnóstico socioeducativo, bajo la política CREAA.';
  items.push(bodyPara(textoPrio));
  items.push(...gap());

  const catList = Array.isArray(categorias) && categorias.length > 0
    ? categorias
    : [
        { id: 'categoria_1', nombre: PMC_CUADRO_2_CATEGORIAS.categoria_1.nombreOficial, temas: ['Indicadores académicos (reprobación, eficiencia terminal y abandono escolar)', 'Formación y actualización docente'] },
        { id: 'categoria_2', nombre: PMC_CUADRO_2_CATEGORIAS.categoria_2.nombreOficial, temas: ['Seguimiento al desempeño docente en el aula', 'Vinculación con instituciones educativas, empresas o fundaciones'] },
        { id: 'categoria_3', nombre: PMC_CUADRO_2_CATEGORIAS.categoria_3.nombreOficial, temas: ['Estrategias y proyectos para la erradicación de la violencia y cultura de paz', 'Promoción de hábitos de vida saludable'] },
      ];

  items.push(
    tbl(
      [
        new TableRow({
          children: [
            tcH('N°', { w: 800 }),
            tcH('Categoría Priorizada (Política CREAA - Cuadro 2)', { w: Math.floor(CONTENT * 0.42) }),
            tcH('Temas y Ámbitos de Intervención Seleccionados', { w: CONTENT - 800 - Math.floor(CONTENT * 0.42) }),
          ],
        }),
        ...catList.map((cat, i) => {
          const theme = getPmcCategoryTheme(cat.nombre || cat.id, (cat.temas || []).join(' '));
          const temasText = Array.isArray(cat.temas) && cat.temas.length > 0
            ? cat.temas.map((t) => `• ${t}`).join('\n')
            : 'Todos los ámbitos prioritarios aplicables';
          return new TableRow({
            children: [
              tc(String(i + 1), {
                w: 800,
                align: AlignmentType.CENTER,
                bold: true,
                fill: theme.colorBgEcoHex,
                color: theme.colorTextAccentHex,
              }),
              tc(safeStr(cat.nombre || `${theme.categoriaTitulo}: ${theme.nombreOficial}`), {
                bold: true,
                fill: theme.colorBgEcoHex,
                color: theme.colorTextAccentHex,
              }),
              tc(temasText, {
                fill: C.white,
              }),
            ],
          });
        }),
      ],
      [800, Math.floor(CONTENT * 0.42), CONTENT - 800 - Math.floor(CONTENT * 0.42)]
    )
  );

  if (shouldSectionPageBreak(PMC_TITULOS_SECCIONES.PLAN_ACCION)) {
    items.push(new Paragraph({ children: [new PageBreak()] }));
  }
  return items;
}

export interface AreaObligatoriaConfig {
  id: string;
  titulo: string;
  keywords: RegExp;
  strictKeywords?: RegExp;
}

export const AREAS_OBLIGATORIAS_51: AreaObligatoriaConfig[] = [
  {
    id: 'area-1-indicadores',
    titulo: 'Indicadores académicos (reprobación, eficiencia terminal y abandono escolar)',
    keywords: /(indicador|aprobaci[oó]n|reprobaci[oó]n|abandono|eficiencia terminal|académic|rezago|matemátic)/i,
    strictKeywords: /(indicadores acad[eé]micos|aprobaci[oó]n escolar|reprobaci[oó]n escolar|abandono escolar|eficiencia terminal)/i,
  },
  {
    id: 'area-2-desempeno-docente',
    titulo: 'Seguimiento al desempeño docente en el aula',
    keywords: /(desempeño docente|acompañamiento pedag[oó]gico|observaci[oó]n (?:de |en el )?aula|pr[aá]ctica docente|visitas? [aá]ulicas?|retroalimentaci[oó]n docente|desempeño en el aula)/i,
    strictKeywords: /(seguimiento al desempeño docente|desempeño docente en el aula|acompañamiento pedag[oó]gico|visitas? [aá]ulicas?)/i,
  },
  {
    id: 'area-3-vinculacion',
    titulo: 'Vinculación con centros educativos, empresas, fundaciones o instituciones públicas',
    keywords: /(vinculaci[oó]n|convenios? (?:de colaboraci[oó]n|con)|sector productivo|centros educativos|instituciones p[uú]blicas|empresas|fundaci[oó]n|educaci[oó]n superior)/i,
    strictKeywords: /(vinculaci[oó]n con instituciones|vinculaci[oó]n con centros|vinculaci[oó]n con empresas|convenios? de colaboraci[oó]n)/i,
  },
  {
    id: 'area-4-violencia',
    titulo: 'Estrategias, programas y/o proyectos sobre violencia',
    keywords: /(violencia|cultura de paz|convivencia (?:escolar|pac[ií]fica)|acoso escolar|resoluci[oó]n pac[ií]fica|seguridad escolar|prevenci[oó]n de la violencia)/i,
    strictKeywords: /(proyectos? sobre violencia|prevenci[oó]n de la violencia|cultura de paz|convivencia pac[ií]fica)/i,
  },
];

export const PENDIENTE_DEFINICION_51 = 'Pendiente de definición por el colectivo docente';

export interface ResolvedArea51 {
  metaEstablecida: string;
  estrategiaImp: string;
  personalDes: string;
  productoComp: string;
  subcatVinc: string;
  situacionActual: string;
  matchingMeta?: MetaInstitucional | PmcMetaInstitucional;
}

export function resolveAreaObligatoria51(
  area: AreaObligatoriaConfig,
  metas: (MetaInstitucional | PmcMetaInstitucional)[],
  usedIndices?: Set<number>
): ResolvedArea51 {
  let matchingMeta: MetaInstitucional | PmcMetaInstitucional | undefined;
  let matchingIdx = -1;

  // 1. Coincidencia estricta en tema o subcategorías vinculadas (sin reutilizar índices previos)
  for (let i = 0; i < metas.length; i++) {
    if (usedIndices && usedIndices.has(i)) continue;
    const m = metas[i];
    const temaSubcats = `${m.tema || ''} ${(m.subcategorias_vinculadas || []).join(' ')}`;
    if (area.strictKeywords && area.strictKeywords.test(temaSubcats)) {
      matchingMeta = m;
      matchingIdx = i;
      break;
    }
  }

  // 2. Coincidencia general en tema o subcategorías
  if (!matchingMeta) {
    for (let i = 0; i < metas.length; i++) {
      if (usedIndices && usedIndices.has(i)) continue;
      const m = metas[i];
      const temaSubcats = `${m.tema || ''} ${(m.subcategorias_vinculadas || []).join(' ')}`;
      if (area.keywords.test(temaSubcats)) {
        matchingMeta = m;
        matchingIdx = i;
        break;
      }
    }
  }

  // 3. Coincidencia en cuerpo de la meta evitando captura de falsos positivos
  if (!matchingMeta) {
    for (let i = 0; i < metas.length; i++) {
      if (usedIndices && usedIndices.has(i)) continue;
      const m = metas[i];
      const fullText = `${m.tema || ''} ${m.nombre_categoria || ''} ${m.meta || ''} ${(m.subcategorias_vinculadas || []).join(' ')}`;
      if (area.keywords.test(fullText)) {
        matchingMeta = m;
        matchingIdx = i;
        break;
      }
    }
  }

  if (matchingMeta && matchingIdx !== -1 && usedIndices) {
    usedIndices.add(matchingIdx);
  }

  const metaEstablecida = matchingMeta?.meta ? safeStr(matchingMeta.meta) : PENDIENTE_DEFINICION_51;
  const estrategiaImp = matchingMeta?.estrategia ? safeStr(matchingMeta.estrategia) : PENDIENTE_DEFINICION_51;
  const personalDes = matchingMeta?.personal_designado ? safeStr(matchingMeta.personal_designado) : PENDIENTE_DEFINICION_51;
  const productoComp = matchingMeta?.entregable ? safeStr(matchingMeta.entregable) : PENDIENTE_DEFINICION_51;
  const subcatVinc = (Array.isArray(matchingMeta?.subcategorias_vinculadas) && matchingMeta.subcategorias_vinculadas.length > 0)
    ? matchingMeta.subcategorias_vinculadas.join(', ')
    : (matchingMeta?.tema || matchingMeta?.nombre_categoria || PENDIENTE_DEFINICION_51);
  const situacionPartsArea = [matchingMeta?.necesidad, matchingMeta?.diagnostico_meta].filter(Boolean);
  const situacionActual = situacionPartsArea.length > 0
    ? situacionPartsArea.join(' — ')
    : (matchingMeta?.linea_base ? safeStr(matchingMeta.linea_base) : PENDIENTE_DEFINICION_51);

  return {
    metaEstablecida,
    estrategiaImp,
    personalDes,
    productoComp,
    subcatVinc,
    situacionActual,
    matchingMeta,
  };
}

