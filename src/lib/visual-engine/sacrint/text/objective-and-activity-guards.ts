import { fitPedagogicalText } from '@/lib/editorial/fitter/text-compactor';
import { hasDanglingEnding } from '@/lib/editorial/fitter/dangling-guards';
import { splitSpanishSentences } from '@/lib/editorial/fitter/sentence-splitter';
import {
  FUTURE_SECOND_PERSON_VERB_RE,
  GENERIC_TITLE_BLACKLIST_RE,
  LEADING_MODE_ADVERB_RE,
  resolveChalkboardTopicTitle,
  SacrintContentError,
  type SacrintContentErrorContext,
} from '@/lib/editorial/topic-title-resolver';
import type { NormalizeObjectiveContext, PracticeActivityValidationResult } from '../types';
import {
  BOILERPLATE_PREFIX_RE,
  cleanSacrintText,
  isRubricOrBoilerplateLeak,
  sanitizePedagogicalMetaPhrases,
} from './grammar-normalization';

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
  if (!candidate || GENERIC_TITLE_BLACKLIST_RE.test(candidate)) return '';
  return candidate.charAt(0).toUpperCase() + candidate.slice(1);
}

/**
 * Sintetiza un objetivo extenso ("Vas a identificar el concepto de ecuación...") en un
 * título conciso de pizarrón para el docente ("Concepto de ecuación para modelar situaciones").
 */
export function extractChalkboardTopicTitle(
  rawObjectiveOrTitle: string | null | undefined,
  fallbackTopic?: string | null,
  extraContext?: string | null
): string {
  return resolveChalkboardTopicTitle({
    conceptosClave: extraContext ?? null,
    sessionObjective: rawObjectiveOrTitle,
    missionSessionTopic: fallbackTopic,
    missionTitle: fallbackTopic,
  });
}

/**
 * Mapa explícito de verbos conjugados en 2ª persona (presente/futuro/subjuntivo) → infinitivo.
 * Cubre el inventario completo de objetivos de las 12 asignaturas + verbos pedagógicos estándar.
 * Nota: `aplicas`/`aplicarás` se normalizan a `emplear` para no colisionar con el candado
 * `objective_aplicar_prefix` reservado contra prefijos mecánicos `"Aplicar ..."`.
 */
