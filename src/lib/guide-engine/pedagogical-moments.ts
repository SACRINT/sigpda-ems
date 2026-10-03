/**
 * pedagogical-moments.ts — Momentos didácticos diferenciados por rol de sesión.
 * SIGPDA-EMS · Motor de Guías (H-323)
 *
 * Evita que las sesiones de una misma misión sean clones: cada sesión recibe un rol
 * (introducción / práctica / consolidación) que decide qué parte REAL de la misión se
 * trabaja, qué técnica didáctica se usa y cómo se reparten los minutos.
 * Invariante B-001: todo el contenido específico proviene de la misión; el catálogo solo
 * contiene técnicas pedagógicas genéricas (no datos).
 */

import type { MissionSection } from '@/types/work-textbook';

export type SessionRole = 'introduccion' | 'practica' | 'consolidacion' | 'completa';

export interface SessionMoments {
  role: SessionRole;
  tiempos: { apertura: number; desarrollo: number; cierre: number };
  apertura: { docente: string; estudiante: string; saberesPrevios: string };
  desarrollo: { docente: string; estudiante: string };
  cierre: { docente: string; estudiante: string };
  proposito: string;
}

// ─── Catálogo de técnicas (genéricas) ────────────────────────────────────────

export const TECNICAS_APERTURA = [
  'Lluvia de ideas dirigida',
  'Lectura de la situación detonante con pensamiento en voz alta',
  'Sondeo rápido con tarjetas de respuesta',
  'Predicción individual y contraste por parejas',
] as const;

export const TECNICAS_DESARROLLO: Record<Exclude<SessionRole, 'completa'>, readonly string[]> = {
  introduccion: [
    'Modelado con pensamiento en voz alta',
    'Demostración guiada con preguntas intercaladas',
    'Exposición dialogada con organizador gráfico',
  ],
  practica: [
    'Trabajo cooperativo en equipos de 3 con roles rotativos',
    'Rompecabezas (Jigsaw) por expertos',
    'Estudio de caso guiado',
    'Estaciones de práctica',
  ],
  consolidacion: [
    'Reto autónomo con bitácora de proceso',
    'Resolución individual con coevaluación en parejas',
    'Galería de productos (Gallery Walk)',
  ],
};

export const TECNICAS_CIERRE = [
  'Ticket de salida',
  'Escala valorativa de 3 ítems',
  'Coevaluación en pareja con lista de cotejo',
  'Semáforo de autoevaluación',
  'Pregunta de metacognición: ¿qué aprendí, cómo y para qué me sirve?',
] as const;

const ROLE_OFFSET: Record<SessionRole, number> = { introduccion: 0, practica: 1, consolidacion: 2, completa: 0 };

/**
 * Selección determinista y variada (no aleatoria) de una técnica.
 * Usa la repetición del ciclo de 3 sesiones (para que sesiones del mismo rol no repitan técnica)
 * y un desfase por rol (para que sesiones consecutivas de roles distintos tampoco coincidan).
 */
export function pickTechnique<T>(
  list: readonly T[],
  missionIndex: number,
  sessionNum: number,
  role: SessionRole,
  salt = 0
): T {
  const variant = Math.floor((Math.max(1, sessionNum) - 1) / 3);
  const idx = Math.abs(missionIndex * 7 + variant + ROLE_OFFSET[role] + salt) % list.length;
  return list[idx];
}

