/**
 * content-distiller.ts — Destilador Pedagógico SSoT para SACRINT (08_Presentaciones y 09_Infografias)
 *
 * Centraliza:
 * 1. Sanitización unificada (comentarios workbook, tokens [[material:...]], encabezados y énfasis Markdown, notación LaTeX/math).
 * 2. Guardas contra fugas de rúbricas analíticas o prompts dentro de diapositivas/infografías.
 * 3. Destilación didáctica orientada a aula desde `mission.sessionPlans` (con fallback a `conceptZero` / `MissionSection`),
 *    produciendo cápsulas breves y escaneables (~<=75 palabras por lámina) con cierres sintácticos limpios.
 */

import type { MissionSection, SessionPlan } from '@/types/work-textbook';
import { stripWorkbookTags } from '@/lib/guide-engine/workbook-tags';
import { stripMaterialTokens } from '@/lib/materials/material-tokens';
import { stripInlineMarkdownEmphasis } from '@/lib/utils/inline-markdown';
import { trimAtCleanBoundary } from '@/lib/planning/workbook-sequence-sync';
import { parseContenidoToBloques, parseEjemploResuelto } from '@/lib/editorial/student-content-model';
import { normalizeMathNotation } from './math-text';

const RUBRIC_OR_META_LEAK_RE =
  /r[úu]brica\s+anal[íi]tica|ponderaci[oó]n\s*:\s*\d+\s*%|excelente\s*\(\s*\d+\s*(?:pts?|puntos?)\s*\)|bueno\s*\(\s*\d+\s*(?:pts?|puntos?)\s*\)|suficiente\s*\(\s*\d+\s*(?:pts?|puntos?)\s*\)|este\s+(?:ejercicio|apartado)\s+de\s+\d+\s+palabras/i;

const BOILERPLATE_PREFIX_RE =
  /^(?:(?:misi[oó]n|bloque|sesi[oó]n)\s*\d+\s*:\s*)+(?:optimizaci[oó]n\s+y\s+consolidaci[oó]n\s+de\s+la\s+evidencia|exploraci[oó]n\s+diagn[oó]stica\s+y\s+problematizaci[oó]n\s+situada|modelado\s+metodol[oó]gico\s+y\s+procedimientos\s+clave|evaluaci[oó]n\s+(?:de\s+logros|sumativa|diagn[oó]stica)|fundamentaci[oó]n\s+e\s+intuici[oó]n)\s*[—–\-:]\s*/i;

export interface DistilledExample {
  problemStatement: string;
  steps: string[];
  interpretation: string;
}

export interface DistilledPracticeActivity {
  label: string;
  statement: string;
  hint: string;
}

export interface DistilledConceptHighlights {
  definition: string;
  formulas: string[];
  keyRules: string[];
}

export interface DistilledLessonBundle {
  sessionNumber: number | null;
  topicTitle: string;
  objective: string;
  activation: string;
  question: string;
  concepts: DistilledConceptHighlights;
  example: DistilledExample;
  activities: DistilledPracticeActivity[];
  application: string;
  artifactStep: string;
  exitChecks: string[];
}

/**
 * Limpia texto editorial para láminas e infografías preservando operadores aritméticos (`2*x`, `a * b`).
 */
export function cleanSacrintText(value: string | null | undefined): string {
  if (!value) return '';
  let text = stripWorkbookTags(value);
  text = stripMaterialTokens(text);
  // Quitar reglas horizontales y encabezados Markdown manteniendo el título textual
  text = text
    .replace(/^\s*[-*_]{3,}\s*$/gm, ' ')
    .replace(/(^|\r?\n)\s{0,3}#{1,6}\s+/g, '$1')
    .replace(/^\s*[-*•]\s+/gm, '')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '$1');
  text = stripInlineMarkdownEmphasis(text);
  text = normalizeMathNotation(text);
  return text.replace(/\s+/g, ' ').trim();
}

/** Detecta fragmentos de rúbricas de evaluación o instrucciones de prompt filtradas en campos de contenido. */
export function isRubricOrBoilerplateLeak(value: string | null | undefined): boolean {
  const cleaned = cleanSacrintText(value);
  if (!cleaned) return false;
  if (RUBRIC_OR_META_LEAK_RE.test(cleaned)) return true;
  if (/^fases?\s+del\s+proyecto\s+formativo\s*:?\s*$/i.test(cleaned)) return true;
  if (/^criterio\s*:\s*/i.test(cleaned) && /ponderaci[oó]n|excelente|requiere\s+apoyo/i.test(cleaned)) return true;
  return false;
}

