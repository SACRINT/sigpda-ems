/**
 * Session Progression Engine (Motor de Desglose Pedagógico de Sesiones)
 * SIGPDA-EMS · DBEPA Puebla MCCEMS 2026-2027
 *
 * Transforma un bloque o actividad clave (con N horas/sesiones de 50 min)
 * en una secuencia progresiva coherente con momentos didácticos (Apertura, Desarrollo, Cierre),
 * títulos situados y descripciones claras de lo que se construye en cada sesión.
 */

import type { KeyActivityPlan, SecuenciaBloque } from '@/types/planning';

export interface DetailedSession {
  sessionNum: number;
  totalSessions: number;
  activityIndex: number;
  activityName: string;
  phase: 'Apertura' | 'Desarrollo' | 'Cierre';
  phaseColor: {
    bg: string;
    text: string;
    border: string;
  };
  title: string;
  description: string;
  focus: string;
  teachingActivity?: string;
  learningActivity?: string;
  evidence?: string;
  evaluation?: string;
}

const PHASE_STYLES = {
  Apertura: {
    bg: 'rgba(59, 130, 246, 0.15)',
    text: '#60a5fa',
    border: 'rgba(59, 130, 246, 0.35)',
  },
  Desarrollo: {
    bg: 'rgba(245, 158, 11, 0.15)',
    text: '#fbbf24',
    border: 'rgba(245, 158, 11, 0.35)',
  },
  Cierre: {
    bg: 'rgba(16, 185, 129, 0.15)',
    text: '#34d399',
    border: 'rgba(16, 185, 129, 0.35)',
  },
};

/**
 * Limpia y separa los contenidos formativos en tópicos discretos
 */
function extractSubtopics(rawContent?: string): string[] {
  if (!rawContent || rawContent.trim().length === 0) return [];

  // Dividir por comas, punto y coma o conectores comunes
  const rawParts = rawContent
    .split(/[,;•\n]|(?:\s+y\s+(?=[A-ZÁÉÍÓÚ]))/gi)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);

  // Limpiar prefijos comunes como "Concepto de", "Temas:", etc.
  return rawParts.map((part) =>
    part.replace(/^(concepto de|análisis de|estudio de|temas?:\s*)/i, '').trim()
  );
}

/**
 * Genera la secuencia detallada de sesiones para una actividad/bloque
 */
