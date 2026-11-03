import { describe, it, expect } from 'vitest';
import {
  DEFAULT_FECHAS_CORTES,
  resolveFechasCortes,
  buildFechasCortesPromptBlock,
} from '@/lib/fechas-cortes';
import { buildUserPrompt } from '@/lib/prompts/build-prompt';
import type { ExtractedPdfData, TeacherContext } from '@/types/planning';

const extractedData: ExtractedPdfData = {
  uacName: 'Dibujo Técnico I',
  learningOutcome: 'Representar objetos mediante proyecciones normalizadas.',
  totalHours: 54,
  activities: [],
  evidences: [],
  parseConfidence: 'high',
};

function makeContext(fechasCortes?: TeacherContext['fechasCortes']): TeacherContext {
  return {
    teacherName: 'Docente de Prueba',
    schoolName: 'Héroes de la Patria',
    cct: '21EBH0200X',
    municipality: 'Venustiano Carranza',
    state: 'Puebla',
    region: 'CORDE',
    subsystem: 'bge',
    groupInfo: '5°A',
    paecProblem: 'Manejo inadecuado de residuos en la comunidad.',
    studentContext: 'Estudiantes de bachillerato.',
    fechasCortes,
  };
}

describe('Fechas oficiales de cortes de evaluación', () => {
  it('usa los defaults oficiales 2026-2027', () => {
    expect(DEFAULT_FECHAS_CORTES).toEqual({
      corte1: 'Del 12 al 16 de octubre de 2026',
      corte2: 'Del 23 al 27 de noviembre de 2026',
      corte3: 'Del 25 al 29 de enero de 2027',
    });
  });

  it('rellena huecos vacíos con el default y respeta los overrides', () => {
    const fechas = resolveFechasCortes({
      corte1: '  1 al 5 de octubre de 2026  ',
      corte2: '',
      corte3: undefined,
    });
    expect(fechas.corte1).toBe('1 al 5 de octubre de 2026');
    expect(fechas.corte2).toBe(DEFAULT_FECHAS_CORTES.corte2);
    expect(fechas.corte3).toBe(DEFAULT_FECHAS_CORTES.corte3);
  });

  it('genera el bloque de prompt con las tres fechas', () => {
    const block = buildFechasCortesPromptBlock({
      corte1: 'A',
      corte2: 'B',
      corte3: 'C',
    });
    expect(block).toContain('Corte 1: A');
    expect(block).toContain('Corte 2: B');
    expect(block).toContain('Corte 3: C');
  });

  it('inyecta las fechas por defecto en el prompt de generación', () => {
    const prompt = buildUserPrompt(extractedData, makeContext(), 5, 'fundamental');
    expect(prompt).toContain(`Corte 1: ${DEFAULT_FECHAS_CORTES.corte1}`);
    expect(prompt).toContain(`Corte 2: ${DEFAULT_FECHAS_CORTES.corte2}`);
    expect(prompt).toContain(`Corte 3: ${DEFAULT_FECHAS_CORTES.corte3}`);
  });

  it('respeta fechas personalizadas por el docente en el prompt', () => {
    const prompt = buildUserPrompt(
      extractedData,
      makeContext({
        corte1: 'Del 5 al 9 de octubre de 2026',
        corte2: 'Del 16 al 20 de noviembre de 2026',
        corte3: 'Del 18 al 22 de enero de 2027',
      }),
      5,
      'fundamental'
    );
    expect(prompt).toContain('Corte 1: Del 5 al 9 de octubre de 2026');
    expect(prompt).toContain('Corte 2: Del 16 al 20 de noviembre de 2026');
    expect(prompt).toContain('Corte 3: Del 18 al 22 de enero de 2027');
  });
});
