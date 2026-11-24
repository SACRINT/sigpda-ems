import type { MissionSection } from '@/types/work-textbook';
import { fitPedagogicalText } from '@/lib/editorial/fitter/text-compactor';
import { hasDanglingEnding } from '@/lib/editorial/fitter/dangling-guards';
import { splitSpanishSentences } from '@/lib/editorial/fitter/sentence-splitter';
import { extractDisciplinaryConceptPhrase } from '@/lib/editorial/topic-title-resolver';
import type {
  ArgumentDiagramSpec,
  BlockDiagramSpec,
  ClinicalFlowDiagramSpec,
  ConceptDiagramSpec,
  DiagramBuildOptions,
  LanguageDiagramSpec,
  ReactionDiagramSpec,
  SacrintDiagramNode,
  SopFlowDiagramSpec,
  SystemMapDiagramSpec,
  TimelineDiagramSpec,
} from '../types';
import { sanitizePedagogicalMetaPhrases } from '../text/grammar-normalization';
import {
  clean,
  clip,
  detail,
  firstSentence,
  normalizedDiagramOverlap,
  stripSessionLead,
} from './shared';

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

export function buildReactionDiagram(mission: MissionSection): ReactionDiagramSpec {
  const equation = findReactionEquation(mission);
  const procedure = detail(
    mission.iDoSection?.stepByStepDemo || mission.sessionFocus,
    110,
    ''
  );
  const evidence = detail(
    mission.conceptZero?.solvedExample?.interpretation || mission.formativeCheckpoint?.question,
    130,
    ''
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
      condition: detail(mission.sessionTopic, 80, ''),
      note: evidence,
    };
  }

  return {
    kind: 'reaction',
    available: false,
    equation: '',
    reactants: [
      {
        label: 'SISTEMA INICIAL',
        detail: detail(mission.conceptZero?.physicalAnalogy || mission.conceptZero?.coreExplanation, 120, ''),
      },
    ],
    products: [
      {
        label: 'SISTEMA RESULTANTE',
        detail: detail(mission.conceptZero?.solvedExample?.interpretation || mission.formativeCheckpoint?.question, 120, ''),
      },
    ],
    condition: procedure,
    note: evidence,
  };
}

