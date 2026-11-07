/**
 * reset-canonical-plannings.ts
 * Prepara las 8 UAC canonicas para regeneracion editorial limpia:
 *   - respalda planeaciones, hijos y semillas en un JSON temporal;
 *   - borra planning_extras de las 8 UAC;
 *   - borra todas las semillas canonicas;
 *   - limpia workbooks_json, workbook_progress y sequence_json.
 *
 * Uso:
 *   npx tsx scripts/reset-canonical-plannings.ts
 *   npx tsx scripts/reset-canonical-plannings.ts --execute
 *
 * Sin --execute es un dry-run READ-ONLY.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function loadEnv(): void {
  const envPath = join(process.cwd(), '.env.local');
  if (!existsSync(envPath)) return;
  const raw = readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const key = match[1];
    const value = match[2].trim().replace(/^["']|["']$/g, '');
    if (value && !process.env[key]) process.env[key] = value;
  }
}

loadEnv();

import { sql } from '../src/lib/db/client';

interface TargetPlanning {
  id: string;
  uac: string;
}

const TARGETS: TargetPlanning[] = [
  { id: '4a3335eb-99f3-47f8-a3d0-c83297fe488b', uac: 'Coloca elementos constructivos básicos de una vivienda' },
  { id: '9fcc6660-fb0f-40ac-8601-c99279f83ed1', uac: 'Limpia muebles, tuberías y conexiones' },
  { id: '215643ee-47ad-436a-85df-ea0c8ca39ca4', uac: 'Pensamiento Matemático I' },
  { id: '166f816d-7a66-46dc-b5b6-b1ccda273353', uac: 'Interpreta croquis de instalaciones básicas' },
  { id: '7d59944d-939e-4f21-9cf4-386f97dfa763', uac: 'Prepara mezclas' },
  { id: '9eac6ffc-54b8-44a3-8ab2-b207eb140fc5', uac: 'Dibujo Técnico I' },
  { id: '90da0b02-1946-41d6-83c0-2334569cd632', uac: 'Pensamiento Matemático III' },
  { id: 'c1c61383-0976-46cb-8999-595985044b39', uac: 'Taller de Pensamiento Variacional I' },
];

const CHILD_TABLES = [
  'planning_extras',
  'generation_jobs',
  'editorial_books',
  'audit_results',
  'generation_audit_logs',
  'image_assets',
  'uploaded_pdfs',
] as const;

interface PlanningSnapshot {
  id: string;
  uac: string;
  planning: unknown;
  children: Record<string, unknown[]>;
  counts: Record<string, number>;
}

function tempBackupPath(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return join(tmpdir(), `sigpda-regeneration-backup-${stamp}.json`);
}

async function getPlanningId(id: string): Promise<boolean> {
  const client = sql();
  const rows = await client`SELECT id FROM plannings WHERE id = ${id}::uuid`;
  return rows.length > 0;
}

async function getCounts(id: string): Promise<Record<string, number>> {
  const client = sql();
  const rows = (await client`
    SELECT
      (SELECT count(*) FROM planning_extras WHERE planning_id = ${id}::uuid)::int AS planning_extras,
      (SELECT count(*) FROM generation_jobs WHERE planning_id = ${id}::uuid)::int AS generation_jobs,
      (SELECT count(*) FROM editorial_books WHERE planning_id = ${id}::uuid)::int AS editorial_books,
      (SELECT count(*) FROM audit_results WHERE planning_id = ${id}::uuid)::int AS audit_results,
      (SELECT count(*) FROM generation_audit_logs WHERE planning_id = ${id}::uuid)::int AS generation_audit_logs,
      (SELECT count(*) FROM image_assets WHERE planning_id = ${id}::uuid)::int AS image_assets,
      (SELECT count(*) FROM uploaded_pdfs WHERE planning_id = ${id}::uuid)::int AS uploaded_pdfs
  `) as unknown as Record<string, number>[];
  return rows[0];
}

async function snapshotPlanning(target: TargetPlanning): Promise<PlanningSnapshot | null> {
  const client = sql();
  const planningRows = (await client`
    SELECT to_jsonb(p) AS data FROM plannings p WHERE p.id = ${target.id}::uuid
  `) as unknown as { data: unknown }[];
  if (planningRows.length === 0) return null;

  const childRows = (await client`
    SELECT jsonb_build_object(
      'planning_extras', COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM planning_extras x WHERE x.planning_id = ${target.id}::uuid), '[]'::jsonb),
      'generation_jobs', COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM generation_jobs x WHERE x.planning_id = ${target.id}::uuid), '[]'::jsonb),
      'editorial_books', COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM editorial_books x WHERE x.planning_id = ${target.id}::uuid), '[]'::jsonb),
      'audit_results', COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM audit_results x WHERE x.planning_id = ${target.id}::uuid), '[]'::jsonb),
      'generation_audit_logs', COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM generation_audit_logs x WHERE x.planning_id = ${target.id}::uuid), '[]'::jsonb),
      'image_assets', COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM image_assets x WHERE x.planning_id = ${target.id}::uuid), '[]'::jsonb),
      'uploaded_pdfs', COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM uploaded_pdfs x WHERE x.planning_id = ${target.id}::uuid), '[]'::jsonb)
    ) AS data
  `) as unknown as { data: Record<string, unknown[]> }[];

  const children = childRows[0].data;
  const counts: Record<string, number> = {};
  for (const table of CHILD_TABLES) {
    counts[table] = Array.isArray(children[table]) ? children[table].length : 0;
  }

  return {
    id: target.id,
    uac: target.uac,
    planning: planningRows[0].data,
    children,
    counts,
  };
}

function formatCounts(counts: Record<string, number>): string {
  return Object.entries(counts)
    .filter(([, value]) => value > 0)
    .map(([key, value]) => `${key}=${value}`)
    .join(', ') || 'sin hijos';
}

async function writeBackup(snapshots: PlanningSnapshot[]): Promise<string> {
  const client = sql();
  const seedRows = (await client`
    SELECT to_jsonb(s) AS data FROM educational_canonical_seeds s ORDER BY created_at
  `) as unknown as { data: unknown }[];
  const path = tempBackupPath();
  writeFileSync(
    path,
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        plannings: snapshots,
        canonicalSeeds: seedRows.map((row) => row.data),
      },
      null,
      2
    ),
    'utf8'
  );
  return path;
}

async function executeReset(): Promise<void> {
  const client = sql();

  for (const target of TARGETS) {
    await client`DELETE FROM planning_extras WHERE planning_id = ${target.id}::uuid`;
  }
  await client`DELETE FROM educational_canonical_seeds`;

  for (const target of TARGETS) {
    await client`
      UPDATE plannings
      SET workbooks_json = '{}'::jsonb,
          workbook_progress = '{}'::jsonb,
          sequence_json = NULL,
          updated_at = NOW()
      WHERE id = ${target.id}::uuid
    `;
  }
}

async function main(): Promise<void> {
  const execute = process.argv.includes('--execute');
  console.log('='.repeat(78));
  console.log(execute ? 'RESET DE LAS 8 UAC CANONICAS' : 'DRY-RUN: RESET DE LAS 8 UAC CANONICAS');
  console.log('='.repeat(78));

  const snapshots: PlanningSnapshot[] = [];
  let totalExtras = 0;
  let missing = 0;

  for (const target of TARGETS) {
    if (!(await getPlanningId(target.id))) {
      console.log(`\n[FALTA] ${target.uac} → ${target.id}`);
      missing += 1;
      continue;
    }
    const counts = await getCounts(target.id);
    totalExtras += counts.planning_extras ?? 0;
    const snapshot = await snapshotPlanning(target);
    if (snapshot) snapshots.push(snapshot);
    console.log(`\n[OK] ${target.uac}`);
    console.log(`  id: ${target.id}`);
    console.log(`  hijos: ${formatCounts(counts)}`);
  }

  if (missing > 0) {
    throw new Error(`Faltan ${missing} planeaciones canonicas; se aborta el reset.`);
  }

  const seedRows = (await sql()`
    SELECT count(*)::int AS total FROM educational_canonical_seeds
  `) as unknown as { total: number }[];
  console.log(`\nSemillas canonicas a borrar: ${seedRows[0]?.total ?? 0}`);
  console.log(`Planning extras a borrar: ${totalExtras}`);

  if (!execute) {
    console.log('\nDry-run completado. No se modifico la base. Ejecuta con --execute para aplicar.');
    return;
  }

  const backupPath = await writeBackup(snapshots);
  console.log(`\nBackup escrito en: ${backupPath}`);
  await executeReset();
  console.log('\nRESET COMPLETADO: extras y semillas borrados; workbooks, progreso y secuencias limpiados.');
}

main().catch((error) => {
  console.error('\nERROR:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
