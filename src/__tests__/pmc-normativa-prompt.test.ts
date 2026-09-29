/**
 * pmc-normativa-prompt.test.ts
 *
 * Pruebas unitarias para la inyección de marco normativo curado en prompts de PMC (M4b).
 * Valida:
 * 1. Inyección de bloque normativo en buildPmcDiagnosticoPrompt cuando hay documentos.
 * 2. Inyección de bloque normativo en buildPmcPlanAccionPrompt cuando hay documentos.
 * 3. Comportamiento seguro (fail-open) cuando la lista de documentos es vacía o nula.
 * 4. Respeto del límite de tokens (~1500 tokens) para evitar saturación del contexto.
 */

import { describe, it, expect } from 'vitest';
import {
  buildPmcDiagnosticoPrompt,
  buildPmcPlanAccionPrompt,
  formatNormativaContextForPrompt,
  type NormativaArticuloPromptItem,
} from '@/lib/prompts/pmc-prompts';
import type { PmcProject } from '@/types/pmc';

describe('M4b: Marco Normativo Curado en Prompts de PMC', () => {
  const mockProject: PmcProject = {
    id: 'pmc-test-01',
    teacher_id: 'teacher-01',
    school_name: 'Bachillerato General Estatal Héroes de la Patria',
    school_cct: '21EBH0200X',
    school_zone: '004',
    municipality: 'Puebla',
    locality: 'Heroica Puebla de Zaragoza',
    ciclo_escolar: '2026-2027',
    director_name: 'Dr. Roberto Mendoza',
    diagnostico_comunidad: 'Comunidad urbana con acceso a servicios básicos.',
    indicadores_academicos: JSON.stringify({
      matricula: 189,
      abandono_ant: 4.8,
      et_ant: 88.5,
      aprobacion_ant: 92.1,
      reprobacion_ant: 7.9,
    }),
    foda: JSON.stringify({
      fortalezas: ['Docentes comprometidos'],
      oportunidades: ['Vinculación comunitaria'],
      debilidades: ['Bajo rendimiento en Pensamiento Matemático'],
      amenazas: ['Deserción por factores económicos'],
    }),
    categorias_priorizadas: JSON.stringify([
      { id: '1', nombre: 'Apropiación Curricular', temas: ['Pensamiento Matemático'] },
    ]),
    staff_data: JSON.stringify([]),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const sampleNormativa: NormativaArticuloPromptItem[] = [
    {
      orden: 1,
      titulo: 'Constitución Política de los Estados Unidos Mexicanos',
      articulos: ['Art. 3°'],
      justificacion: 'Garantiza el derecho humano a la educación obligatoria, universal, inclusiva y laica.',
    },
    {
      orden: 2,
      titulo: 'Ley General de Educación (2019)',
      articulos: ['Art. 14', 'Art. 16', 'Art. 18'],
      justificacion: 'Establece los fines de la educación nacional y la rectoría estatal en la mejora continua.',
    },
    {
      orden: 3,
      titulo: 'Acuerdo Secretarial 09/08/23 (MCCEMS)',
      articulos: ['Art. 5', 'Art. 12'],
      justificacion: 'Norma las 8 categorías de gestión educativa del MCCEMS y progresiones formativas.',
    },
  ];

  describe('formatNormativaContextForPrompt', () => {
    it('formatea correctamente los artículos y justificaciones en texto plano estructurado', () => {
      const block = formatNormativaContextForPrompt(sampleNormativa);

      expect(block).toContain('MARCO NORMATIVO OFICIAL CURADO VINCULADO AL PMC');
      expect(block).toContain('Constitución Política de los Estados Unidos Mexicanos (Art. 3°)');
      expect(block).toContain('Ley General de Educación (2019) (Art. 14, Art. 16, Art. 18)');
      expect(block).toContain('Acuerdo Secretarial 09/08/23 (MCCEMS)');
      expect(block).toContain('Garantiza el derecho humano a la educación');
    });

    it('retorna cadena vacía cuando el arreglo está vacío o es nulo (fail-open)', () => {
      expect(formatNormativaContextForPrompt([])).toBe('');
      expect(formatNormativaContextForPrompt(null)).toBe('');
      expect(formatNormativaContextForPrompt(undefined)).toBe('');
    });

    it('respeta el límite de caracteres según el presupuesto de tokens', () => {
      // Generar 100 documentos simulados para superar el presupuesto
      const largeNormativa: NormativaArticuloPromptItem[] = Array.from({ length: 100 }, (_, i) => ({
        orden: i + 1,
        titulo: `Documento Jurídico Extenso Número ${i + 1}`,
        articulos: [`Art. ${i + 1}`],
        justificacion: `Justificación regulatoria sumamente detallada para el documento ${i + 1} con fundamentación legal exhaustiva.`,
      }));

      const block = formatNormativaContextForPrompt(largeNormativa, 500); // 500 tokens * 4 = 2000 chars
      expect(block.length).toBeLessThanOrEqual(2500);
      expect(block).toContain('MARCO NORMATIVO OFICIAL CURADO');
    });
  });

  describe('buildPmcDiagnosticoPrompt con normativa', () => {
    it('incluye el bloque normativo oficial cuando se proporciona la lista de documentos', () => {
      const promptConNormativa = buildPmcDiagnosticoPrompt(mockProject, undefined, undefined, sampleNormativa);

      expect(promptConNormativa).toContain('MARCO NORMATIVO OFICIAL CURADO VINCULADO AL PMC');
      expect(promptConNormativa).toContain('Constitución Política de los Estados Unidos Mexicanos (Art. 3°)');
      expect(promptConNormativa).toContain('INFORMACIÓN GENERAL DEL PLANTEL:');
    });

    it('no incluye el bloque normativo ni genera errores cuando no hay documentos (BD vacía o fallback)', () => {
      const promptSinNormativa = buildPmcDiagnosticoPrompt(mockProject, undefined, undefined, []);

      expect(promptSinNormativa).not.toContain('MARCO NORMATIVO OFICIAL CURADO VINCULADO AL PMC');
      expect(promptSinNormativa).toContain('INFORMACIÓN GENERAL DEL PLANTEL:');
    });
  });

  describe('buildPmcPlanAccionPrompt con normativa', () => {
    it('incluye el bloque normativo oficial en el plan de acción cuando se proporciona', () => {
      const promptConNormativa = buildPmcPlanAccionPrompt(mockProject, undefined, undefined, sampleNormativa);

      expect(promptConNormativa).toContain('MARCO NORMATIVO OFICIAL CURADO VINCULADO AL PMC');
      expect(promptConNormativa).toContain('Acuerdo Secretarial 09/08/23 (MCCEMS)');
      expect(promptConNormativa).toContain('DATOS OFICIALES DEL PLANTEL:');
    });

    it('no incluye el bloque normativo cuando la lista es vacía o nula', () => {
      const promptSinNormativa = buildPmcPlanAccionPrompt(mockProject, undefined, undefined, null);

      expect(promptSinNormativa).not.toContain('MARCO NORMATIVO OFICIAL CURADO VINCULADO AL PMC');
      expect(promptSinNormativa).toContain('DATOS OFICIALES DEL PLANTEL:');
    });
  });
});
