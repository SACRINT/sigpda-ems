import { sql } from '@/lib/db/client';
import { auth } from '@/lib/auth';
import { getTeacherSchoolZone } from '@/lib/db/teachers';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const { schoolName, municipality, city, cct, subsystem, name, role, schoolZone } = body;

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
      SELECT id
      FROM teachers
      WHERE email = ${session.user.email}
      LIMIT 1
    `;

    if (!existing.length) {
      return NextResponse.json({ error: 'Docente no encontrado' }, { status: 404 });
    }

    // El perfil es editable en cualquier momento (cuentas multiplantel del dueño de la
    // plataforma y correcciones de usuarios): ya no se bloquea de por vida con school_locked.
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
        school_locked = false,
        updated_at = now()
      WHERE email = ${session.user.email}
    `;

    // Zona escolar (opcional): se guarda como precarga por defecto de los wizards
    // (custom_preferences.zona/zonaEscolar). La captura por documento siempre prevalece.
    if (typeof schoolZone === 'string' && schoolZone.trim()) {
      const z = schoolZone.trim();
      await db`
        UPDATE teachers
        SET custom_preferences = COALESCE(custom_preferences, '{}'::jsonb) || jsonb_build_object('zona', ${z}, 'zonaEscolar', ${z}),
            updated_at = now()
        WHERE email = ${session.user.email}
      `;
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
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
      SELECT id, name, school_name, municipality, city, cct, subsystem,
             profile_completed, school_locked, role
      FROM teachers
      WHERE email = ${session.user.email}
      LIMIT 1
    `;

    if (!rows.length) {
      return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    }

    // Zona escolar de precarga (horario_config → custom_preferences); los wizards
    // la usan solo si el campo está vacío, la captura del usuario siempre gana.
    const schoolZone = await getTeacherSchoolZone(rows[0].id);

    return NextResponse.json({ ...rows[0], schoolZone });
  } catch (error: unknown) {
    logger.error('[teacher-profile] GET Error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
