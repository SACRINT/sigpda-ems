/**
 * orchestrator.ts — Orquestador de extracción particionada de PMC previo con tolerancia a truncado.
 */

import type { PmcPlanElement, PmcPreviousExtractDTO } from '@/lib/prompts/pmc-extraction';
import {
  PMC_EXTRACTION_SYSTEM_PROMPT,
  buildPmcExtractionPrompt,
  buildPmcChunkExtractionPrompt,
  PmcPreviousExtractSchema,
} from '@/lib/prompts/pmc-extraction';
import {
  deriveMetasPreviasFromElementos,
  deriveElementosFromMetasPrevias,
} from '../plan-element-normalizer';
import { generateWithRotation } from '@/lib/ai-provider';
import { parseAIResponse } from '@/lib/ai-response-parser';
import { withTimeoutBudget, correctiveRetry } from '@/lib/ai-resilience';
import { logger } from '@/lib/logger';
import {
  findPlanActionSection,
  countDeterministicExpectedActivities,
  checkRawIsTruncated,
  partitionMarkdownDocument,
} from './document-scanner';
import {
  deduplicatePlanElements,
  deduplicateMetasPrevias,
  deduplicateStaffData,
  extractDeterministicSupervisorAndZone,
  salvagePlanElementsFromRaw,
} from './salvage-and-dedupe';

export interface PartitionedExtractionResult {
  success: boolean;
  data: PmcPreviousExtractDTO;
  warnings: string[];
  truncado: boolean;
  expectedActivities: number;
}

/**
 * Orquesta la extracción de PMC previo con particionado estructural y reintento en caso de
 * truncado o cobertura inferior al 90% (H-216).
 */
