import { readFileSync } from 'fs';
import { neon } from '@neondatabase/serverless';

const envContent = readFileSync('.env.local', 'utf-8');
const match = envContent.match(/DATABASE_URL=['"]?([^'"\r\n]+)['"]?/);
const sql = neon(match[1]);

async function testLookup(uacName, sem, sub) {
  const client = sql;
  const s = (sem !== undefined && !isNaN(sem)) ? sem : null;
  const subsystem = sub && sub !== 'all' ? sub.toLowerCase() : null;

  let rows = await client`
    SELECT id, uac_name, semester, subsystem, component, total_hours, activities
    FROM programs_catalog
    WHERE (
      uac_name ILIKE ${uacName.trim()} 
      OR uac_name ILIKE ${'%' + uacName.trim() + '%'}
      OR ${uacName.trim()} ILIKE ('%' || uac_name || '%')
    )
    AND (${s}::int IS NULL OR semester = ${s})
    AND (${subsystem}::text IS NULL OR subsystem = ${subsystem} OR subsystem = 'bge' OR subsystem = 'all')
    ORDER BY 
      CASE WHEN LOWER(uac_name) = LOWER(${uacName.trim()}) THEN 0 ELSE 1 END,
      CASE WHEN ${subsystem}::text IS NOT NULL AND subsystem = ${subsystem} THEN 0 ELSE 1 END,
      CASE WHEN subsystem = 'bge' THEN 0 ELSE 1 END
    LIMIT 1
  `;

  if (rows.length === 0) {
    rows = await client`
      SELECT id, uac_name, semester, subsystem, component, total_hours, activities
      FROM programs_catalog
      WHERE (
        uac_name ILIKE ${uacName.trim()} 
        OR uac_name ILIKE ${'%' + uacName.trim() + '%'}
        OR ${uacName.trim()} ILIKE ('%' || uac_name || '%')
      )
      AND (${s}::int IS NULL OR semester = ${s})
      ORDER BY 
        CASE WHEN LOWER(uac_name) = LOWER(${uacName.trim()}) THEN 0 ELSE 1 END,
        CASE WHEN subsystem = 'bge' THEN 0 ELSE 1 END
      LIMIT 1
    `;
  }

  const item = rows[0];
  if (!item) {
    console.log(`❌ No encontrado: ${uacName} (Sem ${sem}, Sub: ${sub})`);
  } else {
    console.log(`✓ Encontrado: ${item.uac_name} | Sem: ${item.semester} | Sub en DB: ${item.subsystem} (Query sub: ${sub}) | PF count: ${item.activities?.length}`);
    if (uacName.includes('Pensamiento Matemático III')) {
      console.log('   PF 1:', item.activities[0]?.name?.substring(0, 60));
      console.log('   PF 3:', item.activities[2]?.name?.substring(0, 60));
      console.log('   PF 4:', item.activities[3]?.name?.substring(0, 60));
    }
  }
}

async function run() {
  console.log('--- TEST FALLBACK DE SUBSISTEMAS ---');
  await testLookup('Pensamiento Matemático III', 3, 'bge');
  await testLookup('Pensamiento Matemático III', 3, 'digital');
  await testLookup('Pensamiento Matemático III', 3, 'emsad');
  await testLookup('Pensamiento Matemático III', 3, 'cecyte');
  await testLookup('Pensamiento Matemático III', 3, 'cbtis');
  await testLookup('Lengua y Comunicación I', 1, 'digital');
  await testLookup('Cultura Digital I', 1, 'emsad');
}
run();
