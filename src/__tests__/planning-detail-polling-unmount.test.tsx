// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Planning } from '@/types/planning';

const assistantMocks = vi.hoisted(() => ({
  setDetallesDocumento: vi.fn(),
}));

vi.mock('@/components/assistant', () => ({
  useAssistant: () => ({
    setDetallesDocumento: assistantMocks.setDetallesDocumento,
  }),
}));

vi.mock('@/components/planeacion/tabs', () => ({
  PlanningTabDocumento: () => null,
  PlanningTabSecuencias: () => null,
  PlanningTabMateriales: () => null,
  PlanningTabCalidad: () => null,
}));

vi.mock('@/components/planeacion/ExtraPreviewModal', () => ({
  ExtraPreviewModal: () => null,
}));
vi.mock('@/components/planeacion/DeletePlanningButton', () => ({
  default: () => null,
}));
vi.mock('@/components/planeacion/PlanningDetailHero', () => ({
  default: () => null,
}));
vi.mock('@/components/planeacion/DocumentA4Modal', () => ({
  default: () => null,
}));
vi.mock('@/components/planeacion/ChecklistSupervisionModal', () => ({
  default: () => null,
}));

import PlanningDetailClient from '@/app/[locale]/planeacion/[id]/PlanningDetailClient';

const planning: Planning = {
  id: 'plan-1',
  teacherId: 'teacher-1',
  uacName: 'Pensamiento Matemático III',
  semester: 5,
  component: 'fundamental',
  curriculumName: 'MCCEMS 2026',
  paecContext: 'Contexto comunitario',
  extractedData: null,
  status: 'generated',
  contentJson: {
    sectionI: {
      teacherName: 'Prof. Demo',
      uacName: 'Pensamiento Matemático III',
      semester: 5,
      groups: '501',
      schoolYear: '2026-2027',
      applicationPeriod: '2026-A',
      estimatedSessions: '18',
      component: 'fundamental',
      totalHours: 18,
      subsystem: 'DGB',
    },
    sectionII: {
      purpose: 'Propósito',
      learningOutcomes: [],
      paecConnection: 'PAEC',
      activities: [],
    },
    sectionIII: { fundamentalCurriculum: [], expandedCurriculum: [] },
    sectionIV: { note: 'Secuencia', activities: [] },
    sectionV: { evaluations: [] },
    sectionVI: {
      studentMaterials: [],
      teacherMaterials: [],
      digital: [],
      spaces: [],
      references: [],
    },
    sectionVII: {},
  },
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as Response;
}

describe('PlanningDetailClient - cancelación de polling al desmontar', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes('/libro-bloque/status?jobId=job-1')) {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        });
      }
      if (url.includes('/libro-bloque/status?blockIndex=0')) {
        return Promise.resolve(
          jsonResponse({
            found: true,
            jobId: 'job-1',
            status: 'running',
            progress: 10,
          })
        );
      }
      if (url.includes('/libro-bloque/status?blockIndex=')) {
        return Promise.resolve(jsonResponse({ found: false }));
      }
      if (url.includes('/libro-bloque?blockIndex=')) {
        return Promise.resolve(jsonResponse({}));
      }
      if (url.includes('/extras')) {
        return Promise.resolve(jsonResponse({ extras: [] }));
      }
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('no reprograma timers si el fetch en vuelo se aborta por desmontaje', async () => {
    const { unmount } = render(
      <PlanningDetailClient
        locale="es"
        planning={planning}
        initialExtras={[]}
      />
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(2_500);
      await Promise.resolve();
    });

    const jobFetches = () =>
      fetchMock.mock.calls.filter(([url]) =>
        String(url).includes('/libro-bloque/status?jobId=job-1')
      ).length;

    expect(jobFetches()).toBe(1);

    unmount();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(60_000);
      await Promise.resolve();
    });

    expect(jobFetches()).toBe(1);
  });
});
