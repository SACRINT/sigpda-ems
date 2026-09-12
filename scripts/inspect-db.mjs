import { readFileSync } from 'fs';
import { neon } from '@neondatabase/serverless';

const envContent = readFileSync('.env.local', 'utf-8');
const match = envContent.match(/DATABASE_URL=['"]?([^'"\r\n]+)['"]?/);
const sql = neon(match[1]);

async function check() {
  const res = await sql`
    SELECT id, uac_name, semester, subsystem, component, learning_outcome, activities, contenidos_formativos 
    FROM programs_catalog 
    WHERE uac_name ILIKE '%pensamiento matem%tico%III%'
  `;
  console.log('Resultados encontrados:', res.length);
  for (const r of res) {
    console.log(`\nID: ${r.id} | Subsystem: ${r.subsystem} | Sem: ${r.semester} | Name: ${r.uac_name}`);
    console.log('Outcome:', r.learning_outcome);
    console.log('Activities:', JSON.stringify(r.activities, null, 2));
    console.log('Contenidos Formativos:', JSON.stringify(r.contenidos_formativos, null, 2));
  }
}

check().catch(console.error);
