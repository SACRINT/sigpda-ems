/**
 * trajectory-types.ts — Modelo canónico de malla y trayectoria curricular.
 *
 * Una trayectoria describe la progresión de UACs de un currículum laboral a lo
 * largo de varios semestres, sus prerrequisitos (DAG) y el proyecto integrador
 * que articula las evidencias de cada semestre.
 */

export type TrajectorySemester = 3 | 4 | 5 | 6;

export interface TrajectoryActivity {
  /** Identificador estable, p. ej. `IR-3.1-A1`. */
  id: string;
  name: string;
  hours: number;
  /** Contenidos formativos oficiales que se trabajan en esta actividad clave. */
  contents: string[];
  /** Descripción factual tomada del programa oficial. */
  description: string;
}

export interface TrajectoryNode {
  /** Identificador estable, p. ej. `IR-3.1`. */
  id: string;
  uacName: string;
  semester: TrajectorySemester;
  /** Orden dentro del semestre (1 o 2). */
  order: 1 | 2;
  totalHours: number;
  weeklyHours: number;
  /** Bloques de 18 h que componen la UAC. */
  blocks: number;
  learningOutcome: string;
  keyActivities: TrajectoryActivity[];
  contents: string[];
  sinco: string[];
  scian: string[];
  /** IDs de UACs que deben cursarse antes. */
  prerequisites: string[];
  /** Hito del proyecto integrador al que contribuye esta UAC. */
  projectMilestone: string;
}

export interface TrajectoryProjectMilestone {
  semester: TrajectorySemester;
  title: string;
  description: string;
  linkedUacs: string[];
  evidence: string;
}

export interface CurriculumTrajectory {
  id: string;
  name: string;
  subsystem: 'bge';
  curriculumName: string;
  generation: string;
  agreement: string;
  durationSemesters: number;
  totalUacs: number;
  totalHours: number;
  sourceDocument: string;
  sourcePages: string;
  nodes: TrajectoryNode[];
  project: {
    name: string;
    description: string;
    finalProduct: string;
    milestones: TrajectoryProjectMilestone[];
  };
}

export interface TrajectoryValidationIssue {
  code: string;
  message: string;
  nodeId?: string;
}

export interface TrajectoryValidationReport {
  ok: boolean;
  errors: TrajectoryValidationIssue[];
  warnings: TrajectoryValidationIssue[];
  stats: {
    nodes: number;
    activities: number;
    totalHours: number;
    semesters: number[];
    projectMilestones: number;
  };
}
