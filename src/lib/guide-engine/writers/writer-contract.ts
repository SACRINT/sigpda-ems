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
import { logger } from '@/lib/logger';
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
  /**
   * Señal de aborto para cancelar llamadas de IA en curso ante expiración de lease o timeout
   */
  signal?: AbortSignal;
  /**
   * Términos faltantes detectados por la Fase 8.5 (alineación dura). Se inyecta
   * textual en el prompt SOLO durante el reintento dirigido de alineación.
   */
  alignmentDirective?: string;
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
 * Preguntas de autoevaluación de respaldo (mínimo editorial: 2 por sesión).
 * Completan planes donde la IA devolvió menos de 2 ítems válidos.
 */
export const DEFAULT_AUTOEVALUACION: readonly string[] = [
  '¿Puedo explicar con mis palabras el concepto central de esta sesión?',
  '¿Logré resolver la práctica sin mirar el ejemplo?',
];

/** Pista genérica de respaldo cuando la IA no devolvió orientación para el ejercicio. */
export const FALLBACK_PISTA =
  'Observa el ejemplo resuelto paso a paso y aplica el mismo procedimiento con los datos del ejercicio.';

/**
 * Normaliza URLs casi-válidas devueltas por la IA (p.ej. "www.youtube.com/watch?v=…"
 * sin protocolo) añadiendo https://. Cadenas que no parecen dominio se conservan tal
 * cual para que las reglas de validación las descarten sin inventar enlaces.
 */
