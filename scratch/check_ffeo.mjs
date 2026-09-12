import { readFileSync } from 'fs';
import { neon } from '@neondatabase/serverless';

const envContent = readFileSync('.env.local', 'utf-8');
const match = envContent.match(/DATABASE_URL=['"]?([^'"\r\n]+)['"]?/);
const sql = neon(match[1]);

async function check() {
  const rows = await sql`
    SELECT uac_name, semester, component, total_hours 
    FROM programs_catalog 
    WHERE component IN ('ffeo', 'socioemocional')
    ORDER BY semester, uac_name;
  `;
  console.log(`Total FFEO + Socioemocionales en DB: ${rows.length}`);
  for (const r of rows) {
    console.log(`  - [${r.component}] Sem ${r.semester}: ${r.uac_name} (${r.total_hours}h)`);
  }
}

check().catch(console.error);
