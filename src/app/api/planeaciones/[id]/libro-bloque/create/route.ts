import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { auth } from '@/lib/auth';
import { getPlanningById, getTeacherByEmail, createGenerationJob } from '@/lib/db';
import { processGenerationJob } from '@/lib/job-worker';

export const runtime = 'nodejs';
export const maxDuration = 60;

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

    // Si el job está pendiente o recién creado, disparar ejecución asíncrona de inmediato vía after()
    if (job.status === 'pending') {
      after(async () => {
        try {
          await processGenerationJob(job.id);
        } catch (workerErr: any) {
          console.error(`[POST /create] Error en worker asíncrono para job ${job.id}:`, workerErr?.message);
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
        message: job.status === 'running' ? 'El libro ya se encuentra en generación' : 'Trabajo encolado exitosamente',
      },
      { status: 202 }
    );
  } catch (error: any) {
    console.error('[POST /api/planeaciones/[id]/libro-bloque/create] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Error al iniciar la generación del libro' },
      { status: 500 }
    );
  }
}
