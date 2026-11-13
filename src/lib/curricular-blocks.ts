/**
 * curricular-blocks.ts
 * SIGPDA-EMS · SEMS Puebla MCCEMS 2026-2027
 *
 * Módulo canónico para la resolución y partición de Unidades de Aprendizaje Curricular (UAC)
 * en exactamente 3 BLOQUES DE EVALUACIÓN FORMATIVA (Corte 1, Corte 2 y Corte 3).
 *
 * Regla de Invariante Institucional MCCEMS:
 * Sin importar el número de Progresiones oficiales que contenga el programa de estudios
 * (4, 7, 8, 10, 14 o 16 progresiones), el semestre escolar en Puebla y DGB/SEMS SIEMPRE
 * se estructura en 3 CORTES TRIMESTRALES / BIMESTRALES DE EVALUACIÓN:
 *   - Bloque 1 (Índice 0): Primer Corte de Evaluación Formativa
 *   - Bloque 2 (Índice 1): Segundo Corte de Evaluación Formativa
 *   - Bloque 3 (Índice 2): Tercer Corte de Evaluación Formativa
 *
 * Ningún documento, pie de página, encabezado o libro puede jamás denominarse "Bloque 4",
 * "Bloque 5", "Bloque 6" o "Bloque 7".
 */

import type { KeyActivityPlan, GeneratedPlanningContent } from '@/types/planning';
import {
  BLOCKS_PER_SEMESTER,
  type ResolvableHoursPlanning,
  resolveSemesterWeeks,
  resolveWeeklyHours,
} from '@/lib/guide-engine/content-budget';

export interface CurricularBlock {
  /** Índice 0-based del bloque: estrictamente 0, 1 o 2 */
  blockIndex: number;
  /** Número oficial de corte: 1, 2 o 3 */
  corteNumber: 1 | 2 | 3;
  /** Etiqueta oficial: 'Corte 1', 'Corte 2', 'Corte 3' */
  corteLabel: string;
  /** Nombre corto del bloque, ej. 'Progresiones 1 y 2' */
  name: string;
  /** Título formal completo del bloque */
  title: string;
  /** Suma de horas lectivas de las actividades asignadas al corte (ej. 18h) */
  hours: number;
  /** Actividades o progresiones oficiales pertenecientes a este corte */
  activities: KeyActivityPlan[];
  /** Índices originales de las actividades en sectionIV.activities */
  activityIndices: number[];
  /** Contenidos formativos agregados y articulados de las progresiones */
  contenidoFormativo: string;
  /** Metas / Aprendizajes de trayectoria o propósitos del bloque */
  learningOutcome: string;
  /** Metodología activa primaria asignada al bloque */
  methodology: string;
  /** Taxonomía integrada de los 3 Saberes (Saber, Saber Hacer, Saber Ser) */
  saberes?: {
    saber: string;
    saberHacer: string;
    saberSer: string;
  };
}

/**
 * Resuelve el número de bloque formativo (estrictamente 1, 2 o 3).
 * Si recibe un índice 0-based canónico (0, 1, 2), retorna 1, 2, 3.
 * Si recibe un índice 1-based (1, 2, 3), retorna 1, 2, 3.
 * Si recibe un índice heredado de progresión (> 2) proveniente de borradores viejos,
 * lo normaliza defensivamente al corte correspondiente (o módulo 3 + 1),
 * garantizando que NUNCA se produzca "Bloque 4", "Bloque 5", "Bloque 6" o "Bloque 7".
 */
