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

  it('recomienda práctica de taller para una UAC de formación laboral', () => {
    expect(
      recomendarMetodologia(
        'Prepara materiales en cantidad y calidad especificada para llevar a cabo diferentes tipos de mezclas bajo la supervisión del experto',
        'laboral',
        'bge'
      )
    ).toBe('practica_laboratorio');
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

  describe('Blindaje SSoT Pensamiento Matemático (Inmunidad Absoluta a Indagación)', () => {
    it('recomienda ABProblemas para Pensamiento Matemático III con números romanos', () => {
      const res = recomendarMetodologia('Pensamiento Matemático III', 'fundamental');
      expect(res).toBe('abproblemas');
    });

    it('recomienda ABProblemas para Pensamiento Matemático 3 con números arábigos', () => {
      const res = recomendarMetodologia('Pensamiento Matemático 3', 'fundamental');
      expect(res).toBe('abproblemas');
    });

    it('recomienda ABProblemas para Pensamiento Matemático III con subtítulo o sufijo', () => {
      const res1 = recomendarMetodologia('Pensamiento Matemático III: Álgebra y Geometría', 'fundamental');
      expect(res1).toBe('abproblemas');

      const res2 = recomendarMetodologia('Pensamiento Matemático 3 (Bachillerato General)', 'fundamental');
      expect(res2).toBe('abproblemas');
    });

    it('recomienda ABProblemas para Pensamiento Matemático III INCLUSO si el contenido menciona hipótesis y recolección de datos', () => {
      // Caso exacto del reclamo del usuario: el texto de probabilidad/estadística o PAEC contiene
      // términos de hipótesis y recolección de datos, pero la disciplina matemática es inviolable.
      const res = recomendarMetodologia('Pensamiento Matemático III', 'fundamental', 'bge', {
        learningOutcome: 'Formulación de hipótesis sobre muestras estadísticas y recolección de datos en el entorno escolar',
        contenidosFormativos: [
          { proposito: 'Contrastación empírica e hipótesis estadísticas', saberes: ['Recolección de datos muestrales'] }
        ],
      });
      expect(res).toBe('abproblemas');
      expect(res).not.toBe('indagacion');
    });

    it('recomienda ABProblemas para Pensamiento Matemático II y IV con números arábigos y romanos', () => {
      expect(recomendarMetodologia('Pensamiento Matemático II', 'fundamental')).toBe('abproblemas');
      expect(recomendarMetodologia('Pensamiento Matemático 2', 'fundamental')).toBe('abproblemas');
      expect(recomendarMetodologia('Pensamiento Matemático IV', 'fundamental')).toBe('abproblemas');
      expect(recomendarMetodologia('Pensamiento Matemático 4', 'fundamental')).toBe('abproblemas');
    });

    it('recomienda ABProblemas para Pensamiento Matemático Aplicado a las Finanzas', () => {
      expect(recomendarMetodologia('Pensamiento Matemático Aplicado a las Finanzas I', 'ffe_optativa')).toBe('abproblemas');
      expect(recomendarMetodologia('Pensamiento Matemático Aplicado a las Finanzas 1', 'ffe_optativa')).toBe('abproblemas');
    });
  });
});
