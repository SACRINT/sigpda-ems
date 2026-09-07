import fs from 'fs';
import { neon } from '@neondatabase/serverless';
import { CARRERAS_TECNOLOGICAS } from '../src/lib/bt-carreras-catalog.ts';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const match = envContent.match(/DATABASE_URL=['"]?([^'"\r\n]+)['"]?/);
const sql = neon(match[1]);

const TECH_SUBSYSTEMS = ['tecnologico', 'cbtis', 'cbta', 'cecyte'];

let inserted = 0;

for (const sub of TECH_SUBSYSTEMS) {
  for (const c of CARRERAS_TECNOLOGICAS) {
    const curName = `${c.nombre} (${c.tipoPrograma === 'nuevo' ? 'Nuevo Prog. 2024' : 'Plan Anterior'})`;
    
    for (const m of c.modulos) {
      for (const s of m.submodulos) {
        const totalHrs = s.horasSemanales * 18;
        const learningOutcome = `Desarrollar competencias profesionales en ${s.nombre} correspondientes al ${m.nombre}.`;
        const activities = JSON.stringify([
          { order: 1, name: `Fundamentos teóricos y normativos de ${s.nombre}`, hours: Math.round(totalHrs * 0.25) },
          { order: 2, name: `Práctica y desarrollo de habilidades en ${s.nombre}`, hours: Math.round(totalHrs * 0.5) },
          { order: 3, name: `Evaluación y resolución de casos en ${s.nombre}`, hours: Math.round(totalHrs * 0.25) }
        ]);
        const contenidos = JSON.stringify([
          { order: 1, proposito: `Fundamentos de ${s.nombre}`, hours: Math.round(totalHrs * 0.25), contenidos: ['Marco conceptual y normativo', 'Criterios técnicos'] },
          { order: 2, proposito: `Aplicación operativa de ${s.nombre}`, hours: Math.round(totalHrs * 0.5), contenidos: ['Técnicas y procedimientos', 'Manejo de herramientas especializadas'] },
          { order: 3, proposito: `Control y evaluación de ${s.nombre}`, hours: Math.round(totalHrs * 0.25), contenidos: ['Supervisión de calidad', 'Reportes y evidencias'] }
        ]);
        const evidences = JSON.stringify([
          "Reporte de práctica técnica",
          "Lista de cotejo de desempeño profesional",
          "Portafolio de evidencias de la carrera técnica"
        ]);
        const modelType = m.semestre >= 5 ? 'progresiones' : 'mccems';

        // Check if exists
        const exists = await sql`
          SELECT id FROM programs_catalog
          WHERE uac_name = ${s.nombre}
            AND semester = ${m.semestre}
            AND component = 'laboral'
            AND subsystem = ${sub}
            AND curriculum_name = ${curName}
        `;

        if (exists.length === 0) {
          await sql`
            INSERT INTO programs_catalog (
              uac_name, semester, component, curriculum_name, year, total_hours,
              learning_outcome, activities, evidences, contenidos_formativos, subsystem, model_type
            ) VALUES (
              ${s.nombre}, ${m.semestre}, 'laboral', ${curName}, 2024, ${totalHrs},
              ${learningOutcome}, ${activities}::jsonb, ${evidences}::jsonb, ${contenidos}::jsonb, ${sub}, ${modelType}
            )
          `;
          inserted++;
        }
      }
    }
  }
}

console.log(`Inserted ${inserted} technological laboral UAC records across ${TECH_SUBSYSTEMS.join(', ')}.`);