export function generateBlockSessions(
  activity: KeyActivityPlan,
  activityIndex: number,
  totalHours?: number,
  learningOutcome?: string,
  isLaboral: boolean = false,
  savedSequence?: SecuenciaBloque | null
): DetailedSession[] {
  // Si ya existe una secuencia guardada en sequence_json con IA o editada por el docente, usarla directamente
  if (savedSequence && Array.isArray(savedSequence.sessions) && savedSequence.sessions.length > 0) {
    return savedSequence.sessions.map((s) => ({
      sessionNum: s.sessionNum,
      totalSessions: savedSequence.sessions.length,
      activityIndex,
      activityName: activity.name,
      phase: s.phase,
      phaseColor: PHASE_STYLES[s.phase] || PHASE_STYLES.Desarrollo,
      title: s.title,
      teachingActivity: s.teachingActivity,
      learningActivity: s.learningActivity,
      evidence: s.evidence,
      evaluation: s.evaluation,
      description: `[Docente]: ${s.teachingActivity} | [Estudiantes]: ${s.learningActivity}`,
      focus: `Evidencia: ${s.evidence}${s.evaluation ? ` | Instrumento: ${s.evaluation}` : ''}`,
    }));
  }

  const hours = totalHours || activity.hours || 12;
  const sessionsCount = hours; // 1 hora curricular = 1 sesión de 50 min
  const subtopics = extractSubtopics(activity.contenidoFormativo);

  // Determinar número de sesiones por fase
  let aperturaCount = 1;
  let cierreCount = 1;

  if (sessionsCount >= 16) {
    aperturaCount = 3;
    cierreCount = 3;
  } else if (sessionsCount >= 10) {
    aperturaCount = 2;
    cierreCount = 2;
  } else if (sessionsCount >= 6) {
    aperturaCount = 1;
    cierreCount = 1;
  } else {
    aperturaCount = 1;
    cierreCount = 1;
  }

  const desarrolloCount = Math.max(1, sessionsCount - aperturaCount - cierreCount);

  const sessions: DetailedSession[] = [];

  const rawApertura = activity.apertura?.activities?.trim() || '';
  const rawEjecucion = activity.ejecucion?.activities?.trim() || '';
  const rawConclusion = activity.conclusion?.activities?.trim() || '';

  for (let sNum = 1; sNum <= sessionsCount; sNum++) {
    let phase: 'Apertura' | 'Desarrollo' | 'Cierre';
    let title = '';
    let description = '';
    let focus = '';
    let teachingActivity = '';
    let learningActivity = '';
    let evidence = '';
    let evaluation = '';

    if (sNum <= aperturaCount) {
      // ── FASE DE APERTURA ──────────────────────────────────────────────
      phase = 'Apertura';
      if (sNum === 1) {
        title = isLaboral
          ? 'Encuadre, normas de seguridad y diagnóstico de saberes previos'
          : 'Encuadre, exploración de saberes previos y diagnóstico contextual';
        description = rawApertura || (isLaboral
          ? 'Presentación de la práctica en taller/laboratorio, medidas de seguridad NOM y evaluación diagnóstica de conocimientos técnicos.'
          : 'Diálogo participativo guiado sobre las vivencias comunitarias de los estudiantes y planteamiento de la situación problematizadora.');
        focus = `Diagnóstico inicial de saberes previos y presentación de la situación problematizadora del bloque.`;
        teachingActivity = rawApertura
          ? `Presentación de la situación de aprendizaje y mediación de la apertura planificada: ${rawApertura.substring(0, 110)}...`
          : `Presentación de la situación de aprendizaje del bloque y mediación de preguntas detonadoras para recuperar saberes previos.`;
        learningActivity = rawApertura
          ? `Participación de los estudiantes en la actividad de apertura planificada: ${rawApertura.substring(0, 110)}...`
          : `Participación en lluvia de ideas y registro diagnóstico individual de conocimientos previos sobre el tema.`;
        evidence = `Cuestionario diagnóstico o mapa mental inicial de saberes previos`;
        evaluation = `Evaluación diagnóstica formativa (Lista de cotejo)`;
      } else {
        title = isLaboral
          ? 'Identificación de requerimientos técnicos, herramientas y normatividad'
          : 'Problematización comunitaria y definición de preguntas detonadoras';
        description = rawApertura
          ? `Profundización diagnóstica y problematización: ${rawApertura}`
          : (isLaboral
            ? 'Reconocimiento de instrumental, especificaciones técnicas y simbología aplicable a la actividad productiva.'
            : 'Formulación colectiva de interrogantes guía del proyecto integrador articuladas a las necesidades del entorno escolar y comunitario.');
        focus = `Problematización y contextualización del reto formativo.`;
        teachingActivity = rawApertura
          ? `Orientación contextualizada y vinculación con la problemática planificada: ${rawApertura.substring(0, 110)}...`
          : `Orientación sobre la vinculación de la problemática PAEC con el contenido formativo y explicación de criterios de desempeño.`;
        learningActivity = rawApertura
          ? `Análisis de la situación y planteamiento de metas conforme a la actividad planificada: ${rawApertura.substring(0, 110)}...`
          : `Análisis en equipos de la situación problema y formulación de preguntas guía o metas de aprendizaje.`;
        evidence = `Planteamiento del problema o cuadro de requerimientos del proyecto`;
        evaluation = `Coevaluación formativa`;
      }
    } else if (sNum > sessionsCount - cierreCount) {
      // ── FASE DE CIERRE ────────────────────────────────────────────────
      phase = 'Cierre';
      const cierreRelativeIdx = sNum - (sessionsCount - cierreCount);

      if (cierreCount > 1 && cierreRelativeIdx === 1) {
        title = isLaboral
          ? 'Control de calidad, pruebas de funcionamiento y coevaluación'
          : 'Integración del producto formativo y coevaluación entre pares';
        description = rawConclusion || (isLaboral
          ? 'Verificación de parámetros de operación del trabajo realizado mediante listas de cotejo técnicas y retroalimentación entre pares.'
          : 'Revisión colaborativa de los productos y evidencias intermedias mediante rúbricas socioformativas con intercambio de mejoras.');
        focus = `Coevaluación formativa y revisión de criterios de calidad del producto del bloque.`;
        teachingActivity = rawConclusion
          ? `Acompañamiento del cierre y revisión de calidad según lo planificado: ${rawConclusion.substring(0, 110)}...`
          : `Coordinación de la sesión de coevaluación guiada y revisión de criterios de calidad del producto integrador.`;
        learningActivity = rawConclusion
          ? `Intercambio de evidencias y retroalimentación formativa de la actividad de cierre: ${rawConclusion.substring(0, 110)}...`
          : `Intercambio de evidencias con compañeros de equipo y aplicación de rúbrica formativa con sugerencias de mejora.`;
        evidence = `Instrumento de coevaluación aplicado con retroalimentación escrita`;
        evaluation = `Coevaluación con rúbrica formativa`;
      } else {
        title = isLaboral
          ? 'Evaluación sumativa, bitácora de taller y metacognición técnica'
          : 'Evaluación formativa del bloque, socialización y metacognición';
        description = rawConclusion || (isLaboral
          ? 'Entrega del reporte o bitácora de prácticas, retroalimentación del docente y balance de competencias laborales adquiridas.'
          : 'Socialización final de hallazgos, evaluación del impacto comunitario y reflexión metacognitiva sobre los aprendizajes construidos.');
        focus = `Evaluación sumativa del bloque, síntesis de aprendizajes y reflexión metacognitiva.`;
        teachingActivity = rawConclusion
          ? `Cierre pedagógico, retroalimentación grupal y evaluación sumativa de lo planificado: ${rawConclusion.substring(0, 110)}...`
          : `Retroalimentación grupal, cierre pedagógico del bloque y conducción del espacio de reflexión metacognitiva.`;
        learningActivity = rawConclusion
          ? `Entrega del producto final y balance metacognitivo de la actividad planificada: ${rawConclusion.substring(0, 110)}...`
          : `Presentación o entrega del producto formativo final y redacción de conclusiones metacognitivas individuales.`;
        evidence = `Producto formativo final del bloque y bitácora de reflexión metacognitiva`;
        evaluation = `Heteroevaluación sumativa (Rúbrica analítica del bloque)`;
      }
    } else {
      // ── FASE DE DESARROLLO ────────────────────────────────────────────
      phase = 'Desarrollo';
      const desarrolloIdx = sNum - aperturaCount; // 1-based index dentro de desarrollo
      const topicIndex = subtopics.length > 0 ? (desarrolloIdx - 1) % subtopics.length : -1;
      const currentSubtopic = topicIndex >= 0 ? subtopics[topicIndex] : null;

      // Variar el tipo de sesión dentro del desarrollo
      const subphaseMod = (desarrolloIdx - 1) % 3;

      if (subphaseMod === 0) {
        // Conceptualización / Análisis
        if (currentSubtopic) {
          title = `Fundamentación e indagación: ${currentSubtopic}`;
          description = `Lectura crítica, análisis de fuentes y comprensión conceptual sobre ${currentSubtopic.toLowerCase()} en equipos de trabajo.`;
          focus = `Fundamentación teórica y análisis conceptual sobre ${currentSubtopic}.`;
        } else {
          title = isLaboral
            ? `Análisis de especificaciones técnicas y procedimientos (Etapa ${desarrolloIdx})`
            : `Indagación guiada y análisis conceptual (Etapa ${desarrolloIdx})`;
          description = rawEjecucion || (isLaboral
            ? 'Estudio de manuales técnicos, diagramas y especificaciones operativas para la ejecución en taller.'
            : 'Procesamiento de información, lectura de textos formativos y contraste de perspectivas socioculturales.');
          focus = `Comprensión de conceptos clave y principios del bloque.`;
        }
        teachingActivity = rawEjecucion
          ? `Exposición dialogada y mediación de la actividad de desarrollo planificada: ${rawEjecucion.substring(0, 110)}...`
          : `Exposición dialogada y mediación para el análisis de los conceptos clave y fundamentos técnicos.`;
        learningActivity = rawEjecucion
          ? `Lectura reflexiva y análisis guiado de la actividad planificada: ${rawEjecucion.substring(0, 110)}...`
          : `Lectura reflexiva, análisis de casos o ejercicios guiados en equipos colaborativos.`;
        evidence = `Apuntes estructurados, mapa conceptual o cuadro comparativo del tema`;
        evaluation = `Heteroevaluación formativa`;
      } else if (subphaseMod === 1) {
        // Aplicación práctica / Procedimental
        if (currentSubtopic) {
          title = `Aplicación práctica y contraste: ${currentSubtopic}`;
          const isCommunityTopic = currentSubtopic.toLowerCase().includes('comunidad');
          description = isCommunityTopic
            ? `Desarrollo de ejercicios situados, estudio de casos y análisis de ${currentSubtopic.toLowerCase()} en el contexto cotidiano.`
            : `Desarrollo de ejercicios situados, resolución de problemas y vinculación de ${currentSubtopic.toLowerCase()} con el entorno comunitario.`;
          focus = `Aplicación práctica procedimental vinculada a ${currentSubtopic}.`;
        } else {
          title = isLaboral
            ? `Práctica de taller: Ejecución y destrezas operativas (Etapa ${desarrolloIdx})`
            : `Trabajo colaborativo: Aplicación y resolución situada (Etapa ${desarrolloIdx})`;
          description = rawEjecucion || (isLaboral
            ? 'Manejo de equipo, ensamblaje, trazado o medición siguiendo protocolos de seguridad y precisión industrial.'
            : 'Diseño de propuestas de solución, elaboración de organizadores gráficos y debate crítico sobre problemáticas reales.');
          focus = `Desarrollo de habilidades prácticas y resolución de situaciones contextuales.`;
        }
        teachingActivity = rawEjecucion
          ? `Demostración práctica, supervisión y mediación activa de: ${rawEjecucion.substring(0, 110)}...`
          : `Demostración práctica del procedimiento técnico y supervisión continua de la aplicación segura en el aula o taller.`;
        learningActivity = rawEjecucion
          ? `Ejecución de la práctica experimental y resolución de retos conforme a: ${rawEjecucion.substring(0, 110)}...`
          : `Ejecución autónoma o colaborativa de la práctica experimental, resolución de retos y registro de mediciones o datos.`;
        evidence = `Reporte de práctica, prototipo intermedio o registro de resultados técnicos`;
        evaluation = `Lista de cotejo de desempeño procedimental`;
      } else {
        // Construcción de evidencias intermedias
        title = isLaboral
          ? `Sistematización y avance de bitácora técnica (Etapa ${desarrolloIdx})`
          : `Construcción de evidencias intermedias del bloque (Etapa ${desarrolloIdx})`;
        description = rawEjecucion || (isLaboral
          ? 'Registro detallado de parámetros, análisis de fallas o resultados de pruebas en la bitácora de trabajo.'
          : 'Estructuración y refinamiento de avances del producto formativo integrador articulado al proyecto PAEC escolar.');
        focus = `Sistematización de avances y consolidación de evidencias de aprendizaje intermedias.`;
        teachingActivity = rawEjecucion
          ? `Asesoría y retroalimentación formativa sobre la evidencia planificada: ${rawEjecucion.substring(0, 110)}...`
          : `Asesoría personalizada y retroalimentación formativa sobre el avance de los entregables del bloque.`;
        learningActivity = rawEjecucion
          ? `Sistematización de avances y consolidación de evidencias de acuerdo con: ${rawEjecucion.substring(0, 110)}...`
          : `Sistematización de avances, corrección de desviaciones y consolidación de la evidencia intermedia en la bitácora.`;
        evidence = `Avance estructurado de evidencia intermedia o reporte técnico parcial`;
        evaluation = `Rúbrica formativa intermedia`;
      }
    }

    sessions.push({
      sessionNum: sNum,
      totalSessions: sessionsCount,
      activityIndex,
      activityName: activity.name,
      phase,
      phaseColor: PHASE_STYLES[phase],
      title,
      description,
      focus,
      teachingActivity,
      learningActivity,
      evidence,
      evaluation,
    });
  }

  return sessions;
}
