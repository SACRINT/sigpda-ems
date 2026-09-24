/**
 * ai-resilience.ts — Utilidades Transversales de Resiliencia para Servicios de IA y OCR
 * SIGPDA-EMS · MCCEMS Ciclo Escolar 2026-2027
 * 
 * Centraliza la detección estricta de caídas de proveedores de IA (Google Gemini,
 * OpenRouter, proxies HTTP), presupuestos de tiempo de ejecución (withTimeoutBudget)
 * y mensajes institucionales normalizados para los usuarios.
 * 
 * Previene el acoplamiento directo entre subsistemas de Nivel 1 (PMC, PAEC, Planeaciones).
 */

import { z } from 'zod';
import { parseAIResponse, type ParseAIResponseResult } from './ai-response-parser';
import { logger } from './logger';

export const AI_OUTAGE_USER_MESSAGE =
  'El servicio de Inteligencia Artificial está experimentando alta demanda o saturación temporal. Tu documento es válido; por favor espera un par de minutos y reintenta la carga.';

/**
 * Clasifica de forma acotada y rigurosa si un error proviene de saturación, caída
 * de cuota o indisponibilidad en los servicios de IA o proxies upstream.
 * 
 * Evita falsos positivos con errores de base de datos (Postgres, Neon) o sintaxis general.
 */
export function isUpstreamAIError(err: unknown): boolean {
  if (!err) return false;
  const msg = err instanceof Error ? err.message : String(err);
  const status = (err as { status?: number; statusCode?: number }).status ||
                 (err as { status?: number; statusCode?: number }).statusCode;
  const lowerMsg = msg.toLowerCase();
  return (
    status === 503 ||
    status === 504 ||
    status === 429 ||
    lowerMsg.includes('http 503') ||
    lowerMsg.includes('service unavailable') ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('high demand') ||
    msg.includes('All AI providers exhausted') ||
    lowerMsg.includes('rate-limit') ||
    lowerMsg.includes('rate limit') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('MODEL_CAPACITY_EXCEEDED') ||
    msg.includes('aborted due to timeout')
  );
}

/**
 * Envoltorio de promesa con límite de tiempo estricto.
 * Si la promesa subyacente no concluye dentro del presupuesto indicado,
 * se rechaza con un Error etiquetado con HTTP status 503.
 */
export async function withTimeoutBudget<T>(
  promise: Promise<T>,
  timeoutMs = 90000,
  timeoutMessage = 'El tiempo de procesamiento excedió el límite seguro (90s). El servicio de IA o extracción está experimentando lentitud. Por favor intenta de nuevo.'
): Promise<T> {
  const effectiveTimeout = Math.max(1, timeoutMs);
  let timer: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(timeoutMessage);
      (err as { status?: number }).status = 503;
      reject(err);
    }, effectiveTimeout);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export interface CorrectiveRetryParams<T> {
  systemPrompt: string;
  previousRaw: string;
  zodIssues: string;
  schema: z.ZodType<T>;
  callAI: (systemPrompt: string, correctivePrompt: string, remainingBudgetMs: number) => Promise<string>;
  deadline: number;
  contextName: string;
  buildPrompt?: (zodIssues: string, previousRaw: string) => string;
}

export function defaultBuildCorrectivePrompt(zodIssues: string, previousRaw: string): string {
  return `La respuesta anterior no cumplió estrictamente con el esquema esperado.
Errores de validación Zod:
${zodIssues}

Respuesta anterior recibida:
"""
${previousRaw.slice(0, 4000)}
"""

Corrige los campos señalados y devuelve ÚNICAMENTE un objeto JSON válido conforme al esquema requerido.`;
}

/**
 * Reintento correctivo acotado transversal para extracción/generación con IA.
 * Si restan >= 15s del presupuesto de tiempo: ejecuta 1 reprompt correctivo con Zod issues,
 * parseando la respuesta con repairNullStrings: true.
 * Si restan < 15s o el reintento falla, devuelve el error original sin saturar upstream.
 */
export async function correctiveRetry<T>({
  systemPrompt,
  previousRaw,
  zodIssues,
  schema,
  callAI,
  deadline,
  contextName,
  buildPrompt,
}: CorrectiveRetryParams<T>): Promise<ParseAIResponseResult<T>> {
  const remainingBudget = deadline - Date.now();
  if (remainingBudget < 15000) {
    return {
      success: false,
      warnings: [],
      error: zodIssues || 'Validación Zod falló y no queda presupuesto temporal suficiente (>=15s) para reintento correctivo',
    };
  }

  logger.warn(`[${contextName}] Primer intento de parseo falló. Ejecutando reintento correctivo acotado con Zod feedback...`);
  try {
    const promptBuilder = buildPrompt || defaultBuildCorrectivePrompt;
    const correctivePrompt = promptBuilder(zodIssues, previousRaw);

    const correctiveAiRaw = await callAI(
      systemPrompt,
      correctivePrompt,
      Math.max(1, deadline - Date.now())
    );

    return parseAIResponse(correctiveAiRaw, schema, {
      contextName: `${contextName}-retry`,
      repairNullStrings: true,
    });
  } catch (retryErr: unknown) {
    logger.warn(`[${contextName}] Falló el reintento correctivo acotado:`, retryErr);
    return {
      success: false,
      warnings: [],
      error: zodIssues || (retryErr instanceof Error ? retryErr.message : String(retryErr)),
    };
  }
}