export const SECOND_PERSON_TO_INFINITIVE_MAP: Record<string, string> = {
  acotas: 'acotar',
  actualizas: 'actualizar',
  ajustas: 'ajustar',
  ajustaras: 'ajustar',
  ajustarás: 'ajustar',
  analizas: 'analizar',
  analizaras: 'analizar',
  analizarás: 'analizar',
  aplicas: 'emplear',
  aplicaras: 'emplear',
  aplicarás: 'emplear',
  aprendes: 'aprender',
  aprenderas: 'aprender',
  aprenderás: 'aprender',
  argumentas: 'argumentar',
  aseguras: 'asegurar',
  auditas: 'auditar',
  auditaras: 'auditar',
  auditarás: 'auditar',
  calculas: 'calcular',
  calcularas: 'calcular',
  calcularás: 'calcular',
  capturas: 'capturar',
  clasificas: 'clasificar',
  clasificaras: 'clasificar',
  clasificarás: 'clasificar',
  colocas: 'colocar',
  comparas: 'comparar',
  compararas: 'comparar',
  compararás: 'comparar',
  comprendes: 'comprender',
  comprenderas: 'comprender',
  comprenderás: 'comprender',
  comunicas: 'comunicar',
  conectas: 'conectar',
  configuras: 'configurar',
  conjugas: 'conjugar',
  conoces: 'conocer',
  consolidas: 'consolidar',
  consolidaras: 'consolidar',
  consolidarás: 'consolidar',
  construyes: 'construir',
  construiras: 'construir',
  construirás: 'construir',
  contrastas: 'contrastar',
  contrastaras: 'contrastar',
  contrastarás: 'contrastar',
  controlas: 'controlar',
  corriges: 'corregir',
  cuantificas: 'cuantificar',
  decodificas: 'decodificar',
  decodificaras: 'decodificar',
  decodificarás: 'decodificar',
  deduces: 'deducir',
  defiendes: 'defender',
  defenderas: 'defender',
  defenderás: 'defender',
  delimitas: 'delimitar',
  delimitaras: 'delimitar',
  delimitarás: 'delimitar',
  demuestras: 'demostrar',
  depuras: 'depurar',
  depuraras: 'depurar',
  depurarás: 'depurar',
  desarrollas: 'desarrollar',
  desarrollaras: 'desarrollar',
  desarrollarás: 'desarrollar',
  describes: 'describir',
  determinas: 'determinar',
  determinaras: 'determinar',
  determinarás: 'determinar',
  diagnosticas: 'diagnosticar',
  dibujas: 'dibujar',
  diferencias: 'diferenciar',
  digitalizas: 'digitalizar',
  diseñas: 'diseñar',
  disenas: 'diseñar',
  diseñaras: 'diseñar',
  diseñarás: 'diseñar',
  distingues: 'distinguir',
  documentas: 'documentar',
  dominas: 'dominar',
  dominaras: 'dominar',
  dominarás: 'dominar',
  ejecutas: 'ejecutar',
  ejecutaras: 'ejecutar',
  ejecutarás: 'ejecutar',
  elaboras: 'elaborar',
  elaboraras: 'elaborar',
  elaborarás: 'elaborar',
  empleas: 'emplear',
  ensamblas: 'ensamblar',
  estableces: 'establecer',
  estableceras: 'establecer',
  establecerás: 'establecer',
  estimas: 'estimar',
  estructuras: 'estructurar',
  estructuraras: 'estructurar',
  estructurarás: 'estructurar',
  evaluas: 'evaluar',
  evalúas: 'evaluar',
  evaluaras: 'evaluar',
  evaluarás: 'evaluar',
  experimentas: 'experimentar',
  experimentaras: 'experimentar',
  experimentarás: 'experimentar',
  explicas: 'explicar',
  exploras: 'explorar',
  expones: 'exponer',
  formulas: 'formular',
  garantizas: 'garantizar',
  generas: 'generar',
  gestionas: 'gestionar',
  graficas: 'graficar',
  hallas: 'hallar',
  identificas: 'identificar',
  identificaras: 'identificar',
  identificarás: 'identificar',
  implementas: 'implementar',
  inauguras: 'inaugurar',
  indagas: 'indagar',
  inicias: 'iniciar',
  inspeccionas: 'inspeccionar',
  instalas: 'instalar',
  integras: 'integrar',
  integraras: 'integrar',
  integrarás: 'integrar',
  interpretas: 'interpretar',
  interpretes: 'interpretar',
  interpretaras: 'interpretar',
  interpretarás: 'interpretar',
  investigas: 'investigar',
  justificas: 'justificar',
  limpias: 'limpiar',
  mides: 'medir',
  modelas: 'modelar',
  modelaras: 'modelar',
  modelarás: 'modelar',
  monitoreas: 'monitorear',
  optimizas: 'optimizar',
  optimizaras: 'optimizar',
  optimizarás: 'optimizar',
  organizas: 'organizar',
  organizaras: 'organizar',
  organizarás: 'organizar',
  participas: 'participar',
  participaras: 'participar',
  participarás: 'participar',
  perfeccionas: 'perfeccionar',
  planificas: 'planificar',
  planteas: 'plantear',
  plantearas: 'plantear',
  plantearás: 'plantear',
  preparas: 'preparar',
  presentas: 'presentar',
  presentaras: 'presentar',
  presentarás: 'presentar',
  procesas: 'procesar',
  produces: 'producir',
  proyectas: 'proyectar',
  pruebas: 'probar',
  realizas: 'realizar',
  realizaras: 'realizar',
  realizarás: 'realizar',
  reconoces: 'reconocer',
  recuperas: 'recuperar',
  redactas: 'redactar',
  redactaras: 'redactar',
  redactarás: 'redactar',
  rediseñas: 'rediseñar',
  reescribes: 'reescribir',
  refinas: 'refinar',
  reflexionas: 'reflexionar',
  registras: 'registrar',
  registraras: 'registrar',
  registrarás: 'registrar',
  rehabilitas: 'rehabilitar',
  relacionas: 'relacionar',
  reparas: 'reparar',
  representas: 'representar',
  representaras: 'representar',
  representarás: 'representar',
  respondes: 'responder',
  resuelves: 'resolver',
  resolveras: 'resolver',
  resolverás: 'resolver',
  seleccionas: 'seleccionar',
  simulas: 'simular',
  sintetizas: 'sintetizar',
  sistematizas: 'sistematizar',
  sistematizaras: 'sistematizar',
  sistematizarás: 'sistematizar',
  socializas: 'socializar',
  socializaras: 'socializar',
  socializarás: 'socializar',
  sustentas: 'sustentar',
  tabulas: 'tabular',
  traduces: 'traducir',
  transcribes: 'transcribir',
  transformas: 'transformar',
  trazas: 'trazar',
  trazaras: 'trazar',
  trazarás: 'trazar',
  utilizas: 'utilizar',
  validas: 'validar',
  validaras: 'validar',
  validarás: 'validar',
  valoras: 'valorar',
  valoraras: 'valorar',
  valorarás: 'valorar',
  verificas: 'verificar',
  vinculas: 'vincular',
  visualizas: 'visualizar',
  adquieres: 'adquirir',
  acuerdas: 'acordar',
  articulas: 'articular',
  asumes: 'asumir',
  atribuyes: 'atribuir',
  categorizas: 'categorizar',
  compones: 'componer',
  compruebas: 'comprobar',
  conceptualizas: 'conceptualizar',
  concluyes: 'concluir',
  conduces: 'conducir',
  contextualizas: 'contextualizar',
  contienes: 'contener',
  contribuyes: 'contribuir',
  criticas: 'criticar',
  cuestionas: 'cuestionar',
  debates: 'debatir',
  defines: 'definir',
  deliberas: 'deliberar',
  dialogas: 'dialogar',
  diriges: 'dirigir',
  discutes: 'discutir',
  dispones: 'disponer',
  distribuyes: 'distribuir',
  ejemplificas: 'ejemplificar',
  eliges: 'elegir',
  encuentras: 'encontrar',
  enriqueces: 'enriquecer',
  enuncias: 'enunciar',
  escoges: 'escoger',
  examinas: 'examinar',
  excluyes: 'excluir',
  exiges: 'exigir',
  favoreces: 'favorecer',
  filosofas: 'filosofar',
  formalizas: 'formalizar',
  fortaleces: 'fortalecer',
  fundamentas: 'fundamentar',
  fundamentaras: 'fundamentar',
  fundamentarás: 'fundamentar',
  incluyes: 'incluir',
  infieres: 'inferir',
  introduces: 'introducir',
  jerarquizas: 'jerarquizar',
  mantienes: 'mantener',
  muestras: 'mostrar',
  obtienes: 'obtener',
  ofreces: 'ofrecer',
  perteneces: 'pertenecer',
  postulas: 'postular',
  prefieres: 'preferir',
  problematizas: 'problematizar',
  propones: 'proponer',
  proteges: 'proteger',
  razonas: 'razonar',
  recoges: 'recoger',
  recuerdas: 'recordar',
  reduces: 'reducir',
  reproduces: 'reproducir',
  requieres: 'requerir',
  resumes: 'resumir',
  reunes: 'reunir',
  reúnes: 'reunir',
  sostienes: 'sostener',
  sugieres: 'sugerir',
  supones: 'suponer',
  sustituyes: 'sustituir',
  transfieres: 'transferir',
  unes: 'unir',
};