export function resolveBlockNumber(
  blockIndex: number | null | undefined,
  totalActivities?: number
): number | null {
  if (blockIndex === null || blockIndex === undefined) return null;
  const num = Number(blockIndex);
  if (isNaN(num)) return null;

  // Si se provee totalActivities > 3, el índice recibido puede ser un índice de actividad/progresión heredado
  if (totalActivities && totalActivities > 3) {
    if (totalActivities === 7) {
      // Dibujo Técnico I (7 progresiones: 0,1 -> Corte 1; 2,3,4 -> Corte 2; 5,6 -> Corte 3)
      if (num <= 1) return 1;
      if (num <= 4) return 2;
      return 3;
    }
    if (totalActivities === 8) {
      if (num <= 2) return 1;
      if (num <= 5) return 2;
      return 3;
    }
    const corteCalculado = Math.min(
      BLOCKS_PER_SEMESTER,
      Math.floor((num * BLOCKS_PER_SEMESTER) / totalActivities) + 1
    );
    return corteCalculado as 1 | 2 | 3;
  }

  // Índice canónico 0-based: 0 -> 1, 1 -> 2, 2 -> 3
  if (num === 0) return 1;
  if (num === 1) return 2;
  if (num === 2) return 3;

  // Si ya es 1, 2 o 3 (1-based directo)
  if (num === 3) {
    return 3;
  }

  // Fallback aritmético estricto a rango [1, 3]
  return ((num % 3) + 1) as 1 | 2 | 3;
}

/**
 * Mapea el índice de una actividad/progresión individual (0..N-1)
 * a su bloque curricular correspondiente (0, 1 o 2).
 */
export function mapActivityIndexToBlockIndex(
  activityIndex: number,
  totalActivities: number,
  corte?: string | number
): number {
  if (corte !== undefined && corte !== null) {
    const trimmed = String(corte).trim().toLowerCase();
    if (trimmed.includes('1')) return 0;
    if (trimmed.includes('2')) return 1;
    if (trimmed.includes('3')) return 2;
  }

  // Distribución canónica MCCEMS según el total de progresiones
  if (totalActivities === 7) {
    // Dibujo Técnico I: P1 y P2 en Corte 1; P3, P4 y P5 en Corte 2; P6 y P7 en Corte 3
    if (activityIndex <= 1) return 0;
    if (activityIndex <= 4) return 1;
    return 2;
  }

  if (totalActivities === 8) {
    if (activityIndex <= 2) return 0;
    if (activityIndex <= 5) return 1;
    return 2;
  }

  // Regla general de partición uniforme
  const corteNum = Math.min(
    BLOCKS_PER_SEMESTER,
    Math.floor((activityIndex * BLOCKS_PER_SEMESTER) / Math.max(1, totalActivities)) + 1
  );
  return corteNum - 1;
}

/**
 * Agrupa las actividades o progresiones de la Sección IV de una planeación
 * en exactamente 3 Bloques Curriculares (Corte 1, Corte 2, Corte 3).
 */
export interface ResolveBlocksFallback extends ResolvableHoursPlanning {
  component?: string | null;
}

const ORDINAL_CORTE_NAMES: Record<1 | 2 | 3, string> = {
  1: 'Primer Corte de Evaluación Formativa',
  2: 'Segundo Corte de Evaluación Formativa',
  3: 'Tercer Corte de Evaluación Formativa',
};

function stripDuplicateBlockPrefix(raw: string): string {
  return (raw || '')
    .replace(/^Bloque\s+[1-3](?:\s*\(\s*Corte\s*[1-3]\s*\))?\s*(?:[:\-–—]\s*|$)/i, '')
    .trim();
}

