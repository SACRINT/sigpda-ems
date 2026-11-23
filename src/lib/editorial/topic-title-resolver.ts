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

import {
  normalizeEditorialText,
  normalizeSessionDescriptorTense,
} from './text-normalization';
import {
  finalizeVisibleText,
  fitPedagogicalText,
  hasDanglingEnding,
  repairDanglingEnding,
} from './pedagogical-text-fitter';

export type SacrintContentErrorCode =
  | 'SACRINT_GENERIC_TITLE'
  | 'SACRINT_OBJECTIVE_INVALID'
  | 'SACRINT_ACTIVITY_INVALID'
  | 'SACRINT_EXAMPLE_INVALID'
  | 'SACRINT_TEMPLATE_LEAK';

export interface SacrintContentErrorContext {
  packageCode?: string;
  sessionNumber?: number | null;
  field?: string;
  raw?: string;
}

export class SacrintContentError extends Error {
  readonly code: SacrintContentErrorCode;
  readonly context?: SacrintContentErrorContext;

  constructor(
    code: SacrintContentErrorCode,
    message: string,
    context?: SacrintContentErrorContext
  ) {
    super(`[${code}] ${message}`);
    this.name = 'SacrintContentError';
    this.code = code;
    this.context = context;
  }
}

export interface TopicTitleInput {
  sectionTitle?: string | null;
  conceptosClave?: string | null;
  sessionObjective?: string | null;
  missionSessionTopic?: string | null;
  missionFocus?: string | null;
  missionTitle?: string | null;
  maxChars?: number;
  strict?: boolean;
  context?: SacrintContentErrorContext;
}

export const GENERIC_TITLE_BLACKLIST_RE =
  /^(?:concepto\s+clave\s+de\s+la\s+sesi[oó]n|concepto\s+central\s+de\s+la\s+clase|tema\s+de\s+la\s+sesi[oó]n|sesi[oó]n\s*\d+|aplicar\s+.+)$/i;

export const LEADING_MODE_ADVERB_RE =
  /^(?:correctamente|adecuadamente|t[eé]cnicamente|f[ií]sicamente|conceptualmente|pr[aá]cticamente|anal[ií]ticamente|matem[aá]ticamente|gr[aá]ficamente|experimentalmente|rigurosamente|precisamente|exactamente|formalmente|estrictamente|progresivamente|gradualmente|finalmente|b[aá]sicamente|p[uú]blicamente|sistem[aá]ticamente|cr[ií]ticamente|cuidadosamente|eficientemente|ordenadamente|colaborativamente|aut[oó]nomamente|directamente|previamente|posteriormente)\b/i;

export const FUTURE_SECOND_PERSON_VERB_RE =
  /\b[a-záéíóúñ]{3,}(?:ar[aá]s|er[aá]s|ir[aá]s)\b/i;

const SECOND_PERSON_PRESENT_START_RE =
  /^(?:aprendes|comprendes|conoces|realizas|consolidas|socializas|integras|validas|depuras|aplicas|calculas|construyes|modelas|determinas|identificas|reconoces|resuelves|analizas|dise[ñn]as|utilizas|empleas|eval[uú]as|clasificas|comparas|contrastas|interpretas|interpretes|verificas|presentas|defiendes|estructuras|expones|demuestras|optimizas|sistematizas|dominas|implementas|elaboras|exploras|formulas|explicas|describes|preparas|limpias|colocas|instalas|configuras|actualizas|diagnosticas|digitalizas|redactas|argumentas|organizas|acotas|trazas|dibujas|mides|documentas|ejecutas|proyectas|seleccionas|comunicas|relacionas|distingues|transformas|diferencias|planificas|gestionas|estableces|generas|produces|registras|controlas|inspeccionas|reparas|conectas|aseguras|garantizas|representas|visualizas|traduces|conjugas|planteas|simulas|justificas|valoras|desarrollas|sintetizas|hallas|ensamblas|corriges|experimentas|investigas|estimas|pruebas|respondes|reflexionas|participas|recuperas|indagas|deduces|monitoreas|rehabilitas|sustentas|decodificas|cuantificas|capturas|transcribes|reescribes|inauguras|inicias|refinas|perfeccionas|procesas|auditas)\b/i;

const INLINE_SECOND_PERSON_TITLE_RE =
  /(?:,\s*(?:y\s+)?|\s+y\s+)(?:comprendes|identificas|aplicas|digitalizas|realizas|valoras|analizas|verificas|registras|pruebas|ajustas|defiendes|presentas|socializas|validas|eval[uú]as|consolidas|expones|comunicas|justificas|documentas|garantizas|aseguras|ejecutas|utilizas|empleas|construyes|estructuras|estableces|propones|redactas|elaboras|dise[ñn]as|resuelves|determinas|calculas|aprendes|desarrollas|sintetizas|experimentas|investigas|estimas|respondes|integras|reflexionas|participas)\b.*$/i;

const TITLE_SESSION_FRAGMENT_RE = /^\s*\)\s*(?:[—–-]\s*)?sesi[oó]n\b.*$/i;
const TITLE_UNBALANCED_PAREN_RE = /^\s*\([^)]*$/;
const TITLE_SESSION_SUFFIX_RE = /\s*[—–-]\s*sesi[oó]n\s*\d+\b.*$/i;
const TITLE_SESSION_PREFIX_RE = /^\s*sesi[oó]n\s*\d+\s*[:—–-]\s*/i;

function sanitizeMalformedTitleFragment(raw: string | null | undefined): string {
  if (!raw) return '';
  let text = normalizeEditorialText(raw).replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (TITLE_SESSION_FRAGMENT_RE.test(text)) return '';
  if (TITLE_UNBALANCED_PAREN_RE.test(text)) return '';
  text = text.replace(TITLE_SESSION_SUFFIX_RE, '').replace(TITLE_SESSION_PREFIX_RE, '').trim();
  if (!text || /^\)/.test(text)) return '';
  text = text.replace(INLINE_SECOND_PERSON_TITLE_RE, '').trim();
  text = text.replace(
    /\bresultados\s+obtenidos\s+y\s+a\s+jerarquizar\s+(?:las\s+)?(problem[aá]ticas?)\b/i,
    'Jerarquización de $1'
  );
  return text.trim();
}

