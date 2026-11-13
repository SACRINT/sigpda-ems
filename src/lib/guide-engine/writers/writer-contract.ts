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
import type { WriterScheduler } from '../writer-scheduler';
import { countSessionPlanWords } from '../content-budget';
import { isMathUAC, validateSessionPlanContamination } from '../cross-contamination-guard';
import { getDisciplinaryAdapter } from '@/lib/prompts/disciplinary-adapters';
import {
  isUnusableResourceUrl,
  pickCuratedResourceForText,
} from '@/lib/resources/curated-resources';
import { hasGenericContent } from '../quality/no-generic-content';
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
  component?: string;
  curriculumName?: string;
  careerOrProgramName?: string;
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
  /**
   * Términos de la planeación asignados a ESTE redactor (reparto determinista). Se inyectan desde la
   * primera pasada (alineación preventiva) y se reparten entre los paquetes de sesiones.
   */
  requiredTerms?: string[];
  /**
   * Scheduler compartido del job: limita la concurrencia de llamadas de IA, aplica jitter y un
   * circuit breaker común. Si no se provee, las llamadas se ejecutan directamente (compatibilidad).
   */
  scheduler?: WriterScheduler;
  /**
   * Salida previa del redactor en la primera pasada, usada en Fase 8.5 para reparar
   * quirúrgicamente solo las sesiones deficientes sin regenerar toda la narrativa de la misión.
   */
  previousOutput?: WriterOutput;
  /**
   * Mapa (sessionNumber -> términos faltantes) asignado a este redactor en Fase 8.5.
   */
  surgicalSessionTerms?: Map<number, string[]>;
  /**
   * Bloque de contexto institucional SEP (Capa de Conocimiento). Solo dominios
   * metodológico/curricular; se inyecta como referencia, nunca como instrucción.
   * Vacío/undefined cuando `KNOWLEDGE_LAYER_ENABLED=false`.
   */
  institutionalContext?: string;
  /**
   * Marca de tiempo absoluta (epoch ms) límite del presupuesto editorial del job.
   */
  budgetDeadlineMs?: number;
  /**
   * Planes de sesión parciales ya completados para esta misión en intentos previos (checkpoint).
   */
  cachedSessionPlans?: SessionPlan[];
  /**
   * Callback incremental llamado cada vez que se completa un paquete de sesiones en sharding.
   */
  onPartialSessionPlans?: (plans: SessionPlan[]) => void | Promise<void>;
}

/**
 * Calcula los milisegundos restantes respecto a `budgetDeadlineMs` sin caer por debajo de 1 ms.
 */
