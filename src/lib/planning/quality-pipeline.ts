/**
 * quality-pipeline.ts
 * Pipeline determinista de evaluación de calidad para Planeaciones Didácticas (SIGPDA-EMS)
 * 
 * Implementa 4 validadores pedagógicos y normativos DBEPA / MCCEMS 2026-2027:
 * 1. validateRetoSituado44: Valida 4/4 criterios del Reto Situado (verbo infinitivo, contexto local Puebla, problema real, alineación curricular)
 * 2. validateTresSaberes: Valida cobertura de la taxonomía (Saber Teórico, Saber Hacer Práctico, Saber Ser Actitudinal)
 * 3. validateCoherenciaMetodologica: Valida coherencia con la metodología activa (ABP, STEAM, ABR, etc.) y detecta pasividad
 * 4. validateHorasPorCorte: Valida distribución semestral en 3 cortes de evaluación según el mapa curricular (semanal × 6)
 * 
 * evaluatePlanningQuality: Orquesta los 4 validadores y genera puntaje, estatus y feedback consolidado.
 */

import {
  validateRetoSituado,
  type RetoContextoInput
} from '@/lib/planning-evaluator';
import { CATALOGO_METODOLOGIAS_ACTIVAS } from '@/lib/catalogo-metodologias';
import type {
  Planning,
  RetoSituado,
  RetoSituadoValidation,
  SecuenciaBloque,
  KeyActivityPlan,
  EvaluationRow
} from '@/types/planning';

// ---------------------------------------------------------------------------
// 0. Normalizador Matemático Determinista de Evaluación (Garantía 100%)
// ---------------------------------------------------------------------------

/**
 * Normaliza deterministamente las ponderaciones de las evaluaciones
 * para asegurar que sumen exactamente 100%.
 * 
 * Reglas:
 * 1. Si está vacío o nulo, devuelve la escala oficial DBEPA (Diagnóstica 5%, Formativa 55%, Sumativa 40%).
 * 2. Si la suma es 100% y Diagnóstica <= 10%, no altera nada.
 * 3. Si hay exceso (> 100%), reduce primero Diagnóstica a un máximo de 5% (norma NEM).
 *    Si persiste el exceso, reduce proporcionalmente de Formativa y Sumativa.
 * 4. Si hay déficit (< 100%), distribuye proporcionalmente entre Formativa y Sumativa.
 * 5. Reconcilia cualquier diferencia por redondeo (+/- 1%) sobre el elemento de mayor peso.
 * 6. Garantiza valores enteros >= 0, suma idéntica a 100%, y previene NaN.
 */
