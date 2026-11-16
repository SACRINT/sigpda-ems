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
  'recopilar', 'consolidar', 'integrar', 'validar', 'optimizar', 'modelar',
  'graficar', 'tabular', 'presentar', 'defender', 'socializar', 'redactar',
  'elaborar', 'organizar', 'explicar', 'comparar', 'interpretar', 'sustituir',
  'eliminar', 'transponer', 'factorizar', 'clasificar', 'medir', 'evaluar',
  'garantizar', 'asegurar', 'demostrar', 'verificar', 'determinar', 'obtener',
  'mantener', 'facilitar', 'desarrollar', 'establecer', 'lograr', 'encontrar',
  'visualizar', 'identificar', 'analizar', 'comprender',
  'indica', 'indican', 'señala', 'señalan', 'identifica', 'muestra', 'demuestra', 'analiza',
  // Sustantivos relacionales o verbos futuros transitivos colgados observados en truncamientos
  'base', 'tipos', 'dos', 'aplicaras', 'aplicarás', 'analitica', 'analítica',
  'activaras', 'activarás', 'delimitaras', 'delimitarás', 'presentaras', 'presentarás',
  'identificaras', 'identificarás', 'analizaras', 'analizarás', 'resolveras', 'resolverás',
  'evaluaras', 'evaluarás', 'socializaras', 'socializarás', 'validaras', 'validarás',
  'contrastaras', 'contrastarás', 'justificaras', 'justificarás',
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

  const lastTokenMatch = withoutTrailingDot.match(/([A-ZÁÉÍÓÚÑa-záéíóúñ0-9_²³°%)/Δ]+)$/);
  if (!lastTokenMatch) return false;
  const rawLastToken = lastTokenMatch[1];
  // Expresiones de cociente matemático con diagonal (ej. "Δx/Δy", "m/s", "a/b") no son palabras funcionales colgadas
  if (rawLastToken.includes('/') && /[A-Za-z0-9Δ]\/[A-Za-z0-9Δ]/.test(rawLastToken)) {
    return false;
  }
  const lastWord = rawLastToken.toLowerCase();

  // Si la última palabra es una letra aislada ('x', 'y', 'a', 'b'), es válida solo si va precedida de variable/ecuación ("variable y", "valor de x", "para x")
  if (/^[xyzbcmn]$/.test(lastWord) || (lastWord === 'a' && /[=+\-−*/×·(]\s*a$|\d\s*a$|\b(?:variable|inc[oó]gnita|coeficiente|lado|cateto)\s+a$/i.test(withoutTrailingDot))) {
    const hasVariableContext =
      // Variable/incógnita nombrada o verbo matemático de operación sobre la variable
      /\b(?:variable|inc[oó]gnita|valor(?:\s+de)?|despejar|despeja|despejas|aisla|a[ií]sla|eliminar|elimina|calcula|calcular|halla|hallar|encuentra|determina|resuelve|sustituye|eval[uú]a|grafica|define|vale|para|de|en|con|si|entre|por|eje|cateto|lado|[aá]ngulo|punto|punto\s+de|recta|coeficiente|t[eé]rmino|miembro)\s+[xyzabcmn]$/i.test(
        withoutTrailingDot
      ) ||
      // Variable tras operador, igualdad, número o paréntesis: "2 x", "= x", "(x", "+ y"
      /(?:[=+\-−*/×·(,;:]|\d)\s*[xyzabcmn]$/i.test(withoutTrailingDot) ||
      // Letra única que es toda la expresión (p. ej. "x")
      withoutTrailingDot.split(/\s+/).length === 1;
    if (hasVariableContext) {
      return false;
    }
    // Letra suelta sin contexto matemático ("señala c"): recorte mutilado
    return true;
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
    .replace(/\b(ej|aprox|fig|pág|pag|núm|num|dr|dra|sr|sra|vs|etc|ec)\./gi, '$1\uE001')
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
      )
      .replace(
        /^(?:Traducimos\s+las\s+condiciones\s+del\s+problema\s+a\s+una\s+ecuaci[oó]n\s+lineal\s+donde\s+|Planteamos\s+la\s+ecuaci[oó]n(?:\s+inicial|\s+lineal)?\s*:\s*)/i,
        ''
      )
      .replace(/\bVisualizamos\s+la\s+ecuaci[oó]n\s+en\s+la\s+balanza\s+de\s+dos\s+platos\s*:\s*/gi, 'Balanza: ')
      .replace(/\bAplicamos\s+el\s+despeje\s+en\s+la\s+ecuaci[oó]n\s*:\s*/gi, 'Despeje: ')
      .replace(/\bel\s+plato\s+izquierdo\s+representa\s+la\s+primera\s+compra\s*/gi, 'izq. ')
      .replace(/\by\s+el\s+plato\s+derecho\s+representa\s+la\s+segunda\s+compra(?:\s+equivalente)?\s*/gi, ', der. ')
      .replace(/\bpara\s+mantener\s+el\s+equilibrio\s+de\s+la\s+balanza(?:\s+algebraica)?\b/gi, '');
  }

  // Condensar introducciones circunstanciales largas sin datos numéricos al inicio de oración
  text = text
    .replace(
      /^(?:Para|En|Durante)\s+(?:la\s+organizaci[oó]n|el\s+dise[ñn]o|la\s+instalaci[oó]n|la\s+socializaci[oó]n|la\s+sesi[oó]n|la\s+revisi[oó]n|la\s+defensa|asegurar|fomentar|mitigar)\s+[^,.0-9=]{12,95},\s*/i,
      ''
    )
    .replace(
      /^(?:En\s+(?:un\s+centro\s+comunitario|una\s+comunidad(?:\s+semiurbana)?|una\s+localidad(?:\s+rural)?|otra\s+demarcaci[oó]n)|Un\s+grupo\s+(?:juvenil(?:\s+comunitario)?|de\s+j[oó]venes(?:\s+emprendedores)?)|Un\s+comit[eé]\s+juvenil)(?:\s+(?:de|en|del\s+municipio\s+de)\s+Puebla(?:\s+con\s+alta\s+vulnerabilidad\s+econ[oó]mica)?)?\s*,?\s*/i,
      ''
    )
    .replace(
      /^Para\s+(?:dise[ñn]ar|evaluar|planear|organizar)\s+[^,.0-9=]{10,95},\s*un\s+grupo\s+de\s+estudiantes(?:\s+de\s+bachillerato)?\s+(?:determina|calcula|observa|analiza)\s+que\s+/i,
      ''
    )
    .replace(/^(?:necesita|requiere|busca|desea)\s+(calcular|determinar|encontrar|hallar)\s+/i, '$1 ')
    .replace(/^(?:planea\s+destinar|dispone\s+de)\s+/i, 'Con ')
    .replace(/^(?:Analiza|Explora)\s+una\s+situaci[oó]n\s+donde\s+(?:se\s+)?/i, '')
    .replace(/\bse\s+define\s+formalmente\s+como\s+(una?|el|la)\s+/gi, 'es $1 ')
    .replace(/\bse\s+modela\s+rigurosamente\s+con\s+ayuda\s+de\s+/gi, 'se modela con ')
    .replace(/\bseparad[oa]s\s+por\s+el\s+signo\s+igual\s*\(['"]?=['"]?\)/gi, '(=)')
    .replace(/,\s*las\s+cuales\s+se\s+denominan\s+[^,.]{5,35}(?=[,.]|$)/gi, '')
    .replace(/\bsabiendo\s+que\s+al\s+(?:comprar|adquirir)\s+/gi, 'si ')
    .replace(/,\s*se\s+obtiene\s+un\s+total\s+equivalente\s+a\s+(?:adquirir|comprar)\s+/gi, ' equivale a ')
    .replace(/\ba\s+un\s+costo(?:\s+de\s+producci[oó]n)?\s+de\s+/gi, ' a ')
    .replace(/\bpor\s+un\s+pago\s+[uú]nico\s+de\s+/gi, ' con pago fijo de ')
    .replace(/\s*\bpor\s+cada\s+hora(?:\s+de\s+uso)?\b/gi, '/hora')
    .replace(/\bvaluad[oa]\s+en\s+/gi, 'de ')
    .replace(/\bModela\s+esta\s+situaci[oó]n\s+(?:usando|aplicando|con)\s+[^.?!]{5,55}\s+y\s+/gi, '')
    .replace(/\bplantea\s+y\s+resuelve\s+una\s+ecuaci[oó]n(?:\s+lineal)?\s+para\s+(?:determinar|encontrar|calcular|hallar)\s+/gi, 'calcula ')
    .replace(/^(?:Aplicaci[oó]n\s+directa\s+en\s+el\s+proyecto\s+comunitario\s+PAEC|Vinculaci[oó]n\s+con\s+el\s+PAEC)\s+/i, 'PAEC: ')
    .replace(/^(?:Reflexiona\s+sobre\s+tu\s+entorno(?:\s+en\s+Puebla)?\s+y\s+observa\s+c[oó]mo\s+|En\s+tu\s+comunidad(?:\s+de\s+Puebla)?\s*,\s*)/i, '')
    .replace(/\bSi\s+el\s+primer\s+([a-záéíóúñ]+)\s+est[aá]\s+representad[oa]\s+por\s+(?:la\s+expresi[oó]n\s+algebraica\s+)?([^,.]+)\s+y\s+el\s+segundo\s+\1\s+por\s+([^.,]+)/gi, 'Primer $1: $2; segundo $1: $3')
    .replace(/\s+est[aá]\s+representad[oa]\s+por\s+la\s+expresi[oó]n\s+algebraica\s+/gi, ' es ')
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
    )
    .replace(/\bUn programa comunitario(?: en Puebla)? analiza la relaci[oó]n entre\s+/gi, 'Relación entre ')
    .replace(/,?\s+en las que participa un grupo de j[oó]venes(?=[,.]|$)/gi, '')
    .replace(/,?\s+bajo la restricci[oó]n presupuestaria modelada por la ecuaci[oó]n\s+/gi, ', sujeta a ')
    .replace(/\bsemanales de asesor[ií]a acad[eé]mica\b/gi, 'de asesoría')
    .replace(/\bde talleres recreativos\b/gi, 'de taller')
    .replace(/\bCalcula el tama[ñn]o de la muestra estad[ií]stica necesaria para una poblaci[oó]n finita de\s+/gi, 'Calcula la muestra para ')
    .replace(/\ben un plantel educativo,\s*considerando un nivel de confianza del\s+/gi, ', confianza ')
    .replace(/\bconsiderando un nivel de confianza del\s+/gi, 'confianza ')
    .replace(/\by un margen de error del\s+/gi, 'y error ')
    .replace(/\bCalcula primero el cuadrado de ([a-z])\s+/gi, 'Eleva $1² ')
    .replace(/\by el cuadrado del error\s+/gi, 'y e² ')
    .replace(/\bantes de armar la fracci[oó]n principal\b/gi, 'antes de dividir')
    .replace(/\bDise[ñn]a un tabulador de frecuencias resumido para\s+/gi, 'Tabla de frecuencias para ')
    .replace(/\baplicadas sobre horas semanales dedicadas a(?:\s+la)?\s+/gi, 'sobre horas de ')
    .replace(/\bUna cooperativa escolar(?: en Puebla)? invierte un capital inicial de\s+/gi, 'Se invierte ')
    .replace(/\ben un fondo de ahorro juvenil que paga una tasa de inter[eé]s simple anual del\s+/gi, 'a interés simple anual del ')
    .replace(/\bdurante un periodo de\s+/gi, 'por ')
    .replace(/\bUn fondo de financiamiento comunitario(?: para el deporte)? otorga un pr[eé]stamo de\s+/gi, 'Préstamo de ')
    .replace(/\ba tasa compuesta anual del\s+/gi, 'a interés compuesto anual del ')
    .replace(/\bcon capitalizaci[oó]n anual por un plazo de\s+/gi, 'anual a ')
    .replace(/\bEmplea la f[oó]rmula de inter[eé]s capitalizable\s+/gi, 'Usa ')
    .replace(/\bUtiliza la f[oó]rmula de inter[eé]s lineal\s+/gi, 'Usa ')
    .replace(/\bSe cuenta con una poblaci[oó]n inicial de\s+/gi, 'Población inicial ')
    .replace(/,?\s+con una tasa de crecimiento anual estimada en\s+/gi, ', tasa anual ')
    .replace(/\bentre\s+12\s+y\s+29\s+a[ñn]os\s+en\s+el\s+a[ñn]o\s+(\d{4})\b/gi, '(12–29 años, $1)')
    .replace(/\bCalcular el costo unitario de un\s+/gi, 'Costo unitario de ')
    .replace(/\bun paquete de material de seguridad de\s+/gi, 'kit de seguridad de ')
    .replace(/\ben herramientas adicionales(?=[.,]|$)/gi, '')
    .replace(/\bpagan un env[ií]o fijo de\s+/gi, 'más envío de ')
    .replace(/\bcuyo costo total equivale a (?:adquirir|comprar)\s+/gi, ', equivalente a ')
    .replace(/\buna mesa de corte menor de\s+/gi, 'mesa de ')
    .replace(/\ben total\.\s*encuentra el costo del tablero\.?$/gi, 'en total.')
    .replace(/\bEl modelo proyecta que para el a[ñn]o\s+(\d{4})\s+/gi, 'En $1 ')
    .replace(/\bascender[aá] a\s+/gi, 'será de ')
    .replace(/\s+en ese rango de edad(?=[.,]|$)/gi, '')
    .replace(/\bIguala cada factor a cero para hallar las ra[ií]ces:\s*/gi, 'Raíces: ')
    .replace(/\s+implica\s+/gi, ' ⇒ ')
    .replace(/^Agregas a tu dossier la evidencia final evaluada y tu bit[aá]cora[^.?!]{0,85}$/i, 'Integra evidencia final y bitácora al dossier PAEC.')
    .replace(/^¿Puedo explicar por qu[eé] es necesario\s+/i, '¿Explico por qué ')
    .replace(/^¿Comprend[ií]\s+c[oó]mo se relacionan los miembros de una ecuaci[oó]n con el equilibrio de una balanza de dos platos\??$/i, '¿Relaciono los miembros de una ecuación con una balanza?')
    .replace(/^¿Comprend[ií]\s+la diferencia(?: fundamental)? entre\s+/i, '¿Distingo entre ')
    .replace(/^¿Comprend[ií]\s+la importancia de\s+/i, '¿Valoro la importancia de ')
    .replace(/^¿Reflexion[eé]\s+cr[ií]ticamente sobre mis aciertos y dificultades al\s+/i, '¿Reflexioné sobre mi desempeño al ')
    .replace(/\s+de una ecuaci[oó]n\s+para conservar su validez(?=[?]|$)/gi, '')
    .replace(/\s+para conservar su validez(?=[?]|$)/gi, '')
    .replace(/\s+y verificar los resultados paso a paso(?=[?]|$)/gi, ' y verificar pasos')
    .replace(/\bA partir de una encuesta piloto aplicada a\s+/gi, 'Encuesta a ')
    .replace(/\s+sobre las horas semanales dedicadas a actividades recreativas saludables,\s*se obtuvieron los siguientes datos agrupados en frecuencias absolutas:\s*/gi, ' (horas recreativas): ')
    .replace(/\bde\s+(\d+)\s+a\s+(\d+)\s+horas\s*\((\d+)\s+j[oó]venes\)/gi, '$1–$2 h ($3)')
    .replace(/^Dada la ecuaci[oó]n(?:\s+polin[oó]mica)?\s+que\s+modela\s+[^=]{6,55}?(?=\b\d*[a-z]\s*\()/i, '')
    .replace(/,\s*transf[oó]rmala\s+a\s+su\s+forma\s+(?:general|completa)\s+/gi, ' ⇒ ')
    .replace(/\be\s+identifica(?:\s+claramente)?\s+los\s+valores(?:\s+num[eé]ricos)?\s+de\s+los\s+(?:coeficientes|factores)\s+/gi, ' e indica ')
    .replace(/\bEscribe formalmente el resultado de la identificaci[oó]n de (?:coeficientes|factores):\s*/gi, '')
    .replace(/\bDetermina el precio unitario de un\s+/gi, 'Precio unitario de ')
    .replace(/,?\s*\bsabiendo que\s+/gi, ': ')
    .replace(/,?\s*\bmientras que\s+/gi, '; ')
    .replace(/\bPara un fondo de ahorro juvenil destinado a prevenir conductas de riesgo mediante actividades culturales,\s*se depositan\s+/gi, 'Se depositan ')
    .replace(/\bVas a defender ante el grupo la soluci[oó]n de la ecuaci[oó]n\s+/gi, 'Explica ')
    .replace(/,\s*que representa el c[aá]lculo del n[uú]mero de paquetes de material\s*\(([^)]+)\)\s*necesarios para un taller juvenil\s+/gi, ' ($1 = paquetes) ')
    .replace(/\bDebes calcular el tama[ñn]o de la muestra estad[ií]stica\s+([a-z])\s+para una poblaci[oó]n juvenil de\s+/gi, 'Calcula la muestra $1 para ')
    .replace(/\ben una localidad de Puebla,\s*utilizando un nivel de confianza del\s+/gi, ', confianza ')
    .replace(/\by un margen de error\s+/gi, 'y error ')
    .replace(/,\s*con un margen de error\s+/gi, ', error ')
    .replace(/\bRedondeando estrictamente al entero superior[^,]{10,80},\s*concluimos que se requiere encuestar a un total de\s+/gi, 'Se requiere encuestar a ')
    .replace(/\bTu compa[ñn]ero presenta una tabulaci[oó]n de factores de riesgo con una muestra estad[ií]stica de\s+/gi, 'Muestra propuesta ')
    .replace(/\bDetectas que la muestra propuesta por tu compa[ñn]ero\s*\(([^)]+)\)\s*es insuficiente seg[uú]n el c[aá]lculo riguroso\s+/gi, 'Muestra $1 insuficiente frente a ')
    .replace(/\bTienes un capital inicial de\s+/gi, 'Capital inicial ')
    .replace(/\s+destinado a un fondo de ahorro comunitario para equipar un n[uú]cleo recreativo juvenil,\s*el cual ofrece\s+/gi, ' con ')
    .replace(/\bIdentifica que los\s+(\d+\s+metros)\s+y los\s+(\d+\s+metros)\s+corresponden a los catetos[^,]{0,35},\s*por lo que debes calcular la hipotenusa[^.]{0,55}\.?$/gi, 'Catetos $1 y $2: calcula hipotenusa (a² + b² = c²).')
    .replace(/\bInvestiga con tu familia o en un negocio local(?:\s+de tu comunidad(?:\s+en Puebla)?)?\s+/gi, 'Indaga en un negocio local ')
    .replace(/\bpor concepto de cuotas de recuperaci[oó]n,\s*cobrando\s+/gi, ', cobrando ')
    .replace(/\bpor participante en\s+/gi, 'en ')
    .replace(/\bAutoeval[uú]a tu desempe[ñn]o en el bloque respondiendo en tu bit[aá]cora:\s*/gi, '')
    .replace(/\bpara resolver problemas de tu comunidad(?:\s+en Puebla)?(?=[?]|$)/gi, '')
    .replace(/\bAnaliza e interpreta en tu reporte t[eé]cnico los puntos cr[ií]ticos de la gr[aá]fica obtenida a partir de la ecuaci[oó]n\s+/gi, 'Analiza ')
    .replace(/\bRedacta la secci[oó]n de planteamiento y tabulaci[oó]n de tu reporte t[eé]cnico considerando\s+/gi, 'Tabula ')
    .replace(/\bla ecuaci[oó]n de restricci[oó]n presupuestaria\s+/gi, '')
    .replace(/\bla combinaci[oó]n de\s+/gi, '')
    // Compresión sin pérdida de datos numéricos/ecuaciones en actividades, problemas y pistas extensas
    .replace(/\(\s*ambos\s+miembros\s+de\s+la\s+igualdad\s*\)/gi, '')
    .replace(/\bTransforma\s+la\s+siguiente\s+ecuaci[oó]n\s+algebraica\s+polin[oó]mica(?:\s+derivada\s+del\s+dise[ñn]o\s+de\s+[a-záéíóúñ\s]{4,45})?\s+a\s+su\s+forma\s+completa\s+/gi, 'Transforma a forma completa ')
    .replace(/,?\s*y\s+determina\s+los\s+valores\s+num[eé]ricos\s+exactos\s+de\s+sus\s+coeficientes\s+([a-z,\s]+y\s+[a-z])\s*:\s*/gi, ' e indica $1: ')
    .replace(/\bpara\s+un\s+centro\s+recreativo\s+juvenil(?:\s+en\s+Puebla)?\s+se\s+modela\s+con\s+la\s+expresi[oó]n\s+fraccionaria\s+/gi, ' se modela con ')
    .replace(/\bSup[oó]n\s+que\s+el\s+comit[eé]\s+gestor\s+del\s+PAEC\s+analiza\s+un\s+fondo\s+inicial\s+de\s+/gi, 'Fondo PAEC de ')
    .replace(/\s+destinado\s+a\s+la\s+rehabilitaci[oó]n\s+de\s+una\s+cancha\s+deportiva\s+comunitaria,\s*el\s+cual\s+genera\s+un\s+rendimiento\s+financiero\s+bajo\s+un\s+esquema\s+de\s+inter[eé]s\s+compuesto\s+del\s+/gi, ', interés compuesto del ')
    .replace(/\b(?:anual\s+)?capitalizable\s+cada\s+a[ñn]o\b/gi, 'anual')
    .replace(/\bRevisa\s+el\s+siguiente\s+procedimiento\s+de\s+un\s+compa[ñn]ero\s+que\s+resolvi[oó]\s+/gi, 'Revisa si ')
    .replace(/\s+usando\s+la\s+f[oó]rmula\s+general\s+y\s+obtuvo\s+/gi, ' da ')
    .replace(/,\s*concluyendo\s+que\s+/gi, ' ⇒ ')
    .replace(/\bResuelve\s+el\s+siguiente\s+sistema\s+de\s+ecuaciones\s+mediante\s+el\s+m[eé]todo\s+de\s+([a-záéíóúñ]+)\s+para\s+encontrar\s+[^:]{6,95}:\s*/gi, 'Resuelve por $1: ')
    .replace(/\bResuelve\s+y\s+comprueba\s+mediante\s+una\s+matriz\s+anal[ií]tica\s+la\s+ecuaci[oó]n\s+lineal\s+que\s+modela\s+(?:el\s+costo\s+de\s+)?/gi, 'Resuelve y comprueba: ')
    .replace(/\bVerifica\s+la\s+soluci[oó]n\s+de\s+la\s+ecuaci[oó]n\s+fraccionaria\s+derivada\s+del\s+presupuesto\s+de\s+/gi, 'Verifica presupuesto de ')
    .replace(/\bRealiza\s+la\s+revisi[oó]n\s+cruzada\s+de\s+un\s+reporte\s+de\s+resoluci[oó]n\s+de\s+ecuaci[oó]n\s+cuadr[aá]tica\s+donde\s+un\s+compa[ñn]ero\s+obtuvo\s+/gi, 'Revisa reporte: ')
    .replace(/^Se\s+(?:establece|sabe)\s+que\s+/i, '')
    .replace(/\bEl\s+m[eé]todo\s+de\s+completar\s+cuadrados\s+consiste\s+en\s+transformar\s+/gi, 'Completar cuadrados transforma ')
    .replace(/\bAplicando\s+los\s+signos,\s*tenemos\s+/gi, 'Con signos: ')
    .replace(/\bUna\s+(?:ecuaci[oó]n|igualdad)\s+cuadr[aá]tica,\s*o\s+de\s+segundo\s+grado,\s*es\s+aquella\s+en\s+la\s+que\s+el\s+mayor\s+exponente\s+de\s+la\s+(?:inc[oó]gnita|variable|desconocida)\s+es\s+dos,\s*(?:represent[aá]ndose|present[aá]ndose)\s+generalmente\s+en\s+(?:su|la)\s+(?:forma\s+can[oó]nica|estructura\s+est[aá]ndar)\s+/gi, 'Ecuación cuadrática (grado 2): forma ')
    .replace(/\bUna\s+(?:ecuaci[oó]n|igualdad)\s+cuadr[aá]tica\s+con\s+una\s+(?:inc[oó]gnita|variable)\s+es\s+aquella\s+que\s+se\s+puede\s+(?:expresar|escribir)\s+en\s+(?:su\s+)?(?:forma|estructura)\s+completa\s+como\s+ax\s+al\s+cuadrado\s+m[aá]s\s+bx\s+m[aá]s\s+c\s+igual\s+a\s+cero\b/gi, 'Ecuación cuadrática: ax² + bx + c = 0')
    .replace(/\bUna\s+(?:ecuaci[oó]n|igualdad)\s+lineal\s+con\s+dos\s+(?:variables|inc[oó]gnitas)\s+es\s+(?:una\s+)?(?:f[oó]rmula\s+simb[oó]lica|expresi[oó]n\s+matem[aá]tica)\s+que\s+puede\s+escribirse\s+en\s+(?:su\s+)?(?:forma|estructura)\s+(?:general|can[oó]nica)(?:\s+o\s+completa)?\s+como\s+/gi, 'Ecuación lineal (2 variables): ')
    .replace(/\bRelaci[oó]n\s+entre\s+las\s+horas\s+de\s+asesor[ií]a\s*\(([a-z])\)\s*y\s+las\s+horas\s+de\s+taller\s*\(([a-z])\),\s*sujeta\s+a\s+/gi, 'Asesoría ($1) y taller ($2): ')
    .replace(/\bComprueba\s+si\s+una\s+combinaci[oó]n\s+propuesta,\s*por\s+ejemplo\s+comprar\s+/gi, 'Comprueba si ')
    .replace(/,?\s*el\s+par\s+ordenado\s+\(([^)]+)\)\s+es\s+una\s+soluci[oó]n\s+v[aá]lida\s+para\s+la\s+ecuaci[oó]n\s+y\s+cumple\s+estrictamente\s+con\s+la\s+restricci[oó]n\s+presupuestaria\b/gi, '; ($1) cumple el presupuesto')
    .replace(/\bPara\s+acondicionar\s+([^,]{6,55})\s+en\s+el\s+centro\s+recreativo(?:\s+juvenil)?,\s*cuentas\s+con\s+un\s+fondo\s+de\s+/gi, 'Fondo para $1: ')
    .replace(/\bPara\s+garantizar\s+que\s+un\s+(?:modelo|esquema)\s+matem[aá]tico\s+represente[^,]{10,140},\s*es\s+indispensable\s+dominar\s+/gi, 'Conviene dominar ')
    .replace(/\b(\d+)\s+entradas\s+generales\s+m[aá]s\s+(\d+)\s+entradas\s+VIP\s+cuestan\s+\$(\d[\d.,]*)\s+pesos\b/gi, (_m, a: string, b: string, p: string) => `${a} generales + ${b} VIP = $${p}`)
    .replace(/\bEl\s+(?:costo|precio)\s+de\s+cada\s+([a-záéíóúñ]+)\s+es\s+de\s+\$?(\d[\d.,]*)(?:\s+pesos)?\b/gi, (_m, item: string, p: string) => `Cada ${item} cuesta $${p}`)
    .replace(
      /\b(\d+)\s+([a-záéíóúñ]+)\s+y\s+(\d+)\s+([a-záéíóúñ]+)\s+cuestan\s+\$?(\d[\d.,]*)(?:\s+pesos)?;\s*(\d+)\s+([a-záéíóúñ]+)\s+y\s+(\d+)\s+([a-záéíóúñ]+)\s+cuestan\s+\$?(\d[\d.,]*)(?:\s+pesos)?/gi,
      (_m, a: string, b: string, c: string, d: string, p1: string, e: string, f: string, g: string, h: string, p2: string) =>
        `$${p1}: ${a} ${b} + ${c} ${d}; $${p2}: ${e} ${f} + ${g} ${h}`
    )
    .replace(/,\s*y\s+que\s+(?=\d)/gi, '; ')
    .replace(/\bRealiza\s+la\s+verificaci[oó]n\s+num[eé]rica\s+sustituyendo\s+/gi, 'Verifica con ')
    .replace(/\bpara\s+la\s+compra\s+de\s+material\s+recreativo\b/gi, 'en material')
    .replace(/\bCon\s+estos\s+datos\s+construimos\s+nuestra\s+tabla\s+de\s+valores\s+validada\.?$/gi, '')
    .replace(/\bEl\s+proveedor\s+cobra\s+un\s+costo\s+fijo\s+de\s+/gi, 'Costo fijo ')
    .replace(/\bpor\s+un\s+costo\s+total\s+de\s+/gi, 'por ')
    .replace(/\bunidades\s+de\s+material\s+tipo\s+/gi, 'de material ')
    .replace(/\bDetermina\s+las\s+dimensiones\s+de\s+un\s+terreno\s+rectangular\s+destinado\s+a\s+un\s+taller\s+juvenil\s+comunitario\s+en\s+Puebla/gi, 'Terreno rectangular')
    .replace(/(:\s*el\s+[aá]rea\s+es\s+de\s+\d+\s*(?:m²|metros\s+cuadrados))\s+y\s+que\s+el\s+largo\b/gi, '$1 y el largo')
    .replace(/\bPara\s+dise[ñn]ar\s+una\s+zona\s+recreativa\s+juvenil\s+rectangular\s+en\s+tu\s+(?:comunidad|localidad),\s*se\s+establece\s+que\s+/gi, 'Zona rectangular: ')
    .replace(/\bUn\s+comit[eé]\s+comunitario\s+en\s+Puebla\s+invierte\s+/gi, 'Se invierte ')
    .replace(/\bdestinados\s+al\s+equipamiento\s+de\s+un\s+centro\s+recreativo\s+juvenil,\s*/gi, '')
    .replace(/\bLa\s+diferencia\s+absoluta\s+entre\s+ambos\s+m[eé]todos\s+(?:al\s+cabo|al\s+componente)\s+de\s+/gi, 'Diferencia en ')
    .replace(/\bLa\s+optimizaci[oó]n\s+y\s+validaci[oó]n\s+rigurosa\s+de\s+los\s+esquemas\s+matem[aá]ticos\s+financieros\s+requiere\s+un\s+estudio\s+profundo\s+y\s+detallado\b/gi, 'Validación de modelos financieros')
    .replace(/\bEl\s+plano\s+indica\s+que\s+la\s+base\s+horizontal\s+mide\s+/gi, 'Base ')
    .replace(/\by\s+la\s+altura\s+vertical\s+del\s+soporte\s+es\s+de\s+/gi, 'y altura ')
    .replace(/\bSe\s+observa\s+mediante\s+el\s+Teorema\s+de\s+Pit[aá]goras\s+que\s+se\s+trata\s+de\s+un\s+tri[aá]ngulo\s+rect[aá]ngulo(?:\s+perfecto)?,\s*ya\s+que\s+/gi, 'Teorema de Pitágoras (triángulo rectángulo): ')
    .replace(/\b(?:dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+al\s+cuadrado\b/gi, (m) => {
      const map: Record<string, string> = { dos: '2', tres: '3', cuatro: '4', cinco: '5', seis: '6', siete: '7', ocho: '8', nueve: '9', diez: '10' };
      const word = m.trim().split(/\s+/)[0].toLowerCase();
      return `${map[word] ?? word}²`;
    })
    .replace(/(\d+²)\s+m[aá]s\s+(\d+²)/gi, '$1 + $2')
    .replace(/\bElevas\s+al\s+cuadrado\s+cada\s+t[eé]rmino:\s*/gi, 'Cuadrados: ')
    .replace(/\s+al\s+cuadrado\s+es\s+igual\s+a\s+/gi, '² = ')
    .replace(/\s+al\s+cuadrado\s+es\s+(?!igual\b)/gi, '² = ')
    .replace(/\s+es\s+igual\s+a\s+/gi, ' = ')
    .replace(/\b(\d+)\s+metros\s+cuadrados\b/gi, '$1 m²')
    .replace(/\bRealizar\s+la\s+operaci[oó]n\s+dentro\s+del\s+par[eé]ntesis\s+y\s+calcular\s+la\s+potencia[^:]{0,40}:\s*/gi, 'Potencia: ')
    .replace(/\bMultiplicar\s+el\s+factor\s+resultante\s+por\s+el\s+capital\s+inicial\s+para\s+obtener\s+el\s+monto\s+final:\s*/gi, 'Monto final: ')
    .replace(/\bLas\s+dimensiones\s+totales\s+del\s+terreno\s+incluyendo\s+la\s+franja\s+de\s+adoqu[ií]n\s+de\s+ancho\s+([a-z])\s+en\s+ambos\s+lados\s+ser[aá]n\s+de\s+/gi, 'Terreno + franja $1: ')
    .replace(/\bObt[eé]n\s+las\s+soluciones\s+y\s+selecciona\s+la\s+v[aá]lida\.\s*/gi, '')
    .replace(/\bRegistra\s+la\s+correcci[oó]n\s+en\s+el\s+formato\s+de\s+coevaluaci[oó]n\s+y\s+valida\s+que\s+con\s+/gi, 'Valida con ')
    .replace(/\s+la\s+suma\s+sea\s+exactamente\s+/gi, ' suma ')
    .replace(/\bEn\s+el\s+proyecto\s+de\s+mejora\s+del\s+parque,\s*se\s+necesitan\s+/gi, 'Parque: ')
    .replace(/^Tienes\s+(?:un\s+sistema\s+que\s+modela|un\s+tri[aá]ngulo\s+base\s+cuyos\s+lados\s+miden)\s+/i, '')
    .replace(/\ben\s+tu\s+plano\s+a\s+escala\.?$/i, '.')
    .replace(/^Creas\s+una\s+tabla\s+estructurada\s+con\s+dos\s+columnas\s+principales\s+tituladas\s+/i, 'Tabla: ')
    .replace(/,?\s*registrando\s+los\s+valores\s+obtenidos:\s*/gi, ': ')
    .replace(/\bPlantea\s+la\s+ecuaci[oó]n\s+matem[aá]tica\s+seg[uú]n\s+los\s+[aá]ngulos\s+suplementarios,\s*donde\s+su\s+suma\s+total\s+debe\s+ser\s+exactamente\s+igual\s+a\s+(\d+)\s+grados\.?$/i, 'Suplementarios: suman $1°.')
    .replace(/\bUtilizando\s+tu\s+regla\s+graduada\s+y\s+comp[aá]s\s+de\s+precisi[oó]n,\s*dibujas\s+/gi, 'Traza ')
    .replace(/\s+utilizando\s+la\s+f[oó]rmula\s+general\s+y\s+analiza\s+el\s+discriminante\s+para\s+un\s+proyecto\s+de\s+optimizaci[oó]n\s+de\s+[aá]reas\.?$/i, ' con fórmula general.')
    .replace(/\ben\s+un\s+solo\s+lado\s+de\s+la\s+ecuaci[oó]n\s+y\s+los\s+t[eé]rminos\s+independientes\s+en\s+el\s+otro\b/gi, 'de un lado y constantes al opuesto')
    .replace(/\by\s+verifica\s+si\s+se\s+cumple\s+la\s+igualdad(?:\s+del\s+[a-záéíóúñ]+)?\b/gi, 'y comprueba la igualdad')
    .replace(/\bo\s+despejando\s+directamente\s+el\s+t[eé]rmino\s+con\s+fracci[oó]n\b/gi, 'o despeja la fracción')
    .replace(/\bVerifica\s+cuidadosamente\s+el\s+valor\s+del\s+discriminante\s+y\s+la\s+divisi[oó]n\s+final\s+entre\s+el\s+denominador\s+correcto\b/gi, 'Verifica el discriminante y el denominador')
    .replace(/\bsin\s+cometer\s+errores\s+de\s+signos\b/gi, 'sin errores de signo')
    .replace(
      /\bPrecio\s+unitario\s+de(?:\s+un[ao]?)?\s+([^:()]{2,28})\s*\(([xy])\)\s*y\s+de(?:\s+un[ao]?)?\s+([^:()]{2,28})\s*\(([xy])\)\s*:/gi,
      (_m, a: string, x: string, b: string, y: string) => {
        const cleanA = a.trim().replace(/^un[ao]?\s+/i, '');
        const cleanB = b.trim().replace(/^un[ao]?\s+/i, '');
        return `${cleanA.charAt(0).toUpperCase()}${cleanA.slice(1)} (${x}) y ${cleanB} (${y}):`;
      }
    )
    .replace(/\$(\d[\d,]*),\$/g, (_m, prefix: string) => `$${prefix},`)
    .replace(/(?<![\d.,$])\b(\d[\d,.]*)\s+pesos\b/gi, (_m, n: string) => `$${n}`)
    .replace(/\$(\d[\d,.]*)\s+pesos\b/gi, (_m, n: string) => `$${n}`);

  if (role === 'hint') {
    text = text.replace(
      /^Para\s+(?:eliminar|quitar|despejar|resolver)\s+([^,]{4,45}),\s*(multiplica|divide|suma|resta|agrupa|despeja|iguala|sustituye|aplica|usa)\s+([^.?!]{4,80})/i,
      (_m, obj: string, verb: string, rest: string) =>
        `${verb.charAt(0).toUpperCase()}${verb.slice(1)} ${rest.trim()} para quitar ${obj.trim()}`
    );
  }

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

  // Oración 0 puramente narrativa sin números ni ecuaciones ni pregunta tiene prioridad menor frente a datos
  if (
    index === 0 &&
    total > 1 &&
    role !== 'application' &&
    !hasNumbers &&
    !hasEquation &&
    !hasQuestion
  ) {
    score -= 2;
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
  if (!/[=\d?]/.test(prefix) && !/^\s*¿/.test(prefix) && /[=?]/.test(suffix)) return true;
  if (role === 'problem' || role === 'activity') {
    return /[?=$]|\d/.test(suffix);
  }
  if (role === 'step') {
    if (/(?:Ec\.|Ecuaci[oó]n)\s*\d+\s*$/i.test(prefix) && /=/.test(suffix)) return true;
    if (/^[,;]\s*(?:Ec\.|Ecuaci[oó]n)\s*\d+\s*[:=⇒].*=/i.test(suffix)) return true;
    if (/^(?:⇒|=>)/.test(suffix) && /=/.test(suffix)) return true;
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
 * Último guardián de presupuesto: recorta por frontera de palabra y repara la cola.
 * Evita que una sola oración larga ignore maxChars/maxWords y desborde la tarjeta.
 */
function hardTrimToBudget(
  text: string,
  maxChars: number,
  maxWords: number | undefined,
  ensurePeriod: boolean
): string {
  const words = text.split(/\s+/).filter(Boolean);
  const effectiveMaxChars = Math.max(1, maxChars - (ensurePeriod ? 1 : 0));
  let out = '';

  for (const word of words) {
    const next = out ? `${out} ${word}` : word;
    if (next.length > effectiveMaxChars) break;
    if (maxWords !== undefined && next.split(/\s+/).length > maxWords) break;
    out = next;
  }

  if (!out) {
    const firstWord = words[0] ?? '';
    if (!firstWord || firstWord.length > effectiveMaxChars) return '';
    out = firstWord;
  }

  let repaired = repairDanglingEnding(out, ensurePeriod);
  if (repaired.length > maxChars) {
    let fallback = '';
    for (const word of repaired.split(/\s+/).filter(Boolean)) {
      const next = fallback ? `${fallback} ${word}` : word;
      if (next.length > maxChars) break;
      fallback = next;
    }
    repaired = repairDanglingEnding(fallback, ensurePeriod);
  }
  return repaired;
}

/**
 * Ajusta semánticamente un texto pedagógico a su presupuesto sin usar cortes ciegos `.slice(0, maxChars)`.
 */
export function fitPedagogicalText(
  raw: string | null | undefined,
  options: FitPedagogicalTextOptions = {}
): string {
  const role = options.role ?? 'general';
  let maxChars = options.maxChars ?? 220;
  let maxWords = options.maxWords;
  const ensurePeriod = options.ensurePeriod ?? true;

  const normalized = normalizeEditorialText(raw).replace(/\s+/g, ' ').trim();
  if (!normalized) return '';

  const hasQuestion = /[?¿]/.test(normalized);
  // Las preguntas son contenido irrenunciable: si caben con un margen elástico,
  // se conservan completas en lugar de mutilarlas y añadirles "?" al final.
  if (hasQuestion) {
    const expandedChars = maxChars + 60;
    const expandedWords = maxWords !== undefined ? maxWords + 10 : undefined;
    if (
      normalized.length <= expandedChars &&
      (!expandedWords || normalized.split(/\s+/).filter(Boolean).length <= expandedWords)
    ) {
      return /[?]$/.test(normalized) ? normalized : `${normalized.replace(/[.!]+$/, '')}?`;
    }
  }

  const hasMultipleNumericClauses =
    (normalized.match(/\$/g) || []).length >= 2 ||
    (normalized.match(/=/g) || []).length >= 2 ||
    (normalized.match(/\b\d[\d.,]*\s*(?:pesos|m²|m|cm|%|años|horas|unidades)\b/gi) || []).length >= 2;
  if (
    hasMultipleNumericClauses &&
    maxWords !== undefined &&
    (role === 'problem' || role === 'activity' || role === 'step')
  ) {
    maxWords = Math.min(22, Math.max(maxWords, maxWords + 6));
  }

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

  // Paso 2: Selección de oraciones por relevancia pedagógica (solo omitir apertura si las demás tienen datos y la 2.ª no depende por anáfora)
  // En 'hint', la primera oración suele contener la acción prioritaria ("Calcula primero...", "Multiplica..."), nunca relleno.
  const anaphoraPattern = /\b(?:sus?|est[ea]s?|es[oa]s?|aquel(?:la)?s?|dich[oa]s?|mism[oa]s?|ah[ií]|all[ií])\b/i;
  const sentences = splitSpanishSentences(compressed);
  if (sentences.length > 1 && role !== 'application' && role !== 'hint' && compressed.length > maxChars) {
    const firstHasData = /\d|[=<>]/.test(sentences[0]);
    const restText = sentences.slice(1).join(' ').trim();
    const restHasData = /\d|[=<>]/.test(restText);
    const secondDependsOnFirst = anaphoraPattern.test(sentences[1] ?? '');
    if (!firstHasData && restHasData && !secondDependsOnFirst && restText.length >= 25) {
      compressed = compressPedagogicalText(restText, role);
    }
  }

  // Si aún supera el presupuesto y hay múltiples oraciones, conservar las oraciones con datos, ecuaciones y pregunta en orden
  const currentSentences = splitSpanishSentences(compressed);
  if (currentSentences.length > 1 && compressed.length > maxChars) {
    const firstIsEssentialContext =
      currentSentences.length > 1 && anaphoraPattern.test(currentSentences[1] ?? '');
    const scored = currentSentences.map((s, idx) => ({
      s,
      idx,
      score:
        idx === 0 && (role === 'application' || firstIsEssentialContext)
          ? Math.max(2, sentencePriorityScore(s, idx, currentSentences.length, role))
          : sentencePriorityScore(s, idx, currentSentences.length, role),
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
    const ordered =
      (role === 'problem' || role === 'activity') &&
      !/\d|[=<>]/.test(finalSentences[0] ?? '') &&
      /\d|[=<>]/.test(finalSentences.slice(1).join(' ')) &&
      !anaphoraPattern.test(finalSentences[1] ?? '')
        ? [...finalSentences.slice(1), finalSentences[0]!]
        : finalSentences;
    let acc = '';
    for (const sent of ordered) {
      const next = acc ? `${acc} ${sent}` : sent;
      const fitsChars = next.length <= maxChars + 12;
      const fitsWords = !maxWords || next.split(/\s+/).length <= maxWords;
      if ((fitsChars && fitsWords) || !acc) {
        acc = next;
      } else if (
        (role === 'problem' || role === 'activity') &&
        acc &&
        !/[?¿]|\b(?:calcula|determina|encuentra|halla|resuelve|modela|plantea|indica|escribe|localiza)\b/i.test(acc) &&
        (/[?¿]|\d|=/.test(sent))
      ) {
        const compactTail = compressPedagogicalText(
          sent
            .replace(/^(?:Si\s+el\s+presupuesto\s+total\s+disponible\s+para\s+la\s+renta\s+es\s+de)\s+/i, 'Presupuesto: ')
            .replace(/^(?:Si\s+(?:al|en|para)\s+)/i, 'Al ')
            .replace(/\((?:descontando|incluyendo|donde|es decir)[^)]{8,65}\)\s*/gi, ''),
          role
        );
        const rescued = `${acc} ${compactTail}`.trim();
        if (rescued.length <= maxChars + 48 && (!maxWords || rescued.split(/\s+/).length <= maxWords + 8)) {
          acc = rescued;
        }
        break;
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
    const secondIsFormulaOrValue =
      /^(?:(?:Ec\.|Ecuaci[oó]n)\s*\d+\s*[:=⇒]|[a-zA-Z0-9_]+\s*=|\(?[+-]?\d|[xy]\s*[=+-])/i.test(secondSemi);
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
        /(?:\.\s+[-–—]\s+|\s+[-–—]\s+(?:Resultado|Verificaci[oó]n|Interpretaci[oó]n|Significado|Comprobaci[oó]n|Sustituci[oó]n|Ecuaci[oó]n|Variable)\b|;\s+(?![a-zA-Z0-9\s.+\-*/()]*=)|,\s+(?:por ejemplo|es decir|lo que|lo cual|donde|cuando|integrando|activando|aplicando|asegurando|garantizando|evitando|verificando|considerando|concluyendo|calculando|utilizando|determinando|mediante|a\s+trav[eé]s\s+de|con\s+el\s+(?:fin|prop[oó]sito|objetivo)\s+de|para\s+(?:obtener|determinar|identificar|analizar|validar|comprobar|verificar|modelar|garantizar))\b|\s+(?:considerando|manteniendo|definiendo|evaluando|asegurando|garantizando|evitando|verificando|tomando\s+en\s+cuenta|sin\s+exceder|a\s+lo\s+largo|dentro\s+de(?:l)?|en\s+contextos?|paso\s+a\s+paso|para\s+(?:obtener|determinar|identificar|analizar|validar|comprobar|verificar|modelar|garantizar)|con\s+el\s+(?:fin|prop[oó]sito|objetivo)\s+de|vinculad[oa]s?\s+(?:al|a\s+la)|aplicad[oa]s?\s+(?:a|al|en)|integrad[oa]s?\s+(?:a|al|en)|mediante\s+(?:el|la)\s+(?:uso|aplicaci[oó]n|construcci[oó]n|an[aá]lisis|elaboraci[oó]n)|teniendo\s+en\s+cuenta)\b|:\s+(?=[^0-9=+\-*/()]{8,}))/i;
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
        const dropsTaskColonTail =
          m[0].startsWith(':') &&
          /\b(?:localiza|calcula|determina|busca|analiza|escribe|identifica|encuentra|resuelve|plantea|usa|aplica|justificando|identificando)\b/i.test(
            right
          );
        if (
          openParens === closeParens &&
          !dropsEssentialMath &&
          !dropsTaskColonTail &&
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
        const isQuestion = /^\s*¿/.test(compressed);
        compressed =
          isQuestion && !/\?\s*$/.test(candidate)
            ? `${candidate.replace(/[.?!…]+$/, '').trim()}?`
            : candidate;
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
              !/^Para\s+[a-záéíóúñ]{3,}r\b[^,]*$/i.test(prefix) &&
              !breaksNumericOrTupleList(prefix, suffix) &&
              prefix.split(/\s+/).length <= wordLimit &&
              prefix.split(/\s+/).length >= 4
            ) {
              const isQuestion = /^\s*¿/.test(compressed);
              const cleaned = isQuestion
                ? (() => {
                    const cleanedBase = repairDanglingEnding(prefix, false)
                      .replace(/[.?!…]+$/, '')
                      .trim();
                    return cleanedBase ? `${cleanedBase}?` : '';
                  })()
                : repairDanglingEnding(prefix, ensurePeriod);
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
            ? /\s+(?:que\s+[a-záéíóúñ]{3,}|con\s+(?:el|la|los|las|un|una|su|sus|respaldo|[aá]ngulos|base)|sobre\s+(?:el|la|los|las)|desde\s+(?:el|la)|hacia\s+(?:cada|el|la)|entre\s+(?:el|la|los|las|sus)|sin\s+[a-záéíóúñ]{3,}|destinad[oa]\s+a|usando\s+la|antes\s+de\s+aplicar|para\s+quitar|en\s+(?:el\s+plano|papel|tu|la\s+toma)|y\s+(?:que|el|la|los|las|su|sus|para))\s+/gi
            : role === 'hint'
              ? /(?:,\s*luego|\s+(?:que\s+[a-záéíóúñ]{3,}|multiplicando|elevando|igualando|seg[uú]n|dejando|por\s+lo\s+que|para\s+quitar|en\s+un\s+solo|y\s+los\s+t[eé]rminos|antes\s+de|sin\s+cometer|y\s+(?:suma|compara|despeja|luego|asigna|grafica|la\s+segunda|el\s+monto)|por\s+(?:cada|el)|con\s+(?:el|la|los|las)|sobre\s+(?:el|la)|para\s+|donde\s+|al\s+pasar))\s+/gi
              : /\s+(?:que\s+[a-záéíóúñ]{3,}|con\s+(?:el|la|los|las|un|una|su|sus|respaldo|[aá]ngulos|base)|sobre\s+(?:el|la|los|las)|desde\s+(?:el|la)|hacia\s+(?:cada|el|la)|entre\s+(?:el|la|los|las|sus)|sin\s+[a-záéíóúñ]{3,}|durante\s+cada|a\s+fin\s+de|en\s+(?:el\s+plano|papel|pliego|tu|la\s+toma|mi\s+proyecto|tu\s+proyecto|el\s+contexto)|(?:usando|utilizando|empleando|aplicando|analizando|verificando|comprobando|considerando|evaluando|calculando|identificando|recordando|donde|mientras)|(?:aplicad[oa]s?|integrad[oa]s?)\s+(?:a|al|en)|relacion[aá]ndol[oa]s?|de\s+cada\s+una\s+de|como\s+cualquiera\s+de|para\s+(?:organizar|validar|conservar|resolver)|al\s+(?:resolver|aplicar)|y\s+(?:a\s+)?(?:que|el|la|los|las|su|sus|tu|tus|para|trazar|validar|verificar|elaborar|defender|representa|modela|justifica))\s+/gi;

        const wordTotal = compressed.split(/\s+/).length;
        const allowWideTrim = role !== 'problem' && role !== 'activity' && role !== 'step';
        const extraWideLimit = wordTotal > maxWords * 2 ? Math.min(maxWords + 8, Math.floor(wordTotal * 0.72)) : maxWords + 4;
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
            : (role === 'step' || role === 'problem' || role === 'activity') && wordTotal > maxWords * 1.6
              ? tryRightToLeftTrim(tier1SepRe, maxWords + 6) ?? tryRightToLeftTrim(tier2SepRe, maxWords + 6)
              : null);
        if (trimmed) {
          compressed = trimmed;
        }
      }
    }
  }

  // Paso 5: Límite duro de presupuesto incluso si una sola oración no tiene cláusulas seguras
  if (
    compressed.length > maxChars ||
    (maxWords !== undefined && compressed.split(/\s+/).length > maxWords)
  ) {
    compressed = hardTrimToBudget(compressed, maxChars, maxWords, ensurePeriod);
  }

  // Paso 6: Garantizar que jamás quede un final colgado o incompleto.
  // Si era pregunta y la compresión perdió el cierre, se recupera la oración
  // interrogativa completa del original; nunca se pega "?" a un fragmento mutilado.
  const repaired = repairDanglingEnding(compressed, ensurePeriod);
  if (hasQuestion && !/\?$/.test(repaired)) {
    const completeQuestion = splitSpanishSentences(normalized).find((sentence) => sentence.includes('?'));
    if (completeQuestion && completeQuestion.length <= maxChars + 80) {
      return completeQuestion.trim();
    }
  }
  return repaired;
}

/**
 * Guardián final único SSoT para cualquier texto visible en PDF, DOCX, PPTX e Infografías.
 * Normaliza matemáticas/puntuación, remueve fragmentos colgantes truncados ("y activarás tus...")
 * incluso antes de guiones o paréntesis añadidos por encabezados, y garantiza cierre gramatical limpio.
 */
export function finalizeVisibleText(
  raw: string | null | undefined,
  options?: {
    fallback?: string;
    maxChars?: number;
    ensurePeriod?: boolean;
    role?: 'concept' | 'practice' | 'application' | 'misconception' | 'step' | 'artifact';
  }
): string {
  const ensurePeriod = options?.ensurePeriod ?? false;
  let text = normalizeEditorialText(raw ?? '')
    // Reparar fragmentos colgados clásicos antes de cierres de encabezado / paréntesis / comillas
    .replace(/\s+y\s+activar[aá]s\s+tus(?=\s*(?:$|["'”».,;:!?()[\]—–-]))/gi, '')
    .replace(
      /\s+(?:y\s+activar[aá]s|y\s+delimitar[aá]s|y\s+presentar[aá]s|y\s+contrastar[aá]s|y\s+evaluar[aá]s|y\s+justificar[aá]s)(?=\s*(?:$|["'”».,;:!?()[\]—–-]))/gi,
      ''
    )
    // Eliminar artículos o preposiciones colgantes justo antes de "— Sesión ..." o "(SESIONES ...)"
    .replace(
      /\s+(?:de|del|en|con|por|para|y|o|el|la|los|las|un|una|tus|sus)\s+(?=(?:—|–|\(SESIONES|\(Sesiones))/g,
      ' '
    )
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) {
    return options?.fallback?.trim() ?? '';
  }

  if (options?.maxChars && text.length > options.maxChars) {
    const mappedRole: PedagogicalTextRole =
      options.role === 'practice'
        ? 'activity'
        : options.role === 'misconception' || options.role === 'artifact'
          ? 'concept'
          : (options.role ?? 'concept');
    text = fitPedagogicalText(text, {
      maxChars: options.maxChars,
      role: mappedRole,
      ensurePeriod,
    });
  } else if (hasDanglingEnding(text)) {
    text = repairDanglingEnding(text, ensurePeriod);
  } else if (ensurePeriod && !/[.?!…]$/.test(text)) {
    text = `${text}.`;
  }

  text = normalizeEditorialText(text)
    .replace(/\s+y\s+activar[aá]s\s+tus(?=\s*(?:$|["'”».,;:!?()[\]—–-]))/gi, '')
    .trim();

  if (!text || text.length < 4 || hasDanglingEnding(text)) {
    return options?.fallback?.trim() ?? (text ? repairDanglingEnding(text, ensurePeriod) : '');
  }

  return text;
}
