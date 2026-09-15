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

export interface OpenverseSearchOptions {
  query: string;
  subjectName?: string;
  missionNumber?: number;
  pageSize?: number;
  timeoutMs?: number;
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
 * Genera el pie de figura institucional y legal conforme a la normativa de la DBEPA
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
  } = options;

  if (!query || query.trim().length < 2) {
    return [];
  }

  // Sanitizar query
  const cleanQuery = query
    .replace(/[^\w\sáéíóúÁÉÍÓÚñÑüÜ-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const url = new URL(API_CONFIG.openverse.endsWith('/') ? API_CONFIG.openverse : `${API_CONFIG.openverse}/`);
  url.searchParams.set('q', cleanQuery);
  url.searchParams.set('page_size', String(pageSize));
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

    return results.map((item: any, idx: number): OpenverseImageResult => {
      const title = item.title || `Ilustración científica sobre ${cleanQuery}`;
      const creator = item.creator || 'Dominio Público / Wikimedia';
      const license = item.license || 'cc-by';
      const licenseVersion = item.license_version || '4.0';

      return {
        id: String(item.id || ''),
        title,
        creator,
        creatorUrl: item.creator_url || undefined,
        license,
        licenseVersion,
        licenseUrl: item.license_url || `https://creativecommons.org/licenses/${license.toLowerCase()}/${licenseVersion}/`,
        foreignLandingUrl: item.foreign_landing_url || item.url || '',
        url: item.url || item.thumbnail || '',
        thumbnail: item.thumbnail || item.url || '',
        width: item.width || undefined,
        height: item.height || undefined,
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
  } catch (err: any) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      logger.warn(`[OpenverseClient] Timeout (${timeoutMs}ms) buscando "${cleanQuery}"`);
    } else {
      logger.warn(`[OpenverseClient] Error en fetch: ${err.message}`);
    }
    return [];
  }
}
