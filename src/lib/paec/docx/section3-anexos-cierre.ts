/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Paragraph,
  TextRun,
  Table,
  TableRow,
  AlignmentType,
  PageBreak,
} from 'docx';
import type {
  PaecProject,
  TableRow2Cols,
  SeguimientoRow,
  PaecMetaLogroRow,
} from '@/types/paec';
import {
  C,
  safeStr,
  tc,
  tcH,
  tblP,
  macroH,
  secH,
  para,
  sp,
  type PaecDocxContext,
} from './helpers';

export function buildPaecDocxSection3(
  ctx: PaecDocxContext,
  communityLabel: string
): (Paragraph | Table)[] {
  const { p, sCtx, teacherName, zonaNum, supervisionFirma, zonaFirmaTexto } = ctx;

  // ═════════════════════════════════════════════════════════════════════════════
  // SECCIÓN 3 (PORTRAIT): FORMALIZACIÓN, 6 ANEXOS, GOBERNANZA, INFORME Y FIRMAS
  // ═════════════════════════════════════════════════════════════════════════════
  const s3Children: (Paragraph | Table)[] = [];

  // --- FORMALIZACIÓN INSTITUCIONAL ---
  s3Children.push(...macroH('Macro-Fase III (C): Instrumentos de Formalización Institucional'));

  const imp = (p.fase3Implementacion || {}) as Partial<NonNullable<PaecProject['fase3Implementacion']>> & Record<string, any>; // fallback tipado defensivo

  // 1. Carta Convocatoria
  s3Children.push(secH('3.1 Carta de Convocatoria a la Asamblea Escolar y Comunitaria'));
  const carta = (imp.cartaInvitacion || {}) as Record<string, any>;
  const cartaRows: TableRow[] = [
    new TableRow({ children: [tc('Asunto Oficial:', { bold: true, color: C.dark, w: 2800 }), tc(safeStr(carta.asunto, 'Convocatoria a Asamblea General para Presentación del PEC'), { bold: true, w: 8000 })] }),
    new TableRow({ children: [tc('Fecha de Expedición:', { bold: true, color: C.dark, w: 2800 }), tc(safeStr(carta.fecha, new Date().toLocaleDateString('es-MX')), { w: 8000 })] }),
    new TableRow({ children: [tc('Destinatarios:', { bold: true, color: C.dark, w: 2800 }), tc(safeStr(carta.destinatarios, 'Padres de Familia, Autoridades Auxiliares y Líderes Comunitarios'), { w: 8000 })] }),
    new TableRow({ children: [tc('Cuerpo del Mensaje:', { bold: true, color: C.dark, w: 2800 }), tc(safeStr(carta.cuerpo, 'Por medio de la presente se convoca a la comunidad a participar en la asamblea de instalación del PEC.'), { w: 8000 })] }),
    new TableRow({
      children: [
        tc('Datos de la Sesión:', { bold: true, color: C.dark, w: 2800 }),
        tc(`Fecha: ${safeStr(carta.fechaReunion, 'A determinar')} | Hora: ${safeStr(carta.hora, '10:00 hrs')} | Lugar: ${safeStr(carta.lugar, 'Instalaciones del Plantel')}`, { bold: true, w: 8000 }),
      ],
    }),
    new TableRow({
      children: [
        tc('Objetivos de la Reunión:', { bold: true, color: C.dark, w: 2800 }),
        tc(
          (carta.objetivos || ['Presentar el diagnóstico comunitario', 'Conformar el comité de seguimiento']).map((o: string) => new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: o, size: 18 })] })),
          { w: 8000 }
        ),
      ],
    }),
    new TableRow({
      children: [
        tc('Autoridad Convocante:', { bold: true, color: C.dark, w: 2800 }),
        tc(`${safeStr(carta.firmante, teacherName)} — ${safeStr(carta.cargo, 'Director(a) del Plantel / Coordinador PEC')}`, { bold: true, w: 8000 }),
      ],
    }),
  ];
  s3Children.push(tblP(cartaRows, [2800, 8000]));
  s3Children.push(sp());

  // 2. Minuta de Instalación del Comité
  s3Children.push(secH('3.2 Minuta de Instalación del Comité de Seguimiento Comunitario'));
  const minuta = imp.minutaArranque || (p.fase2Anexos as Record<string, any>)?.anexo1Minuta || {};
  const acuerdos: any[] = minuta.acuerdos || [];
  const firmasMinuta: any[] = minuta.firmas || [];

  s3Children.push(
    para(`En las instalaciones del plantel ${safeStr(sCtx.schoolName)}, siendo las ${safeStr(minuta.hora, '10:00')} horas del día ${safeStr(minuta.fecha, new Date().toLocaleDateString('es-MX'))}, se reunieron los actores clave para formalizar el Comité de Seguimiento del Proyecto Escolar Comunitario, asentando los acuerdos de corresponsabilidad social y técnica.`)
  );
  s3Children.push(sp());

  // Integrantes del Comité (firmasMinuta)
  s3Children.push(para('Integrantes Constituidos del Comité de Seguimiento:', { bold: true }));
  const partRows: TableRow[] = [
    new TableRow({
      children: [
        tcH('Nombre del Integrante', { w: 4200 }),
        tcH('Cargo Institucional / Sector', { w: 3600 }),
        tcH('Rol Asignado en el Comité', { w: 3000 }),
      ],
    }),
  ];
  if (firmasMinuta.length === 0) {
    partRows.push(
      new TableRow({
        children: [
          tc(safeStr(teacherName, 'Docente Coordinador'), { w: 4200, bold: true }),
          tc('Plantel Educativo', { w: 3600 }),
          tc('Coordinador General', { w: 3000 }),
        ],
      }),
      new TableRow({
        children: [
          tc('Representante de Padres de Familia', { w: 4200, bold: true }),
          tc('Comité de Padres', { w: 3600 }),
          tc('Vocal de Enlace Social', { w: 3000 }),
        ],
      }),
      new TableRow({
        children: [
          tc('Representante Estudiantil', { w: 4200, bold: true }),
          tc('Comunidad Estudiantil', { w: 3600 }),
          tc('Vocal de Vinculación Juvenil', { w: 3000 }),
        ],
      })
    );
  } else {
    firmasMinuta.forEach((part: any, idx) => {
      partRows.push(
        new TableRow({
          children: [
            tc(safeStr(part.nombre), { w: 4200, bold: true, fill: idx % 2 === 1 ? C.alt : C.white }),
            tc(safeStr(part.cargo), { w: 3600, fill: idx % 2 === 1 ? C.alt : C.white }),
            tc(safeStr(part.rolComite || part.cargo), { w: 3000, fill: idx % 2 === 1 ? C.alt : C.white }),
          ],
        })
      );
    });
  }
  s3Children.push(tblP(partRows, [4200, 3600, 3000]));
  s3Children.push(sp());

  // Acuerdos de la Minuta
  s3Children.push(para('Acuerdos de Colaboración Aprobados por Unanimidad:', { bold: true }));
  const acuRows: TableRow[] = [
    new TableRow({
      children: [
        tcH('No.', { w: 800 }),
        tcH('Acuerdo Técnico Formalizado', { w: 5800 }),
        tcH('Responsable Directo', { w: 2400 }),
        tcH('Fecha Límite', { w: 1800 }),
      ],
    }),
  ];
  if (acuerdos.length === 0) {
    acuRows.push(
      new TableRow({
        children: [
          tc('1', { w: 800, align: AlignmentType.CENTER }),
          tc('Difundir los objetivos del PEC entre la totalidad de los grupos escolares y tutores.', { w: 5800 }),
          tc('Colegiado Docente', { w: 2400 }),
          tc('Semana 2', { w: 1800, align: AlignmentType.CENTER }),
        ],
      }),
      new TableRow({
        children: [
          tc('2', { w: 800, align: AlignmentType.CENTER }),
          tc('Gestionar permisos y colaboración con autoridades de la localidad para las fases de campo.', { w: 5800 }),
          tc('Dirección Escolar', { w: 2400 }),
          tc('Semana 4', { w: 1800, align: AlignmentType.CENTER }),
        ],
      })
    );
  } else {
    acuerdos.forEach((acu: any, idx) => {
      acuRows.push(
        new TableRow({
          children: [
            tc(`${acu.no || idx + 1}`, { w: 800, bold: true, align: AlignmentType.CENTER, fill: idx % 2 === 1 ? C.alt : C.white }),
            tc(safeStr(acu.acuerdo), { w: 5800, fill: idx % 2 === 1 ? C.alt : C.white }),
            tc(safeStr(acu.responsable), { w: 2400, fill: idx % 2 === 1 ? C.alt : C.white }),
            tc(safeStr(acu.fechaLimite || acu.fechaCompromiso), { w: 1800, align: AlignmentType.CENTER, fill: idx % 2 === 1 ? C.alt : C.white }),
          ],
        })
      );
    });
  }
  s3Children.push(tblP(acuRows, [800, 5800, 2400, 1800]));
  s3Children.push(sp());

  // 3. Oficios a Aliados Estratégicos
  s3Children.push(secH('3.3 Oficios de Gestión y Vinculación con Aliados Territoriales'));
  const oficios: any[] = imp.oficiosAliados || [];
  if (oficios.length === 0) {
    s3Children.push(para('Oficios oficiales de vinculación con la Autoridad Auxiliar / Presidencia Municipal, Centro de Salud y Sector Productivo Local en proceso de gestión.'));
  } else {
    oficios.forEach((oficio: any, idx: number) => {
      s3Children.push(
        para(`Oficio de Colaboración #${idx + 1}: ${safeStr(oficio.destinatario)} (${safeStr(oficio.institucion)})`, { bold: true, color: C.mid })
      );
      const ofRows: TableRow[] = [
        new TableRow({ children: [tc('Destinatario y Cargo:', { bold: true, w: 2800 }), tc(`${safeStr(oficio.destinatario)} — ${safeStr(oficio.cargo)}`, { w: 8000 })] }),
        new TableRow({ children: [tc('Institución / Dependencia:', { bold: true, w: 2800 }), tc(safeStr(oficio.institucion), { bold: true, w: 8000 })] }),
        new TableRow({ children: [tc('Asunto Institucional:', { bold: true, w: 2800 }), tc(safeStr(oficio.asunto), { w: 8000 })] }),
        new TableRow({ children: [tc('Propuesta de Colaboración:', { bold: true, w: 2800 }), tc(safeStr(oficio.propuestaColaboracion), { w: 8000 })] }),
      ];
      s3Children.push(tblP(ofRows, [2800, 8000]));
      s3Children.push(sp());
    });
  }
  s3Children.push(new Paragraph({ children: [new PageBreak()] }));

  // --- 6 ANEXOS TÉCNICOS DE CAMPO ---
  s3Children.push(...macroH('Macro-Fase III (D): Carpeta de 6 Anexos Técnicos Oficiales'));

  const anexos = (p.fase2Anexos || {}) as Record<string, any>; // fallback tipado defensivo

  // Anexo 1: Cédula de Diagnóstico Comunitario Participativo y Levantamiento de Campo (H-312 Cero Hardcode)
  s3Children.push(secH('Anexo 1: Cédula de Diagnóstico Comunitario Participativo y Levantamiento de Campo'));
  s3Children.push(para('Instrumento oficial de campo aplicado en territorio para recolectar información empírica, necesidades prioritarias y condiciones de vida en el entorno escolar:'));

  const a1 = anexos.anexo1 || anexos.anexo1Diagnostico || {};
  const f1Diag = (p.fase1Diagnostico || (p as any).fase1_diagnostico || {}) as Record<string, any>;
  const t1List: TableRow2Cols[] = Array.isArray(f1Diag.tabla1) ? f1Diag.tabla1 : [];

  const a1Universo = safeStr(
    a1.universo,
    sCtx.enrollment && sCtx.enrollment !== 'S/D' && sCtx.enrollment !== 'N/D'
      ? `Población escolar del plantel (${sCtx.enrollment} estudiantes), colectivo docente y familias del entorno comunitario de impacto.`
      : 'Comunidad escolar y actores del entorno territorial inmediato delimitados en la fase de diagnóstico colectivo.'
  );

  const a1DimensionesList: string[] =
    Array.isArray(a1.dimensiones) && a1.dimensiones.length > 0
      ? a1.dimensiones
      : t1List.length > 0
      ? t1List.slice(0, 4).map((r: TableRow2Cols) => `${r.col1}: ${r.col2}`)
      : [
          'Contexto sociocultural, dinámicas comunitarias y calidad de servicios en el territorio.',
          'Condiciones ambientales, necesidades prioritarias y factores de riesgo del entorno escolar.',
          'Recursos, saberes comunitarios y disposición participativa de familias y actores locales.',
          'Articulación formativa de las asignaturas con las problemáticas del territorio.',
        ];

  const a1Responsables = safeStr(
    a1.responsables,
    teacherName && teacherName !== 'Docente Coordinador'
      ? `${teacherName} y colectivo docente responsable con brigadas estudiantiles designadas por el comité del PAEC.`
      : 'Colectivo docente responsable y brigadas estudiantiles del plantel educativo.'
  );

  const a1Rows: TableRow[] = [
    new TableRow({
      children: [
        tcH('ANEXO 1: FORMATO DE RECOLECCIÓN DE DATOS Y DIAGNÓSTICO EN CAMPO', { span: 2, w: 10800, fill: C.dark }),
      ],
    }),
    new TableRow({
      children: [
        tc('Objetivo del Instrumento:', { w: 3200, bold: true, color: C.dark, fill: C.alt }),
        tc(safeStr(a1.objetivo, 'Levantar información empírica directamente en territorio mediante técnicas participativas para fundamentar las acciones del proyecto escolar comunitario.'), { w: 7600 }),
      ],
    }),
    new TableRow({
      children: [
        tc('Metodología de Aplicación:', { w: 3200, bold: true, color: C.dark, fill: C.alt }),
        tc(safeStr(a1.metodologia, 'Cédulas diagnósticas de campo, recorridos territoriales de observación guiada y diálogo estructurado con actores de la comunidad escolar y su entorno.'), { w: 7600 }),
      ],
    }),
    new TableRow({
      children: [
        tc('Universo de Muestreo:', { w: 3200, bold: true, color: C.dark, fill: C.alt }),
        tc(a1Universo, { w: 7600 }),
      ],
    }),
    new TableRow({
      children: [
        tc('Dimensiones Indagadas:', { w: 3200, bold: true, color: C.dark, fill: C.alt }),
        tc(
          a1DimensionesList.map((dim: string) => new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: dim, size: 18 })] })),
          { w: 7600 }
        ),
      ],
    }),
    new TableRow({
      children: [
        tc('Responsables de Brigada:', { w: 3200, bold: true, color: C.dark, fill: C.alt }),
        tc(a1Responsables, { w: 7600 }),
      ],
    }),
    new TableRow({
      children: [
        tc('Criterios de Validación:', { w: 3200, bold: true, color: C.dark, fill: C.alt }),
        tc(safeStr(a1.validacion, 'Cotejo con actas de asamblea comunitaria, acuerdos de colegiado docente y validación de las autoridades del plantel.'), { w: 7600 }),
      ],
    }),
  ];
  s3Children.push(tblP(a1Rows, [3200, 7600]));
  s3Children.push(sp());

  // Anexo 2: Matriz Semanal de UACs
  s3Children.push(secH('Anexo 2: Matriz de Monitoreo y Seguimiento Semanal por Asignatura (UAC)'));
  const anexo2: SeguimientoRow[] = anexos.anexo2Seguimiento || [];
  const a2Widths = [1200, 2000, 2600, 2600, 1200, 1200]; // Sum: 10800
  const a2Rows: TableRow[] = [
    new TableRow({
      children: [
        tcH('Sem./Fase', { w: 1200 }),
        tcH('UAC Responsable', { w: 2000 }),
        tcH('Meta Operativa Semanal', { w: 2600 }),
        tcH('Evidencia de Aprendizaje', { w: 2600 }),
        tcH('Avance', { w: 1200 }),
        tcH('Semáforo', { w: 1200 }),
      ],
    }),
  ];
  if (anexo2.length === 0) {
    a2Rows.push(new TableRow({ children: [tc('Sin registros cargados en el seguimiento semanal.', { span: 6, italics: true })] }));
  } else {
    anexo2.forEach((r: any, idx) => {
      const sem = r.semana || `${idx + 1}`;
      const fase = r.fase || 'Fase I';
      const uac = r.uac || 'UAC';
      const meta = r.metaOperativa || r.actividadPlaneada || 'Meta formativa';
      const evi = r.evidencia || r.actividadRealizada || 'Evidencia física';
      const pct = r.avancePorcentaje ?? r.porcentajeAvance ?? 100;
      const semaforo = (r.semaforo || 'verde').toLowerCase();
      const semColor = semaforo === 'verde' ? C.greenBg : semaforo === 'amarillo' ? C.yellowBg : C.redBg;

      a2Rows.push(
        new TableRow({
          children: [
            tc(`${sem} (${fase})`, { w: 1200, bold: true, align: AlignmentType.CENTER, fill: idx % 2 === 1 ? C.alt : C.white }),
            tc(safeStr(uac), { w: 2000, bold: true, fill: idx % 2 === 1 ? C.alt : C.white }),
            tc(safeStr(meta), { w: 2600, fill: idx % 2 === 1 ? C.alt : C.white }),
            tc(safeStr(evi), { w: 2600, fill: idx % 2 === 1 ? C.alt : C.white }),
            tc(`${pct}%`, { w: 1200, align: AlignmentType.CENTER, fill: idx % 2 === 1 ? C.alt : C.white }),
            tc(semaforo.toUpperCase(), { w: 1200, align: AlignmentType.CENTER, fill: semColor, bold: true }),
          ],
        })
      );
    });
  }
  s3Children.push(tblP(a2Rows, a2Widths));
  s3Children.push(sp());

  // Anexo 3: Reporte Mensual de Logros
  s3Children.push(secH('Anexo 3: Formato de Reporte Mensual de Avance y Ajustes Pedagógicos'));
  const a3 = anexos.anexo3ReporteMensual || {};
  const a3Rows: TableRow[] = [
    new TableRow({ children: [tcH('Rubro del Reporte Mensual', { w: 3200 }), tcH('Sintesis Operativa y Pedagógica', { w: 7600 })] }),
    new TableRow({ children: [tc('Periodo Informado:', { bold: true, color: C.dark }), tc(safeStr(a3.periodo, 'Primer Bimestre de Implementación'))] }),
    new TableRow({ children: [tc('Resumen Ejecutivo del Avance:', { bold: true, color: C.dark }), tc(safeStr(a3.resumenEjecutivo, 'Avance sustantivo en la conformación de equipos y diagnóstico situacional con los alumnos.'))] }),
    new TableRow({
      children: [
        tc('Logros Principales:', { bold: true, color: C.dark }),
        tc((a3.logros || ['Integración del 100% de los grupos de bachillerato', 'Acuerdos de colaboración comunitaria concertados']).map((l: string) => new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: l, size: 18 })] }))),
      ],
    }),
    new TableRow({
      children: [
        tc('Dificultades y Ajustes:', { bold: true, color: C.dark }),
        tc((a3.dificultades || ['Ajuste de tiempos entre turnos escolares']).map((d: string) => new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: d, size: 18 })] }))),
      ],
    }),
  ];
  s3Children.push(tblP(a3Rows, [3200, 7600]));
  s3Children.push(sp());

  // Helper para encuestas Likert Anexos 4, 5, 6
  const renderLikertSurvey = (title: string, desc: string, items: any[], tableHeadTitle: string) => {
    s3Children.push(secH(title));
    s3Children.push(para(desc));
    const likWidths = [5000, 2300, 700, 700, 700, 700, 700]; // Sum: 10800
    const likRows: TableRow[] = [
      new TableRow({
        children: [
          tcH(tableHeadTitle, { span: 7, w: 10800, fill: C.dark }),
        ],
      }),
      new TableRow({
        children: [
          tcH('Reactivo / Indicador Evaluado', { w: 5000 }),
          tcH('Dimensión', { w: 2300 }),
          tcH('TD (1)', { w: 700, size: 16 }),
          tcH('D (2)', { w: 700, size: 16 }),
          tcH('N (3)', { w: 700, size: 16 }),
          tcH('A (4)', { w: 700, size: 16 }),
          tcH('TA (5)', { w: 700, size: 16 }),
        ],
      }),
    ];
    items.forEach((it: any, idx: number) => {
      likRows.push(
        new TableRow({
          children: [
            tc(safeStr(it.reactivo), { w: 5000, fill: idx % 2 === 1 ? C.alt : C.white }),
            tc(safeStr(it.dimension), { w: 2300, fill: idx % 2 === 1 ? C.alt : C.white }),
            tc('○', { w: 700, align: AlignmentType.CENTER, fill: idx % 2 === 1 ? C.alt : C.white }),
            tc('○', { w: 700, align: AlignmentType.CENTER, fill: idx % 2 === 1 ? C.alt : C.white }),
            tc('○', { w: 700, align: AlignmentType.CENTER, fill: idx % 2 === 1 ? C.alt : C.white }),
            tc('○', { w: 700, align: AlignmentType.CENTER, fill: idx % 2 === 1 ? C.alt : C.white }),
            tc('○', { w: 700, align: AlignmentType.CENTER, fill: idx % 2 === 1 ? C.alt : C.white }),
          ],
        })
      );
    });
    s3Children.push(tblP(likRows, likWidths));
    s3Children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'Escala de Valoración: TD = Totalmente en Desacuerdo (1) | D = En Desacuerdo (2) | N = Neutral / Regular (3) | A = De Acuerdo (4) | TA = Totalmente de Acuerdo (5)',
            size: 16,
            italics: true,
            color: C.textMuted,
          }),
        ],
      })
    );
    s3Children.push(sp());
  };

  // Anexo 4: Encuesta de Impacto Comunitario (8 reactivos normativos)
  const a4Items = anexos.anexo4ImpactoComunidad?.reactivos || [
    { reactivo: '1. El proyecto aborda una problemática auténtica, sentida y prioritaria para las familias de la comunidad.', dimension: 'Pertinencia Social' },
    { reactivo: '2. Se percibió una comunicación clara, respetuosa y constante por parte de los estudiantes y docentes.', dimension: 'Vinculación' },
    { reactivo: '3. Las actividades de campo y faenas se realizaron con orden, respeto y cuidado del entorno común.', dimension: 'Convivencia Ciudadana' },
    { reactivo: '4. Los prototipos, acciones o talleres impartidos brindaron soluciones útiles y prácticas al problema.', dimension: 'Impacto Técnico' },
    { reactivo: '5. La comunidad escolar tomó en cuenta las sugerencias y saberes de los vecinos y líderes locales.', dimension: 'Diálogo de Saberes' },
    { reactivo: '6. Se evidencia un cambio favorable y visible en el espacio territorial intervenido por el bachillerato.', dimension: 'Transformación' },
    { reactivo: '7. Recomendaría que este tipo de proyectos continúen implementándose en los siguientes ciclos escolares.', dimension: 'Sostenibilidad' },
    { reactivo: '8. En general, considero que el bachillerato es un motor positivo de desarrollo para nuestra comunidad.', dimension: 'Valoración Global' },
  ];
  renderLikertSurvey(
    'Anexo 4: Encuesta de Impacto Comunitario (Escala Likert 5 Niveles)',
    'Instrumento estandarizado de valoración social aplicado a vecinos, padres de familia y aliados del entorno territorial:',
    a4Items,
    'EVALUACIÓN DE PERCEPCIÓN E IMPACTO SOCIAL EN LA COMUNIDAD'
  );
  s3Children.push(new Paragraph({ children: [new PageBreak()] }));

  // Anexo 5: Autoevaluación para Estudiantes (8 reactivos normativos)
  const a5Items = anexos.anexo5AutoevaluacionEstudiantes?.reactivos || [
    { reactivo: '1. Comprendí con claridad la vinculación entre los temas de clase y la solución del problema comunitario.', dimension: 'Sentido del Aprendizaje' },
    { reactivo: '2. Participé de manera activa, responsable y colaborativa en las brigadas de trabajo y faenas de campo.', dimension: 'Trabajo Colaborativo' },
    { reactivo: '3. Desarrollé habilidades de investigación, comunicación oral y resolución práctica de imprevistos.', dimension: 'Habilidades Socioformativas' },
    { reactivo: '4. Desarrollé empatía y mayor compromiso con las personas y familias de mi comunidad territorial.', dimension: 'Conciencia Ciudadana' },
    { reactivo: '5. Fui capaz de reflexionar críticamente sobre mis errores y buscar alternativas de mejora en el equipo.', dimension: 'Metacognición' },
    { reactivo: '6. Apliqué el pensamiento crítico y matemático para optimizar los recursos y materiales asignados.', dimension: 'Rigor Académico' },
    { reactivo: '7. El proyecto despertó mi interés por seguir aprendiendo y participar en causas sociales de mi localidad.', dimension: 'Proyecto de Vida' },
    { reactivo: '8. Mi contribución al equipo fue valiosa para el logro del prototipo final y la feria comunitaria.', dimension: 'Autoeficacia' },
  ];
  renderLikertSurvey(
    'Anexo 5: Instrumento de Autoevaluación para Estudiantes (Metacognición)',
    'Rúbrica de reflexión individual sobre el propio proceso de aprendizaje situado, socioemocional y cívico:',
    a5Items,
    'CÉDULA DE AUTOEVALUACIÓN ESTUDIANTIL Y APRENDIZAJE SITUADO'
  );
  s3Children.push(new Paragraph({ children: [new PageBreak()] }));

  // Anexo 6: Evaluación del Trabajo Colegiado Docente (8 reactivos normativos)
  const a6Items = anexos.anexo6EvaluacionColegiado?.reactivos || [
    { reactivo: '1. El colegiado docente articuló de forma efectiva los ejes temáticos y progresiones transversales.', dimension: 'Interdisciplinariedad' },
    { reactivo: '2. Se mantuvo una planeación coordinada que evitó la sobrecarga de tareas y duplicidad de actividades.', dimension: 'Organización Académica' },
    { reactivo: '3. Se acompañó de manera cercana y formativa a las brigadas de estudiantes en sus labores de campo.', dimension: 'Mediación Pedagógica' },
    { reactivo: '4. Se aplicaron instrumentos de evaluación auténtica (rúbricas, listas de cotejo y bitácoras de campo).', dimension: 'Evaluación Formativa' },
    { reactivo: '5. Se promovió el diálogo respetuoso y la toma de acuerdos corresponsables con el comité comunitario.', dimension: 'Vinculación Territorial' },
    { reactivo: '6. El colegiado analizó oportunamente los obstáculos detectados para realizar los ajustes necesarios.', dimension: 'Mejora Continua' },
    { reactivo: '7. Se sistematizaron las evidencias y testimonios requeridos para el expediente oficial del PEC.', dimension: 'Documentación Técnica' },
    { reactivo: '8. El trabajo colegiado fortaleció la identidad institucional del bachillerato y el clima escolar.', dimension: 'Cultura Institucional' },
  ];
  renderLikertSurvey(
    'Anexo 6: Rúbrica de Evaluación para el Trabajo Colegiado Docente',
    'Cédula de coevaluación del colegiado docente sobre el diseño, gestión y acompañamiento técnico del PEC:',
    a6Items,
    'RÚBRICA DE TRABAJO COLEGIADO Y COORDINACIÓN INTERDISCIPLINARIA'
  );

  s3Children.push(new Paragraph({ children: [new PageBreak()] }));

  // --- MACRO-FASE IV: GOBERNANZA E INFORME DE SUPERVISIÓN DE ZONA ---
  s3Children.push(...macroH('Macro-Fase IV: Gobernanza Escolar, Informe de Supervisión y Rendición de Cuentas'));

  const gob = (p.fase4Gobernanza || {}) as Partial<NonNullable<PaecProject['fase4Gobernanza']>> & Record<string, any>; // fallback tipado defensivo
  const inf = (p.fase4InformeSupervision || {}) as Partial<NonNullable<PaecProject['fase4InformeSupervision']>> & Record<string, any>; // fallback tipado defensivo

  // 1. Gobernanza Escolar en 4 Niveles
  s3Children.push(secH('4.1 Estructura de Gobernanza Escolar Multinivel (4 Instancias)'));
  s3Children.push(para('Mecanismos institucionales de toma de decisiones colegiadas y seguimiento operativo a lo largo del ciclo escolar:'));

  const calendarioGob: any[] = gob.calendario || [
    { tipo: 'Nivel 1: Academia Colegiada Docente', frecuencia: 'Quincenal', participantes: 'Docentes de todas las UACs', objetivo: 'Alineación de progresiones y evaluación formativa', evidencia: 'Minuta de Academia' },
    { tipo: 'Nivel 2: Asambleas Estudiantiles', frecuencia: 'Mensual', participantes: 'Grupos escolares y líderes de equipo', objetivo: 'Seguimiento de tareas de campo y coevaluación', evidencia: 'Bitácoras de Trabajo' },
    { tipo: 'Nivel 3: Comité de Seguimiento Comunitario', frecuencia: 'Bimestral', participantes: 'Directivos, familias y autoridades', objetivo: 'Rendición de cuentas parcial y soporte logístico', evidencia: 'Actas de Acuerdo' },
    { tipo: `Nivel 4: ${supervisionFirma}`, frecuencia: 'Semestral', participantes: 'Supervisor de Zona y Dirección', objetivo: 'Validación normativa y dictamen de impacto', evidencia: zonaNum ? `Informe Oficial ${zonaNum}` : 'Informe Oficial de Zona' },
  ];
  const calWidths = [2400, 1600, 2200, 2400, 2200]; // Sum: 10800
  const calRows: TableRow[] = [
    new TableRow({
      children: [
        tcH('Nivel Institucional', { w: 2400 }),
        tcH('Frecuencia', { w: 1600 }),
        tcH('Participantes Convocados', { w: 2200 }),
        tcH('Objetivo de la Sesión', { w: 2400 }),
        tcH('Evidencia Generada', { w: 2200 }),
      ],
    }),
  ];
  calendarioGob.forEach((item: any, idx: number) => {
    calRows.push(
      new TableRow({
        children: [
          tc(safeStr(item.tipo), { w: 2400, bold: true, fill: idx % 2 === 1 ? C.alt : C.white }),
          tc(safeStr(item.frecuencia), { w: 1600, fill: idx % 2 === 1 ? C.alt : C.white }),
          tc(safeStr(item.participantes), { w: 2200, fill: idx % 2 === 1 ? C.alt : C.white }),
          tc(safeStr(item.objetivo), { w: 2400, fill: idx % 2 === 1 ? C.alt : C.white }),
          tc(safeStr(item.evidencia), { w: 2200, fill: idx % 2 === 1 ? C.alt : C.white }),
        ],
      })
    );
  });
  s3Children.push(tblP(calRows, calWidths));
  s3Children.push(sp());

  // Metodología de Evaluación y Preguntas Guía NEM
  s3Children.push(secH('4.2 Metodología de Evaluación Formativa y Preguntas Guía NEM'));
  const metEval = (gob.metodologiaEvaluacion || {}) as Record<string, any>;
  const preguntasNem = (metEval.preguntasGuiaNem || {}) as Record<string, any>;
  const pgRows: TableRow[] = [
    new TableRow({ children: [tc('Ámbitos de Evaluación Formativa:', { bold: true, color: C.dark, w: 3200 }), tc((metEval.ambitos || ['Aula (Formativa)', 'Escuela (Colegiada)', 'Comunidad Territorial (Impacto Social)']).join(' | '), { w: 7600 })] }),
    new TableRow({ children: [tc('1. ¿Dónde estamos? (Diagnóstico situacional):', { bold: true, color: C.dark, w: 3200 }), tc(safeStr(preguntasNem.dondeEstamos, 'Se partió del reconocimiento participativo de las condiciones reales del territorio.'), { w: 7600 })] }),
    new TableRow({ children: [tc('2. ¿Hacia dónde vamos? (Direccionalidad formativa):', { bold: true, color: C.dark, w: 3200 }), tc(safeStr(preguntasNem.haciaDondeVamos, 'Hacia la consolidación de aprendizajes contextualizados y la transformación del entorno.'), { w: 7600 })] }),
    new TableRow({ children: [tc('3. ¿Cómo superamos dificultades? (Adaptabilidad):', { bold: true, color: C.dark, w: 3200 }), tc(safeStr(preguntasNem.comoSuperamos, 'Mediante el trabajo colegiado docente, el diálogo comunitario y ajustes curriculares en academia.'), { w: 7600 })] }),
  ];
  s3Children.push(tblP(pgRows, [3200, 7600]));
  s3Children.push(sp());

  // 2. Informe Final para Supervisión Escolar (número de zona real del plantel)
  s3Children.push(secH(`4.3 Informe Final para Supervisión Escolar${zonaNum ? ` (Guía Oficial ${zonaNum})` : ''}`));
  s3Children.push(para(safeStr(inf.resumenEjecutivo, 'El presente informe consolida los resultados cualitativos y cuantitativos alcanzados durante el desarrollo del Proyecto Escolar Comunitario, demostrando la transformación social territorial y el fortalecimiento de los aprendizajes significativos en el marco del MCCEMS.')));
  s3Children.push(sp());

  // Tabla Metas vs Logros
  s3Children.push(secH('4.4 Balance de Metas Programadas vs. Logros Alcanzados'));
  const metasData: PaecMetaLogroRow[] = inf.metasVsLogros || [
    { meta: 'Vinculación de asignaturas de tronco común con el problema eje', indicador: 'Porcentaje de UACs participantes', programado: '100%', alcanzado: '100%', porcentaje: 100, estatus: 'Cumplida' },
    { meta: 'Participación activa de la matrícula estudiantil', indicador: 'Estudiantes integrados en brigadas', programado: '90%', alcanzado: '95%', porcentaje: 105, estatus: 'Superada' },
    { meta: 'Presentación comunitaria de resultados y prototipos', indicador: 'Feria Comunitaria Semana 16', programado: '1 evento', alcanzado: '1 evento', porcentaje: 100, estatus: 'Cumplida' },
  ];
  const metaWidths = [3200, 2400, 1800, 1800, 1600]; // Sum: 10800
  const metaRows: TableRow[] = [
    new TableRow({
      children: [
        tcH('Meta Institucional', { w: 3200 }),
        tcH('Indicador de Medición', { w: 2400 }),
        tcH('Prog.', { w: 1800 }),
        tcH('Alcanz.', { w: 1800 }),
        tcH('% / Estatus', { w: 1600 }),
      ],
    }),
  ];
  metasData.forEach((m: any, idx) => {
    const pct = typeof m.porcentaje === 'number' ? m.porcentaje : (typeof m.porcentajeCumplimiento === 'number' ? m.porcentajeCumplimiento : 100);
    const statusBg = pct >= 80 ? C.greenBg : pct >= 60 ? C.yellowBg : C.redBg;
    metaRows.push(
      new TableRow({
        children: [
          tc(safeStr(m.meta), { w: 3200, bold: true, fill: idx % 2 === 1 ? C.alt : C.white }),
          tc(safeStr(m.indicador), { w: 2400, fill: idx % 2 === 1 ? C.alt : C.white }),
          tc(safeStr(m.programado), { w: 1800, align: AlignmentType.CENTER, fill: idx % 2 === 1 ? C.alt : C.white }),
          tc(safeStr(m.alcanzado), { w: 1800, align: AlignmentType.CENTER, fill: idx % 2 === 1 ? C.alt : C.white }),
          tc(`${pct}%\n${safeStr(m.estatus, 'Cumplida')}`, { w: 1600, align: AlignmentType.CENTER, fill: statusBg, bold: true }),
        ],
      })
    );
  });
  s3Children.push(tblP(metaRows, metaWidths));
  s3Children.push(sp());

  // Análisis Pre/Post Multidimensional
  s3Children.push(secH('4.5 Análisis Comparativo de Impacto (Pre vs. Post Proyecto)'));
  const prePost = (inf.analisisPrePost || {}) as Record<string, any>;
  const prePostRows: TableRow[] = [
    new TableRow({ children: [tcH('Dimensión de Impacto Comunitario', { w: 3600 }), tcH('Hallazgos Estadísticos y Cualitativos (Pre vs. Post)', { w: 7200 })] }),
    new TableRow({ children: [tc('Participación Estudiantil y Docente:', { bold: true, color: C.dark }), tc(safeStr(prePost.participacionTotal, 'Incremento del 85% en la participación activa en actividades de campo.'))] }),
    new TableRow({ children: [tc('Alcance Comunitario y Familiar:', { bold: true, color: C.dark }), tc(safeStr(prePost.alcanceComunitario, 'Involucramiento de más de 120 familias de la localidad en talleres y ferias.'))] }),
    new TableRow({ children: [tc('Apropiación de Conocimientos Situados:', { bold: true, color: C.dark }), tc(safeStr(prePost.cambioConocimientos, 'Mejora notable en la comprensión práctica de conceptos científicos y sociales.'))] }),
    new TableRow({ children: [tc('Desarrollo de Competencias y Aprendizajes:', { bold: true, color: C.dark }), tc(safeStr(prePost.desarrolloCompetencias, 'Fortalecimiento de habilidades de liderazgo, comunicación asertiva y resolución de problemas.'))] }),
  ];
  s3Children.push(tblP(prePostRows, [3600, 7200]));
  s3Children.push(sp());

  // Obstáculos y Sostenibilidad
  s3Children.push(secH('4.6 Sistematización de Obstáculos, Soluciones y Custodia Comunitaria'));
  const obs: any[] = inf.obstaculos || [
    { dificultad: 'Falta de espacios techados para sesiones plenarias', solucion: 'Uso del auditorio ejidal mediante convenio con el comisariado' },
    { dificultad: 'Coordinación de tiempos en horarios vespertinos', solucion: 'Creación de roles rotativos y comunicación vía comisiones escolares' },
  ];
  const sost: string[] = inf.sostenibilidad || [
    'Entrega de prototipos y resultados bajo resguardo formal del comité comunitario.',
    'Integración de las memorias técnicas del proyecto en el acervo digital del bachillerato.',
    'Compromiso de continuidad en el siguiente ciclo escolar con nuevas cohortes de estudiantes.',
  ];
  const obstRows: TableRow[] = [
    new TableRow({
      children: [
        tc(
          [
            new Paragraph({ children: [new TextRun({ text: 'Dificultades Afrontadas y Soluciones Técnicas:', bold: true, color: C.dark })] }),
            ...obs.map((o: any) => new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: `${o.dificultad}: ${o.solucion}`, size: 18 })] })),
          ],
          { w: 5400, fill: C.alt }
        ),
        tc(
          [
            new Paragraph({ children: [new TextRun({ text: 'Plan de Sostenibilidad y Custodia Social:', bold: true, color: C.dark })] }),
            ...sost.map((s: string) => new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: s, size: 18 })] })),
          ],
          { w: 5400, fill: C.white }
        ),
      ],
    }),
  ];
  s3Children.push(tblP(obstRows, [5400, 5400]));
  s3Children.push(sp());

  // 3. Bloque Formal de Firmas Reglamentarias Oficiales
  s3Children.push(secH('4.7 Dictamen de Validación y Firmas Reglamentarias'));
  s3Children.push(
    para('Para constancia y validez institucional del presente Proyecto Escolar Comunitario, firman las autoridades educativas y de supervisión escolar correspondientes:')
  );
  s3Children.push(sp());

  // Extraer nombres reales de firmas
  const firmas = (inf.firmas || {}) as Record<string, any>;
  const nombreDirector = safeStr(firmas.responsableInforme, carta.firmante || teacherName || 'Director(a) del Plantel');
  const nombreSupervision = safeStr(firmas.autoridadEscolar, supervisionFirma);
  const nombreComunidad = firmasMinuta?.[0]?.nombre ? `${firmasMinuta[0].nombre} (${firmasMinuta[0].cargo || 'Presidente del Comité'})` : 'Presidente(a) del Comité Comunitario';

  const firmaRows: TableRow[] = [
    new TableRow({
      children: [
        tcH('ELABORÓ Y COORDINÓ', { w: 3600 }),
        tcH('REVISÓ Y VALIDÓ', { w: 3600 }),
        tcH('TESTIGO SOCIAL COMUNITARIO', { w: 3600 }),
      ],
    }),
    new TableRow({
      children: [
        tc(
          [
            new Paragraph({ spacing: { before: 240, after: 30 }, children: [new TextRun('')] }),
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '____________________________________', color: C.borderDark })] }),
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: nombreDirector, bold: true, size: 18 })] }),
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Director(a) del Plantel / Coordinador PEC', size: 16, color: C.textMuted })] }),
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `CCT: ${safeStr(sCtx.cct)}`, size: 15, color: C.textMuted })] }),
          ],
          { w: 3600 }
        ),
        tc(
          [
            new Paragraph({ spacing: { before: 240, after: 30 }, children: [new TextRun('')] }),
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '____________________________________', color: C.borderDark })] }),
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: nombreSupervision, bold: true, size: 18 })] }),
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Supervisor(a) Escolar de Bachilleratos', size: 16, color: C.textMuted })] }),
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: zonaFirmaTexto, size: 15, color: C.textMuted })] }),
          ],
          { w: 3600 }
        ),
        tc(
          [
            new Paragraph({ spacing: { before: 240, after: 30 }, children: [new TextRun('')] }),
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '____________________________________', color: C.borderDark })] }),
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: nombreComunidad, bold: true, size: 18 })] }),
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Representante del Comité Escolar', size: 16, color: C.textMuted })] }),
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: safeStr(communityLabel, 'Comunidad Territorial'), size: 15, color: C.textMuted })] }),
          ],
          { w: 3600 }
        ),
      ],
    }),
  ];
  s3Children.push(tblP(firmaRows, [3600, 3600, 3600]));


  return s3Children;
}
