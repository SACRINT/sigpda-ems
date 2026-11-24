/**
 * pedagogical-text-fitter.ts — Fachada de retrocompatibilidad del Motor Editorial Compartido.
 * Módulos internos deben importar directamente desde `@/lib/editorial/fitter/*`.
 */
export { splitSpanishSentences } from './fitter/sentence-splitter';
export {
  GENERIC_FILLER_RE,
  NODE_TRUNCATION_RE,
  TERMINAL_DANGLING_RE,
  hasDanglingEnding,
  isPublishablePedagogicalText,
  isTruncatedAgainstSource,
  repairDanglingEnding,
  type FitPedagogicalTextOptions,
  type PedagogicalTextRole,
} from './fitter/dangling-guards';
export {
  compressPedagogicalText,
  finalizeVisibleText,
  fitPedagogicalText,
} from './fitter/text-compactor';
