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
  generateNapoleonTriangleVisual,
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

const DIGITAL_CULTURE_KEYWORDS = [
  'cultura digital',
  'taller de cultura digital',
  'pensamiento algoritmico',
  'pensamiento algorítmico',
  'programacion',
  'programación',
  'tecnologias de la informacion',
  'tecnologías de la información',
  'informatica',
  'informática',
  'ciberseguridad',
  'inteligencia artificial',
  'ciencia de datos',
];

/**
 * Determina si una UAC pertenece a Cultura Digital / Programación / TI.
 * Nota: 'cultura digital' se conserva en STEM_KEYWORDS por compatibilidad con plantillas 08
 * y material-extractor, pero `dispatchVisual` la intercepta antes de la rama STEM para evitar
 * cualquier fallback de Plano Cartesiano.
 */
export function isDigitalCultureSubject(uacName: string): boolean {
  const norm = normalizeUnicode(uacName);
  return DIGITAL_CULTURE_KEYWORDS.some((kw) => norm.includes(normalizeUnicode(kw)));
}

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
    if (Number.isFinite(slope) && Number.isFinite(intercept) && Math.abs(slope) <= 100 && Math.abs(intercept) <= 2000) {
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
        if (Math.abs(slope) <= 100 && Math.abs(intercept) <= 2000) {
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
export function tryExtractQuadraticParameters(text: string): { a: number; b: number; c: number; title: string } | null {
  const clean = text.replace(/−/g, '-').replace(/[–—]/g, '-');
  // Evitar capturar `x²` dentro de fórmulas genéricas literales ("ax² + bx + c = 0") exigiendo que no preceda letra.
  const quadRegex = /(?:(?:f\s*\(\s*x\s*\)|y)\s*=\s*)?(?<![a-zA-Z])([+-]?\s*\d*(?:\.\d+)?)\s*\*?\s*x\s*(?:\^2|²)(?:\s*([+-]\s*\d*(?:\.\d+)?)\s*\*?\s*x)?(?:\s*([+-])\s*(\d+(?:\.\d+)?))?(?:\s*=\s*0)?/gi;
  const candidates: Array<{ a: number; b: number; c: number; title: string; specificity: number }> = [];
  for (const match of clean.matchAll(quadRegex)) {
    if (!/(?:\^2|²)/.test(match[0])) continue;
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

    if (Math.abs(a) <= 100 && Math.abs(b) <= 1000 && Math.abs(c) <= 10000 && a !== 0) {
      const eqSignB = b >= 0 ? `+ ${b}x` : `- ${Math.abs(b)}x`;
      const eqSignC = c >= 0 ? `+ ${c}` : `- ${Math.abs(c)}`;
      const eqStr = `f(x) = ${a === 1 ? '' : a === -1 ? '-' : a}x² ${b !== 0 ? eqSignB : ''} ${c !== 0 ? eqSignC : ''}`
        .replace(/\s+/g, ' ')
        .trim();
      const specificity =
        (b !== 0 ? 2 : 0) +
        (c !== 0 ? 2 : 0) +
        (Math.abs(a) !== 1 ? 1 : 0) +
        (/=\s*0/.test(match[0]) ? 1 : 0);
      candidates.push({
        a,
        b,
        c,
        title: `Modelación Gráfica: Función Cuadrática ${eqStr}`,
        specificity,
      });
    }
  }
  if (candidates.length === 0) return null;
  candidates.sort((left, right) => right.specificity - left.specificity);
  const best = candidates[0]!;
  return { a: best.a, b: best.b, c: best.c, title: best.title };
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

const DIAGRAM_SCAFFOLDING_PREFIX_RE =
  /^(?:(?:misi[oó]n|sesi[oó]n)\s*\d+\s*[:.\-–—]\s*|(?:exploraci[oó]n\s+diagn[oó]stica(?:\s+y\s+problematizaci[oó]n\s+situada)?|fundamentaci[oó]n\s+y\s+activaci[oó]n|pr[aá]ctica\s+y\s+aplicaci[oó]n(?:\s*\([^)]*\))?|aplicaci[oó]n\s+pr[aá]ctica\s+en\s+situaciones\s+contextuales|desarrollo\s+y\s+aplicaci[oó]n|proyecto\s+integrador|evaluaci[oó]n\s+y\s+cierre|cierre\s+y\s+s[ií]ntesis)\s*[:.\-–—]?\s*)/i;

const DANGLING_TAIL_WORD_RE =
  /(?:^|\s)(?:de|del|al|la|el|los|las|lo|un|una|unos|unas|y|e|o|u|en|a|para|con|por|su|sus|tu|tus|mi|mis|se|te|le|les|nos|qu[eé]|c[oó]mo|donde|d[oó]nde|cuando|cu[aá]ndo|quien|qui[eé]n|cual|cu[aá]l|cuales|cu[aá]les|hacia|sobre|entre|desde|seg[uú]n|mediante|sin|tras|ante|bajo|contra|esta|este|estos|estas|ese|esa|esos|esas|aquel|aquella|es|son|era|eran|fue|fueron|ser|estar|est[aá]|est[aá]n|ha|han|he|has|hay|pero|sino|porque|aunque|mientras|adem[aá]s|tambi[eé]n|muy|m[aá]s|menos|no|ni|si|s[ií]|solo|s[oó]lo|aqu[ií]|ah[ií]|permite|permiten|tiene|tienen|hace|hacen|puede|pueden|debe|deben|responde|responden)$/i;

/** Verifica si una etiqueta de diagrama termina en palabra colgante (preposición, relativo o verbo inconcluso). */
export function hasDanglingSpanishEnding(text: string): boolean {
  const clean = (text || '').replace(/[\s.,;:·\-–—?!)]+$/g, '').trim();
  if (!clean) return true;
  return DANGLING_TAIL_WORD_RE.test(clean);
}

/**
 * Limpia prefijos/sufijos redundantes ("Misión N:", "Sesión N:", "(Misión N)", listas parentéticas
 * de asignaturas, paréntesis sin cerrar y preposiciones colgantes como "al", "de", "y") y trunca
 * estrictamente en frontera de palabra.
 */
export function cleanTopicForDiagram(raw: string, maxChars = 46): string {
  let clean = (raw || '')
    .replace(/\s+/g, ' ')
    .replace(/\s*\((?:misi[oó]n|sesi[oó]n)\s*\d+\)\s*$/i, '')
    .replace(/\s*\((?:cultura\s+digital|pensamiento\s+matem[aá]tico|lengua\s+y\s+comunicaci[oó]n|ciencias\s+(?:naturales|sociales)|humanidades|formaci[oó]n\s+laboral)[^)]*\)?/gi, '')
    .trim();

  // Remover en cascada andamiajes pedagógicos que roban caracteres al tema disciplinar real
  for (let pass = 0; pass < 4; pass++) {
    const stripped = clean.replace(DIAGRAM_SCAFFOLDING_PREFIX_RE, '').trim();
    if (stripped === clean || stripped.length < 6) break;
    clean = stripped;
  }

  clean = clean
    .replace(/\s*\([^)]*$/g, '') // Nunca dejar paréntesis abierto sin cerrar
    .replace(/^[\s·:;\-–—]+|[\s·:;\-–—]+$/g, '')
    .trim();

  if (clean.length > maxChars) {
    const sliced = clean.slice(0, maxChars);
    const lastSpace = sliced.lastIndexOf(' ');
    clean = (lastSpace >= Math.max(8, Math.floor(maxChars * 0.45)) ? sliced.slice(0, lastSpace) : sliced)
      .replace(/\s*\([^)]*$/g, '')
      .trim();
  }

  // Limpiar puntuación y preposiciones/artículos colgantes en bucle (incluye "al", "de", "y", etc.)
  for (let pass = 0; pass < 4; pass++) {
    const next = clean
      .replace(/[\s,;:·\-–—(]+$/g, '')
      .replace(DANGLING_TAIL_WORD_RE, '')
      .replace(/[\s,;:·\-–—(]+$/g, '')
      .trim();
    if (next === clean) break;
    clean = next;
  }

  // Asegurar paréntesis balanceados siempre
  const opens = (clean.match(/\(/g) || []).length;
  const closes = (clean.match(/\)/g) || []).length;
  if (opens > closes) {
    clean = clean.replace(/\s*\([^)]*$/, '').trim();
  }

  return clean || 'Tema de la Misión';
}

const DIGITAL_PHRASE_STOPWORDS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'al', 'en', 'con', 'por', 'para',
  'que', 'como', 'sobre', 'entre', 'desde', 'hacia', 'mediante', 'traves', 'durante', 'ante', 'bajo',
  'sus', 'su', 'tu', 'tus', 'este', 'esta', 'estos', 'estas', 'ese', 'esa', 'cada', 'todo', 'toda',
  'todos', 'todas', 'mision', 'sesion', 'bloque', 'cultura', 'digital', 'estudiante', 'estudiantes',
  'actividad', 'objetivo', 'tema', 'uso', 'aplicacion', 'desarrollo', 'contexto', 'escolar', 'comunidad',
]);

