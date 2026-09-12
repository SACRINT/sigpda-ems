import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { neon } from '@neondatabase/serverless';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// 1. Cargar variables de entorno
const envPath = path.join(rootDir, '.env.local');
if (!existsSync(envPath)) {
  console.error('❌ Archivo .env.local no encontrado.');
  process.exit(1);
}
const envContent = readFileSync(envPath, 'utf-8');
const match = envContent.match(/DATABASE_URL=['"]?([^'"\r\n]+)['"]?/);
if (!match) {
  console.error('❌ DATABASE_URL no encontrada en .env.local');
  process.exit(1);
}
const sql = neon(match[1]);

async function main() {
  console.log('========================================================================');
  console.log('🚀 SINCRONIZADOR CANÓNICO DE BACHILLERATO TECNOLÓGICO (25 CARRERAS 2024)');
  console.log('========================================================================\n');

  const jsonPath = path.join(__dirname, 'data', 'bt_canonical_25.json');
  if (!existsSync(jsonPath)) {
    console.error(`❌ Archivo canónico no encontrado en: ${jsonPath}`);
    process.exit(1);
  }

  const careers = JSON.parse(readFileSync(jsonPath, 'utf-8'));
  console.log(`✓ Archivo canónico cargado con ${careers.length} carreras técnicas.`);

  let totalSubmodules = 0;
  let totalActivities = 0;
  let totalSaberes = 0;

  for (const c of careers) {
    for (const m of c.modules) {
      for (const s of m.submodulos) {
        totalSubmodules++;
        totalActivities += s.actividades.length;
        for (const a of s.actividades) {
          totalSaberes += a.saberes.length;
        }
      }
    }
  }

  console.log(`✓ Total submódulos a sincronizar: ${totalSubmodules}`);
  console.log(`✓ Total actividades clave: ${totalActivities}`);
  console.log(`✓ Total saberes procedimentales: ${totalSaberes}\n`);

  const defaultEvidences = [
    'Portafolio de evidencias de prácticas técnicas y de laboratorio',
    'Reporte técnico de ejecución de competencias laborales',
    'Guía de observación / Rúbrica de desempeño técnico profesional'
  ];

  let insertedCount = 0;
  let errorCount = 0;

  for (const career of careers) {
    console.log(`📂 Procesando carrera: [${career.id}] ${career.name}...`);
    
    for (const modulo of career.modules) {
      const sem = modulo.semestre;
      const resultadoAprendizaje = modulo.resultado_aprendizaje;

      for (const sub of modulo.submodulos) {
        const uacName = sub.uac_name.trim();
        const totalHrs = sub.horas_totales;

        const activitiesPayload = sub.actividades.map(a => ({
          order: a.order,
          name: a.name,
          hours: a.hours,
          saberes: a.saberes
        }));

        const contenidosPayload = sub.actividades.map(a => ({
          order: a.order,
          actividad: a.name,
          saberes: a.saberes
        }));

        try {
          await sql`
            INSERT INTO programs_catalog (
              uac_name,
              semester,
              component,
              subsystem,
              total_hours,
              learning_outcome,
              activities,
              evidences,
              contenidos_formativos,
              model_type,
              year,
              curriculum_name,
              created_at
            ) VALUES (
              ${uacName},
              ${sem},
              'laboral',
              'tecnologico',
              ${totalHrs},
              ${resultadoAprendizaje},
              ${JSON.stringify(activitiesPayload)},
              ${JSON.stringify(defaultEvidences)},
              ${JSON.stringify(contenidosPayload)},
              'competencias_laborales',
              2024,
              ${career.name},
              NOW()
            )
            ON CONFLICT (uac_name, semester, component, subsystem)
            DO UPDATE SET
              total_hours = EXCLUDED.total_hours,
              learning_outcome = EXCLUDED.learning_outcome,
              activities = EXCLUDED.activities,
              evidences = EXCLUDED.evidences,
              contenidos_formativos = EXCLUDED.contenidos_formativos,
              model_type = EXCLUDED.model_type,
              year = EXCLUDED.year,
              curriculum_name = EXCLUDED.curriculum_name;
          `;
          insertedCount++;
        } catch (err) {
          errorCount++;
          console.error(`  ❌ Error insertando submódulo "${uacName}" (Sem ${sem}):`, err.message);
        }
      }
    }
  }

  console.log('\n========================================================================');
  console.log(`🎉 SINCRONIZACIÓN FINALIZADA`);
  console.log(`- Submódulos sincronizados exitosamente: ${insertedCount}/${totalSubmodules}`);
  console.log(`- Errores: ${errorCount}`);
  console.log('========================================================================\n');

  // Verificación en base de datos
  const countInDb = await sql`
    SELECT count(*) as count 
    FROM programs_catalog 
    WHERE subsystem = 'tecnologico' AND component = 'laboral';
  `;
  console.log(`🔍 Registros confirmados en Neon DB (subsystem='tecnologico', component='laboral'): ${countInDb[0].count}`);

  const sampleRows = await sql`
    SELECT curriculum_name, uac_name, semester, total_hours, model_type, jsonb_array_length(activities) as act_count
    FROM programs_catalog
    WHERE subsystem = 'tecnologico'
    ORDER BY created_at DESC
    LIMIT 3;
  `;
  console.log('\n📋 Muestra de registros insertados:');
  console.table(sampleRows);
}

main().catch(err => {
  console.error('❌ Error fatal en sincronización:', err);
  process.exit(1);
});
