import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { getPlanningById, createGenerationJob, claimGenerationJob, JOB_LEASE_SECONDS } from '@/lib/db';
import { requireActiveTeacher } from '@/lib/api-auth';
import { processGenerationJob } from '@/lib/job-worker';
import {
  acquireEditorialConcurrencyLock,
  enforceUsageQuota,
  releaseEditorialConcurrencyLock,
  releaseEditorialLockOnAbort,
} from '@/lib/platform/usage-quota-guard';
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

    // PR 4.2.1: Lock de concurrencia ANTES de cuota (si hay 409 activo jamás se consume cuota)
    const lock = await acquireEditorialConcurrencyLock({
      teacherId: teacher.id,
      teacherEmail: teacher.email,
      scope: 'ai_workbook_block',
      resourceId: `${id}:b${bIndex}`,
      ttlSeconds: 600,
    });
    if (!lock.acquired) {
      return NextResponse.json(
        { error: lock.message, code: lock.code },
        {
          status: lock.statusCode || 409,
          headers: lock.retryAfterSeconds ? { 'Retry-After': String(lock.retryAfterSeconds) } : undefined,
        }
      );
    }

    const quota = await enforceUsageQuota({
      teacherId: teacher.id,
      teacherEmail: teacher.email,
      metric: 'ai_workbook_block',
      idempotencyKey: request.headers.get('x-idempotency-key') || undefined,
    });
    if (!quota.allowed) {
      await releaseEditorialLockOnAbort(lock.lockId);
      return NextResponse.json(
        { error: quota.message, code: quota.code, limit: quota.limit, used: quota.used },
        {
          status: quota.statusCode || 403,
          headers: quota.retryAfterSeconds ? { 'Retry-After': String(quota.retryAfterSeconds) } : undefined,
        }
      );
    }

    // Crear trabajo en Neon PostgreSQL (o recuperar el activo si ya está corriendo)
    const job = await createGenerationJob(id, teacher.id, bIndex);

    // Intentar reclamar con lease_id antes de despachar al worker
    const claimed = await claimGenerationJob(job.id, JOB_LEASE_SECONDS);
    let restarted = false;

    if (claimed && claimed.lease_id) {
      restarted = job.status === 'running';
      const leaseId = claimed.lease_id;
      const startedAt = Date.now();
      after(async () => {
        try {
          await processGenerationJob(job.id, leaseId);
        } catch (workerErr: unknown) {
          logger.error(`[POST /create] Error en worker asíncrono para job ${job.id}:`, workerErr);
        } finally {
          await releaseEditorialConcurrencyLock({
            lockId: lock.lockId,
            teacherId: teacher.id,
            planningId: id,
            scope: `ai_workbook_create_b${bIndex}`,
            engine: 'ai_gemini',
            durationMs: Date.now() - startedAt,
          });
        }
      });
    } else if (lock.lockId) {
      await releaseEditorialConcurrencyLock({
        lockId: lock.lockId,
        teacherId: teacher.id,
        planningId: id,
        scope: `ai_workbook_create_b${bIndex}`,
        engine: 'ai_gemini',
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