export function normalizeHttpUrl(raw: string): string {
  if (!raw || /^https?:\/\//i.test(raw)) return raw;
  if (!/\s/.test(raw) && /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}([/?#].*)?$/i.test(raw)) return `https://${raw}`;
  return raw;
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

  // Solución modelo: material SOLO del solucionario docente. No se impone voz de
  // estudiante (los pasos son procedimentales), pero se limpia ruido y se acota.
  const sanitizeSolucion = (v: unknown): string[] => {
    const arr = Array.isArray(v) ? v : typeof v === 'string' ? v.split(/\n+/) : [];
    return arr
      .map((s) =>
        typeof s === 'string'
          ? s.replace(/^\s*(docente|estudiante)\s*:\s*/gim, '').replace(/\s{2,}/g, ' ').trim()
          : ''
      )
      .filter((s) => s.length >= 5)
      .slice(0, 6)
      .map((s) => (s.length > 400 ? `${s.slice(0, 397)}...` : s));
  };

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
          return t.length >= 10 ? { enunciado: t, pista: FALLBACK_PISTA } : null;
        }
        if (p && typeof p === 'object') {
          const pr = p as Record<string, unknown>;
          const enunciado = toStudentVoice(asText(pr.enunciado ?? pr.texto ?? pr.tarea));
          if (enunciado.length < 10) return null;
          const solucion = sanitizeSolucion(pr.solucion ?? pr.solution);
          const pistaCruda = asText(pr.pista ?? pr.hint ?? pr.pista_, 5);
          return {
            enunciado,
            pista: pistaCruda.length >= 5 ? pistaCruda : FALLBACK_PISTA,
            ...(solucion.length > 0 ? { solucion } : {}),
          };
        }
        return null;
      })
      .filter((p): p is PracticaItem => p !== null);

    // Recursos: acepta [{titulo,url,tipo}] validando URL http(s). Se normaliza
    // primero la URL por si la IA devolvió un dominio sin protocolo (www.…).
    const recursosRaw = Array.isArray(rec.recursos) ? rec.recursos : [];
    const recursos: RecursoItem[] = recursosRaw
      .map((r): RecursoItem | null => {
        if (!r || typeof r !== 'object') return null;
        const rr = r as Record<string, unknown>;
        const titulo = asText(rr.titulo ?? rr.title);
        const url = normalizeHttpUrl(asText(rr.url ?? rr.enlace, 7));
        if (titulo.length < 4 || !/^https?:\/\/\S+$/i.test(url)) return null;
        const tipo = rr.tipo === 'video' || rr.tipo === 'lectura' ? rr.tipo : 'web';
        return { titulo, url, tipo };
      })
      .filter((r): r is RecursoItem => r !== null);

    // Autoevaluación: string[] (nuevo) o un string (heredado evaluacionObjetivo).
    // Mínimo editorial: 2 ítems (StudentSessionSchema) — se completa con defaults.
    const autoevalRaw = Array.isArray(rec.autoevaluacion) ? rec.autoevaluacion : [rec.autoevaluacion];
    const autoevaluacion = autoevalRaw
      .map((a) => toStudentVoice(asText(a)))
      .filter((a) => a.length >= 10);

    const richFallback = buildRichFallbackPlan(sessionNumber);

    // Contenido teórico: campo nuevo "contenido" o heredado "nuevosConocimientos".
    let contenido = toStudentVoice(asText(rec.contenido ?? rec.nuevosConocimientos, 20));
    const contenidoWords = contenido.split(/\s+/).filter(Boolean).length;
    if (contenidoWords < 160) {
      contenido = contenido ? `${contenido}\n\n${richFallback.contenido}` : richFallback.contenido;
    }

    let ejemploResuelto = toStudentVoice(asText(rec.ejemploResuelto ?? rec.ejemplo, 20));
    const ejemploWords = ejemploResuelto.split(/\s+/).filter(Boolean).length;
    if (ejemploWords < 120) {
      ejemploResuelto = ejemploResuelto ? `${ejemploResuelto}\n\n${richFallback.ejemploResuelto}` : richFallback.ejemploResuelto;
    }

    let motivacion = toStudentVoice(asText(rec.motivacion, 20));
    if (motivacion.split(/\s+/).filter(Boolean).length < 30) {
      motivacion = motivacion ? `${motivacion} ${richFallback.motivacion}` : richFallback.motivacion;
    }

    let saberesPrevios = toStudentVoice(asText(rec.saberesPrevios ?? rec.conocimientosPrevios, 10));
    if (saberesPrevios.split(/\s+/).filter(Boolean).length < 20) {
      saberesPrevios = saberesPrevios ? `${saberesPrevios} ${richFallback.saberesPrevios}` : richFallback.saberesPrevios;
    }

    let aplicacion = toStudentVoice(asText(rec.aplicacion, 15));
    if (aplicacion.split(/\s+/).filter(Boolean).length < 25) {
      aplicacion = aplicacion ? `${aplicacion} ${richFallback.aplicacion}` : richFallback.aplicacion;
    }

    let productoIntegrador = toStudentVoice(asText(rec.productoIntegrador, 10));
    if (productoIntegrador.split(/\s+/).filter(Boolean).length < 20) {
      productoIntegrador = productoIntegrador ? `${productoIntegrador} ${richFallback.productoIntegrador}` : richFallback.productoIntegrador;
    }

    const finalPractica: PracticaItem[] = practica.length >= 2
      ? practica
      : (practica.length === 1 ? [practica[0], richFallback.practica[1]] : richFallback.practica);

    const objetivo = toStudentVoice(asText(rec.objetivo, 10));
    const plan: SessionPlan = {
      sessionNumber,
      objetivo: objetivo || richFallback.objetivo,
      motivacion,
      saberesPrevios,
      contenido,
      ejemploResuelto,
      practica: finalPractica,
      aplicacion,
      autoevaluacion:
        autoevaluacion.length >= 2
          ? autoevaluacion
          : [...autoevaluacion, ...DEFAULT_AUTOEVALUACION].slice(0, 2),
      recursos,
      productoIntegrador,
    };
    validPlans.push(plan);
  }

  return validPlans.length > 0 ? validPlans : undefined;
}

/**
 * Genera un plan de sesión formativo completo y de alta densidad pedagógica (~800 palabras)
 * cuando la IA omite una sesión o devuelve contenido insuficiente.
 */
