/**
 * src/lib/cartografia-context-builder.ts
 * Utilidad compartida para reconstruir el contexto base de Cartografía de Zona Escolar
 * (Momentos 1 y 2, identificación y promedios) a partir de una fila de base de datos.
 * Resuelve duplicación entre la API de generación y el exportador PDF oficial (H-011, H-013).
 */

import type {
  CartografiaPlantelItem,
  CartografiaMomento1Conocer,
  CartografiaMomento2Organizar,
  CartografiaMomento3Ubicar,
  CartografiaMomento4Analizar,
  CartografiaMomento5Decidir,
  CartografiaMemoriaPedagogica,
} from '@/types/cartografia';
import type { CartografiaIdentificacion } from '@/lib/prompts/cartografia-prompts';

export interface CartografiaBaseContext {
  identificacion: CartografiaIdentificacion;
  planteles: CartografiaPlantelItem[];
  matriculaTotalZona: number;
  promAbandono: number;
  promEficiencia: number;
  promAprovechamiento: number;
  promReprobacion: number;
  plantelesAtencionPrioritaria: string[];
  momento1: CartografiaMomento1Conocer;
  momento2: CartografiaMomento2Organizar;
}

/**
 * Reconstruye el contexto base de la Cartografía (Identificación, Momento 1 y Momento 2)
 * a partir de un registro de `pips_projects`.
 */
