import { describe, it, expect, vi } from 'vitest';
import { jsPDF } from 'jspdf';
import { overlaps, drawImageSafe, WATERMARK_OPACITY, type BoundingBox } from '@/lib/visual-engine/pdf-layout-guard';
import { drawEquipmentCardWidget } from '@/lib/visual-engine/pdf-components-widgets';
import type { DetectedObject } from '@/lib/visual-engine/object-extractor';

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

function opacitiesOf(spy: { mock: { calls: unknown[][] } }): number[] {
  return spy.mock.calls.map((c) => (c[0] as { opacity: number }).opacity);
}

describe('H-9 — pdf-layout-guard: colisión imagen-texto con watermark', () => {
  it('overlaps: detecta solape AABB y descarta bordes que solo se tocan', () => {
    const a: BoundingBox = { x: 0, y: 0, w: 10, h: 10 };
    expect(overlaps(a, { x: 5, y: 5, w: 10, h: 10 })).toBe(true);
    expect(overlaps(a, { x: 10, y: 0, w: 5, h: 5 })).toBe(false); // solo comparten borde
    expect(overlaps(a, { x: 20, y: 20, w: 5, h: 5 })).toBe(false);
    expect(overlaps(a, { x: -5, y: -5, w: 30, h: 30 })).toBe(true); // contención
  });

  it('drawImageSafe: sin colisión dibuja la imagen normal y no toca la opacidad', () => {
    const doc = new jsPDF();
    const gStateSpy = vi.spyOn(doc, 'setGState');
    const addImageSpy = vi.spyOn(doc, 'addImage');

    const watermarked = drawImageSafe(doc, PNG_1X1, 'PNG', { x: 10, y: 10, w: 20, h: 20 }, [
      { x: 100, y: 100, w: 20, h: 20 },
    ]);

    expect(watermarked).toBe(false);
    expect(addImageSpy).toHaveBeenCalledTimes(1);
    expect(gStateSpy).not.toHaveBeenCalled();
  });

  it('drawImageSafe: con colisión dibuja a 0.12 de opacidad y restaura 1.0 después', () => {
    const doc = new jsPDF();
    const calls: string[] = [];
    const gStateSpy = vi.spyOn(doc, 'setGState').mockImplementation((g) => {
      calls.push(`gstate:${(g as unknown as { opacity: number }).opacity}`);
      return doc;
    });
    vi.spyOn(doc, 'addImage').mockImplementation(() => {
      calls.push('addImage');
      return doc;
    });

    const watermarked = drawImageSafe(doc, PNG_1X1, 'PNG', { x: 10, y: 10, w: 20, h: 20 }, [
      { x: 15, y: 15, w: 20, h: 5 },
    ]);

    expect(watermarked).toBe(true);
    expect(WATERMARK_OPACITY).toBe(0.12);
    expect(opacitiesOf(gStateSpy)).toEqual([0.12, 1]);
    // La imagen se pinta entre la bajada y la restauración de opacidad (queda DEBAJO del texto posterior)
    expect(calls).toEqual(['gstate:0.12', 'addImage', 'gstate:1']);
  });

  it('drawImageSafe: restaura la opacidad aunque addImage falle', () => {
    const doc = new jsPDF();
    const gStateSpy = vi.spyOn(doc, 'setGState');
    vi.spyOn(doc, 'addImage').mockImplementation(() => {
      throw new Error('imagen inválida');
    });
    expect(() =>
      drawImageSafe(doc, PNG_1X1, 'PNG', { x: 0, y: 0, w: 10, h: 10 }, [{ x: 0, y: 0, w: 10, h: 10 }])
    ).toThrow('imagen inválida');
    expect(opacitiesOf(gStateSpy)).toEqual([0.12, 1]);
  });
});

describe('H-9 — drawEquipmentCardWidget: tarjeta comprimida degrada la imagen a watermark', () => {
  const detected: DetectedObject = {
    id: 'multimetro',
    name: 'Multímetro digital de banco con puntas de prueba y selector rotatorio de rango',
    category: 'instrumento_medicion',
    englishQuery: 'digital multimeter',
    keywordsBilingual: ['multimetro'],
    technicalRole: 'Mide voltaje, corriente y resistencia en circuitos de práctica con seguridad eléctrica.',
    safetyRule: 'Verificar la escala antes de conectar y nunca medir resistencia con el circuito energizado.',
    svgKey: 'multimetro',
    matchedText: 'multimetro',
    source: 'catalog',
    confidence: 1,
  };

  it('espacio holgado: la imagen queda arriba del texto y se dibuja opaca (sin watermark)', () => {
    const doc = new jsPDF();
    const gStateSpy = vi.spyOn(doc, 'setGState');
    drawEquipmentCardWidget(doc, {
      detected,
      imageBuffer: PNG_1X1,
      imageFormat: 'PNG',
      sideXAbs: 150,
      sideW: 50,
      startY: 30,
      sideBottom: 250,
    });
    expect(opacitiesOf(gStateSpy)).not.toContain(0.12);
  });

  it('espacio ajustado: la imagen se escala proporcionalmente para caber apilada sin degradarse a watermark (REG-2)', () => {
    const doc = new jsPDF();
    const gStateSpy = vi.spyOn(doc, 'setGState');
    const textSpy = vi.spyOn(doc, 'text');
    const addImageSpy = vi.spyOn(doc, 'addImage');

    drawEquipmentCardWidget(doc, {
      detected,
      imageBuffer: PNG_1X1,
      imageFormat: 'PNG',
      sideXAbs: 150,
      sideW: 50,
      startY: 30,
      sideBottom: 70, // availH = 40 → tarjeta comprimida (< layout apilado)
    });

    // REG-2: No debe degradarse a watermark 0.12 invisible
    expect(opacitiesOf(gStateSpy)).not.toContain(0.12);
    expect(addImageSpy).toHaveBeenCalledTimes(1);
    const addedW = (addImageSpy.mock.calls[0] as unknown[])[4] as number;
    const addedH = (addImageSpy.mock.calls[0] as unknown[])[5] as number;
    expect(addedH).toBeLessThanOrEqual(24);
    expect(addedW).toBeLessThanOrEqual(38);
    expect(textSpy).toHaveBeenCalled();
  });
});
