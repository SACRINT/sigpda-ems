import type { MissionSection, SessionPlan } from '@/types/work-textbook';
import { parseContenidoToBloques } from '@/lib/editorial/student-content-model';
import { fitPedagogicalText } from '@/lib/editorial/fitter/text-compactor';
import { hasDanglingEnding } from '@/lib/editorial/fitter/dangling-guards';
import { splitSpanishSentences } from '@/lib/editorial/fitter/sentence-splitter';
import { isValidRenderableFormula } from '@/lib/editorial/text-normalization';
import type { DistilledConceptHighlights, DistillOptions } from '../types';
import {
  cleanSacrintText,
  GENERIC_CONCLUSION_RE,
  isRubricOrBoilerplateLeak,
  NUMERIC_ONLY_STEP_RE,
  ORPHAN_LIST_END_RE,
  sanitizePedagogicalMetaPhrases,
  TEMPLATE_PHRASE_RE,
} from '../text/grammar-normalization';
import { paraphraseSixGramOverlap } from '../text/six-gram-overlap';
import {
  distillConciseText,
  extractBulletSentences,
  pickCompleteSentences,
} from '../text/objective-and-activity-guards';
import {
  cleanStepLine,
  extractFormulasFromText,
  simplifyNumericEqualsChains,
  stripRubricTail,
} from './formula-and-steps';

const SUMMARY_TASK_VERBS =
  'calcula|determina|encuentra|halla|resuelve|modela|plantea|formula|indica|escribe|obt[eé]n|verifica|comprueba|justifica|identifica|estima|precisa|audita|revisa|aplica|traza|dibuja|grafica|clasifica|compara|argumenta|explica|analiza|relaciona|interpreta|distingue|localiza|señala|construye|elabora|integra|crea|redacta|prepara|consolida|organiza|demuestra|simula|examina|utiliza|genera|emplea|describe|representa|completa|ordena|usa|enfócate|asegúrate';
const SUMMARY_TASK_RE = new RegExp('\\b(?:' + SUMMARY_TASK_VERBS + ')\\b', 'i');

function summaryDataTokens(text: string): string[] {
  return [...new Set(
    text.match(
      /(?<![\d.])\$?\d[\d.,]*(?:\s+(?:m²|cm²|metros|grados|pesos|años|habitantes|libretas|unidades|estudiantes|jóvenes|minutos|horas|m|cm|km|mm|kg|g|l|ml|%))?/gi
    ) ?? []
  )]
    .filter((value) => /\d/.test(value))
    .slice(0, 8);
}

const SUMMARY_META_RE =
  /^(?:aprender[aáe]s|vas a aprender|en esta sesi[oó]n|el prop[oó]sito|al finalizar|identificar[aáe]s|comprender[aáe]s|analizar[aáe]s|se espera que|el estudiante)/i;
const SUMMARY_DANGLING_RE =
  /^(?:a|al|de|del|en|con|para|por|y|o|que|el|la|los|las|un|una|unos|unas|su|sus|tu|tus|se|lo|le|les|como|seg[uú]n)$/i;
const SUMMARY_TASK_START_RE = new RegExp('^(?:' + SUMMARY_TASK_VERBS + ')\\b', 'i');
const SUMMARY_TASK_AFTER_COMMA_RE = new RegExp('(?:,\\s*)(?:' + SUMMARY_TASK_VERBS + ')\\b', 'i');
const SUMMARY_CONNECTOR_RE = /^(?:a partir|con (?:estos|esta|la|el|los|las)|de acuerdo|utilizando|usa|considera|si|cuando|dado que)\b/i;

function isSummaryTaskSentence(sentence: string): boolean {
  if (/¿|\?$/.test(sentence)) return true;
  if (SUMMARY_TASK_START_RE.test(sentence)) return true;
  if (SUMMARY_CONNECTOR_RE.test(sentence) && SUMMARY_TASK_RE.test(sentence)) return true;
  return SUMMARY_TASK_AFTER_COMMA_RE.test(sentence);
}

function summaryTaskVerb(sentence: string): string | null {
  const matches = [...sentence.matchAll(new RegExp(SUMMARY_TASK_RE.source, 'gi'))];
  if (!matches.length) return null;
  if (SUMMARY_TASK_START_RE.test(sentence)) return matches[0][0];
  return matches[matches.length - 1][0];
}

function trimSummaryDangling(text: string): string {
  const words = text.replace(/[.;:]+$/, '').trim().split(/\s+/).filter(Boolean);
  while (words.length > 3 && SUMMARY_DANGLING_RE.test(words[words.length - 1])) words.pop();
  while (words.length > 3 && /^\d+[.,]?$/.test(words[words.length - 1])) words.pop();
  while (words.length > 3 && SUMMARY_DANGLING_RE.test(words[words.length - 1])) words.pop();
  return words.join(' ');
}

