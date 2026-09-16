/**
 * image-downloader.ts — Descargador y Optimizador Raster para Activos Openverse / Web
 * SIGPDA-EMS · Motor Visual Editorial 2026-2027
 *
 * Descarga imágenes de Openverse (Wikimedia, Flickr, CC), las normaliza y redimensiona
 * mediante `sharp` a JPEG optimizado (máx 1200px, 85% calidad) para garantizar renderizado
 * ultra-rápido, nítido y libre de errores en jsPDF y docx.
 */

import sharp from 'sharp';
import { logger } from '@/lib/logger';

export interface ProcessedImageResult {
  buffer: Buffer;
  width: number;
  height: number;
  format: 'JPEG';
}

const memoryImageCache = new Map<string, ProcessedImageResult>();

/**
 * Descarga una imagen remota y la normaliza a un buffer JPEG compatible.
 * Incluye caché en memoria por URL y timeout de seguridad para no frenar la compilación.
 */
export async function downloadAndProcessImage(
  url: string,
  timeoutMs = 5000
): Promise<ProcessedImageResult | null> {
  if (!url || typeof url !== 'string' || !url.startsWith('http')) {
    return null;
  }

  // 1. Verificar caché en memoria de la sesión
  if (memoryImageCache.has(url)) {
    return memoryImageCache.get(url)!;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'SIGPDA-EMS-VisualEngine/1.0 (SEMS-Puebla; EducacionMediaSuperior)',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      logger.warn(`[ImageDownloader] HTTP ${response.status} al descargar imagen: ${url}`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const rawBuffer = Buffer.from(arrayBuffer);

    if (rawBuffer.length < 100) {
      logger.warn(`[ImageDownloader] Imagen vacía o corrupta (${rawBuffer.length} bytes): ${url}`);
      return null;
    }

    // Normalizar con sharp: redimensionar proporcionalmente a máx 1200x900, fondo blanco si es transparente, JPEG 85%
    const image = sharp(rawBuffer);
    const metadata = await image.metadata();

    const jpegBuffer = await image
      .resize({
        width: 1200,
        height: 900,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .flatten({ background: '#FFFFFF' })
      .jpeg({ quality: 85 })
      .toBuffer();

    const processedMeta = await sharp(jpegBuffer).metadata();
    const width = processedMeta.width || metadata.width || 800;
    const height = processedMeta.height || metadata.height || 600;

    const result: ProcessedImageResult = {
      buffer: jpegBuffer,
      width,
      height,
      format: 'JPEG',
    };

    memoryImageCache.set(url, result);
    return result;
  } catch (err: any) {
    clearTimeout(timer);
    if (err?.name === 'AbortError') {
      logger.warn(`[ImageDownloader] Timeout (${timeoutMs}ms) al descargar imagen: ${url}`);
    } else {
      logger.warn(`[ImageDownloader] Error al procesar imagen remota (${url}):`, err?.message || err);
    }
    return null;
  }
}
