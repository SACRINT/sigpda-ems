import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { neon } from '@neondatabase/serverless';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, '../.env.local');
let dbUrl = '';
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^\s*DATABASE_URL\s*=\s*(.*)$/);
    if (m) {
      let val = m[1].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      dbUrl = val;
    }
  });
}

const sql = neon(dbUrl);

async function main() {
  const rows = await sql`
    SELECT id, uac_name, semester, component, subsystem, model_type, activities, contenidos_formativos 
    FROM programs_catalog 
    ORDER BY semester, component, uac_name
  `;

  const summary = {};

  rows.forEach(r => {
    const acts = r.activities || [];
    const cfs = r.contenidos_formativos || [];
    const actsStr = JSON.stringify(acts);
    
    const isPlaceholder = 
      actsStr.includes('Analizar y aplicar los conceptos formativos') || 
      actsStr.includes('Propósito Formativo 1: ') ||
      actsStr.includes('Desarrollar los fundamentos y aplicaciones prácticas') ||
      actsStr.includes('Comprender y dominar los contenidos formativos') ||
      actsStr.includes('Progresión 1: Comprender') ||
      (cfs.length === 0 && r.component !== 'laboral');

    const key = `Sem ${r.semester} - ${r.component} - ${r.subsystem}`;
    if (!summary[key]) summary[key] = { total: 0, authentic: 0, placeholder: 0, names: [] };
    summary[key].total++;
    if (isPlaceholder) {
      summary[key].placeholder++;
      if (summary[key].names.length < 3) summary[key].names.push(r.uac_name);
    } else {
      summary[key].authentic++;
    }
  });

  console.log('Breakdown by Semester, Component and Subsystem:');
  console.table(Object.entries(summary).map(([k, v]) => ({
    group: k,
    total: v.total,
    authentic: v.authentic,
    placeholder: v.placeholder,
    samplePlaceholders: v.names.join(', ')
  })));
}

main().catch(console.error);
