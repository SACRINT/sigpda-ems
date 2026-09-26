/**
 * src/lib/zone-metric-format.ts
 * Formateador puro para métricas de zona escolar (911/F11).
 * Preserva ceros legítimos (0 -> '0' o '0%') y mapea ausencia o valores no válidos a 'N/D'.
 */

export function formatZoneMetric(val: unknown, opts?: { pct?: boolean }): string {
  if (val === undefined || val === null) {
    return 'N/D';
  }
  if (typeof val === 'string' && val.trim() === '') {
    return 'N/D';
  }
  const num = typeof val === 'number' ? val : Number(val);
  if (!Number.isFinite(num) || num < 0) {
    return 'N/D';
  }
  return opts?.pct ? `${num}%` : `${num}`;
}
