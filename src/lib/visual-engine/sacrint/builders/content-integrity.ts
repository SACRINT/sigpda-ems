import {
  GENERIC_FILLER_RE,
  NODE_TRUNCATION_RE,
} from '@/lib/editorial/fitter/dangling-guards';
import { GENERIC_TITLE_BLACKLIST_RE } from '@/lib/editorial/topic-title-resolver';
import type {
  ConceptFamily,
  SacrintDeckSpec,
  SacrintDiagramSpec,
  SacrintInfographicSpec,
} from '../types';
import {
  GENERIC_CONCLUSION_RE,
  NUMERIC_ONLY_STEP_RE,
  TEMPLATE_PHRASE_RE,
} from '../text/grammar-normalization';
import {
  normalizeLearningObjective,
  validatePracticeActivity,
} from '../text/objective-and-activity-guards';

function normalizeConceptFamilyText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function conceptFamily(text: string): ConceptFamily {
  const t = normalizeConceptFamilyText(text);
  if (
    /pitagor|hipotenusa|cateto|triangulo\s+rectangulo|c\s*(?:\u00B2|\^?2)\s*=\s*a\s*(?:\u00B2|\^?2)\s*\+\s*b|c\s*(?:\u00B2|\^?2)\s*=/.test(
      t
    )
  ) {
    return 'pythagoras';
  }
  if (/congruen|semejan|\blll\b|\blal\b|\bala\b/.test(t)) return 'congruence';
  if (/\bangulos?\b|complement|suplement|paralel|transversal|grados|\u00B0/.test(t)) return 'angles';
  if (/geometria|perimetro|area|superficie|rectangulo|triangulo|poligono/.test(t)) return 'area-perimeter';
  if (/interes\s+(?:simple|compuesto)|exponencial|capitalizacion|crecimiento\s+poblacional|tasa\s+(?:anual|compuesta|de\s+crecimiento)/.test(t)) return 'exponential';
  if (/ecuacion\s+lineal|pendiente|interseccion|recta/.test(t)) return 'linear';
  if (/cuadratica|parabola|vertice|raices/.test(t)) return 'quadratic';
  if (/estadistica|muestra|poblacion|frecuencia|media|mediana|moda/.test(t)) return 'statistics';
  return 'other';
}

export function neutralizeAngleCongruenceTerms<T>(value: T): T {
  if (typeof value === 'string') {
    return value
      .replace(/\(\s*LLL\s*,\s*LAL\s+o\s+ALA\s*\)/gi, '(relación angular)')
      .replace(/LLL\s*(?:↔|->|—|-)\s*LAL\s*(?:↔|->|—|-)\s*ALA/gi, 'relaciones angulares')
      .replace(/Lado[-\s]?[ÁA]ngulo[-\s]?[Ll]ado\s*\(LAL\)/g, 'relación angular')
      .replace(/\b(?:LLL|LAL|ALA)\b/g, 'relación angular') as T;
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index++) {
      value[index] = neutralizeAngleCongruenceTerms(value[index]);
    }
    return value;
  }
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value as Record<string, unknown>)) {
      (value as Record<string, unknown>)[key] = neutralizeAngleCongruenceTerms(
        (value as Record<string, unknown>)[key]
      );
    }
  }
  return value;
}

