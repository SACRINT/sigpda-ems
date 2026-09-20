import { sql } from '@/lib/db/client';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/admin-auth';

function getDb() { return sql(); }

// GET /api/admin/activity — paginated activity log
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const page   = Math.max(1, Number(searchParams.get('page') || 1));
    const limit  = Math.min(100, Number(searchParams.get('limit') || 50));
    const offset = (page - 1) * limit;
    const email  = searchParams.get('email') || '';
    const action = searchParams.get('action') || '';

    const sql = getDb();

    const [rows, total] = await Promise.all([
      sql`
        SELECT id, teacher_email, action, entity_type, entity_id,
               provider_used, model_used, tokens_approx, success, error_msg, created_at
        FROM activity_log
        WHERE (${email} = '' OR teacher_email ILIKE ${'%' + email + '%'})
          AND (${action} = '' OR action = ${action})
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `,
      sql`
        SELECT COUNT(*) as count FROM activity_log
        WHERE (${email} = '' OR teacher_email ILIKE ${'%' + email + '%'})
          AND (${action} = '' OR action = ${action})
      `,
    ]);

    return NextResponse.json({
      activity: rows,
      total: Number(total[0]?.count || 0),
      page,
      limit,
    });
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return adminUnauthorized();
    if (e.message === 'FORBIDDEN') return adminForbidden();
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
