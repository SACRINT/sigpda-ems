import { neon } from '@neondatabase/serverless';

const dbUrl = 'postgresql://neondb_owner:npg_Tec5LgY7KIfC@ep-divine-grass-atatmg66-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require';
const sql = neon(dbUrl);

async function run() {
  const rows = await sql`SELECT uac_name, semester, component, curriculum_name, subsystem FROM programs_catalog WHERE component = 'laboral' LIMIT 10`;
  console.log('Laboral rows in DB:', rows.length);
  rows.forEach(r => console.log(' ', r));

  const countBySubsystem = await sql`SELECT subsystem, component, COUNT(*)::int as cnt FROM programs_catalog GROUP BY subsystem, component`;
  console.log('\nCatalog counts:');
  countBySubsystem.forEach(c => console.log(' ', c));
}
run().catch(console.error);
