import type { MissionSection, SessionPlan } from '@/types/work-textbook';
import { fitPedagogicalText } from '@/lib/editorial/fitter/text-compactor';
import { hasDanglingEnding } from '@/lib/editorial/fitter/dangling-guards';
import { resolveChalkboardTopicTitle } from '@/lib/editorial/topic-title-resolver';
import type {
  DistilledLessonBundle,
  DistilledPracticeActivity,
  DistillOptions,
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
} from '../text/six-gram-overlap';
import {
  distillConciseText,
  extractBulletSentences,
  extractCleanTopicTitle,
  normalizeLearningObjective,
  pickCompleteSentences,
  validatePracticeActivity,
} from '../text/objective-and-activity-guards';
import {
  cleanStepLine,
  distillExerciseStatement,
} from './formula-and-steps';
import {
  deriveRepeatedTopicLead,
  extractConceptHighlights,
  stripSessionLeadPrefix,
} from './summary-and-concepts';
import { extractWorkedExample } from './worked-example';

/**
 * Extrae las actividades prácticas del libro (enunciado + pista pedagógica) sin exponer `solucion`.
 */
export function extractPracticeActivities(
  mission: MissionSection,
  session?: SessionPlan,
  options: DistillOptions = {}
): DistilledPracticeActivity[] {
    const allowMission = options.allowMissionFallback ?? true;
    const topicLead = deriveRepeatedTopicLead(session);
    const theorySources = (options.extraTheorySources ?? []).filter(
      (source): source is string => typeof source === 'string' && source.trim().length > 0
    );
    const stmtMax = allowMission ? 235 : 360;
    const stmtWords = allowMission ? undefined : 70;
    const hintMax = allowMission ? 135 : 108;
    const hintWords = allowMission ? undefined : 18;
    const maxItems = allowMission ? 3 : 2;
    const seenHints = new Set<string>();
    const fromSession = (session?.practica ?? [])
      .filter((item) => cleanSacrintText(stripSessionLeadPrefix(item.enunciado, topicLead)).length >= 10 && !isRubricOrBoilerplateLeak(item.enunciado))
      .slice(0, maxItems)
      .map((item, idx) => {
        const cleanStmt = distillExerciseStatement(stripSessionLeadPrefix(item.enunciado, topicLead), stmtMax, stmtWords);
        // El enunciado ya fue destilado preservando datos + consigna. No se
        // vuelve a recortar por 6-gramas: eso eliminaba la oración de datos.
        const presentationStmt = cleanStmt;
      const rawHint = cleanSacrintText(stripSessionLeadPrefix(item.pista, topicLead));
      const isPureQuestionTitle = /^¿[^?.!]{3,58}\?$/i.test(rawHint) && rawHint.split(/\s+/).length <= 8;
      const isSameAsLead = Boolean(topicLead && rawHint.toLowerCase().replace(/[.:]+$/, '') === topicLead.toLowerCase().replace(/[.:]+$/, ''));
      let fittedHint =
        !rawHint || isPureQuestionTitle || isSameAsLead
          ? ''
          : fitPedagogicalText(sanitizePedagogicalMetaPhrases(rawHint), {
              maxChars: hintMax,
              maxWords: hintWords,
              role: 'hint',
            });
      const isWeakHint = Boolean(
        !fittedHint ||
          /^(?:luego,\s*)?(?:plantea|resuelve|calcula|aplica|usa|utiliza)\s+(?:una\s+)?(?:ecuaci[oó]n|f[oó]rmula|procedimiento|m[eé]todo)\.?$/i.test(
            fittedHint
          )
      );
      const normHint = fittedHint.toLowerCase().replace(/[^a-záéíóúñ0-9]+/gi, ' ').trim();
      const isDuplicateHint = Boolean(normHint && [...seenHints].some((prev) => prev === normHint || prev.startsWith(normHint.slice(0, 32)) || normHint.startsWith(prev.slice(0, 32))));
      if (isDuplicateHint || isWeakHint) {
        const firstStep = cleanStepLine(item.solucion?.[0] || '')
          .replace(/\b=\s*[-+0-9.,]+(?:\s*(?:m|cm|km|%|pesos|años|horas|sillas|grados|°))?/gi, '')
          .trim();
        const altHint = firstStep && firstStep.length >= 18 && !/\brespuesta\b/i.test(firstStep)
          ? fitPedagogicalText(`Inicia por: ${firstStep}`, { maxChars: hintMax, maxWords: hintWords, role: 'hint' })
          : '';
        fittedHint = altHint && altHint.toLowerCase() !== fittedHint.toLowerCase() ? altHint : '';
      }
      if (fittedHint) {
        seenHints.add(fittedHint.toLowerCase().replace(/[^a-záéíóúñ0-9]+/gi, ' ').trim());
      }
        const validation = validatePracticeActivity(presentationStmt, fittedHint, {
          sessionNumber: session?.sessionNumber ?? null,
          field: `activities[${idx}]`,
          strict: false,
        });
        const finalStmt = validation.rescuedStatement ?? presentationStmt;
        const finalHint =
          validation.updatedHint !== undefined
            ? validation.updatedHint
            : fittedHint || 'Apóyate en el ejemplo trabajado en clase.';
        return {
          label: `Actividad ${idx + 1}`,
          statement: finalStmt,
          hint: finalHint,
        };
    });

  if (fromSession.length > 0) return fromSession;

  if (!allowMission) {
    return [];
  }

  const guided = cleanSacrintText(mission.weDoSection?.guidedPractice);
  if (guided && !isRubricOrBoilerplateLeak(guided)) {
    const points = extractBulletSentences(guided, 3, 185);
      return points.map((pt, idx) => ({
        label: `Actividad ${idx + 1}`,
        statement: enforceSixGramOverlap(pt, theorySources, 0.12, 'problem') || pt,
        hint:
        distillConciseText(mission.conceptZero?.contrastTable?.[0]?.reasoning, 140, 24) ||
        'Contrasta el procedimiento con el ejemplo modelado antes de concluir.',
    }));
  }

  const autonomous = cleanSacrintText(mission.youDoSection?.autonomousChallenge);
  return [
    {
      label: 'Actividad 1',
      statement:
        enforceSixGramOverlap(
          distillConciseText(autonomous, 195, 34) ||
            'Realiza en tu cuaderno una actividad de aplicación del tema vinculada con tu entorno.',
          theorySources,
          0.12,
          'problem'
        ) || 'Realiza una actividad de aplicación vinculada con tu entorno.',
      hint: 'Identifica la información relevante de la consigna antes de desarrollar el procedimiento.',
    },
  ];
}

