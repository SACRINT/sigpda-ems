/**
 * route.ts — Endpoint Agregador Central de Salud de Plataforma Nivel 2
 * GET /api/platform/health
 * SIGPDA-EMS · MCCEMS Ciclo Escolar 2026-2027
 * 
 * Reúne y consolida en una sola respuesta el sondeo honesto de infraestructura y los 5 subsistemas
 * centrales de Nivel 1 (Planeaciones, PAEC, PMC, Cartografía y Horarios).
 */

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { planeacionesOrchestrator } from '@/lib/planeaciones/orchestrator';
import { paecOrchestrator } from '@/lib/paec/orchestrator';
import { pmcOrchestrator } from '@/lib/pmc/orchestrator';
import { cartografiaContextProvider } from '@/lib/cartografia/context-provider';
import { horariosOrchestrator } from '@/lib/horarios/orchestrator';
import type { HealthCheckResult } from '@/lib/platform/interfaces';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface PlatformHealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  platform: string;
  version: string;
  database: {
    connected: boolean;
    latencyMs: number;
    error?: string;
  };
  programs: {
    planeaciones: HealthCheckResult;
    paec: HealthCheckResult;
    pmc: HealthCheckResult;
    cartografia: HealthCheckResult;
    horarios: HealthCheckResult;
  };
}

export async function GET(): Promise<NextResponse> {
  let dbConnected = false;
  let dbLatencyMs = -1;
  let dbError: string | undefined;

  // 1. Verificación de conectividad a BD mediante tagged template sql`...`
  try {
    if (!process.env.DATABASE_URL) {
      dbError = 'DATABASE_URL no configurada';
    } else {
      const db = sql();
      const start = performance.now();
      await db`SELECT 1 as ping`;
      dbLatencyMs = Math.round(performance.now() - start);
      dbConnected = true;
    }
  } catch (err: unknown) {
    dbConnected = false;
    dbError = err instanceof Error ? err.message : 'Error en ping a base de datos';
    logger.error('[PlatformHealth] Database ping failed:', err);
  }

  // 2. Consulta paralela a los healthChecks de los 5 subsistemas centrales
  const [
    planeacionesHealth,
    paecHealth,
    pmcHealth,
    cartografiaHealth,
    horariosHealth,
  ] = await Promise.all([
    planeacionesOrchestrator.healthCheck(),
    paecOrchestrator.healthCheck(),
    pmcOrchestrator.healthCheck(),
    cartografiaContextProvider.healthCheck(),
    horariosOrchestrator.healthCheck(),
  ]);

  const allPrograms: HealthCheckResult[] = [
    planeacionesHealth,
    paecHealth,
    pmcHealth,
    cartografiaHealth,
    horariosHealth,
  ];

  // 3. Determinación de estado global agregado
  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

  if (!dbConnected || allPrograms.some((p) => p.status === 'unhealthy')) {
    status = 'unhealthy';
  } else if (allPrograms.some((p) => p.status === 'degraded')) {
    status = 'degraded';
  }

  const payload: PlatformHealthResponse = {
    status,
    timestamp: new Date().toISOString(),
    platform: 'SIGPDA-EMS',
    version: '2.0.0',
    database: {
      connected: dbConnected,
      latencyMs: dbLatencyMs,
      ...(dbError ? { error: dbError } : {}),
    },
    programs: {
      planeaciones: planeacionesHealth,
      paec: paecHealth,
      pmc: pmcHealth,
      cartografia: cartografiaHealth,
      horarios: horariosHealth,
    },
  };

  return NextResponse.json(payload, {
    status: status === 'unhealthy' ? 503 : 200,
  });
}
