/**
 * Endpoint Oficial Consolidado de Resolución y Persistencia de Horarios Escolares.
 * Maneja normalización de docentes, jornadas por grupo, ejecución del solver y persistencia en Neon DB.
 * Nota: Reemplaza y consolida la ruta deprecada /api/horarios/generate.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sql, getTeacherByEmail } from "@/lib/db";
import { resolverHorario, SolverParams } from "@/lib/horarios/solver";
import { logger } from "@/lib/logger";

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
    const rawParams = body.params || body;

    const gruposRaw = Array.isArray(rawParams.grupos) ? rawParams.grupos : [];
    const docentesRaw = Array.isArray(rawParams.docentes) ? rawParams.docentes : [];
    const cargasRaw = Array.isArray(rawParams.cargas) ? rawParams.cargas : [];
    const diasLectivos = Number(rawParams.diasLectivos || 5);

    // Normalizar docentes
    const docentes = docentesRaw.map((d: any) => ({
      id: String(d.id),
      nombreCompleto: d.nombreCompleto || `${d.nombre || ''} ${d.apellidoPaterno || ''} ${d.apellidoMaterno || ''}`.trim() || 'Docente',
      horasMaxDia: Number(d.horasMaxDia || 6),
    }));

    // Pre-normalizar IDs de grupos
    const grupoNombres = new Map<string, string>();
    gruposRaw.forEach((g: any) => {
      const gid = String(g.id || g.nombre);
      const gnom = String(g.nombre || g.id);
      grupoNombres.set(gid, gid);
      grupoNombres.set(gnom, gid);
      grupoNombres.set(gnom.replace(/º/g, '°'), gid);
    });

    // Normalizar cargas (soportar docenteId / personalId, grupoId / grupo_nombre, asignaturaId / uacName)
    const cargas = cargasRaw.map((c: any, idx: number) => {
      const docId = String(c.docenteId || c.personalId || '');
      const rawGrp = String(c.grupoId || c.grupo_nombre || '');
      const grpId = grupoNombres.get(rawGrp) || grupoNombres.get(rawGrp.replace(/º/g, '°')) || rawGrp;
      const asigId = String(c.uacName || c.asignaturaId || `uac_${idx}`);
      const horas = Number(c.horasSemanales || c.horas_semanales || 3);

      return {
        id: c.id || `carga_${idx}`,
        docenteId: docId,
        grupoId: grpId,
        asignaturaId: asigId,
        horasSemanales: horas,
        esHoraDoblePermitida: c.esHoraDoblePermitida !== false,
        requiereAulaEspecial: !!c.requiereAulaEspecial,
        aulaEspecialId: c.aulaEspecialId,
      };
    }).filter((c: any) => c.docenteId && c.grupoId && c.horasSemanales > 0);

    // Calcular carga total por grupo para asegurar capacidad de ranuras suficiente
    const horasPorGrupo = new Map<string, number>();
    for (const c of cargas) {
      horasPorGrupo.set(c.grupoId, (horasPorGrupo.get(c.grupoId) || 0) + c.horasSemanales);
    }

    // Determinar la jornada máxima diaria requerida para que quepan todas las materias
    // Normalizar grupos con su jornada individual requerida
    const grupos = gruposRaw.map((g: any) => {
      const gId = String(g.id || g.nombre);
      const horasTotalesGrupo = horasPorGrupo.get(gId) || 0;
      const minDiarioGrupo = Math.ceil(horasTotalesGrupo / diasLectivos);
      const defaultHoras = g.semestre === 3 ? 8 : g.semestre === 5 ? 7 : 6;
      const gHorasConfig = g.horasPorDia ? Number(g.horasPorDia) : (g.horas_por_dia ? Number(g.horas_por_dia) : defaultHoras);
      return {
        id: gId,
        nombre: String(g.nombre || g.id),
        semestre: Number(g.semestre || 1),
        horasPorDia: Math.max(gHorasConfig, minDiarioGrupo, 1),
      };
    });

    // La jornada global de la retícula escolar (Horario Maestro) debe ser la máxima de los grupos
    const horasPorDiaFinal = Math.max(
      Number(rawParams.horasPorDia || 6),
      ...grupos.map((g: any) => g.horasPorDia),
      6
    );

    const params: SolverParams = {
      diasLectivos,
      horasPorDia: horasPorDiaFinal,
      grupos,
      docentes,
      aulas: Array.isArray(rawParams.aulas) && rawParams.aulas.length > 0
        ? rawParams.aulas
        : [{ id: "aula-gen", nombre: "Aula General", tipo: "REGULAR" }],
      cargas,
      celdasFijas: rawParams.celdasFijas || [],
      restriccionesDocentes: rawParams.restriccionesDocentes || [],
      slotsLibresBloqueados: rawParams.slotsLibresBloqueados || [],
    };

    if (params.grupos.length === 0 || params.docentes.length === 0 || params.cargas.length === 0) {
      return NextResponse.json({
        success: false,
        error: "Debe configurar grupos, docentes y asignar materias antes de generar el horario.",
      }, { status: 400 });
    }

    const resultado = resolverHorario(params);

    if (!resultado.exito) {
      const errorDetalle = resultado.conflictos && resultado.conflictos.length > 0
        ? resultado.conflictos.join(". ")
        : "No fue posible generar un horario válido con las restricciones y bloqueos actuales.";

      return NextResponse.json({
        success: false,
        error: errorDetalle,
        conflictos: resultado.conflictos || []
      }, { status: 422 });
    }

    const horarioGenerado = {
      id: `horario_${Date.now()}`,
      config: {
        horasPorDia: params.horasPorDia || 6,
        diasLectivos: params.diasLectivos || 5
      },
      scoreMetricas: {
        ...resultado.metricas,
        slotsLibresBloqueados: Array.isArray(params.slotsLibresBloqueados)
          ? params.slotsLibresBloqueados
          : params.slotsLibresBloqueados
          ? Array.from(params.slotsLibresBloqueados)
          : []
      },
      celdas: resultado.celdas.map((c, idx) => ({
        id: `celda_${idx}_${c.diaSemana}_${c.periodo}_${c.grupoId}`,
        diaSemana: c.diaSemana,
        periodo: c.periodo,
        grupoId: c.grupoId,
        docenteId: c.docenteId,
        asignaturaId: c.asignaturaId,
        aulaId: c.aulaId || null,
        cargaId: c.cargaId || null,
        esBloqueado: !!c.esBloqueado
      }))
    };

    // Guardar horario generado permanentemente en la base de datos
    try {
      await sql()`
        UPDATE horario_config
        SET horario_generado = ${JSON.stringify(horarioGenerado)}::jsonb,
            horas_por_dia = ${params.horasPorDia},
            updated_at = NOW()
        WHERE teacher_id = ${teacher.id}::uuid
      `;
    } catch (e: any) {
      logger.warn("[api/horarios/generar] Error guardando horario_generado en horario_config", { error: e?.message || String(e) });
    }

    return NextResponse.json({
      success: true,
      exitoSolver: resultado.exito,
      metricas: resultado.metricas,
      conflictos: resultado.conflictos,
      horario: horarioGenerado,
      resultado
    });
  } catch (error: any) {
    logger.error("[api/horarios/generar] Error en POST:", error);
    return NextResponse.json({ error: error.message || "Error al generar horario con IA" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const teacher = await getTeacherByEmail(session.user.email);
    if (!teacher) {
      return NextResponse.json({ error: "Docente no encontrado" }, { status: 404 });
    }

    try {
      await sql()`
        UPDATE horario_config
        SET horario_generado = NULL,
            updated_at = NOW()
        WHERE teacher_id = ${teacher.id}::uuid
      `;
    } catch (e: any) {
      logger.warn("[api/horarios/generar DELETE] Error limpiando horario_generado", { error: e?.message || String(e) });
    }

    return NextResponse.json({ success: true, message: "Horario eliminado correctamente" });
  } catch (error: any) {
    logger.error("[api/horarios/generar] Error en DELETE:", error);
    return NextResponse.json({ error: "Error al eliminar horario" }, { status: 500 });
  }
}
