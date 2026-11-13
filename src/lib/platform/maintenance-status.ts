import { sql } from '@/lib/db/client';
import { logger } from '@/lib/logger';

const MAINTENANCE_CACHE_TTL_MS = 60_000;

let maintenanceCache: { data: { active: boolean; message: string }; at: number } | null = null;

export function invalidateMaintenanceCache(): void {
  maintenanceCache = null;
}

export async function getMaintenanceStatus(): Promise<{ active: boolean; message: string }> {
  const now = Date.now();
  if (maintenanceCache && now - maintenanceCache.at < MAINTENANCE_CACHE_TTL_MS) {
    return maintenanceCache.data;
  }

  try {
    const db = sql();
    const rows = await db`
      SELECT key, value FROM platform_config
      WHERE key IN ('maintenance_mode', 'maintenance_message')
    `;
    const cfg: Record<string, string> = {};
    for (const r of rows) cfg[r.key] = r.value;
    const data = {
      active: cfg.maintenance_mode === 'true',
      message: cfg.maintenance_message || 'La plataforma está en mantenimiento. Por favor regresa más tarde.',
    };
    maintenanceCache = { data, at: now };
    return data;
  } catch (err) {
    logger.warn('[AppLayout] Error checking maintenance status, defaulting to inactive', { error: err });
    return { active: false, message: '' };
  }
}