export function buildRichFallbackPlan(sessionNumber: number): SessionPlan {
  return {
    sessionNumber,
    objetivo: `Al término de la sesión ${sessionNumber}, serás capaz de modelar e interpretar los fenómenos de variación y cambio cuantitativo en problemáticas situadas de tu comunidad, aplicando las propiedades algebraicas y analíticas pertinentes con rigor procedimental.`,
    motivacion: `En una comunidad de nuestra región de Puebla, un comité comunitario analiza el comportamiento dinámico de los recursos locales y los factores de bienestar social. Para tomar decisiones informadas, necesitan identificar con precisión cómo cambia una magnitud respecto al tiempo o a variables de demanda. En esta sesión ${sessionNumber}, descubrirás cómo las herramientas formales te permiten comprender y proponer alternativas de solución viables para tu entorno escolar y social.`,
    saberesPrevios: `Antes de iniciar, reflexiona sobre lo estudiado en las sesiones previas respecto a las magnitudes constantes y variables. Responde en tu cuaderno activo: ¿qué diferencia una razón de cambio constante de una variable? ¿Cómo identificas si un modelo lineal o no lineal describe adecuadamente una situación real? Escribe tus conclusiones iniciales.`,
    contenido: `En esta sesión ${sessionNumber}, profundizaremos en el análisis sistemático de la variación y su formalización analítica. Cuando estudiamos fenómenos en la naturaleza o en la sociedad, observamos que las variables rara vez permanecen estáticas; interactúan mediante dependencias funcionales donde el incremento o decremento de una variable independiente genera una respuesta cuantificable en la variable dependiente.\n\nPara caracterizar este comportamiento con rigor científico, definimos formalmente la tasa de variación media como el cociente entre el cambio observado en la magnitud dependiente y el cambio en la variable de control, expresado matemáticamente como delta y entre delta x. Esta relación nos permite no solo describir el estado actual de un sistema, sino también proyectar tendencias futuras y estimar puntos críticos de estabilidad o riesgo.\n\nAsimismo, es indispensable verificar las restricciones del dominio y del codominio en el contexto real. Por ejemplo, variables como tiempo, población, concentración o volumen poseen fronteras físicas que delimitan la validez del modelo matemático, impidiendo valores negativos o discontinuidades no interpretables. Al dominar estas herramientas, adquieres la capacidad de construir representaciones tabulares, gráficas y algebraicas coherentes que fundamentan tus propuestas comunitarias.`,
    ejemploResuelto: `Planteamiento: Un equipo de trabajo monitorea el consumo y la distribución de agua potable en un módulo escolar comunitario. Se registra que al inicio de la jornada (t = 0 h) la reserva contiene 1,200 litros, y tras 4 horas de uso controlado (t = 4 h) el volumen desciende a 720 litros siguiendo una tasa de variación constante.\n\nPaso 1: Identificación de datos y variables. Variable independiente: tiempo transcurrido en horas (t). Variable dependiente: volumen de reserva en litros, V(t). Puntos de observación: P1(0, 1200) y P2(4, 720).\n\nPaso 2: Cálculo de la tasa de variación. Aplicamos el cociente incremental: m = (720 - 1200) / (4 - 0) = -480 / 4 = -120 litros por hora. El signo negativo indica una pérdida o consumo continuo a razón de 120 L/h.\n\nPaso 3: Construcción de la ecuación de balance. La función lineal correspondiente es V(t) = 1200 - 120t, válida para el intervalo donde V(t) >= 0.\n\nPaso 4: Determinación del tiempo de agotamiento. Igualando V(t) = 0: 0 = 1200 - 120t, lo que implica 120t = 1200, obteniendo t = 10 horas. Conclusión: La reserva se agotará exactamente en 10 horas si el ritmo de demanda se mantiene constante, lo que permite programar la recarga comunitaria antes de la sexta hora para evitar el desabasto.`,
    practica: [
      {
        enunciado: `Ejercicio 1: Un comité escolar registra el ahorro acumulado para la compra de filtros de agua. En la semana 2 tienen acumulados $1,850 pesos y en la semana 6 cuentan con $4,250 pesos bajo aportaciones semanales fijas. Modela algebraicamente la función de ahorro S(t), calcula la aportación semanal y determina en qué semana alcanzarán la meta de $7,250 pesos.`,
        pista: `Calcula la razón de cambio entre los puntos (2, 1850) y (6, 4250). Luego utiliza la forma punto-pendiente para establecer la ecuación de la recta y despejar el valor del tiempo t.`,
        solucion: [
          'Paso 1: m = (4250 - 1850) / (6 - 2) = 2400 / 4 = 600 pesos por semana.',
          'Paso 2: Ecuación S(t) = 1850 + 600(t - 2) = 600t + 650.',
          'Paso 3: Igualar a 7250: 600t + 650 = 7250 -> 600t = 6600 -> t = 11 semanas.',
          'Respuesta final: La aportación semanal es de $600 pesos y la meta se alcanzará en la semana 11.',
        ],
      },
      {
        enunciado: `Ejercicio 2: Durante una campaña de reciclaje en el plantel, se recolectan 45 kg de PET el primer día y se observa un incremento sostenido de 12 kg diarios adicionales durante los siguientes 8 días. Construye la tabla de valores de los primeros 5 días y escribe la regla de correspondencia que modela la recolección acumulada.`,
        pista: `Identifica la condición inicial y suma el incremento diario constante para cada día consecutivo, verificando la relación entre el número de días transcurridos y el total acopiado.`,
        solucion: [
          'Paso 1: Día 1 = 45 kg, Día 2 = 57 kg, Día 3 = 69 kg, Día 4 = 81 kg, Día 5 = 93 kg.',
          'Paso 2: Regla de correspondencia lineal: R(d) = 45 + 12(d - 1) = 12d + 33 kg.',
          'Respuesta final: El modelo es R(d) = 12d + 33 kg con crecimiento lineal uniforme.',
        ],
      },
    ],
    aplicacion: `Lleva lo aprendido a tu hogar o comunidad escolar: identifica una magnitud variable susceptible de medición semanal (consumo de energía eléctrica, uso de gas doméstico o generación de residuos sólidos). Registra al menos tres mediciones consecutivas, calcula la variación observada y formula una propuesta cuantitativa para hacer más eficiente el consumo de dicho recurso en tu entorno.`,
    autoevaluacion: [
      `¿Puedo explicar con claridad y rigor conceptual el significado de una tasa de variación en un fenómeno real?`,
      `¿Fui capaz de resolver los ejercicios de práctica de manera autónoma siguiendo un procedimiento matemático ordenado?`,
      `¿Registré las evidencias, fórmulas y conclusiones en mi cuaderno de trabajo activo con fecha y presentación formal?`,
    ],
    recursos: [
      {
        titulo: `Simulación interactiva de razones de cambio y modelación lineal`,
        url: `https://phet.colorado.edu/es/simulations/graphing-lines`,
        tipo: `web`,
      },
      {
        titulo: `Video tutorial: Aplicación de modelos funcionales en situaciones comunitarias`,
        url: `https://www.youtube.com/results?search_query=pensamiento+variacional+modelacion+lineal+bachillerato`,
        tipo: `video`,
      },
    ],
    productoIntegrador: `Para tu portafolio y proyecto comunitario PAEC, integra la ficha técnica de la sesión ${sessionNumber}: incluye el modelo algebraico validado, la gráfica de variación correspondiente y un párrafo de interpretación cualitativa sobre el impacto social de los resultados obtenidos.`,
  };
}

