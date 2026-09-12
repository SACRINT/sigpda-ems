import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dir = dirname(__filename);

const envContent = readFileSync(join(__dir, '../.env.local'), 'utf-8');
const match = envContent.match(/DATABASE_URL=['"']?([^'"'\r\n]+)['"']?/);
if (!match) throw new Error('DATABASE_URL not found in .env.local');
const sql = neon(match[1]);

const rows = await sql`
  SELECT 
    curriculum_name,
    COUNT(*) as total_uacs,
    COUNT(CASE WHEN activities IS NOT NULL AND jsonb_array_length(activities) = 3 THEN 1 END) as uacs_ok,
    COUNT(CASE WHEN activities IS NULL OR jsonb_array_length(activities) != 3 THEN 1 END) as uacs_sin
  FROM programs_catalog 
  WHERE component = 'laboral'
  GROUP BY curriculum_name
  ORDER BY curriculum_name
`;

console.log('\n=== AUDITORÍA BD — Actividades Clave BGE ===\n');
let totalOk = 0;
let totalUACs = 0;
rows.forEach(r => {
  const ok = parseInt(r.uacs_ok);
  const total = parseInt(r.total_uacs);
  const status = ok === total ? 'OK' : `FALTA ${total - ok}`;
  console.log(`  ${String(r.curriculum_name).padEnd(40)} ${ok}/${total}  [${status}]`);
  totalOk += ok;
  totalUACs += total;
});
console.log(`\n  ${'TOTAL'.padEnd(40)} ${totalOk}/${totalUACs}`);

// Verify specific case: Instalaciones Residenciales sem3 uac1
const sample = await sql`
  SELECT uac_name, semester, activities
  FROM programs_catalog
  WHERE curriculum_name = 'Instalaciones Residenciales'
    AND component = 'laboral'
    AND semester = 3
  ORDER BY id
  LIMIT 2
`;
console.log('\n=== VERIFICACIÓN: Instalaciones Residenciales Sem 3 ===');
sample.forEach(r => {
  console.log(`\n  UAC: ${r.uac_name} (Sem ${r.semester})`);
  if (r.activities) {
    r.activities.forEach((a, i) => {
      console.log(`    Act ${i+1}: ${a.name}`);
    });
  }
});

process.exit(0);