export function normalizeEvaluationPercentages<T extends { percentage: number; type?: string }>(
  evaluations?: T[] | null
): T[] {
  if (!evaluations || !Array.isArray(evaluations) || evaluations.length === 0) {
    return [
      { type: 'Diagnóstica', percentage: 5, moment: 'Inicio de UAC', instrument: 'Cuestionario diagnóstico' },
      { type: 'Formativa', percentage: 55, moment: 'Durante el proceso', instrument: 'Rúbrica de proceso / Bitácora' },
      { type: 'Sumativa', percentage: 40, moment: 'Cierre de corte', instrument: 'Rúbrica de producto integrador' }
    ] as unknown as T[];
  }

  // Clonar para no mutar entradas
  const cloned: T[] = evaluations.map(e => ({
    ...e,
    percentage: Math.max(0, Math.round(Number(e.percentage) || 0))
  }));

  const initialSum = cloned.reduce((acc, curr) => acc + curr.percentage, 0);

  // Si ya suma 100 y no tiene diagnóstica desmedida (>10%), retornar
  const diagItem = cloned.find(e => {
    const t = (e.type || '').toLowerCase();
    return t.includes('diagnóstic') || t.includes('diagnostic');
  });

  if (initialSum === 100 && (!diagItem || diagItem.percentage <= 10)) {
    return cloned;
  }

  if (initialSum > 100) {
    let excess = initialSum - 100;

    // Regla NEM: Si la diagnóstica está sobreponderada (> 5%), reducirla primero
    if (diagItem && diagItem.percentage > 5) {
      const diagReduction = Math.min(diagItem.percentage - 5, excess);
      diagItem.percentage -= diagReduction;
      excess -= diagReduction;
    }

    // Reducir el exceso restante proporcionalmente de las no-diagnósticas
    if (excess > 0) {
      const nonDiag = cloned.filter(e => e !== diagItem);
      const nonDiagSum = nonDiag.reduce((acc, curr) => acc + curr.percentage, 0);

      for (const item of nonDiag) {
        const factor = nonDiagSum > 0 ? (item.percentage / nonDiagSum) : (1 / nonDiag.length);
        const reduction = Math.min(item.percentage, Math.round(excess * factor));
        item.percentage -= reduction;
      }
    }
  } else if (initialSum < 100) {
    const deficit = 100 - initialSum;
    const nonDiag = cloned.filter(e => e !== diagItem);
    const targetPool = nonDiag.length > 0 ? nonDiag : cloned;
    const poolSum = targetPool.reduce((acc, curr) => acc + curr.percentage, 0);

    for (const item of targetPool) {
      const factor = poolSum > 0 ? (item.percentage / poolSum) : (1 / targetPool.length);
      item.percentage += Math.round(deficit * factor);
    }
  }

  // Reconciliar cualquier residuo por redondeo (+/- 1% o +/- 2%)
  const currentSum = cloned.reduce((acc, curr) => acc + curr.percentage, 0);
  const delta = 100 - currentSum;
  if (delta !== 0) {
    const candidates = cloned.filter(e => e !== diagItem);
    const pool = candidates.length > 0 ? candidates : cloned;
    let largest = pool[0];
    for (const item of pool) {
      if (item.percentage > largest.percentage) {
        largest = item;
      }
    }
    if (largest) {
      largest.percentage = Math.max(0, largest.percentage + delta);
    }
  }

  return cloned;
}

// ---------------------------------------------------------------------------
// 0.1 Sanitizador Lingüístico y Normalizador CCT Determinista
// ---------------------------------------------------------------------------

/**
 * Sanitizador Lingüístico Determinista:
 * 1. Erradica anglicismos comunes generados por el LLM ("Habits" -> "Hábitos").
 * 2. Corrige el título del proyecto PAEC ("Cuantificando Mis Habits" -> "Cuantificando Mis Hábitos").
 * 3. Normaliza CCTs genéricos/placeholder ("21EBH0000X" -> CCT del plantel o "21EBH0200X").
 */
export function sanitizeLinguistic(text: string, options?: { fallbackCct?: string }): string {
  if (!text || typeof text !== 'string') return text;
  const targetCct = options?.fallbackCct || '21EBH0200X';
  return text
    .replace(/\bCuantificando\s+Mis\s+Habits\b/gi, 'Cuantificando Mis Hábitos')
    .replace(/\bHabits\b/g, 'Hábitos')
    .replace(/\bhabits\b/g, 'hábitos')
    .replace(/\bHabit\b/g, 'Hábito')
    .replace(/\bhabit\b/g, 'hábito')
    .replace(/21EBH0000X/gi, targetCct);
}

/**
 * Sanitiza recursivamente strings dentro de un objeto de planeación.
 */
export function sanitizePlanningContent<T>(content: T, options?: { fallbackCct?: string }): T {
  if (!content) return content;
  if (typeof content === 'string') {
    return sanitizeLinguistic(content, options) as unknown as T;
  }
  if (Array.isArray(content)) {
    return content.map(item => sanitizePlanningContent(item, options)) as unknown as T;
  }
  if (typeof content === 'object') {
    const sanitizedObj: Record<string, any> = {};
    for (const [key, value] of Object.entries(content)) {
      sanitizedObj[key] = sanitizePlanningContent(value, options);
    }
    return sanitizedObj as T;
  }
  return content;
}

// ---------------------------------------------------------------------------
// 1. Reto Situado 4/4 Validator
// ---------------------------------------------------------------------------

export interface RetoSituado44Result {
  isValid: boolean;
  score: number; // 0 - 4
  details: RetoSituadoValidation;
  feedback: string[];
}

