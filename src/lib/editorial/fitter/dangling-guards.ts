import { normalizeEditorialText } from '../text-normalization';
import { splitSpanishSentences } from './sentence-splitter';

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
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'al', 'lo', 'se',
  'su', 'sus', 'tu', 'tus', 'mi', 'mis', 'nuestro', 'nuestra', 'nuestros', 'nuestras',
  'este', 'esta', 'estos', 'estas', 'ese', 'esa', 'esos', 'esas', 'aquel', 'aquella',
  'cada', 'todo', 'toda', 'todos', 'todas', 'otro', 'otra', 'otros', 'otras',
  'mismo', 'misma', 'ambos', 'ambas', 'cual', 'cuales', 'cuyo', 'cuya',
  'cuanto', 'cuánto', 'cuanta', 'cuánta', 'cuantos', 'cuántos', 'cuantas', 'cuántas',
  // Conjunciones, relativos y conectores colgados
  'y', 'e', 'o', 'u', 'ni', 'pero', 'sino', 'aunque', 'porque', 'pues',
  'como', 'cómo', 'cuando', 'cuándo', 'donde', 'dónde', 'que', 'qué', 'cual', 'cuál', 'cuales', 'cuáles', 'si', 'mas', 'más', 'menos',
  'muy', 'tan', 'tanto', 'asi', 'así', 'ademas', 'además', 'tambien', 'también',
  'mientras', 'quien', 'quienes', 'antes', 'despues', 'después', 'luego', 'respecto',
  // Verbos copulativos, auxiliares, transitivos o gerundios que exigen complemento
  'es', 'son', 'fue', 'fueron', 'sera', 'será', 'seran', 'serán', 'sea', 'sean',
  'esta', 'está', 'estan', 'están', 'tiene', 'tienen', 'posee', 'poseen', 'hay', 'debe', 'deben',
  'puede', 'pueden', 'permite', 'permiten', 'requiere', 'requieren', 'representa',
  'representan', 'denota', 'modela', 'modelan', 'determina', 'calcula', 'calcular',
  'halla', 'encuentra', 'aplica', 'aplicar', 'soluciona', 'solucionar',
  'explica', 'justifica', 'sustenta', 'sustentar', 'reconoce', 'reconocer', 'detalla', 'detallar',
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
  'proporciona', 'proporcionan', 'valida', 'validan', 'confirma', 'confirman', 'garantiza', 'garantizan',
  // Gerundios e infinitivos transitivos que exigen complemento directo
  'combinando', 'integrando', 'evaluando', 'comparando', 'relacionando', 'conectando',
  'vinculando', 'contrastando', 'identificando', 'verificando', 'comprobando', 'justificando',
  'argumentando', 'analizando', 'modelando', 'resolviendo', 'planteando', 'calculando',
  'determinando', 'construyendo', 'elaborando', 'diseñando', 'disenando', 'redactando',
  'organizando', 'clasificando', 'ordenando', 'registrando', 'trazando', 'graficando',
  'tabulando', 'describiendo', 'explicando', 'interpretando', 'defendiendo', 'presentando',
  'proponiendo', 'corrigiendo', 'auditando', 'revisando', 'mostrando', 'demostrando',
  'respaldando', 'citando', 'contextualizando', 'juzgando', 'codificando', 'validando',
  'seleccionando', 'eligiendo', 'empleando', 'usando', 'realizando', 'ejecutando', 'efectuando',
  'ver', 'saber', 'conocer', 'hallar', 'hacer', 'tener', 'dar', 'tomar', 'poner', 'usar',
  'emplear', 'seguir', 'elegir', 'escoger', 'definir', 'probar', 'mostrar', 'formular',
  'estructurar', 'proponer', 'corregir', 'auditar', 'citar', 'contextualizar', 'juzgar',
  'codificar', 'respaldar', 'argumentar',
  'iguala', 'igualar', 'cruza', 'cruzan', 'cruzando', 'suman', 'sumarse', 'multiplicarse',
  'quitar', 'agrupar', 'agrupa', 'agrupamos', 'despejar', 'despeja', 'despejamos', 'expresar',
  'escribir', 'escribirse', 'transformar', 'obteniendo', 'aislar', 'planear', 'sustituimos',
  'sumamos', 'restamos', 'multiplicamos', 'dividimos', 'resolvemos', 'posibilita', 'posibilitan',
  'incluye', 'incluyen', 'contiene', 'contienen', 'abarca', 'abarcan', 'comprende', 'comprenden',
  'implica', 'implican', 'ofrece', 'ofrecen', 'brinda', 'brindan', 'otorga', 'otorgan',
  'genera', 'generan', 'produce', 'producen',
  'alterar', 'establece', 'establecen', 'completa', 'completan', 'traduce', 'traducen',
  'determinan', 'calculan', 'explican', 'resuelven', 'demuestran', 'argumentan', 'justifican',
  'doble', 'triple', 'cuádruple',
  // Verbos en segunda persona del singular (tú) que exigen objeto directo o infinitivo
  'debes', 'puedes', 'tienes', 'necesitas', 'requieres', 'realizas', 'aplicas', 'calculas',
  'obtienes', 'observas', 'comparas', 'sustituyes', 'despejas', 'divides', 'multiplicas',
  'sumas', 'restas', 'representas', 'utilizas', 'usas', 'identificas', 'determinas',
  'encuentras', 'resuelves', 'planteas', 'verificas', 'compruebas', 'interpretas',
  'explicas', 'justificas', 'registras', 'elaboras', 'construyes', 'diseñas', 'disenas',
  'modelas', 'graficas', 'tabulas', 'analizas', 'evaluas', 'evalúas', 'integras',
  // Sustantivos relacionales o verbos futuros transitivos colgados observados en truncamientos
  'base', 'tipos', 'dos', 'aplicaras', 'aplicarás', 'analitica', 'analítica',
  'activaras', 'activarás', 'delimitaras', 'delimitarás', 'presentaras', 'presentarás',
  'identificaras', 'identificarás', 'analizaras', 'analizarás', 'resolveras', 'resolverás',
  'evaluaras', 'evaluarás', 'socializaras', 'socializarás', 'validaras', 'validarás',
  'contrastaras', 'contrastarás', 'justificaras', 'justificarás',
  // Verbos transitivos / demostrativos / gerundios colgados detectados en auditoría 08/09
  'escribe', 'redacta', 'evitar', 'diagnosticar', 'visualicen', 'ofrecer', 'limpiar',
  'clasifica', 'examina', 'contrasta', 'compara', 'recuerda', 'asegurate', 'asegúrate',
  'efectua', 'efectúa', 'anade', 'añade', 'dictamina', 'siguiendo', 'basandote', 'basándote',
  'esto', 'eso', 'aquello', 'cuyo', 'cuya', 'cuyos', 'cuyas', 'solicita', 'solicitan',
]);

