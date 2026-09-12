import { neon } from '@neondatabase/serverless';

const dbUrl = 'postgresql://neondb_owner:npg_Tec5LgY7KIfC@ep-divine-grass-atatmg66-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require';
const sql = neon(dbUrl);

async function inspectSchema() {
  const rows = await sql`
    SELECT uac_name, semester, component, subsystem, model_type, COUNT(*)::int as cnt
    FROM programs_catalog
    WHERE uac_name ILIKE '%Pensamiento Matemático%'
    GROUP BY uac_name, semester, component, subsystem, model_type
    ORDER BY uac_name, semester, subsystem
  `;
  console.log('PENSAMIENTO MATEMATICO ENTRIES BY SUBSYSTEM:');
  rows.forEach(r => console.log(`  ${r.uac_name} | Sem ${r.semester} | Sub: ${r.subsystem} | Model: ${r.model_type}`));
}

inspectSchema().catch(console.error);
