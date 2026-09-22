/**
 * src/types/assistant.ts
 * SACRINT Systems IA · SAPCU (Sistema de Asistente Pedagógico Contextual Universal)
 * Tipos y esquemas de dominio para soporte pedagógico multi-nivel.
 */

export type NivelEducativo =
  | "preescolar"
  | "primaria"
  | "secundaria"
  | "media_superior"
  | "superior";

export type ProgramaPlataforma =
  | "planeaciones"
  | "paec"
  | "pmc"
  | "pips"
  | "horarios"
  | "cartografia"
  | "general";

export interface ContextoMediaSuperior {
  uac?: string;
  campoFormativo?: string;
  semestre?: number;
  subsistema?: "bge" | "tecnologico" | "general";
  bloque?: number;
  horasSemanales?: number;
  metodologiaActiva?: string;
  retoSituado?: {
    contextoReal?: string;
    problemaComunidad?: string;
    accionCognitiva?: string;
    productoEvidencia?: string;
  };
  tresSaberes?: {
    conceptual?: string;
    procedimental?: string;
    actitudinal?: string;
  };
  paecNombre?: string;
  paecProblema?: string;
}

export interface ContextoNivelBasico {
  fase?: 1 | 2 | 3 | 4 | 5 | 6; // Fases NEM
  campoFormativo?: string; // Lenguajes, Saberes y Pensamiento Científico, etc.
  ejeArticulador?: string; // Inclusión, Pensamiento Crítico, etc.
  contenido?: string;
  pda?: string; // Procesos de Desarrollo de Aprendizaje
}

export interface ContextoNivelSuperior {
  carrera?: string;
  asignatura?: string;
  creditosSatca?: number;
  competenciaEspecifica?: string;
  criterioDesempeno?: string;
}

export interface ContextoAsistente {
  nivel: NivelEducativo;
  programa: ProgramaPlataforma;
  pantallaActiva?: string; // e.g. "detalles", "nuevo", "secuencia", "fundamentos"
  seccionActiva?: string; // e.g. "pestaña-evaluador", "pestaña-secuencia"
  campoEnFoco?: string; // e.g. "retoSituado", "materiales", "estrategias"
  documentoId?: string;
  plantel?: {
    cct?: string;
    nombre?: string;
    subsistema?: string;
  };
  usuario?: {
    id?: string;
    nombre?: string;
    rol?: string;
  };
  detallesMediaSuperior?: ContextoMediaSuperior;
  detallesBasica?: ContextoNivelBasico;
  detallesSuperior?: ContextoNivelSuperior;
}

export interface AccionSugerida {
  id: string;
  titulo: string;
  prompt: string;
  categoria: "redaccion" | "evaluacion" | "estrategia" | "normativa";
  campoObjetivo?: string;
}

export interface MensajeAsistente {
  id: string;
  rol: "user" | "assistant" | "system";
  contenido: string;
  fechaCreacion: string;
  accionesSugeridas?: AccionSugerida[];
  campoInsercion?: string;
  textoAInsertar?: string;
  evaluacionPedagogica?: {
    valido: boolean;
    criterio: string;
    observaciones: string[];
  };
}

export interface PeticionAsistente {
  mensaje: string;
  contexto: ContextoAsistente;
  historial?: Array<{ rol: "user" | "assistant"; contenido: string }>;
  campoObjetivo?: string;
}

export interface RespuestaAsistente {
  mensaje: string;
  accionesSugeridas: AccionSugerida[];
  sugerenciaInsercion?: {
    campo: string;
    texto: string;
  };
  validacionesPedagogicas?: Array<{
    nivel: "info" | "warning" | "error";
    criterio: string;
    mensaje: string;
  }>;
}

// ---------------------------------------------------------------------------
// Contratos de Interoperabilidad SAPCU Universal (SACRINT Systems IA)
// ---------------------------------------------------------------------------

/**
 * Destino de inserción directa de texto asistido por IA en formulario activo.
 */
export interface InsertionTarget {
  fieldId: string;
  selector?: string;
  targetType: "input" | "textarea" | "custom";
  value?: string;
}

/**
 * Sugerencia pedagógica estructurada emitida por el asistente universal.
 */
export interface AssistantSuggestion {
  id: string;
  fieldId: string;
  suggestedText: string;
  explanation?: string;
  qualityCriteria?: string[];
}

// Alias canónicos para interoperabilidad con contratos IProgramSystem
export type QuickAction = AccionSugerida;
export type AssistantMessage = MensajeAsistente;
export type IAssistantContext = ContextoAsistente;

/**
 * Contrato de integración para cada uno de los 5 programas oficiales SACRINT.
 */
export interface IProgramSystem {
  id: ProgramaPlataforma;
  name: string;
  description: string;
  quickActions: QuickAction[];
  supportedLevels: NivelEducativo[];
}
