/**
 * pedagogical-text-fitter.ts — Ajuste y Compresión Semántica de Texto Didáctico (SSoT)
 * SIGPDA-EMS · Motor Editorial Compartido
 *
 * Prohibido usar `.slice(0, maxChars)` para texto visible.
 * Este módulo segmenta por oraciones y cláusulas en español, preserva datos numéricos,
 * ecuaciones, unidades, incógnitas y preguntas finales, condensa narrativa introductoria
 * cuando se rebasa el presupuesto y garantiza que ningún texto termine en preposición,
 * artículo, conjunción, verbo truncado u operador matemático.
 */

import { normalizeEditorialText } from './text-normalization';

export type PedagogicalTextRole =
  | 'activity'
  | 'step'
  | 'conclusion'
  | 'problem'
  | 'concept'
  | 'application'
  | 'hint'
  | 'general';

export interface FitPedagogicalTextOptions {
  maxChars?: number;
  maxWords?: number;
  role?: PedagogicalTextRole;
  ensurePeriod?: boolean;
}

/**
 * Palabras funcionales o verbos incompletos que NUNCA pueden quedar al final de un texto visible.
 */
const DANGLING_WORDS_SET = new Set([
  // Preposiciones
  'a', 'ante', 'bajo', 'con', 'contra', 'de', 'del', 'desde', 'durante', 'en',
  'entre', 'hacia', 'hasta', 'mediante', 'para', 'por', 'segun', 'según', 'sin',
  'sobre', 'tras',
  // Artículos, determinantes, posesivos y demostrativos
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'al', 'lo',
  'su', 'sus', 'tu', 'tus', 'mi', 'mis', 'nuestro', 'nuestra', 'nuestros', 'nuestras',
  'este', 'esta', 'estos', 'estas', 'ese', 'esa', 'esos', 'esas', 'aquel', 'aquella',
  'cada', 'todo', 'toda', 'todos', 'todas', 'otro', 'otra', 'otros', 'otras',
  'mismo', 'misma', 'ambos', 'ambas', 'cual', 'cuales', 'cuyo', 'cuya',
  'cuanto', 'cuánto', 'cuanta', 'cuánta', 'cuantos', 'cuántos', 'cuantas', 'cuántas',
  // Conjunciones, relativos y conectores colgados
  'y', 'e', 'o', 'u', 'ni', 'pero', 'sino', 'aunque', 'porque', 'pues',
  'como', 'cuando', 'donde', 'dónde', 'que', 'qué', 'si', 'mas', 'más', 'menos',
  'muy', 'tan', 'tanto', 'asi', 'así', 'ademas', 'además', 'tambien', 'también',
  'mientras', 'quien', 'quienes',
  // Verbos copulativos, auxiliares, transitivos o gerundios que exigen complemento
  'es', 'son', 'fue', 'fueron', 'sera', 'será', 'seran', 'serán', 'sea', 'sean',
  'esta', 'está', 'estan', 'están', 'tiene', 'tienen', 'hay', 'debe', 'deben',
  'puede', 'pueden', 'permite', 'permiten', 'requiere', 'requieren', 'representa',
  'representan', 'denota', 'modela', 'modelan', 'determina', 'calcula', 'calcular',
  'encontrar', 'obtener', 'verificar', 'verifica', 'comprueba', 'plantea', 'resuelve',
  'utilizando', 'aplicando', 'apoyandote', 'apoyándote', 'considerando', 'sabiendo',
  'dado', 'dada', 'dados', 'dadas', 'igualando', 'sumando', 'restando',
  'multiplicando', 'dividiendo', 'despejando', 'sustituyendo', 'asciende', 'equivale',
  'supera', 'excede', 'cobra', 'cuesta', 'midiendo', 'construye', 'describe',
  'revisar', 'preparar', 'contrastar', 'delimitar', 'recuperar',
  // Sustantivos relacionales o verbos futuros transitivos colgados observados en truncamientos
  'base', 'tipos', 'dos', 'aplicaras', 'aplicarás', 'analitica', 'analítica',
  'activaras', 'activarás', 'delimitaras', 'delimitarás', 'presentaras', 'presentarás',
  'identificaras', 'identificarás', 'analizaras', 'analizarás', 'resolveras', 'resolverás',
  'evaluaras', 'evaluarás', 'socializaras', 'socializarás', 'validaras', 'validarás',
]);

