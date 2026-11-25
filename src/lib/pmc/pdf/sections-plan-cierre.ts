/* eslint-disable @typescript-eslint/no-explicit-any */
import autoTable, { type RowInput } from 'jspdf-autotable';
import {
  AREAS_OBLIGATORIAS_51,
  resolveAreaObligatoria51,
  PENDIENTE_DEFINICION_51,
} from '@/lib/pmc/docx/sections-diagnostico';
import type { PmcStaffMember, PmcMetaInstitucional } from '@/types/pmc';
import {
  PMC_TITULOS_SECCIONES,
  PMC_FICHAS_TECNICAS_HEADING,
  PMC_FICHAS_TECNICAS_PAGE_BREAK_BEFORE,
  normalizePmcPeriodo,
  getPmcCategoryTheme,
  PMC_CUADRO_2_CATEGORIAS,
  consolidateMetasPersonalesByTeacher,
} from '@/lib/pmc-document-structure';
import { cleanPmcPlaceholders } from '@/lib/pmc/plan-element-normalizer';
import { isValidStaffName, isCollectiveOrNonHumanEntity } from '@/lib/pmc/staff-reconciler';
import { enrichMetaWithCatalogBase } from '@/lib/constants/pmc-catalogo-criterios';
import {
  NAVY,
  BLUE_MID,
  GRAY_BG,
  TEXT_DARK,
  TEXT_MUTED,
  safeStr,
  parseJson,
  drawJustifiedParagraph,
  type PmcPdfRenderState,
} from './helpers';

