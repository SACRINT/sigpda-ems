import type { KeyActivityPlan } from '@/types/planning';
import { mapActivityIndexToBlockIndex } from '@/lib/curricular-blocks';

export type PlanningActivityLike = Pick<KeyActivityPlan, 'name'> & {
  order?: number;
  corte?: string;
};

export interface PlanningActivityLabelOptions {
  isProgresiones?: boolean;
  uppercase?: boolean;
}

function clampBlock(value: number): number {
  return Math.min(3, Math.max(1, value));
}

export function parseCorteNumber(corte?: string | null): number | null {
  if (!corte) return null;
  const match = String(corte).match(/\d+/);
  if (!match) return null;
  const value = Number(match[0]);
  return Number.isFinite(value) ? clampBlock(value) : null;
}

export function parseProgressionNumber(name?: string | null): number | null {
  if (!name) return null;
  const match = String(name).match(/Progresi[oó]n\s*(\d+)/i);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function stripProgressionPrefix(name: string): string {
  return String(name || '')
    .replace(/^\s*Progresi[oó]n\s*\d+\s*[:.\-–—]?\s*/i, '')
    .trim();
}

export function resolvePlanningBlockNumber(
  activity: PlanningActivityLike,
  index: number,
  activities: readonly PlanningActivityLike[]
): number {
  const explicit = parseCorteNumber(activity.corte);
  if (explicit) return explicit;

  const total = activities.length;
  if (total <= 0) return 1;
  return clampBlock(mapActivityIndexToBlockIndex(index, total) + 1);
}

export function resolvePlanningActivityNumber(
  activity: PlanningActivityLike,
  index: number,
  activities: readonly PlanningActivityLike[]
): number {
  const block = resolvePlanningBlockNumber(activity, index, activities);
  let position = 0;
  for (let i = 0; i <= index; i += 1) {
    if (resolvePlanningBlockNumber(activities[i], i, activities) === block) {
      position += 1;
    }
  }
  return Math.max(1, position);
}

export function resolvePlanningProgressionNumber(
  activity: PlanningActivityLike,
  index: number
): number {
  const ordered = Number(activity.order);
  if (Number.isFinite(ordered) && ordered > 0) return Math.trunc(ordered);
  return parseProgressionNumber(activity.name) ?? index + 1;
}

export function buildPlanningActivityLabel(
  activity: PlanningActivityLike,
  index: number,
  activities: readonly PlanningActivityLike[],
  options: PlanningActivityLabelOptions = {}
): string {
  const block = resolvePlanningBlockNumber(activity, index, activities);
  const activityNumber = resolvePlanningActivityNumber(activity, index, activities);
  const parts = [`Bloque ${block}`, `Actividad ${activityNumber}`];

  if (options.isProgresiones) {
    parts.push(`Progresión ${resolvePlanningProgressionNumber(activity, index)}`);
  }

  const label = parts.join(' / ');
  return options.uppercase ? label.toUpperCase() : label;
}

export function buildPlanningActivityHeading(
  activity: PlanningActivityLike,
  index: number,
  activities: readonly PlanningActivityLike[],
  options: PlanningActivityLabelOptions = {}
): string {
  const label = buildPlanningActivityLabel(activity, index, activities, options);
  const name = options.isProgresiones
    ? stripProgressionPrefix(activity.name)
    : String(activity.name || '').trim();
  return name ? `${label}: ${name}` : label;
}
