/**
 * Migración: Agrega columna metodologia_activa a la tabla plannings
 * Ejecución: node scripts/migrate-add-metodologia.mjs
 */

import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar .env.local (mismo patrón que otros scripts del proyecto)
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^\s*([^#=]+)\s*=\s*(.*)$/);
    if (m) {
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[m[1].trim()] = val;
    }
  });
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL no encontrado en .env.local');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

console.log('🔄 Ejecutando migración: ADD COLUMN metodologia_activa...');

try {
  // ADD COLUMN IF NOT EXISTS es idempotente — seguro de re-ejecutar
  await sql`
    ALTER TABLE plannings
    ADD COLUMN IF NOT EXISTS metodologia_activa TEXT DEFAULT NULL
  `;

  console.log('✅ Columna metodologia_activa agregada correctamente (o ya existía).');

  // Verificar que la columna existe
  const cols = await sql`
    SELECT column_name, data_type, column_default, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'plannings'
      AND column_name = 'metodologia_activa'
  `;

  if (cols.length > 0) {
    console.log('📋 Columna verificada:', cols[0]);
  } else {
    console.warn('⚠️ No se encontró la columna en information_schema. Verifica manualmente.');
  }

  // Mostrar conteo para confirmar que las filas existentes no se rompieron
  const count = await sql`SELECT COUNT(*) as total FROM plannings`;
  console.log(`📊 Planeaciones existentes sin afectar: ${count[0].total}`);

  console.log('\n✅ Migración completada exitosamente.');
} catch (err) {
  console.error('❌ Error durante la migración:', err);
  process.exit(1);
}
