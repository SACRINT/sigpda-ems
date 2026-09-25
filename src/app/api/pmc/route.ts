import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail, sql } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const teacher = await getTeacherByEmail(session.user.email);
    if (!teacher) {
      return NextResponse.json({ error: 'Docente no encontrado' }, { status: 404 });
    }

    const db = sql();
    const projects = await db`
      SELECT
        p.id,
        p.teacher_id,
        p.school_name,
        p.school_cct,
        p.municipality,
        p.locality,
        p.school_zone,
        p.director_name,
        p.supervisor_name,
        p.ciclo_escolar,
        p.subsystem,
        p.current_step,
        p.status,
        p.created_at,
        p.updated_at
      FROM pmc_projects p
      WHERE p.teacher_id = ${teacher.id}::uuid
      ORDER BY p.updated_at DESC
    `;

    return NextResponse.json({ projects });
  } catch (error) {
    logger.error('Error fetching PMC projects:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const teacher = await getTeacherByEmail(session.user.email);
    if (!teacher) {
      return NextResponse.json({ error: 'Docente no encontrado' }, { status: 404 });
    }

    const body = (await request.json()) as Record<string, unknown>;

    if (!body.school_name || !body.school_cct) {
      return NextResponse.json(
        { error: 'Faltan datos requeridos (school_name, school_cct)' },
        { status: 400 }
      );
    }

    const db = sql();
    const toJson = (v: unknown) => (v !== undefined && v !== null ? JSON.stringify(v) : null);

    const [project] = await db`
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
        subsystem,
        total_staff,
        current_step,
        status,
        diagnostico_comunidad,
        staff_data,
        indicadores_academicos,
        foda,
        categorias_priorizadas,
        normativa,
        diagnostico_generado,
        plan_accion
      ) VALUES (
        ${teacher.id}::uuid,
        ${body.school_name as string},
        ${body.school_cct as string},
        ${(body.municipality as string) ?? null},
        ${(body.locality as string) ?? null},
        ${(body.school_zone as string) ?? null},
        ${(body.director_name as string) ?? null},
        ${(body.supervisor_name as string) ?? null},
        ${(body.ciclo_escolar as string) ?? '2025-2026'},
        ${(body.subsystem as string) ?? 'BGE'},
        ${typeof body.total_staff === 'number' ? body.total_staff : 1},
        ${typeof body.current_step === 'number' ? body.current_step : 1},
        ${(body.status as string) ?? 'draft'},
        ${(body.diagnostico_comunidad as string) ?? null},
        ${toJson(body.staff_data)}::jsonb,
        ${toJson(body.indicadores_academicos)}::jsonb,
        ${toJson(body.foda)}::jsonb,
        ${toJson(body.categorias_priorizadas)}::jsonb,
        ${toJson(body.normativa)}::jsonb,
        ${toJson(body.diagnostico_generado)}::jsonb,
        ${toJson(body.plan_accion)}::jsonb
      )
      RETURNING *
    `;

    return NextResponse.json({ success: true, project }, { status: 201 });
  } catch (error) {
    logger.error('Error creating PMC project:', error);
    return NextResponse.json({ error: 'Error al crear el proyecto' }, { status: 500 });
  }
}
