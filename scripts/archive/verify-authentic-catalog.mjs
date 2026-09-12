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

async function verify() {
  console.log('🔍 VERIFICACIÓN DE CALIDAD DE DATOS EN PROGRAMS_CATALOG:');
  
  // 1. Total records
  const total = await sql`SELECT count(*) FROM programs_catalog`;
  console.log(`\n1. Total registros: ${total[0].count}`);

  // 2. Sample records from different semesters and components
  const samples = await sql`
    SELECT id, uac_name, semester, component, subsystem, model_type, total_hours, 
           learning_outcome, activities, contenidos_formativos
    FROM programs_catalog
    WHERE uac_name IN (
      'La Materia y sus Interacciones', 
      'Pensamiento Matemático I', 
      'Lengua y Comunicación II', 
      'Humanidades I',
      'Inglés I',
      'Cultura Digital I',
      'Laboratorio de Investigación',
      'Ciencias Sociales I'
    )
    AND subsystem = 'bge'
    ORDER BY semester, uac_name
  `;

  console.log(`\n2. Muestra de UACs Fundamentales en BGE (Total extraídas: ${samples.length}):`);
  samples.forEach(s => {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📌 UAC: ${s.uac_name} (Semestre ${s.semester}) | Componente: ${s.component} | Horas: ${s.total_hours} | Modelo: ${s.model_type}`);
    console.log(`🎯 Meta Educativa: ${s.learning_outcome}`);
    console.log(`📋 Propósitos (${s.activities?.length || 0}):`);
    s.activities?.slice(0, 3).forEach((a, i) => console.log(`   ${i+1}. [${a.hours}h] ${a.name}`));
    console.log(`📚 Contenidos Formativos (${s.contenidos_formativos?.length || 0}):`);
    s.contenidos_formativos?.slice(0, 2).forEach((c, i) => {
      console.log(`   ${i+1}. Propósito: ${c.proposito}`);
      console.log(`      Temas: ${JSON.stringify(c.contenidos)}`);
    });
  });

  // 3. Test API filtering behavior for all 7 subsystems
  console.log('\n3. Comprobando consultas por cada subsistema:');
  const subs = ['bge', 'tecnologico', 'cbtis', 'cbta', 'cecyte', 'digital', 'emsad'];
  for (const sub of subs) {
    const res = await sql`
      SELECT count(*) FROM programs_catalog 
      WHERE subsystem = ${sub}
    `;
    console.log(`   - Subsistema '${sub}': ${res[0].count} UACs disponibles`);
  }
}

verify().catch(console.error);
