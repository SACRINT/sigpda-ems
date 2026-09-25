import { describe, it, expect } from 'vitest';
import { calculatePmcIndicatorRows } from '@/lib/pmc-indicator-calculator';
import { getPmcDocxIndicatorValues, type PmcProject } from '@/lib/pmc-docx-generator';
import type { PmcStatisticalContext } from '@/types/pmc';

describe('B-03 Guarda de regresión de doble verdad: Paridad PDF vs DOCX', () => {
  function createPmcProjectFixture(
    indicadores: unknown,
    statisticalContext?: PmcStatisticalContext | null
  ): PmcProject {
    return {
      id: 'proj-parity-test-123',
      school_name: 'Bachillerato Digital Núm. 45',
      school_cct: '21EBH0045A',
      ciclo_escolar: '2025-2026',
      indicadores_academicos: typeof indicadores === 'string' ? indicadores : JSON.stringify(indicadores),
      statistical_context: (statisticalContext ?? undefined) as PmcStatisticalContext | undefined,
    };
  }

  // ── ESCENARIO 1: COMPLETOS ───────────────────────────────────────────────
  it('Escenario 1 (Completos): Paridad idéntica celda a celda entre PDF y DOCX con datos íntegros', () => {
    const rawIndicadores = {
      aprobacion_ant: 85.5,
      aprobacion_meta: 90.0,
      reprobacion_ant: 14.5,
      reprobacion_meta: 10.0,
      abandono_ant: 6.2,
      abandono_meta: 4.0,
      et_ant: 82.0,
      et_meta: 88.0,
      matricula: 240,
      matricula_meta: 250,
      promedio_f11: 8.4,
      promedio_meta: 8.8,
    };
    const statisticalContext: PmcStatisticalContext = {
      fuente: 'matriz_combinada_excel',
      parsedAt: new Date().toISOString(),
      plantel: {
        cct: '21EBH0045A',
        nombre: 'Bachillerato Digital Núm. 45',
        turno: 'MATUTINO',
        matricula: 240,
        aprobadosPorcentaje: 85.5,
        reprobadosPorcentaje: 14.5,
        reprobacion: 14.5,
        abandono: 6.2,
        eficienciaTerminal: 82.0,
        promedioGeneral: 8.4,
        promediosPorAsignatura: {},
      },
    };

    const project = createPmcProjectFixture(rawIndicadores, statisticalContext);

    const pdfRows = calculatePmcIndicatorRows(rawIndicadores, statisticalContext);
    const docxVals = getPmcDocxIndicatorValues(project);

    // Fila Aprobación
    expect(pdfRows[0][1]).toBe(docxVals.aprobacion.ant);
    expect(pdfRows[0][2]).toBe(docxVals.aprobacion.meta);
    expect(docxVals.aprobacion.ant).toBe('85.5%');
    expect(docxVals.aprobacion.meta).toBe('90.0%');

    // Fila Reprobación
    expect(pdfRows[1][1]).toBe(docxVals.reprobacion.ant);
    expect(pdfRows[1][2]).toBe(docxVals.reprobacion.meta);
    expect(docxVals.reprobacion.ant).toBe('14.5%');
    expect(docxVals.reprobacion.meta).toBe('10.0%');

    // Fila Abandono
    expect(pdfRows[2][1]).toBe(docxVals.abandono.ant);
    expect(pdfRows[2][2]).toBe(docxVals.abandono.meta);
    expect(docxVals.abandono.ant).toBe('6.2%');
    expect(docxVals.abandono.meta).toBe('4.0%');

    // Fila Eficiencia Terminal
    expect(pdfRows[3][1]).toBe(docxVals.eficiencia.ant);
    expect(pdfRows[3][2]).toBe(docxVals.eficiencia.meta);
    expect(docxVals.eficiencia.ant).toBe('82.0%');
    expect(docxVals.eficiencia.meta).toBe('88.0%');

    // Fila Matrícula
    expect(pdfRows[4][1]).toBe(docxVals.matricula.ant);
    expect(pdfRows[4][2]).toBe(docxVals.matricula.meta);
    expect(docxVals.matricula.ant).toBe('240 estudiantes');
    expect(docxVals.matricula.meta).toBe('250 estudiantes');
  });

  // ── ESCENARIO 2: VACÍO / NULO ─────────────────────────────────────────────
  it('Escenario 2 (Vacío): Muestra idéntico N/D en todas las celdas sin datos fantasma', () => {
    const rawIndicadores = {};
    const project = createPmcProjectFixture(rawIndicadores, null);

    const pdfRows = calculatePmcIndicatorRows(rawIndicadores, null);
    const docxVals = getPmcDocxIndicatorValues(project);

    // Todos los campos deben ser 'N/D'
    for (let r = 0; r < 5; r++) {
      expect(pdfRows[r][1]).toBe('N/D');
      expect(pdfRows[r][2]).toBe('N/D');
    }

    expect(docxVals.aprobacion.ant).toBe('N/D');
    expect(docxVals.aprobacion.meta).toBe('N/D');
    expect(docxVals.reprobacion.ant).toBe('N/D');
    expect(docxVals.reprobacion.meta).toBe('N/D');
    expect(docxVals.abandono.ant).toBe('N/D');
    expect(docxVals.abandono.meta).toBe('N/D');
    expect(docxVals.eficiencia.ant).toBe('N/D');
    expect(docxVals.eficiencia.meta).toBe('N/D');
    expect(docxVals.matricula.ant).toBe('N/D');
    expect(docxVals.matricula.meta).toBe('N/D');

    // Paridad celda a celda
    expect(pdfRows[0][1]).toBe(docxVals.aprobacion.ant);
    expect(pdfRows[0][2]).toBe(docxVals.aprobacion.meta);
    expect(pdfRows[1][1]).toBe(docxVals.reprobacion.ant);
    expect(pdfRows[1][2]).toBe(docxVals.reprobacion.meta);
    expect(pdfRows[2][1]).toBe(docxVals.abandono.ant);
    expect(pdfRows[2][2]).toBe(docxVals.abandono.meta);
    expect(pdfRows[3][1]).toBe(docxVals.eficiencia.ant);
    expect(pdfRows[3][2]).toBe(docxVals.eficiencia.meta);
    expect(pdfRows[4][1]).toBe(docxVals.matricula.ant);
    expect(pdfRows[4][2]).toBe(docxVals.matricula.meta);
  });

  // ── ESCENARIO 3: 0 REALES ────────────────────────────────────────────────
  it('Escenario 3 (0 reales): Conserva valores 0.0% legítimos sin degradar a N/D en PDF ni DOCX', () => {
    const rawIndicadores = {
      reprobacion_ant: 0,
      reprobacion_meta: 0,
      abandono_ant: 0,
      abandono_meta: 0,
      aprobacion_ant: 100,
      aprobacion_meta: 100,
      et_ant: 100,
      et_meta: 100,
      matricula: 120,
    };
    const project = createPmcProjectFixture(rawIndicadores, null);

    const pdfRows = calculatePmcIndicatorRows(rawIndicadores, null);
    const docxVals = getPmcDocxIndicatorValues(project);

    // Reprobación 0 legítimo
    expect(pdfRows[1][1]).toBe('0.0%');
    expect(pdfRows[1][2]).toBe('0.0%');
    expect(docxVals.reprobacion.ant).toBe('0.0%');
    expect(docxVals.reprobacion.meta).toBe('0.0%');

    // Abandono 0 legítimo
    expect(pdfRows[2][1]).toBe('0.0%');
    expect(pdfRows[2][2]).toBe('0.0%');
    expect(docxVals.abandono.ant).toBe('0.0%');
    expect(docxVals.abandono.meta).toBe('0.0%');

    // Paridad estricta celda a celda
    expect(pdfRows[1][1]).toBe(docxVals.reprobacion.ant);
    expect(pdfRows[1][2]).toBe(docxVals.reprobacion.meta);
    expect(pdfRows[2][1]).toBe(docxVals.abandono.ant);
    expect(pdfRows[2][2]).toBe(docxVals.abandono.meta);
  });

  // ── ESCENARIO 4: PARCIALES ────────────────────────────────────────────────
  it('Escenario 4 (Parciales): Aplica misma regla de cálculo de reprobación meta complementaria y N/D en ambos', () => {
    // Solo se capturó aprobación anterior y meta, sin reprobación meta explícita
    const rawIndicadores = {
      aprobacion_ant: 80.0,
      aprobacion_meta: 85.0,
      // reprobacion_meta omitida intencionalmente -> debe calcularse como 100 - 85.0 = 15.0%
      reprobacion_ant: 20.0,
      matricula: 180,
      // abandono y eficiencia omitidos completamente
    };
    const project = createPmcProjectFixture(rawIndicadores, null);

    const pdfRows = calculatePmcIndicatorRows(rawIndicadores, null);
    const docxVals = getPmcDocxIndicatorValues(project);

    // Aprobación presente
    expect(pdfRows[0][1]).toBe('80.0%');
    expect(pdfRows[0][2]).toBe('85.0%');
    expect(pdfRows[0][1]).toBe(docxVals.aprobacion.ant);
    expect(pdfRows[0][2]).toBe(docxVals.aprobacion.meta);

    // Reprobación meta complementaria calculada idénticamente
    expect(pdfRows[1][1]).toBe('20.0%');
    expect(pdfRows[1][2]).toBe('15.0%');
    expect(pdfRows[1][1]).toBe(docxVals.reprobacion.ant);
    expect(pdfRows[1][2]).toBe(docxVals.reprobacion.meta);

    // Abandono ausente -> N/D
    expect(pdfRows[2][1]).toBe('N/D');
    expect(pdfRows[2][2]).toBe('N/D');
    expect(pdfRows[2][1]).toBe(docxVals.abandono.ant);
    expect(pdfRows[2][2]).toBe(docxVals.abandono.meta);

    // Eficiencia ausente -> N/D
    expect(pdfRows[3][1]).toBe('N/D');
    expect(pdfRows[3][2]).toBe('N/D');
    expect(pdfRows[3][1]).toBe(docxVals.eficiencia.ant);
    expect(pdfRows[3][2]).toBe(docxVals.eficiencia.meta);

    // Matrícula anterior presente, matrícula meta ausente -> N/D defensivo en ambos
    expect(pdfRows[4][1]).toBe('180 estudiantes');
    expect(pdfRows[4][2]).toBe('N/D');
    expect(pdfRows[4][1]).toBe(docxVals.matricula.ant);
    expect(pdfRows[4][2]).toBe(docxVals.matricula.meta);
  });

  // ── ESCENARIO 5: FALLBACK PROMEDIO_F11 Y PROMEDIO_META (H-026) ─────────────
  it('Escenario 5 (H-026): Fallback promedio_f11 y promedio_meta sin statistical_context se renderiza y mantiene paridad', () => {
    // Caso 5A: Con promedio_f11 y promedio_meta explícitos en indicadores_academicos
    const rawConF11 = {
      aprobacion_ant: 80.0,
      aprobacion_meta: 85.0,
      matricula: 200,
      matricula_meta: 210,
      promedio_f11: 8.1,
      promedio_meta: 8.5,
    };
    const projectA = createPmcProjectFixture(rawConF11, null);
    const pdfRowsA = calculatePmcIndicatorRows(rawConF11, null);
    const docxValsA = getPmcDocxIndicatorValues(projectA);

    expect(docxValsA.promedio).toBeDefined();
    expect(docxValsA.promedio?.ant).toBe('8.10');
    expect(docxValsA.promedio?.meta).toBe('8.50');
    expect(docxValsA.promedio?.var).toBe('+0.40 Aprovechamiento');

    const promedioRowA = pdfRowsA.find((r) => Array.isArray(r) && r[0] === 'Promedio General de Calificaciones (F11C)');
    expect(promedioRowA).toBeDefined();
    if (Array.isArray(promedioRowA)) {
      expect(promedioRowA[1]).toBe('8.10');
      expect(promedioRowA[2]).toBe('8.50');
      expect(promedioRowA[3]).toBe('+0.40 Aprovechamiento');
    }

    // Caso 5B: Con solo promedio_meta (sin F11 ni statistical context)
    const rawSoloMeta = {
      aprobacion_ant: 80.0,
      aprobacion_meta: 85.0,
      promedio_meta: 8.7,
    };
    const projectB = createPmcProjectFixture(rawSoloMeta, null);
    const pdfRowsB = calculatePmcIndicatorRows(rawSoloMeta, null);
    const docxValsB = getPmcDocxIndicatorValues(projectB);

    expect(docxValsB.promedio).toBeDefined();
    expect(docxValsB.promedio?.ant).toBe('N/D');
    expect(docxValsB.promedio?.meta).toBe('8.70');
    expect(docxValsB.promedio?.var).toBe('Aprovechamiento Proyectado');

    const promedioRowB = pdfRowsB.find((r) => Array.isArray(r) && r[0] === 'Promedio General de Calificaciones (F11C)');
    expect(promedioRowB).toBeDefined();
    if (Array.isArray(promedioRowB)) {
      expect(promedioRowB[1]).toBe('N/D');
      expect(promedioRowB[2]).toBe('8.70');
      expect(promedioRowB[3]).toBe('Aprovechamiento Proyectado');
    }
  });
});
