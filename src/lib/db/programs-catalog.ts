import { sql } from './client';

// ─── Programs Catalog queries ────────────────────────────────────────────────

export interface ProgramCatalogItem {
  id?: string;
  uac_name: string;
  semester: number;
  component: string;
  curriculum_name?: string | null;
  year?: number;
  total_hours: number;
  learning_outcome: string;
  activities: unknown;
  evidences: unknown;
  contenidos_formativos?: unknown;
  subsystem?: string;
  model_type?: string;
  created_at?: string;
}

export async function getProgramsCatalog(semester?: number, component?: string, subsystem?: string) {
  const client = sql();
  const normalizedSubsystem = (subsystem && subsystem !== 'all' && subsystem !== 'todos') ? subsystem.toLowerCase() : null;
  const normalizedComponent = (component && component !== 'all' && component !== 'todos') ? component : null;
  const sem = (semester !== undefined && !isNaN(semester)) ? semester : null;

  return client`
    SELECT id, uac_name, semester, component, curriculum_name, year, total_hours, 
           learning_outcome, activities, evidences, contenidos_formativos, subsystem, model_type, created_at
    FROM programs_catalog
    WHERE (${sem}::int IS NULL OR semester = ${sem})
      AND (${normalizedComponent}::text IS NULL OR component = ${normalizedComponent})
      AND (${normalizedSubsystem}::text IS NULL OR subsystem = ${normalizedSubsystem} OR subsystem = 'bge' OR subsystem = 'all' OR subsystem IS NULL)
    ORDER BY semester ASC, component ASC, uac_name ASC
  `;
}

export async function getProgramsCatalogForPaec(semesters: number[], subsystem?: string) {
  const client = sql();
  if (subsystem && subsystem !== 'all') {
    return client`
      SELECT uac_name, semester, component, subsystem, model_type
      FROM programs_catalog
      WHERE semester = ANY(${semesters}) AND (subsystem = ${subsystem.toLowerCase()} OR subsystem = 'bge' OR subsystem = 'all' OR subsystem IS NULL)
      ORDER BY semester, uac_name ASC
    `;
  }
  return client`
    SELECT uac_name, semester, component, subsystem, model_type
    FROM programs_catalog
    WHERE semester = ANY(${semesters})
    ORDER BY semester, uac_name ASC
  `;
}

export async function createProgramCatalogItem(data: ProgramCatalogItem) {
  const rows = await sql()`
    INSERT INTO programs_catalog (
      uac_name, semester, component, curriculum_name, year, total_hours,
      learning_outcome, activities, evidences, contenidos_formativos, subsystem, model_type
    ) VALUES (
      ${data.uac_name.trim()},
      ${data.semester},
      ${data.component},
      ${data.curriculum_name || null},
      ${data.year || 2026},
      ${data.total_hours},
      ${data.learning_outcome},
      ${JSON.stringify(data.activities || [])}::jsonb,
      ${JSON.stringify(data.evidences || [])}::jsonb,
      ${data.contenidos_formativos ? JSON.stringify(data.contenidos_formativos) : null}::jsonb,
      ${(data.subsystem || 'bge').toLowerCase()},
      ${data.model_type || (data.semester >= 5 ? 'progresiones' : 'propositos_contenidos')}
    )
    ON CONFLICT (uac_name, semester, component, subsystem)
    DO UPDATE SET
      curriculum_name = EXCLUDED.curriculum_name,
      year = EXCLUDED.year,
      total_hours = EXCLUDED.total_hours,
      learning_outcome = EXCLUDED.learning_outcome,
      activities = EXCLUDED.activities,
      evidences = EXCLUDED.evidences,
      contenidos_formativos = EXCLUDED.contenidos_formativos,
      model_type = EXCLUDED.model_type
    RETURNING *
  `;
  return rows[0];
}

