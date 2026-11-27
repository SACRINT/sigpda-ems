/**
 * usage-quota-guard.test.ts — Pruebas Unitarias e Integración de PR 4.2 + PR 4.2.1
 * (Cuotas Atómicas en Neon, Periodo Stripe TZ America/Mexico_City, Idempotencia,
 *  Locks TTL, Resiliencia BD caída 503 + Retry-After, Concurrencia y Rotación Parte D de 09)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  PLAN_QUOTA_POLICIES,
  resolvePlanTier,
  resolveQuotaWindows,
  enforceUsageQuota,
  refundUsageQuota,
  acquireEditorialConcurrencyLock,
  releaseEditorialConcurrencyLock,
  releaseEditorialLockOnAbort,
  type QuotaGuardDeps,
} from '@/lib/platform/usage-quota-guard';
import type { SubscriptionStatus } from '@/lib/subscription-gate';
import { resolveSacrintInfographicEditorialScene } from '@/lib/visual-engine/scene-allocator';
import { createNodeSceneFileExists } from '@/lib/visual-engine/scene-allocator-node';

function makeSub(overrides: Partial<SubscriptionStatus> = {}): SubscriptionStatus {
  return {
    hasActiveSubscription: true,
    subscription: {
      id: 'sub_test_001',
      planName: 'Básico',
      planSubjects: 1,
      status: 'active',
      currentPeriodEnd: '2026-12-15T23:59:59.000Z',
      cancelAtPeriodEnd: false,
      stripeCustomerId: 'cus_123',
    },
    subjects: [],
    usedSubjectsCount: 1,
    availableSlots: 0,
    isAdmin: false,
    ...overrides,
  };
}

function makeInMemoryDeps(subStatus: SubscriptionStatus) {
  const counters = new Map<string, number>();
  const idemKeys = new Set<string>();
  const activeLocks = new Map<string, { scope: string; resourceId: string }>();
  const telemetry: Array<{ engine: string; cached?: boolean; scope: string }> = [];
  let lockSeq = 0;

  const deps: QuotaGuardDeps = {
    getSubscriptionStatus: vi.fn(async () => subStatus),
    consumeUsageQuotaAtomicDb: vi.fn(
      async ({
        teacherId,
        metric,
        primaryWindowKey,
        primaryLimit,
        hourlyMetric,
        hourWindowKey,
        hourlyLimit,
        idempotencyKey,
      }) => {
        const pKey = `${teacherId}|${metric}|${primaryWindowKey}`;
        const hKey = `${teacherId}|${hourlyMetric}|${hourWindowKey}`;
        const primaryBefore = counters.get(pKey) ?? 0;
        const hourlyBefore = counters.get(hKey) ?? 0;

        if (idempotencyKey && idemKeys.has(idempotencyKey)) {
          return {
            allowed: true,
            alreadyCounted: true,
            primaryUsed: primaryBefore,
            hourlyUsed: hourlyBefore,
          };
        }

        if (primaryBefore >= primaryLimit) {
          return {
            allowed: false,
            alreadyCounted: false,
            deniedBy: 'primary_limit' as const,
            primaryUsed: primaryBefore,
            hourlyUsed: hourlyBefore,
          };
        }

        if (hourlyBefore >= hourlyLimit) {
          return {
            allowed: false,
            alreadyCounted: false,
            deniedBy: 'hourly_limit' as const,
            primaryUsed: primaryBefore,
            hourlyUsed: hourlyBefore,
          };
        }

        if (idempotencyKey) idemKeys.add(idempotencyKey);
        const primaryNext = primaryBefore + 1;
        const hourlyNext = hourlyBefore + 1;
        counters.set(pKey, primaryNext);
        counters.set(hKey, hourlyNext);
        return {
          allowed: true,
          alreadyCounted: false,
          primaryUsed: primaryNext,
          hourlyUsed: hourlyNext,
        };
      },
    ),
    tryAcquireRenderLockDb: vi.fn(async ({ scope, resourceId, maxConcurrency }) => {
      if (activeLocks.size >= maxConcurrency) {
        return { acquired: false, activeCount: activeLocks.size };
      }
      const lockId = `lock-${++lockSeq}`;
      activeLocks.set(lockId, { scope, resourceId });
      return { acquired: true, lockId, activeCount: activeLocks.size };
    }),
    releaseRenderLockDb: vi.fn(async (lockId) => {
      activeLocks.delete(lockId);
    }),
    refundUsageQuotaAtomicDb: vi.fn(
      async ({ teacherId, metric, primaryWindowKey, hourlyMetric, hourWindowKey, idempotencyKey }) => {
        const pKey = `${teacherId}|${metric}|${primaryWindowKey}`;
        const curP = counters.get(pKey) ?? 0;
        if (curP > 0) counters.set(pKey, curP - 1);
        if (hourlyMetric && hourWindowKey) {
          const hKey = `${teacherId}|${hourlyMetric}|${hourWindowKey}`;
          const curH = counters.get(hKey) ?? 0;
          if (curH > 0) counters.set(hKey, curH - 1);
        }
        if (idempotencyKey) idemKeys.delete(idempotencyKey);
        return curP > 0;
      },
    ),
    recordEditorialEngineTelemetry: vi.fn(async (entry) => {
      telemetry.push({ engine: entry.engine, cached: entry.cached, scope: entry.scope });
    }),
  };

  return { deps, counters, idemKeys, activeLocks, telemetry };
}

describe('PR 4.2 + PR 4.2.1 — Guardián Atómico de Cuotas, Resiliencia BD, Concurrencia y Parte D', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resuelve correctamente todos los planes reales de Stripe y bienvenida/admin', () => {
    expect(resolvePlanTier(makeSub({ isAdmin: true }))).toBe('administrador');
    expect(resolvePlanTier(makeSub({ hasActiveSubscription: false, subscription: null }))).toBe('bienvenida');
    expect(resolvePlanTier(makeSub({ subscription: { ...makeSub().subscription!, planName: 'bienvenida' } }))).toBe('bienvenida');
    expect(resolvePlanTier(makeSub({ subscription: { ...makeSub().subscription!, planName: 'Básico', planSubjects: 1 } }))).toBe('basico');
    expect(resolvePlanTier(makeSub({ subscription: { ...makeSub().subscription!, planName: 'Estándar', planSubjects: 3 } }))).toBe('estandar');
    expect(resolvePlanTier(makeSub({ subscription: { ...makeSub().subscription!, planName: 'Avanzado', planSubjects: 5 } }))).toBe('avanzado');
    expect(resolvePlanTier(makeSub({ subscription: { ...makeSub().subscription!, planName: 'Completo', planSubjects: 10 } }))).toBe('completo');
    expect(resolvePlanTier(makeSub({ subscription: { ...makeSub().subscription!, planName: 'director_pro', planSubjects: 25 } }))).toBe('institucional');
  });

  it('ancla la ventana mensual al periodo de Stripe (no mes calendario) y usa TZ America/Mexico_City', () => {
    const utcCrossMidnight = new Date('2026-12-01T02:30:00.000Z');
    const sub = makeSub({
      subscription: {
        ...makeSub().subscription!,
        id: 'sub_abc_99',
        currentPeriodEnd: '2026-12-16T05:00:00.000Z',
      },
    });
    const w = resolveQuotaWindows(sub, utcCrossMidnight);
    expect(w.timezone).toBe('America/Mexico_City');
    expect(w.periodWindowKey).toBe('stripe:sub_abc_99:2026-12-15');
    expect(w.dayWindowKey).toBe('mx-day:2026-11-30');
    expect(w.hourWindowKey).toBe('mx-hour:2026-11-30T20');
  });

  it('bloquea ZIP masivo en plan Bienvenida (403 PLAN_UPGRADE_REQUIRED) y aplica tope diario en Básico (2/día → 429)', async () => {
    const welcomeSub = makeSub({
      subscription: { ...makeSub().subscription!, planName: 'bienvenida', planSubjects: 1 },
    });
    const { deps: wDeps } = makeInMemoryDeps(welcomeSub);
    const wRes = await enforceUsageQuota({ teacherId: 't-1', metric: 'bulk_zip_daily' }, wDeps);
    expect(wRes.allowed).toBe(false);
    expect(wRes.statusCode).toBe(403);
    expect(wRes.code).toBe('PLAN_UPGRADE_REQUIRED');

    const basicSub = makeSub(); // Básico: 2 ZIP / día
    const { deps: bDeps } = makeInMemoryDeps(basicSub);
    const r1 = await enforceUsageQuota({ teacherId: 't-2', metric: 'bulk_zip_daily' }, bDeps);
    const r2 = await enforceUsageQuota({ teacherId: 't-2', metric: 'bulk_zip_daily' }, bDeps);
    const r3 = await enforceUsageQuota({ teacherId: 't-2', metric: 'bulk_zip_daily' }, bDeps);
    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r3.allowed).toBe(false);
    expect(r3.statusCode).toBe(429);
    expect(r3.code).toBe('QUOTA_EXCEEDED');
  });

  it('respeta idempotencyKey en transacción atómica sin contar doble ni dejar llaves huérfanas al rechazar', async () => {
    const basicSub = makeSub(); // Básico: 4 ai_workbook_block / periodo
    const { deps, idemKeys } = makeInMemoryDeps(basicSub);

    for (let i = 1; i <= 4; i++) {
      const ok = await enforceUsageQuota(
        { teacherId: 't-3', metric: 'ai_workbook_block', idempotencyKey: `job-${i}` },
        deps,
      );
      expect(ok.allowed).toBe(true);
      expect(ok.used).toBe(i);
    }

    const retry = await enforceUsageQuota(
      { teacherId: 't-3', metric: 'ai_workbook_block', idempotencyKey: 'job-4' },
      deps,
    );
    expect(retry.allowed).toBe(true);
    expect(retry.alreadyCounted).toBe(true);
    expect(retry.used).toBe(4);

    const fifth = await enforceUsageQuota(
      { teacherId: 't-3', metric: 'ai_workbook_block', idempotencyKey: 'job-5' },
      deps,
    );
    expect(fifth.allowed).toBe(false);
    expect(fifth.statusCode).toBe(403);
    expect(fifth.code).toBe('QUOTA_EXCEEDED');
    // La llave rechazada JAMÁS debe haberse registrado como consumida
    expect(idemKeys.has('q:t-3:ai_workbook_block:job-5')).toBe(false);
  });

  it('aplica rate limit por hora (429 RATE_LIMIT_EXCEEDED) y permite paso libre a administrador', async () => {
    const basicSub = makeSub(); // Básico: exportPerHour = 8, pdfCompilesPerPeriod = 15
    const { deps } = makeInMemoryDeps(basicSub);
    const fixedNow = new Date('2026-11-27T18:00:00.000Z');

    for (let i = 1; i <= PLAN_QUOTA_POLICIES.basico.exportPerHour; i++) {
      const res = await enforceUsageQuota(
        { teacherId: 't-4', metric: 'pdf_compile', idempotencyKey: `pdf-${i}`, now: fixedNow },
        deps,
      );
      expect(res.allowed).toBe(true);
    }

    const overHour = await enforceUsageQuota(
      { teacherId: 't-4', metric: 'pdf_compile', idempotencyKey: 'pdf-9', now: fixedNow },
      deps,
    );
    expect(overHour.allowed).toBe(false);
    expect(overHour.statusCode).toBe(429);
    expect(overHour.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(overHour.retryAfterSeconds).toBeGreaterThan(0);

    const { deps: adminDeps } = makeInMemoryDeps(makeSub({ isAdmin: true }));
    const adminRes = await enforceUsageQuota({ teacherId: 'admin-1', metric: 'bulk_zip_daily' }, adminDeps);
    expect(adminRes.allowed).toBe(true);
    expect(adminRes.tier).toBe('administrador');
  });

  it('PR 4.2.1: dos peticiones simultáneas al borde del límite jamás exceden el tope atómico', async () => {
    const basicSub = makeSub(); // Básico: 2 ZIP / día
    const { deps } = makeInMemoryDeps(basicSub);

    await enforceUsageQuota({ teacherId: 't-race', metric: 'bulk_zip_daily' }, deps); // 1/2 usado
    const [rA, rB] = await Promise.all([
      enforceUsageQuota({ teacherId: 't-race', metric: 'bulk_zip_daily' }, deps),
      enforceUsageQuota({ teacherId: 't-race', metric: 'bulk_zip_daily' }, deps),
    ]);

    const allowedCount = [rA, rB].filter((r) => r.allowed).length;
    const deniedCount = [rA, rB].filter((r) => !r.allowed && r.code === 'QUOTA_EXCEEDED').length;
    expect(allowedCount).toBe(1);
    expect(deniedCount).toBe(1);
  });

  it('PR 4.2.1: ante caída de BD (subscription-gate o Neon) devuelve 503 QUOTA_SERVICE_UNAVAILABLE + Retry-After sin lanzar 500', async () => {
    const { deps: subDownDeps } = makeInMemoryDeps(makeSub());
    subDownDeps.getSubscriptionStatus = vi.fn().mockRejectedValue(new Error('Neon connection refused'));

    const qRes = await enforceUsageQuota({ teacherId: 't-down', metric: 'ai_planning' }, subDownDeps);
    expect(qRes.allowed).toBe(false);
    expect(qRes.statusCode).toBe(503);
    expect(qRes.code).toBe('QUOTA_SERVICE_UNAVAILABLE');
    expect(qRes.retryAfterSeconds).toBe(30);

    const lRes = await acquireEditorialConcurrencyLock(
      { teacherId: 't-down', scope: 'bulk_zip', resourceId: 'plan-1' },
      subDownDeps,
    );
    expect(lRes.acquired).toBe(false);
    expect(lRes.statusCode).toBe(503);
    expect(lRes.code).toBe('QUOTA_SERVICE_UNAVAILABLE');
    expect(lRes.retryAfterSeconds).toBe(30);

    // También cuando falla la consulta atómica de contadores
    const { deps: counterDownDeps } = makeInMemoryDeps(makeSub());
    counterDownDeps.consumeUsageQuotaAtomicDb = vi.fn().mockRejectedValue(new Error('SQL timeout 57014'));
    const qRes2 = await enforceUsageQuota({ teacherId: 't-down-2', metric: 'pdf_compile' }, counterDownDeps);
    expect(qRes2.allowed).toBe(false);
    expect(qRes2.statusCode).toBe(503);
    expect(qRes2.code).toBe('QUOTA_SERVICE_UNAVAILABLE');
    expect(qRes2.retryAfterSeconds).toBe(30);
  });

  it('controla concurrencia con editorial_render_locks (409), libera limpio en aborto y registra telemetría al completar', async () => {
    const basicSub = makeSub(); // Básico: maxConcurrency = 1
    const { deps, telemetry, activeLocks } = makeInMemoryDeps(basicSub);

    const l1 = await acquireEditorialConcurrencyLock(
      { teacherId: 't-5', scope: 'pdf_compile', resourceId: 'plan-1:semestral' },
      deps,
    );
    expect(l1.acquired).toBe(true);
    expect(l1.lockId).toBeTruthy();

    const l2 = await acquireEditorialConcurrencyLock(
      { teacherId: 't-5', scope: 'bulk_zip', resourceId: 'plan-1' },
      deps,
    );
    expect(l2.acquired).toBe(false);
    expect(l2.statusCode).toBe(409);
    expect(l2.code).toBe('CONCURRENCY_LIMIT');

    // Aborto por cuota libera el lock SIN registrar telemetría falsa de render
    await releaseEditorialLockOnAbort(l1.lockId, deps);
    expect(activeLocks.size).toBe(0);
    expect(telemetry.length).toBe(0);

    const l3 = await acquireEditorialConcurrencyLock(
      { teacherId: 't-5', scope: 'bulk_zip', resourceId: 'plan-1' },
      deps,
    );
    expect(l3.acquired).toBe(true);

    await releaseEditorialConcurrencyLock(
      {
        lockId: l3.lockId,
        teacherId: 't-5',
        planningId: 'plan-1',
        scope: 'v2-semestral',
        engine: 'typst',
        cached: false,
        durationMs: 1240,
      },
      deps,
    );
    expect(telemetry).toEqual([{ engine: 'typst', cached: false, scope: 'v2-semestral' }]);
  });

  it('PR 4.2.2: reembolsa atómicamente la cuota y libera idempotencyKey si Render falla tras descontar', async () => {
    const basicSub = makeSub(); // Básico: 15 pdf_compile / periodo, 8/h
    const { deps, counters, idemKeys } = makeInMemoryDeps(basicSub);

    const consumed = await enforceUsageQuota(
      { teacherId: 't-refund', metric: 'pdf_compile', idempotencyKey: 'hash-render-fail' },
      deps,
    );
    expect(consumed.allowed).toBe(true);
    expect(consumed.used).toBe(1);
    expect(idemKeys.size).toBe(1);

    const refunded = await refundUsageQuota({ teacherId: 't-refund', quota: consumed }, deps);
    expect(refunded).toBe(true);
    expect(counters.get(`t-refund|pdf_compile|${consumed.windowKey}`)).toBe(0);
    expect(counters.get(`t-refund|${consumed.hourlyMetric}|${consumed.hourWindowKey}`)).toBe(0);
    expect(idemKeys.size).toBe(0);

    // Un nuevo intento vuelve a quedar en used=1 (el docente no perdió su crédito)
    const retried = await enforceUsageQuota(
      { teacherId: 't-refund', metric: 'pdf_compile', idempotencyKey: 'hash-render-fail' },
      deps,
    );
    expect(retried.allowed).toBe(true);
    expect(retried.used).toBe(1);
    expect(retried.alreadyCounted).toBe(false);
  });

  it('Parte D (09 Infografías): rota entre las 3 escenas verticales 4:5 reales en disco (102 escenas activas)', () => {
    const fileExists = createNodeSceneFileExists();
    const s1 = resolveSacrintInfographicEditorialScene('Cultura Digital I', 1, { missionIndex: 0, fileExists });
    const s2 = resolveSacrintInfographicEditorialScene('Cultura Digital I', 1, { missionIndex: 1, fileExists });
    const s3 = resolveSacrintInfographicEditorialScene('Cultura Digital I', 1, { missionIndex: 2, fileExists });

    expect(s1?.relativePath).toBe('/images/escenas/cultura_digital_programacion_ti/tic-03-practica.webp');
    expect(s2?.relativePath).toBe('/images/escenas/cultura_digital_programacion_ti/tic-05-infografia-b.webp');
    expect(s3?.relativePath).toBe('/images/escenas/cultura_digital_programacion_ti/tic-06-infografia-c.webp');
    expect(new Set([s1?.relativePath, s2?.relativePath, s3?.relativePath]).size).toBe(3);
  });
});
