/**
 * pdf-scanned-telemetry.test.ts
 *
 * Test de regresión para H-256 (providerUsed/modelUsed reales, no hardcodeados)
 * y H-257 (tokensApprox derivados del usage real de la API, no del largo del markdown).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGenerate = vi.fn();
const mockLogActivity = vi.fn();
const mockResolveUserIsPremium = vi.fn();

vi.mock('@/lib/ai-provider', () => ({
  generateMultimodalWithMetadata: (...args: unknown[]) => mockGenerate(...args),
  resolveUserIsPremium: (...args: unknown[]) => mockResolveUserIsPremium(...args),
  logActivity: (...args: unknown[]) => mockLogActivity(...args),
}));

import { parseScannedPdfWithGemini } from '@/lib/document-ingestion/parsers/pdf-scanned';

describe('H-256 / H-257: telemetría real en el parser de PDF escaneado', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveUserIsPremium.mockResolvedValue(false);
    mockLogActivity.mockResolvedValue(undefined);
  });

  it('H-256: registra el proveedor y el modelo REALMENTE usados (no los hardcodeados)', async () => {
    mockGenerate.mockResolvedValue({
      text: '# Escaneo oficial\nFila 1',
      provider: 'gemini',
      model: 'gemini-3.1-flash-lite',
      usage: { promptTokenCount: 1500, candidatesTokenCount: 700 },
    });

    const buffer = Buffer.from('pdf-escaneado-de-prueba');
    const doc = await parseScannedPdfWithGemini(buffer, 'teacher-uuid-1', 'docente@bachillerato.pue.gob.mx', 'f11-heroes.pdf');

    expect(mockLogActivity).toHaveBeenCalledTimes(1);
    expect(mockLogActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        teacherEmail: 'docente@bachillerato.pue.gob.mx',
        action: 'ingest_document',
        entityType: 'pdf_scanned',
        entityId: 'f11-heroes.pdf',
        providerUsed: 'gemini',
        modelUsed: 'gemini-3.1-flash-lite',
        success: true,
      })
    );
    expect(doc.metadata.modelUsed).toBe('gemini-3.1-flash-lite');
    expect(doc.metadata.ocrApplied).toBe(true);
  });

  it('H-256: el modelo reportado se toma de la respuesta, por lo que cambia si cambia la configuración', async () => {
    mockGenerate.mockResolvedValue({
      text: '# Documento',
      provider: 'gemini',
      model: 'gemini-3.5-flash-lite',
      usage: { promptTokenCount: 10, candidatesTokenCount: 5 },
    });

    await parseScannedPdfWithGemini(Buffer.from('otro'), 't', 'a@b.mx', 'x.pdf');

    expect(mockLogActivity).toHaveBeenCalledWith(
      expect.objectContaining({ modelUsed: 'gemini-3.5-flash-lite' })
    );
  });

  it('H-257: tokensApprox = promptTokenCount + candidatesTokenCount cuando la API reporta usage', async () => {
    mockGenerate.mockResolvedValue({
      text: 'x'.repeat(400),
      provider: 'gemini',
      model: 'gemini-3.1-flash-lite',
      usage: { promptTokenCount: 1500, candidatesTokenCount: 700 },
    });

    await parseScannedPdfWithGemini(Buffer.from('con-usage'), 't', 'a@b.mx', 'y.pdf');

    expect(mockLogActivity).toHaveBeenCalledWith(
      expect.objectContaining({ tokensApprox: 2200 })
    );
  });

  it('H-257: si la API no reporta usage, usa el heurístico de tokens de salida', async () => {
    mockGenerate.mockResolvedValue({
      text: 'x'.repeat(400),
      provider: 'gemini',
      model: 'gemini-3.5-flash-lite',
    });

    await parseScannedPdfWithGemini(Buffer.from('sin-usage'), 't', 'a@b.mx', 'z.pdf');

    expect(mockLogActivity).toHaveBeenCalledWith(
      expect.objectContaining({ tokensApprox: 100 })
    );
  });

  it('propaga el provider/modelo del fallo en el registro de éxito=false', async () => {
    mockGenerate.mockRejectedValue(
      Object.assign(new Error('HTTP 503: quota exceeded'), {
        provider: 'gemini',
        model: 'gemini-3.1-flash-lite',
      })
    );

    await expect(
      parseScannedPdfWithGemini(Buffer.from('fallo'), 't', 'docente@bachillerato.pue.gob.mx', 'falla.pdf')
    ).rejects.toThrow('HTTP 503: quota exceeded');

    expect(mockLogActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        errorMsg: 'HTTP 503: quota exceeded',
        providerUsed: 'gemini',
        modelUsed: 'gemini-3.1-flash-lite',
        teacherEmail: 'docente@bachillerato.pue.gob.mx',
      })
    );
  });

  it('no escribe en activity_log cuando el docente no tiene correo', async () => {
    mockGenerate.mockResolvedValue({
      text: '# Sin correo',
      provider: 'gemini',
      model: 'gemini-3.5-flash-lite',
      usage: { promptTokenCount: 1, candidatesTokenCount: 1 },
    });

    await parseScannedPdfWithGemini(Buffer.from('anonimo'), 'teacher-uuid-1', undefined, 'anon.pdf');

    expect(mockLogActivity).not.toHaveBeenCalled();
  });
});
