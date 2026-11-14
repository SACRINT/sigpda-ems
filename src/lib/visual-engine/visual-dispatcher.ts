/**
 * visual-dispatcher.ts — Enrutador y Despachador de Recursos Visuales
 * SIGPDA-EMS · SEMS Puebla MCCEMS 2026-2027
 *
 * Analiza la UAC, el tema/título y el contexto de la misión para suministrar
 * el gráfico determinístico adecuado.
 * - Fase 1: Área STEM activa (Pensamiento Matemático, Física, Química, etc.).
 * - Fases posteriores: Retorna null de forma segura para Humanidades, Sociales y Laboral.
 */

import {
  generateCartesianPlane,
  generateLinearGraph,
  generateQuadraticGraph,
  generateLinearSystemGraph,
  generateTriangle,
  generateAngleClassificationVisual,
  generateRectangle,
} from './generators/stem-generator';
import type { VisualResult } from './generators/stem-generator';
import { classifyTopic } from './topic-classifier';
import {
  generateTimeline,
  generateConceptMap,
  generateHistoricalFlow,
  generateSocialStatsChart,
} from './generators/humanities-generator';
import {
  generateMonteaTriplanar,
  generateIsometricPrism,
  generateTechnicalDimensioning,
  generateGeometricConstructions,
} from './generators/technical-drawing-generator';
import {
  generateTechnicalFlow,
  generateBlockDiagram,
  generateGanttChart,
  generateSafetyChecklistVisual,
} from './generators/laboral-generator';
import {
  extractYears,
  extractTermDefs,
  extractPercentStats,
  extractEnumSteps,
  extractSafetyChecks,
  extractSystemBlocks,
} from './content-extractor';
import { normalizeUnicode } from '@/lib/utils/normalize';

const STEM_KEYWORDS = [
  'pensamiento matemático',
  'análisis de fenómenos físicos',
  'física',
  'fisica',
  'química',
  'quimica',
  'ciencias naturales',
  'ciencias experimentales',
  'la materia y sus interacciones',
  'conservación de la energía',
  'ecosistemas',
  'reacciones químicas',
  'organismos',
  'biología',
  'biologia',
  'ecología',
  'ecologia',
  'ciencias de la salud',
  'microbiología',
  'microbiologia',
  'anatomía',
  'anatomia',
  'botánica',
  'botanica',
  'zoología',
  'zoologia',
  'geografía física',
  'geografia fisica',
  'matemáticas',
  'cálculo',
  'álgebra',
  'geometría',
  'trigonometría',
  'estadística',
  'cultura digital',
  'pensamiento variacional',
  'probabilidad y estadística',
  'taller de ciencias',
];

const SPORTS_SOCIOEMOTIONAL_EXCLUSIONS = [
  'actividades fisicas',
  'educacion fisica',
  'cuidado fisico',
  'deportivas',
  'deporte',
  'actividades artisticas',
  'arte y cultura',
];

const HUMANITIES_KEYWORDS = [
  'historia',
  'filosofía',
  'filosofia',
  'literatura',
  'ética',
  'etica',
  'sociología',
  'sociologia',
  'geografía',
  'geografia',
  'humanidades',
  'ciencias sociales',
  'conciencia histórica',
  'conciencia historica',
  'estructura socioeconómica',
  'estructura socioeconomica',
  'lengua y comunicación',
  'lengua y comunicacion',
];

const LABORAL_KEYWORDS = [
  'formacion para el trabajo',
  'formación para el trabajo',
  'capacitacion para el trabajo',
  'capacitación para el trabajo',
  'soporte y mantenimiento',
  'mantenimiento',
  'equipo de computo',
  'equipo de cómputo',
  'tecnologias de la informacion',
  'tecnologías de la información',
  'diseno grafico',
  'diseño gráfico',
  'contabilidad',
  'administracion',
  'administración',
  'electronica',
  'electrónica',
  'electricidad',
  'mecanica',
  'mecánica',
  'agropecuario',
  'salud comunitaria',
  'enfermeria',
  'enfermería',
  'seguridad e higiene',
  'taller tecnico',
  'taller técnico',
];

const TECHNICAL_DRAWING_KEYWORDS = [
  'dibujo tecnico',
  'dibujo técnico',
  'dibujo arquitectonico',
  'dibujo arquitectónico',
  'dibujo industrial',
  'geometria descriptiva',
  'geometría descriptiva',
  'diseno arquitectonico',
  'diseño arquitectónico',
  'diseno tecnico',
  'diseño técnico',
  'planos y maquetas',
  'trazo tecnico',
  'trazo técnico',
];

/**
 * Determina si una UAC pertenece al área de Dibujo Técnico y Arquitectura.
 */
export function isTechnicalDrawingSubject(uacName: string): boolean {
  const norm = normalizeUnicode(uacName);
  return TECHNICAL_DRAWING_KEYWORDS.some((kw) => {
    const normKw = normalizeUnicode(kw);
    return norm.includes(normKw);
  });
}

