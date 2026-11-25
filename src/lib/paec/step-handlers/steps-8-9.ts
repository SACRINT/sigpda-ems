import { updatePaecProjectStep } from '@/lib/db';
import {
  buildPrompt8Bloque1,
  buildPrompt8Bloque2,
  buildPrompt8Bloque3,
  buildPrompt9Bloque1,
  buildPrompt9Bloque2,
} from '@/lib/prompts/paec-prompts';
import { generateWithRotation } from '@/lib/ai-provider';
import { logger } from '@/lib/logger';
import { parseAIResponse } from '@/lib/ai-response-parser';
import {
  PaecPaso8Block1Schema,
  PaecPaso8Block2Schema,
  PaecPaso8Block3Schema,
  PaecPaso9Block1Schema,
  PaecPaso9Block2Schema,
} from '@/lib/ai-schemas';
import { sleep, type LegacyPlanOperativo, type PaecStepHandlerContext, type PaecStepHandlerResult } from './types';

export async function handlePaecSteps8To9(ctx: PaecStepHandlerContext): Promise<PaecStepHandlerResult> {
  const { id, step, project, teacherId, stepSystemPrompt, libraryContext } = ctx;
  const userPrompt = '';
  let fieldName = '';
  let stepResultData: object | null = null;

  switch (step) {
      case 8: {
        fieldName = 'fase3_implementacion';
        const hasPlan = project.fase3_plan_operativo_a || project.fase3_plan_operativo_b || project.fase2_plan_operativo;
        if (!hasPlan) {
          return { fieldName, userPrompt, stepResultData, errorResponse: { error: ({ error: 'Debes completar al menos un Plan Operativo (Paso 6 o 7) primero' }).error, status: 400 } };
        }

        const projectSummary = JSON.stringify({
          projectName: project.project_name,
          problemStatement: project.problem_statement,
          cycleType: project.cycle_type,
          cronograma: project.fase2_cronograma,
          justificacion: project.fase2_justificacion,
        });
        const planASummary = JSON.stringify(project.fase3_plan_operativo_a || (project.fase2_plan_operativo as LegacyPlanOperativo | undefined)?.semestreA || []);
        const planBSummary = JSON.stringify(project.fase3_plan_operativo_b || (project.fase2_plan_operativo as LegacyPlanOperativo | undefined)?.semestreB || []);

        const existingImpl = (project.fase3_implementacion as Record<string, unknown> | undefined) || {};
        const accumulatedPaso8: Record<string, unknown> = {
          ...existingImpl,
          anexos: {
            ...((existingImpl.anexos as Record<string, unknown>) || {}),
          },
        };

        const maxRetries = 2;

        // Bloque 1: Minutas, oficios, carta de invitación y sesión de lanzamiento
        const hasBlock1 = Boolean(accumulatedPaso8.cartaInvitacion && (accumulatedPaso8.oficiosAliados as unknown[])?.length);
        if (!hasBlock1) {
          const b1Prompt = buildPrompt8Bloque1(projectSummary, planASummary, planBSummary);
          const fullB1Prompt = libraryContext ? `${b1Prompt}\n\n${libraryContext}` : b1Prompt;
          let attempt = 0;
          let delay = 1500;
          let b1Success = false;

          while (attempt <= maxRetries && !b1Success) {
            try {
              logger.info(`[PAEC-Step8] Generando Bloque 1/3 (Minutas, Oficios, Lanzamiento) - intento ${attempt + 1}/${maxRetries + 1}...`);
              const text1 = await generateWithRotation(stepSystemPrompt, fullB1Prompt, teacherId);
              if (!text1) throw new Error('Respuesta vacía del proveedor en Bloque 1');
              const parsed = parseAIResponse(text1, PaecPaso8Block1Schema, { contextName: 'paec_step_8_block_1' });
              if (!parsed.success) throw new Error(`Error de validación en Bloque 1: ${parsed.error}`);

              Object.assign(accumulatedPaso8, parsed.data);
              b1Success = true;
              await updatePaecProjectStep(id, teacherId, 8, 'fase3_implementacion', accumulatedPaso8);
              logger.info('[PAEC-Step8] Checkpoint Bloque 1/3 guardado exitosamente.');
            } catch (err: unknown) {
              attempt++;
              const msg = err instanceof Error ? err.message : String(err);
              logger.warn(`[PAEC-Step8] Falla en Bloque 1 (intento ${attempt}/${maxRetries + 1}): ${msg}`);
              if (attempt <= maxRetries) {
                await sleep(delay);
                delay *= 2;
              } else {
                throw new Error(`Fallo definitivo en Bloque 1 (Paso 8): ${msg}`);
              }
            }
          }
        } else {
          logger.info('[PAEC-Step8] Bloque 1/3 ya existente en BD, omitiendo regeneración.');
        }

        // Bloque 2: Anexos 1 a 3 (Minuta, Seguimiento 16 semanas, Reporte Mensual)
        const anexosObj = accumulatedPaso8.anexos as Record<string, unknown>;
        const hasBlock2 = Boolean((anexosObj.anexo2Seguimiento as unknown[])?.length && (anexosObj.anexo3ReporteMensual as Record<string, unknown>)?.resumenEjecutivo);
        if (!hasBlock2) {
          const b2Prompt = buildPrompt8Bloque2(projectSummary, planASummary, planBSummary);
          const fullB2Prompt = libraryContext ? `${b2Prompt}\n\n${libraryContext}` : b2Prompt;
          let attempt = 0;
          let delay = 1500;
          let b2Success = false;

          while (attempt <= maxRetries && !b2Success) {
            try {
              logger.info(`[PAEC-Step8] Generando Bloque 2/3 (Anexos 1-3) - intento ${attempt + 1}/${maxRetries + 1}...`);
              const text2 = await generateWithRotation(stepSystemPrompt, fullB2Prompt, teacherId);
              if (!text2) throw new Error('Respuesta vacía del proveedor en Bloque 2');
              const parsed = parseAIResponse(text2, PaecPaso8Block2Schema, { contextName: 'paec_step_8_block_2' });
              if (!parsed.success) throw new Error(`Error de validación en Bloque 2: ${parsed.error}`);

              const b2Data = parsed.data as Record<string, unknown>;
              accumulatedPaso8.anexos = {
                ...(accumulatedPaso8.anexos as Record<string, unknown>),
                ...b2Data,
              };
              b2Success = true;
              await updatePaecProjectStep(id, teacherId, 8, 'fase3_implementacion', accumulatedPaso8);
              logger.info('[PAEC-Step8] Checkpoint Bloque 2/3 guardado exitosamente.');
            } catch (err: unknown) {
              attempt++;
              const msg = err instanceof Error ? err.message : String(err);
              logger.warn(`[PAEC-Step8] Falla en Bloque 2 (intento ${attempt}/${maxRetries + 1}): ${msg}`);
              if (attempt <= maxRetries) {
                await sleep(delay);
                delay *= 2;
              } else {
                throw new Error(`Fallo definitivo en Bloque 2 (Paso 8): ${msg}`);
              }
            }
          }
        } else {
          logger.info('[PAEC-Step8] Bloque 2/3 ya existente en BD, omitiendo regeneración.');
        }

        // Bloque 3: Anexos 4 a 6 (Impacto, Autoevaluación, Colegiado)
        const anexosObjAfterB2 = accumulatedPaso8.anexos as Record<string, unknown>;
        const hasBlock3 = Boolean((anexosObjAfterB2.anexo4ImpactoComunidad as Record<string, unknown>)?.reactivos && (anexosObjAfterB2.anexo5AutoevaluacionEstudiantes as Record<string, unknown>)?.reactivos);
        if (!hasBlock3) {
          const b3Prompt = buildPrompt8Bloque3(projectSummary, planASummary, planBSummary);
          const fullB3Prompt = libraryContext ? `${b3Prompt}\n\n${libraryContext}` : b3Prompt;
          let attempt = 0;
          let delay = 1500;
          let b3Success = false;

          while (attempt <= maxRetries && !b3Success) {
            try {
              logger.info(`[PAEC-Step8] Generando Bloque 3/3 (Anexos 4-6) - intento ${attempt + 1}/${maxRetries + 1}...`);
              const text3 = await generateWithRotation(stepSystemPrompt, fullB3Prompt, teacherId);
              if (!text3) throw new Error('Respuesta vacía del proveedor en Bloque 3');
              const parsed = parseAIResponse(text3, PaecPaso8Block3Schema, { contextName: 'paec_step_8_block_3' });
              if (!parsed.success) throw new Error(`Error de validación en Bloque 3: ${parsed.error}`);

              const b3Data = parsed.data as Record<string, unknown>;
              accumulatedPaso8.anexos = {
                ...(accumulatedPaso8.anexos as Record<string, unknown>),
                ...b3Data,
              };
              b3Success = true;
              await updatePaecProjectStep(id, teacherId, 8, 'fase3_implementacion', accumulatedPaso8);
              logger.info('[PAEC-Step8] Checkpoint Bloque 3/3 guardado exitosamente.');
            } catch (err: unknown) {
              attempt++;
              const msg = err instanceof Error ? err.message : String(err);
              logger.warn(`[PAEC-Step8] Falla en Bloque 3 (intento ${attempt}/${maxRetries + 1}): ${msg}`);
              if (attempt <= maxRetries) {
                await sleep(delay);
                delay *= 2;
              } else {
                throw new Error(`Fallo definitivo en Bloque 3 (Paso 8): ${msg}`);
              }
            }
          }
        } else {
          logger.info('[PAEC-Step8] Bloque 3/3 ya existente en BD, omitiendo regeneración.');
        }

        stepResultData = accumulatedPaso8;
        break;
      }

      // ----------------------------------------------------------------------
      // PASO 9: Gobernanza Escolar e Informe de Rendición de Cuentas (Chunking 2 Bloques)
      // ----------------------------------------------------------------------
      case 9: {
        fieldName = 'fase4_gobernanza_e_informe';
        const hasImpl = project.fase3_implementacion || project.fase2_anexos;
        if (!hasImpl) {
          return { fieldName, userPrompt, stepResultData, errorResponse: { error: ({ error: 'Debes completar el Paso 8 (Implementación y Anexos) primero' }).error, status: 400 } };
        }

        const projectSummary = JSON.stringify({
          projectName: project.project_name,
          problemStatement: project.problem_statement,
          cycleType: project.cycle_type,
          cronograma: project.fase2_cronograma,
          justificacion: project.fase2_justificacion,
        });
        const planASummary = JSON.stringify(project.fase3_plan_operativo_a || (project.fase2_plan_operativo as LegacyPlanOperativo | undefined)?.semestreA || []);
        const planBSummary = JSON.stringify(project.fase3_plan_operativo_b || (project.fase2_plan_operativo as LegacyPlanOperativo | undefined)?.semestreB || []);
        const implSummary = JSON.stringify(project.fase3_implementacion || project.fase2_anexos || {});

        const existingGob = (project.fase4_gobernanza_e_informe as Record<string, unknown> | undefined) || {};
        const accumulatedPaso9: Record<string, unknown> = {
          ...existingGob,
        };

        const maxRetries = 2;

        // Bloque 1: Gobernanza Colegiada (calendario en 4 niveles y metodología)
        const gobObj = (accumulatedPaso9.gobernanza as Record<string, unknown> | undefined) || {};
        const hasBlock1 = Boolean((gobObj.calendario as unknown[])?.length >= 2 && gobObj.metodologiaEvaluacion);
        if (!hasBlock1) {
          const b1Prompt = buildPrompt9Bloque1(projectSummary, planASummary, planBSummary, implSummary);
          const fullB1Prompt = libraryContext ? `${b1Prompt}\n\n${libraryContext}` : b1Prompt;
          let attempt = 0;
          let delay = 1500;
          let b1Success = false;

          while (attempt <= maxRetries && !b1Success) {
            try {
              logger.info(`[PAEC-Step9] Generando Bloque 1/2 (Gobernanza Colegiada) - intento ${attempt + 1}/${maxRetries + 1}...`);
              const text1 = await generateWithRotation(stepSystemPrompt, fullB1Prompt, teacherId);
              if (!text1) throw new Error('Respuesta vacía del proveedor en Bloque 1');
              const parsed = parseAIResponse(text1, PaecPaso9Block1Schema, { contextName: 'paec_step_9_block_1' });
              if (!parsed.success) throw new Error(`Error de validación en Bloque 1: ${parsed.error}`);

              Object.assign(accumulatedPaso9, parsed.data);
              b1Success = true;
              await updatePaecProjectStep(id, teacherId, 9, 'fase4_gobernanza_e_informe', accumulatedPaso9);
              logger.info('[PAEC-Step9] Checkpoint Bloque 1/2 guardado exitosamente.');
            } catch (err: unknown) {
              attempt++;
              const msg = err instanceof Error ? err.message : String(err);
              logger.warn(`[PAEC-Step9] Falla en Bloque 1 (intento ${attempt}/${maxRetries + 1}): ${msg}`);
              if (attempt <= maxRetries) {
                await sleep(delay);
                delay *= 2;
              } else {
                throw new Error(`Fallo definitivo en Bloque 1 (Paso 9): ${msg}`);
              }
            }
          }
        } else {
          logger.info('[PAEC-Step9] Bloque 1/2 ya existente en BD, omitiendo regeneración.');
        }

        // Bloque 2: Informe de Rendición de Cuentas para la Supervisión de Zona
        const infObj = (accumulatedPaso9.informeSupervision as Record<string, unknown> | undefined) || {};
        const hasBlock2 = Boolean(infObj.resumenEjecutivo && (infObj.metasVsLogros as unknown[])?.length);
        if (!hasBlock2) {
          const schoolCtxRaw = (project.school_context ?? {}) as Record<string, unknown>;
          const schoolZoneRaw = typeof schoolCtxRaw.schoolZone === 'string' ? schoolCtxRaw.schoolZone : undefined;
          const b2Prompt = buildPrompt9Bloque2(projectSummary, planASummary, planBSummary, implSummary, schoolZoneRaw);
          const fullB2Prompt = libraryContext ? `${b2Prompt}\n\n${libraryContext}` : b2Prompt;
          let attempt = 0;
          let delay = 1500;
          let b2Success = false;

          while (attempt <= maxRetries && !b2Success) {
            try {
              logger.info(`[PAEC-Step9] Generando Bloque 2/2 (Informe de Supervisión) - intento ${attempt + 1}/${maxRetries + 1}...`);
              const text2 = await generateWithRotation(stepSystemPrompt, fullB2Prompt, teacherId);
              if (!text2) throw new Error('Respuesta vacía del proveedor en Bloque 2');
              const parsed = parseAIResponse(text2, PaecPaso9Block2Schema, { contextName: 'paec_step_9_block_2' });
              if (!parsed.success) throw new Error(`Error de validación en Bloque 2: ${parsed.error}`);

              Object.assign(accumulatedPaso9, parsed.data);
              b2Success = true;
              await updatePaecProjectStep(id, teacherId, 9, 'fase4_gobernanza_e_informe', accumulatedPaso9);
              logger.info('[PAEC-Step9] Checkpoint Bloque 2/2 guardado exitosamente.');
            } catch (err: unknown) {
              attempt++;
              const msg = err instanceof Error ? err.message : String(err);
              logger.warn(`[PAEC-Step9] Falla en Bloque 2 (intento ${attempt}/${maxRetries + 1}): ${msg}`);
              if (attempt <= maxRetries) {
                await sleep(delay);
                delay *= 2;
              } else {
                throw new Error(`Fallo definitivo en Bloque 2 (Paso 9): ${msg}`);
              }
            }
          }
        } else {
          logger.info('[PAEC-Step9] Bloque 2/2 ya existente en BD, omitiendo regeneración.');
        }

        stepResultData = accumulatedPaso9;
        break;
      }
  }

  return { fieldName, userPrompt, stepResultData };
}
