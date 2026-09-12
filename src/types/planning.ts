export type PlanningStatus = 'draft' | 'generated' | 'downloaded';

// Open string to support all subsystems (BGE, Digital, EMSAD, CECyTE, CBTIS, CBTA, CONALEP, DGB, etc.)
export type Subsystem = string;

export type CurriculumComponent = 'laboral' | 'fundamental' | 'ampliado' | 'ext_obligatorio' | 'ext_optativo';

export interface KeyActivity {
  name: string;
  hours: number;
  order: number;
  corte?: string; // e.g. "Corte 1" | "Corte 2" | "Corte 3" (dosificación semestral)
}

export interface ExtractedPdfData {
  uacName: string;
  learningOutcome: string;
  totalHours: number;
  activities: KeyActivity[];
  evidences: string[];
  rawText?: string;
  parseConfidence: 'high' | 'medium' | 'low' | 'failed';
  year?: number;
  contenidosFormativos?: any;
}

export interface PaecOperationalActivity {
  asignatura: string;
  actividad: string;
  propositoFormativo?: string;
  estrategiaDidactica?: string;
  semana?: string;
  fase?: string;
  progresion?: string;
  isPrescheduled: boolean; // true = proveniente de la tabla oficial del PAEC; false = sugerida o manual
}

export interface PaecParseResult {
  projectName: string | null;
  objective: string | null;
  problem: string | null;
  studentContext: string | null;
  schoolName: string | null;
  municipality: string | null;
  cct: string | null;
  isSuggestedProblem: boolean;
  planOperativo?: PaecOperationalActivity[];
}

export interface TeacherContext {
  teacherName: string;
  schoolName: string;
  municipality: string;
  state: string;                 // Estado (default "Puebla")
  region: string;                // Texto libre
  subsystem: Subsystem;
  groupInfo: string;
  applicationPeriod?: string;    // Período de aplicación (Ago-Dic 2026)
  paecProjectName?: string;      // Nombre del proyecto PAEC/PEC
  paecObjective?: string;        // Objetivo general del proyecto
  paecProblem: string;           // Problemática comunitaria (requerido)
  paecOperationalActivity?: PaecOperationalActivity | null; // Actividad del plan operativo
  usePaecActivity?: boolean;     // Switch para respetar e integrar la actividad del PAEC
  schoolResources?: string;      // Recursos del plantel
  studentContext: string;        // Caracterización de estudiantes
  metodologiaActiva?: string;    // ID de metodología activa (ej: 'abp', 'steam', 'abr')
}

export interface TransversalityItem {
  area: string;
  description: string;
}

export interface ActivityPhase {
  activities: string;
  processes: string;
  materials: string;
}

export interface KeyActivityPlan {
  name: string;
  contenidoFormativo?: string;
  hours: number;
  methodology: string;
  apertura: ActivityPhase;
  ejecucion: ActivityPhase;
  conclusion: ActivityPhase;
  saberes?: {
    saber: string;       // Saber Teórico / Conceptual / Normativo NOM
    saberHacer: string;  // Saber Práctico / Procedimental en Taller o Laboratorio
    saberSer: string;    // Saber Actitudinal / Seguridad Industrial / Ética
  };
}

export interface EvaluationRow {
  type: string;
  agent: string;
  moment: string;
  evidence: string;
  instrument: string;
  percentage: number;
}

export interface GeneratedPlanningContent {
  // Section I - Admin Data (pre-filled from context)
  sectionI: {
    teacherName: string;
    uacName: string;
    semester: number;
    groups: string;
    schoolYear: string;
    applicationPeriod: string;
    estimatedSessions: string;
    component: string;
    totalHours: number;
    subsystem: string;
    schoolName?: string;
    cct?: string;
    period?: string;
    totalHoursWeekly?: number;
    totalHoursSemester?: number;
    paecOperationalActivity?: PaecOperationalActivity | null;
  };
  // Section II - Curricular Intent
  sectionII: {
    purpose: string;
    learningOutcomes: string[];
    paecConnection: string;
    activities: KeyActivity[];
  };
  // Section III - Transversality
  sectionIII: {
    fundamentalCurriculum: TransversalityItem[];
    expandedCurriculum: TransversalityItem[];
  };
  // Section IV - Didactic Sequence
  sectionIV: {
    note: string;
    activities: KeyActivityPlan[];
  };
  // Section V - Formative Evaluation
  sectionV: {
    evaluationAgreement?: string; // Acuerdo de acreditación firmado con el grupo (Anexo 12)
    evaluations: EvaluationRow[];
  };
  // Section VI - Resources
  sectionVI: {
    studentMaterials: string[];
    teacherMaterials: string[];
    digital: string[];
    spaces: string[];
    references: string[];
  };
  // Section VII - Signatures (always empty template)
  sectionVII: Record<string, never>;
}

export interface Planning {
  id: string;
  teacherId: string;
  uacName: string;
  semester: number;
  component: CurriculumComponent;
  curriculumName: string;
  paecContext: string;
  paecOperationalActivity?: PaecOperationalActivity | null;
  extractedData: ExtractedPdfData | null;
  contentJson: GeneratedPlanningContent | null;
  status: PlanningStatus;
  createdAt: Date;
  updatedAt: Date;
  metodologiaActiva?: string;    // ID de metodología activa seleccionada por el docente
  evaluationJson?: any | null;
  sequenceJson?: Record<number, SecuenciaBloque> | null;
  workbooksJson?: Record<string, any> | null;
}

export interface SecuenciaSesion {
  sessionNum: number;
  totalSessions: number;
  phase: 'Apertura' | 'Desarrollo' | 'Cierre';
  title: string;
  teachingActivity: string; // Rol del docente
  learningActivity: string; // Rol del estudiante
  evidence: string;         // Evidencia o producto formativo
  evaluation?: string;      // Criterio o instrumento formativo
}

export interface SecuenciaBloque {
  blockIndex: number;
  blockName: string;
  hours: number;
  sessions: SecuenciaSesion[];
  updatedAt?: string;
}

export type SecuenciaCompleta = Record<number, SecuenciaBloque>;

export interface CreatePlanningInput {
  uacName: string;
  semester: number;
  component: CurriculumComponent;
  curriculumName?: string;
  extractedData: ExtractedPdfData;
  context: TeacherContext;
  metodologiaActiva?: string;    // ID de metodología activa seleccionada por el docente
}

export interface PlanningExtra {
  id: string;
  planningId: string;
  type: 'rubric' | 'checklist' | 'material' | 'lesson_plan' | 'practice_guide';
  title: string;
  keyIndex: number | null;
  contentText: string;
  createdAt: Date;
}

