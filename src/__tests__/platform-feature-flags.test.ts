/**
 * platform-feature-flags.test.ts
 * 
 * Pruebas unitarias para FeatureFlagService (Plataforma N2).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  FeatureFlagService,
  featureFlags,
  isFeatureEnabled,
  setFeatureFlag,
  resetFeatureFlags,
} from '@/lib/platform/feature-flags';

describe('FeatureFlagService (Plataforma N2)', () => {
  let service: FeatureFlagService;
  const originalEnv = process.env;

  beforeEach(() => {
    service = new FeatureFlagService();
    resetFeatureFlags();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    resetFeatureFlags();
  });

  it('retorna false por defecto para flags conocidos sin override ni env', () => {
    expect(service.isEnabled('PMC_ORCHESTRATOR_V2')).toBe(false);
    expect(service.isEnabled('PLANEACION_ORCHESTRATOR_V2')).toBe(false);
    expect(service.isEnabled('PAEC_ORCHESTRATOR_V2')).toBe(false);
    expect(service.isEnabled('CARTOGRAFIA_ORCHESTRATOR_V2')).toBe(false);
    expect(service.isEnabled('HORARIOS_ORCHESTRATOR_V2')).toBe(false);
  });

  it('permite sobrescribir banderas en memoria (override)', () => {
    service.setOverride('PMC_ORCHESTRATOR_V2', true);
    expect(service.isEnabled('PMC_ORCHESTRATOR_V2')).toBe(true);

    const evalResult = service.evaluate('PMC_ORCHESTRATOR_V2');
    expect(evalResult).toEqual({
      flag: 'PMC_ORCHESTRATOR_V2',
      enabled: true,
      source: 'override',
    });
  });

  it('permite limpiar un override específico y todos los overrides', () => {
    service.setOverride('PMC_ORCHESTRATOR_V2', true);
    service.setOverride('PAEC_ORCHESTRATOR_V2', true);

    service.clearOverride('PMC_ORCHESTRATOR_V2');
    expect(service.isEnabled('PMC_ORCHESTRATOR_V2')).toBe(false);
    expect(service.isEnabled('PAEC_ORCHESTRATOR_V2')).toBe(true);

    service.clearAllOverrides();
    expect(service.isEnabled('PAEC_ORCHESTRATOR_V2')).toBe(false);
  });

  it('resuelve correctamente desde variables de entorno con prefijo FEATURE_FLAG_', () => {
    process.env.FEATURE_FLAG_PMC_ORCHESTRATOR_V2 = 'true';
    expect(service.isEnabled('PMC_ORCHESTRATOR_V2')).toBe(true);

    const evalResult = service.evaluate('PMC_ORCHESTRATOR_V2');
    expect(evalResult.source).toBe('env');
    expect(evalResult.enabled).toBe(true);
  });

  it('resuelve correctamente desde variables de entorno con prefijo FF_', () => {
    process.env.FF_PLANEACION_ORCHESTRATOR_V2 = '1';
    expect(service.isEnabled('PLANEACION_ORCHESTRATOR_V2')).toBe(true);
  });

  it('interpreta valores truthy y falsy en variables de entorno', () => {
    const truthy = ['true', '1', 'yes', 'on', 'enabled'];
    for (const val of truthy) {
      process.env.FF_TEST_FLAG = val;
      expect(service.isEnabled('TEST_FLAG')).toBe(true);
    }

    const falsy = ['false', '0', 'no', 'off', 'disabled'];
    for (const val of falsy) {
      process.env.FF_TEST_FLAG = val;
      expect(service.isEnabled('TEST_FLAG')).toBe(false);
    }
  });

  it('da prioridad al override en memoria sobre las variables de entorno', () => {
    process.env.FEATURE_FLAG_PMC_ORCHESTRATOR_V2 = 'true';
    service.setOverride('PMC_ORCHESTRATOR_V2', false);

    expect(service.isEnabled('PMC_ORCHESTRATOR_V2')).toBe(false);
    expect(service.evaluate('PMC_ORCHESTRATOR_V2').source).toBe('override');
  });

  it('retorna defaultValue explícito si la bandera no está configurada', () => {
    expect(service.isEnabled('NON_EXISTENT_FLAG', true)).toBe(true);
    expect(service.isEnabled('NON_EXISTENT_FLAG', false)).toBe(false);
  });

  it('lista todas las banderas registradas con getAllFlags', () => {
    service.setOverride('CUSTOM_FLAG', true);
    const flags = service.getAllFlags();

    expect(flags.PMC_ORCHESTRATOR_V2).toBe(false);
    expect(flags.CUSTOM_FLAG).toBe(true);
    expect(typeof flags.PLANEACION_ORCHESTRATOR_V2).toBe('boolean');
  });

  it('opera correctamente con los helpers exportados del singleton global', () => {
    expect(featureFlags).toBeInstanceOf(FeatureFlagService);
    expect(isFeatureEnabled('PMC_ORCHESTRATOR_V2')).toBe(false);

    setFeatureFlag('PMC_ORCHESTRATOR_V2', true);
    expect(isFeatureEnabled('PMC_ORCHESTRATOR_V2')).toBe(true);

    resetFeatureFlags();
    expect(isFeatureEnabled('PMC_ORCHESTRATOR_V2')).toBe(false);
  });
});
