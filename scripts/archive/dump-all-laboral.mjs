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
for (const p of progs) {
  console.log(`SEM ${p.semester} | ${p.uac_name} | ${p.curriculum_name}`);
}
