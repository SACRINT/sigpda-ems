import type { ActiveWorkTextbook, MissionSection, SessionPlan } from '@/types/work-textbook';
import { resolveSacrintPack, type SacrintPack } from './discipline-packs';
import { resolveSacrintStyle, type SacrintVisualStyle } from './visual-styles';
import type { SacrintThemeMode } from './tokens';
import {
  cleanMissionTopicLine,
  cleanSacrintText,
  distillConciseText,
  distillLessonBundle,
  distillStepPreservingMath,
  extractChalkboardTopicTitle,
  extractCleanTopicTitle,
  extractConceptHighlights,
  extractWorkedExample,
  isRubricOrBoilerplateLeak,
  preventSixGramTheoryOverlap,
  sanitizePedagogicalMetaPhrases,
  type DistilledExample,
  type DistilledLessonBundle,
  type DistilledPracticeActivity,
} from './content-distiller';
import {
  buildDiagramVariables,
  buildSacrintDiagram,
  diagramFormula,
  diagramSubtitle,
  stepLabelsForPack,
  type SacrintDiagramSpec,
  type SacrintVariable,
} from './diagrams';
import { classifyTopic } from '@/lib/visual-engine/topic-classifier';
import {
  isEvaluationOrClosureObjective,
  resolveInfographicConceptTitle,
  sanitizeWorkbookTocTitle,
} from '@/lib/editorial/topic-title-resolver';
import { fitPedagogicalText } from '@/lib/editorial/pedagogical-text-fitter';
import { isValidRenderableFormula } from '@/lib/editorial/text-normalization';

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

export type {
  ArgumentDiagramSpec,
  BlockDiagramSpec,
  ClinicalFlowDiagramSpec,
  ConceptDiagramSpec,
  CreativeCycleDiagramSpec,
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
} from './diagrams';

export type { DistilledExample, DistilledPracticeActivity } from './content-distiller';

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

