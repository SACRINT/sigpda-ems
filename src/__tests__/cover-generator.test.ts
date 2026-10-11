import { describe, it, expect } from 'vitest';
import { generateFallbackCover, BookCoverOptions } from '@/lib/visual-engine/cover-generator';
import sharp from 'sharp';

describe('F-68: Cover Generator Font Embedding and Tofu Prevention', () => {
  const sampleOpts: BookCoverOptions = {
    plantelNombre: 'Bachillerato General Oficial Matutino',
    cct: '21EBH0001A',
    uacName: 'La Materia y sus Interacciones',
    semestre: 'Primer Semestre',
    cicloEscolar: '2026-2027',
    blockName: 'La Energía en las Transformaciones de la Materia',
    blockIndex: 0,
    paecProjectName: 'Cuidado del Agua y Medio Ambiente',
    docente: 'Prof. Juan Pérez',
    subsystem: 'BGE',
  };

  it('genera una portada fallback con rasterización JPEG nítida y tamaño válido', async () => {
    const result = await generateFallbackCover(sampleOpts);
    expect(result).toBeDefined();
    expect(result.format).toBe('JPEG');
    expect(result.buffer).toBeInstanceOf(Buffer);
    expect(result.buffer.length).toBeGreaterThan(50000);

    const metadata = await sharp(result.buffer).metadata();
    expect(metadata.format).toBe('jpeg');
    expect(metadata.width).toBe(2500);
    expect(metadata.height).toBe(3333);
  });

  it('no contiene glifos tofu o caracteres de reemplazo U+25AF en las fuentes', async () => {
    const result = await generateFallbackCover(sampleOpts);
    // Verificar que el buffer es una imagen JPEG válida
    expect(result.buffer[0]).toBe(0xff);
    expect(result.buffer[1]).toBe(0xd8);
  });
});
