/**
 * svg-to-png.ts — Convertidor de SVG Vectorial a Buffer PNG de Alta Resolución
 * SIGPDA-EMS · SEMS Puebla MCCEMS 2026-2027
 *
 * Utiliza sharp para rasterizar SVGs vectoriales a 300 DPI asegurando nitidez
 * editorial de imprenta al incrustarse en jsPDF.
 * Incluye salvaguarda de error para nunca interrumpir la generación del libro.
 */

import sharp from 'sharp';
import { logger } from '@/lib/logger';

/**
 * Convierte una cadena SVG a una imagen rasterizada optimizada para jsPDF.
 * Utiliza sharp con fondo blanco y compresión JPEG 85 a 180 DPI, produciendo
 * diagramas nítidos de ~25KB en vez de bitmaps sin comprimir de 12MB.
 *
 * @param svgString Cadena de texto que contiene el marcado <svg>...</svg>
 * @param density Densidad de píxeles (DPI) (default: 180)
 * @returns Buffer JPEG listo para doc.addImage(), o null si falla.
 */
export async function svgToPngBuffer(
  svgString: string,
  density = 180
): Promise<{ buffer: Buffer; format: 'JPEG' } | null> {
  try {
    if (!svgString || typeof svgString !== 'string') {
      return null;
    }
    const cleanSvg = svgString.trim();
    if (!cleanSvg.startsWith('<svg')) {
      return null;
    }

    const jpegBuffer = await sharp(Buffer.from(cleanSvg, 'utf8'), { density })
      .flatten({ background: '#FFFFFF' })
      .jpeg({ quality: 85 })
      .toBuffer();

    return { buffer: jpegBuffer, format: 'JPEG' };
  } catch (error) {
    logger.error('[VisualEngine] Error al convertir SVG a imagen con sharp:', error);
    return null;
  }
}
