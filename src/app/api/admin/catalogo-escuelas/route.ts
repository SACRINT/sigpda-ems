import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { neon } from '@neondatabase/serverless';
import { logger } from '@/lib/logger';

function getDb() {
  return neon(process.env.DATABASE_URL!);
}

interface EscuelaCatalogo {
  cct: string;
  nombre: string;
  municipio: string;
  localidad: string;
  zonaEscolar: string;
  subsistema: string;
}

// Catálogo maestro oficial de Bachilleratos del Estado de Puebla
const CATALOGO_PUEBLA_FIJO: EscuelaCatalogo[] = [
  {
    cct: '21EBH0200X',
    nombre: 'Héroes de la Patria',
    municipio: 'Venustiano Carranza',
    localidad: 'Lázaro Cárdenas',
    zonaEscolar: 'Zona Escolar 004',
    subsistema: 'BGE'
  },
  {
    cct: '21EBH0214Z',
    nombre: 'Mecapalapa',
    municipio: 'Pantepec',
    localidad: 'Mecapalapa',
    zonaEscolar: 'Zona Escolar 004',
    subsistema: 'BGE'
  },
  {
    cct: '21EBH0789L',
    nombre: 'David Alfaro Siqueiros',
    municipio: 'Francisco Z. Mena',
    localidad: 'Jaltocán',
    zonaEscolar: 'Zona Escolar 004',
    subsistema: 'BGE'
  },
  {
    cct: '21EBH0608L',
    nombre: 'Emiliano Zapata',
    municipio: 'Venustiano Carranza',
    localidad: 'Coronel Tito Hernández (María Andrea)',
    zonaEscolar: 'Zona Escolar 004',
    subsistema: 'BGE'
  },
  {
    cct: '21EBH0040G',
    nombre: 'Bachillerato General Lic. Benito Juárez García',
    municipio: 'Puebla',
    localidad: 'Heroica Puebla de Zaragoza',
    zonaEscolar: 'Zona Escolar 001',
    subsistema: 'BGE'
  },
  {
    cct: '21EBH0189B',
    nombre: 'Bachillerato General Digital No. 189',
    municipio: 'Chignahuapan',
    localidad: 'Chignahuapan',
    zonaEscolar: 'Zona Escolar 002',
    subsistema: 'BD'
  },
  {
    cct: '21EBH0015X',
    nombre: 'Bachillerato General Oficial Manuel Ávila Camacho',
    municipio: 'Teziutlán',
    localidad: 'Teziutlán',
    zonaEscolar: 'Zona Escolar 003',
    subsistema: 'BGE'
  },
  {
    cct: '21EBH0001X',
    nombre: 'Bachillerato Matutino del BINE',
    municipio: 'Puebla',
    localidad: 'Heroica Puebla de Zaragoza',
    zonaEscolar: 'Zona Escolar 001',
    subsistema: 'BGE'
  },
  {
    cct: '21ECT0017T',
    nombre: 'Centro de Bachillerato Tecnológico No. 17',
    municipio: 'Huauchinango',
    localidad: 'Huauchinango',
    zonaEscolar: 'Zona Escolar 005',
    subsistema: 'BT'
  },
  {
    cct: '21EBH0245M',
    nombre: 'Bachillerato General Venustiano Carranza',
    municipio: 'Venustiano Carranza',
    localidad: 'Agua Fría',
    zonaEscolar: 'Zona Escolar 004',
    subsistema: 'BGE'
  },
  {
    cct: '21EBH0048X',
    nombre: 'Bachillerato General Gregorio de Gante',
    municipio: 'Puebla',
    localidad: 'Heroica Puebla de Zaragoza',
    zonaEscolar: 'Zona Escolar 001',
    subsistema: 'BGE'
  },
  {
    cct: '21EBH0123Z',
    nombre: 'Bachillerato General Ignacio Zaragoza',
    municipio: 'San Pedro Cholula',
    localidad: 'Cholula de Rivadavia',
    zonaEscolar: 'Zona Escolar 002',
    subsistema: 'BGE'
  }
];

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
        SELECT nombre, cct, municipio, subsistema
        FROM supervisor_escuelas
        WHERE UPPER(TRIM(cct)) = ${cctBuscado}
        LIMIT 1
      `;
      if (rowsSupervisor.length > 0) {
        const row = rowsSupervisor[0];
        return NextResponse.json({
          success: true,
          escuela: {
            cct: row.cct,
            nombre: row.nombre,
            municipio: row.municipio || 'Venustiano Carranza',
            localidad: row.localidad || row.municipio || 'Lázaro Cárdenas',
            zonaEscolar: 'Zona Escolar 004',
            subsistema: row.subsistema || 'BGE'
          }
        });
      }

      // Buscar en teachers
      const rowsTeachers = await sql`
        SELECT school_name, school_cct, municipality, subsystem
        FROM teachers
        WHERE UPPER(TRIM(school_cct)) = ${cctBuscado}
        LIMIT 1
      `;
      if (rowsTeachers.length > 0) {
        const row = rowsTeachers[0];
        return NextResponse.json({
          success: true,
          escuela: {
            cct: row.school_cct || cctBuscado,
            nombre: row.school_name || 'Bachillerato General',
            municipio: row.municipio || 'Puebla',
            localidad: row.municipio || 'Puebla',
            zonaEscolar: 'Zona Escolar Puebla',
            subsistema: row.subsystem || 'BGE'
          }
        });
      }

      // Buscar en pmc_projects
      const rowsPmc = await sql`
        SELECT school_name, school_cct, municipality, subsystem
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
            municipio: row.municipio || 'Puebla',
            localidad: row.municipio || 'Puebla',
            zonaEscolar: 'Zona Escolar Puebla',
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
  } catch (err: any) {
    logger.error('[catalogo-escuelas] Error interno:', { error: String(err) });
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor al consultar el catálogo' },
      { status: 500 }
    );
  }
}
