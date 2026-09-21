/**
 * Catálogo normativo de cargas horarias semanales típicas en EMS / MCCEMS Puebla.
 * Externalizado para desacoplar el pipeline de validación y permitir extensión dinámica.
 */

export const DEFAULT_UAC_WEEKLY_HOURS: Record<string, number> = {
  'pensamiento matematico': 4,
  'la materia y sus interacciones': 4,
  'conservacion de la energia': 4,
  'ecosistemas: interacciones': 4,
  'reacciones quimicas': 4,
  'organismos': 4,
  'lengua y comunicacion': 3,
  'conciencia historica': 3,
  'ciencias sociales': 2,
  'humanidades': 3,
  'cultura digital': 3,
  'lengua extranjera': 3,
  'ingles': 3,
  'formacion socioemocional': 1,
};

/**
 * Normaliza nombres de UAC removiendo diacríticos (acentos) y espacios extra
 * para comparaciones robustas e insensibles a mayúsculas/acentuación.
 */
export function normalizeUacKey(text: string): string {
  return (text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}
