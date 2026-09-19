import { SCHOOL_YEAR } from '@/lib/config';
import { sql } from './client';

// ─── Schedules Queries (Phase 4) ─────────────────────────────────────────────

export interface ScheduleItem {
  id?: string;
  teacher_id: string;
  title: string;
  school_name?: string;
  cct?: string;
  cycle_year?: string;
  period?: string;
  status?: string;
  config: Record<string, unknown>;
  grupos: unknown[];
  docentes: unknown[];
  aulas: unknown[];
  cargas: unknown[];
  celdas: unknown[];
  metricas?: Record<string, unknown> | null;
  ai_optimization_log?: unknown[];
  created_at?: string;
  updated_at?: string;
}

export async function getSchedules(teacherId?: string, status?: string) {
  const client = sql();
  return client`
    SELECT *
    FROM schedules
    WHERE (${teacherId}::uuid IS NULL OR teacher_id = ${teacherId}::uuid)
      AND (${status}::text IS NULL OR status = ${status})
    ORDER BY created_at DESC
  `;
}

export async function getScheduleById(id: string, teacherId?: string) {
  const client = sql();
  const rows = await client`
    SELECT *
    FROM schedules
    WHERE id = ${id}::uuid
      AND (${teacherId}::uuid IS NULL OR teacher_id = ${teacherId}::uuid)
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function createSchedule(data: ScheduleItem) {
  const client = sql();
  const rows = await client`
    INSERT INTO schedules (
      teacher_id, title, school_name, cct, cycle_year, period, status,
      config, grupos, docentes, aulas, cargas, celdas, metricas, ai_optimization_log
    ) VALUES (
      ${data.teacher_id}::uuid,
      ${data.title},
      ${data.school_name || null},
      ${data.cct || null},
      ${data.cycle_year || SCHOOL_YEAR},
      ${data.period || 'A'},
      ${data.status || 'published'},
      ${JSON.stringify(data.config || {})}::jsonb,
      ${JSON.stringify(data.grupos || [])}::jsonb,
      ${JSON.stringify(data.docentes || [])}::jsonb,
      ${JSON.stringify(data.aulas || [])}::jsonb,
      ${JSON.stringify(data.cargas || [])}::jsonb,
      ${JSON.stringify(data.celdas || [])}::jsonb,
      ${JSON.stringify(data.metricas || {})}::jsonb,
      ${JSON.stringify(data.ai_optimization_log || [])}::jsonb
    )
    RETURNING *
  `;
  return rows[0];
}

export async function updateSchedule(id: string, teacherId: string, data: Partial<ScheduleItem>) {
  const client = sql();
  const config = data.config !== undefined ? JSON.stringify(data.config) : null;
  const grupos = data.grupos !== undefined ? JSON.stringify(data.grupos) : null;
  const docentes = data.docentes !== undefined ? JSON.stringify(data.docentes) : null;
  const aulas = data.aulas !== undefined ? JSON.stringify(data.aulas) : null;
  const cargas = data.cargas !== undefined ? JSON.stringify(data.cargas) : null;
  const celdas = data.celdas !== undefined ? JSON.stringify(data.celdas) : null;
  const metricas = data.metricas !== undefined ? JSON.stringify(data.metricas) : null;
  const aiLog = data.ai_optimization_log !== undefined ? JSON.stringify(data.ai_optimization_log) : null;

  const rows = await client`
    UPDATE schedules SET
      title = COALESCE(${data.title ?? null}, title),
      status = COALESCE(${data.status ?? null}, status),
      config = CASE WHEN ${config}::text IS NOT NULL THEN ${config}::jsonb ELSE config END,
      grupos = CASE WHEN ${grupos}::text IS NOT NULL THEN ${grupos}::jsonb ELSE grupos END,
      docentes = CASE WHEN ${docentes}::text IS NOT NULL THEN ${docentes}::jsonb ELSE docentes END,
      aulas = CASE WHEN ${aulas}::text IS NOT NULL THEN ${aulas}::jsonb ELSE aulas END,
      cargas = CASE WHEN ${cargas}::text IS NOT NULL THEN ${cargas}::jsonb ELSE cargas END,
      celdas = CASE WHEN ${celdas}::text IS NOT NULL THEN ${celdas}::jsonb ELSE celdas END,
      metricas = CASE WHEN ${metricas}::text IS NOT NULL THEN ${metricas}::jsonb ELSE metricas END,
      ai_optimization_log = CASE WHEN ${aiLog}::text IS NOT NULL THEN ${aiLog}::jsonb ELSE ai_optimization_log END,
      updated_at = NOW()
    WHERE id = ${id}::uuid AND teacher_id = ${teacherId}::uuid
    RETURNING *
  `;
  if (!rows || rows.length === 0) return null;
  return rows[0];
}

export async function deleteSchedule(id: string, teacherId: string) {
  const client = sql();
  const rows = await client`
    DELETE FROM schedules
    WHERE id = ${id}::uuid AND teacher_id = ${teacherId}::uuid
    RETURNING id
  `;
  return rows[0] || null;
}
