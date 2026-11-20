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
  extractBulletSentences,
  extractChalkboardTopicTitle,
  extractCleanTopicTitle,
  enforceSixGramOverlap,
  extractConceptHighlights,
  extractWorkedExample,
  isRubricOrBoilerplateLeak,
  preventSixGramTheoryOverlap,
  sanitizePedagogicalMetaPhrases,
  sixGramOverlapRatio,
  paraphraseSixGramOverlap,
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
  extractDisciplinaryConceptPhrase,
  isEvaluationOrClosureObjective,
  isPaecProjectOrArtifactTitle,
  resolveInfographicConceptTitle,
  sanitizeWorkbookTocTitle,
} from '@/lib/editorial/topic-title-resolver';
import {
  finalizeVisibleText,
  fitPedagogicalText,
  hasDanglingEnding,
  repairDanglingEnding,
} from '@/lib/editorial/pedagogical-text-fitter';
import {
  isValidRenderableFormula,
  normalizeEditorialText,
  normalizeSessionDescriptorTense,
} from '@/lib/editorial/text-normalization';

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

function stripLeadingSessionTag(value: string): string {
  let out = cleanSacrintText(value);
  let prev = '';
  while (out !== prev) {
    prev = out;
    out = out.replace(/^(?:sesi[oó]n\s*\d+\s*[:.\-–—]*\s*)/i, '').trim();
  }
  return out;
}

const INVALID_CONCEPT_ANCHOR_RE =
  /^(?:vas\s+a|vamos\s+a|aprender|evaluar|integrar|optimizar|depurar|validar|construir|realizar|socializar|defender|explorar|aplicar|resolver)\b/i;

function extractShortConceptAnchor(topicTitle?: string, fallback?: string): string {
  const candidates = [topicTitle, fallback]
    .map((raw) => extractDisciplinaryConceptPhrase(stripLeadingSessionTag(raw || '')))
    .map((cleaned) =>
      cleaned
        .replace(/^(?:taller\s+de\s+|introducci[oó]n\s+a(?:l|\s+la)?\s+|fundamentos\s+de\s+)/i, '')
        .trim()
    )
    .filter((cleaned) => cleaned.length >= 6 && !INVALID_CONCEPT_ANCHOR_RE.test(cleaned) && !isPaecProjectOrArtifactTitle(cleaned));

  const cleaned = candidates[0] || '';
  if (!cleaned) return '';
  const headClause = cleaned.includes(':') ? cleaned.split(':')[0]!.trim() : cleaned;
  const source = headClause.length >= 10 ? headClause : cleaned;
  const rawWords = source
    .replace(/[¿?¡!.:;,]+$/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4);
  while (
    rawWords.length > 2 &&
    /^(?:de|del|la|el|los|las|un|una|en|con|por|para|sobre|entre|dentro|y|e|o|a|al|su|sus)$/i.test(
      rawWords[rawWords.length - 1]!
    )
  ) {
    rawWords.pop();
  }
  let candidate = rawWords.join(' ').trim();
  if (candidate.length > 32) {
    candidate = candidate.slice(0, 32).replace(/\s+\S*$/, '').trim();
  }
  const repaired = repairDanglingEnding(candidate, false).replace(/[¿?¡!.:;,]+$/g, '').trim();
  return INVALID_CONCEPT_ANCHOR_RE.test(repaired) ? '' : repaired;
}

function resolveMissionMisconceptionParts(
  mission: MissionSection,
  bundle?: DistilledLessonBundle,
  options: { session?: SessionPlan; allowMissionFallback?: boolean } = {}
): { error: string; correction: string } {
  const visualMap = options.session?.sintesisVisual?.mapaConceptual;
  const visualError = sanitizePedagogicalMetaPhrases(cleanSacrintText(visualMap?.errorComun));
  if (visualError && !isRubricOrBoilerplateLeak(visualError)) {
    const visualCorrection = sanitizePedagogicalMetaPhrases(cleanSacrintText(visualMap?.correccionBreve));
    return {
      error: visualError,
      correction:
        visualCorrection && !isRubricOrBoilerplateLeak(visualCorrection)
          ? visualCorrection
          : 'Contrastar cada afirmación con evidencia y criterios explícitos de la sesión.',
    };
  }
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
  const sessionIdx = Math.max(0, (options.session?.sessionNumber ?? 1) - 1);
  const rawAnchor = extractShortConceptAnchor(bundle?.topicTitle, options.session?.objetivo)
    .replace(/[¿?¡!.:;,]+$/g, '')
    .trim();
  const anchor = rawAnchor;

  const primaryContextText = [
    bundle?.topicTitle,
    options.session?.objetivo,
    options.session?.contenido,
    allowMission ? mission.sessionTopic : undefined,
    allowMission ? mission.title : undefined,
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  const withAnchor = (chosen: { error: string; correction: string }): { error: string; correction: string } => {
    if (allowMission || !anchor || INVALID_CONCEPT_ANCHOR_RE.test(anchor)) return chosen;
    // Anclas vacías, explícitamente genéricas o colgadas no son un tema real.
    // NOTA: No usar isGenericMisconception() directamente porque su umbral length<25
    // rechaza anclas cortas pero conceptualmente específicas (ej. "margen de error").
    // En su lugar comprobamos: ancla trivialmente corta (<8 chars) O frases genéricas
    // por regex O patrones de colgado.
    const anchorIsVagueGeneric =
      anchor.length < 8 ||
      /^(?:definir|analizar|resolver|explorar|comprender|aplicar|identificar|reconocer|explicar|calcular|determinar|modelar|interpretar|evaluar|comparar|justificar|construir|elaborar|realizar|profundizar|estudiar|describir)\b/i.test(
        anchor
      ) ||
      /^(?:resultados?\s+obtenidos|error\s+com[uú]n|revisar|analizar|evaluar|comprobar|verificar)\b/i.test(anchor);
    if (
      anchorIsVagueGeneric ||
      /^(?:resultados?|procedimiento|proceso)\b/i.test(anchor) ||
      /\b(?:al|para|de|por)\s+[a-záéíóúñ]+(?:ar|er|ir)$/i.test(anchor) ||
      hasDanglingEnding(anchor)
    ) {
      return chosen;
    }
    const base = chosen.error.replace(/\.+$/, '').trim();
    if (base.toLowerCase().includes(anchor.toLowerCase())) {
      return { error: `${base}.`, correction: chosen.correction };
    }
    const lowerFirst = base.charAt(0).toLowerCase() + base.slice(1);
    return {
      error: `${anchor}: ${lowerFirst}.`,
      correction: chosen.correction,
    };
  };

  const pickByKeywordAndSession = (
    subRules: Array<{ pattern: RegExp; error: string; correction: string }>,
    variants: Array<{ error: string; correction: string }>
  ): { error: string; correction: string } => {
    const countMatches = (pattern: RegExp, text: string): number => {
      if (!text) return 0;
      const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
      return text.match(new RegExp(pattern.source, flags))?.length ?? 0;
    };
    const primaryMatched = subRules.filter((rule) => rule.pattern.test(primaryContextText));
    const matched =
      primaryMatched.length > 0
        ? primaryMatched
        : subRules.filter((rule) => rule.pattern.test(contextText));
    const scored = matched
      .map((rule, index) => ({
        rule,
        index,
        score:
          countMatches(rule.pattern, primaryContextText) * 5 +
          countMatches(rule.pattern, contextText) * 2 +
          (rule.pattern.source.match(/\|/g)?.length ?? 0),
      }))
      .sort((a, b) => b.score - a.score || a.index - b.index);
    // Mantener variedad entre sesiones sin perder relevancia: rota entre las
    // mejores reglas aplicables en lugar de repetir siempre la misma.
    const pool = scored.slice(0, Math.min(4, scored.length));
    const chosen = pool[sessionIdx % pool.length]?.rule ?? variants[sessionIdx % variants.length]!;
    return withAnchor(chosen);
  };

  if (classification.kind === 'exponential') {
    return pickByKeywordAndSession(
      [
        {
          pattern: /poblaci[oó]n|crecimiento|bacteri|duplic/i,
          error: 'Sumar un incremento fijo en lugar de factor exponencial.',
          correction: 'Aplicar P(t) = P₀(1 + r)ᵗ sobre el total vigente de cada periodo.',
        },
        {
          pattern: /depreciaci[oó]n|descuento|p[eé]rdida|decaimiento/i,
          error: 'Usar (1 + r)ᵗ en lugar del factor de reducción (1 - r)ᵗ.',
          correction: 'Verificar si la magnitud crece o decrece antes de fijar el signo de la tasa.',
        },
      ],
      [
        {
          error: 'Multiplicar tasa por periodos como si fuera lineal.',
          correction: 'Aplicar la potencia (1 + r)ᵗ sobre el capital acumulado en cada periodo.',
        },
        {
          error: 'Usar tasa anual sin ajustar al periodo de capitalización.',
          correction: 'Homologar la unidad temporal de la tasa r y del exponente t antes de calcular.',
        },
        {
          error: 'Sustituir porcentaje entero sin convertir a decimal.',
          correction: 'Convertir r% a decimal (r/100) antes de elevar el binomio (1 + r)ᵗ.',
        },
        {
          error: 'Confundir valor final compuesto con ganancia neta.',
          correction: 'Restar el capital inicial C₀ al monto M cuando se pida solo el interés ganado.',
        },
      ]
    );
  }
  if (classification.kind === 'statistics') {
    return pickByKeywordAndSession(
      [
        {
          pattern: /margen de error|intervalo de confianza/i,
          error: 'Usar el margen de error porcentual sin pasarlo a decimal.',
          correction: 'Expresar el margen como decimal (ej. 5% = 0.05) y verificar el tamaño muestral.',
        },
        {
          pattern: /muestra|encuesta|poblaci[oó]n/i,
          error: 'Generalizar desde una muestra sesgada o insuficiente.',
          correction: 'Definir tamaño muestral representativo y criterios homogéneos de recolección.',
        },
        {
          pattern: /frecuencia|tabula|tabla/i,
          error: 'Contar frecuencias aisladas sin verificar el total n.',
          correction: 'Sumar las frecuencias absolutas y comprobar que coincidan con el tamaño n.',
        },
        {
          pattern: /promedio|media|mediana|moda|desviaci[oó]n/i,
          error: 'Calcular mediana sin ordenar previamente los datos.',
          correction: 'Ordenar el conjunto, revisar valores atípicos y elegir la medida representativa.',
        },
      ],
      [
        {
          error: 'Leer frecuencias aisladas sin compararlas al total.',
          correction: 'Calcular proporciones relativas y verificar que las frecuencias sumen el total.',
        },
        {
          error: 'Inferir causalidad directa desde una correlación simple.',
          correction: 'Distinguir asociación estadística de relación causa-efecto con evidencia contextual.',
        },
        {
          error: 'Omitir valores atípicos al interpretar el promedio.',
          correction: 'Contrastar media, mediana y rango para describir la dispersión real.',
        },
        {
          error: 'Comparar categorías con tamaños muestrales distintos sin proporción.',
          correction: 'Normalizar mediante porcentajes o frecuencias relativas sobre cada grupo.',
        },
      ]
    );
  }
  if (classification.kind === 'quadratic') {
    return pickByKeywordAndSession(
      [
        {
          pattern: /discriminante|b\^?2\s*-\s*4ac|f[oó]rmula general/i,
          error: 'Omitir el signo de b al evaluar b² - 4ac.',
          correction: 'Encerrar cada coeficiente con su signo entre paréntesis al evaluar el discriminante.',
        },
        {
          pattern: /v[eé]rtice|m[aá]ximo|m[ií]nimo|altura|par[aá]bola/i,
          error: 'Omitir el signo negativo en xᵥ = -b/(2a).',
          correction: 'Calcular primero xᵥ = -b/(2a) y evaluar f(xᵥ) para obtener el extremo exacto.',
        },
        {
          pattern: /factoriz|producto|ra[ií]ces|terreno|[aá]rea/i,
          error: 'Factorizar o despejar sin igualar antes a cero.',
          correction: 'Llevar la ecuación a ax² + bx + c = 0 antes de factorizar o aplicar raíces.',
        },
      ],
      [
        {
          error: 'Omitir el signo del coeficiente cuadrático principal.',
          correction: 'Conservar el signo de a en la forma estándar y validar cada raíz en el enunciado.',
        },
        {
          error: 'Aceptar raíces fuera del dominio físico del problema.',
          correction: 'Descartar soluciones negativas o fuera de dominio que no tengan sentido real.',
        },
        {
          error: 'Invertir los signos de las raíces al factorizar binomios.',
          correction: 'Igualar cada factor (x - r) = 0 por separado y comprobar sustituyendo.',
        },
        {
          error: 'Confundir el término cuadrático con variación lineal.',
          correction: 'Verificar si aparece x² o producto de dos variables antes de elegir modelo.',
        },
      ]
    );
  }
  if (classification.kind === 'system-2x2') {
    return pickByKeywordAndSession(
      [
        {
          pattern: /sustituci[oó]n/i,
          error: 'Sustituir el despeje en la misma ecuación origen.',
          correction: 'Reemplazar la variable en la ecuación contraria para evitar identidades triviales.',
        },
        {
          pattern: /reducci[oó]n|eliminaci[oó]n|suma y resta/i,
          error: 'Multiplicar solo un término al igualar coeficientes.',
          correction: 'Multiplicar toda la fila (izquierda y derecha) para conservar la equivalencia.',
        },
        {
          pattern: /gr[aá]fic|intersecci[oó]n|plano/i,
          error: 'Graficar ejes con distinta escala y leer mal el cruce.',
          correction: 'Usar escala uniforme y verificar el punto (x, y) por sustitución algebraica.',
        },
        {
          pattern: /gr[aá]fic|intersecci[oó]n|rectas/i,
          error: 'Leer el cruce invertido como (y, x) en vez de (x, y).',
          correction: 'Ubicar primero la abscisa x horizontal y después la ordenada y vertical.',
        },
        {
          pattern: /determinante|cramer/i,
          error: 'Invertir signos al restar la diagonal secundaria en Δ.',
          correction: 'Aplicar Δ = a₁b₂ - a₂b₁ respetando paréntesis y signos de cada coeficiente.',
        },
      ],
      [
        {
          error: 'Plantear una ecuación cuando hay dos restricciones.',
          correction: 'Definir claramente cada incógnita y verificar que el par (x, y) cumpla ambas ecuaciones.',
        },
        {
          error: 'Invertir signos al despejar una incógnita inicial.',
          correction: 'Comprobar cada transformación sustituyendo un par de prueba en la ecuación original.',
        },
        {
          error: 'Hallar x sin sustituir para obtener la segunda variable y.',
          correction: 'Completar el par (x, y) y validar ambas igualdades antes de concluir.',
        },
        {
          error: 'Suponer solución única sin revisar si las rectas son paralelas.',
          correction: 'Comparar pendientes o determinante Δ antes de interpretar el sistema.',
        },
      ]
    );
  }
  if (classification.kind === 'geometry') {
    return pickByKeywordAndSession(
      [
        {
          pattern: /suplementar|complementar|opuestos\s+(?:por\s+el\s+|al\s+)v[eé]rtice|par\s+lineal|tipos\s+de\s+[aá]ngulos/i,
          error: 'Sumar ángulos suplementarios como si sumaran 90° o igualarlos sin verificar el tipo.',
          correction: 'Comprobar primero si el par es complementario (90°), suplementario (180°) u opuesto por el vértice (iguales).',
        },
        {
          pattern: /congruen|semejan|napole[oó]n|\blal\b|\bala\b|\blll\b/i,
          error: 'Asumir congruencia sin comprobar criterio ni orden angular.',
          correction: 'Justificar el criterio (LLL, LAL o ALA) con correspondencia explícita de vértices.',
        },
        {
          pattern: /pit[aá]goras|hipotenusa|cateto/i,
          error: 'Confundir un cateto con la hipotenusa del triángulo.',
          correction: 'Identificar el ángulo recto primero para aislar la hipotenusa c² = a² + b².',
        },
        {
          pattern: /per[ií]metro|[aá]rea|superficie|volumen/i,
          error: 'Mezclar unidades lineales y cuadráticas o usar lado inclinado.',
          correction: 'Confirmar dimensiones perpendiculares y expresar áreas en unidades cuadradas.',
        },
      ],
      [
        {
          error: 'Aplicar fórmula geométrica sin identificar datos de la figura.',
          correction: 'Trazar el esquema con medidas etiquetadas y verificar qué relación geométrica aplica.',
        },
        {
          error: 'Operar medidas en distintas unidades sin homogeneizar.',
          correction: 'Expresar todas las medidas en la misma unidad antes de operar.',
        },
        {
          error: 'Sumar ángulos suplementarios como si sumaran 90°.',
          correction: 'Distinguir complementarios (90°) de suplementarios (180°) antes de despejar.',
        },
        {
          error: 'Calcular el perímetro completo omitiendo un tramo del contorno.',
          correction: 'Recorrer todos los lados de la figura verificando cierres y longitudes parciales.',
        },
      ]
    );
  }
  if (classification.kind === 'proportion') {
    return pickByKeywordAndSession(
      [
        {
          pattern: /inversa|obrero|velocidad|tiempo/i,
          error: 'Usar regla directa cuando la relación es inversa.',
          correction: 'Comprobar si k = x·y es constante (inversa) o y/x es constante (directa).',
        },
        {
          pattern: /porcentaje|descuento|iva|aumento/i,
          error: 'Sumar porcentajes sucesivos sin aplicar al nuevo valor.',
          correction: 'Calcular cada variación porcentual en cadena usando factores decimales.',
        },
      ],
      [
        {
          error: 'Acomodar magnitudes en orden cruzado al despejar.',
          correction: 'Alinear cada columna con la misma unidad antes de multiplicar en cruz.',
        },
        {
          error: 'Confundir razón unitaria con cambio absoluto total.',
          correction: 'Dividir siempre la magnitud dependiente entre la unidad de referencia.',
        },
        {
          error: 'Aplicar proporcionalidad cuando existe costo fijo inicial.',
          correction: 'Revisar si la recta pasa por (0, 0) antes de aplicar regla de tres.',
        },
        {
          error: 'Omitir la unidad de comparación entre dos razones.',
          correction: 'Expresar ambas razones sobre la misma base antes de concluir.',
        },
      ]
    );
  }
  if (classification.kind === 'linear' || /ecuaci[oó]n|algebraic|inc[oó]gnita|balanza|lineal|pendiente|recta/i.test(contextText)) {
    return pickByKeywordAndSession(
      [
        {
          pattern: /pendiente|raz[oó]n de cambio|m\s*=|tasa/i,
          error: 'Invertir cociente vertical y horizontal al calcular pendiente.',
          correction: 'Mantener el mismo orden (y₂ - y₁)/(x₂ - x₁) en numerador y denominador.',
        },
        {
          pattern: /par[eé]ntesis|distributiv|signo/i,
          error: 'Distribuir factor o signo solo al primer término.',
          correction: 'Distribuir factor y signo sobre cada término interior antes de agrupar semejantes.',
        },
        {
          pattern: /fracci[oó]n|denominador/i,
          error: 'Quitar un denominador sin multiplicar toda la ecuación.',
          correction: 'Multiplicar toda la ecuación por el mínimo común múltiplo para conservar el equilibrio.',
        },
        {
          pattern: /dos\s+(?:variables|inc[oó]gnitas)|tabular|intercepto/i,
          error: 'Intercambiar las coordenadas (0, b) y (a, 0) al tabular.',
          correction: 'Evaluar x = 0 para hallar el corte vertical y = b y y = 0 para el horizontal.',
        },
        {
          pattern: /dos\s+(?:variables|inc[oó]gnitas)|recta|gr[aá]fic/i,
          error: 'Cometer error de signo al despejar y en ax + by = c.',
          correction: 'Trasponer ax con signo contrario y dividir cada término entre b.',
        },
        {
          pattern: /balanza|equilibrio/i,
          error: 'Mover términos sin aplicar operación inversa bilateral.',
          correction: 'Aplicar la misma operación inversa en ambos miembros y comprobar sustituyendo.',
        },
        {
          pattern: /despej|primer\s+grado|lineal/i,
          error: 'Sumar constantes sueltas con coeficientes algebraicos.',
          correction: 'Agrupar únicamente términos semejantes antes de despejar la incógnita.',
        },
        {
          pattern: /inc[oó]gnita|ecuaci[oó]n|model/i,
          error: 'Elegir una incógnita distinta a la magnitud preguntada.',
          correction: 'Definir qué representa x y sus unidades antes de plantear la igualdad.',
        },
      ],
      [
        {
          error: 'Confundir término fijo b con tasa de cambio m.',
          correction: 'Separar la tasa por unidad m del valor inicial fijo b en y = mx + b.',
        },
        {
          error: 'Sumar constantes sueltas con coeficientes algebraicos.',
          correction: 'Agrupar únicamente términos con igual literal y exponente antes de despejar.',
        },
        {
          error: 'Concluir el valor de x sin verificar la igualdad original.',
          correction: 'Sustituir la solución en la ecuación inicial para validar ambos miembros.',
        },
        {
          error: 'Elegir incógnita distinta a la magnitud preguntada.',
          correction: 'Definir explícitamente qué representa x y sus unidades antes de plantear.',
        },
      ]
    );
  }

  // Dominios no matemáticos (Historia, Lengua, Ciencias Experimentales, Humanidades)
  if (/historia|proceso|siglo|revoluci[oó]n|independencia|guerra|cronolog|fuente/i.test(contextText)) {
    return pickByKeywordAndSession([], [
      {
        error: 'Memorizar fechas aisladas sin explicar causas ni actores.',
        correction: 'Relacionar contexto previo, detonante y transformación social o política del periodo.',
      },
      {
        error: 'Tomar una opinión posterior como fuente primaria histórica.',
        correction: 'Identificar autoría, época y propósito de cada fuente histórica antes de concluir.',
      },
      {
        error: 'Juzgar hechos históricos sin situar el contexto de la época.',
        correction: 'Explicar las condiciones sociales, económicas y políticas vigentes en ese periodo.',
      },
      {
        error: 'Omitir consecuencias de mediano plazo al describir un suceso.',
        correction: 'Conectar el evento detonante con sus cambios institucionales y cotidianos.',
      },
      {
        error: 'Mezclar causas estructurales con detonantes inmediatos.',
        correction: 'Distinguir condiciones acumuladas de hechos puntuales que desataron el proceso.',
      },
    ]);
  }
  if (/texto|ensayo|argument|tesis|lectura|p[aá]rrafo|discurso|lengua|gram[aá]tica|oral|comunica|escrito|mensaje|redacci[oó]n|cr[oó]nica|peri[oó]dico|noticia|reportaje|entrevista|rese[ñn]a|literat|narrat|lead|titular|editorial|debate|di[aá]log|falacia/i.test(contextText)) {
    return pickByKeywordAndSession([], [
      {
        error: 'Emitir opiniones sin respaldar la tesis con evidencia textual.',
        correction: 'Articular postura clara, evidencia verificable y conectores lógicos entre párrafos.',
      },
      {
        error: 'Copiar oraciones sueltas sin jerarquizar la idea principal.',
        correction: 'Jerarquizar tesis central, evidencias de apoyo y conclusión con palabras propias.',
      },
      {
        error: 'Confundir la intención comunicativa con un simple resumen.',
        correction: 'Identificar propósito del emisor, destinatario y tono antes de interpretar el texto.',
      },
      {
        error: 'Encadenar ideas sin conectores ni progresión temática.',
        correction: 'Enlazar cada párrafo con un marcador lógico que sostenga la tesis central.',
      },
      {
        error: 'Interpretar el vocabulario fuera de su contexto comunicativo.',
        correction: 'Contrastar el sentido literal y contextual según la situación del intercambio.',
      },
    ]);
  }
  if (/c[eé]lula|ecosistema|energ[ií]a|materia|experimento|hip[oó]tesis|variable|reacci[oó]n|qu[ií]m|f[ií]sica|biolog/i.test(contextText)) {
    return pickByKeywordAndSession([], [
      {
        error: 'Concluir sin aislar variables ni respaldar con mediciones.',
        correction: 'Contrastarla directamente contra la hipótesis inicial y los registros observados.',
      },
      {
        error: 'Confundir el efecto observado con su mecanismo científico.',
        correction: 'Vincular evidencia empírica, variables de control y principio científico del tema.',
      },
      {
        error: 'Plantear una hipótesis sin forma comprobable ni evidencia.',
        correction: 'Formular una predicción medible que conecte causa observable y resultado.',
      },
      {
        error: 'Ignorar unidades o condiciones de control durante el registro.',
        correction: 'Estandarizar unidades y registrar variables constantes en cada ensayo.',
      },
    ]);
  }

  if (allowMission) {
    const firstCriterion = cleanSacrintText(mission.formativeCheckpoint?.criteriaChecklist?.[0]);
    if (firstCriterion && !isRubricOrBoilerplateLeak(firstCriterion)) {
      return {
        error: `Omitir la verificación de: ${distillConciseText(firstCriterion, 110, 17)}`,
        correction: 'Validar paso a paso con evidencia e instrumentos de la sesión.',
      };
    }
  }

  const genericPool = [
    {
      error: 'Ejecutar pasos mecánicamente sin validar los datos iniciales.',
      correction: 'Contrastar el resultado con las condiciones iniciales y los criterios de la sesión.',
    },
    {
      error: 'Responder de forma general sin justificar el criterio clave.',
      correction: 'Explicar explícitamente la regla o evidencia que sostiene la respuesta final.',
    },
    {
      error: 'Omitir la revisión al pasar del análisis a la conclusión.',
      correction: 'Validar coherencia entre datos de partida, desarrollo y conclusión final.',
    },
    {
      error: 'Confundir un ejemplo particular con la regla general.',
      correction: 'Comprobar que el criterio se cumpla en toda la situación planteada.',
    },
    {
      error: 'Dejar el resultado aislado sin interpretarlo en contexto.',
      correction: 'Explicar qué significa la conclusión frente a la pregunta detonadora.',
    },
  ];
  return withAnchor(genericPool[sessionIdx % genericPool.length]!);
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

const workbookTheorySourcesCache = new WeakMap<ActiveWorkTextbook, string[]>();

export function collectWorkbookTheorySources(workbook: ActiveWorkTextbook): string[] {
  const cached = workbookTheorySourcesCache.get(workbook);
  if (cached) return cached;

  const sources: string[] = [];
  for (const m of workbook.missions ?? []) {
    if (m.conceptZero) pushTheoryStrings(sources, m.conceptZero);
    if (m.phenomenonHook?.story) sources.push(m.phenomenonHook.story);
    for (const s of m.sessionPlans ?? []) {
      if (s.contenido) sources.push(s.contenido);
      if (s.ejemploResuelto) sources.push(s.ejemploResuelto);
      if (s.aplicacion) sources.push(s.aplicacion);
      if (s.productoIntegrador) sources.push(s.productoIntegrador);
      for (const practice of s.practica ?? []) {
        if (practice.enunciado) sources.push(practice.enunciado);
        if (practice.pista) sources.push(practice.pista);
      }
    }
  }
  workbookTheorySourcesCache.set(workbook, sources);
  return sources;
}

function collectDiagramText(value: unknown, out: string[]): void {
  if (typeof value === 'string') {
    if (value.trim()) out.push(value.trim());
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectDiagramText(item, out);
    return;
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value as Record<string, unknown>)) collectDiagramText(item, out);
  }
}

