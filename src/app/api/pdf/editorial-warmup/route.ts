/**
 * route.ts — Precalentamiento ligero del Worker Editorial en Render
 * SIGPDA-EMS · Fase 4 (PR 4.1)
 *
 * Ruta: GET /api/pdf/editorial-warmup
 *
 * En el plan gratuito de Render el contenedor se duerme tras 15 min de inactividad
 * (~50 s de cold-start). Llamar este endpoint ligero en segundo plano cuando el docente
 * abre una planeación con libros generados despierta el contenedor antes de que presione
 * "Descargar PDF / Paquete".
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { featureFlags } from '@/lib/platform/feature-flags';
import { fetchEditorialWorkerTemplateVersion } from '@/lib/editorial/worker-client';

export const runtime = 'nodejs';
export const maxDuration = 15;

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
  }

  const workerConfigured = Boolean(process.env.EDITORIAL_WORKER_URL?.trim());
  const v2Enabled = featureFlags.isEnabled('PUBLISHING_ENGINE_V2');
  if (!workerConfigured || !v2Enabled) {
    return NextResponse.json({
      ok: true,
      warmed: false,
      reason: !v2Enabled ? 'v2_disabled' : 'worker_not_configured',
    });
  }

  const templateVersion = await fetchEditorialWorkerTemplateVersion();
  return NextResponse.json({
    ok: true,
    warmed: Boolean(templateVersion),
    templateVersion: templateVersion ?? null,
  });
}
