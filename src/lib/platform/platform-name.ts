/**
 * Fuente única del nombre de la plataforma.
 *
 * La verdad vive en `public.platform_config` (key = 'platform_name').
 * Se cachea en memoria con TTL corto para no golpear la BD en cada render.
 * El panel admin invalida la caché al guardar el nombre.
 *
 * Este módulo es solo para servidor: usa `getPlatformName()` en componentes
 * de servidor/rutas y `getPlatformNameSync()` en generadores síncronos ya
 * calentados. Los componentes cliente usan `usePlatformName()`.
 */

import { sql } from '@/lib/db/client';
import {
  FALLBACK_PLATFORM_NAME,
  PLATFORM_NAME_KEY,
  setRuntimePlatformName,
} from './platform-name-shared';

const CACHE_TTL_MS = 60_000;

let cachedName: string | null = null;
let cachedAt = 0;

function normalize(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Lee el nombre desde platform_config. Si la BD falla, conserva el último
 * valor conocido o el fallback canónico.
 */
export async function getPlatformName(): Promise<string> {
  const now = Date.now();
  if (cachedName && now - cachedAt < CACHE_TTL_MS) {
    setRuntimePlatformName(cachedName);
    return cachedName;
  }

  try {
    const db = sql();
    const rows = await db`
      SELECT value FROM platform_config
      WHERE key = ${PLATFORM_NAME_KEY}
      LIMIT 1
    `;
    const value = normalize(rows?.[0]?.value);
    cachedName = value || FALLBACK_PLATFORM_NAME;
  } catch {
    cachedName = cachedName || FALLBACK_PLATFORM_NAME;
  }

  cachedAt = now;
  setRuntimePlatformName(cachedName);
  return cachedName;
}

/**
 * Acceso síncrono para generadores de servidor (DOCX/PDF/PPTX/prompts).
 * Requiere que `getPlatformName()` se haya awaited antes en el request.
 */
export function getPlatformNameSync(): string {
  return cachedName || FALLBACK_PLATFORM_NAME;
}

/** Fuerza a releer la BD en la siguiente llamada. */
export function invalidatePlatformNameCache(): void {
  cachedName = null;
  cachedAt = 0;
}