function slideVisibleText(slide: SacrintSlide): string {
  const parts: string[] = [];
  const add = (value: string | undefined | null) => {
    if (value && value.trim()) parts.push(value.trim());
  };
  add(slide.title);
  add(slide.subtitle);
  if (slide.kind === 'concept') {
    const hasRenderedDiagram = Boolean(slide.diagram?.available);
    add(slide.explanation);
    if (!slide.isLessonGuide) {
      add(slide.analogy);
    }
    add(slide.misconception);
    if (!slide.isLessonGuide || !hasRenderedDiagram) {
      add(slide.formulas && slide.formulas.length > 0 ? slide.formulas[0] : slide.formula);
      for (const item of slide.keyTakeaways ?? []) add(item);
    }
    if (slide.workedExample) {
      add(slide.workedExample.problemStatement);
      for (const step of slide.workedExample.steps.slice(0, 3)) add(step);
      add(slide.workedExample.interpretation);
    }
    if (!slide.isLessonGuide) {
      for (const variable of slide.variables ?? []) {
        add(variable.label);
        add(variable.meaning);
      }
    }
    if (hasRenderedDiagram) {
      const diagramText: string[] = [];
      collectDiagramText(slide.diagram, diagramText);
      for (const item of diagramText) add(item);
    }
  }
  if (slide.kind === 'practice') {
    const activities =
      slide.activities && slide.activities.length > 0
        ? slide.activities
        : slide.checkpoints.map((checkpoint, index) => ({
            label: `Actividad ${index + 1}`,
            statement: checkpoint,
            hint: '',
          }));
    const visibleActivities = slide.isLessonGuide ? activities.slice(0, 2) : activities;
    for (const activity of visibleActivities) {
      add(activity.label);
      add(activity.statement);
      add(activity.hint);
    }
    add(slide.applicationText || slide.practiceText);
    for (const item of (slide.objectiveBullets ?? []).slice(0, 2)) add(item);
    for (const item of (slide.evaluationCriteria ?? []).slice(0, 2)) add(item);
    if (!slide.isLessonGuide) {
      for (const item of slide.exitChecks ?? []) add(item);
    }
    add(slide.artifactName);
    add(slide.artifactStep);
  }
  return parts.join(' ');
}

export function countSlideWords(slide: SacrintSlide): number {
  const text = slideVisibleText(slide);
  const visibleWords = text ? text.split(/\s+/).filter(Boolean).length : 0;
  const chromeWords =
    slide.kind === 'concept'
      ? slide.isLessonGuide
        ? slide.diagram?.available
          ? 52
          : 36
        : 44
      : slide.kind === 'practice'
        ? slide.isLessonGuide
          ? 40
          : 44
        : 0;
  return visibleWords + chromeWords;
}

function compactConceptNarrative(value: string): string {
  return String(value || '')
    .replace(/\bObservamos que\b/gi, '')
    .replace(/\bpor lo que podemos sustituir directamente su valor\b/gi, 'y sustituimos')
    .replace(/\bde manera (?:exacta|precisa|rigurosa|detallada)\b/gi, '')
    .replace(/\bredactas en el registro de coevaluaci[oó]n que\b/gi, '')
    .replace(/\bdebido a un fallo en el signo del despeje\b/gi, 'por un fallo de signo')
    .replace(/\bAplica la ra[ií]z cuadrada en ambos miembros de la ecuaci[oó]n para despejar\b/gi, 'Despeja con la raíz cuadrada')
    .replace(/\bEl plano indica que\b/gi, '')
    .replace(/\bformado entre ellas en el v[eé]rtice superior es exactamente de\b/gi, 'entre ellas es de')
    .replace(/\bEn la comunidad de estudio se realiz[oó] un censo inicial que determin[oó] una poblaci[oó]n base de\b/gi, 'La población base es')
    .replace(/\belaborando la memoria de c[aá]lculo paso a paso y determinando\b/gi, 'y determina')
    .replace(/\bDurante el proceso de coevaluaci[oó]n de tu expediente t[eé]cnico,\s*tus compa[ñn]eros revisan[^,]+y detectan que\b/gi, 'En coevaluación se detecta que')
    .replace(/\bDebes aplicar la correcci[oó]n y documentar el registro de coevaluaci[oó]n\./gi, 'Corrige y documenta la coevaluación.')
    .replace(/\bSe desea dise[ñn]ar (una|un) ([^.]{5,80}) con forma rectangular\./gi, 'Diseña $1 $2 rectangular.')
    .replace(/\bDebes calcular anal[ií]ticamente ([^.]{4,70}) y validar gr[aá]ficamente el resultado para integrarlo en tu [^.]+\./gi, 'Calcula $1 y valida el resultado gráficamente.')
    .replace(/\bResuelve la ecuaci[oó]n algebraica:\s*Agrupa los t[eé]rminos con ([a-z]) en un miembro y los t[eé]rminos independientes(?:\s+en\s+el\s+otro)?:\s*/gi, 'Agrupa $1 y constantes: ')
    .replace(/\bIdentificar los coeficientes de la ecuaci[oó]n en su forma general ([^:]+):\s*/gi, 'Identifica los coeficientes ($1): ')
    .replace(/\butilizando el Teorema de Pit[aá]goras,\s*donde la hipotenusa es ([^,]{2,20}) y el cateto base es la mitad del lado \(([^)]+)\)\./gi, 'por Pitágoras (hipotenusa $1, cateto $2):')
    .replace(/\bdebido al paralelismo de los soportes met[aá]licos,?\s*/gi, 'por paralelismo, ')
    .replace(/\ben el marco del Pensamiento Matem[aá]tico\b/gi, 'en Pensamiento Matemático')
    .replace(/\bSi se ha determinado algebraicamente que uno de los [aá]ngulos internos mide\b/gi, 'Si un ángulo interno mide')
    .replace(/\by su [aá]ngulo alterno interno correspondiente mide\b/gi, 'y su alterno interno mide')
    .replace(/\bcalcula el valor exacto de la inc[oó]gnita ([a-z]),\s*determina la medida num[eé]rica de esos [aá]ngulos para validar el plano estructural/gi, 'calcula $1 y la medida de ambos ángulos')
    .replace(/\basegurando el uso correcto de dos cifras decimales en todas las operaciones intermedias\b/gi, 'con dos decimales')
    .replace(/\badem[aá]s de un error menor de redondeo en el c[aá]lculo de\b/gi, 'y un error de redondeo en')
    .replace(/(\$[\d.,]+)\s+pesos\b/gi, '$1')
    .replace(/\s*\([^)\d=]{14,90}\)/g, '')
    .replace(/\bde dichos\b/gi, 'de esos')
    .replace(/\bde el\b/gi, 'del')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;])/g, '$1')
    .trim();
}

function compactProblemPreamble(value: string): string {
  return compactConceptNarrative(
    String(value || '')
      .replace(
        /\bDurante\s+[^,]{5,140},\s*(?:analizas|revisas|estudias)\s+el\s+procedimiento\s+(?:empleado\s+)?para\s+resolver\b/gi,
        'Resuelve'
      )
      .replace(
        /^Si el presupuesto (?:total )?disponible(?: para esta [a-záéíóúñ]+)? es de (\$[\d.,]+)(?:\s+pesos)?,\s+/i,
        'Con presupuesto de $1, '
      )
  );
}

function compactEvaluationCriterion(value: string): string {
  const cleaned = String(value || '')
    .replace(/^¿(?:Puedo|Soy capaz de|Fui capaz de|Logr[eé])\s+/i, '')
    .replace(/\?$/, '.')
    .replace(/\bcon mis propias palabras\b/gi, '')
    .replace(/\bcon claridad\b/gi, '')
    .replace(/\bcon orden y rigor\b/gi, '')
    .replace(/\brigor met[oó]dico y orden al\b/gi, 'orden al')
    .replace(/\btodos los elementos requeridos en mi\b/gi, 'los elementos de mi')
    .replace(/\ben qu[eé] se diferencia de\b/gi, 'cómo se diferencia de')
    .replace(/\by en qu[eé] se diferencia\b/gi, 'y cómo se diferencia')
    .replace(/\bexact[oa]s?\b/gi, '')
    .replace(/\bpara verificar la precisi[oó]n de mis (?:c[aá]lculos|resultados)[^,.?]*/gi, 'para verificar mis resultados')
    .replace(/\bde mi compa[ñn]er[oa]\b/gi, 'del procedimiento')
    .replace(/\ben mi (?:modelo|proyecto|reporte)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;?])/g, '$1')
    .trim();
  return cleaned
    .replace(/^¿([a-záéíóúñ])/, (_, letter: string) => `¿${letter.toUpperCase()}`)
    .replace(/^([a-záéíóúñ])/, (_, letter: string) => letter.toUpperCase());
}

function compactHintText(value: string | undefined): string | undefined {
  if (!value) return value;
  const cleaned = String(value)
    .replace(
      /^(?:Recuerda|Ten en cuenta|Considera|Observa|Nota)\s+que\s+(?:para\s+[^,]{3,40},?\s*)?(?:debes|puedes|tienes que|hay que|se debe)\s+/i,
      ''
    )
    .replace(/^(?:Recuerda|Ten en cuenta|Considera)\s+que\s+/i, '')
    .replace(/,?\s*o\s+plantea\s+que\s+[^,]{15,85},\s*es\s+decir,\s*/gi, ' o plantea ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (!cleaned || cleaned.length < 24 || /^(?:para|por|con|de|en|a)\b/i.test(cleaned)) {
    return value;
  }
  return cleaned.replace(/^([a-záéíóúñ])/, (_, ch: string) => ch.toUpperCase());
}

