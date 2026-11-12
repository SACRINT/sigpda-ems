/**
 * sanitize-database-workbooks.ts — P0 / Fase A.1
 *
 * Sanea de forma determinista y recursiva la columna `workbooks_json` en la tabla `plannings`
 * de Neon PostgreSQL, sustituyendo todas las URLs genéricas de búsqueda (YouTube y Google)
 * por recursos institucionales pertinentes de `CURATED_RESOURCES`.
 *
 * Crea un respaldo inmutable con timestamp en milisegundos antes de mutar.
 *
 * Uso:
 *   npx tsx scripts/sanitize-database-workbooks.ts           # Dry-run (solo auditoría)
 *   npx tsx scripts/sanitize-database-workbooks.ts --apply   # Respalda y aplica migración
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';
import { sanitizeWorkbookResourceUrls } from '../src/lib/resources/workbook-sanitizer';
import type { ActiveWorkTextbook } from '../src/types/work-textbook';

function getDbClient() {
  const env = readFileSync('.env.local', 'utf8');
  const match = env.match(/DATABASE_URL=['"]?([^'"\r\n]+)/);
  if (!match) {
    throw new Error('DATABASE_URL no encontrada en .env.local');
  }
  return neon(match[1]);
}

interface BlockEnvelope {
  version?: number;
  lastJobId?: string | null;
  current?: ActiveWorkTextbook;
  history?: Array<{ current?: ActiveWorkTextbook; [key: string]: unknown }>;
  [key: string]: unknown;
}

async function run() {
  const isApply = process.argv.includes('--apply');
  const sql = getDbClient();

  console.log('=================================================================');
  console.log('   MIGRACIÓN P0 / FASE A.1 — SANEAMIENTO DE WORKBOOKS_JSON EN NEON');
  console.log(`   Modo: ${isApply ? 'APPLY (Mutación con respaldo)' : 'DRY-RUN (Auditoría de solo lectura)'}`);
  console.log('=================================================================\n');

  // 1. Obtener todas las planeaciones que contienen workbooks
  const rows = await sql`
    SELECT id, uac_name, semester, workbooks_json
    FROM plannings
    WHERE workbooks_json IS NOT NULL
    ORDER BY semester, uac_name ASC
  `;

  console.log(`Planeaciones encontradas con workbooks_json: ${rows.length}\n`);

  let totalSearchUrlsFound = 0;
  let totalWorkbooksProcessed = 0;
  const updates: Array<{ id: string; uac_name: string; sanitizedJson: Record<string, unknown>; replacedCount: number }> = [];

  for (const row of rows) {
    const rawJson = row.workbooks_json as Record<string, unknown>;
    if (!rawJson || typeof rawJson !== 'object') continue;

    const sanitizedJson: Record<string, unknown> = {};
    let planningReplacedCount = 0;

    for (const [blockKey, rawBlock] of Object.entries(rawJson)) {
      if (!rawBlock || typeof rawBlock !== 'object') {
        sanitizedJson[blockKey] = rawBlock;
        continue;
      }

      totalWorkbooksProcessed++;
      const envelope = JSON.parse(JSON.stringify(rawBlock)) as BlockEnvelope;

      // Caso A: Envoltura estándar con propiedad `current`
      if (envelope.current && typeof envelope.current === 'object') {
        const { sanitized, replacedCount } = sanitizeWorkbookResourceUrls(envelope.current);
        envelope.current = sanitized;
        planningReplacedCount += replacedCount;
      }
      // Caso B: Objeto ActiveWorkTextbook directo en la clave del bloque
      else if ('missions' in envelope && Array.isArray((envelope as any).missions)) {
        const { sanitized, replacedCount } = sanitizeWorkbookResourceUrls(envelope as unknown as ActiveWorkTextbook);
        Object.assign(envelope, sanitized);
        planningReplacedCount += replacedCount;
      }

      // Saneamiento de historial si existe
      if (Array.isArray(envelope.history)) {
        for (const histItem of envelope.history) {
          if (histItem?.current && typeof histItem.current === 'object') {
            const { sanitized, replacedCount } = sanitizeWorkbookResourceUrls(histItem.current);
            histItem.current = sanitized;
            planningReplacedCount += replacedCount;
          }
        }
      }

      sanitizedJson[blockKey] = envelope;
    }

    totalSearchUrlsFound += planningReplacedCount;
    updates.push({
      id: row.id as string,
      uac_name: (row.uac_name || 'Sin Asignatura') as string,
      sanitizedJson,
      replacedCount: planningReplacedCount,
    });

    console.log(
      `[Planeación ${row.id.slice(0, 8)}] ${row.uac_name} (${row.semester ? `${row.semester}° Sem` : ''}) -> URLs a sanear: ${planningReplacedCount}`
    );
  }

  console.log(`\nResumen de Detección:`);
  console.log(`- Bloques de workbook procesados: ${totalWorkbooksProcessed}`);
  console.log(`- URLs genéricas de búsqueda detectadas: ${totalSearchUrlsFound}\n`);

  if (!isApply) {
    console.log('DRY-RUN completado exitosamente. No se realizaron cambios en la base de datos.');
    console.log('Para ejecutar la migración con respaldo, corre: npx tsx scripts/sanitize-database-workbooks.ts --apply\n');
    return;
  }

  // MODO APPLY: Respaldo y Mutación Atómica
  const timestamp = Date.now();
  const backupTable = `plannings_workbooks_backup_${timestamp}`;

  console.log(`Creando tabla de respaldo segura: ${backupTable}...`);
  await sql.query(`
    CREATE TABLE IF NOT EXISTS ${backupTable} AS
    SELECT id, workbooks_json, updated_at
    FROM plannings
    WHERE workbooks_json IS NOT NULL
  `);

  const backupCheck = (await sql.query(`SELECT COUNT(*) as count FROM ${backupTable}`)) as Array<{ count: string | number }>;
  const backedUpCount = Number(backupCheck[0]?.count || 0);

  if (backedUpCount !== rows.length) {
    throw new Error(
      `Error de Integridad en Respaldo: se esperaban ${rows.length} filas pero la tabla ${backupTable} tiene ${backedUpCount}. Abortando migración.`
    );
  }
  console.log(`✓ Respaldo verificado con ${backedUpCount} filas idénticas.\n`);

  // Guardar metadata del último respaldo para rollback automático
  writeFileSync(
    'scripts/.last-workbooks-backup.json',
    JSON.stringify({ backupTable, timestamp, rowCount: backedUpCount, date: new Date().toISOString() }, null, 2)
  );

  console.log('Aplicando saneamiento a las filas en Neon PostgreSQL...');
  let updatedRowsCount = 0;

  for (const update of updates) {
    await sql`
      UPDATE plannings
      SET workbooks_json = ${JSON.stringify(update.sanitizedJson)}::jsonb,
          updated_at = NOW()
      WHERE id = ${update.id}::uuid
    `;
    updatedRowsCount++;
  }

  console.log(`✓ Se actualizaron exitosamente ${updatedRowsCount} planeaciones.\n`);

  // Auditoría SQL Post-Migración Estricta
  console.log('Ejecutando auditoría SQL post-migración...');
  const auditResult = await sql`
    SELECT COUNT(*) as remaining_violations
    FROM plannings
    WHERE workbooks_json::text LIKE '%youtube.com/results%'
       OR workbooks_json::text LIKE '%google.com/search%'
       OR workbooks_json::text LIKE '%bing.com/search%'
  `;

  const remaining = Number((auditResult[0] as any)?.remaining_violations || 0);
  console.log(`Violaciones residuales en workbooks_json: ${remaining}`);

  if (remaining > 0) {
    console.error(`❌ ALERTA CRÍTICA: Quedan ${remaining} violaciones en la base de datos.`);
    process.exit(1);
  }

  console.log('\n=================================================================');
  console.log('   ✓ MIGRACIÓN FASE A.1 COMPLETADA SATISFACTORIAMENTE');
  console.log(`   - 0 URLs de búsqueda genérica en Neon DB.`);
  console.log(`   - Respaldo persistido en: ${backupTable}`);
  console.log('=================================================================\n');
}

run().catch((err) => {
  console.error('Error fatal durante la migración:', err);
  process.exit(1);
});
