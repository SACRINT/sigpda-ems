import { readFileSync } from 'fs';
import { neon } from '@neondatabase/serverless';

const envContent = readFileSync('.env.local', 'utf-8');
const match = envContent.match(/DATABASE_URL=['"]?([^'"\r\n]+)['"]?/);
const sql = neon(match[1]);

async function migrate() {
  console.log('--- ACTUALIZANDO CONSTRAINT EN planning_extras ---');
  await sql`
    ALTER TABLE planning_extras DROP CONSTRAINT IF EXISTS planning_extras_type_check;
  `;
  await sql`
    ALTER TABLE planning_extras ADD CONSTRAINT planning_extras_type_check
    CHECK (type = ANY (ARRAY['rubric','checklist','material','lesson_plan','practice_guide','teacher_guide','visual','evaluation']));
  `;
  console.log('✓ Constraint planning_extras_type_check actualizado con éxito.');
}

migrate().catch(console.error);

