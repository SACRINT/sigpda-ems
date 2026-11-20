import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { neon } from '@neondatabase/serverless';
import {
  buildSacrintDeck,
  collectWorkbookTheorySources,
  type SacrintDeckSpec,
} from '../src/lib/visual-engine/sacrint/spec';
import { generateCombinedSacrintPptx } from '../src/lib/visual-engine/sacrint/sacrint-pptx-generator';
import { auditPptxFile } from './qa-sacrint-materials';
import type { ActiveWorkTextbook } from '../src/types/work-textbook';

function loadEnvLocal(): void {
  try {
    const raw = readFileSync(join(process.cwd(), '.env.local'), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!m) continue;
      const val = m[2].trim().replace(/^["']|["']$/g, '');
      if (val && !process.env[m[1]]) process.env[m[1]] = val;
    }
  } catch {
    /* opcional */
  }
}

async function main() {
  loadEnvLocal();
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL no disponible');
  const sql = neon(url);
  const id = process.argv[2] || 'c416a62e-a247-4d9e-8749-5cb955da6714';
  const rows = (await sql`SELECT uac_name, workbooks_json, updated_at FROM plannings WHERE id = ${id}::uuid`) as unknown as Array<{
    uac_name: string;
    workbooks_json: Record<string, { current?: ActiveWorkTextbook }>;
    updated_at: string;
  }>;
  if (!rows[0]) throw new Error('planning no encontrada');
  const workbooks = rows[0].workbooks_json || {};
  const entries = Object.entries(workbooks)
    .map(([key, value]) => {
      const m = /^block_(\d+)$/.exec(key);
      return m ? { blockIndex: Number(m[1]), workbook: value?.current } : null;
    })
    .filter((e): e is { blockIndex: number; workbook: ActiveWorkTextbook } => Boolean(e?.workbook))
    .sort((a, b) => a.blockIndex - b.blockIndex);

  const allTheorySources = entries.flatMap((e) => collectWorkbookTheorySources(e.workbook));
  const tracker = new Map<string, number>();
  const decks: SacrintDeckSpec[] = [];
  for (const entry of entries) {
    const missionCount = Math.max(1, entry.workbook.missions?.length ?? 0);
    for (let mi = 0; mi < missionCount; mi++) {
      console.error(`[audit] building block ${entry.blockIndex + 1} mission ${mi + 1}`);
      decks.push(buildSacrintDeck(entry.workbook, {
        mode: 'lesson-guide',
        missionIndex: mi,
        extraTheorySources: allTheorySources,
        misconceptionTracker: tracker,
      }));
    }
  }

  const pptx = await generateCombinedSacrintPptx(decks, {
    title: `Presentación SACRINT — ${rows[0].uac_name}`,
    subjectName: rows[0].uac_name || 'presentacion',
  });
  const out = join(process.env.TEMP || '.', 'opencode', 'pm3-current-08.pptx');
  writeFileSync(out, pptx);
  const audit = await auditPptxFile(out);
  console.log(JSON.stringify({
    uac: rows[0].uac_name,
    planningId: id,
    planningUpdatedAt: rows[0].updated_at,
    decks: decks.length,
    file: out,
    slideCount: audit.slideCount,
    wrapNoneShapes: audit.wrapNoneShapes,
    outOfBoundsShapes: audit.outOfBoundsShapes,
    collisions: audit.collisions.length,
    wordStats: audit.wordStats,
    repeatedMisconceptions: audit.repeatedMisconceptions,
    findings: audit.findings,
    tracker: tracker.size,
  }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
