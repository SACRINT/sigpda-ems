/**
 * usage-quota-guard.ts — Guardián Central de Cuotas, Rate Limits y Concurrencia
 * SIGPDA-EMS · Fase 4 (PR 4.2 + PR 4.2.1 Atomicidad Real & Resiliencia BD)
 *
 * Garantías implementadas:
 * 1. Contadores mensuales anclados al **periodo de facturación de Stripe** (`currentPeriodEnd`),
 *    NO mes calendario, en zona horaria `America/Mexico_City`.
 * 2. **Atomicidad real** en Neon: `pg_advisory_xact_lock` + CTE condicional `WHERE used_count < limit`
 *    con `usage_idempotency_keys` en la misma transacción (cero check-then-act, cero leaks de llaves).
 * 3. `editorial_render_locks` atómico con TTL + telemetría de motor (`typst | typst_cached | jspdf_fallback`).
 * 4. Resiliencia ante falla de BD: nunca lanza 500 genérico; devuelve `503 QUOTA_SERVICE_UNAVAILABLE`
 *    con `Retry-After: 30` y telemetría estructurada.
 */

import { getSubscriptionStatus, type SubscriptionStatus } from '@/lib/subscription-gate';
import { WELCOME_PLAN_NAME } from '@/lib/subscription-plans';
import {
  consumeUsageQuotaAtomicDb,
  recordEditorialEngineTelemetry,
  refundUsageQuotaAtomicDb,
  releaseRenderLockDb,
  tryAcquireRenderLockDb,
  type EditorialEngineTelemetryKind,
} from '@/lib/db/usage-quotas';
import { logger } from '@/lib/logger';

export const MEXICO_CITY_TZ = 'America/Mexico_City';

export type QuotaMetric =
  | 'ai_planning'
  | 'ai_workbook_block'
  | 'ai_sequence_extra'
  | 'pdf_compile'
  | 'bulk_zip_daily';

export type PlanTier =
  | 'bienvenida'
  | 'basico'
  | 'estandar'
  | 'avanzado'
  | 'completo'
  | 'institucional'
  | 'administrador';

export interface PlanQuotaPolicy {
  tier: PlanTier;
  label: string;
  aiPlanningsPerPeriod: number;
  aiWorkbookBlocksPerPeriod: number;
  aiSequencesExtrasPerPeriod: number;
  pdfCompilesPerPeriod: number;
  bulkZipPerDay: number;
  aiPerHour: number;
  exportPerHour: number;
  maxConcurrency: number;
}

export const PLAN_QUOTA_POLICIES: Readonly<Record<PlanTier, PlanQuotaPolicy>> = {
  bienvenida: {
    tier: 'bienvenida',
    label: 'Cortesía (Bienvenida)',
    aiPlanningsPerPeriod: 1,
    aiWorkbookBlocksPerPeriod: 1,
    aiSequencesExtrasPerPeriod: 2,
    pdfCompilesPerPeriod: 3,
    bulkZipPerDay: 0,
    aiPerHour: 3,
    exportPerHour: 3,
    maxConcurrency: 1,
  },
  basico: {
    tier: 'basico',
    label: 'Básico',
    aiPlanningsPerPeriod: 2,
    aiWorkbookBlocksPerPeriod: 4,
    aiSequencesExtrasPerPeriod: 10,
    pdfCompilesPerPeriod: 15,
    bulkZipPerDay: 2,
    aiPerHour: 10,
    exportPerHour: 8,
    maxConcurrency: 1,
  },
  estandar: {
    tier: 'estandar',
    label: 'Estándar',
    aiPlanningsPerPeriod: 6,
    aiWorkbookBlocksPerPeriod: 12,
    aiSequencesExtrasPerPeriod: 25,
    pdfCompilesPerPeriod: 40,
    bulkZipPerDay: 5,
    aiPerHour: 15,
    exportPerHour: 12,
    maxConcurrency: 1,
  },
  avanzado: {
    tier: 'avanzado',
    label: 'Avanzado',
    aiPlanningsPerPeriod: 10,
    aiWorkbookBlocksPerPeriod: 20,
    aiSequencesExtrasPerPeriod: 40,
    pdfCompilesPerPeriod: 70,
    bulkZipPerDay: 8,
    aiPerHour: 20,
    exportPerHour: 15,
    maxConcurrency: 2,
  },
  completo: {
    tier: 'completo',
    label: 'Completo',
    aiPlanningsPerPeriod: 20,
    aiWorkbookBlocksPerPeriod: 40,
    aiSequencesExtrasPerPeriod: 80,
    pdfCompilesPerPeriod: 120,
    bulkZipPerDay: 15,
    aiPerHour: 30,
    exportPerHour: 25,
    maxConcurrency: 2,
  },
  institucional: {
    tier: 'institucional',
    label: 'Institucional / Dirección',
    aiPlanningsPerPeriod: 10,
    aiWorkbookBlocksPerPeriod: 15,
    aiSequencesExtrasPerPeriod: 30,
    pdfCompilesPerPeriod: 50,
    bulkZipPerDay: 6,
    aiPerHour: 15,
    exportPerHour: 12,
    maxConcurrency: 2,
  },
  administrador: {
    tier: 'administrador',
    label: 'Administrador',
    aiPlanningsPerPeriod: Number.MAX_SAFE_INTEGER,
    aiWorkbookBlocksPerPeriod: Number.MAX_SAFE_INTEGER,
    aiSequencesExtrasPerPeriod: Number.MAX_SAFE_INTEGER,
    pdfCompilesPerPeriod: Number.MAX_SAFE_INTEGER,
    bulkZipPerDay: Number.MAX_SAFE_INTEGER,
    aiPerHour: Number.MAX_SAFE_INTEGER,
    exportPerHour: Number.MAX_SAFE_INTEGER,
    maxConcurrency: 8,
  },
};

