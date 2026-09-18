// scripts/apply-cartografia-schema.mjs
// Aplica las columnas JSONB requeridas para la Cartografía de Zona en pips_projects
import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';

if (!process.env.DATABASE_URL) {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        let val = (match[2] || '').trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        process.env[match[1]] = val;
      }
    }
  }
}

if (!process.env.DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL no encontrada en las variables de entorno ni en .env.local');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

async function run() {
  console.log('--- Aplicando migración de esquema para Cartografía de Zona (Fase 8) ---');
  try {
    await sql`ALTER TABLE pips_projects ADD COLUMN IF NOT EXISTS momento3_ubicar jsonb;`;
    console.log('  ✓ Columna momento3_ubicar (jsonb) agregada/verificada');

    await sql`ALTER TABLE pips_projects ADD COLUMN IF NOT EXISTS momento4_analizar jsonb;`;
    console.log('  ✓ Columna momento4_analizar (jsonb) agregada/verificada');

    await sql`ALTER TABLE pips_projects ADD COLUMN IF NOT EXISTS momento5_decidir jsonb;`;
    console.log('  ✓ Columna momento5_decidir (jsonb) agregada/verificada');

    await sql`ALTER TABLE pips_projects ADD COLUMN IF NOT EXISTS memoria_pedagogica jsonb;`;
    console.log('  ✓ Columna memoria_pedagogica (jsonb) agregada/verificada');

    console.log('✅ Migración de esquema completada exitosamente.');
  } catch (err) {
    console.error('❌ Error ejecutando migración de esquema:', err);
    process.exit(1);
  }
}

run();
