/**
 * gemini.ts — Adaptador delgado sobre el Gateway Único de IA (src/lib/ai-provider)
 * SIGPDA-EMS · MCCEMS Ciclo Escolar 2026-2027
 *
 * Mantiene compatibilidad total hacia atrás con firmas y contratos existentes:
 * - callGeminiPool
 * - callGeminiMultimodalPool (con soporte estructurado responseSchema / jsonMode)
 * - generatePlanningStream
 * - generateExtraText
 * - generatePlanning
 *
 * Todo el tráfico se delega a `src/lib/ai-provider`:
 * - Selección atómica de llaves con `FOR UPDATE SKIP LOCKED`
 * - Cooldown diferenciado (45s para 429/503; 401/403 desactiva)
 * - Fast-fail tras 2 errores 503 consecutivos
 * - Cero incremento doble de usage_count
 */

import { SYSTEM_PROMPT } from './prompts/system-prompt';
import {
  generateWithRotation,
  generateMultimodalWithRotation,
  generateStreamWithRotation,
  resolveUserIsPremium,
} from './ai-provider';
import { parseAIResponse } from './ai-response-parser';
import { PlanningContentSchema } from './ai-schemas';
import type { z } from 'zod';
import type { GeneratedPlanningContent } from '@/types/planning';

/**
 * Llama a la API de Gemini mediante el Gateway Único de IA con rotación atómica en BD.
 */
export async function callGeminiPool(
  systemInstruction: string,
  prompt: string,
  teacherId?: string,
  responseSchema?: object
): Promise<string> {
  const isPremium = await resolveUserIsPremium(teacherId);
  const wantsJson = Boolean(
    responseSchema ||
    systemInstruction.includes('JSON') ||
    prompt.includes('JSON')
  );

  return generateWithRotation(systemInstruction, prompt, teacherId, isPremium, {
    jsonMode: wantsJson,
    responseSchema,
  });
}

/**
 * Llama a la API de Gemini para procesamiento multimodal (ej. PDFs escaneados / visión)
 * con rotación atómica, protección de cuota y soporte structured output.
 */
export async function callGeminiMultimodalPool(
  systemInstruction: string,
  prompt: string,
  inlineData: { mimeType: string; data: string },
  teacherId?: string,
  responseSchema?: object
): Promise<string> {
  const isPremium = await resolveUserIsPremium(teacherId);
  const wantsJson = Boolean(
    responseSchema ||
    prompt.includes('JSON') ||
    systemInstruction.includes('JSON')
  );

  return generateMultimodalWithRotation(
    systemInstruction,
    prompt,
    inlineData,
    teacherId,
    isPremium,
    {
      jsonMode: wantsJson,
      responseSchema,
    }
  );
}

/**
 * Genera el flujo en streaming para la redacción de planeaciones didácticas.
 */
export async function* generatePlanningStream(
  userPrompt: string,
  teacherId?: string
): AsyncGenerator<string> {
  const isPremium = await resolveUserIsPremium(teacherId);
  yield* generateStreamWithRotation(SYSTEM_PROMPT, userPrompt, teacherId, isPremium);
}

/**
 * Genera recursos adicionales de la planeación (rúbricas, listas de cotejo, materiales).
 */
export async function generateExtraText(
  systemPrompt: string,
  userPrompt: string,
  teacherId?: string
): Promise<string> {
  return callGeminiPool(systemPrompt, userPrompt, teacherId);
}

/**
 * Genera el contenido estructurado completo de una planeación didáctica con validación Zod.
 */
export async function generatePlanning(
  userPrompt: string,
  teacherId?: string
): Promise<GeneratedPlanningContent> {
  const text = await callGeminiPool(SYSTEM_PROMPT, userPrompt, teacherId);

  const parseResult = parseAIResponse<GeneratedPlanningContent>(
    text,
    PlanningContentSchema as unknown as z.ZodType<GeneratedPlanningContent>,
    {
      contextName: 'gemini-generate-planning',
    }
  );

  if (!parseResult.success) {
    throw new Error(`La IA retornó una respuesta JSON inválida: ${parseResult.error}`);
  }

  const parsed = parseResult.data;

  if (!parsed.sectionI || !parsed.sectionII || !parsed.sectionIV) {
    throw new Error('La respuesta de la IA está incompleta. Por favor intenta de nuevo.');
  }

  return parsed;
}
