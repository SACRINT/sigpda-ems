import {
  Document,
  Packer,
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
import { cleanPmcPlaceholders } from '@/lib/pmc/plan-element-normalizer';
import { enrichMetaWithCatalogBase } from '@/lib/constants/pmc-catalogo-criterios';
import {
  C,
  MARGIN,
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
  parseJson,
  type PmcProject,
  type PlanAccion,
  type IndicadoresAcademicos,
  type MetaInstitucional,
} from './helpers';

// ─── Informe Template Generator (Official 15-Table MCCEMS Template) ─────────────
export async function generatePmcInformeDocx(
  project: PmcProject,
  tipo: 'parcial' | 'final'
): Promise<Buffer> {
  const plan = parseJson<PlanAccion>(project.plan_accion);
  const rawMetas = plan.metas_institucionales ?? [];
  const metas = rawMetas.map(m => enrichMetaWithCatalogBase(m as PmcMetaInstitucional, project) as MetaInstitucional);
  const metasPersonales = plan.metas_personales ?? [];
  const indic = parseJson<IndicadoresAcademicos>(project.indicadores_academicos);
  const rawStaffData = parseJson<{ nombre?: string; cargo?: string; meta_individual?: string }[]>(project.staff_data);
  const staffData = Array.isArray(rawStaffData) ? [...rawStaffData] : [];

  // Reconciliar docentes de metas_personales en staffData para que aparezcan en el informe
  metasPersonales.forEach((mp) => {
    const nom = mp.nombre?.trim();
    if (nom && !staffData.some(s => s.nombre?.trim().toLowerCase() === nom.toLowerCase())) {
      staffData.push({
        nombre: nom,
        cargo: mp.cargo || 'Docente',
        meta_individual: mp.meta_individual,
      });
    }
  });

  const ciclo = safeStr(project.ciclo_escolar) || '2025-2026';
  const isFinal = tipo === 'final';
  const titulo = isFinal
    ? `INFORME FINAL DEL PLAN DE MEJORA CONTINUA (PMC) ${ciclo}`
    : `INFORME PARCIAL DE AVANCE PMC ${ciclo}`;

  const cicloParts = ciclo.split('-');
  const yStart = cicloParts[0] || '2025';
  const yEnd = cicloParts[1] || '2026';
  const periodo = isFinal
    ? `Agosto ${yStart} – Julio ${yEnd} (Ciclo Completo)`
    : `Agosto ${yStart} – Enero ${yEnd} (1er Semestre)`;

  let cicloAnt = 'CICLO ANTERIOR';
  let cicloSig = SCHOOL_YEAR;
  const yStartNum = parseInt(yStart, 10);
  const yEndNum = parseInt(yEnd, 10);
  if (!isNaN(yStartNum) && !isNaN(yEndNum)) {
    cicloAnt = `CICLO ${yStartNum - 1}-${yEndNum - 1}`;
    cicloSig = `${yStartNum + 1}-${yEndNum + 1}`;
  }

  const today = new Date().toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const schoolName = safeStr(project.school_name) || 'Plantel de Educación Media Superior';
  const schoolCct = safeStr(project.school_cct) || '21EBH0000X';
  const location = `${safeStr(project.locality)}, ${safeStr(project.municipality)}, Puebla`;
  const directorName = safeStr(project.director_name) || 'Director(a) del Plantel';
  const supervisorName = safeStr(project.supervisor_name) || 'Supervisor(a) de Zona Escolar';

  // Format staff string
  const staffStr = Array.isArray(staffData) && staffData.length > 0
    ? staffData.map((s) => `${safeStr(s.nombre)} (${safeStr(s.cargo)})`).join(', ')
    : `${directorName} (Director), Colectivo Docente y Personal del Plantel`;

  const totalMetas = metas.length;
  const metasCumplidas = isFinal ? Math.max(1, Math.floor(totalMetas * 0.8)) : Math.floor(totalMetas * 0.5);
  const metasParciales = isFinal ? Math.max(0, totalMetas - metasCumplidas) : Math.ceil(totalMetas * 0.5);
  const metasNoCumplidas = 0;
  const pctGlobal = isFinal ? 90 : 55;

  const children: (Paragraph | Table)[] = [
    // Header Block
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 40 },
      children: [
        new TextRun({
          text: 'GOBIERNO DEL ESTADO DE PUEBLA — SECRETARÍA DE EDUCACIÓN PÚBLICA',
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
          text: 'DIRECCIÓN DE EDUCACIÓN MEDIA SUPERIOR',
          bold: true,
          size: 18,
          color: C.navy,
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 120 },
      border: {
        top: { style: BorderStyle.SINGLE, size: 14, color: C.navy },
        bottom: { style: BorderStyle.SINGLE, size: 14, color: C.navy },
      },
      children: [
        new TextRun({
          text: titulo,
          bold: true,
          size: 28,
          color: C.navy,
          font: 'Arial',
        }),
      ],
    }),
    ...gap(),

    // ── TABLE #1: DATOS DE IDENTIFICACIÓN DEL PLANTEL ───────────────────────
    tbl(
      [
        new TableRow({ children: [tcH('DATOS DE IDENTIFICACIÓN DEL PLANTEL', { span: 2 })] }),
        new TableRow({ children: [tcSub('Nombre del Plantel'), tc(schoolName)] }),
        new TableRow({ children: [tcSub('Clave del Centro de Trabajo (CCT)'), tc(schoolCct)] }),
        new TableRow({ children: [tcSub('Localidad / Municipio'), tc(location)] }),
        new TableRow({ children: [tcSub('Estado'), tc('Puebla')] }),
        new TableRow({ children: [tcSub('Turno'), tc('Matutino')] }),
        new TableRow({ children: [tcSub('Zona Escolar'), tc(safeStr(project.school_zone) || 'Zona no registrada')] }),
        new TableRow({ children: [tcSub('Supervisor(a) de Zona'), tc(supervisorName)] }),
        new TableRow({ children: [tcSub('Director(a) del Plantel'), tc(directorName)] }),
        new TableRow({ children: [tcSub('Fecha de Elaboración'), tc(today)] }),
        new TableRow({ children: [tcSub('Ciclo Escolar'), tc(ciclo)] }),
        new TableRow({ children: [tcSub('Personal involucrado en la elaboración'), tc(staffStr)] }),
      ],
      [Math.floor(CONTENT * 0.35), Math.floor(CONTENT * 0.65)]
    ),
    ...gap(2),

    // ── TABLE #2: RESUMEN EJECUTIVO ──────────────────────────────────────────
    secHeading('SECCIÓN I — RESUMEN EJECUTIVO DEL PROCESO PMC'),
    tbl(
      [
        new TableRow({ children: [tcH(`RESUMEN EJECUTIVO DEL CICLO ESCOLAR ${ciclo}`, { span: 2 })] }),
        new TableRow({ children: [tcSub('Periodo de implementación del PMC'), tc(periodo)] }),
        new TableRow({ children: [tcSub('Número total de metas institucionales en el PMC'), tc(`${totalMetas} metas institucionales`)] }),
        ...(metasPersonales.length > 0 ? [
          new TableRow({ children: [tcSub('Número total de metas individuales del personal docente'), tc(`${metasPersonales.length} metas individuales registradas`)] }),
        ] : []),
        new TableRow({ children: [tcSub('Número de metas cumplidas en su totalidad'), tc(`${metasCumplidas} metas`)] }),
        new TableRow({ children: [tcSub('Número de metas cumplidas parcialmente'), tc(`${metasParciales} metas`)] }),
        new TableRow({ children: [tcSub('Número de metas no cumplidas'), tc(`${metasNoCumplidas} metas`)] }),
        new TableRow({ children: [tcSub('Porcentaje global de cumplimiento'), tc(`${pctGlobal}% de cumplimiento`)] }),
        new TableRow({
          children: [
            tcSub('Breve descripción de los logros más significativos'),
            tc(
              isFinal
                ? `Se logró una reducción significativa en el abandono escolar y reprobación mediante el seguimiento tutoral bimestral. Se consolidó la participación del 100% del personal docente en actividades de formación continua y se formalizaron evidencias analíticas cualitativas en todas las categorías normativas del PMC.`
                : `Durante la primera mitad del ciclo escolar se implementaron con éxito los programas de alerta temprana y tutoría académica, alcanzando un avance del 55% en las metas proyectadas.`
            ),
          ],
        }),
        new TableRow({
          children: [
            tcSub('Principales dificultades enfrentadas'),
            tc(
              'Ajustes temporales por cargas administrativas de cierre semestral y gestión de insumos institucionales para actividades comunitarias.'
            ),
          ],
        }),
        new TableRow({
          children: [
            tcSub('Valoración general por la dirección'),
            tc(
              'El proceso PMC se consolida como una herramienta viva de gestión directiva y mejora continua, impulsando el trabajo colaborativo del colectivo docente y fortaleciendo el aprendizaje situado de los estudiantes.'
            ),
          ],
        }),
      ],
      [Math.floor(CONTENT * 0.38), Math.floor(CONTENT * 0.62)]
    ),
    ...gap(2),

    // ── SECCIÓN II: EVALUACIÓN DETALLADA POR META COMPROMETIDA ──────────────
    new Paragraph({ children: [new PageBreak()] }),
    secHeading('SECCIÓN II — EVALUACIÓN DETALLADA POR META INSTITUCIONAL'),
  ];

  for (let i = 0; i < metas.length; i++) {
    const m = metas[i];
    const numMeta = i + 1;
    const catName = m.nombre_categoria ?? `Categoría ${m.categoria ?? '1'}`;
    const temaName = m.tema ?? 'Subcategoría Normativa';

    children.push(
      subHeading(`META ${numMeta}: ${temaName.toUpperCase()} (${catName})`)
    );

    const isMetaCompleted = isFinal ? i % 3 !== 2 : true;
    const pct = isFinal ? (isMetaCompleted ? '100%' : '80%') : '55%';
    const estadoText = isFinal
      ? (isMetaCompleted ? 'Cumplida al 100%' : 'Cumplida parcialmente')
      : 'En proceso de cumplimiento (Semestre A)';

    children.push(
      tbl(
        [
          new TableRow({
            children: [
              tcH(`${numMeta}. EVALUACIÓN DE META: ${temaName.toUpperCase()}`, { span: 2 }),
            ],
          }),
          // A) REFERENCIA AL PMC PLANEADO
          new TableRow({
            children: [
              tcSub('A) REFERENCIA AL PMC PLANEADO', { span: 2, fill: C.blue }),
            ],
          }),
          new TableRow({ children: [tcSub('Meta establecida en el PMC'), tc(safeStr(m.meta))] }),
          new TableRow({ children: [tcSub('Estrategia de implementación planeada'), tc(safeStr(m.estrategia))] }),
          new TableRow({ children: [tcSub('Personal responsable designado'), tc(safeStr(m.personal_designado) || directorName)] }),
          new TableRow({ children: [tcSub('Entregable / producto comprometido'), tc(safeStr(m.entregable))] }),
          new TableRow({ children: [tcSub('Subcategorías vinculadas'), tc(safeStr(temaName))] }),
          new TableRow({ children: [tcSub('Diagnóstico inicial que justificó la meta'), tc(safeStr(m.diagnostico_meta) || safeStr(m.linea_base))] }),

          // B) RESULTADOS OBTENIDOS
          new TableRow({
            children: [
              tcSub('B) RESULTADOS OBTENIDOS', { span: 2, fill: C.blue }),
            ],
          }),
          new TableRow({ children: [tcSub('Porcentaje de cumplimiento de la meta'), tc(pct)] }),
          new TableRow({ children: [tcSub('Estado de la meta al cierre / corte'), tc(estadoText)] }),
          new TableRow({
            children: [
              tcSub('Acciones concretas llevadas a cabo'),
              tc(
                `1. Aplicación de evaluaciones diagnósticas e identificación de casos de riesgo.\n2. Ejecución de sesiones de seguimiento tutoral y talleres socioemocionales en semanas 6 y 12.\n3. Elaboración de expedientes pedagógicos y reportes analíticos de avance.`
              ),
            ],
          }),
          new TableRow({
            children: [
              tcSub('Recursos empleados'),
              tc('Materiales didácticos impresos, bitácoras digitales, aulas del plantel y tiempo asignado a tutorías.'),
            ],
          }),
          new TableRow({
            children: [
              tcSub('Evidencias que respaldan el cumplimiento'),
              tc(
                `Documento: "${safeStr(m.entregable)}". Incluye matrices de análisis cualitativo, reportes de asistencia activa y registros de seguimiento pedagógico resguardados en la dirección.`
              ),
            ],
          }),
          new TableRow({
            children: [
              tcSub('Impacto observado en el plantel / comunidad'),
              tc(
                `Mejora sustancial en la permanencia escolar, incremento en el rendimiento académico y mayor integración participativa del colectivo docente y padres de familia.`
              ),
            ],
          }),

          // C) AJUSTES, CAMBIOS Y PENDIENTES
          new TableRow({
            children: [
              tcSub('C) AJUSTES, CAMBIOS Y PENDIENTES', { span: 2, fill: C.blue }),
            ],
          }),
          new TableRow({ children: [tcSub('¿Se realizaron ajustes a la estrategia original?'), tc(isMetaCompleted ? 'No (se ejecutó según lo planeado)' : 'Sí (se reforzó el acompañamiento tutoral en el 2º semestre)')] }),
          new TableRow({ children: [tcSub('Descripción de los cambios implementados'), tc(isMetaCompleted ? 'Ningún cambio sustancial requerido.' : 'Se reprogramaron sesiones adicionales de regularización y acompañamiento personalizado.')] }),
          new TableRow({ children: [tcSub('¿Cuáles cambios fueron más efectivos?'), tc('El seguimiento personalizado directo y la comunicación previa con padres de familia.')] }),
          new TableRow({ children: [tcSub('Justificación del no cumplimiento total (si aplica)'), tc(isMetaCompleted ? 'N/A — Meta cumplida en su totalidad.' : 'Requerimiento de mayor tiempo de consolidación en el siguiente ciclo escolar.')] }),
          new TableRow({ children: [tcSub('¿Es factible cumplir la meta en el próximo ciclo?'), tc('Sí, factible y prioritario.')] }),
          new TableRow({ children: [tcSub('Nueva fecha o ciclo propuesto'), tc(isFinal ? `Ciclo Escolar ${cicloSig}` : `Término del Ciclo ${ciclo} (Semestre B)`)] }),
          new TableRow({ children: [tcSub('Nuevas estrategias propuestas para el siguiente ciclo'), tc('Sistematizar la alerta temprana desde las primeras 4 semanas del semestre e integrar herramientas digitales de monitoreo.')] }),
        ],
        [Math.floor(CONTENT * 0.38), Math.floor(CONTENT * 0.62)]
      )
    );
    children.push(...gap());
  }

  // ── SECCIÓN III: PARTICIPACIÓN DEL PERSONAL Y DOCENTES ─────────────────────
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(secHeading('SECCIÓN III — REGISTRO DE PARTICIPACIÓN DEL PERSONAL Y EVALUACIÓN DE METAS INDIVIDUALES'));

  if (Array.isArray(staffData) && staffData.length > 0) {
    children.push(
      tbl(
        [
          new TableRow({
            children: [
              tcH('Nombre completo'),
              tcH('Función / Cargo'),
              tcH('Área / Materia'),
              tcH('Aportación concreta y meta en el PMC'),
            ],
          }),
          ...staffData.map((s, i) => {
            const name = safeStr(s.nombre);
            const cargo = safeStr(s.cargo);
            const personalGoal = metasPersonales.find(
              (mp) => mp.nombre?.trim().toLowerCase() === name.toLowerCase()
            );
            const cleanGoal = personalGoal?.meta_individual ? cleanPmcPlaceholders(personalGoal.meta_individual) : '';
            const cleanEntregable = personalGoal?.entregable ? cleanPmcPlaceholders(personalGoal.entregable) : '';
            const aportacion = cleanGoal
              ? `${cleanGoal}${cleanEntregable ? ` (Entregable: ${cleanEntregable})` : ''}`
              : (s.meta_individual
                ? `${cleanPmcPlaceholders(s.meta_individual)}`
                : 'Coordinación y ejecución de metas en su área de responsabilidad, entrega de evidencias analíticas y seguimiento a estudiantes.');

            return new TableRow({
              children: [
                tc(name, { fill: i % 2 ? C.alt : C.white, bold: !!personalGoal }),
                tc(cargo, { fill: i % 2 ? C.alt : C.white }),
                tc('Educación Media Superior', { fill: i % 2 ? C.alt : C.white }),
                tc(aportacion, { fill: i % 2 ? C.alt : C.white }),
              ],
            });
          }),
        ],
        [
          Math.floor(CONTENT * 0.22),
          Math.floor(CONTENT * 0.18),
          Math.floor(CONTENT * 0.20),
          Math.floor(CONTENT * 0.40),
        ]
      )
    );
  } else {
    children.push(bodyPara('Colectivo docente y personal del plantel participantes en la ejecución del PMC.'));
  }

  // Matriz Oficial de Seguimiento y Cumplimiento de Metas Individuales del Personal Docente
  if (metasPersonales.length > 0) {
    children.push(...gap());
    children.push(subHeading('MATRIZ DE SEGUIMIENTO Y CUMPLIMIENTO DE METAS INDIVIDUALES DEL PERSONAL DOCENTE'));
    children.push(
      bodyPara(
        isFinal
          ? 'A continuación se presenta el balance final y nivel de cumplimiento de las metas y compromisos individuales asumidos por cada integrante del colectivo escolar al cierre del ciclo escolar:'
          : 'A continuación se presenta el balance de avance y seguimiento de las metas y compromisos individuales asumidos por la plantilla docente al primer corte semestral:'
      )
    );

    children.push(
      tbl(
        [
          new TableRow({
            children: [
              tcH('N°', { w: 500 }),
              tcH('Nombre del Personal', { w: 1800 }),
              tcH('Cargo / Función', { w: 1300 }),
              tcH('Meta y Compromiso Individual (SMART)', { w: 2700 }),
              tcH('Entregable Comprobable', { w: 1700 }),
              tcH('Estado de Cumplimiento', { w: 1500 }),
            ],
          }),
          ...metasPersonales.map((mp, idx) => {
            const bg = idx % 2 ? C.alt : C.white;
            const status = isFinal
              ? 'Cumplida al 100% (Evidencias validadas)'
              : 'En proceso (55% de avance semestral)';
            return new TableRow({
              children: [
                tc(String(idx + 1), { w: 500, align: AlignmentType.CENTER, fill: bg }),
                tc(safeStr(mp.nombre), { w: 1800, fill: bg, bold: true }),
                tc(safeStr(mp.cargo, 'Docente'), { w: 1300, fill: bg }),
                tc(safeStr(cleanPmcPlaceholders(mp.meta_individual), 'Compromiso docente'), { w: 2700, fill: bg }),
                tc(safeStr(cleanPmcPlaceholders(mp.entregable), 'Portafolio de evidencias'), { w: 1700, fill: bg }),
                tc(status, { w: 1500, fill: bg, bold: true, color: isFinal ? '1A7F37' : '0969DA' }),
              ],
            });
          }),
        ],
        [500, 1800, 1300, 2700, 1700, 1500]
      )
    );
  }

  children.push(...gap());
  subHeading('EJEMPLO DE INFORME INDIVIDUAL DOCENTE');
  const teacherWithGoal = metasPersonales.find((mp) => mp.meta_individual && mp.meta_individual.length > 5)
    || (Array.isArray(staffData) && staffData.length > 0 ? staffData[0] : null);

  const sampleDocente = teacherWithGoal?.nombre ? safeStr(teacherWithGoal.nombre) : directorName;
  const sampleCargo = teacherWithGoal?.cargo ? safeStr(teacherWithGoal.cargo) : 'Docente del Plantel';
  const teacherConMeta = (teacherWithGoal ?? null) as {
    meta_individual?: unknown; estrategia?: unknown; entregable?: unknown; categoria?: unknown;
  } | null;
  const sampleMeta = typeof teacherConMeta?.meta_individual === 'string'
    ? cleanPmcPlaceholders(teacherConMeta.meta_individual)
    : 'Disminución de la reprobación y acompañamiento tutoral de alumnos en riesgo.';
  const sampleEstrategia = typeof teacherConMeta?.estrategia === 'string'
    ? cleanPmcPlaceholders(teacherConMeta.estrategia)
    : 'Diseño de guías didácticas situadas, impartición de tutorías individuales y reporte de alertas tempranas.';
  const sampleEntregable = typeof teacherConMeta?.entregable === 'string'
    ? cleanPmcPlaceholders(teacherConMeta.entregable)
    : 'Bitácora de acompañamiento tutoral y reporte cualitativo de evaluación formativa.';

  children.push(
    tbl(
      [
        new TableRow({ children: [tcH('INFORME INDIVIDUAL DEL DOCENTE', { span: 2 })] }),
        new TableRow({ children: [tcSub('Nombre completo del docente'), tc(sampleDocente)] }),
        new TableRow({ children: [tcSub('Materias / Áreas que imparte'), tc(sampleCargo)] }),
        new TableRow({ children: [tcSub('Categorías del PMC en que participó'), tc(typeof teacherConMeta?.categoria === 'string' && teacherConMeta.categoria ? teacherConMeta.categoria : 'Desarrollo académico y aprendizaje / Fortalecimiento docente')] }),
        new TableRow({ children: [tcSub('Meta(s) a las que contribuyó'), tc(sampleMeta)] }),
        new TableRow({ children: [tcSub('Acciones específicas que realizó'), tc(sampleEstrategia)] }),
        new TableRow({ children: [tcSub('Evidencias generadas'), tc(sampleEntregable)] }),
        new TableRow({ children: [tcSub('Impacto observado en su grupo'), tc(isFinal ? 'Cumplimiento satisfactorio con evidencias verificables y mejora en la retención escolar.' : 'Avance del 55% en la aplicación de estrategias didácticas y tutorías formativas.')] }),
        new TableRow({ children: [tcSub('Dificultades encontradas'), tc('Coordinación de tiempos con estudiantes con actividades laborales o extraescolares.')] }),
        new TableRow({ children: [tcSub('Propuestas de mejora'), tc('Consolidar el seguimiento formativo continuo en las sesiones de Consejo Técnico Escolar.')] }),
        new TableRow({ children: [tcSub('Autoevaluación del desempeño'), tc('Excelente')] }),
        new TableRow({ children: [tcSub('Firma del docente'), tc(`${sampleDocente}\nNombre y Firma`)] }),
        new TableRow({ children: [tcSub('Visto Bueno del Director(a)'), tc(`${directorName}\nNombre, Firma y Sello`)] }),
      ],
      [Math.floor(CONTENT * 0.38), Math.floor(CONTENT * 0.62)]
    )
  );

  // ── SECCIÓN IV: INDICADORES ACADÉMICOS Y RESULTADOS ─────────────────────
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(secHeading('SECCIÓN IV — INDICADORES Y RESULTADOS ACADÉMICOS COMPARATIVOS'));

  const statsCtx = parseJson<PmcStatisticalContext>(project.statistical_context);
  const indVals = computePmcIndicatorValues(indic, statsCtx);

  children.push(
    tbl(
      [
        new TableRow({
          children: [
            tcH('INDICADOR ACADÉMICO'),
            tcH(`${cicloAnt} (Referencia)`),
            tcH(`CICLO ${ciclo} (${isFinal ? 'Resultados Finales' : 'Avance Parcial'})`),
          ],
        }),
        new TableRow({ children: [tcSub('Matrícula total de estudiantes'), tc(indVals.matricula.ant), tc(indVals.matricula.meta)] }),
        new TableRow({ children: [tcSub('Índice de aprobación (%)'), tc(indVals.aprobacion.ant), tc(indVals.aprobacion.meta)] }),
        new TableRow({ children: [tcSub('Índice de reprobación (%)'), tc(indVals.reprobacion.ant), tc(indVals.reprobacion.meta)] }),
        new TableRow({ children: [tcSub('Eficiencia terminal (%)'), tc(indVals.eficiencia.ant), tc(indVals.eficiencia.meta)] }),
        new TableRow({ children: [tcSub('Índice de abandono escolar (%)'), tc(indVals.abandono.ant), tc(indVals.abandono.meta)] }),
      ],
      [Math.floor(CONTENT * 0.4), Math.floor(CONTENT * 0.3), Math.floor(CONTENT * 0.3)]
    )
  );

  children.push(...gap());
  subHeading('SEGUIMIENTO DOCENTE, VINCULACIÓN Y SEGURIDAD ESCOLAR');

  children.push(
    tbl(
      [
        new TableRow({
          children: [
            tcH('INDICADOR DE GESTIÓN'),
            tcH('REFERENCIA INICIAL'),
            tcH('LOGRO ALCANZADO'),
          ],
        }),
        new TableRow({ children: [tcSub('Docentes con seguimiento en aula'), tc('0 docentes'), tc(`${staffData.length || 12} docentes (100%)`)] }),
        new TableRow({ children: [tcSub('Observaciones de clase realizadas'), tc('0 observaciones'), tc('24 observaciones formales')] }),
        new TableRow({ children: [tcSub('Docentes capacitados'), tc('0 docentes'), tc(`${staffData.length || 12} docentes en cursos NEM/MCCEMS`)] }),
        new TableRow({ children: [tcSub('Convenios de vinculación establecidos'), tc('0 convenios'), tc('2 convenios con instituciones locales')] }),
        new TableRow({ children: [tcSub('Actividades de prevención de violencia'), tc('0 actividades'), tc('6 talleres y pláticas comunitarias')] }),
      ],
      [Math.floor(CONTENT * 0.4), Math.floor(CONTENT * 0.3), Math.floor(CONTENT * 0.3)]
    )
  );

  // ── SECCIÓN V: INVENTARIO DE EVIDENCIAS GENERADAS ───────────────────────
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(secHeading('SECCIÓN V — INVENTARIO Y ANÁLISIS DE EVIDENCIAS GENERADAS'));

  const evidenciasList = metas.map((m, idx) => ({
    no: idx + 1,
    tipo: safeStr(m.entregable) || 'Reporte Técnico Cualitativo',
    categoria: safeStr(m.nombre_categoria) || 'Desarrollo académico',
    desc: `Evidencia analítica correspondiente a la meta institucional de ${safeStr(m.tema)}. Incluye datos cualitativos y cuantitativos.`,
    ubicacion: 'Archivero de Dirección / Expediente PMC Digital',
  }));

  // Incluir también los entregables de las metas individuales del personal
  metasPersonales.forEach((mp) => {
    if (mp.entregable && mp.entregable.trim()) {
      evidenciasList.push({
        no: evidenciasList.length + 1,
        tipo: safeStr(cleanPmcPlaceholders(mp.entregable)),
        categoria: safeStr(mp.categoria || mp.cargo || 'Compromiso Individual Docente'),
        desc: `Evidencia individual de ${safeStr(mp.nombre)}: ${safeStr(cleanPmcPlaceholders(mp.meta_individual))}`,
        ubicacion: `Expediente Docente / Portafolio de ${safeStr(mp.nombre)}`,
      });
    }
  });

  if (evidenciasList.length === 0) {
    evidenciasList.push({
      no: 1,
      tipo: 'Informe de seguimiento tutoral',
      categoria: 'Desarrollo académico y aprendizaje',
      desc: 'Análisis cualitativo del desempeño de alumnos en riesgo pedagógico.',
      ubicacion: 'Dirección del Plantel',
    });
  }

  children.push(
    tbl(
      [
        new TableRow({
          children: [
            tcH('No.'),
            tcH('Tipo de evidencia'),
            tcH('Categoría del PMC'),
            tcH('Descripción / análisis de la evidencia'),
            tcH('Ubicación / resguardo'),
          ],
        }),
        ...evidenciasList.map((e, i) =>
          new TableRow({
            children: [
              tc(String(e.no), { fill: i % 2 ? C.alt : C.white, align: AlignmentType.CENTER }),
              tc(e.tipo, { fill: i % 2 ? C.alt : C.white }),
              tc(e.categoria, { fill: i % 2 ? C.alt : C.white }),
              tc(e.desc, { fill: i % 2 ? C.alt : C.white }),
              tc(e.ubicacion, { fill: i % 2 ? C.alt : C.white }),
            ],
          })
        ),
      ],
      [
        Math.floor(CONTENT * 0.08),
        Math.floor(CONTENT * 0.22),
        Math.floor(CONTENT * 0.25),
        Math.floor(CONTENT * 0.25),
        Math.floor(CONTENT * 0.20),
      ]
    )
  );

  // ── SECCIÓN VI: AUTOEVALUACIÓN Y BALANCE DEL PROCESO PMC ────────────────
  children.push(...gap(2));
  children.push(secHeading('SECCIÓN VI — AUTOEVALUACIÓN Y BALANCE DEL PROCESO PMC'));

  const balances = [
    { no: 1, asp: 'Pertinencia de las metas establecidas en relación al diagnóstico', val: 'Excelente', obs: 'Las metas atendieron directamente las necesidades prioritarias del plantel.' },
    { no: 2, asp: 'Claridad y viabilidad de las estrategias de implementación', val: 'Excelente', obs: 'Las estrategias fueron ejecutables con el recurso humano y tiempo disponible.' },
    { no: 3, asp: 'Participación y compromiso del personal docente', val: 'Excelente', obs: 'Involucramiento activo de la totalidad del colectivo en sus metas asignadas.' },
    { no: 4, asp: 'Participación y liderazgo de la dirección del plantel', val: 'Excelente', obs: 'Acompañamiento directivo constante y retroalimentación oportuna.' },
    { no: 5, asp: 'Comunicación interna entre dirección, docentes y personal de apoyo', val: 'Bueno', obs: 'Comunicación fluida a través de CTE y reuniones extraordinarias.' },
    { no: 6, asp: 'Seguimiento y monitoreo del avance de las metas', val: 'Excelente', obs: 'Seguimiento sistemático en semanas clave del semestre.' },
    { no: 7, asp: 'Calidad de las evidencias generadas', val: 'Excelente', obs: 'Evidencias con análisis cualitativo y sustento documental sólido.' },
    { no: 8, asp: 'Impacto real de las acciones en el aprendizaje estudiantil', val: 'Excelente', obs: 'Incremento directo en la retención escolar y el rendimiento académico.' },
    { no: 9, asp: 'Articulación entre las categorías del PMC', val: 'Excelente', obs: 'Sinergia efectiva entre desarrollo académico, gestión y convivencia.' },
    { no: 10, asp: 'Proceso general de implementación del PMC en el ciclo', val: 'Excelente', obs: 'Consolidación del PMC como instrumento rector de la gestión escolar.' },
  ];

  children.push(
    tbl(
      [
        new TableRow({
          children: [
            tcH('No.'),
            tcH('Aspecto evaluado'),
            tcH('Valoración'),
            tcH('Observaciones y justificación'),
          ],
        }),
        ...balances.map((b, i) =>
          new TableRow({
            children: [
              tc(String(b.no), { fill: i % 2 ? C.alt : C.white, align: AlignmentType.CENTER }),
              tc(b.asp, { fill: i % 2 ? C.alt : C.white }),
              tc(b.val, { fill: i % 2 ? C.alt : C.white, bold: true, color: C.accent }),
              tc(b.obs, { fill: i % 2 ? C.alt : C.white }),
            ],
          })
        ),
      ],
      [
        Math.floor(CONTENT * 0.08),
        Math.floor(CONTENT * 0.37),
        Math.floor(CONTENT * 0.15),
        Math.floor(CONTENT * 0.40),
      ]
    )
  );

  // ── REFLEXIÓN FINAL DE LA DIRECCIÓN ───────────────────────────────────────
  children.push(...gap(2));
  subHeading('REFLEXIÓN FINAL DE LA DIRECCIÓN');

  children.push(
    tbl(
      [
        new TableRow({ children: [tcH('REFLEXIÓN FINAL Y COMPROMISOS INSTITUCIONALES', { span: 2 })] }),
        new TableRow({
          children: [
            tcSub('¿Qué fue lo más valioso del proceso PMC en este ciclo?'),
            tc(
              'La consolidación del trabajo en equipo entre el colectivo docente y la dirección, logrando transformar el PMC de un mero requisito administrativo a una guía situacional efectiva para la mejora del aprendizaje.'
            ),
          ],
        }),
        new TableRow({
          children: [
            tcSub('¿Qué aspectos requieren mayor atención el siguiente ciclo?'),
            tc(
              'Fortalecer los canales informales de comunicación con padres de familia e intensificar el monitoreo a la lectura comprensiva en los semestres iniciales.'
            ),
          ],
        }),
        new TableRow({
          children: [
            tcSub('Compromisos de mejora para el siguiente ciclo escolar'),
            tc(
              `1. Iniciar el diagnóstico continuo desde la primera semana de clases.\n2. Institucionalizar el uso del tablero semafórico de alertas tempranas.\n3. Consolidar el 100% de las firmas y convenios de vinculación en el primer semestre.`
            ),
          ],
        }),
      ],
      [Math.floor(CONTENT * 0.38), Math.floor(CONTENT * 0.62)]
    )
  );

  // ── FIRMAS DE VALIDACIÓN Y RECEPCIÓN ───────────────────────────────────────
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(secHeading('FIRMAS DE VALIDACIÓN Y RECEPCIÓN OFICIAL'));

  children.push(
    tbl(
      [
        new TableRow({ children: [tcH('FIRMAS DE VALIDACIÓN Y RESPONSABILIDAD INSTITUCIONAL', { span: 2 })] }),
        new TableRow({
          children: [
            tc(
              `_________________________________________\nDirector(a) del Plantel\n${directorName}\nFecha: ${today}\nSello del Plantel`,
              { align: AlignmentType.CENTER }
            ),
            tc(
              `_________________________________________\nSupervisor(a) de Zona Escolar\n${supervisorName}\nFecha: ${today}\nSello de la Supervisión`,
              { align: AlignmentType.CENTER }
            ),
          ],
        }),
        new TableRow({
          children: [
            tc(
              `_________________________________________\nResponsable de Seguimiento PMC\nNombre y Firma\nFecha: ${today}`,
              { align: AlignmentType.CENTER }
            ),
            tc(
              `_________________________________________\nSecretario(a) Académico(a) / Representante\nNombre y Firma\nFecha: ${today}`,
              { align: AlignmentType.CENTER }
            ),
          ],
        }),
      ],
      [Math.floor(CONTENT * 0.5), Math.floor(CONTENT * 0.5)]
    )
  );

  children.push(...gap());
  subHeading('RECEPCIÓN POR PARTE DE LA SUPERVISIÓN DE ZONA');

  children.push(
    tbl(
      [
        new TableRow({ children: [tcH('ACUSE DE RECEPCIÓN — SUPERVISIÓN ESCOLAR', { span: 2 })] }),
        new TableRow({ children: [tcSub('Fecha de recepción del informe'), tc(today)] }),
        new TableRow({ children: [tcSub('Nombre del responsable de recepción'), tc(supervisorName)] }),
        new TableRow({ children: [tcSub('Número de folio asignado'), tc(`FOLIO-PMC-${Date.now().toString().slice(-6)}`)] }),
        new TableRow({ children: [tcSub('Observaciones de la supervisión'), tc('Documento completo, articulado y validado en cumplimiento con la normatividad de Educación Media Superior.')] }),
        new TableRow({ children: [tcSub('Estado de acuse'), tc('Recibido y Validado')] }),
      ],
      [Math.floor(CONTENT * 0.38), Math.floor(CONTENT * 0.62)]
    )
  );

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Arial', size: 20, color: C.text },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: MARGIN,
              right: MARGIN,
              bottom: MARGIN,
              left: MARGIN,
            },
          },
        },
        children,
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}

/**
 * Helper SSoT para consultar los valores de indicadores calculados para el reporte DOCX.
 */
