import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';
import { auth } from '@/lib/auth';
import {
  getTeacherByEmail,
  getPlanningById,
  getPlanningExtras,
  getPlanningExtrasByBlock,
  getPlanningExtrasByIds,
  getBlockWorkbook,
  getAllBlockWorkbooks,
} from '@/lib/db';
import { generateExtraPdfDocument } from '@/lib/pdf-extra-renderer';
import { generatePlanningPDF, generateSecuenciaPDF } from '@/lib/planning-pdf-renderer';
import { compileSemestralWorkbook } from '@/lib/master-workbook-compiler';
import {
  buildSacrintDecksForWorkbook,
  buildSacrintInfographic,
  type SacrintDeckSpec,
  type SacrintInfographicSpec,
} from '@/lib/visual-engine/sacrint/spec';
import { generateCombinedSacrintPptx } from '@/lib/visual-engine/sacrint/sacrint-pptx-generator';
import { renderCombinedSacrintInfographicsPdf } from '@/lib/visual-engine/sacrint/sacrint-rasterizer';
import { isStructuredVisualPayload } from '@/lib/materials/material-tokens';
import { sanitizeDocFilename, sanitizeDocFilenameWithBlock, type BrandingContext } from '@/lib/document-branding';
import { resolveBlockNumber, resolveCurricularBlocks } from '@/lib/curricular-blocks';
import { selectExtrasForBlock, selectAllExtrasCombined } from '@/lib/planning-extras-for-block';
import type { GeneratedPlanningContent, Planning, SecuenciaBloque } from '@/types/planning';
import type { ActiveWorkTextbook } from '@/types/work-textbook';
import {
  mapExtraTypeToMaterialType,
  reviewBlockMaterials,
  type MaterialType,
  type ReviewIssue,
} from '@/lib/guide-engine/material-review';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const maxDuration = 300;

