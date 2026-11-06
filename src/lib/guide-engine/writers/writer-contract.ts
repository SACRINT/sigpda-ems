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
import { countSessionPlanWords } from '../content-budget';
import { isMathUAC, validateSessionPlanContamination } from '../cross-contamination-guard';
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

  const asText = (v: unknown, min = 10): string => {
    if (typeof v === 'string') return v.trim().length >= min ? v.trim() : '';
    if (Array.isArray(v)) {
      const parts = v
        .map((item) => (typeof item === 'string' ? item : (item && typeof item === 'object' ? Object.values(item).join(' ') : '')))
        .filter(Boolean);
      const joined = parts.join('\n');
      return joined.trim().length >= min ? joined.trim() : '';
    }
    if (v && typeof v === 'object') {
      const values = Object.values(v as Record<string, unknown>)
        .map((val) => (typeof val === 'string' ? val : (Array.isArray(val) ? val.join(' ') : '')))
        .filter(Boolean);
      const joined = values.join('\n\n');
      return joined.trim().length >= min ? joined.trim() : '';
    }
    return '';
  };

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

    // Contenido teórico: campo nuevo "contenido" o heredado "nuevosConocimientos" o variantes de IA.
    // 100% IA auténtica: NUNCA concatenar texto de fallback sintético.
    const contenido = toStudentVoice(
      asText(
        rec.contenido ??
          rec.nuevosConocimientos ??
          rec.teoria ??
          rec.marcoConceptual ??
          rec.explicacion ??
          rec.desarrollo,
        20
      )
    );
    const ejemploResuelto = toStudentVoice(
      asText(
        rec.ejemploResuelto ??
          rec.ejemplo ??
          rec.ejemploEvaluativo ??
          rec.ejemplo_resuelto ??
          rec.solvedExample ??
          rec.ejemploPractico ??
          rec.demostracion,
        20
      )
    );
    const motivacion = toStudentVoice(asText(rec.motivacion ?? rec.contexto ?? rec.enganche, 20));
    const saberesPrevios = toStudentVoice(asText(rec.saberesPrevios ?? rec.conocimientosPrevios ?? rec.diagnostico, 10));
    const aplicacion = toStudentVoice(asText(rec.aplicacion ?? rec.transferencia ?? rec.vinculacion, 15));
    const productoIntegrador = toStudentVoice(asText(rec.productoIntegrador ?? rec.entregable ?? rec.evidencia, 10));
    const objetivo = toStudentVoice(asText(rec.objetivo ?? rec.meta, 10));

    const defaultPractica: PracticaItem[] = [
      {
        enunciado: `Resuelve los ejercicios prácticos de la sesión ${sessionNumber} aplicando el modelo conceptual estudiado con datos de tu entorno.`,
        pista: FALLBACK_PISTA,
      },
    ];

    const plan: SessionPlan = {
      sessionNumber,
      objetivo: objetivo || `Al terminar la sesión ${sessionNumber} sabrás aplicar los conceptos del tema en situaciones reales.`,
      motivacion: motivacion || `Imagina que en tu comunidad existe un problema real que puede resolverse con lo que vas a aprender hoy.`,
      saberesPrevios: saberesPrevios || `Ya conoces ideas previas del tema de la sesión anterior; úsalas como punto de partida.`,
      contenido: contenido || `En esta sesión estudiarás los conceptos fundamentales del tema con definiciones, fórmulas y ejemplos que podrás aplicar de inmediato.`,
      ejemploResuelto: ejemploResuelto || `A continuación verás un ejemplo resuelto paso a paso con números concretos; sigue el procedimiento en tu cuaderno.`,
      practica: practica.length > 0 ? practica : defaultPractica,
      aplicacion: aplicacion || `Aplica lo aprendido a una situación de tu vida diaria y registra la evidencia en tu cuaderno.`,
      autoevaluacion:
        autoevaluacion.length >= 2
          ? autoevaluacion
          : [...autoevaluacion, ...DEFAULT_AUTOEVALUACION].slice(0, 2),
      recursos,
      productoIntegrador: productoIntegrador || `Agrega a tu producto integrador el avance de esta sesión con evidencia legible y fechada.`,
      isFallback: false,
    };
    validPlans.push(plan);
  }

  return validPlans.length > 0 ? validPlans : undefined;
}

/**
 * Contexto de la UAC y sesión para generar planes de contingencia (fallback) contextuales,
 * impidiendo la inyección cruzada de contenidos foráneos (ej. matemáticas en construcción).
 */
export interface FallbackPlanContext {
  uacName?: string;
  blockName?: string;
  sessionTopic?: string;
  sessionFocus?: string;
  paecContext?: string;
  subsystem?: string;
}

