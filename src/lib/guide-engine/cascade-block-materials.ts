/**
 * cascade-block-materials.ts
 * SIGPDA-EMS · SEMS Puebla MCCEMS 2026-2027
 *
 * Motor de persistencia en cascada para materiales derivados de Bloque:
 * 1. Extrae determinísticamente los 24 Planes de Clase, Rúbricas, Listas de Cotejo,
 *    Guía del Estudiante y Materiales Didácticos a partir del ActiveWorkTextbook (<5ms, 0 tokens).
 * 2. Persiste atómicamente cada recurso en la tabla `planning_extras` vinculado al `blockIndex`.
 * 3. Habilita visualización y descarga inmediata en las pestañas de Planes y Rúbricas.
 */

import type { NeonQueryFunction } from '@neondatabase/serverless';
import { sql, WorkerLeaseLostError } from '@/lib/db';
import type { ActiveWorkTextbook } from '@/types/work-textbook';
import type { SecuenciaBloque } from '@/types/planning';
import {
  extractMaterialsFromWorkbook,
  type BlockCurricularAnchor,
  type PlanDeClaseDerivado,
} from './material-extractor';
import {
  reviewBlockMaterials,
  type MaterialReviewReport,
  type MaterialType,
  type ReviewIssue,
} from './material-review';
import {
  buildMaterialPersistencePlan,
  cleanSessionTitle,
  collectOmittedFromReview,
  type ValidVisualEntry,
} from './material-persistence-plan';
import { buildBlockSequenceFromWorkbook } from '@/lib/planning/workbook-sequence-sync';
import { resolveVisualForMission } from '@/lib/visual-engine/visual-asset-manager';
import { stripMaterialTokens } from '@/lib/materials/material-tokens';
import { resolveBlockNumber } from '@/lib/curricular-blocks';
import { logger } from '@/lib/logger';

export { cleanSessionTitle } from './material-persistence-plan';

type QueryFn = (strings: TemplateStringsArray, ...params: unknown[]) => Promise<unknown>;
type QueryPromise = ReturnType<QueryFn>;

/**
 * Ejecuta el plan de persistencia como una transacción no interactiva por bloque.
 * Si el cliente no expone `transaction` (mocks o drivers antiguos), ejecuta
 * secuencialmente para no romper la compatibilidad.
 */
async function executePersistencePlan(
  db: NeonQueryFunction<false, false>,
  build: (exec: QueryFn) => QueryPromise[]
): Promise<void> {
  const transactional = db as unknown as {
    transaction?: (fn: (exec: QueryFn) => QueryPromise[]) => Promise<unknown>;
  };
  if (typeof transactional.transaction === 'function') {
    await transactional.transaction(build);
    return;
  }
  for (const query of build(db as unknown as QueryFn)) {
    await query;
  }
}

export interface CascadeResult {
  success: boolean;
  blockIndex: number;
  planesCount: number;
  extrasInserted: number;
  executionTimeMs: number;
  review?: MaterialReviewReport;
  omitted?: MaterialType[];
  error?: string;
}

export interface PlanEvaluationSummary {
  heteroevaluacion: string;
  autoevaluacionCoevaluacion: string;
  ponderacion: string;
}

/**
 * Convierte un PlanDeClaseDerivado al formato Markdown estándar institucional MCCEMS.
 */