function normalizeMisconceptionComparable(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function isWeakMisconceptionText(error: string, title: string): boolean {
  const normalizedError = normalizeMisconceptionComparable(error);
  const normalizedTitle = normalizeMisconceptionComparable(title);
  if (!normalizedError) return true;
  if (
    normalizedError === normalizedTitle ||
    normalizedTitle.includes(normalizedError) ||
    (normalizedError.includes(normalizedTitle) &&
      normalizedError.length < normalizedTitle.length + 12)
  ) {
    return true;
  }
  if (normalizedError.length < 35) return true;
  return !/(confund|creer|pensar|supon|asum|sum|rest|aplic|igual|omit|interpret|us|multiplic|divid|resol|generaliz|invert|mezcl|olvid|ignor|medir|calcul|eleg|seleccion|compar|despej|sustitu|simplific|traslad|juzg|codific|valid|cit|contextualiz|descontextualiz|atribu|copi|plagi|reduc|separ|aisl|memoriz|repet|acept|rechaz|descuid|salt|ejecut|escrib|redact|le|argument|conclu|afirm|neg|contradec|traz|dibuj|calibr|manipul|conect|configur|program|iter|declar|evalu|estim|aproxim|redonde|convert|transform|orden|clasific|distingu|relacion|vincul|justific|respald|comprob|verific|vaci|vert|retir|desinfect|esteriliz|exced|incumpl|alter|contamin|emple|coloc|presion|recort|mont|almacen|hidrat|deshidrat|fractur|deform|desajust|sobrecalent|subestim|sobreestim|trunc|extrapol|interpol|reemplaz|no\s+[a-z0-9]{3,}|sin\s+(?:verificar|comprobar|validar|contextualizar|respaldar|citar|justificar|revisar|considerar|evaluar|definir|aislar|contrastar))/.test(
    normalizedError
  );
}

const MISCONCEPTION_VARIANTS: Record<string, string[]> = {
  'cometer error de signo al despejar y': [
    'Cometer error de signo al despejar la incógnita y.',
    'Invertir el signo de y al despejar la variable.',
    'Olvidar el signo negativo al despejar la variable y.',
    'Cambiar el signo de y sin justificar la operación.',
    'Despejar y con el signo contrario al original.',
    'Omitir el cambio de signo al dividir entre un coeficiente negativo.',
    'Trasladar un término con y sin invertir su signo algebraico.',
    'Perder el signo negativo del coeficiente al aislar la incógnita.',
  ],
  'interpretar una medida de tendencia central como si describiera': [
    'Interpretar la media como si describiera todos los datos sin dispersión.',
    'Usar la media como si describiera por sí sola todos los datos.',
    'Interpretar una medida central sin revisar la dispersión.',
    'Suponer que la media representa cada dato individual del conjunto.',
    'Leer la tendencia central sin considerar los valores extremos.',
    'Omitir el rango y la desviación al interpretar el promedio.',
    'Concluir sobre la muestra usando solo la media sin ver su variabilidad.',
    'Ignorar el efecto de datos atípicos sobre el promedio aritmético.',
  ],
  'factorizar o despejar sin igualar antes a cero': [
    'Factorizar o despejar sin igualar antes la ecuación a cero.',
    'Factorizar sin llevar primero la ecuación cuadrática a cero.',
    'Despejar sin igualar a cero antes de factorizar el trinomio.',
    'Omitir la forma general igualada a cero antes de factorizar.',
    'Resolver por factores sin igualar previamente la expresión a cero.',
    'Separar factores cuando el segundo miembro aún no es cero.',
    'Aplicar la propiedad del producto nulo sin igualar antes a cero.',
    'Intentar factorizar el polinomio con términos sueltos del otro lado.',
  ],
  'sumar un incremento fijo en lugar de factor exponencial': [
    'Sumar un incremento fijo en lugar de aplicar el factor exponencial.',
    'Modelar un crecimiento exponencial como si fuera una suma fija.',
    'Sumar una cantidad constante en vez de multiplicar por la tasa.',
    'Confundir el incremento lineal aditivo con el factor exponencial.',
    'Tratar el cambio porcentual compuesto como una diferencia constante.',
    'Aplicar una tasa compuesta como si fuera un aumento lineal fijo.',
    'Multiplicar la tasa por el tiempo en vez de elevar el factor base.',
    'Reemplazar la potencia del periodo por una suma acumulativa simple.',
  ],
  'asumir congruencia sin comprobar criterio ni orden angular': [
    'Asumir congruencia sin comprobar el criterio ni el orden angular.',
    'Afirmar congruencia sin verificar lados y ángulos correspondientes.',
    'Suponer figuras congruentes sin aplicar LLL, LAL o ALA.',
    'Declarar congruencia sin revisar el orden de los ángulos homólogos.',
    'Comparar triángulos sin comprobar la correspondencia de sus lados.',
    'Usar dos lados y un ángulo no comprendido como si fuera criterio LAL.',
    'Confundir la igualdad visual con una demostración por LLL, LAL o ALA.',
    'Emparejar vértices no homólogos al plantear la congruencia triangular.',
  ],
  'elegir una incognita distinta a la magnitud preguntada': [
    'Elegir una incógnita distinta a la magnitud preguntada.',
    'Elegir una variable que no representa la magnitud solicitada.',
    'Definir la incógnita con una magnitud distinta a la pregunta.',
    'Asignar la variable principal a un dato que no se busca.',
    'Confundir la incógnita buscada con una cantidad ya conocida.',
    'Plantear la ecuación despejando una variable ajena a la pregunta.',
    'Responder con el valor auxiliar sin calcular la magnitud pedida.',
    'Omitir la definición explícita de qué magnitud representa la variable.',
  ],
  'multiplicar solo un termino al igualar coeficientes': [
    'Multiplicar solo un término al igualar coeficientes del sistema.',
    'Multiplicar solo una parte de la ecuación al igualar coeficientes.',
    'Aplicar el factor a un solo término en lugar de toda la ecuación.',
    'Ajustar un coeficiente sin multiplicar el término independiente.',
    'Igualar coeficientes dejando el segundo miembro sin escalar.',
    'Amplificar la incógnita a eliminar olvidando multiplicar el resto.',
    'Alterar el balance de la ecuación al escalar solo el primer término.',
    'Omitir el factor multiplicador en la constante del lado derecho.',
  ],
  'aplicar una regla sin comprobar las condiciones especificas': [
    'Aplicar una regla sin comprobar las condiciones específicas del caso.',
    'Aplicar el procedimiento sin revisar las condiciones del problema.',
    'Usar una regla general sin validar que corresponda al planteamiento.',
    'Resolver sin comprobar las condiciones específicas de los datos.',
    'Elegir una fórmula sin verificar las restricciones del contexto.',
    'Sustituir datos en la expresión sin validar unidades ni supuestos.',
    'Operar mecánicamente sin contrastar si el modelo aplica al caso.',
    'Omitir la verificación de condiciones iniciales antes de calcular.',
  ],
  'sumar constantes sueltas con coeficientes': [
    'Sumar constantes sueltas con coeficientes de x como términos semejantes.',
    'Agrupar el término independiente con el coeficiente de la variable x.',
    'Reducir términos con variable junto con constantes numéricas sueltas.',
    'Combinar números independientes y coeficientes de x en un solo término.',
    'Tratar una constante sin variable como si fuera un término con x.',
    'Operar el coeficiente de la incógnita directamente con el término fijo.',
    'Mezclar términos algebraicos en x con constantes al simplificar.',
    'Ignorar la literal x al sumar los términos de un mismo miembro.',
  ],
  'sustituir el despeje en la misma ecuacion': [
    'Sustituir el despeje en la misma ecuación de donde salió (0 = 0).',
    'Reemplazar la incógnita despejada en la misma ecuación de origen.',
    'Sustituir la expresión aislada en la ecuación inicial en vez de la otra.',
    'Usar la misma ecuación para despejar y sustituir, llegando a 0 = 0.',
    'Omitir la segunda ecuación del sistema al momento de sustituir.',
    'Evaluar el despeje en la ecuación ya usada en lugar de la complementaria.',
    'Ciclar el despeje en una sola ecuación sin vincular la segunda.',
    'Obtener una identidad trivial por sustituir en la ecuación de partida.',
  ],
  'confundir un cateto con la hipotenusa': [
    'Confundir un cateto con la hipotenusa al aplicar Pitágoras.',
    'Sustituir la hipotenusa como si fuera uno de los catetos perpendiculares.',
    'Asignar la etiqueta c a un lado que forma el ángulo recto de 90°.',
    'Sumar la hipotenusa al cuadrado con un cateto en lugar de despejarla.',
    'Elegir el lado mayor como cateto sin ubicar primero el ángulo recto.',
    'Despejar un cateto sumando cuadrados en vez de restar a la hipotenusa.',
    'Aplicar c² = a² + b² sin identificar qué lado se opone a los 90°.',
    'Tomar la diagonal como cateto al plantear la relación pitagórica.',
  ],
  'igualar terminos no semejantes o invertir el despeje': [
    'Igualar términos no semejantes o invertir la operación al despejar.',
    'Transponer un término al otro miembro sin aplicar la operación inversa.',
    'Pasar un término sumando al otro lado conservando el mismo signo.',
    'Dividir antes de haber agrupado todos los términos independientes.',
    'Despejar el coeficiente restándolo en vez de dividir ambos miembros.',
    'Agrupar términos de distinto grado o naturaleza en el mismo miembro.',
    'Invertir numerador y denominador al despejar el coeficiente de x.',
    'Aplicar operaciones distintas en cada miembro y romper la igualdad.',
  ],
  'sumar angulos complementarios como si fueran suplementarios': [
    'Sumar ángulos complementarios a 180° en lugar de igualarlos a 90°.',
    'Confundir un par complementario (90°) con uno suplementario (180°).',
    'Igualar a 90° dos ángulos que forman un par lineal sobre una recta.',
    'Suponer que dos ángulos son iguales sin verificar si son opuestos.',
    'Aplicar suma de 180° a ángulos agudos que forman una esquina recta.',
    'No distinguir entre ángulos suplementarios y opuestos por el vértice.',
    'Plantear la ecuación angular sin identificar si el par suma 90° o 180°.',
    'Igualar ángulos adyacentes suplementarios como si tuvieran igual medida.',
  ],
  'sumar angulos suplementarios como si sumaran 90': [
    'Sumar ángulos suplementarios como si sumaran 90° en vez de 180°.',
    'Plantear 90° para un par lineal que debe sumar 180° sobre la recta.',
    'Confundir ángulos adyacentes sobre una recta con un ángulo recto.',
    'Asumir congruencia en ángulos colaterales que en realidad suman 180°.',
    'Omitir que los ángulos internos de un triángulo siempre suman 180°.',
    'Tratar ángulos alternos internos como suplementarios en rectas paralelas.',
    'Restar a 90° un ángulo obtuso que forma par suplementario de 180°.',
    'Mezclar la relación de ángulos opuestos al vértice con la de 90°.',
  ],
};

const NEUTRAL_MISCONCEPTION_VARIANTS = [
  'Aplicar un criterio sin comprobar las condiciones específicas del caso.',
  'Concluir sin contrastar las evidencias con el contexto de la sesión.',
  'Generalizar una observación aislada sin verificar fuentes ni criterios.',
  'Omitir la revisión crítica de supuestos antes de formular la respuesta.',
  'Responder de manera intuitiva sin justificar el criterio disciplinar.',
  'Separar el análisis del contexto real en que ocurre la situación.',
];

export function diversifyRepeatedMisconception(
  error: string,
  sessionNumber: number,
  emitCounts: Map<string, number>,
  isQuantitative = true
): string {
  const normalized = normalizeMisconceptionComparable(error);
  const key =
    normalized in MISCONCEPTION_VARIANTS
      ? normalized
      : Object.keys(MISCONCEPTION_VARIANTS).find(
          (candidate) => normalized.includes(candidate) || candidate.includes(normalized)
        );
  const variants = key ? MISCONCEPTION_VARIANTS[key] : undefined;
  if (!variants || variants.length === 0) {
    const count = emitCounts.get(normalized) ?? 0;
    if (count < 2) {
      emitCounts.set(normalized, count + 1);
      return error;
    }
    const fallbackPool = isQuantitative
      ? MISCONCEPTION_VARIANTS['aplicar una regla sin comprobar las condiciones especificas'] ??
        NEUTRAL_MISCONCEPTION_VARIANTS
      : NEUTRAL_MISCONCEPTION_VARIANTS;
    for (const candidate of fallbackPool) {
      const cKey = normalizeMisconceptionComparable(candidate);
      const cCount = emitCounts.get(cKey) ?? 0;
      if (cCount < 2) {
        emitCounts.set(cKey, cCount + 1);
        return candidate;
      }
    }
    return error;
  }
  const startIndex = Math.abs(Math.trunc(sessionNumber) - 1) % variants.length;
  for (let offset = 0; offset < variants.length; offset++) {
    const candidate = variants[(startIndex + offset) % variants.length]!;
    const cKey = normalizeMisconceptionComparable(candidate);
    const cCount = emitCounts.get(cKey) ?? 0;
    if (cCount < 2) {
      emitCounts.set(cKey, cCount + 1);
      return candidate;
    }
  }
  return variants[startIndex] ?? error;
}

function stripMisconceptionTitlePrefix(error: string, title: string): string {
  const cleaned = error.trim();
  if (!cleaned) return cleaned;
  const colonIndex = cleaned.indexOf(':');
  if (colonIndex > 0 && colonIndex <= 80) {
    const prefix = cleaned.slice(0, colonIndex).trim();
    if (
      title.toLowerCase().includes(prefix.toLowerCase()) ||
      isWeakMisconceptionText(prefix, title)
    ) {
      return cleaned.slice(colonIndex + 1).trim();
    }
  }
  const normalizedTitle = normalizeMisconceptionComparable(title);
  const normalizedError = normalizeMisconceptionComparable(cleaned);
  if (normalizedTitle && normalizedError.startsWith(`${normalizedTitle} `)) {
    return cleaned.slice(title.length).replace(/^[\s:;\-–—]+/, '').trim();
  }
  return cleaned;
}

export function defaultMisconceptionForTitle(
  title: string,
  isQuantitative = true
): { error: string; correction: string } {
  const family = conceptFamily(title);
  if (family === 'angles') {
    return {
      error: 'Sumar ángulos complementarios como si fueran suplementarios o ignorar el tipo de par.',
      correction:
        'Identifica si el par es complementario (90°), suplementario (180°) u opuesto por el vértice (iguales) antes de operar.',
    };
  }
  if (family === 'pythagoras') {
    return {
      error: 'Confundir un cateto con la hipotenusa al aplicar el teorema de Pitágoras.',
      correction: 'Ubica el ángulo recto, identifica la hipotenusa y despeja c² = a² + b² con las medidas correctas.',
    };
  }
  if (family === 'congruence') {
    return {
      error: 'Afirmar que dos figuras son congruentes sin verificar lados y ángulos correspondientes.',
      correction: 'Justifica la congruencia con un criterio LLL, LAL o ALA antes de concluir o calcular medidas.',
    };
  }
  if (family === 'linear') {
    return {
      error: 'Igualar términos no semejantes o invertir el despeje al resolver la ecuación lineal.',
      correction: 'Agrupa términos semejantes, aplica la misma operación en ambos miembros y comprueba sustituyendo el valor.',
    };
  }
  if (family === 'quadratic') {
    return {
      error: 'Aplicar la fórmula cuadrática sin ordenar la ecuación o perder una de las raíces.',
      correction: 'Ordena la ecuación como ax² + bx + c = 0, sustituye con signos completos y verifica ambas raíces.',
    };
  }
  if (family === 'area-perimeter') {
    return {
      error: 'Confundir perímetro con área o aplicar una fórmula geométrica sin verificar las unidades de la figura.',
      correction: 'Identifica si calculas contorno (longitud) o superficie (unidades cuadradas) y verifica base y altura.',
    };
  }
  if (family === 'exponential') {
    return {
      error: 'Sumar un incremento fijo en lugar de aplicar el factor exponencial compuesto en cada periodo.',
      correction: 'Multiplica por el factor (1 + r)ᵗ sobre el total vigente de cada periodo y verifica la tasa en decimal.',
    };
  }
  if (family === 'statistics') {
    return {
      error: 'Interpretar una medida de tendencia central como si describiera todos los datos.',
      correction: 'Contrasta la media con la dispersión y con los valores extremos antes de concluir.',
    };
  }
  if (!isQuantitative) {
    return {
      error: 'Aplicar un criterio sin comprobar las condiciones específicas del caso.',
      correction: 'Contrasta evidencias, contexto y criterios de la sesión antes de formular tu conclusión.',
    };
  }
  return {
    error: 'Aplicar una regla sin comprobar las condiciones específicas del problema.',
    correction: 'Identifica datos, condiciones y unidades; verifica que la regla elegida sea aplicable antes de operar.',
  };
}

export function alignMisconceptionWithTitle(
  title: string,
  parts: { error: string; correction: string },
  isQuantitative = true
): { error: string; correction: string } {
  const errorText = stripMisconceptionTitlePrefix(parts.error, title);
  if (isWeakMisconceptionText(errorText, title)) {
    return defaultMisconceptionForTitle(title, isQuantitative);
  }
  const family = conceptFamily(title);
  const fullMisconception = `${errorText} ${parts.correction}`;
  const errorHasCongruence = /\b(?:lll|lal|ala)\b|congruen|semejan/i.test(errorText);
  const hasCongruence = /\b(?:lll|lal|ala)\b|congruen|semejan/i.test(fullMisconception);
  const hasAngles = /angul|complement|suplement|opuestos?\s+por\s+el\s+v[eé]rtice|par\s+lineal/i.test(
    fullMisconception
  );
  const hasPythagoras = /pit[aá]goras|hipotenusa|cateto|c\s*(?:\u00B2|\^?2)\s*=/i.test(
    fullMisconception
  );
  const hasStatistics = /muestra\s+sesgada|tama[ñn]o\s+muestral|margen\s+de\s+error|tendencia\s+central|frecuencia|media\s+aritm[eé]tica|dispersi[oó]n/i.test(
    fullMisconception
  );
  const hasExponential = /factor\s+exponencial|inter[eé]s\s+compuesto|capitalizaci[oó]n|P₀\s*\(1\s*\+\s*r\)/i.test(
    fullMisconception
  );
  if (family === 'angles' && (errorHasCongruence || (hasCongruence && !hasAngles))) {
    return {
      error: 'Sumar ángulos suplementarios como si sumaran 90° o no distinguir el tipo de par.',
      correction:
        'Verifica primero si el par es complementario (90°), suplementario (180°) u opuesto por el vértice (iguales).',
    };
  }
  if (family === 'pythagoras' && hasCongruence && !hasPythagoras) {
    return {
      error: 'Confundir un cateto con la hipotenusa del triángulo rectángulo.',
      correction: 'Identifica el ángulo recto y aplica c² = a² + b² con la hipotenusa despejada.',
    };
  }
  if (family === 'congruence' && hasPythagoras && !hasCongruence) {
    return {
      error: 'Aplicar una relación métrica sin comprobar la correspondencia entre figuras.',
      correction: 'Justifica la congruencia o semejanza con LLL, LAL o ALA antes de calcular medidas.',
    };
  }
  // Rechazar contaminación cruzada de ramas (ej. error de Estadística en Geometría plana o Álgebra)
  if (family !== 'statistics' && family !== 'other' && hasStatistics) {
    return defaultMisconceptionForTitle(title, isQuantitative);
  }
  if (
    (family === 'area-perimeter' || family === 'angles' || family === 'pythagoras' || family === 'congruence') &&
    hasExponential
  ) {
    return defaultMisconceptionForTitle(title, isQuantitative);
  }
  return { error: errorText, correction: parts.correction };
}

function isFormulaPartCoherentWithTitle(title: string, part: string): boolean {
  const titleFamily = conceptFamily(title);
  const partFamily = conceptFamily(part);
  if (titleFamily === 'other' || partFamily === 'other' || partFamily === titleFamily) return true;
  if (
    (titleFamily === 'angles' && partFamily === 'pythagoras') ||
    (titleFamily === 'pythagoras' && partFamily === 'angles')
  ) {
    return /pitagor|hipotenusa|cateto|triangulo\s+rectangulo/.test(
      normalizeConceptFamilyText(title)
    );
  }
  return false;
}

export function isFormulaCoherentWithTitle(title: string, formula: string): boolean {
  if (!formula.trim()) return false;
  return formula
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean)
    .some((part) => isFormulaPartCoherentWithTitle(title, part));
}

