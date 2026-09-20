/**
 * src/lib/db/cartografia.ts
 * Repositorio de Persistencia Formal para Cartografía de Zona Escolar (PIPS / Supervisión)
 * SIGPDA-EMS · DBEPA Puebla MCCEMS 2026-2027
 */

import { sql } from './client';
import type { PipsProject } from '@/types/pips';
import type { IProgramRepository } from '@/lib/platform/interfaces';

export function mapRawCartografiaProject(raw: Record<string, unknown> | null | undefined): PipsProject | null {
  if (!raw) return null;
  return {
    id: raw.id as string,
    teacher_id: (raw.teacher_id ?? undefined) as string | undefined,
    zona_clave: (raw.zona_clave as string) || '',
    zona_nombre: (raw.zona_nombre as string) || '',
    supervisor_name: (raw.supervisor_name as string) || '',
    municipio_sede: (raw.municipio_sede as string) || '',
    municipios_atiende: (raw.municipios_atiende as string) || '',
    num_planteles: typeof raw.num_planteles === 'number' ? raw.num_planteles : 0,
    subsistema: (raw.subsistema as string) || 'BGE',
    modalidad: (raw.modalidad as string) || 'Escolarizada',
    ciclo_escolar: (raw.ciclo_escolar as string) || '2025-2026',
    atps: (raw.atps as string) || '',
    presentacion_supervisor: (raw.presentacion_supervisor as string) || '',
    pips_anterior_realizado: typeof raw.pips_anterior_realizado === 'boolean' ? raw.pips_anterior_realizado : false,
    reflexion_pips_anterior: (raw.reflexion_pips_anterior as string) || '',
    fortalezas_anterior: (raw.fortalezas_anterior as string) || '',
    areas_oportunidad_anterior: (raw.areas_oportunidad_anterior as string) || '',
    planteles_json: raw.planteles_json as PipsProject['planteles_json'],
    diagnostico_contexto: (raw.diagnostico_contexto as string) || '',
    problematicas_json: raw.problematicas_json as PipsProject['problematicas_json'],
    objetivo_general: (raw.objetivo_general as string) || '',
    objetivos_especificos_json: raw.objetivos_especificos_json as PipsProject['objetivos_especificos_json'],
    cronograma_json: raw.cronograma_json as PipsProject['cronograma_json'],
    evaluacion_json: raw.evaluacion_json as PipsProject['evaluacion_json'],
    current_step: typeof raw.current_step === 'number' ? raw.current_step : 1,
    status: raw.status === 'completed' ? 'completed' : 'draft',
    created_at: raw.created_at ? String(raw.created_at) : undefined,
    updated_at: raw.updated_at ? String(raw.updated_at) : undefined,
  };
}

export async function getCartografiaProjectsByTeacher(teacherId: string): Promise<PipsProject[]> {
  const db = sql();
  const rows = await db`
    SELECT id, zona_nombre, zona_clave, supervisor_name, ciclo_escolar,
           num_planteles, current_step, status, created_at, updated_at
    FROM pips_projects
    WHERE teacher_id = ${teacherId}::uuid
    ORDER BY updated_at DESC
  `;
  return rows.map((r) => mapRawCartografiaProject(r as Record<string, unknown>)).filter(Boolean) as PipsProject[];
}

export const getPipsProjectsByTeacher = getCartografiaProjectsByTeacher;

export async function getCartografiaProjectById(id: string, teacherId?: string): Promise<PipsProject | null> {
  const db = sql();
  const rows = teacherId
    ? await db`
        SELECT * FROM pips_projects
        WHERE id = ${id}::uuid AND teacher_id = ${teacherId}::uuid
        LIMIT 1
      `
    : await db`
        SELECT * FROM pips_projects
        WHERE id = ${id}::uuid
        LIMIT 1
      `;
  return mapRawCartografiaProject(rows[0] as Record<string, unknown>);
}

export const getPipsProjectById = getCartografiaProjectById;

export async function createCartografiaProject(
  data: Partial<PipsProject> & { teacherId: string }
): Promise<PipsProject> {
  const db = sql();
  const rows = await db`
    INSERT INTO pips_projects (
      teacher_id, zona_clave, zona_nombre, supervisor_name,
      municipio_sede, municipios_atiende, num_planteles,
      subsistema, modalidad, ciclo_escolar, atps,
      presentacion_supervisor,
      pips_anterior_realizado, reflexion_pips_anterior,
      fortalezas_anterior, areas_oportunidad_anterior,
      planteles_json, diagnostico_contexto, problematicas_json,
      objetivo_general, objetivos_especificos_json,
      cronograma_json, evaluacion_json,
      current_step, status
    ) VALUES (
      ${data.teacherId}::uuid,
      ${data.zona_clave || 'SZ-001'},
      ${data.zona_nombre || 'Zona Escolar'},
      ${data.supervisor_name || ''},
      ${data.municipio_sede || ''},
      ${data.municipios_atiende || ''},
      ${data.num_planteles || 1},
      ${data.subsistema || 'BGE'},
      ${data.modalidad || 'Escolarizada'},
      ${data.ciclo_escolar || '2025-2026'},
      ${data.atps || ''},
      ${data.presentacion_supervisor || ''},
      ${data.pips_anterior_realizado ?? false},
      ${data.reflexion_pips_anterior || ''},
      ${data.fortalezas_anterior || ''},
      ${data.areas_oportunidad_anterior || ''},
      ${JSON.stringify(data.planteles_json ?? [])}::jsonb,
      ${data.diagnostico_contexto || ''},
      ${JSON.stringify(data.problematicas_json ?? [])}::jsonb,
      ${data.objetivo_general || ''},
      ${JSON.stringify(data.objetivos_especificos_json ?? [])}::jsonb,
      ${JSON.stringify(data.cronograma_json ?? [])}::jsonb,
      ${JSON.stringify(data.evaluacion_json ?? [])}::jsonb,
      1,
      'draft'
    )
    RETURNING *
  `;
  return mapRawCartografiaProject(rows[0] as Record<string, unknown>)!;
}

