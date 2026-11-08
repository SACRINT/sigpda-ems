import type { KeyActivityPlan, SecuenciaBloque, SecuenciaSesion } from '@/types/planning';
import { mapActivityIndexToBlockIndex } from '@/lib/curricular-blocks';
import { sugerirInstrumentoParaEvidencia } from '@/lib/catalogo-instrumentos';

export interface PartitionedActivitySessions {
  /** Índice 0-based del bloque curricular (0, 1 o 2 -> Corte 1, 2 o 3) */
  blockIndex: number;
  /** Número 1-based de la actividad dentro de su bloque curricular */
  activityNumberInBlock: number;
  /** Total de actividades asignadas a este mismo bloque curricular */
  totalActivitiesInBlock: number;
  /** Horas asignadas a la actividad */
  activityHours: number;
  /** Total de sesiones del bloque curricular completo */
  totalBlockSessions: number;
  /** Rebanada exacta de micro-sesiones que corresponden a esta actividad */
  sessions: SecuenciaSesion[];
}

interface ActivityMilestone {
  title: string;
  teachingActivity: string;
  learningActivity: string;
  evidence: string;
}

const ACTIVITY_APERTURA_MILESTONES: readonly ActivityMilestone[] = [
  {
    title: 'Exploración Diagnóstica y Problematización Situada',
    teachingActivity: 'Presentación del detonador situado y activación de saberes previos con preguntas generadoras.',
    learningActivity: 'Análisis de la situación problematizadora, lluvia de ideas estructurada y planteamiento de hipótesis.',
    evidence: 'Cuestionario diagnóstico y mapa conceptual de saberes previos',
  },
  {
    title: 'Recuperación de Saberes y Delimitación del Reto',
    teachingActivity: 'Modelado metodológico para delimitar las variables del problema y su vínculo con el contexto local.',
    learningActivity: 'Identificación de datos, variables críticas y acuerdos de trabajo colaborativo en equipo.',
    evidence: 'Matriz de contextualización y ruta de trabajo del propósito',
  },
  {
    title: 'Indagación Inicial y Encuadre Conceptual',
    teachingActivity: 'Orientación en la consulta de fuentes y conceptos fundamentales de la unidad.',
    learningActivity: 'Exploración documental y registro de conceptos clave aplicables al reto comunitario.',
    evidence: 'Ficha de registro conceptual y marco de referencia inicial',
  },
];

const ACTIVITY_DESARROLLO_MILESTONES: readonly ActivityMilestone[] = [
  {
    title: 'Fundamentación Teórica y Análisis de Variables',
    teachingActivity: 'Explicación dialogada de los principios disciplinares y modelado de relaciones entre conceptos.',
    learningActivity: 'Análisis conceptual, deducción de propiedades y resolución de ejercicios introductorios.',
    evidence: 'Reporte de análisis conceptual y ejercicios guiados resueltos',
  },
  {
    title: 'Modelado Metodológico y Procedimientos Clave',
    teachingActivity: 'Demostración paso a paso del procedimiento analítico, gráfico o técnico en plenaria.',
    learningActivity: 'Práctica guiada en pares replicando el método y verificando cada paso operativo.',
    evidence: 'Memoria de cálculo, procedimiento paso a paso o esquema técnico',
  },
  {
    title: 'Aplicación Práctica en Situaciones Contextuales',
    teachingActivity: 'Mediación docente en la traducción de problemas reales del entorno al lenguaje disciplinar.',
    learningActivity: 'Resolución colaborativa de problemas contextualizados con datos de la comunidad.',
    evidence: 'Problemario o reporte de casos contextualizados resueltos',
  },
  {
    title: 'Representación Gráfica, Tabular o Experimental',
    teachingActivity: 'Asesoría en la construcción de tablas, trazos geométricos, gráficas o pruebas experimentales.',
    learningActivity: 'Elaboración de representaciones gráficas, trazos de precisión o registros experimentales.',
    evidence: 'Lámina gráfica, tabulación comparativa o bitácora de práctica',
  },
  {
    title: 'Contraste de Métodos y Verificación de Resultados',
    teachingActivity: 'Guía en la comparación de rutas de solución y comprobación cruzada de resultados.',
    learningActivity: 'Validación analítica y gráfica de las soluciones obtenidas e identificación de errores.',
    evidence: 'Matriz de comprobación y contraste de métodos de solución',
  },
  {
    title: 'Construcción del Producto o Prototipo de la Unidad',
    teachingActivity: 'Acompañamiento técnico en la integración de los hallazgos para estructurar la evidencia.',
    learningActivity: 'Desarrollo colaborativo del producto, modelo o reporte técnico del propósito formativo.',
    evidence: 'Avance estructurado del producto o reporte técnico de la actividad',
  },
  {
    title: 'Revisión Cruzada y Retroalimentación entre Pares',
    teachingActivity: 'Moderación de la revisión técnica entre equipos utilizando criterios de calidad.',
    learningActivity: 'Coevaluación constructiva de borradores/modelos y ajuste de observaciones detectadas.',
    evidence: 'Registro de coevaluación entre pares y correcciones aplicadas',
  },
  {
    title: 'Optimización y Consolidación de la Evidencia',
    teachingActivity: 'Asesoría focalizada para perfeccionar la precisión técnica y argumentativa del entregable.',
    learningActivity: 'Refinamiento final de cálculos, gráficas, trazos o argumentos del producto de la unidad.',
    evidence: 'Versión depurada y validada de la evidencia formativa',
  },
];

