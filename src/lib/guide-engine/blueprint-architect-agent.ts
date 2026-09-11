/**
 * Blueprint Architect Agent
 * SIGPDA-EMS · DBEPA Puebla MCCEMS 2026-2027
 *
 * Agente 2 del motor de Libros de Trabajo.
 * Analiza la dosificación de 12-18 sesiones del bloque desde sequenceJson
 * (o la genera automáticamente si no existe con session-progression-engine.ts),
 * y aplica el algoritmo determinista de clustering por phase y title para
 * estructurar el libro en 3 a 5 Misiones Didácticas completas.
 */

import { generateBlockSessions, type DetailedSession } from '@/lib/session-progression-engine';
import type { KeyActivityPlan, Planning, SecuenciaSesion } from '@/types/planning';
import type { CurriculumContext } from './curriculum-context-agent';

export interface PlannedMissionBlueprint {
  missionIndex: number;
  title: string;
  sessionNumbers: number[];
  sessionTopic: string;
  focus: string;
  missionType: 'foundation' | 'lab' | 'project' | 'evaluation' | 'synthesis';
  targetPages: number;
  targetWords: number;
}

export type MissionBlueprint = PlannedMissionBlueprint;

export interface BlockBlueprint {
  blockIndex: number;
  blockName: string;
  totalSessions: number;
  sessions: DetailedSession[];
  missions: PlannedMissionBlueprint[];
  projectBlueprint: {
    artifactName: string;
    targetPages: number;
    targetWords: number;
    targetSessions: number[];
  };
  evaluationBlueprint: {
    reuseExtras: boolean;
    targetPages: number;
    targetWords: number;
  };
  totalPlannedWords: number;
  totalPlannedPages: number;
}

/**
 * Adaptador de compatibilidad: Normaliza SecuenciaSesion a DetailedSession
 */
function normalizeToDetailedSession(
  s: SecuenciaSesion | DetailedSession,
  activityIndex: number,
  activityName: string
): DetailedSession {
  if ('focus' in s && 'phaseColor' in s) {
    return s as DetailedSession;
  }
  const sec = s as SecuenciaSesion;
  return {
    sessionNum: sec.sessionNum,
    totalSessions: sec.totalSessions,
    activityIndex,
    activityName,
    phase: sec.phase,
    phaseColor: {
      bg: sec.phase === 'Apertura' ? 'rgba(59, 130, 246, 0.15)' : sec.phase === 'Cierre' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
      text: sec.phase === 'Apertura' ? '#60a5fa' : sec.phase === 'Cierre' ? '#34d399' : '#fbbf24',
      border: sec.phase === 'Apertura' ? 'rgba(59, 130, 246, 0.35)' : sec.phase === 'Cierre' ? 'rgba(16, 185, 129, 0.35)' : 'rgba(245, 158, 11, 0.35)',
    },
    title: sec.title,
    description: `[Docente]: ${sec.teachingActivity} | [Estudiantes]: ${sec.learningActivity}`,
    focus: sec.evidence ? `Evidencia: ${sec.evidence}` : sec.title,
    teachingActivity: sec.teachingActivity,
    learningActivity: sec.learningActivity,
    evidence: sec.evidence,
    evaluation: sec.evaluation,
  };
}

/**
 * Agrupa sesiones en las 4 misiones oficiales del enfoque Puebla-Finlandia:
 * 1. Misión 1 (foundation): Apertura e intuición pedagógica
 * 2. Misión 2 (lab): Primera mitad de desarrollo y experimentación técnica
 * 3. Misión 3 (project): Segunda mitad de desarrollo y construcción del artefacto
 * 4. Misión 4 (evaluation): Cierre, demostración integral y evaluación formativa NEM
 */
function clusterSessionsIntoMissions(
  sessions: DetailedSession[]
): PlannedMissionBlueprint[] {
  if (sessions.length === 0) return [];

  // Categorizar por fase didáctica oficial
  let apertura = sessions.filter((s) => s.phase === 'Apertura');
  let desarrollo = sessions.filter((s) => s.phase === 'Desarrollo');
  let cierre = sessions.filter((s) => s.phase === 'Cierre');

  // Fallback si no vinieron fases explícitas en las sesiones
  if (apertura.length === 0 && desarrollo.length === 0 && cierre.length === 0) {
    const total = sessions.length;
    const apCount = Math.max(1, Math.round(total * 0.2));
    const ciCount = Math.max(1, Math.round(total * 0.2));
    apertura = sessions.slice(0, apCount);
    desarrollo = sessions.slice(apCount, total - ciCount);
    cierre = sessions.slice(total - ciCount);
  } else {
    if (apertura.length === 0 && desarrollo.length > 2) {
      apertura = [desarrollo.shift()!];
    }
    if (cierre.length === 0 && desarrollo.length > 2) {
      cierre = [desarrollo.pop()!];
    }
  }

  // Dividir la fase de Desarrollo equitativamente entre Laboratorio y Proyecto
  const midPoint = Math.ceil(desarrollo.length / 2);
  const labGroup = desarrollo.slice(0, midPoint);
  const projectGroup = desarrollo.slice(midPoint);

  // Asegurar que ningún grupo quede vacío
  const finalLabGroup = labGroup.length > 0 ? labGroup : (apertura.length > 1 ? [apertura[apertura.length - 1]] : sessions.slice(0, 1));
  const finalProjectGroup = projectGroup.length > 0 ? projectGroup : (cierre.length > 1 ? [cierre[0]] : sessions.slice(-1));

  const mission1 = createMissionBlueprint(1, apertura.length > 0 ? apertura : sessions.slice(0, 1), 'foundation');
  const mission2 = createMissionBlueprint(2, finalLabGroup, 'lab');
  const mission3 = createMissionBlueprint(3, finalProjectGroup, 'project');
  const mission4 = createMissionBlueprint(4, cierre.length > 0 ? cierre : sessions.slice(-1), 'evaluation');

  return [mission1, mission2, mission3, mission4];
}

