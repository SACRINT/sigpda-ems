// src/types/pmc.ts
/**
 * Tipos oficiales para el Programa de Mejora Continua (PMC)
 * SIGPDA-EMS · SEMS Puebla MCCEMS
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
  reprobacion_meta?: number;
  abandono_meta?: number;
  et_meta?: number;
  matricula?: number;
  matricula_meta?: number;
  promedio_f11?: number;
  promedio_meta?: number;
}

export interface PmcStatisticalPlantel {
  cct: string;
  nombre: string;
  turno: string;
  // ── Del 911.7G (Fin de Cursos / Inicio) ──────────────────────────
  matricula: number;           // Del 911.7G
  egresados?: number;          // Del 911.7G (conteo de egresados; la Eficiencia Terminal oficial es generacional y no se calcula dividiendo entre matrícula)
  aprobados?: number;          // Del 911.7G
  reprobados?: number;         // Del 911.7G
  bajasDefinitivas?: number;   // Del 911.7G → para calcular Abandono
  eficienciaTerminal?: number; // Porcentaje oficial generacional impreso (opcional si la columna no viene en la matriz)
  abandono: number;            // Calculada: (bajasDefinitivas / matrículaInicial) × 100
  reprobacion: number;         // % Reprobación oficial (compatibilidad con cálculos de zona)

  // ── Del F11C (Control Escolar) ───────────────────────────────────
  promedioGeneral: number;     // Promedio general del grupo/alumno
  promediosPorAsignatura: Record<string, number>; // ej: { "Pensamiento Matemático": 7.5, "Lenguaje y Comunicación": 8.2 }
  aprobadosPorcentaje: number;
  reprobadosPorcentaje: number;
  estudiantesAprobados?: number;   // Compatibilidad
  promedioCalificaciones?: number; // Compatibilidad

  // ── EDIEMS/ESA (evaluaciones externas SEMS, independientes del F11) ───
  ediemsPre?: number;
  ediemsPost?: number;
  esaPre?: number;
  esaPost?: number;
}

export interface PmcStatisticalZona {
  zonaNumero?: string;
  totalPlanteles: number;
  matriculaTotal: number;
  promedioAbandono: number;
  promedioEficiencia: number;
  promedioReprobacion: number;
  promedioCalificaciones?: number;
  brechasDiagnostico: {
    brechaAbandonoVsZona: number;
    brechaEficienciaVsZona?: number;
    brechaReprobacionVsZona: number;
    prioridadIntervencion: 'alta' | 'media' | 'baja';
    observaciones: string[];
  };
}

export interface PmcStatisticalContext {
  fuente: 'formato_911' | 'formato_f11' | 'matriz_combinada_excel' | 'manual';
  plantel: PmcStatisticalPlantel;
  zona?: PmcStatisticalZona;
  cicloEscolar?: string;
  parsedAt: string;
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
  statistical_context?: PmcStatisticalContext;
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