export function buildArgumentDiagram(mission: MissionSection, options: DiagramBuildOptions = {}): ArgumentDiagramSpec {
  const session = options.session;
  const allowFallback = options.allowMissionFallback !== false;
  const cleanSessionField = (val?: string | null) =>
    sanitizePedagogicalMetaPhrases(stripSessionLead(val || ''));
  const contrastList = mission.conceptZero?.contrastTable ?? [];
  const contrast = contrastList.find((c) => Boolean(c?.commonMisconception?.trim())) ?? contrastList[0];

  const vMap = session?.sintesisVisual?.mapaConceptual;
  const vCrit = cleanSessionField(vMap?.criterioDesarrollo);
  const vDef = cleanSessionField(vMap?.definicionClave);
  const vErr = cleanSessionField(vMap?.errorComun);
  const vCorr = cleanSessionField(vMap?.correccionBreve);
  const cleanSaberes = cleanSessionField(session?.saberesPrevios);
  const cleanAplicacion = cleanSessionField(session?.aplicacion);
  const cleanContenido = cleanSessionField(session?.contenido);
  const nonQuestionSaberes = /^¿/.test(cleanSaberes) ? '' : cleanSaberes;
  const contenidoSents = cleanContenido
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 24 && !/^¿/.test(s));

  const rawThesis =
    (!allowFallback && (mission.sessionTopic || session?.objetivo)) ||
    mission.sessionFocus ||
    mission.conceptZero?.coreExplanation ||
    mission.sessionTopic;
  const thesisDetail = detail(extractDisciplinaryConceptPhrase(rawThesis) || rawThesis, 120, '');
  const objectionDetail = detail(vErr || contrast?.commonMisconception, 130, '');
  const conclusionDetail = detail(
    vCorr || contrast?.correctConcept || cleanAplicacion || mission.conceptZero?.solvedExample?.interpretation,
    130,
    ''
  );

  const solvedPremises = (mission.conceptZero?.solvedExample?.solutionSteps ?? [])
    .map(clean)
    .filter(Boolean)
    .slice(0, 2);

  // Priorizar premisas conceptuales distintas del ejemplo resuelto del panel izquierdo
  // para evitar duplicación y evitar que pruneConceptualDiagram descarte ambas premisas.
  const rawPremiseCandidates = !allowFallback && session
    ? [
        vCrit,
        nonQuestionSaberes,
        contenidoSents[1] || contenidoSents[0] || '',
        cleanAplicacion,
        vDef,
        mission.conceptZero?.physicalAnalogy,
        ...solvedPremises,
      ]
    : [
        contrast?.reasoning,
        mission.conceptZero?.physicalAnalogy,
        ...solvedPremises,
        mission.conceptZero?.coreExplanation,
      ];

  const compactSingleSentence = (raw: string | undefined, maxChars: number, maxWords: number): string => {
    const cleaned = clean(raw);
    if (!cleaned) return '';
    const firstSent = splitSpanishSentences(cleaned)[0] || cleaned;
    const base = detail(firstSent, maxChars, '') || firstSent;
    const words = base.split(/\s+/).filter(Boolean);
    if (words.length <= maxWords && !hasDanglingEnding(base)) return base;
    const fitted = fitPedagogicalText(base, {
      maxChars,
      maxWords,
      role: 'concept',
      ensurePeriod: true,
    });
    if (fitted && fitted.length >= 18 && !hasDanglingEnding(fitted) && fitted.split(/\s+/).filter(Boolean).length <= maxWords + 2) {
      return fitted;
    }
    // Recorte seguro de cláusula subordinada final si la oración única sigue muy extensa
    const trimmedClause = base
      .replace(/,\s*(?:especialmente|particularmente|incluyendo|permitiendo|garantizando|asegurando|dejando|evitando|promoviendo|fomentando|normalizando|lo\s+que|como\s+la\s+falta)\b[^.?!]*([.?!]?)$/i, '.')
      .replace(/\.\.+$/, '.')
      .trim();
    if (trimmedClause.length >= 20 && !hasDanglingEnding(trimmedClause) && trimmedClause.split(/\s+/).filter(Boolean).length <= maxWords + 2) {
      return trimmedClause;
    }
    return words.length <= maxWords + 4 ? base : '';
  };

  const premiseDetails: string[] = [];
  for (const raw of rawPremiseCandidates) {
    const cand = compactSingleSentence(raw, 96, 14);
    if (!cand || cand.length < 16) continue;
    const dupAgainstFrame =
      normalizedDiagramOverlap(cand, thesisDetail) >= 0.78 ||
      normalizedDiagramOverlap(cand, objectionDetail) >= 0.75 ||
      normalizedDiagramOverlap(cand, conclusionDetail) >= 0.75;
    const dupAgainstPrev = premiseDetails.some((p) => normalizedDiagramOverlap(cand, p) >= 0.65);
    if (dupAgainstFrame || dupAgainstPrev) continue;
    premiseDetails.push(cand);
    if (premiseDetails.length >= 2) break;
  }
  if (premiseDetails.length === 0) {
    const fallbackFirst =
      compactSingleSentence(vCrit || vDef || solvedPremises[0] || mission.conceptZero?.coreExplanation, 108, 16) ||
      detail(vCrit || vDef || solvedPremises[0] || mission.conceptZero?.coreExplanation, 110, '');
    if (fallbackFirst) premiseDetails.push(fallbackFirst);
  }

  return {
    kind: 'argument',
    available: Boolean(thesisDetail && (premiseDetails.length > 0 || conclusionDetail)),
    thesis: { label: 'TESIS', detail: thesisDetail },
    premises: premiseDetails.map((premise, index) => ({
      label: `PREMISA ${index + 1}`,
      detail: premise,
    })),
    objection: { label: 'OBJECIÓN', detail: objectionDetail },
    conclusion: { label: 'CONCLUSIÓN', detail: conclusionDetail },
  };
}

