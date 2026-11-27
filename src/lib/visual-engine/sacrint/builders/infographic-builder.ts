import type { ActiveWorkTextbook, MissionSection, SessionPlan } from '@/types/work-textbook';
import { finalizeVisibleText, fitPedagogicalText } from '@/lib/editorial/fitter/text-compactor';
import { hasDanglingEnding } from '@/lib/editorial/fitter/dangling-guards';
import { splitSpanishSentences } from '@/lib/editorial/fitter/sentence-splitter';
import {
  isValidRenderableFormula,
  normalizeEditorialText,
  normalizeSessionDescriptorTense,
} from '@/lib/editorial/text-normalization';
import {
  isEvaluationOrClosureObjective,
  isPaecProjectOrArtifactTitle,
  resolveInfographicConceptTitle,
} from '@/lib/editorial/topic-title-resolver';
import { resolveSacrintPack, type SacrintPack } from '../discipline-packs';
import { resolveSacrintStyle } from '../visual-styles';
import { resolveSacrintInfographicEditorialScene } from '../../scene-allocator';
import type {
  ConceptManualDefinition,
  ConceptMapNode,
  SacrintBuildOptions,
  SacrintDiagramSpec,
  SacrintInfographicFormat,
  SacrintInfographicSpec,
  SacrintInfographicStep,
  SacrintInfographicTarget,
  SacrintRubricItem,
} from '../types';
import {
  cleanSacrintText,
  GENERIC_CONCLUSION_RE,
  isRubricOrBoilerplateLeak,
  NUMERIC_ONLY_STEP_RE,
  sanitizePedagogicalMetaPhrases,
  stripTemplateLabels,
  TEMPLATE_PHRASE_RE,
} from '../text/grammar-normalization';
import {
  paraphraseSixGramOverlap,
  preventSixGramTheoryOverlap,
  sixGramOverlapRatio,
} from '../text/six-gram-overlap';
import {
  cleanMissionTopicLine,
  extractBulletSentences,
} from '../text/objective-and-activity-guards';
import { distillStepPreservingMath } from '../distiller/formula-and-steps';
import { distillLessonBundle } from '../distiller/lesson-bundle';
import { extractConceptHighlights } from '../distiller/summary-and-concepts';
import { extractWorkedExample } from '../distiller/worked-example';
import {
  buildDiagramVariables,
  buildSacrintDiagram,
  diagramFormula,
  stepLabelsForPack,
} from '../diagrams/registry';
import {
  alignMisconceptionWithTitle,
  conceptFamily,
  isFormulaCoherentWithTitle,
  isWeakMisconceptionText,
  neutralizeAngleCongruenceTerms,
  selectCoherentFormula,
} from './content-integrity';
import { hasSpanishPredicateVerb } from './slide-budget';
import {
  baseFacts,
  collectWorkbookTheorySources,
  missionMeta,
  resolveMissionMisconceptionParts,
  resolveSessionPlans,
  sanitizeField,
  selectMission,
  stripLeadingSessionTag,
} from './shared-helpers';

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

export function buildRubric(workbook: ActiveWorkTextbook): SacrintRubricItem[] {
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

  const editorialScene = resolveSacrintInfographicEditorialScene(meta.subjectName, meta.blockNumber, {
    missionIndex:
      typeof options.missionIndex === 'number'
        ? Math.max(0, options.missionIndex)
        : Math.max(0, (meta.missionNumber || 1) - 1),
    fileExists: options.sceneFileExists,
    readDataUri: options.sceneReadDataUri,
  });

  const spec: SacrintInfographicSpec = {
    format,
    theme: options.theme ?? 'light',
    meta,
    pack,
    style: resolveSacrintStyle(pack.id),
    ...(editorialScene ? { editorialScene } : {}),
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
