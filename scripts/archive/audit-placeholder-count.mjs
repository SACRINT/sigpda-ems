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
    SELECT id, uac_name, semester, component, subsystem, model_type, activities, contenidos_formativos, learning_outcome 
    FROM programs_catalog 
    ORDER BY semester, component, uac_name
  `;
  
  let placeholderCount = 0;
  let authenticCount = 0;
  const samplePlaceholders = [];
  const sampleAuthentic = [];
  
  rows.forEach(r => {
    const acts = r.activities || [];
    const cfs = r.contenidos_formativos || [];
    const actsStr = JSON.stringify(acts);
    
    // Exact placeholder heuristics:
    // A placeholder is when acts has generic text like "Propósito Formativo 1: Analizar y aplicar..."
    // or when there are 0 activities, or duplicate activities.
    const isPlaceholder = 
      acts.length === 0 ||
      actsStr.includes('Analizar y aplicar los conceptos formativos esenciales de') || 
      actsStr.includes('Desarrollar los fundamentos y aplicaciones prácticas de') ||
      actsStr.includes('Comprender y dominar los contenidos formativos');
      
    if (isPlaceholder) {
      placeholderCount++;
      if (samplePlaceholders.length < 10) {
        samplePlaceholders.push({ name: r.uac_name, sem: r.semester, comp: r.component, sub: r.subsystem, acts: acts.slice(0, 1) });
      }
    } else {
      authenticCount++;
      if (sampleAuthentic.length < 5) {
        sampleAuthentic.push({ name: r.uac_name, sem: r.semester, comp: r.component, sub: r.subsystem, acts: acts.slice(0, 2), cfsCount: cfs.length });
      }
    }
  });

  console.log('----------------------------------------------------');
  console.log(`📊 ESTADO ACTUAL DEL CATÁLOGO (AUDITORÍA OFICIAL):`);
  console.log(`   - Total registros: ${rows.length}`);
  console.log(`   - Registros Auténticos / Enriquecidos: ${authenticCount} (${Math.round(authenticCount / rows.length * 100)}%)`);
  console.log(`   - Registros con Contenido Placeholder: ${placeholderCount}`);
  console.log('----------------------------------------------------');
  if (samplePlaceholders.length > 0) {
    console.log('\nEjemplos con Placeholder Restantes:');
    console.log(JSON.stringify(samplePlaceholders, null, 2));
  }
  console.log('\nEjemplos de Registros Auténticos:');
  console.log(JSON.stringify(sampleAuthentic, null, 2));
}

main().catch(console.error);
