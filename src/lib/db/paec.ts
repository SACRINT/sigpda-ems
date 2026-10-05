import type { PaecProject } from '@/types/paec';
import { sql } from './client';

// ─── PAEC Projects queries ──────────────────────────────────────────────────

export async function getPaecProjectsByTeacher(teacherId: string) {
  const rows = await sql()`
    SELECT id, teacher_id, project_name, problem_statement, cycle_type, current_step, status, created_at, updated_at
    FROM paec_projects
    WHERE teacher_id = ${teacherId}::uuid
    ORDER BY created_at DESC
  `;
  return rows.map((r) => mapRawPaecProject(r)).filter((p): p is PaecProject => p !== null);
}

export async function getPaecProjectById(id: string, teacherId: string) {
  const rows = await sql()`
    SELECT *
    FROM paec_projects
    WHERE id = ${id}::uuid AND teacher_id = ${teacherId}::uuid
    LIMIT 1
  `;
  return rows[0] ? mapRawPaecProject(rows[0]) : null;
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
  return mapRawPaecProject(rows[0]) as PaecProject;
}

export function mapRawPaecProject(raw: Record<string, unknown> | PaecProject | null | undefined): PaecProject | null {
  if (!raw) return null;
  const r = raw as Record<string, unknown>;
  const project: unknown = {
    id: r.id as string,
    teacherId: (r.teacherId ?? r.teacher_id) as string,
    projectName: (r.projectName ?? r.project_name ?? '') as string,
    problemStatement: (r.problemStatement ?? r.problem_statement ?? '') as string,
    cycleType: (r.cycleType ?? r.cycle_type ?? 'A') as PaecProject['cycleType'],
    currentStep: (r.currentStep ?? r.current_step ?? 1) as number,
    communityContext: (r.communityContext ?? r.community_context ?? {}) as PaecProject['communityContext'],
    schoolContext: (r.schoolContext ?? r.school_context ?? {}) as PaecProject['schoolContext'],
    fase1Diagnostico: (r.fase1Diagnostico ?? r.fase1_diagnostico ?? null) as PaecProject['fase1Diagnostico'],
    fase2Justificacion: (r.fase2Justificacion ?? r.fase2_justificacion ?? null) as PaecProject['fase2Justificacion'],
    fase2Mapeo: (r.fase2Mapeo ?? r.fase2_mapeo ?? null) as PaecProject['fase2Mapeo'],
    fase2Cronograma: (r.fase2Cronograma ?? r.fase2_cronograma ?? null) as PaecProject['fase2Cronograma'],
    fase2DetalleCurricular: (r.fase2DetalleCurricular ?? r.fase2_detalle_curricular ?? null) as PaecProject['fase2DetalleCurricular'],
    fase2PlanOperativo: (r.fase2PlanOperativo ?? r.fase2_plan_operativo ?? null) as PaecProject['fase2PlanOperativo'],
    fase2Anexos: (r.fase2Anexos ?? r.fase2_anexos ?? null) as PaecProject['fase2Anexos'],
    fase3PlanOperativoA: (r.fase3PlanOperativoA ?? r.fase3_plan_operativo_a ?? null) as PaecProject['fase3PlanOperativoA'],
    fase3PlanOperativoB: (r.fase3PlanOperativoB ?? r.fase3_plan_operativo_b ?? null) as PaecProject['fase3PlanOperativoB'],
    fase3Implementacion: (r.fase3Implementacion ?? r.fase3_implementacion ?? null) as PaecProject['fase3Implementacion'],
    fase4Gobernanza: (r.fase4Gobernanza ?? r.fase4_gobernanza ?? null) as PaecProject['fase4Gobernanza'],
    fase4InformeSupervision: (r.fase4InformeSupervision ?? r.fase4_informe_supervision ?? null) as PaecProject['fase4InformeSupervision'],
    qualityAudit: (r.qualityAudit ?? r.quality_audit ?? null) as PaecProject['qualityAudit'],
    status: ((r.status as PaecProject['status']) || 'draft'),
    createdAt: (r.createdAt ?? r.created_at) as Date,
    updatedAt: (r.updatedAt ?? r.updated_at) as Date,
    // Aliases snake_case para retrocompatibilidad con endpoints existentes:
    project_name: (r.projectName ?? r.project_name ?? '') as string,
    problem_statement: (r.problemStatement ?? r.problem_statement ?? '') as string,
    cycle_type: (r.cycleType ?? r.cycle_type ?? 'A') as string,
    community_context: (r.communityContext ?? r.community_context ?? {}),
    school_context: (r.schoolContext ?? r.school_context ?? {}),
    fase1_diagnostico: (r.fase1Diagnostico ?? r.fase1_diagnostico ?? null),
    fase2_justificacion: (r.fase2Justificacion ?? r.fase2_justificacion ?? null),
    fase2_mapeo: (r.fase2Mapeo ?? r.fase2_mapeo ?? null),
    fase2_cronograma: (r.fase2Cronograma ?? r.fase2_cronograma ?? null),
    fase2_detalle_curricular: (r.fase2DetalleCurricular ?? r.fase2_detalle_curricular ?? null),
    fase2_plan_operativo: (r.fase2PlanOperativo ?? r.fase2_plan_operativo ?? null),
    fase2_anexos: (r.fase2Anexos ?? r.fase2_anexos ?? null),
    fase3_plan_operativo_a: (r.fase3PlanOperativoA ?? r.fase3_plan_operativo_a ?? null),
    fase3_plan_operativo_b: (r.fase3PlanOperativoB ?? r.fase3_plan_operativo_b ?? null),
    fase3_implementacion: (r.fase3Implementacion ?? r.fase3_implementacion ?? null),
    fase4_gobernanza: (r.fase4Gobernanza ?? r.fase4_gobernanza ?? null),
    fase4_informe_supervision: (r.fase4InformeSupervision ?? r.fase4_informe_supervision ?? null),
    quality_audit: (r.qualityAudit ?? r.quality_audit ?? null),
    current_step: (r.currentStep ?? r.current_step ?? 1),
    teacher_id: (r.teacherId ?? r.teacher_id),
    created_at: (r.createdAt ?? r.created_at),
    updated_at: (r.updatedAt ?? r.updated_at),
  };
  return project as PaecProject;
}

