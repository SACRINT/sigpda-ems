import { neon } from '@neondatabase/serverless';
import fs from 'fs';

let dbUrl = process.env.DATABASE_URL;
if (!dbUrl && fs.existsSync('.env.local')) {
  const envContent = fs.readFileSync('.env.local', 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('DATABASE_URL=')) {
      dbUrl = trimmed.replace('DATABASE_URL=', '').replace(/["']/g, '');
      break;
    }
  }
}

const sql = neon(dbUrl);

async function migrateTeachers() {
  console.log('🚀 Aplicando migración de autenticación a la tabla teachers...');
  
  await sql`
    ALTER TABLE teachers 
    ADD COLUMN IF NOT EXISTS password_hash TEXT,
    ADD COLUMN IF NOT EXISTS reset_token TEXT,
    ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ;
  `;
  
  const cols = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'teachers' AND column_name IN ('password_hash', 'reset_token', 'reset_token_expires');
  `;
  
  console.log('✅ Columnas de autenticación verificadas:');
  console.table(cols);
}

migrateTeachers().catch(err => {
  console.error('❌ Error en migración:', err);
  process.exit(1);
});
