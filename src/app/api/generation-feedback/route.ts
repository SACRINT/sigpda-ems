import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail, sql } from '@/lib/db';

export const runtime = 'nodejs';

// ─── POST /api/generation-feedback ───────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const teacher = await getTeacherByEmail(session.user.email);
    if (!teacher) {
      return NextResponse.json({ error: 'Docente no encontrado' }, { status: 404 });
    }

    const body = await request.json() as {
      entity_type: string;
      entity_id: string;
      rating: number;
      comment?: string;
      dimension?: string;
    };

    const { entity_type, entity_id, rating, comment, dimension } = body;

    if (!entity_type || !entity_id || !rating) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'La calificación debe ser entre 1 y 5' }, { status: 400 });
    }

    const validTypes = ['planning', 'paec', 'pmc', 'pips'];
    if (!validTypes.includes(entity_type)) {
      return NextResponse.json({ error: 'Tipo de entidad inválido' }, { status: 400 });
    }

    const db = sql();
    // Upsert: si ya existe un feedback del mismo usuario/entidad, actualiza
    const [row] = await db`
      INSERT INTO generation_feedback
        (teacher_id, entity_type, entity_id, rating, comment, dimension)
      VALUES
        (${teacher.id}::uuid, ${entity_type}, ${entity_id}, ${rating},
         ${comment ?? null}, ${dimension ?? 'general'})
      ON CONFLICT DO NOTHING
      RETURNING id
    `;

    return NextResponse.json({ success: true, id: row?.id });
  } catch (error) {
    console.error('Feedback POST error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// ─── GET /api/generation-feedback?entity_type=X&entity_id=Y ─────────────────
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const teacher = await getTeacherByEmail(session.user.email);
    if (!teacher) {
      return NextResponse.json({ error: 'Docente no encontrado' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const entity_type = searchParams.get('entity_type');
    const entity_id = searchParams.get('entity_id');

    if (!entity_type || !entity_id) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
    }

    const db = sql();
    const rows = await db`
      SELECT rating, comment, dimension, created_at
      FROM generation_feedback
      WHERE teacher_id = ${teacher.id}::uuid
        AND entity_type = ${entity_type}
        AND entity_id = ${entity_id}
      ORDER BY created_at DESC
      LIMIT 1
    `;

    return NextResponse.json({ feedback: rows[0] ?? null });
  } catch (error) {
    console.error('Feedback GET error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
