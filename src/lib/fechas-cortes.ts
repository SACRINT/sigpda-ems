import type { FechasCortes } from '@/types/planning';

export const DEFAULT_FECHAS_CORTES: FechasCortes = {
  corte1: 'Del 12 al 16 de octubre de 2026',
  corte2: 'Del 23 al 27 de noviembre de 2026',
  corte3: 'Del 25 al 29 de enero de 2027',
};

export function resolveFechasCortes(partial?: Partial<FechasCortes> | null): FechasCortes {
  return {
    corte1: partial?.corte1?.trim() || DEFAULT_FECHAS_CORTES.corte1,
    corte2: partial?.corte2?.trim() || DEFAULT_FECHAS_CORTES.corte2,
    corte3: partial?.corte3?.trim() || DEFAULT_FECHAS_CORTES.corte3,
  };
}

export function buildFechasCortesPromptBlock(partial?: Partial<FechasCortes> | null): string {
  const fechas = resolveFechasCortes(partial);
  return [
    'Fechas oficiales de cortes de evaluación:',
    `  • Corte 1: ${fechas.corte1}`,
    `  • Corte 2: ${fechas.corte2}`,
    `  • Corte 3: ${fechas.corte3}`,
  ].join('\n');
}
