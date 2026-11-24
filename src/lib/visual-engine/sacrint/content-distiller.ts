/**
 * content-distiller.ts — Fachada de compatibilidad del Destilador Pedagógico SACRINT.
 * La implementación vive en `./text/*` (Capa 1) y `./distiller/*` (Capa 2).
 */

export type {
  DistilledConceptHighlights,
  DistilledExample,
  DistilledLessonBundle,
  DistilledPracticeActivity,
  DistillOptions,
  NormalizeObjectiveContext,
  PracticeActivityValidationResult,
} from './types';

export {
  cleanSacrintText,
  GENERIC_CONCLUSION_RE,
  isRubricOrBoilerplateLeak,
  NUMERIC_ONLY_STEP_RE,
  ORPHAN_LIST_END_RE,
  repairSpanishSurfaceGrammar,
  sanitizePedagogicalMetaPhrases,
  stripTemplateLabels,
  TEMPLATE_PHRASE_RE,
} from './text/grammar-normalization';

export {
  enforceSixGramOverlap,
  paraphraseSixGramOverlap,
  preventSixGramTheoryOverlap,
  sixGramOverlapRatio,
} from './text/six-gram-overlap';

export {
  cleanMissionTopicLine,
  distillConciseText,
  extractBulletSentences,
  extractChalkboardTopicTitle,
  extractCleanTopicTitle,
  isSpanishInfinitiveVerb,
  normalizeLearningObjective,
  SECOND_PERSON_TO_INFINITIVE_MAP,
  validatePracticeActivity,
} from './text/objective-and-activity-guards';

export {
  distillExerciseStatement,
  distillProblemOrExerciseText,
  distillStepPreservingMath,
  extractFormulasFromText,
} from './distiller/formula-and-steps';

export {
  buildPresentationSummary,
  extractConceptHighlights,
  isCompleteConclusion,
  isCompleteMathStep,
  isCompleteProblemStatement,
  isGenericMisconception,
} from './distiller/summary-and-concepts';

export { extractWorkedExample } from './distiller/worked-example';

export {
  distillLessonBundle,
  extractApplicationAndExit,
  extractPracticeActivities,
} from './distiller/lesson-bundle';