const INVALID_TITLE_START_RE =
  /^(?:y\b|e\b|o\b|sobre\b|tu\b|tus\b|su\b|sus\b|vas\s+a\b|vamos\s+a\b|aprender[aá]s\b|evaluar[aá]s\b|integrar[aá]s\b|optimizar[aá]s\b|representar[aá]s\b|gr[aá]ficamente\b|correctamente\b|adecuadamente\b|t[eé]cnicamente\b|f[ií]sicamente\b|conceptualmente\b|pr[aá]cticamente\b|anal[ií]ticamente\b|matem[aá]ticamente\b|experimentalmente\b|versi[oó]n\s+depurada\b|evidencia\s+formativa\b|p[uú]blicamente\b|hallazgos\b|en\s+esta\s+sesi[oó]n\b|durante\s+la\b|para\s+que\b|mediante\s+la\b|a\s+trav[eé]s\s+de\b|manera\s+(?:formativa|integral|rigurosa|sistem[aá]tica|cr[ií]tica)\b|forma\s+(?:formativa|integral|rigurosa|sistem[aá]tica|cr[ií]tica)\b|todos\s+los\s+conocimientos\b|sintetizar\s+y\s+realizar\b|realizar\s+una\s+reflexi[oó]n\b)/i;

const BARE_ADJECTIVE_TITLE_RE =
  /^(?:anal[ií]tic[oa]s?|matem[aá]tic[oa]s?|gr[aá]fic[oa]s?|algebraic[oa]s?|cuantitativ[oa]s?|cualitativ[oa]s?|estad[ií]stic[oa]s?|geom[eé]tric[oa]s?|t[eé]cnic[oa]s?|te[oó]ric[oa]s?|pr[aá]ctic[oa]s?|formativ[oa]s?|generales?|espec[ií]fic[oa]s?|b[aá]sic[oa]s?|fundamentales?|cr[ií]tic[oa]s?|hist[oó]ric[oa]s?|digitales?|comunicativ[oa]s?|cient[ií]fic[oa]s?|colaborativ[oa]s?|aut[oó]nom[oa]s?|riguros[oa]s?|sistem[aá]tic[oa]s?)$/i;