export function validateRetoSituado44(
  reto?: RetoSituado | string | null,
  context?: RetoContextoInput
): RetoSituado44Result {
  if (!reto) {
    const emptyValidation: RetoSituadoValidation = {
      hasInfinitiveVerb: false,
      hasLocalContext: false,
      hasRealProblem: false,
      hasCurricularAlignment: false,
      score: 0,
      feedback: ['No se ha definido un Reto Situado en la planeación.'],
      isApproved: false,
    };
    return {
      isValid: false,
      score: 0,
      details: emptyValidation,
      feedback: ['No se ha definido un Reto Situado en la planeación.'],
    };
  }

  const details = validateRetoSituado(reto, context);
  return {
    isValid: details.isApproved,
    score: details.score,
    details,
    feedback: details.feedback,
  };
}

// ---------------------------------------------------------------------------
// 2. Tres Saberes Validator (Saber, Saber Hacer, Saber Ser)
// ---------------------------------------------------------------------------

export interface TresSaberesResult {
  isValid: boolean;
  hasSaber: boolean;
  hasSaberHacer: boolean;
  hasSaberSer: boolean;
  coverageScore: number; // 0 - 3
  missing: ('Saber' | 'Saber Hacer' | 'Saber Ser')[];
  feedback: string[];
}

export function validateTresSaberes(
  sequenceJson?: Record<number, SecuenciaBloque> | null,
  rubricas?: EvaluationRow[] | Array<{ criterion?: string; description?: string; title?: string }> | null,
  activities?: KeyActivityPlan[] | null
): TresSaberesResult {
  let hasSaber = false;
  let hasSaberHacer = false;
  let hasSaberSer = false;

  // 1. Inspeccionar KeyActivityPlan (Sección IV de la planeación)
  if (activities && Array.isArray(activities) && activities.length > 0) {
    for (const act of activities) {
      if (act.saberes) {
        if (act.saberes.saber && act.saberes.saber.trim().length >= 5) hasSaber = true;
        if (act.saberes.saberHacer && act.saberes.saberHacer.trim().length >= 5) hasSaberHacer = true;
        if (act.saberes.saberSer && act.saberes.saberSer.trim().length >= 5) hasSaberSer = true;
      }
    }
  }

  // 2. Inspeccionar Secuencias Didácticas (Sesiones detalladas)
  if (sequenceJson && typeof sequenceJson === 'object') {
    const bloques = Object.values(sequenceJson);
    for (const bloque of bloques) {
      if (!bloque?.sessions) continue;
      for (const ses of bloque.sessions) {
        const text = `${ses.title || ''} ${ses.teachingActivity || ''} ${ses.learningActivity || ''} ${ses.evidence || ''} ${ses.evaluation || ''}`.toLowerCase();
        
        if (!hasSaber && (text.includes('saber teórico') || text.includes('saber conceptual') || text.includes('marco conceptual') || text.includes('normativa') || text.includes('fundamento teórico'))) {
          hasSaber = true;
        }
        if (!hasSaberHacer && (text.includes('saber hacer') || text.includes('saber práctico') || text.includes('procedimental') || text.includes('práctica en taller') || text.includes('práctica de laboratorio') || text.includes('levantamiento técnico') || text.includes('ejecución técnica'))) {
          hasSaberHacer = true;
        }
        if (!hasSaberSer && (text.includes('saber ser') || text.includes('actitudinal') || text.includes('seguridad industrial') || text.includes('ética') || text.includes('convivencia') || text.includes('responsabilidad colaborativa') || text.includes('trabajo en equipo'))) {
          hasSaberSer = true;
        }
      }
    }
  }

  // 3. Inspeccionar Rúbricas o Instrumentos de Evaluación
  if (rubricas && Array.isArray(rubricas) && rubricas.length > 0) {
    for (const rub of rubricas) {
      const text = JSON.stringify(rub).toLowerCase();
      if (!hasSaber && (text.includes('conocimiento') || text.includes('teoría') || text.includes('conceptual') || text.includes('saber'))) {
        hasSaber = true;
      }
      if (!hasSaberHacer && (text.includes('procedimiento') || text.includes('hacer') || text.includes('destreza') || text.includes('práctica') || text.includes('ejecución') || text.includes('desempeño'))) {
        hasSaberHacer = true;
      }
      if (!hasSaberSer && (text.includes('actitud') || text.includes('ser') || text.includes('ética') || text.includes('seguridad') || text.includes('colaboración') || text.includes('valores'))) {
        hasSaberSer = true;
      }
    }
  }

  const missing: ('Saber' | 'Saber Hacer' | 'Saber Ser')[] = [];
  if (!hasSaber) missing.push('Saber');
  if (!hasSaberHacer) missing.push('Saber Hacer');
  if (!hasSaberSer) missing.push('Saber Ser');

  const coverageScore = (hasSaber ? 1 : 0) + (hasSaberHacer ? 1 : 0) + (hasSaberSer ? 1 : 0);
  const isValid = coverageScore === 3;

  const feedback: string[] = [];
  if (!isValid) {
    feedback.push(`La planeación carece de la dimensión integral de los Tres Saberes. Dimensiones ausentes: ${missing.join(', ')}.`);
    if (!hasSaber) feedback.push('Integre el Saber Teórico/Conceptual (fundamentos, normativas y conceptos clave).');
    if (!hasSaberHacer) feedback.push('Integre el Saber Hacer Práctico/Procedimental (destrezas técnicas, cálculos o trabajo en taller/laboratorio).');
    if (!hasSaberSer) feedback.push('Integre el Saber Ser Actitudinal (seguridad en el taller, ética, trabajo colaborativo y valores comunitarios).');
  }

  return {
    isValid,
    hasSaber,
    hasSaberHacer,
    hasSaberSer,
    coverageScore,
    missing,
    feedback,
  };
}