export function resolveCurricularBlocks(
  contentJson: GeneratedPlanningContent | null | undefined,
  fallback?: ResolveBlocksFallback | null
): CurricularBlock[] {
  const activities = contentJson?.sectionIV?.activities || [];
  const s1 = contentJson?.sectionI;
  const extracted = (fallback?.extractedData || fallback?.extracted_data || {}) as Record<string, unknown>;
  const componentRaw = s1?.component || fallback?.component || (typeof extracted.component === 'string' ? extracted.component : '') || '';
  const isLaboral = componentRaw.toLowerCase().includes('laboral');
  const subsystem =
    fallback?.subsystem ||
    s1?.subsystem ||
    (typeof extracted.subsystem === 'string' ? extracted.subsystem : undefined);
  const semesterWeeks = resolveSemesterWeeks(subsystem);
  const extractedTotal =
    typeof extracted.totalHours === 'number' && extracted.totalHours > 0
      ? extracted.totalHours
      : typeof extracted.hours_per_semester === 'number' && extracted.hours_per_semester > 0
        ? extracted.hours_per_semester
        : typeof extracted.hours === 'number' && extracted.hours > 0
          ? extracted.hours
          : undefined;
  const totalSemesterHours =
    s1?.totalHours ||
    s1?.totalHoursSemester ||
    fallback?.totalHours ||
    extractedTotal ||
    resolveWeeklyHours({ ...fallback, contentJson }) * semesterWeeks;
  const defaultHoursPerBlock = Math.round(totalSemesterHours / BLOCKS_PER_SEMESTER);

  // Cubetas oficiales: una por corte del semestre (3 en MCCEMS).
  const buckets: { acts: KeyActivityPlan[]; indices: number[] }[] = Array.from(
    { length: BLOCKS_PER_SEMESTER },
    () => ({ acts: [], indices: [] })
  );

  activities.forEach((act, idx) => {
    const bIdx = mapActivityIndexToBlockIndex(idx, activities.length, act.corte);
    buckets[bIdx].acts.push(act);
    buckets[bIdx].indices.push(idx);
  });

  return Array.from({ length: BLOCKS_PER_SEMESTER }, (_, bIdx) => bIdx).map((bIdx) => {
    const corteNumber = (bIdx + 1) as 1 | 2 | 3;
    const corteLabel = `Corte ${corteNumber}`;
    const acts = buckets[bIdx].acts;
    const indices = buckets[bIdx].indices;

    const hours = acts.reduce((acc, a) => acc + (a.hours || 0), 0) || defaultHoursPerBlock;

    let blockName = '';
    if (acts.length === 0) {
      blockName = ORDINAL_CORTE_NAMES[corteNumber];
    } else if (acts.length === 1) {
      const cleaned = stripDuplicateBlockPrefix(acts[0].name || '');
      blockName = cleaned || `${isLaboral ? 'Actividad Clave' : 'Progresión'} ${indices[0] + 1}`;
    } else {
      const progNumbers = indices.length === 2
        ? `${indices[0] + 1} y ${indices[1] + 1}`
        : `${indices.slice(0, -1).map((i) => i + 1).join(', ')} y ${indices[indices.length - 1] + 1}`;
      blockName = `${isLaboral ? 'Actividades Clave' : 'Progresiones'} ${progNumbers}`;
    }

    const title = `Bloque ${corteNumber} (${corteLabel}): ${blockName}`;

    const contenidoFormativo = acts
      .map((a) => a.contenidoFormativo)
      .filter((cf): cf is string => Boolean(cf && cf.trim()))
      .join(' · ');

    const methodology =
      acts[0]?.methodology || s1?.metodologiaActiva || 'Aprendizaje Basado en Proyectos (ABP)';

    const saberParts = acts.map((a) => a.saberes?.saber).filter(Boolean);
    const saberHacerParts = acts.map((a) => a.saberes?.saberHacer).filter(Boolean);
    const saberSerParts = acts.map((a) => a.saberes?.saberSer).filter(Boolean);

    const saberes =
      saberParts.length > 0 || saberHacerParts.length > 0 || saberSerParts.length > 0
        ? {
            saber: saberParts.join(' · '),
            saberHacer: saberHacerParts.join(' · '),
            saberSer: saberSerParts.join(' · '),
          }
        : undefined;

    const learningOutcomes = indices
      .map((idx) => contentJson?.sectionII?.learningOutcomes?.[idx])
      .filter(Boolean) as string[];
    const learningOutcome =
      learningOutcomes.join(' · ') || contentJson?.sectionII?.purpose || '';

    return {
      blockIndex: bIdx,
      corteNumber,
      corteLabel,
      name: blockName,
      title,
      hours,
      activities: acts,
      activityIndices: indices,
      contenidoFormativo,
      learningOutcome,
      methodology,
      saberes,
    };
  });
}