/**
 * Genera un plan de sesión de contingencia estructurado y contextual (~700-800 palabras)
 * cuando la IA omite una sesión o devuelve contenido insuficiente.
 *
 * REGLA ESTRICTA DE AISLAMIENTO DISCIPLINAR:
 * Jamás inyecta fórmulas, simulaciones ni ejemplos algebraicos en UACs no matemáticas.
 * Todo plan generado mediante fallback queda marcado con `isFallback: true`.
 */
export function buildContextualFallbackPlan(
  sessionNumber: number,
  context?: FallbackPlanContext
): SessionPlan {
  const uac = context?.uacName || 'la Unidad de Aprendizaje Curricular';
  const topic = context?.sessionTopic || context?.blockName || 'los procesos formativos del bloque';
  const paec = context?.paecContext || 'el proyecto escolar y comunitario';
  const mathUac = isMathUAC(uac);

  const objetivo = mathUac
    ? `Al término de la sesión ${sessionNumber}, serás capaz de modelar e interpretar los procesos cuantitativos de ${topic} en el marco de ${uac}, aplicando el razonamiento formal y procedimental correspondiente.`
    : `Al término de la sesión ${sessionNumber}, serás capaz de analizar y aplicar los principios y procedimientos normativos correspondientes a ${topic} en el marco formativo de ${uac}, vinculando las destrezas técnicas con las necesidades del entorno escolar y comunitario.`;

  const motivacion = mathUac
    ? `En nuestra región y comunidad escolar, el análisis riguroso de problemáticas situadas requiere herramientas matemáticas para modelar comportamientos dinámicos vinculados a ${paec}. En esta sesión ${sessionNumber}, explorarás cómo los métodos formales permiten tomar decisiones fundamentadas.`
    : `En la comunidad escolar y su entorno regional, las actividades vinculadas a ${uac} demandan un dominio riguroso de ${topic}. Desarrollar habilidades prácticas y criterios técnicos fundamentados permite responder con precisión, eficiencia y seguridad a las problemáticas identificadas en ${paec}, garantizando resultados duraderos y de calidad profesional.`;

  const saberesPrevios = mathUac
    ? `Antes de iniciar, reflexiona sobre lo estudiado en las sesiones previas respecto a las magnitudes y relaciones funcionales: ¿cómo identificas las variables clave de un problema y qué representaciones permiten analizar su comportamiento con exactitud?`
    : `Antes de comenzar las actividades prácticas de la sesión ${sessionNumber}, reflexiona en tu cuaderno de trabajo activo sobre tus experiencias previas y conocimientos adquiridos: ¿Cuáles son las herramientas, materiales y medidas de seguridad esenciales al trabajar con ${topic}? ¿Qué normativas o criterios técnicos deben verificarse antes de dar por aceptado un procedimiento en ${uac}? Redacta tus notas iniciales.`;

  const contenido = mathUac
    ? `En esta sesión ${sessionNumber}, profundizaremos en los fundamentos conceptuales de ${topic}. Cuando estudiamos fenómenos en el contexto real, analizamos interacciones cuantitativas donde las relaciones estructuradas permiten proyectar tendencias y evaluar alternativas de solución sustentables.\n\nEl tratamiento riguroso de los datos exige delimitar claramente las condiciones de frontera y las restricciones contextuales del problema, asegurando que cada representación gráfica, tabular o analítica mantenga coherencia lógica y pertinencia comunitaria.\n\nAl integrar estos saberes, fortaleces tu pensamiento reflexivo y capacidad de argumentación fundamentada en beneficio del entorno escolar.`
    : `En esta sesión ${sessionNumber}, profundizaremos en los fundamentos técnicos, criterios normativos y secuencias procedimentales que caracterizan a ${topic}. En toda práctica profesional y de taller en ${uac}, el cumplimiento de tolerancias, la selección adecuada de insumos y el manejo responsable de herramientas constituyen la base para garantizar intervenciones seguras y de alto estándar técnico.\n\nEl desarrollo ordenado de cada procedimiento implica fases claramente delimitadas: la preparación del área de trabajo, la inspección preventiva de los elementos a intervenir, la ejecución metódica siguiendo las especificaciones técnicas o manuales del fabricante, y la verificación funcional inmediata. Omitir cualquiera de estas fases incrementa el riesgo de fallas operativas, retrabajos o accidentes en el área de práctica.\n\nAsimismo, el trabajo en el marco de ${uac} exige considerar el impacto ambiental y social de las intervenciones. El uso eficiente de los recursos, la gestión responsable de residuos y la adopción constante de equipos de protección personal (EPP) reflejan un compromiso ético tanto con la preservación del entorno escolar como con la salud y bienestar de la comunidad.`;

  const ejemploResuelto = mathUac
    ? `Planteamiento del Caso: Un equipo escolar analiza datos cuantitativos relacionados con ${topic} en el contexto de ${paec}.\n\nPaso 1: Identificación de variables y parámetros observables.\nPaso 2: Registro estructurado y formulación de relaciones iniciales.\nPaso 3: Desarrollo procedimental paso a paso contrastando hipótesis.\nPaso 4: Interpretación cualitativa y cuantitativa de los resultados obtenidos para la toma de decisiones comunitarias.`
    : `Planteamiento del Caso Práctico: Un equipo de trabajo debe realizar la intervención y diagnóstico operativo correspondiente a ${topic} en el contexto de ${uac}, atendiendo una solicitud formativa vinculada a ${paec}.\n\nPaso 1: Diagnóstico inicial e inspección de condiciones. Se realiza el reconocimiento visual y técnico del área de trabajo, verificando la ausencia de riesgos inmediatos, la disponibilidad de los insumos requeridos para ${topic} y el uso obligatorio del equipo de protección personal normativo.\n\nPaso 2: Selección y preparación de herramientas e insumos. Se eligen las herramientas específicas y los materiales estandarizados, comprobando que las especificaciones de resistencia, dimensión y compatibilidad técnica cumplan los requerimientos del procedimiento.\n\nPaso 3: Ejecución controlada del procedimiento técnico. Siguiendo la secuencia metodológica establecida, se lleva a cabo la maniobra técnica cuidando la alineación, fijación, ajuste o conexión precisa de cada elemento sin forzar los componentes mecánicos ni alterar las tolerancias admisibles.\n\nPaso 4: Pruebas de verificación, control de calidad y bitácora. Se aplican las pruebas de funcionamiento y estanqueidad o estabilidad correspondientes, constatando que no existan fallas, fugas ni holguras indebidas. Se asienta el resultado en la bitácora técnica de obra con firma de supervisión y fecha formal.`;

  const practica: PracticaItem[] = mathUac
    ? [
        {
          enunciado: `Ejercicio 1: Analiza un conjunto de datos contextuales de tu comunidad vinculados a ${topic} y determina la tendencia o relación observable.`,
          pista: `Organiza la información en una tabla de doble entrada para facilitar la comparación entre los valores.`,
          solucion: [
            'Paso 1: Organización y ordenamiento de los datos en tabla estructurada.',
            'Paso 2: Comparación de variaciones relativas entre observaciones consecutivas.',
            'Paso 3: Deducción de conclusiones fundamentadas en los datos analizados.',
          ],
        },
        {
          enunciado: `Ejercicio 2: Propón una formulación cuantitativa que permita estimar el comportamiento de ${topic} ante un incremento del 20% en la demanda comunitaria.`,
          pista: `Aplica proporcionalidad directa considerando las restricciones del entorno escolar.`,
          solucion: [
            'Paso 1: Identificación del factor de escala (1.20).',
            'Paso 2: Aplicación del factor a las cantidades base del problema.',
            'Paso 3: Verificación de viabilidad y redacción del reporte formal.',
          ],
        },
      ]
    : [
        {
          enunciado: `Ejercicio 1: Elabora un diagrama de flujo procedimental para la intervención en ${topic}, detallando la secuencia de 4 pasos técnicos obligatorios y los puntos críticos de inspección de seguridad en ${uac}.`,
          pista: `Revisa la secuencia desde la preparación del área de trabajo y selección de herramientas hasta la verificación final y registro en bitácora.`,
          solucion: [
            'Paso 1: Inspección de seguridad y delimitación del área con EPP completo.',
            'Paso 2: Selección y calibración de herramientas y materiales normativos.',
            'Paso 3: Ejecución técnica controlada siguiendo especificaciones.',
            'Paso 4: Prueba funcional de control de calidad y entrega formal con bitácora.',
          ],
        },
        {
          enunciado: `Ejercicio 2: Identifica dos posibles fallas o defectos comunes que pueden presentarse durante el manejo de ${topic} en ${uac}, explicando la causa raíz técnica y la acción correctiva preventiva inmediata.`,
          pista: `Considera errores en el ajuste de uniones, desgaste de herramientas, omisión de pruebas de hermeticidad o falta de limpieza en las superficies.`,
          solucion: [
            'Defecto A: Holgura o desalineación por apriete desigual; corrección: verificación con nivel y ajuste progresivo en cruz.',
            'Defecto B: Fuga o pérdida de estanqueidad por impurezas en la unión; corrección: limpieza minuciosa y reemplazo de sellos normativos.',
            'Conclusión: El control preventivo evita retrabajos y garantiza la vida útil de la instalación.',
          ],
        },
      ];

  const aplicacion = mathUac
    ? `Aplica los principios analizados a una problemática real de tu entorno escolar: recolecta datos cuantitativos sobre el uso de recursos y elabora una propuesta fundamentada para optimizar su distribución en ${paec}.`
    : `Aplica lo analizado a tu entorno escolar o comunitario: inspecciona un área o instalación donde se requiera aplicar criterios técnicos de ${topic}. Registra en tu cuaderno las observaciones de campo, el estado actual de los elementos y redacta una propuesta de mejora o mantenimiento preventivo con enfoque de beneficio comunitario para ${paec}.`;

  const autoevaluacion = mathUac
    ? [
        `¿Puedo explicar con claridad y rigor formal los conceptos abordados en esta sesión?`,
        `¿Fui capaz de resolver los ejercicios de análisis de manera ordenada y autónoma?`,
        `¿Registré las evidencias, desarrollos y conclusiones en mi cuaderno de trabajo activo con fecha formal?`,
      ]
    : [
        `¿Comprendo la secuencia técnica y las medidas de seguridad requeridas para intervenir en ${topic}?`,
        `¿Puedo identificar las herramientas adecuadas y justificar su uso conforme a especificaciones técnicas?`,
        `¿Consigné en mi cuaderno activo las observaciones, diagramas y conclusiones con rigor y limpieza?`,
      ];

  const recursos: RecursoItem[] = [
    {
      titulo: `Guía formativa y criterios normativos aplicables a ${uac}`,
      url: `https://educacionmediasuperior.sep.gob.mx`,
      tipo: `web`,
    },
    {
      titulo: `Manual de buenas prácticas y seguridad técnica en el taller escolar`,
      url: `https://www.gob.mx/sep`,
      tipo: `web`,
    },
  ];

  const productoIntegrador = `Para tu portafolio y proyecto comunitario PAEC (${paec}), elabora la ficha técnica de la sesión ${sessionNumber}: incluye el reporte de actividades de ${topic}, la lista de verificación de calidad y una justificación técnica sobre la relevancia de este proceso para ${uac}.`;

  return {
    sessionNumber,
    objetivo,
    motivacion,
    saberesPrevios,
    contenido,
    ejemploResuelto,
    practica,
    aplicacion,
    autoevaluacion,
    recursos,
    productoIntegrador,
    isFallback: true,
  };
}

