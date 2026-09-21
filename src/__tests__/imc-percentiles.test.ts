import { describe, it, expect } from 'vitest';
import { getImcPercentileCategory, WHO_2007_PERCENTILES, PROTOCOLO_BIOETICO_AULA } from '@/lib/health/imc-percentiles';

describe('getImcPercentileCategory — Matriz de Validación de Percentiles OMS 2007 (15 a 18 años)', () => {
  // 15 Casos Frontera requeridos por auditoría adversarial

  it('1. Varón 15 años: frontera P85 exacta (24.2) clasifica como sobrepeso', () => {
    const res = getImcPercentileCategory(15, 'M', 24.2);
    expect(res.category).toBe('sobrepeso');
    expect(res.p85Cutoff).toBe(24.2);
  });

  it('2. Varón 15 años: inmediatamente bajo P85 (24.19) clasifica como peso saludable', () => {
    const res = getImcPercentileCategory(15, 'M', 24.19);
    expect(res.category).toBe('peso_saludable');
  });

  it('3. Varón 15 años: frontera P95 exacta (27.0) clasifica como obesidad', () => {
    const res = getImcPercentileCategory(15, 'M', 27.0);
    expect(res.category).toBe('obesidad');
    expect(res.p95Cutoff).toBe(27.0);
  });

  it('4. Varón 15 años: inmediatamente bajo P95 (26.99) clasifica como sobrepeso', () => {
    const res = getImcPercentileCategory(15, 'M', 26.99);
    expect(res.category).toBe('sobrepeso');
  });

  it('5. Mujer 15 años: frontera P85 exacta (24.9) clasifica como sobrepeso', () => {
    const res = getImcPercentileCategory(15, 'F', 24.9);
    expect(res.category).toBe('sobrepeso');
    expect(res.p85Cutoff).toBe(24.9);
  });

  it('6. Mujer 15 años: frontera P95 exacta (27.8) clasifica como obesidad', () => {
    const res = getImcPercentileCategory(15, 'F', 27.8);
    expect(res.category).toBe('obesidad');
    expect(res.p95Cutoff).toBe(27.8);
  });

  it('7. Varón 16 años: frontera P85 (25.0) clasifica como sobrepeso', () => {
    const res = getImcPercentileCategory(16, 'M', 25.0);
    expect(res.category).toBe('sobrepeso');
    expect(res.p85Cutoff).toBe(25.0);
  });

  it('8. Mujer 16 años: frontera P85 (25.5) clasifica como sobrepeso', () => {
    const res = getImcPercentileCategory(16, 'F', 25.5);
    expect(res.category).toBe('sobrepeso');
    expect(res.p85Cutoff).toBe(25.5);
  });

  it('9. Varón 17 años: frontera P95 (28.6) clasifica como obesidad', () => {
    const res = getImcPercentileCategory(17, 'M', 28.6);
    expect(res.category).toBe('obesidad');
  });

  it('10. Mujer 17 años: frontera P85 (26.0) clasifica como sobrepeso', () => {
    const res = getImcPercentileCategory(17, 'F', 26.0);
    expect(res.category).toBe('sobrepeso');
  });

  it('11. Varón 18 años: frontera P85 (26.3) y P95 (29.2)', () => {
    const resP85 = getImcPercentileCategory(18, 'M', 26.3);
    expect(resP85.category).toBe('sobrepeso');
    const resP95 = getImcPercentileCategory(18, 'M', 29.2);
    expect(resP95.category).toBe('obesidad');
  });

  it('12. Mujer 18 años: frontera P85 (26.3) y P95 (29.3)', () => {
    const resP85 = getImcPercentileCategory(18, 'F', 26.3);
    expect(resP85.category).toBe('sobrepeso');
    const resP95 = getImcPercentileCategory(18, 'F', 29.3);
    expect(resP95.category).toBe('obesidad');
  });

  it('13. Límite inferior P5 (Bajo Peso): Varón 15 años con IMC 15.99 clasifica como bajo peso', () => {
    const res = getImcPercentileCategory(15, 'M', 15.99);
    expect(res.category).toBe('bajo_peso');
  });

  it('14. Clamping de edad: edad 14.2 clampa a 15 y 18.99 clampa a 18 años', () => {
    const resYoung = getImcPercentileCategory(14.2, 'M', 22.0);
    expect(resYoung.p85Cutoff).toBe(WHO_2007_PERCENTILES.M[15].p85);

    const resSenior = getImcPercentileCategory(18.99, 'F', 22.0);
    expect(resSenior.p85Cutoff).toBe(WHO_2007_PERCENTILES.F[18].p85);
  });

  it('15. Emite obligatoriamente el protocolo bioético de protección y confidencialidad en aula', () => {
    const res = getImcPercentileCategory(16, 'F', 21.0);
    expect(res.protocoloBioetico).toBe(PROTOCOLO_BIOETICO_AULA);
    expect(res.protocoloBioetico).toContain('ESTRICTAMENTE PROHIBIDO el pesaje público');
    expect(res.criterioNormativo).toContain('OMS 2007 Growth Reference');
  });
});
