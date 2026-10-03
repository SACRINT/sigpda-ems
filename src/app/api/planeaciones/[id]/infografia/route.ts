import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail, getBlockWorkbook, sql } from '@/lib/db';
import { isAdmin } from '@/lib/admin-unified';
import { buildInfographic } from '@/lib/visual-engine/infographic-generator';
import { infographicToPng, infographicToPdf } from '@/lib/visual-engine/infographic-exporter';
import { logger } from '@/lib/logger';

/**
 * GET /api/planeaciones/[id]/infografia?blockIndex=0&missionIndex=0&format=json|svg|png|pdf
 *
 * - format=json (default): lista de misiones disponibles del bloque.
 * - svg | png | pdf: infografía de la misión (missionIndex es la posición 0-based en el libro).
 * Derivación pura del Libro de Bloque (0 tokens de IA).
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
    const format = (searchParams.get('format') || 'json').toLowerCase();

    if (isNaN(blockIndex) || blockIndex < 0) {
      return NextResponse.json({ error: 'blockIndex inválido' }, { status: 400 });
    }
    if (isNaN(missionPos) || missionPos < 0) {
      return NextResponse.json({ error: 'missionIndex inválido' }, { status: 400 });
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

    if (format === 'json') {
      return NextResponse.json({
        success: true,
        blockIndex,
        missions: (workbook.missions ?? []).map((m, i) => ({
          position: i,
          missionIndex: m.missionIndex || i + 1,
          title: m.title,
        })),
      });
    }

    const info = buildInfographic(workbook, missionPos, { component: planRows[0].component ?? undefined });
    if (!info) {
      return NextResponse.json({ error: 'La misión solicitada no existe en este bloque' }, { status: 404 });
    }

    const baseName = `Infografia_Bloque_${blockIndex + 1}_Mision_${info.missionIndex}`;

    if (format === 'svg') {
      return new NextResponse(info.svg, {
        status: 200,
        headers: { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }
    if (format === 'png') {
      const png = await infographicToPng(info);
      return new NextResponse(new Uint8Array(png), {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
          'Content-Disposition': `attachment; filename="${baseName}.png"`,
          'Cache-Control': 'no-store',
        },
      });
    }
    const pdf = await infographicToPdf(info);
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${baseName}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: unknown) {
    logger.error('[API /infografia] Error:', error);
    return NextResponse.json({ error: 'Error interno al generar la infografía' }, { status: 500 });
  }
}
