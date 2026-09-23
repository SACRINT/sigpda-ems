/**
 * src/app/api/analytics/v1/zone/[zoneId]/route.ts
 * Endpoint REST v1 para métricas agregadas de Zona Escolar (Fase 5)
 * SIGPDA-EMS · SEMS Puebla MCCEMS 2026-2027
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail } from '@/lib/db';
import { isAdmin } from '@/lib/admin-unified';
import { getZoneAnalytics, getZoneTrendData } from '@/lib/analytics/aggregations';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ zoneId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const teacher = await getTeacherByEmail(session.user.email);
    if (!teacher) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    const isUserAdmin = await isAdmin(session.user.email, teacher.role);
    const isSupervisor = isUserAdmin || teacher.role === 'supervisor';

    if (!isSupervisor) {
      return NextResponse.json(
        { error: 'Acceso reservado a Supervisores Escolares y Administradores' },
        { status: 403 }
      );
    }

    const { zoneId } = await params;
    // Si zoneId es 'current', usar el ID del supervisor actual
    const targetSupervisorId = zoneId === 'current' ? teacher.id : zoneId;

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30', 10);

    const [zoneData, trends] = await Promise.all([
      getZoneAnalytics(targetSupervisorId),
      getZoneTrendData(targetSupervisorId, days),
    ]);

    return NextResponse.json(
      {
        zone: zoneData,
        trends,
        timestamp: new Date().toISOString(),
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
        },
      }
    );
  } catch (error) {
    logger.error('[API-Analytics-Zone] Error obteniendo analítica de zona:', error);
    const message = error instanceof Error ? error.message : 'Error interno al consultar analítica de zona';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
