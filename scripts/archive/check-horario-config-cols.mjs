import fs from 'fs';
import { neon } from '@neondatabase/serverless';

const envText = fs.readFileSync('.env.local', 'utf8');
const m = envText.match(/DATABASE_URL=([^\r\n]+)/);
const dbUrl = m[1].trim().replace(/['"]/g, '');
const sql = neon(dbUrl);

async function main() {
  const cols = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'horario_config'
  `;
  console.log('horario_config columns:', cols.map(c => c.column_name));
}

main().catch(console.error);
