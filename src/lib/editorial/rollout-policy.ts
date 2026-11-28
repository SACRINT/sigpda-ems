/**
 * rollout-policy.ts — Política Determinista de Despliegue Controlado (PR 4.4)
 * SIGPDA-EMS · Shadow / Canary (10% → 50% → 100%) / Rollback Instantáneo por Flag
 *
 * Reglas operativas sin redeploy (solo variables de entorno en Vercel):
 * 1. `PUBLISHING_ENGINE_V2=false` → rollback instantáneo a `jspdf_legacy` (kill-switch 0%).
 * 2. `PUBLISHING_ENGINE_V2=true` + `PUBLISHING_ENGINE_V2_SHADOW=true` → sirve `jspdf_legacy`
 *    al usuario mientras ejecuta validación/compilación V2 en sombra sin descontar cuota.
 * 3. `PUBLISHING_ENGINE_V2=true` + `PUBLISHING_ENGINE_V2_CANARY_PCT=10|50|100` → asigna
 *    determinísticamente por hash SHA-256 (`teacherId || planningId`) en cubetas 0..99.
 *    (Default = 100 cuando `PUBLISHING_ENGINE_V2=true` y no se define CANARY_PCT).
 * 4. `PUBLISHING_ENGINE_V2_ALLOWLIST` (CSV de emails o teacherIds) → siempre recibe V2
 *    incluso en canary 0% o 10% para QA interno.
 */

import * as crypto from 'crypto';
import { featureFlags } from '@/lib/platform/feature-flags';

export type EditorialRolloutDecision =
  | 'v2_full'
  | 'v2_canary'
  | 'v2_allowlist'
  | 'shadow_legacy'
  | 'legacy_rollback'
  | 'legacy_canary_holdout';

export interface EditorialRolloutEvaluation {
  useV2: boolean;
  shadowMode: boolean;
  decision: EditorialRolloutDecision;
  canaryPct: number;
  bucket: number;
}

export interface EditorialRolloutTelemetrySummary {
  windowDays: number;
  observedSpanDays: number;
  totalCompiles: number;
  typstCount: number;
  typstCachedCount: number;
  jspdfFallbackCount: number;
  jspdfLegacyCount: number;
  cacheHitRatePct: number;
  fallbackRatePct: number;
  p95DurationMs: number | null;
}

export interface LegacyRetirementReadiness {
  readyToRetireLegacyJsPdf: boolean;
  reasons: string[];
  thresholds: {
    minWindowDays: number;
    minTotalV2Compiles: number;
    maxFallbackRatePct: number;
  };
}

const TRUTHY_ENV = new Set(['1', 'true', 'yes', 'on', 'enabled']);

/**
 * Calcula una cubeta determinista `0..99` a partir de un identificador estable
 * (`teacherId` o `planningId`) para evitar fluctuaciones de motor entre descargas.
 */
export function computeCanaryBucket(seed: string): number {
  const digest = crypto.createHash('sha256').update(seed || 'anonymous').digest();
  return digest.readUInt32BE(0) % 100;
}

export function resolveCanaryPercentFromEnv(env: Record<string, string | undefined> = process.env): number {
  const raw = env.PUBLISHING_ENGINE_V2_CANARY_PCT;
  if (raw === undefined || raw.trim() === '') return 100;
  const parsed = Number(raw.trim());
  if (!Number.isFinite(parsed)) return 100;
  return Math.max(0, Math.min(100, Math.floor(parsed)));
}

export function isShadowModeEnabledFromEnv(env: Record<string, string | undefined> = process.env): boolean {
  const raw = env.PUBLISHING_ENGINE_V2_SHADOW;
  if (!raw) return false;
  return TRUTHY_ENV.has(raw.trim().toLowerCase());
}

