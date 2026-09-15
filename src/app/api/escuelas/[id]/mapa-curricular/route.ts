import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sql, getTeacherByEmail } from "@/lib/db";

import { logger } from '@/lib/logger';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const currentTeacher = await getTeacherByEmail(session.user.email);
    if (!currentTeacher) {
      return NextResponse.json({ error: "Docente no encontrado" }, { status: 404 });
    }

    const params = await context.params;
    let targetTeacherId = params?.id;

    // Si el ID no es UUID válido o el usuario no es admin, usar el teacher.id autenticado
    if (!targetTeacherId || !UUID_REGEX.test(targetTeacherId)) {
      targetTeacherId = currentTeacher.id;
    } else if (
      currentTeacher.role !== "administrador" &&
      currentTeacher.role !== "admin" &&
      currentTeacher.role !== "supervision" &&
      targetTeacherId !== currentTeacher.id
    ) {
      // Directores y docentes solo configuran su propio plantel
      targetTeacherId = currentTeacher.id;
    }

    const body = await req.json();
    const { gruposPrimerAno, gruposSegundoAno, gruposTercerAno, gruposConfig, subsystem } = body;

    // Actualizar subsistema del plantel si fue seleccionado explícitamente
    if (subsystem) {
      const subsysNormalizado = (`${subsystem}`.toLowerCase().includes("tecnol"))
        ? "Bachillerato Tecnológico"
        : "bge";
      try {
        await sql()`
          UPDATE teachers
          SET subsystem = ${subsysNormalizado}, updated_at = NOW()
          WHERE id = ${targetTeacherId}::uuid;
        `;
      } catch (e) {
        logger.error("[api/escuelas/[id]/mapa-curricular POST] Error actualizando subsistema en teachers:", e);
      }
    }

    const g1 = Math.max(1, parseInt(`${gruposPrimerAno || 1}`, 10));
    const g2 = Math.max(1, parseInt(`${gruposSegundoAno || 1}`, 10));
    const g3 = Math.max(1, parseInt(`${gruposTercerAno || 1}`, 10));

    // 1. Guardar o actualizar horario_config
    await sql()`
      INSERT INTO horario_config (
        teacher_id, g1, g2, g3, mapa_curricular_completado, updated_at
      )
      VALUES (
        ${targetTeacherId}::uuid,
        ${g1},
        ${g2},
        ${g3},
        TRUE,
        NOW()
      )
      ON CONFLICT (teacher_id) DO UPDATE SET
        g1 = EXCLUDED.g1,
        g2 = EXCLUDED.g2,
        g3 = EXCLUDED.g3,
        mapa_curricular_completado = TRUE,
        updated_at = NOW();
    `;

    // Purgar grupos en BD que excedan la nueva estructura g1, g2, g3
    const letrasPermitidas = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
    const maxLetrasSem1y2 = letrasPermitidas.slice(0, g1);
    const maxLetrasSem3y4 = letrasPermitidas.slice(0, g2);
    const maxLetrasSem5y6 = letrasPermitidas.slice(0, g3);

    try {
      const dbGrupos = await sql()`SELECT id, nombre, semestre FROM horario_grupos WHERE teacher_id = ${targetTeacherId}::uuid`;
      const idsAEliminar: string[] = [];
      for (const dg of dbGrupos) {
        const partes = (dg.nombre || "").trim().split(" ");
        const letra = partes[partes.length - 1] || "";
        const sem = Number(dg.semestre);
        if ((sem === 1 || sem === 2) && !maxLetrasSem1y2.includes(letra)) {
          idsAEliminar.push(dg.id);
        } else if ((sem === 3 || sem === 4) && !maxLetrasSem3y4.includes(letra)) {
          idsAEliminar.push(dg.id);
        } else if ((sem === 5 || sem === 6) && !maxLetrasSem5y6.includes(letra)) {
          idsAEliminar.push(dg.id);
        }
      }
      if (idsAEliminar.length > 0) {
        await sql()`DELETE FROM horario_grupos WHERE id = ANY(${idsAEliminar}::uuid[])`;
      }
    } catch (e) {
      logger.warn("[api/escuelas/[id]/mapa-curricular POST] Error podando grupos excedentes:", e);
    }

    // 2. Guardar gruposConfig si se proporcionaron
    if (Array.isArray(gruposConfig) && gruposConfig.length > 0) {
      for (const item of gruposConfig) {
        if (!item.grupoNombre) continue;
        const nombre = (item.grupoNombre || "").trim();
        const sem = Math.max(1, parseInt(`${item.semestre || 1}`, 10));
        const ffeOpts = item.ffeOptativas ? JSON.stringify(item.ffeOptativas) : "[]";
        const horasDia = item.horasPorDia ? Number(item.horasPorDia) : null;

        await sql()`
          INSERT INTO horario_grupos (
            teacher_id, nombre, semestre, capacitacion_nombre, ffeo_socioemocional, ffe_optativas,
            carrera_tecnica_id, version_programa, materia_propedutica_5to, horas_por_dia
          )
          VALUES (
            ${targetTeacherId}::uuid,
            ${nombre},
            ${sem},
            ${item.capacitacionNombre || "Administracion"},
            ${item.ffeoSocioemocional || null},
            ${ffeOpts}::jsonb,
            ${item.carreraTecnicaId || null},
            ${item.versionPrograma || null},
            ${item.materiaPropedutica5to || null},
            ${horasDia}
          )
          ON CONFLICT (teacher_id, nombre) DO UPDATE SET
            semestre = EXCLUDED.semestre,
            capacitacion_nombre = EXCLUDED.capacitacion_nombre,
            ffeo_socioemocional = EXCLUDED.ffeo_socioemocional,
            ffe_optativas = EXCLUDED.ffe_optativas,
            carrera_tecnica_id = EXCLUDED.carrera_tecnica_id,
            version_programa = EXCLUDED.version_programa,
            materia_propedutica_5to = EXCLUDED.materia_propedutica_5to,
            horas_por_dia = COALESCE(EXCLUDED.horas_por_dia, horario_grupos.horas_por_dia);
        `;
      }
    }

    return NextResponse.json({
      success: true,
      message: "Mapa curricular y estructura del plantel guardados exitosamente",
    });
  } catch (error: any) {
    logger.error("[api/escuelas/[id]/mapa-curricular POST] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Error al guardar mapa curricular" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const currentTeacher = await getTeacherByEmail(session.user.email);
    if (!currentTeacher) {
      return NextResponse.json({ error: "Docente no encontrado" }, { status: 404 });
    }

    const params = await context.params;
    let targetTeacherId = params?.id;

    if (!targetTeacherId || !UUID_REGEX.test(targetTeacherId)) {
      targetTeacherId = currentTeacher.id;
    } else if (
      currentTeacher.role !== "administrador" &&
      currentTeacher.role !== "admin" &&
      currentTeacher.role !== "supervision" &&
      targetTeacherId !== currentTeacher.id
    ) {
      targetTeacherId = currentTeacher.id;
    }

    // 1. Desmarcar bandera en horario_config
    await sql()`
      UPDATE horario_config
      SET mapa_curricular_completado = FALSE, updated_at = NOW()
      WHERE teacher_id = ${targetTeacherId}::uuid;
    `;

    // 2. Limpiar grupos y cargas docentes asociadas
    await sql()`DELETE FROM horario_cargas WHERE teacher_id = ${targetTeacherId}::uuid;`;
    await sql()`DELETE FROM horario_grupos WHERE teacher_id = ${targetTeacherId}::uuid;`;

    return NextResponse.json({
      success: true,
      message: "Mapa curricular y grupos reiniciados correctamente",
    });
  } catch (error: any) {
    logger.error("[api/escuelas/[id]/mapa-curricular DELETE] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Error al reiniciar mapa curricular" },
      { status: 500 }
    );
  }
}
