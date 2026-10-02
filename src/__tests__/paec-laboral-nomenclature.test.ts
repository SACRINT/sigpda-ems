import { describe, it, expect } from 'vitest';
import {
  PAEC_SYSTEM_PROMPT,
  buildPrompt3Mapeo,
  buildPrompt5DetalleCurricular,
  buildPrompt6PlanOperativoSemestreA,
  buildPrompt7PlanOperativoSemestreB,
} from '@/lib/prompts/paec-prompts';

describe('H-310: Nomenclatura Curricular Oficial (Fundamental vs Laboral)', () => {
  it('PAEC_SYSTEM_PROMPT incluye la regla de Actividad Clave para formación laboral', () => {
    expect(PAEC_SYSTEM_PROMPT).toContain('ACTIVIDAD CLAVE [N]');
    expect(PAEC_SYSTEM_PROMPT).toContain('SABERES');
    expect(PAEC_SYSTEM_PROMPT).toContain('competencias_laborales');
    expect(PAEC_SYSTEM_PROMPT).toContain('PROPÓSITOS FORMATIVOS');
    expect(PAEC_SYSTEM_PROMPT).toContain('PROGRESIONES DE APRENDIZAJE');
  });

  it('buildPrompt3Mapeo instruye Actividad Clave para materias de formación laboral', () => {
    const prompt = buildPrompt3Mapeo('Justificación de prueba', [
      { uac_name: 'Módulo I: Programación y Cómputo', semester: 2 },
      { uac_name: 'Lengua y Comunicación II', semester: 2 },
    ]);

    expect(prompt).toContain('Actividad Clave [N]');
    expect(prompt).toContain('Propósito Formativo [N]');
    expect(prompt).toContain('Progresión de Aprendizaje [N]');
    expect(prompt).toContain('Formación Laboral');
  });

  it('buildPrompt5DetalleCurricular diferencia propósitos, progresiones y actividad clave', () => {
    const prompt = buildPrompt5DetalleCurricular('Mapeo de prueba', 'Cronograma de prueba', 'Anual');

    expect(prompt).toContain('Actividad Clave [N]');
    expect(prompt).toContain('Saberes asociados');
    expect(prompt).toContain('Propósito Formativo / Progresión / Actividad Clave');
  });

  it('buildPrompt6PlanOperativoSemestreA incluye Actividad Clave como opción formal de progresión', () => {
    const prompt = buildPrompt6PlanOperativoSemestreA(
      'Cronograma A',
      'Detalle A',
      [{ uacName: 'Submódulo 1: Desarrollo Web', semester: 3 }]
    );

    expect(prompt).toContain('Actividad Clave [N]');
    expect(prompt).toContain('Formación Laboral');
  });

  it('buildPrompt7PlanOperativoSemestreB incluye Actividad Clave como opción formal de progresión', () => {
    const prompt = buildPrompt7PlanOperativoSemestreB(
      'Cronograma B',
      'Detalle B',
      [{ uacName: 'Submódulo 2: Bases de Datos', semester: 4 }]
    );

    expect(prompt).toContain('Actividad Clave [N]');
    expect(prompt).toContain('Formación Laboral');
  });
});
