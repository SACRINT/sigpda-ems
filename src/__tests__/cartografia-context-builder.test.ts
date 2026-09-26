import { describe, it, expect } from 'vitest';
import {
  buildCartografiaBaseContext,
  getCartografiaMomentos,
} from '@/lib/cartografia-context-builder';

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

  it('no sintetiza 85% ni 0% cuando eficienciaTerminal no viene reportada en planteles (H-050)', () => {
    const rowSinET: Record<string, unknown> = {
      zona_nombre: 'Zona 004',
      planteles_json: [
        {
          cct: '21EBH0015A',
          nombre: 'Plantel Sin ET',
          matricula: 100,
          abandono: 4.0,
          reprobacion: 5.0,
          promedioGeneral: 8.5,
          // Sin eficienciaTerminal
        },
      ],
    };

    const ctx = buildCartografiaBaseContext(rowSinET);
    expect(ctx.planteles[0].eficienciaTerminal).toBeUndefined();
    expect(ctx.promEficiencia).toBeUndefined();
    expect(ctx.momento2.capaCuantitativa.promedioEficienciaZona).toBeUndefined();
    expect(ctx.momento2.capaCuantitativa.resumenEstadistico911F11).toContain('Eficiencia Terminal N/D');
    expect(ctx.momento2.capaCuantitativa.resumenEstadistico911F11).not.toContain('85%');
    expect(ctx.momento2.capaCuantitativa.resumenEstadistico911F11).not.toContain('0%');
  });

  it('elimina defaults fabricados 5/8 y respeta ceros legítimos y datos ausentes (H-084)', () => {
    // Caso (a) y (c): plantel sin abandono/reprobación
    const rowSinMetricas: Record<string, unknown> = {
      zona_nombre: 'Zona 004',
      planteles_json: [
        {
          cct: '21EBH0015A',
          nombre: 'Plantel Sin Abandono',
          matricula: 100,
          promedioGeneral: 8.5,
          // abandono y reprobacion ausentes
        },
      ],
    };

    const ctxSin = buildCartografiaBaseContext(rowSinMetricas);
    expect(ctxSin.planteles[0].abandono).toBeUndefined();
    expect(ctxSin.planteles[0].reprobacion).toBeUndefined();
    expect(ctxSin.promAbandono).not.toBe(5);
    expect(ctxSin.promReprobacion).not.toBe(8);
    expect(ctxSin.momento2.capaCuantitativa.resumenEstadistico911F11).toContain('Abandono N/D');
    expect(ctxSin.momento2.capaCuantitativa.resumenEstadistico911F11).not.toContain('Abandono: 5%');
    expect(ctxSin.momento2.capaCuantitativa.resumenEstadistico911F11).not.toContain('5%');

    // Caso (b): plantel con abandono 0 real (0% oficial)
    const rowConCero: Record<string, unknown> = {
      zona_nombre: 'Zona 004',
      planteles_json: [
        {
          cct: '21EBH0020B',
          nombre: 'Plantel Con 0% Deserción',
          matricula: 100,
          abandono: 0,
          reprobacion: 0,
          promedioGeneral: 9.0,
        },
      ],
    };

    const ctxCero = buildCartografiaBaseContext(rowConCero);
    expect(ctxCero.planteles[0].abandono).toBe(0);
    expect(ctxCero.planteles[0].reprobacion).toBe(0);
    expect(ctxCero.promAbandono).toBe(0);
    expect(ctxCero.promReprobacion).toBe(0);
    expect(ctxCero.momento2.capaCuantitativa.resumenEstadistico911F11).toContain('Abandono 0%');
  });
});

describe('Cartografia Fallback Defaults (H-013)', () => {
  it('returns default fallback structures when BD columns are empty', () => {
    const emptyRow: Record<string, unknown> = {
      ciclo_escolar: '2026-2027',
      municipio_sede: 'Venustiano Carranza',
    };

    const momentos = getCartografiaMomentos(emptyRow, 5);

    expect(momentos.momento3Ubicar.descripcionTerritorial).toBeDefined();
    expect(momentos.momento3Ubicar.mapaContextual).toContain('5 planteles');
    expect(momentos.momento4Analizar.triangulacion.directivos).toBeDefined();
    expect(momentos.momento5Decidir.lineasAccion).toHaveLength(3);
    expect(momentos.momento5Decidir.metaGeneralZona).toContain('2026-2027');
    expect(momentos.memoriaPedagogica).toBeUndefined();
  });

  it('preserves existing DB momentos when already generated by IA', () => {
    const customRow: Record<string, unknown> = {
      momento3_ubicar: {
        descripcionTerritorial: 'Mapeo personalizado generado por IA',
        comunidadesProcedencia: ['Comunidad A'],
        movilidadTransporte: 'Transporte rural diario',
        conectividadInfraestructura: 'Fibra óptica en cabecera',
        recursosAliados: [],
        mapaContextual: 'Mapa territorial customizado',
      },
      momento4_analizar: {
        triangulacion: {
          directivos: 'Gestión directiva custom',
          docentes: 'Docentes custom',
          alumnosFamilias: 'Familias custom',
          supervisionAtp: 'Supervisión custom',
        },
        patronesRecurrentes: ['Patrón 1'],
        retosPedagogicosCreaa: ['Reto 1'],
        acuerdosAutonomiaConsejo: ['Acuerdo 1'],
      },
      momento5_decidir: {
        metaGeneralZona: 'Meta CREAA custom',
        indicadoresCreaaAsociados: ['Eficiencia'],
        lineasAccion: [],
        compromisosSupervision: ['Compromiso 1'],
      },
      memoria_pedagogica: {
        queLogramos: 'Logros custom',
        comoLoLogramos: 'Metodología custom',
        queAprendimos: 'Aprendizajes custom',
        indicadoresCambio: {
          proceso: 'Proceso 1',
          creaa: 'CREAA 1',
          impactoTerritorial: 'Territorio 1',
        },
        hojaDeRutaProximoCiclo: ['Paso 1'],
      },
    };

    const momentos = getCartografiaMomentos(customRow, 3);

    expect(momentos.momento3Ubicar.descripcionTerritorial).toBe('Mapeo personalizado generado por IA');
    expect(momentos.momento4Analizar.triangulacion.directivos).toBe('Gestión directiva custom');
    expect(momentos.momento5Decidir.metaGeneralZona).toBe('Meta CREAA custom');
    expect(momentos.memoriaPedagogica?.queLogramos).toBe('Logros custom');
  });
});