interface SacrintSlideBase {
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

export interface SacrintInfographicSpec {
  format: SacrintInfographicFormat;
  theme?: SacrintThemeMode;
  meta: SacrintMissionMeta;
  pack: SacrintPack;
  style: SacrintVisualStyle;
  title: string;
  topicTitle?: string;
  subtitle: string;
  claim: string;
  formula: string;
  formulasList?: string[];
  keyConcepts?: string[];
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
}

function splitLabeledItems(value: string | null | undefined, label: 'PASO' | 'Instrucción', max: number): string[] {
  const text = cleanSacrintText(value);
  if (!text || isRubricOrBoilerplateLeak(text)) return [];
  const marker = new RegExp(`\\b${label}\\s*\\d+\\s*[:.-]`, 'i');
  const firstMarker = text.search(marker);
  if (firstMarker < 0) return [];
  return text
    .slice(firstMarker)
    .split(new RegExp(`\\s*(?=\\b${label}\\s*\\d+\\s*[:.-])`, 'i'))
    .map((part) => cleanSacrintText(part.replace(new RegExp(`^${label}\\s*\\d+\\s*[:.-]\\s*`, 'i'), '')))
    .filter((part) => Boolean(part) && !isRubricOrBoilerplateLeak(part))
    .map((part) => distillConciseText(part, 210, 34))
    .filter(Boolean)
    .slice(0, max);
}

function firstSentence(value: string | null | undefined): string {
  const text = cleanSacrintText(value);
  if (!text) return '';
  const end = text.search(/[.!?](?:\s|$)/);
  return end === -1 ? text : text.slice(0, end + 1).trim();
}

function stripMissionPrefix(title: string | null | undefined): string {
  const stripped = cleanSacrintText(title).replace(/^misi[oó]n\s*\d+\s*:\s*/i, '').trim();
  const sessionSplit = stripped.split(/\s*—\s*sesi[oó]n\s*\d+/i);
  if (sessionSplit.length > 1 && sessionSplit[0].length >= 8) {
    return sessionSplit[0].trim();
  }
  return stripped;
}

function cleanSlideTitle(value: string | null | undefined): string {
  const text = stripMissionPrefix(value)
    .replace(/\s*—\s*Categor[ií]as?:.*$/i, '')
    .replace(/\s*\|\s*Categor[ií]as?:.*$/i, '')
    .replace(/\s*—\s*Subcategor[ií]as?:.*$/i, '')
    .replace(/\s*\|\s*Subcategor[ií]as?:.*$/i, '')
    .trim();
  return extractCleanTopicTitle(text, text);
}

function sessionsLabel(mission: MissionSection): string {
  const covered = mission.coveredSessions ?? [];
  if (covered.length === 0) return '—';
  if (covered.length === 1) return String(covered[0]).padStart(2, '0');
  return `${String(covered[0]).padStart(2, '0')}–${String(covered[covered.length - 1]).padStart(2, '0')}`;
}

function missionMeta(workbook: ActiveWorkTextbook, mission: MissionSection, pack: SacrintPack): SacrintMissionMeta {
  const cover = workbook.coverData;
  const dedupedBlockName = (workbook.blockName || `Bloque ${(workbook.blockIndex ?? 0) + 1}`)
    .replace(/^(Bloque\s+\d+\s*\(Corte\s*\d+\))\s*:\s*\1$/i, '$1');
  const rawMissionTitle = sanitizePedagogicalMetaPhrases(
    sanitizeWorkbookTocTitle(mission.title, mission.sessionTopic)
  );
  const cleanedTopic = sanitizePedagogicalMetaPhrases(
    extractCleanTopicTitle(rawMissionTitle, mission.sessionTopic)
  );
  return {
    subjectName: cleanSacrintText(cover?.subjectName || pack.label),
    blockName: cleanSacrintText(dedupedBlockName),
    blockNumber: cover?.blockNumber ?? (workbook.blockIndex ?? 0) + 1,
    semester: cover?.semester ?? 1,
    missionNumber: mission.missionIndex || 1,
    missionTitle: fitPedagogicalText(rawMissionTitle || cleanedTopic || `Misión ${mission.missionIndex || 1}`, {
      maxChars: 74,
      maxWords: 11,
      role: 'concept',
      ensurePeriod: false,
    }),
    sessions: sessionsLabel(mission),
    teacherName: cleanSacrintText(cover?.teacherName || 'Docente'),
    schoolName: cleanSacrintText(cover?.schoolName || 'Plantel EMS'),
    cct: cleanSacrintText(cover?.cct || ''),
    paecProjectName: cleanSacrintText(cover?.paecProjectName || ''),
  };
}

function baseFacts(meta: SacrintMissionMeta, mission: MissionSection, sessionNumber?: number | null): SacrintFact[] {
  return [
    { label: 'MISIÓN', value: String(meta.missionNumber).padStart(2, '0') },
    {
      label: sessionNumber ? 'SESIÓN' : 'SESIONES',
      value: sessionNumber ? String(sessionNumber).padStart(2, '0') : meta.sessions,
    },
    { label: 'BLOQUE', value: String(meta.blockNumber).padStart(2, '0') },
    { label: 'CRITERIOS', value: String(mission.formativeCheckpoint?.criteriaChecklist?.length || 0).padStart(2, '0') },
  ];
}

function selectMission(workbook: ActiveWorkTextbook, options: SacrintBuildOptions): MissionSection {
  const missions = workbook.missions ?? [];
  const index = Math.max(0, Math.min(options.missionIndex ?? 0, missions.length - 1));
  return missions[index] ?? missions[0] ?? ({
    missionIndex: 1,
    title: workbook.blockName || workbook.coverData?.title || 'Misión 1',
    coveredSessions: [1],
    sessionTopic: workbook.blockName || workbook.coverData?.subjectName || 'Sesión situada',
    sessionFocus: workbook.coverData?.subtitle || 'Desarrollo situado del bloque',
    phenomenonHook: {
      story: 'Situación contextualizada del entorno escolar y comunitario.',
      detonatingQuestion: '¿Cómo aplicar los saberes del bloque en nuestro contexto?',
    },
    conceptZero: {
      physicalAnalogy: 'Modelo conceptual de referencia.',
      coreExplanation: 'Fundamentación disciplinar del bloque.',
      contrastTable: [],
      solvedExample: { problemStatement: '', solutionSteps: [], interpretation: '' },
    },
    iDoSection: { stepByStepDemo: 'Demostración guiada del docente.' },
    weDoSection: { guidedPractice: 'Práctica colaborativa en aula.', workbookElements: [] },
    youDoSection: { autonomousChallenge: 'Reto autónomo de aplicación.', projectConnection: '' },
    troubleshooting: [],
    formativeCheckpoint: {
      question: '¿Qué aprendimos hoy?',
      criteriaChecklist: ['Cumple con los criterios del bloque.'],
      reflectionPrompts: ['¿Cómo lo aplico en mi comunidad?'],
    },
    metacognitiveTrafficLight: {
      green: 'Domino el contenido.',
      yellow: 'Requiero práctica adicional.',
      red: 'Necesito apoyo docente.',
    },
  } as unknown as MissionSection);
}

function resolveSessionPlans(mission: MissionSection): SessionPlan[] {
  const plans = mission.sessionPlans ?? [];
  return [...plans].sort((a, b) => (a.sessionNumber ?? 0) - (b.sessionNumber ?? 0));
}

function resolveMissionMisconceptionParts(
  mission: MissionSection,
  bundle?: DistilledLessonBundle,
  options: { session?: SessionPlan; allowMissionFallback?: boolean } = {}
): { error: string; correction: string } {
  const allowMission = options.allowMissionFallback ?? true;
  if (allowMission) {
    const firstRow = mission.conceptZero?.contrastTable?.[0];
    if (firstRow?.commonMisconception && !isRubricOrBoilerplateLeak(firstRow.commonMisconception)) {
      return {
        error: distillConciseText(cleanSacrintText(firstRow.commonMisconception), 140, 22),
        correction:
          distillConciseText(cleanSacrintText(firstRow.correctConcept), 120, 18) ||
          'Validar cada paso con la información relevante y el criterio de la clase.',
      };
    }
  }

  const classifierInput = allowMission
    ? {
        title: mission.title,
        topic: mission.sessionTopic,
        objective: bundle?.objective,
        concepts: mission.conceptZero?.coreExplanation,
        example: mission.iDoSection?.stepByStepDemo,
        bodyText: bundle?.topicTitle,
      }
    : {
        title: bundle?.topicTitle,
        topic: bundle?.objective,
        objective: options.session?.objetivo,
        concepts: options.session?.contenido,
        example: options.session?.ejemploResuelto,
      };
  const contextText = Object.values(classifierInput).filter(Boolean).join(' ').trim();

  const classification = classifyTopic(classifierInput);

  if (classification.kind === 'exponential') {
    return {
      error: 'Multiplicar la tasa por el número de periodos como si fuera crecimiento lineal.',
      correction: 'Aplicar la potencia (1 + r)ᵗ sobre el valor acumulado en cada periodo.',
    };
  }
  if (classification.kind === 'statistics') {
    return {
      error: 'Usar el porcentaje de margen de error sin convertirlo a decimal al sustituir en la fórmula.',
      correction: 'Convertir porcentajes a decimales (ej. 5% = 0.05) y respetar los paréntesis del denominador.',
    };
  }
  if (classification.kind === 'quadratic') {
    return {
      error: 'Omitir el signo del coeficiente lineal o descartar raíces sin evaluar el discriminante.',
      correction: 'Evaluar b² - 4ac y verificar ambas raíces en el contexto real del problema.',
    };
  }
  if (classification.kind === 'system-2x2') {
    return {
      error: 'Sustituir la variable despejada en la misma ecuación origen sin cruzar con la segunda.',
      correction: 'Sustituir en la ecuación complementaria y comprobar el par (x, y) en ambas.',
    };
  }
  if (classification.kind === 'geometry') {
    return {
      error: 'Aplicar fórmulas de área o ángulos sin comprobar congruencia o perpendicularidad.',
      correction: 'Identificar dimensiones base y propiedades geométricas antes de resolver.',
    };
  }
  if (classification.kind === 'proportion') {
    return {
      error: 'Confundir variación proporcional directa con inversa o sumar porcentajes de forma directa.',
      correction: 'Verificar si las magnitudes crecen juntas o inversamente antes de plantear la razón.',
    };
  }
  if (classification.kind === 'linear' || /ecuaci[oó]n|algebraic|inc[oó]gnita|balanza|lineal/i.test(contextText)) {
    return {
      error: 'Confundir el término independiente con la razón de cambio o despejar un solo miembro.',
      correction: 'Aplicar operaciones inversas simétricas en ambos lados de la igualdad.',
    };
  }

  const sessionCheck = cleanSacrintText(options.session?.autoevaluacion?.[0]);
  if (!allowMission && sessionCheck && !isRubricOrBoilerplateLeak(sessionCheck)) {
    return {
      error: `Omitir la revisión de: ${distillConciseText(sessionCheck, 115, 18)}`,
      correction: 'Comprobar la conclusión con evidencia y criterios de esta sesión.',
    };
  }

  if (allowMission) {
    const firstCriterion = cleanSacrintText(mission.formativeCheckpoint?.criteriaChecklist?.[0]);
    if (firstCriterion && !isRubricOrBoilerplateLeak(firstCriterion)) {
      return {
        error: `Omitir la verificación de: ${distillConciseText(firstCriterion, 115, 18)}`,
        correction: 'Validar paso a paso con evidencia e instrumentos de la sesión.',
      };
    }
  }

  const refLabel =
    !allowMission && options.session?.sessionNumber ? ` en la sesión ${options.session.sessionNumber}` : '';
  return {
    error: `Aplicar un procedimiento sin revisar la consigna ni validar la coherencia contextual${refLabel}.`,
    correction: 'Comprobar la conclusión con la información relevante y la evidencia del tema.',
  };
}

function resolveMissionMisconception(
  mission: MissionSection,
  withCorrection = false,
  bundle?: DistilledLessonBundle,
  options: { session?: SessionPlan; allowMissionFallback?: boolean } = {}
): string {
  const { error, correction } = resolveMissionMisconceptionParts(mission, bundle, options);
  return withCorrection ? `${error} → ${correction}` : error;
}

function sanitizeField(value: string | null | undefined, fallback: string, maxChars = 420, maxWords = 72): string {
  const cleaned = cleanSacrintText(value);
  if (!cleaned || isRubricOrBoilerplateLeak(cleaned)) return fallback;
  if (cleaned.length <= maxChars) return cleaned;
  return distillConciseText(cleaned, maxChars, maxWords) || fallback;
}

function pushTheoryStrings(out: string[], value: unknown): void {
  if (typeof value === 'string') {
    if (value.trim()) out.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) pushTheoryStrings(out, item);
  } else if (value && typeof value === 'object') {
    for (const nested of Object.values(value)) pushTheoryStrings(out, nested);
  }
}

