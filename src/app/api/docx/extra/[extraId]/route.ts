import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  getTeacherByEmail,
  getPlanningById,
  getPlanningExtraById,
  getBlockWorkbook,
} from '@/lib/db';
import { buildExtraDocx } from '@/lib/docx-helpers';
import { sanitizeDocFilenameWithBlock } from '@/lib/document-branding';
import { resolveBlockNumber } from '@/lib/curricular-blocks';
import {
  mapExtraTypeToMaterialType,
  reviewBlockMaterials,
  type ReviewIssue,
} from '@/lib/guide-engine/material-review';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ extraId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return new Response('No autorizado', { status: 401 });
    }

    const teacher = await getTeacherByEmail(session.user.email);
    if (!teacher) {
      return new Response('Docente no encontrado', { status: 404 });
    }

    const { extraId } = await params;
    const extra = await getPlanningExtraById(extraId, teacher.id);
    if (!extra) {
      return new Response('Recurso no encontrado', { status: 404 });
    }

    // Gate determinista R1 fail-closed
    let warningCount = 0;
    const rawKeyIdx = extra.key_index ?? extra.keyIndex ?? null;
    const canonicalBlockIdx =
      rawKeyIdx !== null && rawKeyIdx !== undefined
        ? (resolveBlockNumber(rawKeyIdx) !== null ? resolveBlockNumber(rawKeyIdx)! - 1 : rawKeyIdx)
        : null;

    if (extra.planning_id && canonicalBlockIdx !== null && canonicalBlockIdx >= 0) {
      const [workbook, planning] = await Promise.all([
        getBlockWorkbook(extra.planning_id, canonicalBlockIdx),
        getPlanningById(extra.planning_id, teacher.id).catch(() => null),
      ]);
      if (workbook) {
        const mType = mapExtraTypeToMaterialType(extra.type, extra.content_text, extra.title);
        const review = reviewBlockMaterials({
          workbook,
          persistedExtras: [extra],
          checkFullBlockPersistence: false,
          uacName: planning?.uac_name || workbook.coverData?.subjectName || '',
          component: planning?.component || '',
          curriculumName: planning?.curriculum_name || '',
        });
        const scopedIssues: ReviewIssue[] = review.byMaterial[mType]?.issues ?? [];
        const scopedErrors = scopedIssues.filter((i) => i.severity === 'error');
        const scopedWarnings = scopedIssues.filter((i) => i.severity === 'warning');
        if (scopedErrors.length > 0) {
          return NextResponse.json(
            {
              ok: false,
              error: 'Material bloqueado por inconsistencia estructural',
              issues: scopedErrors,
            },
            { status: 422 }
          );
        }
        warningCount = scopedWarnings.length;
      }
    }

    const buffer = await buildExtraDocx(extra);
    const safeFilename = sanitizeDocFilenameWithBlock(extra.title, 70);

    const headers: Record<string, string> = {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${safeFilename}.docx"`,
    };
    if (warningCount > 0) {
      headers['X-Material-Warnings'] = String(warningCount);
    }

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    logger.error('Export docx extra error:', msg);
    return new Response(`Error: ${msg}`, { status: 500 });
  }
}
