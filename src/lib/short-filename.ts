const STOP_WORDS = new Set([
  'a', 'al', 'ante', 'bajo', 'con', 'contra', 'de', 'del', 'desde', 'durante',
  'e', 'el', 'en', 'entre', 'hacia', 'hasta', 'la', 'las', 'los', 'mediante',
  'o', 'para', 'por', 'que', 'segun', 'sin', 'sobre', 'su', 'sus', 'tras', 'u',
  'un', 'una', 'unas', 'unos', 'y',
]);

const ROMAN_NUMERALS: Record<string, string> = {
  i: '1',
  ii: '2',
  iii: '3',
  iv: '4',
  v: '5',
  vi: '6',
  vii: '7',
  viii: '8',
  ix: '9',
  x: '10',
};

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim();
}

export function sanitizeFilenamePart(value: string | null | undefined, maxLength = 40): string {
  const clean = normalizeText(String(value || ''))
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, maxLength);
  return clean || 'archivo';
}

/**
 * Código corto y estable para nombres de archivo. Evita rutas largas en Windows
 * y mantiene los paquetes identificables: "Pensamiento Matemático III" -> PM3.
 */
export function shortSubjectCode(value: string | null | undefined, maxLength = 10): string {
  const raw = String(value || '').trim();
  const base = raw.split(/[.:]/)[0]?.trim() || raw;
  const words = normalizeText(base)
    .split(/\s+/)
    .filter(Boolean)
    .filter((word) => !STOP_WORDS.has(word.toLowerCase()));

  if (words.length === 0) {
    return sanitizeFilenamePart(base, maxLength).toUpperCase() || 'UAC';
  }

  const tokens = words.map((word) => {
    const lower = word.toLowerCase();
    if (ROMAN_NUMERALS[lower]) return ROMAN_NUMERALS[lower];
    return word.charAt(0).toUpperCase();
  });

  let code = tokens.join('');
  if (words.length === 1 && words[0]!.length > 2) {
    code = words[0]!.slice(0, 6).toUpperCase();
  }

  if (code.length < 2) {
    code = `${code}${sanitizeFilenamePart(base, 4).toUpperCase()}`;
  }

  return sanitizeFilenamePart(code, maxLength).toUpperCase();
}

export function buildShortFilename(
  prefix: string,
  subject: string | null | undefined,
  extension: string
): string {
  const ext = extension.replace(/^\./, '').toLowerCase();
  const safePrefix = sanitizeFilenamePart(prefix, 32);
  const code = shortSubjectCode(subject);
  return `${safePrefix}_${code}.${ext}`;
}

export function buildShortZipName(
  prefix: string,
  subject: string | null | undefined
): string {
  return `${sanitizeFilenamePart(prefix, 32)}_${shortSubjectCode(subject)}.zip`;
}
