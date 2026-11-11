/**
 * scripts/sync-knowledge.ts — Sincroniza las síntesis markdown versionadas en Git
 * `src/knowledge/wiki` (recursivo, .md) hacia la tabla Postgres `knowledge_pages`.
 *
 * La BD es una vista materializada de solo lectura; Git es la fuente de verdad.
 *
 * Uso:
 *   npx tsx scripts/sync-knowledge.ts                 # dry-run (no escribe)
 *   npx tsx scripts/sync-knowledge.ts --apply         # escribe como borrador
 *   npx tsx scripts/sync-knowledge.ts --publish       # publica (exige status: reviewed)
 *   npx tsx scripts/sync-knowledge.ts --only=anexo-12 # filtra por slug/ruta
 */

import { neon } from '@neondatabase/serverless';
import { promises as fs } from 'fs';
import path from 'path';
import { loadEnvLocal } from './lib/load-env';
import {
  formatSyncReport,
  planKnowledgeSync,
  type ExistingKnowledgePage,
  type KnowledgeFileInput,
  type SyncPlanItem,
} from '@/lib/knowledge/knowledge-sync';
import type { KnowledgeFrontmatter } from '@/lib/knowledge/knowledge-types';

const WIKI_ROOT = path.join(process.cwd(), 'src', 'knowledge', 'wiki');

interface CliOptions {
  mode: 'dry-run' | 'apply' | 'publish';
  only?: string;
}

function parseArgs(argv: string[]): CliOptions {
  const flags = new Set(argv.filter((arg) => arg.startsWith('--') && !arg.includes('=')));
  const onlyArg = argv.find((arg) => arg.startsWith('--only='));
  const publish = flags.has('--publish');
  const apply = flags.has('--apply');
  return {
    mode: publish ? 'publish' : apply ? 'apply' : 'dry-run',
    only: onlyArg ? onlyArg.slice('--only='.length) : undefined,
  };
}

async function collectMarkdownFiles(dir: string, base = dir): Promise<KnowledgeFileInput[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: KnowledgeFileInput[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectMarkdownFiles(full, base)));
      continue;
    }
    if (!entry.name.toLowerCase().endsWith('.md')) continue;
    if (/^readme\.md$/i.test(entry.name)) continue;
    files.push({
      archivo: path.relative(base, full).split(path.sep).join('/'),
      raw: await fs.readFile(full, 'utf8'),
    });
  }
  return files;
}

function sourceType(ruta: string): string {
  if (ruta.startsWith('db:')) return 'db';
  const ext = ruta.split('.').pop()?.toLowerCase() ?? '';
  return ['pdf', 'docx', 'pptx', 'xlsx', 'md', 'txt'].includes(ext) ? ext : 'txt';
}

async function upsertSources(
  sql: ReturnType<typeof neon>,
  frontmatter: KnowledgeFrontmatter
): Promise<number[]> {
  const ids: number[] = [];
  for (const source of frontmatter.fuentes_referencia) {
    const sha = source.sha256 ?? null;
    const rows = (await sql`
      INSERT INTO knowledge_sources (ruta_raw, sha256, tipo, titulo)
      VALUES (${source.ruta}, ${sha}, ${sourceType(source.ruta)}, ${frontmatter.titulo})
      ON CONFLICT (ruta_raw) DO UPDATE
        SET sha256 = COALESCE(EXCLUDED.sha256, knowledge_sources.sha256),
            titulo = EXCLUDED.titulo,
            vigente = TRUE
      RETURNING id
    `) as Array<{ id: number }>;
    if (rows[0]?.id) ids.push(rows[0].id);
  }
  return ids;
}

