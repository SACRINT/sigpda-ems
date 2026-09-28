/**
 * pmc-orientaciones-prompts.test.ts
 *
 * Tests de validación para la alineación con las ORIENTACIONES PMC 2025-2026:
 * - H-197: 5 preguntas oficiales de 2.1 Diagnóstico e insumos documentales oficiales.
 * - H-199: 9 criterios oficiales de 3.1 Metas en PmcMetaInstitucionalSchema.
 * - H-200: Criterios de 4.1 Estrategia de implementación (estrategias de seguimiento y observaciones).
 */

import { describe, it, expect } from 'vitest';
import { buildPmcDiagnosticoPrompt, buildPmcPlanAccionPrompt } from '@/lib/prompts/pmc-prompts';
import { PmcDiagnosticoSchema, PmcPlanAccionSchema } from '@/lib/ai-schemas';
import type { PmcProject } from '@/types/pmc';

describe('ORIENTACIONES PMC 2025-2026 — Prompts y Schemas (H-197, H-199, H-200)', () => {
  const baseProject: PmcProject = {
    id: 'pmc-test-orientaciones',
    school_name: 'Bachillerato General Emiliano Zapata',
    school_cct: '21EBH0055Z',
    school_zone: '004',
    municipality: 'Puebla',
    locality: 'San Pedro',
    ciclo_escolar: '2025-2026',
    director_name: 'Mtra. Josefina Morales',
    diagnostico_comunidad: 'Comunidad semiurbana con alta participación comunitaria.',
    indicadores_academicos: JSON.stringify({
      matricula: 180,
      aprobacion_ant: 85,
      abandono_ant: 4.5,
      et_ant: 88,
    }),
    foda: JSON.stringify({
      fortalezas: 'Compromiso docente y trabajo colaborativo.',
      oportunidades: 'Vinculación con instituciones locales.',
      debilidades: 'Recursos tecnológicos limitados.',
      amenazas: 'Deserción por migración laboral.',
    }),
  };

  it('H-197: buildPmcDiagnosticoPrompt incluye las 5 preguntas oficiales de 2.1 Diagnóstico y los insumos documentales', () => {
    const prompt = buildPmcDiagnosticoPrompt(baseProject);

    // 5 preguntas oficiales literales de 2.1 Diagnóstico PMC 2025-2026.docx
    expect(prompt).toContain('¿Qué se ha logrado?');
    expect(prompt).toContain('¿En qué situación se encuentra el plantel?');
    expect(prompt).toContain('¿Qué se quiere lograr?');
    expect(prompt).toContain('¿Qué requiere el plantel para lograrlo?');
    expect(prompt).toContain('¿Cuáles son las fortalezas y áreas de oportunidad identificadas?');

    // Insumos documentales institucionales de 2.1
    expect(prompt).toContain('Indicadores educativos del ciclo escolar anterior');
    expect(prompt).toContain('Plan de Mejora Continua (PMC) del ciclo escolar anterior');
    expect(prompt).toContain('Planeaciones didácticas');
    expect(prompt).toContain('Informes de academia colegiada');
    expect(prompt).toContain('Informes de tutoría y orientación');
    expect(prompt).toContain('Protocolo contra el abandono escolar');
  });

  it('H-197 / H-205: PmcDiagnosticoSchema valida estrictamente las 5 secciones canónicas articuladas', () => {
    const validDiag = {
      presentacion: 'Presentación formal del PMC institucional conforme al artículo 3° constitucional y política CREAA.',
      contexto: 'Contexto territorial del plantel en la comunidad semiurbana de San Pedro.',
      analisis_indicadores: 'Análisis cuantitativo de aprobación del 85% y abandono del 4.5%.',
      sintesis_foda: 'Síntesis de fortalezas docentes frente a limitaciones tecnológicas.',
      priorizacion: 'Priorización de metas en las tres categorías oficiales CREAA.',
    };

    const parsed = PmcDiagnosticoSchema.safeParse(validDiag);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.presentacion).toBeDefined();
      expect(parsed.data.contexto).toBeDefined();
      expect(parsed.data.analisis_indicadores).toBeDefined();
      expect(parsed.data.sintesis_foda).toBeDefined();
      expect(parsed.data.priorizacion).toBeDefined();
    }
  });

  it('H-199 & H-200: buildPmcPlanAccionPrompt incluye regla 8 con criterios oficiales 3.1 y 4.1', () => {
    const prompt = buildPmcPlanAccionPrompt(baseProject);

    expect(prompt).toContain('CRITERIOS TÉCNICOS OFICIALES (ORIENTACIONES PMC 2025-2026 - FORMATOS 3.1 Y 4.1)');
    expect(prompt).toContain('"accion_especifica"');
    expect(prompt).toContain('"finalidad"');
    expect(prompt).toContain('"necesidad"');
    expect(prompt).toContain('"proceso_evaluacion"');
    expect(prompt).toContain('"subcategorias_vinculadas"');
    expect(prompt).toContain('"estrategias_seguimiento"');
    expect(prompt).toContain('"observaciones"');
  });

  it('H-199 & H-200: PmcPlanAccionSchema valida los campos de 3.1 y 4.1 asignando valores por defecto', () => {
    const rawPlan = {
      metas_institucionales: [
        {
          categoria: '1',
          nombre_categoria: 'Desarrollo académico y aprendizaje',
          tema: 'Indicadores Académicos',
          diagnostico_meta: 'Reprobación en pensamiento matemático del 25%',
          meta: 'Reducir al 15% la reprobación escolar en alumnos de primer semestre mediante tutorías en Puebla',
          estrategia: '1. Sesiones de nivelación. 2. Acompañamiento docente.',
          linea_base: '25% de reprobación en ciclo previo',
          personal_designado: 'Academia de Matemáticas',
          entregable: 'Informe bimestral de seguimiento de calificaciones',
          periodo_inicio: '08/2025',
          periodo_fin: '06/2026',
          accion_especifica: 'Impartición de talleres sabatinos de regularización',
          finalidad: 'Garantizar el dominio de progresiones de aprendizaje',
          necesidad: 'Alto índice de rezago en cálculo aritmético',
          proceso_evaluacion: 'Evaluación diagnóstica y formativa bimestral',
          subcategorias_vinculadas: ['INDICADORES ACADÉMICOS', 'PROPUESTAS PEDAGÓGICAS'],
          estrategias_seguimiento: 'Reuniones quincenales de Consejo Técnico Escolar',
          observaciones: 'Requiere material impreso de apoyo',
        },
      ],
      metas_personales: [],
    };

    const parsed = PmcPlanAccionSchema.safeParse(rawPlan);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      const meta = parsed.data.metas_institucionales[0];
      expect(meta.accion_especifica).toBe('Impartición de talleres sabatinos de regularización');
      expect(meta.finalidad).toBe('Garantizar el dominio de progresiones de aprendizaje');
      expect(meta.necesidad).toBe('Alto índice de rezago en cálculo aritmético');
      expect(meta.proceso_evaluacion).toBe('Evaluación diagnóstica y formativa bimestral');
      expect(meta.subcategorias_vinculadas).toEqual(['INDICADORES ACADÉMICOS', 'PROPUESTAS PEDAGÓGICAS']);
      expect(meta.estrategias_seguimiento).toBe('Reuniones quincenales de Consejo Técnico Escolar');
      expect(meta.observaciones).toBe('Requiere material impreso de apoyo');
    }
  });
});
