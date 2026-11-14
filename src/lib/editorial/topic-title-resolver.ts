/**
 * topic-title-resolver.ts — Resolvedor Estructural de Títulos de Pizarrón e Infografía (SSoT)
 * SIGPDA-EMS · Motor Editorial Compartido
 *
 * Reemplaza cadenas de regex aisladas por una resolución jerárquica:
 * Prioridad 1: título explícito de concepto/sección disciplinar de la sesión.
 * Prioridad 2: objetivo de la sesión tras despojar muletillas pedagógicas/metacognitivas.
 * Prioridad 3: sessionTopic de la misión (sin prefijos genéricos de fase).
 * Prioridad 4: missionTitle limpio.
 */

import { normalizeEditorialText } from './text-normalization';
import { fitPedagogicalText, hasDanglingEnding, repairDanglingEnding } from './pedagogical-text-fitter';

export interface TopicTitleInput {
  sectionTitle?: string | null;
  conceptosClave?: string | null;
  sessionObjective?: string | null;
  missionSessionTopic?: string | null;
  missionFocus?: string | null;
  missionTitle?: string | null;
  maxChars?: number;
}

const INVALID_TITLE_START_RE =
  /^(?:y\b|e\b|o\b|sobre\b|tu\b|tus\b|su\b|sus\b|vas\s+a\b|versi[oó]n\s+depurada\b|evidencia\s+formativa\b|p[uú]blicamente\b|hallazgos\b|en\s+esta\s+sesi[oó]n\b|durante\s+la\b|para\s+que\b|mediante\s+la\b|a\s+trav[eé]s\s+de\b)/i;

const STRUCTURAL_HEADING_ONLY_RE =
  /^(?:sesi[oó]n|misi[oó]n|bloque|corte|fase|momento|apertura|desarrollo|cierre|actividad|ejemplo(?:\s+resuelto)?|ejercicio|concepto(?:\s+clave)?|fundamentaci[oó]n\s+te[oó]rica|pr[aá]ctica(?:\s+guiada)?)\s*(?:n[uú]mero\s*)?\d*$/i;

const EVALUATION_OR_CLOSURE_ONLY_RE =
  /\b(?:versi[oó]n\s+depurada|evidencia\s+formativa|portafolio\s+de\s+evidencias|bit[aá]cora\s+metacognitiva|revisi[oó]n\s+cruzada|retroalimentaci[oó]n\s+entre\s+pares|autoevaluaci[oó]n|coevaluaci[oó]n|defender\s+p[uú]blicamente|socializaci[oó]n\s+de\s+proyectos)\b/i;

/**
 * Determina si un texto es un objetivo de cierre/evaluación administrativa en lugar de un concepto disciplinar.
 */
export function isEvaluationOrClosureObjective(text: string | null | undefined): boolean {
  if (!text) return false;
  return EVALUATION_OR_CLOSURE_ONLY_RE.test(text);
}

/**
 * Limpia prefijos genéricos de misión/fase ("Misión 3: Proyecto Integrador — Sesión 13: Exploración Diagnóstica — ").
 */
export function stripPhaseAndMissionBoilerplate(raw: string | null | undefined): string {
  if (!raw) return '';
  let text = normalizeEditorialText(raw).replace(/\s+/g, ' ').trim();

  for (let i = 0; i < 4; i++) {
    const prev = text;
    text = text
      .replace(/^misi[oó]n\s*\d+\s*[:·\-–—]\s*/i, '')
      .replace(/^(?:fundamentaci[oó]n\s+y\s+activaci[oó]n|pr[aá]ctica\s+y\s+aplicaci[oó]n(?:\s*\([^)]*\))?|proyecto\s+integrador|evaluaci[oó]n\s+y\s+cierre)\s*(?:[:·\-–—]\s*|\s+sesi[oó]n\s*\d+\s*[:·\-–—]?\s*)?/i, '')
      .replace(/^sesi[oó]n\s*\d+\s*(?:\([^)]*\))?\s*(?:[:·\-–—]\s*|$)/i, '')
      .replace(/^misi[oó]n\s*\d+\s*(?:\([^)]*\))?\s*$/i, '')
      .replace(/^(?:exploraci[oó]n\s+diagn[oó]stica\s+y\s+problematizaci[oó]n\s+situada|modelado\s+metodol[oó]gico\s+y\s+procedimientos\s+clave|optimizaci[oó]n\s+y\s+consolidaci[oó]n\s+de\s+la\s+evidencia|pr[aá]ctica\s+colaborativa|apertura\s+y\s+modelado\s+conceptual)\s*[:·\-–—]\s*/i, '')
      .replace(/\(\s*sesiones?\s*\d+(?:\s*(?:a|-|–|,)\s*\d+)*\s*\)\s*$/i, '')
      .trim();
    if (text === prev) break;
  }

  return text;
}

