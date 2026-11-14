/**
 * topic-classifier.ts — Clasificador Semántico Único de Tema Disciplinar (SSoT)
 * SIGPDA-EMS · Motor Visual y Editorial Compartido
 *
 * Clasifica el tema de una misión o sesión usando puntuación de evidencia ponderada
 * y señales negativas explícitas. Consumido por:
 * - visual-dispatcher.ts (PDF / DOCX)
 * - sacrint/diagrams.ts (Presentaciones 08 e Infografías 09)
 * - sacrint/spec.ts (Errores comunes / Misconceptions contextualizados)
 * - sacrint/content-distiller.ts
 */

import { normalizeEditorialText } from '@/lib/editorial/text-normalization';

export type TopicKind =
  | 'linear'
  | 'system-2x2'
  | 'quadratic'
  | 'exponential'
  | 'geometry'
  | 'statistics'
  | 'proportion'
  | 'generic';

export type TopicSubtopic =
  | 'pythagoras'
  | 'congruence-similarity'
  | 'angles'
  | 'perimeter-area'
  | 'geometry-general'
  | 'linear-equation'
  | 'linear-function'
  | 'system-2x2'
  | 'quadratic'
  | 'exponential-population'
  | 'exponential-financial'
  | 'statistics'
  | 'proportion'
  | 'generic';

export type ExponentialContextKind = 'population' | 'financial';

export interface TopicClassifierInput {
  title?: string | null;
  topic?: string | null;
  objective?: string | null;
  concepts?: string | null;
  example?: string | null;
  bodyText?: string | null;
  subject?: string | null;
}

export interface TopicClassificationResult {
  kind: TopicKind;
  subtopic: TopicSubtopic;
  confidence: number;
  evidence: string[];
  scores: Record<TopicKind, number>;
  exponentialContext: ExponentialContextKind;
}

interface PatternRule {
  regex: RegExp;
  weight: number;
  label: string;
}

const SYSTEM_2X2_RULES: PatternRule[] = [
  { regex: /\bsistemas?\s+de\s+ecuaciones(?:\s+lineales)?(?:\s+2\s*[x×]\s*2)?\b/i, weight: 8, label: 'sistema de ecuaciones' },
  { regex: /\b(?:sistema|sistemas)\s+2\s*[x×]\s*2\b/i, weight: 8, label: 'sistema 2x2' },
  { regex: /\bdos\s+ecuaciones\s+con\s+dos\s+inc[oó]gnitas\b/i, weight: 7, label: 'dos ecuaciones dos incógnitas' },
  { regex: /\bm[eé]todos?\s+de\s+(?:sustituci[oó]n|igualaci[oó]n|reducci[oó]n|suma\s+y\s+resta|determinantes|cramer)\b/i, weight: 7, label: 'método de resolución 2x2' },
  { regex: /\bregla\s+de\s+cramer\b|\bdeterminantes?\s+del?\s+sistema\b/i, weight: 6, label: 'determinantes/Cramer' },
  { regex: /\bpunto\s+de\s+intersecci[oó]n\s+de\s+(?:las\s+)?dos\s+rectas\b|\bsoluci[oó]n\s+simult[aá]nea\b/i, weight: 5, label: 'intersección de dos rectas' },
  { regex: /\bdos\s+inc[oó]gnitas\s*\(\s*x\s*(?:,|y)\s*y\s*\)/i, weight: 5, label: 'dos incógnitas (x, y)' },
];

