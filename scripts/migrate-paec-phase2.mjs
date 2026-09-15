import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function migratePaecSchema() {
  console.log('🚀 Aplicando migración SQL para Motor PAEC-PEC 2.0 en Neon DB...');

  console.log('1. Agregando fase3_plan_operativo_a...');
  await sql`ALTER TABLE paec_projects ADD COLUMN IF NOT EXISTS fase3_plan_operativo_a JSONB;`;

  console.log('2. Agregando fase3_plan_operativo_b...');
  await sql`ALTER TABLE paec_projects ADD COLUMN IF NOT EXISTS fase3_plan_operativo_b JSONB;`;

  console.log('3. Agregando fase3_implementacion...');
  await sql`ALTER TABLE paec_projects ADD COLUMN IF NOT EXISTS fase3_implementacion JSONB;`;

  console.log('4. Agregando fase4_gobernanza...');
  await sql`ALTER TABLE paec_projects ADD COLUMN IF NOT EXISTS fase4_gobernanza JSONB;`;

  console.log('5. Agregando fase4_informe_supervision...');
  await sql`ALTER TABLE paec_projects ADD COLUMN IF NOT EXISTS fase4_informe_supervision JSONB;`;

  console.log('6. Agregando quality_audit...');
  await sql`ALTER TABLE paec_projects ADD COLUMN IF NOT EXISTS quality_audit JSONB;`;

  console.log('🔍 Verificando columnas de paec_projects...');
  const cols = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'paec_projects'
    ORDER BY ordinal_position;
  `;
  console.log('Columnas actuales de paec_projects:');
  for (const c of cols) {
    console.log(` - ${c.column_name} (${c.data_type})`);
  }

  console.log('✅ Migración de base de datos completada exitosamente.');
}

migratePaecSchema().catch((err) => {
  console.error('❌ Error en la migración:', err);
  process.exit(1);
});
