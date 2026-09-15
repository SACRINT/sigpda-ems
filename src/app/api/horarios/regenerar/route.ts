import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sql, getTeacherByEmail } from "@/lib/db";
import { resolverHorario, SolverParams } from "@/lib/horarios/solver";

import { logger } from '@/lib/logger';
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

    const teacherId = teacher.id;
    const body = await req.json();
    const { horarioId, celdas = [] } = body;

    // 1. Cargar configuración existente
    let configRows: any[] = [];
    try {
      configRows = await sql()`
        SELECT * FROM horario_config WHERE teacher_id = ${teacherId}::uuid LIMIT 1
      `;
    } catch (e) {
      logger.warn("[api/horarios/regenerar POST] Error consultando horario_config:", e);
    }
    const configRow = configRows[0] || null;

    const bodySlots = body.slotsLibresBloqueados;
    const savedSlots = configRow?.horario_generado?.scoreMetricas?.slotsLibresBloqueados;
    const rawSlots: string[] = Array.isArray(bodySlots)
      ? bodySlots
      : (Array.isArray(savedSlots) ? savedSlots : []);

    const bodyRestricciones = body.restriccionesDocentes;
    const savedRestricciones = configRow?.horario_generado?.scoreMetricas?.restriccionesDocentes || configRow?.horario_generado?.restriccionesDocentes;
    const restriccionesDocentes = Array.isArray(bodyRestricciones)
      ? bodyRestricciones
      : (Array.isArray(savedRestricciones) ? savedRestricciones : []);

    const horasPorDia = configRow?.horas_por_dia || 6;
    const diasLectivos = configRow?.dias_lectivos || 5;
    const periodoActivo = configRow?.periodo_activo || "A";
    const semestresDeseados = periodoActivo === "B" ? [2, 4, 6] : [1, 3, 5];

    // 2. Cargar grupos del semestre activo
    const gruposRows = await sql()`
      SELECT id::text, nombre, semestre, horas_por_dia
      FROM horario_grupos
      WHERE teacher_id = ${teacherId}::uuid AND semestre = ANY(${semestresDeseados}::int[])
      ORDER BY semestre ASC, nombre ASC
    `;

    const grupos = gruposRows.map((g: any) => {
      const defaultHoras = g.semestre === 3 ? 8 : g.semestre === 5 ? 7 : 6;
      return {
        id: String(g.id || g.nombre),
        nombre: String(g.nombre),
        semestre: Number(g.semestre || 1),
        horasPorDia: g.horas_por_dia ? Number(g.horas_por_dia) : defaultHoras
      };
    });

    const maxHorasPlantel = Math.max(
      ...grupos.map((g: any) => g.horasPorDia),
      Number(horasPorDia || 6)
    );

    // 3. Cargar personal docente registrado
    const personalRows = await sql()`
      SELECT id::text, nombre, apellido_paterno, apellido_materno, cargo, horas_base, email
      FROM escuela_personal
      WHERE director_id = ${teacherId}::uuid AND activo = TRUE
      ORDER BY apellido_paterno ASC, nombre ASC
    `;

    const docentes = personalRows.map((d: any) => ({
      id: String(d.id),
      nombreCompleto: `${d.nombre || ''} ${d.apellido_paterno || ''} ${d.apellido_materno || ''}`.trim() || 'Docente',
      horasMaxDia: Number(horasPorDia)
    }));

    // 4. Cargar cargas académicas de la escuela
    const cargasRows = await sql()`
      SELECT id::text, grupo_nombre AS "grupoId", uac_name AS "uacName", personal_id AS "personalId", horas_semanales AS "horasSemanales", requiere_aula_esp AS "requiereAulaEspecial"
      FROM horario_cargas
      WHERE teacher_id = ${teacherId}::uuid
      ORDER BY grupo_nombre ASC, uac_name ASC
    `;

    const cargas = cargasRows.map((c: any, idx: number) => {
      const gMatch = grupos.find((g: any) => g.id === c.grupoId || g.nombre === c.grupoId);
      const grpId = gMatch ? gMatch.id : c.grupoId;

      return {
        id: c.id || `carga_${idx}`,
        docenteId: String(c.personalId || ''),
        grupoId: grpId,
        asignaturaId: String(c.uacName || ''),
        horasSemanales: Number(c.horasSemanales || 3),
        esHoraDoblePermitida: true,
        requiereAulaEspecial: !!c.requiereAulaEspecial
      };
    }).filter((c: any) => {
      const gMatch = grupos.find((g: any) => g.id === c.grupoId);
      return gMatch && c.docenteId && c.grupoId && c.horasSemanales > 0;
    });

    // 5. Extraer celdas fijas con candado (excluyendo las que colisionen con bloqueos recién fijados)
    const slotsBloqArr: string[] = rawSlots;
    const slotsBloqSet = new Set<string>(slotsBloqArr);

    const celdasFijas = (Array.isArray(celdas) ? celdas : [])
      .filter((c: any) => {
        if (!c.esBloqueado) return false;
        const kDoc = `${c.diaSemana}_${c.periodo}_${c.docenteId}`;
        const kGrp = `${c.diaSemana}_${c.periodo}_${c.grupoId}`;
        if (slotsBloqSet.has(kDoc) || slotsBloqSet.has(kGrp)) return false;
        return true;
      })
      .map((c: any) => {
        const gMatch = grupos.find((g: any) => g.id === c.grupoId || g.nombre === c.grupoId);
        const grpId = gMatch ? gMatch.id : c.grupoId;

        return {
          diaSemana: Number(c.diaSemana),
          periodo: Number(c.periodo),
          grupoId: grpId,
          docenteId: String(c.docenteId),
          asignaturaId: String(c.asignaturaId || c.uacName || ""),
          aulaId: c.aulaId || undefined
        };
      });

    // 6. Validación Previa de Factibilidad Matemática (Capacidad vs Bloqueos)
    const conflictosInfactibles: string[] = [];

    // Validar capacidad por grupo
    for (const g of grupos) {
      const maxP = g.horasPorDia || horasPorDia;
      const totalCapacidadTeorica = diasLectivos * maxP;
      const slotsBloqGrupo = slotsBloqArr.filter((k: string) => {
        const parts = k.split("_");
        return parts.length >= 3 && (parts[2] === g.id || parts[2] === g.nombre);
      }).length;

      const capacidadRealGrupo = totalCapacidadTeorica - slotsBloqGrupo;
      const hrsRequeridasGrupo = cargas
        .filter((c: any) => c.grupoId === g.id)
        .reduce((sum: number, c: any) => sum + (c.horasSemanales || 0), 0);

      if (hrsRequeridasGrupo > capacidadRealGrupo) {
        conflictosInfactibles.push(
          `El Grupo ${g.nombre} requiere ${hrsRequeridasGrupo} hrs de clase pero solo tiene ${capacidadRealGrupo} hrs disponibles por los bloqueos fijados (${slotsBloqGrupo} hrs bloqueadas).`
        );
      }
    }

    // Validar capacidad por docente
    for (const d of docentes) {
      const totalCapacidadTeorica = diasLectivos * horasPorDia;
      const slotsBloqDoc = slotsBloqArr.filter((k: string) => {
        const parts = k.split("_");
        return parts.length >= 3 && parts[2] === d.id;
      }).length;

      const capacidadRealDoc = totalCapacidadTeorica - slotsBloqDoc;
      const hrsRequeridasDoc = cargas
        .filter((c: any) => c.docenteId === d.id)
        .reduce((sum: number, c: any) => sum + (c.horasSemanales || 0), 0);

      if (hrsRequeridasDoc > capacidadRealDoc) {
        conflictosInfactibles.push(
          `El docente ${d.nombreCompleto} tiene ${hrsRequeridasDoc} hrs asignadas pero solo tiene ${capacidadRealDoc} hrs disponibles en la semana por los bloqueos fijados (${slotsBloqDoc} hrs bloqueadas).`
        );
      }
    }

    if (conflictosInfactibles.length > 0) {
      return NextResponse.json({
        success: false,
        error: conflictosInfactibles.join(" | "),
        conflictos: conflictosInfactibles
      }, { status: 422 });
    }

    // 7. Preparar parámetros del Solver Global
    const params: SolverParams = {
      diasLectivos,
      horasPorDia: maxHorasPlantel,
      grupos,
      docentes,
      aulas: [{ id: "aula-gen", nombre: "Aula General", tipo: "REGULAR" }],
      cargas,
      celdasFijas,
      slotsLibresBloqueados: slotsBloqArr,
      restriccionesDocentes
    };

    // 8. Ejecutar el Solver Global CSP + Min-Conflicts
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

    // 8. Construir horario actualizado
    const horarioIdFinal = horarioId || configRow?.horario_generado?.id || `horario_${Date.now()}`;
    const horarioActualizado = {
      id: horarioIdFinal,
      config: { horasPorDia: maxHorasPlantel, diasLectivos },
      scoreMetricas: {
        ...resultado.metricas,
        slotsLibresBloqueados: slotsBloqArr,
        restriccionesDocentes
      },
      celdas: resultado.celdas.map((c: any, idx: number) => {
        const docObj = personalRows.find((d: any) => String(d.id) === String(c.docenteId));
        const grpObj = gruposRows.find((g: any) => String(g.id) === String(c.grupoId) || String(g.nombre) === String(c.grupoId));
        const esFija = celdasFijas.some(
          (f: any) => f.diaSemana === c.diaSemana && f.periodo === c.periodo && f.grupoId === c.grupoId
        );

        return {
          id: c.id || `celda_${idx}_${Date.now()}`,
          diaSemana: c.diaSemana,
          periodo: c.periodo,
          grupoId: grpObj ? grpObj.id : c.grupoId,
          docenteId: docObj ? docObj.id : c.docenteId,
          asignaturaId: c.asignaturaId,
          uacName: c.asignaturaId,
          aulaId: c.aulaId,
          esBloqueado: esFija || !!c.esBloqueado,
          grupo: grpObj ? { id: grpObj.id, nombre: grpObj.nombre, semestre: grpObj.semestre } : undefined,
          docente: docObj ? { id: docObj.id, nombre: docObj.nombre, apellidoPaterno: docObj.apellido_paterno } : undefined
        };
      }),
      mensajesChat: configRow?.horario_generado?.mensajesChat || []
    };

    // 9. Persistir permanentemente en base de datos PostgreSQL Neon
    await sql()`
      UPDATE horario_config
      SET horario_generado = ${JSON.stringify(horarioActualizado)}
      WHERE teacher_id = ${teacherId}::uuid
    `;

    return NextResponse.json({
      success: true,
      horario: horarioActualizado,
      metricas: resultado.metricas,
      conflictos: resultado.conflictos
    });

  } catch (error: any) {
    logger.error("[api/horarios/regenerar] Error reoptimizando horario:", error);
    return NextResponse.json({ error: error.message || "Error interno al reoptimizar horario" }, { status: 500 });
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

    const teacherId = teacher.id;

    // 1. Cargar horario actual
    const configResult = await sql()`
      SELECT * FROM horario_config WHERE teacher_id = ${teacherId}::uuid LIMIT 1
    `;
    const configRow = configResult[0];
    const horarioActual = configRow?.horario_generado || {};

    // 2. Preservar únicamente las celdas que tengan candado (esBloqueado === true)
    const celdasPreservadas = Array.isArray(horarioActual.celdas)
      ? horarioActual.celdas.filter((c: any) => c.esBloqueado)
      : [];

    const horarioLimpio = {
      ...horarioActual,
      id: horarioActual.id || `horario_${Date.now()}`,
      celdas: celdasPreservadas,
      scoreMetricas: {
        ...(horarioActual.scoreMetricas || {}),
        totalClasesProgramadas: celdasPreservadas.length
      }
    };

    // 3. Persistir horario limpio en base de datos
    await sql()`
      UPDATE horario_config
      SET horario_generado = ${JSON.stringify(horarioLimpio)}
      WHERE teacher_id = ${teacherId}::uuid
    `;

    return NextResponse.json({
      success: true,
      horario: horarioLimpio,
      mensaje: "Retícula limpiada exitosamente. Las celdas con candado se han preservado."
    });

  } catch (error: any) {
    logger.error("[api/horarios/regenerar] Error limpiando horario:", error);
    return NextResponse.json({ error: error.message || "Error interno al limpiar horario" }, { status: 500 });
  }
}
