/**
 * types.ts — Tipos compartidos (Capa 0) del motor visual SACRINT.
 * Centraliza contratos de diagramas, destilación, diapositivas e infografías
 * para garantizar un grafo DAG sin dependencias circulares.
 */
import type { SessionPlan } from '@/types/work-textbook';
import type { SacrintContentErrorContext } from '@/lib/editorial/topic-title-resolver';
import type { SacrintPack } from './discipline-packs';
import type { SacrintVisualStyle } from './visual-styles';
import type { SacrintThemeMode } from './tokens';
import type { EditorialSceneArchetype } from '../editorial-scenes-catalog';
import type {
  AllocatedEditorialScene,
  SceneFileExistsFn,
  SceneReadDataUriFn,
} from '../scene-allocator';

export interface SacrintVariable {
  symbol: string;
  label: string;
  meaning: string;
}

export interface SacrintDiagramNode {
  label: string;
  detail: string;
}

export interface LinearDiagramSpec {
  kind: 'linear';
  available: boolean;
  equation: string;
  slope: number;
  intercept: number;
  domainMax: number;
  rangeMax: number;
  points: Array<{ x: number; y: number; label?: string }>;
  xLabel: string;
  yLabel: string;
  targetY?: number;
}

export interface QuadraticDiagramSpec {
  kind: 'quadratic';
  available: boolean;
  equation: string;
  a: number;
  b: number;
  c: number;
  vertexX: number;
  vertexY: number;
  roots: number[];
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  samples: Array<{ x: number; y: number }>;
  xLabel: string;
  yLabel: string;
}

export interface System2x2DiagramSpec {
  kind: 'system-2x2';
  available: boolean;
  equation1: string;
  equation2: string;
  a1: number;
  b1: number;
  c1: number;
  a2: number;
  b2: number;
  c2: number;
  intersection: { x: number; y: number } | null;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  xLabel: string;
  yLabel: string;
}

export interface ExponentialDiagramSpec {
  kind: 'exponential';
  available: boolean;
  equation: string;
  principal: number;
  rate: number;
  periods: number;
  simpleSeries: Array<{ t: number; value: number }>;
  compoundSeries: Array<{ t: number; value: number }>;
  yMax: number;
  xLabel: string;
  yLabel: string;
  context?: 'population' | 'financial';
}

export interface GeometryDiagramSpec {
  kind: 'geometry';
  available: boolean;
  variant: 'angles' | 'right-triangle' | 'polygon';
  equation: string;
  primaryLabel: string;
  secondaryLabel: string;
  highlights: SacrintDiagramNode[];
}

export interface ReactionDiagramSpec {
  kind: 'reaction';
  available: boolean;
  equation: string;
  reactants: SacrintDiagramNode[];
  products: SacrintDiagramNode[];
  condition: string;
  note: string;
}

export interface ArgumentDiagramSpec {
  kind: 'argument';
  available: boolean;
  thesis: SacrintDiagramNode;
  premises: SacrintDiagramNode[];
  objection: SacrintDiagramNode;
  conclusion: SacrintDiagramNode;
}

export interface LanguageDiagramSpec {
  kind: 'language';
  available: boolean;
  input: SacrintDiagramNode;
  rule: SacrintDiagramNode;
  output: SacrintDiagramNode;
  context: SacrintDiagramNode;
}

export interface ConceptDiagramSpec {
  kind: 'concept';
  available: boolean;
  center: SacrintDiagramNode;
  nodes: SacrintDiagramNode[];
}

export interface TimelineDiagramSpec {
  kind: 'timeline';
  available: boolean;
  events: SacrintDiagramNode[];
  span: string;
}

export interface SystemMapDiagramSpec {
  kind: 'system-map';
  available: boolean;
  center: SacrintDiagramNode;
  components: SacrintDiagramNode[];
  environment: SacrintDiagramNode;
}

export interface ClinicalFlowDiagramSpec {
  kind: 'clinical-flow';
  available: boolean;
  stages: SacrintDiagramNode[];
  note: string;
}

export interface BlockDiagramSpec {
  kind: 'block-diagram';
  available: boolean;
  input: SacrintDiagramNode;
  process: SacrintDiagramNode;
  output: SacrintDiagramNode;
  feedback: SacrintDiagramNode;
}

export interface SopFlowDiagramSpec {
  kind: 'sop-flow';
  available: boolean;
  steps: SacrintDiagramNode[];
  standard: string;
}

export interface CreativeCycleDiagramSpec {
  kind: 'creative-cycle';
  available: boolean;
  phases: SacrintDiagramNode[];
  statement: string;
}

export interface TrainingCycleDiagramSpec {
  kind: 'training-cycle';
  available: boolean;
  phases: SacrintDiagramNode[];
  principle: string;
}

export interface RegulationFlowDiagramSpec {
  kind: 'regulation-flow';
  available: boolean;
  stages: SacrintDiagramNode[];
  anchor: string;
}

