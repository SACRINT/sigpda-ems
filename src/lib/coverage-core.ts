/**
 * coverage-core.ts — Núcleo canónico de cobertura de metas de personal (C10 / D6).
 * SIGPDA-EMS · Estándar compartido entre Quality Gate, API Routes y Wizard Client.
 */

export interface CoverageResult {
  realStaffCount: number;
  metasCount: number;
  coverageRatio: number;
  coveragePercent: number;
  isLowCoverage: boolean;
}

/**
 * Calcula la cobertura de metas personales frente a la plantilla del plantel.
 *
 * @param metas - Lista de metas personales o conteo numérico de metas formuladas.
 * @param totalStaffOrStaffList - Total oficial del personal (número) o lista de integrantes (array).
 * @param fallbackStaffList - Lista alternativa de personal si el total numérico no está configurado.
 */
export function computeCoverage(
  metas: unknown[] | number | null | undefined,
  totalStaffOrStaffList?: unknown[] | number | null,
  fallbackStaffList?: unknown[] | null
): CoverageResult {
  const metasCount = typeof metas === 'number'
    ? Math.max(0, metas)
    : Array.isArray(metas)
      ? metas.length
      : 0;

  let realStaffCount = 1;

  if (typeof totalStaffOrStaffList === 'number' && totalStaffOrStaffList > 0) {
    realStaffCount = totalStaffOrStaffList;
  } else if (Array.isArray(totalStaffOrStaffList) && totalStaffOrStaffList.length > 0) {
    realStaffCount = totalStaffOrStaffList.length;
  } else if (Array.isArray(fallbackStaffList) && fallbackStaffList.length > 0) {
    realStaffCount = fallbackStaffList.length;
  }

  const coverageRatio = metasCount / realStaffCount;
  const coveragePercent = Math.round(coverageRatio * 100);
  const isLowCoverage = coveragePercent < 80;

  return {
    realStaffCount,
    metasCount,
    coverageRatio,
    coveragePercent,
    isLowCoverage,
  };
}