function createMissionBlueprint(
  index: number,
  sessionGroup: DetailedSession[],
  missionType: 'foundation' | 'lab' | 'project' | 'evaluation'
): PlannedMissionBlueprint {
  const sessionNumbers = sessionGroup.map((s) => s.sessionNum);
  const mainTitle = sessionGroup[0]?.title || `Tema ${index}`;

  let titlePrefix = `Misión ${index}`;
  if (missionType === 'foundation') {
    titlePrefix = `Misión ${index}: Fundamentación e Intuición`;
  } else if (missionType === 'lab') {
    titlePrefix = `Misión ${index}: Laboratorio y Taller Experimental`;
  } else if (missionType === 'project') {
    titlePrefix = `Misión ${index}: Construcción del Artefacto Real`;
  } else if (missionType === 'evaluation') {
    titlePrefix = `Misión ${index}: Demostración Integral y Evaluación Formativa`;
  }

  const title = `${titlePrefix} — ${mainTitle}`;
  const pages = Math.max(6, sessionGroup.length * 3);
  const words = pages * 1250;

  return {
    missionIndex: index,
    title,
    sessionNumbers,
    sessionTopic: mainTitle,
    focus: sessionGroup.map((s) => s.title).join(' · '),
    missionType,
    targetPages: pages,
    targetWords: words,
  };
}

/**
 * Genera el Blueprint maestro para la redacción del Libro del Bloque
 */
export function buildBlockBlueprint(params: {
  blockIndex: number;
  blockName?: string;
  planning: Planning;
  curriculum: CurriculumContext;
  hasExistingExtras?: boolean;
}): BlockBlueprint {
  const { blockIndex, planning, curriculum, hasExistingExtras } = params;
  const blockName = params.blockName || `Bloque ${blockIndex + 1}`;

  // 1. Obtener las sesiones desde sequenceJson / sequence_json o autogenerarlas si no existen
  let sessions: DetailedSession[] = [];
  const sequenceData = planning.sequenceJson || (planning as any).sequence_json || {};
  const currentBlockSeq = sequenceData[blockIndex];

  if (currentBlockSeq && Array.isArray(currentBlockSeq.sessions) && currentBlockSeq.sessions.length > 0) {
    sessions = currentBlockSeq.sessions.map((s: any) =>
      normalizeToDetailedSession(s, blockIndex, blockName)
    );
  } else {
    // Autogeneración silenciosa en 5ms (0 tokens IA)
    const isLaboral = curriculum.subsystem === 'bt' || curriculum.component === 'laboral';
    const hours = curriculum.subsystem === 'bt' ? 18 : 12;
    const mockActivity: KeyActivityPlan = {
      name: blockName,
      hours,
      methodology: planning.metodologiaActiva || 'abp',
      apertura: { activities: 'Presentación del dilema formativo y saberes previos', processes: 'Diálogo guiado', materials: 'Cuaderno de trabajo' },
      ejecucion: { activities: 'Indagación experimental, modelación y análisis', processes: 'Trabajo activo', materials: 'Instrumental y software' },
      conclusion: { activities: 'Síntesis, evaluación y coevaluación', processes: 'Reflexión metacognitiva', materials: 'Rúbrica' },
    };
    sessions = generateBlockSessions(mockActivity, blockIndex, hours, undefined, isLaboral);
  }

  // 2. Agrupar sesiones en Misiones coherentes usando s.phase y s.title
  const missions = clusterSessionsIntoMissions(sessions);

  // 3. Blueprint del Proyecto / Artefacto Real
  const projectPages = curriculum.subsystem === 'bt' ? 10 : 8;
  const projectWords = projectPages * 1250;
  const lastMissions = missions.filter((m) => m.missionType === 'project' || m.missionType === 'lab');
  const projectSessions = lastMissions.flatMap((m) => m.sessionNumbers).slice(-4);

  // 4. Blueprint de Evaluación
  const evalPages = curriculum.subsystem === 'bt' ? 8 : 6;
  const evalWords = evalPages * 1250;

  // 5. Balancear metas de palabras para asegurar que alcancen el mínimo oficial
  const totalMissionsWords = missions.reduce((acc, m) => acc + m.targetWords, 0);
  const totalPlannedWords = totalMissionsWords + projectWords + evalWords;
  const totalPlannedPages = Math.round(totalPlannedWords / 1250);

  return {
    blockIndex,
    blockName,
    totalSessions: sessions.length,
    sessions,
    missions,
    projectBlueprint: {
      artifactName: `Artefacto Formativo Integrador: Solución Aplicada para ${curriculum.paecConnection.projectName}`,
      targetPages: projectPages,
      targetWords: projectWords,
      targetSessions: projectSessions.length > 0 ? projectSessions : [sessions.length - 2, sessions.length - 1],
    },
    evaluationBlueprint: {
      reuseExtras: Boolean(hasExistingExtras),
      targetPages: evalPages,
      targetWords: evalWords,
    },
    totalPlannedWords,
    totalPlannedPages,
  };
}
