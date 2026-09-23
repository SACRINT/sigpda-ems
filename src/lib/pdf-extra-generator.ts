/**
 * pdf-extra-generator.ts — Fachada Pública de Generación PDF para Recursos Didácticos
 * SIGPDA-EMS · MCCEMS Puebla 2026-2027
 *
 * Mantiene la firma pública canónica `generateExtraPDF(extra: ExtraInput): jsPDF`
 * delegando la composición, tipografía editorial, negritas inline y ribbons
 * al orquestador visual unificado `pdf-extra-renderer.ts`.
 */

import jsPDF from 'jspdf';
import { loadEditorialFonts } from '@/lib/visual-engine/font-loader';
import {
  renderExtraDocument,
  type ExtraInput,
} from '@/lib/pdf-extra-renderer';
import type { BrandingContext } from '@/lib/document-branding';

export type { ExtraInput };

/**
 * Genera un documento PDF oficial formateado según el estándar editorial MCCEMS.
 * Rubricas se renderizan en orientación horizontal (Landscape); los demás tipos en vertical (Portrait).
 */
export function generateExtraPDF(
  extra: ExtraInput,
  context?: BrandingContext
): jsPDF {
  const isRubric = extra.type === 'rubric';
  const doc = new jsPDF({
    orientation: isRubric ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'letter',
  });

  // H-028: Inicializar fuentes editoriales oficiales (Lato Regular/Bold + Montserrat Bold)
  loadEditorialFonts(doc);

  // Orquestación visual delegada al motor unificado
  renderExtraDocument(doc, extra, context);

  return doc;
}