function summaryContext(sentences: string[], taskSentence: string): string {
  const candidates = sentences.filter(
    (sentence) => sentence !== taskSentence && sentence.length >= 18 && !SUMMARY_META_RE.test(sentence)
  );
  let context = candidates[0] || '';
  if (!context && taskSentence) {
    const taskVerb = summaryTaskVerb(taskSentence);
    const verbIndex = taskVerb ? taskSentence.lastIndexOf(taskVerb) : -1;
    if (verbIndex > 0) context = taskSentence.slice(0, verbIndex);
  }
  context = context
    .replace(/^(?:ejercicio|actividad|problema)\s*\d*\s*[:.\-]\s*/i, '')
    .replace(/^(?:planteamiento|enunciado|situaci[oó]n)\s*:\s*/i, '')
    .trim();
  if (SUMMARY_META_RE.test(context) || /^(?:a partir|con|de acuerdo|utilizando)\b/i.test(context)) {
    context = '';
  }
  if (context.length > 100) {
    const clauses = context.split(/,\s+|;\s+/);
    let acc = '';
    for (const clause of clauses) {
      const next = acc ? `${acc}, ${clause}` : clause;
      if (next.length > 100) break;
      acc = next;
    }
    context = acc || context.split(/\s+/).slice(0, 16).join(' ');
  }
  return trimSummaryDangling(context);
}

function summaryTaskObject(text: string, verb: string): string {
  const escaped = verb.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = text.match(new RegExp(`\\b${escaped}\\b\\s+(.{8,110}?)(?:[.;?!]|$)`, 'i'));
  const question = text.match(/¿(?:cu[aá]l|qu[eé]|cu[aá]nt[oa]s?)\s+(?:es|son)?\s*(.{8,110}?)(?:\?|$)/i);
  const raw = match?.[1] ?? question?.[1] ?? '';
  if (!raw) return 'la situación y verifica el resultado';
  const object = raw
    .replace(/\b(?:tabla de valores|tabla)\b/gi, 'tabulación')
    .replace(/\bpuntos de control\b/gi, 'puntos de referencia')
    .replace(/\buna ecuaci[oó]n de primer grado\b/gi, 'el modelo de primer grado')
    .replace(/\s+y\s+(?:cada|que|para|con)\b[\s\S]*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  const trimmed = trimSummaryDangling(object.split(/\s+/).slice(0, 14).join(' '));
  return trimmed || 'la situación y verifica el resultado';
}

function summaryConnector(verb: string, seed: string): string {
  const v = verb.toLowerCase();
  if (/^(calcula|determina|halla|resuelve|encuentra|estima|precisa|obt[eé]n)$/.test(v)) {
    return seed.length % 2 === 0 ? 'Con estos datos,' : 'A partir de los datos,';
  }
  if (/^(plantea|modela|formula|escribe|representa)$/.test(v)) {
    return seed.length % 2 === 0 ? 'A partir de la situación,' : 'Con la información del caso,';
  }
  if (/^(elabora|genera|construye|crea|prepara|organiza|consolida|integra|redacta|completa|ordena)$/.test(v)) {
    return seed.length % 2 === 0 ? 'Con la información anterior,' : 'A partir del contexto,';
  }
  return seed.length % 2 === 0 ? 'Con el procedimiento descrito,' : 'A partir del análisis,';
}

/**
 * Síntesis extractiva para diapositivas: conserva contexto, tarea, fórmulas y
 * datos reales, pero evita copiar párrafos completos del libro.
 */
export function buildPresentationSummary(raw: string, title?: string): string {
  const clean = sanitizePedagogicalMetaPhrases(cleanSacrintText(raw));
  if (!clean) return '';
  const sentences = splitSpanishSentences(clean);
  const taskSentence = sentences.find(isSummaryTaskSentence) || '';
  const verb = summaryTaskVerb(taskSentence) || (/¿/.test(clean) ? 'determina' : 'resuelve');
  const context = summaryContext(sentences, taskSentence);
  let taskObject = summaryTaskObject(taskSentence || clean, verb);
  if (context && context.toLowerCase().includes(taskObject.toLowerCase())) {
    taskObject = 'la situación y verifica el resultado';
  }
  const formulas = extractFormulasFromText(clean)
    .filter(isValidRenderableFormula)
    .filter((formula) => !context.includes(formula))
    .slice(0, 2);
  const mathExpressions = [
    ...new Set(clean.match(/\b\d+(?:[.,]\d+)?\s*[a-zA-Z]\s*[+\-]\s*\d+(?:[.,]\d+)?\s*°?/g) ?? []),
  ].slice(0, 2);
  const cleanForData = formulas
    .concat(mathExpressions)
    .reduce((acc, expression) => acc.split(expression).join(' '), clean);
  const data = summaryDataTokens(cleanForData)
    .map((token) => token.replace(/[.,;:]+$/, ''))
    .filter((token) => token && !context.includes(token))
    .slice(0, 6);
  const connector = summaryConnector(verb, clean);
  const safeTitle = title && !SUMMARY_META_RE.test(title) ? title : '';
  const lead = (context || safeTitle || 'En esta situación').replace(/[.;:]+$/, '').trim();
  const formulaPhrase = formulas.length ? ` Utiliza ${formulas.join(' y ')}.` : '';
  const dataPhrase = data.length ? ` Considera ${data.join(', ')}.` : '';
  const question = sentences.find((sentence) => /¿/.test(sentence));
  const questionText = question
    ? question.replace(/^¿([A-ZÁÉÍÓÚ])/, (_, letter: string) => `¿${letter.toLowerCase()}`)
    : '';
  let summary = questionText
    ? `${lead}.${formulaPhrase}${dataPhrase} ${questionText}`
    : `${lead}. ${connector} ${verb.toLowerCase()} ${taskObject}.${formulaPhrase}${dataPhrase}`;
  if (mathExpressions.length > 0) {
    const missing = mathExpressions.filter((expression) => !summary.includes(expression));
    if (missing.length > 0) summary += ` Datos: ${missing.join('; ')}.`;
  }
  return paraphraseSixGramOverlap(summary)
    .replace(/\s+/g, ' ')
    .trim();
}

export function stripSessionLeadPrefix(value: string | null | undefined, topicLead?: string): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  let out = raw;
  let prev = '';
  while (out !== prev) {
    prev = out;
    out = out.replace(/^(?:sesi[oó]n\s*\d{1,2}\s*[:.\-–—]\s*)/i, '').trim();
  }
  if (topicLead && topicLead.length >= 10) {
    const escapedLead = topicLead.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const withoutLead = out.replace(new RegExp(`^${escapedLead}\\s*:\\s*`, 'i'), '').trim();
    if (withoutLead.length >= 16) {
      out = withoutLead;
    }
  }
  return out;
}

