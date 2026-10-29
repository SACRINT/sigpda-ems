/**
 * Utilidades compartidas para la aplicación SIGPDA-EMS.
 */

/**
 * Limpia prefijos y sufijos de numeración romana de las asignaturas del Currículum Ampliado / Formación Socioemocional.
 * Para los 5 ámbitos oficiales 2025-2028 (MCCEMS), conserva estrictamente el nombre oficial limpio sin números romanos:
 * 1. Actividades Físicas y Deportivas
 * 2. Actividades Artísticas y Culturales
 * 3. Educación para la Salud
 * 4. Educación Integral en Sexualidad y Género
 * 5. Práctica y Colaboración Ciudadana
 */
export function cleanSocioemotionalName(name: string, _semester?: number): string {
  if (!name) return '';

  let clean = name
    .replace(/^Ámbito de la Formación Socioemocional:\s*/i, '')
    .replace(/^Ámbito de la Formación Socioemocional\s+[I|V|X]+\.?\s*/i, '')
    .replace(/^Ámbito:\s*/i, '')
    .replace(/^Formación Socioemocional:\s*/i, '')
    .trim();

  // Eliminar cualquier sufijo de número romano al final (ej: " I", " II", " III", " IV", " V", " VI")
  clean = clean.replace(/\s+(?:I{1,3}|IV|VI?)$/i, '').trim();

  const canonicalAmbitos = [
    'Práctica y Colaboración Ciudadana',
    'Educación para la Salud',
    'Actividades Físicas y Deportivas',
    'Educación Integral en Sexualidad y Género',
    'Actividades Artísticas y Culturales',
  ];

  const matched = canonicalAmbitos.find(a => a.toLowerCase() === clean.toLowerCase());
  if (matched) {
    return matched;
  }

  return clean;
}