const IRREGULAR_SECOND_PERSON_FUTURES: Record<string, string> = {
  haras: 'hacer',
  harás: 'hacer',
  diras: 'decir',
  dirás: 'decir',
  pondras: 'poner',
  pondrás: 'poner',
  propondras: 'proponer',
  propondrás: 'proponer',
  expondras: 'exponer',
  expondrás: 'exponer',
  compondras: 'componer',
  compondrás: 'componer',
  dispondras: 'disponer',
  dispondrás: 'disponer',
  supondras: 'suponer',
  supondrás: 'suponer',
  tendras: 'tener',
  tendrás: 'tener',
  obtendras: 'obtener',
  obtendrás: 'obtener',
  mantendras: 'mantener',
  mantendrás: 'mantener',
  sostendras: 'sostener',
  sostendrás: 'sostener',
  contendras: 'contener',
  contendrás: 'contener',
  vendras: 'venir',
  vendrás: 'venir',
  intervendras: 'intervenir',
  intervendrás: 'intervenir',
  prevendras: 'prevenir',
  prevendrás: 'prevenir',
  saldras: 'salir',
  saldrás: 'salir',
  sabras: 'saber',
  sabrás: 'saber',
  podras: 'poder',
  podrás: 'poder',
  querras: 'querer',
  querrás: 'querer',
  habras: 'haber',
  habrás: 'haber',
  valdras: 'valer',
  valdrás: 'valer',
  cabras: 'caber',
  cabrás: 'caber',
};

const NON_FUTURE_UNACCENTED_PLURALS = new Set([
  'caras', 'paras', 'varas', 'tiaras', 'claras', 'raras', 'peras', 'ceras', 'feras', 'eras', 'tiras', 'liras',
]);

const NON_VERB_AR_ER_IR_NOUNS = new Set([
  'lugar', 'pilar', 'taller', 'color', 'valor', 'motor', 'sensor', 'factor', 'sector', 'vector',
  'mayor', 'menor', 'mejor', 'peor', 'exterior', 'interior', 'superior', 'inferior', 'anterior',
  'posterior', 'circular', 'popular', 'escolar', 'familiar', 'particular', 'celular',
  'solar', 'bipolar', 'singular', 'angular', 'molecular', 'muscular', 'vascular', 'ocular',
  'secular', 'insular', 'peninsular', 'consular', 'capilar', 'axilar', 'maxilar', 'similar',
  'estelar', 'preliminar', 'interdisciplinar', 'multidisciplinar', 'transdisciplinar', 'pulmonar',
  'lunar', 'nuclear', 'peculiar', 'lineal',
  'estandar', 'estándar', 'azucar', 'azúcar', 'caracter',
  'carácter', 'lider', 'líder', 'laser', 'láser', 'poster', 'póster', 'cluster', 'clúster',
  'dolar', 'dólar', 'folder', 'fólder', 'mar', 'par', 'bar', 'hogar', 'altar', 'azar', 'bazar',
  'calor', 'dolor', 'error', 'favor', 'honor', 'humor', 'labor', 'licor', 'mayor', 'menor',
  'sabor', 'sudor', 'temor', 'tenor', 'vapor', 'vigor', 'autor', 'actor', 'doctor', 'rector',
  'tutor', 'conductor', 'constructor', 'productor', 'reproductor', 'interruptor', 'procesador',
  'computador', 'ordenador', 'servidor', 'indicador', 'ventilador', 'disipador', 'regulador',
  'transformador', 'condensador', 'amplificador', 'controlador', 'medidor', 'marcador', 'borrador',
  'simulador', 'compilador', 'navegador', 'buscador', 'evaluador', 'observador', 'investigador',
  'trabajador', 'operador', 'jugador', 'comprador', 'vendedor', 'consumidor', 'proveedor',
  'constructor', 'arquitecto', 'corrector', 'detector', 'protector', 'conector', 'selector',
  'inspector', 'director', 'colector', 'proyector', 'inyector', 'reflector', 'elector', 'lector',
  'monitor', 'emisor', 'receptor', 'transmisor', 'compresor', 'profesor', 'asesor', 'sucesor',
  'predecesor', 'impresor', 'divisor', 'tensor', 'ascensor', 'defensor', 'extensor', 'espensor',
  'calibrador', 'destornillador', 'generador', 'acumulador', 'estabilizador', 'enfriador',
  'poder', 'deber', 'ser', 'saber', 'placer', 'amanecer', 'atardecer', 'anochecer', 'padecer',
  'taller', 'mujer', 'cualquier', 'mier', 'ayer', 'chofer', 'suéter', 'cáter', 'carter',
  'porvenir', 'devenir', 'elixir', 'zafir', 'faquir', 'emir', 'visir', 'mártir',
]);

const SHORT_VALID_INFINITIVES = new Set(['dar', 'ver', 'oir', 'oír']);

export function isSpanishInfinitiveVerb(word: string): boolean {
  const clean = word.toLowerCase().replace(/[^a-záéíóúñ]/g, '');
  if (SHORT_VALID_INFINITIVES.has(clean)) return true;
  if (clean.length < 4) return false;
  if (NON_VERB_AR_ER_IR_NOUNS.has(clean)) return false;
  if (!/(?:ar|er|ir)$/.test(clean)) return false;
  if (Object.values(SECOND_PERSON_TO_INFINITIVE_MAP).includes(clean)) return true;
  return /^[a-záéíóúñ]{2,}(?:ar|er|ir)$/.test(clean);
}

