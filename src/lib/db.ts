import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import type {
  ActiveWorkTextbook,
  CanonicalSeed,
  GenerationProgressState,
} from '@/types/work-textbook';

// ─── Lazy SQL client ────────────────────────────────────────────────────────
// Instantiated on first call at runtime, not at build time.
// Prevents Vercel build failures when DATABASE_URL is missing during static analysis.
let _client: NeonQueryFunction<false, false> | null = null;

export function sql(): NeonQueryFunction<false, false> {
  if (!_client) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    _client = neon(process.env.DATABASE_URL);
  }
  return _client;
}

// ─── Teacher queries ────────────────────────────────────────────────────────

export async function getTeacherByEmail(email: string) {
  const rows = await sql()`
    SELECT id, name, email, school_name, municipality, subsystem, cct,
           custom_api_key, custom_api_provider, role, created_at,
           profile_completed, school_locked, is_blocked, is_premium, password_hash
    FROM teachers
    WHERE email = ${email.toLowerCase().trim()}
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function getTeacherById(id: string) {
  const rows = await sql()`
    SELECT id, name, email, school_name, municipality, subsystem, cct,
           custom_api_key, custom_api_provider, role, created_at,
           profile_completed, school_locked, is_blocked, is_premium
    FROM teachers
    WHERE id = ${id}::uuid
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function createTeacherWithPassword(data: {
  name: string;
  email: string;
  passwordHash: string;
  schoolName?: string;
  cct?: string;
  municipality?: string;
  subsystem?: string;
  role?: string;
}) {
  const cleanEmail = data.email.toLowerCase().trim();
  const rows = await sql()`
    INSERT INTO teachers (
      name, email, password_hash, school_name, cct,
      municipality, subsystem, role, profile_completed
    ) VALUES (
      ${data.name.trim()},
      ${cleanEmail},
      ${data.passwordHash},
      ${data.schoolName?.trim() || null},
      ${data.cct?.toUpperCase().trim() || null},
      ${data.municipality?.trim() || null},
      ${data.subsystem?.toLowerCase().trim() || 'bge'},
      ${data.role || 'docente'},
      TRUE
    )
    RETURNING id, name, email, role, school_name, cct, subsystem, created_at
  `;
  return rows[0];
}

export async function setTeacherResetToken(email: string, token: string, expires: Date) {
  const rows = await sql()`
    UPDATE teachers
    SET reset_token = ${token}, reset_token_expires = ${expires.toISOString()}
    WHERE email = ${email.toLowerCase().trim()}
    RETURNING id, email
  `;
  return rows[0] || null;
}

export async function verifyAndResetPassword(token: string, newPasswordHash: string) {
  const rows = await sql()`
    UPDATE teachers
    SET
      password_hash = ${newPasswordHash},
      reset_token = NULL,
      reset_token_expires = NULL,
      updated_at = NOW()
    WHERE reset_token = ${token}
      AND reset_token_expires > NOW()
    RETURNING id, email, name
  `;
  return rows[0] || null;
}

export async function updateTeacherKey(teacherId: string, customApiKey: string | null, customApiProvider: string | null) {
  const rows = await sql()`
    UPDATE teachers
    SET
      custom_api_key = ${customApiKey},
      custom_api_provider = ${customApiProvider}
    WHERE id = ${teacherId}::uuid
    RETURNING id, email, custom_api_provider
  `;
  return rows[0];
}

export async function createTeacher(data: {
  name: string;
  email: string;
  schoolName?: string;
  municipality?: string;
  subsystem?: string;
}) {
  const rows = await sql()`
    INSERT INTO teachers (name, email, school_name, municipality, subsystem)
    VALUES (${data.name}, ${data.email.toLowerCase().trim()}, ${data.schoolName || null}, ${data.municipality || null}, ${data.subsystem || null})
    RETURNING id, name, email, school_name, municipality, subsystem, created_at
  `;
  return rows[0];
}

export async function upsertTeacher(data: {
  name: string;
  email: string;
}) {
  const cleanEmail = data.email.toLowerCase().trim();
  const rows = await sql()`
    INSERT INTO teachers (name, email)
    VALUES (${data.name}, ${cleanEmail})
    ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
    RETURNING id, name, email, school_name, municipality, subsystem, created_at
  `;
  return rows[0];
}

export async function updateTeacherProfile(teacherId: string, data: {
  schoolName?: string;
  municipality?: string;
  subsystem?: string;
  cct?: string;
}) {
  const rows = await sql()`
    UPDATE teachers
    SET
      school_name = COALESCE(${data.schoolName || null}, school_name),
      municipality = COALESCE(${data.municipality || null}, municipality),
      subsystem = COALESCE(${data.subsystem || null}, subsystem),
      cct = COALESCE(${data.cct || null}, cct),
      profile_completed = TRUE,
      updated_at = NOW()
    WHERE id = ${teacherId}::uuid
    RETURNING *
  `;
  return rows[0];
}

// ─── Planning queries ───────────────────────────────────────────────────────

export async function getPlanningsByTeacher(teacherId: string) {
  return sql()`
    SELECT id, teacher_id, uac_name, semester, component, curriculum_name,
           status, created_at, updated_at
    FROM plannings
    WHERE teacher_id = ${teacherId}::uuid
    ORDER BY created_at DESC
  `;
}

export async function getPlanningById(id: string, teacherId?: string) {
  if (teacherId) {
    const rows = await sql()`
      SELECT *
      FROM plannings
      WHERE id = ${id}::uuid AND teacher_id = ${teacherId}::uuid
      LIMIT 1
    `;
    return rows[0] || null;
  }
  const rows = await sql()`
    SELECT *
    FROM plannings
    WHERE id = ${id}::uuid
    LIMIT 1
  `;
  return rows[0] || null;
}


export async function createPlanning(data: {
  teacherId: string;
  uacName: string;
  semester: number;
  component: string;
  curriculumName?: string;
  paecContext?: string;
  extractedData?: object;
  metodologiaActiva?: string;   // ID de metodología activa seleccionada (ej: 'abp', 'steam')
}) {
  const rows = await sql()`
    INSERT INTO plannings (
      teacher_id, uac_name, semester, component,
      curriculum_name, paec_context, extracted_data, status,
      metodologia_activa
    )
    VALUES (
      ${data.teacherId}::uuid,
      ${data.uacName},
      ${data.semester},
      ${data.component},
      ${data.curriculumName || null},
      ${data.paecContext || null},
      ${data.extractedData ? JSON.stringify(data.extractedData) : null},
      'draft',
      ${data.metodologiaActiva || null}
    )
    RETURNING *
  `;
  return rows[0];
}

export async function updatePlanningContent(
  id: string,
  teacherId: string,
  contentJson: object
) {
  const rows = await sql()`
    UPDATE plannings
    SET
      content_json = ${JSON.stringify(contentJson)},
      status = 'generated',
      updated_at = NOW()
    WHERE id = ${id}::uuid AND teacher_id = ${teacherId}::uuid
    RETURNING *
  `;
  return rows[0];
}

export async function markPlanningDownloaded(id: string, teacherId: string) {
  await sql()`
    UPDATE plannings
    SET status = 'downloaded', updated_at = NOW()
    WHERE id = ${id}::uuid AND teacher_id = ${teacherId}::uuid
  `;
}

export async function deletePlanning(id: string, teacherId: string) {
  await sql()`
    DELETE FROM plannings
    WHERE id = ${id}::uuid AND teacher_id = ${teacherId}::uuid
  `;
}

// ─── PDF uploads ─────────────────────────────────────────────────────────────

export async function savePdfUpload(data: {
  teacherId: string;
  planningId?: string;
  filename: string;
  blobUrl: string;
  parsedOk: boolean;
}) {
  const rows = await sql()`
    INSERT INTO uploaded_pdfs (teacher_id, planning_id, filename, blob_url, parsed_ok)
    VALUES (
      ${data.teacherId}::uuid,
      ${data.planningId ? data.planningId : null},
      ${data.filename},
      ${data.blobUrl},
      ${data.parsedOk}
    )
    RETURNING *
  `;
  return rows[0];
}

// ─── Programs Catalog queries ────────────────────────────────────────────────

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
  activities: any;
  evidences: any;
  contenidos_formativos?: any;
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
      AND (${normalizedSubsystem}::text IS NULL OR subsystem = ${normalizedSubsystem} OR subsystem = 'all' OR subsystem IS NULL)
    ORDER BY semester ASC, component ASC, uac_name ASC
  `;
}

export async function getProgramsCatalogForPaec(semesters: number[], subsystem?: string) {
  const client = sql();
  if (subsystem && subsystem !== 'all') {
    return client`
      SELECT uac_name, semester, component, subsystem, model_type
      FROM programs_catalog
      WHERE semester = ANY(${semesters}) AND (subsystem = ${subsystem.toLowerCase()} OR subsystem = 'all' OR subsystem IS NULL)
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
  const existing = await sql()`SELECT * FROM programs_catalog WHERE id = ${id}::uuid LIMIT 1`;
  if (existing.length === 0) return null;

  const current = existing[0];
  const uac_name = data.uac_name !== undefined ? data.uac_name.trim() : current.uac_name;
  const semester = data.semester !== undefined ? data.semester : current.semester;
  const component = data.component !== undefined ? data.component : current.component;
  const curriculum_name = data.curriculum_name !== undefined ? data.curriculum_name : current.curriculum_name;
  const year = data.year !== undefined ? data.year : current.year;
  const total_hours = data.total_hours !== undefined ? data.total_hours : current.total_hours;
  const learning_outcome = data.learning_outcome !== undefined ? data.learning_outcome : current.learning_outcome;
  const activities = data.activities !== undefined ? JSON.stringify(data.activities) : JSON.stringify(current.activities);
  const evidences = data.evidences !== undefined ? JSON.stringify(data.evidences) : JSON.stringify(current.evidences);
  const contenidos_formativos = data.contenidos_formativos !== undefined ? JSON.stringify(data.contenidos_formativos) : (current.contenidos_formativos ? JSON.stringify(current.contenidos_formativos) : null);
  const subsystem = data.subsystem !== undefined ? data.subsystem.toLowerCase() : current.subsystem;
  const model_type = data.model_type !== undefined ? data.model_type : current.model_type;

  const rows = await sql()`
    UPDATE programs_catalog SET
      uac_name = ${uac_name},
      semester = ${semester},
      component = ${component},
      curriculum_name = ${curriculum_name},
      year = ${year},
      total_hours = ${total_hours},
      learning_outcome = ${learning_outcome},
      activities = ${activities}::jsonb,
      evidences = ${evidences}::jsonb,
      contenidos_formativos = ${contenidos_formativos ? contenidos_formativos : null}::jsonb,
      subsystem = ${subsystem},
      model_type = ${model_type}
    WHERE id = ${id}::uuid
    RETURNING *
  `;
  return rows[0];
}

