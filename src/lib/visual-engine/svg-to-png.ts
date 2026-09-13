/**
 * svg-to-png.ts — Convertidor de SVG Vectorial a Buffer PNG de Alta Resolución
 * SIGPDA-EMS · DBEPA Puebla MCCEMS 2026-2027
 *
 * Utiliza sharp para rasterizar SVGs vectoriales a 300 DPI asegurando nitidez
 * editorial de imprenta al incrustarse en jsPDF.
 * Incluye salvaguarda de error para nunca interrumpir la generación del libro.
 */

import sharp from 'sharp';

/**
 * Convierte una cadena SVG a un Buffer binario PNG a 300 DPI.
 *
 * @param svgString Cadena de texto que contiene el marcado <svg>...</svg>
 * @param density Densidad de píxeles (DPI) para calidad de imprenta (default: 300)
 * @returns Buffer PNG listo para doc.addImage(), o null si falla.
 */
export async function svgToPngBuffer(
  svgString: string,
  density = 300
): Promise<Buffer | null> {
  try {
    if (!svgString || typeof svgString !== 'string') {
      return null;
    }
    const cleanSvg = svgString.trim();
    if (!cleanSvg.startsWith('<svg')) {
      return null;
    }

    const pngBuffer = await sharp(Buffer.from(cleanSvg, 'utf8'), { density })
      .png()
      .toBuffer();

    return pngBuffer;
  } catch (error) {
    console.error('[VisualEngine] Error al convertir SVG a PNG con sharp:', error);
    return null;
  }
}
