/**
 * src/app/api/analytics/v1/stream/route.ts
 * Streaming Server-Sent Events (SSE) nativo para actualización en tiempo real (Fase 5)
 * SIGPDA-EMS · DBEPA Puebla MCCEMS 2026-2027
 */

import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail } from '@/lib/db';
import { isAdmin } from '@/lib/admin-unified';
import { getZoneAnalytics } from '@/lib/analytics/aggregations';
import { getActiveSupervisoryAlerts } from '@/lib/analytics/alert-engine';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  let heartbeatTimer: NodeJS.Timeout | null = null;
  let metricsTimer: NodeJS.Timeout | null = null;

  const clearTimers = () => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    if (metricsTimer) {
      clearInterval(metricsTimer);
      metricsTimer = null;
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

    const teacher = await getTeacherByEmail(session.user.email);
    if (!teacher) {
      return new Response(JSON.stringify({ error: 'Usuario no encontrado' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const isUserAdmin = await isAdmin(session.user.email, teacher.role);
    const isSupervisor = isUserAdmin || teacher.role === 'supervisor';

    if (!isSupervisor) {
      return new Response(JSON.stringify({ error: 'Acceso reservado a Supervisores y Administradores' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supervisorId = teacher.id;
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
            getActiveSupervisoryAlerts(supervisorId, { limit: 10 }),
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

        // 3. Heartbeat cada 15 segundos para mantener viva la conexión
        heartbeatTimer = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(`: heartbeat ${Date.now()}\n\n`));
          } catch {
            clearTimers();
          }
        }, 15000);

        // 4. Actualización de métricas periódica (cada 45 segundos)
        metricsTimer = setInterval(async () => {
          try {
            const alerts = await getActiveSupervisoryAlerts(supervisorId, { limit: 10 });
            const payload = JSON.stringify({
              alerts,
              timestamp: new Date().toISOString(),
            });
            controller.enqueue(encoder.encode(`event: alerts_pulse\ndata: ${payload}\n\n`));
          } catch (pulseErr) {
            logger.warn('[SSE-Stream] Advertencia en pulso de alertas:', pulseErr);
            clearTimers();
          }
        }, 45000);
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
