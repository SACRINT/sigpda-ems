// dump-laboral-uacs.mjs — Lista TODOS los nombres de UAC del componente laboral en programs_catalog
import { readFileSync } from 'fs';
import { neon } from '@neondatabase/serverless';

const envContent = readFileSync('.env.local', 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const [k, ...v] = line.split('=');
  if (k?.trim()) env[k.trim()] = v.join('=').trim();
}
const sql = neon(env.DATABASE_URL || env.NEON_DATABASE_URL || env.POSTGRES_URL);

// First check the actual columns
const cols = await sql`
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'programs_catalog'
  ORDER BY ordinal_position
`;
console.log('Columns:', cols.map(c => c.column_name).join(', '), '\n');

const rows = await sql`
  SELECT uac_name, curriculum_name, semester
  FROM programs_catalog
  WHERE component = 'laboral'
  ORDER BY semester, uac_name
`;

console.log(`Total UACs laborales: ${rows.length}\n`);
for (const r of rows) {
  console.log(`SEM ${r.semester} | ${r.uac_name} | ${r.curriculum_name}`);
}
