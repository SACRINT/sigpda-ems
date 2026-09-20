/**
 * src/lib/db/pmc.ts
 * Repositorio de Persistencia Formal para el Plan de Mejora Continua (PMC CREAA)
 * SIGPDA-EMS · DBEPA Puebla MCCEMS 2026-2027
 */

import { sql } from './client';
import type { PmcProject, PmcQualityAudit } from '@/types/pmc';
import type { IProgramRepository } from '@/lib/platform/interfaces';

export const PMC_STEP_FIELD_MAP: Record<number, string> = {
  1: 'staff_data',
  2: 'indicadores_academicos',
  3: 'foda',
  4: 'categorias_priorizadas',
  5: 'diagnostico_comunidad',
  6: 'normativa',
  7: 'diagnostico_generado',
  8: 'plan_accion',
};

export function mapRawPmcProject(raw: Record<string, unknown> | null | undefined): PmcProject | null {
  if (!raw) return null;
  return {
    id: raw.id as string,
    teacher_id: (raw.teacher_id ?? undefined) as string | undefined,
    school_name: (raw.school_name ?? undefined) as string | undefined,
    school_cct: (raw.school_cct ?? undefined) as string | undefined,
    municipality: (raw.municipality ?? undefined) as string | undefined,
    locality: (raw.locality ?? undefined) as string | undefined,
    school_zone: (raw.school_zone ?? undefined) as string | undefined,
    director_name: (raw.director_name ?? undefined) as string | undefined,
    supervisor_name: (raw.supervisor_name ?? undefined) as string | undefined,
    ciclo_escolar: (raw.ciclo_escolar ?? undefined) as string | undefined,
    subsystem: (raw.subsystem ?? undefined) as string | undefined,
    total_staff: typeof raw.total_staff === 'number' ? raw.total_staff : undefined,
    staff_data: raw.staff_data ?? undefined,
    indicadores_academicos: raw.indicadores_academicos ?? undefined,
    foda: raw.foda ?? undefined,
    categorias_priorizadas: raw.categorias_priorizadas ?? undefined,
    diagnostico_comunidad: (raw.diagnostico_comunidad ?? undefined) as string | undefined,
    normativa: raw.normativa ?? undefined,
    diagnostico_generado: raw.diagnostico_generado ?? undefined,
    plan_accion: raw.plan_accion ?? undefined,
    statistical_context: raw.statistical_context as PmcProject['statistical_context'],
    current_step: typeof raw.current_step === 'number' ? raw.current_step : 1,
    status: (raw.status as string) || 'draft',
    created_at: raw.created_at ? String(raw.created_at) : undefined,
    updated_at: raw.updated_at ? String(raw.updated_at) : undefined,
  };
}

export async function getPmcProjectsByTeacher(teacherId: string): Promise<PmcProject[]> {
  const db = sql();
  const rows = await db`
    SELECT id, teacher_id, school_name, school_cct, municipality, locality,
           school_zone, director_name, supervisor_name, ciclo_escolar,
           subsystem, current_step, status, created_at, updated_at
    FROM pmc_projects
    WHERE teacher_id = ${teacherId}::uuid
    ORDER BY updated_at DESC
  `;
  return rows.map((r) => mapRawPmcProject(r as Record<string, unknown>)).filter(Boolean) as PmcProject[];
}

export async function getPmcProjectById(id: string, teacherId?: string): Promise<PmcProject | null> {
  const db = sql();
  const rows = teacherId
    ? await db`
        SELECT * FROM pmc_projects
        WHERE id = ${id}::uuid AND teacher_id = ${teacherId}::uuid
        LIMIT 1
      `
    : await db`
        SELECT * FROM pmc_projects
        WHERE id = ${id}::uuid
        LIMIT 1
      `;
  return mapRawPmcProject(rows[0] as Record<string, unknown>);
}

export async function createPmcProject(data: {
  teacherId: string;
  school_name: string;
  school_cct: string;
  municipality?: string;
  locality?: string;
  school_zone?: string;
  director_name?: string;
  supervisor_name?: string;
  ciclo_escolar?: string;
  subsystem?: string;
}): Promise<PmcProject> {
  const db = sql();
  const rows = await db`
    INSERT INTO pmc_projects (
      teacher_id,
      school_name,
      school_cct,
      municipality,
      locality,
      school_zone,
      director_name,
      supervisor_name,
      ciclo_escolar,
      subsystem
    ) VALUES (
      ${data.teacherId}::uuid,
      ${data.school_name},
      ${data.school_cct},
      ${data.municipality ?? null},
      ${data.locality ?? null},
      ${data.school_zone ?? null},
      ${data.director_name ?? null},
      ${data.supervisor_name ?? null},
      ${data.ciclo_escolar ?? '2025-2026'},
      ${data.subsystem ?? 'BGE'}
    )
    RETURNING *
  `;
  return mapRawPmcProject(rows[0] as Record<string, unknown>)!;
}

