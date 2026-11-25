/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Paragraph,
  TextRun,
  Table,
  TableRow,
  AlignmentType,
  PageBreak,
} from 'docx';
import { SCHOOL_YEAR } from '@/lib/config';
import type {
  PaecProject,
  TableRow2Cols,
  MapeoRow,
  CronogramaRow,
  DetalleCurricularRow,
} from '@/types/paec';
import {
  C,
  safeStr,
  parseFodaData,
  tc,
  tcH,
  tblP,
  macroH,
  secH,
  para,
  sp,
  type PaecDocxContext,
} from './helpers';

export function buildPaecDocxSection1(ctx: PaecDocxContext): {
  children: (Paragraph | Table)[];
  communityLabel: string;
} {
  const { p, sCtx, cCtx, teacherName, zonaTexto } = ctx;

  // ═════════════════════════════════════════════════════════════════════════════
  // SECCIÓN 1 (PORTRAIT): PORTADA, MACRO-FASE I Y MACRO-FASE II
  // ═════════════════════════════════════════════════════════════════════════════
  const s1Children: (Paragraph | Table)[] = [];

  // --- PORTADA OFICIAL (Página 1) ---
  s1Children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 400, after: 60 },
      children: [
        new TextRun({ text: 'GOBIERNO DEL ESTADO DE PUEBLA', bold: true, size: 24, color: C.dark, font: 'Arial' }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 20, after: 40 },
      children: [
        new TextRun({ text: 'SECRETARÍA DE EDUCACIÓN PÚBLICA DEL ESTADO', bold: true, size: 20, color: C.mid, font: 'Arial' }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 20, after: 80 },
      children: [
        new TextRun({ text: 'SUBSECRETARÍA DE EDUCACIÓN OBLIGATORIA', size: 18, color: C.textMuted, font: 'Arial' }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 20, after: 260 },
      children: [
        new TextRun({
          text: 'DIRECCIÓN DE EDUCACIÓN MEDIA SUPERIOR',
          bold: true,
          size: 19,
          color: C.dark,
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 180, after: 80 },
      children: [
        new TextRun({
          text: 'PROYECTO ESCOLAR COMUNITARIO (PEC)',
          bold: true,
          size: 32, // 16pt
          color: C.dark,
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 20, after: 120 },
      children: [
        new TextRun({
          text: 'PROGRAMA AULA, ESCUELA Y COMUNIDAD (PAEC)',
          bold: true,
          size: 26, // 13pt
          color: C.mid,
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 40, after: 360 },
      children: [
        new TextRun({
          text: `MARCO CURRICULAR COMÚN DE LA EMS (MCCEMS) · CICLO ESCOLAR ${SCHOOL_YEAR}`,
          bold: true,
          size: 20,
          color: C.accent,
          font: 'Arial',
        }),
      ],
    })
  );

  // Cédula Técnica Institucional del Proyecto
  const communityLabel = (cCtx as Record<string, any>).communityName || cCtx.location || 'Comunidad Territorial';
  const cedulaRows: TableRow[] = [
    new TableRow({
      children: [tcH('CÉDULA OFICIAL DE IDENTIFICACIÓN INSTITUCIONAL DEL PROYECTO', { span: 2, size: 20 })],
    }),
    new TableRow({
      children: [
        tc('Nombre del Proyecto:', { bold: true, color: C.dark, w: 3200 }),
        tc(safeStr(p.projectName), { bold: true, w: 7600 }),
      ],
    }),
    new TableRow({
      children: [
        tc('Problemática Seleccionada:', { bold: true, color: C.dark, w: 3200 }),
        tc(safeStr(p.problemStatement), { w: 7600 }),
      ],
    }),
    new TableRow({
      children: [
        tc('Plantel Educativo:', { bold: true, color: C.dark, w: 3200 }),
        tc(safeStr(sCtx.schoolName), { w: 7600 }),
      ],
    }),
    new TableRow({
      children: [
        tc('Clave de Centro de Trabajo (CCT):', { bold: true, color: C.dark, w: 3200 }),
        tc(safeStr(sCtx.cct), { bold: true, w: 7600 }),
      ],
    }),
    new TableRow({
      children: [
        tc('Zona Escolar / Municipio / Localidad:', { bold: true, color: C.dark, w: 3200 }),
        tc(`${zonaTexto} | ${safeStr(sCtx.municipality)} | ${safeStr(sCtx.locality)}`, { w: 7600 }),
      ],
    }),
    new TableRow({
      children: [
        tc('Comunidad / Territorio de Impacto:', { bold: true, color: C.dark, w: 3200 }),
        tc(`${safeStr(communityLabel)} (${safeStr(cCtx.location)})`, { w: 7600 }),
      ],
    }),
    new TableRow({
      children: [
        tc('Tipo de Ciclo Operativo:', { bold: true, color: C.dark, w: 3200 }),
        tc(
          p.cycleType === 'A'
            ? 'Semestre A (Semestres 1, 3 y 5 - 16 Semanas)'
            : p.cycleType === 'B'
            ? 'Semestre B (Semestres 2, 4 y 6 - 16 Semanas)'
            : 'Ciclo Escolar Completo Anual (Semestres A y B - 32 Semanas)',
          { bold: true, w: 7600 }
        ),
      ],
    }),
    new TableRow({
      children: [
        tc('Docente Coordinador / Responsable:', { bold: true, color: C.dark, w: 3200 }),
        tc(safeStr(teacherName, 'Docente Coordinador de Proyecto'), { w: 7600 }),
      ],
    }),
    new TableRow({
      children: [
        tc('Población Escolar y Docente:', { bold: true, color: C.dark, w: 3200 }),
        tc(`Matrícula Estudiantil: ${safeStr(sCtx.enrollment, 'S/D')} alumnos | Personal Docente: ${safeStr(sCtx.teacherCount, 'S/D')} docentes`, { w: 7600 }),
      ],
    }),
    new TableRow({
      children: [
        tc('Fecha Oficial de Registro y Emisión:', { bold: true, color: C.dark, w: 3200 }),
        tc(new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }), { w: 7600 }),
      ],
    }),
  ];
  s1Children.push(tblP(cedulaRows, [3200, 7600]));
  s1Children.push(sp());

  // Salto de página para iniciar Macro-Fase I
  s1Children.push(new Paragraph({ children: [new PageBreak()] }));

  // --- MACRO-FASE I: DIAGNÓSTICO COLECTIVO ---
  s1Children.push(...macroH('Macro-Fase I: Diagnóstico Colectivo y Contextualización Comunitaria'));

  // 1. Diagnóstico Comunitario (Tabla 1)
  s1Children.push(secH('1.1 Diagnóstico Comunitario Integral (Tabla 1)'));
  s1Children.push(para('Análisis multidimensional de las condiciones socioeconómicas, culturales, ambientales y demográficas del entorno territorial del plantel:'));

  const t1Data: TableRow2Cols[] = p.fase1Diagnostico?.tabla1 || (p.fase1Diagnostico as Record<string, any>)?.tabla1Comunidad || [];
  const t1Widths = [3600, 7200];
  const t1Rows: TableRow[] = [
    new TableRow({
      children: [
        tcH('Aspecto del Diagnóstico Comunitario', { w: 3600 }),
        tcH('Descripción y Hallazgos Relevantes en el Entorno', { w: 7200 }),
      ],
    }),
  ];
  if (t1Data.length === 0) {
    t1Rows.push(
      new TableRow({
        children: [tc('Sin registros de diagnóstico comunitario.', { span: 2, italics: true })],
      })
    );
  } else {
    t1Data.forEach((r: any, idx) => {
      const col1 = r.col1 || r.aspecto || r.aspect || `Aspecto ${idx + 1}`;
      const col2 = r.col2 || r.descripcion || r.analysis || 'Sin descripción';
      t1Rows.push(
        new TableRow({
          children: [
            tc(safeStr(col1), { w: 3600, bold: true, fill: idx % 2 === 1 ? C.alt : C.white }),
            tc(safeStr(col2), { w: 7200, fill: idx % 2 === 1 ? C.alt : C.white }),
          ],
        })
      );
    });
  }
  s1Children.push(tblP(t1Rows, t1Widths));
  s1Children.push(sp());

  // 2. Diagnóstico del Centro Educativo (Tabla 2)
  s1Children.push(secH('1.2 Diagnóstico del Centro Educativo (Tabla 2)'));
  s1Children.push(para('Evaluación de la infraestructura física, matrícula, cobertura académica, fortalezas docentes y ambiente escolar del plantel:'));

  const t2Data: TableRow2Cols[] = p.fase1Diagnostico?.tabla2 || (p.fase1Diagnostico as Record<string, any>)?.tabla2Educacion || [];
  const t2Rows: TableRow[] = [
    new TableRow({
      children: [
        tcH('Indicador del Contexto Escolar', { w: 3600 }),
        tcH('Situación Actual y Capacidad Instalada', { w: 7200 }),
      ],
    }),
  ];
  if (t2Data.length === 0) {
    t2Rows.push(
      new TableRow({
        children: [tc('Sin registros de diagnóstico educativo escolar.', { span: 2, italics: true })],
      })
    );
  } else {
    t2Data.forEach((r: any, idx) => {
      const col1 = r.col1 || r.aspecto || r.aspect || `Indicador ${idx + 1}`;
      const col2 = r.col2 || r.descripcion || r.analysis || 'Sin descripción';
      t2Rows.push(
        new TableRow({
          children: [
            tc(safeStr(col1), { w: 3600, bold: true, fill: idx % 2 === 1 ? C.alt : C.white }),
            tc(safeStr(col2), { w: 7200, fill: idx % 2 === 1 ? C.alt : C.white }),
          ],
        })
      );
    });
  }
  s1Children.push(tblP(t2Rows, t1Widths));
  s1Children.push(sp());

  // 3. Matriz FODA Integral con Estrategia Cruzada 4x2 (Tabla 3)
  s1Children.push(secH('1.3 Matriz FODA con Estrategia Cruzada 4×2 (Tabla 3 / NEM)'));
  s1Children.push(para('Articulación estratégica de variables internas y externas del centro escolar con formulación de líneas maestras de acción educativa (Estrategias FO, DO, FA, DA):'));

  // Procesar datos FODA con normalización y fallbacks pedagógicos oficiales MCCEMS
  const rawT3: any = p.fase1Diagnostico?.tabla3;
  const { fortalezas, oportunidades, debilidades, amenazas, estFO, estDO, estFA, estDA } = parseFodaData(rawT3);

  const fodaRows: TableRow[] = [
    new TableRow({
      children: [
        tcH('Eje de Diagnóstico FODA (Factores)', { w: 4600 }),
        tcH('Estrategia Cruzada Derivada (FO, DO, FA, DA)', { w: 6200 }),
      ],
    }),
    new TableRow({
      children: [
        tc(
          [
            new Paragraph({ children: [new TextRun({ text: '🟢 FORTALEZAS (Factores Internos)', bold: true, color: C.dark })] }),
            ...fortalezas.map((item) => new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: item, size: 18 })] })),
          ],
          { w: 4600, fill: C.alt }
        ),
        tc(
          [
            new Paragraph({ children: [new TextRun({ text: 'Estrategia FO (Maxi-Maxi):', bold: true, color: C.mid })] }),
            new Paragraph({ children: [new TextRun({ text: estFO, size: 18 })] }),
          ],
          { w: 6200 }
        ),
      ],
    }),
    new TableRow({
      children: [
        tc(
          [
            new Paragraph({ children: [new TextRun({ text: '🔵 OPORTUNIDADES (Factores Externos)', bold: true, color: C.dark })] }),
            ...oportunidades.map((item) => new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: item, size: 18 })] })),
          ],
          { w: 4600, fill: C.white }
        ),
        tc(
          [
            new Paragraph({ children: [new TextRun({ text: 'Estrategia DO (Mini-Maxi):', bold: true, color: C.mid })] }),
            new Paragraph({ children: [new TextRun({ text: estDO, size: 18 })] }),
          ],
          { w: 6200 }
        ),
      ],
    }),
    new TableRow({
      children: [
        tc(
          [
            new Paragraph({ children: [new TextRun({ text: '🟡 DEBILIDADES (Factores Internos)', bold: true, color: C.dark })] }),
            ...debilidades.map((item) => new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: item, size: 18 })] })),
          ],
          { w: 4600, fill: C.alt }
        ),
        tc(
          [
            new Paragraph({ children: [new TextRun({ text: 'Estrategia FA (Maxi-Mini):', bold: true, color: C.mid })] }),
            new Paragraph({ children: [new TextRun({ text: estFA, size: 18 })] }),
          ],
          { w: 6200 }
        ),
      ],
    }),
    new TableRow({
      children: [
        tc(
          [
            new Paragraph({ children: [new TextRun({ text: '🔴 AMENAZAS (Factores Externos)', bold: true, color: C.dark })] }),
            ...amenazas.map((item) => new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: item, size: 18 })] })),
          ],
          { w: 4600, fill: C.white }
        ),
        tc(
          [
            new Paragraph({ children: [new TextRun({ text: 'Estrategia DA (Mini-Mini):', bold: true, color: C.mid })] }),
            new Paragraph({ children: [new TextRun({ text: estDA, size: 18 })] }),
          ],
          { w: 6200 }
        ),
      ],
    }),
  ];
  s1Children.push(tblP(fodaRows, [4600, 6200]));
  s1Children.push(sp());

  // 4. Proceso Técnico de Priorización (Tabla 4)
  s1Children.push(secH('1.4 Proceso Técnico de Priorización del Problema Comunitario (Tabla 4)'));
  s1Children.push(para('Documentación de las etapas metodológicas obligatorias para la selección sustentada de la problemática eje comunitaria:'));

  const t4Data: TableRow2Cols[] = p.fase1Diagnostico?.tabla4 || (p.fase1Diagnostico as Record<string, any>)?.tabla4Problemas || [];
  const t4Widths = [3600, 7200];
  const t4Rows: TableRow[] = [
    new TableRow({
      children: [
        tcH('Etapa Metodológica de Selección', { w: 3600 }),
        tcH('Descripción del Proceso y Consensos Logrados', { w: 7200 }),
      ],
    }),
  ];
  if (t4Data.length === 0) {
    t4Rows.push(
      new TableRow({
        children: [tc('Sin etapas registradas en la priorización del problema.', { span: 2, italics: true })],
      })
    );
  } else {
    t4Data.forEach((r: any, idx) => {
      const col1 = r.col1 || r.etapa || `Etapa ${idx + 1}`;
      const col2 = r.col2 || r.descripcion || 'Sin descripción';
      t4Rows.push(
        new TableRow({
          children: [
            tc(safeStr(col1), { w: 3600, bold: true, fill: idx % 2 === 1 ? C.alt : C.white }),
            tc(safeStr(col2), { w: 7200, fill: idx % 2 === 1 ? C.alt : C.white }),
          ],
        })
      );
    });
  }
  s1Children.push(tblP(t4Rows, t4Widths));
  s1Children.push(sp());

  // Salto de página para Macro-Fase II
  s1Children.push(new Paragraph({ children: [new PageBreak()] }));

  // --- MACRO-FASE II: JUSTIFICACIÓN Y DISEÑO CURRICULAR ---
  s1Children.push(...macroH('Macro-Fase II: Justificación Pedagógica y Diseño Curricular (MCCEMS)'));

  const j = (p.fase2Justificacion || {}) as Partial<NonNullable<PaecProject['fase2Justificacion']>> & Record<string, any>; // fallback tipado defensivo

  // 1. Justificación y Fundamentación NEM
  s1Children.push(secH('2.1 Fundamentación y Justificación del Proyecto'));
  s1Children.push(para(safeStr(j.introduction, 'El presente Proyecto Escolar Comunitario se fundamenta en las directrices de la Nueva Escuela Mexicana, articulando el conocimiento científico, humanístico y tecnológico con la solución situada de los retos presentes en el entorno escolar y comunitario.')));
  s1Children.push(sp());

  // Pilares de la NEM
  s1Children.push(secH('2.2 Pilares de la Nueva Escuela Mexicana Incorporados'));
  const pilares: string[] = j.pilares || [
    'Fomento de la identidad con México',
    'Responsabilidad ciudadana y social',
    'Honestidad como valor fundamental',
    'Participación en la transformación de la sociedad',
    'Respeto de la dignidad humana y cultura de paz',
    'Promoción de la interculturalidad',
    'Cuidado y preservación del medio ambiente',
  ];
  pilares.forEach((pilar) => {
    s1Children.push(
      new Paragraph({
        bullet: { level: 0 },
        spacing: { before: 30, after: 30 },
        children: [new TextRun({ text: pilar, size: 20, font: 'Arial' })],
      })
    );
  });
  s1Children.push(sp());

  // Propósitos Educativo, Social y Funcional
  s1Children.push(secH('2.3 Propósitos Integrales del Proyecto (MIFO / MCCEMS)'));
  const prop = (j.proposito || {}) as Record<string, any>;
  const propRows: TableRow[] = [
    new TableRow({ children: [tcH('Dimensión del Propósito', { w: 3200 }), tcH('Definición y Alcance Institucional', { w: 7600 })] }),
    new TableRow({
      children: [
        tc('Propósito Educativo:', { bold: true, color: C.dark, w: 3200 }),
        tc(safeStr(prop.educativo, 'Fortalecer el pensamiento crítico, las habilidades científicas y el trabajo interdisciplinario de los estudiantes a través del aprendizaje activo situado.'), { w: 7600 }),
      ],
    }),
    new TableRow({
      children: [
        tc('Propósito Social:', { bold: true, color: C.dark, w: 3200 }),
        tc(safeStr(prop.social, 'Promover la cohesión comunitaria, la participación ciudadana y el mejoramiento directo del bienestar territorial.'), { w: 7600 }),
      ],
    }),
    new TableRow({
      children: [
        tc('Propósito Funcional:', { bold: true, color: C.dark, w: 3200 }),
        tc(safeStr(prop.funcional, 'Desarrollar productos, soluciones técnicas e intervenciones tangibles con impacto demostrable y sostenible en el entorno.'), { w: 7600 }),
      ],
    }),
  ];
  s1Children.push(tblP(propRows, [3200, 7600]));
  s1Children.push(sp());

  // Alcance y Metas
  s1Children.push(secH('2.4 Alcance, Participantes y Recursos'));
  const alcance = (j.alcance || {}) as Record<string, any>;
  const metas: string[] = alcance.metas || [];
  const partList: string[] = alcance.participantes || [];
  const recList: string[] = alcance.recursos || [];

  const objRows: TableRow[] = [
    new TableRow({ children: [tcH('Categoría', { w: 3200 }), tcH('Detalle Operativo', { w: 7600 })] }),
    new TableRow({
      children: [
        tc('Metas Cuantificables:', { bold: true, color: C.dark, w: 3200 }),
        tc(metas.length > 0 ? metas.map((m) => new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: m, size: 18 })] })) : 'Metas plenamente vinculadas con el perfil de egreso.'),
      ],
    }),
    new TableRow({
      children: [
        tc('Comunidad Participante:', { bold: true, color: C.dark, w: 3200 }),
        tc(partList.length > 0 ? partList.map((part) => new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: part, size: 18 })] })) : 'Alumnado, colegiado docente, autoridades comunitarias y familias.'),
      ],
    }),
    new TableRow({
      children: [
        tc('Recursos e Infraestructura:', { bold: true, color: C.dark, w: 3200 }),
        tc(recList.length > 0 ? recList.map((r) => new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: r, size: 18 })] })) : 'Recursos escolares, espacios públicos y donaciones de aliados.'),
      ],
    }),
  ];
  s1Children.push(tblP(objRows, [3200, 7600]));
  s1Children.push(sp());

  // 2. Mapeo Curricular Integral (100% UACs)
  s1Children.push(secH('2.5 Mapeo Curricular Integral y Cobertura Multidisciplinaria'));
  s1Children.push(para('Articulación vinculante de todas las Unidades de Aprendizaje Curricular (UAC) participantes con el problema eje del PEC:'));

  const mapeo: MapeoRow[] = p.fase2Mapeo || [];
  const mapWidths = [1200, 3200, 2400, 1200, 2800]; // Sum: 10800
  const mapRows: TableRow[] = [
    new TableRow({
      children: [
        tcH('Sem.', { w: 1200 }),
        tcH('Unidad de Aprendizaje (UAC)', { w: 3200 }),
        tcH('Eje Temático / Progresión', { w: 2400 }),
        tcH('Hrs/Sem', { w: 1200 }),
        tcH('Vinculación con el Proyecto Comunitario', { w: 2800 }),
      ],
    }),
  ];
  if (mapeo.length === 0) {
    mapRows.push(new TableRow({ children: [tc('Sin asignaturas registradas en el mapeo curricular.', { span: 5, italics: true })] }));
  } else {
    mapeo.forEach((r: any, idx) => {
      const sem = r.semester || r.semestre || 1;
      const uac = r.uacName || r.uac || 'UAC';
      const topic = r.topic || r.progresion || 'Eje temático';
      const linking = r.linking || r.vinculacion || 'Vinculación comunitaria';
      const hrs = r.horasSemanales || 4;

      mapRows.push(
        new TableRow({
          children: [
            tc(`${sem}°`, { w: 1200, bold: true, align: AlignmentType.CENTER, fill: idx % 2 === 1 ? C.alt : C.white }),
            tc(safeStr(uac), { w: 3200, bold: true, fill: idx % 2 === 1 ? C.alt : C.white }),
            tc(safeStr(topic), { w: 2400, fill: idx % 2 === 1 ? C.alt : C.white }),
            tc(`${hrs} h`, { w: 1200, align: AlignmentType.CENTER, fill: idx % 2 === 1 ? C.alt : C.white }),
            tc(safeStr(linking), { w: 2800, fill: idx % 2 === 1 ? C.alt : C.white }),
          ],
        })
      );
    });
  }
  s1Children.push(tblP(mapRows, mapWidths));
  s1Children.push(sp());

  // 3. Cronograma Bimestral Macro (6 fases x 5 columnas)
  s1Children.push(secH('2.6 Cronograma Bimestral Macro del Proyecto (6 Fases Oficiales)'));
  s1Children.push(para('Estructuración temporal por bimestres con identificación del liderazgo pedagógico de las Asignaturas Viga Maestra:'));

  const crono: CronogramaRow[] = p.fase2Cronograma || [];
  const cronoWidths = [2400, 2200, 2600, 2200, 1400]; // Sum: 10800 DXA
  const cronoRows: TableRow[] = [
    new TableRow({
      children: [
        tcH('Fase Temática y Periodo', { w: 2400 }),
        tcH('Propósito / Objetivo', { w: 2200 }),
        tcH('Actividades Macro', { w: 2600 }),
        tcH('Asignaturas Viga Maestra', { w: 2200 }),
        tcH('Semestre(s)', { w: 1400 }),
      ],
    }),
  ];
  if (crono.length === 0) {
    cronoRows.push(new TableRow({ children: [tc('Sin fases bimestrales registradas en el cronograma macro.', { span: 5, italics: true })] }));
  } else {
    crono.forEach((r: any, idx) => {
      const rawTitle = (r as any).phaseTitle || (r as any).tituloTematico || '';
      const rawPhase = r.phase || r.faseBimestral || `Fase ${idx + 1}`;
      const fase = rawTitle && !rawPhase.includes(rawTitle) ? `${rawPhase}: ${rawTitle}` : rawPhase;
      const obj = r.objective || r.objetivo || 'Propósito formativo';
      const act = r.macroActivities || r.actividad || 'Actividades de fase';
      const uacs = r.responsibleSubjects || r.uacParticipantes || 'Colegiado Docente';
      const sem = r.semesterInvolved || r.semestre || (r.semester ? `Semestre ${r.semester}` : 'Todos los semestres');

      cronoRows.push(
        new TableRow({
          children: [
            tc(safeStr(fase), { w: 2400, bold: true, fill: idx % 2 === 1 ? C.alt : C.white }),
            tc(safeStr(obj), { w: 2200, fill: idx % 2 === 1 ? C.alt : C.white }),
            tc(safeStr(act), { w: 2600, fill: idx % 2 === 1 ? C.alt : C.white }),
            tc(safeStr(uacs), { w: 2200, fill: idx % 2 === 1 ? C.alt : C.white }),
            tc(safeStr(sem), { w: 1400, fill: idx % 2 === 1 ? C.alt : C.white }),
          ],
        })
      );
    });
  }
  s1Children.push(tblP(cronoRows, cronoWidths));
  s1Children.push(sp());

  // 4. Detalle Curricular y Progresiones de Aprendizaje
  s1Children.push(secH('2.7 Detalle Curricular: Progresiones y Propósitos Formativos'));
  s1Children.push(para('Desglose técnico de progresiones y metas de aprendizaje vinculadas con cada fase del PEC:'));

  const detalle: DetalleCurricularRow[] = p.fase2DetalleCurricular || [];
  const detWidths = [1000, 2200, 1400, 2400, 2200, 1600]; // Sum: 10800
  const detRows: TableRow[] = [
    new TableRow({
      children: [
        tcH('Sem.', { w: 1000 }),
        tcH('UAC / Materia', { w: 2200 }),
        tcH('Fase PEC', { w: 1400 }),
        tcH('Progresiones / Propósitos Formativos', { w: 2400 }),
        tcH('Estrategia Didáctica y Evaluación', { w: 2200 }),
        tcH('Horas / Resp.', { w: 1600 }),
      ],
    }),
  ];
  if (detalle.length === 0) {
    detRows.push(new TableRow({ children: [tc('Sin registros en el detalle curricular.', { span: 6, italics: true })] }));
  } else {
    detalle.forEach((r: any, idx) => {
      const sem = r.semester || r.semestre || 1;
      const uac = r.uacName || r.uac || 'UAC';
      const fase = r.projectPhases || r.fasePec || 'Fase I-VI';
      const prog = r.progressionsOrPurposes || r.progresionesOPropositos || 'Progresiones del MCCEMS';
      const just = r.curricularJustification || r.estrategiaEnsenanza || 'Aprendizaje situado';
      const resp = r.responsables || 'Academia Colegiada';

      detRows.push(
        new TableRow({
          children: [
            tc(`${sem}°`, { w: 1000, bold: true, align: AlignmentType.CENTER, fill: idx % 2 === 1 ? C.alt : C.white }),
            tc(safeStr(uac), { w: 2200, bold: true, fill: idx % 2 === 1 ? C.alt : C.white }),
            tc(safeStr(fase), { w: 1400, fill: idx % 2 === 1 ? C.alt : C.white }),
            tc(safeStr(prog), { w: 2400, fill: idx % 2 === 1 ? C.alt : C.white }),
            tc(safeStr(just), { w: 2200, fill: idx % 2 === 1 ? C.alt : C.white }),
            tc(safeStr(resp), { w: 1600, fill: idx % 2 === 1 ? C.alt : C.white }),
          ],
        })
      );
    });
  }
  s1Children.push(tblP(detRows, detWidths));


  return { children: s1Children, communityLabel };
}
