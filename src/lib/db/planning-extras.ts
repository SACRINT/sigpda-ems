import type { PlanningExtra } from '@/types/planning';
import { sql } from './client';

// ─── Planning Extras queries ──────────────────────────────────────────────────

export interface PlanningExtraRecord extends PlanningExtra {
  planning_id: string;
  key_index: number | null;
  content_text: string;
  created_at: Date;
}

export function mapRawPlanningExtra(r: Record<string, unknown>): PlanningExtraRecord {
  return {
    id: r.id as string,
    planningId: r.planning_id as string,
    planning_id: r.planning_id as string,
    type: r.type as 'rubric' | 'checklist' | 'material' | 'lesson_plan' | 'practice_guide' | 'teacher_guide' | 'visual',
    title: r.title as string,
    keyIndex: (r.key_index as number | null) ?? null,
    key_index: (r.key_index as number | null) ?? null,
    contentText: r.content_text as string,
    content_text: r.content_text as string,
    createdAt: r.created_at as Date,
    created_at: r.created_at as Date,
  };
}

export async function getPlanningExtras(planningId: string, teacherId: string) {
  const rows = await sql()`
    SELECT pe.id, pe.planning_id, pe.type, pe.title, pe.key_index, pe.content_text, pe.created_at
    FROM planning_extras pe
    JOIN plannings p ON pe.planning_id = p.id
    WHERE pe.planning_id = ${planningId}::uuid AND p.teacher_id = ${teacherId}::uuid
    ORDER BY pe.created_at ASC
  `;
  return rows.map((r: Record<string, unknown>) => mapRawPlanningExtra(r));
}

export async function getPlanningExtraById(id: string, teacherId: string) {
  const rows = await sql()`
    SELECT pe.id, pe.planning_id, pe.type, pe.title, pe.key_index, pe.content_text, pe.created_at
    FROM planning_extras pe
    JOIN plannings p ON pe.planning_id = p.id
    WHERE pe.id = ${id}::uuid AND p.teacher_id = ${teacherId}::uuid
    LIMIT 1
  `;
  if (!rows || rows.length === 0) return null;
  return mapRawPlanningExtra(rows[0] as Record<string, unknown>);
}

export async function createPlanningExtra(
  data: {
    planningId: string;
    type: 'rubric' | 'checklist' | 'material' | 'lesson_plan' | 'practice_guide' | 'teacher_guide' | 'visual';
    title: string;
    keyIndex: number | null;
    contentText: string;
  },
  teacherId: string
) {
  // First verify planning ownership
  const pRows = await sql()`
    SELECT id FROM plannings
    WHERE id = ${data.planningId}::uuid AND teacher_id = ${teacherId}::uuid
    LIMIT 1
  `;
  if (pRows.length === 0) {
    throw new Error('Planeación no encontrada o no autorizada');
  }

  const rows = await sql()`
    INSERT INTO planning_extras (planning_id, type, title, key_index, content_text)
    VALUES (
      ${data.planningId}::uuid,
      ${data.type},
      ${data.title},
      ${data.keyIndex},
      ${data.contentText}
    )
    RETURNING id, planning_id, type, title, key_index, content_text, created_at
  `;
  return mapRawPlanningExtra(rows[0] as Record<string, unknown>);
}

export async function deletePlanningExtra(id: string, teacherId: string) {
  await sql()`
    DELETE FROM planning_extras
    WHERE id = ${id}::uuid AND planning_id IN (
      SELECT id FROM plannings WHERE teacher_id = ${teacherId}::uuid
    )
  `;
}
