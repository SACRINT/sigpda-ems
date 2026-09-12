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
  console.log('--- Migrando tabla paec_projects para 7 Pasos ---');
  
  // 1. Agregar columna fase2_detalle_curricular
  console.log('1. Agregando columna fase2_detalle_curricular...');
  await sql`ALTER TABLE paec_projects ADD COLUMN IF NOT EXISTS fase2_detalle_curricular JSONB`;
  console.log('   ✓ Columna fase2_detalle_curricular agregada o ya existente.');

  // 2. Modificar constraint check de current_step
  console.log('2. Actualizando constraint de current_step a 1..7...');
  await sql`ALTER TABLE paec_projects DROP CONSTRAINT IF EXISTS paec_projects_current_step_check`;
  await sql`ALTER TABLE paec_projects ADD CONSTRAINT paec_projects_current_step_check CHECK (current_step BETWEEN 1 AND 7)`;
  console.log('   ✓ Constraint paec_projects_current_step_check actualizado a 1..7.');

  // 3. Verificar estructura de la tabla
  console.log('3. Verificando columnas de paec_projects...');
  const cols = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'paec_projects' 
    ORDER BY ordinal_position
  `;
  console.log('   Columnas encontradas:');
  cols.forEach(c => console.log(`   - ${c.column_name} (${c.data_type})`));

  console.log('\n--- Migración completada exitosamente ---');
}

run().catch(err => {
  console.error('Error durante la migración:', err);
  process.exit(1);
});
