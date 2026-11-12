import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getInstitutionalContext } from '@/lib/institutional-context';
import * as featureFlags from '@/lib/platform/feature-flags';
import * as repo from '@/lib/knowledge/knowledge-repository';
import type { KnowledgePageRow } from '@/lib/knowledge/knowledge-repository';

describe('Capa de Conocimiento SEP (AIC-SEP) — Runtime & Context Injection', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    repo.invalidateKnowledgeCache();
  });

  const mockPages: KnowledgePageRow[] = [
    {
      slug: 'didactica/evaluacion-formativa-anexo-12',
      dominio: 'metodologico',
      titulo: 'Evaluación Formativa y Criterios del Anexo 12 USICAMM MCCEMS',
      contenido: 'El Anexo 12 de USICAMM establece la evaluación formativa y situada...',
      applicable_a: ['planeacion', 'editorial'],
      token_count: 50,
      compilado_con: 'gemini-3.5-flash-lite',
      prompt_version: 'v1',
      uac_slugs: [],
      updated_at: new Date().toISOString(),
    },
    {
      slug: 'didactica/dua-puebla-mccems',
      dominio: 'metodologico',
      titulo: 'Diseño Universal para el Aprendizaje en el MCCEMS Puebla',
      contenido: 'El DUA derriba barreras para el aprendizaje y la participación BAP...',
      applicable_a: ['planeacion', 'editorial'],
      token_count: 60,
      compilado_con: 'gemini-3.5-flash-lite',
      prompt_version: 'v1',
      uac_slugs: [],
      updated_at: new Date().toISOString(),
    },
    {
      slug: 'curriculo/pensamiento-matematico',
      dominio: 'curricular',
      titulo: 'Pensamiento Matemático en el MCCEMS',
      contenido: 'Categorías procedural, procesos de razonamiento y modelación matemática...',
      applicable_a: ['planeacion', 'editorial'],
      token_count: 80,
      compilado_con: 'gemini-3.5-flash-lite',
      prompt_version: 'v1',
      uac_slugs: ['pensamiento-matematico-i', 'pensamiento-matematico-ii', 'pensamiento-matematico-iii'],
      updated_at: new Date().toISOString(),
    },
    {
      slug: 'curriculo/computacion-y-redes',
      dominio: 'curricular',
      titulo: 'Capacitación Laboral en Computación y Redes BGE Puebla 2024',
      contenido: 'Soporte técnico, mantenimiento preventivo y cableado estructurado...',
      applicable_a: ['planeacion', 'editorial'],
      token_count: 90,
      compilado_con: 'gemini-3.5-flash-lite',
      prompt_version: 'v1',
      uac_slugs: [
        'actualiza-equipos-de-computo-de-acuerdo-con-especificaciones-del-fabricante',
        'computacion-y-redes',
      ],
      updated_at: new Date().toISOString(),
    },
    {
      slug: 'normativa/ley-general-de-educacion-2019',
      dominio: 'normativo',
      titulo: 'Ley General de Educación (2019)',
      contenido: 'El Estado está obligado a prestar servicios educativos con equidad...',
      applicable_a: ['pmc', 'pips'],
      token_count: 70,
      compilado_con: null,
      prompt_version: null,
      uac_slugs: [],
      updated_at: new Date().toISOString(),
    },
  ];

  it('1. Retorna contexto vacío si KNOWLEDGE_LAYER_ENABLED está desactivado', async () => {
    vi.spyOn(featureFlags, 'isFeatureEnabled').mockReturnValue(false);
    vi.spyOn(repo, 'getPublishedKnowledgePages').mockResolvedValue(mockPages);

    const result = await getInstitutionalContext('planeacion');
    expect(result.block).toBe('');
    expect(result.tokens).toBe(0);
    expect(result.sources).toEqual([]);
  });

  it('2. Inyecta didáctica general y filtra estrictamente por UAC sin cruces de asignaturas', async () => {
    vi.spyOn(featureFlags, 'isFeatureEnabled').mockReturnValue(true);
    vi.spyOn(repo, 'getPublishedKnowledgePages').mockResolvedValue(mockPages);

    const result = await getInstitutionalContext('planeacion', {
      maxTokens: 800,
      uacSlug: 'pensamiento-matematico-i',
    });

    expect(result.block).toContain('CONTEXTO INSTITUCIONAL SEP');
    expect(result.block).toContain('Evaluación Formativa y Criterios del Anexo 12');
    expect(result.block).toContain('Diseño Universal para el Aprendizaje');
    expect(result.block).toContain('Pensamiento Matemático en el MCCEMS');

    // CERO cruce con computación y redes
    expect(result.block).not.toContain('Computación y Redes');
    expect(result.sources.some((s) => s.slug === 'curriculo/computacion-y-redes')).toBe(false);

    // Regla D7: CERO contenido legal/normativo en planeación
    expect(result.block).not.toContain('Ley General de Educación');
    expect(result.sources.some((s) => s.dominio === 'normativo')).toBe(false);
  });

  it('3. Inyecta currículo laboral correspondiente para Computación y Redes', async () => {
    vi.spyOn(featureFlags, 'isFeatureEnabled').mockReturnValue(true);
    vi.spyOn(repo, 'getPublishedKnowledgePages').mockResolvedValue(mockPages);

    const result = await getInstitutionalContext('planeacion', {
      maxTokens: 800,
      uacSlug: 'actualiza-equipos-de-computo-de-acuerdo-con-especificaciones-del-fabricante',
    });

    expect(result.block).toContain('Capacitación Laboral en Computación y Redes');
    expect(result.block).not.toContain('Pensamiento Matemático en el MCCEMS');
  });

  it('4. Cumple con la Regla D7: solo PMC y PIPS reciben dominio normativo', async () => {
    vi.spyOn(featureFlags, 'isFeatureEnabled').mockReturnValue(true);
    vi.spyOn(repo, 'getPublishedKnowledgePages').mockResolvedValue(mockPages);

    const pmcResult = await getInstitutionalContext('pmc', { maxTokens: 1000 });
    expect(pmcResult.block).toContain('Ley General de Educación');
    expect(pmcResult.sources.some((s) => s.slug === 'normativa/ley-general-de-educacion-2019')).toBe(true);

    const planResult = await getInstitutionalContext('planeacion', { maxTokens: 1000 });
    expect(planResult.block).not.toContain('Ley General de Educación');
  });

  it('5. Garantía Fail-Open: si el repositorio de base de datos falla, retorna bloque vacío sin lanzar excepción', async () => {
    vi.spyOn(featureFlags, 'isFeatureEnabled').mockReturnValue(true);
    vi.spyOn(repo, 'getPublishedKnowledgePages').mockRejectedValue(new Error('Neon connection timeout'));

    const result = await getInstitutionalContext('planeacion', { uacSlug: 'pensamiento-matematico-i' });
    expect(result.block).toBe('');
    expect(result.tokens).toBe(0);
    expect(result.sources).toEqual([]);
  });
});
