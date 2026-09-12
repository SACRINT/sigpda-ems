const { neon } = require('@neondatabase/serverless');

async function main() {
  const sql = neon(process.env.DATABASE_URL);
  const count = await sql`SELECT count(*) FROM programs_catalog`;
  console.log('Count in programs_catalog:', count[0].count);
  const sample = await sql`SELECT id, uac_name, semester, component, subsystem, model_type FROM programs_catalog LIMIT 10`;
  console.log('Sample rows:', sample);
}

main().catch(console.error);
