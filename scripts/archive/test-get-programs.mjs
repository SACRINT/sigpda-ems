import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^\s*([^#=]+)\s*=\s*(.*)$/);
    if (m) {
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[m[1].trim()] = val;
    }
  });
}

const sql = neon(process.env.DATABASE_URL);

async function getProgramsCatalog(semester, component, subsystem) {
  const normalizedSubsystem = (subsystem && subsystem !== 'all' && subsystem !== 'todos') ? subsystem.toLowerCase() : null;
  const normalizedComponent = (component && component !== 'all' && component !== 'todos') ? component : null;
  const sem = (semester !== undefined && !isNaN(semester)) ? semester : null;

  return sql`
    SELECT id, uac_name, semester, component, curriculum_name, year, total_hours, 
           learning_outcome, activities, evidences, contenidos_formativos, subsystem, model_type, created_at
    FROM programs_catalog
    WHERE (${sem}::int IS NULL OR semester = ${sem})
      AND (${normalizedComponent}::text IS NULL OR component = ${normalizedComponent})
      AND (${normalizedSubsystem}::text IS NULL OR subsystem = ${normalizedSubsystem} OR subsystem = 'all' OR subsystem IS NULL)
    ORDER BY semester ASC, component ASC, uac_name ASC
  `;
}

async function run() {
  console.log('\n--- Test 1: No filters (todos) ---');
  const r1 = await getProgramsCatalog();
  console.log(`Results count: ${r1.length}`);
  console.log('Sample 1:', r1[0].uac_name, '| Sem:', r1[0].semester, '| Sub:', r1[0].subsystem);

  console.log('\n--- Test 2: Subsystem bge, Semester 1, Component fundamental ---');
  const r2 = await getProgramsCatalog(1, 'fundamental', 'bge');
  console.log(`Results count: ${r2.length}`);
  r2.forEach(p => console.log(`  - ${p.uac_name} (${p.total_hours} hrs)`));

  console.log('\n--- Test 3: Subsystem cbtis, Semester 1, Component fundamental ---');
  const r3 = await getProgramsCatalog(1, 'fundamental', 'cbtis');
  console.log(`Results count: ${r3.length}`);
  r3.forEach(p => console.log(`  - ${p.uac_name} (${p.total_hours} hrs)`));
}

run().catch(console.error);
