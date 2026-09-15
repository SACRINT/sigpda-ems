// src/types/pmc.ts
/**
 * Tipos oficiales para el Programa de Mejora Continua (PMC)
 * SIGPDA-EMS · DBEPA Puebla MCCEMS
 */

export interface PmcStaffMember {
  id?: string;
  nombre: string;
  cargo: string;
  funcion?: string;
  antiguedad?: string | number;
  formacion?: string;
}

export interface PmcIndicadoresAcademicos {
  aprobacion_ant?: number;
  reprobacion_ant?: number;
  abandono_ant?: number;
  et_ant?: number; // Eficiencia Terminal
  aprobacion_meta?: number;
  abandono_meta?: number;
  et_meta?: number;
  matricula?: number;
}

export interface PmcFodaData {
  fortalezas?: string;
  oportunidades?: string;
  debilidades?: string;
  amenazas?: string;
}

export interface PmcCategoriaPriorizada {
  id: string;
  nombre: string;
  temas: string[];
}

export interface PmcDiagnosticoGenerado {
  presentacion?: string;
  contexto?: string;
  analisis_indicadores?: string;
  sintesis_foda?: string;
  priorizacion?: string;
}

export interface PmcMetaInstitucional {
  categoria?: string;
  nombre_categoria?: string;
  tema?: string;
  meta?: string;
  estrategia?: string;
  linea_base?: string;
  personal_designado?: string;
  entregable?: string;
  periodo_inicio?: string;
  periodo_fin?: string;
  diagnostico_meta?: string;
}

export interface PmcMetaPersonal {
  nombre?: string;
  cargo?: string;
  meta_individual?: string;
  estrategia?: string;
  entregable?: string;
  periodo?: string;
}

export interface PmcPlanAccion {
  metas_institucionales?: PmcMetaInstitucional[];
  metas_personales?: PmcMetaPersonal[];
}

export interface PmcProject {
  id: string;
  teacher_id?: string;
  school_name?: string;
  school_cct?: string;
  municipality?: string;
  locality?: string;
  school_zone?: string;
  director_name?: string;
  supervisor_name?: string;
  ciclo_escolar?: string;
  subsystem?: string;
  total_staff?: number;
  staff_data?: PmcStaffMember[] | unknown;
  indicadores_academicos?: PmcIndicadoresAcademicos | unknown;
  foda?: PmcFodaData | unknown;
  categorias_priorizadas?: PmcCategoriaPriorizada[] | unknown;
  diagnostico_comunidad?: string;
  normativa?: Record<string, string> | unknown;
  diagnostico_generado?: PmcDiagnosticoGenerado | unknown;
  plan_accion?: PmcPlanAccion | unknown;
  current_step?: number;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PmcAuditCriterion {
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

export interface PmcQualityAudit {
  totalScore: number;
  maxPossibleScore: number;
  percentage: number;
  overallStatus: 'EXCELENTE' | 'SATISFACTORIO' | 'EN_DESARROLLO' | 'REQUIERE_REVISION';
  passedCriteria: number;
  warningCriteria: number;
  failedCriteria: number;
  criteria: PmcAuditCriterion[];
  dimensionScores: Record<string, { score: number; maxScore: number; percentage: number }>;
  strengths: string[];
  criticalRecommendations: string[];
  auditedAt: string;
}