export function buildCartografiaBaseContext(
  row: Record<string, unknown>,
  teacher?: { name?: string | null; email?: string | null }
): CartografiaBaseContext {
  const atpsList = Array.isArray(row.atps)
    ? (row.atps as string[])
    : typeof row.atps === 'string'
    ? row.atps.split(',').map((s: string) => s.trim()).filter(Boolean)
    : [];

  const identificacion: CartografiaIdentificacion = {
    zonaNumero: String(row.zona_nombre || '004').replace(/[^0-9]/g, '') || '004',
    zonaClave: String(row.zona_clave || '21FMS0004Z'),
    supervisorName: String(row.supervisor_name || teacher?.name || 'Supervisor(a) Escolar'),
    municipioSede: String(row.municipio_sede || 'Venustiano Carranza'),
    municipiosAtiende: String(row.municipios_atiende || 'Venustiano Carranza, Francisco Z. Mena, Pantepec, Jalpan'),
    subsistema: String(row.subsistema || 'Bachilleratos Estatales'),
    cicloEscolar: String(row.ciclo_escolar || '2026-2027'),
    atps: atpsList,
  };

  const rawPlanteles = Array.isArray(row.planteles_json) ? (row.planteles_json as Record<string, unknown>[]) : [];
  const planteles: CartografiaPlantelItem[] = rawPlanteles.map((p, idx) => ({
    no: idx + 1,
    cct: String(p.cct || `CCT-${idx + 1}`),
    nombre: String(p.nombre || `Bachillerato ${idx + 1}`),
    localidad: String(p.localidad || 'Comunidad escolar'),
    municipio: String(p.municipio || row.municipio_sede || identificacion.municipioSede),
    turno: String(p.turno || 'MATUTINO'),
    matricula: Number(p.matricula) || Number(p.total) || 0,
    egresados: Number(p.egresados) || 0,
    bajasDefinitivas: Number(p.bajasDefinitivas) || 0,
    eficienciaTerminal: Number(p.eficienciaTerminal) || 85,
    abandono: Number(p.abandono) || 5,
    reprobacion: Number(p.reprobacion) || 8,
    promedioGeneral: Number(p.promedioGeneral) || Number(p.promedioCalificaciones) || 8.0,
    paecProyecto: String(p.paecProyecto || 'Proyecto Comunitario Integrador en proceso'),
    paecProblematica: String(p.paecProblematica || 'Reto socioformativo del entorno local'),
  }));

  const matriculaTotalZona = planteles.reduce((sum, p) => sum + p.matricula, 0);
  const plantelesConMatricula = planteles.filter((p) => p.matricula > 0);
  const divisor = plantelesConMatricula.length > 0 ? plantelesConMatricula.length : (planteles.length || 1);

  const promAbandono = parseFloat((plantelesConMatricula.reduce((a, b) => a + b.abandono, 0) / divisor).toFixed(2));
  const promEficiencia = parseFloat((plantelesConMatricula.reduce((a, b) => a + b.eficienciaTerminal, 0) / divisor).toFixed(2));
  const promAprovechamiento = parseFloat((plantelesConMatricula.reduce((a, b) => a + b.promedioGeneral, 0) / divisor).toFixed(2));
  const promReprobacion = parseFloat((plantelesConMatricula.reduce((a, b) => a + b.reprobacion, 0) / divisor).toFixed(2));

  const plantelesAtencionPrioritaria = planteles
    .filter((p) => p.abandono > promAbandono + 3 || p.eficienciaTerminal < promEficiencia - 5)
    .map((p) => `${p.nombre} (Abandono: ${p.abandono}%, ET: ${p.eficienciaTerminal}%)`);

  const rawProblems = Array.isArray(row.problematicas_json) ? (row.problematicas_json as Record<string, unknown>[]) : [];
  const problematicasComunes = rawProblems.map((pr) => String(pr.titulo || pr.descripcion || '')).filter(Boolean);

  const momento1: CartografiaMomento1Conocer = {
    planteles,
    matriculaTotalZona,
    municipiosCobertura: [identificacion.municipioSede, identificacion.municipiosAtiende].filter(Boolean),
    sedesPlanteles: planteles.map((p) => `${p.nombre} [${p.cct}]`),
    caracterizacionInicial: String(row.diagnostico_contexto || `Zona escolar ${identificacion.zonaNumero} con ${planteles.length} planteles y una matrícula total atendida de ${matriculaTotalZona} estudiantes.`),
  };

  const momento2: CartografiaMomento2Organizar = {
    capaCuantitativa: {
      promedioAbandonoZona: promAbandono,
      promedioEficienciaZona: promEficiencia,
      promedioAprovechamientoZona: promAprovechamiento,
      promedioReprobacionZona: promReprobacion,
      matriculaTotal: matriculaTotalZona,
      plantelesAtencionPrioritaria,
      resumenEstadistico911F11: `Análisis consolidado 911/F11: Abandono ${promAbandono}%, Eficiencia Terminal ${promEficiencia}%, Aprovechamiento ${promAprovechamiento}, Reprobación ${promReprobacion}%.`,
    },
    capaCualitativa: {
      problematicasComunes: problematicasComunes.length > 0 ? problematicasComunes : [
        'Vulnerabilidad económica y trabajo estudiantil vespertino o por temporadas.',
        'Dificultades de transporte y dispersión geográfica en comunidades de origen.',
        'Brechas de conectividad digital en planteles y hogares rurales.',
      ],
      factoresContextuales: ['Actividades agropecuarias y comerciales locales predominantes.'],
      vinculacionPaecZona: planteles.map((p) => `${p.nombre}: ${p.paecProyecto}${p.paecProblematica ? ` (${p.paecProblematica})` : ''}`),
      desafiosSocioeconomicos: 'Dispersión territorial y traslados prolongados que elevan el riesgo de deserción en primeros semestres.',
    },
  };

  return {
    identificacion,
    planteles,
    matriculaTotalZona,
    promAbandono,
    promEficiencia,
    promAprovechamiento,
    promReprobacion,
    plantelesAtencionPrioritaria,
    momento1,
    momento2,
  };
}

export interface CartografiaMomentos3a5 {
  momento3Ubicar: CartografiaMomento3Ubicar;
  momento4Analizar: CartografiaMomento4Analizar;
  momento5Decidir: CartografiaMomento5Decidir;
  memoriaPedagogica?: CartografiaMemoriaPedagogica;
}

/**
 * Obtiene los Momentos 3, 4, 5 y Memoria Pedagógica desde el registro de base de datos,
 * o provee estructuras de respaldo (fallbacks) alineadas a lineamientos DBEPA Puebla
 * si aún no han sido generados mediante IA (H-013).
 */
