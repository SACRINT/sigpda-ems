import type { MissionSection, SessionPlan } from '@/types/work-textbook';
import { parseEjemploResuelto } from '@/lib/editorial/student-content-model';
import { fitPedagogicalText } from '@/lib/editorial/fitter/text-compactor';
import { hasDanglingEnding } from '@/lib/editorial/fitter/dangling-guards';
import { splitSpanishSentences } from '@/lib/editorial/fitter/sentence-splitter';
import type { DistilledExample, DistillOptions } from '../types';
import {
  cleanSacrintText,
  cleanSacrintTextPreservingLines,
  isRubricOrBoilerplateLeak,
  NUMERIC_ONLY_STEP_RE,
  ORPHAN_LIST_END_RE,
  sanitizePedagogicalMetaPhrases,
  stripTemplateLabels,
  TEMPLATE_PHRASE_RE,
} from '../text/grammar-normalization';
import {
  distillConciseText,
  extractBulletSentences,
  extractCleanTopicTitle,
} from '../text/objective-and-activity-guards';
import {
  cleanStepLine,
  distillExerciseStatement,
  distillProblemOrExerciseText,
  distillStepPreservingMath,
  extractCompleteEquations,
  simplifyNumericEqualsChains,
} from './formula-and-steps';
import {
  CONCLUSION_HEADING_PREFIX_RE,
  deriveRepeatedTopicLead,
  extractExampleConclusion,
  extractExplicitConclusionBody,
  isCompleteConclusion,
  isCompleteMathStep,
  isCompleteProblemStatement,
  isSubstantiveConclusion,
  isSubstantiveStep,
  stripSessionLeadPrefix,
  SYNTHETIC_PARSER_STEP_RE,
} from './summary-and-concepts';

interface ExampleBudgets {
  stmtBudget: number;
  stmtWords?: number;
  stepBudget: number;
  stepWords?: number;
  interpBudget: number;
  interpWords?: number;
}

/**
 * Construye un ejemplo resuelto desde la práctica de la sesión cuando el ejemplo original
 * está incompleto. Prefiere ejercicios que no se muestran como actividad (índice >= 2) para
 * no duplicar la consigna. Solo devuelve un ejemplo con enunciado completo, >= 2 pasos
 * matemáticos completos y conclusión con resultado; si no, null.
 */
function buildExampleFromPractice(
  session: SessionPlan | undefined,
  topicLead: string,
  b: ExampleBudgets
): DistilledExample | null {
  const items = session?.practica ?? [];
  if (items.length === 0) return null;
  const order = [...items.keys()].sort((a, c) => {
    const aShown = a < 2 ? 1 : 0;
    const cShown = c < 2 ? 1 : 0;
    return aShown - cShown || a - c;
  });
  for (const idx of order) {
    const item = items[idx]!;
    const solution = (item.solucion ?? []).map(cleanStepLine).filter((l) => l.length >= 8);
    if (solution.length < 2) continue;
    const statement = distillExerciseStatement(stripSessionLeadPrefix(item.enunciado, topicLead), b.stmtBudget, b.stmtWords);
    if (!isCompleteProblemStatement(statement)) continue;
    const mathSteps = solution
      .map((l) => distillStepPreservingMath(l, b.stepBudget, b.stepWords))
      .filter(Boolean)
      .filter((l) => isSubstantiveStep(l) && isCompleteMathStep(l));
    if (mathSteps.length < 2) continue;
    const conclusionRaw = [...solution]
      .reverse()
      .map((l) =>
        fitPedagogicalText(simplifyNumericEqualsChains(l.replace(CONCLUSION_HEADING_PREFIX_RE, '').trim()), {
          maxChars: b.interpBudget,
          maxWords: b.interpWords,
          role: 'conclusion',
        })
      )
      .find((c) => isSubstantiveConclusion(c) && isCompleteConclusion(c));
    if (!conclusionRaw) continue;
    return {
      problemStatement: statement,
      steps: mathSteps.slice(0, 3),
      interpretation: conclusionRaw,
    };
  }
  return null;
}

