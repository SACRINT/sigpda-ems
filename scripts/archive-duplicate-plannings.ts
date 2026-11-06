/**
 * archive-duplicate-plannings.ts
 * Archiva y elimina las planeaciones duplicadas conocidas, conservando una copia
 * completa de la planeacion y de sus tablas hijas en plannings_archive.
 *
 * Uso:
 *   npx tsx scripts/archive-duplicate-plannings.ts
 *   npx tsx scripts/archive-duplicate-plannings.ts --execute
 *
 * Sin --execute es un dry-run READ-ONLY. Con --execute crea la tabla de archivo
 * y elimina cada duplicado en una sola sentencia atomica (archivo + delete).
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

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

interface DuplicatePlan {
  uac: string;
  canonicalId: string;
  duplicateId: string;
}

const DUPLICATES: DuplicatePlan[] = [
  {
    uac: 'Pensamiento Matemático I',
    canonicalId: '215643ee-47ad-436a-85df-ea0c8ca39ca4',
    duplicateId: '5c91f1ad-c114-46be-a64f-315591bed656',
  },
  {
    uac: 'Croquis y Planos',
    canonicalId: '166f816d-7a66-46dc-b5b6-b1ccda273353',
    duplicateId: '6a025380-c019-4f2a-84ec-3a6f098b874f',
  },
  {
    uac: 'Pensamiento Matemático III',
    canonicalId: '90da0b02-1946-41d6-83c0-2334569cd632',
    duplicateId: '52fdfd39-f6e4-44b1-b957-21a249626fb7',
  },
  {
    uac: 'Pensamiento Matemático III',
    canonicalId: '90da0b02-1946-41d6-83c0-2334569cd632',
    duplicateId: 'afc7fe07-35f3-42a4-93b5-35f79c708817',
  },
];

const REASON = 'duplicado consolidado en planeacion canonica';

interface PlanningSummary {
  id: string;
  uac_name: string;
  status: string;
}

interface ChildCounts {
  planning_extras: number;
  generation_jobs: number;
  editorial_books: number;
  audit_results: number;
  generation_audit_logs: number;
  image_assets: number;
  uploaded_pdfs: number;
}

async function getPlanning(id: string): Promise<PlanningSummary | null> {
  const client = sql();
  const rows = (await client`
    SELECT id::text, uac_name, status
    FROM plannings
    WHERE id = ${id}::uuid
  `) as unknown as PlanningSummary[];
  return rows[0] ?? null;
}

async function getChildCounts(id: string): Promise<ChildCounts> {
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
  `) as unknown as ChildCounts[];
  return rows[0];
}

async function ensureArchiveTable(): Promise<void> {
  const client = sql();
  await client`
    CREATE TABLE IF NOT EXISTS plannings_archive (
      archive_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      planning_id UUID NOT NULL UNIQUE,
      archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      reason TEXT NOT NULL,
      planning_data JSONB NOT NULL,
      related_data JSONB NOT NULL DEFAULT '{}'::jsonb
    )
  `;
  await client`
    CREATE INDEX IF NOT EXISTS idx_plannings_archive_planning
    ON plannings_archive(planning_id)
  `;
}

async function archiveAndDelete(id: string): Promise<boolean> {
  const client = sql();
  const rows = (await client`
    WITH target AS (
      SELECT to_jsonb(p) AS planning_data
      FROM plannings p
      WHERE p.id = ${id}::uuid
    ),
    children AS (
      SELECT jsonb_build_object(
        'planning_extras', COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM planning_extras x WHERE x.planning_id = ${id}::uuid), '[]'::jsonb),
        'generation_jobs', COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM generation_jobs x WHERE x.planning_id = ${id}::uuid), '[]'::jsonb),
        'editorial_books', COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM editorial_books x WHERE x.planning_id = ${id}::uuid), '[]'::jsonb),
        'audit_results', COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM audit_results x WHERE x.planning_id = ${id}::uuid), '[]'::jsonb),
        'generation_audit_logs', COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM generation_audit_logs x WHERE x.planning_id = ${id}::uuid), '[]'::jsonb),
        'image_assets', COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM image_assets x WHERE x.planning_id = ${id}::uuid), '[]'::jsonb),
        'uploaded_pdfs', COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM uploaded_pdfs x WHERE x.planning_id = ${id}::uuid), '[]'::jsonb)
      ) AS related_data
    ),
    archived AS (
      INSERT INTO plannings_archive (planning_id, reason, planning_data, related_data)
      SELECT ${id}::uuid, ${REASON}, t.planning_data, c.related_data
      FROM target t CROSS JOIN children c
      ON CONFLICT (planning_id) DO UPDATE SET
        archived_at = NOW(),
        reason = EXCLUDED.reason,
        planning_data = EXCLUDED.planning_data,
        related_data = EXCLUDED.related_data
      RETURNING planning_id
    )
    DELETE FROM plannings
    WHERE id = ${id}::uuid
      AND EXISTS (SELECT 1 FROM archived)
    RETURNING id
  `) as unknown as { id: string }[];
  return rows.length > 0;
}

function formatCounts(counts: ChildCounts): string {
  return Object.entries(counts)
    .filter(([, value]) => value > 0)
    .map(([key, value]) => `${key}=${value}`)
    .join(', ') || 'sin hijos';
}

function normalizeUac(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function uacMatches(left: string, right: string): boolean {
  const a = normalizeUac(left);
  const b = normalizeUac(right);
  return a === b || a.includes(b) || b.includes(a);
}

async function main(): Promise<void> {
  const execute = process.argv.includes('--execute');
  console.log('='.repeat(78));
  console.log(execute ? 'ARCHIVAR Y ELIMINAR DUPLICADOS' : 'DRY-RUN: ARCHIVAR Y ELIMINAR DUPLICADOS');
  console.log('='.repeat(78));

  const seenCanonicals = new Set<string>();
  const seenDuplicates = new Set<string>();

  for (const item of DUPLICATES) {
    if (item.canonicalId === item.duplicateId) {
      throw new Error(`ID canonico y duplicado son iguales: ${item.duplicateId}`);
    }
    if (seenCanonicals.has(item.canonicalId) && seenDuplicates.has(item.duplicateId)) {
      throw new Error(`Duplicado repetido en la lista: ${item.duplicateId}`);
    }
    seenCanonicals.add(item.canonicalId);
    seenDuplicates.add(item.duplicateId);

    const canonical = await getPlanning(item.canonicalId);
    const duplicate = await getPlanning(item.duplicateId);

    console.log(`\n[${item.uac}]`);
    console.log(`  canonica:  ${item.canonicalId} → ${canonical ? `${canonical.uac_name} (${canonical.status})` : 'NO EXISTE'}`);
    console.log(`  duplicado: ${item.duplicateId} → ${duplicate ? `${duplicate.uac_name} (${duplicate.status})` : 'NO EXISTE'}`);

    if (!canonical) {
      throw new Error(`No existe la planeacion canonica ${item.canonicalId}; se aborta para no perder datos.`);
    }
    if (!duplicate) {
      console.log('  → ya no existe; nada que archivar.');
      continue;
    }
    if (!uacMatches(canonical.uac_name, duplicate.uac_name)) {
      throw new Error(
        `La UAC no coincide (canonica="${canonical.uac_name}", duplicado="${duplicate.uac_name}"). Se aborta.`
      );
    }

    const counts = await getChildCounts(item.duplicateId);
    console.log(`  hijos: ${formatCounts(counts)}`);
    console.log(`  accion: ${execute ? 'archivar + eliminar' : 'se archivaria + eliminaria con --execute'}`);
  }

  if (!execute) {
    console.log('\nDry-run completado. No se modifico la base. Ejecuta con --execute para aplicar.');
    return;
  }

  await ensureArchiveTable();
  let archived = 0;
  for (const item of DUPLICATES) {
    const duplicate = await getPlanning(item.duplicateId);
    if (!duplicate) continue;
    const deleted = await archiveAndDelete(item.duplicateId);
    if (deleted) archived += 1;
    console.log(`\n[${deleted ? 'ARCHIVADO' : 'SIN CAMBIO'}] ${item.duplicateId} (${duplicate.uac_name})`);
  }
  console.log(`\nTotal archivado y eliminado: ${archived}`);
}

main().catch((error) => {
  console.error('\nERROR:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
