/**
 * QUALITY GATE OFICIAL PAEC-PEC 2025 (23 CRITERIOS MCCEMS / COSFAC / NEM)
 * Fachada canónica que re-exporta los evaluadores y agregadores desde ./paec/quality-gate/*.
 */

export { DIMENSIONS } from './paec/quality-gate/shared';
export {
  evaluateCriterio1,
  evaluateCriterio2,
  evaluateCriterio3,
  evaluateCriterio4,
  evaluateCriterio5,
  evaluateCriterio6,
  evaluateCriterio7,
  evaluateCriterio8,
  evaluateCriterio9,
  evaluateCriterio10,
} from './paec/quality-gate/criteria-1-10';
export {
  evaluateCriterio11,
  evaluateCriterio12,
  evaluateCriterio13,
  evaluateCriterio14,
  evaluateCriterio15,
  evaluateCriterio16,
  evaluateCriterio17,
  evaluateCriterio18,
} from './paec/quality-gate/criteria-11-18';
export {
  evaluateCriterio19,
  evaluateCriterio20,
  evaluateCriterio21,
  evaluateCriterio22,
  evaluateCriterio23,
} from './paec/quality-gate/criteria-19-23';
export {
  validatePaecStepResult,
  calculateGlobalPaecScore,
  formatAuditReport,
  type PaecProjectInput,
} from './paec/quality-gate/aggregator';
