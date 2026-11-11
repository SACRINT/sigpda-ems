import { describe, expect, it } from 'vitest';
import {
  CURATED_RESOURCES,
  formatCuratedResourcesForPrompt,
  isGenericSearchUrl,
  pickCuratedResourceForText,
} from '@/lib/resources/curated-resources';
import { ensureCuratedResourceList } from '@/lib/guide-engine/writers/writer-contract';

describe('biblioteca curada de recursos', () => {
  it('solo contiene URLs https directas, sin búsquedas genéricas', () => {
    for (const resource of CURATED_RESOURCES) {
      expect(resource.url).toMatch(/^https:\/\//);
      expect(isGenericSearchUrl(resource.url)).toBe(false);
    }
  });

  it('prioriza recursos de cómputo/redes para mantenimiento de PC', () => {
    const resource = pickCuratedResourceForText('mantenimiento de pc, redes y cableado rj45');
    expect(['comptia-aplus', 'comptia-network', 'cisco-netacad', 'conocer']).toContain(resource.id);
  });

  it('genera un bloque de prompt sin google/youtube results', () => {
    const block = formatCuratedResourcesForPrompt('formacion_laboral_industrial_agro_salud');
    expect(block).toMatch(/BIBLIOTECA CURADA/);
    expect(block).not.toContain('google.com/search');
    expect(block).not.toContain('youtube.com/results');
  });

  it('sustituye recursos de búsqueda por una entrada curada', () => {
    const resources = ensureCuratedResourceList(
      [{ titulo: 'Video de mantenimiento', url: 'https://www.youtube.com/results?search_query=pc', tipo: 'video' }],
      { uacName: 'Brinda soporte en software de aplicación y hardware' }
    );
    expect(resources).toHaveLength(1);
    expect(resources[0].url).toMatch(/^https:\/\//);
    expect(isGenericSearchUrl(resources[0].url)).toBe(false);
  });

  it('nunca deja una sesión sin recurso de ampliación', () => {
    const resources = ensureCuratedResourceList([], { uacName: 'Pensamiento Matemático III' });
    expect(resources).toHaveLength(1);
    expect(resources[0].url).toMatch(/^https:\/\//);
  });
});
