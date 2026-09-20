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

export type SchoolType = 'general' | 'tecnico' | 'telebachillerato';

export interface GroupTrackConfig {
  groupId: string;          // Ej: "1-A", "3-A", "5-B"
  groupName: string;        // Ej: "1° A", "3° A", "5° B"
  semester: number;         // 1..6
  trackId?: string;         // id o nombre de capacitación laboral o carrera BT
  trackName?: string;       // nombre descriptivo
  ffeSelections?: string[]; // nombres de asignaturas FFE asignadas a este grupo
}

export interface UniqueUacItem {
  uacName: string;
  semester: number;
  component: 'fundamental' | 'laboral' | 'ffe' | 'profesional_bt';
  originTrack?: string;
}

export interface SchoolContext {
  cct?: string;
  schoolName?: string;
  municipality?: string;
  locality?: string;
  schoolZone?: string;
  enrollment?: string;
  teacherCount?: string;
  indicators?: string;
  previousPrograms?: string;
  facilities?: string;
  schoolType?: SchoolType;
  activeLaboralUacs?: string[];
  activeFfeUacs?: string[];
  activeBtCarreras?: string[];
  groupsConfig?: string;
  groupsCount?: string;
  groupStructure?: {
    semestersConfig: Record<number, number>;
    groupAssignments: GroupTrackConfig[];
  };
  uniqueUacsList?: UniqueUacItem[];
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
  semester?: number | string;
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
  score?: number;
  status: 'aprobado_excelente' | 'aprobado' | 'requiere_ajustes';
  estatus?: 'aprobado_excelente' | 'aprobado' | 'requiere_ajustes';
  criteria: PaecAuditCriterion[];
  criterios?: PaecAuditCriterion[];
  summary: {
    passedCount: number;
    warningCount: number;
    failedCount: number;
  };
}

export interface PaecCartaInvitacion {
  asunto: string;
  fecha: string;
  destinatarios: string;
  cuerpo: string;
  fechaReunion: string;
  hora: string;
  lugar: string;
  objetivos: string[];
  firmante: string;
  cargo: string;
}

export interface PaecOficioAliado {
  destinatario: string;
  cargo: string;
  institucion: string;
  asunto: string;
  propuestaColaboracion: string;
}

export interface PaecSesionLanzamiento {
  fecha: string;
  dinamica: string;
  participantes: string;
  acuerdosEstudiantiles: string[];
}

export interface PaecImplementacion {
  cartaInvitacion: PaecCartaInvitacion;
  minutaArranque: MinutaData;
  oficiosAliados: PaecOficioAliado[];
  sesionLanzamiento?: PaecSesionLanzamiento;
}

export interface PaecCalendarioItem {
  tipo: string;
  frecuencia: string;
  participantes: string;
  objetivo: string;
  evidencia: string;
}

export interface PaecGobernanza {
  calendario: PaecCalendarioItem[];
  metodologiaEvaluacion: {
    ambitos: string[];
    preguntasGuiaNem: {
      dondeEstamos: string;
      haciaDondeVamos: string;
      comoSuperamos: string;
    };
  };
}

export interface PaecMetaLogroRow {
  meta: string;
  indicador: string;
  programado: string;
  alcanzado: string;
  porcentaje: number;
  estatus: string;
}

export interface PaecInformeSupervision {
  resumenEjecutivo: string;
  metasVsLogros: PaecMetaLogroRow[];
  analisisPrePost: {
    participacionTotal: string;
    alcanceComunitario: string;
    cambioConocimientos: string;
    desarrolloCompetencias: string;
  };
  evidencias: string[];
  obstaculos: { dificultad: string; solucion: string }[];
  sostenibilidad: string[];
  firmas?: {
    responsableInforme: string;
    autoridadEscolar: string;
  };
}

export interface PaecQualityAudit {
  score: number; // 0 a 100
  criterios: PaecAuditCriterion[];
  estatus: 'aprobado_excelente' | 'aprobado' | 'requiere_ajustes';
  criteria?: PaecAuditCriterion[];
  totalScore?: number;
  percentage?: number;
  status?: 'aprobado_excelente' | 'aprobado' | 'requiere_ajustes';
  summary?: {
    passedCount: number;
    warningCount: number;
    failedCount: number;
  };
  updatedAt?: string;
}

export interface PaecProject {
  id: string;
  teacherId: string;
  projectName: string;
  problemStatement: string;
  cycleType: CycleType;
  currentStep: number; // 1 a 9
  
  communityContext: CommunityContext;
  schoolContext: SchoolContext;
  
  fase1Diagnostico: Fase1Diagnostico | null;
  fase2Justificacion: Fase2Justificacion | null;
  fase2Mapeo: MapeoRow[] | null;
  fase2Cronograma: CronogramaRow[] | null;
  fase2DetalleCurricular: DetalleCurricularRow[] | null;
  fase2PlanOperativo: PlanOperativoData | null; // Compatibilidad hacia atrás
  fase2Anexos: AnexosData | null;

  // Nuevos campos Motor PAEC-PEC 2.0
  fase3PlanOperativoA: PlanOperativoRow[] | null;
  fase3PlanOperativoB: PlanOperativoRow[] | null;
  fase3Implementacion: PaecImplementacion | null;
  fase4Gobernanza: PaecGobernanza | null;
  fase4InformeSupervision: PaecInformeSupervision | null;
  qualityAudit: PaecQualityAudit | null;
  
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

