import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getPublishedKnowledgePages } from '@/lib/knowledge/knowledge-repository';
import { isFeatureEnabled } from '@/lib/platform/feature-flags';
import {
  DOMAIN_ROUTING,
  KNOWLEDGE_BLOCK_END,
  KNOWLEDGE_BLOCK_START,
  getInstitutionalContext,
} from '@/lib/institutional-context';
import type { KnowledgePageRow } from '@/lib/knowledge/knowledge-repository';

vi.mock('@/lib/knowledge/knowledge-repository', () => ({
  getPublishedKnowledgePages: vi.fn(),
}));

vi.mock('@/lib/platform/feature-flags', () => ({
  isFeatureEnabled: vi.fn(),
}));

const mockedPages = vi.mocked(getPublishedKnowledgePages);
const mockedFlags = vi.mocked(isFeatureEnabled);

function page(overrides: Partial<KnowledgePageRow> & Pick<KnowledgePageRow, 'slug' | 'dominio'>): KnowledgePageRow {
  return {
    titulo: overrides.slug,
    contenido: `# ${overrides.slug}\n\nContenido específico de ${overrides.slug}.`,
    applicable_a: ['planeacion', 'editorial', 'pmc', 'pips', 'paec'],
    token_count: 10,
    compilado_con: null,
    prompt_version: null,
    uac_slugs: overrides.uac_slugs ?? [],
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedFlags.mockImplementation((flag: string) => flag === 'KNOWLEDGE_LAYER_ENABLED');
});

describe('institutional-context · fachada de contexto', () => {
  it('devuelve bloque vacío cuando la capa está desactivada', async () => {
    mockedFlags.mockReturnValue(false);
    const result = await getInstitutionalContext('pmc');
    expect(result.block).toBe('');
    expect(result.sources).toHaveLength(0);
    expect(mockedPages).not.toHaveBeenCalled();
  });

  it('PMC recibe normativo + metodológico, nunca curricular', async () => {
    mockedPages.mockResolvedValue([
      page({ slug: 'normativa/marco-pmc', dominio: 'normativo' }),
      page({ slug: 'didactica/anexo-12', dominio: 'metodologico' }),
      page({ slug: 'curriculo/uac-pm3', dominio: 'curricular' }),
    ]);

    const result = await getInstitutionalContext('pmc');

    expect(result.block).toContain(KNOWLEDGE_BLOCK_START);
    expect(result.block).toContain(KNOWLEDGE_BLOCK_END);
    expect(result.block).toContain('normativa/marco-pmc');
    expect(result.block).toContain('didactica/anexo-12');
    expect(result.block).not.toContain('curriculo/uac-pm3');
  });

  it('Planeación y Editorial jamás reciben dominio normativo (regla D7)', async () => {
    mockedPages.mockResolvedValue([
      page({
        slug: 'normativa/ley-filtrada',
        dominio: 'normativo',
        // Dato sucio en BD: aunque diga planeacion, el dominio legal se filtra.
        applicable_a: ['planeacion', 'editorial'],
      }),
      page({ slug: 'didactica/evaluacion-formativa', dominio: 'metodologico' }),
    ]);

    for (const generator of ['planeacion', 'editorial'] as const) {
      const result = await getInstitutionalContext(generator);
      expect(result.block).not.toContain('normativa/ley-filtrada');
      expect(result.block).toContain('didactica/evaluacion-formativa');
    }
  });

  it('respeta el presupuesto de tokens y trunca la última página', async () => {
    mockedPages.mockResolvedValue([
      page({
        slug: 'didactica/enorme',
        dominio: 'metodologico',
        contenido: `# Enorme\n\n${'contenido '.repeat(5000)}`,
      }),
    ]);

    const result = await getInstitutionalContext('planeacion', { maxTokens: 200 });
    expect(result.tokens).toBeLessThanOrEqual(220);
    expect(result.block).toContain('…');
  });

  it('normaliza uacName y respeta el presupuesto de 600 tokens en planeación', async () => {
    mockedPages.mockResolvedValue([
      page({ slug: 'didactica/dua', dominio: 'metodologico' }),
      page({
        slug: 'curriculo/submodulo-2-soluciona-problemas-con-lenguaje-natural',
        dominio: 'curricular',
        uac_slugs: ['submodulo-2-soluciona-problemas-con-lenguaje-natural'],
      }),
      page({
        slug: 'curriculo/otra-uac',
        dominio: 'curricular',
        uac_slugs: ['otra-uac'],
      }),
    ]);

    const result = await getInstitutionalContext('planeacion', {
      maxTokens: 600,
      uacName: 'Submódulo 2: Soluciona problemas con lenguaje natural',
      semester: 3,
    });

    expect(result.tokens).toBeLessThanOrEqual(620);
    expect(result.block).toContain('didactica/dua');
    expect(result.block).toContain('submodulo-2-soluciona-problemas-con-lenguaje-natural');
    expect(result.block).not.toContain('curriculo/otra-uac');
  });

  it('balancea presupuesto curricular y metodológico sin excluir la UAC', async () => {
    mockedPages.mockResolvedValue([
      page({
        slug: 'didactica/dua',
        dominio: 'metodologico',
        contenido: `# DUA\n\n${'metodologia '.repeat(1000)}`,
      }),
      page({
        slug: 'curriculo/lengua-y-comunicacion',
        dominio: 'curricular',
        uac_slugs: ['lengua-y-comunicacion-i'],
        contenido: `# Lengua\n\n${'curricular '.repeat(1000)}`,
      }),
    ]);

    const result = await getInstitutionalContext('planeacion', {
      uacName: 'Lengua y Comunicación I',
      semester: 1,
    });

    expect(result.tokens).toBeLessThanOrEqual(850);
    expect(result.sources.map((source) => source.dominio)).toContain('metodologico');
    expect(result.sources.map((source) => source.dominio)).toContain('curricular');
  });

  it('prioriza páginas con priority alta dentro del mismo dominio', async () => {
    mockedPages.mockResolvedValue([
      page({ slug: 'normativa/z-prioridad-baja', dominio: 'normativo', priority: 0 }),
      page({ slug: 'normativa/z-compendio', dominio: 'normativo', priority: 100 }),
    ]);

    const result = await getInstitutionalContext('pmc');
    expect(result.sources[0]?.slug).toBe('normativa/z-compendio');
  });

  it('fail-open: si el repositorio falla, devuelve vacío sin lanzar', async () => {
    mockedPages.mockRejectedValue(new Error('BD caída'));
    const result = await getInstitutionalContext('pmc');
    expect(result.block).toBe('');
    expect(result.tokens).toBe(0);
  });

  it('el enrutamiento de dominios es coherente con la matriz aprobada', () => {
    expect(DOMAIN_ROUTING.pmc).toEqual(['normativo', 'metodologico']);
    expect(DOMAIN_ROUTING.pips).toEqual(['normativo', 'metodologico']);
    expect(DOMAIN_ROUTING.paec).toEqual(['metodologico', 'curricular']);
    expect(DOMAIN_ROUTING.planeacion).toEqual(['metodologico', 'curricular']);
    expect(DOMAIN_ROUTING.editorial).toEqual(['metodologico', 'curricular']);
  });
});
