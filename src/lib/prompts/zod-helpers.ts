import { z } from 'zod';

/**
 * Normaliza campos de texto donde la IA puede devolver `null`, `undefined` o string ausente.
 * Mapea null -> undefined para que .default(defaultValue) asigne la cadena esperada.
 * Mantiene validación estricta (rechaza números, booleanos u objetos) y es 100% compatible con z.toJSONSchema().
 */
export const nullableString = (defaultValue = '') =>
  z.preprocess((v) => (v === null ? undefined : v), z.string().optional().default(defaultValue));
