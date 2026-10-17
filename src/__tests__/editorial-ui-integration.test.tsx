import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import fs from 'node:fs';
import path from 'node:path';
import PlanningTabDocumento from '@/components/planning/PlanningTabDocumento';
import EditorialSubscriptionModal from '@/components/ui/EditorialSubscriptionModal';
import { EditorialBookClient } from '@/hooks/useEditorialBook';
import type { Planning, GeneratedPlanningContent } from '@/types/planning';

const pushMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    loading: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    dismiss: vi.fn(),
  },
}));

describe('Editorial UI Integration Suite (Fase 3 — Tarea 5)', () => {
  const dummyPlanning: Planning = {
    id: 'plan-integration-101',
    teacherId: 'teacher-42',
    uacName: 'Pensamiento Matemático I',
    semester: 1,
    component: 'fundamental',
    curriculumName: 'MCCEMS 2026',
    paecContext: 'Contexto Comunitario Integración',
    extractedData: null,
    status: 'generated',
    contentJson: {
      sectionI: {
        teacherName: 'Prof. Integración',
        uacName: 'Pensamiento Matemático I',
        semester: 1,
        groups: '101',
        schoolYear: '2026-2027',
        applicationPeriod: '2026-A',
        estimatedSessions: '64',
        component: 'fundamental',
        totalHours: 64,
        subsystem: 'DGB',
      },
      sectionII: {
        purpose: 'Propósito formativo de integración',
        learningOutcomes: ['Resultado 1'],
        paecConnection: 'Vinculación comunitaria activa',
        activities: [],
      },
      sectionIII: {
        fundamentalCurriculum: [],
        expandedCurriculum: [],
      },
      sectionIV: {
        note: 'Nota pedagógica',
        activities: [],
      },
    } as unknown as GeneratedPlanningContent,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('Invariante Arquitectónico AUD-T1: PlanningTabDocumento no importa feature-flags', () => {
    const tabSource = fs.readFileSync(
      path.join(process.cwd(), 'src/components/planeacion/tabs/PlanningTabDocumento.tsx'),
      'utf8',
    );
    expect(tabSource).not.toContain('@/lib/platform/feature-flags');
    expect(tabSource).not.toContain('featureFlags.isEnabled');
  });

  it('Escenario 1: Ciclo completo UI → POST 200 → Polls GET (pending → completed) → Entrega URL de descarga', async () => {
    const targetUrl = 'https://blob.vercel-storage.com/editorial-books/plan-integration-101-final.pdf';
    let pollCount = 0;

    const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            status: 'pending',
            id: 'book-job-1',
          }),
        });
      }

      // GET requests
      pollCount++;
      if (pollCount === 1) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            status: 'processing',
            message: 'Compilando con Typst en el worker...',
          }),
        });
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          status: 'completed',
          downloadUrl: targetUrl,
          pageCount: 38,
          spineWidthMm: 4.6,
        }),
      });
    });

    global.fetch = fetchMock;

    const onCompletedMock = vi.fn();
    const client = new EditorialBookClient({
      planningId: dummyPlanning.id,
      onCompleted: onCompletedMock,
    });

    // Iniciar compilación
    const generatePromise = client.generateBook();

    // Resolver POST
    await vi.advanceTimersByTimeAsync(10);
    expect(client.getState().status).toBe('generating');

    // Esperar primer intervalo de backoff (3000 ms)
    await vi.advanceTimersByTimeAsync(3050);

    // Esperar segundo intervalo de backoff (5000 ms)
    await vi.advanceTimersByTimeAsync(5050);

    await generatePromise;

    // Verificar estado final completado
    const state = client.getState();
    expect(state.status).toBe('completed');
    expect(state.downloadUrl).toBe(targetUrl);
    expect(state.pageCount).toBe(38);
    expect(state.spineWidthMm).toBe(4.6);
    expect(onCompletedMock).toHaveBeenCalledWith(targetUrl);

    // Verificar que el componente con editorialEngineEnabled=true renderiza la barra y botón
    const html = renderToString(
      <PlanningTabDocumento planning={dummyPlanning} editorialEngineEnabled={true} />,
    );
    expect(html).toContain('btn-exportar-editorial');
    expect(html).toContain('Exportar Libro Editorial');
    expect(html).toContain('MCCEMS · Typst 0.13');
  });

  it('Escenario 2: Caso premium — POST 403 PREMIUM_REQUIRED → Modal visible → Click "Ver planes" → router.push("/suscripcion")', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({
        error: 'El Motor Editorial de Alta Gama requiere suscripción Activa.',
        code: 'PREMIUM_REQUIRED',
      }),
    });

    const onPremiumRequiredMock = vi.fn();
    const client = new EditorialBookClient({
      planningId: dummyPlanning.id,
      onPremiumRequired: onPremiumRequiredMock,
    });

    const result = await client.generateBook();

    expect(result).toBe(false);
    expect(client.getState().status).toBe('failed');
    expect(client.getState().isPremiumRequired).toBe(true);
    expect(onPremiumRequiredMock).toHaveBeenCalledTimes(1);

    // Renderizar modal abierto
    const modalHtml = renderToString(
      <EditorialSubscriptionModal isOpen={true} onClose={vi.fn()} />,
    );

    expect(modalHtml).toContain('role="dialog"');
    expect(modalHtml).toContain('Motor Editorial Premium');
    expect(modalHtml).toContain('Ver planes');
    expect(modalHtml).toContain('Compilación de Imprenta Typst');
    expect(modalHtml).toContain('Lomo Paramétrico Automatizado');

    // Simular navegación hacia suscripción
    const router = { push: pushMock };
    router.push('/suscripcion');
    expect(pushMock).toHaveBeenCalledWith('/suscripcion');
  });

  it('Escenario 3: Caso presupuesto agotado — POST 504 TIMEOUT_BUDGET_EXCEEDED → Retry-After toast y estado de reintento', async () => {
    const headersMock = new Headers();
    headersMock.set('Retry-After', '8');

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 504,
      headers: headersMock,
      json: async () => ({
        error: 'Presupuesto de ejecución agotado en Vercel',
        code: 'TIMEOUT_BUDGET_EXCEEDED',
      }),
    });

    const onErrorMock = vi.fn();
    const client = new EditorialBookClient({
      planningId: dummyPlanning.id,
      onError: onErrorMock,
    });

    const result = await client.generateBook();

    expect(result).toBe(false);
    const state = client.getState();
    expect(state.status).toBe('error');
    expect(state.errorMessage).toContain('8 segundos');
    expect(onErrorMock).toHaveBeenCalledWith(
      expect.stringContaining('8 segundos'),
    );
  });

  it('Escenario 4: Caso error 500 COMPILE_FAILED → feedback visual y estado de falla', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({
        error: 'Fallo al invocar el worker editorial remoto',
        code: 'COMPILE_FAILED',
      }),
    });

    const onErrorMock = vi.fn();
    const client = new EditorialBookClient({
      planningId: dummyPlanning.id,
      onError: onErrorMock,
    });

    const result = await client.generateBook();

    expect(result).toBe(false);
    expect(client.getState().status).toBe('failed');
    expect(onErrorMock).toHaveBeenCalledWith('Fallo al invocar el worker editorial remoto');
  });

  it('Escenario 5: Feature flag desactivado (editorialEngineEnabled=false) → La UI editorial permanece 100% oculta', () => {
    const html = renderToString(
      <PlanningTabDocumento planning={dummyPlanning} editorialEngineEnabled={false} />,
    );

    expect(html).not.toContain('editorial-action-bar');
    expect(html).not.toContain('btn-exportar-editorial');
    expect(html).not.toContain('Exportar Libro Editorial');
  });
});