/**
 * Extrae aplicación en la vida real, avance de producto e ítems de cierre/autoevaluación.
 */
export function extractApplicationAndExit(
  mission: MissionSection,
  session?: SessionPlan,
  options: DistillOptions = {}
): { application: string; artifactStep: string; exitChecks: string[] } {
  const allowMission = options.allowMissionFallback ?? true;
  const topicLead = deriveRepeatedTopicLead(session);
  const appMax = allowMission ? 200 : 124;
  const appWords = allowMission ? undefined : 20;
  const artMax = allowMission ? 165 : 108;
  const artWords = allowMission ? undefined : 16;
  const checkMax = allowMission ? 125 : 88;
  const checkWords = allowMission ? undefined : 14;

  const rawApp = (allowMission
    ? stripSessionLeadPrefix(session?.aplicacion, topicLead) ||
      mission.realLifeConnection?.householdApplication ||
      mission.realLifeConnection?.communityImpact ||
      mission.realLifeConnection?.context ||
      mission.sessionFocus
    : stripSessionLeadPrefix(session?.aplicacion, topicLead)
  )
    ?.replace(/\bUtiliza\s+tu\s+(?:\[\[?material:[^\]\s]+\]?\]?|matriz\s+de\s+comprobaci[oó]n|regla\s+(?:escolar\s+de\s+30\s*cm|graduada))\s+para\s+/gi, '')
    .replace(/\ben\s+la\s+rehabilitaci[oó]n\s+de\s+un\s+espacio\s+p[uú]blico\s+en\s+tu\s+localidad\s+de\s+Puebla,\s*asegurando\s+que\s+los\s+c[aá]lculos\s+de\s+costos\s+de\s+([^.]+)\s+sean\s+impecables\.?/gi, '($1) en tu localidad.')
    .replace(/,\s*verificando\s+mediante\s+factorizaci[oó]n\s+que\s+las\s+medidas\s+calculadas\s+correspondan[^.]*\.?/gi, '.')
    .replace(/^([a-záéíóúñ])/, (m) => m.toUpperCase());
  const cleanRawApp = sanitizePedagogicalMetaPhrases(cleanSacrintText(rawApp));
  let application =
    fitPedagogicalText(cleanRawApp, {
      maxChars: appMax,
      maxWords: appWords,
      role: 'application',
    }) ||
    (allowMission
      ? 'Vincula el aprendizaje con situaciones reales y decisiones cotidianas de tu comunidad.'
      : '');
  if (application && application.length < 44 && cleanRawApp.length >= 48) {
    const expandedApp = fitPedagogicalText(cleanRawApp, {
      maxChars: Math.max(appMax + 26, 150),
      maxWords: appWords ? appWords + 5 : 25,
      role: 'application',
    });
    if (expandedApp && expandedApp.length >= 44 && !hasDanglingEnding(expandedApp)) {
      application = expandedApp;
    }
  }
  if (application && application.length < 36) {
    application =
      fitPedagogicalText(
        `${application.replace(/[.!?]+$/, '')} y contrasta el resultado con una situación de tu entorno.`,
        { maxChars: appMax, maxWords: appWords, role: 'application' }
      ) || application;
  }

  const rawArtifact = allowMission
    ? stripSessionLeadPrefix(session?.productoIntegrador, topicLead) ||
      mission.youDoSection?.autonomousChallenge ||
      mission.formativeCheckpoint?.question
    : stripSessionLeadPrefix(session?.productoIntegrador, topicLead);
  const artifactStep =
    fitPedagogicalText(sanitizePedagogicalMetaPhrases(cleanSacrintText(rawArtifact)), {
      maxChars: artMax,
      maxWords: artWords,
      role: 'application',
    }) ||
    (allowMission
      ? 'Integra el procedimiento desarrollado y su conclusión con evidencia en la bitácora del bloque.'
      : '');

  const checksFromSession = (session?.autoevaluacion ?? [])
    .map((item) => sanitizePedagogicalMetaPhrases(cleanSacrintText(stripSessionLeadPrefix(item))))
    .filter((item) => item.length >= 8 && !isRubricOrBoilerplateLeak(item))
    .map((item) => distillConciseText(item, checkMax, checkWords ?? 18));

  const checksFromMission = allowMission
    ? [
        ...(mission.formativeCheckpoint?.criteriaChecklist ?? []),
        ...(mission.formativeCheckpoint?.reflectionPrompts ?? []),
      ]
        .map((item) => sanitizePedagogicalMetaPhrases(cleanSacrintText(item)))
        .filter((item) => item.length >= 8 && !isRubricOrBoilerplateLeak(item))
        .map((item) => distillConciseText(item, checkMax, checkWords ?? 18))
    : [];

  const exitChecks = (checksFromSession.length > 0 ? checksFromSession : checksFromMission).slice(
    0,
    allowMission ? 3 : 2
  );
  if (exitChecks.length === 0) {
    exitChecks.push(
      'Explico el concepto central y cuándo aplicarlo.',
      'Identifico datos clave de la consigna y valido la conclusión.'
    );
  }

  return { application, artifactStep, exitChecks };
}

