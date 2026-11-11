import { describe, it, expect } from 'vitest';
import {
  GenericContentError,
  assertNoGenericContent,
  findGenericContent,
  hasGenericContent,
  isGenericText,
} from '@/lib/guide-engine/quality/no-generic-content';

describe('no-generic-content — gate anti-relleno', () => {
  it('detecta firmas explícitas de fallback', () => {
    expect(isGenericText('Desafío del entorno escolar poblano.')).toBe(true);
    expect(
      isGenericText(
        'Observa el ejemplo resuelto paso a paso y aplica el mismo procedimiento con los datos del ejercicio.'
      )
    ).toBe(true);
    expect(isGenericText('Resuelve los ejercicios prácticos de la sesión 3 aplicando el modelo conceptual estudiado con datos de tu entorno.')).toBe(true);
  });

  it('no marca contenido disciplinar específico como genérico', () => {
    expect(
      isGenericText(
        'El área del triángulo se calcula multiplicando la base por la altura y dividiendo entre dos.'
      )
    ).toBe(false);
    expect(isGenericText('Parrafo: La variación porcentual compara dos cantidades.')).toBe(false);
  });

  it('recorre objetos y arreglos anidados con ruta precisa', () => {
    const payload = {
      missions: [
        {
          title: 'Misión específica',
          sessionPlans: [
            { contenido: 'Contenido real', practica: [{ pista: 'Analogía intuitiva cotidiana.' }] },
          ],
        },
      ],
    };
    const issues = findGenericContent(payload, 'block');
    expect(issues).toHaveLength(1);
    expect(issues[0].path).toContain('missions[0].sessionPlans[0].practica[0].pista');
    expect(issues[0].label).toBe('Analogía genérica');
  });

  it('hasGenericContent resume el resultado booleano', () => {
    expect(hasGenericContent({ a: 'texto real' })).toBe(false);
    expect(hasGenericContent({ a: '[completar]' })).toBe(true);
  });

  it('assertNoGenericContent lanza GenericContentError con detalle', () => {
    expect(() =>
      assertNoGenericContent({ contenido: 'Fundamento conceptual inicial.' }, 'prueba')
    ).toThrow(GenericContentError);
    try {
      assertNoGenericContent({ contenido: 'Fundamento conceptual inicial.' }, 'prueba');
    } catch (error) {
      expect(error).toBeInstanceOf(GenericContentError);
      expect((error as GenericContentError).issues).toHaveLength(1);
      expect((error as GenericContentError).message).toContain('[NoGenericContent]');
    }
  });

  it('no lanza con contenido específico', () => {
    expect(() =>
      assertNoGenericContent(
        { contenido: 'La fotosíntesis transforma energía luminosa en energía química.' },
        'prueba'
      )
    ).not.toThrow();
  });
});