const ACTIVITY_CIERRE_MILESTONES: readonly ActivityMilestone[] = [
  {
    title: 'Socialización de Hallazgos y Defensa de Soluciones',
    teachingActivity: 'Coordinación de la plenaria de presentación de resultados y cuestionamiento socrático de cierre.',
    learningActivity: 'Exposición argumentada de la solución o producto construido y defensa ante el grupo.',
    evidence: 'Presentación de resultados y evidencia integradora del propósito concluida',
  },
  {
    title: 'Evaluación Formativa, Síntesis y Metacognición',
    teachingActivity: 'Retroalimentación formativa integral, cierre conceptual de la unidad y guía metacognitiva.',
    learningActivity: 'Aplicación del instrumento de evaluación, reflexión metacognitiva y entrega final de evidencia.',
    evidence: 'Evidencia final evaluada y bitácora de reflexión metacognitiva de la actividad',
  },
  {
    title: 'Balance de Logros y Transferencia Comunitaria',
    teachingActivity: 'Cierre pedagógico vinculando los aprendizajes consolidados con el proyecto PAEC.',
    learningActivity: 'Autoevaluación de los tres saberes y registro de transferencia al contexto comunitario.',
    evidence: 'Formato de autoevaluación y conclusiones de transferencia comunitaria',
  },
];

const ORCHESTRATOR_MILESTONE_PREFIXES = [
  'exploracion diagnostica y problematizacion situada',
  'recuperacion de saberes y delimitacion del reto',
  'organizacion de equipos y ruta de trabajo',
  'indagacion inicial y marco de referencia',
  'fundamentacion teorica y analisis de variables',
  'modelado metodologico y procedimientos clave',
  'diseno preliminar y bosquejo del artefacto',
  'presupuestacion y seleccion de recursos',
  'experimentacion y prueba de parametros',
  'construccion y ensamblaje del prototipo',
  'aplicacion de principios disciplinares y ajuste de parametros',
  'validacion tecnica y pruebas de funcionamiento',
  'analisis de rendimiento y ajuste de tolerancias',
  'integracion socioproductiva y pertinencia local',
  'sistematizacion de datos y analisis de tendencias',
  'documentacion tecnica y manual operativo',
  'revision cruzada y coevaluacion inter-equipos',
  'refinamiento e iteracion del artefacto',
  'prueba de esfuerzo y validacion de calidad',
  'integracion final del producto y acabados',
  'estructuracion de la memoria del proyecto',
  'diseno de recursos y medios de divulgacion',
  'ensayo general de demostracion practica',
  'verificacion integral de entregables y cierre tecnico',
  'socializacion comunitaria y demostracion integral',
  'evaluacion formativa y coevaluacion del impacto',
  'sintesis metacognitiva y plan de transferencia',
  'cierre institucional y registro de logros',
];

