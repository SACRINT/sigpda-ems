import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sql, getTeacherByEmail } from "@/lib/db";
import { logger } from "@/lib/logger";

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

    const teacherId = teacher.id;

    // ── Configuración del horario ──────────────────────────────────────
    let configRows: any[] = [];
    try {
      configRows = await sql()`
        SELECT * FROM horario_config WHERE teacher_id = ${teacherId}::uuid LIMIT 1
      `;
    } catch {
      // Tabla no existe aún — retornar defaults
    }

    const configDB = configRows[0] || null;
    const config = {
      diasLectivos: configDB?.dias_lectivos ?? 5,
      horasPorDia: configDB?.horas_por_dia ?? 6,
      horaInicio: configDB?.hora_inicio ?? "08:00",
      periodoActivo: configDB?.periodo_activo ?? "A",
      duracionMinutos: 50,
      recesoTrasPeriodo: 3,
      duracionReceso: 20,
      g1: configDB?.g1 !== undefined ? Number(configDB.g1) : 1,
      g2: configDB?.g2 !== undefined ? Number(configDB.g2) : 1,
      g3: configDB?.g3 !== undefined ? Number(configDB.g3) : 1,
    };

    // ── Grupos guardados ───────────────────────────────────────────────
    let gruposRows: any[] = [];
    try {
      gruposRows = await sql()`
        SELECT
          id::text,
          nombre,
          semestre,
          capacitacion_nombre      AS "capacitacionNombre",
          ffeo_socioemocional      AS "ffeoSocioemocional",
          ffe_optativas            AS "ffeOptativas",
          carrera_tecnica_id       AS "carreraTecnicaId",
          version_programa         AS "versionPrograma",
          materia_propedutica_5to  AS "materiaPropedutica5to",
          custom_uacs              AS "customUacs",
          horas_por_dia            AS "horasPorDia"
        FROM horario_grupos
        WHERE teacher_id = ${teacherId}::uuid
        ORDER BY semestre ASC, nombre ASC
      `;
    } catch { /* tabla no existe */ }

    // Estructura de escuela (usando datos del teacher + config + conteo real de grupos)
    const tieneGruposDB = gruposRows.length > 0;
    const g1Count = Math.max(
      gruposRows.filter(g => g.semestre === 1).length,
      gruposRows.filter(g => g.semestre === 2).length
    );
    const g2Count = Math.max(
      gruposRows.filter(g => g.semestre === 3).length,
      gruposRows.filter(g => g.semestre === 4).length
    );
    const g3Count = Math.max(
      gruposRows.filter(g => g.semestre === 5).length,
      gruposRows.filter(g => g.semestre === 6).length
    );

    const zonaGuardada = configDB?.zona_escolar || (teacher.custom_preferences as any)?.zonaEscolar || (teacher.custom_preferences as any)?.zona || "";
    const escuela = {
      id: teacherId,
      cct: teacher.cct || teacher.school_name || "SIN CCT",
      nombre: teacher.school_name || "Mi Plantel",
      zonaEscolar: zonaGuardada,
      zona: zonaGuardada,
      subsystem: teacher.subsystem || "bge",
      gruposPrimerAno: configDB?.g1 !== undefined ? Number(configDB.g1) : (g1Count > 0 ? g1Count : 1),
      gruposSegundoAno: configDB?.g2 !== undefined ? Number(configDB.g2) : (g2Count > 0 ? g2Count : 1),
      gruposTercerAno: configDB?.g3 !== undefined ? Number(configDB.g3) : (g3Count > 0 ? g3Count : 1),
      mapaCurricularCompletado: configDB?.mapa_curricular_completado !== undefined ? Boolean(configDB.mapa_curricular_completado) : tieneGruposDB,
    };

    // Si tiene grupos guardados pero la bandera estaba en false, actualizarla
    if (tieneGruposDB && !configDB?.mapa_curricular_completado) {
      try {
        await sql()`UPDATE horario_config SET mapa_curricular_completado = TRUE WHERE teacher_id = ${teacherId}::uuid`;
        escuela.mapaCurricularCompletado = true;
      } catch (err) {
        logger.error('[HorariosConfig] Error actualizando mapa_curricular_completado en DB:', { error: err, teacherId });
      }
    }

    // ── Cargas guardadas ───────────────────────────────────────────────
    let cargasRows: any[] = [];
    try {
      cargasRows = await sql()`
        SELECT
          id::text,
          grupo_nombre      AS "grupoId",
          uac_name          AS "uacName",
          personal_id       AS "personalId",
          horas_semanales   AS "horasSemanales",
          requiere_aula_esp AS "requiereAulaEspecial"
        FROM horario_cargas
        WHERE teacher_id = ${teacherId}::uuid
        ORDER BY grupo_nombre ASC, uac_name ASC
      `;
    } catch { /* tabla no existe */ }

    // Normalizar cargas al formato interno del wizard
    const cargas = cargasRows.map((c: any) => ({
      grupoId: c.grupoId,
      asignaturaId: c.uacName,   // usamos uacName como asignaturaId
      uacName: c.uacName,
      personalId: c.personalId,
      horasSemanales: c.horasSemanales,
      requiereAulaEspecial: c.requiereAulaEspecial,
    }));

    // ── Docentes: Personal del plantel registrado por el Director ────────
    let personalRows: any[] = [];
    try {
      personalRows = await sql()`
        SELECT id::text, nombre, apellido_paterno, apellido_materno, cargo, horas_base, email
        FROM escuela_personal
        WHERE director_id = ${teacherId}::uuid AND activo = TRUE
        ORDER BY apellido_paterno ASC, nombre ASC
      `;
    } catch (e) {
      logger.warn("[api/horarios/configuracion GET] Error consultando escuela_personal:", e);
    }

    let docentes = personalRows.map((p: any) => ({
      id: p.id,
      nombre: p.nombre || "",
      apellidoPaterno: p.apellido_paterno || "",
      apellidoMaterno: p.apellido_materno || "",
      cargo: p.cargo || "DOCENTE",
      horasAsignadas: p.horas_base || 20,
      email: p.email || "",
    }));

    // Si aún no tiene personal registrado, incluir al director como primer docente sugerido
    if (docentes.length === 0) {
      const parts = (teacher.name || "Director").trim().split(" ");
      docentes = [{
        id: teacherId,
        nombre: parts[0] || "Director",
        apellidoPaterno: parts.slice(1).join(" ") || "Plantel",
        apellidoMaterno: "",
        cargo: "DIRECTIVO",
        horasAsignadas: 20,
        email: teacher.email || "",
      }];
    }

    const aulas = [{ id: "aula-general", nombre: "Aula General", tipo: "REGULAR" }];

    return NextResponse.json({
      escuela,
      config,
      grupos: gruposRows,
      aulas,
      docentes,
      cargas,
      horario: configDB?.horario_generado || null,
    });
  } catch (error: any) {
    logger.error("[api/horarios/configuracion GET]", error);
    return NextResponse.json({ error: "Error al cargar configuración de horario" }, { status: 500 });
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

    const teacherId = teacher.id;
    const body = await req.json();
    const { config, grupos, cargas, escuela: escuelaBody } = body;

    // ── 1. Guardar / actualizar configuración ──────────────────────────
    const g1 = escuelaBody?.gruposPrimerAno  ?? config?.g1  ?? 1;
    const g2 = escuelaBody?.gruposSegundoAno ?? config?.g2  ?? 1;
    const g3 = escuelaBody?.gruposTercerAno  ?? config?.g3  ?? 1;
    const zonaEscolar = escuelaBody?.zonaEscolar || escuelaBody?.zona || config?.zonaEscolar || "";
    const mapaDone = true; // Si se guarda configuración desde el Wizard, siempre está completado

    try {
      await sql()`
        INSERT INTO horario_config
          (teacher_id, dias_lectivos, horas_por_dia, hora_inicio, periodo_activo, g1, g2, g3, mapa_curricular_completado, zona_escolar)
        VALUES
          (${teacherId}::uuid,
           ${config?.diasLectivos ?? 5},
           ${config?.horasPorDia  ?? 6},
           ${config?.horaInicio   ?? "08:00"},
           ${config?.periodoActivo ?? "A"},
           ${g1}, ${g2}, ${g3},
           ${mapaDone},
           ${zonaEscolar})
        ON CONFLICT (teacher_id) DO UPDATE SET
          dias_lectivos             = EXCLUDED.dias_lectivos,
          horas_por_dia             = EXCLUDED.horas_por_dia,
          hora_inicio               = EXCLUDED.hora_inicio,
          periodo_activo            = EXCLUDED.periodo_activo,
          g1                        = EXCLUDED.g1,
          g2                        = EXCLUDED.g2,
          g3                        = EXCLUDED.g3,
          mapa_curricular_completado= TRUE,
          zona_escolar              = EXCLUDED.zona_escolar,
          updated_at                = NOW()
      `;

      // Sincronizar zona_escolar en preferencias del perfil docente
      try {
        const currentPrefs = (teacher.custom_preferences as any) || {};
        const updatedPrefs = { ...currentPrefs, zonaEscolar, zona: zonaEscolar };
        await sql()`
          UPDATE teachers
          SET custom_preferences = ${JSON.stringify(updatedPrefs)}::jsonb
          WHERE id = ${teacherId}::uuid
        `;
      } catch (err) {
        logger.error('[HorariosConfig] Error sincronizando zona_escolar en perfil de docente:', { error: err, teacherId });
      }
    } catch (e) {
      logger.error("[api/horarios/configuracion POST] Error guardando config:", { error: e });
    }

    // ── 2. Guardar grupos (upsert por teacher_id + nombre) ─────────────
    if (Array.isArray(grupos) && grupos.length > 0) {
      // Purgar grupos obsoletos si la estructura se redujo (ej: de 3 grupos a 2 grupos)
      const nombresActivos = grupos.map((g: any) => (g.nombre || "").trim()).filter(Boolean);
      if (nombresActivos.length > 0) {
        try {
          await sql()`
            DELETE FROM horario_grupos
            WHERE teacher_id = ${teacherId}::uuid
              AND NOT (nombre = ANY(${nombresActivos}))
          `;
        } catch (e) {
          logger.warn("[api/horarios/configuracion POST] Error purgando grupos obsoletos:", e);
        }
      }

      for (const g of grupos) {
        try {
          const ffeOpts = g.ffeOptativas
            ? JSON.stringify(g.ffeOptativas)
            : null;
          const customUacsJson = (Array.isArray(g.customUacs) && g.customUacs.length > 0)
            ? JSON.stringify(g.customUacs)
            : null;
          const horasDia = g.horasPorDia ? Number(g.horasPorDia) : (g.horas_por_dia ? Number(g.horas_por_dia) : null);
          await sql()`
            INSERT INTO horario_grupos
              (teacher_id, nombre, semestre, capacitacion_nombre, ffeo_socioemocional, ffe_optativas, carrera_tecnica_id, version_programa, materia_propedutica_5to, custom_uacs, horas_por_dia)
            VALUES
              (${teacherId}::uuid,
               ${g.nombre},
               ${g.semestre},
               ${g.capacitacionNombre ?? null},
               ${g.ffeoSocioemocional ?? null},
               ${ffeOpts}::jsonb,
               ${g.carreraTecnicaId ?? null},
               ${g.versionPrograma ?? null},
               ${g.materiaPropedutica5to ?? null},
               ${customUacsJson}::jsonb,
               ${horasDia})
            ON CONFLICT (teacher_id, nombre) DO UPDATE SET
              semestre                = EXCLUDED.semestre,
              capacitacion_nombre     = EXCLUDED.capacitacion_nombre,
              ffeo_socioemocional     = EXCLUDED.ffeo_socioemocional,
              ffe_optativas           = EXCLUDED.ffe_optativas,
              carrera_tecnica_id      = EXCLUDED.carrera_tecnica_id,
              version_programa        = EXCLUDED.version_programa,
              materia_propedutica_5to = EXCLUDED.materia_propedutica_5to,
              custom_uacs             = EXCLUDED.custom_uacs,
              horas_por_dia           = EXCLUDED.horas_por_dia
          `;
        } catch (e) {
          logger.error("[api/horarios/configuracion POST] Error guardando grupo:", g.nombre, e);
        }
      }
    }

    // ── 3. Guardar cargas (upsert por teacher_id + grupo_nombre + uac_name) ─
    if (Array.isArray(cargas) && cargas.length > 0) {
      // Limpiar cargas anteriores del teacher y recrear
      try {
        await sql()`
          DELETE FROM horario_cargas WHERE teacher_id = ${teacherId}::uuid
        `;
      } catch { /* ignore */ }

      for (const c of cargas) {
        if (!c.grupoId || !c.uacName || !c.personalId) continue;
        try {
          await sql()`
            INSERT INTO horario_cargas
              (teacher_id, grupo_nombre, uac_name, personal_id, horas_semanales, requiere_aula_esp)
            VALUES
              (${teacherId}::uuid,
               ${c.grupoId},
               ${c.uacName},
               ${c.personalId},
               ${c.horasSemanales ?? 3},
               ${c.requiereAulaEspecial ?? false})
            ON CONFLICT (teacher_id, grupo_nombre, uac_name) DO UPDATE SET
              personal_id       = EXCLUDED.personal_id,
              horas_semanales   = EXCLUDED.horas_semanales,
              requiere_aula_esp = EXCLUDED.requiere_aula_esp
          `;
        } catch (e) {
          logger.error("[api/horarios/configuracion POST] Error guardando carga:", c.uacName, e);
        }
      }
    }

    return NextResponse.json({ success: true, message: "Configuración guardada correctamente" });
  } catch (error: any) {
    logger.error("[api/horarios/configuracion POST]", error);
    return NextResponse.json({ error: "Error al guardar configuración" }, { status: 500 });
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

    try {
      await sql()`DELETE FROM horario_cargas WHERE teacher_id = ${teacherId}::uuid`;
      await sql()`DELETE FROM horario_grupos WHERE teacher_id = ${teacherId}::uuid`;
      await sql()`
        UPDATE horario_config
        SET mapa_curricular_completado = FALSE, updated_at = NOW()
        WHERE teacher_id = ${teacherId}::uuid
      `;
    } catch (e) {
      logger.error("[api/horarios/configuracion DELETE]", e);
    }

    return NextResponse.json({ success: true, message: "Datos del horario limpiados correctamente" });
  } catch (error: any) {
    logger.error("[api/horarios/configuracion DELETE]", error);
    return NextResponse.json({ error: "Error al limpiar datos" }, { status: 500 });
  }
}
