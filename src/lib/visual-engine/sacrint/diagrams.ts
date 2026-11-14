import type { MissionSection, SessionPlan } from '@/types/work-textbook';
import type { SacrintPack } from './discipline-packs';
import { cleanSacrintText, distillConciseText } from './content-distiller';

export interface SacrintVariable {
  symbol: string;
  label: string;
  meaning: string;
}

export interface SacrintDiagramNode {
  label: string;
  detail: string;
}

export interface LinearDiagramSpec {
  kind: 'linear';
  available: boolean;
  equation: string;
  slope: number;
  intercept: number;
  domainMax: number;
  rangeMax: number;
  points: Array<{ x: number; y: number; label?: string }>;
  xLabel: string;
  yLabel: string;
  targetY?: number;
}

export interface QuadraticDiagramSpec {
  kind: 'quadratic';
  available: boolean;
  equation: string;
  a: number;
  b: number;
  c: number;
  vertexX: number;
  vertexY: number;
  roots: number[];
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  samples: Array<{ x: number; y: number }>;
  xLabel: string;
  yLabel: string;
}

export interface System2x2DiagramSpec {
  kind: 'system-2x2';
  available: boolean;
  equation1: string;
  equation2: string;
  a1: number;
  b1: number;
  c1: number;
  a2: number;
  b2: number;
  c2: number;
  intersection: { x: number; y: number } | null;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  xLabel: string;
  yLabel: string;
}

export interface ExponentialDiagramSpec {
  kind: 'exponential';
  available: boolean;
  equation: string;
  principal: number;
  rate: number;
  periods: number;
  simpleSeries: Array<{ t: number; value: number }>;
  compoundSeries: Array<{ t: number; value: number }>;
  yMax: number;
  xLabel: string;
  yLabel: string;
}

export interface GeometryDiagramSpec {
  kind: 'geometry';
  available: boolean;
  variant: 'angles' | 'right-triangle' | 'polygon';
  equation: string;
  primaryLabel: string;
  secondaryLabel: string;
  highlights: SacrintDiagramNode[];
}

export interface ReactionDiagramSpec {
  kind: 'reaction';
  available: boolean;
  equation: string;
  reactants: SacrintDiagramNode[];
  products: SacrintDiagramNode[];
  condition: string;
  note: string;
}

export interface ArgumentDiagramSpec {
  kind: 'argument';
  available: boolean;
  thesis: SacrintDiagramNode;
  premises: SacrintDiagramNode[];
  objection: SacrintDiagramNode;
  conclusion: SacrintDiagramNode;
}

export interface LanguageDiagramSpec {
  kind: 'language';
  available: boolean;
  input: SacrintDiagramNode;
  rule: SacrintDiagramNode;
  output: SacrintDiagramNode;
  context: SacrintDiagramNode;
}

export interface ConceptDiagramSpec {
  kind: 'concept';
  available: boolean;
  center: SacrintDiagramNode;
  nodes: SacrintDiagramNode[];
}

export interface TimelineDiagramSpec {
  kind: 'timeline';
  available: boolean;
  events: SacrintDiagramNode[];
  span: string;
}

export interface SystemMapDiagramSpec {
  kind: 'system-map';
  available: boolean;
  center: SacrintDiagramNode;
  components: SacrintDiagramNode[];
  environment: SacrintDiagramNode;
}

export interface ClinicalFlowDiagramSpec {
  kind: 'clinical-flow';
  available: boolean;
  stages: SacrintDiagramNode[];
  note: string;
}

export interface BlockDiagramSpec {
  kind: 'block-diagram';
  available: boolean;
  input: SacrintDiagramNode;
  process: SacrintDiagramNode;
  output: SacrintDiagramNode;
  feedback: SacrintDiagramNode;
}

export interface SopFlowDiagramSpec {
  kind: 'sop-flow';
  available: boolean;
  steps: SacrintDiagramNode[];
  standard: string;
}

export interface CreativeCycleDiagramSpec {
  kind: 'creative-cycle';
  available: boolean;
  phases: SacrintDiagramNode[];
  statement: string;
}

export interface TrainingCycleDiagramSpec {
  kind: 'training-cycle';
  available: boolean;
  phases: SacrintDiagramNode[];
  principle: string;
}

export interface RegulationFlowDiagramSpec {
  kind: 'regulation-flow';
  available: boolean;
  stages: SacrintDiagramNode[];
  anchor: string;
}

export type SacrintDiagramSpec =
  | LinearDiagramSpec
  | QuadraticDiagramSpec
  | System2x2DiagramSpec
  | ExponentialDiagramSpec
  | GeometryDiagramSpec
  | ReactionDiagramSpec
  | ArgumentDiagramSpec
  | LanguageDiagramSpec
  | ConceptDiagramSpec
  | TimelineDiagramSpec
  | SystemMapDiagramSpec
  | ClinicalFlowDiagramSpec
  | BlockDiagramSpec
  | SopFlowDiagramSpec
  | CreativeCycleDiagramSpec
  | TrainingCycleDiagramSpec
  | RegulationFlowDiagramSpec;

interface DiagramBuildOptions {
  xLabel?: string;
  yLabel?: string;
  session?: SessionPlan;
  allowMissionFallback?: boolean;
}

function clean(value: string | null | undefined): string {
  return cleanSacrintText(value);
}

function clip(value: string, max: number): string {
  return distillConciseText(value, max) || clean(value).slice(0, max);
}

function firstSentence(value: string | null | undefined, max = 220): string {
  return distillConciseText(value, max);
}

function detail(value: string | null | undefined, max = 220, fallback = 'Sin registro.'): string {
  const text = firstSentence(value, max);
  return text || fallback;
}

/** Calcula un tamaño de paso limpio ("1, 2, 5 × 10ⁿ") para ~5 marcas de eje sin amontonamiento. */
export function niceTickStep(span: number, targetTicks = 5): number {
  const safeSpan = Math.max(1e-6, Math.abs(span));
  const rough = safeSpan / Math.max(2, targetTicks);
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const rel = rough / mag;
  if (rel <= 1) return mag;
  if (rel <= 2) return 2 * mag;
  if (rel <= 2.5) return 2.5 * mag;
  if (rel <= 5) return 5 * mag;
  return 10 * mag;
}

function collectSessionCoreSource(session?: SessionPlan): string {
  if (!session) return '';
  return [session.objetivo, session.contenido, session.ejemploResuelto]
    .filter(Boolean)
    .join(' ');
}

function collectSessionFullSource(session?: SessionPlan): string {
  if (!session) return '';
  return [
    collectSessionCoreSource(session),
    session.practica?.map((p) => `${p.enunciado} ${p.pista}`).join(' '),
  ]
    .filter(Boolean)
    .join(' ');
}

function collectMathSource(mission: MissionSection, session?: SessionPlan): string {
  return [
    collectSessionFullSource(session),
    mission.conceptZero?.coreExplanation,
    mission.conceptZero?.solvedExample?.problemStatement,
    mission.conceptZero?.solvedExample?.solutionSteps?.join(' '),
    mission.iDoSection?.stepByStepDemo,
    mission.iDoSection?.visualOrDiagram,
    mission.sessionTopic,
    mission.title,
  ]
    .filter(Boolean)
    .join(' ');
}

function formatCoef(value: number): string {
  return Number.isInteger(value) ? String(value) : Number(value.toFixed(2)).toString();
}