export function formatPlanDeClaseMarkdown(
  plan: PlanDeClaseDerivado,
  workbook: ActiveWorkTextbook,
  evaluationSummary?: PlanEvaluationSummary | null
): string {
  const cover = (workbook.coverData || {}) as Record<string, unknown>; // fallback tipado defensivo
  const uacName = (cover.subjectName as string) || 'Formación Disciplinar';
  const semester = (cover.semester as number | string) || 1;
  const semesterNumber = Number.parseInt(String(semester), 10);
  const subjectLabel = semesterNumber >= 5 ? 'UAC' : 'Asignatura';
  const sessionTitle = cleanSessionTitle(plan.tituloSesion, plan.numeroSesion);

  const curricularLines: string[] = [];
  if (plan.metaEducativa) curricularLines.push(`**Meta Educativa:** ${plan.metaEducativa}`);
  curricularLines.push(`**Propósito Formativo:** ${plan.propositoFormativo || plan.propósitoOMeta}`);
  if (plan.contenidoFormativo) curricularLines.push(`**Contenido Formativo:** ${plan.contenidoFormativo}`);

  const evaluationLines: string[] = [
    `- **Evidencia Tangible de la Sesión:** ${plan.cierre.productoEsperado}`,
  ];
  if (evaluationSummary) {
    evaluationLines.push(`- **Heteroevaluación:** ${evaluationSummary.heteroevaluacion}`);
    evaluationLines.push(`- **Autoevaluación / Coevaluación:** ${evaluationSummary.autoevaluacionCoevaluacion}`);
    evaluationLines.push(`- **Ponderación:** ${evaluationSummary.ponderacion}`);
  } else {
    evaluationLines.push(`- **Evaluación Formativa:** ${plan.cierre.evaluacionFormativa}`);
    evaluationLines.push(`- **Instrumento de Evaluación Oficial:** ${plan.instrumentoEvaluacion}`);
  }
  evaluationLines.push(`- **Pregunta Metacognitiva:** ${plan.cierre.metacognicion}`);

  return stripMaterialTokens(`# PLAN DE CLASE OFICIAL MCCEMS · SESIÓN ${plan.numeroSesion}
**${subjectLabel}:** ${uacName} | **Semestre:** ${semester}° | **Duración:** ${plan.duracionMinutos} min
**Título de la Sesión:** ${sessionTitle}
${curricularLines.join('\n')}
**Transversalidad Comunitaria (PAEC):** ${plan.transversalidad}

---

## SECUENCIA DIDÁCTICA DE LA SESIÓN (50 MINUTOS)

### 1. Fase de Apertura (${plan.apertura.tiempoMinutos} min) — Activación y Recuperación
- **Rol del Docente:** ${plan.apertura.actividadDocente}
- **Rol del Estudiante:** ${plan.apertura.actividadEstudiante}
- **Saberes Previos y Conexión Intuitiva:** ${plan.apertura.saberesPrevios}

### 2. Fase de Desarrollo (${plan.desarrollo.tiempoMinutos} min) — Aprendizaje Pertinente y Modelado
- **Rol del Docente (Modelado y Acompañamiento):** ${plan.desarrollo.actividadDocente}
- **Rol del Estudiante (Práctica y Reto Autónomo):** ${plan.desarrollo.actividadEstudiante}
- **Metodología Activa Aplicada:** ${plan.desarrollo.metodologiaActiva}
- **Recursos e Insumos Didácticos:** ${plan.desarrollo.recursosDidacticos}

### 3. Fase de Cierre (${plan.cierre.tiempoMinutos} min) — Consolidación y Metacognición
- **Rol del Docente:** ${plan.cierre.actividadDocente}
- **Rol del Estudiante:** ${plan.cierre.actividadEstudiante}

---

## EVALUACIÓN Y PRODUCTO ESPERADO
${evaluationLines.join('\n')}
`);
}

interface OfficialContenidoFormativo {
  proposito?: string;
  contenidos?: string[];
}

interface RawEvaluationRow {
  type?: string;
  agent?: string;
  instrument?: string;
  percentage?: number | string;
}

interface PlanningContentSnapshot {
  sectionII?: {
    purpose?: string;
    learningOutcomes?: string[];
  };
  sectionIV?: {
    activities?: Array<{ contenidoFormativo?: string }>;
  };
  sectionV?: {
    evaluations?: unknown;
  };
}

interface PlanningExtractedSnapshot {
  learningOutcome?: string;
  contenidosFormativos?: OfficialContenidoFormativo[];
}

