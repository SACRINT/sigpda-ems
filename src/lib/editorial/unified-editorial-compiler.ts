/**
 * unified-editorial-compiler.ts — Motor Editorial Unificado (Fase 4 · PR 4.1)
 * SIGPDA-EMS · Render Typst 0.15.1 + Caché Blob por `content_hash` + Fallback Clásico
 *
 * Punto único de compilación PDF para:
 * - `/api/pdf/libro-semestral/[id]` (vía `master-workbook-compiler.ts`)
 * - `/api/pdf/extra/bulk` (`06_Libro_Semestral_*.pdf`, vía `master-workbook-compiler.ts`)
 * - `/api/pdf/libro-bloque/[id]` (libro individual de bloque)
 *
 * Reglas de seguridad y costo:
 * 1. Detrás de `PUBLISHING_ENGINE_V2` (default false): si está apagado, mantiene jsPDF sin cambios.
 * 2. Caché primero: calcula `content_hash` anclado al `templateVersion` de Render y lee el PDF
 *    desde Vercel Blob / `local://` si ya existe (0 compilaciones extra, 0 costo Render).
 * 3. Resiliencia total: si Render duerme/falla, excede presupuesto o hay sesiones incompatibles,
 *    hace fallback automático al generador clásico (`renderWorkbookToPdf`) para que nunca falle
 *    una descarga del usuario.
 */

import * as crypto from 'crypto';
import type { Planning } from '@/types/planning';
import type { ActiveWorkTextbook } from '@/types/work-textbook';
import { featureFlags } from '@/lib/platform/feature-flags';
import { renderWorkbookToPdf } from '@/lib/pdf-workbook-renderer';
import { composeStudentSessionsFromWorkbooks } from './compose-student-sessions';
import { enrichEditorialSessionsV2 } from './editorial-v2-enricher';
import { resolveEditorialDisciplinaryUi } from './disciplinary-ui';
import { StudentChapterSchema } from './student-content-model';
import { resolveEditorialTemplateVersion } from './template-version';
import {
  dispatchToEditorialWorker,
  fetchEditorialWorkerTemplateVersion,
  EDITORIAL_WORKER_DEFAULT_TIMEOUT_MS,
} from './worker-client';
import {
  createEditorialBook,
  getEditorialBookByPlanningAndHash,
  updateEditorialBookStatus,
} from './editorial-db';
import {
  readEditorialPdfFromStorage,
  uploadEditorialPdfToBlob,
} from './blob-storage';
import { allocateEditorialSceneOnDisk } from '@/lib/visual-engine/scene-allocator';
import { createNodeSceneFileExists } from '@/lib/visual-engine/scene-allocator-node';
import {
  resolveSchoolIdentity,
  PLANTEL_NO_REGISTRADO,
  CCT_NO_REGISTRADO,
  type SchoolIdentitySource,
} from '@/lib/school-identity';
import { sanitizeDocFilename } from '@/lib/document-branding';
import {
  acquireEditorialConcurrencyLock,
  enforceUsageQuota,
  QuotaExceededError,
  releaseEditorialConcurrencyLock,
} from '@/lib/platform/usage-quota-guard';
import { recordEditorialEngineTelemetry } from '@/lib/db/usage-quotas';
import { logger } from '@/lib/logger';

export type UnifiedPdfEngine = 'typst' | 'typst_cached' | 'jspdf_legacy' | 'jspdf_fallback';

export interface UnifiedEditorialCompileParams {
  planningId: string;
  planning: Planning;
  /** Si se indica (0, 1 o 2), compila solo ese bloque; omitido = compendio semestral completo. */
  blockIndex?: number;
  /** Mapa `block_N -> { current: ActiveWorkTextbook }` disponible en BD. */
  workbooksMap: Record<string, { current?: ActiveWorkTextbook } | undefined>;
  /** Libro ya armado para fallback transparente a jsPDF clásico si Typst no aplica o falla. */
  fallbackWorkbook: ActiveWorkTextbook;
  /** Override explícito para pruebas unitarias (por defecto lee `PUBLISHING_ENGINE_V2`). */
  forceV2?: boolean;
  /** Deshabilita lectura/escritura en Neon/Blob (útil en tests aislados). */
  skipCache?: boolean;
  /** Presupuesto de tiempo para compilar en Render (default 50s). */
  timeoutMs?: number;
  /** Datos escolares del perfil docente como respaldo si sectionI no los contiene. */
  teacherIdentity?: {
    schoolName?: string | null;
    cct?: string | null;
    schoolZone?: string | null;
  };
  /** Contexto opcional de cuotas/concurrencia PR 4.2 (en cache-hit nunca descuenta cuota). */
  quotaContext?: {
    teacherId: string;
    teacherEmail?: string;
    idempotencyKey?: string;
  };
}

