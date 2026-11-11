// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('@/components/planeacion/tabs/PlanningTabAuditoria', () => ({
  default: () => <div data-testid="audit-view">Auditoría</div>,
}));

vi.mock('@/components/planeacion/tabs/PlanningTabEvaluador', () => ({
  default: () => <div data-testid="evaluador-view">Evaluador</div>,
}));

vi.mock('@/components/planeacion/tabs/PlanningTabAnalitica', () => ({
  default: () => <div data-testid="analytics-view">Analytics</div>,
}));

import PlanningTabCalidad, {
  type QualitySubTab,
} from '@/components/planeacion/tabs/PlanningTabCalidad';
import type { Planning } from '@/types/planning';

const mockPlanning = {
  id: 'planning-calidad-1',
  uacName: 'UAC de prueba',
  semester: 5,
  component: 'laboral',
  contentJson: null,
  evaluationJson: null,
} as unknown as Planning;

function CalidadHarness({ initial }: { initial: QualitySubTab }) {
  const [subTab, setSubTab] = React.useState<QualitySubTab>(initial);
  return (
    <PlanningTabCalidad
      planning={mockPlanning}
      activeSubTab={subTab}
      onSubTabChange={setSubTab}
    />
  );
}

function okJson(payload: unknown): Response {
  return {
    ok: true,
    json: async () => payload,
  } as unknown as Response;
}

describe('PlanningTabCalidad — subtabs y lazy-load', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('carga la auditoría una sola vez y cambia entre subtabs sin refetch', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url === '/api/audit/planning-calidad-1') {
        return okJson({ audit: { overallScore: 90 } });
      }
      throw new Error(`Fetch inesperado: ${url}`);
    });

    render(<CalidadHarness initial="audit" />);

    expect(screen.getByTestId('audit-view')).toBeTruthy();
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/audit/planning-calidad-1');
    });

    fireEvent.click(screen.getByRole('button', { name: /Evaluador IA/i }));
    expect(screen.getByTestId('evaluador-view')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Auditoría MCCEMS/i }));
    expect(screen.getByTestId('audit-view')).toBeTruthy();

    const auditCalls = fetchMock.mock.calls.filter(
      ([url]) => url === '/api/audit/planning-calidad-1'
    );
    expect(auditCalls).toHaveLength(1);
  });

  it('carga analytics solo al entrar por primera vez al subtab', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url === '/api/pedagogical-analytics') {
        return okJson({ totalPlannings: 3 });
      }
      throw new Error(`Fetch inesperado: ${url}`);
    });

    render(<CalidadHarness initial="evaluador" />);

    expect(screen.getByTestId('evaluador-view')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Analytics y Métricas/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/pedagogical-analytics');
    });
    expect(screen.getByTestId('analytics-view')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Evaluador IA/i }));
    fireEvent.click(screen.getByRole('button', { name: /Analytics y Métricas/i }));

    const analyticsCalls = fetchMock.mock.calls.filter(
      ([url]) => url === '/api/pedagogical-analytics'
    );
    expect(analyticsCalls).toHaveLength(1);
  });

  it('no carga datos mientras el eje está oculto y carga al activarse', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url === '/api/audit/planning-calidad-1') {
        return okJson({ audit: { overallScore: 90 } });
      }
      throw new Error(`Fetch inesperado: ${url}`);
    });

    const { rerender } = render(
      <PlanningTabCalidad planning={mockPlanning} isActive={false} />
    );

    expect(fetchMock).not.toHaveBeenCalled();

    rerender(<PlanningTabCalidad planning={mockPlanning} isActive />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/audit/planning-calidad-1');
    });
  });

  it('funciona sin onSubTabChange (modo no controlado)', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url === '/api/audit/planning-calidad-1') {
        return okJson({ audit: { overallScore: 90 } });
      }
      throw new Error(`Fetch inesperado: ${url}`);
    });

    render(<PlanningTabCalidad planning={mockPlanning} />);

    expect(screen.getByTestId('audit-view')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Evaluador IA/i }));
    expect(screen.getByTestId('evaluador-view')).toBeTruthy();
  });
});
