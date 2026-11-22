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
  /^(?:y\b|e\b|o\b|sobre\b|tu\b|tus\b|su\b|sus\b|vas\s+a\b|vamos\s+a\b|aprender[aá]s\b|evaluar[aá]s\b|integrar[aá]s\b|optimizar[aá]s\b|representar[aá]s\b|gr[aá]ficamente\b|versi[oó]n\s+depurada\b|evidencia\s+formativa\b|p[uú]blicamente\b|hallazgos\b|en\s+esta\s+sesi[oó]n\b|durante\s+la\b|para\s+que\b|mediante\s+la\b|a\s+trav[eé]s\s+de\b|manera\s+(?:formativa|integral|rigurosa|sistem[aá]tica|cr[ií]tica)\b|forma\s+(?:formativa|integral|rigurosa|sistem[aá]tica|cr[ií]tica)\b|todos\s+los\s+conocimientos\b|sintetizar\s+y\s+realizar\b|realizar\s+una\s+reflexi[oó]n\b)/i;

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

  // Eliminar arranques verbales y muletillas pedagógicas en cascada (sin reducir el título a un adjetivo suelto)
  for (let pass = 0; pass < 5; pass++) {
    const prev = text;
    const candidate = text
      .replace(
        /^(?:en\s+esta\s+sesi[oó]n\s+|hoy\s+)?(?:vas\s+a\s+|vamos\s+a\s+|el\s+estudiante\s+(?:va\s+a\s+|lograr[aá]\s+)?|lograr[aá]s\s+)/i,
        ''
      )
      .replace(
        /^(?:aprendes\s+a(?:\s+(?:aplicar|resolver|modelar|calcular|contrastar(?:\s+y\s+verificar)?|construir|tabular))?|comprendes(?:\s+y\s+aplicas)?|realizas|consolidas|socializas(?:\s+(?:los|tus)\s+hallazgos(?:\s+de)?)?|integras(?:,\s*depuras)?(?:\s+y\s+(?:validas|eval[uú]as|consolidas))?|validas(?:\s+y\s+depuras)?|depuras(?:\s+y\s+validas)?|aplicas(?:\s+con\s+precisi[oó]n)?|calculas|construyes|modelas(?:\s+matem[aá]ticamente|\s+algebraicamente)?|determinas|identificas(?:\s+y\s+aplicas)?|resuelves(?:\s+gr[aá]ficamente|\s+anal[ií]ticamente)?|analizas(?:\s+y\s+modelas)?|dise[ñn]as|utilizas|empleas|eval[uú]as(?:\s+de\s+(?:forma|manera)\s+(?:formativa|integral|cr[ií]tica|sistem[aá]tica))?|clasificas(?:\s+y\s+mides)?|comparas|interpretas|verificas|presentas|defiendes|estructuras|expones|demuestras|optimizas(?:\s+y\s+consolidas)?)\s+/i,
        ''
      )
      .replace(
        /^(?:integrar(?:[aá]s)?\s+todos\s+los\s+conocimientos\s+de\s+|todos\s+los\s+conocimientos\s+de\s+)/i,
        ''
      )
      .replace(
        /^(?:recuperar(?:\s+tus)?\s+saberes\s+previos(?:\s+sobre|\s+acerca\s+de|\s+y\s+delimitar(?:[aá]s)?)?|activar(?:\s+tus)?\s+saberes\s+previos(?:\s+sobre|\s+y)?|integrar,\s*evaluar\s+formativamente\s+y\s+reflexionar\s+sobre(?:\s+tus\s+aprendizajes\s+de)?|integrar(?:[aá]s)?(?:,\s*depurar(?:[aá]s)?)?(?:\s+y\s+(?:validar(?:[aá]s)?|evaluar(?:[aá]s)?|consolidar(?:[aá]s)?))?(?:\s+(?:los\s+conocimientos|los\s+modelos|las\s+soluciones))?(?:\s+(?:sobre|de|en))?|optimizar(?:[aá]s)?(?:,\s*depurar(?:[aá]s)?)?(?:\s+y\s+(?:validar(?:[aá]s)?|consolidar(?:[aá]s)?|depurar(?:[aá]s)?))?(?:\s+(?:la\s+versi[oó]n\s+depurada\s+y\s+validada\s+de\s+)?(?:tu\s+evidencia\s+formativa|los\s+modelos(?:\s+matem[aá]ticos)?)\s*(?:mediante|integrando|sobre|de)?)?|depurar(?:[aá]s)?(?:\s+y\s+validar(?:[aá]s)?)?|validar(?:[aá]s)?|evaluar(?:[aá]s)?(?:\s+(?:de\s+manera\s+formativa|formativamente)(?:\s+(?:los|las|el|la))?|\s+tus\s+(?:conocimientos|aprendizajes)(?:\s+y\s+consolidar(?:\s+tu\s+dominio)?)?(?:\s+(?:sobre|de|del|en|mediante))?|\s+tu\s+aprendizaje\s+mediante(?:\s+la\s+aplicaci[oó]n\s+de)?)?|defender(?:\s+p[uú]blicamente)?(?:\s+los\s+hallazgos\s+de\s+tu\s+proyecto(?:\s+integrador)?(?:\s+comunitario)?(?:\s+mediante(?:\s+la\s+aplicaci[oó]n(?:\s+rigurosa)?\s+de(?:l)?)?)?)?|aprender(?:[aá]s)?\s+a(?:\s+(?:aplicar|resolver|modelar|calcular|contrastar(?:\s+y\s+verificar)?|construir|Tabular|tabular))?|comprender(?:[aá]s)?\s+y\s+aplicar(?:[aá]s)?|identificar(?:[aá]s)?\s+y\s+aplicar(?:[aá]s)?|visualizar(?:[aá]s)?(?:\s+gr[aá]ficamente)?|representar(?:[aá]s)?(?:\s+gr[aá]ficamente(?:\s+y\s+tabular(?:[aá]s)?)?)?|graficar(?:[aá]s)?(?:\s+y\s+tabular(?:[aá]s)?)?|tabular(?:[aá]s)?|modelar(?:[aá]s)?(?:\s+matem[aá]ticamente|\s+algebraicamente)?|calcular(?:[aá]s)?|determinar(?:[aá]s)?|clasificar(?:[aá]s)?(?:\s+y\s+medir(?:[aá]s)?)?|medir(?:[aá]s)?|verificar(?:[aá]s)?|argumentar(?:[aá]s)?|elaborar(?:[aá]s)?|dise[ñn]ar(?:[aá]s)?|interpretar(?:[aá]s)?|sintetizar(?:[aá]s)?|presentar(?:[aá]s)?|socializar(?:[aá]s)?(?:\s+tus\s+hallazgos(?:\s+de)?|\s+hallazgos)?|exponer(?:[aá]s)?|trabajar(?:[aá]s)?|comparar(?:[aá]s)?|identificar(?:[aá]s)?|comprender(?:[aá]s)?|analizar(?:[aá]s)?(?:\s+y\s+modelar(?:[aá]s)?(?:\s+matem[aá]ticamente)?)?|aplicar(?:[aá]s)?|resolver(?:[aá]s)?(?:\s+gr[aá]ficamente|\s+anal[ií]ticamente)?|construir(?:[aá]s)?(?:\s+y\s+analizar(?:[aá]s)?)?|estructurar(?:[aá]s)?|dominar(?:[aá]s)?|contrastar(?:[aá]s)?|delimitar(?:[aá]s)?|explorar(?:[aá]s)?|consolidar(?:[aá]s)?|reflexionar(?:[aá]s)?(?:\s+sobre(?:\s+tus\s+aprendizajes\s+de)?)?|realizar(?:[aá]s)?)\s+/i,
        ''
      )
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

  // Última salvaguarda ante verbos en segunda persona del futuro residuales
  text = text.replace(/\s+y\s+(?:aprender[áa]s|resolver[áa]s|contrastar[áa]s|presentar[áa]s|validar[áa]s|tabular[áa]s|delimitar[áa]s)\b.*$/i, '').trim();
  if (/^(?:Aprender[áa]s|Evaluar[áa]s|Vas\s+a)\b/i.test(text)) {
    text = normalizeSessionDescriptorTense(text);
  }

  // Cortar colas circunstanciales o administrativas que no son parte del concepto disciplinar
  text = text
    .replace(/\s+y\s+(?:activar[aá]s|delimitar[aá]s|aplicar[aá]s|evaluar[aá]s|reflexionar[aá]s|presentar[aá]s|socializar[aá]s|defender[aá]s|validar[aá]s|consolidar[aá]s|comunicar[aá]s|interpretar[aá]s|verificar[aá]s|defiendes|presentas|socializas|validas|eval[uú]as|aplicas|consolidas|expones|comunicas|verificas)\b.*$/i, '')
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

  // Si aún empieza con palabra inválida ("Y ", "Sobre ", "Tu ", etc.) o cola adverbial/institucional, limpiar de nuevo
  text = text
    .replace(
      /^(?:gr[aá]ficamente(?:\s+y\s+tabular(?:[aá]s)?)?\s+|anal[ií]ticamente\s+|algebraicamente\s+|riguros[oa]s?\s+de\s+|detallad[oa]s?\s+de\s+|conceptos\s+(?:diagn[oó]sticos|fundamentales|b[aá]sicos)\s+(?:de(?:l)?|sobre)\s+|los\s+principios\s+de\s+|situaciones\s+modeladas\s+por\s+|matriz\s+de\s+contextualizaci[oó]n(?:\s+y\s+(?:una\s+)?ruta\s+de\s+trabajo\s+aplicando|\s+para\s+identificar)?\s+|y\s+|sobre\s+|tu\s+|tus\s+|su\s+|sus\s+|el\s+|la\s+|los\s+|las\s+|un\s+|una\s+)/i,
      ''
    )
    .replace(
      /^(?:conceptos\s+(?:diagn[oó]sticos|fundamentales|b[aá]sicos)\s+(?:de(?:l)?|sobre)\s+|principios\s+de\s+(?:la\s+|los\s+|el\s+|las\s+)?|situaciones\s+modeladas\s+por\s+|tus\s+aprendizajes\s+(?:de|sobre)\s+)/i,
      ''
    )
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

  text = stripLeadingTitleAdverbs(text).replace(/^(?:el|la|los|las|un|una)\s+/i, '').trim();
  text = repairDanglingEnding(text, false);
  if (STRUCTURAL_HEADING_ONLY_RE.test(text) || BARE_ADJECTIVE_TITLE_RE.test(text)) return '';

  if (text.length > 0) {
    text = normalizeSessionDescriptorTense(text);
    text = text.charAt(0).toUpperCase() + text.slice(1);
  }

  return text;
}