/**
 * Extrae el núcleo conceptual disciplinar de un enunciado de objetivo o título de sesión,
 * eliminando muletillas como "Vas a recuperar tus saberes previos y delimitar...",
 * "Evaluarás tus conocimientos sobre...", "Versión depurada y validada de tu evidencia formativa sobre...".
 */
export function extractDisciplinaryConceptPhrase(raw: string | null | undefined): string {
  if (!raw) return '';
  let text = stripPhaseAndMissionBoilerplate(raw);
  if (!text) return '';

  // Si contiene "...de tu proyecto integrador comunitario mediante la aplicación (rigurosa) de(l) <CONCEPTO>"
  const medianteAplicacionMatch = text.match(
    /\b(?:defender\s+p[uú]blicamente|presentar|socializar|evaluar\s+tu\s+aprendizaje)[^,.]{0,90}?\bmediante\s+la\s+aplicaci[oó]n(?:\s+rigurosa)?\s+(?:de(?:l)?|de\s+los|de\s+las)\s+(.+)$/i
  );
  if (medianteAplicacionMatch && medianteAplicacionMatch[1].trim().length >= 12) {
    text = medianteAplicacionMatch[1].trim();
  }

  // Si contiene "...evidencia formativa (sobre|de|integrando|mediante) <CONCEPTO>"
  const evidenciaMatch = text.match(
    /\bevidencia\s+formativa\s+(?:sobre\s+(?:los\s+|las\s+|el\s+|la\s+)?|de\s+(?:los\s+|las\s+|el\s+|la\s+)?|integrando\s+(?:la\s+|el\s+|los\s+|las\s+)?|mediante\s+(?:la\s+|el\s+)?)(.+)$/i
  );
  if (evidenciaMatch && evidenciaMatch[1].trim().length >= 10) {
    text = evidenciaMatch[1].trim();
  }

  // Eliminar arranques verbales y muletillas pedagógicas en cascada
  for (let pass = 0; pass < 4; pass++) {
    const prev = text;
    text = text
      .replace(
        /^(?:en\s+esta\s+sesi[oó]n\s+|hoy\s+)?(?:vas\s+a\s+|vamos\s+a\s+|el\s+estudiante\s+|lograr[aá]s\s+)?(?:recuperar(?:\s+tus)?\s+saberes\s+previos(?:\s+sobre|\s+acerca\s+de|\s+y\s+delimitar(?:[aá]s)?)?|activar(?:\s+tus)?\s+saberes\s+previos(?:\s+sobre|\s+y)?|integrar,\s*evaluar\s+formativamente\s+y\s+reflexionar\s+sobre(?:\s+tus\s+aprendizajes\s+de)?|optimizar,\s*depurar\s+y\s+validar(?:\s+tu\s+evidencia\s+formativa\s+(?:sobre|de))?|optimizar\s+y\s+consolidar(?:\s+tu\s+evidencia\s+formativa\s+(?:mediante|integrando|sobre|de))?|evaluar(?:[aá]s)?\s+(?:tus\s+(?:conocimientos|aprendizajes)\s+(?:sobre|de)\s+|tu\s+aprendizaje\s+mediante\s+(?:la\s+aplicaci[oó]n\s+de\s+)?)|defender(?:\s+p[uú]blicamente)?(?:\s+los\s+hallazgos\s+de\s+tu\s+proyecto(?:\s+integrador)?(?:\s+comunitario)?\s+mediante\s+(?:la\s+aplicaci[oó]n(?:\s+rigurosa)?\s+de(?:l)?\s+)?)?|aprender(?:[aá]s)?\s+a\s+|comprender(?:[aá]s)?\s+y\s+aplicar(?:[aá]s)?\s+|identificar(?:[aá]s)?\s+y\s+aplicar(?:[aá]s)?\s+|visualizar(?:[aá]s)?\s+|representar(?:[aá]s)?\s+|graficar(?:[aá]s)?\s+|tabular(?:[aá]s)?\s+|modelar(?:[aá]s)?\s+|calcular(?:[aá]s)?\s+|determinar(?:[aá]s)?\s+|clasificar(?:[aá]s)?\s+|medir(?:[aá]s)?\s+|verificar(?:[aá]s)?\s+|argumentar(?:[aá]s)?\s+|elaborar(?:[aá]s)?\s+|dise[ñn]ar(?:[aá]s)?\s+|interpretar(?:[aá]s)?\s+|sintetizar(?:[aá]s)?\s+|presentar(?:[aá]s)?\s+|socializar(?:[aá]s)?\s+|exponer(?:[aá]s)?\s+|trabajar(?:[aá]s)?\s+|comparar(?:[aá]s)?\s+|identificar(?:[aá]s)?\s+|comprender(?:[aá]s)?\s+|analizar(?:[aá]s)?\s+|aplicar(?:[aá]s)?\s+|resolver(?:[aá]s)?\s+|construir(?:[aá]s)?\s+y\s+analizar(?:[aá]s)?\s+|construir(?:[aá]s)?\s+|estructurar(?:[aá]s)?\s+|dominar(?:[aá]s)?\s+|contrastar(?:[aá]s)?\s+|delimitar(?:[aá]s)?\s+|explorar(?:[aá]s)?\s+|consolidar(?:[aá]s)?\s+|reflexionar(?:[aá]s)?\s+sobre(?:\s+tus\s+aprendizajes\s+de)?\s+|realizar(?:[aá]s)?\s+)/i,
        ''
      )
      .replace(
        /^(?:versi[oó]n\s+depurada\s+y\s+validada\s+de\s+tu\s+evidencia\s+formativa\s+(?:sobre|de)\s+|tu\s+evidencia\s+formativa\s+(?:sobre|de|integrando|mediante)\s+|tu\s+aprendizaje\s+mediante\s+(?:la\s+aplicaci[oó]n\s+de\s+)?|tus\s+aprendizajes\s+de\s+|tus\s+conocimientos\s+sobre\s+)/i,
        ''
      )
      .replace(
        /^(?:el\s+concepto\s+(?:fundamental\s+)?de\s+|los\s+conceptos\s+fundamentales\s+de\s+|(?:la\s+)?fundamentaci[oó]n\s+te[oó]rica(?:\s*(?:,|y|sobre|de)\s*(?:el\s+procedimiento(?:\s+(?:algebraico|gr[aá]fico|matem[aá]tico))?(?:\s+para)?\s*)?)?|(?:el|los)\s+procedimientos?\s+(?:algebraicos?\s+|gr[aá]ficos?\s+)?para\s+|el\s+m[eé]todo\s+de\s+|los\s+m[eé]todos\s+de\s+)/i,
        ''
      )
      .replace(/^(?:y\s+|e\s+|o\s+|sobre\s+|de\s+|del\s+|en\s+|con\s+|para\s+|por\s+|mediante\s+)/i, '')
      .replace(/^(?:el\s+|la\s+|los\s+|las\s+|un\s+|una\s+|tu\s+|tus\s+|su\s+|sus\s+)/i, '')
      .trim();
    if (text === prev) break;
  }

  // Cortar colas circunstanciales o administrativas que no son parte del concepto disciplinar
  text = text
    .replace(/\s+y\s+(?:activar[aá]s|delimitar[aá]s|aplicar[aá]s|evaluar[aá]s|reflexionar[aá]s|presentar[aá]s|socializar[aá]s|defender[aá]s|validar[aá]s|consolidar[aá]s|comunicar[aá]s|interpretar[aá]s|verificar[aá]s)\b.*$/i, '')
    .replace(/\s+y\s+su\s+relaci[oó]n\s+con\s+la\s+problem[aá]tica\b.*$/i, '')
    .replace(/\s+como\s+una\s+herramienta(?:\s+matem[aá]tica)?(?:\s+fundamental)?\s+para\s+modelar.*$/i, ' y modelado de situaciones')
    .replace(/\s+para\s+modelar\s+situaciones\s+de\s+tu\s+entorno.*$/i, '')
    .replace(/\s+vinculad[oa]s?\s+al\s+(?:dise[ñn]o|PAEC|contexto|proyecto).*$/i, '')
    .replace(/\s+en\s+el\s+an[aá]lisis\s+de\s+din[aá]micas.*$/i, '')
    .replace(/\s+mediante\s+(?:una\s+bit[aá]cora|la\s+construcci[oó]n\s+de\s+una\s+matriz|una\s+r[uú]brica|un\s+rigor).*$/i, '')
    .replace(/\s+aplicando\s+un\s+rigor\s+met[oó]dico.*$/i, '')
    .replace(/,\s*(?:integrando|activando|aplicando|asegurando|verificando|presentando|socializando)\b.*$/i, '')
    .replace(/[.;:,]+$/, '')
    .trim();

  // Si aún empieza con palabra inválida ("Y ", "Sobre ", "Tu ", etc.), limpiar de nuevo
  text = text
    .replace(/^(?:y\s+|sobre\s+|tu\s+|tus\s+|su\s+|sus\s+|el\s+|la\s+|los\s+|las\s+|un\s+|una\s+)/i, '')
    .trim();

  // Si después de limpiar sigue excediendo el presupuesto de título (ej. > 68 chars),
  // cortar en un conector secundario (" mediante ", " para ", " con ", etc.) SIN cortar palabras clave como "dos variables"
  if (text.length > 68) {
    const secondaryCut = text.match(
      /^(.{18,66}?)\s+(?:mediante|para|utilizando|aplicando|vinculad[oa]s?|en\s+la\s+validaci[oó]n|en\s+el\s+an[aá]lisis|a\s+trav[eé]s|con\s+un[a]?|y\s+la\s+aplicaci[oó]n|y\s+la\s+exploraci[oó]n|y\s+su\s+(?:aplicaci[oó]n|relaci[oó]n|uso)|y\s+un[a]?|sobre\s+(?:tu|la|los))\b/i
    );
    if (secondaryCut && !hasDanglingEnding(secondaryCut[1])) {
      text = secondaryCut[1].trim();
    } else {
      const fittedTitle = fitPedagogicalText(text, { role: 'concept', maxChars: 68, maxWords: 11, ensurePeriod: false });
      if (fittedTitle && fittedTitle.length >= 12 && !hasDanglingEnding(fittedTitle)) {
        text = fittedTitle;
      }
    }
  }

  text = repairDanglingEnding(text, false);
  if (STRUCTURAL_HEADING_ONLY_RE.test(text)) return '';

  if (text.length > 0) {
    text = text.charAt(0).toUpperCase() + text.slice(1);
  }

  return text;
}

