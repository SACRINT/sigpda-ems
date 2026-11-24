import type { MissionSection, SessionPlan } from '@/types/work-textbook';
import { classifyTopic, detectExponentialContext } from '@/lib/visual-engine/topic-classifier';
import type {
  DiagramBuildOptions,
  ExponentialDiagramSpec,
  GeometryDiagramSpec,
  LinearDiagramSpec,
  QuadraticDiagramSpec,
  SacrintDiagramSpec,
  System2x2DiagramSpec,
} from '../types';
import { cleanSacrintText } from '../text/grammar-normalization';
import { niceTickStep } from './shared';

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

function parseSignedCoef(raw: string | undefined): number {
  const cleaned = (raw ?? '').replace(/\s+/g, '');
  if (!cleaned || cleaned === '+') return 1;
  if (cleaned === '-') return -1;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 1;
}

function formatLeadingQuadCoef(a: number): string {
  if (a === 1) return '';
  if (a === -1) return '-';
  return formatCoef(a);
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

  // 1b. Ecuación lineal con incógnita en ambos miembros: ax ± b = cx ± d (preferir forma limpia sin resta paso-intermedio)
  const cleanBothSidesRe =
    /(?<![²^0-9A-Za-z(])(-?\d+(?:\.\d+)?)\s*([a-z])\s*([+-])\s*(\d+(?:\.\d+)?)\s*=\s*(-?\d+(?:\.\d+)?)\s*\2\s*([+-])\s*(\d+(?:\.\d+)?)(?![0-9A-Za-z²])/i;
  const bothSidesMatch =
    normalized.match(cleanBothSidesRe) ||
    normalized.match(
      /\(?\s*(-?\d+(?:\.\d+)?)\s*([a-z])\s*([+-])\s*(\d+(?:\.\d+)?)\s*\)?(?:\s*-\s*\d+\s*\2)?\s*=\s*\(?\s*(-?\d+(?:\.\d+)?)\s*\2\s*([+-])\s*(\d+(?:\.\d+)?)\s*\)?(?:\s*-\s*\d+\s*\2)?/i
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
      const boundedDom = Math.min(10000, Math.max(8, xSol > 0 ? Math.ceil((xSol * 1.35) / 2) * 2 : 10));
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
      const boundedDom = Math.min(10000, Math.max(8, niceDom));
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
      const boundedDom = Math.min(10000, Math.max(8, xSol > 0 ? Math.ceil((xSol * 1.35) / 2) * 2 : 10));
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
      const boundedDom = Math.min(10000, Math.max(8, xSol > 0 ? Math.ceil((xSol * 1.35) / 2) * 2 : 10));
      return {
        slope: a,
        intercept: expandedB,
        domainMax: boundedDom,
        targetY: c > 0 ? c : undefined,
        equation: `${formatCoef(a)}(${varName} ${sign} ${formatCoef(bRaw)}) = ${formatCoef(c)}`,
      };
    }
  }

  // 4. Ecuación lineal con dos incógnitas aislada: Ax ± By = C (deduplicando repeticiones exactas de la misma ecuación)
  const twoVarSingleMatches = [
    ...normalized.matchAll(/(-?\d+(?:\.\d+)?)\s*x\s*([+-])\s*(\d+(?:\.\d+)?)\s*y\s*=\s*(-?\d+(?:\.\d+)?)/gi),
  ];
  const uniqueTwoVarMatches = twoVarSingleMatches.filter((m, idx, arr) => {
    const key = `${Number(m[1])}|${m[2]}|${Number(m[3])}|${Number(m[4])}`;
    return (
      arr.findIndex((other) => `${Number(other[1])}|${other[2]}|${Number(other[3])}|${Number(other[4])}` === key) ===
      idx
    );
  });
  if (uniqueTwoVarMatches.length === 1) {
    const m = uniqueTwoVarMatches[0];
    const aCoef = Number(m[1]);
    const bSign = m[2] === '-' ? -1 : 1;
    const bMag = Number(m[3]);
    const bCoef = bSign * bMag;
    const cCoef = Number(m[4]);
    if (Number.isFinite(aCoef) && Number.isFinite(bCoef) && bCoef !== 0 && Number.isFinite(cCoef) && aCoef !== 0) {
      const slope = Number((-aCoef / bCoef).toFixed(6));
      const intercept = Number((cCoef / bCoef).toFixed(4));
      const xInt = cCoef / aCoef;
      // Para modelos de restricción/presupuesto con pendiente negativa en el primer cuadrante (Ax + By = C, A,B,C > 0),
      // el dominio debe cerrar exactamente en la intersección X (y = 0) para no graficar cantidades negativas.
      const boundedDom =
        slope < 0 && intercept > 0 && xInt > 0
          ? Math.min(10000, Number(xInt.toFixed(2)))
          : Math.min(10000, Math.max(8, xInt > 0 ? Math.ceil((xInt * 1.2) / 2) * 2 : 12));
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

  const statAvgMatch = normalized.match(
    /(?<![\d/])(\d+(?:\.\d+)?)\s*\/\s*(\d+)\s*=\s*(\d+(?:\.\d+)?)(?!\s*\/|\s*[A-Za-z_])/
  );
  const isExplicitAverageContext =
    /\b(?:promedio|media\s+aritm[eé]tica|x̄)\b/i.test(normalized) &&
    !/\b(?:fracci[oó]n(?:es)?|equivalente|raz[oó]n(?:es)?|proporci[oó]n|regla\s+de\s+tres|reparto\s+proporcional|divisi[oó]n\s+exacta|porcentaje)\b/i.test(
      normalized
    );
  if (statAvgMatch && isExplicitAverageContext) {
    const sumVal = Number(statAvgMatch[1]);
    const nVal = Number(statAvgMatch[2]);
    const meanVal = Number(statAvgMatch[3]);
    const isConsistentQuotient =
      nVal >= 2 && meanVal > 0 && Math.abs(sumVal / nVal - meanVal) <= 0.05 * Math.max(1, meanVal);
    if (isConsistentQuotient) {
      return {
        slope: meanVal,
        intercept: 0,
        domainMax: Math.min(1000, Math.max(10, nVal)),
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
      domainMax: Math.min(1000, Math.max(10, nPilot)),
      targetY: nPilot,
      equation: `Muestra piloto n = ${nPilot}`,
    };
  }

  const coeffMatch = normalized.match(/\ba\s*=\s*(-?\d+(?:\.\d+)?)[\s,;]+b\s*=\s*(-?\d+(?:\.\d+)?)/i);
  if (coeffMatch && !/cuadr[aá]tic|ax²|par[aá]bol|pit[aá]goras|hipotenusa|cateto|tri[aá]ngulo|congruencia|semejanza/i.test(normalized)) {
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

export function tryBuildQuadraticDiagram(source: string): QuadraticDiagramSpec | null {
  if (!source) return null;
  const quadEqMatch = source.match(
    /([+-]?\s*\d+(?:\.\d+)?|[+-])?\s*x(?:²|\^2)\s*([+-])\s*(\d+(?:\.\d+)?)?\s*x\s*([+-])\s*(\d+(?:\.\d+)?)\s*=\s*(-?\d+(?:\.\d+)?)/i
  );
  const quadFuncMatch = source.match(
    /(?:[A-Za-z]\([a-z]\)|y)\s*=\s*([+-]?\s*\d+(?:\.\d+)?|[+-])?\s*x(?:²|\^2)\s*([+-])\s*(\d+(?:\.\d+)?)?\s*x\s*([+-])\s*(\d+(?:\.\d+)?)/i
  );
  const quadTwoTermFuncMatch = source.match(
    /(?:[A-Za-z]\([a-z]\)|y)\s*=\s*([+-]?\s*\d+(?:\.\d+)?|[+-])?\s*x(?:²|\^2)\s*([+-])\s*(\d+(?:\.\d+)?)?\s*x(?![0-9A-Za-z+-])/i
  );
  const quadPureMatch = source.match(
    /(?:(?:[A-Za-z]\([a-z]\)|y)\s*=\s*)?([+-]?\s*\d+(?:\.\d+)?|[+-])?\s*x(?:²|\^2)\s*([+-])\s*(\d+(?:\.\d+)?)\s*=\s*(-?\d+(?:\.\d+)?)/i
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
  let equation = '';

  const m = quadEqMatch || quadFuncMatch;
  if (m) {
    a = parseSignedCoef(m[1]);
    if (a === 0) return null;
    b = (m[2] === '-' ? -1 : 1) * (m[3] ? Number(m[3]) : 1);
    const rhs = m[6] ? Number(m[6]) : 0;
    c = (m[4] === '-' ? -1 : 1) * Number(m[5]) - (quadEqMatch ? rhs : 0);
    const signB = b >= 0 ? '+' : '-';
    const signC = c >= 0 ? '+' : '-';
    equation = quadEqMatch
      ? `${formatLeadingQuadCoef(a)}x² ${signB} ${formatCoef(Math.abs(b))}x ${signC} ${formatCoef(Math.abs(c))} = 0`
      : `f(x) = ${formatLeadingQuadCoef(a)}x² ${signB} ${formatCoef(Math.abs(b))}x ${signC} ${formatCoef(Math.abs(c))}`;
  } else if (quadTwoTermFuncMatch) {
    a = parseSignedCoef(quadTwoTermFuncMatch[1]);
    if (a === 0) return null;
    b = (quadTwoTermFuncMatch[2] === '-' ? -1 : 1) * (quadTwoTermFuncMatch[3] ? Number(quadTwoTermFuncMatch[3]) : 1);
    c = 0;
    const signB = b >= 0 ? '+' : '-';
    equation = `f(x) = ${formatLeadingQuadCoef(a)}x² ${signB} ${formatCoef(Math.abs(b))}x`;
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
    a = parseSignedCoef(quadPureMatch[1]);
    if (a === 0) return null;
    b = 0;
    const rhs = quadPureMatch[4] ? Number(quadPureMatch[4]) : 0;
    c = (quadPureMatch[2] === '-' ? -1 : 1) * Number(quadPureMatch[3]) - rhs;
    const signC = c >= 0 ? '+' : '-';
    equation = `${formatLeadingQuadCoef(a)}x² ${signC} ${formatCoef(Math.abs(c))} = 0`;
  } else if (isQuadraticTopic) {
    return {
      kind: 'quadratic',
      available: false,
      equation: '',
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
      yLabel: 'Eje y',
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
  const twoVarEqRe = /([+-]?\s*\d+(?:\.\d+)?|[+-])?\s*x\s*([+-])\s*(\d+(?:\.\d+)?)?\s*y\s*=\s*(-?\d+(?:\.\d+)?)/gi;
  const parsed: Array<{ a: number; b: number; c: number; eq: string }> = [];
  const collinearFallback: Array<{ a: number; b: number; c: number; eq: string }> = [];

  for (const m of source.matchAll(twoVarEqRe)) {
    const a = parseSignedCoef(m[1]);
    const bSign = m[2] === '-' ? -1 : 1;
    const bMag = m[3] ? Number(m[3]) : 1;
    const b = bSign * bMag;
    const c = Number(m[4]);
    if (Number.isFinite(a) && Number.isFinite(b) && Number.isFinite(c) && b !== 0) {
      const label = `${formatLeadingQuadCoef(a)}x ${m[2]} ${bMag === 1 ? '' : formatCoef(bMag)}y = ${formatCoef(c)}`;
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

  // Ecuaciones de sustitución despejadas SOLO cuando hay tema explícito de sistemas 2x2
  if (sysTopic && parsed.length === 1) {
    const subXEqKy = source.match(/\bx\s*=\s*([+-]?\s*\d+(?:\.\d+)?|[+-])?\s*y(?![0-9A-Za-z+-])/i);
    const subYEqKx = source.match(/\by\s*=\s*([+-]?\s*\d+(?:\.\d+)?|[+-])?\s*x(?![0-9A-Za-z+-])/i);
    if (subXEqKy) {
      const k = parseSignedCoef(subXEqKy[1]);
      if (k !== 0) {
        parsed.push({ a: 1, b: -k, c: 0, eq: `x - ${formatCoef(k)}y = 0` });
      }
    } else if (subYEqKx) {
      const k = parseSignedCoef(subYEqKx[1]);
      if (k !== 0) {
        parsed.push({ a: k, b: -1, c: 0, eq: `${formatLeadingQuadCoef(k)}x - y = 0` });
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
      equation1: '',
      equation2: '',
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
  const expContext = detectExponentialContext(source);
  const isPopulation = expContext === 'population';
  const capitalMatch =
    source.match(
      /(?:capital(?:\s+inicial)?|monto\s+inicial|inversi[oó]n(?:\s+inicial)?|pr[eé]stamo|ahorro|P\([^)]*\)\s*=|P[₀0]\s*=|C[₀0]\s*=|M\s*=)\s*(?:de\s*)?\$?\s*(\d{1,3}(?:,\d{3})+|\d{2,6})/i
    ) ||
    source.match(/\$\s*(\d{1,3}(?:,\d{3})+|\d{2,6})(?!\s*%)/) ||
    source.match(/\b(\d{1,3}(?:,\d{3})+|\d{3,6})\s*(?:habitantes|personas|j[oó]venes|pesos|individuos)\b/i) ||
    source.match(
      /(?:poblaci[oó]n(?:\s+inicial|\s+actual|\s+juvenil|\s+total|\s+de)?|proyecci[oó]n\s+de|P\([^)]*\)\s*=|P[₀0]\s*=|C[₀0]\s*=)\s*(?:de\s*)?\$?\s*(\d{1,3}(?:,\d{3})+|\d{2,6})(?!\s*(?:a|-|–)\s*\d+\s*a[ñn]os|\s*a[ñn]os\b)/i
    );
  const contextualRateMatch =
    source.match(/(?:tasa(?:\s+de)?(?:\s+inter[eé]s|\s+crecimiento|\s+anual)?|inter[eé]s(?:\s+anual|\s+simple|\s+compuesto)?|capitalizable[^.]{0,30}|rendimiento(?:\s+anual)?|\br\s*=)\s*(?:es\s*)?(?:de(?:l)?\s*)?(\d+(?:\.\d+)?)\s*%/i) ||
    source.match(/(\d+(?:\.\d+)?)\s*%\s*(?:anual|semestral|trimestral|bimestral|mensual|capitalizable|de\s+inter[eé]s|de\s+crecimiento)/i);
  const rateMatch =
    contextualRateMatch ||
    source.match(/(\d+(?:\.\d+)?)\s*%/) ||
    source.match(/1\s*\+\s*0\.(\d{1,3})/);

  // Si no hay tasa explícita (%) ni es explícitamente un tema de interés/crecimiento exponencial, no secuestrar modelos lineales
  if (!rateMatch && !isExplicitExponentialTopic) {
    return null;
  }

  if (!capitalMatch && !rateMatch) {
    return {
      kind: 'exponential',
      available: false,
      equation: '',
      principal: 0,
      rate: 0,
      periods: 6,
      simpleSeries: [],
      compoundSeries: [],
      yMax: 100,
      xLabel: 'Períodos (t)',
      yLabel: isPopulation ? 'Población P(t)' : 'Monto acumulado ($)',
      context: expContext,
    };
  }
  const principal = capitalMatch ? Math.min(100000, Math.max(50, Number(capitalMatch[1].replace(/,/g, '')))) : 1000;
  let annualOrPeriodRatePct = 10;
  if (rateMatch) {
    const rawRate = rateMatch[0].includes('1 + 0.') && !rateMatch[0].includes('%')
      ? Number((Number(`0.${rateMatch[1]}`) * 100).toFixed(2))
      : Number(Number(rateMatch[1]).toFixed(2));
    annualOrPeriodRatePct = Number(Math.min(50, Math.max(0.5, rawRate)).toFixed(2));
  }

  // Detectar capitalización subanual y horizonte temporal exacto (años, semestres, trimestres, meses)
  let compoundingFreq = 1;
  let periodUnit = 'Períodos (t)';
  if (/capitalizable\s+semestral|semestral(?:mente)?/i.test(source)) {
    compoundingFreq = 2;
    periodUnit = 'Semestres (n)';
  } else if (/capitalizable\s+trimestral|trimestral(?:mente)?/i.test(source)) {
    compoundingFreq = 4;
    periodUnit = 'Trimestres (n)';
  } else if (/capitalizable\s+cuatrimestral|cuatrimestral(?:mente)?/i.test(source)) {
    compoundingFreq = 3;
    periodUnit = 'Cuatrimestres (n)';
  } else if (/capitalizable\s+bimestral|bimestral(?:mente)?/i.test(source)) {
    compoundingFreq = 6;
    periodUnit = 'Bimestres (n)';
  } else if (/capitalizable\s+mensual|mensual(?:mente)?/i.test(source)) {
    compoundingFreq = 12;
    periodUnit = 'Meses (n)';
  }

  const horizonMatch =
    source.match(/(?:durante|por|a(?:\s+un)?\s+plazo\s+de|en\s+un\s+lapso\s+de|al\s+cabo\s+de|en)\s+(\d+)\s+(a[ñn]os?|semestres?|trimestres?|bimestres?|cuatrimestres?|meses?)\b/i) ||
    source.match(/(\d+)\s+(a[ñn]os?|semestres?|trimestres?|bimestres?|cuatrimestres?|meses?)\b/i) ||
    source.match(/\bt\s*=\s*(\d+)\b/i);

  let periods = 6;
  if (horizonMatch) {
    const rawN = Number(horizonMatch[1]);
    const unit = (horizonMatch[2] || '').toLowerCase();
    if (Number.isFinite(rawN) && rawN >= 1) {
      if (unit.startsWith('año') || unit.startsWith('ano')) {
        periods = compoundingFreq > 1 ? rawN * compoundingFreq : rawN;
        if (compoundingFreq === 1) periodUnit = 'Años (t)';
      } else {
        periods = rawN;
      }
      periods = Math.max(2, Math.min(24, Math.round(periods)));
    }
  }

  const rateIsAnnual =
    compoundingFreq > 1 &&
    (/anual/i.test(source) || /capitalizable/i.test(source));
  const ratePct = rateIsAnnual
    ? Number((annualOrPeriodRatePct / compoundingFreq).toFixed(2))
    : annualOrPeriodRatePct;
  const rate = Number((ratePct / 100).toFixed(6));
  const simpleSeries: Array<{ t: number; value: number }> = [];
  const compoundSeries: Array<{ t: number; value: number }> = [];

  const usesContinuousExp = /(?:·|\*|\s)e\s*(?:\^|[⁰¹²³⁴⁵⁶⁷⁸⁹])|P₀\s*·\s*e|e\^\s*\(/i.test(source);
  for (let t = 0; t <= periods; t++) {
    simpleSeries.push({ t, value: Math.round(principal * (1 + rate * t)) });
    compoundSeries.push({
      t,
      value: Math.round(
        usesContinuousExp ? principal * Math.exp(rate * t) : principal * Math.pow(1 + rate, t)
      ),
    });
  }
  const maxVal = Math.max(...compoundSeries.map((p) => p.value));
  const rateSuffix = rateIsAnnual ? `%/${periodUnit.slice(0, 3).toLowerCase()}` : '%';
  return {
    kind: 'exponential',
    available: true,
    equation: isPopulation
      ? usesContinuousExp
        ? `P(t) = P₀·e^(rt)  (P₀=${principal.toLocaleString('en-US')}, r=${ratePct}${rateSuffix}, t=${periods})`
        : `P(t) = P₀(1 + r)ᵗ  (P₀=${principal.toLocaleString('en-US')}, r=${ratePct}${rateSuffix}, n=${periods})`
      : `M = C₀(1 + r)ⁿ  (C₀=${principal.toLocaleString('en-US')}, r=${ratePct}${rateSuffix}, n=${periods})`,
    principal,
    rate,
    periods,
    simpleSeries,
    compoundSeries,
    yMax: Math.ceil((maxVal * 1.1) / 50) * 50,
    xLabel: periodUnit,
    yLabel: isPopulation ? 'Población P(t)' : 'Monto acumulado ($)',
    context: expContext,
  };
}

function tryBuildGeometryDiagram(source: string): GeometryDiagramSpec | null {
  // Nunca asignar un triángulo rectángulo estático (Pitágoras) a sesiones de cálculo diferencial,
  // derivadas implícitas, regla de L'Hôpital o límites que mencionen sen(x)/cos(x)/tan(x).
  if (
    /\b(?:derivad[ao]s?|l['’]?h[oô]pital|l[ií]mites?|c[aá]lculo\s+diferencial|raz[oó]n\s+de\s+cambio|m[aá]ximos\s+y\s+m[ií]nimos|tasa\s+de\s+cambio\s+instant[aá]nea|integral(?:es)?)\b/i.test(
      source
    )
  ) {
    return null;
  }
  const isAngle =
    /tipos?\s+de\s+[aá]ngulos|clasificaci[oó]n\s+de\s+[aá]ngulos|[aá]ngulos?\s+(?:agudo|recto|obtuso|llano|complementarios|suplementarios|opuestos\s+por\s+el\s+v[eé]rtice|alternos|correspondientes)|transportador|paralelas.*transversal/i.test(
      source
    );
  const isTriangle =
    /pit[aá]goras|tri[aá]ngulo\s+rect[aá]ngulo|hipotenusa|cateto|\b(?:sen|cos|tan)\s*(?:[θ°αβ]|\d+\s*°|\([A-Za-z0-9θ°\s+-]+\))|trigonometr/i.test(
      source
    );
  const isCongruence =
    /congruencia\s+(?:y\s+semejanza|de\s+(?:tri[aá]ngulos|figuras|lados|piezas)|geom[eé]trica|estructural)|semejanza\s+de\s+tri[aá]ngulos|criterios?\s+(?:de\s+congruencia|LLL|LAL|ALA)|teorema\s+de\s+(?:tales|napole[oó]n)|lados\s+hom[oó]logos/i.test(
      source
    );
  const isPolygon = /[aá]rea\s+y\s+per[ií]metro|per[ií]metro\s+del\s+rect[aá]ngulo/i.test(source);

  if (!isAngle && !isTriangle && !isCongruence && !isPolygon) return null;

  if (isCongruence && !isAngle && (!isTriangle || /criterios\s+de\s+congruencia|napole[oó]n/i.test(source))) {
    return {
      kind: 'geometry',
      variant: 'polygon',
      available: true,
      equation: 'Criterios LLL · LAL · ALA  |  a/a′ = b/b′ = c/c′ = k',
      primaryLabel: 'Congruencia (≅) y Semejanza (~)',
      secondaryLabel: 'Ángulos iguales · Lados proporcionales',
      highlights: [
        { label: 'Congruencia (≅)', detail: 'Igual forma y tamaño (k=1).' },
        { label: 'Semejanza (~)', detail: 'Misma forma, lados proporcionales.' },
        { label: 'Criterios', detail: 'LLL, LAL y ALA.' },
      ],
    };
  }

  const headTopic = source.slice(0, 140);
  const isAngleHeadTopic =
    /\b(?:tipos?\s+de\s+[aá]ngulos|clasificaci[oó]n\s+de\s+[aá]ngulos|[aá]ngulos\s+en\s+estructuras|[aá]ngulos\s+aplicados|[aá]ngulos\s+y\s+sus\s+propiedades|[aá]ngulos\s+complementarios|[aá]ngulos\s+suplementarios)\b/i.test(
      headTopic
    ) && !/pit[aá]goras|hipotenusa|cateto/i.test(headTopic);

  if (
    isTriangle &&
    !isAngleHeadTopic &&
    (!isAngle || /pit[aá]goras|hipotenusa|cateto|tri[aá]ngulo\s+rect[aá]ngulo/i.test(source))
  ) {
    return {
      kind: 'geometry',
      variant: 'right-triangle',
      available: true,
      equation: 'c² = a² + b²  |  Ángulo A + Ángulo B = 90°',
      primaryLabel: 'Catetos a, b e hipotenusa c',
      secondaryLabel: 'Ángulo recto = 90°',
      highlights: [
        { label: 'Catetos', detail: 'Forman 90° (catetos a y b).' },
        { label: 'Hipotenusa', detail: 'Opuesta a 90°: c = √(a² + b²).' },
        { label: 'Suma angular', detail: 'Agudos suman 90°.' },
      ],
    };
  }

  if (isCongruence) {
    return {
      kind: 'geometry',
      variant: 'polygon',
      available: true,
      equation: 'Criterios LLL · LAL · ALA  |  a/a′ = b/b′ = c/c′ = k',
      primaryLabel: 'Congruencia (≅) y Semejanza (~)',
      secondaryLabel: 'Ángulos iguales · Lados proporcionales',
      highlights: [
        { label: 'Congruencia (≅)', detail: 'Igual forma y tamaño (k=1).' },
        { label: 'Semejanza (~)', detail: 'Misma forma, lados proporcionales.' },
        { label: 'Criterios', detail: 'LLL, LAL y ALA.' },
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
        { label: 'Agudo', detail: '0° < abertura < 90°.' },
        { label: 'Recto', detail: '90° exactos (perpendiculares).' },
        { label: 'Obtuso', detail: '90° < abertura < 180°.' },
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
      { label: 'Base y altura', detail: 'Dimensiones ortogonales (b, h).' },
      { label: 'Perímetro', detail: 'Contorno total de lados.' },
      { label: 'Área', detail: 'Superficie interior delimitada.' },
    ],
  };
}

function buildUnavailableLinearDiagram(options: DiagramBuildOptions): LinearDiagramSpec {
  return {
    kind: 'linear',
    available: false,
    equation: '',
    slope: 0,
    intercept: 0,
    domainMax: 10,
    rangeMax: 10,
    points: [],
    xLabel: options.xLabel || 'Eje X',
    yLabel: options.yLabel || 'Eje Y',
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
  const exactSolX =
    targetY !== undefined && slope > 0
      ? Number(((targetY - intercept) / slope).toFixed(2))
      : undefined;
  const sampleXs =
    exactSolX !== undefined && exactSolX > 0 && exactSolX <= domainMax
      ? [0, Number((exactSolX / 2).toFixed(2)), exactSolX]
      : domainMax <= 10
        ? [0, 4, 8]
        : [0, Math.round(domainMax / 2), domainMax];
  const points = sampleXs
    .filter((x) => x <= domainMax)
    .map((x) => {
      const y = Number((slope * x + intercept).toFixed(2));
      return { x: x || 0, y: Object.is(y, -0) ? 0 : y };
    });

  return {
    kind: 'linear',
    available: true,
    equation,
    slope,
    intercept,
    domainMax,
    rangeMax,
    points,
    xLabel: options.xLabel || 'Eje X',
    yLabel: options.yLabel || 'Eje Y',
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

  const classification = classifyTopic({
    topic: primaryText,
    bodyText: secondaryText,
  });

  // Prioridad por clasificador SSoT cuando es geometría pura (ángulos, Pitágoras, congruencia)
  if (classification.kind === 'geometry') {
    const geometry = tryBuildGeometryDiagram(primaryText) || tryBuildGeometryDiagram(secondaryText);
    if (geometry) return geometry;
  }

  // 1. Ecuación o función cuadrática (parábola real o estado por construir si solo hay tema)
  const quadratic = pickAvailableOrFallback(
    tryBuildQuadraticDiagram(primaryText),
    tryBuildQuadraticDiagram(secondaryText)
  );
  if (quadratic && classification.kind !== 'geometry') return quadratic;

  // 2. Sistema de ecuaciones lineales 2x2: evitar secuestrar ecuaciones de 1 incógnita si NO es tema explícito de sistemas
  const linearPrimary = parseLinearEquationModel(primaryText, primaryText);
  const isExplicit2x2Topic =
    classification.kind === 'system-2x2' ||
    /sistema[s]?\s+(?:de\s+ecuaciones|lineal(?:es)?(?:\s*2x2)?)|\b2x2\b|m[eé]todo\s+de\s+(?:igualaci[oó]n|sustituci[oó]n|reducci[oó]n|eliminaci[oó]n|cramer|determinantes)/i.test(
      primaryText
    );
  const system2x2 = isExplicit2x2Topic
    ? pickAvailableOrFallback(
        tryBuildSystem2x2Diagram(primaryText),
        secondaryText !== primaryText ? tryBuildSystem2x2Diagram(secondaryText) : null
      )
    : tryBuildSystem2x2Diagram(primaryText);
  if (system2x2 && (isExplicit2x2Topic || !linearPrimary)) return system2x2;

  // 3. Interés simple vs. compuesto / crecimiento exponencial
  const exponential = pickAvailableOrFallback(
    tryBuildExponentialDiagram(primaryText),
    tryBuildExponentialDiagram(secondaryText)
  );
  if (exponential) return exponential;

  // 4. Geometría plana (ángulos, triángulos, congruencia, áreas y perímetros)
  const linearDirect = linearPrimary || parseLinearEquationModel(primaryText, secondaryText);
  const geometry = tryBuildGeometryDiagram(primaryText) || tryBuildGeometryDiagram(secondaryText);
  const hasExplicitPrimaryGeometry =
    classification.kind === 'geometry' ||
    /tipos?\s+de\s+[aá]ngulos|clasificaci[oó]n\s+de\s+[aá]ngulos|transportador|pit[aá]goras|congruencia\s+(?:y\s+semejanza|de\s+(?:tri[aá]ngulos|figuras)|geom[eé]trica)|criterios?\s+(?:de\s+congruencia|LLL|LAL|ALA)|semejanza\s+de\s+tri[aá]ngulos/i.test(
      primaryText
    );
  if (
    geometry &&
    (hasExplicitPrimaryGeometry ||
      (!linearDirect && classification.kind !== 'linear' && classification.kind !== 'exponential'))
  ) {
    return geometry;
  }

  // 5. Modelo lineal (y = mx + b o ecuación balance ax ± b = c con coeficientes auténticos)
  if (linearDirect) {
    return buildLinearDiagramSpec(linearDirect, options);
  }

  return null;
}

export function buildMathDiagram(mission: MissionSection, options: DiagramBuildOptions): SacrintDiagramSpec {
  if (options.preferredExampleText && options.preferredExampleText.trim().length >= 12) {
    const preferredClean = cleanSacrintText(options.preferredExampleText);
    if (preferredClean && !/sin coeficientes numéricos/i.test(preferredClean)) {
      const preferredMatch = tryDetectDiagramFromTexts(preferredClean, preferredClean, options);
      if (preferredMatch?.available) return preferredMatch;
    }
  }
  if (options.session) {
    const sessionCore = cleanSacrintText(collectSessionCoreSource(options.session));
    if (/sin coeficientes numéricos/i.test(sessionCore)) {
      return buildUnavailableLinearDiagram(options);
    }
    const coreMatch = tryDetectDiagramFromTexts(sessionCore, sessionCore, options);
    if (coreMatch?.available) return coreMatch;

    // Aislamiento estricto por ejercicio: probar cada actividad práctica por separado sin mezclar ecuaciones entre sí
    for (const item of options.session.practica ?? []) {
      const singlePractice = cleanSacrintText(`${options.session.objetivo || ''} ${item.enunciado || ''}`);
      if (!singlePractice) continue;
      const practiceMatch = tryDetectDiagramFromTexts(singlePractice, singlePractice, options);
      if (practiceMatch?.available) return practiceMatch;
    }

    if (coreMatch) return coreMatch;
    const sessionFull = cleanSacrintText(collectSessionFullSource(options.session));
    if (/sin coeficientes numéricos/i.test(sessionFull)) {
      return buildUnavailableLinearDiagram(options);
    }
    const fallbackMatch = tryDetectDiagramFromTexts(sessionCore || sessionFull, sessionCore || sessionFull, options);
    if (fallbackMatch) return fallbackMatch;
    if (options.allowMissionFallback === false) {
      return buildUnavailableLinearDiagram(options);
    }
  }

  const missionCoreSource = cleanSacrintText(
    [
      mission.conceptZero?.solvedExample?.problemStatement,
      mission.iDoSection?.stepByStepDemo,
      mission.conceptZero?.solvedExample?.solutionSteps?.join(' '),
      mission.conceptZero?.coreExplanation,
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
