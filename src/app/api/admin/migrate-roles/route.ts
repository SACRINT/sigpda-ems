import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { sql } from '@/lib/db';
import { isAdmin } from '@/lib/admin-unified';

/**
 * POST /api/admin/migrate-roles
 * Crea las tablas necesarias para el sistema de roles y personal por plantel.
 * Solo accesible para el superadministrador.
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
    const results: string[] = [];

    // 1. Asegurar columna `role` en teachers
    try {
      await db`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'docente'`;
      results.push('✅ Columna role asegurada en teachers');
    } catch (e: any) {
      results.push(`ℹ️ role en teachers: ${e.message}`);
    }

    // 2. Asegurar columna `city` en teachers
    try {
      await db`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS city TEXT`;
      results.push('✅ Columna city asegurada en teachers');
    } catch (e: any) {
      results.push(`ℹ️ city en teachers: ${e.message}`);
    }

    // 3. Crear tabla escuela_personal (personal del plantel del Director)
    try {
      await db`
        CREATE TABLE IF NOT EXISTS escuela_personal (
          id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          director_id      UUID NOT NULL,
          nombre           TEXT NOT NULL,
          apellido_paterno TEXT NOT NULL DEFAULT '',
          apellido_materno TEXT NOT NULL DEFAULT '',
          email            TEXT,
          cargo            TEXT NOT NULL DEFAULT 'DOCENTE',
          horas_base       INTEGER NOT NULL DEFAULT 20,
          activo           BOOLEAN NOT NULL DEFAULT TRUE,
          created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      results.push('✅ Tabla escuela_personal creada');
    } catch (e: any) {
      results.push(`ℹ️ escuela_personal: ${e.message}`);
    }

    // 4. Índice único en escuela_personal
    try {
      await db`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_escuela_personal_director_nombre
          ON escuela_personal(director_id, nombre, apellido_paterno)
      `;
      results.push('✅ Índice único escuela_personal creado');
    } catch (e: any) {
      results.push(`ℹ️ Índice escuela_personal: ${e.message}`);
    }

    // 5. Crear tabla supervisor_escuelas (escuelas de la zona del Supervisor)
    try {
      await db`
        CREATE TABLE IF NOT EXISTS supervisor_escuelas (
          id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          supervisor_id    UUID NOT NULL,
          nombre           TEXT NOT NULL,
          cct              TEXT,
          municipio        TEXT,
          subsistema       TEXT NOT NULL DEFAULT 'BGE',
          director_nombre  TEXT,
          director_email   TEXT,
          pmc_data         JSONB,
          paec_data        JSONB,
          activa           BOOLEAN NOT NULL DEFAULT TRUE,
          created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      results.push('✅ Tabla supervisor_escuelas creada');
    } catch (e: any) {
      results.push(`ℹ️ supervisor_escuelas: ${e.message}`);
    }

    // 6. Índice único en supervisor_escuelas
    try {
      await db`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_supervisor_escuelas_sup_cct
          ON supervisor_escuelas(supervisor_id, cct)
      `;
      results.push('✅ Índice único supervisor_escuelas creado');
    } catch (e: any) {
      results.push(`ℹ️ Índice supervisor_escuelas: ${e.message}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Migración completada',
      results,
    });
  } catch (error: any) {
    console.error('[admin/migrate-roles] Error:', error);
    return NextResponse.json({ error: error.message || 'Error en migración' }, { status: 500 });
  }
}
