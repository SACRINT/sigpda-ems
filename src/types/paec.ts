export type CycleType = 'A' | 'B' | 'annual';
export type PaecStatus = 'draft' | 'completed';

export interface CommunityContext {
  location?: string;
  demographics?: string;
  economy?: string;
  traditions?: string;
  security?: string;
  environment?: string;
}

export interface SchoolContext {
  enrollment?: string;
  teacherCount?: string;
  indicators?: string;
  previousPrograms?: string;
  facilities?: string;
  activeLaboralUacs?: string[];
  activeFfeUacs?: string[];
  groupsConfig?: string;
  groupsCount?: string;
}

export interface TableRow2Cols {
  col1: string;
  col2: string;
}

export interface FODARow {
  aspect: string;
  analysis: string;
}

export interface Fase1Diagnostico {
  tabla1: TableRow2Cols[]; // Aspecto | Descripción (Comunidad)
  tabla2: TableRow2Cols[]; // Aspecto | Descripción (Educación)
  tabla3: FODARow[];        // Aspecto | Análisis Estratégico FODA
  tabla4: TableRow2Cols[]; // Etapa | Descripción del Proceso
}

export interface ProjectPurpose {
  educativo: string;
  social: string;
  funcional: string;
}

export interface ProjectScope {
  metas: string[];
  participantes: string[];
  recursos: string[];
}

export interface Fase2Justificacion {
  projectName: string;
  introduction: string;
  pilares: string[];
  proposito: ProjectPurpose;
  alcance: ProjectScope;
}

export interface MapeoRow {
  semester: number;
  uacName: string;
  topic: string;
  linking: string;
}

export interface CronogramaRow {
  phase: string;
  objective: string;
  macroActivities: string;
  responsibleSubjects: string;
  semesterInvolved: string;
}

export interface DetalleCurricularRow {
  semester: number;
  uacName: string;
  progressionsOrPurposes: string;
  projectPhases: string;
  curricularJustification: string;
}

export interface PlanOperativoRow {
  phase: string;
  activity: string;
  uac: string;
  progression: string;
  strategy: string;
  week: string;
  responsibles: string;
  evaluationInstrument: string;
}

export interface PlanOperativoData {
  semestreA: PlanOperativoRow[];
  semestreB: PlanOperativoRow[];
}

export interface MinutaAcuerdoItem {
  no: number;
  acuerdo: string;
  responsable: string;
  fechaLimite: string;
  estatus: string;
}

export interface MinutaData {
  cct?: string;
  fecha: string;
  tipoReunion: string;
  acuerdos: MinutaAcuerdoItem[];
  firmas: { cargo: string; nombre: string }[];
}

export interface SeguimientoRow {
  semana: string;
  fase: string;
  uac: string;
  metaOperativa: string;
  evidencia: string;
  avancePorcentaje: number;
  semaforo: 'verde' | 'amarillo' | 'rojo';
}

export interface ReporteMensualData {
  periodo: string;
  resumenEjecutivo?: string;
  logros: string[];
  dificultades: string[];
  accionesAjuste: string[];
}

export interface LikertSurveyItem {
  reactivo: string;
  dimension: string;
}

export interface LikertSurveyData {
  titulo: string;
  tipoAplicacion?: string; // 'PRE' | 'POST' | 'PRE/POST' | 'FINAL'
  reactivos: LikertSurveyItem[];
  escala: Record<string, string>;
}

export interface AnexosData {
  anexo1Minuta?: MinutaData;
  anexo2Seguimiento?: SeguimientoRow[];
  anexo3ReporteMensual?: ReporteMensualData;
  anexo4ImpactoComunidad?: LikertSurveyData;
  anexo5AutoevaluacionEstudiantes?: LikertSurveyData;
  anexo6EvaluacionColegiado?: LikertSurveyData;
  // Compatibilidad hacia atrás para proyectos existentes almacenados como texto/markdown
  anexo1?: string;
  anexo2?: string;
  anexo3?: string;
  anexo4?: string;
  anexo5?: string;
  anexo6?: string;
}

export interface PaecAuditCriterion {
  id: number;
  name: string;
  dimension: string;
  expectedLevel: string; // 'Bueno (4)'
  score: number; // 1 a 4
  status: 'pass' | 'warning' | 'fail';
  feedback: string;
  evidenceFound: string;
}

export interface PaecAuditResult {
  totalScore: number; // Max 92 (23 * 4) o normalizado
  percentage: number;
  status: 'aprobado_excelente' | 'aprobado' | 'requiere_ajustes';
  criteria: PaecAuditCriterion[];
  summary: {
    passedCount: number;
    warningCount: number;
    failedCount: number;
  };
}

export interface PaecProject {
  id: string;
  teacherId: string;
  projectName: string;
  problemStatement: string;
  cycleType: CycleType;
  currentStep: number; // 1 a 7
  
  communityContext: CommunityContext;
  schoolContext: SchoolContext;
  
  fase1Diagnostico: Fase1Diagnostico | null;
  fase2Justificacion: Fase2Justificacion | null;
  fase2Mapeo: MapeoRow[] | null;
  fase2Cronograma: CronogramaRow[] | null;
  fase2DetalleCurricular: DetalleCurricularRow[] | null;
  fase2PlanOperativo: PlanOperativoData | null;
  fase2Anexos: AnexosData | null;
  
  status: PaecStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePaecInput {
  projectName: string;
  problemStatement: string;
  cycleType: CycleType;
  communityContext: CommunityContext;
  schoolContext: SchoolContext;
}
