/**
 * document-ingest-cache.test.ts
 * Pruebas unitarias para el sistema de caché SHA-256 de ingestión de documentos (M5-CP3-B).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { IngestedDocument } from '@/lib/document-ingestion/types';

// Mock DB client
const mockDb = vi.fn();
vi.mock('@/lib/db/client', () => ({
  sql: () => mockDb,
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock parsers
vi.mock('@/lib/document-ingestion/parsers/text-parser', () => ({
  parsePlainTextDocument: vi.fn((buffer: Buffer) => ({
    markdown: buffer.toString('utf-8'),
    fullText: buffer.toString('utf-8'),
    totalPages: 1,
    pages: [{ pageNumber: 1, rawText: buffer.toString('utf-8'), markdown: buffer.toString('utf-8') }],
    metadata: {
      format: 'plain-text' as const,
      wordCount: 10,
      charCount: 50,
      ocrApplied: false,
    },
  })),
}));

vi.mock('@/lib/document-ingestion/parsers/docx-parser', () => ({
  parseDocxDocument: vi.fn(),
}));

vi.mock('@/lib/document-ingestion/parsers/image-parser', () => ({
  parseImageDocumentWithGemini: vi.fn(),
}));

vi.mock('@/lib/document-ingestion/parsers/pdf-digital', () => ({
  parseDigitalPdf: vi.fn(),
}));

vi.mock('@/lib/document-ingestion/parsers/pdf-scanned', () => ({
  parseScannedPdfWithGemini: vi.fn(),
}));

import {
  computeDocumentHash,
  getCachedIngest,
  setCachedIngest,
  ingestDocument,
} from '@/lib/document-ingestion';
import { parsePlainTextDocument } from '@/lib/document-ingestion/parsers/text-parser';

describe('Document Ingestion Cache (M5-CP3-B)', () => {
  const originalEnv = process.env.DATABASE_URL;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATABASE_URL = 'postgresql://user:pass@ep-test.neon.tech/neondb';
  });

  afterEach(() => {
    process.env.DATABASE_URL = originalEnv;
  });

  describe('computeDocumentHash', () => {
    it('genera un hash SHA-256 determinista de 64 caracteres hexadecimales', () => {
      const buffer1 = Buffer.from('Documento oficial de prueba SEP 2026');
      const buffer2 = Buffer.from('Documento oficial de prueba SEP 2026');
      const buffer3 = Buffer.from('Otro contenido diferente');

      const hash1 = computeDocumentHash(buffer1);
      const hash2 = computeDocumentHash(buffer2);
      const hash3 = computeDocumentHash(buffer3);

      expect(hash1).toHaveLength(64);
      expect(hash1).toMatch(/^[0-9a-f]{64}$/);
      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(hash3);
    });
  });

  describe('getCachedIngest', () => {
    it('retorna null si DATABASE_URL no está configurada', async () => {
      delete process.env.DATABASE_URL;
      const res = await getCachedIngest('a'.repeat(64));
      expect(res).toBeNull();
      expect(mockDb).not.toHaveBeenCalled();
    });

    it('retorna el documento almacenado si el registro existe y es válido (formato JSONB objeto)', async () => {
      const sampleDoc: IngestedDocument = {
        markdown: '# Ingesta previa',
        fullText: 'Ingesta previa',
        totalPages: 1,
        pages: [{ pageNumber: 1, rawText: 'Ingesta previa', markdown: '# Ingesta previa' }],
        metadata: {
          format: 'plain-text',
          wordCount: 2,
          charCount: 14,
          ocrApplied: false,
        },
      };

      mockDb.mockResolvedValueOnce([{ result: sampleDoc }]);

      const res = await getCachedIngest('a'.repeat(64));
      expect(res).toEqual(sampleDoc);
    });

    it('retorna el documento si el resultado viene serializado como string JSON', async () => {
      const sampleDoc: IngestedDocument = {
        markdown: '# String JSON',
        fullText: 'String JSON',
        totalPages: 1,
        pages: [{ pageNumber: 1, rawText: 'String JSON', markdown: '# String JSON' }],
        metadata: {
          format: 'plain-text',
          wordCount: 2,
          charCount: 11,
          ocrApplied: false,
        },
      };

      mockDb.mockResolvedValueOnce([{ result: JSON.stringify(sampleDoc) }]);

      const res = await getCachedIngest('b'.repeat(64));
      expect(res).toEqual(sampleDoc);
    });

    it('retorna null si no se encuentran registros coincidentes en Neon', async () => {
      mockDb.mockResolvedValueOnce([]);
      const res = await getCachedIngest('c'.repeat(64));
      expect(res).toBeNull();
    });

    it('retorna null si el registro en base de datos está corrupto o vacío', async () => {
      mockDb.mockResolvedValueOnce([{ result: { markdown: '', totalPages: 0 } }]);
      const res = await getCachedIngest('d'.repeat(64));
      expect(res).toBeNull();
    });

    it('captura errores de base de datos de manera resiliente y retorna null', async () => {
      mockDb.mockRejectedValueOnce(new Error('Connection timeout to Neon'));
      const res = await getCachedIngest('e'.repeat(64));
      expect(res).toBeNull();
    });
  });

  describe('setCachedIngest', () => {
    it('no persiste si DATABASE_URL no está configurada', async () => {
      delete process.env.DATABASE_URL;
      const validDoc: IngestedDocument = {
        markdown: '# Test',
        fullText: 'Test',
        totalPages: 1,
        pages: [],
        metadata: { format: 'plain-text', wordCount: 1, charCount: 4, ocrApplied: false },
      };

      await setCachedIngest('f'.repeat(64), validDoc);
      expect(mockDb).not.toHaveBeenCalled();
    });

    it('no persiste si el documento tiene integridad inválida (ej. totalPages <= 0 o markdown vacío)', async () => {
      const invalidDoc: IngestedDocument = {
        markdown: '',
        fullText: '',
        totalPages: 0,
        pages: [],
        metadata: { format: 'plain-text', wordCount: 0, charCount: 0, ocrApplied: false },
      };

      await setCachedIngest('g'.repeat(64), invalidDoc);
      expect(mockDb).not.toHaveBeenCalled();
    });

    it('ejecuta inserción exitosa con ON CONFLICT en Neon', async () => {
      mockDb.mockResolvedValueOnce([]);
      const validDoc: IngestedDocument = {
        markdown: '# Test Válido',
        fullText: 'Test Válido',
        totalPages: 2,
        pages: [],
        metadata: { format: 'plain-text', wordCount: 2, charCount: 11, ocrApplied: false },
      };

      await setCachedIngest('h'.repeat(64), validDoc);
      expect(mockDb).toHaveBeenCalledTimes(1);
    });

    it('no arroja error si la base de datos falla al guardar (non-blocking)', async () => {
      mockDb.mockRejectedValueOnce(new Error('Neon write error'));
      const validDoc: IngestedDocument = {
        markdown: '# Test Válido',
        fullText: 'Test Válido',
        totalPages: 1,
        pages: [],
        metadata: { format: 'plain-text', wordCount: 2, charCount: 11, ocrApplied: false },
      };

      await expect(setCachedIngest('i'.repeat(64), validDoc)).resolves.not.toThrow();
    });
  });

  describe('ingestDocument integration with cache', () => {
    it('retorna documento desde caché en cache HIT sin invocar parsers de archivo', async () => {
      const buffer = Buffer.from('contenido de prueba con hash conocido');
      const cachedDoc: IngestedDocument = {
        markdown: '# En Caché Instantáneo',
        fullText: 'En Caché Instantáneo',
        totalPages: 1,
        pages: [],
        metadata: {
          format: 'plain-text',
          wordCount: 3,
          charCount: 20,
          ocrApplied: false,
        },
      };

      // Mock cache lookup hit
      mockDb.mockResolvedValueOnce([{ result: cachedDoc }]);

      const result = await ingestDocument(buffer, { filename: 'test.txt' });

      expect(result).toEqual(cachedDoc);
      expect(parsePlainTextDocument).not.toHaveBeenCalled();
    });

    it('ejecuta parser y persiste en caché en cache MISS', async () => {
      const buffer = Buffer.from('nuevo archivo nunca antes visto');

      // Mock cache miss (retorna [])
      mockDb.mockResolvedValueOnce([]);
      // Mock cache store insert
      mockDb.mockResolvedValueOnce([]);

      const result = await ingestDocument(buffer, { filename: 'nuevo.txt' });

      expect(parsePlainTextDocument).toHaveBeenCalledTimes(1);
      expect(result.markdown).toBe('nuevo archivo nunca antes visto');
      // Verificamos que se ejecutó la inserción en DB
      expect(mockDb).toHaveBeenCalledTimes(2);
    });

    it('omite la caché y re-ejecuta parser cuando bypassCache es true', async () => {
      const buffer = Buffer.from('reingesta forzada');

      // Mock cache store insert tras parser
      mockDb.mockResolvedValueOnce([]);

      const result = await ingestDocument(buffer, { filename: 'forzado.txt', bypassCache: true });

      expect(parsePlainTextDocument).toHaveBeenCalledTimes(1);
      expect(result.markdown).toBe('reingesta forzada');
      // Solo 1 llamada a db (el setCachedIngest), sin consulta getCachedIngest previa
      expect(mockDb).toHaveBeenCalledTimes(1);
    });

    it('continúa normalmente con el parser si la consulta de caché falla con excepción', async () => {
      const buffer = Buffer.from('archivo resiliente ante caída de db');

      // Mock db failure en get
      mockDb.mockRejectedValueOnce(new Error('Neon down'));
      // Mock db failure en set
      mockDb.mockRejectedValueOnce(new Error('Neon down'));

      const result = await ingestDocument(buffer, { filename: 'resiliente.txt' });

      expect(parsePlainTextDocument).toHaveBeenCalledTimes(1);
      expect(result.markdown).toBe('archivo resiliente ante caída de db');
    });
  });
});