export function deriveRepeatedTopicLead(session?: SessionPlan): string {
  if (!session) return '';
  const candidates = [session.objetivo, session.ejemploResuelto, session.practica?.[0]?.enunciado]
    .map((v) => stripSessionLeadPrefix(v))
    .filter(Boolean);
  const prefixes = new Map<string, number>();
  for (const cand of candidates) {
    const m = cand.match(/^([^:]{12,92}):\s+(.{18,})$/);
    if (!m) continue;
    const prefix = m[1].trim();
    if (/=/.test(prefix)) continue;
    if (/^(?:planteamiento|problema|enunciado|situaci[oó]n|paso\s*\d+|caso(?:\s+pr[aá]ctico)?|ejemplo|datos?|trabajo\s+colaborativo)/i.test(prefix)) {
      continue;
    }
    const key = prefix.toLowerCase();
    prefixes.set(key, (prefixes.get(key) ?? 0) + 1);
    if (prefixes.get(key)! >= 2) {
      return prefix;
    }
  }
  return '';
}

export const SYNTHETIC_PARSER_STEP_RE =
  /^(?:identificar los (?:elementos, relaciones o datos clave|datos, conceptos o criterios iniciales) del planteamiento|desarrollar el procedimiento (?:correspondiente y comprobar la conclusi[oó]n|paso a paso y validar la conclusi[oó]n)|verificar la coherencia del resultado con el contexto planteado)\.?$/i;

