// src/lib/pips-docx-generator.ts
// Generates a Word (.docx) file from a PipsProject row
import {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, PageBreak,
  Header, Footer, PageNumberElement, ShadingType, VerticalAlign,
  convertMillimetersToTwip,
} from 'docx';
import type { PipsPlantele, PipsObjetivo, PipsCronogramaActividad } from '@/types/pips';

const NAVY  = '1F3864';
const BLUE  = '2E74B5';
const GRAY  = 'F2F2F2';
const WHITE = 'FFFFFF';

const pt = (n: number) => n * 2;
const mm = (n: number) => convertMillimetersToTwip(n);

function bold(text: string, size = 11, color = '000000') {
  return new TextRun({ text, bold: true, size: pt(size), color, font: 'Arial' });
}
function normal(text: string, size = 11, color = '000000') {
  return new TextRun({ text, size: pt(size), color, font: 'Arial' });
}

function h1(text: string) {
  // Sin heading: HeadingLevel — evita que docx inyecte w:shd en w:pPr (corrupción Word)
  return new Paragraph({
    spacing: { before: 240, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: NAVY, space: 1 } },
    children: [new TextRun({ text, bold: true, size: pt(14), color: NAVY, font: 'Arial' })],
  });
}

function h2(text: string) {
  return new Paragraph({
    spacing: { before: 200, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: BLUE } },
    children: [new TextRun({ text, bold: true, size: pt(12), color: NAVY, font: 'Arial' })],
  });
}

function h3(text: string) {
  return new Paragraph({
    spacing: { before: 140, after: 60 },
    children: [new TextRun({ text, bold: true, size: pt(11), color: BLUE, font: 'Arial' })],
  });
}

function p(text: string, indent = false) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { before: 60, after: 60 },
    indent: indent ? { left: 360 } : undefined,
    children: [normal(text)],
  });
}

function bullet(text: string) {
  // Sin bullet:{level} — evita dependencia en numbering.xml que puede corromper el docx
  return new Paragraph({
    spacing: { before: 40, after: 40 },
    indent: { left: 360, hanging: 200 },
    children: [normal('•  ' + text)],
  });
}

function br() {
  return new Paragraph({ children: [new PageBreak()] });
}

function cell(
  text: string,
  bg = WHITE,
  isBold = false,
  width?: number,
  align: typeof VerticalAlign.CENTER = VerticalAlign.CENTER,
  textColor?: string,
) {
  const lines = String(text).split('\n');
  // Si el fondo es oscuro (NAVY), el texto debe ser blanco para ser legible
  const isDark = bg !== WHITE && bg !== GRAY;
  const color = textColor ?? (isDark ? WHITE : '1A1A1A');

  const textRuns: TextRun[] = [];
  lines.forEach((line, idx) => {
    textRuns.push(isBold
      ? new TextRun({ text: line, bold: true, size: pt(10), color, font: 'Arial' })
      : new TextRun({ text: line, size: pt(10), color, font: 'Arial' })
    );
    if (idx < lines.length - 1) {
      textRuns.push(new TextRun({ break: 1 }));
    }
  });

  // Solo añadimos shading cuando el fondo NO es blanco.
  // ShadingType.CLEAR = muestra el color de relleno directamente (correcto en OOXML).
  // ShadingType.SOLID = superpone patrón negro sobre el relleno → fondo negro (bug).
  // No añadir shading en celdas blancas evita que docx inyecte w:shd en w:pPr.
  const shadingProp = bg !== WHITE
    ? { fill: bg, type: ShadingType.CLEAR, color: 'auto' }
    : undefined;

  return new TableCell({
    verticalAlign: align,
    ...(shadingProp ? { shading: shadingProp } : {}),
    borders: {
      top:    { style: BorderStyle.SINGLE, size: 4, color: 'AAAAAA' },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: 'AAAAAA' },
      left:   { style: BorderStyle.SINGLE, size: 4, color: 'AAAAAA' },
      right:  { style: BorderStyle.SINGLE, size: 4, color: 'AAAAAA' },
    },
    width: width ? { size: width, type: WidthType.DXA } : undefined,
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 40, after: 40 },
        children: textRuns,
      }),
    ],
  });
}

function simpleTable(headers: string[], rows: string[][], colWidths?: number[]) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: headers.map((h, i) =>
          cell(h, NAVY, true, colWidths?.[i])
        ),
      }),
      ...rows.map((row, ri) =>
        new TableRow({
          children: row.map((c, i) =>
            cell(c, ri % 2 === 0 ? WHITE : GRAY, false, colWidths?.[i])
          ),
        })
      ),
    ],
  });
}

