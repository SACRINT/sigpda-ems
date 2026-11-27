import { NextRequest, NextResponse } from 'next/server';
import { shortSubjectCode } from '@/lib/short-filename';
import { auth } from '@/lib/auth';
import { getPlanningById, getBlockWorkbook, getTeacherByEmail } from '@/lib/db';
import { compileUnifiedEditorialPdf } from '@/lib/editorial/unified-editorial-compiler';
import { QuotaExceededError } from '@/lib/platform/usage-quota-guard';
import type { Planning } from '@/types/planning';

import { logger } from '@/lib/logger';
export const runtime = 'nodejs';
export const maxDuration = 90;

export async function GET(
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
    const url = new URL(request.url);
    const blockIndexParam = url.searchParams.get('blockIndex');

    if (blockIndexParam === null) {
      return NextResponse.json({ error: 'blockIndex query param es requerido' }, { status: 400 });
    }

    const blockIndex = parseInt(blockIndexParam, 10);
    const rawPlanning = await getPlanningById(id);

    if (!rawPlanning) {
      return NextResponse.json({ error: 'Planeación no encontrada' }, { status: 404 });
    }
    if (rawPlanning.teacher_id !== teacher.id) {
      return NextResponse.json({ error: 'No tienes permiso para acceder a esta planeación' }, { status: 403 });
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
      return NextResponse.json(
        { error: 'El libro de trabajo para este bloque aún no ha sido generado' },
        { status: 404 }
      );
    }

    const planning: Planning = {
      id: rawPlanning.id,
      teacherId: rawPlanning.teacher_id,
      uacName: rawPlanning.uac_name,
      semester: rawPlanning.semester,
      component: rawPlanning.component,
      curriculumName: rawPlanning.curriculum_name || '',
      paecContext: rawPlanning.paec_context || '',
      extractedData: rawPlanning.extracted_data,
      contentJson: rawPlanning.content_json,
      metodologiaActiva: rawPlanning.metodologia_activa || rawPlanning.content_json?.sectionI?.metodologiaActiva,
      status: rawPlanning.status,
      createdAt: rawPlanning.created_at,
      updatedAt: rawPlanning.updated_at,
    };

    const compiled = await compileUnifiedEditorialPdf({
      planningId: id,
      planning,
      blockIndex,
      workbooksMap: { [`block_${blockIndex}`]: { current: workbook } },
      fallbackWorkbook: workbook,
      teacherIdentity: {
        schoolName: teacher.school_name,
        cct: teacher.cct,
      },
      quotaContext: {
        teacherId: teacher.id,
        teacherEmail: session.user.email,
        idempotencyKey: request.headers.get('x-idempotency-key') || undefined,
      },
    });
    const pdfBuffer = compiled.pdfBuffer;
    const filename = `Libro_B${blockIndex + 1}_${shortSubjectCode(planning.uacName)}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Cache-Control': 'no-cache',
        'X-Editorial-Engine': compiled.engine,
      },
    });
  } catch (error: unknown) {
    if (error instanceof QuotaExceededError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        {
          status: error.statusCode,
          headers: error.retryAfterSeconds ? { 'Retry-After': String(error.retryAfterSeconds) } : undefined,
        }
      );
    }
    const message = error instanceof Error ? error.message : 'Error al descargar el libro PDF';
    logger.error('[GET /api/pdf/libro-bloque/[id]] Error:', error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
