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

export const PROGRAM_REGISTRY: Record<ProgramaPlataforma, IProgramSystem> = {
  planeaciones: {
    id: "planeaciones",
    name: "Planeación Didáctica",
    description: "Diseño curricular oficial DBEPA / MCCEMS con metodologías activas y Reto Situado.",
    supportedLevels: ["media_superior", "secundaria"],
    quickActions: [
      {
        id: "gen-reto",
        titulo: "Formular Reto Situado 4/4",
        prompt: "Formula un Reto Situado alineado al contexto local de Puebla y al problema del PAEC.",
        categoria: "redaccion",
        campoObjetivo: "retoSituado",
      },
      {
        id: "val-saberes",
        titulo: "Verificar Tres Saberes",
        prompt: "Verifica que la planeación cubra el Saber Teórico, Saber Hacer Práctico y Saber Ser Actitudinal.",
        categoria: "evaluacion",
      },
      {
        id: "norm-eval",
        titulo: "Normalizar Evaluación 100%",
        prompt: "Verifica que la tabla de evaluación general sume exactamente 100% respetando la ponderación formativa.",
        categoria: "normativa",
      },
    ],
  },
  paec: {
    id: "paec",
    name: "PAEC / Proyecto Escolar Comunitario",
    description: "Programa Aula, Escuela y Comunidad para vinculación comunitaria y territorial.",
    supportedLevels: ["media_superior", "secundaria", "primaria", "preescolar"],
    quickActions: [
      {
        id: "paec-problema",
        titulo: "Delimitar Problemática Comunitaria",
        prompt: "Redacta una problemática comunitaria situada con indicadores cuantitativos y cualitativos.",
        categoria: "redaccion",
        campoObjetivo: "problem",
      },
      {
        id: "paec-actividad",
        titulo: "Vincular con Asignaturas",
        prompt: "Sugiere actividades transversales para articular esta problemática con las asignaturas del semestre.",
        categoria: "estrategia",
      },
    ],
  },
  pmc: {
    id: "pmc",
    name: "Programa de Mejora Continua (PMC CREAA)",
    description: "Planeación y seguimiento institucional bajo las fases CREAA.",
    supportedLevels: ["media_superior", "secundaria", "primaria"],
    quickActions: [
      {
        id: "pmc-meta",
        titulo: "Redactar Meta SMART CREAA",
        prompt: "Formula una meta SMART medible y alcanzable para la dimensión académica seleccionada.",
        categoria: "redaccion",
      },
      {
        id: "pmc-accion",
        titulo: "Proponer Acciones Operativas",
        prompt: "Diseña un cronograma de acciones con responsables, tiempos y evidencias verificables.",
        categoria: "estrategia",
      },
    ],
  },
  cartografia: {
    id: "cartografia",
    name: "Cartografía de Zona",
    description: "Mapeo curricular, diagnóstico territorial y supervisión por zona escolar.",
    supportedLevels: ["media_superior"],
    quickActions: [
      {
        id: "carto-diagnostico",
        titulo: "Sintetizar Diagnóstico Territorial",
        prompt: "Resume los factores sociodemográficos y de infraestructura de los planteles de la zona escolar.",
        categoria: "normativa",
      },
    ],
  },
  horarios: {
    id: "horarios",
    name: "Optimización de Horarios",
    description: "Generador de mallas horarias escolares y distribución de cargas docentes.",
    supportedLevels: ["media_superior", "secundaria"],
    quickActions: [
      {
        id: "horario-carga",
        titulo: "Verificar Carga por UAC",
        prompt: "Valida que la carga horaria semanal cuadre con las horas oficiales del mapa curricular.",
        categoria: "normativa",
      },
    ],
  },
  pips: {
    id: "pips",
    name: "PIPS Institucional",
    description: "Proyecto Integral de Prácticas y Servicio.",
    supportedLevels: ["media_superior"],
    quickActions: [],
  },
  general: {
    id: "general",
    name: "Asistente SACRINT",
    description: "Copiloto pedagógico general de la plataforma.",
    supportedLevels: ["media_superior", "superior", "secundaria", "primaria", "preescolar"],
    quickActions: [],
  },
};

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
): ContextoAsistente {
  const enriched = { ...contexto };

  if (contexto.programa === "planeaciones" && relatedData?.paecData) {
    enriched.detallesMediaSuperior = {
      ...enriched.detallesMediaSuperior,
      paecNombre: relatedData.paecData.projectName || enriched.detallesMediaSuperior?.paecNombre,
      paecProblema: relatedData.paecData.problem || enriched.detallesMediaSuperior?.paecProblema,
    };
  }

  return enriched;
}