const PAEC_ARTIFACT_TITLE_RE =
  /^(?:proyecto\s+['"«]|dossier\s+t[eé]cnico|evidencia\s+(?:formativa|final)|desarrollo\s+del\s+producto|demostraci[oó]n\s+de\s+aprendizajes|reporte\s+t[eé]cnico|prototipo\s+t[eé]cnico|matriz\s+de\s+contextualizaci[oó]n|revisi[oó]n\s+cruzada|avance\s+estructurado|modelo\s+geom[eé]trico-algebraico\s+de\s+viabilidad|paec\b)/i;

export function isPaecProjectOrArtifactTitle(text: string | null | undefined): boolean {
  if (!text) return false;
  return PAEC_ARTIFACT_TITLE_RE.test(text.trim());
}

const STRUCTURAL_HEADING_ONLY_RE =
  /^(?:sesi[oó]n|misi[oó]n|bloque|corte|fase|momento|apertura|desarrollo|cierre|actividad|ejemplo(?:\s+resuelto)?|ejercicio|concepto(?:\s+clave)?|fundamentaci[oó]n\s+te[oó]rica|pr[aá]ctica(?:\s+guiada)?)\s*(?:n[uú]mero\s*)?\d*$/i;

const EVALUATION_OR_CLOSURE_ONLY_RE =
  /\b(?:versi[oó]n\s+depurada|evidencia\s+formativa|portafolio\s+de\s+evidencias|bit[aá]cora\s+metacognitiva|revisi[oó]n\s+cruzada|retroalimentaci[oó]n\s+entre\s+pares|autoevaluaci[oó]n|coevaluaci[oó]n|defender\s+p[uú]blicamente|socializaci[oó]n\s+de\s+proyectos|manera\s+formativa|sintetizar\s+y\s+realizar\s+una\s+reflexi[oó]n|realizar\s+una\s+reflexi[oó]n)\b/i;

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
  let text = sanitizeMalformedTitleFragment(stripPhaseAndMissionBoilerplate(raw));
  if (!text) return '';

  // Rechazar de inmediato fragmentos huérfanos que ya arrancan con adverbio de modo sin verbo previo
  // (ej. "Correctamente las herramientas...", "Técnicamente la logística...", "Físicamente una unidad SSD...")
  if (LEADING_MODE_ADVERB_RE.test(text)) {
    return '';
  }
  // Rechazar fragmentos con verbo en futuro incrustado si no arrancan con un verbo de objetivo limpio
  // (ej. "Rendimiento y ajustarás las tolerancias...")
  const startsWithGoalVerb =
    /^(?:en\s+esta\s+sesi[oó]n\b|hoy\b|vas\s+a\b|vamos\s+a\b|el\s+estudiante\b|lograr[aá]s\b|[a-záéíóúñ]{3,}(?:ar[aá]s|er[aá]s|ir[aá]s)\b)/i.test(
      text
    ) || SECOND_PERSON_PRESENT_START_RE.test(text);
  if (!startsWithGoalVerb && FUTURE_SECOND_PERSON_VERB_RE.test(text)) {
    return '';
  }

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

  // Si contiene "...reflexión metacognitiva sobre <CONCEPTO>" o "...evaluarás de manera formativa ... sobre <CONCEPTO>"
  const reflexionSobreMatch = text.match(
    /\b(?:reflexi[oó]n\s+metacognitiva|evaluar[aá]s\s+de\s+manera\s+formativa[^,.]{0,55}?)\s+sobre\s+(?:el\s+|la\s+|los\s+|las\s+)?(.+)$/i
  );
  if (reflexionSobreMatch && reflexionSobreMatch[1].trim().length >= 10) {
    text = reflexionSobreMatch[1].trim();
  }

  // Si contiene "Socializarás/Defenderás ... mediante (el método de|la aplicación de) <CONCEPTO>"
  const socializarMedianteMatch = text.match(
    /^(?:socializar[aá]s|defender[aá]s|presentar[aá]s|expondr[aá]s)\b[^.]{4,95}?\bmediante\s+(?:la\s+aplicaci[oó]n(?:\s+rigurosa)?\s+de(?:l|\s+la|\s+los|\s+las)?\s+|el\s+uso\s+de(?:l|\s+la|\s+los|\s+las)?\s+)?((?:el\s+)?m[eé]todo\s+de\s+[^,.]{4,45}|[^,.]{8,55}?)(?:\s+ante\s+|\s*,|\s*\.|$)/i
  );
  if (socializarMedianteMatch && socializarMedianteMatch[1].trim().length >= 8) {
    text = socializarMedianteMatch[1].trim();
  }

  // Si contiene "Integrarás, depurarás y validarás ... consolidando <CONCEPTO>"
  const consolidandoMatch = text.match(
    /^(?:integrar[aá]s|optimizar[aá]s|depurar[aá]s)\b[^.]{4,110}?\bconsolidando\s+(?:el\s+|la\s+|los\s+|las\s+)?([^,.]{8,55})/i
  );
  if (consolidandoMatch && consolidandoMatch[1].trim().length >= 8) {
    text = consolidandoMatch[1].trim();
  }

  // Si contiene "...resultados de tus/sus <trabajo> con los fundamentos/principios de(l) <CONCEPTO>"
  const resultadosFundamentosMatch = text.match(
    /\bresultados\s+de\s+(?:tus|sus|las|los)\s+[^,.]{4,45}\s+con\s+(?:los\s+)?(?:fundamentos|principios|conceptos)\s+de\s+(?:la\s+|el\s+|los\s+|las\s+)?(.+)$/i
  );
  if (resultadosFundamentosMatch && resultadosFundamentosMatch[1].trim().length >= 10) {
    text = resultadosFundamentosMatch[1].trim();
  }

  const INLINE_MODE_ADVERB_TAIL_SRC =
    '(?:\\s+(?:correctamente|adecuadamente|t[eé]cnicamente|f[ií]sicamente|conceptualmente|pr[aá]cticamente|anal[ií]ticamente|matem[aá]ticamente|gr[aá]ficamente|experimentalmente|rigurosamente|precisamente|exactamente|formalmente|estrictamente|p[uú]blicamente|sistem[aá]ticamente|cr[ií]ticamente|cuidadosamente|eficientemente|con\\s+rigor(?:\\s+(?:t[eé]cnico|anal[ií]tico(?:\\s+y\\s+matem[aá]tico)?|matem[aá]tico))?|con\\s+precisi[oó]n(?:\\s+t[eé]cnica)?|de\\s+(?:forma|manera)\\s+(?:segura|t[eé]cnica|pr[aá]ctica|correcta|adecuada|formativa|integral|rigurosa|sistem[aá]tica|cr[ií]tica)))?';
  const PRESENT_GOAL_VERB_RE = new RegExp(
    `^(?:aprendes\\s+a(?:\\s+[a-záéíóúñ]{3,}(?:ar|er|ir))?|comprendes(?:\\s+y\\s+aplicas)?|conoces(?:\\s+y\\s+aplicas)?|realizas|consolidas|socializas(?:\\s+(?:los|tus)\\s+hallazgos(?:\\s+de)?)?|integras(?:,\\s*(?:depuras|organizas|validas))?(?:\\s+y\\s+(?:validas|eval[uú]as|consolidas|presentas|defiendes))?|validas(?:\\s+y\\s+depuras)?|depuras(?:\\s+y\\s+validas)?|aplicas|calculas|construyes|modelas|determinas|identificas(?:\\s+y\\s+(?:aplicas|clasificas|describes|analizas|utilizas|empleas|conectas|diagnosticas))?|reconoces(?:\\s+y\\s+(?:aplicas|distingues))?|resuelves|analizas(?:\\s+y\\s+(?:modelas|eval[uú]as|comparas|interpretas))?|dise[ñn]as(?:\\s+y\\s+(?:elaboras|construyes|eval[uú]as|trazas))?|utilizas|empleas|eval[uú]as|clasificas(?:\\s+y\\s+mides)?|comparas|contrastas|interpretas(?:\\s+y\\s+representas)?|interpretes|verificas(?:\\s+y\\s+utilizas)?|presentas|defiendes|estructuras|expones|demuestras|optimizas(?:\\s+y\\s+consolidas)?|sistematizas|dominas|implementas|elaboras|exploras|formulas(?:\\s+y\\s+respondes)?|explicas|describes|preparas|limpias|colocas|instalas|configuras|actualizas|diagnosticas|redactas|argumentas|organizas|acotas|trazas|dibujas|mides|documentas|ejecutas|proyectas(?:\\s+y\\s+trazas)?|seleccionas(?:\\s+y\\s+preparas)?|comunicas|relacionas|distingues|transformas|diferencias|planificas|gestionas|estableces|generas|produces|registras|controlas|inspeccionas|reparas|conectas|aseguras|garantizas|representas|visualizas|traduces|conjugas|planteas|simulas|justificas|valoras|desarrollas|sintetizas|hallas|ensamblas(?:\\s+y\\s+construyes)?|corriges(?:\\s+y\\s+redise[ñn]as)?|experimentas(?:\\s+y\\s+pruebas)?|investigas(?:\\s+y\\s+estructuras)?|estimas|pruebas|respondes|reflexionas(?:\\s+sobre)?|participas(?:\\s+en)?|recuperas(?:\\s+(?:tus\\s+)?(?:saberes|conocimientos)\\s+previos\\s+(?:sobre|de))?|indagas(?:\\s+y\\s+registras)?|deduces|monitoreas|rehabilitas|sustentas|decodificas|cuantificas|capturas(?:\\s+y\\s+depuras)?|transcribes(?:\\s+y\\s+seleccionas)?|reescribes|inauguras|inicias|refinas|perfeccionas|procesas|auditas)${INLINE_MODE_ADVERB_TAIL_SRC}\\s+`,
    'i'
  );
  const FUTURE_GOAL_VERB_RE = new RegExp(
    `^(?:aprender[aá]s\\s+a\\s+[a-záéíóúñ]{3,}(?:ar|er|ir)|[a-záéíóúñ]{3,}(?:ar[aá]s|er[aá]s|ir[aá]s)(?:\\s+(?:y|e)\\s+[a-záéíóúñ]{3,}(?:ar[aá]s|er[aá]s|ir[aá]s))?)${INLINE_MODE_ADVERB_TAIL_SRC}\\s+`,
    'i'
  );

  const STRIP_AFTER_VERB_ADVERB_RE = new RegExp(
    `^(?:correctamente|adecuadamente|t[eé]cnicamente|f[ií]sicamente|conceptualmente|pr[aá]cticamente|anal[ií]ticamente|matem[aá]ticamente|gr[aá]ficamente|experimentalmente|rigurosamente|precisamente|exactamente|formalmente|estrictamente|p[uú]blicamente|sistem[aá]ticamente|cr[ií]ticamente|cuidadosamente|eficientemente|con\\s+rigor(?:\\s+(?:t[eé]cnico|anal[ií]tico(?:\\s+y\\s+matem[aá]tico)?|matem[aá]tico))?|con\\s+precisi[oó]n(?:\\s+t[eé]cnica)?|de\\s+(?:forma|manera)\\s+(?:segura|t[eé]cnica|pr[aá]ctica|correcta|adecuada|formativa|integral|rigurosa|sistem[aá]tica|cr[ií]tica))\\s+`,
    'i'
  );

  const INFINITIVE_GOAL_VERB_RE = new RegExp(
    `^(?:redactar|escribir|elaborar|dise[ñn]ar|construir|resolver|calcular|determinar|identificar|analizar|comprender|evaluar|valorar|explicar|comparar|aplicar|emplear|utilizar|interpretar|representar|modelar|desarrollar|sintetizar|verificar|validar|organizar|documentar|describir|clasificar|medir|trazar|dibujar|instalar|configurar|diagnosticar|ejecutar|realizar|preparar|limpiar|colocar|conectar|monitorear|rehabilitar|decodificar|consolidar|incorporar|graficar|tabular|plantear|formular|justificar|sustentar|argumentar|contrastar|distinguir|diferenciar|reconocer|explorar|dominar|estructurar|presentar|socializar|defender|exponer|demostrar|optimizar|sistematizar|implementar|acotar|proyectar|seleccionar|comunicar|relacionar|transformar|planificar|gestionar|establecer|generar|producir|registrar|controlar|inspeccionar|reparar|asegurar|garantizar|visualizar|traducir|conjugar|simular|ensamblar|corregir|experimentar|investigar|estimar|probar|responder|integrar|reflexionar|participar|recuperar|indagar|deducir|sustentar|cuantificar|capturar|transcribir|reescribir|inaugurar|iniciar|refinar|perfeccionar|procesar|auditar)${INLINE_MODE_ADVERB_TAIL_SRC}\\s+`,
    'i'
  );

  // Eliminar arranques verbales y muletillas pedagógicas en cascada (sin reducir el título a un adjetivo suelto)
  let strippedAnyGoalVerb = false;
  for (let pass = 0; pass < 5; pass++) {
    const prev = text;
    let candidate = text
      .replace(
        /^(?:en\s+esta\s+sesi[oó]n\s+|hoy\s+)?(?:vas\s+a\s+|vamos\s+a\s+|el\s+estudiante\s+(?:va\s+a\s+|lograr[aá]\s+)?|lograr[aá]s\s+)/i,
        ''
      )
      .replace(PRESENT_GOAL_VERB_RE, '')
      .replace(FUTURE_GOAL_VERB_RE, '')
      .replace(INFINITIVE_GOAL_VERB_RE, '')
      .replace(
        /^(?:integrar(?:[aá]s)?\s+todos\s+los\s+conocimientos\s+de\s+|todos\s+los\s+conocimientos\s+de\s+)/i,
        ''
      )
      .replace(
        /^(?:recuperar(?:\s+tus)?\s+(?:saberes|conocimientos)\s+previos(?:\s+sobre|\s+acerca\s+de|\s+y\s+delimitar(?:[aá]s)?)?|activar(?:\s+tus)?\s+saberes\s+previos(?:\s+sobre|\s+y)?|integrar,\s*evaluar\s+formativamente\s+y\s+reflexionar\s+sobre(?:\s+tus\s+aprendizajes\s+de)?|integrar(?:[aá]s)?(?:,\s*depurar(?:[aá]s)?)?(?:\s+y\s+(?:validar(?:[aá]s)?|evaluar(?:[aá]s)?|consolidar(?:[aá]s)?))?(?:\s+(?:los\s+conocimientos|los\s+modelos|las\s+soluciones))?(?:\s+(?:sobre|de|en))?|optimizar(?:[aá]s)?(?:,\s*depurar(?:[aá]s)?)?(?:\s+y\s+(?:validar(?:[aá]s)?|consolidar(?:[aá]s)?|depurar(?:[aá]s)?))?(?:\s+(?:la\s+versi[oó]n\s+depurada\s+y\s+validada\s+de\s+)?(?:tu\s+evidencia\s+formativa|los\s+modelos(?:\s+matem[aá]ticos)?)\s*(?:mediante|integrando|sobre|de)?)?|depurar(?:[aá]s)?(?:\s+y\s+validar(?:[aá]s)?)?|validar(?:[aá]s)?|evaluar(?:[aá]s)?(?:\s+(?:de\s+manera\s+formativa|formativamente)(?:\s+(?:los|las|el|la))?|\s+tus\s+(?:conocimientos|aprendizajes)(?:\s+y\s+consolidar(?:\s+tu\s+dominio)?)?(?:\s+(?:sobre|de|del|en|mediante))?|\s+tu\s+aprendizaje\s+mediante(?:\s+la\s+aplicaci[oó]n\s+de)?)?|defender(?:\s+p[uú]blicamente)?(?:\s+los\s+hallazgos\s+de\s+tu\s+proyecto(?:\s+integrador)?(?:\s+comunitario)?(?:\s+mediante(?:\s+la\s+aplicaci[oó]n(?:\s+rigurosa)?\s+de(?:l)?)?)?)?|aprender(?:[aá]s)?\s+a(?:\s+(?:aplicar|resolver|modelar|calcular|contrastar(?:\s+y\s+verificar)?|construir|Tabular|tabular))?|comprender(?:[aá]s)?\s+y\s+aplicar(?:[aá]s)?|identificar(?:[aá]s)?\s+y\s+aplicar(?:[aá]s)?|visualizar(?:[aá]s)?(?:\s+gr[aá]ficamente)?|representar(?:[aá]s)?(?:\s+gr[aá]ficamente(?:\s+y\s+tabular(?:[aá]s)?)?)?|graficar(?:[aá]s)?(?:\s+y\s+tabular(?:[aá]s)?)?|tabular(?:[aá]s)?|modelar(?:[aá]s)?(?:\s+matem[aá]ticamente|\s+algebraicamente)?|calcular(?:[aá]s)?|determinar(?:[aá]s)?|clasificar(?:[aá]s)?(?:\s+y\s+medir(?:[aá]s)?)?|medir(?:[aá]s)?|verificar(?:[aá]s)?|argumentar(?:[aá]s)?|elaborar(?:[aá]s)?|dise[ñn]ar(?:[aá]s)?|interpretar(?:[aá]s)?|sintetizar(?:[aá]s)?|presentar(?:[aá]s)?|socializar(?:[aá]s)?(?:\s+tus\s+hallazgos(?:\s+de)?|\s+hallazgos)?|exponer(?:[aá]s)?|trabajar(?:[aá]s)?|comparar(?:[aá]s)?|identificar(?:[aá]s)?|comprender(?:[aá]s)?|analizar(?:[aá]s)?(?:\s+y\s+modelar(?:[aá]s)?(?:\s+matem[aá]ticamente)?)?|aplicar(?:[aá]s)?|resolver(?:[aá]s)?(?:\s+gr[aá]ficamente|\s+anal[ií]ticamente)?|construir(?:[aá]s)?(?:\s+y\s+analizar(?:[aá]s)?)?|estructurar(?:[aá]s)?|dominar(?:[aá]s)?|contrastar(?:[aá]s)?|delimitar(?:[aá]s)?|explorar(?:[aá]s)?|consolidar(?:[aá]s)?|reflexionar(?:[aá]s)?(?:\s+sobre(?:\s+tus\s+aprendizajes\s+de)?)?|realizar(?:[aá]s)?)\s+/i,
        ''
      );
    if (candidate !== prev) {
      strippedAnyGoalVerb = true;
    }
    if (strippedAnyGoalVerb) {
      candidate = candidate.replace(STRIP_AFTER_VERB_ADVERB_RE, '');
    }
    candidate = candidate
      .replace(
        /^(?:(?:tu|su)\s+evidencia\s+formativa\s+(?:de|sobre)\s+|el\s+avance\s+estructurado\s+de(?:l)?\s+(?:tu\s+)?(?:producto\s+o\s+)?reporte\s+t[eé]cnico\s+(?:de\s+la\s+unidad\s+)?(?:aplicando|sobre|mediante)\s+|una\s+revisi[oó]n\s+cruzada(?:\s+y\s+(?:coevaluaci[oó]n|retroalimentaci[oó]n(?:\s+constructiva)?))?(?:\s+(?:de|entre\s+pares))?(?:\s+(?:sobre|aplicando|de))?\s+)/i,
        ''
      )
      .replace(
        /^(?:utilizando|mediante|usando)\s+(?:una?\s+)?(?:r[uú]brica(?:\s+anal[ií]tica)?|lista\s+de\s+cotejo|pauta(?:\s+de\s+logro)?|herramienta|instrumento)[^.,;:]*[,;:\s]+(?:evaluando\s+[^.,;:]*[,;:\s]+)?(?:y\s+(?:aplicando|realizando)\s+(?:correcciones(?:\s+rigurosas)?\s+)?(?:a|de|sobre)\s+(?:los\s+)?)?/i,
        ''
      )
      .replace(
        /^(?:versi[oó]n\s+depurada\s+y\s+validada\s+de\s+tu\s+evidencia\s+formativa\s+(?:sobre|de)\s+|tu\s+evidencia\s+formativa\s+(?:sobre|de|integrando|mediante)\s+|tu\s+aprendizaje\s+mediante\s+(?:la\s+aplicaci[oó]n\s+de\s+)?|tus\s+aprendizajes\s+de\s+|tus\s+conocimientos\s+sobre\s+)/i,
        ''
      )
      .replace(
        /^(?:el\s+concepto\s+(?:fundamental\s+)?de\s+|los\s+conceptos\s+fundamentales\s+de\s+|(?:la\s+)?fundamentaci[oó]n\s+te[oó]rica(?:\s*(?:,|y|sobre|de)\s*(?:el\s+procedimiento(?:\s+(?:algebraico|gr[aá]fico|matem[aá]tico))?(?:\s+para)?\s*)?)?|fundamentos\s+te[oó]ricos\s+de(?:l|\s+la|\s+los|\s+las)?\s+|(?:el|los)\s+procedimientos?\s+(?:algebraicos?\s+|gr[aá]ficos?\s+)?para\s+|el\s+m[eé]todo\s+(?:anal[ií]tico\s+)?de\s+|los\s+m[eé]todos\s+de\s+)/i,
        ''
      )
      .replace(/^(?:y\s+|e\s+|o\s+|sobre\s+|de\s+|del\s+|en\s+|con\s+|para\s+|por\s+|mediante\s+)/i, '')
      .replace(/^(?:el\s+|la\s+|los\s+|las\s+|un\s+|una\s+|tu\s+|tus\s+|su\s+|sus\s+)/i, '')
      .trim();
    if (!candidate || candidate.length < 6 || BARE_ADJECTIVE_TITLE_RE.test(candidate)) {
      break;
    }
    text = candidate;
    if (text === prev) break;
  }

  // Cortar cualquier cláusula coordinada que introduzca un verbo en 2ª persona (presente o futuro)
  text = text
    .replace(
      /\s+(?:y|e)\s+(?:[a-záéíóúñ]{3,}(?:ar[aá]s|er[aá]s|ir[aá]s)|comprendes|identificas|aplicas|analizas|verificas|registras|pruebas|ajustas|defiendes|presentas|socializas|validas|eval[uú]as|consolidas|expones|comunicas|justificas|documentas|garantizas|aseguras|ejecutas|utilizas|empleas|construyes|estructuras|estableces|propones|redactas|elaboras|dise[ñn]as|resuelves|determinas|calculas|aprendes|valoras|desarrollas|sintetizas|experimentas|investigas|estimas|respondes|integras|reflexionas|participas)\b.*$/i,
      ''
    )
    .replace(/\s+y\s+su\s+relaci[oó]n\s+con\s+la\s+problem[aá]tica\b.*$/i, '')
    .replace(/\s+como\s+una\s+herramienta(?:\s+matem[aá]tica)?(?:\s+fundamental)?\s+para\s+modelar.*$/i, ' y modelado de situaciones')
    .replace(/\s+para\s+modelar\s+situaciones\s+de\s+tu\s+entorno.*$/i, '')
    .replace(/\s+vinculad[oa]s?\s+al\s+(?:dise[ñn]o|PAEC|contexto|proyecto).*$/i, '')
    .replace(/\s+en\s+el\s+an[aá]lisis\s+de\s+din[aá]micas.*$/i, '')
    .replace(/\s+mediante\s+(?:una\s+bit[aá]cora|la\s+construcci[oó]n\s+de\s+una\s+matriz|una\s+r[uú]brica|un\s+rigor).*$/i, '')
    .replace(/\s+aplicando\s+un\s+rigor\s+met[oó]dico.*$/i, '')
    .replace(/,\s*(?:integrando|activando|aplicando|asegurando|verificando|presentando|socializando|comprendiendo|garantizando|identificando|validando|evaluando|describiendo|fortaleciendo|utilizando|registrando|detallando|defendiendo|preparando|consolidando|articulando|logrando|permiti[eé]ndote|rescatando|optimizando|ajustando)\b.*$/i, '')
    .replace(/[.;:,]+$/, '')
    .trim();

  // Si aún empieza con palabra inválida ("Y ", "Sobre ", "Tu ", etc.) o cola institucional, limpiar de nuevo
  text = text
    .replace(
      /^(?:riguros[oa]s?\s+de\s+|detallad[oa]s?\s+de\s+|conceptos\s+(?:diagn[oó]sticos|fundamentales|b[aá]sicos)\s+(?:de(?:l)?|sobre)\s+|los\s+principios\s+de\s+|situaciones\s+modeladas\s+por\s+|y\s+|sobre\s+|tu\s+|tus\s+|su\s+|sus\s+|el\s+|la\s+|los\s+|las\s+|un\s+|una\s+)/i,
      ''
    )
    .replace(
      /^(?:conceptos\s+(?:diagn[oó]sticos|fundamentales|b[aá]sicos)\s+(?:de(?:l)?|sobre)\s+|principios\s+de\s+(?:la\s+|los\s+|el\s+|las\s+)?|situaciones\s+modeladas\s+por\s+|tus\s+aprendizajes\s+(?:de|sobre)\s+)/i,
      ''
    )
    .trim();

  // Si después de limpiar sigue excediendo el presupuesto de título (ej. > 62 chars),
  // cortar en un conector secundario (" mediante ", " para ", " con ", etc.) SIN cortar palabras clave como "dos variables"
  if (text.length > 62) {
    const secondaryCut = text.match(
      /^(.{18,64}?)(?:,\s*como\b|\s+(?:mediante|para|utilizando|empleando|usando|aplicando|vinculad[oa]s?|en\s+la\s+validaci[oó]n|en\s+el\s+an[aá]lisis|en\s+planos\s+de|en\s+tu\s+|de\s+tu\s+|con\s+los\s+fundamentos|a\s+trav[eé]s|con\s+un[a]?|y\s+(?:el|la|los|las)\s+|y\s+su\s+(?:aplicaci[oó]n|relaci[oó]n|uso)|y\s+un[a]?|sobre\s+(?:tu|la|los)|antes\s+y\s+despu[eé]s|en\s+el\s+gabinete)\b)/i
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

  text = text.replace(/^(?:el|la|los|las|un|una)\s+/i, '').trim();
  text = repairDanglingEnding(text, false);

  // Validación estricta de salida: nunca devolver adverbios de modo, futuros, conjugaciones 2ª persona ni sintagmas huecos
  if (
    !text ||
    text.length < 6 ||
    STRUCTURAL_HEADING_ONLY_RE.test(text) ||
    BARE_ADJECTIVE_TITLE_RE.test(text) ||
    GENERIC_TITLE_BLACKLIST_RE.test(text) ||
    LEADING_MODE_ADVERB_RE.test(text) ||
    /^[a-záéíóúñ]+mente\b/i.test(text) ||
    FUTURE_SECOND_PERSON_VERB_RE.test(text) ||
    SECOND_PERSON_PRESENT_START_RE.test(text) ||
    INVALID_TITLE_START_RE.test(text)
  ) {
    return '';
  }

  text = normalizeSessionDescriptorTense(text);
  if (FUTURE_SECOND_PERSON_VERB_RE.test(text) || LEADING_MODE_ADVERB_RE.test(text)) {
    return '';
  }
  text = text.charAt(0).toUpperCase() + text.slice(1);
  return text;
}

function isValidResolvedTitle(candidate: string, maxChars: number): boolean {
  if (!candidate || candidate.length < 6) return false;
  if (candidate.length > maxChars + 28) return false;
  if (STRUCTURAL_HEADING_ONLY_RE.test(candidate)) return false;
  if (BARE_ADJECTIVE_TITLE_RE.test(candidate)) return false;
  if (GENERIC_TITLE_BLACKLIST_RE.test(candidate)) return false;
  if (INVALID_TITLE_START_RE.test(candidate)) return false;
  if (LEADING_MODE_ADVERB_RE.test(candidate)) return false;
  if (/^[a-záéíóúñ]+mente\b/i.test(candidate)) return false;
  if (FUTURE_SECOND_PERSON_VERB_RE.test(candidate)) return false;
  if (SECOND_PERSON_PRESENT_START_RE.test(candidate)) return false;
  if (hasDanglingEnding(candidate)) return false;
  return true;
}

/**
 * Extrae el primer título conceptual explícito de `conceptosClave` (ej. "**Ecuaciones de primer grado:** ...")
 * o, si no hay encabezado en negrita, el sujeto disciplinar de la oración inicial.
 */
function extractSectionHeadingFromConceptos(conceptosClave: string | null | undefined): string {
  if (!conceptosClave) return '';
  for (const boldMatch of conceptosClave.matchAll(/\*\*([^*:\n]{6,60})\*\*/g)) {
    const candidate = extractDisciplinaryConceptPhrase(boldMatch[1]);
    if (
      candidate.length >= 6 &&
      !STRUCTURAL_HEADING_ONLY_RE.test(candidate) &&
      !isEvaluationOrClosureObjective(candidate) &&
      !isPaecProjectOrArtifactTitle(candidate)
    ) {
      return candidate;
    }
  }
  const firstSentence = normalizeEditorialText(conceptosClave).split(/(?<=[.?!])\s+/)[0] || '';
  const subjectMatch = firstSentence.match(
    /^(?:El|La|Los|Las|Un|Una)\s+([^,.;:()]{4,84}?)(?:\s+(?:es\b|son\b|constituye[ns]?\b|representa[ns]?\b|requiere[ns]?\b|permite[ns]?\b|describe[ns]?\b|mide[ns]?\b|establece[ns]?\b|estudia[ns]?\b|analiza[ns]?\b|compara[ns]?\b|modela[ns]?\b|garantiza[ns]?\b|integra[ns]?\b|consolida[ns]?\b|valida[ns]?\b|sintetiza[ns]?\b|demuestra[ns]?\b|verifica[ns]?\b|traduce[ns]?\b|relaciona[ns]?\b|vincula[ns]?\b|exige[ns]?\b|implica[ns]?\b|involucra[ns]?\b|cumple[ns]?\b|act[uú]a[ns]?\b|funciona[ns]?\b|opera[ns]?\b|sirve[ns]?\b|consiste[ns]?\b|indica[ns]?\b|transforma[ns]?\b|determina[ns]?\b|diferencia[ns]?\b|clasifica[ns]?\b|organiza[ns]?\b|controla[ns]?\b|regula[ns]?\b|explica[ns]?\b|eval[uú]a[ns]?\b|calcula[ns]?\b|sustituye[ns]?\b|conecta[ns]?\b|se\s+(?:utiliza[ns]?|emplea[ns]?|usa[ns]?|logra[ns]?|define[ns]?|fundamenta[ns]?|basa[ns]?)\b)|,\s*(?:tambi[eé]n\s+)?conocid[oa])/i
  );
  if (subjectMatch && subjectMatch[1]) {
    const rawSubject = subjectMatch[1].trim();
    const subjectCandidate = extractDisciplinaryConceptPhrase(rawSubject);
    if (
      subjectCandidate.length >= 6 &&
      !STRUCTURAL_HEADING_ONLY_RE.test(subjectCandidate) &&
      !isEvaluationOrClosureObjective(subjectCandidate)
    ) {
      return subjectCandidate;
    }
  }
  return '';
}

/**
 * Resuelve el título de pizarrón para una sesión de clase (`08_Presentaciones`).
 * Nunca emite textos genéricos como "Concepto clave de la sesión".
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

  // Priorizar candidatos que NO sean etiquetas de cierre ni wrappers de producto PAEC si hay tema disciplinar disponible
  const pureDisciplinaryCandidates = candidates.filter(
    (c) => !isEvaluationOrClosureObjective(c) && !isPaecProjectOrArtifactTitle(c)
  );
  const disciplinaryCandidates = candidates.filter((c) => !isEvaluationOrClosureObjective(c));
  const pool =
    pureDisciplinaryCandidates.length > 0
      ? pureDisciplinaryCandidates
      : disciplinaryCandidates.length > 0
      ? disciplinaryCandidates
      : candidates;

  for (const candidate of pool) {
    if (isValidResolvedTitle(candidate, maxChars)) {
      return candidate;
    }
  }

  // Fallback seguro desde el mejor candidato limpio (descartando adverbios de modo, futuros, conjugaciones y fragmentos)
  const cleanFallback = [...pool, ...candidates].find((c) => {
    if (
      c.length < 6 ||
      GENERIC_TITLE_BLACKLIST_RE.test(c) ||
      INVALID_TITLE_START_RE.test(c) ||
      LEADING_MODE_ADVERB_RE.test(c) ||
      /^[a-záéíóúñ]+mente\b/i.test(c) ||
      FUTURE_SECOND_PERSON_VERB_RE.test(c) ||
      SECOND_PERSON_PRESENT_START_RE.test(c) ||
      STRUCTURAL_HEADING_ONLY_RE.test(c) ||
      BARE_ADJECTIVE_TITLE_RE.test(c)
    ) {
      return false;
    }
    return true;
  });

  if (!cleanFallback) {
    if (input.strict) {
      throw new SacrintContentError(
        'SACRINT_GENERIC_TITLE',
        `No se pudo resolver un título disciplinar válido (sesión=${input.context?.sessionNumber ?? 'N/A'})`,
        input.context
      );
    }
    return '';
  }

  const fittedFallback = fitPedagogicalText(cleanFallback, {
    maxChars,
    maxWords: Math.max(7, Math.round(maxChars / 6)),
    role: 'concept',
    ensurePeriod: false,
  });
  const finalTitle = fittedFallback || repairDanglingEnding(cleanFallback, false);
  if (!finalTitle || !isValidResolvedTitle(finalTitle, maxChars + 24)) {
    if (input.strict) {
      throw new SacrintContentError(
        'SACRINT_GENERIC_TITLE',
        `El título candidato resultó inválido tras ajuste: "${finalTitle}"`,
        { ...input.context, raw: cleanFallback }
      );
    }
    return '';
  }
  return finalTitle.length > maxChars + 24
    ? repairDanglingEnding(finalTitle.slice(0, maxChars + 24).replace(/\s+\S*$/, ''), false) || finalTitle
    : finalTitle;
}

/**
 * Resuelve el título conceptual para una infografía (`09_Infografias_Sinteticas`).
 * Garantiza que en misiones de evaluación/cierre el título sea siempre el concepto disciplinar,
 * nunca "Versión depurada y validada de tu evidencia formativa..." ni textos genéricos.
 */
function stripLeadingTitleAdverbs(value: string): string {
  const cleaned = value
    .replace(
      /^(?:correctamente|adecuadamente|t[eé]cnicamente|f[ií]sicamente|conceptualmente|pr[aá]cticamente|anal[ií]ticamente|matem[aá]ticamente|gr[aá]ficamente|experimentalmente|rigurosamente|precisamente|exactamente|formalmente|estrictamente|progresivamente|gradualmente|finalmente|b[aá]sicamente|p[uú]blicamente|sistem[aá]ticamente|cr[ií]ticamente)\s+/i,
      ''
    )
    .trim();
  if (!cleaned) return '';
  return /^[a-záéíóúñ]/.test(cleaned)
    ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
    : cleaned;
}

export function resolveInfographicConceptTitle(input: TopicTitleInput): string {
  const maxChars = input.maxChars ?? 68;

  // En infografías misionales, si el objetivo de la sesión es de evaluación/cierre, priorizar missionSessionTopic / missionFocus / sectionTitle
  const objectiveIsClosure = isEvaluationOrClosureObjective(input.sessionObjective);
  const objectiveIsMeta =
    objectiveIsClosure ||
    /\b(?:evidencia|bit[aá]cora|portafolio|evaluaci[oó]n|metacognici[oó]n|cierre|defiende|argumenta|sintetiza)\b/i.test(
      input.sessionObjective || ''
    );

  const orderedRaw = objectiveIsMeta
    ? [
        input.missionSessionTopic,
        input.missionFocus,
        extractSectionHeadingFromConceptos(input.conceptosClave),
        input.sectionTitle,
        input.sessionObjective,
        input.missionTitle,
      ]
    : [
        input.sectionTitle,
        input.sessionObjective,
        extractSectionHeadingFromConceptos(input.conceptosClave),
        input.missionSessionTopic,
        input.missionFocus,
        input.missionTitle,
      ];

  const resolvedCandidates = orderedRaw
    .map((raw) => (raw ? extractDisciplinaryConceptPhrase(raw) : ''))
    .filter(
      (candidate) =>
        isValidResolvedTitle(candidate, maxChars) &&
        !isEvaluationOrClosureObjective(candidate) &&
        !/^evaluaci[oó]n\s+y\s+cierre$/i.test(candidate)
    );

  const nonPaec = resolvedCandidates.filter((c) => !isPaecProjectOrArtifactTitle(c));
  const finalCandidates = nonPaec.length > 0 ? nonPaec : resolvedCandidates;

  if (finalCandidates.length > 0) {
    const candidate = stripLeadingTitleAdverbs(finalCandidates[0]!);
    if (!isValidResolvedTitle(candidate, maxChars)) {
      return resolveChalkboardTopicTitle({ ...input, maxChars });
    }
    // Enriquecer títulos de 2–3 palabras muy cortos en cierre (ej. "Tipos de ángulos" -> "Tipos de ángulos y geometría plana" si el contexto lo respalda)
    if (/^tipos\s+de\s+[aá]ngulos$/i.test(candidate)) {
      return 'Tipos de ángulos y geometría plana';
    }
    if (/^forma\s+general$/i.test(candidate) && /cuadr[aá]tic/i.test(`${input.sessionObjective || ''} ${input.conceptosClave || ''}`)) {
      return 'Forma general de la ecuación cuadrática';
    }
    return candidate;
  }

  const fallback = resolveChalkboardTopicTitle({ ...input, maxChars });
  if (!fallback || GENERIC_TITLE_BLACKLIST_RE.test(fallback)) {
    if (input.strict) {
      throw new SacrintContentError(
        'SACRINT_GENERIC_TITLE',
        `No se pudo resolver un título conceptual válido para la infografía`,
        input.context
      );
    }
    return '';
  }
  const cleanedFallback = stripLeadingTitleAdverbs(fallback);
  return isValidResolvedTitle(cleanedFallback, maxChars + 24) ? cleanedFallback : '';
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
    .replace(
      /(Sesi[oó]n\s+\d+\s*:\s*)([^—–\n]+)$/i,
      (_m, sesPrefix: string, desc: string) => `${sesPrefix}${normalizeSessionDescriptorTense(desc)}`
    )
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

/**
 * Compone de forma idempotente el encabezado "Sesión N: ..." evitando
 * duplicaciones ("Sesión 1: Sesión 1...") y reparando finales colgantes.
 */
export function composeSessionHeading(input: {
  number: number;
  objective?: string | null;
  fallback?: string;
}): string {
  const num = Number.isFinite(input.number) && input.number > 0 ? Math.trunc(input.number) : 1;
  const fallback = finalizeVisibleText(input.fallback || 'Desarrollo temático', { ensurePeriod: false });
  let body = finalizeVisibleText(input.objective ?? '', { ensurePeriod: false });

  // Remover iterativamente prefijos redundantes de sesión o numeración inicial
  let prev = '';
  while (body !== prev) {
    prev = body;
    body = body
      .replace(new RegExp(`^(?:sesi[oó]n\\s*${num}|sesi[oó]n\\s*\\d+)\\s*(?:[:.\\-–—]+\\s*|\\s+(?=[A-ZÁÉÍÓÚÑ¿¡0-9]))`, 'i'), '')
      .replace(/^\d{1,2}\s*[.)\-–—]+\s*/, '')
      .trim();
  }

  // Remover cola redundante "· Sesión N" o "(Sesión N)" si ya irá en el encabezado
  body = body
    .replace(new RegExp(`\\s*[·\\-–—]+\\s*sesi[oó]n\\s*${num}$`, 'i'), '')
    .replace(/[.]+$/, '')
    .trim();

  body = finalizeVisibleText(body, { fallback, ensurePeriod: false })
    .replace(/[.]+$/, '')
    .trim();

  if (!body) body = fallback || 'Desarrollo temático';
  if (/^[a-záéíóúñ]/.test(body)) {
    body = body.charAt(0).toUpperCase() + body.slice(1);
  }
  return `Sesión ${num}: ${body}`;
}
