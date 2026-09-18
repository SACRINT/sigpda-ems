import { describe, it, expect } from 'vitest';
import { buildCartografiaBaseContext } from '@/lib/cartografia-context-builder';

describe('Cartografia Context Builder (H-011)', () => {
  it('builds base context correctly from DB row with realistic planteles data', () => {
    const mockRow: Record<string, unknown> = {
      zona_nombre: 'Zona 004',
      zona_clave: '21FMS0004Z',
      supervisor_name: 'Dr. Roberto Mendoza',
      municipio_sede: 'Venustiano Carranza',
      municipios_atiende: 'Venustiano Carranza, Jalpan, Pantepec',
      subsistema: 'Bachilleratos Estatales',
      ciclo_escolar: '2026-2027',
      atps: ['ATP Juan Pérez', 'ATP Ana Gómez'],
      diagnostico_contexto: 'Diagnóstico integral de la zona norte.',
      problematicas_json: [
        { titulo: 'Baja comprensión lectora' },
        { descripcion: 'Deserción en primer año por migración laboral' },
      ],
      planteles_json: [
        {
          cct: '21EBH0001A',
          nombre: 'Bachillerato Venustiano Carranza',
          localidad: 'La Ceiba',
          municipio: 'Venustiano Carranza',
          turno: 'MATUTINO',
          matricula: 150,
          egresados: 40,
          bajasDefinitivas: 2,
          eficienciaTerminal: 88,
          abandono: 4.5,
          reprobacion: 6.2,
          promedioGeneral: 8.4,
          paecProyecto: 'Cuidado del agua en La Ceiba',
          paecProblematica: 'Escasez hídrica en temporada de secas',
        },
        {
          cct: '21EBH0002B',
          nombre: 'Bachillerato General Francisco Z. Mena',
          localidad: 'Metlaltoyuca',
          municipio: 'Francisco Z. Mena',
          turno: 'MATUTINO',
          matricula: 120,
          egresados: 30,
          bajasDefinitivas: 5,
          eficienciaTerminal: 75, // menor que promEficiencia - 5
          abandono: 12.0, // mayor que promAbandono + 3
          reprobacion: 14.5,
          promedioGeneral: 7.6,
          paecProyecto: 'Huertos de café sostenibles',
          paecProblematica: 'Falta de empleo juvenil',
        },
      ],
    };

    const ctx = buildCartografiaBaseContext(mockRow, { name: 'Dr. Roberto Mendoza', email: 'roberto@test.com' });

    // Identificación
    expect(ctx.identificacion.zonaNumero).toBe('004');
    expect(ctx.identificacion.zonaClave).toBe('21FMS0004Z');
    expect(ctx.identificacion.supervisorName).toBe('Dr. Roberto Mendoza');
    expect(ctx.identificacion.atps).toEqual(['ATP Juan Pérez', 'ATP Ana Gómez']);

    // Planteles
    expect(ctx.planteles).toHaveLength(2);
    expect(ctx.matriculaTotalZona).toBe(270);

    // Promedios
    expect(ctx.promAbandono).toBe(8.25); // (4.5 + 12.0) / 2
    expect(ctx.promEficiencia).toBe(81.5); // (88 + 75) / 2
    expect(ctx.promAprovechamiento).toBe(8); // (8.4 + 7.6) / 2 = 8.0
    expect(ctx.promReprobacion).toBe(10.35); // (6.2 + 14.5) / 2

    // Planteles de atención prioritaria
    expect(ctx.plantelesAtencionPrioritaria.length).toBeGreaterThan(0);
    expect(ctx.plantelesAtencionPrioritaria[0]).toContain('Bachillerato General Francisco Z. Mena');

    // Momento 1 y 2
    expect(ctx.momento1.planteles).toHaveLength(2);
    expect(ctx.momento1.matriculaTotalZona).toBe(270);
    expect(ctx.momento2.capaCuantitativa.promedioAbandonoZona).toBe(8.25);
    expect(ctx.momento2.capaCualitativa.problematicasComunes).toEqual([
      'Baja comprensión lectora',
      'Deserción en primer año por migración laboral',
    ]);
  });

  it('handles empty or missing DB row gracefully with sensible defaults', () => {
    const emptyRow: Record<string, unknown> = {};
    const ctx = buildCartografiaBaseContext(emptyRow, { name: 'Supervisora Default' });

    expect(ctx.identificacion.zonaNumero).toBe('004');
    expect(ctx.identificacion.supervisorName).toBe('Supervisora Default');
    expect(ctx.planteles).toEqual([]);
    expect(ctx.matriculaTotalZona).toBe(0);
    expect(ctx.promAbandono).toBe(0);
    expect(ctx.momento2.capaCualitativa.problematicasComunes.length).toBeGreaterThan(0);
  });
});
