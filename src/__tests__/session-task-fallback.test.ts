import { describe, it, expect } from 'vitest';
import { buildSessionFallbackTaskText } from '@/lib/session-task-fallback';

describe('H-8 / REG-3 — Tarea de respaldo específica por sesión', () => {
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
    expect(text).toContain('sesión 12');
    expect(text).toContain('Registre el procedimiento y evidencias en su cuaderno');
  });

  it('REG-3: produce textos diferenciados y únicos para sesiones de la misma misión usando sMeta', () => {
    const mission = {
      sessionTopic: 'Módulo Interactivo y Presupuestario de Espacios Recreativos Libres de Riesgos (MIP-ELR)',
      sessionFocus: 'Construcción del artefacto e integración socioproductiva',
    };

    const sMeta17 = {
      title: 'PRACTICA COLABORATIVA (SESION 17)',
      phase: 'DESARROLLO',
      learningActivity: 'Modelado y cálculo de áreas recreativas en plano cartesiano',
    };

    const sMeta18 = {
      title: 'PRACTICA COLABORATIVA (SESION 18)',
      phase: 'DESARROLLO',
      learningActivity: 'Presupuestación de insumos y estructura de costos por metro cuadrado',
    };

    const text17 = buildSessionFallbackTaskText(mission, 17, sMeta17);
    const text18 = buildSessionFallbackTaskText(mission, 18, sMeta18);

    expect(text17).not.toEqual(text18);
    expect(text17).toContain('Modelado y cálculo de áreas recreativas');
    expect(text18).toContain('Presupuestación de insumos y estructura de costos');
    expect(text17).toContain(mission.sessionTopic);
    expect(text18).toContain(mission.sessionTopic);
  });

  it('H-3: no genera dobles puntos (..) cuando las entradas de BD terminan en punto o tienen puntos suspensivos', () => {
    const mission = {
      sessionTopic: 'Módulo Interactivo y Presupuestario...',
      sessionFocus: 'Construcción del artefacto en equipo.',
    };

    const sMeta = {
      title: 'Sesión 17: Desarrollo y Aplicación Práctica.',
      phase: 'Desarrollo',
      learningActivity: 'Resolución de retos situados y construcción de artefactos didácticos en equipo.',
      teachingActivity: 'Modelado procedimental, asesoría metodológica y acompañamiento guiado.',
    };

    const text = buildSessionFallbackTaskText(mission, 17, sMeta);
    expect(text).not.toContain('..');
    expect(text).not.toContain('equipo..');
    expect(text).toMatch(/\. Registre el procedimiento y evidencias en su cuaderno:$/);
  });
});
