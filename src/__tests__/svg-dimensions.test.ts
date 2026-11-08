import { describe, it, expect } from 'vitest';
import { extractSvgDimensions, fitSvgToWidth } from '@/lib/visual-engine/svg-dimensions';

const svg = (attrs: string) => `<svg xmlns="http://www.w3.org/2000/svg" ${attrs}><rect/></svg>`;

describe('svg-dimensions: proporción real del SVG', () => {
  it.each([
    [500, 350],
    [460, 260],
    [460, 240],
  ])('lee viewBox %ix%i aunque width/height sean 100%%', (w, h) => {
    const dim = extractSvgDimensions(svg(`viewBox="0 0 ${w} ${h}" width="100%" height="100%"`));
    expect(dim).toEqual({ width: w, height: h });
  });

  it('usa width/height absolutos como respaldo', () => {
    expect(extractSvgDimensions(svg('width="400" height="300"'))).toEqual({ width: 400, height: 300 });
  });

  it('cae a 500x350 si no hay dimensiones válidas', () => {
    expect(extractSvgDimensions(svg('width="100%" height="100%"'))).toEqual({ width: 500, height: 350 });
    expect(extractSvgDimensions('')).toEqual({ width: 500, height: 350 });
  });

  it('fitSvgToWidth conserva la relación de aspecto (nunca 0.25 como el bug original)', () => {
    const r = fitSvgToWidth(svg('viewBox="0 0 500 350"'), 100);
    expect(r.height).toBeCloseTo(70, 5);
    expect(r.height / r.width).toBeGreaterThan(0.5);
    const r2 = fitSvgToWidth(svg('viewBox="0 0 460 240"'), 92);
    expect(r2.height).toBeCloseTo(92 * (240 / 460), 5);
    expect(r2.svgWidth).toBe(460);
    expect(r2.svgHeight).toBe(240);
  });
});