/**
 * Convierte cualquier verbo español conjugado en 2ª persona singular (futuro o presente académico)
 * a su infinitivo correspondiente. Cubre el 100% de futuros regulares (-arás/-erás/-irás),
 * futuros irregulares y sufijos verbales inequívocos de 1ª conjugación.
 */
function resolveSecondPersonVerbToInfinitive(
  word: string,
  options?: { isInitial?: boolean }
): string | null {
  const clean = word.toLowerCase().replace(/[^a-záéíóúñ]/g, '');
  if (!clean) return null;

  const finalize = (inf: string): string => {
    if (inf === 'aplicar') {
      return options?.isInitial ? 'emplear' : 'aplicar';
    }
    return inf;
  };

  if (Object.prototype.hasOwnProperty.call(SECOND_PERSON_TO_INFINITIVE_MAP, clean)) {
    const mapped = SECOND_PERSON_TO_INFINITIVE_MAP[clean]!;
    if (clean.startsWith('aplic')) {
      return options?.isInitial ? 'emplear' : 'aplicar';
    }
    return mapped;
  }

  if (Object.prototype.hasOwnProperty.call(IRREGULAR_SECOND_PERSON_FUTURES, clean)) {
    return finalize(IRREGULAR_SECOND_PERSON_FUTURES[clean]!);
  }

  // Futuro regular con tilde: <infinitivo> + ás (ej. fundamentarás -> fundamentar, debatirás -> debatir, verás -> ver)
  const accentedFut = clean.match(/^([a-záéíóúñ]+(?:ar|er|ir))ás$/);
  if (accentedFut && isSpanishInfinitiveVerb(accentedFut[1]!)) {
    return finalize(accentedFut[1]!);
  }

  // Futuro regular sin tilde de >= 3 letras de raíz (excluyendo plurales nominales cortos)
  if (!NON_FUTURE_UNACCENTED_PLURALS.has(clean)) {
    const unaccentedFut = clean.match(/^([a-záéíóúñ]{3,}(?:ar|er|ir))as$/);
    if (unaccentedFut && isSpanishInfinitiveVerb(unaccentedFut[1]!)) {
      return finalize(unaccentedFut[1]!);
    }
  }

  // Presente regular 2ª persona con sufijo verbal académico inequívoco (-izas, -ificas, -cionas, -sionas)
  const unambiguousPresent = clean.match(/^([a-záéíóúñ]{2,}(?:iz|ific|cion|sion))as$/);
  if (unambiguousPresent) {
    const candidate = `${unambiguousPresent[1]}ar`;
    if (isSpanishInfinitiveVerb(candidate)) {
      return finalize(candidate);
    }
  }

  return null;
}

const CONJUGATED_SECOND_PERSON_START_RE =
  /^(?:valoras|comprendes|identificas|desarrollas|sintetizas|hallas|ensamblas|corriges|experimentas|investigas|estimas|pruebas|respondes|integras|reflexionas|participas|analizas|ejecutas|realizas|aplicas|dise[ñn]as|elaboras|redactas|construyes|dominas|consolidas|calculas|utilizas|organizas|diferencias|sistematizas|presentas|validas|interpretas|interpretes|socializas|instalas|exploras|refinas|configuras|defiendes|verificas|estructuras|demuestras|determinas|implementas|trazas|recuperas|perfeccionas|decodificas|modelas|digitalizas|justificas|indagas|planificas|deduces|seleccionas|mides|diagnosticas|sustentas|monitoreas|rehabilitas|proyectas|inicias|traduces|representas|cuantificas|estableces|contrastas|comparas|procesas|capturas|formulas|describes|produces|distingues|transcribes|reescribes|inauguras|resuelves|planteas|eval[uú]as|aprendes|[a-záéíóúñ]{3,}(?:ar[aá]s|er[aá]s|ir[aá]s))\b/i;

/**
 * Normaliza y valida un objetivo de aprendizaje para `08_Presentaciones`:
 * - Siempre inicia con verbo en infinitivo + objeto de aprendizaje concreto.
 * - Convierte formas conjugadas conocidas en 2ª persona con mapa explícito.
 * - Rechaza temas sueltos (1–4 palabras sin verbo), adverbios de modo iniciales,
 *   fragmentos colgados, textos genéricos, prefijo mecánico `"Aplicar "` o igualdad con el título.
 * - Si no es válido y `strict !== false`, lanza `SacrintContentError('SACRINT_OBJECTIVE_INVALID')`.
 */
