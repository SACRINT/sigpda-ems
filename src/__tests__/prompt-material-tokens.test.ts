import { describe, it, expect } from 'vitest';
import { SYSTEM_PROMPT } from '@/lib/prompts/system-prompt';
import { buildUserPrompt } from '@/lib/prompts/build-prompt';
import type { ExtractedPdfData, TeacherContext } from '@/types/planning';

describe('prompt-material-tokens — Integración de tokens de materiales en prompts', () => {
  const minimalExtractedData: ExtractedPdfData = {
    uacName: 'Física I',
    learningOutcome: 'Comprender los principios de instrumentación y mecánica',
    totalHours: 48,
    activities: [],
    evidences: [],
    parseConfidence: 'high',
  };

  const minimalContext: TeacherContext = {
    teacherName: 'Profesor de Prueba',
    schoolName: 'Bachillerato General Oficial',
    subsystem: 'bge',
    municipality: 'Puebla',
    state: 'Puebla',
    region: 'Puebla',
    paecProblem: 'Eficiencia energética en la comunidad escolar',
    groupInfo: 'Grupo 1-A',
    studentContext: 'Zona semiurbana con acceso limitado a laboratorios especializados',
  };

  it('SYSTEM_PROMPT contiene [[material:slug]] pero NO el índice completo de 244 materiales', () => {
    expect(SYSTEM_PROMPT).toContain('[[material:slug]]');
    expect(SYSTEM_PROMPT).toContain('TOKENS DE MATERIALES');
    // No debe contener el listado completo de items
    expect(SYSTEM_PROMPT).not.toContain('INDICE DE MATERIALES AUTORIZADOS');
    expect(SYSTEM_PROMPT).not.toContain('- multimetro — ');
    expect(SYSTEM_PROMPT).not.toContain('- probeta — ');
  });

  it('buildUserPrompt contiene "- multimetro — " y termina con la instrucción "Responde ÚNICAMENTE"', () => {
    const prompt = buildUserPrompt(
      minimalExtractedData,
      minimalContext,
      2,
      'fundamental'
    );

    expect(prompt).toContain('INDICE DE MATERIALES AUTORIZADOS');
    expect(prompt).toContain('- multimetro — ');
    expect(prompt.trim().endsWith(
      'Responde ÚNICAMENTE con el objeto JSON válido que cumpla la estructura exacta solicitada en el system prompt.'
    )).toBe(true);
  });

  it('longitud total del prompt de usuario es razonable (<= 40,000 caracteres)', () => {
    const prompt = buildUserPrompt(
      minimalExtractedData,
      minimalContext,
      2,
      'fundamental'
    );
    expect(prompt.length).toBeLessThanOrEqual(40000);
  });
});