// ---------------------------------------------------------------------------
// 3. Coherencia Metodológica Validator (ABP, STEAM, ABR, etc.)
// ---------------------------------------------------------------------------

export interface MetodologiaCoherenceResult {
  isValid: boolean;
  metodologiaId: string;
  metodologiaNombre: string;
  isRecognized: boolean;
  hasPassivePractices: boolean;
  matchedKeywords: string[];
  score: number; // 0 - 100
  feedback: string[];
}

const PALABRAS_PASIVAS_PROHIBIDAS = [
  'dictado',
  'copiar del libro',
  'copiar texto',
  'transcribir del libro',
  'transcripción pasiva',
  'clase magistral pasiva',
  'copiar en la libreta sin reflexionar',
  'memorización pasiva',
  'repetir de memoria'
];

const METODOLOGIA_KEYWORDS: Record<string, string[]> = {
  abp: ['proyecto', 'reto', 'problema', 'comunitario', 'indagación', 'prototipo', 'solución', 'fase', 'difusión', 'producto integrador'],
  steam: ['experimento', 'medición', 'prototipo', 'modelo matemático', 'indagación', 'datos', 'laboratorio', 'estadística', 'diseño técnico', 'física'],
  abr: ['reto', 'desafío', 'solución técnica', 'prueba piloto', 'validación', 'entorno real', 'aplicación'],
  estudio_casos: ['caso', 'dilema', 'evidencias', 'dictamen', 'debate', 'argumentación', 'decisión'],
  aula_invertida: ['exploración previa', 'asíncrono', 'taller activo', 'discusión', 'resolución de dudas', 'consolidación'],
  aprendizaje_servicio: ['servicio', 'comunidad', 'impacto social', 'beneficio', 'solidario', 'necesidad comunitaria'],
  gamificacion: ['misión', 'reto', 'nivel', 'insignia', 'estación', 'desafío', 'puntos'],
  practica_laboratorio: ['protocolo', 'seguridad', 'taller', 'herramienta', 'troubleshooting', 'reporte de práctica', 'medición'],
  abproblemas: ['problema detonante', 'indagación', 'deliberación', 'propuesta de solución', 'necesidades de aprendizaje'],
  indagacion: ['pregunta investigable', 'hipótesis', 'recolección de datos', 'variables', 'conclusiones científicas'],
};

