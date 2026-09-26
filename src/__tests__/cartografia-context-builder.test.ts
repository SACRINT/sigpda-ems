import { describe, it, expect } from 'vitest';
import {
  buildCartografiaBaseContext,
  getCartografiaMomentos,
} from '@/lib/cartografia-context-builder';
import {
  buildCartografiaFullPrompt,
  buildMomento3UbicarPrompt,
} from '@/lib/prompts/cartografia-prompts';
import { buildZoneDiagnosticText } from '@/lib/zone-metric-format';

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
    expect(ctx.promAbandono).toBeUndefined();
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

  // (d) planteles sin columnas de abandono/reprobación → promedioAbandonoZona === undefined;
  // buildCartografiaFullPrompt contiene Abandono N/D y no contiene 0% en las líneas de promedio zonal; resumen Abandono N/D
  it('(d) planteles sin columnas de abandono/reprobación producen promedioAbandonoZona undefined y prompt sin 0% fabricado (H-086, H-087)', () => {
    const rowSinColumnas: Record<string, unknown> = {
      zona_nombre: 'Zona 004',
      planteles_json: [
        { cct: '21EBH0001A', nombre: 'Plantel A', matricula: 150, promedioGeneral: 8.5 },
        { cct: '21EBH0002B', nombre: 'Plantel B', matricula: 200, promedioGeneral: 8.2 },
      ],
    };

    const ctx = buildCartografiaBaseContext(rowSinColumnas);
    expect(ctx.promAbandono).toBeUndefined();
    expect(ctx.promReprobacion).toBeUndefined();
    expect(ctx.momento2.capaCuantitativa.promedioAbandonoZona).toBeUndefined();
    expect(ctx.momento2.capaCuantitativa.promedioReprobacionZona).toBeUndefined();
    expect(ctx.momento2.capaCuantitativa.resumenEstadistico911F11).toContain('Abandono N/D');
    expect(ctx.momento2.capaCuantitativa.resumenEstadistico911F11).toContain('Reprobación N/D');
    expect(ctx.momento2.capaCuantitativa.resumenEstadistico911F11).not.toContain('0%');

    const prompt = buildCartografiaFullPrompt(ctx.identificacion, ctx.momento1, ctx.momento2);
    expect(prompt).toContain('Promedio de Abandono Escolar en la Zona: N/D');
    expect(prompt).toContain('Promedio de Reprobación en la Zona: N/D');
    expect(prompt).toContain('Abandono Escolar (Línea base N/D)');
    expect(prompt).not.toContain('Promedio de Abandono Escolar en la Zona: 0%');
    expect(prompt).not.toContain('Promedio de Reprobación en la Zona: 0%');

    const promptM3 = buildMomento3UbicarPrompt(ctx.identificacion, ctx.momento1, ctx.momento2);
    expect(promptM3).toContain('Promedio Abandono: N/D');
    expect(promptM3).not.toContain('Promedio Abandono: 0%');
  });

  // (e) matrícula y promedio ausentes en un plantel → prompt contiene Matrícula N/D y Promedio N/D;
  // promAprovechamiento de los planteles con dato intacto; resumen Aprovechamiento N/D
  it('(e) matrícula y promedio ausentes en un plantel muestran N/D en prompt y preservan aprovechamiento de planteles con dato (H-086)', () => {
    const rowConAusentes: Record<string, unknown> = {
      zona_nombre: 'Zona 004',
      planteles_json: [
        { cct: '21EBH0001A', nombre: 'Plantel Sin Datos' },
        { cct: '21EBH0002B', nombre: 'Plantel Con Datos', matricula: 120, promedioGeneral: 8.4 },
      ],
    };

    const ctx = buildCartografiaBaseContext(rowConAusentes);
    expect(ctx.planteles[0].matricula).toBeUndefined();
    expect(ctx.planteles[0].promedioGeneral).toBeUndefined();
    expect(ctx.planteles[1].matricula).toBe(120);
    expect(ctx.planteles[1].promedioGeneral).toBe(8.4);
    // El promedio general zonal no es arrastrado a la baja por el plantel sin dato
    expect(ctx.promAprovechamiento).toBe(8.4);
    expect(ctx.momento2.capaCuantitativa.promedioAprovechamientoZona).toBe(8.4);
    expect(ctx.momento2.capaCuantitativa.resumenEstadistico911F11).toContain('Aprovechamiento 8.4');

    const prompt = buildCartografiaFullPrompt(ctx.identificacion, ctx.momento1, ctx.momento2);
    expect(prompt).toContain('Matrícula N/D');
    expect(prompt).toContain('Promedio N/D');

    // Caso donde ningún plantel tiene promedio: resumen muestra Aprovechamiento N/D
    const rowSinNingunPromedio: Record<string, unknown> = {
      zona_nombre: 'Zona 004',
      planteles_json: [
        { cct: '21EBH0001A', nombre: 'Plantel X' },
      ],
    };
    const ctxSinProm = buildCartografiaBaseContext(rowSinNingunPromedio);
    expect(ctxSinProm.promAprovechamiento).toBeUndefined();
    expect(ctxSinProm.momento2.capaCuantitativa.resumenEstadistico911F11).toContain('Aprovechamiento N/D');
  });

  // (f) abandono 0 legítimo en todos los planteles → promedioAbandonoZona === 0, resumen Abandono 0%,
  // y el plantel sí entra en plantelesAtencionPrioritaria si supera 0 + 3
  it('(f) abandono 0 legítimo preserva 0% en resumen y detecta planteles prioritarios que superen el umbral (H-088)', () => {
    const rowTodosCero: Record<string, unknown> = {
      zona_nombre: 'Zona 004',
      planteles_json: [
        { cct: '21EBH0001A', nombre: 'Plantel Cero A', matricula: 100, abandono: 0, promedioGeneral: 8.5 },
        { cct: '21EBH0002B', nombre: 'Plantel Cero B', matricula: 100, abandono: 0, promedioGeneral: 8.0 },
      ],
    };

    const ctxTodosCero = buildCartografiaBaseContext(rowTodosCero);
    expect(ctxTodosCero.promAbandono).toBe(0);
    expect(ctxTodosCero.momento2.capaCuantitativa.promedioAbandonoZona).toBe(0);
    expect(ctxTodosCero.momento2.capaCuantitativa.resumenEstadistico911F11).toContain('Abandono 0%');

    // Planteles donde varios tienen 0% y uno tiene deserción alta que supera promAbandono + 3
    const rowConPrioritario: Record<string, unknown> = {
      zona_nombre: 'Zona 004',
      planteles_json: [
        { cct: '21EBH0001A', nombre: 'Plantel Cero 1', matricula: 100, abandono: 0, promedioGeneral: 8.0 },
        { cct: '21EBH0002B', nombre: 'Plantel Cero 2', matricula: 100, abandono: 0, promedioGeneral: 8.0 },
        { cct: '21EBH0003C', nombre: 'Plantel Cero 3', matricula: 100, abandono: 0, promedioGeneral: 8.0 },
        { cct: '21EBH0004D', nombre: 'Plantel Cero 4', matricula: 100, abandono: 0, promedioGeneral: 8.0 },
        { cct: '21EBH0005E', nombre: 'Plantel Prioritario', matricula: 100, abandono: 5.0, promedioGeneral: 8.0 },
      ],
    };

    const ctxPrioritario = buildCartografiaBaseContext(rowConPrioritario);
    // promAbandono = 5.0 / 5 = 1.0; 5.0 > 1.0 + 3 = 4.0 -> entra en atención prioritaria
    expect(ctxPrioritario.promAbandono).toBe(1.0);
    expect(ctxPrioritario.plantelesAtencionPrioritaria).toHaveLength(1);
    expect(ctxPrioritario.plantelesAtencionPrioritaria[0]).toContain('Plantel Prioritario');
    expect(ctxPrioritario.plantelesAtencionPrioritaria[0]).toContain('Abandono: 5%');
  });

  // (g) Función pura de diagnóstico de zona: produce cadena sin "del 0%" ante ausencia de métricas (H-087, H-090)
  it('(g) buildZoneDiagnosticText produce cadena sin "del 0%" ante ausencia de métricas (H-087, H-090)', () => {
    const diagText = buildZoneDiagnosticText({
      zonaNumero: '004',
      cicloEscolar: '2026-2027',
      totalPlanteles: 3,
      matriculaTotal: 0,
      promedioEficiencia: undefined,
      promedioAbandono: undefined,
      promedioAprovechamiento: undefined,
      promedioReprobacion: undefined,
    });

    expect(diagText).toContain('Abandono Escolar Zonal del N/D');
    expect(diagText).toContain('Eficiencia Terminal Zonal del N/D');
    expect(diagText).toContain('Promedio General de Aprovechamiento en N/D');
    expect(diagText).toContain('Reprobación del N/D');
    expect(diagText).not.toContain('del 0%');
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

