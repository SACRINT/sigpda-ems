import { describe, it, expect } from 'vitest';
import { COMPONENT_MAP, resolveComponentAliases } from '@/lib/db/programs-catalog';
import { cleanSocioemotionalName } from '@/lib/utils';
import canonicalRaw from '../../scripts/data/curriculum_canonical_203.json';

interface AmpliadoUac {
  uac_name: string;
  semester: number;
  component: string;
  total_hours?: number;
  learning_outcome?: string | null;
  activities: Array<{ hours: number }>;
  contenidos_formativos?: Array<{ proposito?: string; contenidos?: string[] }> | null;
  evidences?: unknown[];
}

const canonicalCurriculum = canonicalRaw as unknown as AmpliadoUac[];

describe('Currículum Ampliado — Formación Socioemocional (MCCEMS 2025-2028)', () => {
  const EXPECTED_5_AMBITOS = [
    'Práctica y Colaboración Ciudadana',
    'Educación para la Salud',
    'Actividades Físicas y Deportivas',
    'Educación Integral en Sexualidad y Género',
    'Actividades Artísticas y Culturales',
  ];

  it('1. COMPONENT_MAP debe mapear bidireccionalmente ampliado y socioemocional', () => {
    expect(COMPONENT_MAP['ampliado']).toContain('ampliado');
    expect(COMPONENT_MAP['ampliado']).toContain('socioemocional');
    expect(COMPONENT_MAP['socioemocional']).toContain('ampliado');
    expect(COMPONENT_MAP['socioemocional']).toContain('socioemocional');

    expect(resolveComponentAliases('ampliado')).toEqual(
      expect.arrayContaining(['ampliado', 'socioemocional'])
    );
  });

  it('2. cleanSocioemotionalName conserva limpios los 5 nombres canónicos oficiales sin números romanos espurios', () => {
    for (const name of EXPECTED_5_AMBITOS) {
      expect(cleanSocioemotionalName(name, 1)).toBe(name);
      expect(cleanSocioemotionalName(name, 3)).toBe(name);
      expect(cleanSocioemotionalName(`Ámbito: ${name}`, 1)).toBe(name);
      expect(cleanSocioemotionalName(`Ámbito de la Formación Socioemocional: ${name}`, 2)).toBe(name);
      // Prueba de remoción estricta de números romanos (I al VI)
      expect(cleanSocioemotionalName(`${name} I`, 1)).toBe(name);
      expect(cleanSocioemotionalName(`${name} II`, 2)).toBe(name);
      expect(cleanSocioemotionalName(`${name} III`, 3)).toBe(name);
      expect(cleanSocioemotionalName(`${name} IV`, 4)).toBe(name);
      expect(cleanSocioemotionalName(`${name} V`, 5)).toBe(name);
      expect(cleanSocioemotionalName(`${name} VI`, 6)).toBe(name);
    }
  });

  it('3. En curriculum_canonical_203.json existe la distribución oficial SEP por semestre', () => {
    // Semestre 1: Únicamente Actividades Físicas y Deportivas
    const sem1 = canonicalCurriculum.filter(
      (it) => it.semester === 1 && (it.component === 'ampliado' || it.component === 'socioemocional')
    );
    expect(sem1.length).toBe(1);
    expect(sem1[0].uac_name).toBe('Actividades Físicas y Deportivas');

    // Semestre 2: Únicamente Actividades Artísticas y Culturales
    const sem2 = canonicalCurriculum.filter(
      (it) => it.semester === 2 && (it.component === 'ampliado' || it.component === 'socioemocional')
    );
    expect(sem2.length).toBe(1);
    expect(sem2[0].uac_name).toBe('Actividades Artísticas y Culturales');

    // Semestres 3 al 6: Las 3 asignaturas rotativas oficiales (sin números romanos)
    const ROTATIVAS_3_A_6 = [
      'Educación para la Salud',
      'Educación Integral en Sexualidad y Género',
      'Práctica y Colaboración Ciudadana',
    ];

    for (let sem = 3; sem <= 6; sem++) {
      const semItems = canonicalCurriculum.filter(
        (it) => it.semester === sem && (it.component === 'ampliado' || it.component === 'socioemocional')
      );
      expect(semItems.length).toBe(3);
      const uacNames = semItems.map((it) => it.uac_name);
      for (const expected of ROTATIVAS_3_A_6) {
        expect(uacNames).toContain(expected);
      }
    }
  });

  it('4. Cada una de las 5 UACs oficiales tiene Meta Educativa, Propósitos Formativos y Contenidos Temáticos completos', () => {
    const allAmpliado = canonicalCurriculum.filter(
      (it) => it.component === 'ampliado' || it.component === 'socioemocional'
    );
    expect(allAmpliado.length).toBe(14); // 1 + 1 + 3 + 3 + 3 + 3

    for (const uac of allAmpliado) {
      // Meta educativa
      expect(typeof uac.learning_outcome).toBe('string');
      expect(uac.learning_outcome!.length).toBeGreaterThan(50);

      // Carga horaria oficial: 18h (1 h/sem) en 4° y 6°, 36h (2 h/sem) en 1°, 2°, 3° y 5°
      const expectedHours = (uac.semester === 4 || uac.semester === 6) ? 18 : 36;
      expect(uac.total_hours).toBe(expectedHours);

      // Propósitos (activities)
      expect(Array.isArray(uac.activities)).toBe(true);
      expect(uac.activities.length).toBeGreaterThanOrEqual(4);
      const totalHours = uac.activities.reduce((acc: number, a) => acc + a.hours, 0);
      expect(totalHours).toBe(expectedHours);

      // Contenidos formativos
      expect(Array.isArray(uac.contenidos_formativos)).toBe(true);
      const cfList = uac.contenidos_formativos ?? [];
      expect(cfList.length).toBe(uac.activities.length);
      for (const cf of cfList) {
        expect(typeof cf.proposito).toBe('string');
        expect(Array.isArray(cf.contenidos)).toBe(true);
        expect(cf.contenidos!.length).toBeGreaterThan(0);
      }

      // Evidencias
      expect(Array.isArray(uac.evidences)).toBe(true);
      expect((uac.evidences ?? []).length).toBeGreaterThan(0);
    }
  });
});
