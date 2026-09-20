/**
 * Pruebas Unitarias: SecuenciaGenerateInputSchema — SIGPDA-EMS
 *
 * Valida el esquema Zod de entrada para el endpoint POST /api/planeaciones/[id]/secuencia.
 * Asegura que blockIndex sea un entero >= 0 y totalHours (opcional) sea un entero positivo.
 */

import { describe, it, expect } from 'vitest';
import { SecuenciaGenerateInputSchema } from '@/lib/ai-schemas';

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
