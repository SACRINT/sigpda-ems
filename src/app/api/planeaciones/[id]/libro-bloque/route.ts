import { NextRequest, NextResponse } from 'next/server';
import { getPlanningById, getBlockWorkbook, saveBlockWorkbook } from '@/lib/db';
import { requireActiveTeacher } from '@/lib/api-auth';
import {
  acquireEditorialConcurrencyLock,
  enforceUsageQuota,
  releaseEditorialConcurrencyLock,
  releaseEditorialLockOnAbort,
} from '@/lib/platform/usage-quota-guard';
import { logger } from '@/lib/logger';
import type { EvaluationRubricCriterion } from '@/types/work-textbook';
export const runtime = 'nodejs';
export const maxDuration = 300;

// ── GET: Obtener el Libro de Trabajo generado para un bloque ────────────────
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
    const blockIndexParam = url.searchParams.get('blockIndex');

    if (blockIndexParam === null) {
      return NextResponse.json({ error: 'Parámetro blockIndex es requerido' }, { status: 400 });
    }

    const blockIndex = parseInt(blockIndexParam, 10);
    if (isNaN(blockIndex) || blockIndex < 0 || blockIndex > 2) {
      return NextResponse.json({ error: 'blockIndex debe ser estrictamente 0, 1 o 2 (Cortes 1, 2 y 3 del MCCEMS)' }, { status: 400 });
    }
    let workbook = await getBlockWorkbook(id, blockIndex);

    if (!workbook) {
      const { getLatestGenerationJob } = await import('@/lib/db');
      const latestJob = await getLatestGenerationJob(id, blockIndex);
      if (latestJob && latestJob.status === 'completed' && latestJob.result) {
        workbook = latestJob.result;
      }
    }

    if (!workbook) {
      return NextResponse.json({
        workbook: null,
        found: false,
        wordCount: 0,
        totalWords: 0,
      }, { status: 200 });
    }

    return NextResponse.json({
      workbook,
      wordCount: workbook?.totalWords || 0,
      totalWords: workbook?.totalWords || 0,
    });
  } catch (error: unknown) {
    logger.error('[GET /api/planeaciones/[id]/libro-bloque] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al obtener libro de trabajo' },
      { status: 500 }
    );
  }
}

// ── POST: Iniciar la generación asíncrona mediante Job Queue ─────────────────
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

    const { createGenerationJob } = await import('@/lib/db');
    const { processGenerationJob } = await import('@/lib/job-worker');
    const { after } = await import('next/server');

    const job = await createGenerationJob(id, teacher.id, bIndex);

    if (job.status === 'pending') {
      const startedAt = Date.now();
      after(async () => {
        try {
          await processGenerationJob(job.id);
        } catch (err: unknown) {
          logger.error(`[POST /libro-bloque] Worker background error for job ${job.id}:`, err);
        } finally {
          await releaseEditorialConcurrencyLock({
            lockId: lock.lockId,
            teacherId: teacher.id,
            planningId: id,
            scope: `ai_workbook_b${bIndex}`,
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
        scope: `ai_workbook_b${bIndex}`,
        engine: 'ai_gemini',
      });
    }

    return NextResponse.json({
      success: true,
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      message: 'Trabajo de generación iniciado en segundo plano',
    }, { status: 202 });
  } catch (error: unknown) {
    logger.error('[POST /api/planeaciones/[id]/libro-bloque] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al iniciar la generación del libro de trabajo' },
      { status: 500 }
    );
  }
}