export function normalizeLearningObjective(
  raw: string | null | undefined,
  context?: NormalizeObjectiveContext
): string {
  const fail = (reason: string): string => {
    if (context?.strict === false) return '';
    throw new SacrintContentError('SACRINT_OBJECTIVE_INVALID', reason, {
      ...context,
      field: context?.field ?? 'objectiveBullets',
      raw: raw ?? '',
    });
  };

  let text = cleanSacrintText(raw)
    .replace(/^(?:en\s+esta\s+sesi[oó]n\s+|hoy\s+)?(?:vas\s+a\s+|vamos\s+a\s+|el\s+estudiante\s+(?:va\s+a\s+|lograr[aá]\s+)?|lograr[aá]s\s+)/i, '')
    .replace(/\blos\s+habilidades\b/gi, 'las habilidades')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) return fail('Objetivo vacío');

  // Rechazar de inmediato adverbios de modo sueltos al inicio ("Correctamente las herramientas...")
  if (LEADING_MODE_ADVERB_RE.test(text)) {
    return fail(`Objetivo fragmentado que inicia con adverbio de modo: "${text}"`);
  }

  // Rechazar genéricos explícitos
  if (
    /^(?:concepto\s+clave\s+de\s+la\s+sesi[oó]n|concepto\s+central\s+de\s+la\s+clase|tema\s+de\s+la\s+sesi[oó]n|sesi[oó]n\s*\d+)$/i.test(text) ||
    /concepto\s+clave\s+de\s+la\s+sesi[oó]n/i.test(text)
  ) {
    return fail(`Objetivo genérico prohibido: "${text}"`);
  }

  // "Aprenderás a preparar ..." / "Aprendes a dar ..." -> "Preparar ..." / "Dar ..."
  const aprenderAMatch = text.match(/^(?:aprender[aá]s|aprendes|aprender)\s+a\s+([a-záéíóúñ]+(?:ar|er|ir))\b(.*)$/i);
  if (aprenderAMatch) {
    const inf = aprenderAMatch[1]!.toLowerCase();
    const rest = aprenderAMatch[2]!.replace(/\by\s+a\s+([a-záéíóúñ]{3,}(?:ar|er|ir))\b/gi, 'y $1');
    const mappedInf = inf === 'aplicar' ? 'emplear' : inf;
    text = `${mappedInf.charAt(0).toUpperCase() + mappedInf.slice(1)}${rest}`;
  }

  // Convertir verbo inicial conjugado en 2ª persona usando el mapa explícito
  const firstWordMatch = text.match(/^([A-Za-zÁÉÍÓÚÑáéíóúñ]+)\b([\s\S]*)$/);
  if (!firstWordMatch) return fail(`Objetivo sin palabra inicial válida: "${text}"`);
  const firstWord = firstWordMatch[1]!;
  const firstLower = firstWord.toLowerCase();
  const restAfterFirst = firstWordMatch[2]!;

  const resolvedInitialInf = resolveSecondPersonVerbToInfinitive(firstLower, { isInitial: true });
  if (resolvedInitialInf) {
    text = `${resolvedInitialInf.charAt(0).toUpperCase() + resolvedInitialInf.slice(1)}${restAfterFirst}`;
  } else if (firstLower === 'aplicar') {
    // Prohibir prefijo mecánico "Aplicar <tema corto / frase incoherente>"
    const wordLen = text.split(/\s+/).filter(Boolean).length;
    if (
      wordLen < 5 ||
      /^aplicar\s+(?:(?:entre|sobre|hacia|desde|contra|bajo|seg[uú]n)\b|pulsera\b|texto\b|[a-záéíóúñ]+\s+(?:es|son)\b|[a-záéíóúñ]+(?:as|es)\s+(?:y|el|la|los|las|un|una)\b)/i.test(
        text
      )
    ) {
      return fail(`Objetivo con prefijo mecánico "Aplicar": "${text}"`);
    }
    // Si es un objetivo genuino extenso que ya iniciaba con "Aplicar ...", normalizar a "Emplear ..." para respetar el candado objective_aplicar_prefix
    text = `Emplear${restAfterFirst}`;
  } else if (CONJUGATED_SECOND_PERSON_START_RE.test(text) || FUTURE_SECOND_PERSON_VERB_RE.test(firstWord)) {
    return fail(`Verbo conjugado no mapeado en inicio de objetivo: "${firstWord}" en "${text}"`);
  } else if (!isSpanishInfinitiveVerb(firstWord)) {
    return fail(`El objetivo debe iniciar con verbo en infinitivo, no con "${firstWord}": "${text}"`);
  }

  // Normalizar verbos coordinados en 2ª persona dentro de la misma oración ("Identificar y aplicas..." -> "Identificar y aplicar...")
  text = text.replace(
    /\b(y|e|,)\s+([a-záéíóúñ]{3,})\b/gi,
    (full, conj: string, verb: string) => {
      const mapped = resolveSecondPersonVerbToInfinitive(verb, { isInitial: false });
      return mapped ? `${conj} ${mapped}` : full;
    }
  );

  // Si aún persiste un verbo futuro en 2ª persona en la cola ("... y ajustarás las tolerancias"), convertirlo
  text = text.replace(
    /\b([a-záéíóúñ]{2,}(?:ar[aá]s|er[aá]s|ir[aá]s)|har[aá]s|dir[aá]s|pondr[aá]s|propondr[aá]s|expondr[aá]s|tendr[aá]s|obtendr[aá]s|mantendr[aá]s|sostendr[aá]s|vendr[aá]s|saldr[aá]s|sabr[aá]s|podr[aá]s|querr[aá]s)\b/gi,
    (full, verb: string) => {
      const mapped = resolveSecondPersonVerbToInfinitive(verb, { isInitial: false });
      return mapped || full;
    }
  );

  // Compactación segura por cláusulas subordinadas/gerundios cuando excede maxWords (NUNCA amputar ni quitar verbo)
  const maxWords = context?.maxWords ?? 16;
  const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

  const tryClauseTrim = (candidate: string, regex: RegExp): string => {
    const trimmed = candidate.replace(regex, '').replace(/[.,;:\s]+$/, '').trim();
    if (
      trimmed.length >= 24 &&
      wordCount(trimmed) >= 5 &&
      !hasDanglingEnding(trimmed)
    ) {
      return trimmed;
    }
    return candidate;
  };

  if (wordCount(text) > maxWords) {
    text = tryClauseTrim(
      text,
      /,\s*(?:garantizando|asegurando|permiti[eé]ndote|permitiendo|fortaleciendo|promoviendo|fomentando|validando|evaluando|identificando|aplicando|integrando|sistematizando|utilizando|empleando|registrando|documentando|consolidando|logrando|demostrando|comprendiendo|describiendo|rescatando|optimizando|ajustando|articulando|estableciendo|determinando|reconociendo|comparando|dise[ñn]ando|formulando|seleccionando|configurando|ejecutando|defendiendo|preparando|verificando|comprobando|organizando|construyendo|calculando|analizando|mostrando|detallando|resaltando|resolviendo)\b[\s\S]*$/i
    );
  }
  if (wordCount(text) > maxWords) {
    text = tryClauseTrim(
      text,
      /\s+(?:para\s+(?:garantizar|asegurar|fortalecer|promover|fomentar|validar|evaluar|consolidar|optimizar|mejorar|lograr|facilitar|fundamentar|sustentar|enriquecer|evitar|prevenir|establecer|determinar|mostrar|representar|diagnosticar|resolver|modelar|comunicar|invitar|atraer|responder|separar|estimar|identificar|analizar|construir|explicar|comparar|calcular|medir|comprobar|verificar|controlar|proteger|mantener|obtener|alcanzar)|(?:mediante|por\s+medio\s+de)\s+(?:el|la|los|las|un|una|instrumentos|una\s+reflexi[oó]n|t[eé]cnicas|protocolos|f[oó]rmulas)|(?:utilizando|empleando)\s+(?:el|la|los|las|un|una|herramientas|instrumentos|vocabulario|t[eé]cnicas|escuadras|tuber[ií]as|fuentes)|en\s+el\s+entorno\s+del\s+taller|en\s+tu\s+(?:entorno\s+escolar|bit[aá]cora|proyecto\s+integrador|gu[ií]a\s+tur[ií]stica)|ante\s+(?:la\s+comunidad|el\s+comit[eé]|el\s+grupo|los\s+actores|tus\s+compa[ñn]eros))\b[\s\S]*$/i
    );
  }
  if (wordCount(text) > maxWords + 2) {
    // Último recorte seguro: cortar en la última coma que deje una cláusula principal completa >= 5 palabras
    const commaParts = text.split(/,\s+/);
    if (commaParts.length >= 2) {
      const head = commaParts[0]!.replace(/[.,;:\s]+$/, '').trim();
      if (head.length >= 24 && wordCount(head) >= 5 && !hasDanglingEnding(head)) {
        text = head;
      }
    }
  }
  if (wordCount(text) > maxWords + 2) {
    // Cortar cláusula coordinada secundaria (" y ..." con segundo verbo) si el primer miembro ya es un objetivo completo
    const coordMatch = text.match(
      /^(.{26,}?)\s+(?:y|e)\s+(?:comprender|verificar|registrar|documentar|presentar|defender|validar|evaluar|aplicar|elaborar|construir|trazar|establecer|organizar|preparar|consolidar|interpretar|describir|responder|estructurar|proponer|garantizar|asegurar|demostrar|comunicar)\b/i
    );
    if (coordMatch && coordMatch[1] && wordCount(coordMatch[1]) >= 5 && !hasDanglingEnding(coordMatch[1])) {
      text = coordMatch[1].replace(/[.,;:\s]+$/, '').trim();
    }
  }

  text = text.replace(/[.,;:\s]+$/, '').trim();
  if (text && /^[a-záéíóúñ]/.test(text)) {
    text = text.charAt(0).toUpperCase() + text.slice(1);
  }

  // Validaciones finales duras
  const finalWords = text.split(/\s+/).filter(Boolean);
  const finalFirst = finalWords[0] ?? '';
  if (!isSpanishInfinitiveVerb(finalFirst)) {
    return fail(`Objetivo normalizado no inicia en infinitivo: "${text}"`);
  }
  if (finalWords.length < 4) {
    return fail(`Objetivo demasiado corto (solo tema o sin objeto concreto): "${text}"`);
  }
  if (LEADING_MODE_ADVERB_RE.test(text) || CONJUGATED_SECOND_PERSON_START_RE.test(text)) {
    return fail(`Objetivo inicia con adverbio de modo o verbo conjugado: "${text}"`);
  }
  if (FUTURE_SECOND_PERSON_VERB_RE.test(text)) {
    return fail(`Objetivo conserva verbo conjugado en futuro: "${text}"`);
  }
  if (/^Aplicar\s+/i.test(text)) {
    return fail(`Objetivo viola candado objective_aplicar_prefix: "${text}"`);
  }
  if (hasDanglingEnding(text)) {
    return fail(`Objetivo queda colgado o truncado: "${text}"`);
  }
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  if (context?.title && norm(text) === norm(context.title)) {
    return fail(`El objetivo no puede ser idéntico al título: "${text}"`);
  }

  return text;
}

