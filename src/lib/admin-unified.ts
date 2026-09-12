import { sql } from './db';

/**
 * Sistema Unificado de Autorización Administrativa (SIGPDA-EMS)
 * Única fuente de verdad para la verificación de permisos de administrador.
 *
 * Un usuario es administrador si:
 * 1. Su correo figura en ADMIN_EMAILS o ADMIN_EMAIL (variable de entorno).
 * 2. Su correo está registrado en la tabla `admins`.
 * 3. Su registro en `teachers` tiene role === 'administrador'.
 */
export async function isAdmin(email?: string | null): Promise<boolean> {
  if (!email) return false;
  const cleanEmail = email.toLowerCase().trim();

  // 1. Verificación en variables de entorno (separadas por coma)
  const envAdmins = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || '')
    .split(',')
    .map((e) => e.toLowerCase().trim())
    .filter(Boolean);

  if (envAdmins.includes(cleanEmail)) {
    return true;
  }

  try {
    const db = sql();

    // 2. Verificación en tabla admins
    const adminRows = await db`
      SELECT email FROM admins
      WHERE LOWER(email) = ${cleanEmail}
      LIMIT 1
    `.catch(() => []);
    if (adminRows.length > 0) {
      return true;
    }

    // 3. Verificación en tabla teachers por rol
    const teacherRows = await db`
      SELECT role FROM teachers
      WHERE LOWER(email) = ${cleanEmail}
      LIMIT 1
    `.catch(() => []);
    if (teacherRows.length > 0 && teacherRows[0].role === 'administrador') {
      return true;
    }
  } catch (err) {
    console.warn('[isAdmin] Error al verificar permisos en base de datos:', err);
  }

  return false;
}
