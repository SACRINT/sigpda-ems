/* eslint-disable @typescript-eslint/no-explicit-any */
import autoTable from 'jspdf-autotable';
import type { PaecProject, SeguimientoRow } from '@/types/paec';
import {
  NAVY,
  BLUE_MID,
  GRAY_BG,
  TEXT_DARK,
  TEXT_MUTED,
  safeStr,
  addSectionBar,
  type PaecPdfRenderState,
} from './helpers';

export function renderPaecPdfAnexos(state: PaecPdfRenderState): void {
  const {
    doc,
    p,
    sCtx,
    teacherName,
    margin,
  } = state;
  let { pageWidth, pageHeight, contentWidth, curY } = state;

  // ═════════════════════════════════════════════════════════════════════════════
  // MACRO-FASE III (C): FORMALIZACIÓN INSTITUCIONAL (RETORNO A PORTRAIT)
  // PÁGINA 20: 3.1 CARTA DE CONVOCATORIA A LA ASAMBLEA ESCOLAR Y COMUNITARIA
  // ═════════════════════════════════════════════════════════════════════════════
  doc.addPage('letter', 'portrait');
  pageWidth = doc.internal.pageSize.getWidth();   // 215.9 mm
  pageHeight = doc.internal.pageSize.getHeight(); // 279.4 mm
  contentWidth = pageWidth - margin * 2;          // 187.9 mm
  curY = 24;

  addSectionBar(doc, '3.1 Carta Oficial de Convocatoria a la Asamblea Escolar y Comunitaria', curY, margin, contentWidth);
  curY += 10;

  const imp = (p.fase3Implementacion || {}) as Partial<NonNullable<PaecProject['fase3Implementacion']>> & Record<string, any>; // fallback tipado defensivo
  const carta = (imp.cartaInvitacion || {}) as Record<string, any>;

  autoTable(doc, {
    startY: curY,
    head: [
      [
        {
          content: 'CONVOCATORIA PÚBLICA INSTITUCIONAL PARA INSTALACIÓN DEL COMITÉ PEC',
          colSpan: 2,
          styles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
        },
      ],
    ],
    body: [
      [
        { content: 'Asunto Oficial:', styles: { fontStyle: 'bold', textColor: NAVY, cellWidth: 46 } },
        { content: safeStr(carta.asunto, 'Convocatoria a Asamblea General para Presentación y Validación del PEC'), styles: { fontStyle: 'bold', textColor: TEXT_DARK } },
      ],
      [
        { content: 'Fecha de Expedición:', styles: { fontStyle: 'bold', textColor: NAVY } },
        { content: safeStr(carta.fecha, new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })), styles: { textColor: TEXT_DARK } },
      ],
      [
        { content: 'Destinatarios Convocados:', styles: { fontStyle: 'bold', textColor: NAVY } },
        { content: safeStr(carta.destinatarios, 'Padres, Madres de Familia, Autoridades Locales, Ejidales, Vecinales y Sociedad Civil'), styles: { textColor: TEXT_DARK } },
      ],
      [
        { content: 'Cuerpo del Comunicado:', styles: { fontStyle: 'bold', textColor: NAVY } },
        { content: safeStr(carta.cuerpo, 'Por medio de la presente, la Dirección del Plantel y el Colegiado Docente convocan formalmente a la asamblea de apertura e instalación del Proyecto Escolar Comunitario, con el propósito de validar de manera corresponsable las acciones de impacto territorial en favor de nuestra comunidad.'), styles: { textColor: TEXT_DARK } },
      ],
      [
        { content: 'Sesión Programada:', styles: { fontStyle: 'bold', textColor: NAVY } },
        { content: `Fecha: ${safeStr(carta.fechaReunion, 'Semana 2 del ciclo')} | Hora: ${safeStr(carta.hora, '10:00 hrs')} | Lugar: ${safeStr(carta.lugar, 'Plaza Cívica del Plantel')}`, styles: { fontStyle: 'bold', textColor: TEXT_DARK } },
      ],
      [
        { content: 'Orden del Día Propuesto:', styles: { fontStyle: 'bold', textColor: NAVY } },
        {
          content:
            '1. Registro de asistencia y pase de lista de actores clave.\n' +
            '2. Presentación del diagnóstico colectivo y problemática comunitaria priorizada.\n' +
            '3. Exposición de las progresiones curriculares y metas de aprendizaje vinculadas.\n' +
            '4. Elección democrática e instalación del Comité de Seguimiento Comunitario.\n' +
            '5. Asuntos generales y firma del acta de acuerdos.',
          styles: { textColor: TEXT_DARK },
        },
      ],
      [
        { content: 'Autoridad Convocante:', styles: { fontStyle: 'bold', textColor: NAVY } },
        { content: `${safeStr(carta.firmante, teacherName)} — ${safeStr(carta.cargo, 'Director(a) del Plantel / Coordinador PEC')}`, styles: { fontStyle: 'bold', textColor: TEXT_DARK } },
      ],
    ],
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 2.5, overflow: 'linebreak' },
    columnStyles: {
      0: { cellWidth: 46, fillColor: GRAY_BG },
      1: { cellWidth: contentWidth - 46 },
    },
    margin: { left: margin, right: margin },
  });
  // @ts-expect-error autoTable adds lastAutoTable to jsPDF instance
  curY = doc.lastAutoTable.finalY + 12;

  // Sello y firma del convocante
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...NAVY);
  doc.text('ATENTAMENTE', pageWidth / 2, curY, { align: 'center' });
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.text('"Educación para la Transformación Social y el Bienestar Comunitario"', pageWidth / 2, curY + 4, { align: 'center' });

  doc.setDrawColor(...NAVY);
  doc.line(pageWidth / 2 - 35, curY + 20, pageWidth / 2 + 35, curY + 20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...TEXT_DARK);
  doc.text(safeStr(carta.firmante, teacherName), pageWidth / 2, curY + 24, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...TEXT_MUTED);
  doc.text(`${safeStr(carta.cargo, 'Director(a) del Plantel')} · CCT: ${safeStr(sCtx.cct, '21EBH0045X')}`, pageWidth / 2, curY + 27.5, { align: 'center' });

  // ═════════════════════════════════════════════════════════════════════════════
  // PÁGINA 21: 3.2 MINUTA DE INSTALACIÓN DEL COMITÉ DE SEGUIMIENTO COMUNITARIO
  // ═════════════════════════════════════════════════════════════════════════════
  doc.addPage('letter', 'portrait');
  curY = 24;
  addSectionBar(doc, '3.2 Minuta de Instalación del Comité de Seguimiento Comunitario', curY, margin, contentWidth);
  curY += 10;

  const minuta = imp.minutaArranque || (p.fase2Anexos as Record<string, any>)?.anexo1Minuta || {};
  const acuerdos: any[] = minuta.acuerdos || [];
  const partMinuta: any[] = minuta.firmas || [];

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...TEXT_DARK);
  doc.text(`En las instalaciones del plantel ${safeStr(sCtx.schoolName)}, siendo las 10:00 horas del día acordado, se reunieron docentes, directivos, padres de familia y autoridades del entorno para asentar formalmente la instalación del Comité de Seguimiento del PEC:`, margin, curY);
  curY += 5;

  const acuBody = acuerdos.length > 0
    ? acuerdos.map((a: any, idx) => [
        `${a.no || idx + 1}`,
        safeStr(a.acuerdo),
        safeStr(a.responsable),
        safeStr(a.fechaLimite || a.fechaCompromiso || 'Semana 4'),
      ])
    : [
        ['1', 'Presentar formalmente los objetivos, alcances y progresiones del PEC a toda la comunidad escolar.', 'Colegiado Docente', 'Semana 2'],
        ['2', 'Formalizar el comité de vigilancia, vinculación social y apoyo logístico territorial.', 'Dirección y Padres', 'Semana 3'],
        ['3', 'Gestionar espacios públicos y permisos con autoridades municipales para las intervenciones.', 'Comité Comunitario', 'Semana 6'],
        ['4', 'Supervisar la entrega de materiales para la elaboración de prototipos sustentables de campo.', 'Comisión Logística', 'Semana 8'],
        ['5', 'Coordinar el montaje y resguardo de productos para la Feria Comunitaria en la Semana 16.', 'Comité en Pleno', 'Semana 15'],
      ];

  autoTable(doc, {
    startY: curY,
    head: [
      [
        {
          content: 'ACUERDOS TÉCNICOS Y COMPROMISOS OPERATIVOS DEL COMITÉ',
          colSpan: 4,
          styles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        },
      ],
      [
        { content: 'No.', styles: { halign: 'center', cellWidth: 12 } },
        { content: 'Acuerdo Formalizado', styles: { cellWidth: contentWidth - 82 } },
        { content: 'Responsable Designado', styles: { cellWidth: 42 } },
        { content: 'Fecha Límite', styles: { halign: 'center', cellWidth: 28 } },
      ],
    ],
    body: acuBody,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak' },
    headStyles: { fillColor: BLUE_MID, textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      0: { halign: 'center', fontStyle: 'bold', fillColor: GRAY_BG },
      3: { halign: 'center' },
    },
    margin: { left: margin, right: margin },
  });
  // @ts-expect-error autoTable adds lastAutoTable to jsPDF instance
  curY = doc.lastAutoTable.finalY + 12;

  // Firmas del Comité
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...NAVY);
  doc.text('FIRMAS DE LOS INTEGRANTES DEL COMITÉ DE INSTALACIÓN:', margin, curY);
  curY += 6;

  const fCols = 2;
  const fW = (contentWidth - 10) / fCols;
  const dummyFirmas = partMinuta.length > 0 ? partMinuta : [
    { nombre: 'C. Juan Pérez Martínez', cargo: 'Presidente del Comité Comunitario' },
    { nombre: 'Mtra. Laura Sánchez Gómez', cargo: 'Secretaria Técnica / Docente Titular' },
    { nombre: 'C. Rosa María Hernández', cargo: 'Vocal de Vigilancia y Enlace Social' },
    { nombre: safeStr(teacherName, 'Prof. Roberto Mendoza'), cargo: 'Coordinador del PEC en el Plantel' },
  ];

  dummyFirmas.slice(0, 4).forEach((f: any, idx: number) => {
    const colIdx = idx % 2;
    const rowIdx = Math.floor(idx / 2);
    const boxX = margin + colIdx * (fW + 10);
    const boxY = curY + rowIdx * 20;

    doc.setDrawColor(...NAVY);
    doc.setLineWidth(0.4);
    doc.line(boxX + 6, boxY + 11, boxX + fW - 6, boxY + 11);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...TEXT_DARK);
    doc.text(safeStr(f.nombre), boxX + fW / 2, boxY + 14, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(safeStr(f.cargo), boxX + fW / 2, boxY + 17, { align: 'center' });
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // PÁGINAS 22, 23, 24: OFICIOS FORMALES A ALIADOS (1 PÁGINA CADA UNO)
  // ═════════════════════════════════════════════════════════════════════════════
  const oficiosDefault = [
    {
      num: '001',
      destinatario: 'C. Presidente(a) Municipal / Auxiliar',
      cargo: 'Autoridad Constitucional del Territorio',
      institucion: 'H. Ayuntamiento de Zacatlán, Puebla',
      asunto: 'Solicitud de vinculación institucional y facilidades operativas para el PEC',
      solicitud: 'Por este medio, el Bachillerato General solicita formalmente el respaldo institucional para el desarrollo de las brigadas escolares y actividades de diagnóstico en plazas y espacios públicos del municipio.',
      compromiso: 'El bachillerato se compromete a compartir los diagnósticos técnicos, datos y memorias generadas en beneficio de la planeación y desarrollo local sustentable.',
    },
    {
      num: '002',
      destinatario: 'Dr(a). Director(a) del Centro de Salud',
      cargo: 'Titular de la Unidad Médica Territorial',
      institucion: 'Secretaría de Salud del Estado de Puebla',
      asunto: 'Coordinación interinstitucional para pláticas y talleres de salud e higiene',
      solicitud: 'Se solicita atentamente el apoyo de personal médico y de enfermería para impartir talleres preventivos sobre saneamiento ambiental, manejo de agua y salud comunitaria a los estudiantes del proyecto.',
      compromiso: 'Las brigadas estudiantiles coadyuvarán en la difusión de carteles y campañas de salud preventiva en las manzanas y localidades adyacentes.',
    },
    {
      num: '003',
      destinatario: 'C. Comisariado Ejidal / Asociación de Productores',
      cargo: 'Representante de Productores y Ejidatarios Locales',
      institucion: 'Comité Ejidal y Productores del Territorio',
      asunto: 'Vinculación técnica, diálogo de saberes y acceso a parcelas demostrativas',
      solicitud: 'Se solicita autorización y asesoría de los productores locales para realizar recorridos de campo, análisis de muestras de suelo y agua, y montaje de parcelas demostrativas escolares.',
      compromiso: 'Los estudiantes transferirán los prototipos y biofiltros construidos directamente al comité ejidal para su uso y resguardo permanente.',
    },
  ];

  const oficiosData = (imp.oficiosAliados && imp.oficiosAliados.length > 0) ? imp.oficiosAliados : oficiosDefault;

  oficiosData.slice(0, 3).forEach((of: any, idx: number) => {
    doc.addPage('letter', 'portrait');
    curY = 24;
    addSectionBar(doc, `3.3 Oficio Oficial a Aliados No. 00${idx + 1}/PEC — ${safeStr(of.institucion)}`, curY, margin, contentWidth);
    curY += 10;

    autoTable(doc, {
      startY: curY,
      head: [
        [
          {
            content: `OFICIO OFICIAL DE VINCULACIÓN INTERINSTITUCIONAL · NO. PEC-${safeStr(sCtx.cct, '21EBH')}-00${idx + 1}/${new Date().getFullYear()}`,
            colSpan: 2,
            styles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
          },
        ],
      ],
      body: [
        [
          { content: 'Destinatario:', styles: { fontStyle: 'bold', textColor: NAVY, cellWidth: 44 } },
          { content: `${safeStr(of.destinatario)}\n${safeStr(of.cargo)} — ${safeStr(of.institucion)}`, styles: { fontStyle: 'bold', textColor: TEXT_DARK } },
        ],
        [
          { content: 'Asunto Oficial:', styles: { fontStyle: 'bold', textColor: NAVY } },
          { content: safeStr(of.asunto), styles: { fontStyle: 'bold', textColor: TEXT_DARK } },
        ],
        [
          { content: 'Lugar y Fecha:', styles: { fontStyle: 'bold', textColor: NAVY } },
          { content: `${safeStr(sCtx.municipality, 'Puebla')}, Pue., a ${new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}`, styles: { textColor: TEXT_DARK } },
        ],
        [
          { content: 'Planteamiento de Colaboración:', styles: { fontStyle: 'bold', textColor: NAVY } },
          { content: safeStr(of.solicitud || of.propuestaColaboracion, 'Se solicita atentamente su valiosa colaboración y acompañamiento en las acciones territoriales del proyecto escolar.'), styles: { textColor: TEXT_DARK } },
        ],
        [
          { content: 'Compromiso Institucional:', styles: { fontStyle: 'bold', textColor: NAVY } },
          { content: safeStr(of.compromiso || 'El plantel compartirá plenamente los resultados, informes técnicos y productos generados con la dependencia aliada.'), styles: { textColor: TEXT_DARK } },
        ],
        [
          { content: 'Efectos Esperados:', styles: { fontStyle: 'bold', textColor: NAVY } },
          { content: 'Consolidar la alianza escuela-comunidad y maximizar el beneficio formativo para el alumnado y el impacto directo en la población.', styles: { textColor: TEXT_DARK } },
        ],
      ],
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 2.5, overflow: 'linebreak' },
      columnStyles: {
        0: { cellWidth: 44, fillColor: GRAY_BG },
        1: { cellWidth: contentWidth - 44 },
      },
      margin: { left: margin, right: margin },
    });
    // @ts-expect-error autoTable adds lastAutoTable to jsPDF instance
    curY = doc.lastAutoTable.finalY + 16;

    // Firmas del Oficio
    const bW = (contentWidth - 10) / 2;
    // Bloque Firma Emisor
    doc.setDrawColor(...NAVY);
    doc.setLineWidth(0.4);
    doc.line(margin + 10, curY + 14, margin + bW - 10, curY + 14);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...TEXT_DARK);
    doc.text(safeStr(carta.firmante, teacherName), margin + bW / 2, curY + 18, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...TEXT_MUTED);
    doc.text('Director(a) / Coordinador(a) PEC', margin + bW / 2, curY + 21, { align: 'center' });

    // Bloque Acuse de Recibo
    doc.setDrawColor(...NAVY);
    doc.rect(margin + bW + 10, curY - 2, bW - 20, 28, 'S');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...NAVY);
    doc.text('SELLO Y ACUSE DE RECIBIDO', margin + bW + bW / 2, curY + 4, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(...TEXT_MUTED);
    doc.text('Fecha de recepción: ____ / ____ / ________', margin + bW + bW / 2, curY + 12, { align: 'center' });
    doc.text('Nombre y firma de quien recibe: ________________', margin + bW + bW / 2, curY + 18, { align: 'center' });
    doc.text('Sello oficial de la dependencia', margin + bW + bW / 2, curY + 23, { align: 'center' });
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // PÁGINA 25: ANEXO 1: CÉDULA DE DIAGNÓSTICO PARTICIPATIVO COMUNITARIO (PORTRAIT)
  // ═════════════════════════════════════════════════════════════════════════════
  doc.addPage('letter', 'portrait');
  curY = 24;
  addSectionBar(doc, 'Anexo 1: Cédula de Diagnóstico Comunitario Participativo', curY, margin, contentWidth);
  curY += 10;

  const anexos = (p.fase2Anexos || {}) as Record<string, any>; // fallback tipado defensivo
  const a1 = anexos.anexo1 || anexos.anexo1Diagnostico || {};
  const f1Diag = (p.fase1Diagnostico || (p as any).fase1_diagnostico || {}) as Record<string, any>;
  const t1List = Array.isArray(f1Diag.tabla1) ? f1Diag.tabla1 : [];

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
      ? t1List.slice(0, 4).map((r: any) => `${r.col1}: ${r.col2}`)
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

  const a1Validacion = safeStr(
    a1.validacion,
    'Cotejo con actas de asamblea comunitaria, acuerdos de colegiado docente y validación de las autoridades del plantel.'
  );

  autoTable(doc, {
    startY: curY,
    head: [
      [
        {
          content: 'ANEXO 1: FORMATO DE RECOLECCIÓN DE DATOS Y DIAGNÓSTICO EN CAMPO',
          colSpan: 2,
          styles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        },
      ],
    ],
    body: [
      [
        { content: 'Objetivo del Instrumento:', styles: { fontStyle: 'bold', textColor: NAVY, cellWidth: 48 } },
        { content: safeStr(a1.objetivo, 'Levantar información empírica directamente en territorio mediante técnicas participativas para fundamentar las acciones del proyecto escolar comunitario.'), styles: { textColor: TEXT_DARK } },
      ],
      [
        { content: 'Metodología de Aplicación:', styles: { fontStyle: 'bold', textColor: NAVY } },
        { content: safeStr(a1.metodologia, 'Cédulas diagnósticas de campo, recorridos territoriales de observación guiada y diálogo estructurado con actores de la comunidad escolar y su entorno.'), styles: { textColor: TEXT_DARK } },
      ],
      [
        { content: 'Universo de Muestreo:', styles: { fontStyle: 'bold', textColor: NAVY } },
        { content: a1Universo, styles: { textColor: TEXT_DARK } },
      ],
      [
        { content: 'Dimensiones Indagadas:', styles: { fontStyle: 'bold', textColor: NAVY } },
        {
          content: a1DimensionesList.map(dim => `• ${dim}`).join('\n'),
          styles: { textColor: TEXT_DARK },
        },
      ],
      [
        { content: 'Responsables de Brigada:', styles: { fontStyle: 'bold', textColor: NAVY } },
        { content: a1Responsables, styles: { textColor: TEXT_DARK } },
      ],
      [
        { content: 'Criterios de Validación:', styles: { fontStyle: 'bold', textColor: NAVY } },
        { content: a1Validacion, styles: { textColor: TEXT_DARK } },
      ],
    ],
    theme: 'grid',
    styles: { fontSize: 7.2, cellPadding: 2.2, overflow: 'linebreak' },
    columnStyles: {
      0: { cellWidth: 48, fillColor: GRAY_BG },
      1: { cellWidth: contentWidth - 48 },
    },
    margin: { left: margin, right: margin },
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // PÁGINA 26: ANEXO 2: MATRIZ DE MONITOREO Y SEGUIMIENTO SEMANAL POR UAC
  // ═════════════════════════════════════════════════════════════════════════════
  doc.addPage('letter', 'portrait');
  curY = 24;
  addSectionBar(doc, 'Anexo 2: Matriz de Monitoreo y Seguimiento Semanal por UAC', curY, margin, contentWidth);
  curY += 10;

  const anexo2: SeguimientoRow[] = anexos.anexo2Seguimiento || [];
  const anexo2Rows = anexo2.length > 0
    ? anexo2.map((r: any, idx) => [
        `${r.semana || idx + 1} (${r.fase || 'Fase I'})`,
        safeStr(r.uac || 'UAC'),
        safeStr(r.metaOperativa || r.actividadPlaneada || 'Meta formativa'),
        safeStr(r.evidencia || r.actividadRealizada || 'Evidencia'),
        `${r.avancePorcentaje ?? r.porcentajeAvance ?? 100}%`,
        (r.semaforo || 'VERDE').toUpperCase(),
      ])
    : [
        ['Sem. 2 (Fase I)', 'Lengua y Comunicación I', 'Aplicación de cuestionarios de contexto', 'Instrumentos contestados', '100%', 'VERDE'],
        ['Sem. 4 (Fase I)', 'Pensamiento Matemático I', 'Tabulación y gráficas de la encuesta', 'Gráficas estadísticas', '100%', 'VERDE'],
        ['Sem. 6 (Fase II)', 'Cultura Digital I', 'Diseño de base de datos territorial', 'Hoja de cálculo en la nube', '100%', 'VERDE'],
        ['Sem. 8 (Fase II)', 'Ciencias Naturales', 'Diseño del prototipo sustentable de campo', 'Memoria de cálculo y planos', '95%', 'VERDE'],
        ['Sem. 10 (Fase III)', 'Humanidades / Ética', 'Gestión de acuerdos con líderes ejidales', 'Oficios y actas firmadas', '90%', 'VERDE'],
        ['Sem. 12 (Fase IV)', 'Laboratorio Multidisciplinar', 'Montaje y pruebas del prototipo en terreno', 'Bitácora fotográfica de campo', '85%', 'AMARILLO'],
        ['Sem. 14 (Fase V)', 'Colegiado Docente', 'Aplicación de encuestas de satisfacción vecinal', 'Cédulas Likert procesadas', '90%', 'VERDE'],
        ['Sem. 16 (Fase VI)', 'Comunidad Escolar', 'Montaje de stands en Feria Comunitaria', 'Muestra viva y acta de cierre', '100%', 'VERDE'],
      ];

  autoTable(doc, {
    startY: curY,
    head: [
      [
        {
          content: 'ANEXO 2: MATRIZ DE MONITOREO Y SEGUIMIENTO SEMANAL POR UAC',
          colSpan: 6,
          styles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        },
      ],
      [
        { content: 'Sem./Fase', styles: { cellWidth: 26 } },
        { content: 'UAC', styles: { cellWidth: 36 } },
        { content: 'Meta Operativa', styles: { cellWidth: 44 } },
        { content: 'Evidencia', styles: { cellWidth: 45 } },
        { content: 'Avance', styles: { halign: 'center', cellWidth: 16 } },
        { content: 'Semáforo', styles: { halign: 'center', cellWidth: contentWidth - 167 } },
      ],
    ],
    body: anexo2Rows,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak' },
    headStyles: { fillColor: BLUE_MID, textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: GRAY_BG },
      4: { halign: 'center' },
      5: { halign: 'center', fontStyle: 'bold' },
    },
    margin: { left: margin, right: margin },
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // PÁGINA 27: ANEXO 3: FORMATO DE REPORTE MENSUAL DE AVANCE Y AJUSTES (PORTRAIT)
  // ═════════════════════════════════════════════════════════════════════════════
  doc.addPage('letter', 'portrait');
  curY = 24;
  addSectionBar(doc, 'Anexo 3: Formato de Reporte Mensual de Avance y Ajustes Pedagógicos', curY, margin, contentWidth);
  curY += 10;

  const a3 = anexos.anexo3ReporteMensual || {};
  autoTable(doc, {
    startY: curY,
    head: [
      [
        {
          content: 'ANEXO 3: INFORME MENSUAL DE SEGUIMIENTO Y BITÁCORA TÉCNICA',
          colSpan: 2,
          styles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        },
      ],
    ],
    body: [
      [
        { content: 'Periodo Informado:', styles: { fontStyle: 'bold', textColor: NAVY, cellWidth: 45 } },
        { content: safeStr(a3.periodo, 'Bimestre Operativo de Implementación'), styles: { textColor: TEXT_DARK } },
      ],
      [
        { content: 'Resumen Ejecutivo:', styles: { fontStyle: 'bold', textColor: NAVY } },
        { content: safeStr(a3.resumenEjecutivo, 'Avance sustantivo en la conformación de brigadas y recopilación de evidencias en campo con alta participación de docentes, estudiantes y padres de familia.'), styles: { textColor: TEXT_DARK } },
      ],
      [
        { content: 'Logros Principales:', styles: { fontStyle: 'bold', textColor: NAVY } },
        { content: (a3.logros || ['Integración del 100% de los grupos escolares en las actividades del PEC', 'Consolidación de alianzas estratégicas con autoridades del territorio', 'Construcción participativa de prototipos funcionales de bajo costo']).join('\n• '), styles: { textColor: TEXT_DARK } },
      ],
      [
        { content: 'Dificultades y Ajustes:', styles: { fontStyle: 'bold', textColor: NAVY } },
        { content: (a3.accionesAjuste || a3.dificultades || ['Ajuste de tiempos de traslado para brigadas de campo mediante roles escalonados', 'Acopio solidario de materiales reciclables para mitigar costos']).join('\n• '), styles: { textColor: TEXT_DARK } },
      ],
      [
        { content: 'Evidencias Anexadas:', styles: { fontStyle: 'bold', textColor: NAVY } },
        { content: 'Fotografías de faenas comunitarias, listas de asistencia, gráficas estadísticas y actas de acuerdos vecinales.', styles: { textColor: TEXT_DARK } },
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

  // ═════════════════════════════════════════════════════════════════════════════
  // PÁGINAS 28, 29, 30: ANEXOS 4, 5, 6 (ENCUESTAS Y RÚBRICAS LIKERT DEDICADAS)
  // ═════════════════════════════════════════════════════════════════════════════
  const renderDedicatedLikert = (title: string, desc: string, items: any[], tableHeadTitle: string) => {
    doc.addPage('letter', 'portrait');
    curY = 24;
    addSectionBar(doc, title, curY, margin, contentWidth);
    curY += 10;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...TEXT_DARK);
    doc.text(desc, margin, curY);
    curY += 6;

    const body = items.map((it: any) => [
      safeStr(it.reactivo),
      safeStr(it.dimension),
      '[  ]', '[  ]', '[  ]', '[  ]', '[  ]',
    ]);

    autoTable(doc, {
      startY: curY,
      head: [
        [
          { content: tableHeadTitle, colSpan: 7, styles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 } },
        ],
        [
          { content: 'Reactivo / Indicador Evaluado', styles: { cellWidth: contentWidth - 94 } },
          { content: 'Dimensión', styles: { cellWidth: 34 } },
          { content: 'TD', styles: { halign: 'center', cellWidth: 12 } },
          { content: 'D', styles: { halign: 'center', cellWidth: 12 } },
          { content: 'N', styles: { halign: 'center', cellWidth: 12 } },
          { content: 'A', styles: { halign: 'center', cellWidth: 12 } },
          { content: 'TA', styles: { halign: 'center', cellWidth: 12 } },
        ],
      ],
      body,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 2.2, overflow: 'linebreak' },
      headStyles: { fillColor: BLUE_MID, textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: {
        2: { halign: 'center' },
        3: { halign: 'center' },
        4: { halign: 'center' },
        5: { halign: 'center' },
        6: { halign: 'center' },
      },
      margin: { left: margin, right: margin },
    });
    // @ts-expect-error autoTable adds lastAutoTable to jsPDF instance
    curY = doc.lastAutoTable.finalY + 6;

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6.5);
    doc.setTextColor(...TEXT_MUTED);
    doc.text('Escala: TD = Totalmente en Desacuerdo (1) | D = En Desacuerdo (2) | N = Neutral / Regular (3) | A = De Acuerdo (4) | TA = Totalmente de Acuerdo (5)', margin, curY);
  };

  // PÁGINA 28: Anexo 4
  const itemsA4 = [
    { reactivo: '1. El proyecto aborda una problemática auténtica, sentida y prioritaria para las familias de la comunidad.', dimension: 'Pertinencia Social' },
    { reactivo: '2. Se percibió una comunicación clara, respetuosa y constante por parte de los estudiantes y docentes.', dimension: 'Vinculación' },
    { reactivo: '3. Las actividades de campo y faenas se realizaron con orden, respeto y cuidado del entorno común.', dimension: 'Convivencia Ciudadana' },
    { reactivo: '4. Los prototipos, acciones o talleres impartidos brindaron soluciones útiles y prácticas al problema.', dimension: 'Impacto Técnico' },
    { reactivo: '5. La comunidad escolar tomó en cuenta las sugerencias y saberes de los vecinos y líderes locales.', dimension: 'Diálogo de Saberes' },
    { reactivo: '6. Se evidencia un cambio favorable y visible en el espacio territorial intervenido por el bachillerato.', dimension: 'Transformación' },
    { reactivo: '7. Recomendaría que este tipo de proyectos continúen implementándose en los siguientes ciclos escolares.', dimension: 'Sostenibilidad' },
    { reactivo: '8. En general, considero que el bachillerato es un motor positivo de desarrollo para nuestra comunidad.', dimension: 'Valoración Global' },
  ];
  renderDedicatedLikert(
    'Anexo 4: Encuesta de Impacto Comunitario (Escala Likert 5 Niveles)',
    'Instrumento estandarizado de valoración social aplicado a vecinos, padres de familia y aliados del entorno territorial:',
    itemsA4,
    'EVALUACIÓN DE PERCEPCIÓN E IMPACTO SOCIAL EN LA COMUNIDAD'
  );

  // PÁGINA 29: Anexo 5
  const itemsA5 = [
    { reactivo: '1. Comprendí con claridad la vinculación entre los temas de clase y la solución del problema comunitario.', dimension: 'Sentido del Aprendizaje' },
    { reactivo: '2. Participé de manera activa, responsable y colaborativa en las brigadas de trabajo y faenas de campo.', dimension: 'Trabajo Colaborativo' },
    { reactivo: '3. Desarrollé habilidades de investigación, comunicación oral y resolución práctica de imprevistos.', dimension: 'Habilidades Socioformativas' },
    { reactivo: '4. Desarrollé empatía y mayor compromiso con las personas y familias de mi comunidad territorial.', dimension: 'Conciencia Ciudadana' },
    { reactivo: '5. Fui capaz de reflexionar críticamente sobre mis errores y buscar alternativas de mejora en el equipo.', dimension: 'Metacognición' },
    { reactivo: '6. Apliqué el pensamiento crítico y matemático para optimizar los recursos y materiales asignados.', dimension: 'Rigor Académico' },
    { reactivo: '7. El proyecto despertó mi interés por seguir aprendiendo y participar en causas sociales de mi localidad.', dimension: 'Proyecto de Vida' },
    { reactivo: '8. Mi contribución al equipo fue valiosa para el logro del prototipo final y la feria comunitaria.', dimension: 'Autoeficacia' },
  ];
  renderDedicatedLikert(
    'Anexo 5: Instrumento de Autoevaluación Estudiantil y Metacognición',
    'Rúbrica de reflexión individual sobre el propio proceso de aprendizaje situado, socioemocional y cívico:',
    itemsA5,
    'CÉDULA DE AUTOEVALUACIÓN ESTUDIANTIL Y APRENDIZAJE SITUADO'
  );

  // PÁGINA 30: Anexo 6
  const itemsA6 = [
    { reactivo: '1. El colegiado docente articuló de forma efectiva los ejes temáticos y progresiones transversales.', dimension: 'Interdisciplinariedad' },
    { reactivo: '2. Se mantuvo una planeación coordinada que evitó la sobrecarga de tareas y duplicidad de actividades.', dimension: 'Organización Académica' },
    { reactivo: '3. Se acompañó de manera cercana y formativa a las brigadas de estudiantes en sus labores de campo.', dimension: 'Mediación Pedagógica' },
    { reactivo: '4. Se aplicaron instrumentos de evaluación auténtica (rúbricas, listas de cotejo y bitácoras de campo).', dimension: 'Evaluación Formativa' },
    { reactivo: '5. Se promovió el diálogo respetuoso y la toma de acuerdos corresponsables con el comité comunitario.', dimension: 'Vinculación Territorial' },
    { reactivo: '6. El colegiado analizó oportunamente los obstáculos detectados para realizar los ajustes necesarios.', dimension: 'Mejora Continua' },
    { reactivo: '7. Se sistematizaron las evidencias y testimonios requeridos para el expediente oficial del PEC.', dimension: 'Documentación Técnica' },
    { reactivo: '8. El trabajo colegiado fortaleció la identidad institucional del bachillerato y el clima escolar.', dimension: 'Cultura Institucional' },
  ];
  renderDedicatedLikert(
    'Anexo 6: Rúbrica de Evaluación del Trabajo Colegiado Docente',
    'Cédula de coevaluación del colegiado docente sobre el diseño, gestión y acompañamiento técnico del PEC:',
    itemsA6,
    'EVALUACIÓN FORMATIVA DEL TRABAJO COLEGIADO Y GESTIÓN ACADÉMICA'
  );


  state.pageWidth = pageWidth;
  state.pageHeight = pageHeight;
  state.contentWidth = contentWidth;
  state.curY = curY;
}
