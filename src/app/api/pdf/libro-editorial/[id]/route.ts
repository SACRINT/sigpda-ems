/**
 * route.ts — Route Handler para Editorial Publisher Engine
 * SIGPDA-EMS · Motor Editorial de Alta Gama (Fase 2)
 *
 * Ruta: /api/pdf/libro-editorial/[id]
 *
 * Reglas de Arquitectura y Seguridad:
 * 1. Feature Flag: Controlado por EDITORIAL_PUBLISHER_ENGINE (default false).
 * 2. Subscription Gate: Verifica getSubscriptionStatus(); 403 Forbidden para usuarios sin suscripción activa.
 * 3. Desacoplamiento de Datos: Persiste en la tabla dedicada `editorial_books` (cero toque a ActiveWorkTextbook).
 * 4. Persistencia Blob: Almacena el PDF en Vercel Blob Storage (@vercel/blob ^2.4.1).
 * 5. Deduplicación por Content Hash: Si el hash del capítulo ya fue compilado, devuelve el registro existente (costo 0).
 * 6. Preservación Legacy: Cero modificaciones a /api/pdf/libro-bloque ni /api/pdf/libro-semestral.
 */

import { NextRequest, NextResponse } from 'next/server';
import * as crypto from 'crypto';
import { auth } from '@/lib/auth';
import { getTeacherByEmail, getPlanningById } from '@/lib/db';
import { getSubscriptionStatus } from '@/lib/subscription-gate';
import { featureFlags } from '@/lib/platform/feature-flags';
import {
  createEditorialBook,
  getEditorialBookByPlanningAndHash,
  getEditorialBookById,
  getLatestEditorialBookForPlanning,
  updateEditorialBookStatus,
} from '@/lib/editorial/editorial-db';
import {
  dispatchToEditorialWorker,
  EDITORIAL_WORKER_DEFAULT_TIMEOUT_MS,
  EDITORIAL_WORKER_MAX_BUDGET_MS,
} from '@/lib/editorial/worker-client';
import { uploadEditorialPdfToBlob } from '@/lib/editorial/blob-storage';
import {
  StudentChapter,
  StudentChapterSchema,
  adaptSessionPlanToStudentSession,
} from '@/lib/editorial/student-content-model';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const maxDuration = 60; // Timeout máximo compatible con plan Hobby y Vercel Serverless

/**
 * Helper para validar autenticación y suscripción Premium
 */
async function authorizeRequest(request: NextRequest): Promise<{
  authorized: boolean;
  teacherId?: string;
  teacherEmail?: string;
  isAdmin?: boolean;
  errorResponse?: NextResponse;
}> {
  // 1. Verificación de Feature Flag
  if (!featureFlags.isEnabled('EDITORIAL_PUBLISHER_ENGINE')) {
    logger.warn('[api/pdf/libro-editorial] Acceso denegado: EDITORIAL_PUBLISHER_ENGINE está desactivado');
    return {
      authorized: false,
      errorResponse: NextResponse.json(
        {
          error: 'El Motor Editorial de Alta Gama se encuentra inactivo o en fase experimental cerrada.',
          code: 'FEATURE_DISABLED',
        },
        { status: 403 },
      ),
    };
  }

  // 2. Autenticación de Sesión de Docente
  let teacherEmail: string | undefined;
  let teacherId: string | undefined;
  let isSuperAdmin = false;

  const session = await auth();
  if (session?.user?.email) {
    teacherEmail = session.user.email;
    const teacher = await getTeacherByEmail(teacherEmail);
    if (teacher) {
      teacherId = teacher.id;
      isSuperAdmin = teacher.role === 'administrador';
    }
  }

  // Fallback de autorización para pruebas y cron triggers autorizados
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!teacherId && cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return { authorized: true, isAdmin: true };
  }

  if (!teacherId || !teacherEmail) {
    return {
      authorized: false,
      errorResponse: NextResponse.json(
        { error: 'No autorizado: sesión requerida', code: 'UNAUTHORIZED' },
        { status: 401 },
      ),
    };
  }

  // 3. Subscription Gate (MUT-EDIT-2)
  const subscriptionStatus = await getSubscriptionStatus(teacherId, teacherEmail);
  const hasAccess = subscriptionStatus.hasActiveSubscription || subscriptionStatus.isAdmin || isSuperAdmin;

  if (!hasAccess) {
    logger.warn('[api/pdf/libro-editorial] Intento de acceso sin suscripción Premium activa:', { teacherId });
    return {
      authorized: false,
      errorResponse: NextResponse.json(
        {
          error: 'Acceso restringido: Se requiere una suscripción Premium activa para el Motor Editorial de Alta Gama.',
          code: 'PREMIUM_REQUIRED',
          planRequired: 'editorial_premium',
        },
        { status: 403 },
      ),
    };
  }

  return {
    authorized: true,
    teacherId,
    teacherEmail,
    isAdmin: subscriptionStatus.isAdmin || isSuperAdmin,
  };
}

