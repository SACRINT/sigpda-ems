import { describe, expect, it } from 'vitest';
import { canViewGenerationTelemetry } from '@/lib/subscription-plans';

describe('subscription-plans - telemetría de generación', () => {
  it('reconoce los IDs internos de los planes Pro', () => {
    expect(canViewGenerationTelemetry('director_pro')).toBe(true);
    expect(canViewGenerationTelemetry('supervisor_pro')).toBe(true);
    expect(canViewGenerationTelemetry('escuela_completa')).toBe(true);
  });

  it('reconoce los nombres legibles usados por el checkout mock', () => {
    expect(canViewGenerationTelemetry('Plan Dirección Escolar')).toBe(true);
    expect(canViewGenerationTelemetry('Plan Supervisión de Zona')).toBe(true);
    expect(canViewGenerationTelemetry('Plan Institucional Plantel Completo')).toBe(true);
  });

  it('normaliza mayúsculas, acentos y espacios', () => {
    expect(canViewGenerationTelemetry('  DIRECTOR_PRO  ')).toBe(true);
    expect(canViewGenerationTelemetry('plan direccion escolar')).toBe(true);
    expect(canViewGenerationTelemetry('PLAN SUPERVISION DE ZONA')).toBe(true);
  });

  it('rechaza planes docentes, valores vacíos y nombres desconocidos', () => {
    expect(canViewGenerationTelemetry('bienvenida')).toBe(false);
    expect(canViewGenerationTelemetry('basico')).toBe(false);
    expect(canViewGenerationTelemetry('')).toBe(false);
    expect(canViewGenerationTelemetry(null)).toBe(false);
    expect(canViewGenerationTelemetry(undefined)).toBe(false);
    expect(canViewGenerationTelemetry('Plan Personalizado')).toBe(false);
  });
});
