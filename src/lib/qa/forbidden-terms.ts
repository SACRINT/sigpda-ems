/**
 * Guard determinista de términos prohibidos de plataforma privada en documentos oficiales SEP/SEMS.
 */

export const FORBIDDEN_PLATFORM_TERMS_REGEX = /SIGPDA[\s-]?EMS|\bSIGPDA\b/i;

export function findForbiddenPlatformTerms(data: unknown): string[] {
  const matches: string[] = [];
  const regex = new RegExp(FORBIDDEN_PLATFORM_TERMS_REGEX.source, 'gi');

  function traverse(value: unknown) {
    if (typeof value === 'string') {
      const found = value.match(regex);
      if (found) {
        matches.push(...found);
      }
    } else if (Array.isArray(value)) {
      for (const item of value) {
        traverse(item);
      }
    } else if (value && typeof value === 'object') {
      for (const val of Object.values(value as Record<string, unknown>)) {
        traverse(val);
      }
    }
  }

  traverse(data);
  return matches;
}
