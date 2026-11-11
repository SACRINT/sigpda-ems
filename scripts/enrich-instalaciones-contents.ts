/**
 * enrich-instalaciones-contents.ts — P1.2
 *
 * Sustituye los `contenidos_formativos` provisionales (`activities_mirror`) de
 * las 8 UAC de Instalaciones Residenciales por la forma canónica:
 *
 *   [{ numero, proposito, actividad_clave, contenidos: string[], saberes }]
 *
 * Los temas provienen de los contenidos oficiales de la malla
 * (`Instalaciones_Residenciales_2024.pdf`) y se declaran por actividad clave.
 *
 * Uso:
 *   npx tsx scripts/enrich-instalaciones-contents.ts            # dry-run
 *   npx tsx scripts/enrich-instalaciones-contents.ts --apply    # respalda y aplica
 *   npx tsx scripts/enrich-instalaciones-contents.ts --apply --force
 *
 * El respaldo se crea en una tabla `programs_catalog_backup_p1_2_<timestamp>`.
 */

import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';
import { INSTALACIONES_RESIDENCIALES_TRAJECTORY } from '../src/lib/curriculum/trajectories/instalaciones-residenciales';
import { buildFormativeContents } from '../src/lib/curriculum/trajectory-contents';
import type { TrajectoryNode } from '../src/lib/curriculum/trajectory-types';

const env = readFileSync('.env.local', 'utf8');
const match = env.match(/DATABASE_URL=['"]?([^'"\r\n]+)/);
if (!match) {
  console.error('DATABASE_URL no encontrado en .env.local');
  process.exit(1);
}

const sql = neon(match[1]);
const APPLY = process.argv.includes('--apply');
const FORCE = process.argv.includes('--force');

interface CatalogRow {
  id: string;
  uac_name: string;
  semester: number | null;
  contenidos_formativos: unknown;
}

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const isAlreadyEnriched = (value: unknown): boolean =>
  Array.isArray(value) &&
  value.length === 3 &&
  value.every(
    (item) =>
      item &&
      typeof item === 'object' &&
      (item as Record<string, unknown>).source === 'official_pdf_2024' &&
      (item as Record<string, unknown>).needs_review === false &&
      Array.isArray((item as Record<string, unknown>).contenidos)
  );

function describeCurrent(value: unknown): string {
  if (!Array.isArray(value) || value.length === 0) return 'vacío';
  const sources = new Set(
    value.map((item) =>
      item && typeof item === 'object' && typeof (item as Record<string, unknown>).source === 'string'
        ? String((item as Record<string, unknown>).source)
        : 'sin source'
    )
  );
  const review = value.some(
    (item) => item && typeof item === 'object' && (item as Record<string, unknown>).needs_review === true
  );
  return `${value.length} entradas, source=${[...sources].join('/')}${review ? ', needs_review=true' : ''}`;
}

function printProposal(node: TrajectoryNode): void {
  console.log(`\n${node.id} (${node.semester}°) ${node.uacName}`);
  for (const item of buildFormativeContents(node)) {
    console.log(`  A${item.numero}: ${item.actividad_clave}`);
    for (const content of item.contenidos) console.log(`      • ${content}`);
  }
}

async function main(): Promise<void> {
  console.log(`\n=== P1.2 Contenidos oficiales — ${INSTALACIONES_RESIDENCIALES_TRAJECTORY.name} ===`);
  console.log(APPLY ? 'Modo: APPLY (respaldo + actualización)' : 'Modo: DRY-RUN (solo lectura)');

  const catalogRows = (await sql`
    SELECT id, uac_name, semester, contenidos_formativos
    FROM programs_catalog
    WHERE curriculum_name ILIKE '%Instalaciones%'
    ORDER BY semester, uac_name
  `) as CatalogRow[];

  const byNormalizedName = new Map(catalogRows.map((row) => [normalize(row.uac_name), row]));
  const pending: Array<{ node: TrajectoryNode; row: CatalogRow }> = [];
  let already = 0;

  for (const node of INSTALACIONES_RESIDENCIALES_TRAJECTORY.nodes) {
    const row = byNormalizedName.get(normalize(node.uacName));
    if (!row) {
      console.error(`✗ No existe en programs_catalog: ${node.id} — ${node.uacName}`);
      process.exitCode = 1;
      continue;
    }

    if (isAlreadyEnriched(row.contenidos_formativos) && !FORCE) {
      already += 1;
      console.log(`= ${node.id} ya enriquecida (${describeCurrent(row.contenidos_formativos)}).`);
      continue;
    }

    console.log(`\n→ ${node.id} (${row.semester}°) ${row.uac_name}`);
    console.log(`  Actual: ${describeCurrent(row.contenidos_formativos)}`);
    console.log(`  Propuesto: ${buildFormativeContents(node).length} entradas oficiales`);
    printProposal(node);
    pending.push({ node, row });
  }

  if (pending.length === 0) {
    console.log(`\nNada pendiente. ${already} UAC ya enriquecidas.`);
    return;
  }

  if (!APPLY) {
    console.log(`\nDry-run: ${pending.length} UAC por actualizar; ${already} ya enriquecidas.`);
    console.log('Ejecuta con --apply para respaldar y escribir en programs_catalog.\n');
    return;
  }

  const backupTable = `programs_catalog_backup_p1_2_${Date.now()}`;
  if (!/^programs_catalog_backup_p1_2_\d+$/.test(backupTable)) {
    throw new Error(`Nombre de respaldo inválido: ${backupTable}`);
  }
  const ids = pending
    .map(({ row }) => row.id)
    .filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  if (ids.length !== pending.length) {
    throw new Error('Algún id de UAC no tiene formato UUID; se aborta el respaldo.');
  }
  const idList = ids.map((id) => `'${id}'`).join(',');

  await sql.query(
    `CREATE TABLE ${backupTable} AS SELECT * FROM programs_catalog WHERE id IN (${idList})`
  );
  console.log(`\nRespaldo creado: ${backupTable}`);

  for (const { node, row } of pending) {
    const items = buildFormativeContents(node);
    await sql`
      UPDATE programs_catalog
      SET contenidos_formativos = ${JSON.stringify(items)}::jsonb,
          uac_name = ${node.uacName}
      WHERE id = ${row.id}
    `;
    console.log(`✓ ${node.id} actualizada (${items.length} entradas, ${items.reduce((sum, item) => sum + item.contenidos.length, 0)} temas).`);
  }

  const verify = (await sql.query(
    `SELECT id, uac_name, contenidos_formativos
     FROM programs_catalog
     WHERE id IN (${idList})
     ORDER BY semester, uac_name`
  )) as CatalogRow[];

  const bad = verify.filter((row) => !isAlreadyEnriched(row.contenidos_formativos));
  if (bad.length > 0) {
    console.error(`\n✗ Verificación falló en ${bad.length} fila(s): ${bad.map((row) => row.id).join(', ')}`);
    process.exitCode = 1;
    return;
  }

  console.log(`\n✓ Verificación: ${verify.length}/${pending.length} UAC con 3 entradas oficiales y needs_review=false.`);
  console.log(`Respaldo disponible en: ${backupTable}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
