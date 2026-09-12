import { neon } from '@neondatabase/serverless';

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("Falta DATABASE_URL en process.env");
  process.exit(1);
}

const sql = neon(dbUrl);

async function run() {
  try {
    await sql`ALTER TABLE horario_grupos ADD COLUMN IF NOT EXISTS custom_uacs JSONB;`;
    console.log('✓ Columna custom_uacs agregada con éxito a horario_grupos en PostgreSQL');
  } catch (err) {
    console.error('Error al agregar columna:', err);
    process.exit(1);
  }
}

run();
