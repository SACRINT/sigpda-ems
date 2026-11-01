/**
 * Utilidades de procesamiento de texto curricular y documentos.
 * Módulo puro sin dependencias de Node.js (seguro para 'use client' y entorno servidor).
 */

// Nota: En el contexto MCCEMS no existen palabras compuestas con guión legítimo
/**
 * Normaliza el campo `contenidos` de un contenido formativo a `string[]`.
 * Tolera datos heredados donde el valor llegó como string o null/undefined.
 */
export function normalizeContenidos(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(v => removeHyphens(String(v ?? '')));
  if (typeof value === 'string' && value.trim()) return [removeHyphens(value)];
  return [];
}

export function removeHyphens(text: string): string {
  if (!text) return '';
  return text
    // Replace soft hyphens
    .replace(/\u00ad/g, '')
    // Replace standard hyphen followed by newline and optional spaces
    .replace(/([a-zA-ZáéíóúñÁÉÍÓÚÑ]+)-\s*[\r\n]\s*([a-zA-ZáéíóúñÁÉÍÓÚÑ]+)/g, '$1$2')
    // Replace standard hyphen followed by spaces
    .replace(/([a-zA-ZáéíóúñÁÉÍÓÚÑ]+)-\s+([a-zA-ZáéíóúñÁÉÍÓÚÑ]+)/g, '$1$2');
}