const TRAILING_OPERATOR_RE = /[=+\-*/×÷^<>(\[{,;:]\s*\.?\s*$/;

/**
 * Detecta si un texto termina truncado a mitad de oración, en palabra colgada o en operador matemático.
 */
export function hasDanglingEnding(raw: string): boolean {
  const clean = (raw || '').replace(/\s+/g, ' ').trim();
  if (!clean) return false;

  if (TRAILING_OPERATOR_RE.test(clean)) return true;

  // Paréntesis abiertos sin cerrar
  const openParens = (clean.match(/\(/g) || []).length;
  const closeParens = (clean.match(/\)/g) || []).length;
  if (openParens > closeParens) return true;

  // Detectar cola tipo "). El." o ". Si al." (oración final de 1–2 palabras funcionales tras punto)
  const stubAfterDot = clean.match(/\.\s+([A-ZÁÉÍÓÚÑa-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑa-záéíóúñ]+)?)\.?$/);
  if (stubAfterDot) {
    const stubWords = stubAfterDot[1].toLowerCase().split(/\s+/);
    if (stubWords.every((w) => DANGLING_WORDS_SET.has(w))) {
      return true;
    }
  }

  // Última palabra antes de puntuación final opcional
  const withoutTrailingDot = clean.replace(/[.…]+$/, '').trim();
  if (TRAILING_OPERATOR_RE.test(withoutTrailingDot)) return true;

  const lastTokenMatch = withoutTrailingDot.match(/([A-ZÁÉÍÓÚÑa-záéíóúñ0-9_²³°%)]+)$/);
  if (!lastTokenMatch) return false;
  const lastWord = lastTokenMatch[1].toLowerCase();

  // Si la última palabra es una letra aislada ('x', 'y', 'a', 'b'), es válida solo si va precedida de variable/ecuación ("variable y", "valor de x", "para x")
  if (/^[xyzabcmn]$/.test(lastWord)) {
    if (/\b(?:variable|inc[oó]gnita|valor(?:\s+de)?|despejar|eliminar|para|eje|cateto|lado|ángulo|angulo)\s+[xyzabcmn]$/i.test(withoutTrailingDot)) {
      return false;
    }
  }

  if (DANGLING_WORDS_SET.has(lastWord)) {
    // Excepción legítima: "entre dos" o "en dos" cuando va precedido de "dividiendo entre dos"
    if (lastWord === 'dos' && /\b(?:entre|en|por|los|las)\s+dos$/i.test(withoutTrailingDot)) {
      return false;
    }
    // Excepción legítima: "la base" cuando forma parte de "área de la base" o "escuadras de la base"
    if (lastWord === 'base' && /\b(?:de\s+la|en\s+la|su)\s+base$/i.test(withoutTrailingDot)) {
      return false;
    }
    return true;
  }

  // Token truncado (1-2 letras) tras preposición o artículo que no es palabra corta válida en español
  // (ej. "... derivadas de fa" procedente de cortes rígidos como slice(0, 200))
  const prepStubMatch = withoutTrailingDot.match(
    /\b(?:de|del|en|con|por|para|sobre|entre|hacia|desde|ante|a|al|y|o|e|el|la|los|las|un|una|unos|unas)\s+([a-záéíóúñ]{1,2})$/i
  );
  if (prepStubMatch) {
    const stub = prepStubMatch[1].toLowerCase();
    const VALID_SHORT_SPANISH_WORDS = new Set([
      'el', 'la', 'un', 'mi', 'tu', 'su', 'lo', 'él', 'sí', 'no', 'fe', 'yo',
      'me', 'te', 'se', 'le', 'os', 'ir', 'va', 've', 'vi', 'da', 'di', 'ha',
      'he', 'sé', 'té', 'ti', 'mí', 'al', 'de', 'en', 'ya', 'es', 'ni', 'o',
      'y', 'a', 'e', 'x', 'z', 'm', 'b', 'c', 'n', 'r', 't',
    ]);
    if (!VALID_SHORT_SPANISH_WORDS.has(stub)) {
      return true;
    }
  }

  return false;
}

/**
 * Segmenta un párrafo en oraciones completas en español sin romper decimales (3.14, 1.5)
 * ni abreviaturas comunes (ej., aprox., fig., pág.).
 */
export function splitSpanishSentences(text: string): string[] {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];

  const protectedText = clean
    .replace(/\b(ej|aprox|fig|pág|pag|núm|num|dr|dra|sr|sra|vs|etc)\./gi, '$1\uE001')
    .replace(/(\d)\.(\d)/g, '$1\uE002$2');

  const rawSentences = protectedText
    .split(/(?<=[.?!])\s+(?=[A-ZÁÉÍÓÚÑ¿¡0-9(\-–—•])/)
    .map((s) =>
      s
        .replace(/\uE001/g, '.')
        .replace(/\uE002/g, '.')
        .trim()
    )
    .filter(Boolean);

  return rawSentences.length > 0 ? rawSentences : [clean];
}

/**
 * Repara un texto que ya venía con una cola truncada (ej. "...donde.", "...). El.", "...x +"),
 * recortando únicamente la cláusula colgada final hasta el último cierre sintáctico completo.
 */
export function repairDanglingEnding(raw: string, ensurePeriod = true): string {
  let text = normalizeEditorialText(raw).replace(/\s+/g, ' ').trim();
  if (!text) return '';

  // 1. Si termina en ". El." / ". Si al." / "). El." -> quitar la oración/fragmento colgado tras el último punto válido
  const sentences = splitSpanishSentences(text);
  if (sentences.length > 1 && hasDanglingEnding(sentences[sentences.length - 1])) {
    const validSentences = [...sentences];
    while (validSentences.length > 1 && hasDanglingEnding(validSentences[validSentences.length - 1])) {
      validSentences.pop();
    }
    const rejoined = validSentences.join(' ').trim();
    if (rejoined.length >= 20 && !hasDanglingEnding(rejoined)) {
      return ensureTerminalPunctuation(rejoined, ensurePeriod);
    }
  }

  // 2. Si hay paréntesis sin cerrar al final (ej. "(r =." o "(3 por"), quitar desde el "(" abierto
  const lastOpenParen = text.lastIndexOf('(');
  const lastCloseParen = text.lastIndexOf(')');
  if (lastOpenParen > lastCloseParen && lastOpenParen >= 15) {
    text = text.slice(0, lastOpenParen).replace(/[,;:\s]+$/, '').trim();
  }

  // 3. Si termina en cláusula subordinada o conector colgado tras coma/punto y coma/dos puntos
  let safetyCounter = 0;
  while (hasDanglingEnding(text) && safetyCounter < 12) {
    safetyCounter++;
    const withoutDot = text.replace(/[.…]+$/, '').trim();

    // Buscar el último separador de cláusula (, ; :) después del caracter 25
    const clauseMatch = withoutDot.match(/^(.{25,})[,;:]\s+[^,;:]{1,45}$/);
    if (clauseMatch && !hasDanglingEnding(clauseMatch[1])) {
      text = clauseMatch[1].trim();
      break;
    }

    // Quitar el último token colgado o operador final
    const stripped = withoutDot
      .replace(/[=+\-*/×÷^<>(\[{,;:]+\s*$/, '')
      .replace(/\s+\S+$/, '')
      .replace(/[,;:\s]+$/, '')
      .trim();

    if (!stripped || stripped === withoutDot || stripped.length < 15) {
      break;
    }
    text = stripped;
  }

  return ensureTerminalPunctuation(text, ensurePeriod);
}

function ensureTerminalPunctuation(text: string, ensurePeriod: boolean): string {
  const clean = text.replace(/[,;:\s]+$/, '').trim();
  if (!clean) return '';
  if (!ensurePeriod) return clean;
  if (/[.?!)]$/.test(clean)) return clean;
  return `${clean}.`;
}

/**
 * Condensa cláusulas introductorias y relleno narrativo preservando SIEMPRE:
 * números, ecuaciones, variables, unidades y la pregunta/instrucción central.
 */
export function compressPedagogicalText(raw: string, role: PedagogicalTextRole = 'general'): string {
  let text = normalizeEditorialText(raw).replace(/\s+/g, ' ').trim();
  if (!text) return '';

  // Quitar prefijos redundantes de numeración de ejercicio
  text = text.replace(/^(?:Ejercicio|Actividad|Problema|Caso|Paso)\s*\d+\s*[:.)\-–—]\s*/i, '');

  if (role === 'step' || role === 'conclusion') {
    const promoted = text.match(
      /^(?:Identifica|Construye|Comprueba|Verifica|Calcula|Interpreta|Analiza|Determina)[^.]{12,145}\.\s*[-–—]\s*(.+)$/i
    );
    if (promoted && promoted[1]) {
      text = promoted[1]
        .replace(/^(?:Significado|Resultado|Conclusi[oó]n)\s*:\s*/i, '')
        .trim();
    }
    if (role === 'conclusion') {
      text = text
        .replace(/^(?:Significado|Resultado|Interpretaci[oó]n|Conclusi[oó]n)\s*:\s*/i, '')
        .trim();
    }
  }

  if (role === 'step') {
    text = text
      .replace(
        /Aplicamos la operaci[oó]n inversa de la multiplicaci[oó]n\s*\(divisi[oó]n\)\s*en ambos miembros entre el coeficiente de la variable\s*:\s*/gi,
        'Dividimos ambos miembros entre el coeficiente: '
      )
      .replace(
        /Restamos\s+(\d+(?:\.\d+)?)\s+en ambos miembros de la ecuaci[oó]n para mantener el equilibrio de la balanza algebraica\s*:\s*/gi,
        'Restamos $1 en ambos miembros: '
      )
      .replace(
        /Sumamos\s+(\d+(?:\.\d+)?)\s+en ambos miembros de la ecuaci[oó]n para mantener el equilibrio(?: de la balanza algebraica)?\s*:\s*/gi,
        'Sumamos $1 en ambos miembros: '
      )
      .replace(
        /Transpone algebraicamente el t[eé]rmino independiente\s+([^\s]+)\s+del miembro derecho al miembro izquierdo aplicando la operaci[oó]n inversa\s*/gi,
        'Transponemos $1 al miembro izquierdo '
      )
      .replace(
        /Compara t[eé]rmino a t[eé]rmino la ecuaci[oó]n obtenida con la estructura de la forma general\s*/gi,
        'Comparamos con la forma general '
      )
      .replace(
        /Identifica los valores de los coeficientes comparando la ecuaci[oó]n obtenida con la forma general\s*/gi,
        'Identificamos coeficientes en '
      )
      .replace(
        /Realiza primero el c[aá]lculo del discriminante dentro de tu Calculadora Cient[ií]fica\s*:\s*/gi,
        'Calculamos el discriminante: '
      )
      .replace(
        /Analizar la segunda condici[oó]n del problema matem[aá]tico relacionada directamente con los\s*/gi,
        'Analizamos la condición de '
      )
      .replace(
        /^Utiliza la f[oó]rmula cl[aá]sica para el c[aá]lculo de la superficie de un tri[aá]ngulo[^:=]{10,95}\blo\s+que\s+arroja\s+/i,
        'Fórmula del triángulo: '
      )
      .replace(
        /^Sustituimos los par[aá]metros conocidos en la f[oó]rmula general del modelo[^:]{6,60}:\s*/i,
        'Sustituimos parámetros: '
      );
  }

  // Condensar introducciones circunstanciales largas sin datos numéricos al inicio de oración
  text = text
    .replace(
      /^(?:Para|En|Durante)\s+(?:la\s+organizaci[oó]n|el\s+dise[ñn]o|la\s+instalaci[oó]n|la\s+socializaci[oó]n|la\s+sesi[oó]n|la\s+revisi[oó]n|la\s+defensa|asegurar|fomentar|mitigar)\s+[^,.0-9=]{12,95},\s*/i,
      ''
    )
    .replace(
      /^(?:En\s+(?:un\s+centro\s+comunitario|una\s+comunidad(?:\s+semiurbana)?|una\s+localidad(?:\s+rural)?|otra\s+demarcaci[oó]n)|Un\s+grupo\s+(?:juvenil(?:\s+comunitario)?|de\s+j[oó]venes(?:\s+emprendedores)?))\s+(?:de|en|del\s+municipio\s+de)\s+Puebla(?:\s+con\s+alta\s+vulnerabilidad\s+econ[oó]mica)?\s*,?\s*/i,
      ''
    )
    .replace(
      /^Para\s+(?:dise[ñn]ar|evaluar|planear|organizar)\s+[^,.0-9=]{10,95},\s*un\s+grupo\s+de\s+estudiantes(?:\s+de\s+bachillerato)?\s+(?:determina|calcula|observa|analiza)\s+que\s+/i,
      ''
    )
    .replace(/\s+est[aá]\s+representad[oa]\s+por\s+la\s+expresi[oó]n\s+algebraica\s+/gi, ' equivale a ')
    .replace(/\bel\s+valor\s+exacto\s+de\s+la\s+variable\s+([a-z])\b/gi, '$1')
    .replace(/\bla\s+medida\s+num[eé]rica\s+de\s+cada\s+/gi, 'cada ')
    .replace(/\bda\s+como\s+resultado\s+exacto\s+/gi, 'suma ')
    .replace(/\s+bas[aá]ndote\s+en\s+la\s+propiedad\s+geom[eé]trica\s+de\s+/gi, ' según ')
    .replace(
      /\s+para\s+(?:financiar|fomentar|mitigar|promover|prevenir)\s+[^,.0-9=?]{12,75}(?=[,.])/gi,
      ''
    )
    .replace(
      /\s+apoy[aá]ndote\s+en\s+tu\s+Calculadora\s+Cient[ií]fica(?=[,.]|$)/gi,
      ''
    );

  // Capitalizar primera letra si quedó en minúscula tras recortar cláusula inicial
  if (/^[a-záéíóúñ]/.test(text)) {
    text = text.charAt(0).toUpperCase() + text.slice(1);
  }

  return text.replace(/\s+/g, ' ').trim();
}

function sentencePriorityScore(sentence: string, index: number, total: number, role: PedagogicalTextRole): number {
  let score = 0;
  const hasNumbers = /\d/.test(sentence);
  const hasEquation = /[=<>]|f\(x\)|\b[xyzabcmn]\s*[+\-*/=]/i.test(sentence);
  const hasQuestion = /[?¿]/.test(sentence);
  const hasTaskVerb =
    /\b(?:calcula|determina|encuentra|plantea|resuelve|halla|comprueba|verifica|modela|identifica|explica|analiza|construye|grafica|tabula|contrasta|redacta|elabora|integra|autoeval[uú]a|organiza|revisa)\b/i.test(
      sentence
    );

  if (hasEquation) score += 5;
  if (hasNumbers) score += 4;
  if (hasQuestion) score += 5;
  if (hasTaskVerb) score += 3;
  if (role === 'conclusion' && index === total - 1) score += 4;
  if (role === 'step' && (hasEquation || hasNumbers)) score += 4;

  // Oración 0 puramente narrativa sin números ni ecuaciones ni pregunta tiene prioridad baja
  if (index === 0 && total > 1 && !hasNumbers && !hasEquation && !hasQuestion) {
    score -= 5;
  }
  return score;
}

function shouldProtectMathSuffix(
  prefix: string,
  suffix: string,
  role: PedagogicalTextRole
): boolean {
  if (role === 'hint' && prefix.split(/\s+/).length >= 5 && !/[?]/.test(suffix)) {
    return false;
  }
  if (!/[=\d?]/.test(prefix) && /[=?]/.test(suffix)) return true;
  if (role === 'problem' || role === 'activity') {
    return /[?=$]|\d/.test(suffix);
  }
  if (role === 'step') {
    const isShortFinalResult = suffix.length <= 26 && /=/.test(suffix) && !/=.*=/.test(suffix);
    if (isShortFinalResult) return true;
    if (!/=/.test(prefix) && /=/.test(suffix)) return true;
    return !/[=\d$]/.test(prefix) && /[=\d$]/.test(suffix);
  }
  return false;
}

function breaksNumericOrTupleList(prefix: string, suffix: string): boolean {
  return (
    /(?:\d|\))\s*$/.test(prefix) &&
    /^,\s*(?:\d+|\([^)]*\)|[xyzabcmn]\b)/i.test(suffix)
  );
}

