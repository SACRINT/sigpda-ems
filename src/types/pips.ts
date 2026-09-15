// src/types/pips.ts
export interface PipsPlantele {
  no: number;
  cct: string;
  nombre: string;
  localidad: string;
  municipio: string;
  hombres: number;
  mujeres: number;
  total: number;
}

export interface PipsProblematica {
  id: string;
  titulo: string;
  descripcion: string;
  prioridad: 'alta' | 'media' | 'baja';
  planteles_afectados?: string[];
}

export interface PipsObjetivo {
  id: string;
  numero: number;
  descripcion: string;
  metas: { meta: string; indicador: string; responsable: string; fecha: string }[];
}

export interface PipsCronogramaActividad {
  actividad: string;
  objetivo: string;
  responsable: string;
  mes: string;
  recursos: string;
  indicador: string;
}

export interface PipsProject {
  id?: string;
  teacher_id?: string;
  // Paso 1 — Datos generales
  zona_clave: string;
  zona_nombre: string;
  supervisor_name: string;
  municipio_sede: string;
  municipios_atiende: string;
  num_planteles: number;
  subsistema: string;
  modalidad: string;
  ciclo_escolar: string;
  atps: string;
  // Paso 2 — Presentación
  presentacion_supervisor: string;
  // Paso 3 — Reflexión PIPS anterior
  pips_anterior_realizado: boolean;
  reflexion_pips_anterior: string;
  fortalezas_anterior: string;
  areas_oportunidad_anterior: string;
  // Paso 4 — Planteles
  planteles_json: PipsPlantele[];
  // Paso 5 — Diagnóstico
  diagnostico_contexto: string;
  problematicas_json: PipsProblematica[];
  // Paso 6 — Objetivos
  objetivo_general: string;
  objetivos_especificos_json: PipsObjetivo[];
  // Paso 7 — Cronograma
  cronograma_json: PipsCronogramaActividad[];
  // Paso 8 — Evaluación / cierre
  evaluacion_json: { indicador: string; meta: string; instrumento: string }[];
  // Meta
  generated_content?: string;
  current_step: number;
  status: 'draft' | 'completed';
  created_at?: string;
  updated_at?: string;
}

export interface PipsAuditCriterion {
  id: string;
  dimension: string;
  name: string;
  description: string;
  weight: number;
  maxScore: number;
  score: number;
  status: 'pass' | 'warning' | 'fail';
  feedback: string;
  evidenceFound: string;
}

export interface PipsQualityAudit {
  totalScore: number;
  maxPossibleScore: number;
  percentage: number;
  overallStatus: 'EXCELENTE' | 'SATISFACTORIO' | 'EN_DESARROLLO' | 'REQUIERE_REVISION';
  passedCriteria: number;
  warningCriteria: number;
  failedCriteria: number;
  criteria: PipsAuditCriterion[];
  dimensionScores: Record<string, { score: number; maxScore: number; percentage: number }>;
  strengths: string[];
  criticalRecommendations: string[];
  auditedAt: string;
}

