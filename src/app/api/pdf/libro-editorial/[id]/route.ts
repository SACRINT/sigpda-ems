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
import * as fs from 'fs';
import * as path from 'path';
import { auth } from '@/lib/auth';
import { getTeacherByEmail, getPlanningById, sql } from '@/lib/db';
import { getSubscriptionStatus } from '@/lib/subscription-gate';
import { featureFlags } from '@/lib/platform/feature-flags';
import {
  createEditorialBook,
  getDownloadableEditorialBookForPlanning,
  getEditorialBookByPlanningAndHash,
  getEditorialBookById,
  getLatestEditorialBookForPlanning,
  updateEditorialBookStatus,
} from '@/lib/editorial/editorial-db';
import {
  dispatchToEditorialWorker,
  fetchEditorialWorkerTemplateVersion,
  EDITORIAL_WORKER_DEFAULT_TIMEOUT_MS,
  EDITORIAL_WORKER_MAX_BUDGET_MS,
} from '@/lib/editorial/worker-client';
import { isEditorialPdfStorageAvailable, uploadEditorialPdfToBlob } from '@/lib/editorial/blob-storage';
import {
  StudentChapter,
  StudentChapterSchema,
} from '@/lib/editorial/student-content-model';
import { composeStudentSessionsFromWorkbooks } from '@/lib/editorial/compose-student-sessions';
import { ensureEditorialPlanCompleteness } from '@/lib/editorial/plan-completeness';
import { sanitizeDocFilename } from '@/lib/document-branding';
import { resolverIdentidadEscolar } from '@/lib/school-identity';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const maxDuration = 60; // Timeout máximo compatible con plan Hobby y Vercel Serverless

/**
 * Presupuesto de la auto-sanación con IA antes de componer (24 s). Deja margen
 * para el dispatch al worker Typst (~7 s), la subida a Blob y el guardado (5 s+)
 * dentro del maxDuration=60 s de Vercel. Si la IA se demora de más, la red de
 * seguridad determinista completa el resto sin bloquear la exportación.
 */
const EDITORIAL_REPAIR_DEADLINE_MS = 24_000;

/**
 * Versión de respaldo de la plantilla Typst. Se usa SOLO si no es posible leer
 * el archivo .typ en runtime (defensa ante un bundle sin trazar). BUMPEAR junto
 * con cada commit que toque templates/editorial/workbook-template.typ.
 */
export const EDITORIAL_TEMPLATE_VERSION_FALLBACK = 'v2026.10.20.2';

let cachedTemplateVersion: string | null = null;

/**
 * Versión de la plantilla Typst derivada del CONTENIDO REAL de
 * templates/editorial/workbook-template.typ (sha256 → 16 hex). Se incluye en el
 * content_hash para que cualquier cambio de espaciado/tipografía/estructura
 * invalide la caché de PDFs ya compilados sin depender de que alguien recuerde
 * bumpear una constante a mano (eso ya falló una vez: la caché quedó pegada con
 * un PDF de diseño viejo). Fallback: EDITORIAL_TEMPLATE_VERSION_FALLBACK.
 */
export function resolveEditorialTemplateVersion(): string {
  if (cachedTemplateVersion !== null) {
    return cachedTemplateVersion;
  }
  try {
    const templatePath = path.join(process.cwd(), 'templates', 'editorial', 'workbook-template.typ');
    const sha = crypto.createHash('sha256').update(fs.readFileSync(templatePath)).digest('hex');
    cachedTemplateVersion = `tpl:${sha.slice(0, 16)}`;
  } catch {
    cachedTemplateVersion = EDITORIAL_TEMPLATE_VERSION_FALLBACK;
  }
  return cachedTemplateVersion;
}

/**
 * Normaliza la zona escolar para portada e índice del libro.
 * '086' → 'Zona 086' · 'Zona 086' → 'Zona 086' · vacío → respaldo de identidad
 * (catálogo del plantel) → 'Zona no registrada'. NUNCA un default fijo tipo 004:
 * ese hardcode pintó "Zona 004" en portadas de docentes de la zona 086.
 */
function formatZonaEscolar(raw?: string | null, fallbackCatalogo?: string | null): string {
  const v = (raw ?? '').trim();
  if (!v) {
    const f = (fallbackCatalogo ?? '').trim();
    if (!f) return 'Zona no registrada';
    if (/^zona\b/i.test(f)) return f;
    if (/^\d{2,4}$/.test(f)) return `Zona ${f}`;
    return f;
  }
  if (/^zona\b/i.test(v)) return v;
  if (/^\d{2,4}$/.test(v)) return `Zona ${v}`;
  return v;
}

/**
 * Helper para validar autenticación y suscripción Premium
 */
