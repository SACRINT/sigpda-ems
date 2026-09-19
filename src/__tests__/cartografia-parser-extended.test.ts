/**
 * cartografia-parser-extended.test.ts
 * Tests unitarios extendidos para cartografia-parser.ts (Fase 23)
 * Cobertura de enlace con PAEC en BD, cálculo de atención prioritaria y manejo de errores.
 */

import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest';

const mockQueryFn = vi.fn().mockResolvedValue([]);

vi.mock('@neondatabase/serverless', () => ({
  neon: vi.fn(() => mockQueryFn),
}));

import { parseCartografiaMatriz } from '@/lib/cartografia-parser';

describe('cartografia-parser.ts — Extended Coverage (Fase 23)', () => {
  beforeAll(() => {
    vi.stubEnv('DATABASE_URL', 'postgresql://test:test@localhost:5432/sigpda_test');
  });

  beforeEach(() => {
    mockQueryFn.mockReset();
    mockQueryFn.mockResolvedValue([]);
  });

  it('1. Enlaza proyectos PAEC de la base de datos a los planteles de la zona (linkDbPaec = true)', async () => {
    const mockRows = [
      ['CCT', 'Plantel', 'Turno', 'Matricula', 'Eficiencia Terminal', 'Abandono Escolar', 'Promedio General', 'Reprobacion'],
      ['21EBH0015A', 'Bachillerato Carranza', 'MATUTINO', 200, 92.0, 4.0, 8.6, 5.0],
      ['21EBH0020B', 'Bachillerato Mena', 'MATUTINO', 160, 70.0, 15.0, 7.2, 18.0],
    ];

    // Mock de proyectos PAEC devueltos por la BD
    const mockPaecRows = [
      {
        cct: '21EBH0015A',
        project_name: 'Rescate de Saberes Agroecológicos de la Huasteca Poblana',
        problem_statement: 'Pérdida de técnicas tradicionales de cultivo sostenible',
      },
      {
        cct: '21EBH0020B',
        project_name: 'Cuidado y Preservación de Fuentes Hídricas Locales',
        problem_statement: 'Contaminación de mantos freáticos por residuos sólidos',
      },
    ];
    mockQueryFn.mockResolvedValueOnce(mockPaecRows);

    const result = await parseCartografiaMatriz(mockRows, {
      zonaNumero: '004',
      municipioSede: 'Venustiano Carranza',
      cicloEscolar: '2026-2027',
      linkDbPaec: true,
    });

    expect(result.success).toBe(true);
    expect(result.momento1.planteles).toHaveLength(2);

    const p1 = result.momento1.planteles[0];
    expect(p1.cct).toBe('21EBH0015A');
    expect(p1.paecProyecto).toBe('Rescate de Saberes Agroecológicos de la Huasteca Poblana');
    expect(p1.paecProblematica).toBe('Pérdida de técnicas tradicionales de cultivo sostenible');

    const p2 = result.momento1.planteles[1];
    expect(p2.cct).toBe('21EBH0020B');
    expect(p2.paecProyecto).toBe('Cuidado y Preservación de Fuentes Hídricas Locales');
    expect(p2.paecProblematica).toBe('Contaminación de mantos freáticos por residuos sólidos');

    // Momento 2 contiene la vinculación cualitativa
    expect(result.momento2.capaCualitativa.vinculacionPaecZona).toHaveLength(2);
    expect(result.momento2.capaCualitativa.vinculacionPaecZona[0]).toContain('Saberes Agroecológicos');
  });

  it('2. Identifica correctamente los planteles que requieren atención prioritaria por rezago o abandono', async () => {
    const mockRows = [
      ['CCT', 'Plantel', 'Turno', 'Matricula', 'Eficiencia Terminal', 'Abandono Escolar', 'Promedio General', 'Reprobacion'],
      ['21EBH0015A', 'Plantel Regular', 'MATUTINO', 200, 85.0, 5.0, 8.0, 6.0],
      ['21EBH0020B', 'Plantel En Riesgo Crítico', 'MATUTINO', 150, 65.0, 22.0, 6.8, 25.0], // Alto abandono (> 5+3) y baja ET (< 85-5)
    ];

    const result = await parseCartografiaMatriz(mockRows, {
      zonaNumero: '004',
      linkDbPaec: false,
    });

    expect(result.success).toBe(true);
    const prioritaria = result.momento2.capaCuantitativa.plantelesAtencionPrioritaria;
    expect(prioritaria.length).toBe(1);
    expect(prioritaria[0]).toContain('Plantel En Riesgo Crítico');
    expect(prioritaria[0]).toContain('Abandono: 22%');
  });

  it('3. Maneja fallos de conexión a la BD de forma resiliente sin interrumpir la cartografía', async () => {
    const mockRows = [
      ['CCT', 'Plantel', 'Turno', 'Matricula', 'Eficiencia Terminal', 'Abandono Escolar', 'Promedio General', 'Reprobacion'],
      ['21EBH0015A', 'Bachillerato Carranza', 'MATUTINO', 200, 92.0, 4.0, 8.6, 5.0],
    ];

    // Simular error en la consulta a la BD
    mockQueryFn.mockRejectedValueOnce(new Error('Connection timeout to Neon DB'));

    const result = await parseCartografiaMatriz(mockRows, {
      linkDbPaec: true,
    });

    // La función debe continuar exitosamente con los datos cuantitativos y fallbacks cualitativos
    expect(result.success).toBe(true);
    expect(result.momento1.planteles[0].paecProyecto).toBe('Proyecto Comunitario PAEC en proceso');
    expect(result.momento1.planteles[0].paecProblematica).toBe('Retos socioformativos del entorno local');
  });

  it('4. Retorna estructura de error estándar cuando la matriz está vacía o es inválida', async () => {
    const invalidRows: unknown[] = [];

    const result = await parseCartografiaMatriz(invalidRows);
    expect(result.success).toBe(false);
    expect(result.momento1.planteles).toHaveLength(0);
    expect(result.momento1.matriculaTotalZona).toBe(0);
    expect(result.momento2.capaCuantitativa.matriculaTotal).toBe(0);
    expect(result.error).toBeDefined();
  });
});
