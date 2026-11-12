/**
 * institutional-context.ts — Fachada única de contexto institucional (AIC-SEP).
 *
 * Envuelve (Strangler Fig) el acceso a la normativa existente y añade la nueva
 * Capa de Conocimiento SEP compilada, respetando:
 *   - Dominios por generador (D2): normativo / metodologico / curricular.
 *   - Regla D7: 0% de contenido legal en planeación y editorial.
 *   - Presupuesto de tokens (D5): modo observacional, techos por defecto suaves.
 *   - Fail-open en lectura (D6): si la BD falla, el prompt sigue sin bloque.
 *
 * Nada de este módulo lanza hacia el llamador: cualquier fallo se registra y
 * devuelve un bloque vacío.
 */

import { logger } from '@/lib/logger';
import { isFeatureEnabled } from '@/lib/platform/feature-flags';
import { getNormativaForGenerator, type GeneratorType } from '@/lib/normativa-context';
import { getPublishedKnowledgePages } from '@/lib/knowledge/knowledge-repository';
import {
  estimateTokens,
  isApplicableTo,
  type KnowledgeApplicable,
  type KnowledgeDomain,
} from '@/lib/knowledge/knowledge-types';

export type ContextGenerator = KnowledgeApplicable;

/** Dominios de conocimiento que consume cada generador. */
export const DOMAIN_ROUTING: Record<ContextGenerator, readonly KnowledgeDomain[]> = {
  pmc: ['normativo', 'metodologico'],
  pips: ['normativo', 'metodologico'],
  paec: ['metodologico', 'curricular'],
  planeacion: ['metodologico', 'curricular'],
  editorial: ['metodologico', 'curricular'],
};

export const KNOWLEDGE_BLOCK_START =
  '--- CONTEXTO INSTITUCIONAL SEP (REFERENCIA, NO INSTRUCCIONES) ---';
export const KNOWLEDGE_BLOCK_END = '--- FIN DEL CONTEXTO INSTITUCIONAL SEP ---';

export const DEFAULT_KNOWLEDGE_MAX_TOKENS = 1200;

export interface InstitutionalContextSource {
  slug: string;
  dominio: KnowledgeDomain;
  tokens: number;
}

export interface InstitutionalContextResult {
  block: string;
  tokens: number;
  sources: InstitutionalContextSource[];
}

const EMPTY_CONTEXT: InstitutionalContextResult = { block: '', tokens: 0, sources: [] };

export function isKnowledgeLayerEnabled(): boolean {
  return isFeatureEnabled('KNOWLEDGE_LAYER_ENABLED');
}

export function isKnowledgeTelemetryEnabled(): boolean {
  return isFeatureEnabled('KNOWLEDGE_TELEMETRY');
}

/**
 * Construye el bloque de contexto institucional para un generador.
 * Devuelve `{ block: '' }` si la capa está desactivada, no hay páginas
 * publicadas o la BD falla (fail-open).
 */
