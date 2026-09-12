import { readFileSync } from 'fs';
import { neon } from '@neondatabase/serverless';

const envContent = readFileSync('.env.local', 'utf-8');
const match = envContent.match(/DATABASE_URL=['"]?([^'"\r\n]+)['"]?/);
const sql = neon(match[1]);

const progs = await sql`
  SELECT id, uac_name, semester, curriculum_name, component
  FROM programs_catalog 
  WHERE component = 'laboral' 
  ORDER BY semester, uac_name
`;

console.log('Total laboral programs:', progs.length);
const bySem = {};
for (const p of progs) {
  bySem[p.semester] = (bySem[p.semester] || 0) + 1;
}
console.log('Counts by semester:', bySem);

for (const sem of [3, 4, 5, 6]) {
  console.log(`\n=== SEMESTRE ${sem} ===`);
  const sProgs = progs.filter(p => p.semester === sem);
  sProgs.forEach((p, i) => console.log(`${i+1}. ${p.uac_name}`));
}