/**
 * Determina si una UAC pertenece al área STEM / Ciencias Exactas.
 */
export function isStemSubject(uacName: string): boolean {
  const norm = normalizeUnicode(uacName);
  if (SPORTS_SOCIOEMOTIONAL_EXCLUSIONS.some((ex) => norm.includes(ex))) {
    return false;
  }
  return STEM_KEYWORDS.some((kw) => {
    const normKw = normalizeUnicode(kw);
    return norm.includes(normKw);
  });
}

/**
 * Determina si una UAC pertenece al área de Humanidades o Ciencias Sociales.
 */
export function isHumanitiesSubject(uacName: string): boolean {
  const norm = normalizeUnicode(uacName);
  return HUMANITIES_KEYWORDS.some((kw) => {
    const normKw = normalizeUnicode(kw);
    return norm.includes(normKw);
  });
}

/**
 * Determina si una UAC pertenece al área de Formación para el Trabajo / Capacitación Laboral.
 */
export function isLaboralSubject(uacName: string): boolean {
  const norm = normalizeUnicode(uacName);
  return LABORAL_KEYWORDS.some((kw) => {
    const normKw = normalizeUnicode(kw);
    return norm.includes(normKw);
  });
}

export interface DispatchVisualOptions {
  scope?: 'mission' | 'session';
  missionNumber?: number;
  sessionNumber?: number;
}

export interface DispatchVisualRequest extends DispatchVisualOptions {
  subject: string;
  topic: string;
  context?: string;
}

/**
 * Intenta extraer parámetros m y b de expresiones lineales explícitas en el texto:
 * Ejemplos: "f(x) = 2x - 3", "y = -1.5x + 4", "f(x) = -x + 2", "y = 0.5x", "y = x + 1",
 * o ecuaciones lineales con datos numéricos reales como "5x - 300 = 1200" / "2x + 3 = 7".
 */
function tryExtractLinearParameters(text: string): { m: number; b: number; title: string } | null {
  const clean = text.replace(/−/g, '-').replace(/[–—]/g, '-');
  const eqRegex = /(?:f\s*\(\s*x\s*\)|y)\s*=\s*([+-]?\s*\d*(?:\.\d+)?)\s*\*?\s*x(?:\s*([+-])\s*(\d+(?:\.\d+)?))?/i;
  const match = clean.match(eqRegex);
  if (match) {
    const mStr = match[1].replace(/\s+/g, '');
    let m = 1;
    if (mStr === '' || mStr === '+') m = 1;
    else if (mStr === '-') m = -1;
    else {
      const parsed = parseFloat(mStr);
      if (!isNaN(parsed)) m = parsed;
    }

    let b = 0;
    if (match[2] && match[3]) {
      const sign = match[2] === '-' ? -1 : 1;
      const parsedB = parseFloat(match[3]);
      if (!isNaN(parsedB)) b = sign * parsedB;
    }

    if (Math.abs(m) <= 6 && Math.abs(b) <= 6 && (m !== 0 || b !== 0)) {
      const mFmt = m === 1 ? '' : m === -1 ? '-' : String(m);
      const bSign = b > 0 ? `+ ${b}` : b < 0 ? `- ${Math.abs(b)}` : '';
      return {
        m,
        b,
        title: `Modelación Gráfica: Función Lineal f(x) = ${mFmt}x ${bSign}`.replace(/\s+/g, ' ').trim(),
      };
    }
  }

  // Ecuación de primer grado de una variable con números explícitos: ax + b = c (solo si está en rango graficable directo)
  const singleVarMatch = clean.match(/\b([+-]?\d+(?:\.\d+)?)\s*x\s*([+-])\s*(\d+(?:\.\d+)?)\s*=\s*([+-]?\d+(?:\.\d+)?)/i);
  if (singleVarMatch) {
    const a = parseFloat(singleVarMatch[1]);
    const sign = singleVarMatch[2] === '-' ? -1 : 1;
    const bVal = sign * parseFloat(singleVarMatch[3]);
    const cVal = parseFloat(singleVarMatch[4]);
    const netB = Number((bVal - cVal).toFixed(2));
    if (a !== 0 && Math.abs(a) <= 6 && Math.abs(netB) <= 6) {
      const bSign = netB > 0 ? `+ ${netB}` : netB < 0 ? `- ${Math.abs(netB)}` : '';
      return {
        m: a,
        b: netB,
        title: `Modelación Lineal: f(x) = ${a}x ${bSign}`.replace(/\s+/g, ' ').trim(),
      };
    }
  }

  return null;
}

/**
 * Intenta extraer un sistema 2x2 real (dos ecuaciones en x, y con coeficientes numéricos explícitos).
 */