export function validateCoherenciaMetodologica(
  metodologia?: string | null,
  sequenceJson?: Record<number, SecuenciaBloque> | null,
  activities?: KeyActivityPlan[] | null
): MetodologiaCoherenceResult {
  const feedback: string[] = [];
  const cleanId = (metodologia || '').trim().toLowerCase();

  if (!cleanId) {
    feedback.push('No se ha especificado una metodología activa para la planeación didáctica.');
    return {
      isValid: false,
      metodologiaId: '',
      metodologiaNombre: 'No asignada',
      isRecognized: false,
      hasPassivePractices: false,
      matchedKeywords: [],
      score: 0,
      feedback,
    };
  }

  // Buscar coincidencia en el catálogo oficial
  const catalogoMatch = CATALOGO_METODOLOGIAS_ACTIVAS.find(
    (m) => m.id.toLowerCase() === cleanId || m.nombre.toLowerCase().includes(cleanId) || cleanId.includes(m.id.toLowerCase())
  );

  const matchedId = catalogoMatch ? catalogoMatch.id : cleanId;
  const matchedNombre = catalogoMatch ? catalogoMatch.nombre : metodologia || 'Metodología Personalizada';
  const isRecognized = Boolean(catalogoMatch || METODOLOGIA_KEYWORDS[matchedId]);

  if (!isRecognized) {
    feedback.push(`La metodología "${metodologia}" no figura en el Catálogo Oficial de Metodologías Activas MCCEMS.`);
  }

  // Consolidar corpus de texto de secuencias y actividades
  const textCorpusParts: string[] = [];
  if (sequenceJson && typeof sequenceJson === 'object') {
    for (const bloque of Object.values(sequenceJson)) {
      if (!bloque?.sessions) continue;
      for (const s of bloque.sessions) {
        textCorpusParts.push(s.title || '', s.teachingActivity || '', s.learningActivity || '', s.evidence || '');
      }
    }
  }
  if (activities && Array.isArray(activities)) {
    for (const a of activities) {
      textCorpusParts.push(
        a.name || '',
        a.methodology || '',
        a.apertura?.activities || '',
        a.ejecucion?.activities || '',
        a.conclusion?.activities || ''
      );
    }
  }

  const corpus = textCorpusParts.join(' ').toLowerCase();

  // Detectar prácticas pasivas prohibidas
  const foundPassive = PALABRAS_PASIVAS_PROHIBIDAS.filter((p) => corpus.includes(p));
  const hasPassivePractices = foundPassive.length > 0;
  if (hasPassivePractices) {
    feedback.push(`Se detectaron prácticas pasivas o memorísticas incompatibles con el MCCEMS: ${foundPassive.join(', ')}.`);
  }

  // Buscar palabras clave de la metodología declarada
  const expectedKeywords = METODOLOGIA_KEYWORDS[matchedId] || ['activo', 'práctico', 'estudiante', 'colaborativo'];
  const matchedKeywords = expectedKeywords.filter((kw) => corpus.includes(kw));

  let score = 50; // Base por declarar metodología
  if (isRecognized) score += 20;
  if (matchedKeywords.length >= 3) score += 20;
  else if (matchedKeywords.length >= 1) score += 10;
  if (hasPassivePractices) score -= 30;
  if (corpus.length < 50) score -= 20; // Corpus muy pobre o vacío

  score = Math.max(0, Math.min(100, score));
  const isValid = isRecognized && !hasPassivePractices && score >= 70;

  if (!isValid && matchedKeywords.length < 2) {
    feedback.push(`Las actividades de la secuencia no reflejan las fases operativas de la metodología ${matchedNombre}. Se recomienda incorporar dinámicas características como ${expectedKeywords.slice(0, 3).join(', ')}.`);
  }

  return {
    isValid,
    metodologiaId: matchedId,
    metodologiaNombre: matchedNombre,
    isRecognized,
    hasPassivePractices,
    matchedKeywords,
    score,
    feedback,
  };
}

// ---------------------------------------------------------------------------
// 4. Horas por Corte Validator (Curricular Map Consistency)
// ---------------------------------------------------------------------------

