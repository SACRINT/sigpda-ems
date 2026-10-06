// src/lib/cartografia-zona-docx-generator.ts
// Generador oficial DOCX para la Cartografía de Zona Escolar (Puebla 2026-2027)
// Cumple con el formato oficial del Curso Autogestivo DBEPA y Ejemplo Zona BD 015
import {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle,
  Header, Footer, PageNumberElement, ShadingType, VerticalAlign,
  convertMillimetersToTwip,
} from 'docx';
import type { CartografiaZonaProject, CartografiaPlantelItem, LineaAccionOficial, RecursoComunitario } from '@/types/cartografia';

const NAVY  = '1F3864';
const BLUE  = '2E74B5';
const GOLD  = 'C59B27';
const GRAY  = 'F2F2F2';
const WHITE = 'FFFFFF';
const TEXT_MUTED = '64748B';

const pt = (n: number) => n * 2;
const mm = (n: number) => convertMillimetersToTwip(n);

function bold(text: string, size = 11, color = '000000') {
  return new TextRun({ text, bold: true, size: pt(size), color, font: 'Arial' });
}
function normal(text: string, size = 11, color = '000000') {
  return new TextRun({ text, size: pt(size), color, font: 'Arial' });
}
function italic(text: string, size = 10, color = TEXT_MUTED) {
  return new TextRun({ text, italics: true, size: pt(size), color, font: 'Arial' });
}

function h1(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 240, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: NAVY, space: 2 } },
    children: [new TextRun({ text, bold: true, size: pt(13), color: NAVY, font: 'Arial' })],
  });
}

function h2(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 180, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: BLUE } },
    children: [new TextRun({ text, bold: true, size: pt(11), color: NAVY, font: 'Arial' })],
  });
}

function p(text: string, indent = false): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { before: 50, after: 50 },
    indent: indent ? { left: 360 } : undefined,
    children: [normal(text)],
  });
}

function bullet(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 40, after: 40 },
    indent: { left: 360 },
    children: [bold('•  ', 10, BLUE), normal(text)],
  });
}

function br(): Paragraph {
  return new Paragraph({ spacing: { before: 60, after: 60 } });
}

function placeholderParagraph(seccion: string): Paragraph {
  return new Paragraph({
    spacing: { before: 60, after: 60 },
    children: [
      italic(`[Pendiente — genere ${seccion} en el asistente de Cartografía de Zona]`, 10, '94A3B8'),
    ],
  });
}

function kvTable(rows: [string, string][], colWidths: [number, number] = [3200, 6400]): Table {
  const [w1, w2] = colWidths;
  return new Table({
    width: { size: w1 + w2, type: WidthType.DXA },
    rows: rows.map(([label, val]) =>
      new TableRow({
        children: [
          new TableCell({
            width: { size: w1, type: WidthType.DXA },
            shading: { fill: GRAY, type: ShadingType.CLEAR },
            margins: { top: mm(2), bottom: mm(2), left: mm(2.5), right: mm(2.5) },
            verticalAlign: VerticalAlign.CENTER,
            borders: {
              top: { style: BorderStyle.SINGLE, size: 4, color: 'D9D9D9' },
              bottom: { style: BorderStyle.SINGLE, size: 4, color: 'D9D9D9' },
              left: { style: BorderStyle.SINGLE, size: 4, color: 'D9D9D9' },
              right: { style: BorderStyle.SINGLE, size: 4, color: 'D9D9D9' },
            },
            children: [new Paragraph({ children: [bold(label, 10, NAVY)] })],
          }),
          new TableCell({
            width: { size: w2, type: WidthType.DXA },
            margins: { top: mm(2), bottom: mm(2), left: mm(2.5), right: mm(2.5) },
            verticalAlign: VerticalAlign.CENTER,
            borders: {
              top: { style: BorderStyle.SINGLE, size: 4, color: 'D9D9D9' },
              bottom: { style: BorderStyle.SINGLE, size: 4, color: 'D9D9D9' },
              left: { style: BorderStyle.SINGLE, size: 4, color: 'D9D9D9' },
              right: { style: BorderStyle.SINGLE, size: 4, color: 'D9D9D9' },
            },
            children: [new Paragraph({ children: [normal(val || '—', 10)] })],
          }),
        ],
      })
    ),
  });
}

