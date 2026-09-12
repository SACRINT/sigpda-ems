import { readFileSync } from 'fs';
import { neon } from '@neondatabase/serverless';

const envContent = readFileSync('.env.local', 'utf-8');
const match = envContent.match(/DATABASE_URL=['"]?([^'"\r\n]+)['"]?/);
if (!match) {
  console.error('DATABASE_URL no encontrada en .env.local');
  process.exit(1);
}
const sql = neon(match[1]);

async function runBackup() {
  console.log('--- INICIANDO RESPALDO DE programs_catalog ---');
  
  // 1. Obtener conteo original
  const origCountRes = await sql`SELECT count(*) as count FROM programs_catalog`;
  const originalCount = Number(origCountRes[0].count);
  console.log(`Registros actuales en programs_catalog: ${originalCount}`);

  // 2. Si ya existe la tabla backup, verificar si tiene registros o si la recreamos
  const tableCheck = await sql`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'programs_catalog_backup'
    ) as exists;
  `;
  
  if (tableCheck[0].exists) {
    const existingBackupCount = await sql`SELECT count(*) as count FROM programs_catalog_backup`;
    console.log(`Tabla programs_catalog_backup ya existía con ${existingBackupCount[0].count} registros.`);
    // Hacemos drop para asegurar snapshot fresco antes de la purga
    await sql`DROP TABLE programs_catalog_backup`;
    console.log('Tabla programs_catalog_backup anterior eliminada para crear un snapshot fresco.');
  }

  // 3. Crear backup completo
  console.log('Creando tabla programs_catalog_backup...');
  await sql`CREATE TABLE programs_catalog_backup AS SELECT * FROM programs_catalog`;

  // 4. Verificar integridad
  const backupCountRes = await sql`SELECT count(*) as count FROM programs_catalog_backup`;
  const backupCount = Number(backupCountRes[0].count);
  console.log(`Registros en programs_catalog_backup: ${backupCount}`);

  if (originalCount === backupCount) {
    console.log(`✅ RESPALDO EXITOSO: Los registros coinciden exactamente (${originalCount} = ${backupCount}).`);
  } else {
    console.error(`❌ ERROR CRÍTICO: Discrepancia en el respaldo (${originalCount} vs ${backupCount}). ABORTANDO.`);
    process.exit(1);
  }
}

runBackup().catch(err => {
  console.error('Error al ejecutar respaldo:', err);
  process.exit(1);
});