export function collectWorkbookTheorySources(workbook: ActiveWorkTextbook): string[] {
  const sources: string[] = [];
  for (const m of workbook.missions ?? []) {
    if (m.conceptZero) pushTheoryStrings(sources, m.conceptZero);
    if (m.phenomenonHook?.story) sources.push(m.phenomenonHook.story);
    for (const s of m.sessionPlans ?? []) {
      if (s.contenido) sources.push(s.contenido);
    }
  }
  return sources;
}

function buildLessonGuideSlidesForSession(
  workbook: ActiveWorkTextbook,
  mission: MissionSection,
  pack: SacrintPack,
  meta: SacrintMissionMeta,
  session: SessionPlan,
  options: SacrintBuildOptions,
  workbookTheorySources: string[] = collectWorkbookTheorySources(workbook)
): SacrintSlide[] {
  const bundle = distillLessonBundle(mission, session, {
    allowMissionFallback: false,
    extraTheorySources: workbookTheorySources,
  });
  const sesLabel = String(bundle.sessionNumber ?? session.sessionNumber).padStart(2, '0');
  const diagram = buildSacrintDiagram(mission, pack, {
    ...options,
    session,
    allowMissionFallback: false,
  });
  const variables = buildDiagramVariables(diagram);
  const formula = diagramFormula(diagram);
  const facts = baseFacts(meta, mission, bundle.sessionNumber);
  const misconceptionParts = resolveMissionMisconceptionParts(mission, bundle, {
    session,
    allowMissionFallback: false,
  });
  const combinedMisconception = `${misconceptionParts.error} → ${misconceptionParts.correction}`;
  const rawMisconception =
    combinedMisconception.split(/\s+/).length <= 14
      ? combinedMisconception
      : fitPedagogicalText(sanitizePedagogicalMetaPhrases(misconceptionParts.error), {
          maxChars: 92,
          maxWords: 14,
          role: 'hint',
        });
  const misconception = preventSixGramTheoryOverlap(rawMisconception, workbookTheorySources);

  const rawArtifactTitle = sanitizePedagogicalMetaPhrases(
    cleanSacrintText(workbook.projectSection?.artifactName) || `Producto de la sesión ${sesLabel}`
  );
  const deOverlappedArtifact = preventSixGramTheoryOverlap(rawArtifactTitle, workbookTheorySources);
  const fittedArtifactTitle =
    fitPedagogicalText(deOverlappedArtifact, {
      maxChars: 54,
      maxWords: 8,
      role: 'concept',
      ensurePeriod: false,
    }) || `Producto de la sesión ${sesLabel}`;
  let artifactName = fittedArtifactTitle;
  if (artifactName === bundle.artifactStep) {
    artifactName = `${artifactName} · Sesión ${sesLabel}`;
  }

  const fittedTopicTitle =
    bundle.topicTitle.length > 140
      ? fitPedagogicalText(bundle.topicTitle, {
          maxChars: 140,
          maxWords: 16,
          role: 'concept',
          ensurePeriod: false,
        }) || bundle.topicTitle.slice(0, 140).replace(/\s+\S*$/, '')
      : bundle.topicTitle;

  const conceptSlide: SacrintConceptSlide = {
    kind: 'concept',
    eyebrow: `SESIÓN ${sesLabel} · PIZARRÓN 1/2 · CONOCIMIENTO NUEVO Y EJEMPLO`,
    title: fittedTopicTitle,
    subtitle: bundle.objective,
    missionIndex: meta.missionNumber,
    sessionNumber: bundle.sessionNumber,
    isLessonGuide: true,
    activationNote: bundle.activation,
    analogy: bundle.question || bundle.activation,
    explanation: bundle.example.problemStatement,
    formulas: bundle.concepts.formulas.length > 0 ? bundle.concepts.formulas : [formula],
    keyTakeaways: bundle.example.steps,
    workedExample: bundle.example,
    misconception,
    formula,
    variables,
    diagram,
    facts,
  };

  const practiceSlide: SacrintPracticeSlide = {
    kind: 'practice',
    eyebrow: `SESIÓN ${sesLabel} · PIZARRÓN 2/2 · EJERCICIOS Y APLICACIÓN`,
    title: `Ejercicios y aplicación · Sesión ${sesLabel}`,
    subtitle: preventSixGramTheoryOverlap(fittedTopicTitle, workbookTheorySources),
    missionIndex: meta.missionNumber,
    sessionNumber: bundle.sessionNumber,
    isLessonGuide: true,
    practiceText: bundle.application,
    activities: bundle.activities,
    checkpoints: bundle.activities.map((item) => `${item.label}: ${item.statement}`),
    hint: bundle.activities[0]?.hint,
    applicationText: bundle.application,
    artifactName,
    artifactStep: bundle.artifactStep,
    exitChecks: bundle.exitChecks.slice(0, 2),
    facts,
  };

  return [conceptSlide, practiceSlide];
}

