import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { neon } from '@neondatabase/serverless';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env.local manually
const envLocalPath = path.resolve(__dirname, '../.env.local');
let DB_URL;
if (fs.existsSync(envLocalPath)) {
  const envText = fs.readFileSync(envLocalPath, 'utf-8');
  envText.split('\n').forEach(line => {
    const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)$/);
    if (match) {
      const key = match[1].trim();
      let val = match[2].trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
      if (key === 'DATABASE_URL') DB_URL = val;
    }
  });
}

if (!DB_URL) {
  console.error('DATABASE_URL not found');
  process.exit(1);
}

const sql = neon(DB_URL);

async function check() {
  const rows = await sql`
    SELECT uac_name, component, semester, total_hours, jsonb_array_length(activities) as act_count, activities
    FROM programs_catalog
    WHERE component IN ('fundamental', 'ampliado')
    LIMIT 20
  `;
  
  console.log(`UAC Name | Component | Semester | Hours | Activities Count`);
  console.log(`----------------------------------------------------------`);
  for (const r of rows) {
    console.log(`${r.uac_name} | ${r.component} | ${r.semester} | ${r.total_hours} | ${r.act_count}`);
    console.log(`  First activity: ${JSON.stringify(r.activities[0])}`);
  }
}

check().catch(console.error);
