/**
 * src/lib/assistant/cross-program-context.ts
 * SACRINT Systems IA · SAPCU
 * Conciencia Contextual Transversal entre los 5 Programas Oficiales.
 * 
 * Permite que el asistente pedagógico comparta y cruce información didáctica
 * y operativa entre Planeaciones Didácticas, PAEC-PEC, PMC CREAA, Cartografía de Zona y Horarios.
 */

import type {
  ContextoAsistente,
  IProgramSystem,
  ProgramaPlataforma,
  QuickAction,
} from "@/types/assistant";

export interface CrossProgramBridge {
  sourceProgram: ProgramaPlataforma;
  targetProgram: ProgramaPlataforma;
  sharedDataKeys: string[];
  suggestedCrossActions: QuickAction[];
}

export const PROGRAM_SYSTEM_REGISTRY: Record<ProgramaPlataforma, IProgramSystem> = {
  planeaciones: {
    id: "planeaciones",
    name: "Planeación Didáctica",
    description: "Diseño curricular oficial MCCEMS Puebla con metodologías activas y Reto Situado.",
    routePrefix: "/planeacion",
    supportedRoles: ["docente", "coordinador", "supervisor"],
    supportedLevels: ["media_superior", "secundaria"],
    quickActions: [
      {
        id: "gen-reto",
        titulo: "Formular Reto Situado 4/4",
        etiqueta: "Formular Reto Situado 4/4",
        prompt: "Formula un Reto Situado alineado al contexto local de Puebla y al problema del PAEC.",
        categoria: "redaccion",
        campoObjetivo: "retoSituado",
      },
      {
        id: "val-saberes",
        titulo: "Verificar Tres Saberes",
        etiqueta: "Verificar Tres Saberes",
        prompt: "Verifica que la planeación cubra el Saber Teórico, Saber Hacer Práctico y Saber Ser Actitudinal.",
        categoria: "evaluacion",
      },
      {
        id: "norm-eval",
        titulo: "Normalizar Evaluación 100%",
        etiqueta: "Normalizar Evaluación 100%",
        prompt: "Verifica que la tabla de evaluación general sume exactamente 100% respetando la ponderación formativa.",
        categoria: "normativa",
      },
    ],
  },
  paec: {
    id: "paec",
    name: "PAEC / Proyecto Escolar Comunitario",
    description: "Programa Aula, Escuela y Comunidad para vinculación comunitaria y territorial.",
    routePrefix: "/paec",
    supportedRoles: ["docente", "director", "supervisor", "comite"],
    supportedLevels: ["media_superior", "secundaria", "primaria", "preescolar"],
    quickActions: [
      {
        id: "paec-problema",
        titulo: "Delimitar Problemática Comunitaria",
        etiqueta: "Delimitar Problemática Comunitaria",
        prompt: "Redacta una problemática comunitaria situada con indicadores cuantitativos y cualitativos.",
        categoria: "redaccion",
        campoObjetivo: "problem",
      },
      {
        id: "paec-actividad",
        titulo: "Vincular con Asignaturas",
        etiqueta: "Vincular con Asignaturas",
        prompt: "Sugiere actividades transversales para articular esta problemática con las asignaturas del semestre.",
        categoria: "estrategia",
      },
    ],
  },
  pmc: {
    id: "pmc",
    name: "Programa de Mejora Continua (PMC CREAA)",
    description: "Planeación y seguimiento institucional bajo las fases CREAA.",
    routePrefix: "/pmc",
    supportedRoles: ["director", "supervisor", "coordinador"],
    supportedLevels: ["media_superior", "secundaria", "primaria"],
    quickActions: [
      {
        id: "pmc-meta",
        titulo: "Redactar Meta SMART CREAA",
        etiqueta: "Redactar Meta SMART CREAA",
        prompt: "Formula una meta SMART medible y alcanzable para la dimensión académica seleccionada.",
        categoria: "redaccion",
      },
      {
        id: "pmc-accion",
        titulo: "Proponer Acciones Operativas",
        etiqueta: "Proponer Acciones Operativas",
        prompt: "Diseña un cronograma de acciones con responsables, tiempos y evidencias verificables.",
        categoria: "estrategia",
      },
    ],
  },
  cartografia: {
    id: "cartografia",
    name: "Cartografía de Zona",
    description: "Mapeo curricular, diagnóstico territorial y supervisión por zona escolar.",
    routePrefix: "/cartografia",
    supportedRoles: ["supervisor", "director", "planeador"],
    supportedLevels: ["media_superior"],
    quickActions: [
      {
        id: "carto-diagnostico",
        titulo: "Sintetizar Diagnóstico Territorial",
        etiqueta: "Sintetizar Diagnóstico Territorial",
        prompt: "Resume los factores sociodemográficos y de infraestructura de los planteles de la zona escolar.",
        categoria: "normativa",
      },
    ],
  },
  horarios: {
    id: "horarios",
    name: "Optimización de Horarios",
    description: "Generador de mallas horarias escolares y distribución de cargas docentes.",
    routePrefix: "/horarios",
    supportedRoles: ["director", "subdirector", "coordinador"],
    supportedLevels: ["media_superior", "secundaria"],
    quickActions: [
      {
        id: "horario-carga",
        titulo: "Verificar Carga por UAC",
        etiqueta: "Verificar Carga por UAC",
        prompt: "Valida que la carga horaria semanal cuadre con las horas oficiales del mapa curricular.",
        categoria: "normativa",
      },
    ],
  },
  pips: {
    id: "pips",
    name: "PIPS Institucional",
    description: "Proyecto Integral de Prácticas y Servicio.",
    routePrefix: "/pips",
    supportedRoles: ["docente", "coordinador"],
    supportedLevels: ["media_superior"],
    quickActions: [],
  },
  general: {
    id: "general",
    name: "Asistente SACRINT",
    description: "Copiloto pedagógico general de la plataforma.",
    routePrefix: "/",
    supportedRoles: ["docente", "director", "supervisor"],
    supportedLevels: ["media_superior", "superior", "secundaria", "primaria", "preescolar"],
    quickActions: [],
  },
};

