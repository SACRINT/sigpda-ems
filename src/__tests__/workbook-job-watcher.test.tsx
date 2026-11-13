// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import WorkbookJobWatcher from '@/components/layout/WorkbookJobWatcher';
import {
  ACTIVE_WORKBOOK_JOBS_KEY,
  readActiveWorkbookJobs,
} from '@/lib/workbook-job-watch';

const mockPathname = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
}));

function registerJob(planningId = 'plan-1', blockIndex = 1, jobId = 'job-1') {
  window.localStorage.setItem(
    ACTIVE_WORKBOOK_JOBS_KEY,
    JSON.stringify([
      {
        planningId,
        blockIndex,
        jobId,
        registeredAt: new Date().toISOString(),
      },
    ])
  );
}

describe('WorkbookJobWatcher - chip global de generación', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockPathname.mockReturnValue('/es/dashboard');
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it('muestra el progreso del job activo y enlaza a su planeación', async () => {
    registerJob('plan-abc', 1, 'job-abc');
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        found: true,
        status: 'running',
        progress: 42,
        currentStep: 'Escribiendo misiones',
      }),
    } as Response);

    render(<WorkbookJobWatcher locale="es" />);

    expect(await screen.findByText('Bloque 2: 42%')).toBeTruthy();
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('/es/planeacion/plan-abc');
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      '/api/planeaciones/plan-abc/libro-bloque/status?jobId=job-abc',
      expect.any(Object)
    );
  });

  it('oculta el chip y limpia el job cuando la generación termina', async () => {
    registerJob();
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ found: true, status: 'completed', progress: 100 }),
    } as Response);

    const { container } = render(<WorkbookJobWatcher locale="es" />);

    await waitFor(() => {
      expect(readActiveWorkbookJobs()).toEqual([]);
    });
    expect(container.textContent).not.toContain('Bloque');
  });

  it('no sondea ni muestra chip si el job pertenece a la planeación abierta', async () => {
    registerJob('plan-open', 0, 'job-open');
    mockPathname.mockReturnValue('/es/planeacion/plan-open');

    const { container } = render(<WorkbookJobWatcher locale="es" />);

    await waitFor(() => {
      expect(vi.mocked(fetch)).not.toHaveBeenCalled();
    });
    expect(container.textContent).not.toContain('Bloque');
  });

  it('despierta al vencer nextRetryAt en lugar de esperar 50 s', async () => {
    vi.useFakeTimers();
    const now = Date.now();
    registerJob('plan-retry', 0, 'job-retry');
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        found: true,
        status: 'pending',
        progress: 30,
        nextRetryAt: new Date(now + 3_000).toISOString(),
      }),
    } as Response);

    render(<WorkbookJobWatcher locale="es" />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(3_999);
    });
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(2);
    });
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
  });

  it('muestra +N cuando hay más de un bloque generándose', async () => {
    window.localStorage.setItem(
      ACTIVE_WORKBOOK_JOBS_KEY,
      JSON.stringify([
        {
          planningId: 'plan-1',
          blockIndex: 0,
          jobId: 'job-1',
          registeredAt: new Date().toISOString(),
        },
        {
          planningId: 'plan-2',
          blockIndex: 2,
          jobId: 'job-2',
          registeredAt: new Date().toISOString(),
        },
      ])
    );
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      const progress = url.includes('job-1') ? 20 : 55;
      return {
        ok: true,
        status: 200,
        json: async () => ({ found: true, status: 'running', progress }),
      } as Response;
    });

    render(<WorkbookJobWatcher locale="es" />);

    expect(await screen.findByText('+1')).toBeTruthy();
  });
});
