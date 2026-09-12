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

async function main() {
  const teacherCols = await sql`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'teachers'
    ORDER BY ordinal_position;
  `;
  console.log('--- Columnas de teachers ---');
  console.table(teacherCols);

  const tables = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name;
  `;
  console.log('--- Tablas en Neon DB ---');
  console.log(tables.map(t => t.table_name));

  const pipsCols = await sql`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'pips_projects'
    ORDER BY ordinal_position;
  `;
  console.log('--- Columnas de pips_projects ---');
  console.table(pipsCols);

  const subCols = await sql`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'subscriptions'
    ORDER BY ordinal_position;
  `;
  console.log('--- Columnas de subscriptions ---');
  console.table(subCols);
}

main().catch(console.error);