function extractQuestionFromSession(session?: SessionPlan): string {
  const candidates = [session?.motivacion, session?.saberesPrevios, session?.objetivo]
    .map(cleanSacrintText)
    .filter(Boolean);
  for (const text of candidates) {
    const match = text.match(/¿[^?]{8,140}\?/);
    if (match) return distillConciseText(match[0], 96, 15);
  }
  return '';
}

/** Construye el paquete destilado completo de una clase/sesión específica dentro de una misión. */
export function distillLessonBundle(
  mission: MissionSection,
  session?: SessionPlan,
  options: DistillOptions = {}
): DistilledLessonBundle {
  const allowMission = options.allowMissionFallback ?? true;
  const sessionNumber = session?.sessionNumber ?? null;
  const fallbackSessionTitle = sessionNumber ? `Sesión ${sessionNumber}` : extractCleanTopicTitle(mission.title);
  const topicSource =
    session?.objetivo ||
    (allowMission ? mission.sessionTopic || mission.title : session?.contenido || fallbackSessionTitle);
  const topicTitle = session
    ? resolveChalkboardTopicTitle({
        conceptosClave: session.contenido,
        sessionObjective: session.objetivo,
        missionSessionTopic: allowMission ? mission.sessionTopic : null,
        missionFocus: allowMission ? mission.sessionFocus : null,
        missionTitle: allowMission ? mission.title : fallbackSessionTitle,
        maxChars: allowMission ? 68 : 52,
      })
    : extractCleanTopicTitle(
        mission.sessionTopic || mission.title,
        allowMission ? mission.sessionTopic || mission.title : fallbackSessionTitle
      );

  const topicLead = deriveRepeatedTopicLead(session);
  const rawObjectiveSource =
    !allowMission && session?.objetivo
      ? cleanSacrintText(stripSessionLeadPrefix(session.objetivo, topicLead))
      : stripSessionLeadPrefix(session?.objetivo, topicLead) || (allowMission ? topicSource : '');
  const normalizedObjective = normalizeLearningObjective(rawObjectiveSource, {
    title: topicTitle,
    maxWords: allowMission ? 24 : 15,
    sessionNumber,
    field: 'objective',
    strict: false,
  });
  const objectiveRaw = normalizedObjective || '';

  const actBudget = allowMission ? 185 : 88;
  const actWords = allowMission ? 32 : 13;
  const activationRaw =
    stripSessionLeadPrefix(session?.saberesPrevios, topicLead) ||
    stripSessionLeadPrefix(session?.motivacion, topicLead) ||
    (allowMission ? mission.phenomenonHook?.story : '');
  const activationBase =
    (allowMission
      ? ''
      : pickCompleteSentences(activationRaw, 140, 1) || distillConciseText(activationRaw, 140, 22)) ||
    distillConciseText(activationRaw, actBudget, actWords) ||
    (allowMission ? distillConciseText(mission.sessionFocus, 175, 30) : '');

  const sessionQuestion = extractQuestionFromSession(session);
  const rawQuestionBase =
    sessionQuestion ||
    (allowMission ? distillConciseText(mission.phenomenonHook?.detonatingQuestion, 150, 24) : '') ||
    `¿Cómo aplicar ${topicTitle.toLowerCase()} en esta sesión?`;
  const questionBase = allowMission
    ? rawQuestionBase
    : distillConciseText(rawQuestionBase, 115, 18) || rawQuestionBase;

  const concepts = extractConceptHighlights(mission, session, options);
  const example = extractWorkedExample(mission, session, options);
  const activities = extractPracticeActivities(mission, session, options);
  const { application, artifactStep, exitChecks } = extractApplicationAndExit(mission, session, options);

  if (!allowMission) {
    const theorySources = [
      session?.contenido,
      mission.conceptZero?.coreExplanation,
      mission.conceptZero?.narrativeExplanation,
      ...(options.extraTheorySources ?? []),
    ];
    const coreTheorySources = [
      session?.contenido,
      mission.conceptZero?.coreExplanation,
      mission.conceptZero?.narrativeExplanation,
    ].filter((source): source is string => Boolean(source));
    const cleanField = (text: string) =>
      preventSixGramTheoryOverlap(sanitizePedagogicalMetaPhrases(text), theorySources);
    const cleanApplication = (text: string) =>
      preventSixGramTheoryOverlap(sanitizePedagogicalMetaPhrases(text), coreTheorySources);
    const cleanPresentationField = (
      text: string,
      role: 'problem' | 'concept' | 'general' = 'concept'
    ) => enforceSixGramOverlap(text, theorySources, 0.12, role);
    return {
      sessionNumber,
      topicTitle: cleanField(topicTitle),
      objective: cleanField(objectiveRaw),
      activation: cleanField(activationBase),
      question: cleanField(questionBase),
      concepts: {
        definition: cleanPresentationField(concepts.definition, 'concept'),
        formulas: concepts.formulas,
        keyRules: concepts.keyRules.map(cleanField),
      },
      example: {
        // El enunciado, los pasos y la conclusión ya vienen destilados con datos completos;
        // para la conclusión se parafrasea sin descartar oraciones numéricas contra el propio ejemplo.
        problemStatement: example.problemStatement,
        steps: example.steps.map((step) => sanitizePedagogicalMetaPhrases(step)),
        interpretation: paraphraseSixGramOverlap(
          sanitizePedagogicalMetaPhrases(example.interpretation),
          theorySources
        ),
      },
      activities: activities.map((act) => ({
        ...act,
        // Las actividades ya pasaron por de-overlap seguro; se conserva la
        // consigna completa con sus datos.
        statement: act.statement,
        hint: cleanField(act.hint),
      })),
      application: cleanApplication(application),
      artifactStep: cleanField(artifactStep),
      exitChecks: exitChecks.map(cleanField),
    };
  }

  return {
    sessionNumber,
    topicTitle: sanitizePedagogicalMetaPhrases(topicTitle),
    objective: sanitizePedagogicalMetaPhrases(objectiveRaw),
    activation: sanitizePedagogicalMetaPhrases(activationBase),
    question: sanitizePedagogicalMetaPhrases(questionBase),
    concepts,
    example,
    activities,
    application: sanitizePedagogicalMetaPhrases(application),
    artifactStep: sanitizePedagogicalMetaPhrases(artifactStep),
    exitChecks: exitChecks.map((c) => sanitizePedagogicalMetaPhrases(c)),
  };
}


// ─── 7.1 — Six-gram overlap ratio (for infographic de-overlap check) ─────────
// El costo real estaba en re-tokenizar las mismas fuentes del libro para cada
// campo de cada lámina. Se cachea por cadena fuente individual y la unión por

