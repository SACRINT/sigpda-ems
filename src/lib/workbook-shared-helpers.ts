/**
 * workbook-shared-helpers.ts — Helpers compartidos del motor de Cuadernos de Trabajo
 * SIGPDA-EMS · Fase 4 (PR 4.3 — Desacoplo previo al retiro de jsPDF en PR 4.4)
 *
 * Extrae las 6 utilidades compartidas y el tipo `RealTocEntry` desde
 * `src/lib/pdf-workbook-renderer.ts` para desacoplar consumidores, pruebas
 * y renderers (Typst V2, DOCX, PDF) sin romper compatibilidad hacia atrás.
 */

import type jsPDF from 'jspdf';
import type { ActiveWorkTextbook } from '@/types/work-textbook';
import type { Planning } from '@/types/planning';
import { isUnusableResourceUrl, pickCuratedResourceForText } from '@/lib/resources/curated-resources';
import { stripMarkdown } from '@/lib/visual-engine/content-extractor';
import {
  normalizePdfEditorialText,
  normalizeMathNotation,
  toWinAnsiMathSafe,
} from '@/lib/editorial/text-normalization';
import { stripMarkdownTables } from '@/lib/editorial/markdown-table-sanitizer';
import { COLOR, type RGB } from '@/lib/visual-engine/design-tokens';

const DARK_TEXT: RGB = COLOR.TEXT_PRIMARY;

// ── Mapa de Emojis a Texto WinAnsi Seguro ─────────────────────────────────────
const EMOJI_TO_TEXT: Record<string, string> = {
  '📊': 'DATO',
  '📅': 'FECHA',
  '💬': 'CITA',
  '💡': 'IDEA',
  '⚡': 'CLAVE',
  '★': '•',
  '☆': '•',
  '✓': '•',
  '✔': '•',
};

// Caracteres WinAnsi soportados por fuentes estándar jsPDF (Helvetica)
const WIN_ANSI_REGEX = /[^\x20-\xFF√€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ¡-ÿ\n\r\t]/g;

/**
 * Elimina cualquier carácter fuera del juego WinAnsi y reemplaza emojis
 * para evitar corrupción tipográfica (como 'Ø=ÜÅ') en jsPDF Helvetica.
 */
export function sanitizePdfText(text: string | null | undefined): string {
  if (!text) return '';
  let str = toWinAnsiMathSafe(normalizePdfEditorialText(text.replace(/<!--[\s\S]*?-->/g, '')));
  for (const [emoji, replacement] of Object.entries(EMOJI_TO_TEXT)) {
    if (str.includes(emoji)) {
      str = str.split(emoji).join(replacement);
    }
  }
  return str.replace(WIN_ANSI_REGEX, '');
}

/**
 * Repara pasos pegados inline: si "Paso N:" o "Ecuación N:" aparece en medio
 * de un párrafo sin salto previo, inserta doble salto para que el renderer lo
 * trate como nuevo bloque.
 */
export function separatePasoInline(text: string): string {
  return text
    .replace(/(^|\n)[ \t]*\d+\.\s*\n+(?=[ \t]*Paso\s+\d+\s*[:\-])/gi, '$1')
    .replace(/([^\n])\r?\n[ \t]*(?=(?:\*\*)?Paso\s+\d+\s*[:\-])/gi, '$1\n\n')
    .replace(/([^\n])([.;:?!]?)[ \t]*(Paso\s+\d+\s*[:\-])/gi, '$1$2\n\n$3')
    .replace(/([^\n])([.;:?!]?)[ \t]*(Ecuaci[oó]n\s+\d+\s*:)/gi, '$1$2\n\n$3');
}

/**
 * Pipeline completo para texto del libro PDF:
 * quita tablas Markdown → normaliza notación matemática → separa pasos pegados
 * inline → quita Markdown → sanitiza para WinAnsi.
 */
export function cleanBookText(value: string | null | undefined): string {
  return sanitizePdfText(
    separatePasoInline(
      normalizeMathNotation(
        stripMarkdown(
          separatePasoInline(
            stripMarkdownTables(value || '')
          )
        )
      )
    )
  );
}

/**
 * Resuelve la metodología activa declarada en el workbook o en la planeación
 * (soportando propiedades camelCase y snake_case históricas).
 */
export function resolveWorkbookMethodology(
  workbook: ActiveWorkTextbook,
  planning?: Planning | null
): string | undefined {
  const rawPlanning = planning as unknown as {
    metodologia_activa?: string;
    extractedData?: { metodologiaActiva?: string };
    extracted_data?: { metodologiaActiva?: string };
  } | null | undefined;
  return (
    (workbook as unknown as { methodology?: string }).methodology ||
    planning?.metodologiaActiva ||
    rawPlanning?.metodologia_activa ||
    planning?.contentJson?.sectionI?.metodologiaActiva ||
    rawPlanning?.extractedData?.metodologiaActiva ||
    rawPlanning?.extracted_data?.metodologiaActiva ||
    planning?.contentJson?.sectionIV?.activities?.[workbook.blockIndex]?.methodology ||
    planning?.contentJson?.sectionIV?.activities?.find((a) => Boolean(a?.methodology))?.methodology
  );
}

