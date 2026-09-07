/**
 * Utilidades compartidas para la aplicación SIGPDA-EMS.
 */

/**
 * Limpia el prefijo del ámbito de formación socioemocional y añade la numeración romana
 * correspondiente al semestre si no está presente.
 */
export function cleanSocioemotionalName(name: string, semester: number): string {
  let clean = name.replace(/^Ámbito de la Formación Socioemocional:\s*/i, '');
  const romans = ['', 'I', 'II', 'III', 'IV', 'V', 'VI'];
  const roman = romans[semester] || '';
  if (roman && !clean.endsWith(` ${roman}`)) {
    clean = `${clean} ${roman}`;
  }
  return clean;
}