const QUADRATIC_RULES: PatternRule[] = [
  { regex: /\becuaci[oó]n(?:es)?\s+cuadr[aá]tica(?:s)?\b/i, weight: 8, label: 'ecuación cuadrática' },
  { regex: /\bfunci[oó]n(?:es)?\s+cuadr[aá]tica(?:s)?\b/i, weight: 8, label: 'función cuadrática' },
  { regex: /\becuaci[oó]n(?:es)?\s+de\s+segundo\s+grado\b/i, weight: 8, label: 'segundo grado' },
  { regex: /\bf[oó]rmula\s+general(?:\s+cuadr[aá]tica)?\b/i, weight: 6, label: 'fórmula general' },
  { regex: /\bdiscriminante\b|\bb\s*(?:²|\^2)\s*-\s*4\s*a\s*c\b/i, weight: 7, label: 'discriminante' },
  { regex: /\bpar[aá]bola(?:s)?\b|\bv[eé]rtice\s+de\s+la\s+par[aá]bola\b|\bconcavidad\b/i, weight: 6, label: 'parábola/vértice' },
  { regex: /\bfactorizaci[oó]n\s+de\s+trinomios\b|\btrinomio\s+cuadrado\b|\bra[ií]ces\s+de\s+la\s+ecuaci[oó]n\s+cuadr[aá]tica\b/i, weight: 6, label: 'factorización/raíces cuadráticas' },
  { regex: /\bax\s*(?:²|\^2)\s*[+-]\s*bx\s*[+-]\s*c\b/i, weight: 7, label: 'ax² + bx + c' },
];

const EXPONENTIAL_RULES: PatternRule[] = [
  { regex: /\bcrecimiento\s+exponencial\b|\bdecaimiento\s+exponencial\b/i, weight: 8, label: 'crecimiento exponencial' },
  { regex: /\bfunci[oó]n(?:es)?\s+exponencial(?:es)?\b|\bmodelo(?:s)?\s+exponencial(?:es)?\b/i, weight: 8, label: 'función/modelo exponencial' },
  { regex: /\binter[eé]s\s+compuesto\b|\binter[eé]s\s+simple\s+y\s+compuesto\b|\bcapitalizaci[oó]n\s+compuesta\b/i, weight: 8, label: 'interés compuesto' },
  { regex: /\btasa\s+de\s+crecimiento\s+(?:poblacional|demogr[aá]fico|anual|exponencial)\b/i, weight: 7, label: 'tasa de crecimiento exponencial' },
  { regex: /\b[PC]\s*\(\s*t\s*\)\s*=\s*[PC][₀0]?\s*[·*]?\s*\(\s*1\s*[+-]\s*r\s*\)\s*(?:\^t|ᵗ)/i, weight: 8, label: 'fórmula P(t) = P₀(1+r)^t' },
  { regex: /\(\s*1\s*\+\s*(?:r|i|0\.\d+)\s*\)\s*(?:\^\s*\d+|\^\s*t|[²³⁴⁵⁶⁷⁸⁹ᵗ])/i, weight: 6, label: 'factor (1+r)^t' },
];

const GEOMETRY_RULES: PatternRule[] = [
  { regex: /\bteorema\s+de\s+pit[aá]goras\b|\bpit[aá]goras\b/i, weight: 9, label: 'Teorema de Pitágoras' },
  { regex: /\bhipotenusa\b|\bcatetos?\b/i, weight: 7, label: 'hipotenusa/catetos' },
  { regex: /\bcongruencia\s+(?:y\s+semejanza|de\s+(?:tri[aá]ngulos|figuras)|geom[eé]trica)\b|\bsemejanza\s+de\s+tri[aá]ngulos\b/i, weight: 9, label: 'congruencia/semejanza' },
  { regex: /\bcriterios?\s+(?:de\s+congruencia|de\s+semejanza|LLL|LAL|ALA|AA)\b/i, weight: 8, label: 'criterios LLL/LAL/ALA' },
  { regex: /\bteorema\s+de\s+tales\b|\blados\s+hom[oó]logos\b/i, weight: 7, label: 'Teorema de Tales / lados homólogos' },
  { regex: /\b(?:tipos|clasificaci[oó]n|medici[oó]n)\s+de\s+[aá]ngulos\b/i, weight: 9, label: 'tipos/clasificación de ángulos' },
  { regex: /\b[aá]ngulos\s+(?:agudos?|rectos?|obtusos?|llanos?|complementarios?|suplementarios?|opuestos\s+por\s+el\s+v[eé]rtice|alternos\s+internos|correspondientes|adyacentes)\b/i, weight: 8, label: 'ángulos geométricos' },
  { regex: /\btransportador\b|\babertura\s+angular\b|\bv[eé]rtice\s+angular\b/i, weight: 6, label: 'transportador/abertura angular' },
  { regex: /\brectas\s+paralelas\s+cortadas\s+por\s+una\s+(?:transversal|secante)\b/i, weight: 8, label: 'paralelas y transversal' },
  { regex: /\btri[aá]ngulo\s+rect[aá]ngulo\b|\btri[aá]ngulos\s+(?:equil[aá]teros?|is[oó]sceles|escalenos?)\b/i, weight: 6, label: 'triángulo geométrico' },
  { regex: /\bgeometr[ií]a\s+plana\b|\btrazo(?:s)?\s+geom[eé]trico(?:s)?\b|\bpropiedades\s+geom[eé]tricas\b/i, weight: 5, label: 'geometría plana' },
];

