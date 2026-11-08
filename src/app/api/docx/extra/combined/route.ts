import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  getTeacherByEmail,
  getPlanningById,
  getPlanningExtrasByType,
  getBlockWorkbook,
} from '@/lib/db';
import { buildCombinedExtraDocx } from '@/lib/docx-helpers';
import { isStructuredVisualPayload } from '@/lib/materials/material-tokens';
import { sanitizeDocFilename, type BrandingContext } from '@/lib/document-branding';
import { logger } from '@/lib/logger';
import { resolveBlockNumber } from '@/lib/curricular-blocks';
import { selectExtrasForBlock, selectAllExtrasCombined } from '@/lib/planning-extras-for-block';
import {
  mapExtraTypeToMaterialType,
  reviewBlockMaterials,
  type ReviewIssue,
} from '@/lib/guide-engine/material-review';
import type { GeneratedPlanningContent, SecuenciaBloque } from '@/types/planning';

export const runtime = 'nodejs';
export const maxDuration = 300;

/** Etiquetas conocidas de tipo → nombre de archivo. Cualquier otro tipo se acepta con fallback. */
const TYPE_LABELS: Record<string, string> = {
  rubric: 'Rubricas',
  checklist: 'Lista_de_Cotejo',
  material: 'Materiales_Docente',
  teacher_guide: 'Solucionarios',
  lesson_plan: 'Planes_de_Clase',
  practice_guide: 'Guias_de_Trabajo',
  visual: 'Recursos_Visuales',
};

function typeLabel(type: string): string {
  if (TYPE_LABELS[type]) return TYPE_LABELS[type];
  return sanitizeDocFilename(type.replace(/_/g, '-'), 40) || 'Documento';
}

export async function GET(request: NextRequest) {
  return handleCombinedDocx(request);
}

export async function POST(request: NextRequest) {
  return handleCombinedDocx(request);
}

