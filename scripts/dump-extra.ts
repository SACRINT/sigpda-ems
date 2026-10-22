/**
 * dump-extra.ts — Imprime el `content_text` crudo de un planning_extra.
 * Uso: npx tsx scripts/dump-extra.ts <extraId>
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { neon } from '@neondatabase/serverless';

function loadEnvLocal(): void {
  try {
    const raw = readFileSync(join(process.cwd(), '.env.local'), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!m) continue;
      const value = m[2].trim().replace(/^['"]|['"]$/g, '');
      if (!(m[1] in process.env)) process.env[m[1]] = value;
    }
  } catch {
    /* opcional */
  }
}

async function main(): Promise<void> {
  loadEnvLocal();
  const id = process.argv[2];
  if (!id) {
    console.error('uso: npx tsx scripts/dump-extra.ts <extraId>');
    process.exit(1);
  }
  const sql = neon(process.env.DATABASE_URL);
  const rows: { content_text: string }[] = await sql`
    SELECT content_text FROM planning_extras WHERE id = ${id}
  `;
  console.log(rows.length === 0 ? '(no encontrado)' : rows[0].content_text);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
