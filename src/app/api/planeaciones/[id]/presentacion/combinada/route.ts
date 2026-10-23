import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail, getAllBlockWorkbooks, sql } from '@/lib/db';
import { isAdmin } from '@/lib/admin-unified';
import { buildSlideDeck, type SlideDeck } from '@/lib/presentation-engine/slide-model';
import { generatePptxBuffer } from '@/lib/presentation-engine/pptx-generator';
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
        { error: 'Aún no hay Libros de Bloque generados para derivar las presentaciones.' },
        { status: 404 }
      );
    }

    const decks = entries.map((entry) =>
      buildSlideDeck(entry.workbook, { component: planRows[0].component ?? undefined })
    );

    const slides = decks.flatMap((deck) =>
      deck.slides.map((slide) => ({ ...slide, blockNumber: deck.meta.blockNumber }))
    );

    const combinedDeck: SlideDeck = {
      meta: {
        ...decks[0].meta,
        title: `Presentación completa — ${decks[0].meta.subjectName}`,
        blockName: 'Todos los bloques',
      },
      palette: decks[0].palette,
      slides,
    };

    const buffer = await generatePptxBuffer(combinedDeck);
    const safeName = (combinedDeck.meta.subjectName || 'presentacion')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 60);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="Presentacion_Todos_Bloques_${safeName}.pptx"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: unknown) {
    logger.error('[API /presentacion/combinada] Error:', error);
    return NextResponse.json({ error: 'Error interno al generar la presentación combinada' }, { status: 500 });
  }
}
