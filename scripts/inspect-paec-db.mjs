import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { neon } from '@neondatabase/serverless';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const envPath = path.join(rootDir, '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const match = envContent.match(/DATABASE_URL=['"]?([^'"\r\n]+)['"]?/);
const sql = neon(match[1]);

async function check() {
  const projects = await sql`
    SELECT id, project_name, cycle_type, current_step,
           CASE WHEN fase2_mapeo IS NOT NULL THEN jsonb_array_length(fase2_mapeo) ELSE 0 END as mapeo_count,
           CASE WHEN fase2_plan_operativo->'semestreA' IS NOT NULL THEN jsonb_array_length(fase2_plan_operativo->'semestreA') ELSE 0 END as plan_a_count,
           CASE WHEN fase2_plan_operativo->'semestreB' IS NOT NULL THEN jsonb_array_length(fase2_plan_operativo->'semestreB') ELSE 0 END as plan_b_count
    FROM paec_projects
    ORDER BY updated_at DESC
    LIMIT 10;
  `;
  console.log('Existing PAEC projects:');
  console.table(projects);

  if (projects.length > 0 && projects[0].plan_a_count > 0) {
    const detail = await sql`
      SELECT fase2_plan_operativo->'semestreA' as plan_a
      FROM paec_projects
      WHERE id = ${projects[0].id}
    `;
    console.log('Sample rows from latest plan_a (first 5):');
    console.log(JSON.stringify(detail[0].plan_a.slice(0, 5), null, 2));

    const uacsInPlan = new Set(detail[0].plan_a.map((r) => r.uac));
    console.log('\nDistinct UACs appearing in plan_a:', Array.from(uacsInPlan));
    console.log('Total rows in plan_a:', detail[0].plan_a.length);
    console.log('Total distinct UACs in plan_a:', uacsInPlan.size);
  }
}

check().catch(console.error);
