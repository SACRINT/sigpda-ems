import { sql } from '@/lib/db/client';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isAdmin } from '@/lib/admin-unified';
import { runPedagogicalAudit } from '@/lib/audit-engine';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const { planningId } = body;

    if (!planningId) {
      return NextResponse.json({ error: 'El parámetro planningId es obligatorio.' }, { status: 400 });
    }

    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'DATABASE_URL no configurada' }, { status: 500 });
    }

    const db = sql();
    const userEmail = session.user.email;
    const isUserAdmin = await isAdmin(userEmail);

    const currentTeacherRows = await db`
      SELECT id, role FROM teachers WHERE email = ${userEmail} LIMIT 1
    `;
    const currentTeacher = currentTeacherRows[0];
    const teacherId = currentTeacher?.id;

    // Verificar existencia y pertenencia de la planeación
    const planningRows = await db`
      SELECT id, teacher_id FROM plannings WHERE id = ${planningId}::uuid LIMIT 1
    `;
    if (!planningRows || planningRows.length === 0) {
      return NextResponse.json({ error: 'Planeación no encontrada.' }, { status: 404 });
    }

    const planning = planningRows[0];
    const isPrivileged = isUserAdmin || currentTeacher?.role === 'administrador' || currentTeacher?.role === 'supervisor';

    if (!isPrivileged && planning.teacher_id !== teacherId) {
      return NextResponse.json({ error: 'No tienes permiso para auditar esta planeación.' }, { status: 403 });
    }

    // Comprobación de nivel premium en servidor: suscripción activa o rol privilegiado
    let isUserPremium = isPrivileged;
    if (!isUserPremium && teacherId) {
      const subRows = await db`
        SELECT status FROM subscriptions
        WHERE teacher_id = ${teacherId} AND status IN ('active', 'trialing')
        LIMIT 1
      `;
      isUserPremium = subRows.length > 0;
    }

    const report = await runPedagogicalAudit(planningId, {
      teacherId,
      isPremium: isUserPremium
    });

    // Send Realtime / In-App Notification (Phase 8A.1 & 8D)
    if (teacherId && report) {
      try {
        const { sendNotification } = await import('@/lib/notifications');
        const score = report.overall_score ?? 0;
        const compliance = report.compliance_level ?? 'Evaluado';

        await sendNotification({
          userId: teacherId,
          type: 'audit_result',
          title: `Auditoría Pedagógica: ${score}/100`,
          message: `Tu planeación obtuvo un nivel de cumplimiento: ${compliance}.`,
          link: `/planeacion/${planningId}`,
          severity: score >= 80 ? 'success' : score >= 60 ? 'warning' : 'error',
          channels: ['in_app'],
          metadata: {
            planningId,
            score,
            complianceLevel: compliance,
            email: session.user.email,
          },
        });
      } catch (notifErr) {
        logger.warn('Could not dispatch audit_result notification:', notifErr);
      }
    }

    return NextResponse.json({
      success: true,
      report
    });

  } catch (error: unknown) {
    logger.error('[API /api/audit POST Error]:', error);
    const message = error instanceof Error ? error.message : 'Error al ejecutar la auditoría pedagógica.';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'DATABASE_URL no configurada' }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const filterTeacherId = searchParams.get('teacherId');
    const compliance = searchParams.get('compliance');
    const semester = searchParams.get('semester');
    const search = searchParams.get('search') || '';
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    const db = sql();
    const userEmail = session.user.email;
    const isUserAdmin = await isAdmin(userEmail);
    const currentTeacherRows = await db`
      SELECT id, role FROM teachers WHERE email = ${userEmail} LIMIT 1
    `;
    const currentTeacher = currentTeacherRows[0];
    const isPrivileged = isUserAdmin || currentTeacher?.role === 'administrador' || currentTeacher?.role === 'supervisor';

    // Si no es admin ni supervisor, únicamente puede consultar sus propias planeaciones/auditorías
    const effectiveTeacherId = isPrivileged ? (filterTeacherId || null) : (currentTeacher?.id || '00000000-0000-0000-0000-000000000000');

    // Consulta de planeaciones combinadas con su estado de auditoría
    const planningsWithAudit = await db`
      SELECT 
        p.id as planning_id,
        p.teacher_id,
        p.uac_name,
        p.semester,
        p.component,
        p.curriculum_name,
        p.status as planning_status,
        p.created_at as planning_created_at,
        t.name as teacher_name,
        t.email as teacher_email,
        t.school_name,
        a.id as audit_id,
        a.overall_score,
        a.compliance_level,
        a.dimension_scores,
        a.findings,
        a.recommendations,
        a.audited_by,
        a.created_at as audited_at
      FROM plannings p
      LEFT JOIN teachers t ON p.teacher_id = t.id
      LEFT JOIN audit_results a ON a.planning_id = p.id
      WHERE 
        (${effectiveTeacherId}::text IS NULL OR p.teacher_id = ${effectiveTeacherId}::uuid)
        AND (${compliance}::text IS NULL OR a.compliance_level = ${compliance} OR (${compliance} = 'pendiente' AND a.id IS NULL))
        AND (${semester}::text IS NULL OR p.semester = ${parseInt(semester || '0', 10)})
        AND (${search} = '' OR p.uac_name ILIKE ${'%' + search + '%'} OR t.name ILIKE ${'%' + search + '%'} OR t.email ILIKE ${'%' + search + '%'})
      ORDER BY 
        CASE WHEN a.id IS NOT NULL THEN 0 ELSE 1 END,
        a.created_at DESC NULLS LAST,
        p.created_at DESC
      LIMIT ${limit}
    `;

    // Estadísticas
    const statsRows = isPrivileged
      ? await db`
          SELECT 
            (SELECT COUNT(*)::int FROM plannings) as total_plannings,
            COUNT(*)::int as total_audited,
            ROUND(AVG(overall_score)::numeric, 1) as average_score,
            COUNT(CASE WHEN compliance_level = 'excelente' THEN 1 END)::int as excelente_count,
            COUNT(CASE WHEN compliance_level = 'satisfactorio' THEN 1 END)::int as satisfactorio_count,
            COUNT(CASE WHEN compliance_level = 'requiere_mejora' THEN 1 END)::int as requiere_mejora_count,
            COUNT(CASE WHEN compliance_level = 'no_alineado' THEN 1 END)::int as no_alineado_count
          FROM audit_results
        `
      : await db`
          SELECT 
            (SELECT COUNT(*)::int FROM plannings WHERE teacher_id = ${effectiveTeacherId}::uuid) as total_plannings,
            COUNT(*)::int as total_audited,
            ROUND(AVG(overall_score)::numeric, 1) as average_score,
            COUNT(CASE WHEN compliance_level = 'excelente' THEN 1 END)::int as excelente_count,
            COUNT(CASE WHEN compliance_level = 'satisfactorio' THEN 1 END)::int as satisfactorio_count,
            COUNT(CASE WHEN compliance_level = 'requiere_mejora' THEN 1 END)::int as requiere_mejora_count,
            COUNT(CASE WHEN compliance_level = 'no_alineado' THEN 1 END)::int as no_alineado_count
          FROM audit_results
          WHERE teacher_id = ${effectiveTeacherId}::uuid
        `;

    return NextResponse.json({
      success: true,
      plannings: planningsWithAudit,
      stats: statsRows[0] || {
        total_plannings: 0,
        total_audited: 0,
        average_score: 0,
        excelente_count: 0,
        satisfactorio_count: 0,
        requiere_mejora_count: 0,
        no_alineado_count: 0
      }
    });
  } catch (error: unknown) {
    logger.error('[API /api/audit GET Error]:', error);
    const message = error instanceof Error ? error.message : 'Error al obtener el listado de auditorías.';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
