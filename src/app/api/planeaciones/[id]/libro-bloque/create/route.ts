import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { getPlanningById, createGenerationJob, claimGenerationJob, JOB_LEASE_SECONDS } from '@/lib/db';
import { requireActiveTeacher } from '@/lib/api-auth';
import { processGenerationJob } from '@/lib/job-worker';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const maxDuration = 300;

// ── POST: Crear o encolar un trabajo de generación de Libro de Bloque ────────
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireActiveTeacher();
    if (authResult.error) return authResult.error;
    const { teacher } = authResult;

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { blockIndex } = body;

    const bIndex = Number(blockIndex);
    if (blockIndex === undefined || blockIndex === null || isNaN(bIndex) || bIndex < 0 || bIndex > 2) {
      return NextResponse.json({ error: 'blockIndex debe ser estrictamente 0, 1 o 2 (Cortes 1, 2 y 3 del MCCEMS)' }, { status: 400 });
    }

    const planning = await getPlanningById(id);
    if (!planning) {
      return NextResponse.json({ error: 'Planeación no encontrada' }, { status: 404 });
    }
    if (planning.teacher_id !== teacher.id) {
      return NextResponse.json({ error: 'No tienes permiso para acceder a esta planeación' }, { status: 403 });
    }

    // Crear trabajo en Neon PostgreSQL (o recuperar el activo si ya está corriendo)
    const job = await createGenerationJob(id, teacher.id, bIndex);

    // Intentar reclamar con lease_id antes de despachar al worker
    const claimed = await claimGenerationJob(job.id, JOB_LEASE_SECONDS);
    let restarted = false;

    if (claimed && claimed.lease_id) {
      restarted = job.status === 'running';
      const leaseId = claimed.lease_id;
      after(async () => {
        try {
          await processGenerationJob(job.id, leaseId);
        } catch (workerErr: unknown) {
          logger.error(`[POST /create] Error en worker asíncrono para job ${job.id}:`, workerErr);
        }
      });
    }

    return NextResponse.json(
      {
        success: true,
        jobId: job.id,
        status: job.status,
        progress: job.progress,
        currentPhase: job.current_phase,
        currentStep: job.current_step,
        message: restarted
          ? 'La generación anterior se interrumpió; reanudando el trabajo'
          : job.status === 'running'
          ? 'El libro ya se encuentra en generación'
          : 'Trabajo encolado exitosamente',
      },
      { status: 202 }
    );
  } catch (error: unknown) {
    logger.error('[POST /api/planeaciones/[id]/libro-bloque/create] Error:', error);
    const message = error instanceof Error ? error.message : 'Error al iniciar la generación del libro';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
