/**
 * docx-parser.ts
 * Parser nativo para documentos de Microsoft Word (.docx) usando mammoth.js.
 * 100% JavaScript puro, cero dependencias binarias, compatible con Vercel Serverless.
 */

import mammoth from 'mammoth';
import type { IngestedDocument } from '../types';

export async function parseDocxDocument(buffer: Buffer): Promise<IngestedDocument> {
  // 1. Extraer a Markdown estructurado con estilos de encabezados y listas nativas
  const mdResult = await mammoth.convertToMarkdown({ buffer });
  const markdown = mdResult.value.trim();

  // 2. Extraer texto plano continuo
  const textResult = await mammoth.extractRawText({ buffer });
  const fullText = textResult.value.trim();

  if (!markdown || markdown.length < 20) {
    throw new Error('El archivo Word (.docx) no contiene texto legible o está vacío.');
  }

  // Desglosar por secciones o encabezados principales si existen
  const sectionChunks = markdown.split(/\n(?=#+\s)/g);
  const pages = sectionChunks.map((chunk: string, idx: number) => ({
    pageNumber: idx + 1,
    rawText: chunk.replace(/[#*`|_\-]/g, ' ').replace(/\s+/g, ' ').trim(),
    markdown: chunk.trim(),
    hasTables: chunk.includes('|'),
  }));

  return {
    markdown,
    fullText,
    totalPages: Math.max(1, pages.length),
    pages,
    metadata: {
      format: 'docx',
      wordCount: fullText.split(/\s+/).filter(Boolean).length,
      charCount: fullText.length,
      ocrApplied: false,
    },
  };
}