/**
 * Extrae el nombre curricular real de una misión o sesión sin prefijos burocráticos repetidos.
 */
export function extractCleanTopicTitle(
  rawTitle: string | null | undefined,
  fallbackTopic?: string | null
): string {
  const raw = cleanSacrintText(rawTitle);
  const withoutBoilerplate = raw.replace(BOILERPLATE_PREFIX_RE, '').trim();
  const candidate = withoutBoilerplate || cleanSacrintText(fallbackTopic);
  if (!candidate) return 'Concepto central de la clase';
  return candidate.charAt(0).toUpperCase() + candidate.slice(1);
}

/**
 * Sintetiza texto denso a un límite legible en proyector o tarjeta manteniendo oraciones completas.
 */
export function distillConciseText(
  value: string | null | undefined,
  maxChars: number,
  maxWords?: number
): string {
  const clean = cleanSacrintText(value);
  if (!clean || isRubricOrBoilerplateLeak(clean)) return '';

  let bounded = clean;
  if (maxWords && maxWords > 0) {
    const words = clean.split(' ');
    if (words.length > maxWords) {
      bounded = trimAtCleanBoundary(words.slice(0, maxWords + 8).join(' '), maxChars);
    }
  }
  if (bounded.length > maxChars) {
    bounded = trimAtCleanBoundary(bounded, maxChars);
  }
  return bounded.replace(/[,;:\-]+$/, '').trim();
}

/** Divide un párrafo largo en puntos clave breves para proyección en aula. */
export function extractBulletSentences(
  value: string | null | undefined,
  maxItems = 3,
  maxCharsPerItem = 140
): string[] {
  const clean = cleanSacrintText(value);
  if (!clean || isRubricOrBoilerplateLeak(clean)) return [];

  const sentences = clean
    .split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ0-9(¿¡])/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 12 && !isRubricOrBoilerplateLeak(s));

  const out: string[] = [];
  for (const sentence of sentences) {
    if (out.length >= maxItems) break;
    const distilled = distillConciseText(sentence, maxCharsPerItem);
    if (distilled && !out.includes(distilled)) {
      out.push(distilled);
    }
  }
  if (out.length === 0 && clean) {
    out.push(distillConciseText(clean, maxCharsPerItem));
  }
  return out.filter(Boolean);
}

const MATH_EXPR_RE =
  /(?:[A-Za-z](?:\([A-Za-z0-9,]+\))?\s*=\s*[^.,;\n]{2,42}|\d*[A-Za-z]²\s*[+-]\s*\d*[A-Za-z]?(?:\s*[+-]\s*\d+)?\s*=\s*-?\d+|\d+\s*[a-z]\s*[+-]\s*\d+\s*[a-z]?\s*=\s*-?\d+|(?:sen|cos|tan)\s*[A-Za-zθ°(][^.,;\n]{1,28})/g;

/** Extrae fórmulas o ecuaciones relevantes presentes en teoría o ejemplos. */
export function extractFormulasFromText(text: string, limit = 3): string[] {
  const clean = cleanSacrintText(text);
  if (!clean) return [];
  const found: string[] = [];
  for (const match of clean.matchAll(MATH_EXPR_RE)) {
    const candidate = match[0].trim().replace(/[.)]+$/, '');
    if (candidate.length >= 5 && candidate.length <= 48 && !found.includes(candidate)) {
      found.push(candidate);
    }
    if (found.length >= limit) break;
  }
  return found;
}

function cleanStepLine(rawStep: string): string {
  return cleanSacrintText(rawStep)
    .replace(/^(?:paso\s*\d+\s*[:.\-–]|\d+[.)]\s*)/i, '')
    .trim();
}

export interface DistillOptions {
  /**
   * Cuando es `false` (ej. modo `lesson-guide`), extrae únicamente desde `session`
   * sin caer a campos de `mission`, evitando duplicar el mismo contenido entre sesiones.
   * Por defecto `true` (para mazos `full`/`classroom` e infografías misionales).
   */
  allowMissionFallback?: boolean;
}

/**
 * Extrae definiciones breves, fórmulas clave y 2–3 reglas accionables desde `session.contenido` o `conceptZero`.
 */
