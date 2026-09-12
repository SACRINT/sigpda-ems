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

async function run() {
  console.log('=== 1. DISTRIBUTION OF COMPONENTS IN DB ===');
  const dist = await sql`
    SELECT component, COUNT(*) as total 
    FROM programs_catalog 
    GROUP BY component 
    ORDER BY total DESC
  `;
  console.table(dist);

  console.log('\n=== 2. VERIFICATION OF FFE OPTATIVAS ===');
  const ffe = await sql`
    SELECT uac_name, component, semester, subsystem 
    FROM programs_catalog 
    WHERE uac_name IN ('Arte y Cultura I', 'Comunicación y Sociedad I', 'Derecho y Sociedad I', 'Dibujo Técnico I', 'Análisis de Fenómenos y Procesos Biológicos')
  `;
  console.table(ffe);

  console.log('\n=== 3. EXT_OPTATIVO IN 5° SEMESTER ===');
  const sem5 = await sql`
    SELECT uac_name, component, semester, subsystem 
    FROM programs_catalog 
    WHERE component = 'ext_optativo' AND semester = 5
    ORDER BY uac_name
  `;
  console.log(`Total ext_optativo in 5° semester: ${sem5.length}`);
  console.table(sem5);

  console.log('\n=== 4. FFEO (ext_obligatorio / ffeo) ===');
  const ffeo = await sql`
    SELECT uac_name, component, semester, subsystem 
    FROM programs_catalog 
    WHERE component IN ('ext_obligatorio', 'ffeo')
    ORDER BY semester, uac_name
  `;
  console.log(`Total FFEO records: ${ffeo.length}`);
  console.table(ffeo);
}

run().catch(console.error);
