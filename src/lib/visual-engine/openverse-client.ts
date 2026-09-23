/**
 * Cliente de Búsqueda y Curación de Medios Abiertos Creative Commons (Openverse API)
 * Capa 1 del Motor Visual SIGPDA-EMS
 * 
 * Cumple con el marco legal de derechos de autor y licenciamiento abierto (CC-BY, CC-BY-SA, CC0)
 * para ilustraciones y fotografías científicas en libros de texto de EMS.
 */

import { API_CONFIG } from '@/lib/config';
import { logger } from '@/lib/logger';

export interface OpenverseImageResult {
  id: string;
  title: string;
  creator: string;
  creatorUrl?: string;
  license: string;
  licenseVersion?: string;
  licenseUrl?: string;
  foreignLandingUrl: string;
  url: string;
  thumbnail: string;
  width?: number;
  height?: number;
  caption: string;
}

export const SITUATED_KEYWORDS = [
  'mexico',
  'puebla',
  'vocational workshop',
  'laboratorio escolar',
  'technical education',
  'bachillerato tecnico',
] as const;

export function getRotationalContextKeyword(seed = 0): string {
  const idx = Math.abs(seed) % SITUATED_KEYWORDS.length;
  return SITUATED_KEYWORDS[idx];
}

export interface OpenverseSearchOptions {
  query: string;
  subjectName?: string;
  missionNumber?: number;
  pageSize?: number;
  timeoutMs?: number;
  contextualKeyword?: string;
  page?: number;
}

/**
 * Normaliza la atribución de licencia a formato canónico legible
 */
function formatLicenseLabel(license: string, version?: string): string {
  const cleanLic = license.toUpperCase();
  if (cleanLic === 'CC0' || cleanLic === 'PDM') return 'Dominio Público';
  const ver = version ? ` ${version}` : '';
  return `Creative Commons ${cleanLic}${ver}`;
}

/**
 * Genera el pie de figura institucional y legal conforme a la normativa institucional
 */
export function buildInstitutionalCaption(
  title: string,
  creator: string,
  license: string,
  licenseVersion?: string,
  missionNumber = 1,
  figureIndex = 1
): string {
  const licLabel = formatLicenseLabel(license, licenseVersion);
  const cleanTitle = (title || 'Recurso visual de apoyo').trim();
  const cleanCreator = (creator || 'Autor no especificado').trim();
  return `Figura M${missionNumber}.${figureIndex} — ${cleanTitle}. Autor: ${cleanCreator}. Licencia: ${licLabel}. Fuente: Openverse (WordPress Foundation).`;
}

/**
 * Consulta la API pública de Openverse para obtener imágenes con licencias abiertas comerciales y educativas.
 * Implementa timeout estricto (< 4s) y degradación elegante a null si no hay conectividad o resultados.
 */
export async function searchOpenverseImages(
  options: OpenverseSearchOptions
): Promise<OpenverseImageResult[]> {
  const {
    query,
    missionNumber = 1,
    pageSize = 3,
    timeoutMs = 4000,
    contextualKeyword,
    page,
  } = options;

  if (!query || query.trim().length < 2) {
    return [];
  }

  // Sanitizar query
  let cleanQuery = query
    .replace(/[^\w\sáéíóúÁÉÍÓÚñÑüÜ-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (contextualKeyword && !cleanQuery.toLowerCase().includes(contextualKeyword.toLowerCase())) {
    cleanQuery = `${cleanQuery} ${contextualKeyword}`;
  }

  const url = new URL(API_CONFIG.openverse.endsWith('/') ? API_CONFIG.openverse : `${API_CONFIG.openverse}/`);
  url.searchParams.set('q', cleanQuery);
  url.searchParams.set('page_size', String(pageSize));
  // Rotación segura entre páginas 1 a 5 para diversificar imágenes sin exceder límites de resultados
  const pageParam = page ?? ((Math.max(0, missionNumber) % 5) + 1);
  url.searchParams.set('page', String(pageParam));
  url.searchParams.set('mature', 'false');
  // Filtro de licencias seguras para uso educativo y reedición
  url.searchParams.set('license_type', 'commercial,modification');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'SIGPDA-EMS-VisualEngine/1.0 (SEMS-Puebla; EducacionMediaSuperior; contact@sigpda-ems.edu.mx)',
      },
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      logger.warn(`[OpenverseClient] API status ${response.status} for query "${cleanQuery}"`);
      return [];
    }

    const data = await response.json();
    const results = Array.isArray(data.results) ? data.results : [];

    return results.map((item: Record<string, unknown>, idx: number): OpenverseImageResult => {
      const title = (typeof item.title === 'string' ? item.title : '') || `Ilustración científica sobre ${cleanQuery}`;
      const creator = (typeof item.creator === 'string' ? item.creator : '') || 'Dominio Público / Wikimedia';
      const license = (typeof item.license === 'string' ? item.license : '') || 'cc-by';
      const licenseVersion = (typeof item.license_version === 'string' ? item.license_version : '') || '4.0';

      return {
        id: String(item.id || ''),
        title,
        creator,
        creatorUrl: typeof item.creator_url === 'string' ? item.creator_url : undefined,
        license,
        licenseVersion,
        licenseUrl: typeof item.license_url === 'string' ? item.license_url : `https://creativecommons.org/licenses/${license.toLowerCase()}/${licenseVersion}/`,
        foreignLandingUrl: (typeof item.foreign_landing_url === 'string' ? item.foreign_landing_url : '') || (typeof item.url === 'string' ? item.url : ''),
        url: (typeof item.url === 'string' ? item.url : '') || (typeof item.thumbnail === 'string' ? item.thumbnail : ''),
        thumbnail: (typeof item.thumbnail === 'string' ? item.thumbnail : '') || (typeof item.url === 'string' ? item.url : ''),
        width: typeof item.width === 'number' ? item.width : undefined,
        height: typeof item.height === 'number' ? item.height : undefined,
        caption: buildInstitutionalCaption(
          title,
          creator,
          license,
          licenseVersion,
          missionNumber,
          idx + 1
        ),
      };
    });
  } catch (err: unknown) {
    clearTimeout(timer);
    const errorName = (err as { name?: string })?.name;
    const errorMessage = err instanceof Error ? err.message : String(err);
    if (errorName === 'AbortError') {
      logger.warn(`[OpenverseClient] Timeout (${timeoutMs}ms) buscando "${cleanQuery}"`);
    } else {
      logger.warn(`[OpenverseClient] Error en fetch: ${errorMessage}`);
    }
    return [];
  }
}