export function getCartografiaMomentos(
  row: Record<string, unknown>,
  plantelesCount: number = 0
): CartografiaMomentos3a5 {
  const momento3Ubicar: CartografiaMomento3Ubicar = (row.momento3_ubicar as CartografiaMomento3Ubicar) || {
    descripcionTerritorial: 'Mapeo contextual en proceso de integración territorial.',
    comunidadesProcedencia: ['Comunidades de influencia de la zona escolar'],
    movilidadTransporte: 'Rutas de transporte terrestre con tiempos variables de traslado.',
    conectividadInfraestructura: 'Conectividad básica disponible en centros escolares.',
    recursosAliados: [
      {
        nombre: 'Centro Comunitario de Salud',
        tipo: 'salud',
        ubicacion: String(row.municipio_sede || 'Cabecera Municipal'),
        vinculacionPedagogica: 'Prevención de riesgos y hábitos saludables',
      },
    ],
    mapaContextual: `Distribución territorial de los ${plantelesCount} planteles de la zona.`,
  };

  const momento4Analizar: CartografiaMomento4Analizar = (row.momento4_analizar as CartografiaMomento4Analizar) || {
    triangulacion: {
      directivos: 'Gestión directiva orientada a la permanencia y clima armónico.',
      docentes: 'Retos pedagógicos centrados en la contextualización de progresiones.',
      alumnosFamilias: 'Necesidad de pertinencia social y apoyo a trayectorias educativas.',
      supervisionAtp: 'Acompañamiento situado y asesoría pedagógica continua.',
    },
    patronesRecurrentes: ['Dispersión y necesidades de flexibilización curricular.'],
    retosPedagogicosCreaa: ['Abatir el rezago en habilidades fundamentales de pensamiento.'],
    acuerdosAutonomiaConsejo: ['Intercambio de planeaciones y proyectos integradores situados.'],
  };

  const momento5Decidir: CartografiaMomento5Decidir = (row.momento5_decidir as CartografiaMomento5Decidir) || {
    metaGeneralZona: `Incrementar en 3.5% la permanencia escolar de los estudiantes de la Zona Escolar mediante acompañamiento situado durante el ciclo ${row.ciclo_escolar || '2026-2027'}.`,
    indicadoresCreaaAsociados: ['Eficiencia terminal', 'Abandono escolar', 'Aprobación general'],
    lineasAccion: [
      {
        numero: 1,
        titulo: 'Acompañamiento a la autonomía docente y curricular situada',
        accionesEspecificas: ['Talleres de codiseño curricular y observación dialógica'],
        recursos: ['Fichas formativas DBEPA'],
        responsables: 'Supervisión y Asesores Técnicos',
        entregables: 'Portafolio de secuencias didácticas',
        estrategiaSeguimiento: 'Cortes bimestrales en Consejo Técnico',
        periodoEjecucion: 'Ciclo Escolar 2026-2027',
      },
      {
        numero: 2,
        titulo: 'Acompañamiento directivo para la gestión participativa y clima escolar',
        accionesEspecificas: ['Círculos de liderazgo pedagógico y protocolos de permanencia'],
        recursos: ['Guías de gestión directiva'],
        responsables: 'Supervisión y Directores',
        entregables: 'Diagnóstico de clima escolar y actas de acuerdos',
        estrategiaSeguimiento: 'Reuniones de zona',
        periodoEjecucion: 'Ciclo Escolar 2026-2027',
      },
      {
        numero: 3,
        titulo: 'Acompañamiento integral a las trayectorias formativas y proyectos comunitarios',
        accionesEspecificas: ['Tutoría y seguimiento nominal de estudiantes en riesgo'],
        recursos: ['Formatos PAEC y sistema de alerta'],
        responsables: 'Tutores escolares y comités de vinculación',
        entregables: 'Padrón de seguimiento a trayectorias',
        estrategiaSeguimiento: 'Evaluaciones parciales',
        periodoEjecucion: 'Ciclo Escolar 2026-2027',
      },
    ],
    compromisosSupervision: ['Visitas de acompañamiento situado al 100% de los planteles.'],
  };

  const memoriaPedagogica: CartografiaMemoriaPedagogica | undefined = row.memoria_pedagogica as CartografiaMemoriaPedagogica | undefined;

  return {
    momento3Ubicar,
    momento4Analizar,
    momento5Decidir,
    memoriaPedagogica,
  };
}
