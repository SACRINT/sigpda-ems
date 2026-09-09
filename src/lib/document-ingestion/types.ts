/**
 * types.ts
 * Contratos e interfaces del DocumentIngestionEngine (SIGPDA-EMS).
 */

export interface DocumentPage {
  pageNumber: number;
  rawText: string;
  markdown: string;
  hasTables?: boolean;
}

export type DocumentFormat = 'pdf-digital' | 'pdf-scanned' | 'docx' | 'plain-text';

export interface IngestedDocument {
  /** Documento consolidado en Markdown limpio con jerarquía estructural y tablas */
  markdown: string;
  /** Texto plano continuo y normalizado */
  fullText: string;
  /** Número total de páginas procesadas */
  totalPages: number;
  /** Desglose por páginas individuales (cuando aplica) */
  pages: DocumentPage[];
  /** Metadatos de la extracción e ingesta */
  metadata: {
    format: DocumentFormat;
    wordCount: number;
    charCount: number;
    ocrApplied: boolean;
    modelUsed?: string;
  };
}

export interface IngestOptions {
  /** Nombre del archivo original (para inferir formato y contexto) */
  filename?: string;
  /** Tipo MIME explícito reportado por el navegador o cliente HTTP */
  mimeType?: string;
  /** Si true y el documento es un PDF sin texto seleccionable, se activa el OCR de Gemini Flash Lite */
  enableOcr?: boolean;
  /** Límite de páginas a procesar para prevenir desbordamientos de memoria */
  maxPages?: number;
  /** ID del docente para resolución de perfil en el pool de IA */
  teacherId?: string;
}