export const PROGRAM_REGISTRY = PROGRAM_SYSTEM_REGISTRY;

export interface CrossProgramContextResult {
  activeProgram: IProgramSystem;
  primaryEntityName?: string;
  relatedProgramIds: ProgramaPlataforma[];
  integrationNotes: string[];
  contexto: ContextoAsistente;
}

/**
 * Conecta el contexto entre dos programas para permitir transversalidad en tiempo real.
 */
export function buildCrossProgramContext(
  contexto: ContextoAsistente,
  relatedData?: {
    paecData?: { projectName?: string; problem?: string };
    cartografiaData?: { cct?: string; zona?: string };
    pmcData?: { metaPrincipal?: string; fase?: string };
  }
): CrossProgramContextResult & ContextoAsistente {
  const enriched = { ...contexto };
  const activeProgram = PROGRAM_SYSTEM_REGISTRY[contexto.programa] || PROGRAM_SYSTEM_REGISTRY.general;
  const relatedProgramIds: ProgramaPlataforma[] = [];
  const integrationNotes: string[] = [];

  let primaryEntityName = contexto.detallesMediaSuperior?.uac;

  if (contexto.programa === "planeaciones") {
    relatedProgramIds.push("paec");
    integrationNotes.push("Articulado con problemáticas del PAEC territorial.");
    if (relatedData?.paecData) {
      enriched.detallesMediaSuperior = {
        ...enriched.detallesMediaSuperior,
        paecNombre: relatedData.paecData.projectName || enriched.detallesMediaSuperior?.paecNombre,
        paecProblema: relatedData.paecData.problem || enriched.detallesMediaSuperior?.paecProblema,
      };
    }
  } else if (contexto.programa === "paec") {
    primaryEntityName = contexto.detallesMediaSuperior?.paecNombre;
    relatedProgramIds.push("planeaciones", "pmc");
    integrationNotes.push("Vínculo bidireccional con Planeaciones y Metas del PMC CREAA.");
  } else if (contexto.programa === "pmc") {
    primaryEntityName = contexto.plantel?.nombre;
    relatedProgramIds.push("paec", "cartografia");
    integrationNotes.push("Alineación con diagnóstico de Cartografía de Zona y PAEC.");
  } else if (contexto.programa === "horarios") {
    primaryEntityName = contexto.plantel?.nombre || contexto.documentoId;
    relatedProgramIds.push("cartografia", "planeaciones");
    integrationNotes.push("Validación contra mapa curricular de Cartografía y asignaturas de Planeaciones.");
  } else if (contexto.programa === "cartografia") {
    primaryEntityName = contexto.plantel?.nombre || contexto.documentoId;
    relatedProgramIds.push("horarios", "planeaciones");
    integrationNotes.push("Estructura base de asignaturas y grupos para Horarios y Planeaciones.");
  }

  return Object.assign(enriched, {
    activeProgram,
    primaryEntityName,
    relatedProgramIds,
    integrationNotes,
    contexto: enriched,
  });
}

export function getProgramBridgeSummary(programa: ProgramaPlataforma): string {
  const prog = PROGRAM_SYSTEM_REGISTRY[programa] || PROGRAM_SYSTEM_REGISTRY.general;
  return `[${prog.name}] - Ruta: ${prog.routePrefix || "/"}. ${prog.description}`;
}
