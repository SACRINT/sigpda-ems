import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getPlanningById, getBlockWorkbook, getTeacherByEmail } from '@/lib/db';

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
    let workbook = await getBlockWorkbook(id, blockIndex);

    if (!workbook) {
      const { getLatestGenerationJob } = await import('@/lib/db');
      const latestJob = await getLatestGenerationJob(id, blockIndex);
      if (latestJob && latestJob.status === 'completed' && latestJob.result) {
        workbook = latestJob.result;
      }
    }

    if (!workbook) {
      return NextResponse.json({
        workbook: null,
        found: false,
        wordCount: 0,
        totalWords: 0,
      }, { status: 200 });
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

// ── POST: Iniciar la generación asíncrona mediante Job Queue ─────────────────
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
    const body = await request.json().catch(() => ({}));
    const { blockIndex } = body;

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

    const { createGenerationJob } = await import('@/lib/db');
    const { processGenerationJob } = await import('@/lib/job-worker');
    const { after } = await import('next/server');

    const job = await createGenerationJob(id, teacher.id, Number(blockIndex));

    if (job.status === 'pending') {
      after(async () => {
        try {
          await processGenerationJob(job.id);
        } catch (err: any) {
          console.error(`[POST /libro-bloque] Worker background error for job ${job.id}:`, err?.message);
        }
      });
    }

    return NextResponse.json({
      success: true,
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      message: 'Trabajo de generación iniciado en segundo plano',
    }, { status: 202 });
  } catch (error: any) {
    console.error('[POST /api/planeaciones/[id]/libro-bloque] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Error al iniciar la generación del libro de trabajo' },
      { status: 500 }
    );
  }
}

