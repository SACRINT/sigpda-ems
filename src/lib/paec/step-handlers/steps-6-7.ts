import {
  getProgramsCatalogForPaec,
  updatePaecProjectStep,
} from '@/lib/db';
import {
  buildPrompt6PlanOperativoSemestreA,
  buildPrompt7PlanOperativoSemestreB,
} from '@/lib/prompts/paec-prompts';
import { formatCurricularCatalogForPrompt, matchCurricularContent } from '@/lib/paec-curricular-helper';
import { generateWithRotation } from '@/lib/ai-provider';
import { logger } from '@/lib/logger';
import { parseAIResponse } from '@/lib/ai-response-parser';
import { PaecPaso6BlockSchema } from '@/lib/ai-schemas';
import type { MapeoRow, PlanOperativoRow } from '@/types/paec';
import {
  isLikelyLaboralUac,
  sanitizePaecOperationalPlan,
} from '@/lib/paec/plan-operativo-postprocessor';
import { SCHOOL_YEAR } from '@/lib/config';
import { sleep, type LegacyPlanOperativo, type PaecStepHandlerContext, type PaecStepHandlerResult } from './types';

export async function handlePaecSteps6To7(ctx: PaecStepHandlerContext): Promise<PaecStepHandlerResult> {
  const { id, step, project, teacherId, stepSystemPrompt, libraryContext } = ctx;
  const userPrompt = '';
  let fieldName = '';
  let stepResultData: object | null = null;

  switch (step) {
      case 6: {
        fieldName = 'fase3_plan_operativo_a';
        if (!project.fase2_cronograma || !project.fase2_detalle_curricular) {
          return { fieldName, userPrompt, stepResultData, errorResponse: { error: ({ error: 'Debes completar el Paso 4 (Cronograma) y el Paso 5 (Detalle Curricular) primero' }).error, status: 400 } };
        }

        const mapeo = (project.fase2_mapeo || []) as MapeoRow[];
        if (mapeo.length === 0) {
          return { fieldName, userPrompt, stepResultData, errorResponse: { error: ({ error: 'No hay asignaturas en el Mapeo Curricular para generar el Plan Operativo' }).error, status: 400 } };
        }

        // Asignaturas de semestres impares (1°, 3°, 5°)
        let uacListA = mapeo
          .filter((m) => Number(m.semester) % 2 === 1)
          .map((m) => ({ uacName: m.uacName, semester: Number(m.semester) }));

        // Si el proyecto es estrictamente Ciclo B pero ejecutan paso 6, usar todas
        if (uacListA.length === 0) {
          uacListA = mapeo.map((m) => ({ uacName: m.uacName, semester: Number(m.semester) }));
        }

        const cronStr = JSON.stringify(project.fase2_cronograma);
        const detStr = JSON.stringify(project.fase2_detalle_curricular);
        const allUacsStep6 = await getProgramsCatalogForPaec([1, 3, 5]);

        // Chunking anti-timeout: Bloques de máximo 6 UACs si supera 8 UACs
        const CHUNK_SIZE = uacListA.length > 8 ? 6 : uacListA.length;
        const chunks: { uacName: string; semester: number }[][] = [];
        for (let i = 0; i < uacListA.length; i += CHUNK_SIZE) {
          chunks.push(uacListA.slice(i, i + CHUNK_SIZE));
        }

        const allRowsSemA: PlanOperativoRow[] = [];
        const failedChunks: { block: number; error: string }[] = [];

        for (let i = 0; i < chunks.length; i++) {
          const blockNum = i + 1;
          const blockPrompt = buildPrompt6PlanOperativoSemestreA(
            cronStr,
            detStr,
            chunks[i],
            blockNum,
            chunks.length
          );

          const matchedCatalog = chunks[i].map((u) =>
            matchCurricularContent(u.uacName, u.semester, allUacsStep6) || {
              uac_name: u.uacName,
              semester: u.semester,
              component: 'fundamental',
              contenidos_formativos: null,
            }
          );
          const curricularBlock = formatCurricularCatalogForPrompt(matchedCatalog);
          let chunkPrompt = `${blockPrompt}\n\n${curricularBlock}`;
          if (libraryContext) {
            chunkPrompt = `${chunkPrompt}\n\n${libraryContext}`;
          }

          let chunkSuccess = false;
          let attempt = 0;
          const maxRetries = 2;
          let delay = 1500;

          while (attempt <= maxRetries && !chunkSuccess) {
            try {
              logger.info(`[PAEC-Step6] Generando bloque ${blockNum}/${chunks.length} Semestre A (intento ${attempt + 1}/${maxRetries + 1})...`);
              const blockText = await generateWithRotation(stepSystemPrompt, chunkPrompt, teacherId);
              if (!blockText) {
                throw new Error(`Respuesta vacía del proveedor en bloque ${blockNum}`);
              }

              const parseResult = parseAIResponse(blockText, PaecPaso6BlockSchema, {
                contextName: `paec_step_6_block_${blockNum}`,
              });

              if (!parseResult.success) {
                throw new Error(`Error de formato en bloque ${blockNum}: ${parseResult.error}`);
              }

              const blockRows = parseResult.data as PlanOperativoRow[];
              allRowsSemA.push(...blockRows);
              chunkSuccess = true;

              // Checkpoint parcial en BD
              await updatePaecProjectStep(id, teacherId, 6, 'fase3_plan_operativo_a', allRowsSemA);
              logger.info(`[PAEC-Step6] Checkpoint guardado tras bloque ${blockNum}/${chunks.length} (${allRowsSemA.length} filas acumuladas).`);
            } catch (err: unknown) {
              attempt++;
              const errMsg = err instanceof Error ? err.message : String(err);
              logger.warn(`[PAEC-Step6] Falla en bloque ${blockNum} (intento ${attempt}/${maxRetries + 1}): ${errMsg}`);
              if (attempt <= maxRetries) {
                await sleep(delay);
                delay *= 2;
              } else {
                failedChunks.push({
                  block: blockNum,
                  error: errMsg,
                });
              }
            }
          }
        }

        if (allRowsSemA.length === 0 && failedChunks.length > 0) {
          throw new Error(`Fallo al generar el Plan Semestre A: ${failedChunks.map((f) => `Bloque ${f.block} (${f.error})`).join(', ')}`);
        }

        // Fase C: Post-procesado determinista (paridad impar, dedupe excluyendo Sem 16, destilación progression y MCCEMS)
        const catalogMetaA = mapeo.map((m) => {
          const catMatch = matchCurricularContent(m.uacName, Number(m.semester), allUacsStep6);
          return {
            uacName: m.uacName,
            semester: Number(m.semester),
            component:
              m.component ||
              catMatch?.component ||
              (isLikelyLaboralUac(m.uacName) ? 'competencias_laborales' : 'fundamental'),
          };
        });
        const sanitizedA = sanitizePaecOperationalPlan(allRowsSemA, catalogMetaA, {
          parity: 1,
          cicloEscolar: SCHOOL_YEAR,
        });
        logger.info(
          `[PAEC-Step6] Post-procesado Semestre A: ${sanitizedA.rows.length} filas (paridad descartada=${sanitizedA.droppedParityCount}, dedupe=${sanitizedA.droppedDuplicateCount}, progression destiladas=${sanitizedA.distilledProgressionCount}).`
        );

        // Sincronizar también con la estructura legacy fase2_plan_operativo
        const existingSemB = project.fase3_plan_operativo_b || (project.fase2_plan_operativo as LegacyPlanOperativo | undefined)?.semestreB || [];
        await updatePaecProjectStep(id, teacherId, 6, 'fase2_plan_operativo', {
          semestreA: sanitizedA.rows,
          semestreB: existingSemB,
        });

        stepResultData = sanitizedA.rows;
        break;
      }

      // ----------------------------------------------------------------------
      // PASO 7: Plan Operativo Semestre B (Fases 4, 5 y 6: Semanas 1 a 16)
      // ----------------------------------------------------------------------
      case 7: {
        fieldName = 'fase3_plan_operativo_b';
        if (!project.fase2_cronograma || !project.fase2_detalle_curricular) {
          return { fieldName, userPrompt, stepResultData, errorResponse: { error: ({ error: 'Debes completar el Paso 4 (Cronograma) y el Paso 5 (Detalle Curricular) primero' }).error, status: 400 } };
        }

        const mapeo = (project.fase2_mapeo || []) as MapeoRow[];
        if (mapeo.length === 0) {
          return { fieldName, userPrompt, stepResultData, errorResponse: { error: ({ error: 'No hay asignaturas en el Mapeo Curricular para generar el Plan Operativo' }).error, status: 400 } };
        }

        // Asignaturas de semestres pares (2°, 4°, 6°)
        let uacListB = mapeo
          .filter((m) => Number(m.semester) % 2 === 0)
          .map((m) => ({ uacName: m.uacName, semester: Number(m.semester) }));

        // Si el proyecto es estrictamente Ciclo A pero ejecutan paso 7, usar todas
        if (uacListB.length === 0) {
          uacListB = mapeo.map((m) => ({ uacName: m.uacName, semester: Number(m.semester) }));
        }

        const cronStr = JSON.stringify(project.fase2_cronograma);
        const detStr = JSON.stringify(project.fase2_detalle_curricular);
        const allUacsStep7 = await getProgramsCatalogForPaec([2, 4, 6]);

        // Chunking anti-timeout: Bloques de máximo 6 UACs si supera 8 UACs
        const CHUNK_SIZE = uacListB.length > 8 ? 6 : uacListB.length;
        const chunks: { uacName: string; semester: number }[][] = [];
        for (let i = 0; i < uacListB.length; i += CHUNK_SIZE) {
          chunks.push(uacListB.slice(i, i + CHUNK_SIZE));
        }

        const allRowsSemB: PlanOperativoRow[] = [];
        const failedChunks: { block: number; error: string }[] = [];

        for (let i = 0; i < chunks.length; i++) {
          const blockNum = i + 1;
          const blockPrompt = buildPrompt7PlanOperativoSemestreB(
            cronStr,
            detStr,
            chunks[i],
            blockNum,
            chunks.length
          );

          const matchedCatalog = chunks[i].map((u) =>
            matchCurricularContent(u.uacName, u.semester, allUacsStep7) || {
              uac_name: u.uacName,
              semester: u.semester,
              component: 'fundamental',
              contenidos_formativos: null,
            }
          );
          const curricularBlock = formatCurricularCatalogForPrompt(matchedCatalog);
          let chunkPrompt = `${blockPrompt}\n\n${curricularBlock}`;
          if (libraryContext) {
            chunkPrompt = `${chunkPrompt}\n\n${libraryContext}`;
          }

          let chunkSuccess = false;
          let attempt = 0;
          const maxRetries = 2;
          let delay = 1500;

          while (attempt <= maxRetries && !chunkSuccess) {
            try {
              logger.info(`[PAEC-Step7] Generando bloque ${blockNum}/${chunks.length} Semestre B (intento ${attempt + 1}/${maxRetries + 1})...`);
              const blockText = await generateWithRotation(stepSystemPrompt, chunkPrompt, teacherId);
              if (!blockText) {
                throw new Error(`Respuesta vacía del proveedor en bloque ${blockNum}`);
              }

              const parseResult = parseAIResponse(blockText, PaecPaso6BlockSchema, {
                contextName: `paec_step_7_block_${blockNum}`,
              });

              if (!parseResult.success) {
                throw new Error(`Error de formato en bloque ${blockNum}: ${parseResult.error}`);
              }

              const blockRows = parseResult.data as PlanOperativoRow[];
              allRowsSemB.push(...blockRows);
              chunkSuccess = true;

              // Checkpoint parcial en BD
              await updatePaecProjectStep(id, teacherId, 7, 'fase3_plan_operativo_b', allRowsSemB);
              logger.info(`[PAEC-Step7] Checkpoint guardado tras bloque ${blockNum}/${chunks.length} (${allRowsSemB.length} filas acumuladas).`);
            } catch (err: unknown) {
              attempt++;
              const errMsg = err instanceof Error ? err.message : String(err);
              logger.warn(`[PAEC-Step7] Falla en bloque ${blockNum} (intento ${attempt}/${maxRetries + 1}): ${errMsg}`);
              if (attempt <= maxRetries) {
                await sleep(delay);
                delay *= 2;
              } else {
                failedChunks.push({
                  block: blockNum,
                  error: errMsg,
                });
              }
            }
          }
        }

        if (allRowsSemB.length === 0 && failedChunks.length > 0) {
          throw new Error(`Fallo al generar el Plan Semestre B: ${failedChunks.map((f) => `Bloque ${f.block} (${f.error})`).join(', ')}`);
        }

        // Fase C: Post-procesado determinista (paridad par, dedupe excluyendo Sem 16, destilación progression y MCCEMS)
        const catalogMetaB = mapeo.map((m) => {
          const catMatch = matchCurricularContent(m.uacName, Number(m.semester), allUacsStep7);
          return {
            uacName: m.uacName,
            semester: Number(m.semester),
            component:
              m.component ||
              catMatch?.component ||
              (isLikelyLaboralUac(m.uacName) ? 'competencias_laborales' : 'fundamental'),
          };
        });
        const sanitizedB = sanitizePaecOperationalPlan(allRowsSemB, catalogMetaB, {
          parity: 0,
          cicloEscolar: SCHOOL_YEAR,
        });
        logger.info(
          `[PAEC-Step7] Post-procesado Semestre B: ${sanitizedB.rows.length} filas (paridad descartada=${sanitizedB.droppedParityCount}, dedupe=${sanitizedB.droppedDuplicateCount}, progression destiladas=${sanitizedB.distilledProgressionCount}).`
        );

        // Sincronizar también con la estructura legacy fase2_plan_operativo
        const existingSemA = project.fase3_plan_operativo_a || (project.fase2_plan_operativo as LegacyPlanOperativo | undefined)?.semestreA || [];
        await updatePaecProjectStep(id, teacherId, 7, 'fase2_plan_operativo', {
          semestreA: existingSemA,
          semestreB: sanitizedB.rows,
        });

        stepResultData = sanitizedB.rows;
        break;
      }

      // ----------------------------------------------------------------------
      // PASO 8: Implementación Territorial, Minutas, Oficios y 6 Anexos (Chunking 3 Bloques)
      // ----------------------------------------------------------------------
  }

  return { fieldName, userPrompt, stepResultData };
}
