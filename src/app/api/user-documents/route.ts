import { sql } from '@/lib/db/client';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

function getDb() { return sql(); }

async function getEmail() {
  const session = await auth();
  if (!session?.user?.email) throw new Error('UNAUTHORIZED');
  return session.user.email;
}

// GET /api/user-documents — list all documents for the current user
export async function GET(req: NextRequest) {
  try {
    const email = await getEmail();
    const { searchParams } = new URL(req.url);
    const docType = searchParams.get('type') || '';
    const schoolId = searchParams.get('schoolId') || '';

    const sql = getDb();
    const rows = await sql`
      SELECT ud.id, ud.doc_type, ud.label, ud.uac_name, ud.semester,
             ud.file_name, ud.used_count, ud.last_used_at, ud.created_at, ud.updated_at,
             ts.school_name, ts.municipality
      FROM user_documents ud
      LEFT JOIN teacher_schools ts ON ts.id = ud.school_id
      WHERE ud.teacher_email = ${email}
        AND (${docType}   = '' OR ud.doc_type  = ${docType})
        AND (${schoolId}  = '' OR ud.school_id::text = ${schoolId})
      ORDER BY ud.updated_at DESC
    `;
    return NextResponse.json({ documents: rows });
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST /api/user-documents — save a new document (called after PDF extraction)
export async function POST(req: NextRequest) {
  try {
    const email = await getEmail();
    const { docType, label, uacName, semester, extractedJson, fileName, fileHash, schoolId } = await req.json();

    if (!docType || !label || !extractedJson) {
      return NextResponse.json({ error: 'docType, label y extractedJson son requeridos' }, { status: 400 });
    }

    const sql = getDb();

    // Check if document already exists for this UAC+semester (upsert)
    if (uacName && semester) {
      const existing = await sql`
        SELECT id FROM user_documents
        WHERE teacher_email = ${email} AND uac_name = ${uacName} AND semester = ${semester}
        LIMIT 1
      `;
      if (existing.length > 0) {
        const updated = await sql`
          UPDATE user_documents
          SET label = ${label}, extracted_json = ${JSON.stringify(extractedJson)},
              file_name = ${fileName || null}, file_hash = ${fileHash || null},
              updated_at = NOW()
          WHERE id = ${existing[0].id}
          RETURNING id, doc_type, label, uac_name, semester, file_name, used_count, created_at, updated_at
        `;
        return NextResponse.json({ document: updated[0], updated: true });
      }
    }

    const inserted = await sql`
      INSERT INTO user_documents
        (teacher_email, school_id, doc_type, label, uac_name, semester, extracted_json, file_name, file_hash)
      VALUES
        (${email}, ${schoolId || null}, ${docType}, ${label}, ${uacName || null},
         ${semester || null}, ${JSON.stringify(extractedJson)}, ${fileName || null}, ${fileHash || null})
      RETURNING id, doc_type, label, uac_name, semester, file_name, used_count, created_at, updated_at
    `;
    return NextResponse.json({ document: inserted[0] }, { status: 201 });
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE /api/user-documents — delete a document (must belong to the current user)
export async function DELETE(req: NextRequest) {
  try {
    const email = await getEmail();
    const { id } = await req.json();
    const sql = getDb();

    const result = await sql`
      DELETE FROM user_documents WHERE id = ${id} AND teacher_email = ${email}
      RETURNING id
    `;
    if (result.length === 0) {
      return NextResponse.json({ error: 'Documento no encontrado o no tienes permiso para eliminarlo' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