export const PAEC_STEP_FIELD_MAP: Record<number, string> = {
  1: 'fase1_diagnostico',
  2: 'fase2_justificacion',
  3: 'fase2_mapeo',
  4: 'fase2_cronograma',
  5: 'fase2_detalle_curricular',
  6: 'fase3_plan_operativo_a',
  7: 'fase3_plan_operativo_b',
  8: 'fase3_implementacion',
  9: 'fase4_gobernanza_e_informe',
};

const ALLOWED_PAEC_FIELDS = new Set([
  'fase1_diagnostico',
  'fase2_justificacion',
  'fase2_mapeo',
  'fase2_cronograma',
  'fase2_detalle_curricular',
  'fase3_plan_operativo_a',
  'fase3_plan_operativo_b',
  'fase3_implementacion',
  'fase4_gobernanza',
  'fase4_informe_supervision',
  'fase4_gobernanza_e_informe',
  'fase2_plan_operativo',
  'fase2_anexos',
]);

export async function updatePaecProjectStep(
  id: string,
  teacherId: string,
  step: number,
  fieldName: string,
  stepData: object
): Promise<PaecProject> {
  if (!id || !teacherId) {
    throw new Error('Identificadores de proyecto o docente inválidos.');
  }
  if (typeof step !== 'number' || step < 1 || step > 9) {
    throw new Error(`Paso inválido (${step}): Debe estar comprendido entre 1 y 9.`);
  }

  const targetField = fieldName || PAEC_STEP_FIELD_MAP[step];
  if (!ALLOWED_PAEC_FIELDS.has(targetField)) {
    throw new Error(`Campo de paso no válido: ${targetField}`);
  }

  const dataStr = JSON.stringify(stepData);

  const stepObj = (typeof stepData === 'object' && stepData !== null ? stepData : {}) as Record<string, unknown>;
  const anexosPart = targetField === 'fase3_implementacion' ? stepObj.anexos : null;
  const anexosStr = anexosPart ? JSON.stringify(anexosPart) : null;

  const gobStr = targetField === 'fase4_gobernanza_e_informe' ? JSON.stringify(stepObj.gobernanza || {}) : null;
  const infStr = targetField === 'fase4_gobernanza_e_informe' ? JSON.stringify(stepObj.informeSupervision || {}) : null;

  const rows = await sql()`
    UPDATE paec_projects
    SET
      fase1_diagnostico = CASE WHEN ${targetField} = 'fase1_diagnostico' THEN ${dataStr}::jsonb ELSE fase1_diagnostico END,
      fase2_justificacion = CASE WHEN ${targetField} = 'fase2_justificacion' THEN ${dataStr}::jsonb ELSE fase2_justificacion END,
      fase2_mapeo = CASE WHEN ${targetField} = 'fase2_mapeo' THEN ${dataStr}::jsonb ELSE fase2_mapeo END,
      fase2_cronograma = CASE WHEN ${targetField} = 'fase2_cronograma' THEN ${dataStr}::jsonb ELSE fase2_cronograma END,
      fase2_detalle_curricular = CASE WHEN ${targetField} = 'fase2_detalle_curricular' THEN ${dataStr}::jsonb ELSE fase2_detalle_curricular END,
      fase3_plan_operativo_a = CASE WHEN ${targetField} = 'fase3_plan_operativo_a' THEN ${dataStr}::jsonb ELSE fase3_plan_operativo_a END,
      fase3_plan_operativo_b = CASE WHEN ${targetField} = 'fase3_plan_operativo_b' THEN ${dataStr}::jsonb ELSE fase3_plan_operativo_b END,
      fase3_implementacion = CASE WHEN ${targetField} = 'fase3_implementacion' THEN ${dataStr}::jsonb ELSE fase3_implementacion END,
      fase4_gobernanza = CASE
        WHEN ${targetField} = 'fase4_gobernanza' THEN ${dataStr}::jsonb
        WHEN ${targetField} = 'fase4_gobernanza_e_informe' THEN ${gobStr}::jsonb
        ELSE fase4_gobernanza
      END,
      fase4_informe_supervision = CASE
        WHEN ${targetField} = 'fase4_informe_supervision' THEN ${dataStr}::jsonb
        WHEN ${targetField} = 'fase4_gobernanza_e_informe' THEN ${infStr}::jsonb
        ELSE fase4_informe_supervision
      END,
      fase2_anexos = CASE
        WHEN ${targetField} = 'fase3_implementacion' AND ${anexosStr}::text IS NOT NULL THEN ${anexosStr}::jsonb
        WHEN ${targetField} = 'fase2_anexos' THEN ${dataStr}::jsonb
        ELSE fase2_anexos
      END,
      fase2_plan_operativo = CASE WHEN ${targetField} = 'fase2_plan_operativo' THEN ${dataStr}::jsonb ELSE fase2_plan_operativo END,
      current_step = GREATEST(COALESCE(current_step, 1), LEAST(${step} + 1, 9)),
      status = CASE
        WHEN (cycle_type = 'A' AND ${step} >= 8) OR ${step} >= 9 THEN 'completed'
        ELSE 'draft'
      END,
      updated_at = NOW()
    WHERE id = ${id}::uuid AND teacher_id = ${teacherId}::uuid
    RETURNING *
  `;

  if (!rows || rows.length === 0) {
    throw new Error(`No se pudo actualizar el proyecto PAEC ${id} (no encontrado o no autorizado).`);
  }
  return mapRawPaecProject(rows[0]) as PaecProject;
}

export async function updatePaecQualityAudit(
  id: string,
  teacherId: string,
  auditData: object
): Promise<PaecProject | null> {
  const dataStr = JSON.stringify(auditData);
  const rows = await sql()`
    UPDATE paec_projects
    SET quality_audit = ${dataStr}::jsonb, updated_at = NOW()
    WHERE id = ${id}::uuid AND teacher_id = ${teacherId}::uuid
    RETURNING *
  `;
  if (!rows || rows.length === 0) return null;
  return mapRawPaecProject(rows[0]) as PaecProject;
}

export async function deletePaecProject(id: string, teacherId: string) {
  await sql()`
    DELETE FROM paec_projects
    WHERE id = ${id}::uuid AND teacher_id = ${teacherId}::uuid
  `;
}