async function authorizeRequest(request: NextRequest): Promise<{
  authorized: boolean;
  teacherId?: string;
  teacherEmail?: string;
  isAdmin?: boolean;
  teacherSchoolName?: string | null;
  teacherCct?: string | null;
  teacherZone?: string | null;
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
  let teacherSchoolName: string | null = null;
  let teacherCct: string | null = null;
  let teacherZone: string | null = null;

  const session = await auth();
  if (session?.user?.email) {
    teacherEmail = session.user.email;
    const teacher = await getTeacherByEmail(teacherEmail);
    if (teacher) {
      teacherId = teacher.id;
      isSuperAdmin = teacher.role === 'administrador';
      teacherSchoolName = teacher.school_name ?? null;
      teacherCct = teacher.cct ?? null;
      // Zona escolar REAL del docente: Wizard de Configuración → horario_config
      // (con copia de respaldo en teachers.custom_preferences). Nunca hardcodeada.
      try {
        const cfgRows = await sql()`
          SELECT zona_escolar FROM horario_config
          WHERE teacher_id = ${teacher.id}::uuid
          LIMIT 1
        `;
        const cfgZone = cfgRows[0]?.zona_escolar;
        if (typeof cfgZone === 'string' && cfgZone.trim().length > 0) {
          teacherZone = cfgZone;
        } else {
          const prefRows = await sql()`
            SELECT custom_preferences FROM teachers WHERE id = ${teacher.id}::uuid
          `;
          const prefs = (prefRows[0]?.custom_preferences ?? null) as {
            zonaEscolar?: string;
            zona?: string;
          } | null;
          teacherZone = prefs?.zonaEscolar || prefs?.zona || null;
        }
      } catch (error) {
        logger.warn('[api/pdf/libro-editorial] No fue posible leer la zona escolar del docente; se usará el default.', {
          teacherId: teacher.id,
          error: error instanceof Error ? error.message : String(error),
        });
        teacherZone = null;
      }
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
    teacherSchoolName,
    teacherCct,
    teacherZone,
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
      // Sin chapter explícito en el body: componer desde los libros de bloque persistidos.
      // ANTES: auto-sanación de integridad con IA (recurso/evaluación faltantes) + red
      // determinista, para que el libro salga SIEMPRE completo (72/72 sesiones).
      const repair = await ensureEditorialPlanCompleteness({
        workbooksJson: (rawPlanning.workbooks_json ?? {}) as never,
        planningId,
        uacName: rawPlanning.uac_name,
        teacherId: authResult.teacherId,
        deadlineMs: EDITORIAL_REPAIR_DEADLINE_MS,
      });
      if (repair.mode !== 'noop') {
        rawPlanning.workbooks_json = repair.workbooksJson as typeof rawPlanning.workbooks_json;
      }

      const composed = composeStudentSessionsFromWorkbooks(rawPlanning);

      if (composed.sessions.length === 0) {
        logger.warn('[api/pdf/libro-editorial] NO_SESSIONS: la planeación no tiene libros de bloque con sesiones de estudiante', {
          planningId,
        });
        return NextResponse.json(
          {
            error:
              'Esta planeación aún no tiene libros de bloque generados (PC1–PC3). Genera primero los libros de bloque desde la pestaña Documento y vuelve a exportar el Libro Editorial.',
            code: 'NO_SESSIONS',
          },
          { status: 400 },
        );
      }

      // Nunca se publica un libro parcial en silencio: si un plan falla por reglas
      // DURAS (contenido corrupto), se aborta con el detalle exacto de la sesión.
      if (composed.dropped.length > 0) {
        logger.error('[api/pdf/libro-editorial] EXPORT_ABORTED: sesiones con contenido duramente inválido', {
          planningId,
          dropped: composed.dropped,
        });
        return NextResponse.json(
          {
            error: `El libro editorial no se pudo generar: ${composed.dropped.length} sesión(es) tienen contenido inválido en workbooks_json. Regenera los libros de bloque afectados (botón Regenerar) y vuelve a exportar. Sesiones: ${composed.dropped
              .map((d) => `${d.blockKey}#${d.sessionNumber}`)
              .join(', ')}`,
            code: 'EDITORIAL_SESSION_INVALID',
            dropped: composed.dropped,
          },
          { status: 422 },
        );
      }

      const plantel =
        typeof authResult.teacherSchoolName === 'string' && authResult.teacherSchoolName.trim().length >= 3
          ? authResult.teacherSchoolName.trim()
          : 'Educación Media Superior Puebla';
      const cct =
        typeof authResult.teacherCct === 'string' && authResult.teacherCct.trim().length >= 5
          ? authResult.teacherCct.trim()
          : '21EBH0001X';
      const firstBlock = composed.blocksPresent[0] ?? 0;
      const bloqueEtiqueta =
        composed.blocksPresent.length > 1
          ? `Bloques ${composed.blocksPresent.map((n) => n + 1).join(', ')}`
          : `Bloque ${firstBlock + 1}`;

      chapter = StudentChapterSchema.parse({
        uac: rawPlanning.uac_name || 'Pensamiento Matemático',
        bloque: bloqueEtiqueta,
        editorialSubtitle: 'Alineado al MCCEMS y Proyectos Aula Escuela Comunidad (PAEC)',
        semestre: String(rawPlanning.semester || '2'),
        cicloEscolar: '2026-2027',
        plantel,
        cct,
        zonaEscolar: formatZonaEscolar(
          authResult.teacherZone,
          resolverIdentidadEscolar({ schoolName: plantel, cct }).schoolZone,
        ),
        sesiones: composed.sessions,
      });
    }

    // Cálculo del content_hash del capítulo para deduplicación estricta.
    // El hash se ancla a la versión REAL de la plantilla Typst que el WORKER usará
    // al compilar (GET /health → templateVersion), no a la copia local de Vercel.
    // Si Vercel y el worker divergen durante una carrera de despliegues, la caché
    // queda etiquetada con lo que el worker compiló, evitando envenenarla con PDFs
    // de diseño viejo (incidente hash ff2d67c466: Vercel con .typ nuevo → hash
    // nuevo, pero worker con plantilla vieja → PDF viejo cacheado bajo hash nuevo).
    // El prefijo 'v2' bumpa el esquema del hash para invalidar las entradas
    // envenenadas previas (ancladas a la versión local de Vercel).
    const workerTemplateVersion = await fetchEditorialWorkerTemplateVersion();
    const templateVersion = workerTemplateVersion ?? resolveEditorialTemplateVersion();
    if (!workerTemplateVersion) {
      logger.warn('[api/pdf/libro-editorial] /health del worker no disponible; usando versión local de plantilla para el hash', {
        localTemplateVersion: resolveEditorialTemplateVersion(),
      });
    }
    const contentHash = crypto
      .createHash('sha256')
      .update('v2')
      .update(templateVersion)
      .update(JSON.stringify(chapter))
      .digest('hex');
    logger.info(
      `[api/pdf/libro-editorial] templateVersion=${templateVersion} (source=${workerTemplateVersion ? 'worker' : 'local'}) contentHash=${contentHash}`,
    );

    // Revisar si ya existe un libro editorial completado con exactamente este content_hash.
    // Solo cuenta como caché si el PDF puede leerse desde este entorno: un `local://`
    // escrito en otra instancia (BD compartida) no es descargable y debe recompilarse.
    const existing = await getEditorialBookByPlanningAndHash(planningId, contentHash);
    const existingServable =
      existing && existing.status === 'completed'
        ? await isEditorialPdfStorageAvailable(existing.pdf_storage_path)
        : false;

    if (existing && existing.status === 'completed' && existing.pdf_storage_path && existingServable) {
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

    if (existing && existing.status === 'completed' && !existingServable) {
      logger.warn('[api/pdf/libro-editorial] Registro en caché no descargable; se recompila:', {
        contentHash,
        pdfStoragePath: existing.pdf_storage_path,
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
    const MIN_REQUIRED_BUDGET_MS = 13000;

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

    // Persistir PDF en Vercel Blob Storage.
    // Nombre de archivo legible para el docente (UAC + bloque) en lugar del
    // UUID de la planeación, conservando un sufijo corto de hash para que el
    // path del blob sea único por contenido (evita que una reexportación
    // sobrescriba el PDF de un registro editorial anterior que referencie la
    // misma URL).
    const uacSlug = sanitizeDocFilename(chapter.uac, 48);
    const bloqueSlug = sanitizeDocFilename(chapter.bloque, 20);
    const friendlyBase = [uacSlug, bloqueSlug].filter(Boolean).join('_');
    const filename = `${friendlyBase || planningId}_editorial_${contentHash.slice(0, 10)}.pdf`;
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

    // El registro más reciente puede ser un `local://` huérfano (escrito en otra instancia
    // contra la BD compartida) ilegible desde aquí. Sin filtro explícito, buscar la copia
    // servible del mismo contenido vigente; si no existe, 404 honesto para re-exportar.
    if (book.status === 'completed' && !(await isEditorialPdfStorageAvailable(book.pdf_storage_path))) {
      if (!bookId && !contentHash) {
        const servable = await getDownloadableEditorialBookForPlanning(planningId);
        if (servable) book = servable;
      }

      if (!(await isEditorialPdfStorageAvailable(book.pdf_storage_path))) {
        logger.warn('[api/pdf/libro-editorial] Libro completado sin PDF descargable:', {
          planningId,
          bookId: book.id,
          pdfStoragePath: book.pdf_storage_path,
        });
        return NextResponse.json(
          {
            error: 'El PDF generado ya no está disponible. Vuelve a exportar el libro.',
            code: 'STORAGE_UNAVAILABLE',
          },
          { status: 404 },
        );
      }
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
