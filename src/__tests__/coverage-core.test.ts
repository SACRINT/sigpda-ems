import { describe, it, expect } from 'vitest';
import { computeCoverage } from '@/lib/coverage-core';

describe('coverage-core.ts — Núcleo de cálculo de cobertura de metas de personal', () => {
  it('calcula cobertura correctamente cuando totalStaff numérico es provisto', () => {
    const metas = [{ nombre: 'Docente 1' }, { nombre: 'Docente 2' }, { nombre: 'Docente 3' }, { nombre: 'Docente 4' }];
    const totalStaff = 5;
    const res = computeCoverage(metas, totalStaff);

    expect(res.realStaffCount).toBe(5);
    expect(res.metasCount).toBe(4);
    expect(res.coverageRatio).toBe(0.8);
    expect(res.coveragePercent).toBe(80);
    expect(res.isLowCoverage).toBe(false);
  });

  it('marca isLowCoverage como true cuando la cobertura es menor al 80%', () => {
    const metas = [{ nombre: 'Docente 1' }];
    const totalStaff = 10;
    const res = computeCoverage(metas, totalStaff);

    expect(res.realStaffCount).toBe(10);
    expect(res.metasCount).toBe(1);
    expect(res.coverageRatio).toBe(0.1);
    expect(res.coveragePercent).toBe(10);
    expect(res.isLowCoverage).toBe(true);
  });

  it('utiliza fallbackStaffList cuando totalStaff es indefinido o 0', () => {
    const metas = [{ nombre: 'Docente A' }, { nombre: 'Docente B' }];
    const fallbackStaff = [{ nombre: 'Docente A' }, { nombre: 'Docente B' }, { nombre: 'Docente C' }];
    const res = computeCoverage(metas, 0, fallbackStaff);

    expect(res.realStaffCount).toBe(3);
    expect(res.metasCount).toBe(2);
    expect(res.coveragePercent).toBe(67);
    expect(res.isLowCoverage).toBe(true);
  });

  it('utiliza 1 como mínimo defensivo cuando no hay datos de personal', () => {
    const res = computeCoverage([], null, []);

    expect(res.realStaffCount).toBe(1);
    expect(res.metasCount).toBe(0);
    expect(res.coverageRatio).toBe(0);
    expect(res.coveragePercent).toBe(0);
    expect(res.isLowCoverage).toBe(true);
  });

  it('acepta conteo numérico de metas directamente', () => {
    const res = computeCoverage(8, 10);

    expect(res.realStaffCount).toBe(10);
    expect(res.metasCount).toBe(8);
    expect(res.coveragePercent).toBe(80);
    expect(res.isLowCoverage).toBe(false);
  });
});
