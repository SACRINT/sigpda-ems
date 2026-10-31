import type { MissionSection } from '@/types/work-textbook';
import { stripWorkbookTags } from '@/lib/guide-engine/workbook-tags';
import type { SacrintPack } from './discipline-packs';
import { normalizeMathNotation } from './math-text';

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

interface DiagramBuildOptions {
  xLabel?: string;
  yLabel?: string;
}

function clean(value: string | null | undefined): string {
  return normalizeMathNotation(stripWorkbookTags(value ?? '')).replace(/\s+/g, ' ').trim();
}

function clip(value: string, max: number): string {
  const text = clean(value);
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

function firstSentence(value: string | null | undefined, max = 220): string {
  const text = clean(value);
  if (!text) return '';
  const sentence = text.match(/^(.{12,}?[.!?])(?:\s|$)/)?.[1] ?? text;
  if (sentence.length <= max) return sentence;
  const punctuationCut = sentence.slice(0, max).search(/[,;:—](?=[^,;:—]*$)/);
  if (punctuationCut > max * 0.45) {
    return `${sentence.slice(0, punctuationCut).trimEnd()}.`;
  }
  const space = sentence.slice(0, max).lastIndexOf(' ');
  const cleanCut = space > max * 0.6 ? sentence.slice(0, space).trimEnd() : sentence.slice(0, max).trimEnd();
  return `${cleanCut}.`;
}

function detail(value: string | null | undefined, max = 220, fallback = 'Sin registro.'): string {
  const text = firstSentence(value, max);
  return text || fallback;
}

function parseNumber(text: string, symbol: 'm' | 'b'): number | null {
  const pattern = new RegExp(`${symbol}\\s*=\\s*(-?\\d+(?:\\.\\d+)?)`, 'i');
  const match = text.match(pattern);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function parseAlgebraicLinearModel(
  source: string,
  mission: MissionSection
): { slope: number; intercept: number; equation: string } | null {
  const parsedSlope = parseNumber(source, 'm');
  const parsedIntercept = parseNumber(source, 'b');
  if (parsedSlope !== null && parsedIntercept !== null) {
    return {
      slope: parsedSlope,
      intercept: parsedIntercept,
      equation: `f(x) = ${parsedSlope.toFixed(2).replace(/0$/, '')}x + ${parsedIntercept.toFixed(2).replace(/0$/, '')}`,
    };
  }

  if (/sin coeficientes numéricos/i.test(source)) {
    return null;
  }

  const extendedSource = [
    source,
    mission.weDoSection?.guidedPractice,
    mission.youDoSection?.autonomousChallenge,
    mission.title,
    mission.sessionTopic,
  ]
    .filter(Boolean)
    .join(' ');

  // 1. Forma pendiente-ordenada: y = mx ± b o f(x) = mx ± b
  const slopeInterceptMatch = extendedSource.match(
    /(?:f\(x\)|y)\s*=\s*(-?\d+(?:\.\d+)?)\s*x\s*([+-])\s*(\d+(?:\.\d+)?)/i
  );
  if (slopeInterceptMatch) {
    const rawM = Number(slopeInterceptMatch[1]);
    const sign = slopeInterceptMatch[2];
    const rawB = Number(slopeInterceptMatch[3]);
    if (Number.isFinite(rawM) && Number.isFinite(rawB)) {
      const slope = Math.max(0.5, Math.abs(rawM));
      const intercept =
        Math.abs(rawB) > 20 ? Number((Math.abs(rawB) / 100).toFixed(1)) : Math.max(0.5, Math.abs(rawB));
      return {
        slope,
        intercept,
        equation: `f(x) = ${rawM}x ${sign} ${rawB}`,
      };
    }
  }

  // 2. Ecuación cuadrática completa: ax² ± bx ± c = 0 (evaluar antes de lineal para no capturar la cola bx ± c = 0)
  const quadEqMatch = extendedSource.match(
    /(\d+(?:\.\d+)?)\s*x(?:²|\^2)\s*([+-])\s*(\d+(?:\.\d+)?)\s*x\s*([+-])\s*(\d+(?:\.\d+)?)\s*=\s*0/i
  );
  if (quadEqMatch) {
    const a = Number(quadEqMatch[1]);
    const sign1 = quadEqMatch[2];
    const bVal = Number(quadEqMatch[3]);
    const sign2 = quadEqMatch[4];
    const cVal = Number(quadEqMatch[5]);
    return {
      slope: Math.max(1, a),
      intercept: Math.min(10, Math.max(1, bVal)),
      equation: `${a}x² ${sign1} ${bVal}x ${sign2} ${cVal} = 0`,
    };
  }

  // 3. Ecuación algebraica de balance: ax ± b = c (ej. 4x + 200 = 1000, 5x - 300 = 1200, 3x + 5 = 20)
  const balanceMatch = extendedSource.match(
    /(\d+(?:\.\d+)?)\s*x\s*([+-])\s*(\d+(?:\.\d+)?)\s*=\s*(-?\d+(?:\.\d+)?)/i
  );
  if (balanceMatch) {
    const a = Number(balanceMatch[1]);
    const sign = balanceMatch[2];
    const bVal = Number(balanceMatch[3]);
    const cVal = Number(balanceMatch[4]);
    if (Number.isFinite(a) && Number.isFinite(bVal)) {
      const slope = a > 10 ? Number((a / 3).toFixed(1)) : Math.max(0.5, a);
      const intercept = bVal > 20 ? Number((bVal / 100).toFixed(1)) : Math.max(0.5, bVal);
      return {
        slope,
        intercept,
        equation: `${a}x ${sign} ${bVal} = ${cVal}`,
      };
    }
  }

  const coeffMatch = extendedSource.match(/\ba\s*=\s*(-?\d+(?:\.\d+)?)[\s,;]+b\s*=\s*(-?\d+(?:\.\d+)?)/i);
  if (coeffMatch) {
    const a = Math.abs(Number(coeffMatch[1])) || 1;
    const bVal = Math.abs(Number(coeffMatch[2])) || 2;
    const intercept = bVal > 20 ? Number((bVal / 10).toFixed(1)) : bVal;
    return {
      slope: a,
      intercept,
      equation: `f(x) = ${a}x + ${intercept}`,
    };
  }

  // 4. Síntesis algebraica contextual por temática de bloque (Misiones de Construcción / Evaluación)
  if (/cuadr[aá]tica|par[aá]bola|segundo grado/i.test(extendedSource)) {
    const idx = mission.missionIndex || 1;
    const slope = idx === 3 ? 2 : 1.5;
    const intercept = idx === 3 ? 3 : 2;
    return {
      slope,
      intercept,
      equation: idx === 3 ? '2x² + 5x - 300 = 0' : 'x² - 12x + 32 = 0',
    };
  }
  if (/sistema[s]? de ecuaciones|dos inc[oó]gnitas/i.test(extendedSource)) {
    const idx = mission.missionIndex || 1;
    const slope = idx === 3 ? 3 : 2;
    const intercept = idx === 3 ? 2 : 4;
    return {
      slope,
      intercept,
      equation: idx === 3 ? '3x + 2y = 24' : '2x + y = 18',
    };
  }
  if (/ecuaci[oó]n|algebraic|inc[oó]gnita|balanza|lineal/i.test(extendedSource)) {
    const idx = mission.missionIndex || 1;
    const slope = idx === 3 ? 4 : 3;
    const intercept = idx === 3 ? 2 : 1.5;
    return {
      slope,
      intercept,
      equation: idx === 3 ? '4x + 200 = 1000' : '3x + 150 = 900',
    };
  }

  return null;
}

function buildLinearDiagram(mission: MissionSection, options: DiagramBuildOptions): LinearDiagramSpec {
  const source = [
    mission.conceptZero?.coreExplanation,
    mission.iDoSection?.stepByStepDemo,
    mission.conceptZero?.solvedExample?.solutionSteps?.join(' '),
  ]
    .filter(Boolean)
    .join(' ');
  const parsedModel = parseAlgebraicLinearModel(source, mission);
  const available = parsedModel !== null;
  const slope = parsedModel?.slope ?? 0;
  const intercept = parsedModel?.intercept ?? 0;
  const domainMax = 10;
  const rawMax = slope * domainMax + intercept;
  const rangeMax = Math.max(4, Math.ceil(rawMax / 2) * 2);
  const equation = parsedModel?.equation ?? 'y = mx + b';
  const points = available
    ? [0, 4, 8].filter((x) => x <= domainMax).map((x) => ({ x, y: Number((slope * x + intercept).toFixed(2)) }))
    : [];

  return {
    kind: 'linear',
    available,
    equation,
    slope,
    intercept,
    domainMax,
    rangeMax,
    points,
    xLabel: options.xLabel || 'VARIABLE INDEPENDIENTE (x)',
    yLabel: options.yLabel || 'VARIABLE DEPENDIENTE (y)',
  };
}

function findReactionEquation(mission: MissionSection): { left: string; right: string } | null {
  const sources = [
    mission.conceptZero?.coreExplanation,
    mission.conceptZero?.physicalAnalogy,
    mission.conceptZero?.solvedExample?.problemStatement,
    ...(mission.conceptZero?.solvedExample?.solutionSteps ?? []),
    mission.iDoSection?.visualOrDiagram,
    mission.iDoSection?.stepByStepDemo,
    mission.weDoSection?.guidedPractice,
  ];
  const arrowPattern = /([^.;:]{2,100}?)\s*(?:→|⟶|->|=>|⇒)\s*([^.;:]{2,100})/;
  const speciesPattern = /(?:^|\s)(?:\d+)?[A-Z][a-z]?(?:\d+)?(?:\([A-Za-z0-9]+\)\d*)?/;

  for (const source of sources) {
    const text = clean(source);
    const match = text.match(arrowPattern);
    if (!match) continue;
    const left = clean(match[1]);
    const right = clean(match[2]);
    const hasPlus = left.includes('+') || right.includes('+');
    const hasQuantity = /\d/.test(left) || /\d/.test(right);
    if (speciesPattern.test(left) && speciesPattern.test(right) && (hasPlus || hasQuantity)) {
      return { left, right };
    }
  }
  return null;
}

function normalizeSpecies(value: string): string {
  const tokens = clean(value).split(' ').filter(Boolean);
  const last = (tokens[tokens.length - 1] ?? '').replace(/[.,;]+$/, '');
  const coefficient = tokens.length >= 2 && /^\d+$/.test(tokens[tokens.length - 2]) ? tokens[tokens.length - 2] : '';
  return `${coefficient}${last}`;
}

function splitSpecies(value: string): string[] {
  return value
    .split(/\s*\+\s*/)
    .map(normalizeSpecies)
    .filter((species) => /^(?:\d+)?[A-Z][a-z]?(?:\d+)?(?:\([A-Za-z0-9]+\)\d*)?/.test(species))
    .slice(0, 2);
}

function buildReactionDiagram(mission: MissionSection): ReactionDiagramSpec {
  const equation = findReactionEquation(mission);
  const procedure = detail(
    mission.iDoSection?.stepByStepDemo || mission.sessionFocus,
    110,
    'Proceso por documentar.'
  );
  const evidence = detail(
    mission.conceptZero?.solvedExample?.interpretation || mission.formativeCheckpoint?.question,
    130,
    'Evidencia por construir.'
  );

  if (equation) {
    const reactants = splitSpecies(equation.left);
    const products = splitSpecies(equation.right);
    const equationLabel = `${reactants.join(' + ') || equation.left} → ${products.join(' + ') || equation.right}`;
    return {
      kind: 'reaction',
      available: true,
      equation: clip(equationLabel, 86),
      reactants: reactants.map((formula, index) => ({
        label: formula,
        detail: `REACTIVO ${index + 1}`,
      })),
      products: products.map((formula, index) => ({
        label: formula,
        detail: `PRODUCTO ${index + 1}`,
      })),
      condition: detail(mission.sessionTopic, 80, 'Transformación por describir.'),
      note: evidence,
    };
  }

  return {
    kind: 'reaction',
    available: false,
    equation: 'ECUACIÓN POR CONSTRUIR',
    reactants: [
      {
        label: 'SISTEMA INICIAL',
        detail: detail(mission.conceptZero?.physicalAnalogy || mission.conceptZero?.coreExplanation, 120),
      },
    ],
    products: [
      {
        label: 'SISTEMA RESULTANTE',
        detail: detail(mission.conceptZero?.solvedExample?.interpretation || mission.formativeCheckpoint?.question, 120),
      },
    ],
    condition: procedure,
    note: evidence,
  };
}

function buildArgumentDiagram(mission: MissionSection): ArgumentDiagramSpec {
  const contrast = mission.conceptZero?.contrastTable?.[0];
  const thesisDetail = detail(mission.sessionFocus || mission.conceptZero?.coreExplanation || mission.sessionTopic, 160);
  const solvedPremises = (mission.conceptZero?.solvedExample?.solutionSteps ?? [])
    .map(clean)
    .filter(Boolean)
    .slice(0, 2);
  const fallbackPremises = [
    detail(mission.conceptZero?.physicalAnalogy, 135),
    detail(contrast?.reasoning || mission.conceptZero?.coreExplanation, 135),
  ];
  const premiseDetails = [...solvedPremises, ...fallbackPremises].slice(0, 2);
  const objectionDetail = detail(contrast?.commonMisconception, 160, 'Sin objeción registrada.');
  const conclusionDetail = detail(
    contrast?.correctConcept || mission.conceptZero?.solvedExample?.interpretation,
    160,
    'Conclusión por construir.'
  );

  return {
    kind: 'argument',
    available: Boolean(thesisDetail && conclusionDetail !== 'Conclusión por construir.'),
    thesis: { label: 'TESIS', detail: thesisDetail || 'Tesis por construir.' },
    premises: premiseDetails.map((premise, index) => ({
      label: `PREMISA ${index + 1}`,
      detail: premise || 'Premisa por construir.',
    })),
    objection: { label: 'OBJECIÓN', detail: objectionDetail },
    conclusion: { label: 'CONCLUSIÓN', detail: conclusionDetail },
  };
}

function buildLanguageDiagram(mission: MissionSection): LanguageDiagramSpec {
  const input = detail(mission.sessionFocus || mission.sessionTopic, 150, 'Entrada por construir.');
  const rule = detail(mission.conceptZero?.coreExplanation, 160, 'Regla por construir.');
  const output = detail(
    mission.youDoSection?.autonomousChallenge || mission.weDoSection?.guidedPractice,
    160,
    'Producción por construir.'
  );
  const context = detail(
    mission.phenomenonHook?.detonatingQuestion || mission.formativeCheckpoint?.question,
    150,
    'Propósito por construir.'
  );

  return {
    kind: 'language',
    available: Boolean(input && rule && output),
    input: { label: 'ENTRADA / INPUT', detail: input },
    rule: { label: 'REGLA / FORMA', detail: rule },
    output: { label: 'PRODUCCIÓN / OUTPUT', detail: output },
    context: { label: 'PROPÓSITO / CONTEXTO', detail: context },
  };
}

function buildConceptDiagram(mission: MissionSection): ConceptDiagramSpec {
  const nodes: SacrintDiagramNode[] = [
    { label: 'FENÓMENO', detail: detail(mission.phenomenonHook?.story, 120) },
    { label: 'CONCEPTO', detail: detail(mission.conceptZero?.coreExplanation, 120) },
    { label: 'PRÁCTICA', detail: detail(mission.weDoSection?.guidedPractice, 120) },
    { label: 'PROYECTO', detail: detail(mission.youDoSection?.autonomousChallenge, 120) },
  ];

  return {
    kind: 'concept',
    available: nodes.some((node) => node.detail !== 'Sin registro.'),
    center: {
      label: 'CONCEPTO CENTRAL',
      detail: detail(mission.sessionTopic || mission.title, 90, 'Concepto por construir.'),
    },
    nodes,
  };
}

const TIMELINE_LABELS = ['ORIGEN', 'PROCESO', 'CONSECUENCIA', 'BALANCE'];

function buildTimelineDiagram(mission: MissionSection): TimelineDiagramSpec {
  const solved = (mission.conceptZero?.solvedExample?.solutionSteps ?? []).map(clean).filter(Boolean);
  const narrative = [
    firstSentence(mission.phenomenonHook?.story, 120),
    detail(mission.conceptZero?.coreExplanation, 120),
    detail(mission.iDoSection?.stepByStepDemo, 120),
    detail(mission.youDoSection?.autonomousChallenge, 120),
  ].filter(Boolean);
  const source = solved.length >= 3 ? solved.slice(0, 4) : narrative.slice(0, 4);
  const events = source.map((text, index) => ({
    label: TIMELINE_LABELS[index] ?? `HITO ${index + 1}`,
    detail: detail(text, 120),
  }));

  return {
    kind: 'timeline',
    available: events.length >= 3 && events.some((event) => event.detail !== 'Sin registro.'),
    events,
    span: clip(mission.sessionTopic || mission.title, 60),
  };
}

function buildSystemMapDiagram(mission: MissionSection): SystemMapDiagramSpec {
  const components: SacrintDiagramNode[] = [
    { label: 'ESTÍMULO', detail: detail(mission.phenomenonHook?.story, 110) },
    { label: 'MECANISMO', detail: detail(mission.conceptZero?.coreExplanation, 110) },
    { label: 'RESPUESTA', detail: detail(mission.weDoSection?.guidedPractice, 110) },
    { label: 'ADAPTACIÓN', detail: detail(mission.youDoSection?.autonomousChallenge, 110) },
  ];

  return {
    kind: 'system-map',
    available: components.some((node) => node.detail !== 'Sin registro.'),
    center: {
      label: 'SISTEMA',
      detail: detail(mission.sessionTopic || mission.title, 80, 'Sistema por construir.'),
    },
    components,
    environment: {
      label: 'ENTORNO',
      detail: detail(
        mission.formativeCheckpoint?.question || mission.phenomenonHook?.detonatingQuestion,
        130,
        'Entorno por describir.'
      ),
    },
  };
}

const CLINICAL_STAGE_LABELS = ['SÍNTOMA', 'EVALUACIÓN', 'DIAGNÓSTICO', 'CUIDADO'];

function buildClinicalFlowDiagram(mission: MissionSection): ClinicalFlowDiagramSpec {
  const sources = [
    firstSentence(mission.phenomenonHook?.story, 110),
    detail(mission.formativeCheckpoint?.question, 110),
    detail(mission.conceptZero?.coreExplanation, 110),
    detail(mission.weDoSection?.guidedPractice || mission.youDoSection?.autonomousChallenge, 110),
  ];
  const stages = sources.map((text, index) => ({
    label: CLINICAL_STAGE_LABELS[index] ?? `ETAPA ${index + 1}`,
    detail: text || 'Sin registro.',
  }));

  return {
    kind: 'clinical-flow',
    available: stages.some((stage) => stage.detail !== 'Sin registro.'),
    stages,
    note: detail(
      mission.conceptZero?.solvedExample?.interpretation || mission.metacognitiveTrafficLight?.green,
      140,
      'Evidencia por documentar.'
    ),
  };
}

function buildBlockDiagram(mission: MissionSection): BlockDiagramSpec {
  const input = detail(mission.sessionFocus || mission.sessionTopic, 130, 'Entrada por definir.');
  const process = detail(mission.conceptZero?.coreExplanation, 140, 'Proceso por construir.');
  const output = detail(
    mission.youDoSection?.autonomousChallenge || mission.weDoSection?.guidedPractice,
    130,
    'Salida por producir.'
  );
  const feedback = detail(mission.formativeCheckpoint?.question, 130, 'Control por definir.');

  return {
    kind: 'block-diagram',
    available: Boolean(input && process && output),
    input: { label: 'ENTRADA', detail: input },
    process: { label: 'PROCESO', detail: process },
    output: { label: 'SALIDA', detail: output },
    feedback: { label: 'CONTROL', detail: feedback },
  };
}

const SOP_STEP_LABELS = ['PREPARACIÓN', 'EJECUCIÓN', 'VERIFICACIÓN', 'ENTREGA'];

function buildSopFlowDiagram(mission: MissionSection): SopFlowDiagramSpec {
  const solved = (mission.conceptZero?.solvedExample?.solutionSteps ?? []).map(clean).filter(Boolean);
  const fallback = [
    detail(mission.iDoSection?.stepByStepDemo, 120),
    detail(mission.weDoSection?.guidedPractice, 120),
    detail(mission.youDoSection?.autonomousChallenge, 120),
    detail(mission.metacognitiveTrafficLight?.green, 120),
  ];
  const source = solved.length >= 4 ? solved.slice(0, 4) : [...solved, ...fallback].filter(Boolean).slice(0, 4);
  const steps = source.map((text, index) => ({
    label: SOP_STEP_LABELS[index] ?? `PASO ${index + 1}`,
    detail: detail(text, 120),
  }));

  return {
    kind: 'sop-flow',
    available: steps.length >= 3 && steps.some((step) => step.detail !== 'Sin registro.'),
    steps,
    standard: detail(
      mission.conceptZero?.contrastTable?.[0]?.correctConcept || mission.conceptZero?.solvedExample?.interpretation,
      130,
      'Estándar por definir.'
    ),
  };
}

const CREATIVE_PHASE_LABELS = ['DETONANTE', 'EXPLORACIÓN', 'OBRA', 'DIFUSIÓN'];

function buildCreativeCycleDiagram(mission: MissionSection): CreativeCycleDiagramSpec {
  const sources = [
    firstSentence(mission.phenomenonHook?.story, 110),
    detail(mission.conceptZero?.coreExplanation, 110),
    detail(mission.iDoSection?.stepByStepDemo || mission.weDoSection?.guidedPractice, 110),
    detail(mission.youDoSection?.autonomousChallenge, 110),
  ];
  const phases = sources.map((text, index) => ({
    label: CREATIVE_PHASE_LABELS[index] ?? `FASE ${index + 1}`,
    detail: text || 'Sin registro.',
  }));

  return {
    kind: 'creative-cycle',
    available: phases.some((phase) => phase.detail !== 'Sin registro.'),
    phases,
    statement: detail(
      mission.conceptZero?.solvedExample?.interpretation || mission.conceptZero?.contrastTable?.[0]?.correctConcept,
      140,
      'Declaración artística por construir.'
    ),
  };
}

const TRAINING_PHASE_LABELS = ['CALENTAMIENTO', 'ACTIVACIÓN', 'ESFUERZO', 'RECUPERACIÓN'];

function buildTrainingCycleDiagram(mission: MissionSection): TrainingCycleDiagramSpec {
  const sources = [
    firstSentence(mission.phenomenonHook?.story, 110),
    detail(mission.conceptZero?.coreExplanation, 110),
    detail(mission.iDoSection?.stepByStepDemo || mission.weDoSection?.guidedPractice, 110),
    detail(mission.youDoSection?.autonomousChallenge, 110),
  ];
  const phases = sources.map((text, index) => ({
    label: TRAINING_PHASE_LABELS[index] ?? `FASE ${index + 1}`,
    detail: text || 'Sin registro.',
  }));

  return {
    kind: 'training-cycle',
    available: phases.some((phase) => phase.detail !== 'Sin registro.'),
    phases,
    principle: detail(
      mission.conceptZero?.contrastTable?.[0]?.correctConcept || mission.conceptZero?.solvedExample?.interpretation,
      140,
      'Principio de entrenamiento por definir.'
    ),
  };
}

const REGULATION_STAGE_LABELS = ['EMOCIÓN', 'INTERPRETACIÓN', 'RESPUESTA', 'REGULACIÓN'];

function buildRegulationFlowDiagram(mission: MissionSection): RegulationFlowDiagramSpec {
  const sources = [
    firstSentence(mission.phenomenonHook?.story, 110),
    detail(mission.conceptZero?.coreExplanation, 110),
    detail(mission.weDoSection?.guidedPractice || mission.iDoSection?.stepByStepDemo, 110),
    detail(mission.youDoSection?.autonomousChallenge, 110),
  ];
  const stages = sources.map((text, index) => ({
    label: REGULATION_STAGE_LABELS[index] ?? `ETAPA ${index + 1}`,
    detail: text || 'Sin registro.',
  }));

  return {
    kind: 'regulation-flow',
    available: stages.some((stage) => stage.detail !== 'Sin registro.'),
    stages,
    anchor: detail(
      mission.conceptZero?.solvedExample?.interpretation || mission.metacognitiveTrafficLight?.green,
      140,
      'Anclaje de regulación por definir.'
    ),
  };
}

export function buildSacrintDiagram(
  mission: MissionSection,
  pack: SacrintPack,
  options: DiagramBuildOptions = {}
): SacrintDiagramSpec {
  switch (pack.diagram) {
    case 'linear-model':
      return buildLinearDiagram(mission, options);
    case 'reaction-scheme':
      return buildReactionDiagram(mission);
    case 'argument-map':
    case 'rhetorical-map':
      return buildArgumentDiagram(mission);
    case 'word-map':
      return buildLanguageDiagram(mission);
    case 'timeline':
      return buildTimelineDiagram(mission);
    case 'system-map':
      return buildSystemMapDiagram(mission);
    case 'clinical-flow':
      return buildClinicalFlowDiagram(mission);
    case 'block-diagram':
      return buildBlockDiagram(mission);
    case 'sop-flow':
      return buildSopFlowDiagram(mission);
    case 'creative-cycle':
      return buildCreativeCycleDiagram(mission);
    case 'training-cycle':
      return buildTrainingCycleDiagram(mission);
    case 'regulation-flow':
      return buildRegulationFlowDiagram(mission);
    default:
      return buildConceptDiagram(mission);
  }
}

export function buildDiagramVariables(diagram: SacrintDiagramSpec): SacrintVariable[] {
  switch (diagram.kind) {
    case 'linear':
      return [
        { symbol: 'x', label: 'Variable independiente', meaning: diagram.xLabel },
        { symbol: 'y', label: 'Variable dependiente', meaning: diagram.yLabel },
        {
          symbol: 'm',
          label: 'Razón de cambio',
          meaning: diagram.available ? `Pendiente ${diagram.slope}` : 'Por construir',
        },
        {
          symbol: 'b',
          label: 'Valor inicial',
          meaning: diagram.available ? `Intersección ${diagram.intercept}` : 'Por construir',
        },
      ];
    case 'reaction':
      return [
        {
          symbol: 'R',
          label: 'Reactivos',
          meaning: clip(diagram.reactants.map((node) => node.label).join(' + '), 72) || 'Por construir',
        },
        { symbol: 'Δ', label: 'Transformación', meaning: clip(diagram.condition, 72) },
        {
          symbol: 'P',
          label: 'Productos',
          meaning: clip(diagram.products.map((node) => node.label).join(' + '), 72) || 'Por construir',
        },
        { symbol: 'E', label: 'Evidencia', meaning: clip(diagram.note, 72) },
      ];
    case 'argument':
      return [
        { symbol: 'T', label: 'Tesis', meaning: clip(diagram.thesis.detail, 72) },
        { symbol: 'P', label: 'Premisas', meaning: clip(diagram.premises.map((node) => node.detail).join(' '), 72) },
        { symbol: 'O', label: 'Objeción', meaning: clip(diagram.objection.detail, 72) },
        { symbol: 'C', label: 'Conclusión', meaning: clip(diagram.conclusion.detail, 72) },
      ];
    case 'language':
      return [
        { symbol: 'E', label: 'Entrada', meaning: clip(diagram.input.detail, 72) },
        { symbol: 'F', label: 'Forma', meaning: clip(diagram.rule.detail, 72) },
        { symbol: 'S', label: 'Salida', meaning: clip(diagram.output.detail, 72) },
        { symbol: 'C', label: 'Contexto', meaning: clip(diagram.context.detail, 72) },
      ];
    case 'concept':
      return [
        { symbol: 'F', label: 'Fenómeno', meaning: clip(diagram.nodes[0]?.detail ?? '', 72) },
        { symbol: 'C', label: 'Concepto', meaning: clip(diagram.nodes[1]?.detail ?? '', 72) },
        { symbol: 'P', label: 'Práctica', meaning: clip(diagram.nodes[2]?.detail ?? '', 72) },
        { symbol: 'D', label: 'Decisión', meaning: clip(diagram.nodes[3]?.detail ?? '', 72) },
      ];
    case 'timeline':
      return [
        { symbol: 'T', label: 'Trayectoria', meaning: clip(diagram.span, 72) },
        { symbol: 'E', label: 'Eventos', meaning: String(diagram.events.length).padStart(2, '0') },
        { symbol: 'C', label: 'Causalidad', meaning: clip(diagram.events[0]?.detail ?? '', 72) },
        { symbol: 'B', label: 'Balance', meaning: clip(diagram.events[diagram.events.length - 1]?.detail ?? '', 72) },
      ];
    case 'system-map':
      return [
        { symbol: 'S', label: 'Sistema', meaning: clip(diagram.center.detail, 72) },
        { symbol: 'C', label: 'Componentes', meaning: clip(diagram.components.map((node) => node.label).join(' · '), 72) },
        { symbol: 'E', label: 'Entorno', meaning: clip(diagram.environment.detail, 72) },
        { symbol: 'R', label: 'Respuesta', meaning: clip(diagram.components[2]?.detail ?? '', 72) },
      ];
    case 'clinical-flow':
      return [
        { symbol: 'S', label: 'Síntoma', meaning: clip(diagram.stages[0]?.detail ?? '', 72) },
        { symbol: 'E', label: 'Evaluación', meaning: clip(diagram.stages[1]?.detail ?? '', 72) },
        { symbol: 'D', label: 'Diagnóstico', meaning: clip(diagram.stages[2]?.detail ?? '', 72) },
        { symbol: 'C', label: 'Cuidado', meaning: clip(diagram.stages[3]?.detail ?? '', 72) },
      ];
    case 'block-diagram':
      return [
        { symbol: 'I', label: 'Entrada', meaning: clip(diagram.input.detail, 72) },
        { symbol: 'P', label: 'Proceso', meaning: clip(diagram.process.detail, 72) },
        { symbol: 'S', label: 'Salida', meaning: clip(diagram.output.detail, 72) },
        { symbol: 'R', label: 'Retroalimentación', meaning: clip(diagram.feedback.detail, 72) },
      ];
    case 'sop-flow':
      return [
        { symbol: 'P', label: 'Preparación', meaning: clip(diagram.steps[0]?.detail ?? '', 72) },
        { symbol: 'E', label: 'Ejecución', meaning: clip(diagram.steps[1]?.detail ?? '', 72) },
        { symbol: 'V', label: 'Verificación', meaning: clip(diagram.steps[2]?.detail ?? '', 72) },
        { symbol: 'N', label: 'Norma', meaning: clip(diagram.standard, 72) },
      ];
    case 'creative-cycle':
      return [
        { symbol: 'D', label: 'Detonante', meaning: clip(diagram.phases[0]?.detail ?? '', 72) },
        { symbol: 'X', label: 'Exploración', meaning: clip(diagram.phases[1]?.detail ?? '', 72) },
        { symbol: 'O', label: 'Obra', meaning: clip(diagram.phases[2]?.detail ?? '', 72) },
        { symbol: 'P', label: 'Difusión', meaning: clip(diagram.phases[3]?.detail ?? '', 72) },
      ];
    case 'training-cycle':
      return [
        { symbol: 'C', label: 'Calentamiento', meaning: clip(diagram.phases[0]?.detail ?? '', 72) },
        { symbol: 'A', label: 'Activación', meaning: clip(diagram.phases[1]?.detail ?? '', 72) },
        { symbol: 'E', label: 'Esfuerzo', meaning: clip(diagram.phases[2]?.detail ?? '', 72) },
        { symbol: 'R', label: 'Recuperación', meaning: clip(diagram.phases[3]?.detail ?? '', 72) },
      ];
    case 'regulation-flow':
      return [
        { symbol: 'E', label: 'Emoción', meaning: clip(diagram.stages[0]?.detail ?? '', 72) },
        { symbol: 'I', label: 'Interpretación', meaning: clip(diagram.stages[1]?.detail ?? '', 72) },
        { symbol: 'R', label: 'Respuesta', meaning: clip(diagram.stages[2]?.detail ?? '', 72) },
        { symbol: 'A', label: 'Regulación', meaning: clip(diagram.anchor, 72) },
      ];
  }
}

export function diagramFormula(diagram: SacrintDiagramSpec): string {
  switch (diagram.kind) {
    case 'linear':
      return diagram.equation;
    case 'reaction':
      return diagram.equation;
    case 'argument':
      return 'P1 + P2 → T';
    case 'language':
      return 'ENTRADA → REGLA → SALIDA';
    case 'concept':
      return 'FENÓMENO → CONCEPTO → DECISIÓN';
    case 'timeline':
      return 'ANTECEDENTE → PROCESO → CONSECUENCIA';
    case 'system-map':
      return 'SISTEMA → COMPONENTES → EQUILIBRIO';
    case 'clinical-flow':
      return 'SÍNTOMA → EVALUACIÓN → CUIDADO';
    case 'block-diagram':
      return 'ENTRADA → PROCESO → SALIDA';
    case 'sop-flow':
      return 'PREPARACIÓN → EJECUCIÓN → VERIFICACIÓN';
    case 'creative-cycle':
      return 'DETONANTE → EXPLORACIÓN → OBRA → DIFUSIÓN';
    case 'training-cycle':
      return 'CALENTAMIENTO → ESFUERZO → RECUPERACIÓN';
    case 'regulation-flow':
      return 'EMOCIÓN → INTERPRETACIÓN → RESPUESTA';
  }
}

export function diagramModelLabel(diagram: SacrintDiagramSpec): string {
  switch (diagram.kind) {
    case 'linear':
      return 'Modelo lineal';
    case 'reaction':
      return 'Esquema de reacción';
    case 'argument':
      return 'Mapa argumental';
    case 'language':
      return 'Red de lengua';
    case 'concept':
      return 'Mapa conceptual';
    case 'timeline':
      return 'Línea de tiempo';
    case 'system-map':
      return 'Red de sistemas';
    case 'clinical-flow':
      return 'Flujo clínico';
    case 'block-diagram':
      return 'Diagrama de bloques';
    case 'sop-flow':
      return 'Flujo de procedimiento';
    case 'creative-cycle':
      return 'Ciclo creativo';
    case 'training-cycle':
      return 'Ciclo de entrenamiento';
    case 'regulation-flow':
      return 'Flujo de regulación';
  }
}

export function diagramSubtitle(diagram: SacrintDiagramSpec): string {
  switch (diagram.kind) {
    case 'linear':
      return 'Del fenómeno al modelo';
    case 'reaction':
      return 'Del fenómeno a la reacción';
    case 'argument':
      return 'Del fenómeno al argumento';
    case 'language':
      return 'Del contexto a la producción';
    case 'concept':
      return 'Del fenómeno al concepto';
    case 'timeline':
      return 'Del contexto a la trayectoria';
    case 'system-map':
      return 'Del organismo al equilibrio';
    case 'clinical-flow':
      return 'Del síntoma al cuidado';
    case 'block-diagram':
      return 'Del requerimiento a la solución';
    case 'sop-flow':
      return 'Del estándar a la ejecución';
    case 'creative-cycle':
      return 'Del detonante a la difusión';
    case 'training-cycle':
      return 'Del calentamiento a la adaptación';
    case 'regulation-flow':
      return 'De la emoción a la regulación';
  }
}

export function diagramFooterLabel(diagram: SacrintDiagramSpec): string {
  switch (diagram.kind) {
    case 'linear':
      return 'modelo · variables · decisión';
    case 'reaction':
      return 'reactivos · proceso · productos';
    case 'argument':
      return 'tesis · premisas · conclusión';
    case 'language':
      return 'entrada · forma · salida';
    case 'concept':
      return 'fenómeno · concepto · decisión';
    case 'timeline':
      return 'antecedente · proceso · consecuencia';
    case 'system-map':
      return 'sistema · componentes · entorno';
    case 'clinical-flow':
      return 'síntoma · evaluación · cuidado';
    case 'block-diagram':
      return 'entrada · proceso · salida';
    case 'sop-flow':
      return 'preparación · ejecución · verificación';
    case 'creative-cycle':
      return 'detonante · exploración · obra';
    case 'training-cycle':
      return 'calentamiento · esfuerzo · recuperación';
    case 'regulation-flow':
      return 'emoción · interpretación · regulación';
  }
}

export function stepLabelsForPack(pack: SacrintPack): string[] {
  switch (pack.id) {
    case 'quimica':
      return ['EL FENÓMENO', 'LA REACCIÓN', 'EL BALANCE', 'EL IMPACTO'];
    case 'filosofia':
    case 'literatura':
      return ['LA PREGUNTA', 'LA TESIS', 'LA OBJECIÓN', 'LA CONCLUSIÓN'];
    case 'ingles':
      return ['EL CONTEXTO', 'LA FORMA', 'LA PRÁCTICA', 'LA PRODUCCIÓN'];
    case 'matematicas':
      return ['EL FENÓMENO', 'LA TABULACIÓN', 'EL MODELO', 'EL IMPACTO'];
    case 'historia':
      return ['EL ANTECEDENTE', 'EL PROCESO', 'LA CONSECUENCIA', 'LA DECISIÓN'];
    case 'biologia':
      return ['EL ESTÍMULO', 'EL MECANISMO', 'LA RESPUESTA', 'LA ADAPTACIÓN'];
    case 'salud':
      return ['EL SÍNTOMA', 'LA EVALUACIÓN', 'EL DIAGNÓSTICO', 'EL CUIDADO'];
    case 'tecnologia':
      return ['LA ENTRADA', 'EL PROCESO', 'LA SALIDA', 'EL CONTROL'];
    case 'laboral':
      return ['LA PREPARACIÓN', 'LA EJECUCIÓN', 'LA VERIFICACIÓN', 'LA ENTREGA'];
    case 'artes':
      return ['EL DETONANTE', 'LA EXPLORACIÓN', 'LA OBRA', 'LA DIFUSIÓN'];
    case 'educacion_fisica':
      return ['EL CALENTAMIENTO', 'LA ACTIVACIÓN', 'EL ESFUERZO', 'LA RECUPERACIÓN'];
    case 'socioemocional':
      return ['LA EMOCIÓN', 'LA INTERPRETACIÓN', 'LA RESPUESTA', 'LA REGULACIÓN'];
    default:
      return ['EL FENÓMENO', 'EL CONCEPTO', 'LA PRÁCTICA', 'LA DECISIÓN'];
  }
}
