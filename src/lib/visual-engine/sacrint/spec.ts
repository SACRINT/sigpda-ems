import type { ActiveWorkTextbook, MissionSection, SessionPlan } from '@/types/work-textbook';
import { resolveSacrintPack, type SacrintPack } from './discipline-packs';
import { resolveSacrintStyle, type SacrintVisualStyle } from './visual-styles';
import type { SacrintThemeMode } from './tokens';
import {
  cleanMissionTopicLine,
  cleanSacrintText,
  distillConciseText,
  distillLessonBundle,
  distillProblemOrExerciseText,
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
  splitSpanishSentences,
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
          error: 'Usar margen porcentual sin pasarlo a decimal.',
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

function slideVisibleText(slide: SacrintSlide): string {
  const parts: string[] = [];
  const add = (value: string | undefined | null) => {
    if (value && value.trim()) parts.push(value.trim());
  };
  add(slide.title);
  add(slide.subtitle);
  if (slide.kind === 'concept') {
    add(slide.explanation);
    add(slide.analogy);
    add(slide.misconception);
    add(slide.formulas && slide.formulas.length > 0 ? slide.formulas[0] : slide.formula);
    for (const item of slide.keyTakeaways ?? []) add(item);
    if (slide.workedExample) {
      add(slide.workedExample.problemStatement);
      for (const step of slide.workedExample.steps) add(step);
      add(slide.workedExample.interpretation);
    }
    for (const variable of slide.variables ?? []) {
      add(variable.label);
      add(variable.meaning);
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
    for (const activity of activities) {
      add(activity.label);
      add(activity.statement);
      add(activity.hint);
    }
    add(slide.applicationText || slide.practiceText);
    for (const item of slide.objectiveBullets ?? []) add(item);
    for (const item of slide.evaluationCriteria ?? []) add(item);
    add(slide.artifactName);
    add(slide.artifactStep);
  }
  return parts.join(' ');
}

export function countSlideWords(slide: SacrintSlide): number {
  const text = slideVisibleText(slide);
  const visibleWords = text ? text.split(/\s+/).filter(Boolean).length : 0;
  const chromeWords = slide.kind === 'concept' ? 22 : slide.kind === 'practice' ? 26 : 0;
  return visibleWords + chromeWords;
}

function compactActivityStatement(statement: string): string {
  return String(statement || '').trim();
}

function enforceLessonGuideSlideBudget(slide: SacrintSlide): SacrintSlide {
  const fitShort = (
    value: string | undefined,
    maxChars: number,
    maxWords: number,
    role: 'concept' | 'problem' | 'step' | 'conclusion' | 'activity' | 'application' | 'hint' | 'general'
  ): string | undefined =>
    value ? fitPedagogicalText(value, { maxChars, maxWords, role }) || value : value;
  const compactMathStep = (step: string, maxChars: number, maxWords: number): string =>
    /[=+\-*/^]|\d/.test(step) ? step : distillStepPreservingMath(step, maxChars, maxWords);

  if (slide.kind === 'concept') {
    const cs = slide as SacrintConceptSlide;
    return {
      ...cs,
      explanation: fitShort(cs.explanation, 235, 38, 'concept') || cs.explanation,
      analogy: fitShort(cs.analogy, 70, 11, 'hint'),
      misconception: fitShort(cs.misconception, 140, 22, 'concept') || cs.misconception,
      keyTakeaways: (cs.keyTakeaways ?? [])
        .slice(0, 1)
        .map((item) => fitShort(item, 60, 10, 'concept'))
        .filter((item): item is string => Boolean(item)),
      workedExample: cs.workedExample
        ? {
            problemStatement: cs.workedExample.problemStatement,
            steps: cs.workedExample.steps
              .slice(0, 3)
              .map((step) => compactMathStep(step, 60, 9))
              .filter(Boolean),
            interpretation:
              fitShort(cs.workedExample.interpretation, 90, 14, 'conclusion') ||
              cs.workedExample.interpretation,
          }
        : cs.workedExample,
      variables: (cs.variables ?? []).slice(0, 3).map((variable) => ({
        ...variable,
        meaning: fitShort(variable.meaning, 32, 5, 'concept') || variable.meaning,
      })),
      facts: (cs.facts ?? []).slice(0, 1),
    } as unknown as SacrintConceptSlide;
  }
  if (slide.kind === 'practice') {
    const ps = slide as SacrintPracticeSlide;
    return {
      ...ps,
      activities: (ps.activities ?? []).slice(0, 2).map((activity) => ({
        ...activity,
        statement: compactActivityStatement(activity.statement),
        hint: fitShort(activity.hint, 70, 11, 'hint'),
      })),
      applicationText: fitShort(ps.applicationText, 90, 14, 'application'),
      practiceText: fitShort(ps.practiceText, 90, 14, 'application'),
      objectiveBullets: (ps.objectiveBullets ?? [])
        .slice(0, 1)
        .map((item) => fitShort(item, 60, 9, 'concept'))
        .filter((item): item is string => Boolean(item)),
      evaluationCriteria: (ps.evaluationCriteria ?? [])
        .slice(0, 2)
        .map((item) => fitShort(item, 48, 8, 'general'))
        .filter((item): item is string => Boolean(item)),
      exitChecks: (ps.exitChecks ?? [])
        .slice(0, 2)
        .map((item) => fitShort(item, 48, 8, 'general'))
        .filter((item): item is string => Boolean(item)),
      artifactName: fitShort(ps.artifactName, 40, 6, 'concept'),
      artifactStep: fitShort(ps.artifactStep, 60, 9, 'application'),
      facts: (ps.facts ?? []).slice(0, 1),
    } as unknown as SacrintPracticeSlide;
  }
  return slide;
}

function finalCompact(slide: SacrintSlide, maxWords = 180): SacrintSlide {
  if (countSlideWords(slide) <= maxWords) return slide;

  const fitShort = (
    value: string | undefined,
    maxChars: number,
    maxWordsValue: number,
    role: 'concept' | 'problem' | 'step' | 'conclusion' | 'activity' | 'application' | 'hint' | 'general'
  ): string | undefined =>
    value ? fitPedagogicalText(value, { maxChars, maxWords: maxWordsValue, role }) || value : value;
  const compactMathStep = (step: string, maxChars: number, maxWordsValue: number): string =>
    /[=+\-*/^]|\d/.test(step) ? step : distillStepPreservingMath(step, maxChars, maxWordsValue);

  if (slide.kind === 'concept') {
    const first = {
      ...(slide as SacrintConceptSlide),
      analogy: undefined,
      keyTakeaways: [],
      facts: [],
      variables: (slide.variables ?? []).slice(0, 2),
    } as unknown as SacrintConceptSlide;
    if (countSlideWords(first) <= maxWords) return first;

    const second = {
      ...first,
      explanation: fitShort(first.explanation, 120, 18, 'concept') || first.explanation,
      misconception: fitShort(first.misconception, 80, 12, 'concept') || first.misconception,
      workedExample: first.workedExample
        ? {
            problemStatement:
              fitShort(first.workedExample.problemStatement, 90, 14, 'problem') ||
              first.workedExample.problemStatement,
            steps: first.workedExample.steps
              .slice(0, 3)
              .map((step) => compactMathStep(step, 55, 8))
              .filter(Boolean),
            interpretation:
              fitShort(first.workedExample.interpretation, 45, 7, 'conclusion') ||
              first.workedExample.interpretation,
          }
        : first.workedExample,
      variables: (first.variables ?? []).slice(0, 1),
    } as SacrintConceptSlide;
    if (countSlideWords(second) <= maxWords) return second;

    return {
      ...second,
      explanation: fitShort(second.explanation, 100, 15, 'concept') || second.explanation,
      misconception: fitShort(second.misconception, 60, 9, 'concept') || second.misconception,
      variables: [],
      workedExample: second.workedExample
        ? {
            ...second.workedExample,
            steps: second.workedExample.steps.slice(0, 3),
          }
        : second.workedExample,
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

    const second = {
      ...first,
      activities: (first.activities ?? []).slice(0, 2).map((activity) => ({
        ...activity,
        statement: compactActivityStatement(activity.statement),
        hint: fitShort(activity.hint, 50, 7, 'hint'),
      })),
      applicationText: fitShort(first.applicationText, 70, 11, 'application'),
      practiceText: fitShort(first.practiceText, 70, 11, 'application'),
      objectiveBullets: (first.objectiveBullets ?? [])
        .slice(0, 1)
        .map((item) => fitShort(item, 50, 7, 'concept'))
        .filter((item): item is string => Boolean(item)),
      evaluationCriteria: (first.evaluationCriteria ?? [])
        .slice(0, 1)
        .map((item) => fitShort(item, 44, 7, 'general'))
        .filter((item): item is string => Boolean(item)),
      artifactStep: fitShort(first.artifactStep, 45, 7, 'application'),
    } as SacrintPracticeSlide;
    if (countSlideWords(second) <= maxWords) return second;

    return {
      ...second,
      activities: (second.activities ?? []).slice(0, 2).map((activity) => ({
        ...activity,
        statement: compactActivityStatement(activity.statement),
      })),
      applicationText: fitShort(second.applicationText, 60, 9, 'application'),
      artifactStep: fitShort(second.artifactStep, 40, 6, 'application'),
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
  const misconceptionParts = resolveMissionMisconceptionParts(mission, bundle, {
    session,
    allowMissionFallback: false,
  });
  const normalizedMisconception = normalizeEditorialText(
    normalizeSessionDescriptorTense(misconceptionParts.error)
  );
  const rawMisconception = fitPedagogicalText(sanitizePedagogicalMetaPhrases(normalizedMisconception), {
    maxChars: 88,
    maxWords: 13,
    role: 'hint',
  });
  const misconception =
    enforceSixGramOverlap(rawMisconception, workbookTheorySources, 0.12, 'concept') ||
    preventSixGramTheoryOverlap(rawMisconception, workbookTheorySources);

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

  const conceptSlide: SacrintConceptSlide = {
    kind: 'concept',
    eyebrow: `SESIÓN ${sesLabel} · PIZARRÓN 1/2 · CONOCIMIENTO NUEVO`,
    title: fittedTopicTitle,
    subtitle: '',
    missionIndex: meta.missionNumber,
    sessionNumber: bundle.sessionNumber,
    isLessonGuide: true,
    activationNote: bundle.activation,
    analogy: bundle.question || bundle.activation,
    explanation: cleanExplanation,
    formulas: effectiveFormulas,
    keyTakeaways: conceptTakeaways,
    workedExample: bundle.example,
    misconception,
    formula,
    variables,
    diagram,
    facts,
  };

  const primaryObjective = fitPedagogicalText(cleanObjective, {
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
  const rawEvalPool = [...rawAutoChecks, ...bundle.exitChecks.filter((c) => isLabOrWorkshopSubject || !/normas\s+de\s+seguridad\s+e\s+higiene/i.test(c))];
  const evaluationCriteriaRaw = rawEvalPool
    .map((item) =>
      fitPedagogicalText(
        preventSixGramTheoryOverlap(sanitizePedagogicalMetaPhrases(item), workbookTheorySources),
        { maxChars: 52, maxWords: 8, role: 'general', ensurePeriod: false }
      )
    )
    .filter((item, idx, arr): item is string => Boolean(item) && arr.indexOf(item) === idx)
    .slice(0, 2);
  const evaluationCriteria =
    evaluationCriteriaRaw.length > 0
      ? evaluationCriteriaRaw
      : ['Procedimiento ordenado y conclusión coherente con el planteamiento.'];

  const practiceSlide: SacrintPracticeSlide = {
    kind: 'practice',
    eyebrow: `SESIÓN ${sesLabel} · PIZARRÓN 2/2 · EJERCICIOS Y APLICACIÓN`,
    title: fittedTopicTitle,
    subtitle: '',
    missionIndex: meta.missionNumber,
    sessionNumber: bundle.sessionNumber,
    isLessonGuide: true,
    practiceText: bundle.application,
    activities: bundle.activities.slice(0, 2),
    checkpoints: bundle.activities.slice(0, 2).map((item) => `${item.label}: ${item.statement}`),
    objectiveBullets,
    evaluationCriteria,
    hint: bundle.activities[0]?.hint,
    applicationText: bundle.application,
    artifactName,
    artifactStep: bundle.artifactStep,
    exitChecks: bundle.exitChecks.slice(0, 2),
    facts,
  };

  const budgetedConcept = finalCompact(enforceLessonGuideSlideBudget(conceptSlide), 260);
  const budgetedPractice = finalCompact(enforceLessonGuideSlideBudget(practiceSlide), 230);
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
  if (diagramEquation && /=/.test(diagramEquation) && /=/.test(combined)) {
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
  if (/pitagor|hipotenusa|cateto|triangulo\s+rectangulo|c\s*(?:\u00B2|\^?2)\s*=\s*a\s*(?:\u00B2|\^?2)\s*\+\s*b/.test(t)) {
    return 'pythagoras';
  }
  if (/angul|complement|suplement|paralel|transversal|grados|\u00B0/.test(t)) return 'angles';
  if (/perimetro|area|superficie|rectangulo|triangulo|poligono/.test(t)) return 'area-perimeter';
  if (/congruen|semejan|\blll\b|\blal\b|\bala\b/.test(t)) return 'congruence';
  if (/ecuacion\s+lineal|pendiente|interseccion|recta/.test(t)) return 'linear';
  if (/cuadratica|parabola|vertice|raices/.test(t)) return 'quadratic';
  if (/estadistica|muestra|poblacion|frecuencia|media|mediana|moda/.test(t)) return 'statistics';
  return 'other';
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
    const part = candidate
      .split('|')
      .map((value) => value.trim())
      .filter(Boolean)
      .find((value) => isFormulaPartCoherentWithTitle(title, value));
    if (part) return part;
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
    return fallback;
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
      steps: spec.quickExample.steps.map((step) => deOverlapField(step)),
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
    preventSixGramTheoryOverlap(sanitizePedagogicalMetaPhrases(value), infographicSources);

  const conceptHighlights = extractConceptHighlights(mission, selectedSession);
  const quickExample = extractWorkedExample(mission, selectedSession);
  const misconceptionFixRaw = resolveMissionMisconceptionParts(mission, bundle, {
    session: selectedSession,
    allowMissionFallback: !selectedSession,
  });
  const misconceptionFix = {
    error: finalizeVisibleText(
      sanitizePedagogicalMetaPhrases(
        normalizeEditorialText(normalizeSessionDescriptorTense(misconceptionFixRaw.error))
      ),
      { ensurePeriod: true }
    ),
    correction: finalizeVisibleText(
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
  const rawClaimCandidate = deOverlap(
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
        hasBalancedDelimiters(item)
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
  const definitions: ConceptManualDefinition[] = distinctDefinitionEntries;

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

  const masteryChecklist =
    criteria.length >= 2
      ? criteria.slice(0, 3).map((item) => finalizeVisibleText(item, { ensurePeriod: true }))
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
      steps: quickExample.steps.map((s) => finalizeVisibleText(deOverlap(s), { ensurePeriod: true })),
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
  return enforceInfographicOverlap(spec, infographicSources, 0.15);
}
