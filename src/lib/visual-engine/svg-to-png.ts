/**
 * svg-to-png.ts — Convertidor de SVG Vectorial a Buffer PNG de Alta Resolución
 * SIGPDA-EMS · SEMS Puebla MCCEMS 2026-2027
 *
 * Motor primario: `@resvg/resvg-js` con fuentes abiertas embebidas (`Inter` y `Space Grotesk`)
 * desde `sacrint-font-bootstrap.ts`. Esto garantiza renderizado 100 % determinista de todo
 * `<text>` UTF-8 (acentos, ñ, fórmulas y etiquetas de diagramas) tanto en Windows local como
 * en Vercel Linux serverless — eliminando las cajas vacías sin texto que producía librsvg/sharp
 * cuando no encontraba las fuentes del sistema.
 *
 * Incluye respaldo automático con `sharp` si `Resvg` encontrara un SVG exótico, sin interrumpir
 * jamás la compilación del libro.
 */

import './svg-font-bootstrap';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import { ensureSacrintFontsRegistered, getSacrintFontFiles } from './sacrint/sacrint-font-bootstrap';
import { ensurePngDataUri } from './scene-allocator-node';
import { logger } from '@/lib/logger';

async function inlineTranscodeWebpUris(svg: string): Promise<string> {
  const webpRe = /data:image\/webp;base64,[A-Za-z0-9+/=]+/g;
  const matches = svg.match(webpRe);
  if (!matches || matches.length === 0) return svg;
  const unique = Array.from(new Set(matches));
  let out = svg;
  for (const rawUri of unique) {
    const pngUri = await ensurePngDataUri(rawUri);
    out = out.split(rawUri).join(pngUri);
  }
  return out;
}

/**
 * Normaliza familias tipográficas del sistema en SVGs para que `@resvg/resvg-js`
 * (con `loadSystemFonts: false`) siempre resuelva glifos legibles usando `Inter`.
 */
function normalizeSvgFontFamiliesForResvg(svg: string): string {
  return svg
    .replace(/font-family\s*=\s*"([^"]+)"/gi, (_m, fam: string) => {
      if (/\bInter\b|\bSpace Grotesk\b/i.test(fam)) {
        return `font-family="${fam}"`;
      }
      return 'font-family="Inter, Space Grotesk, sans-serif"';
    })
    .replace(/font-family\s*=\s*'([^']+)'/gi, (_m, fam: string) => {
      if (/\bInter\b|\bSpace Grotesk\b/i.test(fam)) {
        return `font-family='${fam}'`;
      }
      return "font-family='Inter, Space Grotesk, sans-serif'";
    })
    .replace(/font-family\s*:\s*([^;"'}]+)/gi, (_m, fam: string) => {
      if (/\bInter\b|\bSpace Grotesk\b/i.test(fam)) {
        return `font-family: ${fam}`;
      }
      return 'font-family: Inter, Space Grotesk, sans-serif';
    });
}

/**
 * Convierte una cadena SVG a una imagen PNG rasterizada de alta nitidez para DOCX/PDF.
 *
 * @param svgString Cadena de texto que contiene el marcado `<svg>...</svg>`
 * @param density Densidad objetivo en DPI (default: 180 ≈ zoom 1.875× sobre 96 DPI)
 * @returns Buffer PNG listo para `ImageRun` / `doc.addImage()`, o `null` si falla.
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

    // 1. Motor primario determinista: @resvg/resvg-js con fuentes TTF embebidas (0 texto perdido)
    try {
      ensureSacrintFontsRegistered();
      const fontFiles = getSacrintFontFiles();
      const preparedSvg = normalizeSvgFontFamiliesForResvg(await inlineTranscodeWebpUris(cleanSvg));
      const zoom = Math.min(3, Math.max(1, Number((density / 96).toFixed(2))));

      const raster = new Resvg(preparedSvg, {
        font: {
          fontFiles,
          loadSystemFonts: fontFiles.length === 0,
          defaultFontFamily: 'Inter',
          sansSerifFamily: 'Inter',
          serifFamily: 'Inter',
          monospaceFamily: 'Inter',
          defaultFontSize: 14,
        },
        fitTo: zoom === 1 ? { mode: 'original' } : { mode: 'zoom', value: zoom },
        background: 'rgba(255,255,255,0)',
        logLevel: 'error',
      });
      const pngBuffer = Buffer.from(raster.render().asPng());
      if (pngBuffer.length > 0) {
        return { buffer: pngBuffer, format: 'PNG' };
      }
    } catch (resvgError) {
      logger.warn('[VisualEngine] Resvg falló al rasterizar SVG; recurriendo a sharp:', resvgError);
    }

    // 2. Respaldo de contingencia: sharp (librsvg)
    const pngBuffer = await sharp(Buffer.from(cleanSvg, 'utf8'), { density })
      .png({ compressionLevel: 9 })
      .toBuffer();

    return { buffer: pngBuffer, format: 'PNG' };
  } catch (error) {
    logger.error('[VisualEngine] Error al convertir SVG a imagen:', error);
    return null;
  }
}
