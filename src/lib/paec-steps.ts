import type { CycleType } from '@/types/paec';

export interface PaecStepItem {
  num: number;
  label: string;
}

export const ALL_STEPS: PaecStepItem[] = [
  { num: 1, label: 'Diagnóstico Colectivo' },
  { num: 2, label: 'Justificación y Propósitos' },
  { num: 3, label: 'Mapeo de UACs' },
  { num: 4, label: 'Cronograma' },
  { num: 5, label: 'Detalle Curricular' },
  { num: 6, label: 'Plan Operativo Semestre A' },
  { num: 7, label: 'Plan Operativo Semestre B' },
  { num: 8, label: 'Implementación y Anexos' },
  { num: 9, label: 'Gobernanza e Informe' },
];

export function getVisibleSteps(cycle: CycleType): PaecStepItem[] {
  if (cycle === 'A') {
    return ALL_STEPS.filter((s) => s.num !== 7 && s.num !== 9);
  }
  if (cycle === 'B') {
    return ALL_STEPS.filter((s) => s.num !== 6 && s.num !== 8);
  }
  return [...ALL_STEPS];
}

export function normalizeActiveStep(currentStep: number | undefined | null, cycle: CycleType): number {
  const visible = getVisibleSteps(cycle);
  const step = currentStep || 1;
  if (visible.some((s) => s.num === step)) {
    return step;
  }
  const nextVisible = visible.find((s) => s.num >= step);
  return nextVisible ? nextVisible.num : visible[visible.length - 1].num;
}
