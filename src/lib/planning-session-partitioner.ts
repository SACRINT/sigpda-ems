import type { KeyActivityPlan, SecuenciaBloque, SecuenciaSesion } from '@/types/planning';
import { mapActivityIndexToBlockIndex } from '@/lib/curricular-blocks';

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
 * corresponden a una actividad/propósito/progresión específica dentro de su bloque curricular.
 *
 * Invariantes garantizados para cualquier N >= 1 (1, 2, 3, 5, 6, 7, 8, 10, 16, 20...):
 * 1. Toda planeación se estructura en 3 bloques de evaluación (0, 1, 2).
 * 2. Cuando cada bloque con sesiones tiene al menos 1 actividad asignada (ej. N >= 3),
 *    las sesiones de cada bloque se reparten exactamente entre las actividades de ese bloque.
 * 3. Cuando N < 3 (ej. 1 o 2 propósitos) y existen bloques en sequenceData sin actividad
 *    directa, se agrupan todas las sesiones disponibles y se reparten proporcionalmente
 *    entre las N actividades para que jamás se pierdan sesiones de ningún corte.
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
    return {
      blockIndex: bIdx,
      activityNumberInBlock: positionInBlock + 1,
      totalActivitiesInBlock: totalInBlock,
      activityHours: currentActHours || assigned.length,
      totalBlockSessions: allPooledSessions.length,
      sessions: assigned,
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

  return {
    blockIndex: bIdx,
    activityNumberInBlock: positionInBlock + 1,
    totalActivitiesInBlock: totalInBlock,
    activityHours: currentActHours || assignedSessions.length,
    totalBlockSessions: blockSessions.length,
    sessions: assignedSessions,
  };
}

