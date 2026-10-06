// src/__tests__/cartografia-zona-docx.test.ts
import { describe, it, expect } from 'vitest';
import mammoth from 'mammoth';
import {
  generateCartografiaZonaDocx,
  generateResumenEjecutivoDocx,
} from '@/lib/cartografia-zona-docx-generator';
import type { CartografiaZonaProject } from '@/types/cartografia';

function makeRealisticCartografiaProject(): CartografiaZonaProject {
  return {
    id: 'proj-zona-004',
    zonaNumero: '004',
    zonaClave: '21FZP0004Z',
    supervisorName: 'Mtro. José Luis Benítez',
    municipioSede: 'Puebla',
    municipiosAtiende: 'Puebla, San Andrés Cholula, Cuautlancingo',
    subsistema: 'Dirección de Bachilleratos Estatales y Preparatoria Abierta (DBEPA)',
    cicloEscolar: '2026-2027',
    atps: ['Mtra. Ana María Pérez', 'Mtro. Carlos Ruiz'],
    momento1Conocer: {
      planteles: [
        {
          no: 1,
          cct: '21EBH1039R',
          nombre: 'Bachillerato Digital Núm. 153',
          localidad: 'San Baltazar',
          municipio: 'Puebla',
          turno: 'Matutino',
          matricula: 180,
          eficienciaTerminal: 85,
          abandono: 7.2,
          reprobacion: 12.5,
          promedioGeneral: 8.3,
          metaEficienciaTerminal: 88,
          metaAbandono: 5.0,
        },
        {
          no: 2,
          cct: '21EBH1054J',
          nombre: 'Bachillerato Digital Núm. 102',
          localidad: 'Tlaxcalancingo',
          municipio: 'San Andrés Cholula',
          turno: 'Matutino',
          matricula: 140,
          eficienciaTerminal: 82,
          abandono: 8.5,
          reprobacion: 14.1,
          promedioGeneral: 8.1,
        },
      ],
      matriculaTotalZona: 320,
      municipiosCobertura: ['Puebla', 'San Andrés Cholula'],
      sedesPlanteles: ['San Baltazar', 'Tlaxcalancingo'],
      caracterizacionInicial: 'Zona escolar con planteles en contexto periurbano y rural con retos de conectividad.',
    },
    momento2Organizar: {
      capaCuantitativa: {
        promedioAbandonoZona: 7.8,
        promedioEficienciaZona: 83.5,
        promedioAprovechamientoZona: 8.2,
        promedioReprobacionZona: 13.3,
        matriculaTotal: 320,
        plantelesAtencionPrioritaria: ['Bachillerato Digital Núm. 102'],
        resumenEstadistico911F11: 'Análisis integrado 911 y F11: se identificó abandono estacional y necesidad de nivelación en pensamiento matemático.',
      },
      capaCualitativa: {
        problematicasComunes: ['Rezago en álgebra y comprensión lectora', 'Movilidad estudiantil deficiente'],
        factoresContextuales: ['Familias dedicadas al comercio informal y agricultura'],
        vinculacionPaecZona: ['Huertos comunitarios', 'Campañas de reciclaje escolar'],
        desafiosSocioeconomicos: 'Dispersión territorial y jornadas laborales de los alumnos.',
      },
    },
    momento3Ubicar: {
      descripcionTerritorial: 'Micro-región con vías de comunicación primarias y zonas rurales secundarias.',
      comunidadesProcedencia: ['San Baltazar', 'Tlaxcalancingo'],
      movilidadTransporte: 'Transporte colectivo limitado en horarios vespertinos.',
      conectividadInfraestructura: 'Conectividad satelital en 50% de planteles.',
      recursosAliados: [
        {
          nombre: 'Centro de Salud Comunitario CESSA',
          tipo: 'salud',
          ubicacion: 'San Andrés Cholula',
          vinculacionPedagogica: 'Talleres de salud sexual y prevención de adicciones en el PAEC',
        },
        {
          nombre: 'Unidad Deportiva La Piedad',
          tipo: 'deportivo',
          ubicacion: 'Puebla',
          vinculacionPedagogica: 'Torneos intercolegiales de voleibol y fútbol',
        },
      ],
      mapaContextual: 'Mapa territorial de la zona 004',
    },
    momento4Analizar: {
      triangulacion: {
        directivos: 'Coordinación institucional efectiva pero saturación administrativa.',
        docentes: 'Requieren material didáctico contextualizado.',
        alumnosFamilias: 'Compromiso familiar condicionado a horarios laborales.',
        supervisionAtp: 'Acompañamiento situado en planeación y evaluación formativa.',
      },
      patronesRecurrentes: ['Dificultad en evaluación auténtica'],
      retosPedagogicosCreaa: [
        'Apropiación curricular y proyectos PAEC transversales',
        'Reducción de abandono en primer semestre',
      ],
      acuerdosAutonomiaConsejo: [
        'Homologar rúbricas de evaluación en academias de zona',
        'Compartir secuencias didácticas exitosas',
      ],
    },
    momento5Decidir: {
      metaGeneralZona: 'Disminuir en 2.5% el abandono escolar en la Zona 004 mediante proyectos PAEC y tutorías activas.',
      indicadoresCreaaAsociados: [
        'Resultados de Evaluaciones (EDIEMS / ESA)',
        'Abandono Escolar',
        'Eficiencia Terminal',
      ],
      lineasAccion: [
        {
          numero: 1,
          titulo: 'Homologación y seguimiento a resultados diagnósticos (EDIEMS / ESA)',
          accionesEspecificas: ['Analizar colegiadamente reactivos con mayor rezago', 'Ajustar planeaciones de aula'],
          recursos: ['Reportes EDIEMS', 'Plataforma SIGPDA-EMS'],
          responsables: 'Supervisor(a) y Directores',
          entregables: 'Informe analítico de zona y planeaciones ajustadas',
          estrategiaSeguimiento: 'Revisión en Consejos Académicos',
          periodoEjecucion: 'Agosto 2026 – Enero 2027',
        },
        {
          numero: 2,
          titulo: 'Articulación del PAEC por plantel y zona',
          accionesEspecificas: ['Diseñar proyectos comunitarios con aliados locales', 'Encuentro de experiencias PAEC'],
          recursos: ['Guías PAEC DBEPA', 'Espacios comunitarios'],
          responsables: 'Colectivos docentes y comités PAEC',
          entregables: 'Proyectos integradores documentados',
          estrategiaSeguimiento: 'Rúbricas de impacto comunitario',
          periodoEjecucion: 'Septiembre 2026 – Mayo 2027',
        },
        {
          numero: 3,
          titulo: 'Participación en Encuentros Académicos y Alertas Tempranas',
          accionesEspecificas: ['Monitoreo quincenal de inasistencias', 'Encuentro de Ciencia y Tecnología'],
          recursos: ['Sistema de Alerta Temprana SIATECCE'],
          responsables: 'Tutores escolares y supervisión',
          entregables: 'Bitácoras de tutoría y reportes de retención',
          estrategiaSeguimiento: 'Cortes evaluativos bimestrales',
          periodoEjecucion: 'Septiembre 2026 – Julio 2027',
        },
      ],
      compromisosSupervision: [
        'Visitas situadas bimestrales a planteles prioritarios',
        'Asesoría continua en el rediseño curricular MCCEMS',
      ],
    },
    memoriaPedagogica: {
      queLogramos: 'Se logró consolidar el 100% de proyectos PAEC con vinculación comunitaria.',
      comoLoLogramos: 'Mediante la autonomía profesional y el diálogo en academias de zona.',
      queAprendimos: 'La necesidad de flexibilizar tiempos para evitar saturación de los alumnos.',
      indicadoresCambio: {
        proceso: 'Evaluación formativa continua basada en rúbricas situadas.',
        creaa: 'Aumento del 3.5% en la eficiencia terminal de la zona.',
        impactoTerritorial: 'Reconocimiento de los comités de padres a los proyectos estudiantiles.',
      },
      hojaDeRutaProximoCiclo: [
        'Expandir los lazos con universidades locales para orientación vocacional.',
        'Implementar laboratorios virtuales en escuelas sin infraestructura de ciencias.',
        'Consolidar la red de directores para intercambio de insumos pedagógicos.',
      ],
    },
    status: 'completed',
  };
}

