import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { auth } from '@/lib/auth';
import { getPlanningById, getTeacherByEmail, getGenerationJobById, getLatestGenerationJob, claimGenerationJob } from '@/lib/db';
import { processGenerationJob } from '@/lib/job-worker';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
// La recuperación de jobs se ejecuta en `after()` y necesita el mismo margen
// que el pipeline editorial completo.
export const maxDuration = 300;

// Un job `running` sin heartbeat por más de 5 min está muerto con certeza:
// ninguna invocación puede vivir más de 300 s (maxDuration).
const STALE_RUNNING_SECONDS = 300;

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

    // Mecanismo de auto-recuperación:
    // 1. Si el job quedó en 'pending' por más de 5 s, disparar worker de respaldo.
    // 2. Si está 'running' pero sin heartbeat por más de 5 min, la invocación
    //    anterior murió (p. ej. timeout de Vercel): reanudar el trabajo.
    // El claim atómico garantiza un solo worker aunque haya varios polls.
    const isStalePending =
      job.status === 'pending' && Date.now() - new Date(job.created_at).getTime() > 5000;
    const isStaleRunning =
      job.status === 'running' &&
      Date.now() - new Date(job.updated_at).getTime() > STALE_RUNNING_SECONDS * 1000;

    if (isStalePending || isStaleRunning) {
      const claimed = await claimGenerationJob(job.id, isStalePending ? 0 : STALE_RUNNING_SECONDS);
      if (claimed) {
        after(async () => {
          try {
            await processGenerationJob(job.id);
          } catch (err: unknown) {
            logger.warn(`[status] Auto-trigger falló para job ${job.id}:`, {
              error: err instanceof Error ? err.message : String(err),
            });
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
  } catch (error: unknown) {
    logger.error('[GET /api/planeaciones/[id]/libro-bloque/status] Error:', error);
    const message = error instanceof Error ? error.message : 'Error al consultar estado del trabajo';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
