import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail, getBlockWorkbook, sql } from '@/lib/db';
import { isAdmin } from '@/lib/admin-unified';
import { buildSlideDeck } from '@/lib/presentation-engine/slide-model';
import { generatePptxBuffer } from '@/lib/presentation-engine/pptx-generator';
import { logger } from '@/lib/logger';

/**
 * GET /api/planeaciones/[id]/presentacion?blockIndex=0&format=pptx|json
 *
 * Deriva determinísticamente (0 tokens de IA) la presentación electrónica del Libro de Bloque.
 * - format=pptx (default): descarga el archivo PowerPoint.
 * - format=json: devuelve el modelo de diapositivas para el visor web.
 * Al ser derivación pura del libro, es idempotente por construcción (no duplica registros).
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
    const format = (searchParams.get('format') || 'pptx').toLowerCase();

    if (isNaN(blockIndex) || blockIndex < 0) {
      return NextResponse.json({ error: 'blockIndex inválido' }, { status: 400 });
    }
    if (format !== 'pptx' && format !== 'json') {
      return NextResponse.json({ error: 'format inválido (pptx | json)' }, { status: 400 });
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

    const deck = buildSlideDeck(workbook, { component: planRows[0].component ?? undefined });

    if (format === 'json') {
      return NextResponse.json({ success: true, blockIndex, deck });
    }

    const buffer = await generatePptxBuffer(deck);
    const safeName = (deck.meta.subjectName || 'presentacion')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 60);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="Presentacion_${safeName}_Bloque_${blockIndex + 1}.pptx"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: unknown) {
    logger.error('[API /presentacion] Error:', error);
    return NextResponse.json({ error: 'Error interno al generar la presentación' }, { status: 500 });
  }
}
