/**
 * pmc-indicator-calculator.ts — Módulo puro para cálculo y formateo de indicadores PMC.
 * SIGPDA-EMS · Estándar Oficial SEP Puebla (SEMS / MCCEMS)
 * Reglas C2/C3: 'N/D' defensivo, 0 legítimo, sin +5 inventado, sin NaN%.
 */

import type { PmcIndicadoresAcademicos, PmcStatisticalContext } from '@/types/pmc';
import { isRealNumeric } from './numeric-guard';

export { isRealNumeric };

export type PmcIndicatorRowCell = string | {
  content: string;
  colSpan?: number;
  styles?: Record<string, unknown>;
};

export type PmcIndicatorRow = PmcIndicatorRowCell[];

/**
 * Calcula las filas de la tabla de Indicadores Educativos (Línea Base vs Meta Institucional)
 * para su representación en PDF / visualizadores.
 */
export function calculatePmcIndicatorRows(
  indicadores?: PmcIndicadoresAcademicos | Record<string, unknown> | null,
  statisticalContext?: PmcStatisticalContext | null,
  cicloTexto?: string
): PmcIndicatorRow[] {
  const ind = (indicadores || {}) as Record<string, unknown>;
  const statsCtx: PmcStatisticalContext | undefined = statisticalContext || (ind.statistical_context as PmcStatisticalContext | undefined);
  const pStats = statsCtx?.plantel;
  const zStats = statsCtx?.zona;

  // Extracción jerárquica: plantel context > indicadores directos
  const matAnt = (pStats && isRealNumeric(pStats.matricula)) ? pStats.matricula : isRealNumeric(ind.matricula) ? ind.matricula : undefined;
  const apAnt = (pStats && isRealNumeric(pStats.aprobadosPorcentaje)) ? pStats.aprobadosPorcentaje : isRealNumeric(ind.aprobacion_ant) ? ind.aprobacion_ant : undefined;
  const repAnt = (pStats && isRealNumeric(pStats.reprobacion)) ? pStats.reprobacion : isRealNumeric(ind.reprobacion_ant) ? ind.reprobacion_ant : undefined;
  const abAnt = (pStats && isRealNumeric(pStats.abandono)) ? pStats.abandono : isRealNumeric(ind.abandono_ant) ? ind.abandono_ant : undefined;
  const etAnt = (pStats && isRealNumeric(pStats.eficienciaTerminal)) ? pStats.eficienciaTerminal : isRealNumeric(ind.et_ant) ? ind.et_ant : undefined;
  
  const promVal = pStats?.promedioGeneral ?? pStats?.promedioCalificaciones;
  const promF11 = isRealNumeric(promVal) ? promVal : undefined;

  // Metas institucionales: NO inventar valores si no fueron provistos explícitamente
  const apMeta = isRealNumeric(ind.aprobacion_meta) ? ind.aprobacion_meta : undefined;
  const repMeta = isRealNumeric(ind.reprobacion_meta) ? ind.reprobacion_meta : undefined;
  const abMeta = isRealNumeric(ind.abandono_meta) ? ind.abandono_meta : undefined;
  const etMeta = isRealNumeric(ind.et_meta) ? ind.et_meta : undefined;

  // 1. Tasa de Aprobación Escolar
  const apAntStr = apAnt !== undefined ? `${Number(apAnt).toFixed(1)}%` : 'N/D';
  const apMetaStr = apMeta !== undefined ? `${Number(apMeta).toFixed(1)}%` : 'N/D';
  let apVarStr = 'N/D';
  if (apAnt !== undefined && apMeta !== undefined) {
    const diff = Number(apMeta) - Number(apAnt);
    apVarStr = diff >= 0 ? `+${diff.toFixed(1)}% Mejora` : `${diff.toFixed(1)}% Disminución`;
  }

  // 2. Índice de Reprobación Escolar
  const repAntStr = repAnt !== undefined ? `${Number(repAnt).toFixed(1)}%` : 'N/D';
  let repMetaStr = 'N/D';
  let repVarStr = 'N/D';
  if (repMeta !== undefined) {
    repMetaStr = `${Number(repMeta).toFixed(1)}%`;
    if (repAnt !== undefined) {
      const diff = Number(repMeta) - Number(repAnt);
      repVarStr = diff <= 0 ? `${diff.toFixed(1)}% Reducción` : `+${diff.toFixed(1)}% Incremento`;
    } else {
      repVarStr = 'Reducción Progresiva';
    }
  } else if (apMeta !== undefined) {
    const derivedRep = Math.max(0, 100 - Number(apMeta));
    repMetaStr = `${derivedRep.toFixed(1)}%`;
    repVarStr = 'Reducción Progresiva';
  }

  // 3. Abandono Escolar / Deserción
  const abAntStr = abAnt !== undefined ? `${Number(abAnt).toFixed(1)}%` : 'N/D';
  const abMetaStr = abMeta !== undefined ? `${Number(abMeta).toFixed(1)}%` : 'N/D';
  let abVarStr = 'N/D';
  if (abAnt !== undefined && abMeta !== undefined) {
    const diff = Number(abMeta) - Number(abAnt);
    abVarStr = diff <= 0 ? `${diff.toFixed(1)}% Retención` : `+${diff.toFixed(1)}% Deserción`;
  }

  // 4. Eficiencia Terminal / Egreso
  const etAntStr = etAnt !== undefined ? `${Number(etAnt).toFixed(1)}%` : 'N/D';
  const etMetaStr = etMeta !== undefined ? `${Number(etMeta).toFixed(1)}%` : 'N/D';
  let etVarStr = 'N/D';
  if (etAnt !== undefined && etMeta !== undefined) {
    const diff = Number(etMeta) - Number(etAnt);
    etVarStr = diff >= 0 ? `+${diff.toFixed(1)}% Graduación` : `${diff.toFixed(1)}% Disminución`;
  }

  // 5. Matrícula Escolar Oficial
  const matAntStr = matAnt !== undefined ? `${matAnt} estudiantes` : 'N/D';
  const matMeta = isRealNumeric(ind.matricula_meta) ? ind.matricula_meta : undefined;
  const matMetaStr = matMeta !== undefined ? `${matMeta} estudiantes` : 'N/D';
  let matVarStr = 'N/D';
  if (matAnt !== undefined && matMeta !== undefined) {
    const diff = Number(matMeta) - Number(matAnt);
    matVarStr = diff === 0 ? 'Sostenimiento' : diff > 0 ? `+${diff} estudiantes` : `${diff} estudiantes`;
  }

  const rows: PmcIndicatorRow[] = [
    ['Tasa de Aprobación Escolar (F11C)', apAntStr, apMetaStr, apVarStr],
    ['Índice de Reprobación Escolar (F11C)', repAntStr, repMetaStr, repVarStr],
    ['Abandono Escolar / Deserción (911.7)', abAntStr, abMetaStr, abVarStr],
    ['Eficiencia Terminal / Egreso (911.7G)', etAntStr, etMetaStr, etVarStr],
    ['Matrícula Escolar Oficial (911.7G)', matAntStr, matMetaStr, matVarStr],
  ];

  if (promF11 !== undefined) {
    const promNum = Number(promF11);
    const promMeta = isRealNumeric(ind.promedio_meta) ? ind.promedio_meta : undefined;
    const promMetaStr = promMeta !== undefined ? `${Number(promMeta).toFixed(2)}` : 'N/D';
    let promVarStr = 'N/D';
    if (promMeta !== undefined) {
      const diff = Number(promMeta) - promNum;
      promVarStr = diff >= 0 ? `+${diff.toFixed(2)} Aprovechamiento` : `${diff.toFixed(2)} Aprovechamiento`;
    }
    rows.push([
      'Promedio General de Calificaciones (F11C)',
      `${promNum.toFixed(2)}`,
      promMetaStr,
      promVarStr,
    ]);
  }

  if (zStats) {
    const zonaNum = zStats.zonaNumero || 'Regional';
    const abZona = isRealNumeric(zStats.promedioAbandono) ? `${zStats.promedioAbandono}%` : 'N/D';
    const etZona = isRealNumeric(zStats.promedioEficiencia) ? `${zStats.promedioEficiencia}%` : 'N/D';
    const prioridad = zStats.brechasDiagnostico?.prioridadIntervencion
      ? String(zStats.brechasDiagnostico.prioridadIntervencion).toUpperCase()
      : 'MEDIA';

    const BLUE_LIGHT = [220, 228, 245];
    const NAVY = [31, 56, 100];

    rows.push([
      {
        content: `Comparativo de Zona Escolar (${zonaNum}): Media Abandono ${abZona}, Media Eficiencia ${etZona} (Prioridad: ${prioridad})`,
        colSpan: 4,
        styles: { fontStyle: 'italic', fillColor: BLUE_LIGHT, textColor: NAVY },
      },
    ]);
  }

  // Opcional: anotar ciclo escolar en pie si fue proporcionado
  if (cicloTexto && rows.length > 0 && typeof rows[0][0] === 'string') {
    // metadata preservada sin romper tabla
  }

  return rows;
}
