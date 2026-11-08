/**
 * progress-monotonicity.test.ts — La barra de progreso nunca retrocede (Fase 1 del plan de tiempos).
 * Verifica el SQL emitido (los tests de BD del proyecto usan mocks de Neon).
 */
import { vi, describe, it, expect, beforeEach, beforeAll } from 'vitest';

const mockQueryFn = vi.fn().mockResolvedValue([{ id: 'x' }]);

vi.mock('@neondatabase/serverless', () => ({
  neon: vi.fn(() => mockQueryFn),
}));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { updateGenerationJobProgress, requeueGenerationJob, updateWorkbookProgress } from '@/lib/db';
import type { GenerationProgressState } from '@/types/work-textbook';

const sqlText = (call: unknown[]): string => (call[0] as string[]).join('?');

const state = (percent: number, phase: GenerationProgressState['phase'] = 'writing'): GenerationProgressState => ({
  planningId: 'p1',
  blockIndex: 2,
  phase,
  currentStep: 's',
  percent,
  updatedAt: new Date().toISOString(),
});

describe('Progreso monótono', () => {
  beforeAll(() => {
    vi.stubEnv('DATABASE_URL', 'postgresql://test:test@localhost:5432/sigpda_test');
  });
  beforeEach(() => {
    mockQueryFn.mockReset();
    mockQueryFn.mockResolvedValue([{ id: 'x' }]);
  });

  it('updateGenerationJobProgress usa GREATEST (nunca baja el progress)', async () => {
    await updateGenerationJobProgress('11111111-1111-1111-1111-111111111111', { progress: 40 });
    const text = sqlText(mockQueryFn.mock.calls[0]);
    expect(text).toMatch(/GREATEST\(COALESCE\(progress, 0\)/);
    expect(text).not.toMatch(/progress = COALESCE\(/);
  });

  it('requeueGenerationJob conserva el máximo alcanzado (no fuerza 45)', async () => {
    await requeueGenerationJob('11111111-1111-1111-1111-111111111111', { writerOutputs: [] });
    const call = mockQueryFn.mock.calls[0];
    expect(sqlText(call)).toMatch(/progress = GREATEST\(COALESCE\(progress, 0\)/);
    // el piso por defecto es 0, nunca 45
    expect(call.slice(1)).not.toContain(45);
  });

  it('updateWorkbookProgress aplica GREATEST solo dentro del mismo jobId', async () => {
    await updateWorkbookProgress('p1', 2, state(70), 'job-A');
    const text = sqlText(mockQueryFn.mock.calls[0]);
    expect(text).toMatch(/GREATEST\(/);
    expect(text).toMatch(/->> 'jobId'/);
    // el jobId viaja como parámetro y dentro del JSON de estado
    const params = mockQueryFn.mock.calls[0].slice(1);
    expect(params).toContain('job-A');
    expect(params.some((p) => typeof p === 'string' && p.includes('"jobId":"job-A"'))).toBe(true);
  });

  it('un estado fallido o sin jobId NO es monótono (permite reiniciar)', async () => {
    await updateWorkbookProgress('p1', 2, state(10, 'failed'), 'job-A');
    await updateWorkbookProgress('p1', 2, state(10));
    for (const call of mockQueryFn.mock.calls) {
      // parámetro boolean `monotonic` debe ser false
      expect(call.slice(1)).toContain(false);
    }
  });
});

