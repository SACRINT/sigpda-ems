/**
 * src/types/cartografia.ts
 * Tipos oficiales para la Cartografía de Zona Escolar (DBEPA Puebla MCCEMS 2026-2027)
 * Evolución del PIPS hacia el diagnóstico vivo, territorial y la triangulación pedagógica.
 */

export interface CartografiaPlantelItem {
  no: number;
  cct: string;
  nombre: string;
  localidad: string;
  municipio: string;
  turno: string;
  matricula: number;
  egresados?: number;
  bajasDefinitivas?: number;
  eficienciaTerminal: number;
  abandono: number;
  reprobacion: number;
  promedioGeneral: number;
  paecProyecto?: string;
  paecProblematica?: string;
  director?: string;
  docentesCount?: number;
  ubicacion?: string;
}

export interface RecursoComunitario {
  nombre: string;
  tipo: 'salud' | 'deportivo' | 'cultural' | 'productivo' | 'educativo' | 'comunitario';
  ubicacion: string;
  vinculacionPedagogica: string;
}

// ── MOMENTO 1: CONOCER ──────────────────────────────────────────────────────────
export interface CartografiaMomento1Conocer {
  planteles: CartografiaPlantelItem[];
  matriculaTotalZona: number;
  municipiosCobertura: string[];
  sedesPlanteles: string[];
  caracterizacionInicial: string;
}

// ── MOMENTO 2: ORGANIZAR (Evidencias Multidimensionales) ────────────────────────
export interface CartografiaMomento2Organizar {
  capaCuantitativa: {
    promedioAbandonoZona: number;
    promedioEficienciaZona: number;
    promedioAprovechamientoZona: number;
    promedioReprobacionZona: number;
    matriculaTotal: number;
    plantelesAtencionPrioritaria: string[];
    resumenEstadistico911F11: string;
  };
  capaCualitativa: {
    problematicasComunes: string[];
    factoresContextuales: string[];
    vinculacionPaecZona: string[];
    desafiosSocioeconomicos: string;
  };
}

// ── MOMENTO 3: UBICAR (Mapeo Escuela y Territorio) ─────────────────────────────
export interface CartografiaMomento3Ubicar {
  descripcionTerritorial: string;
  comunidadesProcedencia: string[];
  movilidadTransporte: string;
  conectividadInfraestructura: string;
  recursosAliados: RecursoComunitario[];
  mapaContextual: string;
}

// ── MOMENTO 4: ANALIZAR (Triangulación de Perspectivas) ────────────────────────
export interface TriangulacionPerspectivas {
  directivos: string;       // Visión estratégica sobre gestión y clima escolar
  docentes: string;         // Retos en aula, barreras curriculares, necesidades formativas
  alumnosFamilias: string;  // Pertinencia social, condiciones de vida y aspiraciones
  supervisionAtp: string;   // Acompañamiento situado, asesoría formativa y arbitraje
}

export interface CartografiaMomento4Analizar {
  triangulacion: TriangulacionPerspectivas;
  patronesRecurrentes: string[];
  retosPedagogicosCreaa: string[];
  acuerdosAutonomiaConsejo: string[];
}

// ── MOMENTO 5: DECIDIR (Líneas de Acción y Metas de Zona) ──────────────────────
export interface LineaAccionOficial {
  numero: 1 | 2 | 3;
  titulo: string;
  accionesEspecificas: string[];
  recursos: string[];
  responsables: string;
  entregables: string;
  estrategiaSeguimiento: string;
  periodoEjecucion: string;
}

export interface CartografiaMomento5Decidir {
  metaGeneralZona: string; // Estricta fórmula CREAA: [VERBO] + [%] + [POBLACIÓN] + [ESTRATEGIA] + [PERIODO Y TERRITORIO]
  indicadoresCreaaAsociados: string[];
  lineasAccion: [LineaAccionOficial, LineaAccionOficial, LineaAccionOficial];
  compromisosSupervision: string[];
}

// ── MEMORIA PEDAGÓGICA (Cierre y Trascendencia) ────────────────────────────────
export interface CartografiaMemoriaPedagogica {
  queLogramos: string;       // Resultados comparados con el Modelo Educativo 2025
  comoLoLogramos: string;     // Estrategias y adaptaciones de la autonomía docente
  queAprendimos: string;      // Limitaciones, fortalezas y efectividad de fichas temáticas
  indicadoresCambio: {
    proceso: string;         // Cambios en planeación y evaluación formativa
    creaa: string;           // Impacto comparativo en indicadores CREAA
    impactoTerritorial: string; // Mejora en clima escolar y vinculación con la comunidad
  };
  hojaDeRutaProximoCiclo: string[];
}

// ── PROYECTO INTEGRAL DE CARTOGRAFÍA DE ZONA ──────────────────────────────────
export interface CartografiaZonaProject {
  id?: string;
  zonaNumero: string;
  zonaClave: string;
  supervisorName: string;
  municipioSede: string;
  municipiosAtiende: string;
  subsistema: string;
  cicloEscolar: string;
  atps: string[];
  
  // Los 5 Momentos Oficiales
  momento1Conocer: CartografiaMomento1Conocer;
  momento2Organizar: CartografiaMomento2Organizar;
  momento3Ubicar: CartografiaMomento3Ubicar;
  momento4Analizar: CartografiaMomento4Analizar;
  momento5Decidir: CartografiaMomento5Decidir;
  
  // Memoria Pedagógica
  memoriaPedagogica?: CartografiaMemoriaPedagogica;
  
  // Metadatos
  status: 'draft' | 'completed';
  createdAt?: string;
  updatedAt?: string;
}