const TRAILING_OPERATOR_RE = /[=+\-*/×÷·^<>≈≤≥(\[{,;:]\s*\.?\s*$/;

/**
 * Detecta si un texto termina truncado a mitad de oración, en palabra colgada o en operador matemático.
 */
export function hasDanglingEnding(raw: string): boolean {
  const clean = (raw || '').replace(/\s+/g, ' ').trim();
  if (!clean) return false;

  if (TRAILING_OPERATOR_RE.test(clean)) return true;
  if (/[+\-*/×÷]\s*:/.test(clean)) return true;

  // Delimitadores abiertos sin cerrar (o cierre huérfano antes de apertura, excluyendo viñetas "1) ... 2)").
  const openDelimiters = (clean.match(/[([{«¿¡]/g) || []).length;
  const closeDelimiters = (clean.match(/[)\]}»?!]/g) || []).length;
  if (openDelimiters > closeDelimiters) return true;
  if (clean.includes('¿') && !clean.includes('?')) return true;
  // Comillas tipográficas o simples sin cerrar (ignorando apóstrofes/contracciones como don't, L'Hôpital y derivadas f'(x), y')
  const doubleQuoteCount = (clean.match(/"/g) || []).length;
  if (doubleQuoteCount % 2 === 1) return true;
  const withoutContractions = clean
    .replace(/(?<=[A-Za-zÁÉÍÓÚÜÑáéíóúüñ])'(?=[A-Za-zÁÉÍÓÚÜÑáéíóúüñ(])/g, '')
    .replace(/(?<![A-Za-zÁÉÍÓÚÜÑáéíóúüñ'])[fghxyuvFGHY]'(?=\s*[(=+\-*/])/g, '');
  const singleQuoteCount = (withoutContractions.match(/'/g) || []).length;
  if (singleQuoteCount % 2 === 1) return true;
  const withoutListMarkers = clean.replace(/(?:^|[\s:;])\d{1,2}\)(?=\s|$|\.)/g, ' ');
  if (/^[^(\[{]*[)\]}]/.test(withoutListMarkers)) return true;
  // Lista numerada truncada antes del ítem ("... 3) Cálculo..., y 4).")
  if (/\by\s+[1-9]\d?\)\.?$/i.test(clean)) return true;

  // Cláusulas subordinadas huérfanas sin oración principal ("Para realizar...", "Al conocer...", "Si el ancho es 'x'.")
  const outsideParensClean = clean.replace(/\([^)]*\)/g, '');
  if (
    (/^Para\s+[a-záéíóúñ]+(?:ar|er|ir)\b/i.test(outsideParensClean) &&
      !/[,:?;!]/.test(outsideParensClean) &&
      !/\.\s+\S/.test(outsideParensClean)) ||
    (/^Al\s+[a-záéíóúñ]+(?:ar|er|ir)\b/i.test(outsideParensClean) &&
      !/[,:?;!]/.test(outsideParensClean) &&
      !/\.\s+\S/.test(outsideParensClean)) ||
    (/^Si\s+/i.test(outsideParensClean) &&
      !/[,?;!]/.test(outsideParensClean) &&
      !/\.\s+\S/.test(outsideParensClean))
  ) {
    return true;
  }

  // Cláusula relativa posesiva truncada sin verbo al final (", cuya identificación.", "para un estudiante cuyo texto.")
  if (/(?:,|\b)\s*cuy[oa]s?\s+[A-ZÁÉÍÓÚÑa-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑa-záéíóúñ]+){0,2}\.?$/i.test(clean)) {
    return true;
  }

  // Locuciones prepositivas truncadas ("a partir.", "por medio.", "en torno.", "previo."),
  // excluyendo adjetivo posnominal completo ("diseño técnico previo.", "estudio previo.", "análisis previo.").
  if (
    /\b(?:a\s+partir|por\s+medio|en\s+torno|con\s+respecto|acerca|junto)\.?$/i.test(clean) ||
    (/\b(?:previo|previa)\.?$/i.test(clean) &&
      !/\b(?:dise[ñn]o(?:\s+t[eé]cnico)?|an[aá]lisis|estudio|c[aá]lculo|diagn[oó]stico|registro|trabajo|modelo|plano|protocolo|ensayo|control|paso|proceso|informe|reporte|conocimiento|mantenimiento|revisi[oó]n|inspecci[oó]n|planeaci[oó]n|evaluaci[oó]n|lectura|pr[aá]ctica|verificaci[oó]n)\s+(?:previo|previa)\.?$/i.test(
        clean
      ))
  ) {
    return true;
  }

  // Cuantificador numérico sin unidad ("cada 2.5.", "volumen ocupado de 80.", "es de 12.", "resistencia de 150.", "dosis experimental de 200.", "inodoro de 0.08.", "tubería de 1/2.", "cada una y 2.", "precisa comprar 12.")
  if (
    /\bcada\s+\d+(?:[.,]\d+)?\.?$/i.test(clean) ||
    /\b(?:volumen(?:\s+ocupado|\s+total)?|longitud(?:\s+de\s+[^.]{2,40})?|resistencia|dosis(?:\s+experimental)?|inodoro|tuber[ií]a|instalaci[oó]n|espesor|profundidad|di[aá]metro|radio|altura|ancho|largo|masa|peso|caudal|presi[oó]n|temperatura|velocidad|capacidad)\s+(?:es\s+)?(?:de\s+)?\d+(?:[.,/]\d+)?\.?$/i.test(
      clean
    ) ||
    /\b(?:comprar|requiere|exige|necesita|cada\s+un[ao]\s+y)\s+\d+(?:[.,/]\d+)?\.?$/i.test(clean)
  ) {
    return true;
  }

  // Demostrativos o frases colgadas sin objeto ("de esta.", "cómo esto.", "eliminación total.", "y los deportivos (y).")
  if (
    /\b(?:de|en|con|sobre)\s+est[aeo]\.?$/i.test(clean) ||
    /\bc[oó]mo\s+est[eo]\.?$/i.test(clean) ||
    /\beliminaci[oó]n\s+total\.?$/i.test(clean) ||
    /\b(?:y|e)\s+(?:los|las)\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{3,}\s*\([a-z]\)\.?$/i.test(clean)
  ) {
    return true;
  }

  // Participios de finalidad/relación truncados sin complemento ("componentes diseñados.", "proyecto, diseñada."),
  // excluyendo sintagmas definidos completos ("del elemento diseñado.", "del proyecto diseñado.", "del tramo diseñado.").
  if (
    /\b(?:dise[ñn]ad[oa]s?|destinad[oa]s?|orientad[oa]s?|enfocad[oa]s?|dirigid[oa]s?|basad[oa]s?|encargad[oa]s?|dedicad[oa]s?|relacionad[oa]s?|vinculad[oa]s?)\.?$/i.test(
      clean
    ) &&
    !/\b(?:del|el|al|un)\s+(?:elemento|proyecto|tramo|sistema|plano|m[oó]dulo|prototipo|equipo|espacio|circuito|dise[ñn]o)\s+dise[ñn]ado\.?$/i.test(
      clean
    )
  ) {
    return true;
  }

  // Verbos que exigen complemento directo/preposicional al cierre ("cumplan.", "cumplen.", "dice.", "esté.", "has preguntado.")
  if (
    /\b(?:cumplan|cumplen|cumple|cuyo\s+texto\s+dice|texto\s+dice|est[eé]n?|est[aá]n|has\s+preguntado)\.?$/i.test(
      clean
    )
  ) {
    return true;
  }

  // Modificadores prenominales o adverbios cuantificadores colgados al cierre ("colores poco.", "requiere mayor."),
  // excluyendo adjetivos posnominales válidos ("daños mayores.") y adverbios de frecuencia tras verbo ("pasan poco.").
  if (
    /\b(?:poco|poca|pocos|pocas|mayor|menor|mayores|menores|alg[uú]n|alguna|ning[uú]n|ninguna|cualquier|demasiado|bastante|sumamente|altamente|completamente)\.?$/i.test(
      clean
    ) &&
    !/\b(?:da[ñn]os|riesgos|problemas|cambios|errores|costos|gastos|niveles|valores|cargas|fallas|esfuerzos|rangos|grados|p[eé]rdidas)\s+(?:mayores|menores)\.?$/i.test(
      clean
    ) &&
    !/\b(?:pasan|cuestan|duran|pesan|miden|consumen|var[ií]an|cambian|aportan|participan|avanzan)\s+poco\.?$/i.test(
      clean
    )
  ) {
    return true;
  }

  // Cláusula subordinada con sujeto nominal sin verbo al cierre ("asegurar que las acotaciones.", "que el municipio.", "comprueba que el equipo de proyección o soporte visual.", "anota que 200 gramos de agua líquida a 0 °C.", "posibilita que tus pares.", "escribe qué habilidades técnicas y comunicativas.")
  const subClauseMatch = clean.match(
    /\b(?:(?:asegurar|verificar|garantizar|comprobar|comprueba|aseg[uú]rate\s+de|anota|registra|mostrar|indicar|confirmar|explicar|analizar|identificar|posibilita|posibilitan|permite|permiten|servicios\s+p[uú]blicos|normas|reglas)\s+que|(?:escribe|redacta|halla|calcula|determina|encuentra|indica|explica|identifica)\s+(?:en\s+tu\s+(?:libreta|cuaderno|bit[aá]cora)\s+)?qu[eé])\s+([^.?!]{4,58})\.?$/i
  );
  if (subClauseMatch) {
    const tail = subClauseMatch[1]!.trim();
    const tailWords = tail.split(/\s+/).filter(Boolean);
    // Solo marcar como truncada si la cola tras "que"/"qué" es un sintagma nominal corto (<= 7 palabras)
    // sin verbo finito ni infinitivo/participio predicativo.
    // Nota: en RegExp JS sin /u, \b no coincide tras letras acentuadas (esté, está, cambió); usar lookahead de delimitador.
    const looksLikeNounPhraseOnly =
      tailWords.length <= 7 &&
      !/(?:^|[\s,(¿¡])(?:es|son|est[aáeé]n?|sea[ns]?|se\s+[a-záéíóúñ]{3,}|haya[ns]?|hay|debe[ns]?|puede[ns]?|tiene[ns]?|tenga[ns]?|hace[ns]?|haga[ns]?|quede[ns]?|queda[ns]?|coincida[ns]?|coincide[ns]?|cumpla[ns]?|cumple[ns]?|funcione[ns]?|funciona[ns]?|opere[ns]?|opera[ns]?|resulte[ns]?|resulta[ns]?|guarde[ns]?|mantenga[ns]?|mantiene[ns]?|disminuya[ns]?|aumenta[ns]?|aumente[ns]?|refleje[ns]?|exista[ns]?|protege[ns]?|impide[ns]?|mejora[ns]?|evita[ns]?|reduce[ns]?|var[ií]a[ns]?|cambia[ns]?|presenta[ns]?|muestra[ns]?|indica[ns]?|corresponda[ns]?|corresponde[ns]?|representa[ns]?|incluye[ns]?|incluya[ns]?|contiene[ns]?|contenga[ns]?|requiere[ns]?|exige[ns]?|garantiza[ns]?|garantice[ns]?|asegura[ns]?|asegure[ns]?|valida[ns]?|justifica[ns]?|sirve[ns]?|ayuda[ns]?|ocurre[ns]?|ocurri[oó]|sucede[ns]?|baja[ns]?|sube[ns]?|cae[ns]?|mide[ns]?|pesa[ns]?|cuesta[ns]?|dura[ns]?|suma[ns]?|sume[ns]?|difiere[ns]?|suene[ns]?|suena[ns]?|visualice[ns]?|fortaleciste|aprendiste|obtuviste|lograste|cambi[oó]|trabaj[oó]|afecta[ns]?|influye[ns]?|aplica[ns]?|utiliza[ns]?|emplea[ns]?|permite[ns]?|permita[ns]?|alcance[ns]?|alcanza[ns]?|supere[ns]?|supera[ns]?|podr[ií]a[ns]?|deber[ií]a[ns]?|tendr[ií]a[ns]?|har[ií]a[ns]?|ser[ií]a[ns]?|habr[ií]a[ns]?|[a-záéíóúñ]{2,}(?:aron|ieron|aste|iste|aban|[ií]an|ar[aá][ns]?|er[aá][ns]?|ir[aá][ns]?|ar[ií]a[ns]?|er[ií]a[ns]?|ir[ií]a[ns]?|ando|iendo))(?=$|[\s.,;:!?)])/i.test(
        tail
      );
    if (looksLikeNounPhraseOnly) {
      return true;
    }
  }

  // Verbos transitivos o infinitivos colgados al cierre sin objeto directo ("y considera.", "y asegura.", "para diseñar.", "permite representar.", "y escribe.", "para evitar.", "para diagnosticar.")
  // Excluir cláusulas completas "al medir." y "lista/listo para construir."
  if (
    /\b(?:y|e|o|para|sin|al|permite|permiten|posibilita|posibilitan|debe|deben|puede|pueden|busca|buscan|necesita|requiere|logra)\s+(?:considera|asegura|garantiza|permite|incluye|contiene|requiere|utiliza|emplea|aplica|presenta|muestra|indica|describe|identifica|reconoce|analiza|examina|define|expresa|representa|escribe|redacta|anota|registra|clasifica|contrasta|compara|recuerda|dictamina|efect[uú]a|a[ñn]ade|dise[ñn]ar|construir|elaborar|calcular|determinar|identificar|analizar|explicar|resolver|aplicar|obtener|verificar|registrar|evaluar|comparar|representar|medir|trazar|acotar|cuantificar|realizar|efectuar|ejecutar|generar|producir|garantizar|asegurar|optimizar|mantener|proteger|controlar|estimar|evitar|diagnosticar|ofrecer|presentar|limpiar|visualizar|visualicen)\.?$/i.test(
      clean
    ) &&
    !/\bal\s+(?:medir|operar|trabajar|probar|graficar|calcular|resolver|conectar)\.?$/i.test(clean) &&
    !/\blist[oa]\s+para\s+(?:construir|operar|instalar|aplicar|entregar|presentar|usar)\.?$/i.test(clean)
  ) {
    return true;
  }

  // Condicional truncado en sintagma nominal sin verbo principal ("Si ocurre un contacto accidental, el protocolo.")
  if (/^Si\s+[^,]{3,80},\s*(?:el|la|los|las|un|una)\s+[A-ZÁÉÍÓÚÑa-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑa-záéíóúñ]+)?\.?$/i.test(clean)) {
    return true;
  }

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

  // Excepción legítima: enunciados metalingüísticos que citan conectores entre comillas o tras "Conector:"
  // (ej. "Conector: por lo tanto.", "Unir con 'debido a' y 'por consiguiente'.")
  if (
    /^Conector(?:es)?\s*:\s*\S+/i.test(withoutTrailingDot) ||
    /(?:'[^']{2,40}'|"[^"]{2,40}")$/.test(withoutTrailingDot)
  ) {
    return false;
  }

  const lastTokenMatch = withoutTrailingDot.match(/([A-ZÁÉÍÓÚÜÑa-záéíóúüñ0-9_²³°%)/Δ]+)$/);
  if (!lastTokenMatch) return false;
  const rawLastToken = lastTokenMatch[1];
  // Expresiones de cociente matemático con diagonal (ej. "Δx/Δy", "m/s", "a/b") no son palabras funcionales colgadas
  if (rawLastToken.includes('/') && /[A-Za-z0-9Δ]\/[A-Za-z0-9Δ]/.test(rawLastToken)) {
    return false;
  }
  const lastWord = rawLastToken.toLowerCase();

  // Caso crítico en español: 'y' es conjunción copulativa Y también variable matemática.
  // Tras un número, paréntesis de cierre o ecuación completa ("= 50 y.", "x = 38 y.", "4.6 y.",
  // "(13-3y)/2 y.", "300 y.", "0 a 6 y."), 'y' es SIEMPRE la conjunción española truncada.
  // Solo es variable matemática válida cuando la precede un introductor explícito de variable
  // ("variable y", "valor de y", "valores de y", "eje y", "despeja y") o un operador binario ("= y", "+ y", "- y").
  if (lastWord === 'y') {
    if (/(?:\d|[)\]}]|%)\s+['"]?y['"]?$/i.test(withoutTrailingDot)) {
      return true;
    }
    const isLikelyTwoVariableMath =
      /\bx\b|2x2|2×2|sistema|ecuaciones\s+lineales|par(?:es)?\s+ordenad|plano\s+cartesiano|ejes?\s|coordenadas?|['"]y['"]|=/i.test(
        withoutTrailingDot
      );
    // "entre ... y." es SIEMPRE la conjunción truncada ("entre una ecuación de una variable y [una de dos]"), nunca la variable y.
    if (/\bentre\s+.+\s+y$/i.test(withoutTrailingDot)) {
      return true;
    }
    // "de la incógnita y" / "para aislar y" en una oración de una sola variable (sin x ni 'y' ni sistema)
    // es casi siempre la conjunción truncada ("...la incógnita y verifica", "...para aislar y comprobar").
    if (
      /\b(?:de\s+la\s+inc[oó]gnita|para\s+aislar|para\s+despejar)\s+y$/i.test(withoutTrailingDot) &&
      !isLikelyTwoVariableMath
    ) {
      return true;
    }
    const hasExplicitYVariableContext =
      /\b(?:variable|inc[oó]gnita|valor(?:es)?\s+de|despejar?|a[ií]slar?|eliminar?|sustituir|sustituye|eval[uú]a|evaluar|graficar?|eje|coordenada|ordenada|componente|t[eé]rmino|miembro|respecto\s+a|para|de|en)\s+['"]?y['"]?$/i.test(
        withoutTrailingDot
      ) ||
      /[=+\-−*/×·]\s*y$/i.test(withoutTrailingDot) ||
      withoutTrailingDot.split(/\s+/).length === 1;
    return !hasExplicitYVariableContext;
  }

  // Si la última palabra es una letra aislada ('x', 'z', 'a', 'b', 'c', 'm', 'n'), es válida solo si va precedida de variable/ecuación ("variable x", "valor de x", "para x") o etiqueta nominal ("canal B", "opción B", "tipo C")
  if (/^[xzbcmn]$/.test(lastWord) || (lastWord === 'a' && /[=+\-−*/×·(]\s*a$|\d\s*a$|\b(?:variable|inc[oó]gnita|coeficiente|lado|cateto|canal|ranura|puerto|opci[oó]n|grupo|equipo|tipo|clase|nivel|grado|zona|inciso|vista|fase|bloque|m[oó]dulo)\s+a$/i.test(withoutTrailingDot))) {
    const hasVariableContext =
      // Variable/incógnita nombrada, verbo matemático o etiqueta técnica/nominal (ej. "canal B", "canales A y B", "opción B", "tipo C")
      /\b(?:variable|inc[oó]gnita|valor(?:es)?(?:\s+de)?|despejar|despeja|despejas|aislar|a[ií]slar|aisla|a[ií]sla|eliminar|elimina|calcula|calcular|halla|hallar|encuentra|determina|resuelve|sustituye|eval[uú]a|grafica|define|vale|para|de|en|con|si|entre|por|eje|cateto|hipotenusa|lado|[aá]ngulo|punto|punto\s+de|recta|coeficiente|t[eé]rmino|miembro|muestra|poblaci[oó]n|tama[ñn]o(?:\s+de\s+muestra)?|canal(?:es)?|ranura(?:s)?|puerto(?:s)?|opci[oó]n(?:es)?|grupo(?:s)?|equipo(?:s)?|tipo(?:s)?|clase(?:s)?|nivel(?:es)?|grado(?:s)?|zona(?:s)?|inciso(?:s)?|vista(?:s)?|fase(?:s)?|bloque(?:s)?|m[oó]dulo(?:s)?|serie(?:s)?|columna(?:s)?|fila(?:s)?|celda(?:s)?|terminal(?:es)?)\s+(?:[A-Za-z]\s+y\s+)?['"]?[xzabcmn]['"]?$/i.test(
        withoutTrailingDot
      ) ||
      // Variable tras operador, igualdad, número o paréntesis: "2 x", "= x", "(x", "+ z"
      /(?:[=+\-−*/×·(,;:]|\d)\s*[xzabcmn]$/i.test(withoutTrailingDot) ||
      // Letra única que es toda la expresión (p. ej. "x")
      withoutTrailingDot.split(/\s+/).length === 1;
    if (hasVariableContext) {
      return false;
    }
    // Letra suelta sin contexto matemático ("señala c"): recorte mutilado
    return true;
  }

  if (DANGLING_WORDS_SET.has(lastWord)) {
    // Excepción legítima: pronombre definido completo ("en la otra", "con el otro", "los mismos", "cada una", "entre este"),
    // pero rechazar adjetivo truncado antes del sustantivo ("siempre tienen la misma [medida].", "poseen el mismo [valor].")
    if (
      /^(?:otro|otra|otros|otras|mismo|misma|mismos|mismas)$/.test(lastWord) &&
      /\b(?:el|la|los|las|lo)\s+(?:otro|otra|otros|otras|mismo|misma|mismos|mismas)$/i.test(withoutTrailingDot) &&
      !/\b(?:tiene[ns]?|posee[ns]?|comparte[ns]?|mantiene[ns]?|conserva[ns]?)\s+(?:siempre\s+)?(?:el|la|los|las)\s+mism[oa]s?$/i.test(
        withoutTrailingDot
      )
    ) {
      return false;
    }
    if (
      /^(?:uno|una)$/.test(lastWord) &&
      /\bcada\s+(?:uno|una)$/i.test(withoutTrailingDot)
    ) {
      return false;
    }
    if (
      /^(?:este|esta|estos|estas|ese|esa|esos|esas)$/.test(lastWord) &&
      /\b(?:entre|sobre|con|de|para|en|a|por|contra|ante|hacia|desde)\s+(?:este|esta|estos|estas|ese|esa|esos|esas)$/i.test(
        withoutTrailingDot
      )
    ) {
      return false;
    }
    // Excepción legítima: "entre dos" o "en dos" cuando va precedido de "dividiendo entre dos"
    if (lastWord === 'dos' && /\b(?:entre|en|por|los|las)\s+dos$/i.test(withoutTrailingDot)) {
      return false;
    }
    // Excepción legítima: "la base" / "el factor base" / "la tasa base" / "la placa base" / "en forma base"
    if (lastWord === 'base' && /\b(?:de\s+la|en\s+la|su|el\s+factor|la\s+tasa|la\s+placa|tarjeta|en\s+forma|su\s+forma)\s+base$/i.test(withoutTrailingDot)) {
      return false;
    }
    // Excepción legítima: "por todos" / "para todos" (pronombre indefinido completo) y "'not' después" (adverbio de posición)
    if (
      (lastWord === 'todos' && /\b(?:por|para|con|entre|a)\s+todos$/i.test(withoutTrailingDot)) ||
      (lastWord === 'después' && /['"][^'"]{1,16}['"]\s+despu[eé]s$/i.test(withoutTrailingDot))
    ) {
      return false;
    }
    // Excepción legítima: sustantivo/adjetivo homógrafo de verbo en sintagma nominal completo
    // ("la muestra", "la mezcla completa", "una temperatura dada", "instalación completa", "estructura afirmativa completa")
    if (
      (lastWord === 'muestra' && /\b(?:la|una|esta|esa|dicha|su|tu|cada)\s+muestra$/i.test(withoutTrailingDot)) ||
      (lastWord === 'completa' &&
        /\b(?:mezcla|instalaci[oó]n|estructura(?:\s+[a-záéíóúñ]+)?|oraci[oó]n|respuesta|tabla|gr[aá]fica|ecuaci[oó]n|secuencia|revisi[oó]n|verificaci[oó]n|l[aá]mina|muestra|soluci[oó]n|evaluaci[oó]n|lectura|informaci[oó]n|lista|ficha|t[eé]cnica|memoria|bit[aá]cora|evidencia|matriz|carpeta|agenda|propuesta|encuesta)\s+completa$/i.test(
          withoutTrailingDot
        )) ||
      (lastWord === 'dada' && /\b(?:una|la)\s+[a-záéíóúñ]{3,}\s+dada$/i.test(withoutTrailingDot))
    ) {
      return false;
    }
    // Excepción legítima: cláusulas finales completas con "antes de + infinitivo" / "al + infinitivo" / "para + infinitivo"
    if (
      /\b(?:antes\s+de|despu[eé]s\s+de|al|sin)\s+(?:factorizar|despejar|operar|sustituir|calcular|resolver|graficar|tabular|dividir|multiplicar|evaluar|codificar|interpretar|concluir|verificar|comprobar|integrar|validar|presentar|argumentar|explicar|comparar|medir|probar|construir|trabajar|instalar|conectar|limpiar|arrancar|encender)$/i.test(
        withoutTrailingDot
      ) ||
      /\blist[oa]\s+para\s+(?:construir|operar|instalar|usar|entregar|presentar|aplicar|publicar|funcionar)$/i.test(
        withoutTrailingDot
      )
    ) {
      return false;
    }
    // Excepción legítima: paso matemático con ecuación ya explícita que cierra en "y factorizar/simplificar/resolver/comprobar"
    if (
      /=/.test(withoutTrailingDot) &&
      /\by\s+(?:factorizar|simplificar|resolver|despejar|comprobar|verificar|graficar|sustituir|tabular)$/i.test(
        withoutTrailingDot
      )
    ) {
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
      'y', 'a', 'e', 'x', 'z', 'm', 'b', 'c', 'n', 'r', 't', 'ph', 'ac', 'dc',
    ]);
    if (!VALID_SHORT_SPANISH_WORDS.has(stub)) {
      return true;
    }
  }

  // Cláusula causal/condicional que quedó solo con el sujeto sin verbo principal ("Como -12 + 12 = 0, la ecuación.")
  if (/^(?:Como|Dado\s+que|Ya\s+que|Puesto\s+que)\s+[^,]{3,85},\s+(?:el|la|los|las|un|una)\s+[a-záéíóúñ]{2,24}\.?$/i.test(clean)) {
    return true;
  }

  // Frase preposicional acéfala sin verbo finito ("En tu comunidad del estado de Puebla.")
  if (
    /^(?:En|De|Del|Con|Para|Por|Sobre|Desde|Hacia)\s+(?:tu|tus|su|sus|el|la|los|las|un|una)\s+[^.,;!?]{4,75}\.?$/i.test(
      clean
    ) &&
    !/\b(?:es|son|fue|fueron|est[aá]n?|tiene[ns]?|permite[ns]?|muestra[ns]?|representa[ns]?|modela[ns]?|calcula[ns]?|aplica[ns]?|usa[ns]?|utiliza[ns]?|resuelve[ns]?|analiza[ns]?|compara[ns]?|identifica[ns]?|determina[ns]?|eval[uú]a[ns]?|construye[ns]?|elabora[ns]?|genera[ns]?|produce[ns]?|requiere[ns]?|ofrece[ns]?|cobra[ns]?|cuesta[ns]?|mide[ns]?|suma[ns]?|invierte[ns]?|observa[ns]?|registra[ns]?|verifica[ns]?|comprueba[ns]?|describe[ns]?|explica[ns]?|integra[ns]?|presenta[ns]?|incluye[ns]?|contiene[ns]?)\b/i.test(
      clean
    )
  ) {
    return true;
  }

  // Verbo transitivo de archivo/portafolio sin objeto directo o con sustantivo amputado sin complemento
  // ("Incluye en tu expediente de evidencias.", "Agrega hoy a tu portafolio la memoria.", "Hoy incorporas ... el reporte.")
  if (
    /^(?:Hoy\s+)?(?:Incluyes?|A[ñn]ades?|Agregas?|Integras?|Incorporas?|Entregas?)(?:\s+hoy)?\s+(?:en|a)\s+(?:la\s+(?:primera|segunda|tercera|siguiente)\s+secci[oó]n\s+de\s+)?(?:tu|su|el|la)\s+(?:portafolio|expediente|carpeta|cuaderno|bit[aá]cora|reporte|dossier|proyecto|secci[oó]n)(?:\s+(?:de\s+trabajo|de\s+evidencias|de\s+memorias|de\s+resultados|t[eé]cnico|integrador|del\s+proyecto(?:\s+PAEC)?))?\.?$/i.test(
      clean
    ) ||
    /^(?:Hoy\s+)?(?:Incluyes?|A[ñn]ades?|Agregas?|Integras?|Incorporas?|Entregas?)\b[^.?!]{4,95}\b(?:el\s+reporte|la\s+memoria|la\s+versi[oó]n|la\s+matriz)\.?$/i.test(
      clean
    )
  ) {
    return true;
  }

  // Locuciones truncadas antes de fórmula o complemento especificador ("...en su forma.", "...de la forma.", "...mediante el método.", "...durante 3.")
  if (
    /\b(?:en\s+(?:su|la)|de\s+la)\s+forma\.?$/i.test(clean) ||
    /\b(?:mediante|con|por|utilizando|empleando|aplicando|usando|por\s+medio\s+del?)\s+(?:el\s+)?m[eé]todo\.?$/i.test(clean) ||
    /\b(?:representa\s+la\s+s[ií]ntesis|constituye\s+una\s+pr[aá]ctica)\.?$/i.test(clean) ||
    /\bno\s+es\s+(?:un|una)\s+(?:mero|mera|simple|solo|sola)\s+[a-záéíóúñ]+\.?$/i.test(clean) ||
    /^[^.?!]{4,60},\s+tambi[eé]n\s+conocid[oa]\s+como\s+[^.?!]{3,45}\.?$/i.test(clean) ||
    /\bentre\s+(?:el|la|un|una)\s+[a-záéíóúñ]{3,24}\.?$/i.test(clean) ||
    /\bque\s+al\s+[a-záéíóúñ]+r\b[^.,;]{1,42}\.?$/i.test(clean) ||
    /\bdurante\s+\d+(?:[.,]\d+)?\.?$/i.test(clean) ||
    /\bdel\s+tama[ñn]o\.?$/i.test(clean) ||
    /\b(?:combinando|integrando|relacionando|conectando|articulando|contrastando|comparando|vinculando)\s+con\s+(?:fluidez|claridad|precisi[oó]n|orden|rigor|seguridad)\.?$/i.test(
      clean
    ) ||
    /^Cuando\s+[^,.;!?]{6,80}\.?$/i.test(clean) ||
    /^Cuando\s+[^,]{4,90},\s+(?:el|la|los|las|un|una|unos|unas|su|sus|tu|tus|este|esta|estos|estas)\s+[a-záéíóúñ]{2,24}(?:\s+[a-záéíóúñ]{2,20}){0,2}\.?$/i.test(
      clean
    ) ||
    (/^¿(?:Comprendo|Entiendo|Identifico|Reconozco)\s+por\s+qu[eé]\s+(?:un|una|el|la|los|las)\s+[^?]{4,60}\?$/i.test(
      clean
    ) &&
      !/\b(?:es|son|tiene|tienen|posee|poseen|requiere|permite|genera|produce|cambia|var[ií]a|cumple|equivale|representa|mide|suma|forma|depende|existe|existen|funciona|ocurre|resulta|sirve|ayuda|necesita|debe|puede)\b/i.test(
        clean.replace(/^¿[^?]+por\s+qu[eé]\s+/i, '')
      ))
  ) {
    return true;
  }

  // Locuciones preposicionales cortadas antes de "de" ("...por medio.", "...a través.", "...en torno.")
  if (/\b(?:por\s+medio|a\s+trav[eé]s|en\s+torno|acerca|debido|junto|frente|respecto)\.?$/i.test(clean)) {
    return true;
  }

  // Ecuación o igualdad anunciada que fue cortada antes de completar el miembro con "=" (ej. "...la ecuación lineal 3(2x - 4)" o "...la ecuación 600x.")
  if (
    /\b(?:ecuaci[oó]n(?:\s+(?:lineal|cuadr[aá]tica|algebraica|polin[oó]mica|fraccionaria|general))?|igualdad(?:\s+algebraica)?|f[oó]rmula)\s+(?:[A-Za-z0-9()²³₀-₉+\-*/·×\s]{1,28})$/i.test(
      withoutTrailingDot
    ) &&
    /(?:\d+[a-zA-Z]|\([^)]*[a-zA-Z0-9][^)]*\))/.test(
      withoutTrailingDot.slice(withoutTrailingDot.search(/\b(?:ecuaci[oó]n|igualdad|f[oó]rmula)\b/i))
    ) &&
    !/=/.test(withoutTrailingDot.slice(withoutTrailingDot.search(/\b(?:ecuaci[oó]n|igualdad|f[oó]rmula)\b/i)))
  ) {
    return true;
  }

  // Cola nominal preposicional incompleta ("...con los fundamentos", "...el tamaño.", "...la primera.", "...hacia el miembro.", "eleva al cuadrado, suma.")
  if (
    /\bcon\s+(?:los|las|el|la)\s+(?:fundamentos|principios|conceptos|criterios|elementos)\.?$/i.test(clean) ||
    /\b(?:el\s+tama[ñn]o|la\s+primera|la\s+segunda|la\s+tercera|el\s+primero|el\s+segundo|hacia\s+el\s+miembro)\.?$/i.test(
      clean
    ) ||
    /,\s*(?:suma|resta|multiplica|divide)\.?$/i.test(clean)
  ) {
    return true;
  }

  // Cláusula subordinada con "cómo" o "si" o "sin verificar que ..." truncada antes de su verbo principal
  // (ej. "Explicar cómo el Teorema de Pitágoras.", "Argumenta si estas secciones.", "sin verificar que la gráfica.")
  // Nota: usar lookahead de delimitador en vez de \b al final de verbos con tilde (está, será, trabajó, ocurrió).
  const finiteVerbRe =
    /(?:^|[\s,(¿¡])(?:es|son|fue|fueron|ser[áa]n?|est[áaé]n?|tiene[ns]?|posee[ns]?|permite[ns]?|garantiza[ns]?|traduce[ns]?|determina[ns]?|modela[ns]?|representa[ns]?|relaciona[ns]?|funciona[ns]?|cambia[ns]?|var[ií]a[ns]?|crece[ns]?|aumenta[ns]?|disminuye[ns]?|sube[ns]?|baja[ns]?|cumple[ns]?|aplica[ns]?|sirve[ns]?|ayuda[ns]?|genera[ns]?|produce[ns]?|forma[ns]?|mide[ns]?|suma[ns]?|difiere[ns]?|coincide[ns]?|detecta[ns]?|trabaj[oó]|ocurri[oó]|se\s+[a-záéíóúñ]{3,}|pueden?|deben?|influye[ns]?|afecta[ns]?|impacta[ns]?|resuelve[ns]?|valida[ns]?|confirma[ns]?|muestra[ns]?|demuestra[ns]?|indica[ns]?|expresa[ns]?|describe[ns]?|corresponde[ns]?|cortan?|cruzan?|intersectan?|son\s+congruentes|[a-záéíóúñ]{3,}(?:aron|ieron|aste|iste|aban|[ií]an|r[ií]as?|r[ií]an?|ando|iendo)|[a-záéíóúñ]{3,}(?:ar|er|ir)(?:lo|la|los|las|se))(?=$|[\s.,;:!?)])/i;
  const comoTail = clean.match(
    /\b(?:explica[rn]?|comprende[rn]?|identifica[rn]?|analiza[rn]?|calcula[rn]?|determina[rn]?|demuestra[ns]?|argumenta[rn]?|describe[ns]?|muestra[ns]?|detalla[rn]?|justifica[rn]?|verifica[rn]?|sabe[rn]?)\s+c[oó]mo\s+([^.?!]{4,75})[.?!]?$/i
  );
  if (comoTail && !finiteVerbRe.test(comoTail[1])) {
    return true;
  }
  const siTail = clean.match(/\bsi\s+(?:el|la|los|las|un|una|est[ea]s?|es[oa]s?|tus?|sus?)\s+([^.?!]{2,55})[.?!]?$/i);
  if (siTail && !finiteVerbRe.test(siTail[1])) {
    return true;
  }
  const sinVerificarQueTail = clean.match(
    /\bsin\s+(?:verificar|comprobar|revisar|validar|confirmar)\s+que\s+(?:el|la|los|las|un|una)\s+([^.?!]{2,45})[.?!]?$/i
  );
  if (sinVerificarQueTail && !finiteVerbRe.test(sinVerificarQueTail[1])) {
    return true;
  }

  // Pista truncada tras "Recuerda que, por definición." (sin cláusula completiva con verbo)
  if (/^(?:Recuerda|Considera|Nota|Ten\s+en\s+cuenta)\s+que\b/i.test(clean) && !finiteVerbRe.test(clean.replace(/^[^,]+que\b/i, ''))) {
    return true;
  }

  return false;
}

export function breaksNumericOrTupleList(prefix: string, suffix: string): boolean {
  if (/(?:\d|\))\s*$/.test(prefix) && /^,\s*(?:\d+|\([^)]*\)|[xyzabcmn]\b)/i.test(suffix)) {
    return true;
  }
  // Proteger enumeraciones etiquetadas ("Equipo A (20 min), Equipo B (25 min)...") y aposiciones con predicado ("y los postes, colocados cada 2.5 metros, cuestan 350 pesos")
  if (
    /\)\s*$/.test(prefix) &&
    /^(?:,\s*(?:Equipo|Mezcla|Muestra|Caso|Opci[oó]n|Grupo|Lote|Modelo)\s+[A-Z0-9]|,\s*donde\b|\s+(?:cuestan|cuesta|valen|vale|miden|mide|tienen|tiene|pesan|pesa|duran|dura|se\s+[a-záéíóúñ]{3,}))/i.test(
      suffix
    )
  ) {
    return true;
  }
  // Nunca cortar inmediatamente antes de una aposición entre comas cuyo predicado sigue después (", colocados..., cuestan...")
  if (
    /\b(?:y|e)\s+(?:el|la|los|las)\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{3,}\s*$/i.test(prefix) &&
    /^,\s*[^.?!]{3,55},\s*(?:cuestan|cuesta|valen|vale|miden|mide|tienen|tiene|son|es|est[aá]n?|requieren|permiten)/i.test(
      suffix
    )
  ) {
    return true;
  }
  // Nunca cortar inmediatamente después de un número si el sufijo comienza con su unidad o sustantivo contado
  if (
    /\b\d+(?:[.,/]\d+)?\s*$/.test(prefix) &&
    /^\s*(?:cm³|cm²|m³|m²|mm|cm|km|m|kg\/cm²|kg\/m³|kg\/m²|g\/cm³|g\/ml|g\/mL|mg\/L|mg\/l|L\/s|l\/s|MB\/s|cal\/g|J\/kg|m\/s|km\/h|kg|mg|g|mL|ml|L|l|pies?|pulgadas?|litros?|mililitros?|miligramos?|gramos?|kilogramos?|galones?|calor[ií]as?|joules?|atm[oó]sferas?|atm|mmHg|ppm|metros?|cent[ií]metros?|mil[ií]metros?|pesos|horas?|minutos?|min|segundos?|seg|a[ñn]os?|d[ií]as?|meses?|rollos?|redes?|postes?|kits?|l[aá]mparas?|piezas?|varillas?|cajas?|bloques?|codos?|v[aá]lvulas?|equipos?|viajes?|grados?|°C|°F|°|W|V|GB|TB|Hz|Ω|%|por\s+(?:litro|gramo|segundo|minuto|kilogramo|metro|ciento)|de\s+pulgada)\b/i.test(
      suffix
    )
  ) {
    return true;
  }
  return false;
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

    // Buscar el último separador de cláusula (, ; :) después del caracter 25 sin cortar listas numéricas (x = 1, 3 y 5)
    const clauseMatch = withoutDot.match(/^(.{25,})([,;:])\s+([^,;:]{1,45})$/);
    if (
      clauseMatch &&
      !hasDanglingEnding(clauseMatch[1]) &&
      !(clauseMatch[2] === ',' && breaksNumericOrTupleList(clauseMatch[1], `, ${clauseMatch[3]}`))
    ) {
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

export function ensureTerminalPunctuation(text: string, ensurePeriod: boolean): string {
  const clean = text
    .replace(/\?(['"»”’)\]]+)\?/g, '?$1')
    .replace(/\.,/g, ',')
    .replace(/,\./g, '.')
    .replace(/;\./g, '.')
    .replace(/\.{2}(?!\.)/g, '.')
    .replace(/[,;:\s]+$/, '')
    .trim();
  if (!clean) return '';
  if (!ensurePeriod) return clean;
  if (/[.?!]['"»”’)\]]*$/.test(clean)) return clean;
  return `${clean}.`;
}


const PUBLISHABLE_UNIT_PAIR_RE =
  /\b(\d+(?:[.,/]\d+)?)\s+(cm³|cm²|m³|m²|mm|cm|km|m|kg\/cm²|kg\/m³|kg\/m²|g\/cm³|g\/ml|g\/mL|mg\/L|mg\/l|L\/s|l\/s|MB\/s|cal\/g|J\/kg|m\/s|km\/h|kg|mg|g|mL|ml|L|l|pies?|pulgadas?|litros?|mililitros?|miligramos?|gramos?|kilogramos?|galones?|calor[ií]as?|joules?|atm[oó]sferas?|atm|mmHg|ppm|metros?|cent[ií]metros?|mil[ií]metros?|pesos|horas?|minutos?|min|segundos?|seg|a[ñn]os?|d[ií]as?|meses?|rollos?|redes?|postes?|kits?|l[aá]mparas?|piezas?|varillas?|cajas?|bloques?|codos?|v[aá]lvulas?|equipos?|viajes?|grados?|°C|°F|°|W|V|GB|TB|Hz|Ω|%)\b/gi;

const PUBLISHABLE_ACTIVITY_TASK_RE =
  /\?|\b(?:calcula|determina|encuentra|halla|resuelve|soluciona|plantea|formula|escribe|redacta|prepara|elabora|integra|organiza|audita|revisa|verifica|comprueba|justifica|identifica|estima|proyecta|dise[ñn]a|aplica|eval[uú]a|compara|analiza|explica|construye|crea|consolida|completa|obt[eé]n|usa|utiliza|aseg[uú]rate|tabula|grafica|clasifica|ordena|registra|sustituye|despeja|simplifica|factoriza|demuestra|argumenta|describe|selecciona|prop[oó]n|corrige|presenta|defiende|exp[oó]n|convierte|contrasta|relaciona|traza|responde|dibuja|marca|se[ñn]ala|diagnostica|instala|configura|actualiza|reemplaza|conecta|mide|documenta|ejecuta|prueba|repara|limpia|inspecciona|traduce|conjuga|subraya|elige|contesta|investiga|debate|valora|concluye|enumera|enlista|ejemplifica|empareja|observa|anota|lee|reescribe|presupuesta|estiba|acota|efect[uú]a|fija|a[ií]sla|simula)\b/i;

export const GENERIC_FILLER_RE =
  /(?:Aplica\s+el\s+procedimiento\s+estudiado|Registra\s+tu\s+procedimiento\s+y\s+comprueba\s+la\s+respuesta|desarrolla\s+el\s+an[aá]lisis\s+y\s+justifica\s+tu\s+respuesta)/i;

export const NODE_TRUNCATION_RE =
  /(?:\b(?:al\s+estar|debe\s+ser|por\s+exceder|no\s+alcanza|reales\s+vs|vs|por\s+parte|que\s+comunica|que\s+utiliza|que\s+permite[n]?\s+trasladar|que\s+las\s+l[ií]neas|que\s+las\s+aristas|adecuado\s+ya|est[aá]\s+correctamente|sistematiza|como\s+cuarto|entre\s+temperatura|por\s+qu[eé]\s+el\s+valor|ayuda\s+a\s+entender|y\s+piensa|en\s+forma|y\s+une|y\s+documenta|formula|valora|conforme|incorpora|mide)\s*\.?$|\b(?:conector|cable|puerto|ranura|m[oó]dulo|disco|voltaje|corriente|radio|di[aá]metro|altura|ancho|largo|espesor|longitud|distancia|masa|volumen|peso|temperatura|presi[oó]n|cada)\s+(?:de\s+)?\d+(?:[.,]\d+)?\s*\.$|\blim\s*\([^)]+\)\s*\.?$)/i;

function normalizeForSourceCheck(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Determina si `candidate` es un corte a media oración de `source` (prefijo de una oración
 * que en `source` continúa con más palabras sin límite real de oración).
 * Acepta selección de oraciones completas de `source`, pero rechaza cualquier amputación intra-oración.
 */
export function isTruncatedAgainstSource(candidate: string, source: string): boolean {
  const candTrim = (candidate || '').replace(/\s+/g, ' ').trim();
  const srcTrim = (source || '').replace(/\s+/g, ' ').trim();
  if (!candTrim || !srcTrim) return false;

  if (NODE_TRUNCATION_RE.test(candTrim)) return true;

  const candSentences = splitSpanishSentences(candTrim);
  const srcSentences = splitSpanishSentences(srcTrim);
  const lastCand = candSentences[candSentences.length - 1] ?? candTrim;
  const lastCandNorm = normalizeForSourceCheck(lastCand);
  if (!lastCandNorm || lastCandNorm.length < 12) return false;

  for (const srcSent of srcSentences) {
    const srcNorm = normalizeForSourceCheck(srcSent);
    if (!srcNorm || srcNorm === lastCandNorm) continue;
    if (srcNorm.startsWith(`${lastCandNorm} `) && srcNorm.length > lastCandNorm.length + 4) {
      // Permitir únicamente cuando el corte en la fuente original estaba en una frontera
      // autónoma de punto y coma o guion largo, no a mitad de cláusula.
      const escapedTail = lastCandNorm.split(' ').slice(-2).join('\\s+');
      const boundaryInSrc = new RegExp(`${escapedTail}\\s*(?:;|—|–)`, 'i');
      const srcNormNoAccents = srcSent
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      if (!boundaryInSrc.test(srcNormNoAccents)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Validador único SSoT de publicabilidad para texto pedagógico en 08_Presentaciones y 09_Infografías.
 * Rechaza truncamientos, relleno genérico, pérdida de unidades numéricas, etiquetas huérfanas y consignas mutiladas.
 */
export const TERMINAL_DANGLING_RE =
  /(?:(?:^|\s)(?:a|al|de|del|con|en|para|por|que|y|o|e|u|la|el|los|las|un|una|unos|unas|cualquier|seg[uú]n|sobre|entre|hacia|desde|hasta|ser|estar)\s*\.?$|\bde\s+forma\.?$|,\s*$)/i;

export function isPublishablePedagogicalText(
  raw: string | null | undefined,
  role: 'activity' | 'problem' | 'concept' | 'hint' | 'infographic' | 'application' | 'step' | 'conclusion',
  source?: string | null
): boolean {
  const clean = (raw || '').replace(/\s+/g, ' ').trim();
  const minLenByRole: Record<typeof role, number> = {
    activity: 24,
    problem: 20,
    concept: 16,
    hint: 14,
    infographic: 14,
    application: 24,
    step: 10,
    conclusion: 12,
  };
  if (!clean || clean.length < minLenByRole[role]) return false;
  if (GENERIC_FILLER_RE.test(clean)) return false;
  if (NODE_TRUNCATION_RE.test(clean)) return false;
  const isLegitimateTerminalWord =
    /\bcada\s+(?:uno|una)\.?\s*$/i.test(clean) ||
    /\b(?:canal|punto|eje|variable|inc[oó]gnita|valor\s+de|funci[oó]n\s+de|respecto\s+a|para)\s+[A-Za-z]\.?\s*$/i.test(clean) ||
    /[=+\-*/÷×]\s*[xyXYaAbBcC]\.?\s*$/.test(clean);
  if (TERMINAL_DANGLING_RE.test(clean) && !isLegitimateTerminalWord) return false;
  if (/(?:\.\.\.|…|[:,;])\s*$/.test(clean)) return false;
  if (hasDanglingEnding(clean)) return false;
  if (/^[FCRPDEISBT]\s+[¿¡]/.test(clean) || /^\d{1,2}$/.test(clean)) return false;
  if (/^¿(?:Alguna\s+vez|Logr[eé]|Puedo|He\s+integrado)\b[^?]*$/i.test(clean)) return false;
  if (role === 'activity' && !PUBLISHABLE_ACTIVITY_TASK_RE.test(clean)) return false;

  if (source) {
    const srcClean = source.replace(/\s+/g, ' ').trim();
    if (isTruncatedAgainstSource(clean, srcClean)) return false;
    if (/[=≤≥]/.test(srcClean) && !/[=≤≥]/.test(clean) && (role === 'activity' || role === 'problem' || role === 'step')) {
      return false;
    }
    // En pasos o problemas con varias restricciones (ej. "40x + 60y ≤ 1200 y x + y ≤ 25"), no amputar la segunda inecuación
    if (role === 'step' || role === 'problem') {
      const srcRelCount = (srcClean.match(/[=≤≥]/g) ?? []).length;
      const cleanRelCount = (clean.match(/[=≤≥]/g) ?? []).length;
      if (srcRelCount >= 2 && cleanRelCount < 2) return false;
    }
    // En actividades y problemas, no perder datos numéricos esenciales de la fuente (ej. costos, medidas, equipos)
    if (role === 'activity' || role === 'problem') {
      const extractNums = (s: string) =>
        [...new Set((s.match(/\d+(?:[.,/]\d+)?/g) ?? []).map((n) => n.replace(/,/g, '')))];
      const srcNums = extractNums(srcClean);
      if (srcNums.length > 0 && srcNums.length <= 6) {
        const cleanNums = new Set(extractNums(clean));
        if (srcNums.some((n) => !cleanNums.has(n))) return false;
      }
      // No descartar citas textuales en inglés/español cuando la actividad gira en torno a esa cita
      if (/['"«][^'"»]{12,}['"»]/.test(srcClean) && !/['"«][^'"»]{8,}['"»]/.test(clean)) {
        return false;
      }
    }
    // Verificar que ningún par "<número> <unidad>" de la fuente haya quedado huérfano sin unidad ("80 cm³" → "80.")
    const srcUnitPairs = [...srcClean.matchAll(PUBLISHABLE_UNIT_PAIR_RE)];
    for (const pair of srcUnitPairs) {
      const num = pair[1]!;
      const escapedNum = num.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const bareAtSentenceEnd = new RegExp(`\\b${escapedNum}\\s*[.?!](?:\\s|$)`).test(clean);
      if (bareAtSentenceEnd) {
        const stillHasUnit = new RegExp(`\\b${escapedNum}\\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ%°/]`).test(clean);
        if (!stillHasUnit) return false;
      }
    }
  }

  return true;
}
