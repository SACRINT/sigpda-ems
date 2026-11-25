export const DIMENSIONS = {
  DIM1: 'Dimensión 1: Diagnóstico Comunitario y Escolar',
  DIM2: 'Dimensión 2: Justificación y Fundamentación',
  DIM3: 'Dimensión 3: Mapeo Curricular y Cobertura',
  DIM4: 'Dimensión 4: Cronograma Bimestral',
  DIM5: 'Dimensión 5: Detalle Curricular y Progresiones',
  DIM6: 'Dimensión 6: Plan Operativo Territorial',
  DIM7: 'Dimensión 7: Implementación y Formalización',
  DIM8: 'Dimensión 8: Gobernanza Escolar e Informe de Supervisión',
} as const;

// ----------------------------------------------------------------------------
// Helpers de Inspección de Contenido
// ----------------------------------------------------------------------------

export function hasDigits(text: string): boolean {
  return /\d+/.test(text);
}

export function hasPercentage(text: string): boolean {
  return /%|\d+\s*por\s*ciento/i.test(text);
}

export type LooseTableRow = Record<string, string | undefined>;

