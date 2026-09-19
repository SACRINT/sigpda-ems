// src/__tests__/visual-dispatcher.test.ts
/**
 * Test unitario para visual-dispatcher.ts
 * Valida la variación dinámica de gráficas matemáticas STEM entre misiones
 * y la extracción de parámetros matemáticos explícitos.
 */

import { describe, it, expect } from 'vitest';
import { dispatchVisual, isStemSubject } from '@/lib/visual-engine/visual-dispatcher';

describe('visual-dispatcher.ts — Despacho dinámico y variación STEM', () => {
  it('detecta asignaturas STEM correctamente', () => {
    expect(isStemSubject('Pensamiento Matemático III')).toBe(true);
    expect(isStemSubject('Física I')).toBe(true);
    expect(isStemSubject('Lengua y Comunicación I')).toBe(false);
  });

  it('varía la gráfica lineal entre diferentes números de misión (evita duplicados)', () => {
    const uac = 'Pensamiento Matemático III';
    const topic = 'Modelación de Ecuaciones Lineales y Rectas en el Comercio Local';
    const context = 'Costos y producción de cítricos';

    const m1 = dispatchVisual(uac, topic, context, 1);
    const m2 = dispatchVisual(uac, topic, context, 2);
    const m3 = dispatchVisual(uac, topic, context, 3);
    const m4 = dispatchVisual(uac, topic, context, 4);

    expect(m1).not.toBeNull();
    expect(m2).not.toBeNull();
    expect(m3).not.toBeNull();
    expect(m4).not.toBeNull();

    // Misión 1: Función lineal creciente
    expect(m1?.annotations.some((a) => a.text.includes('1.5x'))).toBe(true);

    // Misión 2: Función decreciente con pendiente negativa
    expect(m2?.annotations.some((a) => a.text.includes('-x'))).toBe(true);

    // Misión 3: Sistema 2x2 / Intersección de costos e ingresos
    expect(m3?.annotations.some((a) => a.text.includes('Punto de Equilibrio') || a.text.includes('L₁') || a.text.includes('L₂'))).toBe(true);

    // Misión 4: Plano cartesiano para tabulación y consolidación
    expect(m4?.annotations.some((a) => a.text.includes('Plano Cartesiano') || a.text.includes('Tabulación'))).toBe(true);
  });

  it('extrae parámetros explícitos de f(x) = mx + b cuando se especifican en el texto', () => {
    const uac = 'Pensamiento Matemático III';
    const topic = 'Ecuación de la recta f(x) = 2x - 3';
    const context = 'Analizar el comportamiento de f(x) = 2x - 3 en el plano';

    const res = dispatchVisual(uac, topic, context, 1);
    expect(res).not.toBeNull();
    expect(res?.annotations.some((a) => a.text.includes('2x - 3'))).toBe(true);
  });

  it('extrae parámetros explícitos de función cuadrática f(x) = ax² + bx + c', () => {
    const uac = 'Pensamiento Matemático III';
    const topic = 'Trayectoria parabólica';
    const context = 'Modelar el lanzamiento con f(x) = -x² + 4';

    const res = dispatchVisual(uac, topic, context, 1);
    expect(res).not.toBeNull();
    expect(res?.annotations.some((a) => a.text.includes('-x² + 4'))).toBe(true);
  });
});
