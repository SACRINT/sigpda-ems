/**
 * analytics-api.test.ts
 * Tests de integración y endpoints REST/SSE para Analytics v1 (Fase 5 - GAP-003)
 * SIGPDA-EMS · DBEPA Puebla MCCEMS 2026-2027
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mocks de autenticación y base de datos
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

const mockSql = vi.fn().mockResolvedValue([]);

vi.mock('@/lib/db', () => ({
  sql: () => mockSql,
  getTeacherByEmail: vi.fn(),
}));

vi.mock('@/lib/admin-unified', () => ({
  isAdmin: vi.fn(),
}));

vi.mock('@/lib/analytics/aggregations', () => ({
  getZoneAnalytics: vi.fn(async (zoneId: string) => ({
    zoneId,
    zoneName: 'Zona 01 — Puebla Oriente',
    supervisorName: 'Supervisor Test',
    totalSchools: 12,
    totalTeachers: 45,
    totalPlannings: 130,
    avgQualityScore: 85.5,
    schools: [],
  })),
  getZoneTrendData: vi.fn(async () => [
    { date: '2026-03-01', avgQualityScore: 84, planningsCount: 5, activeSchools: 3 },
  ]),
}));

vi.mock('@/lib/analytics/alert-engine', () => ({
  getActiveSupervisoryAlerts: vi.fn(async () => [
    {
      id: 'al-1',
      alertType: 'QUALITY_SCORE_DROP',
      title: 'Alerta Test',
      description: 'Desc',
      severity: 'P1',
      createdAt: new Date().toISOString(),
      resolved: false,
    },
  ]),
  triggerSupervisoryAlert: vi.fn(async (input) => ({
    id: 'al-new',
    ...input,
    createdAt: new Date().toISOString(),
    resolved: false,
  })),
  resolveSupervisoryAlert: vi.fn(async () => true),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { auth } from '@/lib/auth';
import { getTeacherByEmail } from '@/lib/db';
import { isAdmin } from '@/lib/admin-unified';

import { GET as getZoneHandler } from '@/app/api/analytics/v1/zone/[zoneId]/route';
import { GET as getSchoolHandler } from '@/app/api/analytics/v1/school/[schoolId]/route';
import { GET as getAlertsHandler, POST as postAlertsHandler } from '@/app/api/analytics/v1/alerts/route';
import { GET as getStreamHandler } from '@/app/api/analytics/v1/stream/route';

describe('Fase 5 — API Endpoints REST v1 & SSE (GAP-003)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. GET /api/analytics/v1/zone/[zoneId]', () => {
    it('retorna 401 si no hay sesión activa', async () => {
      vi.mocked(auth).mockResolvedValueOnce(null as never);

      const req = new NextRequest('http://localhost:3000/api/analytics/v1/zone/zona-01');
      const res = await getZoneHandler(req, { params: Promise.resolve({ zoneId: 'zona-01' }) });

      expect(res.status).toBe(401);
    });

    it('retorna 403 si el usuario es docente sin rol de supervisión ni admin', async () => {
      vi.mocked(auth).mockResolvedValueOnce({ user: { email: 'docente@escuela.mx' } } as never);
      vi.mocked(getTeacherByEmail).mockResolvedValueOnce({ id: 't-1', role: 'docente' } as never);
      vi.mocked(isAdmin).mockResolvedValueOnce(false);

      const req = new NextRequest('http://localhost:3000/api/analytics/v1/zone/zona-01');
      const res = await getZoneHandler(req, { params: Promise.resolve({ zoneId: 'zona-01' }) });

      expect(res.status).toBe(403);
    });

    it('retorna 200 con zone y trends cuando es supervisor autorizado', async () => {
      vi.mocked(auth).mockResolvedValueOnce({ user: { email: 'supervisor@seppuebla.gob.mx' } } as never);
      vi.mocked(getTeacherByEmail).mockResolvedValueOnce({ id: 's-1', role: 'supervisor' } as never);
      vi.mocked(isAdmin).mockResolvedValueOnce(false);

      const req = new NextRequest('http://localhost:3000/api/analytics/v1/zone/zona-01?days=30');
      const res = await getZoneHandler(req, { params: Promise.resolve({ zoneId: 'zona-01' }) });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.zone.zoneId).toBe('zona-01');
      expect(json.trends.length).toBeGreaterThan(0);
    });
  });

  describe('2. GET /api/analytics/v1/school/[schoolId]', () => {
    it('retorna 200 con desglose de plantel para administrador', async () => {
      vi.mocked(auth).mockResolvedValueOnce({ user: { email: 'admin@sigpda.mx' } } as never);
      vi.mocked(getTeacherByEmail).mockResolvedValueOnce({ id: 'a-1', role: 'admin' } as never);
      vi.mocked(isAdmin).mockResolvedValueOnce(true);

      const req = new NextRequest('http://localhost:3000/api/analytics/v1/school/sch-001');
      const res = await getSchoolHandler(req, { params: Promise.resolve({ schoolId: 'sch-001' }) });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.cct).toBe('SCH-001');
      expect(json.planningsCount).toBe(0);
    });
  });

  describe('3. GET & POST /api/analytics/v1/alerts', () => {
    it('GET retorna lista de alertas pedagógicas activas', async () => {
      vi.mocked(auth).mockResolvedValueOnce({ user: { email: 'supervisor@seppuebla.gob.mx' } } as never);
      vi.mocked(getTeacherByEmail).mockResolvedValueOnce({ id: 's-1', role: 'supervisor' } as never);
      vi.mocked(isAdmin).mockResolvedValueOnce(false);

      const req = new NextRequest('http://localhost:3000/api/analytics/v1/alerts?limit=10');
      const res = await getAlertsHandler(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(Array.isArray(json.alerts)).toBe(true);
      expect(json.count).toBe(1);
    });

    it('POST procesa resolución de alerta para administrador', async () => {
      vi.mocked(auth).mockResolvedValueOnce({ user: { email: 'admin@sigpda.mx' } } as never);
      vi.mocked(getTeacherByEmail).mockResolvedValueOnce({ id: 'a-1', role: 'admin' } as never);
      vi.mocked(isAdmin).mockResolvedValueOnce(true);

      const req = new NextRequest('http://localhost:3000/api/analytics/v1/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resolve', alertId: 'al-1' }),
      });
      const res = await postAlertsHandler(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.resolvedId).toBe('al-1');
    });
  });

  describe('4. GET /api/analytics/v1/stream (SSE)', () => {
    it('retorna 200 con Content-Type text/event-stream para sesión autorizada', async () => {
      vi.mocked(auth).mockResolvedValueOnce({ user: { email: 'supervisor@seppuebla.gob.mx' } } as never);
      vi.mocked(getTeacherByEmail).mockResolvedValueOnce({ id: 's-1', role: 'supervisor' } as never);
      vi.mocked(isAdmin).mockResolvedValueOnce(false);

      const req = new NextRequest('http://localhost:3000/api/analytics/v1/stream?zoneId=zona-01');
      const res = await getStreamHandler(req);

      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toContain('text/event-stream');
      expect(res.headers.get('Cache-Control')).toContain('no-cache');
    });
  });
});