function isValidResolvedTitle(candidate: string, maxChars: number): boolean {
  if (!candidate || candidate.length < 6) return false;
  if (candidate.length > maxChars + 15) return false;
  if (STRUCTURAL_HEADING_ONLY_RE.test(candidate)) return false;
  if (INVALID_TITLE_START_RE.test(candidate)) return false;
  if (hasDanglingEnding(candidate)) return false;
  return true;
}

/**
 * Extrae el primer título conceptual explícito de `conceptosClave` (ej. "**Ecuaciones de primer grado:** ...") si existe.
 */
function extractSectionHeadingFromConceptos(conceptosClave: string | null | undefined): string {
  if (!conceptosClave) return '';
  for (const boldMatch of conceptosClave.matchAll(/\*\*([^*:\n]{6,60})\*\*/g)) {
    const candidate = extractDisciplinaryConceptPhrase(boldMatch[1]);
    if (
      candidate.length >= 6 &&
      !STRUCTURAL_HEADING_ONLY_RE.test(candidate) &&
      !isEvaluationOrClosureObjective(candidate)
    ) {
      return candidate;
    }
  }
  return '';
}

/**
 * Resuelve el título de pizarrón para una sesión de clase (`08_Presentaciones`).
 */
export function resolveChalkboardTopicTitle(input: TopicTitleInput): string {
  const maxChars = input.maxChars ?? 68;

  const candidates = [
    input.sectionTitle ? extractDisciplinaryConceptPhrase(input.sectionTitle) : '',
    input.sessionObjective ? extractDisciplinaryConceptPhrase(input.sessionObjective) : '',
    extractSectionHeadingFromConceptos(input.conceptosClave),
    input.missionSessionTopic ? extractDisciplinaryConceptPhrase(input.missionSessionTopic) : '',
    input.missionFocus ? extractDisciplinaryConceptPhrase(input.missionFocus) : '',
    input.missionTitle ? extractDisciplinaryConceptPhrase(input.missionTitle) : '',
  ].filter(Boolean);

  // Priorizar candidatos que NO sean meras etiquetas de evaluación/cierre si hay un tema disciplinar disponible
  const disciplinaryCandidates = candidates.filter((c) => !isEvaluationOrClosureObjective(c));
  const pool = disciplinaryCandidates.length > 0 ? disciplinaryCandidates : candidates;

  for (const candidate of pool) {
    if (isValidResolvedTitle(candidate, maxChars)) {
      return candidate;
    }
  }

  // Fallback seguro desde el mejor candidato ajustado al presupuesto visual
  const fallback = pool[0] || candidates[0] || 'Concepto clave de la sesión';
  const fittedFallback = fitPedagogicalText(fallback, {
    maxChars,
    maxWords: Math.max(7, Math.round(maxChars / 6)),
    role: 'concept',
    ensurePeriod: false,
  });
  const finalTitle = fittedFallback || repairDanglingEnding(fallback, false) || 'Concepto clave de la sesión';
  return finalTitle.length > maxChars + 24
    ? repairDanglingEnding(finalTitle.slice(0, maxChars + 24).replace(/\s+\S*$/, ''), false) || finalTitle
    : finalTitle;
}

