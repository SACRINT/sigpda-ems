/**
 * strangler-client.ts — Cliente Strangler Fig para Planeaciones (Gobernanza G1/G2/G3)
 *
 * Implementa detección de características en runtime a nivel UI mediante códigos HTTP:
 * - Si el servidor retorna HTTP 501 (Feature Flag PLANEACION_ORCHESTRATOR_V2 inactiva),
 *   la interfaz ejecuta silenciosamente el camino legacy de cliente (jsPDF / generación local)
 *   sin alterar la UX docente.
 * - Si el servidor retorna HTTP 200 (Feature Flag activa), la UI consume directamente el
 *   resultado del Orquestador Central V2 (PDF oficial en servidor o secuencia persistida).
 * - Manejo defensivo tipado para 401 (no autorizado), 403 (ownership), 404 y 400.
 *
 * PROHIBICIÓN ESTRICTA: No expone flags con NEXT_PUBLIC_ ni consulta endpoints de flags.
 */

export interface ExportPlanningPdfOptions {
  planningId: string;
  filename?: string;
  onLegacyFallback: () => Promise<void> | void;
}

export interface ExportPlanningPdfResult {
  source: 'orchestrator' | 'legacy';
  status: number;
  blob?: Blob;
  error?: string;
}

/**
 * Exporta el PDF oficial de una planeación aplicando el patrón Strangler Fig.
 * Intenta GET /api/planeaciones/[id]/pdf en servidor; ante 501 delega al fallback cliente (jsPDF).
 */
export async function exportPlanningPdfWithFallback(
  options: ExportPlanningPdfOptions
): Promise<ExportPlanningPdfResult> {
  const { planningId, filename = `planeacion-${planningId}.pdf`, onLegacyFallback } = options;

  try {
    const res = await fetch(`/api/planeaciones/${planningId}/pdf`, {
      method: 'GET',
    });

    // 501 Not Implemented: bandera inactiva en servidor -> Strangler fallback a jsPDF de cliente
    if (res.status === 501) {
      await onLegacyFallback();
      return { source: 'legacy', status: 501 };
    }

    // 401 Unauthorized: sesión no válida o expirada
    if (res.status === 401) {
      return {
        source: 'orchestrator',
        status: 401,
        error: 'Sesión no autorizada o expirada. Por favor, inicia sesión nuevamente.',
      };
    }

    // 403 Forbidden: control de ownership (planeación de otro docente)
    if (res.status === 403) {
      return {
        source: 'orchestrator',
        status: 403,
        error: 'Acceso denegado: no tienes permisos para acceder o exportar esta planeación.',
      };
    }

    // 404 Not Found
    if (res.status === 404) {
      return {
        source: 'orchestrator',
        status: 404,
        error: 'Planeación no encontrada en el sistema.',
      };
    }

    // Errores de validación o del servidor (400, 500, etc.)
    if (!res.ok) {
      let errMsg = `Error del servidor (${res.status})`;
      try {
        const errorJson = await res.json();
        if (errorJson?.error) errMsg = errorJson.error;
      } catch {
        // Fallback al mensaje estándar si la respuesta no es JSON
      }
      return { source: 'orchestrator', status: res.status, error: errMsg };
    }

    // 200 OK: Descarga directa del blob binario generado por el orquestador
    const blob = await res.blob();
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    }

    return { source: 'orchestrator', status: 200, blob };
  } catch (networkError: unknown) {
    return {
      source: 'orchestrator',
      status: 0,
      error: networkError instanceof Error ? networkError.message : 'Error de conexión al exportar PDF',
    };
  }
}

export interface GenerateSequenceOptions<T = unknown> {
  planningId: string;
  blockIndex: number;
  totalHours?: number;
  onLegacyFallback: () => Promise<T> | T;
}

export interface GenerateSequenceResult<T = unknown> {
  source: 'orchestrator' | 'legacy';
  status: number;
  data?: T;
  warnings?: string[];
  error?: string;
}

/**
 * Genera la secuencia didáctica micro aplicando el patrón Strangler Fig.
 * Intenta POST /api/planeaciones/[id]/secuencia; ante 501 delega a la generación local de cliente.
 */
export async function generateSequenceWithFallback<T = unknown>(
  options: GenerateSequenceOptions<T>
): Promise<GenerateSequenceResult<T>> {
  const { planningId, blockIndex, totalHours, onLegacyFallback } = options;

  try {
    const res = await fetch(`/api/planeaciones/${planningId}/secuencia`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ blockIndex, ...(totalHours ? { totalHours } : {}) }),
    });

    // 501 Not Implemented: bandera inactiva -> ejecutar fallback legacy
    if (res.status === 501) {
      const fallbackData = await onLegacyFallback();
      return { source: 'legacy', status: 501, data: fallbackData };
    }

    // 401 Unauthorized
    if (res.status === 401) {
      return {
        source: 'orchestrator',
        status: 401,
        error: 'Sesión no autorizada o expirada. Por favor, inicia sesión nuevamente.',
      };
    }

    // 403 Forbidden
    if (res.status === 403) {
      return {
        source: 'orchestrator',
        status: 403,
        error: 'Acceso denegado: no tienes permisos para generar secuencias en esta planeación.',
      };
    }

    // 404 Not Found
    if (res.status === 404) {
      return {
        source: 'orchestrator',
        status: 404,
        error: 'Planeación o bloque no encontrado.',
      };
    }

    // Otros errores
    if (!res.ok) {
      let errMsg = `Error del servidor (${res.status})`;
      try {
        const errorJson = await res.json();
        if (errorJson?.error) errMsg = errorJson.error;
      } catch {
        // Fallback al mensaje estándar si la respuesta no es JSON
      }
      return { source: 'orchestrator', status: res.status, error: errMsg };
    }

    const json = await res.json();
    return {
      source: 'orchestrator',
      status: 200,
      data: json,
      warnings: json?.warnings,
    };
  } catch (networkError: unknown) {
    return {
      source: 'orchestrator',
      status: 0,
      error: networkError instanceof Error ? networkError.message : 'Error de red al generar secuencia',
    };
  }
}
