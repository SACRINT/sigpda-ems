/**
 * Constantes compartidas del nombre de la plataforma.
 * Seguro para importar desde componentes cliente y servidor.
 */

export const PLATFORM_NAME_KEY = 'platform_name';

/** Último recurso si la base de datos no responde o falta la fila. */
export const FALLBACK_PLATFORM_NAME = 'SIGPDA-EMS';

let runtimePlatformName = FALLBACK_PLATFORM_NAME;

/**
 * Registra el nombre resuelto para que generadores síncronos (DOCX/PDF/PPTX)
 * y prompts lo lean sin volver a consultar la base de datos.
 */
export function setRuntimePlatformName(name: string | null | undefined): void {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  runtimePlatformName = trimmed || FALLBACK_PLATFORM_NAME;
}

/** Acceso síncrono al nombre resuelto en el request/render actual. */
export function getRuntimePlatformName(): string {
  return runtimePlatformName;
}
