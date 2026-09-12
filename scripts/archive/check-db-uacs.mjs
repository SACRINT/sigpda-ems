import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env.local');
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

async function main() {
  const specs = [
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
  ];

  for (const s of specs) {
    const rows = await sql`
      SELECT semester, uac_name 
      FROM programs_catalog 
      WHERE component = 'laboral' AND curriculum_name = ${s}
      ORDER BY semester, uac_name
    `;
    console.log(`${s}: ${rows.length} UACs in DB`);
  }
}

main().catch(console.error);
