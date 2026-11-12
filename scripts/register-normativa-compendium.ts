/**
 * register-normativa-compendium.ts — Registra el compendio normativo ejecutivo
 * en `knowledge_pages` con prioridad alta para PMC/PIPS.
 *
 * Uso:
 *   npx tsx scripts/register-normativa-compendium.ts
 *   npx tsx scripts/register-normativa-compendium.ts --apply
 */

import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';
import {
  estimateTokens,
  parseKnowledgeFile,
  sha256Hex,
  validateKnowledgeFrontmatter,
} from '../src/lib/knowledge/knowledge-types';

const env = readFileSync('.env.local', 'utf8');
const match = env.match(/DATABASE_URL=['"]?([^'"\r\n]+)/);
if (!match) {
  console.error('DATABASE_URL no encontrado en .env.local');
  process.exit(1);
}

const sql = neon(match[1]);
const APPLY = process.argv.includes('--apply');
const FILE = 'src/knowledge/wiki/normativa/compendio-marco-normativo-ems.md';
const MAX_TOKENS = 1100;
const PRIORITY = 100;

async function main(): Promise<void> {
  console.log(`=== REGISTRAR COMPENDIO NORMATIVO (${APPLY ? 'APPLY' : 'DRY-RUN'}) ===`);

  const raw = readFileSync(FILE, 'utf8');
  const { frontmatter, body } = parseKnowledgeFile(raw);
  const validation = validateKnowledgeFrontmatter(frontmatter);
  if (!validation.success) {
    console.error('Frontmatter inválido:', validation.errors);
    process.exit(1);
  }

  const data = validation.data;
  const contenido = body.trim();
  const tokens = estimateTokens(contenido);
  if (tokens > MAX_TOKENS) {
    console.error(`El compendio tiene ${tokens} tokens; máximo ${MAX_TOKENS}.`);
    process.exit(1);
  }
  if (data.dominio !== 'normativo') {
    console.error(`El compendio debe ser normativo, recibido: ${data.dominio}`);
    process.exit(1);
  }
  if (data.applicable_a.some((target) => target !== 'pmc' && target !== 'pips')) {
    console.error('El compendio solo puede aplicar a pmc/pips.');
    process.exit(1);
  }

  const hash = sha256Hex(contenido);
  console.log(
    JSON.stringify({ slug: data.slug, tokens, sha256: hash, applicable_a: data.applicable_a }, null, 2)
  );

  if (!APPLY) {
    console.log('Dry-run: no se escribió nada. Ejecuta con --apply para registrar.');
    return;
  }

  await sql`ALTER TABLE knowledge_pages ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 0`;

  const sourceRows = (await sql`
    SELECT DISTINCT unnest(source_ids) AS id
    FROM knowledge_pages
    WHERE dominio = 'normativo'
  `) as unknown as Array<{ id: number }>;
  const sourceIds = sourceRows.map((row) => row.id);

  const existing = (await sql`
    SELECT id FROM knowledge_pages WHERE slug = ${data.slug} LIMIT 1
  `) as unknown as Array<{ id: number }>;

  await sql`
    INSERT INTO knowledge_pages (
      slug, dominio, titulo, contenido, applicable_a, source_ids,
      sha256, token_count, publicado, compilado_con, prompt_version,
      uac_slugs, priority, updated_at
    ) VALUES (
      ${data.slug}, ${data.dominio}, ${data.titulo}, ${contenido},
      ${data.applicable_a}::text[], ${sourceIds}::integer[],
      ${hash}, ${tokens}, TRUE, ${data.model ?? 'deterministic-compendium-v1'},
      ${data.prompt_version ?? 'normateca-v1'}, '{}'::text[], ${PRIORITY}, NOW()
    )
    ON CONFLICT (slug) DO UPDATE SET
      titulo = EXCLUDED.titulo,
      contenido = EXCLUDED.contenido,
      applicable_a = EXCLUDED.applicable_a,
      source_ids = EXCLUDED.source_ids,
      sha256 = EXCLUDED.sha256,
      token_count = EXCLUDED.token_count,
      publicado = TRUE,
      compilado_con = EXCLUDED.compilado_con,
      prompt_version = EXCLUDED.prompt_version,
      uac_slugs = EXCLUDED.uac_slugs,
      priority = EXCLUDED.priority,
      updated_at = NOW()
  `;

  await sql`
    INSERT INTO knowledge_sync_log (archivo, slug, accion, sha256, detalle)
    VALUES (
      ${FILE}, ${data.slug}, 'updated', ${hash},
      ${JSON.stringify({
        origen: 'register-normativa-compendium',
        tokens,
        priority: PRIORITY,
        applicable_a: data.applicable_a,
        source_ids: sourceIds,
        existed: existing.length > 0,
      })}::jsonb
    )
  `;

  console.log(`Compendio registrado: ${data.slug} (${tokens} tokens, priority=${PRIORITY}).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
