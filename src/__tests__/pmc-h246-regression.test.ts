/**
 * pmc-h246-regression.test.ts
 *
 * Test de regresión para H-246 (P0: pérdida de datos en PUT con ingestCoverage)
 * y H-247 (P2: sobreescritura de metas e ingestCoverage en POST por orden de spread).
 *
 * Verifica los 4 casos:
 * 1. PUT con coverage (Paso 4→5: payload sin indicadores_academicos)
 * 2. PUT sin coverage (Paso 2→3: payload sin indicadores_academicos)
 * 3. POST con coverage (Paso 1→2: creación inicial con PMC anterior subido)
 * 4. POST sin coverage (Paso 1→2: creación inicial manual)
 */

import { describe, it, expect } from 'vitest';
import {
  buildIndicadoresPayload,
  type IndicadoresAcademicos,
  type IngestCoverageData,
} from '@/app/[locale]/pmc/nuevo/PmcWizardClient';

describe('H-246 / H-247: Preservación de indicadores_academicos en POST y PUT', () => {
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
    // Al avanzar del paso 4 al 5 (guardado final status: "completed"),
    // el payload NO incluye indicadores_academicos.
    const indicadoresBody = buildIndicadoresPayload(mockIndicadores, true, mockCoverage);

    expect(indicadoresBody.et_ant).toBe(88.2);
    expect(indicadoresBody.matricula).toBe(185);
    expect(indicadoresBody.abandono_ant).toBe(3.5);
    expect(indicadoresBody.metas_confirmadas).toBe(true);
    expect(indicadoresBody.ingest_coverage).toEqual(mockCoverage);

    // Verificación de que no es un objeto que contenga SOLO ingest_coverage
    const keys = Object.keys(indicadoresBody);
    expect(keys.length).toBeGreaterThan(2);
    expect(keys).toContain('et_ant');
    expect(keys).toContain('metas_confirmadas');
    expect(keys).toContain('ingest_coverage');
  });

  it('Caso 2: PUT sin coverage preserva indicadores y metas_confirmadas sin clave ingest_coverage espuria', () => {
    // Paso 2→3 o guardado donde no se cargó PMC previo
    const indicadoresBody = buildIndicadoresPayload(mockIndicadores, true, null);

    expect(indicadoresBody.et_ant).toBe(88.2);
    expect(indicadoresBody.matricula).toBe(185);
    expect(indicadoresBody.metas_confirmadas).toBe(true);
    expect(indicadoresBody.ingest_coverage).toBeUndefined();
  });

  it('Caso 3 (H-247 P2): POST con coverage incluye metas_confirmadas e ingest_coverage junto a los indicadores base', () => {
    // Creación de proyecto (Paso 1→2 con PMC previo cargado)
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

  it('Demuestra el fallo de la lógica previa de H-246 (antipatrón de sobrescritura parcial)', () => {
    // Simula exactamente lo que hacía PmcWizardClient.tsx antes del fix en PUT (líneas 1520-1525):
    // const putPayload = {
    //   ...payload,
    //   ...(ingestCoverage ? {
    //     indicadores_academicos: {
    //       ...(typeof payload.indicadores_academicos === 'object' ? payload.indicadores_academicos : {}),
    //       ingest_coverage: ingestCoverage,
    //     },
    //   } : {}),
    // };
    const step4Payload: Record<string, unknown> = {
      diagnostico_generado: { texto: 'ok' },
      status: 'completed',
      current_step: 5,
    }; // NO trae indicadores_academicos

    // Lógica defectuosa previa:
    const flawedPutIndicadores = mockCoverage ? {
      ...(typeof step4Payload.indicadores_academicos === 'object' ? (step4Payload.indicadores_academicos as object) : {}),
      ingest_coverage: mockCoverage,
    } : undefined;

    // La lógica defectuosa producía SOLO { ingest_coverage: ... }
    expect((flawedPutIndicadores as Record<string, unknown>).et_ant).toBeUndefined();
    expect((flawedPutIndicadores as Record<string, unknown>).matricula).toBeUndefined();
    expect((flawedPutIndicadores as Record<string, unknown>).metas_confirmadas).toBeUndefined();

    // En contraste, la nueva lógica basada en buildIndicadoresPayload retiene todo:
    const fixedPutIndicadores = buildIndicadoresPayload(mockIndicadores, true, mockCoverage);
    expect(fixedPutIndicadores.et_ant).toBe(88.2);
    expect(fixedPutIndicadores.matricula).toBe(185);
    expect(fixedPutIndicadores.metas_confirmadas).toBe(true);
    expect(fixedPutIndicadores.ingest_coverage).toEqual(mockCoverage);
  });
});
