import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail, getBlockWorkbook, sql } from '@/lib/db';
import { isAdmin } from '@/lib/admin-unified';
import { buildSacrintDeck, SACRINT_SLIDE_COUNT } from '@/lib/visual-engine/sacrint/spec';
import { renderDeckSvgs } from '@/lib/visual-engine/sacrint/slide-renderer';
import { generateSacrintPptx } from '@/lib/visual-engine/sacrint/sacrint-pptx-generator';
import { renderSvgToPng } from '@/lib/visual-engine/sacrint/sacrint-rasterizer';
import { SLIDE } from '@/lib/visual-engine/sacrint/tokens';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

function safeFilename(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50);
}

/**
 * GET /api/planeaciones/[id]/presentacion/sacrint?blockIndex=0&missionIndex=0&format=json|svg|png|pptx&slide=0
 *
 * Presentación SACRINT de 8 diapositivas por misión. Derivación pura del Libro
 * de Bloque, sin IA. `missionIndex` y `slide` son posiciones 0-based. PPTX
 * exporta el mazo completo de la misión con texto editable.
 */
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
    const blockIndex = parseInt(searchParams.get('blockIndex') || '0', 10);
    const missionPos = parseInt(searchParams.get('missionIndex') || '0', 10);
    const slidePos = parseInt(searchParams.get('slide') || '0', 10);
    const format = (searchParams.get('format') || 'json').toLowerCase();

    if (isNaN(blockIndex) || blockIndex < 0) {
      return NextResponse.json({ error: 'blockIndex inválido' }, { status: 400 });
    }
    if (isNaN(missionPos) || missionPos < 0) {
      return NextResponse.json({ error: 'missionIndex inválido' }, { status: 400 });
    }
    if (!['json', 'svg', 'png', 'pptx'].includes(format)) {
      return NextResponse.json({ error: 'format inválido (json | svg | png | pptx)' }, { status: 400 });
    }
    if ((format === 'svg' || format === 'png') && (isNaN(slidePos) || slidePos < 0 || slidePos >= SACRINT_SLIDE_COUNT)) {
      return NextResponse.json({ error: `slide inválido (0-${SACRINT_SLIDE_COUNT - 1})` }, { status: 400 });
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

    const workbook = await getBlockWorkbook(planningId, blockIndex);
    if (!workbook) {
      return NextResponse.json(
        {
          success: false,
          error: `El Libro de Bloque ${blockIndex + 1} aún no ha sido generado. Genera primero el libro para derivar la presentación.`,
        },
        { status: 404 }
      );
    }

    const missions = (workbook.missions ?? []).map((mission, position) => ({
      position,
      missionIndex: mission.missionIndex || position + 1,
      title: mission.title,
    }));
    if (missions.length === 0 || missionPos >= missions.length) {
      return NextResponse.json({ error: 'La misión solicitada no existe en este bloque' }, { status: 404 });
    }

    const deck = buildSacrintDeck(workbook, { missionIndex: missionPos });
    const pptxBaseName = `SACRINT_${safeFilename(deck.meta.subjectName)}_B${blockIndex + 1}_M${deck.meta.missionNumber}`;

    if (format === 'pptx') {
      const pptx = await generateSacrintPptx(deck);
      return new NextResponse(new Uint8Array(pptx), {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'Content-Disposition': `attachment; filename="${pptxBaseName}.pptx"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    const rendered = renderDeckSvgs(deck);

    if (format === 'json') {
      return NextResponse.json({
        success: true,
        blockIndex,
        missionIndex: missionPos,
        missions,
        width: SLIDE.width,
        height: SLIDE.height,
        deck: {
          meta: deck.meta,
          pack: deck.pack,
          slides: rendered.map(({ kind, filename }) => ({ kind, filename })),
        },
      });
    }

    const slide = rendered[slidePos];
    if (!slide) {
      return NextResponse.json({ error: 'La diapositiva solicitada no existe' }, { status: 404 });
    }

    if (format === 'svg') {
      return new NextResponse(slide.svg, {
        status: 200,
        headers: { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }

    const png = await renderSvgToPng(slide.svg, SLIDE.width, SLIDE.height);
    const baseName = `SACRINT_${safeFilename(deck.meta.subjectName)}_B${blockIndex + 1}_M${deck.meta.missionNumber}_${slide.kind}`;
    const disposition = searchParams.get('download') === '1' ? 'attachment' : 'inline';
    return new NextResponse(new Uint8Array(png), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `${disposition}; filename="${baseName}.png"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: unknown) {
    logger.error('[API /presentacion/sacrint] Error:', error);
    return NextResponse.json({ error: 'Error interno al generar la presentación SACRINT' }, { status: 500 });
  }
}