/**
 * Resuelve el título conceptual para una infografía (`09_Infografias_Sinteticas`).
 * Garantiza que en misiones de evaluación/cierre el título sea siempre el concepto disciplinar,
 * nunca "Versión depurada y validada de tu evidencia formativa...".
 */
export function resolveInfographicConceptTitle(input: TopicTitleInput): string {
  const maxChars = input.maxChars ?? 68;

  // En infografías misionales, si el objetivo de la sesión es de evaluación/cierre, priorizar missionSessionTopic / missionFocus / sectionTitle
  const objectiveIsClosure = isEvaluationOrClosureObjective(input.sessionObjective);

  const orderedRaw = objectiveIsClosure
    ? [
        input.missionSessionTopic,
        input.missionFocus,
        input.sectionTitle,
        extractSectionHeadingFromConceptos(input.conceptosClave),
        input.sessionObjective,
        input.missionTitle,
      ]
    : [
        input.sectionTitle,
        extractSectionHeadingFromConceptos(input.conceptosClave),
        input.missionSessionTopic,
        input.sessionObjective,
        input.missionFocus,
        input.missionTitle,
      ];

  for (const raw of orderedRaw) {
    if (!raw) continue;
    const candidate = extractDisciplinaryConceptPhrase(raw);
    if (
      isValidResolvedTitle(candidate, maxChars) &&
      !isEvaluationOrClosureObjective(candidate) &&
      !/^evaluaci[oó]n\s+y\s+cierre$/i.test(candidate)
    ) {
      // Enriquecer títulos de 2–3 palabras muy cortos en cierre (ej. "Tipos de ángulos" -> "Tipos de ángulos y geometría plana" si el contexto lo respalda)
      if (/^tipos\s+de\s+[aá]ngulos$/i.test(candidate)) {
        return 'Tipos de ángulos y geometría plana';
      }
      if (/^forma\s+general$/i.test(candidate) && /cuadr[aá]tic/i.test(`${input.sessionObjective || ''} ${input.conceptosClave || ''}`)) {
        return 'Forma general de la ecuación cuadrática';
      }
      return candidate;
    }
  }

  return resolveChalkboardTopicTitle({ ...input, maxChars });
}

