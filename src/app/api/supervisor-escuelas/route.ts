import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { sql, getTeacherByEmail } from '@/lib/db';
import { logger } from '@/lib/logger';

async function getSupervisorId(email: string) {
  const teacher = await getTeacherByEmail(email);
  if (!teacher) return null;
  const isAdmin = teacher.role === 'administrador' || email === process.env.ADMIN_EMAIL;
  if (teacher.role !== 'supervisor' && !isAdmin) return null;
  return teacher.id as string;
}

// ── GET: listar escuelas de la zona ─────────────────────────────────────────
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const supervisorId = await getSupervisorId(session.user.email);
    if (!supervisorId) {
      return NextResponse.json({ error: 'Solo los supervisores pueden ver su zona' }, { status: 403 });
    }

    const escuelas = await sql()`
      SELECT id, nombre, cct, municipio, subsistema,
             director_nombre, director_email,
             pmc_data, paec_data, activa, created_at
      FROM supervisor_escuelas
      WHERE supervisor_id = ${supervisorId}::uuid
      ORDER BY nombre
    `;

    return NextResponse.json({ escuelas });
  } catch (err: any) {
    logger.error('[supervisor-escuelas GET]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// ── POST: agregar escuela a la zona ─────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const supervisorId = await getSupervisorId(session.user.email);
    if (!supervisorId) {
      return NextResponse.json({ error: 'Solo los supervisores pueden agregar escuelas' }, { status: 403 });
    }

    const body = await req.json();
    const { nombre, cct, municipio, subsistema, directorNombre, directorEmail } = body;

    if (!nombre?.trim() || !cct?.trim()) {
      return NextResponse.json({ error: 'Nombre y CCT son requeridos' }, { status: 400 });
    }

    const result = await sql()`
      INSERT INTO supervisor_escuelas
        (supervisor_id, nombre, cct, municipio, subsistema, director_nombre, director_email)
      VALUES
        (${supervisorId}::uuid, ${nombre.trim()}, ${cct.trim()},
         ${(municipio || '').trim() || null},
         ${(subsistema || 'BGE').trim()},
         ${(directorNombre || '').trim() || null},
         ${(directorEmail || '').trim() || null})
      ON CONFLICT (supervisor_id, cct) DO NOTHING
      RETURNING id
    `;

    if (!result.length) {
      return NextResponse.json({ error: 'Ya existe una escuela con ese CCT en tu zona' }, { status: 409 });
    }

    return NextResponse.json({ success: true, id: result[0].id });
  } catch (err: any) {
    logger.error('[supervisor-escuelas POST]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// ── PUT: editar escuela ──────────────────────────────────────────────────────
export async function PUT(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const supervisorId = await getSupervisorId(session.user.email);
    if (!supervisorId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const body = await req.json();
    const { id, nombre, cct, municipio, subsistema, directorNombre, directorEmail, activa } = body;
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    await sql()`
      UPDATE supervisor_escuelas SET
        nombre          = ${nombre?.trim()},
        cct             = ${cct?.trim()},
        municipio       = ${(municipio || '').trim() || null},
        subsistema      = ${(subsistema || 'BGE').trim()},
        director_nombre = ${(directorNombre || '').trim() || null},
        director_email  = ${(directorEmail || '').trim() || null},
        activa          = ${activa !== false},
        updated_at      = now()
      WHERE id = ${id}::uuid AND supervisor_id = ${supervisorId}::uuid
    `;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    logger.error('[supervisor-escuelas PUT]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// ── DELETE: quitar escuela de la zona ───────────────────────────────────────
export async function DELETE(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const supervisorId = await getSupervisorId(session.user.email);
    if (!supervisorId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    await sql()`
      DELETE FROM supervisor_escuelas WHERE id = ${id}::uuid AND supervisor_id = ${supervisorId}::uuid
    `;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    logger.error('[supervisor-escuelas DELETE]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
