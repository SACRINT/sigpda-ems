import { neon } from '@neondatabase/serverless';

const dbUrl = 'postgresql://neondb_owner:npg_Tec5LgY7KIfC@ep-divine-grass-atatmg66-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require';
const sql = neon(dbUrl);

async function run() {
  console.log('Connecting to Neon...');
  const rows = await sql`
    SELECT id, uac_name, semester, component, total_hours, activities, contenidos_formativos, learning_outcome
    FROM programs_catalog
    WHERE semester = 3 AND (uac_name ILIKE '%matem%' OR uac_name ILIKE '%pensamiento%')
  `;
  console.log('TOTAL ROWS FOUND:', rows.length);
  for (const r of rows) {
    console.log('\n======================================================');
    console.log(`UAC: "${r.uac_name}" | Semestre: ${r.semester} | Comp: ${r.component}`);
    console.log('Activities count:', Array.isArray(r.activities) ? r.activities.length : typeof r.activities);
    if (Array.isArray(r.activities)) {
      r.activities.forEach((act, idx) => {
        console.log(`  Act ${idx + 1}:`, typeof act === 'string' ? act : (act.name || JSON.stringify(act)));
      });
    }
    console.log('Contenidos formativos count:', Array.isArray(r.contenidos_formativos) ? r.contenidos_formativos.length : typeof r.contenidos_formativos);
    if (Array.isArray(r.contenidos_formativos)) {
      console.log('Contenidos formativos sample:', JSON.stringify(r.contenidos_formativos, null, 2));
    }
  }
}

run().catch(console.error);
