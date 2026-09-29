/**
 * pmc-h246-regression.test.ts
 *
 * Test de regresión para H-246 (P0: pérdida de datos en PUT con ingestCoverage),
 * H-247 (P2: sobreescritura de metas e ingestCoverage en POST por orden de spread),
 * H-252 (P3: limpieza de f11_warnings e ingest_coverage al recibir archivos limpios),
 * y H-254 (P3: verificación estricta del orden del spread en buildPmcSaveBody).
 */

import { describe, it, expect } from 'vitest';
import {
  buildIndicadoresPayload,
  buildPmcSaveBody,
  type IndicadoresAcademicos,
  type IngestCoverageData,
} from '@/app/[locale]/pmc/nuevo/PmcWizardClient';

describe('H-246 / H-247 / H-252 / H-254: Preservación de indicadores_academicos en POST y PUT', () => {
  const mockIndicadores: IndicadoresAcademicos = {
    matricula: 185,
    matriculaAnterior: 179,
    promedio_f11: 8.4,
    aprobacion_ant: 92.1,
    reprobacion_ant: 7.9,
    abandono_ant: 3.5,
    et_ant: 88.2,
  };

  const mockCoverage: IngestCoverageData = {
    detectados: 5,
    extraidos: 5,
    parcial: false,
  };

  it('Caso 1 (H-246 P0): PUT con coverage preserva TODOS los indicadores y metas en vez de reemplazarlos por {ingest_coverage}', () => {
    const indicadoresBody = buildIndicadoresPayload(mockIndicadores, true, mockCoverage);

    expect(indicadoresBody.et_ant).toBe(88.2);
    expect(indicadoresBody.matricula).toBe(185);
    expect(indicadoresBody.abandono_ant).toBe(3.5);
    expect(indicadoresBody.metas_confirmadas).toBe(true);
    expect(indicadoresBody.ingest_coverage).toEqual(mockCoverage);

    const keys = Object.keys(indicadoresBody);
    expect(keys.length).toBeGreaterThan(2);
    expect(keys).toContain('et_ant');
    expect(keys).toContain('metas_confirmadas');
    expect(keys).toContain('ingest_coverage');
  });

  it('Caso 2: PUT sin coverage preserva indicadores y metas_confirmadas sin clave ingest_coverage espuria', () => {
    const indicadoresBody = buildIndicadoresPayload(mockIndicadores, true, null);

    expect(indicadoresBody.et_ant).toBe(88.2);
    expect(indicadoresBody.matricula).toBe(185);
    expect(indicadoresBody.metas_confirmadas).toBe(true);
    expect(indicadoresBody.ingest_coverage).toBeUndefined();
  });

  it('Caso 3 (H-247 P2): POST con coverage incluye metas_confirmadas e ingest_coverage junto a los indicadores base', () => {
    const indicadoresBody = buildIndicadoresPayload(mockIndicadores, true, mockCoverage);

    expect(indicadoresBody.matricula).toBe(185);
    expect(indicadoresBody.metas_confirmadas).toBe(true);
    expect(indicadoresBody.ingest_coverage).toEqual(mockCoverage);
  });

  it('Caso 4: POST sin coverage incluye indicadores base y metas sin ingest_coverage', () => {
    const indicadoresBody = buildIndicadoresPayload(mockIndicadores, false, null);

    expect(indicadoresBody.matricula).toBe(185);
    expect(indicadoresBody.metas_confirmadas).toBe(false);
    expect(indicadoresBody.ingest_coverage).toBeUndefined();
  });

  it('Caso 5 (H-252 P3): Limpieza efectiva de f11_warnings e ingest_coverage al recibir estado limpio', () => {
    // Simula estado hidratado desde la BD que traía warnings y coverage previos:
    const hydratedIndicadores: IndicadoresAcademicos = {
      ...mockIndicadores,
      f11_warnings: ['Advertencia previa de columnas'],
      ingest_coverage: mockCoverage,
    };

    // El usuario sube un F11 limpio (f11Warnings = []) y no hay coverage nuevo (null):
    const cleanedBody = buildIndicadoresPayload(hydratedIndicadores, true, null, []);

    // Debe conservar los indicadores académicos
    expect(cleanedBody.et_ant).toBe(88.2);
    expect(cleanedBody.matricula).toBe(185);
    expect(cleanedBody.metas_confirmadas).toBe(true);

    // Debe haber ELIMINADO f11_warnings e ingest_coverage para que JSON.stringify no los emita
    expect(cleanedBody.f11_warnings).toBeUndefined();
    expect(cleanedBody.ingest_coverage).toBeUndefined();
    expect('f11_warnings' in cleanedBody).toBe(false);
    expect('ingest_coverage' in cleanedBody).toBe(false);

    // Serialización real a JSON confirma que las claves desaparecen:
    const serialized = JSON.parse(JSON.stringify(cleanedBody));
    expect(serialized.f11_warnings).toBeUndefined();
    expect(serialized.ingest_coverage).toBeUndefined();
  });

  it('Caso 6 (H-254 P3): buildPmcSaveBody en PUT (Paso 4→5) posiciona indicadoresBody tras ...payload', () => {
    const indicadoresBody = buildIndicadoresPayload(mockIndicadores, true, mockCoverage);
    const step4Payload = {
      diagnostico_generado: {
        presentacion: 'ok',
        contexto: 'ok',
        analisis_indicadores: 'ok',
        sintesis_foda: 'ok',
        priorizacion: 'ok',
      },
      status: 'completed',
      current_step: 5,
    };

    const putBody = buildPmcSaveBody('PUT', {}, step4Payload, indicadoresBody);
    const parsed = JSON.parse(JSON.stringify(putBody));

    expect(parsed.status).toBe('completed');
    expect(parsed.current_step).toBe(5);
    expect(parsed.indicadores_academicos).toBeDefined();
    // Verifica que indicadores_academicos no fue reemplazado por un objeto vacío o solo coverage
    expect(parsed.indicadores_academicos.et_ant).toBe(88.2);
    expect(parsed.indicadores_academicos.matricula).toBe(185);
    expect(parsed.indicadores_academicos.metas_confirmadas).toBe(true);
    expect(parsed.indicadores_academicos.ingest_coverage).toEqual(mockCoverage);
  });

  it('Caso 7 (H-254 P3): buildPmcSaveBody en POST (Paso 1→2) preserva metas e ingest_coverage aun si payload trae indicadores_academicos crudo', () => {
    const indicadoresBody = buildIndicadoresPayload(mockIndicadores, true, mockCoverage);
    const baseFields = { school_name: 'Bachillerato Emiliano Zapata', school_cct: '21EBH0001Z' };
    const step1PayloadWithRawIndicadores = {
      current_step: 2,
      // Si un call site enviara indicadores_academicos crudos (sin metas ni coverage):
      indicadores_academicos: { matricula: 185 },
    };

    const postBody = buildPmcSaveBody('POST', baseFields, step1PayloadWithRawIndicadores as Record<string, unknown>, indicadoresBody);
    const parsed = JSON.parse(JSON.stringify(postBody));

    // Debe prevalecer indicadoresBody enriquecido porque va DESPUÉS de ...payload
    expect(parsed.current_step).toBe(2);
    expect(parsed.indicadores_academicos.metas_confirmadas).toBe(true);
    expect(parsed.indicadores_academicos.ingest_coverage).toEqual(mockCoverage);
    expect(parsed.indicadores_academicos.et_ant).toBe(88.2);
  });
});