/**
 * Limpia un título de misión para índices y encabezados sin truncarlo si está completo,
 * pero reparando cualquier final colgado o truncado de base de datos (`... y activarás tus`, `... problemática de`).
 */
export function sanitizeWorkbookTocTitle(
  rawTitle: string | null | undefined,
  fallbackTopic?: string | null
): string {
  const base = normalizeEditorialText(rawTitle || '')
    .replace(/^\[.*?\]\s*/, '')
    .replace(/^misi[oó]n\s*\d+\s*:\s*/i, '')
    .replace(/(\s(?:—|–|:)\s+)([a-záéíóúñ])/g, (_m, sep: string, ch: string) => `${sep}${ch.toUpperCase()}`)
    .trim();
  if (!base) {
    return fallbackTopic ? extractDisciplinaryConceptPhrase(fallbackTopic) : 'Desarrollo temático';
  }
  if (!hasDanglingEnding(base)) {
    return base;
  }

  const dashMatch = base.match(/^(.{4,48}?)\s*(?:—|–|:|\s-\s)\s*(.+)$/);
  if (dashMatch) {
    const prefix = dashMatch[1].trim();
    const suffix = dashMatch[2].trim();
    const cleanSuffix = resolveInfographicConceptTitle({
      sectionTitle: suffix,
      sessionObjective: suffix,
      missionSessionTopic: fallbackTopic,
      missionTitle: base,
      maxChars: 68,
    });
    if (cleanSuffix && !hasDanglingEnding(cleanSuffix)) {
      const capSuffix = /^[a-záéíóúñ]/.test(cleanSuffix)
        ? cleanSuffix.charAt(0).toUpperCase() + cleanSuffix.slice(1)
        : cleanSuffix;
      return `${prefix} — ${capSuffix}`;
    }
    const cleanPrefix = repairDanglingEnding(prefix, false);
    if (cleanPrefix && !hasDanglingEnding(cleanPrefix)) {
      return cleanPrefix;
    }
  }

  const resolved = resolveInfographicConceptTitle({
    sectionTitle: base,
    sessionObjective: base,
    missionSessionTopic: fallbackTopic,
    missionTitle: base,
    maxChars: 72,
  });
  return resolved && !hasDanglingEnding(resolved) ? resolved : repairDanglingEnding(base, false);
}

