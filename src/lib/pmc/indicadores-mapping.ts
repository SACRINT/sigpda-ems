/**
 * src/lib/pmc/indicadores-mapping.ts
 *
 * Mapeo canónico de datos de Estadística 911 a indicadores académicos del PMC (H-165, H-168).
 * Extraído para pruebas unitarias deterministas y evitar desajustes de ciclos escolares.
 */

import { toRealNumber } from '@/lib/numeric-guard';
import type { PmcIndicadoresAcademicos } from '@/types/pmc';

export interface Estadistica911Data {
  matricula?: number | string | null;
  matriculaAnterior?: number | string | null;
  abandonoPorcentaje?: number | string | null;
  eficienciaTerminal?: number | string | null;
  reprobacionPorcentaje?: number | string | null;
  aprobacionPorcentaje?: number | string | null;
  totalDocentes?: number | string | null;
  [key: string]: unknown;
}

/**
 * Mapea la Estadística 911 de Fin de Ciclo Anterior (momento='fin_anterior').
 *
 * REGLA CRÍTICA (H-168):
 * En un 911 fin de cursos (ej. fin 2025-2026), la matrícula inscrita en ese documento
 * (`data.matricula`) representa el CIERRE del ciclo anterior (línea base del nuevo PMC).
 * Por ende, `matriculaAnterior` se puebla con `data.matricula`.
 * NO debe usarse `data.matriculaAnterior`, ya que ese campo en el 911 corresponde al
 * ciclo previo al documento (dos ciclos atrás).
 */
export function mapFinAnteriorToIndicadores<T extends PmcIndicadoresAcademicos>(
  data: Estadistica911Data | undefined | null,
  prev: T
): T {
  if (!data) return prev;

  const rawAb = data.abandonoPorcentaje;
  const rawEt = data.eficienciaTerminal;
  const rawRep = data.reprobacionPorcentaje;
  const rawAp = data.aprobacionPorcentaje;

  const abandonoAnt = toRealNumber(rawAb) ?? prev.abandono_ant;
  const etAnt = toRealNumber(rawEt) ?? prev.et_ant;
  const reprobAnt = toRealNumber(rawRep) ?? prev.reprobacion_ant;
  const aprobAnt = toRealNumber(rawAp) ?? prev.aprobacion_ant;

  const abandonoMeta = prev.abandono_meta !== undefined
    ? prev.abandono_meta
    : (abandonoAnt !== undefined && !isNaN(abandonoAnt)
        ? Math.max(0, Math.round((abandonoAnt - 1.5) * 10) / 10)
        : undefined);

  const etMeta = prev.et_meta !== undefined
    ? prev.et_meta
    : (etAnt !== undefined && !isNaN(etAnt)
        ? Math.min(100, Math.round((etAnt + 2) * 10) / 10)
        : undefined);

  const reprobMeta = prev.reprobacion_meta !== undefined
    ? prev.reprobacion_meta
    : (reprobAnt !== undefined && !isNaN(reprobAnt)
        ? Math.max(0, Math.round((reprobAnt - 2) * 10) / 10)
        : undefined);

  const aprobMeta = prev.aprobacion_meta !== undefined
    ? prev.aprobacion_meta
    : (aprobAnt !== undefined && !isNaN(aprobAnt)
        ? Math.min(100, Math.round((aprobAnt + 2) * 10) / 10)
        : undefined);

  // H-168: Cierre del ciclo anterior viene en data.matricula del documento fin_anterior
  const matriculaCierre = toRealNumber(data.matricula);

  return {
    ...prev,
    matricula: matriculaCierre ?? prev.matricula,
    matriculaAnterior: matriculaCierre ?? prev.matriculaAnterior,
    abandono_ant: abandonoAnt,
    abandono_meta: abandonoMeta,
    et_ant: etAnt,
    et_meta: etMeta,
    reprobacion_ant: reprobAnt,
    reprobacion_meta: reprobMeta,
    aprobacion_ant: aprobAnt,
    aprobacion_meta: aprobMeta,
  };
}

/**
 * Mapea la Estadística 911 de Inicio de Ciclo Actual (momento='inicio_actual').
 * Actualiza la matrícula vigente (`matricula`) sin sobreescribir el cierre (`matriculaAnterior`).
 */
export function mapInicioActualToIndicadores<T extends PmcIndicadoresAcademicos>(
  data: Estadistica911Data | undefined | null,
  prev: T
): T {
  if (!data) return prev;
  const mat = toRealNumber(data.matricula);
  return {
    ...prev,
    matricula: mat ?? prev.matricula,
  };
}

/**
 * Mapea la Estadística 911 de Inicio de Ciclo Anterior (momento='inicio_anterior').
 */
export function mapInicioAnteriorToIndicadores<T extends PmcIndicadoresAcademicos>(
  data: Estadistica911Data | undefined | null,
  prev: T
): T {
  if (!data) return prev;
  const mat = toRealNumber(data.matricula);
  return {
    ...prev,
    matricula: prev.matricula ?? mat,
  };
}
