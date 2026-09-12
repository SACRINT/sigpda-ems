const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');

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

async function check() {
  const count = await sql`SELECT count(*) FROM programs_catalog`;
  console.log('Total en programs_catalog:', count[0].count);

  const subsystems = await sql`SELECT subsystem, count(*) FROM programs_catalog GROUP BY subsystem`;
  console.log('Por subsistema:', subsystems);

  const sample = await sql`SELECT id, uac_name, semester, component, subsystem, model_type, total_hours, learning_outcome, activities, contenidos_formativos FROM programs_catalog LIMIT 3`;
  console.log('Sample records:\n', JSON.stringify(sample, null, 2));
}

check().catch(console.error);
