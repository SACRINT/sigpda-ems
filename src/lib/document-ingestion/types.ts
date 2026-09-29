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

export type DocumentFormat = 'pdf-digital' | 'pdf-scanned' | 'docx' | 'plain-text' | 'image';

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
  /** Correo del docente autenticado para logging de actividad (activity_log.teacher_email) */
  teacherEmail?: string;
  /** Si true, ignora la caché existente y fuerza la re-ingesta y actualización de la caché */
  bypassCache?: boolean;
}

/**
 * Método de extracción determinista empleado para derivar un campo del documento.
 */
export type ExtractionMethod =
  | 'structural_anchor' // Etiqueta oficial / texto invariante + distancia geométrica < umbral
  | 'coordinate_band'   // Búsqueda en banda Y fija o heurística de coordenadas espaciales
  | 'regex_fulltext'    // Expresión regular sobre texto plano continuo concatenado
  | 'cross_validated'   // Valor validado/confirmado en 2+ fuentes o sumas de control
  | 'inferred';         // Inferencia por descarte o valor predeterminado sin comprobación

/**
 * Normalización en español para compatibilidad directa con interfaces de usuario.
 */
export type FuenteExtraccion =
  | 'ancla_estructural'
  | 'banda_coordenadas'
  | 'inferencia'
  | 'validacion_cruzada'
  | 'regex_texto';

/**
 * Representa un campo extraído con trazabilidad de su método y nivel de confianza.
 */
export interface ExtractedField<T> {
  value: T | null;
  method: ExtractionMethod;
  fuente: FuenteExtraccion;
  confidence: number; // 0.0 a 1.0
  tolerance_px?: number;
  requiresManualValidation: boolean;
}

export function methodToFuente(method: ExtractionMethod): FuenteExtraccion {
  switch (method) {
    case 'structural_anchor':
      return 'ancla_estructural';
    case 'coordinate_band':
      return 'banda_coordenadas';
    case 'regex_fulltext':
      return 'regex_texto';
    case 'cross_validated':
      return 'validacion_cruzada';
    case 'inferred':
    default:
      return 'inferencia';
  }
}

export function createExtractedField<T>(
  value: T | null,
  method: ExtractionMethod,
  confidence: number,
  tolerance_px?: number
): ExtractedField<T> {
  const normConf = Number(Math.max(0, Math.min(1, confidence)).toFixed(2));
  return {
    value,
    method,
    fuente: methodToFuente(method),
    confidence: normConf,
    tolerance_px,
    requiresManualValidation: method === 'inferred' || normConf < 0.75,
  };
}
