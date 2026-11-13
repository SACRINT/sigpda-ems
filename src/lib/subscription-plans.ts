export const WELCOME_PLAN_NAME = 'bienvenida';
export const WELCOME_PLAN_SUBJECTS = 1;
export const WELCOME_PLANNING_LIMIT = 1;

const TELEMETRY_PLAN_IDS = new Set([
  'director_pro',
  'supervisor_pro',
  'escuela_completa',
]);

const TELEMETRY_PLAN_LABELS = new Set([
  'plan direccion escolar',
  'plan supervision de zona',
  'plan institucional plantel completo',
]);

function normalizePlanName(planName: string): string {
  return planName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export function canViewGenerationTelemetry(planName: string | null | undefined): boolean {
  if (!planName) return false;
  const normalized = normalizePlanName(planName);
  return TELEMETRY_PLAN_IDS.has(normalized) || TELEMETRY_PLAN_LABELS.has(normalized);
}
