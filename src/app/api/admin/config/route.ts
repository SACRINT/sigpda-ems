import { sql } from '@/lib/db/client';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/admin-auth';

function getDb() { return sql(); }

// GET /api/admin/config — returns all platform_config entries
export async function GET() {
  try {
    const adminEmail = await requireAdmin();
    const sql = getDb();
    const rows = await sql`SELECT key, value, updated_at FROM platform_config ORDER BY key`;
    const config: Record<string, string> = {};
    for (const row of rows) config[row.key] = row.value;
    return NextResponse.json({ config });
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return adminUnauthorized();
    if (e.message === 'FORBIDDEN') return adminForbidden();
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PUT /api/admin/config — updates one or more config entries
export async function PUT(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json() as Record<string, string>;
    const sql = getDb();

    for (const [key, value] of Object.entries(body)) {
      await sql`
        INSERT INTO platform_config (key, value, updated_at)
        VALUES (${key}, ${value}, NOW())
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
      `;
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return adminUnauthorized();
    if (e.message === 'FORBIDDEN') return adminForbidden();
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
