import { sql } from '@/lib/db/client';
import { NextResponse } from 'next/server';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/admin-auth';

function getDb() { return sql(); }

export async function GET() {
  try {
    await requireAdmin();
    const sql = getDb();

    const [teachers, plannings, paec, pmc, activity] = await Promise.all([
      sql`SELECT COUNT(*) as count FROM teachers`,
      sql`SELECT COUNT(*) as count FROM plannings`,
      sql`SELECT COUNT(*) as count FROM paec_projects`,
      sql`SELECT COUNT(*) as count FROM pmc_projects`,
      sql`
        SELECT DATE(created_at) as date, COUNT(*) as count, action
        FROM activity_log
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at), action
        ORDER BY date DESC
      `,
    ]);

    // Provider usage stats
    const providerStats = await sql`
      SELECT provider_used, model_used, COUNT(*) as count,
             SUM(CASE WHEN success THEN 1 ELSE 0 END) as successes,
             SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) as failures
      FROM activity_log
      WHERE provider_used IS NOT NULL
      GROUP BY provider_used, model_used
      ORDER BY count DESC
    `;

    // Top users
    const topUsers = await sql`
      SELECT teacher_email, COUNT(*) as total_actions
      FROM activity_log
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY teacher_email
      ORDER BY total_actions DESC
      LIMIT 10
    `;

    // Today's activity
    const todayActivity = await sql`
      SELECT COUNT(*) as count
      FROM activity_log
      WHERE DATE(created_at) = CURRENT_DATE
    `;

    return NextResponse.json({
      totals: {
        teachers: Number(teachers[0]?.count || 0),
        plannings: Number(plannings[0]?.count || 0),
        paec: Number(paec[0]?.count || 0),
        pmc: Number(pmc[0]?.count || 0),
        todayActivity: Number(todayActivity[0]?.count || 0),
      },
      activityByDay: activity,
      providerStats,
      topUsers,
    });
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return adminUnauthorized();
    if (e.message === 'FORBIDDEN') return adminForbidden();
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
