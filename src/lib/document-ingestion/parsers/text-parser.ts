/**
 * text-parser.ts
 * Parser para archivos de texto plano (.txt, .md).
 */

import type { IngestedDocument } from '../types';

export function parsePlainTextDocument(buffer: Buffer): IngestedDocument {
  const content = buffer.toString('utf-8').trim();

  if (!content) {
    throw new Error('El archivo de texto está vacío.');
  }

  const pages = [
    {
      pageNumber: 1,
      rawText: content,
      markdown: content,
    },
  ];

  return {
    markdown: content,
    fullText: content,
    totalPages: 1,
    pages,
    metadata: {
      format: 'plain-text',
      wordCount: content.split(/\s+/).filter(Boolean).length,
      charCount: content.length,
      ocrApplied: false,
    },
  };
}
