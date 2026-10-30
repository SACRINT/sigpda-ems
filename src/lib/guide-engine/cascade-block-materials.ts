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

import { sql } from '@/lib/db';
import type { ActiveWorkTextbook } from '@/types/work-textbook';
import type { SecuenciaBloque } from '@/types/planning';
import {
  extractMaterialsFromWorkbook,
  type BlockCurricularAnchor,
  type PlanDeClaseDerivado,
} from './material-extractor';
import { resolveVisualForMission } from '@/lib/visual-engine/visual-asset-manager';
import { stripMaterialTokens } from '@/lib/materials/material-tokens';
import { logger } from '@/lib/logger';

export interface CascadeResult {
  success: boolean;
  blockIndex: number;
  planesCount: number;
  extrasInserted: number;
  executionTimeMs: number;
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
**UAC:** ${uacName} | **Semestre:** ${semester}° | **Sesión:** ${plan.numeroSesion} de 24 (${plan.duracionMinutos} min)
**Título de la Sesión:** ${plan.tituloSesion}
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

---
*SIGPDA-EMS · Documento derivado en cascada del Cuaderno de Trabajo Activo (Bloque ${(workbook.blockIndex ?? 0) + 1})*
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
export async function cascadeBlockMaterials(
  planningId: string,
  blockIndex: number,
  workbook: ActiveWorkTextbook,
  teacherId?: string
): Promise<CascadeResult> {
  const startTime = performance.now();

  try {
    const db = sql();

    // 0. Consultar el anclaje curricular oficial y la secuencia didáctica del planning
    let blockSequence: SecuenciaBloque | null = null;
    let curricularAnchor: BlockCurricularAnchor | null = null;
    let evaluationSummary: PlanEvaluationSummary | null = null;
    try {
      const planningRows = await db`
        SELECT sequence_json, content_json, extracted_data
        FROM plannings
        WHERE id = ${planningId}::uuid
      `;
      if (planningRows.length > 0) {
        const row = planningRows[0];
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

    // 1. Extraer materiales determinísticamente del Libro de Bloque inyectando la secuencia didáctica
    const extracted = extractMaterialsFromWorkbook(workbook, blockSequence, curricularAnchor);
    const planes = extracted.planesDeClase || [];
    const blockNum = blockIndex + 1;
    const blockTitle = workbook.blockName || `Bloque ${blockNum}`;

    // 2. Limpiar registros previos generados automáticamente para este bloque
    // (Permite regeneración idempotente y limpia sin duplicar planes)
    await db`
      DELETE FROM planning_extras
      WHERE planning_id = ${planningId}::uuid
        AND key_index = ${blockIndex}
    `;

    let insertedCount = 0;

    // 3. Insertar los 24 Planes de Clase individuales
    for (const plan of planes) {
      const planTitle = `Plan de Clase: Sesión ${plan.numeroSesion} - ${plan.tituloSesion}`;
      const planMarkdown = formatPlanDeClaseMarkdown(plan, workbook, evaluationSummary);

      await db`
        INSERT INTO planning_extras (
          planning_id,
          type,
          title,
          key_index,
          content_text,
          created_at
        ) VALUES (
          ${planningId}::uuid,
          'lesson_plan',
          ${planTitle},
          ${blockIndex},
          ${planMarkdown},
          NOW()
        )
      `;
      insertedCount++;
    }

    // 4. Insertar Rúbrica Analítica de Desempeño del Bloque (Contenido estructurado oficial)
    const rubricContent = extracted.rubricaEvaluacion || extracted.instrumentosEvaluacion || '';
    if (rubricContent) {
      await db`
        INSERT INTO planning_extras (
          planning_id,
          type,
          title,
          key_index,
          content_text,
          created_at
        ) VALUES (
          ${planningId}::uuid,
          'rubric',
          ${`Rúbrica Analítica de Evaluación · Bloque ${blockNum}: ${blockTitle}`},
          ${blockIndex},
          ${rubricContent},
          NOW()
        )
      `;
      insertedCount++;
    }

    // 5. Insertar Lista de Cotejo Formativa del Bloque (Contenido estructurado oficial)
    const checklistContent = extracted.listaCotejo || '';
    if (checklistContent) {
      await db`
        INSERT INTO planning_extras (
          planning_id,
          type,
          title,
          key_index,
          content_text,
          created_at
        ) VALUES (
          ${planningId}::uuid,
          'checklist',
          ${`Lista de Cotejo Formativa · Bloque ${blockNum}: ${blockTitle}`},
          ${blockIndex},
          ${checklistContent},
          NOW()
        )
      `;
      insertedCount++;
    }

    // 6. Insertar Materiales Didácticos e Insumos del Docente del Bloque
    if (extracted.materialDidactico) {
      await db`
        INSERT INTO planning_extras (
          planning_id,
          type,
          title,
          key_index,
          content_text,
          created_at
        ) VALUES (
          ${planningId}::uuid,
          'material',
          ${`Materiales Didácticos e Insumos del Docente · Bloque ${blockNum}: ${blockTitle}`},
          ${blockIndex},
          ${extracted.materialDidactico},
          NOW()
        )
      `;
      insertedCount++;
    }

    // 7. Insertar Fichas de Trabajo Imprimibles por Sesión
    if (extracted.fichasTrabajo) {
      await db`
        INSERT INTO planning_extras (
          planning_id,
          type,
          title,
          key_index,
          content_text,
          created_at
        ) VALUES (
          ${planningId}::uuid,
          'practice_guide',
          ${`Fichas de Trabajo Imprimibles · Bloque ${blockNum}: ${blockTitle}`},
          ${blockIndex},
          ${extracted.fichasTrabajo},
          NOW()
        )
      `;
      insertedCount++;
    }

    // 8. Insertar Solucionario y Guía Pedagógica del Docente (Uso exclusivo docente)
    if (extracted.solucionarioDocente) {
      await db`
        INSERT INTO planning_extras (
          planning_id,
          type,
          title,
          key_index,
          content_text,
          created_at
        ) VALUES (
          ${planningId}::uuid,
          'teacher_guide',
          ${`Solucionario y Guía Pedagógica del Docente · Bloque ${blockNum}: ${blockTitle}`},
          ${blockIndex},
          ${extracted.solucionarioDocente},
          NOW()
        )
      `;
      insertedCount++;
    }

    // 9. Insertar Recursos Gráficos Determinísticos del Bloque (Visual Engine)
    const subjectName = workbook.coverData?.subjectName || '';
    const usedAssetIds = new Set<string>();
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
      if (resolved) {
        const visualTitle = `[Visual] Recurso Gráfico Misión ${mIdx + 1}: ${mission.title}`;
        const visualPayload = JSON.stringify({
          type: resolved.type,
          svg: resolved.svg,
          annotations: resolved.annotations || [],
          mediaAsset: resolved.mediaAsset,
          caption: resolved.caption,
          slug: resolved.materialSlug,
          altText: resolved.materialAltText,
          missionNumber: mIdx + 1,
          missionTitle: mission.title,
          subjectName,
        });

        await db`
          INSERT INTO planning_extras (
            planning_id,
            type,
            title,
            key_index,
            content_text,
            created_at
          ) VALUES (
            ${planningId}::uuid,
            'material',
            ${visualTitle},
            ${blockIndex},
            ${visualPayload},
            NOW()
          )
        `;
        insertedCount++;
      }
    }

    const endTime = performance.now();
    const executionTimeMs = Math.round((endTime - startTime) * 100) / 100;

    logger.info(
      `[cascadeBlockMaterials] ✅ Bloque ${blockIndex} sincronizado: ${planes.length} planes de clase y ${insertedCount} extras en ${executionTimeMs}ms.` +
        (teacherId ? ` (docente: ${teacherId})` : '')
    );

    return {
      success: true,
      blockIndex,
      planesCount: planes.length,
      extrasInserted: insertedCount,
      executionTimeMs,
    };
  } catch (error: unknown) {
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