/** Recorta con elipsis SOLO cuando realmente se corta el texto. */
export function clipText(text: string | undefined | null, max: number): string {
  const clean = (text ?? '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const sp = cut.lastIndexOf(' ');
  return `${(sp > max * 0.6 ? cut.slice(0, sp) : cut).trimEnd()}…`;
}

/**
 * Rol de la sesión dentro de su misión.
 * - Misión con sesiones explícitas: primera = introducción, última = consolidación, intermedias = práctica.
 * - Una sola sesión explícita: ciclo completo.
 * - Sesión de relleno (fuera de coveredSessions): ciclo 1-2-3 según su número.
 */
export function resolveSessionRole(mission: MissionSection, sessionNum: number): SessionRole {
  const covered = Array.isArray(mission.coveredSessions) ? mission.coveredSessions : [];
  const idx = covered.indexOf(sessionNum);
  if (idx >= 0) {
    if (covered.length === 1) return 'completa';
    if (idx === 0) return 'introduccion';
    if (idx === covered.length - 1) return 'consolidacion';
    return 'practica';
  }
  const cycle = (Math.max(1, sessionNum) - 1) % 3;
  return cycle === 0 ? 'introduccion' : cycle === 1 ? 'practica' : 'consolidacion';
}

const TIEMPOS: Record<SessionRole, { apertura: number; desarrollo: number; cierre: number }> = {
  introduccion: { apertura: 15, desarrollo: 25, cierre: 10 },
  practica: { apertura: 10, desarrollo: 30, cierre: 10 },
  consolidacion: { apertura: 10, desarrollo: 25, cierre: 15 },
  completa: { apertura: 10, desarrollo: 30, cierre: 10 },
};

const GENERIC_SABERES = 'Conexión con conceptos fundamentales y experiencias previas.';

/** Construye los momentos didácticos de una sesión a partir del contenido real de la misión. */
export function buildSessionMoments(mission: MissionSection, sessionNum: number): SessionMoments {
  const role = resolveSessionRole(mission, sessionNum);
  const mi = mission.missionIndex || 1;
  const tApertura = pickTechnique(TECNICAS_APERTURA, mi, sessionNum, role);
  const tCierre = pickTechnique(TECNICAS_CIERRE, mi, sessionNum, role, 1);
  const devRole = role === 'completa' ? 'practica' : role;
  const tDesarrollo = pickTechnique(TECNICAS_DESARROLLO[devRole], mi, sessionNum, role, 2);

  const story = mission.phenomenonHook?.story;
  const question = mission.phenomenonHook?.detonatingQuestion;
  const analogy = mission.conceptZero?.physicalAnalogy;
  const core = mission.conceptZero?.coreExplanation;
  const demo = mission.iDoSection?.stepByStepDemo;
  const guided = mission.weDoSection?.guidedPractice;
  const challenge = mission.youDoSection?.autonomousChallenge;
  const solved = mission.conceptZero?.solvedExample?.problemStatement;
  const contrast = mission.conceptZero?.contrastTable?.[0];
  const trouble = mission.troubleshooting?.[0];
  const cp = mission.formativeCheckpoint;
  const diag = mission.diagnosticEvaluation?.questions?.[0];
  const light = mission.metacognitiveTrafficLight;
  const topic = mission.sessionTopic || mission.title;
  const focus = mission.sessionFocus || mission.sessionTopic || mission.title;

  const saberes = analogy ? `Analogía cotidiana: ${analogy}` : GENERIC_SABERES;

  if (role === 'introduccion') {
    return {
      role,
      tiempos: TIEMPOS[role],
      proposito: `Introducir: ${focus}`,
      apertura: {
        docente: `${tApertura}. ${story
          ? `Presentar el fenómeno contextual: "${clipText(story, 180)}" y plantear la pregunta detonadora.`
          : 'Presentar el desafío de la sesión y activar saberes previos mediante preguntas detonadoras.'}`,
        estudiante: question
          ? `Analizar la situación y responder: "${question}".`
          : 'Participar en la recuperación de saberes previos y registrar reflexiones iniciales.',
        saberesPrevios: saberes,
      },
      desarrollo: {
        docente: `${tDesarrollo}: ${core ? `concepto central — ${clipText(core, 200)}. ` : ''}${demo
          ? `Modelado (Yo Hago): ${clipText(demo, 200)}`
          : 'Modelado instruccional del procedimiento con acompañamiento guiado.'}`,
        estudiante: `Registrar en el Cuaderno de Trabajo el concepto "${clipText(topic, 80)}" y explicarlo con sus propias palabras${analogy ? ' apoyándose en la analogía' : ''}.`,
      },
      cierre: {
        docente: `${tCierre}: ${diag || cp?.question || 'verificar la comprensión inicial del concepto'}.`,
        estudiante: `Responder la verificación inicial${cp?.reflectionPrompts?.[0] ? ` y reflexionar: ${cp.reflectionPrompts[0]}` : ''}.`,
      },
    };
  }

  if (role === 'practica') {
    return {
      role,
      tiempos: TIEMPOS[role],
      proposito: `Practicar: ${focus}`,
      apertura: {
        docente: `${tApertura}. Recuperar lo aprendido sobre "${clipText(topic, 80)}" y plantear el problema ejemplo${solved ? `: "${clipText(solved, 160)}"` : ''}.`,
        estudiante: 'Recuperar el concepto de la sesión anterior y anticipar cómo aplicarlo al problema planteado.',
        saberesPrevios: saberes,
      },
      desarrollo: {
        docente: `${tDesarrollo}: acompañar la práctica guiada (Hacemos)${guided ? ` — ${clipText(guided, 220)}` : ''}. Monitorear equipos y retroalimentar en el momento.`,
        estudiante: `Resolver en equipo${guided ? `: ${clipText(guided, 160)}` : ' la actividad colaborativa'}, documentando el procedimiento en el Cuaderno de Trabajo.`,
      },
      cierre: {
        docente: `${tCierre}: ${cp?.reflectionPrompts?.[0] || cp?.criteriaChecklist?.[0] || 'valorar el avance logrado en la práctica'}.`,
        estudiante: `Autoevaluar el procedimiento${cp?.criteriaChecklist?.[0] ? ` con el criterio: "${cp.criteriaChecklist[0]}"` : ''} e identificar una duda a resolver.`,
      },
    };
  }

  if (role === 'consolidacion') {
    const errorTxt = contrast
      ? `Revisar el error común: "${clipText(contrast.commonMisconception, 120)}" frente a "${clipText(contrast.correctConcept, 120)}".`
      : trouble?.symptom
        ? `Revisar el error frecuente: "${clipText(trouble.symptom, 140)}" y su solución.`
        : 'Revisar los errores comunes detectados en las sesiones previas.';
    return {
      role,
      tiempos: TIEMPOS[role],
      proposito: `Consolidar: ${focus}`,
      apertura: {
        docente: `${tApertura}. ${errorTxt}`,
        estudiante: 'Contrastar su propio procedimiento con el concepto correcto y corregir lo necesario.',
        saberesPrevios: saberes,
      },
      desarrollo: {
        docente: `${tDesarrollo}: supervisar el reto autónomo (Tú Haces)${challenge ? ` — ${clipText(challenge, 220)}` : ''}. Intervenir solo con preguntas orientadoras.`,
        estudiante: `Resolver individualmente${challenge ? `: ${clipText(challenge, 160)}` : ' el reto de consolidación'} y registrar el proceso en la bitácora.`,
      },
      cierre: {
        docente: `${tCierre}: ${cp?.question || 'comprobar el logro del aprendizaje esperado'}.${light ? ' Aplicar el semáforo de autoevaluación metacognitiva.' : ''}`,
        estudiante: `Responder el checkpoint formativo${cp?.reflectionPrompts?.[0] ? ` y reflexionar: ${cp.reflectionPrompts[0]}` : ''}${light ? ' y marcar su semáforo (verde/amarillo/rojo)' : ''}.`,
      },
    };
  }

  // 'completa': ciclo completo en una sola sesión
  return {
    role,
    tiempos: TIEMPOS[role],
    proposito: focus,
    apertura: {
      docente: `${tApertura}. ${story
        ? `Presentar el fenómeno contextual: "${clipText(story, 180)}" y moderar la discusión.`
        : 'Presentar el desafío de la sesión y activar saberes previos mediante preguntas detonadoras.'}`,
      estudiante: question
        ? `Analizar la situación problemática y reflexionar sobre la interrogante: "${question}".`
        : 'Participar activamente en la recuperación de saberes previos y registrar reflexiones iniciales.',
      saberesPrevios: saberes,
    },
    desarrollo: {
      docente: `${tDesarrollo}. ${demo
        ? `Demostración paso a paso (Yo Hago): ${clipText(demo, 220)}`
        : 'Modelado instruccional y acompañamiento guiado durante la resolución de ejercicios.'}`,
      estudiante: `Práctica guiada ("Hacemos"): ${guided ? clipText(guided, 140) : 'Trabajo colaborativo'}. Reto autónomo ("Tú Haces"): ${challenge ? clipText(challenge, 140) : 'Resolución individual en cuaderno de trabajo'}.`,
    },
    cierre: {
      docente: `${tCierre}: ${cp?.question || 'Evaluación de salida'}. Retroalimentar errores comunes detectados.`,
      estudiante: `Resolver checkpoint formativo, autoevaluar con lista de cotejo y responder reflexión metacognitiva: ${cp?.reflectionPrompts?.[0] || '¿Cómo aplico lo aprendido?'}.`,
    },
  };
}
