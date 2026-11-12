import { neon } from '@neondatabase/serverless';
import { loadEnvLocal } from './lib/load-env';

loadEnvLocal();

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is missing');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

async function main() {
  console.log('🔧 Aplicando migración uac_slugs en knowledge_pages...');
  await sql`ALTER TABLE knowledge_pages ADD COLUMN IF NOT EXISTS uac_slugs TEXT[] DEFAULT '{}'`;
  await sql`CREATE INDEX IF NOT EXISTS idx_kp_uac_slugs ON knowledge_pages USING GIN(uac_slugs)`;

  const cols = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'knowledge_pages'
    ORDER BY ordinal_position
  `;
  console.log('✅ Columnas en knowledge_pages:', cols.map((c: any) => `${c.column_name} (${c.data_type})`));
}

main().catch((err) => {
  console.error('❌ Error en migración:', err);
  process.exit(1);
});