export interface QuotaWindows {
  periodWindowKey: string;
  dayWindowKey: string;
  hourWindowKey: string;
  timezone: typeof MEXICO_CITY_TZ;
}

export interface QuotaCheckResult {
  allowed: boolean;
  tier: PlanTier;
  metric: QuotaMetric;
  windowKey: string;
  used: number;
  limit: number;
  remaining: number;
  alreadyCounted?: boolean;
  hourlyMetric?: string;
  hourWindowKey?: string;
  scopedIdempotencyKey?: string;
  statusCode?: 403 | 429 | 503;
  code?:
    | 'PLAN_UPGRADE_REQUIRED'
    | 'QUOTA_EXCEEDED'
    | 'RATE_LIMIT_EXCEEDED'
    | 'QUOTA_SERVICE_UNAVAILABLE';
  message?: string;
  retryAfterSeconds?: number;
}

export interface ConcurrencyLockResult {
  acquired: boolean;
  lockId?: string;
  tier: PlanTier;
  activeCount: number;
  maxConcurrency: number;
  statusCode?: 409 | 503;
  code?: 'CONCURRENCY_LIMIT' | 'QUOTA_SERVICE_UNAVAILABLE';
  retryAfterSeconds?: number;
  message?: string;
}

export class QuotaExceededError extends Error {
  readonly statusCode: 403 | 409 | 429 | 503;
  readonly code: string;
  readonly retryAfterSeconds?: number;

  constructor(params: {
    message: string;
    statusCode: 403 | 409 | 429 | 503;
    code: string;
    retryAfterSeconds?: number;
  }) {
    super(params.message);
    this.name = 'QuotaExceededError';
    this.statusCode = params.statusCode;
    this.code = params.code;
    this.retryAfterSeconds = params.retryAfterSeconds;
  }
}

function normalizeLabel(raw: string | null | undefined): string {
  return (raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

/**
 * Formatea una fecha en TZ `America/Mexico_City` (YYYY, MM, DD, HH) sin depender del huso del servidor.
 */
export function getMexicoCityDateParts(date: Date = new Date()): {
  year: string;
  month: string;
  day: string;
  hour: string;
} {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: MEXICO_CITY_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  });
  const parts = formatter.formatToParts(date);
  const pick = (type: string) => parts.find((p) => p.type === type)?.value || '00';
  return {
    year: pick('year'),
    month: pick('month'),
    day: pick('day'),
    hour: pick('hour'),
  };
}

/**
 * Resuelve el tier de cuotas desde el estado real de suscripción (`getSubscriptionStatus`).
 */