async function mergeExtrasToPdf(
  items: Array<{ id: string; key_index: number | null; content_text: string; title: string; type: string }>,
  brandingCtx?: BrandingContext
): Promise<Buffer | null> {
  if (!items || items.length === 0) return null;
  try {
    const mergedPdf = await PDFDocument.create();
    let count = 0;
    for (const extra of items) {
      try {
        const canonicalKeyIndex =
          extra.key_index !== null && extra.key_index !== undefined
            ? resolveBlockNumber(extra.key_index) !== null
              ? resolveBlockNumber(extra.key_index)! - 1
              : extra.key_index
            : null;
        const pdfDoc = generateExtraPdfDocument({ ...extra, keyIndex: canonicalKeyIndex }, brandingCtx);
        const bytes = Buffer.from(pdfDoc.output('arraybuffer'));
        const indPdf = await PDFDocument.load(bytes);
        const pages = await mergedPdf.copyPages(indPdf, indPdf.getPageIndices());
        for (const page of pages) {
          mergedPdf.addPage(page);
        }
        count++;
      } catch (err) {
        logger.warn(`Error rendering individual PDF for extra ${extra.id}:`, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    if (count === 0) return null;
    const mergedBytes = await mergedPdf.save();
    return Buffer.from(mergedBytes);
  } catch (err) {
    logger.warn('Error merging extras to PDF:', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

export async function GET(request: NextRequest) {
  return handleBulkPdf(request);
}

export async function POST(request: NextRequest) {
  return handleBulkPdf(request);
}

async function handleBulkPdf(request: NextRequest) {
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
    let blockIndex: number | null = null;
    let type: string | undefined = undefined;
    let extraIds: string[] | undefined = undefined;
    let mode: string | undefined = undefined;

    if (request.method === 'POST') {
      try {
        const body = await request.json();
        planningId = body.planningId || null;
        blockIndex = typeof body.blockIndex === 'number' ? body.blockIndex : null;
        type = body.type;
        extraIds = Array.isArray(body.extraIds) ? body.extraIds : undefined;
        mode = body.mode;
      } catch {
        // Ignorar error si no hay JSON válido
      }
    }

    if (!planningId && !extraIds) {
      const searchParams = request.nextUrl.searchParams;
      planningId = searchParams.get('planningId');
      const bIdx = searchParams.get('blockIndex');
      if (bIdx !== null && bIdx !== '') {
        blockIndex = parseInt(bIdx, 10);
      }
      type = searchParams.get('type') || undefined;
      const idsParam = searchParams.get('extraIds');
      if (idsParam) {
        extraIds = idsParam.split(',').filter(Boolean);
      }
      mode = searchParams.get('mode') || undefined;
    }

    let extras: Array<{ id: string; planning_id: string; type: string; title: string; key_index: number | null; content_text: string }> = [];
    let brandingCtx: BrandingContext | undefined = undefined;
    let zipName = 'Materiales_Educativos_PDF.zip';
    let planning: Awaited<ReturnType<typeof getPlanningById>> | null = null;

    if (extraIds && extraIds.length > 0) {
      extras = await getPlanningExtrasByIds(extraIds, teacher.id);
    } else if (planningId && blockIndex !== null && !isNaN(blockIndex)) {
      planning = await getPlanningById(planningId, teacher.id);
      if (!planning) {
        return new Response('Planeación no encontrada o no autorizada', { status: 404 });
      }

      brandingCtx = {
        schoolName: planning.extracted_data?.schoolName,
        cct: planning.extracted_data?.cct,
        semester: planning.semester,
      };

      extras = await getPlanningExtrasByBlock(planningId, blockIndex, teacher.id, type);
      const blockNum = resolveBlockNumber(blockIndex) ?? (blockIndex + 1);
      const typeLabelStr = type === 'lesson_plan' ? 'Planes_de_Clase' : 'Materiales';
      const cleanSubject = sanitizeDocFilename(planning.uac_name || 'UAC', 30);
      zipName = `${typeLabelStr}_Bloque_${blockNum}_${cleanSubject}_PDF.zip`;
    } else if (planningId) {
      planning = await getPlanningById(planningId, teacher.id);
      if (!planning) {
        return new Response('Planeación no encontrada o no autorizada', { status: 404 });
      }

      brandingCtx = {
        schoolName: planning.extracted_data?.schoolName,
        cct: planning.extracted_data?.cct,
        semester: planning.semester,
      };

      extras = await getPlanningExtras(planningId, teacher.id);
      const cleanSubject = sanitizeDocFilename(planning.uac_name || 'UAC', 30);
      zipName = `Paquete_Entregables_${cleanSubject}_PDF.zip`;
    } else {
      return new Response('Parámetros insuficientes (requiere planningId o extraIds)', { status: 400 });
    }

    // Excluir payloads visuales JSON (recursos gráficos almacenados como content_text)
    extras = extras.filter((item) => !isStructuredVisualPayload(item.content_text));

    // Si la descarga es por bloque y por tipo (e.g. lesson_plan), aplicar selección determinista y deduplicación
    if (planningId && blockIndex !== null && !isNaN(blockIndex) && type) {
      const planContent = (await getPlanningById(planningId, teacher.id).catch(() => null))?.content_json as GeneratedPlanningContent | null;
      extras = selectExtrasForBlock(extras, planContent, blockIndex, type);
    }

    const isMasterPackage = Boolean(
      planningId &&
      (blockIndex === null || isNaN(blockIndex)) &&
      (!extraIds || extraIds.length === 0) &&
      !type &&
      mode !== 'individual'
    );

    if (!isMasterPackage && extras.length === 0) {
      return new Response('No se encontraron materiales para empaquetar', { status: 404 });
    }

    // Gate determinista R1 fail-closed (agrupado por bloque canónico para soportar extraIds multi-bloque)
    let warningCount = 0;
    const resolvedPlanId = planningId || extras[0]?.planning_id;

    if (resolvedPlanId) {
      const planningForReview = planning || (await getPlanningById(resolvedPlanId, teacher.id).catch(() => null));
      const isFullSuite = !type && (!extraIds || extraIds.length === 0);

      const extrasByBlock = new Map<number, typeof extras>();
      let unresolvedBlockExtras = 0;
      for (const item of extras) {
        const rawIdx =
          blockIndex !== null && !isNaN(blockIndex)
            ? blockIndex
            : item.key_index ?? null;
        const cIdx =
          rawIdx !== null && rawIdx !== undefined
            ? (resolveBlockNumber(rawIdx) !== null ? resolveBlockNumber(rawIdx)! - 1 : rawIdx)
            : null;
        if (cIdx !== null && cIdx >= 0) {
          const group = extrasByBlock.get(cIdx) || [];
          group.push(item);
          extrasByBlock.set(cIdx, group);
        } else {
          unresolvedBlockExtras++;
        }
      }

      const accumulatedErrors: ReviewIssue[] = [];
      const accumulatedWarnings: ReviewIssue[] = [];
      if (unresolvedBlockExtras > 0) {
        accumulatedWarnings.push({
          code: 'W0_UNRESOLVED_BLOCK',
          material: 'lesson_plan',
          severity: 'warning',
          message: `${unresolvedBlockExtras} extra(s) sin bloque canónico resoluble quedaron fuera del gate R1; se generaron sin validación de truncamiento.`,
        });
      }

      for (const [bIdx, blockExtras] of extrasByBlock.entries()) {
        const groupPlanId = blockExtras[0]?.planning_id || resolvedPlanId;
        const workbook = await getBlockWorkbook(groupPlanId, bIdx);
        if (!workbook) continue;

        const rawSeq = planningForReview?.sequence_json as Record<string | number, SecuenciaBloque> | undefined;
        const blockSeq = rawSeq?.[bIdx] ?? rawSeq?.[String(bIdx)] ?? null;

        const review = reviewBlockMaterials({
          workbook,
          blockSequence: blockSeq,
          persistedExtras: blockExtras,
          checkFullBlockPersistence: isFullSuite,
          checkLessonPlanCount: isFullSuite || type === 'lesson_plan',
          uacName: planningForReview?.uac_name || workbook.coverData?.subjectName || '',
          component: planningForReview?.component || '',
          curriculumName: planningForReview?.curriculum_name || '',
        });

        const scopedTypes = new Set<MaterialType>(
          type
            ? [mapExtraTypeToMaterialType(type)]
            : blockExtras.map((e) => mapExtraTypeToMaterialType(e.type, e.content_text, e.title))
        );
        const scopedIssues: ReviewIssue[] = review.issues.filter((i) => scopedTypes.has(i.material));
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
      warningCount = accumulatedWarnings.length;
    }

    const zip = new JSZip();

    // RAMA 1: PAQUETE MASTER CONSOLIDADO DE LA PLANEACIÓN (9 Entregables Compilados en 1 Solo Archivo Cada Uno)
    if (isMasterPackage && planning) {
      const cleanSubject = sanitizeDocFilename(planning.uac_name || 'UAC', 30);
      const contentJson = planning.content_json as GeneratedPlanningContent | null;
      const planningObj: Planning = {
        id: planning.id,
        teacherId: planning.teacher_id,
        uacName: planning.uac_name,
        semester: planning.semester,
        component: planning.component,
        curriculumName: planning.curriculum_name || '',
        paecContext: planning.paec_context || '',
        extractedData: planning.extracted_data,
        contentJson: planning.content_json,
        metodologiaActiva: (planning as unknown as { metodologia_activa?: string }).metodologia_activa || undefined,
        sequenceJson: (planning as unknown as { sequence_json?: Record<number, SecuenciaBloque> }).sequence_json || null,
        workbooksJson: (planning as unknown as { workbooks_json?: Record<string, { current?: ActiveWorkTextbook }> }).workbooks_json || null,
        status: planning.status,
        createdAt: planning.created_at,
        updatedAt: planning.updated_at,
      };

      // 1. Planeación Didáctica Semestral (PDF)
      if (contentJson) {
        try {
          const jsDoc = await generatePlanningPDF(planningObj);
          const pdfBuf = Buffer.from(jsDoc.output('arraybuffer'));
          zip.file(`01_Planeacion_Didactica_Semestral_${cleanSubject}.pdf`, pdfBuf);
        } catch (err) {
          logger.warn('Error packaging Planeacion Didactica PDF for bulk zip:', { error: err });
        }
      }

      // 2. Secuencia Didáctica (PDF)
      const rawSequenceJson = (planning as unknown as { sequence_json?: Record<number, SecuenciaBloque> }).sequence_json;
      if (contentJson && rawSequenceJson) {
        try {
          const jsDoc = await generateSecuenciaPDF(planningObj);
          const pdfBuf = Buffer.from(jsDoc.output('arraybuffer'));
          zip.file(`02_Secuencia_Didactica_${cleanSubject}.pdf`, pdfBuf);
        } catch (err) {
          logger.warn('Error packaging Secuencia Didactica PDF for bulk zip:', { error: err });
        }
      }

      // 3. Planes de Clase (50 min) — Todas las sesiones compiladas en 1 solo PDF
      const lessonPlans = selectAllExtrasCombined(
        extras.filter((e) => e.type === 'lesson_plan'),
        contentJson,
        'lesson_plan'
      );
      if (lessonPlans.length > 0) {
        const pdfBuf = await mergeExtrasToPdf(lessonPlans, brandingCtx);
        if (pdfBuf) {
          zip.file(`03_Planes_de_Clase_Compilado_${cleanSubject}.pdf`, pdfBuf);
        }
      }

      // 4. Solucionario Docente — Todos los bloques compilados en 1 solo PDF
      const teacherGuides = selectAllExtrasCombined(
        extras.filter((e) => e.type === 'teacher_guide'),
        contentJson,
        'teacher_guide'
      );
      if (teacherGuides.length > 0) {
        const pdfBuf = await mergeExtrasToPdf(teacherGuides, brandingCtx);
        if (pdfBuf) {
          zip.file(`04_Solucionario_Docente_Compilado_${cleanSubject}.pdf`, pdfBuf);
        }
      }

      // 5. Guías de Práctica — Todos los bloques compilados en 1 solo PDF
      const practiceGuides = selectAllExtrasCombined(
        extras.filter((e) => e.type === 'practice_guide'),
        contentJson,
        'practice_guide'
      );
      if (practiceGuides.length > 0) {
        const pdfBuf = await mergeExtrasToPdf(practiceGuides, brandingCtx);
        if (pdfBuf) {
          zip.file(`05_Guias_de_Practica_Compilado_${cleanSubject}.pdf`, pdfBuf);
        }
      }

      // 6. Libro de Texto Semestral Consolidado (PDF)
      try {
        const { pdf } = await compileSemestralWorkbook(planning.id, planningObj, { format: 'pdf' });
        if (pdf) {
          zip.file(`06_Libro_de_Texto_Semestral_Consolidado_${cleanSubject}.pdf`, pdf);
        }
      } catch (err) {
        logger.warn('Error compiling Semestral Workbook PDF for bulk zip:', { error: err });
      }

      // 7. Instrumentos de Evaluación Formativa y Sumativa — Todos los bloques compilados en 1 solo PDF
      const evalBlocks = resolveCurricularBlocks(contentJson);
      const evalBlockList = evalBlocks && evalBlocks.length > 0 ? evalBlocks : [{ blockIndex: 0 }, { blockIndex: 1 }, { blockIndex: 2 }];
      const combinedEvalExtras: typeof extras = [];
      for (const b of evalBlockList) {
        const bRubrics = selectExtrasForBlock(extras.filter((e) => e.type === 'rubric'), contentJson, b.blockIndex, 'rubric');
        const bChecklists = selectExtrasForBlock(extras.filter((e) => e.type === 'checklist'), contentJson, b.blockIndex, 'checklist');
        const bOthers = extras.filter((e) =>
          ['scale', 'observation_guide', 'portfolio', 'exam'].includes(e.type) ||
          e.type.startsWith('evaluation') ||
          e.type.startsWith('instrument')
        ).filter((e) => e.key_index === b.blockIndex);
        combinedEvalExtras.push(...bRubrics, ...bChecklists, ...bOthers);
      }
      const seenEvalIds = new Set(combinedEvalExtras.map((e) => e.id));
      for (const e of extras) {
        if (!seenEvalIds.has(e.id) && (['rubric', 'checklist', 'scale', 'observation_guide', 'portfolio', 'exam'].includes(e.type) || e.type.startsWith('evaluation') || e.type.startsWith('instrument'))) {
          combinedEvalExtras.push(e);
        }
      }

      if (combinedEvalExtras.length > 0) {
        const pdfBuf = await mergeExtrasToPdf(combinedEvalExtras, brandingCtx);
        if (pdfBuf) {
          zip.file(`07_Instrumentos_de_Evaluacion_Compilado_${cleanSubject}.pdf`, pdfBuf);
        }
      }

      // 8. Presentaciones SACRINT (.pptx) — Incluidas en el paquete PDF a petición explícita
      try {
        const workbooks = await getAllBlockWorkbooks(planning.id);
        const entries = Object.entries(workbooks)
          .map(([k, v]) => {
            const match = /^block_(\d+)$/.exec(k);
            return match ? { blockIndex: Number(match[1]), workbook: v?.current } : null;
          })
          .filter((e): e is { blockIndex: number; workbook: ActiveWorkTextbook } => Boolean(e?.workbook))
          .sort((a, b) => a.blockIndex - b.blockIndex);

        const validBlockIndices = new Set([0, 1, 2]);
        const canonicalEntries = entries.filter((e) => validBlockIndices.has(e.blockIndex));
        const effectiveEntries = canonicalEntries.length > 0 ? canonicalEntries : entries.slice(0, 3);

        if (effectiveEntries.length > 0) {
          const sacrintDecks: SacrintDeckSpec[] = effectiveEntries.flatMap((entry) =>
            buildSacrintDecksForWorkbook(entry.workbook, { mode: 'lesson-guide' })
          );
          if (sacrintDecks.length > 0) {
            const pptxBuf = await generateCombinedSacrintPptx(sacrintDecks, {
              title: `Presentación SACRINT completa — ${planning.uac_name}`,
              subjectName: planning.uac_name || 'presentacion',
            });
            zip.file(`08_Presentaciones_SACRINT_${cleanSubject}.pptx`, pptxBuf);
          }
        }
      } catch (err) {
        logger.warn('Error packaging Presentations for bulk zip:', { error: err });
      }

      // 9. Infografías Sintéticas SACRINT (.pdf)
      try {
        const workbooks = await getAllBlockWorkbooks(planning.id);
        const entries = Object.entries(workbooks)
          .map(([k, v]) => {
            const match = /^block_(\d+)$/.exec(k);
            return match ? { blockIndex: Number(match[1]), workbook: v?.current } : null;
          })
          .filter((e): e is { blockIndex: number; workbook: ActiveWorkTextbook } => Boolean(e?.workbook))
          .sort((a, b) => a.blockIndex - b.blockIndex);

        const validBlockIndices = new Set([0, 1, 2]);
        const canonicalEntries = entries.filter((e) => validBlockIndices.has(e.blockIndex));
        const effectiveEntries = canonicalEntries.length > 0 ? canonicalEntries : entries.slice(0, 3);

        if (effectiveEntries.length > 0) {
          const specs: SacrintInfographicSpec[] = [];
          for (const entry of effectiveEntries) {
            const missionCount = Math.max(1, (entry.workbook.missions ?? []).length);
            for (let m = 0; m < missionCount; m++) {
              specs.push(buildSacrintInfographic(entry.workbook, 'wide', { missionIndex: m }));
            }
          }
          if (specs.length > 0) {
            const infoBytes = await renderCombinedSacrintInfographicsPdf(specs, 'wide');
            zip.file(`09_Infografias_Sinteticas_${cleanSubject}.pdf`, infoBytes);
          }
        }
      } catch (err) {
        logger.warn('Error packaging Infographics for bulk zip:', { error: err });
      }
    } else {
      // RAMA 2: DESCARGA INDIVIDUAL / POR BLOQUE ESPECÍFICO (Comportamiento habitual por bloque)
      const usedNames = new Set<string>();
      const fileEntries = extras.map((item, i) => {
        let baseName = sanitizeDocFilenameWithBlock(item.title, 70);
        if (!baseName) baseName = `extra_${i + 1}`;

        let fileName = `${baseName}.pdf`;
        let counter = 1;
        while (usedNames.has(fileName.toLowerCase())) {
          fileName = `${baseName}_${counter}.pdf`;
          counter++;
        }
        usedNames.add(fileName.toLowerCase());
        return { item, fileName };
      });

      const BATCH_SIZE = 8;
      for (let i = 0; i < fileEntries.length; i += BATCH_SIZE) {
        const batch = fileEntries.slice(i, i + BATCH_SIZE);
        const generated = await Promise.all(
          batch.map(async ({ item, fileName }) => {
            try {
              const canonicalKeyIndex = item.key_index !== null && item.key_index !== undefined
                ? (resolveBlockNumber(item.key_index) !== null ? resolveBlockNumber(item.key_index)! - 1 : item.key_index)
                : null;
              const pdfDoc = generateExtraPdfDocument({ ...item, keyIndex: canonicalKeyIndex }, brandingCtx);
              const pdfBuffer = Buffer.from(pdfDoc.output('arraybuffer'));
              return { fileName, pdfBuffer };
            } catch (err) {
              logger.warn(`Error generating PDF for extra ${item.id} (${fileName}):`, {
                error: err instanceof Error ? err.message : String(err),
              });
              return null;
            }
          })
        );
        for (const res of generated) {
          if (res) {
            zip.file(res.fileName, res.pdfBuffer);
          }
        }
      }
    }

    if (Object.keys(zip.files).length === 0) {
      return new Response('No se pudo generar ningún documento en el paquete', { status: 500 });
    }

    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    const headers: Record<string, string> = {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${zipName}"`,
    };
    if (warningCount > 0) {
      headers['X-Material-Warnings'] = String(warningCount);
    }

    return new Response(new Uint8Array(zipBuffer), {
      status: 200,
      headers,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    logger.error('Bulk PDF export error:', msg);
    return new Response(`Error: ${msg}`, { status: 500 });
  }
}