async function applyItem(
  sql: ReturnType<typeof neon>,
  item: SyncPlanItem
): Promise<void> {
  if (!item.frontmatter || item.contenido === undefined || item.sha256 === null) {
    throw new Error(`Item sin datos completos para aplicar: ${item.archivo}`);
  }
  const sourceIds = await upsertSources(sql, item.frontmatter);
  const applicable = item.frontmatter.applicable_a;

  await sql`
    INSERT INTO knowledge_pages (
      slug, dominio, titulo, contenido, applicable_a, source_ids,
      sha256, token_count, publicado, compilado_con, prompt_version, updated_at
    )
    VALUES (
      ${item.frontmatter.slug}, ${item.frontmatter.dominio}, ${item.frontmatter.titulo},
      ${item.contenido}, ${applicable}::text[], ${sourceIds}::integer[],
      ${item.sha256}, ${item.tokenCount}, ${item.publicado},
      ${item.frontmatter.model ?? null}, ${item.frontmatter.prompt_version ?? null}, NOW()
    )
    ON CONFLICT (slug) DO UPDATE SET
      dominio = EXCLUDED.dominio,
      titulo = EXCLUDED.titulo,
      contenido = EXCLUDED.contenido,
      applicable_a = EXCLUDED.applicable_a,
      source_ids = EXCLUDED.source_ids,
      sha256 = EXCLUDED.sha256,
      token_count = EXCLUDED.token_count,
      publicado = EXCLUDED.publicado,
      compilado_con = EXCLUDED.compilado_con,
      prompt_version = EXCLUDED.prompt_version,
      updated_at = NOW()
  `;

  await sql`
    INSERT INTO knowledge_sync_log (archivo, slug, accion, sha256, detalle)
    VALUES (
      ${item.archivo}, ${item.slug}, ${item.accion}, ${item.sha256},
      ${JSON.stringify({
        dominio: item.frontmatter.dominio,
        applicable_a: applicable,
        token_count: item.tokenCount,
        publicado: item.publicado,
      })}::jsonb
    )
  `;
}

async function logRejection(
  sql: ReturnType<typeof neon>,
  item: SyncPlanItem
): Promise<void> {
  await sql`
    INSERT INTO knowledge_sync_log (archivo, slug, accion, sha256, detalle)
    VALUES (
      ${item.archivo}, ${item.slug}, 'rejected', ${item.sha256},
      ${JSON.stringify({ errores: item.errores })}::jsonb
    )
  `;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  console.log(`🧠 sync-knowledge · modo=${options.mode}${options.only ? ` · filtro=${options.only}` : ''}\n`);

  let files: KnowledgeFileInput[];
  try {
    files = await collectMarkdownFiles(WIKI_ROOT);
  } catch (error) {
    console.error(`❌ No se pudo leer ${WIKI_ROOT}:`, error instanceof Error ? error.message : error);
    process.exit(1);
  }

  if (options.only) {
    files = files.filter(
      (file) => file.archivo.includes(options.only!) || file.raw.includes(`slug: ${options.only}`)
    );
  }

  if (files.length === 0) {
    console.log('ℹ️  No hay archivos .md para sincronizar (excluyendo README.md).');
    return;
  }

  let existing: ExistingKnowledgePage[] = [];
  let sqlClient: ReturnType<typeof neon> | null = null;

  loadEnvLocal();
  if (process.env.DATABASE_URL) {
    // En dry-run también se lee (solo SELECT) para reportar `unchanged` con precisión.
    sqlClient = neon(process.env.DATABASE_URL);
    existing = (await sqlClient`
      SELECT slug, sha256, publicado FROM knowledge_pages
    `) as ExistingKnowledgePage[];
  } else if (options.mode !== 'dry-run') {
    console.error('❌ DATABASE_URL no está definido (revisa .env.local).');
    process.exit(1);
  } else {
    console.warn('⚠️  Sin DATABASE_URL: el dry-run no puede detectar páginas ya sincronizadas.');
  }

  const plan = planKnowledgeSync({
    files,
    existing,
    publish: options.mode === 'publish',
  });

  console.log(formatSyncReport(plan));

  const rejected = plan.filter((item) => item.accion === 'rejected');
  const writable = plan.filter((item) => item.accion === 'created' || item.accion === 'updated');

  if (options.mode === 'dry-run') {
    console.log('\n🔎 Dry-run: no se escribió nada en la base de datos.');
  } else if (sqlClient) {
    for (const item of writable) {
      await applyItem(sqlClient, item);
    }
    for (const item of rejected) {
      await logRejection(sqlClient, item);
    }
    console.log(
      `\n✅ Sincronización aplicada: ${writable.length} escritura(s), ${rejected.length} rechazo(s).`
    );
  }

  if (rejected.length > 0) {
    console.error('\n⛔ Hay páginas rechazadas; corrige los errores antes de publicar.');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Error en sync-knowledge:', error instanceof Error ? error.message : error);
  process.exit(1);
});