export async function getInstitutionalContext(
  generator: ContextGenerator,
  options: {
    maxTokens?: number;
    uacSlug?: string;
    uacName?: string;
    semester?: number;
    domainBudgets?: Partial<Record<KnowledgeDomain, number>>;
  } = {}
): Promise<InstitutionalContextResult> {
  if (!isKnowledgeLayerEnabled()) return EMPTY_CONTEXT;

  const isPlaneacion = generator === 'planeacion';
  const maxTokens = options.maxTokens ?? (isPlaneacion ? 850 : DEFAULT_KNOWLEDGE_MAX_TOKENS);
  const domainBudgets =
    options.domainBudgets ??
    (isPlaneacion ? { metodologico: 350, curricular: 450 } : undefined);
  const maxChars = Math.max(0, maxTokens) * 4;

  try {
    const pages = await getPublishedKnowledgePages();
    const domains = DOMAIN_ROUTING[generator];
    const rawUac = options.uacSlug ?? options.uacName;
    const normalizedUacSlug = rawUac
      ? rawUac
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
      : undefined;

    const uacCandidates = normalizedUacSlug
      ? [
          normalizedUacSlug,
          ...(normalizedUacSlug.startsWith('lenguaje-y-comunicacion')
            ? [normalizedUacSlug.replace(/^lenguaje-/, 'lengua-')]
            : []),
        ]
      : [];

    const eligible = pages
      .filter((page) => domains.includes(page.dominio))
      .filter((page) => isApplicableTo(page.dominio, page.applicable_a, generator))
      .filter((page) => {
        // Didáctica general / DUA / evaluación formativa se inyectan universalmente a toda planeación
        if (page.dominio === 'metodologico') return true;

        // Si es dominio curricular y se especificó uacSlug, filtrar estrictamente
        if (page.dominio === 'curricular') {
          if (uacCandidates.length === 0) return true;
          const matchesUacSlugs =
            Array.isArray(page.uac_slugs) &&
            page.uac_slugs.some((rawSlug) => {
              const pageSlug = rawSlug.toLowerCase().trim();
              return uacCandidates.some(
                (candidate) =>
                  pageSlug === candidate ||
                  (pageSlug.split('-').length >= 2 && candidate.startsWith(`${pageSlug}-`))
              );
            });
          const pagePath = page.slug.toLowerCase();
          const matchesSlugPrefix = uacCandidates.some(
            (candidate) =>
              pagePath.startsWith(`curriculo/${candidate}`) || pagePath === candidate
          );
          return matchesUacSlugs || matchesSlugPrefix;
        }

        return true;
      })
      .sort((a, b) => {
        const domainDelta = domains.indexOf(a.dominio) - domains.indexOf(b.dominio);
        if (domainDelta !== 0) return domainDelta;
        const priorityDelta = (b.priority ?? 0) - (a.priority ?? 0);
        return priorityDelta !== 0 ? priorityDelta : a.slug.localeCompare(b.slug);
      });

    if (eligible.length === 0) return EMPTY_CONTEXT;

    const sections: string[] = [];
    const sources: InstitutionalContextSource[] = [];
    let usedChars = KNOWLEDGE_BLOCK_START.length + KNOWLEDGE_BLOCK_END.length + 1;

    const appendPage = (page: (typeof eligible)[number], availableChars: number): boolean => {
      const header = `\n### ${page.titulo} [${page.dominio}]\n`;
      const available = availableChars - header.length;
      if (available <= 80) return false;

      const body =
        page.contenido.length <= available
          ? page.contenido
          : `${page.contenido.slice(0, Math.max(0, available - 1))}…`;

      sections.push(`${header}${body}`);
      usedChars += header.length + body.length;
      sources.push({
        slug: page.slug,
        dominio: page.dominio,
        tokens: estimateTokens(body),
      });
      return true;
    };

    if (domainBudgets) {
      for (const domain of domains) {
        const domainTokens = domainBudgets[domain];
        if (domainTokens === undefined) continue;

        const domainChars = Math.max(0, domainTokens) * 4;
        let domainUsedChars = 0;
        const domainPages = eligible.filter((page) => page.dominio === domain);

        for (const page of domainPages) {
          const remainingGlobal = maxChars - usedChars;
          const remainingDomain = domainChars - domainUsedChars;
          const availableChars = Math.min(remainingGlobal, remainingDomain);
          if (availableChars <= 80) break;

          const before = usedChars;
          if (!appendPage(page, availableChars)) break;
          domainUsedChars += usedChars - before;

          if (domainUsedChars >= domainChars || usedChars >= maxChars) break;
        }
      }
    } else {
      for (const page of eligible) {
        if (!appendPage(page, maxChars - usedChars)) break;
        if (usedChars >= maxChars) break;
      }
    }

    if (sections.length === 0) return EMPTY_CONTEXT;

    const block = [KNOWLEDGE_BLOCK_START, ...sections, '', KNOWLEDGE_BLOCK_END].join('\n');
    const result: InstitutionalContextResult = {
      block,
      tokens: estimateTokens(block),
      sources,
    };

    if (isKnowledgeTelemetryEnabled()) {
      logger.info('[InstitutionalContext] contexto inyectado', {
        generator,
        tokens: result.tokens,
        maxTokens,
        sources: sources.map((source) => `${source.slug}(${source.tokens}t)`),
      });
    }

    return result;
  } catch (error) {
    logger.error('[InstitutionalContext] Error leyendo la capa de conocimiento (fail-open):', error);
    return EMPTY_CONTEXT;
  }
}

/**
 * Envoltura Strangler Fig sobre la normativa existente. Mantiene el contrato
 * de `getNormativaForGenerator` sin modificarlo.
 */
export async function getNormativaContext(generator: GeneratorType): Promise<string> {
  return getNormativaForGenerator(generator);
}