function normalizeCurriculumText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const CURRICULUM_STOPWORDS = new Set([
  'para', 'como', 'sobre', 'entre', 'desde', 'hasta', 'cuando', 'donde', 'porque',
  'situaciones', 'interes', 'diversas', 'distintos', 'tipos', 'otras', 'areas',
  'conocimiento', 'fenomenos', 'naturales', 'distintas', 'esferas', 'vida', 'humana',
]);

/**
 * Términos que aparecen en casi todos los propósitos de la misma familia
 * algebraica. No bastan por sí solos para afirmar que un bloque cubre un
 * propósito: se exige al menos una coincidencia distintiva (p. ej. "cuadrática",
 * "intereses", "geometría") o tres coincidencias léxicas.
 */
const GENERIC_CURRICULUM_TOKENS = new Set([
  'ecuacion', 'ecuaciones', 'lineal', 'lineales', 'valor', 'incognita', 'incognitas',
  'problema', 'problemas', 'situacion', 'situaciones', 'interes', 'aritmetica',
  'algebra', 'manejo', 'encontrar', 'resolver', 'aplica', 'aplicar', 'expresa',
  'forma', 'general', 'calculo', 'calcular', 'procedimiento', 'concepto',
  'representacion', 'grafica', 'grafico', 'metodo', 'partes', 'primer', 'grado',
]);

function contentItemMatchesBlock(item: string, blockNorm: string): boolean {
  const normalized = normalizeCurriculumText(item);
  if (normalized.length < 6) return false;
  if (blockNorm.includes(normalized)) return true;

  const tokens = normalized
    .split(' ')
    .filter((token) => token.length >= 5 && !CURRICULUM_STOPWORDS.has(token));
  if (tokens.length < 2) return false;

  const matches = tokens.filter((token) => blockNorm.includes(token));
  if (matches.length < 2 || matches.length / tokens.length < 0.5) return false;

  return matches.some(
    (token) => token.length >= 8 && !GENERIC_CURRICULUM_TOKENS.has(token)
  );
}

/**
 * Selecciona los Propósitos Formativos oficiales cuyos Contenidos Formativos
 * aparecen textualmente en el contenido del bloque. Evita inventar o parafrasear
 * el currículo cuando la planeación ya trae la dosificación oficial.
 */
export function selectPropositosForBlock(
  contenidoFormativo: string,
  officialContents: OfficialContenidoFormativo[],
  fallback: string
): string {
  const blockNorm = normalizeCurriculumText(contenidoFormativo);
  if (!blockNorm || officialContents.length === 0) return fallback;

  const matched = officialContents
    .filter((cf) => {
      const contents = Array.isArray(cf.contenidos) ? cf.contenidos : [];
      return contents.some((content) => contentItemMatchesBlock(String(content), blockNorm));
    })
    .map((cf) => String(cf.proposito || '').trim())
    .filter(Boolean);

  return matched.length > 0 ? Array.from(new Set(matched)).join(' · ') : fallback;
}

/**
 * Resume la ponderación y los agentes de evaluación de la Sección V para que
 * el plan de clase muestre heteroevaluación, autoevaluación, coevaluación y
 * ponderación sin duplicar la tabla completa en cada sesión.
 */
export function buildPlanEvaluationSummary(evaluations: unknown): PlanEvaluationSummary | null {
  if (!Array.isArray(evaluations) || evaluations.length === 0) return null;

  const rows = evaluations
    .filter((row): row is RawEvaluationRow => Boolean(row) && typeof row === 'object')
    .map((row) => ({
      type: String(row.type || '').trim(),
      agent: String(row.agent || '').trim(),
      instrument: String(row.instrument || '').trim(),
      percentage: Number(row.percentage),
    }))
    .filter((row) => row.type && row.percentage > 0);

  if (rows.length === 0) return null;

  const formatRows = (predicate: (agent: string) => boolean): string =>
    rows
      .filter((row) => predicate(row.agent))
      .map((row) => `${row.type} ${row.percentage}% (${row.instrument || 'instrumento oficial'})`)
      .join(' y ');

  const heteroevaluacion = formatRows((agent) => /heteroevaluaci/i.test(agent));
  const coevaluacion = formatRows((agent) => /coevaluaci/i.test(agent));
  const autoevaluacion = formatRows((agent) => /autoevaluaci/i.test(agent));

  const autoCoeParts: string[] = [];
  autoCoeParts.push(autoevaluacion || 'Autoevaluación con semáforo y ticket de salida');
  autoCoeParts.push(coevaluacion || 'Coevaluación entre pares con rúbrica de proceso');

  return {
    heteroevaluacion: heteroevaluacion || 'Docente con el instrumento oficial de la sesión',
    autoevaluacionCoevaluacion: autoCoeParts.join('; '),
    ponderacion: rows.map((row) => `${row.type} ${row.percentage}%`).join(' · '),
  };
}

