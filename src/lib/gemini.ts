/**
 * gemini.ts — Pool de API Keys con Rotación Determinista Round-Robin
 *
 * Motor de IA de SIGPDA-EMS con:
 * - Rotación secuencial (Round-Robin) de API Keys para generaciones granulares
 * - Soporte de perfil Estándar (gemini-3.5-flash-lite / gemini-3.1-flash-lite)
 * - Soporte de perfil Premium (modelo configurado por el Administrador en /es/admin)
 * - Fallback transparente solo ante error 404 (modelo descontinuado) hacia gemini-3.5-flash-lite
 * - Auto-reactivación de llaves bloqueadas tras 60 minutos de enfriamiento
 *
 * ⚠️  Modelos eliminados: gemini-1.5-flash, gemini-2.0-flash, gemini-2.5-flash
 */

import { neon } from '@neondatabase/serverless';
import { SYSTEM_PROMPT } from './prompts/system-prompt';
import { generateStreamWithRotation, resolveUserIsPremium } from './ai-provider';
import { sanitizeGeminiModel } from './ai-provider/gemini';
import type { GeneratedPlanningContent } from '@/types/planning';

// ── Puntero global de Round-Robin ─────────────────────────────────────────────
// Avanza en cada llamada a callGeminiPool para garantizar que las generaciones
// granulares (sesión 1, sesión 2, rúbrica, diagnóstico PMC, etc.) usen llaves distintas.
let globalKeyPointerIndex = 0;

// ── Cadena de fallback por modelo ─────────────────────────────────────────────
// Modelos autorizados: únicamente gemini-3.5-flash-lite y gemini-3.1-flash-lite
const FALLBACK_CHAIN_STANDARD = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'];
const FALLBACK_CHAIN_PREMIUM  = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'];

function buildModelChain(requestedModel: string, isPremium: boolean): string[] {
  const sanitized = sanitizeGeminiModel(requestedModel);
  const chain = isPremium ? FALLBACK_CHAIN_PREMIUM : FALLBACK_CHAIN_STANDARD;
  if (chain[0] === sanitized) return chain;
  return [sanitized, ...chain.filter(m => m !== sanitized)];
}

// ── Motor principal: callGeminiPool ───────────────────────────────────────────

/**
 * Llama a la API de Gemini con rotación Round-Robin sobre el pool de llaves.
 * Lee la configuración de modelo activo desde platform_config según el perfil del usuario.
 *
 * @param systemInstruction  Instrucción de sistema
 * @param prompt             Prompt del usuario / contenido
 * @param teacherId          ID del docente (para resolver si es Premium)
 * @param responseSchema     Esquema JSON opcional para structured output
 */
export async function callGeminiPool(
  systemInstruction: string,
  prompt: string,
  teacherId?: string,
  responseSchema?: object
): Promise<string> {
  return callGeminiInternal({
    systemInstruction,
    prompt,
    teacherId,
    responseSchema,
  });
}

export async function callGeminiMultimodalPool(
  systemInstruction: string,
  prompt: string,
  inlineData: { mimeType: string; data: string },
  teacherId?: string,
  responseSchema?: object
): Promise<string> {
  return callGeminiInternal({
    systemInstruction,
    prompt,
    inlineData,
    teacherId,
    responseSchema,
  });
}

interface GeminiInternalParams {
  systemInstruction: string;
  prompt: string;
  inlineData?: { mimeType: string; data: string };
  teacherId?: string;
  responseSchema?: object;
}

