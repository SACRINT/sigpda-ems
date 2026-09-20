import { sql } from '@/lib/db/client';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
// @ts-expect-error - pdf-parse has no default export in its types but works at runtime
import pdfParse from 'pdf-parse';

import { logger } from '@/lib/logger';
// GET: List documents in library
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = sql();
    
    const docs = await db`
      SELECT id, file_name, file_type, file_size, created_at
      FROM user_library_docs
      WHERE teacher_email = ${session.user.email}
      ORDER BY created_at DESC
    `;

    return NextResponse.json({ docs });
  } catch (error: any) {
    logger.error('GET /api/biblioteca-personal error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Upload new document (PDF or TXT)
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Check size (e.g. 10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size exceeds 10MB limit' }, { status: 400 });
    }

    let extractedText = '';

    if (file.type === 'application/pdf') {
      const buffer = Buffer.from(await file.arrayBuffer());
      const pdfData = await pdfParse(buffer);
      extractedText = pdfData.text;
    } else if (file.type === 'text/plain') {
      extractedText = await file.text();
    } else {
      return NextResponse.json({ error: 'Only PDF and TXT files are supported' }, { status: 400 });
    }

    // Limpiar un poco el texto
    extractedText = extractedText.replace(/\s+/g, ' ').trim();

    const db = sql();
    await db`
      INSERT INTO user_library_docs (teacher_email, file_name, file_type, file_size, extracted_text)
      VALUES (${session.user.email}, ${file.name}, ${file.type}, ${file.size}, ${extractedText})
    `;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    logger.error('POST /api/biblioteca-personal error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: Remove document
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'Document ID required' }, { status: 400 });
    }

    const db = sql();
    await db`
      DELETE FROM user_library_docs
      WHERE id = ${id} AND teacher_email = ${session.user.email}
    `;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    logger.error('DELETE /api/biblioteca-personal error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