/**
 * POST /api/pdf/libro-editorial/[id]
 * Encola o procesa la compilación editorial del libro del estudiante para la planeación indicada.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const requestStartTime = Date.now();
    const authResult = await authorizeRequest(request);
    if (!authResult.authorized || authResult.errorResponse) {
      return authResult.errorResponse!;
    }

    const { id: planningId } = await params;
    const rawPlanning = await getPlanningById(planningId);

    if (!rawPlanning) {
      return NextResponse.json(
        { error: 'Planeación no encontrada', code: 'NOT_FOUND' },
        { status: 404 },
      );
    }

    // Verificar que el docente sea dueño de la planeación o administrador
    if (authResult.teacherId && rawPlanning.teacher_id !== authResult.teacherId && !authResult.isAdmin) {
      return NextResponse.json(
        { error: 'No tienes permiso para generar el libro de esta planeación', code: 'FORBIDDEN' },
        { status: 403 },
      );
    }

    // Parsear payload de capítulo si fue proporcionado directamente
    let chapter: StudentChapter;
    try {
      const body = await request.json();
      if (body?.chapter) {
        chapter = StudentChapterSchema.parse(body.chapter);
      } else {
        throw new Error('Sin chapter explícito en el body');
      }
    } catch {
      // Si no se proveyó en el body, construir capítulo a partir de las sesiones de la planeación
      const rawSessions = Array.isArray(rawPlanning.structured_plan?.sessionPlans)
        ? rawPlanning.structured_plan.sessionPlans
        : [];

      const studentSessions = rawSessions.map((sp: unknown) =>
        adaptSessionPlanToStudentSession(sp as Parameters<typeof adaptSessionPlanToStudentSession>[0]),
      );

      // Si la planeación no tiene sesiones estructuradas suficientes, responder error
      if (studentSessions.length === 0) {
        return NextResponse.json(
          {
            error: 'La planeación no cuenta con sesiones curriculares válidas para componer el libro del estudiante.',
            code: 'NO_SESSIONS',
          },
          { status: 400 },
        );
      }

      chapter = StudentChapterSchema.parse({
        uac: rawPlanning.uac_name || 'Pensamiento Matemático',
        bloque: 'Bloque 1',
        editorialSubtitle: 'Alineado al MCCEMS y Proyectos Aula Escuela Comunidad (PAEC)',
        semestre: String(rawPlanning.semester || '2'),
        cicloEscolar: '2026-2027',
        plantel: rawPlanning.school_name || 'Educación Media Superior Puebla',
        cct: rawPlanning.cct || '21EBH0001X',
        zonaEscolar: 'Zona 001',
        sesiones: studentSessions,
      });
    }

    // Cálculo del content_hash del capítulo para deduplicación estricta
    const contentHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(chapter))
      .digest('hex');

    // Revisar si ya existe un libro editorial completado con exactamente este content_hash
    const existing = await getEditorialBookByPlanningAndHash(planningId, contentHash);
    if (existing && existing.status === 'completed' && existing.pdf_storage_path) {
      logger.info(`[api/pdf/libro-editorial] Libro en caché detectado para hash ${contentHash}`);
      return NextResponse.json({
        success: true,
        cached: true,
        editorialBookId: existing.id,
        status: 'completed',
        downloadUrl: existing.pdf_storage_path,
        pageCount: existing.page_count,
        spineWidthMm: existing.spine_width_mm,
        contentHash,
      });
    }

    // Crear registro en estado 'pending' en la tabla editorial_books
    const bookRecord = await createEditorialBook({
      planningId,
      workbookId: `editorial_${planningId}_${Date.now()}`,
      contentHash,
      metadata: {
        uac: chapter.uac,
        bloque: chapter.bloque,
        sessionCount: chapter.sesiones.length,
      },
    });

    // Marcar como 'processing'
    await updateEditorialBookStatus(bookRecord.id, 'processing');

    // Despachar compilación al worker container de Typst con presupuesto dinámico Vercel (< 60s, AUD-R3)
    const elapsedMs = Date.now() - requestStartTime;
    const remainingBudgetMs = EDITORIAL_WORKER_MAX_BUDGET_MS - elapsedMs;
    const MIN_REQUIRED_BUDGET_MS = 8000;

    if (remainingBudgetMs < MIN_REQUIRED_BUDGET_MS) {
      logger.warn('[api/pdf/libro-editorial] Presupuesto de tiempo insuficiente antes de despachar al worker:', {
        elapsedMs,
        remainingBudgetMs,
      });
      await updateEditorialBookStatus(bookRecord.id, 'failed', {
        errorMessage: 'Presupuesto de ejecución agotado antes del despacho al compilador',
      });
      return NextResponse.json(
        {
          error: 'Tiempo de ejecución insuficiente para completar la compilación editorial. Intente nuevamente.',
          code: 'TIMEOUT_BUDGET_EXCEEDED',
        },
        { status: 504, headers: { 'Retry-After': '5' } },
      );
    }

    // Reservar 5s de margen para la posterior subida a Vercel Blob y persistencia en BD
    const dynamicTimeoutMs = Math.min(EDITORIAL_WORKER_DEFAULT_TIMEOUT_MS, remainingBudgetMs - 5000);

    logger.info(
      `[api/pdf/libro-editorial] Despachando compilación a worker para book ${bookRecord.id} (timeout: ${dynamicTimeoutMs}ms)...`,
    );
    const workerResponse = await dispatchToEditorialWorker(chapter, {
      sourceDateEpoch: 0,
      timeoutMs: dynamicTimeoutMs,
    });

    if (!workerResponse.success || !workerResponse.pdfBuffer) {
      await updateEditorialBookStatus(bookRecord.id, 'failed', {
        errorMessage: 'El compilador de Typst no devolvió un buffer de PDF válido',
      });
      return NextResponse.json(
        { error: 'Error durante la compilación editorial con Typst', code: 'COMPILE_FAILED' },
        { status: 500 },
      );
    }

    // Persistir PDF en Vercel Blob Storage
    const filename = `${planningId}_editorial_${contentHash.slice(0, 10)}.pdf`;
    const uploadResult = await uploadEditorialPdfToBlob(workerResponse.pdfBuffer, filename);

    // Calcular lomo paramétrico (calibre papel estándar 0.09 mm)
    const spineWidthMm = Number(((workerResponse.pageCount / 2) * 0.09).toFixed(2));

    // Actualizar registro editorial a 'completed'
    const completedRecord = await updateEditorialBookStatus(bookRecord.id, 'completed', {
      pdfStoragePath: uploadResult.url,
      pageCount: workerResponse.pageCount,
      spineWidthMm,
      metadata: {
        sha256: workerResponse.sha256,
        durationMs: workerResponse.durationMs,
        typstPeakMemoryMb: workerResponse.typstPeakMemoryMb,
        nodeHeapDeltaMb: workerResponse.nodeHeapDeltaMb,
        renderedSessionCount: workerResponse.renderedSessionCount,
        renderedProductoIntegradorCount: workerResponse.renderedProductoIntegradorCount,
        binaryVersion: workerResponse.binaryVersion,
        storageProvider: uploadResult.provider,
      },
    });

    return NextResponse.json({
      success: true,
      cached: false,
      editorialBookId: bookRecord.id,
      status: 'completed',
      downloadUrl: uploadResult.url,
      pageCount: workerResponse.pageCount,
      spineWidthMm,
      typstPeakMemoryMb: workerResponse.typstPeakMemoryMb,
      sha256: workerResponse.sha256,
      editorialBook: completedRecord,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Error interno en el pipeline editorial';
    logger.error('[api/pdf/libro-editorial] Excepción no controlada:', { error });
    return NextResponse.json(
      { success: false, error: errorMsg, code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}

/**
 * GET /api/pdf/libro-editorial/[id]
 * Consulta el estado y enlace de descarga del libro editorial de una planeación.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await authorizeRequest(request);
    if (!authResult.authorized || authResult.errorResponse) {
      return authResult.errorResponse!;
    }

    const { id: planningId } = await params;
    const url = new URL(request.url);
    const contentHash = url.searchParams.get('contentHash');
    const bookId = url.searchParams.get('bookId');

    let book = null;
    if (bookId) {
      book = await getEditorialBookById(bookId);
    } else if (contentHash) {
      book = await getEditorialBookByPlanningAndHash(planningId, contentHash);
    } else {
      book = await getLatestEditorialBookForPlanning(planningId);
    }

    if (!book) {
      return NextResponse.json(
        { error: 'No se encontró un libro editorial para esta planeación', code: 'NOT_FOUND' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      editorialBook: book,
      status: book.status,
      downloadUrl: book.pdf_storage_path,
      pageCount: book.page_count,
      spineWidthMm: book.spine_width_mm,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Error consultando libro editorial';
    logger.error('[api/pdf/libro-editorial] Error en GET:', { error });
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 },
    );
  }
}