const NARRATIVE_OR_SCAFFOLDING_PHRASE_RE =
  /^(?:imagina|piensa|observa|recuerda|esta\s+situaci[oó]n|en\s+tu\s+(?:plantel|escuela|comunidad)|proyecto\s+integrador|evaluaci[oó]n\s+y\s+cierre|pr[aá]ctica\s+y\s+aplicaci[oó]n|aplicaci[oó]n\s+pr[aá]ctica|analizas|comprendes|identificas|exploras|consolidaci[oó]n|misi[oó]n\s*\d+|sesi[oó]n\s*\d+|concepto\s+clave)/i;

const PROSE_CLAUSE_START_RE =
  /^(?:al\s+[a-záéíóúüñ]+r\b|(?:comprender|analizar|identificar|observar|entender|reconocer|evaluar|explorar|aplicar|reflexionar|conocer|revisar|verificar|valorar|fomentar|promover|desarrollar|estudiar|descubrir|construir|explicar|describir|comparar|seleccionar|utilizar|usar|crear|elaborar|dise[nñ]ar|implementar|validar|resolver|dominar|definir|aprender|mejorar|lograr|establecer|realizar|ejecutar|sustituir|considerar|calcular|interpretar|determinar|obtener)\b|(?:identifica|define|analiza|aplica|verifica|comprueba|compara|clasifica|describe|explica|dise[nñ]a|elabora|construye|resuelve|eval[uú]a|observa|reflexiona|investiga|selecciona|organiza|revisa|utiliza|usa|crea|domina|establece|realiza|ejecuta|sustituye|considera(?:s)?|calcula|interpreta|determina|obt[eé]n|traza|dibuja|escribe|anota|registra|presenta|entrega|redacta|comenta|discute|plantea|prop[oó]n|formula|integra|coordina)\b|(?:responde|responden|permite|permiten|ayuda|ayudan|busca|buscan|sirve|sirven|ofrece|ofrecen|garantiza|garantizan|facilita|facilitan|requiere|requieren|implica|implican|muestra|muestran|explica|explican|describe|describen|indica|indican|representa|representan|constituye|constituyen|forma|forman|genera|generan|influye|influyen|afecta|afectan|depende|dependen|determina|determinan|controla|controlan|gestiona|gestionan|administra|administran|tiene|tienen|hace|hacen|puede|pueden|debe|deben|han|ha|fue|fueron|era|eran)\b|(?:este|esta|estos|estas|ese|esa|esos|esas|aquel|aquella|su|sus|tu|tus|mi|mis|nuestro|nuestra|aqu[ií]|ah[ií]|all[ií])\b|(?:cuando|mientras|porque|aunque|si\s+|donde|d[oó]nde|c[oó]mo|para\s+que|a\s+trav[eé]s|por\s+ejemplo|en\s+cambio|sin\s+embargo|as[ií]\s+como|es\s+decir|hoy\s+en\s+d[ií]a|actualmente|finalmente|adem[aá]s|tambi[eé]n|pero|sino|quien|cual|cuales|mediante|durante|seg[uú]n|hacia|desde|sobre|entre)\b)/i;

