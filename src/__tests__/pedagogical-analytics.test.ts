/**
 * pedagogical-analytics.test.ts
 * Tests unitarios para el motor de Analytics Pedagógico (Fase 23)
 * Cobertura de getTeacherProgressSummary y agregaciones de datos.
 */

import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest';

const mockQueryFn = vi.fn().mockResolvedValue([]);

vi.mock('@neondatabase/serverless', () => ({
  neon: vi.fn(() => mockQueryFn),
}));

import { getTeacherProgressSummary } from '@/lib/pedagogical-analytics';

describe('pedagogical-analytics.ts — Métricas y Agregaciones del Dashboard Docente', () => {
  beforeAll(() => {
    vi.stubEnv('DATABASE_URL', 'postgresql://test:test@localhost:5432/sigpda_test');
  });

  beforeEach(() => {
    mockQueryFn.mockReset();
    mockQueryFn.mockResolvedValue([]);
  });

  it('1. Genera el resumen completo agregando feedback, estadísticas de planeaciones y conteos de proyectos', async () => {
    // 1. Feedback rows
    const mockFeedback = [
      {
        entity_type: 'planning',
        avg_rating: 4.85,
        total_count: 12,
        recent_comment: 'Excelente secuencia didáctica situada',
      },
      {
        entity_type: 'workbook',
        avg_rating: 4.90,
        total_count: 4,
        recent_comment: 'Gran formato para el trabajo en el taller',
      },
    ];

    // 2. Planning rows
    const mockPlannings = [
      { id: 'plan-1', uac_name: 'Pensamiento Matemático II', semester: 2, component: 'Fundamental', created_at: '2026-03-01' },
      { id: 'plan-2', uac_name: 'Lengua y Comunicación II', semester: 2, component: 'Fundamental', created_at: '2026-03-02' },
      { id: 'plan-3', uac_name: 'Cultura Digital II', semester: 2, component: 'Laboral', created_at: '2026-03-03' },
      { id: 'plan-4', uac_name: 'Pensamiento Matemático IV', semester: 4, component: 'Fundamental', created_at: '2026-03-04' },
    ];

    // 3. Project counts
    const mockPaecCount = [{ cnt: 3 }];
    const mockPmcCount = [{ cnt: 1 }];
    const mockPipsCount = [{ cnt: 2 }];
    const mockLibCount = [{ cnt: 7 }];

    mockQueryFn
      .mockResolvedValueOnce(mockFeedback)
      .mockResolvedValueOnce(mockPlannings)
      .mockResolvedValueOnce(mockPaecCount)
      .mockResolvedValueOnce(mockPmcCount)
      .mockResolvedValueOnce(mockPipsCount)
      .mockResolvedValueOnce(mockLibCount);

    const summary = await getTeacherProgressSummary('teach-uuid-001', 'docente@puebla.gob.mx');

    expect(summary).toBeDefined();
    // Feedback
    expect(summary.feedback).toHaveLength(2);
    expect(summary.feedback[0].avg_rating).toBe(4.85);
    expect(summary.feedback[1].total_count).toBe(4);

    // Plannings
    expect(summary.plannings.total_plannings).toBe(4);
    expect(summary.plannings.by_semester[2]).toBe(3);
    expect(summary.plannings.by_semester[4]).toBe(1);
    expect(summary.plannings.by_component['Fundamental']).toBe(3);
    expect(summary.plannings.by_component['Laboral']).toBe(1);
    expect(summary.plannings.recent).toHaveLength(4);
    expect(summary.plannings.recent[0].uac_name).toBe('Pensamiento Matemático II');

    // Counts
    expect(summary.paec_count).toBe(3);
    expect(summary.pmc_count).toBe(1);
    expect(summary.pips_count).toBe(2);
    expect(summary.library_docs_count).toBe(7);
  });

  it('2. Maneja un docente sin registros retornando ceros y arreglos vacíos de forma segura', async () => {
    mockQueryFn
      .mockResolvedValueOnce([]) // feedback
      .mockResolvedValueOnce([]) // plannings
      .mockResolvedValueOnce([]) // paec
      .mockResolvedValueOnce([]) // pmc
      .mockResolvedValueOnce([]) // pips
      .mockResolvedValueOnce([]); // library

    const summary = await getTeacherProgressSummary('teach-uuid-new', 'nuevo@puebla.gob.mx');

    expect(summary.feedback).toEqual([]);
    expect(summary.plannings.total_plannings).toBe(0);
    expect(summary.plannings.by_semester).toEqual({});
    expect(summary.plannings.by_component).toEqual({});
    expect(summary.plannings.recent).toEqual([]);
    expect(summary.paec_count).toBe(0);
    expect(summary.pmc_count).toBe(0);
    expect(summary.pips_count).toBe(0);
    expect(summary.library_docs_count).toBe(0);
  });
});