export function extractConceptHighlights(
  mission: MissionSection,
  session?: SessionPlan,
  options: DistillOptions = {}
): DistilledConceptHighlights {
  const allowMission = options.allowMissionFallback ?? true;
  const visual = session?.sintesisVisual;
  const hasConjugatedPredicate = (value: string): boolean =>
    /\b(?:es|son|fue|fueron|constituye[ns]?|permite[ns]?|posibilita[ns]?|consiste[ns]?|facilita[ns]?|modela[ns]?|representa[ns]?|transforma[ns]?|integra[ns]?|garantiza[ns]?|utiliza[ns]?|emplea[ns]?|requiere[ns]?|exige[ns]?|describe[ns]?|calcula[ns]?|mide[ns]?|demuestra[ns]?|relaciona[ns]?|vincula[ns]?|organiza[ns]?|resuelve[ns]?|simplifica[ns]?|elimina[ns]?|despeja[ns]?|contrasta[ns]?|traduce[ns]?|proyecta[ns]?|consolida[ns]?|comunica[ns]?|muestra[ns]?|expresa[ns]?|determina[ns]?|establece[ns]?|identifica[ns]?|explica[ns]?|analiza[ns]?|eval[úu]a[ns]?|valida[ns]?|compara[ns]?|ayuda[ns]?|sirve[ns]?|ofrece[ns]?|aplica[ns]?|estudia[ns]?|define[ns]?|sustenta[ns]?|defiende[ns]?|articula[ns]?|formula[ns]?|construye[ns]?|propone[ns]?|argumenta[ns]?|combina[ns]?|distingue[ns]?|promueve[ns]?|fomenta[ns]?|genera[ns]?|produce[ns]?|respalda[ns]?|justifica[ns]?|contextualiza[ns]?|conecta[ns]?|clasifica[ns]?|ordena[ns]?|dise[ñn]a[ns]?|crea[ns]?|procesa[ns]?|estructura[ns]?|depura[ns]?|regula[ns]?|coordina[ns]?|interpreta[ns]?|opera[ns]?|act[úu]a[ns]?|funciona[ns]?|cambia[ns]?|var[ií]a[ns]?|tiene[ns]?|posee[ns]?|parte[ns]?|nace[ns]?|surge[ns]?|busca[ns]?|logra[ns]?|alcanza[ns]?|implica[ns]?|involucra[ns]?|abarca[ns]?|contiene[ns]?|incluye[ns]?|evita[ns]?|previene[ns]?|reduce[ns]?|aumenta[ns]?|eleva[ns]?|mejora[ns]?|fortalece[ns]?|asegura[ns]?|comprueba[ns]?|verifica[ns]?|sustituye[ns]?|se\s+[a-záéíóúñ]{3,})\b/i.test(
      value
    );
  let preservedVisualFormulas: string[] = [];
  if (visual) {
    const rawDefinition = sanitizePedagogicalMetaPhrases(cleanSacrintText(visual.conceptoBreve));
    const mapDef = sanitizePedagogicalMetaPhrases(cleanSacrintText(visual.mapaConceptual?.definicionClave));
    const definition =
      rawDefinition.length >= 30 && !hasDanglingEnding(rawDefinition) && hasConjugatedPredicate(rawDefinition)
        ? rawDefinition
        : mapDef.length >= 30 && !hasDanglingEnding(mapDef) && hasConjugatedPredicate(mapDef)
          ? mapDef
          : '';
    const formula = sanitizePedagogicalMetaPhrases(cleanSacrintText(visual.formulaOReglaClave));
    const map = visual.mapaConceptual;
    const visualFormulas = [
      ...(isValidRenderableFormula(formula) ? [formula] : []),
      ...extractFormulasFromText(visual.ejemploBreve?.planteamiento || '', 2),
    ].filter((item) => isValidRenderableFormula(item));
    preservedVisualFormulas = Array.from(new Set(visualFormulas)).slice(0, 3);
    const visualRules = [
      map?.criterioDesarrollo,
      map?.definicionClave,
      map?.correccionBreve,
    ]
      .map((item) => sanitizePedagogicalMetaPhrases(cleanSacrintText(item)))
      .filter(
        (item, index, arr) =>
          Boolean(item) &&
          item.length >= 24 &&
          !isRubricOrBoilerplateLeak(item) &&
          !hasDanglingEnding(item) &&
          arr.indexOf(item) === index
      )
      .slice(0, 3);
    if (definition.length >= 30) {
      return {
        definition,
        formulas: preservedVisualFormulas,
        keyRules: visualRules,
      };
    }
  }
  const topicLead = deriveRepeatedTopicLead(session);
  const coreExplanationRaw = cleanSacrintText(mission.conceptZero?.coreExplanation);
  const isCorePaecWrapper =
    /^(?:el\s+proyecto\b|la\s+elaboraci[oó]n\s+del\s+dossier\b|durante\s+esta\s+misi[oó]n\s+de\s+cierre)/i.test(coreExplanationRaw) &&
    extractFormulasFromText(coreExplanationRaw, 1).length === 0;
  const richMissionSession =
    !session && allowMission
      ? (mission.sessionPlans ?? []).find((s) => s.contenido && (extractFormulasFromText(s.contenido, 1).length > 0 || extractFormulasFromText(s.ejemploResuelto || '', 1).length > 0)) ||
        (mission.sessionPlans ?? [])[0]
      : undefined;
  const rawTheory =
    stripSessionLeadPrefix(session?.contenido, topicLead) ||
    (allowMission ? (!isCorePaecWrapper ? mission.conceptZero?.coreExplanation : richMissionSession?.contenido || mission.conceptZero?.coreExplanation) : '') ||
    '';
  const blocks = parseContenidoToBloques(rawTheory);
  const formulas: string[] = [...preservedVisualFormulas];
  const candidateTexts: string[] = [];

  for (const block of blocks) {
    const cleaned = sanitizePedagogicalMetaPhrases(stripSessionLeadPrefix(cleanSacrintText(block.texto), topicLead));
    if (!cleaned || isRubricOrBoilerplateLeak(cleaned)) continue;
    if (block.tipo === 'formula') {
      if (isValidRenderableFormula(cleaned) && !formulas.includes(cleaned)) formulas.push(cleaned);
      continue;
    }
    if (block.tipo === 'definicion' && candidateTexts.length === 0) {
      candidateTexts.unshift(cleaned);
    } else {
      candidateTexts.push(cleaned);
    }
    for (const eq of extractFormulasFromText(cleaned, 3)) {
      if (isValidRenderableFormula(eq) && !formulas.includes(eq)) formulas.push(eq);
    }
  }

  const rawExampleSource =
    session?.ejemploResuelto ||
    (allowMission
      ? [
          mission.conceptZero?.solvedExample?.problemStatement,
          ...(mission.conceptZero?.solvedExample?.solutionSteps ?? []),
          richMissionSession?.ejemploResuelto,
        ]
          .filter(Boolean)
          .join(' ')
      : '') ||
    '';
  for (const eq of extractFormulasFromText(rawExampleSource, 2)) {
    if (isValidRenderableFormula(eq) && !formulas.includes(eq)) formulas.push(eq);
  }

  const analogyClean = allowMission ? cleanSacrintText(mission.conceptZero?.physicalAnalogy) : '';
  const definitionSource =
    candidateTexts[0] ||
    (allowMission ? cleanSacrintText(mission.conceptZero?.coreExplanation) : '') ||
    cleanSacrintText(session?.objetivo) ||
    analogyClean;

  const definitionSentences = extractBulletSentences(definitionSource, 3, 185);
  const conceptualDefSentence =
    definitionSentences.find(
      (s) =>
        !/^(?:imagina|piensa|observa|recuerda|en\s+esta\s+sesi[oó]n|hoy\s+vas)/i.test(s) &&
        s.length >= 24
    ) || definitionSentences[0];
  const definition = allowMission
    ? conceptualDefSentence || distillConciseText(definitionSource, 200, 34)
    : pickCompleteSentences(definitionSource, 220, 1) ||
      conceptualDefSentence ||
      distillConciseText(definitionSource, 180, 26);

  const defNorm = definition.toLowerCase().replace(/[^a-záéíóúñ0-9]+/gi, ' ').trim();
  const defPrefix = defNorm.slice(0, 26);

  const rulePoolText = [
    ...candidateTexts,
    allowMission ? cleanSacrintText(mission.conceptZero?.coreExplanation) : '',
    analogyClean,
    !allowMission ? sanitizePedagogicalMetaPhrases(cleanSacrintText(stripSessionLeadPrefix(session?.saberesPrevios || session?.motivacion, topicLead))) : '',
  ]
    .filter(Boolean)
    .join(' ');
  const allCandidateRules = extractBulletSentences(rulePoolText, 6, 155).filter((r) => {
    const rNorm = r.toLowerCase().replace(/[^a-záéíóúñ0-9]+/gi, ' ').trim();
    if (
      r === definition ||
      r.length < 35 ||
      /^(?:en el contexto|de acuerdo con|por otro lado|asimismo)\b/i.test(r) ||
      isRubricOrBoilerplateLeak(r)
    ) {
      return false;
    }
    if (defPrefix && (rNorm.startsWith(defPrefix) || defNorm.includes(rNorm.slice(0, 26)))) return false;
    if (hasDanglingEnding(r)) return false;
    return (
      !/\by\s+experiencias\s+emp[ií]ricas\s+del\s+entorno\b/i.test(r) &&
      !/^(?:imagina\s+que|sup[oó]n\s+que|recuerda\s+cuando)\b/i.test(r)
    );
  });
  const keyRules = allCandidateRules.slice(0, 3);

  if (keyRules.length === 0 && analogyClean) {
    const analogyPoint = distillConciseText(analogyClean, 145, 25);
    if (analogyPoint && analogyPoint !== definition) keyRules.push(analogyPoint);
  }
  if (allowMission && keyRules.length === 0 && session?.objetivo) {
    const objRule = distillConciseText(session.objetivo, 110, 18);
    if (objRule) keyRules.push(objRule);
  }

  const fallbackDefinition = allowMission
    ? distillConciseText(mission.sessionFocus, 180, 30)
    : distillConciseText(session?.objetivo, 180, 30) || '';

  return {
    definition: definition || fallbackDefinition,
    formulas: formulas.filter(isValidRenderableFormula).slice(0, 3),
    keyRules: keyRules.slice(0, 3),
  };
}

