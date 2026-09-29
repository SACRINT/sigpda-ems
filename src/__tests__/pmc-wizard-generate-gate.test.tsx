/**
 * pmc-wizard-generate-gate.test.tsx
 *
 * Pruebas unitarias para la validación y bloqueo de generación con IA (H-227 / A6)
 * cuando la cobertura de extracción del PMC anterior es parcial (<90%) o las metas no están confirmadas.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import PmcWizardClient, { validateCanGenerateStep } from '@/app/[locale]/pmc/nuevo/PmcWizardClient';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

vi.mock('@/components/assistant', () => ({
  useAssistant: () => ({ openAssistant: vi.fn() }),
}));

describe('H-227: Bloqueo de generación de pasos por metas no confirmadas o cobertura parcial (<90%)', () => {
  it('bloquea diagnóstico si metas no están confirmadas', () => {
    const res = validateCanGenerateStep('diagnostico', false, null);
    expect(res.allowed).toBe(false);
    expect(res.error).toContain('Debes confirmar las metas del ciclo en el Paso 3');
  });

  it('bloquea plan de acción si metas no están confirmadas', () => {
    const res = validateCanGenerateStep('plan_accion', false, { parcial: false });
    expect(res.allowed).toBe(false);
    expect(res.error).toContain('Debes confirmar las metas del ciclo en el Paso 3');
  });

  it('bloquea diagnóstico si metasConfirmadas=true pero ingestCoverage.parcial=true', () => {
    const res = validateCanGenerateStep('diagnostico', true, { parcial: true });
    expect(res.allowed).toBe(false);
    expect(res.error).toContain('cobertura de extracción parcial (<90%)');
  });

  it('bloquea plan de acción si metasConfirmadas=true pero ingestCoverage.parcial=true', () => {
    const res = validateCanGenerateStep('plan_accion', true, { parcial: true });
    expect(res.allowed).toBe(false);
    expect(res.error).toContain('cobertura de extracción parcial (<90%)');
  });

  it('permite diagnóstico y plan de acción cuando metasConfirmadas=true y cobertura no es parcial', () => {
    const resDiag = validateCanGenerateStep('diagnostico', true, { parcial: false });
    expect(resDiag.allowed).toBe(true);

    const resPlan = validateCanGenerateStep('plan_accion', true, null);
    expect(resPlan.allowed).toBe(true);
  });

  it('permite normativa independientemente de metas o cobertura parcial', () => {
    const resNorm = validateCanGenerateStep('normativa', false, { parcial: true });
    expect(resNorm.allowed).toBe(true);
  });

  it('renderiza banner de advertencia en Paso 4 cuando el proyecto tiene cobertura parcial', () => {
    // H-238: ingest_coverage is embedded inside indicadores_academicos (the existing JSONB column)
    // so it survives GET (SELECT *) → F5 without requiring a new DB column.
    const projectWithPartialCoverage = {
      id: 'project-partial-coverage',
      current_step: 4,
      school_name: 'Bachillerato de Cobertura Parcial',
      school_cct: '21EBH9999Z',
      indicadores_academicos: {
        metas_confirmadas: true,
        // H-238: stored here, not at top level — this is what the server actually returns
        ingest_coverage: {
          detectados: 50,
          extraidos: 20,
          parcial: true,
        },
      },
    };

    const html = renderToString(
      <PmcWizardClient
        locale="es"
        teacherId="teacher-123"
        teacherName="Profesor de Prueba"
        teacherSchool="Bachillerato de Prueba"
        teacherMunicipality="Puebla"
        existingProject={projectWithPartialCoverage as unknown as Parameters<typeof PmcWizardClient>[0]['existingProject']}
      />
    );

    // Debe mostrar la advertencia de cobertura parcial en el Paso 4
    expect(html).toContain('cobertura de extracción parcial (&lt;90%)');
  });
});
