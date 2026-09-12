import fs from 'fs';
import path from 'path';
import { neon } from '@neondatabase/serverless';

const envContent = fs.readFileSync(path.resolve('.env.local'), 'utf8');
const dbUrl = envContent.match(/DATABASE_URL=([^\r\n]+)/)![1].trim();
const sql = neon(dbUrl);

async function main() {
  const candidates = [
    'Ciencias Naturales, Experimentales y Tecnología II',
    'Pensamiento Matemático III',
    'Instalaciones Eléctricas',
    'Diseño de Circuitos',
    'Entrega recursos materiales',
    'Psicología I',
    'Análisis de Fenómenos Físicos II'
  ];

  for (const c of candidates) {
    const rows = await sql`
      SELECT id, uac_name, component, semester, total_hours, 
             jsonb_array_length(CASE WHEN jsonb_typeof(activities) = 'array' THEN activities ELSE '[]'::jsonb END) as act_count,
             learning_outcome
      FROM programs_catalog 
      WHERE uac_name ILIKE ${'%' + c + '%'} AND subsystem = 'bge'
    `;
    console.log(`\nCandidate: ${c}`);
    for (const r of rows) {
      console.log(`  - [${r.component}] ${r.uac_name} (Sem ${r.semester}, ${r.total_hours}h, ${r.act_count} activities)`);
    }
  }
}

main().catch(console.error);
