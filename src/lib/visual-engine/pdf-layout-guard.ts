/**
 * pdf-layout-guard.ts — Guardia de colisión imagen-texto para jsPDF (Lote C · H-9)
 * SIGPDA-EMS · SEMS Puebla MCCEMS 2026-2027
 *
 * jsPDF pinta en orden: lo dibujado primero queda DEBAJO y lo dibujado después queda ENCIMA.
 * Estrategia (AABB + watermark):
 *   1. Se calcula el bounding box de la imagen y se compara con los boxes de texto/widgets existentes.
 *   2. Sin colisión  → imagen normal (opacidad 1.0).
 *   3. Con colisión  → la imagen se dibuja como marca de agua tenue (opacidad 0.12) para que el texto
 *      que se dibuje DESPUÉS encima siga siendo legible.
 *
 * Contrato: quien invoque drawImageSafe debe hacerlo ANTES de dibujar el texto de la zona.
 */

import { GState, type jsPDF } from 'jspdf';

export interface BoundingBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Opacidad de la imagen cuando se degrada a marca de agua. */
export const WATERMARK_OPACITY = 0.12;

/** AABB (Axis-Aligned Bounding Box): true si los rectángulos se solapan con área positiva. */
export function overlaps(a: BoundingBox, b: BoundingBox): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/**
 * Dibuja una imagen; si colisiona con alguno de los boxes existentes la degrada a watermark.
 * @returns true si se dibujó como watermark (colisión detectada), false si se dibujó normal.
 */
export function drawImageSafe(
  doc: jsPDF,
  buffer: Buffer | Uint8Array,
  format: string,
  imgBox: BoundingBox,
  existingBoxes: readonly BoundingBox[]
): boolean {
  const hasCollision = existingBoxes.some((box) => overlaps(imgBox, box));
  if (!hasCollision) {
    doc.addImage(buffer, format, imgBox.x, imgBox.y, imgBox.w, imgBox.h);
    return false;
  }

  doc.setGState(new GState({ opacity: WATERMARK_OPACITY }));
  try {
    doc.addImage(buffer, format, imgBox.x, imgBox.y, imgBox.w, imgBox.h);
  } finally {
    // Restaurar siempre la opacidad: el texto posterior debe pintarse al 100 %
    doc.setGState(new GState({ opacity: 1 }));
  }
  return true;
}
