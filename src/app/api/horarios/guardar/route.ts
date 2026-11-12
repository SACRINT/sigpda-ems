import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { DIRECTIVO_ROLES, guardRole } from "@/lib/rbac";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const guard = await guardRole(DIRECTIVO_ROLES);
    if (!guard.ok) return guard.response;
    const { teacher } = guard.context;

    const body = await req.json();
    const { horarioId, celdas, slotsLibresBloqueados } = body;

    if (!horarioId || !Array.isArray(celdas)) {
      return NextResponse.json({ error: "horarioId y celdas son requeridos." }, { status: 400 });
    }

    let prevMetricas = {};
    try {
      const existing = await sql()`SELECT horario_generado FROM horario_config WHERE teacher_id = ${teacher.id}::uuid LIMIT 1`;
      prevMetricas = existing[0]?.horario_generado?.scoreMetricas || {};
    } catch (err) {
      logger.warn('[HorariosGuardar] Failed to read prevMetricas from horario_config', { error: err, teacherId: teacher.id });
    }

    const horarioActualizado = {
      id: horarioId,
      celdas,
      scoreMetricas: {
        ...prevMetricas,
        slotsLibresBloqueados: Array.isArray(slotsLibresBloqueados) ? slotsLibresBloqueados : []
      }
    };

    try {
      await sql()`
        UPDATE horario_config
        SET horario_generado = ${JSON.stringify(horarioActualizado)}::jsonb,
            updated_at = NOW()
        WHERE teacher_id = ${teacher.id}::uuid
      `;
    } catch (e) {
      logger.warn("[api/horarios/guardar] Error actualizando horario_generado:", { error: e });
    }

    return NextResponse.json({
      success: true,
      message: "Horario guardado permanentemente.",
      horario: horarioActualizado
    });
  } catch (error: any) {
    logger.error("[api/horarios/guardar] Error en POST:", { error });
    return NextResponse.json(
      { error: "Error al guardar los cambios del horario." },
      { status: 500 }
    );
  }
}