function parseNumber(text: string, symbol: 'm' | 'b'): number | null {
  const pattern = new RegExp(`\\b${symbol}\\s*=\\s*(-?\\d+(?:\\.\\d+)?)`, 'i');
  const match = text.match(pattern);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

type ParsedLinearModel = {
  slope: number;
  intercept: number;
  domainMax: number;
  targetY?: number;
  equation: string;
};

function parseLinearFromText(text: string): ParsedLinearModel | null {
  if (!text) return null;
  const normalized = text.replace(/(\d),(\d{3})(?![0-9])/g, '$1$2');

  // 1. Forma pendiente-ordenada: y = mx ± b, f(x) = mx ± b, C(m) = 1200m + 3500 (sin exponente cuadrático)
  const slopeInterceptMatch = normalized.match(
    /(?:[A-Za-z]\([a-z]\)|y)\s*=\s*(-?\d+(?:\.\d+)?)\s*([a-z])\s*([+-])\s*(\d+(?:\.\d+)?)(?![0-9A-Za-z²])/i
  );
  if (slopeInterceptMatch) {
    const rawM = Number(slopeInterceptMatch[1]);
    const varName = slopeInterceptMatch[2];
    const sign = slopeInterceptMatch[3];
    const rawB = Number(slopeInterceptMatch[4]);
    if (Number.isFinite(rawM) && rawM !== 0 && Number.isFinite(rawB)) {
      const signedB = sign === '-' ? -rawB : rawB;
      return {
        slope: rawM,
        intercept: signedB,
        domainMax: 10,
        equation: `f(${varName}) = ${formatCoef(rawM)}${varName} ${sign} ${formatCoef(rawB)}`,
      };
    }
  }

  // 1b. Ecuación lineal con incógnita en ambos miembros: ax ± b = cx ± d o (ax ± b) - cx = (cx ± d) - cx
  const bothSidesMatch = normalized.match(
    /\(?\s*(-?\d+(?:\.\d+)?)\s*([a-z])\s*([+-])\s*(\d+(?:\.\d+)?)\s*\)?(?:\s*-\s*\d+\s*\2)?\s*=\s*\(?\s*(-?\d+(?:\.\d+)?)\s*\2\s*([+-])\s*(\d+(?:\.\d+)?)\s*\)?/i
  );
  if (bothSidesMatch) {
    const a1 = Number(bothSidesMatch[1]);
    const varName = bothSidesMatch[2];
    const s1 = bothSidesMatch[3] === '-' ? -1 : 1;
    const b1 = s1 * Number(bothSidesMatch[4]);
    const a2 = Number(bothSidesMatch[5]);
    const s2 = bothSidesMatch[6] === '-' ? -1 : 1;
    const b2 = s2 * Number(bothSidesMatch[7]);
    const netA = a1 - a2;
    if (Number.isFinite(netA) && netA !== 0 && Number.isFinite(b1) && Number.isFinite(b2)) {
      const xSol = (b2 - b1) / netA;
      const yAtSol = a1 * xSol + b1;
      const boundedDom = Math.min(40, Math.max(8, xSol > 0 ? Math.ceil((xSol * 1.35) / 2) * 2 : 10));
      return {
        slope: a1,
        intercept: b1,
        domainMax: boundedDom,
        targetY: yAtSol > 0 ? Number(yAtSol.toFixed(2)) : undefined,
        equation: `${formatCoef(a1)}${varName} ${bothSidesMatch[3]} ${formatCoef(Math.abs(b1))} = ${formatCoef(a2)}${varName} ${bothSidesMatch[6]} ${formatCoef(Math.abs(b2))}`,
      };
    }
  }

  // 2. Ecuación lineal de primer grado: ax ± b = c (conservando coeficientes reales, sin distorsionar)
  const balanceMatch = normalized.match(
    /(?<![²^0-9A-Za-z])(\d+(?:\.\d+)?)\s*([a-z])\s*([+-])\s*(\d+(?:\.\d+)?)\s*=\s*(-?\d+(?:\.\d+)?)(?![0-9A-Za-z²])/i
  );
  if (balanceMatch) {
    const a = Number(balanceMatch[1]);
    const varName = balanceMatch[2];
    const sign = balanceMatch[3];
    const bRaw = Number(balanceMatch[4]);
    const c = Number(balanceMatch[5]);
    if (Number.isFinite(a) && a !== 0 && Number.isFinite(bRaw) && Number.isFinite(c)) {
      const signedB = sign === '-' ? -bRaw : bRaw;
      const xSol = (c - signedB) / a;
      const niceDom = xSol > 0 ? Math.max(8, Math.ceil((xSol * 1.35) / 2) * 2) : 10;
      const boundedDom = Math.min(40, Math.max(8, niceDom));
      return {
        slope: a,
        intercept: signedB,
        domainMax: boundedDom,
        targetY: c > 0 ? c : undefined,
        equation: `${formatCoef(a)}${varName} ${sign} ${formatCoef(bRaw)} = ${formatCoef(c)}`,
      };
    }
  }

  // 2b. Ecuación lineal con término constante primero: b + ax = c (ej. 250 + 30x = 850)
  const constFirstMatch = normalized.match(
    /(?<![²^0-9A-Za-z])(\d+(?:\.\d+)?)\s*([+-])\s*(\d+(?:\.\d+)?)\s*([a-z])\s*=\s*(-?\d+(?:\.\d+)?)(?![0-9A-Za-z²])/i
  );
  if (constFirstMatch) {
    const bVal = Number(constFirstMatch[1]);
    const sign = constFirstMatch[2];
    const aRaw = Number(constFirstMatch[3]);
    const varName = constFirstMatch[4];
    const c = Number(constFirstMatch[5]);
    const signedA = sign === '-' ? -aRaw : aRaw;
    if (Number.isFinite(signedA) && signedA !== 0 && Number.isFinite(bVal) && Number.isFinite(c)) {
      const xSol = (c - bVal) / signedA;
      const boundedDom = Math.min(40, Math.max(8, xSol > 0 ? Math.ceil((xSol * 1.35) / 2) * 2 : 10));
      return {
        slope: signedA,
        intercept: bVal,
        domainMax: boundedDom,
        targetY: c > 0 ? c : undefined,
        equation: `${formatCoef(bVal)} ${sign} ${formatCoef(aRaw)}${varName} = ${formatCoef(c)}`,
      };
    }
  }

  // 3. Ecuación lineal con paréntesis: a(x ± b) = c
  const parenLinearMatch = normalized.match(
    /(?<![²^0-9A-Za-z])(\d+(?:\.\d+)?)\s*\(\s*([a-z])\s*([+-])\s*(\d+(?:\.\d+)?)\s*\)\s*=\s*(-?\d+(?:\.\d+)?)/i
  );
  if (parenLinearMatch) {
    const a = Number(parenLinearMatch[1]);
    const varName = parenLinearMatch[2];
    const sign = parenLinearMatch[3];
    const bRaw = Number(parenLinearMatch[4]);
    const c = Number(parenLinearMatch[5]);
    if (Number.isFinite(a) && a !== 0 && Number.isFinite(bRaw) && Number.isFinite(c)) {
      const expandedB = (sign === '-' ? -1 : 1) * a * bRaw;
      const xSol = (c - expandedB) / a;
      const boundedDom = Math.min(40, Math.max(8, xSol > 0 ? Math.ceil((xSol * 1.35) / 2) * 2 : 10));
      return {
        slope: a,
        intercept: expandedB,
        domainMax: boundedDom,
        targetY: c > 0 ? c : undefined,
        equation: `${formatCoef(a)}(${varName} ${sign} ${formatCoef(bRaw)}) = ${formatCoef(c)}`,
      };
    }
  }

  // 4. Ecuación lineal con dos incógnitas aislada: Ax ± By = C (cuando no es un sistema 2x2 de dos ecuaciones)
  const twoVarSingleMatches = [
    ...normalized.matchAll(/(-?\d+(?:\.\d+)?)\s*x\s*([+-])\s*(\d+(?:\.\d+)?)\s*y\s*=\s*(-?\d+(?:\.\d+)?)/gi),
  ];
  if (twoVarSingleMatches.length === 1) {
    const m = twoVarSingleMatches[0];
    const aCoef = Number(m[1]);
    const bSign = m[2] === '-' ? -1 : 1;
    const bMag = Number(m[3]);
    const bCoef = bSign * bMag;
    const cCoef = Number(m[4]);
    if (Number.isFinite(aCoef) && Number.isFinite(bCoef) && bCoef !== 0 && Number.isFinite(cCoef) && aCoef !== 0) {
      const slope = Number((-aCoef / bCoef).toFixed(2));
      const intercept = Number((cCoef / bCoef).toFixed(2));
      const xInt = cCoef / aCoef;
      const boundedDom = Math.min(40, Math.max(8, xInt > 0 ? Math.ceil((xInt * 1.2) / 2) * 2 : 12));
      return {
        slope,
        intercept,
        domainMax: boundedDom,
        equation: `${formatCoef(aCoef)}x ${m[2]} ${formatCoef(bMag)}y = ${formatCoef(cCoef)}`,
      };
    }
  }

  // 5. Modelo estadístico muestral o de frecuencias con datos numéricos reales (N y n, o promedio muestral)
  const statSampleMatch =
    normalized.match(/\bN\s*=\s*(\d{2,6})\b[\s\S]{0,80}?\bn\s*[=≈]\s*(\d{1,5})\b/) ||
    normalized.match(/poblaci[oó]n\s+total\s+(?:es\s+)?N\s*=\s*(\d{2,6})[\s\S]{0,120}?muestra[\s\S]{0,40}?(\d{2,5})/i);
  if (statSampleMatch) {
    const popN = Number(statSampleMatch[1]);
    const sampN = Number(statSampleMatch[2]);
    if (popN > sampN && sampN > 0) {
      const ratio = Number((sampN / popN).toFixed(2)) || 0.2;
      return {
        slope: ratio,
        intercept: 0,
        domainMax: 10,
        targetY: Number((ratio * 10).toFixed(2)),
        equation: `n = ${ratio}·N  (N=${popN}, n=${sampN})`,
      };
    }
  }

  const statZMatch = normalized.match(/\bN\s*=\s*(\d{2,6})\b[\s\S]{0,100}?\bz\s*=\s*(1\.96|1\.645|2\.58)\b/i);
  if (statZMatch) {
    const popN = Number(statZMatch[1]);
    const zVal = Number(statZMatch[2]);
    const nEst = Math.round((popN * zVal * zVal * 0.25) / ((popN - 1) * 0.0025 + zVal * zVal * 0.25));
    const ratio = Number((nEst / popN).toFixed(2)) || 0.24;
    return {
      slope: ratio,
      intercept: 0,
      domainMax: 10,
      targetY: Number((ratio * 10).toFixed(2)),
      equation: `n = ${nEst}  (N=${popN}, z=${zVal}, e=5%)`,
    };
  }

  const statAvgMatch = normalized.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+)\s*=\s*(\d+(?:\.\d+)?)/);
  if (statAvgMatch && /frecuencia|encuesta|muestra|promedio|media/i.test(normalized)) {
    const sumVal = Number(statAvgMatch[1]);
    const nVal = Number(statAvgMatch[2]);
    const meanVal = Number(statAvgMatch[3]);
    if (nVal > 0 && meanVal > 0) {
      return {
        slope: meanVal,
        intercept: 0,
        domainMax: Math.min(40, Math.max(10, nVal)),
        targetY: sumVal,
        equation: `x̄ = ${sumVal}/${nVal} = ${meanVal}`,
      };
    }
  }

  const pilotSurveyMatch = normalized.match(/encuesta(?:\s+piloto)?\s+aplicada\s+a\s+(\d{2,4})\s+(?:estudiantes|personas|alumnos)/i);
  if (pilotSurveyMatch) {
    const nPilot = Number(pilotSurveyMatch[1]);
    return {
      slope: 1,
      intercept: 0,
      domainMax: Math.min(40, Math.max(10, nPilot)),
      targetY: nPilot,
      equation: `Muestra piloto n = ${nPilot}`,
    };
  }

  const coeffMatch = normalized.match(/\ba\s*=\s*(-?\d+(?:\.\d+)?)[\s,;]+b\s*=\s*(-?\d+(?:\.\d+)?)/i);
  if (coeffMatch && !/cuadr[aá]tic|ax²|par[aá]bol/i.test(normalized)) {
    const a = Number(coeffMatch[1]) || 1;
    const bVal = Number(coeffMatch[2]) || 0;
    return {
      slope: a,
      intercept: bVal,
      domainMax: 10,
      equation: `f(x) = ${formatCoef(a)}x + ${formatCoef(bVal)}`,
    };
  }

  return null;
}

function parseLinearEquationModel(source: string, extendedSource: string): ParsedLinearModel | null {
  const parsedSlope = parseNumber(source, 'm');
  const parsedIntercept = parseNumber(source, 'b');
  if (parsedSlope !== null && parsedIntercept !== null) {
    return {
      slope: parsedSlope,
      intercept: parsedIntercept,
      domainMax: 10,
      equation: `f(x) = ${formatCoef(parsedSlope)}x + ${formatCoef(parsedIntercept)}`,
    };
  }

  if (/sin coeficientes numéricos/i.test(source)) {
    return null;
  }

  return parseLinearFromText(source) || (extendedSource && extendedSource !== source ? parseLinearFromText(extendedSource) : null);
}

