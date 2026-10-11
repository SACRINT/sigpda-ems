import { describe, it, expect } from 'vitest';
import { buildSessionFallbackTaskText } from '@/lib/session-task-fallback';

describe('H-8 — Tarea de respaldo específica por sesión', () => {
  it('incluye tema y enfoque de la misión y las instrucciones de evidencias', () => {
    const text = buildSessionFallbackTaskText(
      { sessionTopic: 'Funciones lineales', sessionFocus: 'Modelado de costos locales' },
      7,
      'PRACTICA COLABORATIVA (SESION 7)'
    );
    expect(text).toContain('Funciones lineales');
    expect(text).toContain('Modelado de costos locales');
    expect(text).toContain('Registre el procedimiento y evidencias en su cuaderno');
    // El título genérico del renderer no debe contaminar el enunciado
    expect(text).not.toContain('PRACTICA COLABORATIVA');
  });

  it('antepone el título real de la sesión cuando es significativo y evita duplicados', () => {
    const text = buildSessionFallbackTaskText(
      { sessionTopic: 'Funciones lineales', sessionFocus: 'Funciones lineales' },
      9,
      'Interpretación de pendientes'
    );
    expect(text.startsWith('Interpretación de pendientes. Funciones lineales.')).toBe(true);
    expect(text.match(/Funciones lineales/g)).toHaveLength(1);
  });

  it('usa un respaldo con número de sesión si la misión no trae tema ni enfoque', () => {
    const text = buildSessionFallbackTaskText({}, 12);
    expect(text).toContain('sesion 12');
    expect(text).toContain('Registre el procedimiento y evidencias en su cuaderno');
  });
});