function buildCompleteSlideProblemStatement(
  raw: string | null | undefined,
  topicLead: string,
  stmtBudget: number,
  stmtWords?: number
): string {
  const clean = stripSessionLeadPrefix(cleanSacrintText(raw), topicLead);
  if (!clean) return '';
  const hasData = /\d|\$|pesos|m\b|cm\b/i.test(clean);
  const finalize = (candidate: string): string =>
    candidate && (!hasData || /\d|\$|pesos|m\b|cm\b/i.test(candidate))
      ? candidate
      : clean;
  const sentences = splitSpanishSentences(clean).filter((sentence) => sentence.trim().length >= 18);
  const isTask = (sentence: string) =>
    /\?/.test(sentence) ||
    /\b(?:calcula|determina|encuentra|halla|resuelve|modela|plantea|formula|indica|escribe|obt[eé]n|verifica|comprueba|justifica|identifica)\b/i.test(
      sentence
    );
  const taskSentence = sentences.find((sentence) => isTask(sentence) && /\d|\$|pesos|m\b|cm\b/i.test(sentence));
  if (taskSentence) {
    return finalize(distillProblemOrExerciseText(taskSentence, stmtBudget, stmtWords));
  }

  const dataSentence = [...sentences]
    .reverse()
    .find((sentence) => /\d|\$|pesos|m\b|cm\b/i.test(sentence) && sentence !== taskSentence);
  const taskWithoutData = sentences.find(isTask);
  if (taskWithoutData && dataSentence) {
    return finalize(
      distillProblemOrExerciseText(`${dataSentence} ${taskWithoutData}`, stmtBudget, stmtWords)
    );
  }

  return finalize(distillProblemOrExerciseText(clean, stmtBudget, stmtWords));
}

/**
 * Extrae el ejemplo resuelto con pasos reales evitando fugas de rúbrica y mensajes vacíos.
 */
function deriveInlineExampleSteps(raw: string): string[] {
  const clauses = raw
    .replace(/^(?:ejemplo|planteamiento|problema|soluci[oó]n)\s*:\s*/i, '')
    .split(
      /(?<=[.;:])\s+|,\s+(?=(?:resta|suma|multiplica|divide|despeja|sustituye|obt[eé]n|calcula|iguala|factoriza|aplica|usa|convierte|eleva)\b)|\s+y\s+(?=(?:obt[eé]n|divide|multiplica|suma|resta|despeja|sustituye)\b)/i
    )
    .map((clause) => cleanStepLine(clause))
    .filter((clause) => clause.length >= 8 && /=/.test(clause) && isCompleteMathStep(clause));
  return clauses.slice(0, 3);
}