export type SacrintDiagramSpec =
  | LinearDiagramSpec
  | QuadraticDiagramSpec
  | System2x2DiagramSpec
  | ExponentialDiagramSpec
  | GeometryDiagramSpec
  | ReactionDiagramSpec
  | ArgumentDiagramSpec
  | LanguageDiagramSpec
  | ConceptDiagramSpec
  | TimelineDiagramSpec
  | SystemMapDiagramSpec
  | ClinicalFlowDiagramSpec
  | BlockDiagramSpec
  | SopFlowDiagramSpec
  | CreativeCycleDiagramSpec
  | TrainingCycleDiagramSpec
  | RegulationFlowDiagramSpec;

export interface DiagramBuildOptions {
  xLabel?: string;
  yLabel?: string;
  session?: SessionPlan;
  allowMissionFallback?: boolean;
  /** Texto del ejemplo efectivamente mostrado en la lámina/infografía para garantizar 100% coherencia Ejemplo ↔ FIG. 01. */
  preferredExampleText?: string;
  /** Fuentes del libro para parafrasear nodos de diagramas no cuantitativos y evitar solapamiento 6-grama 08↔06. */
  theorySources?: string[];
}

export interface DistilledExample {
  problemStatement: string;
  steps: string[];
  interpretation: string;
}

export interface DistilledPracticeActivity {
  label: string;
  statement: string;
  hint: string;
}

export interface DistilledConceptHighlights {
  definition: string;
  formulas: string[];
  keyRules: string[];
}

export interface DistilledLessonBundle {
  sessionNumber: number | null;
  topicTitle: string;
  objective: string;
  activation: string;
  question: string;
  concepts: DistilledConceptHighlights;
  example: DistilledExample;
  activities: DistilledPracticeActivity[];
  application: string;
  artifactStep: string;
  exitChecks: string[];
}

export interface NormalizeObjectiveContext extends SacrintContentErrorContext {
  title?: string | null;
  maxWords?: number;
  strict?: boolean;
}

export interface PracticeActivityValidationResult {
  valid: boolean;
  reason?: string;
  rescuedStatement?: string;
  updatedHint?: string;
}


export interface DistillOptions {
  /**
   * Cuando es `false` (ej. modo `lesson-guide`), extrae únicamente desde `session`
   * sin caer a campos de `mission`, evitando duplicar el mismo contenido entre sesiones.
   */
  allowMissionFallback?: boolean;
  /** Fuentes teóricas adicionales del bloque/libro para prevenir traslape de 6-gramas. */
  extraTheorySources?: Array<string | null | undefined>;
}

export const LESSON_GUIDE_NO_SESSIONS_CODE = 'LESSON_GUIDE_NO_SESSIONS';

export class LessonGuideNoSessionsError extends Error {
  readonly code = LESSON_GUIDE_NO_SESSIONS_CODE;
  readonly blockNumber: number;
  readonly missionNumber: number;
  readonly missionTitle: string;

  constructor(blockNumber: number, missionNumber: number, missionTitle: string) {
    super(
      `[LESSON_GUIDE_NO_SESSIONS] La Misión ${missionNumber} (${missionTitle}) del Bloque ${blockNumber} no cuenta con sesiones (sessionPlans) para generar la guía expositiva de pizarrón.`
    );
    this.name = 'LessonGuideNoSessionsError';
    this.blockNumber = blockNumber;
    this.missionNumber = missionNumber;
    this.missionTitle = missionTitle;
  }
}

export type SacrintSlideKind =
  | 'cover'
  | 'hook'
  | 'concept'
  | 'demo'
  | 'practice'
  | 'challenge'
  | 'evidence'
  | 'closing';

export const SACRINT_SLIDE_COUNT = 8;

export type SacrintInfographicFormat = 'wide' | 'letter';
export type SacrintDeckMode = 'classroom' | 'full' | 'lesson-guide';

export interface SacrintFact {
  label: string;
  value: string;
}

export interface SacrintTrafficLight {
  green: string;
  yellow: string;
  red: string;
}

export interface SacrintMissionMeta {
  subjectName: string;
  blockName: string;
  blockNumber: number;
  semester: number;
  missionNumber: number;
  missionTitle: string;
  sessions: string;
  teacherName: string;
  schoolName: string;
  cct?: string;
  paecProjectName?: string;
  expectedSlideCount?: number;
}

export interface SacrintSlideBase {
  kind: SacrintSlideKind;
  eyebrow: string;
  title: string;
  subtitle?: string;
  missionIndex: number;
  sessionNumber?: number | null;
  isLessonGuide?: boolean;
}

export interface SacrintCoverSlide extends SacrintSlideBase {
  kind: 'cover';
  metaLine: string;
  facts: SacrintFact[];
  footerNote: string;
  topicsCovered?: string[];
}

export interface SacrintHookSlide extends SacrintSlideBase {
  kind: 'hook';
  story: string;
  question: string;
  nodes: Array<{ label: string; detail: string }>;
  facts: SacrintFact[];
}

export interface SacrintConceptSlide extends SacrintSlideBase {
  kind: 'concept';
  analogy: string;
  explanation: string;
  misconception: string;
  formula: string;
  variables: SacrintVariable[];
  diagram: SacrintDiagramSpec;
  facts: SacrintFact[];
  activationNote?: string;
  formulas?: string[];
  keyTakeaways?: string[];
  workedExample?: DistilledExample;
}