export async function deleteProgramCatalogItem(id: string) {
  const rows = await sql()`
    DELETE FROM programs_catalog WHERE id = ${id}::uuid RETURNING id, uac_name
  `;
  return rows[0];
}


// ─── Planning Extras queries ──────────────────────────────────────────────────

export async function getPlanningExtras(planningId: string, teacherId: string) {
  return sql()`
    SELECT pe.id, pe.planning_id, pe.type, pe.title, pe.key_index, pe.content_text, pe.created_at
    FROM planning_extras pe
    JOIN plannings p ON pe.planning_id = p.id
    WHERE pe.planning_id = ${planningId}::uuid AND p.teacher_id = ${teacherId}::uuid
    ORDER BY pe.created_at ASC
  `;
}

export async function getPlanningExtraById(id: string, teacherId: string) {
  const rows = await sql()`
    SELECT pe.id, pe.planning_id, pe.type, pe.title, pe.key_index, pe.content_text, pe.created_at
    FROM planning_extras pe
    JOIN plannings p ON pe.planning_id = p.id
    WHERE pe.id = ${id}::uuid AND p.teacher_id = ${teacherId}::uuid
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function createPlanningExtra(
  data: {
    planningId: string;
    type: 'rubric' | 'checklist' | 'material' | 'lesson_plan' | 'practice_guide';
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
  return rows[0];
}

export async function deletePlanningExtra(id: string, teacherId: string) {
  await sql()`
    DELETE FROM planning_extras
    WHERE id = ${id}::uuid AND planning_id IN (
      SELECT id FROM plannings WHERE teacher_id = ${teacherId}::uuid
    )
  `;
}

// ─── PAEC Projects queries ──────────────────────────────────────────────────

export async function getPaecProjectsByTeacher(teacherId: string) {
  return sql()`
    SELECT id, teacher_id, project_name, problem_statement, cycle_type, current_step, status, created_at, updated_at
    FROM paec_projects
    WHERE teacher_id = ${teacherId}::uuid
    ORDER BY created_at DESC
  `;
}

export async function getPaecProjectById(id: string, teacherId: string) {
  const rows = await sql()`
    SELECT *
    FROM paec_projects
    WHERE id = ${id}::uuid AND teacher_id = ${teacherId}::uuid
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function createPaecProject(data: {
  teacherId: string;
  projectName: string;
  problemStatement: string;
  cycleType: string;
  communityContext: object;
  schoolContext: object;
}) {
  const rows = await sql()`
    INSERT INTO paec_projects (
      teacher_id, project_name, problem_statement, cycle_type,
      community_context, school_context, current_step, status
    )
    VALUES (
      ${data.teacherId}::uuid,
      ${data.projectName},
      ${data.problemStatement},
      ${data.cycleType},
      ${JSON.stringify(data.communityContext)}::jsonb,
      ${JSON.stringify(data.schoolContext)}::jsonb,
      1,
      'draft'
    )
    RETURNING *
  `;
  return rows[0];
}

export async function updatePaecProjectStep(
  id: string,
  teacherId: string,
  step: number,
  fieldName: string,
  stepData: object
) {
  const status = step === 6 ? 'completed' : 'draft';
  const dataStr = JSON.stringify(stepData);

  let rows;
  if (fieldName === 'fase1_diagnostico') {
    rows = await sql()`
      UPDATE paec_projects
      SET fase1_diagnostico = ${dataStr}::jsonb, current_step = ${step}, status = ${status}, updated_at = NOW()
      WHERE id = ${id}::uuid AND teacher_id = ${teacherId}::uuid
      RETURNING *
    `;
  } else if (fieldName === 'fase2_justificacion') {
    rows = await sql()`
      UPDATE paec_projects
      SET fase2_justificacion = ${dataStr}::jsonb, current_step = ${step}, status = ${status}, updated_at = NOW()
      WHERE id = ${id}::uuid AND teacher_id = ${teacherId}::uuid
      RETURNING *
    `;
  } else if (fieldName === 'fase2_mapeo') {
    rows = await sql()`
      UPDATE paec_projects
      SET fase2_mapeo = ${dataStr}::jsonb, current_step = ${step}, status = ${status}, updated_at = NOW()
      WHERE id = ${id}::uuid AND teacher_id = ${teacherId}::uuid
      RETURNING *
    `;
  } else if (fieldName === 'fase2_cronograma') {
    rows = await sql()`
      UPDATE paec_projects
      SET fase2_cronograma = ${dataStr}::jsonb, current_step = ${step}, status = ${status}, updated_at = NOW()
      WHERE id = ${id}::uuid AND teacher_id = ${teacherId}::uuid
      RETURNING *
    `;
  } else if (fieldName === 'fase2_plan_operativo') {
    rows = await sql()`
      UPDATE paec_projects
      SET fase2_plan_operativo = ${dataStr}::jsonb, current_step = ${step}, status = ${status}, updated_at = NOW()
      WHERE id = ${id}::uuid AND teacher_id = ${teacherId}::uuid
      RETURNING *
    `;
  } else if (fieldName === 'fase2_anexos') {
    rows = await sql()`
      UPDATE paec_projects
      SET fase2_anexos = ${dataStr}::jsonb, current_step = ${step}, status = ${status}, updated_at = NOW()
      WHERE id = ${id}::uuid AND teacher_id = ${teacherId}::uuid
      RETURNING *
    `;
  } else {
    throw new Error('Campo de paso no válido');
  }
  return rows[0];
}

export async function deletePaecProject(id: string, teacherId: string) {
  await sql()`
    DELETE FROM paec_projects
    WHERE id = ${id}::uuid AND teacher_id = ${teacherId}::uuid
  `;
}

// ─── Program Lookup & Audit Feedback ─────────────────────────────────────────

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

  const rows = await client`
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
      CASE WHEN ${comp}::text IS NOT NULL AND component = ${comp} THEN 0 ELSE 1 END,
      CASE WHEN ${sub}::text IS NOT NULL AND subsystem = ${sub} THEN 0 ELSE 1 END
    LIMIT 1
  `;
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

export async function getAuditResultByPlanningId(planningId: string) {
  const client = sql();
  const rows = await client`
    SELECT *
    FROM audit_results
    WHERE planning_id = ${planningId}::uuid
    ORDER BY created_at DESC
    LIMIT 1
  `;
  return rows[0] || null;
}

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
  config: any;
  grupos: any[];
  docentes: any[];
  aulas: any[];
  cargas: any[];
  celdas: any[];
  metricas?: any;
  ai_optimization_log?: any[];
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
      ${data.cycle_year || '2026-2027'},
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
  const existing = await getScheduleById(id, teacherId);
  if (!existing) return null;

  const title = data.title !== undefined ? data.title : existing.title;
  const status = data.status !== undefined ? data.status : existing.status;
  const config = data.config !== undefined ? JSON.stringify(data.config) : JSON.stringify(existing.config);
  const grupos = data.grupos !== undefined ? JSON.stringify(data.grupos) : JSON.stringify(existing.grupos);
  const docentes = data.docentes !== undefined ? JSON.stringify(data.docentes) : JSON.stringify(existing.docentes);
  const aulas = data.aulas !== undefined ? JSON.stringify(data.aulas) : JSON.stringify(existing.aulas);
  const cargas = data.cargas !== undefined ? JSON.stringify(data.cargas) : JSON.stringify(existing.cargas);
  const celdas = data.celdas !== undefined ? JSON.stringify(data.celdas) : JSON.stringify(existing.celdas);
  const metricas = data.metricas !== undefined ? JSON.stringify(data.metricas) : JSON.stringify(existing.metricas);
  const aiLog = data.ai_optimization_log !== undefined ? JSON.stringify(data.ai_optimization_log) : JSON.stringify(existing.ai_optimization_log);

  const rows = await client`
    UPDATE schedules SET
      title = ${title},
      status = ${status},
      config = ${config}::jsonb,
      grupos = ${grupos}::jsonb,
      docentes = ${docentes}::jsonb,
      aulas = ${aulas}::jsonb,
      cargas = ${cargas}::jsonb,
      celdas = ${celdas}::jsonb,
      metricas = ${metricas}::jsonb,
      ai_optimization_log = ${aiLog}::jsonb,
      updated_at = NOW()
    WHERE id = ${id}::uuid AND teacher_id = ${teacherId}::uuid
    RETURNING *
  `;
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

// ─── Notifications Queries (Phase 4) ─────────────────────────────────────────

export interface NotificationItem {
  id?: string;
  user_id: string;
  type: 'planeacion_ready' | 'audit_result' | 'deadline_reminder' | 'ffe_continuity' | 'bundle_generated' | 'document_signed' | string;
  title: string;
  message: string;
  link?: string;
  severity?: 'info' | 'warning' | 'error' | 'success';
  channels?: string[];
  metadata?: Record<string, any>;
  read?: boolean;
  created_at?: string;
}

export async function getNotifications(userId: string, unreadOnly: boolean = false) {
  const client = sql();
  return client`
    SELECT *
    FROM notifications
    WHERE user_id = ${userId}::uuid
      AND (${unreadOnly}::boolean = FALSE OR read = FALSE)
    ORDER BY created_at DESC
    LIMIT 50
  `;
}

export async function getUnreadNotificationsCount(userId: string): Promise<number> {
  const client = sql();
  const rows = await client`
    SELECT COUNT(*)::int as total
    FROM notifications
    WHERE user_id = ${userId}::uuid AND read = FALSE
  `;
  return rows[0]?.total || 0;
}

export async function createNotification(data: NotificationItem) {
  const client = sql();
  const channelsJson = JSON.stringify(data.channels || ['in_app']);
  const metadataJson = JSON.stringify(data.metadata || {});

  const rows = await client`
    INSERT INTO notifications (
      user_id, type, title, message, link, severity, channels, metadata, read
    ) VALUES (
      ${data.user_id}::uuid,
      ${data.type},
      ${data.title},
      ${data.message},
      ${data.link || null},
      ${data.severity || 'info'},
      ${channelsJson}::jsonb,
      ${metadataJson}::jsonb,
      ${data.read || false}
    )
    RETURNING *
  `;
  return rows[0];
}

export async function getAutomationRules(activeOnly: boolean = true) {
  const client = sql();
  return client`
    SELECT *
    FROM automation_rules
    WHERE (${activeOnly}::boolean = FALSE OR active = TRUE)
    ORDER BY created_at ASC
  `;
}

export async function markNotificationAsRead(id: string, userId: string) {

  const client = sql();
  const rows = await client`
    UPDATE notifications
    SET read = TRUE
    WHERE id = ${id}::uuid AND user_id = ${userId}::uuid
    RETURNING *
  `;
  return rows[0] || null;
}

export async function markAllNotificationsAsRead(userId: string) {
  const client = sql();
  await client`
    UPDATE notifications
    SET read = TRUE
    WHERE user_id = ${userId}::uuid AND read = FALSE
  `;
  return true;
}

export async function deleteNotification(id: string, userId: string) {
  const client = sql();
  const rows = await client`
    DELETE FROM notifications
    WHERE id = ${id}::uuid AND user_id = ${userId}::uuid
    RETURNING id
  `;
  return rows[0] || null;
}

// ─── Work-Textbook & Canonical Seeds Engine ─────────────────────────────────

/**
 * Inicializa dinámicamente las tablas e índices del motor editorial si no existen
 */
export async function initWorkTextbookTables(): Promise<void> {
  const client = sql();
  await client`
    CREATE TABLE IF NOT EXISTS educational_canonical_seeds (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      uac_id TEXT NOT NULL,
      subsystem TEXT NOT NULL,
      topic TEXT NOT NULL,
      practice_type TEXT NOT NULL,
      content JSONB NOT NULL,
      source TEXT DEFAULT 'ai_generated',
      quality_score INTEGER DEFAULT 80,
      times_used INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;

  await client`
    CREATE INDEX IF NOT EXISTS idx_seeds_uac ON educational_canonical_seeds(uac_id, subsystem);
  `;
  await client`
    CREATE INDEX IF NOT EXISTS idx_seeds_quality ON educational_canonical_seeds(quality_score);
  `;
  await client`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_seeds_uac_topic_sub ON educational_canonical_seeds(uac_id, topic, subsystem);
  `;

  await client`
    ALTER TABLE plannings ADD COLUMN IF NOT EXISTS workbooks_json JSONB DEFAULT '{}'::jsonb;
  `;
  await client`
    ALTER TABLE plannings ADD COLUMN IF NOT EXISTS workbook_progress JSONB DEFAULT '{}'::jsonb;
  `;
}

/**
 * Busca una semilla canónica de alta calidad (score >= 80) para un tema específico
 */
export async function findCanonicalSeed(
  uacId: string,
  topic: string,
  subsystem?: string
): Promise<CanonicalSeed | null> {
  const client = sql();
  try {
    const cleanTopic = topic.trim().toLowerCase();
    const rows = await client`
      SELECT id, uac_id, subsystem, topic, practice_type, content,
             source, quality_score, times_used, created_at, updated_at
      FROM educational_canonical_seeds
      WHERE uac_id = ${uacId}
        AND (${subsystem || null}::text IS NULL OR subsystem = ${subsystem})
        AND LOWER(topic) = ${cleanTopic}
        AND quality_score >= 80
      ORDER BY quality_score DESC, times_used DESC
      LIMIT 1
    `;

    if (!rows || rows.length === 0) return null;

    const r = rows[0];
    return {
      id: r.id,
      uacId: r.uac_id,
      subsystem: r.subsystem,
      topic: r.topic,
      practiceType: r.practice_type,
      content: r.content,
      source: r.source,
      qualityScore: r.quality_score,
      timesUsed: r.times_used,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  } catch (err) {
    console.warn('[findCanonicalSeed] Warning:', err);
    return null;
  }
}

/**
 * Almacena o actualiza una semilla canónica de forma atómica con ON CONFLICT (quality_score >= 80)
 * y no sobreescribe semillas con mejor calidad existente.
 */
export async function saveCanonicalSeed(seed: CanonicalSeed): Promise<CanonicalSeed | null> {
  if (seed.qualityScore < 80) {
    return null; // Quality gate: no almacenar contenido de baja calidad
  }

  const client = sql();
  try {
    const cleanTopic = seed.topic.trim();
    const contentJson = JSON.stringify(seed.content);

    // Operación atómica con ON CONFLICT para evitar race conditions concurrentes
    const rows = await client`
      INSERT INTO educational_canonical_seeds (
        uac_id, subsystem, topic, practice_type, content,
        source, quality_score, times_used
      ) VALUES (
        ${seed.uacId},
        ${seed.subsystem},
        ${cleanTopic},
        ${seed.practiceType},
        ${contentJson}::jsonb,
        ${seed.source || 'ai_generated'},
        ${seed.qualityScore},
        0
      )
      ON CONFLICT (uac_id, topic, subsystem)
      DO UPDATE SET
        content = EXCLUDED.content,
        quality_score = EXCLUDED.quality_score,
        practice_type = EXCLUDED.practice_type,
        source = EXCLUDED.source,
        updated_at = NOW()
      WHERE EXCLUDED.quality_score > educational_canonical_seeds.quality_score
      RETURNING *
    `;

    if (rows && rows.length > 0) {
      return rows[0] as any;
    }

    // Si no retornó fila modificada, la semilla existente tiene mejor o igual calidad
    return await findCanonicalSeed(seed.uacId, cleanTopic, seed.subsystem);
  } catch (err) {
    console.error('[saveCanonicalSeed] Error:', err);
    return null;
  }
}

/**
 * Incrementa el contador de uso de una semilla reutilizada
 */
export async function incrementSeedUsage(seedId: string): Promise<void> {
  const client = sql();
  try {
    await client`
      UPDATE educational_canonical_seeds
      SET times_used = times_used + 1,
          updated_at = NOW()
      WHERE id = ${seedId}::uuid
    `;
  } catch (err) {
    console.warn('[incrementSeedUsage] Error:', err);
  }
}

/**
 * Guarda o actualiza el Libro de Trabajo de un bloque en la columna workbooks_json de plannings
 * Maneja historial de versiones (version: 1, 2, ...) y valida que la planeación exista.
 */
export async function saveBlockWorkbook(
  planningId: string,
  blockIndex: number,
  workbook: ActiveWorkTextbook
): Promise<{ version: number; success: boolean; error?: string }> {
  if (isNaN(blockIndex) || blockIndex < 0) {
    return { version: 0, success: false, error: 'blockIndex inválido (NaN o negativo)' };
  }

  const client = sql();
  const blockKey = `block_${blockIndex}`;

  // 1. Obtener los workbooks actuales de la planeación verificando existencia
  const rows = await client`
    SELECT id, workbooks_json
    FROM plannings
    WHERE id = ${planningId}::uuid
    LIMIT 1
  `;

  if (!rows || rows.length === 0) {
    return { version: 0, success: false, error: 'Planning not found' };
  }

  const currentWorkbooks = (rows[0]?.workbooks_json || {}) as Record<string, any>;
  const existingBlockData = currentWorkbooks[blockKey] || { version: 0, history: [] };
  const newVersion = (existingBlockData.version || 0) + 1;
  workbook.version = newVersion;

  const historyItem = existingBlockData.current
    ? {
        version: existingBlockData.version,
        generatedAt: existingBlockData.current.generatedAt,
        totalPages: existingBlockData.current.totalPages,
        totalWords: existingBlockData.current.totalWords,
        qualityScore: existingBlockData.current.qualityScore,
        qualityWarning: existingBlockData.current.qualityWarning,
      }
    : null;

  const updatedHistory = existingBlockData.history || [];
  if (historyItem) {
    updatedHistory.push(historyItem);
  }

  const blockEntry = {
    version: newVersion,
    current: workbook,
    history: updatedHistory,
  };

  const updateResult = await client`
    UPDATE plannings
    SET workbooks_json = jsonb_set(
      COALESCE(workbooks_json, '{}'::jsonb),
      ARRAY[${blockKey}],
      ${JSON.stringify(blockEntry)}::jsonb,
      true
    ),
    updated_at = NOW()
    WHERE id = ${planningId}::uuid
    RETURNING id
  `;

  if (!updateResult || updateResult.length === 0) {
    return { version: 0, success: false, error: 'Failed to update planning' };
  }

  return { version: newVersion, success: true };
}

/**
 * Obtiene el Libro de Trabajo actual de un bloque específico
 */
export async function getBlockWorkbook(
  planningId: string,
  blockIndex: number
): Promise<ActiveWorkTextbook | null> {
  const client = sql();
  const blockKey = `block_${blockIndex}`;

  const rows = await client`
    SELECT workbooks_json
    FROM plannings
    WHERE id = ${planningId}::uuid
    LIMIT 1
  `;

  if (!rows || rows.length === 0) return null;
  const workbooks = rows[0].workbooks_json || {};
  return workbooks[blockKey]?.current || null;
}

/**
 * Obtiene todos los libros generados para una planeación (para compilación semestral)
 */
export async function getAllBlockWorkbooks(
  planningId: string
): Promise<Record<string, { version: number; current: ActiveWorkTextbook; history: any[] }>> {
  const client = sql();
  const rows = await client`
    SELECT workbooks_json
    FROM plannings
    WHERE id = ${planningId}::uuid
    LIMIT 1
  `;

  if (!rows || rows.length === 0) return {};
  return rows[0].workbooks_json || {};
}

/**
 * Actualiza el progreso en vivo de la generación del libro
 */
export async function updateWorkbookProgress(
  planningId: string,
  blockIndex: number,
  progress: GenerationProgressState
): Promise<void> {
  const client = sql();
  const blockKey = `block_${blockIndex}`;

  const rows = await client`
    SELECT workbook_progress
    FROM plannings
    WHERE id = ${planningId}::uuid
    LIMIT 1
  `;

  const currentProgress = (rows[0]?.workbook_progress || {}) as Record<string, any>;
  currentProgress[blockKey] = progress;

  await client`
    UPDATE plannings
    SET workbook_progress = ${JSON.stringify(currentProgress)}::jsonb
    WHERE id = ${planningId}::uuid
  `;
}

/**
 * Obtiene el estado de progreso en vivo de la generación de un bloque
 */
export async function getWorkbookProgress(
  planningId: string,
  blockIndex: number
): Promise<GenerationProgressState | null> {
  const client = sql();
  const blockKey = `block_${blockIndex}`;

  const rows = await client`
    SELECT workbook_progress
    FROM plannings
    WHERE id = ${planningId}::uuid
    LIMIT 1
  `;

  if (!rows || rows.length === 0) return null;
  const progressMap = rows[0].workbook_progress || {};
  return progressMap[blockKey] || null;
}

