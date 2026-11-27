// src/__tests__/visual-dispatcher.test.ts
/**
 * Test unitario para visual-dispatcher.ts
 * Valida la extracción auténtica de parámetros matemáticos STEM,
 * ausencia de modelos inventados cuando solo hay tema sin datos,
 * y distinción explícita entre scope: 'mission' y scope: 'session'.
 */

import { describe, it, expect } from 'vitest';
import {
  dispatchVisual,
  isDigitalCultureSubject,
  isStemSubject,
} from '@/lib/visual-engine/visual-dispatcher';

describe('visual-dispatcher.ts — Despacho auténtico y distinción misión/sesión', () => {
  it('detecta asignaturas STEM correctamente', () => {
    expect(isStemSubject('Pensamiento Matemático III')).toBe(true);
    expect(isStemSubject('Física I')).toBe(true);
    expect(isStemSubject('Lengua y Comunicación I')).toBe(false);
  });

  it('no inventa coeficientes cuando solo hay tema sin datos reales y respeta scope mission vs session', () => {
    const uac = 'Pensamiento Matemático III';
    const topic = 'Modelación de Ecuaciones Lineales y Rectas en el Comercio Local';
    const context = 'Costos y producción de cítricos';

    const m1 = dispatchVisual({ subject: uac, topic, context, scope: 'mission', missionNumber: 1 });
    const s16 = dispatchVisual({ subject: uac, topic, context, scope: 'session', sessionNumber: 16, missionNumber: 4 });

    expect(m1).not.toBeNull();
    expect(s16).not.toBeNull();

    // Sin datos numéricos, devuelve plano cartesiano por construir (no inventa 1.5x + 1)
    expect(m1?.metadata?.isFallback).toBe(true);
    expect(m1?.annotations.some((a) => a.text.includes('1.5x'))).toBe(false);
    expect(m1?.annotations.some((a) => a.text.includes('Misión 1'))).toBe(true);

    // En ámbito de sesión (ej. Sesión 16 de Misión 4), rotula "Sesión 16" y NUNCA "Misión 16"
    const s16Texts = s16!.annotations.map((a) => a.text).join(' ');
    expect(s16Texts).toContain('Sesión 16');
    expect(s16Texts).not.toContain('Misión 16');
  });

  it('extrae parámetros explícitos de f(x) = mx + b cuando se especifican en el texto', () => {
    const uac = 'Pensamiento Matemático III';
    const topic = 'Ecuación de la recta f(x) = 2x - 3';
    const context = 'Analizar el comportamiento de f(x) = 2x - 3 en el plano';

    const res = dispatchVisual(uac, topic, context, 1);
    expect(res).not.toBeNull();
    expect(res?.metadata?.isFallback).toBe(false);
    expect(res?.annotations.some((a) => a.text.includes('2x - 3'))).toBe(true);
  });

  it('extrae parámetros explícitos de función cuadrática f(x) = ax² + bx + c', () => {
    const uac = 'Pensamiento Matemático III';
    const topic = 'Trayectoria parabólica';
    const context = 'Modelar el lanzamiento con f(x) = -x² + 4';

    const res = dispatchVisual(uac, topic, context, 1);
    expect(res).not.toBeNull();
    expect(res?.metadata?.isFallback).toBe(false);
    expect(res?.annotations.some((a) => a.text.includes('-x² + 4'))).toBe(true);
  });

  it('P0 Hotfix 4.1.1: Cultura Digital conserva isStemSubject=true pero NUNCA despacha Plano Cartesiano ni Misión 0', () => {
    expect(isStemSubject('Cultura Digital I')).toBe(true);
    expect(isDigitalCultureSubject('Cultura Digital I')).toBe(true);

    const hw = dispatchVisual({
      subject: 'Cultura Digital I',
      topic: 'Hardware y software en la computadora escolar',
      context: 'Componentes físicos, sistema operativo y periféricos',
      missionNumber: 1,
    });
    expect(hw).not.toBeNull();
    expect(hw?.metadata?.type).toBe('digital_block_diagram');
    const hwText = hw!.annotations.map((a) => a.text).join(' ');
    expect(hwText).not.toMatch(/plano\s+cartesiano/i);
    expect(hwText).toContain('Misión 1');
    expect(hwText).not.toContain('Misión 0');

    const algo = dispatchVisual({
      subject: 'Cultura Digital I',
      topic: 'Algoritmos y diagramas de flujo',
      context: 'Diseño paso a paso de un proceso automatizado',
      missionNumber: 2,
    });
    expect(algo).not.toBeNull();
    expect(algo?.metadata?.type).toBe('digital_technical_flow');
    const algoText = algo!.annotations.map((a) => a.text).join(' ');
    expect(algoText).not.toMatch(/plano\s+cartesiano/i);
    expect(algoText).toContain('Misión 2');

    const ethics = dispatchVisual({
      subject: 'Cultura Digital I',
      topic: 'Ciudadanía digital y privacidad de datos',
      context: 'Identidad digital, huella en redes y derechos de autor',
      missionNumber: 3,
    });
    expect(ethics).not.toBeNull();
    expect(ethics?.metadata?.type).toBe('digital_concept_map');
    const ethicsText = ethics!.annotations.map((a) => a.text).join(' ');
    expect(ethicsText).not.toMatch(/plano\s+cartesiano/i);
    expect(ethicsText).toContain('Misión 3');
  });
});
