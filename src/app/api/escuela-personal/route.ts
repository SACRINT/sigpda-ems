import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { sql, getTeacherByEmail } from '@/lib/db';

import { logger } from '@/lib/logger';
async function getDirectorId(email: string) {
  const teacher = await getTeacherByEmail(email);
  if (!teacher) return null;
  const isAdmin = teacher.role === 'administrador' || teacher.role === 'admin' || email === process.env.ADMIN_EMAIL;
  if (teacher.role !== 'director' && teacher.role !== 'supervisor' && !isAdmin) return null;
  return teacher.id as string;
}

// ── GET: listar personal del plantel ────────────────────────────────────────
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const directorId = await getDirectorId(session.user.email);
    if (!directorId) {
      return NextResponse.json({ error: 'Solo los directores pueden gestionar personal' }, { status: 403 });
    }

    const personal = await sql()`
      SELECT id, nombre, apellido_paterno, apellido_materno, email,
             cargo, horas_base, activo, created_at
      FROM escuela_personal
      WHERE director_id = ${directorId}::uuid
      ORDER BY apellido_paterno, nombre
    `;

    return NextResponse.json({ personal });
  } catch (err: any) {
    logger.error('[escuela-personal GET]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// ── POST: agregar docente al plantel ────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const directorId = await getDirectorId(session.user.email);
    if (!directorId) {
      return NextResponse.json({ error: 'Solo los directores pueden agregar personal' }, { status: 403 });
    }

    const body = await req.json();
    const { nombre, apellidoPaterno, apellidoMaterno, email, cargo, horasBase } = body;

    if (!nombre?.trim() || !apellidoPaterno?.trim()) {
      return NextResponse.json({ error: 'Nombre y apellido paterno son requeridos' }, { status: 400 });
    }

    const CARGOS_VALIDOS = ['DOCENTE', 'DIRECTIVO', 'PREFECTO', 'ORIENTADOR', 'ADMINISTRATIVO', 'OTRO'];
    const cargoNorm = (cargo || 'DOCENTE').toUpperCase();
    if (!CARGOS_VALIDOS.includes(cargoNorm)) {
      return NextResponse.json({ error: 'Cargo no válido' }, { status: 400 });
    }

    const horas = Number(horasBase) || 20;
    if (horas < 1 || horas > 50) {
      return NextResponse.json({ error: 'Horas base debe estar entre 1 y 50' }, { status: 400 });
    }

    const result = await sql()`
      INSERT INTO escuela_personal
        (director_id, nombre, apellido_paterno, apellido_materno, email, cargo, horas_base)
      VALUES
        (${directorId}::uuid, ${nombre.trim()}, ${apellidoPaterno.trim()},
         ${(apellidoMaterno || '').trim()}, ${(email || '').trim() || null},
         ${cargoNorm}, ${horas})
      ON CONFLICT (director_id, nombre, apellido_paterno) DO NOTHING
      RETURNING id
    `;

    if (!result.length) {
      return NextResponse.json({ error: 'Ya existe un docente con ese nombre y apellido' }, { status: 409 });
    }

    return NextResponse.json({ success: true, id: result[0].id });
  } catch (err: any) {
    logger.error('[escuela-personal POST]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// ── PUT: editar docente ──────────────────────────────────────────────────────
export async function PUT(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const directorId = await getDirectorId(session.user.email);
    if (!directorId) {
      return NextResponse.json({ error: 'Solo los directores pueden editar personal' }, { status: 403 });
    }

    const body = await req.json();
    const { id, nombre, apellidoPaterno, apellidoMaterno, email, cargo, horasBase, activo } = body;

    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    const CARGOS_VALIDOS = ['DOCENTE', 'DIRECTIVO', 'PREFECTO', 'ORIENTADOR', 'ADMINISTRATIVO', 'OTRO'];
    const cargoNorm = (cargo || 'DOCENTE').toUpperCase();
    if (!CARGOS_VALIDOS.includes(cargoNorm)) {
      return NextResponse.json({ error: 'Cargo no válido' }, { status: 400 });
    }

    await sql()`
      UPDATE escuela_personal SET
        nombre           = ${nombre?.trim()},
        apellido_paterno = ${apellidoPaterno?.trim()},
        apellido_materno = ${(apellidoMaterno || '').trim()},
        email            = ${(email || '').trim() || null},
        cargo            = ${cargoNorm},
        horas_base       = ${Number(horasBase) || 20},
        activo           = ${activo !== false},
        updated_at       = now()
      WHERE id = ${id}::uuid AND director_id = ${directorId}::uuid
    `;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    logger.error('[escuela-personal PUT]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// ── DELETE: eliminar docente ─────────────────────────────────────────────────
export async function DELETE(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const directorId = await getDirectorId(session.user.email);
    if (!directorId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    await sql()`
      DELETE FROM escuela_personal WHERE id = ${id}::uuid AND director_id = ${directorId}::uuid
    `;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    logger.error('[escuela-personal DELETE]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
