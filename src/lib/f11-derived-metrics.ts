/**
 * src/lib/f11-derived-metrics.ts
 *
 * Módulo de funciones puras para derivación de métricas consolidadas de Formato 11 (F11).
 * Única fuente de verdad (Single Source of Truth) para promedio general y estadísticas
 * compartidas entre el parser determinista (layout PDF) y la ruta OCR/IA de respaldo.
 * (H-269 / H-266).
 */

export interface AlumnoF11Input {
  curp?: string;
  nombre?: string;
  grupo?: string;
  clase?: 'REGULAR' | 'IRREGULAR' | 'REPROBADO' | 'BAJA' | string | null;
  promedio?: string | number | null;
  promedioGeneral?: string | number | null;
}

/**
 * Calcula el promedio general del F11 con base en los alumnos regulares que cuentan
 * con promedio numérico válido.
 * 
 * Reglas canónicas (idénticas entre ruta determinista y OCR):
 * 1. Filtra alumnos cuya situación escolar sea 'REGULAR' (o sin clase explícita pero con promedio).
 * 2. Excluye explícitamente alumnos 'BAJA', 'IRREGULAR' o 'REPROBADO'.
 * 3. Valida que el promedio sea un número finito y estrictamente positivo (> 0).
 * 4. Calcula la media aritmética redondeada a 1 decimal.
 * 5. Si no hay alumnos regulares con promedio válido, retorna null.
 */
export function calcularPromedioGeneralF11(
  alumnos: AlumnoF11Input[]
): number | null {
  if (!Array.isArray(alumnos) || alumnos.length === 0) {
    return null;
  }

  const alumnosConPromedio = alumnos.filter(a => {
    // Si tiene clase definida, debe ser REGULAR
    if (a.clase && a.clase !== 'REGULAR') {
      return false;
    }
    const val = a.promedioGeneral !== undefined && a.promedioGeneral !== null && a.promedioGeneral !== ''
      ? a.promedioGeneral
      : a.promedio;

    if (val === undefined || val === null || val === '') {
      return false;
    }
    const num = Number(val);
    return !isNaN(num) && isFinite(num) && num > 0;
  });

  if (alumnosConPromedio.length === 0) {
    return null;
  }

  const sum = alumnosConPromedio.reduce((acc, a) => {
    const val = a.promedioGeneral !== undefined && a.promedioGeneral !== null && a.promedioGeneral !== ''
      ? a.promedioGeneral
      : a.promedio;
    return acc + Number(val);
  }, 0);

  return Number((sum / alumnosConPromedio.length).toFixed(1));
}