export function selectCoherentFormula(title: string, candidates: string[]): string {
  for (const candidate of candidates) {
    if (!candidate.trim()) continue;
    const coherentParts = candidate
      .split('|')
      .map((value) => value.trim())
      .filter(Boolean)
      .filter((value) => isFormulaPartCoherentWithTitle(title, value));
    if (coherentParts.length > 0) return coherentParts.join(' | ');
  }
  return '';
}

export const OBJECTIVE_CENTER_VERB_RE =
  /^(?:Comprendes|Analizas|Dise[ñn]as|Eval[uú]as|Elaboras|Identificas|Aplicas|Construyes|Utilizas|Sistematizas|Dominas|Implementas|Integras|Exploras|Formulas|Calculas|Resuelves|Modelas|Reconoces|Interpretas|Verificas|Comparas|Clasificas|Determinas|Aprendes\s+a)\b/i;

export function collectDiagramIntegrityIssues(
  diagram: SacrintDiagramSpec | undefined,
  prefix: string,
  issues: string[]
): void {
  if (!diagram || !diagram.available) return;
  const checkNode = (label: string, detail: string | undefined, isCenter = false) => {
    const clean = (detail || '').trim();
    if (!clean) return;
    if (GENERIC_FILLER_RE.test(clean)) {
      issues.push(`${prefix}.${label}: contiene cierre genérico prohibido`);
    }
    if (NODE_TRUNCATION_RE.test(clean)) {
      issues.push(`${prefix}.${label}: nodo truncado ("${clean.slice(0, 80)}")`);
    }
    if (isCenter && OBJECTIVE_CENTER_VERB_RE.test(clean)) {
      issues.push(`${prefix}.${label}: objetivo en 2ª persona usado como concepto central ("${clean.slice(0, 80)}")`);
    }
  };
  switch (diagram.kind) {
    case 'concept':
      checkNode('center', diagram.center.detail, true);
      diagram.nodes.forEach((n, i) => checkNode(`node[${i}]`, n.detail));
      break;
    case 'system-map':
      checkNode('center', diagram.center.detail, true);
      diagram.components.forEach((c, i) => checkNode(`component[${i}]`, c.detail));
      checkNode('environment', diagram.environment.detail);
      break;
    case 'block-diagram':
      checkNode('input', diagram.input.detail);
      checkNode('process', diagram.process.detail);
      checkNode('output', diagram.output.detail);
      checkNode('feedback', diagram.feedback.detail);
      break;
    case 'timeline':
      diagram.events.forEach((e, i) => checkNode(`event[${i}]`, e.detail));
      break;
    case 'language':
      checkNode('input', diagram.input.detail);
      checkNode('rule', diagram.rule.detail);
      checkNode('output', diagram.output.detail);
      checkNode('context', diagram.context.detail);
      break;
    case 'argument':
      checkNode('thesis', diagram.thesis.detail, true);
      diagram.premises.forEach((p, i) => checkNode(`premise[${i}]`, p.detail));
      checkNode('objection', diagram.objection.detail);
      checkNode('conclusion', diagram.conclusion.detail);
      break;
    case 'sop-flow':
      diagram.steps.forEach((s, i) => checkNode(`step[${i}]`, s.detail));
      break;
    default:
      break;
  }
}

