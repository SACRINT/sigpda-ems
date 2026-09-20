import { sql } from '@/lib/db/client';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/admin-auth';

function getDb() { return sql(); }

// GET /api/admin/documents — list all user documents (admin view)
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const email   = searchParams.get('email') || '';
    const docType = searchParams.get('type')  || '';

    const sql = getDb();
    const rows = await sql`
      SELECT id, teacher_email, doc_type, label, uac_name, semester,
             file_name, file_hash, used_count, last_used_at, created_at, updated_at
      FROM user_documents
      WHERE (${email} = '' OR teacher_email ILIKE ${'%' + email + '%'})
        AND (${docType} = '' OR doc_type = ${docType})
      ORDER BY created_at DESC
      LIMIT 200
    `;
    return NextResponse.json({ documents: rows });
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return adminUnauthorized();
    if (e.message === 'FORBIDDEN') return adminForbidden();
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE /api/admin/documents — admin can delete any document by id
export async function DELETE(req: NextRequest) {
  try {
    await requireAdmin();
    const { id } = await req.json();
    const sql = getDb();
    await sql`DELETE FROM user_documents WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return adminUnauthorized();
    if (e.message === 'FORBIDDEN') return adminForbidden();
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
