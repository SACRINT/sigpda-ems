import { z } from 'zod';
import { parseAIResponse } from './ai-response-parser';
import { getAIProvider } from './ai-provider';

// ============================================================================
// MÉTRICAS Y OBSERVABILIDAD EN MEMORIA
// ============================================================================

interface AIMetricsStore {
  attemptsTotalByRoute: Record<string, number>;
  failuresTotalByReason: {
    EMPTY_RESPONSE: number;
    JSON_SYNTAX_ERROR: number;
    SCHEMA_VALIDATION_ERROR: number;
    UNKNOWN_ERROR: number;
  };
  firstAttemptSuccessCount: number;
  retrySuccessCount: number;
  totalSuccessCount: number;
  totalFailedAfterMaxRetries: number;
}

const metrics: AIMetricsStore = {
  attemptsTotalByRoute: {},
  failuresTotalByReason: {
    EMPTY_RESPONSE: 0,
    JSON_SYNTAX_ERROR: 0,
    SCHEMA_VALIDATION_ERROR: 0,
    UNKNOWN_ERROR: 0,
  },
  firstAttemptSuccessCount: 0,
  retrySuccessCount: 0,
  totalSuccessCount: 0,
  totalFailedAfterMaxRetries: 0,
};

/**
 * Consulta el estado actual de las métricas de generación y reintentos de IA.
 */
export function getAIMetrics() {
  const retryAttempts = Object.values(metrics.attemptsTotalByRoute).reduce((a, b) => a + b, 0);
  const retryRate = metrics.totalSuccessCount > 0
    ? ((metrics.retrySuccessCount / metrics.totalSuccessCount) * 100).toFixed(1) + '%'
    : '0%';
  const overallSuccessRate = (metrics.totalSuccessCount + metrics.totalFailedAfterMaxRetries) > 0
    ? ((metrics.totalSuccessCount / (metrics.totalSuccessCount + metrics.totalFailedAfterMaxRetries)) * 100).toFixed(1) + '%'
    : '100%';

  return {
    ...metrics,
    summary: {
      totalCalls: retryAttempts,
      retryRecoveryRate: retryRate,
      overallSuccessRate,
    },
  };
}

export function resetAIMetrics() {
  metrics.attemptsTotalByRoute = {};
  metrics.failuresTotalByReason = {
    EMPTY_RESPONSE: 0,
    JSON_SYNTAX_ERROR: 0,
    SCHEMA_VALIDATION_ERROR: 0,
    UNKNOWN_ERROR: 0,
  };
  metrics.firstAttemptSuccessCount = 0;
  metrics.retrySuccessCount = 0;
  metrics.totalSuccessCount = 0;
  metrics.totalFailedAfterMaxRetries = 0;
}

// ============================================================================
// GESTOR CENTRALIZADO DE REINTENTOS CON AUTO-CORRECCIÓN Y OBSERVABILIDAD
// ============================================================================

export interface GenerateWithRetryOptions {
  maxRetries?: number;        // Total de intentos (default: 3)
  baseTemperature?: number;   // Temperatura inicial (default: 0.2)
  route?: string;             // Identificador para métricas y logs
  teacherId?: string;
  isPremium?: boolean;
  customGenerateFn?: (systemPrompt: string, userPrompt: string, options: { temperature: number }) => Promise<string>;
}

export interface GenerateWithRetryResult<T> {
  data: T;
  attempts: number;
  warnings: string[];
}

/**
 * Genera contenido con LLM con reintentos guiados por errores de validación de Zod.
 * Si la respuesta no pasa el esquema, retroalimenta al modelo con el error exacto
 * en una temperatura reducida (0.1 / 0.05).
 */
