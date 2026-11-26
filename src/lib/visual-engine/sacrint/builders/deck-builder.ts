import type { ActiveWorkTextbook, MissionSection, SessionPlan } from '@/types/work-textbook';
import { finalizeVisibleText, fitPedagogicalText } from '@/lib/editorial/fitter/text-compactor';
import { hasDanglingEnding } from '@/lib/editorial/fitter/dangling-guards';
import {
  isValidRenderableFormula,
  normalizeEditorialText,
  normalizeSessionDescriptorTense,
} from '@/lib/editorial/text-normalization';
import {
  extractDisciplinaryConceptPhrase,
  GENERIC_TITLE_BLACKLIST_RE,
} from '@/lib/editorial/topic-title-resolver';
import { resolveSacrintPack, type SacrintPack } from '../discipline-packs';
import { resolveSacrintStyle } from '../visual-styles';
import { resolveSacrintDeckEditorialScenes } from '../../scene-allocator';
import {
  LessonGuideNoSessionsError,
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
  type SacrintHookSlide,
  type SacrintMissionMeta,
  type SacrintPracticeSlide,
  type SacrintSlide,
} from '../types';
import {
  cleanSacrintText,
  isRubricOrBoilerplateLeak,
  sanitizePedagogicalMetaPhrases,
} from '../text/grammar-normalization';
import {
  enforceSixGramOverlap,
  paraphraseSixGramOverlap,
  preventSixGramTheoryOverlap,
  sixGramOverlapRatio,
} from '../text/six-gram-overlap';
import {
  cleanMissionTopicLine,
  extractChalkboardTopicTitle,
  normalizeLearningObjective,
  validatePracticeActivity,
} from '../text/objective-and-activity-guards';
import { distillLessonBundle } from '../distiller/lesson-bundle';
import { extractConceptHighlights } from '../distiller/summary-and-concepts';
import { extractWorkedExample } from '../distiller/worked-example';
import {
  buildDiagramVariables,
  buildSacrintDiagram,
  diagramFormula,
  diagramSubtitle,
} from '../diagrams/registry';
import {
  alignMisconceptionWithTitle,
  diversifyRepeatedMisconception,
} from './content-integrity';
import {
  compactEvaluationCriterion,
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
} from './slide-budget';
import { finalCompact } from './slide-final-compactor';
import { buildRubric } from './infographic-builder';
import {
  baseFacts,
  cleanSlideTitle,
  collectWorkbookTheorySources,
  firstSentence,
  missionMeta,
  resolveMissionMisconception,
  resolveMissionMisconceptionParts,
  resolveSessionPlans,
  sanitizeField,
  selectMission,
  splitLabeledItems,
  stripLeadingSessionTag,
} from './shared-helpers';

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

  const deckScenes = resolveSacrintDeckEditorialScenes(meta.subjectName, meta.blockNumber);
  const hasDeckScenes = Boolean(deckScenes.hero || deckScenes.concept);

  return {
    meta,
    pack,
    style: resolveSacrintStyle(pack.id),
    mode,
    theme: options.theme ?? 'dark',
    ...(hasDeckScenes
      ? {
          editorialScenes: {
            ...(deckScenes.hero ? { hero: deckScenes.hero } : {}),
            ...(deckScenes.concept ? { concept: deckScenes.concept } : {}),
          },
        }
      : {}),
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
