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

async function inspectAndFix() {
  console.log('--- Analizando catálogo actual ---');
  
  // 1. Check Laborales
  const laborales = await sql`
    SELECT id, uac_name, semester, component, activities, contenidos_formativos, model_type
    FROM programs_catalog
    WHERE component = 'laboral'
  `;
  console.log(`Total UACs Laborales: ${laborales.length}`);
  if (laborales.length > 0) {
    console.log('Sample Laboral:', laborales[0].uac_name);
    console.log('Activities count:', laborales[0].activities?.length);
    console.log('Activities:', JSON.stringify(laborales[0].activities));
  }

  // 2. Check Ampliado / Socioemocional
  const ampliados = await sql`
    SELECT id, uac_name, semester, component
    FROM programs_catalog
    WHERE uac_name ILIKE '%socioemocional%' 
       OR uac_name ILIKE '%artística%' 
       OR uac_name ILIKE '%deportiva%'
       OR uac_name ILIKE '%salud%'
       OR uac_name ILIKE '%sexualidad%'
       OR uac_name ILIKE '%ciudadana%'
  `;
  console.log(`\nTotal UACs Ampliado/Socioemocional encontradas: ${ampliados.length}`);
  ampliados.forEach(a => console.log(`- ${a.uac_name} (Sem ${a.semester}, Comp: ${a.component})`));
}

inspectAndFix().catch(console.error);
