/**
 * Pruebas Unitarias: SecuenciaGenerateInputSchema — SIGPDA-EMS
 *
 * Valida el esquema Zod de entrada para el endpoint POST /api/planeaciones/[id]/secuencia.
 * Asegura que blockIndex sea un entero >= 0 y totalHours (opcional) sea un entero positivo.
 */

import { describe, it, expect } from 'vitest';
import { SecuenciaGenerateInputSchema, SecuenciaUpdateInputSchema } from '@/lib/ai-schemas';

describe('SecuenciaGenerateInputSchema — Validación de Entrada POST Secuencia', () => {
  it('debe aceptar payload válido con solo blockIndex = 0', () => {
    const input = { blockIndex: 0 };
    const result = SecuenciaGenerateInputSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.blockIndex).toBe(0);
      expect(result.data.totalHours).toBeUndefined();
    }
  });

  it('debe aceptar payload válido con blockIndex positivo y totalHours válido', () => {
    const input = { blockIndex: 2, totalHours: 18 };
    const result = SecuenciaGenerateInputSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.blockIndex).toBe(2);
      expect(result.data.totalHours).toBe(18);
    }
  });

  it('debe rechazar cuando falta blockIndex', () => {
    const input = { totalHours: 12 };
    const result = SecuenciaGenerateInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('debe rechazar blockIndex negativo', () => {
    const input = { blockIndex: -1 };
    const result = SecuenciaGenerateInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('debe rechazar blockIndex con punto flotante', () => {
    const input = { blockIndex: 1.5 };
    const result = SecuenciaGenerateInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('debe rechazar blockIndex de tipo string', () => {
    const input = { blockIndex: '0' };
    const result = SecuenciaGenerateInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('debe rechazar totalHours igual a 0', () => {
    const input = { blockIndex: 0, totalHours: 0 };
    const result = SecuenciaGenerateInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('debe rechazar totalHours negativo', () => {
    const input = { blockIndex: 0, totalHours: -4 };
    const result = SecuenciaGenerateInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('debe rechazar totalHours con punto flotante', () => {
    const input = { blockIndex: 0, totalHours: 12.5 };
    const result = SecuenciaGenerateInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('debe rechazar entradas que no son objetos', () => {
    expect(SecuenciaGenerateInputSchema.safeParse(null).success).toBe(false);
    expect(SecuenciaGenerateInputSchema.safeParse(undefined).success).toBe(false);
    expect(SecuenciaGenerateInputSchema.safeParse('invalido').success).toBe(false);
    expect(SecuenciaGenerateInputSchema.safeParse(123).success).toBe(false);
  });
});

describe('SecuenciaUpdateInputSchema — Validación de Entrada PUT Secuencia', () => {
  const sesionValida = {
    sessionNum: 1,
    totalSessions: 1,
    phase: 'Apertura' as const,
    title: 'Sesión 1: Activación de saberes previos',
    teachingActivity: 'Preguntas socráticas detonadoras para diagnosticar saberes previos.',
    learningActivity: 'Participación dialógica y formulación de hipótesis en libreta.',
    evidence: 'Mapeo conceptual en libreta de apuntes.',
    evaluation: 'Lista de cotejo diagnóstica formativa.',
    procesoPensamiento: 'asombro' as const,
    utilidadReal: 'Permite identificar variables empíricas del entorno.',
    garantiaDualOffline: 'Actividad ejecutable completamente con papel y lápiz en cualquier aula.',
  };

  it('debe aceptar payload válido con blockIndex >= 0 y array sessions no vacío', () => {
    const input = {
      blockIndex: 0,
      sessions: [sesionValida],
    };
    const result = SecuenciaUpdateInputSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.blockIndex).toBe(0);
      expect(result.data.sessions.length).toBe(1);
    }
  });

  it('debe aceptar múltiples sesiones válidas', () => {
    const input = {
      blockIndex: 1,
      sessions: [
        sesionValida,
        { ...sesionValida, sessionNumber: 2, faseDidactica: 'desarrollo' as const },
      ],
    };
    const result = SecuenciaUpdateInputSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sessions.length).toBe(2);
    }
  });

  it('debe rechazar cuando falta blockIndex', () => {
    const input = { sessions: [sesionValida] };
    const result = SecuenciaUpdateInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('debe rechazar blockIndex negativo', () => {
    const input = { blockIndex: -1, sessions: [sesionValida] };
    const result = SecuenciaUpdateInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('debe rechazar blockIndex con punto flotante', () => {
    const input = { blockIndex: 2.5, sessions: [sesionValida] };
    const result = SecuenciaUpdateInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('debe rechazar cuando falta sessions', () => {
    const input = { blockIndex: 0 };
    const result = SecuenciaUpdateInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('debe rechazar cuando sessions es un array vacío', () => {
    const input = { blockIndex: 0, sessions: [] };
    const result = SecuenciaUpdateInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('debe rechazar cuando sessions contiene elementos inválidos (título vacío)', () => {
    const sesionInvalida = { ...sesionValida, title: '' };
    const input = { blockIndex: 0, sessions: [sesionInvalida] };
    const result = SecuenciaUpdateInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('debe rechazar cuando sessions no es un array', () => {
    const input = { blockIndex: 0, sessions: 'no-array' };
    const result = SecuenciaUpdateInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('debe rechazar entradas nulas o primitivas', () => {
    expect(SecuenciaUpdateInputSchema.safeParse(null).success).toBe(false);
    expect(SecuenciaUpdateInputSchema.safeParse(undefined).success).toBe(false);
    expect(SecuenciaUpdateInputSchema.safeParse('string').success).toBe(false);
  });
});