const STRONG_TASK_VERB_RE =
  /\b(?:detalla|explica|calcula|resuelve|soluciona|elabora|dise[ñn]a|construye|arma|escribe|redacta|crea|halla|determina|encuentra|obt[eé]n|obten|compara|contrasta|clasifica|argumenta|justifica|sustenta|fundamenta|describe|identifica|reconoce|dibuja|traza|grafica|tabula|prop[oó]n|propon|propone|corrige|traduce|formula|convierte|estima|mide|instala|configura|conecta|clona|graba|efect[uú]a|ejecuta|realiza|monitorea|diagnostica|simula|completa|responde|contesta|eval[uú]a|valora|verifica|registra|documenta|anota|investiga|ordena|organiza|selecciona|elige|enumera|enlista|integra|presenta|defiende|exp[oó]n|expon|transforma|forma|plantea|despeja|simplifica|factoriza|demuestra|interpreta|relaciona|vincula|prepara|limpia|repara|actualiza|inspecciona|acota|empareja|conjuga|subraya|debate|concluye|ejemplifica|modifica|implementa|aplica|emplea|pregunta|observa|localiza|reemplaza|sustituye|a[ií]sla|fija|audita|incorpora|a[ñn]ade|consolida|proyecta|ilustra|lee|menciona|divide|multiplica|suma|resta|eleva|deriva|iguala|expresa|ubica|define|analiza|sintetiza|sistematiza|establece|desarrolla|codifica|depura|esquematiza|bosqueja|categoriza|jerarquiza|contextualiza|conceptualiza|problematiza|cuestiona|delibera|dialoga|reflexiona|indaga|explora|articula|optimiza|deduce|infiere|resume|estructura|programa|diagrama)\b/i;