export function renderPmcPdfPlanYCierre(state: PmcPdfRenderState): void {
  const {
    doc,
    project,
    pageWidth,
    pageHeight,
    margin,
    contentWidth,
    diag,
    sectionPageMap,
    pageCellCoords,
    drawHeaderOnNewPage,
    addSectionHeader,
  } = state;
  let { curY } = state;

  // ── SECCIÓN 5: PRIORIZACIÓN DE CATEGORÍAS ───────────────────────────────────
  const categorias = parseJson(project.categorias_priorizadas);
  curY = addSectionHeader(PMC_TITULOS_SECCIONES.PRIORIZACION, curY);

  if (diag.priorizacion) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...TEXT_DARK);
    curY = drawJustifiedParagraph(doc, String(diag.priorizacion), margin, curY, contentWidth, 3.5, 6);
  }

  const catList = Array.isArray(categorias) && categorias.length > 0
    ? categorias
    : [
        { id: 'categoria_1', nombre: PMC_CUADRO_2_CATEGORIAS.categoria_1.nombreOficial, temas: ['Indicadores académicos (reprobación, eficiencia terminal y abandono escolar)', 'Formación y actualización docente'] },
        { id: 'categoria_2', nombre: PMC_CUADRO_2_CATEGORIAS.categoria_2.nombreOficial, temas: ['Seguimiento al desempeño docente en el aula', 'Vinculación con instituciones educativas, empresas o fundaciones'] },
        { id: 'categoria_3', nombre: PMC_CUADRO_2_CATEGORIAS.categoria_3.nombreOficial, temas: ['Estrategias y proyectos para la erradicación de la violencia y cultura de paz', 'Promoción de hábitos de vida saludable'] },
      ];

  const catRows = catList.map((c: { id?: string; nombre?: string; temas?: string[] }, i: number) => {
    const theme = getPmcCategoryTheme(c.nombre || c.id, (c.temas || []).join(' '));
    const temasText = Array.isArray(c.temas) && c.temas.length > 0
      ? c.temas.map((t) => `• ${t}`).join('\n')
      : 'Todos los ámbitos prioritarios aplicables';
    return [
      { content: `${i + 1}`, styles: { halign: 'center' as const, fontStyle: 'bold' as const, fillColor: theme.rgbBgEco, textColor: theme.rgbHeader } },
      { content: safeStr(c.nombre || `${theme.categoriaTitulo}: ${theme.nombreOficial}`), styles: { fontStyle: 'bold' as const, fillColor: theme.rgbBgEco, textColor: theme.rgbHeader } },
      { content: temasText, styles: { fillColor: [255, 255, 255] as [number, number, number] } },
    ];
  });

  autoTable(doc, {
    startY: curY,
    head: [[
      { content: 'N°', styles: { fillColor: NAVY, textColor: [255, 255, 255], halign: 'center' } },
      { content: 'Categoría Priorizada (Política CREAA - Cuadro 2)', styles: { fillColor: NAVY, textColor: [255, 255, 255] } },
      { content: 'Temas y Ámbitos de Intervención Seleccionados', styles: { fillColor: NAVY, textColor: [255, 255, 255] } },
    ]],
    body: catRows,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 2.2, textColor: TEXT_DARK, lineColor: [210, 220, 235] },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 65 },
      2: { cellWidth: contentWidth - 75 },
    },
    margin: { left: margin, right: margin },
  });
  curY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 8 : curY + 30;

  // ── SECCIÓN 6: PLAN DE ACCIÓN ───────────────────────────────────────────────
  curY = addSectionHeader(PMC_TITULOS_SECCIONES.PLAN_ACCION, curY);

  const planAccion = parseJson(project.plan_accion);
  const metasRaw: PmcMetaInstitucional[] = Array.isArray(planAccion.metas_institucionales) ? planAccion.metas_institucionales : [];
  // Enriquecer con catálogo canónico para eliminar fallbacks genéricos
  const metasInst: PmcMetaInstitucional[] = metasRaw.map((m) => enrichMetaWithCatalogBase(m, project));

  if (metasInst.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(...TEXT_MUTED);
    doc.text('No se han registrado metas institucionales específicas en el proyecto.', margin, curY);
    curY += 8;
  } else {
    const metaRows = metasInst.map((m) => {
      const subcat = m.tema || (Array.isArray(m.subcategorias_vinculadas) && m.subcategorias_vinculadas.length > 0
        ? m.subcategorias_vinculadas.join(', ')
        : 'General');
      const accion = m.accion_especifica || m.estrategia || 'Acción institucional';
      const estrategiaSeg = m.estrategias_seguimiento || 'Cortes en CTE';
      const fInicio = m.periodo_inicio || '08/2026';
      const fTermino = m.periodo_fin || '06/2027';
      const obs = m.observaciones || 'Sin observaciones adicionales';

      return [
        safeStr(m.nombre_categoria || m.categoria, 'Ámbito General'),
        safeStr(subcat),
        safeStr(m.meta, 'Meta institucional'),
        safeStr(accion),
        safeStr(m.personal_designado, 'Colectivo Escolar'),
        safeStr(m.entregable, 'Reporte'),
        safeStr(estrategiaSeg),
        safeStr(fInicio),
        safeStr(fTermino),
        safeStr(obs),
      ];
    });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...BLUE_MID);
    doc.text('Matriz General de Metas Institucionales y Plan de Acción (Formato 4.1):', margin, curY);
    curY += 4;

    autoTable(doc, {
      startY: curY,
      head: [[
        { content: 'Categoría', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
        { content: 'Subcategoría', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
        { content: 'Metas', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
        { content: 'Acciones Específicas a Realizar', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
        { content: 'Responsables', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
        { content: 'Productos', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
        { content: 'Estrategias de Seguimiento', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
        { content: 'Fecha Inicio', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
        { content: 'Fecha Término', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
        { content: 'Observaciones', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
      ]],
      body: metaRows,
      theme: 'grid',
      styles: { fontSize: 5.5, cellPadding: 1.2, textColor: TEXT_DARK, lineColor: [210, 220, 235] },
      columnStyles: {
        0: { cellWidth: 18 },
        1: { cellWidth: 16 },
        2: { cellWidth: 28 },
        3: { cellWidth: 26 },
        4: { cellWidth: 20 },
        5: { cellWidth: 18 },
        6: { cellWidth: 18 },
        7: { cellWidth: 12 },
        8: { cellWidth: 12 },
        9: { cellWidth: 18 },
      },
      margin: { left: margin, right: margin },
    });

    curY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 8 : curY + 40;

    // H-198 / H-204: Tablas Obligatorias del Plan de Acción (Formato 5.1 PMC 2025-2026)
    if (curY > pageHeight - 50) {
      doc.addPage();
      curY = 18;
      drawHeaderOnNewPage();
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...BLUE_MID);
    doc.text('Tablas Obligatorias del Plan de Acción (Formato 5.1 PMC 2025-2026):', margin, curY);
    curY += 4;

    const coveredMetaIndicesPdf = new Set<number>();

    for (let aIdx = 0; aIdx < AREAS_OBLIGATORIAS_51.length; aIdx++) {
      const area = AREAS_OBLIGATORIAS_51[aIdx];
      const {
        metaEstablecida,
        estrategiaImp,
        personalDes,
        productoComp,
        subcatVinc,
        situacionActual,
        matchingMeta,
      } = resolveAreaObligatoria51(area, metasInst, coveredMetaIndicesPdf);

      if (matchingMeta) {
        const foundIdx = metasInst.indexOf(matchingMeta as (typeof metasInst)[number]);
        if (foundIdx !== -1) coveredMetaIndicesPdf.add(foundIdx);
      }

      const areaTheme = getPmcCategoryTheme(area.id, area.titulo);

      if (curY > pageHeight - 55) {
        doc.addPage();
        curY = 18;
        drawHeaderOnNewPage();
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...areaTheme.rgbHeader);
      doc.text(`${area.titulo} (${areaTheme.categoriaTitulo})`, margin, curY);
      curY += 3.5;

      autoTable(doc, {
        startY: curY,
        head: [[
          { content: 'Apartado Formato 5.1', styles: { fillColor: areaTheme.rgbHeader, textColor: [255, 255, 255] } },
          { content: `Contenido Oficial Institucional — ${areaTheme.nombreOficial}`, styles: { fillColor: areaTheme.rgbHeader, textColor: [255, 255, 255] } },
        ]],
        body: [
          [{ content: 'Meta establecida', styles: { fontStyle: 'bold', fillColor: areaTheme.rgbBgEco, textColor: areaTheme.rgbHeader } }, metaEstablecida],
          [{ content: 'Estrategia de implementación para cumplir la meta', styles: { fontStyle: 'bold', fillColor: areaTheme.rgbBgEco, textColor: areaTheme.rgbHeader } }, estrategiaImp],
          [{ content: 'Personal designado para la instrumentación y el seguimiento de la meta', styles: { fontStyle: 'bold', fillColor: areaTheme.rgbBgEco, textColor: areaTheme.rgbHeader } }, personalDes],
          [{ content: 'Producto que comprobará el cumplimiento de la meta', styles: { fontStyle: 'bold', fillColor: areaTheme.rgbBgEco, textColor: areaTheme.rgbHeader } }, productoComp],
          [{ content: 'Subcategorías que vincularán  para cumplir la meta establecida', styles: { fontStyle: 'bold', fillColor: areaTheme.rgbBgEco, textColor: areaTheme.rgbHeader } }, subcatVinc],
          [{ content: 'Situación actual en el plantel que justifica el establecimiento de la meta', styles: { fontStyle: 'bold', fillColor: areaTheme.rgbBgEco, textColor: areaTheme.rgbHeader } }, situacionActual],
        ],
        theme: 'grid',
        styles: { fontSize: 6.8, cellPadding: 2, textColor: TEXT_DARK, lineColor: [210, 220, 235] },
        columnStyles: {
          0: { cellWidth: 50 },
        },
        margin: { left: margin, right: margin },
      });

      curY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 6 : curY + 45;
    }

    // Tablas para categorías y temas adicionales seleccionados por el plantel en PDF
    const additionalMetasPdf = metasInst.filter((_, idx) => !coveredMetaIndicesPdf.has(idx));
    if (additionalMetasPdf.length > 0) {
      if (curY > pageHeight - 50) {
        doc.addPage();
        curY = 18;
        drawHeaderOnNewPage();
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...BLUE_MID);
      doc.text('Tablas de Categorías y Temas Adicionales Seleccionados por el Plantel:', margin, curY);
      curY += 4;

      for (let mIdx = 0; mIdx < additionalMetasPdf.length; mIdx++) {
        const extraMetaRaw = additionalMetasPdf[mIdx];
        const extraMeta: any = enrichMetaWithCatalogBase(extraMetaRaw, project);
        const extraTheme = getPmcCategoryTheme(extraMeta.nombre_categoria || extraMeta.categoria, extraMeta.tema);
        const tituloExtra = extraMeta.nombre_categoria
          ? `${extraMeta.nombre_categoria}${extraMeta.tema ? ` — ${extraMeta.tema}` : ''}`
          : (extraMeta.tema || `Categoría Adicional ${mIdx + 1}`);

        const situacionPartsExtra = [extraMeta.necesidad, extraMeta.diagnostico_meta].filter(Boolean);
        const situacionActualExtra = situacionPartsExtra.length > 0
          ? situacionPartsExtra.join(' — ')
          : (extraMeta.linea_base ? safeStr(extraMeta.linea_base) : PENDIENTE_DEFINICION_51);

        const subcatExtra = (Array.isArray(extraMeta.subcategorias_vinculadas) && extraMeta.subcategorias_vinculadas.length > 0)
          ? extraMeta.subcategorias_vinculadas.join(', ')
          : (extraMeta.tema || extraMeta.nombre_categoria || PENDIENTE_DEFINICION_51);

        if (curY > pageHeight - 55) {
          doc.addPage();
          curY = 18;
          drawHeaderOnNewPage();
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(...extraTheme.rgbHeader);
        doc.text(`${tituloExtra} (${extraTheme.categoriaTitulo})`, margin, curY);
        curY += 3.5;

        autoTable(doc, {
          startY: curY,
          head: [[
            { content: 'Apartado Formato 5.1', styles: { fillColor: extraTheme.rgbHeader, textColor: [255, 255, 255] } },
            { content: `Contenido Oficial Institucional — ${extraTheme.nombreOficial}`, styles: { fillColor: extraTheme.rgbHeader, textColor: [255, 255, 255] } },
          ]],
          body: [
            [{ content: 'Meta establecida', styles: { fontStyle: 'bold', fillColor: extraTheme.rgbBgEco, textColor: extraTheme.rgbHeader } }, safeStr(cleanPmcPlaceholders(extraMeta.meta), PENDIENTE_DEFINICION_51)],
            [{ content: 'Estrategia de implementación para cumplir la meta', styles: { fontStyle: 'bold', fillColor: extraTheme.rgbBgEco, textColor: extraTheme.rgbHeader } }, safeStr(cleanPmcPlaceholders(extraMeta.estrategia), PENDIENTE_DEFINICION_51)],
            [{ content: 'Personal designado para la instrumentación y el seguimiento de la meta', styles: { fontStyle: 'bold', fillColor: extraTheme.rgbBgEco, textColor: extraTheme.rgbHeader } }, safeStr(extraMeta.personal_designado, PENDIENTE_DEFINICION_51)],
            [{ content: 'Producto que comprobará el cumplimiento de la meta', styles: { fontStyle: 'bold', fillColor: extraTheme.rgbBgEco, textColor: extraTheme.rgbHeader } }, safeStr(cleanPmcPlaceholders(extraMeta.entregable), PENDIENTE_DEFINICION_51)],
            [{ content: 'Subcategorías que vincularán  para cumplir la meta establecida', styles: { fontStyle: 'bold', fillColor: extraTheme.rgbBgEco, textColor: extraTheme.rgbHeader } }, subcatExtra],
            [{ content: 'Situación actual en el plantel que justifica el establecimiento de la meta', styles: { fontStyle: 'bold', fillColor: extraTheme.rgbBgEco, textColor: extraTheme.rgbHeader } }, situacionActualExtra],
          ],
          theme: 'grid',
          styles: { fontSize: 6.8, cellPadding: 2, textColor: TEXT_DARK, lineColor: [210, 220, 235] },
          columnStyles: {
            0: { cellWidth: 50 },
          },
          margin: { left: margin, right: margin },
        });

        curY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 6 : curY + 45;
      }
    }

    // Fichas Técnicas por Meta Institucional (Paridad Oficial con DOCX)
    if (metasInst.length > 0) {
      if ((PMC_FICHAS_TECNICAS_PAGE_BREAK_BEFORE || curY > pageHeight - 45) && curY > 20) {
        doc.addPage();
        curY = 18;
        drawHeaderOnNewPage();
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...BLUE_MID);
      doc.text(PMC_FICHAS_TECNICAS_HEADING, margin, curY);
      curY += 4;

      for (let i = 0; i < metasInst.length; i++) {
        const m = metasInst[i];
        const fichaTheme = getPmcCategoryTheme(m.nombre_categoria || m.categoria, m.tema);
        if (curY > pageHeight - 65) {
          doc.addPage();
          curY = 18;
          drawHeaderOnNewPage();
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(...fichaTheme.rgbHeader);
        doc.text(`Ficha Técnica ${i + 1}: ${safeStr(m.nombre_categoria || m.categoria, 'Ámbito Institucional')} (${fichaTheme.categoriaTitulo})`, margin, curY);
        curY += 3.5;

        const situacionPartsFicha = [m.necesidad, m.diagnostico_meta].filter(Boolean);
        const situacionFicha = situacionPartsFicha.length > 0
          ? situacionPartsFicha.join(' — ')
          : safeStr(m.linea_base, 'Situación académica diagnosticada en el plantel.');

        const subcatVal = (Array.isArray(m.subcategorias_vinculadas) && m.subcategorias_vinculadas.length > 0)
          ? m.subcategorias_vinculadas.join(', ')
          : safeStr(m.tema || m.nombre_categoria, 'Ámbito General');

        const fichaBody: RowInput[] = [
          [{ content: 'Campo Descriptivo', styles: { fontStyle: 'bold', fillColor: fichaTheme.rgbHeader, textColor: [255, 255, 255] } }, { content: 'Especificación de la Meta Institucional', styles: { fontStyle: 'bold', fillColor: fichaTheme.rgbHeader, textColor: [255, 255, 255] } }],
          [{ content: 'Tema Específico:', styles: { fontStyle: 'bold', fillColor: fichaTheme.rgbBgEco, textColor: fichaTheme.rgbHeader } }, safeStr(m.tema)],
          [{ content: 'Meta establecida:', styles: { fontStyle: 'bold', fillColor: fichaTheme.rgbBgEco, textColor: fichaTheme.rgbHeader } }, safeStr(cleanPmcPlaceholders(m.meta))],
          [{ content: 'Estrategia de implementación para cumplir la meta:', styles: { fontStyle: 'bold', fillColor: fichaTheme.rgbBgEco, textColor: fichaTheme.rgbHeader } }, safeStr(cleanPmcPlaceholders(m.estrategia))],
          [{ content: 'Línea Base Documentada:', styles: { fontStyle: 'bold', fillColor: fichaTheme.rgbBgEco, textColor: fichaTheme.rgbHeader } }, safeStr(cleanPmcPlaceholders(m.linea_base), 'Situación inicial documentada')],
          [{ content: 'Personal designado para la instrumentación y el seguimiento de la meta:', styles: { fontStyle: 'bold', fillColor: fichaTheme.rgbBgEco, textColor: fichaTheme.rgbHeader } }, safeStr(m.personal_designado, 'Colectivo Escolar')],
          [{ content: 'Producto que comprobará el cumplimiento de la meta:', styles: { fontStyle: 'bold', fillColor: fichaTheme.rgbBgEco, textColor: fichaTheme.rgbHeader } }, safeStr(cleanPmcPlaceholders(m.entregable))],
          [{ content: 'Subcategorías que vincularán  para cumplir la meta establecida:', styles: { fontStyle: 'bold', fillColor: fichaTheme.rgbBgEco, textColor: fichaTheme.rgbHeader } }, subcatVal],
          [{ content: 'Situación actual en el plantel que justifica el establecimiento de la meta:', styles: { fontStyle: 'bold', fillColor: fichaTheme.rgbBgEco, textColor: fichaTheme.rgbHeader } }, situacionFicha],
          [
            { content: 'Período de Ejecución:', styles: { fontStyle: 'bold', fillColor: fichaTheme.rgbBgEco, textColor: fichaTheme.rgbHeader } },
            (m.periodo_inicio || m.periodo_fin)
              ? `${safeStr(m.periodo_inicio, 'N/D')} — ${safeStr(m.periodo_fin, 'N/D')}`
              : 'N/D'
          ],
        ];

        if (m.accion_especifica) {
          fichaBody.push([{ content: 'Acción Específica (Formato 3.1):', styles: { fontStyle: 'bold', fillColor: fichaTheme.rgbBgEco, textColor: fichaTheme.rgbHeader } }, safeStr(cleanPmcPlaceholders(m.accion_especifica))]);
        }
        if (m.finalidad) {
          fichaBody.push([{ content: 'Finalidad de la Meta (Formato 3.1):', styles: { fontStyle: 'bold', fillColor: fichaTheme.rgbBgEco, textColor: fichaTheme.rgbHeader } }, safeStr(cleanPmcPlaceholders(m.finalidad))]);
        }
        if (m.proceso_evaluacion) {
          fichaBody.push([{ content: 'Proceso de Evaluación (Formato 3.1):', styles: { fontStyle: 'bold', fillColor: fichaTheme.rgbBgEco, textColor: fichaTheme.rgbHeader } }, safeStr(cleanPmcPlaceholders(m.proceso_evaluacion))]);
        }
        if (m.estrategias_seguimiento) {
          fichaBody.push([{ content: 'Estrategias de Seguimiento (Formato 4.1):', styles: { fontStyle: 'bold', fillColor: fichaTheme.rgbBgEco, textColor: fichaTheme.rgbHeader } }, safeStr(cleanPmcPlaceholders(m.estrategias_seguimiento))]);
        }
        if (m.observaciones) {
          fichaBody.push([{ content: 'Observaciones Generales (Formato 4.1):', styles: { fontStyle: 'bold', fillColor: fichaTheme.rgbBgEco, textColor: fichaTheme.rgbHeader } }, safeStr(cleanPmcPlaceholders(m.observaciones))]);
        }

        autoTable(doc, {
          startY: curY,
          body: fichaBody,
          theme: 'grid',
          styles: { fontSize: 6.8, cellPadding: 2, textColor: TEXT_DARK, lineColor: [210, 220, 235] },
          columnStyles: {
            0: { cellWidth: 42 },
          },
          margin: { left: margin, right: margin },
        });

        curY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 6 : curY + 45;
      }
    }
  }

  // ── SECCIÓN 7: METAS INDIVIDUALES DEL PERSONAL ──────────────────────────────
  curY = addSectionHeader(PMC_TITULOS_SECCIONES.METAS_INDIVIDUALES, curY);

  const rawMetasPers: any[] = Array.isArray(planAccion.metas_personales) ? planAccion.metas_personales : [];
  const metasPers = consolidateMetasPersonalesByTeacher(rawMetasPers);

  if (metasPers.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(...TEXT_MUTED);
    doc.text('No se han registrado metas individuales de la plantilla en este reporte.', margin, curY);
    curY += 8;
  } else {
    const personalRows = metasPers.map((p, i) => {
      const periodoStr = normalizePmcPeriodo(p.periodo);
      const cleanMetaInd = cleanPmcPlaceholders(p.meta_individual);
      const metaStr = safeStr(
        (cleanMetaInd && (cleanMetaInd.startsWith('[') || cleanMetaInd.startsWith('•')))
          ? cleanMetaInd
          : (p.categoria ? `[${p.categoria}${p.tema ? ` — ${p.tema}` : ''}] ${cleanMetaInd || ''}` : cleanMetaInd),
        'Compromiso de mejora'
      );
      return [
        { content: `${i + 1}`, styles: { halign: 'center' as const, fontStyle: 'bold' as const, fillColor: GRAY_BG } },
        safeStr(p.nombre, 'Personal'),
        safeStr(p.cargo, 'Docente'),
        metaStr,
        safeStr(cleanPmcPlaceholders(p.estrategia), 'Seguimiento en aula'),
        safeStr(cleanPmcPlaceholders(p.entregable), 'Planeación y Portafolio'),
        { content: periodoStr, styles: { halign: 'center' as const } },
      ];
    });

    autoTable(doc, {
      startY: curY,
      head: [[
        { content: 'N°', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255], halign: 'center' } },
        { content: 'Nombre del Integrante', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
        { content: 'Cargo / Función', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
        { content: 'Meta y Compromiso Individual', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
        { content: 'Estrategia Individual', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
        { content: 'Entregable Comprobable', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
        { content: 'Período', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255], halign: 'center' } },
      ]],
      body: personalRows,
      theme: 'grid',
      styles: { fontSize: 6.5, cellPadding: 1.8, textColor: TEXT_DARK, lineColor: [210, 220, 235] },
      columnStyles: {
        0: { cellWidth: 7 },
        1: { cellWidth: 32 },
        2: { cellWidth: 24 },
        3: { cellWidth: 42 },
        4: { cellWidth: 32 },
        5: { cellWidth: 25 },
        6: { cellWidth: 20 },
      },
      margin: { left: margin, right: margin },
    });

    curY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 8 : curY + 40;
  }

  // ── SECCIÓN 8: PARTICIPANTES, CONTROL DE REVISIONES Y APROBACIÓN ────────────
  curY = addSectionHeader(PMC_TITULOS_SECCIONES.PARTICIPANTES_CONTROL, curY);

  // Mecanismos de Seguimiento y Monitoreo Trimestral (Paridad con DOCX y Rescate Cap. VI)
  if (metasInst.length > 0) {
    if (curY > pageHeight - 55) {
      doc.addPage();
      curY = 18;
      drawHeaderOnNewPage();
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...BLUE_MID);
    doc.text('Mecanismos de Seguimiento y Monitoreo Trimestral:', margin, curY);
    curY += 4;

    const segRows = metasInst.map((m) => [
      (m.periodo_inicio || m.periodo_fin)
        ? `${safeStr(m.periodo_inicio, 'Corte 1')} a ${safeStr(m.periodo_fin, 'Corte 2')}`
        : 'Período ordinario',
      safeStr(cleanPmcPlaceholders(m.meta), 'Meta institucional programada'),
      safeStr(m.personal_designado, 'Dirección / Colectivo Escolar'),
    ]);

    autoTable(doc, {
      startY: curY,
      head: [[
        { content: 'Período / Corte de Seguimiento', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
        { content: 'Meta Institucional Asociada', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
        { content: 'Responsable del Seguimiento', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
      ]],
      body: segRows,
      theme: 'grid',
      styles: { fontSize: 6.5, cellPadding: 2, textColor: TEXT_DARK, lineColor: [210, 220, 235] },
      columnStyles: {
        0: { cellWidth: 40 },
        1: { cellWidth: contentWidth - 90 },
        2: { cellWidth: 50 },
      },
      margin: { left: margin, right: margin },
    });
    curY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 8 : curY + 30;
  }

  // Tabla de Personal y Colectivo Escolar Participante (Paridad con DOCX)
  const staffDataRaw = parseJson<PmcStaffMember[]>(project.staff_data);
  const personalParticipante = Array.isArray(staffDataRaw) && staffDataRaw.length > 0
    ? staffDataRaw
        .filter((s) => isValidStaffName(s?.nombre) && !isCollectiveOrNonHumanEntity(s?.nombre))
        .map((s) => ({
          nombre: safeStr(s.nombre, 'Integrante del Colectivo Escolar'),
          cargo: safeStr(s.cargo, 'Docente'),
          horas_base: s.horas_base != null && String(s.horas_base).trim() !== ''
            ? `${s.horas_base} hrs`
            : '—',
        }))
    : (project.director_name ? [{
        nombre: project.director_name,
        cargo: 'Director(a)',
        horas_base: '—',
      }] : []);

  if (personalParticipante.length > 0) {
    if (curY > pageHeight - 55) {
      doc.addPage();
      curY = 18;
      drawHeaderOnNewPage();
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...BLUE_MID);
    doc.text('Personal y Colectivo Escolar Participante:', margin, curY);
    curY += 4;

    const partRows = personalParticipante.map((p, idx) => [
      { content: `${idx + 1}`, styles: { halign: 'center' as const, fontStyle: 'bold' as const, fillColor: GRAY_BG } },
      p.nombre,
      p.cargo,
      { content: p.horas_base, styles: { halign: 'center' as const } },
      '_____________________',
    ]);

    autoTable(doc, {
      startY: curY,
      head: [[
        { content: 'N°', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255], halign: 'center' } },
        { content: 'Nombre Completo del Personal', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
        { content: 'Cargo / Función en el CTE', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255] } },
        { content: 'Horas Base', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255], halign: 'center' } },
        { content: 'Firma de Conformidad', styles: { fillColor: BLUE_MID, textColor: [255, 255, 255], halign: 'center' } },
      ]],
      body: partRows,
      theme: 'grid',
      styles: { fontSize: 6.5, cellPadding: 2, textColor: TEXT_DARK, lineColor: [210, 220, 235] },
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 62 },
        2: { cellWidth: 45 },
        3: { cellWidth: 20, halign: 'center' },
        4: { cellWidth: contentWidth - 135, halign: 'center' },
      },
      margin: { left: margin, right: margin },
    });
    curY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 8 : curY + 35;
  }

  if (curY > pageHeight - 55) {
    doc.addPage();
    curY = 20;
    drawHeaderOnNewPage();
  }

  const dirName = safeStr(project.director_name, 'Director(a) del Plantel');
  const supName = safeStr(project.supervisor_name, 'Supervisor(a) de Zona');

  autoTable(doc, {
    startY: curY,
    head: [[
      {
        content: 'CONSTANCIA DE APROBACIÓN Y VALIDACIÓN DEL PLAN DE MEJORA CONTINUA',
        colSpan: 3,
        styles: { fillColor: NAVY, textColor: [255, 255, 255], halign: 'center', fontStyle: 'bold', fontSize: 8 },
      },
    ]],
    body: [
      [
        {
          content: `\n\n\n\n_____________________________________________\nELABORÓ\n\n${dirName.toUpperCase()}\nDIRECTOR(A) DEL PLANTEL\nFirma y Sello del Plantel`,
          styles: { halign: 'center', cellWidth: contentWidth / 3 },
        },
        {
          content: `\n\n\n\n_____________________________________________\nREVISÓ\n\nREPRESENTANTE DEL CTE\nCOLECTIVO DOCENTE DEL PLANTEL\nFirma y Rúbrica`,
          styles: { halign: 'center', cellWidth: contentWidth / 3 },
        },
        {
          content: `\n\n\n\n_____________________________________________\nVALIDÓ\n\n${supName.toUpperCase()}\nSUPERVISOR(A) DE ZONA ESCOLAR\nVo. Bo. y Sello de Zona`,
          styles: { halign: 'center', cellWidth: contentWidth / 3 },
        },
      ],
    ],
    theme: 'plain',
    styles: { fontSize: 7, cellPadding: 2, textColor: TEXT_DARK },
    margin: { left: margin, right: margin },
    pageBreak: 'avoid',
  });

  // ── SEGUNDA PASADA: RELLENAR FOLIOS EN LA TABLA DEL ÍNDICE (PÁGINA 2) ───────
  doc.setPage(2);
  for (const cell of pageCellCoords) {
    const pageNum = sectionPageMap.get(cell.key) ?? '—';
    doc.setFont('helvetica', cell.isSection ? 'bold' : 'normal');
    doc.setFontSize(7);
    if (cell.isSection) {
      doc.setTextColor(...NAVY);
    } else {
      doc.setTextColor(...TEXT_MUTED);
    }
    doc.text(String(pageNum), cell.x + cell.width / 2, cell.y + cell.height / 2 + 1, { align: 'center' });
  }

  // ── PIE DE PÁGINA FORMAL CON FOLIADO ────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    if (p > 1) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...TEXT_MUTED);
      doc.text(
        `Plan de Mejora Continua (PMC) — Página ${p} de ${totalPages}`,
        pageWidth / 2,
        pageHeight - 7,
        { align: 'center' }
      );
    }
  }


  state.curY = curY;
}
