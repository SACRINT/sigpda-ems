import { NextRequest, NextResponse } from 'next/server';
import { claimNextPendingJob, getGenerationJobById } from '@/lib/db';
import { processGenerationJob } from '@/lib/job-worker';
import { logger } from '@/lib/logger';
import { auth } from '@/lib/auth';
import { isAdmin } from '@/lib/admin-unified';

export const runtime = 'nodejs';
export const maxDuration = 60; // Máximo permitido en plan gratuito Hobby (y compatible con Pro)

/**
 * Worker Trigger Endpoint (para Vercel Cron Jobs o triggers asíncronos desacoplados)
 *
 * GET / POST /api/jobs/process
 * - Si se envía jobId: procesa específicamente ese trabajo.
 * - Si no: busca y procesa atómicamente el trabajo más antiguo pendiente o estancado.
 */
async function handleProcess(request: NextRequest) {
  try {
    // Verificación estricta de seguridad: Bearer CRON_SECRET o sesión de Administrador
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    let isAuthorized = false;

    if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
      isAuthorized = true;
    }

    if (!isAuthorized) {
      const session = await auth();
      if (session?.user?.email && (await isAdmin(session.user.email))) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized && process.env.NODE_ENV !== 'test') {
      return NextResponse.json({ error: 'No autorizado para ejecutar el worker' }, { status: 401 });
    }

    const url = new URL(request.url);
    let targetJobId = url.searchParams.get('jobId');

    if (!targetJobId && request.method === 'POST') {
      try {
        const body = await request.json();
        targetJobId = body?.jobId || null;
      } catch {
        // Body vacío o no JSON, continúa a búsqueda automática
      }
    }

    let jobToProcess = null;
    if (targetJobId) {
      jobToProcess = await getGenerationJobById(targetJobId);
    } else {
      jobToProcess = await claimNextPendingJob();
    }

    if (!jobToProcess) {
      return NextResponse.json({
        success: true,
        processed: false,
        message: 'No hay trabajos pendientes en la cola.',
      });
    }

    logger.info(`[api/jobs/process] Iniciando procesamiento de job ${jobToProcess.id}...`);

    // Procesar el trabajo
    const completedJob = await processGenerationJob(jobToProcess.id);

    return NextResponse.json({
      success: true,
      processed: true,
      jobId: jobToProcess.id,
      status: completedJob?.status || 'completed',
      wordCount: completedJob?.result?.totalWords || 0,
    });
  } catch (error: unknown) {
    logger.error('[api/jobs/process] Error al procesar trabajo:', error);
    const message = error instanceof Error ? error.message : 'Error procesando trabajo';
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return handleProcess(request);
}

export async function POST(request: NextRequest) {
  return handleProcess(request);
}