async function handleCombinedDocx(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return new Response('No autorizado', { status: 401 });
    }

    const teacher = await getTeacherByEmail(session.user.email);
    if (!teacher) {
      return new Response('Docente no encontrado', { status: 404 });
    }

    let planningId: string | null = null;
    let type: string | undefined = undefined;
    let blockIndex: number | null = null;

    if (request.method === 'POST') {
      try {
        const body = await request.json();
        planningId = body.planningId || null;
        type = body.type;
        blockIndex = typeof body.blockIndex === 'number' ? body.blockIndex : null;
      } catch {
        // Ignorar
      }
    }

    if (!planningId) {
      planningId = request.nextUrl.searchParams.get('planningId');
      type = type || request.nextUrl.searchParams.get('type') || undefined;
    }
    if (blockIndex === null) {
      const bIdx = request.nextUrl.searchParams.get('blockIndex');
      if (bIdx !== null && bIdx !== '') {
        const parsed = parseInt(bIdx, 10);
        if (!Number.isNaN(parsed)) blockIndex = parsed;
      }
    }
    if (blockIndex !== null && (blockIndex < 0 || blockIndex > 2)) {
      return new Response('blockIndex inválido: debe ser 0, 1 o 2', { status: 400 });
    }

    const cleanType = (type || '').trim();
    if (!planningId || !cleanType) {
      return new Response('Parámetros insuficientes. Requiere planningId y type (cualquier tipo de extra).', {
        status: 400,
      });
    }

    const planning = await getPlanningById(planningId, teacher.id);
    if (!planning) {
      return new Response('Planeación no encontrada o no autorizada', { status: 404 });
    }

    const brandingCtx: BrandingContext = {
      schoolName: planning.extracted_data?.schoolName,
      cct: planning.extracted_data?.cct,
      semester: planning.semester,
    };

    // Todos los bloques del tipo solicitado, excluyendo payloads visuales JSON (no renderizables)
    const fetched = await getPlanningExtrasByType(planningId, teacher.id, cleanType);
    let allExtras = fetched.filter((ex) => !isStructuredVisualPayload(ex.content_text));

    // Descarga unificada de UN bloque o de TODOS los bloques:
    // filtrado determinista, deduplicación y orden numérico estricto de sesiones
    if (blockIndex !== null) {
      allExtras = selectExtrasForBlock(
        allExtras,
        planning.content_json as GeneratedPlanningContent | null,
        blockIndex,
        cleanType
      );
    } else {
      allExtras = selectAllExtrasCombined(
        allExtras,
        planning.content_json as GeneratedPlanningContent | null,
        cleanType
      );
    }

    if (allExtras.length === 0) {
      return new Response('No se encontraron documentos de este tipo para combinar', { status: 404 });
    }

    // Gate determinista R1 fail-closed
    const mType = mapExtraTypeToMaterialType(cleanType);
    const blockIndicesToCheck =
      blockIndex !== null
        ? [blockIndex]
        : Array.from(
            new Set(
              allExtras
                .map((ex) => {
                  const rawIdx = ex.key_index;
                  if (rawIdx === null || rawIdx === undefined) return null;
                  return resolveBlockNumber(rawIdx) !== null ? resolveBlockNumber(rawIdx)! - 1 : rawIdx;
                })
                .filter((idx): idx is number => typeof idx === 'number' && idx >= 0 && idx <= 2)
            )
          );

    const accumulatedErrors: ReviewIssue[] = [];
    const accumulatedWarnings: ReviewIssue[] = [];

    for (const bIdx of blockIndicesToCheck) {
      const workbook = await getBlockWorkbook(planningId, bIdx);
      if (!workbook) continue;
      const blockExtras =
        blockIndex !== null
          ? allExtras
          : allExtras.filter((ex) => {
              const rawIdx = ex.key_index;
              const cIdx =
                rawIdx !== null && rawIdx !== undefined
                  ? (resolveBlockNumber(rawIdx) !== null ? resolveBlockNumber(rawIdx)! - 1 : rawIdx)
                  : null;
              return cIdx === bIdx;
            });

      const rawSeq = planning.sequence_json as Record<string | number, SecuenciaBloque> | undefined;
      const blockSeq = rawSeq?.[bIdx] ?? rawSeq?.[String(bIdx)] ?? null;

      const review = reviewBlockMaterials({
        workbook,
        blockSequence: blockSeq,
        persistedExtras: blockExtras,
        checkFullBlockPersistence: false,
        checkLessonPlanCount: cleanType === 'lesson_plan',
        uacName: planning.uac_name,
        component: planning.component || '',
        curriculumName: planning.curriculum_name || '',
      });

      const scopedIssues = review.byMaterial[mType]?.issues ?? [];
      for (const issue of scopedIssues) {
        if (issue.severity === 'error') accumulatedErrors.push(issue);
        else accumulatedWarnings.push(issue);
      }
    }

    if (accumulatedErrors.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Material bloqueado por inconsistencia estructural',
          issues: accumulatedErrors,
        },
        { status: 422 }
      );
    }

    // UN SOLO .docx con todos los documentos separados por salto de página
    let docxBuffer: Buffer;
    try {
      const blockNum = blockIndex !== null ? (resolveBlockNumber(blockIndex) ?? blockIndex + 1) : null;
      const combinedTitle = blockNum !== null
        ? `${typeLabel(cleanType).replace(/_/g, ' ')} · Bloque ${blockNum} · ${allExtras.length} documentos`
        : undefined;
      docxBuffer = await buildCombinedExtraDocx(allExtras, brandingCtx, combinedTitle);
    } catch (err) {
      logger.error('Error construyendo DOCX combinado:', {
        error: err instanceof Error ? err.message : String(err),
      });
      return new Response('No se pudo generar el documento combinado', { status: 500 });
    }

    const cleanSubject = sanitizeDocFilename(planning.uac_name || 'UAC', 30);
    const fileName = blockIndex !== null
      ? `${typeLabel(cleanType)}_Bloque_${(resolveBlockNumber(blockIndex) ?? blockIndex + 1)}_${cleanSubject}.docx`
      : `${typeLabel(cleanType)}_Todos_Bloques_${cleanSubject}.docx`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    };
    if (accumulatedWarnings.length > 0) {
      headers['X-Material-Warnings'] = String(accumulatedWarnings.length);
    }

    return new Response(new Uint8Array(docxBuffer), {
      status: 200,
      headers,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    logger.error('Combined DOCX export error:', msg);
    return new Response(`Error: ${msg}`, { status: 500 });
  }
}
