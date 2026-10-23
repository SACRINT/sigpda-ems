import { sql } from '@/lib/db/client';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { CATALOGO_PUEBLA_FIJO } from '@/lib/catalogo-escuelas';

function getDb() { return sql(); }


export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const rawCct = searchParams.get('cct') || searchParams.get('q') || '';
    const cctBuscado = rawCct.trim().toUpperCase();

    if (!cctBuscado) {
      return NextResponse.json({
        success: true,
        catalogo: CATALOGO_PUEBLA_FIJO
      });
    }

    // 1. Buscar primero en el catálogo maestro predefinido de Puebla
    const matchFijo = CATALOGO_PUEBLA_FIJO.find(
      (e) => e.cct.toUpperCase() === cctBuscado
    );
    if (matchFijo) {
      return NextResponse.json({
        success: true,
        escuela: matchFijo
      });
    }

    // 2. Buscar en las tablas dinámicas de la base de datos (supervisor_escuelas, teachers, pmc_projects)
    try {
      const sql = getDb();

      // Buscar en supervisor_escuelas
      const rowsSupervisor = await sql`
        SELECT nombre, cct, municipio, subsistema, zona_clave_std
        FROM supervisor_escuelas
        WHERE UPPER(TRIM(cct)) = ${cctBuscado}
        LIMIT 1
      `;
      if (rowsSupervisor.length > 0) {
        const row = rowsSupervisor[0];
        const zonaClave = typeof row.zona_clave_std === 'string' ? row.zona_clave_std.trim() : '';
        const zonaEscolar = zonaClave
          ? `Zona Escolar ${zonaClave.padStart(3, '0')}`
          : 'Zona no registrada';
        return NextResponse.json({
          success: true,
          escuela: {
            cct: row.cct,
            nombre: row.nombre,
            municipio: row.municipio || 'Venustiano Carranza',
            localidad: row.localidad || row.municipio || 'Lázaro Cárdenas',
            zonaEscolar,
            subsistema: row.subsistema || 'BGE'
          }
        });
      }

      // Buscar en teachers (columnas reales: cct / municipality / custom_preferences)
      const rowsTeachers = await sql`
        SELECT school_name, cct, municipality, subsystem, custom_preferences
        FROM teachers
        WHERE UPPER(TRIM(cct)) = ${cctBuscado}
        LIMIT 1
      `;
      if (rowsTeachers.length > 0) {
        const row = rowsTeachers[0];
        const prefs = (row.custom_preferences ?? {}) as { zonaEscolar?: unknown; zona?: unknown };
        const zonaPrefs =
          typeof prefs.zonaEscolar === 'string' ? prefs.zonaEscolar.trim()
          : typeof prefs.zona === 'string' ? prefs.zona.trim()
          : '';
        const zonaEscolar = !zonaPrefs
          ? 'Zona no registrada'
          : /zona/i.test(zonaPrefs)
          ? zonaPrefs
          : `Zona Escolar ${zonaPrefs}`;
        return NextResponse.json({
          success: true,
          escuela: {
            cct: row.cct || cctBuscado,
            nombre: row.school_name || 'Bachillerato General',
            municipio: row.municipality || 'Puebla',
            localidad: row.municipality || 'Puebla',
            zonaEscolar,
            subsistema: row.subsystem || 'BGE'
          }
        });
      }

      // Buscar en pmc_projects
      const rowsPmc = await sql`
        SELECT school_name, school_cct, municipality, locality, school_zone, subsystem
        FROM pmc_projects
        WHERE UPPER(TRIM(school_cct)) = ${cctBuscado}
        LIMIT 1
      `;
      if (rowsPmc.length > 0) {
        const row = rowsPmc[0];
        return NextResponse.json({
          success: true,
          escuela: {
            cct: row.school_cct || cctBuscado,
            nombre: row.school_name || 'Bachillerato General',
            municipio: row.municipality || 'Puebla',
            localidad: row.locality || row.municipality || 'Puebla',
            zonaEscolar: row.school_zone || 'Zona no registrada',
            subsistema: row.subsystem || 'BGE'
          }
        });
      }
    } catch (dbErr) {
      logger.warn('[catalogo-escuelas] Error consultando BD dinámica:', { error: String(dbErr) });
    }

    // 3. No se encontró ni en catálogo maestro ni en la base de datos
    return NextResponse.json(
      {
        success: false,
        error: 'CCT no encontrado en el catálogo de Puebla'
      },
      { status: 404 }
    );
  } catch (err) {
    logger.error('[catalogo-escuelas] Error interno:', { error: String(err) });
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor al consultar el catálogo' },
      { status: 500 }
    );
  }
}
