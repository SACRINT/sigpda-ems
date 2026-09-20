/**
 * resolve-premium.ts — Helper aislado para resolver el nivel de acceso del docente.
 *
 * Separado de ai-provider/index.ts y de gemini.ts para evitar dependencias circulares.
 * Tanto el pool heredado de Gemini (gemini.ts) como el factory moderno (ai-provider/index.ts)
 * pueden importar desde aquí sin crear ciclos.
 */

import { neon } from '@neondatabase/serverless';

/**
 * Checks whether a teacher has is_premium=true OR an elevated role (admin/supervisor).
 * Returns false gracefully if DATABASE_URL is missing or the query fails.
 */
export async function resolveUserIsPremium(teacherId?: string): Promise<boolean> {
  if (!teacherId || !process.env.DATABASE_URL) return false;
  try {
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`
      SELECT role, COALESCE(is_premium, false) AS is_premium
      FROM teachers
      WHERE id = ${teacherId}::uuid
      LIMIT 1
    `;
    if (!rows[0]) return false;
    const { role, is_premium } = rows[0];
    return is_premium === true || role === 'administrador' || role === 'supervisor';
  } catch {
    return false;
  }
}
