import { readFileSync } from 'fs';
import { neon } from '@neondatabase/serverless';

const envContent = readFileSync('.env.local', 'utf-8');
const match = envContent.match(/DATABASE_URL=['"]?([^'"\r\n]+)['"]?/);
if (!match) {
  console.error('DATABASE_URL not found in .env.local');
  process.exit(1);
}
const sql = neon(match[1]);

async function run() {
  console.log('--- Migrando tabla paec_projects para 9 Pasos Oficiales (MCCEMS/NEM) ---');
  
  // 1. Modificar constraint check de current_step a 1..9
  console.log('1. Actualizando constraint paec_projects_current_step_check a 1..9...');
  await sql`ALTER TABLE paec_projects DROP CONSTRAINT IF EXISTS paec_projects_current_step_check`;
  await sql`ALTER TABLE paec_projects ADD CONSTRAINT paec_projects_current_step_check CHECK (current_step BETWEEN 1 AND 9)`;
  console.log('   ✓ Constraint paec_projects_current_step_check actualizado exitosamente a 1..9.');

  // 2. Verificar constraints existentes en paec_projects
  const constraints = await sql`
    SELECT conname, pg_get_constraintdef(c.oid) as def
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE conrelid = 'paec_projects'::regclass
  `;
  console.log('2. Constraints vigentes en paec_projects:');
  constraints.forEach(c => console.log(`   - ${c.conname}: ${c.def}`));

  console.log('\n--- Migración a 9 Pasos completada exitosamente ---');
}

run().catch(err => {
  console.error('Error durante la migración:', err);
  process.exit(1);
});
