import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { neon } from '@neondatabase/serverless';
import { renderWorkbookToPdf } from '../src/lib/pdf-workbook-renderer';
import { auditPdfFile } from './qa-sacrint-materials';
import type { ActiveWorkTextbook } from '../src/types/work-textbook';
import type { Planning } from '../src/types/planning';

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
  const rows = (await sql`SELECT * FROM plannings WHERE id = ${id}::uuid`) as unknown as Array<Record<string, unknown>>;
  if (!rows[0]) throw new Error('planning no encontrada');
  const row = rows[0];
  const workbooks = (row.workbooks_json || {}) as Record<string, { current?: ActiveWorkTextbook }>;
  const planning = {
    id: row.id,
    teacherId: row.teacher_id,
    uacName: row.uac_name,
    semester: row.semester,
    component: row.component,
    curriculumName: row.curriculum_name,
    paecContext: row.paec_context,
    extractedData: row.extracted_data,
    contentJson: row.content_json,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    metodologiaActiva: row.metodologia_activa,
    evaluationJson: row.evaluation_json,
    sequenceJson: row.sequence_json,
    workbooksJson: workbooks,
  } as unknown as Planning;

  const outDir = join(process.env.TEMP || '.', 'opencode');
  const audits: unknown[] = [];
  for (const [key, value] of Object.entries(workbooks)) {
    const m = /^block_(\d+)$/.exec(key);
    if (!m || !value?.current) continue;
    const blockIndex = Number(m[1]);
    const file = join(outDir, `06_Libro_Semestral_PM3_Bloque_${blockIndex + 1}.pdf`);
    const buf = await renderWorkbookToPdf(value.current, planning, { forceFallbackCover: true });
    writeFileSync(file, buf);
    const audit = await auditPdfFile(file);
    audits.push({ blockIndex: blockIndex + 1, file, pages: audit.pages, wordCount: audit.wordCount, findings: audit.findings });
  }
  console.log(JSON.stringify({ uac: row.uac_name, updatedAt: row.updated_at, audits }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
