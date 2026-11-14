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
  /ponderaci[oó]n\s*:\s*\d+\s*%|excelente\s*\(\s*\d+\s*(?:pts?|puntos?)\s*\)|bueno\s*\(\s*\d+\s*(?:pts?|puntos?)\s*\)|suficiente\s*\(\s*\d+\s*(?:pts?|puntos?)\s*\)|insuficiente\s*\(\s*\d+\s*(?:pts?|puntos?)\s*\)|este\s+(?:ejercicio|apartado)\s+de\s+\d+\s+palabras/i;

const BOILERPLATE_PREFIX_RE =
  /^(?:(?:misi[oó]n|bloque|sesi[oó]n)\s*\d+\s*:\s*)+(?:optimizaci[oó]n\s+y\s+consolidaci[oó]n\s+de\s+la\s+evidencia|exploraci[oó]n\s+diagn[oó]stica\s+y\s+problematizaci[oó]n\s+situada|modelado\s+metodol[oó]gico\s+y\s+procedimientos\s+clave|evaluaci[oó]n\s+(?:de\s+logros|sumativa|diagn[oó]stica)|fundamentaci[oó]n\s+e\s+intuici[oó]n)\s*[—–\-:]\s*/i;

const CHALKBOARD_VERB_LEAD_RE =
  /^(?:(?:en\s+esta\s+sesi[oó]n|durante\s+esta\s+(?:clase|sesi[oó]n)|hoy|al\s+finalizar\s+la\s+sesi[oó]n)\s*,?\s+)?(?:(?:vas\s+a|aprender[aá]s\s+a|lograr[aá]s|podr[aá]s|vamos\s+a|deber[aá]s)\s+)?(?:(?:aprender\s+a|comenzar\s+a|terminar\s+de|volver\s+a|continuar\s+a)\s+)?(?:(?:y|e|o)\s+)?(?:(?:identificar|comprender|analizar|aplicar|resolver|modelar|calcular|construir|explorar|reconocer|utilizar|interpretar|evaluar|comparar|explicar|traducir|plantear|desarrollar|integrar|verificar|validar|formular|dise[ñn]ar|estructurar|realizar|ejecutar|sistematizar|sintetizar|argumentar|contrastar|deducir|inferir|estimar|medir|graficar|representar|diagnosticar|revisar|presentar|socializar|consolidar|optimizar|depurar|dominar|emplear|establecer|determinar|sustentar|justificar|elaborar|redactar|exponer|defender)[a-záéíóúñ]*(?:\s*(?:,\s*|\s+(?:y|e|o)\s+|\s+a\s+)[a-záéíóúñ]+(?:ar|er|ir|rse))*\s+)+(?:(?:formativamente|colaborativamente|aut[oó]nomamente|cr[ií]ticamente|anal[ií]ticamente|rigurosamente|sistem[aá]ticamente|paso\s+a\s+paso)\s+)?(?:(?:tus|sus|los|las)\s+(?:aprendizajes|conocimientos|saberes|habilidades|competencias|procedimientos|resultados|avances)(?:\s+y\s+(?:consolidar|aplicar|validar|presentar|integrar|socializar)[a-záéíóúñ]*\s+)?)?(?:c[oó]mo\s+|qu[eé]\s+(?:es|son)\s+|cu[aá]ndo\s+)?(?:el\s+concepto\s+de\s+|la\s+importancia\s+de\s+|el\s+uso\s+de\s+|la\s+aplicaci[oó]n\s+de\s+|una?\s+revisi[oó]n\s+de\s+|un[ao]?\s+|el\s+|la\s+|los\s+|las\s+|tus\s+|sus\s+)?/i;

const CHALKBOARD_PURPOSE_TAIL_RE =
  /\s*(?:,\s*)?(?:para\s+(?:que|resolver|modelar|determinar|calcular|analizar|comprender|aplicar|explicar|evaluar|comparar|tomar|fundamentar|optimizar|identificar|construir|interpretar|verificar|validar|lograr|obtener|establecer|representar)|con\s+el\s+prop[oó]sito\s+de|con\s+la\s+finalidad\s+de|a\s+fin\s+de|evaluando\s+registros|utilizando\s+datos\s+de\s+tu|en\s+situaciones\s+de\s+tu\s+entorno|como\s+una?\s+herramienta\s+[a-záéíóúñ]+\s+fundamental\s+para)\b.*$/i;

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

