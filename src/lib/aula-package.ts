import JSZip from 'jszip';
import { generatePlanningPDF, generateSecuenciaPDF } from '@/lib/planning-pdf-renderer';
import { generateDocx, generateSecuenciaDocx } from '@/lib/docx-generator';
import { buildCombinedExtraDocx } from '@/lib/docx-helpers';
import { mergeCompiledExtrasPdf } from '@/lib/pdf-extra-renderer';
import { compileSemestralWorkbook } from '@/lib/master-workbook-compiler';
import { selectAllExtrasCombined, selectExtrasForBlock } from '@/lib/planning-extras-for-block';
import { resolveCurricularBlocks } from '@/lib/curricular-blocks';
import { getAllBlockWorkbooks } from '@/lib/db';
import {
  buildSacrintDeck,
  collectWorkbookTheorySources,
  LessonGuideNoSessionsError,
  type SacrintDeckSpec,
} from '@/lib/visual-engine/sacrint/spec';
import { generateCombinedSacrintPptx } from '@/lib/visual-engine/sacrint/sacrint-pptx-generator';
import {
  extractMaterialsFromWorkbook,
  type ExtractedBlockMaterials,
} from '@/lib/guide-engine/material-extractor';
import { reviewBlockMaterials } from '@/lib/guide-engine/material-review';
import { type BrandingContext } from '@/lib/document-branding';
import { shortSubjectCode } from '@/lib/short-filename';
import { logger } from '@/lib/logger';
import {
  generateExitTicketsPdf,
  generateFallbackPptx,
  generateFallbackRubricsPdf,
  generateWorksheetsPdf,
} from '@/lib/aula-package-renderers';
import type { GeneratedPlanningContent, Planning, SecuenciaBloque } from '@/types/planning';
import type { ActiveWorkTextbook } from '@/types/work-textbook';

type PlanningRow = NonNullable<Awaited<ReturnType<typeof import('@/lib/db').getPlanningById>>>;
type ExtraRow = Awaited<ReturnType<typeof import('@/lib/db').getPlanningExtras>>[number];

export interface AulaPackageResult {
  buffer: Buffer;
  fileName: string;
  warnings: string[];
}

async function mergeExtraPdfs(
  items: ExtraRow[],
  brandingCtx?: BrandingContext,
  compiledLabel?: string
): Promise<Buffer | null> {
  return mergeCompiledExtrasPdf(items, brandingCtx, compiledLabel ? { compiledLabel } : undefined);
}

function evaluationExtras(extras: ExtraRow[], content: GeneratedPlanningContent | null): ExtraRow[] {
  const blocks = resolveCurricularBlocks(content);
  const blockList = blocks && blocks.length > 0
    ? blocks
    : [{ blockIndex: 0 }, { blockIndex: 1 }, { blockIndex: 2 }];
  const combined: ExtraRow[] = [];

  for (const block of blockList) {
    combined.push(
      ...selectExtrasForBlock(extras.filter((item) => item.type === 'rubric'), content, block.blockIndex, 'rubric'),
      ...selectExtrasForBlock(extras.filter((item) => item.type === 'checklist'), content, block.blockIndex, 'checklist'),
      ...extras
        .filter((item) =>
          ['scale', 'observation_guide', 'portfolio', 'exam'].includes(item.type) ||
          item.type.startsWith('evaluation') ||
          item.type.startsWith('instrument')
        )
        .filter((item) => item.key_index === block.blockIndex)
    );
  }

  const seen = new Set(combined.map((item) => item.id));
  for (const item of extras) {
    if (seen.has(item.id)) continue;
    if (
      ['rubric', 'checklist', 'scale', 'observation_guide', 'portfolio', 'exam'].includes(item.type) ||
      item.type.startsWith('evaluation') ||
      item.type.startsWith('instrument')
    ) {
      combined.push(item);
    }
  }
  return combined;
}

function workbookEntries(workbooks: Record<string, { current?: ActiveWorkTextbook }>) {
  return Object.entries(workbooks)
    .map(([key, value]) => {
      const match = /^block_(\d+)$/.exec(key);
      return match ? { blockIndex: Number(match[1]), workbook: value?.current } : null;
    })
    .filter((entry): entry is { blockIndex: number; workbook: ActiveWorkTextbook } => Boolean(entry?.workbook))
    .sort((a, b) => a.blockIndex - b.blockIndex);
}