function tryBuildQuadraticDiagram(source: string): QuadraticDiagramSpec | null {
  if (!source) return null;
  const quadEqMatch = source.match(
    /(-?\d+(?:\.\d+)?)?\s*x(?:²|\^2)\s*([+-])\s*(\d+(?:\.\d+)?)?\s*x\s*([+-])\s*(\d+(?:\.\d+)?)\s*=\s*(-?\d+(?:\.\d+)?)/i
  );
  const quadFuncMatch = source.match(
    /(?:[A-Za-z]\([a-z]\)|y)\s*=\s*(-?\d+(?:\.\d+)?)?\s*x(?:²|\^2)\s*([+-])\s*(\d+(?:\.\d+)?)?\s*x\s*([+-])\s*(\d+(?:\.\d+)?)/i
  );
  const quadTwoTermFuncMatch = source.match(
    /(?:[A-Za-z]\([a-z]\)|y)\s*=\s*(-?\d+(?:\.\d+)?)?\s*x(?:²|\^2)\s*([+-])\s*(\d+(?:\.\d+)?)?\s*x(?![0-9A-Za-z+-])/i
  );
  const quadPureMatch = source.match(
    /(?:(?:[A-Za-z]\([a-z]\)|y)\s*=\s*)?(-?\d+(?:\.\d+)?)?\s*x(?:²|\^2)\s*([+-])\s*(\d+(?:\.\d+)?)\s*=\s*(-?\d+(?:\.\d+)?)/i
  );
  const quadFactoredMatch = source.match(
    /\bx\s*\(\s*x\s*([+-])\s*(\d+(?:\.\d+)?)\s*\)\s*=\s*(\d+(?:\.\d+)?)/i
  );
  const quadExplicitCoeffMatch = source.match(
    /\ba\s*=\s*(-?\d+(?:\.\d+)?)\s*,\s*b\s*=\s*(-?\d+(?:\.\d+)?)\s*(?:,\s*|\s+y\s+)c\s*=\s*(-?\d+(?:\.\d+)?)/i
  );
  const quadSumProdMatch = source.match(
    /multiplicados\s+den\s+(?:(menos)\s+|(-))?(\d+(?:\.\d+)?)\s+y\s+sumados\s+den\s+(?:m[aá]s\s+|(menos)\s+|([+-]))?(\d+(?:\.\d+)?)/i
  );
  const isQuadraticTopic =
    /ecuaci[oó]n(?:es)?\s+cuadr[aá]tica|funci[oó]n(?:es)?\s+cuadr[aá]tica|modelo\s+cuadr[aá]tico|par[aá]bol|segundo\s+grado|f[oó]rmula\s+general\s+cuadr[aá]tica|\bdiscriminante\b/i.test(
      source
    ) && !/inter[eé]s\s+(?:simple|compuesto)|crecimiento\s+(?:exponencial|poblacional)|muestra\s+estad[ií]stica/i.test(source);

  let a = 0;
  let b = 0;
  let c = 0;
  let equation = 'Modelo por construir';

  const m = quadEqMatch || quadFuncMatch;
  if (m) {
    a = m[1] ? Number(m[1]) : 1;
    if (a === 0) a = 1;
    b = (m[2] === '-' ? -1 : 1) * (m[3] ? Number(m[3]) : 1);
    const rhs = m[6] ? Number(m[6]) : 0;
    c = (m[4] === '-' ? -1 : 1) * Number(m[5]) - (quadEqMatch ? rhs : 0);
    const signB = b >= 0 ? '+' : '-';
    const signC = c >= 0 ? '+' : '-';
    equation = quadEqMatch
      ? `${formatCoef(a)}x² ${signB} ${formatCoef(Math.abs(b))}x ${signC} ${formatCoef(Math.abs(c))} = 0`
      : `f(x) = ${formatCoef(a)}x² ${signB} ${formatCoef(Math.abs(b))}x ${signC} ${formatCoef(Math.abs(c))}`;
  } else if (quadTwoTermFuncMatch) {
    a = quadTwoTermFuncMatch[1] ? Number(quadTwoTermFuncMatch[1]) : 1;
    if (a === 0) a = 1;
    b = (quadTwoTermFuncMatch[2] === '-' ? -1 : 1) * (quadTwoTermFuncMatch[3] ? Number(quadTwoTermFuncMatch[3]) : 1);
    c = 0;
    const signB = b >= 0 ? '+' : '-';
    equation = `f(x) = ${formatCoef(a)}x² ${signB} ${formatCoef(Math.abs(b))}x`;
  } else if (quadExplicitCoeffMatch && Number(quadExplicitCoeffMatch[1]) !== 0) {
    a = Number(quadExplicitCoeffMatch[1]);
    b = Number(quadExplicitCoeffMatch[2]);
    c = Number(quadExplicitCoeffMatch[3]);
    const signB = b >= 0 ? '+' : '-';
    const signC = c >= 0 ? '+' : '-';
    equation = c === 0
      ? `f(x) = ${formatCoef(a)}x² ${signB} ${formatCoef(Math.abs(b))}x`
      : `${formatCoef(a)}x² ${signB} ${formatCoef(Math.abs(b))}x ${signC} ${formatCoef(Math.abs(c))} = 0`;
  } else if (quadFactoredMatch) {
    a = 1;
    b = (quadFactoredMatch[1] === '-' ? -1 : 1) * Number(quadFactoredMatch[2]);
    c = -Number(quadFactoredMatch[3]);
    const signB = b >= 0 ? '+' : '-';
    equation = `x² ${signB} ${formatCoef(Math.abs(b))}x - ${formatCoef(Math.abs(c))} = 0`;
  } else if (quadSumProdMatch) {
    a = 1;
    const prodNeg = Boolean(quadSumProdMatch[1] || quadSumProdMatch[2]);
    const prodMag = Number(quadSumProdMatch[3]);
    const sumNeg = Boolean(quadSumProdMatch[4] || quadSumProdMatch[5] === '-');
    const sumMag = Number(quadSumProdMatch[6]);
    b = sumNeg ? -sumMag : sumMag;
    c = prodNeg ? -prodMag : prodMag;
    const signB = b >= 0 ? '+' : '-';
    const signC = c >= 0 ? '+' : '-';
    equation = `x² ${signB} ${formatCoef(Math.abs(b))}x ${signC} ${formatCoef(Math.abs(c))} = 0`;
  } else if (quadPureMatch) {
    a = quadPureMatch[1] ? Number(quadPureMatch[1]) : 1;
    if (a === 0) a = 1;
    b = 0;
    const rhs = quadPureMatch[4] ? Number(quadPureMatch[4]) : 0;
    c = (quadPureMatch[2] === '-' ? -1 : 1) * Number(quadPureMatch[3]) - rhs;
    const signC = c >= 0 ? '+' : '-';
    equation = `${formatCoef(a)}x² ${signC} ${formatCoef(Math.abs(c))} = 0`;
  } else if (isQuadraticTopic) {
    return {
      kind: 'quadratic',
      available: false,
      equation: 'Modelo por construir',
      a: 0,
      b: 0,
      c: 0,
      vertexX: 0,
      vertexY: 0,
      roots: [],
      xMin: -5,
      xMax: 5,
      yMin: -5,
      yMax: 5,
      samples: [],
      xLabel: 'Eje x (variable)',
      yLabel: 'Modelo por construir',
    };
  } else {
    return null;
  }

  const vertexX = -b / (2 * a);
  const vertexY = a * vertexX * vertexX + b * vertexX + c;
  const disc = b * b - 4 * a * c;
  const roots: number[] = [];
  if (disc > 0) {
    const r1 = (-b - Math.sqrt(disc)) / (2 * a);
    const r2 = (-b + Math.sqrt(disc)) / (2 * a);
    roots.push(Number(Math.min(r1, r2).toFixed(2)), Number(Math.max(r1, r2).toFixed(2)));
  } else if (disc === 0) {
    roots.push(Number(vertexX.toFixed(2)));
  }

  const halfSpan = Math.max(5, roots.length === 2 ? Math.abs(roots[1] - roots[0]) * 0.85 : 6);
  const xMin = Math.floor(vertexX - halfSpan);
  const xMax = Math.ceil(vertexX + halfSpan);
  const samples: Array<{ x: number; y: number }> = [];
  const steps = 28;
  let yMinRaw = Math.min(0, vertexY);
  let yMaxRaw = Math.max(0, vertexY);

  for (let i = 0; i <= steps; i++) {
    const x = xMin + ((xMax - xMin) * i) / steps;
    const y = a * x * x + b * x + c;
    samples.push({ x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) });
    yMinRaw = Math.min(yMinRaw, y);
    yMaxRaw = Math.max(yMaxRaw, y);
  }
  const yPad = Math.max(4, (yMaxRaw - yMinRaw) * 0.12);

  return {
    kind: 'quadratic',
    available: true,
    equation,
    a: Number(a.toFixed(2)),
    b: Number(b.toFixed(2)),
    c: Number(c.toFixed(2)),
    vertexX: Number(vertexX.toFixed(2)),
    vertexY: Number(vertexY.toFixed(2)),
    roots,
    xMin,
    xMax,
    yMin: Number((yMinRaw - yPad).toFixed(1)),
    yMax: Number((yMaxRaw + yPad).toFixed(1)),
    samples,
    xLabel: 'Eje x (variable)',
    yLabel: 'f(x) = ax² + bx + c',
  };
}