export interface HorasCorteResult {
  isValid: boolean;
  uacName: string;
  expectedWeeklyHours: number;
  expectedTotalHours: number;
  expectedHoursPerCorte: number;
  plannedHours: number;
  hoursPerCorte: number[];
  discrepancy: number; // plannedHours - expectedTotalHours
  isBalanced: boolean; // ¿Cada corte tiene la cuota esperada?
  feedback: string[];
}

export interface HorasCorteOptions {
  horasPorCorte?: number[];
  weeklyLoadOverride?: number;
}

import { DEFAULT_UAC_WEEKLY_HOURS, normalizeUacKey } from './uac-hours-catalog';
export { DEFAULT_UAC_WEEKLY_HOURS };

export function getExpectedWeeklyHours(uacName: string, fallbackTotal = 54): number {
  const norm = normalizeUacKey(uacName);
  for (const [key, load] of Object.entries(DEFAULT_UAC_WEEKLY_HOURS)) {
    if (norm.includes(key)) return load;
  }
  return Math.max(1, Math.round(fallbackTotal / 18));
}

export function validateHorasPorCorte(
  uacName: string,
  totalHorasPlaneadas: number,
  options?: HorasCorteOptions
): HorasCorteResult {
  const feedback: string[] = [];
  const expectedWeeklyHours = options?.weeklyLoadOverride && options.weeklyLoadOverride > 0
    ? options.weeklyLoadOverride
    : getExpectedWeeklyHours(uacName, totalHorasPlaneadas);

  const expectedTotalHours = expectedWeeklyHours * 18;
  const expectedHoursPerCorte = expectedWeeklyHours * 6;
  const plannedHours = totalHorasPlaneadas || 0;
  const discrepancy = plannedHours - expectedTotalHours;

  let hoursPerCorte = options?.horasPorCorte || [];
  if (hoursPerCorte.length === 0 && plannedHours > 0) {
    // Si no se pasaron cortes explícitos, dosificar en 3 partes
    const c1 = Math.round(plannedHours / 3);
    const c2 = Math.round(plannedHours / 3);
    const c3 = plannedHours - c1 - c2;
    hoursPerCorte = [c1, c2, c3];
  }

  const hasThreeCortes = hoursPerCorte.length === 3;
  const sumCortes = hoursPerCorte.reduce((a, b) => a + b, 0);
  const corteSumMatchesPlanned = sumCortes === plannedHours;

  // Evaluar balance entre cortes (cada corte debe tener expectedHoursPerCorte)
  const isBalanced = hasThreeCortes && hoursPerCorte.every((h) => h === expectedHoursPerCorte);

  if (discrepancy !== 0) {
    feedback.push(`Discrepancia horaria: La UAC "${uacName}" requiere ${expectedTotalHours} horas semestrales (${expectedWeeklyHours} h/semana), pero se planearon ${plannedHours} horas.`);
  }

  if (!hasThreeCortes) {
    feedback.push(`La dosificación debe organizarse en exactamente 3 Cortes de Evaluación Semestral (actualmente hay ${hoursPerCorte.length}).`);
  } else if (!isBalanced) {
    feedback.push(`Desbalance en cortes: Cada corte debe sumar exactamente ${expectedHoursPerCorte} horas (${expectedWeeklyHours} h/sem × 6 semanas). Distribución actual: [${hoursPerCorte.join(', ')}].`);
  }

  if (!corteSumMatchesPlanned && plannedHours > 0) {
    feedback.push(`La suma de horas de los cortes (${sumCortes}h) no coincide con el total declarado (${plannedHours}h).`);
  }

  const isValid = discrepancy === 0 && isBalanced && corteSumMatchesPlanned;

  return {
    isValid,
    uacName,
    expectedWeeklyHours,
    expectedTotalHours,
    expectedHoursPerCorte,
    plannedHours,
    hoursPerCorte,
    discrepancy,
    isBalanced,
    feedback,
  };
}

// ---------------------------------------------------------------------------
// 5. Evaluate Planning Quality (Pipeline Orchestrator)
// ---------------------------------------------------------------------------

export type PlanningQualityStatus = 'excelente' | 'aprobada' | 'requiere_ajustes' | 'insuficiente';

