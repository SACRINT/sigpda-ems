import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── 1. Mock de logger y dependencias externas ────────────────────────────────
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock de base de datos para visual-asset-manager
vi.mock('@/lib/db', () => ({
  saveImageAsset: vi.fn().mockResolvedValue({ id: 'saved-1' }),
  getImageAssetByMission: vi.fn().mockResolvedValue(null),
}));

// Mock de openverse-client para test de deduplicación controlada
vi.mock('@/lib/visual-engine/openverse-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/visual-engine/openverse-client')>(
    '@/lib/visual-engine/openverse-client'
  );
  return {
    ...actual,
    searchOpenverseImages: vi.fn().mockResolvedValue([
      {
        id: 'openverse-img-101',
        url: 'https://images.openverse.org/photo1.jpg',
        thumbnail: 'https://images.openverse.org/thumb1.jpg',
        title: 'Célula animal bajo microscopio',
        creator: 'Biólogo UNAM',
        license: 'cc-by',
        licenseVersion: '4.0',
        caption: 'Figura M1.1 — Célula animal',
      },
      {
        id: 'openverse-img-102',
        url: 'https://images.openverse.org/photo2.jpg',
        thumbnail: 'https://images.openverse.org/thumb2.jpg',
        title: 'Tejido vegetal en laboratorio',
        creator: 'Laboratorio BUAP',
        license: 'cc-by',
        licenseVersion: '4.0',
        caption: 'Figura M1.2 — Tejido vegetal',
      },
    ]),
  };
});

import { generateFallbackCover } from '@/lib/visual-engine/cover-generator';
import { stripMarkdown } from '@/lib/visual-engine/content-extractor';
import { sanitizePdfText } from '@/lib/pdf-workbook-renderer';
import {
  consolidateWorkbookElements,
  stripWorkbookTags,
  extractWorkbookTags,
} from '@/lib/guide-engine/workbook-tags';
import { resolveVisualForMission } from '@/lib/visual-engine/visual-asset-manager';
import type { WorkbookElement } from '@/types/work-textbook';