function tryExtractLinearSystemParameters(
  text: string
): { m1: number; b1: number; m2: number; b2: number; title: string } | null {
  const clean = text.replace(/−/g, '-').replace(/[–—]/g, '-');
  const lines: Array<{ m: number; b: number }> = [];

  // 1. Forma explícita y = mx + b
  const slopeMatches = Array.from(
    clean.matchAll(/(?:L[₁₂12]\s*:\s*)?y\s*=\s*([+-]?\s*\d*(?:\.\d+)?)\s*\*?\s*x(?:\s*([+-])\s*(\d+(?:\.\d+)?))?/gi)
  );
  for (const m of slopeMatches) {
    const rawM = m[1].replace(/\s+/g, '');
    const slope = rawM === '' || rawM === '+' ? 1 : rawM === '-' ? -1 : parseFloat(rawM);
    const intercept = m[2] && m[3] ? (m[2] === '-' ? -1 : 1) * parseFloat(m[3]) : 0;
    if (Number.isFinite(slope) && Number.isFinite(intercept) && Math.abs(slope) <= 6 && Math.abs(intercept) <= 8) {
      lines.push({ m: Number(slope.toFixed(2)), b: Number(intercept.toFixed(2)) });
    }
  }

  // 2. Forma estándar Ax + By = C
  if (lines.length < 2) {
    const stdMatches = Array.from(
      clean.matchAll(/([+-]?\s*\d*(?:\.\d+)?)\s*x\s*([+-])\s*(\d*(?:\.\d+)?)\s*y\s*=\s*([+-]?\s*\d+(?:\.\d+)?)/gi)
    );
    for (const sm of stdMatches) {
      const aStr = sm[1].replace(/\s+/g, '');
      const bStr = sm[3].replace(/\s+/g, '');
      const cStr = sm[4].replace(/\s+/g, '');
      const A = aStr === '' || aStr === '+' ? 1 : aStr === '-' ? -1 : parseFloat(aStr);
      const signB = sm[2] === '-' ? -1 : 1;
      const B = signB * (bStr === '' ? 1 : parseFloat(bStr));
      const C = parseFloat(cStr);
      if (Number.isFinite(A) && Number.isFinite(B) && Number.isFinite(C) && B !== 0) {
        const slope = Number((-A / B).toFixed(2));
        const intercept = Number((C / B).toFixed(2));
        if (Math.abs(slope) <= 6 && Math.abs(intercept) <= 8) {
          lines.push({ m: slope, b: intercept });
        }
      }
    }
  }

  if (lines.length >= 2 && (lines[0].m !== lines[1].m || lines[0].b !== lines[1].b)) {
    return {
      m1: lines[0].m,
      b1: lines[0].b,
      m2: lines[1].m,
      b2: lines[1].b,
      title: 'Sistema de Ecuaciones 2×2: Intersección L₁ y L₂',
    };
  }
  return null;
}

/**
 * Intenta extraer parámetros a, b, c de expresiones cuadráticas en el texto:
 * Ejemplos: "f(x) = x² - 4", "y = -x^2 + 4", "f(x) = 2x² - 3x + 1", "x² - 5x + 6 = 0"
 */
function tryExtractQuadraticParameters(text: string): { a: number; b: number; c: number; title: string } | null {
  const clean = text.replace(/−/g, '-').replace(/[–—]/g, '-');
  const quadRegex = /(?:(?:f\s*\(\s*x\s*\)|y)\s*=\s*)?([+-]?\s*\d*(?:\.\d+)?)\s*\*?\s*x\s*(?:\^2|²)(?:\s*([+-]\s*\d*(?:\.\d+)?)\s*\*?\s*x)?(?:\s*([+-])\s*(\d+(?:\.\d+)?))?(?:\s*=\s*0)?/i;
  const match = clean.match(quadRegex);
  if (match && /(?:\^2|²)/.test(match[0])) {
    const aStr = match[1].replace(/\s+/g, '');
    let a = 1;
    if (aStr === '' || aStr === '+') a = 1;
    else if (aStr === '-') a = -1;
    else {
      const parsed = parseFloat(aStr);
      if (!isNaN(parsed)) a = parsed;
    }

    let b = 0;
    if (match[2]) {
      const bStr = match[2].replace(/\s+/g, '');
      if (bStr === '' || bStr === '+') b = 1;
      else if (bStr === '-') b = -1;
      else {
        const parsedB = parseFloat(bStr);
        if (!isNaN(parsedB)) b = parsedB;
      }
    }

    let c = 0;
    if (match[3] && match[4]) {
      const sign = match[3] === '-' ? -1 : 1;
      const parsedC = parseFloat(match[4]);
      if (!isNaN(parsedC)) c = sign * parsedC;
    }

    if (Math.abs(a) <= 4 && Math.abs(b) <= 6 && Math.abs(c) <= 6 && a !== 0) {
      const eqSignB = b >= 0 ? `+ ${b}x` : `- ${Math.abs(b)}x`;
      const eqSignC = c >= 0 ? `+ ${c}` : `- ${Math.abs(c)}`;
      const eqStr = `f(x) = ${a === 1 ? '' : a === -1 ? '-' : a}x² ${b !== 0 ? eqSignB : ''} ${c !== 0 ? eqSignC : ''}`.trim();
      return {
        a,
        b,
        c,
        title: `Modelación Gráfica: Función Cuadrática ${eqStr}`,
      };
    }
  }
  return null;
}

