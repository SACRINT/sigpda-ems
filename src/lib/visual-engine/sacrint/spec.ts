import type { ActiveWorkTextbook, MissionSection, SessionPlan } from '@/types/work-textbook';
import { resolveSacrintPack, type SacrintPack } from './discipline-packs';
import { resolveSacrintStyle } from './visual-styles';
import {
  cleanSacrintText,
  GENERIC_CONCLUSION_RE,
  isRubricOrBoilerplateLeak,
  NUMERIC_ONLY_STEP_RE,
  sanitizePedagogicalMetaPhrases,
  stripTemplateLabels,
  TEMPLATE_PHRASE_RE,
} from './text/grammar-normalization';
import {
  enforceSixGramOverlap,
  paraphraseSixGramOverlap,
  preventSixGramTheoryOverlap,
  sixGramOverlapRatio,
} from './text/six-gram-overlap';
import {
  cleanMissionTopicLine,
  distillConciseText,
  extractBulletSentences,
  extractChalkboardTopicTitle,
  extractCleanTopicTitle,
  normalizeLearningObjective,
  validatePracticeActivity,
} from './text/objective-and-activity-guards';
import { distillStepPreservingMath } from './distiller/formula-and-steps';
import { distillLessonBundle } from './distiller/lesson-bundle';
import { extractConceptHighlights } from './distiller/summary-and-concepts';
import { extractWorkedExample } from './distiller/worked-example';
import {
  alignMisconceptionWithTitle,
  conceptFamily,
  diversifyRepeatedMisconception,
  isFormulaCoherentWithTitle,
  isWeakMisconceptionText,
  neutralizeAngleCongruenceTerms,
  selectCoherentFormula,
  validateSacrintContentIntegrity,
} from './builders/content-integrity';
import {
  compactEvaluationCriterion,
  countSlideWords,
  enforceLessonGuideSlideBudget,
  ensureActivityClosure,
  hasActivityTask,
  hasSlideIntegrityDefect,
  hasSpanishPredicateVerb,
  INCOHERENT_APLICAR_PREFIX_RE,
  isHeadlessAnaphoricStart,
  isValidEvaluationCriterionItem,
  sanitizeDiagramPostBudget,
  sanitizeMechanicalSlideCorruption,
} from './builders/slide-budget';
import { finalCompact } from './builders/slide-final-compactor';
import {
  buildDiagramVariables,
  buildSacrintDiagram,
  diagramFormula,
  diagramSubtitle,
  stepLabelsForPack,
} from './diagrams';
import { classifyTopic } from '@/lib/visual-engine/topic-classifier';
import {
  extractDisciplinaryConceptPhrase,
  GENERIC_TITLE_BLACKLIST_RE,
  isEvaluationOrClosureObjective,
  isPaecProjectOrArtifactTitle,
  resolveInfographicConceptTitle,
  sanitizeWorkbookTocTitle,
} from '@/lib/editorial/topic-title-resolver';
import { finalizeVisibleText, fitPedagogicalText } from '@/lib/editorial/fitter/text-compactor';
import {
  hasDanglingEnding,
  repairDanglingEnding,
} from '@/lib/editorial/fitter/dangling-guards';
import { splitSpanishSentences } from '@/lib/editorial/fitter/sentence-splitter';
import {
  isValidRenderableFormula,
  normalizeEditorialText,
  normalizeSessionDescriptorTense,
} from '@/lib/editorial/text-normalization';
import {
  LESSON_GUIDE_NO_SESSIONS_CODE,
  LessonGuideNoSessionsError,
  SACRINT_SLIDE_COUNT,
  type ConceptManualDefinition,
  type ConceptMapNode,
  type DistilledLessonBundle,
  type SacrintBuildOptions,
  type SacrintChallengeSlide,
  type SacrintClosingSlide,
  type SacrintConceptSlide,
  type SacrintCoverSlide,
  type SacrintDeckMode,
  type SacrintDeckSpec,
  type SacrintDemoSlide,
  type SacrintDiagramSpec,
  type SacrintEvidenceSlide,
  type SacrintFact,
  type SacrintHookSlide,
  type SacrintInfographicFormat,
  type SacrintInfographicSpec,
  type SacrintInfographicStep,
  type SacrintInfographicTarget,
  type SacrintMissionMeta,
  type SacrintPracticeSlide,
  type SacrintRubricItem,
  type SacrintSlide,
} from './types';

export {
  LESSON_GUIDE_NO_SESSIONS_CODE,
  LessonGuideNoSessionsError,
  SACRINT_SLIDE_COUNT,
  conceptFamily,
  countSlideWords,
  ensureActivityClosure,
  isFormulaCoherentWithTitle,
  validateSacrintContentIntegrity,
};