export async function updateProgramCatalogItem(id: string, data: Partial<ProgramCatalogItem>) {
  const uac_name = data.uac_name !== undefined ? data.uac_name.trim() : null;
  const activities = data.activities !== undefined ? JSON.stringify(data.activities) : null;
  const evidences = data.evidences !== undefined ? JSON.stringify(data.evidences) : null;
  const contenidos_formativos = data.contenidos_formativos !== undefined ? JSON.stringify(data.contenidos_formativos) : null;
  const subsystem = data.subsystem !== undefined ? data.subsystem.toLowerCase() : null;

  const rows = await sql()`
    UPDATE programs_catalog SET
      uac_name = COALESCE(${uac_name}, uac_name),
      semester = COALESCE(${data.semester ?? null}, semester),
      component = COALESCE(${data.component ?? null}, component),
      curriculum_name = COALESCE(${data.curriculum_name ?? null}, curriculum_name),
      year = COALESCE(${data.year ?? null}, year),
      total_hours = COALESCE(${data.total_hours ?? null}, total_hours),
      learning_outcome = COALESCE(${data.learning_outcome ?? null}, learning_outcome),
      activities = CASE WHEN ${activities}::text IS NOT NULL THEN ${activities}::jsonb ELSE activities END,
      evidences = CASE WHEN ${evidences}::text IS NOT NULL THEN ${evidences}::jsonb ELSE evidences END,
      contenidos_formativos = CASE WHEN ${contenidos_formativos}::text IS NOT NULL THEN ${contenidos_formativos}::jsonb ELSE contenidos_formativos END,
      subsystem = COALESCE(${subsystem}, subsystem),
      model_type = COALESCE(${data.model_type ?? null}, model_type)
    WHERE id = ${id}::uuid
    RETURNING *
  `;
  if (!rows || rows.length === 0) return null;
  return rows[0];
}

export async function deleteProgramCatalogItem(id: string) {
  const rows = await sql()`
    DELETE FROM programs_catalog WHERE id = ${id}::uuid RETURNING id, uac_name
  `;
  return rows[0];
}

// ─── Program Lookup & Continuity ─────────────────────────────────────────────

export async function getProgramByUacAndSemester(
  uacName: string,
  semester?: number,
  component?: string,
  subsystem?: string
): Promise<ProgramCatalogItem | null> {
  const client = sql();
  const sem = (semester !== undefined && !isNaN(semester)) ? semester : null;
  const comp = component && component !== 'all' ? component : null;
  const sub = subsystem && subsystem !== 'all' ? subsystem.toLowerCase() : null;

  // 1. Intento con el subsistema específico o fallback canónico 'bge'
  let rows = await client`
    SELECT *
    FROM programs_catalog
    WHERE (
      uac_name ILIKE ${uacName.trim()} 
      OR uac_name ILIKE ${'%' + uacName.trim() + '%'}
      OR ${uacName.trim()} ILIKE ('%' || uac_name || '%')
    )
    AND (${sem}::int IS NULL OR semester = ${sem})
    AND (${comp}::text IS NULL OR component = ${comp})
    AND (${sub}::text IS NULL OR subsystem = ${sub} OR subsystem = 'bge' OR subsystem = 'all')
    ORDER BY 
      CASE WHEN LOWER(uac_name) = LOWER(${uacName.trim()}) THEN 0 ELSE 1 END,
      CASE WHEN ${sub}::text IS NOT NULL AND subsystem = ${sub} THEN 0 ELSE 1 END,
      CASE WHEN subsystem = 'bge' THEN 0 ELSE 1 END
    LIMIT 1
  `;

  // 2. Fallback sin restricción de componente si no se encontró
  if (rows.length === 0) {
    rows = await client`
      SELECT *
      FROM programs_catalog
      WHERE (
        uac_name ILIKE ${uacName.trim()} 
        OR uac_name ILIKE ${'%' + uacName.trim() + '%'}
        OR ${uacName.trim()} ILIKE ('%' || uac_name || '%')
      )
      AND (${sem}::int IS NULL OR semester = ${sem})
      ORDER BY 
        CASE WHEN LOWER(uac_name) = LOWER(${uacName.trim()}) THEN 0 ELSE 1 END,
        CASE WHEN subsystem = 'bge' THEN 0 ELSE 1 END
      LIMIT 1
    `;
  }

  return (rows[0] as ProgramCatalogItem) || null;
}

export async function getFfeContinuity(uacName: string) {
  const client = sql();
  const rows = await client`
    SELECT *
    FROM ffe_continuity
    WHERE semester_5_uac ILIKE ${'%' + uacName.trim() + '%'} 
       OR semester_6_uac ILIKE ${'%' + uacName.trim() + '%'}
    LIMIT 1
  `;
  return rows[0] || null;
}