export const CONCLUSION_HEADING_PREFIX_RE =
  /^(?:(?:verificaci[oó]n|comprobaci[oó]n|interpretaci[oó]n|conclusi[oó]n|validaci[oó]n|cierre|evaluaci[oó]n|an[aá]lisis)[^.?!:=0-9]{0,65}[.:]\s*|(?:conclusi[oó]n(?:\s+y\s+verificaci[oó]n)?|verificaci[oó]n(?:\s+y\s+conclusi[oó]n)?|comprobaci[oó]n|respuesta\s+final)\s+(?=[A-ZÁÉÍÓÚÑ]))/i;

const META_CONCLUSION_INSTRUCTION_RE =
  /^(?:redacta|escribe|elabora|anota|presenta|prepara|entrega|documenta|incluye|comunica|revisa|verifica\s+en\s+tu)\s+(?:la\s+|una\s+|tu\s+|el\s+)?(?:conclusi[oó]n|respuesta|justificaci[oó]n|reporte|argumento|evidencia)\b/i;

const PROCEDURAL_CONCLUSION_FILLER_RE =
  /^(?:analizar|evaluar|revisar|comprobar|verificar|comparar|interpretar|discutir|reflexionar)\s+(?:la\s+coherencia|el\s+resultado|la\s+validez|los\s+datos|si\s+el\s+resultado|paso\s+a\s+paso)\b/i;

