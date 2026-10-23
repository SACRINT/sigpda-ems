import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import { auth } from '@/lib/auth';
import { getTeacherByEmail, getAllBlockWorkbooks, sql } from '@/lib/db';
import { isAdmin } from '@/lib/admin-unified';
import { buildInfographic } from '@/lib/visual-engine/infographic-generator';
import { infographicToPdf } from '@/lib/visual-engine/infographic-exporter';
import { logger } from '@/lib/logger';
import type { ActiveWorkTextbook } from '@/types/work-textbook';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id: planningId } = await params;
    const { searchParams } = new URL(request.url);
    const format = (searchParams.get('format') || 'pdf').toLowerCase();
    if (format !== 'pdf') {
      return NextResponse.json({ error: 'format inválido (pdf)' }, { status: 400 });
    }

    const db = sql();
    const planRows = await db`
      SELECT id, teacher_id, uac_name,
             content_json->'sectionI'->>'component' AS component
      FROM plannings
      WHERE id = ${planningId}::uuid
      LIMIT 1
    `;
    if (!planRows || planRows.length === 0) {
      return NextResponse.json({ error: 'Planeación no encontrada' }, { status: 404 });
    }

    const currentTeacher = await getTeacherByEmail(session.user.email);
    const isUserAdmin = await isAdmin(session.user.email);
    if (
      !isUserAdmin &&
      currentTeacher?.role !== 'supervisor' &&
      currentTeacher?.role !== 'director' &&
      planRows[0].teacher_id !== currentTeacher?.id
    ) {
      return NextResponse.json({ error: 'Acceso denegado a esta planeación' }, { status: 403 });
    }

    const workbooks = await getAllBlockWorkbooks(planningId);
    const entries = Object.entries(workbooks)
      .map(([key, value]) => {
        const match = /^block_(\d+)$/.exec(key);
        return match ? { blockIndex: Number(match[1]), workbook: value?.current } : null;
      })
      .filter((entry): entry is { blockIndex: number; workbook: ActiveWorkTextbook } =>
        Boolean(entry?.workbook)
      )
      .sort((a, b) => a.blockIndex - b.blockIndex);

    if (entries.length === 0) {
      return NextResponse.json(
        { error: 'Aún no hay Libros de Bloque generados para derivar las infografías.' },
        { status: 404 }
      );
    }

    const mergedPdf = await PDFDocument.create();
    let generatedCount = 0;

    for (const entry of entries) {
      const missions = entry.workbook.missions ?? [];
      for (let missionPos = 0; missionPos < missions.length; missionPos++) {
        try {
          const info = buildInfographic(entry.workbook, missionPos, {
            component: planRows[0].component ?? undefined,
          });
          if (!info) continue;
          const pdfBytes = await infographicToPdf(info);
          const individualPdf = await PDFDocument.load(pdfBytes);
          const pages = await mergedPdf.copyPages(individualPdf, individualPdf.getPageIndices());
          for (const page of pages) mergedPdf.addPage(page);
          generatedCount++;
        } catch (err) {
          logger.warn(`Error generando infografía del bloque ${entry.blockIndex + 1}, misión ${missionPos + 1}:`, {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    if (generatedCount === 0) {
      return NextResponse.json({ error: 'No se pudo generar ninguna infografía' }, { status: 500 });
    }

    const mergedBytes = await mergedPdf.save();
    const safeName = (planRows[0].uac_name || 'infografias')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 60);

    return new NextResponse(new Uint8Array(mergedBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Infografias_Todos_Bloques_${safeName}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: unknown) {
    logger.error('[API /infografia/combinada] Error:', error);
    return NextResponse.json({ error: 'Error interno al generar las infografías combinadas' }, { status: 500 });
  }
}
