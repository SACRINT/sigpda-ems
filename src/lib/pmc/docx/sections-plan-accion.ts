import {
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  WidthType,
  PageBreak,
} from 'docx';
import type { PmcMetaInstitucional } from '@/types/pmc';
import {
  PMC_TITULOS_SECCIONES,
  PMC_FICHAS_TECNICAS_HEADING,
  shouldSectionPageBreak,
  normalizePmcPeriodo,
  getPmcCategoryTheme,
  consolidateMetasPersonalesByTeacher,
} from '@/lib/pmc-document-structure';
import { cleanPmcPlaceholders } from '@/lib/pmc/plan-element-normalizer';
import { isValidStaffName, isCollectiveOrNonHumanEntity } from '@/lib/pmc/staff-reconciler';
import { enrichMetaWithCatalogBase } from '@/lib/constants/pmc-catalogo-criterios';
import {
  C,
  CONTENT,
  bdr,
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
  type MetaInstitucional,
} from './helpers';
import {
  AREAS_OBLIGATORIAS_51,
  PENDIENTE_DEFINICION_51,
  resolveAreaObligatoria51,
} from './sections-diagnostico';

// ─── 6. Plan de Acción ───────────────────────────────────────────────────────
export function buildPlanAccion(plan: PlanAccion, project?: PmcProject): (Paragraph | Table)[] {
  const items: (Paragraph | Table)[] = [secHeading(PMC_TITULOS_SECCIONES.PLAN_ACCION)];

  // Enriquecer cada meta con el catálogo canónico antes de renderizar
  const metas = (plan.metas_institucionales ?? []).map(m =>
    enrichMetaWithCatalogBase(m as PmcMetaInstitucional, project) as MetaInstitucional
  );

  if (metas.length === 0) {
    items.push(bodyPara('No se han registrado metas institucionales específicas en el plan de acción.'));
  } else {
    // Matriz General del Plan de Acción (Formato 4.1 Estrategia de Implementación)
    items.push(subHeading('Matriz General de Metas Institucionales y Plan de Acción (Formato 4.1 Estrategia de Implementación):'));
    items.push(
      tbl(
        [
          new TableRow({
            children: [
              tcH('Categoría', { w: 1200 }),
              tcH('Subcategoría', { w: 1000 }),
              tcH('Metas', { w: 1600 }),
              tcH('Acciones Específicas a Realizar', { w: 1400 }),
              tcH('Responsables', { w: 1000 }),
              tcH('Productos', { w: 900 }),
              tcH('Estrategias de Seguimiento', { w: 900 }),
              tcH('Fecha de Inicio', { w: 600 }),
              tcH('Fecha de Término', { w: 600 }),
              tcH('Observaciones', { w: 700 }),
            ],
          }),
          ...metas.map((m, idx) => {
            const bg = idx % 2 === 0 ? C.white : C.alt;
            const subcat = m.tema || (Array.isArray(m.subcategorias_vinculadas) && m.subcategorias_vinculadas.length > 0
              ? m.subcategorias_vinculadas.join(', ')
              : 'General');
            const accion = m.accion_especifica || m.estrategia || 'Acción institucional';
            const estrategiaSeg = m.estrategias_seguimiento || 'Cortes en Consejo Técnico Escolar';
            const fInicio = m.periodo_inicio || 'Agosto 2026';
            const fTermino = m.periodo_fin || 'Junio 2027';
            const obs = m.observaciones || 'Sin observaciones adicionales';

            return new TableRow({
              children: [
                tc(safeStr(m.nombre_categoria || m.categoria, 'Ámbito General'), { w: 1200, bold: true, fill: bg }),
                tc(safeStr(subcat), { w: 1000, fill: bg }),
                tc(safeStr(m.meta, 'Meta en proceso'), { w: 1600, fill: bg }),
                tc(safeStr(accion), { w: 1400, fill: bg }),
                tc(safeStr(m.personal_designado, 'Colectivo Escolar'), { w: 1000, fill: bg }),
                tc(safeStr(m.entregable, 'Reporte de seguimiento'), { w: 900, fill: bg }),
                tc(safeStr(estrategiaSeg), { w: 900, fill: bg }),
                tc(safeStr(fInicio), { w: 600, align: AlignmentType.CENTER, fill: bg }),
                tc(safeStr(fTermino), { w: 600, align: AlignmentType.CENTER, fill: bg }),
                tc(safeStr(obs), { w: 700, fill: bg }),
              ],
            });
          }),
        ],
        [1200, 1000, 1600, 1400, 1000, 900, 900, 600, 600, 700]
      )
    );
    items.push(...gap(2));

    // H-198: Tablas Oficiales Obligatorias (Formato 5.1 PMC 2025-2026 con las 6 filas literales)
    items.push(subHeading('Tablas Obligatorias del Plan de Acción (Formato 5.1 PMC 2025-2026):'));
    items.push(bodyPara('Desarrollo estructurado de las cuatro áreas de observancia obligatoria conforme al formato oficial 5.1 emitido por la SEP/SEMS:'));

    const coveredMetaIndices = new Set<number>();

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
      } = resolveAreaObligatoria51(area, metas, coveredMetaIndices);

      if (matchingMeta) {
        const foundIdx = metas.indexOf(matchingMeta as MetaInstitucional);
        if (foundIdx !== -1) coveredMetaIndices.add(foundIdx);
      }

      const areaTheme = getPmcCategoryTheme(area.id, area.titulo);

      items.push(
        new Paragraph({
          spacing: { before: 180, after: 80 },
          children: [
            new TextRun({
              text: `${area.titulo} (${areaTheme.categoriaTitulo})`,
              bold: true,
              size: 21,
              color: areaTheme.colorHeaderHex,
              font: 'Arial',
            }),
          ],
        })
      );

      items.push(
        tbl(
          [
            new TableRow({
              children: [
                tcH('Apartado Formato 5.1', { w: CONTENT / 3, fill: areaTheme.colorHeaderHex, color: C.white }),
                tcH(`Contenido Oficial Institucional — ${areaTheme.nombreOficial}`, { w: (CONTENT * 2) / 3, fill: areaTheme.colorHeaderHex, color: C.white }),
              ],
            }),
            new TableRow({
              children: [tcSub('Meta establecida', { fill: areaTheme.colorBgEcoHex, color: areaTheme.colorTextAccentHex }), tc(metaEstablecida, { fill: C.alt })],
            }),
            new TableRow({
              children: [tcSub('Estrategia de implementación para cumplir la meta', { fill: areaTheme.colorBgEcoHex, color: areaTheme.colorTextAccentHex }), tc(estrategiaImp)],
            }),
            new TableRow({
              children: [tcSub('Personal designado para la instrumentación y el seguimiento de la meta', { fill: areaTheme.colorBgEcoHex, color: areaTheme.colorTextAccentHex }), tc(personalDes, { fill: C.alt })],
            }),
            new TableRow({
              children: [tcSub('Producto que comprobará el cumplimiento de la meta', { fill: areaTheme.colorBgEcoHex, color: areaTheme.colorTextAccentHex }), tc(productoComp)],
            }),
            new TableRow({
              children: [tcSub('Subcategorías que vincularán  para cumplir la meta establecida', { fill: areaTheme.colorBgEcoHex, color: areaTheme.colorTextAccentHex }), tc(subcatVinc, { fill: C.alt })],
            }),
            new TableRow({
              children: [tcSub('Situación actual en el plantel que justifica el establecimiento de la meta', { fill: areaTheme.colorBgEcoHex, color: areaTheme.colorTextAccentHex }), tc(situacionActual)],
            }),
          ],
          [CONTENT / 3, (CONTENT * 2) / 3]
        )
      );
      items.push(...gap(1));
    }

    // Tablas para categorías y temas adicionales seleccionados por el plantel
    const additionalMetas = metas.filter((_, idx) => !coveredMetaIndices.has(idx));
    if (additionalMetas.length > 0) {
      items.push(subHeading('Tablas de Categorías y Temas Adicionales Seleccionados por el Plantel:'));
      items.push(bodyPara('Desarrollo estructurado de metas correspondientes a temas y categorías adicionales seleccionados por la institución:'));

      for (let mIdx = 0; mIdx < additionalMetas.length; mIdx++) {
        const extraMeta = enrichMetaWithCatalogBase(additionalMetas[mIdx] as PmcMetaInstitucional, project) as MetaInstitucional;
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

        items.push(
          new Paragraph({
            spacing: { before: 180, after: 80 },
            children: [
              new TextRun({
                text: `${tituloExtra} (${extraTheme.categoriaTitulo})`,
                bold: true,
                size: 21,
                color: extraTheme.colorHeaderHex,
                font: 'Arial',
              }),
            ],
          })
        );

        items.push(
          tbl(
            [
              new TableRow({
                children: [
                  tcH('Apartado Formato 5.1', { w: CONTENT / 3, fill: extraTheme.colorHeaderHex, color: C.white }),
                  tcH(`Contenido Oficial Institucional — ${extraTheme.nombreOficial}`, { w: (CONTENT * 2) / 3, fill: extraTheme.colorHeaderHex, color: C.white }),
                ],
              }),
              new TableRow({
                children: [tcSub('Meta establecida', { fill: extraTheme.colorBgEcoHex, color: extraTheme.colorTextAccentHex }), tc(safeStr(extraMeta.meta, PENDIENTE_DEFINICION_51), { fill: C.alt })],
              }),
              new TableRow({
                children: [tcSub('Estrategia de implementación para cumplir la meta', { fill: extraTheme.colorBgEcoHex, color: extraTheme.colorTextAccentHex }), tc(safeStr(extraMeta.estrategia, PENDIENTE_DEFINICION_51))],
              }),
              new TableRow({
                children: [tcSub('Personal designado para la instrumentación y el seguimiento de la meta', { fill: extraTheme.colorBgEcoHex, color: extraTheme.colorTextAccentHex }), tc(safeStr(extraMeta.personal_designado, PENDIENTE_DEFINICION_51), { fill: C.alt })],
              }),
              new TableRow({
                children: [tcSub('Producto que comprobará el cumplimiento de la meta', { fill: extraTheme.colorBgEcoHex, color: extraTheme.colorTextAccentHex }), tc(safeStr(extraMeta.entregable, PENDIENTE_DEFINICION_51))],
              }),
              new TableRow({
                children: [tcSub('Subcategorías que vincularán  para cumplir la meta establecida', { fill: extraTheme.colorBgEcoHex, color: extraTheme.colorTextAccentHex }), tc(subcatExtra, { fill: C.alt })],
              }),
              new TableRow({
                children: [tcSub('Situación actual en el plantel que justifica el establecimiento de la meta', { fill: extraTheme.colorBgEcoHex, color: extraTheme.colorTextAccentHex }), tc(situacionActualExtra)],
              }),
            ],
            [CONTENT / 3, (CONTENT * 2) / 3]
          )
        );
        items.push(...gap(1));
      }
    }

    if (shouldSectionPageBreak(PMC_FICHAS_TECNICAS_HEADING)) {
      items.push(new Paragraph({ children: [new PageBreak()] }));
    }
    items.push(subHeading(PMC_FICHAS_TECNICAS_HEADING));
  }

  for (let i = 0; i < metas.length; i++) {
    const m = metas[i];
    const fichaTheme = getPmcCategoryTheme(m.nombre_categoria || m.categoria, m.tema);
    items.push(
      new Paragraph({
        spacing: { before: 240, after: 100 },
        children: [
          new TextRun({
            text: `Ficha Técnica ${i + 1}: ${m.nombre_categoria || m.categoria || 'Ámbito Institucional'} (${fichaTheme.categoriaTitulo})`,
            bold: true,
            size: 22,
            color: fichaTheme.colorHeaderHex,
            font: 'Arial',
          }),
        ],
      })
    );
    items.push(
      tbl(
        [
          new TableRow({
            children: [
              tcH('Campo Descriptivo', { w: CONTENT / 3, fill: fichaTheme.colorHeaderHex, color: C.white }),
              tcH('Especificación de la Meta Institucional', { w: (CONTENT * 2) / 3, fill: fichaTheme.colorHeaderHex, color: C.white }),
            ],
          }),
          new TableRow({
            children: [tcSub('Tema Específico', { fill: fichaTheme.colorBgEcoHex, color: fichaTheme.colorTextAccentHex }), tc(safeStr(m.tema))],
          }),
          new TableRow({
            children: [tcSub('Meta establecida', { fill: fichaTheme.colorBgEcoHex, color: fichaTheme.colorTextAccentHex }), tc(safeStr(cleanPmcPlaceholders(m.meta)), { fill: C.alt })],
          }),
          new TableRow({
            children: [tcSub('Estrategia de implementación para cumplir la meta', { fill: fichaTheme.colorBgEcoHex, color: fichaTheme.colorTextAccentHex }), tc(safeStr(cleanPmcPlaceholders(m.estrategia)))],
          }),
          new TableRow({
            children: [tcSub('Línea Base Documentada', { fill: fichaTheme.colorBgEcoHex, color: fichaTheme.colorTextAccentHex }), tc(safeStr(m.linea_base), { fill: C.alt })],
          }),
          new TableRow({
            children: [tcSub('Personal designado para la instrumentación y el seguimiento de la meta', { fill: fichaTheme.colorBgEcoHex, color: fichaTheme.colorTextAccentHex }), tc(safeStr(m.personal_designado))],
          }),
          new TableRow({
            children: [tcSub('Producto que comprobará el cumplimiento de la meta', { fill: fichaTheme.colorBgEcoHex, color: fichaTheme.colorTextAccentHex }), tc(safeStr(m.entregable), { fill: C.alt })],
          }),
          new TableRow({
            children: [
              tcSub('Subcategorías que vincularán  para cumplir la meta establecida', { fill: fichaTheme.colorBgEcoHex, color: fichaTheme.colorTextAccentHex }),
              tc(
                (Array.isArray(m.subcategorias_vinculadas) && m.subcategorias_vinculadas.length > 0)
                  ? m.subcategorias_vinculadas.join(', ')
                  : safeStr(m.tema || m.nombre_categoria, 'Ámbito General')
              ),
            ],
          }),
          new TableRow({
            children: [
              tcSub('Situación actual en el plantel que justifica el establecimiento de la meta', { fill: fichaTheme.colorBgEcoHex, color: fichaTheme.colorTextAccentHex }),
              tc(
                safeStr(
                  [m.necesidad, m.diagnostico_meta].filter(Boolean).join(' — ') || m.linea_base,
                  'Situación académica diagnosticada en el plantel.'
                ),
                { fill: C.alt }
              ),
            ],
          }),
          new TableRow({
            children: [
              tcSub('Período de Ejecución', { fill: fichaTheme.colorBgEcoHex, color: fichaTheme.colorTextAccentHex }),
              tc(
                (m.periodo_inicio || m.periodo_fin)
                  ? `${safeStr(m.periodo_inicio, 'N/D')} — ${safeStr(m.periodo_fin, 'N/D')}`
                  : 'N/D'
              ),
            ],
          }),
          ...(m.accion_especifica ? [
            new TableRow({
              children: [tcSub('Acción Específica (Formato 3.1)', { fill: fichaTheme.colorBgEcoHex, color: fichaTheme.colorTextAccentHex }), tc(safeStr(cleanPmcPlaceholders(m.accion_especifica)))],
            }),
          ] : []),
          ...(m.finalidad ? [
            new TableRow({
              children: [tcSub('Finalidad de la Meta (Formato 3.1)', { fill: fichaTheme.colorBgEcoHex, color: fichaTheme.colorTextAccentHex }), tc(safeStr(cleanPmcPlaceholders(m.finalidad)), { fill: C.alt })],
            }),
          ] : []),
          ...(m.proceso_evaluacion ? [
            new TableRow({
              children: [tcSub('Proceso de Evaluación (Formato 3.1)', { fill: fichaTheme.colorBgEcoHex, color: fichaTheme.colorTextAccentHex }), tc(safeStr(cleanPmcPlaceholders(m.proceso_evaluacion)))],
            }),
          ] : []),
          ...(m.estrategias_seguimiento ? [
            new TableRow({
              children: [tcSub('Estrategias de Seguimiento (Formato 4.1)', { fill: fichaTheme.colorBgEcoHex, color: fichaTheme.colorTextAccentHex }), tc(safeStr(cleanPmcPlaceholders(m.estrategias_seguimiento)), { fill: C.alt })],
            }),
          ] : []),
          ...(m.observaciones ? [
            new TableRow({
              children: [tcSub('Observaciones Generales (Formato 4.1)', { fill: fichaTheme.colorBgEcoHex, color: fichaTheme.colorTextAccentHex }), tc(safeStr(cleanPmcPlaceholders(m.observaciones)))],
            }),
          ] : []),
        ],
        [CONTENT / 3, (CONTENT * 2) / 3]
      )
    );
    items.push(...gap());
  }

  if (shouldSectionPageBreak(PMC_TITULOS_SECCIONES.METAS_INDIVIDUALES)) {
    items.push(new Paragraph({ children: [new PageBreak()] }));
  }
  return items;
}

