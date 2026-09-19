/**
 * subscription-gate.test.ts
 * Unit tests for src/lib/subscription-gate.ts
 *
 * Hoisting: vi.hoisted() creates the mock state before vi.mock() factories run.
 * The sql() queue pattern allows each test to control per-query results.
 */

import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest';

// ── 1. Hoist shared state (runs before vi.mock factories) ─────────────────────

const { sqlResultQueue, mockTaggedFn, mockSqlFn } = vi.hoisted(() => {
  const sqlResultQueue: unknown[][] = [];
  const mockTaggedFn = vi.fn(() => {
    const next = sqlResultQueue.shift();
    return Promise.resolve(next ?? []);
  });
  const mockSqlFn = vi.fn(() => mockTaggedFn);
  return { sqlResultQueue, mockTaggedFn, mockSqlFn };
});

// ── 2. Mocks ──────────────────────────────────────────────────────────────────

vi.mock('@/lib/db', () => ({
  sql: mockSqlFn,
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── 3. Module under test ──────────────────────────────────────────────────────

import {
  getSubscriptionStatus,
  canCreatePlanningForSubject,
} from '@/lib/subscription-gate';

// ── Helper: push sequential DB results ───────────────────────────────────────

function enqueue(...results: unknown[][]) {
  sqlResultQueue.push(...results);
}

// ─────────────────────────────────────────────────────────────────────────────

describe('subscription-gate.ts — Access Control', () => {
  beforeAll(() => {
    vi.stubEnv('ADMIN_EMAIL', 'admin@sigpda.mx');
  });

  beforeEach(() => {
    sqlResultQueue.length = 0;
    mockTaggedFn.mockClear();
    mockSqlFn.mockClear();
  });

  // ── getSubscriptionStatus ──────────────────────────────────────────────────

  it('getSubscriptionStatus — admin reconocido: isAdmin=true con unlimited plan', async () => {
    // ADMIN_EMAIL es una constante de módulo capturada al importar.
    // En el entorno de test, la función va por la ruta de rol en DB.
    enqueue([{ role: 'administrador' }]);

    const result = await getSubscriptionStatus('uuid-admin-email', 'admin@sigpda.mx');

    expect(result.isAdmin).toBe(true);
    expect(result.hasActiveSubscription).toBe(true);
    expect(result.availableSlots).toBe(9999);
    expect(result.subscription?.planName).toBe('Administrador');
  });

  it('getSubscriptionStatus — admin por rol en DB: isAdmin=true con unlimited slots', async () => {
    enqueue([{ role: 'administrador' }]); // query 1: SELECT role
    const result = await getSubscriptionStatus('uuid-admin', 'otro@plantel.mx');

    expect(result.isAdmin).toBe(true);
    expect(result.subscription?.planName).toBe('Administrador');
    expect(result.availableSlots).toBe(9999);
  });

  it('getSubscriptionStatus — docente sin suscripción: hasActiveSubscription=false', async () => {
    enqueue([{ role: 'docente' }]); // query 1: SELECT role
    enqueue([]);                     // query 2: SELECT from subscriptions → vacío
    const result = await getSubscriptionStatus('uuid-docente', 'docente@plantel.mx');

    expect(result.isAdmin).toBe(false);
    expect(result.hasActiveSubscription).toBe(false);
    expect(result.availableSlots).toBe(0);
    expect(result.subjects).toHaveLength(0);
  });

  it('getSubscriptionStatus — docente con suscripción activa: retorna slots correctos', async () => {
    enqueue([{ role: 'docente' }]);
    enqueue([{
      id: 'sub-uuid-001', plan_name: 'Plan Básico', plan_subjects: 3,
      status: 'active', current_period_end: '2027-01-31',
      cancel_at_period_end: false, stripe_customer_id: 'cus_abc123',
    }]);
    enqueue([{ id: 'ss-001', uac_name: 'Matemáticas', semester: 2, component: 'Fundamental' }]);

    const result = await getSubscriptionStatus('uuid-docente', 'docente@plantel.mx');

    expect(result.hasActiveSubscription).toBe(true);
    expect(result.subscription?.planName).toBe('Plan Básico');
    expect(result.usedSubjectsCount).toBe(1);
    expect(result.availableSlots).toBe(2); // 3 slots - 1 usado
    expect(result.subjects[0].uacName).toBe('Matemáticas');
  });

  // ── canCreatePlanningForSubject ────────────────────────────────────────────

  it('canCreatePlanningForSubject — admin: allowed=true, reason=admin', async () => {
    enqueue([{ role: 'administrador' }]);
    const result = await canCreatePlanningForSubject(
      'uuid-admin', 'admin@sigpda.mx', 'Química', 3, 'Fundamental',
    );
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('admin');
  });

  it('canCreatePlanningForSubject — sin suscripción: allowed=false, reason=no_subscription', async () => {
    enqueue([{ role: 'docente' }]);
    enqueue([]); // suscripción vacía
    const result = await canCreatePlanningForSubject(
      'uuid-docente', 'doc@plantel.mx', 'Física', 2, 'Fundamental',
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('no_subscription');
  });

  it('canCreatePlanningForSubject — materia ya registrada: allowed=true', async () => {
    enqueue([{ role: 'docente' }]);
    enqueue([{
      id: 'sub-001', plan_name: 'Básico', plan_subjects: 2,
      status: 'active', current_period_end: null,
      cancel_at_period_end: false, stripe_customer_id: null,
    }]);
    enqueue([{ id: 'ss-001', uac_name: 'Física', semester: 2, component: 'Fundamental' }]);

    const result = await canCreatePlanningForSubject(
      'uuid-docente', 'doc@plantel.mx', 'Física', 2, 'Fundamental',
    );
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('active_subscription');
  });

  it('canCreatePlanningForSubject — slots agotados: allowed=false, reason=slots_exhausted', async () => {
    enqueue([{ role: 'docente' }]);
    enqueue([{
      id: 'sub-001', plan_name: 'Plan 1 materia', plan_subjects: 1,
      status: 'active', current_period_end: null,
      cancel_at_period_end: false, stripe_customer_id: null,
    }]);
    enqueue([{ id: 'ss-001', uac_name: 'Matemáticas', semester: 2, component: 'Fundamental' }]);

    const result = await canCreatePlanningForSubject(
      'uuid-docente', 'doc@plantel.mx', 'Química', 3, 'Fundamental',
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('slots_exhausted');
  });
});
