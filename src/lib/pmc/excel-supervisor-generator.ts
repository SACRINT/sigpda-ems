/**
 * src/lib/pmc/excel-supervisor-generator.ts
 *
 * Motor de Generación del Libro de Excel Oficial de Supervisión Escolar
 * para Metas del Ciclo Escolar 2026-2027 (MCCEMS Puebla / SEMS).
 *
 * Estructura Oficial:
 * - Hoja 1: "Indicadores" — Glosario y fórmulas normativas de evaluación, egreso y abandono.
 * - Hoja 2: "Punto de partida" — Resultados oficiales del ciclo escolar 2025-2026.
 * - Hoja 3: "METAS" — Metas proyectadas para el ciclo escolar 2026-2027.
 * - Hoja 4: "Matriz de Implementación" — Anexo institucional con el plan de acción pedagógico.
 *
 * SSoT: Todos los cálculos e indicadores provienen exclusivamente de `pmc-indicator-calculator.ts`.
 */

import ExcelJS from 'exceljs';
import { computePmcIndicatorValues, computeAprobadosCount } from '@/lib/pmc-indicator-calculator';
import type { PmcIndicadoresAcademicos, PmcStatisticalContext, PmcStatisticalPlantel } from '@/types/pmc';

export interface PmcMetaInstitucionalInput {
  categoria: string;
  nombre_categoria?: string;
  tema: string;
  meta: string;
  estrategia?: string;
  linea_base?: string;
  personal_designado?: string;
  entregable?: string;
  periodo_inicio?: string;
  periodo_fin?: string;
}

export interface PmcSupervisorExcelInput {
  id?: string;
  school_name?: string;
  school_cct?: string;
  turno?: string;
  subsystem?: string;
  ciclo_escolar?: string;
  indicadores_academicos?: PmcIndicadoresAcademicos | Record<string, unknown> | null;
  statistical_context?: (PmcStatisticalContext & { allPlanteles?: PmcStatisticalPlantel[] }) | null;
  plan_accion?: {
    metas_institucionales?: PmcMetaInstitucionalInput[];
  } | null;
}

