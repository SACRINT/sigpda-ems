/**
 * pmc-partitioner.ts
 *
 * Utilidades deterministas para particionado estructural y cálculo de cobertura
 * real en documentos de PMC previo (>40 actividades/metas sin truncar, H-216).
 */

import type { PmcPlanElement, PmcPreviousExtractDTO } from '@/lib/prompts/pmc-extraction';
import {
  PMC_EXTRACTION_SYSTEM_PROMPT,
  buildPmcExtractionPrompt,
  buildPmcChunkExtractionPrompt,
  PmcPreviousExtractSchema,
} from '@/lib/prompts/pmc-extraction';
import { calculateWordOverlap } from './plan-element-normalizer';
import { normalizeStaffName } from './staff-reconciler';
import { generateWithRotation } from '@/lib/ai-provider';
import { parseAIResponse } from '@/lib/ai-response-parser';
import { withTimeoutBudget, correctiveRetry } from '@/lib/ai-resilience';
import { logger } from '@/lib/logger';

/**
 * Localiza la sección acotada del Plan de Acción en el documento,
 * excluyendo el índice inicial (TOC) y la sección final de firmas / aprobación (H-298).
 */
export function findPlanActionSection(documentText: string): { planText: string; startIndex: number; endIndex: number } {
  if (!documentText) return { planText: '', startIndex: -1, endIndex: -1 };

  // 1. Encontrar todos los candidatos que contengan PLAN DE ACCIÓN
  const regex = /(?:^|\n)[*_#\s]*(?:\d+[\.\)\-]\s*)?PLAN\s+DE\s+ACCI[ÓO]N\b/gi;
  const matches = [...documentText.matchAll(regex)];

  let startIdx = -1;

  for (const m of matches) {
    const idx = m.index ?? -1;
    if (idx === -1) continue;

    // Obtener la línea completa
    const lineEnd = documentText.indexOf('\n', idx + 1);
    const line = documentText.slice(idx, lineEnd !== -1 ? lineEnd : idx + 300);

    // Descartar si es del índice (TOC) con puntos suspensivos o comas de relleno
    if (/[\.·…]{3,}|,{3,}/.test(line)) continue;

    // Descartar si es "PLAN DE ACCIÓN TUTORIAL"
    if (/PLAN\s+DE\s+ACCI[ÓO]N\s+TUTORIAL/i.test(line)) continue;

    startIdx = idx;
    break;
  }

  if (startIdx === -1) {
    startIdx = documentText.lastIndexOf('PLAN DE ACCIÓN');
    if (startIdx === -1) {
      startIdx = documentText.search(/PLAN\s+DE\s+ACCI[ÓO]N/i);
    }
  }

  if (startIdx === -1) {
    return { planText: documentText, startIndex: 0, endIndex: documentText.length };
  }

  const textFromPlan = documentText.slice(startIdx);

  // 2. Encontrar fin del plan: tabla de firmas / aprobación / personal participante / anexos
  const endRegex = /(?:^|\n)[*_#\s]*(?:\d+[\.\)\-]\s*)?(?:APROBACI[ÓO]N\s+DEL\s+PMC|PERSONAL\s+PARTICIPANTE|FIRMAS\s+DE\s+AUTORIZACI[ÓO]N|FIRMAS\s+DE\s+CONFORMIDAD|DIRECTORIO\s+DEL\s+PLANTEL)/i;
  const endMatch = textFromPlan.search(endRegex);

  const endIndex = endMatch !== -1 ? startIdx + endMatch : documentText.length;
  return {
    planText: documentText.slice(startIdx, endIndex),
    startIndex: startIdx,
    endIndex,
  };
}

/**
 * Cuenta filas de datos reales de tablas markdown dentro de la sección acotada del 'PLAN DE ACCIÓN' (H-293, H-298).
 * Identifica líneas iniciadas y terminadas por '|', excluyendo separadores (|---|) y filas de encabezado.
 */
export function countPlanTableRows(documentText: string): number {
  if (!documentText) return 0;

  const { planText } = findPlanActionSection(documentText);
  const textToScan = planText && planText.length > 100 ? planText : documentText;

  const lines = textToScan.split(/\r?\n/);
  let dataRowCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith('|') || !line.endsWith('|')) continue;

    // Separadores markdown tipo |---|---|---|
    if (/^\|[\s\-:|]+\|$/.test(line)) continue;

    // Fila de encabezado: si la línea siguiente es un separador de tabla, es encabezado
    const nextLine = (lines[i + 1] || '').trim();
    if (/^\|[\s\-:|]+\|$/.test(nextLine)) continue;

    // Descartar filas vacías de tabla | | | |
    const cells = line.split('|').slice(1, -1).map((c) => c.trim()).filter(Boolean);
    if (cells.length === 0) continue;

    dataRowCount++;
  }

  return dataRowCount;
}

