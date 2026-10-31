import { describe, it, expect } from 'vitest';
import { recomendarMetodologia } from '@/lib/recomendador-metodologia';

describe('recomendarMetodologia', () => {
  it('recomienda gamificación para Actividades Físicas y Deportivas (no indagación)', () => {
    expect(
      recomendarMetodologia('Actividades Físicas y Deportivas', 'fundamental')
    ).toBe('gamificacion');
  });

  it('recomienda gamificación para Educación Física', () => {
    expect(recomendarMetodologia('Educación Física', 'fundamental')).toBe('gamificacion');
  });

  it('recomienda gamificación para Condición Física y Deportiva', () => {
    expect(
      recomendarMetodologia('Condición Física y Deportiva', 'fundamental')
    ).toBe('gamificacion');
  });

  it('recomienda indagación para Física Experimental (palabra completa)', () => {
    expect(
      recomendarMetodologia('Física Experimental', 'fundamental')
    ).toBe('indagacion');
  });

  it('recomienda indagación para Química I (palabra completa)', () => {
    expect(recomendarMetodologia('Química I', 'fundamental')).toBe('indagacion');
  });

  it('recomienda indagación para Biología General (palabra completa)', () => {
    expect(recomendarMetodologia('Biología General', 'fundamental')).toBe('indagacion');
  });

  it('recomienda indagación para Ciencias Químicas (subcadena de frase)', () => {
    expect(
      recomendarMetodologia('Ciencias Químicas', 'fundamental')
    ).toBe('indagacion');
  });

  it('NO recomienda indagación para Físicas Aplicadas (Físicas + s)', () => {
    // "físicas" con plural ya no debe coincidir con la keyword exacta "física"
    expect(
      recomendarMetodologia('Físicas Aplicadas', 'fundamental')
    ).not.toBe('indagacion');
  });

  it('recomienda ABProblemas para Pensamiento Matemático I', () => {
    expect(
      recomendarMetodologia('Pensamiento Matemático I', 'fundamental')
    ).toBe('abproblemas');
  });

  it('conserva prefijos de otras reglas (electrónica → práctica de taller)', () => {
    expect(
      recomendarMetodologia('Electrónica Aplicada', 'fundamental')
    ).toBe('practica_laboratorio');
  });

  it('conserva la preferencia de ABR para Programación', () => {
    expect(
      recomendarMetodologia('Programación Web', 'fundamental')
    ).toBe('abr');
  });
});
