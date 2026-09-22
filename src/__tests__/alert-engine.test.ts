/**
 * alert-engine.test.ts
 * Tests unitarios para el Motor de Alertas Pedagógicas de Supervisión (Fase 5 - GAP-007)
 * SIGPDA-EMS · DBEPA Puebla MCCEMS 2026-2027
 */

import { vi, describe, it, expect, beforeEach, beforeAll } from 'vitest';

const mockSqlExecute = vi.fn();
const mockSql = Object.assign(
  vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => mockSqlExecute(strings, ...values)),
  {
    transaction: vi.fn(async (cb: (sql: unknown) => unknown) => cb(mockSql)),
  }
);

vi.mock('@/lib/db', () => ({
  sql: () => mockSql,
}));

vi.mock('@/lib/db/notifications', () => ({
  createNotification: vi.fn(async (notif) => ({ id: 'notif-123', ...notif })),
  markNotificationAsRead: vi.fn(async () => true),
}));

vi.mock('@/lib/analytics/events', () => ({
  emitDomainEvent: vi.fn(async (evt) => ({ id: 'event-uuid-1', ...evt })),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  triggerSupervisoryAlert,
  getActiveSupervisoryAlerts,
  resolveSupervisoryAlert,
} from '@/lib/analytics/alert-engine';
import { createNotification, markNotificationAsRead } from '@/lib/db/notifications';
import { emitDomainEvent } from '@/lib/analytics/events';

describe('Fase 5 — Supervisory Alert Engine (GAP-007)', () => {
  beforeAll(() => {
    vi.stubEnv('DATABASE_URL', 'postgresql://test:test@localhost:5432/sigpda_test');
  });

  beforeEach(() => {
    mockSqlExecute.mockReset();
    mockSqlExecute.mockResolvedValue([]);
    vi.clearAllMocks();
  });

  describe('1. triggerSupervisoryAlert', () => {
    it('asigna severidad P0 cuando el puntaje de calidad cae por debajo de 60', async () => {
      const alert = await triggerSupervisoryAlert({
        alertType: 'QUALITY_SCORE_DROP',
        supervisorId: 'sup-01',
        teacherId: 'teach-01',
        teacherName: 'Prof. Martínez',
        schoolCct: '21EBH0001A',
        schoolName: 'Bachillerato Puebla',
        planningId: 'plan-100',
        score: 52,
      });

      expect(alert).not.toBeNull();
      expect(alert?.severity).toBe('P0');
      expect(alert?.title).toContain('Calidad Insuficiente');
      expect(createNotification).toHaveBeenCalled();
      expect(emitDomainEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'alert_triggered',
          aggregateId: 'plan-100',
        })
      );
    });

    it('asigna severidad P1 cuando el puntaje es regular pero bajo (60-75)', async () => {
      const alert = await triggerSupervisoryAlert({
        alertType: 'QUALITY_SCORE_DROP',
        supervisorId: 'sup-01',
        score: 68,
      });

      expect(alert?.severity).toBe('P1');
    });

    it('dispara alerta P2 para PAEC desvinculado de la secuencia didáctica', async () => {
      const alert = await triggerSupervisoryAlert({
        alertType: 'PAEC_DESVINCULADO',
        supervisorId: 'sup-01',
        schoolCct: '21EBH0002B',
      });

      expect(alert?.severity).toBe('P2');
      expect(alert?.title).toContain('PAEC');
    });

    it('dispara alerta P2 para horas desbalanceadas en cortes de evaluación', async () => {
      const alert = await triggerSupervisoryAlert({
        alertType: 'HORAS_CORTE_DESBALANCEADO',
        supervisorId: 'sup-01',
        details: 'El corte 1 suma 25 horas excediendo las 18 programadas',
      });

      expect(alert?.severity).toBe('P2');
      expect(alert?.description).toContain('25 horas');
    });
  });

  describe('2. getActiveSupervisoryAlerts', () => {
    it('recupera alertas no leídas mapeadas con formato PedagogicalAlert', async () => {
      mockSqlExecute.mockResolvedValueOnce([
        {
          id: 'notif-1',
          type: 'alert_quality_score_drop',
          title: '⚠️ Calidad Insuficiente',
          message: 'La planeación presenta un puntaje inferior',
          severity: 'error',
          metadata: {
            alertType: 'QUALITY_SCORE_DROP',
            severity: 'P0',
            schoolCct: '21EBH0001A',
            schoolName: 'Bachillerato Puebla',
          },
          read: false,
          created_at: new Date().toISOString(),
        },
      ]);

      const alerts = await getActiveSupervisoryAlerts('sup-01', { limit: 10 });

      expect(alerts.length).toBe(1);
      expect(alerts[0].id).toBe('notif-1');
      expect(alerts[0].severity).toBe('P0');
      expect(alerts[0].schoolCct).toBe('21EBH0001A');
      expect(alerts[0].resolved).toBe(false);
    });
  });

  describe('3. resolveSupervisoryAlert', () => {
    it('marca la notificación como leída y emite evento ALERT_RESOLVED', async () => {
      vi.mocked(markNotificationAsRead).mockResolvedValueOnce({ id: 'notif-1', read: true } as never);

      const success = await resolveSupervisoryAlert('notif-1', 'sup-01');

      expect(success).toBe(true);
      expect(markNotificationAsRead).toHaveBeenCalledWith('notif-1', 'sup-01');
      expect(emitDomainEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'alert_resolved',
          aggregateId: 'notif-1',
        })
      );
    });
  });
});
