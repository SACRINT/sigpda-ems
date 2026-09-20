import { sql } from '@/lib/db/client';
import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const { schoolName, municipality, city, cct, subsystem, name, role, lockProfile } = body;

    // Validaciones básicas
    if (!schoolName?.trim() || !municipality?.trim() || !city?.trim() || !cct?.trim() || !subsystem?.trim()) {
      return NextResponse.json(
        { error: 'Todos los campos son requeridos' },
        { status: 400 }
      );
    }

    const VALID_ROLES = ['docente', 'director', 'supervisor'];
    if (role && !VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Rol no válido' }, { status: 400 });
    }

    const db = sql();

    // Verificar si existe el docente
    const existing = await db`
      SELECT id, school_locked, profile_completed
      FROM teachers
      WHERE email = ${session.user.email}
      LIMIT 1
    `;

    if (!existing.length) {
      return NextResponse.json({ error: 'Docente no encontrado' }, { status: 404 });
    }

    const teacher = existing[0];

    // Si el perfil ya está bloqueado, no permitir cambios en datos de escuela
    if (teacher.school_locked) {
      return NextResponse.json(
        { error: 'Los datos de tu escuela ya están bloqueados y no pueden modificarse.' },
        { status: 403 }
      );
    }

    // Actualizar el perfil del docente
    await db`
      UPDATE teachers SET
        name = ${name?.trim() || session.user.name || session.user.email},
        school_name = ${schoolName.trim()},
        municipality = ${municipality.trim()},
        city = ${city.trim()},
        cct = ${cct.trim()},
        subsystem = ${subsystem.trim()},
        role = COALESCE(${role || null}, role, 'docente'),
        profile_completed = true,
        school_locked = ${lockProfile === true},
        updated_at = now()
      WHERE email = ${session.user.email}
    `;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    logger.error('[teacher-profile] Error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// GET: obtener datos actuales del perfil
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const db = sql();
    const rows = await db`
      SELECT name, school_name, municipality, city, cct, subsystem,
             profile_completed, school_locked, role
      FROM teachers
      WHERE email = ${session.user.email}
      LIMIT 1
    `;

    if (!rows.length) {
      return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    }

    return NextResponse.json(rows[0]);
  } catch (error: any) {
    logger.error('[teacher-profile] GET Error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