export type {
  ArgumentDiagramSpec,
  BlockDiagramSpec,
  ClinicalFlowDiagramSpec,
  ConceptDiagramSpec,
  ConceptFamily,
  ConceptManualDefinition,
  ConceptManualSection,
  ConceptMapNode,
  CreativeCycleDiagramSpec,
  DistilledExample,
  DistilledLessonBundle,
  DistilledPracticeActivity,
  ExponentialDiagramSpec,
  GeometryDiagramSpec,
  LanguageDiagramSpec,
  LinearDiagramSpec,
  QuadraticDiagramSpec,
  ReactionDiagramSpec,
  RegulationFlowDiagramSpec,
  SacrintBuildOptions,
  SacrintChallengeSlide,
  SacrintClosingSlide,
  SacrintConceptSlide,
  SacrintCoverSlide,
  SacrintDeckMode,
  SacrintDeckSpec,
  SacrintDemoSlide,
  SacrintDiagramNode,
  SacrintDiagramSpec,
  SacrintEvidenceSlide,
  SacrintFact,
  SacrintHookSlide,
  SacrintInfographicFormat,
  SacrintInfographicSpec,
  SacrintInfographicStep,
  SacrintInfographicTarget,
  SacrintMissionMeta,
  SacrintPracticeSlide,
  SacrintRubricItem,
  SacrintSlide,
  SacrintSlideKind,
  SacrintTrafficLight,
  SacrintVariable,
  SopFlowDiagramSpec,
  System2x2DiagramSpec,
  SystemMapDiagramSpec,
  TimelineDiagramSpec,
  TrainingCycleDiagramSpec,
} from './types';


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
  if (workbook.coverData?.paecProjectName) sources.push(workbook.coverData.paecProjectName);
  for (const m of workbook.missions ?? []) {
    if (m.conceptZero) pushTheoryStrings(sources, m.conceptZero);
    if (m.phenomenonHook?.story) sources.push(m.phenomenonHook.story);
    for (const s of m.sessionPlans ?? []) {
      if (s.objetivo) sources.push(s.objetivo);
      if (s.motivacion) sources.push(s.motivacion);
      if (s.saberesPrevios) sources.push(s.saberesPrevios);
      if (s.contenido) sources.push(s.contenido);
      if (s.ejemploResuelto) sources.push(s.ejemploResuelto);
      if (s.aplicacion) sources.push(s.aplicacion);
      if (s.productoIntegrador) sources.push(s.productoIntegrador);
      for (const check of s.autoevaluacion ?? []) {
        if (check) sources.push(check);
      }
      for (const practice of s.practica ?? []) {
        if (practice.enunciado) sources.push(practice.enunciado);
        if (practice.pista) sources.push(practice.pista);
      }
    }
  }
  workbookTheorySourcesCache.set(workbook, sources);
  return sources;
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
  const preferredExampleText = [
    session.sintesisVisual?.formulaOReglaClave,
    bundle.example?.problemStatement,
    ...(bundle.example?.steps ?? []),
    bundle.example?.interpretation,
  ]
    .filter(Boolean)
    .join(' ');
  const diagram = buildSacrintDiagram(mission, pack, {
    ...options,
    session,
    allowMissionFallback: false,
    preferredExampleText: preferredExampleText.length >= 16 ? preferredExampleText : undefined,
    theorySources: workbookTheorySources,
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
  const hasAuthoritativeV2Error =
    Boolean(visualError) && visualError.length >= 35 && !isRubricOrBoilerplateLeak(visualError);
  const misconceptionParts = hasAuthoritativeV2Error
    ? resolvedMisconceptionBase
    : alignMisconceptionWithTitle(
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
  const alignedMisconception = hasAuthoritativeV2Error
    ? misconception
    : alignMisconceptionWithTitle(
        misconceptionTitle,
        {
          error: misconception,
          correction: misconceptionParts.correction,
        },
        isQuantitative
      ).error;
  const finalMisconception = hasAuthoritativeV2Error
    ? alignedMisconception
    : diversifyRepeatedMisconception(
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

  const safeMissionFallbackTitle =
    extractDisciplinaryConceptPhrase(meta.missionTitle) ||
    extractDisciplinaryConceptPhrase(mission.sessionTopic) ||
    stripLeadingSessionTag(meta.missionTitle);
  const rawFittedTopicTitle = normalizeSessionDescriptorTense(
    finalizeVisibleText(
      stripLeadingSessionTag(
        bundle.topicTitle.length > 120
          ? fitPedagogicalText(bundle.topicTitle, {
              maxChars: 118,
              maxWords: 15,
              role: 'concept',
              ensurePeriod: false,
            }) || safeMissionFallbackTitle
          : bundle.topicTitle
      ),
      { fallback: safeMissionFallbackTitle, ensurePeriod: false }
    )
  );
  const fittedTopicTitle =
    /^Ciencia\s+experimental\s+como\b/i.test(rawFittedTopicTitle) &&
    /\bdensidad\b/i.test(session.sintesisVisual?.conceptoBreve || bundle.concepts.definition || '') &&
    /(?:ρ|rho)\s*=\s*m\s*\/\s*V/i.test(session.sintesisVisual?.formulaOReglaClave || '')
      ? 'Ciencia experimental: propiedades de la materia y densidad'
      : rawFittedTopicTitle;
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
  const exampleNums = new Set(
    (preferredExampleText.match(/\b\d{2,}\b/g) ?? [])
  );
  const isConcreteMismatchFormula = (candidate: string): boolean => {
    if (exampleNums.size === 0) return false;
    const fNums = candidate.match(/\b\d{2,}\b/g) ?? [];
    return fNums.length >= 2 && fNums.every((n) => !exampleNums.has(n));
  };
  const coherentValidFormulas = validFormulas.filter((item) => !isConcreteMismatchFormula(item));
  const baseEffectiveFormulas =
    coherentValidFormulas.length > 0
      ? coherentValidFormulas.slice(0, 2)
      : formula
        ? [formula]
        : validFormulas.slice(0, 2);
  const rawV2Formula = session.sintesisVisual?.formulaOReglaClave?.trim();
  const effectiveFormulas =
    rawV2Formula &&
    rawV2Formula !== 'P1 + P2 → T' &&
    !baseEffectiveFormulas.includes(rawV2Formula)
      ? [rawV2Formula, ...baseEffectiveFormulas].slice(0, 3)
      : baseEffectiveFormulas;
  const primaryFormula = effectiveFormulas[0] ?? rawV2Formula ?? formula;

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
      hasSpanishPredicateVerb(String(value)) &&
      !isHeadlessAnaphoricStart(String(value)) &&
      !hasDanglingEnding(String(value)) &&
      !isRubricOrBoilerplateLeak(String(value))
  );
  const guardedExplanationBase = explanationCandidate || softenedExplanation;
  const guardedExplanation =
    guardedExplanationBase.trim().length >= 55 &&
    hasSpanishPredicateVerb(guardedExplanationBase) &&
    !isHeadlessAnaphoricStart(guardedExplanationBase) &&
    !hasDanglingEnding(guardedExplanationBase)
      ? guardedExplanationBase
      : rawFirstContentSentence &&
          rawFirstContentSentence.trim().length >= 45 &&
          hasSpanishPredicateVerb(rawFirstContentSentence) &&
          !hasDanglingEnding(rawFirstContentSentence)
        ? rawFirstContentSentence
        : hasSpanishPredicateVerb(guardedExplanationBase) && !hasDanglingEnding(guardedExplanationBase)
          ? guardedExplanationBase
          : `${guardedExplanationBase.replace(/[.!?]+$/, '')} constituye un concepto central de esta sesión.`;

  const guardedExplanationFinal = guardedExplanation.replace(/\bentre dos\.$/i, 'entre dos expresiones.');

  const cleanWorkedExample = bundle.example
    ? {
        ...bundle.example,
        problemStatement: paraphraseSixGramOverlap(bundle.example.problemStatement, workbookTheorySources),
        steps: bundle.example.steps.map((step) => {
          const paraphrased = paraphraseSixGramOverlap(step, workbookTheorySources);
          const origNums = (step.match(/\d+(?:[.,]\d+)?/g) ?? []).join('|');
          const newNums = (paraphrased.match(/\d+(?:[.,]\d+)?/g) ?? []).join('|');
          return origNums === newNums && !hasDanglingEnding(paraphrased) ? paraphrased : step;
        }),
        interpretation: paraphraseSixGramOverlap(
          bundle.example.interpretation.replace(
            /^(?:conclusi[oó]n(?:\s+y\s+verificaci[oó]n)?|verificaci[oó]n(?:\s+y\s+conclusi[oó]n)?|respuesta\s+final|resultado)\s*[:.\-–]?\s*/i,
            ''
          ),
          workbookTheorySources
        ),
      }
    : bundle.example;

  const paraphraseNodeDetail = (value: string): string => {
    if (!value || value.trim().length < 24) return value;
    const p = paraphraseSixGramOverlap(value, workbookTheorySources);
    const origNums = (value.match(/\d+(?:[.,]\d+)?/g) ?? []).join('|');
    const newNums = (p.match(/\d+(?:[.,]\d+)?/g) ?? []).join('|');
    return origNums === newNums && !hasDanglingEnding(p) ? p : value;
  };
  const paraphrasedDiagram: SacrintDiagramSpec | undefined = (() => {
    if (!diagram || !diagram.available || workbookTheorySources.length === 0) return diagram;
    switch (diagram.kind) {
      case 'concept':
        return {
          ...diagram,
          center: { ...diagram.center, detail: paraphraseNodeDetail(diagram.center.detail) },
          nodes: diagram.nodes.map((n) => ({ ...n, detail: paraphraseNodeDetail(n.detail) })),
        };
      case 'system-map':
        return {
          ...diagram,
          center: { ...diagram.center, detail: paraphraseNodeDetail(diagram.center.detail) },
          components: diagram.components.map((c) => ({ ...c, detail: paraphraseNodeDetail(c.detail) })),
          environment: { ...diagram.environment, detail: paraphraseNodeDetail(diagram.environment.detail) },
        };
      case 'block-diagram':
        return {
          ...diagram,
          input: { ...diagram.input, detail: paraphraseNodeDetail(diagram.input.detail) },
          process: { ...diagram.process, detail: paraphraseNodeDetail(diagram.process.detail) },
          output: { ...diagram.output, detail: paraphraseNodeDetail(diagram.output.detail) },
          feedback: { ...diagram.feedback, detail: paraphraseNodeDetail(diagram.feedback.detail) },
        };
      case 'timeline':
        return {
          ...diagram,
          events: diagram.events.map((e) => ({ ...e, detail: paraphraseNodeDetail(e.detail) })),
        };
      case 'language':
        return {
          ...diagram,
          input: { ...diagram.input, detail: paraphraseNodeDetail(diagram.input.detail) },
          rule: { ...diagram.rule, detail: paraphraseNodeDetail(diagram.rule.detail) },
          output: { ...diagram.output, detail: paraphraseNodeDetail(diagram.output.detail) },
          context: { ...diagram.context, detail: paraphraseNodeDetail(diagram.context.detail) },
        };
      case 'argument':
        return {
          ...diagram,
          thesis: { ...diagram.thesis, detail: paraphraseNodeDetail(diagram.thesis.detail) },
          premises: diagram.premises.map((pr) => ({ ...pr, detail: paraphraseNodeDetail(pr.detail) })),
          objection: { ...diagram.objection, detail: paraphraseNodeDetail(diagram.objection.detail) },
          conclusion: { ...diagram.conclusion, detail: paraphraseNodeDetail(diagram.conclusion.detail) },
        };
      case 'sop-flow':
        return {
          ...diagram,
          steps: diagram.steps.map((st) => ({ ...st, detail: paraphraseNodeDetail(st.detail) })),
        };
      case 'creative-cycle':
        return {
          ...diagram,
          phases: diagram.phases.map((ph) => ({ ...ph, detail: paraphraseNodeDetail(ph.detail) })),
          statement: diagram.statement ? paraphraseNodeDetail(diagram.statement) : '',
        };
      case 'training-cycle':
        return {
          ...diagram,
          phases: diagram.phases.map((ph) => ({ ...ph, detail: paraphraseNodeDetail(ph.detail) })),
          principle: diagram.principle ? paraphraseNodeDetail(diagram.principle) : '',
        };
      case 'regulation-flow':
        return {
          ...diagram,
          stages: diagram.stages.map((st) => ({ ...st, detail: paraphraseNodeDetail(st.detail) })),
          anchor: diagram.anchor ? paraphraseNodeDetail(diagram.anchor) : '',
        };
      case 'clinical-flow':
        return {
          ...diagram,
          stages: diagram.stages.map((st) => ({ ...st, detail: paraphraseNodeDetail(st.detail) })),
          note: diagram.note ? paraphraseNodeDetail(diagram.note) : '',
        };
      default:
        return diagram;
    }
  })();

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
    workedExample: cleanWorkedExample,
    misconception: finalMisconception,
    formula: primaryFormula,
    variables,
    diagram: paraphrasedDiagram,
    facts,
  };

  const rawSessionObjectiveForSlide = cleanSacrintText(session.objetivo || bundle.objective || '');
  const normalizedBaseObjective =
    normalizeLearningObjective(rawSessionObjectiveForSlide, {
      title: fittedTopicTitle,
      maxWords: 15,
      sessionNumber: bundle.sessionNumber,
      field: 'objectiveBullets',
      strict: false,
    }) ||
    normalizeLearningObjective(cleanObjective, {
      title: fittedTopicTitle,
      maxWords: 15,
      sessionNumber: bundle.sessionNumber,
      field: 'objectiveBullets',
      strict: false,
    });
  const paraphrasedObjectiveCandidate = normalizedBaseObjective
    ? paraphraseSixGramOverlap(
        preventSixGramTheoryOverlap(normalizedBaseObjective, workbookTheorySources),
        workbookTheorySources
      )
    : '';
  const getSynthesizedFallbackObjective = (): string =>
    normalizeLearningObjective(
      `Analizar los criterios clave de ${fittedTopicTitle.toLowerCase()} en situaciones reales del entorno.`,
      {
        title: fittedTopicTitle,
        maxWords: 15,
        sessionNumber: bundle.sessionNumber,
        field: 'objectiveBullets',
        strict: false,
      }
    ) || 'Analizar los conceptos centrales de la sesión y fundamentar su aplicación práctica.';
  const validatedObjective =
    normalizeLearningObjective(paraphrasedObjectiveCandidate, {
      title: fittedTopicTitle,
      maxWords: 15,
      sessionNumber: bundle.sessionNumber,
      field: 'objectiveBullets',
      strict: false,
    }) ||
    normalizedBaseObjective ||
    (rawSessionObjectiveForSlide.length >= 12 ? getSynthesizedFallbackObjective() : null);
  const objectiveBullets = validatedObjective ? [validatedObjective] : [];

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
        { maxChars: 108, maxWords: 18, role: 'general', ensurePeriod: false }
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
        : `Integra los resultados validados de esta sesión en ${artifactName.replace(/\.+$/, '')}.`;

  const slideActivities = bundle.activities.slice(0, 2).map((item, idx) => {
    const rawStmt = item.statement || '';
    const originalSessionStmt = ensureActivityClosure(
      cleanSacrintText(session.practica?.[idx]?.enunciado || '')
    );
    const paraphrased = paraphraseSixGramOverlap(rawStmt, workbookTheorySources);
    const safeStmt =
      paraphrased &&
      !hasDanglingEnding(paraphrased) &&
      (hasActivityTask(paraphrased) || !hasActivityTask(rawStmt))
        ? paraphrased
        : rawStmt;
    const rawHint = item.hint;
    const paraphrasedHint = rawHint ? paraphraseSixGramOverlap(rawHint, workbookTheorySources) : undefined;
    const safeHint =
      paraphrasedHint && !hasDanglingEnding(paraphrasedHint) && paraphrasedHint.length >= 22
        ? paraphrasedHint
        : rawHint;
    let closedStmt = ensureActivityClosure(safeStmt);
    let finalHint = safeHint;
    const check = validatePracticeActivity(closedStmt, finalHint, {
      sessionNumber: bundle.sessionNumber,
      field: `activities[${idx}]`,
      strict: false,
    });
    if (!check.valid && originalSessionStmt && hasActivityTask(originalSessionStmt)) {
      const paraphrasedOrig = ensureActivityClosure(
        paraphraseSixGramOverlap(originalSessionStmt, workbookTheorySources)
      );
      closedStmt = hasActivityTask(paraphrasedOrig) ? paraphrasedOrig : originalSessionStmt;
    } else if (check.rescuedStatement) {
      closedStmt = ensureActivityClosure(check.rescuedStatement);
      finalHint = check.updatedHint ?? '';
    }
    return {
      ...item,
      statement: closedStmt,
      hint: finalHint,
    };
  });

  const practiceSlide: SacrintPracticeSlide = {
    kind: 'practice',
    eyebrow: `SESIÓN ${sesLabel} · PIZARRÓN 2/2 · EJERCICIOS Y APLICACIÓN`,
    title: fittedTopicTitle,
    subtitle: '',
    missionIndex: meta.missionNumber,
    sessionNumber: bundle.sessionNumber,
    isLessonGuide: true,
    practiceText: guardedApplicationText,
    activities: slideActivities,
    checkpoints: slideActivities.map((item) => `${item.label}: ${softenField(item.statement, 120) ?? item.statement}`),
    objectiveBullets,
    evaluationCriteria,
    hint: softenField(slideActivities[0]?.hint, 90),
    applicationText: guardedApplicationText,
    artifactName,
    artifactStep: safeArtifactStep,
    exitChecks: bundle.exitChecks.slice(0, 2).map((item) => softenField(item, 100) ?? item),
    facts,
  };

  const rawBudgetedConcept = finalCompact(enforceLessonGuideSlideBudget(conceptSlide), 130) as SacrintConceptSlide;
  const baseConceptExplanation = sanitizeMechanicalSlideCorruption(
    rawBudgetedConcept.explanation &&
      rawBudgetedConcept.explanation.trim().length >= 55 &&
      !isHeadlessAnaphoricStart(rawBudgetedConcept.explanation) &&
      !hasSlideIntegrityDefect(rawBudgetedConcept.explanation)
      ? rawBudgetedConcept.explanation
      : conceptSlide.explanation
  );
  const safeConceptTitle =
    rawBudgetedConcept.title && !GENERIC_TITLE_BLACKLIST_RE.test(rawBudgetedConcept.title.trim())
      ? sanitizeMechanicalSlideCorruption(rawBudgetedConcept.title)
      : fittedTopicTitle && !GENERIC_TITLE_BLACKLIST_RE.test(fittedTopicTitle.trim())
        ? fittedTopicTitle
        : `Eje conceptual de la sesión ${sesLabel}`;

  const rawWe = rawBudgetedConcept.workedExample ?? conceptSlide.workedExample;
  const origWe = conceptSlide.workedExample;
  let safeProblemStmt = sanitizeMechanicalSlideCorruption(rawWe?.problemStatement);
  if (safeProblemStmt.length < 12 || !/[a-záéíóúñ]/i.test(safeProblemStmt) || hasSlideIntegrityDefect(safeProblemStmt)) {
    const origProb = sanitizeMechanicalSlideCorruption(origWe?.problemStatement);
    safeProblemStmt =
      origProb.length >= 12 && /[a-záéíóúñ]/i.test(origProb) && !hasSlideIntegrityDefect(origProb)
        ? origProb
        : `Analiza un caso práctico sobre ${safeConceptTitle.toLowerCase()} aplicando los criterios de la sesión.`;
  }
  const isStepPublishable = (st: string): boolean =>
    st.trim().length >= 8 && !hasSlideIntegrityDefect(st);
  let safeSteps = (rawWe?.steps ?? [])
    .map((st) => sanitizeMechanicalSlideCorruption(st))
    .filter(isStepPublishable);
  const hasSingleMultiEqStep =
    safeSteps.length === 1 && ((safeSteps[0]?.match(/=/g)?.length ?? 0) >= 2);
  if (safeSteps.length < 2 && !hasSingleMultiEqStep) {
    const restoredSteps = (origWe?.steps ?? [])
      .map((st) => sanitizeMechanicalSlideCorruption(st))
      .filter(isStepPublishable)
      .slice(0, 3);
    if (restoredSteps.length >= 2 || (restoredSteps.length === 1 && (restoredSteps[0]?.match(/=/g)?.length ?? 0) >= 2)) {
      safeSteps = restoredSteps;
    } else {
      const fallbackPool = [
        ...safeSteps,
        `Identifica las variables y condiciones relevantes del caso sobre ${safeConceptTitle.toLowerCase()}.`,
        'Desarrolla el procedimiento aplicando los criterios disciplinares revisados en la sesión.',
      ];
      safeSteps = Array.from(new Set(fallbackPool.filter(isStepPublishable))).slice(0, 2);
    }
  }
  let safeInterpretation = sanitizeMechanicalSlideCorruption(rawWe?.interpretation);
  if (!safeInterpretation || hasSlideIntegrityDefect(safeInterpretation)) {
    const origInterp = sanitizeMechanicalSlideCorruption(origWe?.interpretation);
    safeInterpretation =
      origInterp && !hasSlideIntegrityDefect(origInterp)
        ? origInterp
        : `El análisis fundamenta decisiones coherentes sobre ${safeConceptTitle.toLowerCase()} en el entorno.`;
  }
  const budgetedMisconception = sanitizeMechanicalSlideCorruption(rawBudgetedConcept.misconception);
  const fallbackMisconception = sanitizeMechanicalSlideCorruption(conceptSlide.misconception);
  const safeMisconception =
    budgetedMisconception && !hasSlideIntegrityDefect(budgetedMisconception)
      ? budgetedMisconception
      : fallbackMisconception && !hasSlideIntegrityDefect(fallbackMisconception)
        ? fallbackMisconception
        : '';

  const budgetedConcept: SacrintConceptSlide = {
    ...rawBudgetedConcept,
    title: safeConceptTitle,
    explanation: !hasSlideIntegrityDefect(baseConceptExplanation)
      ? baseConceptExplanation
      : `Comprende los principios fundamentales de ${safeConceptTitle.toLowerCase()} y su relación con problemáticas reales del contexto.`,
    misconception: safeMisconception,
    workedExample: {
      problemStatement: safeProblemStmt,
      steps: safeSteps,
      interpretation: safeInterpretation,
    },
    diagram: sanitizeDiagramPostBudget(rawBudgetedConcept.diagram, safeConceptTitle),
  };

  const rawBudgetedPractice = finalCompact(enforceLessonGuideSlideBudget(practiceSlide), 136) as SacrintPracticeSlide;
  const safePracticeTitle =
    rawBudgetedPractice.title && !GENERIC_TITLE_BLACKLIST_RE.test(rawBudgetedPractice.title.trim())
      ? sanitizeMechanicalSlideCorruption(rawBudgetedPractice.title)
      : safeConceptTitle;

  const healedActivities = (rawBudgetedPractice.activities ?? []).map((act, idx) => {
    let stmt = ensureActivityClosure(sanitizeMechanicalSlideCorruption(act.statement));
    let hint = act.hint ? sanitizeMechanicalSlideCorruption(act.hint) : '';
    if (hint && hasSlideIntegrityDefect(hint)) {
      const preHint = sanitizeMechanicalSlideCorruption(slideActivities[idx]?.hint);
      hint = preHint && !hasSlideIntegrityDefect(preHint) ? preHint : '';
    }
    if (hasSlideIntegrityDefect(stmt)) {
      const preStmt = ensureActivityClosure(sanitizeMechanicalSlideCorruption(slideActivities[idx]?.statement));
      if (preStmt && !hasSlideIntegrityDefect(preStmt)) stmt = preStmt;
    }
    let actCheck = validatePracticeActivity(stmt, hint || undefined, { strict: false });
    if (actCheck.rescuedStatement && !hasSlideIntegrityDefect(actCheck.rescuedStatement)) {
      stmt = ensureActivityClosure(actCheck.rescuedStatement);
      hint = actCheck.updatedHint ?? '';
      actCheck = validatePracticeActivity(stmt, hint || undefined, { strict: false });
    }
    if (!actCheck.valid) {
      const preCandidate = ensureActivityClosure(sanitizeMechanicalSlideCorruption(slideActivities[idx]?.statement));
      const preHint = sanitizeMechanicalSlideCorruption(slideActivities[idx]?.hint);
      const preCheck = validatePracticeActivity(preCandidate, preHint || undefined, { strict: false });
      if (preCheck.valid && !hasSlideIntegrityDefect(preCheck.rescuedStatement ?? preCandidate)) {
        stmt = ensureActivityClosure(preCheck.rescuedStatement ?? preCandidate);
        hint = preCheck.rescuedStatement ? (preCheck.updatedHint ?? '') : preHint;
        actCheck = { valid: true };
      }
    }
    if (!actCheck.valid) {
      const rawEnunciado = ensureActivityClosure(
        sanitizeMechanicalSlideCorruption(cleanSacrintText(session.practica?.[idx]?.enunciado || ''))
      );
      const rawPista = sanitizeMechanicalSlideCorruption(cleanSacrintText(session.practica?.[idx]?.pista || ''));
      const rawCheck = validatePracticeActivity(rawEnunciado, rawPista || undefined, { strict: false });
      if (rawCheck.valid && !hasSlideIntegrityDefect(rawCheck.rescuedStatement ?? rawEnunciado)) {
        stmt = ensureActivityClosure(rawCheck.rescuedStatement ?? rawEnunciado);
        hint = rawCheck.rescuedStatement ? (rawCheck.updatedHint ?? '') : rawPista;
        actCheck = { valid: true };
      }
    }
    if (!actCheck.valid || hasSlideIntegrityDefect(stmt)) {
      const cleanBase = !hasSlideIntegrityDefect(stmt) && stmt.length >= 16
        ? stmt.replace(/[.!?]+$/, '').trim()
        : `Situación práctica sobre ${safePracticeTitle.toLowerCase()}`;
      stmt = ensureActivityClosure(
        `${cleanBase}. Analiza los datos planteados y redacta tu procedimiento y conclusión justificada.`
      );
    }
    return {
      ...act,
      statement: stmt,
      hint,
    };
  });

  const healedObjectiveBullets = (rawBudgetedPractice.objectiveBullets ?? [])
    .map((obj) => {
      const cleanedObj = sanitizeMechanicalSlideCorruption(obj);
      const validObj =
        cleanedObj && !INCOHERENT_APLICAR_PREFIX_RE.test(cleanedObj)
          ? normalizeLearningObjective(cleanedObj, { title: safePracticeTitle, strict: false })
          : null;
      if (validObj && !INCOHERENT_APLICAR_PREFIX_RE.test(validObj)) return validObj;
      const fallbackFromValidated =
        validatedObjective && !INCOHERENT_APLICAR_PREFIX_RE.test(validatedObjective)
          ? normalizeLearningObjective(validatedObjective, { title: safePracticeTitle, maxWords: 15, strict: false })
          : null;
      if (fallbackFromValidated && !INCOHERENT_APLICAR_PREFIX_RE.test(fallbackFromValidated)) return fallbackFromValidated;
      return (
        normalizeLearningObjective(
          `Analizar los criterios de ${safePracticeTitle.toLowerCase()} en situaciones reales del entorno.`,
          { title: safePracticeTitle, maxWords: 15, strict: false }
        ) || 'Analizar los conceptos centrales de la sesión y fundamentar su aplicación práctica.'
      );
    })
    .filter(Boolean);

  const safeAppText = sanitizeMechanicalSlideCorruption(rawBudgetedPractice.applicationText);
  const safeArtStep = sanitizeMechanicalSlideCorruption(rawBudgetedPractice.artifactStep);
  const budgetedPractice: SacrintPracticeSlide = {
    ...rawBudgetedPractice,
    title: safePracticeTitle,
    activities: healedActivities,
    objectiveBullets: healedObjectiveBullets,
    applicationText:
      safeAppText && !hasSlideIntegrityDefect(safeAppText)
        ? safeAppText
        : !hasSlideIntegrityDefect(guardedApplicationText)
          ? sanitizeMechanicalSlideCorruption(guardedApplicationText)
          : `Aplica ${safePracticeTitle.toLowerCase()} en una situación real de tu entorno y registra tus conclusiones.`,
    artifactStep:
      safeArtStep && !hasSlideIntegrityDefect(safeArtStep)
        ? safeArtStep
        : !hasSlideIntegrityDefect(safeArtifactStep)
          ? sanitizeMechanicalSlideCorruption(safeArtifactStep)
          : `Integra los resultados validados de esta sesión en ${(rawBudgetedPractice.artifactName || artifactName).replace(/\.+$/, '')}.`,
  };
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
  const compactPaecCoverLabel = (raw: string): string => {
    let clean = paraphraseSixGramOverlap(
      preventSixGramTheoryOverlap(sanitizePedagogicalMetaPhrases(raw), workbookTheorySources),
      workbookTheorySources
    );
    const clauseCut = clean.match(
      /^(.{20,85}?)(?:,\s*(?:derivad[oa]\s+de|orientad[oa]\s+a|enfocad[oa]\s+en|vinculad[oa]\s+a|causad[oa]\s+por|originad[oa]\s+por|con\s+el\s+(?:fin|prop[oó]sito)\s+de|mediante|lo\s+cual|que\s+(?:afecta|impacta|limita|genera))\b)/i
    );
    if (clauseCut && clauseCut[1] && !hasDanglingEnding(clauseCut[1])) {
      clean = clauseCut[1].replace(/[.,;:\s]+$/, '').trim();
    }
    return clean;
  };
  const rawCoverFooter = meta.paecProjectName
    ? `PAEC: ${
        mode === 'lesson-guide'
          ? compactPaecCoverLabel(meta.paecProjectName)
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

  const stripCoverMissionScaffolding = (raw: string): string => {
    const cleaned = raw
      .replace(/^(?:Fundamentaci[oó]n\s+y\s+Activaci[oó]n|Desarrollo\s+y\s+Aplicaci[oó]n|Cierre\s+y\s+S[ií]ntesis|Consolidaci[oó]n\s+y\s+Evaluaci[oó]n|An[aá]lisis\s+y\s+Modelizaci[oó]n|Transferencia\s+y\s+Cierre)\s*[—–\-:]\s*/i, '')
      .replace(/\s*\((?:Ciencias\s+Naturales[^)]*|Ciencias\s+Sociales[^)]*|Pensamiento\s+Matem[aá]tico[^)]*|Lengua\s+y\s+Comunicaci[oó]n[^)]*|Cultura\s+Digital[^)]*|Humanidades[^)]*)\)/gi, '')
      .replace(/(?:^|\s*[—–\-:]\s*)Sesi[oó]n\s+\d+\s*:[^—–\n]+(?=\s*[—–\-]|$)/gi, '')
      .replace(/^\s*[—–\-:]\s*/, '')
      .replace(/^(?:Exploraci[oó]n\s+Diagn[oó]stica(?:\s+y\s+Problematizaci[oó]n\s+Situada)?|Problematizaci[oó]n\s+Situada|Conceptualizaci[oó]n\s+y\s+Modelado|Aplicaci[oó]n\s+y\s+Transferencia|Evaluaci[oó]n\s+e\s+Integraci[oó]n)\s*[—–\-:]\s*/i, '')
      .replace(/^Sesi[oó]n\s+\d+\s*:\s*/i, '')
      .replace(/\s*[—–\-:]\s*Sesi[oó]n\s+\d+\s*$/i, '')
      .replace(/\s*[—–\-]\s*[—–\-]\s*/g, ' — ')
      .replace(/^\s*[—–\-:]\s*|\s*[—–\-:]\s*$/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    return cleaned.length >= 12 ? cleaned : raw.trim();
  };

  const rawCoverTitle =
    mode === 'lesson-guide'
      ? paraphraseSixGramOverlap(
          preventSixGramTheoryOverlap(
            stripCoverMissionScaffolding(meta.missionTitle),
            workbookTheorySources
          ),
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
      ? paraphraseSixGramOverlap(
          preventSixGramTheoryOverlap(
            sanitizePedagogicalMetaPhrases(stripCoverMissionScaffolding(coverSubtitleCleanRaw)),
            workbookTheorySources
          ),
          workbookTheorySources
        )
      : coverSubtitleCleanRaw;

  const coverSubjectLabel =
    mode === 'lesson-guide' && meta.subjectName.length > 48 && /\.\s+/.test(meta.subjectName)
      ? meta.subjectName.split(/\.\s+/)[0]!.trim()
      : meta.subjectName;

  const cover: SacrintCoverSlide = {
    kind: 'cover',
    eyebrow: `MISIÓN ${String(meta.missionNumber).padStart(2, '0')} // ${pack.label.toLocaleUpperCase('es-MX')}`,
    title: coverTitle,
    subtitle: coverSubtitleFinal.toLowerCase() === coverTitle.toLowerCase() ? '' : coverSubtitleFinal,
    missionIndex: meta.missionNumber,
    metaLine: `${coverSubjectLabel} · SEMESTRE ${meta.semester} · BLOQUE ${meta.blockNumber}`,
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

const isValidInfographicStepBody = (text: string): boolean => {
  const clean = text.trim();
  if (clean.length < 12) return false;
  if (NUMERIC_ONLY_STEP_RE.test(clean)) return false;
  if (/:\s*\d+\.\s*$/.test(clean)) return false;
  if (TEMPLATE_PHRASE_RE.test(clean)) return false;
  if (GENERIC_CONCLUSION_RE.test(clean)) return false;
  if (isRubricOrBoilerplateLeak(clean) || hasDanglingEnding(clean)) return false;
  const alphaWords = clean.match(/[A-Za-zÁÉÍÓÚÑáéíóúñ]{2,}/g) ?? [];
  return /[=≈]/.test(clean) ? alphaWords.length >= 1 : alphaWords.length >= 3;
};

export function buildSteps(
  mission: MissionSection,
  pack: SacrintPack,
  selectedSession?: SessionPlan
): SacrintInfographicStep[] {
  const solved = (mission.conceptZero?.solvedExample?.solutionSteps ?? [])
    .map((s) => stripTemplateLabels(distillStepPreservingMath(s, 200)))
    .filter(isValidInfographicStepBody);
  const sessionWorked = selectedSession ? extractWorkedExample(mission, selectedSession) : undefined;
  const sessionExample = (sessionWorked?.steps ?? [])
    .map((s) => stripTemplateLabels(s))
    .filter(isValidInfographicStepBody);
  const effectiveSolved = sessionExample.length > 0 ? sessionExample : solved;
  // Aislamiento estricto por sesión: cuando se construye la infografía de una sesión específica,
  // NUNCA mezclar `mission.iDoSection?.stepByStepDemo` (que puede pertenecer a otra sesión/método de la misión).
  const demoSteps = selectedSession
    ? []
    : extractBulletSentences(mission.iDoSection?.stepByStepDemo, 4, 175)
        .map((step) => stripTemplateLabels(distillStepPreservingMath(step, 225)))
        .filter(isValidInfographicStepBody);
  const sessionConclusionStep =
    selectedSession && sessionWorked?.interpretation && sessionWorked.interpretation.length >= 20
      ? stripTemplateLabels(sanitizeField(sessionWorked.interpretation, '', 180, 28))
      : '';
  const sessionCriterionStep =
    selectedSession?.sintesisVisual?.mapaConceptual?.criterioDesarrollo
      ? stripTemplateLabels(sanitizeField(selectedSession.sintesisVisual.mapaConceptual.criterioDesarrollo, '', 180, 28))
      : '';
  const applicationStep = stripTemplateLabels(
    sanitizeField(
      selectedSession?.aplicacion || mission.youDoSection?.autonomousChallenge,
      '',
      220,
      34
    )
  );

  // Un manual de conceptos no debe rellenar "pasos" con la definición o la
  // motivación: eso produce repetición visual. Solo usa procedimientos reales
  // de la propia sesión y, si faltan pasos, cierra con la verificación/criterio o aplicación de esa sesión.
  const source = selectedSession
    ? [...effectiveSolved, sessionConclusionStep, sessionCriterionStep, applicationStep]
    : effectiveSolved.length >= 3
      ? [...effectiveSolved, applicationStep, ...demoSteps]
      : [...effectiveSolved, ...demoSteps, applicationStep];
  const orderedSource = source
    .map((item) => stripTemplateLabels(distillStepPreservingMath(item, 225)))
    .filter(
      (item, index, items) =>
        isValidInfographicStepBody(item) &&
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
    body,
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

    const keptSentences = splitSpanishSentences(rewritten)
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

  const deOverlappedClaim = deOverlapField(spec.claim, spec.applicationSummary || spec.title);
  spec.claim = hasSpanishPredicateVerb(deOverlappedClaim)
    ? deOverlappedClaim
    : hasSpanishPredicateVerb(spec.claim)
      ? spec.claim
      : `${deOverlappedClaim.replace(/[.!?]+$/, '')} constituye un concepto clave de esta sesión.`;
  const normalizedClaimForDedup = spec.claim.toLowerCase().replace(/[^a-z0-9áéíóúñ]+/gi, ' ').trim();
  if (spec.conceptManual) {
    const rawDefinitions = spec.conceptManual.definitions
      .map((definition) => ({
        term: deOverlapField(definition.term),
        definition: deOverlapField(
          definition.definition,
          spec.applicationSummary || spec.claim || definition.term
        ),
      }))
      .filter((definition) => Boolean(definition.definition.trim()));
    const dedupedDefinitions = rawDefinitions.filter((definition, idx) => {
      const defNorm = definition.definition.toLowerCase().replace(/[^a-z0-9áéíóúñ]+/gi, ' ').trim();
      if (!defNorm) return false;
      if (rawDefinitions.length > 1 && defNorm === normalizedClaimForDedup) return false;
      return !rawDefinitions
        .slice(0, idx)
        .some((prev) => prev.definition.toLowerCase().replace(/[^a-z0-9áéíóúñ]+/gi, ' ').trim() === defNorm);
    });
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
      definitions: dedupedDefinitions.length > 0 ? dedupedDefinitions : rawDefinitions.slice(0, 1),
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
    paraphraseSixGramOverlap(
      preventSixGramTheoryOverlap(sanitizePedagogicalMetaPhrases(value), infographicSources),
      infographicSources
    ).replace(/\bpara\s+dentro\s+de\s+/gi, 'en ').replace(/\bdentro\s+de\s+/gi, 'en ');

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
  const rawCleanTitle = stripLeadingSessionTag(sanitizePedagogicalMetaPhrases(topicTitle || meta.missionTitle));
  const cleanTitle =
    /^Ciencia\s+experimental\s+como\b/i.test(rawCleanTitle) &&
    /\bdensidad\b/i.test(visualSynthesis?.conceptoBreve || conceptHighlights.definition || '') &&
    /(?:ρ|rho)\s*=\s*m\s*\/\s*V/i.test(visualSynthesis?.formulaOReglaClave || '')
      ? 'Ciencia experimental: propiedades de la materia y densidad'
      : rawCleanTitle;
  const isQuantitative =
    pack.id === 'matematicas' || pack.id === 'fisica' || pack.id === 'quimica';
  misconceptionFix = alignMisconceptionWithTitle(cleanTitle, misconceptionFix, isQuantitative);
  if (isWeakMisconceptionText(visualMisconceptionError, cleanTitle)) {
    visualMisconceptionError = misconceptionFix.error;
    visualMisconceptionCorrection = misconceptionFix.correction;
  }
  const rawVisualClaim = sanitizePedagogicalMetaPhrases(cleanSacrintText(visualSynthesis?.conceptoBreve));
  const visualClaim = rawVisualClaim && hasSpanishPredicateVerb(rawVisualClaim) ? rawVisualClaim : '';
  const rawClaimBase = deOverlap(
    visualClaim ||
      cleanMissionTopicLine(
        conceptHighlights.definition || mission.sessionFocus || mission.sessionTopic || bundle?.concepts.definition,
        conceptHighlights.definition || meta.missionTitle
      )
  );
  const rawClaimCandidate = hasSpanishPredicateVerb(rawClaimBase)
    ? rawClaimBase
    : bundle?.concepts.definition && hasSpanishPredicateVerb(bundle.concepts.definition)
      ? deOverlap(bundle.concepts.definition)
      : `${rawClaimBase.replace(/[.!?]+$/, '')} constituye un concepto clave de esta sesión.`;
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

  const infoPreferredExampleText = [
    visualSynthesis?.formulaOReglaClave,
    quickExample.problemStatement,
    ...quickExample.steps,
    quickExample.interpretation,
  ]
    .filter(Boolean)
    .join(' ');
  const sessionDiagram = selectedSession
    ? buildSacrintDiagram(mission, pack, {
        ...options,
        session: selectedSession,
        allowMissionFallback: false,
        preferredExampleText: infoPreferredExampleText.length >= 16 ? infoPreferredExampleText : undefined,
        theorySources: infographicSources,
      })
    : undefined;
  const candidateDiagram =
    sessionDiagram?.available
      ? sessionDiagram
      : buildSacrintDiagram(mission, pack, {
          ...options,
          session: selectedSession,
          allowMissionFallback: false,
          preferredExampleText: infoPreferredExampleText.length >= 16 ? infoPreferredExampleText : undefined,
          theorySources: infographicSources,
        });
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
  const selectedFormula = selectCoherentFormula(cleanTitle, formulaCandidates);
  const formula = selectedFormula.replace(
    /^(cm|mm|km|m|kg|g|ml|l|s|h)(\s*=)/i,
    (_match, sym: string, eq: string) =>
      `${sym === 'M' ? 'Monto' : sym === 'm' ? 'Pendiente' : `Valor_${sym}`}${eq}`
  );
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
  const rawSteps = buildSteps(mission, pack, selectedSession).map((step) => ({
    ...step,
    title: finalizeVisibleText(deOverlap(sanitizePedagogicalMetaPhrases(step.title)), {
      ensurePeriod: false,
    }),
    body: finalizeVisibleText(deOverlap(step.body), { ensurePeriod: true }),
  }));
  // Cuando el diagrama visual ocupa la columna izquierda, la caja MINI-EJEMPLO RESUELTO no se dibuja;
  // si el paso 01 arranca directo con números resueltos sin contexto ("36 + 64 = 100"), anteponer el caso breve.
  const firstStepNeedsSetup =
    sanitizedDiagram.available &&
    rawSteps.length > 0 &&
    /\d/.test(rawSteps[0].body) &&
    quickExample.problemStatement.trim().length >= 24 &&
    !rawSteps[0].body.toLowerCase().includes(quickExample.problemStatement.toLowerCase().slice(0, 18));
  const steps = firstStepNeedsSetup
    ? [
        {
          number: 1,
          title: rawSteps[0].title,
          body: finalizeVisibleText(
            deOverlap(
              fitPedagogicalText(quickExample.problemStatement, {
                maxChars: 140,
                maxWords: 22,
                role: 'problem',
              }) || quickExample.problemStatement
            ),
            { ensurePeriod: true }
          ),
        },
        ...rawSteps.slice(0, 3).map((step, idx) => ({
          ...step,
          number: idx + 2,
          title: idx === 0 ? 'EL DESARROLLO' : idx === 1 ? 'EL RESULTADO' : 'LA VERIFICACIÓN',
        })),
      ]
    : rawSteps;

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