function isValidResolvedTitle(candidate: string, maxChars: number): boolean {
  if (!candidate || candidate.length < 6) return false;
  if (candidate.length > maxChars + 15) return false;
  if (STRUCTURAL_HEADING_ONLY_RE.test(candidate)) return false;
  if (BARE_ADJECTIVE_TITLE_RE.test(candidate)) return false;
  if (INVALID_TITLE_START_RE.test(candidate)) return false;
  if (/\b[a-záéíóúñ]{3,}(?:ar[aá]s|er[aá]s|ir[aá]s)\b/i.test(candidate)) return false;
  if (/^[a-záéíóúñ]+mente\b/i.test(candidate)) return false;
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
    /^(?:El|La|Los|Las|Un|Una)\s+([^,.;:()]{6,84}?)(?:\s+(?:es\b|son\b|constituye[ns]?\b|representa[ns]?\b|requiere[ns]?\b|permite[ns]?\b|describe[ns]?\b|mide[ns]?\b|establece[ns]?\b|estudia[ns]?\b|analiza[ns]?\b|compara[ns]?\b|modela[ns]?\b|garantiza[ns]?\b|integra[ns]?\b|consolida[ns]?\b|valida[ns]?\b|sintetiza[ns]?\b|demuestra[ns]?\b|verifica[ns]?\b|traduce[ns]?\b|relaciona[ns]?\b|vincula[ns]?\b)|,\s*tambi[eé]n\s+conocid[oa])/i
  );
  if (subjectMatch && subjectMatch[1]) {
    const subjectCandidate = extractDisciplinaryConceptPhrase(subjectMatch[1]);
    if (
      subjectCandidate.length >= 8 &&
      !STRUCTURAL_HEADING_ONLY_RE.test(subjectCandidate) &&
      !isEvaluationOrClosureObjective(subjectCandidate) &&
      !isPaecProjectOrArtifactTitle(subjectCandidate)
    ) {
      return subjectCandidate;
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

  // Fallback seguro desde el mejor candidato limpio (descartando inicios inválidos o futuros truncados)
  const cleanFallback = [...pool, ...candidates].find(
    (c) =>
      c.length >= 6 &&
      !INVALID_TITLE_START_RE.test(c) &&
      !/\b[a-záéíóúñ]{3,}(?:ar[aá]s|er[aá]s|ir[aá]s)\b/i.test(c) &&
      !/^[a-záéíóúñ]+mente\b/i.test(c)
  );
  const fallback = cleanFallback || 'Concepto clave de la sesión';
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
function stripLeadingTitleAdverbs(value: string): string {
  const cleaned = value
    .replace(
      /^(?:rigurosamente|precisamente|exactamente|formalmente|estrictamente|conceptualmente|progresivamente|gradualmente|finalmente|básicamente)\s+/i,
      ''
    )
    .trim();
  if (!cleaned) return value;
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
    // Enriquecer títulos de 2–3 palabras muy cortos en cierre (ej. "Tipos de ángulos" -> "Tipos de ángulos y geometría plana" si el contexto lo respalda)
    if (/^tipos\s+de\s+[aá]ngulos$/i.test(candidate)) {
      return 'Tipos de ángulos y geometría plana';
    }
    if (/^forma\s+general$/i.test(candidate) && /cuadr[aá]tic/i.test(`${input.sessionObjective || ''} ${input.conceptosClave || ''}`)) {
      return 'Forma general de la ecuación cuadrática';
    }
    return candidate;
  }

  return stripLeadingTitleAdverbs(resolveChalkboardTopicTitle({ ...input, maxChars }));
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