function tryBuildSystem2x2Diagram(source: string): System2x2DiagramSpec | null {
  if (!source) return null;
  const sysTopic =
    /sistema[s]?\s+(?:de\s+ecuaciones|lineal(?:es)?(?:\s*2x2)?)|\b2x2\b|m[eé]todo\s+de\s+(?:igualaci[oó]n|sustituci[oó]n|reducci[oó]n|eliminaci[oó]n|determinantes|cramer)|regla\s+de\s+cramer/i.test(
      source
    );
  const twoVarEqRe = /(-?\d+(?:\.\d+)?)?\s*x\s*([+-])\s*(\d+(?:\.\d+)?)?\s*y\s*=\s*(-?\d+(?:\.\d+)?)/gi;
  const parsed: Array<{ a: number; b: number; c: number; eq: string }> = [];
  const collinearFallback: Array<{ a: number; b: number; c: number; eq: string }> = [];

  for (const m of source.matchAll(twoVarEqRe)) {
    const a = m[1] ? Number(m[1]) : 1;
    const bSign = m[2] === '-' ? -1 : 1;
    const bMag = m[3] ? Number(m[3]) : 1;
    const b = bSign * bMag;
    const c = Number(m[4]);
    if (Number.isFinite(a) && Number.isFinite(b) && Number.isFinite(c) && b !== 0) {
      const label = `${formatCoef(a)}x ${m[2]} ${formatCoef(bMag)}y = ${formatCoef(c)}`;
      if (!parsed.some((p) => p.eq === label)) {
        if (parsed.length === 1 && Math.abs(parsed[0].a * b - a * parsed[0].b) < 1e-6) {
          collinearFallback.push({ a, b, c, eq: label });
        } else {
          parsed.push({ a, b, c, eq: label });
        }
      }
    }
    if (parsed.length >= 2) break;
  }

  // Coeficientes explícitos tipo Cramer: a1=1, b1=1, c1=20 y a2=1, b2=-1, c2=4
  if (parsed.length < 2) {
    const cramerCoeffMatch = source.match(
      /a[₁1]\s*=\s*(-?\d+(?:\.\d+)?)\s*,\s*b[₁1]\s*=\s*(-?\d+(?:\.\d+)?)\s*,\s*c[₁1]\s*=\s*(-?\d+(?:\.\d+)?)[\s\S]{0,30}?a[₂2]\s*=\s*(-?\d+(?:\.\d+)?)\s*,\s*b[₂2]\s*=\s*(-?\d+(?:\.\d+)?)\s*,\s*c[₂2]\s*=\s*(-?\d+(?:\.\d+)?)/i
    );
    if (cramerCoeffMatch) {
      const a1 = Number(cramerCoeffMatch[1]);
      const b1 = Number(cramerCoeffMatch[2]);
      const c1 = Number(cramerCoeffMatch[3]);
      const a2 = Number(cramerCoeffMatch[4]);
      const b2 = Number(cramerCoeffMatch[5]);
      const c2 = Number(cramerCoeffMatch[6]);
      if (b1 !== 0 && b2 !== 0) {
        parsed.length = 0;
        parsed.push(
          { a: a1, b: b1, c: c1, eq: `${formatCoef(a1)}x ${b1 >= 0 ? '+' : '-'} ${formatCoef(Math.abs(b1))}y = ${formatCoef(c1)}` },
          { a: a2, b: b2, c: c2, eq: `${formatCoef(a2)}x ${b2 >= 0 ? '+' : '-'} ${formatCoef(Math.abs(b2))}y = ${formatCoef(c2)}` }
        );
      }
    }
  }

  // Ecuaciones de sustitución despejadas: x = ky, y = kx, x = c - ky, y = c - kx
  if (parsed.length === 1) {
    const subXEqKy = source.match(/\bx\s*=\s*(-?\d+(?:\.\d+)?)?\s*y(?![0-9A-Za-z+-])/i);
    const subYEqKx = source.match(/\by\s*=\s*(-?\d+(?:\.\d+)?)?\s*x(?![0-9A-Za-z+-])/i);
    if (subXEqKy) {
      const k = subXEqKy[1] ? Number(subXEqKy[1]) : 1;
      if (k !== 0) {
        parsed.push({ a: 1, b: -k, c: 0, eq: `x - ${formatCoef(k)}y = 0` });
      }
    } else if (subYEqKx) {
      const k = subYEqKx[1] ? Number(subYEqKx[1]) : 1;
      if (k !== 0) {
        parsed.push({ a: k, b: -1, c: 0, eq: `${formatCoef(k)}x - y = 0` });
      }
    }
  }

  if (parsed.length === 1 && collinearFallback.length > 0) {
    parsed.push(collinearFallback[0]);
  }

  if (parsed.length < 2) {
    if (!sysTopic) return null;
    return {
      kind: 'system-2x2',
      available: false,
      equation1: 'Modelo por construir',
      equation2: 'Modelo por construir',
      a1: 0,
      b1: 1,
      c1: 0,
      a2: 0,
      b2: 1,
      c2: 0,
      intersection: null,
      xMin: 0,
      xMax: 10,
      yMin: 0,
      yMax: 10,
      xLabel: 'Variable x',
      yLabel: 'Variable y',
    };
  }

  const eqA = parsed[0]!;
  const eqB = parsed[1]!;
  const det = eqA.a * eqB.b - eqB.a * eqA.b;
  const intersection =
    Math.abs(det) > 1e-6
      ? {
          x: Number(((eqA.c * eqB.b - eqB.c * eqA.b) / det).toFixed(2)),
          y: Number(((eqA.a * eqB.c - eqB.a * eqA.c) / det).toFixed(2)),
        }
      : null;

  const cx = intersection?.x ?? 3;
  const cy = intersection?.y ?? 2;
  const span = Math.max(6, Math.ceil(Math.max(Math.abs(cx), Math.abs(cy)) * 1.4));
  const xMin = Math.min(0, Math.floor(cx - span));
  const xMax = Math.max(span, Math.ceil(cx + span * 0.7));

  const evalLine = (eq: { a: number; b: number; c: number }, xVal: number) => (eq.c - eq.a * xVal) / eq.b;
  const ys = [evalLine(eqA, xMin), evalLine(eqA, xMax), evalLine(eqB, xMin), evalLine(eqB, xMax), cy, 0];
  const yMin = Math.floor(Math.min(...ys) - 2);
  const yMax = Math.ceil(Math.max(...ys) + 2);

  return {
    kind: 'system-2x2',
    available: true,
    equation1: eqA.eq,
    equation2: eqB.eq,
    a1: eqA.a,
    b1: eqA.b,
    c1: eqA.c,
    a2: eqB.a,
    b2: eqB.b,
    c2: eqB.c,
    intersection,
    xMin,
    xMax,
    yMin,
    yMax,
    xLabel: 'Variable x',
    yLabel: 'Variable y',
  };
}

