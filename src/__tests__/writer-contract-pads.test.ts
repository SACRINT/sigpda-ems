/**
 * writer-contract-pads.test.ts — Contrato de escritor SIN relleno genérico
 *
 * Regresión del loophole que permitía publicar texto de contingencia:
 *  - los campos teóricos faltantes ya NO se sustituyen con defaults;
 *  - autoevaluación/pistas faltantes NO se rellenan con preguntas o pistas genéricas;
 *  - el plan incompleto se descarta para forzar reintento del writer.
 */
import { describe, it, expect } from 'vitest';
import {
  normalizeHttpUrl,
  sanitizeSessionPlans,
} from '@/lib/guide-engine/writers/writer-contract';

function rawPlan(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    sessionNumber: 1,
    objetivo: 'Vas a aprender a calcular la variación porcentual con datos reales.',
    motivacion: 'Imagina que los precios de tu comunidad cambian cada semana: esa es la tarea de hoy.',
    saberesPrevios: 'Ya dominas operaciones básicas, porcentajes y tabulación de datos.',
    contenido:
      'Parrafo: La variación porcentual describe la diferencia entre dos cantidades.\n\nDefinicion: Relación de cambio proporcional expresada en porcentaje.',
    ejemploResuelto: 'Un vendedor vendió 5 artículos en 2 días.\nPaso 1: 5 / 2 = 2.5 artículos/día.',
    practica: [
      { enunciado: 'Calcula la variación cuando el precio pasa de 20 a 25 pesos.', pista: '' },
    ],
    aplicacion: 'Aplica la variación porcentual al presupuesto de tu salón y justifica tu estrategia.',
    autoevaluacion: ['¿Puedes explicar la variación porcentual con tus palabras?'],
    recursos: [{ titulo: 'Video de variación', url: 'https://www.youtube.com/watch?v=v1', tipo: 'video' }],
    productoIntegrador: 'Agregas una tabla de variación porcentual a tu proyecto comunitario.',
    ...overrides,
  };
}

function sanitize(raw: unknown) {
  return sanitizeSessionPlans([raw], [1]);
}

describe('normalizeHttpUrl', () => {
  it('prefija https:// a dominios sin protocolo', () => {
    expect(normalizeHttpUrl('www.youtube.com/watch?v=abc123')).toBe('https://www.youtube.com/watch?v=abc123');
    expect(normalizeHttpUrl('geogebra.org/m/abcXYZ')).toBe('https://geogebra.org/m/abcXYZ');
  });

  it('deja intactas las URLs ya válidas y las cadenas que no parecen dominio', () => {
    expect(normalizeHttpUrl('https://youtu.be/abc')).toBe('https://youtu.be/abc');
    expect(normalizeHttpUrl('http://example.com/x')).toBe('http://example.com/x');
    expect(normalizeHttpUrl('no es una url')).toBe('no es una url');
    expect(normalizeHttpUrl('no-es-dominio')).toBe('no-es-dominio');
    expect(normalizeHttpUrl('')).toBe('');
  });
});

describe('sanitizeSessionPlans — sin relleno genérico', () => {
  it('autoevaluación con 1 ítem → se conserva tal cual (el reparador IA debe completarla)', () => {
    const plans = sanitize(rawPlan())!;
    expect(plans).toHaveLength(1);
    expect(plans[0].autoevaluacion).toHaveLength(1);
    expect(plans[0].autoevaluacion[0]).toContain('¿Puedes explicar la variación porcentual');
  });

  it('autoevaluación ausente → queda vacía, NO se inyectan preguntas genéricas', () => {
    const plans = sanitize(rawPlan({ autoevaluacion: undefined }))!;
    expect(plans[0].autoevaluacion).toEqual([]);
  });

  it('recurso con URL sin protocolo (www.) → se normaliza a https', () => {
    const plans = sanitize(
      rawPlan({
        recursos: [{ titulo: 'Video de apoyo', url: 'www.youtube.com/watch?v=sinp', tipo: 'video' }],
      }),
    )!;
    expect(plans[0].recursos).toHaveLength(1);
    expect(plans[0].recursos[0].url).toBe('https://www.youtube.com/watch?v=sinp');
  });

  it('recurso con URL basura → se sustituye por un recurso curado y el plan se conserva', () => {
    const plans = sanitize(
      rawPlan({
        recursos: [{ titulo: 'Enlace roto', url: 'no-es-una-url-valida', tipo: 'video' }],
      }),
    )!;
    expect(plans[0].recursos).toHaveLength(1);
    expect(plans[0].recursos[0].url).toMatch(/^https:\/\//);
    expect(plans[0].recursos[0].url).not.toContain('no-es-una-url-valida');
    expect(plans[0].sessionNumber).toBe(1);
  });

  it('práctica heredada como string → pista vacía, sin FALLBACK_PISTA', () => {
    const plans = sanitize(rawPlan({ practica: ['Resuelve los ejercicios 1 al 5 del cuaderno con calma.'] }))!;
    expect(plans[0].practica).toHaveLength(1);
    expect(plans[0].practica[0].pista).toBe('');
  });

  it('pista de objeto vacía o corta → se conserva vacía/corta, sin relleno', () => {
    const plans = sanitize(
      rawPlan({
        practica: [
          { enunciado: 'Calcula la variación con los dos valores del ejemplo.', pista: '' },
          { enunciado: 'Interpreta el resultado en tu propio contexto comunitario.', pista: 'ok' },
        ],
      }),
    )!;
    expect(plans[0].practica[0].pista).toBe('');
    expect(plans[0].practica[1].pista).toBe('');
  });

  it('campo teórico ausente (productoIntegrador) → descarta el plan para forzar reintento', () => {
    expect(sanitize(rawPlan({ productoIntegrador: undefined }))).toBeUndefined();
  });

  it('plan con sessionNumber fuera de coveredSessions → se ignora', () => {
    expect(sanitizeSessionPlans([rawPlan({ sessionNumber: 99 })], [1])).toBeUndefined();
  });
});