// ─── 7. Metas Individuales del Personal ──────────────────────────────────────
export function buildMetasPersonales(plan: PlanAccion): (Paragraph | Table)[] {
  const items: (Paragraph | Table)[] = [secHeading(PMC_TITULOS_SECCIONES.METAS_INDIVIDUALES)];

  const personal = consolidateMetasPersonalesByTeacher(plan.metas_personales ?? []);

  if (personal.length === 0) {
    items.push(bodyPara('No se han registrado metas individuales de la plantilla docente en el sistema.'));
    if (shouldSectionPageBreak(PMC_TITULOS_SECCIONES.PARTICIPANTES_CONTROL)) {
      items.push(new Paragraph({ children: [new PageBreak()] }));
    }
    return items;
  }

  items.push(
    tbl(
      [
        new TableRow({
          children: [
            tcH('N°', { w: 500 }),
            tcH('Nombre del Integrante', { w: 1800 }),
            tcH('Cargo / Función', { w: 1400 }),
            tcH('Meta y Compromiso Individual', { w: 2600 }),
            tcH('Estrategia Individual', { w: 1800 }),
            tcH('Entregable Comprobable', { w: 1600 }),
            tcH('Período', { w: 1100 }),
          ],
        }),
        ...personal.map((mp, i) => {
          const bg = i % 2 ? C.alt : C.white;
          const periodoStr = normalizePmcPeriodo(mp.periodo);
          const cleanMetaInd = cleanPmcPlaceholders(mp.meta_individual);
          const metaStr = safeStr(
            (cleanMetaInd && (cleanMetaInd.startsWith('[') || cleanMetaInd.startsWith('•')))
              ? cleanMetaInd
              : (mp.categoria ? `[${mp.categoria}${mp.tema ? ` — ${mp.tema}` : ''}] ${cleanMetaInd || ''}` : cleanMetaInd),
            'Compromiso de mejora'
          );
          return new TableRow({
            children: [
              tc(String(i + 1), { w: 500, align: AlignmentType.CENTER, fill: bg }),
              tc(safeStr(mp.nombre, 'Personal'), { w: 1800, fill: bg }),
              tc(safeStr(mp.cargo, 'Docente'), { w: 1400, fill: bg }),
              tc(metaStr, { w: 2600, fill: bg }),
              tc(safeStr(cleanPmcPlaceholders(mp.estrategia), 'Seguimiento en aula'), { w: 1800, fill: bg }),
              tc(safeStr(cleanPmcPlaceholders(mp.entregable), 'Planeación y Portafolio'), { w: 1600, fill: bg }),
              tc(periodoStr, { w: 1100, align: AlignmentType.CENTER, fill: bg }),
            ],
          });
        }),
      ],
      [500, 1800, 1400, 2600, 1800, 1600, 1100]
    )
  );

  if (shouldSectionPageBreak(PMC_TITULOS_SECCIONES.PARTICIPANTES_CONTROL)) {
    items.push(new Paragraph({ children: [new PageBreak()] }));
  }
  return items;
}

