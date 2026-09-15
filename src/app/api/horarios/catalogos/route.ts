import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sql, getTeacherByEmail } from "@/lib/db";

import { logger } from '@/lib/logger';
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const teacher = await getTeacherByEmail(session.user.email);
    if (!teacher) {
      return NextResponse.json({ error: "Docente no encontrado" }, { status: 404 });
    }

    // Devuelve el personal registrado por este Director
    let rows: any[] = [];
    try {
      rows = await sql()`
        SELECT id::text, nombre, apellido_paterno, apellido_materno, cargo, horas_base, email
        FROM escuela_personal
        WHERE director_id = ${teacher.id}::uuid AND activo = TRUE
        ORDER BY apellido_paterno ASC, nombre ASC
      `;
    } catch (e) {
      logger.warn("[api/horarios/catalogos GET] Error consultando escuela_personal:", e);
    }

    const docentes = rows.map((p: any) => ({
      id: p.id,
      nombre: p.nombre || "",
      apellidoPaterno: p.apellido_paterno || "",
      apellidoMaterno: p.apellido_materno || "",
      cargo: p.cargo || "DOCENTE",
      horasAsignadas: p.horas_base || 20,
      email: p.email || "",
    }));

    return NextResponse.json({ success: true, docentes });
  } catch (error: any) {
    logger.error("[api/horarios/catalogos GET] Error:", error);
    return NextResponse.json({ error: "Error al obtener catálogo" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const teacher = await getTeacherByEmail(session.user.email);
    if (!teacher) {
      return NextResponse.json({ error: "Docente no encontrado" }, { status: 404 });
    }

    const body = await req.json();
    const { accion, nombre, apellidoPaterno, apellidoMaterno, email: emailDocente, cargo, horasBase } = body;

    if (accion === "CREAR_DOCENTE") {
      const nom = (nombre || "").trim();
      const apP = (apellidoPaterno || "").trim();
      const apM = (apellidoMaterno || "").trim();
      const car = (cargo || "DOCENTE").toUpperCase();
      const hrs = Number(horasBase) || 20;

      if (!nom || !apP) {
        return NextResponse.json({ error: "Nombre y apellido paterno son requeridos" }, { status: 400 });
      }

      let docenteId = `doc_temp_${Date.now()}`;
      try {
        const rows = await sql()`
          INSERT INTO escuela_personal
            (director_id, nombre, apellido_paterno, apellido_materno, email, cargo, horas_base)
          VALUES
            (${teacher.id}::uuid, ${nom}, ${apP}, ${apM || null}, ${(emailDocente || "").trim() || null}, ${car}, ${hrs})
          ON CONFLICT (director_id, nombre, apellido_paterno) DO UPDATE SET
            apellido_materno = EXCLUDED.apellido_materno,
            cargo            = EXCLUDED.cargo,
            horas_base       = EXCLUDED.horas_base,
            activo           = TRUE
          RETURNING id::text
        `;
        if (rows[0]?.id) docenteId = rows[0].id;
      } catch (e) {
        logger.warn("[api/horarios/catalogos POST] Insert escuela_personal error:", e);
      }

      const docente = {
        id: docenteId,
        nombre: nom,
        apellidoPaterno: apP,
        apellidoMaterno: apM,
        cargo: car,
        horasAsignadas: hrs,
        email: emailDocente || "",
      };
      return NextResponse.json({ success: true, docente });
    }

    return NextResponse.json({ error: "Acción no soportada" }, { status: 400 });
  } catch (error: any) {
    logger.error("[api/horarios/catalogos POST] Error:", error);
    return NextResponse.json({ error: "Error al procesar catálogo" }, { status: 500 });
  }
}