const META_SCAFFOLDING_LABEL_RE =
  /^(?:misi[oó]n(?:\s*\d+)?|sesi[oó]n(?:\s*\d+)?|bloque(?:\s*\d+)?|concepto\s+clave|resultado|soluci[oó]n|respuesta(?:\s+modelo)?|error\s+(?:com[uú]n|frecuente)|tu\s+meta|variables?\s+clave(?:\s+aqu[ií])?|su\s+funci[oó]n(?:\s+principal)?|verificaci[oó]n|diagn[oó]stico|procedimiento|evidencia|metacognici[oó]n|pasos?|problema|objetivo|actividad|introducci[oó]n|conclusi[oó]n|resumen|criterio|ejemplo|nota|pista|instrucci[oó]n|exploraci[oó]n\s+diagn[oó]stica|modelado\s+metodol[oó]gico|contraste\s+de\s+m[eé]todos|evaluaci[oó]n\s+y\s+cierre|fundamentaci[oó]n(?:\s+y\s+activaci[oó]n)?|interacci[oó]n\s+entre\s+ambos)$/i;

const CONJUGATED_VERB_INSIDE_RE =
  /\b(?:es|son|han|ha|fue|fueron|era|eran|est[aá]|est[aá]n|responde|responden|permite|permiten|ayuda|ayudan|sirve|sirven|tiene|tienen|hace|hacen|puede|pueden|debe|deben|busca|buscan|ofrece|ofrecen|genera|generan|gestiona|gestionan|controla|controlan|administra|administran|muestra|muestran|explica|explican|implica|implican|requiere|requieren|necesita|necesitan|consiste|consisten)\b/i;