describe('Generador DOCX de Cartografía de Zona (Estructura I-IV y Resumen Ejecutivo)', () => {
  // ── TEST 1: Proyecto Completo — Secciones I-IV oficiales ───────────────────
  it('genera el Proyecto Completo DOCX con las 4 secciones I-IV del curso oficial', async () => {
    const project = makeRealisticCartografiaProject();
    const buffer = await generateCartografiaZonaDocx(project);

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000);

    const { value: text } = await mammoth.extractRawText({ buffer });

    // Assert de los 4 títulos exactos según especificación técnica §5
    expect(text).toContain('I. DATOS DE IDENTIFICACIÓN DE LA ZONA');
    expect(text).toContain('II. SÍNTESIS DEL DIAGNÓSTICO TERRITORIAL');
    expect(text).toContain('III. ESTABLECIMIENTO DE METAS INTEGRADAS DE ZONA');
    expect(text).toContain('IV. ESTRATEGIAS, ACCIONES Y SEGUIMIENTO');

    // Datos institucionales
    expect(text).toContain('SECRETARÍA DE EDUCACIÓN PÚBLICA DEL ESTADO DE PUEBLA');
    expect(text).toContain('Zona Escolar 004');
    expect(text).toContain('Mtro. José Luis Benítez');
    expect(text).toContain('Bachillerato Digital Núm. 153');
    expect(text).toContain('21EBH1039R');
    expect(text).toContain('Centro de Salud Comunitario CESSA');
    expect(text).toContain('Homologación y seguimiento a resultados diagnósticos');
    expect(text).toContain('VALIDACIÓN Y AUTORIZACIÓN OFICIAL');
  });

  // ── TEST 2: Null-Safety en Proyecto Completo (D5) ──────────────────────────
  it('maneja con null-safety proyectos vacíos o incompletos sin lanzar error y con placeholders', async () => {
    const emptyProject = {
      zonaNumero: '015',
      cicloEscolar: '2026-2027',
    } as unknown as CartografiaZonaProject;

    await expect(generateCartografiaZonaDocx(emptyProject)).resolves.not.toThrow();

    const buffer = await generateCartografiaZonaDocx(emptyProject);
    const { value: text } = await mammoth.extractRawText({ buffer });

    expect(text).toContain('I. DATOS DE IDENTIFICACIÓN DE LA ZONA');
    expect(text).toContain('II. SÍNTESIS DEL DIAGNÓSTICO TERRITORIAL');
    expect(text).toContain('III. ESTABLECIMIENTO DE METAS INTEGRADAS DE ZONA');
    expect(text).toContain('IV. ESTRATEGIAS, ACCIONES Y SEGUIMIENTO');
    expect(text).toContain('[Pendiente — genere');
  });

  // ── TEST 3: Resumen Ejecutivo — 4 Secciones del Módulo 4 ───────────────────
  it('genera el Resumen Ejecutivo DOCX con las 4 secciones del Módulo 4', async () => {
    const project = makeRealisticCartografiaProject();
    const buffer = await generateResumenEjecutivoDocx(project);

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000);

    const { value: text } = await mammoth.extractRawText({ buffer });

    // Assert de los 5 títulos exactos según especificación técnica §5
    expect(text).toContain('RESUMEN EJECUTIVO DE LA CARTOGRAFÍA DE ZONA');
    expect(text).toContain('1. DIAGNÓSTICO TERRITORIAL');
    expect(text).toContain('2. SISTEMATIZACIÓN DE LA AUTONOMÍA');
    expect(text).toContain('3. ANÁLISIS DE EFECTIVIDAD');
    expect(text).toContain('4. HOJA DE RUTA (CICLO 2026-2027)');

    // Contenido de la memoria pedagógica
    expect(text).toContain('Indicador CREAA: Aumento del 3.5% en la eficiencia terminal de la zona.');
    expect(text).toContain('Expandir los lazos con universidades locales');
    expect(text).toContain('Mtro. José Luis Benítez');
  });

  // ── TEST 4: Null-Safety en Resumen Ejecutivo (D5) ──────────────────────────
  it('genera el Resumen Ejecutivo con null-safety cuando falta la memoria pedagógica', async () => {
    const projectSinMemoria = {
      zonaNumero: '004',
      supervisorName: 'Supervisión Oficial',
      cicloEscolar: '2026-2027',
    } as unknown as CartografiaZonaProject;

    await expect(generateResumenEjecutivoDocx(projectSinMemoria)).resolves.not.toThrow();

    const buffer = await generateResumenEjecutivoDocx(projectSinMemoria);
    const { value: text } = await mammoth.extractRawText({ buffer });

    expect(text).toContain('RESUMEN EJECUTIVO DE LA CARTOGRAFÍA DE ZONA');
    expect(text).toContain('1. DIAGNÓSTICO TERRITORIAL');
    expect(text).toContain('2. SISTEMATIZACIÓN DE LA AUTONOMÍA');
    expect(text).toContain('3. ANÁLISIS DE EFECTIVIDAD');
    expect(text).toContain('4. HOJA DE RUTA (CICLO 2026-2027)');
  });
});
