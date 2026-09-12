// src/app/api/pips/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail, sql } from '@/lib/db';

// GET — list all PIPS of the current teacher
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email)
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const teacher = await getTeacherByEmail(session.user.email);
    if (!teacher)
      return NextResponse.json({ error: 'Docente no encontrado' }, { status: 404 });

    const db = sql();
    const projects = await db`
      SELECT id, zona_nombre, zona_clave, supervisor_name, ciclo_escolar,
             num_planteles, current_step, status, created_at, updated_at
      FROM pips_projects
      WHERE teacher_id = ${teacher.id}::uuid
      ORDER BY updated_at DESC
    `;

    return NextResponse.json({ projects });
  } catch (error) {
    console.error('Error fetching PIPS:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// POST — create a new PIPS project
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email)
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const teacher = await getTeacherByEmail(session.user.email);
    if (!teacher)
      return NextResponse.json({ error: 'Docente no encontrado' }, { status: 404 });

    const body = await req.json();
    const db = sql();

    const [project] = await db`
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
        ${teacher.id}::uuid,
        ${body.zona_clave ?? null},
        ${body.zona_nombre ?? 'Zona Escolar'},
        ${body.supervisor_name ?? null},
        ${body.municipio_sede ?? null},
        ${body.municipios_atiende ?? null},
        ${body.num_planteles ?? 1},
        ${body.subsistema ?? 'BGE'},
        ${body.modalidad ?? 'Escolarizada'},
        ${body.ciclo_escolar ?? '2026-2027'},
        ${body.atps ?? null},
        ${body.presentacion_supervisor ?? null},
        ${body.pips_anterior_realizado ?? false},
        ${body.reflexion_pips_anterior ?? null},
        ${body.fortalezas_anterior ?? null},
        ${body.areas_oportunidad_anterior ?? null},
        ${JSON.stringify(body.planteles_json ?? [])},
        ${body.diagnostico_contexto ?? null},
        ${JSON.stringify(body.problematicas_json ?? [])},
        ${body.objetivo_general ?? null},
        ${JSON.stringify(body.objetivos_especificos_json ?? [])},
        ${JSON.stringify(body.cronograma_json ?? [])},
        ${JSON.stringify(body.evaluacion_json ?? [])},
        ${body.current_step ?? 1},
        'draft'
      )
      RETURNING *
    `;

    return NextResponse.json({ success: true, project }, { status: 201 });
  } catch (error) {
    console.error('Error creating PIPS:', error);
    return NextResponse.json({ error: 'Error al crear el PIPS' }, { status: 500 });
  }
}
