/**
 * numeric-guard.ts — Guardián Canónico de Números Reales en SIGPDA-EMS
 * 
 * Centraliza la validación y conversión de valores numéricos en la plataforma.
 * Garantiza que el 0 sea tratado como un valor numérico legítimo (nunca falsy
 * ni descartado como N/D), mientras que valores nulos, indefinidos, vacíos o
 * strings no numéricos retornen limpiamente `undefined`.
 */

export function toRealNumber(v: unknown): number | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === 'string' && v.trim() === '') return undefined;
  if (typeof v === 'boolean') return undefined;
  if (typeof v === 'object') return undefined;
  const num = Number(v);
  return Number.isNaN(num) ? undefined : num;
}

export function isRealNumeric(v: unknown): v is number | string {
  return toRealNumber(v) !== undefined;
}
