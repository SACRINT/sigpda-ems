/**
 * Writer Contract & Shared Quality Scoring
 * SIGPDA-EMS · SEMS Puebla MCCEMS 2026-2027
 *
 * Define el contrato uniforme de entrada y salida para todos los redactores
 * concurrentes del motor editorial (Foundation, Lab, Project, Evaluation).
 */

import type { Planning } from '@/types/planning';
import type { DetailedSession } from '@/lib/session-progression-engine';
import type { MissionBlueprint } from '../blueprint-architect-agent';
import type {
  CanonicalSeed,
  MissionSection,
  ProjectSection,
  EvaluationSection,
  SessionPlan,
  PracticaItem,
  RecursoItem,
} from '@/types/work-textbook';

/**
 * Actividades extraídas directamente de la planeación didáctica (Section IV)
 * para garantizar alineación entre planeación → secuencia → guía.
 */
export interface PlanningActivities {
  /** Descripción textual de la fase de Apertura (activities + processes + materials) */
  apertura: {
    description: string;
    processes: string;
    materials: string;
  };
  /** Descripción textual de la fase de Desarrollo/Ejecución */
  ejecucion: {
    description: string;
    processes: string;
    materials: string;
  };
  /** Descripción textual de la fase de Cierre/Conclusión */
  conclusion: {
    description: string;
    processes: string;
    materials: string;
  };
  /** Saberes que el estudiante debe demostrar al finalizar */
  saberes?: {
    saber: string;
    saberHacer: string;
    saberSer: string;
  };
  /** Contenido formativo específico a cubrir */
  contenidoFormativo?: string;
  /** Metodología seleccionada por el docente */
  methodology?: string;
}

export interface WriterInput {
  planning: Planning;
  blockIndex: number;
  blockName: string;
  sessions: DetailedSession[];
  missions: MissionBlueprint[];
  canonicalSeed?: CanonicalSeed;
  existingExtras?: Record<string, unknown>;
  paecContext: string;
  studentProfile: string;
  subsystem: 'bge' | 'bt';
  uacName: string;
  targetWords: { min: number; ideal: number; max: number };
  /** Actividades de la planeación para alinear contenido de la guía */
  planningActivities?: PlanningActivities;
}

export interface WriterOutput {
  type: 'foundation' | 'lab' | 'project' | 'evaluation';
  section: MissionSection; // De work-textbook.ts (obligatorio y uniforme para todos)
  projectSection?: ProjectSection; // Estructura enriquecida si es project
  evaluationSection?: EvaluationSection; // Estructura enriquecida si es evaluation
  wordCount: number;
  tokensUsed: number;
  qualityScore: number; // 0 - 100
  warnings: string[];
}

/**
 * Calcula el qualityScore de forma determinista para cualquier sección generada
 */
export function evaluateQuality(params: {
  wordCount: number;
  targetWords: { min: number; ideal: number; max: number };
  content: string;
  subsystem: 'bge' | 'bt';
  workbookElementsCount: number;
}): { qualityScore: number; warnings: string[] } {
  let score = 0;
  const warnings: string[] = [];

  // 1. +20 si el conteo de palabras está dentro del rango
  if (params.wordCount >= params.targetWords.min) {
    score += 20;
  } else if (params.wordCount >= params.targetWords.min * 0.75) {
    score += 12;
    warnings.push(`Extensión (${params.wordCount} palabras) ligeramente menor a la meta mínima (${params.targetWords.min})`);
  } else {
    score += 5;
    warnings.push(`Extensión deficiente: ${params.wordCount} palabras de ${params.targetWords.min} requeridas`);
  }

  // 2. +25 si no hay placeholders genéricos ni truncados
  const hasPlaceholders = /\[completar\]|\[escribe aquí\]|\[placeholder\]|\[aquí escribe\]|\.\.\./i.test(params.content);
  if (!hasPlaceholders) {
    score += 25;
  } else {
    warnings.push('Se detectaron placeholders genéricos o puntos suspensivos');
  }

  // 3. +25 si es específico del subsistema
  const isBt = params.subsystem === 'bt';
  const hasSubsystemSignals = isBt
    ? /código|terminal|norma|procedimiento|taller|parámetro|ejecutable|hardware|software/i.test(params.content)
    : /comunidad|indagación|reflexión|cotidiano|hipótesis|diálogo|sociedad|puebla/i.test(params.content);

  if (hasSubsystemSignals) {
    score += 25;
  } else {
    score += 10;
    warnings.push(`Falta vocabulario distintivo del subsistema ${params.subsystem.toUpperCase()}`);
  }

  // 3b. Señal de aplicación a la vida diaria (contexto real, no ejercicios abstractos)
  const hasDailyLifeApplication = /vida diaria|cotidian|comunidad|Puebla|PAEC|situación real|problema real|contexto real|del entorno|en la vida/i.test(params.content);
  if (!hasDailyLifeApplication) {
    warnings.push('Las actividades carecen de anclaje claro en la vida diaria del estudiante (contexto real/Puebla/PAEC)');
  }

  // 4. +15 si incluye al menos 2 elementos de cuaderno activo
  if (params.workbookElementsCount >= 2) {
    score += 15;
  } else {
    score += 5;
    warnings.push('Pocos elementos de cuaderno activo para el alumno');
  }

  // 5. +15 español formal y ortografía técnica
  const hasSpanishMarkers =
    /[áéíóúñ¿¡]/i.test(params.content) ||
    /\b(el|la|los|las|de|del|en|con|para|por|que|es|son|se|un|una)\b/i.test(params.content);
  if (hasSpanishMarkers) {
    score += 15;
  } else {
    warnings.push('El contenido no presenta marcadores claros de redacción en español formal');
  }

  return {
    qualityScore: Math.min(100, Math.max(0, score)),
    warnings,
  };
}

