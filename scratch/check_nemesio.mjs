import { readFileSync } from 'fs';
import { neon } from '@neondatabase/serverless';

const envContent = readFileSync('.env.local', 'utf-8');
const match = envContent.match(/DATABASE_URL=['"]?([^'"\r\n]+)['"]?/);
const sql = neon(match[1]);

async function checkNemesio() {
  console.log('--- BUSCANDO DOCENTE NEMESIO Y SU PLANEACIÓN ---');
  
  // Buscar docente por id
  const teacher = await sql`
    SELECT id, name, email, role, school_name, cct, subsystem
    FROM teachers
    WHERE id = '08502250-0e44-4da6-b282-2ed11ad2077c'::uuid
  `;
  console.log('Docente de la planeación:', teacher);

  // Buscar planeación detallada
  const planningDetails = await sql`
    SELECT id, uac_name, semester, component, paec_context,
           extracted_data,
           content_json
    FROM plannings
    WHERE id = '8e7f29af-f124-4c99-b4bc-388ebc430309'::uuid
  `;
  const p = planningDetails[0];
  console.log('sectionIII (Propósitos / Bloques):', JSON.stringify(p.content_json?.sectionIII, null, 2));
  console.log('sectionIV (Secuencia Didáctica):', JSON.stringify(p.content_json?.sectionIV, null, 2)?.substring(0, 1000));
}

checkNemesio();
