/**
 * reconcile-knowledge-wiki.ts — Reconcilia la fuente Markdown con Neon DB.
 *
 * Para cada página publicada en `knowledge_pages`:
 *  - reemplaza el cuerpo del .md por el contenido exacto publicado en Neon;
 *  - cambia `status: draft|reviewed` a `status: published`;
 *  - deja el archivo listo para que `sync-knowledge.ts` sea idempotente.
 *
 * Uso:
 *   npx tsx scripts/reconcile-knowledge-wiki.ts
 *   npx tsx scripts/reconcile-knowledge-wiki.ts --apply
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { neon } from '@neondatabase/serverless';

const env = readFileSync('.env.local', 'utf8');
const match = env.match(/DATABASE_URL=['"]?([^'"\r\n]+)/);
if (!match) {
  console.error('DATABASE_URL no encontrado en .env.local');
  process.exit(1);
}

const sql = neon(match[1]);
const APPLY = process.argv.includes('--apply');
const WIKI_ROOT = join(process.cwd(), 'src', 'knowledge', 'wiki');

interface Row {
  slug: string;
  contenido: string;
}

function reconcileFile(raw: string, contenido: string): string {
  const frontmatter = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!frontmatter) {
    throw new Error('Archivo sin frontmatter delimitado por ---');
  }

  const bodyStart = frontmatter[0].length;
  let metadata = frontmatter[1];
  if (/^status:\s*.*$/m.test(metadata)) {
    metadata = metadata.replace(/^status:\s*.*$/m, 'status: published');
  } else {
    metadata = `${metadata.trimEnd()}\nstatus: published`;
  }

  return `---\n${metadata.trimEnd()}\n---\n\n${contenido.trim()}\n`;
}

async function main(): Promise<void> {
  console.log(`=== RECONCILIAR WIKI KNOWLEDGE (${APPLY ? 'APPLY' : 'DRY-RUN'}) ===`);
  const rows = (await sql`
    SELECT slug, contenido
    FROM knowledge_pages
    WHERE publicado = TRUE
    ORDER BY slug
  `) as unknown as Row[];

  let updated = 0;
  let unchanged = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const filePath = join(WIKI_ROOT, `${row.slug}.md`);
    if (!existsSync(filePath)) {
      errors.push(`No existe el archivo para ${row.slug}: ${filePath}`);
      continue;
    }

    const raw = readFileSync(filePath, 'utf8');
    let next: string;
    try {
      next = reconcileFile(raw, row.contenido);
    } catch (error) {
      errors.push(`${row.slug}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }

    if (raw === next) {
      unchanged++;
      continue;
    }

    if (APPLY) writeFileSync(filePath, next, 'utf8');
    updated++;
  }

  console.log(JSON.stringify({ publishedPages: rows.length, updated, unchanged, errors: errors.length }, null, 2));
  if (errors.length > 0) {
    for (const error of errors) console.error(`[ERROR] ${error}`);
    process.exit(1);
  }
  if (!APPLY) {
    console.log('Dry-run: no se escribió nada. Ejecuta con --apply para reconciliar.');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
