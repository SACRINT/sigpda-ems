import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { neon } from '@neondatabase/serverless';

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

async function debug() {
  // Check exact component values
  const all = await sql`SELECT DISTINCT component FROM programs_catalog ORDER BY component`;
  console.log('All distinct components:');
  for (const r of all) {
    console.log(`  "${r.component}"`);
  }
  
  // Check ffe_optativa records
  const ffeOpt = await sql`SELECT id, uac_name, component, semester, subsystem FROM programs_catalog WHERE component = 'ffe_optativa' LIMIT 5`;
  console.log(`\nffe_optativa records (${ffeOpt.length} shown):`);
  for (const r of ffeOpt) {
    console.log(`  id=${r.id} name="${r.uac_name}" comp="${r.component}" sem=${r.semester} sub="${r.subsystem}"`);
  }

  // Try direct update on one
  if (ffeOpt.length > 0) {
    const testId = ffeOpt[0].id;
    console.log(`\nTrying to update id=${testId}...`);
    const res = await sql`UPDATE programs_catalog SET component = 'ext_optativo' WHERE id = ${testId} RETURNING id, uac_name, component`;
    console.log('Result:', res);
  }

  // Now update ALL remaining
  console.log('\nUpdating all ffe_optativa to ext_optativo...');
  const res2 = await sql`UPDATE programs_catalog SET component = 'ext_optativo' WHERE component = 'ffe_optativa' RETURNING id, uac_name, component`;
  console.log(`Updated ${res2.length} rows`);

  // Final check
  const final = await sql`SELECT DISTINCT component, COUNT(*) as cnt FROM programs_catalog GROUP BY component ORDER BY component`;
  console.log('\nFinal distribution:');
  for (const r of final) {
    console.log(`  ${r.component}: ${r.cnt}`);
  }
}

debug().catch(console.error);