import { NextRequest, NextResponse } from 'next/server';
import { jsPDF } from 'jspdf';
import { auth } from '@/lib/auth';
import { getTeacherByEmail, getBlockWorkbook, sql } from '@/lib/db';
import { isAdmin } from '@/lib/admin-unified';
import { buildSacrintInfographic, type SacrintInfographicFormat } from '@/lib/visual-engine/sacrint/spec';
import { renderInfographicSvg } from '@/lib/visual-engine/sacrint/infographic-renderer';
import { renderInfographicPng } from '@/lib/visual-engine/sacrint/sacrint-rasterizer';
import { INFOGRAPHIC } from '@/lib/visual-engine/sacrint/tokens';
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
 * GET /api/planeaciones/[id]/infografia/sacrint?blockIndex=0&missionIndex=0&layout=letter|wide&format=json|svg|png|pdf
 *
 * Infografía SACRINT por misión. `missionIndex` es 0-based. `layout=letter`
 * produce Carta vertical 1275x1650; `layout=wide` produce 16:9 2752x1536.
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
    const layout = (searchParams.get('layout') || 'letter').toLowerCase();
    const format = (searchParams.get('format') || 'json').toLowerCase();

    if (isNaN(blockIndex) || blockIndex < 0) {
      return NextResponse.json({ error: 'blockIndex inválido' }, { status: 400 });
    }
    if (isNaN(missionPos) || missionPos < 0) {
      return NextResponse.json({ error: 'missionIndex inválido' }, { status: 400 });
    }
    if (layout !== 'letter' && layout !== 'wide') {
      return NextResponse.json({ error: 'layout inválido (letter | wide)' }, { status: 400 });
    }
    if (!['json', 'svg', 'png', 'pdf'].includes(format)) {
      return NextResponse.json({ error: 'format inválido (json | svg | png | pdf)' }, { status: 400 });
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
          error: `El Libro de Bloque ${blockIndex + 1} aún no ha sido generado. Genera primero el libro para derivar las infografías.`,
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

    const size = INFOGRAPHIC[layout];
    if (format === 'json') {
      return NextResponse.json({
        success: true,
        blockIndex,
        missionIndex: missionPos,
        layout,
        width: size.width,
        height: size.height,
        missions,
      });
    }

    const spec = buildSacrintInfographic(workbook, layout as SacrintInfographicFormat, {
      missionIndex: missionPos,
    });
    const baseName = `SACRINT_Infografia_${safeFilename(spec.meta.subjectName)}_B${blockIndex + 1}_M${spec.meta.missionNumber}_${layout}`;

    if (format === 'svg') {
      return new NextResponse(renderInfographicSvg(spec), {
        status: 200,
        headers: { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }

    const pdfScale = format === 'pdf' ? 2 : 1;
    const png = await renderInfographicPng(spec, pdfScale);
    const disposition = searchParams.get('download') === '1' ? 'attachment' : 'inline';
    if (format === 'png') {
      return new NextResponse(new Uint8Array(png.buffer), {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
          'Content-Disposition': `${disposition}; filename="${baseName}.png"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    const doc = new jsPDF({
      unit: 'in',
      format: layout === 'wide' ? [11, 6.1875] : [8.5, 11],
      orientation: layout === 'wide' ? 'landscape' : 'portrait',
      compress: true,
    });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    doc.setProperties({ title: spec.title });
    doc.addImage(`data:image/png;base64,${png.buffer.toString('base64')}`, 'PNG', 0, 0, pageW, pageH, undefined, 'FAST');
    const pdf = Buffer.from(doc.output('arraybuffer'));

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${disposition}; filename="${baseName}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: unknown) {
    logger.error('[API /infografia/sacrint] Error:', error);
    return NextResponse.json({ error: 'Error interno al generar la infografía SACRINT' }, { status: 500 });
  }
}
