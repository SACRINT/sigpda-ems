import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { getPlanningById, getGenerationJobById, getLatestGenerationJob, claimGenerationJob } from '@/lib/db';
import { requireActiveTeacher } from '@/lib/api-auth';
import { processGenerationJob } from '@/lib/job-worker';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
// La recuperación de jobs se ejecuta en `after()` y necesita el mismo margen
// que el pipeline editorial completo.
export const maxDuration = 300;

// ── GET: Consultar el estado y progreso en tiempo real de un trabajo ────────
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

    // Mecanismo de auto-recuperación determinista:
    // 1. Si el job quedó en 'pending' por más de 5 s, disparar worker de respaldo.
    // 2. Si está 'running' pero su lease_until expiró (o es null), el worker anterior
    //    murió (p. ej. timeout o corte): reanudar atómicamente de inmediato sin retraso de 300 s.
    // El claim atómico en Neon garantiza un solo worker aunque haya múltiples polls concurrentes.
    const now = Date.now();
    const lastActivity = new Date(job.updated_at || job.created_at).getTime();
    const resultObj =
      job.result && typeof job.result === 'object'
        ? (job.result as unknown as Record<string, unknown>)
        : null;
    const nextRetryAtRaw = typeof resultObj?.nextRetryAt === 'string' ? resultObj.nextRetryAt : null;
    const nextRetryAtMs = nextRetryAtRaw ? Date.parse(nextRetryAtRaw) : NaN;
    const inCooldownBackoff = Number.isFinite(nextRetryAtMs) && now < nextRetryAtMs;
    const checkpointAttempts =
      typeof resultObj?.attempts === 'number' ? resultObj.attempts : null;
    const completedAttempts =
      typeof resultObj?.generationAttempts === 'number' ? resultObj.generationAttempts : null;
    const attempts = completedAttempts ?? (checkpointAttempts !== null ? checkpointAttempts + 1 : 1);
    const isStalePending =
      job.status === 'pending' && !inCooldownBackoff && now - lastActivity > 10000;
    const isLeaseExpired =
      job.status === 'running' &&
      (!job.lease_until || new Date(job.lease_until).getTime() < now);

    if (isStalePending || isLeaseExpired) {
      const claimed = await claimGenerationJob(job.id);
      if (claimed && claimed.lease_id) {
        const leaseId = claimed.lease_id;
        after(async () => {
          try {
            await processGenerationJob(job.id, leaseId);
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
      attempts,
      nextRetryAt: inCooldownBackoff ? nextRetryAtRaw : null,
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
