import { describe, it, expect } from 'vitest';
import { sanitizeLinguistic, sanitizePlanningContent } from '@/lib/planning/quality-pipeline';

describe('Sanitizador Lingüístico y Normalizador CCT Determinista', () => {
  it('1. Reemplaza el título con anglicismo "Cuantificando Mis Habits" por "Cuantificando Mis Hábitos"', () => {
    const raw = 'Proyecto Integrador PAEC: Cuantificando Mis Habits en el Bachillerato.';
    expect(sanitizeLinguistic(raw)).toBe('Proyecto Integrador PAEC: Cuantificando Mis Hábitos en el Bachillerato.');
  });

  it('2. Normaliza "Habits" y "habits" respetando mayúsculas y límites de palabra', () => {
    expect(sanitizeLinguistic('Analizar los Habits diarios.')).toBe('Analizar los Hábitos diarios.');
    expect(sanitizeLinguistic('cambiar los habits de consumo.')).toBe('cambiar los hábitos de consumo.');
    expect(sanitizeLinguistic('un nuevo habit.')).toBe('un nuevo hábito.');
    expect(sanitizeLinguistic('el Habit escolar.')).toBe('el Hábito escolar.');
  });

  it('3. Respeta palabras en español o inglés que contienen la subcadena sin límite de palabra', () => {
    // "inhabited", "cohabitation", etc. no deben ser alteradas
    expect(sanitizeLinguistic('inhabited area')).toBe('inhabited area');
  });

  it('4. Reemplaza CCT comodín "21EBH0000X" por la clave oficial o fallback', () => {
    expect(sanitizeLinguistic('Plantel con clave 21EBH0000X en la Sierra.')).toBe('Plantel con clave 21EBH0200X en la Sierra.');
    expect(sanitizeLinguistic('CCT: 21EBH0000X', { fallbackCct: '21EBH0123A' })).toBe('CCT: 21EBH0123A');
  });

  it('5. Maneja textos nulos, vacíos o no-strings sin arrojar excepciones', () => {
    expect(sanitizeLinguistic('')).toBe('');
    expect(sanitizeLinguistic(null as unknown as string)).toBeNull();
    expect(sanitizeLinguistic(undefined as unknown as string)).toBeUndefined();
  });

  it('6. sanitizePlanningContent sanitiza recursivamente objetos anidados de planeación', () => {
    const complexPlanning = {
      sectionI: {
        schoolName: 'Bachillerato General',
        cct: '21EBH0000X',
      },
      sectionII: {
        paecProjectName: 'Cuantificando Mis Habits',
        purpose: 'Mejorar los habits saludables de los estudiantes.',
      },
      sectionIV: {
        activities: [
          {
            name: 'Medición de habits',
            apertura: {
              activities: 'Encuesta sobre habits de hidratación.',
            },
          },
        ],
      },
      numericValue: 42,
      flag: true,
    };

    const sanitized = sanitizePlanningContent(complexPlanning, { fallbackCct: '21EBH0200X' });

    expect(sanitized.sectionI.cct).toBe('21EBH0200X');
    expect(sanitized.sectionII.paecProjectName).toBe('Cuantificando Mis Hábitos');
    expect(sanitized.sectionII.purpose).toBe('Mejorar los hábitos saludables de los estudiantes.');
    expect(sanitized.sectionIV.activities[0].name).toBe('Medición de hábitos');
    expect(sanitized.sectionIV.activities[0].apertura.activities).toBe('Encuesta sobre hábitos de hidratación.');
    expect(sanitized.numericValue).toBe(42);
    expect(sanitized.flag).toBe(true);
  });
});
