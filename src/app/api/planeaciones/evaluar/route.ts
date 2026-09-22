import { sql } from '@/lib/db/client';
import { auth } from '@/lib/auth';
import { isAdmin } from '@/lib/admin-unified';
import { NextResponse } from 'next/server';
import { evaluarPlaneacion, TipoEvaluacion } from '@/lib/planeaciones-evaluator';
import { logger } from '@/lib/logger';

export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const { planningId, tipoEvaluacion, textoPlanificacion, textoPaecPec, forceReeval } = body;

    const userEmail = session.user.email;
    const isUserAdmin = await isAdmin(userEmail);

    const db = sql();

    const currentTeacherRows = await db`
      SELECT t.id, t.name, t.role, s.status as sub_status
      FROM teachers t
      LEFT JOIN subscriptions s ON s.teacher_id = t.id AND s.status IN ('active', 'trialing')
      WHERE t.email = ${userEmail}
      LIMIT 1
    `;

    const currentTeacher = currentTeacherRows[0];
    const isPrivileged = isUserAdmin || currentTeacher?.role === 'administrador' || currentTeacher?.role === 'supervisor';

    // Comprobación de suscripción del lado del servidor (sin confiar en flags del cliente)
    if (!isPrivileged && !currentTeacher?.sub_status) {
      return NextResponse.json(
        { error: 'Se requiere una suscripción activa para evaluar planeaciones.' },
        { status: 403 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let planData: any = null;
    let docenteNombre = currentTeacher?.name || session.user.name || 'Docente';
    let asignatura = 'UAC / Asignatura';
    let semestre = 1;
    let textoEvaluado = textoPlanificacion || '';

    // Si se pasa planningId, cargar datos desde la base de datos y verificar propiedad
    if (planningId) {
      const rows = await db`
        SELECT p.id, p.teacher_id, p.uac_name, p.semester, p.component, p.content_json, p.paec_context, p.evaluation_json,
               t.name as teacher_name, t.email as teacher_email
        FROM plannings p
        JOIN teachers t ON t.id = p.teacher_id
        WHERE p.id = ${planningId}::uuid
        LIMIT 1
      `;

      if (rows.length === 0) {
        return NextResponse.json({ error: 'Planeación no encontrada' }, { status: 404 });
      }

      planData = rows[0];

      if (!isPrivileged && planData.teacher_email !== userEmail) {
        return NextResponse.json({ error: 'Acceso denegado a esta planeación' }, { status: 403 });
      }

      asignatura = planData.uac_name;
      semestre = planData.semester;
      docenteNombre = planData.teacher_name || docenteNombre;

      // Si ya cuenta con evaluación guardada y no se solicita re-evaluación forzada, retornar caché (0 tokens)
      if (!forceReeval && planData.evaluation_json) {
        return NextResponse.json({
          success: true,
          resultado: planData.evaluation_json,
          cached: true,
        });
      }

      if (!textoEvaluado && planData.content_json) {
        const { getSafeEvaluationContext } = await import('@/lib/planning-integrity-system');
        const safeContext = getSafeEvaluationContext(planData);
        textoEvaluado = safeContext.formattedText;

        // Si el contenido fue enriquecido con taxonomía explícita de saberes, persistirlo en la BD
        if (safeContext.enrichedContent?.sectionIV?.activities?.[0]?.saberes && (!planData.content_json?.sectionIV?.activities?.[0]?.saberes)) {
          try {
            await db`
              UPDATE plannings
              SET content_json = ${JSON.stringify(safeContext.enrichedContent)}::jsonb,
                  updated_at = NOW()
              WHERE id = ${planningId}::uuid
            `;
          } catch (updateErr) {
            logger.warn('Could not auto-persist enriched saberes:', { error: updateErr });
          }
        }
      }
    }

    if (!textoEvaluado || textoEvaluado.length < 50) {
      return NextResponse.json(
        { error: 'El contenido de la planeación es demasiado corto o inválido para evaluar.' },
        { status: 400 }
      );
    }

    // Determinar tipo de evaluación automáticamente si no viene especificado
    let tipo: TipoEvaluacion = tipoEvaluacion;
    if (!tipo) {
      if (planData?.component === 'laboral') {
        tipo = 'LABORAL';
      } else if (semestre >= 5) {
        tipo = 'FUNDAMENTAL_5_6';
      } else {
        tipo = 'FUNDAMENTAL_1_4';
      }
    }

    const resultado = await evaluarPlaneacion({
      tipoEvaluacion: tipo,
      asignatura,
      semestre,
      docenteNombre,
      textoPlanificacion: textoEvaluado,
      textoPaecPec: textoPaecPec || planData?.paec_context || '',
      teacherId: currentTeacher?.id,
      isPremium: isPrivileged,
    });

    // Persistir resultado en la base de datos para que no se pierda al salir
    if (planningId) {
      try {
        await db`
          UPDATE plannings
          SET evaluation_json = ${JSON.stringify(resultado)}::jsonb,
              updated_at = NOW()
          WHERE id = ${planningId}::uuid
        `;
      } catch (dbErr) {
        logger.error('Error persistiendo evaluation_json en Neon DB:', dbErr);
      }
    }

    return NextResponse.json({ success: true, resultado, cached: false });
  } catch (e: unknown) {
    logger.error('API /api/planeaciones/evaluar error:', e);
    const message = e instanceof Error ? e.message : 'Error al evaluar planeación';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
