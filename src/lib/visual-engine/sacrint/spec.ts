/**
 * spec.ts — Fachada de compatibilidad para los constructores SACRINT (08 Presentaciones y 09 Infografías).
 * La implementación vive en `./types.ts` (Capa 0) y `./builders/*` (Capa 4).
 */

export {
  LESSON_GUIDE_NO_SESSIONS_CODE,
  LessonGuideNoSessionsError,
  SACRINT_SLIDE_COUNT,
} from './types';

export type {
  ArgumentDiagramSpec,
  BlockDiagramSpec,
  ClinicalFlowDiagramSpec,
  ConceptDiagramSpec,
  ConceptFamily,
  ConceptManualDefinition,
  ConceptManualSection,
  ConceptMapNode,
  CreativeCycleDiagramSpec,
  DistilledExample,
  DistilledLessonBundle,
  DistilledPracticeActivity,
  ExponentialDiagramSpec,
  GeometryDiagramSpec,
  LanguageDiagramSpec,
  LinearDiagramSpec,
  QuadraticDiagramSpec,
  ReactionDiagramSpec,
  RegulationFlowDiagramSpec,
  SacrintBuildOptions,
  SacrintChallengeSlide,
  SacrintClosingSlide,
  SacrintConceptSlide,
  SacrintCoverSlide,
  SacrintDeckMode,
  SacrintDeckSpec,
  SacrintDemoSlide,
  SacrintDiagramSpec,
  SacrintEvidenceSlide,
  SacrintFact,
  SacrintHookSlide,
  SacrintInfographicFormat,
  SacrintInfographicSpec,
  SacrintInfographicStep,
  SacrintInfographicTarget,
  SacrintMissionMeta,
  SacrintPracticeSlide,
  SacrintRubricItem,
  SacrintSlide,
  SacrintSlideKind,
  SacrintTrafficLight,
  SacrintVariable,
  SopFlowDiagramSpec,
  System2x2DiagramSpec,
  SystemMapDiagramSpec,
  TimelineDiagramSpec,
  TrainingCycleDiagramSpec,
} from './types';

export { collectWorkbookTheorySources } from './builders/shared-helpers';
export {
  conceptFamily,
  isFormulaCoherentWithTitle,
  validateSacrintContentIntegrity,
} from './builders/content-integrity';
export {
  countSlideWords,
  ensureActivityClosure,
} from './builders/slide-budget';
export {
  buildSacrintDeck,
  buildSacrintDecksForWorkbook,
} from './builders/deck-builder';
export {
  buildSacrintInfographic,
  buildSteps,
  dedupeInfographicSpecs,
  selectInfographicTargets,
} from './builders/infographic-builder';
