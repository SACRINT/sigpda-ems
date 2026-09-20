import { sql } from '@/lib/db/client';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

function getDb() { return sql(); }

async function getEmail() {
  const session = await auth();
  if (!session?.user?.email) throw new Error('UNAUTHORIZED');
  return session.user.email;
}

// GET /api/teacher-schools
export async function GET() {
  try {
    const email = await getEmail();
    const sql = getDb();
    const rows = await sql`
      SELECT id, school_name, school_cct, municipality, subsystem, is_primary, created_at
      FROM teacher_schools WHERE teacher_email = ${email}
      ORDER BY is_primary DESC, school_name ASC
    `;
    return NextResponse.json({ schools: rows });
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST /api/teacher-schools — add a school
export async function POST(req: NextRequest) {
  try {
    const email = await getEmail();
    const { schoolName, schoolCct, municipality, subsystem, isPrimary } = await req.json();
    if (!schoolName) return NextResponse.json({ error: 'schoolName es requerido' }, { status: 400 });

    const sql = getDb();

    // If marking as primary, unset others first
    if (isPrimary) {
      await sql`UPDATE teacher_schools SET is_primary = false WHERE teacher_email = ${email}`;
    }

    const inserted = await sql`
      INSERT INTO teacher_schools (teacher_email, school_name, school_cct, municipality, subsystem, is_primary)
      VALUES (${email}, ${schoolName}, ${schoolCct || null}, ${municipality || null}, ${subsystem || 'BGE'}, ${isPrimary || false})
      ON CONFLICT (teacher_email, school_name) DO UPDATE SET
        school_cct = EXCLUDED.school_cct, municipality = EXCLUDED.municipality,
        subsystem = EXCLUDED.subsystem, is_primary = EXCLUDED.is_primary
      RETURNING id, school_name, school_cct, municipality, subsystem, is_primary, created_at
    `;
    return NextResponse.json({ school: inserted[0] }, { status: 201 });
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PUT /api/teacher-schools — update a school
export async function PUT(req: NextRequest) {
  try {
    const email = await getEmail();
    const { id, schoolName, schoolCct, municipality, subsystem, isPrimary } = await req.json();
    const sql = getDb();

    if (isPrimary) {
      await sql`UPDATE teacher_schools SET is_primary = false WHERE teacher_email = ${email}`;
    }

    await sql`
      UPDATE teacher_schools
      SET school_name = COALESCE(${schoolName || null}, school_name),
          school_cct  = COALESCE(${schoolCct  || null}, school_cct),
          municipality = COALESCE(${municipality || null}, municipality),
          subsystem   = COALESCE(${subsystem   || null}, subsystem),
          is_primary  = COALESCE(${isPrimary ?? null}, is_primary)
      WHERE id = ${id} AND teacher_email = ${email}
    `;
    return NextResponse.json({ success: true });
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE /api/teacher-schools
export async function DELETE(req: NextRequest) {
  try {
    const email = await getEmail();
    const { id } = await req.json();
    const sql = getDb();
    await sql`DELETE FROM teacher_schools WHERE id = ${id} AND teacher_email = ${email}`;
    return NextResponse.json({ success: true });
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
