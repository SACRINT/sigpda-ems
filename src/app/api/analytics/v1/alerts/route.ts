/**
 * src/app/api/analytics/v1/alerts/route.ts
 * Endpoint REST v1 para gestión y consulta de Alertas Pedagógicas Zonal (Fase 5)
 * SIGPDA-EMS · SEMS Puebla MCCEMS 2026-2027
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail } from '@/lib/db';
import { isAdmin } from '@/lib/admin-unified';
import {
  getActiveSupervisoryAlerts,
  triggerSupervisoryAlert,
  resolveSupervisoryAlert,
  type SupervisoryAlertInput,
} from '@/lib/analytics/alert-engine';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const teacher = await getTeacherByEmail(session.user.email);
    if (!teacher) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    const allowed = await isAdmin(session.user.email);
    if (!allowed && teacher.role !== 'supervisor' && teacher.role !== 'director') {
      return NextResponse.json({ error: 'Acceso denegado: Rol de supervisión requerido' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get('limit')) || 20, 100);

    const alerts = await getActiveSupervisoryAlerts(teacher.id, { limit });
    return NextResponse.json({ alerts, count: alerts.length });
  } catch (error) {
    logger.error('[API-Analytics-Alerts] Error consultando alertas:', error);
    const message = error instanceof Error ? error.message : 'Error interno en alertas';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const allowed = await isAdmin(session.user.email);
    if (!allowed) {
      return NextResponse.json({ error: 'Acceso denegado: Administrador requerido' }, { status: 403 });
    }

    const teacher = await getTeacherByEmail(session.user.email);
    if (!teacher) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    const body = await request.json();
    const { action, alertId, alertInput } = body as {
      action?: 'resolve' | 'trigger';
      alertId?: string;
      alertInput?: Partial<SupervisoryAlertInput>;
    };

    if (action === 'resolve' && alertId) {
      const ok = await resolveSupervisoryAlert(alertId, teacher.id);
      return NextResponse.json({ success: ok, resolvedId: alertId });
    }

    if (action === 'trigger' && alertInput && alertInput.alertType) {
      const newAlert = await triggerSupervisoryAlert({
        alertType: alertInput.alertType,
        supervisorId: teacher.id,
        teacherId: alertInput.teacherId,
        teacherName: alertInput.teacherName,
        schoolCct: alertInput.schoolCct,
        schoolName: alertInput.schoolName,
        planningId: alertInput.planningId,
        score: alertInput.score,
        details: alertInput.details,
      });
      return NextResponse.json({ success: Boolean(newAlert), alert: newAlert });
    }

    return NextResponse.json({ error: 'Acción no válida o alertType ausente' }, { status: 400 });
  } catch (error) {
    logger.error('[API-Analytics-Alerts] Error procesando acción de alerta:', error);
    const message = error instanceof Error ? error.message : 'Error interno en alerta';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
