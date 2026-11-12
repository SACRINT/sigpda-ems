/**
 * workbook-sanitizer.ts — Sanitizador determinista y puro de recursos de Workbooks.
 * SIGPDA-EMS · Nivel 1 Plataforma y Motor Editorial
 *
 * Elimina y sustituye cualquier URL de búsqueda abierta (youtube.com/results, google.com/search)
 * o placeholder por recursos educativos curados y estables de `CURATED_RESOURCES`.
 *
 * Es una función pura e idempotente: ejecutarla múltiples veces sobre un workbook
 * ya saneado produce `replacedCount: 0` y la misma estructura.
 */

import type { ActiveWorkTextbook, RecursoItem, SessionPlan } from '@/types/work-textbook';
import {
  pickCuratedResourceForText,
  type CuratedResource,
  type CuratedResourceType,
} from '@/lib/resources/curated-resources';

/**
 * Determina si una URL corresponde a un motor de búsqueda, consulta genérica
 * o enlace no verificable que viola el estándar editorial.
 */
export function isGenericSearchUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return true;
  const trimmed = url.trim().toLowerCase();
  if (
    !trimmed ||
    trimmed === '#' ||
    trimmed === 'about:blank' ||
    trimmed.startsWith('javascript:')
  ) {
    return true;
  }
  if (
    trimmed.includes('youtube.com/results') ||
    trimmed.includes('youtube.com/search') ||
    trimmed.includes('youtu.be/results')
  ) {
    return true;
  }
  if (
    trimmed.includes('google.com/search') ||
    trimmed.includes('google.com.mx/search') ||
    trimmed.includes('google.es/search')
  ) {
    return true;
  }
  if (
    trimmed.includes('bing.com/search') ||
    trimmed.includes('yahoo.com/search') ||
    trimmed.includes('duckduckgo.com/?q=')
  ) {
    return true;
  }
  if (
    trimmed.includes('search_query=') ||
    trimmed.includes('search?q=') ||
    trimmed.includes('&q=')
  ) {
    return true;
  }
  if (
    trimmed.includes('example.com') ||
    trimmed.includes('placeholder') ||
    trimmed.includes('localhost')
  ) {
    return true;
  }
  return false;
}

/**
 * Mapea el tipo de recurso curado ('video' | 'web' | 'lectura' | 'simulador' | 'manual')
 * al tipo soportado por RecursoItem ('video' | 'web' | 'lectura').
 */
function mapCuratedTypeToRecursoType(tipo: CuratedResourceType): 'video' | 'web' | 'lectura' {
  if (tipo === 'video') return 'video';
  if (tipo === 'lectura' || tipo === 'manual') return 'lectura';
  return 'web';
}

/**
 * Sanitiza recursivamente un `ActiveWorkTextbook`, reemplazando enlaces genéricos
 * de búsqueda en cada sesión de cada misión por recursos institucionales pertinentes.
 */
export function sanitizeWorkbookResourceUrls(
  workbook: ActiveWorkTextbook
): { sanitized: ActiveWorkTextbook; replacedCount: number } {
  if (!workbook || typeof workbook !== 'object') {
    return { sanitized: workbook, replacedCount: 0 };
  }

  // Clonación profunda estructurada para garantizar pureza
  const sanitized: ActiveWorkTextbook = JSON.parse(JSON.stringify(workbook));
  let replacedCount = 0;

  const subjectContext = `${sanitized.coverData?.subjectName || ''} ${sanitized.blockName || ''}`;

  if (Array.isArray(sanitized.missions)) {
    for (const mission of sanitized.missions) {
      const missionContext = `${subjectContext} ${mission.title || ''} ${mission.sessionTopic || ''} ${mission.sessionFocus || ''}`;

      if (Array.isArray(mission.sessionPlans)) {
        for (const session of mission.sessionPlans) {
          const sessionContext = `${missionContext} Sesión ${session.sessionNumber} ${session.objetivo || ''} ${session.contenido || ''} ${session.aplicacion || ''}`;

          if (Array.isArray(session.recursos)) {
            for (let i = 0; i < session.recursos.length; i++) {
              const rec = session.recursos[i];
              if (isGenericSearchUrl(rec.url)) {
                const queryText = `${sessionContext} ${rec.titulo || ''}`;
                const preferredType = rec.tipo || 'web';
                const curated = pickCuratedResourceForText(queryText, preferredType);

                session.recursos[i] = {
                  titulo: curated.titulo,
                  url: curated.url,
                  tipo: mapCuratedTypeToRecursoType(curated.tipo),
                };
                replacedCount++;
              }
            }
          }
        }
      }
    }
  }

  return { sanitized, replacedCount };
}