/**
 * Extrae lados reales de un triángulo rectángulo cuando están explícitos en el texto.
 */
function tryExtractTriangleParameters(
  text: string
): { a: number; b: number; c: number } | null {
  const clean = text.replace(/−/g, '-');
  const catetosMatch = clean.match(
    /catetos?(?:\s+miden|\s+de|\s+son)?\s+(\d+(?:\.\d+)?)\s*(?:m|cm|u|metros|unidades)?\s*(?:y|,)\s*(\d+(?:\.\d+)?)/i
  );
  if (catetosMatch) {
    const a = parseFloat(catetosMatch[1]);
    const b = parseFloat(catetosMatch[2]);
    if (a > 0 && b > 0) {
      return { a, b, c: Number(Math.hypot(a, b).toFixed(2)) };
    }
  }
  const abMatch =
    clean.match(/\ba\s*=\s*(\d+(?:\.\d+)?)\b[^.;]{0,40}\bb\s*=\s*(\d+(?:\.\d+)?)\b/i);
  if (abMatch) {
    const a = parseFloat(abMatch[1]);
    const b = parseFloat(abMatch[2]);
    if (a > 0 && b > 0) {
      return { a, b, c: Number(Math.hypot(a, b).toFixed(2)) };
    }
  }
  return null;
}

/**
 * Extrae un ángulo explícito en grados sexagesimales si aparece en el texto (ej. "45°", "60 grados").
 */
function tryExtractAngleDegree(text: string): number | null {
  const m = text.match(/\b(\d{1,3}(?:\.\d+)?)\s*(?:°|grados?\b)/i);
  if (!m) return null;
  const val = parseFloat(m[1]);
  if (val > 0 && val <= 180) return val;
  return null;
}

/**
 * Extrae dimensiones reales de un rectángulo si aparecen en el texto (ej. "largo de 12 m y ancho de 8 m").
 */
function tryExtractRectangleParameters(text: string): { largo: number; ancho: number } | null {
  const m =
    text.match(/(?:largo|base)(?:\s+de|\s+es|\s*=\s*)?\s*(\d+(?:\.\d+)?)\s*(?:m|cm|u|metros)?\s*(?:y|,)\s*(?:ancho|altura)(?:\s+de|\s+es|\s*=\s*)?\s*(\d+(?:\.\d+)?)/i) ||
    text.match(/(\d+(?:\.\d+)?)\s*(?:m|cm|metros)?\s*(?:de\s+largo|de\s+base)\s*(?:por|y)\s*(\d+(?:\.\d+)?)\s*(?:m|cm|metros)?\s*(?:de\s+ancho|de\s+altura)/i);
  if (!m) return null;
  const largo = parseFloat(m[1]);
  const ancho = parseFloat(m[2]);
  if (largo > 0 && ancho > 0) return { largo, ancho };
  return null;
}

/**
 * Despachador especializado para Dibujo Técnico I, II y Arquitectura.
 * Garantiza diagramas normativos (Montea Triplanar, Isométrico, Acotación, Trazados Geométricos)
 * en lugar de ecuaciones algebraicas 2x2 o gráficas cartesianas.
 */
export function dispatchTechnicalDrawing(
  topic: string,
  contextText?: string,
  missionIndex = 1
): VisualResult {
  const searchText = normalizeUnicode(`${topic} ${contextText || ''}`);

  // 1. Montea Triplanar / Vistas Diédricas / Proyecciones Ortogonales
  if (
    searchText.includes('montea') ||
    searchText.includes('diedric') ||
    searchText.includes('ortogonal') ||
    searchText.includes('vista') ||
    searchText.includes('planta') ||
    searchText.includes('alzado') ||
    searchText.includes('perfil') ||
    searchText.includes('proyeccion')
  ) {
    return generateMonteaTriplanar({
      title: `Montea Triplanar: ${topic.slice(0, 40)}`,
    });
  }

  // 2. Perspectiva Isométrica / Axonométrica / Volumen 3D
  if (
    searchText.includes('isometric') ||
    searchText.includes('axonometric') ||
    searchText.includes('perspectiva') ||
    searchText.includes('volumen') ||
    searchText.includes('3d') ||
    searchText.includes('solido') ||
    searchText.includes('arista')
  ) {
    return generateIsometricPrism({
      title: `Perspectiva Isométrica: ${topic.slice(0, 40)}`,
    });
  }

  // 3. Acotación y Normalización Técnica
  if (
    searchText.includes('acotaci') ||
    searchText.includes('cota') ||
    searchText.includes('norma') ||
    searchText.includes('dimension') ||
    searchText.includes('escala') ||
    searchText.includes('tolerancia')
  ) {
    return generateTechnicalDimensioning({
      title: `Acotación Normalizada: ${topic.slice(0, 40)}`,
    });
  }

  // 4. Trazados Geométricos / Enlaces / Tangencias / Óvalos
  if (
    searchText.includes('tangente') ||
    searchText.includes('tangencia') ||
    searchText.includes('empalme') ||
    searchText.includes('ovalo') ||
    searchText.includes('elipse') ||
    searchText.includes('curva') ||
    searchText.includes('geometri')
  ) {
    return generateGeometricConstructions({
      title: `Trazado Geométrico: ${topic.slice(0, 40)}`,
    });
  }

  // Rotación pedagógica determinística por índice de misión
  const mod = ((missionIndex - 1) % 4) + 1;
  if (mod === 1) {
    return generateMonteaTriplanar({
      title: `Montea Triplanar y Proyecciones: ${topic.slice(0, 36)}`,
    });
  }
  if (mod === 2) {
    return generateIsometricPrism({
      title: `Perspectiva Isométrica Normalizada: ${topic.slice(0, 34)}`,
    });
  }
  if (mod === 3) {
    return generateTechnicalDimensioning({
      title: `Sistema de Acotación Técnica: ${topic.slice(0, 36)}`,
    });
  }
  return generateGeometricConstructions({
    title: `Construcciones Geométricas Básicas: ${topic.slice(0, 34)}`,
  });
}

