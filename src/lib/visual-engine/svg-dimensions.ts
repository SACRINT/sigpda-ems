/**
 * svg-dimensions.ts — Dimensiones nativas de un SVG para escalado proporcional.
 * SIGPDA-EMS · Evita deformar (aplastar/estirar) figuras al incrustarlas en PDF/DOCX
 * usando siempre la relación de aspecto real del propio SVG (viewBox o width/height).
 */

export interface SvgDimensions {
  width: number;
  height: number;
}

/** Relación de aspecto de respaldo (500×350) cuando el SVG no declara dimensiones válidas. */
export const FALLBACK_SVG_DIMENSIONS: SvgDimensions = { width: 500, height: 350 };

function parseNumeric(value: string | undefined): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  // Porcentajes (p. ej. "100%") no son dimensiones absolutas
  if (trimmed.endsWith('%')) return null;
  const n = parseFloat(trimmed);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Lee las dimensiones nativas de un SVG. Prioriza `viewBox`; como respaldo usa
 * `width`/`height` absolutos; si no hay datos válidos devuelve 500×350.
 */
export function extractSvgDimensions(svg: string): SvgDimensions {
  if (typeof svg !== 'string' || !svg) return { ...FALLBACK_SVG_DIMENSIONS };

  const tagMatch = svg.match(/<svg\b[^>]*>/i);
  const tag = tagMatch ? tagMatch[0] : '';

  const viewBoxMatch = tag.match(/viewBox\s*=\s*["']([^"']+)["']/i);
  if (viewBoxMatch) {
    const parts = viewBoxMatch[1].trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts.every((p) => Number.isFinite(p)) && parts[2] > 0 && parts[3] > 0) {
      return { width: parts[2], height: parts[3] };
    }
  }

  const w = parseNumeric(tag.match(/\swidth\s*=\s*["']([^"']+)["']/i)?.[1]);
  const h = parseNumeric(tag.match(/\sheight\s*=\s*["']([^"']+)["']/i)?.[1]);
  if (w && h) return { width: w, height: h };

  return { ...FALLBACK_SVG_DIMENSIONS };
}

/**
 * Ajusta un SVG a un ancho objetivo conservando su proporción.
 * `svgWidth`/`svgHeight` devuelven las unidades nativas (para mapear anotaciones).
 */
export function fitSvgToWidth(
  svg: string,
  targetWidth: number
): { width: number; height: number; svgWidth: number; svgHeight: number } {
  const { width: svgWidth, height: svgHeight } = extractSvgDimensions(svg);
  return {
    width: targetWidth,
    height: targetWidth * (svgHeight / svgWidth),
    svgWidth,
    svgHeight,
  };
}