export interface SacrintDemoSlide extends SacrintSlideBase {
  kind: 'demo';
  demoText: string;
  steps: string[];
  problemStatement?: string;
  interpretation?: string;
  facts: SacrintFact[];
}

export interface SacrintPracticeSlide extends SacrintSlideBase {
  kind: 'practice';
  practiceText: string;
  checkpoints: string[];
  objectiveBullets?: string[];
  evaluationCriteria?: string[];
  hint?: string;
  activities?: DistilledPracticeActivity[];
  applicationText?: string;
  artifactName?: string;
  artifactStep?: string;
  exitChecks?: string[];
  facts: SacrintFact[];
}

export interface SacrintChallengeSlide extends SacrintSlideBase {
  kind: 'challenge';
  challengeText: string;
  artifactName: string;
  communityUtility: string;
  phases: Array<{ title: string; hours: number }>;
  applicationText?: string;
  exitChecks?: string[];
  facts: SacrintFact[];
}

export interface SacrintEvidenceSlide extends SacrintSlideBase {
  kind: 'evidence';
  checkpoint: string;
  rubric: SacrintRubricItem[];
  checklist: string[];
  reflection: string;
  facts: SacrintFact[];
}

export interface SacrintClosingSlide extends SacrintSlideBase {
  kind: 'closing';
  checkpoint: string;
  criteria: string[];
  trafficLight: SacrintTrafficLight;
  reflection: string;
  facts: SacrintFact[];
}

export type SacrintSlide =
  | SacrintCoverSlide
  | SacrintHookSlide
  | SacrintConceptSlide
  | SacrintDemoSlide
  | SacrintPracticeSlide
  | SacrintChallengeSlide
  | SacrintEvidenceSlide
  | SacrintClosingSlide;

export interface SacrintDeckSpec {
  meta: SacrintMissionMeta;
  pack: SacrintPack;
  style: SacrintVisualStyle;
  mode?: SacrintDeckMode;
  theme?: SacrintThemeMode;
  editorialScenes?: {
    hero?: AllocatedEditorialScene;
    concept?: AllocatedEditorialScene;
  };
  slides: SacrintSlide[];
}

export interface SacrintInfographicStep {
  number: number;
  title: string;
  body: string;
}

export interface SacrintRubricItem {
  label: string;
  weight?: number;
}

export interface ConceptMapNode {
  concept: string;
  relation: string;
  detail: string;
}

export interface ConceptManualDefinition {
  term: string;
  definition: string;
}

export interface ConceptManualSection {
  centralConcept: string;
  conceptMap: ConceptMapNode[];
  definitions: ConceptManualDefinition[];
  usageGuidance: string[];
  masteryChecklist: string[];
}

export interface SacrintInfographicSpec {
  format: SacrintInfographicFormat;
  theme?: SacrintThemeMode;
  meta: SacrintMissionMeta;
  pack: SacrintPack;
  style: SacrintVisualStyle;
  editorialScene?: AllocatedEditorialScene;
  title: string;
  topicTitle?: string;
  subtitle: string;
  claim: string;
  formula: string;
  formulasList?: string[];
  keyConcepts?: string[];
  conceptManual?: ConceptManualSection;
  quickExample?: DistilledExample;
  variables: SacrintVariable[];
  diagram: SacrintDiagramSpec;
  steps: SacrintInfographicStep[];
  misconception: string;
  misconceptionFix?: { error: string; correction: string };
  applicationSummary?: string;
  criteria: string[];
  rubric: SacrintRubricItem[];
  project: {
    artifactName: string;
    communityUtility: string;
  };
  facts: SacrintFact[];
}

export interface SacrintBuildOptions {
  missionIndex?: number;
  sessionIndex?: number;
  xLabel?: string;
  yLabel?: string;
  mode?: SacrintDeckMode;
  theme?: SacrintThemeMode;
  /** Fuentes teóricas adicionales (p. ej. de otros bloques del mismo libro) para prevenir traslape de 6-gramas. */
  extraTheorySources?: Array<string | null | undefined>;
  /** Contador por compilación para diversificar errores comunes sin estado global de módulo. */
  misconceptionTracker?: Map<string, number>;
  /** Predicado inyectado desde servidor para detectar escenas editoriales `.webp` en `public/`. */
  sceneFileExists?: SceneFileExistsFn;
  /** Lector inyectado desde servidor para inline base64 `dataUri` de escenas editoriales. */
  sceneReadDataUri?: SceneReadDataUriFn;
  /** Arquetipo de portada usado en la misión inmediatamente anterior para evitar repeticiones consecutivas. */
  previousHeroArchetype?: EditorialSceneArchetype;
}

export type ConceptFamily =
  | 'angles'
  | 'pythagoras'
  | 'area-perimeter'
  | 'congruence'
  | 'linear'
  | 'quadratic'
  | 'exponential'
  | 'statistics'
  | 'other';

export interface SacrintInfographicTarget {
  missionIndex: number;
  sessionIndex: number;
  conceptKey: string;
}
