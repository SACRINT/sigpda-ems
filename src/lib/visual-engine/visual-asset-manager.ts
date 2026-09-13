/**
 * visual-asset-manager.ts — Gestor Unificado de Activos Visuales (Capa 0 y Capa 1)
 * SIGPDA-EMS · DBEPA Puebla MCCEMS 2026-2027
 *
 * Coordina:
 * 1. Capa 0: Generación vectorial sintética determinística (SVG sin texto).
 * 2. Capa 1: Búsqueda y curación de medios abiertos con licenciamiento Creative Commons (Openverse API).
 * 3. Persistencia y auditoría legal en la tabla `image_assets` de Postgres.
 */

import { dispatchVisual } from './visual-dispatcher';
import type { VisualResult } from './generators/stem-generator';
import { searchOpenverseImages, type OpenverseImageResult } from './openverse-client';
import {
  saveImageAsset,
  getImageAssetByMission,
  getImageAssetsByBlock,
} from '@/lib/db';
import type { ImageAsset } from '@/types/planning';
import { normalizeUnicode } from '@/lib/utils/normalize';

export interface ResolveVisualOptions {
  planningId?: string;
  uacName: string;
  blockIndex: number;
  missionIndex: number;
  missionTitle: string;
  contextText?: string;
  preferOpenverseForSciences?: boolean;
}

export interface ResolvedVisual {
  type: 'vector_svg' | 'openverse_media';
  svg?: string;
  annotations?: VisualResult['annotations'];
  mediaAsset?: ImageAsset;
  caption: string;
}

const NATURAL_SCIENCES_KEYWORDS = [
  'biología',
  'biologia',
  'química',
  'quimica',
  'ecología',
  'ecologia',
  'la materia y sus interacciones',
  'conservación de la energía',
  'ciencias naturales',
  'ciencias de la salud',
  'microbiología',
  'anatomía',
  'botánica',
  'zoología',
  'geografía física',
];

export function isNaturalScienceSubject(uacName: string): boolean {
  const norm = normalizeUnicode(uacName);
  return NATURAL_SCIENCES_KEYWORDS.some((kw) => {
    const normKw = normalizeUnicode(kw);
    return norm.includes(normKw);
  });
}

/**
 * Resuelve el recurso visual óptimo para una misión de aprendizaje:
 * - Si es una ciencia natural/experimental y se solicita Openverse, intenta obtener una imagen CC-BY real.
 * - Si no, o si falla la red, despacha el gráfico vectorial sintético determinístico (Capa 0).
 */
export async function resolveVisualForMission(
  options: ResolveVisualOptions
): Promise<ResolvedVisual | null> {
  const {
    planningId,
    uacName,
    blockIndex,
    missionIndex,
    missionTitle,
    contextText,
    preferOpenverseForSciences = false,
  } = options;

  // 1. Si hay planningId, verificar si ya existe un activo persistido en BD
  if (planningId) {
    try {
      const existing = await getImageAssetByMission(planningId, blockIndex, missionIndex);
      if (existing) {
        return {
          type: existing.source === 'openverse' ? 'openverse_media' : 'vector_svg',
          mediaAsset: existing,
          caption: existing.caption,
        };
      }
    } catch {
      // Continuar con resolución en memoria si falla consulta de base de datos
    }
  }

  // 2. Si es ciencia natural y está habilitada la búsqueda de medios abiertos
  if (preferOpenverseForSciences && isNaturalScienceSubject(uacName)) {
    try {
      const searchQuery = `${missionTitle} science`.slice(0, 50);
      const openverseImages = await searchOpenverseImages({
        query: searchQuery,
        subjectName: uacName,
        missionNumber: missionIndex,
        pageSize: 1,
        timeoutMs: 3000,
      });

      if (openverseImages.length > 0) {
        const top = openverseImages[0];
        let savedAsset: ImageAsset | undefined;

        if (planningId) {
          try {
            savedAsset = await saveImageAsset({
              planningId,
              blockIndex,
              missionIndex,
              source: 'openverse',
              externalId: top.id,
              title: top.title,
              creator: top.creator,
              creatorUrl: top.creatorUrl,
              license: top.license,
              licenseUrl: top.licenseUrl,
              sourceUrl: top.foreignLandingUrl,
              imageUrl: top.url,
              thumbnailUrl: top.thumbnail,
              caption: top.caption,
              width: top.width,
              height: top.height,
            });
          } catch (dbErr) {
            console.warn('[VisualAssetManager] No se pudo persistir activo Openverse:', dbErr);
          }
        }

        return {
          type: 'openverse_media',
          mediaAsset: savedAsset || {
            id: top.id,
            planningId: planningId || '',
            blockIndex,
            missionIndex,
            source: 'openverse',
            externalId: top.id,
            title: top.title,
            creator: top.creator,
            creatorUrl: top.creatorUrl,
            license: top.license,
            licenseUrl: top.licenseUrl,
            sourceUrl: top.foreignLandingUrl,
            imageUrl: top.url,
            thumbnailUrl: top.thumbnail,
            caption: top.caption,
            width: top.width,
            height: top.height,
            createdAt: new Date(),
          },
          caption: top.caption,
        };
      }
    } catch (openverseErr) {
      console.warn('[VisualAssetManager] Fallback a Capa 0 tras error Openverse:', openverseErr);
    }
  }

  // 3. Despachar gráfico sintético determinístico de Capa 0
  const vectorResult = dispatchVisual(uacName, missionTitle, contextText);
  if (!vectorResult) {
    return null;
  }

  const caption = `Figura M${missionIndex}.1 — Representación gráfica conceptual y espacio de tabulación guiada`;

  return {
    type: 'vector_svg',
    svg: vectorResult.svg,
    annotations: vectorResult.annotations,
    caption,
  };
}
