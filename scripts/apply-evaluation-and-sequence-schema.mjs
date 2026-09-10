import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../.env.local');
try {
  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) return;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  });
} catch (e) {
  console.error('Error reading .env.local:', e);
}

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL is not defined in .env.local');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

async function main() {
  console.log('🚀 Migrando plannings: agregando evaluation_json y sequence_json...');

  await sql`
    ALTER TABLE plannings 
    ADD COLUMN IF NOT EXISTS evaluation_json JSONB;
  `;
  console.log('✅ Columna evaluation_json asegurada en plannings');

  await sql`
    ALTER TABLE plannings 
    ADD COLUMN IF NOT EXISTS sequence_json JSONB;
  `;
  console.log('✅ Columna sequence_json asegurada en plannings');

  console.log('🎉 Migración completada exitosamente.');
}

main().catch(err => {
  console.error('❌ Error en migración:', err);
  process.exit(1);
});