export function isSubstantiveStep(candidate: string): boolean {
  const value = candidate.trim();
  if (value.length < 12) return false;
  if (NUMERIC_ONLY_STEP_RE.test(value)) return false;
  if (ORPHAN_LIST_END_RE.test(value)) return false;
  if (TEMPLATE_PHRASE_RE.test(value)) return false;
  // Exigir contenido lingüístico/pedagógico real (al menos 1 palabra alfabética si incluye cálculo/unidades, o >= 3 palabras en prosa)
  const alphaWords = value.match(/[A-Za-zÁÉÍÓÚÑáéíóúñ]{2,}/g) ?? [];
  if (/[=≈%]|\d/.test(value) ? alphaWords.length < 1 : alphaWords.length < 3) return false;
  if (
    /^(?:de acuerdo con el enunciado|analizar el significado|construir la ecuaci[oó]n|aplicar (?:la|las) propiedade?s?|realizar la operaci[oó]n|identificar (?:las )?variables)\b/i.test(
      value
    ) &&
    !/[=0-9]/.test(value)
  ) {
    return false;
  }
  return /[=0-9]/.test(value) || value.length >= 35;
}

export function isSubstantiveConclusion(candidate: string): boolean {
  const trimmed = candidate.trim();
  if (trimmed.length < 16) return false;
  if (NUMERIC_ONLY_STEP_RE.test(trimmed)) return false;
  if (GENERIC_CONCLUSION_RE.test(trimmed)) return false;
  if (TEMPLATE_PHRASE_RE.test(trimmed)) return false;
  if (META_CONCLUSION_INSTRUCTION_RE.test(trimmed)) return false;
  if (PROCEDURAL_CONCLUSION_FILLER_RE.test(trimmed)) return false;
  if (/^\b(?:calcula|determina|encuentra|comprueba)\s+el\s+resultado\b/i.test(trimmed)) return false;
  if (/\bno\s+solo\b/i.test(trimmed) && !/\bsino\b/i.test(trimmed)) return false;
  return !hasDanglingEnding(trimmed);
}

function pickBestConclusionSentence(
  rawBlock: string,
  fitConclusion: (candidate: string) => string
): string {
  const withoutHeading = sanitizePedagogicalMetaPhrases(cleanStepLine(rawBlock))
    .replace(CONCLUSION_HEADING_PREFIX_RE, '')
    .trim();
  const sents = splitSpanishSentences(withoutHeading).filter(
    (s) => !META_CONCLUSION_INSTRUCTION_RE.test(s) && !PROCEDURAL_CONCLUSION_FILLER_RE.test(s)
  );
  if (sents.length === 0) return '';
  const prioritized =
    sents.find((s) => /\b(?:concluyendo|equivale|cuesta|puede|sobra|significa|m[áa]ximo|m[ií]nimo|intercep|listo|soluci[oó]n)\b|\d/i.test(s)) ||
    sents[0]!;
  const fitted = fitConclusion(prioritized);
  return isSubstantiveConclusion(fitted) ? fitted : '';
}

