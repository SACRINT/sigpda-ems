import { describe, it, expect } from 'vitest';
import { calculatePmcIndicatorRows, isRealNumeric } from '@/lib/pmc-indicator-calculator';
import type { PmcStatisticalContext } from '@/types/pmc';

describe('C6: Characterization tests para Indicadores PMC (pmc-indicator-calculator)', () => {
  it('isRealNumeric valida correctamente 0 real, enteros, floats y rechaza null/undefined/vacíos', () => {
    expect(isRealNumeric(0)).toBe(true);
    expect(isRealNumeric('0')).toBe(true);
    expect(isRealNumeric(95.5)).toBe(true);
    expect(isRealNumeric('88.4')).toBe(true);

    expect(isRealNumeric(null)).toBe(false);
    expect(isRealNumeric(undefined)).toBe(false);
    expect(isRealNumeric('')).toBe(false);
    expect(isRealNumeric('   ')).toBe(false);
    expect(isRealNumeric(NaN)).toBe(false);
    expect(isRealNumeric('abc')).toBe(false);
  });

  it('calcula filas con datos completos sin ningún NaN% y con variaciones coherentes', () => {
    const indicadores = {
      matricula: 240,
      aprobacion_ant: 85.5,
      aprobacion_meta: 90.0,
      reprobacion_ant: 14.5,
      reprobacion_meta: 10.0,
      abandono_ant: 6.2,
      abandono_meta: 4.0,
      et_ant: 82.0,
      et_meta: 88.0,
    };

    const rows = calculatePmcIndicatorRows(indicadores, null, '2025-2026');
    expect(rows).toHaveLength(5);

    // Fila 0: Aprobación
    expect(rows[0][0]).toBe('Tasa de Aprobación Escolar (F11C)');
    expect(rows[0][1]).toBe('85.5%');
    expect(rows[0][2]).toBe('90.0%');
    expect(rows[0][3]).toBe('+4.5% Mejora');

    // Fila 1: Reprobación
    expect(rows[1][0]).toBe('Índice de Reprobación Escolar (F11C)');
    expect(rows[1][1]).toBe('14.5%');
    expect(rows[1][2]).toBe('10.0%');
    expect(rows[1][3]).toBe('-4.5% Reducción');

    // Fila 2: Abandono
    expect(rows[2][0]).toBe('Abandono Escolar / Deserción (911.7)');
    expect(rows[2][1]).toBe('6.2%');
    expect(rows[2][2]).toBe('4.0%');
    expect(rows[2][3]).toBe('-2.2% Retención');

    // Fila 3: Eficiencia Terminal
    expect(rows[3][0]).toBe('Eficiencia Terminal / Egreso (911.7G)');
    expect(rows[3][1]).toBe('82.0%');
    expect(rows[3][2]).toBe('88.0%');
    expect(rows[3][3]).toBe('+6.0% Graduación');

    // Fila 4: Matrícula
    expect(rows[4][0]).toBe('Matrícula Escolar Oficial (911.7G)');
    expect(rows[4][1]).toBe('240 estudiantes');
    expect(rows[4][2]).toBe('240 estudiantes');
    expect(rows[4][3]).toBe('Sostenimiento');

    // Invariante general: NINGÚN string debe contener "NaN"
    for (const row of rows) {
      for (const cell of row) {
        if (typeof cell === 'string') {
          expect(cell).not.toContain('NaN');
        }
      }
    }
  });

  it('maneja valores null o ausentes devolviendo "N/D" y jamás inventa meta +5 ni produce NaN', () => {
    const indicadoresNulos = {
      matricula: null,
      aprobacion_ant: null,
      aprobacion_meta: null,
      reprobacion_ant: null,
      reprobacion_meta: null,
      abandono_ant: null,
      abandono_meta: null,
      et_ant: null,
      et_meta: null,
    };

    const rows = calculatePmcIndicatorRows(indicadoresNulos, null);
    expect(rows).toHaveLength(5);

    // Aprobación debe ser N/D en todas las celdas de datos
    expect(rows[0][1]).toBe('N/D');
    expect(rows[0][2]).toBe('N/D');
    expect(rows[0][3]).toBe('N/D');

    // Reprobación
    expect(rows[1][1]).toBe('N/D');
    expect(rows[1][2]).toBe('N/D');
    expect(rows[1][3]).toBe('N/D');

    // Abandono
    expect(rows[2][1]).toBe('N/D');
    expect(rows[2][2]).toBe('N/D');
    expect(rows[2][3]).toBe('N/D');

    // Eficiencia terminal
    expect(rows[3][1]).toBe('N/D');
    expect(rows[3][2]).toBe('N/D');
    expect(rows[3][3]).toBe('N/D');

    // Matrícula
    expect(rows[4][1]).toBe('N/D');
    expect(rows[4][2]).toBe('N/D');
    expect(rows[4][3]).toBe('N/D');

    // Invariante de seguridad
    for (const row of rows) {
      for (const cell of row) {
        if (typeof cell === 'string') {
          expect(cell).not.toContain('NaN');
        }
      }
    }
  });

  it('respeta el 0 real legítimo sin convertirlo en "N/D" (G-002)', () => {
    const indicadoresConCero = {
      matricula: 120,
      aprobacion_ant: 100,
      aprobacion_meta: 100,
      reprobacion_ant: 0, // Cero real legítimo
      reprobacion_meta: 0,
      abandono_ant: 0,    // Cero real legítimo
      abandono_meta: 0,
      et_ant: 95,
      et_meta: 98,
    };

    const rows = calculatePmcIndicatorRows(indicadoresConCero, null);

    // Reprobación 0.0%
    expect(rows[1][1]).toBe('0.0%');
    expect(rows[1][2]).toBe('0.0%');
    expect(rows[1][3]).toBe('0.0% Reducción');

    // Abandono 0.0%
    expect(rows[2][1]).toBe('0.0%');
    expect(rows[2][2]).toBe('0.0%');
    expect(rows[2][3]).toBe('0.0% Retención');
  });

  it('maneja valores extremos (100% y matrículas altas) manteniendo consistencia', () => {
    const indicadoresExtremos = {
      matricula: 2500,
      aprobacion_ant: 100,
      aprobacion_meta: 100,
      reprobacion_ant: 0,
      reprobacion_meta: 0,
      abandono_ant: 1.2,
      abandono_meta: 0.5,
      et_ant: 99.5,
      et_meta: 100,
    };

    const rows = calculatePmcIndicatorRows(indicadoresExtremos, null);
    expect(rows[0][1]).toBe('100.0%');
    expect(rows[0][2]).toBe('100.0%');
    expect(rows[0][3]).toBe('+0.0% Mejora');
    expect(rows[4][1]).toBe('2500 estudiantes');
  });

  it('incorpora fila de Promedio F11 y comparativo de Zona Escolar cuando están en el contexto', () => {
    const statsContext: PmcStatisticalContext = {
      fuente: 'formato_f11',
      parsedAt: '2026-09-24T12:00:00.000Z',
      plantel: {
        cct: '21EBH0465E',
        nombre: 'Bachillerato Moisés Sáenz Garza',
        turno: 'Matutino',
        matricula: 180,
        eficienciaTerminal: 84.5,
        abandono: 5.1,
        reprobacion: 12.3,
        promedioGeneral: 8.42,
        promediosPorAsignatura: {},
        aprobadosPorcentaje: 87.7,
        reprobadosPorcentaje: 12.3,
      },
      zona: {
        zonaNumero: '013',
        totalPlanteles: 12,
        matriculaTotal: 2150,
        promedioAbandono: 6.8,
        promedioEficiencia: 81.2,
        promedioReprobacion: 14.1,
        brechasDiagnostico: {
          brechaAbandonoVsZona: 1.7,
          brechaEficienciaVsZona: 3.3,
          brechaReprobacionVsZona: -2.1,
          prioridadIntervencion: 'alta',
          observaciones: ['Atención focalizada'],
        },
      },
    };

    const rows = calculatePmcIndicatorRows({}, statsContext);
    expect(rows.length).toBe(7); // 5 base + 1 promedio F11 + 1 zona

    // Fila 5: Promedio
    expect(rows[5][0]).toBe('Promedio General de Calificaciones (F11C)');
    expect(rows[5][1]).toBe('8.42');
    expect(rows[5][2]).toBe('8.92');
    expect(rows[5][3]).toBe('+0.50 Aprovechamiento');

    // Fila 6: Zona comparativa
    const zonaCell = rows[6][0];
    expect(typeof zonaCell).toBe('object');
    if (typeof zonaCell === 'object' && 'content' in zonaCell) {
      expect(zonaCell.content).toContain('Comparativo de Zona Escolar (013)');
      expect(zonaCell.content).toContain('Media Abandono 6.8%');
      expect(zonaCell.content).toContain('(Prioridad: ALTA)');
    }
  });
});