/**
 * Despacha el recurso gráfico vectorial adecuado según la asignatura, el tema,
 * el contexto completo y el ámbito (misión vs. sesión).
 *
 * REGLA ESTRICTA DE VERACIDAD (Phase 5):
 * - Nunca inventa coeficientes (1,0,-4 / 1,-1,-0.5,3.5 / 1.5,1) ni triángulos 3-4-5 cuando no hay datos reales.
 * - Nunca rotula una figura de sesión como "Misión 16"; distingue explícitamente `scope: 'session'` vs `'mission'`.
 */
export function dispatchVisual(
  uacNameOrRequest: string | DispatchVisualRequest,
  topicArg?: string,
  contextTextArg?: string,
  missionIndexArg = 1,
  optionsArg?: DispatchVisualOptions
): VisualResult | null {
  const isObj = typeof uacNameOrRequest === 'object' && uacNameOrRequest !== null;
  const uacName = isObj ? uacNameOrRequest.subject : uacNameOrRequest;
  const topic = isObj ? uacNameOrRequest.topic : topicArg || '';
  const contextText = isObj ? uacNameOrRequest.context : contextTextArg;
  const scope: 'mission' | 'session' = isObj
    ? uacNameOrRequest.scope ?? (uacNameOrRequest.sessionNumber != null ? 'session' : 'mission')
    : optionsArg?.scope ?? 'mission';
  const missionNumber = isObj
    ? uacNameOrRequest.missionNumber ?? 1
    : optionsArg?.missionNumber ?? missionIndexArg ?? 1;
  const sessionNumber = isObj
    ? uacNameOrRequest.sessionNumber
    : optionsArg?.sessionNumber ?? (scope === 'session' ? missionIndexArg : undefined);

  const scopeLabel =
    scope === 'session' && sessionNumber != null
      ? `Sesión ${sessionNumber}`
      : `Misión ${missionNumber}`;

  // ── 0. DISPATCHER ESPECIALIZADO: DIBUJO TÉCNICO Y ARQUITECTURA ──────────
  if (isTechnicalDrawingSubject(uacName)) {
    return dispatchTechnicalDrawing(topic, contextText, missionNumber);
  }

  const isStem = isStemSubject(uacName);
  const isHumanities = isHumanitiesSubject(uacName);
  const isLaboral = isLaboralSubject(uacName);

  // Combinar título + contexto para máxima cobertura de keywords
  const searchText = normalizeUnicode(`${topic} ${contextText || ''}`);

  // ── A. DISPATCHER ÁREA STEM / CIENCIAS EXACTAS ────────────────────────────
  if (isStem) {
    const rawContext = `${topic} ${contextText || ''}`;
    const classification = classifyTopic({
      title: topic,
      topic,
      bodyText: contextText,
      subject: uacName,
    });

    const allowGeometryFallback = classification.kind === 'geometry' || classification.kind === 'generic';
    const allowQuadraticFallback = classification.kind !== 'geometry' && classification.kind !== 'exponential' && classification.kind !== 'system-2x2';

    // 1. Parábolas y Ecuaciones Cuadráticas
    const extractedQuadratic = tryExtractQuadraticParameters(rawContext);
    const hasExplicitQuadraticCue =
      classification.kind === 'quadratic' ||
      (allowQuadraticFallback &&
        !/\b(?:pitagoras|hipotenusa|cateto|angulo|transportador)\b/.test(searchText) &&
        ((classification.kind === 'generic' &&
          /\b(?:parabola|parabolico|ecuacion(?:es)?\s+cuadratica(?:s)?|funcion(?:es)?\s+cuadratica(?:s)?|modelo\s+cuadratico|segundo\s+grado|discriminante|concavidad|tiro\s+parabolico)\b/.test(
            searchText
          )) ||
          Boolean(extractedQuadratic)));

    if (hasExplicitQuadraticCue) {
      if (extractedQuadratic) {
        return generateQuadraticGraph(extractedQuadratic.a, extractedQuadratic.b, extractedQuadratic.c, {
          title: extractedQuadratic.title,
        });
      }
      return generateCartesianPlane({
        title: `Plano Cartesiano — Modelación Cuadrática (${scopeLabel})`,
        subtitle: 'Modelo por construir: tabula y grafica con los datos del problema',
        isFallback: true,
      });
    }

    // 2. Sistemas de Ecuaciones Lineales 2x2
    const extractedSystem = tryExtractLinearSystemParameters(rawContext);
    const hasSystemCue =
      classification.kind === 'system-2x2' ||
      ((classification.kind === 'generic' || (classification.kind === 'linear' && Boolean(extractedSystem))) &&
        /\b(?:sistema(?:s)?\s+de\s+ecuaciones|sistema(?:s)?\s+lineal(?:es)?|ecuaciones\s+simultaneas|2x2|2×2|metodo\s+de\s+(?:sustitucion|igualacion|reduccion|eliminacion|determinantes|cramer)|regla\s+de\s+cramer|interseccion\s+de\s+rectas)\b/.test(
          searchText
        ));

    if (hasSystemCue) {
      if (extractedSystem) {
        return generateLinearSystemGraph(
          extractedSystem.m1,
          extractedSystem.b1,
          extractedSystem.m2,
          extractedSystem.b2,
          { title: `${extractedSystem.title} (${scopeLabel})` }
        );
      }
      return generateCartesianPlane({
        title: `Plano Cartesiano — Sistema de Ecuaciones 2×2 (${scopeLabel})`,
        subtitle: 'Modelo por construir: traza L₁ y L₂ para hallar la intersección',
        isFallback: true,
      });
    }

    // 3. Geometría Plana: Ángulos, Triángulos, Congruencia/Semejanza, Teorema de Pitágoras y Áreas
    const hasAngleOnlyCue =
      (classification.kind === 'geometry' && classification.subtopic === 'angles') ||
      (allowGeometryFallback &&
        /\b(?:tipos?\s+de\s+angulos|clasificacion\s+de\s+angulos|angulo(?:s)?\s+(?:agudo|recto|obtuso|llano|complementario|suplementario|opuesto|interno|externo)|transportador|bisectriz|suplementari[oa]s?|complementari[oa]s?)\b/.test(
          searchText
        ) &&
        !/\b(?:pitagoras|hipotenusa|cateto)\b/.test(searchText));

    if (hasAngleOnlyCue) {
      const extractedDeg = tryExtractAngleDegree(rawContext);
      return generateAngleClassificationVisual({
        title: `Geometría Plana: Vértices, Ángulos y Medición Angular (${scopeLabel})`,
        angleDeg: extractedDeg,
      });
    }

    if (
      classification.kind === 'geometry' ||
      (allowGeometryFallback &&
        /\b(?:triangulo(?:s)?|pitagoras|trigonometria|trigonometric[oa]s?|cateto(?:s)?|hipotenusa|congruencia\s+(?:y\s+semejanza|de\s+(?:triangulos|figuras)|geometrica)|semejanza\s+de\s+triangulos|criterios?\s+(?:de\s+congruencia|LLL|LAL|ALA)|teorema\s+de\s+tales)\b/.test(
          searchText
        ))
    ) {
      if (
        classification.subtopic === 'perimeter-area' ||
        /\b(?:rectangulo(?:s)?|cuadrilatero(?:s)?|perimetro\s+y\s+area|area\s+del\s+(?:rectangulo|terreno))\b/.test(
          searchText
        )
      ) {
        const rectParams = tryExtractRectangleParameters(rawContext);
        return generateRectangle(rectParams?.largo ?? null, rectParams?.ancho ?? null, {
          title: `Geometría Aplicada: Perímetro y Área (${scopeLabel})`,
        });
      }

      const triParams = tryExtractTriangleParameters(rawContext);
      return generateTriangle(triParams?.a ?? null, triParams?.b ?? null, triParams?.c ?? null, {
        title:
          classification.subtopic === 'congruence-similarity'
            ? `Geometría Plana: Congruencia y Semejanza de Triángulos (${scopeLabel})`
            : `Geometría Plana: Triángulo Rectángulo y Teorema de Pitágoras (${scopeLabel})`,
      });
    }

    // 4. Rectángulos, Polígonos, Áreas y Perímetros
    if (
      allowGeometryFallback &&
      /\b(?:rectangulo(?:s)?|perimetro|poligono(?:s)?|cuadrilatero(?:s)?|area\s+(?:y\s+perimetro|del\s+(?:rectangulo|cuadrado|triangulo|poligono|terreno|circulo)))\b/.test(
        searchText
      )
    ) {
      const rectParams = tryExtractRectangleParameters(rawContext);
      return generateRectangle(rectParams?.largo ?? null, rectParams?.ancho ?? null, {
        title: `Geometría Aplicada: Cálculo de Perímetro y Área (${scopeLabel})`,
      });
    }

    // 5. Ecuaciones y Funciones Lineales, Balanza Algebraica y Variación
    if (
      classification.kind === 'linear' ||
      classification.kind === 'exponential' ||
      classification.kind === 'proportion' ||
      /\b(?:lineal(?:es)?|linea\s+recta|primer\s+grado|pendiente|ordenada\s+al\s+origen|funcion\s+lineal|ecuacion(?:es)?|igualdad|balanza|incognita(?:s)?|despeje|algebraic[oa]s?|proporcionalidad|interes\s+simple|interes\s+compuesto|tasa\s+de\s+crecimiento)\b/.test(
        searchText
      )
    ) {
      const extracted = tryExtractLinearParameters(rawContext);
      if (extracted) {
        return generateLinearGraph(extracted.m, extracted.b, {
          title: extracted.title,
        });
      }

      return generateCartesianPlane({
        title: `Plano Cartesiano para Tabulación y Bosquejo (${scopeLabel})`,
        subtitle: 'Modelo por construir: registra tus valores y traza la representación gráfica',
        isFallback: true,
      });
    }

    // 6. Por defecto en STEM: Plano Cartesiano limpio (nunca inventa funciones ni dimensiones)
    return generateCartesianPlane({
      title: `Plano Cartesiano para Tabulación y Bosquejo de Datos (${scopeLabel})`,
      subtitle: 'Modelo por construir con los datos de la actividad',
      isFallback: true,
    });
  }

  // ── B. DISPATCHER ÁREA HUMANIDADES Y CIENCIAS SOCIALES ─────────────────────
  if (isHumanities) {
    const rawContext = `${topic}\n${contextText || ''}`;

    // 1. Diagramas de Flujo Histórico Causal (procesos históricos, revoluciones, movimientos sociales)
    if (
      searchText.includes('proceso historico') ||
      searchText.includes('revolucion') ||
      searchText.includes('movimiento social')
    ) {
      const { historicalSteps } = extractEnumSteps(rawContext);
      if (historicalSteps.length > 0) {
        const res = generateHistoricalFlow(historicalSteps, {
          title: `Flujo Causal: ${topic.slice(0, 42)}`,
        });
        res.metadata = {
          type: 'historical_flow',
          realItemCount: historicalSteps.length,
          isFallback: false,
        };
        return res;
      }

      // Si no hay pasos enumerados pero sí fechas históricas, despachar Línea de Tiempo
      const years = extractYears(rawContext);
      if (years.length >= 2) {
        const res = generateTimeline(years, {
          title: `Línea de Tiempo: ${topic.slice(0, 42)}`,
        });
        res.metadata = {
          type: 'timeline',
          realItemCount: years.length,
          isFallback: false,
        };
        return res;
      }

      const res = generateHistoricalFlow([], {
        title: `Flujo Causal: ${topic.slice(0, 42)}`,
      });
      res.metadata = {
        type: 'historical_flow',
        realItemCount: 0,
        isFallback: true,
      };
      return res;
    }

    // 2. Gráficas Estadísticas Sociales / Demografía (demografía, población, estadística social)
    if (
      searchText.includes('demograf') ||
      searchText.includes('poblacion') ||
      searchText.includes('estadistica social')
    ) {
      const stats = extractPercentStats(rawContext);
      const res = generateSocialStatsChart(stats, {
        title: `Indicadores Sociales: ${topic.slice(0, 42)}`,
      });
      res.metadata = {
        type: 'social_stats',
        realItemCount: stats.length,
        isFallback: stats.length === 0,
      };
      return res;
    }

    // 3. Líneas de Tiempo (cronologías, siglos, etapas, periodos históricos)
    if (
      searchText.includes('linea de tiempo') ||
      searchText.includes('cronolog') ||
      searchText.includes('siglo') ||
      searchText.includes('periodo') ||
      searchText.includes('etapa') ||
      searchText.includes('epoca')
    ) {
      const events = extractYears(rawContext);
      const res = generateTimeline(events, {
        title: `Línea de Tiempo: ${topic.slice(0, 42)}`,
      });
      res.metadata = {
        type: 'timeline',
        realItemCount: events.length,
        isFallback: events.length === 0,
      };
      return res;
    }

    // 4. Mapas Conceptuales (Filosofía, Ética, Literatura, Sociología, Geografía, conceptos)
    if (
      searchText.includes('filosof') ||
      searchText.includes('etica') ||
      searchText.includes('literatur') ||
      searchText.includes('sociolog') ||
      searchText.includes('geograf') ||
      searchText.includes('concepto') ||
      searchText.includes('pensamiento') ||
      searchText.includes('moral')
    ) {
      const { nodes, edges } = extractTermDefs(rawContext, topic);
      const res = generateConceptMap(nodes, edges, {
        title: `Mapa Conceptual: ${topic.slice(0, 42)}`,
      });
      res.metadata = {
        type: 'concept_map',
        realItemCount: nodes.length > 0 ? nodes.length - 1 : 0,
        isFallback: nodes.length === 0,
      };
      return res;
    }

    // 5. Por defecto en Humanidades según UAC (Historia/Conciencia -> Línea de Tiempo, otras -> Mapa Conceptual)
    const normUac = normalizeUnicode(uacName);
    if (normUac.includes('historia') || normUac.includes('conciencia historica')) {
      const events = extractYears(rawContext);
      const res = generateTimeline(events, {
        title: `Línea de Tiempo Histórica: ${topic.slice(0, 42)}`,
      });
      res.metadata = {
        type: 'timeline',
        realItemCount: events.length,
        isFallback: events.length === 0,
      };
      return res;
    }

    const { nodes, edges } = extractTermDefs(rawContext, topic);
    const res = generateConceptMap(nodes, edges, {
      title: `Estructura Conceptual Formativa: ${topic.slice(0, 42)}`,
    });
    res.metadata = {
      type: 'concept_map',
      realItemCount: nodes.length > 0 ? nodes.length - 1 : 0,
      isFallback: nodes.length === 0,
    };
    return res;
  }

  // ── C. DISPATCHER ÁREA FORMACIÓN PARA EL TRABAJO / LABORAL ────────────────
  if (isLaboral) {
    const rawContext = `${topic}\n${contextText || ''}`;

    // 1. Matriz de Seguridad Industrial, EPP y Normatividad NOM-STPS
    if (
      searchText.includes('seguridad') ||
      searchText.includes('epp') ||
      searchText.includes('esd') ||
      searchText.includes('nom') ||
      searchText.includes('norma') ||
      searchText.includes('proteccion') ||
      searchText.includes('riesgo') ||
      searchText.includes('higiene') ||
      searchText.includes('accidente') ||
      searchText.includes('emergencia')
    ) {
      const safetyChecks = extractSafetyChecks(rawContext);
      const res = generateSafetyChecklistVisual(safetyChecks, {
        title: `Seguridad y EPP: ${topic.slice(0, 42)}`,
      });
      res.metadata = {
        type: 'safety_checklist',
        realItemCount: safetyChecks.length,
        isFallback: safetyChecks.length === 0,
      };
      return res;
    }

    // 2. Cronograma de Operaciones y Diagrama de Gantt
    if (
      searchText.includes('cronograma') ||
      searchText.includes('gantt') ||
      searchText.includes('planeacion') ||
      searchText.includes('semanas') ||
      searchText.includes('etapas') ||
      searchText.includes('orden de trabajo') ||
      searchText.includes('avance') ||
      searchText.includes('calendario')
    ) {
      const { ganttTasks } = extractEnumSteps(rawContext);
      const res = generateGanttChart(ganttTasks, {
        title: `Cronograma Técnico: ${topic.slice(0, 42)}`,
      });
      res.metadata = {
        type: 'gantt_chart',
        realItemCount: ganttTasks.length,
        isFallback: ganttTasks.length === 0,
      };
      return res;
    }

    // 3. Diagrama de Bloques y Arquitectura de Sistemas
    if (
      searchText.includes('sistema') ||
      searchText.includes('bloques') ||
      searchText.includes('arquitectura') ||
      searchText.includes('modulo') ||
      searchText.includes('circuito') ||
      searchText.includes('red') ||
      searchText.includes('hardware') ||
      searchText.includes('fuente') ||
      searchText.includes('alimentacion') ||
      searchText.includes('sensores') ||
      searchText.includes('actuadores')
    ) {
      const blocks = extractSystemBlocks(rawContext);
      const res = generateBlockDiagram(blocks, {
        title: `Arquitectura Modular: ${topic.slice(0, 42)}`,
      });
      res.metadata = {
        type: 'block_diagram',
        realItemCount: blocks.length,
        isFallback: blocks.length === 0,
      };
      return res;
    }

    // 4. Diagrama de Procedimiento Técnico / Flujo de Taller (Default para laboral)
    const { technicalSteps } = extractEnumSteps(rawContext);
    const res = generateTechnicalFlow(technicalSteps, {
      title: `Procedimiento Técnico: ${topic.slice(0, 42)}`,
    });
    res.metadata = {
      type: 'technical_flow',
      realItemCount: technicalSteps.length,
      isFallback: technicalSteps.length === 0,
    };
    return res;
  }

  // ── D. FALLBACK DETERMINÍSTICO UNIVERSAL ──────────────────────────────────
  const rawContext = `${topic}\n${contextText || ''}`;
  const { nodes, edges } = extractTermDefs(rawContext, topic);
  const res = generateConceptMap(nodes, edges, {
    title: `Estructura Conceptual Formativa: ${topic.slice(0, 42)}`,
  });
  res.metadata = {
    type: 'concept_map',
    realItemCount: nodes.length > 0 ? nodes.length - 1 : 0,
    isFallback: true,
  };
  return res;
}