/**
 * Audita la integridad de contenido editorial de una presentación (08) o infografía (09) SACRINT
 * antes de emitirla: bloquea rellenos genéricos, nodos truncados y etiquetas-objetivo en centros conceptuales.
 */
export function validateSacrintContentIntegrity(
  spec: SacrintDeckSpec | SacrintInfographicSpec
): string[] {
  const issues: string[] = [];
  const checkText = (field: string, value: string | undefined) => {
    const clean = (value || '').trim();
    if (!clean) return;
    if (GENERIC_FILLER_RE.test(clean)) {
      issues.push(`${field}: contiene relleno genérico prohibido`);
    }
    if (NODE_TRUNCATION_RE.test(clean)) {
      issues.push(`${field}: texto truncado ("${clean.slice(0, 80)}")`);
    }
    if (TEMPLATE_PHRASE_RE.test(clean)) {
      issues.push(`${field}: frase de plantilla filtrada ("${clean.slice(0, 80)}")`);
    }
    if (GENERIC_CONCLUSION_RE.test(clean)) {
      issues.push(`${field}: conclusión genérica prohibida ("${clean.slice(0, 80)}")`);
    }
    if (NUMERIC_ONLY_STEP_RE.test(clean)) {
      issues.push(`${field}: paso únicamente numérico ("${clean}")`);
    }
  };

  if ('slides' in spec && Array.isArray(spec.slides)) {
    spec.slides.forEach((slide, idx) => {
      const p = `slide[${idx + 1}]`;
      if (slide.title && GENERIC_TITLE_BLACKLIST_RE.test(slide.title.trim())) {
        issues.push(`${p}.title: título genérico prohibido ("${slide.title}")`);
      }
      if (slide.kind === 'concept') {
        checkText(`${p}.explanation`, slide.explanation);
        checkText(`${p}.misconception`, slide.misconception);
        if (slide.workedExample) {
          checkText(`${p}.workedExample.problemStatement`, slide.workedExample.problemStatement);
          slide.workedExample.steps.forEach((st, sIdx) =>
            checkText(`${p}.workedExample.steps[${sIdx}]`, st)
          );
          checkText(`${p}.workedExample.interpretation`, slide.workedExample.interpretation);
        }
        collectDiagramIntegrityIssues(slide.diagram, `${p}.diagram`, issues);
      } else if (slide.kind === 'practice') {
        (slide.activities ?? []).forEach((act, aIdx) => {
          checkText(`${p}.activities[${aIdx}].statement`, act.statement);
          checkText(`${p}.activities[${aIdx}].hint`, act.hint);
          const actCheck = validatePracticeActivity(act.statement, act.hint, { strict: false });
          if (!actCheck.valid) {
            issues.push(`${p}.activities[${aIdx}]: actividad sin tarea/producto (${actCheck.reason})`);
          }
        });
        (slide.objectiveBullets ?? []).forEach((obj, oIdx) => {
          const cleanObj = (obj || '').trim();
          if (
            /^Aplicar\s+(?:(?:entre|sobre|hacia|desde|contra|bajo|seg[uú]n)\b|[a-záéíóúñ]{3,}(?:ar|er|ir)\b|[a-záéíóúñ]+(?:as|es)\s+(?:y\s+|con\s+|el\s+|la\s+|los\s+|las\s+|un\s+|una\s+)|pulsera\b|texto\b|[a-záéíóúñ]+\s+(?:es|son)\s+)/i.test(
              cleanObj
            )
          ) {
            issues.push(`${p}.objectiveBullets[${oIdx}]: prefijo "Aplicar" incoherente ("${cleanObj.slice(0, 80)}")`);
          }
          if (
            cleanObj &&
            !normalizeLearningObjective(cleanObj, { title: slide.title, strict: false })
          ) {
            issues.push(`${p}.objectiveBullets[${oIdx}]: objetivo inválido o no infinitivo ("${cleanObj.slice(0, 80)}")`);
          }
        });
        checkText(`${p}.applicationText`, slide.applicationText);
        checkText(`${p}.artifactStep`, slide.artifactStep);
      }
    });
  } else {
    const info = spec as SacrintInfographicSpec;
    if (info.title && GENERIC_TITLE_BLACKLIST_RE.test(info.title.trim())) {
      issues.push(`infographic.title: título genérico prohibido ("${info.title}")`);
    }
    checkText('infographic.claim', info.claim);
    checkText('infographic.applicationSummary', info.applicationSummary);
    checkText('infographic.quickExample.problemStatement', info.quickExample?.problemStatement);
    checkText('infographic.quickExample.interpretation', info.quickExample?.interpretation);
    (info.quickExample?.steps ?? []).forEach((st, i) => checkText(`infographic.quickExample.steps[${i}]`, st));
    (info.steps ?? []).forEach((st, i) => checkText(`infographic.steps[${i}]`, st.body));
    (info.conceptManual?.conceptMap ?? []).forEach((n, i) => checkText(`infographic.conceptMap[${i}]`, n.detail));
    collectDiagramIntegrityIssues(info.diagram, 'infographic.diagram', issues);
  }
  return issues;
}


