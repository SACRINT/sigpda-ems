/**
 * src/lib/pmc/indicadores-mapping.ts
 *
 * Mapeo canónico de datos de Estadística 911 a indicadores académicos del PMC (H-165, H-168, H-220).
 *
 * Reglas Maestras (H-220 / B-001):
 * - Los % de ET y Abandono se CALCULAN determinísticamente; NO se leen del documento.
 * - Línea base = Concentrado de INICIO del MISMO ciclo (guardado en matriculaInicioCicloAnterior).
 * - Fallback = Columna "AL INICIO DEL PERIODO" del concentrado de fin (con advertencia).
 * - Subir inicio o fin en cualquier orden recalcula de inmediato y coherentemente.
 */

import { toRealNumber } from '@/lib/numeric-guard';
import type { PmcIndicadoresAcademicos } from '@/types/pmc';
import { calcularIndicadores911 } from '@/lib/concentrado-911-calculator';

export interface Estadistica911Data {
  matricula?: number | string | null;
  matriculaInicio?: number | string | null;
  matriculaInicioFinDoc?: number | string | null;
  matriculaAnterior?: number | string | null;
  altas?: number | string | null;
  bajas?: number | string | null;
  bajasDefinitivas?: number | string | null;
  existencia?: number | string | null;
  regulares?: number | string | null;
  irregulares?: number | string | null;
  totalDocentes?: number | string | null;
  [key: string]: unknown;
}

/**
 * Mapea la Estadística 911 de Fin de Ciclo Anterior (momento='fin_anterior').
 * Calcula ET y Abandono Escolar a partir de existencia y bajas.
 */
export function mapFinAnteriorToIndicadores<T extends PmcIndicadoresAcademicos>(
  data: Estadistica911Data | undefined | null,
  prev: T
): T {
  if (!data) return prev;

  const rawExistencia = toRealNumber(
    data.existencia ??
    data.existenciaFin ??
    data.matriculaFinal ??
    data.totalAlumnos ??
    data.matricula ??
    (data.regulares != null && data.irregulares != null && (Number(data.regulares) + Number(data.irregulares) > 0)
      ? Number(data.regulares) + Number(data.irregulares)
      : undefined) ??
    (data.matriculaInicio != null && data.bajas != null && Number(data.matriculaInicio) > 0
      ? Number(data.matriculaInicio) - Number(data.bajas)
      : undefined) ??
    data.matriculaInicioFinDoc ??
    data.matriculaInicio
  );

  const existencia = rawExistencia ?? prev.existenciaFin ?? prev.matriculaAnterior;
  const bajas = toRealNumber(
    data.bajas ??
    data.bajasDefinitivas ??
    (data.matriculaInicio != null && existencia != null && Number(data.matriculaInicio) > existencia
      ? Number(data.matriculaInicio) - existencia
      : 0)
  );
  const altas = toRealNumber(data.altas ?? 0);
  const matriculaInicioFinDoc = toRealNumber(
    data.matriculaInicioFinDoc ??
    data.matriculaInicio ??
    (existencia != null ? existencia + (bajas ?? 0) : undefined)
  );

  const calc = calcularIndicadores911({
    existenciaFin: existencia,
    bajas,
    matriculaInicio: prev.matriculaInicioCicloAnterior,
    matriculaInicioFinDoc,
  });

  const etAnt = calc.eficienciaTerminal ?? undefined;
  const abAnt = calc.abandono ?? undefined;

  // Metas sugeridas (reglas oficiales):
  // et_meta = min(100, et_ant + 5)
  // abandono_meta = max(0, abandono_ant - 1.5)
  const etMeta = prev.et_meta !== undefined
    ? prev.et_meta
    : (etAnt !== undefined ? Math.min(100, Number((etAnt + 5).toFixed(1))) : undefined);

  const abMeta = prev.abandono_meta !== undefined
    ? prev.abandono_meta
    : (abAnt !== undefined ? Math.max(0, Number((abAnt - 1.5).toFixed(1))) : undefined);

  const next: T = {
    ...prev,
    matriculaAnterior: existencia ?? prev.matriculaAnterior,
    existenciaFin: existencia ?? prev.existenciaFin,
    altas: altas ?? prev.altas,
    bajasDefinitivas: bajas ?? prev.bajasDefinitivas,
    bajas: bajas ?? prev.bajas,
    et_ant: etAnt,
    et_meta: etMeta,
    abandono_ant: abAnt,
    abandono_meta: abMeta,
    baselineWarning: calc.warning,
  };

  if (calc.eficienciaTerminal !== null || calc.abandono !== null) {
    const fecha = new Date().toISOString();
    const fuentes = calc.fuenteBaseline === '911_inicio' ? ['911_inicio', '911_fin'] : ['911_fin'];
    next._calc = {
      ...(next._calc || {}),
      et: {
        valor: calc.eficienciaTerminal,
        formula: calc.formulaEt || '',
        fuentes,
        fecha,
      },
      abandono: {
        valor: calc.abandono,
        formula: calc.formulaAbandono || '',
        fuentes,
        fecha,
      },
    };
  }

  return next;
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
  const mat = toRealNumber(data.matriculaInicio ?? data.matricula);
  return {
    ...prev,
    matricula: mat ?? prev.matricula,
  };
}

/**
 * Mapea la Estadística 911 de Inicio de Ciclo Anterior (momento='inicio_anterior').
 * Guarda la matrícula de inicio en `matriculaInicioCicloAnterior` y recalcula ET y Abandono.
 */
export function mapInicioAnteriorToIndicadores<T extends PmcIndicadoresAcademicos>(
  data: Estadistica911Data | undefined | null,
  prev: T
): T {
  if (!data) return prev;
  const matInicio = toRealNumber(data.matriculaInicio ?? data.matricula);

  const next: T = {
    ...prev,
    matriculaInicioCicloAnterior: matInicio ?? prev.matriculaInicioCicloAnterior,
  };

  // Recalcular ET y abandono si ya se tiene existenciaFin del fin de cursos
  const existencia = next.existenciaFin ?? next.matriculaAnterior;
  const baseline = next.matriculaInicioCicloAnterior;
  if (existencia && baseline) {
    const calc = calcularIndicadores911({
      existenciaFin: existencia,
      bajas: next.bajasDefinitivas ?? next.bajas,
      matriculaInicio: baseline,
    });
    next.baselineWarning = calc.warning;
    if (calc.eficienciaTerminal !== null) {
      next.et_ant = calc.eficienciaTerminal;
      next.et_meta = prev.et_meta !== undefined ? prev.et_meta : Math.min(100, Number((calc.eficienciaTerminal + 5).toFixed(1)));
    }
    if (calc.abandono !== null) {
      next.abandono_ant = calc.abandono;
      next.abandono_meta = prev.abandono_meta !== undefined ? prev.abandono_meta : Math.max(0, Number((calc.abandono - 1.5).toFixed(1)));
    }
    const fecha = new Date().toISOString();
    next._calc = {
      ...(next._calc || {}),
      et: {
        valor: calc.eficienciaTerminal,
        formula: calc.formulaEt || '',
        fuentes: ['911_inicio', '911_fin'],
        fecha,
      },
      abandono: {
        valor: calc.abandono,
        formula: calc.formulaAbandono || '',
        fuentes: ['911_inicio', '911_fin'],
        fecha,
      },
    };
  }

  return next;
}