const WEAK_TASK_VERB_RE = /\b(?:usa|utiliza|aseg[uú]rate|asegurate|comprueba|revisa|examina)\b/i;

// Producto/evidencia explícita requerida cuando solo hay verbo débil (excluye consejos de estilo como "usa oraciones claras")
const EXPLICIT_PRODUCT_RE =
  /\b(?:tabla|p[aá]rrafo|reporte|lista|bit[aá]cora|c[aá]lculo|resultado|mapa|diagrama|argumento|registro|ficha|croquis|gu[ií]a|esquema|matriz|protocolo|acta|di[aá]logo|cuestionario|boceto|audio|plano|gr[aá]fica|ecuaci[oó]n|derivada|margen\s+de\s+seguridad|tolerancia|rango\s+permitido|observaciones\s+t[eé]cnicas|resumen|eslogan|encabezado|comparativa|oraciones?\s+(?:completas?|afirmativas?|negativas?|de\s+bienvenida|en\s+ingl[eé]s|cortas?))\b/i;

const DESCRIPTIVE_THIRD_PERSON_CLAUSE_RE =
  /\b(?:un[ao]?\s+(?:compa[ñn]er[oa]|estudiante|investigador[a]?|operari[oa]|sistema|ecuaci[oó]n|modelo|equipo|grupo|t[eé]cnico|sensor|dispositivo|programa|medidor|term[oó]metro|man[oó]metro|instrumento|procesador|manual|software|usuario|turista|visitante|cliente|servidor|fuente|disco|ssd|hdd|bios|tarjeta|placa)|el\s+(?:compa[ñn]er[oa]|estudiante|investigador|operario|sistema|modelo|equipo|reporte|informe|gr[aá]fico|t[eé]cnico|dispositivo|medidor|term[oó]metro|man[oó]metro|instrumento|procesador|manual|software|usuario|turista|visitante|cliente|servidor|ventilador|banco|cable|pin|documento|texto|art[ií]culo|autor|reglamento)|la\s+(?:ecuaci[oó]n|funci[oó]n|tabla|gr[aá]fica|balanza|b[aá]scula|probeta|pantalla|norma|muestra|fuente|tarjeta|placa|biblioteca|iglesia|plaza|ley|regla|gu[ií]a)|tu\s+compa[ñn]er[oa]|[eé]l|ella)\b[^.?!]{0,80}\b(?:presenta|describe|establece|define|propone|analiza|desarrolla|estructura|sintetiza|resume|muestra|indica|modela|estima|calcula|determina|explica|expresa|representa|proyecta|utiliza|emplea|marca|anota|registra|a[ñn]ade|mide|observa|encuentra|obtiene|reporta|se[ñn]ala|sostiene|afirma|emite|alcanza|opera|posibilita|permite|ofrece|contiene|ocupa|tiene|supera|tarda|informa|exige)\b/gi;

function stripDescriptiveThirdPersonForTaskCheck(text: string): string {
  return text
    .replace(DESCRIPTIVE_THIRD_PERSON_CLAUSE_RE, '')
    .replace(/(?:\b(?:un[ao]?|el|la|este|esta|dicho|dicha|que)\s+[^.?!]{0,45})\bmide\s+\d/gi, '')
    .replace(
      /\b(?:se|que|donde|cuyo|cuya|cuando|si|mientras|luego,)\s+(?:modela|describe|presenta|establece|define|propone|analiza|desarrolla|estructura|sintetiza|resume|indica|muestra|representa|marca|a[ñn]ade|anota|registra|mide|observa|detalla|ofrece|se[ñn]ala|sostiene|afirma|calcula|determina|explica|opera|alcanza|supera|ocupa)\b/gi,
      ''
    )
    .replace(
      /\b(?:de|del|al|el|la|los|las|un|una|este|esta|ese|esa|tu|su|mi|dicho|dicha)\s+(?:muestra|prueba|marca|forma|lista|estructura|programa|diagrama|esquema)\b/gi,
      ''
    )
    // Quitar infinitivos subordinados tras "asegúrate de <infinitivo>" o "para <infinitivo>" para que no cuenten como imperativo fuerte
    .replace(/\b(?:aseg[uú]rate|asegurate)\s+de\s+[a-záéíóúñ]+r\b/gi, 'asegúrate')
    .replace(/\bpara\s+[a-záéíóúñ]+r\b/gi, '');
}

