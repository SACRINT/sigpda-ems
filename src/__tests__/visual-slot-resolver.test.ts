import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveVisualForMission } from '@/lib/visual-engine/visual-asset-manager';
import { detectCatalogMaterials } from '@/lib/materials/auto-tokenize';
import * as openverseClient from '@/lib/visual-engine/openverse-client';
import fs from 'fs';

describe('visual-slot-resolver — Precedencia y resolución unificada de recursos visuales', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. detectCatalogMaterials("Práctica con multímetro y probeta") detecta ambos materiales', () => {
    const matches = detectCatalogMaterials('Práctica con multímetro y probeta');
    expect(matches.length).toBeGreaterThanOrEqual(2);
    const slugs = matches.map((m) => m.slug);
    expect(slugs).toContain('multimetro');
    expect(slugs).toContain('probeta');
  });

  it('2. resolveVisualForMission con preferOpenverseMedia: false y contexto con material resuelve material_png', async () => {
    const res = await resolveVisualForMission({
      uacName: 'Física I',
      blockIndex: 0,
      missionIndex: 1,
      missionTitle: 'Medición de Voltaje',
      contextText: 'En esta práctica utilizaremos el multímetro digital para medir voltaje.',
      preferOpenverseMedia: false,
    });

    expect(res).not.toBeNull();
    expect(res?.type).toBe('material_png');
    expect(res?.materialSlug).toBe('multimetro');
    expect(res?.materialPngPath).toBe('/images/materiales/multimetro.png');
  });

  it('3. con preferOpenverseMedia: true y Openverse devolviendo [] cae a material_png (no a vector_svg)', async () => {
    vi.spyOn(openverseClient, 'searchOpenverseImages').mockResolvedValue([]);

    const res = await resolveVisualForMission({
      uacName: 'Ciencias Naturales',
      blockIndex: 0,
      missionIndex: 2,
      missionTitle: 'Práctica de Laboratorio',
      contextText: 'Llenar la probeta de laboratorio con solución salina.',
      preferOpenverseMedia: true,
    });

    expect(res).not.toBeNull();
    expect(res?.type).toBe('material_png');
    expect(res?.materialSlug).toBe('probeta');
  });

  it('4. con preferOpenverseMedia: true y candidato de Openverse devuelve openverse_media', async () => {
    vi.spyOn(openverseClient, 'searchOpenverseImages').mockResolvedValue([
      {
        id: 'ov-test-1',
        title: 'Microscopio en laboratorio',
        creator: 'Openverse User',
        license: 'cc-by',
        foreignLandingUrl: 'https://openverse.org/image/ov-test-1',
        url: 'https://images.openverse.org/test.jpg',
        thumbnail: 'https://images.openverse.org/test-thumb.jpg',
        caption: 'Microscopio óptico escolar',
      },
    ]);

    const res = await resolveVisualForMission({
      uacName: 'Biología',
      blockIndex: 0,
      missionIndex: 1,
      missionTitle: 'Observación Celular',
      contextText: 'Usaremos un microscopio para observar células de cebolla.',
      preferOpenverseMedia: true,
    });

    expect(res).not.toBeNull();
    expect(res?.type).toBe('openverse_media');
    expect(res?.mediaAsset?.externalId).toBe('ov-test-1');
  });

  it('5. Contexto sin mención de materiales devuelve vector_svg (comportamiento base intacto)', async () => {
    const res = await resolveVisualForMission({
      uacName: 'Pensamiento Matemático I',
      blockIndex: 0,
      missionIndex: 1,
      missionTitle: 'Ecuaciones Cuadráticas',
      contextText: 'Análisis puramente algebraico de la parábola y sus raíces.',
      preferOpenverseMedia: false,
    });

    expect(res).not.toBeNull();
    expect(res?.type).toBe('vector_svg');
    expect(res?.svg).toBeDefined();
  });

  it('6. Deduplicación con usedAssetIds: no repite el mismo slug', async () => {
    const used = new Set<string>();

    const res1 = await resolveVisualForMission({
      uacName: 'Electricidad',
      blockIndex: 0,
      missionIndex: 1,
      missionTitle: 'Circuito 1',
      contextText: 'Medición con multímetro y taladro en banco de trabajo.',
      preferOpenverseMedia: false,
      usedAssetIds: used,
    });

    expect(res1?.type).toBe('material_png');
    const firstSlug = res1?.materialSlug;
    expect(used.has(`material:${firstSlug}`)).toBe(true);

    const res2 = await resolveVisualForMission({
      uacName: 'Electricidad',
      blockIndex: 0,
      missionIndex: 2,
      missionTitle: 'Circuito 2',
      contextText: 'Medición con multímetro y taladro en banco de trabajo.',
      preferOpenverseMedia: false,
      usedAssetIds: used,
    });

    expect(res2?.type).toBe('material_png');
    expect(res2?.materialSlug).not.toBe(firstSlug);
  });

  it('7. Si el archivo PNG físico no existe, degrada limpiamente a vector_svg (D9)', async () => {
    // Interceptar fs.existsSync solo para paths de materiales
    const originalExistsSync = fs.existsSync;
    vi.spyOn(fs, 'existsSync').mockImplementation((p: fs.PathLike) => {
      if (typeof p === 'string' && p.includes('materiales')) {
        return false;
      }
      return originalExistsSync(p);
    });

    const res = await resolveVisualForMission({
      uacName: 'Pensamiento Matemático I',
      blockIndex: 0,
      missionIndex: 1,
      missionTitle: 'Plano Cartesiano',
      contextText: 'Práctica con multímetro digital en el aula.',
      preferOpenverseMedia: false,
    });

    expect(res).not.toBeNull();
    // Al no existir el PNG físico, degrada a vector_svg
    expect(res?.type).toBe('vector_svg');
  });
});
