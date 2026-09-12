import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function inspectTables() {
  const rows = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `;
  console.log('Tables in DB:', rows.map(r => r.table_name));
}

inspectTables().catch(console.error);