function cleanSacrintTextPreservingLines(value: string | null | undefined): string {
  if (!value) return '';
  let text = stripWorkbookTags(value);
  text = stripMaterialTokens(text);
  text = text
    .replace(/^\s*[-*_]{3,}\s*$/gm, ' ')
    .replace(/(^|\r?\n)\s{0,3}#{1,6}\s+/g, '$1')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '$1');
  text = stripInlineMarkdownEmphasis(text);
  text = normalizeMathNotation(text);
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

/** Detecta fragmentos de rúbricas de evaluación o instrucciones de prompt filtradas en campos de contenido. */
export function isRubricOrBoilerplateLeak(value: string | null | undefined): boolean {
  const cleaned = cleanSacrintText(value);
  if (!cleaned) return false;
  if (RUBRIC_OR_META_LEAK_RE.test(cleaned)) return true;
  if (/^r[úu]brica\s+anal[íi]tica\s*[:\-–]?$/i.test(cleaned)) return true;
  if (
    /r[úu]brica\s+anal[íi]tica/i.test(cleaned) &&
    /criterio\s*:|ponderaci[oó]n|excelente|insuficiente|requiere\s+apoyo|niveles?\s+de\s+desempe[ñn]o|\b\d+\s*(?:pts?|puntos?|%)/i.test(
      cleaned
    )
  ) {
    return true;
  }
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
 * Sintetiza un objetivo extenso ("Vas a identificar el concepto de ecuación...") en un
 * título conciso de pizarrón para el docente ("Concepto de ecuación para modelar situaciones").
 */
export function extractChalkboardTopicTitle(
  rawObjectiveOrTitle: string | null | undefined,
  fallbackTopic?: string | null
): string {
  const base = extractCleanTopicTitle(rawObjectiveOrTitle, fallbackTopic)
    .replace(/^(?:sesi[oó]n|clase)\s*\d+\s*[:.\-–—]\s*/i, '')
    .trim();
  if (!base) return 'Concepto central de la clase';

  const firstSentence = base.split(/(?<=[.?!])\s+/)[0] || base;
  let concise = firstSentence
    .replace(
      /\s+como\s+una?\s+herramienta\s+[a-záéíóúñ\s]+?\s+para\s+([a-záéíóúñ]+(?:ar|er|ir))\b/i,
      ' para $1'
    )
    .replace(CHALKBOARD_VERB_LEAD_RE, '')
    .replace(CHALKBOARD_VERB_LEAD_RE, '')
    .replace(/^(?:(?:y|e|o)\s+)?(?:formativamente|colaborativamente|aut[oó]nomamente|cr[ií]ticamente|anal[ií]ticamente)\s+(?:los\s+|las\s+|el\s+|la\s+)?/i, '')
    .replace(/^(?:tus|sus)\s+(?:aprendizajes|conocimientos|saberes|procedimientos)(?:\s+y\s+(?:consolidar|aplicar|validar|integrar|socializar)[a-záéíóúñ]*\s+(?:el\s+|la\s+|los\s+|las\s+)?)?/i, '')
    .replace(CHALKBOARD_PURPOSE_TAIL_RE, '')
    .replace(/\s+y\s+activar[aá]s\s+tus(?:\s+[a-záéíóúñ]+)?$/i, '')
    .replace(/\s+(?:de|del|en|con|por|para|mediante|utilizando|como|y|o|el|la|los|las|un|una|tus|sus)\s*$/i, '')
    .replace(/[,;:\-–—]+$/, '')
    .trim();

  if (concise.length < 14) {
    concise = firstSentence
      .replace(CHALKBOARD_VERB_LEAD_RE, '')
      .replace(CHALKBOARD_VERB_LEAD_RE, '')
      .replace(/\s+y\s+activar[aá]s\s+tus(?:\s+[a-záéíóúñ]+)?$/i, '')
      .replace(/\s+(?:de|del|en|con|por|para|mediante|utilizando|como|y|o|el|la|los|las|un|una|tus|sus)\s*$/i, '')
      .replace(/[,;:\-–—]+$/, '')
      .trim();
  }
  if (!concise) concise = base;
  const bounded =
    concise.length > 68
      ? trimAtCleanBoundary(concise, 68)
          .replace(/\s+(?:de|del|en|con|por|para|mediante|utilizando|como|y|o|el|la|los|las|un|una|tus|sus)\s*$/i, '')
          .replace(/[,;:\-–—]+$/, '')
          .trim()
      : concise;
  return bounded.charAt(0).toUpperCase() + bounded.slice(1);
}

/**
 * Limpia subtítulos de portada o síntesis de misión que contengan listas "Sesión 1: ... · Sesión 2: ..."
 * o cortes de presupuesto como "... y activarás tus".
 */
export function cleanMissionTopicLine(
  rawTopic: string | null | undefined,
  fallbackTitle?: string | null
): string {
  const clean = cleanSacrintText(rawTopic)
    .replace(/\s+y\s+activar[aá]s\s+tus(?:\s+[a-záéíóúñ]+)?(?=[\s·.,;:]|$)/gi, '')
    .replace(/\s+(?:de|del|en|con|por|para|mediante|utilizando|como|y|o|el|la|los|las|un|una|tus|sus)\s*(?=·|$)/gi, '')
    .trim();
  if (!clean) return cleanSacrintText(fallbackTitle) || 'Síntesis curricular de la misión';

  if (/sesi[oó]n\s*\d+\s*:/i.test(clean)) {
    const parts = clean
      .split(/\s*·\s*/)
      .map((part) => {
        const m = part.match(/^(sesi[oó]n\s*\d+)\s*:\s*(.+)$/i);
        if (!m) return extractChalkboardTopicTitle(part);
        return `${m[1]}: ${extractChalkboardTopicTitle(m[2])}`;
      })
      .filter(Boolean);
    if (parts.length > 0) {
      return parts.slice(0, 4).join(' · ');
    }
  }

  return distillConciseText(clean, 175, 28) || clean;
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
  /(?:\b(?:sen|cos|tan)\s*(?:\([A-Za-z0-9θ°αβ\s+-]+\)|[θ°αβ]|\d+\s*°)\s*=\s*[-+0-9A-Za-z/()*^²³√.,\s]{1,32}|(?:[A-Za-zΔ][0-9₀₁₂]?(?:\([A-Za-z0-9,\s+-]+\))?|\d+\s*[A-Za-z²³]+(?:\s*[+-]\s*\d*\s*[A-Za-z²³]+)*|\d*\s*[A-Za-z]²(?:\s*[+-]\s*\d*\s*[A-Za-z])?(?:\s*[+-]\s*\d+)?|\([A-Za-z0-9\s+-]+\))\s*=\s*[-+0-9A-Za-zθ°αβπΔ/()*^²³√.,\s]{1,44})/g;

const NON_MATH_PROSE_WORD_RE =
  /\b(?:(?!sen\b|cos\b|tan\b|log\b|ln\b|lim\b|max\b|min\b|mod\b|cte\b|const\b)[A-Za-záéíóúñÁÉÍÓÚÑ]{3,}|(?:en|el|la|de|un|al|se|es|si|ya|no|ni|mi|tu|su|lo|le|me|te|va|da|ha|he|del|por|con|sin|mas|más|que|como|para|pero|sino)\b|[yoaeu]\s+[A-Za-záéíóúñÁÉÍÓÚÑ]{2,})/i;

function sanitizeExtractedFormula(rawCandidate: string): string {
  const eqParts = rawCandidate.split('=');
  if (eqParts.length < 2) return '';
  const lhs = eqParts[0].trim();
  let rhs = eqParts.slice(1).join('=').trim();

  // Reject if LHS contains Spanish prose words
  if (NON_MATH_PROSE_WORD_RE.test(lhs)) return '';

  // Truncate RHS right before the first Spanish prose word
  const proseMatch = rhs.match(NON_MATH_PROSE_WORD_RE);
  if (proseMatch && proseMatch.index !== undefined) {
    rhs = rhs.slice(0, proseMatch.index).trim();
  }

  // Strip trailing operators or unbalanced punctuation
  rhs = rhs.replace(/[+\-*/^.,;:\s]+$/, '').trim();
  const openParens = (rhs.match(/\(/g) || []).length;
  const closeParens = (rhs.match(/\)/g) || []).length;
  if (closeParens > openParens) {
    rhs = rhs.replace(/\)+$/, '');
  }
  if (!lhs || !rhs) return '';

  const formula = `${lhs} = ${rhs}`;
  // Require at least one digit, math operator, superscript, or explicit function/Greek symbol
  if (!/[0-9+\-*/^²³√()Δπθ°]/.test(formula)) return '';
  return formula;
}

/** Extrae fórmulas o ecuaciones relevantes presentes en teoría o ejemplos sin fragmentos de prosa. */
export function extractFormulasFromText(text: string, limit = 3): string[] {
  const clean = cleanSacrintText(text);
  if (!clean) return [];
  const found: string[] = [];
  for (const match of clean.matchAll(MATH_EXPR_RE)) {
    const candidate = sanitizeExtractedFormula(match[0]);
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

const STEP_HEADING_ONLY_RE =
  /^(?:(?:comprensi[oó]n|identificaci[oó]n|planteamiento|traducci[oó]n|resoluci[oó]n|despeje|sustituci[oó]n|verificaci[oó]n|comprobaci[oó]n|interpretaci[oó]n|conclusi[oó]n|an[aá]lisis|c[aá]lculo|determinaci[oó]n|evaluaci[oó]n|organizaci[oó]n|aplicaci[oó]n|simplificaci[oó]n|reducci[oó]n|igualaci[oó]n|factorizaci[oó]n|graficaci[oó]n|tabulaci[oó]n|comparaci[oó]n|selecci[oó]n|definici[oó]n|modelado|formulaci[oó]n)[^.?!:=0-9]{0,65}[.:]\s*)/i;

/**
 * Sintetiza un paso de resolución asegurando que NUNCA se pierdan las ecuaciones,
 * operaciones o datos numéricos cuando la primera oración es un subtítulo descriptivo.
 */
export function distillStepPreservingMath(rawStep: string, maxChars = 185): string {
  const clean = cleanStepLine(rawStep);
  if (!clean || isRubricOrBoilerplateLeak(clean)) return '';
  if (clean.length <= maxChars) return clean;

  // Quitar subtítulo inicial ("Comprensión e identificación de datos.", "Resolución paso a paso.") si después hay contenido real
  const withoutHeading = clean.replace(STEP_HEADING_ONLY_RE, '').trim();
  const working = withoutHeading.length >= 16 ? withoutHeading : clean;
  if (working.length <= maxChars) return working;

  const sentences = working
    .split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ0-9(¿¡\-])/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sentences.length >= 2) {
    const mathSentences = sentences.filter((s) => /[0-9=+\-*/^²³√%→]/.test(s));
    if (mathSentences.length > 0) {
      const joinedMath = mathSentences.join(' ');
      if (joinedMath.length <= maxChars) {
        if (!mathSentences.includes(sentences[0]) && sentences[0].length + joinedMath.length + 1 <= maxChars) {
          return `${sentences[0]} ${joinedMath}`;
        }
        return joinedMath;
      }
      // Si las oraciones con matemáticas aún exceden maxChars, cortar en límite de palabra sin borrar la segunda oración en el primer punto
      return joinedMath.slice(0, maxChars).replace(/\s+\S*$/, '').replace(/[,;:\-]+$/, '').trim();
    }
  }

  return distillConciseText(working, maxChars);
}

/**
 * Sintetiza un problema o ejercicio preservando íntegros los números, ecuaciones y la pregunta final.
 * Evita que `trimAtCleanBoundary` corte en el punto de la primera oración eliminando la pregunta o los datos.
 */
export function distillProblemOrExerciseText(
  rawText: string | null | undefined,
  maxChars = 265
): string {
  const clean = cleanSacrintText(rawText)
    .replace(/^(?:planteamiento|problema|enunciado|situaci[oó]n)\s*[:.\-–]\s*/i, '')
    .trim();
  if (!clean || isRubricOrBoilerplateLeak(clean)) return '';
  if (clean.length <= maxChars) return clean;

  const sentences = clean
    .split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ0-9(¿¡])/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sentences.length >= 2) {
    // Priorizar las oraciones que contienen datos numéricos, ecuaciones, signos de interrogación o verbos de consigna
    const essential = sentences.filter(
      (s, idx) =>
        idx > 0 ||
        /[0-9=¿?%$²³]/.test(s) ||
        /\b(?:calcula|determina|encuentra|resuelve|plantea|obtiene|redacta|analiza|explica|compara|identifica|prop[oó]n|elabora|construye|eval[úu]a|cu[aá]nto|cu[aá]l|qu[eé])\b/i.test(
          s
        )
    );
    // Si la primera oración es puramente narrativa (sin números ni pregunta) y el resto sí cabe:
    const tailWithoutIntro = sentences.slice(1).join(' ');
    if (
      !/[0-9=¿?%$]/.test(sentences[0]) &&
      tailWithoutIntro.length >= 35 &&
      tailWithoutIntro.length <= maxChars
    ) {
      return tailWithoutIntro;
    }
    const essentialJoined = essential.join(' ');
    if (essentialJoined.length >= 35 && essentialJoined.length <= maxChars) {
      return essentialJoined;
    }
  }

  // Si aún excede maxChars, cortar en el último espacio antes de maxChars sin retroceder hasta el primer punto
  const sliced = clean.slice(0, maxChars).replace(/\s+\S*$/, '').replace(/[,;:\-]+$/, '').trim();
  return /[.?!]$/.test(sliced) ? sliced : `${sliced}.`;
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

  const definitionSentences = extractBulletSentences(definitionSource, 3, 185);
  const conceptualDefSentence =
    definitionSentences.find(
      (s) =>
        !/^(?:imagina|piensa|observa|recuerda|en\s+esta\s+sesi[oó]n|hoy\s+vas)/i.test(s) &&
        s.length >= 24
    ) || definitionSentences[0];
  const definition = conceptualDefSentence || distillConciseText(definitionSource, 200, 34);

  const rulePoolText = [
    ...candidateTexts,
    allowMission ? cleanSacrintText(mission.conceptZero?.coreExplanation) : '',
    analogyClean,
    !allowMission ? cleanSacrintText(session?.saberesPrevios || session?.motivacion) : '',
  ]
    .filter(Boolean)
    .join(' ');
  const allCandidateRules = extractBulletSentences(rulePoolText, 6, 155).filter(
    (r) =>
      r !== definition &&
      r.length >= 25 &&
      !/^(?:imagina\s+que|sup[oó]n\s+que|recuerda\s+cuando)\b/i.test(r)
  );
  const keyRules = allCandidateRules.slice(0, 3);

  if (keyRules.length === 0 && analogyClean) {
    const analogyPoint = distillConciseText(analogyClean, 145, 25);
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

const CONCLUSION_HEADING_PREFIX_RE =
  /^(?:(?:verificaci[oó]n|comprobaci[oó]n|interpretaci[oó]n|conclusi[oó]n|validaci[oó]n|cierre)[^.?!:=0-9]{0,55}[.:]\s*)/i;

function extractExampleConclusion(
  rawExample: string,
  steps: string[],
  rawLastStep?: string
): string {
  // 1. Si existe un 4to paso crudo ("Paso 4: Verificación e interpretación..."), extraer su conclusión real
  if (rawLastStep) {
    const cleanedLast = cleanStepLine(rawLastStep).replace(CONCLUSION_HEADING_PREFIX_RE, '').trim();
    if (cleanedLast.length >= 18) {
      const distilled = distillStepPreservingMath(cleanedLast, 165);
      if (distilled.length >= 15) return distilled;
    }
  }

  const clean = cleanSacrintText(rawExample);
  // 2. Buscar etiqueta explícita con dos puntos obligatorios ("Conclusión:", "Resultado final:", "Respuesta:")
  const explicitMatch = clean.match(
    /(?:conclusi[oó]n(?:\s+final|\s+pedag[oó]gica)?|interpretaci[oó]n(?:\s+del\s+resultado)?|resultado\s+final|respuesta\s+final)\s*:\s*([^.?!]+(?:\.\d+[^.?!]*)?[.?!]?)/i
  );
  if (explicitMatch && explicitMatch[1]) {
    const candidate = distillConciseText(explicitMatch[1].replace(CONCLUSION_HEADING_PREFIX_RE, ''), 165, 28);
    if (candidate.length >= 16) return candidate;
  }

  // 3. Buscar oración con "Por lo tanto," o "En conclusión,"
  const connectorMatch = clean.match(
    /\b(?:por\s+lo\s+tanto|en\s+conclusi[oó]n)\s*,\s*([^.?!]+(?:\.\d+[^.?!]*)?[.?!]?)/i
  );
  if (connectorMatch && connectorMatch[1]) {
    const candidate = distillConciseText(connectorMatch[1], 165, 28);
    if (candidate.length >= 16) return candidate;
  }

  if (steps.length >= 2) {
    const lastStep = steps[steps.length - 1]
      .replace(CONCLUSION_HEADING_PREFIX_RE, '')
      .trim();
    if (lastStep && lastStep.length >= 16) {
      return distillConciseText(lastStep, 165, 28);
    }
  }
  return '';
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
    const preservedSessionExample = cleanSacrintTextPreservingLines(rawSessionExample);
    const cleanedSessionExample = cleanSacrintText(rawSessionExample);
    const parsed = parseEjemploResuelto(preservedSessionExample);
    const statement = distillProblemOrExerciseText(parsed.enunciado, 260);
    const cleanedRawSteps = parsed.pasos
      .map(cleanStepLine)
      .filter((step) => step.length >= 8 && !isRubricOrBoilerplateLeak(step));
    const steps = cleanedRawSteps
      .map((step) => distillStepPreservingMath(step, 185))
      .filter(Boolean)
      .slice(0, 4);

    if (steps.length > 0) {
      const fourthRawStep = cleanedRawSteps.length >= 4 ? cleanedRawSteps[cleanedRawSteps.length - 1] : undefined;
      const derivedConclusion = extractExampleConclusion(rawSessionExample, steps, fourthRawStep);
      return {
        problemStatement:
          statement ||
          (allowMission ? distillProblemOrExerciseText(solved?.problemStatement, 250) : '') ||
          distillConciseText(session?.objetivo, 200, 34) ||
          'Por completar en el libro: planteamiento del ejemplo.',
        steps,
        interpretation:
          derivedConclusion ||
          (allowMission ? distillConciseText(solved?.interpretation, 165, 28) : '') ||
          'Verifica que el resultado obtenido responda con coherencia al planteamiento inicial.',
      };
    }

    if (!allowMission && cleanedSessionExample) {
      const bulletSteps = extractBulletSentences(cleanedSessionExample, 3, 175);
      const effectiveSteps =
        bulletSteps.length >= 2
          ? bulletSteps
          : [
              distillStepPreservingMath(cleanedSessionExample, 175),
              'Desarrolla el procedimiento o criterio del tema conforme a la consigna.',
              'Comunica la conclusión con evidencia y verifica su coherencia.',
            ].filter(Boolean);
      return {
        problemStatement:
          statement ||
          distillProblemOrExerciseText(cleanedSessionExample, 250) ||
          distillConciseText(session?.objetivo, 200, 34),
        steps: effectiveSteps,
        interpretation:
          extractExampleConclusion(rawSessionExample, effectiveSteps) ||
          'Verifica que el resultado responda con coherencia al planteamiento.',
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

  const rawMissionSteps = (solved?.solutionSteps ?? [])
    .map(cleanStepLine)
    .filter((s) => s.length >= 6 && !isRubricOrBoilerplateLeak(s));
  const missionSteps = rawMissionSteps
    .map((s) => distillStepPreservingMath(s, 185))
    .filter(Boolean)
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

  return {
    problemStatement: cleanStatement,
    steps: derivedSteps,
    interpretation:
      distillConciseText(solved?.interpretation, 165, 28) ||
      extractExampleConclusion(demoRaw, derivedSteps, fourthMissionStep) ||
      'Comunica la conclusión con evidencia y contrástala con el contexto real de la situación.',
  };
}

/**
 * Sintetiza el enunciado de un ejercicio preservando los datos numéricos, ecuaciones y la pregunta/consigna.
 */
function distillExerciseStatement(rawEnunciado: string | null | undefined, maxChars = 265): string {
  return distillProblemOrExerciseText(rawEnunciado, maxChars);
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
      statement: distillExerciseStatement(item.enunciado, 235),
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
  const topicTitle = session
    ? extractChalkboardTopicTitle(
        session.objetivo || session.contenido || fallbackSessionTitle,
        allowMission ? mission.sessionTopic || mission.title : fallbackSessionTitle
      )
    : extractCleanTopicTitle(
        mission.sessionTopic || mission.title,
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