function normalizeForMatch(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function isOrchestratorBoilerplateTitle(title: string): boolean {
  const norm = normalizeForMatch(title).replace(/^sesion\s+\d+\s*:\s*/, '');
  return ORCHESTRATOR_MILESTONE_PREFIXES.some((prefix) => norm.startsWith(prefix));
}

function extractActivitySubtopics(activity?: KeyActivityPlan): string[] {
  const raw = activity?.contenidoFormativo || activity?.name || '';
  const cleaned = raw
    .replace(/^(bloque|prop[oó]sito|progresi[oó]n|unidad|actividad)\s*[\d,\sy.:\-–—]+/i, '')
    .trim();
  const parts = cleaned
    .split(/[,;·•\n]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 3);
  return parts.length > 0 ? parts : cleaned ? [cleaned] : [];
}

/**
 * Calcula de forma determinista el número de sesiones de Apertura, Desarrollo y Cierre
 * que le corresponden a una actividad individual de `totalActivitySessions` horas/sesiones.
 *
 * Garantiza que toda actividad con >= 3 sesiones tenga su ciclo didáctico completo:
 * Inicio (Apertura) + Desarrollo + Cierre.
 */
export function computeActivityPhaseCounts(totalActivitySessions: number): {
  aperturaCount: number;
  desarrolloCount: number;
  cierreCount: number;
} {
  if (totalActivitySessions <= 0) {
    return { aperturaCount: 0, desarrolloCount: 0, cierreCount: 0 };
  }
  if (totalActivitySessions === 1) {
    return { aperturaCount: 1, desarrolloCount: 0, cierreCount: 0 };
  }
  if (totalActivitySessions === 2) {
    return { aperturaCount: 1, desarrolloCount: 0, cierreCount: 1 };
  }

  let aperturaCount = 1;
  let cierreCount = 1;

  if (totalActivitySessions >= 16) {
    aperturaCount = 3;
    cierreCount = 3;
  } else if (totalActivitySessions >= 8) {
    aperturaCount = 2;
    cierreCount = 2;
  }

  const desarrolloCount = Math.max(1, totalActivitySessions - aperturaCount - cierreCount);
  return { aperturaCount, desarrolloCount, cierreCount };
}

/**
 * Calibra las sesiones asignadas a una actividad para garantizar:
 * 1. Que cada actividad tenga su propio ciclo completo de Apertura, Desarrollo y Cierre.
 * 2. Que si las sesiones provenían de la plantilla genérica de bloque completo (donde se
 *    mezclaban temas de otras actividades del mismo bloque o quedaban sesiones de cierre con
 *    etiquetas de desarrollo), sus títulos, actividades y evaluación queden 100% alineados
 *    con los contenidos, saberes e instrumentos específicos de esta actividad.
 */
export function calibrateActivitySessions(
  rawSessions: readonly SecuenciaSesion[],
  activity: KeyActivityPlan | undefined,
  activityIndex: number
): SecuenciaSesion[] {
  const count = rawSessions.length;
  if (count === 0) return [];

  const { aperturaCount, cierreCount } = computeActivityPhaseCounts(count);
  const subtopics = extractActivitySubtopics(activity);
  const actTheme =
    subtopics[0] ||
    (activity?.name || `Actividad ${activityIndex + 1}`)
      .replace(/^(bloque|prop[oó]sito|progresi[oó]n|unidad|actividad)\s*[\d,\sy.:\-–—]+/i, '')
      .trim();

  const saberFocus = activity?.saberes?.saber?.replace(/\.$/, '') || '';
  const hacerFocus = activity?.saberes?.saberHacer?.replace(/\.$/, '') || '';
  const serFocus = activity?.saberes?.saberSer?.replace(/\.$/, '') || '';
  const metLabel = activity?.methodology ? ` (${activity.methodology})` : '';

  const aperturaPlan = activity?.apertura?.activities?.trim() || '';
  const ejecucionPlan = activity?.ejecucion?.activities?.trim() || '';
  const conclusionPlan = activity?.conclusion?.activities?.trim() || '';

  return rawSessions.map((s, localIdx) => {
    let canonicalPhase: 'Apertura' | 'Desarrollo' | 'Cierre' = 'Desarrollo';
    if (localIdx < aperturaCount) {
      canonicalPhase = 'Apertura';
    } else if (localIdx >= count - cierreCount) {
      canonicalPhase = 'Cierre';
    }

    const isBoilerplate = isOrchestratorBoilerplateTitle(s.title);
    if (!isBoilerplate) {
      return {
        ...s,
        phase: canonicalPhase,
      };
    }

    const subTopic = subtopics[localIdx % Math.max(1, subtopics.length)] || actTheme;
    const titleSuffix = subTopic ? ` — ${subTopic}` : '';

    if (canonicalPhase === 'Apertura') {
      const m = ACTIVITY_APERTURA_MILESTONES[localIdx % ACTIVITY_APERTURA_MILESTONES.length];
      const inst = sugerirInstrumentoParaEvidencia({
        evidencia: m.evidence,
        actividadNombre: activity?.name,
        contenidoFormativo: activity?.contenidoFormativo,
        metodologia: activity?.methodology,
        momento: 'apertura',
        indiceRotacion: activityIndex + localIdx,
      });

      return {
        ...s,
        phase: 'Apertura',
        title: `Sesión ${s.sessionNum}: ${m.title}${titleSuffix}`,
        teachingActivity: `${m.teachingActivity} Enfoque en ${subTopic || actTheme}${aperturaPlan ? `. ${aperturaPlan}` : ''}.`,
        learningActivity: `${m.learningActivity}${saberFocus ? ` Vinculación con el saber: ${saberFocus}.` : ''}`,
        evidence: m.evidence,
        evaluation: inst.nombreCorto,
      };
    }

    if (canonicalPhase === 'Cierre') {
      const cierreLocalIdx = Math.max(0, localIdx - (count - cierreCount));
      const m = ACTIVITY_CIERRE_MILESTONES[cierreLocalIdx % ACTIVITY_CIERRE_MILESTONES.length];
      const inst = sugerirInstrumentoParaEvidencia({
        evidencia: conclusionPlan || m.evidence,
        actividadNombre: activity?.name,
        contenidoFormativo: activity?.contenidoFormativo,
        metodologia: activity?.methodology,
        momento: 'cierre',
        agente: cierreLocalIdx === 0 ? 'Coevaluación' : 'Heteroevaluación',
        indiceRotacion: activityIndex + cierreLocalIdx,
      });

      return {
        ...s,
        phase: 'Cierre',
        title: `Sesión ${s.sessionNum}: ${m.title}${titleSuffix}`,
        teachingActivity: `${m.teachingActivity} Cierre formativo sobre ${actTheme}${conclusionPlan ? `: ${conclusionPlan}` : ''}.`,
        learningActivity: `${m.learningActivity}${serFocus ? ` Reflexión actitudinal: ${serFocus}.` : ''}`,
        evidence: `${m.evidence} (${inst.nombreCorto})`,
        evaluation: inst.nombre,
      };
    }

    // Fase de Desarrollo
    const desLocalIdx = Math.max(0, localIdx - aperturaCount);
    const m = ACTIVITY_DESARROLLO_MILESTONES[desLocalIdx % ACTIVITY_DESARROLLO_MILESTONES.length];
    const inst = sugerirInstrumentoParaEvidencia({
      evidencia: ejecucionPlan || m.evidence,
      actividadNombre: activity?.name,
      contenidoFormativo: subTopic || activity?.contenidoFormativo,
      metodologia: activity?.methodology,
      momento: 'desarrollo',
      indiceRotacion: activityIndex + desLocalIdx,
    });

    return {
      ...s,
      phase: 'Desarrollo',
      title: `Sesión ${s.sessionNum}: ${m.title}${titleSuffix}`,
      teachingActivity: `${m.teachingActivity} Mediación sobre ${subTopic || actTheme}${metLabel}.`,
      learningActivity: `${m.learningActivity} Práctica activa sobre ${subTopic || actTheme}${hacerFocus ? `: ${hacerFocus}.` : '.'}`,
      evidence: m.evidence,
      evaluation: inst.nombreCorto,
    };
  });
}

/**
 * Particiona de forma determinista un arreglo de sesiones entre un grupo de actividades
 * proporcionalmente a sus horas, usando fronteras acumuladas redondeadas para garantizar
 * matemáticamente cero traslapes, cero huecos y conservación del 100% de las sesiones.
 */
function sliceSessionsByCumulativeHours(
  poolSessions: readonly SecuenciaSesion[],
  groupActivities: readonly KeyActivityPlan[],
  positionInGroup: number
): SecuenciaSesion[] {
  const totalSessions = poolSessions.length;
  const groupSize = groupActivities.length;
  if (totalSessions === 0 || groupSize === 0 || positionInGroup < 0 || positionInGroup >= groupSize) {
    return [];
  }

  if (groupSize === 1) {
    return [...poolSessions];
  }

  const weights = groupActivities.map((act) => {
    const h = Number(act?.hours);
    return Number.isFinite(h) && h > 0 ? h : 1;
  });
  const totalWeight = weights.reduce((acc, w) => acc + w, 0);

  let cumPrev = 0;
  for (let i = 0; i < positionInGroup; i++) {
    cumPrev += weights[i];
  }
  const cumCurr = cumPrev + weights[positionInGroup];

  const startIdx = Math.round((cumPrev / totalWeight) * totalSessions);
  const endIdx = positionInGroup === groupSize - 1
    ? totalSessions
    : Math.round((cumCurr / totalWeight) * totalSessions);

  return poolSessions.slice(startIdx, Math.max(startIdx, endIdx));
}

/**
 * Obtiene de forma determinista y universal las micro-sesiones exactas que le
 * corresponden a una actividad/propósito/progresión específica dentro de su bloque curricular,
 * garantizando que cada actividad cuente con su propio ciclo trifásico de
 * Apertura (Inicio), Desarrollo y Cierre.
 */
export function getSessionsForActivity(
  activityIndex: number,
  activities: readonly KeyActivityPlan[] | null | undefined,
  sequenceData?: Record<number, SecuenciaBloque> | null
): PartitionedActivitySessions {
  const safeActivities = Array.isArray(activities) ? activities : [];
  const totalActs = safeActivities.length;

  if (totalActs === 0 || activityIndex < 0 || activityIndex >= totalActs) {
    return {
      blockIndex: 0,
      activityNumberInBlock: 1,
      totalActivitiesInBlock: 0,
      activityHours: 0,
      totalBlockSessions: 0,
      sessions: [],
    };
  }

  const currentAct = safeActivities[activityIndex];
  const bIdx = mapActivityIndexToBlockIndex(activityIndex, totalActs, currentAct?.corte);

  // Agrupar actividades por bloque (0, 1, 2)
  const actsByBlock: { act: KeyActivityPlan; origIndex: number }[][] = [[], [], []];
  safeActivities.forEach((a, i) => {
    const block = mapActivityIndexToBlockIndex(i, totalActs, a?.corte);
    const clamped = Math.min(2, Math.max(0, block));
    actsByBlock[clamped].push({ act: a, origIndex: i });
  });

  const actsInSameBlock = actsByBlock[bIdx] || [];
  const positionInBlock = Math.max(0, actsInSameBlock.findIndex((item) => item.origIndex === activityIndex));
  const totalInBlock = actsInSameBlock.length;
  const currentActHours = Number(currentAct?.hours) > 0 ? Number(currentAct.hours) : 0;

  if (!sequenceData || typeof sequenceData !== 'object') {
    return {
      blockIndex: bIdx,
      activityNumberInBlock: positionInBlock + 1,
      totalActivitiesInBlock: totalInBlock,
      activityHours: currentActHours,
      totalBlockSessions: 0,
      sessions: [],
    };
  }

  // Verificar si algún bloque en sequenceData tiene sesiones pero 0 actividades asignadas (ej. N = 1 o N = 2)
  const sequenceKeys = Object.keys(sequenceData)
    .map((k) => Number(k))
    .filter((k) => Number.isFinite(k))
    .sort((a, b) => a - b);

  const hasOrphanBlockWithSessions = sequenceKeys.some((k) => {
    const seqSessions = sequenceData[k]?.sessions;
    if (!Array.isArray(seqSessions) || seqSessions.length === 0) return false;
    if (k < 0 || k > 2) return true;
    return actsByBlock[k].length === 0;
  });

  if (hasOrphanBlockWithSessions) {
    const allPooledSessions: SecuenciaSesion[] = [];
    for (const k of sequenceKeys) {
      const sList = sequenceData[k]?.sessions;
      if (Array.isArray(sList) && sList.length > 0) {
        allPooledSessions.push(...sList);
      }
    }

    const assigned = sliceSessionsByCumulativeHours(allPooledSessions, safeActivities, activityIndex);
    const calibrated = calibrateActivitySessions(assigned, currentAct, activityIndex);
    return {
      blockIndex: bIdx,
      activityNumberInBlock: positionInBlock + 1,
      totalActivitiesInBlock: totalInBlock,
      activityHours: currentActHours || calibrated.length,
      totalBlockSessions: allPooledSessions.length,
      sessions: calibrated,
    };
  }

  const blockSeq = sequenceData[bIdx];
  const blockSessions = Array.isArray(blockSeq?.sessions) ? blockSeq.sessions : [];

  if (blockSessions.length === 0) {
    return {
      blockIndex: bIdx,
      activityNumberInBlock: positionInBlock + 1,
      totalActivitiesInBlock: totalInBlock,
      activityHours: currentActHours,
      totalBlockSessions: 0,
      sessions: [],
    };
  }

  const groupActs = actsInSameBlock.map((item) => item.act);
  const assignedSessions = sliceSessionsByCumulativeHours(blockSessions, groupActs, positionInBlock);
  const calibratedSessions = calibrateActivitySessions(assignedSessions, currentAct, activityIndex);

  return {
    blockIndex: bIdx,
    activityNumberInBlock: positionInBlock + 1,
    totalActivitiesInBlock: totalInBlock,
    activityHours: currentActHours || calibratedSessions.length,
    totalBlockSessions: blockSessions.length,
    sessions: calibratedSessions,
  };
}

export interface ActivitySessionSlice {
  activityIndex: number;
  activityNumberInBlock: number;
  totalActivitiesInBlock: number;
  activityHours: number;
  totalBlockSessions: number;
  sessions: SecuenciaSesion[];
}

/**
 * Particiona y calibra las sesiones de un SecuenciaBloque entre las actividades que
 * pertenecen a ese bloque curricular, garantizando que cada actividad tenga su propio
 * ciclo de Apertura (Inicio), Desarrollo y Cierre y sus subtemas e instrumentos específicos.
 */
export function partitionBlockSessionsByActivities(
  blockSeq: SecuenciaBloque | null | undefined,
  blockActivities: readonly KeyActivityPlan[] | null | undefined
): ActivitySessionSlice[] {
  const safeActs = Array.isArray(blockActivities) ? blockActivities : [];
  const rawSessions = Array.isArray(blockSeq?.sessions) ? blockSeq.sessions : [];

  if (rawSessions.length === 0) {
    return [];
  }

  if (safeActs.length === 0) {
    return [
      {
        activityIndex: 0,
        activityNumberInBlock: 1,
        totalActivitiesInBlock: 1,
        activityHours: rawSessions.length,
        totalBlockSessions: rawSessions.length,
        sessions: calibrateActivitySessions(rawSessions, undefined, 0),
      },
    ];
  }

  return safeActs.map((act, idx) => {
    const assigned = sliceSessionsByCumulativeHours(rawSessions, safeActs, idx);
    const calibrated = calibrateActivitySessions(assigned, act, idx);
    return {
      activityIndex: idx,
      activityNumberInBlock: idx + 1,
      totalActivitiesInBlock: safeActs.length,
      activityHours: Number(act?.hours) > 0 ? Number(act.hours) : calibrated.length,
      totalBlockSessions: rawSessions.length,
      sessions: calibrated,
    };
  });
}
