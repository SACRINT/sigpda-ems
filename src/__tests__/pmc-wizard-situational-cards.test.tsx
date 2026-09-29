/**
 * pmc-wizard-situational-cards.test.tsx
 *
 * Test para verificar que el Paso 3 del Wizard PMC NO muestra valores hardcodeados de Héroes de la Patria
 * cuando los indicadores académicos están vacíos (Hallazgo H-222 / Regla B-001).
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

vi.mock('@/components/assistant', () => ({
  useAssistant: () => ({ openAssistant: vi.fn() }),
}));

import PmcWizardClient from '@/app/[locale]/pmc/nuevo/PmcWizardClient';

describe('H-222: Paso 3 del Wizard sin datos de F11 muestra N/D sin valores hardcodeados de Héroes', () => {
  it('renderiza el Paso 3 con indicadores vacíos y NO contiene cifras de Héroes de la Patria', () => {
    const emptyProject = {
      id: 'project-test-empty',
      current_step: 3,
      school_name: 'Bachillerato General de Prueba',
      school_cct: '21EBH9999Z',
      indicadores_academicos: {},
    };

    const html = renderToString(
      <PmcWizardClient
        locale="es"
        teacherId="teacher-123"
        teacherName="Profesor de Prueba"
        teacherSchool="Bachillerato de Prueba"
        teacherMunicipality="Puebla"
        existingProject={emptyProject as Parameters<typeof PmcWizardClient>[0]['existingProject']}
      />
    );

    // No debe contener ninguno de los números mágicos ni conteos de Héroes de la Patria
    expect(html).not.toContain('83.1%');
    expect(html).not.toContain('70.9%');
    expect(html).not.toContain('12.2%');
    expect(html).not.toContain('11.6%');
    expect(html).not.toContain('5.3%');
    expect(html).not.toContain('157 alumnos');
    expect(html).not.toContain('134 alumnos');
    expect(html).not.toContain('23 alumnos');
    expect(html).not.toContain('22 alumnos');
    expect(html).not.toContain('10 alumnos');
    expect(html).not.toContain('Base: 189');

    // Debe contener el placeholder oficial N/D (falta F11)
    expect(html).toContain('N/D (falta F11)');
  });
});
