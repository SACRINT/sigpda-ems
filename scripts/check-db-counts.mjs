import { readFileSync } from 'fs';
import { neon } from '@neondatabase/serverless';

const envContent = readFileSync('.env.local', 'utf-8');
const match = envContent.match(/DATABASE_URL=['"]?([^'"\r\n]+)['"]?/);
const sql = neon(match[1]);

async function run() {
  const total = await sql`SELECT count(*) FROM programs_catalog WHERE component = 'laboral'`;
  console.log('Total laboral rows:', total[0].count);

  const byCurr = await sql`
    SELECT curriculum_name, count(*) as count, count(DISTINCT uac_name) as distinct_uacs
    FROM programs_catalog 
    WHERE component = 'laboral'
    GROUP BY curriculum_name
    ORDER BY curriculum_name
  `;
  console.table(byCurr);

  const duplicates = await sql`
    SELECT curriculum_name, semester, uac_name, count(*) as count
    FROM programs_catalog
    WHERE component = 'laboral'
    GROUP BY curriculum_name, semester, uac_name
    HAVING count(*) > 1
  `;
  console.log('Number of duplicate (curriculum, semester, uac_name) groups:', duplicates.length);
  if (duplicates.length > 0) {
    console.log('Sample duplicates:', duplicates.slice(0, 5));
  }
}

run().catch(console.error);
