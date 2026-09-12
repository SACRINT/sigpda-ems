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

async function checkLaboralActivities() {
  const items = await sql`
    SELECT id, uac_name, semester, component, total_hours, activities, contenidos_formativos, model_type
    FROM programs_catalog
    WHERE component = 'laboral' OR uac_name ILIKE '%huerto%'
  `;
  console.log(`Total encontrados: ${items.length}`);
  for (const it of items) {
    const acts = Array.isArray(it.activities) ? it.activities : [];
    if (acts.length !== 3 || acts.some(a => a.name?.toLowerCase().includes('propósito') || a.name?.toLowerCase().includes('progresión'))) {
      console.log(`[ID ${it.id}] ${it.uac_name} (Sem ${it.semester}): ${acts.length} acts -> ${acts.map(a => a.name).join(' | ')}`);
    }
  }
}

checkLaboralActivities().catch(console.error);