/**
 * Garantía de cobertura total de sesiones (anti "36 vs 72").
 *
 * Devuelve SIEMPRE un plan por cada sesión cubierta: primero sanitiza lo que la IA
 * respondió y luego completa las sesiones faltantes (IA que omitió planes o writer
 * en fallback de error) con planes genéricos enriquecidos en voz de estudiante, registrando un
 * warning en el log. Nunca se descarta una sesión en silencio.
 */
export function completeSessionPlans(raw: unknown, coveredSessions: number[]): SessionPlan[] {
  if (coveredSessions.length === 0) return [];

  const sanitized = sanitizeSessionPlans(raw, coveredSessions) ?? [];

  // Deduplica por sesión (si la IA repitió un plan, se conserva el primero).
  const plans: SessionPlan[] = [];
  const present = new Set<number>();
  for (const plan of sanitized) {
    if (present.has(plan.sessionNumber)) {
      logger.warn(`[writer-contract] Plan de sesión ${plan.sessionNumber} duplicado en la respuesta; se conserva el primero.`);
      continue;
    }
    present.add(plan.sessionNumber);
    plans.push(plan);
  }

  const missing = coveredSessions.filter((n) => !present.has(n));

  if (missing.length > 0) {
    logger.warn(
      `[writer-contract] sessionPlans incompletos: faltan las sesiones ${missing.join(', ')} de ${coveredSessions.join(', ')}. Completando con planes pedagógicos calibrados.`
    );
    for (const n of missing) {
      plans.push(buildRichFallbackPlan(n));
    }
  }

  return plans.sort((a, b) => a.sessionNumber - b.sessionNumber);
}
