import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getPlanningById, getTeacherByEmail, getGenerationJobById, getBlockWorkbook, getLatestGenerationJob } from '@/lib/db';

export const runtime = 'nodejs';

// ── GET: Obtener el resultado final del libro generado por el worker ────────
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
    const jobIdParam = url.searchParams.get('jobId');
    const blockIndexParam = url.searchParams.get('blockIndex');

    let workbook = null;

    if (jobIdParam) {
      const job = await getGenerationJobById(jobIdParam);
      if (job && job.status === 'completed' && job.result) {
        workbook = job.result;
      }
    }

    // Fallback: Si no viene jobId o el job no tenía result en memoria, consultar de plannings.workbooks_json
    if (!workbook && blockIndexParam !== null) {
      const blockIndex = parseInt(blockIndexParam, 10);
      workbook = await getBlockWorkbook(id, blockIndex);
      if (!workbook) {
        const latestJob = await getLatestGenerationJob(id, blockIndex);
        if (latestJob && latestJob.status === 'completed' && latestJob.result) {
          workbook = latestJob.result;
        }
      }
    }

    if (!workbook) {
      return NextResponse.json(
        {
          found: false,
          workbook: null,
          message: 'Libro de trabajo no disponible o aún en proceso',
        },
        { status: 200 }
      );
    }

    return NextResponse.json({
      found: true,
      workbook,
      wordCount: workbook.totalWords || 0,
      totalWords: workbook.totalWords || 0,
    });
  } catch (error: any) {
    console.error('[GET /api/planeaciones/[id]/libro-bloque/result] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Error al obtener resultado del libro' },
      { status: 500 }
    );
  }
}
