/**
 * src/__tests__/pmc-indicadores-mapping.test.ts
 *
 * Pruebas unitarias de mapeo de Estadística 911 a indicadores de PMC (H-165, H-168).
 * Valida que la matrícula de cierre de ciclo anterior se extraiga de data.matricula en fin_anterior,
 * y que inicio_actual no pise dicho cierre histórico.
 */

import { describe, it, expect } from 'vitest';
import {
  mapFinAnteriorToIndicadores,
  mapInicioActualToIndicadores,
  mapInicioAnteriorToIndicadores,
} from '@/lib/pmc/indicadores-mapping';
import type { PmcIndicadoresAcademicos } from '@/types/pmc';

describe('Mapeo de Indicadores 911 (H-168)', () => {
  const baseIndicadores: PmcIndicadoresAcademicos = {
    matricula: undefined,
    matriculaAnterior: undefined,
    matricula_meta: undefined,
    aprobacion_ant: undefined,
    aprobacion_meta: undefined,
    reprobacion_ant: undefined,
    reprobacion_meta: undefined,
    abandono_ant: undefined,
    abandono_meta: undefined,
    et_ant: undefined,
    et_meta: undefined,
  };

  it('1. fin_anterior mapea data.matricula a matriculaAnterior (cierre de ciclo real 81)', () => {
    const finAnterior911 = {
      matricula: 81, // Cierre del ciclo escolar 2025-2026
      matriculaAnterior: 70, // Ciclo 2024-2025 (columna comparativa histórica en el 911)
      abandonoPorcentaje: 5.5,
      eficienciaTerminal: 85.0,
      reprobacionPorcentaje: 10.0,
      aprobacionPorcentaje: 90.0,
    };

    const resultado = mapFinAnteriorToIndicadores(finAnterior911, baseIndicadores);

    // H-168: Debe ser 81 (el cierre del ciclo del documento), NUNCA 70
    expect(resultado.matriculaAnterior).toBe(81);
    expect(resultado.matriculaAnterior).not.toBe(70);

    // Indicadores académicos y metas derivadas
    expect(resultado.abandono_ant).toBe(5.5);
    expect(resultado.abandono_meta).toBe(4.0); // 5.5 - 1.5
    expect(resultado.et_ant).toBe(85.0);
    expect(resultado.et_meta).toBe(87.0); // 85.0 + 2.0
    expect(resultado.reprobacion_ant).toBe(10.0);
    expect(resultado.reprobacion_meta).toBe(8.0); // 10.0 - 2.0
    expect(resultado.aprobacion_ant).toBe(90.0);
    expect(resultado.aprobacion_meta).toBe(92.0); // 90.0 + 2.0
  });

  it('2. Carga subsecuente de inicio_actual (75 alumnos) NO pisa matriculaAnterior (81)', () => {
    // Paso 1: Se carga fin de ciclo anterior (81 alumnos)
    const despuesFinAnt = mapFinAnteriorToIndicadores(
      { matricula: 81 },
      baseIndicadores
    );
    expect(despuesFinAnt.matriculaAnterior).toBe(81);
    expect(despuesFinAnt.matricula).toBe(81);

    // Paso 2: Se carga inicio de ciclo actual (75 alumnos inscritos a agosto)
    const despuesIniAct = mapInicioActualToIndicadores(
      { matricula: 75 },
      despuesFinAnt
    );

    // La matrícula vigente ahora es 75
    expect(despuesIniAct.matricula).toBe(75);
    // Pero la línea base histórica del cierre anterior SIGUE SIENDO 81
    expect(despuesIniAct.matriculaAnterior).toBe(81);
  });

  it('3. fin_anterior sin data.matriculaAnterior sigue asignando correctamente el cierre', () => {
    const finAnteriorSinComparativa = {
      matricula: 95,
      // matriculaAnterior no viene en el 911
    };

    const resultado = mapFinAnteriorToIndicadores(finAnteriorSinComparativa, baseIndicadores);
    expect(resultado.matriculaAnterior).toBe(95);
  });

  it('4. inicio_anterior asigna matrícula inicial sin alterar metas ni matrícula anterior', () => {
    const res = mapInicioAnteriorToIndicadores({ matricula: 78 }, baseIndicadores);
    expect(res.matricula).toBe(78);
    expect(res.matriculaAnterior).toBeUndefined();
  });

  it('5. Manejo defensivo de null o undefined', () => {
    const res = mapFinAnteriorToIndicadores(null, baseIndicadores);
    expect(res).toEqual(baseIndicadores);

    const res2 = mapInicioActualToIndicadores(undefined, baseIndicadores);
    expect(res2).toEqual(baseIndicadores);
  });
});
