import { describe, it, expect } from 'vitest';
import {
  isTechnicalDrawingSubject,
  dispatchVisual,
  dispatchTechnicalDrawing,
} from '@/lib/visual-engine/visual-dispatcher';
import {
  generateMonteaTriplanar,
  generateIsometricPrism,
  generateTechnicalDimensioning,
  generateGeometricConstructions,
} from '@/lib/visual-engine/generators/technical-drawing-generator';

describe('Technical Drawing Visual Generator & Dispatcher (Bug 2)', () => {
  it('correctly identifies technical drawing subjects', () => {
    expect(isTechnicalDrawingSubject('Dibujo Técnico I')).toBe(true);
    expect(isTechnicalDrawingSubject('DIBUJO TÉCNICO II')).toBe(true);
    expect(isTechnicalDrawingSubject('Dibujo Arquitectónico')).toBe(true);
    expect(isTechnicalDrawingSubject('Pensamiento Matemático III')).toBe(false);
    expect(isTechnicalDrawingSubject('Física I')).toBe(false);
  });

  it('generates Montea Triplanar with valid SVG without <text> and with proper annotations', () => {
    const res = generateMonteaTriplanar({ title: 'Vistas Ortogonales Diédricas' });
    expect(res.svg).toContain('<svg');
    expect(res.svg).toContain('</svg>');
    expect(res.svg).not.toContain('<text'); // Invariant: no raw <text> inside SVG to prevent □□□□ rendering
    expect(res.annotations.length).toBeGreaterThan(0);
    expect(res.metadata?.type).toBe('technical_drawing_montea');
  });

  it('generates Isometric Prism with 30° axes and hidden lines', () => {
    const res = generateIsometricPrism();
    expect(res.svg).toContain('<svg');
    expect(res.svg).toContain('stroke-dasharray="4,3"'); // Aristas ocultas
    expect(res.svg).not.toContain('<text');
    expect(res.annotations.some((a) => a.text.includes('30°'))).toBe(true);
    expect(res.metadata?.type).toBe('technical_drawing_isometric');
  });

  it('generates Technical Dimensioning with dimension lines and arrows', () => {
    const res = generateTechnicalDimensioning();
    expect(res.svg).toContain('<svg');
    expect(res.svg).not.toContain('<text');
    expect(res.annotations.some((a) => a.text.includes('COTA TOTAL'))).toBe(true);
    expect(res.metadata?.type).toBe('technical_drawing_dimensioning');
  });

  it('generates Geometric Constructions with oval/tangency curves', () => {
    const res = generateGeometricConstructions();
    expect(res.svg).toContain('<svg');
    expect(res.svg).not.toContain('<text');
    expect(res.annotations.some((a) => a.text.includes('TANGENCIA'))).toBe(true);
    expect(res.metadata?.type).toBe('technical_drawing_geometry');
  });

  it('NEVER dispatches algebraic 2x2 linear equations or parabolas for Dibujo Técnico I even with words like "sistema" or "interseccion"', () => {
    // Before fix, this would return "Sistema de Ecuaciones 2x2: Intersección L₁ y L₂"
    const res = dispatchVisual(
      'Dibujo Técnico I',
      'Intersección de Planos en el Sistema Diédrico Ortogonal',
      'El sistema diédrico permite resolver la intersección de rectas y planos en el espacio',
      1
    );

    expect(res).not.toBeNull();
    // Must NOT be an algebraic equation graph
    expect(res?.metadata?.type).toMatch(/^technical_drawing_/);
    expect(res?.annotations.some((a) => a.text.includes('Sistema de Ecuaciones 2x2'))).toBe(false);
    expect(res?.annotations.some((a) => a.text.includes('f(x) ='))).toBe(false);
    expect(res?.annotations.some((a) => a.text.includes('y = 1x'))).toBe(false);
  });
});