function kvTable(pairs: [string, string][], col1 = 2800, col2 = 6700) {
  return simpleTable(['Campo', 'Valor'], pairs, [col1, col2]);
}

export async function generatePipsDocx(row: Record<string, unknown>): Promise<Buffer> {
  const p_ = row as Record<string, unknown>;

  // Parse JSON fields safely
  const planteles: PipsPlantele[] = Array.isArray(p_.planteles_json) ? p_.planteles_json as PipsPlantele[] : [];
  const problematicas = Array.isArray(p_.problematicas_json) ? p_.problematicas_json as { titulo: string; descripcion: string; prioridad: string }[] : [];
  const objetivos: PipsObjetivo[] = Array.isArray(p_.objetivos_especificos_json) ? p_.objetivos_especificos_json as PipsObjetivo[] : [];
  const cronograma: PipsCronogramaActividad[] = Array.isArray(p_.cronograma_json) ? p_.cronograma_json as PipsCronogramaActividad[] : [];
  const evaluacion = Array.isArray(p_.evaluacion_json) ? p_.evaluacion_json as { indicador: string; meta: string; instrumento: string }[] : [];

  const totalT = planteles.reduce((s, pl) => s + (pl.total || 0), 0);
  const totalH = planteles.reduce((s, pl) => s + (pl.hombres || 0), 0);
  const totalM = planteles.reduce((s, pl) => s + (pl.mujeres || 0), 0);

  const doc = new Document({
    creator: 'SIGPDA-EMS',
    title: `Cartografía de Zona Escolar ${p_.zona_nombre} ${p_.ciclo_escolar}`,
    sections: [
      {
        properties: {
          page: { margin: { top: mm(25), bottom: mm(25), left: mm(25), right: mm(25) } },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [normal(`SECRETARÍA DE EDUCACIÓN PÚBLICA | DIRECCIÓN DE BACHILLERATOS ESTATALES | ${p_.zona_nombre} | ${p_.ciclo_escolar}`, 9, '888888')],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  normal(`Cartografía de Zona Escolar ${p_.ciclo_escolar} — ${p_.zona_nombre} — ${p_.supervisor_name ?? ''}  |  Página `, 9, '888888'),
                  new PageNumberElement(),
                ],
              }),
            ],
          }),
        },
        children: [
          new Paragraph({ spacing: { after: 400 } }),
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [bold('SECRETARÍA DE EDUCACIÓN PÚBLICA DEL ESTADO DE PUEBLA', 12, NAVY)] }),
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [bold('SUBSECRETARÍA DE EDUCACIÓN MEDIA SUPERIOR', 12, NAVY)] }),
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [bold('DIRECCIÓN DE BACHILLERATOS ESTATALES Y PREPARATORIA ABIERTA', 12, NAVY)] }),
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 140, after: 100 }, children: [bold('CARTOGRAFÍA DE ZONA ESCOLAR', 18, NAVY)] }),
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 300 }, children: [bold('PLAN DE INTERVENCIÓN Y ACOMPAÑAMIENTO PEDAGÓGICO DE SUPERVISIÓN', 12, BLUE)] }),
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [bold(`CICLO ESCOLAR ${p_.ciclo_escolar}`, 14, BLUE)] }),
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200, after: 80 }, children: [bold(String(p_.zona_nombre), 13, NAVY)] }),
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [normal(`Clave: ${p_.zona_clave ?? ''}`, 11)] }),
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [normal(`${p_.subsistema} | ${p_.modalidad}`, 11)] }),
          ...(totalT > 0 ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [normal(`${p_.num_planteles} planteles | ${totalT.toLocaleString()} alumnos (${totalH}H / ${totalM}M)`, 11)] })] : []),
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 160, after: 60 }, children: [bold('Supervisor: ', 11), normal(String(p_.supervisor_name ?? ''), 11)] }),
          ...(p_.atps ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [bold('ATP(s): ', 11), normal(String(p_.atps), 11)] })] : []),
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 100, after: 60 }, children: [normal(String(p_.municipio_sede ?? ''), 11)] }),

          br(),

          // ── 1. DATOS GENERALES ────────────────────────────────────
          h1('1. DATOS GENERALES DE LA SUPERVISIÓN'),
          kvTable([
            ['Clave de la Zona Escolar', String(p_.zona_clave ?? '')],
            ['Nombre de la Zona Escolar', String(p_.zona_nombre)],
            ['Supervisor', String(p_.supervisor_name ?? '')],
            ['Municipio sede', String(p_.municipio_sede ?? '')],
            ['Municipios que atiende', String(p_.municipios_atiende ?? '')],
            ['Número de planteles', String(p_.num_planteles)],
            ['Tipo de subsistema', String(p_.subsistema)],
            ['Modalidad', String(p_.modalidad)],
            ['Ciclo escolar', String(p_.ciclo_escolar)],
            ['Personal ATP', String(p_.atps ?? '')],
          ]),

          br(),

          // ── 2. PRESENTACIÓN DEL SUPERVISOR ───────────────────────
          h1('2. PRESENTACIÓN DEL SUPERVISOR ESCOLAR'),
          ...(p_.presentacion_supervisor
            ? String(p_.presentacion_supervisor).split('\n').map(line => p(line))
            : [p('El supervisor escolar encabeza los procesos pedagógicos y administrativos de la zona.')]),

          br(),

          // ── 3. REFLEXIÓN PIPS ANTERIOR ────────────────────────────
          h1('3. REFLEXIÓN DEL PIPS ANTERIOR'),
          ...(p_.pips_anterior_realizado
            ? [
                h2('3.1 Reflexión del ciclo anterior'),
                ...(p_.reflexion_pips_anterior ? String(p_.reflexion_pips_anterior).split('\n').map(l => p(l)) : [p('Se realizó PIPS en el ciclo anterior.')]),
                h2('3.2 Fortalezas identificadas'),
                ...(p_.fortalezas_anterior ? String(p_.fortalezas_anterior).split('\n').filter(Boolean).map(l => bullet(l)) : []),
                h2('3.3 Áreas de oportunidad'),
                ...(p_.areas_oportunidad_anterior ? String(p_.areas_oportunidad_anterior).split('\n').filter(Boolean).map(l => bullet(l)) : []),
              ]
            : [p('La supervisión no elaboró PIPS en el ciclo escolar anterior. Se tomaron como base las problemáticas identificadas durante las visitas de acompañamiento y la revisión de documentos pedagógicos para construir el diagnóstico del presente ciclo.')]),

          br(),

          // ── 4. DIAGNÓSTICO ────────────────────────────────────────
          h1('4. DIAGNÓSTICO DE LA ZONA ESCOLAR'),

          // 4a — Planteles (si los hay)
          ...(planteles.length > 0
            ? [
                h2('4.1 Matrícula por plantel'),
                simpleTable(
                  ['No.', 'CCT', 'Plantel', 'Localidad', 'Municipio', 'H', 'M', 'Total'],
                  planteles.map(pl => [
                    String(pl.no), pl.cct, pl.nombre, pl.localidad, pl.municipio,
                    String(pl.hombres), String(pl.mujeres), String(pl.total),
                  ]),
                  [350, 1300, 1900, 1200, 1300, 350, 350, 450],
                ),
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  spacing: { before: 60 },
                  children: [bold(`TOTAL: ${totalH}H + ${totalM}M = ${totalT} alumnos`, 11, NAVY)],
                }),
              ]
            : []),

          // 4b — Contexto
          ...(p_.diagnostico_contexto
            ? [h2('4.2 Contexto socioeducativo'), ...String(p_.diagnostico_contexto).split('\n').map(l => p(l))]
            : []),

          // 4c — Problemáticas
          ...(problematicas.length > 0
            ? [
                h2('4.3 Problemáticas pedagógicas detectadas'),
                ...problematicas.flatMap((prob, i) => [
                  h3(`Problemática ${i + 1} (Prioridad ${prob.prioridad ?? 'media'}): ${prob.titulo}`),
                  p(prob.descripcion),
                ]),
              ]
            : []),

          br(),

          // ── 5. OBJETIVOS Y METAS ──────────────────────────────────
          h1('5. OBJETIVOS Y METAS DEL PIPS'),
          ...(p_.objetivo_general
            ? [h2('5.1 Objetivo General'), p(String(p_.objetivo_general))]
            : []),

          ...(objetivos.length > 0
            ? [
                h2('5.2 Objetivos Específicos y Metas'),
                ...objetivos.flatMap(obj => [
                  h3(`Objetivo ${obj.numero}: ${obj.descripcion}`),
                  ...(obj.metas?.length > 0
                    ? [
                        simpleTable(
                          ['Meta', 'Indicador', 'Responsable', 'Fecha de verificación'],
                          obj.metas.map(m => [m.meta, m.indicador, m.responsable, m.fecha]),
                          [3500, 2500, 1800, 1700],
                        ),
                      ]
                    : []),
                ]),
              ]
            : []),

          br(),

          // ── 6. CRONOGRAMA ─────────────────────────────────────────
          h1('6. CRONOGRAMA DE IMPLEMENTACIÓN'),
          ...(cronograma.length > 0
            ? [
                simpleTable(
                  ['Actividad', 'Objetivo', 'Responsable', 'Mes', 'Recursos', 'Indicador'],
                  cronograma.map(c => [c.actividad, c.objetivo, c.responsable, c.mes, c.recursos, c.indicador]),
                  [2500, 1300, 1400, 1000, 1700, 1600],
                ),
              ]
            : [p('El cronograma se elaborará al inicio del ciclo escolar con base en las fechas del Plan Anual de Trabajo Institucional.')]),

          br(),

          // ── 7. MÉTODOS DE SEGUIMIENTO ────────────────────────────
          h1('7. MÉTODOS DE SEGUIMIENTO Y OBSERVACIÓN DEL CAMBIO'),
          p('Para el seguimiento y evaluación de las acciones del PIPS se utilizarán los siguientes instrumentos, buscando la triangulación de perspectivas:'),
          bullet('Bitácora del supervisor y ATPs (registros cualitativos de cada visita)'),
          bullet('Listas de cotejo para revisión de documentos PAEC-PEC y planeaciones didácticas'),
          bullet('Cuestionarios de percepción a directivos y docentes (inicio y fin de ciclo)'),
          bullet('Guía de observación de clase (al menos 1 visita/plantel/ciclo)'),
          bullet('Actas y productos de los CAPEMS'),
          bullet('Informes de visita administrativa (4 por ciclo escolar)'),
          bullet('Datos estadísticos de matrícula y aprovechamiento (Forma 911)'),

          br(),

          // ── 8. EVALUACIÓN DEL PLAN ────────────────────────────────
          h1('8. EVALUACIÓN DEL PLAN'),
          ...(evaluacion.length > 0
            ? [
                simpleTable(
                  ['Indicador de éxito', 'Meta cuantitativa', 'Instrumento'],
                  evaluacion.map(e => [e.indicador, e.meta, e.instrumento]),
                  [3500, 2500, 3500],
                ),
              ]
            : [
                simpleTable(
                  ['Objetivo', 'Indicador', 'Meta', 'Instrumento'],
                  [
                    ['Calidad PAEC-PEC', '% de documentos sin errores de alineación curricular', '≥ 90%', 'Lista de cotejo PAEC'],
                    ['Acompañamiento', 'Visitas realizadas vs. planeadas por plantel', '≥ 2/plantel/ciclo', 'Bitácora + informes'],
                    ['Deserción', 'Variación % matrícula inicio vs. fin de ciclo', 'Reducción ≥ 5%', 'Forma 911'],
                    ['Planeación docente', '% docentes con planeación validada', '≥ 90%', 'Lista de cotejo'],
                  ],
                  [2500, 3000, 1500, 2500],
                ),
              ]),

          br(),

          // ── 9. REFERENCIAS ────────────────────────────────────────
          h1('9. REFERENCIAS'),
          new Paragraph({ spacing: { before: 100, after: 40 }, indent: { left: 720, hanging: 720 }, children: [normal('Secretaría de Educación Pública. (2022). Marco Curricular Común de la Educación Media Superior. SEP.')] }),
          new Paragraph({ spacing: { before: 40, after: 40 }, indent: { left: 720, hanging: 720 }, children: [normal('Secretaría de Educación Pública. (2025). Programa Aula, Escuela y Comunidad (PAEC) — 2.ª Edición. SEP-SEMS.')] }),
          new Paragraph({ spacing: { before: 40, after: 40 }, indent: { left: 720, hanging: 720 }, children: [normal('Dirección de Bachilleratos Estatales y Preparatoria Abierta. (2025). Guía para la elaboración del PIPS ciclo 2025-2026. SEP Puebla.')] }),
          new Paragraph({ spacing: { before: 40, after: 40 }, indent: { left: 720, hanging: 720 }, children: [normal('INEGI. (2020). Censo de Población y Vivienda 2020. https://www.inegi.org.mx')] }),

          // ── FIRMAS ────────────────────────────────────────────────
          new Paragraph({ spacing: { before: 300 } }),
          h1('10. VALIDACIÓN Y FIRMAS'),
          new Paragraph({ spacing: { before: 200 } }),
          simpleTable(
            ['Elaboró', 'Revisó', 'Autorizó'],
            [[
              `\n\n\n\n_________________________\n${p_.atps ?? 'A.T.P.'}\nZona Escolar`,
              `\n\n\n\n_________________________\n${p_.supervisor_name ?? 'Supervisor'}\nSupervisor Zona`,
              '\n\n\n\n_________________________\nDirección de Bachilleratos\nEstatales y Preparatoria Abierta',
            ]],
            [3000, 3200, 3300],
          ),
        ],
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
