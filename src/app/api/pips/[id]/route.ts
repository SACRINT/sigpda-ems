import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail, sql } from '@/lib/db';

type RouteCtx = { params: Promise<{ id: string }> };

// GET — load a single PIPS project
export async function GET(_req: NextRequest, { params }: RouteCtx) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user?.email)
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const teacher = await getTeacherByEmail(session.user.email);
    if (!teacher)
      return NextResponse.json({ error: 'Docente no encontrado' }, { status: 404 });

    const db = sql();
    const [project] = await db`
      SELECT * FROM pips_projects
      WHERE id = ${id}::uuid AND teacher_id = ${teacher.id}::uuid
    `;

    if (!project)
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });

    return NextResponse.json({ project });
  } catch (error) {
    console.error('Error loading PIPS:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// PUT — update a PIPS project
export async function PUT(req: NextRequest, { params }: RouteCtx) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user?.email)
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const teacher = await getTeacherByEmail(session.user.email);
    if (!teacher)
      return NextResponse.json({ error: 'Docente no encontrado' }, { status: 404 });

    const body = await req.json();
    const db = sql();

    const [project] = await db`
      UPDATE pips_projects SET
        zona_clave                 = COALESCE(${body.zona_clave ?? null}, zona_clave),
        zona_nombre                = COALESCE(${body.zona_nombre ?? null}, zona_nombre),
        supervisor_name            = COALESCE(${body.supervisor_name ?? null}, supervisor_name),
        municipio_sede             = COALESCE(${body.municipio_sede ?? null}, municipio_sede),
        municipios_atiende         = COALESCE(${body.municipios_atiende ?? null}, municipios_atiende),
        num_planteles              = COALESCE(${body.num_planteles ?? null}, num_planteles),
        subsistema                 = COALESCE(${body.subsistema ?? null}, subsistema),
        modalidad                  = COALESCE(${body.modalidad ?? null}, modalidad),
        ciclo_escolar              = COALESCE(${body.ciclo_escolar ?? null}, ciclo_escolar),
        atps                       = COALESCE(${body.atps ?? null}, atps),
        presentacion_supervisor    = COALESCE(${body.presentacion_supervisor ?? null}, presentacion_supervisor),
        pips_anterior_realizado    = COALESCE(${body.pips_anterior_realizado ?? null}, pips_anterior_realizado),
        reflexion_pips_anterior    = COALESCE(${body.reflexion_pips_anterior ?? null}, reflexion_pips_anterior),
        fortalezas_anterior        = COALESCE(${body.fortalezas_anterior ?? null}, fortalezas_anterior),
        areas_oportunidad_anterior = COALESCE(${body.areas_oportunidad_anterior ?? null}, areas_oportunidad_anterior),
        planteles_json             = COALESCE(${body.planteles_json != null ? JSON.stringify(body.planteles_json) : null}::jsonb, planteles_json),
        diagnostico_contexto       = COALESCE(${body.diagnostico_contexto ?? null}, diagnostico_contexto),
        problematicas_json         = COALESCE(${body.problematicas_json != null ? JSON.stringify(body.problematicas_json) : null}::jsonb, problematicas_json),
        objetivo_general           = COALESCE(${body.objetivo_general ?? null}, objetivo_general),
        objetivos_especificos_json = COALESCE(${body.objetivos_especificos_json != null ? JSON.stringify(body.objetivos_especificos_json) : null}::jsonb, objetivos_especificos_json),
        cronograma_json            = COALESCE(${body.cronograma_json != null ? JSON.stringify(body.cronograma_json) : null}::jsonb, cronograma_json),
        evaluacion_json            = COALESCE(${body.evaluacion_json != null ? JSON.stringify(body.evaluacion_json) : null}::jsonb, evaluacion_json),
        generated_content          = COALESCE(${body.generated_content ?? null}, generated_content),
        current_step               = COALESCE(${body.current_step ?? null}, current_step),
        status                     = COALESCE(${body.status ?? null}, status),
        updated_at                 = NOW()
      WHERE id = ${id}::uuid AND teacher_id = ${teacher.id}::uuid
      RETURNING *
    `;

    if (!project)
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });

    return NextResponse.json({ success: true, project });
  } catch (error) {
    console.error('Error updating PIPS:', error);
    return NextResponse.json({ error: 'Error al actualizar el PIPS' }, { status: 500 });
  }
}

// DELETE — remove a PIPS project
export async function DELETE(_req: NextRequest, { params }: RouteCtx) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user?.email)
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const teacher = await getTeacherByEmail(session.user.email);
    if (!teacher)
      return NextResponse.json({ error: 'Docente no encontrado' }, { status: 404 });

    const db = sql();
    await db`
      DELETE FROM pips_projects
      WHERE id = ${id}::uuid AND teacher_id = ${teacher.id}::uuid
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting PIPS:', error);
    return NextResponse.json({ error: 'Error al eliminar el PIPS' }, { status: 500 });
  }
}
