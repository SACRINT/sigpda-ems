import { readFileSync } from 'fs';
import { neon } from '@neondatabase/serverless';

const envContent = readFileSync('.env.local', 'utf-8');
const match = envContent.match(/DATABASE_URL=['"]?([^'"\r\n]+)['"]?/);
const sql = neon(match[1]);

async function check() {
  const rows = await sql`
    SELECT id, curriculum_name, semester, uac_name, component
    FROM programs_catalog 
    WHERE component = 'laboral' 
      AND curriculum_name IN (
        'Administración',
        'Agricultura Sostenible de Traspatio',
        'Área de la Salud',
        'Comunicación Gráfica',
        'Contabilidad',
        'Domótica',
        'Instalaciones Residenciales',
        'Mecánica Dental',
        'Preparación de Alimentos Artesanales',
        'Procesos Culinarios y Repostería',
        'Redes y Mantenimiento',
        'Servicios Ecosistémicos',
        'Sistemas Eléctricos',
        'Tecnología Informática',
        'Turismo'
      )
    ORDER BY curriculum_name, semester, id
  `;
  
  console.log('Total BGE rows in DB:', rows.length);
  
  // Group by curriculum and semester
  const grouped = {};
  for (const r of rows) {
    if (!grouped[r.curriculum_name]) grouped[r.curriculum_name] = {};
    if (!grouped[r.curriculum_name][r.semester]) grouped[r.curriculum_name][r.semester] = [];
    grouped[r.curriculum_name][r.semester].push(r);
  }
  
  for (const [curr, sems] of Object.entries(grouped)) {
    console.log(`\n=== ${curr} ===`);
    for (const [sem, uacs] of Object.entries(sems)) {
      console.log(`  Sem ${sem} (${uacs.length} UACs):`);
      uacs.forEach((u, i) => console.log(`    UAC ${i+1}: [id=${u.id}] ${u.uac_name}`));
    }
  }
}

check().catch(console.error);
