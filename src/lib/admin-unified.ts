import { sql } from './db';
import { logger } from './logger';
import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

/**
 * Sistema Unificado de Autorización Administrativa (SIGPDA-EMS)
 * Única fuente de verdad para la verificación de permisos de administrador.
 *
 * Un usuario es administrador si:
 * 1. Su correo figura en ADMIN_EMAILS o ADMIN_EMAIL (variable de entorno).
 * 2. Su rol conocido o en tabla teachers es 'administrador' o 'admin'.
 * 3. Su correo está registrado en la tabla `admins`.
 */
export function isEnvAdmin(email?: string | null): boolean {
  if (!email) return false;
  const cleanEmail = email.toLowerCase().trim();
  const envAdmins = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || '')
    .split(',')
    .map((e) => e.toLowerCase().trim())
    .filter(Boolean);
  return envAdmins.includes(cleanEmail);
}

export async function isAdmin(email?: string | null, knownRole?: string | null): Promise<boolean> {
  if (!email) return false;
  const cleanEmail = email.toLowerCase().trim();

  // 1. Verificación en variables de entorno
  if (isEnvAdmin(cleanEmail)) {
    return true;
  }

  // 2. Rol conocido en memoria (evita query adicional si ya se dispone de la entidad docente)
  if (knownRole === 'administrador' || knownRole === 'admin') {
    return true;
  }

  try {
    const db = sql();

    // 3. Verificación en tabla admins
    const adminRows = await db`
      SELECT email FROM admins
      WHERE LOWER(email) = ${cleanEmail}
      LIMIT 1
    `.catch((err) => {
      logger.warn('[isAdmin] Fallo al consultar tabla admins:', { error: err });
      return [];
    });
    if (adminRows.length > 0 && Boolean(adminRows[0]?.email)) {
      return true;
    }

    // 4. Verificación en tabla teachers por rol
    const teacherRows = await db`
      SELECT role FROM teachers
      WHERE LOWER(email) = ${cleanEmail}
      LIMIT 1
    `.catch((err) => {
      logger.warn('[isAdmin] Fallo al consultar tabla teachers:', { error: err });
      return [];
    });
    if (
      teacherRows.length > 0 &&
      (teacherRows[0]?.role === 'administrador' || teacherRows[0]?.role === 'admin')
    ) {
      return true;
    }
  } catch (err) {
    logger.warn('[isAdmin] Error al verificar permisos en base de datos:', { error: err });
  }

  return false;
}

/**
 * Obtiene el rol consolidado del usuario para navegación y UI (AppLayout, Dashboard).
 */
export async function getUserRole(email?: string | null): Promise<{ isAdmin: boolean; role: string }> {
  if (!email) return { isAdmin: false, role: 'docente' };
  const adminOk = await isAdmin(email);
  if (adminOk) {
    return { isAdmin: true, role: 'administrador' };
  }

  const cleanEmail = email.toLowerCase().trim();
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const db = sql();
      const teacherRows = await db`SELECT role FROM teachers WHERE LOWER(email) = ${cleanEmail} LIMIT 1`;
      if (teacherRows.length > 0 && teacherRows[0]?.role) {
        return { isAdmin: false, role: teacherRows[0].role };
      }
      return { isAdmin: false, role: 'docente' };
    } catch (err) {
      if (attempt === 1) {
        logger.warn(`[getUserRole] Error fetching user role for ${email}, retrying...`, { attempt, error: err });
        await new Promise((resolve) => setTimeout(resolve, 200));
      } else {
        logger.error(`[getUserRole] Failed to fetch user role after retry for ${email}, defaulting to 'docente'`, { error: err });
      }
    }
  }
  return { isAdmin: false, role: 'docente' };
}

/**
 * Helper para rutas API de administración — verifica sesión y permisos de administrador.
 * Retorna el email autorizado o lanza error ('UNAUTHORIZED' o 'FORBIDDEN').
 */
export async function requireAdmin(): Promise<string> {
  const session = await auth();
  if (!session?.user?.email) {
    throw new Error('UNAUTHORIZED');
  }

  const email = session.user.email;
  const authorized = await isAdmin(email);

  if (!authorized) {
    throw new Error('FORBIDDEN');
  }

  return email;
}

export function adminUnauthorized() {
  return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
}

export function adminForbidden() {
  return NextResponse.json({ error: 'Acceso denegado. Solo administradores.' }, { status: 403 });
}