export function extractConceptHighlights(
  mission: MissionSection,
  session?: SessionPlan,
  options: DistillOptions = {}
): DistilledConceptHighlights {
  const allowMission = options.allowMissionFallback ?? true;
  const rawTheory = session?.contenido || (allowMission ? mission.conceptZero?.coreExplanation : '') || '';
  const blocks = parseContenidoToBloques(rawTheory);
  const formulas: string[] = [];
  const candidateTexts: string[] = [];

  for (const block of blocks) {
    const cleaned = cleanSacrintText(block.texto);
    if (!cleaned || isRubricOrBoilerplateLeak(cleaned)) continue;
    if (block.tipo === 'formula') {
      if (!formulas.includes(cleaned)) formulas.push(cleaned);
      continue;
    }
    if (block.tipo === 'definicion' && candidateTexts.length === 0) {
      candidateTexts.unshift(cleaned);
    } else {
      candidateTexts.push(cleaned);
    }
    for (const eq of extractFormulasFromText(cleaned, 3)) {
      if (!formulas.includes(eq)) formulas.push(eq);
    }
  }

  const rawExampleSource =
    session?.ejemploResuelto || (allowMission ? mission.conceptZero?.solvedExample?.problemStatement : '') || '';
  for (const eq of extractFormulasFromText(rawExampleSource, 2)) {
    if (!formulas.includes(eq)) formulas.push(eq);
  }

  const analogyClean = allowMission ? cleanSacrintText(mission.conceptZero?.physicalAnalogy) : '';
  const definitionSource =
    candidateTexts[0] ||
    (allowMission ? cleanSacrintText(mission.conceptZero?.coreExplanation) : '') ||
    cleanSacrintText(session?.objetivo) ||
    analogyClean;

  const definition = distillConciseText(definitionSource, 200, 34);
  const rulePoolText =
    candidateTexts.slice(1).join(' ') ||
    candidateTexts[0] ||
    analogyClean ||
    (!allowMission ? cleanSacrintText(session?.saberesPrevios || session?.motivacion) : '');
  const keyRules = extractBulletSentences(rulePoolText, 3, 130).filter((r) => r !== definition);

  if (keyRules.length === 0 && analogyClean) {
    const analogyPoint = distillConciseText(analogyClean, 130, 22);
    if (analogyPoint && analogyPoint !== definition) keyRules.push(analogyPoint);
  }
  if (!allowMission && keyRules.length === 0) {
    keyRules.push(
      `Por completar en el libro: conceptos clave${session?.sessionNumber ? ` de la sesión ${session.sessionNumber}` : ''}.`
    );
  }

  const fallbackDefinition = allowMission
    ? distillConciseText(mission.sessionFocus, 180, 30)
    : distillConciseText(session?.objetivo, 180, 30) ||
      `Por completar en el libro: fundamento conceptual${session?.sessionNumber ? ` de la sesión ${session.sessionNumber}` : ''}.`;

  return {
    definition: definition || fallbackDefinition,
    formulas: formulas.slice(0, 3),
    keyRules: keyRules.slice(0, 3),
  };
}

/**
 * Extrae el ejemplo resuelto con pasos reales evitando fugas de rúbrica y mensajes vacíos.
 */