const LINEAR_RULES: PatternRule[] = [
  { regex: /\becuaci[oó]n(?:es)?\s+lineal(?:es)?(?:\s+de\s+primer\s+grado)?\b/i, weight: 8, label: 'ecuación lineal' },
  { regex: /\becuaci[oó]n(?:es)?\s+de\s+primer\s+grado(?:\s+con\s+una\s+inc[oó]gnita)?\b/i, weight: 8, label: 'ecuación de primer grado' },
  { regex: /\bfunci[oó]n(?:es)?\s+lineal(?:es)?\b|\bmodelo(?:s)?\s+lineal(?:es)?\b/i, weight: 7, label: 'función/modelo lineal' },
  { regex: /\bbalanza\s+algebraica\b|\bpropiedades\s+de\s+la\s+igualdad\b|\boperaciones\s+inversas\b/i, weight: 6, label: 'balanza algebraica / despeje' },
  { regex: /\bdespeje\s+de\s+la\s+inc[oó]gnita\b|\bdespejar\s+la\s+inc[oó]gnita\b/i, weight: 5, label: 'despeje de incógnita' },
  { regex: /\b(?:y|f\(x\))\s*=\s*m\s*x\s*[+-]\s*b\b|\bpendiente\s+y\s+ordenada\s+al\s+origen\b/i, weight: 7, label: 'y = mx + b' },
  { regex: /\brepresentaci[oó]n\s+tabular\s+y\s+(?:gr[aá]fica|modelaci[oó]n\s+algebraica)\b/i, weight: 6, label: 'representación tabular y gráfica lineal' },
  { regex: /\braz[oó]n\s+de\s+cambio\s+constante\b|\bvariaci[oó]n\s+lineal\b/i, weight: 6, label: 'variación lineal' },
];

const STATISTICS_RULES: PatternRule[] = [
  { regex: /\bestad[ií]stica\s+(?:descriptiva|inferencial)\b|\ban[aá]lisis\s+estad[ií]stico\b/i, weight: 7, label: 'estadística' },
  { regex: /\bfrecuencia\s+(?:absoluta|relativa|acumulada)\b|\btabla\s+de\s+frecuencias\b/i, weight: 8, label: 'tabla de frecuencias' },
  { regex: /\bmedidas\s+de\s+tendencia\s+central\b|\bmedia\s+aritm[eé]tica\b|\bmediana\s+y\s+moda\b/i, weight: 8, label: 'tendencia central' },
  { regex: /\bdesviaci(?:[oó]n|ones)\s+est[aá]ndar(?:es)?\b|\bvarianza\b|\bmedidas\s+de\s+dispersi[oó]n\b/i, weight: 8, label: 'dispersión estadística' },
  { regex: /\bmargen\s+de\s+error(?:\s+(?:estad[ií]stico|muestral))?\b|\bintervalos?\s+de\s+confianza\b|\bnivel(?:es)?\s+de\s+confianza\b|\btama[nñ]o\s+(?:de\s+la\s+muestra|muestral)\b|\bencuesta\s+(?:aleatoria|estad[ií]stica|escolar|representativa)\b/i, weight: 7, label: 'muestreo estadístico' },
  { regex: /\bhistograma\b|\bpol[ií]gono\s+de\s+frecuencias\b|\bgr[aá]fica\s+de\s+barras\s+estad[ií]stica\b/i, weight: 6, label: 'histograma/frecuencias' },
];

