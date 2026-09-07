import fs from 'fs';
import { neon } from '@neondatabase/serverless';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const match = envContent.match(/DATABASE_URL=['"]?([^'"\r\n]+)['"]?/);
const sql = neon(match[1]);

const matched = JSON.parse(fs.readFileSync('scripts/matched-laboral-complete.json', 'utf-8'));

// Official accented names for the 15 Capacitaciones
const CAP_ACCENTS = {
  "Administracion": "Administración",
  "Agricultura Sostenible de Traspatio": "Agricultura Sostenible de Traspatio",
  "Area de la Salud": "Área de la Salud",
  "Comunicacion Grafica": "Comunicación Gráfica",
  "Contabilidad": "Contabilidad",
  "Domotica": "Domótica",
  "Instalaciones Residenciales": "Instalaciones Residenciales",
  "Mecanica Dental": "Mecánica Dental",
  "Preparacion de Alimentos Artesanales": "Preparación de Alimentos Artesanales",
  "Procesos Culinarios y Reposteria": "Procesos Culinarios y Repostería",
  "Redes y Mantenimiento": "Redes y Mantenimiento",
  "Servicios Ecosistemicos": "Servicios Ecosistémicos",
  "Sistemas Electricos": "Sistemas Eléctricos",
  "Tecnologia Informatica": "Tecnología Informática",
  "Turismo": "Turismo"
};

let updated = 0;

for (const [rawCap, sems] of Object.entries(matched)) {
  const capName = CAP_ACCENTS[rawCap] || rawCap;
  
  for (const [semStr, uacs] of Object.entries(sems)) {
    const sem = parseInt(semStr.replace('sem', ''));
    
    for (const uac of uacs) {
      const res = await sql`
        UPDATE programs_catalog
        SET curriculum_name = ${capName}
        WHERE uac_name = ${uac} 
          AND semester = ${sem} 
          AND component = 'laboral'
        RETURNING id, uac_name, curriculum_name
      `;
      if (res.length > 0) {
        updated += res.length;
      } else {
        console.warn(`Could not update: SEM ${sem} | ${uac}`);
      }
    }
  }
}

console.log(`\nSuccessfully updated ${updated} laboral UACs with their authentic capacitación in programs_catalog!`);

// Verify in DB
const verification = await sql`
  SELECT curriculum_name, count(*) as total
  FROM programs_catalog
  WHERE component = 'laboral'
  GROUP BY curriculum_name
  ORDER BY curriculum_name
`;
console.table(verification);