function extractCleanNominalHead(raw: string): string {
  let candidate = (raw || '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/^(?:paso\s*\d+|fase\s*\d+|\d+[.)]|[-*•]|concepto\s+clave|misi[oó]n\s*\d+|sesi[oó]n\s*\d+)\s*:?\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!candidate || NARRATIVE_OR_SCAFFOLDING_PHRASE_RE.test(candidate) || PROSE_CLAUSE_START_RE.test(candidate)) {
    return '';
  }

  // Cortar antes de cláusulas subordinadas o verbos definitorios ("Un sistema operativo es..." -> "Sistema operativo")
  const splitBeforeClause = candidate.split(
    /\s+(?:que|donde|d[oó]nde|cuando|cu[aá]ndo|c[oó]mo|es|son|fue|fueron|era|eran|han|ha|se\s+define|consiste\s+en|permite|permiten|responde|responden|ayuda|ayudan|sirve|sirven|gestiona|gestionan|administra|administran|controla|controlan|tiene|tienen|hace|hacen|puede|pueden|debe|deben|para\s+[a-záéíóúüñ]+r)\b/i,
  )[0]?.trim() || '';

  candidate = splitBeforeClause
    // Quitar artículo indefinido/definido suelto al inicio si fue sujeto de una definición
    .replace(/^(?:un|una|unos|unas|el|la|los|las)\s+(?=[a-záéíóúüñ]{3,})/i, '')
    .trim();

  if (!candidate || PROSE_CLAUSE_START_RE.test(candidate) || NARRATIVE_OR_SCAFFOLDING_PHRASE_RE.test(candidate)) {
    return '';
  }

  // Rechazar cualquier fragmento que aún conserve verbos conjugados o infinitivos narrativos
  if (CONJUGATED_VERB_INSIDE_RE.test(candidate)) {
    return '';
  }

  return candidate;
}

/**
 * Extrae frases nominales conceptuales reales y completas del tema/contexto de la misión (0 tokens IA),
 * rechazando cláusulas narrativas, verbos sueltos o cortes colgantes ("que", "cómo", "es", "esta", "al").
 */
