// src/lib/materials/slug-index.ts
/**
 * Helper de generación de índice de slugs de materiales para inyección en prompts de IA.
 * SIGPDA-EMS · Ciclo Escolar 2026-2027
 */

import { MATERIALES_CATALOG, type MaterialCategory } from './materials-catalog';
import { normalizeUnicode } from '@/lib/utils/normalize';
import { logger } from '@/lib/logger';

export const MATERIAL_INDEX_MAX_CHARS = 9000;

interface KeywordCategoryMapping {
  keywords: string[];
  categories: MaterialCategory[];
}

const CONTEXT_KEYWORD_MAP: KeywordCategoryMapping[] = [
  {
    keywords: ['medicion', 'fisica', 'electricidad', 'electronica', 'instrumentacion'],
    categories: ['medicion', 'fisica', 'herramientas', 'energia'],
  },
  {
    keywords: ['quimica', 'laboratorio', 'biologia'],
    categories: ['laboratorio_quimica', 'laboratorio_bio'],
  },
  {
    keywords: ['matematicas', 'pensamiento matematico'],
    categories: ['matematicas'],
  },
  {
    keywords: ['alimentos', 'gastronomia'],
    categories: ['alimentos', 'salud'],
  },
  {
    keywords: ['construccion', 'albanileria'],
    categories: ['construccion'],
  },
  {
    keywords: ['mecanica', 'industrial'],
    categories: ['industrial', 'energia'],
  },
  {
    keywords: ['logistica', 'almacen'],
    categories: ['logistica'],
  },
  {
    keywords: ['ofimatica', 'computacion', 'ti', 'informatica'],
    categories: ['computo', 'ofimatica'],
  },
  {
    keywords: ['arte', 'artes', 'dibujo'],
    categories: ['arte'],
  },
  {
    keywords: ['deporte', 'deportivo', 'educacion fisica'],
    categories: ['deportivo'],
  },
  {
    keywords: ['agro', 'horticultura', 'agronomia'],
    categories: ['agro'],
  },
  {
    keywords: ['epp', 'seguridad', 'proteccion civil'],
    categories: ['seguridad_epp'],
  },
];

const LABORAL_CATEGORIES: MaterialCategory[] = [
  'industrial',
  'energia',
  'construccion',
  'alimentos',
  'logistica',
  'servicios',
  'salud',
  'ofimatica',
];

/**
 * Mapea UAC/subsistema/componente a categorías del catálogo de materiales.
 * Sin match → devuelve [] (lo que indica al llamador usar el índice completo de 244).
 */
export function getMaterialCategoriesForContext(
  subjectOrUac: string,
  component?: string
): MaterialCategory[] {
  const normSubject = normalizeUnicode(subjectOrUac || '');
  const normComponent = normalizeUnicode(component || '');
  const matchedCategories = new Set<MaterialCategory>();

  if (normComponent.includes('laboral')) {
    LABORAL_CATEGORIES.forEach((cat) => matchedCategories.add(cat));
  }

  if (normSubject) {
    for (const entry of CONTEXT_KEYWORD_MAP) {
      for (const kw of entry.keywords) {
        if (kw === 'ti') {
          if (/\bti\b/.test(normSubject)) {
            entry.categories.forEach((cat) => matchedCategories.add(cat));
            break;
          }
        } else if (normSubject.includes(kw)) {
          entry.categories.forEach((cat) => matchedCategories.add(cat));
          break;
        }
      }
    }
  }

  return Array.from(matchedCategories);
}

/**
 * Índice compacto y determinista para inyectar en prompts.
 * Orden: category, luego name.
 * Si se especifica maxChars y la salida excede ese límite, trunca por categorías completas y registra logger.warn.
 */
export function buildMaterialSlugIndex(
  categories?: MaterialCategory[],
  maxChars?: number
): string {
  const wanted = categories && categories.length > 0 ? new Set(categories) : null;
  const filtered = MATERIALES_CATALOG.filter((m) => !wanted || wanted.has(m.category));

  const sorted = [...filtered].sort(
    (a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)
  );

  const fullIndex = sorted.map((m) => `- ${m.slug} — ${m.name}`).join('\n');

  if (maxChars && fullIndex.length > maxChars) {
    logger.warn(
      `Material slug index exceeded maxChars limit (${fullIndex.length} > ${maxChars}). Truncating by full categories.`
    );

    // Obtener orden único de categorías preservando el orden de sorted
    const categoryOrder: MaterialCategory[] = [];
    for (const item of sorted) {
      if (!categoryOrder.includes(item.category)) {
        categoryOrder.push(item.category);
      }
    }

    const acceptedItems: typeof sorted = [];
    let currentLength = 0;

    for (const cat of categoryOrder) {
      const itemsInCat = sorted.filter((m) => m.category === cat);
      const linesForCat = itemsInCat.map((m) => `- ${m.slug} — ${m.name}`).join('\n');
      const addedLength = acceptedItems.length === 0 ? linesForCat.length : 1 + linesForCat.length;

      if (currentLength + addedLength <= maxChars) {
        acceptedItems.push(...itemsInCat);
        currentLength += addedLength;
      } else {
        break;
      }
    }

    return acceptedItems.map((m) => `- ${m.slug} — ${m.name}`).join('\n');
  }

  return fullIndex;
}
