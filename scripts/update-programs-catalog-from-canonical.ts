import { sql } from '../src/lib/db/client';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const client = sql();
  const canonicalPath = path.join(__dirname, 'data', 'curriculum_canonical_203.json');
  const canonicalList = JSON.parse(fs.readFileSync(canonicalPath, 'utf-8'));

  console.log(`Cargados ${canonicalList.length} registros canónicos.`);

  let updatedCount = 0;

  for (const item of canonicalList) {
    if (item.semester >= 5 && item.component === 'ffe_optativa') {
      const uacName = item.uac_name;
      const sem = item.semester;
      const comp = item.component;
      const hours = item.total_hours || 54;
      const outcome = item.learning_outcome || null;
      const activities = item.activities || [];
      const modelType = 'progresiones';

      // Actualizar en base de datos tanto la coincidencia exacta como posibles variantes
      const result = await client`
        UPDATE programs_catalog
        SET 
          total_hours = ${hours},
          learning_outcome = ${outcome},
          activities = ${JSON.stringify(activities)}::jsonb,
          model_type = ${modelType},
          contenidos_formativos = NULL
        WHERE semester = ${sem} 
          AND (
            uac_name = ${uacName} 
            OR (uac_name ILIKE ${'%' + uacName.replace(/^Taller de /i, 'Taller ') + '%'})
            OR (uac_name ILIKE ${'%' + uacName + '%'})
          )
        RETURNING id, uac_name, semester;
      `;

      if (result.length > 0) {
        for (const row of result) {
          console.log(`[DB OK] ${row.uac_name} (Sem ${row.semester}) -> ${activities.length} progresiones.`);
          updatedCount++;
        }
      } else {
        // Si no existía, insertarlo
        await client`
          INSERT INTO programs_catalog (
            uac_name, semester, component, subsystem, total_hours, learning_outcome,
            activities, evidences, contenidos_formativos, model_type, year, curriculum_name, created_at
          ) VALUES (
            ${uacName}, ${sem}, ${comp}, 'bge', ${hours}, ${outcome},
            ${JSON.stringify(activities)}::jsonb, '[]'::jsonb, NULL, ${modelType}, 2023, 'Formación Propedéutica Optativa', NOW()
          )
          ON CONFLICT (uac_name, semester, component, subsystem)
          DO UPDATE SET
            total_hours = EXCLUDED.total_hours,
            learning_outcome = EXCLUDED.learning_outcome,
            activities = EXCLUDED.activities,
            model_type = EXCLUDED.model_type,
            contenidos_formativos = NULL;
        `;
        console.log(`[DB INSERTED] ${uacName} (Sem ${sem}) -> ${activities.length} progresiones.`);
        updatedCount++;
      }
    }
  }

  console.log(`\n¡Actualización completada! ${updatedCount} filas afectadas en Neon DB.`);
  process.exit(0);
}

main().catch(err => {
  console.error("Error actualizando DB:", err);
  process.exit(1);
});