export function extractWorkedExample(
  mission: MissionSection,
  session?: SessionPlan,
  options: DistillOptions = {}
): DistilledExample {
  const allowMission = options.allowMissionFallback ?? true;
  const visualExample = session?.sintesisVisual?.ejemploBreve;
  if (visualExample) {
    const problemStatement = stripTemplateLabels(
      sanitizePedagogicalMetaPhrases(cleanSacrintText(visualExample.planteamiento))
    );
    const steps = (visualExample.pasos ?? [])
      .map((step) => stripTemplateLabels(sanitizePedagogicalMetaPhrases(cleanSacrintText(step))))
      .filter(
        (step) =>
          step.length >= 12 &&
          !NUMERIC_ONLY_STEP_RE.test(step) &&
          !ORPHAN_LIST_END_RE.test(step) &&
          !isRubricOrBoilerplateLeak(step) &&
          !hasDanglingEnding(step)
      )
      .slice(0, 3);
    const interpretation = stripTemplateLabels(
      sanitizePedagogicalMetaPhrases(cleanSacrintText(visualExample.conclusion))
    );
    // Eliminar etiquetas estructurales ("Paso 1", "Sesión 2", "Nivel 3") antes de juzgar
    // si el ejemplo de la sesión es realmente cuantitativo; de lo contrario, toda sesión
    // humanística/social/inglés parecería matemática solo por contener "Paso 1".
    const exampleWithoutStepLabels = (session?.ejemploResuelto || '').replace(
      /\b(?:paso|sesi[oó]n|nivel|etapa|fase|criterio|bloque|corte|p[aá]rrafo|art[ií]culo)\s*\d+\b/gi,
      ''
    );
    // Distinguir cálculos matemáticos/ecuaciones reales de menciones incidentales de hardware o tiempo
    // ("16GB", "5 minutos", "0.5 gramos"), para no descartar sintesisVisual.ejemploBreve en sesiones técnicas.
    const hasSessionQuantitativeExample = Boolean(
      exampleWithoutStepLabels &&
        /(?:[=±≈]\s*-?\d)|(?:\d+(?:[.,]\d+)?\s*[=±≈×÷*/+-]\s*\d)|√/.test(exampleWithoutStepLabels)
    );
    const visualStepsHaveMath =
      steps.some((step) => /[=≤≥]|\d/.test(step)) ||
      /[=≤≥]|\d/.test(`${problemStatement} ${interpretation} ${session?.sintesisVisual?.formulaOReglaClave ?? ''}`);
    const visualHasEquation = /=/.test(`${problemStatement} ${steps.join(' ')}`);
    const extractSigNums = (text: string): string[] =>
      [...new Set((text.match(/\d[\d.,]*/g) ?? []).map((n) => n.replace(/,/g, '')).filter((n) => n !== '1' && n !== '2' && n !== '3'))];
    const visualNums = extractSigNums(`${problemStatement} ${steps.join(' ')} ${interpretation}`);
    const sessionNums = new Set(extractSigNums(exampleWithoutStepLabels));
    const sharedNumericCount = visualNums.filter((n) => sessionNums.has(n)).length;
    const visualSharesSameProblemNumbers =
      visualNums.length === 0 ||
      sharedNumericCount >= Math.min(2, visualNums.length);
    const extractedSrcEq = exampleWithoutStepLabels
      ? extractCompleteEquations(exampleWithoutStepLabels)[0]?.trim()
      : undefined;
    const isTrivialSingleVarAssignment = Boolean(
      extractedSrcEq &&
        /^[A-Za-zÁÉÍÓÚÑáéíóúñ]{1,4}\s*=\s*-?\d+(?:[.,]\d+)?\s*(?:mm|cm|m|km|g|kg|mg|ml|l|s|min|h|°|%)?$/i.test(
          extractedSrcEq
        )
    );
    const eqSigNums = extractedSrcEq ? extractSigNums(extractedSrcEq) : [];
    const eqNumbersMatchVisual =
      eqSigNums.length === 0 ||
      (visualNums.length > 0 && eqSigNums.every((n) => visualNums.includes(n)));
    const sessionHasEquation = Boolean(extractedSrcEq && !isTrivialSingleVarAssignment && eqNumbersMatchVisual);
    if (
      !visualHasEquation &&
      visualSharesSameProblemNumbers &&
      !isTrivialSingleVarAssignment &&
      eqNumbersMatchVisual &&
      steps.length > 0 &&
      extractedSrcEq
    ) {
      const openCount = (extractedSrcEq.match(/\(/g) || []).length;
      const closeCount = (extractedSrcEq.match(/\)/g) || []).length;
      if (
        extractedSrcEq.length >= 5 &&
        extractedSrcEq.length <= 42 &&
        openCount === closeCount &&
        !hasDanglingEnding(extractedSrcEq)
      ) {
        const targetIdx = Math.min(1, steps.length - 1);
        steps[targetIdx] = `${steps[targetIdx]!.replace(/[.]+$/, '')} (${extractedSrcEq}).`;
      }
    }
    if (steps.length === 2) {
      const rawStep3 =
        visualSharesSameProblemNumbers && session?.ejemploResuelto
          ? cleanStepLine(
              parseEjemploResuelto(cleanSacrintTextPreservingLines(session.ejemploResuelto)).pasos[2] ?? ''
            )
          : '';
      const candidate3 =
        rawStep3 && rawStep3.length >= 12 && !hasDanglingEnding(rawStep3)
          ? distillStepPreservingMath(rawStep3, 105, 15)
          : `Verifica el resultado en el contexto: ${interpretation.replace(/[.]+$/, '')}.`;
      if (candidate3 && candidate3.length >= 12 && !hasDanglingEnding(candidate3)) {
        steps.push(candidate3);
      }
    }
    const hasAdequateContext =
      problemStatement.length >= 24 &&
      !hasDanglingEnding(problemStatement) &&
      problemStatement.split(/\s+/).filter(Boolean).length >= 5;
    const hasAdequateConclusion =
      interpretation.length >= 14 && !hasDanglingEnding(interpretation);
    if (
      hasAdequateContext &&
      steps.length >= 2 &&
      hasAdequateConclusion &&
      (!hasSessionQuantitativeExample || visualStepsHaveMath || sessionHasEquation)
    ) {
      return {
        problemStatement,
        steps,
        interpretation,
      };
    }
  }
  const topicLead = deriveRepeatedTopicLead(session);
  const solved = allowMission ? mission.conceptZero?.solvedExample : undefined;
  const rawSessionExample = stripSessionLeadPrefix(session?.ejemploResuelto, topicLead);
  const stmtBudget = allowMission ? 245 : 400;
  const stmtWords = allowMission ? undefined : 80;
  const stepBudget = allowMission ? 180 : 110;
  const stepWords = allowMission ? undefined : 16;
  const interpBudget = 165;
  const interpWords = allowMission ? undefined : 28;

  if (rawSessionExample && !isRubricOrBoilerplateLeak(rawSessionExample)) {
    const preservedSessionExample = cleanSacrintTextPreservingLines(rawSessionExample);
    const cleanedSessionExample = cleanSacrintText(rawSessionExample);
    const parsed = parseEjemploResuelto(preservedSessionExample);
    const parsedStatement = parsed.enunciado.trim();
    const rawBeforeFirstStep = /\bPaso\s*1\s*[:.\-]/i.test(preservedSessionExample)
      ? preservedSessionExample
          .replace(/^(?:planteamiento|problema|enunciado|situaci[oó]n)\s*:\s*/i, '')
          .split(/\bPaso\s*1\s*[:.\-]/i)[0]
          .trim()
      : parsedStatement;
    const statementSource =
      hasDanglingEnding(parsedStatement) || rawBeforeFirstStep.length > parsedStatement.length + 20
        ? rawBeforeFirstStep
        : parsedStatement;
    const rawStatement = allowMission
      ? distillProblemOrExerciseText(stripSessionLeadPrefix(statementSource, topicLead), stmtBudget, stmtWords)
      : buildCompleteSlideProblemStatement(statementSource, topicLead, stmtBudget, stmtWords);
    const statement = rawStatement;
    const cleanedRawSteps = parsed.pasos
      .map(cleanStepLine)
      .filter((step) => step.length >= 8 && !SYNTHETIC_PARSER_STEP_RE.test(step) && !isRubricOrBoilerplateLeak(step));

    const stepCandidates =
      !allowMission && cleanedRawSteps.length >= 4 ? cleanedRawSteps.slice(0, -1) : cleanedRawSteps;
    const eqAfterFirst = stepCandidates.slice(1).filter((step) => /=/.test(step)).slice(0, 2);
    const selectedRawSteps =
      !allowMission && stepCandidates.length >= 4 && eqAfterFirst.length >= 2
        ? [stepCandidates[0]!, ...eqAfterFirst]
        : stepCandidates.slice(0, 3);
    const steps = selectedRawSteps
      .map((step) => distillStepPreservingMath(step, stepBudget, stepWords))
      .filter(Boolean)
      .filter(isSubstantiveStep)
      .filter((step) => allowMission || isCompleteMathStep(step))
      .slice(0, allowMission ? 4 : 3);
    if (!allowMission && cleanedRawSteps.length >= 4) {
      const solutionRe = /\b[a-z]\s*=\s*-?\d+(?:[.,]\d+)?(?!\s*[/\\])/i;
      if (!steps.some((step) => solutionRe.test(step))) {
        const lastRaw = cleanedRawSteps[cleanedRawSteps.length - 1]!;
        const solutionSentence = [...splitSpanishSentences(lastRaw)]
          .reverse()
          .find((sentence) => solutionRe.test(sentence));
        if (solutionSentence) {
          const solutionStep = distillStepPreservingMath(cleanStepLine(solutionSentence), stepBudget, stepWords);
          if (solutionStep && !steps.includes(solutionStep)) steps.push(solutionStep);
        }
      }
    }
    // Nunca sustituir un ejemplo resuelto completo por un ejercicio de práctica:
    // eso cambia el planteamiento y rompe la coherencia ejemplo↔pasos.
    const mappedRawSteps = selectedRawSteps
      .map((step) => distillStepPreservingMath(step, stepBudget, stepWords))
      .filter(Boolean);
    const validatedRawSteps = mappedRawSteps
      .filter(isSubstantiveStep)
      .filter(isCompleteMathStep)
      .slice(0, allowMission ? 4 : 3);
    const rawFallbackSteps =
      validatedRawSteps.length >= 2
        ? validatedRawSteps
        : mappedRawSteps.slice(0, allowMission ? 4 : 3);
    const effectiveSteps = steps.length >= 2 ? steps : rawFallbackSteps;
    const mathSteps = effectiveSteps.filter((step) => /[=]|\d/.test(step));
    const parsedSteps = mathSteps.length >= 2 ? mathSteps : effectiveSteps;
    const inlineSteps =
      !allowMission && parsedSteps.length < 2 ? deriveInlineExampleSteps(preservedSessionExample) : [];
    const preferredSteps = parsedSteps.length >= 2 ? parsedSteps : inlineSteps;

    // Gu��a de sesi��n: un ejemplo con menos de 2 pasos completos o sin enunciado completo
    // no se renderiza (el writer debe repararlo en origen; no se maquilla en la diapositiva).
    if (!allowMission && (preferredSteps.length < 2 || statement.trim().length < 12)) {
      const fromPractice = buildExampleFromPractice(session, topicLead, {
        stmtBudget,
        stmtWords,
        stepBudget,
        stepWords,
        interpBudget,
        interpWords,
      });
      if (fromPractice) return fromPractice;
      return { problemStatement: '', steps: [], interpretation: '' };
    }

    if (preferredSteps.length > 0) {
      const fourthRawStep = cleanedRawSteps.length >= 4 ? cleanedRawSteps[cleanedRawSteps.length - 1] : undefined;
      const derivedConclusion = extractExampleConclusion(rawSessionExample, preferredSteps, fourthRawStep, interpBudget, interpWords);
      const lastStepNorm = (preferredSteps[preferredSteps.length - 1] ?? '').toLowerCase().replace(/[^a-z0-9áéíóúñ]+/gi, ' ').trim();
      const conclNorm = (derivedConclusion ?? '').toLowerCase().replace(/[^a-z0-9áéíóúñ]+/gi, ' ').trim();
      const isDuplicateConclusion =
        !allowMission
          ? Boolean(conclNorm && lastStepNorm && conclNorm === lastStepNorm)
          : Boolean(conclNorm && lastStepNorm && (conclNorm === lastStepNorm || lastStepNorm.includes(conclNorm)));
      const fallbackSubstantive = [...cleanedRawSteps]
        .reverse()
        .map((s) =>
          fitPedagogicalText(simplifyNumericEqualsChains(s.replace(CONCLUSION_HEADING_PREFIX_RE, '').trim()), {
            maxChars: interpBudget,
            maxWords: interpWords,
            role: 'conclusion',
          })
        )
        .find((c) => isSubstantiveConclusion(c));
      const cleanInterpretation =
        !isDuplicateConclusion && derivedConclusion && isSubstantiveConclusion(derivedConclusion)
          ? derivedConclusion
          : fallbackSubstantive && (!lastStepNorm || fallbackSubstantive.toLowerCase().replace(/[^a-z0-9áéíóúñ]+/gi, ' ').trim() !== lastStepNorm)
            ? fallbackSubstantive
            : '';
      const explicitConclusion = extractExplicitConclusionBody(rawSessionExample, interpBudget, interpWords);
      const fittedExplicitConclusion = explicitConclusion
        ? explicitConclusion.length <= interpBudget + 10 && !hasDanglingEnding(explicitConclusion)
          ? stripTemplateLabels(explicitConclusion.trim())
          : fitPedagogicalText(stripTemplateLabels(explicitConclusion.trim()), {
              maxChars: interpBudget,
              maxWords: interpWords,
              role: 'conclusion',
            })
        : '';
      const solvedResultToken = [...preferredSteps]
        .reverse()
        .map((step) => step.match(/\b(?:[A-Za-z][₀-₉0-9]?)\s*[=≈]\s*[-+]?\d+(?:[.,]\d+)?(?:\s*(?:m²?|cm|km|%|°|pesos|metros|horas|años|unidades))?/i)?.[0])
        .find(Boolean);
      // Nunca usar conclusiones genéricas ("El procedimiento confirma la relación planteada...").
      // Si no hay conclusión sustantiva real, devolver vacío para que el caller valide/falle.
      const resultGroundedFallback = solvedResultToken
        ? `El resultado obtenido (${solvedResultToken.trim()}) responde al planteamiento inicial.`
        : '';
      return {
        problemStatement:
          statement ||
          (allowMission ? distillProblemOrExerciseText(solved?.problemStatement, stmtBudget, stmtWords) : '') ||
          distillConciseText(stripSessionLeadPrefix(session?.objetivo, topicLead), 82, 13) ||
          '',
        steps: preferredSteps
          .map((s) => stripTemplateLabels(s))
          .filter(
            (s) =>
              s.length >= 12 &&
              !NUMERIC_ONLY_STEP_RE.test(s) &&
              !ORPHAN_LIST_END_RE.test(s) &&
              !TEMPLATE_PHRASE_RE.test(s)
          ),
        interpretation:
          (allowMission || isCompleteConclusion(cleanInterpretation) ? cleanInterpretation : '') ||
          (fittedExplicitConclusion && isSubstantiveConclusion(fittedExplicitConclusion)
            ? fittedExplicitConclusion
            : '') ||
          (allowMission ? distillConciseText(solved?.interpretation, interpBudget, interpWords ?? 26) : '') ||
          resultGroundedFallback,
      };
    }

    if (!allowMission && cleanedSessionExample) {
      const bulletSteps = extractBulletSentences(cleanedSessionExample, 2, stepBudget)
        .filter((b) => b.toLowerCase() !== statement.toLowerCase() && !statement.toLowerCase().includes(b.toLowerCase()))
        .map((bullet) =>
          fitPedagogicalText(bullet, {
            maxChars: stepBudget,
            maxWords: stepWords,
            role: 'step',
          })
        )
        .filter(Boolean);
      const clauseFocus = cleanedSessionExample.match(/,\s*((?:identificando|aplicando|analizando|comparando|evaluando|justificando|distinguiendo|calculando|construyendo)[^.?!]{10,})$/i);
      const derivedActionStep =
        clauseFocus?.[1]
          ? fitPedagogicalText(
              clauseFocus[1].charAt(0).toUpperCase() + clauseFocus[1].slice(1).replace(/ando\b/i, 'a').replace(/endo\b/i, 'e'),
              { maxChars: stepBudget, maxWords: stepWords, role: 'step' }
            )
          : '';
      const effectiveSteps =
        bulletSteps.length >= 1
          ? bulletSteps
          : derivedActionStep
            ? [derivedActionStep]
            : [];
      const explicitConclusion = extractExampleConclusion(rawSessionExample, effectiveSteps, undefined, interpBudget, interpWords);
      const conclNorm = (explicitConclusion ?? '').toLowerCase().replace(/[^a-z0-9áéíóúñ]+/gi, ' ').trim();
      const lastNorm = (effectiveSteps[effectiveSteps.length - 1] ?? '').toLowerCase().replace(/[^a-z0-9áéíóúñ]+/gi, ' ').trim();
      const cleanConclusion = conclNorm && conclNorm !== lastNorm ? explicitConclusion : '';
      return {
        problemStatement:
          statement ||
          distillProblemOrExerciseText(cleanedSessionExample, stmtBudget, stmtWords) ||
          distillConciseText(stripSessionLeadPrefix(session?.objetivo, topicLead), 72, 11),
        steps: effectiveSteps,
        interpretation: cleanConclusion,
      };
    }
  }

  if (!allowMission) {
    const derivedTopicFocus = distillConciseText(
      stripSessionLeadPrefix(session?.contenido || session?.objetivo),
      stmtBudget,
      stmtWords
    );
    return {
      problemStatement: derivedTopicFocus || '',
      steps: [],
      interpretation: '',
    };
  }

  const rawMissionSteps = (solved?.solutionSteps ?? [])
    .map(cleanStepLine)
    .filter((s) => s.length >= 6 && !isRubricOrBoilerplateLeak(s));
  const missionSteps = rawMissionSteps
    .map((s) => distillStepPreservingMath(s, 185))
    .filter(Boolean)
    .filter(isSubstantiveStep)
    .slice(0, 4);

  const demoRaw = cleanSacrintText(mission.iDoSection?.stepByStepDemo);
  const demoIsClean = Boolean(demoRaw) && !isRubricOrBoilerplateLeak(demoRaw);

  let derivedSteps = missionSteps;
  if (derivedSteps.length === 0 && demoIsClean) {
    derivedSteps = extractBulletSentences(demoRaw, 4, 175);
  }
  if (derivedSteps.length === 0 && mission.troubleshooting?.length) {
    derivedSteps = mission.troubleshooting
      .map((t) => cleanSacrintText(t.solution || t.solutionSteps?.[0] || t.rootCause || t.symptom))
      .filter((s) => s.length >= 8 && !isRubricOrBoilerplateLeak(s))
      .map((s) => distillStepPreservingMath(s, 175))
      .filter(isSubstantiveStep)
      .slice(0, 4);
  }
  if (derivedSteps.length === 0) {
    const fallbackTopic = extractCleanTopicTitle(mission.sessionTopic || mission.title);
    derivedSteps = [
      `Identifica la información relevante en el planteamiento sobre ${fallbackTopic}.`,
      'Aplica el procedimiento o criterio del tema correspondiente a la situación.',
      'Desarrolla cada fase en orden revisando la coherencia de los argumentos y evidencias.',
      'Comunica la conclusión con evidencia y comprueba que responda a la situación inicial.',
    ];
  }

  const cleanStatement =
    distillProblemOrExerciseText(solved?.problemStatement, 260) ||
    (demoIsClean ? distillProblemOrExerciseText(demoRaw, 240) : '') ||
    distillConciseText(mission.sessionFocus, 200, 34);

  const fourthMissionStep =
    rawMissionSteps.length >= 4 ? rawMissionSteps[rawMissionSteps.length - 1] : undefined;
  const solvedInterpretation = distillConciseText(solved?.interpretation, 165, 28);

  return {
    problemStatement: cleanStatement,
    steps: derivedSteps,
    interpretation:
      (solvedInterpretation && isSubstantiveConclusion(solvedInterpretation)
        ? solvedInterpretation
        : '') ||
      extractExampleConclusion(demoRaw, derivedSteps, fourthMissionStep) ||
      'Comunica la conclusión con evidencia y contrástala con el contexto real de la situación.',
  };
}