function tableHeaders(headers: string[], widths: number[]): TableRow {
  return new TableRow({
    tableHeader: true,
    children: headers.map((h, i) =>
      new TableCell({
        width: { size: widths[i], type: WidthType.DXA },
        shading: { fill: NAVY, type: ShadingType.CLEAR },
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: mm(2.5), bottom: mm(2.5), left: mm(2), right: mm(2) },
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [bold(h, 9.5, WHITE)] })],
      })
    ),
  });
}

function tableDataRow(cells: string[], widths: number[], isEven = false): TableRow {
  return new TableRow({
    children: cells.map((c, i) =>
      new TableCell({
        width: { size: widths[i], type: WidthType.DXA },
        shading: isEven ? { fill: GRAY, type: ShadingType.CLEAR } : undefined,
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: mm(2), bottom: mm(2), left: mm(2), right: mm(2) },
        children: [new Paragraph({ children: [normal(c || '—', 9)] })],
      })
    ),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERADOR (a): PROYECTO COMPLETO — ESTRUCTURA I-IV
// ─────────────────────────────────────────────────────────────────────────────
export async function generateCartografiaZonaDocx(project: CartografiaZonaProject): Promise<Buffer> {
  const p_ = project || ({} as CartografiaZonaProject);
  const zona = p_.zonaNumero || p_.zonaClave || '004';
  const ciclo = p_.cicloEscolar || '2026-2027';
  const supervisor = p_.supervisorName || 'Supervisor(a) Escolar';
  const subsistema = p_.subsistema || 'Dirección de Bachilleratos Estatales y Preparatoria Abierta (DBEPA)';

  const planteles: CartografiaPlantelItem[] = p_.momento1Conocer?.planteles || [];
  const aliados: RecursoComunitario[] = p_.momento3Ubicar?.recursosAliados || [];
  const lineas: LineaAccionOficial[] = p_.momento5Decidir?.lineasAccion || [];

  const children: (Paragraph | Table)[] = [];

  // Portadilla
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 60 },
      children: [
        bold('CARTOGRAFÍA DE LA ZONA ESCOLAR', 16, NAVY),
        new TextRun({ text: `\nZONA ESCOLAR ${zona.toUpperCase()}`, bold: true, size: pt(13), color: GOLD, font: 'Arial' }),
        new TextRun({ text: `\nCICLO ESCOLAR ${ciclo}`, bold: true, size: pt(11), color: BLUE, font: 'Arial' }),
      ],
    }),
    br()
  );

  // ── I. DATOS DE IDENTIFICACIÓN DE LA ZONA ───────────────────────────
  children.push(
    h1('I. DATOS DE IDENTIFICACIÓN DE LA ZONA'),
    kvTable([
      ['Zona Escolar', `Zona Escolar ${zona}`],
      ['Clave de Supervisión', String(p_.zonaClave || '—')],
      ['Nivel / Subsistema', subsistema],
      ['Ciclo Escolar', ciclo],
      ['Supervisor(a) Escolar', supervisor],
      ['Municipio Sede', String(p_.municipioSede || '—')],
      ['Municipios que Atiende', String(p_.municipiosAtiende || '—')],
      ['Personal ATP de Zona', (p_.atps && p_.atps.length > 0) ? p_.atps.join(', ') : '—'],
      ['Total de Planteles Integrados', String(planteles.length)],
      ['Matrícula Total de la Zona', p_.momento1Conocer?.matriculaTotalZona ? `${p_.momento1Conocer.matriculaTotalZona} alumnos` : '—'],
    ]),
    br(),
    h2('Planteles que Integran la Zona Escolar')
  );

  if (planteles.length > 0) {
    children.push(
      new Table({
        width: { size: 9600, type: WidthType.DXA },
        rows: [
          tableHeaders(['No.', 'CCT', 'Plantel', 'Localidad / Municipio', 'Turno', 'Matrícula'], [600, 1500, 3100, 2400, 1000, 1000]),
          ...planteles.map((pl, idx) =>
            tableDataRow(
              [
                String(pl.no || idx + 1),
                pl.cct || '—',
                pl.nombre || '—',
                `${pl.localidad || ''}${pl.municipio ? ` (${pl.municipio})` : ''}`.trim() || '—',
                pl.turno || 'Matutino',
                pl.matricula ? String(pl.matricula) : '—',
              ],
              [600, 1500, 3100, 2400, 1000, 1000],
              idx % 2 === 1
            )
          ),
        ],
      })
    );
  } else {
    children.push(placeholderParagraph('el Directorio de Planteles en el Momento 1'));
  }
  children.push(br());

  // ── II. SÍNTESIS DEL DIAGNÓSTICO TERRITORIAL ─────────────────────────
  children.push(
    h1('II. SÍNTESIS DEL DIAGNÓSTICO TERRITORIAL'),
    h2('Caracterización del Contexto Territorial'),
    p(p_.momento1Conocer?.caracterizacionInicial || p_.momento3Ubicar?.descripcionTerritorial || 'La zona escolar se caracteriza por planteles distribuidos territorialmente en comunidades del sector, con diversidad socioeducativa y retos específicos de conectividad y movilidad.'),
    h2('Capa Cuantitativa (Estadística 911 / F11 / Indicadores de Zona)')
  );

  if (p_.momento2Organizar?.capaCuantitativa?.resumenEstadistico911F11) {
    children.push(p(p_.momento2Organizar.capaCuantitativa.resumenEstadistico911F11));
  } else {
    children.push(placeholderParagraph('el resumen de la Estadística 911 y F11 en el Momento 2'));
  }

  if (p_.momento2Organizar?.capaCuantitativa) {
    children.push(
      kvTable([
        ['Promedio de Abandono Escolar en la Zona', p_.momento2Organizar.capaCuantitativa.promedioAbandonoZona !== undefined ? `${p_.momento2Organizar.capaCuantitativa.promedioAbandonoZona}%` : '—'],
        ['Promedio de Eficiencia Terminal', p_.momento2Organizar.capaCuantitativa.promedioEficienciaZona !== undefined ? `${p_.momento2Organizar.capaCuantitativa.promedioEficienciaZona}%` : '—'],
        ['Promedio de Reprobación', p_.momento2Organizar.capaCuantitativa.promedioReprobacionZona !== undefined ? `${p_.momento2Organizar.capaCuantitativa.promedioReprobacionZona}%` : '—'],
        ['Planteles de Atención Prioritaria', (p_.momento2Organizar.capaCuantitativa.plantelesAtencionPrioritaria || []).join(', ') || 'Monitoreo preventivo general'],
      ]),
      br()
    );
  }

  children.push(
    h2('Capa Cualitativa y Problemáticas Prioritarias Detectadas'),
    p(p_.momento2Organizar?.capaCualitativa?.desafiosSocioeconomicos || 'Retos socioeconómicos asociados a traslados estudiantiles, dispersión geográfica y necesidades de reforzamiento en aprendizajes fundamentales.')
  );

  const probComunes = p_.momento2Organizar?.capaCualitativa?.problematicasComunes || [];
  for (const prob of probComunes) {
    children.push(bullet(prob));
  }

  children.push(h2('Recursos y Aliados Estratégicos del Territorio'));
  if (aliados.length > 0) {
    children.push(
      new Table({
        width: { size: 9600, type: WidthType.DXA },
        rows: [
          tableHeaders(['Recurso / Aliado', 'Tipo', 'Ubicación', 'Vinculación Pedagógica'], [2800, 1600, 2200, 3000]),
          ...aliados.map((al, idx) =>
            tableDataRow(
              [al.nombre || '—', al.tipo || 'comunitario', al.ubicacion || '—', al.vinculacionPedagogica || '—'],
              [2800, 1600, 2200, 3000],
              idx % 2 === 1
            )
          ),
        ],
      })
    );
  } else {
    children.push(placeholderParagraph('los Recursos y Aliados en el Momento 3 (Ubicar)'));
  }
  children.push(br());

  // ── III. ESTABLECIMIENTO DE METAS INTEGRADAS DE ZONA ────────────────
  children.push(
    h1('III. ESTABLECIMIENTO DE METAS INTEGRADAS DE ZONA'),
    h2('Meta General de la Zona Escolar (Fórmula CREAA)'),
    p(p_.momento5Decidir?.metaGeneralZona || 'Implementar durante el ciclo escolar 2026–2027 estrategias homologadas de fortalecimiento de los aprendizajes y retención en los planteles de la zona escolar, disminuyendo el índice de abandono y reprobación mediante el uso de proyectos PAEC y acompañamiento situado.'),
    h2('Indicadores CREAA Asociados')
  );

  const indicadoresCreaa = p_.momento5Decidir?.indicadoresCreaaAsociados || ['Resultados de Evaluaciones (EDIEMS / ESA)', 'Abandono Escolar', 'Eficiencia Terminal'];
  for (const ind of indicadoresCreaa) {
    children.push(bullet(ind));
  }

  children.push(h2('Retos Pedagógicos y Categorías Integrales PMC de Zona'));
  const retosPedagogicos = p_.momento4Analizar?.retosPedagogicosCreaa || ['Apropiación Curricular y Fortalecimiento de Aprendizajes Fundamentales', 'Permanencia y Prevención Oportuna del Abandono'];
  for (const reto of retosPedagogicos) {
    children.push(bullet(reto));
  }
  children.push(br(), h2('Indicadores Actuales y Metas de Zona por Plantel'));

  if (planteles.length > 0) {
    children.push(
      new Table({
        width: { size: 9600, type: WidthType.DXA },
        rows: [
          tableHeaders(['No.', 'CCT', 'Plantel', 'Ef. Term.', 'Abandono', 'Reprob.', 'Promedio', 'Meta E.T.', 'Meta Aband.'], [500, 1300, 2400, 900, 900, 900, 900, 900, 900]),
          ...planteles.map((pl, idx) =>
            tableDataRow(
              [
                String(pl.no || idx + 1),
                pl.cct || '—',
                pl.nombre || '—',
                pl.eficienciaTerminal !== undefined ? `${pl.eficienciaTerminal}%` : '—',
                pl.abandono !== undefined ? `${pl.abandono}%` : '—',
                pl.reprobacion !== undefined ? `${pl.reprobacion}%` : '—',
                pl.promedioGeneral !== undefined ? String(pl.promedioGeneral) : '—',
                pl.metaEficienciaTerminal !== undefined ? `${pl.metaEficienciaTerminal}%` : '—',
                pl.metaAbandono !== undefined ? `${pl.metaAbandono}%` : '—',
              ],
              [500, 1300, 2400, 900, 900, 900, 900, 900, 900],
              idx % 2 === 1
            )
          ),
        ],
      })
    );
  } else {
    children.push(placeholderParagraph('los datos estadísticos de planteles'));
  }
  children.push(br());

  // ── IV. ESTRATEGIAS, ACCIONES Y SEGUIMIENTO ──────────────────────────
  children.push(
    h1('IV. ESTRATEGIAS, ACCIONES Y SEGUIMIENTO'),
    p('Las siguientes tres líneas de acción estructuran el acompañamiento pedagógico, colegiado e institucional durante el ciclo escolar 2026–2027:'),
    br()
  );

  if (lineas.length > 0) {
    for (let idx = 0; idx < lineas.length; idx++) {
      const linea = lineas[idx];
      children.push(
        h2(`Línea de Acción ${linea.numero || idx + 1}: ${linea.titulo || 'Acción Estratégica Institucional'}`),
        kvTable([
          ['Acciones Específicas', (linea.accionesEspecificas && linea.accionesEspecificas.length > 0) ? linea.accionesEspecificas.join('\n• ') : '—'],
          ['Recursos Necesarios', (linea.recursos && linea.recursos.length > 0) ? linea.recursos.join(', ') : '—'],
          ['Responsables', linea.responsables || 'Supervisor(a), directores(as) y colectivos docentes'],
          ['Productos / Entregables', linea.entregables || 'Reportes de avance, planeaciones ajustadas e informes de seguimiento'],
          ['Estrategia de Seguimiento', linea.estrategiaSeguimiento || 'Análisis en Consejos Académicos de Zona'],
          ['Periodo de Ejecución', linea.periodoEjecucion || 'Agosto 2026 – Julio 2027'],
        ], [2600, 7000]),
        br()
      );
    }
  } else {
    children.push(placeholderParagraph('las Líneas de Acción Oficiales en el Momento 5 (Decidir)'));
  }

  children.push(h2('Acuerdos de Autonomía del Consejo Académico de Zona'));
  const acuerdos = p_.momento4Analizar?.acuerdosAutonomiaConsejo || ['Adaptaciones curriculares contextualizadas en cada colectivo docente', 'Socialización de buenas prácticas formativas y de evaluación entre pares'];
  for (const ac of acuerdos) {
    children.push(bullet(ac));
  }

  children.push(h2('Compromisos de la Supervisión Escolar'));
  const compromisos = p_.momento5Decidir?.compromisosSupervision || ['Acompañamiento situado a directivos y docentes en visitas de campo', 'Monitoreo sistemático de indicadores CREAA y retroalimentación formativa'];
  for (const comp of compromisos) {
    children.push(bullet(comp));
  }
  children.push(br(), br());

  // Bloque de Firma y Validación Institucional
  children.push(
    new Table({
      width: { size: 9600, type: WidthType.DXA },
      borders: {
        top: { style: BorderStyle.NONE },
        bottom: { style: BorderStyle.NONE },
        left: { style: BorderStyle.NONE },
        right: { style: BorderStyle.NONE },
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 9600, type: WidthType.DXA },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 8, color: NAVY },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              margins: { top: mm(4), bottom: mm(4) },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    bold('VALIDACIÓN Y AUTORIZACIÓN OFICIAL\n', 10, NAVY),
                    normal('\n\n_____________________________________________________\n', 10),
                    bold(`${supervisor.toUpperCase()}\n`, 10),
                    normal(`Supervisor(a) de la Zona Escolar ${zona}\n`, 9.5),
                    italic('Sello Oficial de la Supervisión Escolar', 8.5),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    })
  );

  const doc = new Document({
    creator: 'SIGPDA-EMS · Cartografía de Zona',
    title: `Cartografía de la Zona Escolar ${zona} — Ciclo ${ciclo}`,
    description: 'Proyecto Integral de Cartografía de Zona Escolar (Estructura Oficial I-IV)',
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: mm(20),
              bottom: mm(20),
              left: mm(20),
              right: mm(20),
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Table({
                width: { size: 9600, type: WidthType.DXA },
                borders: {
                  top: { style: BorderStyle.NONE },
                  bottom: { style: BorderStyle.SINGLE, size: 8, color: GOLD },
                  left: { style: BorderStyle.NONE },
                  right: { style: BorderStyle.NONE },
                },
                rows: [
                  new TableRow({
                    children: [
                      new TableCell({
                        margins: { bottom: mm(2) },
                        children: [
                          new Paragraph({
                            children: [
                              bold('SECRETARÍA DE EDUCACIÓN PÚBLICA DEL ESTADO DE PUEBLA\n', 8.5, NAVY),
                              bold('SUBSECRETARÍA DE EDUCACIÓN OBLIGATORIA · DBEPA\n', 8, '475569'),
                              italic(`Cartografía de la Zona Escolar ${zona} — Ciclo ${ciclo}`, 8, '64748B'),
                            ],
                          }),
                        ],
                      }),
                      new TableCell({
                        margins: { bottom: mm(2) },
                        children: [
                          new Paragraph({
                            alignment: AlignmentType.RIGHT,
                            children: [
                              bold('PROYECTO INTEGRAL DE ZONA\n', 8.5, NAVY),
                              italic(`Supervisor(a): ${supervisor}`, 8, '64748B'),
                            ],
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Table({
                width: { size: 9600, type: WidthType.DXA },
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 4, color: 'D9D9D9' },
                  bottom: { style: BorderStyle.NONE },
                  left: { style: BorderStyle.NONE },
                  right: { style: BorderStyle.NONE },
                },
                rows: [
                  new TableRow({
                    children: [
                      new TableCell({
                        margins: { top: mm(2) },
                        children: [
                          new Paragraph({
                            children: [
                              italic('SIGPDA-EMS · Modelo Educativo 2025 · MCCEMS Puebla', 8),
                            ],
                          }),
                        ],
                      }),
                      new TableCell({
                        margins: { top: mm(2) },
                        children: [
                          new Paragraph({
                            alignment: AlignmentType.RIGHT,
                            children: [
                              normal('Página ', 8),
                              new PageNumberElement(),
                            ],
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  return await Packer.toBuffer(doc);
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERADOR (b): RESUMEN EJECUTIVO — MÁXIMO 2 CUARTILLAS (MÓDULO 4)
// ─────────────────────────────────────────────────────────────────────────────
export async function generateResumenEjecutivoDocx(project: CartografiaZonaProject): Promise<Buffer> {
  const p_ = project || ({} as CartografiaZonaProject);
  const zona = p_.zonaNumero || p_.zonaClave || '004';
  const ciclo = p_.cicloEscolar || '2026-2027';
  const supervisor = p_.supervisorName || 'Supervisor(a) Escolar';
  const memoria = p_.memoriaPedagogica;

  const children: (Paragraph | Table)[] = [];

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 60, after: 100 },
      children: [
        bold('RESUMEN EJECUTIVO DE LA CARTOGRAFÍA DE ZONA', 13, NAVY),
        new TextRun({ text: `\nZONA ESCOLAR ${zona.toUpperCase()} · CICLO ESCOLAR ${ciclo}`, bold: true, size: pt(10), color: GOLD, font: 'Arial' }),
      ],
    }),

    // ── 1. DIAGNÓSTICO TERRITORIAL ──────────────────────────────────────
    h1('1. DIAGNÓSTICO TERRITORIAL'),
    p(
      p_.momento2Organizar?.capaCuantitativa?.resumenEstadistico911F11 ||
      p_.momento3Ubicar?.descripcionTerritorial ||
      p_.momento1Conocer?.caracterizacionInicial ||
      'La zona escolar integra planteles con condiciones territoriales semiurbanas y rurales, donde las dinámicas de movilidad, el contexto socioeconómico y los indicadores del 911/F11 sustentan la necesidad de un acompañamiento formativo y contextualizado.'
    ),
    br(),

    // ── 2. SISTEMATIZACIÓN DE LA AUTONOMÍA ──────────────────────────────
    h1('2. SISTEMATIZACIÓN DE LA AUTONOMÍA'),
    p(
      memoria?.comoLoLogramos ||
      (p_.momento4Analizar?.acuerdosAutonomiaConsejo && p_.momento4Analizar.acuerdosAutonomiaConsejo.length > 0
        ? p_.momento4Analizar.acuerdosAutonomiaConsejo.join(' ')
        : 'Los colectivos docentes y directivos de la zona asumieron la autonomía profesional adaptando las progresiones de aprendizaje y desarrollando proyectos integradores PAEC acordes con la realidad de sus comunidades.')
    ),
    br(),

    // ── 3. ANÁLISIS DE EFECTIVIDAD ──────────────────────────────────────
    h1('3. ANÁLISIS DE EFECTIVIDAD'),
    p(
      memoria?.queLogramos ||
      'Se observa una mejora tangible en la diversificación de estrategias de evaluación formativa y en el clima escolar, articulando los ejes de transformación del Modelo Educativo 2025 y la disminución de alertas de rezago.'
    )
  );

  if (memoria?.indicadoresCambio) {
    children.push(
      bullet(`Indicador de Proceso: ${memoria.indicadoresCambio.proceso || 'Consolidación de planeaciones situadas'}`),
      bullet(`Indicador CREAA: ${memoria.indicadoresCambio.creaa || 'Aumento en retención escolar'}`),
      bullet(`Impacto Territorial: ${memoria.indicadoresCambio.impactoTerritorial || 'Mayor vinculación con la comunidad'}`)
    );
  }
  children.push(br());

  // ── 4. HOJA DE RUTA (CICLO 2026-2027) ───────────────────────────────
  children.push(
    h1('4. HOJA DE RUTA (CICLO 2026-2027)'),
    p('Recomendaciones prioritarias para la mejora continua y el acompañamiento situado en la zona:')
  );

  const recomendaciones = (memoria?.hojaDeRutaProximoCiclo && memoria.hojaDeRutaProximoCiclo.length > 0)
    ? memoria.hojaDeRutaProximoCiclo
    : (p_.momento5Decidir?.compromisosSupervision && p_.momento5Decidir.compromisosSupervision.length > 0)
      ? p_.momento5Decidir.compromisosSupervision
      : [
          '1. Fortalecer el acompañamiento formativo a planteles de atención prioritaria focalizando causas territoriales de abandono.',
          '2. Homologar el seguimiento de evaluaciones diagnósticas (EDIEMS/ESA) mediante academias colegiadas de zona.',
          '3. Consolidar la red de proyectos comunitarios PAEC y la memoria pedagógica viva de los colectivos docentes.',
        ];

  for (const rec of recomendaciones) {
    children.push(bullet(rec));
  }
  children.push(br());

  // Firma compacta
  children.push(
    new Table({
      width: { size: 9600, type: WidthType.DXA },
      borders: {
        top: { style: BorderStyle.NONE },
        bottom: { style: BorderStyle.NONE },
        left: { style: BorderStyle.NONE },
        right: { style: BorderStyle.NONE },
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 9600, type: WidthType.DXA },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 6, color: NAVY },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              margins: { top: mm(3), bottom: mm(2) },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    bold(`${supervisor}\n`, 9, NAVY),
                    italic(`Supervisor(a) de la Zona Escolar ${zona} · Ciclo ${ciclo}`, 8),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    })
  );

  const doc = new Document({
    creator: 'SIGPDA-EMS · Resumen Ejecutivo Cartografía',
    title: `Resumen Ejecutivo de la Cartografía — Zona ${zona}`,
    description: 'Resumen Ejecutivo de Zona Escolar (4 Secciones Módulo 4)',
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: mm(18),
              bottom: mm(18),
              left: mm(20),
              right: mm(20),
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Table({
                width: { size: 9600, type: WidthType.DXA },
                borders: {
                  top: { style: BorderStyle.NONE },
                  bottom: { style: BorderStyle.SINGLE, size: 6, color: GOLD },
                  left: { style: BorderStyle.NONE },
                  right: { style: BorderStyle.NONE },
                },
                rows: [
                  new TableRow({
                    children: [
                      new TableCell({
                        margins: { bottom: mm(1.5) },
                        children: [
                          new Paragraph({
                            children: [
                              bold('SECRETARÍA DE EDUCACIÓN PÚBLICA DEL ESTADO DE PUEBLA · DBEPA\n', 8, NAVY),
                              italic(`Cartografía de Zona ${zona} — Ciclo ${ciclo} · Supervisor(a): ${supervisor}`, 7.5, '64748B'),
                            ],
                          }),
                        ],
                      }),
                      new TableCell({
                        margins: { bottom: mm(1.5) },
                        children: [
                          new Paragraph({
                            alignment: AlignmentType.RIGHT,
                            children: [
                              bold('RESUMEN EJECUTIVO\n', 8, NAVY),
                              italic('Máximo 2 cuartillas', 7.5, GOLD),
                            ],
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Table({
                width: { size: 9600, type: WidthType.DXA },
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 4, color: 'D9D9D9' },
                  bottom: { style: BorderStyle.NONE },
                  left: { style: BorderStyle.NONE },
                  right: { style: BorderStyle.NONE },
                },
                rows: [
                  new TableRow({
                    children: [
                      new TableCell({
                        margins: { top: mm(1.5) },
                        children: [
                          new Paragraph({
                            children: [
                              italic('SIGPDA-EMS · Entregable Oficial Módulo 4 · Memoria Pedagógica', 7.5),
                            ],
                          }),
                        ],
                      }),
                      new TableCell({
                        margins: { top: mm(1.5) },
                        children: [
                          new Paragraph({
                            alignment: AlignmentType.RIGHT,
                            children: [
                              normal('Página ', 7.5),
                              new PageNumberElement(),
                            ],
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  return await Packer.toBuffer(doc);
}
