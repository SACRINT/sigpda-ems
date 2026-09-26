import { describe, it, expect } from 'vitest';
import { parsePmcStatistics } from '@/lib/pmc-statistics-parser';
import { parseCartografiaMatriz } from '@/lib/cartografia-parser';
import { buildZoneDiagnosticText } from '@/lib/zone-metric-format';

describe('Excel Import Engine — Formato 911.7G / F11C / Cartografía de Zona', () => {
  it('1. Parsea correctamente una matriz oficial con columnas de Formato 911.7G (Fin de Cursos)', () => {
    const mockRows911 = [
      ['SUBSECRETARÍA DE EDUCACIÓN MEDIA SUPERIOR - ESTADÍSTICA 911.7G'],
      ['ZONA ESCOLAR 004 - BACHILLERATOS GENERALES ESTATALES'],
      ['No.', 'C.C.T.', 'Nombre del Plantel', 'Turno', 'Matrícula Total', 'Egresados', 'Bajas Definitivas', 'Eficiencia Terminal (%)', 'Abandono Escolar (%)'],
      [1, '21EBH0015A', 'BGE Venustiano Carranza', 'MATUTINO', '240', '72', '12', '90.0', '5.0'],
      [2, '21EBH0020B', 'BGE Francisco Z. Mena', 'MATUTINO', '180', '45', '22', '75.0', '12.2'],
      [3, '21EBH0033C', 'BGE Pantepec', 'VESPERTINO', '150', '38', '18', '76.0', '12.0'],
      ['', 'TOTALES ZONA', '', '', '570', '155', '52', '', ''],
    ];

    const result = parsePmcStatistics(mockRows911, {
      zonaNumero: '004',
      cicloEscolar: '2026-2027',
    });

    expect(result.success).toBe(true);
    expect(result.allPlanteles.length).toBe(3);

    const p1 = result.allPlanteles[0];
    expect(p1.cct).toBe('21EBH0015A');
    expect(p1.matricula).toBe(240);
    expect(p1.egresados).toBe(72);
    expect(p1.bajasDefinitivas).toBe(12);
    expect(p1.eficienciaTerminal).toBe(90.0);
    expect(p1.abandono).toBe(5.0);

    // Verificación de promedios zonales calculados
    expect(result.zona).toBeDefined();
    expect(result.zona?.totalPlanteles).toBe(3);
    expect(result.zona?.matriculaTotal).toBe(570);
    expect(result.zona?.promedioAbandono).toBeGreaterThan(0);
    expect(result.zona?.promedioEficiencia).toBeGreaterThan(0);
  });

  it('2. Parsea correctamente una matriz oficial con columnas de Formato F11C (Control Escolar y Calificaciones)', () => {
    const mockRowsF11C = [
      ['CONCENTRADO OFICIAL DE EVALUACIONES F11C - CICLO 2026-2027'],
      ['CCT', 'Escuela', 'Turno', 'Matricula', 'Promedio Calificaciones', 'Porcentaje Aprobacion', 'Matematicas', 'Lengua y Comunicacion'],
      ['21EBH0015A', 'BGE Venustiano Carranza', 'MATUTINO', 240, 8.5, 92.0, 8.2, 8.8],
      ['21EBH0020B', 'BGE Francisco Z. Mena', 'MATUTINO', 180, 7.8, 85.0, 7.4, 8.2],
    ];

    const result = parsePmcStatistics(mockRowsF11C, {
      zonaNumero: '004',
      cicloEscolar: '2026-2027',
    });

    expect(result.success).toBe(true);
    expect(result.allPlanteles.length).toBe(2);

    const p1 = result.allPlanteles[0];
    expect(p1.promedioCalificaciones).toBe(8.5);
    expect(p1.reprobacion).toBe(8.0); // 100 - 92.0

    const p2 = result.allPlanteles[1];
    expect(p2.promedioCalificaciones).toBe(7.8);
    expect(p2.reprobacion).toBe(15.0); // 100 - 85.0
  });

  it('3. parseCartografiaMatriz estructura los Momentos 1 y 2 con capas cuantitativa y cualitativa', async () => {
    const mockRows = [
      ['CCT', 'Plantel', 'Turno', 'Matricula', 'Eficiencia Terminal', 'Abandono Escolar', 'Promedio General', 'Reprobacion'],
      ['21EBH0015A', 'Bachillerato Carranza', 'MATUTINO', 200, 92.0, 4.0, 8.6, 5.0],
      ['21EBH0020B', 'Bachillerato Mena', 'MATUTINO', 160, 70.0, 15.0, 7.2, 18.0],
    ];

    const result = await parseCartografiaMatriz(mockRows, {
      zonaNumero: '004',
      municipioSede: 'Venustiano Carranza',
      cicloEscolar: '2026-2027',
      linkDbPaec: false, // Desactivar consulta a BD en test unitario
    });

    expect(result.success).toBe(true);
    // Momento 1: Conocer
    expect(result.momento1.planteles.length).toBe(2);
    expect(result.momento1.matriculaTotalZona).toBe(360);
    expect(result.momento1.caracterizacionInicial).toContain('2 planteles');

    // Momento 2: Organizar (Capa Cuantitativa)
    expect(result.momento2.capaCuantitativa.matriculaTotal).toBe(360);
    expect(result.momento2.capaCuantitativa.promedioEficienciaZona).toBe(81); // (92 + 70)/2
    expect(result.momento2.capaCuantitativa.promedioAbandonoZona).toBe(9.5); // (4 + 15)/2
    expect(result.momento2.capaCuantitativa.plantelesAtencionPrioritaria.length).toBeGreaterThan(0);

    // Momento 2: Capa Cualitativa
    expect(result.momento2.capaCualitativa.problematicasComunes.length).toBeGreaterThan(0);
    expect(result.momento2.capaCualitativa.factoresContextuales.length).toBeGreaterThan(0);
  });

  it('4. Preserva eficienciaTerminal como undefined cuando la columna está ausente o vacía sin sintetizar egresados/matrícula (H-046)', () => {
    const mockRowsSinET = [
      ['SUBSECRETARÍA DE EDUCACIÓN MEDIA SUPERIOR - ESTADÍSTICA 911.7G'],
      ['No.', 'C.C.T.', 'Nombre del Plantel', 'Turno', 'Matrícula Total', 'Egresados', 'Bajas Definitivas'],
      [1, '21EBH0015A', 'BGE Venustiano Carranza', 'MATUTINO', '300', '85', '10'],
    ];

    const result = parsePmcStatistics(mockRowsSinET, {
      zonaNumero: '004',
      cicloEscolar: '2026-2027',
    });

    expect(result.success).toBe(true);
    expect(result.allPlanteles.length).toBe(1);

    const p1 = result.allPlanteles[0];
    expect(p1.matricula).toBe(300);
    expect(p1.egresados).toBe(85);
    // H-046: No debe recalcular (85/300)*100 = 28.33%, debe permanecer undefined
    expect(p1.eficienciaTerminal).toBeUndefined();
    // Abandono calculado basado en bajas: (10/300)*100 = 3.33%
    expect(p1.abandono).toBe(3.33);
  });

  it('5. Parsea matriz sin columna de abandono ni bajas retornando promedioAbandono undefined y diagnóstico sin "del 0%" (H-089, H-090)', () => {
    // Matriz sin columna de abandono ni bajas definitivas
    const mockRowsSinAbandono = [
      ['SUBSECRETARÍA DE EDUCACIÓN MEDIA SUPERIOR - ESTADÍSTICA 911.7G'],
      ['ZONA ESCOLAR 004 - BACHILLERATOS GENERALES ESTATALES'],
      ['No.', 'C.C.T.', 'Nombre del Plantel', 'Turno', 'Matrícula Total', 'Egresados', 'Eficiencia Terminal (%)'],
      [1, '21EBH0015A', 'BGE Venustiano Carranza', 'MATUTINO', '240', '72', '90.0'],
      [2, '21EBH0020B', 'BGE Francisco Z. Mena', 'MATUTINO', '180', '45', '75.0'],
    ];

    const result = parsePmcStatistics(mockRowsSinAbandono, {
      zonaNumero: '004',
      cicloEscolar: '2026-2027',
    });

    expect(result.success).toBe(true);
    expect(result.allPlanteles[0].abandono).toBeUndefined();
    expect(result.allPlanteles[1].abandono).toBeUndefined();
    expect(result.zona?.promedioAbandono).toBeUndefined();

    // Línea base construida con la función real no contiene "del 0%"
    const diagText = buildZoneDiagnosticText({
      zonaNumero: '004',
      cicloEscolar: '2026-2027',
      totalPlanteles: result.allPlanteles.length,
      matriculaTotal: result.zona?.matriculaTotal ?? 0,
      promedioEficiencia: result.zona?.promedioEficiencia,
      promedioAbandono: result.zona?.promedioAbandono,
      promedioAprovechamiento: result.zona?.promedioCalificaciones,
      promedioReprobacion: result.zona?.promedioReprobacion,
    });

    expect(diagText).toContain('Abandono Escolar Zonal del N/D');
    expect(diagText).not.toContain('del 0%');

    // Caso con columna de abandono con valor 0 explícito
    const mockRowsAbandonoCero = [
      ['SUBSECRETARÍA DE EDUCACIÓN MEDIA SUPERIOR - ESTADÍSTICA 911.7G'],
      ['ZONA ESCOLAR 004 - BACHILLERATOS GENERALES ESTATALES'],
      ['No.', 'C.C.T.', 'Nombre del Plantel', 'Turno', 'Matrícula Total', 'Abandono Escolar (%)'],
      [1, '21EBH0015A', 'BGE Venustiano Carranza', 'MATUTINO', '240', '0.0'],
      [2, '21EBH0020B', 'BGE Francisco Z. Mena', 'MATUTINO', '180', '0'],
    ];

    const resultCero = parsePmcStatistics(mockRowsAbandonoCero, {
      zonaNumero: '004',
      cicloEscolar: '2026-2027',
    });

    expect(resultCero.success).toBe(true);
    expect(resultCero.allPlanteles[0].abandono).toBe(0);
    expect(resultCero.allPlanteles[1].abandono).toBe(0);
    expect(resultCero.zona?.promedioAbandono).toBe(0);
  });
});