// ─── 8. Participantes, Control de Revisiones y Aprobación ─────────────────────
export function buildControlRevisiones(p: PmcProject, plan?: PlanAccion): (Paragraph | Table)[] {
  const staffData = parseJson<Array<{ nombre?: string; cargo?: string; horas_base?: number | string | null }>>(p.staff_data);
  const participantesRaw = Array.isArray(staffData) && staffData.length > 0
    ? staffData
    : [{ nombre: p.director_name, cargo: 'Director(a)' }];
  const participantes = participantesRaw.filter((part) => {
    const n = part?.nombre?.trim();
    return isValidStaffName(n) && !isCollectiveOrNonHumanEntity(n);
  });

  const metasInst = plan?.metas_institucionales ?? [];
  const seguimientoItems: (Paragraph | Table)[] = [];

  if (metasInst.length > 0) {
    seguimientoItems.push(
      subHeading('Mecanismos de Seguimiento y Monitoreo Trimestral:'),
      bodyPara(
        'El seguimiento sistemático garantiza la pertinencia de las actividades y permite realizar ajustes oportunos en los colegiados de docentes y directivos. A continuación se presentan los cortes temporales y responsables designados derivados de las metas institucionales capturadas:'
      ),
      tbl(
        [
          new TableRow({
            children: [
              tcH('Período / Corte de Seguimiento', { w: 2600 }),
              tcH('Meta Institucional Asociada', { w: 5000 }),
              tcH('Responsable del Seguimiento', { w: 3200 }),
            ],
          }),
          ...metasInst.map((m, idx) => {
            const bg = idx % 2 === 0 ? C.white : C.alt;
            const periodo = (m.periodo_inicio || m.periodo_fin)
              ? `${safeStr(m.periodo_inicio, 'Corte 1')} a ${safeStr(m.periodo_fin, 'Corte 2')}`
              : 'Período ordinario';
            return new TableRow({
              children: [
                tc(periodo, { w: 2600, fill: bg }),
                tc(safeStr(cleanPmcPlaceholders(m.meta), 'Meta institucional programada'), { w: 5000, fill: bg }),
                tc(safeStr(m.personal_designado, 'Dirección / Colectivo Escolar'), { w: 3200, fill: bg }),
              ],
            });
          }),
        ],
        [2600, 5000, 3200]
      ),
      ...gap(2)
    );
  }

  return [
    secHeading(PMC_TITULOS_SECCIONES.PARTICIPANTES_CONTROL),
    ...seguimientoItems,
    bodyPara(
      'El presente Plan de Mejora Continua fue elaborado participativamente por el colectivo escolar del plantel, formalizando los acuerdos y compromisos institucionales para el ciclo escolar correspondiente:'
    ),
    ...gap(),
    subHeading('Personal y Colectivo Escolar Participante:'),
    tbl(
      [
        new TableRow({
          children: [
            tcH('N°', { w: 600 }),
            tcH('Nombre Completo del Personal', { w: 3800 }),
            tcH('Cargo / Función en el CTE', { w: 2600 }),
            tcH('Horas Base', { w: 1400 }),
            tcH('Firma de Conformidad', { w: 2400 }),
          ],
        }),
        ...participantes.map(
          (part, idx) => {
            const bg = idx % 2 ? C.alt : C.white;
            const horasBase = part.horas_base != null && String(part.horas_base).trim() !== ''
              ? `${part.horas_base} hrs`
              : '—';
            return new TableRow({
              children: [
                tc(String(idx + 1), { w: 600, align: AlignmentType.CENTER, fill: bg }),
                tc(safeStr(part.nombre, 'Personal Escolar'), { w: 3800, fill: bg }),
                tc(safeStr(part.cargo, 'Docente'), { w: 2600, fill: bg }),
                tc(horasBase, { w: 1400, align: AlignmentType.CENTER, fill: bg }),
                tc('________________________', { w: 2400, align: AlignmentType.CENTER, fill: bg }),
              ],
            });
          }
        ),
      ],
      [600, 3800, 2600, 1400, 2400]
    ),
    ...gap(2),
    tbl(
      [
        new TableRow({
          children: [
            tcH('CONSTANCIA DE APROBACIÓN Y VALIDACIÓN DEL PLAN DE MEJORA CONTINUA', {
              span: 3,
              align: AlignmentType.CENTER,
              w: CONTENT,
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              width: { size: 3600, type: WidthType.DXA },
              borders: bdr('CCCCCC'),
              margins: { top: 200, bottom: 200, left: 140, right: 140 },
              verticalAlign: 'center',
              children: [
                new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 400, after: 80 }, children: [new TextRun({ text: '___________________________________________', size: 16, color: C.muted })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 40, after: 60 }, children: [new TextRun({ text: 'ELABORÓ', bold: true, size: 18, color: C.navy, font: 'Arial' })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 40, after: 40 }, children: [new TextRun({ text: safeStr(p.director_name, 'Director(a) del Plantel').toUpperCase(), bold: true, size: 18, color: C.text, font: 'Arial' })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 20, after: 20 }, children: [new TextRun({ text: 'DIRECTOR(A) DEL PLANTEL', size: 16, color: C.muted, font: 'Arial' })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 20, after: 80 }, children: [new TextRun({ text: 'Firma y Sello del Plantel', italics: true, size: 14, color: C.muted, font: 'Arial' })] }),
              ],
            }),
            new TableCell({
              width: { size: 3600, type: WidthType.DXA },
              borders: bdr('CCCCCC'),
              margins: { top: 200, bottom: 200, left: 140, right: 140 },
              verticalAlign: 'center',
              children: [
                new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 400, after: 80 }, children: [new TextRun({ text: '___________________________________________', size: 16, color: C.muted })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 40, after: 60 }, children: [new TextRun({ text: 'REVISÓ', bold: true, size: 18, color: C.navy, font: 'Arial' })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 40, after: 40 }, children: [new TextRun({ text: 'REPRESENTANTE DEL CTE', bold: true, size: 18, color: C.text, font: 'Arial' })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 20, after: 20 }, children: [new TextRun({ text: 'COLECTIVO DOCENTE DEL PLANTEL', size: 16, color: C.muted, font: 'Arial' })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 20, after: 80 }, children: [new TextRun({ text: 'Firma y Rúbrica', italics: true, size: 14, color: C.muted, font: 'Arial' })] }),
              ],
            }),
            new TableCell({
              width: { size: 3600, type: WidthType.DXA },
              borders: bdr('CCCCCC'),
              margins: { top: 200, bottom: 200, left: 140, right: 140 },
              verticalAlign: 'center',
              children: [
                new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 400, after: 80 }, children: [new TextRun({ text: '___________________________________________', size: 16, color: C.muted })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 40, after: 60 }, children: [new TextRun({ text: 'VALIDÓ', bold: true, size: 18, color: C.navy, font: 'Arial' })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 40, after: 40 }, children: [new TextRun({ text: safeStr(p.supervisor_name, 'Supervisor(a) de Zona').toUpperCase(), bold: true, size: 18, color: C.text, font: 'Arial' })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 20, after: 20 }, children: [new TextRun({ text: 'SUPERVISOR(A) DE ZONA ESCOLAR', size: 16, color: C.muted, font: 'Arial' })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 20, after: 80 }, children: [new TextRun({ text: 'Vo. Bo. y Sello de Zona', italics: true, size: 14, color: C.muted, font: 'Arial' })] }),
              ],
            }),
          ],
        }),
      ],
      [3600, 3600, 3600]
    ),
    ...gap(2),
  ];
}

