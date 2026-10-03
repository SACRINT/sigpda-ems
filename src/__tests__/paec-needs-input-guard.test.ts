// src/__tests__/paec-needs-input-guard.test.ts
/**
 * Test suite para H-314: Guard Anti-Fabricación de Insumos (needsInput)
 * Valida que ante falta de datos indispensables en Paso 1 (contexto comunitario)
 * o Paso 8 (figuras del comité), el sistema emita needsInput sin alucinar datos.
 */

import { describe, it, expect } from 'vitest';
import { validatePaecStepInputs } from '@/lib/paec-input-guard';

describe('H-314: validatePaecStepInputs (Guard Anti-Fabricación de Insumos)', () => {
  describe('Paso 1: Diagnóstico Colectivo', () => {
    it('1. Retorna needsInput: true si faltan tanto el planteamiento del problema como el contexto comunitario', () => {
      const emptyProject = {
        project_name: 'Proyecto Sin Datos',
        problem_statement: '',
        community_context: {},
      };

      const result = validatePaecStepInputs(1, emptyProject);

      expect(result.needsInput).toBe(true);
      expect(result.missingFields).toContain('problemStatement');
      expect(result.missingFields).toContain('communityContext');
      expect(result.message).toContain('Para generar el Diagnóstico Colectivo oficial');
    });

    it('2. Retorna needsInput: true si falta el contexto comunitario (solo se proveyó el problema)', () => {
      const projectWithOnlyProblem = {
        problem_statement: 'Deforestación severa en los linderos del ejido escolar.',
        community_context: {},
      };

      const result = validatePaecStepInputs(1, projectWithOnlyProblem);
      expect(result.needsInput).toBe(true);
      expect(result.missingFields).toContain('communityContext');
      expect(result.missingFields).not.toContain('problemStatement');
    });

    it('3. Pasa con needsInput: false si se proveen tanto el problema como al menos un dato comunitario', () => {
      const projectWithBoth = {
        problem_statement: 'Contaminación por plásticos en el río local.',
        community_context: {
          location: 'San Jerónimo Caleras, Puebla',
        },
      };

      const result = validatePaecStepInputs(1, projectWithBoth);
      expect(result.needsInput).toBe(false);
      expect(result.missingFields).toHaveLength(0);
    });

    it('4. Omite la restricción si allowPartialGeneration es true (Bypass controlado)', () => {
      const emptyProject = {
        problem_statement: '',
        community_context: {},
      };

      const result = validatePaecStepInputs(1, emptyProject, { allowPartialGeneration: true });
      expect(result.needsInput).toBe(false);
      expect(result.missingFields).toHaveLength(0);
    });
  });

  describe('Paso 8: Formalización y Comité Escolar (Criterio 1)', () => {
    it('5. Retorna needsInput: true si no se especifican figuras del comité en Paso 8', () => {
      const projectWithoutComite = {
        school_context: {
          schoolName: 'Bachillerato General Oficial',
        },
      };

      const result = validatePaecStepInputs(8, projectWithoutComite);

      expect(result.needsInput).toBe(true);
      expect(result.missingFields).toContain('comite.responsablePlantel');
      expect(result.missingFields).toContain('comite.docentes');
      expect(result.missingFields).toContain('comite.estudiantes');
      expect(result.missingFields).toContain('comite.padresFamilia');
      expect(result.message).toContain('Criterio 1 del MCCEMS');
    });

    it('6. Pasa con needsInput: false si se especifican las figuras del comité', () => {
      const projectWithComite = {
        school_context: {
          comite: {
            directivo: 'Mtra. Patricia Morales',
            docentes: 'Prof. Carlos R., Profra. Ana M.',
            estudiantes: 'Juan P., Sofía T.',
            padres: 'Sra. Elena Ramos',
          },
        },
      };

      const result = validatePaecStepInputs(8, projectWithComite);
      expect(result.needsInput).toBe(false);
      expect(result.missingFields).toHaveLength(0);
    });

    it('7. Omite la restricción en Paso 8 si allowPartialGeneration es true', () => {
      const projectWithoutComite = {
        school_context: {},
      };

      const result = validatePaecStepInputs(8, projectWithoutComite, { allowPartialGeneration: true });
      expect(result.needsInput).toBe(false);
      expect(result.missingFields).toHaveLength(0);
    });
  });

  describe('Pasos Intermedios (Pasos 2 a 7 y 9)', () => {
    it('8. No bloquea pasos intermedios que dependen de etapas previas estructuradas', () => {
      const project = { id: 'test' };
      for (const step of [2, 3, 4, 5, 6, 7, 9]) {
        const result = validatePaecStepInputs(step, project);
        expect(result.needsInput).toBe(false);
        expect(result.missingFields).toHaveLength(0);
      }
    });
  });
});
