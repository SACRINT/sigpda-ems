import { readFileSync } from 'fs';
import { neon } from '@neondatabase/serverless';

const envContent = readFileSync('.env.local', 'utf-8');
const match = envContent.match(/DATABASE_URL=['"]?([^'"\r\n]+)['"]?/);
const sql = neon(match[1]);

async function run() {
  const rows = await sql`
    SELECT id, curriculum_name, semester, uac_name, activities, learning_outcome
    FROM programs_catalog 
    WHERE curriculum_name = 'Instalaciones Residenciales'
    ORDER BY semester, uac_name
  `;
  console.log('Instalaciones Residenciales in DB:');
  for (const r of rows) {
    console.log(`\nSem ${r.semester} - ${r.uac_name}`);
    console.log('Outcome:', r.learning_outcome);
    console.log('Activities:', JSON.stringify(r.activities, null, 2));
  }
}

run().catch(console.error);
