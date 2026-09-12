import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { neon } from '@neondatabase/serverless';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local
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

async function fixFFEComponent() {
  console.log('🔧 Starting FFE Component Fix Migration...\n');
  
  // 1. Show current state
  console.log('📊 Current component distribution:');
  const currentDist = await sql`
    SELECT component, COUNT(*) as count 
    FROM programs_catalog 
    GROUP BY component 
    ORDER BY count DESC
  `;
  console.table(currentDist);
  
  // 2. Check for mismatched components
  // UI expects: ext_optativo, ext_obligatorio
  // DB has: ffe_optativa, ffeo
  console.log('\n🔍 Checking for component mismatches...');
  
  const ffeOptativaCount = await sql`
    SELECT COUNT(*) as count FROM programs_catalog WHERE component = 'ffe_optativa'
  `;
  const ffeoCount = await sql`
    SELECT COUNT(*) as count FROM programs_catalog WHERE component = 'ffeo'
  `;
  const extOptativoCount = await sql`
    SELECT COUNT(*) as count FROM programs_catalog WHERE component = 'ext_optativo'
  `;
  const extObligatorioCount = await sql`
    SELECT COUNT(*) as count FROM programs_catalog WHERE component = 'ext_obligatorio'
  `;
  
  console.log(`  ffe_optativa: ${ffeOptativaCount[0]?.count || 0} (DB) vs ext_optativo: ${extOptativoCount[0]?.count || 0} (UI expects)`);
  console.log(`  ffeo: ${ffeoCount[0]?.count || 0} (DB) vs ext_obligatorio: ${extObligatorioCount[0]?.count || 0} (UI expects)`);
  
  // 3. Fix ffe_optativa -> ext_optativo
  if (ffeOptativaCount[0]?.count > 0) {
    console.log('\n🔄 Updating ffe_optativa -> ext_optativo...');
    const result1 = await sql`
      UPDATE programs_catalog
      SET component = 'ext_optativo'
      WHERE component = 'ffe_optativo'
      RETURNING id, uac_name, semester, subsystem
    `;
    console.log(`✅ Updated ${result1.length} programs from ffe_optativa to ext_optativo`);
  }
  
  // 4. Fix ffeo -> ext_obligatorio
  if (ffeoCount[0]?.count > 0) {
    console.log('\n🔄 Updating ffeo -> ext_obligatorio...');
    const result2 = await sql`
      UPDATE programs_catalog
      SET component = 'ext_obligatorio'
      WHERE component = 'ffeo'
      RETURNING id, uac_name, semester, subsystem
    `;
    console.log(`✅ Updated ${result2.length} programs from ffeo to ext_obligatorio`);
  }
  
  // 5. Also check for FFE optativa programs incorrectly in fundamental
  console.log('\n🔍 Checking for FFE optativa programs in fundamental...');
  // These are programs from seed-programs-heuristics.mjs placeholders that might be in wrong component
  const ffeNames = [
    'Análisis de Fenómenos Físicos I (CNET)',
    'Análisis de Fenómenos Biológicos (CNET)',
    'Salud Integral I (CNET)',
    'Organización del Flujo de Materia I (CNET)',
    'Derecho y Sociedad I (CS)',
    'Fundamentos de Administración I (CS)',
    'Economía I (CS)',
    'Procesos Contables I (CS)',
    'Psicología I (HUM)',
    'Pensamiento Filosófico I (HUM)',
    'Arte y Cultura I',
    'Lógica y Pensamiento Crítico',
    'Pensamiento Matemático Finanzas I (CS)',
    'Temas Selectos CS I (CS)',
    'Comunicación y Sociedad I (Lengua)',
    'Inglés V (Lengua)',
    'Raíces etimológicas I (Lengua)',
    'Taller Pensamiento Variacional I (PM)',
    'Dibujo Técnico I (PM)',
    'Probabilidad y Estadística I (PM)',
    'Análisis de Fenómenos Físicos II (CNET)',
    'Temas Selectos de Biología (CNET)',
    'Salud Integral II (CNET)',
    'Organización del Flujo de Materia II (CNET)',
    'Derecho y Sociedad II (CS)',
    'Fundamentos de Administración II (CS)',
    'Economía II (CS)',
    'Procesos Contables II (CS)',
    'Psicología II (HUM)',
    'Pensamiento Filosófico II (HUM)',
    'Arte y Cultura II',
    'Experiencia Estética',
    'Pensamiento Matemático Finanzas II (CS)',
    'Temas Selectos CS II (CS)',
    'Comunicación y Sociedad II (Lengua)',
    'Inglés VI (Lengua)',
    'Raíces etimológicas II (Lengua)',
    'Taller Pensamiento Variacional II (PM)',
    'Dibujo Técnico II (PM)',
    'Probabilidad y Estadística II (PM)'
  ];
  
  // Check if any of these exist in fundamental
  for (const name of ffeNames) {
    const check = await sql`
      SELECT id, uac_name, component, semester 
      FROM programs_catalog 
      WHERE uac_name = ${name} AND component = 'fundamental'
    `;
    if (check.length > 0) {
      console.log(`  ⚠️ Found "${name}" in fundamental, fixing...`);
      await sql`
        UPDATE programs_catalog 
        SET component = 'ext_optativo' 
        WHERE id = ${check[0].id}
      `;
    }
  }
  
  // 6. Show final distribution
  console.log('\n📊 Final component distribution:');
  const finalDist = await sql`
    SELECT component, COUNT(*) as count 
    FROM programs_catalog 
    GROUP BY component 
    ORDER BY count DESC
  `;
  console.table(finalDist);
  
  // 7. Verify ext_optativo programs exist in semesters 5-6
  console.log('\n🔍 Verifying ext_optativo programs in semesters 5-6:');
  const extOptPrograms = await sql`
    SELECT uac_name, semester, subsystem
    FROM programs_catalog
    WHERE component = 'ext_optativo'
    AND semester IN (5, 6)
    ORDER BY semester, uac_name
    LIMIT 10
  `;
  
  console.log(`Found ${extOptPrograms.length} ext_optativo programs (showing first 10):`);
  for (const p of extOptPrograms) {
    console.log(`  - ${p.uac_name} (Sem ${p.semester}, ${p.subsystem})`);
  }
  
  console.log('\n🎉 FFE Component Fix Migration completed!');
}

fixFFEComponent().catch(console.error);