export async function updatePmcProject(
  id: string,
  teacherId: string | undefined,
  patch: Partial<PmcProject>
): Promise<PmcProject | null> {
  const db = sql();
  const rows = teacherId
    ? await db`
        UPDATE pmc_projects
        SET
          school_name = COALESCE(${patch.school_name ?? null}, school_name),
          school_cct = COALESCE(${patch.school_cct ?? null}, school_cct),
          municipality = COALESCE(${patch.municipality ?? null}, municipality),
          locality = COALESCE(${patch.locality ?? null}, locality),
          school_zone = COALESCE(${patch.school_zone ?? null}, school_zone),
          director_name = COALESCE(${patch.director_name ?? null}, director_name),
          supervisor_name = COALESCE(${patch.supervisor_name ?? null}, supervisor_name),
          ciclo_escolar = COALESCE(${patch.ciclo_escolar ?? null}, ciclo_escolar),
          subsystem = COALESCE(${patch.subsystem ?? null}, subsystem),
          total_staff = COALESCE(${patch.total_staff ?? null}, total_staff),
          current_step = COALESCE(${patch.current_step ?? null}, current_step),
          status = COALESCE(${patch.status ?? null}, status),
          updated_at = NOW()
        WHERE id = ${id}::uuid AND teacher_id = ${teacherId}::uuid
        RETURNING *
      `
    : await db`
        UPDATE pmc_projects
        SET
          school_name = COALESCE(${patch.school_name ?? null}, school_name),
          school_cct = COALESCE(${patch.school_cct ?? null}, school_cct),
          municipality = COALESCE(${patch.municipality ?? null}, municipality),
          locality = COALESCE(${patch.locality ?? null}, locality),
          school_zone = COALESCE(${patch.school_zone ?? null}, school_zone),
          director_name = COALESCE(${patch.director_name ?? null}, director_name),
          supervisor_name = COALESCE(${patch.supervisor_name ?? null}, supervisor_name),
          ciclo_escolar = COALESCE(${patch.ciclo_escolar ?? null}, ciclo_escolar),
          subsystem = COALESCE(${patch.subsystem ?? null}, subsystem),
          total_staff = COALESCE(${patch.total_staff ?? null}, total_staff),
          current_step = COALESCE(${patch.current_step ?? null}, current_step),
          status = COALESCE(${patch.status ?? null}, status),
          updated_at = NOW()
        WHERE id = ${id}::uuid
        RETURNING *
      `;
  return mapRawPmcProject(rows[0] as Record<string, unknown>);
}

export async function updatePmcProjectStep(
  id: string,
  stepNumber: number
): Promise<PmcProject | null> {
  const db = sql();
  const nextStep = Math.min(Math.max(stepNumber + 1, 1), 8);
  const rows = await db`
    UPDATE pmc_projects
    SET
      current_step = GREATEST(current_step, ${nextStep}),
      updated_at = NOW()
    WHERE id = ${id}::uuid
    RETURNING *
  `;
  return mapRawPmcProject(rows[0] as Record<string, unknown>);
}

export async function updatePmcAudit(id: string, audit: PmcQualityAudit): Promise<void> {
  const db = sql();
  await db`
    UPDATE pmc_projects
    SET quality_audit = ${JSON.stringify(audit)}::jsonb, updated_at = NOW()
    WHERE id = ${id}::uuid
  `;
}

export async function deletePmcProject(id: string, teacherId?: string): Promise<boolean> {
  const db = sql();
  const rows = teacherId
    ? await db`
        DELETE FROM pmc_projects
        WHERE id = ${id}::uuid AND teacher_id = ${teacherId}::uuid
        RETURNING id
      `
    : await db`
        DELETE FROM pmc_projects
        WHERE id = ${id}::uuid
        RETURNING id
      `;
  return rows.length > 0;
}

export class PmcRepository implements IProgramRepository<PmcProject, string, { teacherId?: string }> {
  async findById(id: string): Promise<PmcProject | null> {
    return getPmcProjectById(id);
  }

  async findAll(filters?: { teacherId?: string }): Promise<PmcProject[]> {
    if (filters?.teacherId) {
      return getPmcProjectsByTeacher(filters.teacherId);
    }
    const db = sql();
    const rows = await db`SELECT * FROM pmc_projects ORDER BY updated_at DESC`;
    return rows.map((r) => mapRawPmcProject(r as Record<string, unknown>)).filter(Boolean) as PmcProject[];
  }

  async create(entity: PmcProject): Promise<PmcProject> {
    if (!entity.teacher_id || !entity.school_name || !entity.school_cct) {
      throw new Error('Faltan campos obligatorios para crear PMC: teacher_id, school_name, school_cct');
    }
    return createPmcProject({
      teacherId: entity.teacher_id,
      school_name: entity.school_name,
      school_cct: entity.school_cct,
      municipality: entity.municipality,
      locality: entity.locality,
      school_zone: entity.school_zone,
      director_name: entity.director_name,
      supervisor_name: entity.supervisor_name,
      ciclo_escolar: entity.ciclo_escolar,
      subsystem: entity.subsystem,
    });
  }

  async update(id: string, patch: Partial<PmcProject>): Promise<PmcProject> {
    const updated = await updatePmcProject(id, patch.teacher_id, patch);
    if (!updated) {
      throw new Error(`No se pudo actualizar el proyecto PMC con ID ${id}`);
    }
    return updated;
  }

  async delete(id: string): Promise<void> {
    await deletePmcProject(id);
  }
}

export const pmcRepository = new PmcRepository();
