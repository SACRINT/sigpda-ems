/**
 * writer-contract-pads.test.ts — Mínimos editoriales del contrato de escritor
 *
 * Los dos huecos que alimentaron el bug 54/72 en origen:
 *  - recursos descartaba URLs sin protocolo (www.…) hasta quedar []
 *  - autoevaluación solo se completaba con 0 ítems (1 ítem pasaba sin más)
 * más la pista de práctica de respaldo (FALLBACK_PISTA) y normalizeHttpUrl.
 */
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_AUTOEVALUACION,
  FALLBACK_PISTA,
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

describe('sanitizeSessionPlans — mínimos editoriales (anti 54/72)', () => {
  it('autoevaluación con 1 ítem → se completa a 2 conservando el original', () => {
    const plans = sanitize(rawPlan())!;
    expect(plans).toHaveLength(1);
    expect(plans[0].autoevaluacion).toHaveLength(2);
    expect(plans[0].autoevaluacion[0]).toContain('¿Puedes explicar la variación porcentual');
    expect(plans[0].autoevaluacion[1]).toBe(DEFAULT_AUTOEVALUACION[0]);
  });

  it('autoevaluación ausente → los 2 defaults del contrato', () => {
    const plans = sanitize(rawPlan({ autoevaluacion: undefined }))!;
    expect(plans[0].autoevaluacion).toEqual([...DEFAULT_AUTOEVALUACION]);
  });

  it('recurso con URL sin protocolo (www.) → se normaliza a https en vez de descartarse', () => {
    const plans = sanitize(
      rawPlan({
        recursos: [{ titulo: 'Video de apoyo', url: 'www.youtube.com/watch?v=sinp', tipo: 'video' }],
      }),
    )!;
    expect(plans[0].recursos).toHaveLength(1);
    expect(plans[0].recursos[0].url).toBe('https://www.youtube.com/watch?v=sinp');
  });

  it('recurso con URL basura → se descarta (sin romper el resto del plan)', () => {
    const plans = sanitize(
      rawPlan({
        recursos: [{ titulo: 'Enlace roto', url: 'no-es-una-url-valida', tipo: 'video' }],
      }),
    )!;
    expect(plans[0].recursos).toHaveLength(0);
    // El plan sigue siendo utilizable (los mínimos blandos los resuelve la capa editorial)
    expect(plans[0].sessionNumber).toBe(1);
  });

  it('práctica heredada como string → pista estándar FALLBACK_PISTA', () => {
    const plans = sanitize(rawPlan({ practica: ['Resuelve los ejercicios 1 al 5 del cuaderno con calma.'] }))!;
    expect(plans[0].practica).toHaveLength(1);
    expect(plans[0].practica[0].pista).toBe(FALLBACK_PISTA);
  });

  it('pista de objeto vacía o corta → FALLBACK_PISTA (≥5 caracteres siempre)', () => {
    const plans = sanitize(
      rawPlan({
        practica: [
          { enunciado: 'Calcula la variación con los dos valores del ejemplo.', pista: '' },
          { enunciado: 'Interpreta el resultado en tu propio contexto comunitario.', pista: 'ok' },
        ],
      }),
    )!;
    expect(plans[0].practica[0].pista).toBe(FALLBACK_PISTA);
    expect(plans[0].practica[1].pista).toBe(FALLBACK_PISTA);
    expect(plans[0].practica.every((p) => p.pista.length >= 5)).toBe(true);
  });

  it('plan con sessionNumber fuera de coveredSessions → se ignora', () => {
    expect(sanitizeSessionPlans([rawPlan({ sessionNumber: 99 })], [1])).toBeUndefined();
  });
});
