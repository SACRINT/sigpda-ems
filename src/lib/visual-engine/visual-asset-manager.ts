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
import type { MissionSection } from '@/types/work-textbook';
import { normalizeUnicode } from '@/lib/utils/normalize';
import { logger } from '@/lib/logger';
import {
  getPrimaryEquipmentForMission,
  type DetectedObject,
} from './object-extractor';
import { generateObjectBlueprintSvg } from './object-svg-generator';
import { downloadAndProcessImage } from './image-downloader';
import { svgToPngBuffer } from './svg-to-png';

export interface ResolveVisualOptions {
  planningId?: string;
  uacName: string;
  blockIndex: number;
  missionIndex: number;
  missionTitle: string;
  contextText?: string;
  preferOpenverseMedia?: boolean;
  preferOpenverseForSciences?: boolean; // Deprecated alias
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
 * Extrae términos de búsqueda inteligentes a partir del título de la misión y la asignatura,
 * removiendo palabras vacías para maximizar la relevancia en Openverse/Wikimedia.
 */
export function buildSmartSearchQuery(uacName: string, missionTitle: string): string {
  const stopWords = new Set([
    'de', 'la', 'el', 'en', 'para', 'los', 'las', 'un', 'una', 'y', 'o', 'del', 'al', 'con', 'por', 'sobre', 'su', 'sus',
    'mision', 'misión', 'bloque', 'actividad', 'progresion', 'progresión', 'proposito', 'propósito', 'taller', 'laboratorio',
    'introduccion', 'introducción', 'desarrollo', 'estudio', 'analisis', 'análisis', 'general', 'fase', 'tema', 'unidad',
    'que', 'como', 'cual', 'quien', 'donde', 'hacer', 'aplicacion', 'aplicación', 'conceptual', 'practica', 'práctica',
    'primer', 'segundo', 'tercer', 'cuarto', 'quinto', 'sexto'
  ]);

  const cleanWords = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^\w\sáéíóúÁÉÍÓÚñÑüÜ]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.has(w));

  const missionWords = cleanWords(missionTitle);
  const uacWords = cleanWords(uacName);

  const selected = missionWords.slice(0, 3);
  if (selected.length < 2 && uacWords.length > 0) {
    selected.push(...uacWords.slice(0, 2 - selected.length));
  }

  const query = selected.join(' ').trim();
  return query || uacName.slice(0, 40);
}

/**
 * Resuelve el recurso visual óptimo para una misión de aprendizaje:
 * - Si está habilitada la búsqueda de medios abiertos (preferOpenverseMedia), intenta obtener una imagen CC real.
 * - Si no, o si falla la red/búsqueda, despacha el gráfico vectorial sintético determinístico (Capa 0).
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
    preferOpenverseMedia,
    preferOpenverseForSciences,
  } = options;

  const preferMedia = preferOpenverseMedia ?? preferOpenverseForSciences ?? false;

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

  // 2. Si está habilitada la búsqueda de medios abiertos en cualquier área
  if (preferMedia) {
    try {
      const searchQuery = buildSmartSearchQuery(uacName, missionTitle);
      let openverseImages = await searchOpenverseImages({
        query: searchQuery,
        subjectName: uacName,
        missionNumber: missionIndex,
        pageSize: 2,
        timeoutMs: 3500,
      });

      // Si la búsqueda específica no devolvió resultados, intentar con la disciplina general
      if (openverseImages.length === 0) {
        const fallbackSubjectQuery = uacName
          .toLowerCase()
          .replace(/[^\w\sáéíóúÁÉÍÓÚñÑüÜ]/g, ' ')
          .replace(/\b(i|ii|iii|iv|v|vi|1|2|3|4|5|6)\b/g, '')
          .trim();

        if (fallbackSubjectQuery && fallbackSubjectQuery !== searchQuery) {
          openverseImages = await searchOpenverseImages({
            query: fallbackSubjectQuery,
            subjectName: uacName,
            missionNumber: missionIndex,
            pageSize: 1,
            timeoutMs: 2500,
          });
        }
      }

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
            logger.warn('[VisualAssetManager] No se pudo persistir activo Openverse:', dbErr);
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
      logger.warn('[VisualAssetManager] Fallback a Capa 0 tras error Openverse:', openverseErr);
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

// ── 4. RESOLUCIÓN DE IMÁGENES CONTEXTUALES DE EQUIPO TÉCNICO (NIVEL 1) ────────

export interface ResolvedEquipmentVisual {
  detected: DetectedObject;
  sourceType: 'openverse_photo' | 'blueprint_svg';
  buffer: Buffer;
  format: 'JPEG' | 'PNG';
  caption: string;
  isHero: boolean;
  mediaAsset?: ImageAsset;
}

// Caché en memoria por sesión (evita re-descargar o re-renderizar el mismo equipo)
const equipmentAssetCache = new Map<string, ResolvedEquipmentVisual>();

/**
 * Valida de forma ligera y estricta que la imagen devuelta por Openverse
 * contenga las palabras clave bilingües del objeto en su título, tags o URL,
 * descartando resultados inconexos antes de descargarlos.
 */