export function resolvePlanTier(subStatus: SubscriptionStatus): PlanTier {
  if (subStatus.isAdmin) return 'administrador';
  if (!subStatus.hasActiveSubscription || !subStatus.subscription) return 'bienvenida';

  const normName = normalizeLabel(subStatus.subscription.planName);
  if (normName === WELCOME_PLAN_NAME || normName.includes('cortesia') || normName.includes('bienvenida')) {
    return 'bienvenida';
  }
  if (
    normName.includes('director') ||
    normName.includes('supervisor') ||
    normName.includes('escuela') ||
    normName.includes('institucional') ||
    normName.includes('plantel')
  ) {
    return 'institucional';
  }
  if (normName.includes('completo')) return 'completo';
  if (normName.includes('avanzado')) return 'avanzado';
  if (normName.includes('estandar')) return 'estandar';
  if (normName.includes('basico')) return 'basico';

  const subjects = Number(subStatus.subscription.planSubjects || 0);
  if (subjects >= 10) return 'completo';
  if (subjects >= 5) return 'avanzado';
  if (subjects >= 3) return 'estandar';
  if (subjects >= 1) return 'basico';
  return 'bienvenida';
}

/**
 * Construye las llaves de ventana temporal:
 * - Periodo de facturación Stripe (`stripe:<subId>:<YYYY-MM-DD>` en TZ `America/Mexico_City`)
 *   en lugar de mes calendario, evitando reinicios dobles el día 1.
 * - Ventana diaria y horaria en TZ `America/Mexico_City`.
 */
export function resolveQuotaWindows(
  subStatus: SubscriptionStatus,
  now: Date = new Date(),
): QuotaWindows {
  const mxNow = getMexicoCityDateParts(now);
  const dayWindowKey = `mx-day:${mxNow.year}-${mxNow.month}-${mxNow.day}`;
  const hourWindowKey = `mx-hour:${mxNow.year}-${mxNow.month}-${mxNow.day}T${mxNow.hour}`;

  const tier = resolvePlanTier(subStatus);
  if (tier === 'bienvenida') {
    return {
      periodWindowKey: 'bienvenida:cortesia',
      dayWindowKey,
      hourWindowKey,
      timezone: MEXICO_CITY_TZ,
    };
  }

  const sub = subStatus.subscription;
  if (sub?.id && sub.currentPeriodEnd) {
    const endDate = new Date(sub.currentPeriodEnd);
    if (!Number.isNaN(endDate.getTime())) {
      const mxEnd = getMexicoCityDateParts(endDate);
      return {
        periodWindowKey: `stripe:${sub.id}:${mxEnd.year}-${mxEnd.month}-${mxEnd.day}`,
        dayWindowKey,
        hourWindowKey,
        timezone: MEXICO_CITY_TZ,
      };
    }
  }

  return {
    periodWindowKey: `mx-month:${mxNow.year}-${mxNow.month}`,
    dayWindowKey,
    hourWindowKey,
    timezone: MEXICO_CITY_TZ,
  };
}

function getMetricLimit(policy: PlanQuotaPolicy, metric: QuotaMetric): number {
  switch (metric) {
    case 'ai_planning':
      return policy.aiPlanningsPerPeriod;
    case 'ai_workbook_block':
      return policy.aiWorkbookBlocksPerPeriod;
    case 'ai_sequence_extra':
      return policy.aiSequencesExtrasPerPeriod;
    case 'pdf_compile':
      return policy.pdfCompilesPerPeriod;
    case 'bulk_zip_daily':
      return policy.bulkZipPerDay;
  }
}

function isAiMetric(metric: QuotaMetric): boolean {
  return (
    metric === 'ai_planning' ||
    metric === 'ai_workbook_block' ||
    metric === 'ai_sequence_extra'
  );
}

export interface QuotaGuardDeps {
  getSubscriptionStatus: typeof getSubscriptionStatus;
  consumeUsageQuotaAtomicDb: typeof consumeUsageQuotaAtomicDb;
  refundUsageQuotaAtomicDb?: typeof refundUsageQuotaAtomicDb;
  tryAcquireRenderLockDb: typeof tryAcquireRenderLockDb;
  releaseRenderLockDb: typeof releaseRenderLockDb;
  recordEditorialEngineTelemetry: typeof recordEditorialEngineTelemetry;
}

