import { readFileSync } from 'fs';
import { neon } from '@neondatabase/serverless';

const envContent = readFileSync('.env.local', 'utf-8');
const match = envContent.match(/DATABASE_URL=['"]?([^'"\r\n]+)['"]?/);
const sql = neon(match[1]);

async function check() {
  const cols = await sql`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'plannings'
    ORDER BY ordinal_position;
  `;
  console.log('Columns in plannings:', cols.map(c => c.column_name));

  const indexes = await sql`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'programs_catalog';
  `;
  console.log('Indexes:', indexes);

  const subCounts = await sql`
    SELECT subsystem, count(*) as count
    FROM programs_catalog
    GROUP BY subsystem
    ORDER BY count DESC;
  `;
  console.log('Subsystem counts:', subCounts);
}
check();