function compactActivityStatement(statement: string): string {
  const original = String(statement || '').trim();
  if (!original) return original;
  const compacted = original
    .replace(
      /^(?:Para|Con el fin de|Con la finalidad de|Con el prop[oó]sito de)\s+(?:la\s+|el\s+|los\s+|las\s+)?(?:acondicionar|adecuar|organizar|promover|prevenir|mejorar|remodelar|rehabilitar|construir|dise[ñn]ar|impulsar|fortalecer|apoyar|celebrar|ambientar|adornar|fondear|financiar|implementar|evaluar)\b[^,]{0,110},\s*/i,
      ''
    )
    .replace(/^En\s+(?:una|un|el|la)\s+[^,]{8,95},\s*(?=[A-ZÁÉÍÓÚÑa-záéíóúñ])/i, '')
    .replace(/\s+destinad[oa]s?\s+a\s+[^,.]{3,65}(?=[,.]|$)/gi, '')
    .replace(/\bcon el (?:fin|prop[oó]sito|objetivo) de\s+[^,.]{3,65}(?=[,.]|$)/gi, '')
    .replace(/\bpara modelar (?:la situaci[oó]n|este escenario|el caso|el fenómeno)\b/gi, 'para modelar')
    .replace(/\bcon tu calculadora cient[ií]fica\b/gi, 'con calculadora')
    .replace(/\bredacta tus observaciones t[eé]cnicas\b/gi, 'redacta tus observaciones')
    .replace(/\bredacta las conclusiones t[eé]cnicas de viabilidad\b/gi, 'concluye su viabilidad')
    .replace(/\by redacta una breve interpretaci[oó]n de(?:l)?\b/gi, 'e interpreta')
    .replace(/\bdetermina si la soluci[oó]n final es [a-záéíóúñ]+mente correcta\b/gi, 'determina si la solución es correcta')
    .replace(/\bverifica tu resultado mediante sustituci[oó]n\b/gi, 'verifica por sustitución')
    .replace(
      /^Realiza la revisi[oó]n cruzada del siguiente procedimiento desarrollado por un[a]? compa[ñn]er[oa] para resolver\b/i,
      'Revisa el procedimiento para resolver'
    )
    .replace(/\bEn su reporte,\s*(?:el|la) compa[ñn]er[oa] afirma que al agrupar [^,]+ obtuvo\b/gi, 'El reporte indica que obtuvo')
    .replace(/\blo que resulta en\b/gi, 'y obtiene')
    .replace(/\butilizando las propiedades de\b/gi, 'con las propiedades de')
    .replace(
      /\bAudita el reporte t[eé]cnico de un[a]? compa[ñn]er[oa] que modela [^.]*? mediante\b/gi,
      'Audita el reporte modelado mediante'
    )
    .replace(/\b(?:El|La) compa[ñn]er[oa] indica que\b/gi, 'Se indica que')
    .replace(
      /\bVerifica si el procedimiento cumple con el rigor [a-záéíóúñ]+ y redacta tu retroalimentaci[oó]n en la bit[aá]cora\./gi,
      'Verifica el procedimiento y redacta tu retroalimentación.'
    )
    .replace(/\bElabora la tabla de progresi[oó]n [a-záéíóúñ]+ para validar los datos en tu [^.]+\./gi, 'Tabula la progresión para validar los datos.')
    .replace(/\b(?:Construye|Utiliza) una matriz de comprobaci[oó]n evaluando (?:valores de )?/gi, 'Evalúa ')
    .replace(/\bpara verificar en qu[eé] momento exacto los costos se cruzan y cu[aá]l opci[oó]n conviene para un evento de\b/gi, 'para determinar cuándo se igualan costos y qué conviene para')
    .replace(/\bpara determinar el punto de equilibrio y verificar los costos\b/gi, 'para hallar el equilibrio y verificar costos')
    .replace(/\bcobra un dep[oó]sito fijo de\b/gi, 'cobra fijo')
    .replace(/\by una renta de\b/gi, 'más')
    .replace(
      /\b(Determina|Calcula)\s+el\s+([^.]{3,35})\s+que\s+(?:tu equipo|el grupo|la comunidad|el comit[eé])[^.]{0,30}?(?:deber[aá]|tendr[aá] que|puede)\s+([a-záéíóúñ]+r)\b/gi,
      '$1 el $2 a $3'
    )
    .replace(/(\$[\d.,]+)\s+pesos\b/gi, '$1')
    .replace(/\s*\([^)\d=]{14,90}\)/g, '')
    .replace(/\bElabora un guion de exposici[oó]n que incluya\b/gi, 'Elabora un guion con')
    .replace(/\bExplica ante el grupo por qu[eé]\b/gi, 'Explica por qué')
    .replace(/\bpara su centro comunitario\b/gi, '')
    .replace(/\bpara cubrir ambos conceptos\b/gi, '')
    .replace(/\butilizando el principio de la balanza algebraica\b/gi, 'con la balanza algebraica')
    .replace(/\bSi las proyecciones socioecon[oó]micas indican que la poblaci[oó]n crecer[aá] a una tasa anual constante del\b/gi, 'Con crecimiento anual del')
    .replace(/\bdebido a la llegada de nuevas familias,?\s*/gi, '')
    .replace(/\butilizando el modelo exponencial\b/gi, 'con')
    .replace(/\be interpreta(?: el)? impacto en los servicios p[uú]blicos\b/gi, 'e interpreta el impacto')
    .replace(/\bSi se implementa un programa comunitario de retenci[oó]n escolar y bienestar,\s*se espera que la tasa de crecimiento poblacional moderado se mantenga en\b/gi, 'Con tasa moderada del')
    .replace(/\bdurante los pr[oó]ximos\b/gi, 'en')
    .replace(/\bal t[eé]rmino de este periodo\b/gi, 'al cierre')
    .replace(/,\s*construye una tabla de valores(?:\s+rigurosa)?(?:\s+asignando\s+a|\s+para)\s+/gi, ', tabula para ')
    .replace(/\btomando los valores\b/gi, 'con')
    .replace(/\bdetermina los cinco pares ordenados resultantes y redacta una conclusi[oó]n sobre el comportamiento financiero\b/gi, 'determina los cinco pares y concluye')
    .replace(/\bque se pueden realizar con un fondo fijo cumplen la ecuaci[oó]n lineal\b/gi, 'cumplen')
    .replace(/\bmodela el costo de mantenimiento de un espacio deportivo recreativo mediante la ecuaci[oó]n lineal con dos inc[oó]gnitas\b/gi, 'modela el mantenimiento con')
    .replace(/\bestablece que el costo semanal de operaci[oó]n \(([^)]+)\) de un taller de artes pl[aá]sticas depende de una tarifa fija de servicios de\b/gi, 'modela el costo semanal ($1) con tarifa fija de')
    .replace(/\bSi las pol[ií]ticas de desarrollo comunitario y la implementaci[oó]n de programas de bienestar generan una tasa de crecimiento anual estimada de\b/gi, 'Con tasa de crecimiento anual')
    .replace(/\bUna localidad rural del estado de Puebla registra actualmente una poblaci[oó]n juvenil base de\b/gi, 'Una localidad registra población base')
    .replace(/\bSe aplica un modelo de crecimiento demogr[aá]fico discreto\b/gi, 'Con el modelo')
    .replace(/\bcon una tasa de crecimiento anual\b/gi, 'y tasa anual')
    .replace(/\by elabora la gr[aá]fica en papel milim[eé]trico\b/gi, 'y grafícalo')
    .replace(/\bConstruye la tabla de valores a[ñn]o por a[ñn]o desde\b/gi, 'Tabula de')
    .replace(/\bUn centro comunitario juvenil en Puebla\b/gi, 'Un centro comunitario')
    .replace(/\bUn comit[eé] vecinal en Puebla\b/gi, 'Un comité vecinal')
    .replace(/\bUn comit[eé] pro-construcci[oó]n de un parque recreativo en Puebla solicita\b/gi, 'Un comité solicita')
    .replace(/\ba una instituci[oó]n de desarrollo social con una tasa de inter[eé]s simple del\b/gi, 'a interés simple del')
    .replace(/\bSi el pr[eé]stamo se liquidar[aá] en un plazo de\b/gi, 'A un plazo de')
    .replace(/\bcalcula el inter[eé]s total generado y el monto acumulado\b/gi, 'calcula el interés y monto acumulado')
    .replace(/\by plasma el procedimiento algebraico completo en tu dossier\b/gi, 'y registra el procedimiento')
    .replace(/\by valida los datos para incorporarlos en la secci[oó]n anal[ií]tica de tu portafolio\b/gi, 'y valida los datos')
    .replace(/\bubicados en uno de los v[eé]rtices principales de la techumbre est[aá]n representados algebraicamente por las expresiones\b/gi, 'se expresan como')
    .replace(/\bsabiendo por definici[oó]n geom[eé]trica que los [aá]ngulos colaterales internos entre paralelas son suplementarios \(su suma = 180°\)/gi, '(colaterales internos: suman 180°)')
    .replace(/\bTeniendo en cuenta que por definici[oó]n dos [aá]ngulos complementarios suman\b/gi, 'Como los complementarios suman')
    .replace(/\bcalcula el valor num[eé]rico de la inc[oó]gnita ([a-z]), determina la medida (?:exacta|angular exacta) de cada (?:[aá]ngulo|componente)\b/gi, 'calcula $1 y cada ángulo')
    .replace(/\bcalcula el valor de ([a-z]), determina la medida angular exacta de cada componente\b/gi, 'calcula $1 y cada ángulo')
    .replace(/\bpara organizar un torneo rel[aá]mpago seg[uú]n la expresi[oó]n\b/gi, 'de un torneo con')
    .replace(/\ben funci[oó]n de las horas de asesor[ií]a 'x' impartidas est[aá] modelado por la ecuaci[oó]n\b/gi, "según horas de asesoría 'x' sigue")
    .replace(/,\s*donde\s+'x'\s+representa\s+el\s+n[uú]mero\s+de\s+equipos\s+inscritos/gi, ' (x = equipos)')
    .replace(/\bSe calcula que el costo total \(y\) de premiaci[oó]n y arbitraje est[aá] dado por\b/gi, 'El costo (y) de premiación y arbitraje es')
    .replace(/\by elabora la tabulaci[oó]n para\b/gi, 'y tabula para')
    .replace(/\bdonde el n[uú]mero de j[oó]venes asistentes \(y\) a un taller de arte depende de la inversi[oó]n en publicidad \(x\) en cientos de pesos,\s*dado por\b/gi, 'de asistentes (y) según inversión en publicidad (x, en cientos de pesos):')
    .replace(/\ben una escala del 1 al 100,\s*definido por\b/gi, '(escala 1 a 100):')
    .replace(/\bsu representaci[oó]n gr[aá]fica y una breve conclusi[oó]n metacognitiva\b/gi, 'su gráfica y conclusión')
    .replace(/\ben el contexto del espacio recreativo\b/gi, 'en contexto')
    .replace(/\ben el contexto de la asistencia inicial\b/gi, 'en contexto')
    .replace(/\ben el contexto de la jornada\b/gi, 'en contexto')
    .replace(/\bpara determinar el costo unitario de cada tipo de bal[oó]n,\s*y elabora la matriz de comprobaci[oó]n num[eé]rica que valide tus resultados algebraicos\b/gi, 'para hallar el costo de cada balón y comprobarlo')
    .replace(/\bde dichos\b/gi, 'de esos')
    .replace(/\b(?:paso a paso|exactamente|posteriormente|correspondiente|rigurosamente)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;])/g, '$1')
    .trim();
  const normalizedStart =
    /^[a-záéíóúñ]/.test(compacted) && /^[A-ZÁÉÍÓÚÑ]/.test(original)
      ? compacted.charAt(0).toUpperCase() + compacted.slice(1)
      : compacted;
  const digits = (text: string) => text.match(/\d+(?:[.,]\d+)?/g) ?? [];
  const originalDigits = digits(original).sort().join('|');
  const compactedDigits = digits(normalizedStart).sort().join('|');
  if (!normalizedStart || originalDigits !== compactedDigits) return original;
  return normalizedStart;
}

const ACTIVITY_TASK_RE =
  /\?|\b(?:calcula|determina|encuentra|halla|resuelve|plantea|formula|escribe|redacta|prepara|elabora|integra|organiza|audita|revisa|verifica|comprueba|justifica|identifica|estima|proyecta|dise[ñn]a|aplica|eval[uú]a|compara|analiza|explica|construye|crea|consolida|completa|obt[eé]n|usa|utiliza|aseg[uú]rate|tabula|grafica|clasifica|ordena|registra|sustituye|despeja|simplifica|factoriza|demuestra|argumenta|describe|selecciona|prop[oó]n|corrige|presenta|defiende|exp[oó]n|convierte|contrasta|relaciona|traza|responde|dibuja|marca|se[ñn]ala)\b/i;

const IMPERATIVE_MODELA_RE = /(?:^|[.?!;:]\s+|\by\s+)(?:modela|muestra)\b/i;

function hasActivityTask(value: string): boolean {
  if (ACTIVITY_TASK_RE.test(value)) return true;
  const withoutDescriptiveModela = value
    .replace(/\b(?:se|que|donde|cuyo|cuya)\s+modela\b/gi, '')
    .replace(
      /\b(?:ecuaci[oó]n|expresi[oó]n|funci[oó]n|f[oó]rmula|gr[aá]fica|club|comit[eé]|centro|programa|tabla)\b[^.?!]{0,45}\bmodela\b/gi,
      ''
    )
    .replace(/\b(?:de|la|una|esta|esa|tu|su|dicha)\s+muestra\b/gi, '');
  return IMPERATIVE_MODELA_RE.test(withoutDescriptiveModela);
}

function capitalizeProseStart(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  if (/^[a-z](?:[0-9₀-₉²³]|\([^)]+\))?\s*(?:[=<>≤≥≠≈+\-*/·×^]|²|³)/.test(trimmed)) return trimmed;
  return /^[a-záéíóúñ]/.test(trimmed) ? trimmed.charAt(0).toUpperCase() + trimmed.slice(1) : trimmed;
}

function hasIncompleteConditionalEnding(value: string): boolean {
  const sentences = value
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (sentences.length === 0) return false;
  const last = sentences[sentences.length - 1]!;
  if (!/^Si\s+/i.test(last)) return false;
  const outsideParens = last.replace(/\([^)]*\)/g, '');
  if (!/[,?]/.test(outsideParens)) return true;
  return !hasActivityTask(last);
}

function ensureActivityClosure(statement: string): string {
  const cleaned = capitalizeProseStart(
    String(statement || '')
      .replace(/\.,/g, ',')
      .replace(/,\./g, '.')
      .replace(/,\s*([xy])\s*\.(?=\s|$)/gi, ' ($1).')
      .replace(/(?<=[.?!]\s+)([a-záéíóúñ])/g, (_, ch: string) => ch.toUpperCase())
      .trim()
  );
  if (!cleaned) return cleaned;
  const value = /[.?!]$/.test(cleaned) ? cleaned : `${cleaned}.`;
  const incompleteCond = hasIncompleteConditionalEnding(value);
  if (!incompleteCond && hasActivityTask(value) && value.length >= 55) return value;
  const base = value.replace(/[.!?]+$/, '').trim();
  if (incompleteCond) {
    return `${base}, calcula y determina los valores requeridos.`;
  }
  if (!hasActivityTask(value)) {
    const withTask = `${base}. Calcula y determina los valores requeridos.`;
    return withTask.length >= 55
      ? withTask
      : `${base}. Calcula, registra el procedimiento y determina los valores requeridos.`;
  }
  return `${base}. Registra tu procedimiento y comprueba la respuesta.`;
}

const HEADLESS_ANAPHORIC_START_RE =
  /^(?:Para\s+[a-záéíóúñ]+(?:lo|la|los|las)\b|Esto\b|Esta\b|Este\b|Estos\b|Estas\b|Ello\b|Por\s+ello\b|Por\s+lo\s+tanto\b|En\s+consecuencia\b|Sin\s+embargo\b|Adem[aá]s\b|Asimismo\b|De\s+este\s+modo\b|De\s+esta\s+manera\b)/i;

function isHeadlessAnaphoricStart(value: string | undefined): boolean {
  return Boolean(value && HEADLESS_ANAPHORIC_START_RE.test(value.trim()));
}

function requiresStrictNumericPreservation(reference: string): boolean {
  return (
    /=/.test(reference) ||
    /\b(?:opci[oó]n\s*[ab]|proveedor|tarifa|compara|cu[aá]l\s+(?:opci[oó]n\s+)?conviene|frente\s+a|audita|revisa|compa[ñn]er[oa]|procedimiento|reporte|obtuvo|afirma)\b/i.test(
      reference
    )
  );
}

function compactActivityPreservingTaskAndData(
  rawStatement: string,
  maxChars: number,
  maxWords: number,
  allowPartialNumbers = false
): string {
  const base = ensureActivityClosure(compactActivityStatement(rawStatement));
  if (!base) return base;
  const mathTokens = (text: string): string[] =>
    (text.match(/\d+(?:[.,]\d+)?|=/g) ?? []).map((t) => t.replace(/,/g, ''));
  const isValidActivity = (candidate: string, reference: string): boolean => {
    const c = candidate.trim();
    const minLen = Math.min(55, reference.trim().length);
    if (c.length < minLen) return false;
    if (/^[a-záéíóúñ]/.test(c)) return false;
    if (!hasActivityTask(c) || hasIncompleteConditionalEnding(c) || hasDanglingEnding(c)) return false;
    if (/\.,|,\.|;\.|\.\s*\./.test(c) || /,\s*[a-zA-ZÁÉÍÓÚáéíóúñÑ]\.$/.test(c)) return false;
    if (/=/.test(reference) && !/=/.test(c)) return false;
    const uniqueRef = new Set(mathTokens(reference));
    if (uniqueRef.size > 0) {
      const candSet = new Set(mathTokens(c));
      const strictNumbers = !allowPartialNumbers || requiresStrictNumericPreservation(reference) || uniqueRef.size <= 3;
      if (strictNumbers) {
        for (const tok of uniqueRef) {
          if (!candSet.has(tok)) return false;
        }
      } else if (candSet.size < Math.min(3, uniqueRef.size)) {
        return false;
      }
    }
    return true;
  };

  const wordCount = (text: string): number => text.trim().split(/\s+/).filter(Boolean).length;
  if (base.length <= maxChars && wordCount(base) <= maxWords && isValidActivity(base, base)) {
    return base;
  }

  const directFit = fitPedagogicalText(base, { maxChars, maxWords, role: 'activity' });
  if (directFit && isValidActivity(directFit, base)) {
    return directFit;
  }

  const sentences = base
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (sentences.length > 1) {
    let taskIdx = -1;
    for (let i = sentences.length - 1; i >= 0; i--) {
      if (hasActivityTask(sentences[i]!)) {
        taskIdx = i;
        break;
      }
    }
    if (taskIdx === -1) taskIdx = sentences.length - 1;

    const essential = sentences.filter((s, idx) => mathTokens(s).length > 0 || idx === taskIdx);
    const essentialJoined = essential.join(' ').trim();
    if (essentialJoined && isValidActivity(essentialJoined, base)) {
      if (essentialJoined.length <= maxChars && wordCount(essentialJoined) <= maxWords) {
        return essentialJoined;
      }
      const fittedEssential = fitPedagogicalText(essentialJoined, {
        maxChars,
        maxWords,
        role: 'activity',
      });
      if (fittedEssential && isValidActivity(fittedEssential, base)) {
        return fittedEssential;
      }
    }

    const taskSentence = sentences[taskIdx]!;
    const taskNormPrefix = taskSentence.toLowerCase().slice(0, 32);
    const dataSentences = sentences.filter(
      (s, idx) =>
        idx !== taskIdx &&
        mathTokens(s).length > 0 &&
        !taskSentence.toLowerCase().includes(s.toLowerCase().slice(0, Math.min(32, s.length))) &&
        !s.toLowerCase().startsWith(taskNormPrefix)
    );
    if (dataSentences.length > 0) {
      const dataPart = dataSentences
        .map((s) =>
          capitalizeProseStart(
            s
              .replace(/^(?:En|Para|Durante|Tras|Al|Con|Seg[uú]n)\b[^,:\d=()]{8,80},\s+(?=[A-ZÁÉÍÓÚÑa-záéíóúñ\d])/u, '')
              .trim()
          )
        )
        .join(' ')
        .replace(/[.!?]+$/, '')
        .trim();
      const rawShortTask =
        fitPedagogicalText(taskSentence, {
          maxChars: Math.max(48, maxChars - dataPart.length - 2),
          maxWords: Math.max(8, maxWords - wordCount(dataPart)),
          role: 'activity',
        }) || taskSentence;
      const shortTask =
        hasIncompleteConditionalEnding(rawShortTask) || !hasActivityTask(rawShortTask)
          ? compactActivityStatement(taskSentence)
          : rawShortTask;
      const combined = ensureActivityClosure(`${dataPart}. ${shortTask}`.replace(/\s{2,}/g, ' ').trim());
      if (isValidActivity(combined, base)) {
        if (combined.length <= maxChars && wordCount(combined) <= maxWords) {
          return combined;
        }
        const shortData =
          fitPedagogicalText(dataPart, {
            maxChars: Math.max(65, maxChars - shortTask.length - 2),
            maxWords: Math.max(11, maxWords - wordCount(shortTask)),
            role: 'problem',
          }) || dataPart;
        const tighterCombined = ensureActivityClosure(
          `${capitalizeProseStart(shortData).replace(/[.!?]+$/, '')}. ${shortTask}`
            .replace(/\s{2,}/g, ' ')
            .trim()
        );
        if (isValidActivity(tighterCombined, base)) {
          return tighterCombined;
        }
        return combined;
      }
    }
  }

  return base;
}

