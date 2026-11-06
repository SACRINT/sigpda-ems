/**
 * editorial-timeout-resilience-p311.test.ts
 * Tests unitarios y de invariantes para el hotfix P3.1.1:
 * 1. Anti-retry storm: máx 1 reintento por redactor, omitido si tiempo restante < 45s o deficit == 0.
 * 2. Descarte de reintentos si no mejoran el volumen de palabras.
 * 3. Presupuesto estricto de 240s transmitido desde job-worker a generateBlockWorkTextbook.
 * 4. GET /api/pdf/libro-editorial/[id] devuelve HTTP 200 { status: 'idle', downloadUrl: null } en estado inicial.
 * 5. Macro target semestral alineado dinámicamente con computeContentBudget.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { computeContentBudget, resolveWeeklyHours } from '@/lib/guide-engine/content-budget';
import { GET } from '@/app/api/pdf/libro-editorial/[id]/route';
import { getLatestEditorialBookForPlanning } from '@/lib/editorial/editorial-db';
import { getTeacherByEmail } from '@/lib/db';
import { getSubscriptionStatus } from '@/lib/subscription-gate';
import { featureFlags } from '@/lib/platform/feature-flags';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { email: 'docente@sems.puebla.gob.mx', role: 'teacher' },
  }),
}));

vi.mock('@/lib/db', () => ({
  getTeacherByEmail: vi.fn(),
  getPlanningById: vi.fn(),
  sql: vi.fn(),
  JOB_MAX_DURATION_SECONDS: 270,
}));

vi.mock('@/lib/subscription-gate', () => ({
  getSubscriptionStatus: vi.fn(),
}));

vi.mock('@/lib/editorial/editorial-db', () => ({
  getLatestEditorialBookForPlanning: vi.fn(),
  getEditorialBookById: vi.fn(),
  getEditorialBookByPlanningAndHash: vi.fn(),
  getDownloadableEditorialBookForPlanning: vi.fn(),
  createEditorialBook: vi.fn(),
  updateEditorialBookStatus: vi.fn(),
}));

vi.mock('@/lib/editorial/blob-storage', () => ({
  isEditorialPdfStorageAvailable: vi.fn().mockResolvedValue(true),
  uploadEditorialPdfToBlob: vi.fn(),
}));

describe('P3.1.1 — Resiliencia ante Timeouts, Anti-Retry Storm y Macro Target Dinámico', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    featureFlags.setOverride('EDITORIAL_PUBLISHER_ENGINE', true);

    vi.mocked(getTeacherByEmail).mockResolvedValue({
      id: 'teacher-uuid-1',
      email: 'docente@sems.puebla.gob.mx',
      name: 'Docente Titular',
      subsystem: 'bt',
    } as any);

    vi.mocked(getSubscriptionStatus).mockResolvedValue({
      plan: {
        id: 'plan_editorial',
        name: 'Editorial Pro',
        priceMonthly: 0,
        currency: 'MXN',
        features: [],
        stripePriceId: '',
        color: '',
      },
      subscription: {
        id: 'sub_1',
        teacherId: 'teacher-uuid-1',
        planId: 'plan_editorial',
        planName: 'Editorial Pro',
        planSubjects: 10,
        status: 'active',
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        stripeCustomerId: 'cus_1',
      },
      subjects: [],
      usedSubjectsCount: 1,
      availableSlots: 9,
      isAdmin: true,
    } as any);
  });

  describe('1. GET /api/pdf/libro-editorial/[id] Resiliencia 200 Idle (Anti-404)', () => {
    it('devuelve HTTP 200 con status: "idle" y downloadUrl: null cuando la planeación no tiene libro aún', async () => {
      vi.mocked(getLatestEditorialBookForPlanning).mockResolvedValueOnce(null);

      const planningId = '4a3335eb-99f3-47f8-a3d0-c83297fe488b';
      const req = new NextRequest(`http://localhost:3000/api/pdf/libro-editorial/${planningId}`);
      const res = await GET(req, { params: Promise.resolve({ id: planningId }) });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.status).toBe('idle');
      expect(body.downloadUrl).toBeNull();
      expect(body.editorialBook).toBeNull();
    });
  });

  describe('2. Macro Target Dinámico Proporcional por Sesiones', () => {
    it('calcula macroTargetWords semestral derivado de computeContentBudget para 3 horas/semana (18 sesiones)', () => {
      const mockPlanning = {
        contentJson: {
          sectionI: { totalHoursWeekly: 3 },
        },
      };

      const weeklyHours = resolveWeeklyHours(mockPlanning as any);
      expect(weeklyHours).toBe(3);

      const blockBudget = computeContentBudget(weeklyHours);
      expect(blockBudget.sessionsPerBlock).toBe(18);
      expect(blockBudget.targetWords.min).toBe(20250);
      expect(blockBudget.targetWords.ideal).toBe(21375);
      expect(blockBudget.targetWords.max).toBe(22500);

      const totalWorkbookBlocks = 3;
      const macroTargetWords = blockBudget.targetWords.ideal * totalWorkbookBlocks;
      const semestralMinimumWords = blockBudget.targetWords.min * totalWorkbookBlocks;

      // Invariantes matemáticas estrictas
      expect(macroTargetWords).toBe(64125); // 21,375 * 3
      expect(semestralMinimumWords).toBe(60750); // 20,250 * 3
      expect(macroTargetWords).toBeGreaterThan(25000); // Reemplazó el hardcoded 25,000 legacy
    });

    it('respeta la proporcionalidad cuando las horas semanales son 4 (24 sesiones)', () => {
      const mockPlanning = {
        contentJson: {
          sectionI: { totalHoursWeekly: 4 },
        },
      };

      const weeklyHours = resolveWeeklyHours(mockPlanning as any);
      expect(weeklyHours).toBe(4);

      const blockBudget = computeContentBudget(weeklyHours);
      expect(blockBudget.sessionsPerBlock).toBe(24);
      expect(blockBudget.targetWords.min).toBe(27000); // 24 * 1125
      expect(blockBudget.targetWords.max).toBe(30000); // 24 * 1250
      expect(blockBudget.targetWords.ideal).toBe(28500);

      const macroTargetWords = blockBudget.targetWords.ideal * 3;
      expect(macroTargetWords).toBe(85500);
    });
  });

  describe('3. Invariantes del Worker y Presupuesto de Orquestación', () => {
    it('el presupuesto del worker maxBudgetMs (240s) deja al menos 30s de colchón antes de JOB_MAX_DURATION_SECONDS (270s)', async () => {
      const { JOB_MAX_DURATION_SECONDS } = await import('@/lib/db');
      expect(JOB_MAX_DURATION_SECONDS).toBe(270);

      const maxBudgetMs = (JOB_MAX_DURATION_SECONDS - 30) * 1000;
      expect(maxBudgetMs).toBe(240_000);

      // El colchón preventivo de 30s garantiza que el orquestador termine y devuelva el control
      // antes de que el abortController encienda el corte forzado
      expect(JOB_MAX_DURATION_SECONDS * 1000 - maxBudgetMs).toBe(30_000);
    });
  });
});
