/**
 * svg-to-png.ts — Convertidor de SVG Vectorial a Buffer PNG de Alta Resolución
 * SIGPDA-EMS · SEMS Puebla MCCEMS 2026-2027
 *
 * Utiliza sharp para rasterizar SVGs vectoriales a 300 DPI asegurando nitidez
 * editorial de imprenta al incrustarse en jsPDF.
 * Incluye salvaguarda de error para nunca interrumpir la generación del libro.
 */

import './svg-font-bootstrap';
import sharp from 'sharp';
import { logger } from '@/lib/logger';

/**
 * Convierte una cadena SVG a una imagen rasterizada optimizada para PDF/DOCX.
 * Utiliza sharp con fondo TRANSPARENTE (canal alfa) y compresión PNG, produciendo
 * figuras vectoriales que se integran sin recuadro blanco sobre el papel.
 *
 * @param svgString Cadena de texto que contiene el marcado <svg>...</svg>
 * @param density Densidad de píxeles (DPI) (default: 180)
 * @returns Buffer PNG (con transparencia) listo para doc.addImage()/ImageRun, o null si falla.
 */
export async function svgToPngBuffer(
  svgString: string,
  density = 180
): Promise<{ buffer: Buffer; format: 'PNG' } | null> {
  try {
    if (!svgString || typeof svgString !== 'string') {
      return null;
    }
    const cleanSvg = svgString.trim();
    if (!cleanSvg.startsWith('<svg')) {
      return null;
    }

    const pngBuffer = await sharp(Buffer.from(cleanSvg, 'utf8'), { density })
      .png({ compressionLevel: 9 })
      .toBuffer();

    return { buffer: pngBuffer, format: 'PNG' };
  } catch (error) {
    logger.error('[VisualEngine] Error al convertir SVG a imagen con sharp:', error);
    return null;
  }
}