function isValidEvaluationCriterionItem(value: string | undefined): value is string {
  if (!value) return false;
  const clean = value.trim();
  if (clean.length < 22) return false;
  if (clean.split(/\s+/).filter(Boolean).length < 3) return false;
  if (hasDanglingEnding(clean)) return false;
  return true;
}

function enforceLessonGuideSlideBudget(slide: SacrintSlide): SacrintSlide {
  const fitShort = (
    value: string | undefined,
    maxChars: number,
    maxWords: number,
    role: 'concept' | 'problem' | 'step' | 'conclusion' | 'activity' | 'application' | 'hint' | 'general',
    minChars = 18
  ): string | undefined => {
    if (!value) return value;
    const fitted = fitPedagogicalText(value, { maxChars, maxWords, role });
    if (!fitted || fitted.trim().length < Math.min(minChars, value.trim().length) || hasDanglingEnding(fitted)) {
      return value;
    }
    return fitted;
  };
  const compactMathStep = (step: string, maxChars: number, maxWords: number): string =>
    /[=+\-*/^]|\d/.test(step) ? step : distillStepPreservingMath(step, maxChars, maxWords);

  if (slide.kind === 'concept') {
    const cs = slide as SacrintConceptSlide;
    const problemCapChars = cs.diagram?.available ? 215 : 250;
    const problemCapWords = cs.diagram?.available ? 34 : 40;
    const rawProblem = cs.workedExample?.problemStatement || '';
    const fitProblemForBox = (raw: string): string => {
      if (!raw || raw.length <= problemCapChars) return raw;
      // Eliminar oraciones puramente narrativas sin datos numéricos ni ecuación cuando el planteamiento rebasa la caja
      const rawSentences = raw
        .split(/(?<=[.?!])\s+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const dataOrTaskSentences =
        rawSentences.length > 1
          ? rawSentences.filter((s) => /\d|=|\$|%|\?|\b(?:calcula|determina|encuentra|resuelve|construye|tabula|plantea|utiliza|compara)\b/i.test(s))
          : rawSentences;
      const cleanedBase = (dataOrTaskSentences.length > 0 ? dataOrTaskSentences.join(' ') : raw)
        .replace(/,\s*donde\s+['"]?[a-z]['"]?\s+(?:es|representa)\s+[^.;]+?(?=[.;]|$)/gi, '')
        .replace(/\butilizando tu regla graduada y un sistema de coordenadas\b/gi, '')
        .replace(/\by presentar el argumento cuantitativo correspondiente\b/gi, '')
        .replace(/\by construir una matriz de comprobaci[oó]n para verificar el resultado(?:\s+en un rango de [^.]+)?\b/gi, '')
        .replace(/\bPreparas la defensa de tu proyecto ante el comit[eé] evaluador y necesitas argumentar\b/gi, 'Se estima')
        .replace(/\bTras analizar las tendencias demogr[aá]ficas locales,\s*se estima una tasa de crecimiento anual constante del\b/gi, 'Con tasa anual constante')
        .replace(/\bEl presupuesto operativo establece que el costo total en miles de pesos se modela exactamente mediante la ecuaci[oó]n lineal con dos inc[oó]gnitas:\s*/gi, 'Costo operativo (miles de pesos): ')
        .replace(/\bEl costo total 'y' \(en pesos\) para adecuar un espacio recreativo juvenil y comprar 'x' paquetes de material deportivo est[aá] modelado por la ecuaci[oó]n lineal\b/gi, 'El costo total y de x paquetes sigue')
        .replace(/\s{2,}/g, ' ')
        .replace(/\s+([,.;])/g, '$1')
        .trim();
      const pre = compactProblemPreamble(cleanedBase);
      if (pre.length <= problemCapChars && !hasDanglingEnding(pre)) return pre;
      const fitted = fitPedagogicalText(pre, {
        maxChars: problemCapChars,
        maxWords: problemCapWords,
        role: 'problem',
      });
      const eqPreserved = !/=/.test(pre) || /=/.test(fitted);
      if (fitted && fitted.length >= 42 && !hasDanglingEnding(fitted) && eqPreserved) {
        return fitted;
      }
      return pre;
    };
    return {
      ...cs,
      explanation: fitShort(cs.explanation, 235, 38, 'concept', 55) || cs.explanation,
      analogy: fitShort(cs.analogy, 70, 11, 'hint', 18),
      misconception: cs.misconception,
      keyTakeaways: (cs.keyTakeaways ?? [])
        .slice(0, 1)
        .map((item) => fitShort(item, 60, 10, 'concept', 18))
        .filter((item): item is string => Boolean(item)),
      workedExample: cs.workedExample
        ? {
            problemStatement: fitProblemForBox(rawProblem),
            steps: cs.workedExample.steps
              .slice(0, 3)
              .map((step) => compactMathStep(step, 60, 9))
              .filter(Boolean),
            interpretation:
              fitShort(cs.workedExample.interpretation, 116, 18, 'conclusion', 18) ||
              cs.workedExample.interpretation,
          }
        : cs.workedExample,
      variables: (cs.variables ?? []).slice(0, 3).map((variable) => ({
        ...variable,
        meaning: fitShort(variable.meaning, 32, 5, 'concept', 8) || variable.meaning,
      })),
      facts: (cs.facts ?? []).slice(0, 1),
    } as unknown as SacrintConceptSlide;
  }
  if (slide.kind === 'practice') {
    const ps = slide as SacrintPracticeSlide;
    const validCriteria = (ps.evaluationCriteria ?? [])
      .slice(0, 2)
      .map((item) => fitShort(compactEvaluationCriterion(item), 84, 13, 'general', 22))
      .filter(isValidEvaluationCriterionItem);
    return {
      ...ps,
      activities: (ps.activities ?? []).slice(0, 2).map((activity) => ({
        ...activity,
        statement: compactActivityPreservingTaskAndData(activity.statement, 220, 36),
        hint: fitShort(compactHintText(activity.hint), 100, 16, 'hint', 22),
      })),
      applicationText: fitShort(ps.applicationText, 116, 18, 'application', 44),
      practiceText: fitShort(ps.practiceText, 116, 18, 'application', 44),
      objectiveBullets: (ps.objectiveBullets ?? [])
        .slice(0, 1)
        .map((item) => fitShort(item, 64, 10, 'concept', 20))
        .filter((item): item is string => Boolean(item)),
      evaluationCriteria:
        validCriteria.length > 0
          ? validCriteria
          : ['Procedimiento ordenado y conclusión coherente con el planteamiento.'],
      exitChecks: (ps.exitChecks ?? [])
        .slice(0, 2)
        .map((item) => fitShort(compactEvaluationCriterion(item), 56, 9, 'general', 22))
        .filter(isValidEvaluationCriterionItem),
      artifactName: fitShort(ps.artifactName, 40, 6, 'concept', 10),
      artifactStep: fitShort(ps.artifactStep, 106, 16, 'application', 34),
      facts: (ps.facts ?? []).slice(0, 1),
    } as unknown as SacrintPracticeSlide;
  }
  return slide;
}

function finalCompact(slide: SacrintSlide, maxWords = 180): SacrintSlide {
  if (countSlideWords(slide) <= maxWords) return slide;

  const fitPreserving = (
    value: string | undefined,
    maxChars: number,
    maxWordsValue: number,
    role: 'concept' | 'problem' | 'step' | 'conclusion' | 'activity' | 'application' | 'hint' | 'general',
    minChars = 24
  ): string | undefined => {
    if (!value) return value;
    const original = value.trim();
    if (!original) return value;
    const fitted = fitPedagogicalText(value, { maxChars, maxWords: maxWordsValue, role });
    if (!fitted) return value;
    const safeMin = Math.min(minChars, original.length);
    if (fitted.trim().length < safeMin || hasDanglingEnding(fitted)) return value;
    if (role === 'concept') {
      if (isHeadlessAnaphoricStart(fitted) && !isHeadlessAnaphoricStart(original)) return value;
      if (/=/.test(original) && !/=/.test(fitted)) return value;
    }
    const mathTokens = (text: string): string[] =>
      (text.match(/\$?\d[\d.,]*|=/g) ?? []).map((t) => t.replace(/[$,]/g, ''));
    if (role === 'step') {
      const fittedTokens = new Set(mathTokens(fitted));
      if (mathTokens(original).some((token) => !fittedTokens.has(token))) return value;
      if (/=[^.;]*\/\s*[\d(a-zA-Z]/.test(original) && !/=[^.;]*\/\s*[\d(a-zA-Z]/.test(fitted)) return value;
    } else if (role === 'hint' || role === 'conclusion') {
      if (/=/.test(original) && !/=/.test(fitted)) return value;
      if (/=[^.;]*\/\s*[\d(a-zA-Z]/.test(original) && !/=[^.;]*\/\s*[\d(a-zA-Z]/.test(fitted)) return value;
      if ((original.match(/=/g)?.length ?? 0) >= 2 && (fitted.match(/=/g)?.length ?? 0) < 2) return value;
      if (role === 'hint' && /\d+\s*,\s*\d+/.test(original)) {
        const fittedTokens = new Set(mathTokens(fitted));
        if (mathTokens(original).some((token) => !fittedTokens.has(token))) return value;
      }
    } else if (role === 'problem' || role === 'activity') {
      if (hasIncompleteConditionalEnding(fitted)) return value;
      if (/=/.test(original) && !/=/.test(fitted)) return value;
      const origTokens = [...new Set(mathTokens(original))];
      if (origTokens.length > 0) {
        const fittedTokens = new Set(mathTokens(fitted));
        if (origTokens.some((token) => !fittedTokens.has(token))) return value;
      }
    } else if (role === 'application') {
      if (hasIncompleteConditionalEnding(fitted)) return value;
      if (original.length >= 48 && fitted.trim().length < 44) return value;
      const origTokens = [...new Set(mathTokens(original))];
      if (origTokens.length > 0) {
        const fittedTokens = new Set(mathTokens(fitted));
        const requiredCount = origTokens.length <= 2 ? origTokens.length : 2;
        if (fittedTokens.size < Math.min(requiredCount, origTokens.length)) return value;
      }
    }
    return fitted;
  };
  const isSolutionStep = (step: string): boolean =>
    /=/.test(step) ||
    /^(?:respuesta|resultado|conclusi[oó]n|por tanto|as[ií]|en consecuencia|comprobaci[oó]n)/i.test(step.trim());
  const stepTokens = (value: string): Set<string> =>
    new Set(
      value
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .split(/\s+/)
        .filter((token) => token.length > 1)
    );
  const nearDuplicateSteps = (a: string, b: string): boolean => {
    const left = stepTokens(a);
    const right = stepTokens(b);
    if (left.size < 8 || right.size < 8) return false;
    let shared = 0;
    for (const token of left) if (right.has(token)) shared += 1;
    const union = left.size + right.size - shared;
    return union > 0 && shared / union >= 0.8;
  };
  const fitOrDistillStep = (source: string, maxChars: number, maxWordsValue: number): string => {
    const fitted = fitPreserving(source, maxChars, maxWordsValue, 'step', 16);
    if (fitted && fitted !== source) return fitted;
    if (source.length > maxChars) {
      const distilled = distillStepPreservingMath(source, maxChars, maxWordsValue);
      if (distilled && distilled.trim().length >= 14 && !hasDanglingEnding(distilled)) {
        return distilled;
      }
    }
    return fitted || source;
  };
  const compactSteps = (steps: string[], maxChars: number, maxWordsValue: number, maxSteps: number): string[] => {
    if (steps.length === 0) return [];
    const dedupedSteps = steps.filter(
      (step, index) => !steps.slice(0, index).some((previous) => nearDuplicateSteps(previous, step))
    );
    const rawSolution = [...dedupedSteps].reverse().find(isSolutionStep) ?? [...steps].reverse().find(isSolutionStep);
    const solutionSource = rawSolution ? compactConceptNarrative(rawSolution) : undefined;
    const solution = solutionSource
      ? fitOrDistillStep(solutionSource, maxChars, maxWordsValue)
      : undefined;
    const kept: string[] = [];
    for (const step of dedupedSteps.slice(0, maxSteps)) {
      const source = compactConceptNarrative(step);
      const fitted = fitOrDistillStep(source, maxChars, maxWordsValue);
      if (!kept.includes(fitted)) kept.push(fitted);
    }
    if (solution && !kept.some((step) => step.includes(solution) || solution.includes(step))) {
      if (kept.length >= maxSteps && maxSteps > 0) kept[maxSteps - 1] = solution;
      else kept.push(solution);
    }
    return kept;
  };
  const dedupe = (values: string[] | undefined): string[] =>
    [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];

  if (slide.kind === 'concept') {
    const conceptSlide = slide as SacrintConceptSlide;
    const first = {
      ...conceptSlide,
      explanation: compactConceptNarrative(conceptSlide.explanation),
      activationNote: conceptSlide.activationNote
        ? fitPreserving(
            compactConceptNarrative(conceptSlide.activationNote),
            78,
            11,
            'concept',
            18
          ) || conceptSlide.activationNote
        : conceptSlide.activationNote,
      workedExample: conceptSlide.workedExample
        ? {
            ...conceptSlide.workedExample,
            problemStatement: compactProblemPreamble(conceptSlide.workedExample.problemStatement),
            steps: conceptSlide.workedExample.steps.map((step) => compactConceptNarrative(step)),
            interpretation: compactConceptNarrative(conceptSlide.workedExample.interpretation),
          }
        : conceptSlide.workedExample,
      analogy: undefined,
      keyTakeaways: [],
      facts: [],
      variables: [],
    } as unknown as SacrintConceptSlide;
    if (countSlideWords(first) <= maxWords) return first;

    const second = {
      ...first,
      activationNote:
        fitPreserving(first.activationNote, 110, 17, 'hint', 20) || first.activationNote,
      explanation:
        fitPreserving(compactConceptNarrative(first.explanation), 165, 25, 'concept', 55) ||
        first.explanation,
      misconception:
        first.misconception && first.misconception.length > 104
          ? fitPreserving(first.misconception, 104, 16, 'concept', 38) || first.misconception
          : first.misconception,
      workedExample: first.workedExample
        ? {
            problemStatement:
              fitPreserving(
                compactProblemPreamble(first.workedExample.problemStatement),
                185,
                28,
                'problem',
                45
              ) || first.workedExample.problemStatement,
            steps: compactSteps(first.workedExample.steps, 78, 12, 3),
            interpretation:
              fitPreserving(first.workedExample.interpretation, 112, 17, 'conclusion', 20) ||
              first.workedExample.interpretation,
          }
        : first.workedExample,
    } as SacrintConceptSlide;
    if (countSlideWords(second) <= maxWords) return second;

    const third = {
      ...second,
      activationNote:
        fitPreserving(second.activationNote, 86, 13, 'hint', 18) || second.activationNote,
      explanation:
        fitPreserving(compactConceptNarrative(second.explanation), 140, 21, 'concept', 55) ||
        second.explanation,
      misconception: second.misconception,
      workedExample: second.workedExample
        ? {
            ...second.workedExample,
            problemStatement:
              fitPreserving(second.workedExample.problemStatement, 155, 23, 'problem', 38) ||
              second.workedExample.problemStatement,
            steps: compactSteps(second.workedExample.steps, 70, 11, 3),
            interpretation:
              fitPreserving(second.workedExample.interpretation, 96, 15, 'conclusion', 18) ||
              second.workedExample.interpretation,
          }
        : second.workedExample,
    } as SacrintConceptSlide;
    if (countSlideWords(third) <= maxWords) return third;

    const compactProblemFallback = (raw: string, maxChars: number, maxWordsValue: number): string => {
      const pre = compactProblemPreamble(raw);
      const fitted = fitPreserving(pre, maxChars, maxWordsValue, 'problem', 42);
      if (fitted && fitted !== pre && fitted.length <= maxChars + 18) return fitted;
      const viaActivity = compactActivityPreservingTaskAndData(pre, maxChars + 18, maxWordsValue + 4, false);
      if (viaActivity && !hasDanglingEnding(viaActivity) && viaActivity.length <= maxChars + 26) {
        return viaActivity;
      }
      return fitted || pre;
    };

    const fourth = {
      ...third,
      activationNote:
        fitPreserving(third.activationNote, 68, 10, 'hint', 18) || third.activationNote,
      explanation:
        fitPreserving(compactConceptNarrative(third.explanation), 125, 19, 'concept', 55) ||
        third.explanation,
      misconception: third.misconception,
      workedExample: third.workedExample
        ? {
            ...third.workedExample,
            problemStatement: compactProblemFallback(third.workedExample.problemStatement, 135, 20),
            steps: compactSteps(third.workedExample.steps, 64, 10, 3),
            interpretation:
              fitPreserving(third.workedExample.interpretation, 86, 13, 'conclusion', 22) ||
              third.workedExample.interpretation,
          }
        : third.workedExample,
    } as SacrintConceptSlide;
    if (countSlideWords(fourth) <= 185) return fourth;

    const fifth = {
      ...fourth,
      title:
        fitPreserving(fourth.title, 68, 10, 'concept', 20)?.replace(/\.$/, '') || fourth.title,
      explanation:
        fitPreserving(compactConceptNarrative(fourth.explanation), 115, 18, 'concept', 55) ||
        fourth.explanation,
      misconception:
        fourth.misconception && fourth.misconception.length > 92
          ? fitPreserving(fourth.misconception, 92, 14, 'concept', 38) || fourth.misconception
          : fourth.misconception,
      workedExample: fourth.workedExample
        ? {
            ...fourth.workedExample,
            interpretation:
              fitPreserving(fourth.workedExample.interpretation, 78, 12, 'conclusion', 20) ||
              fourth.workedExample.interpretation,
          }
        : fourth.workedExample,
    } as SacrintConceptSlide;
    if (countSlideWords(fifth) <= 188) return fifth;
    return {
      ...fifth,
      explanation:
        fitPreserving(compactConceptNarrative(fifth.explanation), 106, 16, 'concept', 55) ||
        fifth.explanation,
      workedExample: fifth.workedExample
        ? {
            ...fifth.workedExample,
            problemStatement:
              fitPreserving(fifth.workedExample.problemStatement, 145, 22, 'problem', 40) ||
              fifth.workedExample.problemStatement,
            steps: fifth.workedExample.steps.map((step) =>
              step.split(/\s+/).length > 11
                ? fitOrDistillStep(compactConceptNarrative(step), 72, 11) || step
                : step
            ),
            interpretation:
              fitPreserving(fifth.workedExample.interpretation, 72, 11, 'conclusion', 18) ||
              fifth.workedExample.interpretation,
          }
        : fifth.workedExample,
    } as SacrintConceptSlide;
  }

  if (slide.kind === 'practice') {
    const first = {
      ...(slide as SacrintPracticeSlide),
      objectiveBullets: (slide.objectiveBullets ?? []).slice(0, 1),
      exitChecks: [],
      facts: [],
      checkpoints: [],
    } as SacrintPracticeSlide;
    if (countSlideWords(first) <= maxWords) return first;

    const sanitizeCriteriaList = (items: string[] | undefined, maxChars: number, maxWordsValue: number, limit: number): string[] => {
      const candidates = dedupe(
        (items ?? [])
          .slice(0, limit)
          .map((item) => fitPreserving(compactEvaluationCriterion(item), maxChars, maxWordsValue, 'general', 24) || compactEvaluationCriterion(item))
          .filter(isValidEvaluationCriterionItem)
      );
      return candidates.length > 0
        ? candidates
        : ['Procedimiento ordenado y conclusión coherente con el planteamiento.'];
    };

    const second = {
      ...first,
      activities: (first.activities ?? []).slice(0, 2).map((activity) => ({
        ...activity,
        statement: compactActivityPreservingTaskAndData(activity.statement, 215, 35, false),
        hint: fitPreserving(activity.hint, 96, 16, 'hint', 22) || activity.hint,
      })),
      applicationText:
        fitPreserving(first.applicationText, 110, 18, 'application', 44) || first.applicationText,
      practiceText: '',
      objectiveBullets: (first.objectiveBullets ?? [])
        .slice(0, 1)
        .map((item) => fitPreserving(item, 72, 11, 'concept', 22) || item)
        .filter((item): item is string => Boolean(item)),
      evaluationCriteria: sanitizeCriteriaList(first.evaluationCriteria, 78, 12, 2),
      artifactStep:
        fitPreserving(first.artifactStep, 100, 16, 'application', 34) || first.artifactStep,
    } as SacrintPracticeSlide;
    if (countSlideWords(second) <= maxWords) return second;

    const third = {
      ...second,
      activities: (second.activities ?? []).slice(0, 2).map((activity) => ({
        ...activity,
        statement: compactActivityPreservingTaskAndData(activity.statement, 185, 30, false),
        hint: fitPreserving(activity.hint, 88, 14, 'hint', 22) || activity.hint,
      })),
      applicationText:
        fitPreserving(second.applicationText, 96, 15, 'application', 44) || second.applicationText,
      objectiveBullets: (second.objectiveBullets ?? [])
        .slice(0, 1)
        .map((item) => fitPreserving(item, 64, 10, 'concept', 22) || item)
        .filter((item): item is string => Boolean(item)),
      evaluationCriteria: sanitizeCriteriaList(second.evaluationCriteria, 56, 9, 1),
      artifactStep:
        fitPreserving(second.artifactStep, 90, 14, 'application', 34) || second.artifactStep,
    } as SacrintPracticeSlide;
    if (countSlideWords(third) <= maxWords) return third;

    const fourth = {
      ...third,
      activities: (third.activities ?? []).slice(0, 2).map((activity) => ({
        ...activity,
        statement: compactActivityPreservingTaskAndData(activity.statement, 165, 27, false),
        hint: fitPreserving(activity.hint, 78, 13, 'hint', 22) || activity.hint,
      })),
      applicationText:
        fitPreserving(third.applicationText, 84, 14, 'application', 44) || third.applicationText,
      objectiveBullets: (third.objectiveBullets ?? [])
        .slice(0, 1)
        .map((item) => fitPreserving(item, 54, 9, 'concept', 20) || item)
        .filter((item): item is string => Boolean(item)),
      evaluationCriteria: sanitizeCriteriaList(third.evaluationCriteria, 50, 8, 1),
      artifactStep:
        fitPreserving(third.artifactStep, 80, 12, 'application', 32) || third.artifactStep,
    } as SacrintPracticeSlide;
    if (countSlideWords(fourth) <= 188) return fourth;

    const fifth = {
      ...fourth,
      activities: (fourth.activities ?? []).slice(0, 2).map((activity) => ({
        ...activity,
        statement: compactActivityPreservingTaskAndData(activity.statement, 155, 26, false),
        hint: fitPreserving(activity.hint, 68, 11, 'hint', 20) || activity.hint,
      })),
      applicationText:
        fitPreserving(fourth.applicationText, 72, 12, 'application', 44) || fourth.applicationText,
      objectiveBullets: (fourth.objectiveBullets ?? [])
        .slice(0, 1)
        .map((item) => fitPreserving(item, 48, 7, 'concept', 20) || item)
        .filter((item): item is string => Boolean(item)),
      evaluationCriteria: sanitizeCriteriaList(fourth.evaluationCriteria, 44, 7, 1),
      artifactStep:
        fitPreserving(fourth.artifactStep, 70, 11, 'application', 30) || fourth.artifactStep,
    } as SacrintPracticeSlide;
    if (countSlideWords(fifth) <= 192) return fifth;
    return {
      ...fifth,
      activities: (fifth.activities ?? []).slice(0, 2).map((activity) => ({
        ...activity,
        statement: compactActivityPreservingTaskAndData(activity.statement, 145, 24, false),
      })),
      applicationText:
        fitPreserving(fifth.applicationText, 64, 10, 'application', 44) || fifth.applicationText,
      artifactStep:
        fitPreserving(fifth.artifactStep, 64, 10, 'application', 30) || fifth.artifactStep,
    } as SacrintPracticeSlide;
  }

  return slide;
}

function buildLessonGuideSlidesForSession(
  workbook: ActiveWorkTextbook,
  mission: MissionSection,
  pack: SacrintPack,
  meta: SacrintMissionMeta,
  session: SessionPlan,
  options: SacrintBuildOptions,
  workbookTheorySources: string[] = collectWorkbookTheorySources(workbook),
  sessionOrdinal = 0,
  misconceptionTracker: Map<string, number> = new Map<string, number>()
): SacrintSlide[] {
  const bundle = distillLessonBundle(mission, session, {
    allowMissionFallback: false,
    extraTheorySources: workbookTheorySources,
  });
  const isQuantitative =
    pack.id === 'matematicas' || pack.id === 'fisica' || pack.id === 'quimica';
  const sesLabel = String(bundle.sessionNumber ?? session.sessionNumber).padStart(2, '0');
  const diagram = buildSacrintDiagram(mission, pack, {
    ...options,
    session,
    allowMissionFallback: false,
  });
  const isQuantOrReactionDiagram =
    diagram.available &&
    (diagram.kind === 'linear' ||
      diagram.kind === 'quadratic' ||
      diagram.kind === 'system-2x2' ||
      diagram.kind === 'exponential' ||
      diagram.kind === 'reaction');
  const variables = isQuantOrReactionDiagram ? buildDiagramVariables(diagram) : [];
  const formula = diagramFormula(diagram);
  const facts = baseFacts(meta, mission, bundle.sessionNumber);
  const visualMap = session.sintesisVisual?.mapaConceptual;
  const visualError = sanitizePedagogicalMetaPhrases(cleanSacrintText(visualMap?.errorComun));
  const visualCorrection = sanitizePedagogicalMetaPhrases(cleanSacrintText(visualMap?.correccionBreve));
  const resolvedMisconceptionBase = visualError
    ? {
        error: visualError,
        correction:
          visualCorrection ||
          'Contrastar cada afirmación con evidencia y criterios explícitos de la sesión.',
      }
    : resolveMissionMisconceptionParts(mission, bundle, {
        session,
        allowMissionFallback: false,
      });
  const misconceptionTitle = stripLeadingSessionTag(
    sanitizePedagogicalMetaPhrases(bundle.topicTitle || mission.title || meta.missionTitle)
  );
  const misconceptionParts = alignMisconceptionWithTitle(
    misconceptionTitle,
    resolvedMisconceptionBase,
    isQuantitative
  );
  const normalizedMisconception = normalizeEditorialText(
    normalizeSessionDescriptorTense(misconceptionParts.error)
  );
  const rawMisconception = fitPedagogicalText(sanitizePedagogicalMetaPhrases(normalizedMisconception), {
    maxChars: visualError ? 136 : 96,
    maxWords: visualError ? 22 : 15,
    role: 'hint',
  });
  const misconception = visualError
    ? rawMisconception || normalizedMisconception
    : enforceSixGramOverlap(rawMisconception, workbookTheorySources, 0.12, 'concept') ||
      preventSixGramTheoryOverlap(rawMisconception, workbookTheorySources);
  const globalSessionSeed =
    (Math.max(1, Number(meta.blockNumber || 1)) - 1) * 24 +
    (Math.max(1, Number(meta.missionNumber || 1)) - 1) * 6 +
    (sessionOrdinal || Number(bundle.sessionNumber ?? session.sessionNumber) || 1);
  const alignedMisconception = alignMisconceptionWithTitle(
    misconceptionTitle,
    {
      error: misconception,
      correction: misconceptionParts.correction,
    },
    isQuantitative
  ).error;
  const finalMisconception = diversifyRepeatedMisconception(
    alignedMisconception,
    globalSessionSeed,
    misconceptionTracker,
    isQuantitative
  );

  const rawArtifactTitle = sanitizePedagogicalMetaPhrases(
    cleanSacrintText(workbook.projectSection?.artifactName) || `Producto de la sesión ${sesLabel}`
  );
  const deOverlappedArtifact = preventSixGramTheoryOverlap(rawArtifactTitle, workbookTheorySources);
  const fittedArtifactTitle =
    fitPedagogicalText(deOverlappedArtifact, {
      maxChars: 44,
      maxWords: 6,
      role: 'concept',
      ensurePeriod: false,
    }) || `Producto de la sesión ${sesLabel}`;
  let artifactName = fittedArtifactTitle;
  if (artifactName === bundle.artifactStep) {
    artifactName = `${artifactName} · Sesión ${sesLabel}`;
  }

  const fittedTopicTitle = normalizeSessionDescriptorTense(
    finalizeVisibleText(
      stripLeadingSessionTag(
        bundle.topicTitle.length > 120
          ? fitPedagogicalText(bundle.topicTitle, {
              maxChars: 118,
              maxWords: 15,
              role: 'concept',
              ensurePeriod: false,
            }) || stripLeadingSessionTag(meta.missionTitle)
          : bundle.topicTitle
      ),
      { fallback: stripLeadingSessionTag(meta.missionTitle), ensurePeriod: false }
    )
  );
  const cleanObjective = normalizeSessionDescriptorTense(stripLeadingSessionTag(bundle.objective));
  const completeDefinition = preventSixGramTheoryOverlap(
    bundle.concepts.definition || cleanObjective || fittedTopicTitle,
    workbookTheorySources
  );
  const rawExplanationBase =
    completeDefinition.length <= 240
      ? completeDefinition
      : fitPedagogicalText(completeDefinition, {
          maxChars: 240,
          maxWords: 40,
          role: 'concept',
        }) || cleanObjective;
  let cleanExplanation = rawExplanationBase;
  if (cleanExplanation.length < 64) {
    const remainingChars = Math.max(42, 124 - cleanExplanation.length - 1);
    const extraRule = bundle.concepts.keyRules.find(
      (r) =>
        Boolean(r) &&
        r.length >= 18 &&
        !cleanExplanation.toLowerCase().includes(r.toLowerCase().slice(0, 20))
    );
    const enrichmentCandidates = [
      extraRule,
      bundle.example?.problemStatement,
      bundle.activation,
      bundle.question,
      bundle.concepts.keyRules[0],
    ].filter((value): value is string => Boolean(value));
    const extraSource = enrichmentCandidates
      .map((value) =>
        preventSixGramTheoryOverlap(sanitizePedagogicalMetaPhrases(value), workbookTheorySources)
      )
      .find(
        (value) =>
          value.length >= 18 &&
          !cleanExplanation.toLowerCase().includes(value.toLowerCase().slice(0, 20))
      );
    const fittedExtra = extraSource
      ? fitPedagogicalText(extraSource, {
          maxChars: remainingChars,
          maxWords: Math.max(6, 19 - cleanExplanation.split(/\s+/).length),
          role: 'concept',
        })
      : '';
    if (fittedExtra && !cleanExplanation.toLowerCase().includes(fittedExtra.toLowerCase().slice(0, 20))) {
      const combined = `${cleanExplanation.replace(/[.!?]+$/, '')}. ${fittedExtra}`;
      if (combined.length <= 128) {
        cleanExplanation = combined;
      }
    }
    if (cleanExplanation.length < 64) {
      const neutralEnrichment = fitPedagogicalText(
        'Aplicar este concepto permite interpretar y resolver situaciones del entorno con datos reales.',
        { maxChars: Math.max(42, 124 - cleanExplanation.length - 1), role: 'concept' }
      );
      if (neutralEnrichment) {
        const combined = `${cleanExplanation.replace(/[.!?]+$/, '')}. ${neutralEnrichment}`;
        if (combined.length <= 128) {
          cleanExplanation = combined;
        }
      }
    }
  }
  const expPrefix = cleanExplanation.toLowerCase().replace(/[^a-záéíóúñ0-9]+/gi, ' ').trim().slice(0, 24);
  const conceptTakeaways = (
    bundle.concepts.keyRules.length > 0 ? bundle.concepts.keyRules : []
  )
    .map((rule) =>
      fitPedagogicalText(
        preventSixGramTheoryOverlap(sanitizePedagogicalMetaPhrases(rule), workbookTheorySources),
        { maxChars: 48, maxWords: 7, role: 'concept', ensurePeriod: false }
      )
    )
    .filter((item, idx, arr) => {
      if (!item || isRubricOrBoilerplateLeak(item) || item === cleanExplanation || hasDanglingEnding(item)) {
        return false;
      }
      const itemNorm = item.toLowerCase().replace(/[^a-záéíóúñ0-9]+/gi, ' ').trim();
      if (expPrefix && (itemNorm.startsWith(expPrefix) || cleanExplanation.toLowerCase().includes(item.toLowerCase().slice(0, 22)))) {
        return false;
      }
      return arr.indexOf(item) === idx;
    })
    .slice(0, 2);
  const validFormulas = bundle.concepts.formulas.filter((item) => isValidRenderableFormula(item));
  const effectiveFormulas = validFormulas.length > 0 ? validFormulas.slice(0, 2) : formula ? [formula] : [];
  const primaryFormula = effectiveFormulas[0] ?? formula;

  const softenField = (value: string | undefined, maxChars = 140): string | undefined => {
    if (!value) return value;
    const clean = sanitizePedagogicalMetaPhrases(cleanSacrintText(value));
    const rewritten = preventSixGramTheoryOverlap(clean, workbookTheorySources);
    if (sixGramOverlapRatio(rewritten, workbookTheorySources) <= 0.18) {
      return paraphraseSixGramOverlap(rewritten, workbookTheorySources);
    }
    const compacted = fitPedagogicalText(rewritten, {
      maxChars,
      maxWords: 22,
      role: 'concept',
    });
    if (compacted && sixGramOverlapRatio(compacted, workbookTheorySources) <= 0.18) {
      return paraphraseSixGramOverlap(compacted, workbookTheorySources);
    }
    return paraphraseSixGramOverlap(compacted || rewritten, workbookTheorySources);
  };

  const rawFirstContentSentence = session.contenido
    ? paraphraseSixGramOverlap(
        sanitizePedagogicalMetaPhrases(firstSentence(cleanSacrintText(session.contenido))),
        workbookTheorySources
      )
    : '';
  const softenedExplanation = softenField(cleanExplanation, 165) ?? cleanExplanation;
  const explanationCandidate = [
    softenedExplanation,
    rawFirstContentSentence,
    bundle.concepts.keyRules[0],
    bundle.activation,
    bundle.question,
  ].find(
    (value) =>
      Boolean(value) &&
      String(value).trim().length >= 55 &&
      !isHeadlessAnaphoricStart(String(value)) &&
      !hasDanglingEnding(String(value)) &&
      !isRubricOrBoilerplateLeak(String(value))
  );
  const guardedExplanationBase = explanationCandidate || softenedExplanation;
  const guardedExplanation =
    guardedExplanationBase.trim().length >= 55 &&
    !isHeadlessAnaphoricStart(guardedExplanationBase) &&
    !hasDanglingEnding(guardedExplanationBase)
      ? guardedExplanationBase
      : `${guardedExplanationBase.replace(/[.!?]+$/, '')}. Este concepto permite interpretar datos del entorno y justificar decisiones con evidencia.`;

  const guardedExplanationFinal = guardedExplanation.replace(/\bentre dos\.$/i, 'entre dos expresiones.');

  const conceptSlide: SacrintConceptSlide = {
    kind: 'concept',
    eyebrow: `SESIÓN ${sesLabel} · PIZARRÓN 1/2 · CONOCIMIENTO NUEVO`,
    title: fittedTopicTitle,
    subtitle: '',
    missionIndex: meta.missionNumber,
    sessionNumber: bundle.sessionNumber,
    isLessonGuide: true,
    activationNote: softenField(bundle.activation),
    analogy: bundle.question || bundle.activation,
    explanation: guardedExplanationFinal,
    formulas: effectiveFormulas,
    keyTakeaways: conceptTakeaways,
    workedExample: bundle.example,
    misconception: finalMisconception,
    formula: primaryFormula,
    variables,
    diagram,
    facts,
  };

  const normalizedCleanObjective = cleanObjective
    .replace(/\blos\s+habilidades\b/gi, 'las habilidades')
    .replace(/\by\s+([a-záéíóúñ]{2,}[aei])r[aá]s\b/gi, (_m, stem: string) => `y ${stem}r`);
  const primaryObjective = fitPedagogicalText(normalizedCleanObjective, {
    maxChars: 92,
    maxWords: 14,
    role: 'concept',
    ensurePeriod: false,
  });
  const objectiveBullets = primaryObjective
    ? [primaryObjective]
    : [
        fitPedagogicalText(
          bundle.concepts.keyRules[0] || `Aplicar ${fittedTopicTitle.toLowerCase()} en clase`,
          { maxChars: 76, maxWords: 11, role: 'concept', ensurePeriod: false }
        ) || `Comprender ${fittedTopicTitle.toLowerCase()}`,
      ];

  const isLabOrWorkshopSubject = /qu[ií]m|biolog|f[ií]sica|ecolog|salud|laborat|taller|mec[aá]n|electr[oó]n|industrial|agropec/i.test(
    `${pack.id} ${meta.subjectName}`
  );
  const rawAutoChecks = (session.autoevaluacion ?? [])
    .map((item) => sanitizePedagogicalMetaPhrases(cleanSacrintText(item)))
    .filter(
      (item) =>
        Boolean(item) &&
        !isRubricOrBoilerplateLeak(item) &&
        (isLabOrWorkshopSubject || !/normas\s+de\s+seguridad\s+e\s+higiene/i.test(item))
    );
  const rawEvalPool =
    rawAutoChecks.length > 0
      ? rawAutoChecks
      : bundle.exitChecks.filter((c) => isLabOrWorkshopSubject || !/normas\s+de\s+seguridad\s+e\s+higiene/i.test(c));
  const evaluationCriteriaRaw = rawEvalPool
    .map((item) =>
      fitPedagogicalText(
        compactEvaluationCriterion(
          preventSixGramTheoryOverlap(sanitizePedagogicalMetaPhrases(item), workbookTheorySources)
        ),
        { maxChars: 68, maxWords: 11, role: 'general', ensurePeriod: false }
      )
    )
    .filter((item, idx, arr): item is string => isValidEvaluationCriterionItem(item) && arr.indexOf(item) === idx)
    .slice(0, 2);
  const evaluationCriteria =
    evaluationCriteriaRaw.length > 0
      ? evaluationCriteriaRaw
      : ['Procedimiento ordenado y conclusión coherente con el planteamiento.'];

  const rawAppCandidate = (softenField(bundle.application, 120) ?? bundle.application ?? '').trim();
  const rawAppText =
    rawAppCandidate.length >= 36 && !hasDanglingEnding(rawAppCandidate)
      ? rawAppCandidate
      : (bundle.application ?? '').trim().length >= 36 && !hasDanglingEnding(bundle.application ?? '')
        ? fitPedagogicalText(paraphraseSixGramOverlap(bundle.application ?? '', workbookTheorySources), {
            maxChars: 130,
            maxWords: 20,
            role: 'application',
          }) || rawAppCandidate
        : rawAppCandidate;
  const guardedApplicationText =
    rawAppText.length >= 36 && !hasDanglingEnding(rawAppText)
      ? rawAppText
      : rawAppText.endsWith('?')
        ? `${rawAppText} Identifícalos y regístralos en estructuras reales de tu entorno.`
        : `Aplica ${fittedTopicTitle.toLowerCase()} en una situación real de tu comunidad y documenta tus resultados.`;

  const rawArtifactStepCandidate = (softenField(bundle.artifactStep, 105) ?? bundle.artifactStep ?? '').trim();
  const safeArtifactStep =
    rawArtifactStepCandidate.length >= 30 && !hasDanglingEnding(rawArtifactStepCandidate)
      ? rawArtifactStepCandidate
      : (bundle.artifactStep ?? '').trim().length >= 30 && !hasDanglingEnding(bundle.artifactStep ?? '')
        ? fitPedagogicalText(paraphraseSixGramOverlap(bundle.artifactStep ?? '', workbookTheorySources), {
            maxChars: 115,
            maxWords: 17,
            role: 'application',
          }) || rawArtifactStepCandidate
        : `Integra los resultados validados de esta sesión en ${artifactName}.`;

  const practiceSlide: SacrintPracticeSlide = {
    kind: 'practice',
    eyebrow: `SESIÓN ${sesLabel} · PIZARRÓN 2/2 · EJERCICIOS Y APLICACIÓN`,
    title: fittedTopicTitle,
    subtitle: '',
    missionIndex: meta.missionNumber,
    sessionNumber: bundle.sessionNumber,
    isLessonGuide: true,
    practiceText: guardedApplicationText,
    activities: bundle.activities.slice(0, 2),
    checkpoints: bundle.activities.slice(0, 2).map((item) => `${item.label}: ${softenField(item.statement, 120) ?? item.statement}`),
    objectiveBullets,
    evaluationCriteria,
    hint: softenField(bundle.activities[0]?.hint, 90),
    applicationText: guardedApplicationText,
    artifactName,
    artifactStep: safeArtifactStep,
    exitChecks: bundle.exitChecks.slice(0, 2).map((item) => softenField(item, 100) ?? item),
    facts,
  };

  const rawBudgetedConcept = finalCompact(enforceLessonGuideSlideBudget(conceptSlide), 146) as SacrintConceptSlide;
  const budgetedConcept: SacrintConceptSlide =
    rawBudgetedConcept.explanation &&
    rawBudgetedConcept.explanation.trim().length >= 55 &&
    !isHeadlessAnaphoricStart(rawBudgetedConcept.explanation)
      ? rawBudgetedConcept
      : { ...rawBudgetedConcept, explanation: conceptSlide.explanation };
  const budgetedPractice = finalCompact(enforceLessonGuideSlideBudget(practiceSlide), 168);
  return [budgetedConcept, budgetedPractice];
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
  const baseTheorySources =
    mode === 'lesson-guide' ? collectWorkbookTheorySources(workbook) : [];
  const extraTheorySources = (options.extraTheorySources ?? []).filter(
    (s): s is string => typeof s === 'string' && s.trim().length > 0
  );
  // Reutilizar la misma referencia permite que el caché de 6-gramas se comparta
  // entre las misiones del libro sin cambiar el contenido de las láminas.
  const workbookTheorySources: string[] =
    mode === 'lesson-guide'
      ? extraTheorySources.length > 0
        ? [...baseTheorySources, ...extraTheorySources]
        : baseTheorySources
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

  const coverSubtitleCleanRaw =
    mode === 'lesson-guide' ? stripLeadingSessionTag(coverSubtitleRaw) : coverSubtitleRaw;

  const rawCoverTitle =
    mode === 'lesson-guide'
      ? preventSixGramTheoryOverlap(
          meta.missionTitle.replace(/\s*[—–\-:]\s*Sesi[oó]n\s+\d+\s*$/i, '').trim() || meta.missionTitle,
          workbookTheorySources
        )
      : meta.missionTitle;
  const coverTitle =
    mode === 'lesson-guide' && rawCoverTitle.length > 120
      ? fitPedagogicalText(rawCoverTitle, {
          maxChars: 118,
          maxWords: 15,
          role: 'concept',
          ensurePeriod: false,
        }) || stripLeadingSessionTag(meta.missionTitle)
      : rawCoverTitle;

  const coverSubtitleFinal =
    mode === 'lesson-guide'
      ? preventSixGramTheoryOverlap(sanitizePedagogicalMetaPhrases(coverSubtitleCleanRaw), workbookTheorySources)
      : coverSubtitleCleanRaw;

  const cover: SacrintCoverSlide = {
    kind: 'cover',
    eyebrow: `MISIÓN ${String(meta.missionNumber).padStart(2, '0')} // ${pack.label.toLocaleUpperCase('es-MX')}`,
    title: coverTitle,
    subtitle: coverSubtitleFinal.toLowerCase() === coverTitle.toLowerCase() ? '' : coverSubtitleFinal,
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
    const misconceptionTracker = options.misconceptionTracker ?? new Map<string, number>();
    const targetSessions =
      typeof options.sessionIndex === 'number' && selectedSession ? [selectedSession] : sessionPlans;
    const sessionSlides = targetSessions.flatMap((session) =>
      buildLessonGuideSlidesForSession(
        workbook,
        mission,
        pack,
        meta,
        session,
        options,
        workbookTheorySources,
        Math.max(0, sessionPlans.indexOf(session)) + 1,
        misconceptionTracker
      )
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
    formula: sanitizePedagogicalMetaPhrases(cleanSacrintText(selectedSession?.sintesisVisual?.formulaOReglaClave)) || formula,
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
  const misconceptionTracker = options.misconceptionTracker ?? new Map<string, number>();
  const effectiveOptions: Omit<SacrintBuildOptions, 'missionIndex'> = {
    mode: 'lesson-guide',
    ...options,
    misconceptionTracker,
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
    const effectiveSolved = sessionExample.length > 0 ? sessionExample : solved;
    const demoSteps = extractBulletSentences(mission.iDoSection?.stepByStepDemo, 4, 175)
      .map((step) => distillStepPreservingMath(step, 225))
      .filter((step) => Boolean(step) && !isRubricOrBoilerplateLeak(step));
    const applicationStep = sanitizeField(
      selectedSession?.aplicacion || mission.youDoSection?.autonomousChallenge,
      '',
      220,
      34
    );

    // Un manual de conceptos no debe rellenar "pasos" con la definición o la
    // motivación: eso produce repetición visual. Solo usa procedimientos reales
    // y, si faltan pasos, cierra con la aplicación autónoma de la sesión.
    const source =
      effectiveSolved.length >= 3
        ? [...effectiveSolved, applicationStep, ...demoSteps]
        : [...effectiveSolved, ...demoSteps, applicationStep];
    const orderedSource = source
      .filter(
        (item, index, items) =>
          Boolean(item) &&
          !isRubricOrBoilerplateLeak(item) &&
          items.indexOf(item) === index
      )
      .slice(0, 4);

  const labels = stepLabelsForPack(
    pack,
    [
      mission.sessionTopic,
      mission.conceptZero?.coreExplanation,
      selectedSession?.objetivo,
      selectedSession?.contenido,
      ...effectiveSolved,
    ]
      .filter(Boolean)
      .join(' ')
  );
  return orderedSource.map((body, index) => ({
    number: index + 1,
    title: labels[index] ?? `PASO ${index + 1}`,
    body: distillStepPreservingMath(body, 225),
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

function isInfographicDiagramCoherent(
  diagram: SacrintDiagramSpec,
  contextText: string,
  validFormulas: string[],
  problemStatement: string,
  title: string
): boolean {
  if (!diagram.available) return false;
  const combined = `${contextText} ${problemStatement} ${validFormulas.join(' ')}`;
  const normalize = (value: string) =>
    value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9.,=+\-*/^()]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  const numbersIn = (value: string) =>
    new Set(
      (normalize(value).match(/-?\d+(?:[.,]\d+)?/g) || [])
        .map((n) => n.replace(',', '.'))
        .filter((n) => Number.isFinite(Number(n)))
    );

  const contextIsGeometry = /geometr|angul|triangulo|poligono|perimetro|area|cateto|hipotenusa|congruen|semejan/i.test(
    normalize(contextText)
  );
  const diagramText = `${diagram.kind} ${diagramFormula(diagram)} ${'primaryLabel' in diagram ? diagram.primaryLabel : ''} ${'secondaryLabel' in diagram ? diagram.secondaryLabel : ''}`;
  const titleFamily = conceptFamily(title);
  const diagramFamily = conceptFamily(diagramText);
  if (
    titleFamily !== 'other' &&
    diagramFamily !== 'other' &&
    titleFamily !== diagramFamily
  ) {
    return false;
  }
  const diagramIsStatistics = /muestra|poblacion|estadistica|demograf|encuesta|frecuencia|media aritm|mediana|moda/i.test(
    normalize(diagramText)
  );
  if (contextIsGeometry && diagramIsStatistics && !/estadistica/i.test(normalize(contextText))) {
    return false;
  }

  // Coherencia numérica: si la gráfica introduce coeficientes que no aparecen
  // ni en el ejemplo ni en las fórmulas válidas, es una gráfica de otro problema.
  const diagramEquation = diagramFormula(diagram);
  const canonicalGeometryDiagram =
    diagram.kind === 'geometry' &&
    /angul|grados|°|recto|llano|agudo|obtuso|complement|suplement|triangulo|poligono/i.test(
      normalize(diagramText)
    );
  if (!canonicalGeometryDiagram && diagramEquation && /=/.test(diagramEquation) && /=/.test(combined)) {
    const contextNumbers = numbersIn(combined);
    const diagramNumbers = numbersIn(diagramEquation);
    if (diagramNumbers.size > 0 && [...diagramNumbers].some((n) => !contextNumbers.has(n))) {
      return false;
    }
  }

  if (diagram.kind === 'exponential') {
    const pctMatches = Array.from(combined.matchAll(/(\d+(?:[.,]\d+)?)\s*%/g))
      .map((m) => Number(m[1].replace(',', '.')))
      .filter((n) => Number.isFinite(n) && n > 0 && n < 200);
    if (pctMatches.length > 0 && Number.isFinite(diagram.rate)) {
      const diagramPct = diagram.rate * 100;
      const matchesRate = pctMatches.some((pct) => Math.abs(pct - diagramPct) <= 0.15);
      if (!matchesRate) return false;
    }
  }

  if (diagram.kind === 'geometry') {
    const asksTriangleCongruence = /congruen|semejan|criterio\s+(?:lll|lal|ala)|tri[aá]ngulo/i.test(combined);
    const geometryText = `${diagram.primaryLabel} ${diagram.secondaryLabel} ${diagram.equation} ${(diagram.highlights || [])
      .map((h) => `${h.label} ${h.detail ?? ''}`)
      .join(' ')}`;
    const diagramLooksRectangle = /rect[aá]ngulo|largo|ancho|base\s*[×*x]\s*altura|b\s*[×*]\s*h|2l\s*\+\s*2a/i.test(
      geometryText
    );
    const diagramHasTriangle = /tri[aá]ngulo|congruen|semejan|hipotenusa|cateto/i.test(geometryText);
    if (asksTriangleCongruence && diagramLooksRectangle && !diagramHasTriangle) {
      return false;
    }
  }

  return true;
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

function normalizeConceptFamilyText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function conceptFamily(text: string): ConceptFamily {
  const t = normalizeConceptFamilyText(text);
  if (
    /pitagor|hipotenusa|cateto|triangulo\s+rectangulo|c\s*(?:\u00B2|\^?2)\s*=\s*a\s*(?:\u00B2|\^?2)\s*\+\s*b|c\s*(?:\u00B2|\^?2)\s*=/.test(
      t
    )
  ) {
    return 'pythagoras';
  }
  if (/congruen|semejan|\blll\b|\blal\b|\bala\b/.test(t)) return 'congruence';
  if (/\bangulos?\b|complement|suplement|paralel|transversal|grados|\u00B0/.test(t)) return 'angles';
  if (/geometria|perimetro|area|superficie|rectangulo|triangulo|poligono/.test(t)) return 'area-perimeter';
  if (/interes\s+(?:simple|compuesto)|exponencial|capitalizacion|crecimiento\s+poblacional|tasa\s+(?:anual|compuesta|de\s+crecimiento)/.test(t)) return 'exponential';
  if (/ecuacion\s+lineal|pendiente|interseccion|recta/.test(t)) return 'linear';
  if (/cuadratica|parabola|vertice|raices/.test(t)) return 'quadratic';
  if (/estadistica|muestra|poblacion|frecuencia|media|mediana|moda/.test(t)) return 'statistics';
  return 'other';
}

function neutralizeAngleCongruenceTerms<T>(value: T): T {
  if (typeof value === 'string') {
    return value
      .replace(/\(\s*LLL\s*,\s*LAL\s+o\s+ALA\s*\)/gi, '(relación angular)')
      .replace(/LLL\s*(?:↔|->|—|-)\s*LAL\s*(?:↔|->|—|-)\s*ALA/gi, 'relaciones angulares')
      .replace(/Lado[-\s]?[ÁA]ngulo[-\s]?[Ll]ado\s*\(LAL\)/g, 'relación angular')
      .replace(/\b(?:LLL|LAL|ALA)\b/g, 'relación angular') as T;
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index++) {
      value[index] = neutralizeAngleCongruenceTerms(value[index]);
    }
    return value;
  }
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value as Record<string, unknown>)) {
      (value as Record<string, unknown>)[key] = neutralizeAngleCongruenceTerms(
        (value as Record<string, unknown>)[key]
      );
    }
  }
  return value;
}

function normalizeMisconceptionComparable(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isWeakMisconceptionText(error: string, title: string): boolean {
  const normalizedError = normalizeMisconceptionComparable(error);
  const normalizedTitle = normalizeMisconceptionComparable(title);
  if (!normalizedError) return true;
  if (
    normalizedError === normalizedTitle ||
    normalizedTitle.includes(normalizedError) ||
    normalizedError.includes(normalizedTitle)
  ) {
    return true;
  }
  if (normalizedError.length < 35) return true;
  return !/(confund|creer|pensar|supon|asum|sum|rest|aplic|igual|omit|interpret|us|multiplic|divid|resol|generaliz|invert|mezcl|olvid|ignor|medir|calcul|eleg|seleccion|compar|despej|sustitu|simplific|traslad|juzg|codific|valid|cit|contextualiz|descontextualiz|atribu|copi|plagi|reduc|separ|aisl|memoriz|repet|acept|rechaz|descuid|salt|ejecut|escrib|redact|le|argument|conclu|afirm|neg|contradec|traz|dibuj|calibr|manipul|conect|configur|program|iter|declar|evalu|estim|aproxim|redonde|convert|transform|orden|clasific|distingu|relacion|vincul|justific|respald|comprob|verific|sin\s+(?:verificar|comprobar|validar|contextualizar|respaldar|citar|justificar|revisar|considerar|evaluar|definir|aislar|contrastar))/.test(
    normalizedError
  );
}

const MISCONCEPTION_VARIANTS: Record<string, string[]> = {
  'cometer error de signo al despejar y': [
    'Cometer error de signo al despejar la incógnita y.',
    'Invertir el signo de y al despejar la variable.',
    'Olvidar el signo negativo al despejar la variable y.',
    'Cambiar el signo de y sin justificar la operación.',
    'Despejar y con el signo contrario al original.',
    'Omitir el cambio de signo al dividir entre un coeficiente negativo.',
    'Trasladar un término con y sin invertir su signo algebraico.',
    'Perder el signo negativo del coeficiente al aislar la incógnita.',
  ],
  'interpretar una medida de tendencia central como si describiera': [
    'Interpretar la media como si describiera todos los datos sin dispersión.',
    'Usar la media como si describiera por sí sola todos los datos.',
    'Interpretar una medida central sin revisar la dispersión.',
    'Suponer que la media representa cada dato individual del conjunto.',
    'Leer la tendencia central sin considerar los valores extremos.',
    'Omitir el rango y la desviación al interpretar el promedio.',
    'Concluir sobre la muestra usando solo la media sin ver su variabilidad.',
    'Ignorar el efecto de datos atípicos sobre el promedio aritmético.',
  ],
  'factorizar o despejar sin igualar antes a cero': [
    'Factorizar o despejar sin igualar antes la ecuación a cero.',
    'Factorizar sin llevar primero la ecuación cuadrática a cero.',
    'Despejar sin igualar a cero antes de factorizar el trinomio.',
    'Omitir la forma general igualada a cero antes de factorizar.',
    'Resolver por factores sin igualar previamente la expresión a cero.',
    'Separar factores cuando el segundo miembro aún no es cero.',
    'Aplicar la propiedad del producto nulo sin igualar antes a cero.',
    'Intentar factorizar el polinomio con términos sueltos del otro lado.',
  ],
  'sumar un incremento fijo en lugar de factor exponencial': [
    'Sumar un incremento fijo en lugar de aplicar el factor exponencial.',
    'Modelar un crecimiento exponencial como si fuera una suma fija.',
    'Sumar una cantidad constante en vez de multiplicar por la tasa.',
    'Confundir el incremento lineal aditivo con el factor exponencial.',
    'Tratar el cambio porcentual compuesto como una diferencia constante.',
    'Aplicar una tasa compuesta como si fuera un aumento lineal fijo.',
    'Multiplicar la tasa por el tiempo en vez de elevar el factor base.',
    'Reemplazar la potencia del periodo por una suma acumulativa simple.',
  ],
  'asumir congruencia sin comprobar criterio ni orden angular': [
    'Asumir congruencia sin comprobar el criterio ni el orden angular.',
    'Afirmar congruencia sin verificar lados y ángulos correspondientes.',
    'Suponer figuras congruentes sin aplicar LLL, LAL o ALA.',
    'Declarar congruencia sin revisar el orden de los ángulos homólogos.',
    'Comparar triángulos sin comprobar la correspondencia de sus lados.',
    'Usar dos lados y un ángulo no comprendido como si fuera criterio LAL.',
    'Confundir la igualdad visual con una demostración por LLL, LAL o ALA.',
    'Emparejar vértices no homólogos al plantear la congruencia triangular.',
  ],
  'elegir una incognita distinta a la magnitud preguntada': [
    'Elegir una incógnita distinta a la magnitud preguntada.',
    'Elegir una variable que no representa la magnitud solicitada.',
    'Definir la incógnita con una magnitud distinta a la pregunta.',
    'Asignar la variable principal a un dato que no se busca.',
    'Confundir la incógnita buscada con una cantidad ya conocida.',
    'Plantear la ecuación despejando una variable ajena a la pregunta.',
    'Responder con el valor auxiliar sin calcular la magnitud pedida.',
    'Omitir la definición explícita de qué magnitud representa la variable.',
  ],
  'multiplicar solo un termino al igualar coeficientes': [
    'Multiplicar solo un término al igualar coeficientes del sistema.',
    'Multiplicar solo una parte de la ecuación al igualar coeficientes.',
    'Aplicar el factor a un solo término en lugar de toda la ecuación.',
    'Ajustar un coeficiente sin multiplicar el término independiente.',
    'Igualar coeficientes dejando el segundo miembro sin escalar.',
    'Amplificar la incógnita a eliminar olvidando multiplicar el resto.',
    'Alterar el balance de la ecuación al escalar solo el primer término.',
    'Omitir el factor multiplicador en la constante del lado derecho.',
  ],
  'aplicar una regla sin comprobar las condiciones especificas': [
    'Aplicar una regla sin comprobar las condiciones específicas del caso.',
    'Aplicar el procedimiento sin revisar las condiciones del problema.',
    'Usar una regla general sin validar que corresponda al planteamiento.',
    'Resolver sin comprobar las condiciones específicas de los datos.',
    'Elegir una fórmula sin verificar las restricciones del contexto.',
    'Sustituir datos en la expresión sin validar unidades ni supuestos.',
    'Operar mecánicamente sin contrastar si el modelo aplica al caso.',
    'Omitir la verificación de condiciones iniciales antes de calcular.',
  ],
  'sumar constantes sueltas con coeficientes': [
    'Sumar constantes sueltas con coeficientes de x como términos semejantes.',
    'Agrupar el término independiente con el coeficiente de la variable x.',
    'Reducir términos con variable junto con constantes numéricas sueltas.',
    'Combinar números independientes y coeficientes de x en un solo término.',
    'Tratar una constante sin variable como si fuera un término con x.',
    'Operar el coeficiente de la incógnita directamente con el término fijo.',
    'Mezclar términos algebraicos en x con constantes al simplificar.',
    'Ignorar la literal x al sumar los términos de un mismo miembro.',
  ],
  'sustituir el despeje en la misma ecuacion': [
    'Sustituir el despeje en la misma ecuación de donde salió (0 = 0).',
    'Reemplazar la incógnita despejada en la misma ecuación de origen.',
    'Sustituir la expresión aislada en la ecuación inicial en vez de la otra.',
    'Usar la misma ecuación para despejar y sustituir, llegando a 0 = 0.',
    'Omitir la segunda ecuación del sistema al momento de sustituir.',
    'Evaluar el despeje en la ecuación ya usada en lugar de la complementaria.',
    'Ciclar el despeje en una sola ecuación sin vincular la segunda.',
    'Obtener una identidad trivial por sustituir en la ecuación de partida.',
  ],
  'confundir un cateto con la hipotenusa': [
    'Confundir un cateto con la hipotenusa al aplicar Pitágoras.',
    'Sustituir la hipotenusa como si fuera uno de los catetos perpendiculares.',
    'Asignar la etiqueta c a un lado que forma el ángulo recto de 90°.',
    'Sumar la hipotenusa al cuadrado con un cateto en lugar de despejarla.',
    'Elegir el lado mayor como cateto sin ubicar primero el ángulo recto.',
    'Despejar un cateto sumando cuadrados en vez de restar a la hipotenusa.',
    'Aplicar c² = a² + b² sin identificar qué lado se opone a los 90°.',
    'Tomar la diagonal como cateto al plantear la relación pitagórica.',
  ],
  'igualar terminos no semejantes o invertir el despeje': [
    'Igualar términos no semejantes o invertir la operación al despejar.',
    'Transponer un término al otro miembro sin aplicar la operación inversa.',
    'Pasar un término sumando al otro lado conservando el mismo signo.',
    'Dividir antes de haber agrupado todos los términos independientes.',
    'Despejar el coeficiente restándolo en vez de dividir ambos miembros.',
    'Agrupar términos de distinto grado o naturaleza en el mismo miembro.',
    'Invertir numerador y denominador al despejar el coeficiente de x.',
    'Aplicar operaciones distintas en cada miembro y romper la igualdad.',
  ],
  'sumar angulos complementarios como si fueran suplementarios': [
    'Sumar ángulos complementarios a 180° en lugar de igualarlos a 90°.',
    'Confundir un par complementario (90°) con uno suplementario (180°).',
    'Igualar a 90° dos ángulos que forman un par lineal sobre una recta.',
    'Suponer que dos ángulos son iguales sin verificar si son opuestos.',
    'Aplicar suma de 180° a ángulos agudos que forman una esquina recta.',
    'No distinguir entre ángulos suplementarios y opuestos por el vértice.',
    'Plantear la ecuación angular sin identificar si el par suma 90° o 180°.',
    'Igualar ángulos adyacentes suplementarios como si tuvieran igual medida.',
  ],
  'sumar angulos suplementarios como si sumaran 90': [
    'Sumar ángulos suplementarios como si sumaran 90° en vez de 180°.',
    'Plantear 90° para un par lineal que debe sumar 180° sobre la recta.',
    'Confundir ángulos adyacentes sobre una recta con un ángulo recto.',
    'Asumir congruencia en ángulos colaterales que en realidad suman 180°.',
    'Omitir que los ángulos internos de un triángulo siempre suman 180°.',
    'Tratar ángulos alternos internos como suplementarios en rectas paralelas.',
    'Restar a 90° un ángulo obtuso que forma par suplementario de 180°.',
    'Mezclar la relación de ángulos opuestos al vértice con la de 90°.',
  ],
};

const NEUTRAL_MISCONCEPTION_VARIANTS = [
  'Aplicar un criterio sin comprobar las condiciones específicas del caso.',
  'Concluir sin contrastar las evidencias con el contexto de la sesión.',
  'Generalizar una observación aislada sin verificar fuentes ni criterios.',
  'Omitir la revisión crítica de supuestos antes de formular la respuesta.',
  'Responder de manera intuitiva sin justificar el criterio disciplinar.',
  'Separar el análisis del contexto real en que ocurre la situación.',
];

function diversifyRepeatedMisconception(
  error: string,
  sessionNumber: number,
  emitCounts: Map<string, number>,
  isQuantitative = true
): string {
  const normalized = normalizeMisconceptionComparable(error);
  const key =
    normalized in MISCONCEPTION_VARIANTS
      ? normalized
      : Object.keys(MISCONCEPTION_VARIANTS).find(
          (candidate) => normalized.includes(candidate) || candidate.includes(normalized)
        );
  const variants = key ? MISCONCEPTION_VARIANTS[key] : undefined;
  if (!variants || variants.length === 0) {
    const count = emitCounts.get(normalized) ?? 0;
    if (count < 2) {
      emitCounts.set(normalized, count + 1);
      return error;
    }
    const fallbackPool = isQuantitative
      ? MISCONCEPTION_VARIANTS['aplicar una regla sin comprobar las condiciones especificas'] ??
        NEUTRAL_MISCONCEPTION_VARIANTS
      : NEUTRAL_MISCONCEPTION_VARIANTS;
    for (const candidate of fallbackPool) {
      const cKey = normalizeMisconceptionComparable(candidate);
      const cCount = emitCounts.get(cKey) ?? 0;
      if (cCount < 2) {
        emitCounts.set(cKey, cCount + 1);
        return candidate;
      }
    }
    return error;
  }
  const startIndex = Math.abs(Math.trunc(sessionNumber) - 1) % variants.length;
  for (let offset = 0; offset < variants.length; offset++) {
    const candidate = variants[(startIndex + offset) % variants.length]!;
    const cKey = normalizeMisconceptionComparable(candidate);
    const cCount = emitCounts.get(cKey) ?? 0;
    if (cCount < 2) {
      emitCounts.set(cKey, cCount + 1);
      return candidate;
    }
  }
  return variants[startIndex] ?? error;
}

function stripMisconceptionTitlePrefix(error: string, title: string): string {
  const cleaned = error.trim();
  if (!cleaned) return cleaned;
  const colonIndex = cleaned.indexOf(':');
  if (colonIndex > 0 && colonIndex <= 80) {
    const prefix = cleaned.slice(0, colonIndex).trim();
    if (
      title.toLowerCase().includes(prefix.toLowerCase()) ||
      isWeakMisconceptionText(prefix, title)
    ) {
      return cleaned.slice(colonIndex + 1).trim();
    }
  }
  const normalizedTitle = normalizeMisconceptionComparable(title);
  const normalizedError = normalizeMisconceptionComparable(cleaned);
  if (normalizedTitle && normalizedError.startsWith(`${normalizedTitle} `)) {
    return cleaned.slice(title.length).replace(/^[\s:;\-–—]+/, '').trim();
  }
  return cleaned;
}

function defaultMisconceptionForTitle(
  title: string,
  isQuantitative = true
): { error: string; correction: string } {
  const family = conceptFamily(title);
  if (family === 'angles') {
    return {
      error: 'Sumar ángulos complementarios como si fueran suplementarios o ignorar el tipo de par.',
      correction:
        'Identifica si el par es complementario (90°), suplementario (180°) u opuesto por el vértice (iguales) antes de operar.',
    };
  }
  if (family === 'pythagoras') {
    return {
      error: 'Confundir un cateto con la hipotenusa al aplicar el teorema de Pitágoras.',
      correction: 'Ubica el ángulo recto, identifica la hipotenusa y despeja c² = a² + b² con las medidas correctas.',
    };
  }
  if (family === 'congruence') {
    return {
      error: 'Afirmar que dos figuras son congruentes sin verificar lados y ángulos correspondientes.',
      correction: 'Justifica la congruencia con un criterio LLL, LAL o ALA antes de concluir o calcular medidas.',
    };
  }
  if (family === 'linear') {
    return {
      error: 'Igualar términos no semejantes o invertir el despeje al resolver la ecuación lineal.',
      correction: 'Agrupa términos semejantes, aplica la misma operación en ambos miembros y comprueba sustituyendo el valor.',
    };
  }
  if (family === 'quadratic') {
    return {
      error: 'Aplicar la fórmula cuadrática sin ordenar la ecuación o perder una de las raíces.',
      correction: 'Ordena la ecuación como ax² + bx + c = 0, sustituye con signos completos y verifica ambas raíces.',
    };
  }
  if (family === 'area-perimeter') {
    return {
      error: 'Confundir perímetro con área o aplicar una fórmula geométrica sin verificar las unidades de la figura.',
      correction: 'Identifica si calculas contorno (longitud) o superficie (unidades cuadradas) y verifica base y altura.',
    };
  }
  if (family === 'exponential') {
    return {
      error: 'Sumar un incremento fijo en lugar de aplicar el factor exponencial compuesto en cada periodo.',
      correction: 'Multiplica por el factor (1 + r)ᵗ sobre el total vigente de cada periodo y verifica la tasa en decimal.',
    };
  }
  if (family === 'statistics') {
    return {
      error: 'Interpretar una medida de tendencia central como si describiera todos los datos.',
      correction: 'Contrasta la media con la dispersión y con los valores extremos antes de concluir.',
    };
  }
  if (!isQuantitative) {
    return {
      error: 'Aplicar un criterio sin comprobar las condiciones específicas del caso.',
      correction: 'Contrasta evidencias, contexto y criterios de la sesión antes de formular tu conclusión.',
    };
  }
  return {
    error: 'Aplicar una regla sin comprobar las condiciones específicas del problema.',
    correction: 'Identifica datos, condiciones y unidades; verifica que la regla elegida sea aplicable antes de operar.',
  };
}

function alignMisconceptionWithTitle(
  title: string,
  parts: { error: string; correction: string },
  isQuantitative = true
): { error: string; correction: string } {
  const errorText = stripMisconceptionTitlePrefix(parts.error, title);
  if (isWeakMisconceptionText(errorText, title)) {
    return defaultMisconceptionForTitle(title, isQuantitative);
  }
  const family = conceptFamily(title);
  const fullMisconception = `${errorText} ${parts.correction}`;
  const errorHasCongruence = /\b(?:lll|lal|ala)\b|congruen|semejan/i.test(errorText);
  const hasCongruence = /\b(?:lll|lal|ala)\b|congruen|semejan/i.test(fullMisconception);
  const hasAngles = /angul|complement|suplement|opuestos?\s+por\s+el\s+v[eé]rtice|par\s+lineal/i.test(
    fullMisconception
  );
  const hasPythagoras = /pit[aá]goras|hipotenusa|cateto|c\s*(?:\u00B2|\^?2)\s*=/i.test(
    fullMisconception
  );
  const hasStatistics = /muestra\s+sesgada|tama[ñn]o\s+muestral|margen\s+de\s+error|tendencia\s+central|frecuencia|media\s+aritm[eé]tica|dispersi[oó]n/i.test(
    fullMisconception
  );
  const hasExponential = /factor\s+exponencial|inter[eé]s\s+compuesto|capitalizaci[oó]n|P₀\s*\(1\s*\+\s*r\)/i.test(
    fullMisconception
  );
  if (family === 'angles' && (errorHasCongruence || (hasCongruence && !hasAngles))) {
    return {
      error: 'Sumar ángulos suplementarios como si sumaran 90° o no distinguir el tipo de par.',
      correction:
        'Verifica primero si el par es complementario (90°), suplementario (180°) u opuesto por el vértice (iguales).',
    };
  }
  if (family === 'pythagoras' && hasCongruence && !hasPythagoras) {
    return {
      error: 'Confundir un cateto con la hipotenusa del triángulo rectángulo.',
      correction: 'Identifica el ángulo recto y aplica c² = a² + b² con la hipotenusa despejada.',
    };
  }
  if (family === 'congruence' && hasPythagoras && !hasCongruence) {
    return {
      error: 'Aplicar una relación métrica sin comprobar la correspondencia entre figuras.',
      correction: 'Justifica la congruencia o semejanza con LLL, LAL o ALA antes de calcular medidas.',
    };
  }
  // Rechazar contaminación cruzada de ramas (ej. error de Estadística en Geometría plana o Álgebra)
  if (family !== 'statistics' && family !== 'other' && hasStatistics) {
    return defaultMisconceptionForTitle(title, isQuantitative);
  }
  if (
    (family === 'area-perimeter' || family === 'angles' || family === 'pythagoras' || family === 'congruence') &&
    hasExponential
  ) {
    return defaultMisconceptionForTitle(title, isQuantitative);
  }
  return { error: errorText, correction: parts.correction };
}

function isFormulaPartCoherentWithTitle(title: string, part: string): boolean {
  const titleFamily = conceptFamily(title);
  const partFamily = conceptFamily(part);
  if (titleFamily === 'other' || partFamily === 'other' || partFamily === titleFamily) return true;
  if (
    (titleFamily === 'angles' && partFamily === 'pythagoras') ||
    (titleFamily === 'pythagoras' && partFamily === 'angles')
  ) {
    return /pitagor|hipotenusa|cateto|triangulo\s+rectangulo/.test(
      normalizeConceptFamilyText(title)
    );
  }
  return false;
}

export function isFormulaCoherentWithTitle(title: string, formula: string): boolean {
  if (!formula.trim()) return false;
  return formula
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean)
    .some((part) => isFormulaPartCoherentWithTitle(title, part));
}

function selectCoherentFormula(title: string, candidates: string[]): string {
  for (const candidate of candidates) {
    if (!candidate.trim()) continue;
    const coherentParts = candidate
      .split('|')
      .map((value) => value.trim())
      .filter(Boolean)
      .filter((value) => isFormulaPartCoherentWithTitle(title, value));
    if (coherentParts.length > 0) return coherentParts.join(' | ');
  }
  return '';
}

export interface SacrintInfographicTarget {
  missionIndex: number;
  sessionIndex: number;
  conceptKey: string;
}

/**
 * Selecciona una infografía por concepto/sesión distinto. Evita el error de
 * generar una sola lámina por misión tomando siempre `sessionPlans[0]`, que
 * omitía los conceptos de las sesiones 2..N y duplicaba títulos entre misiones.
 */
export function selectInfographicTargets(workbook: ActiveWorkTextbook): SacrintInfographicTarget[] {
  const seen = new Set<string>();
  const targets: SacrintInfographicTarget[] = [];
  const missions = workbook.missions ?? [];
  missions.forEach((mission, missionIndex) => {
    const plans = resolveSessionPlans(mission);
    plans.forEach((plan, sessionIndex) => {
      const rawKey = plan.contenido || plan.objetivo || mission.sessionTopic || '';
      const conceptKey = cleanSacrintText(rawKey)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .slice(0, 90);
      if (!conceptKey || seen.has(conceptKey)) return;
      seen.add(conceptKey);
      targets.push({ missionIndex, sessionIndex, conceptKey });
    });
  });
  if (targets.length === 0 && missions.length > 0) {
    targets.push({ missionIndex: 0, sessionIndex: 0, conceptKey: 'mission-0' });
  }
  return targets;
}

export function dedupeInfographicSpecs(specs: SacrintInfographicSpec[]): SacrintInfographicSpec[] {
  const seen = new Set<string>();
  const out: SacrintInfographicSpec[] = [];
  for (const spec of specs) {
    const key = spec.title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(spec);
  }
  return out;
}

// ─── 7.3 — Strip single-letter R/A/B nodes from infographic diagram ───────────
function sanitizeInfographicDiagram(diagram: SacrintDiagramSpec): SacrintDiagramSpec {
  const isSingleLetter = (s: string | undefined) =>
    /^\s*[A-Za-z\u00C0-\u017E]\s*$/u.test(s ?? '');
  const cleanArr = <T extends { label?: string; detail?: string }>(arr: T[] | undefined): T[] =>
    (arr ?? []).filter((item) => !isSingleLetter(item.label) && !isSingleLetter(item.detail));
  const d = diagram as unknown as Record<string, unknown>;
  return {
    ...diagram,
    ...(d.highlights !== undefined ? { highlights: cleanArr(d.highlights as { label?: string; detail?: string }[]) } : {}),
    ...(d.nodes !== undefined ? { nodes: cleanArr(d.nodes as { label?: string; detail?: string }[]) } : {}),
  } as SacrintDiagramSpec;
}

function enforceInfographicOverlap(
  spec: SacrintInfographicSpec,
  sources: string[],
  maxRatio = 0.15
): SacrintInfographicSpec {
  const deOverlapField = (value: string, fallback = ''): string => {
    const clean = (value || '').trim();
    if (!clean) return clean;
    const rewritten = preventSixGramTheoryOverlap(
      sanitizePedagogicalMetaPhrases(clean),
      sources
    );
    if (sixGramOverlapRatio(rewritten, sources) <= maxRatio) return rewritten;

    const keptSentences = rewritten
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.trim())
      .filter(
        (sentence) =>
          Boolean(sentence) && sixGramOverlapRatio(sentence, sources) <= maxRatio
      );
    if (keptSentences.length > 0) {
      const joined = keptSentences.join(' ');
      if (sixGramOverlapRatio(joined, sources) <= maxRatio) return joined;
    }

    // No sustituir todos los campos por el mismo título+fórmula (eso produce
    // manuales repetitivos), pero sí compactar el texto propio hasta que sea
    // distinto del libro y conserve un cierre sintáctico completo.
    const compacted = fitPedagogicalText(rewritten, {
      maxChars: 120,
      maxWords: 18,
      role: 'concept',
    });
    if (
      compacted &&
      !hasDanglingEnding(compacted) &&
      sixGramOverlapRatio(compacted, sources) <= maxRatio
    ) {
      return compacted;
    }
    return compacted || rewritten || fallback;
  };
  const deOverlapList = (values: string[] | undefined): string[] =>
    (values ?? []).map((value) => deOverlapField(value));

  spec.claim = deOverlapField(spec.claim, spec.applicationSummary || spec.title);
  if (spec.conceptManual) {
    spec.conceptManual = {
      ...spec.conceptManual,
      centralConcept: deOverlapField(spec.conceptManual.centralConcept),
      conceptMap: spec.conceptManual.conceptMap
        .map((node) => ({
          ...node,
          concept: deOverlapField(node.concept),
          relation: deOverlapField(node.relation),
          detail: deOverlapField(
            node.detail,
            node.relation === 'Aplica en'
              ? spec.applicationSummary || spec.criteria[0] || spec.claim
              : node.relation === 'Conduce'
                ? spec.criteria[0] || spec.applicationSummary || spec.claim
                : spec.claim
          ),
        }))
        .filter((node) => Boolean(node.detail.trim())),
      definitions: spec.conceptManual.definitions
        .map((definition) => ({
          term: deOverlapField(definition.term),
          definition: deOverlapField(
            definition.definition,
            spec.applicationSummary || spec.claim || definition.term
          ),
        }))
        .filter((definition) => Boolean(definition.definition.trim())),
      usageGuidance: deOverlapList(spec.conceptManual.usageGuidance),
      masteryChecklist: deOverlapList(spec.conceptManual.masteryChecklist),
    };
  }
  spec.keyConcepts = (spec.keyConcepts ?? [])
    .map((value) => deOverlapField(value, ''))
    .filter(Boolean);
  spec.criteria = deOverlapList(spec.criteria);
  spec.steps = (spec.steps ?? []).map((step) => ({
    ...step,
    title: deOverlapField(step.title),
    body: deOverlapField(step.body),
  }));
  if (spec.quickExample) {
    spec.quickExample = {
      problemStatement: deOverlapField(spec.quickExample.problemStatement),
      steps: spec.quickExample.steps.map((step) => {
        const clean = finalizeVisibleText(step, { ensurePeriod: true });
        if (sixGramOverlapRatio(clean, sources) <= maxRatio) return clean;
        const compacted = preventSixGramTheoryOverlap(clean, sources);
        if (compacted.length >= Math.min(24, clean.length * 0.5)) {
          return finalizeVisibleText(compacted, { ensurePeriod: true });
        }
        return finalizeVisibleText(paraphraseSixGramOverlap(clean, sources), { ensurePeriod: true });
      }),
      interpretation: deOverlapField(spec.quickExample.interpretation),
    };
  }
  if (spec.applicationSummary) spec.applicationSummary = deOverlapField(spec.applicationSummary);
  if (spec.misconceptionFix) {
    spec.misconceptionFix = {
      error: deOverlapField(spec.misconceptionFix.error),
      correction: deOverlapField(spec.misconceptionFix.correction),
    };
    spec.misconception = `${spec.misconceptionFix.error} ${spec.misconceptionFix.correction}`;
  }
  spec.project = {
    artifactName: deOverlapField(spec.project.artifactName),
    communityUtility: deOverlapField(spec.project.communityUtility),
  };
  spec.facts = (spec.facts ?? []).map((fact) => ({
    label: deOverlapField(fact.label),
    value: deOverlapField(fact.value),
  }));
  spec.rubric = (spec.rubric ?? []).map((item) => ({
    ...item,
    label: deOverlapField(item.label),
  }));
  spec.variables = (spec.variables ?? []).map((variable) => ({
    ...variable,
    label: deOverlapField(variable.label),
    meaning: deOverlapField(variable.meaning),
  }));
  return spec;
}

function conceptFingerprint(value: string | null | undefined): string {
  return normalizeEditorialText(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function hasBalancedDelimiters(value: string): boolean {
  const pairs: Array<[string, string]> = [
    ['(', ')'],
    ['[', ']'],
    ['{', '}'],
  ];
  return pairs.every(([open, close]) => {
    const opens = (value.match(new RegExp(`\\${open}`, 'g')) ?? []).length;
    const closes = (value.match(new RegExp(`\\${close}`, 'g')) ?? []).length;
    return opens === closes;
  });
}

function isDistinctConceptText(value: string, references: string[]): boolean {
  const normalized = conceptFingerprint(value);
  if (!normalized) return false;
  return references.every((reference) => {
    const ref = conceptFingerprint(reference);
    if (!ref) return true;
    if (normalized === ref) return false;
    const prefix = Math.min(64, ref.length, normalized.length);
    return !(
      prefix >= 30 &&
      (normalized.startsWith(ref.slice(0, prefix)) || ref.startsWith(normalized.slice(0, prefix)))
    );
  });
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
  const rawCriteriaPool =
    selectedSession?.autoevaluacion && selectedSession.autoevaluacion.length > 0
      ? selectedSession.autoevaluacion
      : mission.formativeCheckpoint?.criteriaChecklist ?? [];
  const criteria = rawCriteriaPool
    .map((item) => sanitizePedagogicalMetaPhrases(cleanSacrintText(item)))
    .filter((item) => Boolean(item) && !isRubricOrBoilerplateLeak(item));
  const project = workbook.projectSection;
  const infographicSources = collectWorkbookTheorySources(workbook);
  const deOverlap = (value: string) =>
    preventSixGramTheoryOverlap(sanitizePedagogicalMetaPhrases(value), infographicSources).replace(
      /\bdentro de\s+/gi,
      'en '
    );

  const conceptHighlights = extractConceptHighlights(mission, selectedSession);
  const quickExample = extractWorkedExample(mission, selectedSession);
  const visualSynthesis = selectedSession?.sintesisVisual;
  const visualMap = visualSynthesis?.mapaConceptual;
  const misconceptionFixRaw = resolveMissionMisconceptionParts(mission, bundle, {
    session: selectedSession,
    allowMissionFallback: !selectedSession,
  });
  let visualMisconceptionError = sanitizePedagogicalMetaPhrases(
    cleanSacrintText(visualMap?.errorComun)
  );
  let visualMisconceptionCorrection = sanitizePedagogicalMetaPhrases(
    cleanSacrintText(visualMap?.correccionBreve)
  );
  let misconceptionFix = {
    error: finalizeVisibleText(
      visualMisconceptionError ||
        sanitizePedagogicalMetaPhrases(
          normalizeEditorialText(normalizeSessionDescriptorTense(misconceptionFixRaw.error))
        ),
      { ensurePeriod: true }
    ),
    correction: finalizeVisibleText(
      visualMisconceptionCorrection ||
        sanitizePedagogicalMetaPhrases(
          normalizeEditorialText(normalizeSessionDescriptorTense(misconceptionFixRaw.correction))
        ),
      { ensurePeriod: true }
    ),
  };
  const nonClosureSession = sessionPlans.find(
    (s) => Boolean(s.objetivo) && !isEvaluationOrClosureObjective(s.objetivo)
  );
  const nonClosureSessionObjective = nonClosureSession?.objetivo;
  const effectiveMissionTopic = isPaecProjectOrArtifactTitle(mission.sessionTopic)
    ? nonClosureSessionObjective || mission.sessionTopic
    : mission.sessionTopic;
  const topicTitle = sanitizePedagogicalMetaPhrases(
    resolveInfographicConceptTitle({
      conceptosClave:
        selectedSession?.contenido ||
        (!isPaecProjectOrArtifactTitle(mission.conceptZero?.coreExplanation)
          ? mission.conceptZero?.coreExplanation
          : nonClosureSession?.contenido || mission.conceptZero?.coreExplanation),
      sessionObjective: selectedSession?.objetivo || nonClosureSessionObjective,
      missionSessionTopic: effectiveMissionTopic,
      missionFocus: mission.sessionFocus || nonClosureSessionObjective,
      missionTitle: isPaecProjectOrArtifactTitle(meta.missionTitle) ? nonClosureSessionObjective : meta.missionTitle,
    })
  );
  const applicationSummary = finalizeVisibleText(
    deOverlap(
      bundle?.application ||
        sanitizeField(mission.youDoSection?.autonomousChallenge, 'Aplica el concepto en situaciones reales de la asignatura.', 170, 26)
    ),
    { ensurePeriod: true }
  );

  const validFormulas = conceptHighlights.formulas.filter(isValidRenderableFormula);
  const cleanTitle = stripLeadingSessionTag(sanitizePedagogicalMetaPhrases(topicTitle || meta.missionTitle));
  const isQuantitative =
    pack.id === 'matematicas' || pack.id === 'fisica' || pack.id === 'quimica';
  misconceptionFix = alignMisconceptionWithTitle(cleanTitle, misconceptionFix, isQuantitative);
  if (isWeakMisconceptionText(visualMisconceptionError, cleanTitle)) {
    visualMisconceptionError = misconceptionFix.error;
    visualMisconceptionCorrection = misconceptionFix.correction;
  }
  const visualClaim = sanitizePedagogicalMetaPhrases(cleanSacrintText(visualSynthesis?.conceptoBreve));
  const rawClaimCandidate = deOverlap(
    visualClaim ||
      cleanMissionTopicLine(
        conceptHighlights.definition || mission.sessionFocus || mission.sessionTopic || bundle?.concepts.definition,
        conceptHighlights.definition || meta.missionTitle
      )
  );
  const cleanClaim = finalizeVisibleText(
    rawClaimCandidate.length <= 220
      ? rawClaimCandidate
      : fitPedagogicalText(rawClaimCandidate, {
          maxChars: 220,
          maxWords: 34,
          role: 'concept',
        }) || rawClaimCandidate || cleanTitle,
    { ensurePeriod: true }
  );

  const sessionDiagram = selectedSession
    ? buildSacrintDiagram(mission, pack, { ...options, session: selectedSession, allowMissionFallback: false })
    : undefined;
  const candidateDiagram =
    sessionDiagram?.available
      ? sessionDiagram
      : buildSacrintDiagram(mission, pack, { ...options, session: selectedSession });
  const isQuantitativeOrReaction =
    candidateDiagram.kind === 'linear' ||
    candidateDiagram.kind === 'quadratic' ||
    candidateDiagram.kind === 'system-2x2' ||
    candidateDiagram.kind === 'exponential' ||
    candidateDiagram.kind === 'geometry' ||
    candidateDiagram.kind === 'reaction';
  const diagramEquation = candidateDiagram.available ? diagramFormula(candidateDiagram) : '';
  const formulaCandidates = [
    ...validFormulas,
    ...(candidateDiagram.available && isQuantitativeOrReaction && diagramEquation ? [diagramEquation] : []),
  ].filter(Boolean);
  const rawFormula = formulaCandidates[0] ?? '';
  const formula = selectCoherentFormula(cleanTitle, formulaCandidates);
  const diagramFormulaCoherent =
    !diagramEquation || isFormulaCoherentWithTitle(cleanTitle, diagramEquation);
  const coherent =
    Boolean(formula || !rawFormula) &&
    diagramFormulaCoherent &&
    isInfographicDiagramCoherent(
      candidateDiagram,
      `${cleanTitle} ${cleanClaim}`,
      formula ? [formula] : [],
      quickExample.problemStatement,
      cleanTitle
    );
  const diagram: SacrintDiagramSpec = coherent
    ? candidateDiagram
    : { ...candidateDiagram, available: false };
  const sanitizedDiagram = sanitizeInfographicDiagram(diagram);
  const variables = sanitizedDiagram.available ? buildDiagramVariables(sanitizedDiagram) : [];

  const titleConceptFamily = conceptFamily(cleanTitle);
  const isCompatibleKeyConcept = (item: string): boolean => {
    const itemFamily = conceptFamily(item);
    if (titleConceptFamily === 'angles' && itemFamily === 'congruence') return false;
    if (titleConceptFamily === 'congruence' && itemFamily === 'angles') return false;
    if (titleConceptFamily === 'pythagoras' && itemFamily === 'congruence') return false;
    return true;
  };
  const rawKeyConcepts = (
    conceptHighlights.keyRules.length > 0 ? conceptHighlights.keyRules : [conceptHighlights.definition]
  )
    .map((c) =>
      finalizeVisibleText(deOverlap(sanitizePedagogicalMetaPhrases(c)), { ensurePeriod: true })
    )
    .filter(
      (item) =>
        Boolean(item) &&
        !isRubricOrBoilerplateLeak(item) &&
        !hasDanglingEnding(item) &&
        hasBalancedDelimiters(item) &&
        isCompatibleKeyConcept(item)
    );
  const distinctKeyConcepts = rawKeyConcepts
    .filter((item) => isDistinctConceptText(item, [cleanTitle, cleanClaim]))
    .slice(0, 3);
  const steps = buildSteps(mission, pack, selectedSession).map((step) => ({
    ...step,
    title: finalizeVisibleText(deOverlap(sanitizePedagogicalMetaPhrases(step.title)), {
      ensurePeriod: false,
    }),
    body: finalizeVisibleText(deOverlap(step.body), { ensurePeriod: true }),
  }));

  const distinctDefinitionEntries: ConceptManualDefinition[] = distinctKeyConcepts.slice(1, 2).map((rule, idx) => {
      const colonIdx = rule.indexOf(':');
      if (colonIdx > 3 && colonIdx < 36) {
        return {
          term: finalizeVisibleText(deOverlap(rule.slice(0, colonIdx).trim()), {
            ensurePeriod: false,
          }),
          definition: finalizeVisibleText(deOverlap(rule.slice(colonIdx + 1).trim()), {
            ensurePeriod: true,
          }),
        };
      }
      return {
        term: idx === 0 ? 'Principio operativo' : 'Condición clave',
        definition: finalizeVisibleText(deOverlap(rule), { ensurePeriod: true }),
      };
    });
  if (distinctDefinitionEntries.length === 0) {
    const definitionSource =
      conceptHighlights.definition ||
      selectedSession?.contenido ||
      mission.conceptZero?.coreExplanation ||
      '';
    if (definitionSource.trim().length >= 24) {
      distinctDefinitionEntries.push({
        term: cleanTitle,
        definition: finalizeVisibleText(sanitizePedagogicalMetaPhrases(definitionSource), {
          ensurePeriod: true,
        }),
      });
    }
  }
  const visualDefinitionEntries: ConceptManualDefinition[] = [];
  if (visualMap?.definicionClave) {
    visualDefinitionEntries.push({
      term: cleanTitle,
      definition: finalizeVisibleText(
        deOverlap(sanitizePedagogicalMetaPhrases(cleanSacrintText(visualMap.definicionClave))),
        { ensurePeriod: true }
      ),
    });
  }
  if (visualMap?.criterioDesarrollo) {
    visualDefinitionEntries.push({
      term: 'Criterio de desarrollo',
      definition: finalizeVisibleText(
        deOverlap(sanitizePedagogicalMetaPhrases(cleanSacrintText(visualMap.criterioDesarrollo))),
        { ensurePeriod: true }
      ),
    });
  }
  const definitions: ConceptManualDefinition[] =
    visualDefinitionEntries.length > 0 ? visualDefinitionEntries : distinctDefinitionEntries;

  const conceptMap: ConceptMapNode[] = [
    {
      concept: cleanTitle,
      relation: 'Núcleo conceptual',
      detail: distinctKeyConcepts[0] || applicationSummary || cleanClaim,
    },
    ...(formula
      ? [
          {
            concept: 'Expresión / Regla',
            relation: 'Formaliza',
            detail: formula,
          },
        ]
      : []),
    ...(distinctKeyConcepts[0]
      ? [
          {
            concept: 'Criterio de desarrollo',
            relation: 'Conduce',
            detail: misconceptionFix.correction || distinctKeyConcepts[2] || distinctKeyConcepts[0],
          },
        ]
      : []),
    ...(visualMisconceptionError
      ? [
          {
            concept: 'Error frecuente',
            relation: 'Se corrige con',
            detail: visualMisconceptionCorrection || visualMisconceptionError,
          },
        ]
      : []),
    {
      concept: 'Transferencia',
      relation: 'Aplica en',
      detail: applicationSummary,
    },
  ];

  const seenConceptMapDetails = new Set<string>();
  for (const node of conceptMap) {
    const normalizeDetail = (value: string) => value.toLowerCase().replace(/[^a-z0-9áéíóúüñ]+/gi, ' ').trim();
    let detail = node.detail;
    if (seenConceptMapDetails.has(normalizeDetail(detail))) {
      const fallback = [cleanClaim, formula, misconceptionFix.correction, cleanTitle].find(
        (candidate) => candidate && !seenConceptMapDetails.has(normalizeDetail(candidate))
      );
      if (fallback) detail = fallback;
    }
    node.detail = detail;
    if (normalizeDetail(detail)) seenConceptMapDetails.add(normalizeDetail(detail));
  }

  const usageGuidance: string[] = [
    `Cuándo emplearlo: ${applicationSummary || distinctKeyConcepts[0] || cleanClaim}`,
    `Qué vigilar: ${fitPedagogicalText(misconceptionFix.error, { maxChars: 105, maxWords: 16, role: 'hint', ensurePeriod: true })}`,
    `Criterio de verificación: ${fitPedagogicalText(misconceptionFix.correction, { maxChars: 105, maxWords: 16, role: 'hint', ensurePeriod: true })}`,
  ];

  const coherentCriteria = criteria.filter(isCompatibleKeyConcept);
  const masteryChecklist =
    coherentCriteria.length >= 2
      ? coherentCriteria.slice(0, 3).map((item) => finalizeVisibleText(item, { ensurePeriod: true }))
      : [
          'Identificar datos clave, relaciones y condiciones iniciales del planteamiento.',
          'Aplicar el procedimiento o argumento paso a paso justificando cada transformación.',
          'Interpretar el resultado final y validar su coherencia con el contexto real.',
        ];

  const cleanCommunityUtility = sanitizePedagogicalMetaPhrases(
    sanitizeField(project?.communityUtility, '', 110, 16)
  );

  const spec: SacrintInfographicSpec = {
    format,
    theme: options.theme ?? 'light',
    meta,
    pack,
    style: resolveSacrintStyle(pack.id),
    title: cleanTitle,
    topicTitle: cleanTitle,
    subtitle: `${meta.subjectName} · BLOQUE ${meta.blockNumber} · MISIÓN ${String(meta.missionNumber).padStart(2, '0')}`,
    claim: cleanClaim,
    formula,
    formulasList: formula ? [formula] : [],
    // Reparto sin repetición: mapa=0, definición=1, lista de conceptos=2.
    keyConcepts: distinctKeyConcepts.slice(2, 3),
    conceptManual: {
      centralConcept: cleanTitle,
      conceptMap,
      definitions,
      usageGuidance,
      masteryChecklist,
    },
    quickExample: {
      problemStatement: finalizeVisibleText(deOverlap(quickExample.problemStatement), { ensurePeriod: true }),
      steps: quickExample.steps.map((s) => finalizeVisibleText(s, { ensurePeriod: true })),
      interpretation: finalizeVisibleText(deOverlap(quickExample.interpretation), { ensurePeriod: true }),
    },
    variables,
    diagram: sanitizedDiagram,
    steps,
    misconception: `${misconceptionFix.error} → ${misconceptionFix.correction}`,
    misconceptionFix,
    applicationSummary,
    criteria: masteryChecklist,
    rubric: buildRubric(workbook),
    project: {
      artifactName:
        sanitizePedagogicalMetaPhrases(cleanSacrintText(project?.artifactName)) || 'Producto integrador',
      communityUtility: cleanCommunityUtility || 'Vínculo con el proyecto formativo del bloque.',
    },
    facts,
  };
  if (titleConceptFamily === 'angles') neutralizeAngleCongruenceTerms(spec);
  return enforceInfographicOverlap(spec, infographicSources, 0.15);
}
