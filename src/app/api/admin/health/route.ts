import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { getEditorialRolloutTelemetrySummaryDb } from '@/lib/db/usage-quotas';
import {
  evaluateLegacyRetirementReadiness,
  isShadowModeEnabledFromEnv,
  resolveCanaryPercentFromEnv,
  type EditorialRolloutTelemetrySummary,
  type LegacyRetirementReadiness,
} from '@/lib/editorial/rollout-policy';
import { featureFlags } from '@/lib/platform/feature-flags';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/admin-unified';
import { logger } from '@/lib/logger';

export interface AdminHealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latencyMs: number;
  db: boolean;
  dbError?: string;
  aiProviders: {
    gemini: boolean;
    groq: boolean;
    flux: boolean;
  };
  editorialV2Rollout?: {
    enabled: boolean;
    shadowMode: boolean;
    canaryPct: number;
    telemetry14d: EditorialRolloutTelemetrySummary;
    retirementReadiness: LegacyRetirementReadiness;
  };
  timestamp: string;
  environment: string;
}

export async function GET(): Promise<NextResponse> {
  try {
    await requireAdmin();
  } catch (authError: unknown) {
    if (authError instanceof Error) {
      if (authError.message === 'UNAUTHORIZED') return adminUnauthorized();
      if (authError.message === 'FORBIDDEN') return adminForbidden();
    }
    return adminUnauthorized();
  }

  let dbHealthy = false;
  let latencyMs = -1;
  let dbError: string | undefined;

  try {
    const db = sql();
    const start = performance.now();
    await db`SELECT 1 as ping`;
    latencyMs = Math.round(performance.now() - start);
    dbHealthy = true;
  } catch (err: unknown) {
    dbHealthy = false;
    dbError = err instanceof Error ? err.message : 'Database ping failure';
    logger.error('[AdminHealth] Neon DB ping failed:', { error: err });
  }

  const geminiKey = process.env.GEMINI_API_KEY || '';
  const groqKey = process.env.GROQ_API_KEY || '';
  const fluxKey = process.env.FLUX_API_KEY || '';

  const aiProviders = {
    gemini: Boolean(geminiKey.trim().length > 10),
    groq: Boolean(groqKey.trim().length > 10),
    flux: Boolean(fluxKey.trim().length > 10),
  };

  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  if (!dbHealthy) {
    status = 'unhealthy';
  } else if (latencyMs > 800 || (!aiProviders.gemini && !aiProviders.groq)) {
    status = 'degraded';
  }

  let editorialV2Rollout: AdminHealthResponse['editorialV2Rollout'];
  if (dbHealthy) {
    try {
      const telemetry14d = await getEditorialRolloutTelemetrySummaryDb(14);
      editorialV2Rollout = {
        enabled: featureFlags.isEnabled('PUBLISHING_ENGINE_V2'),
        shadowMode: isShadowModeEnabledFromEnv(),
        canaryPct: resolveCanaryPercentFromEnv(),
        telemetry14d,
        retirementReadiness: evaluateLegacyRetirementReadiness(telemetry14d),
      };
    } catch (telemetryErr) {
      logger.warn('[AdminHealth] Telemetría editorial V2 no disponible (no bloqueante):', {
        error: telemetryErr instanceof Error ? telemetryErr.message : String(telemetryErr),
      });
    }
  }

  const payload: AdminHealthResponse = {
    status,
    latencyMs,
    db: dbHealthy,
    dbError,
    aiProviders,
    ...(editorialV2Rollout ? { editorialV2Rollout } : {}),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  };

  return NextResponse.json(payload, { status: status === 'unhealthy' ? 503 : 200 });
}