export async function extractPmcPreviousWithPartitioning(options: {
  documentText: string;
  teacherId?: string;
  isPremium?: boolean;
  deadline: number;
  contextName?: string;
}): Promise<PartitionedExtractionResult> {
  const { documentText, teacherId, isPremium = false, deadline, contextName = 'pmc-parse-previous' } = options;
  const warnings: string[] = [];
  const expectedActivities = countDeterministicExpectedActivities(documentText);

  // 1. Detección de particionado estructural respetando el Plan de Acción
  const { planText, startIndex, endIndex } = findPlanActionSection(documentText);
  const hasDistinctPlan = startIndex > 500 && planText.length > 500 && startIndex < documentText.length - 500;

  let chunks: string[] = [];
  if (hasDistinctPlan && (documentText.length > 15000 || expectedActivities >= 12)) {
    // Particionado estructural de alta fidelidad:
    // Trozo 1: Portada, Metadatos Institucionales, Diagnóstico Comunitario, FODA, Metas Generales (PLANEA) y Firmas / Aprobación final
    const tailText = endIndex !== -1 && endIndex < documentText.length ? documentText.slice(endIndex).trim() : '';
    const contextChunk = (documentText.slice(0, startIndex) + (tailText ? `\n\n# APROBACIÓN Y FIRMAS DEL PLANTEL\n${tailText}` : '')).trim();
    // Trozo 2..N: Sección especializada del Plan de Acción
    // Fragmentos balanceados (< 10,000 caracteres) respetando filas de tabla para evitar timeouts y saturación de tokens (document-extraction-engine)
    if (planText.length > 10000) {
      const planChunks = partitionMarkdownDocument(planText, 7000, 11000);
      chunks = [contextChunk, ...planChunks];
    } else {
      chunks = [contextChunk, planText.trim()];
    }
  } else if (documentText.length > 10000 || expectedActivities >= 12) {
    chunks = partitionMarkdownDocument(documentText, 7000, 11000);
  } else {
    chunks = [documentText];
  }

  let combinedData: PmcPreviousExtractDTO | null = null;
  let isTruncated = false;

  const extractSinglePass = async (textChunk: string, maxTokens = 32768) => {
    const systemPrompt = PMC_EXTRACTION_SYSTEM_PROMPT;
    const userPrompt = buildPmcExtractionPrompt(textChunk);

    const remainingBudget = Math.max(1, deadline - Date.now());
    const raw = await withTimeoutBudget(
      generateWithRotation(systemPrompt, userPrompt, teacherId, isPremium, {
        temperature: 0.1,
        jsonMode: true,
        maxTokens,
      }),
      remainingBudget
    );

    const truncated = checkRawIsTruncated(raw);

    let parsed = parseAIResponse(raw, PmcPreviousExtractSchema, {
      contextName,
      repairNullStrings: true,
    });

    if (!parsed.success) {
      parsed = await correctiveRetry({
        systemPrompt,
        previousRaw: raw,
        zodIssues: parsed.error || '',
        schema: PmcPreviousExtractSchema,
        callAI: (sys, user, remaining) =>
          withTimeoutBudget(
            generateWithRotation(sys, user, teacherId, isPremium, {
              temperature: 0,
              jsonMode: true,
              maxTokens,
            }),
            remaining
          ),
        deadline,
        contextName,
      });
    }

    return { parsed, raw, truncated };
  };

  const extractChunkPass = async (
    textChunk: string,
    chunkIndex: number,
    totalChunks: number,
    isInitialChunkWithContext = false,
    maxTokens = 32768
  ) => {
    const systemPrompt = PMC_EXTRACTION_SYSTEM_PROMPT;
    const userPrompt = isInitialChunkWithContext
      ? buildPmcExtractionPrompt(textChunk)
      : buildPmcChunkExtractionPrompt(textChunk, chunkIndex, totalChunks);

    const remainingBudget = Math.max(1, deadline - Date.now());
    const raw = await withTimeoutBudget(
      generateWithRotation(systemPrompt, userPrompt, teacherId, isPremium, {
        temperature: 0.1,
        jsonMode: true,
        maxTokens,
      }),
      remainingBudget
    );

    const truncated = checkRawIsTruncated(raw);

    let parsed = parseAIResponse(raw, PmcPreviousExtractSchema, {
      contextName: `${contextName}-chunk-${chunkIndex + 1}`,
      repairNullStrings: true,
    });

    let finalRaw = raw;
    if (!parsed.success && Date.now() < deadline - 5000) {
      let retryRaw = '';
      parsed = await correctiveRetry({
        systemPrompt,
        previousRaw: raw,
        zodIssues: parsed.error || '',
        schema: PmcPreviousExtractSchema,
        callAI: async (sys, user, remaining) => {
          retryRaw = await withTimeoutBudget(
            generateWithRotation(sys, user, teacherId, isPremium, {
              temperature: 0,
              jsonMode: true,
              maxTokens,
            }),
            remaining
          );
          return retryRaw;
        },
        deadline,
        contextName: `${contextName}-chunk-${chunkIndex + 1}-retry`,
      });
      if (retryRaw) {
        finalRaw = retryRaw;
      }
    }

    return { parsed, raw: finalRaw, truncated };
  };

  // 1ª Pasada (Directa o por trozos)
  if (chunks.length === 1) {
    const res = await extractSinglePass(chunks[0], 32768);
    isTruncated = res.truncated;

    if (res.parsed.success) {
      combinedData = res.parsed.data;
      if (res.parsed.warnings) warnings.push(...res.parsed.warnings);

      // Enriquecer deterministamente zona y supervisor si no fueron detectados por la IA
      const isMeaningful = (val?: string | null) =>
        Boolean(val && val.trim() && !/^(?:\(Sin detectar\)|Sin detectar|null|undefined|n\/a)$/i.test(val.trim()));
      const detZoneSup = extractDeterministicSupervisorAndZone(documentText, combinedData.directorName);
      if (!isMeaningful(combinedData.schoolZone) && detZoneSup.schoolZone) {
        combinedData.schoolZone = detZoneSup.schoolZone;
      }
      if (!isMeaningful(combinedData.supervisorName) && detZoneSup.supervisorName) {
        combinedData.supervisorName = detZoneSup.supervisorName;
      }
    } else {
      throw new Error(`No se pudieron estructurar los datos del PMC anterior: ${res.parsed.error}`);
    }

    // Comprobar si hubo truncado o cobertura insuficiente
    const extraidos = (combinedData.elementos_plan || []).length;
    const ratio = expectedActivities > 0 ? extraidos / expectedActivities : 1.0;

    // Si la 1ª pasada truncó o la cobertura es < 0.9 y hay más de 15 actividades esperadas, reintentar particionando
    if ((isTruncated || ratio < 0.9) && expectedActivities >= 15 && documentText.length > 20000) {
      // H-284: Evitar zona muerta entre 20k y 24k chars usando ventanas menores (8k-16k)
      const targetMaxChunk = Math.min(16000, Math.max(10000, Math.floor(documentText.length / 2) + 500));
      const targetMinChunk = Math.min(8000, Math.floor(targetMaxChunk * 0.7));
      let subChunks = partitionMarkdownDocument(documentText, targetMinChunk, targetMaxChunk);
      if (subChunks.length <= 1 && documentText.length > 10000) {
        const midPoint = Math.floor(documentText.length / 2);
        const splitIdx = documentText.indexOf('\n\n', midPoint);
        const cut = splitIdx !== -1 && splitIdx < midPoint + 2000 ? splitIdx : midPoint;
        subChunks = [documentText.slice(0, cut), documentText.slice(cut)];
      }

      logger.info(
        `[${contextName}] ⚠️ Cobertura insuficiente (${extraidos}/${expectedActivities}, ratio=${ratio.toFixed(2)}) o truncado=${isTruncated}. Activando particionado estructural en ${subChunks.length} trozos.`
      );
      warnings.push(
        `Activado particionado estructural por truncamiento o cobertura preliminar ${extraidos}/${expectedActivities}.`
      );

      if (subChunks.length > 1) {
        const accumulatedElementos: PmcPlanElement[] = [
          ...(combinedData.elementos_plan || []),
        ];
        const accumulatedMetas = [
          ...(combinedData.metas_institucionales_previas || []),
        ];
        const accumulatedStaff = [...(combinedData.staffData || [])];
        const accumulatedParticipantes = [...(combinedData.participantes || [])];

        // H-294: Ejecución concurrente con Promise.allSettled respetando presupuesto
        const chunkPromises = subChunks.map((chunk, i) =>
          extractChunkPass(chunk, i, subChunks.length, false)
        );
        const settled = await Promise.allSettled(chunkPromises);

        for (let i = 0; i < settled.length; i++) {
          const s = settled[i];
          if (s.status === 'fulfilled') {
            const subRes = s.value;
            if (subRes.truncated) isTruncated = true;
            if (subRes.parsed.success) {
              const subCount = (subRes.parsed.data.elementos_plan || []).length;
              if (subCount === 0 && subRes.raw && subRes.raw.includes('elementos_plan')) {
                const salvaged = salvagePlanElementsFromRaw(subRes.raw);
                if (salvaged.elementos.length > 0) {
                  accumulatedElementos.push(...salvaged.elementos);
                }
                if (salvaged.metas.length > 0) {
                  accumulatedMetas.push(...salvaged.metas);
                }
              } else if (subRes.parsed.data.elementos_plan) {
                accumulatedElementos.push(...subRes.parsed.data.elementos_plan);
              }
              if (subRes.parsed.data.metas_institucionales_previas) {
                accumulatedMetas.push(...subRes.parsed.data.metas_institucionales_previas);
              }
              if (subRes.parsed.data.staffData) {
                accumulatedStaff.push(...subRes.parsed.data.staffData);
              }
              if (subRes.parsed.data.participantes) {
                accumulatedParticipantes.push(...subRes.parsed.data.participantes);
              }
            } else {
              logger.warn(`[${contextName}] Error parseando subtrozo ${i + 1}: ${subRes.parsed.error}. Aplicando salvamento defensivo.`);
              const salvaged = salvagePlanElementsFromRaw(subRes.raw);
              if (salvaged.elementos.length > 0) {
                accumulatedElementos.push(...salvaged.elementos);
              }
              if (salvaged.metas.length > 0) {
                accumulatedMetas.push(...salvaged.metas);
              }
              if (salvaged.staff.length > 0) {
                accumulatedStaff.push(...salvaged.staff);
              }
            }
          } else {
            logger.warn(`[${contextName}] Falló promesa de subtrozo ${i + 1}:`, s.reason);
            warnings.push(`Fragmento ${i + 1} no completó su extracción a tiempo.`);
          }
        }

        if (accumulatedElementos.length === 0 && accumulatedMetas.length > 0) {
          accumulatedElementos.push(...deriveElementosFromMetasPrevias(accumulatedMetas));
        } else if (accumulatedMetas.length === 0 && accumulatedElementos.length > 0) {
          accumulatedMetas.push(...deriveMetasPreviasFromElementos(accumulatedElementos));
        }

        combinedData.elementos_plan = deduplicatePlanElements(accumulatedElementos);
        combinedData.metas_institucionales_previas = deduplicateMetasPrevias(accumulatedMetas);
        combinedData.staffData = deduplicateStaffData(accumulatedStaff);
        combinedData.participantes = [...accumulatedParticipantes];

        const isMeaningful = (val?: string | null) =>
          Boolean(val && val.trim() && !/^(?:\(Sin detectar\)|Sin detectar|null|undefined|n\/a)$/i.test(val.trim()));
        const detZoneSup = extractDeterministicSupervisorAndZone(documentText, combinedData.directorName);
        if (!isMeaningful(combinedData.schoolZone) && detZoneSup.schoolZone) {
          combinedData.schoolZone = detZoneSup.schoolZone;
        }
        if (!isMeaningful(combinedData.supervisorName) && detZoneSup.supervisorName) {
          combinedData.supervisorName = detZoneSup.supervisorName;
        }
      }
    }
  } else {
    // Particionado inicial (texto extenso o estructurado en Plan de Acción)
    // Ejecución secuencial controlada para garantizar presupuesto completo y evitar colisiones de red
    const settled: PromiseSettledResult<Awaited<ReturnType<typeof extractChunkPass>>>[] = [];
    for (let i = 0; i < chunks.length; i++) {
      if (Date.now() >= deadline - 4000) {
        warnings.push(`Fragmento inicial ${i + 1} no completó a tiempo.`);
        settled.push({ status: 'rejected', reason: new Error('Deadline reached') });
        break;
      }
      try {
        const res = await extractChunkPass(chunks[i], i, chunks.length, i === 0);
        settled.push({ status: 'fulfilled', value: res });
      } catch (err) {
        logger.warn(`[${contextName}] Falló trozo inicial ${i + 1}:`, err);
        warnings.push(`Fragmento inicial ${i + 1} no completó a tiempo.`);
        settled.push({ status: 'rejected', reason: err });
      }
    }

    const accumulatedElementos: PmcPlanElement[] = [];
    const accumulatedMetas: NonNullable<PmcPreviousExtractDTO['metas_institucionales_previas']> = [];
    const accumulatedStaff: NonNullable<PmcPreviousExtractDTO['staffData']> = [];
    const accumulatedParticipantes: NonNullable<PmcPreviousExtractDTO['participantes']> = [];

    for (let i = 0; i < settled.length; i++) {
      const s = settled[i];
      if (s.status === 'fulfilled') {
        const chunkRes = s.value;
        if (chunkRes.truncated) isTruncated = true;
        if (chunkRes.parsed.success) {
          const isMeaningful = (val?: string | null) =>
            Boolean(val && val.trim() && !/^(?:\(Sin detectar\)|Sin detectar|null|undefined|n\/a)$/i.test(val.trim()));

          if (!combinedData) {
            combinedData = chunkRes.parsed.data;
          } else {
            // Fusión bidireccional de metadatos institucionales entre fragmentos
            if (!isMeaningful(combinedData.schoolName) && isMeaningful(chunkRes.parsed.data.schoolName)) {
              combinedData.schoolName = chunkRes.parsed.data.schoolName;
            }
            if (!isMeaningful(combinedData.schoolCct) && isMeaningful(chunkRes.parsed.data.schoolCct)) {
              combinedData.schoolCct = chunkRes.parsed.data.schoolCct;
            }
            if (!isMeaningful(combinedData.schoolZone) && isMeaningful(chunkRes.parsed.data.schoolZone)) {
              combinedData.schoolZone = chunkRes.parsed.data.schoolZone;
            }
            if (!isMeaningful(combinedData.supervisorName) && isMeaningful(chunkRes.parsed.data.supervisorName)) {
              combinedData.supervisorName = chunkRes.parsed.data.supervisorName;
            }
            if (!isMeaningful(combinedData.directorName) && isMeaningful(chunkRes.parsed.data.directorName)) {
              combinedData.directorName = chunkRes.parsed.data.directorName;
            }
            if (!isMeaningful(combinedData.municipality) && isMeaningful(chunkRes.parsed.data.municipality)) {
              combinedData.municipality = chunkRes.parsed.data.municipality;
            }
            if (!isMeaningful(combinedData.locality) && isMeaningful(chunkRes.parsed.data.locality)) {
              combinedData.locality = chunkRes.parsed.data.locality;
            }
            if (chunkRes.parsed.data.foda) {
              if (!combinedData.foda) combinedData.foda = {};
              const cf = chunkRes.parsed.data.foda;
              if (cf.fortalezas && !combinedData.foda.fortalezas) combinedData.foda.fortalezas = cf.fortalezas;
              if (cf.oportunidades && !combinedData.foda.oportunidades) combinedData.foda.oportunidades = cf.oportunidades;
              if (cf.debilidades && !combinedData.foda.debilidades) combinedData.foda.debilidades = cf.debilidades;
              if (cf.amenazas && !combinedData.foda.amenazas) combinedData.foda.amenazas = cf.amenazas;
            }
            if (i === 0 && combinedData) {
              const prev: PmcPreviousExtractDTO = combinedData;
              combinedData = {
                ...chunkRes.parsed.data,
                ...prev,
                elementos_plan: prev.elementos_plan,
                metas_institucionales_previas: prev.metas_institucionales_previas,
              };
            }
          }
          const elemCount = (chunkRes.parsed.data.elementos_plan || []).length;
          if (elemCount === 0 && chunkRes.raw && chunkRes.raw.includes('elementos_plan')) {
            const salvaged = salvagePlanElementsFromRaw(chunkRes.raw);
            if (salvaged.elementos.length > 0) {
              accumulatedElementos.push(...salvaged.elementos);
            }
            if (salvaged.metas.length > 0) {
              accumulatedMetas.push(...salvaged.metas);
            }
          } else if (chunkRes.parsed.data.elementos_plan) {
            accumulatedElementos.push(...chunkRes.parsed.data.elementos_plan);
          }
          if (chunkRes.parsed.data.metas_institucionales_previas) {
            accumulatedMetas.push(...chunkRes.parsed.data.metas_institucionales_previas);
          }
          if (chunkRes.parsed.data.staffData) {
            accumulatedStaff.push(...chunkRes.parsed.data.staffData);
          }
          if (chunkRes.parsed.data.participantes) {
            accumulatedParticipantes.push(...chunkRes.parsed.data.participantes);
          }
        } else {
          logger.warn(`[${contextName}] Fragmento inicial ${i + 1} no superó Zod estricto: ${chunkRes.parsed.error}. Aplicando salvamento defensivo.`);
          const salvaged = salvagePlanElementsFromRaw(chunkRes.raw);
          if (salvaged.elementos.length > 0) {
            accumulatedElementos.push(...salvaged.elementos);
          }
          if (salvaged.metas.length > 0) {
            accumulatedMetas.push(...salvaged.metas);
          }
          if (salvaged.staff.length > 0) {
            accumulatedStaff.push(...salvaged.staff);
          }
          if (salvaged.schoolName && combinedData && !combinedData.schoolName) {
            combinedData.schoolName = salvaged.schoolName;
          }
          if (salvaged.directorName && combinedData && !combinedData.directorName) {
            combinedData.directorName = salvaged.directorName;
          }
          if (salvaged.elementos.length === 0 && salvaged.metas.length === 0) {
            warnings.push(`Fragmento ${i + 1} presentó anomalías de formato y no pudo estructurar sus metas.`);
          }
        }
      } else {
        logger.warn(`[${contextName}] Falló trozo inicial ${i + 1}:`, s.reason);
        warnings.push(`Fragmento inicial ${i + 1} no completó a tiempo.`);
      }
    }

    if (!combinedData) {
      throw new Error('No se pudo extraer ningún fragmento estructurado del PMC anterior.');
    }

    // Sincronización bidireccional determinista entre elementos_plan y metas_institucionales_previas
    if (accumulatedElementos.length === 0 && accumulatedMetas.length > 0) {
      accumulatedElementos.push(...deriveElementosFromMetasPrevias(accumulatedMetas));
    } else if (accumulatedMetas.length === 0 && accumulatedElementos.length > 0) {
      accumulatedMetas.push(...deriveMetasPreviasFromElementos(accumulatedElementos));
    }

    combinedData.elementos_plan = deduplicatePlanElements(accumulatedElementos);
    combinedData.metas_institucionales_previas = deduplicateMetasPrevias(accumulatedMetas);
    combinedData.staffData = deduplicateStaffData([...(combinedData.staffData || []), ...accumulatedStaff]);
    combinedData.participantes = [...(combinedData.participantes || []), ...accumulatedParticipantes];

    // Respaldo determinista final para schoolZone y supervisorName
    const isMeaningful = (val?: string | null) =>
      Boolean(val && val.trim() && !/^(?:\(Sin detectar\)|Sin detectar|null|undefined|n\/a)$/i.test(val.trim()));
    const detZoneSup = extractDeterministicSupervisorAndZone(documentText, combinedData.directorName);
    if (!isMeaningful(combinedData.schoolZone) && detZoneSup.schoolZone) {
      combinedData.schoolZone = detZoneSup.schoolZone;
    }
    if (!isMeaningful(combinedData.supervisorName) && detZoneSup.supervisorName) {
      combinedData.supervisorName = detZoneSup.supervisorName;
    }
  }

  // H-295: Bucle de completitud (gap-fill) si la extracción quedó por debajo del 90%
  let currentExtraidos = (combinedData.elementos_plan || []).length;
  const effectiveExpected = Math.max(
    expectedActivities,
    combinedData.totales_detectados?.actividades || 0,
    combinedData.totales_detectados?.metas || 0
  );

  let gapRound = 0;
  const MAX_GAP_ROUNDS = 2;

  while (
    currentExtraidos < 0.9 * effectiveExpected &&
    effectiveExpected >= 10 &&
    Date.now() < deadline - 10000 &&
    gapRound < MAX_GAP_ROUNDS
  ) {
    gapRound++;
    const missingCount = Math.max(1, effectiveExpected - currentExtraidos);
    logger.info(
      `[${contextName}] 🔄 Iniciando ronda ${gapRound} de gap-fill. Extraídos: ${currentExtraidos}/${effectiveExpected} (faltan ~${missingCount}). Tiempo restante: ${deadline - Date.now()}ms`
    );

    const alreadyExtractedList = (combinedData.elementos_plan || [])
      .map(
        (e, idx) =>
          `${idx + 1}. [${e.tipo || 'elemento'}] ${e.responsable ? `(${e.responsable}) ` : ''}${(
            e.texto_original ||
            e.texto_normalizado ||
            ''
          ).slice(0, 100)}`
      )
      .slice(0, 60)
      .join('\n');

    const gapFillUserPrompt = `Ya se han extraído exitosamente los siguientes ${currentExtraidos} elementos del plan:
"""
${alreadyExtractedList}
"""
Sin embargo, el documento indica un total de aproximadamente ${effectiveExpected} metas/actividades (faltan alrededor de ${missingCount} por estructurar).

TEXTO DEL DOCUMENTO:
"""
${documentText.slice(0, 180000)}
"""

Tu tarea es extraer ÚNICAMENTE los elementos, metas o actividades FALTANTES que NO aparezcan en la lista anterior.
Devuelve el JSON con la misma estructura (elementos_plan y metas_institucionales_previas). No repitas los que ya están en la lista previa.`;

    try {
      const remainingBudget = Math.max(1, deadline - Date.now() - 3000);
      const gapRaw = await withTimeoutBudget(
        generateWithRotation(PMC_EXTRACTION_SYSTEM_PROMPT, gapFillUserPrompt, teacherId, isPremium, {
          temperature: 0.1,
          jsonMode: true,
          maxTokens: 16384,
        }),
        remainingBudget
      );

      const parsedGap = parseAIResponse(gapRaw, PmcPreviousExtractSchema, {
        contextName: `${contextName}-gapfill-${gapRound}`,
        repairNullStrings: true,
      });

      let newElements = (parsedGap.success && parsedGap.data.elementos_plan) ? parsedGap.data.elementos_plan : [];
      let newMetas = (parsedGap.success && parsedGap.data.metas_institucionales_previas) ? parsedGap.data.metas_institucionales_previas : [];

      if (newElements.length === 0 && gapRaw) {
        const salvagedGap = salvagePlanElementsFromRaw(gapRaw);
        if (salvagedGap.elementos.length > 0) {
          newElements = salvagedGap.elementos;
          newMetas = salvagedGap.metas;
        }
      }

      if (newElements.length > 0) {
        const mergedElements = [...(combinedData.elementos_plan || []), ...newElements];
        const mergedMetas = [...(combinedData.metas_institucionales_previas || []), ...newMetas];

        combinedData.elementos_plan = deduplicatePlanElements(mergedElements);
        combinedData.metas_institucionales_previas = deduplicateMetasPrevias(mergedMetas);

        const newCount = combinedData.elementos_plan.length;
        logger.info(
          `[${contextName}] ✅ Ronda ${gapRound} de gap-fill completada: +${newCount - currentExtraidos} nuevos elementos (total ahora: ${newCount}/${effectiveExpected}).`
        );

        if (newCount <= currentExtraidos) {
          // No se descubrieron elementos nuevos
          break;
        }
        currentExtraidos = newCount;
      } else {
        logger.info(`[${contextName}] Ronda ${gapRound} de gap-fill no arrojó nuevos elementos.`);
        break;
      }
    } catch (gapErr) {
      logger.warn(`[${contextName}] Error en ronda ${gapRound} de gap-fill:`, gapErr);
      break;
    }
  }

  return {
    success: true,
    data: combinedData,
    warnings,
    truncado: isTruncated,
    expectedActivities,
  };
}

