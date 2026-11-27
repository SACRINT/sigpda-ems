import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail, getAllBlockWorkbooks, sql } from '@/lib/db';
import { isAdmin } from '@/lib/admin-unified';
import {
  buildSacrintInfographic,
  dedupeInfographicSpecs,
  selectInfographicTargets,
  type SacrintInfographicSpec,
} from '@/lib/visual-engine/sacrint/spec';
import { renderCombinedSacrintInfographicsPdf } from '@/lib/visual-engine/sacrint/sacrint-rasterizer';
import {
  createNodeSceneLoader,
  hydrateInfographicEditorialSceneViaUrl,
} from '@/lib/visual-engine/scene-allocator-node';
import { logger } from '@/lib/logger';
import { shortSubjectCode } from '@/lib/short-filename';
import type { ActiveWorkTextbook } from '@/types/work-textbook';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// El render combinado de infografías vectoriales puede superar los 120 s.
// Vercel corta la función con 504 si el límite coincide con el tiempo real de render.
export const maxDuration = 300;

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
      SELECT id, teacher_id, uac_name, curriculum_name,
             COALESCE(component, content_json->'sectionI'->>'component') AS component
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
    const blockIndexParam = searchParams.get('blockIndex');
    const targetBlock = blockIndexParam !== null ? parseInt(blockIndexParam, 10) : null;
    // Restringir canónicamente a los 3 Cortes MCCEMS (0, 1, 2)
    const validBlockIndices = new Set([0, 1, 2]);
    const canonicalEntries = entries.filter((e) => validBlockIndices.has(e.blockIndex));
    const effectiveEntries = (targetBlock !== null && !isNaN(targetBlock))
      ? entries.filter((e) => e.blockIndex === targetBlock)
      : (canonicalEntries.length > 0 ? canonicalEntries : entries.slice(0, 3));

    if (effectiveEntries.length === 0) {
      return NextResponse.json(
        { error: `No se encontraron infografías para el bloque ${targetBlock !== null ? targetBlock + 1 : ''}` },
        { status: 404 }
      );
    }

    const specs: SacrintInfographicSpec[] = [];
    const sceneLoader = createNodeSceneLoader();
    const reqOrigin = new URL(request.url).origin;

    for (const entry of effectiveEntries) {
      for (const target of selectInfographicTargets(entry.workbook)) {
        try {
          const rawSpec = buildSacrintInfographic(entry.workbook, layout, {
            missionIndex: target.missionIndex,
            sessionIndex: target.sessionIndex,
            ...sceneLoader,
          });
          const spec = await hydrateInfographicEditorialSceneViaUrl(rawSpec, reqOrigin);
          specs.push(spec);
        } catch (err) {
          logger.warn(
            `Error generando infografía SACRINT del bloque ${entry.blockIndex + 1}, misión ${target.missionIndex + 1}, sesión ${target.sessionIndex + 1}:`,
            { error: err instanceof Error ? err.message : String(err) }
          );
        }
      }
    }

    const dedupedSpecs = dedupeInfographicSpecs(specs);
    if (dedupedSpecs.length === 0) {
      return NextResponse.json({ error: 'No se pudo generar ninguna infografía' }, { status: 500 });
    }

    const mergedBytes = await renderCombinedSacrintInfographicsPdf(dedupedSpecs, layout);
    const safeName = shortSubjectCode(planRows[0].uac_name || 'infografias');

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
