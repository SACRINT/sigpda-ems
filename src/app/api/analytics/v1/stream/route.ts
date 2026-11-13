/**
 * src/app/api/analytics/v1/stream/route.ts
 * Streaming Server-Sent Events (SSE) nativo para actualización en tiempo real (Fase 5)
 * SIGPDA-EMS · SEMS Puebla MCCEMS 2026-2027
 */

import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherIdByEmail } from '@/lib/db';
import { isEnvAdmin } from '@/lib/admin-env';
import { getZoneAnalytics } from '@/lib/analytics/aggregations';
import { getActiveSupervisoryAlerts } from '@/lib/analytics/alert-engine';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALERTS_CACHE_TTL_MS = 60_000;
const alertsCache = new Map<string, { data: unknown; expires: number }>();

async function getCachedAlerts(supervisorId: string) {
  const now = Date.now();
  const cached = alertsCache.get(supervisorId);
  if (cached && cached.expires > now) {
    return cached.data;
  }
  const alerts = await getActiveSupervisoryAlerts(supervisorId, { limit: 10 });
  alertsCache.set(supervisorId, { data: alerts, expires: now + ALERTS_CACHE_TTL_MS });
  return alerts;
}

export async function GET(request: NextRequest) {
  let heartbeatTimer: NodeJS.Timeout | null = null;

  const clearTimers = () => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  };

  try {
    const session = await auth();
    if (!session?.user?.email) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supervisorId =
      session.user.id || (await getTeacherIdByEmail(session.user.email));
    if (!supervisorId) {
      return new Response(JSON.stringify({ error: 'Usuario no encontrado' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const isUserAdmin = isEnvAdmin(session.user.email) || Boolean(session.user.is_admin);
    const isSupervisor = isUserAdmin || session.user.role === 'supervisor';

    if (!isSupervisor) {
      return new Response(JSON.stringify({ error: 'Acceso reservado a Supervisores y Administradores' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        // 1. Mensaje de conexión inicial
        const initialData = JSON.stringify({
          type: 'connected',
          timestamp: new Date().toISOString(),
          supervisorId,
        });
        controller.enqueue(encoder.encode(`event: connected\ndata: ${initialData}\n\n`));

        // 2. Enviar estado analítico inicial
        try {
          const [zoneMetric, alerts] = await Promise.all([
            getZoneAnalytics(supervisorId),
            getCachedAlerts(supervisorId),
          ]);

          const payload = JSON.stringify({
            zone: zoneMetric,
            alerts,
            timestamp: new Date().toISOString(),
          });
          controller.enqueue(encoder.encode(`event: metrics_update\ndata: ${payload}\n\n`));
        } catch (initErr) {
          logger.warn('[SSE-Stream] Advertencia al emitir métricas iniciales:', initErr);
        }

        // 3. Heartbeat cada 15 segundos para mantener viva la conexión.
        // No consulta la base de datos; el refresco de alertas ocurre al reconectar.
        heartbeatTimer = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(`: heartbeat ${Date.now()}\n\n`));
          } catch {
            clearTimers();
          }
        }, 15000);
      },

      cancel() {
        clearTimers();
      },
    });

    request.signal.addEventListener('abort', () => {
      clearTimers();
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    clearTimers();
    logger.error('[API-Analytics-Stream] Error iniciando stream SSE:', error);
    return new Response(JSON.stringify({ error: 'Error interno en stream analítico' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