/**
 * Limpia y sanea el resumen de enfoque de una misión (`sessionFocus`) antes de imprimirlo
 * en banners de PDF/DOCX, eliminando fragmentos truncados o cierres colgantes.
 */
export function sanitizeMissionFocus(
  rawFocus: string | null | undefined,
  fallback = 'Desarrollo de competencias situadas'
): string {
  const normalized = normalizeEditorialText(rawFocus ?? '')
    .replace(/\s+y\s+activar[aá]s\s+tus(?:\s+[a-záéíóúñ]+)?(?=[\s·.,;:]|$)/gi, '')
    .replace(
      /\s+(?:de|del|en|con|por|para|mediante|utilizando|como|y|o|el|la|los|las|un|una|tus|sus)\s*(?=·|$)/gi,
      ''
    )
    .trim();
  if (!normalized) return fallback;

  const segments = normalized
    .split(/\s*·\s*/)
    .map((segment) => {
      const cleanedSeg = sanitizeWorkbookTocTitle(segment);
      if (!cleanedSeg) return '';
      const fittedSeg =
        cleanedSeg.length > 110
          ? fitPedagogicalText(cleanedSeg, { maxChars: 110, role: 'concept', ensurePeriod: false })
          : cleanedSeg;
      const trimmed = hasDanglingEnding(fittedSeg)
        ? repairDanglingEnding(fittedSeg, false)
        : fittedSeg;
      return trimmed.replace(/[.]+$/, '').trim();
    })
    .filter((seg) => seg.length >= 4);

  if (segments.length === 0) return fallback;
  return segments.join(' · ');
}
