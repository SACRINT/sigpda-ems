import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { sql } from '@/lib/db';
import { isAdmin } from '@/lib/admin-unified';

import { logger } from '@/lib/logger';
/**
 * POST /api/admin/migrate-roles
 * Consulta y valida el estado del esquema para el sistema de roles y personal por plantel.
 * Solo accesible para el superadministrador.
 * Nota: Cualquier modificación DDL debe ejecutarse de forma controlada mediante scripts/migrate-roles.sql.
 */
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const authorized = await isAdmin(session.user.email);
    if (!authorized) {
      return NextResponse.json({ error: 'Acceso restringido al superadmin' }, { status: 403 });
    }

    const db = sql();

    // Verificación no destructiva (solo lectura) de tablas en information_schema
    const tablesCheck = await db`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('escuela_personal', 'supervisor_escuelas')
    `;

    // Verificación no destructiva de columnas en teachers
    const columnsCheck = await db`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'teachers' 
        AND column_name IN ('role', 'city')
    `;

    const existingTables = (tablesCheck as Array<{ table_name: string }>).map((r) => r.table_name);
    const existingColumns = (columnsCheck as Array<{ column_name: string }>).map((r) => r.column_name);

    const isComplete =
      existingTables.includes('escuela_personal') &&
      existingTables.includes('supervisor_escuelas') &&
      existingColumns.includes('role') &&
      existingColumns.includes('city');

    return NextResponse.json({
      success: true,
      status: isComplete ? 'applied' : 'pending_manual_migration',
      message: isComplete
        ? 'El esquema de roles y personal por plantel está verificado y activo.'
        : 'Esquema incompleto. Ejecute scripts/migrate-roles.sql desde la consola de base de datos.',
      verification: {
        tables: {
          escuela_personal: existingTables.includes('escuela_personal'),
          supervisor_escuelas: existingTables.includes('supervisor_escuelas'),
        },
        columnsTeachers: {
          role: existingColumns.includes('role'),
          city: existingColumns.includes('city'),
        },
      },
    });
  } catch (error: any) {
    logger.error('[admin/migrate-roles] Error:', error);
    return NextResponse.json({ error: error.message || 'Error en verificación de migración' }, { status: 500 });
  }
}