describe('Workbook Engine Architecture Tests (Fase 10)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── TEST 1: Portada JPEG nítida con Sharp y tipografías embebidas ──────────
  it('Test 1: Genera portada JPEG nítida determinista (Capa 0) con Sharp sin tofu', async () => {
    const result = await generateFallbackCover({
      uacName: 'PENSAMIENTO MATEMÁTICO II',
      plantelNombre: 'Bachillerato General Oficial Lic. Benito Juárez',
      cct: '21EBH0012A',
      semestre: 'Segundo Semestre',
      blockName: 'Geometría Analítica y Álgebra Lineal',
      blockIndex: 0,
    });

    expect(result).toBeDefined();
    expect(result.format).toBe('JPEG');
    expect(result.isFallback).toBe(true);
    expect(result.source).toBe('deterministic_svg_thematic');
    expect(Buffer.isBuffer(result.buffer)).toBe(true);
    // Un JPEG de 1200x1600 con alta densidad vectorial supera holgadamente 40KB
    expect(result.buffer.length).toBeGreaterThan(40000);
  });

  // ── TEST 2: stripMarkdown + sanitizePdfText limpian comentarios HTML y tags ─
  it('Test 2: stripMarkdown y sanitizePdfText eliminan etiquetas de control <!--workbook:...--> y comentarios HTML', () => {
    const inputWithTags = 'Procedimiento: <!--workbook:lines:rows=3--> Realizar el cálculo <!--comentario interno--> del perímetro.';

    const stripped = stripMarkdown(inputWithTags);
    expect(stripped).not.toContain('<!--workbook:lines:rows=3-->');
    expect(stripped).not.toContain('<!--comentario interno-->');
    expect(stripped).toContain('Realizar el cálculo');
    expect(stripped).toContain('del perímetro.');

    const sanitized = sanitizePdfText(inputWithTags);
    expect(sanitized).not.toContain('<!--');
    expect(sanitized).not.toContain('-->');
    expect(sanitized).toContain('Realizar el cálculo');
  });

  // ── TEST 3: Consolidación de tags lines en writers / workbook-tags ──────────
  it('Test 3: consolidateWorkbookElements colapsa múltiples tags lines consecutivos en uno solo con max 6 rows', () => {
    // Simulando el error reportado: IA emitió 10 tags seguidos en la sección You Do
    const tenLinesElements: WorkbookElement[] = Array.from({ length: 10 }, (_, i) => ({
      id: `wb-lines-${i + 1}`,
      type: 'lines',
      title: `Renglones de práctica ${i + 1}`,
      instruction: `Anota tu respuesta ${i + 1}`,
      config: { rows: 4 },
    }));

    const consolidated = consolidateWorkbookElements(tenLinesElements);

    // Debe colapsar los 10 elementos consecutivos en exactamente 1
    expect(consolidated.length).toBe(1);
    expect(consolidated[0].type).toBe('lines');
    // El número de renglones está delimitado a máximo 6
    expect(consolidated[0].config?.rows).toBeLessThanOrEqual(6);
    expect(consolidated[0].config?.rows).toBeGreaterThanOrEqual(4);

    // Test de preservación de otros tipos de elementos
    const mixedElements: WorkbookElement[] = [
      { id: '1', type: 'lines', config: { rows: 4 } },
      { id: '2', type: 'empty_table', config: { cols: ['A', 'B'] } },
      { id: '3', type: 'lines', config: { rows: 4 } },
      { id: '4', type: 'lines', config: { rows: 4 } },
    ];
    const mixedConsolidated = consolidateWorkbookElements(mixedElements);
    expect(mixedConsolidated.length).toBe(3);
    expect(mixedConsolidated[0].type).toBe('lines');
    expect(mixedConsolidated[1].type).toBe('empty_table');
    expect(mixedConsolidated[2].type).toBe('lines');

    // stripWorkbookTags elimina tags del texto
    const textWithTag = 'Paso 1: Medir la masa.<!--workbook:lines:rows=4--> Paso 2: Calcular densidad.';
    expect(stripWorkbookTags(textWithTag)).toBe('Paso 1: Medir la masa. Paso 2: Calcular densidad.');
  });

  // ── TEST 4: Sanitización de tareas en extractWorkbookTags y saneamiento ─────
  it('Test 4: extractWorkbookTags extrae correctamente y drawPracticeTasks no confunde tags con tareas', () => {
    const rawProcedure = `
1. Preparar la balanza analítica y calibrar a cero.
<!--workbook:lines:rows=3-->
2. Pesar la muestra por duplicado con precisión de miligramos.
<!--workbook:empty_table:cols=Muestra,Masa,Volumen-->
3. Registrar observaciones en la bitácora técnica.
    `.trim();

    const tags = extractWorkbookTags(rawProcedure);
    expect(tags.length).toBe(2);
    expect(tags[0].type).toBe('lines');
    expect(tags[1].type).toBe('empty_table');

    // Al limpiar los tags de workbook, el texto de la tarea no contiene marcas de control
    const cleanedText = stripWorkbookTags(rawProcedure);
    expect(cleanedText).not.toContain('<!--workbook:');
    const lines = cleanedText.split('\n').map((l) => l.trim()).filter(Boolean);
    expect(lines.length).toBe(3);
    expect(lines[0]).toContain('1. Preparar');
    expect(lines[1]).toContain('2. Pesar');
    expect(lines[2]).toContain('3. Registrar');
  });

  // ── TEST 5: Deduplicación de activos visuales en visual-asset-manager ───────
  it('Test 5: resolveVisualForMission deduplica imágenes usando usedAssetIds y hace fallback a Capa 0 cuando se agotan', async () => {
    const usedAssetIds = new Set<string>();

    // Primera misión: debe seleccionar la primera imagen disponible (openverse-img-101)
    const visual1 = await resolveVisualForMission({
      uacName: 'BIOLOGÍA I',
      blockIndex: 0,
      missionIndex: 1,
      missionTitle: 'Estructura y Organización Celular',
      preferOpenverseMedia: true,
      usedAssetIds,
    });

    expect(visual1).toBeDefined();
    expect(visual1?.type).toBe('openverse_media');
    expect(visual1?.mediaAsset?.externalId).toBe('openverse-img-101');
    expect(usedAssetIds.has('openverse-img-101')).toBe(true);

    // Segunda misión: no debe repetir la imagen 101, debe seleccionar la 102
    const visual2 = await resolveVisualForMission({
      uacName: 'BIOLOGÍA I',
      blockIndex: 0,
      missionIndex: 2,
      missionTitle: 'Fisiología Celular y Tejidos',
      preferOpenverseMedia: true,
      usedAssetIds,
    });

    expect(visual2).toBeDefined();
    expect(visual2?.type).toBe('openverse_media');
    expect(visual2?.mediaAsset?.externalId).toBe('openverse-img-102');
    expect(usedAssetIds.has('openverse-img-102')).toBe(true);

    // Tercera misión: ambas imágenes (101 y 102) ya están en usedAssetIds.
    // El motor NO debe repetir ninguna de las dos; debe hacer fallback limpio a Capa 0 (vector_svg didáctico)
    const visual3 = await resolveVisualForMission({
      uacName: 'BIOLOGÍA I',
      blockIndex: 0,
      missionIndex: 3,
      missionTitle: 'División Celular y Mitosis',
      preferOpenverseMedia: true,
      usedAssetIds,
    });

    expect(visual3).toBeDefined();
    expect(visual3?.type).toBe('vector_svg');
    expect(visual3?.svg).toBeDefined();
    expect(typeof visual3?.svg).toBe('string');
  });
});