export function buildSacrintDeck(workbook: ActiveWorkTextbook, options: SacrintBuildOptions = {}): SacrintDeckSpec {
  const mission = selectMission(workbook, options);
  const pack = resolveSacrintPack(workbook.coverData?.subjectName ?? '', workbook.subsystem);
  const meta = missionMeta(workbook, mission, pack);
  const mode: SacrintDeckMode = options.mode ?? 'full';
  const sessionPlans = resolveSessionPlans(mission);
  const selectedSession =
    typeof options.sessionIndex === 'number'
      ? sessionPlans[Math.max(0, Math.min(options.sessionIndex, sessionPlans.length - 1))]
      : sessionPlans[0];
  const workbookTheorySources: string[] =
    mode === 'lesson-guide'
      ? [
          ...collectWorkbookTheorySources(workbook),
          ...(options.extraTheorySources ?? []).filter(
            (s): s is string => typeof s === 'string' && s.trim().length > 0
          ),
        ]
      : [];

  const topicsCovered = sessionPlans
    .map((session) => {
      const rawTopic = extractChalkboardTopicTitle(
        session.objetivo,
        mission.sessionTopic,
        session.contenido
      );
      if (mode !== 'lesson-guide') {
        return `S${String(session.sessionNumber).padStart(2, '0')}: ${rawTopic}`;
      }
      const cleanTopic = fitPedagogicalText(sanitizePedagogicalMetaPhrases(rawTopic), {
        maxChars: 48,
        maxWords: 7,
        role: 'concept',
        ensurePeriod: false,
      });
      return `S${String(session.sessionNumber).padStart(2, '0')}: ${preventSixGramTheoryOverlap(cleanTopic || rawTopic, workbookTheorySources)}`;
    })
    .slice(0, 6);

  const facts = baseFacts(meta, mission);
  const rawCoverFooter = meta.paecProjectName
    ? `PAEC: ${
        mode === 'lesson-guide'
          ? fitPedagogicalText(
              preventSixGramTheoryOverlap(
                sanitizePedagogicalMetaPhrases(meta.paecProjectName),
                workbookTheorySources
              ),
              {
                maxChars: 54,
                maxWords: 8,
                role: 'general',
                ensurePeriod: false,
              }
            )
          : meta.paecProjectName
      }`
    : meta.schoolName;
  const coverSubtitleRaw = cleanMissionTopicLine(
    mission.sessionTopic,
    meta.missionTitle,
    mode === 'lesson-guide' ? 68 : 175,
    mode === 'lesson-guide' ? 10 : 28
  );

  const rawCoverTitle =
    mode === 'lesson-guide'
      ? preventSixGramTheoryOverlap(meta.missionTitle, workbookTheorySources)
      : meta.missionTitle;
  const coverTitle =
    mode === 'lesson-guide' && rawCoverTitle.length > 140
      ? fitPedagogicalText(rawCoverTitle, {
          maxChars: 140,
          maxWords: 16,
          role: 'concept',
          ensurePeriod: false,
        }) || rawCoverTitle.slice(0, 140).replace(/\s+\S*$/, '')
      : rawCoverTitle;

  const cover: SacrintCoverSlide = {
    kind: 'cover',
    eyebrow: `MISIÓN ${String(meta.missionNumber).padStart(2, '0')} // ${pack.label.toLocaleUpperCase('es-MX')}`,
    title: coverTitle,
    subtitle:
      mode === 'lesson-guide'
        ? preventSixGramTheoryOverlap(sanitizePedagogicalMetaPhrases(coverSubtitleRaw), workbookTheorySources)
        : coverSubtitleRaw,
    missionIndex: meta.missionNumber,
    metaLine: `${meta.subjectName} · SEMESTRE ${meta.semester} · BLOQUE ${meta.blockNumber}`,
    facts,
    topicsCovered: topicsCovered.length > 0 ? topicsCovered : undefined,
    footerNote:
      mode === 'lesson-guide'
        ? preventSixGramTheoryOverlap(rawCoverFooter, workbookTheorySources)
        : rawCoverFooter,
  };

  // Modo Guía Expositiva por Clase: 1 Portada de Misión + 2 láminas de pizarrón por cada sesión del libro
  if (mode === 'lesson-guide') {
    if (sessionPlans.length === 0) {
      throw new LessonGuideNoSessionsError(meta.blockNumber, meta.missionNumber, meta.missionTitle);
    }
    const targetSessions =
      typeof options.sessionIndex === 'number' && selectedSession ? [selectedSession] : sessionPlans;
    const sessionSlides = targetSessions.flatMap((session) =>
      buildLessonGuideSlidesForSession(workbook, mission, pack, meta, session, options, workbookTheorySources)
    );
    meta.expectedSlideCount = 1 + 2 * targetSessions.length;
    return {
      meta,
      pack,
      style: resolveSacrintStyle(pack.id),
      mode,
      theme: options.theme ?? 'dark',
      slides: [cover, ...sessionSlides],
    };
  }

  // Modo 'full' o 'classroom': preserva contrato exacto con tests existentes y destila contenido real
  const diagram = buildSacrintDiagram(mission, pack, { ...options, session: selectedSession });
  const variables = buildDiagramVariables(diagram);
  const formula = diagramFormula(diagram);
  const bundle = selectedSession ? distillLessonBundle(mission, selectedSession) : undefined;
  const misconception = resolveMissionMisconception(mission, Boolean(selectedSession), bundle);

  const rawStory = sanitizeField(
    mission.phenomenonHook?.story,
    bundle?.activation || 'Situación contextualizada del entorno escolar y comunitario.'
  );
  const storyFirstSentence = firstSentence(rawStory) || rawStory;
  const rawQuestion = sanitizeField(
    mission.phenomenonHook?.detonatingQuestion,
    bundle?.question || '¿Qué decisión permite transformar el problema?',
    220,
    38
  );
  const rawFocus = sanitizeField(
    mission.sessionFocus,
    bundle?.objective || 'Sin foco pedagógico registrado.',
    220,
    38
  );

  const hook: SacrintHookSlide = {
    kind: 'hook',
    eyebrow: 'FENÓMENO SITUADO // PUNTO DE PARTIDA',
    title: cleanSlideTitle(mission.sessionTopic) || meta.missionTitle,
    subtitle: 'Situación de partida',
    missionIndex: meta.missionNumber,
    story: rawStory,
    question: rawQuestion,
    facts,
    nodes: [
      { label: 'CONTEXTO', detail: storyFirstSentence },
      { label: 'PREGUNTA', detail: rawQuestion },
      { label: 'FOCO', detail: firstSentence(rawFocus) || rawFocus },
    ],
  };

  const conceptHighlights = extractConceptHighlights(mission, selectedSession);
  const concept: SacrintConceptSlide = {
    kind: 'concept',
    eyebrow: 'NÚCLEO TÉCNICO // CONCEPTO CERO',
    title: cleanSlideTitle(mission.sessionTopic) || bundle?.topicTitle || 'Concepto clave',
    subtitle: diagramSubtitle(diagram),
    missionIndex: meta.missionNumber,
    analogy: sanitizeField(
      mission.conceptZero?.physicalAnalogy,
      bundle?.activation || 'Sin analogía registrada.'
    ),
    explanation: sanitizeField(
      mission.conceptZero?.coreExplanation,
      conceptHighlights.definition
    ),
    misconception: misconception || 'Sin error común registrado.',
    formula,
    variables,
    diagram,
    formulas: conceptHighlights.formulas,
    keyTakeaways: conceptHighlights.keyRules,
    facts,
  };

  const solved = mission.conceptZero?.solvedExample;
  const rawSolvedSteps = (solved?.solutionSteps ?? [])
    .map(cleanSacrintText)
    .filter((item) => Boolean(item) && !isRubricOrBoilerplateLeak(item))
    .slice(0, 6);
  const labeledDemoSteps = splitLabeledItems(mission.iDoSection?.stepByStepDemo, 'PASO', 6);
  const distilledDemo = extractWorkedExample(mission, selectedSession);
  const demoSteps =
    rawSolvedSteps.length > 0
      ? rawSolvedSteps
      : labeledDemoSteps.length > 0
        ? labeledDemoSteps
        : distilledDemo.steps;

  const demo: SacrintDemoSlide = {
    kind: 'demo',
    eyebrow: 'YO HAGO // DEMOSTRACIÓN GUIADA',
    title: cleanSlideTitle(mission.sessionTopic) || 'Demostración',
    subtitle: 'Paso a paso con el autor',
    missionIndex: meta.missionNumber,
    demoText: sanitizeField(
      mission.iDoSection?.stepByStepDemo,
      distilledDemo.problemStatement
    ),
    steps: demoSteps,
    problemStatement:
      cleanSacrintText(solved?.problemStatement) || distilledDemo.problemStatement || undefined,
    interpretation:
      cleanSacrintText(solved?.interpretation) || distilledDemo.interpretation || undefined,
    facts,
  };

  const weDoElements = (mission.weDoSection?.workbookElements ?? [])
    .map((element) => cleanSacrintText([element.title, element.instruction].filter(Boolean).join(': ')))
    .filter((item) => Boolean(item) && !isRubricOrBoilerplateLeak(item))
    .slice(0, 4);
  const labeledCheckpoints = splitLabeledItems(mission.weDoSection?.guidedPractice, 'Instrucción', 4);
  const fallbackPracticeActivities = bundle?.activities ?? [];
  const derivedCheckpoints =
    weDoElements.length > 0
      ? weDoElements
      : labeledCheckpoints.length > 0
        ? labeledCheckpoints
        : fallbackPracticeActivities.length > 0
          ? fallbackPracticeActivities.map((item) => `${item.label}: ${item.statement}`)
          : ['Registrar evidencia de la práctica en el cuaderno y contrastar en equipo.'];

  const practice: SacrintPracticeSlide = {
    kind: 'practice',
    eyebrow: 'HACEMOS // PRÁCTICA GUIADA',
    title: cleanSlideTitle(mission.sessionTopic) || 'Práctica',
    subtitle: 'Resolvemos juntos con andamiaje',
    missionIndex: meta.missionNumber,
    practiceText: sanitizeField(
      mission.weDoSection?.guidedPractice,
      bundle?.objective || 'Práctica guiada en el cuaderno de trabajo.'
    ),
    checkpoints: derivedCheckpoints,
    hint:
      cleanSacrintText(mission.troubleshooting?.[0]?.preventionTip || mission.troubleshooting?.[0]?.prevention) ||
      fallbackPracticeActivities[0]?.hint ||
      undefined,
    activities: fallbackPracticeActivities.length > 0 ? fallbackPracticeActivities : undefined,
    facts,
  };

  const projectPhases = (workbook.projectSection?.phases ?? [])
    .slice(0, 3)
    .map((phase) => ({
      title: cleanSacrintText(phase.title).replace(/^fase\s*\d+\s*[:.-]\s*/i, '') || `Fase ${phase.phaseNum}`,
      hours: phase.allocatedHours ?? 0,
    }));
  const challenge: SacrintChallengeSlide = {
    kind: 'challenge',
    eyebrow: 'TÚ HACES // RETO Y PROYECTO',
    title: cleanSlideTitle(mission.sessionTopic) || 'Reto autónomo',
    subtitle: 'Aplicación independiente e integración al proyecto',
    missionIndex: meta.missionNumber,
    challengeText: sanitizeField(
      mission.youDoSection?.autonomousChallenge,
      bundle?.artifactStep || 'Aplicar lo aprendido en el reto del bloque.'
    ),
    artifactName: cleanSacrintText(workbook.projectSection?.artifactName) || 'Producto integrador',
    communityUtility:
      sanitizeField(workbook.projectSection?.communityUtility, 'Utilidad comunitaria por definir.', 220, 38),
    applicationText: bundle?.application,
    exitChecks: bundle?.exitChecks,
    phases: projectPhases,
    facts,
  };

  const evalChecklist = (workbook.evaluationSection?.checklist ?? [])
    .map((item) => cleanSacrintText(item.item))
    .filter((item) => Boolean(item) && !isRubricOrBoilerplateLeak(item))
    .slice(0, 5);
  const checklist =
    evalChecklist.length > 0
      ? evalChecklist
      : (mission.formativeCheckpoint?.criteriaChecklist ?? [])
          .map(cleanSacrintText)
          .filter((item) => Boolean(item) && !isRubricOrBoilerplateLeak(item))
          .slice(0, 5);
  const evidence: SacrintEvidenceSlide = {
    kind: 'evidence',
    eyebrow: 'EVIDENCIA // RÚBRICA Y CRITERIOS',
    title: '¿Cómo se evalúa?',
    subtitle: cleanSacrintText(mission.formativeCheckpoint?.question) || 'Criterios de verificación',
    missionIndex: meta.missionNumber,
    checkpoint: cleanSacrintText(mission.formativeCheckpoint?.question) || '¿Qué evidencia entrego?',
    rubric: buildRubric(workbook),
    checklist: checklist.length > 0 ? checklist : ['Evidencia clara de procedimiento y resultado verificado.'],
    reflection:
      cleanSacrintText(mission.formativeCheckpoint?.reflectionPrompts?.[0]) ||
      '¿Qué evidencia tengo de mi aprendizaje?',
    facts,
  };

  const criteria = (mission.formativeCheckpoint?.criteriaChecklist ?? [])
    .map(cleanSacrintText)
    .filter((item) => Boolean(item) && !isRubricOrBoilerplateLeak(item));
  const closing: SacrintClosingSlide = {
    kind: 'closing',
    eyebrow: 'CIERRE FORMATIVO // METACOGNICIÓN',
    title: 'Verifico lo aprendido',
    subtitle: cleanSacrintText(mission.formativeCheckpoint?.question) || 'Ticket de salida',
    missionIndex: meta.missionNumber,
    checkpoint:
      cleanSacrintText(mission.formativeCheckpoint?.question) || '¿Qué puedo demostrar con el modelo?',
    criteria: criteria.length > 0 ? criteria : ['Verifico procedimiento, unidades e interpretación.'],
    trafficLight: {
      green: cleanSacrintText(mission.metacognitiveTrafficLight?.green) || 'Domino el concepto y puedo aplicarlo.',
      yellow: cleanSacrintText(mission.metacognitiveTrafficLight?.yellow) || 'Lo entiendo, necesito práctica.',
      red: cleanSacrintText(mission.metacognitiveTrafficLight?.red) || 'Requiero asesoría.',
    },
    reflection:
      cleanSacrintText(mission.formativeCheckpoint?.reflectionPrompts?.[0]) ||
      '¿Qué evidencia tengo de mi aprendizaje?',
    facts,
  };

  const allSlides: SacrintSlide[] = [cover, hook, concept, demo, practice, challenge, evidence, closing];
  const slides = mode === 'classroom' ? [hook, concept, demo, challenge] : allSlides;

  return {
    meta,
    pack,
    style: resolveSacrintStyle(pack.id),
    mode,
    theme: options.theme ?? 'dark',
    slides,
  };
}