const DEFAULT_DEPS: QuotaGuardDeps = {
  getSubscriptionStatus,
  consumeUsageQuotaAtomicDb,
  refundUsageQuotaAtomicDb,
  tryAcquireRenderLockDb,
  releaseRenderLockDb,
  recordEditorialEngineTelemetry,
};

/**
 * Valida y consume atómicamente la cuota principal (periodo Stripe o diaria) + el rate limit
 * horario en TZ `America/Mexico_City` mediante una única transacción/CTE en Neon.
 *
 * - Los administradores siempre tienen paso libre.
 * - Si `idempotencyKey` ya fue contada antes (reintento de red), permite continuar sin sumar doble.
 * - Si la BD falla temporalmente, nunca lanza 500: devuelve `503 QUOTA_SERVICE_UNAVAILABLE` + `Retry-After`.
 */
export async function enforceUsageQuota(
  params: {
    teacherId: string;
    teacherEmail?: string;
    metric: QuotaMetric;
    idempotencyKey?: string;
    now?: Date;
  },
  deps: QuotaGuardDeps = DEFAULT_DEPS,
): Promise<QuotaCheckResult> {
  let subStatus: SubscriptionStatus;
  try {
    subStatus = await deps.getSubscriptionStatus(params.teacherId, params.teacherEmail);
  } catch (err) {
    logger.error('[usage-quota-guard] Falla de BD al consultar estado de suscripción:', {
      teacherId: params.teacherId,
      metric: params.metric,
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      allowed: false,
      tier: 'bienvenida',
      metric: params.metric,
      windowKey: 'unavailable',
      used: 0,
      limit: 0,
      remaining: 0,
      statusCode: 503,
      code: 'QUOTA_SERVICE_UNAVAILABLE',
      retryAfterSeconds: 30,
      message:
        'El servicio de verificación de suscripción y cuotas no está disponible temporalmente. Reintenta en unos segundos.',
    };
  }

  const tier = resolvePlanTier(subStatus);
  const policy = PLAN_QUOTA_POLICIES[tier];
  const windows = resolveQuotaWindows(subStatus, params.now);
  const primaryWindowKey =
    params.metric === 'bulk_zip_daily' ? windows.dayWindowKey : windows.periodWindowKey;
  const primaryLimit = getMetricLimit(policy, params.metric);

  if (tier === 'administrador') {
    return {
      allowed: true,
      tier,
      metric: params.metric,
      windowKey: primaryWindowKey,
      used: 0,
      limit: primaryLimit,
      remaining: Number.MAX_SAFE_INTEGER,
    };
  }

  // 1. Si el plan no incluye esta funcionalidad (ej. bulk_zip_daily = 0 en Bienvenida) → 403 inmediato
  if (primaryLimit <= 0) {
    return {
      allowed: false,
      tier,
      metric: params.metric,
      windowKey: primaryWindowKey,
      used: 0,
      limit: 0,
      remaining: 0,
      statusCode: 403,
      code: 'PLAN_UPGRADE_REQUIRED',
      message: `Tu plan ${policy.label} no incluye descarga masiva en ZIP. Actualiza a un plan docente para desbloquear Paquete Completo.`,
    };
  }

  const hourlyMetric = isAiMetric(params.metric) ? 'ai_hourly' : 'export_hourly';
  const hourlyLimit = isAiMetric(params.metric) ? policy.aiPerHour : policy.exportPerHour;
  const scopedPrimaryIdem = params.idempotencyKey
    ? `q:${params.teacherId}:${params.metric}:${params.idempotencyKey}`
    : undefined;

  let atomicRes: Awaited<ReturnType<typeof consumeUsageQuotaAtomicDb>>;
  try {
    atomicRes = await deps.consumeUsageQuotaAtomicDb({
      teacherId: params.teacherId,
      metric: params.metric,
      primaryWindowKey,
      primaryLimit,
      hourlyMetric,
      hourWindowKey: windows.hourWindowKey,
      hourlyLimit,
      idempotencyKey: scopedPrimaryIdem,
    });
  } catch (err) {
    logger.error('[usage-quota-guard] Falla de BD en consumeUsageQuotaAtomicDb:', {
      teacherId: params.teacherId,
      metric: params.metric,
      windowKey: primaryWindowKey,
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      allowed: false,
      tier,
      metric: params.metric,
      windowKey: primaryWindowKey,
      used: 0,
      limit: primaryLimit,
      remaining: 0,
      statusCode: 503,
      code: 'QUOTA_SERVICE_UNAVAILABLE',
      retryAfterSeconds: 30,
      message:
        'No fue posible validar tu cuota en base de datos en este momento. Reintenta en unos segundos.',
    };
  }

  if (atomicRes.allowed) {
    return {
      allowed: true,
      tier,
      metric: params.metric,
      windowKey: primaryWindowKey,
      used: atomicRes.primaryUsed,
      limit: primaryLimit,
      remaining: Math.max(0, primaryLimit - atomicRes.primaryUsed),
      alreadyCounted: atomicRes.alreadyCounted,
      hourlyMetric,
      hourWindowKey: windows.hourWindowKey,
      scopedIdempotencyKey: scopedPrimaryIdem,
    };
  }

  if (atomicRes.deniedBy === 'hourly_limit') {
    return {
      allowed: false,
      tier,
      metric: params.metric,
      windowKey: windows.hourWindowKey,
      used: atomicRes.hourlyUsed,
      limit: hourlyLimit,
      remaining: 0,
      statusCode: 429,
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfterSeconds: 1800,
      message: `Límite temporal alcanzado (${hourlyLimit} solicitudes por hora en tu plan ${policy.label}). Espera unos minutos antes de reintentar.`,
    };
  }

  const isDaily = params.metric === 'bulk_zip_daily';
  return {
    allowed: false,
    tier,
    metric: params.metric,
    windowKey: primaryWindowKey,
    used: atomicRes.primaryUsed,
    limit: primaryLimit,
    remaining: 0,
    statusCode: isDaily ? 429 : 403,
    code: 'QUOTA_EXCEEDED',
    retryAfterSeconds: isDaily ? 3600 : undefined,
    message: isDaily
      ? `Alcanzaste tu límite diario de ${primaryLimit} descargas masivas ZIP en tu plan ${policy.label}. Intenta mañana o actualiza tu plan.`
      : `Alcanzaste el límite de ${primaryLimit} usos incluidos en tu periodo actual del plan ${policy.label}. Actualiza tu plan para continuar.`,
  };
}

/**
 * Adquiere atómicamente un lock de concurrencia con TTL para evitar múltiples renders/jobs simultáneos por docente.
 * Debe invocarse ANTES de `enforceUsageQuota` para jamás descontar cuota si ya hay un proceso activo (409).
 */
export async function acquireEditorialConcurrencyLock(
  params: {
    teacherId: string;
    teacherEmail?: string;
    scope: 'pdf_compile' | 'bulk_zip' | 'ai_workbook_block';
    resourceId: string;
    ttlSeconds?: number;
  },
  deps: QuotaGuardDeps = DEFAULT_DEPS,
): Promise<ConcurrencyLockResult> {
  let subStatus: SubscriptionStatus;
  try {
    subStatus = await deps.getSubscriptionStatus(params.teacherId, params.teacherEmail);
  } catch (err) {
    logger.error('[usage-quota-guard] Falla de BD al consultar suscripción para lock de concurrencia:', {
      teacherId: params.teacherId,
      scope: params.scope,
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      acquired: false,
      tier: 'bienvenida',
      activeCount: 0,
      maxConcurrency: 1,
      statusCode: 503,
      code: 'QUOTA_SERVICE_UNAVAILABLE',
      retryAfterSeconds: 30,
      message:
        'Servicio de control de concurrencia temporalmente no disponible. Reintenta en unos segundos.',
    };
  }

  const tier = resolvePlanTier(subStatus);
  const policy = PLAN_QUOTA_POLICIES[tier];

  if (tier === 'administrador') {
    return {
      acquired: true,
      tier,
      activeCount: 0,
      maxConcurrency: policy.maxConcurrency,
    };
  }

  let res: Awaited<ReturnType<typeof tryAcquireRenderLockDb>>;
  try {
    res = await deps.tryAcquireRenderLockDb({
      teacherId: params.teacherId,
      scope: params.scope,
      resourceId: params.resourceId,
      maxConcurrency: policy.maxConcurrency,
      ttlSeconds: params.ttlSeconds ?? (params.scope === 'ai_workbook_block' ? 600 : 180),
    });
  } catch (err) {
    logger.error('[usage-quota-guard] Falla de BD en tryAcquireRenderLockDb:', {
      teacherId: params.teacherId,
      scope: params.scope,
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      acquired: false,
      tier,
      activeCount: 0,
      maxConcurrency: policy.maxConcurrency,
      statusCode: 503,
      code: 'QUOTA_SERVICE_UNAVAILABLE',
      retryAfterSeconds: 30,
      message:
        'No fue posible reservar el turno de compilación en este momento. Reintenta en unos segundos.',
    };
  }

  if (!res.acquired) {
    return {
      acquired: false,
      tier,
      activeCount: res.activeCount,
      maxConcurrency: policy.maxConcurrency,
      statusCode: 409,
      code: 'CONCURRENCY_LIMIT',
      message: `Ya tienes ${res.activeCount} proceso(s) pesado(s) en curso (máximo ${policy.maxConcurrency} simultáneo en tu plan ${policy.label}). Espera a que termine antes de iniciar otro.`,
    };
  }

  return {
    acquired: true,
    lockId: res.lockId,
    tier,
    activeCount: res.activeCount,
    maxConcurrency: policy.maxConcurrency,
  };
}

/**
 * Reembolsa atómicamente una cuota consumida si el servicio externo (ej. Render Typst) falla
 * después del consumo, garantizando que el docente jamás pierda créditos por errores del worker.
 */
export async function refundUsageQuota(
  params: {
    teacherId: string;
    quota: QuotaCheckResult;
  },
  deps: QuotaGuardDeps = DEFAULT_DEPS,
): Promise<boolean> {
  if (!params.quota.allowed || params.quota.alreadyCounted || params.quota.tier === 'administrador') {
    return false;
  }
  const refundFn = deps.refundUsageQuotaAtomicDb ?? refundUsageQuotaAtomicDb;
  try {
    return await refundFn({
      teacherId: params.teacherId,
      metric: params.quota.metric,
      primaryWindowKey: params.quota.windowKey,
      hourlyMetric: params.quota.hourlyMetric,
      hourWindowKey: params.quota.hourWindowKey,
      idempotencyKey: params.quota.scopedIdempotencyKey,
    });
  } catch (err) {
    logger.warn('[usage-quota-guard] Error al reembolsar cuota (no bloqueante):', {
      teacherId: params.teacherId,
      metric: params.quota.metric,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

/**
 * Libera el lock sin registrar telemetría de render (ej. cuando la solicitud se aborta por cuota antes de ejecutar).
 */
export async function releaseEditorialLockOnAbort(
  lockId?: string,
  deps: QuotaGuardDeps = DEFAULT_DEPS,
): Promise<void> {
  if (!lockId) return;
  try {
    await deps.releaseRenderLockDb(lockId);
  } catch (err) {
    logger.warn('[usage-quota-guard] Error liberando lock tras aborto (no bloqueante):', {
      lockId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Libera el lock de concurrencia y registra telemetría del motor (`typst | typst_cached | jspdf_fallback`).
 */
export async function releaseEditorialConcurrencyLock(
  params: {
    lockId?: string;
    teacherId?: string | null;
    planningId?: string | null;
    scope: string;
    engine: EditorialEngineTelemetryKind;
    cached?: boolean;
    durationMs?: number;
  },
  deps: QuotaGuardDeps = DEFAULT_DEPS,
): Promise<void> {
  try {
    if (params.lockId) {
      await deps.releaseRenderLockDb(params.lockId, params.engine);
    }
    await deps.recordEditorialEngineTelemetry({
      teacherId: params.teacherId,
      planningId: params.planningId,
      scope: params.scope,
      engine: params.engine,
      cached: params.cached,
      durationMs: params.durationMs,
    });
  } catch (err) {
    logger.warn('[usage-quota-guard] Error liberando lock/telemetría (no bloqueante):', {
      scope: params.scope,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
