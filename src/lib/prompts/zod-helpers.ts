import { z } from 'zod';

/**
 * Normaliza campos de texto donde la IA puede devolver `null`, `undefined` o string ausente.
 * Mapea null -> undefined para que .default(defaultValue) asigne la cadena esperada.
 * Mantiene validación estricta (rechaza números, booleanos u objetos) y es 100% compatible con z.toJSONSchema().
 */
export const nullableString = (defaultValue = '') =>
  z.preprocess((v) => (v === null ? undefined : v), z.string().optional().default(defaultValue));

/**
 * Normaliza campos de texto o listas donde la IA puede devolver tanto string como arreglo de strings (ej. viñetas FODA).
 * Si recibe un arreglo, une los elementos con salto de línea.
 */
export const nullableStringOrArray = (defaultValue = '') =>
  z.preprocess((v) => {
    if (v === null || v === undefined) return undefined;
    if (Array.isArray(v)) return v.map(String).join('\n');
    return v;
  }, z.string().optional().default(defaultValue));