/** Construye todos los mazos SACRINT de un libro completo (misión por misión). */
export function buildSacrintDecksForWorkbook(
  workbook: ActiveWorkTextbook,
  options: Omit<SacrintBuildOptions, 'missionIndex'> = {}
): SacrintDeckSpec[] {
  const missionCount = Math.max(1, workbook.missions?.length ?? 0);
  const effectiveOptions: Omit<SacrintBuildOptions, 'missionIndex'> = {
    mode: 'lesson-guide',
    ...options,
  };
  return Array.from({ length: missionCount }, (_, missionIndex) =>
    buildSacrintDeck(workbook, { ...effectiveOptions, missionIndex })
  );
}

function buildSteps(
  mission: MissionSection,
  pack: SacrintPack,
  selectedSession?: SessionPlan
): SacrintInfographicStep[] {
  const solved = (mission.conceptZero?.solvedExample?.solutionSteps ?? [])
    .map((s) => distillStepPreservingMath(s, 200))
    .filter((item) => Boolean(item) && !isRubricOrBoilerplateLeak(item));
  const sessionExample = selectedSession ? extractWorkedExample(mission, selectedSession).steps : [];
  const effectiveSolved = solved.length > 0 ? solved : sessionExample;

  const fallback = [
    sanitizeField(mission.phenomenonHook?.story, '', 200, 32),
    sanitizeField(mission.iDoSection?.stepByStepDemo, '', 200, 32),
    sanitizeField(mission.weDoSection?.guidedPractice, '', 200, 32),
    sanitizeField(mission.youDoSection?.autonomousChallenge, '', 200, 32),
    'Verificar que el resultado responda con coherencia al contexto del planteamiento inicial.',
    'Integrar el procedimiento y la conclusión con evidencia en el producto del bloque.',
  ];

  const prioritizedFallback = [...fallback.slice(effectiveSolved.length), ...fallback];
  const source =
    effectiveSolved.length >= 4
      ? effectiveSolved.slice(0, 4)
      : [...effectiveSolved, ...prioritizedFallback]
          .filter((item, index, items) => Boolean(item) && !isRubricOrBoilerplateLeak(item) && items.indexOf(item) === index)
          .slice(0, 4);

  const labels = stepLabelsForPack(pack);
  return source.map((body, index) => ({
    number: index + 1,
    title: labels[index] ?? `PASO ${index + 1}`,
    body: distillStepPreservingMath(body, 210),
  }));
}