/**
 * Conteo determinista de actividades/metas esperadas a partir del texto del documento.
 * No depende de totales_detectados de la IA.
 * En documentos con tablas markdown del plan de acción cuenta filas reales; si no, aplica heurístico acotado (H-293, H-298).
 */
export function countDeterministicExpectedActivities(documentText: string): number {
  if (!documentText) return 0;

  // Acotar la sección del Plan de Acción excluyendo TOC y firmas finales (H-298)
  const { planText } = findPlanActionSection(documentText);
  const textToScan = planText && planText.length > 200 ? planText : documentText;

  // H-293: Conteo de filas reales de tablas markdown en el Plan de Acción
  const planTableRows = countPlanTableRows(documentText);
  if (planTableRows > 0) {
    return planTableRows;
  }

  // 1. Conteo determinista por bloques temáticos y ámbitos del plan
  const matchAmbitos = (
    textToScan.match(
      /(?:Ámbito\s*\/\s*Categoría|Tema:|__\*Reprobación|\*Reprobación|REPROBACIÓN|FORMACIÓN Y ACTUALIZACIÓN|Otras [Aa]ctividades)/gi
    ) || []
  ).length;

  const matchMetaKeywords = (
    textToScan.match(/(?:^|\n)[*_#\s]*(?:Meta\(s\)|Meta:?)/gi) || []
  ).length;

  const matchColon = (
    textToScan.match(/(?:^|\n)[*_#\s]*(?:\d+[\.\-]\s*)?Actividad(?:es)?\s*[:\(\-]/gi) || []
  ).length;

  const matchResponsables = (
    textToScan.match(/(?:ING\.|LIC\.|MTRO\.|MTRA\.|PROFR\.|PROFRA\.)\s+[A-ZÁÉÍÓÚÑ]/gi) || []
  ).length;

  const heuristico = Math.max(matchAmbitos, matchMetaKeywords + matchColon, matchResponsables);
  return heuristico > 0 ? heuristico : 1;
}

/**
 * Verifica si una respuesta textual de la IA llegó truncada (no cerró su bloque JSON).
 */
export function checkRawIsTruncated(rawText: string): boolean {
  if (!rawText || !rawText.trim()) return false;
  const trimmed = rawText.trim();
  // Quitar cercas markdown al final si existen
  const stripped = trimmed.replace(/```\s*$/i, '').trim();
  // Un JSON válido de objeto o arreglo debe terminar en } o ]
  return !stripped.endsWith('}') && !stripped.endsWith(']');
}

/**
 * Particiona el documento Markdown respetando fronteras estructurales
 * (sección de plan de acción, categorías, firmas, encabezados, docentes, actividades).
 */
export function partitionMarkdownDocument(
  markdown: string,
  minChunkSize = 8000,
  maxChunkSize = 16000
): string[] {
  if (!markdown || markdown.length <= maxChunkSize) {
    return [markdown];
  }

  const chunks: string[] = [];
  let remaining = markdown;

  while (remaining.length > 0) {
    if (remaining.length <= maxChunkSize) {
      chunks.push(remaining);
      break;
    }

    const windowStart = Math.min(minChunkSize, remaining.length - 1);
    const windowEnd = Math.min(maxChunkSize, remaining.length);
    const searchWindow = remaining.slice(windowStart, windowEnd);

    // Patrones de corte en orden jerárquico de prioridad estructural (H-298)
    const structuralPatterns = [
      /\n(?=[*_#\s]*(?:(?:6\.\s*)?PLAN\s+DE\s+ACCI[ÓO]N\b|Categor[íi]a\s*\d+:))/gi,
      /\n(?=[*_#\s]*(?:APROBACI[ÓO]N\s+DEL\s+PMC|PERSONAL\s+PARTICIPANTE|FIRMAS\s+DE\s+AUTORIZACI[ÓO]N))/gi,
      /\n(?=#+\s)/g,
      /\n(?=__\*(?:Reprobaci[oó]n|Actividades|ACCIÓN))/gi,
      /\n(?=(?:__)?(?:\d+[\.\-]\s*)?Actividad(?:es)?:?)/gi,
      /\n(?=(?:ING\.|LIC\.|MTRO\.|MTRA\.|PROFR\.|PROFRA\.|DOCENTE|DIRECTOR)\s+[A-ZÁÉÍÓÚÑ])/g,
      /\n(?=\|[^\n]+\|\n\|[\s\-:|]+\|)/g,
      /\n\n/g,
      /\n/g,
    ];

    let bestSplitIndex = -1;
    for (const pattern of structuralPatterns) {
      const matches = [...searchWindow.matchAll(pattern)];
      if (matches.length > 0) {
        const lastMatch = matches[matches.length - 1];
        bestSplitIndex = windowStart + lastMatch.index!;
        break;
      }
    }

    if (bestSplitIndex === -1) {
      bestSplitIndex = Math.min(maxChunkSize, remaining.length);
    }

    const chunk = remaining.slice(0, bestSplitIndex).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }
    remaining = remaining.slice(bestSplitIndex).trim();
  }

  return chunks.length > 0 ? chunks : [markdown];
}

/**
 * Deduplica elementos del plan de acción basándose en texto normalizado idéntico o solapamiento estricto bidireccional.
 * H-294: No fusiona elementos si sus responsables son distintos (evita colapso de actividades idénticas entre docentes).
 */
export function deduplicatePlanElements(elements: PmcPlanElement[]): PmcPlanElement[] {
  const result: PmcPlanElement[] = [];

  for (const elem of elements) {
    const textA = (elem.texto_normalizado || elem.texto_original || '').trim();
    if (!textA) continue;

    const exists = result.some((existing) => {
      // No fusionar elementos si explícitamente tienen tipos distintos (meta vs actividad)
      if (elem.tipo && existing.tipo && elem.tipo !== existing.tipo) return false;

      // H-294: Clave incluye responsable. Si ambos tienen responsable y difieren, NO son el mismo elemento
      const respA = normalizeStaffName(elem.responsable);
      const respB = normalizeStaffName(existing.responsable);
      if (respA && respB && respA !== respB) return false;

      const textB = (existing.texto_normalizado || existing.texto_original || '').trim();
      if (textA.toLowerCase() === textB.toLowerCase()) return true;
      const lenRatio = Math.min(textA.length, textB.length) / Math.max(textA.length, textB.length);
      // H-231: Umbral estricto para evitar colisión de metas diferentes con formato similar
      if (lenRatio >= 0.92 && calculateWordOverlap(textA, textB) >= 0.95) return true;
      return false;
    });

    if (!exists) {
      result.push(elem);
    }
  }

  return result;
}

/**
 * Deduplica metas previas basándose en redacción idéntica o solapamiento estricto bidireccional.
 * H-294: No fusiona metas si sus responsables son distintos.
 */
export function deduplicateMetasPrevias<
  T extends {
    meta?: string | null;
    texto_original?: string | null;
    categoria?: string | null;
    responsable?: string | null;
    personal_designado?: string | null;
  }
>(metas: T[]): T[] {
  const result: T[] = [];

  for (const m of metas) {
    const textA = (m.meta || m.texto_original || '').trim();
    if (!textA) continue;

    const exists = result.some((existing) => {
      // No fusionar metas si tienen categorías explícitamente distintas
      if (
        m.categoria &&
        existing.categoria &&
        m.categoria.trim().toLowerCase() !== existing.categoria.trim().toLowerCase()
      ) {
        return false;
      }

      // H-294: Clave incluye responsable normalizado
      const respA = normalizeStaffName(m.responsable || m.personal_designado);
      const respB = normalizeStaffName(existing.responsable || existing.personal_designado);
      if (respA && respB && respA !== respB) return false;

      const textB = (existing.meta || existing.texto_original || '').trim();
      if (textA.toLowerCase() === textB.toLowerCase()) return true;
      const lenRatio = Math.min(textA.length, textB.length) / Math.max(textA.length, textB.length);
      // H-231: Umbral estricto para evitar colisión de metas
      if (lenRatio >= 0.92 && calculateWordOverlap(textA, textB) >= 0.95) return true;
      return false;
    });

    if (!exists) {
      result.push(m);
    }
  }

  return result;
}

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

  // Decisión de particionado temprano: si supera 20,000 chars o tiene >= 15 actividades esperadas (H-298)
  const shouldPartitionEarly = documentText.length > 20000 || expectedActivities >= 15;
  const chunks = shouldPartitionEarly
    ? partitionMarkdownDocument(documentText, 8000, 16000)
    : [documentText];

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

    if (!parsed.success && Date.now() < deadline - 5000) {
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
        contextName: `${contextName}-chunk-${chunkIndex + 1}-retry`,
      });
    }

    return { parsed, raw, truncated };
  };

  // 1ª Pasada (Directa o por trozos)
  if (chunks.length === 1) {
    const res = await extractSinglePass(chunks[0], 32768);
    isTruncated = res.truncated;

    if (res.parsed.success) {
      combinedData = res.parsed.data;
      if (res.parsed.warnings) warnings.push(...res.parsed.warnings);
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
              if (subRes.parsed.data.elementos_plan) {
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
              logger.warn(`[${contextName}] Error parseando subtrozo ${i + 1}: ${subRes.parsed.error}`);
            }
          } else {
            logger.warn(`[${contextName}] Falló promesa de subtrozo ${i + 1}:`, s.reason);
            warnings.push(`Fragmento ${i + 1} no completó su extracción a tiempo.`);
          }
        }

        combinedData.elementos_plan = deduplicatePlanElements(accumulatedElementos);
        combinedData.metas_institucionales_previas = deduplicateMetasPrevias(accumulatedMetas);
        combinedData.staffData = accumulatedStaff;
        combinedData.participantes = accumulatedParticipantes;
      }
    }
  } else {
    // Particionado inicial (texto > 40k chars)
    // H-294: Ejecución concurrente con Promise.allSettled
    const chunkPromises = chunks.map((chunk, i) =>
      extractChunkPass(chunk, i, chunks.length, i === 0)
    );
    const settled = await Promise.allSettled(chunkPromises);

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
          if (!combinedData) {
            combinedData = chunkRes.parsed.data;
          } else if (i === 0) {
            combinedData = {
              ...chunkRes.parsed.data,
              elementos_plan: combinedData.elementos_plan,
              metas_institucionales_previas: combinedData.metas_institucionales_previas,
            };
          }
          if (chunkRes.parsed.data.elementos_plan) {
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
        }
      } else {
        logger.warn(`[${contextName}] Falló trozo inicial ${i + 1}:`, s.reason);
        warnings.push(`Fragmento inicial ${i + 1} no completó a tiempo.`);
      }
    }

    if (!combinedData) {
      throw new Error('No se pudo extraer ningún fragmento estructurado del PMC anterior.');
    }

    combinedData.elementos_plan = deduplicatePlanElements(accumulatedElementos);
    combinedData.metas_institucionales_previas = deduplicateMetasPrevias(accumulatedMetas);
    combinedData.staffData = [...(combinedData.staffData || []), ...accumulatedStaff];
    combinedData.participantes = [...(combinedData.participantes || []), ...accumulatedParticipantes];
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

      if (parsedGap.success && parsedGap.data.elementos_plan && parsedGap.data.elementos_plan.length > 0) {
        const newElements = parsedGap.data.elementos_plan;
        const newMetas = parsedGap.data.metas_institucionales_previas || [];

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