async function callGeminiInternal({
  systemInstruction,
  prompt,
  inlineData,
  teacherId,
  responseSchema,
}: GeminiInternalParams): Promise<string> {
  if (!process.env.DATABASE_URL) {
    throw new Error('[sigpda-ems] DATABASE_URL no configurada.');
  }

  const sql = neon(process.env.DATABASE_URL);

  // 1. Resolver perfil del usuario (Standard vs Premium)
  const isPremium = await resolveUserIsPremium(teacherId);

  // 2. Leer modelo activo desde platform_config según perfil
  const configKeys = isPremium
    ? ['admin_provider', 'admin_model']
    : ['active_provider', 'active_model'];
  const rows = await sql`
    SELECT key, value FROM platform_config
    WHERE key = ANY(${configKeys})
  `;
  const map: Record<string, string> = {};
  for (const row of rows) map[row.key] = row.value;

  const modelToUse = isPremium
    ? (map['admin_model']    || 'gemini-3.5-flash-lite')
    : (map['active_model']   || 'gemini-3.5-flash-lite');

  // 3. Auto-reactivar llaves bloqueadas hace más de 60 min
  const cooldownTime = new Date(Date.now() - 60 * 60 * 1000);
  await sql`
    UPDATE api_keys
    SET is_active = true, error_count = 0
    WHERE is_active = false
      AND error_count >= 5
      AND last_error_at IS NOT NULL
      AND last_error_at <= ${cooldownTime.toISOString()}
  `.catch(err => console.error('[sigpda-ems] Error reactivando llaves:', err));

  // 4. Cargar llaves activas del pool (Gemini)
  const keys = await sql`
    SELECT id, label, key_encrypted
    FROM api_keys
    WHERE provider = 'gemini' AND is_active = true
    ORDER BY priority ASC, error_count ASC
  `;

  if (keys.length === 0) {
    throw new Error('[sigpda-ems] No hay API Keys de Gemini activas en el pool.');
  }

  // 5. Descifrar llaves
  const { createDecipheriv } = await import('crypto');
  function decryptKey(encrypted: string): string {
    const encKeyStr = process.env.ADMIN_ENCRYPTION_KEY;
    if (!encKeyStr || encKeyStr.length !== 32) throw new Error('ADMIN_ENCRYPTION_KEY inválida');
    const encKey = Buffer.from(encKeyStr);
    const [ivHex, data] = encrypted.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = createDecipheriv('aes-256-cbc', encKey, iv);
    let decrypted = decipher.update(data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  const decryptedKeys = keys.map((k: any) => ({
    id: k.id as string,
    label: k.label as string,
    apiKey: decryptKey(k.key_encrypted as string),
  }));

  // 6. Rotación Round-Robin determinista con balanceo para serverless (cold starts)
  const randomOffset = Math.floor(Math.random() * decryptedKeys.length);
  const startIndex = (globalKeyPointerIndex + randomOffset) % decryptedKeys.length;
  globalKeyPointerIndex = (globalKeyPointerIndex + 1) % decryptedKeys.length;
  const rotatedKeys = [
    ...decryptedKeys.slice(startIndex),
    ...decryptedKeys.slice(0, startIndex),
  ];

  console.log(
    `[sigpda-ems] 🔄 Generando con Llave: "${rotatedKeys[0].label}" ` +
    `(Índice: ${startIndex + 1}/${decryptedKeys.length}) - Modelo: ${modelToUse} ` +
    `[${isPremium ? '⭐ Premium' : '⚡ Estándar'}]` +
    (inlineData ? ' [Multimodal PDF]' : '')
  );

  // 7. Intentar cada llave en orden rotado
  const modelChain = buildModelChain(modelToUse, isPremium);

  for (const keyRecord of rotatedKeys) {
    try {
      const result = await executeWithModelFallback(
        keyRecord.apiKey,
        modelChain,
        systemInstruction,
        prompt,
        responseSchema,
        inlineData
      );

      // Registrar éxito
      await sql`
        UPDATE api_keys
        SET error_count = 0,
            usage_count = usage_count + 1,
            last_used_at = NOW()
        WHERE id = ${keyRecord.id}
      `.catch(() => {});

      return result;
    } catch (err: any) {
      console.warn(`[sigpda-ems] Advertencia en llave "${keyRecord.label}": ${err.message}`);

      const is429 =
        err.message?.includes('429') ||
        err.message?.includes('RESOURCE_EXHAUSTED') ||
        err.message?.toLowerCase().includes('quota');

      if (!is429) {
        // Error grave (credencial inválida): incrementar errorCount
        await sql`
          UPDATE api_keys
          SET error_count = error_count + 1,
              last_error_at = NOW(),
              is_active = CASE WHEN error_count + 1 >= 5 THEN false ELSE is_active END
          WHERE id = ${keyRecord.id}
        `.catch(() => {});
      }
      // 429 → no penalizar la llave, pasar a la siguiente del pool
    }
  }

  throw new Error('[sigpda-ems] Todas las API Keys del pool fallaron o alcanzaron su cuota.');
}

// ── Ejecutor con cadena de modelos (fallback ante 404) ────────────────────────

async function executeWithModelFallback(
  apiKey: string,
  modelChain: string[],
  systemInstruction: string,
  prompt: string,
  responseSchema?: object,
  inlineData?: { mimeType: string; data: string }
): Promise<string> {
  let lastError: any = null;

  for (const currentModel of modelChain) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${apiKey}`;

      const parts: any[] = [];
      if (inlineData) {
        parts.push({
          inlineData: {
            mimeType: inlineData.mimeType,
            data: inlineData.data,
          },
        });
      }
      parts.push({ text: prompt });

      const wantsJson = Boolean(
        responseSchema ||
        systemInstruction.includes('JSON') ||
        prompt.includes('JSON')
      );

      const payload: any = {
        contents: [{ parts }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: {
          temperature: 0.2,
          topP: 0.95,
          maxOutputTokens: 8192,
          responseMimeType: wantsJson ? 'application/json' : 'text/plain',
        },
      };

      if (responseSchema) {
        payload.generationConfig.responseSchema = responseSchema;
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(inlineData ? 90000 : 120000),
      });

      if (!res.ok) {
        const errText = await res.text();
        // 404 = modelo descontinuado → intentar el siguiente de la cadena
        if (res.status === 404 || errText.toLowerCase().includes('not found')) {
          console.warn(`[sigpda-ems] Modelo "${currentModel}" no encontrado (404), probando siguiente...`);
          continue;
        }
        throw new Error(`HTTP ${res.status}: ${errText}`);
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('Respuesta vacía de Gemini API');
      return text;
    } catch (e: any) {
      if (e.message?.includes('404') || e.message?.toLowerCase().includes('not found')) {
        lastError = e;
        continue; // Intentar siguiente modelo
      }
      throw e; // Propagar errores no-404
    }
  }

  throw lastError || new Error('[sigpda-ems] Todos los modelos de la cadena fallaron.');
}

// ── Planning (streaming) ──────────────────────────────────────────────────────

export async function* generatePlanningStream(
  userPrompt: string,
  teacherId?: string
): AsyncGenerator<string> {
  const isPremium = await resolveUserIsPremium(teacherId);
  yield* generateStreamWithRotation(SYSTEM_PROMPT, userPrompt, teacherId, isPremium);
}

// ── Extra resources (rubric, material, lesson plan) ──────────────────────────

export async function generateExtraText(
  systemPrompt: string,
  userPrompt: string,
  teacherId?: string
): Promise<string> {
  return callGeminiPool(systemPrompt, userPrompt, teacherId);
}

// ── Planning (non-streaming, JSON) ────────────────────────────────────────────

export async function generatePlanning(
  userPrompt: string,
  teacherId?: string
): Promise<GeneratedPlanningContent> {
  const text = await callGeminiPool(SYSTEM_PROMPT, userPrompt, teacherId);

  let parsed: GeneratedPlanningContent;
  try {
    const clean = text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
    parsed = JSON.parse(clean);
  } catch {
    throw new Error('La IA retornó una respuesta JSON inválida. Por favor intenta de nuevo.');
  }

  if (!parsed.sectionI || !parsed.sectionII || !parsed.sectionIV) {
    throw new Error('La respuesta de la IA está incompleta. Por favor intenta de nuevo.');
  }

  return parsed;
}
