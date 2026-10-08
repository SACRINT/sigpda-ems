// src/lib/materials/auto-tokenize.ts
/**
 * auto-tokenize.ts — Recuperación determinista de tokens [[material:slug]]
 * a partir de texto libre (la IA no siempre emite el token; esto lo compensa).
 * Degradación D9 intacta: solo transforma texto que matchea un slug REAL del catálogo.
 * SIGPDA-EMS · Ciclo Escolar 2026-2027
 */

import { MATERIALES_CATALOG, getMaterial } from './materials-catalog';
import { normalizeUnicode } from '@/lib/utils/normalize';

interface CatalogVariant {
  slug: string;
  normalizedPattern: string;
  regex: RegExp;
  length: number;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Cache singleton de variantes precompiladas de matching ordenadas de mayor a menor longitud.
 */
let cachedVariants: CatalogVariant[] | null = null;

function getSortedVariants(): CatalogVariant[] {
  if (cachedVariants) return cachedVariants;

  const rawVariantsMap = new Map<string, string>(); // normalizedPattern -> slug

  for (const m of MATERIALES_CATALOG) {
    const candidatePhrases: string[] = [
      m.name,
      ...(m.aliases || []),
      m.slug,
      m.slug.replace(/-/g, ' '),
    ];

    if (m.name.includes('/')) {
      m.name.split('/').forEach((p) => candidatePhrases.push(p.trim()));
    }
    if (m.name.includes('(')) {
      candidatePhrases.push(m.name.replace(/\(.*?\)/g, '').trim());
    }

    const cleanName = m.name.replace(/\(.*?\)/g, '').replace(/[/]/g, ' ').trim();
    const words = cleanName.split(/\s+/);
    if (words.length >= 2) {
      candidatePhrases.push(words.slice(0, 2).join(' '));
    }
    if (words.length >= 3) {
      candidatePhrases.push(words.slice(0, 3).join(' '));
    }

    for (const phrase of candidatePhrases) {
      if (!phrase) continue;
      const norm = normalizeUnicode(phrase)
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (norm.length >= 6) {
        if (!rawVariantsMap.has(norm)) {
          rawVariantsMap.set(norm, m.slug);
        }

        // Plural simple si singular >= 6
        const plural = /[aeiou]$/.test(norm) ? norm + 's' : norm + 'es';
        if (!rawVariantsMap.has(plural)) {
          rawVariantsMap.set(plural, m.slug);
        }
      }
    }
  }

  const list: CatalogVariant[] = [];
  for (const [pattern, slug] of rawVariantsMap.entries()) {
    const escaped = escapeRegExp(pattern).replace(/\s+/g, '\\s+');
    list.push({
      slug,
      normalizedPattern: pattern,
      regex: new RegExp(`\\b${escaped}\\b`, 'gi'),
      length: pattern.length,
    });
  }

  // Ordenar de mayor a menor longitud para priorizar las frases más específicas
  list.sort((a, b) => b.length - a.length);
  cachedVariants = list;
  return cachedVariants;
}

interface MatchSpan {
  start: number;
  end: number;
  slug: string;
  matchedText: string;
}

/**
 * Encuentra coincidencias no solapadas en un texto normalizado y extrae los spans correspondientes.
 */
function findSpansInSegment(segment: string): MatchSpan[] {
  if (!segment || !/[a-zA-Z]/.test(segment)) return [];

  const normSegment = normalizeUnicode(segment);
  const variants = getSortedVariants();
  const spans: MatchSpan[] = [];

  for (const variant of variants) {
    variant.regex.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = variant.regex.exec(normSegment)) !== null) {
      const start = match.index;
      const end = start + match[0].length;

      // 1. Verificar solapamiento con spans ya aceptados (de mayor longitud)
      const overlaps = spans.some((s) => !(end <= s.start || start >= s.end));
      if (overlaps) continue;

      // 2. Protección URL: no transformar si está precedido de http/https/www en ±40 caracteres
      const leftContext = segment.slice(Math.max(0, start - 40), start);
      if (/(?:https?:\/\/|www\.)\S*$/i.test(leftContext)) {
        continue;
      }

      // 3. Protección JSON key: no transformar si es clave de JSON seguida de '":'
      const rightContext = segment.slice(end, end + 10);
      if (/^\s*":/.test(rightContext)) {
        continue;
      }

      const matchedText = segment.slice(start, end);
      // Validar que el slug exista realmente en el catálogo (D9)
      if (getMaterial(variant.slug)) {
        spans.push({
          start,
          end,
          slug: variant.slug,
          matchedText,
        });
      }
    }
  }

  // Ordenar spans cronológicamente por índice de inicio
  spans.sort((a, b) => a.start - b.start);
  return spans;
}

/**
 * Transforma texto libre reemplazando menciones a materiales del catálogo con tokens [[material:slug]].
 * Idempotente y seguro: no altera URLs, tokens existentes ni palabras cortas (< 6 caracteres).
 */
export function autoTokenizeMaterials(text: string): string {
  if (!text || typeof text !== 'string' || !/[a-zA-Z]/.test(text)) {
    return text;
  }

  // F-03: Normalizar a NFC para garantizar alineación 1:1 de offsets de slice
  const nfcText = text.normalize('NFC');

  // Partir por tokens existentes para no doble-tokenizar
  const parts = nfcText.split(/(\[\[[^\]]*\]\])/);

  return parts
    .map((part) => {
      // Si ya es un token [[...]], devolverlo intacto
      if (part.startsWith('[[') && part.endsWith(']]')) {
        return part;
      }

      const spans = findSpansInSegment(part);
      if (spans.length === 0) {
        return part;
      }

      let result = '';
      let lastIndex = 0;

      for (const span of spans) {
        result += part.slice(lastIndex, span.start);
        // Si el texto original medía >= 10 chars, preservar etiqueta original
        if (span.matchedText.length >= 10) {
          result += `[[material:${span.slug}|${span.matchedText}]]`;
        } else {
          result += `[[material:${span.slug}]]`;
        }
        lastIndex = span.end;
      }

      result += part.slice(lastIndex);
      return result;
    })
    .join('');
}

/**
 * Devuelve los ítems del catálogo detectados en el texto (sin transformarlo).
 * Devuelve slugs únicos en orden de aparición.
 */
export function detectCatalogMaterials(
  text: string
): { slug: string; matchedText: string }[] {
  if (!text || typeof text !== 'string' || !/[a-zA-Z]/.test(text)) {
    return [];
  }

  // F-03: Normalizar a NFC para alineación uniforme de offsets
  const nfcText = text.normalize('NFC');
  const parts = nfcText.split(/(\[\[[^\]]*\]\])/);
  const detected: { slug: string; matchedText: string }[] = [];
  const seenSlugs = new Set<string>();

  for (const part of parts) {
    if (part.startsWith('[[') && part.endsWith(']]')) {
      // Extraer slug de token existente si aplica
      const m = part.match(/^\[\[material:([a-z0-9-]+)(?:\|.*)?\]\]$/i);
      if (m) {
        const slug = m[1].toLowerCase();
        if (getMaterial(slug) && !seenSlugs.has(slug)) {
          seenSlugs.add(slug);
          detected.push({ slug, matchedText: part });
        }
      }
      continue;
    }

    const spans = findSpansInSegment(part);
    for (const span of spans) {
      if (!seenSlugs.has(span.slug)) {
        seenSlugs.add(span.slug);
        detected.push({ slug: span.slug, matchedText: span.matchedText });
      }
    }
  }

  return detected;
}