export function resolveRemainingBudgetMs(budgetDeadlineMs?: number): number | undefined {
  if (typeof budgetDeadlineMs !== 'number' || !Number.isFinite(budgetDeadlineMs)) {
    return undefined;
  }
  return Math.max(1, budgetDeadlineMs - Date.now());
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
  const hasPlaceholders = /\[completar\]|\[escribe aquí\]|\[placeholder\]|\[aquí escribe\]|\[texto\]|\[insertar\]|\[pendiente\]|\[tbd\]|\[\s*\.\.\.\s*\]/i.test(params.content);
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
 * Sustituye recursos de "búsqueda" (Google/YouTube results) por entradas de la
 * biblioteca curada. Nunca deja una sesión sin recurso de ampliación.
 */
export function ensureCuratedResourceList(
  recursos: RecursoItem[],
  context?: FallbackPlanContext
): RecursoItem[] {
  const topic = [context?.uacName, context?.sessionTopic, context?.blockName, context?.component]
    .filter(Boolean)
    .join(' ');

  const buildCurated = (tipo: RecursoItem['tipo'], extra = ''): RecursoItem => {
    const resource = pickCuratedResourceForText(
      `${topic} ${extra}`,
      tipo === 'video' ? 'video' : tipo === 'lectura' ? 'lectura' : 'web'
    );
    return {
      titulo: resource.titulo,
      url: resource.url,
      tipo: resource.tipo === 'video' ? 'video' : resource.tipo === 'lectura' ? 'lectura' : 'web',
    };
  };

  const mapped = recursos.map((recurso) =>
    isUnusableResourceUrl(recurso.url) ? buildCurated(recurso.tipo, recurso.titulo) : recurso
  );

  return mapped.length > 0 ? mapped : [buildCurated('web')];
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
  coveredSessions: number[],
  context?: FallbackPlanContext
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
          return t.length >= 10 ? { enunciado: t, pista: '' } : null;
        }
        if (p && typeof p === 'object') {
          const pr = p as Record<string, unknown>;
          const enunciado = toStudentVoice(asText(pr.enunciado ?? pr.texto ?? pr.tarea));
          if (enunciado.length < 10) return null;
          const solucion = sanitizeSolucion(pr.solucion ?? pr.solution);
          const pistaCruda = asText(pr.pista ?? pr.hint ?? pr.pista_, 5);
          return {
            enunciado,
            pista: pistaCruda,
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

    // Recursos curados: una búsqueda de Google/YouTube no es un recurso didáctico.
    // Se sustituye por una entrada de la biblioteca curada o por el recurso
    // institucional más afín a la UAC/sesión.
    const recursosCurados = ensureCuratedResourceList(recursos, context);

    // Autoevaluación: string[] (nuevo) o un string (heredado evaluacionObjetivo).
    // Nunca se completa con preguntas genéricas: si faltan, el reparador IA debe
    // generarlas o el plan se rechaza antes de publicarse.
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

    // Gate fail-closed: un plan con campos teóricos ausentes NO se rellena con
    // texto genérico. Se descarta aquí para que completeSessionPlans lance
    // IncompleteSessionPlansError y el orquestador reintente al writer.
    const missingCoreFields = [
      !objetivo ? 'objetivo' : null,
      !motivacion ? 'motivacion' : null,
      !saberesPrevios ? 'saberesPrevios' : null,
      !contenido ? 'contenido' : null,
      !ejemploResuelto ? 'ejemploResuelto' : null,
      !aplicacion ? 'aplicacion' : null,
      !productoIntegrador ? 'productoIntegrador' : null,
    ].filter((field): field is string => field !== null);

    if (missingCoreFields.length > 0) {
      logger.warn(
        `[writer-contract] Sesión ${sessionNumber} descartada: faltan campos teóricos reales (${missingCoreFields.join(', ')}). ` +
          'No se inyecta relleno genérico; se fuerza reintento del writer.'
      );
      continue;
    }

    const plan: SessionPlan = {
      sessionNumber,
      objetivo,
      motivacion,
      saberesPrevios,
      contenido,
      ejemploResuelto,
      practica,
      aplicacion,
      autoevaluacion,
      recursos: recursosCurados,
      productoIntegrador,
      isFallback: rec.isFallback === true,
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
  component?: string;
  curriculumName?: string;
  careerOrProgramName?: string;
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
  const adapter = getDisciplinaryAdapter(
    uac,
    context?.component,
    context?.curriculumName || context?.careerOrProgramName
  );
  const discipline = adapter.displayName;
  const equipment = adapter.allowedPhysicalEquipment.slice(0, 4).join(', ');
  const digitalTools = adapter.allowedDigitalTools.slice(0, 3).join(', ');

  const objetivo = mathUac
    ? `Al término de la sesión ${sessionNumber}, serás capaz de modelar e interpretar los procesos cuantitativos de ${topic} en el marco de ${uac}, aplicando el razonamiento formal y procedimental correspondiente.`
    : `Al término de la sesión ${sessionNumber}, serás capaz de analizar y aplicar los principios, procedimientos y criterios de ${topic} en el marco formativo de ${uac} (${discipline}), vinculando las destrezas de la disciplina con las necesidades del entorno escolar y comunitario.`;

  const motivacion = mathUac
    ? `En nuestra región y comunidad escolar, el análisis riguroso de problemáticas situadas requiere herramientas matemáticas para modelar comportamientos dinámicos vinculados a ${paec}. En esta sesión ${sessionNumber}, explorarás cómo los métodos formales permiten tomar decisiones fundamentadas.`
    : `En la comunidad escolar y su entorno regional, las actividades vinculadas a ${uac} demandan un dominio riguroso de ${topic}. Desarrollar habilidades propias de ${discipline} permite responder con precisión, pertinencia y responsabilidad a las problemáticas identificadas en ${paec}, aprovechando recursos como ${equipment || 'los materiales pertinentes de la disciplina'}.`;

  const saberesPrevios = mathUac
    ? `Antes de iniciar, reflexiona sobre lo estudiado en las sesiones previas respecto a las magnitudes y relaciones funcionales: ¿cómo identificas las variables clave de un problema y qué representaciones permiten analizar su comportamiento con exactitud?`
    : `Antes de comenzar las actividades de la sesión ${sessionNumber}, reflexiona en tu cuaderno sobre tus experiencias previas y conocimientos adquiridos: ¿qué saberes de ${uac} se relacionan con ${topic}? ¿Qué criterios de la disciplina deben verificarse antes de dar por aceptado un producto, procedimiento o argumento? ¿Qué recursos o herramientas de ${discipline} necesitas preparar? Redacta tus notas iniciales.`;

  const contenido = mathUac
    ? `En esta sesión ${sessionNumber}, profundizaremos en los fundamentos conceptuales de ${topic}. Cuando estudiamos fenómenos en el contexto real, analizamos interacciones cuantitativas donde las relaciones estructuradas permiten proyectar tendencias y evaluar alternativas de solución sustentables.\n\nEl tratamiento riguroso de los datos exige delimitar claramente las condiciones de frontera y las restricciones contextuales del problema, asegurando que cada representación gráfica, tabular o analítica mantenga coherencia lógica y pertinencia comunitaria.\n\nAl integrar estos saberes, fortaleces tu pensamiento reflexivo y capacidad de argumentación fundamentada en beneficio del entorno escolar.`
    : `En esta sesión ${sessionNumber}, profundizaremos en los fundamentos, criterios y secuencias de trabajo que caracterizan a ${topic} dentro de ${uac}. El enfoque de ${discipline} exige comprender el propósito formativo de cada actividad, seleccionar los recursos pertinentes y aplicar criterios de calidad coherentes con la disciplina.\n\nEl desarrollo ordenado de cada actividad implica fases claramente delimitadas: la preparación del espacio y de los recursos, la revisión de las condiciones iniciales, la ejecución metódica de la actividad y la verificación de los resultados. Omitir cualquiera de estas fases incrementa el riesgo de errores, retrabajos o conclusiones poco fundamentadas.\n\nAsimismo, el trabajo en ${uac} exige considerar el impacto social y formativo de lo que produces. El uso eficiente de los recursos, la documentación del proceso y la comunicación clara de los resultados reflejan un compromiso ético con el aprendizaje y con la comunidad. Puedes apoyarte en ${equipment || 'los materiales pertinentes'} y en ${digitalTools || 'herramientas digitales de consulta verificada'}.`;

  const ejemploResuelto = mathUac
    ? `Planteamiento del Caso: Un equipo escolar analiza datos cuantitativos relacionados con ${topic} en el contexto de ${paec}.\n\nPaso 1: Identificación de variables y parámetros observables.\nPaso 2: Registro estructurado y formulación de relaciones iniciales.\nPaso 3: Desarrollo procedimental paso a paso contrastando hipótesis.\nPaso 4: Interpretación cualitativa y cuantitativa de los resultados obtenidos para la toma de decisiones comunitarias.`
    : `Planteamiento del Caso: Un equipo de trabajo analiza una situación real vinculada a ${topic} en el contexto de ${uac} y ${paec}.\n\nPaso 1: Delimitación del caso y de los criterios de trabajo propios de ${discipline}.\nPaso 2: Selección de recursos, fuentes o instrumentos pertinentes y verificación de sus condiciones.\nPaso 3: Desarrollo ordenado de la actividad, registrando decisiones, datos y evidencias parciales.\nPaso 4: Verificación de resultados, identificación de mejoras y comunicación de conclusiones con argumentos claros.`;

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
          enunciado: `Ejercicio 1: Elabora un esquema o diagrama de proceso para abordar ${topic} en ${uac}, detallando cuatro pasos de trabajo y los criterios de revisión propios de ${discipline}.`,
          pista: `Revisa la secuencia desde la preparación de los recursos hasta la verificación final y el registro de evidencias.`,
          solucion: [
            'Paso 1: Preparación del espacio, los recursos y las condiciones iniciales.',
            'Paso 2: Selección y revisión de los instrumentos o fuentes pertinentes.',
            'Paso 3: Ejecución ordenada de la actividad siguiendo los criterios de la disciplina.',
            'Paso 4: Verificación de resultados y registro de conclusiones en la bitácora.',
          ],
        },
        {
          enunciado: `Ejercicio 2: Identifica dos dificultades frecuentes que pueden presentarse al trabajar ${topic} en ${uac}, explica su causa y propone una acción preventiva.`,
          pista: `Considera errores de interpretación, selección inadecuada de recursos, omisión de pasos o falta de verificación de resultados.`,
          solucion: [
            'Dificultad A: Interpretación incompleta de la consigna; corrección: releer el propósito y los criterios de la actividad.',
            'Dificultad B: Verificación insuficiente del resultado; corrección: aplicar una lista de cotejo antes de entregar.',
            'Conclusión: La revisión sistemática mejora la calidad de la evidencia y evita retrabajos.',
          ],
        },
      ];

  const aplicacion = mathUac
    ? `Aplica los principios analizados a una problemática real de tu entorno escolar: recolecta datos cuantitativos sobre el uso de recursos y elabora una propuesta fundamentada para optimizar su distribución en ${paec}.`
    : `Aplica lo analizado a tu entorno escolar o comunitario: observa una situación relacionada con ${topic}, registra evidencias y elabora una propuesta de mejora fundamentada en los criterios de ${uac}. Vincula tu propuesta con ${paec} y explica su utilidad para la comunidad.`;

  const autoevaluacion = mathUac
    ? [
        `¿Puedo explicar con claridad y rigor formal los conceptos abordados en esta sesión?`,
        `¿Fui capaz de resolver los ejercicios de análisis de manera ordenada y autónoma?`,
        `¿Registré las evidencias, desarrollos y conclusiones en mi cuaderno de trabajo activo con fecha formal?`,
      ]
    : [
        `¿Comprendo el propósito y los criterios de la actividad realizada en ${topic}?`,
        `¿Puedo justificar las decisiones y los recursos que utilicé conforme a la disciplina?`,
        `¿Registré observaciones, evidencias y conclusiones con claridad y orden?`,
      ];

  const recursos: RecursoItem[] = [
    {
      titulo: `Guía formativa y criterios académicos aplicables a ${uac}`,
      url: `https://educacionmediasuperior.sep.gob.mx`,
      tipo: `web`,
    },
    {
      titulo: `Recursos de consulta y buenas prácticas para ${discipline}`,
      url: `https://www.gob.mx/sep`,
      tipo: `web`,
    },
  ];

  const productoIntegrador = `Para tu portafolio y proyecto comunitario PAEC (${paec}), elabora la ficha de la sesión ${sessionNumber}: incluye el reporte de actividades de ${topic}, la lista de verificación de calidad y una justificación sobre la relevancia de este proceso para ${uac}.`;

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
 * Error fail-closed: la IA no devolvió un plan real para cada sesión cubierta.
 * El orquestador debe reintentar el writer; nunca debe persistir un bloque incompleto.
 */
export class IncompleteSessionPlansError extends Error {
  readonly missingSessions: number[];
  readonly coveredSessions: number[];

  constructor(missingSessions: number[], coveredSessions: number[], uacName?: string) {
    super(
      `sessionPlans incompletos para ${uacName || 'la UAC'}: faltan las sesiones ${missingSessions.join(', ')} de ${coveredSessions.join(', ')}. No se permite relleno sintético.`
    );
    this.name = 'IncompleteSessionPlansError';
    this.missingSessions = missingSessions;
    this.coveredSessions = coveredSessions;
  }
}

/**
 * Garantía de cobertura total de sesiones SIN relleno sintético.
 *
 * Sanitiza y deduplica los planes reales de la IA. Si falta una sola sesión,
 * lanza `IncompleteSessionPlansError` para que el orquestador reintente el writer
 * o falle antes de persistir. No completa sesiones con contenido de contingencia.
 */
export function completeSessionPlans(
  raw: unknown,
  coveredSessions: number[],
  context?: FallbackPlanContext
): SessionPlan[] {
  if (coveredSessions.length === 0) return [];

  const sanitized = sanitizeSessionPlans(raw, coveredSessions, context) ?? [];

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
    logger.error(
      `[writer-contract] sessionPlans incompletos: faltan las sesiones ${missing.join(', ')} de ${coveredSessions.join(', ')}. Se aborta el bloque para reintentar sin fallback.`
    );
    throw new IncompleteSessionPlansError(missing, coveredSessions, context?.uacName);
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
    // La detección es por contenido, no solo por la bandera isFallback: un plan
    // puede traer texto de contingencia sin estar marcado y aun así ser genérico.
    if (plan.isFallback || hasGenericContent(plan)) {
      fallbackWords += countSessionPlanWords(plan);
      continue;
    }
    if (plan.contenido && plan.contenido.includes(FALLBACK_SIGNATURE_SNIPPET)) {
      fallbackWords += countSessionPlanWords(plan);
      continue;
    }
    if (uacName && !isMathUAC(uacName)) {
      const issues = validateSessionPlanContamination(plan, uacName);
      if (issues.length > 0) {
        fallbackWords += countSessionPlanWords(plan);
      }
    }
  }
  return fallbackWords;
}