export interface UnifiedEditorialCompileResult {
  pdfBuffer: Buffer;
  engine: UnifiedPdfEngine;
  cached: boolean;
  contentHash?: string;
  pageCount?: number;
  source?: 'remote_worker' | 'local_fallback';
  fallbackReason?: string;
}

function formatZonaEscolar(raw?: string | null): string {
  const v = (raw ?? '').trim();
  if (!v) return 'Zona no registrada';
  if (/^zona\b/i.test(v)) return v;
  if (/^\d{2,4}$/.test(v)) return `Zona ${v}`;
  return v;
}

/**
 * Compila un libro PDF (bloque individual o compendio semestral) con el motor editorial
 * unificado Typst V2 + caché por `content_hash` y fallback automático al motor clásico.
 */
export async function compileUnifiedEditorialPdf(
  params: UnifiedEditorialCompileParams,
): Promise<UnifiedEditorialCompileResult> {
  const startedAt = Date.now();
  const useV2 = params.forceV2 ?? featureFlags.isEnabled('PUBLISHING_ENGINE_V2');
  const scopeLabel =
    typeof params.blockIndex === 'number' && Number.isInteger(params.blockIndex)
      ? `v2-block-${params.blockIndex}`
      : 'v2-semestral';

  if (!useV2) {
    const pdfBuffer = await renderWorkbookToPdf(params.fallbackWorkbook, params.planning);
    return {
      pdfBuffer,
      engine: 'jspdf_legacy',
      cached: false,
    };
  }

  let lockId: string | undefined;
  let finalEngine: UnifiedPdfEngine = 'jspdf_fallback';

  try {
    const isSingleBlock = typeof params.blockIndex === 'number' && Number.isInteger(params.blockIndex);
    const scopedWorkbooks: Record<string, { current?: ActiveWorkTextbook }> = {};

    if (isSingleBlock) {
      const key = `block_${params.blockIndex}`;
      const existing = params.workbooksMap[key]?.current ?? params.fallbackWorkbook;
      scopedWorkbooks[key] = { current: existing };
    } else {
      for (const [k, v] of Object.entries(params.workbooksMap)) {
        if (/^block_\d+$/.test(k) && v?.current) {
          scopedWorkbooks[k] = { current: v.current };
        }
      }
    }

    const sceneFileExists = createNodeSceneFileExists();
    const composed = composeStudentSessionsFromWorkbooks(
      {
        uac_name: params.planning.uacName,
        workbooks_json: scopedWorkbooks,
      },
      { sceneFileExists },
    );

    if (composed.sessions.length === 0 || composed.dropped.length > 0) {
      const reason =
        composed.sessions.length === 0
          ? 'no_student_sessions'
          : `dropped_sessions:${composed.dropped.length}`;
      logger.warn('[unified-editorial-compiler] Fallback a jsPDF clásico tras composición:', {
        planningId: params.planningId,
        blockIndex: params.blockIndex,
        reason,
      });
      const pdfBuffer = await renderWorkbookToPdf(params.fallbackWorkbook, params.planning);
      return {
        pdfBuffer,
        engine: 'jspdf_fallback',
        cached: false,
        fallbackReason: reason,
      };
    }

    const sectionI = (params.planning.contentJson?.sectionI ?? undefined) as
      | SchoolIdentitySource
      | undefined;
    const schoolIdentity = resolveSchoolIdentity({
      sectionI,
      teacher: {
        schoolName: params.teacherIdentity?.schoolName ?? params.fallbackWorkbook.coverData?.schoolName,
        cct: params.teacherIdentity?.cct ?? params.fallbackWorkbook.coverData?.cct,
        schoolZone: params.teacherIdentity?.schoolZone,
      },
    });
    const plantel =
      schoolIdentity.schoolName !== PLANTEL_NO_REGISTRADO
        ? schoolIdentity.schoolName
        : 'Educación Media Superior Puebla';
    const cct =
      schoolIdentity.cct !== CCT_NO_REGISTRADO ? schoolIdentity.cct : '21EBH0001X';

    const firstBlock = isSingleBlock ? params.blockIndex! : (composed.blocksPresent[0] ?? 0);
    const bloqueEtiqueta = isSingleBlock
      ? `Bloque ${firstBlock + 1}`
      : composed.blocksPresent.length > 1
        ? `Bloques ${composed.blocksPresent.map((n) => n + 1).join(', ')}`
        : `Bloque ${firstBlock + 1}`;

    const resolvedUacName = params.planning.uacName || 'Unidad de Aprendizaje Curricular';
    const coverScene = allocateEditorialSceneOnDisk({
      uacName: resolvedUacName,
      blockNumber: firstBlock + 1,
      role: 'block_cover',
      fileExists: sceneFileExists,
    });

    const enrichedSessions = await enrichEditorialSessionsV2({
      uacName: resolvedUacName,
      sessions: composed.sessions,
      missions: composed.missions,
    });

    const chapter = StudentChapterSchema.parse({
      uac: resolvedUacName,
      bloque: bloqueEtiqueta,
      editorialSubtitle: 'Alineado al MCCEMS y Proyectos Aula Escuela Comunidad (PAEC)',
      semestre: String(params.planning.semester || '2'),
      cicloEscolar: '2026-2027',
      plantel,
      cct,
      zonaEscolar: formatZonaEscolar(schoolIdentity.schoolZone),
      disciplinaUi: resolveEditorialDisciplinaryUi(resolvedUacName),
      ...(coverScene ? { coverScene } : {}),
      ...(composed.missions.length > 0 ? { missions: composed.missions } : {}),
      ...(composed.projectSections.length > 0 ? { projectSections: composed.projectSections } : {}),
      ...(composed.evaluationSections.length > 0
        ? { evaluationSections: composed.evaluationSections }
        : {}),
      sesiones: enrichedSessions,
    });

    // Anclar content_hash a la versión real de plantilla en Render (o local si Render no responde)
    const workerTemplateVersion = await fetchEditorialWorkerTemplateVersion();
    const templateVersion = workerTemplateVersion ?? resolveEditorialTemplateVersion();
    const scopeKey = isSingleBlock ? `v2-block-${params.blockIndex}` : 'v2-semestral';
    const contentHash = crypto
      .createHash('sha256')
      .update(scopeKey)
      .update(templateVersion)
      .update(JSON.stringify(chapter))
      .digest('hex');

    // 1. Revisar caché por content_hash antes de invocar Render/Typst (0 costo de compilación)
    if (!params.skipCache) {
      try {
        const existing = await getEditorialBookByPlanningAndHash(params.planningId, contentHash);
        if (existing?.status === 'completed' && existing.pdf_storage_path) {
          const cachedBuffer = await readEditorialPdfFromStorage(existing.pdf_storage_path);
          if (cachedBuffer) {
            logger.info('[unified-editorial-compiler] Cache HIT (0 costo compilación):', {
              planningId: params.planningId,
              scopeKey,
              contentHash: contentHash.slice(0, 12),
              bytes: cachedBuffer.length,
            });
            finalEngine = 'typst_cached';
            if (params.quotaContext) {
              await recordEditorialEngineTelemetry({
                teacherId: params.quotaContext.teacherId,
                planningId: params.planningId,
                scope: scopeKey,
                engine: 'typst_cached',
                cached: true,
                durationMs: Date.now() - startedAt,
              });
            }
            return {
              pdfBuffer: cachedBuffer,
              engine: 'typst_cached',
              cached: true,
              contentHash,
              pageCount: existing.page_count ?? undefined,
            };
          }
        }
      } catch (cacheLookupErr) {
        logger.warn('[unified-editorial-compiler] Error consultando caché editorial (se continúa compilando):', {
          planningId: params.planningId,
          error: cacheLookupErr instanceof Error ? cacheLookupErr.message : String(cacheLookupErr),
        });
      }
    }

    // 1b. PR 4.2: En cache-miss real, aplicar lock de concurrencia y cuota con idempotencia (contentHash)
    if (params.quotaContext) {
      const lock = await acquireEditorialConcurrencyLock({
        teacherId: params.quotaContext.teacherId,
        teacherEmail: params.quotaContext.teacherEmail,
        scope: 'pdf_compile',
        resourceId: `${params.planningId}:${scopeKey}`,
        ttlSeconds: 180,
      });
      if (!lock.acquired) {
        throw new QuotaExceededError({
          message: lock.message || 'Ya existe una compilación PDF activa para tu cuenta.',
          statusCode: 409,
          code: lock.code || 'CONCURRENCY_LIMIT',
        });
      }
      lockId = lock.lockId;

      const quota = await enforceUsageQuota({
        teacherId: params.quotaContext.teacherId,
        teacherEmail: params.quotaContext.teacherEmail,
        metric: 'pdf_compile',
        idempotencyKey: params.quotaContext.idempotencyKey || `${scopeKey}:${contentHash.slice(0, 24)}`,
      });
      if (!quota.allowed) {
        throw new QuotaExceededError({
          message: quota.message || 'Has alcanzado el límite de compilaciones PDF de tu plan.',
          statusCode: quota.statusCode || 403,
          code: quota.code || 'QUOTA_EXCEEDED',
          retryAfterSeconds: quota.retryAfterSeconds,
        });
      }
    }

    // 2. Compilar en Render (o typst.exe local en desarrollo)
    const workerResponse = await dispatchToEditorialWorker(chapter, {
      timeoutMs: params.timeoutMs ?? EDITORIAL_WORKER_DEFAULT_TIMEOUT_MS,
      sourceDateEpoch: 0,
    });

    if (
      !workerResponse.success ||
      !workerResponse.pdfBuffer ||
      workerResponse.pdfBuffer.length < 100 ||
      !workerResponse.pdfBuffer.subarray(0, 5).equals(Buffer.from('%PDF-'))
    ) {
      throw new Error('Buffer PDF inválido devuelto por el worker editorial');
    }

    // 3. Persistir en caché (Vercel Blob + editorial_books) en modo best-effort
    if (!params.skipCache) {
      try {
        const bookRecord = await createEditorialBook({
          planningId: params.planningId,
          workbookId: `${scopeKey}_${params.planningId}_${Date.now()}`,
          contentHash,
          metadata: {
            uac: chapter.uac,
            bloque: chapter.bloque,
            scopeKey,
            sessionCount: chapter.sesiones.length,
            binaryVersion: workerResponse.binaryVersion,
            source: workerResponse.source,
          },
        });
        const uacSlug = sanitizeDocFilename(chapter.uac, 48);
        const bloqueSlug = sanitizeDocFilename(chapter.bloque, 20);
        const safeName = `${[uacSlug, bloqueSlug].filter(Boolean).join('_') || params.planningId}_${contentHash.slice(0, 8)}.pdf`;
        const upload = await uploadEditorialPdfToBlob(workerResponse.pdfBuffer, safeName);
        await updateEditorialBookStatus(bookRecord.id, 'completed', {
          pdfStoragePath: upload.url,
          pageCount: workerResponse.pageCount,
        });
      } catch (persistErr) {
        logger.warn('[unified-editorial-compiler] PDF compilado OK, pero falló persistencia en caché:', {
          planningId: params.planningId,
          scopeKey,
          error: persistErr instanceof Error ? persistErr.message : String(persistErr),
        });
      }
    }

    finalEngine = 'typst';
    return {
      pdfBuffer: workerResponse.pdfBuffer,
      engine: 'typst',
      cached: false,
      contentHash,
      pageCount: workerResponse.pageCount,
      source: workerResponse.source,
    };
  } catch (err) {
    if (err instanceof QuotaExceededError) {
      throw err;
    }
    const reason = err instanceof Error ? err.message : String(err);
    logger.warn('[unified-editorial-compiler] Falló Typst/Render; activando fallback automático a jsPDF clásico:', {
      planningId: params.planningId,
      blockIndex: params.blockIndex,
      reason,
    });
    finalEngine = 'jspdf_fallback';
    const pdfBuffer = await renderWorkbookToPdf(params.fallbackWorkbook, params.planning);
    return {
      pdfBuffer,
      engine: 'jspdf_fallback',
      cached: false,
      fallbackReason: reason,
    };
  } finally {
    if (lockId || (params.quotaContext && finalEngine !== 'typst_cached')) {
      await releaseEditorialConcurrencyLock({
        lockId,
        teacherId: params.quotaContext?.teacherId,
        planningId: params.planningId,
        scope: scopeLabel,
        engine: finalEngine,
        cached: false,
        durationMs: Date.now() - startedAt,
      });
    }
  }
}
