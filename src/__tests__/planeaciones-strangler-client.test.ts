import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  exportPlanningPdfWithFallback,
  generateSequenceWithFallback,
} from '@/lib/planeaciones/strangler-client';

describe('planeaciones strangler-client (Patrón Strangler Fig UI & Feature Detection por 501)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.unstubAllGlobals();
  });

  describe('exportPlanningPdfWithFallback', () => {
    const planningId = '8f1c3d2e-4b5a-6c7d-8e9f-0a1b2c3d4e5f';

    it('1. HTTP 501 (flag OFF en servidor) delega transparentemente en onLegacyFallback sin romper UX', async () => {
      const fallbackSpy = vi.fn().mockResolvedValue(undefined);

      global.fetch = vi.fn().mockResolvedValue({
        status: 501,
        ok: false,
        json: async () => ({ error: 'Exportación a PDF en servidor no habilitada en modo legacy' }),
      } as unknown as Response);

      const result = await exportPlanningPdfWithFallback({
        planningId,
        filename: 'test.pdf',
        onLegacyFallback: fallbackSpy,
      });

      expect(global.fetch).toHaveBeenCalledWith(`/api/planeaciones/${planningId}/pdf`, {
        method: 'GET',
      });
      expect(fallbackSpy).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        source: 'legacy',
        status: 501,
      });
    });

    it('2. HTTP 200 (flag ON en servidor) consume el binario del orquestador y NO ejecuta onLegacyFallback', async () => {
      const fallbackSpy = vi.fn();
      const mockBlob = new Blob(['%PDF-1.4 simulated binary'], { type: 'application/pdf' });

      const createObjectURLMock = vi.fn().mockReturnValue('blob:mock-url');
      const revokeObjectURLMock = vi.fn();
      const clickSpy = vi.fn();
      const removeSpy = vi.fn();
      const appendChildSpy = vi.fn();

      const mockLink = {
        set href(_val: string) {},
        set download(_val: string) {},
        click: clickSpy,
        remove: removeSpy,
      };

      vi.stubGlobal('window', {
        URL: {
          createObjectURL: createObjectURLMock,
          revokeObjectURL: revokeObjectURLMock,
        },
      });

      vi.stubGlobal('document', {
        createElement: vi.fn().mockReturnValue(mockLink),
        body: {
          appendChild: appendChildSpy,
        },
      });

      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        blob: async () => mockBlob,
      } as unknown as Response);

      const result = await exportPlanningPdfWithFallback({
        planningId,
        filename: 'planeacion-oficial.pdf',
        onLegacyFallback: fallbackSpy,
      });

      expect(fallbackSpy).not.toHaveBeenCalled();
      expect(result.source).toBe('orchestrator');
      expect(result.status).toBe(200);
      expect(result.blob).toBeDefined();
      expect(createObjectURLMock).toHaveBeenCalledWith(mockBlob);
      expect(appendChildSpy).toHaveBeenCalledWith(mockLink);
      expect(clickSpy).toHaveBeenCalled();
      expect(removeSpy).toHaveBeenCalled();
      expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:mock-url');
    });

    it('3. HTTP 403 (F-49 ownership) retorna mensaje descriptivo de permisos sin ejecutar fallback', async () => {
      const fallbackSpy = vi.fn();

      global.fetch = vi.fn().mockResolvedValue({
        status: 403,
        ok: false,
        json: async () => ({ error: 'Acceso denegado a esta planeación' }),
      } as unknown as Response);

      const result = await exportPlanningPdfWithFallback({
        planningId,
        filename: 'test.pdf',
        onLegacyFallback: fallbackSpy,
      });

      expect(fallbackSpy).not.toHaveBeenCalled();
      expect(result.source).toBe('orchestrator');
      expect(result.status).toBe(403);
      expect(result.error).toContain('no tienes permisos');
    });

    it('4. HTTP 401 retorna mensaje claro de autenticación sin ejecutar fallback', async () => {
      const fallbackSpy = vi.fn();

      global.fetch = vi.fn().mockResolvedValue({
        status: 401,
        ok: false,
        json: async () => ({ error: 'No autorizado' }),
      } as unknown as Response);

      const result = await exportPlanningPdfWithFallback({
        planningId,
        filename: 'test.pdf',
        onLegacyFallback: fallbackSpy,
      });

      expect(fallbackSpy).not.toHaveBeenCalled();
      expect(result.source).toBe('orchestrator');
      expect(result.status).toBe(401);
      expect(result.error).toContain('Sesión no autorizada');
    });

    it('5. HTTP 404 retorna mensaje amigable de planeación no encontrada', async () => {
      const fallbackSpy = vi.fn();

      global.fetch = vi.fn().mockResolvedValue({
        status: 404,
        ok: false,
        json: async () => ({ error: 'Planeación no encontrada' }),
      } as unknown as Response);

      const result = await exportPlanningPdfWithFallback({
        planningId,
        filename: 'test.pdf',
        onLegacyFallback: fallbackSpy,
      });

      expect(fallbackSpy).not.toHaveBeenCalled();
      expect(result.source).toBe('orchestrator');
      expect(result.status).toBe(404);
      expect(result.error).toContain('Planeación no encontrada');
    });

    it('6. Error de red (fetch fallido) es capturado de manera resiliente con status 0', async () => {
      const fallbackSpy = vi.fn();

      global.fetch = vi.fn().mockRejectedValue(new Error('Network offline'));

      const result = await exportPlanningPdfWithFallback({
        planningId,
        filename: 'test.pdf',
        onLegacyFallback: fallbackSpy,
      });

      expect(fallbackSpy).not.toHaveBeenCalled();
      expect(result.status).toBe(0);
      expect(result.error).toBe('Network offline');
    });
  });

  describe('generateSequenceWithFallback', () => {
    const planningId = '8f1c3d2e-4b5a-6c7d-8e9f-0a1b2c3d4e5f';

    it('7. HTTP 501 delega en onLegacyFallback retornando la secuencia generada localmente', async () => {
      const mockLegacySequence = {
        blockIndex: 0,
        sessions: [{ sessionNumber: 1, topic: 'Apertura local' }],
      };
      const fallbackSpy = vi.fn().mockResolvedValue(mockLegacySequence);

      global.fetch = vi.fn().mockResolvedValue({
        status: 501,
        ok: false,
        json: async () => ({ error: 'Not implemented' }),
      } as unknown as Response);

      const result = await generateSequenceWithFallback({
        planningId,
        blockIndex: 0,
        totalHours: 12,
        onLegacyFallback: fallbackSpy,
      });

      expect(global.fetch).toHaveBeenCalledWith(`/api/planeaciones/${planningId}/secuencia`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockIndex: 0, totalHours: 12 }),
      });
      expect(fallbackSpy).toHaveBeenCalledTimes(1);
      expect(result.source).toBe('legacy');
      expect(result.status).toBe(501);
      expect(result.data).toEqual(mockLegacySequence);
    });

    it('8. HTTP 200 retorna la secuencia oficial del orquestador y warnings preservados', async () => {
      const fallbackSpy = vi.fn();
      const mockOrchestratorPayload = {
        success: true,
        blockIndex: 1,
        sequence: { blockIndex: 1, sessions: [] },
        warnings: [],
      };

      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: async () => mockOrchestratorPayload,
      } as unknown as Response);

      const result = await generateSequenceWithFallback({
        planningId,
        blockIndex: 1,
        onLegacyFallback: fallbackSpy,
      });

      expect(fallbackSpy).not.toHaveBeenCalled();
      expect(result.source).toBe('orchestrator');
      expect(result.status).toBe(200);
      expect(result.data).toEqual(mockOrchestratorPayload);
      expect(result.warnings).toEqual([]);
    });

    it('9. HTTP 403 retorna error de permisos', async () => {
      const fallbackSpy = vi.fn();

      global.fetch = vi.fn().mockResolvedValue({
        status: 403,
        ok: false,
        json: async () => ({ error: 'Acceso denegado' }),
      } as unknown as Response);

      const result = await generateSequenceWithFallback({
        planningId,
        blockIndex: 0,
        onLegacyFallback: fallbackSpy,
      });

      expect(fallbackSpy).not.toHaveBeenCalled();
      expect(result.source).toBe('orchestrator');
      expect(result.status).toBe(403);
      expect(result.error).toContain('no tienes permisos');
    });

    it('10. HTTP 401 retorna error de sesión no autorizada', async () => {
      const fallbackSpy = vi.fn();

      global.fetch = vi.fn().mockResolvedValue({
        status: 401,
        ok: false,
        json: async () => ({ error: 'No autorizado' }),
      } as unknown as Response);

      const result = await generateSequenceWithFallback({
        planningId,
        blockIndex: 0,
        onLegacyFallback: fallbackSpy,
      });

      expect(fallbackSpy).not.toHaveBeenCalled();
      expect(result.source).toBe('orchestrator');
      expect(result.status).toBe(401);
      expect(result.error).toContain('Sesión no autorizada');
    });
  });
});