/**
 * Ajusta semánticamente un texto pedagógico a su presupuesto sin usar cortes ciegos `.slice(0, maxChars)`.
 */
export function fitPedagogicalText(
  raw: string | null | undefined,
  options: FitPedagogicalTextOptions = {}
): string {
  const role = options.role ?? 'general';
  const maxChars = options.maxChars ?? 220;
  const maxWords = options.maxWords;
  const ensurePeriod = options.ensurePeriod ?? true;

  const normalized = normalizeEditorialText(raw).replace(/\s+/g, ' ').trim();
  if (!normalized) return '';

  // Si ya cabe y no tiene final colgado, devolver limpio
  if (
    normalized.length <= maxChars &&
    (!maxWords || normalized.split(/\s+/).length <= maxWords) &&
    !hasDanglingEnding(normalized)
  ) {
    return ensureTerminalPunctuation(normalized, ensurePeriod);
  }

  // Paso 1: Compresión semántica de cláusulas de relleno
  let compressed = compressPedagogicalText(normalized, role);

  const exceedsBudget = () =>
    compressed.length > maxChars ||
    (maxWords !== undefined && compressed.split(/\s+/).length > maxWords);

  // Simplificar paréntesis explicativos largos cuando el texto excede el presupuesto
  if (exceedsBudget()) {
    compressed = compressed
      .replace(
        /\s*\((?:lo que|es decir|en este caso|donde|o sea|tambi[eé]n|aprox(?:imadamente)?|precio de|n[uú]mero de|tasa )[^()]{6,}\)/gi,
        ''
      )
      .replace(/\s*\((?=(?:[^()]*\b[a-záéíóúñ]{4,}\b){2,})[^()]{24,}\)/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // En pasos tabulares largos tipo "- Para m = 0: ... - Para m = 1: ...", conservar solo el planteamiento sin repetir filas
  if (role === 'step' && exceedsBudget()) {
    const repeatedEvalMatch = compressed.match(
      /^(.{20,}?)\s*:\s*-\s*Para\s+[^:]{1,20}:\s*[^-]{6,}(?:\s+-\s*Para\s+[^:]{1,20}:){1,}/i
    );
    if (repeatedEvalMatch) {
      compressed = repeatedEvalMatch[1]
        .replace(/\s+sustituyendo\s+en\s+la\s+ecuaci[oó]n$/i, '')
        .trim();
    }
  }

  // Paso 2: Selección de oraciones por relevancia pedagógica (descartar primero la introducción sin datos)
  const sentences = splitSpanishSentences(compressed);
  if (sentences.length > 1 && compressed.length > maxChars) {
    // Si la primera oración no tiene números ni ecuaciones y las demás sí, omitir la primera oración
    const firstHasData = /\d|[=<>]/.test(sentences[0]);
    const restText = sentences.slice(1).join(' ').trim();
    if (!firstHasData && restText.length >= 25) {
      compressed = compressPedagogicalText(restText, role);
    }
  }

  // Si aún supera el presupuesto y hay múltiples oraciones, conservar las oraciones con datos, ecuaciones y pregunta en orden
  const currentSentences = splitSpanishSentences(compressed);
  if (currentSentences.length > 1 && compressed.length > maxChars) {
    const scored = currentSentences.map((s, idx) => ({
      s,
      idx,
      score: sentencePriorityScore(s, idx, currentSentences.length, role),
    }));

    // Conservar todas las oraciones de alta prioridad (con datos/ecuación/pregunta)
    const essential = scored.filter((item) => item.score > 0).map((item) => item.s);
    if (essential.length > 0 && essential.length < currentSentences.length) {
      const candidate = essential.join(' ').trim();
      if (candidate.length >= 25 && !hasDanglingEnding(candidate)) {
        compressed = candidate;
      }
    }
  }

  // Si para cualquier rol hay varias oraciones que exceden maxChars o maxWords, conservar las primeras oraciones completas dentro del presupuesto
  const finalSentences = splitSpanishSentences(compressed);
  if (
    finalSentences.length > 1 &&
    (compressed.length > maxChars || (maxWords !== undefined && compressed.split(/\s+/).length > maxWords))
  ) {
    let acc = '';
    for (const sent of finalSentences) {
      const next = acc ? `${acc} ${sent}` : sent;
      const fitsChars = next.length <= maxChars + 12;
      const fitsWords = !maxWords || next.split(/\s+/).length <= maxWords;
      if ((fitsChars && fitsWords) || !acc) {
        acc = next;
      } else {
        break;
      }
    }
    if (acc && acc.length >= 20 && !hasDanglingEnding(acc)) {
      compressed = acc;
    }
  }

  // Paso 3: Si aún excede el presupuesto y tiene punto y coma con cláusula autónoma (sin partir pares de ecuaciones)
  const exceedsForSemicolon =
    compressed.length > maxChars + 15 ||
    (maxWords !== undefined && compressed.split(/\s+/).length > Math.ceil(maxWords * 1.15));
  if (exceedsForSemicolon && compressed.includes(';')) {
    const semiParts = compressed.split(/;\s+/);
    const firstSemi = semiParts[0]?.trim() || '';
    const secondSemi = semiParts[1]?.trim() || '';
    const secondIsFormulaOrValue = /^(?:[a-zA-Z0-9_]+\s*=|\(?[+-]?\d|[xy]\s*[=+-])/.test(secondSemi);
    if (
      semiParts.length > 1 &&
      !secondIsFormulaOrValue &&
      firstSemi.length >= 25 &&
      !hasDanglingEnding(firstSemi)
    ) {
      compressed = firstSemi;
    }
  }

  // Paso 4: Límite estricto de palabras (primero por oración completa, luego por frontera de cláusula subordinada segura)
  if (maxWords && compressed.split(/\s+/).length > maxWords) {
    const sents = splitSpanishSentences(compressed);
    let acc = '';
    for (const sent of sents) {
      const next = acc ? `${acc} ${sent}` : sent;
      if (next.split(/\s+/).length <= maxWords || !acc) {
        acc = next;
      } else {
        break;
      }
    }
    if (acc && !hasDanglingEnding(acc)) {
      compressed = acc;
    }

    // Si una única oración sigue excediendo maxWords o maxChars, recortar en cláusula subordinada/guion segura
    if (compressed.split(/\s+/).length > maxWords || compressed.length > maxChars) {
      const clauseBoundaryRe =
        /(?:\.\s+[-–—]\s+|\s+[-–—]\s+(?:Resultado|Verificaci[oó]n|Interpretaci[oó]n|Significado|Comprobaci[oó]n|Sustituci[oó]n|Ecuaci[oó]n|Variable)\b|;\s+(?![a-zA-Z0-9\s.+\-*/()]*=)|,\s+(?:por ejemplo|es decir|lo que|lo cual|donde|cuando|integrando|activando|aplicando|asegurando|garantizando|evitando|verificando|considerando|calculando|utilizando|determinando|mediante|a\s+trav[eé]s\s+de|con\s+el\s+(?:fin|prop[oó]sito|objetivo)\s+de|para\s+(?:obtener|determinar|identificar|analizar|validar|comprobar|verificar|modelar|garantizar))\b|\s+(?:considerando|manteniendo|definiendo|evaluando|asegurando|garantizando|evitando|verificando|tomando\s+en\s+cuenta|sin\s+exceder|a\s+lo\s+largo|dentro\s+de(?:l)?|en\s+contextos?|paso\s+a\s+paso|para\s+(?:obtener|determinar|identificar|analizar|validar|comprobar|verificar|modelar|garantizar)|con\s+el\s+(?:fin|prop[oó]sito|objetivo)\s+de|vinculad[oa]s?\s+(?:al|a\s+la)|mediante\s+(?:el|la)\s+(?:uso|aplicaci[oó]n|construcci[oó]n|an[aá]lisis|elaboraci[oó]n)|teniendo\s+en\s+cuenta)\b|:\s+(?=[^0-9=+\-*/()]{8,}))/i;
      let candidate = compressed;
      for (let pass = 0; pass < 4; pass++) {
        if (candidate.split(/\s+/).length <= maxWords && candidate.length <= maxChars) break;
        const m = clauseBoundaryRe.exec(candidate);
        if (!m || m.index < 18) break;
        const left = candidate.slice(0, m.index).replace(/[.,;:\s]+$/, '').trim();
        const right = candidate.slice(m.index).trim();
        const openParens = (left.match(/\(/g) || []).length;
        const closeParens = (left.match(/\)/g) || []).length;
        const dropsEssentialMath = shouldProtectMathSuffix(left, right, role);
        if (
          openParens === closeParens &&
          !dropsEssentialMath &&
          !breaksNumericOrTupleList(left, right) &&
          left.split(/\s+/).length >= 4 &&
          !hasDanglingEnding(left) &&
          left.split(/\s+/).length < candidate.split(/\s+/).length
        ) {
          candidate = left;
        } else {
          break;
        }
      }
      if (candidate !== compressed && candidate.split(/\s+/).length >= 4) {
        compressed = candidate;
      }

      // Respaldo por comas, conectores y fronteras sintácticas seguras de derecha a izquierda si aún excede maxWords
      if (compressed.split(/\s+/).length > maxWords) {
        const tryRightToLeftTrim = (sepRe: RegExp, wordLimit: number): string | null => {
          const matches = [...compressed.matchAll(sepRe)];
          for (let i = matches.length - 1; i >= 0; i--) {
            const idx = matches[i].index ?? 0;
            if (idx < 18) continue;
            const prefix = compressed.slice(0, idx).replace(/[.,;:\s]+$/, '').trim();
            const suffix = compressed.slice(idx).trim();
            const openParens = (prefix.match(/\(/g) || []).length;
            const closeParens = (prefix.match(/\)/g) || []).length;
            const dropsMath = shouldProtectMathSuffix(prefix, suffix, role);
            if (
              openParens === closeParens &&
              !dropsMath &&
              !breaksNumericOrTupleList(prefix, suffix) &&
              prefix.split(/\s+/).length <= wordLimit &&
              prefix.split(/\s+/).length >= 4
            ) {
              const cleaned = repairDanglingEnding(prefix, ensurePeriod);
              if (
                cleaned &&
                !hasDanglingEnding(cleaned) &&
                cleaned.split(/\s+/).length <= wordLimit &&
                cleaned.split(/\s+/).length >= 4
              ) {
                return cleaned;
              }
            }
          }
          return null;
        };

        const tier1SepRe =
          role === 'step'
            ? /[,;:]\s+|\s+(?:para|mediante|donde)\s+|\s+(?=De\s+la\s+Ecuaci[oó]n\s+\d|=>)/gi
            : /[,;:]\s+|\s+(?:para|mediante|donde)\s+/gi;
        const tier2SepRe =
          role === 'problem' || role === 'activity'
            ? /\s+(?:que\s+[a-záéíóúñ]{3,}|con\s+(?:el|la|los|las|un|una|su|sus|respaldo|[aá]ngulos|base)|sobre\s+(?:el|la|los|las)|desde\s+(?:el|la)|hacia\s+(?:cada|el|la)|entre\s+(?:el|la|los|las|sus)|sin\s+[a-záéíóúñ]{3,}|en\s+(?:el\s+plano|papel|tu|la\s+toma)|y\s+(?:que|el|la|los|las|su|sus|para))\s+/gi
            : /\s+(?:que\s+[a-záéíóúñ]{3,}|con\s+(?:el|la|los|las|un|una|su|sus|respaldo|[aá]ngulos|base)|sobre\s+(?:el|la|los|las)|desde\s+(?:el|la)|hacia\s+(?:cada|el|la)|entre\s+(?:el|la|los|las|sus)|sin\s+[a-záéíóúñ]{3,}|en\s+(?:el\s+plano|papel|pliego|tu|la\s+toma)|(?:usando|utilizando|empleando|aplicando|analizando|verificando|comprobando|considerando|evaluando|calculando|identificando|recordando|donde|mientras)|y\s+(?:que|el|la|los|las|su|sus|para|trazar|validar|verificar|elaborar|defender|representa|modela|justifica))\s+/gi;

        const wordTotal = compressed.split(/\s+/).length;
        const allowWideTrim = role !== 'problem' && role !== 'activity' && role !== 'step';
        const extraWideLimit = wordTotal > maxWords * 2 ? Math.min(maxWords + 8, Math.floor(wordTotal * 0.65)) : maxWords + 4;
        const trimmed =
          tryRightToLeftTrim(tier1SepRe, maxWords) ??
          tryRightToLeftTrim(tier1SepRe, maxWords + 2) ??
          tryRightToLeftTrim(tier2SepRe, maxWords) ??
          tryRightToLeftTrim(tier2SepRe, maxWords + 2) ??
          (allowWideTrim
            ? tryRightToLeftTrim(tier1SepRe, maxWords + 4) ??
              tryRightToLeftTrim(tier2SepRe, maxWords + 4) ??
              tryRightToLeftTrim(tier1SepRe, extraWideLimit) ??
              tryRightToLeftTrim(tier2SepRe, extraWideLimit)
            : role === 'step' && wordTotal > maxWords * 2
              ? tryRightToLeftTrim(tier1SepRe, maxWords + 6) ?? tryRightToLeftTrim(tier2SepRe, maxWords + 6)
              : null);
        if (trimmed) {
          compressed = trimmed;
        }
      }
    }
  }

  // Paso 5: Garantizar que jamás quede un final colgado o incompleto
  return repairDanglingEnding(compressed, ensurePeriod);
}
