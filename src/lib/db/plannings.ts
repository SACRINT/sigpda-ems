import { sql } from './client';

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
  paecOperationalActivity?: object | null;
  contentJson?: object | null;
}) {
  const initialContent = data.contentJson || (data.paecOperationalActivity ? { sectionI: { paecOperationalActivity: data.paecOperationalActivity } } : null);

  const rows = await sql()`
    INSERT INTO plannings (
      teacher_id, uac_name, semester, component,
      curriculum_name, paec_context, extracted_data, status,
      metodologia_activa, content_json
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
      ${data.metodologiaActiva || null},
      ${initialContent ? JSON.stringify(initialContent) : null}
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

// ─── Planning Audit Results ──────────────────────────────────────────────────

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
