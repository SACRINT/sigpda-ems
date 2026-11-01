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

  describe('Inmunidad a falsos amigos de Talleres y Laboratorios Académicos (MCCEMS)', () => {
    it('recomienda STEAM para Taller Pensamiento Variacional I (no práctica de taller)', () => {
      const res = recomendarMetodologia('Taller Pensamiento Variacional I', 'ffe_optativa');
      expect(res).toBe('steam');
      expect(res).not.toBe('practica_laboratorio');
    });

    it('recomienda STEAM para Taller de Pensamiento Variacional I', () => {
      expect(
        recomendarMetodologia('Taller de Pensamiento Variacional I', 'ffeo')
      ).toBe('steam');
    });

    it('recomienda STEAM para Taller Pensamiento Variacional II', () => {
      expect(
        recomendarMetodologia('Taller Pensamiento Variacional II', 'ffe_optativa')
      ).toBe('steam');
    });

    it('recomienda ABProblemas para Taller de Probabilidad y Estadística I', () => {
      const res = recomendarMetodologia('Taller de Probabilidad y Estadística I', 'ffe_optativa');
      expect(res).toBe('abproblemas');
      expect(res).not.toBe('practica_laboratorio');
    });

    it('recomienda Indagación para Taller de Ciencias I', () => {
      const res = recomendarMetodologia('Taller de Ciencias I', 'ffe_optativa');
      expect(res).toBe('indagacion');
      expect(res).not.toBe('practica_laboratorio');
    });

    it('recomienda Estudio de Casos para Laboratorio de Investigación', () => {
      const res = recomendarMetodologia('Laboratorio de Investigación', 'ffeo');
      expect(res).toBe('estudio_casos');
      expect(res).not.toBe('practica_laboratorio');
    });

    it('recomienda ABP para Taller de Lectura y Redacción I', () => {
      const res = recomendarMetodologia('Taller de Lectura y Redacción I', 'fundamental');
      expect(res).toBe('abp');
      expect(res).not.toBe('practica_laboratorio');
    });

    it('recomienda ABR para Taller de Cultura Digital I', () => {
      const res = recomendarMetodologia('Taller de Cultura Digital I', 'fundamental');
      expect(res).toBe('abr');
      expect(res).not.toBe('practica_laboratorio');
    });

    it('recomienda STEAM cuando el contenido curricular contiene razones de cambio y derivadas', () => {
      const res = recomendarMetodologia('Asignatura Optativa Desconocida', 'ffe_optativa', 'bge', {
        learningOutcome: 'Analizar el cambio continuo y las razones de cambio mediante derivadas y funciones',
      });
      expect(res).toBe('steam');
    });
  });
});
