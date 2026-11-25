import {
  Paragraph,
  TextRun,
  Table,
  TableRow,
  AlignmentType,
  WidthType,
  PageBreak,
} from 'docx';
import { getCatalogoMetasPmc } from '@/lib/catalogo-metas-pmc';
import type { MetaCatalogEntry } from '@/types/pmc';
import { cleanPmcPlaceholders } from '@/lib/pmc/plan-element-normalizer';
import {
  BRAND,
  CONTENT_W,
  bdr,
  cell,
  h1,
  h2,
  p,
  type PmcMaestroContext,
} from './helpers';

export function buildMaestroChapters1To4(ctx: PmcMaestroContext): (Paragraph | Table)[] {
  const {
    options,
    diag,
    metasInst,
    schoolName,
    cct,
    municipio,
    localidad,
    zona,
    ciclo,
    subsistema,
    director,
    supervisor,
  } = ctx;

  // 1. Portada e Identificación Institucional
  const portadaItems: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 600, after: 120 },
      children: [
        new TextRun({
          text: 'GOBIERNO DEL ESTADO DE PUEBLA',
          bold: true,
          size: 26,
          color: BRAND.dorado,
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 240 },
      children: [
        new TextRun({
          text: 'SECRETARÍA DE EDUCACIÓN PÚBLICA — SUBSECRETARÍA DE EDUCACIÓN MEDIA SUPERIOR',
          bold: true,
          size: 20,
          color: BRAND.textoMuted,
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 400, after: 160 },
      children: [
        new TextRun({
          text: 'PROGRAMA DE MEJORA CONTINUA (PMC)',
          bold: true,
          size: 38,
          color: BRAND.guinda,
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 480 },
      children: [
        new TextRun({
          text: `DOCUMENTO MAESTRO INSTITUCIONAL — CICLO ESCOLAR ${ciclo}`,
          bold: true,
          size: 24,
          color: BRAND.dorado,
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 100, after: 300 },
      children: [
        new TextRun({
          text: 'Conforme a los Lineamientos Oficiales DBEPA Formato 5.2 y la Ley General de Educación',
          italics: true,
          size: 20,
          color: BRAND.textoMuted,
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({ spacing: { before: 200, after: 200 } }),
  ];

  // Tabla de Identificación del Plantel en Portada
  const tablaIdentificacion = new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    borders: bdr(BRAND.dorado),
    rows: [
      new TableRow({
        children: [
          cell('FICHA DE IDENTIFICACIÓN INSTITUCIONAL', {
            w: CONTENT_W,
            span: 2,
            bold: true,
            fill: BRAND.guinda,
            color: BRAND.blanco,
            size: 22,
            align: AlignmentType.CENTER,
          }),
        ],
      }),
      new TableRow({
        children: [
          cell('Nombre de la Escuela / Plantel:', { w: 3200, bold: true, fill: BRAND.doradoClaro }),
          cell(schoolName, { w: CONTENT_W - 3200, bold: true }),
        ],
      }),
      new TableRow({
        children: [
          cell('Clave de Centro de Trabajo (CCT):', { w: 3200, bold: true, fill: BRAND.doradoClaro }),
          cell(cct, { w: CONTENT_W - 3200 }),
        ],
      }),
      new TableRow({
        children: [
          cell('Subsistema Educativo:', { w: 3200, bold: true, fill: BRAND.doradoClaro }),
          cell(subsistema, { w: CONTENT_W - 3200 }),
        ],
      }),
      new TableRow({
        children: [
          cell('Zona Escolar de Adscripción:', { w: 3200, bold: true, fill: BRAND.doradoClaro }),
          cell(zona, { w: CONTENT_W - 3200 }),
        ],
      }),
      new TableRow({
        children: [
          cell('Municipio y Localidad:', { w: 3200, bold: true, fill: BRAND.doradoClaro }),
          cell(
            localidad !== 'No capturado' && municipio !== 'No capturado'
              ? `${localidad}, ${municipio}, Puebla`
              : municipio !== 'No capturado'
              ? `${municipio}, Puebla`
              : 'No capturado',
            { w: CONTENT_W - 3200 }
          ),
        ],
      }),
      new TableRow({
        children: [
          cell('Titular de la Dirección:', { w: 3200, bold: true, fill: BRAND.doradoClaro }),
          cell(director, { w: CONTENT_W - 3200 }),
        ],
      }),
      new TableRow({
        children: [
          cell('Titular de la Supervisión:', { w: 3200, bold: true, fill: BRAND.doradoClaro }),
          cell(supervisor, { w: CONTENT_W - 3200 }),
        ],
      }),
    ],
  });

  // Capítulo 1 Título formal
  const ubicacionTexto =
    localidad !== 'No capturado' && municipio !== 'No capturado'
      ? `ubicada en ${localidad}, Municipio de ${municipio}, Puebla`
      : municipio !== 'No capturado'
      ? `ubicada en el Municipio de ${municipio}, Puebla`
      : 'con ubicación territorial en proceso de registro';

  const zonaTexto = zona !== 'No capturado' ? `perteneciente a la ${zona}` : 'con zona escolar en asignación';
  const subsistemaTexto = subsistema !== 'No capturado' ? `del subsistema ${subsistema}` : 'del subsistema de Educación Media Superior';

  const cap1 = [
    h1('Capítulo I. Identificación Institucional'),
    p(
      `El presente Programa de Mejora Continua (PMC) ha sido formulado por la comunidad académica y directiva de ${schoolName} (CCT: ${cct}), ${ubicacionTexto}, ${zonaTexto} ${subsistemaTexto}, como instrumento rector de planeación participativa para el ciclo escolar ${ciclo}.`
    ),
    p(
      'Este documento orienta los esfuerzos colectivos hacia la excelencia formativa, el abatimiento del rezago y abandono escolar, el fortalecimiento de la práctica pedagógica docente y la vinculación proactiva con la comunidad circundante.'
    ),
    new Paragraph({ children: [new PageBreak()] }),
  ];

  // Capítulo 2 — Marco Normativo y Catálogo de Metas
  let metasRows = options.catalogoMetas || [];
  if (metasRows.length === 0) {
    const canonic = getCatalogoMetasPmc();
    metasRows = canonic.map((m: MetaCatalogEntry) => ({
      id: m.id,
      nombre: m.nombre,
      categoria: m.categoria,
      subcategoria: m.subcategoria,
      articulos: m.articulos,
      aplicabilidad_nivel: m.aplicabilidad_pmc.nivel,
      aplicabilidad_justificacion: m.aplicabilidad_pmc.justificacion,
      evidencia: m.evidencia,
      orden_display: m.orden_display,
    }));
  }

  const tablaMetasRows = [
    new TableRow({
      children: [
        cell('No.', { w: 600, bold: true, fill: BRAND.guinda, color: BRAND.blanco, align: AlignmentType.CENTER }),
        cell('Subcategoría 5.2 Oficial', { w: 2600, bold: true, fill: BRAND.guinda, color: BRAND.blanco }),
        cell('Meta Institucional Canónica', { w: 3880, bold: true, fill: BRAND.guinda, color: BRAND.blanco }),
        cell('Nivel / Normativa Aplicable', { w: 3000, bold: true, fill: BRAND.guinda, color: BRAND.blanco }),
      ],
    }),
  ];

  metasRows.forEach((m, idx) => {
    const bg = idx % 2 === 0 ? BRAND.blanco : BRAND.grisFondo;
    tablaMetasRows.push(
      new TableRow({
        children: [
          cell(String(idx + 1), { w: 600, fill: bg, align: AlignmentType.CENTER }),
          cell(m.subcategoria, { w: 2600, fill: bg, bold: true, size: 18 }),
          cell(m.nombre, { w: 3880, fill: bg, size: 18 }),
          cell(`${m.aplicabilidad_nivel.toUpperCase()}\n${(m.articulos || []).join(', ')}`, { w: 3000, fill: bg, size: 16 }),
        ],
      })
    );
  });

  const cap2 = [
    h1('Capítulo II. Marco Normativo y Catálogo de Metas Institucionales'),
    p(
      'El sustento jurídico del PMC emana del Artículo 3° de la Constitución Política de los Estados Unidos Mexicanos, la Ley General de Educación (2019), la Ley General del Sistema para la Carrera de las Maestras y los Maestros (LGSCMM), el Marco Curricular Común de la Educación Media Superior (Acuerdo 09/08/23) y los Lineamientos para la Planeación de la Mejora Continua 2025-2026 de la Dirección de Bachilleratos Estatales y Preparatoria Abierta (DBEPA) de Puebla.'
    ),
    new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      borders: bdr(),
      rows: tablaMetasRows,
    }),
    p(
      'Fuente: Catálogo Oficial de Metas Institucionales — Dirección de Bachilleratos Estatales y Preparatoria Abierta (DBEPA) Puebla.',
      { italics: true, size: 18, color: BRAND.textoMuted }
    ),
    new Paragraph({ children: [new PageBreak()] }),
  ];

  // Capítulo 3 — Diagnóstico Integral del Plantel
  const cap3 = [
    h1('Capítulo III. Diagnóstico Integral del Plantel'),
    h2('3.1 Presentación y Justificación Diagnóstica'),
    p(diag.presentacion || 'Contenido pendiente de captura en el wizard.'),
    h2('3.2 Contexto Escolar, Sociocultural y Comunitario'),
    p(diag.contexto || 'Contenido pendiente de captura en el wizard.'),
    h2('3.3 Análisis de Indicadores Académicos y Eficiencia Educativa'),
    p(diag.analisis_indicadores || 'Contenido pendiente de captura en el wizard.'),
    h2('3.4 Síntesis del Análisis FODA Institucional'),
    p(diag.sintesis_foda || 'Contenido pendiente de captura en el wizard.'),
    h2('3.5 Priorización de Problemáticas y Ámbitos de Mejora'),
    p(diag.priorizacion || 'Contenido pendiente de captura en el wizard.'),
    new Paragraph({ children: [new PageBreak()] }),
  ];

  // Capítulo 4 — Objetivos Generales y Estrategias del PMC
  const cap4Items: Paragraph[] = [
    h1('Capítulo IV. Objetivos Generales y Estrategias del PMC'),
    p(
      `Con base en el diagnóstico situacional y las ${metasInst.length} metas institucionales registradas, se articulan las siguientes líneas de acción estratégica y objetivos institucionales:`
    ),
  ];

  if (metasInst.length === 0) {
    cap4Items.push(p('Contenido pendiente de captura en el wizard.'));
  } else {
    metasInst.forEach((m, i) => {
      cap4Items.push(h2(`4.${i + 1} ${m.tema || 'Ámbito de Mejora Institucional'}`));
      if (m.diagnostico_meta) {
        cap4Items.push(p(`Diagnóstico situacional: ${cleanPmcPlaceholders(m.diagnostico_meta)}`, { italics: true }));
      }
      cap4Items.push(p(`Objetivo / Meta: ${cleanPmcPlaceholders(m.meta) || 'Meta no especificada.'}`, { bold: true }));
      if (m.estrategia) {
        cap4Items.push(p(`Estrategia pedagógica/operativa: ${cleanPmcPlaceholders(m.estrategia)}`));
      }
      if (m.linea_base) {
        cap4Items.push(p(`Línea base de partida: ${cleanPmcPlaceholders(m.linea_base)}`, { color: BRAND.textoMuted, size: 20 }));
      }
    });
  }
  cap4Items.push(new Paragraph({ children: [new PageBreak()] }));


  return [
    ...portadaItems,
    tablaIdentificacion,
    new Paragraph({ children: [new PageBreak()] }),
    ...cap1,
    ...cap2,
    ...cap3,
    ...cap4Items,
  ];
}
