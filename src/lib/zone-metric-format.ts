/**
 * src/lib/zone-metric-format.ts
 * Formateador puro para métricas de zona escolar (911/F11).
 * Preserva ceros legítimos (0 -> '0' o '0%') y mapea ausencia o valores no válidos a 'N/D'.
 */

export function formatZoneMetric(val: unknown, opts?: { pct?: boolean }): string {
  if (val == null) {
    return 'N/D';
  }
  if (typeof val === 'string' && val.trim() === '') {
    return 'N/D';
  }
  const num = typeof val === 'number' ? val : Number(val);
  if (!Number.isFinite(num)) {
    return 'N/D';
  }
  if (num < 0) {
    return 'N/D';
  }
  return opts?.pct ? `${num}%` : `${num}`;
}

export interface ZoneDiagnosticParams {
  zonaNumero?: string;
  cicloEscolar?: string;
  totalPlanteles: number;
  matriculaTotal: number;
  promedioEficiencia?: number;
  promedioAbandono?: number;
  promedioAprovechamiento?: number;
  promedioReprobacion?: number;
  plantelesPrioritarios?: string[];
}

/**
 * Genera la síntesis diagnóstica consolidada 911.7G / F11C para la zona escolar.
 * Garantiza que la ausencia de métricas se represente con 'N/D' y no con '0%' fabricado.
 */
export function buildZoneDiagnosticText(params: ZoneDiagnosticParams): string {
  const zona = params.zonaNumero?.trim() ? params.zonaNumero.trim() : 'N/D';
  const ciclo = params.cicloEscolar?.trim() ? params.cicloEscolar.trim() : 'N/D';
  const prioritarios = params.plantelesPrioritarios ?? [];

  return (
    `Diagnóstico territorial consolidado a partir de la estadística oficial 911.7G y F11C (Zona ${zona}, Ciclo ${ciclo}):\n` +
    `• Cobertura Zonal: ${params.totalPlanteles} planteles analizados con una matrícula total de ${params.matriculaTotal} estudiantes.\n` +
    `• Línea Base Cuantitativa: Eficiencia Terminal Zonal del ${formatZoneMetric(params.promedioEficiencia, { pct: true })}, Abandono Escolar Zonal del ${formatZoneMetric(params.promedioAbandono, { pct: true })}, Promedio General de Aprovechamiento en ${formatZoneMetric(params.promedioAprovechamiento)} y Reprobación del ${formatZoneMetric(params.promedioReprobacion, { pct: true })}.\n` +
    (prioritarios.length > 0
      ? `• Planteles con Atención Prioritaria: ${prioritarios.join('; ')}.\n`
      : '') +
    `• Retos Identificados: Dispersión geográfica, trabajo juvenil estacional y necesidades de nivelación académica en pensamiento matemático y comunicación integral.`
  );
}

