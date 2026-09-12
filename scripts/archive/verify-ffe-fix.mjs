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

async function verify() {
  // Programs from the screenshots
  const screenPrograms = [
    'Arte y Cultura I',
    'Comunicación y Sociedad I',
    'Derecho y Sociedad I',
    'Dibujo Técnico I'
  ];
  
  console.log('🔍 Verifying programs from screenshots:');
  for (const name of screenPrograms) {
    const rows = await sql`SELECT uac_name, component, semester, subsystem FROM programs_catalog WHERE uac_name = ${name}`;
    for (const r of rows) {
      const status = r.component === 'ext_optativo' ? '✅' : '❌';
      console.log(`  ${status} ${r.uac_name} -> component="${r.component}" (Sem ${r.semester}, ${r.subsystem})`);
    }
  }
  
  // Check ext_optativo programs in 5th semester for bge
  console.log('\n📋 Formación Extendida Optativa programs in 5° semestre (bge):');
  const extOpt5 = await sql`
    SELECT uac_name, semester, subsystem 
    FROM programs_catalog 
    WHERE component = 'ext_optativo' AND semester = 5 AND subsystem = 'bge'
    ORDER BY uac_name
  `;
  console.log(`  Found ${extOpt5.length} programs:`);
  for (const r of extOpt5) {
    console.log(`    - ${r.uac_name}`);
  }
  
  // Check ext_obligatorio (FFEO) programs
  console.log('\n📋 FFEO (ext_obligatorio) programs:');
  const ffeo = await sql`
    SELECT uac_name, semester, subsystem 
    FROM programs_catalog 
    WHERE component = 'ext_obligatorio'
    ORDER BY semester, uac_name
  `;
  console.log(`  Found ${ffeo.length} programs:`);
  for (const r of ffeo) {
    console.log(`    - ${r.uac_name} (Sem ${r.semester}, ${r.subsystem})`);
  }
  
  // Final component summary
  console.log('\n📊 Final component distribution:');
  const dist = await sql`SELECT component, COUNT(*) as count FROM programs_catalog GROUP BY component ORDER BY count DESC`;
  for (const r of dist) {
    console.log(`  ${r.component}: ${r.count}`);
  }
}

verify().catch(console.error);