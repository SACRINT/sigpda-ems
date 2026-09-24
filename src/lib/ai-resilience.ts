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
  let timer: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(timeoutMessage);
      (err as { status?: number }).status = 503;
      reject(err);
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