export function isImageRelevanceValid(
  image: OpenverseImageResult,
  detected: DetectedObject
): boolean {
  const targetTokens = detected.keywordsBilingual.map((k) => k.toLowerCase().trim());
  const title = (image.title || '').toLowerCase();
  const landingUrl = (image.foreignLandingUrl || '').toLowerCase();
  const url = (image.url || '').toLowerCase();
  const combinedMeta = `${title} ${landingUrl} ${url}`;

  return targetTokens.some((tok) => tok.length > 2 && combinedMeta.includes(tok));
}

/**
 * Resuelve el activo visual de equipamiento técnico para la misión:
 * 1. Detecta la herramienta o instrumento prioritario en el texto.
 * 2. Consulta la caché en memoria para cero latencia recurrente.
 * 3. Intenta obtener foto CC en Openverse validando bilingüemente su relevancia.
 * 4. Fallback garantizado: Genera y rasteriza el SVG técnico Blueprint institucional.
 */
export async function resolveEquipmentVisualForMission(
  mission: MissionSection,
  subjectName?: string,
  options?: { preferSidebar?: boolean }
): Promise<ResolvedEquipmentVisual | null> {
  const detected = getPrimaryEquipmentForMission(mission, subjectName);
  if (!detected) return null;

  const cacheKey = `${detected.id}_${subjectName || 'uac'}`;
  if (equipmentAssetCache.has(cacheKey)) {
    return equipmentAssetCache.get(cacheKey)!;
  }

  // 1. Intentar obtener foto real en Openverse con validación de relevancia
  try {
    const searchResults = await searchOpenverseImages({
      query: detected.englishQuery,
      subjectName,
      missionNumber: mission.missionIndex,
      pageSize: 3,
      timeoutMs: 3500,
    });

    for (const item of searchResults) {
      if (isImageRelevanceValid(item, detected)) {
        const downloadUrl = item.thumbnail || item.url;
        const processed = await downloadAndProcessImage(downloadUrl, 4000);
        if (processed && processed.buffer) {
          const visual: ResolvedEquipmentVisual = {
            detected,
            sourceType: 'openverse_photo',
            buffer: processed.buffer,
            format: 'JPEG',
            caption: `${detected.name} — ${detected.technicalRole}`,
            isHero: !options?.preferSidebar && detected.confidence >= 0.9 && detected.category === 'herramienta_taller',
            mediaAsset: {
              id: item.id,
              planningId: '',
              blockIndex: 0,
              missionIndex: mission.missionIndex,
              source: 'openverse',
              externalId: item.id,
              title: item.title,
              creator: item.creator,
              creatorUrl: item.creatorUrl,
              license: item.license,
              licenseUrl: item.licenseUrl,
              sourceUrl: item.foreignLandingUrl,
              imageUrl: item.url,
              thumbnailUrl: item.thumbnail,
              caption: `${detected.name} (CC ${item.license.toUpperCase()})`,
              width: processed.width,
              height: processed.height,
              createdAt: new Date(),
            },
          };
          equipmentAssetCache.set(cacheKey, visual);
          return visual;
        }
      }
    }
  } catch (err) {
    logger.warn('[VisualAssetManager] Error consultando Openverse para equipo, usando SVG blueprint:', { error: err });
  }

  // 2. Fallback determinístico a SVG Técnico Blueprint
  try {
    const svg = generateObjectBlueprintSvg(detected.svgKey, detected.name);
    const pngResult = await svgToPngBuffer(svg, 180);
    if (pngResult && pngResult.buffer) {
      const visual: ResolvedEquipmentVisual = {
        detected,
        sourceType: 'blueprint_svg',
        buffer: pngResult.buffer,
        format: 'JPEG',
        caption: `Esquema técnico: ${detected.name} — ${detected.technicalRole}`,
        isHero: !options?.preferSidebar && detected.category === 'herramienta_taller',
      };
      equipmentAssetCache.set(cacheKey, visual);
      return visual;
    }
  } catch (err) {
    logger.warn('[VisualAssetManager] Error rasterizando SVG blueprint:', { error: err });
  }

  return null;
}

