import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { neon } from '@neondatabase/serverless';
import { runPedagogicalAudit } from '@/lib/audit-engine';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const body = await req.json();
    const { planningId, isPremium } = body;

    if (!planningId) {
      return NextResponse.json({ error: 'El parámetro planningId es obligatorio.' }, { status: 400 });
    }

    const teacherId = (session?.user as any)?.id;
    const isUserPremium = isPremium || (session?.user as any)?.role === 'administrador' || (session?.user as any)?.role === 'supervisor';

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
            email: session?.user?.email,
          },
        });
      } catch (notifErr) {
        console.warn('Could not dispatch audit_result notification:', notifErr);
      }
    }

    return NextResponse.json({
      success: true,
      report
    });

  } catch (error: any) {
    console.error('[API /api/audit POST Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Error al ejecutar la auditoría pedagógica.' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'DATABASE_URL no configurada' }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const teacherId = searchParams.get('teacherId');
    const compliance = searchParams.get('compliance');
    const semester = searchParams.get('semester');
    const search = searchParams.get('search') || '';
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    const sql = neon(process.env.DATABASE_URL);

    // Consulta de todas las planeaciones combinadas con su estado de auditoría
    const planningsWithAudit = await sql`
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
        (${teacherId}::text IS NULL OR p.teacher_id = ${teacherId}::uuid)
        AND (${compliance}::text IS NULL OR a.compliance_level = ${compliance} OR (${compliance} = 'pendiente' AND a.id IS NULL))
        AND (${semester}::text IS NULL OR p.semester = ${parseInt(semester || '0', 10)})
        AND (${search} = '' OR p.uac_name ILIKE ${'%' + search + '%'} OR t.name ILIKE ${'%' + search + '%'} OR t.email ILIKE ${'%' + search + '%'})
      ORDER BY 
        CASE WHEN a.id IS NOT NULL THEN 0 ELSE 1 END,
        a.created_at DESC NULLS LAST,
        p.created_at DESC
      LIMIT ${limit}
    `;

    // Estadísticas globales de auditoría
    const statsRows = await sql`
      SELECT 
        (SELECT COUNT(*)::int FROM plannings) as total_plannings,
        COUNT(*)::int as total_audited,
        ROUND(AVG(overall_score)::numeric, 1) as average_score,
        COUNT(CASE WHEN compliance_level = 'excelente' THEN 1 END)::int as excelente_count,
        COUNT(CASE WHEN compliance_level = 'satisfactorio' THEN 1 END)::int as satisfactorio_count,
        COUNT(CASE WHEN compliance_level = 'requiere_mejora' THEN 1 END)::int as requiere_mejora_count,
        COUNT(CASE WHEN compliance_level = 'no_alineado' THEN 1 END)::int as no_alineado_count
      FROM audit_results
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
  } catch (error: any) {
    console.error('[API /api/audit GET Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Error al obtener el listado de auditorías.' },
      { status: 500 }
    );
  }
}