export function extractWorkedExample(
  mission: MissionSection,
  session?: SessionPlan,
  options: DistillOptions = {}
): DistilledExample {
  const allowMission = options.allowMissionFallback ?? true;
  const solved = allowMission ? mission.conceptZero?.solvedExample : undefined;
  const rawSessionExample = session?.ejemploResuelto?.trim();

  if (rawSessionExample && !isRubricOrBoilerplateLeak(rawSessionExample)) {
    const cleanedSessionExample = cleanSacrintText(rawSessionExample);
    const parsed = parseEjemploResuelto(cleanedSessionExample);
    const statement = distillConciseText(
      parsed.enunciado.replace(/^planteamiento\s*:\s*/i, ''),
      210,
      36
    );
    const steps = parsed.pasos
      .map(cleanStepLine)
      .filter((step) => step.length >= 8 && !isRubricOrBoilerplateLeak(step))
      .map((step) => distillConciseText(step, 145, 24))
      .slice(0, 4);

    if (steps.length > 0) {
      return {
        problemStatement:
          statement ||
          (allowMission ? distillConciseText(solved?.problemStatement, 200, 34) : '') ||
          distillConciseText(session?.objetivo, 200, 34) ||
          'Por completar en el libro: planteamiento del ejemplo.',
        steps,
        interpretation:
          (allowMission ? distillConciseText(solved?.interpretation, 160, 26) : '') ||
          'Revisa la consigna y comunica la conclusión con evidencia verificando su coherencia.',
      };
    }

    if (!allowMission && cleanedSessionExample) {
      const bulletSteps = extractBulletSentences(cleanedSessionExample, 3, 145);
      const effectiveSteps =
        bulletSteps.length >= 2
          ? bulletSteps
          : [
              distillConciseText(cleanedSessionExample, 145, 24),
              'Desarrolla el procedimiento o criterio del tema conforme a la consigna.',
              'Comunica la conclusión con evidencia y verifica su coherencia.',
            ].filter(Boolean);
      return {
        problemStatement:
          statement ||
          distillConciseText(cleanedSessionExample, 200, 34) ||
          distillConciseText(session?.objetivo, 200, 34),
        steps: effectiveSteps,
        interpretation: 'Revisa la consigna y comunica la conclusión con evidencia.',
      };
    }
  }

  if (!allowMission) {
    const sessionLabel = session?.sessionNumber ? ` de la sesión ${session.sessionNumber}` : '';
    return {
      problemStatement: `Por completar en el libro: ejemplo guiado${sessionLabel}.`,
      steps: [
        `Por completar en el libro: identifica la información relevante${sessionLabel}.`,
        'Aplica el procedimiento o criterio del tema trabajado en la sesión.',
        'Revisa la consigna y comunica la conclusión con evidencia.',
      ],
      interpretation: `Por completar en el libro: interpretación y cierre del ejemplo${sessionLabel}.`,
    };
  }

  const missionSteps = (solved?.solutionSteps ?? [])
    .map(cleanStepLine)
    .filter((s) => s.length >= 6 && !isRubricOrBoilerplateLeak(s))
    .map((s) => distillConciseText(s, 145, 24))
    .slice(0, 4);

  const demoRaw = cleanSacrintText(mission.iDoSection?.stepByStepDemo);
  const demoIsClean = Boolean(demoRaw) && !isRubricOrBoilerplateLeak(demoRaw);

  let derivedSteps = missionSteps;
  if (derivedSteps.length === 0 && demoIsClean) {
    derivedSteps = extractBulletSentences(demoRaw, 4, 145);
  }
  if (derivedSteps.length === 0 && mission.troubleshooting?.length) {
    derivedSteps = mission.troubleshooting
      .map((t) => cleanSacrintText(t.solution || t.solutionSteps?.[0] || t.rootCause || t.symptom))
      .filter((s) => s.length >= 8 && !isRubricOrBoilerplateLeak(s))
      .map((s) => distillConciseText(s, 145, 24))
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
    distillConciseText(solved?.problemStatement, 210, 36) ||
    (demoIsClean ? distillConciseText(demoRaw, 200, 34) : '') ||
    distillConciseText(mission.sessionFocus, 200, 34);

  return {
    problemStatement: cleanStatement,
    steps: derivedSteps,
    interpretation:
      distillConciseText(solved?.interpretation, 160, 26) ||
      'Comunica la conclusión con evidencia y contrástala con el contexto real de la situación.',
  };
}

/**
 * Extrae las actividades prácticas del libro (enunciado + pista pedagógica) sin exponer `solucion`.
 */
export function extractPracticeActivities(
  mission: MissionSection,
  session?: SessionPlan,
  options: DistillOptions = {}
): DistilledPracticeActivity[] {
  const allowMission = options.allowMissionFallback ?? true;
  const fromSession = (session?.practica ?? [])
    .filter((item) => cleanSacrintText(item.enunciado).length >= 10 && !isRubricOrBoilerplateLeak(item.enunciado))
    .slice(0, 3)
    .map((item, idx) => ({
      label: `Actividad ${idx + 1}`,
      statement: distillConciseText(item.enunciado, 195, 34),
      hint: distillConciseText(item.pista, 145, 25) || 'Revisa la consigna y apóyate en el ejemplo trabajado en clase.',
    }));

  if (fromSession.length > 0) return fromSession;

  if (!allowMission) {
    const sessionLabel = session?.sessionNumber ? ` de la sesión ${session.sessionNumber}` : '';
    return [
      {
        label: 'Actividad 1',
        statement: `Por completar en el libro: actividad práctica${sessionLabel}.`,
        hint: 'Revisa la consigna en tu libro de trabajo y comunica la conclusión con evidencia.',
      },
    ];
  }

  const guided = cleanSacrintText(mission.weDoSection?.guidedPractice);
  if (guided && !isRubricOrBoilerplateLeak(guided)) {
    const points = extractBulletSentences(guided, 3, 185);
    return points.map((pt, idx) => ({
      label: `Actividad ${idx + 1}`,
      statement: pt,
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
        distillConciseText(autonomous, 195, 34) ||
        'Realiza en tu cuaderno una actividad de aplicación del tema vinculada con tu entorno.',
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
  const sessionLabel = session?.sessionNumber ? ` de la sesión ${session.sessionNumber}` : '';
  const rawApp = allowMission
    ? session?.aplicacion ||
      mission.realLifeConnection?.householdApplication ||
      mission.realLifeConnection?.communityImpact ||
      mission.realLifeConnection?.context ||
      mission.sessionFocus
    : session?.aplicacion;
  const application =
    distillConciseText(rawApp, 210, 36) ||
    (allowMission
      ? 'Vincula el aprendizaje con situaciones reales y decisiones cotidianas de tu comunidad.'
      : `Por completar en el libro: aplicación situada${sessionLabel}.`);

  const rawArtifact = allowMission
    ? session?.productoIntegrador ||
      mission.youDoSection?.autonomousChallenge ||
      mission.formativeCheckpoint?.question
    : session?.productoIntegrador;
  const artifactStep =
    distillConciseText(rawArtifact, 175, 28) ||
    (allowMission
      ? 'Integra el procedimiento desarrollado y su conclusión con evidencia en la bitácora del bloque.'
      : `Por completar en el libro: avance del producto integrador${sessionLabel}.`);

  const checksFromSession = (session?.autoevaluacion ?? [])
    .map(cleanSacrintText)
    .filter((item) => item.length >= 8 && !isRubricOrBoilerplateLeak(item))
    .map((item) => distillConciseText(item, 130, 22));

  const checksFromMission = allowMission
    ? [
        ...(mission.formativeCheckpoint?.criteriaChecklist ?? []),
        ...(mission.formativeCheckpoint?.reflectionPrompts ?? []),
      ]
        .map(cleanSacrintText)
        .filter((item) => item.length >= 8 && !isRubricOrBoilerplateLeak(item))
        .map((item) => distillConciseText(item, 130, 22))
    : [];

  const exitChecks = (checksFromSession.length > 0 ? checksFromSession : checksFromMission).slice(0, 3);
  if (exitChecks.length === 0) {
    exitChecks.push(
      'Explico con mis palabras el concepto central y cuándo se aplica.',
      'Identifico la información relevante de la consigna y aplico el procedimiento o criterio del tema.',
      'Comunico la conclusión con evidencia y verifico que sea coherente con la situación.'
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
    if (match) return distillConciseText(match[0], 150, 24);
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
  const topicTitle = extractCleanTopicTitle(
    session ? session.objetivo || session.contenido || fallbackSessionTitle : mission.sessionTopic || mission.title,
    allowMission ? mission.sessionTopic || mission.title : fallbackSessionTitle
  );
  const objective =
    distillConciseText(session?.objetivo || (allowMission ? topicSource : ''), 165, 28) ||
    (allowMission
      ? extractCleanTopicTitle(mission.title)
      : `Por completar en el libro: propósito de la sesión ${sessionNumber ?? 1}.`);

  const activationRaw =
    session?.saberesPrevios || session?.motivacion || (allowMission ? mission.phenomenonHook?.story : '');
  const activation =
    distillConciseText(activationRaw, 185, 32) ||
    (allowMission
      ? distillConciseText(mission.sessionFocus, 175, 30)
      : `Por completar en el libro: activación diagnóstica de la sesión ${sessionNumber ?? 1}.`);

  const sessionQuestion = extractQuestionFromSession(session);
  const question =
    sessionQuestion ||
    (allowMission ? distillConciseText(mission.phenomenonHook?.detonatingQuestion, 150, 24) : '') ||
    `¿Cómo aplicar ${topicTitle.toLowerCase()} para analizar una situación de esta sesión?`;

  const concepts = extractConceptHighlights(mission, session, options);
  const example = extractWorkedExample(mission, session, options);
  const activities = extractPracticeActivities(mission, session, options);
  const { application, artifactStep, exitChecks } = extractApplicationAndExit(mission, session, options);

  return {
    sessionNumber,
    topicTitle,
    objective,
    activation,
    question,
    concepts,
    example,
    activities,
    application,
    artifactStep,
    exitChecks,
  };
}
