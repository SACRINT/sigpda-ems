// src/lib/materials/material-tokens.ts
/**
 * Parser y resolvedor de tokens de materiales para textos de planeaciones y prácticas.
 * SIGPDA-EMS · Ciclo Escolar 2026-2027
 * Sintaxis normativa: [[material:slug]] o [[material:slug|etiqueta visible]]
 */

import { getMaterial, type MaterialCatalogItem } from './materials-catalog';
import { autoTokenizeMaterials } from './auto-tokenize';

/**
 * Expresión regular para detectar tokens de materiales en textos.
 * Permite slug en kebab-case/alfanumérico y etiqueta visible opcional de hasta 80 caracteres.
 */
export const MATERIAL_TOKEN_RE: RegExp =
  /\[\[material:([a-zA-Z0-9-]+)(?:\|([^\]]{1,80}))?\]\]/g;

export interface ResolvedMaterial {
  slug: string;
  label: string;
  item?: MaterialCatalogItem;
  exists: boolean;
}

/**
 * Analiza un texto y extrae todos los tokens de material presentes en orden de aparición.
 */
export function parseMaterialTokens(text: string): ResolvedMaterial[] {
  if (!text || typeof text !== 'string') return [];
  const results: ResolvedMaterial[] = [];
  const regex = new RegExp(MATERIAL_TOKEN_RE.source, MATERIAL_TOKEN_RE.flags);
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const rawSlug = match[1];
    const rawLabel = match[2]?.trim();
    const cleanSlug = rawSlug.toLowerCase();
    const item = getMaterial(cleanSlug);
    const label = rawLabel || item?.name || rawSlug;

    results.push({
      slug: cleanSlug,
      label,
      item,
      exists: Boolean(item),
    });
  }

  return results;
}

/**
 * Resuelve los tokens de un texto markdown sustituyendo los slugs válidos por su etiqueta visible
 * o nombre de catálogo. Si el slug es desconocido, preserva el token literal intacto (D9).
 */
export function resolveMaterialTokensForMarkdown(text: string): string {
  if (!text || typeof text !== 'string') return '';
  const regex = new RegExp(MATERIAL_TOKEN_RE.source, MATERIAL_TOKEN_RE.flags);

  return text.replace(regex, (fullMatch, rawSlug: string, rawLabel: string | undefined) => {
    const cleanSlug = rawSlug.toLowerCase();
    const item = getMaterial(cleanSlug);
    if (!item) {
      // D9: Slug desconocido permanece intacto como texto literal
      return fullMatch;
    }
    const label = rawLabel?.trim();
    return label && label.length > 0 ? label : item.name;
  });
}

/** Fachada para consumidores de render/UI: primero recupera tokens del texto libre, luego parsea. */
export function parseMaterialTokensWithFallback(text: string): ResolvedMaterial[] {
  return parseMaterialTokens(autoTokenizeMaterials(text));
}

/**
 * Remueve completamente la sintaxis de tokens [[material:...]] transformándolos en texto plano legible.
 * Garantiza 0 brackets/tokens crudos en documentos de texto final como planes de clase impresos.
 */
export function stripMaterialTokens(text: string): string {
  if (!text || typeof text !== 'string') return '';
  const regex = new RegExp(MATERIAL_TOKEN_RE.source, MATERIAL_TOKEN_RE.flags);

  return text.replace(regex, (_fullMatch, rawSlug: string, rawLabel: string | undefined) => {
    const label = rawLabel?.trim();
    if (label && label.length > 0) return label;
    const item = getMaterial(rawSlug.toLowerCase());
    return item ? item.name : rawSlug;
  });
}

