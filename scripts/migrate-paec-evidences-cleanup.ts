/**
 * scripts/migrate-paec-evidences-cleanup.ts
 *
 * Migración reversible para limpiar fallbacks genéricos en programs_catalog.evidences.
 *
 * ACCIÓN (--up):
 *   1. Crea tabla de backup: programs_catalog_evidences_backup_<YYYYMMDDHHMMSS>
 *   2. Pone evidences = '[]'::jsonb en filas donde evidences contenga
 *      "Ensayo crítico" o "Portafolio de evidencias de aprendizaje y evaluación formativa".
 *   3. Es idempotente: solo toca filas que aún tengan el texto genérico.
 *   4. Todo dentro de una transacción BEGIN/COMMIT con ROLLBACK en caso de error.
 *
 * ROLLBACK (--down):
 *   1. Restaura evidences desde la tabla de backup más reciente.
 *   2. Opcionalmente droppea la tabla de backup.
 *
 * Requisitos previos:
 *   - Verificar consumidores de `evidences: string[]` (regresión en rutas y contratos públicos).
 *   - Ejecutar en horario de bajo tráfico.
 */

import { sql } from '../src/lib/db/client';
import { logger } from '../src/lib/logger';

const BACKUP_TABLE = `programs_catalog_evidences_backup_${new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14)}`;

// Nombres de tabla escapados con comillas dobles para PostgreSQL (identificadores)
const BACKUP_TABLE_ESCAPED = `"${BACKUP_TABLE}"`;

const GENERIC_PATTERNS = [
  '%Ensayo crítico%',
  '%Portafolio de evidencias de aprendizaje y evaluación formativa%',
];

// Construye un array PostgreSQL explícito para ILIKE ANY
const PATTERNS_ARRAY_SQL = `ARRAY[${GENERIC_PATTERNS.map((p) => `'${p}'`).join(', ')}]::text[]`;

interface QueryClient {
  query: (sqlText: string) => Promise<unknown[]>;
}

async function up(): Promise<void> {
  const client = sql() as unknown as QueryClient;
  logger.info('[migrate-evidences] Iniciando migración UP');

  await client.query('BEGIN');
  try {
    // 1. Backup completo de la tabla antes de tocarla
    await client.query(`CREATE TABLE ${BACKUP_TABLE_ESCAPED} AS SELECT * FROM programs_catalog;`);
    logger.info(`[migrate-evidences] Backup creado: ${BACKUP_TABLE}`);

    // 2. Contar filas afectadas antes
    const antes = await client.query(
      `SELECT COUNT(*) AS total FROM programs_catalog WHERE evidences::text ILIKE ANY (${PATTERNS_ARRAY_SQL});`
    ) as Array<{ total: string | number }>;
    logger.info(`[migrate-evidences] Filas con texto genérico antes: ${antes[0]?.total ?? 0}`);

    // 3. Actualización idempotente: solo filas que aún tengan el texto genérico
    await client.query(
      `UPDATE programs_catalog SET evidences = '[]'::jsonb WHERE evidences::text ILIKE ANY (${PATTERNS_ARRAY_SQL});`
    );

    // 4. Verificar filas restantes con texto genérico
    const despues = await client.query(
      `SELECT COUNT(*) AS total FROM programs_catalog WHERE evidences::text ILIKE ANY (${PATTERNS_ARRAY_SQL});`
    ) as Array<{ total: string | number }>;
    logger.info(`[migrate-evidences] Filas con texto genérico después: ${despues[0]?.total ?? 0}`);

    await client.query('COMMIT');
    logger.info('[migrate-evidences] Migración UP completada');
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('[migrate-evidences] Error en migración UP, transacción revertida', err);
    throw err;
  }
}

async function down(): Promise<void> {
  const client = sql() as unknown as QueryClient;
  logger.info('[migrate-evidences] Iniciando migración DOWN (rollback)');

  await client.query('BEGIN');
  try {
    // Verificar que exista la tabla de backup más reciente
    const backups = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name LIKE 'programs_catalog_evidences_backup_%'
      ORDER BY table_name DESC
      LIMIT 1;
    `) as Array<{ table_name: string }>;

    if (!backups || backups.length === 0) {
      logger.error(`[migrate-evidences] No se encontró ninguna tabla de backup. Abortando rollback.`);
      await client.query('ROLLBACK');
      process.exit(1);
    }

    const latestBackup = backups[0].table_name;
    const latestBackupEscaped = `"${latestBackup}"`;
    logger.info(`[migrate-evidences] Restaurando desde backup: ${latestBackup}`);

    // Restaurar evidences desde el backup
    await client.query(
      `UPDATE programs_catalog AS pc SET evidences = b.evidences FROM ${latestBackupEscaped} AS b WHERE pc.id = b.id;`
    );
    logger.info('[migrate-evidences] evidences restaurado desde backup');

    // Opcional: dropear tabla de backup tras restaurar
    await client.query(`DROP TABLE IF EXISTS ${latestBackupEscaped};`);
    logger.info(`[migrate-evidences] Tabla de backup ${latestBackup} eliminada`);

    await client.query('COMMIT');
    logger.info('[migrate-evidences] Migración DOWN completada');
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('[migrate-evidences] Error en migración DOWN, transacción revertida', err);
    throw err;
  }
}

async function main(): Promise<void> {
  const modo = process.argv[2];
  if (modo === 'up') {
    await up();
  } else if (modo === 'down') {
    await down();
  } else {
    logger.error('Uso: npx tsx scripts/migrate-paec-evidences-cleanup.ts [up|down]');
    process.exit(1);
  }
}

main().catch((err) => {
  logger.error('[migrate-evidences] Error inesperado', err);
  process.exit(1);
});
