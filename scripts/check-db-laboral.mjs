import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env.local');
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

async function main() {
  const count = await sql`SELECT count(*) FROM programs_catalog WHERE component = 'laboral'`;
  console.log('Total laboral rows in DB:', count[0].count);

  const distinctSpecs = await sql`SELECT DISTINCT curriculum_name FROM programs_catalog WHERE component = 'laboral' ORDER BY curriculum_name`;
  console.log('Distinct curriculums:', distinctSpecs.map(s => s.curriculum_name));

  const sample = await sql`
    SELECT id, curriculum_name, semester, uac_name, activities, learning_outcome 
    FROM programs_catalog 
    WHERE component = 'laboral' 
    LIMIT 3
  `;
  console.log('Sample rows:');
  console.log(JSON.stringify(sample, null, 2));
}

main().catch(console.error);