/**
 * Garantiza espacio vertical suficiente antes de dibujar un bloque o tabla.
 * Si no cabe, añade una página y reinicia currentY.
 */
export function ensureVerticalSpace(
  doc: jsPDF,
  currentY: number,
  neededHeight: number,
  margin: number,
  pageHeight: number
): number {
  if (currentY + neededHeight > pageHeight - margin - 8) {
    doc.addPage();
    return margin + 8;
  }
  return currentY;
}

/**
 * Imprime un párrafo de texto multilínea con partición y salto de página automático.
 * Evita que el texto se corte al final del margen inferior de la página.
 */
export function printParagraph(
  doc: jsPDF,
  text: string,
  startY: number,
  margin: number,
  contentWidth: number,
  pageHeight: number,
  options: {
    size?: number;
    fontStyle?: 'normal' | 'bold' | 'italic';
    fontName?: 'helvetica' | 'courier';
    color?: [number, number, number];
    lineHeight?: number;
    justify?: boolean;
    parseParagraphs?: boolean;
    paragraphSpacing?: number;
  } = {}
): number {
  const {
    size = 9.0,
    fontStyle = 'normal',
    fontName = 'helvetica',
    color = DARK_TEXT,
    lineHeight = 6.0,
    justify = true,
    parseParagraphs = false,
    paragraphSpacing = 6.5,
  } = options;

  const cleanText = cleanBookText(text || '');

  doc.setFont(fontName, fontStyle);
  doc.setFontSize(size);
  doc.setTextColor(...color);

  let y = startY;

  if (parseParagraphs) {
    const stepProtected = cleanText
      .replace(/(?:^|\n|\.\s+)(Paso\s+\d+\s*[:\-])/gi, '\n\n$1')
      .replace(/(?:^|\n)(\d+[\.\)]\s+)/g, '\n\n$1')
      .replace(/(?:^|\n)([•\-\*]\s+)/g, '\n\n$1');
    const rawParagraphs = stepProtected.split(/\r?\n\r?\n/).map((p) => p.trim()).filter(Boolean);
    for (let pIdx = 0; pIdx < rawParagraphs.length; pIdx++) {
      const p = rawParagraphs[pIdx];
      const isBullet = /^[•\-\*]\s+/.test(p) || /^\d+[\.\)]\s+/.test(p);
      const leftMargin = isBullet ? margin + 3.5 : margin;
      const pWidth = isBullet ? contentWidth - 3.5 : contentWidth;
      const lines = doc.splitTextToSize(p, pWidth);

      for (let i = 0; i < lines.length; i++) {
        if (y + lineHeight > pageHeight - margin - 8) {
          doc.addPage();
          y = margin + 8;
          doc.setFont(fontName, fontStyle);
          doc.setFontSize(size);
          doc.setTextColor(...color);
        }
        const isLastLine = i === lines.length - 1;
        if (justify && !isLastLine && !isBullet) {
          doc.text(lines[i], leftMargin, y, { maxWidth: pWidth, align: 'justify' });
        } else {
          doc.text(lines[i], leftMargin, y);
        }
        y += lineHeight;
      }
      if (pIdx < rawParagraphs.length - 1) {
        y += paragraphSpacing;
      }
    }
    return y;
  }

  const lines = doc.splitTextToSize(cleanText, contentWidth);

  for (let i = 0; i < lines.length; i++) {
    if (y + lineHeight > pageHeight - margin - 8) {
      doc.addPage();
      y = margin + 8;
      doc.setFont(fontName, fontStyle);
      doc.setFontSize(size);
      doc.setTextColor(...color);
    }
    const isLastLine = i === lines.length - 1;
    if (justify && !isLastLine) {
      doc.text(lines[i], margin, y, { maxWidth: contentWidth, align: 'justify' });
    } else {
      doc.text(lines[i], margin, y);
    }
    y += lineHeight;
  }

  return y;
}

export interface RealTocEntry {
  sectionLabel: string;
  title: string;
  sessionsRange: string;
  pageNumber: number;
}

/**
 * Normaliza enlaces de recursos educativos para erradicar errores 404 por IDs de YouTube
 * o URLs de ejemplo alucinadas por el LLM. Reemplaza búsquedas o placeholders por la
 * biblioteca curada conservando enlaces directos válidos.
 */
export function sanitizeEducationalResourceUrl(url: string, titulo: string, tipo: string): string {
  const cleanTitle = cleanBookText(titulo || 'Recurso educativo EMS').trim();
  const rawUrl = (url || '').trim();

  if (isUnusableResourceUrl(rawUrl)) {
    const curated = pickCuratedResourceForText(
      `${cleanTitle} ${tipo}`,
      tipo === 'video' ? 'video' : tipo === 'lectura' ? 'lectura' : 'web'
    );
    return curated.url;
  }

  return rawUrl;
}
