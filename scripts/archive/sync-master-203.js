const fs = require('fs');
const path = require('path');
const { neon } = require('@neondatabase/serverless');

async function main() {
  const sql = neon(process.env.DATABASE_URL);
  const jsonPath = 'C:\\Proyectos_SACRINT\\Proyecto_SIGPDA_EMS\\documentos_referencia\\[02] Programas_de_Estudio\\uacs_master_203.json';
  
  if (!fs.existsSync(jsonPath)) {
    console.error('File not found:', jsonPath);
    return;
  }

  const raw = fs.readFileSync(jsonPath, 'utf8');
  const uacs = JSON.parse(raw);
  console.log(`Leídas ${uacs.length} UACs del archivo maestro 203.`);

  let inserted = 0;
  let updated = 0;

  for (const u of uacs) {
    const semester = u.semester || u.semestre || 1;
    const uacName = (u.uac_name || u.nombre || '').trim();
    if (!uacName) continue;

    // Component normalization
    let comp = (u.component || u.componente || 'fundamental').toLowerCase();
    if (comp === 'socioemocional') comp = 'ampliado';
    if (comp === 'ffeo') comp = 'ext_obligatorio';
    if (comp === 'ffe_optativa' || comp === 'ffe') comp = 'ext_optativo';

    const totalHours = u.total_hours || u.horas || 54;
    const subsystem = 'bge';
    const modelType = semester >= 5 ? 'progresiones' : 'propositos_contenidos';
    const year = semester >= 5 ? 2023 : 2025;
    const curriculumName = u.curriculum_name || (comp === 'laboral' ? 'Capacitación para el Trabajo' : null);

    // Default activities based on model
    const numActs = semester >= 5 ? 3 : 3;
    const hoursPerAct = Math.round(totalHours / numActs);
    const defaultActivities = Array.from({ length: numActs }, (_, i) => ({
      name: semester >= 5 ? `Progresión de Aprendizaje ${i + 1}` : `Propósito Formativo ${i + 1}`,
      hours: hoursPerAct,
      order: i + 1,
    }));

    const defaultContenidos = semester >= 5 ? null : Array.from({ length: numActs }, (_, i) => ({
      proposito: `Propósito Formativo ${i + 1}`,
      contenidos: [`Contenido temático formativo ${i + 1}.1`, `Contenido temático formativo ${i + 1}.2`],
    }));

    const defaultEvidences = [
      'Producto integrador de aprendizaje / Proyecto formativo',
      'Portafolio de evidencias y rúbrica de desempeño'
    ];

    try {
      const res = await sql`
        INSERT INTO programs_catalog (
          uac_name, semester, component, curriculum_name, year, total_hours,
          learning_outcome, activities, evidences, contenidos_formativos, subsystem, model_type
        ) VALUES (
          ${uacName},
          ${semester},
          ${comp},
          ${curriculumName},
          ${year},
          ${totalHours},
          ${`Al concluir el semestre, el estudiante consolida los aprendizajes esperados de ${uacName}.`},
          ${JSON.stringify(defaultActivities)}::jsonb,
          ${JSON.stringify(defaultEvidences)}::jsonb,
          ${defaultContenidos ? JSON.stringify(defaultContenidos) : null}::jsonb,
          ${subsystem},
          ${modelType}
        )
        ON CONFLICT (uac_name, semester, component, subsystem)
        DO UPDATE SET
          curriculum_name = COALESCE(programs_catalog.curriculum_name, EXCLUDED.curriculum_name),
          total_hours = EXCLUDED.total_hours,
          model_type = EXCLUDED.model_type,
          year = EXCLUDED.year
        RETURNING id;
      `;
      if (res.length > 0) updated++;
    } catch (err) {
      console.error(`Error al insertar ${uacName}:`, err.message);
    }
  }

  console.log(`✅ Sincronización completada. ${updated} UACs procesadas / actualizadas.`);

  // Verify total count in DB
  const total = await sql`SELECT count(*) FROM programs_catalog`;
  console.log(`📊 Total actual de UACs en programs_catalog: ${total[0].count}`);
}

main().catch(console.error);
