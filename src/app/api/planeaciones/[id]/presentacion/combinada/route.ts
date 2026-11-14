import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail, getAllBlockWorkbooks, sql } from '@/lib/db';
import { isAdmin } from '@/lib/admin-unified';
import { buildSacrintDecksForWorkbook, type SacrintDeckMode, type SacrintDeckSpec } from '@/lib/visual-engine/sacrint/spec';
import { generateCombinedSacrintPptx } from '@/lib/visual-engine/sacrint/sacrint-pptx-generator';
import { reviewBlockMaterials, type ReviewIssue } from '@/lib/guide-engine/material-review';
import { logger } from '@/lib/logger';
import type { ActiveWorkTextbook } from '@/types/work-textbook';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

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

    const { searchParams } = new URL(request.url);
    const modeParam = searchParams.get('mode');
    const deckMode: SacrintDeckMode =
      modeParam === 'full' ? 'full' : modeParam === 'classroom' ? 'classroom' : 'lesson-guide';

    // Restringir canónicamente a los 3 Cortes MCCEMS (0, 1, 2)
    const validBlockIndices = new Set([0, 1, 2]);
    const canonicalEntries = entries.filter((e) => validBlockIndices.has(e.blockIndex));
    const effectiveEntries = canonicalEntries.length > 0 ? canonicalEntries : entries.slice(0, 3);

    const sacrintDecks: SacrintDeckSpec[] = [];
    const deckErrors: ReviewIssue[] = [];
    const deckWarnings: ReviewIssue[] = [];

    for (const entry of effectiveEntries) {
      const entryDecks = buildSacrintDecksForWorkbook(entry.workbook, { mode: deckMode });
      for (const deck of entryDecks) {
        sacrintDecks.push(deck);
        const review = reviewBlockMaterials({
          workbook: entry.workbook,
          deck,
          uacName: planRows[0].uac_name,
          component: planRows[0].component || '',
          checkFullBlockPersistence: false,
        });
        const issues = review.byMaterial.deck.issues;
        deckErrors.push(...issues.filter((i) => i.severity === 'error'));
        deckWarnings.push(...issues.filter((i) => i.severity === 'warning'));
      }
    }

    if (deckErrors.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Material bloqueado por inconsistencia estructural',
          issues: deckErrors,
        },
        { status: 422 }
      );
    }

    const warningHeaders: Record<string, string> =
      deckWarnings.length > 0
        ? { 'X-Material-Warnings': String(deckWarnings.length) }
        : {};

    const subjectName = sacrintDecks[0]?.meta.subjectName || planRows[0].uac_name || 'presentacion';
    const buffer = await generateCombinedSacrintPptx(sacrintDecks, {
      title: `Presentación SACRINT completa — ${subjectName}`,
      subjectName,
    });
    const safeName = subjectName
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
        ...warningHeaders,
      },
    });
  } catch (error: unknown) {
    logger.error('[API /presentacion/combinada] Error:', error);
    return NextResponse.json({ error: 'Error interno al generar la presentación combinada' }, { status: 500 });
  }
}
