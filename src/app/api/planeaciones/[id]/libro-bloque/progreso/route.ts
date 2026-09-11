import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getWorkbookProgress, getTeacherByEmail, getPlanningById } from '@/lib/db';

export const runtime = 'nodejs';

// ── GET: Consultar el progreso de generación en tiempo real ─────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const teacher = await getTeacherByEmail(session.user.email);
    if (!teacher) {
      return NextResponse.json({ error: 'Docente no encontrado' }, { status: 401 });
    }

    const { id } = await params;
    const planning = await getPlanningById(id);
    if (!planning) {
      return NextResponse.json({ error: 'Planeación no encontrada' }, { status: 404 });
    }
    if (planning.teacher_id !== teacher.id) {
      return NextResponse.json({ error: 'No tienes permiso para acceder a esta planeación' }, { status: 403 });
    }

    const url = new URL(request.url);
    const blockIndexParam = url.searchParams.get('blockIndex');

    if (blockIndexParam === null) {
      return NextResponse.json({ error: 'Parámetro blockIndex es requerido' }, { status: 400 });
    }

    const blockIndex = parseInt(blockIndexParam, 10);
    const progress = await getWorkbookProgress(id, blockIndex);

    return NextResponse.json({ progress });
  } catch (error: any) {
    console.error('[GET /api/planeaciones/[id]/libro-bloque/progreso] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Error al consultar progreso' },
      { status: 500 }
    );
  }
}
