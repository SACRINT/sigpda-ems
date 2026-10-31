import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail, getAllBlockWorkbooks, sql } from '@/lib/db';
import { isAdmin } from '@/lib/admin-unified';
import { buildSacrintInfographic, type SacrintInfographicSpec } from '@/lib/visual-engine/sacrint/spec';
import { renderCombinedSacrintInfographicsPdf } from '@/lib/visual-engine/sacrint/sacrint-rasterizer';
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

    const layoutParam = (searchParams.get('layout') || 'wide').toLowerCase();
    const layout = layoutParam === 'letter' ? 'letter' : 'wide';
    const specs: SacrintInfographicSpec[] = [];

    for (const entry of entries) {
      const missionCount = Math.max(1, (entry.workbook.missions ?? []).length);
      for (let missionPos = 0; missionPos < missionCount; missionPos++) {
        try {
          const spec = buildSacrintInfographic(entry.workbook, layout, { missionIndex: missionPos });
          specs.push(spec);
        } catch (err) {
          logger.warn(`Error generando infografía SACRINT del bloque ${entry.blockIndex + 1}, misión ${missionPos + 1}:`, {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    if (specs.length === 0) {
      return NextResponse.json({ error: 'No se pudo generar ninguna infografía' }, { status: 500 });
    }

    const mergedBytes = await renderCombinedSacrintInfographicsPdf(specs, layout);
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
