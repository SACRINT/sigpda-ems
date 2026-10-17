import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';
import {
  EditorialBookClient,
  useEditorialBook,
  BACKOFF_INTERVALS_MS,
  MAX_POLL_ATTEMPTS,
} from '@/hooks/useEditorialBook';

describe('useEditorialBook y EditorialBookClient (Fase 3 — Tarea 4)', () => {
  const planningId = '22222222-2222-2222-2222-222222222222';
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.useRealTimers();
  });

  it('1. Debe inicializar con estado idle y valores por defecto', () => {
    const client = new EditorialBookClient({ planningId });
    const state = client.getState();

    expect(state.status).toBe('idle');
    expect(state.downloadUrl).toBeNull();
    expect(state.pageCount).toBeNull();
    expect(state.spineWidthMm).toBeNull();
    expect(state.errorMessage).toBeNull();
    expect(state.isPremiumRequired).toBe(false);
    expect(state.pollAttempts).toBe(0);
  });

  it('2. Debe procesar respuesta completed inmediata en POST (ej. libro en caché)', async () => {
    const onCompletedMock = vi.fn();
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        status: 'completed',
        downloadUrl: 'https://blob.vercel-storage.com/cached.pdf',
        pageCount: 36,
        spineWidthMm: 1.62,
      }),
    } as unknown as Response);

    const client = new EditorialBookClient({ planningId, onCompleted: onCompletedMock });
    const success = await client.generateBook();

    expect(success).toBe(true);
    const state = client.getState();
    expect(state.status).toBe('completed');
    expect(state.downloadUrl).toBe('https://blob.vercel-storage.com/cached.pdf');
    expect(state.pageCount).toBe(36);
    expect(state.spineWidthMm).toBe(1.62);
    expect(onCompletedMock).toHaveBeenCalledWith('https://blob.vercel-storage.com/cached.pdf');
  });

  it('3. Debe capturar HTTP 403 PREMIUM_REQUIRED y activar isPremiumRequired', async () => {
    const onPremiumRequiredMock = vi.fn();
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({
        error: 'Acceso restringido: Se requiere una suscripción Premium activa.',
        code: 'PREMIUM_REQUIRED',
      }),
    } as unknown as Response);

    const client = new EditorialBookClient({ planningId, onPremiumRequired: onPremiumRequiredMock });
    const success = await client.generateBook();

    expect(success).toBe(false);
    const state = client.getState();
    expect(state.status).toBe('failed');
    expect(state.isPremiumRequired).toBe(true);
    expect(state.errorMessage).toContain('Se requiere una suscripción Premium activa');
    expect(onPremiumRequiredMock).toHaveBeenCalledTimes(1);
  });

  it('4. Debe capturar HTTP 504 TIMEOUT_BUDGET_EXCEEDED y notificar reintento con Retry-After', async () => {
    const onErrorMock = vi.fn();
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 504,
      headers: new Headers({ 'Retry-After': '5' }),
      json: async () => ({
        error: 'Tiempo de ejecución insuficiente para completar la compilación editorial.',
        code: 'TIMEOUT_BUDGET_EXCEEDED',
      }),
    } as unknown as Response);

    const client = new EditorialBookClient({ planningId, onError: onErrorMock });
    const success = await client.generateBook();

    expect(success).toBe(false);
    const state = client.getState();
    expect(state.status).toBe('error');
    expect(state.errorMessage).toContain('Intenta de nuevo en 5 segundos');
    expect(onErrorMock).toHaveBeenCalled();
  });

  it('5. Criterio de aceptación: simulado completed en el 3er poll entrega downloadUrl y detiene timers', async () => {
    const onCompletedMock = vi.fn();

    // 1. POST devuelve processing
    // 2. Poll 1 devuelve processing
    // 3. Poll 2 devuelve processing
    // 4. Poll 3 devuelve completed
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, status: 'processing' }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, status: 'processing' }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, status: 'processing' }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          status: 'completed',
          downloadUrl: 'https://blob.vercel-storage.com/polled_book_final.pdf',
          pageCount: 38,
          spineWidthMm: 1.71,
        }),
      } as unknown as Response);

    const client = new EditorialBookClient({ planningId, onCompleted: onCompletedMock });
    const generatePromise = client.generateBook();

    // Resolver POST
    await vi.advanceTimersByTimeAsync(10);
    expect(client.getState().pollAttempts).toBe(1);

    // Avanzar primer intervalo (3000 ms) -> Poll 2
    await vi.advanceTimersByTimeAsync(BACKOFF_INTERVALS_MS[0]);
    expect(client.getState().pollAttempts).toBe(2);

    // Avanzar segundo intervalo (5000 ms) -> Poll 3 (completed)
    await vi.advanceTimersByTimeAsync(BACKOFF_INTERVALS_MS[1]);
    await generatePromise;

    const finalState = client.getState();
    expect(finalState.status).toBe('completed');
    expect(finalState.downloadUrl).toBe('https://blob.vercel-storage.com/polled_book_final.pdf');
    expect(finalState.pageCount).toBe(38);
    expect(finalState.spineWidthMm).toBe(1.71);
    expect(onCompletedMock).toHaveBeenCalledWith('https://blob.vercel-storage.com/polled_book_final.pdf');

    // Confirmar que ningún timer posterior sigue activo
    expect(vi.getTimerCount()).toBe(0);
  });

  it('6. Criterio de aceptación: simulado failed en worker expone error sin seguir polleando', async () => {
    const onErrorMock = vi.fn();

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, status: 'processing' }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          status: 'failed',
          editorialBook: {
            error_message: 'Fallo fatal en Typst compilation process',
          },
        }),
      } as unknown as Response);

    const client = new EditorialBookClient({ planningId, onError: onErrorMock });
    const generatePromise = client.generateBook();

    await vi.advanceTimersByTimeAsync(10);
    await generatePromise;

    const finalState = client.getState();
    expect(finalState.status).toBe('failed');
    expect(finalState.errorMessage).toContain('Fallo fatal en Typst');
    expect(onErrorMock).toHaveBeenCalledWith(expect.stringContaining('Fallo fatal en Typst'));
    expect(vi.getTimerCount()).toBe(0);
  });

  it('7. Hook useEditorialBook debe renderizar sin errores en componentes funcionales', () => {
    function DummyPlanningView() {
      const bookState = useEditorialBook({ planningId });
      return React.createElement(
        'div',
        { 'data-status': bookState.status },
        `Estado: ${bookState.status}`,
      );
    }

    const html = renderToString(React.createElement(DummyPlanningView));
    expect(html).toContain('data-status="idle"');
    expect(html).toContain('Estado: idle');
  });

  it('8. Backoff exponencial respeta topes y límites máximos', () => {
    expect(BACKOFF_INTERVALS_MS).toEqual([3000, 5000, 8000, 13000, 15000]);
    expect(MAX_POLL_ATTEMPTS).toBe(10);
  });
});