function buildRubric(workbook: ActiveWorkTextbook): SacrintRubricItem[] {
  const rubric = workbook.evaluationSection?.rubric ?? [];
  if (rubric.length > 0) {
    return rubric
      .map((item) => ({
        label: sanitizePedagogicalMetaPhrases(cleanSacrintText(item.criterion)),
        weight: item.weightPercent,
      }))
      .filter((item) => Boolean(item.label) && !isRubricOrBoilerplateLeak(item.label))
      .slice(0, 4);
  }
  const checklist = workbook.evaluationSection?.checklist ?? [];
  return checklist
    .map((item) => ({ label: sanitizePedagogicalMetaPhrases(cleanSacrintText(item.item)) }))
    .filter((item) => Boolean(item.label) && !isRubricOrBoilerplateLeak(item.label))
    .slice(0, 4);
}

export function buildSacrintInfographic(
  workbook: ActiveWorkTextbook,
  format: SacrintInfographicFormat = 'wide',
  options: SacrintBuildOptions = {}
): SacrintInfographicSpec {
  const mission = selectMission(workbook, options);
  const pack = resolveSacrintPack(workbook.coverData?.subjectName ?? '', workbook.subsystem);
  const meta = missionMeta(workbook, mission, pack);
  const sessionPlans = resolveSessionPlans(mission);
  const selectedSession =
    sessionPlans.length > 0
      ? sessionPlans[Math.max(0, Math.min(options.sessionIndex ?? 0, sessionPlans.length - 1))]
      : undefined;

  const bundle = selectedSession ? distillLessonBundle(mission, selectedSession) : undefined;
  const facts = baseFacts(meta, mission);
  const diagram = buildSacrintDiagram(mission, pack, { ...options, session: selectedSession });
  const formula = diagramFormula(diagram);
  const criteria = (mission.formativeCheckpoint?.criteriaChecklist ?? [])
    .map((item) => sanitizePedagogicalMetaPhrases(cleanSacrintText(item)))
    .filter((item) => Boolean(item) && !isRubricOrBoilerplateLeak(item));
  const project = workbook.projectSection;

  const conceptHighlights = extractConceptHighlights(mission, selectedSession);
  const quickExample = extractWorkedExample(mission, selectedSession);
  const misconceptionFixRaw = resolveMissionMisconceptionParts(mission, bundle);
  const misconceptionFix = {
    error: sanitizePedagogicalMetaPhrases(misconceptionFixRaw.error),
    correction: sanitizePedagogicalMetaPhrases(misconceptionFixRaw.correction),
  };
  const nonClosureSessionObjective = sessionPlans
    .map((s) => s.objetivo)
    .find((obj) => Boolean(obj) && !isEvaluationOrClosureObjective(obj));
  const topicTitle = sanitizePedagogicalMetaPhrases(
    resolveInfographicConceptTitle({
      conceptosClave: selectedSession?.contenido || mission.conceptZero?.coreExplanation,
      sessionObjective: selectedSession?.objetivo,
      missionSessionTopic: mission.sessionTopic,
      missionFocus: mission.sessionFocus || nonClosureSessionObjective,
      missionTitle: meta.missionTitle,
    })
  );
  const applicationSummary = sanitizePedagogicalMetaPhrases(
    bundle?.application ||
      sanitizeField(mission.youDoSection?.autonomousChallenge, 'Aplica el concepto en situaciones reales del proyecto.', 170, 26)
  );

  const validFormulas = conceptHighlights.formulas.filter(isValidRenderableFormula);
  const cleanTitle = sanitizePedagogicalMetaPhrases(topicTitle || meta.missionTitle);
  const cleanClaim = sanitizePedagogicalMetaPhrases(
    cleanMissionTopicLine(
      mission.sessionFocus || mission.sessionTopic || bundle?.concepts.definition,
      conceptHighlights.definition
    )
  );
  const rawKeyConcepts = conceptHighlights.keyRules.length > 0 ? conceptHighlights.keyRules : [conceptHighlights.definition];

  return {
    format,
    theme: options.theme ?? 'light',
    meta,
    pack,
    style: resolveSacrintStyle(pack.id),
    title: cleanTitle,
    topicTitle: cleanTitle,
    subtitle: `${meta.subjectName} · MISIÓN ${String(meta.missionNumber).padStart(2, '0')} · BLOQUE ${meta.blockNumber}`,
    claim: cleanClaim,
    formula,
    formulasList: validFormulas.length > 0 ? validFormulas : [formula],
    keyConcepts: rawKeyConcepts.map((c) => sanitizePedagogicalMetaPhrases(c)),
    quickExample: {
      problemStatement: sanitizePedagogicalMetaPhrases(quickExample.problemStatement),
      steps: quickExample.steps.map((s) => sanitizePedagogicalMetaPhrases(s)),
      interpretation: sanitizePedagogicalMetaPhrases(quickExample.interpretation),
    },
    variables: buildDiagramVariables(diagram),
    diagram,
    steps: buildSteps(mission, pack, selectedSession).map((step) => ({
      ...step,
      title: sanitizePedagogicalMetaPhrases(step.title),
      body: sanitizePedagogicalMetaPhrases(step.body),
    })),
    misconception: `${misconceptionFix.error} → ${misconceptionFix.correction}`,
    misconceptionFix,
    applicationSummary,
    criteria,
    rubric: buildRubric(workbook),
    project: {
      artifactName: sanitizePedagogicalMetaPhrases(cleanSacrintText(project?.artifactName)) || 'Producto integrador',
      communityUtility: sanitizePedagogicalMetaPhrases(
        sanitizeField(project?.communityUtility, 'Utilidad comunitaria por definir.', 170, 26)
      ),
    },
    facts,
  };
}
