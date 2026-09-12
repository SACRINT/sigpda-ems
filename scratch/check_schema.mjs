import { readFileSync } from 'fs';
import { neon } from '@neondatabase/serverless';

const envContent = readFileSync('.env.local', 'utf-8');
const match = envContent.match(/DATABASE_URL=['"]?([^'"\r\n]+)['"]?/);
const sql = neon(match[1]);

async function check() {
  const cols = await sql`
    SELECT column_name, is_nullable, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'programs_catalog';
  `;
  for (const c of cols) {
    console.log(`${c.column_name}: ${c.data_type} (nullable: ${c.is_nullable})`);
  }
}

check().catch(console.error);