const PROPORTION_RULES: PatternRule[] = [
  { regex: /\bproporcionalidad\s+(?:directa|inversa)\b|\bvariaci[oó]n\s+proporcional\b/i, weight: 8, label: 'proporcionalidad directa/inversa' },
  { regex: /\brazones\s+y\s+proporciones\b|\bconstante\s+de\s+proporcionalidad\b/i, weight: 8, label: 'razones y proporciones' },
  { regex: /\bregla\s+de\s+tres\b|\breparto\s+proporcional\b/i, weight: 7, label: 'regla de tres / reparto proporcional' },
];

const POPULATION_SIGNALS: RegExp[] = [
  /\bpoblaci[oó]n(?:\s+juvenil|\s+inicial|\s+total|\s+final|\s+de\s+la\s+comunidad|\s+municipal)?\b/i,
  /\bhabitantes\b|\bj[oó]venes\b|\bcomunidad\b|\bdemogr[aá]f\w*\b|\bcenso\b/i,
  /\bcrecimiento\s+poblacional\b|\bnatalidad\b|\bmigraci[oó]n\b/i,
  /\bP\s*\(\s*t\s*\)|\bP[₀0]\b/i,
];

const FINANCIAL_SIGNALS: RegExp[] = [
  /\binter[eé]s\s+(?:compuesto|simple|anual|mensual)\b/i,
  /\bcapital\s+(?:inicial|final|invertido)\b|\bmonto\s+(?:compuesto|final|acumulado)\b/i,
  /\binversi[oó]n\b|\bpr[eé]stamo\b|\bahorro\b|\bcr[eé]dito\b|\bdeuda\b|\brendimiento\s+financiero\b/i,
  /\bC\s*\(\s*t\s*\)|\bC[₀0]\b|\bM\s*\(\s*t\s*\)/i,
];

function scoreRules(
  rules: PatternRule[],
  primaryText: string,
  secondaryText: string,
  evidence: string[]
): number {
  let score = 0;
  for (const rule of rules) {
    const inPrimary = rule.regex.test(primaryText);
    const inSecondary = !inPrimary && rule.regex.test(secondaryText);
    if (inPrimary) {
      score += rule.weight * 2.5;
      evidence.push(`${rule.label} (primario)`);
    } else if (inSecondary) {
      score += rule.weight;
      evidence.push(rule.label);
    }
  }
  return score;
}

export function detectExponentialContext(text: string): ExponentialContextKind {
  const clean = normalizeEditorialText(text || '');
  let popScore = 0;
  let finScore = 0;
  for (const re of POPULATION_SIGNALS) {
    if (re.test(clean)) popScore += 2;
  }
  for (const re of FINANCIAL_SIGNALS) {
    if (re.test(clean)) finScore += 2;
  }
  if (/\bcrecimiento\s+poblacional\b|\bhabitantes\b|\bpoblaci[oó]n\s+inicial\b|\bP\s*\(\s*t\s*\)/i.test(clean)) {
    popScore += 4;
  }
  if (/\binter[eé]s\s+compuesto\b|\bcapital\s+inicial\b|\bmonto\s+compuesto\b/i.test(clean)) {
    finScore += 4;
  }
  return popScore >= finScore && popScore > 0 ? 'population' : 'financial';
}