export function hasValidTaskInStatement(statement: string): { ok: boolean; reason?: string } {
  const clean = cleanSacrintText(statement);
  if (!clean || clean.length < 20) {
    return { ok: false, reason: 'Enunciado demasiado corto o vacío' };
  }
  if (hasDanglingEnding(clean)) {
    return { ok: false, reason: 'Enunciado con final colgado o truncado' };
  }
  if (/\?/.test(clean)) {
    return { ok: true };
  }

  // Filtrar consejos de estilo puros ("Usa la estructura...", "Usa oraciones claras...", "Asegúrate de incluir...", "Revisa el modelo... Él sostiene...")
  const stripped = stripDescriptiveThirdPersonForTaskCheck(clean);

  // Quitar frases de verbo débil + sin producto real antes de buscar verbo fuerte
  const withoutWeakStyleTail = stripped
    .replace(/\busa\s+oraciones\s+claras\b/gi, '')
    .replace(/\baseg[uú]rate\s+de\s+que\s+cada\s+oraci[oó]n\b[^.?!]*/gi, '');

  const hasStrongVerb =
    STRONG_TASK_VERB_RE.test(withoutWeakStyleTail) ||
    /(?:^|[.?!;:]\s+|\by\s+)(?:modela|muestra)\b/i.test(withoutWeakStyleTail);

  if (hasStrongVerb) {
    // Asegurar que no sea un solo verbo sin objeto (mínimo 4 palabras)
    if (clean.split(/\s+/).filter(Boolean).length >= 4) {
      return { ok: true };
    }
    return { ok: false, reason: 'Verbo de tarea sin objeto concreto' };
  }

  const hasWeakVerb = WEAK_TASK_VERB_RE.test(withoutWeakStyleTail);
  if (hasWeakVerb) {
    // Regla C: verbo débil requiere un producto/evidencia explícito y NO puede ser mera revisión pasiva
    // ("Revisa la sección de memoria de cálculo", "Revisa el registro escrito de otro equipo", "Revisa el modelo... Él sostiene...")
    const isPassiveReviewOnly =
      /^(?:revisa|examina)\s+(?:el\s+modelo|la\s+secci[oó]n|el\s+registro|un\s+equipo|un\s+caso)\b/i.test(clean) &&
      !/\b(?:tabla|p[aá]rrafo|reporte|lista|bit[aá]cora|mapa|diagrama|argumento|ficha|croquis|gu[ií]a|esquema|matriz|protocolo|acta|di[aá]logo|cuestionario|boceto|observaciones)\b/i.test(
        clean.replace(/^(?:revisa|examina)\s+el\s+registro\s+escrito/i, '')
      );
    if (!isPassiveReviewOnly && EXPLICIT_PRODUCT_RE.test(withoutWeakStyleTail)) {
      return { ok: true };
    }
    return { ok: false, reason: 'Verbo débil sin pregunta ni producto/evidencia explícito' };
  }

  return { ok: false, reason: 'Solo dato o enunciado declarativo sin pregunta ni consigna' };
}

/**
 * Valida una actividad práctica según la Regla C del Brief SACRINT.
 * Si el enunciado carece de tarea/pregunta pero `hint` contiene la única consigna,
 * devuelve `rescuedStatement` integrando la consigna y limpiando la pista (sin texto genérico).
 */
export function validatePracticeActivity(
  statement: string | null | undefined,
  hint?: string | null,
  context?: SacrintContentErrorContext & { strict?: boolean }
): PracticeActivityValidationResult {
  const cleanStmt = cleanSacrintText(statement);
  const cleanHint = cleanSacrintText(hint);

  const stmtCheck = hasValidTaskInStatement(cleanStmt);
  if (stmtCheck.ok) {
    return { valid: true };
  }

  // Si la pista contiene una tarea válida y el enunciado solo tiene datos, rescatar la tarea al enunciado
  if (cleanStmt && cleanHint && hasValidTaskInStatement(cleanHint).ok) {
    const merged = `${cleanStmt.replace(/[.!?]+$/, '')}. ${cleanHint.charAt(0).toUpperCase() + cleanHint.slice(1)}`;
    const ensured = /[.?!]$/.test(merged) ? merged : `${merged}.`;
    if (hasValidTaskInStatement(ensured).ok) {
      return {
        valid: true,
        rescuedStatement: ensured,
        updatedHint: '',
      };
    }
  }

  if (context?.strict) {
    throw new SacrintContentError(
      'SACRINT_ACTIVITY_INVALID',
      `${stmtCheck.reason ?? 'Actividad inválida'}: "${cleanStmt.slice(0, 100)}"`,
      { ...context, field: context.field ?? 'activities', raw: cleanStmt }
    );
  }
  return { valid: false, reason: stmtCheck.reason };
}

/**
 * Limpia subtítulos de portada o síntesis de misión que contengan listas "Sesión 1: ... · Sesión 2: ..."
 * o cortes de presupuesto como "... y activarás tus".
 */
export function cleanMissionTopicLine(
  rawTopic: string | null | undefined,
  fallbackTitle?: string | null,
  maxChars = 175,
  maxWords = 28
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
      const joined = parts.slice(0, 4).join(' · ');
      return fitPedagogicalText(joined, { maxChars, maxWords, role: 'concept', ensurePeriod: false }) || joined;
    }
  }

  return distillConciseText(clean, maxChars, maxWords) || clean;
}

/**
 * Sintetiza texto denso a un límite legible en proyector o tarjeta manteniendo oraciones completas
 * y sin cortes abruptos a mitad de frase o ecuación.
 */
export function distillConciseText(
  value: string | null | undefined,
  maxChars: number,
  maxWords?: number
): string {
  const clean = sanitizePedagogicalMetaPhrases(cleanSacrintText(value));
  if (!clean || isRubricOrBoilerplateLeak(clean)) return '';

  const fitted = fitPedagogicalText(clean, {
    maxChars,
    maxWords,
    role: 'general',
  });
  return fitted || clean;
}

/**
 * Selecciona oraciones completas de una fuente, sin cortar a media cláusula.
 * Si la primera oración excede el presupuesto, se devuelve completa: es preferible
 * un enunciado algo más largo a un fragmento sin sujeto/verbo/predicado.
 */
export function pickCompleteSentences(value: string | null | undefined, maxChars: number, maxSentences = 1): string {
  const clean = sanitizePedagogicalMetaPhrases(cleanSacrintText(value));
  if (!clean || isRubricOrBoilerplateLeak(clean)) return '';
  const sentences = splitSpanishSentences(clean).filter(
    (sentence) => sentence.trim().length >= 18 && !hasDanglingEnding(sentence)
  );
  if (sentences.length === 0) return '';
  let out = '';
  for (const sentence of sentences) {
    const next = out ? `${out} ${sentence}` : sentence;
    if (out && next.length > maxChars) break;
    if (!out && sentence.length > maxChars) return sentence.trim();
    out = next;
    if (out.split(/(?<=[.!?])\s+/).length >= maxSentences) break;
  }
  return out.trim();
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
