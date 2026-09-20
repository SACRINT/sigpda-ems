import { sql } from '@/lib/db/client';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/admin-auth';

function getDb() { return sql(); }

// GET /api/admin/prompts — list all prompts
export async function GET() {
  try {
    await requireAdmin();
    const sql = getDb();
    const rows = await sql`SELECT id, label, content, is_active, updated_at, updated_by FROM ai_prompts ORDER BY id`;
    return NextResponse.json({ prompts: rows });
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return adminUnauthorized();
    if (e.message === 'FORBIDDEN') return adminForbidden();
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PUT /api/admin/prompts — update a prompt's content
export async function PUT(req: NextRequest) {
  try {
    const adminEmail = await requireAdmin();
    const { id, content, isActive } = await req.json();
    if (!id || content === undefined) {
      return NextResponse.json({ error: 'id y content son requeridos' }, { status: 400 });
    }

    const sql = getDb();
    await sql`
      UPDATE ai_prompts
      SET content = ${content},
          is_active = COALESCE(${isActive ?? null}, is_active),
          updated_at = NOW(),
          updated_by = ${adminEmail}
      WHERE id = ${id}
    `;
    return NextResponse.json({ success: true });
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return adminUnauthorized();
    if (e.message === 'FORBIDDEN') return adminForbidden();
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST /api/admin/prompts — upsert a prompt (used by migration to seed initial prompts)
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const { id, label, content } = await req.json();
    const sql = getDb();
    await sql`
      INSERT INTO ai_prompts (id, label, content)
      VALUES (${id}, ${label}, ${content})
      ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, content = EXCLUDED.content
    `;
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return adminUnauthorized();
    if (e.message === 'FORBIDDEN') return adminForbidden();
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