export function extractExampleConclusion(
  rawExample: string,
  steps: string[],
  rawLastStep?: string,
  maxChars = 115,
  maxWords?: number
): string {
  const fitConclusion = (candidate: string) =>
    fitPedagogicalText(
      simplifyNumericEqualsChains(candidate.replace(CONCLUSION_HEADING_PREFIX_RE, '').trim()),
      { maxChars, maxWords, role: 'conclusion' }
    );

  const clean = sanitizePedagogicalMetaPhrases(stripRubricTail(cleanSacrintText(rawExample)));

  // 1. Buscar etiqueta explícita con resultado o conclusión real ("Respuesta final:", "Resultado final:", "Resultado verificable:", "Conclusión:" o "Conclusión.")
  const explicitMatch = clean.match(
    /(?:respuesta\s+final|resultado\s+(?:final|verificable|obtenido)|conclusi[oó]n(?:\s+final|\s+pedag[oó]gica)?|interpretaci[oó]n(?:\s+del\s+resultado)?)\s*[:.]\s*([^.?!]+(?:\.\d+[^.?!]*)*[.?!]?)/i
  );
  if (explicitMatch && explicitMatch[1]) {
    const candidate = fitConclusion(explicitMatch[1]);
    if (isSubstantiveConclusion(candidate)) return candidate;
  }

  // 2. Buscar oraciones completas con marcadores conclusivos claros en el ejemplo
  const allExampleSentences = splitSpanishSentences(clean)
    .map((s) =>
      cleanStepLine(s)
        .replace(CONCLUSION_HEADING_PREFIX_RE, '')
        .replace(/^(?:Graficar|Verificar|Comprobar|Interpretar|Analizar|Evaluar)\s*[.:]\s*/i, '')
        .trim()
    )
    .filter((s) => s.length >= 20 && !META_CONCLUSION_INSTRUCTION_RE.test(s) && !PROCEDURAL_CONCLUSION_FILLER_RE.test(s));

  const conclusiveSentence = [...allExampleSentences]
    .reverse()
    .find((s) =>
      /\b(?:concluimos\s+que|concluyes\s+que|se\s+concluye\s+que|por\s+lo\s+tanto|en\s+conclusi[oó]n|mostrando\s+que|validando\s+que|confirmando\s+(?:visualmente|anal[ií]ticamente|la)|esto\s+(?:demuestra|confirma|indica|muestra)|son\s+t[eé]cnicamente\s+viables|el\s+[aá]rea\s+m[aá]xima|el\s+ancho\s+v[aá]lido|ambos\s+[aá]ngulos\s+miden|estableciendo\s+el\s+nodo|permite\s+calcular\s+el\s+[aá]rea)\b/i.test(
        s
      )
    );
  if (conclusiveSentence) {
    const cleanedConcl = conclusiveSentence
      .replace(/^(?:Por\s+lo\s+tanto|En\s+conclusi[oó]n)\s*,?\s*/i, '')
      .replace(/^(?:Concluimos\s+que|Concluyes\s+que|Se\s+concluye\s+que)\s+/i, '');
    const normalizedConcl = cleanedConcl.charAt(0).toUpperCase() + cleanedConcl.slice(1);
    const candidate = fitConclusion(normalizedConcl);
    if (isSubstantiveConclusion(candidate)) return candidate;
  }

  // 3. Si existe un último paso crudo sustantivo con resultado concreto, extraer su oración conclusiva
  if (rawLastStep) {
    const picked = pickBestConclusionSentence(rawLastStep, fitConclusion);
    if (picked) return picked;
  }

  // 4. Si el texto incluye una cita de reflexión verificable entre comillas ("Aprendí que...")
  const quotedReflection = clean.match(/['"«](Aprend[ií]\s+que[^'"»]{18,160})['"»]/i);
  if (quotedReflection && quotedReflection[1]) {
    const stripped = quotedReflection[1].replace(/^Aprend[ií]\s+que\s+/i, '').trim();
    const capitalized = stripped.charAt(0).toUpperCase() + stripped.slice(1);
    const candidate = fitConclusion(capitalized);
    if (isSubstantiveConclusion(candidate)) return candidate;
  }

  // 5. Última oración sustantiva del ejemplo crudo (evitando repetir pasos o instrucciones meta)
  for (let i = allExampleSentences.length - 1; i >= Math.max(0, allExampleSentences.length - 3); i--) {
    const candidate = fitConclusion(allExampleSentences[i]!);
    if (isSubstantiveConclusion(candidate)) return candidate;
  }

  if (steps.length >= 2) {
    for (let idx = steps.length - 1; idx >= 0; idx--) {
      const picked = pickBestConclusionSentence(steps[idx]!, fitConclusion);
      if (picked) return picked;
    }
  }
  return '';
}

/**
 * Un paso matemático es completo si no termina colgado y contiene operación/igualdad real.
 * Rechaza pasos sintácticamente cerrados pero semánticamente cortados ("...que multiplicados.").
 */
export function isCompleteMathStep(step: string): boolean {
  const clean = (step || '').replace(/\s+/g, ' ').trim();
  if (!clean) return false;
  if (hasDanglingEnding(clean)) return false;
  const body = clean.replace(/[.;:]+$/, '').trim();

  // Un encabezado corto sin datos ni ecuación no es un paso resuelto.
  if (!/[=]|\d/.test(body) && body.length < 50) return false;

  if (
    /\b(?:multiplicad[oa]s|sumad[oa]s|obtenemos|obtenido|obtiene|resolver|sustituir|aplicamos|calculamos|despejamos|factorizamos|igualamos|completamos|resulta|queda|vale)\s*$/i.test(
      body
    )
  ) {
    return false;
  }
  if (/\by\s+[xyab]\s*$/.test(body)) return false;

  return (
    /=|[+\-*/^√]/.test(body) ||
    /\b(?:suma|resta|multiplica|divide|factoriza|sustituye|convierte|eval[uú]a|despeja|completa|traza|representa|grafica|clasifica|compara|argumenta|justifica|identifica|explica|analiza|relaciona|interpreta|distingue|localiza|señala|construye|dibuja|calcula|determina)\b/i.test(
      body
    )
  );
}

