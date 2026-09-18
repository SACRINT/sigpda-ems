/**
 * font-loader.ts — Cargador y Gestor Tipográfico Editorial SIGPDA-EMS V7
 * DBEPA Puebla MCCEMS 2026-2027
 *
 * Embebe las fuentes tipográficas del sistema editorial en instancias de jsPDF:
 * - Montserrat-Bold: Encabezados mayores (H1, H2, banners de misión, títulos).
 * - Lato-Bold: Negritas de cuerpo (subtítulos H3/H4, términos de glosario, etiquetas).
 * - Lato-Regular: Cuerpo de texto principal, párrafos justificados, viñetas y descripciones.
 *
 * Maneja degradación limpia a Helvetica si ocurre algún error o si jsPDF no soporta TTF.
 */

import type jsPDF from 'jspdf';
import { latoRegularB64 } from './fonts/lato-regular';
import { latoBoldB64 } from './fonts/lato-bold';
import { montserratBoldB64 } from './fonts/montserrat-bold';
import { FONT, HEADING_THRESHOLD } from './design-tokens';
import { logger } from '@/lib/logger';

export type FontRole = 'body' | 'heading' | 'caption' | 'title';
export type FontWeight = 'normal' | 'bold';

/**
 * Embebe los 3 archivos TTF en el documento jsPDF vía VFS
 * y activa el mapeador inteligente de fuentes editoriales.
 * Retorna true si las fuentes quedaron listas para usarse.
 */
export function loadEditorialFonts(doc: jsPDF): boolean {
  try {
    if (typeof doc.addFileToVFS !== 'function' || typeof doc.addFont !== 'function') {
      return false;
    }

    // Registrar Lato Regular
    doc.addFileToVFS('Lato-Regular.ttf', latoRegularB64);
    doc.addFont('Lato-Regular.ttf', FONT.BODY, 'normal');

    // Registrar Lato Bold
    doc.addFileToVFS('Lato-Bold.ttf', latoBoldB64);
    doc.addFont('Lato-Bold.ttf', FONT.BODY, 'bold');

    // Registrar Montserrat Bold
    doc.addFileToVFS('Montserrat-Bold.ttf', montserratBoldB64);
    doc.addFont('Montserrat-Bold.ttf', FONT.HEADING, 'bold');

    // Mapeador transparente (Monkey-patch intencional):
    // Intercepta llamadas a doc.setFont('helvetica', ...) para enrutar
    // de manera no invasiva más de 100 llamadas existentes hacia Lato y Montserrat
    // según el rol y tamaño semántico, sin requerir refactorizar cada componente legacy.
    const originalSetFont = doc.setFont.bind(doc);
    (doc as any).__originalSetFont = originalSetFont;

    doc.setFont = function (fontName?: string, fontStyle?: string): jsPDF {
      const name = (fontName || '').toLowerCase();
      const style = (fontStyle || 'normal').toLowerCase();

      if (name === 'helvetica' || name === '') {
        if (style === 'bold') {
          // Si el tamaño de fuente actual es >= HEADING_THRESHOLD o es un encabezado, usar Montserrat Bold
          // De lo contrario (etiquetas, negritas en párrafos, glosario), usar Lato Bold
          const curSize = typeof doc.getFontSize === 'function' ? doc.getFontSize() : 9;
          if (curSize >= HEADING_THRESHOLD) {
            return originalSetFont(FONT.HEADING, 'bold');
          }
          return originalSetFont(FONT.BODY, 'bold');
        }
        // Normal o italic: usar Lato Regular
        return originalSetFont(FONT.BODY, 'normal');
      }

      return originalSetFont(fontName as any, fontStyle as any);
    };

    (doc as any).__editorialFontsLoaded = true;
    return true;
  } catch (err) {
    logger.warn('[font-loader] Error registrando fuentes editoriales, usando Helvetica como fallback:', { error: err });
    (doc as any).__editorialFontsLoaded = false;
    return false;
  }
}

/**
 * Consulta si las fuentes editoriales están activas en el documento.
 */
export function areEditorialFontsLoaded(doc: jsPDF): boolean {
  return Boolean((doc as any).__editorialFontsLoaded);
}

/**
 * Aplica la fuente según el rol tipográfico y peso solicitado de forma explícita.
 * Garantiza fallback automático a Helvetica si las fuentes no están disponibles.
 */
export function setEditorialFont(
  doc: jsPDF,
  role: FontRole,
  weight: FontWeight = 'normal'
): void {
  const loaded = areEditorialFontsLoaded(doc);

  if (!loaded) {
    doc.setFont(FONT.FALLBACK, weight);
    return;
  }

  switch (role) {
    case 'heading':
    case 'title':
      // Encabezados usan Montserrat Bold (siempre bold)
      doc.setFont(FONT.HEADING, 'bold');
      break;

    case 'body':
    case 'caption':
    default:
      // Cuerpo usa Lato (normal o bold)
      doc.setFont(FONT.BODY, weight);
      break;
  }
}

/**
 * Helpers directos para agilidad y máxima claridad en el renderer
 */
export function setFontHeading(doc: jsPDF): void {
  setEditorialFont(doc, 'heading', 'bold');
}

export function setFontBody(doc: jsPDF, weight: FontWeight = 'normal'): void {
  setEditorialFont(doc, 'body', weight);
}

export function setFontCaption(doc: jsPDF, weight: FontWeight = 'normal'): void {
  setEditorialFont(doc, 'caption', weight);
}