function resolveSubtopic(
  kind: TopicKind,
  combinedText: string,
  exponentialContext: ExponentialContextKind
): TopicSubtopic {
  if (kind === 'geometry') {
    if (/\bpit[aá]goras\b|\bhipotenusa\b|\bcatetos?\b/i.test(combinedText)) {
      return 'pythagoras';
    }
    if (/\bcongruencia\b|\bsemejanza\b|\bcriterios?\s+(?:LLL|LAL|ALA|AA)\b|\btales\b|\blados\s+hom[oó]logos\b/i.test(combinedText)) {
      return 'congruence-similarity';
    }
    if (/\b[aá]ngulos?\b|\btransportador\b|\bsuplementarios?\b|\bcomplementarios?\b|\bopuestos\s+por\s+el\s+v[eé]rtice\b|\bparalelas\b|\btransversal\b/i.test(combinedText)) {
      return 'angles';
    }
    if (/\bper[ií]metro\b|\b[aá]rea\b/i.test(combinedText)) {
      return 'perimeter-area';
    }
    return 'geometry-general';
  }
  if (kind === 'linear') {
    if (/\bfunci[oó]n\s+lineal\b|\by\s*=\s*m\s*x\b|\bpendiente\b|\btabulaci[oó]n\b/i.test(combinedText)) {
      return 'linear-function';
    }
    return 'linear-equation';
  }
  if (kind === 'exponential') {
    return exponentialContext === 'population' ? 'exponential-population' : 'exponential-financial';
  }
  if (kind === 'system-2x2') return 'system-2x2';
  if (kind === 'quadratic') return 'quadratic';
  if (kind === 'statistics') return 'statistics';
  if (kind === 'proportion') return 'proportion';
  return 'generic';
}

/**
 * Clasifica semánticamente el tema disciplinar de una misión o sesión.
 */