export interface PlanningQualityReport {
  score: number; // 0 - 100
  status: PlanningQualityStatus;
  checks: {
    retoSituado: RetoSituado44Result;
    tresSaberes: TresSaberesResult;
    coherenciaMetodologica: MetodologiaCoherenceResult;
    horasPorCorte: HorasCorteResult;
  };
  feedback: string[];
  evaluatedAt: string;
}

export function evaluatePlanningQuality(planning: Partial<Planning>): PlanningQualityReport {
  const content = planning.contentJson;
  const uac = planning.uacName || content?.sectionI?.uacName || 'UAC Sin Nombre';
  const totalHoras = content?.sectionI?.totalHours || planning.extractedData?.totalHours || 54;
  const metodologia = planning.metodologiaActiva || content?.sectionI?.metodologiaActiva;
  const reto = content?.sectionII?.retoSituado;
  const sequences = planning.sequenceJson;
  const activities = content?.sectionIV?.activities;
  const rubricas = content?.sectionV?.evaluations;

  // Extraer horas de actividades por corte si están disponibles
  let cortesHoras: number[] | undefined;
  if (activities && Array.isArray(activities) && activities.length > 0) {
    // Si las actividades tienen corte asignado
    const c1 = activities.filter((a) => (a as { order?: number; corte?: string }).order === 1 || (a as { corte?: string }).corte === 'Corte 1').reduce((s, a) => s + (a.hours || 0), 0);
    const c2 = activities.filter((a) => (a as { order?: number; corte?: string }).order === 2 || (a as { corte?: string }).corte === 'Corte 2').reduce((s, a) => s + (a.hours || 0), 0);
    const c3 = activities.filter((a) => (a as { order?: number; corte?: string }).order === 3 || (a as { corte?: string }).corte === 'Corte 3').reduce((s, a) => s + (a.hours || 0), 0);
    if (c1 > 0 && c2 > 0 && c3 > 0) {
      cortesHoras = [c1, c2, c3];
    }
  }

  // 1. Validar Reto Situado 4/4
  const retoCheck = validateRetoSituado44(reto, {
    uacName: uac,
    schoolName: content?.sectionI?.schoolName,
  });

  // 2. Validar Tres Saberes
  const saberesCheck = validateTresSaberes(sequences, rubricas, activities);

  // 3. Validar Coherencia Metodológica
  const metodologiaCheck = validateCoherenciaMetodologica(metodologia, sequences, activities);

  // 4. Validar Horas por Corte
  const horasCheck = validateHorasPorCorte(uac, totalHoras, {
    horasPorCorte: cortesHoras,
  });

  // Cálculo de Puntuación Ponderada (0 a 100)
  // - Reto Situado: 25 puntos (score / 4 * 25)
  // - Tres Saberes: 25 puntos (coverageScore / 3 * 25)
  // - Coherencia Metodológica: 25 puntos (metodologiaCheck.score * 0.25)
  // - Horas por Corte: 25 puntos (discrepancy === 0 && isBalanced ? 25 : discrepancy === 0 ? 15 : 0)
  const pReto = (retoCheck.score / 4) * 25;
  const pSaberes = (saberesCheck.coverageScore / 3) * 25;
  const pMetodologia = (metodologiaCheck.score / 100) * 25;
  const pHoras = horasCheck.isValid ? 25 : horasCheck.discrepancy === 0 ? 15 : 5;

  const rawScore = Math.round(pReto + pSaberes + pMetodologia + pHoras);
  const score = Math.max(0, Math.min(100, rawScore));

  let status: PlanningQualityStatus;
  if (score >= 90) {
    status = 'excelente';
  } else if (score >= 75) {
    status = 'aprobada';
  } else if (score >= 50) {
    status = 'requiere_ajustes';
  } else {
    status = 'insuficiente';
  }

  const feedback: string[] = [
    ...retoCheck.feedback,
    ...saberesCheck.feedback,
    ...metodologiaCheck.feedback,
    ...horasCheck.feedback,
  ];

  return {
    score,
    status,
    checks: {
      retoSituado: retoCheck,
      tresSaberes: saberesCheck,
      coherenciaMetodologica: metodologiaCheck,
      horasPorCorte: horasCheck,
    },
    feedback,
    evaluatedAt: new Date().toISOString(),
  };
}
