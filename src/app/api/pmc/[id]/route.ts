import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail, sql } from '@/lib/db';

type RouteContext = { params: Promise<{ id: string }> };

const ALLOWED_FIELDS = [
  'school_name',
  'school_cct',
  'municipality',
  'locality',
  'school_zone',
  'director_name',
  'supervisor_name',
  'ciclo_escolar',
  'subsystem',
  'total_staff',
  'staff_data',
  'indicadores_academicos',
  'foda',
  'categorias_priorizadas',
  'diagnostico_comunidad',
  'normativa',
  'diagnostico_generado',
  'plan_accion',
  'current_step',
  'status',
] as const;

type AllowedField = (typeof ALLOWED_FIELDS)[number];

// JSONB fields that need explicit casting
const JSONB_FIELDS = new Set([
  'staff_data',
  'indicadores_academicos',
  'foda',
  'categorias_priorizadas',
  'normativa',
  'diagnostico_generado',
  'plan_accion',
]);

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const teacher = await getTeacherByEmail(session.user.email);
    if (!teacher) {
      return NextResponse.json({ error: 'Docente no encontrado' }, { status: 404 });
    }

    const { id } = await params;
    const db = sql();

    const [project] = await db`
      SELECT *
      FROM pmc_projects
      WHERE id = ${id}::uuid
        AND teacher_id = ${teacher.id}::uuid
    `;

    if (!project) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ project });
  } catch (error) {
    console.error('Error fetching PMC project:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const teacher = await getTeacherByEmail(session.user.email);
    if (!teacher) {
      return NextResponse.json({ error: 'Docente no encontrado' }, { status: 404 });
    }

    const { id } = await params;
    const db = sql();

    // Verify ownership first
    const [existing] = await db`
      SELECT id FROM pmc_projects
      WHERE id = ${id}::uuid
        AND teacher_id = ${teacher.id}::uuid
    `;
    if (!existing) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });
    }

    const body = (await request.json()) as Record<string, unknown>;

    // Use COALESCE pattern — update each field if provided in body
    const b = body;
    const toJson = (v: unknown) => (v !== undefined ? JSON.stringify(v) : null);

    const [updated] = await db`
      UPDATE pmc_projects SET
        school_name           = COALESCE(${b.school_name as string ?? null}, school_name),
        school_cct            = COALESCE(${b.school_cct as string ?? null}, school_cct),
        municipality          = COALESCE(${b.municipality as string ?? null}, municipality),
        locality              = COALESCE(${b.locality as string ?? null}, locality),
        school_zone           = COALESCE(${b.school_zone as string ?? null}, school_zone),
        director_name         = COALESCE(${b.director_name as string ?? null}, director_name),
        supervisor_name       = COALESCE(${b.supervisor_name as string ?? null}, supervisor_name),
        ciclo_escolar         = COALESCE(${b.ciclo_escolar as string ?? null}, ciclo_escolar),
        subsystem             = COALESCE(${b.subsystem as string ?? null}, subsystem),
        diagnostico_comunidad = COALESCE(${b.diagnostico_comunidad as string ?? null}, diagnostico_comunidad),
        total_staff           = COALESCE(${b.total_staff as number ?? null}, total_staff),
        current_step          = COALESCE(${b.current_step as number ?? null}, current_step),
        status                = COALESCE(${b.status as string ?? null}, status),
        staff_data            = CASE WHEN ${b.staff_data !== undefined} THEN ${toJson(b.staff_data)}::jsonb ELSE staff_data END,
        indicadores_academicos= CASE WHEN ${b.indicadores_academicos !== undefined} THEN ${toJson(b.indicadores_academicos)}::jsonb ELSE indicadores_academicos END,
        foda                  = CASE WHEN ${b.foda !== undefined} THEN ${toJson(b.foda)}::jsonb ELSE foda END,
        categorias_priorizadas= CASE WHEN ${b.categorias_priorizadas !== undefined} THEN ${toJson(b.categorias_priorizadas)}::jsonb ELSE categorias_priorizadas END,
        normativa             = CASE WHEN ${b.normativa !== undefined} THEN ${toJson(b.normativa)}::jsonb ELSE normativa END,
        diagnostico_generado  = CASE WHEN ${b.diagnostico_generado !== undefined} THEN ${toJson(b.diagnostico_generado)}::jsonb ELSE diagnostico_generado END,
        plan_accion           = CASE WHEN ${b.plan_accion !== undefined} THEN ${toJson(b.plan_accion)}::jsonb ELSE plan_accion END,
        updated_at            = NOW()
      WHERE id = ${id}::uuid
        AND teacher_id = ${teacher.id}::uuid
      RETURNING *
    `;

    if (!updated) {
      return NextResponse.json({ error: 'No se pudo actualizar el proyecto' }, { status: 500 });
    }

    return NextResponse.json({ success: true, project: updated });
  } catch (error) {
    console.error('Error updating PMC project:', error);
    return NextResponse.json({ error: 'Error al actualizar el proyecto' }, { status: 500 });
  }
}


export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const teacher = await getTeacherByEmail(session.user.email);
    if (!teacher) {
      return NextResponse.json({ error: 'Docente no encontrado' }, { status: 404 });
    }

    const { id } = await params;
    const db = sql();

    const [deleted] = await db`
      DELETE FROM pmc_projects
      WHERE id = ${id}::uuid
        AND teacher_id = ${teacher.id}::uuid
      RETURNING id
    `;

    if (!deleted) {
      return NextResponse.json({ error: 'Proyecto no encontrado o sin permisos' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting PMC project:', error);
    return NextResponse.json({ error: 'Error al eliminar el proyecto' }, { status: 500 });
  }
}
