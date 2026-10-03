/**
 * infographic-exporter.ts — Exportación de infografías a PNG (300 DPI Carta) y PDF de una página.
 * SIGPDA-EMS · Motor Visual (H-321)
 */

import sharp from 'sharp';
import { jsPDF } from 'jspdf';
import type { Infographic } from './infographic-generator';

/** Ancho en píxeles de una hoja Carta (8.5 in) a 300 DPI. */
export const LETTER_300DPI_WIDTH = 2550;

/** Rasteriza el SVG a PNG de alta resolución (Carta @ 300 DPI). */
export async function infographicToPng(info: Infographic): Promise<Buffer> {
  const density = Math.ceil((LETTER_300DPI_WIDTH / info.width) * 72);
  return sharp(Buffer.from(info.svg, 'utf8'), { density })
    .resize({ width: LETTER_300DPI_WIDTH })
    .flatten({ background: '#FFFFFF' })
    .png({ compressionLevel: 9 })
    .withMetadata({ density: 300 })
    .toBuffer();
}

/** Genera un PDF de una sola página tamaño Carta con la infografía a sangre completa. */
export async function infographicToPdf(info: Infographic): Promise<Buffer> {
  const png = await infographicToPng(info);
  const doc = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'portrait', compress: true });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  doc.setProperties({ title: `Infografía · ${info.title}` });
  doc.addImage(`data:image/png;base64,${png.toString('base64')}`, 'PNG', 0, 0, pageW, pageH, undefined, 'FAST');
  return Buffer.from(doc.output('arraybuffer'));
}
