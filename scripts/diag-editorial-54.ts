/**
 * diag-editorial-54.ts — Diagnóstico "Libro Editorial solo 54/72 sesiones".
 *
 * Distingue las 3 hipótesis:
 *   (A) workbooks_json tenía <72 planes al momento del compose.
 *   (B) el compose encontró 72 pero StudentSessionSchema descartó 18.
 *   (C) el capítulo tenía 72 pero el worker Typst solo renderizó 54.
 *
 * Uso: npx tsx scripts/diag-editorial-54.ts [planningId]
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { neon } from '@neondatabase/serverless';
import {
  StudentSessionSchema,
  adaptSessionPlanToStudentSession,
} from '../src/lib/editorial/student-content-model';
import type { SessionPlan } from '../src/types/work-textbook';

function loadEnvLocal(): void {
  try {
    const raw = readFileSync(join(process.cwd(), '.env.local'), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!m) continue;
      const key = m[1];
      const val = m[2].trim().replace(/^["']|["']$/g, '');
      if (val && !process.env[key]) process.env[key] = val;
    }
  } catch {
    // opcional
  }
}

async function main(): Promise<void> {
  loadEnvLocal();
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL no disponible');
  const sql = neon(url);
  const planningId =
    process.argv[2] || '90da0b02-1946-41d6-83c0-2334569cd632';

  console.log('=== 1) editorial_books (historial del libro editorial) ===');
  const books = await sql`
    SELECT id, status, page_count, created_at, metadata
    FROM editorial_books
    WHERE planning_id = ${planningId}
    ORDER BY created_at DESC
    LIMIT 5`;
  for (const b of books) {
    const md = (b.metadata ?? {}) as Record<string, unknown>;
    console.log(
      `- ${b.created_at} | status=${b.status} | pages=${b.page_count} | ` +
        `sessionCount(chapter)=${md.sessionCount} | renderedSessionCount(worker)=${md.renderedSessionCount} | ` +
        `productoIntegrador=${md.renderedProductoIntegradorCount} | durationMs=${md.durationMs}`,
    );
  }

  console.log('\n=== 2) workbooks_json: planes por bloque/misión (estado ACTUAL) ===');
  const rows = await sql`
    SELECT workbooks_json FROM plannings WHERE id = ${planningId}`;
  const w = (rows[0]?.workbooks_json ?? {}) as Record<
    string,
    { current?: { missions?: Array<{ sessionPlans?: SessionPlan[] }> } } | null
  >;
  let totalFound = 0;
  const allPlans: SessionPlan[] = [];
  const blockKeys = Object.keys(w)
    .filter((k) => /^block_\d+$/.test(k))
    .sort((a, b) => Number(a.slice(6)) - Number(b.slice(6)));
  for (const key of blockKeys) {
    const missions = w[key]?.current?.missions ?? [];
    const counts = missions.map((m) => (Array.isArray(m?.sessionPlans) ? m.sessionPlans.length : 0));
    const total = counts.reduce((a, b) => a + b, 0);
    totalFound += total;
    console.log(`- ${key}: misiones=[${counts.join(', ')}] total=${total}`);
    for (const m of missions) {
      if (Array.isArray(m?.sessionPlans)) allPlans.push(...m.sessionPlans);
    }
  }
  console.log(`TOTAL planes en workbooks_json: ${totalFound}`);

  console.log('\n=== 3) Simulación del compose: validación StudentSessionSchema ===');
  let valid = 0;
  const discarded: Array<{ idx: number; issues: string }> = [];
  allPlans.sort((a, b) => (a?.sessionNumber || 0) - (b?.sessionNumber || 0));
  for (let i = 0; i < allPlans.length; i++) {
    try {
      const parsed = StudentSessionSchema.safeParse(
        adaptSessionPlanToStudentSession(allPlans[i]),
      );
      if (parsed.success) valid++;
      else
        discarded.push({
          idx: i + 1,
          issues: parsed.error.issues
            .slice(0, 3)
            .map((is) => `${is.path.join('.')}: ${is.message}`)
            .join(' | '),
        });
    } catch (e) {
      discarded.push({ idx: i + 1, issues: `THROW: ${e instanceof Error ? e.message : String(e)}` });
    }
  }
  console.log(`Válidas: ${valid}/${allPlans.length}`);
  if (discarded.length) {
    console.log(`Descartadas (${discarded.length}):`);
    for (const d of discarded) console.log(`  #${d.idx}: ${d.issues}`);
  } else {
    console.log('Ninguna descartada.');
  }

  console.log('\n=== VEREDICTO ===');
  if (totalFound < 72) {
    console.log(`HIPÓTESIS A: workbooks_json solo tiene ${totalFound}/72 planes → el compose nunca vio 72.`);
  } else if (valid < 72) {
    console.log(`HIPÓTESIS B: los 72 planes existen pero ${72 - valid} no validan el modelo de estudiante → descartados en el compose.`);
  } else {
    console.log('HIPÓTESIS C: compose produciría 72 sesiones válidas → el corte está en el worker Typst (revisar renderedSessionCount en §1).');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