/**
 * Sanitiza el array `sessionPlans` devuelto por la IA: garantiza que cada plan
 * corresponda a una sesión cubierta real y que sea LIBRO PARA EL ESTUDIANTE
 * (voz en "tú", sin verbos de instrucción al docente). Acepta también la forma
 * heredada (docente) y la mapea al modelo de estudiante para no romper datos
 * viejos. Descarta planes inválidos. Devuelve `undefined` si no hay utilizables.
 */
export function sanitizeSessionPlans(
  raw: unknown,
  coveredSessions: number[]
): SessionPlan[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0 || coveredSessions.length === 0) return undefined;

  const asText = (v: unknown, min = 10): string =>
    typeof v === 'string' && v.trim().length >= min ? v.trim() : '';

  // Elimina cualquier rastro de voz de docente (defensa anti "guía de clase").
  const toStudentVoice = (s: string): string =>
    s
      .replace(/^\s*(docente|estudiante)\s*:\s*/gim, '')
      .replace(/\b(exponer y problematizar|verificar comprensión|orientar el avance|activar el interés|plantear la situación|retomar el desafío|presentar a los equipos)\b/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

  const validPlans: SessionPlan[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const sessionNumber = Number(rec.sessionNumber);
    if (!Number.isInteger(sessionNumber) || !coveredSessions.includes(sessionNumber)) continue;

    // Práctica: acepta [{enunciado,pista}] (nuevo) o string[] (heredado).
    const practicaRaw = Array.isArray(rec.practica) ? rec.practica : [];
    const practica: PracticaItem[] = practicaRaw
      .map((p): PracticaItem | null => {
        if (typeof p === 'string') {
          const t = toStudentVoice(p);
          return t.length >= 10 ? { enunciado: t, pista: '' } : null;
        }
        if (p && typeof p === 'object') {
          const pr = p as Record<string, unknown>;
          const enunciado = toStudentVoice(asText(pr.enunciado ?? pr.texto ?? pr.tarea));
          if (enunciado.length < 10) return null;
          return { enunciado, pista: asText(pr.pista ?? pr.hint ?? pr.pista_) };
        }
        return null;
      })
      .filter((p): p is PracticaItem => p !== null);

    // Recursos: acepta [{titulo,url,tipo}] validando URL http(s).
    const recursosRaw = Array.isArray(rec.recursos) ? rec.recursos : [];
    const recursos: RecursoItem[] = recursosRaw
      .map((r): RecursoItem | null => {
        if (!r || typeof r !== 'object') return null;
        const rr = r as Record<string, unknown>;
        const titulo = asText(rr.titulo ?? rr.title);
        const url = asText(rr.url ?? rr.enlace, 7);
        if (titulo.length < 4 || !/^https?:\/\//i.test(url)) return null;
        const tipo = rr.tipo === 'video' || rr.tipo === 'lectura' ? rr.tipo : 'web';
        return { titulo, url, tipo };
      })
      .filter((r): r is RecursoItem => r !== null);

    // Autoevaluación: string[] (nuevo) o un string (heredado evaluacionObjetivo).
    const autoevalRaw = Array.isArray(rec.autoevaluacion) ? rec.autoevaluacion : [rec.autoevaluacion];
    const autoevaluacion = autoevalRaw
      .map((a) => toStudentVoice(asText(a)))
      .filter((a) => a.length >= 10);

    // Contenido teórico: campo nuevo "contenido" o heredado "nuevosConocimientos".
    const contenido = toStudentVoice(asText(rec.contenido ?? rec.nuevosConocimientos, 20));

    const objetivo = toStudentVoice(asText(rec.objetivo, 10));
    const plan: SessionPlan = {
      sessionNumber,
      objetivo: objetivo || `Al terminar la sesión ${sessionNumber} sabrás aplicar los conceptos del tema en situaciones reales.`,
      motivacion: toStudentVoice(asText(rec.motivacion, 20)) || `Imagina que en tu comunidad existe un problema real que puede resolverse con lo que vas a aprender hoy.`,
      saberesPrevios: toStudentVoice(asText(rec.saberesPrevios ?? rec.conocimientosPrevios, 10)) || `Ya conoces ideas previas del tema de la sesión anterior; úsalas como punto de partida.`,
      contenido: contenido || `En esta sesión estudiarás los conceptos fundamentales del tema con definiciones, fórmulas y ejemplos que podrás aplicar de inmediato.`,
      ejemploResuelto: toStudentVoice(asText(rec.ejemploResuelto ?? rec.ejemplo, 20)) || `A continuación verás un ejemplo resuelto paso a paso con números concretos; sigue el procedimiento en tu cuaderno.`,
      practica: practica.length > 0 ? practica : [{ enunciado: `Resuelve los ejercicios de práctica de la sesión ${sessionNumber} usando los datos del ejemplo resuelto.`, pista: `Repasa el ejemplo resuelto y aplica el mismo procedimiento paso a paso.` }],
      aplicacion: toStudentVoice(asText(rec.aplicacion, 15)) || `Aplica lo aprendido a una situación de tu vida diaria y registra la evidencia en tu cuaderno.`,
      autoevaluacion: autoevaluacion.length > 0 ? autoevaluacion : [`¿Puedo explicar con mis palabras el concepto central de esta sesión?`, `¿Logré resolver la práctica sin mirar el ejemplo?`],
      recursos,
      productoIntegrador: toStudentVoice(asText(rec.productoIntegrador, 10)) || `Agrega a tu producto integrador el avance de esta sesión con evidencia legible y fechada.`,
    };
    validPlans.push(plan);
  }

  return validPlans.length > 0 ? validPlans : undefined;
}