export async function generateWithRetry<T>(
  systemPrompt: string,
  userPrompt: string,
  schema: z.ZodType<T>,
  options?: GenerateWithRetryOptions
): Promise<GenerateWithRetryResult<T>> {
  const route = options?.route || 'unspecified_route';
  const maxRetries = Math.max(1, options?.maxRetries ?? 3);
  const baseTemp = options?.baseTemperature ?? 0.2;

  // Registrar intento en métricas
  metrics.attemptsTotalByRoute[route] = (metrics.attemptsTotalByRoute[route] || 0) + 1;

  let allWarnings: string[] = [];
  let lastError = '';

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    let currentTemp = baseTemp;
    let currentSystemPrompt = systemPrompt;
    let currentUserPrompt = userPrompt;

    if (attempt === 2) {
      currentTemp = 0.1;
      currentSystemPrompt = `${systemPrompt}\n\n[INSTRUCCIÓN DE CORRECCIÓN OBLIGATORIA]:\nTu respuesta anterior falló la validación estricta del sistema con el siguiente error:\n"${lastError}".\nDebes corregir este error de inmediato. Responde ÚNICAMENTE con la estructura JSON requerida con todos los campos válidos y completos.`;
    } else if (attempt >= 3) {
      currentTemp = 0.05;
      currentSystemPrompt = `${systemPrompt}\n\n[REINTENTO FINAL CRÍTICO - MODO JSON PURO]:\nTu respuesta anterior volvió a fallar:\n"${lastError}".\nEntrega EXCLUSIVAMENTE el objeto JSON crudo sin bloques markdown, sin texto previo, sin notas explicativas. Inicia inmediatamente con el delimitador correspondiente ({ o [) y finaliza con (} o ]).`;
    }

    try {
      let rawResponse: string;

      if (options?.customGenerateFn) {
        rawResponse = await options.customGenerateFn(currentSystemPrompt, currentUserPrompt, { temperature: currentTemp });
      } else {
        const ai = await getAIProvider(options?.isPremium ?? false);
        rawResponse = await ai.generate(currentSystemPrompt, currentUserPrompt, { temperature: currentTemp });
      }

      if (!rawResponse || !rawResponse.trim()) {
        metrics.failuresTotalByReason.EMPTY_RESPONSE++;
        lastError = 'La IA devolvió una respuesta vacía';
        console.warn(`[AI-RETRY] [${route}] Intento ${attempt}/${maxRetries} falló: Respuesta vacía`);
        continue;
      }

      const parseResult = parseAIResponse(rawResponse, schema, { contextName: route });

      if (parseResult.warnings.length > 0) {
        allWarnings.push(...parseResult.warnings);
      }

      if (parseResult.success) {
        // Registrar éxito en métricas
        metrics.totalSuccessCount++;
        if (attempt === 1) {
          metrics.firstAttemptSuccessCount++;
        } else {
          metrics.retrySuccessCount++;
          console.log(`[AI-RETRY] [${route}] ✅ Recuperación exitosa en intento ${attempt}/${maxRetries}`);
        }

        return {
          data: parseResult.data,
          attempts: attempt,
          warnings: Array.from(new Set(allWarnings)),
        };
      }

      // Clasificar tipo de fallo para observabilidad
      lastError = parseResult.error || 'Error de parseo desconocido';
      if (lastError.includes('Zod')) {
        metrics.failuresTotalByReason.SCHEMA_VALIDATION_ERROR++;
      } else {
        metrics.failuresTotalByReason.JSON_SYNTAX_ERROR++;
      }

      console.warn(`[AI-RETRY] [${route}] Intento ${attempt}/${maxRetries} falló: ${lastError}`);
    } catch (callErr: any) {
      metrics.failuresTotalByReason.UNKNOWN_ERROR++;
      lastError = callErr.message || 'Excepción no controlada durante llamada a IA';
      console.error(`[AI-RETRY] [${route}] Excepción en intento ${attempt}/${maxRetries}:`, callErr);
    }
  }

  // Si se agotaron todos los reintentos
  metrics.totalFailedAfterMaxRetries++;
  const finalMsg = `Error al generar respuesta estructurada tras ${maxRetries} intentos en la ruta [${route}]. Último error: ${lastError}`;
  console.error(`[AI-RETRY] [${route}] ❌ Fallo definitivo tras ${maxRetries} intentos.`);
  throw new Error(finalMsg);
}
