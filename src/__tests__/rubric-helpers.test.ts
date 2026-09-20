/**
 * rubric-helpers.test.ts
 *
 * Pruebas unitarias para helpers de rúbricas formativas NEM / DBEPA Puebla:
 * - getOfficialNemFallback: Retorna descripciones oficiales por nivel.
 * - getRubricLevelDescriptor: Normaliza arrays y objetos de niveles, resolviendo aliases en inglés y español.
 */

import { describe, it, expect } from 'vitest';
import { getOfficialNemFallback, getRubricLevelDescriptor } from '@/lib/rubric-helpers';
import { getRubricLevelDescriptor as reexportedFromPdf } from '@/lib/pdf-workbook-renderer';

describe('rubric-helpers — Descriptores de Rúbrica Oficial NEM', () => {
  it('getOfficialNemFallback retorna los 4 niveles oficiales sin fallos', () => {
    expect(getOfficialNemFallback('sobresaliente')).toContain('dominio integral');
    expect(getOfficialNemFallback('notable')).toContain('satisfactoriamente');
    expect(getOfficialNemFallback('suficiente')).toContain('básico');
    expect(getOfficialNemFallback('insuficiente')).toContain('dificultades significativas');
  });

  it('getRubricLevelDescriptor retorna fallback cuando levels es nulo o indefinido', () => {
    expect(getRubricLevelDescriptor(null, 'sobresaliente')).toBe(getOfficialNemFallback('sobresaliente'));
    expect(getRubricLevelDescriptor(undefined, 'notable')).toBe(getOfficialNemFallback('notable'));
  });

  it('resuelve correctamente desde un objeto con nombres estándar', () => {
    const levelsObj = {
      sobresaliente: 'Excelente desempeño en taller y laboratorio.',
      notable: 'Buen desempeño general con apego a la norma.',
      suficiente: 'Desempeño elemental guiado.',
      insuficiente: 'No cumple requerimientos.',
    };

    expect(getRubricLevelDescriptor(levelsObj, 'sobresaliente')).toBe('Excelente desempeño en taller y laboratorio.');
    expect(getRubricLevelDescriptor(levelsObj, 'notable')).toBe('Buen desempeño general con apego a la norma.');
  });

  it('resuelve correctamente desde un objeto con aliases en inglés o descriptores alternativos', () => {
    const levelsObj = {
      advanced: 'Advanced domain of cognitive skills.',
      developing: 'Developing basic competence in classroom.',
    };

    expect(getRubricLevelDescriptor(levelsObj, 'sobresaliente')).toBe('Advanced domain of cognitive skills.');
    expect(getRubricLevelDescriptor(levelsObj, 'suficiente')).toBe('Developing basic competence in classroom.');
  });

  it('resuelve correctamente desde un array de objetos con levelName y descriptor', () => {
    const levelsArr = [
      { levelName: 'Expert', descriptor: 'Demuestra dominio experto en la práctica.' },
      { levelName: 'Proficient', descriptor: 'Demuestra dominio competente.' },
      { levelName: 'Basic', descriptor: 'Demuestra comprensión básica guiada.' },
      { levelName: 'Needs Support', descriptor: 'Requiere acompañamiento tutorial cercano.' },
    ];

    expect(getRubricLevelDescriptor(levelsArr, 'sobresaliente')).toBe('Demuestra dominio experto en la práctica.');
    expect(getRubricLevelDescriptor(levelsArr, 'notable')).toBe('Demuestra dominio competente.');
    expect(getRubricLevelDescriptor(levelsArr, 'suficiente')).toBe('Demuestra comprensión básica guiada.');
    expect(getRubricLevelDescriptor(levelsArr, 'insuficiente')).toBe('Requiere acompañamiento tutorial cercano.');
  });

  it('la re-exportación en pdf-workbook-renderer mantiene total equivalencia funcional', () => {
    expect(reexportedFromPdf(null, 'sobresaliente')).toBe(getRubricLevelDescriptor(null, 'sobresaliente'));
  });
});