export function extractMissionTopicPhrases(topic: string, contextText: string, maxCount = 6): string[] {
  const cleanTopic = cleanTopicForDiagram(topic, 96);
  const phrases: string[] = [];
  const seen = new Set<string>();

  const pushPhrase = (raw: string, maxLen: number) => {
    const rawTrim = (raw || '').trim();
    if (!rawTrim || NARRATIVE_OR_SCAFFOLDING_PHRASE_RE.test(rawTrim) || PROSE_CLAUSE_START_RE.test(rawTrim)) {
      return;
    }
    const nominal = extractCleanNominalHead(rawTrim);
    if (!nominal) return;
    let trimmed = cleanTopicForDiagram(nominal, maxLen);
    if (
      !trimmed ||
      NARRATIVE_OR_SCAFFOLDING_PHRASE_RE.test(trimmed) ||
      PROSE_CLAUSE_START_RE.test(trimmed) ||
      META_SCAFFOLDING_LABEL_RE.test(trimmed)
    ) {
      return;
    }
    if (hasDanglingSpanishEnding(trimmed) || CONJUGATED_VERB_INSIDE_RE.test(trimmed)) {
      return;
    }
    const meaningfulWords = trimmed
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !DIGITAL_PHRASE_STOPWORDS.has(normalizeUnicode(w.replace(/[^a-zA-Z0-9áéíóúüñÁÉÍÓÚÜÑ]/g, ''))));
    if (meaningfulWords.length < 1) return;

    // Capitalizar de forma limpia preservando acrónimos (RAM, CPU, GNU/Linux)
    trimmed = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    const norm = normalizeUnicode(trimmed);
    const stemNorm = norm.replace(/s\b/g, '');
    if (trimmed.length < 4 || seen.has(norm) || seen.has(stemNorm) || norm === 'tema de la mision') return;
    if (/^(?:s\b|es\b|y\b|o\b|que\b|al\b|en\b|de\b|del\b|con\b|por\b|para\b)/i.test(trimmed)) return;
    seen.add(norm);
    seen.add(stemNorm);
    phrases.push(trimmed);
  };

  // 1. Subcláusulas significativas del título de la misión
  for (const part of cleanTopic.split(/[,:;/—–-]+|\s+y\s+/i)) {
    const cleaned = part.trim();
    const meaningfulWords = cleaned
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !DIGITAL_PHRASE_STOPWORDS.has(normalizeUnicode(w)));
    if (meaningfulWords.length >= 1 && cleaned.length >= 5) {
      pushPhrase(cleaned, 24);
    }
    if (phrases.length >= maxCount) return phrases;
  }

  // 2. Términos explícitos en negritas Markdown (**Término**) dentro del contexto
  if (contextText) {
    for (const m of contextText.matchAll(/\*\*([^*]{4,36})\*\*/g)) {
      pushPhrase(m[1], 24);
      if (phrases.length >= maxCount) return phrases;
    }
  }

  // 3. Términos explícitos con encabezado "Término: definición" o definiciones nominales limpias
  const rawPieces = `${cleanTopic}\n${contextText || ''}`
    .split(/[\n.!?;•]+/)
    .map((s) =>
      s
        .replace(/^(?:paso\s*\d+|fase\s*\d+|\d+[.)]|[-*•]|concepto\s+clave|misi[oó]n\s*\d+|sesi[oó]n\s*\d+)\s*:?\s*/i, '')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter((s) => s.length >= 10 && !NARRATIVE_OR_SCAFFOLDING_PHRASE_RE.test(s));

  for (const piece of rawPieces) {
    const colonIdx = piece.indexOf(':');
    if (colonIdx >= 4 && colonIdx <= 34) {
      pushPhrase(piece.slice(0, colonIdx), 24);
    } else {
      // Extraer únicamente si la oración comienza con un sintagma nominal definitorio limpio ("X es...", "X permite...")
      const defMatch = piece.match(
        /^(?:(?:un|una|el|la|los|las)\s+)?([A-ZÁÉÍÓÚÜÑa-záéíóúüñ0-9/+\s]{4,32}?)\s+(?:es|son|se\s+define\s+como|consiste\s+en|permite|permiten|gestiona|gestionan|administra|administran|controla|controlan)\b/i,
      );
      if (defMatch?.[1]) {
        pushPhrase(defMatch[1], 24);
      }
    }
    if (phrases.length >= maxCount) break;
  }

  return phrases;
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
  const cleanTopic = cleanTopicForDiagram(topic, 40);

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
      title: `Montea Triplanar: ${cleanTopic}`,
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
      title: `Perspectiva Isométrica: ${cleanTopic}`,
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
      title: `Acotación Normalizada: ${cleanTopic}`,
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
      title: `Trazado Geométrico: ${cleanTopic}`,
    });
  }

  // Rotación pedagógica determinística por índice de misión
  const mod = ((missionIndex - 1) % 4) + 1;
  if (mod === 1) {
    return generateMonteaTriplanar({
      title: `Montea Triplanar y Proyecciones: ${cleanTopicForDiagram(topic, 34)}`,
    });
  }
  if (mod === 2) {
    return generateIsometricPrism({
      title: `Perspectiva Isométrica Normalizada: ${cleanTopicForDiagram(topic, 32)}`,
    });
  }
  if (mod === 3) {
    return generateTechnicalDimensioning({
      title: `Sistema de Acotación Técnica: ${cleanTopicForDiagram(topic, 34)}`,
    });
  }
  return generateGeometricConstructions({
    title: `Construcciones Geométricas Básicas: ${cleanTopicForDiagram(topic, 32)}`,
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

  // Combinar título + contexto para máxima cobertura de keywords
  const searchText = normalizeUnicode(`${topic} ${contextText || ''}`);

  // ── 0B. DISPATCHER ESPECIALIZADO: CULTURA DIGITAL, ALGORITMOS Y TI ──────
  // Intercepta antes de STEM para garantizar diagramas computacionales/conceptuales
  // variados y específicos por misión (sin sobreusar Arquitectura Digital ni texto genérico de taller).
  if (isDigitalCultureSubject(uacName)) {
    const cleanTopic = cleanTopicForDiagram(topic, 42);
    const rawContext = `${cleanTopic}\n${contextText || ''}`;
    const primaryFocusText = normalizeUnicode(`${cleanTopic} ${(contextText || '').slice(0, 220)}`);
    const missionPhrases = extractMissionTopicPhrases(cleanTopic, contextText || '', 6);
    const topicShort = cleanTopicForDiagram(cleanTopic, 34);

    const buildDigitalConceptMap = () => {
      const extracted = extractTermDefs(rawContext, cleanTopic);
      const hasExtracted = extracted.nodes.length >= 3;
      const rootLabel = cleanTopicForDiagram(cleanTopic, 32);
      const normRoot = normalizeUnicode(rootLabel);
      const childPhrases = missionPhrases.filter((p) => {
        const np = normalizeUnicode(p);
        return np !== normRoot && !normRoot.includes(np) && !np.includes(normRoot);
      });
      const hasGroundedPhrases = childPhrases.length >= 2;

      const nodes = hasExtracted
        ? extracted.nodes
        : hasGroundedPhrases
          ? [
              { label: rootLabel, level: 0 as const },
              { label: childPhrases[0]!, level: 1 as const },
              { label: childPhrases[1]!, level: 1 as const },
              { label: childPhrases[2] || 'Criterios y Evidencia', level: 2 as const },
              { label: childPhrases[3] || 'Aplicación Ética', level: 2 as const },
            ]
          : [
              { label: rootLabel, level: 0 as const },
              { label: 'Ciudadanía Digital', level: 1 as const },
              { label: 'Soberanía Tecnológica', level: 1 as const },
              { label: 'Privacidad y Ética', level: 2 as const },
              { label: 'Colaboración Abierta', level: 2 as const },
            ];
      const edges = hasExtracted
        ? extracted.edges
        : [
            { from: 0, to: 1, label: 'articula' },
            { from: 0, to: 2, label: 'desarrolla' },
            { from: 1, to: 3, label: 'verifica' },
            { from: 2, to: 4, label: 'aplica' },
          ];
      const res = generateConceptMap(nodes, edges, {
        title: `Mapa Conceptual: ${topicShort} (${scopeLabel})`,
      });
      res.metadata = {
        type: 'digital_concept_map',
        realItemCount: hasExtracted
          ? extracted.nodes.length - 1
          : hasGroundedPhrases
            ? Math.min(4, missionPhrases.length)
            : 0,
        isFallback: !hasExtracted && !hasGroundedPhrases,
      };
      return res;
    };

    const buildDigitalBlockDiagram = () => {
      const extractedBlocks = extractSystemBlocks(rawContext);
      const hasGrounded = extractedBlocks.length >= 3 || missionPhrases.length >= 2;
      const blocks =
        extractedBlocks.length >= 3
          ? extractedBlocks
          : [
              {
                title: missionPhrases[0] || 'Entrada Digital',
                subtitle: 'Captura de datos y requerimientos',
                role: 'input' as const,
              },
              {
                title: missionPhrases[1] || 'Núcleo de Proceso',
                subtitle: cleanTopicForDiagram(cleanTopic, 30),
                role: 'process' as const,
              },
              {
                title: missionPhrases[2] || 'Control y Seguridad',
                subtitle: 'Permisos, privacidad y respaldo',
                role: 'control' as const,
              },
              {
                title: missionPhrases[3] || 'Salida Digital',
                subtitle: 'Producto verificable y accesible',
                role: 'output' as const,
              },
            ];
      const res = generateBlockDiagram(blocks, {
        title: `Arquitectura Digital: ${topicShort} (${scopeLabel})`,
        busLabels: ['Datos / Entrada', 'Salida / Producto', 'Validación, Ética y Control de Calidad'],
        footerTitle: `ENFOQUE FUNCIONAL · ${scopeLabel.toUpperCase()}`,
        footerText: `Articulación por capas digitales aplicada a ${topicShort} con verificación técnica y ética.`,
      });
      res.metadata = {
        type: 'digital_block_diagram',
        realItemCount: extractedBlocks.length >= 3 ? extractedBlocks.length : Math.min(4, missionPhrases.length),
        isFallback: !hasGrounded,
      };
      return res;
    };

    const buildDigitalTechnicalFlow = () => {
      const { technicalSteps } = extractEnumSteps(rawContext);
      const hasGrounded = technicalSteps.length >= 2 || missionPhrases.length >= 2;
      const steps =
        technicalSteps.length >= 2
          ? technicalSteps
          : [
              {
                step: '1. Diagnóstico',
                instruction: missionPhrases[0]
                  ? `Identificar requerimientos de ${missionPhrases[0]}`
                  : `Delimitar alcance de ${cleanTopicForDiagram(cleanTopic, 22)}`,
                qualityCheck: 'Datos de entrada claros',
              },
              {
                step: '2. Modelado',
                instruction: missionPhrases[1]
                  ? `Estructurar reglas sobre ${missionPhrases[1]}`
                  : 'Estructurar secuencia lógica y reglas',
                qualityCheck: 'Prueba de escritorio OK',
              },
              {
                step: '3. Ejecución',
                instruction: missionPhrases[2]
                  ? `Aplicar criterios de ${missionPhrases[2]}`
                  : 'Implementar solución digital documentada',
                qualityCheck: 'Sin errores de lógica',
              },
              {
                step: '4. Validación',
                instruction: missionPhrases[3]
                  ? `Verificar evidencia en ${missionPhrases[3]}`
                  : 'Comprobar usabilidad y ética digital',
                qualityCheck: 'Evidencia validada',
              },
            ];
      const res = generateTechnicalFlow(steps, {
        title: `Flujo Algorítmico: ${topicShort} (${scopeLabel})`,
        footerText: `Ruta metodológica de ${topicShort}: Diagnóstico -> Diseño -> Ejecución -> Validación Ética.`,
      });
      res.metadata = {
        type: 'digital_technical_flow',
        realItemCount: technicalSteps.length >= 2 ? technicalSteps.length : Math.min(4, missionPhrases.length),
        isFallback: !hasGrounded,
      };
      return res;
    };

    const isConceptCue = (txt: string) =>
      /\b(?:ciudadania\s+digital|identidad\s+digital|huella\s+(?:digital|en\s+redes)|redes?\s+sociales?|privacidad|proteccion\s+de\s+datos|derechos?\s+de\s+autor|creative\s+commons|licencias?|software\s+libre|gnu\/linux|brecha\s+digital|desigualdad\s+digital|colonialismo\s+de\s+datos|etica\s+digital|netiqueta|ciberacoso|propiedad\s+intelectual|historia\s+critica|soberania\s+tecnologica)\b/.test(
        txt
      );
    const isFlowCue = (txt: string) =>
      /\b(?:algoritmo(?:s)?|pseudocodigo|diagrama(?:s)?\s+de\s+flujo|programacion|codigo|variable(?:s)?|operador(?:es)?\s+logico(?:s)?|bucle|condicional|hoja(?:s)?\s+de\s+calculo|formula(?:s)?|representacion\s+grafica|tabular|automatizacion|socializacion|defensa\s+de\s+soluciones|proyecto\s+integrador)\b/.test(
        txt
      );
    const isArchCue = (txt: string) =>
      /\b(?:hardware|arquitectura\s+(?:de\s+computo|digital|del\s+equipo)|sistema(?:s)?\s+operativo(?:s)?|red(?:es)?\s+(?:de\s+computo|informatica|local|lan|wan)|protocolo(?:s)?\s+de\s+red|servidor(?:es)?|base(?:s)?\s+de\s+datos|ciberseguridad|periferico(?:s)?|cpu|memoria\s+ram|almacenamiento|disco\s+(?:duro|ssd))\b/.test(
        txt
      );

    // Evaluar primero señales explícitas del tema/objetivo principal (evita que menciones sueltas
    // de "sistema" o "dispositivo" en párrafos secundarios acaparen 8/12 diagramas).
    if (isConceptCue(primaryFocusText) && !isArchCue(primaryFocusText) && !isFlowCue(primaryFocusText)) {
      return buildDigitalConceptMap();
    }
    if (isFlowCue(primaryFocusText) && !isArchCue(primaryFocusText)) {
      return buildDigitalTechnicalFlow();
    }
    if (isArchCue(primaryFocusText)) {
      return buildDigitalBlockDiagram();
    }

    // Rotación equilibrada entre los 3 tipos cuando el título principal combina varios ejes
    const hasFlow = isFlowCue(searchText);
    const hasConcept = isConceptCue(searchText);
    const hasArch = isArchCue(searchText);
    const mod = ((Math.max(1, missionNumber) - 1) % 3);

    if (mod === 0 && hasConcept) return buildDigitalConceptMap();
    if (mod === 1 && hasFlow) return buildDigitalTechnicalFlow();
    if (mod === 2 && hasArch) return buildDigitalBlockDiagram();

    if (hasFlow && !hasConcept) return buildDigitalTechnicalFlow();
    if (hasConcept && !hasArch) return buildDigitalConceptMap();
    if (hasArch && mod !== 1) return buildDigitalBlockDiagram();

    if (mod === 0) return buildDigitalConceptMap();
    if (mod === 1) return buildDigitalTechnicalFlow();
    return buildDigitalBlockDiagram();
  }

  const isStem = isStemSubject(uacName);
  const isHumanities = isHumanitiesSubject(uacName);
  const isLaboral = isLaboralSubject(uacName);

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
        subtitle: 'Tabulación y representación gráfica con los datos del problema',
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
        subtitle: 'Tabulación e intersección de L₁ y L₂ según el problema',
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
      const isRightTriangleContext = /\b(?:triangulos?\s+rectangulos?|pitagoras|catetos?|hipotenusa)\b/.test(
        searchText
      );
      if (
        !isRightTriangleContext &&
        (classification.subtopic === 'perimeter-area' ||
          /\b(?:rectangulo(?:s)?|cuadrilatero(?:s)?|perimetro\s+y\s+area|area\s+del\s+(?:rectangulo|terreno))\b/.test(
            searchText
          ))
      ) {
        const rectParams = tryExtractRectangleParameters(rawContext);
        return generateRectangle(rectParams?.largo ?? null, rectParams?.ancho ?? null, {
          title: `Geometría Aplicada: Perímetro y Área (${scopeLabel})`,
        });
      }

      const isNapoleonOrCongruence =
        classification.subtopic === 'congruence-similarity' ||
        /\b(?:napole[oó]n|congruencia|equil[aá]teros?\s+externos|baricentros?)\b/.test(searchText);
      if (isNapoleonOrCongruence && !/\b(?:pitagoras|hipotenusa)\b/.test(searchText)) {
        return generateNapoleonTriangleVisual({
          isNapoleon: /napole[oó]n|equil[aá]teros?\s+externos|baricentros?/i.test(searchText),
          title: /napole[oó]n/i.test(searchText)
            ? `Geometría Plana: Teorema de Napoleón (${scopeLabel})`
            : `Geometría Plana: Congruencia y Semejanza de Triángulos (${scopeLabel})`,
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
        subtitle: 'Espacio de tabulación gráfica con los valores del ejercicio',
        isFallback: true,
      });
    }

    // 6. Por defecto en STEM: Plano Cartesiano limpio (nunca inventa funciones ni dimensiones)
    return generateCartesianPlane({
      title: `Plano Cartesiano para Tabulación y Bosquejo de Datos (${scopeLabel})`,
      subtitle: 'Tabulación con los datos de la actividad',
      isFallback: true,
    });
  }

  // ── B. DISPATCHER ÁREA HUMANIDADES Y CIENCIAS SOCIALES ─────────────────────
  if (isHumanities) {
    const cleanTopic = cleanTopicForDiagram(topic, 42);
    const rawContext = `${cleanTopic}\n${contextText || ''}`;

    // 1. Diagramas de Flujo Histórico Causal (procesos históricos, revoluciones, movimientos sociales)
    if (
      searchText.includes('proceso historico') ||
      searchText.includes('revolucion') ||
      searchText.includes('movimiento social')
    ) {
      const { historicalSteps } = extractEnumSteps(rawContext);
      if (historicalSteps.length > 0) {
        const res = generateHistoricalFlow(historicalSteps, {
          title: `Flujo Causal: ${cleanTopic}`,
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
          title: `Línea de Tiempo: ${cleanTopic}`,
        });
        res.metadata = {
          type: 'timeline',
          realItemCount: years.length,
          isFallback: false,
        };
        return res;
      }

      const res = generateHistoricalFlow([], {
        title: `Flujo Causal: ${cleanTopic}`,
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
        title: `Indicadores Sociales: ${cleanTopic}`,
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
        title: `Línea de Tiempo: ${cleanTopic}`,
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
      const { nodes, edges } = extractTermDefs(rawContext, cleanTopic);
      const res = generateConceptMap(nodes, edges, {
        title: `Mapa Conceptual: ${cleanTopic}`,
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
        title: `Línea de Tiempo Histórica: ${cleanTopic}`,
      });
      res.metadata = {
        type: 'timeline',
        realItemCount: events.length,
        isFallback: events.length === 0,
      };
      return res;
    }

    const { nodes, edges } = extractTermDefs(rawContext, cleanTopic);
    const res = generateConceptMap(nodes, edges, {
      title: `Estructura Conceptual Formativa: ${cleanTopic}`,
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
    const cleanTopic = cleanTopicForDiagram(topic, 42);
    const rawContext = `${cleanTopic}\n${contextText || ''}`;

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
        title: `Seguridad y EPP: ${cleanTopic}`,
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
        title: `Cronograma Técnico: ${cleanTopic}`,
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
        title: `Arquitectura Modular: ${cleanTopic}`,
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
      title: `Procedimiento Técnico: ${cleanTopic}`,
    });
    res.metadata = {
      type: 'technical_flow',
      realItemCount: technicalSteps.length,
      isFallback: technicalSteps.length === 0,
    };
    return res;
  }

  // ── D. FALLBACK DETERMINÍSTICO UNIVERSAL ──────────────────────────────────
  const cleanTopic = cleanTopicForDiagram(topic, 42);
  const rawContext = `${cleanTopic}\n${contextText || ''}`;
  const { nodes, edges } = extractTermDefs(rawContext, cleanTopic);
  const res = generateConceptMap(nodes, edges, {
    title: `Estructura Conceptual Formativa: ${cleanTopic}`,
  });
  res.metadata = {
    type: 'concept_map',
    realItemCount: nodes.length > 0 ? nodes.length - 1 : 0,
    isFallback: true,
  };
  return res;
}