// ── PATCH: Reparación puntual sin regenerar el libro completo ─────────────────
// Soporta los siguientes repairCodes:
//   S4_RUBRIC_WEIGHT_SUM_MISMATCH  → normaliza pesos de rúbrica a 100%
//   S4_RUBRIC_LEVEL_MISSING        → idem (mismo bloque de rúbrica)
//
// Nota: S2 (tiempos/instrumento) opera sobre planes de clase del docente que son
// derivados al momento de exportar desde el workbook del alumno. No están
// almacenados en el workbook y por tanto no son reparables por PATCH aquí.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireActiveTeacher();
    if (authResult.error) return authResult.error;
    const { teacher } = authResult;

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { blockIndex, repairCodes } = body as { blockIndex: unknown; repairCodes: string[] };

    const bIndex = Number(blockIndex);
    if (blockIndex === undefined || blockIndex === null || isNaN(bIndex) || bIndex < 0 || bIndex > 2) {
      return NextResponse.json({ error: 'blockIndex debe ser 0, 1 o 2' }, { status: 400 });
    }
    if (!Array.isArray(repairCodes) || repairCodes.length === 0) {
      return NextResponse.json({ error: 'repairCodes es requerido' }, { status: 400 });
    }

    const planning = await getPlanningById(id);
    if (!planning) return NextResponse.json({ error: 'Planeación no encontrada' }, { status: 404 });
    if (planning.teacher_id !== teacher.id) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

    const workbook = await getBlockWorkbook(id, bIndex);
    if (!workbook) return NextResponse.json({ error: 'Libro de Bloque no encontrado' }, { status: 404 });

    const repairs: string[] = [];

    // ── S4: Normalizar pesos de rúbrica a 100% ─────────────────────────────
    // La rúbrica vive en workbook.evaluationSection.rubric (EvaluationRubricCriterion[])
    if (repairCodes.includes('S4_RUBRIC_WEIGHT_SUM_MISMATCH') || repairCodes.includes('S4_RUBRIC_LEVEL_MISSING')) {
      const rubric = workbook.evaluationSection?.rubric as EvaluationRubricCriterion[] | undefined;
      if (Array.isArray(rubric) && rubric.length > 0) {
        const validCriteria = rubric.filter((c) => typeof c.weightPercent === 'number' && c.weightPercent > 0);
        const weightSum = validCriteria.reduce((acc, c) => acc + c.weightPercent, 0);

        if (Math.abs(weightSum - 100) > 0.5 && weightSum > 0) {
          const factor = 100 / weightSum;
          let accumulated = 0;
          validCriteria.forEach((c, idx) => {
            if (idx < validCriteria.length - 1) {
              const normalized = Math.round(c.weightPercent * factor * 10) / 10;
              c.weightPercent = normalized;
              accumulated += normalized;
            } else {
              // Último criterio absorbe el redondeo para sumar exactamente 100
              c.weightPercent = Math.round((100 - accumulated) * 10) / 10;
            }
          });
          repairs.push(`S4: rúbrica normalizada de ${weightSum.toFixed(1)}% → 100% (${validCriteria.length} criterios)`);
        } else if (Math.abs(weightSum - 100) <= 0.5) {
          repairs.push('S4: rúbrica ya suma 100% — no requirió ajuste');
        }
      }
    }

    if (repairs.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No se aplicaron reparaciones. Verifica que el libro tenga los defectos indicados o que el código de reparación sea compatible.',
        repairs,
      });
    }

    // Persistir workbook reparado (incrementa versión automáticamente)
    const { version, success, error: saveError } = await saveBlockWorkbook(id, bIndex, workbook);
    if (!success) {
      logger.error('[PATCH /libro-bloque] Error persistiendo workbook reparado:', saveError);
      return NextResponse.json({ error: saveError || 'Error al guardar workbook reparado' }, { status: 500 });
    }

    logger.info(`[PATCH /libro-bloque] ${repairs.length} reparación(es) aplicadas en planning ${id} bloque ${bIndex} → v${version}`);
    return NextResponse.json({ success: true, version, repairs });
  } catch (error: unknown) {
    logger.error('[PATCH /api/planeaciones/[id]/libro-bloque] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al reparar libro de trabajo' },
      { status: 500 }
    );
  }
}