function parseMetricNumber(val: string | undefined): number | undefined {
  if (!val || val === 'N/D') return undefined;
  const cleaned = val.replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Genera el libro Excel oficial de supervisión para el Plan de Mejora Continua.
 */
export async function generatePmcSupervisorExcel(project: PmcSupervisorExcelInput): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SIGPDA-EMS · Supervisión Escolar Media Superior Puebla';
  workbook.lastModifiedBy = 'SIGPDA-EMS';
  workbook.created = new Date();
  workbook.modified = new Date();

  // Estilos oficiales reutilizables
  const navyHeaderFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1F3864' },
  };

  const grayHeaderFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4F5B66' },
  };

  const headerFont: Partial<ExcelJS.Font> = {
    name: 'Calibri',
    size: 10,
    bold: true,
    color: { argb: 'FFFFFFFF' },
  };

  const titleFont: Partial<ExcelJS.Font> = {
    name: 'Calibri',
    size: 13,
    bold: true,
    color: { argb: 'FF1F3864' },
  };

  const dataFont: Partial<ExcelJS.Font> = {
    name: 'Calibri',
    size: 10,
  };

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFD3D3D3' } },
    bottom: { style: 'thin', color: { argb: 'FFD3D3D3' } },
    left: { style: 'thin', color: { argb: 'FFD3D3D3' } },
    right: { style: 'thin', color: { argb: 'FFD3D3D3' } },
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // HOJA 1: "Indicadores"
  // ═══════════════════════════════════════════════════════════════════════════
  const ws1 = workbook.addWorksheet('Indicadores', {
    views: [{ showGridLines: true }],
  });

  ws1.columns = [
    { key: 'indicador', width: 46 },
    { key: 'descripcion', width: 85 },
  ];

  const ws1HeaderRow = ws1.addRow(['Indicadores', 'Descripción']);
  ws1HeaderRow.height = 24;
  ws1HeaderRow.eachCell((cell) => {
    cell.fill = navyHeaderFill;
    cell.font = headerFont;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  const indicadoresRows = [
    [
      'Resultados de evaluaciones para el seguimiento del desarrollo de aprendizaje',
      'Resultados de las evaluaciones establecidas para identificar el desarrollo en la obtención de aprendizajes.',
    ],
    [
      'Resultados de evaluaciones para el seguimiento del desarrollo de aprendizaje',
      'Promedio de calificaciones',
    ],
    [
      'Eficiencia Terminal',
      'Mide la proporción de estudiantes que, tras ingresar por primera vez, logran egresar en el número de ciclos escolares de duración de cada nivel educativo.',
    ],
    [
      'Eficiencia Terminal',
      'Anterior o punto partida: Número de estudiantes que egresaron en la generación 2025-2026 / Número de estudiantes que ingresaron en la generación 2023-2024',
    ],
    [
      'Eficiencia Terminal',
      'Meta: Número de estudiantes que egresen en la generación 2026-2027 / Número de estudiantes que ingresaron en la generación 2024-2025',
    ],
    [
      'Abandono Escolar',
      'El abandono escolar muestra la proporción de estudiantes que, tras iniciar un ciclo escolar en algún grado, año o semestre de determinado nivel educativo, no lo concluyen, o que, sin haber concluido el nivel, no se inscriben en el siguiente ciclo.',
    ],
    [
      'Abandono Escolar',
      'Número de estudiantes desafiliados o que abandonaron / Total de matrícula',
    ],
  ];

  for (const rowData of indicadoresRows) {
    const r = ws1.addRow(rowData);
    r.height = 20;
    r.getCell(1).font = { ...dataFont, bold: true };
    r.getCell(1).alignment = { vertical: 'middle', wrapText: true };
    r.getCell(1).border = thinBorder;
    r.getCell(2).font = dataFont;
    r.getCell(2).alignment = { vertical: 'middle', wrapText: true };
    r.getCell(2).border = thinBorder;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HOJA 2: "Punto de partida"
  // ═══════════════════════════════════════════════════════════════════════════
  const ws2 = workbook.addWorksheet('Punto de partida', {
    views: [{ showGridLines: true }],
  });

  ws2.columns = [
    { key: 'nombre', width: 38 },
    { key: 'cct', width: 16 },
    { key: 'turno', width: 10 },
    { key: 'matricula', width: 20 },
    { key: 'promedio', width: 26 },
    { key: 'aprobados_num', width: 22 },
    { key: 'aprobados_pct', width: 22 },
    { key: 'eficiencia', width: 24 },
    { key: 'abandono', width: 18 },
  ];

  const ws2TitleRow = ws2.addRow(['Punto de partida: Resultados del ciclo escolar 2025-2026']);
  ws2TitleRow.height = 28;
  ws2TitleRow.getCell(1).font = titleFont;
  ws2TitleRow.getCell(1).alignment = { vertical: 'middle' };

  const ws2Headers = [
    'NOMBRE DE LA ESCUELA',
    'CCT',
    'TURNO',
    'MATRÍCULA TOTAL AL CIERRE 2025-2026',
    '% RESULTADO DE EVALUACIONES (PROMEDIO DE CALIFICACIONES SEM A Y SEM B)',
    'NÚMERO DE ESTUDIANTES APROBADOS (AL CIERRE DEL CICLO ESCOLAR)',
    '% ESTUDIANTES APROBADOS (SEM A Y B)',
    '% EFICIENCIA TERMINAL GENERACIÓN 2023-2026',
    '% ABANDONO ESCOLAR',
  ];

  const ws2HeaderRow = ws2.addRow(ws2Headers);
  ws2HeaderRow.height = 36;
  ws2HeaderRow.eachCell((cell) => {
    cell.fill = navyHeaderFill;
    cell.font = headerFont;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = thinBorder;
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // HOJA 3: "METAS"
  // ═══════════════════════════════════════════════════════════════════════════
  const ws3 = workbook.addWorksheet('METAS', {
    views: [{ showGridLines: true }],
  });

  ws3.columns = [
    { key: 'nombre', width: 38 },
    { key: 'cct', width: 16 },
    { key: 'turno', width: 10 },
    { key: 'matricula', width: 20 },
    { key: 'promedio', width: 26 },
    { key: 'aprobados_num', width: 22 },
    { key: 'aprobados_pct', width: 22 },
    { key: 'eficiencia', width: 24 },
    { key: 'abandono', width: 18 },
  ];

  const ws3TitleRow = ws3.addRow(['METAS: Para el ciclo escolar 2026-2027']);
  ws3TitleRow.height = 28;
  ws3TitleRow.getCell(1).font = titleFont;
  ws3TitleRow.getCell(1).alignment = { vertical: 'middle' };

  const ws3Headers = [
    'NOMBRE DE LA ESCUELA',
    'CCT',
    'TURNO',
    'MATRÍCULA TOTAL AGOSTO 2026',
    'META: % RESULTADO DE EVALUACIONES (PROMEDIO DE CALIFICACIONES SEM A Y SEM B)',
    'META: NÚMERO DE ESTUDIANTES APROBADOS (AL CIERRE DEL CICLO ESCOLAR)',
    'META: % ESTUDIANTES APROBADOS (SEM A Y B)',
    'META: % EFICIENCIA TERMINAL GENERACIÓN 2024-2027',
    'META: % ABANDONO ESCOLAR',
  ];

  const ws3HeaderRow = ws3.addRow(ws3Headers);
  ws3HeaderRow.height = 36;
  ws3HeaderRow.eachCell((cell) => {
    cell.fill = navyHeaderFill;
    cell.font = headerFont;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = thinBorder;
  });

  // Poblado de filas para Hojas 2 y 3 mediante SSoT
  const allPlanteles: PmcStatisticalPlantel[] = project.statistical_context?.allPlanteles || [];

  interface PlantelExportRowData {
    nombre: string;
    cct: string;
    turno: string;
    // Hoja 2 (Punto de partida)
    matAnt?: number;
    promAnt?: number;
    apNumAnt?: number;
    apPctAnt?: number;
    etAnt?: number;
    abAnt?: number;
    // Hoja 3 (METAS)
    matMeta?: number;
    promMeta?: number;
    apNumMeta?: number;
    apPctMeta?: number;
    etMeta?: number;
    abMeta?: number;
  }

  const plantelesData: PlantelExportRowData[] = [];

  if (allPlanteles.length > 0) {
    for (const p of allPlanteles) {
      const isMainProjectPlantel = project.school_cct && p.cct.toUpperCase() === project.school_cct.toUpperCase();
      const comp = computePmcIndicatorValues(
        isMainProjectPlantel ? project.indicadores_academicos : undefined,
        {
          fuente: project.statistical_context?.fuente || 'manual',
          parsedAt: project.statistical_context?.parsedAt || new Date().toISOString(),
          zona: project.statistical_context?.zona,
          cicloEscolar: project.statistical_context?.cicloEscolar,
          plantel: p,
        }
      );

      const matAnt = parseMetricNumber(comp.matricula.ant);
      const promAnt = parseMetricNumber(comp.promedio?.ant);
      const apPctAnt = parseMetricNumber(comp.aprobacion.ant);
      const etAnt = parseMetricNumber(comp.eficiencia.ant);
      const abAnt = parseMetricNumber(comp.abandono.ant);
      const apNumAnt = computeAprobadosCount(matAnt, apPctAnt, p.estudiantesAprobados ?? p.aprobados);

      const matMeta = parseMetricNumber(comp.matricula.meta) ?? matAnt;
      const promMeta = parseMetricNumber(comp.promedio?.meta) ?? promAnt;
      const apPctMeta = parseMetricNumber(comp.aprobacion.meta) ?? apPctAnt;
      const etMeta = parseMetricNumber(comp.eficiencia.meta) ?? etAnt;
      const abMeta = parseMetricNumber(comp.abandono.meta) ?? abAnt;
      const apNumMeta = computeAprobadosCount(matMeta, apPctMeta) ?? apNumAnt;

      plantelesData.push({
        nombre: p.nombre,
        cct: p.cct,
        turno: p.turno || project.turno || 'M',
        matAnt,
        promAnt,
        apNumAnt,
        apPctAnt,
        etAnt,
        abAnt,
        matMeta,
        promMeta,
        apNumMeta,
        apPctMeta,
        etMeta,
        abMeta,
      });
    }
  } else {
    // Caso de escuela individual sin matriz de zona
    const comp = computePmcIndicatorValues(project.indicadores_academicos, project.statistical_context);
    const ind = (project.indicadores_academicos || {}) as Record<string, unknown>;

    const matAnt = parseMetricNumber(comp.matricula.ant);
    const promAnt = parseMetricNumber(comp.promedio?.ant);
    const apPctAnt = parseMetricNumber(comp.aprobacion.ant);
    const etAnt = parseMetricNumber(comp.eficiencia.ant);
    const abAnt = parseMetricNumber(comp.abandono.ant);
    const apNumAnt = computeAprobadosCount(
      matAnt,
      apPctAnt,
      typeof ind.estudiantes_aprobados === 'number' ? ind.estudiantes_aprobados : undefined
    );

    const matMeta = parseMetricNumber(comp.matricula.meta) ?? matAnt;
    const promMeta = parseMetricNumber(comp.promedio?.meta) ?? promAnt;
    const apPctMeta = parseMetricNumber(comp.aprobacion.meta) ?? apPctAnt;
    const etMeta = parseMetricNumber(comp.eficiencia.meta) ?? etAnt;
    const abMeta = parseMetricNumber(comp.abandono.meta) ?? abAnt;
    const apNumMeta = computeAprobadosCount(
      matMeta,
      apPctMeta,
      typeof ind.estudiantes_aprobados_meta === 'number' ? ind.estudiantes_aprobados_meta : undefined
    ) ?? apNumAnt;

    plantelesData.push({
      nombre: project.school_name || 'Plantel Educativo',
      cct: project.school_cct || '21EBH0000X',
      turno: project.turno || 'M',
      matAnt,
      promAnt,
      apNumAnt,
      apPctAnt,
      etAnt,
      abAnt,
      matMeta,
      promMeta,
      apNumMeta,
      apPctMeta,
      etMeta,
      abMeta,
    });
  }

  // Insertar filas en Hoja 2 y Hoja 3
  for (const pd of plantelesData) {
    // Hoja 2
    const r2 = ws2.addRow([
      pd.nombre,
      pd.cct,
      pd.turno,
      pd.matAnt ?? null,
      pd.promAnt ?? null,
      pd.apNumAnt ?? null,
      pd.apPctAnt ?? null,
      pd.etAnt ?? null,
      pd.abAnt ?? null,
    ]);
    r2.height = 20;
    r2.getCell(1).font = { ...dataFont, bold: true };
    r2.getCell(2).alignment = { horizontal: 'center' };
    r2.getCell(3).alignment = { horizontal: 'center' };
    r2.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.border = thinBorder;
      cell.font = dataFont;
      if (colNumber >= 4) {
        cell.alignment = { horizontal: 'right' };
      }
    });

    // Hoja 3
    const r3 = ws3.addRow([
      pd.nombre,
      pd.cct,
      pd.turno,
      pd.matMeta ?? null,
      pd.promMeta ?? null,
      pd.apNumMeta ?? null,
      pd.apPctMeta ?? null,
      pd.etMeta ?? null,
      pd.abMeta ?? null,
    ]);
    r3.height = 20;
    r3.getCell(1).font = { ...dataFont, bold: true };
    r3.getCell(2).alignment = { horizontal: 'center' };
    r3.getCell(3).alignment = { horizontal: 'center' };
    r3.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.border = thinBorder;
      cell.font = dataFont;
      if (colNumber >= 4) {
        cell.alignment = { horizontal: 'right' };
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HOJA 4: "Matriz de Implementación" (Anexo institucional oficial)
  // ═══════════════════════════════════════════════════════════════════════════
  const ws4 = workbook.addWorksheet('Matriz de Implementación', {
    views: [{ showGridLines: true }],
  });

  ws4.columns = [
    { key: 'no', width: 6 },
    { key: 'categoria', width: 28 },
    { key: 'tema', width: 24 },
    { key: 'meta', width: 44 },
    { key: 'estrategia', width: 36 },
    { key: 'linea_base', width: 20 },
    { key: 'responsable', width: 28 },
    { key: 'entregable', width: 26 },
    { key: 'periodo', width: 20 },
  ];

  const ws4NoticeRow = ws4.addRow([
    'Anexo institucional — no forma parte del formato oficial de supervisión',
  ]);
  ws4NoticeRow.height = 24;
  ws4NoticeRow.getCell(1).font = { ...titleFont, italic: true, size: 11, color: { argb: 'FF64748B' } };

  const ws4HeaderRow = ws4.addRow([
    'No.',
    'Categoría',
    'Tema Prioritario',
    'Meta Institucional 2026-2027',
    'Estrategia',
    'Línea Base',
    'Personal Designado / Responsable',
    'Entregable / Evidencia',
    'Periodo de Ejecución',
  ]);
  ws4HeaderRow.height = 30;
  ws4HeaderRow.eachCell((cell) => {
    cell.fill = grayHeaderFill;
    cell.font = headerFont;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = thinBorder;
  });

  const metasInst = project.plan_accion?.metas_institucionales || [];
  if (metasInst.length > 0) {
    metasInst.forEach((m, idx) => {
      const periodo = [m.periodo_inicio, m.periodo_fin].filter(Boolean).join(' - ') || 'Ciclo 2026-2027';
      const r = ws4.addRow([
        idx + 1,
        m.nombre_categoria || m.categoria || 'Mejora Continua',
        m.tema || 'Área prioritaria',
        m.meta || 'Sin meta especificada',
        m.estrategia || 'Acciones situadas de colegiado',
        m.linea_base || 'Sin línea base reportada',
        m.personal_designado || 'Colectivo Escolar',
        m.entregable || 'Reporte de seguimiento',
        periodo,
      ]);
      r.height = 24;
      r.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      r.eachCell({ includeEmpty: true }, (cell) => {
        cell.font = dataFont;
        cell.border = thinBorder;
        cell.alignment = { vertical: 'middle', wrapText: true };
      });
    });
  } else {
    const emptyRow = ws4.addRow([
      1,
      'Metas en proceso de codiseño',
      'Diagnóstico situacional',
      'Metas institucionales en proceso de consolidación en el Paso 4 del wizard',
      'Acompañamiento colegiado',
      'Estadística 911 / F11C',
      'Colegiado Docente',
      'Portafolio de evidencias',
      'Ciclo 2026-2027',
    ]);
    emptyRow.height = 24;
    emptyRow.eachCell((cell) => {
      cell.font = { ...dataFont, italic: true };
      cell.border = thinBorder;
      cell.alignment = { vertical: 'middle', wrapText: true };
    });
  }

  // Generar Buffer del archivo Excel
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