export function parseAllowlistFromEnv(env: Record<string, string | undefined> = process.env): Set<string> {
  const raw = env.PUBLISHING_ENGINE_V2_ALLOWLIST || '';
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

/**
 * Evalúa qué motor debe atender una compilación PDF editorial bajo la política
 * de despliegue controlado (Shadow / Canary / Kill-Switch Rollback).
 */
export function evaluateEditorialRollout(params: {
  seed: string;
  teacherId?: string;
  teacherEmail?: string;
  forceV2?: boolean;
  forceShadow?: boolean;
  env?: Record<string, string | undefined>;
}): EditorialRolloutEvaluation {
  const env = params.env ?? process.env;
  const bucket = computeCanaryBucket(params.seed);

  if (params.forceV2 === false) {
    return {
      useV2: false,
      shadowMode: false,
      decision: 'legacy_rollback',
      canaryPct: 0,
      bucket,
    };
  }

  const flagEnabled = params.forceV2 === true || featureFlags.isEnabled('PUBLISHING_ENGINE_V2');
  if (!flagEnabled) {
    return {
      useV2: false,
      shadowMode: false,
      decision: 'legacy_rollback',
      canaryPct: 0,
      bucket,
    };
  }

  const shadow = params.forceShadow ?? isShadowModeEnabledFromEnv(env);
  if (shadow && params.forceV2 !== true) {
    return {
      useV2: false,
      shadowMode: true,
      decision: 'shadow_legacy',
      canaryPct: resolveCanaryPercentFromEnv(env),
      bucket,
    };
  }

  const allowlist = parseAllowlistFromEnv(env);
  const teacherIdNorm = (params.teacherId || '').trim().toLowerCase();
  const teacherEmailNorm = (params.teacherEmail || '').trim().toLowerCase();
  if (
    (teacherIdNorm && allowlist.has(teacherIdNorm)) ||
    (teacherEmailNorm && allowlist.has(teacherEmailNorm))
  ) {
    return {
      useV2: true,
      shadowMode: false,
      decision: 'v2_allowlist',
      canaryPct: resolveCanaryPercentFromEnv(env),
      bucket,
    };
  }

  if (params.forceV2 === true) {
    return {
      useV2: true,
      shadowMode: false,
      decision: 'v2_full',
      canaryPct: 100,
      bucket,
    };
  }

  const canaryPct = resolveCanaryPercentFromEnv(env);
  if (canaryPct >= 100) {
    return {
      useV2: true,
      shadowMode: false,
      decision: 'v2_full',
      canaryPct: 100,
      bucket,
    };
  }

  if (bucket < canaryPct) {
    return {
      useV2: true,
      shadowMode: false,
      decision: 'v2_canary',
      canaryPct,
      bucket,
    };
  }

  return {
    useV2: false,
    shadowMode: false,
    decision: 'legacy_canary_holdout',
    canaryPct,
    bucket,
  };
}

/**
 * Compuerta contractual PR 4.4 para autorizar el retiro definitivo de `pdf-workbook-renderer.ts`:
 * - Mínimo 14 días de operación real continua observada
 * - Mínimo 20 compilaciones V2 en la ventana
 * - Tasa de fallback a jsPDF < 1.0 %
 * - Cero incidentes P0 abiertos
 */
export function evaluateLegacyRetirementReadiness(
  stats: EditorialRolloutTelemetrySummary,
  openP0Incidents = 0,
): LegacyRetirementReadiness {
  const thresholds = {
    minWindowDays: 14,
    minTotalV2Compiles: 20,
    maxFallbackRatePct: 1.0,
  };
  const reasons: string[] = [];
  const totalV2Attempts = stats.typstCount + stats.typstCachedCount + stats.jspdfFallbackCount;

  if (stats.observedSpanDays < thresholds.minWindowDays) {
    reasons.push(
      `Ventana observada insuficiente (${stats.observedSpanDays}d < ${thresholds.minWindowDays}d requeridos)`,
    );
  }
  if (totalV2Attempts < thresholds.minTotalV2Compiles) {
    reasons.push(
      `Muestra V2 insuficiente (${totalV2Attempts} compilaciones < ${thresholds.minTotalV2Compiles} mínimas)`,
    );
  }
  if (stats.fallbackRatePct >= thresholds.maxFallbackRatePct) {
    reasons.push(
      `Tasa de fallback ${stats.fallbackRatePct.toFixed(2)}% >= ${thresholds.maxFallbackRatePct}%`,
    );
  }
  if (openP0Incidents > 0) {
    reasons.push(`Existen ${openP0Incidents} incidentes P0 abiertos`);
  }

  return {
    readyToRetireLegacyJsPdf: reasons.length === 0,
    reasons,
    thresholds,
  };
}
