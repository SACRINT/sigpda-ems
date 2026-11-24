/**
 * svg-primitives.ts — Fachada de compatibilidad de primitivas y diagramas SVG SACRINT.
 * La implementación vive en `./svg/*` (Capa 5).
 */

export {
  bullet,
  chip,
  chipWidth,
  circle,
  cornerMarks,
  divider,
  dotGrid,
  footer,
  line,
  metricTile,
  panel,
  path,
  progressRail,
  radialGauge,
  rect,
  rule,
  sectionLabel,
  svgDocument,
  tinyBars,
  toneColor,
  topHud,
  type FrameOptions,
} from './svg/core-primitives';

export {
  exponentialGraph,
  geometryDiagram,
  linearGraph,
  quadraticGraph,
  system2x2Graph,
} from './svg/math-graphs';

export {
  argumentMap,
  blockDiagram,
  clinicalFlowDiagram,
  conceptMap,
  creativeCycleDiagram,
  diagramSvg,
  languageMap,
  reactionScheme,
  regulationFlowDiagram,
  sopFlowDiagram,
  systemMapDiagram,
  timelineDiagram,
  trainingCycleDiagram,
} from './svg/schematic-diagrams';
