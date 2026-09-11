/**
 * Work-Textbook Types & Data Contracts
 * SIGPDA-EMS · DBEPA Puebla MCCEMS 2026-2027
 *
 * Define la estructura completa del Libro-Cuaderno de Trabajo Activo del Estudiante
 * por Bloque (35-50 páginas en BGE / 50-80 páginas en BT) bajo el enfoque Finlandia-Puebla.
 */

export type WorkbookElementType =
  | 'lines'
  | 'empty_table'
  | 'checkbox_list'
  | 'code_box'
  | 'drawing_box'
  | 'data_recording';

export interface WorkbookElement {
  id: string;
  type: WorkbookElementType;
  title?: string;
  instruction?: string;
  config?: {
    rows?: number;             // Para renglones de escritura a mano
    cols?: string[];           // Para encabezados de tablas vacías
    sampleRows?: number;       // Cantidad de filas vacías para llenar
    initialCode?: string;      // Código base o plantilla en blanco
    heightPx?: number;         // Altura de cajas de dibujo o diagramación
    checkboxes?: string[];     // Textos de lista de verificación
  };
}

export interface TroubleshootItem {
  id: string;
  symptom: string;           // "El LED no enciende" o "Error: IndexError: list index out of range"
  rootCause: string;         // Causa técnica subyacente
  solutionSteps: string[];   // Pasos de solución metódica
  preventionTip: string;     // Cómo evitar este error en el futuro
  cause?: string;            // Causa técnica (formato directo OpenCode)
  solution?: string;         // Solución paso a paso (formato directo OpenCode)
  prevention?: string;       // Prevención (formato directo OpenCode)
}

export interface MissionSection {
  missionIndex: number;
  title: string;
  coveredSessions: number[];      // Ej: [1, 2, 3]
  sessionTopic: string;           // Tópico común del session-progression-engine
  sessionFocus: string;
  phenomenonHook: {
    story: string;                // Desafío de la vida real situado en Puebla (PAEC)
    detonatingQuestion: string;   // Pregunta detonadora de pensamiento crítico
  };
  conceptZero: {
    physicalAnalogy: string;      // Analogía intuitiva de la vida diaria
    coreExplanation: string;      // Fundamento conceptual claro sin tecnicismos innecesarios
  };
  iDoSection: {
    stepByStepDemo: string;       // Demostración guiada resuelta por el autor ("Yo Hago")
    visualOrDiagram?: string;     // Mermaid o esquema de proceso
  };
  weDoSection: {
    guidedPractice: string;       // Ejercicio colaborativo guiado ("Hacemos")
    workbookElements: WorkbookElement[];
  };
  youDoSection: {
    autonomousChallenge: string;  // Reto práctico autónomo ("Tú Haces")
    workbookElements: WorkbookElement[];
  };
  troubleshooting: TroubleshootItem[];
  formativeCheckpoint: {
    question: string;
    reflectionPrompts: string[];
    criteriaChecklist: string[];
  };
  wordCount: number;
}

export interface ProjectPhase {
  phaseNum: number;
  title: string;
  allocatedHours: number;
  deliverables: string[];
  instructions: string;
}

export interface ProjectSection {
  artifactName: string;          // Prototipo, código, filtro, sistema contable, etc.
  communityUtility: string;      // Utilidad concreta para la vida diaria o empleo
  phases: ProjectPhase[];
  technicalSpecs: string[];      // Normas NOM/ISO o especificaciones técnicas
  acceptanceCriteria: string[];  // Criterios objetivos de funcionamiento
}

export interface EvaluationRubricLevel {
  levelName: 'Excelente' | 'Bueno' | 'Suficiente' | 'Requiere Apoyo';
  points: number;
  descriptor: string;
}

export interface EvaluationRubricCriterion {
  criterion: string;
  weightPercent: number;
  levels: EvaluationRubricLevel[];
}

export interface EvaluationSection {
  source: 'reused_from_extras' | 'generated_fresh';
  rubric: EvaluationRubricCriterion[];
  checklist: {
    item: string;
    category: string;
  }[];
  criticalThinkingQuiz: {
    questionNumber: number;
    question: string;
    scenario: string;
    options?: string[];
    answerExplanation: string;
  }[];
  metacognitiveReflection: {
    prompts: string[];
  };
}

export interface ActiveWorkTextbook {
  id: string;
  planningId: string;
  blockIndex: number;
  blockName: string;
  version: number;
  subsystem: 'bge' | 'bt' | string;
  targetPages: number;
  totalPages: number;
  totalWords: number;
  generatedAt: string;
  qualityScore: number;           // 0 - 100
  qualityWarning: boolean;        // true si se usó fallback de calidad
  coverData: {
    title: string;
    subtitle: string;
    subjectName: string;
    semester: number;
    blockNumber: number;
    teacherName: string;
    schoolName: string;
    cct?: string;
    paecProjectName?: string;
  };
  tableOfContents: {
    missionIndex: number;
    title: string;
    sessionsRange: string;
    pageEstimate: number;
  }[];
  missions: MissionSection[];
  projectSection: ProjectSection;
  evaluationSection: EvaluationSection;
  markdownContent?: string;       // Texto consolidado para renderizadores
}

export interface CanonicalSeed {
  id?: string;
  uacId: string;
  subsystem: 'bge' | 'bt' | string;
  topic: string;
  practiceType: 'lab' | 'workshop' | 'field' | 'theoretical';
  content: {
    title: string;
    procedures: string[];
    dataTableSchema?: {
      columns: string[];
      sampleRows: number;
    };
    commonErrors: TroubleshootItem[];
    materials: string[];
    nomNorms?: string[];
  };
  source?: 'ai_generated' | 'manual';
  qualityScore: number;           // 0 - 100 (solo >= 80 se guarda)
  timesUsed?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface GenerationProgressState {
  planningId: string;
  blockIndex: number;
  phase: 'idle' | 'analyzing' | 'blueprint' | 'writing' | 'troubleshooting' | 'validating' | 'assembling' | 'completed' | 'failed';
  currentStep: string;
  percent: number;
  currentMission?: number;
  totalMissions?: number;
  qualityScore?: number;
  wordCount?: number;
  totalWords?: number;
  error?: string;
  updatedAt: string;
}

export interface BlockletHistoryEntry {
  version: number;
  generatedAt: string;
  totalPages: number;
  totalWords: number;
  qualityScore: number;
  qualityWarning: boolean;
}