/** Conclusión completa: contiene un resultado numérico o afirmación conclusiva cerrada, sin variables colgadas. */
export function isCompleteConclusion(value: string): boolean {
  const clean = (value || '').replace(/\s+/g, ' ').trim();
  if (!clean || clean.length < 14) return false;
  if (hasDanglingEnding(clean)) return false;
  const body = clean.replace(/[.;:]+$/, '').trim();
  if (/^resultados?\s+obtenidos/i.test(body)) return false;
  if (/\by\s+[xy]\s*[₀₁₂₃₄₅₆₇₈₉\d]*\s*$/i.test(body)) return false;
  if (/=\s*$/.test(body)) return false;
  if (/\d/.test(body)) {
    return (
      /=\s*-?\d+(?:[.,]\d+)?/.test(body) ||
      /\b\d+(?:[.,]\d+)?\s*(?:m²|cm²|m|cm|mm|km|u|unidades|pesos|\$|°|grados|a[ñn]os|horas|sillas|personas|kits|m[oó]dulos|paquetes|equipos|j[oó]venes|familias|estudiantes|%)/i.test(body) ||
      /\$\s*\d/.test(body) ||
      /\b(?:es|son|equivale|satisface|obtiene|resulta|alcanza|confirma|demuestra|permite|representa|vale)\b/i.test(body)
    );
  }
  return (
    clean.length >= 24 &&
    !META_CONCLUSION_INSTRUCTION_RE.test(clean) &&
    /\b(?:es|son|demuestra|confirma|indica|muestra|valida|permite|concluye|significa|representa|cumple|evita|garantiza|refleja|revela|satisface|equivale|corresponde)\b/i.test(
      body
    )
  );
}

/** Enunciado de ejemplo completo: datos + unidad/contexto + consigna o pregunta. */
export function isCompleteProblemStatement(value: string): boolean {
  const clean = (value || '').replace(/\s+/g, ' ').trim();
  if (clean.length < 20) return false;
  if (hasDanglingEnding(clean)) return false;

  const hasTask =
    /\?/.test(clean) ||
    /\b(?:calcula|determina|encuentra|halla|resuelve|modela|plantea|formula|indica|escribe|delimita(?:r)?|diseña|traza|clasifica|compara|argumenta|justifica|identifica|explica|analiza|relaciona|interpreta|distingue|localiza|señala(?:r)?|completa|obt[eé]n|verifica|demuestra|eval[uú]a|convierte|sustituye|suma|resta|multiplica|divide|despeja|representa|grafica|mide|analizar|identificar|relacionar|explicar|justificar|comparar|argumentar|interpretar|clasificar|describir|leer|señalar|sustentar)\b/i.test(
      clean
    );
  const hasDeclarativeSetup =
    /[=:]/.test(clean) &&
    (/\d/.test(clean) ||
      /\b(?:an[aá]lisis|balance|proceso|caso|situaci[oó]n|planteamiento|modelo|fen[oó]meno|art[ií]culo|fuente|texto)\b/i.test(
        clean
      ));
  if (!hasTask && !hasDeclarativeSetup && !(/\d/.test(clean) && clean.length >= 60)) return false;

  const hasNumericData =
    /\d/.test(clean) &&
    /(?:[=+*/^$\u00B0\u00B2]|\b(?:m|cm|mm|km|kg|g|l|ml|pesos|unidades|horas|años|personas|sillas)\b)/i.test(
      clean
    );
  const hasDisciplinaryContext =
    /\b(?:figura|triángulo|angulo|ángulo|tabla|gráfica|grafica|texto|caso|situación|problema|proceso|diagrama|mapa|experimento|fuente|concepto|ejemplo|modelo|conjunto|función|funcion|ecuación|ecuacion|artículo|articulo|balance|fenómeno|fenomeno|planteamiento)\b/i.test(
      clean
    );

  return hasNumericData || hasDisciplinaryContext || (/\d/.test(clean) && clean.length >= 60);
}

/** Un error común genérico no explica ningún error conceptual real. */
export function isGenericMisconception(value: string): boolean {
  const clean = (value || '').trim();
  if (clean.length < 25) return true;
  return /^(?:resultados?\s+obtenidos|error\s+com[uú]n|revisar|analizar|evaluar|comprobar|verificar)\b/i.test(clean);
}
