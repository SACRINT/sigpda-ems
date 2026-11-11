/**
 * audit-instalaciones-catalog.ts — Auditoría de solo lectura que compara la
 * malla DAG de Instalaciones Residenciales con las filas de `programs_catalog`.
 *
 * No modifica la base de datos. Sirve para saber qué UACs ya existen, con qué
 * horas/actividades y qué falta antes de enriquecer contenidos (P1.2).
 *
 * Uso: npx tsx scripts/audit-instalaciones-catalog.ts
 */

import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';
import { INSTALACIONES_RESIDENCIALES_TRAJECTORY } from '../src/lib/curriculum/trajectories/instalaciones-residenciales';

const env = readFileSync('.env.local', 'utf8');
const match = env.match(/DATABASE_URL=['"]?([^'"\r\n]+)/);
if (!match) {
  console.error('DATABASE_URL no encontrado en .env.local');
  process.exit(1);
}

const sql = neon(match[1]);

interface CatalogRow {
  id: string;
  uac_name: string;
  semester: number | null;
  component: string | null;
  curriculum_name: string | null;
  subsystem: string | null;
  total_hours: number | null;
  activities: unknown;
  contenidos_formativos: unknown;
}

const countJson = (value: unknown): number => (Array.isArray(value) ? value.length : 0);

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

async function main(): Promise<void> {
  let found = 0;
  let missing = 0;

  console.log(`\n=== Auditoría de catálogo: ${INSTALACIONES_RESIDENCIALES_TRAJECTORY.name} ===\n`);

  const catalogRows = (await sql`
    SELECT id, uac_name, semester, component, curriculum_name, subsystem, total_hours, activities, contenidos_formativos
    FROM programs_catalog
    WHERE curriculum_name ILIKE '%Instalaciones%'
    ORDER BY semester, uac_name
  `) as CatalogRow[];

  const byNormalizedName = new Map(catalogRows.map((row) => [normalize(row.uac_name), row]));

  for (const node of INSTALACIONES_RESIDENCIALES_TRAJECTORY.nodes) {
    const row = byNormalizedName.get(normalize(node.uacName));
    if (!row) {
      missing += 1;
      console.log(`✗ ${node.id} (${node.semester}°) NO EXISTE: ${node.uacName}`);
      continue;
    }

    found += 1;
    const activities = countJson(row.activities);
    const contents = countJson(row.contenidos_formativos);
    const hoursOk = row.total_hours === node.totalHours ? 'OK' : `≠${row.total_hours}`;
    const nameVariant = row.uac_name !== node.uacName ? ` [variante: "${row.uac_name}"]` : '';
    console.log(
      `✓ ${node.id} (${node.semester}°) ${row.uac_name}${nameVariant}\n` +
        `   id=${row.id} sem=${row.semester} comp=${row.component} sub=${row.subsystem} ` +
        `horas=${hoursOk} actividades=${activities}/3 contenidos=${contents}`
    );
  }

  console.log(`\nFilas con curriculum_name ~ "Instalaciones": ${catalogRows.length}`);
  for (const row of catalogRows) {
    console.log(
      `   ${row.semester}° [${row.component}/${row.subsystem}] ${row.uac_name} ` +
        `(horas=${row.total_hours}, actividades=${countJson(row.activities)}, contenidos=${countJson(row.contenidos_formativos)})`
    );
  }

  console.log(
    `\nResumen: ${found}/${INSTALACIONES_RESIDENCIALES_TRAJECTORY.nodes.length} UAC encontradas; ${missing} faltantes.`
  );
  console.log('Siguiente paso: enriquecer/crear filas con las 3 actividades clave y contenidos oficiales (P1.2).\n');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