export async function buildAulaPackageZip(
  planning: PlanningRow,
  extras: ExtraRow[],
  options: { includeSemestral?: boolean } = {}
): Promise<AulaPackageResult> {
  const content = (planning.content_json || null) as GeneratedPlanningContent | null;
  if (!content) {
    throw new Error('La planeación no tiene contenido generado.');
  }

  const subjectCode = shortSubjectCode(planning.uac_name || 'UAC');
  const rawSequenceJson = (planning as unknown as { sequence_json?: Record<number, SecuenciaBloque> }).sequence_json || null;
  const workbooks = await getAllBlockWorkbooks(planning.id).catch(() => ({}));
  const entries = workbookEntries(workbooks as Record<string, { current?: ActiveWorkTextbook }>);
  const hasWorkbooks = entries.length > 0;
  const zip = new JSZip();
  const warnings: string[] = [];
  const brandingCtx: BrandingContext = {
    schoolName: planning.extracted_data?.schoolName,
    cct: planning.extracted_data?.cct,
    semester: planning.semester,
  };
  const meta = {
    uacName: planning.uac_name,
    teacherName: content.sectionI?.teacherName,
    schoolName: planning.extracted_data?.schoolName || content.sectionI?.schoolName,
    semester: planning.semester,
    component: planning.component,
    cct: planning.extracted_data?.cct || content.sectionI?.cct,
  };
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
    sequenceJson: rawSequenceJson,
    workbooksJson: (planning as unknown as { workbooks_json?: Record<string, { current?: ActiveWorkTextbook }> }).workbooks_json || null,
    status: planning.status,
    createdAt: planning.created_at,
    updatedAt: planning.updated_at,
  };

  // 1. Planeación semestral (PDF + DOCX)
  try {
    const pdf = await generatePlanningPDF(planningObj);
    zip.file(`01_Planeacion_${subjectCode}.pdf`, Buffer.from(pdf.output('arraybuffer')));
  } catch (error) {
    warnings.push('No se pudo generar la planeación semestral en PDF.');
    logger.warn('[AulaPackage] Error planeación PDF:', { error });
  }
  try {
    zip.file(
      `01_Planeacion_${subjectCode}.docx`,
      await generateDocx(content, rawSequenceJson)
    );
  } catch (error) {
    warnings.push('No se pudo generar la planeación semestral en DOCX.');
    logger.warn('[AulaPackage] Error planeación DOCX:', { error });
  }

  // 2. Secuencia didáctica (PDF + DOCX)
  if (rawSequenceJson) {
    try {
      const pdf = await generateSecuenciaPDF(planningObj);
      zip.file(`02_Secuencia_${subjectCode}.pdf`, Buffer.from(pdf.output('arraybuffer')));
    } catch (error) {
      warnings.push('No se pudo generar la secuencia didáctica en PDF.');
      logger.warn('[AulaPackage] Error secuencia PDF:', { error });
    }
    try {
      const contentForSeq = { ...content };
      const rawMetodologia = (planning as unknown as { metodologia_activa?: string }).metodologia_activa;
      if (rawMetodologia && !contentForSeq.sectionI?.metodologiaActiva) {
        contentForSeq.sectionI.metodologiaActiva = rawMetodologia;
      }
      zip.file(
        `02_Secuencia_${subjectCode}.docx`,
        await generateSecuenciaDocx(contentForSeq, rawSequenceJson)
      );
    } catch (error) {
      warnings.push('No se pudo generar la secuencia didáctica en DOCX.');
      logger.warn('[AulaPackage] Error secuencia DOCX:', { error });
    }
  } else {
    warnings.push('La secuencia didáctica aún no está generada.');
  }

  // 3. Planes de clase
  const lessonPlans = selectAllExtrasCombined(
    extras.filter((item) => item.type === 'lesson_plan'),
    content,
    'lesson_plan'
  );
  if (lessonPlans.length > 0) {
    const lessonPdf = await mergeExtraPdfs(lessonPlans, brandingCtx, 'PLANES DE CLASE COMPILADOS');
    if (lessonPdf) zip.file(`03_Planes_Clase_${subjectCode}.pdf`, lessonPdf);
    try {
      zip.file(
        `03_Planes_Clase_${subjectCode}.docx`,
        await buildCombinedExtraDocx(lessonPlans, brandingCtx, `Planes de Clase (50 min) · ${planning.uac_name}`)
      );
    } catch (error) {
      warnings.push('No se pudo compilar los planes de clase en DOCX.');
      logger.warn('[AulaPackage] Error planes DOCX:', { error });
    }
  } else {
    warnings.push('No hay planes de clase por sesión generados.');
  }

  // 4. Solucionario docente
  const teacherGuides = selectAllExtrasCombined(
    extras.filter((item) => item.type === 'teacher_guide'),
    content,
    'teacher_guide'
  );
  if (teacherGuides.length > 0) {
    const guidePdf = await mergeExtraPdfs(teacherGuides, brandingCtx, 'SOLUCIONARIO DOCENTE COMPILADO');
    if (guidePdf) zip.file(`04_Solucionario_${subjectCode}.pdf`, guidePdf);
    try {
      zip.file(
        `04_Solucionario_${subjectCode}.docx`,
        await buildCombinedExtraDocx(teacherGuides, brandingCtx, `Solucionario Docente · ${planning.uac_name}`)
      );
    } catch (error) {
      warnings.push('No se pudo compilar el solucionario docente en DOCX.');
      logger.warn('[AulaPackage] Error solucionario DOCX:', { error });
    }
  }

  // 5. Fichas de trabajo / guías de práctica
  const practiceGuides = selectAllExtrasCombined(
    extras.filter((item) => item.type === 'practice_guide'),
    content,
    'practice_guide'
  );
  if (practiceGuides.length > 0) {
    const practicePdf = await mergeExtraPdfs(practiceGuides, brandingCtx, 'GUÍAS DE PRÁCTICA COMPILADAS');
    if (practicePdf) zip.file(`05_Fichas_Trabajo_${subjectCode}.pdf`, practicePdf);
    try {
      zip.file(
        `05_Fichas_Trabajo_${subjectCode}.docx`,
        await buildCombinedExtraDocx(practiceGuides, brandingCtx, `Fichas de Trabajo · ${planning.uac_name}`)
      );
    } catch (error) {
      warnings.push('No se pudo compilar las fichas de trabajo en DOCX.');
      logger.warn('[AulaPackage] Error fichas DOCX:', { error });
    }
  } else {
    zip.file(`05_Fichas_Trabajo_${subjectCode}.pdf`, generateWorksheetsPdf(content, meta));
    warnings.push('Se generaron fichas de trabajo deterministas porque no había guías de práctica persistidas.');
  }

  // 6. Libro de texto semestral (se omite por defecto del ZIP síncrono por peso)
  if (hasWorkbooks && options.includeSemestral === true) {
    try {
      const compiled = await compileSemestralWorkbook(planning.id, planningObj, { format: 'both' });
      if (compiled.pdf) {
        zip.file(`06_Libro_Semestral_${subjectCode}.pdf`, compiled.pdf);
      }
      if (compiled.docx) {
        zip.file(`06_Libro_Semestral_${subjectCode}.docx`, compiled.docx);
      }
    } catch (error) {
      warnings.push('No se pudo compilar el libro de texto semestral.');
      logger.warn('[AulaPackage] Error libro semestral:', { error });
    }
  } else if (hasWorkbooks) {
    zip.file(
      '06_Libro_de_Texto_Semestral_LEEME.txt',
      'El libro semestral consolidado se descarga por separado desde la tarjeta "Libros de Texto Activos" para evitar el timeout de 300 s de Vercel.\n'
    );
  } else {
    warnings.push('No hay libros de bloque generados para el compendio semestral.');
  }

  // 7. Instrumentos de evaluación
  const evaluations = evaluationExtras(extras, content);
  if (evaluations.length > 0) {
    const evalPdf = await mergeExtraPdfs(evaluations, brandingCtx, 'INSTRUMENTOS DE EVALUACIÓN COMPILADOS');
    if (evalPdf) zip.file(`07_Instrumentos_${subjectCode}.pdf`, evalPdf);
    try {
      zip.file(
        `07_Instrumentos_${subjectCode}.docx`,
        await buildCombinedExtraDocx(evaluations, brandingCtx, `Instrumentos de Evaluación · ${planning.uac_name}`)
      );
    } catch (error) {
      warnings.push('No se pudo compilar los instrumentos de evaluación en DOCX.');
      logger.warn('[AulaPackage] Error instrumentos DOCX:', { error });
    }
  } else {
    zip.file(`07_Instrumentos_${subjectCode}.pdf`, generateFallbackRubricsPdf(content, meta));
    warnings.push('Se generó una rúbrica determinista porque no había instrumentos persistidos.');
  }

  // 8. Presentación PPTX
  const sacrintFileName = `08_Presentacion_${subjectCode}.pptx`;
  if (hasWorkbooks) {
    try {
      const decks: SacrintDeckSpec[] = [];
      let excludedCount = 0;
      const allTheorySources = entries.flatMap((entry) => collectWorkbookTheorySources(entry.workbook));

      for (const entry of entries) {
        let extracted: ExtractedBlockMaterials | undefined;
        try {
          extracted = extractMaterialsFromWorkbook(entry.workbook);
        } catch {
          extracted = undefined;
        }

        const missionCount = Math.max(1, entry.workbook.missions?.length ?? 0);
        for (let missionIndex = 0; missionIndex < missionCount; missionIndex++) {
          const missionNumber =
            entry.workbook.missions?.[missionIndex]?.missionIndex || missionIndex + 1;
          try {
            const deck = buildSacrintDeck(entry.workbook, {
              mode: 'lesson-guide',
              missionIndex,
              extraTheorySources: allTheorySources,
            });
            const review = reviewBlockMaterials({
              workbook: entry.workbook,
              extracted,
              deck,
              uacName: planning.uac_name,
              checkFullBlockPersistence: false,
            });
            const deckIssues = review.byMaterial.deck.issues;
            const blockingErrors = deckIssues.filter((issue) => issue.severity === 'error');
            const deckWarnings = deckIssues.filter((issue) => issue.severity === 'warning');

            for (const warnIssue of deckWarnings) {
              warnings.push(
                `[Bloque ${entry.blockIndex + 1} · Misión ${missionNumber} · ${sacrintFileName}] ${warnIssue.code}: ${warnIssue.message}`
              );
            }

            if (blockingErrors.length > 0) {
              excludedCount++;
              for (const errIssue of blockingErrors) {
                warnings.push(
                  `[Bloque ${entry.blockIndex + 1} · Misión ${missionNumber} · ${sacrintFileName} excluido por error S6] ${errIssue.code}: ${errIssue.message}`
                );
              }
              continue;
            }

            decks.push(deck);
          } catch (missionError) {
            if (missionError instanceof LessonGuideNoSessionsError) {
              excludedCount++;
              warnings.push(
                `[Bloque ${entry.blockIndex + 1} · Misión ${missionNumber} · ${sacrintFileName} excluido] ${missionError.code}: ${missionError.message}`
              );
              continue;
            }
            throw missionError;
          }
        }
      }

      if (decks.length > 0) {
        zip.file(
          sacrintFileName,
          await generateCombinedSacrintPptx(decks, {
            title: `Presentación SACRINT — ${planning.uac_name}`,
            subjectName: planning.uac_name || 'presentacion',
          })
        );
      } else if (excludedCount > 0) {
        warnings.push(
          `[Presentación · ${sacrintFileName}] Se excluyeron ${excludedCount} deck(s) por errores estructurales S6 o falta de sesiones en modo guía por clase; se omitió el archivo ${sacrintFileName} sin usar plantilla genérica.`
        );
      } else {
        zip.file(`08_Presentacion_${subjectCode}.pptx`, await generateFallbackPptx(content, meta));
      }
    } catch (error) {
      warnings.push('Se generó una presentación determinista porque falló el deck SACRINT.');
      logger.warn('[AulaPackage] Error PPTX SACRINT:', { error });
      zip.file(`08_Presentacion_${subjectCode}.pptx`, await generateFallbackPptx(content, meta));
    }
  } else {
    zip.file(`08_Presentacion_${subjectCode}.pptx`, await generateFallbackPptx(content, meta));
    warnings.push('Se generó una presentación determinista porque no había libros de bloque.');
  }

  // 9. Tickets de salida
  zip.file(`09_Tickets_${subjectCode}.pdf`, generateExitTicketsPdf(content, meta));

  // 10. Manifiesto
  const manifest = [
    'PAQUETE INTEGRAL DE AULA — SIGPDA-EMS',
    `UAC: ${planning.uac_name}`,
    `Semestre: ${planning.semester}`,
    `Docente: ${meta.teacherName || 'No registrado'}`,
    `Plantel: ${meta.schoolName || 'No registrado'}`,
    `Generado: ${new Date().toISOString()}`,
    '',
    'CONTENIDO DEL PAQUETE:',
    '01 Planeación didáctica semestral (PDF + DOCX)',
    '02 Secuencia didáctica (PDF + DOCX)',
    '03 Planes de clase (PDF + DOCX)',
    '04 Solucionario docente (PDF + DOCX), si está generado',
    '05 Fichas de trabajo / guías de práctica (PDF + DOCX)',
    '06 Libro de texto semestral (PDF + DOCX), si hay libros de bloque',
    '07 Instrumentos de evaluación (PDF + DOCX)',
    '08 Presentación de clase (PPTX)',
    '09 Tickets de salida de 5 minutos (PDF)',
    '',
    warnings.length > 0 ? 'ADVERTENCIAS:' : 'Sin advertencias: el paquete contiene todos los recursos base.',
    ...warnings.map((warning) => `- ${warning}`),
  ].join('\n');
  zip.file('LEEME_PAQUETE_AULA.txt', manifest);

  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  const fileName = `Paquete_Aula_${subjectCode}.zip`;
  return { buffer, fileName, warnings };
}
