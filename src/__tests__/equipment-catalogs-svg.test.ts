import { describe, it, expect } from 'vitest';
import { CIENCIAS_EXPERIMENTALES_CATALOG } from '@/lib/visual-engine/catalogs/ciencias-experimentales';
import { generateObjectBlueprintSvg } from '@/lib/visual-engine/object-svg-generator';

describe('F-65: Equipment Catalogs SVG Mapping Verification', () => {
  it('las entradas de calculadora y reloj checador no mapean a multímetro', () => {
    const calcEntry = CIENCIAS_EXPERIMENTALES_CATALOG.find((e) => e.id.includes('calculadora'));
    expect(calcEntry).toBeDefined();
    expect(calcEntry?.svgKey).not.toBe('multimetro');
    expect(calcEntry?.svgKey).toBe('calculadora');

    const checadorEntry = CIENCIAS_EXPERIMENTALES_CATALOG.find((e) => e.id.includes('checador'));
    expect(checadorEntry).toBeDefined();
    expect(checadorEntry?.svgKey).not.toBe('multimetro');
    expect(checadorEntry?.svgKey).toBe('reloj_checador');
  });

  it('genera SVG válido para la plantilla de calculadora científica', () => {
    const svg = generateObjectBlueprintSvg('calculadora', 'Calculadora Científica');
    expect(svg).toContain('<svg');
    expect(svg).toContain('sin(45°) = √2/2');
    expect(svg).toContain('DEG · STAT · Math');
    expect(svg).not.toContain('127.4'); // no debe ser multímetro
  });

  it('genera SVG válido para la plantilla de reloj checador biométrico', () => {
    const svg = generateObjectBlueprintSvg('reloj_checador', 'Reloj Checador Biométrico');
    expect(svg).toContain('<svg');
    expect(svg).toContain('ASISTENCIA CORRECTA');
    expect(svg).not.toContain('127.4'); // no debe ser multímetro
  });
});
