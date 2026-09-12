import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail, sql } from '@/lib/db';

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
    console.error('Error fetching PMC projects:', error);
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

    const body = (await request.json()) as {
      school_name?: string;
      school_cct?: string;
      municipality?: string;
      locality?: string;
      school_zone?: string;
      director_name?: string;
      supervisor_name?: string;
      ciclo_escolar?: string;
      subsystem?: string;
    };

    if (!body.school_name || !body.school_cct) {
      return NextResponse.json(
        { error: 'Faltan datos requeridos (school_name, school_cct)' },
        { status: 400 }
      );
    }

    const db = sql();
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
        subsystem
      ) VALUES (
        ${teacher.id}::uuid,
        ${body.school_name},
        ${body.school_cct},
        ${body.municipality ?? null},
        ${body.locality ?? null},
        ${body.school_zone ?? null},
        ${body.director_name ?? null},
        ${body.supervisor_name ?? null},
        ${body.ciclo_escolar ?? '2025-2026'},
        ${body.subsystem ?? 'BGE'}
      )
      RETURNING *
    `;

    return NextResponse.json({ success: true, project }, { status: 201 });
  } catch (error) {
    console.error('Error creating PMC project:', error);
    return NextResponse.json({ error: 'Error al crear el proyecto' }, { status: 500 });
  }
}
