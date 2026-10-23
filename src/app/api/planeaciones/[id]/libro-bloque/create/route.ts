import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { auth } from '@/lib/auth';
import { getPlanningById, getTeacherByEmail, createGenerationJob, claimGenerationJob } from '@/lib/db';
import { processGenerationJob } from '@/lib/job-worker';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
// El pipeline editorial completo (4 redactores + matriz + validación) suele
// tardar 60-90 s. El límite anterior de 60 s mataba la invocación de `after()`
// a mitad del trabajo y dejaba el job en `running` para siempre.
export const maxDuration = 300;

// Un job `running` sin heartbeat durante este lapso se considera interrumpido
// (la duración máxima de una invocación es de 300 s; los redactores refrescan
// el progreso al terminar cada fase).
const STALE_RUNNING_SECONDS = 120;

// ── POST: Crear o encolar un trabajo de generación de Libro de Bloque ────────
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

    // Crear trabajo en Neon PostgreSQL (o recuperar el activo si ya está corriendo)
    const job = await createGenerationJob(id, teacher.id, Number(blockIndex));

    const isPending = job.status === 'pending';
    const isStaleRunning =
      job.status === 'running' &&
      Date.now() - new Date(job.updated_at).getTime() > STALE_RUNNING_SECONDS * 1000;

    // Reclamar atómicamente antes de disparar: evita workers duplicados cuando
    // dos peticiones llegan a la vez. Un job `running` estancado se reanuda.
    let restarted = false;
    if (isPending || isStaleRunning) {
      const claimed = await claimGenerationJob(job.id, isPending ? 0 : STALE_RUNNING_SECONDS);
      if (claimed) {
        restarted = isStaleRunning;
        after(async () => {
          try {
            await processGenerationJob(job.id);
          } catch (workerErr: unknown) {
            logger.error(`[POST /create] Error en worker asíncrono para job ${job.id}:`, workerErr);
          }
        });
      }
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
