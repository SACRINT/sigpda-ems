/**
 * src/lib/analytics/alert-engine.ts
 * Motor de Detección de Anomalías y Alertas Pedagógicas de Supervisión (Fase 5)
 * SIGPDA-EMS · SEMS Puebla MCCEMS 2026-2027
 */

import { sql } from '@/lib/db';
import { logger } from '@/lib/logger';
import { createNotification, markNotificationAsRead } from '@/lib/db/notifications';
import { emitDomainEvent } from './events';
import type { PedagogicalAlert, AlertSeverity } from '@/types/analytics';

export interface SupervisoryAlertInput {
  alertType: 'QUALITY_SCORE_DROP' | 'HORAS_CORTE_DESBALANCEADO' | 'PAEC_DESVINCULADO' | 'RETO_SITUADO_INCOMPLETO' | 'DOCENTE_INACTIVO';
  supervisorId: string;
  teacherId?: string;
  teacherName?: string;
  schoolCct?: string;
  schoolName?: string;
  planningId?: string;
  score?: number;
  details?: string;
}

/**
 * Evalúa y dispara una alerta pedagógica para el supervisor y el docente.
 */
export async function triggerSupervisoryAlert(input: SupervisoryAlertInput): Promise<PedagogicalAlert | null> {
  try {
    let severity: AlertSeverity = 'P2';
    let title = 'Alerta Pedagógica de Supervisión';
    let message = input.details || 'Se ha detectado una observación pedagógica que requiere atención.';

    switch (input.alertType) {
      case 'QUALITY_SCORE_DROP':
        severity = (input.score !== undefined && input.score < 60) ? 'P0' : 'P1';
        title = `⚠️ Calidad Insuficiente (${input.score ?? 0} pts) · ${input.schoolName || input.schoolCct || 'Plantel'}`;
        message = `La planeación presenta un puntaje inferior a los estándares oficiales MCCEMS. Requiere revisión técnica de acompañamiento.`;
        break;

      case 'HORAS_CORTE_DESBALANCEADO':
        severity = 'P2';
        title = `⏱️ Desbalance Horario en Cortes de Evaluación · ${input.schoolName || input.schoolCct || 'Plantel'}`;
        message = input.details || 'La dosificación de horas no cumple la equivalencia exacta de 6 semanas por corte semestral.';
        break;

      case 'PAEC_DESVINCULADO':
        severity = 'P2';
        title = `🌱 Planeación sin Vinculación PAEC · ${input.schoolName || input.schoolCct || 'Plantel'}`;
        message = 'La secuencia didáctica no articula el reto comunitario con el Proyecto Escolar Comunitario institucional.';
        break;

      case 'RETO_SITUADO_INCOMPLETO':
        severity = 'P2';
        title = `🎯 Reto Situado No Aprobado (<4/4) · ${input.schoolName || input.schoolCct || 'Plantel'}`;
        message = 'El reto situado no cumple con los 4 componentes normativos del MCCEMS (Verbo, Contexto, Problema, Reto).';
        break;

      case 'DOCENTE_INACTIVO':
        severity = 'P3';
        title = `ℹ️ Seguimiento de Actividad Docente · ${input.teacherName || 'Docente'}`;
        message = 'El docente no ha registrado avances de planeación curricular en las últimas semanas.';
        break;
    }

    const notif = await createNotification({
      user_id: input.supervisorId,
      type: `alert_${input.alertType.toLowerCase()}`,
      title,
      message,
      link: input.planningId ? `/planeacion/${input.planningId}` : undefined,
      severity: severity === 'P0' || severity === 'P1' ? 'error' : 'warning',
      channels: ['in_app'],
      metadata: {
        alertType: input.alertType,
        severity,
        schoolCct: input.schoolCct,
        schoolName: input.schoolName,
        teacherId: input.teacherId,
        planningId: input.planningId,
        score: input.score,
      },
    });

    await emitDomainEvent({
      eventType: 'alert_triggered',
      aggregateId: input.planningId || input.schoolCct || input.supervisorId,
      aggregateType: 'zone',
      payload: {
        alertType: input.alertType,
        severity,
        title,
        message,
        notificationId: notif?.id,
      },
    });

    return {
      id: notif?.id ? String(notif.id) : `alert-${Date.now()}`,
      alertType: input.alertType,
      title,
      description: message,
      severity,
      schoolCct: input.schoolCct,
      schoolName: input.schoolName,
      teacherId: input.teacherId,
      planningId: input.planningId,
      zoneId: input.supervisorId,
      channel: 'in_app',
      createdAt: notif?.created_at ? new Date(notif.created_at).toISOString() : new Date().toISOString(),
      resolved: false,
    };
  } catch (error) {
    logger.error('[AlertEngine] Error generando alerta de supervisión:', error);
    return null;
  }
}

/**
 * Consulta alertas pedagógicas activas (no leídas) para un supervisor o zona escolar.
 */
export async function getActiveSupervisoryAlerts(
  supervisorId: string,
  options: { severity?: AlertSeverity; limit?: number } = {}
): Promise<PedagogicalAlert[]> {
  try {
    const db = sql();
    const limit = options.limit || 30;

    const rows = await db`
      SELECT id, type, title, message, link, severity, metadata, read, created_at
      FROM notifications
      WHERE user_id = ${supervisorId}::uuid
        AND read = FALSE
        AND type LIKE 'alert_%'
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;

    return rows.map((r: Record<string, unknown>) => {
      const meta = (r.metadata || {}) as Record<string, unknown>;
      const rawSev = (meta.severity as AlertSeverity) || (r.severity === 'error' ? 'P1' : 'P2');
      return {
        id: r.id as string,
        alertType: (meta.alertType as string) || String(r.type).replace('alert_', '').toUpperCase(),
        title: r.title as string,
        description: r.message as string,
        severity: rawSev,
        schoolCct: meta.schoolCct as string | undefined,
        schoolName: meta.schoolName as string | undefined,
        teacherId: meta.teacherId as string | undefined,
        planningId: meta.planningId as string | undefined,
        zoneId: supervisorId,
        channel: 'in_app',
        createdAt: r.created_at ? new Date(r.created_at as string).toISOString() : new Date().toISOString(),
        resolved: Boolean(r.read),
      };
    });
  } catch (error) {
    logger.warn('[AlertEngine] Error consultando alertas de supervisión:', error);
    return [];
  }
}

/**
 * Marca una alerta de supervisión como atendida / resuelta.
 */
export async function resolveSupervisoryAlert(alertId: string, supervisorId: string): Promise<boolean> {
  try {
    const res = await markNotificationAsRead(alertId, supervisorId);
    if (res) {
      await emitDomainEvent({
        eventType: 'alert_resolved',
        aggregateId: alertId,
        aggregateType: 'alert',
        payload: { resolvedBy: supervisorId },
      });
    }
    return Boolean(res);
  } catch (error) {
    logger.warn(`[AlertEngine] Error resolviendo alerta ${alertId}:`, error);
    return false;
  }
}
