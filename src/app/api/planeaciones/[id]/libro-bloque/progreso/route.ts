import { NextRequest, NextResponse } from 'next/server';
import { getWorkbookProgress, getPlanningById } from '@/lib/db';
import { requireActiveTeacher } from '@/lib/api-auth';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

// ── GET: Consultar el progreso de generación en tiempo real ─────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireActiveTeacher();
    if (authResult.error) return authResult.error;
    const { teacher } = authResult;

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
    logger.error('[GET /api/planeaciones/[id]/libro-bloque/progreso] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Error al consultar progreso' },
      { status: 500 }
    );
  }
}
