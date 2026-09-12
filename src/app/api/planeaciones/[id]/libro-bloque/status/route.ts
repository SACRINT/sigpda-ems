import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { auth } from '@/lib/auth';
import { getPlanningById, getTeacherByEmail, getGenerationJobById, getLatestGenerationJob } from '@/lib/db';
import { processGenerationJob } from '@/lib/job-worker';

export const runtime = 'nodejs';

// ── GET: Consultar el estado y progreso en tiempo real de un trabajo ────────
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

    let job = null;
    if (jobIdParam) {
      job = await getGenerationJobById(jobIdParam);
    } else if (blockIndexParam !== null) {
      job = await getLatestGenerationJob(id, parseInt(blockIndexParam, 10));
    }

    if (!job) {
      return NextResponse.json(
        {
          found: false,
          status: 'not_found',
          progress: 0,
        },
        { status: 200 }
      );
    }

    // Mecanismo de auto-recuperación: si el job quedó en 'pending' por más de 5 segundos,
    // disparar worker de respaldo inmediatamente vía after()
    if (job.status === 'pending') {
      const createdTime = new Date(job.created_at).getTime();
      if (Date.now() - createdTime > 5000) {
        after(async () => {
          try {
            await processGenerationJob(job.id);
          } catch (err: any) {
            console.warn(`[status] Auto-trigger falló para job ${job.id}:`, err?.message);
          }
        });
      }
    }

    return NextResponse.json({
      found: true,
      jobId: job.id,
      planningId: job.planning_id,
      blockIndex: job.block_index,
      status: job.status,
      progress: job.progress,
      currentPhase: job.current_phase,
      currentStep: job.current_step,
      error: job.error,
      startedAt: job.started_at,
      completedAt: job.completed_at,
      updatedAt: job.updated_at,
    });
  } catch (error: any) {
    console.error('[GET /api/planeaciones/[id]/libro-bloque/status] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Error al consultar estado del trabajo' },
      { status: 500 }
    );
  }
}
