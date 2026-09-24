/**
 * pmc-prompts-staff.test.ts
 * 
 * Tests de regresión para parseo y validación de staff_data en pmc-prompts.ts (TD-P1-001).
 * Verifica que elementos nulos, estructuras malformadas o JSON corrupto
 * no provoquen excepciones y se procesen de forma resiliente.
 */

import { describe, it, expect } from 'vitest';
import { buildPmcPlanAccionPrompt } from '@/lib/prompts/pmc-prompts';
import type { PmcProject } from '@/types/pmc';

describe('buildPmcPlanAccionPrompt — staff_data resilience (TD-P1-001)', () => {
  const baseProject: PmcProject = {
    id: 'pmc-test-123',
    teacher_id: 'teacher-1',
    school_name: 'Bachillerato General Ignacio Zaragoza',
    school_cct: '21EBH0001Z',
    school_zone: '004',
    municipality: 'Puebla',
    locality: 'Puebla',
    ciclo_escolar: '2026-2027',
    current_step: 3,
    status: 'draft',
    director_name: 'Mtro. Roberto Hernández',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  it('procesa correctamente staff_data con elementos null y metas_individuales con null sin crashear', () => {
    const payload = JSON.stringify([
      null,
      {
        nombre: 'Prof. Xóchitl Morales',
        cargo: 'Docente de Matemáticas',
        metas_individuales: [
          null,
          {
            categoria: 'Apropiación Curricular',
            tema: 'Pensamiento Matemático',
            meta: 'Disminuir reprobación al 8%',
            estrategia: 'Tutoría entre pares',
          },
        ],
      },
    ]);

    const projectWithStaff = {
      ...baseProject,
      staff_data: payload,
    };

    let prompt = '';
    expect(() => {
      prompt = buildPmcPlanAccionPrompt(projectWithStaff);
    }).not.toThrow();

    expect(prompt).toContain('Prof. Xóchitl Morales');
    expect(prompt).toContain('Docente de Matemáticas');
    expect(prompt).toContain('Disminuir reprobación al 8%');
    expect(prompt).toContain('Tutoría entre pares');
  });

  it('maneja JSON corrupto en staff_data sin crashear y recurre al personal predeterminado', () => {
    const projectCorrupt = {
      ...baseProject,
      staff_data: '{ corrupt json: [[',
    };

    let prompt = '';
    expect(() => {
      prompt = buildPmcPlanAccionPrompt(projectCorrupt);
    }).not.toThrow();

    expect(prompt).toContain('Mtro. Roberto Hernández');
    expect(prompt).toContain('Colectivo Docente');
  });

  it('maneja objeto no-array en staff_data recurriendo al personal predeterminado', () => {
    const projectNonArray = {
      ...baseProject,
      staff_data: JSON.stringify({ not: 'an array', foo: 'bar' }),
    };

    let prompt = '';
    expect(() => {
      prompt = buildPmcPlanAccionPrompt(projectNonArray);
    }).not.toThrow();

    expect(prompt).toContain('Mtro. Roberto Hernández');
    expect(prompt).toContain('Colectivo Docente');
  });

  it('maneja array compuesto únicamente de elementos nulos', () => {
    const projectOnlyNulls = {
      ...baseProject,
      staff_data: JSON.stringify([null, null]),
    };

    let prompt = '';
    expect(() => {
      prompt = buildPmcPlanAccionPrompt(projectOnlyNulls);
    }).not.toThrow();

    expect(prompt).toContain('Mtro. Roberto Hernández');
  });
});
