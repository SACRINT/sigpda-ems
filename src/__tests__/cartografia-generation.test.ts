import { describe, it, expect } from 'vitest';
import {
  CartografiaMomento3Schema,
  CartografiaMomento4Schema,
  CartografiaMomento5Schema,
  CartografiaMemoriaSchema,
} from '@/lib/ai-schemas';
import {
  buildMomento3UbicarPrompt,
  buildMomento4AnalizarPrompt,
  buildMomento5DecidirPrompt,
  buildMemoriaPedagogicaPrompt,
  type CartografiaIdentificacion,
} from '@/lib/prompts/cartografia-prompts';
import { auditCartografiaProject } from '@/lib/cartografia-quality-gate';
import type {
  CartografiaMomento1Conocer,
  CartografiaMomento2Organizar,
  CartografiaZonaProject,
} from '@/types/cartografia';

describe('Fase 8: Cartografía de Zona Escolar - Schemas & Quality Gate', () => {
  const mockIdentificacion: CartografiaIdentificacion = {
    zonaNumero: '004',
    zonaClave: '21FMS0004Z',
    supervisorName: 'Ing. Alejandro Escamilla Martínez',
    municipioSede: 'Venustiano Carranza',
    municipiosAtiende: 'Venustiano Carranza, Francisco Z. Mena, Pantepec, Jalpan',
    subsistema: 'Bachilleratos Estatales',
    cicloEscolar: '2026-2027',
    atps: ['Ing. Samuel Cruz Interial', 'Imelda Hernández García'],
  };

  const mockMomento1: CartografiaMomento1Conocer = {
    planteles: [
      {
        no: 1,
        cct: '21EBH0001A',
        nombre: 'Bachillerato Venustiano Carranza',
        localidad: 'Lázaro Cárdenas',
        municipio: 'Venustiano Carranza',
        turno: 'MATUTINO',
        matricula: 220,
        eficienciaTerminal: 88,
        abandono: 4.2,
        reprobacion: 6.5,
        promedioGeneral: 8.4,
        paecProyecto: 'Cuidado del agua en la cuenca',
        paecProblematica: 'Escasez y contaminación de mantos acuíferos',
      },
      {
        no: 2,
        cct: '21EBH0002B',
        nombre: 'Bachillerato Francisco Z. Mena',
        localidad: 'Metlaltoyuca',
        municipio: 'Francisco Z. Mena',
        turno: 'MATUTINO',
        matricula: 180,
        eficienciaTerminal: 82,
        abandono: 7.1,
        reprobacion: 9.0,
        promedioGeneral: 8.1,
        paecProyecto: 'Huertos escolares sustentables',
        paecProblematica: 'Soberanía alimentaria y saberes locales',
      },
    ],
    matriculaTotalZona: 400,
    municipiosCobertura: ['Venustiano Carranza', 'Francisco Z. Mena'],
    sedesPlanteles: ['Bachillerato Venustiano Carranza [21EBH0001A]', 'Bachillerato Francisco Z. Mena [21EBH0002B]'],
    caracterizacionInicial: 'Zona escolar con cobertura en la Sierra Norte de Puebla.',
  };

  const mockMomento2: CartografiaMomento2Organizar = {
    capaCuantitativa: {
      promedioAbandonoZona: 5.65,
      promedioEficienciaZona: 85.0,
      promedioAprovechamientoZona: 8.25,
      promedioReprobacionZona: 7.75,
      matriculaTotal: 400,
      plantelesAtencionPrioritaria: ['Bachillerato Francisco Z. Mena (Abandono: 7.1%, ET: 82%)'],
      resumenEstadistico911F11: 'Línea base consolidada de la Zona 004 con indicadores 911 y F11.',
    },
    capaCualitativa: {
      problematicasComunes: ['Dispersión geográfica', 'Brecha digital'],
      factoresContextuales: ['Economía agropecuaria'],
      vinculacionPaecZona: ['Venustiano Carranza: Cuidado del agua', 'Francisco Z. Mena: Huertos escolares'],
      desafiosSocioeconomicos: 'Tiempos de traslado y transporte rural.',
    },
  };

  describe('1. Zod Validation Schemas (Defensivos y Robustos)', () => {
    it('Valida Momento 3 (Ubicar) y desenvuelve claves anidadas', () => {
      const rawPayload = {
        momento3Ubicar: {
          descripcionTerritorial: 'Zona situada en la Sierra Norte de Puebla con amplia dispersión geográfica.',
          comunidadesProcedencia: ['Lázaro Cárdenas', 'Metlaltoyuca'],
          movilidadTransporte: 'Transporte colectivo rural con frecuencias limitadas.',
          conectividadInfraestructura: 'Conectividad satelital básica en los planteles.',
          recursosAliados: [
            {
              nombre: 'Centro de Salud Comunitario',
              tipo: 'salud',
              ubicacion: 'Lázaro Cárdenas',
              vinculacionPedagogica: 'Prevención de adicciones y salud mental escolar.',
            },
          ],
          mapaContextual: 'Distribución lineal a lo largo de la carretera federal.',
        },
      };

      const result = CartografiaMomento3Schema.safeParse(rawPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.recursosAliados[0].tipo).toBe('salud');
        expect(result.data.comunidadesProcedencia).toHaveLength(2);
      }
    });

    it('Valida Momento 4 (Analizar - Triangulación de 4 Perspectivas)', () => {
      const rawPayload = {
        triangulacion: {
          directivos: 'Retos de gestión participativa y retención escolar temprana.',
          docentes: 'Necesidad de codiseño curricular y flexibilización de progresiones.',
          alumnosFamilias: 'Demanda de formación para el trabajo y vinculación comunitaria.',
          supervisionAtp: 'Asesoría situada y acompañamiento dialógico a colectivos.',
        },
        patronesRecurrentes: ['Vulnerabilidad económica en periodos de cosecha'],
        retosPedagogicosCreaa: ['Abatir reprobación en pensamiento matemático'],
        acuerdosAutonomiaConsejo: ['Banco de proyectos comunitarios integradores'],
      };

      const result = CartografiaMomento4Schema.safeParse(rawPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.triangulacion.directivos).toContain('gestión participativa');
        expect(result.data.retosPedagogicosCreaa).toHaveLength(1);
      }
    });

    it('Valida Momento 5 (Decidir - Fórmula CREAA y 3 Líneas DBEPA)', () => {
      const rawPayload = {
        metaGeneralZona:
          'Incrementar en 4% la eficiencia terminal de los 400 estudiantes de la Zona Escolar 004 mediante comunidades docentes de práctica durante el ciclo escolar 2026-2027.',
        indicadoresCreaaAsociados: ['Eficiencia terminal', 'Abandono escolar'],
        lineasAccion: [
          {
            numero: '1',
            titulo: 'Acompañamiento a la autonomía docente y curricular situada',
            accionesEspecificas: ['Talleres de codiseño'],
            recursos: ['Fichas DBEPA'],
            responsables: 'Equipo ATP',
            entregables: 'Portafolio de secuencias didácticas',
            estrategiaSeguimiento: 'Consejo Técnico de Zona',
            periodoEjecucion: '2026-2027',
          },
          {
            numero: 2,
            titulo: 'Acompañamiento directivo para la gestión participativa y clima escolar',
            accionesEspecificas: ['Círculos de liderazgo'],
            recursos: ['Guías directivas'],
            responsables: 'Supervisión y Directores',
            entregables: 'Diagnóstico de clima',
            estrategiaSeguimiento: 'Visitas situadas',
            periodoEjecucion: '2026-2027',
          },
          {
            numero: 3,
            titulo: 'Acompañamiento integral a las trayectorias formativas y proyectos comunitarios',
            accionesEspecificas: ['Tutoría personalizada'],
            recursos: ['Formatos PAEC'],
            responsables: 'Comités de Vinculación',
            entregables: 'Padrón de seguimiento',
            estrategiaSeguimiento: 'Cortes parciales',
            periodoEjecucion: '2026-2027',
          },
        ],
        compromisosSupervision: ['Visitas regulares de diálogo pedagógico'],
      };

      const result = CartografiaMomento5Schema.safeParse(rawPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.lineasAccion[0].numero).toBe(1);
        expect(result.data.lineasAccion[1].numero).toBe(2);
        expect(result.data.lineasAccion[2].numero).toBe(3);
      }
    });

    it('Valida Memoria Pedagógica Viva (3 interrogantes)', () => {
      const rawPayload = {
        memoriaPedagogica: {
          queLogramos: 'Consolidación de las comunidades docentes de práctica y reducción del abandono.',
          comoLoLogramos: 'Mediante el codiseño curricular contextualizado y el diálogo pedagógico horizontal.',
          queAprendimos: 'La importancia de situar la evaluación formativa y escuchar la voz del estudiantado.',
          indicadoresCambio: {
            proceso: 'Planeaciones auténticamente vinculadas al PAEC.',
            creaa: 'Reducción del abandono del 7.1% al 4.8%.',
            impactoTerritorial: 'Apropiación social comunitaria del bachillerato.',
          },
          hojaDeRutaProximoCiclo: ['Consolidar el banco de secuencias didácticas de zona'],
        },
      };

      const result = CartografiaMemoriaSchema.safeParse(rawPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.queLogramos).toContain('Consolidación');
        expect(result.data.indicadoresCambio.creaa).toContain('Reducción');
      }
    });
  });

  describe('2. Prompt Builders Modulares', () => {
    it('Construye prompt para Momento 3 con datos territoriales', () => {
      const prompt = buildMomento3UbicarPrompt(mockIdentificacion, mockMomento1, mockMomento2);
      expect(prompt).toContain('MOMENTO 3: UBICAR');
      expect(prompt).toContain('Zona Escolar: 004');
      expect(prompt).toContain('Venustiano Carranza');
    });

    it('Construye prompt para Momento 4 con triangulación de perspectivas', () => {
      const prompt = buildMomento4AnalizarPrompt(mockIdentificacion, mockMomento1, mockMomento2);
      expect(prompt).toContain('MOMENTO 4: ANALIZAR');
      expect(prompt).toContain('TRIANGULACIÓN DE LAS 4 PERSPECTIVAS');
    });

    it('Construye prompt para Momento 5 con fórmula sintáctica CREAA', () => {
      const prompt = buildMomento5DecidirPrompt(mockIdentificacion, mockMomento1, mockMomento2);
      expect(prompt).toContain('MOMENTO 5: DECIDIR');
      expect(prompt).toContain('fórmula sintáctica CREAA');
      expect(prompt).toContain('Línea 1: Acompañamiento a la autonomía docente');
    });

    it('Construye prompt para Memoria Pedagógica con las 3 preguntas clave', () => {
      const prompt = buildMemoriaPedagogicaPrompt(mockIdentificacion, mockMomento1, mockMomento2);
      expect(prompt).toContain('MEMORIA PEDAGÓGICA VIVA');
      expect(prompt).toContain('¿Qué logramos?, ¿Cómo lo logramos?, y ¿Qué aprendimos?');
    });
  });

  describe('3. Cartografía Quality Gate Auditor', () => {
    it('Evalúa un proyecto de Cartografía completo y otorga calificación alta', () => {
      const completeProject: CartografiaZonaProject = {
        zonaNumero: '004',
        zonaClave: '21FMS0004Z',
        supervisorName: 'Ing. Alejandro Escamilla Martínez',
        municipioSede: 'Venustiano Carranza',
        municipiosAtiende: 'Venustiano Carranza, Francisco Z. Mena',
        subsistema: 'Bachilleratos Estatales',
        cicloEscolar: '2026-2027',
        atps: ['Samuel Cruz'],
        momento1Conocer: {
          ...mockMomento1,
          caracterizacionInicial: 'Caracterización territorial amplia y representativa de los planteles de la zona escolar.',
        },
        momento2Organizar: mockMomento2,
        momento3Ubicar: {
          descripcionTerritorial: 'Mapeo detallado de la Sierra Norte de Puebla.',
          comunidadesProcedencia: ['Comunidad 1', 'Comunidad 2'],
          movilidadTransporte: 'Transporte rural continuo.',
          conectividadInfraestructura: 'Conectividad en todos los planteles.',
          recursosAliados: [
            {
              nombre: 'Centro de Salud',
              tipo: 'salud',
              ubicacion: 'Sede',
              vinculacionPedagogica: 'Salud comunitaria',
            },
          ],
          mapaContextual: 'Mapa territorial de nodos comunitarios.',
        },
        momento4Analizar: {
          triangulacion: {
            directivos: 'Gestión participativa y clima institucional armónico.',
            docentes: 'Codiseño curricular situado y evaluación formativa.',
            alumnosFamilias: 'Pertinencia social y continuidad de estudios.',
            supervisionAtp: 'Asesoría situada y diálogo pedagógico continuo.',
          },
          patronesRecurrentes: ['Patrón 1'],
          retosPedagogicosCreaa: ['Reto 1'],
          acuerdosAutonomiaConsejo: ['Acuerdo 1'],
        },
        momento5Decidir: {
          metaGeneralZona: 'Incrementar en 4.5% la permanencia escolar mediante comunidades docentes durante 2026-2027.',
          indicadoresCreaaAsociados: ['Eficiencia terminal', 'Abandono'],
          lineasAccion: [
            {
              numero: 1,
              titulo: 'Línea 1',
              accionesEspecificas: ['Acción 1'],
              recursos: ['Recurso 1'],
              responsables: 'ATP',
              entregables: 'Portafolio',
              estrategiaSeguimiento: 'Cortes',
              periodoEjecucion: '2026-2027',
            },
            {
              numero: 2,
              titulo: 'Línea 2',
              accionesEspecificas: ['Acción 2'],
              recursos: ['Recurso 2'],
              responsables: 'Supervisión',
              entregables: 'Diagnóstico',
              estrategiaSeguimiento: 'Reuniones',
              periodoEjecucion: '2026-2027',
            },
            {
              numero: 3,
              titulo: 'Línea 3',
              accionesEspecificas: ['Acción 3'],
              recursos: ['Recurso 3'],
              responsables: 'Tutores',
              entregables: 'Padrón',
              estrategiaSeguimiento: 'Evaluaciones',
              periodoEjecucion: '2026-2027',
            },
          ],
          compromisosSupervision: ['Compromiso 1'],
        },
        memoriaPedagogica: {
          queLogramos: 'Resultados sustantivos del ciclo escolar.',
          comoLoLogramos: 'A través de la autonomía profesional y trabajo colegiado.',
          queAprendimos: 'Reflexión situada sobre las fichas formativas.',
          indicadoresCambio: {
            proceso: 'Transformación de la planeación docente.',
            creaa: 'Avance en retención escolar.',
            impactoTerritorial: 'Apropiación comunitaria.',
          },
          hojaDeRutaProximoCiclo: ['Ruta 1'],
        },
        status: 'completed',
      };

      const audit = auditCartografiaProject(completeProject);
      expect(audit.percentage).toBeGreaterThan(70);
      expect(['SATISFACTORIO', 'EXCELENTE']).toContain(audit.status);
    });
  });
});
