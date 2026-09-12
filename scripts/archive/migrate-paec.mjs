import { neon } from '@neondatabase/serverless';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env.local manually
const envLocalPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envLocalPath)) {
  const envText = fs.readFileSync(envLocalPath, 'utf-8');
  envText.split('\n').forEach(line => {
    const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)$/);
    if (match) {
      const key = match[1].trim();
      let val = match[2].trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
      process.env[key] = val;
    }
  });
}

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error('❌ DATABASE_URL is not defined in env.local');
  process.exit(1);
}

const sql = neon(DB_URL);

async function run() {
  try {
    console.log('Conectando a la base de datos para crear la tabla paec_projects...');
    
    await sql`
      CREATE TABLE IF NOT EXISTS paec_projects (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        teacher_id          UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
        project_name        TEXT NOT NULL,
        problem_statement   TEXT NOT NULL,
        cycle_type          TEXT NOT NULL CHECK (cycle_type IN ('A', 'B', 'annual')),
        current_step        INTEGER NOT NULL DEFAULT 1 CHECK (current_step BETWEEN 1 AND 6),
        
        -- Insumos de Contexto (Ingresados por el docente)
        community_context   JSONB NOT NULL DEFAULT '{}',
        school_context      JSONB NOT NULL DEFAULT '{}',
        
        -- Estados de Generación del Pipeline (Fases I y II)
        fase1_diagnostico   JSONB, -- Tablas 1, 2, 3, 4
        fase2_justificacion JSONB, -- Propósitos, Metas, Pilares
        fase2_mapeo         JSONB, -- Matriz continua de UACs transversalizada
        fase2_cronograma    JSONB, -- Cronograma macro de Relevos
        fase2_plan_operativo JSONB, -- Planes operativos semanales A y B
        fase2_anexos        JSONB, -- Formatos de control (Minutas, Evaluación, etc.)
        
        status              TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'completed')),
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    console.log('  ✓ Tabla paec_projects creada.');

    console.log('\nCreando índice idx_paec_projects_teacher_id...');
    await sql`
      CREATE INDEX IF NOT EXISTS idx_paec_projects_teacher_id 
      ON paec_projects (teacher_id, created_at DESC)
    `;
    console.log('  ✓ idx_paec_projects_teacher_id');

    console.log('\nCreando trigger para actualizar updated_at...');
    await sql`DROP TRIGGER IF EXISTS paec_projects_updated_at ON paec_projects`;
    await sql`
      CREATE TRIGGER paec_projects_updated_at
        BEFORE UPDATE ON paec_projects
        FOR EACH ROW EXECUTE FUNCTION update_updated_at()
    `;
    console.log('  ✓ trigger paec_projects_updated_at');

    console.log('\n🎉 ¡Migración PAEC completada con éxito!');
  } catch (e) {
    console.error('❌ Error ejecutando migración:', e.message || e);
    process.exit(1);
  }
}

run();
