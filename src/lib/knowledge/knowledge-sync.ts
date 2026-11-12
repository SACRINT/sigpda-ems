/**
 * knowledge-sync.ts — Planificador determinista de sincronización
 * `src/knowledge/wiki` (recursivo, .md) → tabla `knowledge_pages`.
 *
 * Lógica pura (sin DB ni FS) para poder probarse en aislamiento:
 * parsea, valida con Zod, ejecuta el gate anti-genéricos y decide la acción
 * (created | updated | unchanged | rejected) por hash SHA-256.
 */

import { findGenericContent } from '@/lib/guide-engine/quality/no-generic-content';
import {
  estimateTokens,
  findPromptInjection,
  parseKnowledgeFile,
  sha256Hex,
  validateKnowledgeFrontmatter,
  type KnowledgeFrontmatter,
} from './knowledge-types';

export interface KnowledgeFileInput {
  /** Ruta relativa mostrada en reportes (ej. wiki/didactica/anexo-12.md). */
  archivo: string;
  raw: string;
}

export interface ExistingKnowledgePage {
  slug: string;
  sha256: string;
  publicado: boolean;
  applicable_a?: string[];
  uac_slugs?: string[];
}

export type SyncAction = 'created' | 'updated' | 'unchanged' | 'rejected';

export interface SyncPlanItem {
  archivo: string;
  slug: string | null;
  accion: SyncAction;
  sha256: string | null;
  publicado: boolean;
  tokenCount: number;
  errores: string[];
  frontmatter?: KnowledgeFrontmatter;
  contenido?: string;
}

export interface PlanKnowledgeSyncParams {
  files: KnowledgeFileInput[];
  existing: ExistingKnowledgePage[];
  /** true = escribir con publicado=true (exige status: reviewed). */
  publish: boolean;
}

export function planKnowledgeSync(params: PlanKnowledgeSyncParams): SyncPlanItem[] {
  const { files, existing, publish } = params;
  const existingBySlug = new Map(existing.map((page) => [page.slug, page]));

  const rejected: SyncPlanItem[] = [];
  const accepted: SyncPlanItem[] = [];
  const slugCounts = new Map<string, number>();

  for (const file of files) {
    try {
      const { frontmatter, body } = parseKnowledgeFile(file.raw);
      const validation = validateKnowledgeFrontmatter(frontmatter);
      if (!validation.success) {
        rejected.push({
          archivo: file.archivo,
          slug: null,
          accion: 'rejected',
          sha256: null,
          publicado: false,
          tokenCount: 0,
          errores: validation.errors,
        });
        continue;
      }

      const data = validation.data;
      slugCounts.set(data.slug, (slugCounts.get(data.slug) ?? 0) + 1);

      const contenido = body.trim();
      if (contenido.length === 0) {
        rejected.push({
          archivo: file.archivo,
          slug: data.slug,
          accion: 'rejected',
          sha256: null,
          publicado: false,
          tokenCount: 0,
          errores: ['El cuerpo de la página está vacío.'],
        });
        continue;
      }

      const genericIssues = findGenericContent({ titulo: data.titulo, contenido });
      if (genericIssues.length > 0) {
        rejected.push({
          archivo: file.archivo,
          slug: data.slug,
          accion: 'rejected',
          sha256: null,
          publicado: false,
          tokenCount: 0,
          errores: genericIssues.map(
            (issue) => `contenido genérico (${issue.label}) en ${issue.path}: "${issue.excerpt}"`
          ),
        });
        continue;
      }

      const injection = findPromptInjection(contenido);
      if (injection) {
        rejected.push({
          archivo: file.archivo,
          slug: data.slug,
          accion: 'rejected',
          sha256: null,
          publicado: false,
          tokenCount: 0,
          errores: [`Posible inyección de prompt detectada (${injection}).`],
        });
        continue;
      }

      if (publish && data.status !== 'reviewed' && data.status !== 'published') {
        rejected.push({
          archivo: file.archivo,
          slug: data.slug,
          accion: 'rejected',
          sha256: null,
          publicado: false,
          tokenCount: 0,
          errores: ['No se puede publicar una página con status "draft".'],
        });
        continue;
      }

      const sha256 = sha256Hex(contenido);
      const targetPublicado = data.status === 'published' || (publish && data.status === 'reviewed');
      const previous = existingBySlug.get(data.slug);
      const previousApplicable = [...(previous?.applicable_a ?? [])].sort().join('|');
      const nextApplicable = [...data.applicable_a].sort().join('|');
      const previousUacSlugs = [...(previous?.uac_slugs ?? [])].sort().join('|');
      const nextUacSlugs = [...(data.uac_slugs ?? [])].sort().join('|');
      const metadataChanged =
        !!previous &&
        ((previous.applicable_a !== undefined && previousApplicable !== nextApplicable) ||
          (previous.uac_slugs !== undefined && previousUacSlugs !== nextUacSlugs));

      let accion: SyncAction;
      if (!previous) {
        accion = 'created';
      } else if (
        previous.sha256 === sha256 &&
        previous.publicado === targetPublicado &&
        !metadataChanged
      ) {
        accion = 'unchanged';
      } else {
        accion = 'updated';
      }

      accepted.push({
        archivo: file.archivo,
        slug: data.slug,
        accion,
        sha256,
        publicado: targetPublicado,
        tokenCount: estimateTokens(contenido),
        errores: [],
        frontmatter: data,
        contenido,
      });
    } catch (error) {
      rejected.push({
        archivo: file.archivo,
        slug: null,
        accion: 'rejected',
        sha256: null,
        publicado: false,
        tokenCount: 0,
        errores: [error instanceof Error ? error.message : String(error)],
      });
    }
  }

  const duplicated = new Set(
    Array.from(slugCounts.entries())
      .filter(([, count]) => count > 1)
      .map(([slug]) => slug)
  );

  return [...accepted, ...rejected].map((item) => {
    if (!item.slug || !duplicated.has(item.slug)) return item;
    return {
      ...item,
      accion: 'rejected',
      publicado: false,
      errores: [...item.errores, `slug duplicado en el lote: "${item.slug}".`],
    };
  });
}

export function formatSyncReport(items: SyncPlanItem[]): string {
  const lines: string[] = [];
  for (const item of items) {
    const slug = item.slug ?? '(sin slug)';
    lines.push(`[${item.accion.toUpperCase()}] ${item.archivo} → ${slug}`);
    if (item.accion !== 'rejected') {
      lines.push(`   sha256=${item.sha256?.slice(0, 12)}… tokens≈${item.tokenCount} publicado=${item.publicado}`);
    }
    for (const error of item.errores) {
      lines.push(`   ✗ ${error}`);
    }
  }
  const counts = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.accion] = (acc[item.accion] ?? 0) + 1;
    return acc;
  }, {});
  lines.push('');
  lines.push(
    `Resumen: ${counts.created ?? 0} creadas, ${counts.updated ?? 0} actualizadas, ` +
      `${counts.unchanged ?? 0} sin cambios, ${counts.rejected ?? 0} rechazadas.`
  );
  return lines.join('\n');
}