export const createPipsProject = createCartografiaProject;

export async function updateCartografiaProject(
  id: string,
  teacherId: string | undefined,
  patch: Partial<PipsProject>
): Promise<PipsProject | null> {
  const db = sql();
  const rows = teacherId
    ? await db`
        UPDATE pips_projects SET
          zona_clave = COALESCE(${patch.zona_clave ?? null}, zona_clave),
          zona_nombre = COALESCE(${patch.zona_nombre ?? null}, zona_nombre),
          supervisor_name = COALESCE(${patch.supervisor_name ?? null}, supervisor_name),
          municipio_sede = COALESCE(${patch.municipio_sede ?? null}, municipio_sede),
          municipios_atiende = COALESCE(${patch.municipios_atiende ?? null}, municipios_atiende),
          num_planteles = COALESCE(${patch.num_planteles ?? null}, num_planteles),
          subsistema = COALESCE(${patch.subsistema ?? null}, subsistema),
          modalidad = COALESCE(${patch.modalidad ?? null}, modalidad),
          ciclo_escolar = COALESCE(${patch.ciclo_escolar ?? null}, ciclo_escolar),
          atps = COALESCE(${patch.atps ?? null}, atps),
          presentacion_supervisor = COALESCE(${patch.presentacion_supervisor ?? null}, presentacion_supervisor),
          current_step = COALESCE(${patch.current_step ?? null}, current_step),
          status = COALESCE(${patch.status ?? null}, status),
          updated_at = NOW()
        WHERE id = ${id}::uuid AND teacher_id = ${teacherId}::uuid
        RETURNING *
      `
    : await db`
        UPDATE pips_projects SET
          zona_clave = COALESCE(${patch.zona_clave ?? null}, zona_clave),
          zona_nombre = COALESCE(${patch.zona_nombre ?? null}, zona_nombre),
          supervisor_name = COALESCE(${patch.supervisor_name ?? null}, supervisor_name),
          municipio_sede = COALESCE(${patch.municipio_sede ?? null}, municipio_sede),
          municipios_atiende = COALESCE(${patch.municipios_atiende ?? null}, municipios_atiende),
          num_planteles = COALESCE(${patch.num_planteles ?? null}, num_planteles),
          subsistema = COALESCE(${patch.subsistema ?? null}, subsistema),
          modalidad = COALESCE(${patch.modalidad ?? null}, modalidad),
          ciclo_escolar = COALESCE(${patch.ciclo_escolar ?? null}, ciclo_escolar),
          atps = COALESCE(${patch.atps ?? null}, atps),
          presentacion_supervisor = COALESCE(${patch.presentacion_supervisor ?? null}, presentacion_supervisor),
          current_step = COALESCE(${patch.current_step ?? null}, current_step),
          status = COALESCE(${patch.status ?? null}, status),
          updated_at = NOW()
        WHERE id = ${id}::uuid
        RETURNING *
      `;
  return mapRawCartografiaProject(rows[0] as Record<string, unknown>);
}

export const updatePipsProject = updateCartografiaProject;

export async function deleteCartografiaProject(id: string, teacherId?: string): Promise<boolean> {
  const db = sql();
  const rows = teacherId
    ? await db`
        DELETE FROM pips_projects
        WHERE id = ${id}::uuid AND teacher_id = ${teacherId}::uuid
        RETURNING id
      `
    : await db`
        DELETE FROM pips_projects
        WHERE id = ${id}::uuid
        RETURNING id
      `;
  return rows.length > 0;
}

export const deletePipsProject = deleteCartografiaProject;

export class CartografiaRepository implements IProgramRepository<PipsProject, string, { teacherId?: string }> {
  async findById(id: string): Promise<PipsProject | null> {
    return getCartografiaProjectById(id);
  }

  async findAll(filters?: { teacherId?: string }): Promise<PipsProject[]> {
    if (filters?.teacherId) {
      return getCartografiaProjectsByTeacher(filters.teacherId);
    }
    const db = sql();
    const rows = await db`SELECT * FROM pips_projects ORDER BY updated_at DESC`;
    return rows.map((r) => mapRawCartografiaProject(r as Record<string, unknown>)).filter(Boolean) as PipsProject[];
  }

  async create(entity: PipsProject): Promise<PipsProject> {
    if (!entity.teacher_id) {
      throw new Error('Falta teacher_id para crear proyecto de Cartografía');
    }
    return createCartografiaProject({
      ...entity,
      teacherId: entity.teacher_id,
    });
  }

  async update(id: string, patch: Partial<PipsProject>): Promise<PipsProject> {
    const updated = await updateCartografiaProject(id, patch.teacher_id, patch);
    if (!updated) {
      throw new Error(`No se pudo actualizar proyecto de Cartografía con ID ${id}`);
    }
    return updated;
  }

  async delete(id: string): Promise<void> {
    await deleteCartografiaProject(id);
  }
}

export const cartografiaRepository = new CartografiaRepository();
