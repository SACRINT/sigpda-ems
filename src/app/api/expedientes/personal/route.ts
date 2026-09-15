import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sql } from "@/lib/db";

import { logger } from '@/lib/logger';
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const escuelaId = searchParams.get("escuelaId");

    // Fetch teachers from database
    const rows = await sql()`
      SELECT id::text, name as nombre, email, role as cargo
      FROM teachers
      ORDER BY name ASC
    `;

    // Map data to personal format
    const personal = rows.map((t: any) => {
      const parts = (t.nombre || '').trim().split(' ');
      const nombre = parts[0] || '';
      const apellidoPaterno = parts.slice(1).join(' ') || '';
      
      const cargoMap: Record<string, string> = {
        'director': 'DIRECTOR',
        'administrador': 'ADMINISTRATIVO',
        'docente': 'DOCENTE'
      };

      return {
        id: t.id,
        nombre,
        apellidoPaterno,
        apellidoMaterno: '',
        cargo: cargoMap[t.cargo as string] || 'DOCENTE',
        horasOficiales: 20,
        horasAsignadas: 20,
      };
    });

    return NextResponse.json({ personal });
  } catch (error: any) {
    logger.error("[api/expedientes/personal] Error:", error);
    return NextResponse.json({ personal: [] });
  }
}
