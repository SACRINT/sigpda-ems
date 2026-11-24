/**
 * Segmenta un párrafo en oraciones completas en español sin romper decimales (3.14, 1.5)
 * ni abreviaturas comunes (ej., aprox., fig., pág.).
 */
export function splitSpanishSentences(text: string): string[] {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];

  // Proteger abreviaturas (ej., aprox., Mr., Mrs., Ms., Dr., St.), decimales y puntos dentro de citas ('...' / "...")
  let protectedText = clean
    .replace(/\b(ej|aprox|fig|pág|pag|núm|num|dr|dra|sr|sra|mr|mrs|ms|prof|st|vs|etc|ec)\./gi, '$1\uE001')
    .replace(/(\d)\.(\d)/g, '$1\uE002$2');

  protectedText = protectedText
    .replace(/"[^"]*"/g, (quoted) => quoted.replace(/\./g, '\uE003').replace(/\?/g, '\uE004').replace(/!/g, '\uE005'))
    .replace(/(?:^|[\s:(])'[^']*'/g, (quoted) =>
      quoted.replace(/\./g, '\uE003').replace(/\?/g, '\uE004').replace(/!/g, '\uE005')
    );

  const rawSentences = protectedText
    .split(/(?<=[.?!])\s+(?=[A-ZÁÉÍÓÚÑ¿¡0-9(\-–—•])/)
    .map((s) =>
      s
        .replace(/\uE001/g, '.')
        .replace(/\uE002/g, '.')
        .replace(/\uE003/g, '.')
        .replace(/\uE004/g, '?')
        .replace(/\uE005/g, '!')
        .trim()
    )
    .filter(Boolean);

  return rawSentences.length > 0 ? rawSentences : [clean];
}