export function classifyTopic(
  input: string | TopicClassifierInput
): TopicClassificationResult {
  const normalizedInput: TopicClassifierInput =
    typeof input === 'string' ? { topic: input } : input || {};

  const primaryText = normalizeEditorialText(
    [
      normalizedInput.title,
      normalizedInput.topic,
      normalizedInput.objective,
      normalizedInput.concepts,
    ]
      .filter(Boolean)
      .join(' · ')
  );

  const secondaryText = normalizeEditorialText(
    [normalizedInput.example, normalizedInput.bodyText]
      .filter(Boolean)
      .join(' · ')
  );

  const combinedText = `${primaryText} · ${secondaryText}`.trim();
  const evidence: string[] = [];

  const scores: Record<TopicKind, number> = {
    'linear': scoreRules(LINEAR_RULES, primaryText, secondaryText, evidence),
    'system-2x2': scoreRules(SYSTEM_2X2_RULES, primaryText, secondaryText, evidence),
    'quadratic': scoreRules(QUADRATIC_RULES, primaryText, secondaryText, evidence),
    'exponential': scoreRules(EXPONENTIAL_RULES, primaryText, secondaryText, evidence),
    'geometry': scoreRules(GEOMETRY_RULES, primaryText, secondaryText, evidence),
    'statistics': scoreRules(STATISTICS_RULES, primaryText, secondaryText, evidence),
    'proportion': scoreRules(PROPORTION_RULES, primaryText, secondaryText, evidence),
    'generic': 0,
  };

  // ── Señales negativas y desambiguación cruzada ─────────────────────────
  const hasStrongGeometryInPrimary =
    /\b(?:pit[aá]goras|hipotenusa|catetos?|congruencia\s+(?:y\s+semejanza|de\s+(?:tri[aá]ngulos|figuras)|geom[eé]trica)|semejanza\s+de\s+tri[aá]ngulos|tipos\s+de\s+[aá]ngulos|clasificaci[oó]n\s+de\s+[aá]ngulos|[aá]ngulos\s+suplementarios|[aá]ngulos\s+complementarios|opuestos\s+por\s+el\s+v[eé]rtice|transportador|criterios?\s+(?:de\s+congruencia|LLL|LAL|ALA))\b/i.test(
      primaryText
    );

  if (hasStrongGeometryInPrimary) {
    // Evitar que Pitágoras (a² + b² = c²) o congruencia disparen cuadrática, proporción o estadística
    if (!/\b(?:ecuaci[oó]n\s+cuadr[aá]tica|f[oó]rmula\s+general|par[aá]bola|discriminante)\b/i.test(primaryText)) {
      scores.quadratic = Math.max(0, scores.quadratic - 15);
    }
    scores.proportion = Math.max(0, scores.proportion - 15);
    scores.statistics = Math.max(0, scores.statistics - 15);
    scores.linear = Math.max(0, scores.linear - 10);
  }

  const hasStrongLinearInPrimary =
    /\b(?:ecuaci[oó]n(?:es)?\s+lineal(?:es)?|primer\s+grado|balanza\s+algebraica|despeje\s+de\s+la\s+inc[oó]gnita|modelaci[oó]n\s+algebraica|representaci[oó]n\s+tabular)\b/i.test(
      primaryText
    );

  if (hasStrongLinearInPrimary && !hasStrongGeometryInPrimary) {
    // Evitar que "primer grado" o un problema verbal de cancha/terreno dispare geometría
    scores.geometry = Math.max(0, scores.geometry - 15);
    scores.statistics = Math.max(0, scores.statistics - 12);
  }

  const hasStrongSystemInPrimary =
    /\b(?:sistemas?\s+de\s+ecuaciones|sistema\s+2\s*[x×]\s*2|sustituci[oó]n|igualaci[oó]n|reducci[oó]n|determinantes|cramer)\b/i.test(
      primaryText
    );

  if (hasStrongSystemInPrimary) {
    // Un sistema de ecuaciones lineales menciona "ecuaciones lineales", pero es system-2x2
    scores['system-2x2'] += 12;
  }

  const hasStrongQuadraticInPrimary =
    /\b(?:ecuaci[oó]n(?:es)?\s+cuadr[aá]tica(?:s)?|segundo\s+grado|f[oó]rmula\s+general|discriminante|par[aá]bola)\b/i.test(
      primaryText
    );

  if (hasStrongQuadraticInPrimary) {
    scores.quadratic += 10;
  }

  const hasStrongExponentialInPrimary =
    /\b(?:crecimiento\s+exponencial|funci[oó]n\s+exponencial|modelo\s+exponencial|inter[eé]s\s+compuesto|tasa\s+de\s+crecimiento)\b/i.test(
      primaryText
    );

  if (hasStrongExponentialInPrimary) {
    scores.exponential += 12;
    scores.statistics = Math.max(0, scores.statistics - 12);
  }

  // Selección de la categoría ganadora con umbral mínimo de confianza
  let bestKind: TopicKind = 'generic';
  let bestScore = 0;

  const candidates: TopicKind[] = [
    'system-2x2',
    'quadratic',
    'exponential',
    'geometry',
    'linear',
    'statistics',
    'proportion',
  ];

  for (const candidate of candidates) {
    if (scores[candidate] > bestScore) {
      bestScore = scores[candidate];
      bestKind = candidate;
    }
  }

  if (bestScore < 5) {
    bestKind = 'generic';
  }

  const exponentialContext = detectExponentialContext(combinedText);
  const subtopic = resolveSubtopic(bestKind, combinedText, exponentialContext);
  const confidence = bestKind === 'generic' ? 0 : Math.min(1, Number((bestScore / 25).toFixed(2)));

  return {
    kind: bestKind,
    subtopic,
    confidence,
    evidence,
    scores,
    exponentialContext,
  };
}