/**
 * Ejecuta la cascada de derivación y persistencia de materiales para un bloque específico.
 *
 * @param planningId - ID de la planeación didáctica
 * @param blockIndex - Índice del bloque (0 a 2)
 * @param workbook - Estructura de libro activo con planes y rúbricas
 * @param teacherId - ID del docente propietario (opcional, para trazabilidad y auditoría)
 */
export interface CascadeBlockMaterialsOptions {
  jobId?: string;
  leaseId?: string;
  uacName?: string;
  component?: string;
  curriculumName?: string;
  careerOrProgramName?: string;
  failOnAnyError?: boolean;
}

export async function cascadeBlockMaterials(
  planningId: string,
  blockIndex: number,
  workbook: ActiveWorkTextbook,
  teacherId?: string,
  options?: CascadeBlockMaterialsOptions
): Promise<CascadeResult> {
  const startTime = performance.now();

  try {
    const db = sql();

    // Verificación estricta de fencing con función re-ejecutable antes de cada mutación
    const assertLeaseValid = async (phaseName: string) => {
      if (options?.jobId && options?.leaseId) {
        const checkLease = await db`
          SELECT id FROM generation_jobs
          WHERE id = ${options.jobId}::uuid
            AND lease_id = ${options.leaseId}::uuid
            AND status = 'running'
            AND (lease_until IS NULL OR lease_until > NOW())
          LIMIT 1
        `;
        if (!checkLease || checkLease.length === 0) {
          logger.warn(`[cascadeBlockMaterials] Abortando en ${phaseName}: worker perdió el lease del job ${options.jobId}`);
          throw new WorkerLeaseLostError(`Lease revocado o vencido para job ${options.jobId} antes de ${phaseName}`);
        }
      }
    };

    // 0. Validar lease al inicio de la cascada
    await assertLeaseValid('inicio');

    // 0. Consultar el anclaje curricular oficial y la secuencia didáctica del planning
    let blockSequence: SecuenciaBloque | null = null;
    let curricularAnchor: BlockCurricularAnchor | null = null;
    let evaluationSummary: PlanEvaluationSummary | null = null;
    let dbUacName = '';
    let dbComponent = '';
    let dbCurriculumName = '';
    try {
      const planningRows = await db`
        SELECT uac_name, component, curriculum_name, sequence_json, content_json, extracted_data
        FROM plannings
        WHERE id = ${planningId}::uuid
      `;
      if (planningRows.length > 0) {
        const row = planningRows[0];
        dbUacName = typeof row.uac_name === 'string' ? row.uac_name : '';
        dbComponent = typeof row.component === 'string' ? row.component : '';
        dbCurriculumName = typeof row.curriculum_name === 'string' ? row.curriculum_name : '';
        if (row.sequence_json) {
          const rawSeq = row.sequence_json as Record<string | number, SecuenciaBloque>;
          blockSequence = rawSeq[blockIndex] ?? rawSeq[String(blockIndex)] ?? null;
        }

        const contentJson = (row.content_json || null) as PlanningContentSnapshot | null;
        const extractedData = (row.extracted_data || null) as PlanningExtractedSnapshot | null;
        const blockActivity = contentJson?.sectionIV?.activities?.[blockIndex];
        const contenidoFormativo = typeof blockActivity?.contenidoFormativo === 'string'
          ? blockActivity.contenidoFormativo
          : '';
        const learningOutcomes = Array.isArray(contentJson?.sectionII?.learningOutcomes)
          ? contentJson.sectionII.learningOutcomes
          : [];
        const fallbackProposito = String(
          learningOutcomes[blockIndex] || contentJson?.sectionII?.purpose || ''
        ).trim();
        const officialContents = Array.isArray(extractedData?.contenidosFormativos)
          ? extractedData.contenidosFormativos
          : [];
        const metaEducativa = String(
          extractedData?.learningOutcome || contentJson?.sectionII?.purpose || ''
        ).trim();

        curricularAnchor = {
          metaEducativa,
          propositoFormativo: selectPropositosForBlock(
            contenidoFormativo,
            officialContents,
            fallbackProposito
          ),
          contenidoFormativo,
        };
        evaluationSummary = buildPlanEvaluationSummary(contentJson?.sectionV?.evaluations);
      }
    } catch (ctxErr) {
      logger.warn(`[cascadeBlockMaterials] Advertencia al obtener el anclaje curricular de ${planningId}:`, ctxErr);
    }

    const blockNum = resolveBlockNumber(blockIndex) ?? (blockIndex + 1);
    const blockTitle = workbook.blockName || `Bloque ${blockNum}`;
    const resolvedUacName =
      options?.uacName || dbUacName || workbook.coverData?.subjectName || '';
    const resolvedComponent = options?.component || dbComponent || '';
    const resolvedCurriculumName = options?.curriculumName || dbCurriculumName || '';

    // 1. Sincronizar canónicamente sequence_json en memoria; la escritura se difiere
    //    a la transacción final para que un gate 422 no mute la planeación.
    let syncedBlockSeq: SecuenciaBloque | null = null;
    try {
      const candidateSeq = buildBlockSequenceFromWorkbook(workbook, blockIndex, blockTitle);
      if (candidateSeq && candidateSeq.sessions.length > 0) {
        syncedBlockSeq = candidateSeq;
        blockSequence = candidateSeq;
      }
    } catch (seqSyncErr) {
      if (seqSyncErr instanceof WorkerLeaseLostError) throw seqSyncErr;
      syncedBlockSeq = null;
      logger.warn(
        `[cascadeBlockMaterials] Advertencia al sincronizar sequence_json del bloque ${blockIndex}:`,
        seqSyncErr
      );
    }

    // 2. Extraer materiales determinísticamente con la secuencia sincronizada en memoria
    const extracted = extractMaterialsFromWorkbook(workbook, blockSequence, curricularAnchor);
    const planes = extracted.planesDeClase || [];

    // 2.1 Revisión estructural R1 (sin visuales persistidos todavía)
    const review = reviewBlockMaterials({
      workbook,
      blockSequence,
      curricularAnchor,
      extracted,
      uacName: resolvedUacName,
      component: resolvedComponent,
      curriculumName: resolvedCurriculumName,
      careerOrProgramName: options?.careerOrProgramName,
    });
    const structuralOmitted = collectOmittedFromReview(review);

    // 2.2 Gate fail-closed estructural ANTES de resolver visuales y de cualquier mutación
    if (options?.failOnAnyError && !review.ok) {
      const endTime = performance.now();
      return {
        success: false,
        blockIndex,
        planesCount: 0,
        extrasInserted: 0,
        executionTimeMs: Math.round((endTime - startTime) * 100) / 100,
        review,
        omitted: structuralOmitted,
        error: 'Material bloqueado por inconsistencia estructural',
      };
    }

    // 2.3 Pre-resolver y validar Recursos Gráficos Determinísticos (Visual Engine)
    const subjectName = resolvedUacName;
    const usedAssetIds = new Set<string>();
    const validVisuals: ValidVisualEntry[] = [];
    const omittedVisualMissions: number[] = [];
    for (let mIdx = 0; mIdx < (workbook.missions || []).length; mIdx++) {
      const mission = workbook.missions[mIdx];
      const contextText = `${mission.conceptZero?.physicalAnalogy || ''} ${mission.conceptZero?.coreExplanation || ''}`;
      const resolved = await resolveVisualForMission({
        planningId,
        uacName: subjectName,
        blockIndex,
        missionIndex: mIdx + 1,
        missionTitle: mission.title,
        contextText,
        preferOpenverseMedia: true,
        usedAssetIds,
      });
      if (!resolved) continue;

      const visualTitle = `[Visual] Recurso Gráfico Misión ${mIdx + 1}: ${mission.title}`;
      const visualPayload = JSON.stringify({
        type: resolved.type,
        svg: resolved.svg,
        annotations: resolved.annotations || [],
        mediaAsset: resolved.mediaAsset,
        caption: resolved.caption,
        slug: resolved.materialSlug,
        altText: resolved.materialAltText,
        materialPngPath: resolved.materialPngPath,
        missionNumber: mIdx + 1,
        missionTitle: mission.title,
        subjectName,
      });

      const isMaterialPng = resolved.type === 'material_png';
      const hasValidVisualContent = Boolean(
        resolved.type &&
          (isMaterialPng
            ? Boolean(resolved.materialPngPath || resolved.materialSlug)
            : (typeof resolved.svg === 'string' && resolved.svg.trim().length > 0) ||
              (typeof resolved.mediaAsset?.imageUrl === 'string' &&
                resolved.mediaAsset.imageUrl.trim().length > 0)) &&
          !/\bundefined\b|\$\{[^}]*\}/i.test(visualPayload)
      );

      if (hasValidVisualContent) {
        validVisuals.push({ missionNumber: mIdx + 1, title: visualTitle, payload: visualPayload });
      } else {
        omittedVisualMissions.push(mIdx + 1);
      }
    }

    // 2.4 Gate fail-closed visual. Los activos de imagen viven en image_assets,
    //     no en planning_extras; no se muta ningún material del bloque.
    if (options?.failOnAnyError && omittedVisualMissions.length > 0) {
      const visualIssue: ReviewIssue = {
        code: 'S6_CORRUPT_VISUAL_ASSET',
        material: 'visual_asset',
        severity: 'error',
        message: `Las misiones ${omittedVisualMissions.join(', ')} no produjeron un recurso gráfico válido; el bloque se bloquea para no persistir visuales defectuosos.`,
      };
      const reviewWithVisualErrors: MaterialReviewReport = {
        ...review,
        ok: false,
        issues: [...review.issues, visualIssue],
        errors: [...review.errors, visualIssue],
        byMaterial: {
          ...review.byMaterial,
          visual_asset: {
            ok: false,
            issues: [...review.byMaterial.visual_asset.issues, visualIssue],
          },
        },
      };
      const omitted: MaterialType[] = [...structuralOmitted];
      if (!omitted.includes('visual_asset')) omitted.push('visual_asset');
      const endTime = performance.now();
      return {
        success: false,
        blockIndex,
        planesCount: 0,
        extrasInserted: 0,
        executionTimeMs: Math.round((endTime - startTime) * 100) / 100,
        review: reviewWithVisualErrors,
        omitted,
        error: 'Material bloqueado por inconsistencia estructural',
      };
    }

    // 2.5 Construir el plan de persistencia con invariantes de no destrucción
    const rubricContent = extracted.rubricaEvaluacion || extracted.instrumentosEvaluacion || '';
    const checklistContent = extracted.listaCotejo || '';
    const planMarkdownBySession = new Map<number, string>();
    for (const plan of planes) {
      planMarkdownBySession.set(
        plan.numeroSesion,
        formatPlanDeClaseMarkdown(plan, workbook, evaluationSummary)
      );
    }

    const persistencePlan = buildMaterialPersistencePlan({
      review,
      extracted,
      plans: planes,
      blockNum,
      blockTitle,
      rubricContent,
      checklistContent,
      planMarkdownBySession,
      validVisuals,
      omittedVisualMissions,
    });

    // 2.6 Persistir el bloque en una transacción no interactiva
    await assertLeaseValid('persist');

    const buildQueries = (exec: QueryFn): QueryPromise[] => {
      const queries: QueryPromise[] = [];

      if (syncedBlockSeq) {
        queries.push(exec`
          UPDATE plannings
          SET sequence_json = jsonb_set(
            COALESCE(sequence_json, '{}'::jsonb),
            ARRAY[${String(blockIndex)}],
            ${JSON.stringify(syncedBlockSeq)}::jsonb,
            true
          ),
          updated_at = NOW()
          WHERE id = ${planningId}::uuid
        `);
      }

      for (const deletion of persistencePlan.deletes) {
        if (deletion.kind === 'types') {
          queries.push(exec`
            DELETE FROM planning_extras
            WHERE planning_id = ${planningId}::uuid
              AND key_index = ${blockIndex}
              AND type = ANY(${deletion.types}::text[])
          `);
        } else if (deletion.kind === 'material_non_visual') {
          queries.push(exec`
            DELETE FROM planning_extras
            WHERE planning_id = ${planningId}::uuid
              AND key_index = ${blockIndex}
              AND type = 'material'
              AND title NOT LIKE '[Visual]%'
          `);
        } else {
          for (const missionNumber of deletion.missionNumbers) {
            queries.push(exec`
              DELETE FROM planning_extras
              WHERE planning_id = ${planningId}::uuid
                AND key_index = ${blockIndex}
                AND type = 'material'
                AND title LIKE ${`[Visual] Recurso Gráfico Misión ${missionNumber}:%`}
            `);
          }
        }
      }

      for (const insert of persistencePlan.inserts) {
        queries.push(exec`
          INSERT INTO planning_extras (
            planning_id,
            type,
            title,
            key_index,
            content_text,
            created_at
          ) VALUES (
            ${planningId}::uuid,
            ${insert.extraType},
            ${insert.title},
            ${blockIndex},
            ${insert.contentText},
            NOW()
          )
        `);
      }

      return queries;
    };

    const hasPersistenceWork =
      Boolean(syncedBlockSeq) ||
      persistencePlan.deletes.length > 0 ||
      persistencePlan.inserts.length > 0;
    if (hasPersistenceWork) {
      await executePersistencePlan(db, buildQueries);
    }

    const endTime = performance.now();
    const executionTimeMs = Math.round((endTime - startTime) * 100) / 100;
    const insertedCount = persistencePlan.inserts.length;
    const omitted = persistencePlan.omitted;

    if (omitted.length > 0) {
      logger.warn(
        `[cascadeBlockMaterials] ⚠️ Bloque ${blockIndex} sincronizado parcialmente: omitidos [${omitted.join(', ')}] por revisión R1 (${review.errors.length} errores).`
      );
    } else {
      logger.info(
        `[cascadeBlockMaterials] ✅ Bloque ${blockIndex} sincronizado: ${persistencePlan.inserts.filter((i) => i.extraType === 'lesson_plan').length} planes de clase y ${insertedCount} extras en ${executionTimeMs}ms.` +
          (teacherId ? ` (docente: ${teacherId})` : '')
      );
    }

    return {
      success: true,
      blockIndex,
      planesCount: persistencePlan.persistedStreams.includes('lesson_plan') ? planes.length : 0,
      extrasInserted: insertedCount,
      executionTimeMs,
      review,
      omitted,
    };
  } catch (error: unknown) {
    if (error instanceof WorkerLeaseLostError) {
      throw error;
    }
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(`[cascadeBlockMaterials] ❌ Error en cascada del bloque ${blockIndex}:`, error);
    return {
      success: false,
      blockIndex,
      planesCount: 0,
      extrasInserted: 0,
      executionTimeMs: 0,
      error: errorMsg,
    };
  }
}
