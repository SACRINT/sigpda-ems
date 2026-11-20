import { describe, expect, it } from 'vitest';
import {
  distillExerciseStatement,
  extractFormulasFromText,
  isCompleteProblemStatement,
  isCompleteMathStep,
  preventSixGramTheoryOverlap,
} from '@/lib/visual-engine/sacrint/content-distiller';
import { toWinAnsiMathSafe } from '@/lib/editorial/text-normalization';
import { separatePasoInline } from '@/lib/pdf-workbook-renderer';
import { scanEditorialDefects } from '../../scripts/qa-sacrint-materials';

describe('P0 regresiones semánticas', () => {
  it('no reemplaza términos disciplinares ni concordancia al evitar 6-gramas', () => {
    const source =
      'La muestra se calcula cada vez que el triángulo tiene un lado y una igualdad algebraica.';
    const result = preventSixGramTheoryOverlap(
      'La muestra se calcula cada vez que el triángulo tiene un lado y una igualdad algebraica.',
      [source]
    );
    expect(result).not.toMatch(/subconjunto/i);
    expect(result).not.toMatch(/\btodo\b/i);
    expect(result).not.toMatch(/polígono/i);
    expect(result).not.toMatch(/costado/i);
    expect(result).not.toMatch(/equivalencia/i);
  });

  it('conserva datos y pregunta completa al destilar una actividad', () => {
    const raw =
      'El terreno comunitario tiene un largo de 12 metros y ancho de 9 metros. Si lo divides en dos triángulos mediante una diagonal de 10 metros, ¿cuál es el área total del terreno?';
    const result = distillExerciseStatement(raw, 190, 30);
    expect(result).toContain('12 m');
    expect(result).toContain('9 m');
    expect(result).toContain('¿cuál es el área total del terreno?');
  });

  it('acepta ejemplos y pasos cualitativos/geométricos completos', () => {
    expect(
      isCompleteProblemStatement(
        'Observa la figura geométrica y clasifica los ángulos según su abertura y posición relativa en el diseño estructural.'
      )
    ).toBe(true);
    expect(
      isCompleteMathStep(
        'Clasifica los ángulos según su abertura y justifica la relación con la estructura observada.'
      )
    ).toBe(true);
  });

  it('extrae ecuaciones completas y no sub-igualdades parciales', () => {
    const formulas = extractFormulasFromText(
      'La ecuación es 12 * x = 1,800 y también 52 + 38 + x = 180.'
    );
    expect(formulas.some((formula) => formula.includes('12 * x = 1,800') || formula.includes('12 * x = 1800'))).toBe(
      true
    );
    expect(formulas.some((formula) => formula.includes('52 + 38 + x = 180'))).toBe(true);
    expect(formulas).not.toContain('x = 1,800');
    expect(formulas).not.toContain('x = 180');
  });

  it('conserva el glifo √ en lugar de degradarlo a sqrt o V', () => {
    const out = toWinAnsiMathSafe('√25');
    expect(out).not.toMatch(/raiz/i);
    expect(out).not.toContain('sqrt');
    expect(out).not.toMatch(/\bV\b/);
    expect(out).toContain('√');
  });

  it('separa Paso N pegado después de una operación', () => {
    const out = separatePasoInline('x = 2700 / 450.Paso 4: Verifica el resultado.');
    expect(out).toMatch(/450\.\s*\n+\s*Paso 4:/);
  });

  it('no marca diseño? como pregunta colgada', () => {
    const findings = scanEditorialDefects('¿El diseño?');
    expect(findings.dangling_question ?? []).toHaveLength(0);
  });
});