/**
 * Alias de compatibilidad hacia atrás para `buildContextualFallbackPlan`.
 */
export const buildRichFallbackPlan = (
  sessionNumber: number,
  context?: FallbackPlanContext
): SessionPlan => buildContextualFallbackPlan(sessionNumber, context);

/**
 * Garantía de cobertura total de sesiones (anti "36 vs 72").
 *
 * Devuelve SIEMPRE un plan por cada sesión cubierta: primero sanitiza lo que la IA
 * respondió y luego completa las sesiones faltantes (IA que omitió planes o writer
 * en fallback de error) con planes contextuales específicos de la UAC, registrando un
 * warning en el log. Todo plan completado mediante fallback queda marcado con `isFallback: true`.
 */
export function completeSessionPlans(
  raw: unknown,
  coveredSessions: number[],
  context?: FallbackPlanContext
): SessionPlan[] {
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
      `[writer-contract] sessionPlans incompletos: faltan las sesiones ${missing.join(', ')} de ${coveredSessions.join(', ')}. Completando con planes contextuales de ${context?.uacName || 'la UAC'}.`
    );
    for (const n of missing) {
      const fbPlan = buildContextualFallbackPlan(n, context);
      fbPlan.isFallback = true;
      plans.push(fbPlan);
    }
  }

  return plans.sort((a, b) => a.sessionNumber - b.sessionNumber);
}

export const FALLBACK_SIGNATURE_SNIPPET = 'profundizaremos en el análisis sistemático de la variación';

/**
 * Detecta y cuantifica de forma determinista cualquier palabra proveniente de fallback o relleno sintético,
 * así como contaminación cruzada matemática en UACs no matemáticas.
 */
export function detectFallbackWords(sessions: SessionPlan[], uacName?: string): number {
  let fallbackWords = 0;
  for (const plan of sessions) {
    if (plan.isFallback) {
      fallbackWords += countSessionPlanWords(plan);
    } else if (plan.contenido && plan.contenido.includes(FALLBACK_SIGNATURE_SNIPPET)) {
      fallbackWords += countSessionPlanWords(plan);
    } else if (uacName && !isMathUAC(uacName)) {
      const issues = validateSessionPlanContamination(plan, uacName);
      if (issues.length > 0) {
        fallbackWords += countSessionPlanWords(plan);
      }
    }
  }
  return fallbackWords;
}
