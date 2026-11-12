/**
 * rollback-sanitize-workbooks.ts — Script de Reversión P0 / Fase A.1
 *
 * Restaura la columna `workbooks_json` en `plannings` a partir de una tabla de respaldo.
 *
 * Uso:
 *   npx tsx scripts/rollback-sanitize-workbooks.ts                    # Usa el último respaldo registrado
 *   npx tsx scripts/rollback-sanitize-workbooks.ts --table <nombre>  # Usa una tabla específica
 */

import { readFileSync, existsSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';

function getDbClient() {
  const env = readFileSync('.env.local', 'utf8');
  const match = env.match(/DATABASE_URL=['"]?([^'"\r\n]+)/);
  if (!match) {
    throw new Error('DATABASE_URL no encontrada en .env.local');
  }
  return neon(match[1]);
}

async function run() {
  const sql = getDbClient();
  const tableArgIndex = process.argv.indexOf('--table');
  let backupTable: string | null = null;

  if (tableArgIndex !== -1 && process.argv[tableArgIndex + 1]) {
    backupTable = process.argv[tableArgIndex + 1].trim();
  } else if (existsSync('scripts/.last-workbooks-backup.json')) {
    const meta = JSON.parse(readFileSync('scripts/.last-workbooks-backup.json', 'utf8'));
    backupTable = meta.backupTable;
  }

  if (!backupTable) {
    console.error('No se especificó tabla de respaldo ni existe scripts/.last-workbooks-backup.json');
    console.error('Uso: npx tsx scripts/rollback-sanitize-workbooks.ts --table plannings_workbooks_backup_<timestamp>');
    process.exit(1);
  }

  // Validar nombre de tabla seguro (solo letras, números y guiones bajos)
  if (!/^plannings_workbooks_backup_[0-9]+$/.test(backupTable)) {
    console.error(`Nombre de tabla de respaldo no válido o inseguro: ${backupTable}`);
    process.exit(1);
  }

  console.log(`Iniciando rollback desde la tabla: ${backupTable}...`);

  const check = (await sql.query(`SELECT COUNT(*) as count FROM ${backupTable}`)) as Array<{ count: string | number }>;
  const rowCount = Number(check[0]?.count || 0);
  console.log(`Filas detectadas en la tabla de respaldo: ${rowCount}`);

  if (rowCount === 0) {
    console.error('La tabla de respaldo está vacía. Abortando rollback.');
    process.exit(1);
  }

  // Restaurar workbooks_json mediante UPDATE JOIN
  await sql.query(`
    UPDATE plannings p
    SET workbooks_json = b.workbooks_json,
        updated_at = NOW()
    FROM ${backupTable} b
    WHERE p.id = b.id
  `);

  console.log(`✓ Rollback completado exitosamente. Se restauraron ${rowCount} filas desde ${backupTable}.`);
}

run().catch((err) => {
  console.error('Error fatal durante el rollback:', err);
  process.exit(1);
});
