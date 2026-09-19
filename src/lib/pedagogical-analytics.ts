// src/lib/pedagogical-analytics.ts
// Módulo 4: Analytics Pedagógico — funciones de lectura para el dashboard personal
import { sql } from './db/client';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FeedbackSummary {
  entity_type: string;
  avg_rating: number;
  total_count: number;
  recent_comment: string | null;
}

export interface PlanningStats {
  total_plannings: number;
  by_semester: Record<number, number>;
  by_component: Record<string, number>;
  recent: { id: string; uac_name: string; created_at: string }[];
}

export interface TeacherProgressSummary {
  feedback: FeedbackSummary[];
  plannings: PlanningStats;
  paec_count: number;
  pmc_count: number;
  pips_count: number;
  library_docs_count: number;
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function getTeacherProgressSummary(
  teacherId: string,
  teacherEmail: string
): Promise<TeacherProgressSummary> {
  const db = sql();

  // 1. Feedback promedio por tipo de entidad
  const feedbackRows = await db`
    SELECT
      entity_type,
      ROUND(AVG(rating)::numeric, 2)::float  AS avg_rating,
      COUNT(*)::int                           AS total_count,
      (
        SELECT comment FROM generation_feedback
        WHERE teacher_id = ${teacherId}::uuid
          AND entity_type = gf.entity_type
          AND comment IS NOT NULL
        ORDER BY created_at DESC
        LIMIT 1
      ) AS recent_comment
    FROM generation_feedback gf
    WHERE teacher_id = ${teacherId}::uuid
    GROUP BY entity_type
    ORDER BY entity_type
  `;

  // 2. Estadísticas de planeaciones
  const planningRows = await db`
    SELECT id, uac_name, semester, component, created_at
    FROM plannings
    WHERE teacher_id = ${teacherId}::uuid
    ORDER BY created_at DESC
    LIMIT 100
  `;

  const bySemester: Record<number, number> = {};
  const byComponent: Record<string, number> = {};

  for (const row of planningRows) {
    bySemester[row.semester] = (bySemester[row.semester] || 0) + 1;
    byComponent[row.component] = (byComponent[row.component] || 0) + 1;
  }

  const plannings: PlanningStats = {
    total_plannings: planningRows.length,
    by_semester: bySemester,
    by_component: byComponent,
    recent: planningRows.slice(0, 5).map((r) => ({
      id: r.id,
      uac_name: r.uac_name,
      created_at: r.created_at,
    })),
  };

  // 3. Conteos de otros módulos
  const [paecRow] = await db`
    SELECT COUNT(*)::int AS cnt FROM paec_projects WHERE teacher_id = ${teacherId}::uuid
  `;
  const [pmcRow] = await db`
    SELECT COUNT(*)::int AS cnt FROM pmc_projects WHERE teacher_id = ${teacherId}::uuid
  `;
  const [pipsRow] = await db`
    SELECT COUNT(*)::int AS cnt FROM pips_projects WHERE teacher_id = ${teacherId}::uuid
  `;
  const [libRow] = await db`
    SELECT COUNT(*)::int AS cnt FROM user_library_docs WHERE teacher_email = ${teacherEmail}
  `;

  return {
    feedback: feedbackRows as FeedbackSummary[],
    plannings,
    paec_count: paecRow?.cnt ?? 0,
    pmc_count: pmcRow?.cnt ?? 0,
    pips_count: pipsRow?.cnt ?? 0,
    library_docs_count: libRow?.cnt ?? 0,
  };
}
