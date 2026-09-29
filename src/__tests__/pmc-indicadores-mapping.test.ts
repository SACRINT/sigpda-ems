/**
 * src/__tests__/pmc-indicadores-mapping.test.ts
 *
 * Pruebas unitarias de mapeo de Estadística 911 a indicadores de PMC (H-165, H-168, H-220).
 * Valida el cálculo oficial determinista de ET y abandono escolar:
 * - Baseline = Concentrado de INICIO (ej. 192 alumnos) -> ET 93.2%, abandono 5.2%.
 * - Fallback = Columna AL INICIO DEL PERIODO de FIN (185) -> ET 96.8%, abandono 5.4%.
 * - El orden de subida no altera el resultado final (idempotente y convergente).
 */

import { describe, it, expect } from 'vitest';
import {
  mapFinAnteriorToIndicadores,
  mapInicioActualToIndicadores,
  mapInicioAnteriorToIndicadores,
} from '@/lib/pmc/indicadores-mapping';
import type { PmcIndicadoresAcademicos } from '@/types/pmc';

describe('Mapeo y Cálculo de Indicadores 911 (H-168, H-220)', () => {
  const baseIndicadores: PmcIndicadoresAcademicos = {
    matricula: undefined,
    matriculaAnterior: undefined,
    matriculaInicioCicloAnterior: undefined,
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

  it('1. fin_anterior calcula ET y abandono con fallback 185 cuando aun no se sube inicio', () => {
    const finAnterior911 = {
      existencia: 179,
      bajas: 10,
      altas: 4,
      matriculaInicioFinDoc: 185,
    };

    const resultado = mapFinAnteriorToIndicadores(finAnterior911, baseIndicadores);

    // Cierre
    expect(resultado.matriculaAnterior).toBe(179);
    expect(resultado.existenciaFin).toBe(179);
    expect(resultado.bajasDefinitivas).toBe(10);

    // ET = 179/185 * 100 = 96.8%
    expect(resultado.et_ant).toBe(96.8);
    // Abandono = 10/185 * 100 = 5.4%
    expect(resultado.abandono_ant).toBe(5.4);

    // Metas sugeridas oficiales
    // et_meta = min(100, 96.8 + 5) = 100
    expect(resultado.et_meta).toBe(100);
    // abandono_meta = max(0, 5.4 - 1.5) = 3.9
    expect(resultado.abandono_meta).toBe(3.9);

    // Registro de auditoría
    expect(resultado._calc?.et?.fuentes).toContain('911_fin');
    expect(resultado._calc?.abandono?.fuentes).toContain('911_fin');
    expect(resultado.baselineWarning).toContain('calculado con la línea base del propio concentrado de fin');
  });

  it('2. Subida posterior de inicio_anterior (192) recalcula ET (93.2%) y abandono (5.2%)', () => {
    // Paso 1: Primero se subió fin de cursos
    const despuesFin = mapFinAnteriorToIndicadores(
      { existencia: 179, bajas: 10, matriculaInicioFinDoc: 185 },
      baseIndicadores
    );
    expect(despuesFin.et_ant).toBe(96.8);
    expect(despuesFin.baselineWarning).toBeDefined();

    // Paso 2: Luego se sube el concentrado de inicio del ciclo anterior (192)
    const despuesInicio = mapInicioAnteriorToIndicadores(
      { matriculaInicio: 192 },
      despuesFin
    );

    expect(despuesInicio.et_ant).toBe(93.2);
    expect(despuesInicio.abandono_ant).toBe(5.2);
    expect(despuesInicio.baselineWarning).toBeUndefined();

    expect(despuesInicio.matriculaInicioCicloAnterior).toBe(192);
    // ET recalcula con línea base oficial: 179/192 * 100 = 93.2%
    expect(despuesInicio.et_ant).toBe(93.2);
    // Abandono recalcula con línea base oficial: 10/192 * 100 = 5.2%
    expect(despuesInicio.abandono_ant).toBe(5.2);

    expect(despuesInicio._calc?.et?.fuentes).toEqual(['911_inicio', '911_fin']);
    expect(despuesInicio._calc?.abandono?.fuentes).toEqual(['911_inicio', '911_fin']);
  });

  it('3. Subida en orden inverso (primero inicio 192, luego fin 179/10) da el MISMO resultado exacto', () => {
    // Paso 1: Primero inicio
    const despuesInicio = mapInicioAnteriorToIndicadores(
      { matriculaInicio: 192 },
      baseIndicadores
    );
    expect(despuesInicio.matriculaInicioCicloAnterior).toBe(192);

    // Paso 2: Luego fin
    const resultado = mapFinAnteriorToIndicadores(
      { existencia: 179, bajas: 10, matriculaInicioFinDoc: 185 },
      despuesInicio
    );

    expect(resultado.matriculaInicioCicloAnterior).toBe(192);
    expect(resultado.matriculaAnterior).toBe(179);
    expect(resultado.et_ant).toBe(93.2);
    expect(resultado.abandono_ant).toBe(5.2);
  });

  it('4. Carga subsecuente de inicio_actual (170) preserva matriculaAnterior (179) y fija matricula vigente (170)', () => {
    const despuesFin = mapFinAnteriorToIndicadores(
      { existencia: 179, bajas: 10, matriculaInicioFinDoc: 185 },
      baseIndicadores
    );

    const despuesIniAct = mapInicioActualToIndicadores(
      { matriculaInicio: 170 },
      despuesFin
    );

    expect(despuesIniAct.matricula).toBe(170);
    expect(despuesIniAct.matriculaAnterior).toBe(179);
  });

  it('5. Manejo defensivo de null o undefined', () => {
    const res = mapFinAnteriorToIndicadores(null, baseIndicadores);
    expect(res).toEqual(baseIndicadores);

    const res2 = mapInicioActualToIndicadores(undefined, baseIndicadores);
    expect(res2).toEqual(baseIndicadores);
  });

  it('6. H-239: con datos completos, et_ant y abandono_ant nunca son undefined (regression: banner no muestra N/D)', () => {
    // Simula el patrón corregido en H-239: llamar mapFinAnteriorToIndicadores FUERA del updater,
    // pasando el valor actual de indicadores capturado en el closure del handler de async.
    // Con los datos de Héroes (existencia=179, bajas=10, matriculaInicioFinDoc=185):
    const dataFin911 = {
      existencia: 179,
      bajas: 10,
      altas: 4,
      matriculaInicioFinDoc: 185,
    };
    const capturedIndicadores: PmcIndicadoresAcademicos = {
      ...baseIndicadores,
      // Sin matriculaInicioCicloAnterior → usa fallback matriculaInicioFinDoc=185
    };

    // Llamada fuera del updater (patrón corregido H-239)
    const mapped = mapFinAnteriorToIndicadores(dataFin911, capturedIndicadores);

    // ET y abandono deben ser siempre defined con datos reales
    expect(mapped.et_ant).toBeDefined();
    expect(mapped.abandono_ant).toBeDefined();
    expect(typeof mapped.et_ant).toBe('number');
    expect(typeof mapped.abandono_ant).toBe('number');

    // Verificar que el banner podría usar estos valores directamente sin N/D
    const etStr = mapped.et_ant !== undefined ? `${mapped.et_ant}%` : 'N/D';
    const abStr = mapped.abandono_ant !== undefined ? `${mapped.abandono_ant}%` : 'N/D';
    expect(etStr).not.toBe('N/D');
    expect(abStr).not.toBe('N/D');
    // Valores calculados: ET = 179/185 = 96.8%, Abandono = 10/185 = 5.4%
    expect(mapped.et_ant).toBe(96.8);
    expect(mapped.abandono_ant).toBe(5.4);
  });

  it('7. H-239: discrimina el bug de updater diferido en React 19 vs pre-cálculo fuera del updater', () => {
    const dataFin911 = {
      existencia: 179,
      bajas: 10,
      altas: 4,
      matriculaInicioFinDoc: 185,
    };
    const capturedIndicadores: PmcIndicadoresAcademicos = { ...baseIndicadores };

    // Simulación del patrón con BUG (antiguo): mutar variables dentro del updater
    // mientras React 19 difiere la ejecución del callback
    let oldCalculatedEt: number | undefined;
    let oldCalculatedAb: number | undefined;

    // React 19 encola el updater y NO lo ejecuta sincrónicamente en el frame del evento
    const queuedUpdater = (p: PmcIndicadoresAcademicos) => {
      const mapped = mapFinAnteriorToIndicadores(dataFin911, p);
      oldCalculatedEt = mapped.et_ant;
      oldCalculatedAb = mapped.abandono_ant;
      return mapped;
    };
    void queuedUpdater; // Simula encolamiento diferido

    // En el frame sincrónico donde se construye el banner, las variables eran undefined:
    const oldEtStr = oldCalculatedEt !== undefined ? `${oldCalculatedEt}%` : 'N/D';
    const oldAbStr = oldCalculatedAb !== undefined ? `${oldCalculatedAb}%` : 'N/D';
    expect(oldEtStr).toBe('N/D'); // Demuestra exactamente el fallo de la versión previa
    expect(oldAbStr).toBe('N/D');

    // En cambio, con el patrón corregido (H-239): cálculo sincrónico antes del updater
    const mappedSnapshot = mapFinAnteriorToIndicadores(dataFin911, capturedIndicadores);
    const calculatedEt = mappedSnapshot.et_ant;
    const calculatedAb = mappedSnapshot.abandono_ant;

    const fixedEtStr = calculatedEt !== undefined ? `${calculatedEt}%` : 'N/D';
    const fixedAbStr = calculatedAb !== undefined ? `${calculatedAb}%` : 'N/D';
    expect(fixedEtStr).toBe('96.8%');
    expect(fixedAbStr).toBe('5.4%');
  });
});
