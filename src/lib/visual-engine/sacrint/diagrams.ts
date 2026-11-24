/**
 * diagrams.ts — Fachada de compatibilidad de los constructores de diagramas SACRINT.
 * La implementación vive en `./diagrams/*` (Capa 3).
 */

export type {
  ArgumentDiagramSpec,
  BlockDiagramSpec,
  ClinicalFlowDiagramSpec,
  ConceptDiagramSpec,
  CreativeCycleDiagramSpec,
  DiagramBuildOptions,
  ExponentialDiagramSpec,
  GeometryDiagramSpec,
  LanguageDiagramSpec,
  LinearDiagramSpec,
  QuadraticDiagramSpec,
  ReactionDiagramSpec,
  RegulationFlowDiagramSpec,
  SacrintDiagramNode,
  SacrintDiagramSpec,
  SacrintVariable,
  SopFlowDiagramSpec,
  System2x2DiagramSpec,
  SystemMapDiagramSpec,
  TimelineDiagramSpec,
  TrainingCycleDiagramSpec,
} from './types';

export {
  completeDetail,
  isValidRenderableFormula,
  niceTickStep,
} from './diagrams/shared';

export { tryBuildQuadraticDiagram } from './diagrams/math-diagrams';

export {
  buildDiagramVariables,
  buildSacrintDiagram,
  diagramFooterLabel,
  diagramFormula,
  diagramModelLabel,
  diagramSubtitle,
  stepLabelsForPack,
} from './diagrams/registry';
