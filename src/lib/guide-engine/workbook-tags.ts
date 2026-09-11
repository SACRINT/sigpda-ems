/**
 * Workbook Tags Parser & Serializer
 * SIGPDA-EMS · DBEPA Puebla MCCEMS 2026-2027
 *
 * Parsea y genera las etiquetas custom de comentarios HTML para el Cuaderno de Trabajo Activo.
 * Estas etiquetas permiten que el texto en Markdown se transforme en elementos nativos de
 * escritura manual (renglones, tablas vacías, casillas, cuadros de dibujo) en Word y PDF.
 */

import type { WorkbookElement, WorkbookElementType } from '@/types/work-textbook';

export interface ParsedWorkbookTag {
  rawTag: string;
  type: WorkbookElementType;
  params: Record<string, string>;
  element: WorkbookElement;
}

// Regex principal que captura <!--workbook:TYPE:params-->
const WORKBOOK_TAG_REGEX = /<!--\s*workbook:([a-z_]+)(?::([^>]*?))?\s*-->/gi;

/**
 * Serializa un WorkbookElement a su representación en tag Markdown
 */
export function stringifyWorkbookTag(element: WorkbookElement): string {
  const parts: string[] = [];

  switch (element.type) {
    case 'lines':
      parts.push(`rows=${element.config?.rows || 4}`);
      break;
    case 'empty_table':
      if (element.config?.cols && element.config.cols.length > 0) {
        parts.push(`cols=${element.config.cols.join(',')}`);
      }
      if (element.config?.sampleRows) {
        parts.push(`rows=${element.config.sampleRows}`);
      }
      break;
    case 'checkbox_list':
      if (element.config?.checkboxes && element.config.checkboxes.length > 0) {
        parts.push(`items=${element.config.checkboxes.join('|')}`);
      }
      break;
    case 'code_box':
      if (element.config?.rows) {
        parts.push(`lines=${element.config.rows}`);
      }
      break;
    case 'drawing_box':
      parts.push(`height=${element.config?.heightPx || 140}`);
      break;
    case 'data_recording':
      if (element.config?.cols) {
        parts.push(`cols=${element.config.cols.join(',')}`);
      }
      parts.push(`rows=${element.config?.sampleRows || 6}`);
      break;
  }

  const paramStr = parts.length > 0 ? `:${parts.join(';')}` : '';
  return `<!--workbook:${element.type}${paramStr}-->`;
}

/**
 * Parsea un tag individual como `<!--workbook:lines:rows=5-->`
 */
export function parseSingleTag(tagText: string): ParsedWorkbookTag | null {
  const match = WORKBOOK_TAG_REGEX.exec(tagText);
  WORKBOOK_TAG_REGEX.lastIndex = 0; // reset regex state
  if (!match) return null;

  const rawType = match[1].toLowerCase() as WorkbookElementType;
  const rawParams = match[2] || '';
  const params: Record<string, string> = {};

  if (rawParams.trim().length > 0) {
    const pairs = rawParams.split(/[;,]/);
    for (const pair of pairs) {
      const [key, ...vals] = pair.split('=');
      if (key && vals.length > 0) {
        params[key.trim().toLowerCase()] = vals.join('=').trim();
      }
    }
  }

  const element: WorkbookElement = {
    id: `wb-tag-${Math.random().toString(36).substring(2, 9)}`,
    type: rawType,
    config: {},
  };

  switch (rawType) {
    case 'lines':
      element.config = {
        rows: params.rows ? parseInt(params.rows, 10) : 4,
      };
      break;
    case 'empty_table':
    case 'data_recording':
      element.config = {
        cols: params.cols ? params.cols.split(',').map((c) => c.trim()) : ['Variable / Parámetro', 'Medición 1', 'Medición 2', 'Unidad'],
        sampleRows: params.rows ? parseInt(params.rows, 10) : 5,
      };
      break;
    case 'checkbox_list':
      element.config = {
        checkboxes: params.items ? params.items.split('|').map((i) => i.trim()) : [],
      };
      break;
    case 'drawing_box':
      element.config = {
        heightPx: params.height ? parseInt(params.height, 10) : 140,
      };
      break;
    case 'code_box':
      element.config = {
        rows: params.lines ? parseInt(params.lines, 10) : 8,
      };
      break;
  }

  return {
    rawTag: match[0],
    type: rawType,
    params,
    element,
  };
}

/**
 * Extrae todos los tags de cuaderno activo encontrados en un bloque Markdown
 */
export function extractWorkbookTags(markdown: string): ParsedWorkbookTag[] {
  const tags: ParsedWorkbookTag[] = [];
  let match: RegExpExecArray | null;

  const regex = new RegExp(WORKBOOK_TAG_REGEX.source, 'gi');
  while ((match = regex.exec(markdown)) !== null) {
    const parsed = parseSingleTag(match[0]);
    if (parsed) {
      tags.push(parsed);
    }
  }

  return tags;
}

/**
 * Reemplaza los tags de workbook en Markdown por texto legible para previsualización simple en pantalla
 */
export function formatWorkbookTagsForPreview(markdown: string): string {
  return markdown.replace(WORKBOOK_TAG_REGEX, (raw, type, params) => {
    switch (type) {
      case 'lines':
        return '\n\n*✍️ [Espacio para responder a mano en tu cuaderno - Renglones impresos]*\n\n';
      case 'empty_table':
      case 'data_recording':
        return '\n\n*📊 [Tabla de registro de datos experimentales para completar con mediciones]*\n\n';
      case 'checkbox_list':
        return '\n\n*☐ [Lista de cotejo / Casillas de verificación]*\n\n';
      case 'drawing_box':
        return '\n\n*📐 [Espacio delimitado para esquema, circuito o diagrama de flujo]*\n\n';
      case 'code_box':
        return '\n\n*💻 [Espacio para escribir código fuente estructurado]*\n\n';
      default:
        return raw;
    }
  });
}
