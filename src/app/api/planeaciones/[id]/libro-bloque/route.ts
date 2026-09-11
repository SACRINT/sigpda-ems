import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getPlanningById, getBlockWorkbook, getTeacherByEmail } from '@/lib/db';
import { generateBlockWorkTextbook } from '@/lib/guide-engine/block-guide-orchestrator';

export const runtime = 'nodejs';
export const maxDuration = 90;

// ── GET: Obtener el Libro de Trabajo generado para un bloque ────────────────
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
    const workbook = await getBlockWorkbook(id, blockIndex);

    if (!workbook) {
      return NextResponse.json({ error: 'Libro de trabajo no encontrado para este bloque' }, { status: 404 });
    }

    return NextResponse.json({
      workbook,
      wordCount: workbook?.totalWords || 0,
      totalWords: workbook?.totalWords || 0,
    });
  } catch (error: any) {
    console.error('[GET /api/planeaciones/[id]/libro-bloque] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Error al obtener libro de trabajo' },
      { status: 500 }
    );
  }
}

// ── POST: Generar el Libro de Trabajo para un bloque específico ─────────────
export async function POST(
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
    const body = await request.json();
    const { blockIndex, customHours } = body;

    if (blockIndex === undefined || blockIndex === null) {
      return NextResponse.json({ error: 'blockIndex es requerido' }, { status: 400 });
    }

    const planning = await getPlanningById(id);
    if (!planning) {
      return NextResponse.json({ error: 'Planeación no encontrada' }, { status: 404 });
    }
    if (planning.teacher_id !== teacher.id) {
      return NextResponse.json({ error: 'No tienes permiso para acceder a esta planeación' }, { status: 403 });
    }

    // Iniciar orquestador editorial completo
    const workbook = await generateBlockWorkTextbook(id, Number(blockIndex), {
      customHours: customHours ? Number(customHours) : undefined,
    });

    return NextResponse.json({
      success: true,
      message: 'Libro de Aprendizaje Activo generado exitosamente',
      workbook,
      wordCount: workbook.totalWords,
      totalWords: workbook.totalWords,
    });
  } catch (error: any) {
    console.error('[POST /api/planeaciones/[id]/libro-bloque] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Error al generar el libro de trabajo' },
      { status: 500 }
    );
  }
}