export function buildLanguageDiagram(mission: MissionSection): LanguageDiagramSpec {
  const input = detail(mission.sessionFocus || mission.sessionTopic, 150, '');
  const rule = detail(mission.conceptZero?.coreExplanation, 160, '');
  const output = detail(
    mission.youDoSection?.autonomousChallenge || mission.weDoSection?.guidedPractice,
    160,
    ''
  );
  const context = detail(
    mission.phenomenonHook?.detonatingQuestion || mission.formativeCheckpoint?.question,
    150,
    ''
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

export function buildConceptDiagram(mission: MissionSection): ConceptDiagramSpec {
  const nodes: SacrintDiagramNode[] = [
    { label: 'FENÓMENO', detail: detail(mission.phenomenonHook?.story, 140, '') },
    { label: 'CONCEPTO', detail: detail(mission.conceptZero?.coreExplanation, 140, '') },
    { label: 'PRÁCTICA', detail: detail(mission.weDoSection?.guidedPractice, 140, '') },
    { label: 'PROYECTO', detail: detail(mission.youDoSection?.autonomousChallenge, 140, '') },
  ];

  const filledCount = nodes.filter((node) => Boolean(node.detail)).length;
  const centerTopic =
    extractDisciplinaryConceptPhrase(mission.sessionTopic || mission.title) ||
    mission.sessionTopic ||
    mission.title;
  return {
    kind: 'concept',
    available: filledCount >= 2,
    center: {
      label: 'CONCEPTO CENTRAL',
      detail: detail(centerTopic, 96, ''),
    },
    nodes,
  };
}

const TIMELINE_LABELS = ['ORIGEN', 'PROCESO', 'CONSECUENCIA', 'BALANCE'];

export function buildTimelineDiagram(mission: MissionSection): TimelineDiagramSpec {
  const solved = (mission.conceptZero?.solvedExample?.solutionSteps ?? []).map(clean).filter(Boolean);
  const narrative = [
    firstSentence(mission.phenomenonHook?.story, 140),
    detail(mission.conceptZero?.coreExplanation, 140),
    detail(mission.iDoSection?.stepByStepDemo, 140),
    detail(mission.youDoSection?.autonomousChallenge, 140),
  ].filter(Boolean);
  const source = solved.length >= 3 ? solved.slice(0, 4) : narrative.slice(0, 4);
  const events = source.map((text, index) => ({
    label: TIMELINE_LABELS[index] ?? `HITO ${index + 1}`,
    detail: detail(text, 140),
  }));

  const spanTopic =
    extractDisciplinaryConceptPhrase(mission.sessionTopic || mission.title) ||
    mission.sessionTopic ||
    mission.title;
  return {
    kind: 'timeline',
    available: events.length >= 3 && events.some((event) => Boolean(event.detail)),
    events,
    span: detail(spanTopic, 80, ''),
  };
}

export function buildSystemMapDiagram(mission: MissionSection): SystemMapDiagramSpec {
  const components: SacrintDiagramNode[] = [
    { label: 'ESTÍMULO', detail: detail(mission.phenomenonHook?.story, 140, '') },
    { label: 'MECANISMO', detail: detail(mission.conceptZero?.coreExplanation, 140, '') },
    { label: 'RESPUESTA', detail: detail(mission.weDoSection?.guidedPractice, 140, '') },
    { label: 'ADAPTACIÓN', detail: detail(mission.youDoSection?.autonomousChallenge, 140, '') },
  ];

  const centerTopic =
    extractDisciplinaryConceptPhrase(mission.sessionTopic || mission.title) ||
    mission.sessionTopic ||
    mission.title;
  return {
    kind: 'system-map',
    available: components.filter((node) => Boolean(node.detail)).length >= 2,
    center: {
      label: 'SISTEMA',
      detail: detail(centerTopic, 96, ''),
    },
    components,
    environment: {
      label: 'ENTORNO',
      detail: detail(
        mission.formativeCheckpoint?.question || mission.phenomenonHook?.detonatingQuestion,
        140,
        ''
      ),
    },
  };
}

const CLINICAL_STAGE_LABELS = ['SÍNTOMA', 'EVALUACIÓN', 'DIAGNÓSTICO', 'CUIDADO'];

export function buildClinicalFlowDiagram(mission: MissionSection): ClinicalFlowDiagramSpec {
  const sources = [
    firstSentence(mission.phenomenonHook?.story, 110),
    detail(mission.formativeCheckpoint?.question, 110, ''),
    detail(mission.conceptZero?.coreExplanation, 110, ''),
    detail(mission.weDoSection?.guidedPractice || mission.youDoSection?.autonomousChallenge, 110, ''),
  ];
  const stages = sources.map((text, index) => ({
    label: CLINICAL_STAGE_LABELS[index] ?? `ETAPA ${index + 1}`,
    detail: text || '',
  }));

  return {
    kind: 'clinical-flow',
    available: stages.filter((stage) => Boolean(stage.detail)).length >= 2,
    stages,
    note: detail(
      mission.conceptZero?.solvedExample?.interpretation || mission.metacognitiveTrafficLight?.green,
      140,
      ''
    ),
  };
}

export function buildBlockDiagram(mission: MissionSection): BlockDiagramSpec {
  const input = detail(mission.sessionFocus || mission.sessionTopic, 130, '');
  const process = detail(mission.conceptZero?.coreExplanation, 140, '');
  const output = detail(
    mission.youDoSection?.autonomousChallenge || mission.weDoSection?.guidedPractice,
    130,
    ''
  );
  const feedback = detail(mission.formativeCheckpoint?.question, 130, '');

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

export function buildSopFlowDiagram(mission: MissionSection): SopFlowDiagramSpec {
  const solved = (mission.conceptZero?.solvedExample?.solutionSteps ?? []).map(clean).filter(Boolean);
  const fallback = [
    detail(mission.iDoSection?.stepByStepDemo, 120, ''),
    detail(mission.weDoSection?.guidedPractice, 120, ''),
    detail(mission.youDoSection?.autonomousChallenge, 120, ''),
    detail(mission.metacognitiveTrafficLight?.green, 120, ''),
  ];
  const source = solved.length >= 4 ? solved.slice(0, 4) : [...solved, ...fallback].filter(Boolean).slice(0, 4);
  const steps = source.map((text, index) => ({
    label: SOP_STEP_LABELS[index] ?? `PASO ${index + 1}`,
    detail: detail(text, 120, ''),
  }));

  return {
    kind: 'sop-flow',
    available: steps.length >= 3 && steps.some((step) => Boolean(step.detail)),
    steps,
    standard: detail(
      mission.conceptZero?.contrastTable?.[0]?.correctConcept || mission.conceptZero?.solvedExample?.interpretation,
      130,
      ''
    ),
  };
}
