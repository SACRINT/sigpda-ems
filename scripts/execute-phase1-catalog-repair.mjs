import { readFileSync } from 'fs';
import { neon } from '@neondatabase/serverless';

const envContent = readFileSync('.env.local', 'utf-8');
const match = envContent.match(/DATABASE_URL=['"]?([^'"\r\n]+)['"]?/);
if (!match) {
  console.error('DATABASE_URL not found');
  process.exit(1);
}
const sql = neon(match[1]);

const PAIRS = [
  // 1. Culinarios Sem 3
  ['9215ac34-5d6f-48f3-8a96-c310388364b1', '2cb5acbf-4f2b-4f08-a1d4-562ef1bb45bc'],
  // 2. Turismo Sem 3
  ['1a8adca5-b722-4236-bb9e-458fbfa644e8', '4314169e-1ee0-4b3a-ae03-17c8a883536b'],
  // 3. Contabilidad Sem 3
  ['2a209219-b3a8-48ef-9685-addeef2cf8ce', '8241652a-c6fa-4c96-866e-91b66f8dceaa'],
  // 4. Culinarios / Alimentos Sem 4
  ['b002ee24-a3e9-4804-b654-90a224c81b91', '6a95f2bd-6316-48ac-ba3b-c391442c2a91'],
  // 5. Tecnologías de Información Sem 4
  ['def3982c-5fd2-4dc0-b6f2-975886f4e9e3', '0c52ed67-6913-43e6-9647-b63cb4437577'],
  // 6. Construcción Sem 4
  ['023c668c-8bbb-4cd9-b69f-b83d0217310c', '7d5909ca-8cc7-4a28-be08-6916ded8c887'],
  // 7. Forestal / Ecosistemas Sem 5
  ['9f612c83-77e4-4817-bf9d-42cd666897da', 'b309f671-becf-4220-a3b1-d8b7673fd128'],
  // 8. Construcción / Instalaciones Sem 5 (Coloca vs Limpia)
  ['c6f1ba05-6ecb-40b7-89ca-d867593cd461', '014a17db-fb16-40d7-baf9-e8921179952d'],
  // 9. Contabilidad Sem 5
  ['58518c9f-4dbc-43b6-aef6-34103c42646c', '5d8501b4-d7d2-4b78-86dc-1dca3b3b38fc'],
  // 10. Culinarios Sem 5
  ['088af9f6-e80a-449f-9ae8-f01a96a6e491', 'e43cdc4b-ea59-47c4-b87c-6f1058ae6f69'],
  // 11. Tecnologías de Información Sem 6
  ['913283f6-1ed4-4c7e-8c34-d415516505f2', '82b59ee8-39d3-4f06-8469-c25e1baf672c'],
  // 12. Contabilidad Sem 6
  ['50e9c085-9518-4ffb-8bda-a5691f20fa35', '74ca370c-d362-4ad3-9745-d295d15897ef'],
  // 13. Turismo Sem 6
  ['f11222b7-3ce9-451f-a875-4266910e6347', '039dead4-4dea-4c68-81c2-7981bc254451'],
];

async function main() {
  console.log('--- FASE 1: RESPALDO Y REPARACIÓN DEL CATÁLOGO LABORAL ---');

  // 1. Respaldo
  console.log('1. Creando/verificando tabla programs_catalog_backup_phase1...');
  await sql`
    CREATE TABLE IF NOT EXISTS programs_catalog_backup_phase1 AS
    SELECT * FROM programs_catalog
  `;
  const countBackup = await sql`SELECT count(*) as cnt FROM programs_catalog_backup_phase1`;
  console.log(`   Respaldo listo con ${countBackup[0].cnt} registros.`);

  // 2. Intercambio atómico par por par
  console.log(`2. Intercambiando ${PAIRS.length} pares recíprocos en programs_catalog...`);

  for (const [idA, idB] of PAIRS) {
    const rows = await sql`
      SELECT id, uac_name, learning_outcome, activities, evidences
      FROM programs_catalog
      WHERE id IN (${idA}, ${idB})
    `;
    if (rows.length !== 2) {
      console.warn(`Advertencia: no se encontraron ambos registros para el par (${idA}, ${idB})`);
      continue;
    }
    const rowA = rows.find(r => r.id === idA);
    const rowB = rows.find(r => r.id === idB);

    console.log(`   Swapping:`);
    console.log(`     A: [${rowA.id}] "${rowA.uac_name}"`);
    console.log(`     B: [${rowB.id}] "${rowB.uac_name}"`);

    // Intercambiamos outcome, activities, evidences
    await sql`
      UPDATE programs_catalog
      SET learning_outcome = ${rowB.learning_outcome},
          activities = ${JSON.stringify(rowB.activities)},
          evidences = ${JSON.stringify(rowB.evidences)}
      WHERE id = ${idA}
    `;

    await sql`
      UPDATE programs_catalog
      SET learning_outcome = ${rowA.learning_outcome},
          activities = ${JSON.stringify(rowA.activities)},
          evidences = ${JSON.stringify(rowA.evidences)}
      WHERE id = ${idB}
    `;
  }

  // 3. Verificación
  console.log('3. Verificando resultado de Coloca vs Limpia...');
  const check = await sql`
    SELECT id, uac_name, learning_outcome 
    FROM programs_catalog 
    WHERE id IN ('c6f1ba05-6ecb-40b7-89ca-d867593cd461', '014a17db-fb16-40d7-baf9-e8921179952d')
  `;
  for (const c of check) {
    console.log(`   [${c.id}] UAC: "${c.uac_name}" -> Outcome starts with: "${(c.learning_outcome || '').slice(0, 50)}..."`);
  }

  console.log('✓ FASE 1 COMPLETADA CON ÉXITO.');
}

main().catch(err => {
  console.error('Error en Fase 1:', err);
  process.exit(1);
});