function tryBuildExponentialDiagram(source: string): ExponentialDiagramSpec | null {
  if (
    !source ||
    !/inter[eé]s\s+(?:simple|compuesto)|capitalizaci[oó]n|crecimiento\s+(?:exponencial|poblacional|demogr[aá]fico)|tasa\s+(?:de\s+crecimiento|anual|de\s+inter[eé]s)|P\(t\)\s*=\s*P[₀0]|M\s*=\s*C[₀0]?\s*\(/i.test(
      source
    )
  ) {
    return null;
  }
  const isExplicitExponentialTopic =
    /inter[eé]s\s+(?:simple|compuesto)|capitalizaci[oó]n|crecimiento\s+exponencial|funci[oó]n\s+exponencial/i.test(
      source
    );
  const isPopulation =
    /poblaci[oó]n|habitantes|demogr[aá]fic|P\(t\)/i.test(source) && !/inter[eé]s\s+(?:simple|compuesto)|cr[eé]dito|inversi[oó]n/i.test(source);
  const capitalMatch = source.match(
    /(?:capital|monto\s+inicial|inversi[oó]n|poblaci[oó]n(?:\s+inicial|\s+actual|\s+de)?|P\(t\)\s*=|P[₀0]\s*=|C[₀0]\s*=|\$)\s*(?:de\s*)?\$?\s*(\d[\d,]{1,6})/i
  ) || source.match(/\b(\d{3,6})\s*(?:habitantes|personas|pesos|individuos)\b/i);
  const rateMatch = source.match(/(\d+(?:\.\d+)?)\s*%/) || source.match(/1\s*\+\s*0\.(\d{1,3})/);

  // Si no hay tasa explícita (%) ni es explícitamente un tema de interés/crecimiento exponencial, no secuestrar modelos lineales
  if (!rateMatch && !isExplicitExponentialTopic) {
    return null;
  }

  if (!capitalMatch && !rateMatch) {
    return {
      kind: 'exponential',
      available: false,
      equation: 'Modelo por construir',
      principal: 0,
      rate: 0,
      periods: 6,
      simpleSeries: [],
      compoundSeries: [],
      yMax: 100,
      xLabel: 'Períodos (t)',
      yLabel: isPopulation ? 'Población P(t)' : 'Monto acumulado ($)',
    };
  }
  const principal = capitalMatch ? Math.min(100000, Math.max(50, Number(capitalMatch[1].replace(/,/g, '')))) : 1000;
  let ratePct = 10;
  if (rateMatch) {
    const rawRate = rateMatch[0].includes('1') && !rateMatch[0].includes('%')
      ? Number(`0.${rateMatch[1]}`) * 100
      : Number(rateMatch[1]);
    ratePct = Math.min(50, Math.max(0.5, rawRate));
  }
  const rate = ratePct / 100;
  const periods = 6;
  const simpleSeries: Array<{ t: number; value: number }> = [];
  const compoundSeries: Array<{ t: number; value: number }> = [];

  for (let t = 0; t <= periods; t++) {
    simpleSeries.push({ t, value: Math.round(principal * (1 + rate * t)) });
    compoundSeries.push({ t, value: Math.round(principal * Math.pow(1 + rate, t)) });
  }
  const maxVal = Math.max(...compoundSeries.map((p) => p.value));
  return {
    kind: 'exponential',
    available: true,
    equation: isPopulation
      ? `P(t) = P₀(1 + r)ᵗ  (P₀=${principal}, r=${ratePct}%)`
      : `M = C₀(1 + r)ᵗ  (C₀=${principal}, r=${ratePct}%)`,
    principal,
    rate,
    periods,
    simpleSeries,
    compoundSeries,
    yMax: Math.ceil((maxVal * 1.1) / 50) * 50,
    xLabel: 'Períodos (t)',
    yLabel: isPopulation ? 'Población P(t)' : 'Monto acumulado ($)',
  };
}

function tryBuildGeometryDiagram(source: string): GeometryDiagramSpec | null {
  const isAngle = /tipos?\s+de\s+[aá]ngulos|[aá]ngulos?\s+(?:agudo|recto|obtuso|llano|complementarios|suplementarios)|paralelas.*transversal/i.test(source);
  const isTriangle =
    /pit[aá]goras|tri[aá]ngulo\s+rect[aá]ngulo|hipotenusa|cateto|\b(?:sen|cos|tan)\s*(?:[θ°αβ]|\d+\s*°|\([A-Za-z0-9θ°\s+-]+\))|trigonometr/i.test(
      source
    );
  const isPolygon = /[aá]rea\s+y\s+per[ií]metro|per[ií]metro\s+del\s+rect[aá]ngulo|congruencia\s+de\s+tri[aá]ngulos/i.test(source);

  if (!isAngle && !isTriangle && !isPolygon) return null;

  if (isTriangle) {
    return {
      kind: 'geometry',
      variant: 'right-triangle',
      available: true,
      equation: 'c² = a² + b²  |  Ángulo A + Ángulo B = 90°',
      primaryLabel: 'Catetos a, b e hipotenusa c',
      secondaryLabel: 'Ángulo recto = 90°',
      highlights: [
        { label: 'Catetos', detail: 'Lados perpendiculares que forman 90° (a y b).' },
        { label: 'Hipotenusa', detail: 'Lado mayor opuesto al ángulo recto (c = √(a² + b²)).' },
        { label: 'Suma angular', detail: 'Los ángulos agudos son complementarios (90°).' },
      ],
    };
  }

  if (isAngle) {
    return {
      kind: 'geometry',
      variant: 'angles',
      available: true,
      equation: 'Agudo < 90°  |  Recto = 90°  |  Obtuso > 90°  |  Llano = 180°',
      primaryLabel: 'Clasificación por abertura angular',
      secondaryLabel: 'Complementarios = 90° · Suplementarios = 180°',
      highlights: [
        { label: 'Agudo', detail: 'Abertura mayor a 0° y menor a 90°.' },
        { label: 'Recto', detail: 'Exactamente 90° (rectas perpendiculares).' },
        { label: 'Obtuso', detail: 'Mayor a 90° y menor a 180°.' },
      ],
    };
  }

  return {
    kind: 'geometry',
    variant: 'polygon',
    available: true,
    equation: 'P = 2(b + h)  |  A = b · h',
    primaryLabel: 'Relación de dimensiones y contorno',
    secondaryLabel: 'Unidades lineales vs. cuadradas',
    highlights: [
      { label: 'Base y altura', detail: 'Dimensiones ortogonales del espacio o polígono.' },
      { label: 'Perímetro', detail: 'Suma total de los lados del contorno.' },
      { label: 'Área', detail: 'Superficie interior delimitada por el perímetro.' },
    ],
  };
}

function findReactionEquation(mission: MissionSection): { left: string; right: string } | null {
  const sources = [
    mission.conceptZero?.coreExplanation,
    mission.conceptZero?.physicalAnalogy,
    mission.conceptZero?.solvedExample?.problemStatement,
    ...(mission.conceptZero?.solvedExample?.solutionSteps ?? []),
    mission.iDoSection?.visualOrDiagram,
    mission.iDoSection?.stepByStepDemo,
    mission.weDoSection?.guidedPractice,
  ];
  const arrowPattern = /([^.;:]{2,100}?)\s*(?:→|⟶|->|=>|⇒)\s*([^.;:]{2,100})/;
  const speciesPattern = /(?:^|\s)(?:\d+)?[A-Z][a-z]?(?:\d+)?(?:\([A-Za-z0-9]+\)\d*)?/;

  for (const source of sources) {
    const text = clean(source);
    const match = text.match(arrowPattern);
    if (!match) continue;
    const left = clean(match[1]);
    const right = clean(match[2]);
    const hasPlus = left.includes('+') || right.includes('+');
    const hasQuantity = /\d/.test(left) || /\d/.test(right);
    if (speciesPattern.test(left) && speciesPattern.test(right) && (hasPlus || hasQuantity)) {
      return { left, right };
    }
  }
  return null;
}

function normalizeSpecies(value: string): string {
  const tokens = clean(value).split(' ').filter(Boolean);
  const last = (tokens[tokens.length - 1] ?? '').replace(/[.,;]+$/, '');
  const coefficient = tokens.length >= 2 && /^\d+$/.test(tokens[tokens.length - 2]) ? tokens[tokens.length - 2] : '';
  return `${coefficient}${last}`;
}

function splitSpecies(value: string): string[] {
  return value
    .split(/\s*\+\s*/)
    .map(normalizeSpecies)
    .filter((species) => /^(?:\d+)?[A-Z][a-z]?(?:\d+)?(?:\([A-Za-z0-9]+\)\d*)?/.test(species))
    .slice(0, 2);
}

function buildReactionDiagram(mission: MissionSection): ReactionDiagramSpec {
  const equation = findReactionEquation(mission);
  const procedure = detail(
    mission.iDoSection?.stepByStepDemo || mission.sessionFocus,
    110,
    'Proceso por documentar.'
  );
  const evidence = detail(
    mission.conceptZero?.solvedExample?.interpretation || mission.formativeCheckpoint?.question,
    130,
    'Evidencia por construir.'
  );

  if (equation) {
    const reactants = splitSpecies(equation.left);
    const products = splitSpecies(equation.right);
    const equationLabel = `${reactants.join(' + ') || equation.left} → ${products.join(' + ') || equation.right}`;
    return {
      kind: 'reaction',
      available: true,
      equation: clip(equationLabel, 86),
      reactants: reactants.map((formula, index) => ({
        label: formula,
        detail: `REACTIVO ${index + 1}`,
      })),
      products: products.map((formula, index) => ({
        label: formula,
        detail: `PRODUCTO ${index + 1}`,
      })),
      condition: detail(mission.sessionTopic, 80, 'Transformación por describir.'),
      note: evidence,
    };
  }

  return {
    kind: 'reaction',
    available: false,
    equation: 'ECUACIÓN POR CONSTRUIR',
    reactants: [
      {
        label: 'SISTEMA INICIAL',
        detail: detail(mission.conceptZero?.physicalAnalogy || mission.conceptZero?.coreExplanation, 120),
      },
    ],
    products: [
      {
        label: 'SISTEMA RESULTANTE',
        detail: detail(mission.conceptZero?.solvedExample?.interpretation || mission.formativeCheckpoint?.question, 120),
      },
    ],
    condition: procedure,
    note: evidence,
  };
}

function buildArgumentDiagram(mission: MissionSection): ArgumentDiagramSpec {
  const contrast = mission.conceptZero?.contrastTable?.[0];
  const thesisDetail = detail(mission.sessionFocus || mission.conceptZero?.coreExplanation || mission.sessionTopic, 160);
  const solvedPremises = (mission.conceptZero?.solvedExample?.solutionSteps ?? [])
    .map(clean)
    .filter(Boolean)
    .slice(0, 2);
  const fallbackPremises = [
    detail(mission.conceptZero?.physicalAnalogy, 135),
    detail(contrast?.reasoning || mission.conceptZero?.coreExplanation, 135),
  ];
  const premiseDetails = [...solvedPremises, ...fallbackPremises].slice(0, 2);
  const objectionDetail = detail(contrast?.commonMisconception, 160, 'Sin objeción registrada.');
  const conclusionDetail = detail(
    contrast?.correctConcept || mission.conceptZero?.solvedExample?.interpretation,
    160,
    'Conclusión por construir.'
  );

  return {
    kind: 'argument',
    available: Boolean(thesisDetail && conclusionDetail !== 'Conclusión por construir.'),
    thesis: { label: 'TESIS', detail: thesisDetail || 'Tesis por construir.' },
    premises: premiseDetails.map((premise, index) => ({
      label: `PREMISA ${index + 1}`,
      detail: premise || 'Premisa por construir.',
    })),
    objection: { label: 'OBJECIÓN', detail: objectionDetail },
    conclusion: { label: 'CONCLUSIÓN', detail: conclusionDetail },
  };
}

function buildLanguageDiagram(mission: MissionSection): LanguageDiagramSpec {
  const input = detail(mission.sessionFocus || mission.sessionTopic, 150, 'Entrada por construir.');
  const rule = detail(mission.conceptZero?.coreExplanation, 160, 'Regla por construir.');
  const output = detail(
    mission.youDoSection?.autonomousChallenge || mission.weDoSection?.guidedPractice,
    160,
    'Producción por construir.'
  );
  const context = detail(
    mission.phenomenonHook?.detonatingQuestion || mission.formativeCheckpoint?.question,
    150,
    'Propósito por construir.'
  );

  return {
    kind: 'language',
    available: Boolean(input && rule && output),
    input: { label: 'ENTRADA / INPUT', detail: input },
    rule: { label: 'REGLA / FORMA', detail: rule },
    output: { label: 'PRODUCCIÓN / OUTPUT', detail: output },
    context: { label: 'PROPÓSITO / CONTEXTO', detail: context },
  };
}

function buildConceptDiagram(mission: MissionSection): ConceptDiagramSpec {
  const nodes: SacrintDiagramNode[] = [
    { label: 'FENÓMENO', detail: detail(mission.phenomenonHook?.story, 120) },
    { label: 'CONCEPTO', detail: detail(mission.conceptZero?.coreExplanation, 120) },
    { label: 'PRÁCTICA', detail: detail(mission.weDoSection?.guidedPractice, 120) },
    { label: 'PROYECTO', detail: detail(mission.youDoSection?.autonomousChallenge, 120) },
  ];

  return {
    kind: 'concept',
    available: nodes.some((node) => node.detail !== 'Sin registro.'),
    center: {
      label: 'CONCEPTO CENTRAL',
      detail: detail(mission.sessionTopic || mission.title, 90, 'Concepto por construir.'),
    },
    nodes,
  };
}

const TIMELINE_LABELS = ['ORIGEN', 'PROCESO', 'CONSECUENCIA', 'BALANCE'];

function buildTimelineDiagram(mission: MissionSection): TimelineDiagramSpec {
  const solved = (mission.conceptZero?.solvedExample?.solutionSteps ?? []).map(clean).filter(Boolean);
  const narrative = [
    firstSentence(mission.phenomenonHook?.story, 120),
    detail(mission.conceptZero?.coreExplanation, 120),
    detail(mission.iDoSection?.stepByStepDemo, 120),
    detail(mission.youDoSection?.autonomousChallenge, 120),
  ].filter(Boolean);
  const source = solved.length >= 3 ? solved.slice(0, 4) : narrative.slice(0, 4);
  const events = source.map((text, index) => ({
    label: TIMELINE_LABELS[index] ?? `HITO ${index + 1}`,
    detail: detail(text, 120),
  }));

  return {
    kind: 'timeline',
    available: events.length >= 3 && events.some((event) => event.detail !== 'Sin registro.'),
    events,
    span: clip(mission.sessionTopic || mission.title, 60),
  };
}

function buildSystemMapDiagram(mission: MissionSection): SystemMapDiagramSpec {
  const components: SacrintDiagramNode[] = [
    { label: 'ESTÍMULO', detail: detail(mission.phenomenonHook?.story, 110) },
    { label: 'MECANISMO', detail: detail(mission.conceptZero?.coreExplanation, 110) },
    { label: 'RESPUESTA', detail: detail(mission.weDoSection?.guidedPractice, 110) },
    { label: 'ADAPTACIÓN', detail: detail(mission.youDoSection?.autonomousChallenge, 110) },
  ];

  return {
    kind: 'system-map',
    available: components.some((node) => node.detail !== 'Sin registro.'),
    center: {
      label: 'SISTEMA',
      detail: detail(mission.sessionTopic || mission.title, 80, 'Sistema por construir.'),
    },
    components,
    environment: {
      label: 'ENTORNO',
      detail: detail(
        mission.formativeCheckpoint?.question || mission.phenomenonHook?.detonatingQuestion,
        130,
        'Entorno por describir.'
      ),
    },
  };
}

const CLINICAL_STAGE_LABELS = ['SÍNTOMA', 'EVALUACIÓN', 'DIAGNÓSTICO', 'CUIDADO'];

function buildClinicalFlowDiagram(mission: MissionSection): ClinicalFlowDiagramSpec {
  const sources = [
    firstSentence(mission.phenomenonHook?.story, 110),
    detail(mission.formativeCheckpoint?.question, 110),
    detail(mission.conceptZero?.coreExplanation, 110),
    detail(mission.weDoSection?.guidedPractice || mission.youDoSection?.autonomousChallenge, 110),
  ];
  const stages = sources.map((text, index) => ({
    label: CLINICAL_STAGE_LABELS[index] ?? `ETAPA ${index + 1}`,
    detail: text || 'Sin registro.',
  }));

  return {
    kind: 'clinical-flow',
    available: stages.some((stage) => stage.detail !== 'Sin registro.'),
    stages,
    note: detail(
      mission.conceptZero?.solvedExample?.interpretation || mission.metacognitiveTrafficLight?.green,
      140,
      'Evidencia por documentar.'
    ),
  };
}

function buildBlockDiagram(mission: MissionSection): BlockDiagramSpec {
  const input = detail(mission.sessionFocus || mission.sessionTopic, 130, 'Entrada por definir.');
  const process = detail(mission.conceptZero?.coreExplanation, 140, 'Proceso por construir.');
  const output = detail(
    mission.youDoSection?.autonomousChallenge || mission.weDoSection?.guidedPractice,
    130,
    'Salida por producir.'
  );
  const feedback = detail(mission.formativeCheckpoint?.question, 130, 'Control por definir.');

  return {
    kind: 'block-diagram',
    available: Boolean(input && process && output),
    input: { label: 'ENTRADA', detail: input },
    process: { label: 'PROCESO', detail: process },
    output: { label: 'SALIDA', detail: output },
    feedback: { label: 'CONTROL', detail: feedback },
  };
}

const SOP_STEP_LABELS = ['PREPARACIÓN', 'EJECUCIÓN', 'VERIFICACIÓN', 'ENTREGA'];

function buildSopFlowDiagram(mission: MissionSection): SopFlowDiagramSpec {
  const solved = (mission.conceptZero?.solvedExample?.solutionSteps ?? []).map(clean).filter(Boolean);
  const fallback = [
    detail(mission.iDoSection?.stepByStepDemo, 120),
    detail(mission.weDoSection?.guidedPractice, 120),
    detail(mission.youDoSection?.autonomousChallenge, 120),
    detail(mission.metacognitiveTrafficLight?.green, 120),
  ];
  const source = solved.length >= 4 ? solved.slice(0, 4) : [...solved, ...fallback].filter(Boolean).slice(0, 4);
  const steps = source.map((text, index) => ({
    label: SOP_STEP_LABELS[index] ?? `PASO ${index + 1}`,
    detail: detail(text, 120),
  }));

  return {
    kind: 'sop-flow',
    available: steps.length >= 3 && steps.some((step) => step.detail !== 'Sin registro.'),
    steps,
    standard: detail(
      mission.conceptZero?.contrastTable?.[0]?.correctConcept || mission.conceptZero?.solvedExample?.interpretation,
      130,
      'Estándar por definir.'
    ),
  };
}

const CREATIVE_PHASE_LABELS = ['DETONANTE', 'EXPLORACIÓN', 'OBRA', 'DIFUSIÓN'];

function buildCreativeCycleDiagram(mission: MissionSection): CreativeCycleDiagramSpec {
  const sources = [
    firstSentence(mission.phenomenonHook?.story, 110),
    detail(mission.conceptZero?.coreExplanation, 110),
    detail(mission.iDoSection?.stepByStepDemo || mission.weDoSection?.guidedPractice, 110),
    detail(mission.youDoSection?.autonomousChallenge, 110),
  ];
  const phases = sources.map((text, index) => ({
    label: CREATIVE_PHASE_LABELS[index] ?? `FASE ${index + 1}`,
    detail: text || 'Sin registro.',
  }));

  return {
    kind: 'creative-cycle',
    available: phases.some((phase) => phase.detail !== 'Sin registro.'),
    phases,
    statement: detail(
      mission.conceptZero?.solvedExample?.interpretation || mission.conceptZero?.contrastTable?.[0]?.correctConcept,
      140,
      'Declaración artística por construir.'
    ),
  };
}

const TRAINING_PHASE_LABELS = ['CALENTAMIENTO', 'ACTIVACIÓN', 'ESFUERZO', 'RECUPERACIÓN'];

function buildTrainingCycleDiagram(mission: MissionSection): TrainingCycleDiagramSpec {
  const sources = [
    firstSentence(mission.phenomenonHook?.story, 110),
    detail(mission.conceptZero?.coreExplanation, 110),
    detail(mission.iDoSection?.stepByStepDemo || mission.weDoSection?.guidedPractice, 110),
    detail(mission.youDoSection?.autonomousChallenge, 110),
  ];
  const phases = sources.map((text, index) => ({
    label: TRAINING_PHASE_LABELS[index] ?? `FASE ${index + 1}`,
    detail: text || 'Sin registro.',
  }));

  return {
    kind: 'training-cycle',
    available: phases.some((phase) => phase.detail !== 'Sin registro.'),
    phases,
    principle: detail(
      mission.conceptZero?.contrastTable?.[0]?.correctConcept || mission.conceptZero?.solvedExample?.interpretation,
      140,
      'Principio de entrenamiento por definir.'
    ),
  };
}

const REGULATION_STAGE_LABELS = ['EMOCIÓN', 'INTERPRETACIÓN', 'RESPUESTA', 'REGULACIÓN'];

function buildRegulationFlowDiagram(mission: MissionSection): RegulationFlowDiagramSpec {
  const sources = [
    firstSentence(mission.phenomenonHook?.story, 110),
    detail(mission.conceptZero?.coreExplanation, 110),
    detail(mission.weDoSection?.guidedPractice || mission.iDoSection?.stepByStepDemo, 110),
    detail(mission.youDoSection?.autonomousChallenge, 110),
  ];
  const stages = sources.map((text, index) => ({
    label: REGULATION_STAGE_LABELS[index] ?? `ETAPA ${index + 1}`,
    detail: text || 'Sin registro.',
  }));

  return {
    kind: 'regulation-flow',
    available: stages.some((stage) => stage.detail !== 'Sin registro.'),
    stages,
    anchor: detail(
      mission.conceptZero?.solvedExample?.interpretation || mission.metacognitiveTrafficLight?.green,
      140,
      'Anclaje de regulación por definir.'
    ),
  };
}

function buildUnavailableLinearDiagram(options: DiagramBuildOptions): LinearDiagramSpec {
  return {
    kind: 'linear',
    available: false,
    equation: 'y = mx + b',
    slope: 0,
    intercept: 0,
    domainMax: 10,
    rangeMax: 10,
    points: [],
    xLabel: options.xLabel || 'VARIABLE INDEPENDIENTE (x)',
    yLabel: options.yLabel || 'VARIABLE DEPENDIENTE (y)',
  };
}

function buildLinearDiagramSpec(linearDirect: ParsedLinearModel, options: DiagramBuildOptions): LinearDiagramSpec {
  const { slope, intercept, domainMax, targetY, equation } = linearDirect;
  const yAtEnd = slope * domainMax + intercept;
  const rawMax = Math.max(4, intercept, yAtEnd, targetY ?? 0);
  const step = niceTickStep(rawMax, 5);
  const rangeMax = domainMax <= 10 && rawMax <= 12
    ? Math.max(4, Math.ceil(rawMax / 2) * 2)
    : Math.ceil(rawMax / step) * step;
  const sampleXs = domainMax <= 10 ? [0, 4, 8] : [0, Math.round(domainMax / 2), domainMax];
  const points = sampleXs.filter((x) => x <= domainMax).map((x) => ({ x, y: Number((slope * x + intercept).toFixed(2)) }));

  return {
    kind: 'linear',
    available: true,
    equation,
    slope,
    intercept,
    domainMax,
    rangeMax,
    points,
    xLabel: options.xLabel || 'VARIABLE INDEPENDIENTE (x)',
    yLabel: options.yLabel || 'VARIABLE DEPENDIENTE (y)',
    targetY,
  };
}

function pickAvailableOrFallback<T extends { available: boolean }>(
  primary: T | null,
  secondary: T | null
): T | null {
  if (primary?.available) return primary;
  if (secondary?.available) return secondary;
  return primary ?? secondary;
}

function tryDetectDiagramFromTexts(
  primaryText: string,
  secondaryText: string,
  options: DiagramBuildOptions
): SacrintDiagramSpec | null {
  if (!primaryText && !secondaryText) return null;

  // 1. Ecuación o función cuadrática (parábola real o estado por construir si solo hay tema)
  const quadratic = pickAvailableOrFallback(
    tryBuildQuadraticDiagram(primaryText),
    tryBuildQuadraticDiagram(secondaryText)
  );
  if (quadratic) return quadratic;

  // 2. Sistema de ecuaciones lineales 2x2 (rectas secantes e intersección o estado por construir)
  const system2x2 = pickAvailableOrFallback(
    tryBuildSystem2x2Diagram(primaryText),
    tryBuildSystem2x2Diagram(secondaryText)
  );
  if (system2x2) return system2x2;

  // 3. Interés simple vs. compuesto / crecimiento exponencial
  const exponential = pickAvailableOrFallback(
    tryBuildExponentialDiagram(primaryText),
    tryBuildExponentialDiagram(secondaryText)
  );
  if (exponential) return exponential;

  // 4. Geometría plana (ángulos, triángulos, áreas y perímetros sin pendiente lineal explícita)
  const linearDirect = parseLinearEquationModel(primaryText, secondaryText);
  const geometry = tryBuildGeometryDiagram(primaryText) || tryBuildGeometryDiagram(secondaryText);
  if (geometry && (!linearDirect || /tipos?\s+de\s+[aá]ngulos|pit[aá]goras/i.test(secondaryText))) {
    return geometry;
  }

  // 5. Modelo lineal (y = mx + b o ecuación balance ax ± b = c con coeficientes auténticos)
  if (linearDirect) {
    return buildLinearDiagramSpec(linearDirect, options);
  }

  return null;
}

function buildMathDiagram(mission: MissionSection, options: DiagramBuildOptions): SacrintDiagramSpec {
  if (options.session) {
    const sessionCore = cleanSacrintText(collectSessionCoreSource(options.session));
    const sessionFull = cleanSacrintText(collectSessionFullSource(options.session));
    if (/sin coeficientes numéricos/i.test(sessionFull)) {
      return buildUnavailableLinearDiagram(options);
    }
    const sessionMatch = tryDetectDiagramFromTexts(sessionCore, sessionFull, options);
    if (sessionMatch) return sessionMatch;
    if (options.allowMissionFallback === false) {
      return buildUnavailableLinearDiagram(options);
    }
  }

  const missionCoreSource = cleanSacrintText(
    [
      mission.conceptZero?.coreExplanation,
      mission.iDoSection?.stepByStepDemo,
      mission.conceptZero?.solvedExample?.solutionSteps?.join(' '),
    ]
      .filter(Boolean)
      .join(' ')
  );

  if (/sin coeficientes numéricos/i.test(missionCoreSource)) {
    return buildUnavailableLinearDiagram(options);
  }

  const missionExtendedSource = cleanSacrintText(collectMathSource(mission, options.session));
  return (
    tryDetectDiagramFromTexts(missionCoreSource, missionExtendedSource, options) ||
    buildUnavailableLinearDiagram(options)
  );
}

function toSessionScopedMission(
  mission: MissionSection,
  session: SessionPlan,
  allowMissionFallback: boolean
): MissionSection {
  const practiceText = (session.practica ?? [])
    .map((p) => p.enunciado)
    .filter(Boolean)
    .join(' ');
  const sessionSteps = (session.ejemploResuelto ?? '')
    .split(/\r?\n|(?=\b\d+[.)]\s)/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (!allowMissionFallback) {
    return {
      ...mission,
      title: session.objetivo || `Sesión ${session.sessionNumber}`,
      sessionTopic: session.objetivo || '',
      sessionFocus: session.objetivo || '',
      phenomenonHook: {
        story: session.motivacion || session.saberesPrevios || '',
        detonatingQuestion: '',
      },
      conceptZero: {
        physicalAnalogy: session.saberesPrevios || '',
        coreExplanation: session.contenido || '',
        contrastTable: [],
        solvedExample: {
          problemStatement: session.ejemploResuelto || '',
          solutionSteps: sessionSteps,
          interpretation: session.aplicacion || '',
        },
      },
      iDoSection: {
        stepByStepDemo: session.ejemploResuelto || '',
        visualOrDiagram: '',
      },
      weDoSection: {
        guidedPractice: practiceText,
        workbookElements: [],
      },
      youDoSection: {
        autonomousChallenge: session.aplicacion || session.productoIntegrador || '',
        workbookElements: [],
      },
      troubleshooting: [],
      formativeCheckpoint: {
        question: session.autoevaluacion?.[0] || '',
        criteriaChecklist: session.autoevaluacion ?? [],
        reflectionPrompts: [],
      },
    };
  }

  return {
    ...mission,
    sessionTopic: session.objetivo || mission.sessionTopic,
    sessionFocus: session.objetivo || mission.sessionFocus,
    phenomenonHook: {
      story: session.motivacion || session.saberesPrevios || mission.phenomenonHook?.story || '',
      detonatingQuestion: mission.phenomenonHook?.detonatingQuestion || '',
    },
    conceptZero: {
      ...mission.conceptZero,
      coreExplanation: session.contenido || mission.conceptZero?.coreExplanation || '',
      solvedExample: {
        problemStatement: session.ejemploResuelto || mission.conceptZero?.solvedExample?.problemStatement || '',
        solutionSteps:
          sessionSteps.length > 0 ? sessionSteps : (mission.conceptZero?.solvedExample?.solutionSteps ?? []),
        interpretation: session.aplicacion || mission.conceptZero?.solvedExample?.interpretation || '',
      },
    },
    iDoSection: {
      ...mission.iDoSection,
      stepByStepDemo: session.ejemploResuelto || mission.iDoSection?.stepByStepDemo || '',
    },
    weDoSection: {
      ...mission.weDoSection,
      guidedPractice: practiceText || mission.weDoSection?.guidedPractice || '',
    },
    youDoSection: {
      ...mission.youDoSection,
      autonomousChallenge: session.aplicacion || mission.youDoSection?.autonomousChallenge || '',
    },
  };
}

export function buildSacrintDiagram(
  mission: MissionSection,
  pack: SacrintPack,
  options: DiagramBuildOptions = {}
): SacrintDiagramSpec {
  const effectiveMission = options.session
    ? toSessionScopedMission(mission, options.session, options.allowMissionFallback ?? true)
    : mission;

  switch (pack.diagram) {
    case 'linear-model':
      return buildMathDiagram(mission, options);
    case 'reaction-scheme':
      return buildReactionDiagram(effectiveMission);
    case 'argument-map':
    case 'rhetorical-map':
      return buildArgumentDiagram(effectiveMission);
    case 'word-map':
      return buildLanguageDiagram(effectiveMission);
    case 'timeline':
      return buildTimelineDiagram(effectiveMission);
    case 'system-map':
      return buildSystemMapDiagram(effectiveMission);
    case 'clinical-flow':
      return buildClinicalFlowDiagram(effectiveMission);
    case 'block-diagram':
      return buildBlockDiagram(effectiveMission);
    case 'sop-flow':
      return buildSopFlowDiagram(effectiveMission);
    case 'creative-cycle':
      return buildCreativeCycleDiagram(effectiveMission);
    case 'training-cycle':
      return buildTrainingCycleDiagram(effectiveMission);
    case 'regulation-flow':
      return buildRegulationFlowDiagram(effectiveMission);
    default:
      return buildConceptDiagram(effectiveMission);
  }
}

export function buildDiagramVariables(diagram: SacrintDiagramSpec): SacrintVariable[] {
  switch (diagram.kind) {
    case 'linear': {
      const isDefaultX = /^variable\s+independiente/i.test(diagram.xLabel);
      const isDefaultY = /^variable\s+dependiente/i.test(diagram.yLabel);
      return [
        {
          symbol: 'x',
          label: 'Variable independiente',
          meaning: isDefaultX
            ? diagram.available
              ? `Dominio [0, ${diagram.domainMax}]`
              : 'Por construir'
            : diagram.xLabel,
        },
        {
          symbol: 'y',
          label: 'Variable dependiente',
          meaning: isDefaultY
            ? diagram.available
              ? diagram.targetY !== undefined
                ? `Meta: y = ${diagram.targetY}`
                : `Rango [0, ${diagram.rangeMax}]`
              : 'Por construir'
            : diagram.yLabel,
        },
        {
          symbol: 'm',
          label: 'Razón de cambio',
          meaning: diagram.available ? `Pendiente ${diagram.slope}` : 'Por construir',
        },
        {
          symbol: 'b',
          label: 'Valor inicial',
          meaning: diagram.available ? `Intersección ${diagram.intercept}` : 'Por construir',
        },
      ];
    }
    case 'quadratic':
      return [
        {
          symbol: 'a',
          label: 'Concavidad',
          meaning: diagram.available
            ? `a = ${diagram.a} (abre hacia ${diagram.a >= 0 ? 'arriba' : 'abajo'})`
            : 'Por construir',
        },
        {
          symbol: 'V',
          label: 'Vértice óptimo',
          meaning: diagram.available ? `(${diagram.vertexX}, ${diagram.vertexY})` : 'Por construir',
        },
        {
          symbol: 'Δ',
          label: 'Discriminante',
          meaning: diagram.available
            ? `b² - 4ac = ${Number((diagram.b * diagram.b - 4 * diagram.a * diagram.c).toFixed(2))}`
            : 'Por construir',
        },
        {
          symbol: 'x₁,₂',
          label: 'Raíces reales',
          meaning: diagram.available
            ? diagram.roots.length > 0
              ? diagram.roots.join(' y ')
              : 'Sin raíces reales'
            : 'Por construir',
        },
      ];
    case 'system-2x2':
      return [
        { symbol: 'L₁', label: 'Ecuación 1', meaning: diagram.available ? diagram.equation1 : 'Por construir' },
        { symbol: 'L₂', label: 'Ecuación 2', meaning: diagram.available ? diagram.equation2 : 'Por construir' },
        {
          symbol: 'P*',
          label: 'Intersección',
          meaning: diagram.available
            ? diagram.intersection
              ? `x = ${diagram.intersection.x}, y = ${diagram.intersection.y}`
              : 'Rectas paralelas'
            : 'Por construir',
        },
        {
          symbol: 'Δ',
          label: 'Determinante',
          meaning: diagram.available
            ? `Δ = ${Number((diagram.a1 * diagram.b2 - diagram.a2 * diagram.b1).toFixed(2))}`
            : 'Por construir',
        },
      ];
    case 'exponential':
      return [
        {
          symbol: 'C₀',
          label: 'Capital inicial',
          meaning: diagram.available ? `$${diagram.principal.toLocaleString('en-US')}` : 'Por construir',
        },
        {
          symbol: 'r',
          label: 'Tasa por período',
          meaning: diagram.available ? `${(diagram.rate * 100).toFixed(0)}%` : 'Por construir',
        },
        {
          symbol: 't',
          label: 'Horizonte',
          meaning: diagram.available ? `0 a ${diagram.periods} períodos` : 'Por construir',
        },
        {
          symbol: 'M',
          label: 'Monto compuesto',
          meaning: diagram.available
            ? `$${(diagram.compoundSeries[diagram.compoundSeries.length - 1]?.value ?? diagram.principal).toLocaleString('en-US')}`
            : 'Por construir',
        },
      ];
    case 'geometry':
      return [
        { symbol: '90°', label: 'Ángulo / Figura', meaning: clip(diagram.primaryLabel, 68) },
        { symbol: 'R', label: 'Regla', meaning: clip(diagram.secondaryLabel, 68) },
        { symbol: 'A', label: diagram.highlights[0]?.label ?? 'Elemento 1', meaning: clip(diagram.highlights[0]?.detail ?? '', 68) },
        { symbol: 'B', label: diagram.highlights[1]?.label ?? 'Elemento 2', meaning: clip(diagram.highlights[1]?.detail ?? '', 68) },
      ];
    case 'reaction':
      return [
        {
          symbol: 'R',
          label: 'Reactivos',
          meaning: clip(diagram.reactants.map((node) => node.label).join(' + '), 72) || 'Por construir',
        },
        { symbol: 'Δ', label: 'Transformación', meaning: clip(diagram.condition, 72) },
        {
          symbol: 'P',
          label: 'Productos',
          meaning: clip(diagram.products.map((node) => node.label).join(' + '), 72) || 'Por construir',
        },
        { symbol: 'E', label: 'Evidencia', meaning: clip(diagram.note, 72) },
      ];
    case 'argument':
      return [
        { symbol: 'T', label: 'Tesis', meaning: clip(diagram.thesis.detail, 72) },
        { symbol: 'P', label: 'Premisas', meaning: clip(diagram.premises.map((node) => node.detail).join(' '), 72) },
        { symbol: 'O', label: 'Objeción', meaning: clip(diagram.objection.detail, 72) },
        { symbol: 'C', label: 'Conclusión', meaning: clip(diagram.conclusion.detail, 72) },
      ];
    case 'language':
      return [
        { symbol: 'E', label: 'Entrada', meaning: clip(diagram.input.detail, 72) },
        { symbol: 'F', label: 'Forma', meaning: clip(diagram.rule.detail, 72) },
        { symbol: 'S', label: 'Salida', meaning: clip(diagram.output.detail, 72) },
        { symbol: 'C', label: 'Contexto', meaning: clip(diagram.context.detail, 72) },
      ];
    case 'concept':
      return [
        { symbol: 'F', label: 'Fenómeno', meaning: clip(diagram.nodes[0]?.detail ?? '', 72) },
        { symbol: 'C', label: 'Concepto', meaning: clip(diagram.nodes[1]?.detail ?? '', 72) },
        { symbol: 'P', label: 'Práctica', meaning: clip(diagram.nodes[2]?.detail ?? '', 72) },
        { symbol: 'D', label: 'Decisión', meaning: clip(diagram.nodes[3]?.detail ?? '', 72) },
      ];
    case 'timeline':
      return [
        { symbol: 'T', label: 'Trayectoria', meaning: clip(diagram.span, 72) },
        { symbol: 'E', label: 'Eventos', meaning: String(diagram.events.length).padStart(2, '0') },
        { symbol: 'C', label: 'Causalidad', meaning: clip(diagram.events[0]?.detail ?? '', 72) },
        { symbol: 'B', label: 'Balance', meaning: clip(diagram.events[diagram.events.length - 1]?.detail ?? '', 72) },
      ];
    case 'system-map':
      return [
        { symbol: 'S', label: 'Sistema', meaning: clip(diagram.center.detail, 72) },
        { symbol: 'C', label: 'Componentes', meaning: clip(diagram.components.map((node) => node.label).join(' · '), 72) },
        { symbol: 'E', label: 'Entorno', meaning: clip(diagram.environment.detail, 72) },
        { symbol: 'R', label: 'Respuesta', meaning: clip(diagram.components[2]?.detail ?? '', 72) },
      ];
    case 'clinical-flow':
      return [
        { symbol: 'S', label: 'Síntoma', meaning: clip(diagram.stages[0]?.detail ?? '', 72) },
        { symbol: 'E', label: 'Evaluación', meaning: clip(diagram.stages[1]?.detail ?? '', 72) },
        { symbol: 'D', label: 'Diagnóstico', meaning: clip(diagram.stages[2]?.detail ?? '', 72) },
        { symbol: 'C', label: 'Cuidado', meaning: clip(diagram.stages[3]?.detail ?? '', 72) },
      ];
    case 'block-diagram':
      return [
        { symbol: 'I', label: 'Entrada', meaning: clip(diagram.input.detail, 72) },
        { symbol: 'P', label: 'Proceso', meaning: clip(diagram.process.detail, 72) },
        { symbol: 'S', label: 'Salida', meaning: clip(diagram.output.detail, 72) },
        { symbol: 'R', label: 'Retroalimentación', meaning: clip(diagram.feedback.detail, 72) },
      ];
    case 'sop-flow':
      return [
        { symbol: 'P', label: 'Preparación', meaning: clip(diagram.steps[0]?.detail ?? '', 72) },
        { symbol: 'E', label: 'Ejecución', meaning: clip(diagram.steps[1]?.detail ?? '', 72) },
        { symbol: 'V', label: 'Verificación', meaning: clip(diagram.steps[2]?.detail ?? '', 72) },
        { symbol: 'N', label: 'Norma', meaning: clip(diagram.standard, 72) },
      ];
    case 'creative-cycle':
      return [
        { symbol: 'D', label: 'Detonante', meaning: clip(diagram.phases[0]?.detail ?? '', 72) },
        { symbol: 'X', label: 'Exploración', meaning: clip(diagram.phases[1]?.detail ?? '', 72) },
        { symbol: 'O', label: 'Obra', meaning: clip(diagram.phases[2]?.detail ?? '', 72) },
        { symbol: 'P', label: 'Difusión', meaning: clip(diagram.phases[3]?.detail ?? '', 72) },
      ];
    case 'training-cycle':
      return [
        { symbol: 'C', label: 'Calentamiento', meaning: clip(diagram.phases[0]?.detail ?? '', 72) },
        { symbol: 'A', label: 'Activación', meaning: clip(diagram.phases[1]?.detail ?? '', 72) },
        { symbol: 'E', label: 'Esfuerzo', meaning: clip(diagram.phases[2]?.detail ?? '', 72) },
        { symbol: 'R', label: 'Recuperación', meaning: clip(diagram.phases[3]?.detail ?? '', 72) },
      ];
    case 'regulation-flow':
      return [
        { symbol: 'E', label: 'Emoción', meaning: clip(diagram.stages[0]?.detail ?? '', 72) },
        { symbol: 'I', label: 'Interpretación', meaning: clip(diagram.stages[1]?.detail ?? '', 72) },
        { symbol: 'R', label: 'Respuesta', meaning: clip(diagram.stages[2]?.detail ?? '', 72) },
        { symbol: 'A', label: 'Regulación', meaning: clip(diagram.anchor, 72) },
      ];
  }
}

export function diagramFormula(diagram: SacrintDiagramSpec): string {
  switch (diagram.kind) {
    case 'linear':
    case 'quadratic':
    case 'exponential':
    case 'geometry':
    case 'reaction':
      return diagram.equation;
    case 'system-2x2':
      return diagram.available ? `${diagram.equation1}  |  ${diagram.equation2}` : 'Modelo por construir';
    case 'argument':
      return 'P1 + P2 → T';
    case 'language':
      return 'ENTRADA → REGLA → SALIDA';
    case 'concept':
      return 'FENÓMENO → CONCEPTO → DECISIÓN';
    case 'timeline':
      return 'ANTECEDENTE → PROCESO → CONSECUENCIA';
    case 'system-map':
      return 'SISTEMA → COMPONENTES → EQUILIBRIO';
    case 'clinical-flow':
      return 'SÍNTOMA → EVALUACIÓN → CUIDADO';
    case 'block-diagram':
      return 'ENTRADA → PROCESO → SALIDA';
    case 'sop-flow':
      return 'PREPARACIÓN → EJECUCIÓN → VERIFICACIÓN';
    case 'creative-cycle':
      return 'DETONANTE → EXPLORACIÓN → OBRA → DIFUSIÓN';
    case 'training-cycle':
      return 'CALENTAMIENTO → ESFUERZO → RECUPERACIÓN';
    case 'regulation-flow':
      return 'EMOCIÓN → INTERPRETACIÓN → RESPUESTA';
  }
}

export function diagramModelLabel(diagram: SacrintDiagramSpec): string {
  switch (diagram.kind) {
    case 'linear':
      return 'Modelo lineal';
    case 'quadratic':
      return 'Modelo cuadrático';
    case 'system-2x2':
      return 'Sistema lineal 2×2';
    case 'exponential':
      return 'Interés simple vs. compuesto';
    case 'geometry':
      return 'Modelo geométrico';
    case 'reaction':
      return 'Esquema de reacción';
    case 'argument':
      return 'Mapa argumental';
    case 'language':
      return 'Red de lengua';
    case 'concept':
      return 'Mapa conceptual';
    case 'timeline':
      return 'Línea de tiempo';
    case 'system-map':
      return 'Red de sistemas';
    case 'clinical-flow':
      return 'Flujo clínico';
    case 'block-diagram':
      return 'Diagrama de bloques';
    case 'sop-flow':
      return 'Flujo de procedimiento';
    case 'creative-cycle':
      return 'Ciclo creativo';
    case 'training-cycle':
      return 'Ciclo de entrenamiento';
    case 'regulation-flow':
      return 'Flujo de regulación';
  }
}

export function diagramSubtitle(diagram: SacrintDiagramSpec): string {
  switch (diagram.kind) {
    case 'linear':
      return 'Del fenómeno al modelo lineal';
    case 'quadratic':
      return 'Curva parabólica, vértice y raíces';
    case 'system-2x2':
      return 'Intersección simultánea de rectas';
    case 'exponential':
      return 'Comparación lineal vs. exponencial';
    case 'geometry':
      return 'Propiedades métricas y angulares';
    case 'reaction':
      return 'Del fenómeno a la reacción';
    case 'argument':
      return 'Del fenómeno al argumento';
    case 'language':
      return 'Del contexto a la producción';
    case 'concept':
      return 'Del fenómeno al concepto';
    case 'timeline':
      return 'Del contexto a la trayectoria';
    case 'system-map':
      return 'Del organismo al equilibrio';
    case 'clinical-flow':
      return 'Del síntoma al cuidado';
    case 'block-diagram':
      return 'Del requerimiento a la solución';
    case 'sop-flow':
      return 'Del estándar a la ejecución';
    case 'creative-cycle':
      return 'Del detonante a la difusión';
    case 'training-cycle':
      return 'Del calentamiento a la adaptación';
    case 'regulation-flow':
      return 'De la emoción a la regulación';
  }
}

export function diagramFooterLabel(diagram: SacrintDiagramSpec): string {
  switch (diagram.kind) {
    case 'linear':
      return 'modelo · variables · decisión';
    case 'quadratic':
      return 'vértice · raíces · modelado';
    case 'system-2x2':
      return 'rectas · intersección · solución';
    case 'exponential':
      return 'capital · tasa · crecimiento';
    case 'geometry':
      return 'trazo · medida · teorema';
    case 'reaction':
      return 'reactivos · proceso · productos';
    case 'argument':
      return 'tesis · premisas · conclusión';
    case 'language':
      return 'entrada · forma · salida';
    case 'concept':
      return 'fenómeno · concepto · decisión';
    case 'timeline':
      return 'antecedente · proceso · consecuencia';
    case 'system-map':
      return 'sistema · componentes · entorno';
    case 'clinical-flow':
      return 'síntoma · evaluación · cuidado';
    case 'block-diagram':
      return 'entrada · proceso · salida';
    case 'sop-flow':
      return 'preparación · ejecución · verificación';
    case 'creative-cycle':
      return 'detonante · exploración · obra';
    case 'training-cycle':
      return 'calentamiento · esfuerzo · recuperación';
    case 'regulation-flow':
      return 'emoción · interpretación · regulación';
  }
}

export function stepLabelsForPack(pack: SacrintPack): string[] {
  switch (pack.id) {
    case 'quimica':
      return ['EL FENÓMENO', 'LA REACCIÓN', 'EL BALANCE', 'EL IMPACTO'];
    case 'filosofia':
    case 'literatura':
      return ['LA PREGUNTA', 'LA TESIS', 'LA OBJECIÓN', 'LA CONCLUSIÓN'];
    case 'ingles':
      return ['EL CONTEXTO', 'LA FORMA', 'LA PRÁCTICA', 'LA PRODUCCIÓN'];
    case 'matematicas':
      return ['EL FENÓMENO', 'LA TABULACIÓN', 'EL MODELO', 'EL IMPACTO'];
    case 'historia':
      return ['EL ANTECEDENTE', 'EL PROCESO', 'LA CONSECUENCIA', 'LA DECISIÓN'];
    case 'biologia':
      return ['EL ESTÍMULO', 'EL MECANISMO', 'LA RESPUESTA', 'LA ADAPTACIÓN'];
    case 'salud':
      return ['EL SÍNTOMA', 'LA EVALUACIÓN', 'EL DIAGNÓSTICO', 'EL CUIDADO'];
    case 'tecnologia':
      return ['LA ENTRADA', 'EL PROCESO', 'LA SALIDA', 'EL CONTROL'];
    case 'laboral':
      return ['LA PREPARACIÓN', 'LA EJECUCIÓN', 'LA VERIFICACIÓN', 'LA ENTREGA'];
    case 'artes':
      return ['EL DETONANTE', 'LA EXPLORACIÓN', 'LA OBRA', 'LA DIFUSIÓN'];
    case 'educacion_fisica':
      return ['EL CALENTAMIENTO', 'LA ACTIVACIÓN', 'EL ESFUERZO', 'LA RECUPERACIÓN'];
    case 'socioemocional':
      return ['LA EMOCIÓN', 'LA INTERPRETACIÓN', 'LA RESPUESTA', 'LA REGULACIÓN'];
    default:
      return ['EL FENÓMENO', 'EL CONCEPTO', 'LA PRÁCTICA', 'LA DECISIÓN'];
  }
}
